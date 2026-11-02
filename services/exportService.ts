import * as XLSX from 'xlsx';
import { Incident, Student, Institution, BoardMember } from '../types';
import {
  DocumentDefinition,
  calculateStudentScore,
  createIncidentReportDoc,
  createDisciplineRegisterDoc,
  createStudentListDoc,
  createSingleStudentDoc,
  createMesemReportDoc,
  createDecisionDoc,
  createDefenseRequestDoc,
  createStatementDoc,
  createParentNoticeDoc,
  createPenaltyRemovalDoc,
  createMeetingSummonsDoc,
  createStatisticsDoc
} from './documentEngine';
import { generateDocxBlob, generateDocxBuffer } from './docxGenerator';

// Backward compatibility helper (kept for legacy calls, but NOT used in our document generators)
export const turkishToAscii = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C');
};

export { calculateStudentScore };

// Helper to trigger save/download of a DOCX file
export const downloadDocx = async (docDef: DocumentDefinition, filenamePrefix?: string) => {
  const cleanTitle = (filenamePrefix || docDef.title).replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]/g, '_');
  const filename = `${cleanTitle}.docx`;

  if (window.electronAPI) {
    const buffer = await generateDocxBuffer(docDef);
    await window.electronAPI.saveFile({
      defaultPath: filename,
      filters: [{ name: 'Microsoft Word Belgesi (*.docx)', extensions: ['docx'] }],
      data: buffer
    });
  } else {
    const blob = await generateDocxBlob(docDef);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};

// Helper to trigger PDF save via Electron Chromium printToPDF or fallback
export const downloadPdf = async (docDef: DocumentDefinition, filenamePrefix?: string) => {
  const cleanTitle = (filenamePrefix || docDef.title).replace(/[^a-zA-Z0-9ığüşöçİĞÜŞÖÇ]/g, '_');
  const filename = `${cleanTitle}.pdf`;

  if (window.electronAPI) {
    await window.electronAPI.printToPdf({
      landscape: docDef.orientation === 'landscape',
      pageSize: 'A4',
      saveDialog: true,
      defaultPath: filename,
      title: 'PDF Olarak Kaydet'
    });
  } else {
    // Web fallback
    triggerSafePrint();
  }
};

// ---------------------------------------------------------------------------
// 1. DİSİPLİN OLAYLARI VE KARARLARI (INCIDENTS)
// ---------------------------------------------------------------------------

export const exportIncidentToDocx = async (incident: Incident, students: Student[], institution?: Institution, boardMembers?: BoardMember[]) => {
  const docDef = createIncidentReportDoc(incident, students, institution, boardMembers);
  await downloadDocx(docDef, `Olay_Raporu_${incident.code}`);
};

export const exportIncidentToPDF = async (incident: Incident, students: Student[], institution?: Institution, boardMembers?: BoardMember[]) => {
  const docDef = createIncidentReportDoc(incident, students, institution, boardMembers);
  await downloadPdf(docDef, `Olay_Raporu_${incident.code}`);
};

export const exportIncidentsToExcel = (incidents: Incident[], students: Student[]) => {
  const data = incidents.map(inc => {
    const suspectList = inc.involvedStudents
      .filter(i => i.role === 'suspect')
      .map(inv => {
        const s = students.find(st => st.id === inv.studentId);
        return s ? `${s.name} (${s.number}) - Karar: ${inv.decision || 'Beklemede'}` : '';
      }).filter(Boolean).join("; ");

    const witnessList = inc.involvedStudents
      .filter(i => i.role === 'witness')
      .map(inv => {
        const s = students.find(st => st.id === inv.studentId);
        return s ? `${s.name} (${s.number})` : '';
      }).filter(Boolean).join("; ");

    const victimList = inc.involvedStudents
      .filter(i => i.role === 'victim')
      .map(inv => {
        const s = students.find(st => st.id === inv.studentId);
        return s ? `${s.name} (${s.number})` : '';
      }).filter(Boolean).join("; ");

    return {
      "Olay Kodu": inc.code,
      "Tarih": inc.date,
      "Saat": inc.time,
      "Olay Başlığı": inc.title,
      "Olay Yeri": inc.location,
      "Olay Özeti": inc.description,
      "Süreç Durumu": inc.status === 'decided' ? 'Karara Bağlandı' : inc.status === 'investigating' ? 'İncelemede' : 'Beklemede',
      "Failler ve Kararlar": suspectList || 'Yok',
      "Tanıklar": witnessList || 'Yok',
      "Mağdurlar": victimList || 'Yok',
      "Dilekçe / Başvuru Sahibi": inc.petitioner || 'Belirtilmedi'
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Disiplin Olayları");
  XLSX.writeFile(wb, `Disiplin_Olaylari_${new Date().toISOString().split('T')[0]}.xlsx`);
};

// ---------------------------------------------------------------------------
// 2. DİSİPLİN KURULU KARAR DEFTERİ (RESMİ MEB ÇETELESİ)
// ---------------------------------------------------------------------------

export const exportDisciplineRegisterToExcel = (
  incidents: Incident[], 
  students: Student[], 
  institution?: Institution
) => {
  const rows: Record<string, string | number>[] = [];

  incidents.forEach(inc => {
    inc.involvedStudents.forEach(inv => {
      const s = students.find(st => st.id === inv.studentId);
      const isSuspect = inv.role === 'suspect';
      
      rows.push({
        "Karar No": inv.decisionNo || inc.code,
        "Karar Tarihi": inv.decisionDate || inc.date,
        "Öğrenci Okul No": s ? s.number : '-',
        "T.C. Kimlik No": s ? (s.tcNo || '-') : '-',
        "Öğrencinin Adı Soyadı": s ? s.name : 'Bilinmeyen Öğrenci',
        "Sınıfı / Şubesi": s ? (s.grade || '-') : '-',
        "Öğrenim Türü": s?.isMesem ? 'MESEM' : 'Örgün',
        "Olaya Dahil Rolü": inv.role === 'suspect' ? 'Fail (Cezalı)' : inv.role === 'witness' ? 'Tanık' : 'Mağdur',
        "Disiplin Olayı / Başlık": inc.title,
        "Verilen Ceza / Yaptırım": inv.decision || (isSuspect ? 'İnceleniyor' : 'Yaptırım Yok'),
        "Düşürülen Davranış Puanı": inv.penaltyScore ? `-${inv.penaltyScore}` : '0',
        "Karar Gerekçesi": inv.decisionReason || inc.description || '-',
        "Ceza Kaldırıldı mı?": inv.isRemoved ? 'EVET (Affedildi)' : 'HAYIR',
        "Ceza Kaldırma Karar No": inv.removedDecisionNo || '-',
        "Ceza Kaldırma Tarihi": inv.removedDate || '-'
      });
    });
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  const sheetName = "Disiplin Karar Defteri";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  
  const fileName = `MEB_Disiplin_Karar_Defteri_${institution?.year ? institution.year.replace('/', '-') : new Date().getFullYear()}.xlsx`;
  XLSX.writeFile(wb, fileName);
};

export const exportDisciplineRegisterToDocx = async (
  incidents: Incident[], 
  students: Student[], 
  institution?: Institution,
  boardMembers?: BoardMember[]
) => {
  const docDef = createDisciplineRegisterDoc(incidents, students, institution, boardMembers);
  await downloadDocx(docDef, `Disiplin_Karar_Defteri_${new Date().toISOString().split('T')[0]}`);
};

export const exportDisciplineRegisterToPDF = async (
  incidents: Incident[], 
  students: Student[], 
  institution?: Institution,
  boardMembers?: BoardMember[]
) => {
  const docDef = createDisciplineRegisterDoc(incidents, students, institution, boardMembers);
  await downloadPdf(docDef, `Disiplin_Karar_Defteri_${new Date().toISOString().split('T')[0]}`);
};

// ---------------------------------------------------------------------------
// 3. ÖĞRENCİ LİSTESİ VE DAVRANIŞ PUANLARI (STUDENTS)
// ---------------------------------------------------------------------------

export const exportStudentsToExcel = (students: Student[], incidents: Incident[] = []) => {
  const data = students.map(s => {
    const score = calculateStudentScore(s, incidents);
    return {
      "Okul No": s.number,
      "T.C. Kimlik": s.tcNo || '',
      "Adı Soyadı": s.name,
      "Sınıf": s.grade || '',
      "Öğrenim Türü": s.isMesem ? 'MESEM' : 'Örgün',
      "Davranış Notu (100 Üzerinden)": score,
      "Veli Adı": s.parentName || '',
      "Veli / Öğrenci Telefon": s.parentPhone || '',
      "Adres": s.address || '',
      "Yatılılık": s.boardingStatus || 'GÜNDÜZLÜ',
      "Bursluluk": s.scholarshipStatus || 'BURSSUZ',
      "İşletme Adı (MESEM)": s.companyName || '-',
      "Usta Öğretici (MESEM)": s.masterTrainer || '-'
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Öğrenciler");
  XLSX.writeFile(wb, `Ogrenci_ve_Davranis_Puanlari_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportStudentsToDocx = async (
  students: Student[], 
  incidents: Incident[] = [], 
  institution?: Institution
) => {
  const docDef = createStudentListDoc(students, incidents, institution);
  await downloadDocx(docDef, `Ogrenci_Davranis_Cizelgesi_${new Date().toISOString().split('T')[0]}`);
};

export const exportStudentsToPDF = async (
  students: Student[], 
  incidents: Incident[] = [], 
  institution?: Institution
) => {
  const docDef = createStudentListDoc(students, incidents, institution);
  await downloadPdf(docDef, `Ogrenci_Davranis_Cizelgesi_${new Date().toISOString().split('T')[0]}`);
};

// ---------------------------------------------------------------------------
// 4. BİREYSEL ÖĞRENCİ DİSİPLİN DOSYASI (SINGLE STUDENT)
// ---------------------------------------------------------------------------

export const exportStudentToDocx = async (student: Student, incidents: Incident[], institution?: Institution, boardMembers?: BoardMember[]) => {
  const docDef = createSingleStudentDoc(student, incidents, institution, boardMembers);
  await downloadDocx(docDef, `Ogrenci_Disiplin_Raporu_${student.number}`);
};

export const exportStudentToPDF = async (student: Student, incidents: Incident[], institution?: Institution, boardMembers?: BoardMember[]) => {
  const docDef = createSingleStudentDoc(student, incidents, institution, boardMembers);
  await downloadPdf(docDef, `Ogrenci_Disiplin_Raporu_${student.number}`);
};

// ---------------------------------------------------------------------------
// 5. MESEM ÖĞRENCİ VE İŞLETME RAPORLARI
// ---------------------------------------------------------------------------

export const exportMesemReportToExcel = (students: Student[]) => {
  const mesemOnly = students.filter(s => s.isMesem || (s.grade && s.grade.toUpperCase().includes('MES')));

  const data = mesemOnly.map(s => ({
    "Öğrenci No": s.number,
    "T.C. Kimlik": s.tcNo || '',
    "Adı Soyadı": s.name,
    "Sınıf": s.grade || 'MESEM',
    "Meslek Alanı": s.mesemField || '',
    "Meslek Dalı": s.mesemBranch || '',
    "İşletme / Firma": s.companyName || '',
    "İşletme Adresi": s.companyAddress || '',
    "Usta Öğretici": s.masterTrainer || '',
    "Usta / İşletme Tel": s.masterTrainerPhone || '',
    "Koordinatör Öğretmen": s.coordinatorTeacher || '',
    "Sözleşme Durumu": s.contractStatus || 'Aktif',
    "Sigorta / SGK": s.insuranceStatus || 'Giriş Yapıldı'
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MESEM Öğrencileri");
  XLSX.writeFile(wb, `MESEM_Isletme_ve_Ogrenci_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportMesemReportToDocx = async (students: Student[], institution?: Institution) => {
  const docDef = createMesemReportDoc(students, institution);
  await downloadDocx(docDef, `MESEM_Ogrenci_Isletme_Raporu_${new Date().toISOString().split('T')[0]}`);
};

export const exportMesemReportToPDF = async (students: Student[], institution?: Institution) => {
  const docDef = createMesemReportDoc(students, institution);
  await downloadPdf(docDef, `MESEM_Ogrenci_Isletme_Raporu_${new Date().toISOString().split('T')[0]}`);
};

// ---------------------------------------------------------------------------
// 6. DİSİPLİN KARARI (EK-10) EXPORTS
// ---------------------------------------------------------------------------

export const exportDecisionToDocx = async (
  incident: Incident,
  student: Student,
  decisionData: any,
  institution?: Institution,
  boardMembers?: BoardMember[]
) => {
  const docDef = createDecisionDoc(incident, student, decisionData, institution, boardMembers);
  await downloadDocx(docDef, `EK10_Disiplin_Karari_${decisionData.decisionNo || incident.code}`);
};

export const exportDecisionToPDF = async (
  incident: Incident,
  student: Student,
  decisionData: any,
  institution?: Institution,
  boardMembers?: BoardMember[]
) => {
  const docDef = createDecisionDoc(incident, student, decisionData, institution, boardMembers);
  await downloadPdf(docDef, `EK10_Disiplin_Karari_${decisionData.decisionNo || incident.code}`);
};

// Safe print trigger
export const triggerSafePrint = () => {
  try {
    if (window.electronAPI) {
      window.electronAPI.printDirect();
    } else {
      window.print();
    }
  } catch {
    try {
      window.print();
    } catch (err2) {
      console.warn("Print execution failed:", err2);
      alert("Yazdırma kısıtlandı. Lütfen raporu PDF olarak indirip yazdırınız.");
    }
  }
};
