// Disable strict TLS check for MEB (Ministry of National Education) and corporate self-signed proxy certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Ignore certificate errors for school/corporate networks with custom root certificates
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-insecure-localhost', 'true');

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow = null;

// Paths for persistence in Windows AppData (survives app updates & uninstalls if needed)
const getUserDataDir = () => app.getPath('userData');
const getDataFilePath = () => path.join(getUserDataDir(), 'app_data.json');
const getBackupDir = () => {
  const dir = path.join(getUserDataDir(), 'backups');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Automatic backup creator
function createAutoBackup(data, reason = 'auto') {
  try {
    const backupDir = getBackupDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${reason}_${timestamp}.json`;
    const targetPath = path.join(backupDir, filename);

    // Keep max 20 backups to avoid infinite disk usage
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json')).sort();
    if (files.length > 20) {
      for (let i = 0; i < files.length - 20; i++) {
        try { fs.unlinkSync(path.join(backupDir, files[i])); } catch {}
      }
    }

    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, filename, targetPath };
  } catch (err) {
    console.error('Backup creation error:', err);
    return { success: false, error: err.message };
  }
}

function createWindow() {
  const iconPath = path.join(__dirname, '../build/icon.ico');
  const fallbackIcon = path.join(__dirname, '../public/icon.png');

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 720,
    title: 'E-Okul Disiplin AI Pro - By Abdullah Yanarateş',
    icon: fs.existsSync(iconPath) ? iconPath : fallbackIcon,
    show: false, // Prevents white flash before content loads
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false, // SECURE
      contextIsolation: true, // SECURE
      webSecurity: true,      // SECURE
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  // Smooth appearance when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Handle external links safely in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isDev = !app.isPackaged && (process.env.ELECTRON_START_URL || process.env.VITE_DEV_SERVER_URL);
    if (!isDev && !url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Application menu
  const menuTemplate = [
    {
      label: 'Dosya',
      submenu: [
        {
          label: 'Yazdır...',
          accelerator: 'CmdOrCtrl+P',
          click: () => mainWindow.webContents.print()
        },
        { type: 'separator' },
        {
          label: 'Yedekleme Klasörünü Aç',
          click: () => shell.openPath(getBackupDir())
        },
        {
          label: 'Veri Klasörünü Aç (AppData)',
          click: () => shell.openPath(getUserDataDir())
        },
        { type: 'separator' },
        {
          label: 'Çıkış',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Düzen',
      submenu: [
        { label: 'Geri Al', role: 'undo' },
        { label: 'Yinele', role: 'redo' },
        { type: 'separator' },
        { label: 'Kes', role: 'cut' },
        { label: 'Kopyala', role: 'copy' },
        { label: 'Yapıştır', role: 'paste' },
        { label: 'Tümünü Seç', role: 'selectAll' }
      ]
    },
    {
      label: 'Görünüm',
      submenu: [
        { label: 'Yenile', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.webContents.reload() },
        { label: 'Geliştirici Araçları', accelerator: 'Ctrl+Shift+I', click: () => mainWindow.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Büyüt', role: 'zoomIn' },
        { label: 'Küçült', role: 'zoomOut' },
        { label: 'Varsayılan Boyut', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Tam Ekran', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Yardım',
      submenu: [
        {
          label: 'Hakkında (By Abdullah Yanarateş)',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Hakkında - E-Okul Disiplin AI Pro',
              message: 'E-OKUL DİSİPLİN AI PRO\nSürüm 1.0.4 (Windows x64)',
              detail: 'Okul disiplin süreçlerini yönetmek, olayları kaydetmek, kararları düzenlemek ve resmi belgeler oluşturmak için geliştirilmiş masaüstü yazılımı.\n\nProjenin Sahibi ve Geliştiricisi: By Abdullah Yanarateş\nPlatform: Windows 10 / Windows 11\nİletişim: appo.yanarates@gmail.com',
              buttons: ['Tamam']
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Load URL depending on Dev / Production
  const isDev = !app.isPackaged && (process.env.ELECTRON_START_URL || process.env.VITE_DEV_SERVER_URL);
  if (isDev) {
    const devUrl = process.env.ELECTRON_START_URL || process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000';
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // Production loads dist/index.html
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath).catch(err => {
      console.error('Failed to load local index.html:', err);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Second instance focus
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// IPC: PDF Generation via Chromium webContents.printToPDF
ipcMain.handle('print-to-pdf', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: 'Pencere bulunamadı.' };

  let printWin = null;
  try {
    let targetWebContents = win.webContents;

    if (options.html) {
      printWin = new BrowserWindow({
        show: false,
        width: 1200,
        height: 1600,
        backgroundColor: '#ffffff',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      });

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.html)}`);
      // Wait for DOM and fonts layout to stabilize
      await new Promise(resolve => setTimeout(resolve, 300));
      targetWebContents = printWin.webContents;
    }

    const pdfBuffer = await targetWebContents.printToPDF({
      landscape: !!options.landscape,
      displayHeaderFooter: false,
      printBackground: true,
      pageSize: options.pageSize || 'A4',
      preferCSSPageSize: true,
      margins: options.margins || {
        marginType: 'custom',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }
    });

    if (printWin && !printWin.isDestroyed()) {
      try { printWin.destroy(); } catch {}
      printWin = null;
    }

    if (options.saveDialog !== false) {
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: options.title || 'PDF Olarak Kaydet',
        defaultPath: options.defaultPath || 'Belge.pdf',
        filters: [{ name: 'PDF Belgeleri (*.pdf)', extensions: ['pdf'] }]
      });

      if (canceled || !filePath) {
        return { success: false, canceled: true };
      }

      fs.writeFileSync(filePath, pdfBuffer);
      return { success: true, filePath };
    }

    // Return as Uint8Array
    return { success: true, data: new Uint8Array(pdfBuffer) };
  } catch (err) {
    if (printWin && !printWin.isDestroyed()) {
      try { printWin.destroy(); } catch {}
    }
    console.error('print-to-pdf error:', err);
    return { success: false, error: err.message };
  }
});

// IPC: Direct Windows system printing
ipcMain.handle('print-direct', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: 'Pencere bulunamadı.' };

  if (options.html) {
    let printWin = null;
    try {
      printWin = new BrowserWindow({
        show: false,
        width: 1200,
        height: 1600,
        backgroundColor: '#ffffff',
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      });

      await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(options.html)}`);
      await new Promise(resolve => setTimeout(resolve, 300));

      return await new Promise((resolve) => {
        printWin.webContents.print({
          silent: !!options.silent,
          printBackground: true,
          deviceName: options.deviceName || '',
          copies: options.copies || 1,
          landscape: !!options.landscape,
          pageSize: options.pageSize || 'A4'
        }, (success, failureReason) => {
          if (printWin && !printWin.isDestroyed()) {
            try { printWin.destroy(); } catch {}
          }
          resolve({ success, error: failureReason });
        });
      });
    } catch (err) {
      if (printWin && !printWin.isDestroyed()) {
        try { printWin.destroy(); } catch {}
      }
      return { success: false, error: err.message };
    }
  }

  return new Promise((resolve) => {
    win.webContents.print({
      silent: !!options.silent,
      printBackground: true,
      deviceName: options.deviceName || '',
      copies: options.copies || 1,
      landscape: !!options.landscape,
      pageSize: options.pageSize || 'A4'
    }, (success, failureReason) => {
      resolve({ success, error: failureReason });
    });
  });
});

// IPC: Native Windows Show Save Dialog
ipcMain.handle('show-save-dialog', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { canceled: true };
  return dialog.showSaveDialog(win, {
    title: options.title || 'Dosyayı Kaydet',
    defaultPath: options.defaultPath || '',
    filters: options.filters || [{ name: 'Tüm Dosyalar', extensions: ['*'] }]
  });
});

// IPC: Save File with native Windows Save Dialog
ipcMain.handle('save-file', async (event, { defaultPath, filters, data, encoding }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { success: false, error: 'Pencere bulunamadı.' };

  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: defaultPath || 'belge.docx',
      filters: filters || [{ name: 'Tüm Dosyalar', extensions: ['*'] }]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    let buffer;
    if (typeof data === 'string') {
      if (encoding === 'base64') {
        buffer = Buffer.from(data, 'base64');
      } else {
        buffer = Buffer.from(data, 'utf-8');
      }
    } else if (data instanceof Uint8Array || data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
      buffer = Buffer.from(data);
    } else {
      buffer = Buffer.from(data);
    }

    fs.writeFileSync(filePath, buffer);
    return { success: true, filePath };
  } catch (err) {
    console.error('save-file error:', err);
    return { success: false, error: err.message };
  }
});

// IPC: Open File Dialog
ipcMain.handle('open-file-dialog', async (event, options = {}) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win) return { canceled: true, filePaths: [] };

  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      title: options.title || 'Dosya Aç',
      properties: ['openFile'],
      filters: options.filters || [{ name: 'Tüm Dosyalar', extensions: ['*'] }]
    });

    if (canceled || filePaths.length === 0) {
      return { canceled: true, filePaths: [] };
    }

    const filePath = filePaths[0];
    const isBinary = options.binary || filePath.endsWith('.xlsx') || filePath.endsWith('.xls');

    if (isBinary) {
      const buffer = fs.readFileSync(filePath);
      return { canceled: false, filePaths, buffer: new Uint8Array(buffer) };
    } else {
      const content = fs.readFileSync(filePath, 'utf-8');
      return { canceled: false, filePaths, content };
    }
  } catch (err) {
    console.error('open-file-dialog error:', err);
    return { canceled: true, error: err.message, filePaths: [] };
  }
});

// IPC: Get User Data Path (AppData)
ipcMain.handle('get-user-data-path', () => getUserDataDir());

// IPC: Read persistent app data
ipcMain.handle('read-app-data', async () => {
  try {
    const filePath = getDataFilePath();
    if (!fs.existsSync(filePath)) {
      return { success: true, data: null };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return { success: true, data };
  } catch (err) {
    console.error('read-app-data error:', err);
    return { success: false, error: err.message };
  }
});

// IPC: Write persistent app data and create auto backup
ipcMain.handle('write-app-data', async (event, data) => {
  try {
    const filePath = getDataFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    createAutoBackup(data, 'autosave');
    return { success: true };
  } catch (err) {
    console.error('write-app-data error:', err);
    return { success: false, error: err.message };
  }
});

// IPC: List automated backups
ipcMain.handle('list-backups', async () => {
  try {
    const backupDir = getBackupDir();
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.json'));
    const backups = files.map(file => {
      const stat = fs.statSync(path.join(backupDir, file));
      return {
        name: file,
        date: stat.mtime.toISOString(),
        size: stat.size
      };
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { success: true, backups };
  } catch (err) {
    return { success: false, error: err.message, backups: [] };
  }
});

// IPC: Restore backup
ipcMain.handle('restore-backup', async (event, fileName) => {
  try {
    const backupDir = getBackupDir();
    const filePath = path.join(backupDir, path.basename(fileName));
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Yedek dosyası bulunamadı.' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Save as current active data
    fs.writeFileSync(getDataFilePath(), JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// IPC: Manual backup creation
ipcMain.handle('create-backup-now', async (event, { data, note }) => {
  const result = createAutoBackup(data, note ? note.replace(/[^a-zA-Z0-9]/g, '_') : 'manual');
  return result;
});

// IPC: Open external url
ipcMain.handle('open-external-url', async (event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:'))) {
    shell.openExternal(url);
  }
});

// Helper for download streaming with redirect support and self-signed cert handling (MEB / school networks)
function downloadFileWithProgress(fileUrl, targetPath, onProgress) {
  const https = require('https');
  const http = require('http');

  return new Promise((resolve, reject) => {
    const isHttps = fileUrl.startsWith('https');
    const protocol = isHttps ? https : http;
    const httpsAgent = isHttps ? new https.Agent({ rejectUnauthorized: false }) : undefined;

    const requestOptions = {
      agent: httpsAgent,
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'E-Okul-Disiplin-AI-Pro-Updater'
      }
    };

    const request = protocol.get(fileUrl, requestOptions, (res) => {
      // Follow HTTP redirects (GitHub releases redirect to AWS S3 objects)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFileWithProgress(res.headers.location, targetPath, onProgress)
          .then(resolve)
          .catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`İndirme başarısız: HTTP ${res.statusCode}`));
      }

      const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
      let downloadedBytes = 0;
      let lastReportTime = Date.now();
      let lastDownloaded = 0;

      const fileStream = fs.createWriteStream(targetPath);

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        const now = Date.now();
        if (now - lastReportTime > 200 || downloadedBytes === totalBytes) {
          const delta = downloadedBytes - lastDownloaded;
          const timeDelta = (now - lastReportTime) / 1000;
          const speed = timeDelta > 0 ? delta / timeDelta : 0;
          const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;

          onProgress({
            percent,
            transferred: downloadedBytes,
            total: totalBytes,
            speed
          });

          lastReportTime = now;
          lastDownloaded = downloadedBytes;
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(targetPath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(targetPath, () => {});
        reject(err);
      });
    });

    request.on('error', (err) => {
      fs.unlink(targetPath, () => {});
      reject(err);
    });
  });
}

// IPC: Download Update
ipcMain.handle('download-update', async (event, { url, filename }) => {
  try {
    const tempDir = app.getPath('temp');
    const safeName = (filename || 'E-Okul-Disiplin-AI-Pro-Setup.exe').replace(/[^a-zA-Z0-9._-]/g, '_');
    const targetPath = path.join(tempDir, safeName);

    await downloadFileWithProgress(url, targetPath, (progress) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-download-progress', progress);
      }
    });

    return { success: true, filePath: targetPath };
  } catch (err) {
    console.error('Update download error:', err);
    return { success: false, error: err.message };
  }
});

// IPC: Quit and Install
ipcMain.handle('quit-and-install', async (event, filePath) => {
  try {
    const { spawn } = require('child_process');
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'Kurulum dosyası bulunamadı.' };
    }

    const child = spawn(filePath, [], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();

    setTimeout(() => {
      app.quit();
    }, 600);

    return { success: true };
  } catch (err) {
    console.error('Quit and install error:', err);
    return { success: false, error: err.message };
  }
});

// Lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Trust self-signed certificates from MEB / school enterprise proxies
app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
});
