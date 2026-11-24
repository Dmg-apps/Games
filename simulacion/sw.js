// Service worker de Simulación (generado por tools/build-sw.py). Guarda la app para jugar sin conexión.
const CACHE = 'simulacion-ab20f234b6';
const FILES = ["./", "acuario/acuario.js", "acuario/data.js", "acuario/index.html", "hub.js", "icons/icon-192.png", "icons/icon.svg", "index.html", "manifest.webmanifest", "shared/assets.js", "shared/cloud-config.js", "shared/cloud.js", "shared/cloudui.js", "shared/engine3d.js", "shared/fonts/nunito.woff2", "shared/gestures.js", "shared/icons.js", "shared/look.js", "shared/models/animals/alpaca.glb", "shared/models/animals/cow.glb", "shared/models/animals/donkey.glb", "shared/models/animals/fox.glb", "shared/models/animals/horse.glb", "shared/models/animals/stag.glb", "shared/models/animals/white_horse.glb", "shared/models/animals/wolf.glb", "shared/models/food/burger.glb", "shared/models/food/donut.glb", "shared/models/food/fries.glb", "shared/models/food/hot_dog.glb", "shared/models/food/ice_cream.glb", "shared/models/food/pizza.glb", "shared/models/nature/bush.glb", "shared/models/nature/bush_large.glb", "shared/models/nature/cactus.glb", "shared/models/nature/fence.glb", "shared/models/nature/flower_red.glb", "shared/models/nature/log.glb", "shared/models/nature/mushroom_red.glb", "shared/models/nature/rock_large.glb", "shared/models/nature/rock_small.glb", "shared/models/nature/rock_tall.glb", "shared/models/nature/stump.glb", "shared/models/nature/tree_autumn.glb", "shared/models/nature/tree_fat.glb", "shared/models/nature/tree_oak.glb", "shared/models/nature/tree_palm.glb", "shared/models/nature/tree_pine.glb", "shared/models/nature/tree_pine_tall.glb", "shared/models/people/mini_female_b.glb", "shared/models/people/mini_female_c.glb", "shared/models/people/mini_female_d.glb", "shared/models/people/mini_female_e.glb", "shared/models/people/mini_female_f.glb", "shared/models/people/mini_male_a.glb", "shared/models/people/mini_male_b.glb", "shared/models/people/mini_male_c.glb", "shared/models/people/mini_male_d.glb", "shared/models/people/mini_male_e.glb", "shared/models/people/mini_male_f.glb", "shared/sound.js", "shared/thumbs.js", "shared/ui.css", "shared/ui.js", "shared/vendor/BufferGeometryUtils.js", "shared/vendor/GLTFLoader.js", "shared/vendor/RoundedBoxGeometry.js", "shared/vendor/SkeletonUtils.js", "shared/vendor/meshopt_decoder.module.js", "shared/vendor/three.module.min.js", "vidas/icons/icon-192.png", "vidas/icons/icon.svg", "vidas/index.html", "vidas/js/cloud-config.js", "vidas/js/cloud.js", "vidas/js/data.js", "vidas/js/icons.js", "vidas/js/main.js", "vidas/js/notify.js", "vidas/js/render.js", "vidas/js/render3d.js", "vidas/js/sim.js", "vidas/js/ui.js", "vidas/styles.css", "zoo/animals3d.js", "zoo/data.js", "zoo/index.html", "zoo/props3d.js", "zoo/zoo.js"];
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
