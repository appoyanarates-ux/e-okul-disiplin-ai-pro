import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  AlertTriangle, BadgeInfo, CheckCircle2, ChevronRight, ClipboardList, Download, Edit3, Eye, FilePlus2,
  FileSpreadsheet, FileText, Gavel, History, Info, Paperclip, Plus, Printer, Repeat, Search, ShieldAlert, Trash2, Upload, User, X,
} from 'lucide-react';
import { useStudents } from '../context/StudentContext';
import { useIncidents } from '../context/IncidentContext';
import { useSettings } from '../context/SettingsContext';
import { useWrittenWarnings } from '../context/WrittenWarningContext';
import { Student, WrittenWarning, WarningAttachment } from '../types';
import {
  BEHAVIOR_CATALOG, CUSTOM_PREFIX, buildRepeatAlertText, findPriorWarnings, formatDateTr, getBehaviorDef,
  getBehaviorRef, getStudentOpenIncidents, getStudentPenaltyRecords, makeCustomBehaviorKey, searchStudents,
  sortWarningsByDate, suggestDocumentNo, summarizeByBehavior, getBehaviorAlertLabel,
} from '../services/warningCatalog';
import { buildWrittenWarningHtml, downloadWrittenWarningDoc } from '../services/writtenWarningDoc';
import { printHtmlViaIframe } from '../services/exportService';
import { deleteAttachment, getAttachmentUrl, uploadAttachment } from '../services/bridge';

const newId = () => (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Ortak bileşenler
// ---------------------------------------------------------------------------

const NotPenaltyNote = ({ compact }: { compact?: boolean }) => (
  <div className={`flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-900 ${compact ? 'p-2.5 text-[11px]' : 'p-3.5 text-xs'}`}>
    <BadgeInfo className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
    <div className="leading-relaxed">
      <b>Yazılı uyarı disiplin cezası değildir.</b> e-Okul'a disiplin cezası olarak işlenmez, davranış puanından düşüş yapılmaz.
      Yalnızca okul içi takip, bilgilendirme ve belgelendirme amacıyla saklanır. Disiplin cezaları ayrı disiplin kayıt sistemi üzerinden yönetilir.
    </div>
  </div>
);

const RepeatAlert: React.FC<{ text: string; children?: React.ReactNode }> = ({ text, children }) => (
  <div className="rounded-xl border-2 border-red-300 bg-red-50 p-3.5 text-red-900 shadow-sm" role="alert">
    <div className="flex items-start gap-2.5">
      <ShieldAlert className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
      <div className="text-[13px] leading-relaxed font-medium">{text}</div>
    </div>
    {children}
  </div>
);

// ---------------------------------------------------------------------------
// Tutanak görüntüleme
// ---------------------------------------------------------------------------

const WarningDocModal = ({ warning, student, priorCount, onClose }: { warning: WrittenWarning; student?: Student; priorCount: number; onClose: () => void }) => {
  const { institution } = useSettings();
  const html = useMemo(() => buildWrittenWarningHtml(warning, institution, student, { priorCount }), [warning, institution, student, priorCount]);
  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-6" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="font-bold text-slate-800 flex items-center gap-2"><FileText className="w-5 h-5 text-amber-600" /> Yazılı Uyarı Tutanağı</div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => printHtmlViaIframe(html)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">
              <Printer className="w-4 h-4" /> Yazdır / PDF
            </button>
            <button onClick={() => downloadWrittenWarningDoc(warning, institution, student, { priorCount })} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50">
              <Download className="w-4 h-4" /> Word
            </button>
            <button onClick={onClose} className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-200"><X className="w-5 h-5" /></button>
          </div>
        </div>
        <iframe title="Yazılı uyarı tutanağı önizleme" srcDoc={html} className="flex-1 w-full bg-slate-200" />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Yeni / düzenle formu
// ---------------------------------------------------------------------------

interface FormInit {
  studentId?: string;
  behaviorKey?: string;
  incidentId?: string;
  editing?: WrittenWarning;
}

const OTHER = '__diger__';

const WarningFormModal = ({ init, onClose, onSaved }: { init: FormInit; onClose: () => void; onSaved: (w: WrittenWarning, isNew: boolean) => void }) => {
  const { students } = useStudents();
  const { incidents } = useIncidents();
  const { institution } = useSettings();
  const { warnings, addWarning, updateWarning } = useWrittenWarnings();
  const navigate = useNavigate();
  const editing = init.editing;

  const [studentId, setStudentId] = useState<string>(editing?.studentId || init.studentId || '');
  const [studentQuery, setStudentQuery] = useState('');
  const student = students.find(s => s.id === studentId);

  // Daha önce kullanılan serbest (katalog dışı) davranışlar da listede çıksın ki tekrarlar eşleşsin
  const customBehaviors = useMemo(() => {
    const m = new Map<string, string>();
    warnings.forEach(w => { if (w.behaviorKey.startsWith(CUSTOM_PREFIX)) m.set(w.behaviorKey, w.behaviorTitle); });
    return [...m.entries()].map(([key, title]) => ({ key, title }));
  }, [warnings]);

  const initialBehavior = editing?.behaviorKey || init.behaviorKey || '';
  const [behaviorSel, setBehaviorSel] = useState<string>(initialBehavior);
  const [customTitle, setCustomTitle] = useState<string>('');

  const behaviorKey = behaviorSel === OTHER ? (customTitle.trim() ? makeCustomBehaviorKey(customTitle) : '') : behaviorSel;
  const behaviorTitle = behaviorSel === OTHER
    ? customTitle.trim()
    : (getBehaviorDef(behaviorSel)?.title || customBehaviors.find(c => c.key === behaviorSel)?.title || editing?.behaviorTitle || '');

  const relatedIncident = incidents.find(i => i.id === (editing?.relatedIncidentId || init.incidentId));

  const [date, setDate] = useState(editing?.date || relatedIncident?.date || todayIso());
  const [time, setTime] = useState(editing?.time || relatedIncident?.time || nowTime());
  const [location, setLocation] = useState(editing?.location || relatedIncident?.location || '');
  const [description, setDescription] = useState(editing?.description || relatedIncident?.description || '');
  const [warnedBy, setWarnedBy] = useState(editing?.warnedBy || '');
  const [warnedByTitle, setWarnedByTitle] = useState(editing?.warnedByTitle || 'Müdür Yardımcısı');
  const [documentNo, setDocumentNo] = useState(editing?.documentNo || suggestDocumentNo(warnings, todayIso()));
  const [parentName, setParentName] = useState(editing?.parentName || '');
  const [notes, setNotes] = useState(editing?.notes || '');
  const [incidentId, setIncidentId] = useState(editing?.relatedIncidentId || init.incidentId || '');
  const [error, setError] = useState<string | null>(null);

  // Öğrenci seçilince veli adını öner
  useEffect(() => {
    if (!editing && student?.parentName && !parentName) setParentName(student.parentName);
  }, [studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const prior = useMemo(
    () => (studentId && behaviorKey ? findPriorWarnings(warnings, studentId, behaviorKey, { excludeId: editing?.id }) : []),
    [warnings, studentId, behaviorKey, editing?.id]
  );
  const otherWarnings = useMemo(
    () => (studentId ? warnings.filter(w => w.studentId === studentId && w.behaviorKey !== behaviorKey && w.id !== editing?.id) : []),
    [warnings, studentId, behaviorKey, editing?.id]
  );
  const studentIncidents = useMemo(
    () => (student ? incidents.filter(i => i.involvedStudents.some(r => r.studentId === student.id)) : []),
    [incidents, student]
  );

  const results = useMemo(() => searchStudents(students, studentQuery, 12), [students, studentQuery]);

  // Tam numara yazılırsa öğrenciyi otomatik seç
  useEffect(() => {
    const q = studentQuery.trim();
    if (/^\d+$/.test(q)) {
      const exact = students.filter(s => String(s.number).trim() === q);
      if (exact.length === 1) { setStudentId(exact[0].id); setStudentQuery(''); }
    }
  }, [studentQuery, students]);

  const handleSave = () => {
    setError(null);
    if (!student && !editing) return setError('Lütfen öğrenciyi seçin.');
    if (!behaviorKey || !behaviorTitle) return setError('Lütfen uyarıya konu davranışı seçin veya yazın.');
    if (!date) return setError('Lütfen uyarı tarihini girin.');
    const base = {
      studentId: student?.id || editing!.studentId,
      studentNumber: student?.number || editing?.studentNumber || '',
      studentName: student?.name || editing?.studentName || '',
      studentGrade: student?.grade || editing?.studentGrade || '',
      date, time, location: location.trim(), behaviorKey, behaviorTitle,
      description: description.trim(), warnedBy: warnedBy.trim(), warnedByTitle: warnedByTitle.trim(),
      documentNo: documentNo.trim(), parentName: parentName.trim(), notes: notes.trim(),
      relatedIncidentId: incidentId || undefined,
      isRepeat: prior.length > 0,
    };
    if (editing) {
      updateWarning(editing.id, base);
      onSaved({ ...editing, ...base }, false);
    } else {
      const rec = addWarning({ id: newId(), ...base, signedByStudent: false, signedByParent: false, attachments: [] });
      onSaved(rec, true);
    }
  };

  const openIncidentForEvaluation = () => {
    if (!student) return;
    const params = new URLSearchParams({ new: '1', student: student.id, behavior: behaviorKey, title: behaviorTitle });
    navigate(`/incidents?${params.toString()}`);
  };

  const inputCls = 'w-full p-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none bg-white';
  const labelCls = 'block text-[11px] font-bold text-slate-500 uppercase mb-1';

  return (
    <div className="fixed inset-0 z-[55] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-3xl max-h-[96vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FilePlus2 className="w-5 h-5 text-amber-600" /> {editing ? 'Yazılı Uyarıyı Düzenle' : 'Yeni Yazılı Uyarı Kaydı'}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Öğrenci */}
          <div>
            <label className={labelCls}>Öğrenci (numara veya ad soyad ile arayın)</label>
            {student ? (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">{student.number}</div>
                  <div className="min-w-0">
                    <div className="font-bold text-slate-800 truncate">{student.name}</div>
                    <div className="text-xs text-slate-500">{student.grade} • No: {student.number}</div>
                  </div>
                </div>
                {!editing && <button onClick={() => setStudentId('')} className="text-xs font-semibold text-blue-600 hover:underline shrink-0">Değiştir</button>}
              </div>
            ) : editing ? (
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm">{editing.studentName} ({editing.studentNumber} - {editing.studentGrade}) <span className="text-xs text-slate-400">• öğrenci listede bulunamadı</span></div>
            ) : (
              <div>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <input autoFocus value={studentQuery} onChange={e => setStudentQuery(e.target.value)} inputMode="search"
                    placeholder="Örn: 1453 veya Ahmet Yılmaz" className={`${inputCls} pl-9`} />
                </div>
                {studentQuery && (
                  <div className="mt-2 border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                    {results.length === 0 ? <div className="p-3 text-sm text-slate-400">Öğrenci bulunamadı.</div> : results.map(s => {
                      const cnt = warnings.filter(w => w.studentId === s.id).length;
                      return (
                        <button key={s.id} onClick={() => { setStudentId(s.id); setStudentQuery(''); }} className="w-full text-left p-2.5 hover:bg-amber-50 flex items-center justify-between gap-2">
                          <span className="text-sm"><b className="font-mono text-slate-600 mr-2">{s.number}</b>{s.name} <span className="text-slate-400 text-xs">({s.grade})</span></span>
                          {cnt > 0 && <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{cnt} uyarı</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Davranış */}
          <div>
            <label className={labelCls}>Uyarıya Konu Davranış</label>
            <select value={behaviorSel} onChange={e => setBehaviorSel(e.target.value)} className={inputCls}>
              <option value="">-- Davranışı seçin --</option>
              <optgroup label="Yönetmelikteki davranışlar">
                {BEHAVIOR_CATALOG.map(b => (
                  <option key={b.key} value={b.key}>{b.title}{getBehaviorRef(b.key, institution.type) ? ` (${getBehaviorRef(b.key, institution.type)})` : ''}</option>
                ))}
              </optgroup>
              {customBehaviors.length > 0 && (
                <optgroup label="Daha önce kaydedilen diğer davranışlar">
                  {customBehaviors.map(c => <option key={c.key} value={c.key}>{c.title}</option>)}
                </optgroup>
              )}
              <option value={OTHER}>Diğer (listede yok — kendim yazacağım)</option>
            </select>
            {behaviorSel === OTHER && (
              <input value={customTitle} onChange={e => setCustomTitle(e.target.value)} placeholder="Davranışı kısaca yazın (örn: Okul bahçesinde top oynayarak camı kırmak)" className={`${inputCls} mt-2`} />
            )}
          </div>

          {/* Otomatik kontrol */}
          {student && behaviorKey && (prior.length > 0 ? (
            <RepeatAlert text={buildRepeatAlertText(behaviorKey, behaviorTitle, prior)}>
              <div className="mt-3 pl-7 space-y-2">
                <p className="text-[11px] text-red-800/90 leading-relaxed">
                  Program bu durumu <b>otomatik olarak disiplin cezasına dönüştürmez</b>. Disiplin işleminin uygulanıp uygulanmayacağı,
                  yürürlükteki mevzuat ve yetkili kurulun veya okul yönetiminin değerlendirmesi doğrultusunda belirlenir.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={openIncidentForEvaluation} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700">
                    <Gavel className="w-3.5 h-3.5" /> Değerlendirme için disiplin olayı kaydı aç
                  </button>
                  <span className="text-[11px] text-red-700 self-center">veya aşağıdan yazılı uyarı olarak kaydetmeye devam edin.</span>
                </div>
              </div>
            </RepeatAlert>
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900 text-[13px] flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                Bu öğrenci için <b>{getBehaviorAlertLabel(behaviorKey, behaviorTitle)}</b> davranışı nedeniyle önceki yazılı uyarı bulunmuyor.
                İlk kez gerçekleşen davranış için <b>Yazılı Uyarı Tutanağı</b> oluşturabilirsiniz.
                {otherWarnings.length > 0 && <div className="text-xs mt-1 text-emerald-800">Bilgi: Öğrencinin başka davranışlardan {otherWarnings.length} yazılı uyarısı var.</div>}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className={labelCls}>Tarih</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Saat</label><input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} /></div>
            <div className="col-span-2"><label className={labelCls}>Olay Yeri</label><input value={location} onChange={e => setLocation(e.target.value)} placeholder="Örn: 10-A sınıfı" className={inputCls} /></div>
          </div>

          <div>
            <label className={labelCls}>Davranışın Açıklaması</label>
            <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className={`${inputCls} resize-none`} placeholder="Davranışın nasıl gerçekleştiği, kimin tespit ettiği..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className={labelCls}>Uyarıyı Yapan</label><input value={warnedBy} onChange={e => setWarnedBy(e.target.value)} placeholder="Ad Soyad" className={inputCls} /></div>
            <div><label className={labelCls}>Unvanı</label><input value={warnedByTitle} onChange={e => setWarnedByTitle(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Veli Adı Soyadı</label><input value={parentName} onChange={e => setParentName(e.target.value)} className={inputCls} /></div>
            <div><label className={labelCls}>Tutanak Sayısı</label><input value={documentNo} onChange={e => setDocumentNo(e.target.value)} className={`${inputCls} font-mono`} /></div>
          </div>

          {studentIncidents.length > 0 && (
            <div>
              <label className={labelCls}>İlişkili Olay Kaydı (isteğe bağlı)</label>
              <select value={incidentId} onChange={e => setIncidentId(e.target.value)} className={inputCls}>
                <option value="">-- İlişkilendirme yok --</option>
                {studentIncidents.map(i => <option key={i.id} value={i.id}>{i.code} • {i.title} ({formatDateTr(i.date)})</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Not (okul içi)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="İsteğe bağlı" />
          </div>

          <NotPenaltyNote compact />
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">{error}</div>}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50">Vazgeç</button>
          <button onClick={handleSave} className={`px-4 py-2.5 rounded-lg text-white text-sm font-bold flex items-center justify-center gap-2 ${prior.length > 0 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <FileText className="w-4 h-4" />
            {editing ? 'Değişiklikleri Kaydet' : prior.length > 0 ? 'Yine de Yazılı Uyarı Olarak Kaydet' : 'Kaydet ve Tutanağı Oluştur'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Ek / imza yönetimi
// ---------------------------------------------------------------------------

const AttachmentManager = ({ warning }: { warning: WrittenWarning }) => {
  const { updateWarning } = useWrittenWarnings();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const atts = warning.attachments || [];

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true); setErr(null);
    try {
      const added: WarningAttachment[] = [];
      for (const f of Array.from(files)) {
        added.push(await uploadAttachment(warning.id, f));
      }
      updateWarning(warning.id, { attachments: [...atts, ...added] });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const remove = async (a: WarningAttachment) => {
    if (!confirm(`"${a.name}" eki silinsin mi?`)) return;
    await deleteAttachment(a);
    updateWarning(warning.id, { attachments: atts.filter(x => x.id !== a.id) });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 accent-emerald-600" checked={!!warning.signedByStudent}
            onChange={e => updateWarning(warning.id, { signedByStudent: e.target.checked, signedAt: e.target.checked ? (warning.signedAt || new Date().toISOString()) : warning.signedAt })} />
          Öğrenci imzaladı
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 accent-emerald-600" checked={!!warning.signedByParent}
            onChange={e => updateWarning(warning.id, { signedByParent: e.target.checked, signedAt: e.target.checked ? (warning.signedAt || new Date().toISOString()) : warning.signedAt })} />
          Veli imzaladı
        </label>
        <button disabled={busy} onClick={() => inputRef.current?.click()} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 font-semibold text-slate-700 disabled:opacity-60">
          <Upload className="w-3.5 h-3.5" /> {busy ? 'Yükleniyor…' : 'İmzalı tutanağı ekle (foto / PDF)'}
        </button>
        <input ref={inputRef} type="file" accept="image/*,application/pdf" capture="environment" multiple hidden onChange={e => onFiles(e.target.files)} />
      </div>
      {err && <div className="text-[11px] text-red-700">{err}</div>}
      {atts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {atts.map(a => {
            const url = getAttachmentUrl(a);
            return (
              <span key={a.id} className="inline-flex items-center gap-1.5 text-[11px] bg-slate-100 border border-slate-200 rounded-lg px-2 py-1">
                <Paperclip className="w-3 h-3 text-slate-500" />
                {url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-700 hover:underline max-w-[180px] truncate">{a.name}</a> : <span className="max-w-[180px] truncate">{a.name}</span>}
                <span className="text-slate-400">{Math.max(1, Math.round(a.size / 1024))} KB</span>
                <button onClick={() => remove(a)} className="text-slate-400 hover:text-red-600"><X className="w-3 h-3" /></button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Öğrenci detay ekranı
// ---------------------------------------------------------------------------

const StudentDetail = ({ student, onNew, onEdit, onView }: {
  student: Student;
  onNew: (behaviorKey?: string) => void;
  onEdit: (w: WrittenWarning) => void;
  onView: (w: WrittenWarning) => void;
}) => {
  const { incidents } = useIncidents();
  const { warnings, deleteWarning } = useWrittenWarnings();
  const studentWarnings = useMemo(() => sortWarningsByDate(warnings.filter(w => w.studentId === student.id)).reverse(), [warnings, student.id]);
  const summaries = useMemo(() => summarizeByBehavior(studentWarnings), [studentWarnings]);
  const repeated = summaries.filter(s => s.count >= 2);
  const single = summaries.filter(s => s.count === 1);
  const penalties = useMemo(() => getStudentPenaltyRecords(student, incidents), [student, incidents]);
  const openIncidents = useMemo(() => getStudentOpenIncidents(student, incidents), [student, incidents]);

  const handleDelete = async (w: WrittenWarning) => {
    if (!confirm(`${formatDateTr(w.date)} tarihli "${w.behaviorTitle}" yazılı uyarısı kalıcı olarak silinsin mi?`)) return;
    for (const a of w.attachments || []) await deleteAttachment(a);
    deleteWarning(w.id);
  };

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0"><User className="w-6 h-6" /></div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-slate-800 truncate">{student.name}</h2>
              <p className="text-sm text-slate-500">No: <b className="font-mono">{student.number}</b> • {student.grade}{student.parentName ? ` • Veli: ${student.parentName}` : ''}</p>
            </div>
          </div>
          <button onClick={() => onNew()} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold shadow-sm">
            <Plus className="w-4 h-4" /> Yeni Yazılı Uyarı
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 sm:p-3 text-center">
            <div className="text-xl sm:text-2xl font-black text-amber-700">{studentWarnings.length}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-amber-800">Yazılı Uyarı</div>
          </div>
          <div className={`rounded-xl p-2.5 sm:p-3 text-center border ${repeated.length ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`text-xl sm:text-2xl font-black ${repeated.length ? 'text-red-700' : 'text-slate-500'}`}>{repeated.length}</div>
            <div className={`text-[10px] sm:text-xs font-semibold ${repeated.length ? 'text-red-800' : 'text-slate-500'}`}>Tekrarlanan Davranış</div>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 sm:p-3 text-center">
            <div className="text-xl sm:text-2xl font-black text-slate-700">{penalties.length}</div>
            <div className="text-[10px] sm:text-xs font-semibold text-slate-600">Disiplin Cezası</div>
          </div>
        </div>
      </div>

      {/* Otomatik tekrar uyarıları */}
      {repeated.map(s => (
        <RepeatAlert key={s.behaviorKey} text={buildRepeatAlertText(s.behaviorKey, s.behaviorTitle, s.warnings.slice(0, -1))}>
          <div className="mt-2 pl-7 text-[11px] text-red-800/90">
            Bu davranış toplam <b>{s.count} kez</b> yazılı uyarıya konu olmuştur (son: {formatDateTr(s.lastDate)}). Program bu durumu otomatik olarak disiplin cezasına dönüştürmez;
            değerlendirme yetkili kurul / okul yönetimine aittir.
          </div>
        </RepeatAlert>
      ))}
      {single.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5"><Info className="w-4 h-4" /> Daha önce yazılı uyarı alınan davranışlar</div>
          {single.map(s => (
            <div key={s.behaviorKey}>• <b>{s.behaviorTitle}</b> — {formatDateTr(s.firstDate)} tarihinde yazılı olarak uyarıldı. Aynı davranış yeniden kaydedilirken program sizi uyaracaktır.</div>
          ))}
        </div>
      )}

      {/* Davranış bazında özet */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 font-bold text-slate-700"><Repeat className="w-4 h-4 text-amber-600" /> Davranış Bazında Tekrar Durumu</div>
        {summaries.length === 0 ? (
          <div className="p-5 text-sm text-slate-400">Bu öğrenci için kayıtlı yazılı uyarı bulunmuyor.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr><th className="text-left p-2.5">Davranış</th><th className="p-2.5">Sayı</th><th className="p-2.5 whitespace-nowrap">İlk Uyarı</th><th className="p-2.5 whitespace-nowrap">Son Uyarı</th><th className="p-2.5">Durum</th><th className="p-2.5"></th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summaries.map(s => (
                  <tr key={s.behaviorKey}>
                    <td className="p-2.5 font-medium text-slate-800 min-w-[200px]">{s.behaviorTitle}</td>
                    <td className="p-2.5 text-center font-bold">{s.count}</td>
                    <td className="p-2.5 text-center whitespace-nowrap">{formatDateTr(s.firstDate)}</td>
                    <td className="p-2.5 text-center whitespace-nowrap">{formatDateTr(s.lastDate)}</td>
                    <td className="p-2.5 text-center">
                      {s.count >= 2
                        ? <span className="text-[10px] font-bold bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full whitespace-nowrap">TEKRAR ({s.count})</span>
                        : <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">İlk uyarı</span>}
                    </td>
                    <td className="p-2.5 text-right"><button onClick={() => onNew(s.behaviorKey)} className="text-[11px] font-semibold text-blue-600 hover:underline whitespace-nowrap">+ Aynı davranış</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Yazılı uyarı kayıtları */}
      <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-amber-100 bg-amber-50/60 flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold text-amber-900 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Yazılı Uyarı Kayıtları ve Tutanaklar</div>
          <span className="text-[10px] font-bold uppercase tracking-wide bg-white border border-amber-300 text-amber-800 px-2 py-0.5 rounded-full">Disiplin cezası değildir</span>
        </div>
        {studentWarnings.length === 0 ? (
          <div className="p-5 text-sm text-slate-400">Kayıt yok.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {studentWarnings.map(w => {
              const priorCount = findPriorWarnings(warnings, w.studentId, w.behaviorKey, { excludeId: w.id, beforeDate: w.date }).length;
              const inc = w.relatedIncidentId ? incidents.find(i => i.id === w.relatedIncidentId) : undefined;
              return (
                <div key={w.id} className="p-4 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-500">{formatDateTr(w.date)} {w.time || ''}</span>
                        {w.documentNo && <span className="text-[10px] font-mono bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">{w.documentNo}</span>}
                        {priorCount > 0 && <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">{priorCount + 1}. kez (tekrar)</span>}
                        {w.signedByStudent && w.signedByParent
                          ? <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">İmzalandı</span>
                          : <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">İmza bekliyor</span>}
                      </div>
                      <div className="font-bold text-slate-800 mt-1">{w.behaviorTitle}</div>
                      {w.description && <div className="text-sm text-slate-600 mt-0.5 whitespace-pre-line">{w.description}</div>}
                      <div className="text-xs text-slate-400 mt-1">
                        {w.location ? `Yer: ${w.location} • ` : ''}{w.warnedBy ? `Uyaran: ${w.warnedBy} • ` : ''}{w.parentName ? `Veli: ${w.parentName}` : ''}
                        {inc && <> • Olay: <Link to="/incidents" className="text-blue-600 hover:underline">{inc.code}</Link></>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button title="Tutanağı görüntüle / yazdır" onClick={() => onView(w)} className="p-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100"><Eye className="w-4 h-4" /></button>
                      <button title="Düzenle" onClick={() => onEdit(w)} className="p-2 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"><Edit3 className="w-4 h-4" /></button>
                      <button title="Sil" onClick={() => handleDelete(w)} className="p-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <AttachmentManager warning={w} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Disiplin cezası kayıtları (ayrı) */}
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-red-100 bg-red-50/60 flex flex-wrap items-center justify-between gap-2">
          <div className="font-bold text-red-900 flex items-center gap-2"><Gavel className="w-4 h-4" /> Disiplin Cezası Kayıtları</div>
          <span className="text-[10px] font-bold uppercase tracking-wide bg-white border border-red-300 text-red-800 px-2 py-0.5 rounded-full">Resmî kayıt • e-Okul</span>
        </div>
        {penalties.length === 0 ? (
          <div className="p-5 text-sm text-slate-400">Bu öğrencinin kayıtlı disiplin cezası bulunmuyor.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr><th className="text-left p-2.5">Tarih</th><th className="text-left p-2.5">Karar</th><th className="text-left p-2.5">Konu</th><th className="p-2.5">Karar No</th><th className="p-2.5">Kaynak</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {penalties.map(p => (
                  <tr key={p.id} className={p.isRemoved ? 'opacity-60' : ''}>
                    <td className="p-2.5 whitespace-nowrap">{formatDateTr(p.date)}</td>
                    <td className="p-2.5 font-bold text-red-800">{p.decision}{p.isRemoved && <span className="ml-1 text-[10px] font-bold text-emerald-700">(Kaldırıldı)</span>}</td>
                    <td className="p-2.5 text-slate-600">{p.title || '-'}</td>
                    <td className="p-2.5 text-center font-mono text-xs">{p.decisionNo || '-'}</td>
                    <td className="p-2.5 text-center text-xs">{p.source === 'incident' ? (p.incidentCode || 'Olay') : 'Sistem dışı'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {openIncidents.length > 0 && (
          <div className="px-4 py-3 border-t border-red-100 text-xs text-slate-600">
            Karara bağlanmamış olay(lar): {openIncidents.map(i => <Link key={i.id} to="/incidents" className="text-blue-600 hover:underline mr-2">{i.code} {i.title}</Link>)}
          </div>
        )}
      </div>

      <NotPenaltyNote />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Ana sayfa
// ---------------------------------------------------------------------------

const WrittenWarnings = () => {
  const { students } = useStudents();
  const { warnings } = useWrittenWarnings();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('student'));
  const [formInit, setFormInit] = useState<FormInit | null>(null);
  const [viewing, setViewing] = useState<WrittenWarning | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Olay kaydından veya başka sayfadan gelen yönlendirme: /written-warnings?new=1&student=..&behavior=..&incident=..
  useEffect(() => {
    const sid = searchParams.get('student');
    if (sid) setSelectedId(sid);
    if (searchParams.get('new') === '1') {
      setFormInit({ studentId: sid || undefined, behaviorKey: searchParams.get('behavior') || undefined, incidentId: searchParams.get('incident') || undefined });
      const next = new URLSearchParams(searchParams);
      next.delete('new'); next.delete('behavior'); next.delete('incident');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => searchStudents(students, query, 40), [students, query]);

  // Tam numara yazıldığında öğrenciyi doğrudan aç (otomatik sorgulama)
  useEffect(() => {
    const q = query.trim();
    if (/^\d+$/.test(q)) {
      const exact = students.filter(s => String(s.number).trim() === q);
      if (exact.length === 1) setSelectedId(exact[0].id);
    }
  }, [query, students]);

  const selected = students.find(s => s.id === selectedId) || null;

  const warningCountByStudent = useMemo(() => {
    const m = new Map<string, { total: number; repeated: number }>();
    const groups = new Map<string, number>();
    warnings.forEach(w => {
      const k = `${w.studentId}|${w.behaviorKey}`;
      groups.set(k, (groups.get(k) || 0) + 1);
      const cur = m.get(w.studentId) || { total: 0, repeated: 0 };
      cur.total++;
      m.set(w.studentId, cur);
    });
    groups.forEach((cnt, k) => {
      if (cnt >= 2) {
        const sid = k.split('|')[0];
        const cur = m.get(sid);
        if (cur) cur.repeated++;
      }
    });
    return m;
  }, [warnings]);

  const recent = useMemo(() => sortWarningsByDate(warnings).reverse().slice(0, 12), [warnings]);
  const repeatStudents = useMemo(() => {
    return [...warningCountByStudent.entries()].filter(([, v]) => v.repeated > 0).map(([sid, v]) => {
      const s = students.find(x => x.id === sid);
      const any = warnings.find(w => w.studentId === sid);
      return { id: sid, name: s?.name || any?.studentName || '?', number: s?.number || any?.studentNumber || '', grade: s?.grade || any?.studentGrade || '', ...v };
    });
  }, [warningCountByStudent, students, warnings]);

  const selectStudent = (id: string) => {
    setSelectedId(id);
    setSearchParams({ student: id }, { replace: true });
    if (window.innerWidth < 1024) setTimeout(() => document.getElementById('ww-detail')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const exportExcel = () => {
    const rows = sortWarningsByDate(warnings).map(w => ({
      'Tarih': formatDateTr(w.date), 'Saat': w.time || '', 'Okul No': w.studentNumber, 'Adı Soyadı': w.studentName, 'Sınıfı': w.studentGrade,
      'Davranış': w.behaviorTitle, 'Açıklama': w.description || '', 'Tekrar': w.isRepeat ? 'Evet' : 'Hayır', 'Tutanak Sayısı': w.documentNo || '',
      'Uyaran': w.warnedBy || '', 'Veli': w.parentName || '', 'Öğrenci İmzası': w.signedByStudent ? 'Var' : 'Yok', 'Veli İmzası': w.signedByParent ? 'Var' : 'Yok',
      'Ek Sayısı': (w.attachments || []).length,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Yazılı Uyarılar');
    XLSX.writeFile(wb, `Yazili_Uyarilar_${todayIso()}.xlsx`);
  };

  const viewingStudent = viewing ? students.find(s => s.id === viewing.studentId) : undefined;
  const viewingPrior = viewing ? findPriorWarnings(warnings, viewing.studentId, viewing.behaviorKey, { excludeId: viewing.id, beforeDate: viewing.date }).length : 0;

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><History className="w-7 h-7 text-amber-600" /> Yazılı Uyarı Takibi</h1>
          <p className="text-slate-500 text-sm mt-1">Öğrenci yazılı uyarı geçmişi ve tekrar eden davranış takibi. Öğrenci numarası veya adıyla sorgulayın.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportExcel} disabled={warnings.length === 0} className="flex items-center gap-1.5 px-3 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
          </button>
          <button onClick={() => setFormInit({ studentId: selected?.id })} className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 shadow-sm">
            <Plus className="w-4 h-4" /> Yeni Yazılı Uyarı
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sol: Sorgulama */}
        <div className="space-y-4 lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Öğrenci Sorgula</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
              <input value={query} onChange={e => setQuery(e.target.value)} inputMode="search" placeholder="Öğrenci no veya ad soyad"
                className="w-full pl-9 pr-9 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 outline-none" />
              {query && <button onClick={() => setQuery('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>}
            </div>
            {query && (
              <div className="mt-3 max-h-[50vh] overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-xl">
                {results.length === 0 ? <div className="p-3 text-sm text-slate-400">Öğrenci bulunamadı.</div> : results.map(s => {
                  const c = warningCountByStudent.get(s.id);
                  return (
                    <button key={s.id} onClick={() => selectStudent(s.id)} className={`w-full text-left p-2.5 flex items-center justify-between gap-2 hover:bg-amber-50 ${selectedId === s.id ? 'bg-amber-50' : ''}`}>
                      <span className="text-sm min-w-0 truncate"><b className="font-mono text-slate-500 mr-1.5">{s.number}</b>{s.name} <span className="text-xs text-slate-400">{s.grade}</span></span>
                      <span className="flex gap-1 shrink-0">
                        {c?.repeated ? <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded">TEKRAR</span> : null}
                        {c?.total ? <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">{c.total}</span> : null}
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {students.length === 0 && (
              <div className="mt-3 text-xs text-slate-500">Henüz öğrenci listesi yüklenmemiş. <Link to="/students" className="text-blue-600 font-semibold hover:underline">Öğrenci İşlemleri</Link> bölümünden e-Okul listesini yükleyin.</div>
            )}
          </div>

          {repeatStudents.length > 0 && (
            <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 text-sm font-bold text-red-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Tekrar Eden Davranışı Olanlar ({repeatStudents.length})</div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {repeatStudents.map(r => (
                  <button key={r.id} onClick={() => selectStudent(r.id)} className="w-full text-left px-4 py-2.5 hover:bg-red-50/60 flex justify-between items-center gap-2">
                    <span className="text-sm truncate"><b className="font-mono text-slate-500 mr-1.5">{r.number}</b>{r.name} <span className="text-xs text-slate-400">{r.grade}</span></span>
                    <span className="text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded shrink-0">{r.repeated} davranış</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 text-sm font-bold text-slate-700 flex items-center gap-2"><History className="w-4 h-4 text-amber-600" /> Son Yazılı Uyarılar ({warnings.length})</div>
            {recent.length === 0 ? <div className="p-4 text-sm text-slate-400">Henüz yazılı uyarı kaydı yok.</div> : (
              <div className="divide-y divide-slate-100">
                {recent.map(w => (
                  <button key={w.id} onClick={() => selectStudent(w.studentId)} className="w-full text-left px-4 py-2.5 hover:bg-amber-50/60">
                    <div className="flex justify-between gap-2 text-xs"><span className="font-mono text-slate-500">{formatDateTr(w.date)}</span>{w.isRepeat && <span className="font-bold text-red-600">tekrar</span>}</div>
                    <div className="text-sm font-semibold text-slate-800 truncate">{w.studentName} <span className="text-xs font-normal text-slate-400">{w.studentNumber} • {w.studentGrade}</span></div>
                    <div className="text-xs text-slate-500 truncate">{w.behaviorTitle}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sağ: Detay */}
        <div className="lg:col-span-2" id="ww-detail">
          {selected ? (
            <StudentDetail
              student={selected}
              onNew={(behaviorKey) => setFormInit({ studentId: selected.id, behaviorKey })}
              onEdit={(w) => setFormInit({ editing: w })}
              onView={(w) => setViewing(w)}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0"><Search className="w-6 h-6" /></div>
                <div>
                  <h2 className="font-bold text-slate-800 text-lg">Öğrenci seçin</h2>
                  <p className="text-sm text-slate-500 mt-1">Soldaki alana öğrenci numarasını yazın; numara tam eşleşirse öğrencinin geçmişi otomatik açılır. Aynı davranış için önceden yazılı uyarı varsa program sizi uyarır.</p>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><b className="text-amber-900 block mb-1">1. İlk davranış</b>Yazılı Uyarı Tutanağı oluşturulur, öğrenci ve velisine imzalatılır, imzalı tutanak kayda eklenir.</div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-3"><b className="text-red-900 block mb-1">2. Tekrar</b>Aynı davranış yeniden kaydedilirken program önceki uyarı tarihini gösterip bilgilendirir.</div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><b className="text-slate-800 block mb-1">3. Değerlendirme</b>Disiplin işlemine yetkili kurul / okul yönetimi karar verir. Program otomatik ceza vermez.</div>
              </div>
              <NotPenaltyNote />
            </div>
          )}
        </div>
      </div>

      {formInit && (
        <WarningFormModal
          init={formInit}
          onClose={() => setFormInit(null)}
          onSaved={(w, isNew) => {
            setFormInit(null);
            selectStudent(w.studentId);
            setToast(isNew ? 'Yazılı uyarı kaydedildi. Tutanağı yazdırıp öğrenci ve velisine imzalatabilirsiniz.' : 'Değişiklikler kaydedildi.');
            setTimeout(() => setToast(null), 4000);
            if (isNew) setViewing(w);
          }}
        />
      )}
      {viewing && <WarningDocModal warning={viewing} student={viewingStudent} priorCount={viewingPrior} onClose={() => setViewing(null)} />}
      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 max-w-[92vw]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> {toast}
        </div>
      )}
    </div>
  );
};

export default WrittenWarnings;
