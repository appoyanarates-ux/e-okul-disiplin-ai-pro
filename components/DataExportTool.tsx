import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, FileText, Printer, Filter, 
  Search, CheckCircle2, AlertTriangle, Users, Briefcase, 
  Scale, CheckSquare, Square, Eye, Sparkles, RefreshCw
} from 'lucide-react';
import { useStudents } from '../context/StudentContext';
import { useIncidents } from '../context/IncidentContext';
import { useSettings } from '../context/SettingsContext';
import { Student } from '../types';
import { 
  exportIncidentToPDF,
  exportIncidentToDocx,
  exportIncidentsToExcel,
  exportDisciplineRegisterToExcel,
  exportDisciplineRegisterToPDF,
  exportDisciplineRegisterToDocx,
  exportStudentsToExcel,
  exportStudentsToPDF,
  exportStudentsToDocx,
  exportMesemReportToExcel,
  exportMesemReportToPDF,
  exportMesemReportToDocx,
  calculateStudentScore,
  triggerSafePrint
} from '../services/exportService';
import {
  DocumentDefinition,
  createDisciplineRegisterDoc,
  createIncidentReportDoc,
  createStudentListDoc,
  createMesemReportDoc
} from '../services/documentEngine';
import DocumentViewerModal from './DocumentViewerModal';
import * as XLSX from 'xlsx';

type ReportType = 'decisions' | 'incidents' | 'scores' | 'students' | 'mesem' | 'custom';

const DataExportTool: React.FC = () => {
  const { students } = useStudents();
  const { incidents } = useIncidents();
  const { institution, boardMembers } = useSettings();

  // Selected Report Type
  const [activeReport, setActiveReport] = useState<ReportType>('decisions');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedPenalty, setSelectedPenalty] = useState<string>('all');
  const [onlyPenalized, setOnlyPenalized] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [activeViewerDoc, setActiveViewerDoc] = useState<DocumentDefinition | null>(null);

  // Custom Report Columns
  const [customCols, setCustomCols] = useState<{ [key: string]: boolean }>({
    number: true,
    name: true,
    grade: true,
    tcNo: true,
    score: true,
    penalties: true,
    parentName: true,
    parentPhone: true,
    companyName: true,
    coordinatorTeacher: false,
    address: false,
  });

  // Calculate Statistics
  const stats = useMemo(() => {
    const totalStudents = students.length;
    const totalIncidents = incidents.length;
    let totalDecisions = 0;
    let penalizedStudents = 0;

    incidents.forEach(inc => {
      inc.involvedStudents.forEach(inv => {
        if (inv.decision && !inv.decision.includes('YER OLMADIĞINA')) {
          totalDecisions++;
        }
      });
    });

    students.forEach(s => {
      if (calculateStudentScore(s, incidents) < 100) {
        penalizedStudents++;
      }
    });

    const mesemStudents = students.filter(s => s.isMesem || (s.grade && s.grade.toUpperCase().includes('MES'))).length;

    return { totalStudents, totalIncidents, totalDecisions, penalizedStudents, mesemStudents };
  }, [students, incidents]);

  // Distinct Grades
  const distinctGrades = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => { if (s.grade) set.add(s.grade.trim()); });
    return Array.from(set).sort();
  }, [students]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      if (selectedGrade !== 'all' && s.grade !== selectedGrade) return false;
      
      const score = calculateStudentScore(s, incidents);
      if (onlyPenalized && score === 100) return false;

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchNo = s.number.includes(q);
        const matchTc = s.tcNo?.includes(q);
        const matchCompany = s.companyName?.toLowerCase().includes(q);
        if (!matchName && !matchNo && !matchTc && !matchCompany) return false;
      }

      return true;
    });
  }, [students, selectedGrade, onlyPenalized, searchTerm, incidents]);

  // Filtered Incidents
  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      if (startDate && inc.date < startDate) return false;
      if (endDate && inc.date > endDate) return false;

      if (selectedPenalty !== 'all') {
        const hasPenalty = inc.involvedStudents.some(inv => 
          (inv.decision || '').toUpperCase().includes(selectedPenalty.toUpperCase())
        );
        if (!hasPenalty) return false;
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchCode = inc.code.toLowerCase().includes(q);
        const matchTitle = inc.title.toLowerCase().includes(q);
        const matchLoc = inc.location.toLowerCase().includes(q);
        const matchStudent = inc.involvedStudents.some(inv => {
          const st = students.find(s => s.id === inv.studentId);
          return st ? st.name.toLowerCase().includes(q) || st.number.includes(q) : false;
        });
        if (!matchCode && !matchTitle && !matchLoc && !matchStudent) return false;
      }

      return true;
    });
  }, [incidents, startDate, endDate, selectedPenalty, searchTerm, students]);

  // Filtered Decisions List (Flattened rows of involved students with decisions)
  const decisionRows = useMemo(() => {
    const list: Array<{
      decisionNo: string;
      date: string;
      student: Student | undefined;
      studentName: string;
      studentNo: string;
      grade: string;
      incidentTitle: string;
      incidentCode: string;
      role: string;
      decision: string;
      penaltyScore: string;
      isRemoved: boolean;
      decisionReason: string;
    }> = [];

    filteredIncidents.forEach(inc => {
      inc.involvedStudents.forEach(inv => {
        const s = students.find(st => st.id === inv.studentId);
        
        // Filter by grade if selected
        if (selectedGrade !== 'all' && s?.grade !== selectedGrade) return;

        // Filter by penalty type if selected
        if (selectedPenalty !== 'all' && !(inv.decision || '').toUpperCase().includes(selectedPenalty.toUpperCase())) {
          return;
        }

        list.push({
          decisionNo: inv.decisionNo || inc.code,
          date: inv.decisionDate || inc.date,
          student: s,
          studentName: s ? s.name : 'Bilinmeyen Öğrenci',
          studentNo: s ? s.number : '-',
          grade: s?.grade || '-',
          incidentTitle: inc.title,
          incidentCode: inc.code,
          role: inv.role === 'suspect' ? 'Fail' : inv.role === 'witness' ? 'Tanık' : 'Mağdur',
          decision: inv.decision || (inv.role === 'suspect' ? 'İncelemede' : '-'),
          penaltyScore: inv.penaltyScore ? `-${inv.penaltyScore}` : '0',
          isRemoved: Boolean(inv.isRemoved),
          decisionReason: inv.decisionReason || inc.description || '-'
        });
      });
    });

    return list;
  }, [filteredIncidents, students, selectedGrade, selectedPenalty]);

  // Export Trigger Handlers
  const handleExportExcel = () => {
    if (activeReport === 'decisions') {
      exportDisciplineRegisterToExcel(filteredIncidents, students, institution);
    } else if (activeReport === 'incidents') {
      exportIncidentsToExcel(filteredIncidents, students);
    } else if (activeReport === 'scores' || activeReport === 'students') {
      exportStudentsToExcel(filteredStudents, incidents);
    } else if (activeReport === 'mesem') {
      exportMesemReportToExcel(filteredStudents);
    } else if (activeReport === 'custom') {
      // Custom Excel
      const customData = filteredStudents.map(s => {
        const row: Record<string, string | number> = {};
        if (customCols.number) row["Okul No"] = s.number;
        if (customCols.name) row["Adı Soyadı"] = s.name;
        if (customCols.grade) row["Sınıfı"] = s.grade || '';
        if (customCols.tcNo) row["T.C. Kimlik"] = s.tcNo || '';
        if (customCols.score) row["Davranış Puanı"] = calculateStudentScore(s, incidents);
        if (customCols.penalties) {
          const stIncidents = incidents.filter(i => i.involvedStudents.some(inv => inv.studentId === s.id && inv.decision));
          row["Cezaları"] = stIncidents.map(i => {
            const inv = i.involvedStudents.find(x => x.studentId === s.id);
            return `${inv?.decision} (${i.date})`;
          }).join('; ');
        }
        if (customCols.parentName) row["Veli Adı"] = s.parentName || '';
        if (customCols.parentPhone) row["Veli/Öğrenci Tel"] = s.parentPhone || '';
        if (customCols.companyName) row["İşletme (MESEM)"] = s.companyName || '';
        if (customCols.coordinatorTeacher) row["Koordinatör"] = s.coordinatorTeacher || '';
        if (customCols.address) row["Adres"] = s.address || '';
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(customData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Özel Rapor");
      XLSX.writeFile(wb, `Ozel_Ogrenci_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
    }
  };

  const handleExportDocx = () => {
    if (activeReport === 'decisions') {
      exportDisciplineRegisterToDocx(filteredIncidents, students, institution, boardMembers);
    } else if (activeReport === 'incidents') {
      if (filteredIncidents.length > 0) {
        exportIncidentToDocx(filteredIncidents[0], students, institution, boardMembers);
      } else {
        alert("Dışa aktarılacak disiplin olayı bulunamadı.");
      }
    } else if (activeReport === 'scores' || activeReport === 'students') {
      exportStudentsToDocx(filteredStudents, incidents, institution);
    } else if (activeReport === 'mesem') {
      exportMesemReportToDocx(filteredStudents, institution);
    } else {
      exportStudentsToDocx(filteredStudents, incidents, institution);
    }
  };

  const handleExportPDF = () => {
    if (activeReport === 'decisions') {
      exportDisciplineRegisterToPDF(filteredIncidents, students, institution, boardMembers);
    } else if (activeReport === 'incidents') {
      if (filteredIncidents.length > 0) {
        exportIncidentToPDF(filteredIncidents[0], students, institution, boardMembers);
      } else {
        alert("Dışa aktarılacak disiplin olayı bulunamadı.");
      }
    } else if (activeReport === 'scores' || activeReport === 'students') {
      exportStudentsToPDF(filteredStudents, incidents, institution);
    } else if (activeReport === 'mesem') {
      exportMesemReportToPDF(filteredStudents, institution);
    } else {
      exportStudentsToPDF(filteredStudents, incidents, institution);
    }
  };

  const handleOpenPrintPreview = () => {
    if (activeReport === 'decisions') {
      setActiveViewerDoc(createDisciplineRegisterDoc(filteredIncidents, students, institution, boardMembers));
    } else if (activeReport === 'incidents') {
      if (filteredIncidents.length > 0) {
        setActiveViewerDoc(createIncidentReportDoc(filteredIncidents[0], students, institution, boardMembers));
      } else {
        alert("Önizleme yapılacak disiplin olayı bulunamadı.");
      }
    } else if (activeReport === 'scores' || activeReport === 'students') {
      setActiveViewerDoc(createStudentListDoc(filteredStudents, incidents, institution));
    } else if (activeReport === 'mesem') {
      setActiveViewerDoc(createMesemReportDoc(filteredStudents, institution));
    } else {
      setActiveViewerDoc(createStudentListDoc(filteredStudents, incidents, institution));
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Resmi MEB Çıktı Standardı
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                PDF & Excel (.xlsx)
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <FileSpreadsheet className="w-8 h-8 text-blue-400" />
              Disiplin ve Öğrenci Dışa Aktarma Aracı
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl leading-relaxed">
              Öğrenci disiplin kayıtlarını, MEB Disiplin Karar Defteri çetelesini, ceza puanı düşüşlerini ve MESEM işletme verilerini tek tıkla resmi PDF ve Excel formatlarında dışa aktarın veya yazdırın.
            </p>
          </div>

          {/* Quick Export Buttons in Header */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-600/30 transition-all hover:scale-105 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Excel İndir (.xlsx)</span>
            </button>
            <button
              onClick={handleExportDocx}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-600/30 transition-all hover:scale-105 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Word İndir (.docx)</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-red-600/30 transition-all hover:scale-105 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>PDF İndir (.pdf)</span>
            </button>
            <button
              onClick={handleOpenPrintPreview}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold backdrop-blur-sm transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-blue-300" />
              <span>Önizle & Yazdır</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/10 text-xs">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 font-medium">Toplam Öğrenci</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.totalStudents}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 font-medium">Kayıtlı Olay Sayısı</div>
            <div className="text-2xl font-bold text-blue-300 mt-1">{stats.totalIncidents}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 font-medium">Alınan Disiplin Kararları</div>
            <div className="text-2xl font-bold text-purple-300 mt-1">{stats.totalDecisions}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 font-medium">Davranış Puanı Düşenler</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{stats.penalizedStudents}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5 col-span-2 sm:col-span-1">
            <div className="text-slate-400 font-medium">MESEM Öğrencisi</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.mesemStudents}</div>
          </div>
        </div>
      </div>

      {/* Report Types Tabs */}
      <div className="bg-white rounded-2xl p-3 shadow-sm border border-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <button
            onClick={() => setActiveReport('decisions')}
            className={`p-3 rounded-xl text-left transition-all flex flex-col justify-between border ${
              activeReport === 'decisions'
                ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Scale className={`w-5 h-5 ${activeReport === 'decisions' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                {decisionRows.length}
              </span>
            </div>
            <div>
              <div className="font-bold text-xs text-slate-800">Disiplin Karar Defteri</div>
              <div className="text-[11px] text-slate-500">MEB Resmi Karar Çetelesi</div>
            </div>
          </button>

          <button
            onClick={() => setActiveReport('incidents')}
            className={`p-3 rounded-xl text-left transition-all flex flex-col justify-between border ${
              activeReport === 'incidents'
                ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <AlertTriangle className={`w-5 h-5 ${activeReport === 'incidents' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                {filteredIncidents.length}
              </span>
            </div>
            <div>
              <div className="font-bold text-xs text-slate-800">Olaylar ve Tutanaklar</div>
              <div className="text-[11px] text-slate-500">Olay Yeri & Failler</div>
            </div>
          </button>

          <button
            onClick={() => setActiveReport('scores')}
            className={`p-3 rounded-xl text-left transition-all flex flex-col justify-between border ${
              activeReport === 'scores'
                ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <CheckCircle2 className={`w-5 h-5 ${activeReport === 'scores' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                {stats.penalizedStudents}
              </span>
            </div>
            <div>
              <div className="font-bold text-xs text-slate-800">Davranış Puanı Çizelgesi</div>
              <div className="text-[11px] text-slate-500">Puanı Düşen Öğrenciler</div>
            </div>
          </button>

          <button
            onClick={() => setActiveReport('students')}
            className={`p-3 rounded-xl text-left transition-all flex flex-col justify-between border ${
              activeReport === 'students'
                ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Users className={`w-5 h-5 ${activeReport === 'students' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                {filteredStudents.length}
              </span>
            </div>
            <div>
              <div className="font-bold text-xs text-slate-800">Öğrenci Künye Listesi</div>
              <div className="text-[11px] text-slate-500">TC, Veli & İletişim</div>
            </div>
          </button>

          <button
            onClick={() => setActiveReport('mesem')}
            className={`p-3 rounded-xl text-left transition-all flex flex-col justify-between border ${
              activeReport === 'mesem'
                ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Briefcase className={`w-5 h-5 ${activeReport === 'mesem' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                {stats.mesemStudents}
              </span>
            </div>
            <div>
              <div className="font-bold text-xs text-slate-800">MESEM & İşletme Raporu</div>
              <div className="text-[11px] text-slate-500">Usta Öğretici & Firma</div>
            </div>
          </button>

          <button
            onClick={() => setActiveReport('custom')}
            className={`p-3 rounded-xl text-left transition-all flex flex-col justify-between border ${
              activeReport === 'custom'
                ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20'
                : 'bg-slate-50/70 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <Filter className={`w-5 h-5 ${activeReport === 'custom' ? 'text-blue-600' : 'text-slate-500'}`} />
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-800">
                Özel
              </span>
            </div>
            <div>
              <div className="font-bold text-xs text-slate-800">Özel Sütunlu Rapor</div>
              <div className="text-[11px] text-slate-500">Seçmeli Sütun Oluşturucu</div>
            </div>
          </button>
        </div>
      </div>

      {/* Filter and Configuration Bar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4 text-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Öğrenci adı, numara, TC, olay kodu veya işletme ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
          </div>

          {/* Quick Clear Button */}
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedGrade('all');
              setSelectedPenalty('all');
              setStartDate('');
              setEndDate('');
              setOnlyPenalized(false);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-semibold transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Filtreleri Temizle</span>
          </button>
        </div>

        {/* Detailed Filter Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-slate-500 mb-1 font-semibold">Sınıf / Şube</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Tüm Sınıflar</option>
              {distinctGrades.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1 font-semibold">Disiplin Kararı Türü</label>
            <select
              value={selectedPenalty}
              onChange={(e) => setSelectedPenalty(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Tüm Karar Türleri</option>
              <option value="UYARMA">Uyarma</option>
              <option value="KINAMA">Kınama</option>
              <option value="UZAKLAŞTIRMA">Okuldan Kısa Süreli Uzaklaştırma</option>
              <option value="DEĞİŞTİRME">Okul Değiştirme</option>
              <option value="ÇIKARMA">Örgün Eğitim Dışına Çıkarma</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1 font-semibold">Tarih Aralığı (Başlangıç - Bitiş)</label>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-[11px]"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 text-[11px]"
              />
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-100 select-none">
              <input
                type="checkbox"
                checked={onlyPenalized}
                onChange={(e) => setOnlyPenalized(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-slate-700 text-xs">Sadece Puanı Düşen Öğrenciler</span>
            </label>
          </div>
        </div>

        {/* Custom Column Picker (Only visible when activeReport === 'custom') */}
        {activeReport === 'custom' && (
          <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 space-y-2.5">
            <div className="font-bold text-purple-950 flex items-center gap-1.5">
              <Filter className="w-4 h-4 text-purple-600" />
              <span>Dışa Aktarılacak Sütunları Seçin:</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { id: 'number', label: 'Okul No' },
                { id: 'name', label: 'Adı Soyadı' },
                { id: 'grade', label: 'Sınıfı' },
                { id: 'tcNo', label: 'T.C. Kimlik' },
                { id: 'score', label: 'Davranış Puanı' },
                { id: 'penalties', label: 'Alınan Cezalar' },
                { id: 'parentName', label: 'Veli Adı' },
                { id: 'parentPhone', label: 'Telefon' },
                { id: 'companyName', label: 'İşletme (MESEM)' },
                { id: 'coordinatorTeacher', label: 'Koordinatör' },
                { id: 'address', label: 'Adres' }
              ].map(col => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setCustomCols(prev => ({ ...prev, [col.id]: !prev[col.id] }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                    customCols[col.id]
                      ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {customCols[col.id] ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                  <span>{col.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Preview Container */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
        {/* Table Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              <span>Rapor Önizleme</span>
              <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-800 rounded-full font-mono font-bold">
                {activeReport === 'decisions' 
                  ? `${decisionRows.length} Karar Satırı` 
                  : activeReport === 'incidents'
                  ? `${filteredIncidents.length} Olay`
                  : `${filteredStudents.length} Öğrenci`}
              </span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aşağıdaki önizleme doğrudan PDF ve Excel (.xlsx) çıktısına dönüştürülecektir.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Excel İndir</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-red-600" />
              <span>PDF İndir</span>
            </button>
            <button
              onClick={handleOpenPrintPreview}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Yazdır</span>
            </button>
          </div>
        </div>

        {/* Dynamic Table Content based on activeReport */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-[500px]">
          {activeReport === 'decisions' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3">Karar No</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Öğrenci No</th>
                  <th className="px-4 py-3">Adı Soyadı</th>
                  <th className="px-4 py-3">Sınıf</th>
                  <th className="px-4 py-3">Olay / Fiil</th>
                  <th className="px-4 py-3">Karar / Ceza</th>
                  <th className="px-4 py-3 text-center">Puan</th>
                  <th className="px-4 py-3 text-center">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {decisionRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-slate-400">
                      Seçilen kriterlere uygun karar kaydı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  decisionRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{row.decisionNo}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{row.date}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{row.studentNo}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{row.studentName}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                          {row.grade}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700 max-w-xs truncate" title={row.incidentTitle}>
                        {row.incidentTitle}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {row.decision}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-red-600">
                        {row.penaltyScore}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          row.isRemoved ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {row.isRemoved ? 'Silindi' : 'Aktif'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeReport === 'incidents' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3">Kod</th>
                  <th className="px-4 py-3">Tarih & Saat</th>
                  <th className="px-4 py-3">Olay Başlığı</th>
                  <th className="px-4 py-3">Yer</th>
                  <th className="px-4 py-3">Karışanlar (Failler / Mağdurlar)</th>
                  <th className="px-4 py-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIncidents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      Seçilen kriterlere uygun olay kaydı bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredIncidents.map(inc => (
                    <tr key={inc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">{inc.code}</td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{inc.date} {inc.time}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{inc.title}</td>
                      <td className="px-4 py-3 text-slate-600">{inc.location}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {inc.involvedStudents.map((inv, i) => {
                          const s = students.find(st => st.id === inv.studentId);
                          return s ? (
                            <span key={i} className="inline-block mr-1.5 mb-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                              {s.name} ({inv.role === 'suspect' ? 'Fail' : inv.role === 'witness' ? 'Tanık' : 'Mağdur'})
                            </span>
                          ) : null;
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                          {inc.status === 'decided' ? 'Karara Bağlandı' : inc.status === 'investigating' ? 'İncelemede' : 'Beklemede'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {(activeReport === 'scores' || activeReport === 'students') && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3">Okul No</th>
                  <th className="px-4 py-3">T.C. Kimlik</th>
                  <th className="px-4 py-3">Adı Soyadı</th>
                  <th className="px-4 py-3">Sınıf</th>
                  <th className="px-4 py-3 text-center">Davranış Puanı</th>
                  <th className="px-4 py-3">Veli Bilgisi & Tel</th>
                  <th className="px-4 py-3">Öğrenim Türü</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400">
                      Seçilen kriterlere uygun öğrenci bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map(s => {
                    const score = calculateStudentScore(s, incidents);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-900">{s.number}</td>
                        <td className="px-4 py-3 font-mono text-slate-500">{s.tcNo || '-'}</td>
                        <td className="px-4 py-3 font-bold text-slate-900">{s.name}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                            {s.grade || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs ${
                            score === 100 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : score >= 80 
                              ? 'bg-amber-100 text-amber-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {score}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {s.parentName || '-'} {s.parentPhone ? `(${s.parentPhone})` : ''}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            s.isMesem ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {s.isMesem ? 'MESEM' : 'Örgün'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}

          {activeReport === 'mesem' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  <th className="px-4 py-3">No</th>
                  <th className="px-4 py-3">Adı Soyadı</th>
                  <th className="px-4 py-3">Sınıf</th>
                  <th className="px-4 py-3">Meslek Alanı / Dalı</th>
                  <th className="px-4 py-3">İşletme / Firma Adı</th>
                  <th className="px-4 py-3">Usta Öğretici & Tel</th>
                  <th className="px-4 py-3">Koordinatör</th>
                  <th className="px-4 py-3 text-center">Sözleşme</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.filter(s => s.isMesem || (s.grade && s.grade.toUpperCase().includes('MES'))).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      Kayıtlı MESEM öğrencisi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.filter(s => s.isMesem || (s.grade && s.grade.toUpperCase().includes('MES'))).map(s => (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-bold text-slate-900">{s.number}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{s.name}</td>
                      <td className="px-4 py-3 font-medium text-blue-700">{s.grade || 'MESEM'}</td>
                      <td className="px-4 py-3 text-slate-700">{s.mesemField || '-'}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{s.companyName || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        {s.masterTrainer || '-'} {s.masterTrainerPhone ? `(${s.masterTrainerPhone})` : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{s.coordinatorTeacher || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {s.contractStatus || 'Aktif'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeReport === 'custom' && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider sticky top-0 border-b border-slate-200 z-10">
                <tr>
                  {customCols.number && <th className="px-4 py-3">Okul No</th>}
                  {customCols.name && <th className="px-4 py-3">Adı Soyadı</th>}
                  {customCols.grade && <th className="px-4 py-3">Sınıf</th>}
                  {customCols.tcNo && <th className="px-4 py-3">TC Kimlik</th>}
                  {customCols.score && <th className="px-4 py-3 text-center">Davranış Notu</th>}
                  {customCols.parentName && <th className="px-4 py-3">Veli Adı</th>}
                  {customCols.parentPhone && <th className="px-4 py-3">Telefon</th>}
                  {customCols.companyName && <th className="px-4 py-3">İşletme</th>}
                  {customCols.coordinatorTeacher && <th className="px-4 py-3">Koordinatör</th>}
                  {customCols.address && <th className="px-4 py-3">Adres</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map(s => {
                  const score = calculateStudentScore(s, incidents);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      {customCols.number && <td className="px-4 py-3 font-bold text-slate-900">{s.number}</td>}
                      {customCols.name && <td className="px-4 py-3 font-bold text-slate-900">{s.name}</td>}
                      {customCols.grade && <td className="px-4 py-3">{s.grade || '-'}</td>}
                      {customCols.tcNo && <td className="px-4 py-3 font-mono text-slate-500">{s.tcNo || '-'}</td>}
                      {customCols.score && (
                        <td className="px-4 py-3 text-center font-bold text-slate-900">{score}</td>
                      )}
                      {customCols.parentName && <td className="px-4 py-3 text-slate-600">{s.parentName || '-'}</td>}
                      {customCols.parentPhone && <td className="px-4 py-3 text-slate-600">{s.parentPhone || '-'}</td>}
                      {customCols.companyName && <td className="px-4 py-3 text-slate-600">{s.companyName || '-'}</td>}
                      {customCols.coordinatorTeacher && <td className="px-4 py-3 text-slate-600">{s.coordinatorTeacher || '-'}</td>}
                      {customCols.address && <td className="px-4 py-3 text-slate-500 truncate max-w-xs">{s.address || '-'}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PRINT PREVIEW MODAL */}
      {/* ========================================================================= */}
      {activeViewerDoc && (
        <DocumentViewerModal
          document={activeViewerDoc}
          isOpen={!!activeViewerDoc}
          onClose={() => setActiveViewerDoc(null)}
        />
      )}
    </div>
  );
};

export default DataExportTool;
