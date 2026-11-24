// Service worker de Simulación (generado por tools/build-sw.py). Guarda la app para jugar sin conexión.
const CACHE = 'simulacion-e372f5aaad';
const FILES = ["./", "acuario/acuario.js", "acuario/data.js", "acuario/index.html", "hub.js", "icons/icon-192.png", "icons/icon.svg", "index.html", "manifest.webmanifest", "shared/cloud-config.js", "shared/cloud.js", "shared/cloudui.js", "shared/engine3d.js", "shared/fonts/nunito.woff2", "shared/gestures.js", "shared/icons.js", "shared/look.js", "shared/sound.js", "shared/thumbs.js", "shared/ui.css", "shared/ui.js", "shared/vendor/RoundedBoxGeometry.js", "shared/vendor/three.module.min.js", "vidas/icons/icon-192.png", "vidas/icons/icon.svg", "vidas/index.html", "vidas/js/cloud-config.js", "vidas/js/cloud.js", "vidas/js/data.js", "vidas/js/icons.js", "vidas/js/main.js", "vidas/js/notify.js", "vidas/js/render.js", "vidas/js/render3d.js", "vidas/js/sim.js", "vidas/js/ui.js", "vidas/styles.css", "zoo/animals3d.js", "zoo/data.js", "zoo/index.html", "zoo/props3d.js", "zoo/zoo.js"];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// Con conexión, siempre la versión de la red (y se guarda); sin conexión, la copia guardada.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => {
    if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
// Notificaciones push (Vidas)
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Simulación', body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Simulación', { body: d.body || '', tag: d.tag || 'sim', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: d.url || 'vidas/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if ('focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
