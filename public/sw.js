/* E-Okul Disiplin AI Pro - Service Worker (PWA / çevrimdışı çalışma)
 * - Program kabuğu (index.php) ağ öncelikli; internet yoksa son kopya açılır.
 * - Derlenmiş dosyalar (assets/) önbellekten sunulur.
 * - Veri API'leri (api.php, sync-api.php) ASLA önbelleğe alınmaz.
 */
const BUILD = '__BUILD_ID__';
const SHELL_CACHE = 'disiplin-shell-' + BUILD;
const ASSET_CACHE = 'disiplin-assets';
const STATIC_FILES = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'favicon.ico'];
const NEVER_CACHE = /(?:^|\/)(api|sync-api|giris|cikis|migrate)\.php(?:$|\?)/;

const scopeUrl = new URL(self.registration.scope);
const shellUrl = new URL('./', scopeUrl).href;

const assetUrlsFromHtml = (html) => {
  const out = new Set();
  const re = /(?:src|href)="(\.?\/?assets\/[^"]+)"/g;
  let m;
  while ((m = re.exec(html))) out.add(new URL(m[1], scopeUrl).href);
  return [...out];
};

const cacheShell = async () => {
  try {
    const res = await fetch(shellUrl, { credentials: 'same-origin', cache: 'no-store', redirect: 'follow' });
    if (!res.ok || res.redirected || !(res.headers.get('content-type') || '').includes('text/html')) return;
    const html = await res.clone().text();
    if (!html.includes('__DISIPLIN_BRIDGE__')) return; // giriş sayfası vb. saklanmaz
    const shell = await caches.open(SHELL_CACHE);
    await shell.put(shellUrl, res);
    const assets = await caches.open(ASSET_CACHE);
    await Promise.all(assetUrlsFromHtml(html).map(async (u) => {
      if (await assets.match(u)) return;
      try { const r = await fetch(u, { credentials: 'same-origin' }); if (r.ok) await assets.put(u, r); } catch (e) { /* yoksay */ }
    }));
    // Eski sürüm dosyalarını temizle
    const keep = new Set(assetUrlsFromHtml(html));
    for (const req of await assets.keys()) {
      if (!keep.has(req.url)) await assets.delete(req);
    }
  } catch (e) { /* çevrimdışı kurulum */ }
};

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await Promise.all(STATIC_FILES.map(async (f) => {
      try { const r = await fetch(new URL(f, scopeUrl).href, { cache: 'no-store' }); if (r.ok) await shell.put(new URL(f, scopeUrl).href, r); } catch (e) { /* yoksay */ }
    }));
    await cacheShell();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith('disiplin-shell-') && name !== SHELL_CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== scopeUrl.origin || !url.href.startsWith(scopeUrl.href)) return; // site dışı / kapsam dışı
  const rel = url.href.slice(scopeUrl.href.length);
  if (NEVER_CACHE.test(rel)) return;

  // Sayfa açılışı (index.php): ağ öncelikli
  if (req.mode === 'navigate') {
    const isShell = rel === '' || rel.startsWith('?') || rel.startsWith('index.php') || rel.startsWith('index.html') || rel.startsWith('#');
    if (!isShell) return;
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic' && !res.redirected && (res.headers.get('content-type') || '').includes('text/html')) {
          const copy = res.clone();
          event.waitUntil((async () => {
            const html = await copy.clone().text();
            if (html.includes('__DISIPLIN_BRIDGE__')) {
              const shell = await caches.open(SHELL_CACHE);
              await shell.put(shellUrl, copy);
            }
          })());
        }
        return res;
      } catch (e) {
        const cached = await caches.match(shellUrl, { cacheName: SHELL_CACHE }) || await caches.match(shellUrl);
        if (cached) return cached;
        return new Response('<!DOCTYPE html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:24px">İnternet bağlantısı yok. Programı ilk kez açmak için internet gereklidir.</body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // Derlenmiş dosyalar: önbellek öncelikli
  if (rel.startsWith('assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(ASSET_CACHE);
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    })());
    return;
  }

  // Simgeler ve manifest: önbellekten hemen, arka planda tazele
  if (rel.startsWith('icons/') || rel === 'manifest.webmanifest' || rel === 'favicon.ico') {
    event.respondWith((async () => {
      const cached = await caches.match(req);
      const net = fetch(req).then(async (res) => {
        if (res.ok) (await caches.open(SHELL_CACHE)).put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || net;
    })());
  }
});
