
import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, FileSpreadsheet, Trash2, Save, X, Eye, User, MapPin, FileText, Info, CheckCircle, School, AlertTriangle, Edit3, Download, BookOpen, HelpCircle, Briefcase, Upload, Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { Student } from '../types';
import { useStudents } from '../context/StudentContext';
import { useIncidents } from '../context/IncidentContext';
import { useSettings } from '../context/SettingsContext';
import { exportStudentToPDF, exportStudentToDocx, exportStudentsToExcel, exportStudentsToDocx } from '../services/exportService';
import { parseStudentFile, ParsedStudentWithStats, ParseFileResult, countExtractedFields } from '../services/studentFileParser';

const Students = () => {
  const { students, setStudents, addStudent, removeStudent, updateStudent } = useStudents();
  const { incidents, addIncident } = useIncidents();
  const { institution, boardMembers } = useSettings();

  const getStudentBehaviorScore = (student: Student, allIncidents: { involvedStudents?: { studentId: string; role: string; decision?: string; penaltyScore?: string; isRemoved?: boolean }[] }[]) => {
    let deductedPoints = 0;

    allIncidents.forEach(inc => {
      const inv = inc.involvedStudents?.find(i => 
        i.studentId === student.id && 
        i.role === 'suspect' && 
        i.decision && 
        !i.decision.includes('YER OLMADIĞINA') &&
        !i.isRemoved
      );
      if (inv) {
        let score = parseInt(inv.penaltyScore || '0', 10);
        if (isNaN(score) || score === 0) {
          const dec = (inv.decision || '').toUpperCase();
          if (dec.includes('UYARMA')) score = 5;
          else if (dec.includes('KINAMA')) score = 10;
          else if (dec.includes('UZAKLAŞTIRMA') || dec.includes('AŞTIRMA')) score = 20;
          else if (dec.includes('DEĞİŞTİRME')) score = 40;
          else if (dec.includes('DIŞINA ÇIKARMA') || dec.includes('ÖRGÜN')) score = 80;
        }
        deductedPoints += score;
      }
    });

    if (student.previousPenalties) {
      student.previousPenalties.forEach(p => {
        if (p.isRemoved) return;
        let score = parseInt(p.penaltyScore || '0', 10);
        if (isNaN(score) || score === 0) {
          const dec = (p.decision || '').toUpperCase();
          if (dec.includes('UYARMA')) score = 5;
          else if (dec.includes('KINAMA')) score = 10;
          else if (dec.includes('UZAKLAŞTIRMA') || dec.includes('AŞTIRMA')) score = 20;
          else if (dec.includes('DEĞİŞTİRME')) score = 45;
          else if (dec.includes('DIŞINA ÇIKARMA') || dec.includes('ÖRGÜN')) score = 80;
        }
        deductedPoints += score;
      });
    }

    return Math.max(0, 100 - deductedPoints);
  };
  
  const [showPastPenaltyModal, setShowPastPenaltyModal] = useState(false);
  const [pastPenaltyForm, setPastPenaltyForm] = useState({
    decision: 'KINAMA',
    decisionNo: '',
    decisionDate: new Date().toISOString().split('T')[0],
    decisionReason: '',
    title: 'Geçmiş Disiplin Cezası',
    penaltyScore: '10'
  });
  const [isDragging, setIsDragging] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Excel & PDF Review State
  const [parsedStudents, setParsedStudents] = useState<ParsedStudentWithStats[]>([]);
  const [selectedParsedIds, setSelectedParsedIds] = useState<string[]>([]);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [bulkGrade, setBulkGrade] = useState('');
  const [uploadFormat, setUploadFormat] = useState<'auto' | 'tabular' | 'card'>('auto');
  const [showEokulGuideModal, setShowEokulGuideModal] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [parseSummary, setParseSummary] = useState<ParseFileResult['extractedFieldsSummary'] | null>(null);
  const [detectedFormatName, setDetectedFormatName] = useState<string>('');
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [reviewFilterQuery, setReviewFilterQuery] = useState<string>('');
  
  // Seçili Sınıf State'i (null = Tümü)
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);
  
  // DELETE CLASS MODAL STATE
  const [classDeleteTarget, setClassDeleteTarget] = useState<string | null>(null);

  // Edit Student State
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState<Partial<Student>>({});

  // Extended Manual Add Form State
  const [newStudent, setNewStudent] = useState<Partial<Student>>({
    number: '', name: '', grade: '', tcNo: '', parentName: '',
    fatherName: '', motherName: '', birthPlaceDate: '', 
    province: '', district: '', neighborhood: '',
    boardingStatus: 'GÜNDÜZLÜ', scholarshipStatus: 'BURSSUZ',
    gender: 'Erkek', healthStatus: 'İyi'
  });

  // --- HESAPLAMALAR ---
  
  // Sınıfları Grupla ve Sırala
  const classGroups = useMemo(() => {
      const groups: Record<string, number> = {};
      students.forEach(s => {
          // Normalize grade string (trim spaces)
          const g = s.grade ? s.grade.trim() : 'Belirsiz';
          groups[g] = (groups[g] || 0) + 1;
      });
      
      // Alfanumerik Sıralama (9-A, 9-B, 10-A...)
      return Object.entries(groups).sort((a, b) => 
          a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' })
      );
  }, [students]);

  // Filtrelenmiş Öğrenci Listesi
  const filteredStudents = useMemo(() => {
      let list = students;

      // 1. Sınıf Filtresi
      if (selectedGrade) {
          list = list.filter(s => (s.grade ? s.grade.trim() : 'Belirsiz') === selectedGrade);
      }

      // 2. Arama Filtresi
      if (searchTerm) {
          const lowerTerm = searchTerm.toLowerCase();
          list = list.filter(s => 
            s.name.toLowerCase().includes(lowerTerm) || 
            s.number.includes(searchTerm) ||
            s.tcNo?.includes(searchTerm)
          );
      }
      return list;
  }, [students, selectedGrade, searchTerm]);


  // --- HANDLERS ---

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFiles(Array.from(files));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const processFiles = async (files: File[]) => {
    setIsProcessingFile(true);
    let allNewParsed: ParsedStudentWithStats[] = [];
    let lastSummary: ParseFileResult['extractedFieldsSummary'] | null = null;
    let formatLabel = '';

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
        
        if (isPdf) {
          alert(
            `"${file.name}" bir PDF belgesidir.\n\n` +
            "PDF ile veri içe aktarma desteği kaldırılmıştır.\n" +
            "Lütfen e-Okul > Öğrenci İşlemleri > Raporlar ekranından aldığınız orijinal Excel (.xlsx veya .xls) dosyasını yükleyiniz."
          );
          continue;
        }

        setProcessingStatus(
          `${file.name} taranıyor (Excel Tablosu)... [${i + 1}/${files.length}]`
        );

        const result = await parseStudentFile(file, uploadFormat);
        
        if (result.students.length > 0) {
          allNewParsed = [...allNewParsed, ...result.students];
          lastSummary = result.extractedFieldsSummary;
          
          if (result.formatDetected === 'card') formatLabel = 'e-Okul Künye Defteri (Excel)';
          else if (result.formatDetected === 'tabular') formatLabel = 'e-Okul Sınıf/Tablo Listesi (Excel)';
          else formatLabel = 'e-Okul Veri Tablosu (Excel)';
        }
      }

      if (allNewParsed.length > 0) {
        setParsedStudents(prev => [...prev, ...allNewParsed]);
        setSelectedParsedIds(prev => [...prev, ...allNewParsed.map(s => s.id!)]);
        setParseSummary(lastSummary);
        setDetectedFormatName(formatLabel);
        setShowReviewModal(true);
      } else if (files.every(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf')) {
        // Already alerted for PDF above
      } else {
        alert(
          "Yüklenen Excel dosyasında geçerli öğrenci veya künye verisi bulunamadı.\n\n" +
          "Desteklenen Belgeler:\n" +
          "• e-Okul > Öğrenci İşlemleri / Raporlar > Öğrenci Künye Defteri (Excel .xlsx / .xls)\n" +
          "• e-Okul > Sınıf / Şube Öğrenci Listeleri (Excel .xlsx / .xls / .csv)\n\n" +
          "Lütfen e-Okul'dan indirdiğiniz orijinal Excel dosyasını seçtiğinizden emin olun."
        );
      }
    } catch (error) {
      console.error("Dosya işleme hatası:", error);
      alert(
        "Excel dosyası okunurken bir hata oluştu. Dosyanın bozuk veya parola korumalı olmadığından emin olunuz."
      );
    } finally {
      setIsProcessingFile(false);
      setProcessingStatus(null);
    }
  };

  const handleFinalizeUpload = () => {
    const studentsToAdd = parsedStudents
      .filter(s => selectedParsedIds.includes(s.id!))
      .map(s => ({
        ...s,
        id: Math.random().toString(36).substr(2, 9), // Regenerate ID for final add
        grade: s.grade || 'Belirtilmedi'
      } as Student));

    if (studentsToAdd.length === 0) {
      alert("Lütfen eklenecek en az bir öğrenci seçin.");
      return;
    }

    // Check for duplicates
    const finalToAdd = studentsToAdd.filter(newS => 
      !students.some(existingS => existingS.number === newS.number)
    );

    const duplicateCount = studentsToAdd.length - finalToAdd.length;

    setStudents([...students, ...finalToAdd]);
    setShowReviewModal(false);
    setParsedStudents([]);
    setSelectedParsedIds([]);
    
    let msg = `${finalToAdd.length} öğrenci başarıyla eklendi.`;
    if (duplicateCount > 0) msg += ` ${duplicateCount} öğrenci zaten kayıtlı olduğu için atlandı.`;
    
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const updateParsedStudent = (id: string, field: keyof Student, value: string) => {
    setParsedStudents(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const applyBulkGrade = () => {
    if (!bulkGrade) return;
    setParsedStudents(prev => prev.map(s => 
      selectedParsedIds.includes(s.id!) ? { ...s, grade: bulkGrade } : s
    ));
    setBulkGrade('');
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newStudent.name && newStudent.number) {
        addStudent({
            ...newStudent,
            id: Math.random().toString(36).substr(2, 9),
        } as Student);
        setShowAddModal(false);
        setNewStudent({ 
            number: '', name: '', grade: '', tcNo: '', parentName: '',
            fatherName: '', motherName: '', birthPlaceDate: '', 
            province: '', district: '', neighborhood: '',
            boardingStatus: 'GÜNDÜZLÜ', scholarshipStatus: 'BURSSUZ',
            gender: 'Erkek', healthStatus: 'İyi'
        });
        setSuccessMessage(`Öğrenci ${newStudent.name} başarıyla eklendi.`);
        setTimeout(() => setSuccessMessage(null), 3000);
    }
  };

  const handleDeleteClassRequest = (gradeToDelete: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent selecting the class when clicking delete
      setClassDeleteTarget(gradeToDelete);
  };

  const confirmClassDelete = () => {
      if (classDeleteTarget) {
          const newStudents = students.filter(s => (s.grade ? s.grade.trim() : 'Belirsiz') !== classDeleteTarget);
          setStudents(newStudents);
          setSuccessMessage(`${classDeleteTarget} sınıfı ve tüm öğrencileri başarıyla silindi.`);
          
          if (selectedGrade === classDeleteTarget) {
              setSelectedGrade(null);
          }
          setClassDeleteTarget(null);
          setTimeout(() => setSuccessMessage(null), 3000);
      }
  };

  // Re-usable detail row component
  const DetailRow = ({ label, value, fullWidth = false }: { label: string, value?: string, fullWidth?: boolean }) => (
      <div className={`${fullWidth ? 'col-span-2' : ''} bg-slate-50 p-2.5 rounded border border-slate-100`}>
          <span className="text-[10px] text-slate-400 block uppercase tracking-wider font-semibold">{label}</span>
          <span className="font-medium text-slate-700 text-sm truncate block" title={value}>{value || '-'}</span>
      </div>
  );

  const getTargetStudentCount = () => {
      if (!classDeleteTarget) return 0;
      return classGroups.find(([g]) => g === classDeleteTarget)?.[1] || 0;
  };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-full mx-auto min-h-screen lg:h-screen flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 shrink-0">
        <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                Öğrenci Yönetimi
                <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-mono">v2.1</span>
            </h1>
            <p className="text-slate-500">
                {students.length > 0 
                 ? `${students.length} öğrenci kayıtlı.` 
                 : 'Henüz öğrenci eklenmedi. Excel ile toplu yükleme yapabilirsiniz.'}
            </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
            <div className="flex flex-col items-end mr-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Yükleme Formatı</span>
                <select 
                    value={uploadFormat}
                    onChange={(e) => setUploadFormat(e.target.value as 'auto' | 'tabular' | 'card')}
                    className="text-xs p-1.5 border rounded-lg bg-white outline-none focus:border-blue-500 font-medium text-slate-700 shadow-2xs"
                >
                    <option value="auto">Otomatik Algıla (Excel - Önerilen)</option>
                    <option value="card">e-Okul Künye Defteri (Excel - Kart Görünümü)</option>
                    <option value="tabular">e-Okul Tablo / Sınıf Listesi (Excel)</option>
                </select>
            </div>
            <Link 
                to="/mesem"
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors text-xs font-semibold"
                title="MESEM Öğrenci ve İşletme Yönetimine Geç"
            >
                <Briefcase className="w-4 h-4 text-indigo-600" />
                <span>MESEM İşlemleri ({students.filter(s => s.isMesem || (s.grade && s.grade.toUpperCase().includes('MES'))).length})</span>
            </Link>
            <Link 
                to="/export"
                className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors text-xs font-semibold"
                title="Gelişmiş PDF ve Excel Raporlama Aracı"
            >
                <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                <span>Rapor & Dışa Aktar (PDF/Excel)</span>
            </Link>
            <button 
                onClick={() => exportStudentsToExcel(filteredStudents, incidents)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors text-xs font-semibold"
            >
                <Download className="w-4 h-4" />
                Dışa Aktar (Excel)
            </button>
            <button 
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-xs font-semibold"
            >
                <Plus className="w-4 h-4" />
                Tek Ekle
            </button>
            <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingFile}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-lg hover:from-emerald-700 hover:to-teal-800 transition-all shadow-sm text-xs font-bold cursor-pointer disabled:opacity-50"
                title="MEB e-Okul Künye Defteri Excel (.xlsx/.xls/.csv) dosyasını yükleyin"
            >
                {isProcessingFile ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>İşleniyor...</span>
                    </>
                ) : (
                    <>
                        <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                        <span>e-Okul Künye Yükle (Excel)</span>
                    </>
                )}
            </button>
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".xlsx, .xls, .csv" 
                className="hidden" 
                multiple
            />
        </div>
      </div>

      {/* e-Okul Künye Defteri Veri Bilgilendirme Kartı */}
      <div className="mb-4 bg-gradient-to-r from-blue-50 via-indigo-50/70 to-emerald-50 border border-blue-200/90 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs shrink-0">
          <div className="flex items-start gap-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl shrink-0 mt-0.5 shadow-xs">
                  <BookOpen className="w-5 h-5" />
              </div>
              <div>
                  <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-blue-950 flex items-center gap-1.5">
                          Öğrenci Veri Yükleme Standardı: e-Okul Künye Defteri
                      </h2>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-300">
                          Excel (.xlsx / .xls) Desteği
                      </span>
                      <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md border border-blue-200">
                          Tüm Künye Alanları
                      </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      MEB e-Okul &gt; Öğrenci İşlemleri &gt; Raporlar ekranından aldığınız <strong>Öğrenci Künye Defteri</strong> veya <strong>Sınıf Listesi</strong> çıktısını <strong>Excel (.xlsx / .xls)</strong> formatında yükleyebilirsiniz. <em>Okul No, T.C. Kimlik No, Ad-Soyad, Sınıf/Şube, Anne ve Baba Adı, Doğum Yeri/Tarihi, Veli İletişim (Telefon)</em> ve <em>İkametgâh Adresi</em> gibi tüm künye verileri eksiksiz ayrıştırılır.
                  </p>
              </div>
          </div>
          <button 
              onClick={() => setShowEokulGuideModal(true)}
              className="self-start sm:self-center shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 border border-blue-300 rounded-lg text-xs font-semibold hover:bg-blue-50 transition-colors shadow-2xs cursor-pointer"
          >
              <HelpCircle className="w-4 h-4 text-blue-600" />
              Nasıl Alınır? (Rehber)
          </button>
      </div>

      {successMessage && (
        <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-lg border border-green-200 flex items-center animate-fade-in shadow-sm shrink-0">
           <CheckCircle className="w-5 h-5 mr-3 shrink-0" />
           <span className="font-medium">{successMessage}</span>
           <button onClick={() => setSuccessMessage(null)} className="ml-auto text-green-600 hover:text-green-800">
             <X className="w-4 h-4" />
           </button>
        </div>
      )}

      {/* --- MAIN LAYOUT --- */}
      <div className="flex gap-6 flex-1 overflow-hidden">
          
          {/* LEFT SIDEBAR: CLASS LIST */}
          <div className="w-64 bg-white border border-slate-200 rounded-xl flex flex-col shrink-0 overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-100 font-bold text-slate-700 text-sm flex items-center gap-2">
                  <School className="w-4 h-4" />
                  Sınıflar & Gruplar
              </div>
              <div className="flex-1 overflow-y-auto">
                  <button 
                      onClick={() => setSelectedGrade(null)}
                      className={`w-full text-left px-4 py-3 text-sm flex justify-between items-center border-b border-slate-50 hover:bg-slate-50 transition-colors ${selectedGrade === null ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'}`}
                  >
                      <span>Tüm Öğrenciler</span>
                      <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-xs">{students.length}</span>
                  </button>
                  
                  {classGroups.map(([grade, count]) => (
                      <div 
                        key={grade} 
                        onClick={() => setSelectedGrade(grade)}
                        className={`w-full text-left px-4 py-3 text-sm flex justify-between items-center border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors group ${selectedGrade === grade ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600'}`}
                      >
                          <div className="flex items-center gap-2">
                              <span>{grade}</span>
                          </div>
                          <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${selectedGrade === grade ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                              <button 
                                onClick={(e) => handleDeleteClassRequest(grade, e)}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                                title={`${grade} sınıfını tamamen sil`}
                              >
                                  <Trash2 className="w-3.5 h-3.5" />
                              </button>
                          </div>
                      </div>
                  ))}
                  
                  {classGroups.length === 0 && (
                      <div className="p-4 text-xs text-slate-400 text-center">Henüz sınıf oluşmadı.</div>
                  )}
              </div>
          </div>

          {/* RIGHT CONTENT: TABLE */}
          <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 flex items-center gap-3 shrink-0">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder={selectedGrade ? `${selectedGrade} sınıfı içinde ara...` : "Tüm öğrencilerde ara..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 outline-none text-sm text-slate-700 placeholder:text-slate-400"
                    />
                    {selectedGrade && (
                        <div className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold flex items-center gap-1">
                            {selectedGrade}
                            <button onClick={() => setSelectedGrade(null)}><X className="w-3 h-3 hover:text-blue-900" /></button>
                        </div>
                    )}
                </div>

                {/* Empty State / Drag Drop (Only if absolutely no students) */}
                {students.length === 0 ? (
                    <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={`flex-1 m-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center transition-all p-6 ${
                            isDragging ? 'border-blue-500 bg-blue-50/80 shadow-inner' : 'border-slate-300 bg-slate-50'
                        }`}
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <div className="bg-emerald-100 p-4 rounded-2xl shadow-2xs border border-emerald-200">
                                <FileSpreadsheet className={`w-10 h-10 ${isDragging ? 'text-blue-600' : 'text-emerald-700'}`} />
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">
                            e-Okul Künye Defteri Excel Dosyası Yükleyin
                        </h3>
                        <p className="font-normal text-slate-600 max-w-lg mx-auto mb-4 text-sm leading-relaxed">
                            MEB e-Okul sisteminden indirdiğiniz <strong>Öğrenci Künye Defteri</strong> veya <strong>Öğrenci Listesini</strong> 
                            <span className="inline-block mx-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Excel (.xlsx / .xls)</span> 
                            formatında buraya sürükleyip bırakın.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                            <span className="text-[11px] font-medium bg-white text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
                                ✓ Okul No & T.C. Kimlik No
                            </span>
                            <span className="text-[11px] font-medium bg-white text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
                                ✓ Anne & Baba Adı
                            </span>
                            <span className="text-[11px] font-medium bg-white text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
                                ✓ Veli & Telefon Bilgisi
                            </span>
                            <span className="text-[11px] font-medium bg-white text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 shadow-2xs">
                                ✓ İkametgâh Adresi & Nüfus
                            </span>
                        </div>
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessingFile}
                                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white rounded-lg text-sm font-semibold hover:from-emerald-700 hover:to-teal-800 shadow-sm transition-all cursor-pointer flex items-center gap-2"
                            >
                                <Upload className="w-4 h-4" />
                                Dosya Seçin (Excel .xlsx / .xls)
                            </button>
                            <button 
                                onClick={() => setShowEokulGuideModal(true)}
                                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                            >
                                e-Okul Rehberi
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider shadow-sm">
                                    <th className="p-4 font-semibold border-b border-slate-100">No</th>
                                    <th className="p-4 font-semibold border-b border-slate-100">Ad Soyad</th>
                                    <th className="p-4 font-semibold border-b border-slate-100">Sınıf</th>
                                    <th className="p-4 font-semibold border-b border-slate-100">TC Kimlik</th>
                                    <th className="p-4 font-semibold border-b border-slate-100">Durum</th>
                                    <th className="p-4 font-semibold border-b border-slate-100">Davranış Notu</th>
                                    <th className="p-4 font-semibold border-b border-slate-100 text-right">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-slate-100">
                                {filteredStudents.length > 0 ? filteredStudents.map((student) => (
                                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => setSelectedStudent(student)}>
                                        <td className="p-4 font-medium text-slate-700">{student.number}</td>
                                        <td className="p-4 text-slate-800 font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                    <User className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{student.name}</span>
                                                        {(student.isMesem || (student.grade && student.grade.toUpperCase().includes('MES'))) && (
                                                            <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-1.5 py-0.5 rounded border border-indigo-200">
                                                                MESEM
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-slate-400 font-normal">
                                                        {student.companyName ? `İşletme: ${student.companyName}` : student.fatherName ? `Baba: ${student.fatherName}` : ''}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-slate-600">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">
                                                {student.grade}
                                            </span>
                                        </td>
                                        <td className="p-4 text-slate-500 font-mono">{student.tcNo || '-'}</td>
                                        <td className="p-4">
                                            <span className="text-xs border border-slate-200 px-2 py-1 rounded text-slate-500">
                                                {student.boardingStatus}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {(() => {
                                                const score = getStudentBehaviorScore(student, incidents);
                                                let scoreColor = "bg-green-50 text-green-700 border-green-200";
                                                if (score < 60) scoreColor = "bg-red-50 text-red-700 border-red-200";
                                                else if (score < 85) scoreColor = "bg-amber-50 text-amber-700 border-amber-200";
                                                return (
                                                    <span className={`text-xs font-mono font-bold border px-2 py-1 rounded-full ${scoreColor}`}>
                                                        {score} / 100
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                <button 
                                                    onClick={() => setSelectedStudent(student)}
                                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Detaylar"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(window.confirm('Silmek istediğinize emin misiniz?')) removeStudent(student.id);
                                                    }}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Sil"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={6} className="p-8 text-center text-slate-400">
                                            {selectedGrade ? `${selectedGrade} sınıfında öğrenci bulunamadı.` : 'Aranan kriterde öğrenci bulunamadı.'}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
          </div>
      </div>

      {/* Manual Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-fade-in max-h-[90vh] overflow-y-auto">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="font-bold text-slate-800">Yeni Öğrenci Ekle</h3>
                        <p className="text-xs text-slate-500">e-Okul Künye Defteri veri alanlarıyla uyumlu bireysel kayıt</p>
                    </div>
                    <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleManualAdd} className="p-6 space-y-6">
                    {/* Bilgilendirme Notu */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                            <strong>e-Okul Künye Defteri Uyumu:</strong> Bu formdaki tüm veri alanları (T.C. Kimlik, Kütük, Anne-Baba, İkamet ve Veli) e-Okul Künye Defteri resmi verileriyle birebir uyumludur. Çok sayıda öğrenci eklemek için doğrudan <strong>e-Okul Künye Defteri Excel dosyasını</strong> yükleyebilirsiniz.
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                             <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-1">
                                <User className="w-3 h-3" /> Temel Bilgiler
                             </h4>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Okul No</label>
                            <input required type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500"
                                value={newStudent.number} onChange={e => setNewStudent({...newStudent, number: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Adı Soyadı</label>
                            <input required type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500"
                                value={newStudent.name} onChange={e => setNewStudent({...newStudent, name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">TC Kimlik No</label>
                            <input type="text" maxLength={11} className="w-full p-2 border rounded-lg outline-none focus:border-blue-500"
                                value={newStudent.tcNo} onChange={e => setNewStudent({...newStudent, tcNo: e.target.value})} />
                        </div>
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Sınıf</label>
                            <input required type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500"
                                value={newStudent.grade} onChange={e => setNewStudent({...newStudent, grade: e.target.value})} />
                        </div>
                        
                        <div className="md:col-span-2 mt-2">
                             <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-1">
                                <Info className="w-3 h-3" /> Aile ve Kimlik
                             </h4>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Baba Adı</label>
                            <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500"
                                value={newStudent.fatherName} onChange={e => setNewStudent({...newStudent, fatherName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Anne Adı</label>
                            <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500"
                                value={newStudent.motherName} onChange={e => setNewStudent({...newStudent, motherName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Veli Adı Soyadı</label>
                            <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500"
                                value={newStudent.parentName} onChange={e => setNewStudent({...newStudent, parentName: e.target.value})} />
                        </div>
                         <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Doğum Yeri/Tarihi</label>
                            <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500"
                                value={newStudent.birthPlaceDate} onChange={e => setNewStudent({...newStudent, birthPlaceDate: e.target.value})} />
                        </div>

                         <div className="md:col-span-2 mt-2">
                             <h4 className="text-xs font-bold text-blue-600 uppercase mb-3 flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> Adres ve Kayıt
                             </h4>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">İl</label>
                            <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500"
                                value={newStudent.province} onChange={e => setNewStudent({...newStudent, province: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">İlçe</label>
                            <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500"
                                value={newStudent.district} onChange={e => setNewStudent({...newStudent, district: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Cinsiyeti</label>
                            <select className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 bg-white"
                                value={newStudent.gender} onChange={e => setNewStudent({...newStudent, gender: e.target.value})}>
                                <option value="Erkek">Erkek</option>
                                <option value="Kız">Kız</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Sağlık Durumu</label>
                            <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500"
                                placeholder="İyi, Kronik Rahatsızlığı Yok vb."
                                value={newStudent.healthStatus} onChange={e => setNewStudent({...newStudent, healthStatus: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-slate-500 mb-1">Yatılılık ve Pansiyon Durumu</label>
                            <select className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 bg-white"
                                value={newStudent.boardingStatus} onChange={e => setNewStudent({...newStudent, boardingStatus: e.target.value})}>
                                <option value="GÜNDÜZLÜ">GÜNDÜZLÜ</option>
                                <option value="PARASIZ YATILI">PARASIZ YATILI</option>
                                <option value="PARALI YATILI">PARALI YATILI</option>
                            </select>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                         <button 
                            type="button" 
                            onClick={() => setShowAddModal(false)}
                            className="px-4 py-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                            İptal
                        </button>
                        <button 
                            type="submit"
                            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />
                            Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Full Detail Modal */}
      {selectedStudent && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl my-8 relative flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-slate-800 text-white p-6 rounded-t-xl flex justify-between items-start shrink-0">
                    <div className="flex gap-4">
                        <div className="w-16 h-16 bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 shrink-0">
                            <User className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">{selectedStudent.name}</h2>
                            <p className="text-slate-300 text-sm mt-1">{selectedStudent.number} • {selectedStudent.grade}</p>
                            <div className="flex gap-2 mt-2 flex-wrap">
                                <span className="bg-blue-500/20 text-blue-200 text-xs px-2 py-0.5 rounded border border-blue-500/30">{selectedStudent.registrationType || 'Normal Kayıt'}</span>
                                <span className="bg-emerald-500/20 text-emerald-200 text-xs px-2 py-0.5 rounded border border-emerald-500/30">{selectedStudent.boardingStatus}</span>
                                {(() => {
                                    const score = getStudentBehaviorScore(selectedStudent, incidents);
                                    let scoreBg = "bg-green-500/20 text-green-205 text-green-300 border-green-500/30";
                                    if (score < 60) scoreBg = "bg-red-500/20 text-red-305 text-red-300 border-red-500/30";
                                    else if (score < 85) scoreBg = "bg-amber-500/20 text-amber-305 text-amber-300 border-amber-500/30";
                                    return (
                                        <span className={`text-xs px-2 py-0.5 rounded border font-bold ${scoreBg}`}>
                                            Davranış Notu: {score} / 100
                                        </span>
                                    );
                                })()}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                        <button 
                            onClick={() => exportStudentToDocx(selectedStudent, incidents, institution, boardMembers)}
                            className="text-slate-300 hover:text-white px-3 py-1.5 bg-blue-700/60 hover:bg-blue-600 rounded flex items-center gap-1.5 text-xs font-semibold transition-colors border border-blue-500/50 cursor-pointer"
                            title="Öğrenci Disiplin Kaydı (Word .docx)"
                        >
                            <FileText className="w-3.5 h-3.5" /> Word (.docx)
                        </button>
                        <button 
                            onClick={() => exportStudentToPDF(selectedStudent, incidents, institution, boardMembers)}
                            className="text-slate-300 hover:text-white px-3 py-1.5 bg-red-700/60 hover:bg-red-600 rounded flex items-center gap-1.5 text-xs font-semibold transition-colors border border-red-500/50 cursor-pointer"
                            title="Öğrenci Disiplin Kaydı (PDF)"
                        >
                            <FileText className="w-3.5 h-3.5" /> PDF Al
                        </button>
                        <button onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-white p-1">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                {isEditing ? (
                  <div className="p-8 overflow-y-auto custom-scrollbar space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="md:col-span-2">
                              <h4 className="text-xs font-bold text-blue-600 uppercase border-b border-blue-100 pb-1.5 flex items-center gap-1">
                                  Temel Bilgiler
                              </h4>
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Adı Soyadı</label>
                              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                                  value={editFields.name || ''} onChange={e => setEditFields({...editFields, name: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Okul No</label>
                              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm font-mono"
                                  value={editFields.number || ''} onChange={e => setEditFields({...editFields, number: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">TC Kimlik No</label>
                              <input type="text" maxLength={11} className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm font-mono"
                                  value={editFields.tcNo || ''} onChange={e => setEditFields({...editFields, tcNo: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Sınıf / Şube</label>
                              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                                  value={editFields.grade || ''} onChange={e => setEditFields({...editFields, grade: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Cinsiyeti</label>
                              <select className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 bg-white text-sm"
                                  value={editFields.gender || 'Erkek'} onChange={e => setEditFields({...editFields, gender: e.target.value})}>
                                  <option value="Erkek">Erkek</option>
                                  <option value="Kız">Kız</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Sağlık Durumu</label>
                              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                                  value={editFields.healthStatus || ''} onChange={e => setEditFields({...editFields, healthStatus: e.target.value})} />
                          </div>

                          <div className="md:col-span-2 mt-4">
                              <h4 className="text-xs font-bold text-blue-600 uppercase border-b border-blue-100 pb-1.5 flex items-center gap-1">
                                  Pansiyon ve Kayıt Bilgileri
                              </h4>
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Yatılılık ve Pansiyon Durumu</label>
                              <select className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 bg-white text-sm"
                                  value={editFields.boardingStatus || 'GÜNDÜZLÜ'} onChange={e => setEditFields({...editFields, boardingStatus: e.target.value})}>
                                  <option value="GÜNDÜZLÜ">GÜNDÜZLÜ</option>
                                  <option value="PARASIZ YATILI">PARASIZ YATILI</option>
                                  <option value="PARALI YATILI">PARALI YATILI</option>
                              </select>
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Bursluluk</label>
                              <select className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 bg-white text-sm"
                                  value={editFields.scholarshipStatus || 'BURSSUZ'} onChange={e => setEditFields({...editFields, scholarshipStatus: e.target.value})}>
                                  <option value="BURSSUZ">BURSSUZ</option>
                                  <option value="BURSLU">BURSLU</option>
                              </select>
                          </div>
                          
                          <div className="md:col-span-2 mt-4">
                              <h4 className="text-xs font-bold text-blue-600 uppercase border-b border-blue-100 pb-1.5 flex items-center gap-1">
                                  Nüfus ve Veli Bilgileri
                              </h4>
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Baba Adı</label>
                              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                                  value={editFields.fatherName || ''} onChange={e => setEditFields({...editFields, fatherName: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Anne Adı</label>
                              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                                  value={editFields.motherName || ''} onChange={e => setEditFields({...editFields, motherName: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Doğum Yeri/Tarihi</label>
                              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                                  value={editFields.birthPlaceDate || ''} onChange={e => setEditFields({...editFields, birthPlaceDate: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Veli Adı Soyadı</label>
                              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                                  value={editFields.parentName || ''} onChange={e => setEditFields({...editFields, parentName: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Veli Telefon</label>
                              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                                  value={editFields.parentPhone || ''} onChange={e => setEditFields({...editFields, parentPhone: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">İl</label>
                              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                                  value={editFields.province || ''} onChange={e => setEditFields({...editFields, province: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1">İlçe</label>
                              <input type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                                  value={editFields.district || ''} onChange={e => setEditFields({...editFields, district: e.target.value})} />
                          </div>
                          <div>
                              <label className="block text-xs font-semibold text-slate-500 mb-1 font-bold">Cilt / Aile Sıra / Sıra No</label>
                              <div className="grid grid-cols-3 gap-2">
                                  <input placeholder="Cilt" type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-xs text-center font-mono"
                                      value={editFields.volumeNo || ''} onChange={e => setEditFields({...editFields, volumeNo: e.target.value})} />
                                  <input placeholder="Aile" type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-xs text-center font-mono"
                                      value={editFields.familyOrderNo || ''} onChange={e => setEditFields({...editFields, familyOrderNo: e.target.value})} />
                                  <input placeholder="Sıra" type="text" className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-xs text-center font-mono"
                                      value={editFields.orderNo || ''} onChange={e => setEditFields({...editFields, orderNo: e.target.value})} />
                              </div>
                          </div>
                          <div className="md:col-span-2">
                              <label className="block text-xs font-semibold text-slate-500 mb-1">Adres</label>
                              <textarea rows={2} className="w-full p-2 border rounded-lg outline-none focus:border-blue-500 text-sm"
                                  value={editFields.address || ''} onChange={e => setEditFields({...editFields, address: e.target.value})} />
                          </div>
                      </div>
                  </div>
                ) : (
                  <div className="p-8 overflow-y-auto custom-scrollbar">
                      
                      {/* Section 1: Kimlik */}
                      <div className="mb-8">
                          <h3 className="text-sm font-bold text-slate-800 uppercase border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                              <Info className="w-4 h-4 text-blue-600" /> Nüfus & Kimlik Bilgileri
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <DetailRow label="TC Kimlik No" value={selectedStudent.tcNo} />
                              <DetailRow label="Cinsiyeti" value={selectedStudent.gender || 'Erkek'} />
                              <DetailRow label="Sağlık Durumu" value={selectedStudent.healthStatus || 'İyi'} />
                              <DetailRow label="Baba Adı" value={selectedStudent.fatherName} />
                              <DetailRow label="Anne Adı" value={selectedStudent.motherName} />
                              <DetailRow label="Doğum Yeri/Tarihi" value={selectedStudent.birthPlaceDate} />
                              <DetailRow label="İl" value={selectedStudent.province} />
                              <DetailRow label="İlçe" value={selectedStudent.district} />
                              <DetailRow label="Mahalle/Köy" value={selectedStudent.neighborhood} fullWidth />
                              <DetailRow label="Cilt No" value={selectedStudent.volumeNo} />
                              <DetailRow label="Aile Sıra No" value={selectedStudent.familyOrderNo} />
                              <DetailRow label="Sıra No" value={selectedStudent.orderNo} />
                          </div>
                      </div>

                      {/* Section 2: Okul */}
                      <div className="mb-8">
                          <h3 className="text-sm font-bold text-slate-800 uppercase border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-blue-600" /> Okul & Kayıt Bilgileri
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                              <DetailRow label="Kabul Ed. Sınıf" value={selectedStudent.grade} />
                              <DetailRow label="Öğrenim Belgesi" value={selectedStudent.previousSchoolInfo} />
                              <DetailRow label="Kayıt Tarihi" value={selectedStudent.registrationDate} />
                              <DetailRow label="Sınav Durumu" value={selectedStudent.examStatus} />
                              <DetailRow label="Yatılılık" value={selectedStudent.boardingStatus} />
                              <DetailRow label="Bursluluk" value={selectedStudent.scholarshipStatus} />
                          </div>
                      </div>

                       {/* Section 3: İletişim */}
                       <div>
                          <h3 className="text-sm font-bold text-slate-800 uppercase border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-blue-600" /> İletişim & Veli
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <DetailRow label="Veli Adı Soyadı" value={selectedStudent.parentName} />
                              <DetailRow label="Adres" value={selectedStudent.address} fullWidth />
                          </div>
                      </div>

                       {/* Section 4: Disiplin Geçmişi ve Alınan Cezalar */}
                       <div className="mt-8 pt-6 border-t border-slate-200">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-2 mb-4">
                              <h3 className="text-sm font-bold text-slate-800 uppercase flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-500" /> Disiplin Cezaları & Geçmişi
                              </h3>
                              <button
                                  onClick={() => {
                                      setPastPenaltyForm({
                                          decision: 'KINAMA',
                                          decisionNo: '',
                                          decisionDate: new Date().toISOString().split('T')[0],
                                          decisionReason: '',
                                          title: 'Geçmiş Disiplin Cezası',
                                          penaltyScore: '10'
                                      });
                                      setShowPastPenaltyModal(true);
                                  }}
                                  className="text-xs bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
                              >
                                  <Plus className="w-3.5 h-3.5" /> Manuel Eski Ceza Ekle
                              </button>
                          </div>
                          {(() => {
                              const activeIncidents = incidents.filter(inc => 
                                  inc.involvedStudents.some(inv => 
                                      inv.studentId === selectedStudent.id && 
                                      inv.decision && 
                                      !inv.decision.includes('YER OLMADIĞINA') &&
                                      inv.role === 'suspect'
                                  )
                              ).map(inc => {
                                  const inv = inc.involvedStudents.find(i => i.studentId === selectedStudent.id);
                                  return {
                                      id: inc.id,
                                      type: 'incident' as const,
                                      decision: inv?.decision || '',
                                      code: inc.code,
                                      title: inc.title,
                                      decisionNo: inv?.decisionNo,
                                      decisionDate: inv?.decisionDate || inc.date,
                                      decisionReason: inv?.decisionReason,
                                      penaltyScore: inv?.penaltyScore || '10',
                                      isRemoved: inv?.isRemoved || false,
                                      removedDecisionNo: inv?.removedDecisionNo,
                                      removedDate: inv?.removedDate,
                                      removedReason: inv?.removedReason
                                  };
                              });

                              const pastList = (selectedStudent.previousPenalties || []).map(p => ({
                                  id: p.id,
                                  type: 'past' as const,
                                  decision: p.decision,
                                  code: 'GEÇMİŞ KAYIT',
                                  title: p.description || 'e-Okul / Eski Kurum Dosyası Cezası',
                                  decisionNo: p.decisionNo,
                                  decisionDate: p.date,
                                  decisionReason: p.description,
                                  penaltyScore: p.penaltyScore || '10',
                                  isRemoved: p.isRemoved || false,
                                  removedDecisionNo: p.removedDecisionNo,
                                  removedDate: p.removedDate,
                                  removedReason: p.removedReason
                              }));

                              const allStudentPenalties = [...activeIncidents, ...pastList];
                              
                              if (allStudentPenalties.length === 0) {
                                  return (
                                      <div className="text-center p-6 bg-slate-50 border border-dashed rounded-lg text-slate-400 text-xs">
                                          Öğrencinin kayıtlı aktif veya geçmiş herhangi bir disiplin cezası bulunmamaktadır.
                                      </div>
                                  );
                              }

                              return (
                                  <div className="space-y-3">
                                      {allStudentPenalties.map(item => {
                                          return (
                                              <div 
                                                key={item.id} 
                                                className={`p-4 rounded-lg border flex flex-col md:flex-row justify-between items-start md:items-center gap-3 ${
                                                  item.isRemoved 
                                                    ? 'bg-emerald-50/50 border-emerald-200' 
                                                    : 'bg-amber-50/40 border-amber-200'
                                                }`}
                                              >
                                                  <div>
                                                      <div className="flex items-center gap-2 flex-wrap">
                                                          {item.isRemoved ? (
                                                              <span className="bg-emerald-100 text-emerald-800 font-bold text-xs px-2.5 py-0.5 rounded border border-emerald-300 flex items-center gap-1">
                                                                  ✓ CEZASI KALDIRILDI (Puan İade Edildi)
                                                              </span>
                                                          ) : (
                                                              <span className="bg-red-100 text-red-800 font-bold text-xs px-2.5 py-0.5 rounded border border-red-200">
                                                                  {item.decision}
                                                              </span>
                                                          )}
                                                          <span className="text-xs font-mono font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                              {item.code}
                                                          </span>
                                                          {item.isRemoved ? (
                                                              <span className="text-[10.5px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold border border-emerald-200">
                                                                  İade Edilen Puan: +{item.penaltyScore}
                                                              </span>
                                                          ) : (
                                                              <span className="text-[10.5px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                                                                  Puan Cezası: -{item.penaltyScore}
                                                              </span>
                                                          )}
                                                      </div>
                                                      <p className="font-bold text-slate-800 text-sm mt-1.5">
                                                        {item.isRemoved && <span className="line-through text-slate-500 mr-2">{item.decision}</span>}
                                                        {item.title}
                                                      </p>
                                                      {item.decisionReason && (
                                                          <p className="text-xs text-slate-600 mt-1 italic">"{item.decisionReason}"</p>
                                                      )}
                                                      {item.isRemoved && (
                                                          <div className="mt-2 text-xs bg-white p-2 rounded border border-emerald-200 text-emerald-900 space-y-0.5">
                                                              <div><strong>Kaldırma Karar No:</strong> {item.removedDecisionNo || 'Girilmedi'} • <strong>Tarih:</strong> {item.removedDate || 'Bilinmiyor'}</div>
                                                              {item.removedReason && <div><strong>Gerekçe:</strong> {item.removedReason}</div>}
                                                          </div>
                                                      )}
                                                  </div>
                                                  <div className="text-right shrink-0">
                                                      <div className="text-xs text-slate-600 font-bold">Karar No: {item.decisionNo || 'Belirtilmedi'}</div>
                                                      <div className="text-xs text-slate-400 mt-0.5">Tarih: {item.decisionDate ? new Date(item.decisionDate).toLocaleDateString('tr-TR') : 'Bilinmiyor'}</div>
                                                  </div>
                                              </div>
                                          );
                                      })}
                                  </div>
                              );
                          })()}
                       </div>

                  </div>
                )}
                
                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 shrink-0">
                    {isEditing ? (
                        <>
                            <button 
                                onClick={() => {
                                    setIsEditing(false);
                                }}
                                className="px-5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium text-sm"
                            >
                                İptal / Vazgeç
                            </button>
                            <button 
                                onClick={() => {
                                    updateStudent(selectedStudent.id, editFields);
                                    setSelectedStudent({ ...selectedStudent, ...editFields } as Student);
                                    setIsEditing(false);
                                }}
                                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm flex items-center gap-1.5 shadow-sm"
                            >
                                <Save className="w-4 h-4" /> Değişiklikleri Kaydet
                            </button>
                        </>
                    ) : (
                        <>
                            <button 
                                onClick={() => {
                                    setEditFields(selectedStudent);
                                    setIsEditing(true);
                                }}
                                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors font-semibold text-sm flex items-center gap-1.5 mr-auto"
                            >
                                <Edit3 className="w-4 h-4" /> Öğrenciyi Düzenle
                            </button>
                            <button 
                                onClick={() => {
                                    setSelectedStudent(null);
                                    setIsEditing(false);
                                }}
                                className="px-6 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors font-medium text-sm"
                            >
                                Kapat
                            </button>
                        </>
                    )}
                </div>
            </div>
          </div>
      )}

      {/* Delete Confirmation Modal (Class Delete) */}
      {classDeleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-slate-100 bg-red-50 flex items-center gap-3">
                 <div className="bg-red-100 p-2 rounded-full"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                 <h3 className="font-bold text-red-900">Sınıf Silme Onayı</h3>
              </div>
              <div className="p-6 text-slate-600 text-sm">
                 <p className="font-bold text-slate-800 mb-2 text-lg">"{classDeleteTarget}"</p>
                 <p>Bu sınıfa ait toplam <strong className="text-red-600">{getTargetStudentCount()}</strong> öğrenci kaydı silinecek.</p>
                 <p className="mt-2 text-xs text-slate-500">Bu işlem geri alınamaz. Devam etmek istiyor musunuz?</p>
              </div>
              <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                 <button 
                    onClick={() => setClassDeleteTarget(null)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                 >
                    İptal
                 </button>
                 <button 
                    onClick={confirmClassDelete}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
                 >
                    Evet, Sil
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* File Processing Spinner Overlay */}
      {isProcessingFile && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full text-center border border-slate-100 flex flex-col items-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-inner">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              e-Okul Belgesi Taranıyor
            </h3>
            <p className="text-xs text-slate-500 mb-4 max-w-xs leading-relaxed">
              {processingStatus || "Dosyadaki öğrenci künye bilgileri (TC, anne/baba, veli telefonu, adres vb.) ayrıştırılıyor..."}
            </p>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full w-full animate-pulse rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Excel / PDF Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden animate-fade-in max-h-[92vh] flex flex-col border border-slate-200">
                
                {/* Header */}
                <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-start bg-gradient-to-r from-slate-50 to-blue-50/40">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                e-Okul Künye Defteri Verilerini İncele & Onayla
                            </h3>
                            {detectedFormatName && (
                                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3 text-emerald-600" />
                                    {detectedFormatName}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            Yüklenen belgeden toplam <strong>{parsedStudents.length}</strong> öğrenci künyesi ayrıştırıldı. Bilgileri gözden geçirip sisteme aktarabilirsiniz.
                        </p>
                    </div>
                    <button 
                        onClick={() => { setShowReviewModal(false); setExpandedReviewId(null); }} 
                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                {/* Künye Extraction Statistics Badges */}
                <div className="bg-white px-4 py-2.5 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-[11px]">
                    <span className="font-semibold text-slate-400 uppercase tracking-wider shrink-0 text-[10px]">
                        Çekilen Künye Verileri:
                    </span>
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-semibold shrink-0">
                        TC Kimlik: {parseSummary?.withTc || parsedStudents.filter(s => s.tcNo).length}/{parsedStudents.length}
                    </span>
                    <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md font-semibold shrink-0">
                        Anne & Baba: {parseSummary?.withParents || parsedStudents.filter(s => s.fatherName || s.motherName).length}/{parsedStudents.length}
                    </span>
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold shrink-0">
                        Veli & İletişim: {parseSummary?.withContact || parsedStudents.filter(s => s.parentPhone || s.parentName).length}/{parsedStudents.length}
                    </span>
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-semibold shrink-0">
                        Doğum Bilgisi: {parseSummary?.withBirthInfo || parsedStudents.filter(s => s.birthPlaceDate).length}/{parsedStudents.length}
                    </span>
                    <span className="bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-md font-semibold shrink-0">
                        Adres & Nüfus: {parseSummary?.withAddress || parsedStudents.filter(s => s.address || s.province).length}/{parsedStudents.length}
                    </span>
                </div>

                {/* Bulk Actions and Search Bar */}
                <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                        <div className="flex items-center gap-1.5 flex-1 max-w-xs">
                            <input 
                                type="text" 
                                placeholder="Toplu sınıf ata (Örn: 9-A)"
                                value={bulkGrade}
                                onChange={(e) => setBulkGrade(e.target.value.toUpperCase())}
                                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500 font-medium"
                            />
                            <button 
                                onClick={applyBulkGrade}
                                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shrink-0 shadow-2xs"
                            >
                                Uygula
                            </button>
                        </div>

                        <div className="relative flex-1 max-w-xs hidden md:block">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                            <input 
                                type="text"
                                placeholder="Ayrıştırılanlarda ara (No, Ad, TC)..."
                                value={reviewFilterQuery}
                                onChange={(e) => setReviewFilterQuery(e.target.value)}
                                className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 text-right">
                        <span className="text-xs text-slate-500">
                            Seçili Öğrenci:
                        </span>
                        <span className="text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-lg">
                            {selectedParsedIds.length} / {parsedStudents.length}
                        </span>
                    </div>
                </div>

                {/* Student Table */}
                <div className="flex-1 overflow-auto p-2 sm:p-4">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-100 text-slate-600 text-[11px] uppercase tracking-wider sticky top-0 z-10 shadow-2xs">
                                <th className="p-3 border-b border-slate-200 w-10">
                                    <input 
                                        type="checkbox" 
                                        checked={selectedParsedIds.length > 0 && selectedParsedIds.length === parsedStudents.length}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedParsedIds(parsedStudents.map(s => s.id!));
                                            else setSelectedParsedIds([]);
                                        }}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                                    />
                                </th>
                                <th className="p-3 border-b border-slate-200">No</th>
                                <th className="p-3 border-b border-slate-200">Ad Soyad</th>
                                <th className="p-3 border-b border-slate-200">Sınıf / Şube</th>
                                <th className="p-3 border-b border-slate-200">T.C. Kimlik</th>
                                <th className="p-3 border-b border-slate-200">Anne & Baba</th>
                                <th className="p-3 border-b border-slate-200">Veli & Telefon</th>
                                <th className="p-3 border-b border-slate-200 text-center">Künye Detayı</th>
                            </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-100">
                            {parsedStudents
                              .filter(s => {
                                if (!reviewFilterQuery) return true;
                                const q = reviewFilterQuery.toLowerCase();
                                return (
                                  s.name?.toLowerCase().includes(q) ||
                                  s.number?.includes(q) ||
                                  s.tcNo?.includes(q) ||
                                  s.grade?.toLowerCase().includes(q)
                                );
                              })
                              .map((s) => {
                                const isSelected = selectedParsedIds.includes(s.id!);
                                const isExpanded = expandedReviewId === s.id;
                                const fieldCount = s._extractedFieldCount || countExtractedFields(s);

                                return (
                                  <React.Fragment key={s.id}>
                                    <tr className={`hover:bg-blue-50/40 transition-colors ${isSelected ? 'bg-blue-50/20' : ''}`}>
                                        <td className="p-3">
                                            <input 
                                                type="checkbox" 
                                                checked={isSelected}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedParsedIds([...selectedParsedIds, s.id!]);
                                                    else setSelectedParsedIds(selectedParsedIds.filter(id => id !== s.id));
                                                }}
                                                className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                                            />
                                        </td>
                                        <td className="p-3 font-bold text-slate-800 font-mono">{s.number}</td>
                                        <td className="p-3 font-semibold text-slate-900">{s.name}</td>
                                        <td className="p-3">
                                            <input 
                                                type="text" 
                                                value={s.grade || ''}
                                                placeholder="Sınıf gir..."
                                                onChange={(e) => updateParsedStudent(s.id!, 'grade', e.target.value.toUpperCase())}
                                                className="w-24 p-1.5 border border-slate-300 rounded-md text-xs outline-none focus:border-blue-500 font-medium"
                                            />
                                        </td>
                                        <td className="p-3 font-mono text-slate-700">
                                            {s.tcNo ? (
                                                <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                                    {s.tcNo}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-slate-700">
                                            {s.motherName || s.fatherName ? (
                                                <div className="space-y-0.5">
                                                    {s.fatherName && <div className="text-[11px]"><span className="text-slate-400">B:</span> {s.fatherName}</div>}
                                                    {s.motherName && <div className="text-[11px]"><span className="text-slate-400">A:</span> {s.motherName}</div>}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-slate-700">
                                            {s.parentName || s.parentPhone ? (
                                                <div className="space-y-0.5">
                                                    {s.parentName && <div className="font-medium text-slate-800">{s.parentName}</div>}
                                                    {s.parentPhone && <div className="text-[10px] text-slate-500 font-mono">{s.parentPhone}</div>}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300">-</span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button 
                                                onClick={() => setExpandedReviewId(isExpanded ? null : s.id!)}
                                                className={`px-2 py-1 rounded-md text-[10px] font-semibold border transition-colors inline-flex items-center gap-1 cursor-pointer ${
                                                    isExpanded 
                                                        ? 'bg-blue-600 text-white border-blue-600' 
                                                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                                }`}
                                            >
                                                <span>{fieldCount} Alan</span>
                                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Expanded Künye Card View */}
                                    {isExpanded && (
                                        <tr className="bg-gradient-to-r from-blue-50/50 via-slate-50 to-indigo-50/40">
                                            <td colSpan={8} className="p-4 border-b border-blue-200/60">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-white p-3.5 rounded-xl border border-blue-100 shadow-xs">
                                                    <div>
                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Doğum Bilgileri</span>
                                                        <p className="text-xs font-semibold text-slate-800 mt-0.5">
                                                            {s.birthPlaceDate || 'Belirtilmedi'}
                                                        </p>
                                                        <span className="block text-[10px] text-slate-500 mt-1">Cinsiyet: {s.gender || 'Belirtilmedi'}</span>
                                                    </div>

                                                    <div>
                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Nüfus Kaydı</span>
                                                        <p className="text-xs text-slate-800 mt-0.5">
                                                            {[s.province, s.district, s.neighborhood].filter(Boolean).join(' / ') || 'Belirtilmedi'}
                                                        </p>
                                                        {(s.volumeNo || s.familyOrderNo || s.orderNo) && (
                                                            <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                                                                Cilt:{s.volumeNo || '-'} / Aile:{s.familyOrderNo || '-'} / Sıra:{s.orderNo || '-'}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Kayıt & Pansiyon</span>
                                                        <p className="text-xs text-slate-800 mt-0.5">
                                                            {s.registrationType || 'Yeni Kayıt'} • {s.boardingStatus || 'GÜNDÜZLÜ'}
                                                        </p>
                                                        <span className="block text-[10px] text-slate-500 mt-0.5">
                                                            Burs: {s.scholarshipStatus || 'BURSSUZ'}{s.registrationDate ? ` • Kayıt: ${s.registrationDate}` : ''}
                                                        </span>
                                                        {s.previousSchoolInfo && (
                                                            <span className="block text-[10px] text-indigo-600 mt-0.5 truncate" title={s.previousSchoolInfo}>
                                                                Geldiği: {s.previousSchoolInfo}
                                                            </span>
                                                        )}
                                                        {s.healthStatus && (
                                                            <span className="block text-[10px] text-rose-600 mt-0.5">
                                                                Kan Grubu / Sağlık: {s.healthStatus}
                                                            </span>
                                                        )}
                                                    </div>

                                                    <div>
                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">İkametgâh Adresi</span>
                                                        <p className="text-xs text-slate-700 mt-0.5 line-clamp-2">
                                                            {s.address || 'Adres bilgisi bulunamadı'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                  </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50">
                    <span className="text-xs text-slate-500">
                        Seçilen <strong>{selectedParsedIds.length}</strong> öğrenci sisteminize eklenecektir.
                    </span>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => { setShowReviewModal(false); setExpandedReviewId(null); }}
                            className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                        >
                            İptal
                        </button>
                        <button 
                            onClick={handleFinalizeUpload}
                            disabled={selectedParsedIds.length === 0}
                            className="bg-emerald-600 text-white px-5 py-2 rounded-lg font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm text-xs cursor-pointer disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            Seçilenleri Kaydet ({selectedParsedIds.length})
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Manual Former Penalty Modal */}
      {showPastPenaltyModal && selectedStudent && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm animate-fade-in text-slate-800">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden relative border border-slate-100">
                <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-500 animate-pulse" />
                        <h3 className="font-bold text-sm">Geçmiş Ceza Kaydı Ekle</h3>
                    </div>
                    <button onClick={() => setShowPastPenaltyModal(false)} className="text-slate-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                
                <form onSubmit={(e) => {
                    e.preventDefault();
                    if (!pastPenaltyForm.decisionNo) {
                        alert("Lütfen Karar No giriniz.");
                        return;
                    }
                    
                    const codeDate = new Date(pastPenaltyForm.decisionDate);
                    const newPastIncident = {
                        id: Math.random().toString(36).substr(2, 9),
                        code: `GEÇMİŞ-${codeDate.getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
                        title: pastPenaltyForm.title || `Geçmiş Davranış İhlali: ${pastPenaltyForm.decision}`,
                        date: pastPenaltyForm.decisionDate,
                        time: '12:00',
                        location: 'Eski Okul / Kurum',
                        description: pastPenaltyForm.decisionReason || 'E-Okul dökümünden manuel aktarılan ceza kaydı.',
                        status: 'decided' as const,
                        involvedStudents: [{
                            studentId: selectedStudent.id,
                            role: 'suspect' as const,
                            decision: pastPenaltyForm.decision,
                            decisionNo: pastPenaltyForm.decisionNo,
                            decisionDate: pastPenaltyForm.decisionDate,
                            decisionReason: pastPenaltyForm.decisionReason,
                            penaltyScore: pastPenaltyForm.penaltyScore
                        }]
                    };
                    addIncident(newPastIncident);
                    
                    setShowPastPenaltyModal(false);
                    setSuccessMessage("Geçmiş ceza kaydı başarıyla eklendi.");
                    setTimeout(() => setSuccessMessage(null), 3000);
                }} className="p-6 space-y-4">
                    <div className="p-3 bg-slate-50 border rounded-lg text-xs leading-relaxed text-slate-600">
                        Bu form, öğrencinin sisteme dahil edilmeden önce (başka okuldan nakil veya eski yıllardan) aldığı cezaları e-Okul'dan manuel olarak aktarmak için kullanılır. Eklenen cezalar <b>Tekerrür Analizi</b> ve <b>Sınıf/İstatistik</b> sayfalarında aktif olarak dikkate alınır.
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1 font-sans">Öğrenci</label>
                        <input type="text" className="w-full p-2 bg-slate-100 border rounded-lg text-xs font-semibold text-slate-700 outline-none" value={`${selectedStudent.name} (${selectedStudent.number} - ${selectedStudent.grade})`} readOnly />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1 font-sans">Olay / Cezaya Esas Davranış Başlığı</label>
                        <input type="text" value={pastPenaltyForm.title} onChange={e => setPastPenaltyForm({...pastPenaltyForm, title: e.target.value})} className="w-full p-2 border rounded-lg text-xs outline-none focus:border-blue-500" placeholder="Örn: Derse Geç Kalma vb." required />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1 font-sans">Karar No / Sayı</label>
                            <input type="text" value={pastPenaltyForm.decisionNo} onChange={e => setPastPenaltyForm({...pastPenaltyForm, decisionNo: e.target.value})} className="w-full p-2 border rounded-lg text-xs outline-none focus:border-blue-500" placeholder="Örn: 2024/12" required />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1 font-sans">Karar Tarihi</label>
                            <input type="date" value={pastPenaltyForm.decisionDate} onChange={e => setPastPenaltyForm({...pastPenaltyForm, decisionDate: e.target.value})} className="w-full p-2 border rounded-lg text-xs outline-none focus:border-blue-500" required />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1 font-sans">Verilen Ceza</label>
                            <select value={pastPenaltyForm.decision} onChange={e => {
                                const val = e.target.value;
                                let score = '10';
                                if (val === 'UYARMA') score = '5';
                                else if (val === 'KINAMA') score = '10';
                                else if (val === 'KISA SÜRELİ UZAKLAŞTIRMA') score = '20';
                                else if (val === 'OKUL DEĞİŞTİRME') score = '40';
                                else if (val === 'ÖRGÜN EĞİTİM DIŞINA ÇIKARMA') score = '80';
                                setPastPenaltyForm({...pastPenaltyForm, decision: val, penaltyScore: score});
                            }} className="w-full p-2 border rounded-lg text-xs outline-none focus:border-blue-500 bg-white">
                                <option value="KINAMA">KINAMA</option>
                                <option value="UYARMA">UYARMA</option>
                                <option value="KISA SÜRELİ UZAKLAŞTIRMA">KISA SÜRELİ UZAKLAŞTIRMA</option>
                                <option value="OKUL DEĞİŞTİRME">OKUL DEĞİŞTİRME</option>
                                <option value="ÖRGÜN EĞİTİM DIŞINA ÇIKARMA">ÖRGÜN EĞİTİM DIŞINA ÇIKARMA</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-600 uppercase mb-1 font-sans">Cezanın Puan Değeri</label>
                            <input type="number" value={pastPenaltyForm.penaltyScore} onChange={e => setPastPenaltyForm({...pastPenaltyForm, penaltyScore: e.target.value})} className="w-full p-2 border rounded-lg text-xs font-bold text-blue-700 bg-blue-50 focus:bg-white outline-none" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1 font-sans">Gerekçe / Açıklama</label>
                        <textarea value={pastPenaltyForm.decisionReason} onChange={e => setPastPenaltyForm({...pastPenaltyForm, decisionReason: e.target.value})} className="w-full p-2 border rounded-lg text-xs outline-none focus:border-blue-500" placeholder="Örn: Okul düzenine aykırı davranış vb." rows={3}></textarea>
                    </div>

                    <div className="pt-3 border-t flex justify-end gap-2 shrink-0 font-medium">
                        <button type="button" onClick={() => setShowPastPenaltyModal(false)} className="px-4 py-2 text-xs text-slate-500 hover:bg-slate-100 rounded-lg transition-colors">İptal</button>
                        <button type="submit" className="px-5 py-2 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-semibold flex items-center gap-1 transition-colors">
                            <Save className="w-3.5 h-3.5" /> Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* e-Okul Künye Defteri Bilgilendirme ve Rehber Modalı */}
      {showEokulGuideModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in max-h-[90vh] flex flex-col border border-slate-200">
                <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-blue-700 to-indigo-800 text-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white/10 rounded-lg">
                            <BookOpen className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="font-bold text-base text-white">e-Okul Künye Defteri İndirme Rehberi</h3>
                            <p className="text-xs text-blue-100">Öğrenci verilerinin sisteme eksiksiz aktarılması için adımlar</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowEokulGuideModal(false)} 
                        className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-4">
                    {/* Bilgi Kutusu */}
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs leading-relaxed">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <strong className="font-semibold block text-amber-950 mb-1">Zorunlu Veri Formatı Bilgisi:</strong>
                            Disiplin kurulu süreçleri ve resmi MEB evrakları (Savunma, İfade, Çağrı Pusulası, Kurul Kararı, Tebligat vb.); 
                            <strong> T.C. Kimlik No, Okul No, Ad-Soyad, Sınıf, Anne/Baba Adı, Doğum Yeri/Tarihi, Veli Bilgileri ve İkametgah</strong> gibi 
                            tüm resmi verileri bu dosyadan çeker. Bu nedenle öğrenci veri aktarımı <strong>sadece e-Okul Künye Defteri verilerine göre</strong> yapılmalıdır.
                        </div>
                    </div>

                    {/* Adımlar */}
                    <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Adım Adım e-Okul'dan Veri Alma:</h4>
                        
                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
                            <div className="text-xs text-slate-700">
                                <strong className="text-slate-900 block font-semibold mb-0.5">e-Okul Sistemine Giriş Yapın:</strong>
                                Resmi <em>e-okul.meb.gov.tr</em> adresine kurum yetkilisi veya idareci MEBBİS kullanıcı şifrenizle giriş yapın.
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
                            <div className="text-xs text-slate-700">
                                <strong className="text-slate-900 block font-semibold mb-0.5">Öğrenci İşlemleri Modülü:</strong>
                                Sol ana menüden okul türünüze göre <strong>"Öğrenci İşlemleri"</strong> veya <strong>"Kurum İşlemleri"</strong> sekmesini açın.
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
                            <div className="text-xs text-slate-700">
                                <strong className="text-slate-900 block font-semibold mb-0.5">Raporlar (Yazıcı Simgesi):</strong>
                                Sayfanın üst araç çubuğunda bulunan <strong>Yazıcı (Raporlar)</strong> simgesine tıklayın.
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</span>
                            <div className="text-xs text-slate-700">
                                <strong className="text-slate-900 block font-semibold mb-0.5">Öğrenci Künye Defteri Raporunu Seçin:</strong>
                                Raporlar penceresinden <strong>"Öğrenci Künye Defteri"</strong> raporuna çift tıklayarak raporu ekrana getirin.
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">5</span>
                            <div className="text-xs text-slate-700">
                                <strong className="text-slate-900 block font-semibold mb-0.5">Excel Formatında İndirin:</strong>
                                Rapor görüntüleyicinin sol üst kısmındaki <strong>Kaydet / Dışa Aktar (Disket)</strong> simgesine tıklayıp <strong>"Excel (.xls veya .xlsx)"</strong> formatını seçerek bilgisayarınıza kaydedin. Sistem tüm e-Okul Excel tablolarını doğrudan ve eksiksiz destekler.
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">6</span>
                            <div className="text-xs text-slate-700">
                                <strong className="text-slate-900 block font-semibold mb-0.5">Uygulamaya Yükleyin:</strong>
                                İndirdiğiniz dosyayı bu ekrandaki <strong>"e-Okul Künye Defteri Yükle"</strong> butonuyla seçin veya sürükleyip bırakın. Tüm öğrenciler ve sınıflar saniyeler içinde otomatik olarak sisteme işlenecektir.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
                    <button 
                        onClick={() => setShowEokulGuideModal(false)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                    >
                        Anladım, Kapat
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default Students;
