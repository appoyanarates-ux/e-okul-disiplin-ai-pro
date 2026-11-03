import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { Student } from '../types';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
}

export interface StudentColumnMapping {
  number?: number;
  tcNo?: number;
  fullName?: number;
  firstName?: number;
  lastName?: number;
  grade?: number;
  fatherName?: number;
  motherName?: number;
  birthPlace?: number;
  birthDate?: number;
  gender?: number;
  parentName?: number;
  parentPhone?: number;
  address?: number;
  boardingStatus?: number;
  scholarshipStatus?: number;
  registrationType?: number;
  registrationDate?: number;
  province?: number;
  district?: number;
  neighborhood?: number;
  volumeNo?: number;
  familyOrderNo?: number;
  orderNo?: number;
}

export interface ParsedStudentWithStats extends Partial<Student> {
  _extractedFieldCount?: number;
  _sourceFormat?: 'card' | 'tabular' | 'pdf-card' | 'pdf-table' | 'paste-card' | 'paste-table';
}

export interface ParseFileResult {
  students: ParsedStudentWithStats[];
  formatDetected: 'card' | 'tabular' | 'pdf-card' | 'pdf-table' | 'paste-card' | 'paste-table';
  fileName: string;
  totalStudents: number;
  detectedColumns?: { index: number; header: string; mappedField: string }[];
  rawHeaders?: string[];
  rawRows?: unknown[][];
  extractedFieldsSummary: {
    withTc: number;
    withGrade: number;
    withParents: number;
    withContact: number;
    withAddress: number;
    withBirthInfo: number;
  };
}

// Clean and normalize text
export const cleanStr = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();
};

// Turkish-aware lowercasing helper
export const cleanTurkish = (str: unknown): string => {
  return cleanStr(str)
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .replace(/Ğ/g, 'ğ')
    .replace(/Ü/g, 'ü')
    .replace(/Ş/g, 'ş')
    .replace(/Ö/g, 'ö')
    .replace(/Ç/g, 'ç')
    .toLowerCase()
    .trim();
};

// Turkish uppercase helper
export const toTurkishUpper = (str: string): string => {
  return str.toLocaleUpperCase('tr-TR').trim();
};

// Normalize numeric strings: remove trailing .0 from Excel e.g. "71.0" -> "71", "17012964572.0" -> "17012964572"
export const cleanNumberStr = (val: unknown): string => {
  if (val === null || val === undefined) return '';
  let s = cleanStr(val);
  s = s.replace(/\.0+$/, '');
  return s;
};

// Check if a line or cell looks like an e-Okul label header
export const isHeaderLabel = (str: unknown): boolean => {
  const cl = cleanTurkish(str).replace(/[:\s]/g, '');
  if (!cl) return false;
  const labels = [
    'okulno', 'ogrencino', 'adi', 'soyadi', 'babaadi', 'anneadi',
    'dogumyeri', 'dogumtarihi', 'dogumyeritarihi', 'nufuskimlikbilgileri',
    'tckimlikno', 'ciltno', 'ili', 'ilcesi', 'ailesirano', 'sirano',
    'bireysirano', 'mahallekoy', 'vernufusidaresi', 'cuzkayno', 'verilistarihi',
    'okulbilgileri', 'yenikayitnakil', 'kabuledsinif', 'kabuledilensinif',
    'sinif', 'sinifi', 'getogrbelgesi', 'sinavlisinavsiz', 'tarihnumarasi',
    'yatiligunduzlu', 'veliadisoyadi', 'veliadi', 'burslulukdurumu',
    'nakilgelmiseokulutarihi', 'adresi', 'ogrencininbasaridurumu', 'kunyedefteri'
  ];
  return labels.some(l => cl === l || cl.startsWith(l));
};

// Lookahead helper: Get next non-empty, non-header line value
export const getNextValue = (lines: string[], startIdx: number, maxLookahead = 3): string | null => {
  for (let i = startIdx + 1; i < Math.min(lines.length, startIdx + 1 + maxLookahead); i++) {
    const l = cleanStr(lines[i]);
    if (!l) continue;
    if (isHeaderLabel(l)) return null;
    return l;
  }
  return null;
};

// Check if string is an 11-digit Turkish TC Kimlik No
export const is11DigitTc = (val: string): boolean => {
  if (!val) return false;
  const cleaned = cleanNumberStr(val);
  const digits = cleaned.replace(/\D/g, '');
  return digits.length === 11 && digits[0] !== '0';
};

// Normalize Turkish phone number
export const normalizePhone = (val: string): string => {
  if (!val) return '';
  const digits = val.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('5')) {
    return `0${digits.substring(0, 3)} ${digits.substring(3, 6)} ${digits.substring(6, 8)} ${digits.substring(8, 10)}`;
  }
  if (digits.length === 11 && digits.startsWith('05')) {
    return `${digits.substring(0, 4)} ${digits.substring(4, 7)} ${digits.substring(7, 9)} ${digits.substring(9, 11)}`;
  }
  return cleanStr(val);
};

// Normalize Grade string e.g. "5. Sınıf / A Şubesi" -> "5-A", "9/A" -> "9-A"
export const normalizeGrade = (rawGrade: string): string => {
  if (!rawGrade) return '';
  const g = cleanStr(rawGrade);

  // Match e.g. "5. Sınıf / A Şubesi", "9. Sınıf - B Şubesi", "10. Sınıf A Şubesi"
  const mebLongMatch = g.match(/(\d+)\s*\.?\s*Sınıf.*?([A-ZÇĞİÖŞÜa-zçğıöşü]+)\s*Şubesi/i);
  if (mebLongMatch) {
    return `${mebLongMatch[1]}-${mebLongMatch[2].toLocaleUpperCase('tr-TR')}`;
  }

  // Match e.g. "9/A", "10-B", "5/A", "12-MES-A"
  const slashDashMatch = g.match(/(\d{1,2})\s*[/ -]\s*([A-Za-z0-9ÇĞİÖŞÜçğıöşü-]+)/);
  if (slashDashMatch) {
    return `${slashDashMatch[1]}-${slashDashMatch[2].toLocaleUpperCase('tr-TR')}`;
  }

  // Match e.g. "9A", "10B", "5A"
  const shortMatch = g.match(/^(\d{1,2})\s*([A-Za-zÇĞİÖŞÜçğıöşü])$/);
  if (shortMatch) {
    return `${shortMatch[1]}-${shortMatch[2].toLocaleUpperCase('tr-TR')}`;
  }

  return g.replace(/\s+/g, ' ');
};

// Count how many identity fields were successfully populated
export const countExtractedFields = (s: Partial<Student>): number => {
  let count = 0;
  if (s.number) count++;
  if (s.name) count++;
  if (s.tcNo) count++;
  if (s.grade) count++;
  if (s.fatherName) count++;
  if (s.motherName) count++;
  if (s.birthPlaceDate) count++;
  if (s.gender) count++;
  if (s.province || s.district) count++;
  if (s.neighborhood) count++;
  if (s.parentName) count++;
  if (s.parentPhone) count++;
  if (s.address) count++;
  if (s.boardingStatus) count++;
  if (s.scholarshipStatus) count++;
  if (s.registrationType || s.registrationDate) count++;
  if (s.volumeNo || s.familyOrderNo || s.orderNo) count++;
  return count;
};

/**
 * Universal Single Student Block Parser:
 * Capable of parsing:
 * 1. e-Okul Künye Defteri PDF (where labels are followed by a list of values, or on separate lines)
 * 2. e-Okul Künye Defteri Excel (.xlsx/.xls/.csv, supporting 1, 2, or more side-by-side student cards)
 * 3. Direct copied/pasted text from Excel or PDF
 */
export const parseSingleStudentBlock = (lines: string[], rawRows?: unknown[][]): Partial<Student> => {
  const text = lines.join('\n');
  const student: Partial<Student> = {
    id: Math.random().toString(36).substring(2, 11),
    boardingStatus: 'GÜNDÜZLÜ',
    scholarshipStatus: 'BURSSUZ'
  };

  // 1. TC Kimlik No (11 digits anywhere in block, handling trailing .0)
  const tcMatch = text.match(/\b([1-9]\d{10})(?:\.0+)?\b/);
  if (tcMatch) student.tcNo = tcMatch[1];

  // 2. Kabul Edilen Sınıf / Sınıfı
  const gradeMatch =
    text.match(/(\d{1,2})\s*\.?\s*Sınıf.*?([A-ZÇĞİÖŞÜa-zçğıöşü]+)\s*Şubesi/i) ||
    text.match(/(?:kabul\s*ed.*?sınıf|sınıfı?)[:\s\t]+(\d{1,2}\s*[/ -]\s*[A-Za-z0-9]+)/i);
  if (gradeMatch) {
    student.grade = normalizeGrade(gradeMatch[0]);
  }

  // 3. Scan lines for Same-line / Tab-delimited / Lookahead Key-Value pairs
  let firstName = '';
  let lastName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cl = cleanTurkish(line);
    const parts = line.split('\t').map(p => cleanStr(p)).filter(Boolean);

    // Okul No
    if (!student.number && (cl.includes('okul no') || cl.includes('öğrenci no') || cl.startsWith('no:'))) {
      const m = line.match(/(?:okul|öğrenci)?\s*no\s*[:\s\t]+(\d+(?:\.0+)?)/i);
      if (m) {
        student.number = cleanNumberStr(m[1]);
      } else if (parts.length >= 2) {
        const candidate = cleanNumberStr(parts[1]);
        if (/^\d+$/.test(candidate)) student.number = candidate;
      }
      if (!student.number) {
        const nextVal = getNextValue(lines, i);
        if (nextVal) {
          const cand = cleanNumberStr(nextVal);
          if (/^\d+$/.test(cand)) student.number = cand;
        }
      }
    }

    // Adı
    if (!firstName && (cl.startsWith('adı:') || cl.startsWith('adi:') || cl === 'adı' || cl === 'adi' || cl.startsWith('adı ') || cl.startsWith('adi '))) {
      const m = line.match(/(?:adı|adi)[:\s\t]+([A-Za-zÇĞİÖŞÜçğıöşü\s]+)$/i);
      if (m && !cleanTurkish(m[1]).includes('soyad')) {
        firstName = m[1].trim();
      } else if (parts.length >= 2 && !cleanTurkish(parts[1]).includes('soyad')) {
        firstName = parts[1];
      }
      if (!firstName) {
        const nextVal = getNextValue(lines, i);
        if (nextVal && !isHeaderLabel(nextVal) && /^[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/.test(nextVal)) {
          firstName = nextVal.trim();
        }
      }
    }

    // Soyadı
    if (!lastName && (cl.startsWith('soyadı:') || cl.startsWith('soyadi:') || cl === 'soyadı' || cl === 'soyadi' || cl.startsWith('soyadı ') || cl.startsWith('soyadi '))) {
      const m = line.match(/(?:soyadı|soyadi)[:\s\t]+([A-Za-zÇĞİÖŞÜçğıöşü\s]+)$/i);
      if (m) {
        lastName = m[1].trim();
      } else if (parts.length >= 2) {
        lastName = parts[1];
      }
      if (!lastName) {
        const nextVal = getNextValue(lines, i);
        if (nextVal && !isHeaderLabel(nextVal) && /^[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/.test(nextVal)) {
          lastName = nextVal.trim();
        }
      }
    }

    // Baba Adı
    if (!student.fatherName && cl.includes('baba adı')) {
      const m = line.match(/baba\s*adı[:\s\t]+([A-Za-zÇĞİÖŞÜçğıöşü\s]+)$/i);
      if (m) {
        student.fatherName = m[1].trim();
      } else if (parts.length >= 2) {
        student.fatherName = parts[1];
      }
      if (!student.fatherName) {
        const nextVal = getNextValue(lines, i);
        if (nextVal && !isHeaderLabel(nextVal) && /^[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/.test(nextVal)) {
          student.fatherName = nextVal.trim();
        }
      }
    }

    // Anne Adı
    if (!student.motherName && cl.includes('anne adı')) {
      const m = line.match(/anne\s*adı[:\s\t]+([A-Za-zÇĞİÖŞÜçğıöşü\s]+)$/i);
      if (m) {
        student.motherName = m[1].trim();
      } else if (parts.length >= 2) {
        student.motherName = parts[1];
      }
      if (!student.motherName) {
        const nextVal = getNextValue(lines, i);
        if (nextVal && !isHeaderLabel(nextVal) && /^[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/.test(nextVal)) {
          student.motherName = nextVal.trim();
        }
      }
    }

    // Doğum Yeri / Tarihi
    if (!student.birthPlaceDate && cl.includes('doğum yeri')) {
      const afterColon = line.split(/[:\t]+/);
      const filtered = afterColon.filter(p => cleanStr(p) && !cleanTurkish(p).includes('doğum') && !cleanTurkish(p).includes('dogum'));
      if (filtered.length > 0) {
        student.birthPlaceDate = filtered.join(' - ');
      } else {
        const nextVal = getNextValue(lines, i);
        if (nextVal && !isHeaderLabel(nextVal)) {
          student.birthPlaceDate = nextVal;
        }
      }
    }

    // T.C. Kimlik No (Line specific fallback)
    if (!student.tcNo && (cl.includes('t.c. kimlik no') || cl.includes('tc kimlik no'))) {
      const m = line.match(/(\d{11})(?:\.0+)?/);
      if (m && is11DigitTc(m[1])) {
        student.tcNo = m[1];
      } else {
        const nextVal = getNextValue(lines, i);
        if (nextVal) {
          const cand = cleanNumberStr(nextVal).replace(/\D/g, '');
          if (is11DigitTc(cand)) student.tcNo = cand;
        }
      }
    }

    // Cilt No
    if (!student.volumeNo && (cl.includes('cilt no') || cl.includes('cilt:'))) {
      const m = line.match(/cilt\s*(?:no)?[:\s\t]+(\d+(?:\.0+)?)/i);
      if (m) {
        student.volumeNo = cleanNumberStr(m[1]);
      } else {
        const nextVal = getNextValue(lines, i);
        if (nextVal && /^\d+(?:\.0+)?$/.test(nextVal)) student.volumeNo = cleanNumberStr(nextVal);
      }
    }
    
    // Aile Sıra No
    if (!student.familyOrderNo && (cl.includes('aile sıra') || cl.includes('aile sira'))) {
      const m = line.match(/aile\s*(?:sıra|sira)(?:\s*no)?[:\s\t]+(\d+(?:\.0+)?)/i);
      if (m) {
        student.familyOrderNo = cleanNumberStr(m[1]);
      } else {
        const nextVal = getNextValue(lines, i);
        if (nextVal && /^\d+(?:\.0+)?$/.test(nextVal)) student.familyOrderNo = cleanNumberStr(nextVal);
      }
    }

    // Sıra No / Birey Sıra No (Must NOT capture the number belonging to Aile Sıra No)
    if (!student.orderNo) {
      const bireyMatch = line.match(/birey\s*(?:sıra|sira)(?:\s*no)?[:\s\t]+(\d+(?:\.0+)?)/i);
      if (bireyMatch) {
        student.orderNo = cleanNumberStr(bireyMatch[1]);
      } else {
        const regex = /(?:(aile\s*)?(?:sıra|sira)(?:\s*no)?[:\s\t]+(\d+(?:\.0+)?))/gi;
        let match;
        while ((match = regex.exec(line)) !== null) {
          if (!match[1]) {
            student.orderNo = cleanNumberStr(match[2]);
            break;
          }
        }
      }
      if (!student.orderNo && (cl === 'sıra no:' || cl === 'sira no:' || cl === 'sıra no' || cl === 'sira no')) {
        const nextVal = getNextValue(lines, i);
        if (nextVal && /^\d+(?:\.0+)?$/.test(nextVal)) student.orderNo = cleanNumberStr(nextVal);
      }
    }

    // Nüfus İli
    if (!student.province && (cl.startsWith('ili:') || cl.startsWith('il:') || cl === 'ili' || cl === 'il')) {
      const m = line.match(/(?:ili|il)[:\s\t]+([A-Za-zÇĞİÖŞÜçğıöşü\s]+?)(?=\s+(?:aile|cilt|sıra|$))/i);
      if (m) {
        student.province = m[1].trim();
      } else if (parts.length >= 2) {
        student.province = parts[1];
      }
      if (!student.province) {
        const nextVal = getNextValue(lines, i);
        if (nextVal && !isHeaderLabel(nextVal) && /^[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/.test(nextVal)) {
          student.province = nextVal.trim();
        }
      }
    }

    // Nüfus İlçesi
    if (!student.district && (cl.startsWith('ilçesi:') || cl.startsWith('ilcesi:') || cl === 'ilçesi' || cl === 'ilcesi')) {
      const m = line.match(/(?:ilçesi|ilcesi)[:\s\t]+([A-Za-zÇĞİÖŞÜçğıöşü\s]+?)(?=\s+(?:sıra|cilt|$))/i);
      if (m) {
        student.district = m[1].trim();
      } else if (parts.length >= 2) {
        student.district = parts[1];
      }
      if (!student.district) {
        const nextVal = getNextValue(lines, i);
        if (nextVal && !isHeaderLabel(nextVal) && /^[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/.test(nextVal)) {
          student.district = nextVal.trim();
        }
      }
    }

    // Mahalle / Köy
    if (!student.neighborhood && cl.startsWith('mahalle')) {
      const m = line.match(/mahalle.*?[:\s\t]+([A-Za-zÇĞİÖŞÜçğıöşü\s0-9]+?)(?=\s+(?:ver\.|$))/i);
      if (m) {
        student.neighborhood = m[1].trim();
      } else if (parts.length >= 2) {
        student.neighborhood = parts[1];
      }
      if (!student.neighborhood) {
        const nextVal = getNextValue(lines, i);
        if (nextVal && !isHeaderLabel(nextVal)) {
          student.neighborhood = nextVal.trim();
        }
      }
    }

    // Veli Adı, Soyadı
    if (!student.parentName && cl.includes('veli adı')) {
      const m = line.match(/veli\s*adı.*?[:\s\t]+([A-Za-zÇĞİÖŞÜçğıöşü\s]+?)(?=\s+(?:bursluluk|$))/i);
      if (m) {
        student.parentName = m[1].trim();
      } else if (parts.length >= 2) {
        student.parentName = parts[1];
      }
      if (!student.parentName) {
        const nextVal = getNextValue(lines, i);
        if (nextVal && !isHeaderLabel(nextVal) && /^[A-Za-zÇĞİÖŞÜçğıöşü\s]+$/.test(nextVal)) {
          student.parentName = nextVal.trim();
        }
      }
    }

    // Telefon
    if (!student.parentPhone && (cl.includes('telefon') || cl.includes('cep') || cl.includes('gsm'))) {
      const phoneMatch = line.match(/(?:0|\+90)?\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/) || line.match(/[:\s\t]+([0-9\s+() -]+)/);
      if (phoneMatch) student.parentPhone = normalizePhone(phoneMatch[1] || phoneMatch[0]);
    }

    // İkametgâh Adresi
    if (!student.address && cl.startsWith('adresi:')) {
      const m = line.match(/adresi[:\s\t]+(.*)$/i);
      if (m && m[1].trim()) student.address = m[1].trim();
      else if (parts.length >= 2) student.address = parts[1];
    }

    // Kabul Ed. Sınıf (if not yet found)
    if (!student.grade && (cl.includes('kabul ed') || cl.includes('sınıf /'))) {
      const m = line.match(/(\d{1,2}\s*\.?\s*Sınıf.*?Şubesi|\d{1,2}\s*[/ -]\s*[A-Za-z0-9]+)/i);
      if (m) {
        student.grade = normalizeGrade(m[1]);
      } else {
        const nextVal = getNextValue(lines, i);
        if (nextVal) {
          student.grade = normalizeGrade(nextVal);
        }
      }
    }
  }

  // 4. Sequential Stacked Labels Detection (User's PDF e-Okul format)
  // If number or name was not resolved, resolve via sequential label-to-value matching
  if (!student.number || !firstName) {
    const okulIdx = lines.findIndex(l => cleanTurkish(l).startsWith('okul no') || cleanTurkish(l).includes('ogrenci no'));
    if (okulIdx !== -1) {
      const sub = lines.slice(okulIdx, Math.min(lines.length, okulIdx + 25));
      const vals = sub.filter(l => !isHeaderLabel(l));

      if (vals.length >= 3) {
        const nCand = cleanNumberStr(vals[0]);
        if (!student.number && /^\d+$/.test(nCand)) student.number = nCand;
        if (!firstName) firstName = vals[1];
        if (!lastName) lastName = vals[2];
        if (!student.fatherName && vals[3]) student.fatherName = vals[3];
        if (!student.motherName && vals[4]) student.motherName = vals[4];
        if (!student.birthPlaceDate && vals[5]) student.birthPlaceDate = vals[5];
      }
    }
  }

  // Combine Full Name
  if (!student.name && (firstName || lastName)) {
    student.name = `${firstName} ${lastName}`.trim();
  }

  // Sequential Nüfus fallback (User's PDF format)
  if (!student.province) {
    const nufusIdx = lines.findIndex(l => cleanTurkish(l).includes('nufus kimlik'));
    if (nufusIdx !== -1) {
      const okulBilgiIdx = lines.findIndex(l => cleanTurkish(l).includes('okul bilgi'));
      const nufusLines = lines.slice(nufusIdx + 1, okulBilgiIdx !== -1 ? okulBilgiIdx : lines.length);
      const vals = nufusLines.filter(l => !isHeaderLabel(l));

      if (vals.length >= 4) {
        if (!student.tcNo && is11DigitTc(vals[0])) student.tcNo = cleanNumberStr(vals[0]);
        if (!student.province) student.province = vals[1];
        if (!student.district) student.district = vals[2];
        if (!student.neighborhood) student.neighborhood = vals[3];
      }
      const nums = vals.map(v => cleanNumberStr(v)).filter(v => /^\d+$/.test(v));
      if (nums.length >= 4) {
        if (!student.volumeNo) student.volumeNo = nums[1];
        if (!student.familyOrderNo) student.familyOrderNo = nums[2];
        if (!student.orderNo || (student.orderNo === student.familyOrderNo && nums[3] !== nums[2])) {
          student.orderNo = nums[3];
        }
      }
    }
  }

  // Sequential Veli & Okul fallback (User's PDF format)
  if (!student.parentName) {
    const okulBilgiIdx = lines.findIndex(l => cleanTurkish(l).includes('okul bilgi'));
    if (okulBilgiIdx !== -1) {
      const okulLines = lines.slice(okulBilgiIdx + 1);
      const vals = okulLines.filter(
        l => !isHeaderLabel(l) && !cleanTurkish(l).includes('basari') && !cleanTurkish(l).includes('ogrenci')
      );
      for (const v of vals) {
        if (lastName && v.includes(lastName) && !v.includes(firstName)) {
          student.parentName = v;
          break;
        }
      }
    }
  }

  // General Statuses
  student.boardingStatus = text.includes('YATILI') && !text.includes('GÜNDÜZLÜ') ? 'YATILI' : 'GÜNDÜZLÜ';
  student.scholarshipStatus = text.includes('BURSLU') && !text.includes('BURSSUZ') ? 'BURSLU' : 'BURSSUZ';
  student.registrationType = text.includes('NAKİL') ? 'NAKİL' : 'YENİ KAYIT';

  // 2D rawRows extraction if available (Excel grid coordinates)
  if (rawRows && rawRows.length > 0) {
    for (const r of rawRows) {
      if (!Array.isArray(r)) continue;
      for (let c = 0; c < r.length; c++) {
        const cell = cleanTurkish(r[c]);
        // Okul No cell
        if (!student.number && (cell.startsWith('okul no') || cell.includes('ogrenci no'))) {
          for (let n = c + 1; n < Math.min(c + 5, r.length); n++) {
            const v = cleanNumberStr(r[n]);
            if (v && /^\d+$/.test(v)) {
              student.number = v;
              break;
            }
          }
        }
        // T.C. Kimlik No cell
        if (!student.tcNo && (cell.includes('tc kimlik') || cell.includes('t.c. kimlik'))) {
          for (let n = c + 1; n < r.length; n++) {
            const v = cleanNumberStr(r[n]).replace(/\D/g, '');
            if (is11DigitTc(v)) {
              student.tcNo = v;
              break;
            }
          }
        }
        // Kabul Ed. Sınıf cell
        if (!student.grade && cell.includes('kabul ed')) {
          for (let n = c + 1; n < r.length; n++) {
            const v = cleanStr(r[n]);
            if (v && /\d/.test(v)) {
              student.grade = normalizeGrade(v);
              break;
            }
          }
        }
        // Cilt No cell
        if (!student.volumeNo && (cell === 'cilt no' || cell === 'cilt no:' || cell === 'cilt:')) {
          for (let n = c + 1; n < Math.min(c + 4, r.length); n++) {
            const v = cleanNumberStr(r[n]).replace(/\D/g, '');
            if (v && v.length <= 6) {
              student.volumeNo = v;
              break;
            }
          }
        }
        // Aile Sıra No cell
        if (cell.includes('aile sıra') || cell.includes('aile sira')) {
          for (let n = c + 1; n < Math.min(c + 4, r.length); n++) {
            const v = cleanNumberStr(r[n]).replace(/\D/g, '');
            if (v && v.length <= 8) {
              student.familyOrderNo = v;
              break;
            }
          }
        }
        // Sıra No / Birey Sıra No cell (Distinct from Aile Sıra No!)
        if (!cell.includes('aile') && (cell === 'sıra no' || cell === 'sıra no:' || cell === 'sira no' || cell === 'sira no:' || cell.includes('birey sıra') || cell.includes('birey sira'))) {
          for (let n = c + 1; n < Math.min(c + 4, r.length); n++) {
            const v = cleanNumberStr(r[n]).replace(/\D/g, '');
            if (v && v.length <= 8) {
              student.orderNo = v;
              break;
            }
          }
        }
      }
    }
  }

  // Final safeguard: Verify that orderNo does not accidentally mirror familyOrderNo
  if (student.orderNo && student.familyOrderNo && student.orderNo === student.familyOrderNo) {
    const regex = /(?:(aile\s*)?(?:sıra|sira)(?:\s*no)?[:\s\t]+(\d+))/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!match[1] && match[2] !== student.familyOrderNo) {
        student.orderNo = cleanNumberStr(match[2]);
        break;
      }
    }
  }

  return student;
};

/**
 * Robust Card-Style e-Okul Künye Defteri Excel Parser
 * Automatically detects 1, 2, or more side-by-side student cards across columns
 * as well as vertically stacked student cards down rows.
 */
export const parseCardExcel = (jsonData: unknown[][]): ParsedStudentWithStats[] => {
  const results: ParsedStudentWithStats[] = [];
  if (!jsonData || jsonData.length === 0) return results;

  // 1. Detect side-by-side columns (multiple student cards placed horizontally)
  const okulCols = new Set<number>();
  for (let r = 0; r < jsonData.length; r++) {
    const row = jsonData[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c++) {
      const val = cleanTurkish(row[c]);
      if (val.startsWith('okul no') || val.includes('okul no:') || val.includes('ogrenci no:')) {
        okulCols.add(c);
      }
    }
  }

  // Fallback to checking "T.C. Kimlik" or "Künye" columns if no "Okul No" detected
  if (okulCols.size === 0) {
    for (let r = 0; r < jsonData.length; r++) {
      const row = jsonData[r];
      if (!Array.isArray(row)) continue;
      for (let c = 0; c < row.length; c++) {
        const val = cleanTurkish(row[c]);
        if (val.includes('tc kimlik') || val.includes('t.c. kimlik') || val.includes('kunye defteri')) {
          okulCols.add(c);
        }
      }
    }
  }

  const sortedCols = Array.from(okulCols).sort((a, b) => a - b);
  // Filter columns that are very close to each other (e.g. within 4 columns) to avoid duplicate bands
  const filteredCols: number[] = [];
  for (const col of sortedCols) {
    if (filteredCols.length === 0 || col - filteredCols[filteredCols.length - 1] > 4) {
      filteredCols.push(col);
    }
  }

  const columnBands: Array<{ startCol: number; endCol?: number }> = [];
  if (filteredCols.length > 1) {
    for (let i = 0; i < filteredCols.length; i++) {
      const startCol = filteredCols[i];
      const endCol = i + 1 < filteredCols.length ? filteredCols[i + 1] : undefined;
      columnBands.push({ startCol, endCol });
    }
  } else {
    columnBands.push({ startCol: 0, endCol: undefined });
  }

  // 2. Parse each column band independently
  for (const band of columnBands) {
    const subGrid = jsonData.map(row => {
      if (!Array.isArray(row)) return [];
      return band.endCol !== undefined ? row.slice(band.startCol, band.endCol) : row.slice(band.startCol);
    });

    // Locate student boundary rows in this subGrid
    const startRowIndices: number[] = [];
    for (let r = 0; r < subGrid.length; r++) {
      const row = subGrid[r];
      if (!Array.isArray(row)) continue;
      const rowStr = row.map(c => cleanTurkish(c)).join(' ');

      if (rowStr.startsWith('okul no') || rowStr.includes('okul no:') || rowStr.includes('ogrenci no:')) {
        startRowIndices.push(r);
      }
    }

    if (startRowIndices.length === 0) {
      for (let r = 0; r < subGrid.length; r++) {
        const row = subGrid[r];
        if (!Array.isArray(row)) continue;
        const rowStr = row.map(c => cleanTurkish(c)).join(' ');
        if (rowStr.includes('kunye defteri') || (rowStr.includes('tc kimlik') && r < 5)) {
          startRowIndices.push(r);
        }
      }
    }

    if (startRowIndices.length === 0) {
      startRowIndices.push(0);
    }

    // Parse each student block in this band
    for (let k = 0; k < startRowIndices.length; k++) {
      const startRow = startRowIndices[k];
      const endRow = k + 1 < startRowIndices.length ? startRowIndices[k + 1] : subGrid.length;
      const studentRows = subGrid.slice(startRow, endRow);

      const stringLines = studentRows.map(row => 
        Array.isArray(row) ? row.map(c => cleanStr(c)).filter(Boolean).join('\t') : ''
      ).filter(Boolean);

      const student = parseSingleStudentBlock(stringLines, studentRows);

      if (student.number || student.name || student.tcNo) {
        const fullStudent: ParsedStudentWithStats = {
          id: Math.random().toString(36).substring(2, 11),
          number: student.number || '',
          name: student.name || '',
          grade: student.grade || '',
          ...student,
          _extractedFieldCount: countExtractedFields(student),
          _sourceFormat: 'card'
        };
        results.push(fullStudent);
      }
    }
  }

  return results;
};

/**
 * Column Detection for Tabular Student Lists
 */
export const detectStudentColumnMapping = (
  rows: unknown[][]
): { mapping: StudentColumnMapping; headerRowIndex: number; headers: string[] } => {
  const mapping: StudentColumnMapping = {};
  let headerRowIndex = 0;
  let headers: string[] = [];

  for (let r = 0; r < Math.min(15, rows.length); r++) {
    const row = rows[r];
    if (!row || !Array.isArray(row)) continue;

    const rowText = row.map(c => cleanTurkish(c)).join(' ');
    const hasHeaderKeywords =
      (rowText.includes('no') || rowText.includes('okul') || rowText.includes('ogrenci')) &&
      (rowText.includes('ad') || rowText.includes('isim') || rowText.includes('soyad') || rowText.includes('tc'));

    if (hasHeaderKeywords) {
      headerRowIndex = r;
      headers = row.map(c => cleanStr(c));
      break;
    }
  }

  if (headers.length === 0 && rows.length > 0) {
    headers = (rows[0] || []).map((_, i) => `Sütun ${i + 1}`);
  }

  headers.forEach((h, idx) => {
    const lower = cleanTurkish(h).replace(/[\s._\-/]/g, '');

    if (lower === 'tc' || lower === 'tckimlik' || lower === 'tckimlikno' || lower === 'tcno' || lower === 'kimlikno') {
      if (mapping.tcNo === undefined) mapping.tcNo = idx;
    } else if (lower === 'okulno' || lower === 'ogrencino' || lower === 'ogrno' || lower === 'no' || lower === 'numara') {
      if (mapping.number === undefined) mapping.number = idx;
    } else if (lower === 'adsoyad' || lower === 'adısoyadı' || lower === 'adisoyadi' || lower === 'ogrenciadisoyadi') {
      if (mapping.fullName === undefined) mapping.fullName = idx;
    } else if (lower === 'soyad' || lower === 'soyadı' || lower === 'soyadi') {
      if (mapping.lastName === undefined) mapping.lastName = idx;
    } else if (lower === 'ad' || lower === 'adı' || lower === 'adi' || lower === 'isim') {
      if (mapping.firstName === undefined) mapping.firstName = idx;
    } else if (lower.includes('sinif') || lower.includes('sube')) {
      if (mapping.grade === undefined) mapping.grade = idx;
    } else if (lower.includes('baba')) {
      if (mapping.fatherName === undefined) mapping.fatherName = idx;
    } else if (lower.includes('anne')) {
      if (mapping.motherName === undefined) mapping.motherName = idx;
    } else if (lower.includes('dogumyeri') || lower.includes('dyeri')) {
      if (mapping.birthPlace === undefined) mapping.birthPlace = idx;
    } else if (lower.includes('dogumtarihi') || lower.includes('dtarihi')) {
      if (mapping.birthDate === undefined) mapping.birthDate = idx;
    } else if (lower.includes('cinsiyet')) {
      if (mapping.gender === undefined) mapping.gender = idx;
    } else if (lower.includes('veli') && !lower.includes('tel')) {
      if (mapping.parentName === undefined) mapping.parentName = idx;
    } else if (lower.includes('tel') || lower.includes('gsm') || lower.includes('cep')) {
      if (mapping.parentPhone === undefined) mapping.parentPhone = idx;
    } else if (lower.includes('adres')) {
      if (mapping.address === undefined) mapping.address = idx;
    } else if (lower.includes('ailesirano') || lower.includes('ailesira')) {
      if (mapping.familyOrderNo === undefined) mapping.familyOrderNo = idx;
    } else if (lower === 'sirano' || lower === 'bireysirano' || lower === 'bireysira' || lower === 'sirano') {
      if (mapping.orderNo === undefined) mapping.orderNo = idx;
    } else if (lower.includes('ciltno') || lower === 'cilt') {
      if (mapping.volumeNo === undefined) mapping.volumeNo = idx;
    } else if (lower === 'il' || lower === 'ili' || lower === 'nufusili') {
      if (mapping.province === undefined) mapping.province = idx;
    } else if (lower === 'ilce' || lower === 'ilcesi' || lower === 'nufusilcesi') {
      if (mapping.district === undefined) mapping.district = idx;
    } else if (lower.includes('mahalle') || lower.includes('koy')) {
      if (mapping.neighborhood === undefined) mapping.neighborhood = idx;
    }
  });

  return { mapping, headerRowIndex, headers };
};

/**
 * Robust Tabular Excel Parser
 */
export const parseTabularExcel = (
  jsonData: unknown[][],
  customMapping?: StudentColumnMapping
): ParsedStudentWithStats[] => {
  const results: ParsedStudentWithStats[] = [];
  if (!jsonData || jsonData.length === 0) return results;

  const { mapping, headerRowIndex } = detectStudentColumnMapping(jsonData);
  const effectiveMapping = customMapping || mapping;

  if (effectiveMapping.number === undefined && effectiveMapping.fullName === undefined && effectiveMapping.firstName === undefined) {
    return results;
  }

  // Auto detect class from sheet title rows
  let detectedGradeFromTitle = '';
  for (let r = 0; r < Math.min(jsonData.length, 10); r++) {
    const rowStr = (jsonData[r] || []).map(c => cleanStr(c)).join(' ');
    const match = rowStr.match(/(\d{1,2}\s*[/ -]\s*[A-Za-z0-9ÇĞİÖŞÜçğıöşü]+|\d{1,2}\.\s*Sınıf.*?Şubesi)/i);
    if (match) {
      detectedGradeFromTitle = normalizeGrade(match[0]);
      break;
    }
  }

  for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
    const row = jsonData[r];
    if (!row || !Array.isArray(row) || row.length === 0) continue;

    const rowStr = row.map(c => cleanTurkish(c)).join(' ');
    if (rowStr.includes('toplam') || rowStr.includes('ogrenci sayisi') || rowStr.includes('sayfa :')) {
      continue;
    }

    const rawNo = effectiveMapping.number !== undefined ? cleanNumberStr(row[effectiveMapping.number]) : '';
    let fullName = '';

    if (effectiveMapping.fullName !== undefined && cleanStr(row[effectiveMapping.fullName])) {
      fullName = cleanStr(row[effectiveMapping.fullName]);
    } else {
      const fName = effectiveMapping.firstName !== undefined ? cleanStr(row[effectiveMapping.firstName]) : '';
      const lName = effectiveMapping.lastName !== undefined ? cleanStr(row[effectiveMapping.lastName]) : '';
      fullName = `${fName} ${lName}`.trim();
    }

    if (!rawNo && !fullName) continue;

    const rawGrade = effectiveMapping.grade !== undefined ? cleanStr(row[effectiveMapping.grade]) : '';
    const grade = rawGrade ? normalizeGrade(rawGrade) : detectedGradeFromTitle;

    const student: Partial<Student> = {
      id: Math.random().toString(36).substring(2, 11),
      number: rawNo.replace(/\D/g, '') || rawNo,
      name: fullName,
      grade: grade || '',
      boardingStatus: 'GÜNDÜZLÜ',
      scholarshipStatus: 'BURSSUZ'
    };

    if (effectiveMapping.tcNo !== undefined && cleanStr(row[effectiveMapping.tcNo])) {
      const tc = cleanNumberStr(row[effectiveMapping.tcNo]).replace(/\D/g, '');
      if (is11DigitTc(tc)) student.tcNo = tc;
    }

    if (effectiveMapping.fatherName !== undefined && cleanStr(row[effectiveMapping.fatherName])) {
      student.fatherName = cleanStr(row[effectiveMapping.fatherName]);
    }

    if (effectiveMapping.motherName !== undefined && cleanStr(row[effectiveMapping.motherName])) {
      student.motherName = cleanStr(row[effectiveMapping.motherName]);
    }

    const bPlace = effectiveMapping.birthPlace !== undefined ? cleanStr(row[effectiveMapping.birthPlace]) : '';
    const bDate = effectiveMapping.birthDate !== undefined ? cleanStr(row[effectiveMapping.birthDate]) : '';
    if (bPlace || bDate) {
      student.birthPlaceDate = [bPlace, bDate].filter(Boolean).join(' - ');
    }

    if (effectiveMapping.gender !== undefined && cleanStr(row[effectiveMapping.gender])) {
      student.gender = cleanTurkish(row[effectiveMapping.gender]).includes('kiz') ? 'KIZ' : 'ERKEK';
    }

    if (effectiveMapping.parentName !== undefined && cleanStr(row[effectiveMapping.parentName])) {
      student.parentName = cleanStr(row[effectiveMapping.parentName]);
    }

    if (effectiveMapping.parentPhone !== undefined && cleanStr(row[effectiveMapping.parentPhone])) {
      student.parentPhone = normalizePhone(cleanStr(row[effectiveMapping.parentPhone]));
    }

    if (effectiveMapping.address !== undefined && cleanStr(row[effectiveMapping.address])) {
      student.address = cleanStr(row[effectiveMapping.address]);
    }

    if (effectiveMapping.volumeNo !== undefined && cleanStr(row[effectiveMapping.volumeNo])) {
      student.volumeNo = cleanNumberStr(row[effectiveMapping.volumeNo]);
    }

    if (effectiveMapping.familyOrderNo !== undefined && cleanStr(row[effectiveMapping.familyOrderNo])) {
      student.familyOrderNo = cleanNumberStr(row[effectiveMapping.familyOrderNo]);
    }

    if (effectiveMapping.orderNo !== undefined && cleanStr(row[effectiveMapping.orderNo])) {
      student.orderNo = cleanNumberStr(row[effectiveMapping.orderNo]);
    }

    if (effectiveMapping.province !== undefined && cleanStr(row[effectiveMapping.province])) {
      student.province = cleanStr(row[effectiveMapping.province]);
    }

    if (effectiveMapping.district !== undefined && cleanStr(row[effectiveMapping.district])) {
      student.district = cleanStr(row[effectiveMapping.district]);
    }

    if (effectiveMapping.neighborhood !== undefined && cleanStr(row[effectiveMapping.neighborhood])) {
      student.neighborhood = cleanStr(row[effectiveMapping.neighborhood]);
    }

    results.push({
      ...student,
      _extractedFieldCount: countExtractedFields(student),
      _sourceFormat: 'tabular'
    });
  }

  return results;
};

/**
 * Extract clean text streams from PDF pages using pdfjs-dist.
 * Supports:
 * - Single student per page
 * - Side-by-side (2-column) student layout on the same page
 * - Vertically stacked students on the same page
 */
export const extractTextFromPdf = async (arrayBuffer: ArrayBuffer): Promise<string[]> => {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{ str: string; transform: number[] }>;

    if (!items || items.length === 0) continue;

    const pageWidth = viewport.width;
    const midX = pageWidth / 2;

    // Detect if page has side-by-side (2-column) student cards
    let hasLeftMarker = false;
    let hasRightMarker = false;

    for (const item of items) {
      if (!item.str || !item.str.trim()) continue;
      const x = item.transform[4];
      const cl = cleanTurkish(item.str);
      const isMarker =
        cl.includes('okul no') ||
        cl.includes('ogrenci no') ||
        cl.includes('kunye defteri') ||
        cl.includes('kabul ed') ||
        cl.includes('nufus kimlik') ||
        /\b[1-9]\d{10}\b/.test(item.str);

      if (isMarker) {
        if (x < midX - 20) hasLeftMarker = true;
        if (x > midX - 20) hasRightMarker = true;
      }
    }

    const isSideBySide = hasLeftMarker && hasRightMarker;

    const columnGroups: Array<Array<{ str: string; transform: number[] }>> = [];
    if (isSideBySide) {
      const leftItems = items.filter(it => it.transform[4] < midX);
      const rightItems = items.filter(it => it.transform[4] >= midX);
      if (leftItems.length > 0) columnGroups.push(leftItems);
      if (rightItems.length > 0) columnGroups.push(rightItems);
    } else {
      columnGroups.push(items);
    }

    // Process each column independently
    for (const colItems of columnGroups) {
      const lineBuckets: Map<number, Array<{ str: string; x: number }>> = new Map();

      for (const item of colItems) {
        if (!item.str || !item.str.trim()) continue;
        const y = Math.round(item.transform[5]);
        const x = item.transform[4];

        let foundBucketY: number | null = null;
        for (const bucketY of lineBuckets.keys()) {
          // 6 points vertical tolerance to capture table cells on same baseline
          if (Math.abs(bucketY - y) <= 6) {
            foundBucketY = bucketY;
            break;
          }
        }

        if (foundBucketY !== null) {
          lineBuckets.get(foundBucketY)!.push({ str: item.str, x });
        } else {
          lineBuckets.set(y, [{ str: item.str, x }]);
        }
      }

      const sortedY = Array.from(lineBuckets.keys()).sort((a, b) => b - a);
      const colLines: string[] = [];

      for (const y of sortedY) {
        const itemsInLine = lineBuckets.get(y)!;
        itemsInLine.sort((a, b) => a.x - b.x);
        // Separate cells on the same line with tab to preserve column boundaries
        const lineStr = itemsInLine.map(it => it.str.trim()).filter(Boolean).join('\t');
        if (lineStr) colLines.push(lineStr);
      }

      if (colLines.length > 0) {
        pageTexts.push(colLines.join('\n'));
      }
    }
  }

  return pageTexts;
};

/**
 * Parse e-Okul PDF text content (Handles Künye Defteri forms, 1-card, 2-card side-by-side, and tabular lists)
 */
export const parsePdfContent = (pageTexts: string[]): { students: ParsedStudentWithStats[]; format: 'pdf-card' | 'pdf-table' } => {
  const fullText = pageTexts.join('\n\n--- PAGE BREAK ---\n\n');
  const lowerFull = cleanTurkish(fullText);

  const isCardStyle =
    lowerFull.includes('kunye defteri') ||
    lowerFull.includes('kabul ed') ||
    lowerFull.includes('nufus kimlik') ||
    lowerFull.includes('okul no') ||
    lowerFull.includes('ogrenci no');

  if (isCardStyle) {
    const students: ParsedStudentWithStats[] = [];

    // Each textBlock corresponds to a page or a column on a side-by-side page
    for (const textBlock of pageTexts) {
      const lines = textBlock.split('\n').map(l => cleanStr(l)).filter(Boolean);
      if (lines.length === 0) continue;

      // Find all student starts within this textBlock
      const startIndices: number[] = [];
      for (let i = 0; i < lines.length; i++) {
        const cl = cleanTurkish(lines[i]);
        if (cl.startsWith('okul no') || cl.includes('okul no:') || cl.includes('ogrenci no:') || cl.includes('kunye defteri')) {
          startIndices.push(i);
        }
      }

      // If no explicit header line found, fallback to start 0
      if (startIndices.length === 0) {
        startIndices.push(0);
      }

      for (let k = 0; k < startIndices.length; k++) {
        const start = startIndices[k];
        const end = k + 1 < startIndices.length ? startIndices[k + 1] : lines.length;
        const subLines = lines.slice(start, end);

        const student = parseSingleStudentBlock(subLines);
        if (student.number || student.name || student.tcNo) {
          students.push({
            id: Math.random().toString(36).substring(2, 11),
            number: student.number || '',
            name: student.name || '',
            grade: student.grade || '',
            ...student,
            _extractedFieldCount: countExtractedFields(student),
            _sourceFormat: 'pdf-card'
          });
        }
      }
    }

    return { students, format: 'pdf-card' };
  } else {
    // Tabular PDF list
    const students: ParsedStudentWithStats[] = [];
    for (const pageText of pageTexts) {
      const lines = pageText.split('\n').map(l => cleanStr(l)).filter(Boolean);
      for (const line of lines) {
        const cl = cleanTurkish(line);
        if (cl.includes('ogrenci sayisi') || cl.includes('toplam') || cl.includes('sayfa :') || cl.includes('sinif listesi')) {
          continue;
        }

        // 1. Flexible match with School No + 11-digit TC + Name
        const matchWithTc = line.match(
          /^(?:(?:\d{1,3})[\t\s]+)?(\d{1,6})[\t\s]+([1-9]\d{10})[\t\s]+([A-Za-zÇĞİÖŞÜçğıöşü\s]+?)(?:[\t\s]+(\d{1,2}[/ -][A-Za-z0-9]+))?(?:[\t\s]+([A-Za-zÇĞİÖŞÜçğıöşü]+))?(?:[\t\s]+([A-Za-zÇĞİÖŞÜçğıöşü]+))?$/i
        ) || line.match(
          /^(?:(?:\d{1,3})[\t\s]+)?([1-9]\d{10})[\t\s]+(\d{1,6})[\t\s]+([A-Za-zÇĞİÖŞÜçğıöşü\s]+?)(?:[\t\s]+(\d{1,2}[/ -][A-Za-z0-9]+))?/i
        );

        if (matchWithTc) {
          let no = matchWithTc[1];
          let tc = matchWithTc[2];
          // Handle reversed TC / No pattern
          if (is11DigitTc(no)) {
            const temp = no;
            no = tc;
            tc = temp;
          }
          const name = matchWithTc[3];
          const grade = matchWithTc[4];
          const father = matchWithTc[5];
          const mother = matchWithTc[6];

          const s: ParsedStudentWithStats = {
            id: Math.random().toString(36).substring(2, 11),
            number: cleanNumberStr(no),
            tcNo: tc,
            name: name.trim(),
            grade: grade ? normalizeGrade(grade) : '',
            fatherName: father?.trim() || undefined,
            motherName: mother?.trim() || undefined,
            boardingStatus: 'GÜNDÜZLÜ',
            scholarshipStatus: 'BURSSUZ',
            _sourceFormat: 'pdf-table'
          };
          s._extractedFieldCount = countExtractedFields(s);
          students.push(s);
        }
      }
    }
    return { students, format: 'pdf-table' };
  }
};

/**
 * Parse Raw Pasted Text (e.g. from Excel Ctrl+C or PDF copy)
 */
export const parseStudentPastedText = (
  rawText: string,
  forcedFormat: 'auto' | 'card' | 'tabular' = 'auto',
  customMapping?: StudentColumnMapping
): ParseFileResult => {
  const trimmed = rawText.trim();
  if (!trimmed) {
    return {
      students: [],
      formatDetected: 'paste-card',
      fileName: 'Pasted_Text',
      totalStudents: 0,
      extractedFieldsSummary: calculateSummary([])
    };
  }

  const lines = trimmed.split('\n').map(l => cleanStr(l)).filter(Boolean);
  const textLower = cleanTurkish(trimmed);

  // Check if it's Künye Defteri style (contains labels like "Okul No:", "Adı:", "T.C. Kimlik No:")
  const isCard =
    forcedFormat === 'card' ||
    (forcedFormat === 'auto' &&
      (textLower.includes('okul no') || textLower.includes('kunye defteri') || textLower.includes('nufus kimlik')));

  if (isCard) {
    // Find all student starts
    const studentStarts: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      const cl = cleanTurkish(lines[i]);
      if (cl.startsWith('okul no') || cl.includes('kunye defteri') || cl.startsWith('ogrenci kunye')) {
        studentStarts.push(i);
      }
    }

    if (studentStarts.length === 0) {
      studentStarts.push(0);
    }

    const students: ParsedStudentWithStats[] = [];
    for (let k = 0; k < studentStarts.length; k++) {
      const start = studentStarts[k];
      const end = k + 1 < studentStarts.length ? studentStarts[k + 1] : lines.length;
      const subLines = lines.slice(start, end);
      const student = parseSingleStudentBlock(subLines);

      if (student.number || student.name || student.tcNo) {
        students.push({
          id: Math.random().toString(36).substring(2, 11),
          number: student.number || '',
          name: student.name || '',
          grade: student.grade || '',
          ...student,
          _extractedFieldCount: countExtractedFields(student),
          _sourceFormat: 'paste-card'
        });
      }
    }

    return {
      students,
      formatDetected: 'paste-card',
      fileName: 'Pasted_Kunye_Defteri',
      totalStudents: students.length,
      extractedFieldsSummary: calculateSummary(students)
    };
  }

  // Otherwise, treat as Tabular (TSV, CSV, or columns)
  const rows = lines.map(line => {
    if (line.includes('\t')) return line.split('\t');
    if (line.includes(';')) return line.split(';');
    if (line.includes(',')) return line.split(',');
    return line.split(/\s{2,}/);
  });

  const students = parseTabularExcel(rows, customMapping);
  const { mapping, headers } = detectStudentColumnMapping(rows);
  const detectedCols = headers.map((h, idx) => ({
    index: idx,
    header: h,
    mappedField: Object.entries(customMapping || mapping).find(([, v]) => v === idx)?.[0] || 'none'
  }));

  return {
    students,
    formatDetected: 'paste-table',
    fileName: 'Pasted_Table',
    totalStudents: students.length,
    detectedColumns: detectedCols,
    rawHeaders: headers,
    rawRows: rows,
    extractedFieldsSummary: calculateSummary(students)
  };
};

/**
 * Universal File Parser: Handles both Excel (.xlsx, .xls, .csv) and PDF (.pdf) across all sheets
 */
export const parseStudentFile = async (
  file: File,
  forcedFormat: 'auto' | 'card' | 'tabular' = 'auto',
  customMapping?: StudentColumnMapping
): Promise<ParseFileResult> => {
  const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';

  if (isPdf) {
    const arrayBuffer = await file.arrayBuffer();
    const pageTexts = await extractTextFromPdf(arrayBuffer);
    const { students, format } = parsePdfContent(pageTexts);

    return {
      students,
      formatDetected: format,
      fileName: file.name,
      totalStudents: students.length,
      extractedFieldsSummary: calculateSummary(students)
    };
  }

  // Excel / CSV File Handling across all worksheets
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  let allStudents: ParsedStudentWithStats[] = [];
  let formatDetected: 'card' | 'tabular' = 'card';
  let detectedCols: { index: number; header: string; mappedField: string }[] | undefined;
  let rawHeaders: string[] | undefined;
  let rawRows: unknown[][] | undefined;

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    // Use raw values to prevent narrow column display ###### from replacing numbers
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) as unknown[][];
    if (!jsonData || jsonData.length === 0) continue;

    if (forcedFormat === 'card') {
      const s = parseCardExcel(jsonData);
      allStudents = [...allStudents, ...s];
      formatDetected = 'card';
    } else if (forcedFormat === 'tabular') {
      const s = parseTabularExcel(jsonData, customMapping);
      allStudents = [...allStudents, ...s];
      formatDetected = 'tabular';
    } else {
      // Auto detect
      const cardStudents = parseCardExcel(jsonData);
      if (cardStudents.length > 0) {
        allStudents = [...allStudents, ...cardStudents];
        formatDetected = 'card';
      } else {
        const tabStudents = parseTabularExcel(jsonData, customMapping);
        allStudents = [...allStudents, ...tabStudents];
        formatDetected = 'tabular';

        if (!rawRows) {
          const { mapping, headers } = detectStudentColumnMapping(jsonData);
          rawRows = jsonData;
          rawHeaders = headers;
          detectedCols = headers.map((h, idx) => ({
            index: idx,
            header: h,
            mappedField: Object.entries(customMapping || mapping).find(([, v]) => v === idx)?.[0] || 'none'
          }));
        }
      }
    }
  }

  return {
    students: allStudents,
    formatDetected,
    fileName: file.name,
    totalStudents: allStudents.length,
    detectedColumns: detectedCols,
    rawHeaders,
    rawRows,
    extractedFieldsSummary: calculateSummary(allStudents)
  };
};

const calculateSummary = (students: Partial<Student>[]) => {
  return {
    withTc: students.filter(s => Boolean(s.tcNo)).length,
    withGrade: students.filter(s => Boolean(s.grade)).length,
    withParents: students.filter(s => Boolean(s.fatherName || s.motherName)).length,
    withContact: students.filter(s => Boolean(s.parentPhone || s.parentName)).length,
    withAddress: students.filter(s => Boolean(s.address || s.province || s.district)).length,
    withBirthInfo: students.filter(s => Boolean(s.birthPlaceDate)).length
  };
};
