#!/usr/bin/env python3
"""Genera simulacion/sw.js con la lista de archivos de la app (ejecutar al añadir o cambiar juegos)."""
import os, hashlib, json
ROOT = os.path.join(os.path.dirname(__file__), '..', 'simulacion')
files, h = [], hashlib.sha1()
for d, _, fs in os.walk(ROOT):
    for f in sorted(fs):
        p = os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, '/')
        if p == 'sw.js' or f.endswith('.txt') or '/icons/icon-512' in '/' + p: continue
        files.append(p)
        with open(os.path.join(d, f), 'rb') as fh: h.update(fh.read())
files.sort()
version = h.hexdigest()[:10]
sw = f"""// Service worker de Simulación (generado por tools/build-sw.py). Guarda la app para jugar sin conexión.
const CACHE = 'simulacion-{version}';
const FILES = {json.dumps(['./'] + files, ensure_ascii=False)};
self.addEventListener('install', (e) => {{ e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).catch(() => {{}})); self.skipWaiting(); }});
self.addEventListener('activate', (e) => {{
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
}});
// Con conexión, siempre la versión de la red (y se guarda); sin conexión, la copia guardada.
self.addEventListener('fetch', (e) => {{
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(fetch(e.request, {{ cache: 'no-cache' }}).then((r) => {{
    if (r.ok) {{ const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }}
    return r;
  }}).catch(() => caches.match(e.request, {{ ignoreSearch: true }})));
}});
// Notificaciones push (Vidas)
self.addEventListener('push', (e) => {{
  let d = {{}}; try {{ d = e.data ? e.data.json() : {{}}; }} catch {{ d = {{ title: 'Simulación', body: e.data && e.data.text() }}; }}
  e.waitUntil(self.registration.showNotification(d.title || 'Simulación', {{ body: d.body || '', tag: d.tag || 'sim', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: {{ url: d.url || 'vidas/' }} }}));
}});
self.addEventListener('notificationclick', (e) => {{
  e.notification.close();
  const url = e.notification.data?.url || './';
  e.waitUntil(self.clients.matchAll({{ type: 'window', includeUncontrolled: true }}).then((cs) => {{
    for (const c of cs) if ('focus' in c) return c.focus();
    return self.clients.openWindow(url);
  }}));
}});
"""
open(os.path.join(ROOT, 'sw.js'), 'w').write(sw)
print(f'sw.js: {len(files)} archivos, versión {version}')
