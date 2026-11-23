import React, { useEffect, useState } from 'react';
import { LogIn, RefreshCw, WifiOff, X } from 'lucide-react';
import { getBridge, saveNow } from '../services/bridge';

/**
 * evrakplus.com oturumu sona erdiğinde veya kayıt hatasında üstte görünen bilgilendirme şeridi.
 */
const BridgeBanner = () => {
  const bridge = getBridge();
  const [state, setState] = useState<{ status: string; error?: string } | null>(null);
  const [updateReady, setUpdateReady] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    const onStatus = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (!d.bridge) return;
      if (d.status === 'auth' || d.status === 'error' || d.status === 'offline') setState({ status: d.status, error: d.error });
      else if (d.status === 'synced') setState(null);
    };
    const onUpdate = () => setUpdateReady(true);
    window.addEventListener('cloud-sync-status', onStatus);
    window.addEventListener('pwa-update-ready', onUpdate);
    return () => {
      window.removeEventListener('cloud-sync-status', onStatus);
      window.removeEventListener('pwa-update-ready', onUpdate);
    };
  }, [bridge]);

  if (!bridge) return null;

  if (updateReady && !state) {
    return (
      <div className="fixed top-16 lg:top-3 left-1/2 -translate-x-1/2 z-[80] bg-blue-700 text-white text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-3 max-w-[94vw]">
        <span>Programın yeni sürümü hazır.</span>
        <button onClick={() => window.location.reload()} className="font-bold underline">Yenile</button>
        <button onClick={() => setUpdateReady(false)} className="opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  if (!state) return null;

  const isAuth = state.status === 'auth';
  const isOffline = state.status === 'offline';
  const loginHref = `${bridge.loginUrl}`;

  return (
    <div className={`fixed top-16 lg:top-3 left-1/2 -translate-x-1/2 z-[80] text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-3 max-w-[94vw] ${isAuth ? 'bg-red-700 text-white' : isOffline ? 'bg-slate-800 text-white' : 'bg-amber-600 text-white'}`}>
      {isOffline ? <WifiOff className="w-4 h-4 shrink-0" /> : isAuth ? <LogIn className="w-4 h-4 shrink-0" /> : <RefreshCw className="w-4 h-4 shrink-0" />}
      <span className="leading-snug">{state.error || (isAuth ? 'Oturumunuz sona erdi.' : 'Kayıt sunucuya gönderilemedi.')}</span>
      {isAuth ? (
        <a href={loginHref} className="font-bold underline whitespace-nowrap">Giriş yap</a>
      ) : !isOffline ? (
        <button onClick={() => saveNow()} className="font-bold underline whitespace-nowrap">Tekrar dene</button>
      ) : null}
      <button onClick={() => setState(null)} className="opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
    </div>
  );
};

export default BridgeBanner;
