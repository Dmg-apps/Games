// Service worker de Simulación (generado por tools/build-sw.py). Guarda la app para jugar sin conexión.
const CACHE = 'simulacion-ed29e21fc4';
const FILES = ["./", "acuario/acuario.js", "acuario/data.js", "acuario/index.html", "hub.js", "icons/icon-192.png", "icons/icon.svg", "index.html", "manifest.webmanifest", "shared/assets.js", "shared/cloud-config.js", "shared/cloud.js", "shared/cloudui.js", "shared/engine3d.js", "shared/fonts/nunito.woff2", "shared/gestures.js", "shared/icons.js", "shared/look.js", "shared/models/animals/alpaca.glb", "shared/models/animals/bull.glb", "shared/models/animals/cow.glb", "shared/models/animals/deer.glb", "shared/models/animals/donkey.glb", "shared/models/animals/fox.glb", "shared/models/animals/horse.glb", "shared/models/animals/husky.glb", "shared/models/animals/shiba.glb", "shared/models/animals/stag.glb", "shared/models/animals/white_horse.glb", "shared/models/animals/wolf.glb", "shared/models/q/animals/bird.glb", "shared/models/q/animals/cat.glb", "shared/models/q/animals/chick.glb", "shared/models/q/animals/dog.glb", "shared/models/q/animals/eagle.glb", "shared/models/q/animals/llama.glb", "shared/models/q/animals/pig.glb", "shared/models/q/animals/pug.glb", "shared/models/q/animals/sheep.glb", "shared/models/q/nature/birchtree_1.glb", "shared/models/q/nature/birchtree_2.glb", "shared/models/q/nature/birchtree_3.glb", "shared/models/q/nature/bush_1.glb", "shared/models/q/nature/bush_2.glb", "shared/models/q/nature/bushberries_1.glb", "shared/models/q/nature/bushberries_2.glb", "shared/models/q/nature/commontree_1.glb", "shared/models/q/nature/commontree_2.glb", "shared/models/q/nature/commontree_3.glb", "shared/models/q/nature/commontree_4.glb", "shared/models/q/nature/commontree_5.glb", "shared/models/q/nature/flowers.glb", "shared/models/q/nature/grass.glb", "shared/models/q/nature/grass_2.glb", "shared/models/q/nature/grass_short.glb", "shared/models/q/nature/lilypad.glb", "shared/models/q/nature/pinetree_1.glb", "shared/models/q/nature/pinetree_2.glb", "shared/models/q/nature/pinetree_3.glb", "shared/models/q/nature/plant_1.glb", "shared/models/q/nature/plant_3.glb", "shared/models/q/nature/rock_1.glb", "shared/models/q/nature/rock_2.glb", "shared/models/q/nature/rock_3.glb", "shared/models/q/nature/rock_moss_1.glb", "shared/models/q/nature/rock_moss_2.glb", "shared/models/q/nature/treestump.glb", "shared/models/q/nature/willow_1.glb", "shared/models/q/nature/woodlog.glb", "shared/models/q/nature/woodlog_moss.glb", "shared/models/q/people/casual2_female.glb", "shared/models/q/people/casual2_male.glb", "shared/models/q/people/casual3_female.glb", "shared/models/q/people/casual3_male.glb", "shared/models/q/people/casual_female.glb", "shared/models/q/people/casual_male.glb", "shared/models/q/people/cowboy_male.glb", "shared/models/q/people/doctor_female_young.glb", "shared/models/q/people/doctor_male_young.glb", "shared/models/q/people/oldclassy_female.glb", "shared/models/q/people/oldclassy_male.glb", "shared/models/q/people/suit_female.glb", "shared/models/q/people/worker_female.glb", "shared/models/q/people/worker_male.glb", "shared/models/q/props/bag.glb", "shared/models/q/props/barrel.glb", "shared/models/q/props/bench_1.glb", "shared/models/q/props/cart.glb", "shared/models/q/props/crate.glb", "shared/models/q/props/fence.glb", "shared/models/q/props/gazebo.glb", "shared/models/q/props/hay.glb", "shared/models/q/props/light_floor1.glb", "shared/models/q/props/marketstand_1.glb", "shared/models/q/props/marketstand_2.glb", "shared/models/q/props/stable.glb", "shared/models/q/props/trashcan_green.glb", "shared/models/q/props/well.glb", "shared/sound.js", "shared/thumbs.js", "shared/ui.css", "shared/ui.js", "shared/vendor/BufferGeometryUtils.js", "shared/vendor/GLTFLoader.js", "shared/vendor/RoundedBoxGeometry.js", "shared/vendor/SkeletonUtils.js", "shared/vendor/meshopt_decoder.module.js", "shared/vendor/three.module.min.js", "vidas/icons/icon-192.png", "vidas/icons/icon.svg", "vidas/index.html", "vidas/js/cloud-config.js", "vidas/js/cloud.js", "vidas/js/data.js", "vidas/js/icons.js", "vidas/js/main.js", "vidas/js/notify.js", "vidas/js/render.js", "vidas/js/render3d.js", "vidas/js/sim.js", "vidas/js/ui.js", "vidas/styles.css", "zoo/animals3d.js", "zoo/cube3d.js", "zoo/data.js", "zoo/index.html", "zoo/props3d.js", "zoo/qmodels.js", "zoo/world3d.js", "zoo/zoo.css", "zoo/zoo.js"];
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
