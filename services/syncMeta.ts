/**
 * Cihazlar arası eşitleme için yardımcı kayıtlar:
 *  - Silinen kayıtların zaman damgalı listesi (tombstone)
 *  - Ayarların son değişiklik zamanları
 * Sunucu tarafındaki birleştirme (api.php) bu bilgileri kullanarak
 * aynı kaydın hangi cihazda daha yeni olduğuna karar verir.
 */

export type SyncCollection = 'students' | 'incidents' | 'writtenWarnings';
export type SettingName = 'institutionSettings' | 'boardSettings' | 'gemini_api_key';

const TOMBSTONE_KEY = 'disiplin_tombstones';
const SETTINGS_TS_KEY = 'disiplin_settings_ts';

export type Tombstones = Record<SyncCollection, Record<string, string>>;

const emptyTombstones = (): Tombstones => ({ students: {}, incidents: {}, writtenWarnings: {} });

export const nowIso = () => new Date().toISOString();

export const getTombstones = (): Tombstones => {
  try {
    const raw = localStorage.getItem(TOMBSTONE_KEY);
    if (!raw) return emptyTombstones();
    const parsed = JSON.parse(raw);
    return {
      students: parsed?.students && typeof parsed.students === 'object' ? parsed.students : {},
      incidents: parsed?.incidents && typeof parsed.incidents === 'object' ? parsed.incidents : {},
      writtenWarnings: parsed?.writtenWarnings && typeof parsed.writtenWarnings === 'object' ? parsed.writtenWarnings : {},
    };
  } catch {
    return emptyTombstones();
  }
};

export const markDeleted = (collection: SyncCollection, id: string) => {
  if (!id) return;
  try {
    const t = getTombstones();
    t[collection][id] = nowIso();
    localStorage.setItem(TOMBSTONE_KEY, JSON.stringify(t));
  } catch {
    /* depolama dolu olabilir */
  }
};

export const clearTombstones = () => {
  try { localStorage.removeItem(TOMBSTONE_KEY); } catch { /* yoksay */ }
};

export const getSettingsTs = (): Partial<Record<SettingName, string>> => {
  try {
    const raw = localStorage.getItem(SETTINGS_TS_KEY);
    return raw ? JSON.parse(raw) || {} : {};
  } catch {
    return {};
  }
};

export const touchSetting = (name: SettingName) => {
  try {
    const cur = getSettingsTs();
    cur[name] = nowIso();
    localStorage.setItem(SETTINGS_TS_KEY, JSON.stringify(cur));
  } catch { /* yoksay */ }
};

export const setSettingsTs = (ts: Partial<Record<SettingName, string>> | undefined) => {
  try {
    if (ts && typeof ts === 'object') localStorage.setItem(SETTINGS_TS_KEY, JSON.stringify(ts));
  } catch { /* yoksay */ }
};

/** Kaydın içeriği değiştiyse updatedAt damgasını yeniler, değişmediyse eskisini korur. */
export const stampIfChanged = <T extends { id: string; updatedAt?: string }>(prev: T | undefined, next: T, ts = nowIso()): T => {
  if (!prev) return { ...next, updatedAt: next.updatedAt || ts };
  const { updatedAt: _a, ...p } = prev as T & { updatedAt?: string };
  const { updatedAt: _b, ...n } = next as T & { updatedAt?: string };
  void _a; void _b;
  if (JSON.stringify(p) === JSON.stringify(n)) return { ...next, updatedAt: prev.updatedAt };
  return { ...next, updatedAt: ts };
};
