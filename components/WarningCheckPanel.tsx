import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, FilePlus2, History, ShieldAlert } from 'lucide-react';
import { Incident, Student } from '../types';
import { useWrittenWarnings } from '../context/WrittenWarningContext';
import { buildRepeatAlertText, findPriorWarnings, formatDateTr, getBehaviorAlertLabel, resolveIncidentBehavior } from '../services/warningCatalog';

/**
 * Olay kaydı ekranında: fail öğrencilerin aynı davranış nedeniyle daha önce
 * yazılı olarak uyarılıp uyarılmadığını otomatik kontrol eder.
 * Yalnızca bilgilendirir; hiçbir kaydı otomatik olarak disiplin cezasına dönüştürmez.
 */
const WarningCheckPanel = ({ incident, students }: { incident: Incident; students: Student[] }) => {
  const { warnings } = useWrittenWarnings();
  const suspects = incident.involvedStudents.filter(r => r.role === 'suspect');
  if (suspects.length === 0) return null;

  const behavior = resolveIncidentBehavior(incident);

  return (
    <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/50 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-100/60 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-amber-900 flex items-center gap-2"><History className="w-4 h-4" /> Yazılı Uyarı Geçmişi Kontrolü</div>
        <div className="text-[11px] text-amber-800">
          {behavior.key
            ? <>Davranış: <b>{behavior.title}</b>{behavior.guessed && ' (olay adından tahmin edildi — yukarıdan "Davranış Türü" seçerek kesinleştirin)'}</>
            : 'Eşleştirme için yukarıdan "Davranış Türü" seçin.'}
        </div>
      </div>
      <div className="divide-y divide-amber-100">
        {suspects.map(rel => {
          const s = students.find(x => x.id === rel.studentId);
          if (!s) return null;
          const all = warnings.filter(w => w.studentId === s.id);
          const prior = behavior.key ? findPriorWarnings(warnings, s.id, behavior.key) : [];
          const others = all.filter(w => w.behaviorKey !== behavior.key);
          const newWarningLink = `/written-warnings?new=1&student=${encodeURIComponent(s.id)}${behavior.key ? `&behavior=${encodeURIComponent(behavior.key)}` : ''}${incident.id ? `&incident=${encodeURIComponent(incident.id)}` : ''}`;
          return (
            <div key={rel.studentId} className="p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-slate-800"><span className="font-mono text-slate-500 mr-1.5">{s.number}</span>{s.name} <span className="text-xs text-slate-400">{s.grade}</span></div>
                <Link to={`/written-warnings?student=${encodeURIComponent(s.id)}`} className="text-[11px] font-semibold text-blue-600 hover:underline">Uyarı geçmişini aç →</Link>
              </div>
              {behavior.key && prior.length > 0 ? (
                <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 text-red-900 text-[12.5px] leading-relaxed flex gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                  <div>
                    {buildRepeatAlertText(behavior.key, behavior.title || '', prior)}
                    <div className="text-[11px] mt-1.5 text-red-800/80">Bu bilgilendirme otomatik olarak disiplin cezası anlamına gelmez; karar yetkili kurul / okul yönetimine aittir.</div>
                  </div>
                </div>
              ) : behavior.key ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-900 text-xs flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> {getBehaviorAlertLabel(behavior.key, behavior.title)} davranışı için önceki yazılı uyarı yok (ilk kez).</span>
                  <Link to={newWarningLink} className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700">
                    <FilePlus2 className="w-3.5 h-3.5" /> Yazılı Uyarı Tutanağı Oluştur
                  </Link>
                </div>
              ) : (
                <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2">
                  Davranış türü belirlenemedi.
                  <Link to={newWarningLink} className="font-semibold text-amber-700 hover:underline">Yazılı uyarı tutanağı oluştur →</Link>
                </div>
              )}
              {others.length > 0 && (
                <div className="text-[11px] text-slate-600">
                  Diğer yazılı uyarılar: {others.slice(0, 4).map(w => `${w.behaviorTitle} (${formatDateTr(w.date)})`).join('; ')}{others.length > 4 ? ` ve ${others.length - 4} kayıt daha` : ''}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WarningCheckPanel;
