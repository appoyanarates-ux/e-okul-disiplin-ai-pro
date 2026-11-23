import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { bridgeBoot, isBridgeMode } from './services/bridge';
import { registerPwa } from './services/pwa';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const renderApp = () => {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

registerPwa();

if (isBridgeMode()) {
  // evrakplus.com üyesinin verisini (disiplin_data) yükledikten sonra ekranı aç.
  // Sunucu yanıt vermezse en geç 12 sn sonra cihazdaki son veriyle açılır.
  rootElement.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f3f4f6;">
      <div style="text-align:center;color:#334155;">
        <div style="width:42px;height:42px;border:4px solid #cbd5e1;border-top-color:#2563eb;border-radius:50%;margin:0 auto 14px;animation:dspin 0.9s linear infinite"></div>
        <div style="font-weight:700;font-size:15px;">Verileriniz yükleniyor…</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">evrakplus.com hesabınızla eşitleniyor</div>
      </div>
      <style>@keyframes dspin{to{transform:rotate(360deg)}}</style>
    </div>`;
  let rendered = false;
  const go = () => {
    if (rendered) return;
    rendered = true;
    rootElement.innerHTML = '';
    renderApp();
  };
  const fallback = setTimeout(go, 12000);
  bridgeBoot().finally(() => {
    clearTimeout(fallback);
    go();
  });
} else {
  renderApp();
}
