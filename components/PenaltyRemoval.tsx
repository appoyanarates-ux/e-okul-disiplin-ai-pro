import React, { useState, useEffect, useRef } from 'react';
import { 
  RotateCcw, Search, Calendar, MapPin, FileText, Printer, Download, 
  Users, ChevronRight, Loader2, ZoomIn, ZoomOut, AlertCircle, 
  History, Award, Clock, CheckCircle2, Check, Minimize2,
  Layout, ChevronDown, Sliders
} from 'lucide-react';
import { useIncidents } from '../context/IncidentContext';
import { useStudents } from '../context/StudentContext';
import { useSettings } from '../context/SettingsContext';
import { exportHtmlToWord, printHtmlViaIframe } from '../services/exportService';
import { MarginType, PAGE_MARGINS, Student } from '../types';

const PenaltyRemoval = () => {
  const { incidents, updateIncidentStudent } = useIncidents();
  const { students, updateStudent } = useStudents();
  const { institution, boardMembers } = useSettings();
  const previewRef = useRef<HTMLDivElement>(null);

  // --- TAB STATE ---
  const [activeTab, setActiveTab] = useState<'removal' | 'archive'>('removal');

  // --- STATE FOR PENALTY REMOVAL ACTION ---
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [selectedPenalties, setSelectedPenalties] = useState<Array<{studentId: string, penaltyId: string, type: 'active' | 'past'}>>([]);
  const [isBlankMode, setIsBlankMode] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [marginPreset, setMarginPreset] = useState<MarginType>('normal');
  const [showMarginMenu, setShowMarginMenu] = useState(false);
  const [fitToPage, setFitToPage] = useState(false);
  const [docFontSize, setDocFontSize] = useState(15);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

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
        margin-top: 4px !important;
        margin-bottom: 4px !important;
        line-height: 1.2 !important;
    }
    .print-fit-page td, .print-fit-page th {
        padding: 2px 4px !important;
        line-height: 1.2 !important;
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
        margin-top: 6px !important;
        margin-bottom: 0px !important;
    }
  `;

  // Official Board Removal Decision form
  const [removalForm, setRemovalForm] = useState({
    decisionNo: `K-${new Date().getFullYear()}/`,
    date: new Date().toISOString().split('T')[0],
    reason: 'Öğrencinin ceza aldığı tarihten itibaren sergilediği olumlu tutum ve davranışlar, sınıf rehber öğretmeni ve rehberlik servisinin olumlu gözlem raporları ile kurul kurul üyelerinin mutabakatı doğrultusunda ilgili madde gereği cezasının kaldırılmasına ve davranış puanının iadesine karar verilmiştir.',
    resultType: 'removed' as 'removed' | 'continued'
  });

  // Meeting Details for Evrak Generation
  const [meetingData, setMeetingData] = useState({
    date: new Date().toISOString().split('T')[0],
    time: '15:30',
    location: 'Müdür Yardımcısı Odası',
    number: `${new Date().getFullYear()}/1`, // Toplantı Sayısı
    term: '2. Dönem Sonu'
  });

  const [generatedDoc, setGeneratedDoc] = useState<{header: string, body: string} | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // --- STATE FOR DISCIPLINARY HISTORY LOOKUP (ARCHIVE TAB) ---
  const [historyStudentId, setHistoryStudentId] = useState<string>('');
  const [archiveSearchTerm, setArchiveSearchTerm] = useState<string>('');

  // --- DATA EXTRACTORS & HELPERS ---

  // Get list of combined removable penalties for a single student (non-removed active & past)
  const getRemovablePenalties = (studentId: string) => {
    const list: Array<{
      id: string;
      type: 'active' | 'past';
      decision: string;
      date: string;
      decisionNo: string;
      penaltyScore: string;
      title: string;
    }> = [];

    const student = students.find(s => s.id === studentId);
    if (!student) return list;

    // 1. Un-removed suspect involvements from active incidents
    incidents.forEach(inc => {
      const inv = inc.involvedStudents?.find(i => 
        i.studentId === studentId && 
        i.role === 'suspect' && 
        i.decision && 
        !i.decision.toUpperCase().includes('YER OLMADIĞINA') &&
        !i.isRemoved
      );
      if (inv) {
        list.push({
          id: inc.id,
          type: 'active',
          decision: inv.decision,
          date: inc.date,
          decisionNo: inv.decisionNo || 'Girilmemiş',
          penaltyScore: inv.penaltyScore || '10',
          title: `${inc.title} (${inc.code})`
        });
      }
    });

    // 2. Un-removed previous penalties
    if (student.previousPenalties) {
      student.previousPenalties.forEach(p => {
        if (!p.isRemoved) {
          list.push({
            id: p.id,
            type: 'past',
            decision: p.decision,
            date: p.date || '-',
            decisionNo: p.decisionNo || 'Girilmemiş',
            penaltyScore: p.penaltyScore || '10',
            title: p.description || 'Eski/Geçmiş Cezalar Listesinden Kayıt'
          });
        }
      });
    }

    return list;
  };

  // Get list of students eligible for penalty removal (has either active penalty or past penalty that is not removed code)
  const eligibleStudents = students.filter(s => {
    const activeRemovables = incidents.some(inc => 
      inc.involvedStudents?.some(inv => 
        inv.studentId === s.id && 
        inv.role === 'suspect' && 
        inv.decision && 
        !inv.decision.toUpperCase().includes('YER OLMADIĞINA') &&
        !inv.isRemoved
      )
    );
    const pastRemovables = s.previousPenalties && s.previousPenalties.some(p => !p.isRemoved);
    return activeRemovables || pastRemovables;
  });

  // Get list of all removed/pardoned penalties across all students
  const getRemovedPenaltiesList = () => {
    const list: Array<{
      student: typeof students[0];
      itemId: string;
      type: 'active' | 'past';
      decision: string;
      penaltyScore: string;
      originalDate: string;
      originalDecisionNo: string;
      removedDate: string;
      removedDecisionNo: string;
      removedReason: string;
      description: string;
    }> = [];

    students.forEach(s => {
      // 1. From active incidents
      incidents.forEach(inc => {
        const inv = inc.involvedStudents?.find(i => 
          i.studentId === s.id && 
          i.role === 'suspect' && 
          i.isRemoved
        );
        if (inv) {
          list.push({
            student: s,
            itemId: inc.id,
            type: 'active',
            decision: inv.decision || '',
            penaltyScore: inv.penaltyScore || '10',
            originalDate: inc.date,
            originalDecisionNo: inv.decisionNo || 'Kayıt Yok',
            removedDate: inv.removedDate || '',
            removedDecisionNo: inv.removedDecisionNo || '',
            removedReason: inv.removedReason || '',
            description: `${inc.title} (Olay No: ${inc.code})`
          });
        }
      });

      // 2. From student previousPenalties
      if (s.previousPenalties) {
        s.previousPenalties.forEach(p => {
          if (p.isRemoved) {
            list.push({
              student: s,
              itemId: p.id,
              type: 'past',
              decision: p.decision,
              penaltyScore: p.penaltyScore || '10',
              originalDate: p.date || '',
              originalDecisionNo: p.decisionNo || 'Kayıt Yok',
              removedDate: p.removedDate || '',
              removedDecisionNo: p.removedDecisionNo || '',
              removedReason: p.removedReason || '',
              description: p.description || 'Geçmiş Cezalar Listesinde Kayıtlı'
            });
          }
        });
      }
    });

    return list;
  };

  // Get full visual chronology chronological list of ANY penalties for a student (active, past, removed)
  const getStudentHistoryTimeline = (studentId: string) => {
    const timeline: Array<{
      id: string;
      type: 'active' | 'past';
      category: 'active' | 'removed';
      decision: string;
      penaltyScore: string;
      originalDate: string;
      originalDecisionNo: string;
      removedDate?: string;
      removedDecisionNo?: string;
      removedReason?: string;
      description: string;
    }> = [];

    if (!studentId) return timeline;
    const student = students.find(s => s.id === studentId);
    if (!student) return timeline;

    // Active incidents
    incidents.forEach(inc => {
      const inv = inc.involvedStudents?.find(i => i.studentId === studentId && i.role === 'suspect' && i.decision && !i.decision.toUpperCase().includes('YER OLMADIĞINA'));
      if (inv) {
        timeline.push({
          id: inc.id,
          type: 'active',
          category: inv.isRemoved ? 'removed' : 'active',
          decision: inv.decision,
          penaltyScore: inv.penaltyScore || '10',
          originalDate: inc.date,
          originalDecisionNo: inv.decisionNo || '',
          removedDate: inv.removedDate,
          removedDecisionNo: inv.removedDecisionNo,
          removedReason: inv.removedReason,
          description: `Olay: ${inc.title} (${inc.code}) - Yer: ${inc.location}`
        });
      }
    });

    // Past penalties
    if (student.previousPenalties) {
      student.previousPenalties.forEach(p => {
        timeline.push({
          id: p.id,
          type: 'past',
          category: p.isRemoved ? 'removed' : 'active',
          decision: p.decision,
          penaltyScore: p.penaltyScore || '10',
          originalDate: p.date || '-',
          originalDecisionNo: p.decisionNo || '',
          removedDate: p.removedDate,
          removedDecisionNo: p.removedDecisionNo,
          removedReason: p.removedReason,
          description: p.description || 'Esasen geçmiş e-okul veya kurum dosya kayıtlarından işlenmiş yaptırım.'
        });
      });
    }

    // Sort by original date descending
    return timeline.sort((a, b) => b.originalDate.localeCompare(a.originalDate));
  };


  // --- SIDE-EFFECTS ---
  const removablePenalties = selectedStudentIds.flatMap(studentId => 
    getRemovablePenalties(studentId).map(p => ({ ...p, studentId }))
  );

  useEffect(() => {
    setSelectedPenalties(prev => prev.filter(p => selectedStudentIds.includes(p.studentId)));
    setGeneratedDoc(null);
  }, [selectedStudentIds]);


  // --- EXECUTIONS ---

  // Core function to FORMALLY REMOVE the selected penalty in context & local storage
  const executeRemovalInternal = (): boolean => {
    if (selectedPenalties.length === 0) {
      setActionFeedback({ type: 'error', message: 'Lütfen önce kaldırılacak yaptırımları seçiniz.' });
      return false;
    }

    if (!removalForm.decisionNo.trim()) {
      setActionFeedback({ type: 'error', message: 'Lütfen ceza kaldırmaya ilişkin Karar Sayısı / No giriniz.' });
      return false;
    }

    // 1. Group past penalties by student to prevent overwriting
    const pastPenaltiesByStudent: Record<string, string[]> = {};
    const activePenaltiesList: Array<{ incidentId: string; studentId: string }> = [];

    selectedPenalties.forEach(target => {
      if (target.type === 'active') {
        activePenaltiesList.push({ incidentId: target.penaltyId, studentId: target.studentId });
      } else {
        if (!pastPenaltiesByStudent[target.studentId]) {
          pastPenaltiesByStudent[target.studentId] = [];
        }
        pastPenaltiesByStudent[target.studentId].push(target.penaltyId);
      }
    });

    // 2. Apply active incident removals
    activePenaltiesList.forEach(({ incidentId, studentId }) => {
      updateIncidentStudent(incidentId, studentId, {
        isRemoved: true,
        removedDecisionNo: removalForm.decisionNo,
        removedDate: removalForm.date,
        removedReason: removalForm.reason
      });
    });

    // 3. Apply past penalties removals safely per student
    Object.entries(pastPenaltiesByStudent).forEach(([studentId, penaltyIds]) => {
      const student = students.find(s => s.id === studentId);
      if (!student) return;
      const updatedPenalties = (student.previousPenalties || []).map(p => {
        if (penaltyIds.includes(p.id)) {
          return {
            ...p,
            isRemoved: true,
            removedDecisionNo: removalForm.decisionNo,
            removedDate: removalForm.date,
            removedReason: removalForm.reason
          };
        }
        return p;
      });
      updateStudent(studentId, { previousPenalties: updatedPenalties });
    });

    setActionFeedback({
      type: 'success',
      message: `✓ Başarılı: Seçili ${selectedPenalties.length} adet ceza resmi olarak kaldırıldı ve davranış puanları öğrencilere iade edildi.`
    });

    return true;
  };

  const handleRemovePenaltyExecute = () => {
    const success = executeRemovalInternal();
    if (!success) return;

    // Auto-switch to archive to let them see!
    if (selectedStudentIds.length > 0) {
      setHistoryStudentId(selectedStudentIds[0]);
    }
    setActiveTab('archive');

    // Reset inputs
    setSelectedStudentIds([]);
    setSelectedPenalties([]);
    setRemovalForm(prev => ({
      ...prev,
      decisionNo: `K-${new Date().getFullYear()}/`
    }));
  };

  // Undo penalty removal of a student
  const handleUndoPenaltyRemoval = (studentId: string, itemId: string, type: 'active' | 'past') => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    if (type === 'active') {
      updateIncidentStudent(itemId, studentId, {
        isRemoved: false,
        removedDecisionNo: undefined,
        removedDate: undefined,
        removedReason: undefined
      });
    } else {
      const updatedPenalties = (student.previousPenalties || []).map(p => {
        if (p.id === itemId) {
          return {
            ...p,
            isRemoved: false,
            removedDecisionNo: undefined,
            removedDate: undefined,
            removedReason: undefined
          };
        }
        return p;
      });
      updateStudent(studentId, { previousPenalties: updatedPenalties });
    }

    setActionFeedback({
      type: 'success',
      message: `✓ "${student.name}" için ceza kaldırma kararı geri alındı. Yaptırım yeniden aktif olarak sisteme işlendi.`
    });
  };

  // --- DOCUMENT GENERATORS ---

  const generateMeetingCall = () => {
    const effectivelyBlankMode = isBlankMode || selectedPenalties.length === 0;

    const regulationArticle = institution.type === 'Ortaokul' 
      ? 'Milli Eğitim Bakanlığı Okul Öncesi Eğitim ve İlköğretim Kurumları Yönetmeliğinin 58. Maddesi' 
      : 'Milli Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliğinin 171. Maddesi';

    const header = `
    <div style="text-align:center; font-weight:bold; margin-bottom:1.5rem; line-height:1.4;">
      T.C.<br>
      ${institution.province.toUpperCase()} VALİLİĞİ<br>
      ${institution.district} İLÇE MİLLİ EĞİTİM MÜDÜRLÜĞÜ<br>
      ${institution.name}
    </div>`;

    const groupedByStudentForCall = Object.values(
      selectedPenalties.reduce((acc, p) => {
        if (!acc[p.studentId]) acc[p.studentId] = { studentId: p.studentId, penalties: [] };
        acc[p.studentId].penalties.push(p);
        return acc;
      }, {} as Record<string, {studentId: string, penalties: typeof selectedPenalties}>)
    );

    let studentsAndPenaltiesText = '.................. sınıfı, ............. numaralı öğrencisi ................................\'in daha önce almış olduğu .............................................................. cezası';

    if (!effectivelyBlankMode && groupedByStudentForCall.length > 0) {
        studentsAndPenaltiesText = (groupedByStudentForCall as any[]).map(group => {
            const student = students.find(s => s.id === group.studentId);
            if (!student) return null;
            
            const penaltyTexts = group.penalties.map(sp => {
                const penalty = removablePenalties.find(p => p.id === sp.penaltyId && p.type === sp.type && p.studentId === sp.studentId);
                return penalty ? `<b>${penalty.date || '-'}</b> tarihli <b>"${penalty.decision}"</b>` : null;
            }).filter(Boolean).join(' ve ');

            return `<b>${student.grade}</b> sınıfı, <b>${student.number}</b> numaralı öğrencisi <b>${student.name}</b>'in daha önce almış olduğu ${penaltyTexts} ${group.penalties.length > 1 ? 'cezaları' : 'cezası'}`;
        }).filter(Boolean).join('; ile ');
    }

    const body = `
      ${header}
      <br>
      <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
           <div><b>Sayı</b> : ${institution.ebysCode}<br><b>Konu</b> : Disiplin Cezası Alan Öğrencilerinin Durumunun Görüşülmesi<br>(Kurul Toplantı Çağrısı)</div>
           <div>${new Date().toLocaleDateString('tr-TR')}</div>
      </div>
      <br>
      <div style="text-align:center; font-weight:bold; margin:20px 0;">ÖĞRENCİ DAVRANIŞLARINI DEĞERLENDİRME KURULU ÜYELERİNE</div>
      <p style="text-indent:30px; text-align:justify; line-height:1.6;">
         Okulumuz ${studentsAndPenaltiesText}nın; davranışlarındaki gelişmelerin değerlendirilerek cezasının kaldırılması (davranış puanının iadesi) veya cezasının devamı hususunu görüşmek üzere toplanılacaktır.
      </p>
      <p style="text-indent:30px; text-align:justify; line-height:1.6;">
         <b>${regulationArticle}</b> gereğince yapılacak olan toplantıya aşağıda belirtilen gün ve saatte teşriflerinizi rica ederim.
      </p>
      
      <div style="text-align:right; margin-top:30px; margin-bottom:40px;">
          <b>${institution.managerName}</b><br>Okul Müdürü
      </div>

      <table style="width:100%; border:1px solid black; margin-bottom:20px; font-size:10pt;">
          <tr>
              <td style="border:1px solid black; padding:8px; font-weight:bold; width:30%; background-color:#f9f9f9;">Toplantı Tarihi</td>
              <td style="border:1px solid black; padding:8px;">${new Date(meetingData.date).toLocaleDateString('tr-TR')}</td>
          </tr>
          <tr>
              <td style="border:1px solid black; padding:8px; font-weight:bold; background-color:#f9f9f9;">Toplantı Saati</td>
              <td style="border:1px solid black; padding:8px;">${meetingData.time}</td>
          </tr>
          <tr>
              <td style="border:1px solid black; padding:8px; font-weight:bold; background-color:#f9f9f9;">Toplantı Yeri</td>
              <td style="border:1px solid black; padding:8px;">${meetingData.location}</td>
          </tr>
           <tr>
              <td style="border:1px solid black; padding:8px; font-weight:bold; background-color:#f9f9f9;">Gündem</td>
              <td style="border:1px solid black; padding:8px;">
                  1. Açılış ve Yoklama<br>
                  2. Disiplin cezası alan öğrenci/öğrencilerin durumunun görüşülmesi<br>
                  3. Karar ve Kapanış
              </td>
          </tr>
      </table>
      
      <br>
      <div style="font-weight:bold; margin-bottom:10px;">TEBLİĞ LİSTESİ</div>
      <table style="width:100%; border-collapse:collapse; border:1px solid black; font-size:9pt; text-align:center;">
           <tr style="background-color:#f0f0f0; font-weight:bold;">
              <td style="border:1px solid black; padding:5px;">ÜYE ADI SOYADI</td>
              <td style="border:1px solid black; padding:5px;">GÖREVİ</td>
              <td style="border:1px solid black; padding:5px;">İMZA</td>
           </tr>
           ${boardMembers.map(m => `
           <tr>
              <td style="border:1px solid black; padding:8px;"><b>${m.mainName || '.......................................'}</b></td>
              <td style="border:1px solid black; padding:8px;">${m.role}${m.mainTitle ? ` (${m.mainTitle})` : ''}</td>
              <td style="border:1px solid black; padding:8px;"></td>
           </tr>`).join('')}
      </table>
    `;
    setGeneratedDoc({ header: '', body });
  };

  const generateObservationRequest = () => {
    const effectivelyBlankMode = isBlankMode || selectedStudentIds.length === 0;
    let validStudents = selectedStudentIds.map(id => students.find(s => s.id === id)).filter(Boolean);
    
    if (effectivelyBlankMode && validStudents.length === 0) {
      validStudents = [{ id: 'placeholder', name: '..............................................', grade: '..........', number: '..........' } as unknown as Student];
    }
    
    if (validStudents.length === 0) return;

    const pages = validStudents.map((student, index) => {
      const header = `
        <div style="text-align:center; font-weight:bold; margin-bottom:1.5rem; line-height:1.4;">
          T.C.<br>
          ${institution.province.toUpperCase()} VALİLİĞİ<br>
          ${institution.name} MÜDÜRLÜĞÜ
        </div>`;

      return `
        ${header}
          <br>
          <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
               <div><b>Sayı</b> : ${institution.ebysCode}<br><b>Konu</b> : Öğrenci Davranış Gözlem Raporu</div>
               <div>${new Date().toLocaleDateString('tr-TR')}</div>
          </div>
          <br><br>
          <div style="text-align:center;"><b>${student!.grade} SINIFI REHBER ÖĞRETMENLİĞİNE</b></div>
          <br>
          <p style="text-indent:30px; text-align:justify; line-height:1.6;">
              Sınıfınız öğrencilerinden <b>${student!.number}</b> numaralı <b>${student!.name}</b> hakkında daha önce uygulanmış olan disiplin cezasının kaldırılıp kaldırılmayacağının değerlendirilmesi amacıyla Öğrenci Davranışlarını Değerlendirme Kurulu toplanacaktır.
          </p>
          <p style="text-indent:30px; text-align:justify; line-height:1.6;">
              İlgili yönetmelik gereği; öğrencinin ceza aldıktan sonraki süreçteki davranışları, ders içi tutumları ve arkadaşlık ilişkilerindeki olumlu/olumsuz değişimler hakkındaki görüşlerinizi içeren raporun hazırlanarak idareye teslim edilmesi hususunda;
          </p>
          <p style="text-indent:30px;">Gereğini rica ederim.</p>
          
          <div style="text-align:right; margin-top:40px;">
              <b>${institution.managerName}</b><br>Okul Müdürü
          </div>
          ${index < validStudents.length - 1 ? '<div style="page-break-after: always; margin-bottom: 20px;"></div>' : ''}
      `;
    });

    setGeneratedDoc({ header: '', body: pages.join('') });
  };

  const generateRemovalDecision = (executeDb: boolean = true) => {
    const effectivelyBlankMode = isBlankMode || selectedPenalties.length === 0;

    // Check if the form is partially filled out
    if (!effectivelyBlankMode && (!removalForm.decisionNo.trim() || !removalForm.date || !removalForm.reason.trim())) {
        const confirm = window.confirm("Karar no, tarih veya gerekçe kısımları eksik. Yine de taslak olarak oluşturmak ister misiniz?");
        if (!confirm) return;
    }

    if (!effectivelyBlankMode && executeDb && removalForm.resultType === 'removed') {
      executeRemovalInternal();
    }

    const regulationArticle = institution.type === 'Ortaokul' 
      ? 'Milli Eğitim Bakanlığı Okul Öncesi Eğitim ve İlköğretim Kurumları Yönetmeliğinin 58. Maddesi' 
      : 'Milli Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliğinin 171. Maddesi';

    const header = `
    <div style="text-align:center; font-weight:bold; margin-bottom:1.5rem; line-height:1.4;">
      T.C.<br>
      ${institution.province.toUpperCase()} VALİLİĞİ<br>
      ${institution.district} İLÇE MİLLİ EĞİTİM MÜDÜRLÜĞÜ<br>
      ${institution.name}
    </div>`;

    let studentsTableRows = '';
    
    if (effectivelyBlankMode) {
      studentsTableRows = `
            <tr>
                <td style="border:1px solid black; padding:4px; text-align:center;">1</td>
                <td style="border:1px solid black; padding:4px;">........</td>
                <td style="border:1px solid black; padding:4px;">..............................................</td>
                <td style="border:1px solid black; padding:4px; text-align:center;">........</td>
                <td style="border:1px solid black; padding:4px;">..../..../20.... tarihli .............................................................. cezası</td>
            </tr>`;
    } else {
        const groupedByStudentForDecision = Object.values(
          selectedPenalties.reduce((acc, p) => {
            if (!acc[p.studentId]) acc[p.studentId] = { studentId: p.studentId, penalties: [] };
            acc[p.studentId].penalties.push(p);
            return acc;
          }, {} as Record<string, {studentId: string, penalties: typeof selectedPenalties}>)
        );

        (groupedByStudentForDecision as any[]).forEach((group, idx) => {
            const student = students.find(s => s.id === group.studentId);
            if (student) {
                const penaltyTexts = group.penalties.map(sp => {
                    const penalty = removablePenalties.find(p => p.id === sp.penaltyId && p.type === sp.type && p.studentId === sp.studentId);
                    return penalty ? `${penalty.date || '-'} tarihli ${penalty.decision}` : null;
                }).filter(Boolean).join('<br/><br/>');
                
                studentsTableRows += `
                <tr>
                    <td style="border:1px solid black; padding:4px; text-align:center;">${idx + 1}</td>
                    <td style="border:1px solid black; padding:4px;">${student.number}</td>
                    <td style="border:1px solid black; padding:4px;">${student.name}</td>
                    <td style="border:1px solid black; padding:4px; text-align:center;">${student.grade}</td>
                    <td style="border:1px solid black; padding:4px;">${penaltyTexts}</td>
                </tr>`;
            }
        });
    }

    const titleText = removalForm.resultType === 'removed' ? 'CEZA KALDIRMA KARARI' : 'CEZA DEĞERLENDİRME KARARI';
    const studentsLabel = removalForm.resultType === 'removed' ? 'Cezası Kaldırılan Öğrenci/Öğrenciler:' : 'Cezası Değerlendirilen Öğrenci/Öğrenciler:';
    const penaltyHeader = removalForm.resultType === 'removed' ? 'Kaldırılan Ceza Bilgileri' : 'Değerlendirilen Ceza Bilgileri';
    const reasonLabel = removalForm.resultType === 'removed' ? 'Karar Gerekçesi (Davranışlardaki Olumlu Değişimler):' : 'Karar Gerekçesi:';
    
    const decisionText = removalForm.resultType === 'removed'
        ? `Okulumuz Öğrenci Davranışlarını Değerlendirme Kurulu, yukarıda bilgileri ve cezaları belirtilen öğrenci/öğrencilerin durumlarını görüşmek üzere toplanmıştır. Sınıf rehber öğretmeni/öğretmenleri tarafından gönderilen gözlem raporları incelenmiş ve ilgili öğrencinin/öğrencilerin ders yılı içerisindeki olumlu davranış değişiklikleri dikkate alınarak; <b>${regulationArticle}</b> gereğince, daha önceden almış oldukları disiplin cezalarının kaldırılmasına ve e-Okul sistemindeki karar ve eylem silinmeden, davranış puanlarının iadesine katılanların oy birliği/oy çokluğu ile karar verilmiştir.`
        : `Okulumuz Öğrenci Davranışlarını Değerlendirme Kurulu, yukarıda bilgileri ve cezaları belirtilen öğrenci/öğrencilerin durumlarını görüşmek üzere toplanmıştır. Sınıf rehber öğretmeni/öğretmenleri tarafından gönderilen gözlem raporları incelenmiş ve ilgili öğrencinin/öğrencilerin ders yılı içerisindeki davranışlarında cezanın kaldırılmasını gerektirecek olumlu bir değişiklik gözlemlenmediğinden; <b>${regulationArticle}</b> gereğince, daha önceden almış oldukları disiplin cezalarının devamına katılanların oy birliği/oy çokluğu ile karar verilmiştir.`;

    const body = `
      ${header}
      <br>
      <div style="text-align:center; font-weight:bold; margin-bottom:20px; font-size:14px; text-decoration:underline;">
          ÖĞRENCİ DAVRANIŞLARINI DEĞERLENDİRME KURULU ${titleText}
      </div>
      
      <table style="width:100%; border-collapse:collapse; border:1px solid black; margin-bottom:20px; font-size:10pt;">
          <tr>
              <td style="border:1px solid black; padding:8px; font-weight:bold; width:30%; background-color:#f9f9f9;">Karar Tarihi</td>
              <td style="border:1px solid black; padding:8px;">${removalForm.date ? new Date(removalForm.date).toLocaleDateString('tr-TR') : '.../.../20...'}</td>
          </tr>
          <tr>
              <td style="border:1px solid black; padding:8px; font-weight:bold; background-color:#f9f9f9;">Karar No</td>
              <td style="border:1px solid black; padding:8px;">${removalForm.decisionNo || '........'}</td>
          </tr>
          <tr>
              <td style="border:1px solid black; padding:8px; font-weight:bold; background-color:#f9f9f9;">Toplantı Yeri ve Tarihi</td>
              <td style="border:1px solid black; padding:8px;">${meetingData.location || 'Okul Müdürlüğü'} - ${meetingData.date ? new Date(meetingData.date).toLocaleDateString('tr-TR') : '.../.../20...'} ${meetingData.time || ''}</td>
          </tr>
      </table>

      <div style="font-weight:bold; margin-bottom:5px; font-size:10pt;">${studentsLabel}</div>
      <table style="width:100%; border-collapse:collapse; border:1px solid black; margin-bottom:20px; font-size:9pt; text-align:left;">
          <tr style="background-color:#f0f0f0; font-weight:bold; text-align:center;">
              <td style="border:1px solid black; padding:5px; width:5%;">S.N</td>
              <td style="border:1px solid black; padding:5px; width:15%;">Okul No</td>
              <td style="border:1px solid black; padding:5px; width:40%;">Adı Soyadı</td>
              <td style="border:1px solid black; padding:5px; width:10%;">Sınıfı</td>
              <td style="border:1px solid black; padding:5px; width:30%;">${penaltyHeader}</td>
          </tr>
          ${studentsTableRows}
      </table>

      <div style="font-weight:bold; margin-bottom:5px; font-size:10pt;">${reasonLabel}</div>
      <div style="border:1px solid black; padding:10px; min-height:80px; margin-bottom:20px; font-size:10pt; line-height:1.5;">
          ${removalForm.reason || 'Sınıf rehber öğretmeninin olumlu raporu ve kurul üyelerinin müspet kanaati neticesinde...'}
      </div>

      <div style="font-weight:bold; margin-bottom:5px; font-size:10pt;">Karar:</div>
      <p style="text-indent:30px; text-align:justify; line-height:1.6; font-size:10pt; margin-bottom:40px;">
          ${decisionText}
      </p>

      <div class="signature-block avoid-break" style="page-break-inside:avoid; break-inside:avoid; margin-top:25px;">
        <div style="font-weight:bold; margin-bottom:10px; text-align:center;">KARARA KATILAN KURUL ÜYELERİ</div>
        <table class="signatures-table" style="width:100%; border-collapse:collapse; border:none; margin-top:10px; text-align:center; font-size:10pt;">
            <tr>
              ${boardMembers.slice(0, 3).map(m => `
                  <td style="width:33%; padding:8px;">
                      <div><b>${m.mainName || '...........................'}</b></div>
                      <div style="font-size:9pt; color:#333;">${m.role}</div>
                      <div style="height:35px;"></div>
                  </td>
              `).join('')}
            </tr>
            ${boardMembers.length > 3 ? `
            <tr>
              ${boardMembers.slice(3, 6).map(m => `
                  <td style="width:33%; padding:8px;">
                      <div><b>${m.mainName || '...........................'}</b></div>
                      <div style="font-size:9pt; color:#333;">${m.role}</div>
                      <div style="height:35px;"></div>
                  </td>
              `).join('')}
            </tr>` : ''}
        </table>
        
        <div class="approval-block avoid-break" style="text-align:center; margin-top:25px; page-break-inside:avoid; break-inside:avoid;">
            <div>UYGUNDUR</div>
            <div>${new Date().toLocaleDateString('tr-TR')}</div>
            <br><br>
            <b>${institution.managerName || '...........................'}</b><br>
            Okul Müdürü
        </div>
      </div>
    `;

    setGeneratedDoc({ header: '', body });
  };


  // --- UTILS & EXPORT (WORD, PDF, PRINT) ---
  const buildFullDocumentHtml = (): { html: string; filename: string } | null => {
    const docElement = document.getElementById('document-preview');
    if (!docElement && !generatedDoc) {
      return null;
    }

    const filename = `Ceza_Kaldirma_Karari_${selectedStudentIds[0] || 'Evrak'}`;
    let bodyHtml = generatedDoc?.body || '';
    const liveEditable = docElement?.querySelector('[contenteditable]');
    if (liveEditable) {
      bodyHtml = liveEditable.innerHTML;
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
      h1, h2, h3, h4 {
        page-break-after: avoid !important;
        break-after: avoid !important;
      }
      p, div {
        orphans: 3 !important;
        widows: 3 !important;
      }
      .print\\:hidden, .print-hide, .page-marker, [data-html2canvas-ignore="true"] {
        display: none !important;
      }
      ${fitToPage ? cssFitPage : ''}
    </style>
  </head>
  <body class="bg-white">
    <div class="print-container">
      <div class="document-entry">
        <div class="doc-content ${fitToPage ? 'print-fit-page' : ''}" style="font-size:${docFontSize}pt;">
          ${bodyHtml}
        </div>
      </div>
    </div>
  </body>
</html>`;

    return { html, filename };
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

  const handleDownloadWord = async () => {
    if (!generatedDoc) return;
    const docElement = document.getElementById('document-preview');
    let bodyHtml = generatedDoc.body;
    const liveEditable = docElement?.querySelector('[contenteditable]');
    if (liveEditable) {
      bodyHtml = liveEditable.innerHTML;
    }

    const filename = `Ceza_Kaldirma_Karari_${selectedStudentIds[0] || 'Evrak'}`;

    try {
      await exportHtmlToWord(bodyHtml, filename, {
        fontSize: docFontSize,
        margins: activeMargin
      });
    } catch (docxErr) {
      console.error('Word export error:', docxErr);
      alert('Word belgesi oluşturulurken bir hata meydana geldi: ' + docxErr);
    }
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
        // Native Chromium printToPDF with showSaveDialog IPC
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
        // Web fallback: CSS @media print
        printHtmlViaIframe(html);
      }
    } catch (err: any) {
      console.error(err);
      alert('PDF oluşturulurken bir hata oluştu: ' + (err.message || err));
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const removedList = getRemovedPenaltiesList();
  const filteredRemovedList = removedList.filter(item => 
    item.student.name.toLowerCase().includes(archiveSearchTerm.toLowerCase()) ||
    item.student.number.includes(archiveSearchTerm) ||
    item.decision.toLowerCase().includes(archiveSearchTerm.toLowerCase())
  );

  const ZoomControls = () => (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-4 z-50 transition-opacity hover:opacity-100 opacity-80 print:hidden">
        <button onClick={() => setDocFontSize(prev => Math.max(prev - 1, 8))} className="hover:text-amber-300 transition-colors flex items-center justify-center font-bold font-serif w-6" title="Punto Küçült">A-</button>
        <span className="text-[10px] font-mono text-slate-400">{docFontSize}pt</span>
        <button onClick={() => setDocFontSize(prev => Math.min(prev + 1, 24))} className="hover:text-amber-300 transition-colors flex items-center justify-center font-bold font-serif text-lg w-6" title="Punto Büyüt">A+</button>
        <div className="w-px h-4 bg-slate-600 mx-1"></div>
        <button 
            onClick={() => setFitToPage(!fitToPage)} 
            className={`transition-colors flex items-center gap-1.5 font-medium px-2.5 py-1 rounded ${fitToPage ? 'bg-emerald-600 text-white font-bold' : 'text-slate-300 hover:text-white'}`} 
            title="Evrakı tek bir sayfaya sığdırır, tarih ve imzanın 2. sayfaya taşmasını önler"
        >
            <Minimize2 className="w-3.5 h-3.5" />
            <span className="text-[11px]">{fitToPage ? 'Tek Sayfa (Açık)' : 'Tek Sayfaya Sığdır'}</span>
        </button>
        <div className="w-px h-4 bg-slate-600 mx-1"></div>
        <button onClick={() => setZoom(z => Math.max(0.5, z - 0.1))} className="hover:text-indigo-400"><ZoomOut className="w-4 h-4" /></button>
        <span className="text-xs font-mono w-10 text-center">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(2.0, z + 0.1))} className="hover:text-indigo-400"><ZoomIn className="w-4 h-4" /></button>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#f8fafc]">
      <style dangerouslySetInnerHTML={{ __html: cssFitPage }} />
      {/* Visual Header / Brand Bar */}
      <div className="bg-white border-b border-slate-200 px-8 py-5 shadow-sm z-10 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-500">Disiplin Modülü</h1>
            <ChevronRight className="w-5 h-5 text-slate-300" />
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-indigo-600" /> Ceza İade & Silme Yönetimi
            </h2>
        </div>

        {/* Dynamic Nav-Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-lg border border-slate-200 shadow-inner">
          <button 
            onClick={() => setActiveTab('removal')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
              activeTab === 'removal' 
                ? 'bg-white text-indigo-700 shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            Ceza Kaldırma İşlemi (Evrak)
          </button>
          <button 
            onClick={() => setActiveTab('archive')}
            className={`px-4 py-2 text-xs font-bold rounded-md transition-all flex items-center gap-2 ${
              activeTab === 'archive' 
                ? 'bg-white text-indigo-700 shadow'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            Silinen Cezalar Arşivi ({removedList.length})
          </button>
        </div>
      </div>

      {/* Main Body */}
      {activeTab === 'removal' ? (
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          
          {/* LEFT PANEL: CONFIGURATOR */}
          <div className="w-full md:w-1/3 bg-white border-r border-slate-200 flex flex-col z-0 overflow-y-auto">
            <div className="p-6 space-y-6">

                {actionFeedback && (
                  <div className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between animate-fade-in ${actionFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                    <div className="flex items-center gap-2">
                      {actionFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
                      <span>{actionFeedback.message}</span>
                    </div>
                    <button onClick={() => setActionFeedback(null)} className="text-slate-400 hover:text-slate-600 text-sm font-bold ml-2">×</button>
                  </div>
                )}
                
                {/* 1. Student Selection */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 text-sm uppercase tracking-wide">
                        <Users className="w-4 h-4 text-blue-600" />
                        1. Cezalı Öğrenci/Öğrencileri Seçimi
                    </h3>
                    <div className="relative border border-slate-200 rounded-lg overflow-y-auto max-h-40 bg-white">
                        {eligibleStudents.length === 0 && <div className="p-3 text-sm text-slate-500">Sistemde cezası bulunan öğrenci yok.</div>}
                        {eligibleStudents.map(s => (
                            <label key={s.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0">
                                <input 
                                    type="checkbox" 
                                    checked={selectedStudentIds.includes(s.id)} 
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedStudentIds([...selectedStudentIds, s.id]);
                                        else {
                                            setSelectedStudentIds(selectedStudentIds.filter(id => id !== s.id));
                                            setSelectedPenalties(selectedPenalties.filter(p => p.studentId !== s.id));
                                        }
                                    }}
                                    className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm text-slate-700">{s.number} - {s.name} ({s.grade})</span>
                            </label>
                        ))}
                    </div>

                    {selectedStudentIds.length > 0 && removablePenalties.length > 0 && (
                         <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 text-sm space-y-2 mt-2">
                             <label className="block text-xs font-bold text-indigo-800">Kaldırılacak Yaptırımları Seçin</label>
                             <div className="max-h-60 overflow-y-auto border border-indigo-200 rounded bg-white">
                                 {Object.values(
                                     removablePenalties.reduce((acc, pen) => {
                                         if (!acc[pen.studentId]) acc[pen.studentId] = { studentId: pen.studentId, student: students.find(s => s.id === pen.studentId), penalties: [] };
                                         acc[pen.studentId].penalties.push(pen);
                                         return acc;
                                     }, {} as Record<string, {studentId: string, student: typeof students[0], penalties: typeof removablePenalties}>)
                                 ).map((group: any) => (
                                     <div key={group.studentId} className="border-b border-indigo-100 last:border-0 pb-1 mb-1 last:mb-0 last:pb-0">
                                         <div className="p-2 bg-indigo-50/50 font-bold text-xs text-indigo-900 border-b border-indigo-50">
                                             {group.student?.name} ({group.student?.number})
                                         </div>
                                         {group.penalties.map(pen => {
                                             const isSelected = selectedPenalties.some(p => p.studentId === pen.studentId && p.penaltyId === pen.id && p.type === pen.type);
                                             return (
                                                 <label key={`${pen.studentId}-${pen.type}-${pen.id}`} className="flex items-start gap-2 p-2 hover:bg-slate-50 cursor-pointer ml-2">
                                                     <input 
                                                         type="checkbox" 
                                                         checked={isSelected}
                                                         onChange={(e) => {
                                                             if (e.target.checked) setSelectedPenalties([...selectedPenalties, { studentId: pen.studentId, penaltyId: pen.id, type: pen.type }]);
                                                             else setSelectedPenalties(selectedPenalties.filter(p => !(p.studentId === pen.studentId && p.penaltyId === pen.id && p.type === pen.type)));
                                                         }}
                                                         className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
                                                     />
                                                     <div className="flex flex-col">
                                                         <span className="text-[11px] text-slate-700 font-medium shrink-0 text-wrap">[{pen.type === 'active' ? 'YENİ/AKTİF' : 'GEÇMİŞ'}] {pen.date || '-'} tarihli {pen.decision}</span>
                                                     </div>
                                                 </label>
                                             );
                                         })}
                                     </div>
                                 ))}
                             </div>
                         </div>
                    )}
                </div>

                {/* 2. Official Board Decision Form (To execute the DB removal) */}
                {selectedStudentIds.length > 0 && selectedPenalties.length > 0 && (
                  <div className="space-y-3 bg-emerald-50/30 p-4 rounded-xl border border-emerald-100 shadow-sm animate-fade-in">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 text-sm uppercase tracking-wide">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        2. Resmi Karar İade Bilgileri
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Karar Sonucu</label>
                            <select
                                value={removalForm.resultType}
                                onChange={e => {
                                    const newType = e.target.value as 'removed' | 'continued';
                                    const defaultRemovedReason = 'Öğrencinin ceza aldığı tarihten itibaren sergilediği olumlu tutum ve davranışlar, sınıf rehber öğretmeni ve rehberlik servisinin olumlu gözlem raporları ile kurul kurul üyelerinin mutabakatı doğrultusunda ilgili madde gereği cezasının kaldırılmasına ve davranış puanının iadesine karar verilmiştir.';
                                    const defaultContinuedReason = 'Öğrencinin ceza aldığı tarihten itibaren sergilediği tutum ve davranışlar, sınıf rehber öğretmeni ve rehberlik servisinin gözlem raporları incelendiğinde, davranışlerinde cezanın kaldırılmasını gerektirecek yeterli olumlu değişiklik gözlemlenmemiş olup, ilgili madde gereği disiplin cezasının devamına oy birliği/oy çokluğu ile karar verilmiştir.';
                                    
                                    let newReason = removalForm.reason;
                                    if (newType === 'continued' && (newReason === defaultRemovedReason || newReason === '')) {
                                        newReason = defaultContinuedReason;
                                    } else if (newType === 'removed' && (newReason === defaultContinuedReason || newReason === '')) {
                                        newReason = defaultRemovedReason;
                                    }
                                    
                                    setRemovalForm({...removalForm, resultType: newType, reason: newReason});
                                }}
                                className="w-full p-2 border rounded bg-white text-xs font-bold text-slate-700 focus:border-emerald-500"
                            >
                                <option value="removed">Ceza Kaldırılsın</option>
                                <option value="continued">Ceza Devam Etsin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Tarih</label>
                            <input 
                              type="date" 
                              value={removalForm.date} 
                              onChange={e => setRemovalForm({...removalForm, date: e.target.value})} 
                              className="w-full p-2 border rounded bg-white text-xs font-medium text-slate-700" 
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Karar Sayısı / No</label>
                        <input 
                            type="text" 
                            value={removalForm.decisionNo} 
                            onChange={e => setRemovalForm({...removalForm, decisionNo: e.target.value})} 
                            className="w-full p-2 border rounded bg-white text-xs font-bold text-slate-700 focus:border-emerald-500"
                            placeholder="K-2026/12"
                        />
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1">Karar Gerekçesi</label>
                         <textarea 
                           rows={3}
                           value={removalForm.reason} 
                           onChange={e => setRemovalForm({...removalForm, reason: e.target.value})} 
                           className="w-full p-2 border rounded bg-white text-xs text-slate-600 focus:border-emerald-500"
                           placeholder="Kurul kararı gerekçesi..."
                         />
                    </div>

                    {removalForm.resultType === 'removed' ? (
                        <button
                        onClick={handleRemovePenaltyExecute}
                        className="w-full mt-2 bg-emerald-600 text-white font-bold p-2.5 rounded hover:bg-emerald-700 transition-all text-xs flex items-center justify-center gap-2 shadow"
                        >
                        <Check className="w-4 h-4" />
                        Cezayı Kaldır ve Puanı İade Et (Sisteme İşle)
                        </button>
                    ) : (
                        <button
                        disabled
                        className="w-full mt-2 bg-slate-200 text-slate-500 font-bold p-2.5 rounded text-xs flex items-center justify-center gap-2"
                        title="Ceza devam ettiği için sistemde aktif olarak kalmaya devam edecektir. Herhangi bir kayıt işlemi gerekmez."
                        >
                        <AlertCircle className="w-4 h-4" />
                        Ceza Devam Ediyor (Sistemde İşlem Gerekmez)
                        </button>
                    )}
                  </div>
                )}

                {/* 3. Meeting Document Details for Evrak Print */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2 text-sm uppercase tracking-wide">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        3. Belge / Toplantı Bilgileri
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Tarih</label>
                            <input type="date" value={meetingData.date} onChange={e => setMeetingData({...meetingData, date: e.target.value})} className="w-full p-2 border rounded bg-white text-xs" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Saat</label>
                            <input type="time" value={meetingData.time} onChange={e => setMeetingData({...meetingData, time: e.target.value})} className="w-full p-2 border rounded bg-white text-xs" />
                        </div>
                    </div>
                    <div>
                         <label className="block text-xs font-bold text-slate-500 mb-1">Toplantı Yeri</label>
                         <div className="relative">
                            <MapPin className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <select 
                                value={meetingData.location} 
                                onChange={e => setMeetingData({...meetingData, location: e.target.value})} 
                                className="w-full pl-9 p-2 border rounded bg-white text-xs appearance-none focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            >
                                <option value="Okul Müdürü Odası">Okul Müdürü Odası</option>
                                <option value="Müdür Yardımcısı Odası">Müdür Yardımcısı Odası</option>
                                <option value="Öğretmenler Odası">Öğretmenler Odası</option>
                            </select>
                         </div>
                    </div>
                </div>

                {/* 4. Actions for Generating Documents */}
                <div className="space-y-3 pt-4 border-t border-slate-200">
                    <button 
                        onClick={generateMeetingCall}
                        disabled={selectedPenalties.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold"
                    >
                        <Users className="w-4 h-4" />
                        Kurul Toplantı Çağrı Belgesi Oluştur
                    </button>
                    
                    <button 
                        onClick={generateObservationRequest}
                        disabled={selectedStudentIds.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 text-slate-700 p-2.5 rounded-lg hover:bg-slate-50 transition-colors text-xs"
                    >
                        <FileText className="w-4 h-4" />
                        Öğretmen Görüş Rapor İstem Yazısı
                    </button>

                    {removalForm.resultType === 'removed' ? (
                      <div className="space-y-2">
                        <button 
                            onClick={() => generateRemovalDecision(true)}
                            disabled={selectedPenalties.length === 0}
                            className="w-full flex items-center justify-center gap-2 text-white p-3 rounded-lg bg-emerald-600 border border-emerald-700 hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold"
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Ceza Kaldırma Kararı Oluştur ve Sisteme İşle (Puanı İade Et)
                        </button>
                        <button 
                            onClick={() => generateRemovalDecision(false)}
                            disabled={selectedPenalties.length === 0}
                            className="w-full flex items-center justify-center gap-2 text-slate-700 p-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 transition-colors text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            Sadece Taslak Karar Metni Önizle (Sisteme İşleme)
                        </button>
                      </div>
                    ) : (
                      <button 
                          onClick={() => generateRemovalDecision(false)}
                          disabled={selectedPenalties.length === 0}
                          className="w-full flex items-center justify-center gap-2 text-white p-2.5 rounded-lg bg-slate-600 border border-slate-700 hover:bg-slate-700 transition-colors text-xs font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                          <CheckCircle2 className="w-4 h-4" />
                          Ceza Devamı Kurul Kararı Oluştur
                      </button>
                    )}

                    <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-lg text-xs text-amber-900 flex gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
                        <span>
                            <strong>Mevzuat Hatırlatması:</strong> {institution.type === 'Ortaokul' ? 'MEB İlköğretim Kurumları Yönetmeliği 58. Maddesi' : 'MEB Ortaöğretim Kurumları Yönetmeliği 171. Maddesi'} uyarınca, olumlu gelişim gösteren öğrencilerin disiplin yaptırımları öğretmen raporları ve Öğrenci Davranışlarını Değerlendirme Kurulu kararıyla kaldırılabilir.
                        </span>
                    </div>
                </div>

            </div>
          </div>

          {/* RIGHT PANEL: DOCUMENT PREVIEW */}
          <div className="flex-1 bg-slate-100 p-8 overflow-y-auto flex flex-col items-center relative">
              <div className="w-full max-w-[210mm] flex justify-between items-center mb-4 bg-white p-3 rounded-lg shadow-sm border border-slate-200">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                  <Layout className="w-4 h-4 text-indigo-600" />
                  RESMİ EVRAK ÖNİZLEME
                </span>
                <div className="flex flex-wrap items-center gap-2">
                    {/* Word / Office Kenar Boşlukları Menüsü */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowMarginMenu(!showMarginMenu)} 
                            className={`text-xs px-3 py-1.5 rounded-md font-bold transition-all flex items-center justify-center gap-1.5 border shadow-xs ${
                                marginPreset === 'normal'
                                ? 'bg-indigo-50 text-indigo-800 border-indigo-300 hover:bg-indigo-100'
                                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                            }`}
                            title="Word / Excel kenar boşlukları standardını seçin (Üst, Alt, Sol, Sağ)"
                        >
                            <Layout className="w-3.5 h-3.5 text-indigo-600" />
                            <span className="hidden sm:inline">Kenar:</span>
                            <span className="font-extrabold text-indigo-700">{activeMargin.badge}</span>
                            <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>

                        {showMarginMenu && (
                            <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 animate-in fade-in zoom-in-95 duration-150">
                                <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                                    <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                                        <Sliders className="w-3 h-3 text-indigo-600" />
                                        Office / Word Kenar Boşlukları
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                        Çok sayfalı veya tek sayfalı evrakların tüm kenarlarına tam uygulanır.
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    {Object.values(PAGE_MARGINS).map((preset) => (
                                        <button
                                            key={preset.id}
                                            onClick={() => handleSelectMargin(preset.id)}
                                            className={`w-full text-left p-2 rounded-lg transition-colors flex items-start justify-between gap-1.5 text-xs ${
                                                marginPreset === preset.id 
                                                    ? 'bg-indigo-50 text-indigo-900 font-bold border border-indigo-200' 
                                                    : 'hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-1 font-bold">
                                                    <span>{preset.name}</span>
                                                    {preset.id === 'normal' && (
                                                        <span className="text-[8px] bg-emerald-100 text-emerald-800 px-1 py-0.5 rounded">Word Standart</span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-normal mt-0.5">{preset.description}</div>
                                            </div>
                                            {marginPreset === preset.id && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={toggleFitToPage} 
                        className={`text-xs px-3 py-1.5 rounded-md font-bold transition-all flex items-center justify-center gap-1.5 border shadow-xs ${
                            fitToPage 
                            ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700 ring-2 ring-emerald-300' 
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                        title="Evrakı tek bir sayfaya sığdırır, tarih ve imzanın 2. sayfaya taşmasını önler"
                    >
                        <Minimize2 className="w-3.5 h-3.5" />
                        <span>{fitToPage ? '✓ Tek Sayfa' : 'Tek Sayfaya Sığdır'}</span>
                    </button>
                    <button 
                        onClick={() => setIsBlankMode(!isBlankMode)} 
                        className={`text-xs px-3 py-1.5 rounded-md font-bold transition-all flex items-center justify-center gap-1 ${isBlankMode ? 'bg-orange-100 text-orange-700 border-orange-200 border' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50 border'}`}
                    >
                        {isBlankMode ? 'Boş Şablon Kapat' : 'Boş Şablon Aç'}
                    </button>
                    {generatedDoc && (
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={handleDownloadWord}
                          className="text-xs bg-blue-50 border border-blue-200 text-blue-700 px-2.5 py-1.5 rounded-md hover:bg-blue-100 flex items-center gap-1.5 cursor-pointer"
                          title="Evrakı gerçek Word (.docx) formatında indirir"
                        >
                          <FileText className="w-3.5 h-3.5 text-blue-600" />
                          Word (.docx) İndir
                        </button>
                        <button 
                          onClick={handleDownloadPdf}
                          disabled={isPdfGenerating}
                          className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1.5 rounded-md hover:bg-indigo-100 flex items-center gap-1.5"
                        >
                          {isPdfGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          PDF İndir
                        </button>
                        <button onClick={handlePrint} className="text-xs bg-white border border-slate-200 text-slate-600 px-2.5 py-1.5 rounded-md hover:bg-slate-50 flex items-center gap-1.5">
                          <Printer className="w-3.5 h-3.5" /> Yazdır
                        </button>
                      </div>
                    )}
                </div>
              </div>
              
              {generatedDoc ? (
                   <div 
                      style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s' }}
                      className={`mb-20 mx-auto w-[210mm] relative`}
                   >
                      {/* Word Margin Indicator Header */}
                      <div data-html2canvas-ignore="true" className="print:hidden mb-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs flex items-center justify-between text-xs text-slate-600">
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <Layout className="w-3.5 h-3.5 text-indigo-600" />
                              <span>{activeMargin.name}</span>
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-mono font-normal">A4 Portre</span>
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                              Üst: {activeMargin.top}mm • Alt: {activeMargin.bottom}mm • Sol: {activeMargin.left}mm • Sağ: {activeMargin.right}mm
                          </div>
                      </div>

                      <div 
                          id="document-preview"
                          ref={previewRef}
                          style={{ 
                              paddingTop: `${activeMargin.top}mm`,
                              paddingBottom: `${activeMargin.bottom}mm`,
                              paddingLeft: `${activeMargin.left}mm`,
                              paddingRight: `${activeMargin.right}mm`,
                              fontSize: `${docFontSize}px` 
                          }}
                          className={`bg-white text-black font-serif shadow-2xl document-page w-[210mm] min-h-[297mm] h-auto relative ${fitToPage ? 'print-fit-page' : ''}`}
                      >
                          {/* Visual Word Multi-page Dividers at each 297mm */}
                          {[1, 2, 3, 4].map(pageNum => (
                            <React.Fragment key={pageNum}>
                              <div 
                                data-html2canvas-ignore="true"
                                className="page-marker absolute left-0 w-full flex items-center justify-between z-10 print:hidden pointer-events-none px-4"
                                style={{ top: `${pageNum * 297}mm`, transform: 'translateY(-50%)' }}
                              >
                                <div className="h-px bg-slate-300 flex-1 border-t border-dashed border-slate-400"></div>
                                <span className="mx-3 px-2 py-0.5 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 rounded shadow-xs">
                                  Sayfa {pageNum} Sonu / Sayfa {pageNum + 1} Başlangıcı (Office Üst Boşluk: {activeMargin.top}mm)
                                </span>
                                <div className="h-px bg-slate-300 flex-1 border-t border-dashed border-slate-400"></div>
                              </div>
                              <div 
                                data-html2canvas-ignore="true"
                                className="page-marker absolute right-8 text-[10px] text-slate-400 font-medium print:hidden pointer-events-none z-10"
                                style={{ top: `calc(${pageNum * 297}mm - 20px)` }}
                              >
                                Sayfa {pageNum}
                              </div>
                            </React.Fragment>
                          ))}

                          <div 
                              contentEditable
                              suppressContentEditableWarning
                              className="outline-none h-full leading-relaxed relative z-0"
                              dangerouslySetInnerHTML={{ __html: generatedDoc.body }}
                          />
                      </div>
                   </div>
              ) : (
                  <div className="flex flex-col items-center justify-center my-auto text-slate-400">
                      <FileText className="w-16 h-16 mb-4 opacity-30 text-indigo-600" />
                      <p className="font-medium">Resmi evrak hazırlamak için soldaki "Belge Oluştur" butonlarını kullanın.</p>
                      <p className="text-xs text-slate-400 mt-1">Önizleme ekranında metinler üzerinde doğrudan düzenleme de yapabilirsiniz.</p>
                  </div>
              )}

              {generatedDoc && <ZoomControls />}
          </div>

        </div>
      ) : (
        /* ARCHIVE TAB CONTENT (LIST OF REMOVED PENALTIES AND COMPREHENSIVE TIMELINE HISTORY LOOKUP) */
        <div className="flex-1 overflow-y-auto p-8 space-y-8 max-w-7xl mx-auto w-full">
            
            {/* Top Stat Cards & Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 p-6 rounded-2xl flex items-center gap-4 shadow-sm">
                    <div className="bg-emerald-600 p-3.5 rounded-xl text-white">
                        <Award className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-xs text-teal-800 font-bold block uppercase tracking-wide">Cezası İptal Edilen / Silinen</span>
                        <h4 className="text-2xl font-black text-emerald-950 mt-1">{removedList.length} Karar</h4>
                        <span className="text-[11px] text-teal-700/80 font-medium leading-normal block">Davranış Puanı Tamamen İade Edilmiş Öğrenciler</span>
                    </div>
                </div>

                <div className="bg-indigo-50/50 border border-indigo-100 p-6 rounded-2xl flex items-center gap-4 shadow-sm col-span-2">
                    <div className="bg-indigo-600 p-3.5 rounded-xl text-white shrink-0">
                        <History className="w-6 h-6" />
                    </div>
                    <div>
                        <span className="text-xs text-indigo-800 font-bold block uppercase tracking-wide">Mevzuat Güvencesi ve Sicil Temizliği</span>
                        <p className="text-xs text-slate-600 mt-1 leading-normal">
                            MEB Kurumları Yönetmeliği gereği, Öğrenci Davranışlarını Değerlendirme Kurulu tarafından durumları olumlu değerlendirilen öğrencilerin yaptırımları iade edilerek dönem/ders yılı sonu karnelerine ve e-Okul sicillerine <u>yansıtılmaz</u>. Bu panel, yapılan resmi iade kararlarının kalıcı arşivini tutar.
                        </p>
                    </div>
                </div>
            </div>

            {/* Split Section: Archive table on left/top, Timeline Lookup on right */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* Visual Archive Grid (2 Cols span) */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b pb-4 mb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-emerald-600" />
                                    Resmi Silinmiş Disiplin Cezaları Arşivi
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">İade kararı e-okul sistemine girilmiş öğrencilerin arşivi</p>
                            </div>
                            <div className="relative max-w-xs w-full">
                                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                <input 
                                  type="text" 
                                  placeholder="Öğrenci ara..." 
                                  value={archiveSearchTerm}
                                  onChange={e => setArchiveSearchTerm(e.target.value)}
                                  className="w-full pl-9 p-2 border border-slate-200 bg-slate-50 rounded-lg text-xs outline-none focus:bg-white"
                                />
                            </div>
                        </div>

                        {filteredRemovedList.length === 0 ? (
                           <div className="p-8 text-center text-slate-400">
                               <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-20 text-indigo-700" />
                               <p className="text-sm font-medium">Arşivde kayıt bulunmamaktadır.</p>
                               <p className="text-xs text-slate-400 mt-1">Herhangi bir ceza kaldırma işlemi yapıldıktan sonra kayıtlar burada listelenir.</p>
                           </div>
                        ) : (
                           <div className="overflow-x-auto">
                              <table className="w-full text-left text-xs text-slate-700">
                                 <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                                       <th className="p-3">Öğrenci No/Adı</th>
                                       <th className="p-3">Kaldırılan Ceza (Asıl)</th>
                                       <th className="p-3">İade Karar Bilgisi</th>
                                       <th className="p-3">Değerlendirme Gerekçesi</th>
                                       <th className="p-3 text-center">İşlem</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                    {filteredRemovedList.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3">
                                                <div className="font-bold text-slate-950">{item.student.name}</div>
                                                <div className="text-[10px] text-slate-500">{item.student.number} - {item.student.grade}</div>
                                            </td>
                                            <td className="p-3">
                                                <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px] mb-1">
                                                  {item.decision}
                                                </span>
                                                <div className="text-[10px] text-slate-500 italic uppercase">Puan Değeri: -{item.penaltyScore} Puan</div>
                                                <div className="text-[9px] text-slate-400">Tar: {item.originalDate} / {item.originalDecisionNo}</div>
                                            </td>
                                            <td className="p-3">
                                                 <div className="font-bold text-emerald-800 flex items-center gap-1">
                                                   <CheckCircle2 className="w-3.5 h-3.5" />
                                                   {item.removedDecisionNo}
                                                 </div>
                                                 <div className="text-[10px] text-slate-600 mt-0.5">{item.removedDate}</div>
                                            </td>
                                            <td className="p-3 max-w-[200px] break-words text-slate-600 italic leading-relaxed text-[11px]">
                                                "{item.removedReason}"
                                            </td>
                                            <td className="p-3 text-center">
                                                <button 
                                                  onClick={() => handleUndoPenaltyRemoval(item.student.id, item.itemId, item.type)}
                                                  className="bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 px-2 py-1 rounded text-[10px] font-bold transition-all shadow-sm"
                                                  title="İadeyi İptal Et (Cezayı Yeniden Aktifleştir)"
                                                >
                                                   Geri Al
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        )}
                    </div>
                </div>

                {/* DETAILED STUDENT PENALTY TIMELINE LOOKUP (1 Col span) */}
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-full flex flex-col">
                        <div className="border-b pb-4 mb-4">
                            <h3 className="text-sm font-bold text-indigo-950 flex items-center gap-2 uppercase tracking-wide">
                                <History className="w-4 h-4 text-indigo-600" />
                                Öğrenci Ceza Geçmişi Gözlem Paneli
                            </h3>
                            <p className="text-xs text-slate-505 mt-0.5 text-slate-500">
                                Branş/Sınıf bazlı tüm aktif ve silinmiş eski disiplin geçmişini gözlemleyin.
                            </p>
                        </div>

                        {/* Dropdown lookup for ALL students */}
                        <div className="space-y-3 mb-6">
                            <label className="block text-xs font-bold text-slate-600">Öğrenci Seçiniz</label>
                            <select 
                              value={historyStudentId}
                              onChange={e => setHistoryStudentId(e.target.value)}
                              className="w-full p-2.5 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 bg-slate-50 outline-none focus:border-indigo-500"
                            >
                               <option value="">-- Tüm Öğrenciler Listesi --</option>
                               {students.map(s => (
                                   <option key={s.id} value={s.id}>{s.number} - {s.name} ({s.grade})</option>
                               ))}
                            </select>
                        </div>

                        {/* Chronology Timeline view */}
                        {!historyStudentId ? (
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400 border border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                <Clock className="w-8 h-8 text-slate-300 mb-2" />
                                <p className="text-xs font-semibold">Tarihçe Yüklenmedi</p>
                                <p className="text-[10px] text-slate-400">Öğrenci seçimi yaptıktan sonra disiplin sicil kartı burada listelenecektir.</p>
                            </div>
                        ) : (
                          <div className="flex-1 space-y-4 overflow-y-auto max-h-[480px] custom-scrollbar">
                             {(() => {
                                 const student = students.find(s => s.id === historyStudentId);
                                 const timeline = getStudentHistoryTimeline(historyStudentId);
                                 
                                 if (!student) return null;

                                 return (
                                     <div className="space-y-4">
                                         
                                         {/* Simple Info Header card */}
                                         <div className="bg-slate-50 border p-3 rounded-xl flex justify-between items-center text-xs">
                                             <div>
                                                 <div className="font-bold text-slate-900">{student.name}</div>
                                                 <div className="text-slate-500">Gelişim Durumu</div>
                                             </div>
                                             <div className="text-right">
                                                 <span className="text-[10px] font-bold text-slate-500 uppercase">Aktif Davranış Notu</span>
                                                 {(() => {
                                                     const computedActiveDeducted = timeline.filter(t => t.category === 'active').reduce((acc, t) => {
                                                         const val = parseInt(t.penaltyScore || '0', 10);
                                                         return acc + (isNaN(val) || val <= 0 ? 10 : val);
                                                     }, 0);
                                                     const remainingScore = Math.max(0, 100 - computedActiveDeducted);
                                                     return (
                                                         <div className={`text-lg font-black ${remainingScore > 85 ? 'text-emerald-600' : remainingScore > 65 ? 'text-amber-600' : 'text-red-650'}`}>
                                                            {remainingScore} / 100
                                                         </div>
                                                     );
                                                 })()}
                                             </div>
                                         </div>

                                         {/* Timeline Stream */}
                                         <div className="relative border-l-2 border-slate-200 pl-4 ml-2 space-y-6">
                                             {timeline.length === 0 ? (
                                                 <div className="text-xs text-slate-400 italic py-4">
                                                     Öğrenciye ait hiçbir aktif veya geçmiş yaptırım kaydı bulunmamaktadır.
                                                 </div>
                                             ) : (
                                                 timeline.map((item, tIdx) => (
                                                     <div key={tIdx} className="relative">
                                                         
                                                         {/* Decorative point on timeline line */}
                                                         <span className={`absolute -left-[21px] top-1 w-3 h-3 rounded-full border-2 border-white ${
                                                             item.category === 'removed' ? 'bg-emerald-500' : 'bg-red-500'
                                                         }`} />
                                                         
                                                         <div className="bg-white border rounded-xl p-3.5 shadow-sm space-y-2">
                                                             <div className="flex justify-between items-start gap-2">
                                                                 <span className="text-[9px] font-bold text-slate-400 block uppercase">{item.originalDate}</span>
                                                                 {item.category === 'removed' ? (
                                                                     <span className="text-[8px] bg-emerald-50 text-emerald-800 border border-emerald-100 font-extrabold px-1.5 py-0.2 rounded uppercase shrink-0">
                                                                         Puan İade Edildi (Kararla Silindi)
                                                                     </span>
                                                                 ) : (
                                                                     <span className="text-[8px] bg-red-50 text-red-700 border border-red-100 font-extrabold px-1.5 py-0.2 rounded uppercase shrink-0">
                                                                         Yaptırım Cezası Aktif
                                                                     </span>
                                                                 )}
                                                             </div>

                                                             <div>
                                                                 <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                                                                     {item.decision} 
                                                                     <span className={item.category === 'removed' ? 'text-emerald-600 line-through text-[11px]' : 'text-red-600 text-[11px] font-bold'}>
                                                                        (-{item.penaltyScore} Puan)
                                                                     </span>
                                                                 </h4>
                                                                 <p className="text-[10.5px] text-slate-500 mt-1 italic">
                                                                     "{item.description}"
                                                                 </p>
                                                                 {item.originalDecisionNo && (
                                                                     <div className="text-[9px] text-slate-400 mt-0.5">Asıl Karar No: {item.originalDecisionNo}</div>
                                                                 )}
                                                             </div>

                                                             {/* Details of Removal if applicable */}
                                                             {item.category === 'removed' && (
                                                                  <div className="bg-emerald-50/50 rounded-lg p-2.5 border border-emerald-100/60 mt-2 text-[10px] space-y-1">
                                                                      <div className="font-bold text-emerald-900 flex items-center gap-1">
                                                                          <CheckCircle2 className="w-3 h-3" />
                                                                          Ceza Kaldırma Karar No: {item.removedDecisionNo}
                                                                      </div>
                                                                      <div className="text-slate-500 font-medium">Tarih: {item.removedDate}</div>
                                                                      <div className="text-slate-600 italic block mt-1 bg-white p-1 rounded border border-emerald-50">
                                                                          Gerekçe: "{item.removedReason}"
                                                                      </div>
                                                                  </div>
                                                             )}
                                                         </div>
                                                     </div>
                                                 ))
                                             )}
                                         </div>

                                     </div>
                                 );
                             })()}
                          </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
      )}

    </div>
  );
};

export default PenaltyRemoval;
