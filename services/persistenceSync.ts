// Persistence Sync between localStorage and Electron userData (Windows AppData)

let isSyncing = false;
let syncTimeout: any = null;

export interface AppSyncData {
  version: string;
  lastUpdated: string;
  institutionSettings: any;
  boardSettings: any[];
  students: any[];
  incidents: any[];
  gemini_api_key?: string;
}

export const getLocalStoreData = (): AppSyncData => {
  try {
    return {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      institutionSettings: JSON.parse(localStorage.getItem('institutionSettings') || '{}'),
      boardSettings: JSON.parse(localStorage.getItem('boardSettings') || '[]'),
      students: JSON.parse(localStorage.getItem('students') || '[]'),
      incidents: JSON.parse(localStorage.getItem('incidents') || '[]'),
      gemini_api_key: localStorage.getItem('gemini_api_key') || ''
    };
  } catch (err) {
    console.error('Error reading localStorage for sync:', err);
    return {
      version: "1.0.0",
      lastUpdated: new Date().toISOString(),
      institutionSettings: {},
      boardSettings: [],
      students: [],
      incidents: []
    };
  }
};

export const applyDataToLocalStorage = (data: AppSyncData) => {
  if (!data) return;
  try {
    if (data.institutionSettings) {
      localStorage.setItem('institutionSettings', JSON.stringify(data.institutionSettings));
    }
    if (Array.isArray(data.boardSettings)) {
      localStorage.setItem('boardSettings', JSON.stringify(data.boardSettings));
    }
    if (Array.isArray(data.students)) {
      localStorage.setItem('students', JSON.stringify(data.students));
    }
    if (Array.isArray(data.incidents)) {
      localStorage.setItem('incidents', JSON.stringify(data.incidents));
    }
    if (data.gemini_api_key) {
      localStorage.setItem('gemini_api_key', data.gemini_api_key);
    }
  } catch (err) {
    console.error('Error writing data to localStorage:', err);
  }
};

// Initialize synchronization when app launches
export const initPersistenceSync = async () => {
  if (typeof window === 'undefined' || !window.electronAPI) {
    return;
  }

  try {
    const res = await window.electronAPI.readAppData();
    if (res.success && res.data) {
      const electronData = res.data as AppSyncData;
      const localData = getLocalStoreData();

      const hasLocalRecords = (localData.students && localData.students.length > 0) || (localData.incidents && localData.incidents.length > 0);
      const hasElectronRecords = (electronData.students && electronData.students.length > 0) || (electronData.incidents && electronData.incidents.length > 0);

      if (hasElectronRecords && !hasLocalRecords) {
        // AppData has data, local storage is empty -> restore into local storage
        applyDataToLocalStorage(electronData);
      } else if (hasLocalRecords && !hasElectronRecords) {
        // Local storage has data, AppData is empty -> write to AppData
        await window.electronAPI.writeAppData(localData);
      } else if (hasElectronRecords && hasLocalRecords) {
        // Both have records -> compare timestamps or ensure AppData is updated
        const localTime = new Date(localData.lastUpdated || 0).getTime();
        const electronTime = new Date(electronData.lastUpdated || 0).getTime();

        if (electronTime > localTime) {
          applyDataToLocalStorage(electronData);
        } else {
          await window.electronAPI.writeAppData(localData);
        }
      }
    } else {
      // First run: save local data to Electron AppData
      const localData = getLocalStoreData();
      await window.electronAPI.writeAppData(localData);
    }
  } catch (err) {
    console.warn('Initial persistence sync warning:', err);
  }
};

import { triggerAutoCloudSync } from './cloudSyncService';

// Debounced save to Electron AppData and Cloud Sync whenever context states change
export const triggerPersistenceSync = () => {
  // Bulut senkronizasyonunu tetikle (hem tarayıcıda hem masaüstünde çalışır)
  triggerAutoCloudSync();

  if (typeof window === 'undefined' || !window.electronAPI) return;

  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const data = getLocalStoreData();
      await window.electronAPI!.writeAppData(data);
    } catch (err) {
      console.error('Persistence sync error:', err);
    } finally {
      isSyncing = false;
    }
  }, 800);
};
