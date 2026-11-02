import * as XLSX from 'xlsx';
import { Student } from '../types';

export interface ColumnMapping {
  number?: number;
  tcNo?: number;
  name?: number; // Single cell Ad Soyad
  firstName?: number; // Sadece Ad
  lastName?: number; // Sadece Soyad
  grade?: number;
  mesemField?: number;
  mesemBranch?: number;
  companyName?: number;
  masterTrainer?: number;
  masterTrainerPhone?: number;
  coordinatorTeacher?: number;
  contractStatus?: number;
  insuranceStatus?: number;
  parentPhone?: number;
  address?: number;
  compoundCell?: number; // Tek hücrede birleşik veri (No - Ad - Sınıf - İşletme)
}

export interface DetectedColumn {
  index: number;
  sampleHeader: string;
  sampleValue: string;
  detectedField: string;
}

export interface ParseResult {
  students: Partial<Student>[];
  detectedColumns: DetectedColumn[];
  rawHeaders: string[];
  totalRows: number;
}

// Clean and normalize text
const cleanStr = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  return String(val).trim();
};

// Check if string looks like an 11-digit Turkish TC Kimlik No
export const isValidTcNo = (val: string): boolean => {
  const clean = val.replace(/\D/g, '');
  return clean.length === 11 && clean[0] !== '0';
};

// Intelligently parse a compound cell (e.g. "1452 - Ali Yılmaz - 10-MES - Elektrik - Yıldız Otomotiv")
export const parseCompoundCell = (cellValue: string): Partial<Student> => {
  const res: Partial<Student> = {
    isMesem: true,
    boardingStatus: 'GÜNDÜZLÜ',
    scholarshipStatus: 'BURSSUZ',
    contractStatus: 'Aktif'
  };

  const text = cleanStr(cellValue);
  if (!text) return res;

  // Split by common delimiters: -, |, /, ;, or newline
  const parts = text.split(/[-|/;,\n]+/).map(p => p.trim()).filter(Boolean);

  if (parts.length >= 1) {
    // If first part has digits, check for number
    const numMatch = parts[0].match(/\d+/);
    if (numMatch && parts[0].length < 10) {
      res.number = numMatch[0];
      if (parts.length > 1) res.name = parts[1];
    } else {
      res.name = parts[0];
    }
  }

  if (parts.length >= 3) {
    // Check if parts[2] is grade (e.g. 9-A, 10-MES, 11)
    if (/\d+/.test(parts[2]) && (parts[2].toLowerCase().includes('mes') || parts[2].includes('-') || parts[2].includes('/'))) {
      res.grade = parts[2];
      if (parts[3]) res.mesemField = parts[3];
      if (parts[4]) res.companyName = parts[4];
    } else {
      res.companyName = parts[2];
      if (parts[3]) res.mesemField = parts[3];
    }
  }

  return res;
};

// Auto-detect column mappings from header row and sample data
export const detectColumnMapping = (rows: unknown[][]): { mapping: ColumnMapping; headerRowIndex: number; headers: string[] } => {
  const mapping: ColumnMapping = {};
  let headerRowIndex = 0;
  let headers: string[] = [];

  // Look for header row in first 10 rows
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;

    const rowText = row.map(c => cleanStr(c).toLowerCase()).join(' ');
    
    // Check if this row looks like a header row
    const hasHeaderKeywords = 
      rowText.includes('no') || 
      rowText.includes('ad') || 
      rowText.includes('soyad') || 
      rowText.includes('işletme') || 
      rowText.includes('alan') || 
      rowText.includes('dal') ||
      rowText.includes('tc') ||
      rowText.includes('sınıf') ||
      rowText.includes('firma');

    if (hasHeaderKeywords) {
      headerRowIndex = r;
      headers = row.map(c => cleanStr(c));
      break;
    }
  }

  // If no header found, use row 0
  if (headers.length === 0 && rows.length > 0) {
    headers = (rows[0] || []).map((_, i) => `Sütun ${i + 1}`);
  }

  // Detect mapping from headers
  headers.forEach((h, idx) => {
    const lower = h.toLowerCase().replace(/[\s._\-/]/g, '');

    // TC Kimlik No
    if (lower === 'tc' || lower === 'tckimlik' || lower === 'tckimlikno' || lower === 'tcno' || lower === 'kimlikno') {
      if (mapping.tcNo === undefined) mapping.tcNo = idx;
    }
    // Okul No / Öğrenci No
    else if (lower === 'okulno' || lower === 'öğrencino' || lower === 'öğrno' || lower === 'ogrno' || lower === 'numara' || lower === 'no' || lower === 'öğrencisırano') {
      if (mapping.number === undefined) mapping.number = idx;
    }
    // Adı Soyadı (Tek Hücre)
    else if (lower === 'adısoyadı' || lower === 'adsoyad' || lower === 'öğrenciadısoyadı' || lower === 'öğrsoyadıadı' || lower === 'öğrencibilgisi' || lower === 'isimsoyisim') {
      if (mapping.name === undefined) mapping.name = idx;
    }
    // Sadece Soyadı
    else if (lower === 'soyadı' || lower === 'soyad' || lower === 'öğrencisoyadı' || lower === 'soyisim') {
      if (mapping.lastName === undefined) mapping.lastName = idx;
    }
    // Sadece Adı
    else if (lower === 'adı' || lower === 'ad' || lower === 'öğrenciadı' || lower === 'isim') {
      if (mapping.firstName === undefined) mapping.firstName = idx;
    }
    // Sınıf / Şube
    else if (lower.includes('sınıf') || lower.includes('sube') || lower.includes('şube')) {
      if (mapping.grade === undefined) mapping.grade = idx;
    }
    // Meslek Alanı
    else if (lower.includes('alan') && !lower.includes('dal')) {
      if (mapping.mesemField === undefined) mapping.mesemField = idx;
    }
    // Meslek Dalı
    else if (lower.includes('dal')) {
      if (mapping.mesemBranch === undefined) mapping.mesemBranch = idx;
    }
    // Alan / Dal Birleşik
    else if (lower.includes('alandal') || lower.includes('bölüm') || lower.includes('meslek')) {
      if (mapping.mesemField === undefined) mapping.mesemField = idx;
    }
    // İşletme / Firma
    else if (lower.includes('işletme') || lower.includes('firma') || lower.includes('işyeri') || lower.includes('kurum') || lower.includes('şirket') || lower.includes('pratikeğitim')) {
      if (mapping.companyName === undefined) mapping.companyName = idx;
    }
    // Usta Öğretici
    else if (lower.includes('usta') || lower.includes('eğitici')) {
      if (mapping.masterTrainer === undefined) mapping.masterTrainer = idx;
    }
    // Usta / İşletme Telefon
    else if ((lower.includes('tel') || lower.includes('telefon') || lower.includes('gsm')) && (lower.includes('usta') || lower.includes('iş') || lower.includes('firma'))) {
      if (mapping.masterTrainerPhone === undefined) mapping.masterTrainerPhone = idx;
    }
    // Genel Telefon / Veli Telefonu
    else if (lower.includes('tel') || lower.includes('telefon') || lower.includes('gsm') || lower.includes('iletişim')) {
      if (mapping.parentPhone === undefined) mapping.parentPhone = idx;
    }
    // Koordinatör Öğretmen
    else if (lower.includes('koordinatör') || lower.includes('danışman') || lower.includes('sorumluöğretmen')) {
      if (mapping.coordinatorTeacher === undefined) mapping.coordinatorTeacher = idx;
    }
    // Sözleşme Durumu
    else if (lower.includes('sözleşme') || lower.includes('durum')) {
      if (mapping.contractStatus === undefined) mapping.contractStatus = idx;
    }
    // Sigorta / SGK
    else if (lower.includes('sgk') || lower.includes('sigorta')) {
      if (mapping.insuranceStatus === undefined) mapping.insuranceStatus = idx;
    }
    // Adres
    else if (lower.includes('adres')) {
      if (mapping.address === undefined) mapping.address = idx;
    }
  });

  // Heuristic inspection on rows if certain key columns like TC or Number weren't found by headers
  if (rows.length > headerRowIndex + 1) {
    const sampleRow = rows[headerRowIndex + 1] || [];
    sampleRow.forEach((val, idx) => {
      const str = cleanStr(val);
      // Auto-detect TC if 11 digits
      if (mapping.tcNo === undefined && isValidTcNo(str)) {
        mapping.tcNo = idx;
      }
      // Auto-detect number if pure digits 1-5 chars and not TC
      else if (mapping.number === undefined && /^\d{1,5}$/.test(str)) {
        mapping.number = idx;
      }
    });
  }

  return { mapping, headerRowIndex, headers };
};

// Process Excel raw 2D array into student list with given or detected mapping
export const parseMesemRows = (
  rows: unknown[][], 
  customMapping?: ColumnMapping, 
  customHeaderIndex?: number,
  fallbackGrade?: string
): ParseResult => {
  if (!rows || rows.length === 0) {
    return { students: [], detectedColumns: [], rawHeaders: [], totalRows: 0 };
  }

  const { mapping: autoMapping, headerRowIndex: autoHeaderIndex, headers } = detectColumnMapping(rows);
  const mapping = customMapping || autoMapping;
  const startRow = (customHeaderIndex !== undefined ? customHeaderIndex : autoHeaderIndex) + 1;

  const students: Partial<Student>[] = [];

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    // Check if entire row is empty
    const rowNonEmpty = row.some(c => cleanStr(c) !== '');
    if (!rowNonEmpty) continue;

    // Skip summary / footer rows
    const firstCell = cleanStr(row[0]).toLowerCase();
    if (firstCell.includes('toplam') || firstCell.includes('öğrenci sayısı') || firstCell.includes('genel toplam')) {
      continue;
    }

    let number = mapping.number !== undefined ? cleanStr(row[mapping.number]) : '';
    let name = '';
    let tcNo = mapping.tcNo !== undefined ? cleanStr(row[mapping.tcNo]).replace(/\D/g, '') : '';
    let grade = mapping.grade !== undefined ? cleanStr(row[mapping.grade]) : (fallbackGrade || 'MESEM');
    let mesemField = mapping.mesemField !== undefined ? cleanStr(row[mapping.mesemField]) : '';
    let mesemBranch = mapping.mesemBranch !== undefined ? cleanStr(row[mapping.mesemBranch]) : '';
    let companyName = mapping.companyName !== undefined ? cleanStr(row[mapping.companyName]) : '';
    let masterTrainer = mapping.masterTrainer !== undefined ? cleanStr(row[mapping.masterTrainer]) : '';
    const masterTrainerPhone = mapping.masterTrainerPhone !== undefined ? cleanStr(row[mapping.masterTrainerPhone]) : '';
    const coordinatorTeacher = mapping.coordinatorTeacher !== undefined ? cleanStr(row[mapping.coordinatorTeacher]) : '';
    const contractStatus = mapping.contractStatus !== undefined ? cleanStr(row[mapping.contractStatus]) : 'Aktif';
    const insuranceStatus = mapping.insuranceStatus !== undefined ? cleanStr(row[mapping.insuranceStatus]) : 'Giriş Yapıldı';
    const parentPhone = mapping.parentPhone !== undefined ? cleanStr(row[mapping.parentPhone]) : '';
    const address = mapping.address !== undefined ? cleanStr(row[mapping.address]) : '';

    // Handle Compound Cell if specified
    if (mapping.compoundCell !== undefined && row[mapping.compoundCell]) {
      const compoundData = parseCompoundCell(cleanStr(row[mapping.compoundCell]));
      if (!number && compoundData.number) number = compoundData.number;
      if (!name && compoundData.name) name = compoundData.name;
      if (!grade && compoundData.grade) grade = compoundData.grade;
      if (!mesemField && compoundData.mesemField) mesemField = compoundData.mesemField;
      if (!companyName && compoundData.companyName) companyName = compoundData.companyName;
    }

    // Name extraction logic
    if (mapping.name !== undefined && row[mapping.name]) {
      // Single cell has Full Name (Adı Soyadı)
      name = cleanStr(row[mapping.name]);
    } else if (mapping.firstName !== undefined || mapping.lastName !== undefined) {
      // Separate firstName and lastName cells
      const first = mapping.firstName !== undefined ? cleanStr(row[mapping.firstName]) : '';
      const last = mapping.lastName !== undefined ? cleanStr(row[mapping.lastName]) : '';
      name = `${first} ${last}`.trim();
    }

    // If name is still empty, scan row for candidate name (Turkish letters, not purely numbers, not known status words)
    if (!name) {
      for (let c = 0; c < row.length; c++) {
        const val = cleanStr(row[c]);
        // If it's not number, not TC, has at least one space or length > 3 and not a standard keyword
        if (val && !/^\d+$/.test(val) && val.length > 2 && c !== mapping.companyName && c !== mapping.coordinatorTeacher && c !== mapping.mesemField) {
          name = val;
          break;
        }
      }
    }

    // If number is still empty, generate or scan
    if (!number) {
      for (let c = 0; c < row.length; c++) {
        const val = cleanStr(row[c]);
        if (/^\d{1,6}$/.test(val) && val !== tcNo) {
          number = val;
          break;
        }
      }
    }

    // If TC wasn't mapped, scan for 11 digits
    if (!tcNo) {
      for (let c = 0; c < row.length; c++) {
        const val = cleanStr(row[c]);
        if (isValidTcNo(val)) {
          tcNo = val;
          break;
        }
      }
    }

    // Clean up grade format
    if (grade) {
      const match = grade.match(/(\d+)\s*[-/.]?\s*([A-Za-zÇĞİÖŞÜçğıöşü]+)?/);
      if (match) {
        const classNum = match[1];
        const branchLetter = match[2] ? match[2].toUpperCase() : 'MES';
        if (!grade.toUpperCase().includes('MES') && !branchLetter.includes('MES')) {
          grade = `${classNum}-MES-${branchLetter}`;
        }
      }
    } else {
      grade = fallbackGrade || '9-MES';
    }

    // If Alan/Dal were stored together in one cell (e.g. "Elektrik-Elektronik / Pano Montörlüğü")
    if (mesemField && !mesemBranch && (mesemField.includes('/') || mesemField.includes('-') || mesemField.includes('>'))) {
      const fieldParts = mesemField.split(/[/\\>|-]+/).map(p => p.trim());
      if (fieldParts.length > 1) {
        mesemField = fieldParts[0];
        mesemBranch = fieldParts.slice(1).join(' - ');
      }
    }

    // If companyName has master trainer in parentheses (e.g. "ABC Oto Servisi (Usta: Ali Vural)")
    if (companyName && !masterTrainer && companyName.includes('(')) {
      const m = companyName.match(/^(.*?)\((?:usta|yetkili)?\s*:?\s*(.*?)\)/i);
      if (m) {
        companyName = m[1].trim();
        masterTrainer = m[2].trim();
      }
    }

    // Ensure we have a valid student record (must have at least a Name or a Number)
    if (name || number) {
      // Fallback number if none found
      if (!number) {
        number = `M${Math.floor(1000 + Math.random() * 9000)}`;
      }

      students.push({
        id: Math.random().toString(36).substring(2, 11),
        number,
        name: name || 'İsimsiz Öğrenci',
        grade,
        tcNo: tcNo || undefined,
        isMesem: true,
        mesemField: mesemField || 'Genel Mesleki Eğitim',
        mesemBranch: mesemBranch || undefined,
        companyName: companyName || 'Belirtilmedi',
        masterTrainer: masterTrainer || undefined,
        masterTrainerPhone: masterTrainerPhone || undefined,
        coordinatorTeacher: coordinatorTeacher || undefined,
        contractStatus: contractStatus || 'Aktif',
        insuranceStatus: insuranceStatus || 'Aktif',
        parentPhone: parentPhone || undefined,
        address: address || undefined,
        boardingStatus: 'GÜNDÜZLÜ',
        scholarshipStatus: 'BURSSUZ'
      });
    }
  }

  // Build detected columns list for user inspection
  const detectedColumns: DetectedColumn[] = headers.map((header, idx) => {
    let sampleVal = '';
    for (let r = startRow; r < Math.min(startRow + 3, rows.length); r++) {
      if (rows[r] && rows[r][idx]) {
        sampleVal = cleanStr(rows[r][idx]);
        break;
      }
    }

    let detectedField = 'ignore';
    if (mapping.number === idx) detectedField = 'number';
    else if (mapping.tcNo === idx) detectedField = 'tcNo';
    else if (mapping.name === idx) detectedField = 'name';
    else if (mapping.firstName === idx) detectedField = 'firstName';
    else if (mapping.lastName === idx) detectedField = 'lastName';
    else if (mapping.grade === idx) detectedField = 'grade';
    else if (mapping.mesemField === idx) detectedField = 'mesemField';
    else if (mapping.mesemBranch === idx) detectedField = 'mesemBranch';
    else if (mapping.companyName === idx) detectedField = 'companyName';
    else if (mapping.masterTrainer === idx) detectedField = 'masterTrainer';
    else if (mapping.masterTrainerPhone === idx) detectedField = 'masterTrainerPhone';
    else if (mapping.coordinatorTeacher === idx) detectedField = 'coordinatorTeacher';
    else if (mapping.contractStatus === idx) detectedField = 'contractStatus';
    else if (mapping.parentPhone === idx) detectedField = 'parentPhone';
    else if (mapping.compoundCell === idx) detectedField = 'compoundCell';

    return {
      index: idx,
      sampleHeader: header || `Sütun ${idx + 1}`,
      sampleValue: sampleVal,
      detectedField
    };
  });

  return {
    students,
    detectedColumns,
    rawHeaders: headers,
    totalRows: rows.length
  };
};

// Generate a rich, realistic MESEM Excel sample template file
export const generateSampleMesemExcel = (): void => {
  const sampleData = [
    {
      "Öğrenci No": "1001",
      "T.C. Kimlik No": "12345678901",
      "Adı Soyadı": "Emre Korkmaz",
      "Sınıf": "10-MES-A",
      "Meslek Alanı": "Elektrik-Elektronik Teknolojisi",
      "Meslek Dalı": "Elektrik Tesisatları ve Dağıtımı",
      "İşletme / Firma Adı": "Yıldız Pano & Elektrik Ltd. Şti.",
      "Usta Öğretici": "Mustafa Yıldız",
      "İşletme Telefonu": "0212 555 12 34",
      "Koordinatör Öğretmen": "Kemal Demir",
      "Sözleşme Durumu": "Aktif",
      "Sigorta / SGK": "Giriş Yapıldı"
    },
    {
      "Öğrenci No": "1002",
      "T.C. Kimlik No": "23456789012",
      "Adı Soyadı": "Burak Çelik",
      "Sınıf": "10-MES-B",
      "Meslek Alanı": "Motorlu Araçlar Teknolojisi",
      "Meslek Dalı": "Otomotiv Mekanikerliği",
      "İşletme / Firma Adı": "Özdemir Yetkili Servisi",
      "Usta Öğretici": "Ali Özdemir",
      "İşletme Telefonu": "0532 444 88 99",
      "Koordinatör Öğretmen": "Kemal Demir",
      "Sözleşme Durumu": "Aktif",
      "Sigorta / SGK": "Giriş Yapıldı"
    },
    {
      "Öğrenci No": "1003",
      "T.C. Kimlik No": "34567890123",
      "Adı Soyadı": "Zeynep Aslan",
      "Sınıf": "11-MES-A",
      "Meslek Alanı": "Güzellik ve Saç Bakım Hizmetleri",
      "Meslek Dalı": "Kadın Kuaförlüğü",
      "İşletme / Firma Adı": "Elit Kuaför & Güzellik Salonu",
      "Usta Öğretici": "Sevgi Karaca",
      "İşletme Telefonu": "0542 333 22 11",
      "Koordinatör Öğretmen": "Ayşe Yılmaz",
      "Sözleşme Durumu": "Aktif",
      "Sigorta / SGK": "Giriş Yapıldı"
    },
    {
      "Öğrenci No": "1004",
      "T.C. Kimlik No": "45678901234",
      "Adı Soyadı": "Mert Aydın",
      "Sınıf": "11-MES-B",
      "Meslek Alanı": "Makine ve Tasarım Teknolojisi",
      "Meslek Dalı": "CNC Torna / Freze Operatörlüğü",
      "İşletme / Firma Adı": "Demirler Hassas Makine Sanayi",
      "Usta Öğretici": "Hasan Demir",
      "İşletme Telefonu": "0216 777 66 55",
      "Koordinatör Öğretmen": "Kemal Demir",
      "Sözleşme Durumu": "Aktif",
      "Sigorta / SGK": "Giriş Yapıldı"
    },
    {
      "Öğrenci No": "1005",
      "T.C. Kimlik No": "56789012345",
      "Adı Soyadı": "Seda Şahin",
      "Sınıf": "9-MES-A",
      "Meslek Alanı": "Yiyecek İçecek Hizmetleri",
      "Meslek Dalı": "Aşçılık ve Pastacılık",
      "İşletme / Firma Adı": "Boğaziçi Gurme Restoran",
      "Usta Öğretici": "Şef Mehmet Usta",
      "İşletme Telefonu": "0212 888 99 00",
      "Koordinatör Öğretmen": "Ayşe Yılmaz",
      "Sözleşme Durumu": "Aktif",
      "Sigorta / SGK": "Giriş Yapıldı"
    }
  ];

  // Also alternative format sheet: separate Ad / Soyad
  const sampleSplitNames = [
    {
      "Okul No": "2001",
      "T.C. Kimlik": "67890123456",
      "Öğrenci Adı": "Hakan",
      "Öğrenci Soyadı": "Yıldırım",
      "Sınıf": "10-MES",
      "Alan": "Bilişim Teknolojileri",
      "Dal": "Ağ İşletmenliği",
      "İşletme": "Netcom Bilişim Çözümleri",
      "Usta": "Murat Bey",
      "İletişim": "0555 123 45 67",
      "Koordinatör": "Selim Hoca"
    },
    {
      "Okul No": "2002",
      "T.C. Kimlik": "78901234567",
      "Öğrenci Adı": "Cemile",
      "Öğrenci Soyadı": "Güneş",
      "Sınıf": "11-MES",
      "Alan": "Muhasebe ve Finansman",
      "Dal": "Bilgisayarlı Muhasebe",
      "İşletme": "Erenler Mali Müşavirlik",
      "Usta": "Osman Eren",
      "İletişim": "0212 999 88 77",
      "Koordinatör": "Selim Hoca"
    }
  ];

  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(sampleData);
  XLSX.utils.book_append_sheet(wb, ws1, "MESEM Standart Liste");

  const ws2 = XLSX.utils.json_to_sheet(sampleSplitNames);
  XLSX.utils.book_append_sheet(wb, ws2, "Ayrı Ad-Soyad Formatı");

  XLSX.writeFile(wb, "MESEM_Ogrenci_Yukleme_Sablonu.xlsx");
};
