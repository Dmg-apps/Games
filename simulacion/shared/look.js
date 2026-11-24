// Aspecto visual compartido: sombras, horizonte, vegetación, rocas y texturas más naturales.
// Todo pensado para no calentar el móvil:
// - Sombras reales: en "Ahorro" solo las proyectan los objetos fijos y el mapa se recalcula únicamente cuando algo cambia
//   (no en cada imagen); en "Alta" también los animales y se actualiza siempre.
// - Vegetación instanciada (una sola llamada de dibujo para cientos de árboles o matas).
import { THREE, mat, canvasTexture, RoundedBoxGeometry } from './engine3d.js';

const rnd = (a, b) => a + Math.random() * (b - a);
// Generador pseudoaleatorio con semilla (para que el paisaje no cambie al recargar)
export function seeded(seed = 1) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------- luz y sombras ----------
// Cuánto paisaje dibujar según la calidad
export const detail = (eng) => (eng.hq ? 1 : 0.4);
export function setupLook(eng, { cx = 0, cz = 0, size = 12, height = 24, fog = null, exposure = 1.08, sunColor = 0xffe9c8, hemiSky = 0xd6ecff, hemiGround = 0x7a6a50 } = {}) {
  const gl = eng.gl;
  gl.toneMappingExposure = exposure;
  eng.sun.color.set(sunColor); eng.hemi.color.set(hemiSky); eng.hemi.groundColor.set(hemiGround);
  // en Ahorro no hay mapa de sombras (cada objeto lleva su sombra suave pintada): es lo que más calienta
  gl.shadowMap.enabled = eng.hq; gl.shadowMap.type = THREE.PCFSoftShadowMap; gl.shadowMap.autoUpdate = true;
  const sun = eng.sun; sun.castShadow = eng.hq;
  sun.position.set(cx + size * 0.55, height, cz + size * 0.8); sun.target.position.set(cx, 0, cz); eng.scene.add(sun.target);
  const sc = sun.shadow; const ms = eng.hq ? 2048 : 1024; sc.mapSize.set(ms, ms);
  Object.assign(sc.camera, { left: -size, right: size, top: size, bottom: -size, near: 1, far: height * 3 }); sc.camera.updateProjectionMatrix();
  sc.bias = -0.0008; sc.normalBias = 0.03; sc.radius = 3;
  eng.shadowsDirty = () => { gl.shadowMap.needsUpdate = true; eng.dirty = true; };
  eng.shadowsDirty();
  if (fog) eng.scene.fog = new THREE.Fog(fog.color, fog.near, fog.far);
  vignette();
  return eng;
}
// Marca una jerarquía para proyectar/recibir sombras
export function shadows(obj, cast = true, receive = false) { obj.traverse((o) => { if (o.isMesh && !o.material?.transparent) { o.castShadow = cast; o.receiveShadow = receive; } }); return obj; }

// Oscurecido suave en los bordes de la pantalla (CSS, no cuesta nada a la gráfica)
function vignette() {
  if (document.querySelector('.vignette')) return;
  const v = document.createElement('div'); v.className = 'vignette'; document.querySelector('canvas.stage')?.after(v);
}

// ---------- texturas ----------
const texCache = {};
const once = (k, f) => texCache[k] || (texCache[k] = f());
// Ruido orgánico por capas sobre un color base
function speckle(x, s, base, cols, n, w = 1.5, h = 3) { x.fillStyle = base; x.fillRect(0, 0, s, s); for (let i = 0; i < n; i++) { x.fillStyle = cols[i % cols.length]; x.globalAlpha = 0.25 + Math.random() * 0.5; x.fillRect(Math.random() * s, Math.random() * s, w, h * (0.5 + Math.random())); } x.globalAlpha = 1; }
function blotches(x, s, cols, n, rMin, rMax, a = 0.18) { for (let i = 0; i < n; i++) { const r = rnd(rMin, rMax), px = Math.random() * s, py = Math.random() * s; const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, cols[i % cols.length]); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = a; x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); } x.globalAlpha = 1; }
export const grassTex = (repeat) => { const t = once('grass', () => canvasTexture(256, (x, s) => { speckle(x, s, '#6faa4e', ['#5b9a40', '#86c062', '#4f8a38', '#9acb6c', '#679f45'], 5200, 1.2, 4); blotches(x, s, ['#8fc466', '#4e8436', '#a8c870'], 26, 20, 60, 0.22); })); const c = t.clone(); c.needsUpdate = true; c.repeat.set(repeat, repeat); return c; };
export const pavingTex = (repeat = 1) => { const t = once('paving', () => canvasTexture(128, (x, s) => {
  x.fillStyle = '#b9ab90'; x.fillRect(0, 0, s, s); const n = 4, w = s / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const off = (j % 2) * w / 2; const px = (i * w + off) % s, py = j * w; const l = 205 + Math.random() * 25; x.fillStyle = `rgb(${l},${l - 12},${l - 34})`; x.fillRect(px + 2, py + 2, w - 4, w - 4); if (px + w > s) x.fillRect(px - s + 2, py + 2, w - 4, w - 4); }
  speckle(x, s, 'rgba(0,0,0,0)', ['#8a7a60', '#fff6e0'], 900, 1, 1);
})); const c = t.clone(); c.needsUpdate = true; c.repeat.set(repeat, repeat); return c; };
export const woodTex = (repeat = [1, 1], tone = ['#c9965f', '#b98550']) => { const c = canvasTexture(256, (x, s) => {
  const rows = 8, h = s / rows;
  for (let i = 0; i < rows; i++) { x.fillStyle = tone[i % 2]; x.fillRect(0, i * h, s, h); const off = Math.random() * s; x.strokeStyle = 'rgba(70,35,10,0.35)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(off, i * h); x.lineTo(off, (i + 1) * h); x.stroke();
    for (let k = 0; k < 7; k++) { x.strokeStyle = `rgba(90,50,20,${0.08 + Math.random() * 0.1})`; x.lineWidth = 1; x.beginPath(); const y = i * h + Math.random() * h; x.moveTo(0, y); for (let px = 0; px <= s; px += 16) x.lineTo(px, y + Math.sin(px * 0.05 + k) * 1.5); x.stroke(); } }
  x.fillStyle = 'rgba(40,20,5,0.45)'; for (let i = 0; i <= rows; i++) x.fillRect(0, i * h - 1, s, 2);
}, repeat); return c; };
export const tileTex = (repeat = [1, 1], base = '#e8eef0', line = '#cfd9dc') => canvasTexture(128, (x, s) => { x.fillStyle = base; x.fillRect(0, 0, s, s); speckle(x, s, 'rgba(0,0,0,0)', ['#ffffff', '#c8d2d6'], 500, 1, 1); x.strokeStyle = line; x.lineWidth = 2; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(0, i * s / 4); x.lineTo(s, i * s / 4); x.stroke(); x.beginPath(); x.moveTo(i * s / 4, 0); x.lineTo(i * s / 4, s); x.stroke(); } }, repeat);
export const waterTex = () => once('water', () => canvasTexture(128, (x, s) => { const g = x.createLinearGradient(0, 0, s, s); g.addColorStop(0, '#4f9fd0'); g.addColorStop(1, '#3a86bd'); x.fillStyle = g; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1.5; for (let i = 0; i < 40; i++) { const px = Math.random() * s, py = Math.random() * s; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 6, py - 3, px + 12, py); x.stroke(); } }, [2, 2]));

// ---------- geometría orgánica ----------
// Deforma una geometría con ruido suave para que no parezca de juguete
function jitter(geo, amt, seed = Math.random() * 100) {
  const p = geo.attributes.position, v = new THREE.Vector3(), map = new Map();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`; if (!map.has(k)) map.set(k, 1 + (Math.sin(v.x * 7.1 + seed) * Math.cos(v.z * 6.3 + seed) + Math.sin(v.y * 5.7 + seed * 2)) * amt); v.multiplyScalar(map.get(k)); p.setXYZ(i, v.x, v.y, v.z); }
  geo.computeVertexNormals(); return geo;
}
// Colores por vértice: más oscuro abajo y variación (da volumen sin luces extra)
function shade(geo, c1, c2, yMin, yMax) {
  const p = geo.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(c1), b = new THREE.Color(c2), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { const k = Math.min(1, Math.max(0, (p.getY(i) - yMin) / (yMax - yMin))); c.copy(a).lerp(b, k).multiplyScalar(0.92 + Math.random() * 0.16); col.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
}
const vcMat = new Map();
const vmat = (key = '') => vcMat.get(key) || (vcMat.set(key, new THREE.MeshLambertMaterial({ vertexColors: true })), vcMat.get(key));
const merge = (geos) => { // une geometrías sencillas (mismo tipo de atributos) en una
  const flat = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = flat.reduce((t, g) => t + g.attributes.position.count, 0); const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3); let o = 0;
  for (const g of flat) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('color', new THREE.BufferAttribute(col, 3)); return m;
};

// ---------- estilo "cubito" (diseño propio) ----------
// Cada juego puede elegir el estilo de la vegetación: 'organico' (por defecto) o 'cubito'
let STYLE = 'organico';
export function setStyle(st) { STYLE = st; }
// bloque redondeado ya colocado y girado (para unir en una sola geometría)
function rbox(w, h, d, x, y, z, ry = 0, r = 0.25) { const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * r); g.rotateY(ry); g.translate(x, y, z); return g; }
function cubeTreeGeometry(kind, seed) {
  const R = seeded(seed * 53 + 7), parts = [];
  if (kind === 'pino') {
    parts.push(shade(rbox(0.16, 0.5, 0.16, 0, 0.25, 0), '#4a2e1a', '#6a4426', 0, 0.5));
    for (let i = 0; i < 4; i++) { const w = 0.72 - i * 0.15; parts.push(shade(rbox(w, 0.36, w, 0, 0.62 + i * 0.32, 0, (i % 2) * 0.78 + R() * 0.2, 0.2), '#235e36', '#4a9a56', 0.45 + i * 0.32, 0.8 + i * 0.32)); }
  } else if (kind === 'palmera') {
    for (let i = 0; i < 6; i++) parts.push(shade(rbox(0.14 - i * 0.008, 0.28, 0.14 - i * 0.008, Math.pow(i / 6, 2) * 0.25, 0.14 + i * 0.27, 0, i * 0.3, 0.2), '#7a5a36', '#a07a4a', 0, 1.7));
    for (let i = 0; i < 7; i++) { const g = new RoundedBoxGeometry(0.85, 0.05, 0.2, 1, 0.02); g.translate(0.42, 0, 0); g.rotateZ(-0.35 - R() * 0.2); g.rotateY(i / 7 * Math.PI * 2 + R() * 0.3); g.translate(0.25, 1.68, 0); parts.push(shade(g, '#3e7a32', '#6aae4a', 1.4, 1.75)); }
    parts.push(shade(rbox(0.2, 0.14, 0.2, 0.25, 1.66, 0), '#5a4026', '#7a5a36', 1.6, 1.75));
  } else {
    const birch = kind === 'abedul';
    parts.push(shade(rbox(0.17, 0.85, 0.17, 0, 0.42, 0), birch ? '#cfc8b8' : '#4a2e1a', birch ? '#eeeae0' : '#6e4a2c', 0, 0.85));
    const c1 = birch ? '#5a9a3a' : '#2f6e30', c2 = birch ? '#9ccc5a' : '#6aae48';
    parts.push(shade(rbox(0.95, 0.68, 0.95, 0, 1.12, 0, R() * 0.6, 0.3), c1, c2, 0.8, 1.5));
    parts.push(shade(rbox(0.62, 0.46, 0.62, (R() - 0.5) * 0.2, 1.6, (R() - 0.5) * 0.2, R() * 1.5, 0.3), c1, c2, 1.35, 1.85));
    parts.push(shade(rbox(0.42, 0.36, 0.42, 0.34, 1.02, 0.18, R(), 0.3), c1, c2, 0.85, 1.25));
  }
  return merge(parts);
}
function cubeBushGeometry(size, seed, c1, c2) { const R = seeded(seed); const parts = []; for (let i = 0; i < 2; i++) { const w = size * (1.1 - i * 0.35); parts.push(shade(rbox(w, w * 0.8, w, (R() - 0.5) * size * 0.6, w * 0.4 + i * size * 0.35, (R() - 0.5) * size * 0.6, R() * 1.5, 0.32), c1, c2, 0, size * 1.3)); } return merge(parts); }

// Árbol con copa de varias masas, tronco que se estrecha y colores con volumen. kind: 'roble' | 'pino' | 'palmera' | 'abedul'
export function treeGeometry(kind = 'roble', seed = 1) {
  if (STYLE === 'cubito') return cubeTreeGeometry(kind, seed);
  const R = seeded(seed * 97 + 13), parts = [];
  if (kind === 'pino') {
    const tr = new THREE.CylinderGeometry(0.05, 0.09, 0.6, 6); tr.translate(0, 0.3, 0); parts.push(shade(tr, '#4a2e1a', '#6a4426', 0, 0.6));
    for (let i = 0; i < 4; i++) { const c = new THREE.ConeGeometry(0.55 - i * 0.11, 0.65, 8, 1); jitter(c, 0.05, seed + i); c.translate(0, 0.65 + i * 0.36, 0); parts.push(shade(c, '#1f5a34', '#3e8a4e', 0.3 + i * 0.36, 1 + i * 0.36)); }
  } else if (kind === 'palmera') {
    const tr = new THREE.CylinderGeometry(0.05, 0.08, 1.6, 6, 4); const p = tr.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 0.8; p.setX(i, p.getX(i) + Math.pow(y / 1.6, 2) * 0.25); } tr.computeVertexNormals(); tr.translate(0, 0.8, 0); parts.push(shade(tr, '#7a5a3a', '#a0805a', 0, 1.6));
    for (let i = 0; i < 7; i++) { const l = new THREE.ConeGeometry(0.12, 1.0, 4); l.scale(1, 1, 0.25); l.rotateZ(Math.PI / 2 + 0.5); l.translate(0.45, 0, 0); l.rotateY(i / 7 * Math.PI * 2 + R()); l.translate(0.25, 1.6, 0); parts.push(shade(l, '#3e7a32', '#6aae4a', 1.2, 1.8)); }
  } else {
    const birch = kind === 'abedul';
    const tr = new THREE.CylinderGeometry(0.06, 0.11, 0.85, 7); tr.translate(0, 0.42, 0); parts.push(shade(tr, birch ? '#cfc8b8' : '#4a2e1a', birch ? '#eeeae0' : '#6e4a2c', 0, 0.85));
    const blobs = 4 + Math.floor(R() * 3);
    for (let i = 0; i < blobs; i++) { const r = 0.32 + R() * 0.2; const s = new THREE.IcosahedronGeometry(r, 1); jitter(s, 0.08, seed + i); const a = R() * Math.PI * 2, d = i ? 0.18 + R() * 0.12 : 0; s.translate(Math.cos(a) * d, 1.0 + R() * 0.35 + (i ? 0 : 0.15), Math.sin(a) * d); parts.push(shade(s, birch ? '#5a8a34' : '#2f6e2e', birch ? '#a8cc5a' : '#76b04e', 0.7, 1.6)); }
  }
  return merge(parts);
}
const treeGeoCache = new Map();
export function tree(kind = 'roble', scale = 1, seed = 1) {
  const k = STYLE + kind + (seed % 4); if (!treeGeoCache.has(k)) treeGeoCache.set(k, treeGeometry(kind, seed % 4 + 1));
  const m = new THREE.Mesh(treeGeoCache.get(k), vmat()); m.scale.setScalar(scale); m.castShadow = true; return m;
}
export function rock(size = 0.3, color = '#8d8a84', seed = 1) {
  if (STYLE === 'cubito') { const R = seeded(seed * 11 + 3); const parts = [shade(rbox(size * 1.5, size * 0.9, size * 1.2, 0, 0, 0, R() * 1.5, 0.3), new THREE.Color(color).multiplyScalar(0.7).getStyle(), color, -size * 0.45, size * 0.45), shade(rbox(size * 0.8, size * 0.6, size * 0.7, size * 0.45, size * 0.3, size * 0.2, R() * 2, 0.3), new THREE.Color(color).multiplyScalar(0.8).getStyle(), new THREE.Color(color).multiplyScalar(1.1).getStyle(), 0, size * 0.6)];
    const m = new THREE.Mesh(merge(parts), vmat()); m.position.y = size * 0.42; m.castShadow = true; m.receiveShadow = true; return m; }
  const g = new THREE.DodecahedronGeometry(size, 1); jitter(g, 0.18, seed); g.scale(1, 0.65, 0.9); shade(g, new THREE.Color(color).multiplyScalar(0.7).getStyle(), color, -size * 0.6, size * 0.6);
  const m = new THREE.Mesh(g, vmat()); m.position.y = size * 0.3; m.castShadow = true; m.receiveShadow = true; return m;
}
export function bush(size = 0.35, seed = 1, c1 = '#2f6a2a', c2 = '#6aa848') {
  if (STYLE === 'cubito') { const m = new THREE.Mesh(cubeBushGeometry(size, seed, c1, c2), vmat()); m.castShadow = true; return m; }
  const parts = []; const R = seeded(seed);
  for (let i = 0; i < 3; i++) { const s = new THREE.IcosahedronGeometry(size * (0.6 + R() * 0.4), 1); jitter(s, 0.1, seed + i); s.translate((R() - 0.5) * size, size * 0.5, (R() - 0.5) * size); parts.push(shade(s, c1, c2, 0, size * 1.2)); }
  const m = new THREE.Mesh(merge(parts), vmat()); m.castShadow = true; return m;
}
// Seto: muchos arbustos en una sola llamada de dibujo
export function hedge(points, c1 = '#2c5e2a', c2 = '#5f9a44', size = 0.42) {
  const g = new THREE.Group();
  for (let v = 0; v < 3; v++) {
    const sub = points.filter((_, i) => i % 3 === v); if (!sub.length) continue;
    const parts = []; const R = seeded(v + 3);
    if (STYLE !== 'cubito') for (let i = 0; i < 3; i++) { const s = new THREE.IcosahedronGeometry(size * (0.6 + R() * 0.4), 1); jitter(s, 0.1, v * 5 + i); s.translate((R() - 0.5) * size, size * 0.5, (R() - 0.5) * size); parts.push(shade(s, c1, c2, 0, size * 1.2)); }
    const inst = new THREE.InstancedMesh(STYLE === 'cubito' ? cubeBushGeometry(size * 1.2, v + 3, c1, c2) : merge(parts), vmat(), sub.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
    sub.forEach(([x, z], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (x * 7 + z * 3) % 6.28); m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 1, 1)); inst.setMatrixAt(i, m4); });
    inst.castShadow = true; g.add(inst);
  }
  return g;
}
// Hierba: matas instanciadas (una sola llamada de dibujo)
export function grassTufts(points, { color1 = '#4e8a36', color2 = '#8cc462', size = 0.16 } = {}) {
  const blades = []; for (let i = 0; i < 5; i++) { const b = STYLE === 'cubito' ? new THREE.BoxGeometry(0.03, size * (0.8 + Math.random() * 0.6), 0.03) : new THREE.ConeGeometry(0.025, size * (0.8 + Math.random() * 0.6), 3); b.translate(0, size * 0.45, 0); b.rotateZ((Math.random() - 0.5) * 0.7); b.rotateY(i * 1.3); b.translate((Math.random() - 0.5) * 0.08, 0, (Math.random() - 0.5) * 0.08); blades.push(shade(b, color1, color2, 0, size)); }
  const geo = merge(blades); const inst = new THREE.InstancedMesh(geo, vmat(), Math.max(1, points.length)); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  points.forEach(([x, z], i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28); sc.setScalar(0.7 + Math.random() * 0.7); m4.compose(new THREE.Vector3(x, 0, z), q, sc); inst.setMatrixAt(i, m4); });
  inst.count = points.length; return inst;
}
// Muchos árboles iguales a la vez (paisaje de fondo)
export function forest(points, kind = 'roble') {
  const g = new THREE.Group(); const byKind = {};
  points.forEach((p, i) => { const k = p.kind || kind; (byKind[k] ||= []).push(p); });
  for (const [k, list] of Object.entries(byKind)) {
    for (let v = 0; v < 2; v++) {
      const sub = list.filter((_, i) => i % 2 === v); if (!sub.length) continue;
      const inst = new THREE.InstancedMesh(treeGeometry(k, v + 7), vmat(), sub.length); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
      sub.forEach((p, i) => { q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (p.r ?? Math.random()) * 6.28); const s = p.s || 1; m4.compose(new THREE.Vector3(p.x, 0, p.z), q, new THREE.Vector3(s, s, s)); inst.setMatrixAt(i, m4); });
      inst.castShadow = false; g.add(inst);
    }
  }
  return g;
}
// Suelo exterior que llega hasta el horizonte (se funde con la niebla)
export function horizonGround(cx, cz, color = '#6aa64a', radius = 140) {
  const g = new THREE.Mesh(new THREE.CircleGeometry(radius, 48), new THREE.MeshLambertMaterial({ map: grassTex(radius / 3), color }));
  g.rotation.x = -Math.PI / 2; g.position.set(cx, -0.02, cz); g.receiveShadow = true; return g;
}
export { mat };
