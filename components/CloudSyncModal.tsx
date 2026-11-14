import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  User, 
  Lock, 
  LogOut, 
  X, 
  ShieldCheck, 
  Laptop, 
  Globe, 
  ArrowRightLeft,
  Loader2,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { 
  getCloudSyncConfig, 
  saveCloudSyncConfig, 
  loginCloudAccount, 
  logoutCloudAccount, 
  performCloudSync, 
  checkEvrakPlusWebSession,
  CloudUser 
} from '../services/cloudSyncService';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({ isOpen, onClose }) => {
  const [config, setConfig] = useState(getCloudSyncConfig());
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isWebEnvironment = typeof window !== 'undefined' && window.location.hostname.toLowerCase().includes('evrakplus.com');

  useEffect(() => {
    const handleConfigChange = (e: any) => {
      setConfig(e.detail || getCloudSyncConfig());
    };
    const handleSyncStatus = (e: any) => {
      if (e.detail?.status === 'syncing') setIsSyncing(true);
      if (e.detail?.status === 'synced') {
        setIsSyncing(false);
        setFeedback({ type: 'success', message: 'Veriler başarıyla senkronize edildi!' });
        setTimeout(() => setFeedback(null), 3500);
      }
      if (e.detail?.status === 'error') {
        setIsSyncing(false);
        setFeedback({ type: 'error', message: e.detail.error || 'Senkronizasyon hatası' });
      }
    };

    window.addEventListener('cloud-sync-config-changed', handleConfigChange);
    window.addEventListener('cloud-sync-status', handleSyncStatus);

    return () => {
      window.removeEventListener('cloud-sync-config-changed', handleConfigChange);
      window.removeEventListener('cloud-sync-status', handleSyncStatus);
    };
  }, []);

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setFeedback({ type: 'error', message: 'Lütfen evrakplus.com e-posta adresinizi ve şifrenizi girin.' });
      return;
    }

    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await loginCloudAccount(username.trim(), password);
      if (res.ok) {
        setFeedback({ type: 'success', message: `Evrakplus hesabı bağlandı! Hoş geldiniz, ${res.user?.displayName || res.user?.username}` });
        setConfig(getCloudSyncConfig());
      } else {
        setFeedback({ type: 'error', message: res.error || 'Giriş yapılamadı.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckWebSession = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const res = await checkEvrakPlusWebSession();
      if (res.ok && res.isLoggedIn) {
        setFeedback({ type: 'success', message: `Evrakplus oturumunuz otomatik olarak bağlandı!` });
        setConfig(getCloudSyncConfig());
      } else {
        setFeedback({ type: 'error', message: 'evrakplus.com üzerinde açık oturum bulunamadı. Lütfen e-posta ve şifrenizle giriş yapın.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    setFeedback(null);
    try {
      const res = await performCloudSync();
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Tüm öğrenci, olay ve ayar verileri başarıyla eşitlendi!' });
        setTimeout(() => setFeedback(null), 3500);
      } else {
        setFeedback({ type: 'error', message: res.error || 'Senkronizasyon hatası' });
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm('Bulut hesabından çıkış yapmak istediğinize emin misiniz? Yerel verileriniz korunacaktır.')) {
      logoutCloudAccount();
      setConfig(getCloudSyncConfig());
      setFeedback({ type: 'success', message: 'Çıkış yapıldı. Program yalnızca yerel modda çalışıyor.' });
      setTimeout(() => setFeedback(null), 3000);
    }
  };

  const toggleAutoSync = () => {
    const nextVal = !config.autoSync;
    saveCloudSyncConfig({ autoSync: nextVal });
    setConfig(prev => ({ ...prev, autoSync: nextVal }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">Evrak Plus Üyelik & Senkronizasyon</h2>
              <p className="text-xs text-blue-200/80 mt-0.5">
                <span className="text-blue-300 font-mono font-semibold">evrakplus.com</span> üyeliğiniz ile Masaüstü ve Web tam senkronize
              </p>
            </div>
          </div>

          {/* Sync visual explanation */}
          <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
            <div className="flex items-center gap-1.5">
              <Laptop className="w-4 h-4 text-emerald-400" />
              <span>Masaüstü Uygulaması</span>
            </div>
            <div className="flex items-center gap-1 text-blue-300">
              <ArrowRightLeft className="w-3.5 h-3.5 animate-pulse" />
              <span className="text-[11px] font-mono font-semibold text-sky-300">evrakplus.com</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-sky-400" />
              <span>Web Sürümü</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {feedback && (
            <div className={`p-4 rounded-xl flex items-start gap-3 text-sm animate-in fade-in ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium">{feedback.message}</div>
            </div>
          )}

          {config.user ? (
            /* BAĞLI EVRAKPLUS HESABI */
            <div className="space-y-5">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center font-bold text-sm">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">
                        {config.user.displayName || config.user.username}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        Evrakplus Hesabı: {config.user.username}
                      </div>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Tam Senkronize
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                  <span>Son Senkronizasyon:</span>
                  <span className="font-semibold text-slate-800">
                    {config.lastSyncedAt 
                      ? new Date(config.lastSyncedAt).toLocaleString('tr-TR') 
                      : 'Henüz yapılmadı'}
                  </span>
                </div>
              </div>

              {/* Otomatik Eşitleme ve Hızlı Eylemler */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">Otomatik Senkronizasyon</div>
                    <div className="text-xs text-slate-500">
                      Öğrenci veya olay eklendiğinde/değiştirildiğinde arka planda evrakplus.com hesabınıza eşitler.
                    </div>
                  </div>
                  <button
                    onClick={toggleAutoSync}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      config.autoSync ? 'bg-blue-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        config.autoSync ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-sm transition-all shadow-sm disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    {isSyncing ? 'Senkronize Ediliyor...' : 'Şimdi Senkronize Et'}
                  </button>

                  <button
                    onClick={handleLogout}
                    className="px-4 py-3 bg-slate-100 hover:bg-red-50 hover:text-red-600 text-slate-700 border border-slate-200 rounded-xl font-medium text-sm transition-all flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Çıkış Yap
                  </button>
                </div>
              </div>

              <div className="bg-blue-50/70 border border-blue-200/60 rounded-xl p-3.5 text-xs text-blue-900 leading-relaxed">
                💡 <strong>Bilgi:</strong> Masaüstü programınızda yaptığınız her işlem anında <a href="https://www.evrakplus.com/disiplin-cezasi-programi" target="_blank" rel="noreferrer" className="text-blue-700 underline font-semibold">evrakplus.com/disiplin-cezasi-programi</a> web adresinizle eşleşir.
              </div>
            </div>
          ) : (
            /* EVRAKPLUS.COM GİRİŞ FORMU */
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100 text-xs text-blue-900 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-blue-950 mb-1">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  Tek Üyelik, Kesintisiz Senkronizasyon
                </div>
                <strong>evrakplus.com</strong> sitesindeki mevcut üyeliğinizle giriş yaptığınızda; hem masaüstü uygulamanız hem de web sürümünüz aynı veritabanına bağlanır.
              </div>

              {isWebEnvironment && (
                <button
                  type="button"
                  onClick={handleCheckWebSession}
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-sm transition-all"
                >
                  <ShieldCheck className="w-4 h-4" />
                  evrakplus.com Açık Oturumuyla Tek Tıkla Bağlan
                </button>
              )}

              <form onSubmit={handleLogin} className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    evrakplus.com E-Posta veya Kullanıcı Adı
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="ornek@okul.k12.tr veya kullanici_adi"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    evrakplus.com Şifresi
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-60"
                >
                  {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Evrakplus Hesabıyla Giriş Yap ve Eşitle
                </button>
              </form>

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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
