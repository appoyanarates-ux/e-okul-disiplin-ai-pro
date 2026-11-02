/**
 * MEB Eğitim-Öğretim Yılı Hesaplama ve Yardımcı Fonksiyonlar
 * Türkiye'de eğitim öğretim yılı Eylül (veya Ağustos sonu hazırlık dönemi)
 * itibarıyla başlar ve sonraki yılın Haziran/Temmuz döneminde tamamlanır.
 */

export const getCurrentAcademicYear = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Ocak, 7 = Ağustos, 8 = Eylül
  // Ağustos (7) veya Eylül (8) ve sonrası yeni eğitim öğretim yılının başlangıcıdır
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

export const getAcademicYearFromDate = (dateInput: Date | string): string => {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(date.getTime())) {
    return getCurrentAcademicYear();
  }
  const year = date.getFullYear();
  const month = date.getMonth();
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
};

export const getAcademicYearOptions = (centerDate: Date = new Date(), pastYears = 3, futureYears = 6): string[] => {
  const currentAcademic = getCurrentAcademicYear(centerDate);
  const currentStartYear = parseInt(currentAcademic.split('-')[0], 10);
  
  const years: string[] = [];
  for (let y = currentStartYear - pastYears; y <= currentStartYear + futureYears; y++) {
    years.push(`${y}-${y + 1}`);
  }
  return years;
};
