// Miniaturas y vista previa 3D de objetos antes de comprarlos.
// Usa un renderizador pequeño aparte, que se libera al terminar (no se queda gastando batería).
import { THREE } from './engine3d.js';

function stage(bg) {
  const sc = new THREE.Scene(); if (bg) sc.background = new THREE.Color(bg);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8a7a60, 1.5));
  const d = new THREE.DirectionalLight(0xffffff, 1.9); d.position.set(3, 5, 4); sc.add(d);
  return sc;
}
function frame(cam, obj, k = 0.95) {
  const box = new THREE.Box3().setFromObject(obj); const c = box.getCenter(new THREE.Vector3()); const size = Math.max(0.2, box.getSize(new THREE.Vector3()).length());
  const dist = size / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))) * k;
  return { c, dist };
}
function renderer(cv) {
  const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; return r;
}

// Dibuja varias miniaturas de una vez. build(key) devuelve un objeto 3D. Guarda el resultado en cache.
const cache = new Map();
export function thumbs(ns, keys, build, { size = 128, bg = null, dir = [0.6, 0.5, 0.62], fit = 0.95 } = {}) {
  const out = {}; const todo = keys.filter((k) => { const c = cache.get(ns + ':' + k); if (c) out[k] = c; return !c; });
  if (!todo.length) return out;
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = size; const r = renderer(cv);
    const sc = stage(bg); const cam = new THREE.PerspectiveCamera(30, 1, 0.02, 60);
    for (const k of todo) {
      const g = build(k); sc.add(g); const { c, dist } = frame(cam, g, fit); const L = Math.hypot(...dir);
      cam.position.set(c.x + dist * dir[0] / L, c.y + dist * dir[1] / L, c.z + dist * dir[2] / L); cam.lookAt(c); r.render(sc, cam);
      out[k] = cv.toDataURL('image/png'); cache.set(ns + ':' + k, out[k]); sc.remove(g);
    }
    r.dispose(); r.forceContextLoss();
  } catch (e) { console.warn('Sin miniaturas', e); }
  return out;
}

// Vista previa que gira despacio dentro de un elemento. Devuelve { set(obj), stop() }.
export function preview(el, { bg = null, height = 170 } = {}) {
  const cv = document.createElement('canvas'); const w = Math.max(160, el.clientWidth || 280); const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = w * dpr; cv.height = height * dpr; cv.style.cssText = `width:100%;height:${height}px;display:block;border-radius:16px;touch-action:none`;
  el.appendChild(cv);
  let r; try { r = renderer(cv); } catch { cv.remove(); return { set() {}, stop() {} }; }
  const sc = stage(bg); const cam = new THREE.PerspectiveCamera(32, w / height, 0.02, 60); const pivot = new THREE.Group(); sc.add(pivot);
  let obj = null, view = null, yaw = 0.6, raf = 0, drag = null, alive = true;
  const draw = () => {
    if (!alive) return; if (!cv.isConnected || cv.offsetParent === null) return api.stop(); // se cerró la ventana
    if (drag == null) yaw += 0.008;
    if (view) { cam.position.set(view.c.x + Math.sin(yaw) * view.dist, view.c.y + view.dist * 0.45, view.c.z + Math.cos(yaw) * view.dist); cam.lookAt(view.c); }
    r.render(sc, cam); raf = requestAnimationFrame(draw);
  };
  cv.addEventListener('pointerdown', (e) => { drag = e.clientX; cv.setPointerCapture?.(e.pointerId); });
  cv.addEventListener('pointermove', (e) => { if (drag != null) { yaw -= (e.clientX - drag) * 0.012; drag = e.clientX; } });
  const end = () => (drag = null); cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  const api = {
    set(o) { if (obj) pivot.remove(obj); obj = o; pivot.add(o); view = frame(cam, o, 1.05); },
    stop() { if (!alive) return; alive = false; cancelAnimationFrame(raf); r.dispose(); r.forceContextLoss(); cv.remove(); },
  };
  requestAnimationFrame(draw); return api;
}
