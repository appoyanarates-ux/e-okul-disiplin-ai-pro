import React, { useState, useMemo, useRef, useCallback } from 'react';
import { 
  Briefcase, Plus, FileSpreadsheet, Search, Download, 
  Trash2, Edit3, Eye, Phone, MapPin, Building2, UserCheck, 
  CheckCircle2, X, Save, ChevronRight,
  ClipboardPaste, HelpCircle, Printer, Users, FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { exportHtmlToWord } from '../services/exportService';
import { Student } from '../types';
import { useStudents } from '../context/StudentContext';
import { useIncidents } from '../context/IncidentContext';
import { 
  parseMesemRows, 
  generateSampleMesemExcel, 
  ColumnMapping, 
  DetectedColumn 
} from '../services/mesemExcelParser';

const MesemManagement: React.FC = () => {
  const { students, addStudent, removeStudent, updateStudent } = useStudents();
  const { incidents } = useIncidents();

  // Active Tab / View
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedField, setSelectedField] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notifStudent, setNotifStudent] = useState<Student | null>(null);
  const [showHelpGuide, setShowHelpGuide] = useState(false);

  // Upload Modal State
  const [uploadTab, setUploadTab] = useState<'file' | 'paste'>('file');
  const [uploadFormatMode, setUploadFormatMode] = useState<'auto' | 'custom' | 'compound'>('auto');
  const [pasteContent, setPasteContent] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [rawRows, setRawRows] = useState<unknown[][]>([]);
  const [parsedPreview, setParsedPreview] = useState<Partial<Student>[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<DetectedColumn[]>([]);
  const [customMapping, setCustomMapping] = useState<ColumnMapping>({});
  const [selectedPreviewIds, setSelectedPreviewIds] = useState<string[]>([]);
  const [uploadStep, setUploadStep] = useState<'source' | 'mapping' | 'preview'>('source');
  const [bulkGrade, setBulkGrade] = useState('');
  const [bulkField, setBulkField] = useState('');
  const [bulkCoordinator, setBulkCoordinator] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Student Form State
  const [newStudent, setNewStudent] = useState<Partial<Student>>({
    isMesem: true,
    number: '',
    name: '',
    grade: '9-MES',
    tcNo: '',
    mesemField: 'Elektrik-Elektronik Teknolojisi',
    mesemBranch: 'Elektrik Tesisatları ve Dağıtımı',
    companyName: '',
    masterTrainer: '',
    masterTrainerPhone: '',
    coordinatorTeacher: '',
    contractStatus: 'Aktif',
    insuranceStatus: 'Giriş Yapıldı',
    parentPhone: '',
    address: '',
    boardingStatus: 'GÜNDÜZLÜ',
    scholarshipStatus: 'BURSSUZ'
  });

  // Filter only MESEM students (or students whose grade contains 'MES' or marked isMesem)
  const mesemStudents = useMemo(() => {
    return students.filter(s => s.isMesem || (s.grade && s.grade.toUpperCase().includes('MES')));
  }, [students]);

  // Behavior score calculator
  const getStudentBehaviorScore = useCallback((student: Student) => {
    let deducted = 0;
    incidents.forEach(inc => {
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
          else if (dec.includes('UZAKLAŞTIRMA')) score = 20;
          else if (dec.includes('DEĞİŞTİRME')) score = 40;
          else if (dec.includes('DIŞINA ÇIKARMA')) score = 80;
        }
        deducted += score;
      }
    });

    if (student.previousPenalties) {
      student.previousPenalties.forEach(p => {
        if (!p.isRemoved) {
          deducted += parseInt(p.penaltyScore || '10', 10);
        }
      });
    }

    return Math.max(0, 100 - deducted);
  }, [incidents]);

  // Distinct options for filters
  const classOptions = useMemo(() => {
    const set = new Set<string>();
    mesemStudents.forEach(s => { if (s.grade) set.add(s.grade.trim()); });
    return Array.from(set).sort();
  }, [mesemStudents]);

  const fieldOptions = useMemo(() => {
    const set = new Set<string>();
    mesemStudents.forEach(s => { if (s.mesemField) set.add(s.mesemField.trim()); });
    return Array.from(set).sort();
  }, [mesemStudents]);

  const companyOptions = useMemo(() => {
    const set = new Set<string>();
    mesemStudents.forEach(s => { if (s.companyName) set.add(s.companyName.trim()); });
    return Array.from(set).sort();
  }, [mesemStudents]);

  // Filtered List
  const filteredStudents = useMemo(() => {
    return mesemStudents.filter(s => {
      // Search query
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchNo = s.number.includes(q);
        const matchTc = s.tcNo?.includes(q);
        const matchCompany = s.companyName?.toLowerCase().includes(q);
        const matchField = s.mesemField?.toLowerCase().includes(q);
        const matchTrainer = s.masterTrainer?.toLowerCase().includes(q);
        const matchCoord = s.coordinatorTeacher?.toLowerCase().includes(q);
        if (!matchName && !matchNo && !matchTc && !matchCompany && !matchField && !matchTrainer && !matchCoord) {
          return false;
        }
      }

      // Filters
      if (selectedClass !== 'all' && s.grade !== selectedClass) return false;
      if (selectedField !== 'all' && s.mesemField !== selectedField) return false;
      if (selectedCompany !== 'all' && s.companyName !== selectedCompany) return false;
      if (selectedStatus !== 'all' && s.contractStatus !== selectedStatus) return false;

      return true;
    });
  }, [mesemStudents, searchTerm, selectedClass, selectedField, selectedCompany, selectedStatus]);

  // Statistics
  const stats = useMemo(() => {
    const totalStudents = mesemStudents.length;
    const uniqueCompanies = new Set(mesemStudents.map(s => s.companyName).filter(Boolean)).size;
    const uniqueFields = new Set(mesemStudents.map(s => s.mesemField).filter(Boolean)).size;
    const activeContracts = mesemStudents.filter(s => s.contractStatus === 'Aktif').length;
    const disciplined = mesemStudents.filter(s => getStudentBehaviorScore(s) < 100).length;

    return { totalStudents, uniqueCompanies, uniqueFields, activeContracts, disciplined };
  }, [mesemStudents, getStudentBehaviorScore]);

  // Handle File Upload
  const processRawArray = (rows: unknown[][], formatMode = uploadFormatMode) => {
    setRawRows(rows);
    let mappingToUse: ColumnMapping | undefined = undefined;

    if (formatMode === 'compound') {
      mappingToUse = { compoundCell: 0 };
    }

    const result = parseMesemRows(rows, mappingToUse);
    setDetectedColumns(result.detectedColumns);
    setParsedPreview(result.students);
    setSelectedPreviewIds(result.students.map(s => s.id!));

    // Convert detected to mapping state
    const mapObj: ColumnMapping = {};
    result.detectedColumns.forEach(col => {
      if (col.detectedField !== 'ignore') {
        const key = col.detectedField as keyof ColumnMapping;
        (mapObj[key] as unknown) = col.index;
      }
    });
    setCustomMapping(mapObj);

    if (result.students.length > 0) {
      setUploadStep('preview');
    } else {
      alert("Yüklenen veride geçerli öğrenci veya işletme kaydı bulunamadı. Lütfen dosya sütunlarını veya formatını kontrol ediniz.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
        processRawArray(rows);
      } catch (err) {
        console.error("Excel parse error:", err);
        alert("Excel dosyası okunurken hata oluştu.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Raw Text / Paste Upload
  const handleProcessPaste = () => {
    if (!pasteContent.trim()) {
      alert("Lütfen yapıştırılacak Excel veya metin verisini giriniz.");
      return;
    }

    const lines = pasteContent.trim().split('\n');
    const rows = lines.map(line => {
      if (line.includes('\t')) return line.split('\t');
      if (line.includes(';')) return line.split(';');
      if (line.includes(',')) return line.split(',');
      return [line];
    });

    processRawArray(rows);
  };

  // Re-run parser with custom column mappings
  const handleApplyCustomMapping = () => {
    if (rawRows.length === 0) return;
    const result = parseMesemRows(rawRows, customMapping);
    setParsedPreview(result.students);
    setSelectedPreviewIds(result.students.map(s => s.id!));
    setUploadStep('preview');
  };

  // Bulk update preview students
  const handleApplyBulkGrade = () => {
    if (!bulkGrade) return;
    setParsedPreview(prev => prev.map(s => 
      selectedPreviewIds.includes(s.id!) ? { ...s, grade: bulkGrade } : s
    ));
  };

  const handleApplyBulkField = () => {
    if (!bulkField) return;
    setParsedPreview(prev => prev.map(s => 
      selectedPreviewIds.includes(s.id!) ? { ...s, mesemField: bulkField } : s
    ));
  };

  const handleApplyBulkCoordinator = () => {
    if (!bulkCoordinator) return;
    setParsedPreview(prev => prev.map(s => 
      selectedPreviewIds.includes(s.id!) ? { ...s, coordinatorTeacher: bulkCoordinator } : s
    ));
  };

  // Save parsed students to store
  const handleFinalizeUpload = () => {
    const toSave = parsedPreview.filter(s => selectedPreviewIds.includes(s.id!));
    if (toSave.length === 0) {
      alert("Lütfen kaydedilecek en az bir öğrenci seçiniz.");
      return;
    }

    toSave.forEach(s => {
      // Check if student with same number already exists
      const existing = students.find(ext => ext.number === s.number);
      if (existing) {
        updateStudent(existing.id, {
          ...s,
          isMesem: true
        });
      } else {
        addStudent({
          id: Math.random().toString(36).substring(2, 11),
          number: s.number || 'M000',
          name: s.name || 'Öğrenci',
          grade: s.grade || '9-MES',
          tcNo: s.tcNo,
          isMesem: true,
          mesemField: s.mesemField || 'Mesleki Eğitim',
          mesemBranch: s.mesemBranch,
          companyName: s.companyName || 'Belirtilmedi',
          masterTrainer: s.masterTrainer,
          masterTrainerPhone: s.masterTrainerPhone,
          coordinatorTeacher: s.coordinatorTeacher,
          contractStatus: s.contractStatus || 'Aktif',
          insuranceStatus: s.insuranceStatus || 'Giriş Yapıldı',
          parentPhone: s.parentPhone,
          address: s.address,
          boardingStatus: 'GÜNDÜZLÜ',
          scholarshipStatus: 'BURSSUZ'
        });
      }
    });

    alert(`${toSave.length} adet MESEM öğrencisi ve işletme bilgisi başarıyla sisteme aktarıldı!`);
    setShowUploadModal(false);
    setUploadStep('source');
    setRawRows([]);
    setParsedPreview([]);
    setPasteContent('');
  };

  // Manual Add Student Submit
  const handleManualAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStudent.number || !newStudent.name) {
      alert("Lütfen öğrenci numarası ve ad-soyad bilgilerini eksiksiz giriniz.");
      return;
    }

    addStudent({
      id: Math.random().toString(36).substring(2, 11),
      number: newStudent.number.trim(),
      name: newStudent.name.trim(),
      grade: newStudent.grade?.trim() || '9-MES',
      tcNo: newStudent.tcNo?.trim(),
      isMesem: true,
      mesemField: newStudent.mesemField?.trim() || 'Mesleki Eğitim',
      mesemBranch: newStudent.mesemBranch?.trim(),
      companyName: newStudent.companyName?.trim() || 'Belirtilmedi',
      masterTrainer: newStudent.masterTrainer?.trim(),
      masterTrainerPhone: newStudent.masterTrainerPhone?.trim(),
      coordinatorTeacher: newStudent.coordinatorTeacher?.trim(),
      contractStatus: newStudent.contractStatus || 'Aktif',
      insuranceStatus: newStudent.insuranceStatus || 'Giriş Yapıldı',
      parentPhone: newStudent.parentPhone?.trim(),
      address: newStudent.address?.trim(),
      boardingStatus: 'GÜNDÜZLÜ',
      scholarshipStatus: 'BURSSUZ'
    });

    alert("Yeni MESEM öğrencisi başarıyla eklendi.");
    setShowAddModal(false);
    setNewStudent({
      isMesem: true,
      number: '',
      name: '',
      grade: '9-MES',
      tcNo: '',
      mesemField: 'Elektrik-Elektronik Teknolojisi',
      mesemBranch: '',
      companyName: '',
      masterTrainer: '',
      masterTrainerPhone: '',
      coordinatorTeacher: '',
      contractStatus: 'Aktif',
      insuranceStatus: 'Giriş Yapıldı',
      parentPhone: '',
      address: '',
      boardingStatus: 'GÜNDÜZLÜ',
      scholarshipStatus: 'BURSSUZ'
    });
  };

  // Edit Student Submit
  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    updateStudent(editingStudent.id, {
      ...editingStudent,
      isMesem: true
    });

    alert("Öğrenci ve işletme bilgileri güncellendi.");
    setEditingStudent(null);
  };

  // Export MESEM to Excel
  const handleExportMesemExcel = () => {
    if (filteredStudents.length === 0) {
      alert("Dışa aktarılacak öğrenci kaydı bulunamadı.");
      return;
    }

    const data = filteredStudents.map(s => ({
      "Öğrenci No": s.number,
      "T.C. Kimlik No": s.tcNo || '',
      "Adı Soyadı": s.name,
      "Sınıf": s.grade,
      "Meslek Alanı": s.mesemField || '',
      "Meslek Dalı": s.mesemBranch || '',
      "İşletme / Firma Adı": s.companyName || '',
      "Usta Öğretici": s.masterTrainer || '',
      "Usta / İşletme Tel": s.masterTrainerPhone || '',
      "Koordinatör Öğretmen": s.coordinatorTeacher || '',
      "Sözleşme Durumu": s.contractStatus || 'Aktif',
      "Sigorta / SGK": s.insuranceStatus || 'Giriş Yapıldı',
      "Veli / Öğrenci Tel": s.parentPhone || '',
      "Davranış Puanı": getStudentBehaviorScore(s)
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MESEM Öğrencileri");
    XLSX.writeFile(wb, `MESEM_Ogrenci_ve_Isletme_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Print Official Workplace Notification Form
  const handlePrintWorkplaceNotice = (student: Student) => {
    setNotifStudent(student);
    setShowNotificationModal(true);
  };

  const handlePrintNotice = () => {
    if (!notifStudent) return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) return;

    const printHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>MESEM Isletme Bilgilendirme Yazisi - ${notifStudent.name}</title>
          <style>
            @page {
              size: A4 portrait;
              margin-top: 25mm !important;
              margin-bottom: 25mm !important;
              margin-left: 25mm !important;
              margin-right: 25mm !important;
            }
            html, body {
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              background: white !important;
              color: black !important;
              font-family: "Times New Roman", Times, serif;
              font-size: 11pt;
              line-height: 1.5;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .content {
              width: 100% !important;
              box-sizing: border-box !important;
            }
            table {
              width: 100% !important;
              border-collapse: collapse !important;
              margin: 15px 0 !important;
            }
            th, td {
              border: 1px solid black !important;
              padding: 6px 8px !important;
              font-size: 10pt !important;
            }
            tr {
              page-break-inside: avoid !important;
              break-inside: avoid !important;
            }
          </style>
        </head>
        <body>
          <div class="content">
            <div style="text-align:center; font-weight:bold; margin-bottom:15px; line-height:1.4;">
              T.C.<br>
              MİLLÎ EĞİTİM BAKANLIĞI<br>
              Mesleki ve Teknik Eğitim Genel Müdürlüğü<br>
              Öğrenci İşletme Bilgilendirme ve Koordinasyon Yazısı
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; font-size:10pt;">
              <div><strong>Sayı:</strong> E-92837492-MESEM-${new Date().getFullYear()}</div>
              <div><strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}</div>
            </div>
            <div style="text-align:center; font-weight:bold; margin-bottom:15px; font-size:11pt;">
              SAYIN: ${(notifStudent.companyName || 'İŞLETME YETKİLİSİ').toUpperCase()}<br>
              <span style="font-weight:normal; font-size:10pt;">(Usta Öğretici: ${notifStudent.masterTrainer || 'İlgili Personel'})</span>
            </div>
            <p style="text-align:justify; text-indent:25px; margin-bottom:15px;">
              3308 Sayılı Mesleki Eğitim Kanunu ve Millî Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği hükümleri doğrultusunda kurumunuzda işletmede mesleki eğitim / pratik staj eğitimi görmekte olan aşağıda açık kimliği yazılı öğrencimiz hakkında ilgili mevzuat kapsamında hazırlanan resmi bilgilendirme tutanağıdır:
            </p>
            <table>
              <tr>
                <td style="font-weight:bold; width:35%; background-color:#f5f5f5;">Öğrencinin Adı Soyadı:</td>
                <td style="font-weight:bold;">${notifStudent.name}</td>
              </tr>
              <tr>
                <td style="font-weight:bold; background-color:#f5f5f5;">T.C. Kimlik / Okul No:</td>
                <td>${notifStudent.tcNo || '-'} / ${notifStudent.number}</td>
              </tr>
              <tr>
                <td style="font-weight:bold; background-color:#f5f5f5;">Sınıfı / Meslek Alanı:</td>
                <td>${notifStudent.grade} - ${notifStudent.mesemField} (${notifStudent.mesemBranch || 'Genel'})</td>
              </tr>
              <tr>
                <td style="font-weight:bold; background-color:#f5f5f5;">Koordinatör Öğretmen:</td>
                <td>${notifStudent.coordinatorTeacher || 'Okul Koordinatörü'}</td>
              </tr>
              <tr>
                <td style="font-weight:bold; background-color:#f5f5f5;">Mevcut Davranış Puanı:</td>
                <td style="font-weight:bold;">${getStudentBehaviorScore(notifStudent)} / 100</td>
              </tr>
            </table>
            <p style="text-align:justify; text-indent:25px; margin-bottom:20px;">
              Öğrencinin işyerinde güvenliği, devam-devamsızlık durumu ve mesleki disiplin kurallarına uyumu hususunda koordinatör öğretmenimiz ile iletişim halinde olunması, herhangi bir olumsuzluk durumunda okul müdürlüğümüze ivedilikle bilgi verilmesi rica olunur.
            </p>
            <table style="width:100%; border:none; margin-top:35px; border-collapse:collapse;">
              <tr style="border:none;">
                <td style="width:50%; border:none; text-align:center; vertical-align:top;">
                  <b>Koordinatör Öğretmen</b><br><br><br>
                  ${notifStudent.coordinatorTeacher || '...........................'}
                </td>
                <td style="width:50%; border:none; text-align:center; vertical-align:top;">
                  <b>Okul Müdürü</b><br><br><br>
                  Mühür / İmza
                </td>
              </tr>
            </table>
          </div>
          <script>
            window.onload = function() {
              window.focus();
              setTimeout(function() {
                window.print();
                setTimeout(function() {
                  if (window.frameElement) {
                    window.parent.document.body.removeChild(window.frameElement);
                  }
                }, 200);
              }, 250);
            };
          </script>
        </body>
      </html>
    `;

    iframeDoc.open();
    iframeDoc.write(printHtml);
    iframeDoc.close();
  };

  const handleDownloadWordNotice = async () => {
    if (!notifStudent) return;
    const filename = `MESEM_Isletme_Yazisi_${notifStudent.number}_${notifStudent.name.replace(/\s+/g, '_')}`;
    const wordHtml = `
      <div>
        <div style="text-align:center; font-weight:bold; margin-bottom:15px; line-height:1.4;">
          T.C.<br>MİLLÎ EĞİTİM BAKANLIĞI<br>Mesleki ve Teknik Eğitim Genel Müdürlüğü<br>Öğrenci İşletme Bilgilendirme ve Koordinasyon Yazısı
        </div>
        <div style="margin-bottom:15px; font-size:10pt;">
          <strong>Sayı:</strong> E-92837492-MESEM-${new Date().getFullYear()} &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; <strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}
        </div>
        <div style="text-align:center; font-weight:bold; margin-bottom:15px; font-size:11pt;">
          SAYIN: ${(notifStudent.companyName || 'İŞLETME YETKİLİSİ').toUpperCase()}<br>
          <span style="font-weight:normal; font-size:10pt;">(Usta Öğretici: ${notifStudent.masterTrainer || 'İlgili Personel'})</span>
        </div>
        <p style="text-align:justify; margin-bottom:15px;">
          3308 Sayılı Mesleki Eğitim Kanunu ve Millî Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği hükümleri doğrultusunda kurumunuzda işletmede mesleki eğitim / pratik staj eğitimi görmekte olan aşağıda açık kimliği yazılı öğrencimiz hakkında ilgili mevzuat kapsamında hazırlanan bilgilendirme tutanağıdır:
        </p>
        <table style="width:100%; border-collapse:collapse; margin:15px 0;">
          <tr><td style="font-weight:bold; width:35%; border:1px solid black; padding:6px;">Öğrencinin Adı Soyadı:</td><td style="font-weight:bold; border:1px solid black; padding:6px;">${notifStudent.name}</td></tr>
          <tr><td style="font-weight:bold; border:1px solid black; padding:6px;">T.C. Kimlik / Okul No:</td><td style="border:1px solid black; padding:6px;">${notifStudent.tcNo || '-'} / ${notifStudent.number}</td></tr>
          <tr><td style="font-weight:bold; border:1px solid black; padding:6px;">Sınıfı / Meslek Alanı:</td><td style="border:1px solid black; padding:6px;">${notifStudent.grade} - ${notifStudent.mesemField} (${notifStudent.mesemBranch || 'Genel'})</td></tr>
          <tr><td style="font-weight:bold; border:1px solid black; padding:6px;">Koordinatör Öğretmen:</td><td style="border:1px solid black; padding:6px;">${notifStudent.coordinatorTeacher || 'Okul Koordinatörü'}</td></tr>
          <tr><td style="font-weight:bold; border:1px solid black; padding:6px;">Mevcut Davranış Puanı:</td><td style="font-weight:bold; border:1px solid black; padding:6px;">${getStudentBehaviorScore(notifStudent)} / 100</td></tr>
        </table>
        <p style="text-align:justify; margin-bottom:20px;">
          Öğrencinin işyerinde güvenliği, devam-devamsızlık durumu ve mesleki disiplin kurallarına uyumu hususunda koordinatör öğretmenimiz ile iletişim halinde olunması, herhangi bir olumsuzluk durumunda okul müdürlüğümüze ivedilikle bilgi verilmesi rica olunur.
        </p>
        <table style="width:100%; border:none; margin-top:35px; border-collapse:collapse;">
          <tr style="border:none;">
            <td style="width:50%; border:none; text-align:center;"><b>Koordinatör Öğretmen</b><br><br><br>${notifStudent.coordinatorTeacher || '...........................'}</td>
            <td style="width:50%; border:none; text-align:center;"><b>Okul Müdürü</b><br><br><br>Mühür / İmza</td>
          </tr>
        </table>
      </div>
    `;

    try {
      await exportHtmlToWord(wordHtml, filename, {
        fontSize: 11
      });
    } catch (docxErr) {
      console.error('Word export error:', docxErr);
      alert('Word belgesi oluşturulurken bir hata meydana geldi.');
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Mesleki ve Teknik Eğitim
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                3308 Sayılı Kanun Uyumlu
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Briefcase className="w-8 h-8 text-blue-400" />
              MESEM Yönetimi & İşletme İşlemleri
            </h1>
            <p className="text-slate-300 text-sm mt-1 max-w-2xl">
              Mesleki Eğitim Merkezi öğrencilerinin işletme, usta öğretici, koordinatör öğretmen ve disiplin süreçlerini yönetin. Esnek Excel yükleyici ile tek veya çoklu hücre verilerini kolayca aktarın.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowHelpGuide(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium backdrop-blur-sm transition-all"
              title="MESEM ve Excel Rehberi"
            >
              <HelpCircle className="w-4 h-4 text-blue-300" />
              <span>Format Rehberi</span>
            </button>
            <button
              onClick={generateSampleMesemExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium backdrop-blur-sm transition-all"
              title="Örnek MESEM Excel Şablonu İndir"
            >
              <Download className="w-4 h-4 text-emerald-300" />
              <span>Şablon İndir</span>
            </button>
            <button
              onClick={() => {
                setUploadStep('source');
                setShowUploadModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/25 transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>MESEM Excel Yükle</span>
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-emerald-600/25 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Tek Öğrenci Ekle</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 text-xs font-medium">Toplam MESEM Öğrencisi</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.totalStudents}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 text-xs font-medium">Kayıtlı İşletme / Firma</div>
            <div className="text-2xl font-bold text-blue-300 mt-1">{stats.uniqueCompanies}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 text-xs font-medium">Meslek Alanı / Dal</div>
            <div className="text-2xl font-bold text-purple-300 mt-1">{stats.uniqueFields}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5">
            <div className="text-slate-400 text-xs font-medium">Aktif Sözleşme</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.activeContracts}</div>
          </div>
          <div className="bg-white/5 backdrop-blur-sm rounded-xl p-3 border border-white/5 col-span-2 sm:col-span-1">
            <div className="text-slate-400 text-xs font-medium">Disiplin İncelemesinde</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{stats.disciplined}</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/80 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Öğrenci adı, okul no, TC, işletme adı, usta öğretici, alan veya koordinatör ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Export and View Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportMesemExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Listeyi Excel'e Aktar</span>
            </button>
            <div className="bg-slate-100 p-1 rounded-xl flex items-center">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'table' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tablo
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  viewMode === 'cards' ? 'bg-white shadow text-slate-800' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kartlar
              </button>
            </div>
          </div>
        </div>

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="block text-slate-500 mb-1 font-medium">Sınıf</label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Tüm Sınıflar ({classOptions.length})</option>
              {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1 font-medium">Meslek Alanı</label>
            <select
              value={selectedField}
              onChange={(e) => setSelectedField(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Tüm Alanlar ({fieldOptions.length})</option>
              {fieldOptions.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1 font-medium">İşletme / Firma</label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Tüm İşletmeler ({companyOptions.length})</option>
              {companyOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-slate-500 mb-1 font-medium">Sözleşme Durumu</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="Aktif">Aktif</option>
              <option value="Askıda">Askıda</option>
              <option value="Fesih">Fesih</option>
              <option value="Tamamlandı">Tamamlandı</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredStudents.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Briefcase className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">MESEM Öğrenci Kaydı Bulunamadı</h3>
          <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
            Henüz sisteme eklenmiş MESEM öğrencisi bulunmuyor veya arama kriterlerinize uyan kayıt yok. Excel dosyanızdan tüm hücre çeşitlerini destekleyen yükleme aracını kullanabilirsiniz.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={() => {
                setUploadStep('source');
                setShowUploadModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-all"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>MESEM Excel Yükle</span>
            </button>
            <button
              onClick={generateSampleMesemExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Örnek Şablon İndir</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Öğrenci No & TC</th>
                  <th className="px-4 py-3.5">Adı Soyadı & Sınıf</th>
                  <th className="px-4 py-3.5">Meslek Alanı / Dalı</th>
                  <th className="px-4 py-3.5">İşletme / Firma</th>
                  <th className="px-4 py-3.5">Usta Öğretici & İletişim</th>
                  <th className="px-4 py-3.5">Koordinatör</th>
                  <th className="px-4 py-3.5 text-center">Sözleşme</th>
                  <th className="px-4 py-3.5 text-center">Davranış</th>
                  <th className="px-4 py-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student) => {
                  const behaviorScore = getStudentBehaviorScore(student);
                  return (
                    <tr key={student.id} className="hover:bg-blue-50/40 transition-colors">
                      {/* No & TC */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900 text-sm">{student.number}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{student.tcNo || 'TC Belirtilmedi'}</div>
                      </td>

                      {/* Name & Grade */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          {student.name}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-medium border border-blue-200">
                            {student.grade || 'MESEM'}
                          </span>
                          {student.parentPhone && (
                            <span className="text-[11px] text-slate-400 flex items-center gap-0.5">
                              <Phone className="w-3 h-3" /> {student.parentPhone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Meslek Alanı / Dalı */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{student.mesemField || 'Genel Alan'}</div>
                        <div className="text-[11px] text-slate-500">{student.mesemBranch || '-'}</div>
                      </td>

                      {/* İşletme / Firma */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800 flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate max-w-[180px]">{student.companyName || 'İşletme Belirtilmedi'}</span>
                        </div>
                        {student.companyAddress && (
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px] flex items-center gap-0.5">
                            <MapPin className="w-3 h-3 shrink-0" /> {student.companyAddress}
                          </div>
                        )}
                      </td>

                      {/* Usta Öğretici */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-800 font-medium">{student.masterTrainer || '-'}</div>
                        {student.masterTrainerPhone && (
                          <div className="text-[11px] text-slate-500 font-mono">{student.masterTrainerPhone}</div>
                        )}
                      </td>

                      {/* Koordinatör */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-700">{student.coordinatorTeacher || '-'}</div>
                      </td>

                      {/* Sözleşme Durumu */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-semibold ${
                          student.contractStatus === 'Aktif' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {student.contractStatus || 'Aktif'}
                        </span>
                      </td>

                      {/* Davranış Puanı */}
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded font-bold text-xs ${
                          behaviorScore === 100 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : behaviorScore >= 80 
                            ? 'bg-amber-50 text-amber-700' 
                            : 'bg-red-50 text-red-700'
                        }`}>
                          {behaviorScore}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setSelectedStudent(student)}
                            title="Öğrenci ve İşletme Detayları"
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePrintWorkplaceNotice(student)}
                            title="İşletme Bilgilendirme / Tebligat Yazısı Yazdır"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setEditingStudent(student)}
                            title="Düzenle"
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`${student.name} adlı MESEM öğrencisini silmek istediğinize emin misiniz?`)) {
                                removeStudent(student.id);
                              }
                            }}
                            title="Sil"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => {
            const score = getStudentBehaviorScore(student);
            return (
              <div key={student.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-bold text-xs">
                        No: {student.number}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold">
                        {student.grade || 'MESEM'}
                      </span>
                    </div>
                    <h4 className="text-base font-bold text-slate-900 mt-1">{student.name}</h4>
                    <p className="text-xs text-slate-400 font-mono">{student.tcNo || 'TC: -'}</p>
                  </div>

                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    score === 100 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    Puan: {score}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs text-slate-600 border border-slate-100">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800">
                    <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{student.mesemField || 'Alan Belirtilmedi'}</span>
                  </div>
                  {student.mesemBranch && (
                    <div className="text-[11px] text-slate-500 pl-5">Dal: {student.mesemBranch}</div>
                  )}
                  <div className="flex items-center gap-1.5 pt-1 text-slate-800">
                    <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="font-semibold">{student.companyName || 'İşletme Belirtilmedi'}</span>
                  </div>
                  {student.masterTrainer && (
                    <div className="text-[11px] text-slate-500 pl-5">
                      Usta: {student.masterTrainer} {student.masterTrainerPhone ? `(${student.masterTrainerPhone})` : ''}
                    </div>
                  )}
                  {student.coordinatorTeacher && (
                    <div className="text-[11px] text-slate-500 pl-5">
                      Koordinatör: {student.coordinatorTeacher}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    student.contractStatus === 'Aktif' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {student.contractStatus || 'Aktif'}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSelectedStudent(student)}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg text-xs flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> İncele
                    </button>
                    <button
                      onClick={() => handlePrintWorkplaceNotice(student)}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs"
                      title="İşletme Bildirimi"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingStudent(student)}
                      className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg text-xs"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MESEM ÖZEL VERİ VE EXCEL YÜKLEME SİHİRBAZI MODAL (The User's Core Request) */}
      {/* ========================================================================= */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-blue-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-400/30">
                  <FileSpreadsheet className="w-6 h-6 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">MESEM Esnek Veri Yükleme Sihirbazı</h3>
                  <p className="text-xs text-slate-300">
                    Tek hücrede birleşik veya ayrı hücrelerde dağıtık her türlü Excel / metin verisini kolayca aktarın.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Header */}
            <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-600 shrink-0">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setUploadStep('source')}
                  className={`flex items-center gap-1.5 pb-0.5 ${
                    uploadStep === 'source' ? 'text-blue-600 border-b-2 border-blue-600 font-bold' : ''
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
                  <span>Veri Kaynağı & Yükleme</span>
                </button>
                <ChevronRight className="w-4 h-4 text-slate-400" />
                <button
                  disabled={rawRows.length === 0}
                  onClick={() => setUploadStep('mapping')}
                  className={`flex items-center gap-1.5 pb-0.5 disabled:opacity-40 ${
                    uploadStep === 'mapping' ? 'text-blue-600 border-b-2 border-blue-600 font-bold' : ''
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">2</span>
                  <span>Sütun & Hücre Eşleme</span>
                </button>
                <ChevronRight className="w-4 h-4 text-slate-400" />
                <button
                  disabled={parsedPreview.length === 0}
                  onClick={() => setUploadStep('preview')}
                  className={`flex items-center gap-1.5 pb-0.5 disabled:opacity-40 ${
                    uploadStep === 'preview' ? 'text-blue-600 border-b-2 border-blue-600 font-bold' : ''
                  }`}
                >
                  <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">3</span>
                  <span>Önizleme & Onay</span>
                </button>
              </div>

              <button
                onClick={generateSampleMesemExcel}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 underline"
              >
                <Download className="w-3.5 h-3.5" /> Örnek Excel Şablonu
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* STEP 1: SOURCE SELECTION */}
              {uploadStep === 'source' && (
                <div className="space-y-6">
                  {/* Format Mode Picker */}
                  <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100 space-y-2">
                    <label className="block text-xs font-bold text-blue-900 uppercase tracking-wider">
                      Hücre Verisi Çeşitlendirme Modu:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setUploadFormatMode('auto')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          uploadFormatMode === 'auto'
                            ? 'bg-white border-blue-600 shadow-md ring-2 ring-blue-500/20 text-blue-950'
                            : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>Akıllı Otomatik Algılama</span>
                          {uploadFormatMode === 'auto' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Adı Soyadı tek hücrede veya ayrı sütunlarda olsa dahi başlıkları otomatik analiz eder.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUploadFormatMode('compound')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          uploadFormatMode === 'compound'
                            ? 'bg-white border-blue-600 shadow-md ring-2 ring-blue-500/20 text-blue-950'
                            : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>Tek Hücrede Çoklu Veri</span>
                          {uploadFormatMode === 'compound' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Örn: <code>"1452 - Ali Yılmaz - 10-MES - Yıldız Otomotiv"</code> tek bir hücrededir.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUploadFormatMode('custom')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          uploadFormatMode === 'custom'
                            ? 'bg-white border-blue-600 shadow-md ring-2 ring-blue-500/20 text-blue-950'
                            : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white'
                        }`}
                      >
                        <div className="font-bold text-xs flex items-center justify-between">
                          <span>Özel Sütun Eşleme</span>
                          {uploadFormatMode === 'custom' && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                          Her sütunun hangi MESEM verisine denk geleceğini manuel eşleştirin.
                        </p>
                      </button>
                    </div>
                  </div>

                  {/* Tabs: File Upload vs Direct Paste */}
                  <div className="border-b border-slate-200 flex items-center gap-4">
                    <button
                      onClick={() => setUploadTab('file')}
                      className={`pb-2.5 font-bold text-sm flex items-center gap-2 transition-all ${
                        uploadTab === 'file'
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Excel Dosyası Yükle (.xlsx, .xls, .csv)</span>
                    </button>
                    <button
                      onClick={() => setUploadTab('paste')}
                      className={`pb-2.5 font-bold text-sm flex items-center gap-2 transition-all ${
                        uploadTab === 'paste'
                          ? 'text-blue-600 border-b-2 border-blue-600'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <ClipboardPaste className="w-4 h-4" />
                      <span>Excel'den Doğrudan Kopyala / Yapıştır</span>
                    </button>
                  </div>

                  {uploadTab === 'file' ? (
                    /* DRAG & DROP ZONE */
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            try {
                              const data = new Uint8Array(evt.target?.result as ArrayBuffer);
                              const workbook = XLSX.read(data, { type: 'array' });
                              const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                              const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' });
                              processRawArray(rows);
                            } catch {
                              alert("Dosya okunurken bir hata oluştu.");
                            }
                          };
                          reader.readAsArrayBuffer(file);
                        }
                      }}
                      className={`border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${
                        isDragging 
                          ? 'border-blue-500 bg-blue-50/50 scale-[0.99]' 
                          : 'border-slate-300 hover:border-blue-400 bg-slate-50/60'
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        accept=".xlsx, .xls, .csv"
                        className="hidden"
                      />
                      <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                        <FileSpreadsheet className="w-8 h-8" />
                      </div>
                      <h4 className="text-base font-bold text-slate-800 mb-1">
                        Excel Dosyasını Buraya Sürükleyin veya Seçin
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                        .xlsx, .xls veya .csv formatındaki MESEM öğrenci listesini doğrudan yükleyebilirsiniz.
                      </p>
                      <button
                        type="button"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow transition-all"
                      >
                        Bilgisayardan Dosya Seç
                      </button>
                    </div>
                  ) : (
                    /* DIRECT PASTE TEXTAREA */
                    <div className="space-y-3">
                      <p className="text-xs text-slate-600">
                        Excel tablonuzdaki satır ve sütunları kopyalayıp (Ctrl+C) aşağıdaki alana yapıştırabilirsiniz (Ctrl+V):
                      </p>
                      <textarea
                        rows={8}
                        value={pasteContent}
                        onChange={(e) => setPasteContent(e.target.value)}
                        placeholder={`Örnek 1 (Tablo Kopyalama):\n1001\t12345678901\tAhmet Yılmaz\t10-MES\tElektrik\tYıldız Elektrik Ltd.\tMustafa Usta\n\nÖrnek 2 (Tek Hücrede Birleşik):\n1002 - Mehmet Demir - 10-MES - Motor - Özdemir Servis`}
                        className="w-full p-3 font-mono text-xs bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <button
                        onClick={handleProcessPaste}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow transition-all flex items-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Metin Verisini Ayrıştır ve Önizle</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: COLUMN MAPPING WIZARD */}
              {uploadStep === 'mapping' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">Sütun Eşleştirme Sihirbazı</h4>
                      <p className="text-xs text-slate-500">
                        Yüklediğiniz dosyadaki sütunların hangi öğrenci veya işletme verisine karşılık geldiğini onaylayın veya değiştirin.
                      </p>
                    </div>
                    <button
                      onClick={handleApplyCustomMapping}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow transition-all"
                    >
                      Eşlemeyi Uygula ve Önizle
                    </button>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-h-96 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {detectedColumns.map((col) => (
                        <div key={col.index} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between font-semibold text-slate-800">
                              <span className="truncate">{col.sampleHeader}</span>
                              <span className="text-[10px] text-slate-400 font-mono">Sütun #{col.index + 1}</span>
                            </div>
                            {col.sampleValue && (
                              <div className="text-[11px] text-slate-500 italic mt-0.5 truncate">
                                Örnek Veri: "{col.sampleValue}"
                              </div>
                            )}
                          </div>

                          <div className="mt-2 pt-2 border-t border-slate-100">
                            <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                              Bu Sütunu Eşle:
                            </label>
                            <select
                              value={Object.entries(customMapping).find(([, idx]) => idx === col.index)?.[0] || 'ignore'}
                              onChange={(e) => {
                                const field = e.target.value;
                                setCustomMapping(prev => {
                                  const updated = { ...prev };
                                  // Remove any existing mapping pointing to this column
                                  Object.keys(updated).forEach(k => {
                                    const key = k as keyof ColumnMapping;
                                    if (updated[key] === col.index) {
                                      delete updated[key];
                                    }
                                  });
                                  if (field !== 'ignore') {
                                    const targetKey = field as keyof ColumnMapping;
                                    (updated[targetKey] as unknown) = col.index;
                                  }
                                  return updated;
                                });
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                            >
                              <option value="ignore">(Bu Sütunu Yoksay)</option>
                              <option value="number">Öğrenci No / Okul No</option>
                              <option value="tcNo">T.C. Kimlik No</option>
                              <option value="name">Adı Soyadı (Tek Hücrede)</option>
                              <option value="firstName">Öğrenci Adı (Ayrı)</option>
                              <option value="lastName">Öğrenci Soyadı (Ayrı)</option>
                              <option value="grade">Sınıf / Şube</option>
                              <option value="mesemField">Meslek Alanı</option>
                              <option value="mesemBranch">Meslek Dalı</option>
                              <option value="companyName">İşletme / Firma Adı</option>
                              <option value="masterTrainer">Usta Öğretici Adı Soyadı</option>
                              <option value="masterTrainerPhone">Usta / İşletme Telefonu</option>
                              <option value="coordinatorTeacher">Koordinatör Öğretmen</option>
                              <option value="contractStatus">Sözleşme Durumu</option>
                              <option value="parentPhone">Veli / Öğrenci Telefonu</option>
                              <option value="compoundCell">Tek Hücrede Birleşik Bilgi</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: PREVIEW & CONFIRMATION */}
              {uploadStep === 'preview' && (
                <div className="space-y-4">
                  {/* Bulk Edit & Summary Bar */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800 text-sm">
                        {parsedPreview.length} Öğrenci Algılandı
                      </span>
                      <span className="text-slate-400">|</span>
                      <span className="text-blue-600 font-semibold">
                        {selectedPreviewIds.length} Seçili
                      </span>
                    </div>

                    {/* Bulk Assignment Tools */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Toplu Sınıf (örn 10-MES)"
                          value={bulkGrade}
                          onChange={(e) => setBulkGrade(e.target.value)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg w-28 text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleApplyBulkGrade}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium"
                        >
                          Ata
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Toplu Alan"
                          value={bulkField}
                          onChange={(e) => setBulkField(e.target.value)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg w-28 text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleApplyBulkField}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium"
                        >
                          Ata
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          placeholder="Toplu Koordinatör"
                          value={bulkCoordinator}
                          onChange={(e) => setBulkCoordinator(e.target.value)}
                          className="px-2 py-1 bg-white border border-slate-200 rounded-lg w-28 text-xs"
                        />
                        <button
                          type="button"
                          onClick={handleApplyBulkCoordinator}
                          className="px-2 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-slate-700 font-medium"
                        >
                          Ata
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0">
                        <tr>
                          <th className="p-3 w-8">
                            <input
                              type="checkbox"
                              checked={selectedPreviewIds.length === parsedPreview.length && parsedPreview.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPreviewIds(parsedPreview.map(s => s.id!));
                                } else {
                                  setSelectedPreviewIds([]);
                                }
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                          </th>
                          <th className="p-3">No</th>
                          <th className="p-3">Adı Soyadı</th>
                          <th className="p-3">TC Kimlik</th>
                          <th className="p-3">Sınıf</th>
                          <th className="p-3">Meslek Alanı</th>
                          <th className="p-3">İşletme / Firma</th>
                          <th className="p-3">Usta Öğretici</th>
                          <th className="p-3">Koordinatör</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedPreview.map((s, idx) => {
                          const isSelected = selectedPreviewIds.includes(s.id!);
                          return (
                            <tr key={s.id || idx} className={`hover:bg-slate-50 ${!isSelected ? 'opacity-50' : ''}`}>
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedPreviewIds(prev => [...prev, s.id!]);
                                    } else {
                                      setSelectedPreviewIds(prev => prev.filter(id => id !== s.id));
                                    }
                                  }}
                                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                              </td>
                              <td className="p-3 font-bold text-slate-900">{s.number}</td>
                              <td className="p-3 font-semibold text-slate-800">{s.name}</td>
                              <td className="p-3 font-mono text-slate-500">{s.tcNo || '-'}</td>
                              <td className="p-3">
                                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                                  {s.grade || '9-MES'}
                                </span>
                              </td>
                              <td className="p-3 text-slate-700">{s.mesemField || '-'}</td>
                              <td className="p-3 font-medium text-slate-900">{s.companyName || '-'}</td>
                              <td className="p-3 text-slate-600">{s.masterTrainer || '-'}</td>
                              <td className="p-3 text-slate-600">{s.coordinatorTeacher || '-'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <div className="text-xs text-slate-500">
                {uploadStep === 'preview' && (
                  <span>
                    <strong>{selectedPreviewIds.length}</strong> öğrenci MESEM kayıtlarına aktarılmaya hazır.
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-100 transition-colors"
                >
                  İptal
                </button>

                {uploadStep === 'preview' ? (
                  <button
                    type="button"
                    onClick={handleFinalizeUpload}
                    disabled={selectedPreviewIds.length === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Seçilenleri MESEM'e Kaydet</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (uploadStep === 'source') setUploadStep('mapping');
                      else if (uploadStep === 'mapping') handleApplyCustomMapping();
                    }}
                    disabled={rawRows.length === 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                  >
                    <span>İleri</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TEK ÖĞRENCİ EKLEME MODAL */}
      {/* ========================================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Plus className="w-5 h-5 text-emerald-300" />
                <h3 className="font-bold text-base">Yeni MESEM Öğrencisi ve İşletme Kaydı</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualAddSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {/* Student Base Info */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" /> Öğrenci Kimlik Bilgileri
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Okul No *</label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: 1042"
                      value={newStudent.number}
                      onChange={(e) => setNewStudent({ ...newStudent, number: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Adı Soyadı *</label>
                    <input
                      type="text"
                      required
                      placeholder="Örn: Ahmet Yılmaz"
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">T.C. Kimlik No</label>
                    <input
                      type="text"
                      maxLength={11}
                      placeholder="11 Haneli TCKN"
                      value={newStudent.tcNo}
                      onChange={(e) => setNewStudent({ ...newStudent, tcNo: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Sınıf / Şube</label>
                    <input
                      type="text"
                      placeholder="Örn: 10-MES-A"
                      value={newStudent.grade}
                      onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Öğrenci / Veli Telefonu</label>
                    <input
                      type="text"
                      placeholder="05..."
                      value={newStudent.parentPhone}
                      onChange={(e) => setNewStudent({ ...newStudent, parentPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Mesem Enterprise & Vocational Info */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" /> İşletme ve Mesleki Eğitim Bilgileri
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Meslek Alanı</label>
                    <input
                      type="text"
                      placeholder="Örn: Elektrik-Elektronik Teknolojisi"
                      value={newStudent.mesemField}
                      onChange={(e) => setNewStudent({ ...newStudent, mesemField: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Meslek Dalı</label>
                    <input
                      type="text"
                      placeholder="Örn: Elektrik Tesisatları ve Dağıtımı"
                      value={newStudent.mesemBranch}
                      onChange={(e) => setNewStudent({ ...newStudent, mesemBranch: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">İşletme / Firma Adı *</label>
                    <input
                      type="text"
                      placeholder="Örn: Yıldız Pano & Elektrik Sanayi Ltd."
                      value={newStudent.companyName}
                      onChange={(e) => setNewStudent({ ...newStudent, companyName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Usta Öğretici Adı Soyadı</label>
                    <input
                      type="text"
                      placeholder="Örn: Mustafa Yıldız (Usta)"
                      value={newStudent.masterTrainer}
                      onChange={(e) => setNewStudent({ ...newStudent, masterTrainer: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Usta / İşletme Telefonu</label>
                    <input
                      type="text"
                      placeholder="Örn: 0212 555 12 34"
                      value={newStudent.masterTrainerPhone}
                      onChange={(e) => setNewStudent({ ...newStudent, masterTrainerPhone: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Koordinatör Öğretmen</label>
                    <input
                      type="text"
                      placeholder="Örn: Kemal Demir"
                      value={newStudent.coordinatorTeacher}
                      onChange={(e) => setNewStudent({ ...newStudent, coordinatorTeacher: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Sözleşme Durumu</label>
                    <select
                      value={newStudent.contractStatus}
                      onChange={(e) => setNewStudent({ ...newStudent, contractStatus: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    >
                      <option value="Aktif">Aktif</option>
                      <option value="Askıda">Askıda</option>
                      <option value="Fesih">Fesih</option>
                      <option value="Tamamlandı">Tamamlandı</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 font-medium mb-1">SGK / Sigorta Durumu</label>
                    <input
                      type="text"
                      placeholder="Giriş Yapıldı"
                      value={newStudent.insuranceStatus}
                      onChange={(e) => setNewStudent({ ...newStudent, insuranceStatus: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>MESEM Öğrencisini Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DÜZENLEME MODAL */}
      {/* ========================================================================= */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-600 to-orange-700 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-base">MESEM Öğrenci ve İşletme Bilgilerini Düzenle</h3>
              </div>
              <button onClick={() => setEditingStudent(null)} className="text-slate-300 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Okul No</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.number}
                    onChange={(e) => setEditingStudent({ ...editingStudent, number: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Adı Soyadı</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.name}
                    onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">T.C. Kimlik No</label>
                  <input
                    type="text"
                    value={editingStudent.tcNo || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, tcNo: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Sınıf</label>
                  <input
                    type="text"
                    value={editingStudent.grade || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, grade: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Meslek Alanı</label>
                  <input
                    type="text"
                    value={editingStudent.mesemField || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, mesemField: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Meslek Dalı</label>
                  <input
                    type="text"
                    value={editingStudent.mesemBranch || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, mesemBranch: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">İşletme / Firma Adı</label>
                  <input
                    type="text"
                    value={editingStudent.companyName || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, companyName: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Usta Öğretici</label>
                  <input
                    type="text"
                    value={editingStudent.masterTrainer || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, masterTrainer: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Usta / İşletme Tel</label>
                  <input
                    type="text"
                    value={editingStudent.masterTrainerPhone || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, masterTrainerPhone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Koordinatör Öğretmen</label>
                  <input
                    type="text"
                    value={editingStudent.coordinatorTeacher || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, coordinatorTeacher: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">Sözleşme Durumu</label>
                  <select
                    value={editingStudent.contractStatus || 'Aktif'}
                    onChange={(e) => setEditingStudent({ ...editingStudent, contractStatus: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  >
                    <option value="Aktif">Aktif</option>
                    <option value="Askıda">Askıda</option>
                    <option value="Fesih">Fesih</option>
                    <option value="Tamamlandı">Tamamlandı</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-600 font-medium mb-1">SGK / Sigorta Durumu</label>
                  <input
                    type="text"
                    value={editingStudent.insuranceStatus || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, insuranceStatus: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-md transition-all flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Değişiklikleri Kaydet</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ÖĞRENCİ DETAY & DOSYA MODAL */}
      {/* ========================================================================= */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-blue-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-lg text-blue-300">
                  {selectedStudent.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-lg">{selectedStudent.name}</h3>
                  <p className="text-xs text-slate-300">
                    Okul No: {selectedStudent.number} | Sınıf: {selectedStudent.grade} | MESEM Öğrenci Dosyası
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedStudent(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
              {/* Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* School & Identity Card */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-xs text-blue-700">
                    <UserCheck className="w-4 h-4" /> Kimlik & Okul Bilgileri
                  </h4>
                  <div className="space-y-1 text-slate-700">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">T.C. Kimlik No:</span>
                      <span className="font-mono font-bold">{selectedStudent.tcNo || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Okul No:</span>
                      <span className="font-bold">{selectedStudent.number}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Sınıf:</span>
                      <span className="font-medium">{selectedStudent.grade}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">İletişim / Tel:</span>
                      <span className="font-mono">{selectedStudent.parentPhone || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Davranış Puanı:</span>
                      <span className="font-bold text-emerald-600">{getStudentBehaviorScore(selectedStudent)} / 100</span>
                    </div>
                  </div>
                </div>

                {/* Enterprise & Workplace Card */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 text-xs text-indigo-700">
                    <Building2 className="w-4 h-4" /> İşletme & Pratik Eğitim Bilgileri
                  </h4>
                  <div className="space-y-1 text-slate-700">
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">İşletme / Firma:</span>
                      <span className="font-bold text-slate-900">{selectedStudent.companyName || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Meslek Alanı:</span>
                      <span className="font-medium">{selectedStudent.mesemField || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Meslek Dalı:</span>
                      <span className="font-medium">{selectedStudent.mesemBranch || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">Usta Öğretici:</span>
                      <span className="font-medium">{selectedStudent.masterTrainer || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-200/60">
                      <span className="text-slate-500">İşletme Telefonu:</span>
                      <span className="font-mono">{selectedStudent.masterTrainerPhone || '-'}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Koordinatör Öğretmen:</span>
                      <span className="font-medium">{selectedStudent.coordinatorTeacher || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and Action Buttons */}
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-blue-950 text-sm">3308 Sayılı Kanun İşletme Bildirim İşlemleri</div>
                  <p className="text-slate-500 text-xs">
                    Disiplin veya devam-devamsızlık durumlarında işletmeye resmi tebligat ve bilgilendirme yazısı hazırlayın.
                  </p>
                </div>
                <button
                  onClick={() => handlePrintWorkplaceNotice(selectedStudent)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-1.5 shadow transition-all shrink-0"
                >
                  <Printer className="w-4 h-4" />
                  <span>İşletme Bilgilendirme Yazısı</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* İŞLETME BİLGİLENDİRME YAZISI YAZDIRMA MODAL */}
      {/* ========================================================================= */}
      {showNotificationModal && notifStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base">MESEM İşletme Bilgilendirme Yazısı Önizleme</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadWordNotice}
                  className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-blue-200 border border-blue-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
                  title="Word (.doc) formatında Office kenar boşluklarıyla indir"
                >
                  <FileText className="w-4 h-4" /> Word (.docx) İndir
                </button>
                <button
                  onClick={handlePrintNotice}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow transition-all"
                  title="Standart A4 Office kenar boşlukları (2.5cm) ile yazdır"
                >
                  <Printer className="w-4 h-4" /> Yazdır (Office Kuralı)
                </button>
                <button onClick={() => setShowNotificationModal(false)} className="text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-8 overflow-y-auto flex-1 bg-white text-slate-900 font-serif leading-relaxed text-sm space-y-6">
              <div className="text-center space-y-1">
                <p className="font-bold text-base">T.C.</p>
                <p className="font-bold text-base">MİLLÎ EĞİTİM BAKANLIĞI</p>
                <p className="text-xs uppercase font-sans text-slate-600">Mesleki ve Teknik Eğitim Genel Müdürlüğü</p>
                <p className="text-xs font-sans text-slate-600">Öğrenci İşletme Bilgilendirme ve Koordinasyon Yazısı</p>
              </div>

              <div className="flex justify-between items-center text-xs font-sans pt-4 border-t border-slate-300">
                <div><strong>Sayı:</strong> E-92837492-MESEM-{new Date().getFullYear()}</div>
                <div><strong>Tarih:</strong> {new Date().toLocaleDateString('tr-TR')}</div>
              </div>

              <div className="pt-2">
                <p className="font-bold text-center text-base uppercase">
                  SAYIN: {notifStudent.companyName || 'İŞLETME YETKİLİSİ'}<br />
                  <span className="text-xs font-normal">(Usta Öğretici: {notifStudent.masterTrainer || 'İlgili Personel'})</span>
                </p>
              </div>

              <p className="text-justify indent-8 text-xs leading-6 font-sans">
                3308 Sayılı Mesleki Eğitim Kanunu ve Millî Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliği hükümleri doğrultusunda kurumunuzda işletmede mesleki eğitim / pratik staj eğitimi görmekte olan aşağıda açık kimliği yazılı öğrencimiz hakkında ilgili mevzuat kapsamında hazırlanan bilgilendirme tutanağıdır:
              </p>

              {/* Table */}
              <table className="w-full border-collapse border border-slate-400 text-xs font-sans">
                <tbody>
                  <tr>
                    <td className="border border-slate-400 p-2 font-bold bg-slate-50 w-1/3">Öğrencinin Adı Soyadı:</td>
                    <td className="border border-slate-400 p-2 font-bold">{notifStudent.name}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 p-2 font-bold bg-slate-50">T.C. Kimlik / Okul No:</td>
                    <td className="border border-slate-400 p-2">{notifStudent.tcNo || '-'} / {notifStudent.number}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 p-2 font-bold bg-slate-50">Sınıfı / Meslek Alanı:</td>
                    <td className="border border-slate-400 p-2">{notifStudent.grade} - {notifStudent.mesemField} ({notifStudent.mesemBranch || 'Genel'})</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 p-2 font-bold bg-slate-50">Koordinatör Öğretmen:</td>
                    <td className="border border-slate-400 p-2">{notifStudent.coordinatorTeacher || 'Okul Koordinatörü'}</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-400 p-2 font-bold bg-slate-50">Mevcut Davranış Puanı:</td>
                    <td className="border border-slate-400 p-2 font-bold text-slate-800">{getStudentBehaviorScore(notifStudent)} / 100</td>
                  </tr>
                </tbody>
              </table>

              <p className="text-justify indent-8 text-xs leading-6 font-sans">
                Öğrencinin işyerinde güvenliği, devam-devamsızlık durumu ve mesleki disiplin kurallarına uyumu hususunda koordinatör öğretmenimiz ile iletişim halinde olunması, herhangi bir olumsuzluk durumunda okul müdürlüğümüze ivedilikle bilgi verilmesi rica olunur.
              </p>

              <div className="pt-10 flex justify-between items-center text-xs font-sans text-center">
                <div>
                  <p className="font-bold">Koordinatör Öğretmen</p>
                  <p className="mt-8 font-semibold">{notifStudent.coordinatorTeacher || 'İmza'}</p>
                </div>
                <div>
                  <p className="font-bold">Okul Müdürü</p>
                  <p className="mt-8 font-semibold">Mühür / İmza</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MESEM & FORMAT REHBERİ MODAL */}
      {/* ========================================================================= */}
      {showHelpGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-blue-600" />
                MESEM Excel ve Hücre Çeşitlendirme Rehberi
              </h3>
              <button onClick={() => setShowHelpGuide(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600 leading-relaxed max-h-96 overflow-y-auto">
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                <h4 className="font-bold text-blue-900 mb-1">1. Tek Hücrede Birleşik Ad Soyad</h4>
                <p>
                  Excel dosyanızda öğrencinin adı ve soyadı tek bir hücrede (örn. <code>"Ahmet Yılmaz"</code>) bulunuyorsa, sistem otomatik olarak son kelimeyi soyadı kabul ederek doğru şekilde işler.
                </p>
              </div>

              <div className="bg-purple-50 p-3 rounded-xl border border-purple-100">
                <h4 className="font-bold text-purple-900 mb-1">2. Ayrı Hücrelerde Ad ve Soyad</h4>
                <p>
                  Sütun 1'de <code>"Ahmet"</code>, Sütun 2'de <code>"Yılmaz"</code> varsa, sistem sütun başlıklarını veya içerikleri tanıyıp tek bir tam ad halinde birleştirir.
                </p>
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                <h4 className="font-bold text-emerald-900 mb-1">3. Tek Hücrede Birleşik Çoklu Veri</h4>
                <p>
                  Birçok koordinatör öğretmenin tuttuğu listelerde öğrenci no, ad, sınıf ve işletme tek bir hücrede yazılmış olabilir (Örn: <code>"1042 - Ali Vural - 10/MES - ABC Otomotiv"</code>). Bu veriler ayraçlara göre otomatik olarak parçalanıp ilgili alanlara aktarılır.
                </p>
              </div>

              <div className="bg-amber-50 p-3 rounded-xl border border-amber-100">
                <h4 className="font-bold text-amber-900 mb-1">4. Manuel Eşleştirme (Sütun Sihirbazı)</h4>
                <p>
                  Dosyanızda başlıklar farklıysa veya standart dışıysa, 2. adımdaki sütun eşleme sihirbazından her sütunu dilediğiniz MESEM veri alanına elle eşleyebilirsiniz.
                </p>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setShowHelpGuide(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs"
              >
                Anladım
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MesemManagement;
