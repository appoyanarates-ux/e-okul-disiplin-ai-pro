
export interface Student {
  id: string;
  number: string; // Okul No
  name: string; // Adı + Soyadı
  grade: string; // Kabul Ed. Sınıf
  
  // Kimlik Bilgileri
  tcNo?: string; // T.C. Kimlik No
  fatherName?: string; // Baba Adı
  motherName?: string; // Anne Adı
  birthPlaceDate?: string; // Doğum Yeri , Tarihi
  province?: string; // İli
  district?: string; // İlçesi
  neighborhood?: string; // Mahalle / Köy
  volumeNo?: string; // Cilt No
  familyOrderNo?: string; // Aile Sıra No
  orderNo?: string; // Sıra No
  
  // Okul Bilgileri
  registrationType?: string; // Yeni Kayıt / Nakil
  previousSchoolInfo?: string; // Get. Öğr. Belgesi
  registrationDate?: string; // Tarih / Numarası
  parentName?: string; // Veli Adı, Soyadı
  examStatus?: string; // Sınavlı/Sınavsız
  boardingStatus?: string; // Yatılı/Gündüzlü
  scholarshipStatus?: string; // Bursluluk Durumu
  gender?: string; // Cinsiyeti
  healthStatus?: string; // Sağlık Durumu
  address?: string; // Adresi
  parentPhone?: string; // Telefon

  // MESEM (Mesleki Eğitim Merkezi) Bilgileri
  isMesem?: boolean; // MESEM Öğrencisi mi?
  mesemField?: string; // Meslek Alanı (Örn: Elektrik-Elektronik, Makine, Motorlu Araçlar)
  mesemBranch?: string; // Meslek Dalı (Örn: Elektrik Tesisatları, Otomotiv Mekanikeri)
  companyName?: string; // İşletme / Firma Adı
  companyAddress?: string; // İşletme Adresi
  companyPhone?: string; // İşletme Telefonu
  masterTrainer?: string; // Usta Öğretici Adı Soyadı
  masterTrainerPhone?: string; // Usta Öğretici Telefonu
  coordinatorTeacher?: string; // Koordinatör Öğretmen
  contractStatus?: string; // Sözleşme Durumu (Aktif, Askıda, Fesih, Tamamlandı)
  contractStartDate?: string; // Sözleşme Başlangıç
  contractEndDate?: string; // Sözleşme Bitiş
  insuranceStatus?: string; // SGK / Sigorta Durumu
  mesemNotes?: string; // MESEM Notları

  previousPenalties?: Array<{
    id: string;
    decision: string; // KINAMA, UYARMA, vb.
    decisionNo?: string;
    date?: string;
    penaltyScore?: string;
    description?: string;
    isRemoved?: boolean;
    removedDecisionNo?: string;
    removedDate?: string;
    removedReason?: string;
  }>;
  customDocuments?: Record<string, string>; // Olay seçilmediğinde kaydedilen evraklar
}

export interface InvolvedStudent {
  studentId: string;
  role: 'suspect' | 'witness' | 'victim'; // Fail, Tanık, Mağdur
  notes?: string; // Öğrenciye özel not
  studentStatement?: string; // Öğrenci İfadesi
  studentDefense?: string; // Öğrenci Savunması
  customDocuments?: Record<string, string>; // Kaydedilen evrak şablon/içerikleri (docType -> html)
  
  // Karar Bilgileri (Yaptırım)
  decision?: string; // Örn: KINAMA, UYARI, OKULDAN UZAKLAŞTIRMA, CEZA ALMADI
  decisionNo?: string; // Karar No
  decisionDate?: string; // Karar Tarihi
  decisionReason?: string; // Gerekçe / Nedenler
  penaltyScore?: string; // Davranış Puanı İndirimi (Örn: 10)

  // AI Analiz Sonucu
  aiAnalysis?: string; 

  // Ceza Kaldırma Bilgileri
  isRemoved?: boolean;
  removedDecisionNo?: string;
  removedDate?: string;
  removedReason?: string;
}

export interface Incident {
  id: string;
  code: string; // OLAY2024-001
  title: string; // Olay Adı
  date: string;
  time: string;
  location: string;
  description: string; // Olayın Özeti
  status: 'pending' | 'investigating' | 'decided' | 'archived';
  involvedStudents: InvolvedStudent[]; // Olaya karışanlar
  petitioner?: string; // Dilekçeyi veren kişi
  petitionerInfo?: string; // Dilekçe Tarih/Sayı
  mitigatingFactors?: string; // Yaptırımı hafifleten nedenler
  useMitigatingFactors?: boolean; // Tebligat ve Kararda kullanılsın mı?
}

export interface RegulationArticle {
  id: string;
  code: string;
  title: string;
  description: string;
  penaltyLevel: string;
}

// Chart data types
export interface StatData {
  name: string;
  value: number;
}

// Institution Settings
export interface Institution {
  name: string;
  code: string;
  type: string; // Ortaokul, Lise, Meslek Lisesi, İmam Hatip, MESEM
  year: string; // 2023-2024
  province: string;
  district: string;
  managerName: string; // Müdür Adı
  address: string;
  phone: string;
  fax: string;
  headerText: string; // Kurum Anteti
  ebysCode: string; // Yazılı Uyarı Bildirimi EBYS Sayısı
}

export interface BoardMember {
  id: string;
  role: string; // Başkan, Üye 1, Üye 2, Veli Üye
  mainName: string; // Asil Adı Soyadı
  mainTitle: string; // Asil Ünvan
  reserveName: string; // Yedek Adı Soyadı
  reserveTitle: string; // Yedek Ünvan
}

// --- WORD / OFFICE PAGE MARGIN PRESETS (MEB & Standart Kurallar) ---
export type MarginType = 'normal' | 'official' | 'narrow' | 'compact';

export interface PageMargin {
  id: MarginType;
  name: string;
  badge: string;
  top: number;    // mm
  bottom: number; // mm
  left: number;   // mm
  right: number;  // mm
  description: string;
}

export const PAGE_MARGINS: Record<MarginType, PageMargin> = {
  normal: {
    id: 'normal',
    name: 'Normal (Word Standart)',
    badge: 'Word Standart 2.5 cm',
    top: 25,
    bottom: 25,
    left: 25,
    right: 25,
    description: 'Üst: 2.5 cm • Alt: 2.5 cm • Sol: 2.5 cm • Sağ: 2.5 cm (Microsoft Office Varsayılanı)'
  },
  official: {
    id: 'official',
    name: 'Resmi Yazışma (MEB)',
    badge: 'MEB 2.5 / 2.0 cm',
    top: 25,
    bottom: 25,
    left: 25,
    right: 20,
    description: 'Üst: 2.5 cm • Alt: 2.5 cm • Sol: 2.5 cm • Sağ: 2.0 cm (Resmi Kurum Şablonu)'
  },
  narrow: {
    id: 'narrow',
    name: 'Dar (Word Dar)',
    badge: 'Word Dar 1.27 cm',
    top: 12.7,
    bottom: 12.7,
    left: 12.7,
    right: 12.7,
    description: 'Üst: 1.27 cm • Alt: 1.27 cm • Sol: 1.27 cm • Sağ: 1.27 cm'
  },
  compact: {
    id: 'compact',
    name: 'Kompakt (Sığdırma)',
    badge: 'Kompakt 1.0 cm',
    top: 10,
    bottom: 10,
    left: 12,
    right: 12,
    description: 'Üst: 1.0 cm • Alt: 1.0 cm • Sol: 1.2 cm • Sağ: 1.2 cm (Tek Sayfaya Sığdırma)'
  }
};

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      platform: string;
      version: string;
      author: string;
      appName: string;
      printToPdf: (options?: {
        html?: string;
        landscape?: boolean;
        pageSize?: string;
        saveDialog?: boolean;
        defaultPath?: string;
        title?: string;
        margins?: { marginType?: string; top?: number; bottom?: number; left?: number; right?: number };
      }) => Promise<{ success: boolean; data?: Uint8Array; filePath?: string; canceled?: boolean; error?: string }>;
      printDirect: (options?: {
        html?: string;
        silent?: boolean;
        landscape?: boolean;
        pageSize?: string;
        deviceName?: string;
        copies?: number;
      }) => Promise<{ success: boolean; error?: string }>;
      saveFile: (options: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }>; data: Uint8Array | string }) => Promise<{ success: boolean; filePath?: string; canceled?: boolean; error?: string }>;
      showSaveDialog: (options?: { title?: string; defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<{ canceled: boolean; filePath?: string }>;
      openFileDialog: (options?: any) => Promise<{ canceled: boolean; filePaths: string[]; content?: string; buffer?: Uint8Array; error?: string }>;
      getUserDataPath: () => Promise<string>;
      readAppData: () => Promise<{ success: boolean; data?: any; error?: string }>;
      writeAppData: (data: any) => Promise<{ success: boolean; error?: string }>;
      listBackups: () => Promise<{ success: boolean; backups?: Array<{ name: string; date: string; size: number }>; error?: string }>;
      restoreBackup: (fileName: string) => Promise<{ success: boolean; data?: any; error?: string }>;
      createBackupNow: (data: any, note?: string) => Promise<{ success: boolean; filename?: string; targetPath?: string; error?: string }>;
      openExternal: (url: string) => Promise<void>;
      downloadUpdate: (options: { url: string; filename?: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
      quitAndInstall: (filePath: string) => Promise<{ success: boolean; error?: string }>;
      onUpdateProgress: (callback: (data: { percent: number; transferred: number; total: number; speed: number }) => void) => () => void;
    };
  }
}
