import React, { useState, useEffect } from 'react';
import { 
  User, 
  Shield, 
  Code, 
  Terminal, 
  Mail, 
  Github, 
  Monitor, 
  Sparkles, 
  FolderOpen, 
  Database,
  ExternalLink,
  CheckCircle,
  FileText,
  RefreshCw
} from 'lucide-react';
import { UpdateNotificationModal } from './UpdateNotificationModal';

const About = () => {
  const [userDataPath, setUserDataPath] = useState<string>('C:\\Users\\...\\AppData\\Roaming\\e-okul-disiplin-ai-pro');
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [isElectron, setIsElectron] = useState<boolean>(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      setIsElectron(true);
      if (window.electronAPI.version) setAppVersion(window.electronAPI.version);
      window.electronAPI.getUserDataPath().then(path => {
        if (path) setUserDataPath(path);
      }).catch(() => {});
    }
  }, []);

  const openGithub = () => {
    const url = "https://github.com/abdullahyanarates/e-okul-disiplin-ai-pro";
    if (window.electronAPI) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-900 rounded-3xl p-8 md:p-10 text-white shadow-2xl border border-slate-800">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 p-0.5 shadow-xl shadow-blue-900/40 shrink-0 flex items-center justify-center">
            <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center border border-white/10">
              <Shield className="w-12 h-12 text-blue-400" />
            </div>
          </div>

          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Resmi Masaüstü Sürümü
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Windows 10 & 11 Uyumlu
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
              E-OKUL DİSİPLİN AI PRO
            </h1>

            <p className="text-slate-300 text-sm md:text-base leading-relaxed max-w-2xl">
              Okul disiplin süreçlerini yönetmek, olayları kaydetmek, kararları düzenlemek ve raporlamak için geliştirilmiş profesyonel masaüstü uygulaması.
            </p>

            <div className="pt-2 text-sm font-semibold text-blue-300">
              İmza: <span className="text-white font-bold underline decoration-blue-500 decoration-2 underline-offset-4">By Abdullah Yanarateş</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Developer & Ownership Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Proje Sahibi ve Geliştirici
          </h2>

          <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="w-14 h-14 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
              AY
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Geliştirici & Tasarımcı</p>
              <h3 className="text-lg font-bold text-slate-800">Abdullah Yanarateş</h3>
              <p className="text-xs text-blue-600 font-medium">By Abdullah Yanarateş</p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-600 pt-2">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500 flex items-center gap-2">
                <Mail className="w-4 h-4 text-slate-400" /> E-Posta
              </span>
              <a href="mailto:appo.yanarates@gmail.com" className="font-semibold text-slate-800 hover:text-blue-600 transition-colors">
                appo.yanarates@gmail.com
              </a>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-slate-500 flex items-center gap-2">
                <Github className="w-4 h-4 text-slate-400" /> GitHub Deposu
              </span>
              <button 
                onClick={openGithub}
                className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
              >
                <span>GitHub Projesi</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* System & Platform Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h2 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
            <Terminal className="w-5 h-5 text-emerald-600" />
            Sistem ve Platform Bilgileri
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Yazılım Sürümü</p>
              <p className="text-base font-extrabold text-slate-800 font-mono">v{appVersion}</p>
              <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                Kararlı Sürüm
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Desteklenen Platform</p>
              <p className="text-base font-extrabold text-slate-800">Windows 10 / 11</p>
              <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                64-Bit (x64)
              </span>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Çalışma Modu</p>
              <p className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Monitor className="w-4 h-4 text-purple-600" />
                {isElectron ? 'Masaüstü (Electron)' : 'Web Tarayıcı'}
              </p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Çevrimdışı Çalışma</p>
              <p className="text-sm font-bold text-emerald-700 flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Tam Uyumlu
              </p>
            </div>
          </div>

          {/* User Data Path in Windows */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-700">
              <Database className="w-4 h-4 text-blue-600" />
              <span>Kullanıcı Veri Klasörü (AppData)</span>
            </div>
            <p className="font-mono text-[11px] text-slate-500 break-all bg-white p-2 rounded border border-slate-200">
              {userDataPath}
            </p>
            <p className="text-[10px] text-slate-400">
              Uygulama güncellendiğinde veya yeniden kurulduğunda verileriniz bu güvenli klasörde korunur.
            </p>
          </div>

          <div className="pt-1">
            <button
              onClick={() => setIsUpdateModalOpen(true)}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Yazılım Güncellemelerini Denetle
            </button>
          </div>

          <UpdateNotificationModal
            isOpenManually={isUpdateModalOpen}
            onCloseManual={() => setIsUpdateModalOpen(false)}
          />
        </div>

      </div>

      {/* Feature & Technical Highlights */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
        <h2 className="font-bold text-slate-800 text-base border-b border-slate-100 pb-3 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" />
          Temel Yetenekler ve Standartlar
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600 leading-relaxed">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-blue-600" />
              Resmi MEB Belge Motoru
            </h4>
            <p>
              Olay tutanakları, savunma isteme, ifade alma, EK-10 kurul kararları ve karar defteri çıktılarını tam Türkçe Unicode desteğiyle PDF ve Word (.docx) olarak oluşturur.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Monitor className="w-4 h-4 text-indigo-600" />
              Yerel & Güvenli Mimari
            </h4>
            <p>
              Node integration kısıtlı, context isolation aktif güvenli preload mimarisi. Veriler kurulum dizinine değil, Windows AppData klasörüne otomatik yedekli olarak yazılır.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Code className="w-4 h-4 text-emerald-600" />
              Yapay Zeka Destekli Karar
            </h4>
            <p>
              Google Gemini AI desteği ile olay metinlerini analiz eder, ilgili mevzuat maddelerini ve objektif ceza tekliflerini otomatik olarak önerir.
            </p>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <div className="text-center pt-4 pb-8 space-y-1 text-xs text-slate-400">
        <p className="font-semibold text-slate-600">
          E-Okul Disiplin AI Pro • Projenin Sahibi ve Geliştiricisi: <span className="text-slate-800 font-bold">By Abdullah Yanarateş</span>
        </p>
        <p>© 2026 Tüm Hakları Saklıdır. Millî Eğitim Bakanlığı mevzuatına uygun olarak hazırlanmıştır.</p>
      </div>
    </div>
  );
};

export default About;
