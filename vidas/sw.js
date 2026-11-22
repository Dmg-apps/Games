// Service worker: guarda la app para que funcione sin conexión.
const CACHE = 'vidas-v6';
const FILES = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'js/main.js', 'js/sim.js', 'js/render.js', 'js/ui.js', 'js/data.js', 'js/icons.js', 'js/cloud.js', 'js/cloud-config.js', 'js/notify.js', 'fonts/nunito.woff2', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];
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
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(e.request, { ignoreSearch: true });
    const net = fetch(e.request).then((r) => { if (r.ok) cache.put(e.request, r.clone()); return r; });
    if (!cached) return net;
    const timeout = new Promise((res) => setTimeout(() => res(cached), 3000));
    return Promise.race([net.catch(() => cached), timeout]);
  })());
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
