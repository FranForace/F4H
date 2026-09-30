// Service worker de F4H (spec mobile-pwa 1.4).
// estrategia: network-first — con señal siempre baja la versión nueva; sin señal usa la cacheada.
// Solo cachea el shell y SOLO del mismo origen: nunca toca Supabase, jsdelivr ni Google Fonts.
const CACHE = 'f4h-shell-v1';
const SHELL = ['/', '/F4H_Sistema_Beta_v6.html', '/js/db.js', '/logo-v2-trim.png',
  '/manifest.json', '/icons/icon-192.png', '/icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('/')))
  );
});
