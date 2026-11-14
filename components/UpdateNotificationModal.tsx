import React, { useState, useEffect } from 'react';
import { 
  Download, Sparkles, CheckCircle2, AlertTriangle, 
  ArrowUpCircle, X, ExternalLink, RefreshCw, Loader2, HardDrive, Globe
} from 'lucide-react';
import { checkForAppUpdates, UpdateInfo, DownloadProgress } from '../services/updateService';

interface UpdateModalProps {
  // Can be manually opened or auto-checked
  isOpenManually?: boolean;
  onCloseManual?: () => void;
}

export const UpdateNotificationModal: React.FC<UpdateModalProps> = ({ 
  isOpenManually = false, 
  onCloseManual 
}) => {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isBannerVisible, setIsBannerVisible] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);

  // Download states
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Check on mount
  useEffect(() => {
    checkUpdates(false);
  }, []);

  // When opened manually via button
  useEffect(() => {
    if (isOpenManually) {
      setIsModalOpen(true);
      checkUpdates(true);
    }
  }, [isOpenManually]);

  // Listen to Electron progress
  useEffect(() => {
    if (window.electronAPI?.onUpdateProgress) {
      const unsubscribe = window.electronAPI.onUpdateProgress((progress) => {
        setDownloadProgress(progress);
      });
      return () => unsubscribe();
    }
  }, []);

  const checkUpdates = async (isManual = false) => {
    setIsChecking(true);
    setCheckMessage(null);
    try {
      const info = await checkForAppUpdates();
      if (info && info.hasUpdate) {
        setUpdateInfo(info);
        setIsBannerVisible(true);
        // Otomatik güncelleme bulunduğunda kullanıcıyı doğrudan bilgilendir
        setIsModalOpen(true);
      } else {
        setUpdateInfo(info);
        if (isManual) {
          setCheckMessage("Tebrikler! En güncel sürümü kullanıyorsunuz.");
          setIsModalOpen(true);
        }
      }
    } catch (err) {
      if (isManual) {
        setCheckMessage("Güncellemeler kontrol edilirken bir sorun oluştu.");
        setIsModalOpen(true);
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleStartDownload = async () => {
    if (!updateInfo) return;

    const setupAsset = updateInfo.setupAsset;
    const downloadUrl = setupAsset?.browser_download_url || updateInfo.downloadUrl;
    const assetUrl = setupAsset?.url;
    const filename = setupAsset?.name || `E-Okul-Disiplin-AI-Pro-Setup-v${updateInfo.latestVersion}.exe`;

    if (!window.electronAPI?.downloadUpdate) {
      // In web browser mode, redirect to GitHub download
      window.open(downloadUrl, '_blank');
      return;
    }

    setIsDownloading(true);
    setDownloadError(null);
    setDownloadProgress({ percent: 0, transferred: 0, total: setupAsset?.size || 0, speed: 0 });

    try {
      const res = await window.electronAPI.downloadUpdate({
        url: downloadUrl,
        assetUrl,
        filename
      });

      if (res.success && res.filePath) {
        setDownloadedFilePath(res.filePath);
      } else {
        setDownloadError(res.error || 'İndirme tamamlanamadı.');
      }
    } catch (err: any) {
      setDownloadError(err.message || 'İndirme işlemi sırasında hata oluştu.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleInstallNow = async () => {
    if (!downloadedFilePath || !window.electronAPI?.quitAndInstall) return;
    try {
      await window.electronAPI.quitAndInstall(downloadedFilePath);
    } catch (err) {
      alert('Yükleme başlatılamadı: ' + err);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    if (onCloseManual) onCloseManual();
  };

  return (
    <>
      {/* 1. TOP BANNER NOTIFICATION (Appears when new update is available) */}
      {isBannerVisible && updateInfo?.hasUpdate && !isModalOpen && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-700 text-white shadow-lg animate-bounce-short px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2.5 flex-1 cursor-pointer" onClick={() => setIsModalOpen(true)}>
            <span className="p-1.5 bg-white/20 rounded-full shrink-0">
              <Sparkles className="w-4 h-4 text-amber-300 animate-spin-slow" />
            </span>
            <div>
              <span className="font-extrabold text-white">Yeni Güncelleme Mevcut: v{updateInfo.latestVersion}!</span>
              <span className="ml-2 text-white/90 hidden sm:inline">
                Sistem kararlılık ve performans güncellemelerini hemen yükleyebilirsiniz.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-white text-blue-800 hover:bg-blue-50 font-bold px-3 py-1 rounded-lg transition-colors shadow-xs"
            >
              İncele ve Güncelle
            </button>
            <button
              onClick={() => setIsBannerVisible(false)}
              className="p-1 hover:bg-white/20 rounded text-white/80 hover:text-white"
              title="Kapat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. UPDATE DETAILS & DOWNLOAD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 flex flex-col">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-6 text-white relative">
              <button 
                onClick={closeModal} 
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/20 rounded-xl border border-blue-400/30">
                  <ArrowUpCircle className="w-7 h-7 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-white">E-Okul Disiplin AI Pro Güncellemesi</h3>
                  <p className="text-xs text-blue-200">
                    Proje Sahibi ve Geliştiricisi: <strong>By Abdullah Yanarateş</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 text-sm text-slate-700">
              
              {isChecking ? (
                <div className="py-8 text-center text-slate-500 space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto" />
                  <p className="text-xs font-semibold">GitHub üzerinden son sürümler taranıyor...</p>
                </div>
              ) : checkMessage && !updateInfo?.hasUpdate ? (
                <div className="text-center py-6 space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                    <CheckCircle2 className="w-7 h-7" />
                  </div>
                  <h4 className="font-bold text-slate-800 text-base">Uygulamanız Güncel!</h4>
                  <p className="text-xs text-slate-500">
                    Mevcut sürümünüz: <b>v{updateInfo?.currentVersion || '1.0.0'}</b>. Herhangi bir yeni güncelleme bulunmuyor.
                  </p>
                </div>
              ) : updateInfo?.hasUpdate ? (
                <>
                  {/* Version Comparison Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Mevcut Sürüm</span>
                      <span className="text-sm font-extrabold text-slate-700">v{updateInfo.currentVersion}</span>
                    </div>
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Yeni Sürüm</span>
                      <span className="text-sm font-extrabold text-emerald-800 flex items-center gap-1.5">
                        v{updateInfo.latestVersion} <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded font-bold">Yeni</span>
                      </span>
                    </div>
                  </div>

                  {/* evrakplus.com Yonlendirme Butonu */}
                  <a
                    href="https://www.evrakplus.com/programlar/yapay-zeka-destekli-disiplin-cezasi-programi-e-okul-disiplin-ai-pro/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="evrakplus.com Program ve Güncelleme Sayfasına Git"
                    className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border border-blue-200 hover:border-blue-300 rounded-xl text-blue-900 transition-all group shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                        <Globe className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-xs font-bold block text-blue-950">evrakplus.com Program & Güncelleme Sayfası</span>
                        <span className="text-[10px] text-blue-600 font-medium">Rehber, detaylar ve doğrudan indirme için tıklayın</span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-blue-500 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </a>

                  {/* Release Notes */}
                  {updateInfo.releaseNotes && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Düzeltmeler ve Güncellemeler</h4>
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-600 max-h-40 overflow-y-auto whitespace-pre-wrap leading-relaxed font-sans">
                        {updateInfo.releaseNotes
                          .replace(/\*\*Full Changelog\*\*:[^\n]*/gi, '')
                          .replace(/https:\/\/github\.com\/[^\s]+\/compare\/[^\s]+/gi, '')
                          .replace(/## What's Changed/gi, '')
                          .trim() || 'Düzeltmeler ve güncellemeler'}
                      </div>
                    </div>
                  )}

                  {/* Download Progress Bar Area */}
                  {isDownloading && downloadProgress && (
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2.5 animate-pulse-subtle">
                      <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                        <span className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          Güncelleme Paketi İndiriliyor...
                        </span>
                        <span className="text-blue-700 text-sm font-extrabold">{downloadProgress.percent}%</span>
                      </div>

                      {/* Progress Bar Track */}
                      <div className="w-full bg-blue-200 h-3 rounded-full overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 h-full transition-all duration-300 rounded-full"
                          style={{ width: `${Math.max(3, downloadProgress.percent)}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-blue-700 font-medium">
                        <span>
                          {(downloadProgress.transferred / (1024 * 1024)).toFixed(1)} MB / {(downloadProgress.total / (1024 * 1024)).toFixed(1)} MB
                        </span>
                        {downloadProgress.speed > 0 && (
                          <span>{(downloadProgress.speed / (1024 * 1024)).toFixed(1)} MB/sn</span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Download Error */}
                  {downloadError && (
                    <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-2 flex-1">
                        <div>
                          <b className="text-amber-800">İndirme Uyarısı (Ağ / Güvenlik Sertifikası):</b>
                          <div className="text-amber-700 mt-0.5 font-mono text-[11px]">{downloadError}</div>
                          <p className="mt-1 text-slate-600 leading-relaxed">
                            Okul veya MEB ağlarında ara sertifika filtreleri nedeniyle uygulama içi indirme engellenebilir. Kurulum dosyasını doğrudan internet tarayıcınızdan indirebilirsiniz.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const url = updateInfo.setupAsset?.browser_download_url || updateInfo.downloadUrl;
                            if (window.electronAPI?.openExternal) {
                              window.electronAPI.openExternal(url);
                            } else {
                              window.open(url, '_blank');
                            }
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Tarayıcıda Doğrudan İndir (.exe)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Download Complete Success */}
                  {downloadedFilePath && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-xl flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <b className="text-sm font-bold block mb-1">Güncelleme İndirildi ve Kuruluma Hazır!</b>
                        <p className="text-emerald-800 leading-relaxed">
                          Yükleyiciyi başlatmak için aşağıdaki butona basınız. Mevcut tüm öğrenci ve disiplin verileriniz korunacaktır.
                        </p>
                        <p className="text-[11px] text-emerald-700/90 mt-1.5 bg-white/60 p-2 rounded-lg border border-emerald-200">
                          🛡️ <strong>Windows Uyarısı Çıkarsa:</strong> Windows ilk kurulumda mavi koruma ekranı çıkartırsa <strong>"Ek bilgi"</strong> linkine ve ardından <strong>"Yine de çalıştır"</strong> butonuna basabilirsiniz.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-6 text-slate-500 text-xs">
                  Sürüm kontrolü yapılamadı. İnternet bağlantınızı kontrol ediniz.
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 p-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                onClick={() => checkUpdates(true)}
                disabled={isChecking || isDownloading}
                className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                Yeniden Denetle
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Kapat
                </button>

                {updateInfo?.hasUpdate && !downloadedFilePath && !isDownloading && (
                  <button
                    onClick={handleStartDownload}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition-all"
                  >
                    <Download className="w-4 h-4" />
                    Güncellemeyi İndir
                  </button>
                )}

                {downloadedFilePath && (
                  <button
                    onClick={handleInstallNow}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md transition-all animate-pulse"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Şimdi Yeniden Başlat ve Yükle
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};

export default UpdateNotificationModal;
