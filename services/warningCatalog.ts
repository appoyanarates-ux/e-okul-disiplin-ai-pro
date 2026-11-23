/**
 * Yazılı Uyarı Takip Sistemi - Davranış Kataloğu ve Tekrar Kontrolü
 *
 * Yazılı uyarı disiplin cezası DEĞİLDİR. Bu modül yalnızca okul içi takip,
 * bilgilendirme ve belgelendirme amacıyla tutulan kayıtları eşleştirir.
 * Tekrar eden davranış tespit edildiğinde yalnızca BİLGİLENDİRME yapar;
 * hiçbir kaydı otomatik olarak disiplin cezasına dönüştürmez.
 */
import { WrittenWarning, Incident, Student } from '../types';

export interface BehaviorDef {
  key: string;
  title: string; // Listede görünen ad
  alertLabel: string; // "... davranışı nedeniyle" cümlesinde kullanılan isim-fiil hâli
  refLise?: string; // Ortaöğretim Kurumları Yönetmeliği atfı (bilgi amaçlı)
  refOrtaokul?: string; // Okul Öncesi Eğitim ve İlköğretim Kurumları Yönetmeliği atfı (bilgi amaçlı)
  keywords: string[]; // Olay başlığından otomatik tahmin için anahtar kelimeler (normalize edilmiş)
}

export const BEHAVIOR_CATALOG: BehaviorDef[] = [
  { key: 'cep_telefonu', title: 'Sınıfta / derste izinsiz cep telefonu kullanmak', alertLabel: 'sınıfta izinsiz cep telefonu kullanma',
    refLise: 'Md. 164/1-o', refOrtaokul: 'Md. 55 Kınama', keywords: ['cep telefon', 'telefon', 'telefonla', 'telefonu', 'akilli saat'] },
  { key: 'bilisim_ders', title: 'Ders saatinde bilişim araçlarını açık tutarak dersin akışını bozmak', alertLabel: 'ders saatinde bilişim araçlarını açık tutarak dersin akışını bozma',
    refLise: 'Md. 164/1-n', keywords: ['tablet', 'bilisim arac', 'kulaklik', 'bilgisayar'] },
  { key: 'ders_duzeni', title: 'Dersin ve ders dışı faaliyetlerin akışını ve düzenini bozmak', alertLabel: 'dersin akışını ve düzenini bozma',
    refLise: 'Md. 164/1-h', refOrtaokul: 'Md. 55 Kınama', keywords: ['ders akis', 'dersi boz', 'ders duzen', 'sinif duzen', 'gurultu', 'dersin akis'] },
  { key: 'kaba_saygisiz', title: 'Öğretmen, çalışan veya arkadaşlarına kaba ve saygısız davranmak', alertLabel: 'kaba ve saygısız davranma',
    refLise: 'Md. 164/1-ğ', refOrtaokul: 'Md. 55 Kınama', keywords: ['saygisiz', 'kaba', 'terbiyesiz', 'kufur', 'argo'] },
  { key: 'kilik_kiyafet', title: 'Kılık-kıyafet kurallarına uymamak', alertLabel: 'kılık-kıyafet kurallarına uymama',
    refLise: 'Md. 164/1-c', refOrtaokul: 'Md. 55 Uyarma', keywords: ['kilik', 'kiyafet', 'uniforma', 'sac', 'makyaj', 'kupe'] },
  { key: 'tutun', title: 'Tütün / elektronik sigara bulundurmak veya kullanmak', alertLabel: 'tütün ürünü bulundurma veya kullanma',
    refLise: 'Md. 164/1-ç', refOrtaokul: 'Md. 55 Kınama', keywords: ['sigara', 'tutun', 'elektronik sigara', 'e-sigara', 'nargile', 'vape', 'puff'] },
  { key: 'kirletme', title: 'Okulu, okul eşyasını ve çevresini kirletmek', alertLabel: 'okulu, okul eşyasını ve çevresini kirletme',
    refLise: 'Md. 164/1-a', refOrtaokul: 'Md. 55 Uyarma', keywords: ['kirlet', 'cop', 'duvara yaz', 'siraya yaz'] },
  { key: 'gorev_yapmama', title: 'Eğitim-öğretime ilişkin verilen görevleri yapmamak', alertLabel: 'eğitim-öğretime ilişkin görevleri yapmama',
    refLise: 'Md. 164/1-b', keywords: ['odev', 'gorev yapma', 'gorevini'] },
  { key: 'izinsiz_esya', title: 'Başkasına ait eşyayı izinsiz almak veya kullanmak', alertLabel: 'başkasına ait eşyayı izinsiz alma veya kullanma',
    refLise: 'Md. 164/1-d', refOrtaokul: 'Md. 55 Kınama', keywords: ['izinsiz al', 'esyasini al', 'habersiz al'] },
  { key: 'yalan', title: 'Yalan söylemek', alertLabel: 'yalan söyleme',
    refLise: 'Md. 164/1-e', refOrtaokul: 'Md. 55 Uyarma', keywords: ['yalan'] },
  { key: 'yanlis_bilgi', title: 'Okul yönetimini yanlış bilgilendirmek', alertLabel: 'okul yönetimini yanlış bilgilendirme',
    refOrtaokul: 'Md. 55 Kınama', keywords: ['yanlis bilgi'] },
  { key: 'derse_katilmama', title: 'Okula geldiği hâlde özürsüz derse / etkinliğe katılmamak', alertLabel: 'okula geldiği hâlde özürsüz derse katılmama',
    refLise: 'Md. 164/1-f', keywords: ['derse girme', 'dersi as', 'kacma', 'kacti', 'derse katilma'] },
  { key: 'gec_gelme', title: 'Derse ve etkinliklere vaktinde gelmemek', alertLabel: 'derse ve etkinliklere vaktinde gelmeme',
    refOrtaokul: 'Md. 55 Uyarma', keywords: ['gec gel', 'gecikme', 'vaktinde'] },
  { key: 'kutuphane_lab', title: 'Kütüphane veya laboratuvar malzemelerini kötü kullanmak / eksik vermek', alertLabel: 'kütüphane ve laboratuvar malzemelerini kötü kullanma',
    refLise: 'Md. 164/1-g', keywords: ['kutuphane', 'laboratuvar'] },
  { key: 'kopya', title: 'Kopya çekmek veya çekilmesine yardımcı olmak', alertLabel: 'kopya çekme veya çekilmesine yardımcı olma',
    refLise: 'Md. 164/1-ı', keywords: ['kopya'] },
  { key: 'bilisim_kural', title: 'Bilişim araçlarını belirlenen usul ve esaslara aykırı kullanmak', alertLabel: 'bilişim araçlarını kurallara aykırı kullanma',
    refLise: 'Md. 164/1-l', keywords: ['sosyal medya', 'internet'] },
  { key: 'yasak_malzeme', title: 'Okula yönetimce yasaklanmış malzeme getirmek / kullanmak', alertLabel: 'okula yasaklanmış malzeme getirme',
    refLise: 'Md. 164/1-j', refOrtaokul: 'Md. 55 Uyarma', keywords: ['yasak malzeme', 'yasakli'] },
  { key: 'toren', title: 'Törenlere özürsüz katılmamak', alertLabel: 'törenlere özürsüz katılmama',
    refOrtaokul: 'Md. 55 Kınama', keywords: ['toren'] },
  { key: 'izinsiz_kisi', title: 'Okula izinsiz olarak okulla ilgisi olmayan kişileri getirmek', alertLabel: 'okula izinsiz kişi getirme',
    refLise: 'Md. 164/1-ö', keywords: ['yabanci kisi', 'disaridan kisi'] },
  { key: 'pansiyon', title: 'Yatılı okullarda pansiyon kurallarına uymamak', alertLabel: 'pansiyon kurallarına uymama',
    refLise: 'Md. 164/1-i', keywords: ['pansiyon', 'yatakhane', 'etut'] },
];

export const CUSTOM_PREFIX = 'ozel:';

// Türkçe karakter ve büyük/küçük harf duyarsız normalleştirme
export const normalizeTr = (text: string): string =>
  (text || '')
    .replace(/İ/g, 'i').replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/â/g, 'a').replace(/î/g, 'i').replace(/û/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const makeCustomBehaviorKey = (title: string): string =>
  CUSTOM_PREFIX + normalizeTr(title).replace(/\s+/g, '_').slice(0, 80);

export const getBehaviorDef = (key?: string): BehaviorDef | undefined =>
  key ? BEHAVIOR_CATALOG.find(b => b.key === key) : undefined;

/** "... davranışı nedeniyle" cümlesi için davranış adı */
export const getBehaviorAlertLabel = (key: string, fallbackTitle?: string): string => {
  const def = getBehaviorDef(key);
  if (def) return def.alertLabel;
  const t = (fallbackTitle || '').trim();
  if (!t) return 'aynı';
  // Serbest metin: ilk harfi küçült
  return t.charAt(0).toLocaleLowerCase('tr-TR') + t.slice(1);
};

export const getBehaviorRef = (key: string, institutionType?: string): string => {
  const def = getBehaviorDef(key);
  if (!def) return '';
  const isMiddle = (institutionType || '').toLowerCase().includes('ortaokul');
  return (isMiddle ? def.refOrtaokul : def.refLise) || def.refLise || def.refOrtaokul || '';
};

/** Olay başlığı / açıklamasından davranış türünü tahmin eder (yalnızca öneri amaçlı). */
export const detectBehaviorFromText = (text: string): BehaviorDef | undefined => {
  const n = ' ' + normalizeTr(text) + ' ';
  if (!n.trim()) return undefined;
  let best: { def: BehaviorDef; score: number } | undefined;
  for (const def of BEHAVIOR_CATALOG) {
    let score = 0;
    for (const kw of def.keywords) {
      if (n.includes(kw)) score += kw.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { def, score };
  }
  return best?.def;
};

/** Bir olay için kullanılacak davranış anahtarı (açıkça seçilmişse o, yoksa metinden tahmin). */
export const resolveIncidentBehavior = (incident: Pick<Incident, 'behaviorCode' | 'title' | 'description'>): { key?: string; title?: string; guessed: boolean } => {
  if (incident.behaviorCode) {
    const def = getBehaviorDef(incident.behaviorCode);
    return { key: incident.behaviorCode, title: def?.title || incident.title, guessed: false };
  }
  const guess = detectBehaviorFromText(`${incident.title || ''} ${incident.description || ''}`);
  if (guess) return { key: guess.key, title: guess.title, guessed: true };
  return { guessed: true };
};

// --- Tarih biçimleri ---
export const formatDateTr = (iso?: string): string => {
  if (!iso) return '.../.../....';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
};

export const sortWarningsByDate = (list: WrittenWarning[]): WrittenWarning[] =>
  [...list].sort((a, b) => `${a.date} ${a.time || ''}`.localeCompare(`${b.date} ${b.time || ''}`));

/** Bir öğrencinin belirli bir davranış için önceki yazılı uyarıları (eskiden yeniye). */
export const findPriorWarnings = (
  warnings: WrittenWarning[],
  studentId: string,
  behaviorKey: string,
  opts?: { excludeId?: string; beforeDate?: string }
): WrittenWarning[] => {
  if (!studentId || !behaviorKey) return [];
  return sortWarningsByDate(
    warnings.filter(w =>
      w.studentId === studentId &&
      w.behaviorKey === behaviorKey &&
      w.id !== opts?.excludeId &&
      (!opts?.beforeDate || w.date <= opts.beforeDate)
    )
  );
};

/**
 * Tekrar eden davranış bilgilendirme metni (kullanıcının istediği resmi metin).
 * Program bu metni yalnızca bilgilendirme amacıyla gösterir; işlem kararı yetkili kurul / okul yönetimine aittir.
 */
export const buildRepeatAlertText = (behaviorKey: string, behaviorTitle: string, prior: WrittenWarning[]): string => {
  const label = getBehaviorAlertLabel(behaviorKey, behaviorTitle);
  const dates = sortWarningsByDate(prior).map(w => formatDateTr(w.date));
  const datePart = dates.length <= 1
    ? `Önceki uyarı tarihi: ${dates[0] || '.../.../....'}.`
    : `Önceki uyarı tarihleri: ${dates.join(', ')} (${dates.length} kez).`;
  return `DİKKAT: Bu öğrenci, ${label} davranışı nedeniyle daha önce yazılı olarak uyarılmıştır. ${datePart} Aynı davranışın tekrarlandığı tespit edilmiştir. İlgili mevzuat kapsamında disiplin işlemi yönünden değerlendirme yapılması gerekmektedir.`;
};

export interface BehaviorSummary {
  behaviorKey: string;
  behaviorTitle: string;
  count: number;
  firstDate: string;
  lastDate: string;
  warnings: WrittenWarning[]; // eskiden yeniye
}

/** Öğrencinin yazılı uyarılarını davranış bazında gruplar. */
export const summarizeByBehavior = (warnings: WrittenWarning[]): BehaviorSummary[] => {
  const map = new Map<string, BehaviorSummary>();
  for (const w of sortWarningsByDate(warnings)) {
    const cur = map.get(w.behaviorKey);
    if (!cur) {
      map.set(w.behaviorKey, { behaviorKey: w.behaviorKey, behaviorTitle: w.behaviorTitle, count: 1, firstDate: w.date, lastDate: w.date, warnings: [w] });
    } else {
      cur.count++;
      cur.lastDate = w.date;
      cur.warnings.push(w);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate));
};

/** Öğrenci araması: numara (tam veya başlangıç) ya da ad-soyad (Türkçe duyarsız). */
export const searchStudents = (students: Student[], query: string, limit = 30): Student[] => {
  const q = (query || '').trim();
  if (!q) return [];
  const isNumeric = /^\d+$/.test(q);
  if (isNumeric) {
    const exact = students.filter(s => String(s.number || '').trim() === q);
    const starts = students.filter(s => String(s.number || '').trim() !== q && String(s.number || '').trim().startsWith(q));
    return [...exact, ...starts].slice(0, limit);
  }
  const nq = normalizeTr(q);
  const parts = nq.split(' ').filter(Boolean);
  return students
    .filter(s => {
      const hay = normalizeTr(`${s.name} ${s.number} ${s.grade}`);
      return parts.every(p => hay.includes(p));
    })
    .slice(0, limit);
};

/** Öğrencinin resmî disiplin cezası kayıtları (olaylardan + sistem dışı geçmiş cezalar). */
export interface PenaltyRecord {
  source: 'incident' | 'previous';
  id: string;
  date?: string;
  decision: string;
  decisionNo?: string;
  title?: string;
  incidentCode?: string;
  incidentId?: string;
  penaltyScore?: string;
  isRemoved?: boolean;
}

export const getStudentPenaltyRecords = (student: Student, incidents: Incident[]): PenaltyRecord[] => {
  const out: PenaltyRecord[] = [];
  incidents.forEach(inc => {
    (inc.involvedStudents || []).forEach(inv => {
      if (inv.studentId === student.id && inv.role === 'suspect' && inv.decision) {
        out.push({
          source: 'incident',
          id: `${inc.id}_${inv.studentId}`,
          date: inv.decisionDate || inc.date,
          decision: inv.decision,
          decisionNo: inv.decisionNo,
          title: inc.title,
          incidentCode: inc.code,
          incidentId: inc.id,
          penaltyScore: inv.penaltyScore,
          isRemoved: inv.isRemoved,
        });
      }
    });
  });
  (student.previousPenalties || []).forEach(p => {
    out.push({
      source: 'previous',
      id: p.id,
      date: p.date,
      decision: p.decision,
      decisionNo: p.decisionNo,
      title: p.description,
      penaltyScore: p.penaltyScore,
      isRemoved: p.isRemoved,
    });
  });
  return out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
};

/** Öğrencinin dahil olduğu, henüz karara bağlanmamış (fail) olaylar. */
export const getStudentOpenIncidents = (student: Student, incidents: Incident[]): Incident[] =>
  incidents.filter(inc => (inc.involvedStudents || []).some(inv => inv.studentId === student.id && inv.role === 'suspect' && !inv.decision));

/** Yeni tutanak numarası önerisi: YU-2026-001 */
export const suggestDocumentNo = (warnings: WrittenWarning[], date?: string): string => {
  const year = (date || new Date().toISOString()).slice(0, 4);
  const prefix = `YU-${year}-`;
  let max = 0;
  warnings.forEach(w => {
    if (w.documentNo && w.documentNo.startsWith(prefix)) {
      const n = parseInt(w.documentNo.slice(prefix.length), 10);
      if (!isNaN(n) && n > max) max = n;
    }
  });
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
};
