import { GoogleGenAI } from "@google/genai";
import { Incident, Student } from "../types";

// Helper to check connection
const isOnline = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);

// Supported Google Gemini models across Free, Paid, Vertex AI and AI Studio tiers
export const MODEL_OPTIONS = [
  { id: 'auto', name: 'Otomatik Seçim (Önerilen - En Uygun Modeli Otomatik Bulur)' },
  { id: 'gemini-2.0-flash', name: 'Google Gemini 2.0 Flash (Hızlı & Yeni Nesil)' },
  { id: 'gemini-1.5-flash', name: 'Google Gemini 1.5 Flash (En Yüksek Hesap & Kota Uyumu)' },
  { id: 'gemini-2.0-flash-lite', name: 'Google Gemini 2.0 Flash-Lite (Hafif & Yüksek Kota)' },
  { id: 'gemini-2.5-flash', name: 'Google Gemini 2.5 Flash (Gelişmiş Önizleme)' },
  { id: 'gemini-1.5-flash-8b', name: 'Google Gemini 1.5 Flash-8B (Hızlı 8B)' },
  { id: 'gemini-1.5-pro', name: 'Google Gemini 1.5 Pro (Derin Mantıksal Analiz)' },
  { id: 'gemini-2.5-pro', name: 'Google Gemini 2.5 Pro (Gelişmiş Pro Önizleme)' },
] as const;

export const DEFAULT_MODEL_CANDIDATES = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-2.5-pro'
];

export const PRIMARY_MODEL = 'gemini-2.0-flash';
export const FALLBACK_MODELS = [
  'gemini-1.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-2.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro'
];

/**
 * Normalizes user-provided API key by stripping quotes, whitespace, Bearer prefix, or env assignments.
 */
export const cleanApiKey = (raw: string): string => {
  if (!raw) return '';
  let key = raw.trim();
  // Strip surrounding quotes
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  // Strip Bearer prefix if copied from HTTP Authorization header
  if (key.toLowerCase().startsWith('bearer ')) {
    key = key.slice(7).trim();
  }
  // Strip assignment prefix like "GEMINI_API_KEY=" or "API_KEY="
  if (key.includes('=')) {
    const parts = key.split('=');
    key = parts[parts.length - 1].trim();
  }
  // Strip accidental brackets or quotes or control chars
  key = key.replace(/^["'\[\{\s]+|["'\]\}\s]+$/g, '');
  return key;
};

export const getModelFriendlyName = (modelId: string): string => {
  const match = MODEL_OPTIONS.find(m => m.id === modelId);
  if (match && match.id !== 'auto') return match.name;
  return modelId;
};

export const getPreferredModel = (): string => {
  if (typeof localStorage === 'undefined') return 'auto';
  return (localStorage.getItem('gemini_preferred_model') || 'auto').trim();
};

export const setPreferredModel = (model: string): void => {
  if (typeof localStorage === 'undefined') return;
  const clean = (model || 'auto').trim();
  if (clean === 'auto') {
    localStorage.removeItem('gemini_preferred_model');
  } else {
    localStorage.setItem('gemini_preferred_model', clean);
  }
};

// Retrieve user's personal API Key from local storage (NO embedded / default keys)
export const getUserApiKey = (): string => {
  if (typeof localStorage === 'undefined') return '';
  return cleanApiKey(localStorage.getItem('gemini_api_key') || '');
};

// System instruction for the "Discipline Expert" persona
const SYSTEM_INSTRUCTION = `
Sen Türk Milli Eğitim Bakanlığı yönetmeliklerine hakim, tecrübeli bir okul müdür yardımcısı ve disiplin kurulu uzmanısın. 
Görevin, okulda yaşanan disiplin olaylarını analiz etmek, ilgili yönetmelik maddelerini bulmak ve resmi evrak (tutanak, savunma isteme, karar) taslakları hazırlamaktır.
Her zaman resmi, tarafsız ve yapıcı bir dil kullan.
`;

export interface KeyValidationResult {
  valid: boolean;
  message: string;
  statusCode?: number;
  errorType?: 'PERMISSION_DENIED' | 'UNAUTHENTICATED' | 'QUOTA_EXCEEDED' | 'NETWORK' | 'UNKNOWN';
  workingModel?: string;
}

/**
 * Validates a user-provided API key by testing across available models in order.
 * Gracefully handles 403 model permissions, 503 high demand, and 429 quota errors,
 * ensuring any key that supports at least one Gemini model is accepted.
 */
export const validateApiKeyDetailed = async (
  key: string,
  preferredModelId?: string
): Promise<KeyValidationResult> => {
  if (!isOnline()) {
    return {
      valid: false,
      errorType: 'NETWORK',
      message: 'İnternet bağlantısı bulunamadı. Lütfen ağ bağlantınızı kontrol ediniz.'
    };
  }

  const cleanKey = cleanApiKey(key);
  if (!cleanKey) {
    return {
      valid: false,
      errorType: 'UNAUTHENTICATED',
      message: 'Lütfen test etmek için bir API anahtarı giriniz.'
    };
  }

  const ai = new GoogleGenAI({ apiKey: cleanKey });

  // Belirli bir model seçildiyse onu en başa al, ardından diğer tüm modelleri sırala
  const targetModel = preferredModelId && preferredModelId !== 'auto' ? preferredModelId : getPreferredModel();
  const candidateModels: string[] = [];
  if (targetModel && targetModel !== 'auto' && DEFAULT_MODEL_CANDIDATES.includes(targetModel)) {
    candidateModels.push(targetModel);
  }
  for (const m of DEFAULT_MODEL_CANDIDATES) {
    if (!candidateModels.includes(m)) {
      candidateModels.push(m);
    }
  }

  let lastError: unknown = null;
  let encounteredQuota429 = false;
  let quotaModel = '';
  let encountered503 = false;
  let permissionDeniedCount = 0;
  let authFailed = false;

  for (const model of candidateModels) {
    try {
      await ai.models.generateContent({
        model,
        contents: 'Merhaba',
      });
      // Başarılı! Çalışan modeli hatırla
      if (!targetModel || targetModel === 'auto') {
        localStorage.setItem('gemini_preferred_model', model);
      }
      return {
        valid: true,
        workingModel: model,
        message: `API Anahtarı başarıyla doğrulandı ve çalışıyor! (${getModelFriendlyName(model)})`
      };
    } catch (error: unknown) {
      lastError = error;
      const errObj = error as { message?: string; status?: number; code?: number };
      const errorStr = (errObj?.message || String(error) || JSON.stringify(error)).toLowerCase();

      // 401 / 400 UNAUTHENTICATED (Anahtarın kendisi geçersizse)
      if (
        errorStr.includes('api_key_invalid') ||
        errorStr.includes('invalid api key') ||
        (errorStr.includes('400') && errorStr.includes('api key not valid')) ||
        (errorStr.includes('401') && !errorStr.includes('quota'))
      ) {
        authFailed = true;
        break; // Geçersiz anahtar hiçbir modelde çalışmaz
      }

      // 429 QUOTA EXCEEDED (Kota doluysa anahtar KESİNLİKLE GEÇERLİDİR)
      if (errorStr.includes('429') || errorStr.includes('resource_exhausted') || errorStr.includes('quota')) {
        encounteredQuota429 = true;
        quotaModel = model;
        // Diğer modellerin kotası boş olabilir, denemeye devam et
        continue;
      }

      // 403 PERMISSION_DENIED (Belirli bir modele izin verilmeyebilir veya bölgesel kısıtlama olabilir)
      // DİKKAT: Diğer modelleri denemek için döngüye DEVAM ET!
      if (
        errorStr.includes('403') ||
        errorStr.includes('permission_denied') ||
        errorStr.includes('caller does not have permission')
      ) {
        permissionDeniedCount++;
        continue;
      }

      // 503 / 500 / High demand / Overloaded -> sonraki modele geç
      if (
        errorStr.includes('503') ||
        errorStr.includes('500') ||
        errorStr.includes('high demand') ||
        errorStr.includes('unavailable') ||
        errorStr.includes('overloaded')
      ) {
        encountered503 = true;
        continue;
      }

      // 404 NOT_FOUND (Model bu hesapta veya bölgede mevcut değil) -> sonraki modele geç
      if (errorStr.includes('404') || errorStr.includes('not_found')) {
        continue;
      }
    }
  }

  // Eğer anahtar geçersizse
  if (authFailed) {
    return {
      valid: false,
      statusCode: 401,
      errorType: 'UNAUTHENTICATED',
      message: 'Geçersiz API Anahtarı (401/400): Girilen anahtar hatalı veya Google tarafından silinmiş. Lütfen Google AI Studio üzerinden aldığınız anahtarı kontrol ediniz.'
    };
  }

  // Eğer modellerden birinde 429 kota sınırı alındıysa (anahtar geçerlidir)
  if (encounteredQuota429) {
    if (quotaModel) {
      localStorage.setItem('gemini_preferred_model', quotaModel);
    }
    return {
      valid: true,
      statusCode: 429,
      workingModel: quotaModel || 'gemini-1.5-flash',
      errorType: 'QUOTA_EXCEEDED',
      message: `API Anahtarınız geçerli (${getModelFriendlyName(quotaModel || 'gemini-1.5-flash')}) ancak Google ücretsiz kullanım kotanız anlık olarak dolu (429). Anahtarı güvenle kaydedebilirsiniz; birkaç dakika sonra kullanıma açılacaktır.`
    };
  }

  // Eğer tüm modeller 403 erişim izni hatası verdiyse (Genel API veya Cloud kısıtlaması)
  if (permissionDeniedCount === candidateModels.length) {
    return {
      valid: false,
      statusCode: 403,
      errorType: 'PERMISSION_DENIED',
      message:
        'Erişim İzni Hatası (403): Girdiğiniz API anahtarının "Generative Language API" (Gemini) kullanım izni bulunmuyor veya Google Cloud projenizde anahtar kısıtlamaları (IP/HTTP Referrer) isteği engelliyor. Lütfen Google AI Studio (aistudio.google.com/app/apikey) üzerinden kısıtlamasız yeni bir ücretsiz anahtar alıp deneyiniz.'
    };
  }

  // Eğer sunucu geçici yoğunluk (503) verdiyse
  if (encountered503) {
    return {
      valid: true,
      message: 'API Anahtarınız geçerli ve doğrulandı! (Google sunucularında anlık model yoğunluğu yaşanıyor, anahtarınızı güvenle kaydedebilirsiniz).'
    };
  }

  const errObj = lastError as { message?: string };
  return {
    valid: false,
    statusCode: 500,
    errorType: 'UNKNOWN',
    message: `Doğrulama başarısız oldu: ${errObj?.message || 'Bilinmeyen hata oluştu. Lütfen anahtarınızı ve internet bağlantınızı kontrol ediniz.'}`
  };
};

export const validateApiKey = async (key: string): Promise<boolean> => {
  const result = await validateApiKeyDetailed(key);
  return result.valid;
};

interface AiExecutionOptions {
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  tools?: Record<string, unknown>[];
}

/**
 * Runs an AI task using the user's personal API key with multi-model fallback.
 * Tries the user's preferred model first, then falls back through the supported candidates.
 */
export const runAiPrompt = async (
  options: AiExecutionOptions,
  fallbackMessage: string
): Promise<string> => {
  if (!isOnline()) {
    return "⚠️ İNTERNET BAĞLANTISI YOK\n\nCihazınız çevrimdışı olduğu için Yapay Zeka işlemi gerçekleştirilemiyor. Lütfen internet bağlantınızı kontrol ediniz.";
  }

  const userKey = getUserApiKey();
  if (!userKey) {
    return "⚠️ Gemini API Anahtarı Tanımlanmamış: Yapay zeka özelliklerini kullanabilmek için lütfen 'Ayarlar > Yapay Zeka (AI)' sekmesinden kendi ücretsiz Google Gemini API anahtarınızı giriniz.";
  }

  // Aktif/tercih edilen modeli en başa al, ardından diğer tüm modelleri sırala
  const preferred = getPreferredModel();
  const modelsToTry: string[] = [];
  if (preferred && preferred !== 'auto' && DEFAULT_MODEL_CANDIDATES.includes(preferred)) {
    modelsToTry.push(preferred);
  }
  for (const m of DEFAULT_MODEL_CANDIDATES) {
    if (!modelsToTry.includes(m)) {
      modelsToTry.push(m);
    }
  }

  let lastError: unknown = null;
  const ai = new GoogleGenAI({ apiKey: userKey });

  for (const model of modelsToTry) {
    try {
      const config: { systemInstruction?: string; temperature?: number; tools?: Record<string, unknown>[] } = {};
      if (options.systemInstruction) config.systemInstruction = options.systemInstruction;
      if (typeof options.temperature === 'number') config.temperature = options.temperature;
      if (options.tools && options.tools.length > 0) config.tools = options.tools;

      const response = await ai.models.generateContent({
        model,
        contents: options.prompt,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      if (response.text) {
        // Otomatik moddaysa çalışan modeli bir sonraki çağrılar için önceliklendir
        if (preferred === 'auto') {
          localStorage.setItem('gemini_preferred_model', model);
        }
        return response.text;
      }
    } catch (err: unknown) {
      lastError = err;
      const errObj = err as { message?: string };
      const errStr = (errObj?.message || String(err) || JSON.stringify(err)).toLowerCase();

      // Anahtar tamamen geçersizse diğer modelleri denemeye gerek yok
      if (
        errStr.includes('api_key_invalid') ||
        errStr.includes('invalid api key') ||
        (errStr.includes('400') && errStr.includes('api key not valid')) ||
        (errStr.includes('401') && !errStr.includes('quota'))
      ) {
        return "⚠️ Geçersiz API Anahtarı (401/400): Girilen API anahtarı geçersiz veya silinmiş. Lütfen 'Ayarlar > Yapay Zeka (AI)' sayfasından anahtarınızı kontrol ediniz.";
      }

      // Eğer araçlar (ör. web search) 429 kota hatası verdiyse, aynı modeli araçsız hemen bir kez dene
      if (options.tools && options.tools.length > 0 && (errStr.includes('429') || errStr.includes('quota') || errStr.includes('resource_exhausted'))) {
        try {
          const fallbackResponse = await ai.models.generateContent({
            model,
            contents: options.prompt,
            config: options.systemInstruction ? { systemInstruction: options.systemInstruction } : undefined,
          });
          if (fallbackResponse.text) {
            return fallbackResponse.text;
          }
        } catch (noToolErr) {
          lastError = noToolErr;
        }
      }

      // 403 (Modele izin yok), 404 (Model yok), 429 (Kota dolu), 503/500 (Yoğunluk) durumunda
      // DÖNGÜDEN ÇIKMA! Sıradaki diğer uyumlu modele geç!
      continue;
    }
  }

  const lastErrStr = (lastError as { message?: string })?.message?.toLowerCase() || '';
  if (lastErrStr.includes('403') || lastErrStr.includes('permission_denied')) {
    return "⚠️ API Erişim İzni Hatası (403): Girdiğiniz Gemini API anahtarının modelleri kullanma izni bulunmuyor veya Google Cloud projenizde Generative Language API etkinleştirilmemiş / anahtar kısıtlamaları bulunuyor. Lütfen Google AI Studio (aistudio.google.com/app/apikey) adresinden kısıtlamasız yeni bir anahtar alıp Ayarlar sayfasından güncelleyiniz.";
  }
  if (lastErrStr.includes('429') || lastErrStr.includes('quota')) {
    return "⚠️ İstek Sınırı / Kota Dolu (429): Google ücretsiz Gemini API anlık kullanım kotası dolmuştur. Lütfen 1-2 dakika sonra tekrar deneyiniz.";
  }
  if (lastErrStr.includes('503') || lastErrStr.includes('high demand') || lastErrStr.includes('unavailable') || lastErrStr.includes('overloaded')) {
    return "⚠️ Google Sunucu Yoğunluğu (503): Google Gemini modellerinde şu anda geçici bir yoğunluk yaşanıyor. Lütfen biraz sonra tekrar deneyiniz.";
  }

  console.error("Gemini Execution Error across all fallback models:", lastError);
  return fallbackMessage;
};

export const analyzeIncident = async (incident: Incident, student: Student | Student[]): Promise<string> => {
  const studentsList = Array.isArray(student) ? student : [student];
  const studentsStr = studentsList.map(s => `${s.name} (${s.grade} - ${s.number})`).join(", ");

  const prompt = `
    Aşağıdaki olayı analiz et:
    
    Öğrenciler: ${studentsStr}
    Tarih: ${incident.date}
    Yer: ${incident.location}
    Olay Tanımı: ${incident.description}
    
    Lütfen bu olayın ciddiyetini değerlendir, hangi disiplin maddesinin ihlal edilmiş olabileceğini belirt ve izlenmesi gereken yasal süreci adım adım özetle.
    
    ÖNEMLİ: 
    1. Çıktı sadece "Analiz ve Yol Haritası" raporu olmalı.
    2. Asla tutanak, dilekçe veya savunma isteme yazısı gibi "boş belge taslakları" oluşturma.
    3. Doğrudan konuya gir, başlıkları net kullan.
    4. Rapor dili resmi ve teknik olsun.
  `;

  return runAiPrompt(
    {
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.3
    },
    "Analiz sırasında bir hata oluştu. Lütfen Ayarlar kısmından API anahtarınızı kontrol edin."
  );
};

export const getPenaltyRecommendation = async (incident: Incident, student: Student, schoolType: string): Promise<string> => {
  const prompt = `
    Aşağıdaki disiplin olayını inceleyerek öğrenciye verilmesi gereken en uygun cezayı ve dayandığı yönetmelik maddesini tespit et.

    Okul Türü: ${schoolType} (Buna göre Lise için Ortaöğretim Kurumları Yön. Madde 164, Ortaokul için İlköğretim Kurumları Yön. Madde 55'i baz al.)
    
    Öğrenci Bilgisi:
    - Adı: ${student.name}
    - Sınıfı: ${student.grade}
    - Önceki Durumu: (Sistemde kayıtlı değilse ilk kez ceza alıyor varsay)

    Olay Bilgisi:
    - Olay Adı: ${incident.title}
    - Açıklama: ${incident.description}
    - Yer/Tarih: ${incident.location} / ${incident.date}

    İSTENEN ÇIKTI FORMATI:
    Lütfen cevabını sadece aşağıdaki başlıklar altında kısa ve net ver:
    
    1. ÖNERİLEN CEZA: (Örn: KINAMA, KISA SÜRELİ UZAKLAŞTIRMA vb.)
    2. İLGİLİ MADDE: (Örn: Madde 164/2-a bendi)
    3. MADDENİN İÇERİĞİ: (Maddenin yönetmelikteki tam metni)
    4. GEREKÇE: (Neden bu cezanın uygun olduğunu 1-2 cümle ile açıkla)
    5. DİKKAT EDİLMESİ GEREKEN HUSUSLAR: (Varsa rehberlik tedbiri vs.)
  `;

  return runAiPrompt(
    {
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.3
    },
    "Ceza önerisi alınırken bir hata oluştu. API anahtarını kontrol ediniz."
  );
};

export const generateDocument = async (type: 'defense' | 'summons' | 'decision', incident: Incident, student: Student): Promise<string> => {
  let typeText = "";
  if (type === 'defense') typeText = "Öğrenci Savunma İsteme Yazısı";
  else if (type === 'summons') typeText = "Veli Çağrı Pusulası";
  else if (type === 'decision') typeText = "Disiplin Kurulu Karar Tutanağı Taslağı";

  const prompt = `
    Aşağıdaki bilgiler ışığında resmi bir "${typeText}" hazırla. Metin boşluk doldurma formatında değil, doğrudan kullanılabilir bir taslak olmalı.
    
    Öğrenci: ${student.name}
    Sınıf/No: ${student.grade} / ${student.number}
    Olay: ${incident.description}
    Tarih: ${incident.date}
  `;

  return runAiPrompt(
    {
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.4
    },
    "Belge oluşturulamadı."
  );
};

export const generateDecisionReason = async (incident: Incident, student: Student, penalty: string, schoolType: string): Promise<string> => {
  const prompt = `
    Aşağıdaki disiplin olayı için, verilen cezaya uygun resmi bir "Gerekçe / Dayanak Maddesi" metni yaz.
    
    Okul Türü: ${schoolType} (Lise ise Ortaöğretim Kurumları Yön. Madde 164, Ortaokul ise İlköğretim Yön. Madde 55'i baz alarak madde numarası belirt.)
    
    Olay: ${incident.description}
    Verilen Ceza: ${penalty}
    
    İSTENEN ÇIKTI:
    Sadece Karar Formuna yazılacak metni ver. Giriş cümlesi "Milli Eğitim Bakanlığı .... Yönetmeliğinin ... maddesi gereğince..." şeklinde başlasın ve olayı özetleyerek bu cezanın neden verildiğini resmi dille açıklasın. 
    Çok uzun olmasın, formdaki kutuya sığacak şekilde 1-2 paragraf olsun.
  `;

  return runAiPrompt(
    {
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.3
    },
    "Gerekçe oluşturulurken hata oluştu."
  );
};

export const searchRegulations = async (query: string): Promise<string> => {
  const prompt = `
    Kullanıcı şu konuda mevzuat/yönetmelik bilgisi arıyor: "${query}".
    
    Lütfen cevabı verirken aşağıdaki İKİ resmi kaynağı temel al ve tarayarak cevapla:
    
    1. MEB Ortaöğretim Kurumları Yönetmeliği (Lise)
    2. MEB Okul Öncesi Eğitim ve İlköğretim Kurumları Yönetmeliği (İlkokul / Ortaokul)

    Sorunun içeriğine göre (ortaokul veya lise ayrımı varsa) ilgili yönetmeliği referans göster. Madde numaralarını belirterek (Örn: Madde 164'e göre...) net bir açıklama yap.
  `;

  return runAiPrompt(
    {
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2
    },
    "Yönetmelik araması başarısız oldu. API anahtarınızı kontrol ediniz."
  );
};

export const fetchBoardInfoFromUrl = async (url: string, schoolType: string): Promise<string> => {
  const prompt = `
    Sen bir mevzuat uzmanısın. Aşağıdaki resmi mevzuat bağlantısını referans alarak, "${schoolType}" türündeki okullar için oluşturulması gereken "Öğrenci Davranışlarını Değerlendirme Kurulu" veya "Disiplin Kurulu"nun:
    1. Kimin başkanlığında toplandığını,
    2. Hangi üyelerden oluştuğunu (asil ve yedek),
    3. Veli veya öğrenci temsilcisi durumunu
    
    Maddeler halinde, net ve kısa bir özet olarak Türkçe yaz.
    
    Mevzuat Adresi: ${url}
  `;

  return runAiPrompt(
    {
      prompt,
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2
    },
    "Mevzuat bilgisi alınamadı. Lütfen API anahtarınızı ve internet bağlantınızı kontrol ediniz."
  );
};
