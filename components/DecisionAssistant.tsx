
import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, FileText, ChevronRight, Loader2, PenTool, User, AlertCircle, 
  Calendar, Clock, List, Printer, Users, Scale, Mail, Download, Calculator, ZoomIn, ZoomOut, RotateCcw, MessageSquare, ScrollText, Sparkles, CheckCircle, RefreshCw, Check, Minimize2,
  Layout, ChevronDown, Sliders, Edit3, X, Save, ChevronUp, GraduationCap
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { analyzeIncident, generateDecisionReason } from '../services/geminiService';
import { Incident, Student, InvolvedStudent, BoardMember, MarginType, PAGE_MARGINS } from '../types';
import { useStudents } from '../context/StudentContext';
import { useIncidents } from '../context/IncidentContext';
import { useSettings } from '../context/SettingsContext';
import { exportHtmlToWord, printHtmlViaIframe } from '../services/exportService';
import { getBoardInfo } from '../services/boardHelpers';

const getOneDegreeHeavierPenalty = (penalty: string, schoolType: string): string => {
  const p = penalty.toUpperCase().trim();
  const isLise = schoolType.toUpperCase().includes('LISE') || schoolType.toUpperCase().includes('LİSE');
  
  if (p.includes('UYARMA')) {
    return 'KINAMA';
  }
  if (p.includes('KINAMA')) {
    return isLise ? 'KISA SÜRELİ UZAKLAŞTIRMA (1-5 Gün)' : 'OKUL DEĞİŞTİRME / YAPTIRIM UYGULAMASI';
  }
  if (p.includes('UZAKLAŞTIRMA') || p.includes('AŞTIRMA')) {
    return 'OKUL DEĞİŞTİRME';
  }
  if (p.includes('DEĞİŞTİRME')) {
    return isLise ? 'ÖRGÜN EĞİTİM DIŞINA ÇIKARMA' : 'ÖRGÜN EĞİTİM DIŞINA ÇIKARMA (Sınır)';
  }
  return 'BİR ÜST DERECE CEZA';
};

const getOneDegreeLighterPenalty = (penalty: string, schoolType: string): string => {
  const p = penalty.toUpperCase().trim();
  const isLise = schoolType.toUpperCase().includes('LISE') || schoolType.toUpperCase().includes('LİSE');
  
  if (p.includes('ÖRGÜN') || p.includes('DIŞINA')) {
    return 'OKUL DEĞİŞTİRME';
  }
  if (p.includes('DEĞİŞTİRME')) {
    return isLise ? 'KISA SÜRELİ UZAKLAŞTIRMA (1-5 Gün)' : 'KINAMA';
  }
  if (p.includes('UZAKLAŞTIRMA') || p.includes('AŞTIRMA')) {
    return 'KINAMA';
  }
  if (p.includes('KINAMA')) {
    return 'UYARMA';
  }
  if (p.includes('UYARMA')) {
    return 'CEZA VERİLMEDİ / UYARIYLA YETİNİLDİ';
  }
  return 'BİR ALT DERECE CEZA';
};

const getDeductionForDecision = (decisionText: string, penaltyScoreVal?: string): number => {
  let score = parseInt(penaltyScoreVal || '0', 10);
  if (isNaN(score) || score === 0) {
    const dec = (decisionText || '').toUpperCase();
    if (dec.includes('UYARMA')) score = 5;
    else if (dec.includes('KINAMA')) score = 10;
    else if (dec.includes('UZAKLAŞTIRMA') || dec.includes('AŞTIRMA')) score = 20;
    else if (dec.includes('DEĞİŞTİRME')) score = 45;
    else if (dec.includes('DIŞINA ÇIKARMA') || dec.includes('ÖRGÜN')) score = 80;
  }
  return score;
};

const getStudentBehaviorPoints = (
  student: Student,
  allIncidents: Incident[],
  excludeIncidentId: string | null = null
): number => {
  let deductedPoints = 0;

  allIncidents.forEach(inc => {
    if (excludeIncidentId && inc.id === excludeIncidentId) return;
    const inv = inc.involvedStudents?.find((i: InvolvedStudent) => 
      i.studentId === student.id && 
      i.role === 'suspect' && 
      i.decision && 
      !i.decision.includes('YER OLMADIĞINA') &&
      !i.isRemoved
    );
    if (inv) {
      deductedPoints += getDeductionForDecision(inv.decision, inv.penaltyScore);
    }
  });

  if (student.previousPenalties) {
    student.previousPenalties.forEach(p => {
      if (p.isRemoved) return;
      deductedPoints += getDeductionForDecision(p.decision, p.penaltyScore);
    });
  }

  return Math.max(0, 100 - deductedPoints);
};

interface EditableDocumentContentProps {
  initialHtml: string;
  docIndex: number;
  fitToPage: boolean;
  docFontSize: number;
  onSave: (container: HTMLElement, docIndex: number) => void;
  onStartTyping?: () => void;
}

const EditableDocumentContent: React.FC<EditableDocumentContentProps> = React.memo(({
  initialHtml,
  docIndex,
  fitToPage,
  docFontSize,
  onSave,
  onStartTyping
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const lastLoadedHtmlRef = useRef(initialHtml);

  // Sync initialHtml into DOM when the document template changes (e.g. user selected another form or student)
  useEffect(() => {
    if (containerRef.current && (initialHtml !== lastLoadedHtmlRef.current || !containerRef.current.innerHTML)) {
      containerRef.current.innerHTML = initialHtml;
      lastLoadedHtmlRef.current = initialHtml;
    }
  }, [initialHtml]);

  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      if (onStartTyping) onStartTyping();
    }
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      lastLoadedHtmlRef.current = target.innerHTML;
      onSave(target, docIndex);
    }, 1200);
  };

  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    isTypingRef.current = false;
    lastLoadedHtmlRef.current = e.currentTarget.innerHTML;
    onSave(e.currentTarget, docIndex);
  };

  return (
    <div
      ref={containerRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onBlur={handleBlur}
      className={`outline-none hover:bg-yellow-50/10 focus:bg-yellow-100/20 transition-colors rounded px-1 h-auto cursor-text border border-transparent focus:border-yellow-200 relative z-0 font-serif ${fitToPage ? 'text-[10pt] min-h-0 leading-normal' : 'text-[12pt] min-h-[180mm] leading-normal'}`}
      style={{ fontFamily: '"Times New Roman", Times, "Liberation Serif", serif', fontSize: `${docFontSize}pt` }}
    />
  );
});

const DecisionAssistant = () => {
  const { students, updateStudent } = useStudents();
  const { incidents, updateIncidentStudent, updateIncident } = useIncidents();
  const { institution, boardMembers } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  const getAutoDecisionNo = (incident?: Incident) => {
    if (!incident) return '';
    
    // Format is OLAYYYYY-NNN (e.g., OLAY2026-001)
    const codeRegex = /OLAY(\d{4})-(\d+)/i;
    const match = incident.code ? incident.code.match(codeRegex) : null;
    if (match) {
      const year = match[1];
      const seq = parseInt(match[2], 10);
      return `${year}/${seq}`;
    }
    
    // Fallback: Use incident date year or current year and find its chronological year-based index
    const incidentYear = incident.date ? new Date(incident.date).getFullYear() : new Date().getFullYear();
    const sameYearIncidents = [...incidents]
      .filter(inc => inc.date && new Date(inc.date).getFullYear() === incidentYear)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const index = sameYearIncidents.findIndex(inc => inc.id === incident.id);
    const seq = index !== -1 ? index + 1 : 1;
    return `${incidentYear}/${seq}`;
  };

  // --- HISTORICAL PENALTIES STATE ---
  const [showAddPastPenalty, setShowAddPastPenalty] = useState(false);
  const [editingPastPenaltyId, setEditingPastPenaltyId] = useState<string | null>(null);
  const [pastPenaltyForm, setPastPenaltyForm] = useState({
    decision: 'KINAMA',
    decisionNo: '',
    date: new Date().toISOString().split('T')[0],
    penaltyScore: '10',
    description: ''
  });

  const handleAddPastPenalty = () => {
    if (!selectedStudentId) return;
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    if (editingPastPenaltyId) {
      // Edit / Update mode
      const updatedPenalties = (student.previousPenalties || []).map(p => {
        if (p.id === editingPastPenaltyId) {
          return {
            ...p,
            decision: pastPenaltyForm.decision,
            decisionNo: pastPenaltyForm.decisionNo || 'Girilmemiş',
            date: pastPenaltyForm.date || new Date().toISOString().split('T')[0],
            penaltyScore: pastPenaltyForm.penaltyScore || '10',
            description: pastPenaltyForm.description || ''
          };
        }
        return p;
      });
      updateStudent(selectedStudentId, { previousPenalties: updatedPenalties });
      setEditingPastPenaltyId(null);
    } else {
      // Create mode
      const newPenalty = {
        id: 'PAST-' + Math.random().toString(36).substr(2, 9),
        decision: pastPenaltyForm.decision,
        decisionNo: pastPenaltyForm.decisionNo || 'Girilmemiş',
        date: pastPenaltyForm.date || new Date().toISOString().split('T')[0],
        penaltyScore: pastPenaltyForm.penaltyScore || '10',
        description: pastPenaltyForm.description || ''
      };

      const updatedPenalties = student.previousPenalties 
        ? [...student.previousPenalties, newPenalty]
        : [newPenalty];

      updateStudent(selectedStudentId, { previousPenalties: updatedPenalties });
    }
    
    // Reset form
    setPastPenaltyForm({
      decision: 'KINAMA',
      decisionNo: '',
      date: new Date().toISOString().split('T')[0],
      penaltyScore: '10',
      description: ''
    });
    setShowAddPastPenalty(false);
  };

  const handleEditClickPastPenalty = (pen: { id: string; decision: string; decisionNo?: string; date?: string; penaltyScore?: string; description?: string }) => {
    setEditingPastPenaltyId(pen.id);
    setPastPenaltyForm({
      decision: pen.decision,
      decisionNo: pen.decisionNo === 'Girilmemiş' ? '' : (pen.decisionNo || ''),
      date: pen.date || new Date().toISOString().split('T')[0],
      penaltyScore: pen.penaltyScore || '10',
      description: pen.description || ''
    });
    setShowAddPastPenalty(true);
  };

  const handleDeletePastPenalty = (penaltyId: string) => {
    if (!selectedStudentId) return;
    const student = students.find(s => s.id === selectedStudentId);
    if (!student) return;

    const updatedPenalties = (student.previousPenalties || []).filter(p => p.id !== penaltyId);
    if (editingPastPenaltyId === penaltyId) {
        setEditingPastPenaltyId(null);
    }
    updateStudent(selectedStudentId, { previousPenalties: updatedPenalties });
  };

  // --- GLOBAL STATE ---
  // Default tab changed from 'tracking' to 'analysis'
  const [activeTab, setActiveTab] = useState<'analysis' | 'meeting' | 'forms' | 'decision'>('analysis');
  const [generatedDocs, setGeneratedDocs] = useState<Array<{
    header: string; 
    body: string; 
    type?: string;
    studentName?: string;
  }>>([]);
  
  // New State for Blank Template Mode
  const [isBlankMode, setIsBlankMode] = useState(false);

  // --- FORMS & MINUTES DATE & TIME SELECTION STATE ---
  const [formDateTime, setFormDateTime] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '10:00'
  });
  const [lastGeneratedFormType, setLastGeneratedFormType] = useState<string | null>(null);

  // --- KÜNYE EDITING & DETAIL PANEL STATE ---
  const [editingKunyeStudent, setEditingKunyeStudent] = useState<Student | null>(null);
  const [kunyeForm, setKunyeForm] = useState<Partial<Student>>({});
  const [isKunyeCardExpanded, setIsKunyeCardExpanded] = useState<boolean>(true);

  const handleOpenEditKunye = (student: Student) => {
    setEditingKunyeStudent(student);
    setKunyeForm({
      tcNo: student.tcNo || '',
      fatherName: student.fatherName || '',
      motherName: student.motherName || '',
      birthPlaceDate: student.birthPlaceDate || '',
      province: student.province || '',
      district: student.district || '',
      neighborhood: student.neighborhood || '',
      volumeNo: student.volumeNo || '',
      familyOrderNo: student.familyOrderNo || '',
      orderNo: student.orderNo || '',
      parentName: student.parentName || '',
      parentPhone: student.parentPhone || '',
      address: student.address || '',
      boardingStatus: student.boardingStatus || 'GÜNDÜZLÜ',
      scholarshipStatus: student.scholarshipStatus || 'BURSSUZ',
      registrationType: student.registrationType || 'YENİ KAYIT',
      gender: student.gender || 'ERKEK',
      healthStatus: student.healthStatus || 'İyi'
    });
  };

  const handleSaveKunye = () => {
    if (!editingKunyeStudent) return;
    updateStudent(editingKunyeStudent.id, kunyeForm);
    setEditingKunyeStudent(null);
    setSuccessMessage("Öğrenci künye bilgileri başarıyla güncellendi ve evraklara yansıtıldı.");
    setTimeout(() => setSuccessMessage(null), 3500);

    // Refresh active document preview if any
    if (generatedDocs.length > 0 && generatedDocs[0]?.type) {
      setTimeout(() => {
        generateBulkDocuments(generatedDocs[0].type);
      }, 50);
    }
  };

  const renderStudentKunyePanel = (curStud: Student) => {
    return (
      <div className="mb-4 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/40 border border-blue-200/80 rounded-xl p-3 shadow-xs">
        <div className="flex items-center justify-between pb-2 border-b border-blue-100">
          <div className="flex items-center gap-1.5 font-bold text-xs text-blue-950">
            <User className="w-3.5 h-3.5 text-blue-600" />
            <span>{curStud.name} • e-Okul Künye Bilgileri</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleOpenEditKunye(curStud)}
              className="text-[10px] bg-white hover:bg-blue-50 text-blue-700 border border-blue-300 px-2 py-0.5 rounded font-bold transition-colors flex items-center gap-1 shadow-2xs"
              title="Künye bilgilerini (Aile Sıra No, Sıra No, Nüfus, TC, Adres vb.) doğrudan düzenle"
            >
              <Edit3 className="w-3 h-3 text-blue-600" />
              Künye Düzenle
            </button>
            <button
              type="button"
              onClick={() => setIsKunyeCardExpanded(!isKunyeCardExpanded)}
              className="text-slate-400 hover:text-slate-600 p-0.5"
            >
              {isKunyeCardExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {isKunyeCardExpanded && (
          <div className="mt-2.5 space-y-2 text-[11px]">
            {/* Kimlik & Nüfus Rozetleri */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">T.C. Kimlik No</span>
                <span className="font-mono font-bold text-slate-800 text-[11px]">
                  {curStud.tcNo || <span className="text-amber-600 font-normal italic">Girilmemiş</span>}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">Anne & Baba Adı</span>
                <span className="text-slate-800 font-medium truncate block">
                  {curStud.motherName || curStud.fatherName 
                    ? `${curStud.motherName || '-'} / ${curStud.fatherName || '-'}`
                    : <span className="text-slate-400 italic">Belirtilmedi</span>}
                </span>
              </div>
            </div>

            {/* Nüfus Kaydı & Cilt / Aile Sıra / Sıra No */}
            <div className="bg-white p-2 rounded-lg border border-blue-100 shadow-2xs space-y-1">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-slate-500 uppercase">Nüfus Kaydı:</span>
                <span className="text-slate-700 font-medium">
                  {[curStud.province, curStud.district, curStud.neighborhood].filter(Boolean).join(' / ') || 'Belirtilmedi'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10.5px]">
                <span className="text-slate-500">
                  Cilt: <strong className="text-slate-800 font-mono">{curStud.volumeNo || '-'}</strong>
                </span>
                <span className="bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.2 rounded font-semibold">
                  Aile Sıra No: <strong className="font-mono text-purple-900">{curStud.familyOrderNo || '-'}</strong>
                </span>
                <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                  Sıra No: <strong className="font-mono text-emerald-900">{curStud.orderNo || '-'}</strong>
                </span>
              </div>
            </div>

            {/* Veli & İletişim */}
            <div className="bg-white p-2 rounded-lg border border-slate-100 shadow-2xs">
              <div className="flex justify-between items-center text-[10px]">
                <span className="font-bold text-slate-500 uppercase">Veli & Telefon:</span>
                <span className="text-slate-800 font-medium">
                  {curStud.parentName || 'Belirtilmedi'} {curStud.parentPhone ? `• ${curStud.parentPhone}` : ''}
                </span>
              </div>
              {curStud.address && (
                <div className="text-[10px] text-slate-600 line-clamp-1 mt-0.5 border-t border-slate-100/60 pt-0.5">
                  <span className="text-slate-400 font-medium">Adres:</span> {curStud.address}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5 px-0.5">
              <span>Doğum: <strong>{curStud.birthPlaceDate || 'Belirtilmedi'}</strong></span>
              <span>Pansiyon: <strong>{curStud.boardingStatus || 'GÜNDÜZLÜ'}</strong> ({curStud.scholarshipStatus || 'BURSSUZ'})</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- ZOOM & OFFICE MARGIN STATE ---
  const isMobileInitial = typeof window !== 'undefined' && window.innerWidth < 768;
  const [zoom, setZoom] = useState(isMobileInitial ? 0.45 : 1.0);
  const [mobileViewMode, setMobileViewMode] = useState<'form' | 'preview'>('form');
  const [marginPreset, setMarginPreset] = useState<MarginType>('normal');
  const [showMarginMenu, setShowMarginMenu] = useState(false);
  const [fitToPage, setFitToPage] = useState(false);
  // Default font size: 12pt (Times New Roman official correspondence standard)
  const [docFontSize, setDocFontSizeState] = useState<number>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('decision_assistant_font_size');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 8 && parsed <= 24) return parsed;
      }
    }
    return 12; // Sabit 12 punto
  });

  const setDocFontSize = (valOrUpdater: number | ((prev: number) => number)) => {
    setDocFontSizeState(prev => {
      const nextVal = typeof valOrUpdater === 'function' ? valOrUpdater(prev) : valOrUpdater;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('decision_assistant_font_size', String(nextVal));
      }
      return nextVal;
    });
  };

  const toggleFitToPage = () => {
    if (fitToPage) {
      setFitToPage(false);
      setMarginPreset('normal');
    } else {
      setFitToPage(true);
      setMarginPreset('compact');
    }
  };

  const handleSelectMargin = (preset: MarginType) => {
    setMarginPreset(preset);
    setFitToPage(preset === 'compact');
    setShowMarginMenu(false);
  };

  const activeMargin = PAGE_MARGINS[marginPreset] || PAGE_MARGINS.normal;

  // --- SUCCESS MESSAGE STATE ---
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Listen for tab changes in URL
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'analysis') setActiveTab('analysis');
    else if (tab === 'meeting') setActiveTab('meeting');
    else if (tab === 'forms') setActiveTab('forms');
    else if (tab === 'decision') setActiveTab('decision');
    else if (!tab) setActiveTab('analysis'); // Default fallback
    
    // Reset zoom on tab change
    setZoom(1.0);
    setSuccessMessage(null);
  }, [searchParams]);

  // Helper to display current section title
  const getSectionTitle = () => {
    switch(activeTab) {
        case 'analysis': return '1. Yapay Zeka Analizi';
        case 'meeting': return '2. Toplantı Yönetimi';
        case 'forms': return '3. Tutanak ve Formlar';
        case 'decision': return '4. Karar ve Tebligat';
        default: return 'Süreç Yönetimi';
    }
  }

  const cssFitPage = `
    .print-fit-page {
        font-size: 0.88em !important;
        line-height: 1.25 !important;
        box-sizing: border-box !important;
    }
    .print-fit-page * {
        box-sizing: border-box !important;
    }
    .print-fit-page [contenteditable] {
        min-height: 0 !important;
        font-size: 9.5pt !important;
        line-height: 1.28 !important;
    }
    .print-fit-page p, .print-fit-page div {
        line-height: 1.25 !important;
        margin-top: 2px !important;
        margin-bottom: 2px !important;
    }
    .print-fit-page table {
        font-size: 0.88em !important;
        margin-top: 3px !important;
        margin-bottom: 3px !important;
        line-height: 1.2 !important;
    }
    .print-fit-page td, .print-fit-page th {
        padding: 2px 4px !important;
        line-height: 1.2 !important;
    }
    .print-fit-page td[style*="height"] {
        height: auto !important;
        min-height: 16px !important;
    }
    .print-fit-page h3, .print-fit-page h4 {
        margin-bottom: 3px !important;
        margin-top: 2px !important;
        font-size: 0.95em !important;
    }
    .print-fit-page br {
        content: "" !important;
        display: block !important;
        margin-bottom: 1px !important;
    }
    .print-fit-page .signature-block,
    .print-fit-page .avoid-break {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        break-inside: avoid-page !important;
        margin-top: 6px !important;
        margin-bottom: 0px !important;
    }
    .doc-editable-field {
        cursor: text;
        transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
    }
    .doc-editable-field:hover {
        background-color: #f8fafc !important;
        border-color: #60a5fa !important;
    }
    .doc-editable-field:focus {
        background-color: #ffffff !important;
        border-color: #2563eb !important;
        box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2) !important;
    }
    .doc-editable-field:empty::before {
        content: attr(placeholder);
        color: #94a3b8;
        font-style: italic;
        pointer-events: none;
        display: block;
    }
    @media print {
        .doc-editable-field {
            background-color: transparent !important;
            box-shadow: none !important;
            border-color: #000000 !important;
        }
        .doc-editable-field:empty::before {
            content: "" !important;
            display: none !important;
        }
    }
  `;

  // Helper to format YYYY-MM-DD to DD.MM.YYYY
  const formatDate = (dateStr: string) => {
      if (!dateStr) return '.../.../....';
      try {
        const [y, m, d] = dateStr.split('-');
        if (y && m && d) return `${d}.${m}.${y}`;
        return dateStr;
      } catch {
        return dateStr;
      }
  };

  // Helper to format YYYY-MM-DD to DD.MM.YYYY for display text
  const formatDateForDisplay = (dateStr: string) => {
      if (!dateStr) return '.../.../....';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return new Intl.DateTimeFormat('tr-TR').format(date);
  };

  // --- SHARED SELECTION STATE ---
  const [selectedIncidentId, setSelectedIncidentId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [summonsSelectedStudentIds, setSummonsSelectedStudentIds] = useState<string[]>([]);

  // --- MEETING STATE (Çağrı Pusulası) ---
  const [meetingData, setMeetingData] = useState({
    number: `${new Date().getFullYear()}/1`,
    subject: 'Disiplin Kurulu Toplantısı',
    date: new Date().toISOString().split('T')[0],
    time: '12:30',
    location: 'Müdür Yardımcısı Odası',
    agenda: [
      'Açılış ve yoklama',
      'Kurula sevk edilen disiplin dosyalarının görüşülmesi',
      'Dilek ve temenniler',
      'Kapanış'
    ]
  });

  // --- DECISION FORM STATE ---
  const [decisionForm, setDecisionForm] = useState({
      decisionNo: '',
      decisionDate: new Date().toISOString().split('T')[0],
      penalty: 'KINAMA',
      reason: '',
      score: '10' // Default deduction
  });

  // --- AI ANALYSIS & GENERATION STATE ---
  const [analysisDescription, setAnalysisDescription] = useState('');
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isGeneratingReason, setIsGeneratingReason] = useState(false);

  // --- LOAD DATA EFFECTS ---
  const prevIncidentIdRef = useRef<string | null>(null);
  
  // 1. Reset specific states when Incident changes
  useEffect(() => {
    if (prevIncidentIdRef.current === selectedIncidentId) return;
    prevIncidentIdRef.current = selectedIncidentId;

    const incident = incidents.find(i => i.id === selectedIncidentId);
    if (incident && incident.involvedStudents && incident.involvedStudents.length > 0) {
      const firstStudentId = incident.involvedStudents[0].studentId;
      setSelectedStudentId(firstStudentId);
      setSelectedStudentIds([firstStudentId]);
      setSummonsSelectedStudentIds(incident.involvedStudents.map(s => s.studentId));
    } else {
      setSelectedStudentId('');
      setSelectedStudentIds([]);
      setSummonsSelectedStudentIds([]);
    }
    if (incident && incident.date) {
      setFormDateTime({
        date: incident.date,
        time: incident.time || '10:00'
      });
    }
    setAiResult(null);
    setAnalysisDescription('');
    setGeneratedDocs([]);
    setSuccessMessage(null);
  }, [selectedIncidentId, incidents]);

  // 2. Load Student Data (Decision & Analysis) when Student changes
  useEffect(() => {
    setSuccessMessage(null);
    
    if (selectedIncidentId && selectedStudentId && !isBlankMode) {
        const incident = incidents.find(i => i.id === selectedIncidentId);
        const involvement = incident?.involvedStudents.find(s => s.studentId === selectedStudentId);
        
        if (involvement) {
            if (involvement.decision) {
                setDecisionForm({
                    decisionNo: involvement.decisionNo || getAutoDecisionNo(incident),
                    decisionDate: involvement.decisionDate || new Date().toISOString().split('T')[0],
                    penalty: involvement.decision,
                    reason: involvement.decisionReason || '',
                    score: involvement.penaltyScore || '10',
                    regulationArticle: involvement.regulationArticle || (institution.type !== 'Ortaokul' ? 'MEB Ortaöğretim Kurumları Yönetmeliği Madde 164' : 'MEB İlköğretim Kurumları Yönetmeliği Madde 54'),
                    behaviorReason: involvement.behaviorReason || (incident?.title ? `${incident.title} eylemi nedeniyle oluşan disiplin ihlali.` : 'Belirtilmedi')
                });

                // Logic: If there is a decision/reason but NO decisionNo, it is likely a Proposal from the Catalog
                if (!involvement.decisionNo && involvement.decisionReason) {
                    // Auto-suggest score based on proposal if not set
                    if (!involvement.penaltyScore) {
                         const p = involvement.decision;
                         let s = '0';
                         if (p.includes('KINAMA')) s = '10';
                         else if (p.includes('UZAKLAŞTIRMA')) s = '20';
                         else if (p.includes('DEĞİŞTİRME')) s = '40';
                         else if (p.includes('ÖRGÜN')) s = '80';
                         setDecisionForm(prev => ({...prev, score: s}));
                    }
                }
            } else {
                 setDecisionForm({
                    decisionNo: getAutoDecisionNo(incident),
                    decisionDate: new Date().toISOString().split('T')[0],
                    penalty: 'KINAMA',
                    reason: '',
                    score: '10',
                    regulationArticle: institution.type !== 'Ortaokul' ? 'MEB Ortaöğretim Kurumları Yönetmeliği Madde 164' : 'MEB İlköğretim Kurumları Yönetmeliği Madde 54',
                    behaviorReason: incident?.title ? `${incident.title} eylemi nedeniyle oluşan disiplin ihlali.` : 'Belirtilmedi'
                });
            }

            // Load Analysis Data
            if (activeTab === 'analysis') {
                setAnalysisDescription(incident.description || ''); // Default to incident desc
                if (involvement.aiAnalysis) {
                    setAiResult(involvement.aiAnalysis);
                } else {
                    setAiResult(null);
                }
            }
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIncidentId, selectedStudentId, incidents, activeTab, isBlankMode, institution.type]);
  
  // --- HELPER VARS ---
  const selectedIncident = incidents.find(i => i.id === selectedIncidentId);
  const incidentStudents = selectedIncident 
    ? selectedIncident.involvedStudents.map((rel: InvolvedStudent) => ({
        ...students.find((s: Student) => s.id === rel.studentId),
        role: rel.role,
        decision: rel.decision, // Include decision info
        studentStatement: rel.studentStatement,
        studentDefense: rel.studentDefense
      })).filter(s => s.id) as (Student & { role: string, decision?: string, studentStatement?: string, studentDefense?: string })[]
    : [];

  const boardInfo = getBoardInfo(institution?.type, boardMembers);
  const boardPresident = boardInfo.presidentName;
  
  // --- HANDLERS ---
  const handlePenaltyChange = (val: string) => {
      // Auto-suggest score based on penalty type
      let s = decisionForm.score;
      if (val.includes('UYARMA')) s = '0'; 
      else if (val.includes('KINAMA')) s = '10';
      else if (val.includes('UZAKLAŞTIRMA')) s = '20'; 
      else if (val.includes('DEĞİŞTİRME')) s = '40'; 
      else if (val.includes('ÖRGÜN')) s = '80'; 
      
      setDecisionForm(prev => ({...prev, penalty: val, score: s}));
  };

  const handleSaveDecision = () => {
      const targets = selectedStudentIds.length > 0 ? selectedStudentIds : (selectedStudentId ? [selectedStudentId] : []);
      if (!selectedIncidentId || targets.length === 0) {
          alert("Lütfen önce listeden olay ve en az bir öğrenci seçiniz.");
          return;
      }
      
      targets.forEach(studentId => {
          updateIncidentStudent(selectedIncidentId, studentId, {
              decision: decisionForm.penalty,
              decisionNo: decisionForm.decisionNo,
              decisionDate: decisionForm.decisionDate,
              decisionReason: decisionForm.reason,
              penaltyScore: decisionForm.score,
              regulationArticle: decisionForm.regulationArticle,
              behaviorReason: decisionForm.behaviorReason
          });
      });
      
      // Success feedback
      setSuccessMessage("Karar başarıyla kaydedildi.");
      setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleAnalyze = async () => {
    const targets = selectedStudentIds.length > 0 ? selectedStudentIds : (selectedStudentId ? [selectedStudentId] : []);
    if (!selectedIncidentId || targets.length === 0) {
        alert("Lütfen önce listeden olay ve en az bir öğrenci seçiniz.");
        return;
    }
    const incident = incidents.find(x => x.id === selectedIncidentId);
    if (!incident) return;
    
    const targetStudents = students.filter(s => targets.includes(s.id));
    if (targetStudents.length === 0) return;

    setLoading(true);
    const analysisIncident: Incident = { ...incident, description: analysisDescription };
    const res = await analyzeIncident(analysisIncident, targetStudents);
    setAiResult(res);
    setLoading(false);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setMobileViewMode('preview');
    }
    
    if (res) {
        targets.forEach(studentId => {
            updateIncidentStudent(selectedIncidentId, studentId, { aiAnalysis: res });
        });
    }
  };

  // AI Decision Reason Generator
  const handleAutoGenerateReason = async () => {
      if (!selectedIncidentId || !selectedStudentId) return;
      const student = students.find(x => x.id === selectedStudentId);
      const incident = incidents.find(x => x.id === selectedIncidentId);
      if (!student || !incident) return;

      setIsGeneratingReason(true);
      const result = await generateDecisionReason(incident, student, decisionForm.penalty, institution.type);
      if (result) {
          setDecisionForm(prev => ({...prev, reason: result}));
      }
      setIsGeneratingReason(false);
  };

  const getFilenameFromDoc = (
    type: string | undefined, 
    studentName: string | undefined, 
    tab: string,
    isBulk: boolean
  ): string => {
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;

    const cleanName = (name: string) => {
      return name
        .trim()
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9\s-_]/gi, '')
        .replace(/\s+/g, '_');
    };

    const cleanStudentName = studentName ? cleanName(studentName) : '';

    let docPrefix = 'evrak';
    
    if (tab === 'analysis') {
      docPrefix = 'ai_disiplin_analiz_raporu';
    } else if (tab === 'meeting') {
      if (type === 'ek1_meeting') {
        docPrefix = 'kurul_cagri_yazisi_genel';
      } else if (type === 'student_summons') {
        docPrefix = 'ogrenci_kurul_cagri_yazisi';
      } else {
        docPrefix = 'kurul_cagri_yazisi';
      }
    } else {
      switch (type) {
        case 'student_summons':
          docPrefix = 'ogrenci_kurul_cagri_yazisi';
          break;
        case 'ek10_decision':
          docPrefix = 'ek10_karar';
          break;
        case 'ek1_student_info':
          docPrefix = 'ek1_ogrenci_bilgi_formu';
          break;
        case 'dizi_pusulasi':
          docPrefix = 'dizi_pusulasi';
          break;
        case 'ek1_meeting':
          docPrefix = 'kurul_toplanti_tutanagi';
          break;
        case 'sanction_student':
          docPrefix = 'yaptirim_tebligi_ogrenci';
          break;
        case 'sanction_parent':
          docPrefix = 'yaptirim_tebligi_veli';
          break;
        case 'opinion_counselor':
          docPrefix = 'rehberlik_gorus_formu';
          break;
        case 'witness_student':
          docPrefix = 'gorgu_tanigi_ifade_tutanagi_ogrenci';
          break;
        case 'witness_teacher':
          docPrefix = 'gorgu_tanigi_ifade_tutanagi_ogretmen';
          break;
        case 'statement_request':
          docPrefix = 'ifade_talebi';
          break;
        case 'defense_request':
          docPrefix = 'savunma_talebi';
          break;
        case 'student_statement_doc':
          docPrefix = 'ogrenci_ifade_tutanagi';
          break;
        case 'student_defense_doc':
          docPrefix = 'ogrenci_savunma_tutanagi';
          break;
        case 'verbal_warning':
          docPrefix = 'sozlu_uyari_tutanagi';
          break;
        case 'contract':
          docPrefix = 'ogrenci_davranis_sozlesmesi';
          break;
        case 'student_meeting':
          docPrefix = 'ogrenci_gorusme_formu_bkg5c';
          break;
        case 'parent_meeting':
          docPrefix = 'veli_gorusme_formu_bkg11c';
          break;
        case 'parent_minute':
          docPrefix = 'veli_gorusme_tutanagi';
          break;
        default:
          if (tab === 'decision') {
            docPrefix = 'disiplin_kurul_karari';
          }
      }
    }

    if (isBulk) {
      return `${docPrefix}_toplu_${dateStr}`;
    } else if (cleanStudentName) {
      return `${docPrefix}_${cleanStudentName}_${dateStr}`;
    } else {
      return `${docPrefix}_${dateStr}`;
    }
  };

  // --- WORD (.DOCX) EXPORT WITH NATIVE OPENXML FORMAT ---
  const handleDownloadWord = async () => {
    let filename = `evraklar_${new Date().toISOString().split('T')[0]}`;
    let contentHtml = '';
    
    if (activeTab === 'analysis' && aiResult) {
      const currentStudent = students.find(s => s.id === selectedStudentId);
      filename = getFilenameFromDoc(undefined, currentStudent?.name, 'analysis', false);
      contentHtml = `
        <div style="text-align:center; font-weight:bold; border-bottom:2pt solid black; padding-bottom:8pt; margin-bottom:18pt; font-size:13pt;">
            YAPAY ZEKA ANALİZ VE MEVZUAT RAPORU
        </div>
        <div style="font-size:${docFontSize}pt; line-height:1.6; text-align:justify;">
            ${aiResult.replace(/\n/g, '<br/>')}
        </div>
        <div style="margin-top:24pt; text-align:center; font-size:9pt; color:#666; border-top:1pt solid #ccc; padding-top:8pt;">
            *** Yapay Zeka (AI) tarafından bilgi amaçlı oluşturulmuştur. ***
        </div>
      `;
    } else {
      if (generatedDocs.length === 0) {
        alert("İndirilecek evrak bulunamadı.");
        return;
      }
      const isBulk = generatedDocs.length > 1;
      const singleDoc = generatedDocs[0];
      filename = getFilenameFromDoc(singleDoc?.type, singleDoc?.studentName, activeTab, isBulk);
      
      const docDomElements = document.querySelectorAll('.document-page');
      contentHtml = generatedDocs.map((doc, idx) => {
        let bodyHtml = doc.body;
        const liveEditable = docDomElements[idx]?.querySelector('[contenteditable]');
        if (liveEditable) {
          bodyHtml = liveEditable.innerHTML;
        }
        return `
          <div style="${idx < generatedDocs.length - 1 ? 'page-break-after:always;' : ''}">
            ${doc.header ? `<div style="text-align:center; font-weight:bold; margin-bottom:12pt; font-size:12pt; line-height:1.3; font-family:'Times New Roman', serif;">${doc.header}</div>` : ''}
            <div style="font-size:${docFontSize}pt; font-family:'Times New Roman', serif;">
              ${bodyHtml}
            </div>
          </div>
        `;
      }).join('');
    }

    try {
      await exportHtmlToWord(contentHtml, filename, {
        fontSize: docFontSize,
        margins: activeMargin,
        landscape: generatedDocs[0]?.type === 'karar_defteri'
      });
    } catch (docxErr) {
      console.error('Word export error:', docxErr);
      alert('Word belgesi oluşturulurken bir hata meydana geldi: ' + docxErr);
    }
  };

  const buildFullDocumentHtml = (): { html: string; filename: string } | null => {
    const aiReport = document.getElementById('ai-report-preview');
    const docDomElements = document.querySelectorAll('.document-page');

    if (docDomElements.length === 0 && !aiReport) {
      return null;
    }

    let filename = `evraklar_${new Date().toISOString().split('T')[0]}`;
    if (activeTab === 'analysis' && aiResult) {
      const currentStudent = students.find(s => s.id === selectedStudentId);
      filename = getFilenameFromDoc(undefined, currentStudent?.name, 'analysis', false);
    } else if (generatedDocs.length > 0) {
      const isBulk = generatedDocs.length > 1;
      const singleDoc = generatedDocs[0];
      filename = getFilenameFromDoc(singleDoc?.type, singleDoc?.studentName, activeTab, isBulk);
    }

    let printHtml = '';
    if (activeTab === 'analysis' && aiReport) {
      const reportContent = aiReport.querySelector('.whitespace-pre-wrap')?.innerHTML || aiResult;
      printHtml = `
        <div class="document-entry">
          <div class="doc-header" style="text-align:center; font-weight:bold; border-bottom:2px solid black; padding-bottom:8px; margin-bottom:18px; font-size:12pt; letter-spacing:0.5px;">
            YAPAY ZEKA ANALİZ VE MEVZUAT RAPORU
          </div>
          <div class="doc-content" style="font-size:${docFontSize}pt; line-height:1.6; text-align:justify; white-space:pre-wrap;">
            ${reportContent}
          </div>
          <div style="margin-top:24px; text-align:center; font-size:9pt; color:#666; border-top:1px solid #ccc; padding-top:8px;">
            *** Yapay Zeka (AI) tarafından bilgi amaçlı oluşturulmuştur. ***
          </div>
        </div>
      `;
    } else {
      generatedDocs.forEach((doc, idx) => {
        let bodyHtml = doc.body;
        const liveEditable = docDomElements[idx]?.querySelector('[contenteditable]');
        if (liveEditable) {
          bodyHtml = liveEditable.innerHTML;
        }

        printHtml += `
          <div class="document-entry">
            ${doc.header ? `<div class="doc-header" style="text-align:center; font-weight:bold; margin-bottom:12px; font-size:12pt; line-height:1.3; font-family:'Times New Roman', serif;">${doc.header}</div>` : ''}
            <div class="doc-content ${fitToPage ? 'print-fit-page' : ''}" style="font-size:${docFontSize}pt; font-family:'Times New Roman', serif; line-height:1.4;">
              ${bodyHtml}
            </div>
          </div>
        `;
      });
    }

    const cssFitPage = `
      @page {
        margin-top: 10mm !important;
        margin-bottom: 10mm !important;
        margin-left: 12mm !important;
        margin-right: 12mm !important;
      }
      .print-fit-page {
        zoom: 0.92 !important;
        transform-origin: top center !important;
      }
    `;

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <title>${filename}</title>
    <style>
      @page {
        size: A4 portrait;
        margin-top: ${activeMargin.top}mm !important;
        margin-bottom: ${activeMargin.bottom}mm !important;
        margin-left: ${activeMargin.left}mm !important;
        margin-right: ${activeMargin.right}mm !important;
      }
      @media print {
        @page {
          size: A4 portrait;
          margin-top: ${activeMargin.top}mm !important;
          margin-bottom: ${activeMargin.bottom}mm !important;
          margin-left: ${activeMargin.left}mm !important;
          margin-right: ${activeMargin.right}mm !important;
        }
      }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-family: "Times New Roman", Times, "Liberation Serif", serif;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-container {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .document-entry {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
        page-break-after: always !important;
        break-after: page !important;
      }
      .document-entry:last-child {
        page-break-after: auto !important;
        break-after: auto !important;
      }
      .doc-content {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-sizing: border-box !important;
      }
      table {
        width: 100% !important;
        border-collapse: collapse !important;
      }
      tr {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      .signature-block, .avoid-break, .signatures-table, .approval-block {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
        break-inside: avoid-page !important;
      }
      h1, h2, h3, h4, .doc-header {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      p, div {
        orphans: 3 !important;
        widows: 3 !important;
      }
      .doc-editable-field {
        background-color: transparent !important;
        box-shadow: none !important;
        outline: none !important;
      }
      .doc-editable-field:empty::before {
        content: "" !important;
        display: none !important;
      }
      .print\\:hidden, .print-hide, .page-marker, [data-html2canvas-ignore="true"] {
        display: none !important;
      }
      ${fitToPage ? cssFitPage : ''}
    </style>
  </head>
  <body class="bg-white">
    <div class="print-container">
      ${printHtml}
    </div>
  </body>
</html>`;

    return { html, filename };
  };

  const handleDownloadPdf = async () => {
    const docData = buildFullDocumentHtml();
    if (!docData) {
      alert("İndirilecek belge bulunamadı.");
      return;
    }

    const { html, filename } = docData;
    setIsPdfGenerating(true);
    try {
      if (window.electronAPI) {
        // Chromium vector printToPDF with native Save Dialog (zero rasterization, selectable text)
        const result = await window.electronAPI.printToPdf({
          html,
          landscape: false,
          pageSize: 'A4',
          saveDialog: true,
          defaultPath: `${filename}.pdf`,
          title: 'PDF Olarak Kaydet'
        });

        if (result.canceled) return;
        if (!result.success && result.error) {
          alert('PDF oluşturulamadı: ' + result.error);
        }
      } else {
        // Web fallback: Render via iframe with pure CSS @media print
        printHtmlViaIframe(html);
      }
    } catch (err: any) {
      console.error(err);
      alert('PDF oluşturulurken bir hata oluştu: ' + (err.message || err));
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handlePrint = async () => {
    const docData = buildFullDocumentHtml();
    if (!docData) {
      alert("Yazdırılacak belge bulunamadı.");
      return;
    }

    const { html } = docData;
    if (window.electronAPI) {
      try {
        await window.electronAPI.printDirect({
          html,
          landscape: false,
          pageSize: 'A4'
        });
      } catch (err) {
        printHtmlViaIframe(html);
      }
    } else {
      printHtmlViaIframe(html);
    }
  };

  // Auto-Save State & Feedback for Live Document Preview
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoSaveToastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<{ state: 'idle' | 'saving' | 'saved', timestamp?: string }>({ state: 'idle' });
  const [autoSaveNotification, setAutoSaveNotification] = useState<string | null>(null);

  const triggerAutoSaveToast = (message: string) => {
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setAutoSaveStatus({ state: 'saved', timestamp: timeStr });
    setAutoSaveNotification(message);
    if (autoSaveToastTimerRef.current) {
      clearTimeout(autoSaveToastTimerRef.current);
    }
    autoSaveToastTimerRef.current = setTimeout(() => {
      setAutoSaveNotification(null);
    }, 4000);
  };

  const syncStatementAndDefenseFields = (container: HTMLElement, docIndex: number) => {
    const currentDoc = generatedDocs[docIndex];
    const statementEl = container.querySelector<HTMLElement>('[data-doc-field="statement"]');
    const defenseEl = container.querySelector<HTMLElement>('[data-doc-field="defense"]');

    let savedLabels: string[] = [];
    if (selectedIncidentId) {
      if (statementEl) {
        const targetStudentId = statementEl.getAttribute('data-student-id') || (currentDoc as any)?.studentId || selectedStudentId;
        if (targetStudentId) {
          const text = statementEl.innerText.trim();
          updateIncidentStudent(selectedIncidentId, targetStudentId, { studentStatement: text });
          savedLabels.push('Öğrenci İfadesi');
        }
      }
      if (defenseEl) {
        const targetStudentId = defenseEl.getAttribute('data-student-id') || (currentDoc as any)?.studentId || selectedStudentId;
        if (targetStudentId) {
          const text = defenseEl.innerText.trim();
          updateIncidentStudent(selectedIncidentId, targetStudentId, { studentDefense: text });
          savedLabels.push('Öğrenci Savunması');
        }
      }
    }
    return savedLabels;
  };

  // Document Persistence helpers (per student and per docType)
  const getSavedDocument = (docType?: string, studentId?: string, incidentId?: string): string | null => {
    if (!docType || !studentId) return null;
    
    // 1. Check in incident involvement if incident is selected
    if (incidentId) {
      const inc = incidents.find(i => i.id === incidentId);
      const inv = inc?.involvedStudents?.find(s => s.studentId === studentId);
      if (inv?.customDocuments && inv.customDocuments[docType]) {
        return inv.customDocuments[docType];
      }
    }

    // 2. Check in student object
    const stud = students.find(s => s.id === studentId);
    if (stud?.customDocuments && stud.customDocuments[docType]) {
      return stud.customDocuments[docType];
    }

    // 3. Check in localStorage dedicated cache
    const storageKey = `doc_cache_${incidentId || 'general'}_${studentId}_${docType}`;
    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) return cached;
    } catch {
      // ignore
    }

    return null;
  };

  const saveCustomDocument = (docType: string, html: string, studentId?: string, incidentId?: string) => {
    if (!studentId || !docType || !html) return;

    // 1. Save to incident involvement if incident is selected
    if (incidentId) {
      const inc = incidents.find(i => i.id === incidentId);
      const inv = inc?.involvedStudents?.find(s => s.studentId === studentId);
      const existingDocs = inv?.customDocuments || {};
      updateIncidentStudent(incidentId, studentId, {
        customDocuments: { ...existingDocs, [docType]: html }
      });
    }

    // 2. Save to student object
    const stud = students.find(s => s.id === studentId);
    const studDocs = stud?.customDocuments || {};
    updateStudent(studentId, {
      customDocuments: { ...studDocs, [docType]: html }
    });

    // 3. Save to localStorage cache
    const storageKey = `doc_cache_${incidentId || 'general'}_${studentId}_${docType}`;
    try {
      localStorage.setItem(storageKey, html);
    } catch {
      // ignore
    }
  };

  const handleResetDocumentToTemplate = (docType?: string, studentId?: string, docIndex?: number) => {
    if (!docType || !studentId) return;
    const student = (selectedIncident ? incidentStudents : students).find(s => s.id === studentId) || students.find(s => s.id === studentId);
    const studentName = student?.name || 'Öğrenci';
    
    if (window.confirm(`${studentName} için yapılan tüm özel düzenlemeler silinecek ve orijinal MEB şablonuna sıfırlanacaktır. Devam etmek istiyor musunuz?`)) {
      // 1. Remove from incident involvement
      if (selectedIncidentId) {
        const inc = incidents.find(i => i.id === selectedIncidentId);
        const inv = inc?.involvedStudents?.find(s => s.studentId === studentId);
        if (inv && inv.customDocuments && inv.customDocuments[docType]) {
          const nextDocs = { ...inv.customDocuments };
          delete nextDocs[docType];
          updateIncidentStudent(selectedIncidentId, studentId, { customDocuments: nextDocs });
        }
      }

      // 2. Remove from student
      const stud = students.find(s => s.id === studentId);
      if (stud && stud.customDocuments && stud.customDocuments[docType]) {
        const nextDocs = { ...stud.customDocuments };
        delete nextDocs[docType];
        updateStudent(studentId, { customDocuments: nextDocs });
      }

      // 3. Remove from localStorage cache
      const storageKey = `doc_cache_${selectedIncidentId || 'general'}_${studentId}_${docType}`;
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }

      // 4. Force regenerate from template
      const cleanDoc = generateTemplate(docType, student, true, false, true);
      if (cleanDoc) {
        setGeneratedDocs(prev => {
          const next = [...prev];
          if (docIndex !== undefined && next[docIndex]) {
            next[docIndex] = cleanDoc;
          } else {
            return [cleanDoc];
          }
          return next;
        });
        triggerAutoSaveToast('Belge orijinal MEB şablonuna sıfırlandı.');
      }
    }
  };

  const handleDocSave = (container: HTMLElement, docIndex: number) => {
    const updatedHtml = container.innerHTML;
    const currentDoc = generatedDocs[docIndex];
    const docType = currentDoc?.type || lastGeneratedFormType || '';
    const studentId = (currentDoc as any)?.studentId || selectedStudentId;

    setGeneratedDocs(prev => {
      const next = [...prev];
      if (next[docIndex]) {
        next[docIndex] = { ...next[docIndex], body: updatedHtml };
      }
      return next;
    });

    const savedLabels = syncStatementAndDefenseFields(container, docIndex);

    // Persist document changes
    if (studentId && docType) {
      saveCustomDocument(docType, updatedHtml, studentId, selectedIncidentId);
    }

    let msg = 'Belge değişiklikleri otomatik olarak kaydedildi.';
    if (savedLabels.length > 0) {
      msg = `${savedLabels.join(' ve ')} ve belge içeriği başarıyla kaydedildi.`;
    }
    triggerAutoSaveToast(msg);
  };

  const toggleStudentSelection = (id: string) => {
    setSelectedStudentIds(prev => {
      const exists = prev.includes(id);
      const next = exists ? prev.filter(sid => sid !== id) : [...prev, id];
      
      if (!exists) {
        setSelectedStudentId(id);
      } else {
        if (selectedStudentId === id) {
          setSelectedStudentId(next[0] || '');
        }
      }
      return next;
    });
  };

  const selectAllStudents = () => {
    const list = selectedIncident ? incidentStudents : students;
    if (selectedStudentIds.length === list.length) {
      setSelectedStudentIds([]);
      setSelectedStudentId('');
    } else {
      const allIds = list.map(s => s.id);
      setSelectedStudentIds(allIds);
      if (allIds.length > 0) {
        setSelectedStudentId(allIds[0]);
      }
    }
  };

  const generateBulkDocuments = (type: string, overrideStudentIds?: string[], forceResetTemplate: boolean = false) => {
    const docs: Array<{ header: string, body: string, type?: string, studentName?: string, studentId?: string }> = [];
    setLastGeneratedFormType(type);

    if (isBlankMode) {
      const doc = generateTemplate(type, undefined, true, true, forceResetTemplate);
      if (doc) docs.push(doc);
    } else {
      const targetIds = overrideStudentIds && overrideStudentIds.length > 0
        ? overrideStudentIds
        : (selectedStudentIds.length > 0 ? selectedStudentIds : (selectedStudentId ? [selectedStudentId] : []));
      if (targetIds.length > 0) {
        for (const studentId of targetIds) {
            const student = (selectedIncident ? incidentStudents : students).find(s => s.id === studentId) || students.find(s => s.id === studentId);
            if (student) {
                const doc = generateTemplate(type, student, true, false, forceResetTemplate);
                if (doc) docs.push(doc);
            }
        }
      } else {
        const doc = generateTemplate(type, undefined, true, false, forceResetTemplate);
        if (doc) docs.push(doc);
      }
    }
    
    setGeneratedDocs(docs);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setMobileViewMode('preview');
    }
    
    if (docs.length > 1) {
        setSuccessMessage(`${docs.length} adet belge başarıyla oluşturuldu.`);
        setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  // Synchronize document preview when student selection or tab changes
  useEffect(() => {
    if (activeTab === 'forms' && selectedStudentId && !isBlankMode) {
      const formType = lastGeneratedFormType || 'statement_request';
      generateBulkDocuments(formType, [selectedStudentId]);
    } else if (activeTab === 'decision' && selectedStudentId && !isBlankMode) {
      generateBulkDocuments('ek10_decision', [selectedStudentId]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudentId, activeTab]);

  // Dynamic preview update when date or time changes
  useEffect(() => {
    if (activeTab === 'forms' && lastGeneratedFormType && generatedDocs.length > 0) {
      generateBulkDocuments(lastGeneratedFormType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDateTime.date, formDateTime.time]);

  // --- ZOOM CONTROLS ---
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.35));
  const handleResetZoom = () => setZoom(1.0);
  const handleFitMobile = () => setZoom(typeof window !== 'undefined' && window.innerWidth < 768 ? 0.45 : 0.85);

  const renderZoomToolbar = () => (
    <div data-html2canvas-ignore="true" className="print:hidden w-full max-w-[210mm] mx-auto mb-3 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-xs flex items-center justify-between gap-2 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-bold text-slate-500 uppercase hidden sm:inline">Görünüm:</span>
        <button 
          type="button" 
          onClick={handleZoomOut} 
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 font-bold transition-colors cursor-pointer"
          title="Küçült"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-700 font-mono text-[11px] font-bold">
          %{Math.round(zoom * 100)}
        </span>
        <button 
          type="button" 
          onClick={handleZoomIn} 
          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-700 font-bold transition-colors cursor-pointer"
          title="Büyüt"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <button 
          type="button"
          onClick={handleFitMobile}
          className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg font-bold text-[11px] transition-colors cursor-pointer flex items-center gap-1"
          title="A4 kağıdı ekrana sığdırır"
        >
          <Layout className="w-3 h-3" />
          <span>Ekrana Sığdır</span>
        </button>
        <button 
          type="button"
          onClick={handleResetZoom}
          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-colors cursor-pointer hidden sm:inline"
          title="Orijinal %100 boyut"
        >
          %100 Orijinal
        </button>
      </div>
    </div>
  );

  // Zoom and font controls are managed in the document action headers

  // --- DOCUMENT RENDERER ---
  const renderDocumentPreview = () => {
      if (activeTab === 'analysis' && aiResult) {
          const totalPages = 5;
          const pageMarkers = (
              <>
                  <div 
                      data-html2canvas-ignore="true"
                      className="page-marker absolute right-8 top-3 text-[10px] text-slate-400 font-medium print:hidden pointer-events-none z-10"
                  >
                      Sayfa 1 (Office Üst: {activeMargin.top}mm)
                  </div>
                  {Array.from({ length: totalPages }).map((_, i) => {
                      const pageNum = i + 1;
                      const topPos = `${pageNum * 297}mm`;
                      
                      return (
                          <React.Fragment key={i}>
                              {/* Word Page Break Visual Line (Print Hidden) */}
                              <div 
                                  data-html2canvas-ignore="true"
                                  className="page-marker absolute left-0 w-full flex items-center justify-between z-10 print:hidden pointer-events-none px-4"
                                  style={{ top: topPos, transform: 'translateY(-50%)' }}
                              >
                                  <div className="h-px bg-slate-300 flex-1 border-t border-dashed border-slate-400"></div>
                                  <span className="mx-3 px-2 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded shadow-xs">
                                      Sayfa {pageNum} Sonu (Alt: {activeMargin.bottom}mm) • Sayfa {pageNum + 1} Başlangıcı (Üst: {activeMargin.top}mm)
                                  </span>
                                  <div className="h-px bg-slate-300 flex-1 border-t border-dashed border-slate-400"></div>
                              </div>
                              
                              <div 
                                  data-html2canvas-ignore="true"
                                  className="page-marker absolute right-8 text-[10px] text-slate-400 font-medium print:hidden pointer-events-none z-10"
                                  style={{ top: `calc(${topPos} + 12px)` }}
                              >
                                  Sayfa {pageNum + 1} (Office Üst: {activeMargin.top}mm)
                              </div>
                          </React.Fragment>
                      );
                  })}
              </>
          );

          return (
             <div className="w-full flex flex-col items-center">
                 {renderZoomToolbar()}
                 <div className="w-full overflow-x-auto flex justify-center py-2 px-1 custom-scrollbar">
                     <div className="mx-auto w-[210mm]">
                         {/* Word Margin Indicator Header */}
                         <div data-html2canvas-ignore="true" className="print:hidden mb-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center justify-between text-xs text-slate-600">
                             <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                 <Layout className="w-3.5 h-3.5 text-blue-600" />
                                 <span>{activeMargin.name}</span>
                                 <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-normal">A4 Portre</span>
                             </div>
                             <div className="text-[11px] font-mono text-slate-500">
                                 Üst: {activeMargin.top}mm • Alt: {activeMargin.bottom}mm • Sol: {activeMargin.left}mm • Sağ: {activeMargin.right}mm
                             </div>
                         </div>

                         <div 
                             id="ai-report-preview" 
                             className={`document-page bg-white shadow-2xl text-black mx-auto w-[210mm] min-h-[297mm] h-auto relative font-serif ${fitToPage ? 'print-fit-page' : ''}`}
                             style={{ 
                                 paddingTop: `${activeMargin.top}mm`,
                                 paddingBottom: `${activeMargin.bottom}mm`,
                                 paddingLeft: `${activeMargin.left}mm`,
                                 paddingRight: `${activeMargin.right}mm`,
                                 fontSize: `${docFontSize}pt`,
                                 fontFamily: '"Times New Roman", Times, "Liberation Serif", serif',
                                 transform: `scale(${zoom})`, 
                                 transformOrigin: 'top center',
                                 transition: 'transform 0.2s ease-out'
                             }}
                         >
                             {pageMarkers}
                             <h3 className="text-lg font-bold border-b border-black mb-6 pb-2 text-center font-sans tracking-wide">YAPAY ZEKA ANALİZ VE MEVZUAT RAPORU</h3>
                             <div className="whitespace-pre-wrap text-justify text-sm leading-relaxed">{aiResult}</div>
                             <div className="mt-12 text-center text-xs text-slate-400 border-t pt-4 font-sans">*** Yapay Zeka (AI) tarafından bilgi amaçlı oluşturulmuştur. ***</div>
                        </div>
                    </div>
                 </div>
             </div>
          );
      }
      if (generatedDocs.length === 0) return (
         <div className="flex flex-col items-center justify-center min-h-[300px] h-full text-slate-400 p-6 text-center">
             <FileText className="w-16 h-16 mb-4 text-slate-300" />
             <p className="font-semibold text-slate-600 text-sm">Önizlenecek evrak henüz oluşturulmadı.</p>
             <p className="text-xs text-slate-400 mt-1 max-w-sm">Sol menüden (veya mobilde 'Form &amp; Seçimler' sekmesinden) olay ve öğrenci seçip belge türüne tıklayınız.</p>
             <button
               type="button"
               onClick={() => setMobileViewMode('form')}
               className="mt-4 lg:hidden px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700 transition-colors"
             >
               Form &amp; Seçimlere Git &rarr;
             </button>
         </div>
      );

      return (
         <div className="w-full flex flex-col items-center">
             {renderZoomToolbar()}
             <div className="w-full overflow-x-auto flex justify-center py-2 px-1 custom-scrollbar">
                 <div className="flex flex-col gap-12 pb-20">
             {generatedDocs.map((doc, index) => {
                const totalPages = 5;
                const pageMarkers = (
                    <>
                        <div 
                            data-html2canvas-ignore="true"
                            className="page-marker absolute right-8 top-3 text-[10px] text-slate-400 font-medium print:hidden pointer-events-none z-10"
                        >
                            Sayfa 1 (Office Üst: {activeMargin.top}mm)
                        </div>
                        {Array.from({ length: totalPages }).map((_, i) => {
                            const pageNum = i + 1;
                            const topPos = `${pageNum * 297}mm`;
                            
                            return (
                                <React.Fragment key={i}>
                                    {/* Word Page Break Visual Line (Print Hidden) */}
                                    <div 
                                        data-html2canvas-ignore="true"
                                        className="page-marker absolute left-0 w-full flex items-center justify-between z-10 print:hidden pointer-events-none px-4"
                                        style={{ top: topPos, transform: 'translateY(-50%)' }}
                                    >
                                        <div className="h-px bg-slate-300 flex-1 border-t border-dashed border-slate-400"></div>
                                        <span className="mx-3 px-2 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded shadow-xs">
                                            Sayfa {pageNum} Sonu (Alt: {activeMargin.bottom}mm) • Sayfa {pageNum + 1} Başlangıcı (Üst: {activeMargin.top}mm)
                                        </span>
                                        <div className="h-px bg-slate-300 flex-1 border-t border-dashed border-slate-400"></div>
                                    </div>
                                    
                                    <div 
                                        data-html2canvas-ignore="true"
                                        className="page-marker absolute right-8 text-[10px] text-slate-400 font-medium print:hidden pointer-events-none z-10"
                                        style={{ top: `calc(${topPos} + 12px)` }}
                                    >
                                        Sayfa {pageNum + 1} (Office Üst: {activeMargin.top}mm)
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </>
                );

                return (
                    <div 
                        key={index}
                        className="relative group mx-auto w-[210mm]"
                        style={{ 
                            transform: `scale(${zoom})`, 
                            transformOrigin: 'top center',
                            transition: 'transform 0.2s ease-out'
                        }}
                    >
                        {/* Word Margin Indicator & Auto-Save Header */}
                        <div data-html2canvas-ignore="true" className="print:hidden mb-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center justify-between text-xs text-slate-600">
                            <div className="flex items-center gap-2 font-bold text-slate-800">
                                <Layout className="w-3.5 h-3.5 text-blue-600" />
                                <span>{activeMargin.name}</span>
                                <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-mono font-normal">A4 Portre</span>
                                {doc.studentName && (
                                    <span className="text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-bold">
                                        {doc.studentName}
                                    </span>
                                )}
                            </div>

                            {/* Auto-Save & Status Badge */}
                            <div className="flex items-center gap-2">
                                {autoSaveStatus.state === 'saving' && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                        <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                                        <span>Kaydediliyor...</span>
                                    </span>
                                )}
                                {autoSaveStatus.state === 'saved' && (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        <CheckCircle className="w-3 h-3 text-emerald-600" />
                                        <span>Otomatik Kaydedildi ({autoSaveStatus.timestamp})</span>
                                    </span>
                                )}
                                {doc.type && (
                                    <button
                                        type="button"
                                        onClick={() => handleResetDocumentToTemplate(doc.type, (doc as any).studentId || selectedStudentId, index)}
                                        title="Bu evrak için yapılan özel değişiklikleri silip orijinal MEB şablonuna sıfırlar"
                                        className="text-[10.5px] text-slate-500 hover:text-red-600 border border-slate-200 hover:border-red-300 hover:bg-red-50/50 px-2 py-0.5 rounded transition-colors flex items-center gap-1 font-medium ml-1 cursor-pointer"
                                    >
                                        <RotateCcw className="w-3 h-3 text-slate-400 group-hover:text-red-500" />
                                        <span>Şablona Sıfırla</span>
                                    </button>
                                )}
                                <div className="text-[11px] font-mono text-slate-400">
                                    Üst: {activeMargin.top}mm • Alt: {activeMargin.bottom}mm • Sol: {activeMargin.left}mm • Sağ: {activeMargin.right}mm
                                </div>
                            </div>
                        </div>

                        {/* Edit Hint */}
                        <div className="absolute top-12 -right-12 hidden group-hover:flex flex-col gap-2 z-20 pointer-events-none animate-fade-in">
                            <div className="bg-yellow-100 text-yellow-800 text-xs px-3 py-1.5 rounded-l-md shadow-sm flex items-center gap-2">
                                <PenTool className="w-3 h-3" /> Düzenle
                            </div>
                        </div>

                        {/* The Page Container - Strict Word Margins Applied as Padding */}
                        <div 
                            className={`document-page bg-white shadow-2xl text-black font-serif relative min-h-[297mm] h-auto ${fitToPage ? 'print-fit-page' : ''}`}
                            style={{ 
                                paddingTop: `${activeMargin.top}mm`,
                                paddingBottom: `${activeMargin.bottom}mm`,
                                paddingLeft: `${activeMargin.left}mm`,
                                paddingRight: `${activeMargin.right}mm`,
                                fontSize: `${docFontSize}pt`,
                                fontFamily: '"Times New Roman", Times, "Liberation Serif", serif'
                            }}
                        >
                            {/* Render Page Markers Layer */}
                            {pageMarkers}

                            {/* Header */}
                            {doc.header && (
                                <div className="text-center font-bold mb-3 whitespace-pre-wrap leading-tight relative z-0">{doc.header}</div>
                            )}

                            {/* Content - HTML Table Supported */}
                            <EditableDocumentContent
                                key={`${index}-${doc.type || ''}-${(doc as any).studentId || doc.studentName || ''}`}
                                initialHtml={doc.body}
                                docIndex={index}
                                fitToPage={fitToPage}
                                docFontSize={docFontSize}
                                onStartTyping={() => setAutoSaveStatus({ state: 'saving' })}
                                onSave={handleDocSave}
                            />
                        </div>
                        
                        {/* Bottom Label */}
                        <div className="text-center mt-2 text-xs text-slate-400 font-medium">
                            Belge {index + 1} / {generatedDocs.length} - A4 Görünümü (Office Standart Kenar Boşlukları)
                        </div>
                    </div>
                );
             })}
         </div>
       </div>
     </div>
   );
};

  // --- TEMPLATE GENERATOR ---
  const generateTemplate = (
    type: string, 
    studentOverride?: Student & { role?: string, studentStatement?: string, studentDefense?: string }, 
    returnOnly: boolean = false, 
    forceBlank: boolean = false,
    forceResetTemplate: boolean = false
  ) => {
    // -- Data Variables --
    let s = { 
        name: "..............................................", grade: "..........", number: "..........", 
        parent: "..............................................", dob: "..../..../.......", tc: ".....................", 
        school: institution.name, address: "...........................................................",
        fatherName: "...................", motherName: "...................", parentPhone: "...................", boardingStatus: "...................",
        gender: "...................", healthStatus: "...................",
        province: "...................", district: "...................", neighborhood: "...................",
        volumeNo: "..........", familyOrderNo: "..........", orderNo: "..........",
        registrationType: "...................", scholarshipStatus: "..................."
    };
    let i = { date: "..../..../20....", time: "..... : .....", location: "..............................", title: "..............................", desc: "..................................................................................................." };
    let d = { 
        no: "..........", 
        date: "..../..../20....", 
        penalty: "..............................", 
        reason: "...................................................................................................", 
        score: "....",
        regulationArticle: "...................................................................................................",
        behaviorReason: "..................................................................................................."
    };
    let previousPenaltiesText = "............................................................";
    let activeIncident: Incident | undefined = undefined;
    let targetInvolvement: InvolvedStudent | undefined = undefined;
    
    // Determine which student to use: passed override OR globally selected
    let targetStudentId = selectedStudentId;
    if(studentOverride) {
        targetStudentId = studentOverride.id;
    }

    const student = studentOverride || (selectedIncident ? incidentStudents : students).find(s => s.id === targetStudentId) || students.find(s => s.id === targetStudentId);
    const incident = incidents.find(i => i.id === selectedIncidentId);

    const isExplicitBlank = isBlankMode || forceBlank;

    // Check if a customized/saved document exists for this student and document type
    if (!isExplicitBlank && !forceResetTemplate && targetStudentId) {
      const savedBody = getSavedDocument(type, targetStudentId, selectedIncidentId);
      if (savedBody && savedBody.trim().length > 0) {
        const actualStudentName = student?.name && !student.name.includes('..') ? student.name : '';
        const docObj = {
          header: '',
          body: savedBody,
          type,
          studentName: actualStudentName,
          studentId: targetStudentId || ''
        };
        if (returnOnly) return docObj;
        setGeneratedDocs([docObj]);
        return docObj;
      }
    }

    if (!isExplicitBlank) {
        if (student) {
            let compiledAddress = student.address || '';
            if (!compiledAddress.trim()) {
                const addrParts = [
                    student.neighborhood ? `${student.neighborhood} Mah.` : '',
                    student.district ? `${student.district}` : '',
                    student.province ? `${student.province}` : ''
                ].filter(Boolean);
                compiledAddress = addrParts.join(' / ');
            }
            if (!compiledAddress.trim()) {
                compiledAddress = '...........................................................';
            }

            s = { 
                name: student.name, 
                grade: student.grade, 
                number: student.number, 
                parent: student.parentName || '..............................................', 
                dob: student.birthPlaceDate || '...................', 
                tc: student.tcNo || '...................', 
                school: institution.name,
                address: compiledAddress,
                fatherName: student.fatherName || '...................',
                motherName: student.motherName || '...................',
                parentPhone: student.parentPhone || '...................',
                boardingStatus: student.boardingStatus || 'GÜNDÜZLÜ',
                gender: student.gender || 'Erkek',
                healthStatus: student.healthStatus || 'İyi',
                province: student.province || '...................',
                district: student.district || '...................',
                neighborhood: student.neighborhood || '...................',
                volumeNo: student.volumeNo || '..........',
                familyOrderNo: student.familyOrderNo || '..........',
                orderNo: student.orderNo || '..........',
                registrationType: student.registrationType || 'Yeni Kayıt',
                scholarshipStatus: student.scholarshipStatus || 'BURSSUZ'
            };
            const activePriorPenalties = (student.previousPenalties || []).filter(p => !p.isRemoved);
            previousPenaltiesText = activePriorPenalties.length > 0
                ? activePriorPenalties.map(p => `${p.decision} (${p.date ? formatDateForDisplay(p.date) : ''}${p.decisionNo ? ' - No: ' + p.decisionNo : ''})`).join(', ')
                : 'Cezası Yoktur.';
        }
        if (incident) {
            activeIncident = incident;
            i = { 
                date: formatDateForDisplay(incident.date), 
                time: incident.time || '10:00', 
                location: incident.location, 
                title: incident.title, 
                desc: incident.description 
            };
            targetInvolvement = incident?.involvedStudents?.find(inv => inv.studentId === targetStudentId);
        }

        const regulationArticleVal = (targetInvolvement as any)?.regulationArticle || (decisionForm.regulationArticle || (institution.type !== 'Ortaokul' ? 'MEB Ortaöğretim Kurumları Yönetmeliği Madde 164' : 'MEB İlköğretim Kurumları Yönetmeliği Madde 54'));
        const behaviorReasonVal = (targetInvolvement as any)?.behaviorReason || (decisionForm.behaviorReason || (incident?.title ? `${incident.title} eylemi nedeniyle oluşan disiplin ihlali.` : 'Belirtilmedi'));

        d = { 
            no: decisionForm.decisionNo || '..........', 
            date: formatDateForDisplay(decisionForm.decisionDate), 
            penalty: decisionForm.penalty || '..............................', 
            reason: decisionForm.reason || '...................................................................................................', 
            score: decisionForm.score || '....',
            regulationArticle: regulationArticleVal,
            behaviorReason: behaviorReasonVal
        };
    }

    const effectivelyBlankMode = isExplicitBlank;

    // Form-specific date & time resolution:
    // Respect user's selected date and time in Tab 3, or fallback to incident or today
    const formDateStr = formDateTime.date 
        ? formatDateForDisplay(formDateTime.date) 
        : (incident?.date ? formatDateForDisplay(incident.date) : formatDateForDisplay(new Date().toISOString().split('T')[0]));
    const formTimeStr = formDateTime.time || (incident?.time ? incident.time : '10:00');

    // Common HTML Snippets
    const headerHtml = `
    <div style="text-align:center; font-weight:bold; margin-bottom:0.75rem; line-height:1.35; font-size:10.5pt;">
        T.C.<br>
        ${institution.province.toUpperCase()} VALİLİĞİ<br>
        ${institution.district} İLÇE MİLLİ EĞİTİM MÜDÜRLÜĞÜ<br>
        ${institution.name}
    </div>`;
    
    // Header for Kaymakamlık based hierarchy (Some forms require Kaymakamlık instead of Valilik if it's district level)
    const headerHtmlV2 = `
    <div style="text-align:center; font-weight:bold; margin-bottom:0.75rem; line-height:1.35; font-size:10.5pt;">
        T.C.<br>
        ${institution.district ? institution.district.toUpperCase() + ' KAYMAKAMLIĞI' : institution.province.toUpperCase() + ' VALİLİĞİ'}<br>
        İLÇE MİLLİ EĞİTİM MÜDÜRLÜĞÜ<br>
        ${institution.name}
    </div>`;

    // Use V2 for specific forms if District name exists
    const useHeader = institution.district ? headerHtmlV2 : headerHtml;
    
    let currentBody = "";

    // --- TEMPLATE LOGIC ---
    if (type === 'student_summons') {
        const isSuspect = studentOverride?.role === 'suspect';
        const isVictim = studentOverride?.role === 'victim';
        const roleText = isSuspect 
            ? `${boardInfo.boardLocative} görüşülecek olan disiplin dosyanızla ilgili <b>savunmanızı vermek üzere</b>` 
            : isVictim
                ? `${boardInfo.boardLocative} görüşülecek olan olayla ilgili <b>mağdur olarak bilginize başvurulmak üzere</b>`
                : `${boardInfo.boardLocative} görüşülecek olan bir olayla ilgili <b>görgü tanığı olarak bilginize başvurulmak üzere</b>`;

        currentBody = `
        ${useHeader}
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:9.5pt;">
             <div><b>Sayı</b> : ...<br><b>Konu</b> : Çağrı Pusulası</div>
             <div>${new Date().toLocaleDateString('tr-TR')}</div>
        </div>
        <div style="text-align:center; font-weight:bold; font-size:11pt; text-decoration:underline; margin:6px 0;">ÖĞRENCİ ÇAĞRI PUSULASI</div>
        <div style="margin-bottom:6px; font-size:10pt;">
            <b>Sayın ${s.name},</b><br>
            ${s.grade} Sınıfı / ${s.number} Nolu Öğrencisi
        </div>
        <p style="text-indent:30px; text-align:justify; line-height:1.6;">
           ${i.date} tarihinde ${i.location} yerinde meydana gelen "${i.title}" olayı ile ilgili olarak, ${roleText} aşağıda belirtilen gün ve saatte Kurul Toplantı Salonunda hazır bulunmanız gerekmektedir.
        </p>
        <p style="text-indent:30px; text-align:justify; line-height:1.6;">
           Belirtilen gün ve saatte gelmediğiniz takdirde; ${isSuspect ? 'savunma hakkınızdan vazgeçmiş sayılacağınızı ve dosyanızın mevcut bilgi ve belgelere göre karara bağlanacağını' : 'ifadenize başvurulamayacağını'} bilmenizi rica ederim.
        </p>
        <br>
        <table style="width:100%; border:1px solid black; margin-top:20px; font-size:10pt;">
            <tr>
                <td style="border:1px solid black; padding:8px; font-weight:bold; width:30%; background-color:#f9f9f9;">Toplantı Tarihi</td>
                <td style="border:1px solid black; padding:8px;">${formatDate(meetingData.date)}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:8px; font-weight:bold; background-color:#f9f9f9;">Toplantı Saati</td>
                <td style="border:1px solid black; padding:8px;">${meetingData.time}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:8px; font-weight:bold; background-color:#f9f9f9;">Toplantı Yeri</td>
                <td style="border:1px solid black; padding:8px;">${meetingData.location}</td>
            </tr>
        </table>
        
        <div style="text-align:right; margin-top:40px;">
            <b>${boardInfo.presidentName}</b><br>${boardInfo.presidentTitle && boardInfo.presidentTitle.toLocaleLowerCase('tr-TR') !== boardInfo.boardPresidentLabel.toLocaleLowerCase('tr-TR') ? `${boardInfo.presidentTitle}<br>` : ''}${boardInfo.boardPresidentLabel}
        </div>
        
        <div style="margin-top:50px; border-top:1px dashed black; padding-top:10px; font-size:9pt;">
            <div style="text-align:center; margin-bottom:10px;"><b>TEBLİĞ - TEBELLÜĞ BELGESİ</b></div>
            <p>Yukarıdaki çağrı pusulasını elden teslim aldım. .../.../20...</p>
            <div style="display:flex; justify-content:space-between; margin-top:20px;">
                <div style="text-align:center;">
                    <b>Tebliğ Eden</b><br>
                    (İmza)<br><br>
                    ...................................<br>
                    Müdür Yardımcısı
                </div>
                <div style="text-align:center;">
                    <b>Tebellüğ Eden (Öğrenci)</b><br>
                    (İmza)<br><br>
                    <b>${s.name}</b>
                </div>
            </div>
        </div>
        `;
    }
    else if (type === 'ek10_decision') {
        currentBody = `
        ${headerHtml}
        <div style="text-align:center; font-weight:bold; margin-bottom:5px; margin-top:5px; border:1px solid black; padding:3px; font-size:10pt;">${boardInfo.boardNameUpper} KARARI<br><span style="font-weight:normal;">${boardInfo.ek10SubNote}</span> <span style="float:right;">EK - 10</span></div>
        <table style="width:100%; border-collapse:collapse; border:1px solid black; font-size:9pt; page-break-inside:auto;">
            <tr>
                <td style="border:1px solid black; padding:3px; font-weight:bold; width:15%;">Karar No</td>
                <td style="border:1px solid black; padding:3px; width:35%;">: ${d.no}</td>
                <td style="border:1px solid black; padding:3px; font-weight:bold; width:15%;">Karar Tarihi</td>
                <td style="border:1px solid black; padding:3px; width:35%;">: ${d.date}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:3px; font-weight:bold;">Öğrencinin</td>
                <td colspan="3" style="border:1px solid black; padding:0;">
                   <table style="width:100%; border-collapse:collapse; border:none;">
                       <tr><td style="padding:3px; border-bottom:1px solid black;">Adı ve Soyadı</td><td style="padding:3px; border-bottom:1px solid black;">: <b>${s.name}</b> <span style="float:right;">T.C. Kimlik No : <b>${s.tc}</b></span></td></tr>
                       <tr><td style="padding:3px; border-bottom:1px solid black;">Sınıfı - No</td><td style="padding:3px; border-bottom:1px solid black;">: ${s.grade} - ${s.number} <span style="float:right;">Doğum Yeri / Tarihi : ${s.dob}</span></td></tr>
                       <tr><td style="padding:3px; border-bottom:1px solid black;">Nüfus Kaydı</td><td style="padding:3px; border-bottom:1px solid black;">: İl: ${s.province} / İlçe: ${s.district} / Mah: ${s.neighborhood} <span style="float:right;">Cilt: ${s.volumeNo} &nbsp;|&nbsp; <b>Aile Sıra No: ${s.familyOrderNo}</b> &nbsp;|&nbsp; <b>Sıra No: ${s.orderNo}</b></span></td></tr>
                       <tr><td style="padding:3px; border-bottom:1px solid black;">Yarı Yıl</td><td style="padding:3px; border-bottom:1px solid black;">: ${institution.year || '...................'} <span style="float:right;">Cinsiyeti : ${s.gender}</span></td></tr>
                       <tr><td style="padding:3px;">Sağlık Durumu / Yatılılık</td><td style="padding:3px;">: ${s.healthStatus} • ${s.boardingStatus} <span style="float:right;">Kayıt / Burs : ${s.registrationType} (${s.scholarshipStatus})</span></td></tr>
                   </table>
                </td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:3px; font-weight:bold; vertical-align:middle;">Anne-Babanın</td>
                <td colspan="3" style="border:1px solid black; padding:0;">
                     <table style="width:100%; border-collapse:collapse; border:none; text-align:center;">
                        <tr>
                            <td style="border-right:1px solid black; border-bottom:1px solid black; width:50%; font-weight:bold; padding:4px; background-color:#fafafa;">Anne</td>
                            <td style="border-bottom:1px solid black; font-weight:bold; padding:4px; background-color:#fafafa;">Baba</td>
                        </tr>
                        <tr>
                            <td style="border-right:1px solid black; padding:4px; border-bottom:1px solid black;">${s.motherName}</td>
                            <td style="padding:4px; border-bottom:1px solid black;">${s.fatherName}</td>
                        </tr>
                        <tr>
                            <td style="border-right:1px solid black; padding:4px 6px; border-bottom:1px solid #ddd; text-align:left;">Hayatta mı? &nbsp;&nbsp;&nbsp; ( ) Evet &nbsp;&nbsp;&nbsp; ( ) Hayır</td>
                            <td style="padding:4px 6px; border-bottom:1px solid #ddd; text-align:left;">Hayatta mı? &nbsp;&nbsp;&nbsp; ( ) Evet &nbsp;&nbsp;&nbsp; ( ) Hayır</td>
                        </tr>
                        <tr>
                            <td style="border-right:1px solid black; padding:4px 6px; border-bottom:1px solid #ddd; text-align:left;">Öz mü? &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ( ) Evet &nbsp;&nbsp;&nbsp; ( ) Hayır</td>
                            <td style="padding:4px 6px; border-bottom:1px solid #ddd; text-align:left;">Öz mü? &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ( ) Evet &nbsp;&nbsp;&nbsp; ( ) Hayır</td>
                        </tr>
                        <tr>
                            <td style="border-right:1px solid black; padding:4px 6px; text-align:left;">Birlikte mi? &nbsp;&nbsp;&nbsp;&nbsp; ( ) Evet &nbsp;&nbsp;&nbsp; ( ) Hayır</td>
                            <td style="padding:4px 6px; text-align:left;">Birlikte mi? &nbsp;&nbsp;&nbsp;&nbsp; ( ) Evet &nbsp;&nbsp;&nbsp; ( ) Hayır</td>
                        </tr>
                     </table>
                </td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:3px;">Ailenin ekonomik durumu</td>
                <td colspan="3" style="border:1px solid black; padding:3px;">: </td>
            </tr>
             <tr>
                <td style="border:1px solid black; padding:3px;">Kardeş sayısı ve yaşları</td>
                <td colspan="3" style="border:1px solid black; padding:3px;">: </td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:3px;">Ailesinin oturduğu yer ve açık adresi</td>
                <td colspan="3" style="border:1px solid black; padding:3px;">: ${s.address} <span style="float:right;">Veli Tel: ${s.parentPhone}</span></td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:3px;">Şimdiye kadar aldığı yaptırımlar</td>
                <td colspan="3" style="border:1px solid black; padding:3px;">: ${previousPenaltiesText}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:3px;">Yaptırımı gerektiren davranışın yer ve tarihi</td>
                <td colspan="3" style="border:1px solid black; padding:3px;">: ${i.location} / ${i.date}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:3px;">Yaptırımı gerektiren davranışın çeşidi</td>
                <td colspan="3" style="border:1px solid black; padding:3px;">: ${i.title}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:3px;">Yaptırımı gerektiren davranışın nedeni</td>
                <td colspan="3" style="border:1px solid black; padding:3px;">: ${d.behaviorReason}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:3px;">Olayla ilgili olarak</td>
                <td colspan="3" style="border:1px solid black; padding:3px; vertical-align:top;">
                    a) Yaptırım uygulanacak öğrencinin ifadesi / savunması : <br>
                    ${(!effectivelyBlankMode && (targetInvolvement?.studentStatement || targetInvolvement?.studentDefense)) ? `
                        <div style="font-weight:normal; margin: 4px 0 8px 10px; padding: 6px; background-color: #fafafa; border: 1px dashed #bbb; font-size:9.5pt; white-space:pre-wrap; font-family:inherit; text-align:left;">
                            ${targetInvolvement.studentStatement ? `<b>Alınan İfade:</b><br>${targetInvolvement.studentStatement}<br>` : ''}
                            ${targetInvolvement.studentDefense ? `<b>Savunma Beyanı:</b><br>${targetInvolvement.studentDefense}` : ''}
                        </div>
                    ` : 'Görüşülmüştür. (Yazılı ifadesi/savunması dosyasında mevcuttur.)'}<br>
                    b) Tanıkların ifadesinin özeti :<br><br>
                    c) Varsa yaptırımı gerektiren diğer deliller :<br><br>
                    d) Olayın Özeti (Geniş Açıklama) : <br>${i.desc}
                </td>
            </tr>
             <tr>
                <td style="border:1px solid black; padding:3px; font-weight:bold;">Kararın Gerekçesi (Yargı ve Değerlendirme)</td>
                <td colspan="3" style="border:1px solid black; padding:3px; font-style: italic;">: ${d.reason || 'Sürece ve davranışa ilişkin kurul gerekçesi.'}</td>
            </tr>
             <tr>
                <td style="border:1px solid black; padding:3px; font-weight:bold;">Verilen yaptırımın dayandığı yönetmelik md.</td>
                <td colspan="3" style="border:1px solid black; padding:3px;">: ${d.regulationArticle}</td>
            </tr>
             <tr>
                <td style="border:1px solid black; padding:3px;">Yaptırımı hafifleten/şiddetlendiren nedenler</td>
                <td colspan="3" style="border:1px solid black; padding:3px;">: ${(!effectivelyBlankMode && activeIncident?.useMitigatingFactors && activeIncident?.mitigatingFactors) ? `<b>Hafifletici Neden:</b> ${activeIncident.mitigatingFactors} (Cezada 1 derece hafifletme uygulanmıştır)` : 'Yoktur/Belirtilmemiştir.'}</td>
            </tr>
             <tr>
                <td style="border:1px solid black; padding:3px; background-color:#f9f9f9;"><b>${boardInfo.boardGenitive} kanaati</b></td>
                <td colspan="3" style="border:1px solid black; padding:3px;">: <b>${d.penalty}</b> ile cezalandırılmasına karar verilmiştir.</td>
            </tr>
        </table>
        
        <table style="width:100%; margin-top:25px; border:none; text-align:center; font-size:9pt; page-break-inside:avoid;">
            <tr>
               ${boardMembers.map((m: BoardMember) => `<td style="width:${100/boardMembers.length}%; font-weight:bold; padding-bottom:15px;">${m.role}</td>`).join('')}
            </tr>
            <tr>
               ${boardMembers.map((m: BoardMember) => `<td><b>${m.mainName || '.......................................'}</b></td>`).join('')}
            </tr>
            <tr>
               ${boardMembers.map((m: BoardMember) => `<td style="font-size:8pt; color:#555; padding-top:4px;">${m.mainTitle || ''}</td>`).join('')}
            </tr>
        </table>
        <div style="margin-top:30px; text-align:center; font-size:10pt; page-break-inside:avoid;">
            Uygundur<br>..../..../20....<br><br>
            <b>${institution.managerName}</b><br>Okul Müdürü
        </div>
        `;
    } 
    else if (type === 'ek1_student_info') {
        currentBody = `
        <div style="text-align:right; font-weight:bold; margin-bottom:5px;">EK - 1</div>
        <div style="text-align:center; font-weight:bold; margin-bottom:10px; font-size:12pt;">
            ${boardInfo.boardNameUpper} ÜYELERİNE<br>
            ÖĞRENCİ BİLGİLERİ
        </div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #ccc; font-size:10pt;">
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold; width:200px;">Okul No</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.number}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Sınıfı ve Şubesi</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.grade}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Adı Soyadı</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.name}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">T.C. No</td>
                <td style="border:1px solid #ccc; padding:6px;">: <b>${s.tc}</b></td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Uyruğu</td>
                <td style="border:1px solid #ccc; padding:6px;">: T.C.</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Cinsiyeti</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.gender}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Baba Adı</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.fatherName}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Anne Adı</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.motherName}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Doğum Yeri ve Tarihi</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.dob}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Nüfus Kaydı (İl / İlçe / Mahalle)</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.province} / ${s.district} / ${s.neighborhood}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Cilt / Aile Sıra / Sıra No</td>
                <td style="border:1px solid #ccc; padding:6px;">: Cilt: <b>${s.volumeNo}</b> &nbsp;|&nbsp; Aile Sıra No: <b>${s.familyOrderNo}</b> &nbsp;|&nbsp; Sıra No: <b>${s.orderNo}</b></td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Yatılı / Bursluluk Durumu</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.boardingStatus} • ${s.scholarshipStatus}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Veli Adı Soyadı</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.parent}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Veli Telefon No</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.parentPhone}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Kardeş Sayısı</td>
                <td style="border:1px solid #ccc; padding:6px;">:</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Maddi Durumu</td>
                <td style="border:1px solid #ccc; padding:6px;">:</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Sınıf / Okul Reh. Öğretmeni</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${institution.counselorName ? `<b>${institution.counselorName}</b> (${institution.counselorTitle || 'Okul Rehber Öğretmeni'})` : ''}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Sözlü Uyarı Sayısı</td>
                <td style="border:1px solid #ccc; padding:6px;">:</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Uyarı Sayısı</td>
                <td style="border:1px solid #ccc; padding:6px;">:</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Kınama Sayısı</td>
                <td style="border:1px solid #ccc; padding:6px;">:</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Uzaklaştırma Say.</td>
                <td style="border:1px solid #ccc; padding:6px;">:</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Okul Değiş. Sayısı</td>
                <td style="border:1px solid #ccc; padding:6px;">:</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Olayın Tarihi</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${i.date}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Olayın Saati</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${i.time}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Olayın Tekrar sayısı</td>
                <td style="border:1px solid #ccc; padding:6px;">:</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Tanık Öğretmen</td>
                <td style="border:1px solid #ccc; padding:6px;">:</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Tanık Öğrenci</td>
                <td style="border:1px solid #ccc; padding:6px;">:</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Davranış karşılığı</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${d.penalty}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Mevzuat karşılığı</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${d.reason.substring(0, 50)}...</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Verilen Ceza</td>
                <td style="border:1px solid #ccc; padding:6px;">:</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Adres</td>
                <td style="border:1px solid #ccc; padding:6px;">: ${s.address}</td>
            </tr>
            <tr>
                <td style="border:1px solid #ccc; padding:6px; font-weight:bold;">Davr. Açıklaması</td>
                <td style="border:1px solid #ccc; padding:6px; height:50px; vertical-align:top;">: ${i.title}</td>
            </tr>
        </table>
        `;
    }
    else if (type === 'dizi_pusulasi') {
        currentBody = `
        <div style="text-align:center; font-weight:bold; margin-bottom:1rem; font-size:12pt; line-height:1.2;">
            ${boardInfo.boardNameUpper}<br>
            DOSYASI<br>
            DİZİ PUSULASI
        </div>
        
        <table style="width:100%; border-collapse:collapse; border:1px solid black; font-size:10pt;">
            <tr style="background-color:#c9d8ef; text-align:center; font-weight:bold;">
                <td colspan="4" style="border:1px solid black; padding:5px;">ÖĞRENCİNİN</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold; width:25%;">Okulu</td>
                <td colspan="3" style="border:1px solid black; padding:5px;">${institution.name}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Adı ve Soyadı</td>
                <td style="border:1px solid black; padding:5px;"><b>${s.name}</b></td>
                <td style="border:1px solid black; padding:5px; font-weight:bold; width:20%;">T.C. Kimlik No</td>
                <td style="border:1px solid black; padding:5px;"><b>${s.tc}</b></td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Sınıfı / Numarası</td>
                <td style="border:1px solid black; padding:5px;">${s.grade} / ${s.number}</td>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Baba / Anne Adı</td>
                <td style="border:1px solid black; padding:5px;">${s.fatherName} / ${s.motherName}</td>
            </tr>
        </table>
        
        <table style="width:100%; border-collapse:collapse; border:1px solid black; font-size:9pt; margin-top:-1px;">
            <tr style="background-color:#c9d8ef; text-align:center; font-weight:bold;">
                <td style="border:1px solid black; padding:5px; width:5%;">Sıra<br>No</td>
                <td style="border:1px solid black; padding:5px; width:60%;">GÖNDERİLECEK EVRAKLAR</td>
                <td style="border:1px solid black; padding:5px; width:10%;">VAR</td>
                <td style="border:1px solid black; padding:5px; width:25%;">AÇIKLAMA</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">1</td>
                <td style="border:1px solid black; padding:5px;">${boardInfo.boardName} Kararının Onaylı Örneği<br>${boardInfo.isOrtaokul ? '(Yön. 61-2.a)' : '(MEB Ortaöğretim Kur. Yön.)'}</td>
                <td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td>
                <td style="border:1px solid black; padding:5px;"></td>
            </tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">2</td><td style="border:1px solid black; padding:5px;">İtiraz Dilekçesi veya Yazısı (Yön. 61-c) (Sadece İtiraz dosyalarında)</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">3</td><td style="border:1px solid black; padding:5px;">Verilen Cezanın Öğrenci Velisine Tebliği (Yön. 61)</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">4</td><td style="border:1px solid black; padding:5px;">Kurula Sevk Edilen Öğrenci ve Tanıkların Yazılı İfadeleri (Yön. 61)</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">5</td><td style="border:1px solid black; padding:5px;">Yazılı Savunma (Yön. 61)</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">6</td><td style="border:1px solid black; padding:5px;">Sınıf Rehber Öğretmeninin Öğrenci İle İlgili Görüşü</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">7</td><td style="border:1px solid black; padding:5px;">Öğrenci Velisinin Öğrenci İle İlgili Görüşü</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">8</td><td style="border:1px solid black; padding:5px;">Okul Rehberlik Servisinin Öğrenci İle İlgili Görüşü</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">9</td><td style="border:1px solid black; padding:5px;">E-Okuldan Alınacak Öğrencinin Başarısını Gösterir Çizelge</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">10</td><td style="border:1px solid black; padding:5px;">Öğrencinin Adres Bilgisini Gösteren Belge</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">11</td><td style="border:1px solid black; padding:5px;">Mahkeme Kararı ve/veya Safahatı (Varsa)</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">12</td><td style="border:1px solid black; padding:5px;">Tutanaklar</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
            <tr><td style="border:1px solid black; padding:5px; text-align:center; font-weight:bold;">13</td><td style="border:1px solid black; padding:5px;">Diğer</td><td style="border:1px solid black; padding:5px; text-align:center;"><div style="width:15px; height:15px; border:1px solid black; margin:0 auto;"></div></td><td style="border:1px solid black; padding:5px;"></td></tr>
        </table>
        
        <div style="margin-top:40px; text-align:right;">
             <div style="display:inline-block; text-align:center;">
                 ..../..../202....<br><br><br>
                 ...................................<br><br>
                 <b>Okul Müdürü</b>
             </div>
        </div>
        
        <div style="margin-top:20px; font-size:8pt; line-height:1.4;">
            <b>Açıklamalar:</b><br>
            1. ${boardInfo.boardName} Dosyaları mutlaka üst yazı ekinde zarf içerisinde gönderilecektir.<br>
            2. Dizi pusulasında sıralanan hususların karşısındaki VAR kısmına (X) işareti konulacak, eğer evrak dosyaya konulmamışsa konulmama sebebi açıklama kısmına yazılacaktır. Örneğin 10 numaralı evrak konulamamışsa açıklama sütununa "Konu Mahkemeye İntikal etmemiştir" ifadeleri yazılmalı, diğer evraklar ise dosyaya mutlaka konulmalıdır.<br>
            3. Dosyaya suretleri konulan belgeler okul müdürlüğünce "Aslı Gibidir" ifadesi yazılıp onaylanacaktır.<br>
            4. Diğer seçeneği işaretlenmişse, açıklama kısmına eklenen evrakların isimleri yazılacaktır.<br>
            5. Dosya, dizi pusulasındaki sıraya uygun tanzim edilerek her evrakın sağ üst köşesine dizi pusulasındaki sırasını gösteren numara verilecektir.<br>
            6. Dizi pusulasının altı Okul Müdürü tarafından imzalanacaktır.
        </div>
        `;
    }
    else if (type === 'ek1_meeting') {
        currentBody = `
        ${headerHtml}
        <br>
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
             <div><b>Sayı</b> : ${institution.ebysCode}<br><b>Konu</b> : ${boardInfo.boardName}<br>Toplantısı Çağrısı</div>
             <div>${new Date().toLocaleDateString('tr-TR')}</div>
        </div>
        <div style="text-align:center; font-weight:bold; margin:20px 0;">${boardInfo.boardNameUpper} ÜYELERİNE</div>
        <p style="text-indent:30px; text-align:justify; line-height:1.6;">
           ${boardInfo.boardOur} <b>${formatDate(meetingData.date)}</b> tarihinde saat <b>${meetingData.time}</b>'da toplanacaktır. 
           Kurulda bulunan öğretmenlerimizin aşağıdaki gündem maddelerini görüşmek üzere belirtilen gün ve saatte hazır bulunmaları, Asil üyelerden gelemeyenlerin yerine yedek üyelerin hazır bulunmaları hususunda gereğini rica ederim.
        </p>
        <div style="text-align:right; margin-top:30px; margin-bottom:40px;">
            <b>${institution.managerName}</b><br>Okul Müdürü
        </div>
        
        <b>GÜNDEM</b>
        <ol style="margin-top:5px;">
            <li>Açılış ve yoklama.</li>
            <li>${boardInfo.boardLocative}ki dosyaların görüşülmesi.</li>
            <li>Dilek, temenniler ve kapanış.</li>
        </ol>
        <br>
        <table style="width:100%; border-collapse:collapse; border:1px solid black; font-size:10pt; text-align:center;">
             <tr style="background-color:#f0f0f0; font-weight:bold;">
                <td style="border:1px solid black; padding:5px;">ÖĞRETMENİN ADI SOYADI</td>
                <td style="border:1px solid black; padding:5px;">GÖREVİ</td>
                <td style="border:1px solid black; padding:5px;">TARİH</td>
                <td style="border:1px solid black; padding:5px;">İMZA</td>
             </tr>
             ${boardMembers.map(m => `
             <tr>
                <td style="border:1px solid black; padding:8px;"><b>${m.mainName || '.......................................'}</b></td>
                <td style="border:1px solid black; padding:8px;">${m.role}${m.mainTitle ? ` (${m.mainTitle})` : ''}</td>
                <td style="border:1px solid black; padding:8px;">${formatDate(meetingData.date)}</td>
                <td style="border:1px solid black; padding:8px;"></td>
             </tr>`).join('')}
             ${institution.counselorName ? `
             <tr>
                <td style="border:1px solid black; padding:8px;"><b>${institution.counselorName}</b></td>
                <td style="border:1px solid black; padding:8px;">${institution.counselorTitle || 'Psikolojik Danışman / Rehberlik Öğretmeni'} (Danışman Üye)</td>
                <td style="border:1px solid black; padding:8px;">${formatDate(meetingData.date)}</td>
                <td style="border:1px solid black; padding:8px;"></td>
             </tr>` : ''}
        </table>
        `;
    }
    else if (type === 'sanction_student') {
        const student = students.find(st => st.id === targetStudentId);
        const currentScore = student ? getStudentBehaviorPoints(student, incidents, selectedIncidentId) : 100;
        const deductionVal = parseInt(d.score || '0', 10);
        const remaining = Math.max(0, currentScore - (isNaN(deductionVal) ? 0 : deductionVal));
        
        currentBody = `
        ${useHeader}
        <br>
        <table style="width:100%; border:none;">
            <tr>
                <td style="width:10px;">Sayı</td><td>: ...</td>
                <td style="text-align:right;">${d.date}</td>
            </tr>
            <tr>
                <td>Konu</td><td>: Öğrencimize Uygulanan Yaptırım</td>
            </tr>
        </table>
        <br>
        <div style="text-align:center;"><b>Sayın ${s.name} (T.C.: ${s.tc})<br>${s.grade} Sınıfı / ${s.number} Nolu Öğrencisi</b><br><span style="font-size:9pt; color:#444;">Baba Adı: ${s.fatherName} • Anne Adı: ${s.motherName}</span></div>
        <br>
        <p style="text-indent:30px; text-align:justify; line-height:1.5;">
            Aşağıda belirtilen uygunsuz davranışı yapmanız nedeniyle okulumuz ${boardInfo.boardAgentive} suçlu bulunarak, şahsınıza aşağıdaki yaptırımın uygulanması uygun görülmüştür.
        </p>
        <p style="text-indent:30px; text-align:justify; line-height:1.5;">
             Bilgilerinize sunar, okul içinde ve dışında daha kötü sonuçlar doğurabilecek davranışlara yönelmemenizi, bu konuda okul idaresi, rehberlik servisi ve öğretmenlerinizden destek istemenizi, aksi takdirde bundan sonra yapacağınız her olumsuz davranıştan dolayı yaptırımın ağırlaşabileceğini bilmenizi rica ederim.
        </p>
        <div style="text-align:right; margin-top:20px; margin-bottom:20px;">
            <b>${institution.managerName}</b><br>Okul Müdürü
        </div>
        <div style="text-align:center; font-weight:bold; margin-bottom:5px;">ÖĞRENCİYE UYGULANAN YAPTIRIM TEBLİĞİ</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid black; font-size:10pt;">
            <tr>
                <td style="border:1px solid black; padding:5px; width:40%; font-weight:bold;">Öğrenci Künye Bilgileri</td>
                <td style="border:1px solid black; padding:5px;">${s.name} (${s.grade} - ${s.number}) • T.C.: <b>${s.tc}</b><br>Nüfus: ${s.province} / ${s.district} (Cilt: ${s.volumeNo} | Aile Sıra: <b>${s.familyOrderNo}</b> | Sıra: <b>${s.orderNo}</b>)</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Yaptırım Gerektiren Davranış</td>
                <td style="border:1px solid black; padding:5px;">${i.title}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Verilen Yaptırım</td>
                <td style="border:1px solid black; padding:5px;">${d.penalty}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Yönetmelik Maddesi (Dayanak)</td>
                <td style="border:1px solid black; padding:5px;">${d.regulationArticle}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Yaptırımın Gerekçesi</td>
                <td style="border:1px solid black; padding:5px; font-style: italic;">${d.reason}</td>
            </tr>
            ${(!effectivelyBlankMode && activeIncident?.useMitigatingFactors && activeIncident?.mitigatingFactors) ? `
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold; color: #065f46; background-color: #f0fdf4;">Yaptırımı Hafifleten Nedenler (1 Alt Derece)</td>
                <td style="border:1px solid black; padding:5px; font-style: italic; background-color: #f0fdf4;">${activeIncident.mitigatingFactors}</td>
            </tr>
            ` : ''}
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Yaptırımı Veren</td>
                <td style="border:1px solid black; padding:5px;">${boardInfo.boardName}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Kırılan Davranış Notu</td>
                <td style="border:1px solid black; padding:5px;">${d.score}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold; background-color:#e0f2f1;">Kalan Davranış Notu</td>
                <td style="border:1px solid black; padding:5px; background-color:#e0f2f1;">${remaining}</td>
            </tr>
        </table>
        <br>
        <table class="signature-block avoid-break" style="width:100%; border:none; text-align:center; margin-top:10px;">
            <tr>
                <td></td>
                <td>Tarih : ..../..../20....<br>Öğrenci İmzası : ........................</td>
            </tr>
            <tr>
                <td></td>
                <td><br>Öğrenci Adı Soyadı : <b>${s.name}</b></td>
            </tr>
        </table>
        `;
    }
    else if (type === 'sanction_parent') {
        const student = students.find(st => st.id === targetStudentId);
        const currentScore = student ? getStudentBehaviorPoints(student, incidents, selectedIncidentId) : 100;
        const deductionVal = parseInt(d.score || '0', 10);
        const remaining = Math.max(0, currentScore - (isNaN(deductionVal) ? 0 : deductionVal));
        currentBody = `
        ${useHeader}
        <br>
        <table style="width:100%; border:none;">
            <tr>
                <td style="width:10px;">Sayı</td><td>: ...</td>
                <td style="text-align:right;">${d.date}</td>
            </tr>
            <tr>
                <td>Konu</td><td>: Öğrencimize Uygulanan Yaptırım</td>
            </tr>
        </table>
        <br>
        <div style="text-align:center;"><b>Sayın ${s.parent}<br>(${s.name} Velisi - T.C.: <b>${s.tc}</b>)</b><br><span style="font-size:9pt; color:#444;">Veli Telefonu: ${s.parentPhone} • İkamet: ${s.address}</span></div>
        <br>
        <p style="text-indent:30px; text-align:justify; line-height:1.5;">
            Velisi olduğunuz ${s.grade} sınıfından ${s.number} no'lu öğrencimiz ${s.name} aşağıda belirtilen kusurlu davranışı yapması nedeniyle okulumuz ${boardInfo.boardAgentive} suçlu bulunarak, kendisine aşağıdaki yaptırımın uygulanması uygun görülmüştür.
        </p>
        <p style="text-indent:30px; text-align:justify; line-height:1.5;">
             Bilgilerinize sunar, öğrencimizin daha kötü sonuçlar doğurabilecek davranışlara yönelmesini önlemek için okul yönetimi, rehberlik servisi ve öğretmenleri ile işbirliği yapmanızı önerir, bundan sonra yapacağı her olumsuz davranıştan dolayı cezasının ağırlaşabileceğini bilmenizi rica ederim.
        </p>
        <div style="text-align:right; margin-top:20px; margin-bottom:20px;">
            <b>${institution.managerName}</b><br>Okul Müdürü
        </div>
        <div style="text-align:center; font-weight:bold; margin-bottom:5px;">UYGULANAN YAPTIRIMIN ÖĞRENCİ VELİSİNE TEBLİĞİ</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid black; font-size:10pt;">
            <tr>
                <td style="border:1px solid black; padding:5px; width:40%; font-weight:bold;">Öğrenci Künye Bilgileri</td>
                <td style="border:1px solid black; padding:5px;">${s.name} (${s.grade} - ${s.number}) • T.C.: <b>${s.tc}</b><br>Nüfus: ${s.province} / ${s.district} (Cilt: ${s.volumeNo} | Aile Sıra: <b>${s.familyOrderNo}</b> | Sıra: <b>${s.orderNo}</b>)</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; width:40%; font-weight:bold;">Yaptırım Gerektiren Davranış</td>
                <td style="border:1px solid black; padding:5px;">${i.title}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Verilen Yaptırım</td>
                <td style="border:1px solid black; padding:5px;">${d.penalty}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Yönetmelik Maddesi (Dayanak)</td>
                <td style="border:1px solid black; padding:5px;">${d.regulationArticle}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Yaptırımın Gerekçesi</td>
                <td style="border:1px solid black; padding:5px; font-style: italic;">${d.reason}</td>
            </tr>
            ${(!effectivelyBlankMode && activeIncident?.useMitigatingFactors && activeIncident?.mitigatingFactors) ? `
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold; color: #065f46; background-color: #f0fdf4;">Yaptırımı Hafifleten Nedenler (1 Alt Derece)</td>
                <td style="border:1px solid black; padding:5px; font-style: italic; background-color: #f0fdf4;">${activeIncident.mitigatingFactors}</td>
            </tr>
            ` : ''}
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Yaptırımı Veren</td>
                <td style="border:1px solid black; padding:5px;">${boardInfo.boardName}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold;">Kırılan Davranış Notu</td>
                <td style="border:1px solid black; padding:5px;">${d.score}</td>
            </tr>
            <tr>
                <td style="border:1px solid black; padding:5px; font-weight:bold; background-color:#e0f2f1;">Kalan Davranış Notu</td>
                <td style="border:1px solid black; padding:5px; background-color:#e0f2f1;">${remaining}</td>
            </tr>
        </table>
        <br>
        <table class="signature-block avoid-break" style="width:100%; border:none; text-align:center; margin-top:10px;">
            <tr>
                <td></td>
                <td>Tarih : ..../..../20....<br>Veli İmzası : ........................</td>
            </tr>
            <tr>
                <td></td>
                <td><br>Veli Adı Soyadı : <b>${s.parent}</b></td>
            </tr>
        </table>
        `;
    }
    // ... [Other templates remain same] ...
    else if (type === 'opinion_teacher') {
        currentBody = `
        ${useHeader}
        <br>
        <div style="display:flex; justify-content:space-between;">
             <div><b>Sayı</b> : ...<br><b>Konu</b> : Eğitim - Öğretim Bilgi Talebi</div>
             <div>${new Date().toLocaleDateString('tr-TR')}</div>
        </div>
        <br><br>
        <div style="text-align:center;"><b>..........<br>Sınıf Rehber / Ders Öğretmenine</b></div>
        <br>
        <p style="text-indent:30px; text-align:justify; line-height:1.5;">
            ${boardInfo.boardLocative} görüşülmesi için gönderilen <b>${s.grade}</b> sınıfından <b>${s.number}</b> numaralı <b>${s.name}</b> adlı öğrenciye ait dosya ile ilgili olarak; adı geçen öğrencinin sizin dersinizdeki veya okul/sınıf içindeki genel durumunu, akademik ilgisini ve gözlemlediğiniz belirgin davranış kalıplarını değerlendiren bir rapor hazırlamanızı ve kurulumuza sunmanızı rica ederim.
        </p>
        <div style="text-align:right; margin-top:30px; margin-bottom:30px;">
            <b>${boardPresident}</b><br>${boardInfo.boardPresidentLabel}
        </div>
        
        <b>NOT: Öğrenci hakkındaki görüşlerinizi şu başlıklarda sunabilirsiniz:</b>
        <div style="border:1px solid #ddd; padding:8px; margin-top:8px;">
            <ol style="line-height:1.45; font-size:9.5pt; margin:0; padding-left:20px;">
                <li>Öğrencinin derse ilgisi, akademik başarısı ve motivasyonu</li>
                <li>Öğrencinin öğretmenleri ve arkadaşları ile ilişkisi</li>
                <li>Derste veya okul içinde kurallara uyma düzeyi</li>
                <li>Varsa gözlemlediğiniz olumlu/olumsuz belirgin davranışları</li>
                <li>Veli ile işbirliği düzeyi (varsa görüşmeleriniz)</li>
                <li>Öğrencinin gelişimi için önerileriniz</li>
            </ol>
        </div>
        <div class="signature-block avoid-break" style="margin-top:14px; text-align:center; font-size:9.5pt;">
             Tarih : ${formDateStr}<br>
             İmza : ........................<br><br>
             Adı Soyadı : ........................<br>
             Sınıf Rehber / Ders Öğretmeni
        </div>
        `;
    }
    else if (type === 'penalty_removal_call') {
        currentBody = `
        ${useHeader}
        <br>
        <div style="text-align:center; font-weight:bold; margin:15px 0;">CEZA SİLME GÖRÜŞMESİNE ÇAĞRI BELGESİ</div>
        <br>
        <p style="text-align:left;"><b>Sayın Veli (Adı Soyadı):</b> ........................................</p>
        <br>
        <p style="text-indent:30px; text-align:justify; line-height:1.6;">
            Velisi bulunduğunuz okulumuz <b>${s.grade}</b> sınıfı, <b>${s.number}</b> numaralı öğrencimiz <b>${s.name}</b> hakkında daha önce ${boardInfo.boardName} (${boardInfo.boardAbbr}) tarafından verilmiş olan yaptırım/ceza kararının, öğrencinin son dönemdeki olumlu tutum ve davranışları değerlendirilerek ${boardInfo.regulationRemovalSentence} gereğince dosyasından <b>silinmesi/kaldırılması</b> hususunun görüşüleceği Kurul Toplantısına katılmanızı önemle rica ederim.
        </p>
        <br>
        <table style="width:100%; border:none; line-height:1.8;">
            <tr>
                <td style="width:120px; font-weight:bold;">Toplantı Tarihi</td>
                <td>: ..../..../20....</td>
            </tr>
            <tr>
                <td style="font-weight:bold;">Toplantı Saati</td>
                <td>: .... : ....</td>
            </tr>
            <tr>
                <td style="font-weight:bold;">Toplantı Yeri</td>
                <td>: ........................................</td>
            </tr>
        </table>
        <br><br><br>
        <div style="text-align:right;">
             <b>${boardPresident}</b><br>
             ${boardInfo.boardPresidentLabel}
        </div>
        `;
    }
    else if (type === 'penalty_removal_decision') {
        currentBody = `
        ${useHeader}
        <br>
        <div style="text-align:center; font-weight:bold; margin:15px 0;">CEZA KALDIRMA / SİLME KURUL KARARI</div>
        <br>
        <table style="width:100%; border-collapse:collapse; border:1px solid #ccc; font-size:10pt;">
            <tr><td style="width:150px; font-weight:bold; padding:8px; border:1px solid #ccc;">Öğrenci Adı Soyadı</td><td style="padding:8px; border:1px solid #ccc;">${s.name}</td></tr>
            <tr><td style="font-weight:bold; padding:8px; border:1px solid #ccc;">Sınıfı / Numarası</td><td style="padding:8px; border:1px solid #ccc;">${s.grade} - ${s.number}</td></tr>
            <tr><td style="font-weight:bold; padding:8px; border:1px solid #ccc;">Verilmiş Olan Ceza</td><td style="padding:8px; border:1px solid #ccc;">...............................................................</td></tr>
            <tr><td style="font-weight:bold; padding:8px; border:1px solid #ccc;">Cezanın Verildiği Tarih</td><td style="padding:8px; border:1px solid #ccc;">.... / .... / 20....</td></tr>
        </table>
        <br>
        <p style="text-indent:30px; text-align:justify; line-height:1.6;">
            Yukarıda açık kimliği yazılı okulumuz öğrencisi <b>${s.name}</b> hakkında daha önceden verilmiş olan disiplin cezası, öğrencinin bu tarihten itibaren gösterdiği olumlu gelişim, okul kurallarına uyum sürecindeki pozitif katkısı ve rehberlik servisi/öğretmenlerinin olumlu görüşleri göz önünde bulundurularak; ${boardInfo.regulationRemovalSentence} hükmü gereğince ${boardInfo.boardName} kararıyla dosyasından silinmesine / kaldırılmasına; oy birliği / oy çokluğu ile karar verilmiştir.
        </p>
        <br>
        <table style="width:100%; border:none; margin-top:20px; text-align:center;">
             <tr>
                 <td style="padding:20px;"><b>Üye</b><br><br><br>Adı Soyadı<br>İmza</td>
                 <td style="padding:20px;"><b>Üye</b><br><br><br>Adı Soyadı<br>İmza</td>
                 <td style="padding:20px;"><b>Üye</b><br><br><br>Adı Soyadı<br>İmza</td>
             </tr>
             <tr>
                 <td style="padding:20px;"><b>Rehber Öğretmen</b><br><br><br>${institution.counselorName || 'Adı Soyadı'}<br>İmza</td>
                 <td style="padding:20px;"><b>Kurul Başkanı</b><br><br><br>${boardPresident}<br>İmza</td>
                 <td style="padding:20px;"><b>Okul Aile B. Temsilcisi</b><br><br><br>Adı Soyadı<br>İmza</td>
             </tr>
        </table>
        <div style="text-align:center; font-weight:bold; margin-top:30px;">
             U Y G U N D U R<br>
             ..../..../20....<br><br><br>
             Okul Müdürü<br>
             (Adı Soyadı - İmza)
        </div>
        `;
    }
    else if (type === 'opinion_counselor') {
        currentBody = `
        ${useHeader}
        <div style="display:flex; justify-content:space-between; font-size:9.5pt; margin-bottom:4px;">
             <div><b>Sayı</b> : ...<br><b>Konu</b> : Bilgi Talebi</div>
             <div>${formDateStr}</div>
        </div>
        <div style="text-align:center; font-weight:bold; margin:6px 0; font-size:10.5pt;">Psikolojik Danışman / Rehberlik Öğretmenine</div>
        <p style="text-indent:24px; text-align:justify; font-size:9.5pt; line-height:1.4; margin:4px 0;">
            ${boardInfo.boardLocative} görüşülmesi için gönderilen <b>${s.grade}</b> sınıfından <b>${s.name}</b> adlı öğrenciye ait dosya ile ilgili olarak adı geçen öğrenci ve velisiyle ilgili varsa görüşme tarih ve saatlerini ve öğrenci hakkındaki genel yorumlarınızı belirtmenizi rica ederim.
        </p>
        <div style="text-align:right; margin-top:8px; margin-bottom:8px; font-size:9.5pt;">
            <b>${boardPresident}</b><br>${boardInfo.boardPresidentLabel}
        </div>
        
        <b style="font-size:9.5pt;">NOT: Öğrenci hakkındaki görüşlerinizi şu başlıklarda sunabilirsiniz:</b>
        <div style="border:1px solid #ddd; padding:6px; margin-top:4px;">
            <ol style="line-height:1.4; font-size:9pt; margin:0; padding-left:18px;">
                <li>Öğrenci ile görüşme zamanları</li>
                <li>Veli ile görüşme zamanları</li>
                <li>Öğrencinin kişisel özellikleri</li>
                <li>Davranışın niteliği, önemi ve ne gibi şartlar altında yapıldığı</li>
                <li>Davranışın yapıldığı zamanki öğrencinin psikolojik durumu</li>
                <li>Öğrencinin okul içinde ve dışındaki genel durumu</li>
                <li>Öğrencinin derslerdeki ilgi ve başarısı</li>
                <li>Öğrencinin aynı öğretim yılı içinde daha önce ceza alıp almadığı</li>
                <li>Rehberlik servisinin görüş ve önerileri</li>
                <li>Diğer: ..........</li>
            </ol>
        </div>
        <div class="signature-block avoid-break" style="margin-top:10px; text-align:center; font-size:9.5pt;">
             Tarih : ${formDateStr}<br>
             İmza : ........................<br><br>
             Adı Soyadı : <b>${institution.counselorName || '........................'}</b><br>
             ${institution.counselorTitle || 'Psikolojik Danışman / Rehberlik Öğretmeni'}
        </div>
        `;
    }
    else if (type === 'witness_student') {
        currentBody = `
        ${useHeader}
        <div style="text-align:center; font-weight:bold; margin:6px 0; font-size:11pt;">GÖRGÜ TANIĞI İFADE İSTEMİ</div>
        <div style="text-align:right; font-size:9.5pt; margin-bottom:6px;"><b>Tarih / Saat:</b> ${formDateStr} - ${formTimeStr}</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #ddd; font-size:9.5pt;">
            <tr><td style="width:140px; font-weight:bold; padding:3px 6px; border-bottom:1px solid #eee;">Suçlanan Öğrenci</td><td style="border-bottom:1px solid #eee;"></td></tr>
            <tr><td style="padding:3px 6px; border-bottom:1px solid #eee;">Adı</td><td style="padding:3px 6px; border-bottom:1px solid #eee;">: ${s.name.split(' ')[0]}</td></tr>
            <tr><td style="padding:3px 6px; border-bottom:1px solid #eee;">Soyadı</td><td style="padding:3px 6px; border-bottom:1px solid #eee;">: ${s.name.split(' ').slice(1).join(' ')}</td></tr>
            <tr><td style="padding:3px 6px; border-bottom:1px solid #eee;">TC No</td><td style="padding:3px 6px; border-bottom:1px solid #eee;">: ${s.tc}</td></tr>
            <tr><td style="padding:3px 6px; border-bottom:1px solid #eee;">Sınıfı</td><td style="padding:3px 6px; border-bottom:1px solid #eee;">: ${s.grade}</td></tr>
            <tr><td style="padding:3px 6px; border-bottom:1px solid #eee;">Numarası</td><td style="padding:3px 6px; border-bottom:1px solid #eee;">: ${s.number}</td></tr>
            <tr><td style="padding:3px 6px; font-weight:bold; border-top:2px solid #ccc;">Olay / İddia</td><td style="padding:3px 6px; border-top:2px solid #ccc;">: ${i.title}</td></tr>
        </table>
        <table style="width:100%; border-collapse:collapse; border:1px solid #ccc; font-size:9.5pt; margin-top:6px;">
            <tr><td style="border:1px solid #ccc; padding:3px 6px; font-weight:bold; background-color:#f9f9f9;">Tanık Öğrenci / Öğrenciler</td></tr>
            <tr><td style="border:1px solid #ccc; padding:3px 6px; height:18px;">Tanık Öğrenci - 1 :</td></tr>
            <tr><td style="border:1px solid #ccc; padding:3px 6px; height:18px;">Tanık Öğrenci - 2 :</td></tr>
            <tr><td style="border:1px solid #ccc; padding:3px 6px; height:18px;">Tanık Öğrenci - 3 :</td></tr>
            <tr><td style="border:1px solid #ccc; padding:3px 6px; height:18px;">Tanık Öğrenci - 4 :</td></tr>
        </table>
        <p style="text-indent:24px; margin-top:6px; margin-bottom:4px; font-size:9.5pt; line-height:1.35;">Yukarıda açıkça bilgileri verilen öğrencimizin iddia edilen olumsuz davranışlarıyla ilgili olmak üzere konu hakkında kesin olarak gördüğünüz, bildiğiniz tüm bilgileri en baştan başlayarak ve ayrıntılı olarak aşağıya yazınız ve imzalayınız.</p>
        <div data-doc-field="statement" data-student-id="${targetStudentId || ''}" class="doc-editable-field doc-statement-box" style="border:1px solid black; min-height:90px; margin-top:6px; padding:6px 8px; font-size:9.5pt; line-height:1.35; white-space:pre-wrap; outline:none;" placeholder="Tanık öğrenci ifadesini buraya yazınız... (El yazısı için boş bırakabilirsiniz)">${(!effectivelyBlankMode && targetInvolvement?.studentStatement) ? targetInvolvement.studentStatement : ''}</div>
        <div class="signature-block avoid-break" style="margin-top:8px; text-align:right; font-size:9.5pt;">
             <b>Tarih:</b> ${formDateStr}<br><br>
             <b>İmza:</b> ........................................
        </div>
        `;
    }
    else if (type === 'student_statement_doc') {
        currentBody = `
        <div style="text-align:center; font-weight:bold; margin-bottom:0.4rem; font-size:11pt;">${boardInfo.boardNameUpper}<br>ÖĞRENCİ İFADE TUTANAĞI</div>
        
        <div style="margin-bottom:8px; font-size:10pt; line-height:1.35;">
            Sayın : <b>${s.name}</b><br>
            ${i.date || formDateStr} tarihinde aşağıda belirtilen konunun gerçekleştiği iddia edilmektedir. Konuyla ilgili ifadenizi, ayrıntılı bir şekilde yazmanızı rica ederim.<br>
            <div style="text-align:right; margin-top:4px;">
                ${formDateStr}<br>
                ${boardPresident}<br>
                ${boardInfo.boardPresidentLabel}
            </div>
        </div>
        
        <table style="width:100%; border-collapse:collapse; border:1px solid #ddd; font-size:9pt; line-height:1.4;">
            <tr>
                <td style="width:130px; font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Adı ve Soyadı</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: <b>${s.name}</b></td>
                <td style="width:110px; font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">T.C. Kimlik No</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: <b>${s.tc}</b></td>
            </tr>
            <tr>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Sınıfı / Numarası</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: ${s.grade} / ${s.number}</td>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Anne / Baba Adı</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: ${s.motherName} / ${s.fatherName}</td>
            </tr>
            <tr>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Doğum Yeri / Tarihi</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: ${s.dob}</td>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Nüfus Kaydı</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: ${s.province} / ${s.district} (Cilt: ${s.volumeNo} | Aile Sıra: <b>${s.familyOrderNo}</b> | Sıra: <b>${s.orderNo}</b>)</td>
            </tr>
            <tr>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Veli İletişim / Adres</td>
                <td colspan="3" style="padding:3px 6px; border:1px solid #ddd;">: ${s.parent} (${s.parentPhone}) - ${s.address}</td>
            </tr>
            <tr>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">İfadenin Konusu</td>
                <td colspan="3" style="padding:3px 6px; border:1px solid #ddd;">: ${i.title}</td>
            </tr>
        </table>
        <div style="font-size:10pt; font-weight:bold; margin-top:8px;">İfadenizi Yazmaya Buradan Başlayınız:</div>
        <div data-doc-field="statement" data-student-id="${targetStudentId || ''}" class="doc-editable-field doc-statement-box" style="border:1px dashed #93c5fd; background-color:#f8fafc; border-radius:4px; padding:8px 10px; line-height:1.6; min-height:100px; font-size:10pt; margin-top:4px; outline:none; white-space:pre-wrap;" placeholder="Öğrencinin ifadesini buraya yazınız... (El yazısı için boş bırakabilirsiniz)">${!effectivelyBlankMode && targetInvolvement?.studentStatement ? targetInvolvement.studentStatement : ''}</div>
        
        <table class="signature-block avoid-break" style="width:100%; margin-top:8px; font-size:9.5pt; text-align:center;">
            <tr>
                <td style="width:50%; text-decoration:underline; font-weight:bold;">Öğrencinin</td>
                <td style="width:50%; text-decoration:underline; font-weight:bold;">Rehber Öğretmenin</td>
            </tr>
            <tr>
                <td style="text-align:left; padding-top:6px;"><b>Tarih &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</b> ${formDateStr} - ${formTimeStr}</td>
                <td style="text-align:center; padding-top:6px;">${institution.counselorTitle || 'Psikolojik Danışman / Rehberlik Öğretmeni'}</td>
            </tr>
            <tr>
                <td style="text-align:left; padding-top:6px;"><b>İmzası &nbsp;&nbsp;&nbsp;&nbsp;:</b> ........................................</td>
                <td style="text-align:center; padding-top:6px;">........................................</td>
            </tr>
            <tr>
                <td style="text-align:left; padding-top:6px;"><b>Adı ve Soyadı:</b> ${s.name}</td>
                <td style="text-align:center; padding-top:6px;"><b>${institution.counselorName || '........................................'}</b></td>
            </tr>
        </table>
        `;
    }
    else if (type === 'student_defense_doc') {
        currentBody = `
        <div style="text-align:center; font-weight:bold; margin-bottom:0.5rem; font-size:11pt;">SAVUNMA TUTANAĞI</div>
        
        <table style="width:100%; border-collapse:collapse; border:1px solid #ddd; font-size:9pt; line-height:1.45;">
            <tr>
                <td style="width:130px; font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Tarih / Saat</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: ${formDateStr} - ${formTimeStr}</td>
                <td style="width:110px; font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Yer</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: ${i.location || 'Okul İdare Odası'}</td>
            </tr>
            <tr>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Adı ve Soyadı</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: <b>${s.name}</b></td>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">T.C. Kimlik No</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: <b>${s.tc}</b></td>
            </tr>
            <tr>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Sınıfı / Numarası</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: ${s.grade} / ${s.number}</td>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Anne / Baba Adı</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: ${s.motherName} / ${s.fatherName}</td>
            </tr>
            <tr>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Doğum Yeri / Tarihi</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: ${s.dob}</td>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Nüfus Kaydı</td>
                <td style="padding:3px 6px; border:1px solid #ddd;">: ${s.province} / ${s.district} (Cilt: ${s.volumeNo} | Aile Sıra: <b>${s.familyOrderNo}</b> | Sıra: <b>${s.orderNo}</b>)</td>
            </tr>
            <tr>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Veli & Adres</td>
                <td colspan="3" style="padding:3px 6px; border:1px solid #ddd;">: ${s.parent} (${s.parentPhone}) - ${s.address}</td>
            </tr>
            <tr>
                <td style="font-weight:bold; padding:3px 6px; border:1px solid #ddd; background:#f9f9f9;">Savunmanın Konusu</td>
                <td colspan="3" style="padding:3px 6px; border:1px solid #ddd;">: ${i.title}</td>
            </tr>
        </table>
        <div style="font-size:10pt; font-weight:bold; margin-top:8px;">Savunmanızı Yazmaya Buradan Başlayınız:</div>
        <div data-doc-field="defense" data-student-id="${targetStudentId || ''}" class="doc-editable-field doc-defense-box" style="border:1px dashed #93c5fd; background-color:#f8fafc; border-radius:4px; padding:8px 10px; line-height:1.6; min-height:100px; font-size:10pt; margin-top:4px; outline:none; white-space:pre-wrap;" placeholder="Öğrencinin savunma beyanlarını buraya yazınız... (El yazısı için boş bırakabilirsiniz)">${!effectivelyBlankMode && targetInvolvement?.studentDefense ? targetInvolvement.studentDefense : ''}</div>
        
        <div class="signature-block avoid-break" style="margin-top:8px; font-size:10pt; text-align:right;">
             <div style="display:inline-block; text-align:left;">
                 <b>Tarih &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</b> ${formDateStr}<br><br>
                 <b>İmza &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</b> ........................................<br><br>
                 <b>Adı ve Soyadı:</b> ${s.name}
             </div>
        </div>
        `;
    }
    else if (type === 'witness_teacher') {
        currentBody = `
        ${useHeader}
        <div style="text-align:center; font-weight:bold; margin:6px 0; font-size:11pt;">TANIK ÖĞRETMEN/ÖĞRETMENLERDEN İFADE İSTEMİ</div>
        <div style="text-align:right; font-size:9.5pt; margin-bottom:6px;"><b>Tarih:</b> ${formDateStr}</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #ddd; font-size:9.5pt;">
            <tr><td style="width:140px; font-weight:bold; padding:3px 6px; border-bottom:1px solid #eee;">Suçlanan Öğrenci</td><td style="border-bottom:1px solid #eee;"></td></tr>
            <tr><td style="padding:3px 6px; border-bottom:1px solid #eee;">Adı</td><td style="padding:3px 6px; border-bottom:1px solid #eee;">: ${s.name.split(' ')[0]}</td></tr>
            <tr><td style="padding:3px 6px; border-bottom:1px solid #eee;">Soyadı</td><td style="padding:3px 6px; border-bottom:1px solid #eee;">: ${s.name.split(' ').slice(1).join(' ')}</td></tr>
            <tr><td style="padding:3px 6px; border-bottom:1px solid #eee;">TC No</td><td style="padding:3px 6px; border-bottom:1px solid #eee;">: ${s.tc}</td></tr>
            <tr><td style="padding:3px 6px; border-bottom:1px solid #eee;">Sınıfı</td><td style="padding:3px 6px; border-bottom:1px solid #eee;">: ${s.grade}</td></tr>
            <tr><td style="padding:3px 6px; border-bottom:1px solid #eee;">Numarası</td><td style="padding:3px 6px; border-bottom:1px solid #eee;">: ${s.number}</td></tr>
            <tr><td style="padding:3px 6px; font-weight:bold; border-top:2px solid #ccc;">Olay / İddia</td><td style="padding:3px 6px; border-top:2px solid #ccc;">: ${i.title}</td></tr>
        </table>
        <table style="width:100%; border-collapse:collapse; border:1px solid #ccc; font-size:9.5pt; margin-top:6px;">
            <tr><td style="border:1px solid #ccc; padding:3px 6px; font-weight:bold; background-color:#f9f9f9;">Tanık Öğretmen / Öğretmenler</td></tr>
            <tr><td style="border:1px solid #ccc; padding:3px 6px; height:18px;">Tanık Öğretmen :</td></tr>
            <tr><td style="border:1px solid #ccc; padding:3px 6px; height:18px;">Tanık Öğretmen :</td></tr>
            <tr><td style="border:1px solid #ccc; padding:3px 6px; height:18px;">Tanık Öğretmen :</td></tr>
        </table>
        <p style="text-indent:24px; margin-top:6px; margin-bottom:4px; line-height:1.35; font-size:9.5pt;">Yukarıda açıkça bilgileri verilen öğrencimizin iddia edilen olumsuz davranışlarıyla ilgili bilgi, belge ve tutanakların, yaptığınız çalışmalar ve rehberlik faaliyetleri raporlarının ${boardInfo.boardDative} sevk edilmek üzere dosya halinde Müdürlüğümüze teslim edilmesini rica ederim.</p>
        <div style="border:1px solid black; min-height:80px; margin-top:6px; padding:6px; font-size:9pt; line-height:1.3;">
             <!-- Space for teacher's report -->
        </div>
        <div class="signature-block avoid-break" style="margin-top:8px; text-align:right; font-size:9.5pt;">
             <b>Tarih:</b> ${formDateStr}<br><br>
             <b>İmza:</b> ........................................
        </div>
        `;
    }
    else if (type === 'statement_request') {
        currentBody = `
        ${useHeader}
        <div style="text-align:center; font-weight:bold; margin-bottom:8px; font-size:11pt;">İFADE TALEBİ</div>
        <div style="text-align:right; font-size:9.5pt; margin-bottom:6px;"><b>Tarih:</b> ${formDateStr}</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #ddd; font-size:9.5pt;">
             <tr><td style="padding:3px 6px; width:140px; font-weight:bold;">Öğrencinin</td><td></td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Adı Soyadı</td><td style="padding:3px 6px; border:1px solid #ccc;">: <b>${s.name}</b></td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">TC Kimlik No</td><td style="padding:3px 6px; border:1px solid #ccc;">: <b>${s.tc}</b></td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Sınıfı / Numarası</td><td style="padding:3px 6px; border:1px solid #ccc;">: ${s.grade} / ${s.number}</td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Anne / Baba Adı</td><td style="padding:3px 6px; border:1px solid #ccc;">: ${s.motherName} / ${s.fatherName}</td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Nüfus Kaydı</td><td style="padding:3px 6px; border:1px solid #ccc;">: ${s.province} / ${s.district} (Cilt: ${s.volumeNo} | Aile Sıra No: <b>${s.familyOrderNo}</b> | Sıra No: <b>${s.orderNo}</b>)</td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Veli Adı & İletişim</td><td style="padding:3px 6px; border:1px solid #ccc;">: ${s.parent} (${s.parentPhone})</td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Velisinin Adresi</td><td style="padding:3px 6px; border:1px solid #ccc;">: ${s.address}</td></tr>
             <tr><td style="padding:3px 6px; font-weight:bold; border-top:2px solid #ccc;">İddia</td><td style="padding:3px 6px; border-top:2px solid #ccc;">: ${i.title}</td></tr>
        </table>
        <p style="margin-top:6px; margin-bottom:4px; text-indent:24px; line-height:1.35; font-size:9.5pt;">${boardInfo.boardDative} intikal eden dosyalarda size isnat edilen yukarıdaki suçlamalar ile ilgili yapacağınız tüm açıklama ve bilgileri içeren ifadenizi aşağıya yazarak imzalayınız.</p>
        <div data-doc-field="statement" data-student-id="${targetStudentId || ''}" class="doc-editable-field doc-statement-box" style="border:1px solid black; min-height:90px; padding:6px 8px; margin-top:6px; font-family:inherit; font-size:9.5pt; white-space:pre-wrap; line-height:1.35; outline:none;" placeholder="Öğrencinin ifadesini buraya yazınız... (El yazısı için boş bırakabilirsiniz)">${(!effectivelyBlankMode && targetInvolvement?.studentStatement) ? targetInvolvement.studentStatement : ''}</div>
        <div class="signature-block avoid-break" style="margin-top:8px; text-align:center; font-size:9.5pt;">
             Tarih : ${formDateStr}<br>
             İmza : ........................<br><br>
             Adı Soyadı : ${s.name}<br>
             ${s.grade} Sınıfının ${s.number} numaralı öğrencisi
        </div>
        `;
    }
    else if (type === 'defense_request') {
        currentBody = `
        ${useHeader}
        <div style="text-align:center; font-weight:bold; margin-bottom:8px; font-size:11pt;">SAVUNMA TALEBİ</div>
        <div style="text-align:right; font-size:9.5pt; margin-bottom:6px;"><b>Tarih:</b> ${formDateStr}</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid #ddd; font-size:9.5pt;">
             <tr><td style="padding:3px 6px; width:140px; font-weight:bold;">Öğrencinin</td><td></td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Adı Soyadı</td><td style="padding:3px 6px; border:1px solid #ccc;">: <b>${s.name}</b></td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">TC Kimlik No</td><td style="padding:3px 6px; border:1px solid #ccc;">: <b>${s.tc}</b></td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Sınıfı / Numarası</td><td style="padding:3px 6px; border:1px solid #ccc;">: ${s.grade} / ${s.number}</td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Anne / Baba Adı</td><td style="padding:3px 6px; border:1px solid #ccc;">: ${s.motherName} / ${s.fatherName}</td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Nüfus Kaydı</td><td style="padding:3px 6px; border:1px solid #ccc;">: ${s.province} / ${s.district} (Cilt: ${s.volumeNo} | Aile Sıra No: <b>${s.familyOrderNo}</b> | Sıra No: <b>${s.orderNo}</b>)</td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Veli Adı & İletişim</td><td style="padding:3px 6px; border:1px solid #ccc;">: ${s.parent} (${s.parentPhone})</td></tr>
             <tr><td style="padding:3px 6px; border:1px solid #ccc;">Velisinin Adresi</td><td style="padding:3px 6px; border:1px solid #ccc;">: ${s.address}</td></tr>
             <tr><td style="padding:3px 6px; font-weight:bold; border-top:2px solid #ccc;">Olay</td><td style="padding:3px 6px; border-top:2px solid #ccc;">: ${i.title}</td></tr>
        </table>
        <p style="margin-top:6px; margin-bottom:4px; text-indent:24px; line-height:1.35; font-size:9.5pt;">${boardInfo.boardDative} intikal eden dosyalarda size isnat edilen ve yukarıda açıkça belirtilen suçlamalar bulunmaktadır. Konuyla ilgili Savunmanızı aşağıya yazarak imzalayınız.</p>
        <div data-doc-field="defense" data-student-id="${targetStudentId || ''}" class="doc-editable-field doc-defense-box" style="border:1px solid black; min-height:90px; padding:6px 8px; margin-top:6px; font-family:inherit; font-size:9.5pt; white-space:pre-wrap; line-height:1.35; outline:none;" placeholder="Öğrencinin savunmasını buraya yazınız... (El yazısı için boş bırakabilirsiniz)">${(!effectivelyBlankMode && targetInvolvement?.studentDefense) ? targetInvolvement.studentDefense : ''}</div>
        <div class="signature-block avoid-break" style="margin-top:8px; text-align:center; font-size:9.5pt;">
             Tarih : ${formDateStr}<br>
             İmza : ........................<br><br>
             Adı Soyadı : ${s.name}<br>
             ${s.grade} Sınıfının ${s.number} numaralı öğrencisi
        </div>
        `;
    }
    else if (type === 'verbal_warning') {
        currentBody = `
        <div style="text-align:center; margin-bottom:0.3rem; font-size:11pt; font-weight:bold;">
            ${institution.name} Müdürlüğü
        </div>
        <div style="text-align:center; font-weight:bold; font-size:11pt; margin:4px 0;">ÖĞRENCİ SÖZLÜ UYARI TUTANAĞI</div>
        <div style="text-align:right; font-size:9.5pt; margin-bottom:6px;"><b>Tarih / Saat:</b> ${formDateStr} - ${formTimeStr}</div>
        <div style="font-weight:bold; font-size:10pt; margin-bottom:4px;">Öğrencinin;</div>
        <table style="width:100%; border:none; font-size:10pt; line-height:1.5;">
            <tr>
                <td style="font-weight:bold; text-decoration:underline; width:20%;">Adı ve Soyadı:</td>
                <td style="width:40%;">${s.name}</td>
                <td style="font-weight:bold; text-decoration:underline; width:10%;">Sınıfı</td>
                <td style="width:30%;">: ${s.grade}</td>
            </tr>
            <tr>
                <td style="font-weight:bold; text-decoration:underline;">Kimlik No:</td>
                <td>${s.tc}</td>
                <td style="font-weight:bold; text-decoration:underline;">Okul No</td>
                <td>: ${s.number}</td>
            </tr>
        </table>
        <p style="text-indent:24px; line-height:1.4; font-size:9.5pt; margin-top:6px; margin-bottom:6px; text-align:justify;">
            Yukarıda bilgileri bulunan okulumuz öğrencisi <b>${formDateStr}</b> tarihinde, saat <b>${formTimeStr}</b>'de olumsuz davranışta bulunmuştur (Davranışın çeşiti ve özelliği aşağıda belirtilmiştir). Öğrencilerden beklenen olumlu davranışlar anlatılarak, olumsuz davranışlarının devamı hâlinde kendisine uygulanabilecek yaptırımlar konusunda bilgi verilmiştir. İlgili öğrenci tarafımca sözlü olarak uyarılarak bu tutanak imza altına alınmıştır. <b>${formDateStr}</b>
        </p>
        <div style="font-size:10pt; font-weight:bold; margin-bottom:4px;">Olumsuz Davranışın Çeşiti ve Özelliği:</div>
        <div style="border:none; border-bottom:1px dotted #ccc; line-height:1.5; min-height:60px; font-size:9.5pt;">
            ${!effectivelyBlankMode && i.title ? i.title : '<br><br>'}
        </div>
        
        <table class="signature-block avoid-break" style="width:100%; margin-top:12px; font-size:10pt; text-align:center;">
            <tr>
                <td style="width:50%;"><b>${s.name}</b></td>
                <td style="width:50%;">...................................................</td>
            </tr>
            <tr>
                <td style="padding-top:4px;">Öğrenci</td>
                <td style="padding-top:4px;">Öğretmen</td>
            </tr>
        </table>
        `;
    }
    else if (type === 'contract') {
        currentBody = `
        <div style="text-align:center; font-weight:bold; font-size:11pt; margin:4px 0;">ÖĞRENCİ İLE İMZALANAN SÖZLEŞME</div>
        <div style="text-align:right; font-size:9.5pt; margin-bottom:6px;"><b>Tarih / Saat:</b> ${formDateStr} - ${formTimeStr}</div>
        <table style="width:100%; border:none; font-size:10pt; line-height:1.45;">
            <tr>
                <td style="width:25%; font-weight:bold; text-decoration:underline;">Öğrencinin</td>
                <td></td>
            </tr>
            <tr>
                <td style="font-weight:bold;">Adı ve Soyadı</td>
                <td>: ${s.name}</td>
            </tr>
            <tr>
                <td style="font-weight:bold;">Sınıfı ve Numarası</td>
                <td>: ${s.grade} - ${s.number}</td>
            </tr>
            <tr>
                <td style="font-weight:bold;">Okulu</td>
                <td>: ${institution.name} Müdürlüğü</td>
            </tr>
        </table>
        <p style="text-indent:24px; line-height:1.4; font-size:9.5pt; margin-top:6px; margin-bottom:6px; text-align:justify;">
            Ben <b>${s.name}</b>, <b>${formDateStr}</b> tarihinde saat <b>${formTimeStr}</b>'de, öğretmenim ................................................................ tarafından, hatalı davranışlarımdan dolayı sözlü olarak uyarıldım. Hatalı olduğumu anladım. Olumsuz davranışlarımın tekrarlanması durumunda uygulanabilecek yaptırımlar konusunda bilgilendirildim. <u><b>Aynı tür davranışları bir kez daha yapmayacağıma ve okulun kurallarına uyacağıma söz veriyorum.</b></u>
        </p>
        <div style="font-size:10pt; font-weight:bold; margin-top:4px;">Olayın Özeti: <span style="font-weight:normal;">(Öğrenci Tarafından Doldurulacaktır.)</span></div>
        <div style="border:none; border-bottom:1px dotted #ccc; line-height:1.5; min-height:60px; font-size:9.5pt; margin-top:4px;">
            ${!effectivelyBlankMode && i.title ? i.title : '<br><br>'}
        </div>
        
        <table class="signature-block avoid-break" style="width:100%; margin-top:10px; font-size:9.5pt; text-align:center;">
            <tr>
                <td style="width:50%; text-decoration:underline; font-weight:bold;">Öğrencinin</td>
                <td style="width:50%; text-decoration:underline; font-weight:bold;">Öğretmenin</td>
            </tr>
            <tr>
                <td style="text-align:left; padding-top:6px;"><b>İmzası &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:</b> ........................................</td>
                <td style="text-align:center; padding-top:6px;">........................................</td>
            </tr>
            <tr>
                <td style="text-align:left; padding-top:6px;"><b>Adı ve Soyadı:</b> ${s.name}</td>
                <td style="text-align:center; padding-top:6px;">........................................</td>
            </tr>
            <tr>
                <td style="text-align:left; padding-top:6px;"><b>Tarih:</b> ${formDateStr}</td>
                <td></td>
            </tr>
        </table>
        `;
    }
    else if (type === 'student_meeting') {
        currentBody = `
        <div style="text-align:center; font-weight:bold; font-size:10pt; line-height:1.3; border-bottom:2px solid #000; padding-bottom:4px; margin-bottom:8px;">
            T.C.<br>
            MİLLÎ EĞİTİM BAKANLIĞI<br>
            ÖZEL EĞİTİM VE REHBERLİK HİZMETLERİ GENEL MÜDÜRLÜĞÜ<br>
            <div style="font-size:11pt; font-weight:900; margin-top:4px; letter-spacing:0.5px;">ÖĞRENCİ GÖRÜŞME FORMU</div>
            <div style="font-size:8.5pt; font-weight:normal; color:#444;">(B.K.G.5.c)</div>
        </div>

        <table style="width:100%; border-collapse:collapse; border:1px solid black; font-size:9pt; margin-bottom:6px;">
            <tr>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; width:25%; background-color:#f8fafc;">Öğrencinin Adı Soyadı</td>
                <td style="padding:3px 6px; border:1px solid black; width:35%;"><b>${s.name}</b></td>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; width:20%; background-color:#f8fafc;">Görüşme Tarihi</td>
                <td style="padding:3px 6px; border:1px solid black; width:20%;"><b>${formDateStr}</b></td>
            </tr>
            <tr>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">Sınıfı / Şubesi</td>
                <td style="padding:3px 6px; border:1px solid black;">${s.grade}</td>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">Görüşme Saati</td>
                <td style="padding:3px 6px; border:1px solid black;"><b>${formTimeStr}</b></td>
            </tr>
            <tr>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">Okul Numarası</td>
                <td style="padding:3px 6px; border:1px solid black;">${s.number}</td>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">T.C. Kimlik No</td>
                <td style="padding:3px 6px; border:1px solid black;">${s.tc}</td>
            </tr>
            <tr>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">Görüşmeyi Talep Eden</td>
                <td colspan="3" style="padding:3px 6px; border:1px solid black;">
                    [ &nbsp; ] Öğrenci &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] Veli &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] Öğretmen &nbsp;&nbsp;&nbsp;&nbsp; [ <b>X</b> ] ${boardInfo.boardName} / İdare &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] Rehberlik Servisi
                </td>
            </tr>
        </table>

        <div style="margin-bottom:4px;">
            <div style="font-weight:bold; font-size:9pt; background-color:#f1f5f9; padding:2px 6px; border:1px solid black; border-bottom:none;">Görüşme Nedeni / Konusu:</div>
            <div style="border:1px solid black; min-height:36px; padding:4px 6px; font-size:9pt; line-height:1.35;">
                ${!effectivelyBlankMode && i.title ? `<b>${i.title}</b>: ${i.desc || 'Disiplin ve davranış değerlendirme süreci kapsamında öğrenci ile bireysel görüşme gerçekleştirilmiştir.'}` : 'Öğrencinin okul içi tutum ve davranışları, disiplin ihlali iddiaları ve sosyal uyumunun değerlendirilmesi.'}
            </div>
        </div>

        <div style="margin-bottom:4px;">
            <div style="font-weight:bold; font-size:9pt; background-color:#f1f5f9; padding:2px 6px; border:1px solid black; border-bottom:none;">Görüşme Özeti ve Öğrencinin İfadeleri:</div>
            <div data-doc-field="statement" data-student-id="${targetStudentId || ''}" class="doc-editable-field doc-statement-box" style="border:1px solid black; min-height:65px; padding:4px 6px; font-size:9pt; line-height:1.35; white-space:pre-wrap; outline:none;" placeholder="Görüşme özeti ve öğrencinin ifadelerini buraya yazınız...">${!effectivelyBlankMode && targetInvolvement?.studentStatement ? targetInvolvement.studentStatement : ''}</div>
        </div>

        <div style="margin-bottom:4px;">
            <div style="font-weight:bold; font-size:9pt; background-color:#f1f5f9; padding:2px 6px; border:1px solid black; border-bottom:none;">Alınan Kararlar ve Önerilen Çalışmalar:</div>
            <div style="border:1px solid black; min-height:44px; padding:4px 6px; font-size:9pt; line-height:1.3;">
                1. Öğrenci okul kuralları, hak ve sorumlulukları konusunda bilgilendirilmiştir.<br>
                2. Veli ile iş birliği yapılarak öğrencinin akademik ve davranışsal takibinin sağlanmasına karar verilmiştir.<br>
                3. Gerekli görüldüğü takdirde Rehberlik ve Psikolojik Danışma Servisi ile takip seansları planlanacaktır.
            </div>
        </div>

        <table class="signature-block avoid-break" style="width:100%; border:none; margin-top:8px; font-size:9.5pt; text-align:center;">
            <tr>
                <td style="width:50%;">
                    <b>Görüşülen Öğrenci</b><br>
                    <b>${s.name}</b><br><br>
                    İmza: ........................................
                </td>
                <td style="width:50%;">
                    <b>Görüşmeyi Yapan Yetkili / Rehberlik</b><br>
                    <b>${institution.counselorName || boardPresident}</b><br>
                    <span style="font-size:8pt; color:#444;">${institution.counselorName ? (institution.counselorTitle || 'Psikolojik Danışman / Rehberlik Öğretmeni') : boardInfo.boardPresidentLabel}</span><br>
                    İmza: ........................................
                </td>
            </tr>
        </table>
        `;
    }
    else if (type === 'parent_meeting') {
        currentBody = `
        <div style="text-align:center; font-weight:bold; font-size:10pt; line-height:1.3; border-bottom:2px solid #000; padding-bottom:4px; margin-bottom:8px;">
            T.C.<br>
            MİLLÎ EĞİTİM BAKANLIĞI<br>
            ÖZEL EĞİTİM VE REHBERLİK HİZMETLERİ GENEL MÜDÜRLÜĞÜ<br>
            <div style="font-size:11pt; font-weight:900; margin-top:4px; letter-spacing:0.5px;">VELİ GÖRÜŞME FORMU</div>
            <div style="font-size:8.5pt; font-weight:normal; color:#444;">(B.K.G.11.c)</div>
        </div>

        <table style="width:100%; border-collapse:collapse; border:1px solid black; font-size:9pt; margin-bottom:6px;">
            <tr>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; width:22%; background-color:#f8fafc;">Öğrencinin Adı Soyadı</td>
                <td style="padding:3px 6px; border:1px solid black; width:38%;"><b>${s.name}</b></td>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; width:20%; background-color:#f8fafc;">Görüşme Tarihi</td>
                <td style="padding:3px 6px; border:1px solid black; width:20%;"><b>${formDateStr}</b></td>
            </tr>
            <tr>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">Sınıfı / Şubesi / No</td>
                <td style="padding:3px 6px; border:1px solid black;">${s.grade} &nbsp;/&nbsp; No: <b>${s.number}</b></td>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">Görüşme Saati</td>
                <td style="padding:3px 6px; border:1px solid black;"><b>${formTimeStr}</b></td>
            </tr>
            <tr>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">Velinin Adı Soyadı</td>
                <td style="padding:3px 6px; border:1px solid black;"><b>${s.parent}</b></td>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">Yakınlık Derecesi</td>
                <td style="padding:3px 6px; border:1px solid black;">Anne / Baba / Vasi</td>
            </tr>
            <tr>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">İletişim / Telefon</td>
                <td style="padding:3px 6px; border:1px solid black;">${s.parentPhone}</td>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">T.C. Kimlik No</td>
                <td style="padding:3px 6px; border:1px solid black;">${s.tc}</td>
            </tr>
            <tr>
                <td style="padding:3px 6px; border:1px solid black; font-weight:bold; background-color:#f8fafc;">Görüşmeyi Talep Eden</td>
                <td colspan="3" style="padding:3px 6px; border:1px solid black;">
                    [ &nbsp; ] Veli &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] Öğretmen &nbsp;&nbsp;&nbsp;&nbsp; [ <b>X</b> ] ${boardInfo.boardName} / Okul İdaresi &nbsp;&nbsp;&nbsp;&nbsp; [ &nbsp; ] Rehberlik Servisi
                </td>
            </tr>
        </table>

        <div style="margin-bottom:4px;">
            <div style="font-weight:bold; font-size:9pt; background-color:#f1f5f9; padding:2px 6px; border:1px solid black; border-bottom:none;">Görüşme Nedeni / Gündem:</div>
            <div style="border:1px solid black; min-height:34px; padding:4px 6px; font-size:9pt; line-height:1.35;">
                ${!effectivelyBlankMode && i.title ? `<b>${i.title}</b>: Öğrencinin okul ortamındaki disiplin durumu, davranış gelişimi ve okul kurallarına uyumu hakkında veli bilgilendirmesi ve iş birliği görüşmesi.` : 'Öğrencinin okul içi genel durumu, devamsızlık/disiplin konuları ve veli bilgilendirmesi.'}
            </div>
        </div>

        <div style="margin-bottom:4px;">
            <div style="font-weight:bold; font-size:9pt; background-color:#f1f5f9; padding:2px 6px; border:1px solid black; border-bottom:none;">Görüşme Özeti ve Velinin Görüşleri:</div>
            <div style="border:1px solid black; min-height:60px; padding:4px 6px; font-size:9pt; line-height:1.35;">
                Veliye öğrencinin okul içi davranışları ve iddia edilen disiplin olayları hakkında detaylı bilgilendirme yapıldı. Velinin konu hakkındaki görüş ve beyanları dinlenerek karşılıklı fikir alışverişinde bulunuldu.
            </div>
        </div>

        <div style="margin-bottom:4px;">
            <div style="font-weight:bold; font-size:9pt; background-color:#f1f5f9; padding:2px 6px; border:1px solid black; border-bottom:none;">Alınan Kararlar ve İş Birliği Planı:</div>
            <div style="border:1px solid black; min-height:42px; padding:4px 6px; font-size:9pt; line-height:1.3;">
                1. Velinin ev ortamında öğrencinin günlük çalışma ve teknoloji kullanım düzenini yakından takip etmesi kararlaştırıldı.<br>
                2. Sınıf rehber öğretmeni ve okul rehberlik servisi ile periyodik iletişim sürdürülecektir.<br>
                3. Öğrencinin olumlu davranış geliştirmesi yönünde destekleyici ortak tutum sergilenmesi benimsendi.
            </div>
        </div>

        <table class="signature-block avoid-break" style="width:100%; border:none; margin-top:8px; font-size:9.5pt; text-align:center;">
            <tr>
                <td style="width:50%;">
                    <b>Öğrenci Velisi</b><br>
                    <b>${s.parent}</b><br><br>
                    İmza: ........................................
                </td>
                <td style="width:50%;">
                    <b>Görüşmeyi Yapan Yetkili / Rehberlik</b><br>
                    <b>${institution.counselorName || boardPresident}</b><br>
                    <span style="font-size:8pt; color:#444;">${institution.counselorName ? (institution.counselorTitle || 'Psikolojik Danışman / Rehberlik Öğretmeni') : boardInfo.boardPresidentLabel}</span><br>
                    İmza: ........................................
                </td>
            </tr>
        </table>
        `;
    }
    else if (type === 'parent_minute') {
        currentBody = `
        ${useHeader}
        <div style="display:flex; justify-content:space-between; font-size:9.5pt; margin-bottom:6px;">
             <div><b>Sayı</b> : ...<br><b>Konu</b> : Veli Görüşmesi</div>
             <div><b>Tarih / Saat:</b> ${formDateStr} - ${formTimeStr}</div>
        </div>
        <div style="text-align:center; font-weight:bold; font-size:11pt; margin-bottom:6px;">VELİ GÖRÜŞME TUTANAĞI</div>
        <table style="width:100%; border-collapse:collapse; border:1px solid black; font-size:9.5pt;">
            <tr>
                <td style="padding:4px 6px; border:1px solid black; font-weight:bold; width:25%; background-color:#f8fafc;">Öğrencinin</td>
                <td style="padding:4px 6px; border:1px solid black;"></td>
            </tr>
            <tr>
                <td style="padding:4px 6px; border:1px solid black;">Adı ve Soyadı</td>
                <td style="padding:4px 6px; border:1px solid black;">: <b>${s.name}</b></td>
            </tr>
            <tr>
                <td style="padding:4px 6px; border:1px solid black;">TC Kimlik No</td>
                <td style="padding:4px 6px; border:1px solid black;">: ${s.tc}</td>
            </tr>
            <tr>
                <td style="padding:4px 6px; border:1px solid black;">Sınıfı / Numarası</td>
                <td style="padding:4px 6px; border:1px solid black;">: ${s.grade} / <b>${s.number}</b></td>
            </tr>
            <tr>
                <td style="padding:4px 6px; border:1px solid black;">Velisinin Adı Soyadı</td>
                <td style="padding:4px 6px; border:1px solid black;">: <b>${s.parent}</b></td>
            </tr>
            <tr>
                <td style="padding:4px 6px; border:1px solid black;">İletişim Telefonu</td>
                <td style="padding:4px 6px; border:1px solid black;">: ${s.parentPhone}</td>
            </tr>
        </table>
        <p style="text-align:justify; line-height:1.4; font-size:9.5pt; text-indent:20px; margin-top:6px; margin-bottom:6px;">
            Yukarıda açık kimliği bulunan öğrencim <b>${s.name}</b> tarafından gerçekleştirilen olumsuz davranışlar (<b>${i.title}</b>) ile ilgili olarak <b>${formDateStr}</b> tarihinde, saat <b>${formTimeStr}</b>'de, ${boardInfo.presidentTitle} / ${boardInfo.boardPresidentLabel} <b>${boardPresident}</b> nezaretinde konu hakkında ve öğrencimin olumsuz davranışlarının devam etmesi durumunda mevzuat hükümleri doğrultusunda uygulanabilecek disiplin işlemleri konusunda detaylı olarak bilgilendirildim.
        </p>
        <div style="border:1px solid black; padding:6px; min-height:50px; font-size:9.5pt;">
             <b>Velinin Görüşü / Açıklaması:</b><br>
             ....................................................................................................................................................................
        </div>
        <div class="signature-block avoid-break" style="display:flex; justify-content:space-between; text-align:center; font-size:9.5pt; margin-top:10px;">
             <div style="border-top:1px solid black; padding-top:4px; width:40%;">
                <b>${s.parent}</b><br>
                Öğrenci Velisi<br><br>
                İmza: .................................
            </div>
            <div style="border-top:1px solid black; padding-top:4px; width:40%;">
                <b>${boardPresident}</b><br>
                ${boardInfo.boardPresidentLabel}<br><br>
                İmza: .................................
            </div>
        </div>
        `;
    }

    const actualStudentName = s.name && !s.name.includes('..') ? s.name : '';
    const docObj = {
        header: '',
        body: currentBody,
        type,
        studentName: actualStudentName,
        studentId: targetStudentId || ''
    };

    if (returnOnly) {
        return docObj;
    }

    setGeneratedDocs([docObj]);
  };

  return (
    <div className="flex flex-col min-h-screen lg:h-screen bg-[#f3f4f6]">
      <style dangerouslySetInnerHTML={{ __html: cssFitPage }} />
      {/* HEADER ACTIONS */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 sm:py-5 shadow-sm z-10 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-xl font-bold text-slate-500">Süreç Yönetimi</h1>
            <ChevronRight className="w-4 sm:w-5 h-4 sm:h-5 text-slate-300" />
            <h2 className="text-base sm:text-xl font-bold text-blue-700">{getSectionTitle()}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
                {/* Sayfa Düzeni (Kenar Boşlukları & Tek Sayfaya Sığdırma) Açılır Menüsü */}
                <div className="relative">
                    <button 
                        onClick={() => setShowMarginMenu(!showMarginMenu)} 
                        className={`text-sm px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-2 border shadow-xs ${
                            fitToPage || marginPreset !== 'normal'
                            ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100 ring-1 ring-blue-200'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                        title="Sayfa Düzeni: Kenar boşlukları ve tek sayfaya sığdırma ayarları"
                    >
                        <Layout className="w-4 h-4 text-blue-600" />
                        <span className="hidden sm:inline">Sayfa Düzeni:</span>
                        <span className="font-extrabold text-blue-700">{activeMargin.badge}</span>
                        {fitToPage && (
                            <span className="text-[10px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
                                <Minimize2 className="w-2.5 h-2.5" /> Tek Sayfa
                            </span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showMarginMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showMarginMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMarginMenu(false)} />
                            <div className="absolute right-0 top-full mt-1.5 w-84 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2.5 animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-3 py-2 border-b border-slate-100 mb-2">
                                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <Sliders className="w-3.5 h-3.5 text-blue-600" />
                                        Sayfa & Kenar Ayarları
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        Resmi evrakın sayfa yerleşimi ve kenar boşluklarını yapılandırın.
                                    </p>
                                </div>

                                {/* 1. ÖZELLİK: Tek Sayfaya Sığdır */}
                                <div 
                                    onClick={toggleFitToPage}
                                    className={`cursor-pointer p-2.5 rounded-lg border transition-all flex items-center justify-between gap-3 mb-2.5 ${
                                        fitToPage 
                                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs' 
                                            : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100/80 text-slate-700'
                                    }`}
                                    title="Tıklayarak tek sayfaya sığdırmayı açıp kapatın"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                                            fitToPage ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                                        }`}>
                                            <Minimize2 className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold flex items-center gap-1.5">
                                                <span>Tek Sayfaya Sığdır</span>
                                                {fitToPage ? (
                                                    <span className="text-[9px] bg-emerald-200/80 text-emerald-800 px-1.5 py-0.5 rounded font-extrabold">Açık</span>
                                                ) : (
                                                    <span className="text-[9px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium">Kapalı</span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
                                                İmza ve tablonun 2. sayfaya taşmasını önler
                                            </p>
                                        </div>
                                    </div>
                                    <div className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-in-out p-0.5 ${
                                        fitToPage ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                                    }`}>
                                        <span className="inline-block h-4 w-4 transform rounded-full bg-white shadow-sm" />
                                    </div>
                                </div>

                                {/* 2. ÖZELLİK: Kenar Boşlukları Standardı */}
                                <div className="px-2 pt-1 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <Layout className="w-3 h-3 text-blue-600" />
                                    <span>Kenar Boşluğu Standardı</span>
                                </div>
                                <div className="space-y-1">
                                    {Object.values(PAGE_MARGINS).map((preset) => (
                                        <button
                                            key={preset.id}
                                            onClick={() => handleSelectMargin(preset.id)}
                                            className={`w-full text-left p-2 rounded-lg transition-colors flex items-start justify-between gap-2 text-xs ${
                                                marginPreset === preset.id 
                                                    ? 'bg-blue-50 text-blue-900 font-bold border border-blue-200 shadow-2xs' 
                                                    : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    <span>{preset.name}</span>
                                                    {preset.id === 'normal' && (
                                                        <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-semibold">Word Standart</span>
                                                    )}
                                                    {preset.id === 'official' && (
                                                        <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-semibold">MEB Kuralı</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-normal mt-0.5 leading-snug">{preset.description}</div>
                                            </div>
                                            {marginPreset === preset.id && <Check className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                <button 
                    onClick={() => setIsBlankMode(!isBlankMode)} 
                    className={`text-sm px-3 py-1.5 rounded-lg font-bold transition-all flex items-center justify-center gap-1 border ${isBlankMode ? 'bg-orange-100 text-orange-700 border-orange-200' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                >
                    {isBlankMode ? 'Boş Şablon Kapat' : 'Boş Şablon Aç'}
                </button>
                <button 
                  onClick={handleDownloadWord}
                  className="text-sm bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Evrakı gerçek Microsoft Word (.docx) formatında indirir"
                >
                  <FileText className="w-4 h-4 text-indigo-600" />
                  Word (.docx) İndir
                </button>
                <button 
                  onClick={handleDownloadPdf}
                  disabled={isPdfGenerating}
                  className="text-sm bg-blue-50 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-2 disabled:opacity-50 transition-colors"
                >
                  {isPdfGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  PDF İndir
                </button>
                <button onClick={handlePrint} className="text-sm bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50 flex items-center gap-2">
                    <Printer className="w-4 h-4" /> Yazdır
                </button>
        </div>
      </div>

      {/* İÇ SEKME GEÇİŞİ (MOBİL VE MASAÜSTÜ İÇİN HIZLI GEÇİŞ ÇUBUĞU) */}
      <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center gap-2 overflow-x-auto shrink-0 shadow-inner custom-scrollbar">
        <button
          type="button"
          onClick={() => { setActiveTab('analysis'); setSearchParams({ tab: 'analysis' }); setMobileViewMode('form'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'analysis' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          <span>1. AI Analiz</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('meeting'); setSearchParams({ tab: 'meeting' }); setMobileViewMode('form'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'meeting' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>2. Toplantı Yönetimi</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('forms'); setSearchParams({ tab: 'forms' }); setMobileViewMode('form'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'forms' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>3. Tutanak &amp; Formlar</span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('decision'); setSearchParams({ tab: 'decision' }); setMobileViewMode('form'); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'decision' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
          }`}
        >
          <Scale className="w-3.5 h-3.5" />
          <span>4. Karar ve Tebligat</span>
        </button>
      </div>

      {/* MOBİL GÖRÜNÜM GEÇİŞİ: FORM vs ÖN İZLEME (Sadece Mobilde Görünür) */}
      <div className="lg:hidden bg-white p-2 border-b border-slate-200 flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setMobileViewMode('form')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            mobileViewMode === 'form' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <PenTool className="w-4 h-4" />
          <span>Form &amp; Seçimler</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileViewMode('preview')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
            mobileViewMode === 'preview' 
              ? 'bg-blue-600 text-white shadow-sm' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Evrak Ön İzleme {generatedDocs.length > 0 ? `(${generatedDocs.length})` : ''}</span>
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        
        {/* --- TAB 1: AI ANALYSIS --- */}
        {activeTab === 'analysis' && (
             <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                <div className={`w-full lg:w-1/3 ${mobileViewMode === 'form' ? 'block' : 'hidden lg:block'} bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 sm:p-6 overflow-y-auto`}>
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg mb-6 flex gap-3">
                        <Bot className="w-6 h-6 text-indigo-600 shrink-0" />
                        <p className="text-xs text-indigo-800">Yapay zeka asistanı, seçilen olay ve öğrenci için disiplin maddelerini analiz eder.</p>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Olay Seçiniz</label>
                            <select value={selectedIncidentId} onChange={e => { setSelectedIncidentId(e.target.value); }} className="w-full p-2.5 border rounded-lg bg-slate-50 outline-none text-sm">
                                <option value="">-- Listeden Seç --</option>
                                {incidents.map(inc => <option key={inc.id} value={inc.id}>{inc.code} - {inc.title}</option>)}
                            </select>
                        </div>
                        {selectedIncident && (
                            <div className="flex flex-col gap-1.5">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">İlgili Öğrenciler (Birden Çok Seçilebilir)</label>
                                <div className="border rounded-lg max-h-56 overflow-y-auto bg-slate-50">
                                    <div className="p-2 bg-slate-100 border-b flex items-center justify-between sticky top-0 z-10">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Öğrenci Seçimi</span>
                                        <button onClick={selectAllStudents} className="text-[10px] text-indigo-600 hover:underline font-bold">
                                            {selectedStudentIds.length === incidentStudents.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                                        </button>
                                    </div>
                                    {incidentStudents.map((s) => (
                                        <div key={s.id} onClick={() => toggleStudentSelection(s.id)} className={`p-2.5 border-b cursor-pointer hover:bg-white flex items-center gap-2.5 transition-colors ${selectedStudentIds.includes(s.id) ? 'bg-indigo-50/70 font-semibold' : ''}`}>
                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${selectedStudentIds.includes(s.id) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                                                {selectedStudentIds.includes(s.id) && <Check className="w-2.5 h-2.5 text-white" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-xs text-slate-800 truncate">{s.name}</div>
                                                <div className="text-[10px] text-slate-500 flex gap-2">
                                                    <span>No: {s.number}</span>
                                                    <span>•</span>
                                                    <span>{s.role === 'suspect' ? 'Fail' : s.role === 'witness' ? 'Tanık' : 'Mağdur'}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {incidentStudents.length === 0 && (
                                        <div className="text-center text-slate-400 text-xs py-4">Bu olaya eklenmiş öğrenci bulunmamaktadır.</div>
                                    )}
                                </div>
                            </div>
                        )}
                        <button 
                            onClick={handleAnalyze} 
                            disabled={loading || selectedStudentIds.length === 0} 
                            className={`w-full text-white py-2.5 rounded-lg flex justify-center items-center gap-2 font-semibold text-sm shadow-sm transition-colors ${
                                loading 
                                ? 'bg-slate-400 cursor-not-allowed' 
                                : aiResult 
                                ? 'bg-orange-500 hover:bg-orange-600' 
                                : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {loading ? <Loader2 className="w-4.5 h-4.5 animate-spin" /> : 'Analiz Başlat'}
                        </button>
                    </div>
                </div>
                <div className={`w-full lg:flex-1 ${mobileViewMode === 'preview' ? 'flex' : 'hidden lg:flex'} bg-slate-50 p-2 sm:p-8 overflow-y-auto flex-col items-center`}>
                    {renderDocumentPreview()}
                </div>
             </div>
        )}

        {/* --- TAB 2: MEETING --- */}
        {activeTab === 'meeting' && (
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                <div className={`w-full lg:w-1/3 ${mobileViewMode === 'form' ? 'block' : 'hidden lg:block'} bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 sm:p-6 overflow-y-auto`}>
                    
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Olay Seçimi (Çağrı İçin)</label>
                        <select value={selectedIncidentId} onChange={e => { setSelectedIncidentId(e.target.value); }} className="w-full p-2.5 border rounded-lg bg-slate-50 outline-none text-sm">
                            <option value="">-- Olay Seç --</option>
                            {incidents.map(inc => <option key={inc.id} value={inc.id}>{inc.code} - {inc.title}</option>)}
                        </select>
                    </div>

                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-blue-600" /> Toplantı Bilgileri
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Toplantı Tarihi</label>
                            <input type="date" value={meetingData.date} onChange={e => setMeetingData({...meetingData, date: e.target.value})} className="w-full p-2 border rounded text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Toplantı Saati</label>
                            <input type="time" value={meetingData.time} onChange={e => setMeetingData({...meetingData, time: e.target.value})} className="w-full p-2 border rounded text-sm" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Toplantı Yeri</label>
                            <input type="text" value={meetingData.location} onChange={e => setMeetingData({...meetingData, location: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Toplantı Yeri" />
                        </div>

                        {/* NEW UPDATE BUTTON */}
                        <button 
                            onClick={() => {
                                if (window.confirm('Toplantı tarihi ve saati evraka işlenecektir. Onaylıyor musunuz?')) {
                                    generateTemplate('ek1_meeting');
                                }
                            }}
                            className="w-full mt-2 bg-indigo-50 text-indigo-700 border border-indigo-200 p-2.5 rounded-lg flex items-center justify-center gap-2 text-xs font-bold hover:bg-indigo-100 transition-colors"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Bilgileri Çağrı Yazısına İşle (Güncelle)
                        </button>
                    </div>
                </div>
                <div className={`w-full lg:flex-1 ${mobileViewMode === 'preview' ? 'flex' : 'hidden lg:flex'} flex-col bg-slate-50/50 overflow-y-auto`}>
                     <div className="p-4 bg-white border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 shadow-2xs">
                         <button 
                             onClick={() => generateTemplate('ek1_meeting')} 
                             className="flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                         >
                             <List className="w-4 h-4" /> Kurul Çağrı Yazısı (Genel)
                         </button>
                         <button 
                             onClick={() => {
                                 const targets = summonsSelectedStudentIds.length > 0 
                                     ? summonsSelectedStudentIds 
                                     : incidentStudents.map(s => s.id);
                                 if (targets.length === 0) {
                                     alert('Lütfen önce çağrı pusulası oluşturulacak en az bir öğrenci seçiniz.');
                                     return;
                                 }
                                 generateBulkDocuments('student_summons', targets);
                                 window.scrollTo({ top: 0, behavior: 'smooth' });
                             }} 
                             disabled={incidentStudents.length === 0}
                             className="flex items-center justify-center gap-2 p-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-colors shadow-xs disabled:bg-slate-200 disabled:text-slate-400 cursor-pointer"
                         >
                             <Mail className="w-4 h-4" /> Öğrenci Çağrı Pusulaları (Toplu - {summonsSelectedStudentIds.length > 0 ? summonsSelectedStudentIds.length : incidentStudents.length} Öğrenci)
                         </button>
                     </div>

                     <div className="flex-1 p-8 overflow-y-auto flex flex-col items-center">
                        {renderDocumentPreview()}
                        
                        {/* Student Summons List Area with Multi-Select */}
                        {selectedIncident && (
                            <div className="w-full max-w-[210mm] mt-8 bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm print:hidden">
                                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-indigo-50 text-indigo-700 rounded-xl">
                                            <Mail className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-800 text-base leading-tight">
                                                Öğrenci Çağrı Pusulaları
                                            </h4>
                                            <p className="text-xs text-slate-500">
                                                Seçilen öğrenciler için resmi tebliğ/tebellüğ çağrı pusulaları her biri için ayrı ayrı hazırlanır.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (summonsSelectedStudentIds.length === incidentStudents.length) {
                                                    setSummonsSelectedStudentIds([]);
                                                } else {
                                                    setSummonsSelectedStudentIds(incidentStudents.map(s => s.id));
                                                }
                                            }}
                                            className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline px-2.5 py-1 cursor-pointer"
                                        >
                                            {summonsSelectedStudentIds.length === incidentStudents.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const targets = summonsSelectedStudentIds.length > 0 
                                                    ? summonsSelectedStudentIds 
                                                    : incidentStudents.map(s => s.id);
                                                if (targets.length === 0) {
                                                    alert('Lütfen en az bir öğrenci seçiniz.');
                                                    return;
                                                }
                                                generateBulkDocuments('student_summons', targets);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }}
                                            disabled={incidentStudents.length === 0}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400"
                                        >
                                            <FileText className="w-3.5 h-3.5" />
                                            <span>Seçilenler İçin Toplu Pusula Oluştur ({summonsSelectedStudentIds.length > 0 ? summonsSelectedStudentIds.length : incidentStudents.length})</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2">
                                    {incidentStudents.map((s) => {
                                        const isChecked = summonsSelectedStudentIds.includes(s.id);
                                        return (
                                            <div 
                                                key={s.id} 
                                                onClick={() => {
                                                    setSummonsSelectedStudentIds(prev => 
                                                        prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                                                    );
                                                }}
                                                className={`flex justify-between items-center p-3 border rounded-xl transition-all cursor-pointer ${
                                                    isChecked 
                                                        ? 'bg-indigo-50/70 border-indigo-300 shadow-2xs font-semibold' 
                                                        : 'hover:bg-slate-50 border-slate-200'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                                                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-bold text-sm text-slate-800 truncate">{s.name}</div>
                                                        <div className="text-xs flex items-center gap-2 mt-0.5 text-slate-500">
                                                            <span>No: <b>{s.number}</b></span>
                                                            <span>•</span>
                                                            <span>Sınıf: <b>{s.grade}</b></span>
                                                            <span>•</span>
                                                            <span className={`px-2 py-0.2 rounded-full text-[10px] uppercase font-bold border ${s.role === 'suspect' ? 'bg-red-50 text-red-700 border-red-200' : s.role === 'witness' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                                                {s.role === 'suspect' ? 'Fail (Savunma İstenecek)' : s.role === 'witness' ? 'Tanık (İfadesine Başvurulacak)' : 'Mağdur (Bilgisine Başvurulacak)'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        generateBulkDocuments('student_summons', [s.id]);
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    className="text-xs bg-white border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors font-medium shadow-2xs shrink-0 cursor-pointer"
                                                >
                                                    Tekil Ön İzle
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {incidentStudents.length === 0 && (
                                        <div className="text-center text-slate-400 text-sm py-6">Bu olaya eklenmiş öğrenci bulunmamaktadır.</div>
                                    )}
                                </div>
                            </div>
                        )}
                     </div>
                </div>
            </div>
        )}

        {/* --- TAB 3: FORMS --- */}
        {activeTab === 'forms' && (
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                <div className={`w-full lg:w-1/3 ${mobileViewMode === 'form' ? 'flex' : 'hidden lg:flex'} bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 sm:p-6 flex-col overflow-y-auto`}>
                    {/* Tarih ve Saat Seçimi Bölümü */}
                    <div className="mb-5 bg-gradient-to-br from-blue-50/70 to-indigo-50/50 border border-blue-200/80 rounded-xl p-3.5 shadow-2xs">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold text-slate-700 uppercase flex items-center gap-1.5">
                                <Calendar className="w-4 h-4 text-blue-600" />
                                Tutanak & Form Tarih ve Saati
                            </label>
                            <button
                                type="button"
                                onClick={() => {
                                    const now = new Date();
                                    const d = now.toISOString().split('T')[0];
                                    const t = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                    setFormDateTime({ date: d, time: t });
                                }}
                                className="text-[10px] text-blue-700 hover:text-blue-900 font-semibold underline"
                            >
                                Şimdiye Ayarla
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Evrak Tarihi</label>
                                <input 
                                    type="date" 
                                    value={formDateTime.date} 
                                    onChange={(e) => setFormDateTime(prev => ({ ...prev, date: e.target.value }))}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium" 
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1 flex items-center gap-1">
                                    <Clock className="w-3 h-3 text-slate-400" />
                                    Evrak Saati
                                </label>
                                <input 
                                    type="time" 
                                    value={formDateTime.time} 
                                    onChange={(e) => setFormDateTime(prev => ({ ...prev, time: e.target.value }))}
                                    className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none font-medium" 
                                />
                            </div>
                        </div>
                        <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span>Seçilen tarih ({formDateTime.date.split('-').reverse().join('.')}) ve saat ({formDateTime.time}) formlara canlı olarak işlenir.</span>
                        </div>
                    </div>

                    {/* Olay Seçimi */}
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Olay Seçiniz (İsteğe Bağlı)</label>
                        <select 
                            value={selectedIncidentId} 
                            onChange={e => { 
                                setSelectedIncidentId(e.target.value); 
                                setSelectedStudentId(''); 
                                setSelectedStudentIds([]);
                            }} 
                            className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-slate-50 outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            <option value="">-- Olay Seçilmedi (Boş Form veya Genel Öğrenci) --</option>
                            {incidents.map(inc => <option key={inc.id} value={inc.id}>{inc.code ? `${inc.code} - ` : ''}{inc.title}</option>)}
                        </select>
                    </div>

                    {/* Öğrenci Seçimi (Olaylı veya Genel) */}
                    <div className="flex-1 flex flex-col min-h-48 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50 mb-3 shadow-2xs">
                        <div className="p-2.5 bg-slate-100/80 border-b flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-700 uppercase">
                                {selectedIncident ? 'Olaya Karışan Öğrenciler' : 'Öğrenci Seçimi (Kayıtlı Öğrenciler)'}
                            </span>
                            <button 
                                onClick={selectAllStudents} 
                                className="text-[10px] text-blue-600 hover:text-blue-800 hover:underline font-bold"
                            >
                                {(selectedIncident ? incidentStudents : students).length > 0 && selectedStudentIds.length === (selectedIncident ? incidentStudents : students).length 
                                    ? 'Tümünü Kaldır' 
                                    : 'Tümünü Seç'}
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-1.5 space-y-1 max-h-64">
                            {(selectedIncident ? incidentStudents : students).map((s) => {
                                const isChecked = selectedStudentIds.includes(s.id);
                                const isSelected = selectedStudentId === s.id;
                                return (
                                    <div 
                                        key={s.id} 
                                        onClick={() => {
                                            setSelectedStudentId(s.id);
                                            setSelectedStudentIds([s.id]);
                                        }} 
                                        className={`p-2.5 rounded-lg border cursor-pointer hover:bg-white flex items-center gap-2.5 text-xs transition-all ${
                                            isSelected 
                                                ? 'bg-blue-50/90 border-blue-400 font-semibold shadow-2xs' 
                                                : isChecked 
                                                    ? 'bg-blue-50/40 border-blue-200' 
                                                    : 'border-transparent hover:border-slate-200'
                                        }`}
                                    >
                                        <div 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleStudentSelection(s.id);
                                            }}
                                            title="Toplu evrak hazırlamak için çoklu seç"
                                            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${isChecked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 hover:border-blue-400'}`}
                                        >
                                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-800 truncate">{s.name}</div>
                                            <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                                <span>{s.grade}</span>
                                                <span>•</span>
                                                <span>No: {s.number}</span>
                                                {s.tc && <><span>•</span><span>TC: {s.tc}</span></>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            {(selectedIncident ? incidentStudents : students).length === 0 && (
                                <div className="text-center text-slate-400 text-xs py-6">
                                    {selectedIncident ? 'Bu olaya kayıtlı öğrenci bulunmamaktadır.' : 'Kayıtlı öğrenci bulunamadı.'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Seçilen Öğrenci Künye ve Canlı Düzenleme Rehber Alanı */}
                    {selectedStudentId && (
                        (() => {
                            const curStud = (selectedIncident ? incidentStudents : students).find(s => s.id === selectedStudentId);
                            if (!curStud) return null;
                            return (
                                <div className="space-y-3 shrink-0">
                                    {renderStudentKunyePanel(curStud)}
                                    <div className="p-3 bg-gradient-to-br from-blue-50/90 to-indigo-50/70 border border-blue-200/80 rounded-xl space-y-1.5 shadow-2xs">
                                        <div className="flex items-center gap-1.5 font-bold text-[11px] text-blue-950 tracking-wide">
                                            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                            <span>Canlı Belge Üzerinde Düzenleme</span>
                                        </div>
                                        <p className="text-[10.5px] text-slate-600 leading-relaxed">
                                            {curStud.name} için ifade veya savunmayı sağdaki <b>A4 Ön İzleme Penceresinde</b> doğrudan belgenin üzerine tıklayarak yazabilirsiniz. Yazdıklarınız otomatik olarak algılanıp kaydedilir.
                                        </p>
                                    </div>
                                </div>
                            );
                        })()
                    )}
                </div>

                <div className={`w-full lg:flex-1 ${mobileViewMode === 'preview' ? 'flex' : 'hidden lg:flex'} flex-col bg-slate-50/50 overflow-y-auto`}>
                    {/* Üst Form Seçim Butonları Paneli */}
                    <div className="p-3.5 bg-white border-b border-slate-200 overflow-x-auto shadow-2xs">
                        <div className="space-y-2">
                            {/* MEB Resmi Rehberlik ve Görüşme Formları */}
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                    <span>Resmi MEB Görüşme & Rehberlik Formları</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <button 
                                        onClick={() => generateBulkDocuments('student_meeting')} 
                                        className={`px-3 py-1.5 border rounded-lg text-xs flex items-center gap-1.5 font-medium transition-all ${
                                            lastGeneratedFormType === 'student_meeting' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <Users className="w-3.5 h-3.5 text-blue-500" />
                                        <span>Öğrenci Görüşme Formu (B.K.G.5.c)</span>
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('parent_meeting')} 
                                        className={`px-3 py-1.5 border rounded-lg text-xs flex items-center gap-1.5 font-medium transition-all ${
                                            lastGeneratedFormType === 'parent_meeting' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                                        <span>Veli Görüşme Formu (B.K.G.11.c)</span>
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('parent_minute')} 
                                        className={`px-3 py-1.5 border rounded-lg text-xs flex items-center gap-1.5 font-medium transition-all ${
                                            lastGeneratedFormType === 'parent_minute' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Veli Görüşme Tutanağı</span>
                                    </button>
                                </div>
                            </div>

                            {/* İfade ve Savunma Belgeleri */}
                            <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                                    <span>İfade & Savunma Belgeleri</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <button 
                                        onClick={() => generateBulkDocuments('student_summons')} 
                                        className={`px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 font-medium transition-all ${
                                            lastGeneratedFormType === 'student_summons' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <Mail className="w-3.5 h-3.5 text-blue-500"/> Öğrenci Çağrı Pusulası
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('statement_request')} 
                                        className={`px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 font-medium transition-all ${
                                            lastGeneratedFormType === 'statement_request' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <FileText className="w-3.5 h-3.5 text-blue-500"/> İfade Talebi
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('defense_request')} 
                                        className={`px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 font-medium transition-all ${
                                            lastGeneratedFormType === 'defense_request' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <Scale className="w-3.5 h-3.5 text-blue-500"/> Savunma Talebi
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('student_statement_doc')} 
                                        className={`px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 font-medium transition-all ${
                                            lastGeneratedFormType === 'student_statement_doc' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <FileText className="w-3.5 h-3.5 text-indigo-500"/> Öğrenci İfade Belgesi
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('student_defense_doc')} 
                                        className={`px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 font-medium transition-all ${
                                            lastGeneratedFormType === 'student_defense_doc' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <Scale className="w-3.5 h-3.5 text-indigo-500"/> Öğrenci Savunma Belgesi
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('witness_student')} 
                                        className={`px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 font-medium transition-all ${
                                            lastGeneratedFormType === 'witness_student' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <Users className="w-3.5 h-3.5 text-sky-500"/> Görgü Tanığı
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('witness_teacher')} 
                                        className={`px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 font-medium transition-all ${
                                            lastGeneratedFormType === 'witness_teacher' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-blue-50 hover:border-blue-300'
                                        }`}
                                    >
                                        <User className="w-3.5 h-3.5 text-sky-600"/> Tanık Öğretmen
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('opinion_counselor')} 
                                        className={`px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 font-medium transition-all ${
                                            lastGeneratedFormType === 'opinion_counselor' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300'
                                        }`}
                                    >
                                        <MessageSquare className="w-3.5 h-3.5 text-purple-500"/> Rehberlik Görüş
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('opinion_teacher')} 
                                        className={`px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 font-medium transition-all ${
                                            lastGeneratedFormType === 'opinion_teacher' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50 hover:border-purple-300'
                                        }`}
                                    >
                                        <MessageSquare className="w-3.5 h-3.5 text-purple-600"/> Öğretmen Görüş
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('verbal_warning')} 
                                        className={`px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 font-medium transition-all ${
                                            lastGeneratedFormType === 'verbal_warning' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300'
                                        }`}
                                    >
                                        <AlertCircle className="w-3.5 h-3.5 text-amber-500"/> Sözlü Uyarı
                                    </button>
                                    <button 
                                        onClick={() => generateBulkDocuments('contract')} 
                                        className={`px-2.5 py-1.5 border rounded-lg text-xs flex items-center gap-1 font-medium transition-all ${
                                            lastGeneratedFormType === 'contract' 
                                                ? 'bg-blue-600 text-white border-blue-600 shadow-xs' 
                                                : 'bg-white border-slate-200 text-slate-700 hover:bg-amber-50 hover:border-amber-300'
                                        }`}
                                    >
                                        <ScrollText className="w-3.5 h-3.5 text-amber-600"/> Öğrenci Sözleşmesi
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 p-2 sm:p-6 overflow-y-auto flex justify-center">
                        {renderDocumentPreview()}
                    </div>
                </div>
            </div>
        )}

        {/* --- TAB 4: DECISION --- */}
        {activeTab === 'decision' && (
             <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                <div className={`w-full lg:w-1/3 ${mobileViewMode === 'form' ? 'flex' : 'hidden lg:flex'} bg-white border-b lg:border-b-0 lg:border-r border-slate-200 p-4 sm:p-6 flex-col overflow-y-auto`}>
                    
                    {/* INCIDENT & STUDENT SELECTOR (Added for Tab 4) */}
                    <div className="mb-6">
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Olay Seçiniz</label>
                        <select value={selectedIncidentId} onChange={e => { setSelectedIncidentId(e.target.value); setSelectedStudentId(''); }} className="w-full p-2 border rounded text-sm">
                            <option value="">-- Olay Seç --</option>
                            {incidents.map(inc => <option key={inc.id} value={inc.id}>{inc.title}</option>)}
                        </select>
                    </div>
                    {selectedIncident && (
                         <div className="mb-6 border border-slate-200 bg-slate-50/50 rounded-xl p-3 shadow-xs">
                            <div className="font-bold text-xs text-slate-600 uppercase tracking-wider mb-2.5 flex justify-between items-center">
                                <span>Olaya Karışan Öğrenciler</span>
                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded-md font-mono">
                                    {incidentStudents.length} Öğrenci
                                </span>
                            </div>
                            <div className="space-y-1.5 max-h-56 overflow-y-auto">
                            {incidentStudents.map((s) => {
                                const invDetail = selectedIncident.involvedStudents?.find(i => i.studentId === s.id);
                                const isSelected = selectedStudentId === s.id;
                                const isChecked = selectedStudentIds.includes(s.id);
                                
                                let roleBadge = "bg-amber-50 text-amber-700 border-amber-200";
                                let roleLabel = "Mağdur";
                                if (s.role === 'suspect') {
                                    roleBadge = "bg-rose-50 text-rose-700 border-rose-200";
                                    roleLabel = "Fail (Şüpheli)";
                                } else if (s.role === 'witness') {
                                    roleBadge = "bg-blue-50 text-blue-700 border-blue-200";
                                    roleLabel = "Tanık";
                                }

                                return (
                                    <div 
                                        key={s.id} 
                                        onClick={() => { 
                                            setSelectedStudentId(s.id); 
                                            setSelectedStudentIds([s.id]); 
                                        }} 
                                        className={`p-2.5 border rounded-lg cursor-pointer hover:bg-slate-50 transition-all flex flex-col gap-1.5 ${
                                            isSelected 
                                                ? 'bg-blue-50/70 border-blue-400 shadow-xs ring-1 ring-blue-400' 
                                                : isChecked 
                                                    ? 'bg-white border-slate-200' 
                                                    : 'bg-white/60 border-slate-150 opacity-75'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                                <div 
                                                    onClick={(e) => { 
                                                        e.stopPropagation(); 
                                                        toggleStudentSelection(s.id); 
                                                    }} 
                                                    className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                                        isChecked ? 'bg-blue-600 border-blue-600 shadow-xs text-white' : 'border-slate-300 hover:border-blue-400'
                                                    }`}
                                                >
                                                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3] text-white" />}
                                                </div>
                                                <span className={`font-semibold text-sm truncate ${isSelected ? 'text-blue-900 font-bold' : 'text-slate-800'}`}>
                                                    {s.name}
                                                </span>
                                            </div>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold shrink-0 ${roleBadge}`}>
                                                {roleLabel}
                                            </span>
                                        </div>
                                        
                                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-0.5 border-t border-slate-100/75 pt-1">
                                            <span>Sınıf-No: {s.grade} • {s.number}</span>
                                            {invDetail?.decision ? (
                                                <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded font-bold uppercase shrink-0">
                                                    Karar: {invDetail.decision}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 italic shrink-0">
                                                    Karar Girilmemiş
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            </div>
                        </div>
                    )}

                    {selectedStudentId && selectedIncident && (
                        (() => {
                            const curStud = incidentStudents.find(s => s.id === selectedStudentId);
                            if (!curStud) return null;
                            return (
                                <>
                                    {renderStudentKunyePanel(curStud)}
                                    <div className="mb-4 p-3 bg-indigo-50/50 border border-indigo-100/80 rounded-lg space-y-2.5 shrink-0 shadow-2xs">
                                        <div className="flex items-center gap-1.5 font-bold text-[10.5px] text-indigo-950 uppercase tracking-wide">
                                            <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                                            <span>{curStud.name} • İfade & Savunma Girişi</span>
                                        </div>
                                    <div className="space-y-0.5">
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Öğrenci İfadesi (Yeni Alınan İfade)</label>
                                        <textarea
                                            value={curStud.studentStatement || ''}
                                            onChange={(e) => {
                                                updateIncidentStudent(selectedIncidentId, selectedStudentId, { studentStatement: e.target.value });
                                            }}
                                            placeholder="Öğrencinin olayla ilgili ifadesini buraya yazın..."
                                            className="w-full p-2 border border-slate-200 rounded text-xs leading-normal bg-white resize-none shadow-2xs focus:border-indigo-400 focus:ring-1 focus:ring-indigo-150 outline-none"
                                            rows={2}
                                        />
                                    </div>
                                    <div className="space-y-0.5">
                                        <label className="block text-[9px] font-bold text-slate-500 uppercase">Öğrenci Savunması</label>
                                        <textarea
                                            value={curStud.studentDefense || ''}
                                            onChange={(e) => {
                                                updateIncidentStudent(selectedIncidentId, selectedStudentId, { studentDefense: e.target.value });
                                            }}
                                            placeholder="Öğrencinin kurum içi savunma beyanlarını yazın..."
                                            className="w-full p-2 border border-slate-200 rounded text-xs leading-normal bg-white resize-none shadow-2xs focus:border-indigo-400 focus:ring-1 focus:ring-indigo-150 outline-none"
                                            rows={2}
                                        />
                                    </div>
                                    <p className="text-[9px] text-slate-400/90 leading-normal italic">Bu veriler, hazırlanan evraklara ve nihai EK-10 Karar belgesine otomatik olarak yansır.</p>
                                </div>
                            </>
                        );
                    })()
                )}

                    {/* Simplified Form */}
                    <div className="space-y-4 mb-6">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="block text-xs font-bold text-slate-500 uppercase">Karar No</label>
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const incident = incidents.find(i => i.id === selectedIncidentId);
                                            const autoNo = getAutoDecisionNo(incident);
                                            setDecisionForm(prev => ({ ...prev, decisionNo: autoNo }));
                                        }}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                                    >
                                        Otomatik Üret
                                    </button>
                                </div>
                                <input type="text" value={decisionForm.decisionNo} onChange={e => setDecisionForm({...decisionForm, decisionNo: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="2025/1" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Calendar className="w-3 h-3"/> Karar Tarihi</label>
                                <input type="date" value={decisionForm.decisionDate} onChange={e => setDecisionForm({...decisionForm, decisionDate: e.target.value})} className="w-full p-2 border rounded text-sm bg-white" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center gap-1"><Calculator className="w-3 h-3"/> Ceza Puanı</label>
                                <input 
                                    type="number" 
                                    value={decisionForm.score} 
                                    onChange={e => setDecisionForm({...decisionForm, score: e.target.value})} 
                                    className="w-full p-2 border rounded text-sm font-bold text-blue-700 bg-blue-50 focus:bg-white" 
                                    placeholder="10" 
                                />
                            </div>
                        </div>
                        
                        {selectedStudentId && (() => {
                            const currentStudent = students.find(s => s.id === selectedStudentId);
                            const systemPenalties = incidents.filter(inc => 
                                inc.id !== selectedIncidentId &&
                                inc.involvedStudents.some(inv => 
                                    inv.studentId === selectedStudentId && 
                                    inv.decision && 
                                    !inv.decision.includes('YER OLMADIĞINA') &&
                                    inv.role === 'suspect'
                                )
                            ).map(inc => {
                                const inv = inc.involvedStudents.find(i => i.studentId === selectedStudentId);
                                return {
                                    id: 'sys-' + inc.id,
                                    decision: inv?.decision || '',
                                    decisionNo: inv?.decisionNo || 'Girilmemiş',
                                    date: inc.date,
                                    type: 'Sistem Kaydı',
                                    isManual: false,
                                    penaltyScore: inv?.penaltyScore || '10',
                                    isRemoved: inv?.isRemoved || false,
                                    removedDecisionNo: inv?.removedDecisionNo
                                };
                            });

                            const manualPenalties = (currentStudent?.previousPenalties || []).map(p => ({
                                id: p.id,
                                decision: p.decision,
                                decisionNo: p.decisionNo || 'Girilmemiş',
                                date: p.date || '',
                                type: 'Geçmiş Kayıt (Sistem Dışı)',
                                isManual: true,
                                penaltyScore: p.penaltyScore || '10',
                                isRemoved: p.isRemoved || false,
                                removedDecisionNo: p.removedDecisionNo
                            }));

                            const combinedPenalties = [...systemPenalties, ...manualPenalties];
                            const currentScore = currentStudent ? getStudentBehaviorPoints(currentStudent, incidents, selectedIncidentId) : 100;
                            const deductionVal = parseInt(decisionForm.score || '0', 10);
                            const finalScore = Math.max(0, currentScore - (isNaN(deductionVal) ? 0 : deductionVal));

                            return (
                                <div className="space-y-3">
                                    {/* Davranış Puanı Hesaplama Özeti */}
                                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-lg p-3 text-xs leading-relaxed space-y-1.5 shadow-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-600 font-medium">Bu Karardan Önce Kalan Puan:</span>
                                            <strong className="text-slate-800 font-bold font-mono text-[12px]">{currentScore} / 100</strong>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-blue-100/50 pt-1.5">
                                            <span className="text-slate-600 font-medium">Bu Karar Ceza Puanı İndirimi:</span>
                                            <strong className="text-red-600 font-bold font-mono">-{isNaN(deductionVal) ? 0 : deductionVal} Puan</strong>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-indigo-150 pt-1.5">
                                            <span className="text-indigo-900 font-bold uppercase tracking-wide">Bu Kararla Birlikte Kalan Puan:</span>
                                            <span className={`font-mono text-[12px] font-bold px-2 py-0.5 rounded ${finalScore < 60 ? 'bg-red-100 text-red-850' : finalScore < 85 ? 'bg-amber-100 text-amber-850' : 'bg-green-100 text-green-800'}`}>
                                                {finalScore} / 100
                                            </span>
                                        </div>
                                    </div>

                                    {/* Geçmiş Cezalar Listesi ve Yönetimi */}
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                                        <div className="flex justify-between items-center mb-2 border-b pb-1">
                                            <span className="text-xs font-bold text-slate-750 uppercase tracking-wide flex items-center gap-1.5">
                                                <ScrollText className="w-4 h-4 text-indigo-600" />
                                                Öğrencinin Cezaları ({combinedPenalties.length})
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${currentScore < 60 ? 'bg-red-50 text-red-700 border border-red-100' : currentScore < 85 ? 'bg-amber-50 text-amber-705 border border-amber-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                                                    Kalan Puan: {currentScore} / 100
                                                </span>
                                                <button 
                                                    onClick={() => setShowAddPastPenalty(!showAddPastPenalty)} 
                                                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                                                    type="button"
                                                >
                                                    {showAddPastPenalty ? 'Formu Kapat' : '+ Geçmiş Ceza Ekle'}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Geçmiş Ceza Ekleme Formu */}
                                        {showAddPastPenalty && (
                                            <div className="bg-white border rounded-lg p-3 mb-2.5 space-y-2.5 shadow-sm border-indigo-100">
                                                <div className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">
                                                    {editingPastPenaltyId ? 'Geçmiş Cezayı Düzenle / Güncelle' : 'Mevcut Sistem Dışı Geçmiş Ceza Ekle'}
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Ceza / Karar</label>
                                                        <select 
                                                            value={pastPenaltyForm.decision}
                                                            onChange={e => setPastPenaltyForm({...pastPenaltyForm, decision: e.target.value})}
                                                            className="w-full p-1 border rounded text-[11px] font-medium"
                                                        >
                                                            <option value="KINAMA">KINAMA</option>
                                                            <option value="UYARMA">UYARMA</option>
                                                            <option value="KISA SÜRELİ UZAKLAŞTIRMA">KISA SÜRELİ UZAKLAŞTIRMA</option>
                                                            <option value="OKUL DEĞİŞTİRME">OKUL DEĞİŞTİRME</option>
                                                            <option value="ÖRGÜN EĞİTİM DIŞINA ÇIKARMA">ÖRGÜN EĞİTİM DIŞINA ÇIKARMA</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Karar No / Sayı</label>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Örn: 2024/05"
                                                            value={pastPenaltyForm.decisionNo}
                                                            onChange={e => setPastPenaltyForm({...pastPenaltyForm, decisionNo: e.target.value})}
                                                            className="w-full p-1.5 border rounded text-[11px]"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Tarih</label>
                                                        <input 
                                                            type="date"
                                                            value={pastPenaltyForm.date}
                                                            onChange={e => setPastPenaltyForm({...pastPenaltyForm, date: e.target.value})}
                                                            className="w-full p-1 border rounded text-[11px]"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-bold text-slate-400 uppercase mb-0.5">Ceza Puanı</label>
                                                        <input 
                                                            type="number"
                                                            placeholder="10"
                                                            value={pastPenaltyForm.penaltyScore}
                                                            onChange={e => setPastPenaltyForm({...pastPenaltyForm, penaltyScore: e.target.value})}
                                                            className="w-full p-1 border rounded text-[11px]"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex justify-end gap-1.5 pt-1.5 border-t">
                                                    <button 
                                                        onClick={() => {
                                                            setShowAddPastPenalty(false);
                                                            setEditingPastPenaltyId(null);
                                                            setPastPenaltyForm({
                                                                decision: 'KINAMA',
                                                                decisionNo: '',
                                                                date: new Date().toISOString().split('T')[0],
                                                                penaltyScore: '10',
                                                                description: ''
                                                            });
                                                        }}
                                                        className="px-2 py-1 text-[10px] bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
                                                        type="button"
                                                    >
                                                        Vazgeç
                                                    </button>
                                                    <button 
                                                        onClick={handleAddPastPenalty}
                                                        className="px-2 py-1 text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white rounded font-bold border border-indigo-200"
                                                        type="button"
                                                    >
                                                        {editingPastPenaltyId ? 'Güncelle' : 'Kaydet/Ekle'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* Ceza Listesi */}
                                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                            {combinedPenalties.map((pen, pIdx) => (
                                                <div key={pen.id || pIdx} className="bg-white border rounded p-2 text-[11px] flex justify-between items-start gap-2 shadow-xs hover:border-slate-300 transition-colors">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            {pen.isRemoved ? (
                                                                <>
                                                                    <span className="font-bold line-through text-slate-400 shrink-0">{pen.decision}</span>
                                                                    <span className="text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 rounded font-bold shrink-0">✓ Kaldırıldı (İade Edildi)</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="font-bold text-red-650 shrink-0 text-red-600">{pen.decision}</span>
                                                                    <span className="text-[9px] bg-red-50 text-red-700 border border-red-100 px-1.5 py-0.2 rounded font-bold shrink-0">-{getDeductionForDecision(pen.decision, pen.penaltyScore)} Puan</span>
                                                                </>
                                                            )}
                                                            <span className="text-[9px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-1 py-0.2 rounded font-medium shrink-0">{pen.type}</span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 mt-0.5 flex gap-2">
                                                            <span>Karar No: {pen.decisionNo}</span>
                                                            <span>•</span>
                                                            <span>Tarih: {formatDateForDisplay(pen.date)}</span>
                                                        </div>
                                                    </div>
                                                    {pen.isManual && (
                                                        <div className="flex items-center gap-1 shrink-0 font-medium text-slate-400">
                                                            <button 
                                                                onClick={() => {
                                                                    const rawPen = currentStudent?.previousPenalties?.find(p => p.id === pen.id);
                                                                    if (rawPen) handleEditClickPastPenalty(rawPen);
                                                                }}
                                                                className="text-indigo-600 hover:text-indigo-800 transition-colors p-0.5"
                                                                type="button"
                                                            >
                                                                Düzenle
                                                            </button>
                                                            <span>•</span>
                                                            <button 
                                                                onClick={() => handleDeletePastPenalty(pen.id)}
                                                                className="hover:text-red-500 transition-colors p-0.5"
                                                                title="SİL"
                                                                type="button"
                                                            >
                                                                Sil
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                            {combinedPenalties.length === 0 && (
                                                <div className="text-center py-2 text-[10px] text-slate-400">
                                                    Öğrencinin geçmişte aldığı herhangi bir yaptırım bulunmamaktadır. Program öncesi eski cezaları yukarıdan ekleyebilirsiniz.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tekerrür Uyarısı */}
                                    {combinedPenalties.length > 0 && (() => {
                                        const penaltyNames = combinedPenalties.map(p => p.decision).join(', ');
                                        const isCurrentPenaltyRepeat = combinedPenalties.some(p => p.decision.toUpperCase().trim() === decisionForm.penalty.toUpperCase().trim());
                                        const nextPenaltyForCurrent = getOneDegreeHeavierPenalty(decisionForm.penalty, institution.type);
                                        
                                        return (
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-950 leading-relaxed space-y-2">
                                                <div className="flex items-center gap-1.5 font-bold">
                                                    <AlertCircle className="w-4 h-4 text-amber-600 animate-pulse" />
                                                    <span>Yönetmelik Tekerrür (Tekrar) Uyarısı</span>
                                                </div>
                                                <div>
                                                    Bu öğrencinin geçmişte aldığı disiplin yaptırımları bulunmaktadır: <strong className="text-amber-950 font-bold">{penaltyNames}</strong>.
                                                </div>
                                                <p className="font-medium text-slate-700">
                                                    MEB Ortaöğretim ve İlköğretim Kurumları Yönetmeliği uyarınca; <strong>"Verilmiş bir cezanın bir öğretim yılı içerisinde tekrarında bir derece ağır ceza uygulanır."</strong>
                                                </p>
                                                
                                                {isCurrentPenaltyRepeat ? (
                                                    <div className="bg-red-50 text-red-900 p-2.5 rounded border border-red-200 mt-1">
                                                        <span className="font-bold block text-[11px] mb-0.5 text-red-800">⚠️ AKTİF TEKERRÜR TESPİT EDİLDİ</span>
                                                        Öğrenci daha önce de <strong className="underline">{decisionForm.penalty}</strong> cezası almıştır. Aynı derece cezayı gerektirecek bir fiilde bulunulmuşsa yönetmelik gereğince uygulanacak ceza bir derece ağırlaştırılarak <strong className="font-bold text-red-750 underline">{nextPenaltyForCurrent}</strong> olarak belirlenmeli ve uygulanmalıdır.
                                                    </div>
                                                ) : (
                                                    <div className="bg-amber-100/60 p-2.5 rounded border border-amber-250 mt-1">
                                                        <span className="font-bold block text-[11px] mb-1 text-amber-900">💡 Tekerrür Durumunda Uygulanacak Cezalar:</span>
                                                        <div className="space-y-1">
                                                            {Array.from(new Set(combinedPenalties.map(p => p.decision.toUpperCase().trim()))).map((pastDec, idx) => (
                                                                <div key={idx} className="text-xs">
                                                                    Daha önce <strong className="underline">{pastDec}</strong> alan öğrenci aynı davranışı tekrarlayıp yine aynı cezayı gerektiren fiilde bulunursa, bir üst yaptırım olan <strong className="font-bold text-red-700">{getOneDegreeHeavierPenalty(pastDec, institution.type)}</strong> uygulanmalıdır.
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            );
                        })()}

                        {selectedIncident?.mitigatingFactors && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900 leading-relaxed mb-3 space-y-2 col-span-1 md:col-span-1">
                                <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                                    <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
                                    <span>Yaptırımı Hafifleten Nedenler Algılandı</span>
                                </div>
                                <p className="text-[11px] text-emerald-700 italic bg-white/60 p-2 rounded border border-emerald-100">
                                    "{selectedIncident.mitigatingFactors}"
                                </p>
                                <div className="flex items-center gap-2 py-1">
                                    <input 
                                        type="checkbox" 
                                        id="use_mitigating_decision" 
                                        className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                                        checked={selectedIncident.useMitigatingFactors || false}
                                        onChange={(e) => {
                                            const updatedIncident = { ...selectedIncident, useMitigatingFactors: e.target.checked };
                                            updateIncident(updatedIncident);
                                        }}
                                    />
                                    <label htmlFor="use_mitigating_decision" className="text-[11px] font-semibold text-slate-700 select-none cursor-pointer">
                                        Bu hafifletici nedenler Karar ve Tebligat belgelerinde gösterilsin (Aktif)
                                    </label>
                                </div>
                                <div className="pt-2 border-t border-emerald-200 flex items-center justify-between gap-2">
                                    <div>
                                       <span className="font-semibold text-[11px] text-slate-700 block">1 Alt Derece Ceza Teklifi:</span>
                                       <span className="text-[10px] text-slate-500 font-medium select-none">Önerilen: {getOneDegreeLighterPenalty(decisionForm.penalty, institution.type)}</span>
                                    </div>
                                    <button
                                       type="button"
                                       onClick={() => {
                                          const lighter = getOneDegreeLighterPenalty(decisionForm.penalty, institution.type);
                                          if (lighter && lighter !== 'BİR ALT DERECE CEZA') {
                                             handlePenaltyChange(lighter);
                                          }
                                       }}
                                       className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[11px] px-2.5 py-1.5 rounded transition-colors shadow-xs"
                                    >
                                       1 Derece Hafiflet
                                    </button>
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Verilen Ceza</label>
                            <select value={decisionForm.penalty} onChange={e => handlePenaltyChange(e.target.value)} className="w-full p-2 border rounded text-sm">
                                <option value="KINAMA">KINAMA</option>
                                <option value="UYARMA">UYARMA</option>
                                <option value="KISA SÜRELİ UZAKLAŞTIRMA">KISA SÜRELİ UZAKLAŞTIRMA</option>
                                <option value="OKUL DEĞİŞTİRME">OKUL DEĞİŞTİRME</option>
                                <option value="ÖRGÜN EĞİTİM DIŞINA ÇIKARMA">ÖRGÜN EĞİTİM DIŞINA ÇIKARMA</option>
                            </select>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-xs font-bold text-slate-500 uppercase">Gerekçe / Madde</label>
                                <button 
                                    onClick={handleAutoGenerateReason}
                                    disabled={isGeneratingReason || !selectedIncidentId}
                                    className="text-[10px] flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-100 hover:bg-purple-100 disabled:opacity-50 transition-colors"
                                >
                                    {isGeneratingReason ? <Loader2 className="w-3 h-3 animate-spin"/> : <Sparkles className="w-3 h-3"/>}
                                    AI ile Gerekçe Yaz
                                </button>
                            </div>
                            <textarea value={decisionForm.reason} onChange={e => setDecisionForm({...decisionForm, reason: e.target.value})} className="w-full p-2 border rounded text-sm" placeholder="Gerekçe" rows={4}></textarea>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Dayağı Yönetmelik Maddesi (Dayanak)</label>
                            <input 
                                type="text" 
                                value={decisionForm.regulationArticle || ''} 
                                onChange={e => setDecisionForm({...decisionForm, regulationArticle: e.target.value})} 
                                className="w-full p-2 border rounded text-sm bg-slate-50 focus:bg-white" 
                                placeholder="Örn: MEB Ortaöğretim Kurumları Yönetmeliği Madde 164-1/a" 
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Yaptırımı Gerektiren Davranışın Nedeni (Sebep)</label>
                            <textarea 
                                value={decisionForm.behaviorReason || ''} 
                                onChange={e => setDecisionForm({...decisionForm, behaviorReason: e.target.value})} 
                                className="w-full p-2 border rounded text-sm bg-slate-50 focus:bg-white" 
                                placeholder="Örn: Arkadaşları ile uyumsuzluk yaşaması ve kurallara uymama eğilimi." 
                                rows={2}
                            />
                        </div>
                        
                        {/* Success Message Banner */}
                        {successMessage && (
                            <div className="bg-green-50 text-green-700 px-3 py-2 rounded text-xs font-bold flex items-center gap-2 animate-fade-in border border-green-100 mb-2">
                                <CheckCircle className="w-4 h-4"/>
                                {successMessage}
                            </div>
                        )}

                        <button 
                            onClick={handleSaveDecision} 
                            disabled={isBlankMode}
                            className={`w-full py-2 rounded text-sm font-medium transition-colors shadow-sm ${isBlankMode ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                        >
                            Kararı Kaydet
                        </button>
                        <div className="text-[10px] text-slate-400 italic text-center mt-1">Ceza puanını manuel düzenleyebilirsiniz.</div>
                    </div>
                </div>

                <div className={`w-full lg:flex-1 ${mobileViewMode === 'preview' ? 'flex' : 'hidden lg:flex'} flex-col bg-slate-50/50 overflow-y-auto`}>
                    <div className="p-4 bg-white border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                        <button onClick={() => generateBulkDocuments('ek10_decision')} className="p-2 border rounded hover:bg-red-50 text-red-700 text-xs font-bold">EK-10 Karar</button>
                        <button onClick={() => generateBulkDocuments('dizi_pusulasi')} className="p-2 border rounded hover:bg-slate-50 text-xs">Dizi Pusulası</button>
                        <button onClick={() => generateBulkDocuments('sanction_student')} className="p-2 border rounded hover:bg-slate-50 text-xs">Yaptırım Tebliği (Öğr)</button>
                        <button onClick={() => generateBulkDocuments('sanction_parent')} className="p-2 border rounded hover:bg-slate-50 text-xs">Yaptırım Tebliği (Veli)</button>
                        <button onClick={() => generateBulkDocuments('penalty_removal_call')} className="p-2 border rounded hover:bg-amber-50 text-amber-700 text-xs">Ceza Silme Çağrı</button>
                        <button onClick={() => generateBulkDocuments('penalty_removal_decision')} className="p-2 border rounded hover:bg-amber-50 text-amber-700 text-xs bg-amber-50 border-amber-200 font-semibold">Ceza Kal. Kararı</button>
                    </div>
                    <div className="flex-1 p-2 sm:p-6 overflow-y-auto flex justify-center">
                        {renderDocumentPreview()}
                    </div>
                </div>
             </div>
        )}
      </div>

      {/* KÜNYE DÜZENLEME MODALI */}
      {editingKunyeStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded-lg bg-blue-500/20 border border-blue-400/30">
                    <User className="w-4 h-4 text-blue-300" />
                  </span>
                  <h3 className="font-bold text-base tracking-wide">Öğrenci e-Okul / Nüfus Künye Bilgileri</h3>
                </div>
                <p className="text-xs text-blue-200/80 mt-1">
                  {editingKunyeStudent.name} • No: <span className="font-mono text-white">{editingKunyeStudent.number || '-'}</span> • Sınıf: <span className="text-white">{editingKunyeStudent.class || '-'}</span>
                </p>
              </div>
              <button 
                onClick={() => setEditingKunyeStudent(null)} 
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-blue-900 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11.5px]">
                  <strong>Nüfus ve Künye Bilgileri Entegrasyonu:</strong> Aile Sıra No ve Sıra No bağımsız alanlar olarak işlenir. Buradaki veriler EK-10 Karar, EK-1 Formu, İfade &amp; Savunma tutanakları ve bildirim evraklarına doğrudan yansıtılır.
                </div>
              </div>

              {/* 1. Kimlik Bilgileri */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2.5 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-600" /> Temel Kimlik &amp; Sağlık Bilgileri
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">T.C. Kimlik No</label>
                    <input 
                      type="text" 
                      maxLength={11}
                      value={kunyeForm.tcNo || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, tcNo: e.target.value.replace(/\D/g, '') }))} 
                      placeholder="11 haneli T.C. No"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Cinsiyet</label>
                    <select
                      value={kunyeForm.gender || 'ERKEK'}
                      onChange={e => setKunyeForm(prev => ({ ...prev, gender: e.target.value }))}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-blue-500 outline-none"
                    >
                      <option value="ERKEK">Erkek</option>
                      <option value="KIZ">Kız</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Doğum Yeri ve Tarihi</label>
                    <input 
                      type="text" 
                      value={kunyeForm.birthPlaceDate || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, birthPlaceDate: e.target.value }))} 
                      placeholder="Örn: KIRŞEHİR / 12.04.2008"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 2. Anne & Baba Bilgileri */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2.5 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" /> Anne &amp; Baba Bilgileri
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Anne Adı</label>
                    <input 
                      type="text" 
                      value={kunyeForm.motherName || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, motherName: e.target.value.toLocaleUpperCase('tr-TR') }))} 
                      placeholder="Anne Adı"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Baba Adı</label>
                    <input 
                      type="text" 
                      value={kunyeForm.fatherName || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, fatherName: e.target.value.toLocaleUpperCase('tr-TR') }))} 
                      placeholder="Baba Adı"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Nüfus Kaydı (Cilt, Aile Sıra No, Sıra No) */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2.5 pb-1 border-b border-slate-100 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ScrollText className="w-3.5 h-3.5 text-purple-600" /> Nüfus Kayıt Kütüğü (İl, İlçe, Cilt, Aile Sıra No, Sıra No)
                  </span>
                  <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200 font-semibold">
                    Bağımsız Sıra Numaraları
                  </span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Nüfusa Kayıtlı İl</label>
                    <input 
                      type="text" 
                      value={kunyeForm.province || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, province: e.target.value.toLocaleUpperCase('tr-TR') }))} 
                      placeholder="Örn: KIRŞEHİR"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Nüfusa Kayıtlı İlçe</label>
                    <input 
                      type="text" 
                      value={kunyeForm.district || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, district: e.target.value.toLocaleUpperCase('tr-TR') }))} 
                      placeholder="Örn: MERKEZ"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Mahalle / Köy</label>
                    <input 
                      type="text" 
                      value={kunyeForm.neighborhood || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, neighborhood: e.target.value.toLocaleUpperCase('tr-TR') }))} 
                      placeholder="Örn: BAĞBAŞI MAH."
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Cilt No</label>
                    <input 
                      type="text" 
                      value={kunyeForm.volumeNo || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, volumeNo: e.target.value }))} 
                      placeholder="Örn: 14"
                      className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-purple-900 mb-1 flex items-center justify-between">
                      <span>Aile Sıra No</span>
                      <span className="text-[9px] text-purple-600 bg-purple-100 px-1 rounded">Hane / Aile</span>
                    </label>
                    <input 
                      type="text" 
                      value={kunyeForm.familyOrderNo || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, familyOrderNo: e.target.value }))} 
                      placeholder="Örn: 88"
                      className="w-full p-2 border border-purple-300 rounded-lg text-xs font-mono font-bold text-purple-900 bg-purple-50/50 focus:border-purple-600 focus:ring-1 focus:ring-purple-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-emerald-900 mb-1 flex items-center justify-between">
                      <span>Sıra No (Birey)</span>
                      <span className="text-[9px] text-emerald-600 bg-emerald-100 px-1 rounded">Birey Sıra</span>
                    </label>
                    <input 
                      type="text" 
                      value={kunyeForm.orderNo || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, orderNo: e.target.value }))} 
                      placeholder="Örn: 10"
                      className="w-full p-2 border border-emerald-300 rounded-lg text-xs font-mono font-bold text-emerald-900 bg-emerald-50/50 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-200 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 4. Öğrenim & Yatılılık Durumu */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2.5 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-blue-600" /> Pansiyon, Bursluluk ve Öğrenim Durumu
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Pansiyon Durumu</label>
                    <select
                      value={kunyeForm.boardingStatus || 'GÜNDÜZLÜ'}
                      onChange={e => setKunyeForm(prev => ({ ...prev, boardingStatus: e.target.value }))}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-blue-500 outline-none"
                    >
                      <option value="GÜNDÜZLÜ">Gündüzlü</option>
                      <option value="PARASIZ YATILI">Parasız Yatılı</option>
                      <option value="PARALI YATILI">Paralı Yatılı</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Bursluluk Durumu</label>
                    <select
                      value={kunyeForm.scholarshipStatus || 'BURSSUZ'}
                      onChange={e => setKunyeForm(prev => ({ ...prev, scholarshipStatus: e.target.value }))}
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs bg-white focus:border-blue-500 outline-none"
                    >
                      <option value="BURSSUZ">Burssuz</option>
                      <option value="BURSLU">Burslu</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Kayıt / Program Türü</label>
                    <input 
                      type="text" 
                      value={kunyeForm.registrationType || 'YENİ KAYIT'} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, registrationType: e.target.value }))} 
                      placeholder="Örn: MESEM / ANADOLU"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Veli Bilgileri ve İkametgâh */}
              <div>
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] mb-2.5 pb-1 border-b border-slate-100 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-600" /> Veli Bilgisi &amp; İkametgâh Adresi
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Veli Adı Soyadı</label>
                    <input 
                      type="text" 
                      value={kunyeForm.parentName || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, parentName: e.target.value.toLocaleUpperCase('tr-TR') }))} 
                      placeholder="Veli Adı Soyadı"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-600 mb-1">Veli Telefonu</label>
                    <input 
                      type="text" 
                      value={kunyeForm.parentPhone || ''} 
                      onChange={e => setKunyeForm(prev => ({ ...prev, parentPhone: e.target.value }))} 
                      placeholder="05XX XXX XX XX"
                      className="w-full p-2 border border-slate-200 rounded-lg text-xs font-mono focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-600 mb-1">İkametgâh / Açık Adres</label>
                  <textarea
                    value={kunyeForm.address || ''}
                    onChange={e => setKunyeForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Öğrencinin resmi ikametgâh adresini buraya yazın..."
                    className="w-full p-2 border border-slate-200 rounded-lg text-xs resize-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none"
                    rows={2}
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 italic">
                Değişiklikler anında yerel veritabanına ve evrak şablonlarına aktarılacaktır.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingKunyeStudent(null)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={handleSaveKunye}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  Bilgileri Kaydet &amp; Evraklara Uygula
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Otomatik Kayıt Bildirim Uyarısı (Toast) */}
      {autoSaveNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-xs border border-slate-700/80 backdrop-blur-md animate-in slide-in-from-bottom-4 duration-200">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30 shadow-inner">
            <CheckCircle className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold text-emerald-300 flex items-center gap-1.5">
              <span>Otomatik Olarak Kaydedildi</span>
              {autoSaveStatus.timestamp && (
                <span className="text-[10px] text-slate-400 font-mono font-normal">({autoSaveStatus.timestamp})</span>
              )}
            </div>
            <div className="text-[11px] text-slate-200 mt-0.5 max-w-sm">{autoSaveNotification}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DecisionAssistant;
