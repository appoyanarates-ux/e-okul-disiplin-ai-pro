/**
 * E-Okul Disiplin AI Pro - Bulut Senkronizasyon Servisi
 * Hem Web (evrakplus.com) hem Masaüstü (Electron) arasında çift yönlü veri eşitleme sağlar.
 * By Abdullah Yanarateş
 */

import { triggerPersistenceSync } from './persistenceSync';

export interface CloudUser {
  username: string;
  displayName: string;
  token: string;
  syncKey: string;
}

export interface CloudSyncConfig {
  user: CloudUser | null;
  autoSync: boolean;
  lastSyncedAt: string | null;
  endpointUrl: string;
}

const STORAGE_KEY = 'eokul_cloud_sync_config';
const DEL_STUDENTS_KEY = 'eokul_deleted_students';
const DEL_INCIDENTS_KEY = 'eokul_deleted_incidents';

export const REMOTE_API_URL = 'https://www.evrakplus.com/disiplin-cezasi-programi/sync-api.php';

// Sunucu URL'sini ortama göre belirle
export const getSyncEndpointUrl = (): string => {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname.toLowerCase();
    if (host.includes('evrakplus.com')) {
      return './sync-api.php';
    }
  }
  return REMOTE_API_URL;
};

// Yapılandırmayı oku
export const getCloudSyncConfig = (): CloudSyncConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        user: parsed.user || null,
        autoSync: parsed.autoSync !== undefined ? Boolean(parsed.autoSync) : true,
        lastSyncedAt: parsed.lastSyncedAt || null,
        endpointUrl: getSyncEndpointUrl()
      };
    }
  } catch (err) {
    console.warn('Bulut senkronizasyon ayarları okunamadı:', err);
  }

  return {
    user: null,
    autoSync: true,
    lastSyncedAt: null,
    endpointUrl: getSyncEndpointUrl()
  };
};

// Yapılandırmayı kaydet
export const saveCloudSyncConfig = (patch: Partial<CloudSyncConfig>): CloudSyncConfig => {
  const current = getCloudSyncConfig();
  const updated: CloudSyncConfig = {
    ...current,
    ...patch,
    endpointUrl: getSyncEndpointUrl()
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cloud-sync-config-changed', { detail: updated }));
  }
  return updated;
};

// Silinen ID'leri takip et (tombstones)
export const trackDeletedStudentId = (id: string) => {
  try {
    const raw = localStorage.getItem(DEL_STUDENTS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DEL_STUDENTS_KEY, JSON.stringify(list.slice(-200)));
    }
  } catch {}
};

export const trackDeletedIncidentId = (id: string) => {
  try {
    const raw = localStorage.getItem(DEL_INCIDENTS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem(DEL_INCIDENTS_KEY, JSON.stringify(list.slice(-200)));
    }
  } catch {}
};

// İstemci tarafındaki tüm veriyi topla
const collectClientSyncPayload = () => {
  try {
    const students = JSON.parse(localStorage.getItem('students') || '[]');
    const incidents = JSON.parse(localStorage.getItem('incidents') || '[]');
    const institutionSettings = JSON.parse(localStorage.getItem('institutionSettings') || '{}');
    const boardSettings = JSON.parse(localStorage.getItem('boardSettings') || '[]');
    const gemini_api_key = localStorage.getItem('gemini_api_key') || '';
    const deletedStudentIds = JSON.parse(localStorage.getItem(DEL_STUDENTS_KEY) || '[]');
    const deletedIncidentIds = JSON.parse(localStorage.getItem(DEL_INCIDENTS_KEY) || '[]');

    return {
      students,
      incidents,
      institutionSettings,
      boardSettings,
      gemini_api_key,
      deletedStudentIds,
      deletedIncidentIds
    };
  } catch (err) {
    console.error('Payload toplanamadı:', err);
    return {
      students: [],
      incidents: [],
      institutionSettings: {},
      boardSettings: [],
      gemini_api_key: '',
      deletedStudentIds: [],
      deletedIncidentIds: []
    };
  }
};

// Gelen sunucu verisini localStorage'a uygula ve Context'leri haberdar et
const applyServerSyncData = (serverData: any) => {
  if (!serverData) return;

  try {
    if (Array.isArray(serverData.students)) {
      localStorage.setItem('students', JSON.stringify(serverData.students));
    }
    if (Array.isArray(serverData.incidents)) {
      localStorage.setItem('incidents', JSON.stringify(serverData.incidents));
    }
    if (serverData.institutionSettings && typeof serverData.institutionSettings === 'object') {
      localStorage.setItem('institutionSettings', JSON.stringify(serverData.institutionSettings));
    }
    if (Array.isArray(serverData.boardSettings)) {
      localStorage.setItem('boardSettings', JSON.stringify(serverData.boardSettings));
    }
    if (serverData.gemini_api_key !== undefined) {
      localStorage.setItem('gemini_api_key', serverData.gemini_api_key);
    }

    // Silinen kimlikler temizlenebilir
    localStorage.removeItem(DEL_STUDENTS_KEY);
    localStorage.removeItem(DEL_INCIDENTS_KEY);

    // Context ve UI bileşenlerini güncellemek için özel event tetikle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('app-data-synced', { detail: serverData }));
    }

    // Electron masaüstü AppData dosyasını da güncelle
    triggerPersistenceSync();
  } catch (err) {
    console.error('Sunucu verisi localStorage e yazılamadı:', err);
  }
};

// 1. KAYIT OL (REGISTER)
export const registerCloudAccount = async (
  username: string,
  pass: string,
  displayName?: string
): Promise<{ ok: boolean; error?: string; user?: CloudUser }> => {
  const endpoint = getSyncEndpointUrl();
  const payload = {
    action: 'register',
    username,
    password: pass,
    displayName: displayName || username,
    ...collectClientSyncPayload()
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Kayıt işlemi başarısız oldu.' };
    }

    saveCloudSyncConfig({
      user: data.user,
      lastSyncedAt: new Date().toISOString()
    });

    if (data.data) {
      applyServerSyncData(data.data);
    }

    return { ok: true, user: data.user };
  } catch (err: any) {
    return { ok: false, error: 'Sunucuya bağlanılamadı: ' + (err.message || err) };
  }
};

// 2. GİRİŞ YAP (LOGIN) - DOĞRUDAN EVRAKPLUS.COM HESABIYLA
export const loginCloudAccount = async (
  username: string,
  pass: string
): Promise<{ ok: boolean; error?: string; user?: CloudUser }> => {
  const endpoint = getSyncEndpointUrl();
  const payload = {
    action: 'login',
    username,
    password: pass,
    ...collectClientSyncPayload()
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Evrakplus.com giriş işlemi başarısız.' };
    }

    saveCloudSyncConfig({
      user: data.user,
      lastSyncedAt: new Date().toISOString()
    });

    if (data.data) {
      applyServerSyncData(data.data);
    }

    return { ok: true, user: data.user };
  } catch (err: any) {
    return { ok: false, error: 'Sunucuya bağlanılamadı: ' + (err.message || err) };
  }
};

// 2.1 WEB SSO: Evrakplus.com açık oturumu kontrol et
export const checkEvrakPlusWebSession = async (): Promise<{ ok: boolean; isLoggedIn: boolean; user?: CloudUser }> => {
  if (typeof window === 'undefined') return { ok: false, isLoggedIn: false };

  // Yalnızca evrakplus.com üzerinde çalışırken kontrol et
  const isWeb = window.location.hostname.toLowerCase().includes('evrakplus.com');
  if (!isWeb) return { ok: false, isLoggedIn: false };

  try {
    const res = await fetch('./sync-api.php?action=check-session', {
      method: 'GET',
      credentials: 'include' // WordPress cookie'lerini gönder
    });
    const data = await res.json();
    if (res.ok && data.ok && data.isLoggedIn && data.user) {
      saveCloudSyncConfig({
        user: data.user,
        lastSyncedAt: new Date().toISOString()
      });
      if (data.data) {
        applyServerSyncData(data.data);
      }
      return { ok: true, isLoggedIn: true, user: data.user };
    }
  } catch (err) {
    console.log('Web SSO oturum kontrolü:', err);
  }

  return { ok: false, isLoggedIn: false };
};

// 3. ÇIKIŞ YAP (LOGOUT)
export const logoutCloudAccount = () => {
  saveCloudSyncConfig({
    user: null,
    lastSyncedAt: null
  });
};

// 4. BULUT SENKRONİZASYONUNU ÇALIŞTIR (SYNC)
let isSyncInProgress = false;

export const performCloudSync = async (): Promise<{ ok: boolean; error?: string; syncedAt?: string }> => {
  const config = getCloudSyncConfig();
  if (!config.user || !config.user.token) {
    return { ok: false, error: 'Bulut hesabı bağlı değil. Lütfen önce giriş yapın.' };
  }

  if (isSyncInProgress) {
    return { ok: false, error: 'Senkronizasyon zaten devam ediyor.' };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, error: 'İnternet bağlantısı yok (Çevrimdışı).' };
  }

  isSyncInProgress = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: { status: 'syncing' } }));
  }

  const endpoint = getSyncEndpointUrl();
  const payload = {
    action: 'sync',
    token: config.user.token,
    syncKey: config.user.syncKey,
    ...collectClientSyncPayload()
  };

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.user.token}`,
        'X-Sync-Key': config.user.syncKey
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      const err = data.error || 'Senkronizasyon hatası oluştu.';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: { status: 'error', error: err } }));
      }
      return { ok: false, error: err };
    }

    const now = new Date().toISOString();
    saveCloudSyncConfig({ lastSyncedAt: now });

    if (data.data) {
      applyServerSyncData(data.data);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: { status: 'synced', syncedAt: now } }));
    }

    return { ok: true, syncedAt: now };
  } catch (err: any) {
    const errorMsg = 'Senkronizasyon sunucusuna erişilemedi: ' + (err.message || err);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cloud-sync-status', { detail: { status: 'error', error: errorMsg } }));
    }
    return { ok: false, error: errorMsg };
  } finally {
    isSyncInProgress = false;
  }
};

// Değişikliklerde otomatik senkronizasyon tetikleyici (Debounced)
let autoSyncTimer: any = null;

export const triggerAutoCloudSync = () => {
  const config = getCloudSyncConfig();
  if (!config.user || !config.autoSync) return;

  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    performCloudSync().catch(err => console.warn('Auto cloud sync warning:', err));
  }, 2500);
};

// Uygulama başlangıcında bulut senkronizasyonunu başlat
export const initCloudSync = () => {
  if (typeof window === 'undefined') return;

  const config = getCloudSyncConfig();
  if (config.user && config.autoSync && navigator.onLine) {
    // Uygulama açılışında sessizce sunucu ile eşitle
    setTimeout(() => {
      performCloudSync().catch(err => console.log('Init cloud sync silent:', err));
    }, 1200);
  } else if (!config.user) {
    // Henüz bağlı hesap yoksa ve webdeyse evrakplus.com açık oturumunu kontrol et
    checkEvrakPlusWebSession().catch(() => {});
  }

  // İnternet geri geldiğinde otomatik eşitle
  window.addEventListener('online', () => {
    const current = getCloudSyncConfig();
    if (current.user && current.autoSync) {
      performCloudSync().catch(() => {});
    }
  });
};
