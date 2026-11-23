/**
 * evrakplus.com WordPress Köprüsü (index.php + api.php)
 *
 * index.php, giriş yapmış WordPress üyesi için sayfaya window.__DISIPLIN_BRIDGE__ nesnesini ekler.
 * Bu servis:
 *  - Üyenin verisini WordPress hesabındaki "disiplin_data" alanından yükler,
 *  - Değişiklikleri (gecikmeli) sunucuya kaydeder,
 *  - Başka cihazda yapılan değişiklikleri sekmeye dönüldüğünde çeker,
 *  - Eski sürümden kalan tarayıcı verisini (localStorage) güvenle taşır,
 *  - Aynı tarayıcıda farklı üye giriş yaparsa önceki üyenin verisini ekrandan temizler.
 */
import { WarningAttachment } from '../types';
import { clearTombstones, getSettingsTs, getTombstones, setSettingsTs, Tombstones } from './syncMeta';

export interface BridgeConfig {
  v: number;
  apiUrl: string;
  nonce: string;
  user: { id: number; login: string; displayName: string; email?: string } | null;
  loginUrl: string;
  logoutUrl: string;
  homeUrl: string;
  programKey: string;
  appVersion: string;
}

declare global {
  interface Window {
    __DISIPLIN_BRIDGE__?: BridgeConfig;
  }
}

const OWNER_KEY = 'disiplin_owner_uid';
const REV_KEY = 'disiplin_sync_rev';
const HASH_KEY = 'disiplin_sync_hash';
const LAST_SYNC_KEY = 'disiplin_last_sync';
const NOGZIP_KEY = 'disiplin_no_gzip';
const LEGACY_BACKUP_KEY = 'eokul_legacy_local_backup';
const PENDING_PREFIX = 'disiplin_pending_';

// Üyeye ait uygulama verisi anahtarları (üye değişirse temizlenir)
const APP_DATA_KEYS = [
  'students', 'incidents', 'institutionSettings', 'boardSettings', 'gemini_api_key', 'gemini_preferred_model',
  'writtenWarnings', 'disiplin_tombstones', 'disiplin_settings_ts',
  'eokul_deleted_students', 'eokul_deleted_incidents', 'eokul_cloud_sync_config',
  REV_KEY, HASH_KEY, LAST_SYNC_KEY,
];

export const getRawBridge = (): BridgeConfig | null =>
  typeof window !== 'undefined' && window.__DISIPLIN_BRIDGE__ && window.__DISIPLIN_BRIDGE__.apiUrl ? window.__DISIPLIN_BRIDGE__ : null;

export const getBridge = (): (BridgeConfig & { user: { id: number; login: string; displayName: string; email?: string } }) | null => {
  const b = getRawBridge();
  return b && b.user && b.user.id > 0 ? (b as BridgeConfig & { user: { id: number; login: string; displayName: string; email?: string } }) : null;
};

export const isBridgeMode = (): boolean => getBridge() !== null;

export const isMemberLoggedIn = (): boolean => {
  if (getBridge() !== null) return true;
  try {
    const raw = localStorage.getItem('eokul_cloud_sync_config');
    if (raw) {
      const cfg = JSON.parse(raw);
      if (cfg && cfg.user && (cfg.user.username || cfg.user.email || cfg.user.wp_id || cfg.user.syncKey)) {
        return true;
      }
    }
  } catch { /* yoksay */ }
  return false;
};

export const getMemberLoginUrl = (): string => {
  const raw = getRawBridge();
  if (raw?.loginUrl) return raw.loginUrl;
  return 'https://www.evrakplus.com/giris';
};

export const requireMemberForDocumentOutput = (actionName = 'Döküman çıktısı (Yazdır / PDF / Word)'): boolean => {
  if (isMemberLoggedIn()) return true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('member-output-blocked', {
      detail: { actionName, loginUrl: getMemberLoginUrl() },
    }));
  }
  return false;
};

export const downloadJsonBackup = (): boolean => {
  try {
    const backupData = {
      backup_version: '3.2.0',
      export_date: new Date().toISOString(),
      metadata: {
        app_name: 'Disiplin Asistanı',
        database_version: '15',
      },
      data: {
        institutionSettings: JSON.parse(localStorage.getItem('institutionSettings') || '{}'),
        boardSettings: JSON.parse(localStorage.getItem('boardSettings') || '[]'),
        students: JSON.parse(localStorage.getItem('students') || '[]'),
        incidents: JSON.parse(localStorage.getItem('incidents') || '[]'),
        writtenWarnings: JSON.parse(localStorage.getItem('writtenWarnings') || '[]'),
        gemini_api_key: localStorage.getItem('gemini_api_key') || '',
      },
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `disiplin_asistani_yedek_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    alert('JSON yedek indirilirken bir hata oluştu: ' + e);
    return false;
  }
};

export type BridgeStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error' | 'auth';

let currentStatus: BridgeStatus = 'idle';
let lastError = '';

const emitStatus = (status: BridgeStatus, error?: string) => {
  currentStatus = status;
  lastError = error || '';
  if (typeof window === 'undefined') return;
  // Mevcut Sidebar bileşeni de bu olayı dinler
  window.dispatchEvent(new CustomEvent('cloud-sync-status', {
    detail: { status: status === 'synced' ? 'synced' : status, error, syncedAt: localStorage.getItem(LAST_SYNC_KEY), bridge: true },
  }));
};

export const getBridgeStatus = () => ({
  status: currentStatus,
  error: lastError,
  lastSyncedAt: (() => { try { return localStorage.getItem(LAST_SYNC_KEY); } catch { return null; } })(),
  rev: Number((() => { try { return localStorage.getItem(REV_KEY); } catch { return '0'; } })() || 0),
});

// --- Yardımcılar ---------------------------------------------------------

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
};

/** FNV-1a (32 bit) + uzunluk: değişiklik tespiti için hızlı özet */
const quickHash = (str: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ':' + str.length;
};

export interface BridgePayload {
  students: unknown[];
  incidents: unknown[];
  writtenWarnings: unknown[];
  institutionSettings: Record<string, unknown>;
  boardSettings: unknown[];
  gemini_api_key: string;
  settingsTs: Record<string, string>;
}

export const collectPayload = (): BridgePayload => ({
  students: readJson<unknown[]>('students', []),
  incidents: readJson<unknown[]>('incidents', []),
  writtenWarnings: readJson<unknown[]>('writtenWarnings', []),
  institutionSettings: readJson<Record<string, unknown>>('institutionSettings', {}),
  boardSettings: readJson<unknown[]>('boardSettings', []),
  gemini_api_key: (() => { try { return localStorage.getItem('gemini_api_key') || ''; } catch { return ''; } })(),
  settingsTs: getSettingsTs() as Record<string, string>,
});

const payloadHash = (p: BridgePayload) => quickHash(JSON.stringify(p));

const hasMeaningfulLocalData = (p: BridgePayload) =>
  (Array.isArray(p.students) && p.students.length > 0) ||
  (Array.isArray(p.incidents) && p.incidents.length > 0) ||
  (Array.isArray(p.writtenWarnings) && p.writtenWarnings.length > 0) ||
  (p.institutionSettings && Object.values(p.institutionSettings).some(v => typeof v === 'string' && v.trim() !== '' && v !== 'Lise'));

const isDirty = (): boolean => {
  const p = collectPayload();
  const stored = localStorage.getItem(HASH_KEY);
  if (!stored) return hasMeaningfulLocalData(p);
  const t = getTombstones();
  const hasTomb = Object.values(t).some(m => Object.keys(m).length > 0);
  return hasTomb || payloadHash(p) !== stored;
};

const clearAppData = () => {
  APP_DATA_KEYS.forEach(k => { try { localStorage.removeItem(k); } catch { /* yoksay */ } });
};

/** Sunucudan gelen veriyi yerel depoya yazar ve ekranları günceller. */
const applyServerData = (data: Record<string, unknown> | null | undefined, rev: number) => {
  if (!data || typeof data !== 'object') return;
  try {
    const setArr = (k: string) => { if (Array.isArray(data[k])) localStorage.setItem(k, JSON.stringify(data[k])); };
    setArr('students');
    setArr('incidents');
    setArr('writtenWarnings');
    setArr('boardSettings');
    if (data.institutionSettings && typeof data.institutionSettings === 'object' && !Array.isArray(data.institutionSettings)) {
      localStorage.setItem('institutionSettings', JSON.stringify(data.institutionSettings));
    }
    if (typeof data.gemini_api_key === 'string') {
      if (data.gemini_api_key) localStorage.setItem('gemini_api_key', data.gemini_api_key);
      else localStorage.removeItem('gemini_api_key');
    }
    setSettingsTs(data.settingsTs as Record<string, string> | undefined);
    localStorage.setItem(REV_KEY, String(rev));
    localStorage.setItem(HASH_KEY, payloadHash(collectPayload()));
  } catch (err) {
    console.error('Sunucu verisi yerel depoya yazılamadı:', err);
    emitStatus('error', 'Veriler tarayıcı depolamasına yazılamadı (depolama alanı dolu olabilir).');
    return;
  }
  window.dispatchEvent(new CustomEvent('app-data-synced', { detail: data }));
};

// --- HTTP ----------------------------------------------------------------

class AuthError extends Error {}

const withTimeout = (ms: number) => {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(id) };
};

const refreshNonce = async (): Promise<boolean> => {
  const b = getBridge();
  if (!b) return false;
  try {
    const res = await fetch(`${b.apiUrl}?action=nonce&_=${Date.now()}`, { credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 401) throw new AuthError('auth');
    const j = await res.json();
    if (j?.ok && j.nonce) {
      b.nonce = j.nonce;
      return true;
    }
  } catch (err) {
    if (err instanceof AuthError) throw err;
  }
  return false;
};

const gzipString = async (str: string): Promise<Blob | null> => {
  try {
    if (typeof CompressionStream === 'undefined') return null;
    if (localStorage.getItem(NOGZIP_KEY) === '1') return null;
    const stream = new Blob([str], { type: 'application/json' }).stream().pipeThrough(new CompressionStream('gzip'));
    return await new Response(stream).blob();
  } catch {
    return null;
  }
};

const apiCall = async (action: string, opts: { method?: 'GET' | 'POST'; body?: unknown; query?: string; timeoutMs?: number } = {}, retried = false): Promise<any> => {
  const b = getBridge();
  if (!b) throw new Error('Köprü etkin değil');
  const method = opts.method || 'GET';
  const url = `${b.apiUrl}?action=${encodeURIComponent(action)}${opts.query ? '&' + opts.query : ''}&_=${Date.now()}`;
  const headers: Record<string, string> = { 'X-WP-Nonce': b.nonce, 'X-Requested-With': 'DisiplinApp' };
  let body: BodyInit | undefined;
  let usedGzip = false;
  if (method === 'POST') {
    const json = JSON.stringify(opts.body ?? {});
    const gz = json.length > 4096 ? await gzipString(json) : null;
    if (gz) {
      body = gz;
      headers['Content-Type'] = 'application/octet-stream';
      headers['X-Body-Encoding'] = 'gzip';
      usedGzip = true;
    } else {
      body = json;
      headers['Content-Type'] = 'application/json';
    }
  }
  const t = withTimeout(opts.timeoutMs ?? 30000);
  let res: Response;
  try {
    res = await fetch(url, { method, headers, body, credentials: 'same-origin', cache: 'no-store', signal: t.signal });
  } finally {
    t.done();
  }
  let data: any = null;
  try { data = await res.json(); } catch { data = null; }

  if (res.status === 401) throw new AuthError(data?.error || 'Oturum sona erdi');
  if (res.status === 403 && data?.code === 'bad_nonce' && !retried) {
    if (await refreshNonce()) return apiCall(action, opts, true);
  }
  if (!res.ok || !data?.ok) {
    // Sıkıştırılmış gövde sunucu/güvenlik duvarı tarafından reddedildiyse düz JSON ile tekrar dene
    if (usedGzip && !retried && (res.status === 400 || res.status === 406 || res.status === 415 || res.status >= 500 || data?.code === 'bad_body')) {
      try { localStorage.setItem(NOGZIP_KEY, '1'); } catch { /* yoksay */ }
      return apiCall(action, opts, true);
    }
    throw new Error(data?.error || `Sunucu hatası (${res.status})`);
  }
  return data;
};

const handleError = (err: unknown) => {
  if (err instanceof AuthError) {
    emitStatus('auth', 'evrakplus.com oturumunuz sona ermiş. Verileriniz bu cihazda saklanıyor; tekrar giriş yaptığınızda eşitlenecek.');
    window.dispatchEvent(new CustomEvent('bridge-auth-required'));
    return;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    emitStatus('offline', 'İnternet bağlantısı yok. Değişiklikler bu cihazda saklanıyor.');
    return;
  }
  const msg = err instanceof Error ? (err.name === 'AbortError' ? 'Sunucu zaman aşımına uğradı.' : err.message) : String(err);
  emitStatus('error', msg);
};

// --- Kaydet / Çek -------------------------------------------------------------

let saving: Promise<void> | null = null;
let saveAgain = false;

const removeSentTombstones = (sent: Tombstones) => {
  const cur = getTombstones();
  (Object.keys(sent) as Array<keyof Tombstones>).forEach(col => {
    Object.entries(sent[col]).forEach(([id, ts]) => {
      if (cur[col][id] === ts) delete cur[col][id];
    });
  });
  const left = Object.values(cur).some(m => Object.keys(m).length > 0);
  if (!left) clearTombstones();
  else localStorage.setItem('disiplin_tombstones', JSON.stringify(cur));
};

const doSave = async (mode: 'normal' | 'union' = 'normal'): Promise<void> => {
  const payload = collectPayload();
  const tombstones = getTombstones();
  const baseRev = Number(localStorage.getItem(REV_KEY) || 0);
  emitStatus('syncing');
  const res = await apiCall('save', { method: 'POST', body: { baseRev, mode, data: payload, tombstones }, timeoutMs: 60000 });
  removeSentTombstones(tombstones);
  try { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()); } catch { /* yoksay */ }
  if (res.data) {
    // Sunucu başka cihazdan gelen değişikliklerle birleştirdi: birleşik veriyi uygula
    applyServerData(res.data, Number(res.rev));
  } else {
    localStorage.setItem(REV_KEY, String(res.rev));
    localStorage.setItem(HASH_KEY, payloadHash(payload));
  }
  emitStatus('synced');
};

export const saveNow = async (mode: 'normal' | 'union' = 'normal'): Promise<boolean> => {
  if (!isBridgeMode()) return false;
  if (saving) { saveAgain = true; await saving; return true; }
  let ok = true;
  saving = (async () => {
    try {
      await doSave(mode);
    } catch (err) {
      ok = false;
      handleError(err);
    }
  })();
  await saving;
  saving = null;
  if (saveAgain) {
    saveAgain = false;
    if (isDirty()) return saveNow();
  }
  return ok;
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** persistenceSync.triggerPersistenceSync tarafından her veri değişikliğinde çağrılır */
export const scheduleBridgeSave = () => {
  if (!isBridgeMode() || !bootDone) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!isDirty()) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) { emitStatus('offline'); return; }
    saveNow().catch(() => {});
  }, 2500);
};

/** Başka cihazdan yapılan değişiklikleri çeker */
export const pullNow = async (): Promise<void> => {
  if (!isBridgeMode() || saving) return;
  if (isDirty()) { await saveNow(); return; }
  const knownRev = Number(localStorage.getItem(REV_KEY) || 0);
  try {
    emitStatus('syncing');
    const res = await apiCall('load', { query: `knownRev=${knownRev}`, timeoutMs: 45000 });
    if (!res.unchanged && res.data) {
      if (isDirty()) { await saveNow(); return; } // bu arada yerelde değişiklik olduysa birleştir
      applyServerData(res.data, Number(res.rev));
    }
    try { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()); } catch { /* yoksay */ }
    emitStatus('synced');
  } catch (err) {
    handleError(err);
  }
};

// --- Açılış ----------------------------------------------------------------

let bootDone = false;

/**
 * React ekranı açılmadan önce çalışır. Üyenin verisini sunucudan yükler.
 * Sunucuya ulaşılamazsa cihazdaki son veriyle açılır ve bağlantı gelince eşitler.
 */
export const bridgeBoot = async (): Promise<void> => {
  const b = getBridge();
  if (!b) return;
  const uid = String(b.user.id);
  let mode: 'normal' | 'union' = 'normal';

  try {
    const owner = localStorage.getItem(OWNER_KEY);
    if (owner && owner !== uid) {
      // Aynı tarayıcıda başka bir üye çalışmış: onun verisi bu üyeye karışmasın.
      // O üyenin sunucuya gönderilememiş değişiklikleri varsa, tekrar giriş yaptığında gönderilmek üzere ayrılır.
      if (isDirty()) {
        try {
          localStorage.setItem(`${PENDING_PREFIX}${owner}`, JSON.stringify({
            payload: collectPayload(), tombstones: getTombstones(), rev: Number(localStorage.getItem(REV_KEY) || 0),
          }));
        } catch { /* depolama yetmezse atlanır */ }
      }
      clearAppData();
    } else if (!owner) {
      // Eski sürümden (köprü öncesi) kalan tarayıcı verisi
      const local = collectPayload();
      if (hasMeaningfulLocalData(local)) {
        const cfg = readJson<{ user?: { syncKey?: string; wp_id?: number | string } | null }>('eokul_cloud_sync_config', {});
        const legacyUser = cfg?.user;
        const belongsToUser = legacyUser && (legacyUser.syncKey === `wp_user_${uid}` || String(legacyUser.wp_id ?? '') === uid);
        if (belongsToUser || !legacyUser) {
          mode = 'union'; // sunucudaki veriyle birleştir (hiçbir kayıt silinmez)
        } else {
          try {
            localStorage.setItem(LEGACY_BACKUP_KEY, JSON.stringify({ savedAt: new Date().toISOString(), owner: legacyUser, data: local }));
          } catch { /* depolama yetmezse yalnızca temizle; veri eski hesabın sunucu kaydında duruyor */ }
          clearAppData();
        }
      }
      try { localStorage.removeItem('eokul_cloud_sync_config'); } catch { /* yoksay */ }
    }
    localStorage.setItem(OWNER_KEY, uid);

    // Bu üyenin daha önce bu tarayıcıda gönderilememiş değişiklikleri
    const pendingRaw = localStorage.getItem(`${PENDING_PREFIX}${uid}`);
    if (pendingRaw) {
      const pending = JSON.parse(pendingRaw) as { payload: BridgePayload; tombstones: Tombstones; rev: number };
      const p = pending.payload;
      localStorage.setItem('students', JSON.stringify(p.students || []));
      localStorage.setItem('incidents', JSON.stringify(p.incidents || []));
      localStorage.setItem('writtenWarnings', JSON.stringify(p.writtenWarnings || []));
      localStorage.setItem('institutionSettings', JSON.stringify(p.institutionSettings || {}));
      localStorage.setItem('boardSettings', JSON.stringify(p.boardSettings || []));
      if (p.gemini_api_key) localStorage.setItem('gemini_api_key', p.gemini_api_key);
      setSettingsTs(p.settingsTs);
      localStorage.setItem('disiplin_tombstones', JSON.stringify(pending.tombstones || {}));
      localStorage.setItem(REV_KEY, String(pending.rev || 0));
      localStorage.removeItem(HASH_KEY); // kirli kabul edilsin
      localStorage.removeItem(`${PENDING_PREFIX}${uid}`);
    }
  } catch (err) {
    console.warn('Yerel depo kontrolü yapılamadı:', err);
  }

  try {
    if (mode === 'union' || isDirty()) {
      await saveNow(mode);
    } else {
      const knownRev = Number(localStorage.getItem(REV_KEY) || 0);
      emitStatus('syncing');
      const res = await apiCall('load', { query: `knownRev=${knownRev}`, timeoutMs: 20000 });
      if (!res.unchanged && res.data) applyServerData(res.data, Number(res.rev));
      try { localStorage.setItem(LAST_SYNC_KEY, new Date().toISOString()); } catch { /* yoksay */ }
      emitStatus('synced');
    }
  } catch (err) {
    handleError(err);
  } finally {
    bootDone = true;
  }
};

/** React açıldıktan sonra çağrılır: çevrimiçi/odak olaylarında eşitleme */
export const initBridgeSync = () => {
  if (!isBridgeMode()) return;
  window.addEventListener('online', () => { if (isDirty()) saveNow(); else pullNow(); });
  window.addEventListener('offline', () => emitStatus('offline', 'İnternet bağlantısı yok. Değişiklikler bu cihazda saklanıyor.'));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pullNow();
    } else if (isDirty()) {
      saveNow();
    }
  });
  // Açık kalan sekmede başka cihazın değişikliklerini 90 sn'de bir kontrol et
  setInterval(() => {
    if (document.visibilityState === 'visible' && navigator.onLine && !saving) pullNow();
  }, 90000);
  window.addEventListener('beforeunload', (e) => {
    if (saving || saveTimer) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
};

// --- Ekler (imzalı tutanak taramaları) ---------------------------------------

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_INLINE_BYTES = 900 * 1024;

const readAsDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(blob);
});

/** Fotoğrafları (telefon kamerası vb.) makul boyuta küçültür */
const compressImage = async (file: File): Promise<Blob> => {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.78));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
};

export const uploadAttachment = async (warningId: string, file: File): Promise<WarningAttachment> => {
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const blob = await compressImage(file);
  const type = blob.type || file.type || 'application/octet-stream';
  const name = type === 'image/jpeg' && !/\.jpe?g$/i.test(file.name) ? file.name.replace(/\.[^.]+$/, '') + '.jpg' : file.name;
  if (blob.size > MAX_ATTACHMENT_BYTES) throw new Error('Dosya çok büyük (en fazla 5 MB).');
  const dataUrl = await readAsDataUrl(blob);
  const base: WarningAttachment = { id, name, type, size: blob.size, uploadedAt: new Date().toISOString(), storage: 'server' };
  if (isBridgeMode()) {
    await apiCall('att_put', { method: 'POST', body: { id, warningId, name, type, data: dataUrl.split(',')[1] || '' }, timeoutMs: 120000 });
    return base;
  }
  if (blob.size > MAX_INLINE_BYTES) throw new Error('Sunucu bağlantısı olmadan en fazla 900 KB dosya eklenebilir.');
  return { ...base, storage: 'inline', dataUrl };
};

export const getAttachmentUrl = (att: WarningAttachment): string | null => {
  if (att.storage === 'inline') return att.dataUrl || null;
  const b = getBridge();
  if (!b) return null;
  return `${b.apiUrl}?action=att_get&id=${encodeURIComponent(att.id)}&_n=${encodeURIComponent(b.nonce)}`;
};

export const deleteAttachment = async (att: WarningAttachment): Promise<void> => {
  if (att.storage !== 'server' || !isBridgeMode()) return;
  try {
    await apiCall('att_del', { method: 'POST', body: { id: att.id } });
  } catch (err) {
    console.warn('Ek silinemedi:', err);
  }
};

// --- Çıkış -----------------------------------------------------------------

/** Kaydedilmemiş değişiklikleri gönderir, sonra bu cihazdaki veriyi temizleyip oturumu kapatır (cikis.php). */
export const logoutBridge = async (): Promise<void> => {
  const b = getBridge();
  if (!b) return;
  if (isDirty()) {
    const ok = await saveNow();
    if (!ok && !window.confirm('Bazı değişiklikler henüz evrakplus.com hesabınıza kaydedilemedi. Çıkış yaparsanız bu cihazdaki kaydedilmemiş değişiklikler silinir. Yine de çıkılsın mı?')) {
      return;
    }
  }
  window.location.href = b.logoutUrl;
};
