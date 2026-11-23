/**
 * PWA (telefona / bilgisayara uygulama olarak yükleme) desteği.
 * Service worker yalnızca web sürümünde (https) kaydedilir; masaüstü (Electron) uygulamasında kullanılmaz.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export const isStandalone = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

export const isIos = (): boolean =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);

export const canPromptInstall = () => deferredPrompt !== null;

export const promptInstall = async (): Promise<boolean> => {
  if (!deferredPrompt) return false;
  const ev = deferredPrompt;
  deferredPrompt = null;
  await ev.prompt();
  const choice = await ev.userChoice;
  window.dispatchEvent(new CustomEvent('pwa-install-changed'));
  return choice.outcome === 'accepted';
};

export const registerPwa = () => {
  if (typeof window === 'undefined') return;
  if (window.electronAPI) return; // masaüstü uygulaması
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  // Service worker yalnızca köprü (index.php) üzerinden açıldığında kaydedilir
  if (!window.__DISIPLIN_BRIDGE__) return;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent('pwa-install-changed'));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-install-changed'));
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {
      // Yeni sürüm yüklendiğinde bir sonraki açılışta etkinleşir; hemen etkinleştirmek için sayfayı yeniler
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            window.dispatchEvent(new CustomEvent('pwa-update-ready'));
          }
        });
      });
    }).catch(err => console.warn('Service worker kaydedilemedi:', err));
  });
};
