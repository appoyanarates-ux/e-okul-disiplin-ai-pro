import { Incident, Student, Institution, BoardMember } from '../types';

export interface DocumentSection {
  type: 'paragraph' | 'keyValueGrid' | 'table' | 'bulletList' | 'notice' | 'heading';
  title?: string;
  text?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
  bold?: boolean;
  items?: Array<{ label: string; value: string }>;
  columns?: number;
  headers?: string[];
  rows?: (string | number)[][];
  colWidths?: number[]; // percentages e.g. [20, 40, 40]
  bullets?: string[];
}

export interface DocumentSignature {
  title: string;
  name?: string;
  duty?: string;
}

export interface DocumentDefinition {
  id: string;
  title: string;
  subtitle?: string;
  institutionName: string;
  academicYear?: string;
  date?: string;
  code?: string;
  orientation: 'portrait' | 'landscape';
  sections: DocumentSection[];
  signatures: DocumentSignature[];
  footerNote?: string;
  fontSize?: number; // default 12 (Times New Roman standard)
}

// Calculate student behavior score
export const calculateStudentScore = (student: Student, incidents: Incident[]): number => {
  let deductedPoints = 0;

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
        else if (dec.includes('UZAKLAŞTIRMA')) score = 20;
        else if (dec.includes('DEĞİŞTİRME')) score = 45;
        else if (dec.includes('DIŞINA ÇIKARMA') || dec.includes('ÖRGÜN')) score = 80;
      }
      deductedPoints += score;
    });
  }

  return Math.max(0, 100 - deductedPoints);
};

const getInstitutionHeader = (inst?: Institution): string => {
  if (inst?.name) {
    const province = inst.province ? `${inst.province.toUpperCase()} - ` : '';
    const district = inst.district ? `${inst.district.toUpperCase()} / ` : '';
    return `T.C.\n${province}${district}${inst.name.toUpperCase()}`;
  }
  return "T.C.\nMİLLÎ EĞİTİM BAKANLIĞI\nÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU BAŞKANLIĞI";
};

// 1. DİSİPLİN OLAY TUTANAĞI VE İNCELEME RAPORU
export const createIncidentReportDoc = (
  incident: Incident,
  students: Student[],
  institution?: Institution,
  boardMembers?: BoardMember[]
): DocumentDefinition => {
  const involvedRows: (string | number)[][] = incident.involvedStudents.map((inv, idx) => {
    const s = students.find(st => st.id === inv.studentId);
    const roleText = inv.role === 'suspect' ? 'Fail / Şüpheli' : inv.role === 'witness' ? 'Tanık' : 'Mağdur';
    return [
      idx + 1,
      s ? s.number : '-',
      s ? s.name : 'Bilinmeyen Öğrenci',
      s ? (s.grade || '-') : '-',
      roleText,
      inv.decision ? `${inv.decision} ${inv.penaltyScore ? `(-${inv.penaltyScore} Puan)` : ''}` : 'Karar Verilmedi'
    ];
  });

  return {
    id: `incident_${incident.code}`,
    title: "DİSİPLİN OLAYI VE SORUŞTURMA İNCELEME RAPORU",
    subtitle: "Öğrenci Ödül ve Disiplin Kurulu İnceleme Evrakı",
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: incident.date,
    code: incident.code,
    orientation: 'portrait',
    sections: [
      {
        type: 'keyValueGrid',
        title: "Olay ve Soruşturma Temel Bilgileri",
        items: [
          { label: "Olay Kodu", value: incident.code },
          { label: "Olay Tarihi ve Saati", value: `${incident.date} / ${incident.time || '10:00'}` },
          { label: "Olay Yeri", value: incident.location || 'Okul İçi' },
          { label: "Süreç Durumu", value: incident.status === 'decided' ? 'Karara Bağlandı' : incident.status === 'investigating' ? 'İncelemede' : 'Beklemede' },
          { label: "Olay Başlığı", value: incident.title },
          { label: "Şikayetçi / Dilekçe Sahibi", value: incident.petitioner || 'Resen (Okul İdaresi)' }
        ]
      },
      {
        type: 'paragraph',
        title: "Olayın Özeti ve İnceleme Bulguları",
        text: incident.description || 'Olay açıklaması kaydedilmemiştir.',
        align: 'justify'
      },
      {
        type: 'table',
        title: "Olaya Karışan Öğrenciler ve Uygulanan Kararlar",
        headers: ["Sıra", "No", "Adı Soyadı", "Sınıf", "Rolü", "Verilen Karar"],
        colWidths: [8, 12, 30, 15, 15, 20],
        rows: involvedRows.length > 0 ? involvedRows : [["-", "-", "Kayıtlı öğrenci bulunmamaktadır.", "-", "-", "-"]]
      },
      {
        type: 'notice',
        text: "İşbu inceleme tutanağı ve soruşturma raporu, ilgili yönetmelik hükümleri gereğince düzenlenmiş ve imza altına alınmıştır."
      }
    ],
    signatures: [
      { title: "Disiplin Kurulu Başkanı", name: boardMembers?.[0]?.mainName || "Müdür Başyardımcısı / Yrd.", duty: "Başkan" },
      { title: "Üye (Öğretmen)", name: boardMembers?.[1]?.mainName || "Öğretmen", duty: "Üye" },
      { title: "Okul Müdürü (Tasdik)", name: institution?.managerName || "Okul Müdürü", duty: "Müdür" }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

// 2. DİSİPLİN KURULU KARAR DEFTERİ (RESMİ MEB ÇETELESİ - LANDSCAPE)
export const createDisciplineRegisterDoc = (
  incidents: Incident[],
  students: Student[],
  institution?: Institution,
  boardMembers?: BoardMember[]
): DocumentDefinition => {
  const rows: (string | number)[][] = [];
  let count = 0;

  incidents.forEach(inc => {
    inc.involvedStudents.forEach(inv => {
      count++;
      const s = students.find(st => st.id === inv.studentId);
      const isSuspect = inv.role === 'suspect';
      const decNo = inv.decisionNo || inc.code;
      const decDate = inv.decisionDate || inc.date;
      const dec = inv.decision ? inv.decision : (isSuspect ? 'İnceleniyor' : 'Yaptırım Yok');
      const score = inv.penaltyScore ? `-${inv.penaltyScore}` : '0';
      const statusText = inv.isRemoved ? 'Ceza Silindi' : (inv.decision ? 'Onaylı' : 'Beklemede');

      rows.push([
        decNo,
        decDate,
        s ? s.number : '-',
        s ? (s.tcNo || '-') : '-',
        s ? s.name : 'Bilinmeyen Öğrenci',
        s ? (s.grade || '-') : '-',
        s?.isMesem ? 'MESEM' : 'Örgün',
        inc.title,
        dec,
        score,
        statusText
      ]);
    });
  });

  return {
    id: `discipline_register_${new Date().getFullYear()}`,
    title: "ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU KARAR DEFTERİ",
    subtitle: "Millî Eğitim Bakanlığı Resmi Karar Defteri Çizelgesi",
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: new Date().toLocaleDateString('tr-TR'),
    orientation: 'landscape',
    sections: [
      {
        type: 'table',
        headers: ["Karar No", "Tarih", "Okul No", "T.C. Kimlik", "Adı Soyadı", "Sınıf", "Tür", "Disiplin Olayı", "Verilen Ceza / Karar", "Puan", "Durum"],
        colWidths: [8, 8, 7, 10, 16, 7, 6, 16, 12, 5, 5],
        rows: rows.length > 0 ? rows : [["-", "-", "-", "-", "Kayıtlı disiplin kararı bulunmamaktadır.", "-", "-", "-", "-", "-", "-"]]
      }
    ],
    signatures: [
      { title: "Kurul Başkanı", name: boardMembers?.[0]?.mainName || "Müdür Yrd.", duty: "Başkan" },
      { title: "Üye (Öğretmen)", name: boardMembers?.[1]?.mainName || "Öğretmen", duty: "Üye" },
      { title: "Üye (Öğretmen)", name: boardMembers?.[2]?.mainName || "Öğretmen", duty: "Üye" },
      { title: "Üye (Veli)", name: boardMembers?.[4]?.mainName || "Okul Aile Birliği", duty: "Veli Temsilcisi" },
      { title: "Okul Müdürü (Onay)", name: institution?.managerName || "Okul Müdürü", duty: "Müdür" }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

// 3. ÖĞRENCİ LİSTESİ VE DAVRANIŞ NOTU ÇİZELGESİ
export const createStudentListDoc = (
  students: Student[],
  incidents: Incident[] = [],
  institution?: Institution
): DocumentDefinition => {
  const rows: (string | number)[][] = students.map((s, idx) => {
    const score = calculateStudentScore(s, incidents);
    return [
      idx + 1,
      s.number,
      s.tcNo || '-',
      s.name,
      s.grade || '-',
      s.isMesem ? 'MESEM' : 'Örgün',
      s.parentName || '-',
      s.parentPhone || '-',
      `${score} / 100`
    ];
  });

  return {
    id: `student_list_${new Date().toISOString().split('T')[0]}`,
    title: "ÖĞRENCİ KÜNYE VE DAVRANIŞ NOTU ÇİZELGESİ",
    subtitle: "Okul Disiplin Takip ve Davranış Puanı Raporu",
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: new Date().toLocaleDateString('tr-TR'),
    orientation: 'portrait',
    sections: [
      {
        type: 'table',
        headers: ["Sıra", "No", "T.C. Kimlik", "Adı Soyadı", "Sınıfı", "Türü", "Veli Adı", "İletişim", "Davranış Puanı"],
        colWidths: [6, 10, 14, 25, 10, 8, 14, 13, 10],
        rows: rows.length > 0 ? rows : [["-", "-", "-", "Kayıtlı öğrenci bulunmamaktadır.", "-", "-", "-", "-", "-"]]
      }
    ],
    signatures: [
      { title: "Disiplin Kurulu Başkanı", name: "Müdür Yardımcısı", duty: "Başkan" },
      { title: "Okul Müdürü", name: institution?.managerName || "Okul Müdürü", duty: "Müdür" }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

// 4. BİREYSEL ÖĞRENCİ DİSİPLİN KÜTÜK DOSYASI
export const createSingleStudentDoc = (
  student: Student,
  incidents: Incident[],
  institution?: Institution,
  boardMembers?: BoardMember[]
): DocumentDefinition => {
  const score = calculateStudentScore(student, incidents);
  const studentIncidents = incidents.filter(inc =>
    inc.involvedStudents.some(inv => inv.studentId === student.id)
  );

  const historyRows: (string | number)[][] = [];

  studentIncidents.forEach(inc => {
    const inv = inc.involvedStudents.find(i => i.studentId === student.id);
    if (!inv) return;
    historyRows.push([
      inc.code,
      inc.date,
      inc.title,
      inv.role === 'suspect' ? 'Fail' : inv.role === 'witness' ? 'Tanık' : 'Mağdur',
      inv.decision || 'Karar Yok',
      inv.penaltyScore ? `-${inv.penaltyScore}` : '0',
      inv.isRemoved ? 'Affedildi (Silindi)' : (inv.decision ? 'Yürürlükte' : 'Sürüyor')
    ]);
  });

  if (student.previousPenalties) {
    student.previousPenalties.forEach(p => {
      historyRows.push([
        p.decisionNo || 'Geçmiş',
        p.date || '-',
        p.description || 'Geçmiş Dönem Cezası',
        'Fail',
        p.decision || '-',
        p.penaltyScore ? `-${p.penaltyScore}` : '0',
        p.isRemoved ? 'Silindi' : 'İşlenmiş'
      ]);
    });
  }

  return {
    id: `student_file_${student.number}`,
    title: "ÖĞRENCİ DİSİPLİN KÜTÜK VE GELİŞİM DOSYASI",
    subtitle: "Bireysel Disiplin Geçmişi ve Davranış Değerlendirmesi",
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: new Date().toLocaleDateString('tr-TR'),
    orientation: 'portrait',
    sections: [
      {
        type: 'keyValueGrid',
        title: "Öğrenci Kimlik ve Okul Bilgileri",
        columns: 3,
        items: [
          { label: "Adı Soyadı", value: student.name },
          { label: "Okul No", value: student.number },
          { label: "Sınıfı / Şubesi", value: student.grade || '-' },
          { label: "T.C. Kimlik No", value: student.tcNo || '-' },
          { label: "Öğrenim Türü", value: student.isMesem ? 'MESEM (Mesleki Eğitim)' : 'Örgün Eğitim' },
          { label: "Güncel Davranış Notu", value: `${score} / 100` },
          { label: "Veli Adı Soyadı", value: student.parentName || '-' },
          { label: "Veli Telefonu", value: student.parentPhone || '-' },
          { label: "Yatılılık / Burs", value: `${student.boardingStatus || 'Gündüzlü'} / ${student.scholarshipStatus || 'Burssuz'}` }
        ]
      },
      {
        type: 'table',
        title: "Disiplin Olayları ve Ceza Geçmişi",
        headers: ["Olay Kodu", "Tarih", "Olay / Konu", "Rol", "Verilen Karar", "Puan", "Durum"],
        colWidths: [12, 12, 28, 10, 18, 8, 12],
        rows: historyRows.length > 0 ? historyRows : [["-", "-", "Öğrencinin kayıtlı herhangi bir disiplin cezası veya yaptırımı bulunmamaktadır.", "-", "-", "-", "-"]]
      },
      {
        type: 'notice',
        text: `Öğrencinin mevcut davranış puanı ${score} olup, Millî Eğitim Bakanlığı mevzuatına göre davranış değerlendirmesi aktif olarak takip edilmektedir.`
      }
    ],
    signatures: [
      { title: "Disiplin Kurulu Başkanı", name: boardMembers?.[0]?.mainName || "Müdür Yrd.", duty: "Başkan" },
      { title: "Okul Müdürü", name: institution?.managerName || "Okul Müdürü", duty: "Müdür" }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

// 5. MESEM ÖĞRENCİ VE İŞLETME RAPORU (LANDSCAPE)
export const createMesemReportDoc = (
  students: Student[],
  institution?: Institution
): DocumentDefinition => {
  const mesemOnly = students.filter(s => s.isMesem || (s.grade && s.grade.toUpperCase().includes('MES')));
  const rows: (string | number)[][] = mesemOnly.map((s, idx) => [
    idx + 1,
    s.number,
    s.tcNo || '-',
    s.name,
    s.grade || 'MESEM',
    s.mesemField || '-',
    s.mesemBranch || '-',
    s.companyName || '-',
    s.masterTrainer || '-',
    s.masterTrainerPhone || '-',
    s.coordinatorTeacher || '-'
  ]);

  return {
    id: `mesem_report_${new Date().toISOString().split('T')[0]}`,
    title: "MESLEKİ EĞİTİM MERKEZİ (MESEM) İŞLETME VE ÖĞRENCİ ÇİZELGESİ",
    subtitle: "3308 Sayılı Kanun Kapsamında İşletme ve Koordinatörlük Raporu",
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: new Date().toLocaleDateString('tr-TR'),
    orientation: 'landscape',
    sections: [
      {
        type: 'table',
        headers: ["Sıra", "Okul No", "T.C. Kimlik", "Adı Soyadı", "Sınıf", "Meslek Alanı", "Meslek Dalı", "İşletme / Firma", "Usta Öğretici", "Usta Tel", "Koordinatör"],
        colWidths: [4, 7, 9, 14, 7, 13, 11, 14, 10, 8, 9],
        rows: rows.length > 0 ? rows : [["-", "-", "-", "Kayıtlı MESEM öğrencisi bulunmamaktadır.", "-", "-", "-", "-", "-", "-"]]
      }
    ],
    signatures: [
      { title: "Koordinatör Müdür Yardımcısı", name: "Müdür Yrd.", duty: "Yetkili" },
      { title: "Okul Müdürü", name: institution?.managerName || "Okul Müdürü", duty: "Müdür" }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

// 6. DİSİPLİN KURULU KARAR TUTANAĞI (EK-10)
export const createDecisionDoc = (
  incident: Incident,
  student: Student,
  decisionData: {
    decisionNo: string;
    decisionDate: string;
    penalty: string;
    reason: string;
    score: string;
    regulationArticle?: string;
  },
  institution?: Institution,
  boardMembers?: BoardMember[]
): DocumentDefinition => {
  return {
    id: `decision_${decisionData.decisionNo || incident.code}`,
    title: "ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU KARAR TUTANAĞI (EK-10)",
    subtitle: "Resmî Disiplin Kararı ve Gerekçesi",
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: decisionData.decisionDate,
    code: `Karar No: ${decisionData.decisionNo}`,
    orientation: 'portrait',
    sections: [
      {
        type: 'keyValueGrid',
        title: "Öğrenci ve Karar Bilgileri",
        items: [
          { label: "Öğrencinin Adı Soyadı", value: student.name },
          { label: "Okul Numarası / Sınıfı", value: `${student.number} / ${student.grade || '-'}` },
          { label: "T.C. Kimlik No", value: student.tcNo || '-' },
          { label: "Karar Numarası", value: decisionData.decisionNo },
          { label: "Karar Tarihi", value: decisionData.decisionDate },
          { label: "Verilen Ceza / Yaptırım", value: decisionData.penalty },
          { label: "Düşürülen Davranış Puanı", value: `-${decisionData.score} Puan` },
          { label: "Dayanak Yönetmelik Maddesi", value: decisionData.regulationArticle || "MEB Ortaöğretim Kurumları Yönetmeliği Madde 164" }
        ]
      },
      {
        type: 'paragraph',
        title: "Disiplin İhlaline Konu Olayın Özeti",
        text: incident.description || incident.title,
        align: 'justify'
      },
      {
        type: 'paragraph',
        title: "Kurul Kararı ve Gerekçesi",
        text: decisionData.reason || "Yukarıda açık kimliği yazılı öğrencinin eylemi sübuta ermiş olup ilgili yönetmelik maddesi uyarınca tecziyesine karar verilmiştir.",
        align: 'justify',
        bold: false
      },
      {
        type: 'notice',
        text: "Bu karara karşı, tebliğ tarihinden itibaren ilgili mevzuatta belirtilen süre içerisinde İl/İlçe Öğrenci Disiplin Kurulu nezdinde itiraz hakkı saklıdır."
      }
    ],
    signatures: [
      { title: "Kurul Başkanı", name: boardMembers?.[0]?.mainName || "Müdür Yrd.", duty: "Başkan" },
      { title: "Üye (Öğretmen)", name: boardMembers?.[1]?.mainName || "Öğretmen", duty: "Üye" },
      { title: "Üye (Öğretmen)", name: boardMembers?.[2]?.mainName || "Öğretmen", duty: "Üye" },
      ...(institution?.counselorName ? [{ title: institution.counselorTitle || "Okul Rehber Öğretmeni", name: institution.counselorName, duty: "Danışman" }] : []),
      { title: "Üye (Veli)", name: boardMembers?.[4]?.mainName || "Veli Temsilcisi", duty: "Üye" },
      { title: "UYGUNDUR\nOkul Müdürü (Tasdik)", name: institution?.managerName || "Okul Müdürü", duty: "Müdür" }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

// 7. ÖĞRENCİ SAVUNMA İSTEME YAZISI
export const createDefenseRequestDoc = (
  incident: Incident,
  student: Student,
  institution?: Institution,
  boardMembers?: BoardMember[]
): DocumentDefinition => {
  return {
    id: `defense_req_${student.number}`,
    title: "YAZILI SAVUNMA İSTEME YAZISI",
    subtitle: "Öğrenci Savunma Tebligatı",
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: new Date().toLocaleDateString('tr-TR'),
    code: `Soruşturma: ${incident.code}`,
    orientation: 'portrait',
    sections: [
      {
        type: 'keyValueGrid',
        title: "Muhatap Öğrenci Bilgileri",
        items: [
          { label: "Öğrencinin Adı Soyadı", value: student.name },
          { label: "Okul No / Sınıfı", value: `${student.number} / ${student.grade || '-'}` },
          { label: "Tebliğ Tarihi", value: new Date().toLocaleDateString('tr-TR') },
          { label: "Soruşturma Konusu", value: incident.title }
        ]
      },
      {
        type: 'paragraph',
        title: "Savunma Konusu İddia ve Olay",
        text: `${incident.date} tarihinde okulumuzda meydana gelen "${incident.title}" olayı ile ilgili olarak hakkınızda disiplin incelemesi ve soruşturması başlatılmıştır.\n\nOlayla ilgili iddialara dair savunmanızı, bu yazının tarafınıza tebliğ edildiği tarihten itibaren yasal süre içerisinde yazılı olarak Disiplin Kurulu Başkanlığına teslim etmeniz gerekmektedir. Belirtilen sürede savunma vermemeniz halinde savunma hakkınızdan feragat etmiş sayılacağınız hususunda bilgilerinizi rica ederim.`,
        align: 'justify'
      },
      {
        type: 'notice',
        text: "Tebellüğ Eden Öğrenci: Bu yazıyı teslim aldım. Tarih: ...../...../202... İmza: ........................."
      }
    ],
    signatures: [
      { title: "Disiplin Kurulu Başkanı", name: boardMembers?.[0]?.mainName || "Müdür Yrd.", duty: "Başkan" },
      { title: "Okul Müdürü", name: institution?.managerName || "Okul Müdürü", duty: "Müdür" }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

// 8. ÖĞRENCİ / TANIK İFADE TUTANAĞI
export const createStatementDoc = (
  incident: Incident,
  personName: string,
  personNumberOrTitle: string,
  personRole: 'Öğrenci (Şüpheli)' | 'Tanık (Öğrenci)' | 'Tanık (Öğretmen)' | 'Mağdur',
  statementText: string,
  institution?: Institution,
  boardMembers?: BoardMember[]
): DocumentDefinition => {
  return {
    id: `statement_${incident.code}_${personName.replace(/\s+/g, '_')}`,
    title: "DİSİPLİN SORUŞTURMASI İFADE TUTANAĞI",
    subtitle: `${personRole} İfade Beyan Formu`,
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: incident.date,
    code: `Evrak No: ${incident.code}`,
    orientation: 'portrait',
    sections: [
      {
        type: 'keyValueGrid',
        title: "İfade Veren Şahsın Kimlik Bilgileri",
        items: [
          { label: "Adı ve Soyadı", value: personName },
          { label: "Okul No / Unvanı", value: personNumberOrTitle },
          { label: "Soruşturmadaki Sıfatı", value: personRole },
          { label: "İfade Alınış Tarihi ve Yeri", value: `${incident.date} / Disiplin Odası` },
          { label: "Soruşturma Konusu", value: incident.title }
        ]
      },
      {
        type: 'paragraph',
        title: "Sorulan Hususlar ve İfade Beyanı",
        text: statementText || "İfade sahibi olayla ilgili bildiklerini sözlü olarak beyan etmiş olup aşağıdaki şekilde tutanağa geçirilmiştir:\n\n....................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................................",
        align: 'justify'
      },
      {
        type: 'notice',
        text: "Yukarıdaki ifademin doğruluğunu beyan eder, okudum ve altını imza ettim."
      }
    ],
    signatures: [
      { title: "İfadeyi Alan (Kurul Başkanı)", name: boardMembers?.[0]?.mainName || "Müdür Yrd.", duty: "Başkan" },
      { title: "İfadeyi Alan (Üye)", name: boardMembers?.[1]?.mainName || "Öğretmen", duty: "Üye" },
      { title: "İfade Sahibi", name: personName, duty: personRole }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

// 9. VELİ BİLGİLENDİRME VE YAPTIRIM TEBLİĞİ
export const createParentNoticeDoc = (
  incident: Incident,
  student: Student,
  decision: string,
  decisionNo: string,
  penaltyScore: string,
  institution?: Institution
): DocumentDefinition => {
  return {
    id: `parent_notice_${student.number}`,
    title: "DİSİPLİN CEZASI VE YAPTIRIM VELİ BİLGİLENDİRME TEBLİĞİ",
    subtitle: "Sayın Öğrenci Velisinin Dikkatine",
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: new Date().toLocaleDateString('tr-TR'),
    code: `Karar No: ${decisionNo || incident.code}`,
    orientation: 'portrait',
    sections: [
      {
        type: 'keyValueGrid',
        title: "Öğrenci ve Veli Bilgileri",
        items: [
          { label: "Öğrencinin Adı Soyadı", value: student.name },
          { label: "Okul Numarası / Sınıfı", value: `${student.number} / ${student.grade || '-'}` },
          { label: "Sayın Veli Adı Soyadı", value: student.parentName || 'Öğrenci Velisi' },
          { label: "İletişim Telefonu", value: student.parentPhone || '-' },
          { label: "Verilen Disiplin Cezası", value: decision },
          { label: "Düşürülen Davranış Notu", value: `-${penaltyScore || '0'} Puan` }
        ]
      },
      {
        type: 'paragraph',
        title: "Tebligat Metni",
        text: `Velisi bulunduğunuz okulumuz ${student.grade || ''} sınıfı ${student.number} numaralı öğrencisi ${student.name}'in, ${incident.date} tarihinde meydana gelen "${incident.title}" olayındaki eylemleri sebebiyle, Okul Öğrenci Ödül ve Disiplin Kurulumuz tarafından yukarıda belirtilen yaptırımın uygulanmasına karar verilmiştir.\n\nÖğrencimizin davranış gelişiminin olumlu yönde desteklenmesi, eğitim ve öğretim sürecinin aksamaması adına veli olarak gerekli rehberliğin yapılması hususunda iş birliğinizi rica eder, kararı bilgilerinize tebliğ ederiz.`,
        align: 'justify'
      },
      {
        type: 'notice',
        text: "Tebellüğ Eden Veli: Kararın bir suretini elden teslim aldım. Tarih: ...../...../202... İmza: ........................."
      }
    ],
    signatures: [
      { title: "Disiplin Kurulu Başkanı", name: "Müdür Yardımcısı", duty: "Başkan" },
      { title: "Okul Müdürü", name: institution?.managerName || "Okul Müdürü", duty: "Müdür" }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

// 10. CEZA KALDIRMA / DAVRANIŞ PUANI İADE BELGESİ
export const createPenaltyRemovalDoc = (
  student: Student,
  penaltyInfo: {
    decision: string;
    originalDate: string;
    removalDecisionNo: string;
    removalDate: string;
    removalReason: string;
  },
  institution?: Institution,
  boardMembers?: BoardMember[]
): DocumentDefinition => {
  return {
    id: `penalty_removal_${student.number}`,
    title: "DİSİPLİN CEZASININ KALDIRILMASI VE DAVRANIŞ NOTU İADE KARARI",
    subtitle: "Yönetmelik Uyarınca Cezanın Sicilden Silinmesi Tutanağı",
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: penaltyInfo.removalDate || new Date().toLocaleDateString('tr-TR'),
    code: `Karar No: ${penaltyInfo.removalDecisionNo || 'CK-01'}`,
    orientation: 'portrait',
    sections: [
      {
        type: 'keyValueGrid',
        title: "Öğrenci ve Kaldırılan Ceza Bilgileri",
        items: [
          { label: "Öğrencinin Adı Soyadı", value: student.name },
          { label: "Okul No / Sınıfı", value: `${student.number} / ${student.grade || '-'}` },
          { label: "Daha Önce Verilen Ceza", value: penaltyInfo.decision },
          { label: "Ceza Veriliş Tarihi", value: penaltyInfo.originalDate || '-' },
          { label: "Ceza Kaldırma Karar No", value: penaltyInfo.removalDecisionNo },
          { label: "Ceza Kaldırma Tarihi", value: penaltyInfo.removalDate }
        ]
      },
      {
        type: 'paragraph',
        title: "Kurul Değerlendirmesi ve Gerekçe",
        text: penaltyInfo.removalReason || "Öğrencinin ceza aldığı tarihten itibaren olumlu davranış sergilediği, öğretmenler ve sınıf rehber öğretmeninin olumlu görüşleri doğrultusunda MEB Ortaöğretim Kurumları Yönetmeliğinin cezanın kaldırılmasına ilişkin maddesi gereğince cezasının sicilden silinmesine ve davranış puanının iadesine karar verilmiştir.",
        align: 'justify'
      },
      {
        type: 'notice',
        text: "İşbu karar ile öğrencinin ilgili disiplin cezası e-Okul sisteminden ve sicil dosyasından kaldırılmıştır."
      }
    ],
    signatures: [
      { title: "Kurul Başkanı", name: boardMembers?.[0]?.mainName || "Müdür Yrd.", duty: "Başkan" },
      { title: "Üye (Öğretmen)", name: boardMembers?.[1]?.mainName || "Öğretmen", duty: "Üye" },
      { title: "Üye (Öğretmen)", name: boardMembers?.[2]?.mainName || "Öğretmen", duty: "Üye" },
      ...(institution?.counselorName ? [{ title: institution.counselorTitle || "Okul Rehber Öğretmeni", name: institution.counselorName, duty: "Rehberlik Servisi" }] : []),
      { title: "Okul Müdürü (Onay)", name: institution?.managerName || "Okul Müdürü", duty: "Müdür" }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

// 11. DİSİPLİN KURULU ÇAĞRI YAZISI
export const createMeetingSummonsDoc = (
  incident: Incident,
  students: Student[],
  meetingDate: string,
  meetingTime: string,
  meetingLocation: string,
  institution?: Institution,
  boardMembers?: BoardMember[]
): DocumentDefinition => {
  const memberList = (boardMembers || []).map((m, idx) => `${idx + 1}. ${m.role}: ${m.mainName || 'İmza'} (${m.mainTitle || 'Öğretmen'})`);
  if (institution?.counselorName) {
    memberList.push(`${memberList.length + 1}. Danışman Üye: ${institution.counselorName} (${institution.counselorTitle || 'Okul Rehber Öğretmeni'})`);
  }

  return {
    id: `summons_${incident.code}`,
    title: "DİSİPLİN KURULU TOPLANTI ÇAĞRI YAZISI",
    subtitle: "Kurul Üyelerine Resmi Davet",
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: new Date().toLocaleDateString('tr-TR'),
    code: `Çağrı: ${incident.code}`,
    orientation: 'portrait',
    sections: [
      {
        type: 'keyValueGrid',
        title: "Toplantı Bilgileri",
        items: [
          { label: "Toplantı Tarihi ve Saati", value: `${meetingDate} / ${meetingTime}` },
          { label: "Toplantı Yeri", value: meetingLocation || 'Öğrenci Disiplin Odası' },
          { label: "Gündem Konusu", value: incident.title },
          { label: "İlgili Olay Kodu", value: incident.code }
        ]
      },
      {
        type: 'paragraph',
        title: "Toplantı Çağrı Metni",
        text: `Okulumuzda meydana gelen "${incident.title}" disiplin olayı ve soruşturması hakkında inceleme yapmak, ilgililerin ifadelerini ve savunmalarını değerlendirmek üzere Öğrenci Ödül ve Disiplin Kurulumuz yukarıda belirtilen gün ve saatte toplanacaktır. Kurul üyelerinin belirtilen yer ve zamanda hazır bulunmalarını rica ederim.`,
        align: 'justify'
      },
      {
        type: 'bulletList',
        title: "Kurul Üyeleri Listesi",
        bullets: memberList.length > 0 ? memberList : ["Disiplin Kurulu Başkanı", "Öğretmen Üyeler", "Okul Aile Birliği Temsilcisi"]
      }
    ],
    signatures: [
      { title: "Kurul Başkanı", name: boardMembers?.[0]?.mainName || "Müdür Yrd.", duty: "Başkan" },
      { title: "Okul Müdürü (Uygundur)", name: institution?.managerName || "Okul Müdürü", duty: "Müdür" }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

// 12. DİSİPLİN İSTATİSTİK RAPORU
export const createStatisticsDoc = (
  stats: {
    totalIncidents: number;
    totalStudents: number;
    pendingIncidents: number;
    decidedIncidents: number;
    penaltiesByType: Record<string, number>;
  },
  institution?: Institution
): DocumentDefinition => {
  const penaltyRows = Object.entries(stats.penaltiesByType).map(([penalty, count]) => [penalty, count]);

  return {
    id: `statistics_report_${new Date().toISOString().split('T')[0]}`,
    title: "DİSİPLİN VE DAVRANIŞ DEĞERLENDİRME İSTATİSTİK RAPORU",
    subtitle: "Dönemsel Disiplin Olayları ve Yaptırım Analizi",
    institutionName: getInstitutionHeader(institution),
    academicYear: institution?.year ? `${institution.year} Eğitim-Öğretim Yılı` : undefined,
    date: new Date().toLocaleDateString('tr-TR'),
    orientation: 'portrait',
    sections: [
      {
        type: 'keyValueGrid',
        title: "Genel Disiplin Göstergeleri",
        items: [
          { label: "Toplam Öğrenci Sayısı", value: String(stats.totalStudents) },
          { label: "Toplam Disiplin Olayı", value: String(stats.totalIncidents) },
          { label: "Karara Bağlanan Olaylar", value: String(stats.decidedIncidents) },
          { label: "Süren İncelemeler", value: String(stats.pendingIncidents) }
        ]
      },
      {
        type: 'table',
        title: "Verilen Ceza ve Yaptırımların Dağılımı",
        headers: ["Ceza / Yaptırım Türü", "Toplam Sayı"],
        colWidths: [70, 30],
        rows: penaltyRows.length > 0 ? penaltyRows : [["Herhangi bir ceza kaydı bulunmamaktadır.", 0]]
      }
    ],
    signatures: [
      { title: "Disiplin Kurulu Başkanı", name: "Müdür Yardımcısı", duty: "Başkan" },
      { title: "Okul Müdürü", name: institution?.managerName || "Okul Müdürü", duty: "Müdür" }
    ],
    footerNote: "E-Okul Disiplin AI Pro - By Abdullah Yanarateş"
  };
};

/**
 * Converts a DocumentDefinition into a standalone, pure vector HTML string
 * with exact @page rules and CSS @media print styles for Chromium printToPDF.
 */
export const renderDocDefToHtml = (
  docDef: DocumentDefinition,
  options: {
    margins?: { top: number; bottom: number; left: number; right: number };
    fontSize?: number;
  } = {}
): string => {
  const isLandscape = docDef.orientation === 'landscape';
  const margins = options.margins || { top: 20, bottom: 20, left: 20, right: 20 };
  const fontSize = options.fontSize || docDef.fontSize || 12;

  let sectionsHtml = '';
  docDef.sections.forEach(section => {
    sectionsHtml += '<div style="margin-bottom: 14px;">';
    if (section.title) {
      sectionsHtml += `<div style="font-weight: bold; font-size: 12pt; text-transform: uppercase; border-bottom: 1.5px solid #000; padding-bottom: 4px; margin-bottom: 8px;">${section.title}</div>`;
    }

    if (section.type === 'paragraph' && section.text) {
      const align = section.align || 'justify';
      const weight = section.bold ? 'font-weight: bold;' : '';
      sectionsHtml += `<div style="text-align: ${align}; ${weight} font-size: ${fontSize}pt; line-height: 1.5; white-space: pre-line; margin-bottom: 10px;">${section.text}</div>`;
    } else if (section.type === 'keyValueGrid' && section.items) {
      sectionsHtml += '<table style="width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #000; font-size: 9.5pt;"><tbody>';
      for (let i = 0; i < section.items.length; i += 2) {
        const item1 = section.items[i];
        const item2 = section.items[i + 1];
        sectionsHtml += '<tr>';
        sectionsHtml += `<td style="width: 25%; font-weight: bold; background-color: #f8fafc; padding: 6px 8px; border: 1px solid #000;">${item1.label}</td>`;
        sectionsHtml += `<td style="width: 25%; padding: 6px 8px; border: 1px solid #000;">${item1.value || '-'}</td>`;
        sectionsHtml += `<td style="width: 25%; font-weight: bold; background-color: #f8fafc; padding: 6px 8px; border: 1px solid #000;">${item2 ? item2.label : ''}</td>`;
        sectionsHtml += `<td style="width: 25%; padding: 6px 8px; border: 1px solid #000;">${item2 ? (item2.value || '-') : ''}</td>`;
        sectionsHtml += '</tr>';
      }
      sectionsHtml += '</tbody></table>';
    } else if (section.type === 'table' && section.headers && section.rows) {
      sectionsHtml += '<table style="width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #000; font-size: 9pt;">';
      sectionsHtml += '<thead><tr style="background-color: #f1f5f9;">';
      section.headers.forEach((h, hIdx) => {
        const width = section.colWidths?.[hIdx] ? `width: ${section.colWidths[hIdx]}%;` : '';
        sectionsHtml += `<th style="padding: 6px 8px; border: 1px solid #000; text-align: left; font-weight: bold; ${width}">${h}</th>`;
      });
      sectionsHtml += '</tr></thead><tbody>';
      section.rows.forEach((row, rIdx) => {
        const bg = rIdx % 2 === 1 ? 'background-color: #fafafa;' : 'background-color: #ffffff;';
        sectionsHtml += `<tr style="${bg}">`;
        row.forEach(cell => {
          sectionsHtml += `<td style="padding: 5px 8px; border: 1px solid #000; vertical-align: top;">${cell}</td>`;
        });
        sectionsHtml += '</tr>';
      });
      sectionsHtml += '</tbody></table>';
    } else if (section.type === 'bulletList' && section.bullets) {
      sectionsHtml += '<ul style="margin: 8px 0; padding-left: 24px;">';
      section.bullets.forEach(b => {
        sectionsHtml += `<li style="margin-bottom: 4px; font-size: ${fontSize}pt; line-height: 1.4;">${b}</li>`;
      });
      sectionsHtml += '</ul>';
    } else if (section.type === 'notice' && section.text) {
      sectionsHtml += `<div style="padding: 8px 12px; background-color: #f8fafc; border-left: 4px solid #1e293b; font-style: italic; font-size: 9.5pt; margin: 10px 0;">${section.text}</div>`;
    }
    sectionsHtml += '</div>';
  });

  let signaturesHtml = '';
  if (docDef.signatures && docDef.signatures.length > 0) {
    const colCount = Math.min(docDef.signatures.length, 4);
    const colWidth = Math.floor(100 / colCount);
    signaturesHtml += '<table style="width: 100%; border-collapse: collapse; border: none; margin-top: 35px; page-break-inside: avoid; break-inside: avoid;">';
    signaturesHtml += '<tr style="border: none;">';
    docDef.signatures.forEach(sig => {
      signaturesHtml += `
        <td style="width: ${colWidth}%; border: none; text-align: center; vertical-align: top; padding: 0 10px;">
          <div style="font-weight: bold; font-size: 9.5pt; text-transform: uppercase;">${sig.title}</div>
          <div style="height: 45px; display: flex; align-items: center; justify-content: center; font-style: italic; color: #94a3b8; font-size: 8.5pt;">(İmza / Mühür)</div>
          <div style="font-size: 9.5pt; font-weight: 600;">${sig.name || 'Yetkili'}</div>
          ${sig.duty ? `<div style="font-size: 8.5pt; color: #475569;">${sig.duty}</div>` : ''}
        </td>
      `;
    });
    signaturesHtml += '</tr></table>';
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${docDef.title}</title>
  <style>
    @page {
      size: A4 ${isLandscape ? 'landscape' : 'portrait'};
      margin-top: ${margins.top}mm !important;
      margin-bottom: ${margins.bottom}mm !important;
      margin-left: ${margins.left}mm !important;
      margin-right: ${margins.right}mm !important;
    }
    @media print {
      @page {
        size: A4 ${isLandscape ? 'landscape' : 'portrait'};
        margin-top: ${margins.top}mm !important;
        margin-bottom: ${margins.bottom}mm !important;
        margin-left: ${margins.left}mm !important;
        margin-right: ${margins.right}mm !important;
      }
    }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      color: #000000 !important;
      font-family: "Times New Roman", Times, "Liberation Serif", serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .print-doc-container {
      width: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      box-sizing: border-box !important;
    }
    table {
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
    .avoid-break, .signature-block {
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
    .print-hidden {
      display: none !important;
    }
  </style>
</head>
<body class="bg-white">
  <div class="print-doc-container">
    <!-- Header -->
    <div style="text-align: center; margin-bottom: 16px;">
      <div style="font-weight: bold; font-size: 11pt; text-transform: uppercase; white-space: pre-line; line-height: 1.3;">
        ${docDef.institutionName}
      </div>
      ${docDef.academicYear ? `<div style="font-size: 9.5pt; color: #475569; font-style: italic; margin-top: 3px;">${docDef.academicYear}</div>` : ''}
    </div>

    <!-- Title -->
    <div style="text-align: center; margin-bottom: 18px;">
      <h1 style="font-size: 12pt; font-weight: bold; text-transform: uppercase; margin: 0; padding: 0;">
        ${docDef.title}
      </h1>
      ${docDef.subtitle ? `<div style="font-size: 9.5pt; color: #475569; font-style: italic; margin-top: 3px;">${docDef.subtitle}</div>` : ''}
    </div>

    <!-- Code & Date -->
    ${(docDef.code || docDef.date) ? `
      <div style="display: flex; justify-content: space-between; border-bottom: 2px solid #000; padding-bottom: 5px; margin-bottom: 16px; font-size: 9.5pt; font-weight: bold;">
        <span>${docDef.code ? `Sayı / Kod: ${docDef.code}` : ''}</span>
        <span>${docDef.date ? `Tarih: ${docDef.date}` : ''}</span>
      </div>
    ` : ''}

    <!-- Sections -->
    ${sectionsHtml}

    <!-- Signatures -->
    ${signaturesHtml}

    <!-- Footer Note -->
    ${docDef.footerNote ? `
      <div style="margin-top: 30px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 8pt; color: #94a3b8;">
        <span>${docDef.footerNote}</span>
        <span>Resmi Belge Çıktısı</span>
      </div>
    ` : ''}
  </div>
</body>
</html>`;
};
