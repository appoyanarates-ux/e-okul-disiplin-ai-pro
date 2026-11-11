import { BoardMember } from '../types';

export interface BoardInfo {
  isOrtaokul: boolean;
  /** Kurum türüne göre tam kurul adı */
  boardName: string;
  /** Büyük harfli resmi evrak başlığı için kurul adı */
  boardNameUpper: string;
  /** Kısa kısaltma (ÖDDK / ÖÖDK) */
  boardAbbr: string;
  /** "... Kurulunda" */
  boardLocative: string;
  /** "... Kuruluna" */
  boardDative: string;
  /** "... Kurulunca" */
  boardAgentive: string;
  /** "... Kurulunun" */
  boardGenitive: string;
  /** "... Kurulumuz" */
  boardOur: string;
  /** "... Kurulu Başkanı" */
  boardPresidentLabel: string;
  /** "... Kurulu Başkanlığına" */
  boardPresidencyDative: string;
  /** EK-10 karar formu alt notu */
  ek10SubNote: string;
  /** Kurul başkanının adı soyadı */
  presidentName: string;
  /** Kurul başkanının idari/kadro ünvanı */
  presidentTitle: string;
  /** İlgili MEB yönetmeliği kısa adı */
  regulationShort: string;
  /** İlgili MEB yönetmeliği varsayılan disiplin maddesi */
  regulationDefaultArticle: string;
  /** Ceza silme / kaldırma tam madde metni */
  regulationRemovalArticle: string;
  /** Ceza silme / kaldırma kısa madde metni */
  regulationRemovalShort: string;
  /** Ceza silme karar metnindeki yönetmelik ifadesi */
  regulationRemovalSentence: string;
}

/**
 * Kurum ayarlarındaki okul türüne ve kurul üyeleri listesine göre
 * resmi evraklarda kullanılacak kurul adını ve başkan bilgilerini döner.
 */
export const getBoardInfo = (
  schoolType?: string,
  boardMembers?: BoardMember[]
): BoardInfo => {
  const isOrtaokul = (schoolType || '').toLocaleLowerCase('tr-TR').includes('ortaokul');

  const presidentMember =
    boardMembers?.find(m => (m.role || '').toLocaleUpperCase('tr-TR').includes('BAŞKAN')) ||
    boardMembers?.[0];

  const presidentName = presidentMember?.mainName?.trim() || '.......................................';
  const presidentTitle =
    presidentMember?.mainTitle?.trim() ||
    (isOrtaokul ? 'Müdür Yardımcısı' : 'Müdür Başyardımcısı');

  if (isOrtaokul) {
    return {
      isOrtaokul: true,
      boardName: 'Öğrenci Davranışlarını Değerlendirme Kurulu',
      boardNameUpper: 'ÖĞRENCİ DAVRANIŞLARINI DEĞERLENDİRME KURULU',
      boardAbbr: 'ÖDDK',
      boardLocative: 'Öğrenci Davranışlarını Değerlendirme Kurulunda',
      boardDative: 'Öğrenci Davranışlarını Değerlendirme Kuruluna',
      boardAgentive: 'Öğrenci Davranışlarını Değerlendirme Kurulunca',
      boardGenitive: 'Öğrenci Davranışlarını Değerlendirme Kurulunun',
      boardOur: 'Öğrenci Davranışlarını Değerlendirme Kurulumuz',
      boardPresidentLabel: 'Öğrenci Davranışlarını Değerlendirme Kurulu Başkanı',
      boardPresidencyDative: 'Öğrenci Davranışlarını Değerlendirme Kurulu Başkanlığına',
      ek10SubNote: '(Değişik: 02.05.2006/26156 RG)',
      presidentName,
      presidentTitle,
      regulationShort: 'MEB İlköğretim Kurumları Yönetmeliği',
      regulationDefaultArticle: 'MEB İlköğretim Kurumları Yönetmeliği Madde 54',
      regulationRemovalArticle:
        'Millî Eğitim Bakanlığı Okul Öncesi Eğitim ve İlköğretim Kurumları Yönetmeliğinin 58. Maddesi',
      regulationRemovalShort: 'MEB İlköğretim Kurumları Yönetmeliği 58. Maddesi',
      regulationRemovalSentence:
        'MEB Okul Öncesi Eğitim ve İlköğretim Kurumları Yönetmeliğinin ilgili maddeleri'
    };
  }

  return {
    isOrtaokul: false,
    boardName: 'Okul Öğrenci Ödül ve Disiplin Kurulu',
    boardNameUpper: 'OKUL ÖĞRENCİ ÖDÜL VE DİSİPLİN KURULU',
    boardAbbr: 'ÖÖDK',
    boardLocative: 'Okul Öğrenci Ödül ve Disiplin Kurulunda',
    boardDative: 'Okul Öğrenci Ödül ve Disiplin Kuruluna',
    boardAgentive: 'Okul Öğrenci Ödül ve Disiplin Kurulunca',
    boardGenitive: 'Okul Öğrenci Ödül ve Disiplin Kurulunun',
    boardOur: 'Okul Öğrenci Ödül ve Disiplin Kurulumuz',
    boardPresidentLabel: 'Okul Öğrenci Ödül ve Disiplin Kurulu Başkanı',
    boardPresidencyDative: 'Okul Öğrenci Ödül ve Disiplin Kurulu Başkanlığına',
    ek10SubNote: '(MEB Ortaöğretim Kurumları Yönetmeliği)',
    presidentName,
    presidentTitle,
    regulationShort: 'MEB Ortaöğretim Kurumları Yönetmeliği',
    regulationDefaultArticle: 'MEB Ortaöğretim Kurumları Yönetmeliği Madde 164',
    regulationRemovalArticle:
      'Millî Eğitim Bakanlığı Ortaöğretim Kurumları Yönetmeliğinin 171. Maddesi',
    regulationRemovalShort: 'MEB Ortaöğretim Kurumları Yönetmeliği 171. Maddesi',
    regulationRemovalSentence:
      'MEB Ortaöğretim Kurumları Yönetmeliğinin ilgili maddeleri'
  };
};
