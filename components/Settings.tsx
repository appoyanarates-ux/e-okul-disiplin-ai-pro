
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, Building, Users, Info, AlertTriangle, AlertCircle, Sparkles, Eye, EyeOff, CheckCircle, XCircle, Loader2, ExternalLink, RefreshCw, Trash2, Plus, X, Database, Download, Upload, Check, Key, Cloud, ShieldCheck, Laptop, Globe, ArrowRightLeft, LogOut, Lock, User } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { 
  validateApiKeyDetailed, 
  fetchBoardInfoFromUrl, 
  cleanApiKey, 
  MODEL_OPTIONS, 
  getPreferredModel, 
  setPreferredModel, 
  getModelFriendlyName 
} from '../services/geminiService';
import { BoardMember } from '../types';
import { migrateImportedData } from '../services/dataMigrator';
import { getCurrentAcademicYear, getAcademicYearOptions } from '../services/academicYear';
import { 
  getCloudSyncConfig, 
  saveCloudSyncConfig, 
  performCloudSync, 
  loginCloudAccount, 
  registerCloudAccount, 
  logoutCloudAccount 
} from '../services/cloudSyncService';

const Settings = () => {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as any) || 'institution';
  const { 
    institution, 
    boardMembers, 
    apiKey, 
    updateInstitution, 
    updateBoardMembers, 
    updateApiKey, 
    clearApiKey 
  } = useSettings();
  const [activeTab, setActiveTab] = useState<'institution' | 'board' | 'ai' | 'backup' | 'sync'>(
    ['institution', 'board', 'ai', 'backup', 'sync'].includes(initialTab) ? initialTab : 'institution'
  );
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  // Cloud Sync State
  const [cloudConfig, setCloudConfig] = useState(getCloudSyncConfig());
  const [cloudMode, setCloudMode] = useState<'login' | 'register'>('login');
  const [cloudUsername, setCloudUsername] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudDisplayName, setCloudDisplayName] = useState('');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudFeedback, setCloudFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // AI Key State
  const [tempKey, setTempKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testErrorType, setTestErrorType] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(getPreferredModel());
  const [detectedModel, setDetectedModel] = useState<string | null>(null);

  // Board Regulation Info State
  const [regulationInfo, setRegulationInfo] = useState<string>('');
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);

  // Delete Confirmation Modal State
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);

  // Import Confirmation State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [autoBackupBeforeImport, setAutoBackupBeforeImport] = useState(true);

  // Desktop AppData & Backup state
  const [electronPath, setElectronPath] = useState<string>('');
  const [electronBackupsList, setElectronBackupsList] = useState<Array<{ name: string; date: string; size: number }>>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [backupActionSuccess, setBackupActionSuccess] = useState<string | null>(null);

  const loadDesktopBackups = async () => {
    if (window.electronAPI?.getUserDataPath) {
      try {
        const path = await window.electronAPI.getUserDataPath();
        setElectronPath(path);
        setIsLoadingBackups(true);
        const res = await window.electronAPI.listBackups();
        if (res?.success) {
          setElectronBackupsList(res.backups || []);
        }
      } catch (err) {
        console.error('Failed to load electron backups:', err);
      } finally {
        setIsLoadingBackups(false);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'backup') {
      loadDesktopBackups();
    }
  }, [activeTab]);

  const handleCreateDesktopBackup = async () => {
    if (!window.electronAPI?.createBackupNow) return;
    try {
      const data = {
        institutionSettings: JSON.parse(localStorage.getItem('institutionSettings') || '{}'),
        boardSettings: JSON.parse(localStorage.getItem('boardSettings') || '[]'),
        students: JSON.parse(localStorage.getItem('students') || '[]'),
        incidents: JSON.parse(localStorage.getItem('incidents') || '[]'),
        gemini_api_key: localStorage.getItem('gemini_api_key') || ''
      };
      const res = await window.electronAPI.createBackupNow(data, 'kullanici-manuel');
      if (res?.success) {
        setBackupActionSuccess("Yeni anlık yedek başarıyla oluşturuldu.");
        setTimeout(() => setBackupActionSuccess(null), 3500);
        await loadDesktopBackups();
      }
    } catch (e) {
      alert("Yedekleme oluşturulamadı: " + e);
    }
  };

  const handleRestoreDesktopBackup = async (fileName: string) => {
    if (!window.electronAPI?.restoreBackup) return;
    if (!confirm(`${fileName} isimli yedekten geri dönmek istediğinize emin misiniz? Mevcut verileriniz bu yedeğin içeriği ile güncellenecektir.`)) {
      return;
    }
    try {
      const res = await window.electronAPI.restoreBackup(fileName);
      if (res?.success && res.data) {
        const d = res.data;
        if (d.students) localStorage.setItem('students', JSON.stringify(d.students));
        if (d.incidents) localStorage.setItem('incidents', JSON.stringify(d.incidents));
        if (d.institutionSettings) localStorage.setItem('institutionSettings', JSON.stringify(d.institutionSettings));
        if (d.boardSettings) localStorage.setItem('boardSettings', JSON.stringify(d.boardSettings));
        if (d.gemini_api_key) localStorage.setItem('gemini_api_key', d.gemini_api_key);
        
        alert("Yedek başarıyla geri yüklendi! Sistem verileri yenileniyor.");
        window.location.reload();
      } else {
        alert("Yedek geri yüklenirken hata oluştu: " + (res?.error || 'Bilinmeyen hata'));
      }
    } catch (e) {
      alert("Geri yükleme hatası: " + e);
    }
  };

  useEffect(() => {
    const handleConfigChange = (e: any) => {
      setCloudConfig(e.detail || getCloudSyncConfig());
    };
    const handleSyncStatus = (e: any) => {
      if (e.detail?.status === 'syncing') setCloudSyncing(true);
      if (e.detail?.status === 'synced') {
        setCloudSyncing(false);
        setCloudFeedback({ type: 'success', message: 'Tüm veriler başarıyla senkronize edildi!' });
        setTimeout(() => setCloudFeedback(null), 3500);
      }
      if (e.detail?.status === 'error') {
        setCloudSyncing(false);
        setCloudFeedback({ type: 'error', message: e.detail.error || 'Senkronizasyon hatası' });
      }
    };

    window.addEventListener('cloud-sync-config-changed', handleConfigChange);
    window.addEventListener('cloud-sync-status', handleSyncStatus);

    return () => {
      window.removeEventListener('cloud-sync-config-changed', handleConfigChange);
      window.removeEventListener('cloud-sync-status', handleSyncStatus);
    };
  }, []);

  const handleCloudLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudUsername.trim() || !cloudPassword) {
      setCloudFeedback({ type: 'error', message: 'Lütfen kullanıcı adı ve şifre girin.' });
      return;
    }
    setCloudLoading(true);
    setCloudFeedback(null);
    try {
      const res = await loginCloudAccount(cloudUsername.trim(), cloudPassword);
      if (res.ok) {
        setCloudFeedback({ type: 'success', message: `Giriş başarılı! Hoş geldiniz, ${res.user?.displayName || res.user?.username}` });
        setCloudConfig(getCloudSyncConfig());
      } else {
        setCloudFeedback({ type: 'error', message: res.error || 'Giriş yapılamadı.' });
      }
    } finally {
      setCloudLoading(false);
    }
  };

  const handleCloudRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudUsername.trim() || !cloudPassword) {
      setCloudFeedback({ type: 'error', message: 'Lütfen kullanıcı adı ve şifre girin.' });
      return;
    }
    if (cloudPassword.length < 4) {
      setCloudFeedback({ type: 'error', message: 'Şifre en az 4 karakter olmalıdır.' });
      return;
    }
    setCloudLoading(true);
    setCloudFeedback(null);
    try {
      const res = await registerCloudAccount(cloudUsername.trim(), cloudPassword, cloudDisplayName.trim());
      if (res.ok) {
        setCloudFeedback({ type: 'success', message: 'Bulut hesabı oluşturuldu ve ilk veriler senkronize edildi!' });
        setCloudConfig(getCloudSyncConfig());
      } else {
        setCloudFeedback({ type: 'error', message: res.error || 'Kayıt başarısız oldu.' });
      }
    } finally {
      setCloudLoading(false);
    }
  };

  const handleCloudManualSync = async () => {
    setCloudSyncing(true);
    setCloudFeedback(null);
    try {
      const res = await performCloudSync();
      if (res.ok) {
        setCloudFeedback({ type: 'success', message: 'Tüm öğrenci, olay ve ayar verileri başarıyla eşitlendi!' });
        setTimeout(() => setCloudFeedback(null), 3500);
      } else {
        setCloudFeedback({ type: 'error', message: res.error || 'Senkronizasyon hatası' });
      }
    } finally {
      setCloudSyncing(false);
    }
  };

  const handleCloudLogout = () => {
    if (window.confirm('Bulut hesabından çıkış yapmak istediğinize emin misiniz? Yerel verileriniz korunacaktır.')) {
      logoutCloudAccount();
      setCloudConfig(getCloudSyncConfig());
      setCloudFeedback({ type: 'success', message: 'Çıkış yapıldı. Program yalnızca yerel modda çalışıyor.' });
      setTimeout(() => setCloudFeedback(null), 3000);
    }
  };

  const handleToggleAutoSync = () => {
    const nextVal = !cloudConfig.autoSync;
    saveCloudSyncConfig({ autoSync: nextVal });
    setCloudConfig(prev => ({ ...prev, autoSync: nextVal }));
  };

  useEffect(() => {
    setTempKey(apiKey);
  }, [apiKey]);

  // Set default regulation text based on school type on mount if empty
  useEffect(() => {
    if (!regulationInfo) {
        if (institution.type === 'Ortaokul') {
            setRegulationInfo("Öğrenci Davranışlarını Değerlendirme Kurulu (Ortaokul): Müdürün görevlendireceği müdür yardımcısının başkanlığında, her ders yılının ilk öğretmenler kurulu toplantısında gizli oyla seçilecek üç öğretmen ve Okul-Aile Birliğinin kendi üyeleri arasından seçeceği bir öğrenci velisinden oluşturulur.");
        } else if (institution.type === 'MESEM') {
            setRegulationInfo("Disiplin Kurulu (MESEM / Mesleki Eğitim Merkezi): 3308 Sayılı Mesleki Eğitim Kanunu ve MEB Ortaöğretim Kurumları Yönetmeliği hükümleri uyarınca; müdürün görevlendireceği müdür başyardımcısı veya müdür yardımcısının başkanlığında, öğretmenler kurulunca gizli oyla seçilecek iki öğretmen, onur kurulu ikinci başkanı ve okul-aile birliği başkanından oluşturulur.");
        } else {
            setRegulationInfo("Disiplin Kurulu (Lise): Müdürün görevlendireceği müdür başyardımcısı veya müdür yardımcısının başkanlığında, öğretmenler kurulunca gizli oyla seçilecek iki öğretmen, onur kurulu ikinci başkanı ve okul-aile birliği başkanından oluşturulur.");
        }
    }
  }, [institution.type, regulationInfo]);

  const handleSave = () => {
    // Context updates automatically save to localStorage
    // Just show feedback
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const handleInstitutionChange = (field: string, value: string) => {
    updateInstitution({ ...institution, [field]: value });
  };

  const handleBoardMemberChange = (id: string, field: keyof BoardMember, value: string) => {
    const updatedMembers = boardMembers.map(member => 
      member.id === id ? { ...member, [field]: value } : member
    );
    updateBoardMembers(updatedMembers);
  };

  const handleAddBoardMember = () => {
      const newMember: BoardMember = {
          id: Math.random().toString(36).substr(2, 9),
          role: 'ÜYE',
          mainName: '',
          mainTitle: 'Öğretmen',
          reserveName: '',
          reserveTitle: 'Öğretmen'
      };
      updateBoardMembers([...boardMembers, newMember]);
  };

  const handleDeleteRequest = (id: string) => {
      if(boardMembers.length <= 3) {
          alert("Kurul en az 3 kişiden oluşmalıdır.");
          return;
      }
      setMemberToDelete(id);
  };

  const confirmDeleteMember = () => {
      if (memberToDelete) {
          const updatedMembers = boardMembers.filter(m => m.id !== memberToDelete);
          updateBoardMembers(updatedMembers);
          setMemberToDelete(null);
      }
  };

  const handleTestKey = async () => {
    const cleaned = cleanApiKey(tempKey);
    if (!cleaned) return;
    setTestStatus('testing');
    setTestMessage(null);
    setTestErrorType(null);
    setDetectedModel(null);
    const result = await validateApiKeyDetailed(cleaned, selectedModel);
    setTestStatus(result.valid ? 'success' : 'error');
    setTestMessage(result.message);
    setTestErrorType(result.errorType || null);
    if (result.workingModel) {
      setDetectedModel(result.workingModel);
    }
  };

  const handleClearKey = () => {
    clearApiKey();
    setTempKey('');
    setTestStatus('idle');
    setTestMessage(null);
    setTestErrorType(null);
    setDetectedModel(null);
    setSelectedModel('auto');
    setPreferredModel('auto');
    handleSave();
  };

  const handleSaveKey = () => {
    const cleaned = cleanApiKey(tempKey);
    updateApiKey(cleaned);
    setPreferredModel(selectedModel);
    handleSave();
  };

  const handleExportJSON = () => {
    try {
      const backupData = {
        backup_version: "3.2.0",
        export_date: new Date().toISOString(),
        metadata: {
          app_name: "Disiplin Asistanı",
          database_version: "15"
        },
        data: {
          institutionSettings: JSON.parse(localStorage.getItem('institutionSettings') || '{}'),
          boardSettings: JSON.parse(localStorage.getItem('boardSettings') || '[]'),
          students: JSON.parse(localStorage.getItem('students') || '[]'),
          incidents: JSON.parse(localStorage.getItem('incidents') || '[]'),
          gemini_api_key: localStorage.getItem('gemini_api_key') || ''
        }
      };

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `disiplin_asistani_yedek_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (e) {
      alert("Yedek veriler indirilirken bir hata oluştu: " + e);
    }
  };

  const handleImportJSON = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setImportFile(files[0]);
    setIsImportModalOpen(true);
    
    event.target.value = '';
  };

  const confirmImportData = () => {
    if (!importFile) return;

    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      try {
        const rawJson = e.target?.result as string;
        let obj;
        try {
            obj = JSON.parse(rawJson);
        } catch (err) {
            console.error("JSON parse error:", err);
            alert("Dosya yüklenirken bir hata oluştu: Geçersiz JSON dosyası yapısı.");
            setIsImportModalOpen(false);
            return;
        }

        // 1. Şema Doğrulama
        const hasDataNode = obj && typeof obj === 'object';
        if (!hasDataNode) {
          alert("Lütfen geçerli bir JSON yedekleme dosyası seçiniz.");
          setIsImportModalOpen(false);
          return;
        }

        // 10. Yükleme Öncesi Otomatik Güvenlik Yedeği
        if (autoBackupBeforeImport) {
          try {
              const autoBackup = {
                  backup_version: "3.2.0",
                  export_date: new Date().toISOString(),
                  metadata: {
                      app_name: "Disiplin Asistanı",
                      database_version: "15",
                      type: "auto_backup_before_import"
                  },
                  data: {
                      institutionSettings: JSON.parse(localStorage.getItem('institutionSettings') || '{}'),
                      boardSettings: JSON.parse(localStorage.getItem('boardSettings') || '[]'),
                      students: JSON.parse(localStorage.getItem('students') || '[]'),
                      incidents: JSON.parse(localStorage.getItem('incidents') || '[]'),
                      gemini_api_key: localStorage.getItem('gemini_api_key') || ''
                  }
              };
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(autoBackup, null, 2));
              const downloadAnchor = document.createElement('a');
              downloadAnchor.setAttribute("href", dataStr);
              downloadAnchor.setAttribute("download", `auto_backup_before_import_${new Date().toISOString().split('T')[0]}.json`);
              document.body.appendChild(downloadAnchor);
              downloadAnchor.click();
              downloadAnchor.remove();
          } catch (err) {
              console.error("Auto backup failed", err);
          }
        }

        // Import Reports
        const report = { inserted: 0, updated: 0, skipped: 0, errors: 0 };

        // 7. & 8. Güvenli Merge Sistemi & Akıllı Çakışma Çözümü (Last Write Wins)
        const safeMergeArrays = (storedData: string | null, importedArray: unknown[]) => {
            const storedArray = storedData ? JSON.parse(storedData) : [];
            if (!Array.isArray(importedArray)) return storedArray;
            if (!Array.isArray(storedArray)) {
                report.inserted += importedArray.length;
                return importedArray;
            }
            
            const result = [...storedArray];
            importedArray.forEach((importedItem: unknown) => {
                if (typeof importedItem !== 'object' || importedItem === null) {
                    result.push(importedItem);
                    report.inserted++;
                    return;
                }
                const impItem = importedItem as Record<string, unknown>;
                const index = result.findIndex((item: unknown) => {
                    const rItem = item as Record<string, unknown>;
                    return rItem && impItem && rItem.id && impItem.id && rItem.id === impItem.id;
                });
                
                if (index !== -1) {
                    const existingItem = result[index] as Record<string, unknown>;
                    // 6. Eksik alanları otomatik tamamlama ve Last Write Wins stratejisi
                    const existingUpdatedAt = existingItem?.updatedAt ? new Date(existingItem.updatedAt as string).getTime() : 0;
                    // Yedekteki objede updatedAt yoksa, onu "yeni ve geçerli" kabul edip değiştiriyoruz.
                    const importedUpdatedAt = impItem?.updatedAt ? new Date(impItem.updatedAt as string).getTime() : Date.now();

                    if (importedUpdatedAt >= existingUpdatedAt) {
                         result[index] = { ...existingItem, ...impItem };
                         report.updated++;
                    } else {
                         report.skipped++;
                    }
                } else {
                    result.push(impItem);
                    report.inserted++;
                }
            });
            return result;
        };

        const mergeObjects = (storedData: string | null, importedObj: unknown) => {
            const storedObj = storedData ? JSON.parse(storedData) : {};
            if (!importedObj || typeof importedObj !== 'object') return storedObj;
            if (!storedObj || typeof storedObj !== 'object') {
                report.updated++;
                return importedObj;
            }
            report.updated++;
            return { ...(storedObj as object), ...(importedObj as object) };
        };

        // 9. Atomic Transaction
        // We will do a full backup of localStorage to memory
        const snapshot = {
            institutionSettings: localStorage.getItem('institutionSettings'),
            boardSettings: localStorage.getItem('boardSettings'),
            students: localStorage.getItem('students'),
            incidents: localStorage.getItem('incidents'),
            gemini_api_key: localStorage.getItem('gemini_api_key')
        };

        try {
            // Sürüm kontrolü ve Veri dönüştürme: migrateImportedData handles v1 to current mapping
            const importedDataNode = obj.data ? obj.data : obj; // Support both modern and old formats
            const migratedObj = migrateImportedData(importedDataNode);
            
            if (migratedObj.institutionSettings) {
              const merged = mergeObjects(localStorage.getItem('institutionSettings'), migratedObj.institutionSettings);
              localStorage.setItem('institutionSettings', JSON.stringify(merged));
            }

            if (migratedObj.boardMembers) {
              const merged = safeMergeArrays(localStorage.getItem('boardSettings'), migratedObj.boardMembers);
              localStorage.setItem('boardSettings', JSON.stringify(merged));
            }

            if (migratedObj.students) {
              const merged = safeMergeArrays(localStorage.getItem('students'), migratedObj.students);
              localStorage.setItem('students', JSON.stringify(merged));
            }

            if (migratedObj.incidents) {
              const merged = safeMergeArrays(localStorage.getItem('incidents'), migratedObj.incidents);
              localStorage.setItem('incidents', JSON.stringify(merged));
            }

            if (migratedObj.apiKey) {
              localStorage.setItem('gemini_api_key', migratedObj.apiKey);
            }

            // 11. Import Sonuç Raporu
            alert(`Yedekleme Güvenli Bir Şekilde Yüklendi!\n\n✓ ${report.inserted} yeni kayıt eklendi\n✓ ${report.updated} kayıt güncellendi\n✓ ${report.skipped} eski kayıt atlandı\n✓ Hata bulunamadı\n\nSistem verileri güncellemek için sayfanız yenileniyor.`);
            window.location.reload();
            
        } catch (err) {
            // ROLLBACK
            report.errors++;
            console.error("Migration transaction error / ROLLBACK initiated:", err);
            
            if (snapshot.institutionSettings !== null) localStorage.setItem('institutionSettings', snapshot.institutionSettings);
            if (snapshot.boardSettings !== null) localStorage.setItem('boardSettings', snapshot.boardSettings);
            if (snapshot.students !== null) localStorage.setItem('students', snapshot.students);
            if (snapshot.incidents !== null) localStorage.setItem('incidents', snapshot.incidents);
            if (snapshot.gemini_api_key !== null) localStorage.setItem('gemini_api_key', snapshot.gemini_api_key);

            const errMsg = err instanceof Error ? err.message : String(err);
            alert(`Kritik bir hata oluştu, işlem iptal edildi (Rollback).\nVerileriniz eski haline döndürüldü.\nDetay: ${errMsg}`);
            setIsImportModalOpen(false);
        }

      } catch (err) {
        console.error("Import processing error", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        alert(`Dosya işlenirken bir hata oluştu. Veriler uygun formatta olmayabilir.\nDetay: ${errMsg}`);
        setIsImportModalOpen(false);
      }
    };
    fileReader.readAsText(importFile);
  };

  const handleUpdateRegulationWithAI = async () => {
      if (!apiKey || !apiKey.trim()) {
          alert("Lütfen önce Yapay Zeka (AI) sekmesinden kendi Google Gemini API anahtarınızı tanımlayınız.");
          return;
      }
      
      setIsFetchingInfo(true);
      let url = "";
      
      if (institution.type === 'Ortaokul') {
          // İlköğretim Kurumları Yönetmeliği
          url = "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=18812&MevzuatTur=7&MevzuatTertip=5";
      } else {
          // Ortaöğretim Kurumları Yönetmeliği
          url = "https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=19942&MevzuatTur=7&MevzuatTertip=5";
      }

      const result = await fetchBoardInfoFromUrl(url, institution.type);
      if (result) {
          setRegulationInfo(result);
      }
      setIsFetchingInfo(false);
  };

  // Generate academic years dynamically based on the current/new calendar year
  const currentAcademicYear = getCurrentAcademicYear();
  const academicYears = getAcademicYearOptions();

  return (
    <div className="p-8 max-w-6xl mx-auto pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h1 className="text-2xl font-bold text-slate-800">Kurum Ayarları</h1>
           <p className="text-slate-500">Okul bilgileri ve disiplin kurulu yapılandırması.</p>
        </div>
        <button 
          onClick={handleSave}
          className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          <Save className="w-4 h-4" />
          Kaydet
        </button>
      </div>

      {showSaveSuccess && (
        <div className="mb-6 bg-green-50 text-green-700 p-4 rounded-lg border border-green-200 flex items-center animate-fade-in">
           <Save className="w-5 h-5 mr-2" />
           Ayarlar başarıyla kaydedildi.
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('institution')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'institution' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building className="w-4 h-4" />
          Kurum Bilgileri
        </button>
        <button
          onClick={() => setActiveTab('board')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'board' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" />
          Kurul Üyeleri
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'ai' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          Yapay Zeka (AI)
        </button>
        <button
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'backup' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Database className="w-4 h-4" />
          Veri Yedekleme (JSON)
        </button>
        <button
          onClick={() => setActiveTab('sync')}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === 'sync' 
              ? 'border-blue-600 text-blue-600' 
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Cloud className="w-4 h-4" />
          Bulut Senkronizasyon (Web & Masaüstü)
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 min-h-[500px]">
        
        {/* TAB 1: KURUM BİLGİLERİ */}
        {activeTab === 'institution' && (
          <div className="animate-fade-in">
             <div className="mb-6 p-4 bg-yellow-50 border border-yellow-100 rounded-lg text-yellow-800 text-sm flex items-start gap-3">
                <Info className="w-5 h-5 shrink-0" />
                <p className="font-medium mt-0.5">Burada girdiğiniz bilgiler; tutanaklarda, karar formlarında ve üst yazılarda otomatik olarak başlık ve içerik olarak kullanılacaktır.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Okul Türü</label>
                        <select 
                            value={institution.type}
                            onChange={(e) => handleInstitutionChange('type', e.target.value)}
                            className="w-full p-2.5 border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="Lise">Lise / Anadolu Lisesi</option>
                            <option value="Meslek Lisesi">Mesleki ve Teknik Anadolu Lisesi</option>
                            <option value="İmam Hatip">İmam Hatip Lisesi</option>
                            <option value="MESEM">Mesleki Eğitim Merkezi (MESEM)</option>
                            <option value="Ortaokul">Ortaokul</option>
                        </select>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-xs font-bold text-slate-500 uppercase">Öğretim Yılı</label>
                            {institution.year !== currentAcademicYear && (
                                <button
                                    type="button"
                                    onClick={() => handleInstitutionChange('year', currentAcademicYear)}
                                    className="text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline flex items-center gap-1"
                                    title={`Yeni eğitim-öğretim yılına (${currentAcademicYear}) güncelle`}
                                >
                                    Yeni Yıla Ayarla ({currentAcademicYear})
                                </button>
                            )}
                        </div>
                        <select 
                            value={institution.year || currentAcademicYear}
                            onChange={(e) => handleInstitutionChange('year', e.target.value)}
                            className="w-full p-2.5 border rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {academicYears.map(year => (
                                <option key={year} value={year}>
                                    {year} {year === currentAcademicYear ? '(Aktif / Yeni Öğretim Yılı)' : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kurum Kodu</label>
                        <input 
                            type="text" 
                            value={institution.code}
                            onChange={(e) => handleInstitutionChange('code', e.target.value)}
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Bulunduğu İl</label>
                        <input 
                            type="text" 
                            value={institution.province}
                            onChange={(e) => handleInstitutionChange('province', e.target.value)}
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">İlçe</label>
                        <input 
                            type="text" 
                            value={institution.district}
                            onChange={(e) => handleInstitutionChange('district', e.target.value)}
                            className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Okul Adı</label>
                    <input 
                        type="text" 
                        value={institution.name}
                        onChange={(e) => handleInstitutionChange('name', e.target.value)}
                        placeholder="Örn: Cumhuriyet Anadolu Lisesi"
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Müdür Adı Soyadı</label>
                    <input 
                        type="text" 
                        value={institution.managerName}
                        onChange={(e) => handleInstitutionChange('managerName', e.target.value)}
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kurum Resmi Yazışma Kodu</label>
                    <input 
                        type="text" 
                        value={institution.ebysCode}
                        onChange={(e) => handleInstitutionChange('ebysCode', e.target.value)}
                         placeholder="Örn: 12345678"
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>

                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kurum Anteti (Üst Yazılar İçin)</label>
                    <textarea 
                        rows={3}
                        value={institution.headerText}
                        onChange={(e) => handleInstitutionChange('headerText', e.target.value)}
                        placeholder="Örn: T.C.&#10;ANKARA VALİLİĞİ&#10;Cumhuriyet Anadolu Lisesi Müdürlüğü"
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                    ></textarea>
                </div>

                <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Kurum Adresi</label>
                    <textarea 
                        rows={2}
                        value={institution.address}
                        onChange={(e) => handleInstitutionChange('address', e.target.value)}
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    ></textarea>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Telefon No</label>
                    <input 
                        type="text" 
                        value={institution.phone}
                        onChange={(e) => handleInstitutionChange('phone', e.target.value)}
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
                 <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Fax No</label>
                    <input 
                        type="text" 
                        value={institution.fax}
                        onChange={(e) => handleInstitutionChange('fax', e.target.value)}
                        className="w-full p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                </div>
             </div>
          </div>
        )}

        {/* TAB 2: KURUL ÜYELERİ */}
        {activeTab === 'board' && (
           <div className="animate-fade-in space-y-6">
             {/* OKUL REHBER ÖĞRETMENİ / REHBERLİK SERVİSİ ALANI */}
             <div className="bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/80 rounded-xl p-5 shadow-xs">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-xs">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Okul Rehber Öğretmeni / Psikolojik Danışman</h3>
                        <p className="text-xs text-slate-500">Disiplin kurulu sürecinde görüş bildiren, evraklarda (İfade tutanağı, Rehberlik Görüş Formu, Öğrenci Bilgileri vb.) yer alan rehber öğretmen bilgisi.</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Rehber Öğretmen Adı Soyadı</label>
                        <input 
                            type="text"
                            value={institution.counselorName || ''}
                            onChange={(e) => handleInstitutionChange('counselorName', e.target.value)}
                            placeholder="Örn: Ayşe YILMAZ"
                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white outline-none font-medium text-slate-800 text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Görevi / Ünvanı</label>
                        <input 
                            type="text"
                            value={institution.counselorTitle || 'Psikolojik Danışman / Rehberlik Öğretmeni'}
                            onChange={(e) => handleInstitutionChange('counselorTitle', e.target.value)}
                            placeholder="Psikolojik Danışman / Rehberlik Öğretmeni"
                            className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white outline-none font-medium text-slate-800 text-sm"
                        />
                    </div>
                </div>
             </div>

             <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm mb-4">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-800 text-white text-xs uppercase tracking-wider">
                            <th className="p-4 font-semibold border-b border-slate-700 w-32">Üye / Rol</th>
                            <th className="p-4 font-semibold border-b border-slate-700">Asil Adı Soyadı</th>
                            <th className="p-4 font-semibold border-b border-slate-700">Asil Ünvan</th>
                            <th className="p-4 font-semibold border-b border-slate-700 bg-slate-700/50">Yedek Adı Soyadı</th>
                            <th className="p-4 font-semibold border-b border-slate-700 bg-slate-700/50">Yedek Ünvan</th>
                            <th className="p-4 font-semibold border-b border-slate-700 text-center w-16">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm divide-y divide-slate-100">
                        {boardMembers.map((member) => (
                           <tr key={member.id} className="hover:bg-slate-50">
                                <td className="p-3">
                                    <input 
                                        type="text"
                                        className={`w-full p-2 border border-slate-200 rounded focus:border-blue-500 outline-none bg-slate-50 font-bold text-xs ${member.role.includes('BAŞKAN') ? 'text-blue-600' : 'text-slate-700'}`}
                                        value={member.role}
                                        onChange={(e) => handleBoardMemberChange(member.id, 'role', e.target.value)}
                                    />
                                </td>
                                <td className="p-3">
                                    <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-200 rounded focus:border-blue-500 outline-none bg-white"
                                        value={member.mainName}
                                        onChange={(e) => handleBoardMemberChange(member.id, 'mainName', e.target.value)}
                                        placeholder="Ad Soyad Giriniz"
                                    />
                                </td>
                                <td className="p-3">
                                     <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-200 rounded focus:border-blue-500 outline-none bg-slate-50 text-slate-600"
                                        value={member.mainTitle}
                                        onChange={(e) => handleBoardMemberChange(member.id, 'mainTitle', e.target.value)}
                                    />
                                </td>
                                <td className="p-3 bg-slate-50/50">
                                     <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-200 rounded focus:border-blue-500 outline-none bg-white"
                                        value={member.reserveName}
                                        onChange={(e) => handleBoardMemberChange(member.id, 'reserveName', e.target.value)}
                                        placeholder="Yedek Üye"
                                    />
                                </td>
                                <td className="p-3 bg-slate-50/50">
                                     <input 
                                        type="text" 
                                        className="w-full p-2 border border-slate-200 rounded focus:border-blue-500 outline-none bg-slate-50 text-slate-600"
                                        value={member.reserveTitle}
                                        onChange={(e) => handleBoardMemberChange(member.id, 'reserveTitle', e.target.value)}
                                    />
                                </td>
                                <td className="p-3 text-center">
                                    <button 
                                        onClick={() => handleDeleteRequest(member.id)}
                                        className="text-slate-400 hover:text-red-600 transition-colors p-1"
                                        title="Üyeyi Sil"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                           </tr>
                        ))}
                    </tbody>
                </table>
             </div>
             
             <div className="flex justify-end mb-8">
                 <button 
                    onClick={handleAddBoardMember}
                    className="flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-200 transition-colors text-sm font-bold"
                 >
                     <Plus className="w-4 h-4" /> Yeni Üye Ekle
                 </button>
             </div>

             {/* Regulation Info Box */}
             <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                <div className="flex justify-between items-start mb-3">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-orange-500" />
                        MEB İlköğretim ve Ortaöğretim Kurumları Yönetmeliği - Kuruluş Esasları
                    </h4>
                    <button 
                        onClick={handleUpdateRegulationWithAI}
                        disabled={isFetchingInfo}
                        className="text-xs flex items-center gap-2 bg-white border border-slate-300 px-3 py-1.5 rounded hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                        {isFetchingInfo ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Mevzuattan Güncelle (AI)
                    </button>
                </div>
                <div className="text-sm text-slate-600 space-y-2 leading-relaxed whitespace-pre-wrap">
                    {regulationInfo}
                </div>
                <p className="text-xs text-slate-400 mt-3 italic border-t border-slate-200 pt-2">
                    * {institution.type === 'Ortaokul' ? '19942' : '18812'} Sayılı Resmi Gazete mevzuatına göre yapay zeka tarafından özetlenmiştir. Mevzuat değişikliklerini Resmi Gazete üzerinden takip ediniz.
                </p>
             </div>
           </div>
        )}

        {/* TAB 3: AI AYARLARI */}
        {activeTab === 'ai' && (
            <div className="animate-fade-in space-y-8">
                
                {/* Info Card */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="bg-blue-600 p-3 rounded-lg text-white shrink-0">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-blue-900 mb-2">Google Gemini API Entegrasyonu (Kişisel Anahtar)</h3>
                            <p className="text-blue-800/80 text-sm leading-relaxed mb-4">
                                Uygulamada hiçbir gömülü veya paylaşımlı API anahtarı bulunmamaktadır. Her kullanıcı/kurum kendi ücretsiz Google Gemini API anahtarını kullanır.
                                Girdiğiniz anahtar yalnızca bu tarayıcının yerel hafızasında (Local Storage) saklanır ve hiçbir harici sunucuya iletilmez.
                            </p>

                            <div className="bg-white/80 border border-blue-200 rounded-lg p-3 text-xs text-blue-950 mb-4 space-y-1.5">
                                <p className="font-bold flex items-center gap-1.5 text-blue-900">
                                    <Key className="w-4 h-4 text-blue-600" /> Ücretsiz API Anahtarı Nasıl Alınır?
                                </p>
                                <ol className="list-decimal list-inside space-y-1 text-blue-800/90 ml-1">
                                    <li>Aşağıdaki butona tıklayarak <strong>Google AI Studio</strong> sayfasına gidin ve Google hesabınızla giriş yapın.</li>
                                    <li>Açılan sayfada <strong>"Create API Key"</strong> butonuna basarak yeni bir Gemini anahtarı oluşturun.</li>
                                    <li>Oluşturulan anahtarı kopyalayıp aşağıdaki kutucuğa yapıştırın, <strong>"Test Et"</strong> butonuna basın ve ardından <strong>"Kaydet"</strong> ile kaydedin.</li>
                                </ol>
                            </div>

                            <a 
                                href="https://aistudio.google.com/app/apikey" 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors shadow-sm"
                            >
                                <ExternalLink className="w-4 h-4" />
                                Google AI Studio'dan Ücretsiz API Anahtarı Al
                            </a>
                        </div>
                    </div>
                </div>

                {/* Input Area */}
                <div className="max-w-2xl bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                        <label className="block text-sm font-bold text-slate-800">
                            Google Gemini API Anahtarınız
                        </label>
                        {apiKey ? (
                            <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                                <CheckCircle className="w-3 h-3 text-emerald-600" /> Anahtar Kayıtlı
                            </span>
                        ) : (
                            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 text-amber-600" /> Anahtar Tanımlanmadı
                            </span>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <input 
                                type={showKey ? "text" : "password"} 
                                value={tempKey}
                                onChange={(e) => {
                                    setTempKey(e.target.value);
                                    if (testStatus !== 'idle') setTestStatus('idle');
                                }}
                                placeholder="AIzaSy..."
                                className="w-full p-3 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                            />
                            <button 
                                onClick={() => setShowKey(!showKey)}
                                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
                                title={showKey ? "Gizle" : "Göster"}
                            >
                                {showKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                        <button 
                            onClick={handleTestKey}
                            disabled={!tempKey.trim() || testStatus === 'testing'}
                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-all border shrink-0 ${
                                testStatus === 'success' 
                                ? 'bg-green-50 text-green-700 border-green-200' 
                                : testStatus === 'error'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 disabled:opacity-50'
                            }`}
                        >
                            {testStatus === 'testing' ? <Loader2 className="w-5 h-5 animate-spin" /> : 
                             testStatus === 'success' ? <div className="flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Çalışıyor</div> :
                             testStatus === 'error' ? <div className="flex items-center gap-1"><XCircle className="w-4 h-4" /> Hatalı</div> :
                             'Test Et'}
                        </button>
                    </div>

                    {/* Detailed Test Feedback */}
                    {testMessage && (
                        <div className={`p-4 rounded-xl text-xs leading-relaxed border ${
                            testStatus === 'success'
                                ? 'bg-green-50 text-green-800 border-green-200'
                                : 'bg-red-50 text-red-800 border-red-200'
                        }`}>
                            <div className="flex items-start gap-2">
                                {testStatus === 'success' ? (
                                    <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1">
                                    <p className="font-semibold">{testMessage}</p>
                                    
                                    {testErrorType === 'PERMISSION_DENIED' && (
                                        <div className="mt-3 p-3 bg-white/80 rounded-lg border border-red-200 text-slate-700 space-y-1.5">
                                            <p className="font-bold text-red-700">💡 403 Erişim İzni Hatası Çözümü:</p>
                                            <ul className="list-disc list-inside space-y-1 text-slate-600">
                                                <li>Girdiğiniz API anahtarının ait olduğu Google Cloud projesinde <strong>Generative Language API</strong> etkinleştirilmemiş olabilir.</li>
                                                <li>API anahtarınızın HTTP Referrer, IP veya API kısıtlamaları bulunuyor olabilir.</li>
                                                <li>En basit çözüm: <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">Google AI Studio</a>'dan kısıtlamasız yeni bir anahtar alıp buraya yapıştırmaktır.</li>
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Model Selection & Auto-Detection */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <label className="block text-xs font-bold text-slate-800">
                                🧠 Yapay Zeka Modeli Tercihi
                            </label>
                            {detectedModel && (
                                <span className="text-[11px] text-blue-700 bg-blue-100 border border-blue-200 px-2.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 w-fit">
                                    <Sparkles className="w-3 h-3 text-blue-600" />
                                    Aktif: {getModelFriendlyName(detectedModel)}
                                </span>
                            )}
                        </div>
                        <select
                            value={selectedModel}
                            onChange={(e) => {
                                setSelectedModel(e.target.value);
                                setPreferredModel(e.target.value);
                            }}
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            {MODEL_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                    {opt.name}
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                            Program, farklı Google hesaplarının desteklediği modelleri (Gemini 2.0 Flash, 1.5 Flash, 2.5 Flash vb.) otomatik algılar. Herhangi bir modelde kota sınırı (429) veya erişim kısıtı olursa sıradaki en kararlı modele otomatik geçiş yapar.
                        </p>
                    </div>

                    {/* API Key Diversity & Compatibility Note */}
                    <div className="p-4 bg-indigo-50/70 border border-indigo-150 rounded-xl text-xs text-indigo-950 space-y-1.5">
                        <p className="font-bold text-indigo-900 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            Google Gemini API Çeşitleri & Akıllı Uyumluluk:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-slate-700 text-[11px] leading-relaxed">
                            <li><strong>Google AI Studio (Ücretsiz):</strong> En yaygın standart türdür. <code>gemini-2.0-flash</code> ve <code>gemini-1.5-flash</code> modellerini tam destekler.</li>
                            <li><strong>Model Kısıtlamalı / Kurumsal Anahtarlar:</strong> Bazı anahtarlar belirli önizleme modellerine kapalı olsa dahi sistem bunu algılayıp çalışan diğer modellere otomatik bağlanır.</li>
                            <li><strong>Kota ve Yoğunluk Koruması:</strong> Ücretsiz kotanız anlık olarak dolsa bile (429/503), sistem diğer kotalı modelleri deneyerek analizinizi kesintiye uğratmaz.</li>
                        </ul>
                    </div>

                    <p className="text-xs text-slate-500">
                        API anahtarınız sadece sizin tarayıcınızda (Local Storage) saklanır.
                    </p>

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                        <button 
                            onClick={handleSaveKey}
                            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium flex items-center gap-2 text-sm"
                        >
                            <Save className="w-4 h-4" />
                            API Anahtarını Kaydet
                        </button>

                        {(apiKey || tempKey) && (
                            <button 
                                onClick={handleClearKey}
                                className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 px-4 py-2.5 rounded-lg transition-colors font-medium flex items-center gap-2 text-sm"
                                title="Kayıtlı API anahtarını temizle"
                            >
                                <Trash2 className="w-4 h-4" />
                                Anahtarı Sil
                            </button>
                        )}
                    </div>
                </div>

            </div>
        )}

        {/* TAB 4: VERİ YEDEKLEME VE GERİ YÜKLEME */}
        {activeTab === 'backup' && (
            <div className="animate-fade-in space-y-8">
                {/* Info Card */}
                <div className="bg-blue-50 border border-blue-150 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                        <div className="bg-blue-600 p-3 rounded-lg text-white shrink-0">
                            <Database className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-blue-900 mb-2">Veri Yedekleme ve Kurtarma Kontrolü</h3>
                            <p className="text-blue-800/80 text-sm leading-relaxed">
                                Bu panel üzerinden tüm verilerinizi (Kurum ayarları, kurul üyeleri, ekli öğrenciler ve tüm kayıtlı disiplin olayları ile kararlar) tek bir JSON dosyası olarak bilgisayarınıza indirebilir; dilediğiniz zaman bu dosyayı geri yükleyerek sisteminizi kurtarabilirsiniz.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Export Box */}
                    <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 flex flex-col justify-between space-y-4">
                        <div>
                            <div className="flex items-center gap-2 text-blue-600 font-bold mb-2">
                                <Download className="w-5 h-5" />
                                <h4>Yedek Veri İndir (JSON Export)</h4>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed">
                                Sistemdeki tüm okul, kurul, öğrenci ve olay kayıtlarını tek tıklama ile yedekleyin. Tarayıcınız, içerisinde tüm verilerinizin şifrelenmemiş (plain text JSON) kopyasını barındıran bir dosya indirecektir.
                            </p>
                        </div>
                        <button 
                            onClick={handleExportJSON}
                            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-semibold flex items-center justify-center gap-2"
                        >
                            <Download className="w-5 h-5" />
                            Verileri JSON Olarak İndir
                        </button>
                    </div>

                    {/* Import Box */}
                    <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/50 flex flex-col justify-between space-y-4">
                        <div>
                            <div className="flex items-center gap-2 text-amber-600 font-bold mb-2">
                                <Upload className="w-5 h-5" />
                                <h4>Yedek Veri Yükle (JSON Import)</h4>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed text-left">
                                Daha önce bilgisayarınıza indirdiğiniz veya başka bir cihazdan aldığınız veri yedekleme dosyasını (.json) seçerek mevcut verilerinizle birleştirebilirsiniz.
                            </p>
                            <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs text-indigo-700 font-medium flex items-start gap-2 mt-3">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>Yükleme işlemi, eski veya eksik formatları otomatik tamamlayarak sistemdeki mevcut kayıtlarınızın üzerine güvenilir bir şekilde birleştirecektir.</span>
                            </div>
                        </div>
                        <div className="relative">
                            <input 
                                type="file" 
                                accept=".json"
                                onChange={handleImportJSON}
                                id="json-import-file"
                                className="hidden" 
                            />
                            <label 
                                htmlFor="json-import-file"
                                className="w-full bg-amber-600 text-white px-6 py-3 rounded-lg hover:bg-amber-700 transition-colors shadow-sm font-semibold flex items-center justify-center gap-2 cursor-pointer text-center"
                            >
                                <Upload className="w-5 h-5" />
                                JSON Yedek Dosyası Seç ve Yükle
                            </label>
                        </div>
                    </div>
                </div>

                {/* Windows Desktop AppData & Automated Backups (When running in Electron) */}
                {window.electronAPI && (
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs space-y-5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                            <div>
                                <h4 className="font-bold text-slate-800 text-base flex items-center gap-2">
                                    <Database className="w-5 h-5 text-emerald-600" />
                                    Windows AppData Kalıcı Depolama & Otomatik Yedekler
                                </h4>
                                <p className="text-xs text-slate-500 mt-1">
                                    Uygulama güncellense dahi verileriniz silinmez; Windows kullanıcı klasörünüzde güvenle korunur.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={loadDesktopBackups}
                                    disabled={isLoadingBackups}
                                    className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1.5 transition-colors"
                                >
                                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBackups ? 'animate-spin' : ''}`} />
                                    Yenile
                                </button>
                                <button
                                    onClick={handleCreateDesktopBackup}
                                    className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
                                >
                                    <Plus className="w-4 h-4" />
                                    Şimdi Anlık Yedek Al
                                </button>
                            </div>
                        </div>

                        {backupActionSuccess && (
                            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg font-medium flex items-center gap-2">
                                <CheckCircle className="w-4 h-4 text-emerald-600" />
                                {backupActionSuccess}
                            </div>
                        )}

                        <div className="p-3 bg-slate-50 rounded-lg text-xs font-mono text-slate-600 break-all flex items-center justify-between">
                            <span><strong>Veri Depolama Konumu:</strong> {electronPath || '%APPDATA%\\e-okul-disiplin-ai-pro'}</span>
                            <span className="text-emerald-700 font-sans font-bold bg-emerald-100 px-2 py-0.5 rounded text-[11px]">Korumalı</span>
                        </div>

                        <div>
                            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                                Kaydedilmiş Otomatik / Sistem Yedekleri ({electronBackupsList.length})
                            </h5>
                            {isLoadingBackups ? (
                                <div className="text-center py-6 text-slate-400 text-xs flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Yedekler taranıyor...
                                </div>
                            ) : electronBackupsList.length === 0 ? (
                                <div className="text-center py-6 text-slate-400 text-xs border border-dashed rounded-lg">
                                    Henüz arşivlenmiş otomatik yedek dosyası bulunmuyor. Sistem otomatik olarak yedek alacaktır veya "Şimdi Anlık Yedek Al" butonunu kullanabilirsiniz.
                                </div>
                            ) : (
                                <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                                    {electronBackupsList.map((bk) => (
                                        <div key={bk.name} className="p-3 flex items-center justify-between hover:bg-slate-50">
                                            <div>
                                                <div className="font-semibold text-slate-800">{bk.name}</div>
                                                <div className="text-[11px] text-slate-400">
                                                    {new Date(bk.date).toLocaleString('tr-TR')} &bull; {(bk.size / 1024).toFixed(1)} KB
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRestoreDesktopBackup(bk.name)}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded font-medium text-xs transition-colors"
                                            >
                                                Geri Yükle
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* TAB 5: BULUT & WEB SENKRONİZASYON */}
        {activeTab === 'sync' && (
          <div className="animate-fade-in space-y-6 max-w-3xl">
            {/* Header Card */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                  <Cloud className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold tracking-tight">Bulut & Web Senkronizasyonu</h3>
                  <p className="text-xs text-blue-200/80 mt-1">
                    Masaüstü uygulaması ile <span className="font-mono text-blue-300 font-semibold">https://www.evrakplus.com/disiplin-cezasi-programi</span> arasında tam iki yönlü senkronizasyon sağlar.
                  </p>
                </div>
              </div>

              {/* Sync Diagram */}
              <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center text-xs text-slate-300">
                <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex flex-col items-center gap-1.5">
                  <Laptop className="w-5 h-5 text-emerald-400" />
                  <span className="font-semibold text-white">Masaüstü Uygulaması</span>
                  <span className="text-[10px] text-slate-400">Windows (.exe)</span>
                </div>
                <div className="flex flex-col items-center justify-center gap-1 text-blue-300">
                  <ArrowRightLeft className="w-5 h-5 animate-pulse" />
                  <span className="text-[11px] font-mono font-bold text-sky-300">evrakplus.com</span>
                  <span className="text-[10px] text-slate-400">Canlı Eşitleme</span>
                </div>
                <div className="bg-white/5 p-3 rounded-xl border border-white/10 flex flex-col items-center gap-1.5">
                  <Globe className="w-5 h-5 text-sky-400" />
                  <span className="font-semibold text-white">Web Sürümü</span>
                  <span className="text-[10px] text-slate-400">Tarayıcı / Mobil</span>
                </div>
              </div>
            </div>

            {/* Feedback Message */}
            {cloudFeedback && (
              <div className={`p-4 rounded-xl flex items-start gap-3 text-sm animate-in fade-in ${
                cloudFeedback.type === 'success' 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}>
                {cloudFeedback.type === 'success' ? (
                  <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 font-medium">{cloudFeedback.message}</div>
              </div>
            )}

            {cloudConfig.user ? (
              /* AKTİF BULUT HESABI */
              <div className="space-y-6">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center font-bold">
                        <User className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="text-base font-bold text-slate-900">
                          {cloudConfig.user.displayName || cloudConfig.user.username}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          Hesap: {cloudConfig.user.username}
                        </div>
                      </div>
                    </div>

                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <ShieldCheck className="w-4 h-4" />
                      Bulut Aktif
                    </span>
                  </div>

                  <div className="pt-4 border-t border-slate-200 grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500">Son Senkronizasyon:</span>
                      <div className="font-semibold text-slate-800 mt-0.5">
                        {cloudConfig.lastSyncedAt 
                          ? new Date(cloudConfig.lastSyncedAt).toLocaleString('tr-TR') 
                          : 'Henüz yapılmadı'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Senkronizasyon Sunucusu:</span>
                      <div className="font-mono text-slate-700 mt-0.5 truncate">
                        {cloudConfig.endpointUrl}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Otomatik Senkronizasyon Ayarı */}
                <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Otomatik Arka Plan Senkronizasyonu</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Herhangi bir öğrenci, olay veya ayar güncellendiğinde verileri otomatik olarak buluta eşitler.
                    </div>
                  </div>
                  <button
                    onClick={handleToggleAutoSync}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      cloudConfig.autoSync ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        cloudConfig.autoSync ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Butonlar */}
                <div className="flex gap-4">
                  <button
                    onClick={handleCloudManualSync}
                    disabled={cloudSyncing}
                    className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${cloudSyncing ? 'animate-spin' : ''}`} />
                    {cloudSyncing ? 'Senkronize Ediliyor...' : 'Şimdi Senkronize Et (İki Yönlü Eşitle)'}
                  </button>

                  <button
                    onClick={handleCloudLogout}
                    className="px-5 py-3.5 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 border border-slate-200 rounded-xl font-medium text-sm transition-all flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Çıkış Yap
                  </button>
                </div>
              </div>
            ) : (
              /* EVRAKPLUS.COM GİRİŞ FORMU */
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
                  <div className="font-bold flex items-center gap-1.5 text-blue-950 mb-1">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    Tek Üyelik, Çift Yönlü Tam Senkronizasyon
                  </div>
                  <strong>evrakplus.com</strong> sitesindeki mevcut üyeliğinizle giriş yaptığınızda; hem masaüstü uygulamanız hem de web sürümünüz aynı veritabanına bağlanır. Yeni veya ayrı bir hesap açmanıza gerek yoktur.
                </div>

                <form onSubmit={handleCloudLogin} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      evrakplus.com E-Posta Adresi veya Kullanıcı Adı
                    </label>
                    <input
                      type="text"
                      required
                      value={cloudUsername}
                      onChange={e => setCloudUsername(e.target.value)}
                      placeholder="ornek@okul.k12.tr veya kullanici_adi"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      evrakplus.com Şifresi
                    </label>
                    <input
                      type="password"
                      required
                      value={cloudPassword}
                      onChange={e => setCloudPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
                    🔒 <strong>Güvenli ve KVKK Uyumlu:</strong> Verileriniz doğrudan <span className="font-semibold text-slate-800">evrakplus.com</span> üzerindeki şifreli ve korumalı alanda depolanır.
                  </div>

                  <button
                    type="submit"
                    disabled={cloudLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                  >
                    {cloudLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                    Evrakplus Hesabıyla Giriş Yap ve Senkronizasyonu Başlat
                  </button>

                  <div className="pt-2 text-center">
                    <a
                      href="https://www.evrakplus.com/giris/?sekme=kayit"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      <span>Henüz evrakplus.com üyesi değil misiniz? Buradan ücretsiz kayıt olun</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Import Confirmation Modal */}
      {isImportModalOpen && importFile && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-slate-100 bg-amber-50 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-amber-600" />
                    <h3 className="font-bold text-amber-900">Yedek Veri Birleştirme Onayı</h3>
                 </div>
                 <button onClick={() => { setIsImportModalOpen(false); setImportFile(null); }}><X className="w-5 h-5 text-amber-400 hover:text-amber-700" /></button>
              </div>
              <div className="p-6 text-slate-600 text-sm">
                 <p className="font-medium text-slate-800 mb-2">Seçilen Dosya: {importFile.name}</p>
                 <p className="mb-3">Bu yedekleme dosyasını yüklemek mevcut verilerinizle <b>güvenli bir şekilde birleştirilecektir</b> (Merge).</p>
                 <ul className="list-disc pl-5 mb-4 space-y-1 text-slate-500">
                    <li>Aynı kayıtlar güncellenir.</li>
                    <li>Yeni kayıtlar eklenir.</li>
                 </ul>
                 
                 <label className="flex items-start gap-2 mb-4 p-3 bg-slate-50 rounded border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                     <input 
                         type="checkbox" 
                         checked={autoBackupBeforeImport}
                         onChange={(e) => setAutoBackupBeforeImport(e.target.checked)}
                         className="mt-0.5 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                     />
                     <span className="text-sm">
                         İşlemden önce mevcut verilerimin <b>otomatik güvenlik yedeğini</b> (Auto-Backup) cihaza indir.
                     </span>
                 </label>

                 <p className="font-medium text-red-600">Devam etmek istediğinize emin misiniz?</p>
              </div>
              <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                 <button 
                    onClick={() => { setIsImportModalOpen(false); setImportFile(null); }}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                 >
                    İptal
                 </button>
                 <button 
                    onClick={confirmImportData}
                    className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium shadow-sm flex items-center gap-2"
                 >
                    <Check className="w-4 h-4" />
                    Evet, İçe Aktar
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
              <div className="p-4 border-b border-slate-100 bg-red-50 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                    <h3 className="font-bold text-red-900">Silme İşlemi</h3>
                 </div>
                 <button onClick={() => setMemberToDelete(null)}><X className="w-5 h-5 text-red-400 hover:text-red-700" /></button>
              </div>
              <div className="p-6 text-slate-600 text-sm">
                 <p>Bu kurul üyesini silmek istediğinize emin misiniz?</p>
                 <p className="mt-2 text-xs text-slate-400">Bu işlem evraklardaki imza sirkülerini etkileyecektir.</p>
              </div>
              <div className="p-4 bg-slate-50 flex justify-end gap-3 border-t border-slate-100">
                 <button 
                    onClick={() => setMemberToDelete(null)}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
                 >
                    İptal
                 </button>
                 <button 
                    onClick={confirmDeleteMember}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium shadow-sm"
                 >
                    Evet, Sil
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default Settings;
