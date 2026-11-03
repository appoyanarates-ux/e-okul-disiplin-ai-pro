const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, controlled API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  version: '1.0.4',
  author: 'Abdullah Yanarateş',
  appName: 'E-Okul Disiplin AI Pro',

  // PDF Generation using Chromium printToPDF
  printToPdf: (options = {}) => ipcRenderer.invoke('print-to-pdf', options),

  // Direct System Printing
  printDirect: (options = {}) => ipcRenderer.invoke('print-direct', options),

  // Save File Dialog and write to disk
  saveFile: (options) => ipcRenderer.invoke('save-file', options),

  // Native showSaveDialog IPC
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),

  // Open File Dialog and read from disk
  openFileDialog: (options) => ipcRenderer.invoke('open-file-dialog', options),

  // Get Windows AppData folder path
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),

  // Application Data Persistence (stored in AppData, surviving updates)
  readAppData: () => ipcRenderer.invoke('read-app-data'),
  writeAppData: (data) => ipcRenderer.invoke('write-app-data', data),

  // Automated Backups
  listBackups: () => ipcRenderer.invoke('list-backups'),
  restoreBackup: (fileName) => ipcRenderer.invoke('restore-backup', fileName),
  createBackupNow: (data, note) => ipcRenderer.invoke('create-backup-now', { data, note }),

  // Safe external URL launcher (default OS browser)
  openExternal: (url) => ipcRenderer.invoke('open-external-url', url),

  // Auto-Update APIs
  downloadUpdate: (options) => ipcRenderer.invoke('download-update', options),
  quitAndInstall: (filePath) => ipcRenderer.invoke('quit-and-install', filePath),
  onUpdateProgress: (callback) => {
    const listener = (event, data) => callback(data);
    ipcRenderer.on('update-download-progress', listener);
    return () => ipcRenderer.removeListener('update-download-progress', listener);
  },
});
