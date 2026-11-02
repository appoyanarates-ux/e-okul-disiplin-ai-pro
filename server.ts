import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Helper to get effective API Key (supporting request-specific user key or env)
const getApiKey = (req?: Request): string => {
  const reqKey = (req?.headers['x-api-key'] as string) || (req?.body?.apiKey as string);
  if (reqKey && typeof reqKey === 'string' && reqKey.trim()) {
    return reqKey.trim();
  }
  let key = process.env.GEMINI_API_KEY || process.env.API_KEY || '';
  if (!key || key === 'MY_GEMINI_API_KEY') {
    const envPath = path.resolve(__dirname, '.env.local');
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        const match = content.match(/GEMINI_API_KEY=([^\r\n]+)/);
        if (match && match[1]) {
          key = match[1].trim();
        }
      } catch {
        // ignore
      }
    }
  }
  return key;
};

// Helper to get GoogleGenAI client
const getAiClient = (req?: Request) => {
  const apiKey = getApiKey(req);
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  return new GoogleGenAI({ apiKey });
};

// Default system instruction for discipline assistant
const DEFAULT_SYSTEM_INSTRUCTION = `
Sen Türk Milli Eğitim Bakanlığı yönetmeliklerine hakim, tecrübeli bir okul müdür yardımcısı ve disiplin kurulu uzmanısın.
Görevin, okulda yaşanan disiplin olaylarını analiz etmek, ilgili yönetmelik maddelerini bulmak ve resmi evrak (tutanak, savunma isteme, karar) taslakları hazırlamaktır.
Her zaman resmi, tarafsız ve yapıcı bir dil kullan.
`;

// Health check endpoint
app.get('/api/gemini/health', (_req: Request, res: Response) => {
  const key = getApiKey();
  const hasKey = Boolean(key && key !== 'MY_GEMINI_API_KEY');
  res.json({
    status: 'ok',
    model: 'gemini-3.8-flash',
    hasKey,
    message: hasKey ? 'Gemini AI servisi hazır' : 'API anahtarı henüz tanımlanmamış'
  });
});

// Unified Gemini Generation Proxy Route
app.post('/api/gemini/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, systemInstruction, temperature, useGoogleSearch } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Geçersiz veya boş prompt parametresi.' });
      return;
    }

    const ai = getAiClient(req);
    const config: Record<string, unknown> = {
      systemInstruction: systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
    };

    if (typeof temperature === 'number') {
      config.temperature = temperature;
    }

    if (useGoogleSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config,
    });

    res.json({ text: response.text || '' });
  } catch (error: unknown) {
    console.error('Gemini Server Proxy Error:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage === 'GEMINI_API_KEY_MISSING') {
      res.status(503).json({
        error: 'Sistemde GEMINI_API_KEY tanımlı değil. Lütfen sunucu ortam değişkenlerini kontrol ediniz.'
      });
      return;
    }

    res.status(500).json({
      error: 'Yapay zekâ yanıtı oluşturulurken bir hata oluştu.',
      details: errorMessage
    });
  }
});

// Setup Vite middleware or Static files
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((req: Request, res: Response) => {
      if (req.path.startsWith('/api')) {
        res.status(404).json({ error: 'Endpoint bulunamadı' });
        return;
      }
      const indexPath = path.resolve(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(200).send('<!DOCTYPE html><html><body><h1>Uygulama yükleniyor...</h1></body></html>');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Sunucu port ${PORT} üzerinde çalışıyor (${isProduction ? 'production' : 'development'}).`);
  });
}

startServer().catch((err) => {
  console.error('Sunucu başlatılırken hata oluştu:', err);
  process.exit(1);
});
