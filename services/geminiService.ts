import { GoogleGenAI } from "@google/genai";
import { Incident, Student } from "../types";

// Helper to check connection
const isOnline = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);

// Primary and fallback models supported by Google Gemini Free & Paid Tiers
export const PRIMARY_MODEL = 'gemini-2.5-flash';
export const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash-lite'];

// Retrieve user's personal API Key from local storage (NO embedded / default keys)
export const getUserApiKey = (): string => {
  if (typeof localStorage === 'undefined') return '';
  return (localStorage.getItem('gemini_api_key') || '').trim();
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
}

/**
 * Validates a user-provided API key by testing across available models.
 * Gracefully handles Google Free Tier 503 (high demand) and 429 (temporary quota) errors,
 * ensuring valid keys can always be saved.
 */
export const validateApiKeyDetailed = async (key: string): Promise<KeyValidationResult> => {
  if (!isOnline()) {
    return {
      valid: false,
      errorType: 'NETWORK',
      message: 'İnternet bağlantısı bulunamadı. Lütfen ağ bağlantınızı kontrol ediniz.'
    };
  }

  const cleanKey = (key || '').trim();
  if (!cleanKey) {
    return {
      valid: false,
      errorType: 'UNAUTHENTICATED',
      message: 'Lütfen test etmek için bir API anahtarı giriniz.'
    };
  }

  const ai = new GoogleGenAI({ apiKey: cleanKey });
  const modelsToTest = [PRIMARY_MODEL, ...FALLBACK_MODELS];
  let lastError: unknown = null;
  let encounteredHighDemand503 = false;

  for (const model of modelsToTest) {
    try {
      await ai.models.generateContent({
        model,
        contents: 'Merhaba',
      });
      return {
        valid: true,
        message: `API Anahtarı başarıyla doğrulandı ve çalışıyor (${model}).`
      };
    } catch (error: unknown) {
      lastError = error;
      const errObj = error as { message?: string; status?: number; code?: number; error?: { code?: number; message?: string } };
      const errorStr = (errObj?.message || String(error) || JSON.stringify(error)).toLowerCase();

      // 403 PERMISSION_DENIED
      if (
        errorStr.includes('403') ||
        errorStr.includes('permission_denied') ||
        errorStr.includes('caller does not have permission')
      ) {
        console.warn("API Key Validation: 403 PERMISSION_DENIED for user key:", error);
        return {
          valid: false,
          statusCode: 403,
          errorType: 'PERMISSION_DENIED',
          message:
            'Erişim İzni Hatası (403): Girdiğiniz API anahtarının "Generative Language API" (Gemini) kullanım izni bulunmuyor veya Google Cloud projenizde API etkinleştirilmemiş / anahtar kısıtlamaları (IP/HTTP Referrer) isteği engelliyor. Lütfen Google AI Studio (aistudio.google.com/app/apikey) üzerinden yeni ve kısıtlamasız bir anahtar oluşturup deneyiniz.'
        };
      }

      // 401 / 400 UNAUTHENTICATED
      if (
        errorStr.includes('400') ||
        errorStr.includes('401') ||
        errorStr.includes('unauthenticated') ||
        errorStr.includes('api_key_invalid') ||
        errorStr.includes('invalid api key')
      ) {
        return {
          valid: false,
          statusCode: 401,
          errorType: 'UNAUTHENTICATED',
          message: 'Geçersiz API Anahtarı (401/400): Girilen anahtar hatalı ya da silinmiş.'
        };
      }

      // 429 QUOTA EXCEEDED (Free tier rate limit reached - Key IS valid)
      if (errorStr.includes('429') || errorStr.includes('resource_exhausted') || errorStr.includes('quota')) {
        return {
          valid: true,
          statusCode: 429,
          errorType: 'QUOTA_EXCEEDED',
          message: 'API Anahtarınız geçerli ancak ücretsiz kotası anlık olarak dolu (429). Anahtarı güvenle kaydedebilirsiniz; birkaç dakika sonra kullanıma açılacaktır.'
        };
      }

      // 503 UNAVAILABLE / High Demand on specific model -> Try next model
      if (errorStr.includes('503') || errorStr.includes('high demand') || errorStr.includes('unavailable') || errorStr.includes('overloaded')) {
        encounteredHighDemand503 = true;
        continue;
      }

      // 404 NOT_FOUND -> Try next model
      if (errorStr.includes('404') || errorStr.includes('not_found')) {
        continue;
      }
    }
  }

  // If models returned 503 high demand but key was NOT rejected as invalid (401/403)
  if (encounteredHighDemand503) {
    return {
      valid: true,
      message: 'API Anahtarınız geçerli ve doğrulandı! (Google sunucularında anlık model yoğunluğu var, anahtarınızı güvenle kaydedebilirsiniz).'
    };
  }

  const errObj = lastError as { message?: string; status?: number; code?: number; error?: { code?: number; message?: string } };
  return {
    valid: false,
    statusCode: 500,
    errorType: 'UNKNOWN',
    message: `Doğrulama başarısız oldu: ${errObj?.message || 'Bilinmeyen hata'}`
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
 * Runs an AI task using ONLY the user's personal API key.
 * If no key is set, prompts the user to configure their key in Settings.
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

  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];
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
        return response.text;
      }
    } catch (err: unknown) {
      lastError = err;
      const errObj = err as { message?: string };
      const errStr = (errObj?.message || String(err) || JSON.stringify(err)).toLowerCase();

      // 403 PERMISSION_DENIED
      if (
        errStr.includes('403') ||
        errStr.includes('permission_denied') ||
        errStr.includes('caller does not have permission')
      ) {
        return "⚠️ API Erişim İzni Hatası (403): Girdiğiniz Gemini API anahtarının bu işlem için izni bulunmuyor veya Google Cloud projenizde Generative Language API etkinleştirilmemiş / anahtar kısıtlamaları (IP/HTTP Referrer) isteği engelliyor. Lütfen Google AI Studio (aistudio.google.com/app/apikey) adresinden kısıtlamasız yeni bir anahtar oluşturup Ayarlar sayfasından güncelleyiniz.";
      }

      // 401 / 400 UNAUTHENTICATED
      if (
        errStr.includes('400') ||
        errStr.includes('401') ||
        errStr.includes('unauthenticated') ||
        errStr.includes('api_key_invalid') ||
        errStr.includes('invalid api key')
      ) {
        return "⚠️ Geçersiz API Anahtarı (401/400): Girilen API anahtarı geçersiz veya silinmiş. Lütfen Ayarlar sayfasından anahtarınızı kontrol ediniz.";
      }

      // If tools (e.g. googleSearch) failed due to 429 quota, retry immediately without tools
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

      // 429 QUOTA - continue to try next fallback model (quota is per-model in Free tier)
      if (errStr.includes('429') || errStr.includes('resource_exhausted') || errStr.includes('quota')) {
        continue;
      }

      // If 503, 404 or overloaded, continue to next model in loop
      if (errStr.includes('503') || errStr.includes('404') || errStr.includes('unavailable') || errStr.includes('high demand') || errStr.includes('overloaded')) {
        continue;
      }
    }
  }

  const lastErrStr = (lastError as { message?: string })?.message?.toLowerCase() || '';
  if (lastErrStr.includes('429') || lastErrStr.includes('quota')) {
    return "⚠️ İstek Sınırı / Kota Dolu (429): Google ücretsiz Gemini API anlık kullanım kotası dolmuştur. Lütfen 1-2 dakika sonra tekrar deneyiniz.";
  }
  if (lastErrStr.includes('503') || lastErrStr.includes('high demand') || lastErrStr.includes('unavailable')) {
    return "⚠️ Google Sunucu Yoğunluğu (503): Google Gemini modellerinde şu anda geçici bir yoğunluk yaşanıyor. Lütfen biraz sonra tekrar deneyiniz.";
  }

  console.error("Gemini Execution Error:", lastError);
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
