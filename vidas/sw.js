// Service worker: guarda la app para que funcione sin conexión.
const CACHE = 'vidas-v12';
const FILES = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/main.js', 'js/sim.js', 'js/render.js', 'js/ui.js', 'js/data.js', 'js/icons.js', 'js/cloud.js', 'js/cloud-config.js', 'js/notify.js', 'js/render3d.js', 'vendor/three.module.min.js', 'vendor/RoundedBoxGeometry.js', 'fonts/nunito.woff2', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Solo los archivos de la app (nunca las llamadas a la nube). Red primero para recibir
// actualizaciones; si no hay conexión o tarda más de 3 s, se usa la copia guardada.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Con conexión, siempre la versión de la red (y se guarda); sin conexión, la copia guardada.
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});

// Notificaciones push (enviadas por notifier/send.mjs)
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Vidas', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Vidas', { body: d.body || '', tag: d.tag || 'vidas', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: './' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ('focus' in c) return c.focus();
    return self.clients.openWindow('./');
  }));
});
