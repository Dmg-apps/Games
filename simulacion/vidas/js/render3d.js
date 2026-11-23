// Renderizador 3D (Three.js). Misma interfaz que el isométrico 2D, así la simulación no cambia:
// resize(), fit(), render(state, view), screenToTile(), pickSim(), pickObject(), centerOn(), pan(), zoomAt(), rotate(),
// addHearts(), addMarker(), insetRight
import * as THREE from '../../shared/vendor/three.module.min.js';
import { RoundedBoxGeometry } from '../../shared/vendor/RoundedBoxGeometry.js';
import { OBJECTS, AGES, NEEDS, NEED_IC, NEED_COLOR, FLOOR_STYLES, SEASONS } from './data.js';
import { GRID, HOUSE, EXIT, footprint, visibleSims, hourOf, seasonOf, weatherOf } from './sim.js';
import { iconImage } from './icons.js';

const PX = 0.024;           // píxeles del catálogo → metros
const WALL_H = 2.5, WALL_T = 0.12;
const FONT = '"Nunito", ui-rounded, system-ui, sans-serif';
const TAU = Math.PI * 2;

// ---------- utilidades ----------
function rgba(c) {
  if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; }
  const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] ?? 1];
}
const hex = (c) => { const [r, g, b] = rgba(c); return new THREE.Color(`rgb(${r | 0},${g | 0},${b | 0})`); };
function shadeHex(c, f) { const [r, g, b] = rgba(c); const k = 1 - f; return `rgb(${r * k | 0},${g * k | 0},${b * k | 0})`; }
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const lerp = (a, b, t) => a + (b - a) * t;
function rotateBox(b, rot, w, h) {
  let [x, y, bw, bd, z, hh, c] = b; let H = h, W = w;
  for (let i = 0; i < rot; i++) { const nx = H - (y + bd), ny = x; x = nx; y = ny; [bw, bd] = [bd, bw]; [W, H] = [H, W]; }
  return [x, y, bw, bd, z, hh, c];
}
// Dirección "delantera" de cada mueble con rot 0, y cómo gira
const FRONT = { sofa: [0, 1], vater: [1, 0], ducha: [1, 1], cama: [1, 0], camita: [1, 0] };
function rotDir([dx, dy], rot) { for (let i = 0; i < rot; i++) [dx, dy] = [-dy, dx]; return [dx, dy]; }

const SKY = [[0, '#0f1630', '#23305a'], [5, '#1a2148', '#3b3f72'], [6.5, '#f2a98a', '#f6d3a8'], [8.5, '#7fc3ee', '#d6eef9'],
  [17.5, '#7fc3ee', '#d6eef9'], [19.5, '#e98a6a', '#f4c48f'], [21, '#2a2c5e', '#4d4277'], [24, '#0f1630', '#23305a']];
function skyAt(h) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, a0, b0] = SKY[i], [h1, a1, b1] = SKY[i + 1];
    if (h >= h0 && h <= h1) { const t = (h - h0) / (h1 - h0); return [new THREE.Color(a0).lerp(new THREE.Color(a1), t), new THREE.Color(b0).lerp(new THREE.Color(b1), t)]; }
  }
  return [new THREE.Color(SKY[0][1]), new THREE.Color(SKY[0][2])];
}
const nightAmount = (h) => (h < 5 ? 1 : h < 7.5 ? (7.5 - h) / 2.5 : h > 21 ? 1 : h > 18.5 ? (h - 18.5) / 2.5 : 0);

// ---------- texturas procedurales ----------
function canvasTex(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 2;
  return t;
}
function noise(ctx, s, alpha, n = 3000) {
  for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * alpha})`; ctx.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 2, 1 + Math.random() * 2); }
}
function floorTexture(F, w, h) {
  if (F.type === 'madera') return canvasTex(256, (ctx, s) => {
    const rows = 4;
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * s * 0.5;
      for (let k = -1; k < 2; k++) {
        const x0 = off + k * s; const tone = hash(r, k + 7);
        ctx.fillStyle = tone > 0.5 ? F.a : F.b; ctx.fillRect(x0, r * s / rows, s, s / rows);
        ctx.strokeStyle = 'rgba(60,30,10,0.12)'; ctx.lineWidth = 1;
        for (let g = 0; g < 6; g++) { ctx.beginPath(); const y = r * s / rows + 4 + g * 10; ctx.moveTo(x0, y); ctx.bezierCurveTo(x0 + s * 0.3, y + 3, x0 + s * 0.6, y - 3, x0 + s, y); ctx.stroke(); }
        ctx.fillStyle = 'rgba(40,20,5,0.35)'; ctx.fillRect(x0, r * s / rows, 2, s / rows);
      }
      ctx.fillStyle = 'rgba(40,20,5,0.35)'; ctx.fillRect(0, r * s / rows, s, 2);
    }
    noise(ctx, s, 0.05);
  }, [w / 2, h / 2]);
  if (F.type === 'baldosa') return canvasTex(256, (ctx, s) => {
    const n = 2, t = s / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = (i + j) % 2 ? F.a : F.b; ctx.fillRect(i * t, j * t, t, t); }
    ctx.strokeStyle = 'rgba(120,110,100,0.6)'; ctx.lineWidth = 3;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * t, 0); ctx.lineTo(i * t, s); ctx.moveTo(0, i * t); ctx.lineTo(s, i * t); ctx.stroke(); }
    noise(ctx, s, 0.04);
  }, [w / 2, h / 2]);
  return canvasTex(128, (ctx, s) => { ctx.fillStyle = F.a; ctx.fillRect(0, 0, s, s); noise(ctx, s, 0.1, 6000); }, [w, h]);
}
function wallTexture(color, pattern, len) {
  return canvasTex(256, (ctx, s) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, s, s);
    const ink = 'rgba(80,60,40,0.12)';
    if (pattern === 'rayas') { ctx.fillStyle = ink; for (let i = 0; i < 8; i++) ctx.fillRect(i * s / 8, 0, s / 32, s); }
    else if (pattern === 'topos') { ctx.fillStyle = 'rgba(80,60,40,0.16)'; for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { ctx.beginPath(); ctx.arc((i + (j % 2) * 0.5) * s / 6, j * s / 6 + 10, 4, 0, TAU); ctx.fill(); } }
    else if (pattern === 'rombos') { ctx.strokeStyle = ink; ctx.lineWidth = 2; for (let i = -1; i < 5; i++) for (let j = -1; j < 5; j++) { const x = i * s / 4, y = j * s / 4; ctx.beginPath(); ctx.moveTo(x, y + s / 8); ctx.lineTo(x + s / 8, y); ctx.lineTo(x + s / 4, y + s / 8); ctx.lineTo(x + s / 8, y + s / 4); ctx.closePath(); ctx.stroke(); } }
    noise(ctx, s, 0.025);
  }, [len / 1.5, WALL_H / 1.5]);
}
const grassTex = () => canvasTex(256, (ctx, s) => {
  ctx.fillStyle = '#7dbb5c'; ctx.fillRect(0, 0, s, s);
  for (let i = 0; i < 2500; i++) { ctx.strokeStyle = `rgba(${40 + Math.random() * 60},${110 + Math.random() * 70},${30 + Math.random() * 40},0.55)`; const x = Math.random() * s, y = Math.random() * s; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 3 - Math.random() * 4); ctx.stroke(); }
}, [3, 3]);
const dirtTex = () => canvasTex(128, (ctx, s) => {
  const g = ctx.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#9a6a42'); g.addColorStop(1, '#6e4528'); ctx.fillStyle = g; ctx.fillRect(0, 0, s, s); noise(ctx, s, 0.12, 2500);
  ctx.fillStyle = '#5f9e48'; ctx.fillRect(0, 0, s, s * 0.12);
}, [4, 1]);

// ---------- materiales ----------
// En modo ahorro se usa un material mucho más barato (Lambert) con casi el mismo aspecto
let LOW = false;
function std(p = {}) {
  if (!LOW) return new THREE.MeshStandardMaterial(p);
  const { roughness, metalness, ...r } = p; return new THREE.MeshLambertMaterial(r);
}
let blobTexture = null;
function blobTex() {
  if (blobTexture) return blobTexture;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, 'rgba(40,25,15,0.55)'); g.addColorStop(1, 'rgba(40,25,15,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); blobTexture = new THREE.CanvasTexture(c); return blobTexture;
}
const matCache = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (matCache.has(key)) return matCache.get(key);
  const [r, g, b, a] = rgba(color);
  const m = std({ color: new THREE.Color(`rgb(${r | 0},${g | 0},${b | 0})`), roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0, transparent: a < 1 || !!opts.opacity, opacity: opts.opacity ?? a });
  if (opts.emissive) m.emissive = new THREE.Color(opts.emissive);
  if (a < 1) m.depthWrite = false;
  matCache.set(key, m); return m;
}

// ---------- muebles ----------
let CUR_LEAVES = '#4ea04e';
function buildObject(o) {
  const def = OBJECTS[o.type]; const g = new THREE.Group(); g.userData.objId = o.id;
  const add = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData.objId = o.id; g.add(mesh); return mesh; };
  const f = footprint(o.type, o.rot);
  const cx = f.w / 2, cz = f.h / 2;
  if (LOW && !def.walkable) {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(f.w + 0.35, f.h + 0.35), new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.set(cx, 0.008, cz); g.add(sh);
  }
  if (o.type === 'arbol') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.1, 8), mat('#7a5232'))).position.set(cx, 0.55, cz);
    const lc = CUR_LEAVES; const leaf = mat(shadeHex(lc, 0.15), { rough: 0.9 }), leaf2 = mat(lc, { rough: 0.9 });
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.48, 1), leaf)).position.set(cx, 1.35, cz);
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.36, 1), leaf2)).position.set(cx + 0.18, 1.7, cz - 0.1);
    add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1), leaf2)).position.set(cx - 0.2, 1.6, cz + 0.15);
    return g;
  }
  if (o.type === 'planta') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.12, 0.35, 16), mat('#b0603a'))).position.set(cx, 0.175, cz);
    for (let i = 0; i < 7; i++) {
      const lf = add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat(i % 2 ? '#4a9a4a' : '#5ab05a', { rough: 0.9 })));
      const a = (i / 7) * TAU; lf.scale.set(1, 1.6, 0.5); lf.position.set(cx + Math.cos(a) * 0.12, 0.55 + (i % 3) * 0.08, cz + Math.sin(a) * 0.12); lf.rotation.set(Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    }
    return g;
  }
  if (o.type === 'lampara') {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 20), mat('#444', { metal: 0.5, rough: 0.4 }))).position.set(cx, 0.02, cz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1.35, 8), mat('#666', { metal: 0.6, rough: 0.35 }))).position.set(cx, 0.7, cz);
    const shade = add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.24, 0.32, 24, 1, true), std({ color: 0xf4e2a0, side: THREE.DoubleSide, roughness: 0.9, emissive: 0x000000 })));
    shade.position.set(cx, 1.45, cz); g.userData.shade = shade;
    return g;
  }
  const boxes = def.boxes.map((b) => rotateBox(b, o.rot, def.w, def.h));
  for (const b of boxes) {
    let col = b[6];
    if (o.tint && def.tint) { const ti = def.tint.indexOf(col); if (ti === 0) col = o.tint; else if (ti > 0) col = shadeHex(o.tint, 0.12 * ti); }
    const [x, y, w, d, z, hh] = b;
    const H = Math.max(0.01, hh * PX);
    const r = Math.min(0.04, w / 3, d / 3, H / 3);
    const geo = r > 0.006 ? new RoundedBoxGeometry(w, H, d, 2, r) : new THREE.BoxGeometry(w, H, d);
    const screen = col === '#1a1a22' || col === '#1e1e26';
    const m = screen ? std({ color: 0x15161c, roughness: 0.25, emissive: 0x000000 })
      : mat(col, { rough: col === '#e9eef2' || col === '#f4f6f8' || col === '#e6eaee' ? 0.3 : col.startsWith('rgba') ? 0.1 : 0.75 });
    const mesh = add(new THREE.Mesh(geo, m));
    mesh.position.set(x + w / 2, z * PX + H / 2, y + d / 2);
    if (screen) (g.userData.screens ||= []).push(mesh);
  }
  if (o.type === 'cocina') {
    const fl = add(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 12), new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.85 })));
    const p = rotateBox([0.2, 0.2, 0.25, 0.25, 36, 2], o.rot, 1, 1); fl.position.set(p[0] + p[2] / 2, 38 * PX + 0.06, p[1] + p[3] / 2); fl.visible = false; fl.castShadow = false; g.userData.flame = fl;
  }
  return g;
}

// ---------- personas ----------
const capsule = (r, len) => new THREE.CapsuleGeometry(r, len, 3, 8);
const BLOB_GEO = new THREE.CircleGeometry(0.3, 20);
const BLOB_MAT = new THREE.MeshBasicMaterial({ color: 0x2a1a10, transparent: true, opacity: 0.28, depthWrite: false });
class Person {
  constructor(sim) {
    this.id = sim.id; this.root = new THREE.Group(); this.root.userData.simId = sim.id; this.lookSig = '';
    this.m = { skin: std({ roughness: 0.6 }), shirt: std({ roughness: 0.85 }), pants: std({ roughness: 0.85 }),
      hair: std({ roughness: 0.55 }), iris: std({ roughness: 0.3 }), shoe: std({ color: 0x3b2b25, roughness: 0.6 }),
      white: std({ color: 0xffffff, roughness: 0.3 }), dark: std({ color: 0x1d1512, roughness: 0.4 }), lip: std({ color: 0xa0524a, roughness: 0.5 }) };
    const M = this.m; const cast = Person.castShadows; const mk = (geo, m, parent, x = 0, y = 0, z = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = cast; me.userData.simId = sim.id; parent.add(me); return me; };
    const R = this.root;
    // cadera
    this.hips = new THREE.Group(); this.hips.position.y = 0.92; R.add(this.hips);
    mk(new THREE.SphereGeometry(0.15, 16, 12), M.pants, this.hips, 0, 0.02, 0).scale.set(1.05, 0.7, 0.75);
    this.legs = [-1, 1].map((side) => {
      const hip = new THREE.Group(); hip.position.set(side * 0.085, 0, 0); this.hips.add(hip);
      mk(capsule(0.068, 0.32), M.pants, hip, 0, -0.22, 0);
      const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
      mk(capsule(0.056, 0.33), M.pants, knee, 0, -0.21, 0);
      const foot = mk(new RoundedBoxGeometry(0.1, 0.07, 0.22, 2, 0.03), M.shoe, knee, 0, -0.43, 0.04);
      return { hip, knee, foot };
    });
    this.skirt = mk(new THREE.CylinderGeometry(0.16, 0.3, 0.5, 20, 1, true), M.shirt, this.hips, 0, -0.2, 0); this.skirt.material = M.shirt;
    // tronco
    this.spine = new THREE.Group(); this.spine.position.y = 0.04; this.hips.add(this.spine);
    this.torso = mk(capsule(0.14, 0.3), M.shirt, this.spine, 0, 0.26, 0); this.torso.scale.set(1.2, 1, 0.78);
    this.belly = mk(new THREE.SphereGeometry(0.13, 14, 12), M.shirt, this.spine, 0, 0.16, 0.1); this.belly.visible = false;
    mk(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 10), M.skin, this.spine, 0, 0.52, 0);
    this.arms = [-1, 1].map((side) => {
      const sh = new THREE.Group(); sh.position.set(side * 0.2, 0.46, 0); this.spine.add(sh);
      mk(capsule(0.046, 0.22), M.shirt, sh, 0, -0.15, 0);
      const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
      mk(capsule(0.04, 0.2), M.skin, el, 0, -0.13, 0);
      const hand = new THREE.Group(); hand.position.y = -0.28; el.add(hand);
      mk(new THREE.SphereGeometry(0.045, 12, 10), M.skin, hand).scale.set(0.9, 1.2, 0.7);
      return { sh, el, hand };
    });
    // cabeza
    this.head = new THREE.Group(); this.head.position.y = 0.67; this.spine.add(this.head);
    this.skull = mk(new THREE.SphereGeometry(0.105, 24, 18), M.skin, this.head, 0, 0, 0); this.skull.scale.set(0.92, 1.12, 1);
    mk(new THREE.SphereGeometry(0.02, 8, 6), M.skin, this.head, 0, -0.01, 0.1);
    for (const side of [-1, 1]) mk(new THREE.SphereGeometry(0.022, 8, 6), M.skin, this.head, side * 0.097, 0, 0).scale.set(0.5, 1, 0.8);
    this.eyes = [-1, 1].map((side) => {
      const e = new THREE.Group(); e.position.set(side * 0.037, 0.02, 0.088); this.head.add(e);
      mk(new THREE.SphereGeometry(0.018, 12, 10), M.white, e).scale.set(1.15, 0.85, 0.6);
      mk(new THREE.SphereGeometry(0.0105, 10, 8), M.iris, e, 0, 0, 0.007);
      mk(new THREE.SphereGeometry(0.005, 8, 6), M.dark, e, 0, 0, 0.0145);
      const lid = mk(new THREE.SphereGeometry(0.0205, 12, 10), M.skin, e); lid.scale.set(1.2, 0.92, 0.66); lid.visible = false; e.userData.lid = lid;
      const brow = mk(new RoundedBoxGeometry(0.035, 0.007, 0.01, 1, 0.003), M.hair, this.head, side * 0.038, 0.05, 0.094); brow.rotation.z = side * -0.12;
      return e;
    });
    this.mouth = mk(new THREE.SphereGeometry(0.018, 12, 8), M.lip, this.head, 0, -0.05, 0.088); this.mouth.scale.set(1.1, 0.28, 0.4);
    this.hair = new THREE.Group(); this.head.add(this.hair);
    // objetos en la mano
    this.props = {};
    const prop = (name, geo, m, hand, x, y, z) => { const p = mk(geo, m, this.arms[hand].hand, x, y, z); p.visible = false; this.props[name] = p; return p; };
    prop('plate', new THREE.CylinderGeometry(0.11, 0.08, 0.02, 20), M.white, 0, 0, -0.04, 0.08);
    prop('pan', new THREE.CylinderGeometry(0.12, 0.1, 0.04, 20), std({ color: 0x2d2d33, metalness: 0.4, roughness: 0.4 }), 1, 0, -0.04, 0.2);
    prop('phone', new RoundedBoxGeometry(0.04, 0.13, 0.012, 2, 0.006), M.dark, 1, 0, 0.02, 0.03);
    prop('book', new RoundedBoxGeometry(0.2, 0.15, 0.03, 2, 0.006), std({ color: 0xc0504d }), 0, 0.09, 0, 0.05);
    prop('can', new THREE.CylinderGeometry(0.06, 0.07, 0.14, 14), std({ color: 0x4caf6a }), 1, 0, -0.06, 0.06);
    prop('bottle', new THREE.CylinderGeometry(0.025, 0.025, 0.11, 12), M.white, 1, 0, -0.03, 0.04);
    prop('slice', new THREE.ConeGeometry(0.06, 0.13, 3), std({ color: 0xf2c14e }), 1, 0, 0.04, 0.04);
    // manta (para dormir) y cristal de ducha
    this.blanket = mk(new RoundedBoxGeometry(0.66, 1.3, 0.28, 3, 0.1), std({ color: 0x7fa2df, roughness: 0.95 }), R, 0, 0.64, 0.05); this.blanket.visible = false;
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.34, 40), new THREE.MeshBasicMaterial({ color: 0x25c48f, transparent: true, opacity: 0.9, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.015; this.ring.visible = false; R.add(this.ring);
    this.blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT); this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.012; this.blob.visible = !cast; R.add(this.blob);
    this.yaw = 0; this.applyLook(sim);
  }
  applyLook(sim) {
    const L = sim.look; const sig = JSON.stringify(L) + sim.age;
    if (sig === this.lookSig) return; this.lookSig = sig;
    const M = this.m;
    M.skin.color.set(hex(L.skin)); M.shirt.color.set(hex(L.shirt)); M.pants.color.set(hex(L.pants)); M.hair.color.set(hex(L.hairColor)); M.iris.color.set(hex(L.eyeColor || '#4a2e1c'));
    this.lookSkirt = L.body === 'vestido'; this.skirt.visible = this.lookSkirt;
    for (const l of this.legs) l.hip.children[0].material = L.body === 'vestido' ? M.skin : M.pants;
    for (const l of this.legs) l.knee.children[0].material = L.body === 'vestido' ? M.skin : M.pants;
    const big = (L.eyes === 'grandes' ? 1.25 : L.eyes === 'almendrados' ? 0.9 : 1);
    for (const e of this.eyes) e.scale.set(big, L.eyes === 'almendrados' ? 0.75 : big, 1);
    // pelo
    this.hair.clear(); const hm = M.hair;
    const add = (geo, x, y, z, sx = 1, sy = 1, sz = 1) => { const me = new THREE.Mesh(geo, hm); me.position.set(x, y, z); me.scale.set(sx, sy, sz); me.castShadow = true; me.userData.simId = this.id; this.hair.add(me); return me; };
    if (L.hair !== 3) {
      add(new THREE.SphereGeometry(0.112, 24, 14, 0, TAU, 0, Math.PI * 0.55), 0, 0.012, -0.006, 0.95, 1.12, 1.04);
      add(new THREE.SphereGeometry(0.1, 16, 10, 0, TAU, Math.PI * 0.35, Math.PI * 0.45), 0, 0.01, -0.02, 0.97, 1.05, 0.95).rotation.x = -0.25;
    } else add(new THREE.SphereGeometry(0.107, 20, 12, 0, TAU, 0, Math.PI * 0.42), 0, 0.006, -0.004, 0.94, 1.12, 1.02);
    if (L.hair === 1) { add(new RoundedBoxGeometry(0.2, 0.26, 0.07, 3, 0.03), 0, -0.1, -0.07); add(new RoundedBoxGeometry(0.05, 0.2, 0.08, 2, 0.02), -0.095, -0.07, 0); add(new RoundedBoxGeometry(0.05, 0.2, 0.08, 2, 0.02), 0.095, -0.07, 0); }
    if (L.hair === 2) add(new THREE.SphereGeometry(0.055, 14, 10), 0, 0.09, -0.08);
    const scale = sim.age === 'nino' ? 0.68 : sim.age === 'anciano' ? 0.97 : sim.age === 'bebe' ? 0.32 : 1;
    this.root.scale.setScalar(scale);
    if (sim.age === 'nino') this.head.scale.setScalar(1.25); else this.head.scale.setScalar(sim.age === 'bebe' ? 1.6 : 1);
  }
  // Coloca las articulaciones según la postura
  pose(p, t, walking, s) {
    const L = this.legs, A = this.arms;
    for (const k of ['plate', 'pan', 'phone', 'book', 'can', 'bottle', 'slice']) this.props[k].visible = p.prop === k;
    this.blanket.visible = !!p.blanket;
    this.skirt.visible = this.lookSkirt && !p.blanket;
    this.hips.position.set(0, 0.92, 0); this.hips.rotation.set(0, 0, 0); this.spine.rotation.set(0, 0, 0); this.head.rotation.set(0, 0, 0);
    const set = (j, x = 0, z = 0) => j.rotation.set(x, 0, z);
    if (walking) {
      const w = Math.sin(t * 8);
      set(L[0].hip, w * 0.55); set(L[1].hip, -w * 0.55); set(L[0].knee, Math.max(0, -w) * 0.8); set(L[1].knee, Math.max(0, w) * 0.8);
      set(A[0].sh, -w * 0.45, -0.08); set(A[1].sh, w * 0.45, 0.08); set(A[0].el, -0.25); set(A[1].el, -0.25);
      this.hips.position.y = 0.92 + Math.abs(Math.cos(t * 8)) * 0.025; this.spine.rotation.x = 0.05;
    } else {
      set(L[0].hip); set(L[1].hip); set(L[0].knee); set(L[1].knee);
      const br = Math.sin(t * 2) * 0.02;
      set(A[0].sh, br, -0.1); set(A[1].sh, -br, 0.1); set(A[0].el, -0.12); set(A[1].el, -0.12);
      if (s.age === 'anciano') this.spine.rotation.x = 0.15;
    }
    if (p.sit) {
      this.hips.position.y = p.seat ?? 0.46; set(L[0].hip, -1.5, -0.05); set(L[1].hip, -1.5, 0.05); set(L[0].knee, 1.5); set(L[1].knee, 1.5);
      this.hips.position.z = -0.05;
    }
    if (p.arms) { const [l, r] = p.arms(t); set(A[0].sh, l[0], l[1] ?? -0.1); set(A[0].el, l[2] ?? -0.2); set(A[1].sh, r[0], r[1] ?? 0.1); set(A[1].el, r[2] ?? -0.2); }
    if (p.bounce) this.hips.position.y += Math.abs(Math.sin(t * 7)) * 0.06;
    if (p.sway) this.spine.rotation.z = Math.sin(t * 3.5) * 0.12;
    // cara
    const blink = (Math.floor(t * 10 + this.id.length * 7) % 40) === 0;
    for (const e of this.eyes) e.userData.lid.visible = !!(p.eyesClosed || s.sleeping || blink);
    const open = p.talk ? (Math.sin(t * 14) > 0 ? 1 : 0.3) : p.chew ? (Math.sin(t * 9) > 0.3 ? 0.7 : 0.25) : 0;
    this.mouth.scale.set(1.1, 0.28 + open * 0.6, 0.4);
    this.belly.visible = !!s.pregnant;
    // en la ducha se intuye la piel (sin ropa a la vista)
    const shower = p.id === 'ducha';
    this.torso.material = shower ? this.m.skin : this.m.shirt;
    for (const a of A) a.sh.children[0].material = shower ? this.m.skin : this.m.shirt;
  }
}

// ---------- posturas (igual que en 2D, en ángulos) ----------
function poseOf(state, s) {
  const c = s.cur; const P = { id: null };
  if (c?.kind === 'ko') return { id: 'lie', lie: 'floor', eyesClosed: true };
  if (!c || c.phase !== 'do') return P;
  if (c.kind === 'soc' || c.kind === 'partner') {
    const act = c.kind === 'soc' ? c.act : state.sims[c.leaderId]?.cur?.act;
    if (c.bedId) return { id: 'lie', lie: 'bed', blanket: true, eyesClosed: false };
    if (act === 'abrazar' || act === 'consolar' || act === 'acunar') return { id: 'hug', arms: () => [[-1.35, 0.3, -0.5], [-1.35, -0.3, -0.5]] };
    if (act === 'discutir') return { id: 'argue', talk: true, arms: (t) => [[-2.4 + Math.sin(t * 12) * 0.3, -0.2, -0.4], [-2.4 - Math.sin(t * 12) * 0.3, 0.2, -0.4]] };
    if (act === 'biberon') return { id: 'bottle', prop: 'bottle', arms: () => [[-0.9, 0.2, -1.2], [-1.0, -0.2, -1.1]] };
    if (act === 'besar') return { id: 'kiss', eyesClosed: true };
    return { id: 'talk', talk: true, arms: (t) => [[0, -0.1, -0.15], [-0.6 + Math.sin(t * 4) * 0.25, 0.2, -1.1]] };
  }
  switch (c.act) {
    case 'dormir': case 'siesta': return { id: 'lie', lie: 'bed', blanket: c.act === 'dormir' || OBJECTS[state.objects.find((o) => o.id === c.objId)?.type]?.acts.includes('dormir'), eyesClosed: true };
    case 'ducha': return { id: 'ducha', eyesClosed: true, arms: (t) => [[-2.7, -0.3, -1.5 + Math.sin(t * 6) * 0.2], [-2.7, 0.3, -1.5 - Math.sin(t * 6) * 0.2]] };
    case 'vater': return { id: 'vater', sit: true, seat: 0.5, arms: () => [[-0.35, -0.15, -0.9], [-0.35, 0.15, -0.9]] };
    case 'relajarse': return { id: 'sofa', sit: true, seat: 0.44, arms: () => [[-0.2, -0.25, -0.5], [-0.2, 0.25, -0.5]] };
    case 'picar': case 'pizza': case 'cocinar': {
      if (c.act === 'cocinar' && c.t < 30) return { id: 'cook', prop: 'pan', arms: (t) => [[-0.6, -0.1, -0.7], [-1.0 + Math.sin(t * 6) * 0.1, 0.05, -0.5]] };
      return { id: 'eat', prop: c.act === 'pizza' ? 'slice' : 'plate', chew: true, arms: (t) => { const up = (t * 1.1) % 1 < 0.45; return [[-0.9, -0.15, -1.1], up ? [-1.2, 0.35, -2.2] : [-0.8, 0.1, -1.2]]; } };
    }
    case 'jugarpc': case 'deberes': case 'buscartrabajo': case 'invitar': case 'adoptar': {
      const o = state.objects.find((q) => q.id === c.objId);
      if (o?.type === 'telefono' || c.act === 'invitar' || c.act === 'adoptar') return { id: 'phone', prop: 'phone', talk: true, arms: () => [[0, -0.1, -0.15], [-0.3, 0.6, -2.5]] };
      return { id: 'type', arms: (t) => [[-0.75, -0.1, -1.0 + Math.sin(t * 18) * 0.08], [-0.75, 0.1, -1.0 - Math.sin(t * 18) * 0.08]] };
    }
    case 'leer': return { id: 'read', prop: 'book', arms: () => [[-0.9, -0.25, -1.3], [-0.9, 0.25, -1.3]] };
    case 'tele': return { id: 'tv' };
    case 'bailar': return { id: 'dance', bounce: true, sway: true, arms: (t) => [[-2.6 + Math.sin(t * 7) * 0.6, -0.3, -0.5], [-2.6 - Math.sin(t * 7) * 0.6, 0.3, -0.5]] };
    case 'juguetes': return { id: 'toys', sit: true, seat: 0.15, bounce: true, arms: (t) => [[-0.8, -0.2, -0.6], [-1.2 + Math.sin(t * 6) * 0.4, 0.2, -0.6]] };
    case 'regar': return { id: 'water', prop: 'can', arms: () => [[0, -0.1, -0.15], [-1.1, 0.1, -0.3]] };
    default: return P;
  }
}

Person.castShadows = true;
export class Renderer3D {
  constructor(canvas, quality = 'alta') {
    Person.castShadows = quality === 'alta'; LOW = quality !== 'alta';
    this.c = canvas; this.hq = quality === 'alta'; this.wallsUp = localStorage.getItem('vidas_walls') === 'up';
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: this.hq ? 'high-performance' : 'low-power' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.hq ? 2 : 1.3));
    this.gl.shadowMap.enabled = this.hq; this.gl.shadowMap.type = this.hq ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    // en modo ahorro las sombras solo se recalculan cuando cambia algo
    this.gl.shadowMap.autoUpdate = this.hq; this.shadowT = 0;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping; this.gl.toneMappingExposure = 1.05;
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    this.cam = { target: new THREE.Vector3(5, 0, 5), yaw: Math.PI / 4, pitch: 0.82, dist: 22, tx: null, zoom: 1 };
    this.insetRight = 0; this.hearts = [];
    // capa 2D para burbujas, nombres y corazones
    this.ov = document.createElement('canvas'); this.ov.id = 'overlay';
    Object.assign(this.ov.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '1' });
    canvas.after(this.ov); this.ctx = this.ov.getContext('2d');
    // luces
    this.hemi = new THREE.HemisphereLight(0xdfefff, 0x8a7a60, 0.9); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 2.2); this.sun.castShadow = this.hq;
    const sc = this.sun.shadow; const ms = this.hq ? 2048 : 1024; sc.mapSize.set(ms, ms); sc.camera.left = -10; sc.camera.right = 10; sc.camera.top = 10; sc.camera.bottom = -10; sc.camera.near = 1; sc.camera.far = 60; sc.bias = -0.0006; sc.normalBias = 0.02;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.indoor = new THREE.PointLight(0xffc98a, 0, 14, 1.6); this.indoor.position.set(5, 2.2, 5); this.scene.add(this.indoor);
    // grupos
    this.world = new THREE.Group(); this.scene.add(this.world);
    this.objGroup = new THREE.Group(); this.scene.add(this.objGroup);
    this.simGroup = new THREE.Group(); this.scene.add(this.simGroup);
    this.fx = new THREE.Group(); this.scene.add(this.fx);
    this.objMeshes = new Map(); this.people = new Map();
    this.lampLights = Array.from({ length: this.hq ? 2 : 0 }, () => { const L = new THREE.PointLight(0xffb860, 0, 6, 1.8); this.scene.add(L); return L; });
    this.buildIsland();
    this.grid = new THREE.GridHelper(GRID, GRID, 0xffffff, 0xffffff); this.grid.position.set(GRID / 2, 0.025, GRID / 2); this.grid.material.transparent = true; this.grid.material.opacity = 0.35; this.grid.visible = false; this.scene.add(this.grid);
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.3, 32), new THREE.MeshBasicMaterial({ color: 0x25c48f, transparent: true, depthWrite: false })); this.marker.rotation.x = -Math.PI / 2; this.marker.visible = false; this.scene.add(this.marker);
    this.highlight = new THREE.Group(); this.scene.add(this.highlight);
    this.water = this.buildShowerFx(); this.scene.add(this.water);
    this.ray = new THREE.Raycaster();
    this.resize();
  }
  // ---------- escena fija ----------
  buildIsland() {
    const top = std({ map: grassTex(), roughness: 0.95 });
    const side = std({ map: dirtTex(), roughness: 1 });
    const isl = new THREE.Mesh(new THREE.BoxGeometry(GRID, 0.7, GRID), [side, side, top, side, side, side]);
    isl.position.set(GRID / 2, -0.35, GRID / 2); isl.receiveShadow = true; this.world.add(isl);
    this.island = isl;
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(GRID * 0.75, 48), new THREE.MeshBasicMaterial({ color: 0x14203c, transparent: true, opacity: 0.18, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(GRID / 2, -1.4, GRID / 2); this.world.add(shadow);
  }
  buildHouse(state) {
    const H = state.house || {}; const sig = JSON.stringify(H);
    if (sig === this.houseSig) return; this.houseSig = sig;
    if (this.house) { this.scene.remove(this.house); this.house.traverse((o) => o.geometry?.dispose()); }
    const g = new THREE.Group(); this.house = g; this.scene.add(g);
    const w = H.w || HOUSE, h = H.h || HOUSE; this.hw = w; this.hh = h;
    const F = FLOOR_STYLES.find((f) => f.id === H.floor) || FLOOR_STYLES[0];
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, h), std({ map: floorTexture(F, w, h), roughness: F.type === 'baldosa' ? 0.35 : 0.7 }));
    floor.position.set(w / 2, 0.025, h / 2); floor.receiveShadow = true; g.add(floor); this.floorMesh = floor;
    // camino de piedras hasta la salida
    const stone = mat('#d3cbbb', { rough: 0.9 });
    for (let x = w; x < GRID; x++) for (const dz of [0.28, 0.72]) {
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.04, 10), stone); st.position.set(x + 0.5 + (hash(x, dz) - 0.5) * 0.15, 0.02, EXIT.y + dz); st.receiveShadow = true; g.add(st);
    }
    // flores y matas del jardín
    const fl = ['#ff8fb1', '#ffd45c', '#ffffff', '#b99cff'], seed = H.seed || 0;
    for (let x = 0; x < GRID; x++) for (let z = 0; z < GRID; z++) {
      if ((x < w && z < h) || z === EXIT.y) continue;
      const n = hash(x + seed, z);
      if (n > 0.82) for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), mat(fl[(x * 7 + z) % 4])); f.position.set(x + 0.3 + i * 0.18, 0.09, z + 0.4 + (i % 2) * 0.2); g.add(f); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 4), mat('#4a8a3a')); st.position.set(f.position.x, 0.045, f.position.z); g.add(st); }
    }
    // paredes con ventanas de verdad
    const wall = H.wall || { color: '#f3e7d6', pattern: 'rayas' };
    const wins = H.windows || [{ axis: 'x', pos: 2.4 }, { axis: 'x', pos: 6.4 }, { axis: 'y', pos: 4 }];
    this.walls = [];
    const mkWall = (axis, len) => {
      const wg = new THREE.Group(); g.add(wg);
      const wm = std({ map: wallTexture(wall.color, wall.pattern, len), roughness: 0.9 });
      const outer = mat(shadeHex(wall.color, 0.18), { rough: 0.95 });
      const list = wins.filter((q) => q.axis === axis).map((q) => Math.min(Math.max(0.3, q.pos), len - 1.6)).sort((a, b) => a - b);
      const seg = (a, b, y0, y1) => {
        if (b - a < 0.01 || y1 - y0 < 0.01) return;
        const m = new THREE.Mesh(new THREE.BoxGeometry(b - a, y1 - y0, WALL_T), [outer, outer, outer, outer, wm, outer]);
        m.position.set((a + b) / 2, (y0 + y1) / 2, -WALL_T / 2); m.castShadow = true; m.receiveShadow = true; wg.add(m);
      };
      let cur = 0; const WW = 1.3, SILL = 0.85, TOP = 2.05;
      for (const p of list) {
        if (p < cur) continue;
        seg(cur, p, 0, WALL_H); seg(p, p + WW, 0, SILL); seg(p, p + WW, TOP, WALL_H);
        const glass = new THREE.Mesh(new THREE.BoxGeometry(WW, TOP - SILL, 0.02), std({ color: 0xbfe3f5, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.1, emissive: 0x000000 }));
        glass.position.set(p + WW / 2, (SILL + TOP) / 2, -WALL_T / 2); wg.add(glass); (this.glasses ||= []).push(glass);
        const frame = mat('#fffaf2', { rough: 0.5 });
        for (const [fw, fh, fx, fy] of [[WW, 0.05, p + WW / 2, SILL], [WW, 0.05, p + WW / 2, TOP], [0.05, TOP - SILL, p, (SILL + TOP) / 2], [0.05, TOP - SILL, p + WW, (SILL + TOP) / 2], [0.04, TOP - SILL, p + WW / 2, (SILL + TOP) / 2]]) {
          const fr = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, WALL_T + 0.02), frame); fr.position.set(fx, fy, -WALL_T / 2); fr.castShadow = true; wg.add(fr);
        }
        const sill = new THREE.Mesh(new THREE.BoxGeometry(WW + 0.15, 0.04, 0.16), frame); sill.position.set(p + WW / 2, SILL - 0.02, 0.02); wg.add(sill);
        cur = p + WW;
      }
      seg(cur, len, 0, WALL_H);
      const skirting = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.02), mat('#f7f1e8')); skirting.position.set(len / 2, 0.05, 0.01); wg.add(skirting);
      return wg;
    };
    this.glasses = [];
    const wx = mkWall('x', w); wx.userData.normal = new THREE.Vector3(0, 0, 1); this.walls.push(wx);
    const wz = mkWall('y', h); wz.rotation.y = Math.PI / 2; wz.scale.x = -1; wz.userData.normal = new THREE.Vector3(1, 0, 0); this.walls.push(wz);
    // las caras se invierten con escala negativa: lo corrige el material doble cara del interior
    wz.traverse((m) => { if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((mm) => (mm.side = THREE.DoubleSide)); });
    const post = new THREE.Mesh(new THREE.BoxGeometry(WALL_T, WALL_H, WALL_T), mat(shadeHex(wall.color, 0.18))); post.position.set(-WALL_T / 2, WALL_H / 2, -WALL_T / 2); post.castShadow = true; g.add(post);
    // cuadro
    if ((H.frame ?? true) && h >= 8 && !wins.some((q) => q.axis === 'y' && Math.abs(q.pos - (h - 2.4)) < 1.6)) {
      const fr = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.6, 0.85, 2, 0.01), mat('#8a5a3a')); fr.position.set(0.02, 1.55, h - 1.9); g.add(fr);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.48), std({ map: canvasTex(128, (ctx, s) => { const gr = ctx.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, '#f0c27a'); gr.addColorStop(1, '#f6dca8'); ctx.fillStyle = gr; ctx.fillRect(0, 0, s, s); ctx.fillStyle = '#6aa36a'; ctx.beginPath(); ctx.moveTo(0, s); ctx.lineTo(s * 0.4, s * 0.45); ctx.lineTo(s * 0.7, s * 0.7); ctx.lineTo(s, s * 0.4); ctx.lineTo(s, s); ctx.fill(); }) }));
      pic.rotation.y = Math.PI / 2; pic.position.set(0.045, 1.55, h - 1.9); g.add(pic);
    }
    // felpudo de la salida
    const mat1 = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.02, 0.6, 2, 0.01), mat('#b8664a', { rough: 1 })); mat1.position.set(EXIT.x + 0.5, 0.01, EXIT.y + 0.5); mat1.receiveShadow = true; g.add(mat1);
  }
  buildShowerFx() {
    const g = new THREE.Group(); g.visible = false;
    const drop = new THREE.MeshBasicMaterial({ color: 0xa8d8ff, transparent: true, opacity: 0.7 });
    g.userData.drops = [];
    for (let i = 0; i < 26; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 4), drop); d.userData.o = Math.random(); d.userData.x = (Math.random() - 0.5) * 0.4; d.userData.z = (Math.random() - 0.5) * 0.4; g.add(d); g.userData.drops.push(d); }
    const steamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25, depthWrite: false });
    g.userData.steam = [];
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), steamMat.clone()); s.userData.o = i / 8; g.add(s); g.userData.steam.push(s); }
    const frost = new THREE.Mesh(new THREE.BoxGeometry(0.92, 1.3, 0.92), std({ color: 0xe8f2fa, transparent: true, opacity: 0.82, roughness: 0.2, depthWrite: false }));
    frost.position.y = 0.7; g.add(frost); g.userData.frost = frost;
    return g;
  }

  // ---------- cámara ----------
  resize() {
    this.w = this.c.clientWidth || window.innerWidth; this.h = this.c.clientHeight || window.innerHeight;
    this.gl.setSize(this.w, this.h, false);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); this.dpr = dpr;
    this.ov.width = this.w * dpr; this.ov.height = this.h * dpr;
    this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
    if (!this.inited) { this.fit(); this.inited = true; }
  }
  fit() {
    const r = 7.2; const vf = THREE.MathUtils.degToRad(this.camera.fov) / 2; const hf = Math.atan(Math.tan(vf) * (this.w / this.h));
    this.cam.dist = Math.min(40, Math.max(9, r / Math.sin(Math.min(vf, hf)) * (this.w > this.h ? 0.78 : 0.66)));
  }
  centerOn(x, y, instant = false) {
    const t = new THREE.Vector3(x + 0.5, 0, y + 0.5);
    if (instant) { this.cam.target.copy(t); this.cam.tx = null; } else this.cam.tx = t;
  }
  pan(dx, dy) {
    this.cam.tx = null; const k = this.cam.dist * 0.0021;
    const yaw = this.cam.yaw; const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    this.cam.target.addScaledVector(right, -dx * k).addScaledVector(fwd, -dy * k * 1.4);
    this.cam.target.x = Math.max(-2, Math.min(GRID + 2, this.cam.target.x)); this.cam.target.z = Math.max(-2, Math.min(GRID + 2, this.cam.target.z));
  }
  zoomAt(f, sx, sy) {
    this.cam.tx = null; const old = this.cam.dist; this.cam.dist = Math.max(4, Math.min(42, this.cam.dist / f));
    if (sx != null) { const p = this.screenToWorld(sx, sy); if (p.x > -5) { const k = 1 - this.cam.dist / old; this.cam.target.x += (p.x - this.cam.target.x) * k; this.cam.target.z += (p.y - this.cam.target.z) * k; } }
  }
  tilt(d) { this.cam.pitch = Math.max(0.35, Math.min(1.35, this.cam.pitch + d)); }
  rotate(a) { this.cam.yaw += a; this.cam.yawT = null; }
  spin(a) { this.cam.yawT = (this.cam.yawT ?? this.cam.yaw) + a; }
  updateCamera() {
    if (this.cam.yawT != null) { this.cam.yaw += (this.cam.yawT - this.cam.yaw) * 0.14; if (Math.abs(this.cam.yawT - this.cam.yaw) < 0.002) { this.cam.yaw = this.cam.yawT; this.cam.yawT = null; } }
    if (this.cam.tx) { this.cam.target.lerp(this.cam.tx, 0.14); if (this.cam.target.distanceTo(this.cam.tx) < 0.01) this.cam.tx = null; }
    const { target, yaw, pitch, dist } = this.cam;
    this.camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    this.camera.lookAt(target);
    // centra la escena en el área libre (panel lateral en horizontal, barras en vertical)
    const landscape = this.w > this.h;
    const sx = landscape ? (90 + (this.insetRight || 0)) / 2 : 0, sy = landscape ? -10 : 40;
    this.camera.setViewOffset(this.w, this.h, sx, sy, this.w, this.h);
    this.cam.zoom = 22 / dist;
  }

  // ---------- selección ----------
  setRay(sx, sy) { this.ray.setFromCamera(new THREE.Vector2((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1), this.camera); }
  screenToTile(sx, sy) {
    this.setRay(sx, sy); const p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05), p)) return { x: -1, y: -1 };
    return { x: Math.floor(p.x), y: Math.floor(p.z) };
  }
  screenToWorld(sx, sy) {
    this.setRay(sx, sy); const p = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.05), p)) return { x: -1, y: -1 };
    return { x: p.x, y: p.z };
  }
  pickSim(state, sx, sy) {
    this.setRay(sx, sy);
    const hit = this.ray.intersectObjects(this.simGroup.children, true).find((h) => h.object.visible);
    if (hit) { let o = hit.object; while (o && !o.userData.simId) o = o.parent; if (o) return state.sims[o.userData.simId] || null; }
    // en pantallas pequeñas, también vale tocar cerca
    let best = null, bd = 26;
    for (const s of visibleSims(state)) {
      const pr = this.people.get(s.id); if (!pr) continue;
      const v = new THREE.Vector3(); pr.head.getWorldPosition(v); const q = this.project(v); const f = this.project(pr.root.position);
      const d = Math.min(Math.hypot(q.x - sx, q.y - sy), Math.hypot((q.x + f.x) / 2 - sx, (q.y + f.y) / 2 - sy));
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  pickPet(state, sx, sy) {
    let best = null, bd = 34;
    for (const p of state.pets || []) {
      const m = this.pets?.get(p.id); if (!m || !m.root.visible) continue;
      const q = this.project(m.root.position.clone().add(new THREE.Vector3(0, 0.25, 0)));
      const d = Math.hypot(q.x - sx, q.y - sy); if (d < bd) { bd = d; best = p; }
    }
    return best;
  }
  // Mascotas hechas con piezas simples, animadas al andar
  syncPets(state, t, dt) {
    this.pets ||= new Map(); const seen = new Set();
    for (const p of state.pets || []) {
      seen.add(p.id); let m = this.pets.get(p.id);
      if (!m) { m = buildPet(p); this.pets.set(p.id, m); this.scene.add(m.root); }
      const vis = !p.out; m.root.visible = vis; if (!vis) continue;
      const walking = p.path?.length > 0;
      m.root.position.set(p.x + 0.5, 0.05, p.y + 0.5);
      if (walking) { const n = p.path[0]; const yaw = Math.atan2(n.x - p.x, n.y - p.y); let d = yaw - m.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); m.yaw += d * Math.min(1, dt * 10); }
      m.root.rotation.y = m.yaw;
      const w = walking ? Math.sin(t * 12) : 0;
      m.legs.forEach((l, i) => (l.rotation.x = (i % 2 ? w : -w) * 0.6));
      m.tail.rotation.x = -0.6 + (p.sleeping ? 0 : Math.sin(t * (walking ? 10 : 4)) * 0.4);
      m.body.position.y = p.sleeping ? 0.14 : 0.3 + Math.abs(w) * 0.02;
      m.head.position.y = p.sleeping ? 0.18 : 0.42; m.legs.forEach((l) => (l.visible = !p.sleeping));
    }
    for (const [id, m] of this.pets) if (!seen.has(id)) { this.scene.remove(m.root); this.pets.delete(id); }
  }
  // Estación (color del césped y de los árboles) y lluvia o nieve
  season(state) {
    const S = seasonOf(state); const w = weatherOf(state).type;
    if (S.id !== this.seasonId) { this.seasonId = S.id; CUR_LEAVES = S.leaves; this.island.material[2].color.set(new THREE.Color(S.grass).lerp(new THREE.Color(0xffffff), 0.35)); }
    this.weatherType = w;
    this.weatherDim = w === 'lluvia' || w === 'nieve' ? 0.65 : w === 'nubes' ? 0.82 : 1;
  }
  pickObject(state, sx, sy) {
    this.setRay(sx, sy);
    const hits = this.ray.intersectObjects(this.objGroup.children, true);
    for (const h of hits) { let o = h.object; while (o && !o.userData.objId) o = o.parent; const obj = o && state.objects.find((q) => q.id === o.userData.objId); if (obj && !OBJECTS[obj.type].walkable) return obj; }
    return null;
  }
  project(v) { const p = v.clone().project(this.camera); return { x: (p.x + 1) / 2 * this.w, y: (-p.y + 1) / 2 * this.h, z: p.z }; }
  addMarker(x, y) { this.markerT = performance.now(); this.marker.position.set(x + 0.5, 0.06, y + 0.5); this.marker.visible = true; }
  addHearts(x, y) { for (let i = 0; i < 7; i++) this.hearts.push({ x: x + 0.5, y: y + 0.5, t: -i * 0.12, dx: (Math.random() - 0.5) * 34, s: 0.7 + Math.random() * 0.5 }); }

  // ---------- sincronizar con el estado ----------
  syncObjects(state, view) {
    const seen = new Set();
    for (const o of state.objects) {
      seen.add(o.id);
      const key = `${o.type}|${o.x}|${o.y}|${o.rot}|${o.tint || ''}|${o.type === 'arbol' ? CUR_LEAVES : ''}`;
      let rec = this.objMeshes.get(o.id);
      if (!rec || rec.key !== key) {
        if (rec) this.objGroup.remove(rec.g);
        const g = buildObject(o); g.position.set(o.x, 0.05, o.y); this.objGroup.add(g);
        rec = { g, key }; this.objMeshes.set(o.id, rec);
      }
    }
    for (const [id, rec] of this.objMeshes) if (!seen.has(id)) { this.objGroup.remove(rec.g); this.objMeshes.delete(id); }
    this.objKeySig = [...this.objMeshes.values()].map((r) => r.key).join(';');
    // fantasma y resaltado en construcción
    const hkey = JSON.stringify([view.selected, view.ghost, view.wallPreview, view.wallHover]);
    for (const [id, rec] of this.objMeshes) if (!view.ghost || view.ghost.objId !== id) rec.g.visible = true;
    if (view.ghost?.objId) { const rec = this.objMeshes.get(view.ghost.objId); if (rec) rec.g.visible = false; }
    this.grid.visible = !!view.build;
    if (hkey === this.hkey) return; this.hkey = hkey;
    this.highlight.traverse((m) => { if (m.geometry && m !== this.highlight) m.geometry.dispose(); });
    this.highlight.clear();
    const tiles = (x, y, w, h, color, op) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.06), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x + w / 2, 0.06, y + h / 2); this.highlight.add(m);
    };
    if (view.selected) { const o = state.objects.find((q) => q.id === view.selected); if (o) { const f = footprint(o.type, o.rot); tiles(o.x, o.y, f.w, f.h, 0xffd65a, 0.6); } }
    for (const q of view.wallPreview || []) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(q.d === 'h' ? 1 : WALL_T, WALL_H * 0.6, q.d === 'h' ? WALL_T : 1), new THREE.MeshBasicMaterial({ color: q.bad ? 0xf05050 : 0x46d28c, transparent: true, opacity: 0.55, depthWrite: false }));
      m.position.set(q.d === 'h' ? q.x + 0.5 : q.x, WALL_H * 0.3, q.d === 'h' ? q.y : q.y + 0.5); this.highlight.add(m);
    }
    if (view.wallHover) {
      const q = view.wallHover; const m = new THREE.Mesh(new THREE.BoxGeometry(q.d === 'h' ? 1.02 : WALL_T + 0.06, 0.08, q.d === 'h' ? WALL_T + 0.06 : 1.02), new THREE.MeshBasicMaterial({ color: 0xffd65a }));
      m.position.set(q.d === 'h' ? q.x + 0.5 : q.x, 0.1, q.d === 'h' ? q.y : q.y + 0.5); this.highlight.add(m);
    }
    if (view.ghost) {
      const gh = view.ghost, f = footprint(gh.type, gh.rot);
      tiles(gh.x, gh.y, f.w, f.h, gh.ok ? 0x46d28c : 0xf05050, 0.5);
      const g = buildObject({ ...gh, id: 'ghost', users: [] }); g.position.set(gh.x, 0.06, gh.y);
      g.traverse((m) => { if (m.material) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.65; m.castShadow = false; } });
      this.highlight.add(g);
      if (gh.objId) { const rec = this.objMeshes.get(gh.objId); if (rec) rec.g.visible = false; }
    }
    for (const [id, rec] of this.objMeshes) if (!view.ghost || view.ghost.objId !== id) rec.g.visible = true;
    this.grid.visible = !!view.build;
  }
  syncPeople(state, view, t, dt) {
    const vis = new Set(visibleSims(state).map((s) => s.id));
    for (const [id, p] of this.people) if (!vis.has(id) || !state.sims[id]) { this.simGroup.remove(p.root); this.people.delete(id); }
    let showerAt = null;
    for (const s of visibleSims(state)) {
      let p = this.people.get(s.id);
      if (!p) { p = new Person(s); this.people.set(s.id, p); this.simGroup.add(p.root); }
      p.applyLook(s);
      const walking = s.path && s.path.length > 0;
      const pose = s.age === 'bebe' ? { id: 'lie', lie: s.cribId ? 'crib' : 'floor', eyesClosed: s.sleeping } : poseOf(state, s);
      p.pose(pose, t, walking, s);
      // posición y orientación
      const R = p.root; R.rotation.order = 'YXZ';
      let x = s.x + 0.5, z = s.y + 0.5, y = 0.05, yaw = null, lie = 0;
      const c = s.cur; const obj = c && (c.objId || c.bedId) ? state.objects.find((o) => o.id === (c.bedId || c.objId)) : null;
      if (pose.lie === 'bed' && obj) {
        const f = footprint(obj.type, obj.rot); const [dx, dy] = rotDir(FRONT[obj.type] || [1, 0], obj.rot);
        const cx = obj.x + f.w / 2, cz = obj.y + f.h / 2; const idx = Math.max(0, obj.users.indexOf(s.id)); const n = obj.users.length;
        const perp = [-dy, dx]; const off = n > 1 ? (idx ? 0.2 : -0.2) : 0;
        x = cx - dx * 0.82 + perp[0] * off; z = cz - dy * 0.82 + perp[1] * off; y = (obj.type === 'sofa' ? 0.5 : 0.74) * (s.age === 'nino' ? 0.85 : 1); yaw = Math.atan2(-dx, -dy); lie = 1;
        p.blanket.material.color.set(hex(obj.tint || OBJECTS[obj.type].tint?.[0] || '#7fa2df'));
      } else if (pose.lie === 'floor') { lie = 1; y = 0.08; yaw = p.yaw; }
      else if (pose.lie === 'crib' && obj === null) { const cr = state.objects.find((o) => o.id === s.cribId); if (cr) { x = cr.x + 0.5; z = cr.y + 0.65; y = 0.3; } lie = 1; yaw = Math.PI; }
      else if (c?.onObj && c.phase === 'do' && obj) {
        const [dx, dy] = rotDir(FRONT[obj.type] || [0, 1], obj.rot); yaw = Math.atan2(dx, dy);
        const f = footprint(obj.type, obj.rot); const idx = Math.max(0, obj.users.indexOf(s.id));
        if (obj.type === 'sofa') { const perp = [-dy, dx]; const off = obj.users.length > 1 ? (idx ? 0.45 : -0.45) : 0; x = obj.x + f.w / 2 + perp[0] * off - dx * 0.12; z = obj.y + f.h / 2 + perp[1] * off - dy * 0.12; }
        else { x = obj.x + 0.5 - dx * 0.1; z = obj.y + 0.5 - dy * 0.1; }
        if (obj.type === 'ducha') { showerAt = { x: obj.x + 0.5, z: obj.y + 0.5 }; yaw = Math.PI / 4; }
      }
      if (s.age === 'bebe' && s.cribId) { const cr = state.objects.find((o) => o.id === s.cribId); if (cr) { x = cr.x + 0.5; z = cr.y + 0.75; y = 0.32; lie = 1; yaw = Math.PI; } }
      if (yaw === null) {
        let tx = null, tz = null;
        if (walking) { tx = s.path[0].x + 0.5; tz = s.path[0].y + 0.5; }
        else if (c && c.phase === 'do') {
          if (c.kind === 'obj' && obj) { const f = footprint(obj.type, obj.rot); tx = obj.x + f.w / 2; tz = obj.y + f.h / 2; }
          if (c.kind === 'soc' || c.kind === 'partner') { const o2 = state.sims[c.kind === 'soc' ? c.targetId : c.leaderId]; if (o2) { tx = o2.x + 0.5; tz = o2.y + 0.5; } }
        }
        if (tx !== null && Math.hypot(tx - x, tz - z) > 0.05) yaw = Math.atan2(tx - x, tz - z);
      }
      if (yaw !== null) { let d = yaw - p.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); p.yaw += d * Math.min(1, dt * (lie ? 30 : 10)); }
      R.position.set(x, y, z); R.rotation.set(lie ? -Math.PI / 2 : 0, p.yaw, 0);
      p.ring.visible = view.active === s.id && !lie; p.blob.visible = !Person.castShadows && !lie;
      if (p.ring.visible) { const k = 1 + Math.sin(t * 4) * 0.06; p.ring.scale.set(k, k, 1); }
    }
    // efectos de ducha
    this.water.visible = !!showerAt;
    if (showerAt) {
      this.water.position.set(showerAt.x, 0.05, showerAt.z);
      for (const d of this.water.userData.drops) { const k = (t * 1.6 + d.userData.o) % 1; d.position.set(d.userData.x, 2.0 - k * 1.9, d.userData.z); }
      for (const s of this.water.userData.steam) { const k = (t * 0.3 + s.userData.o) % 1; s.position.set(Math.sin(s.userData.o * 9 + k * 3) * 0.25, 0.9 + k * 1.3, Math.cos(s.userData.o * 7) * 0.2); s.scale.setScalar(0.6 + k * 1.4); s.material.opacity = 0.28 * Math.sin(k * Math.PI); }
    }
  }
  lighting(state, t) {
    const h = hourOf(state.time); const night = nightAmount(h); this.night = night;
    const [top, bot] = skyAt(h);
    const css = `linear-gradient(180deg, #${top.getHexString()} 0%, #${bot.getHexString()} 100%)`;
    if (css !== this.bg) { this.bg = css; document.body.style.background = css; }
    const a = ((h - 6) / 13) * Math.PI; const up = Math.max(0, Math.sin(a));
    this.sun.position.set(6 + Math.cos(a) * 14, 2 + up * 16, 6 + 10); this.sun.target.position.set(6, 0, 6);
    this.sun.intensity = (0.15 + up * 2.3 * (1 - night)) * (this.weatherDim || 1);
    this.sun.color.setHSL(0.09, 0.6 + (1 - up) * 0.3, 0.75 + up * 0.15);
    this.hemi.intensity = 0.5 + 0.5 * (1 - night);
    this.hemi.color.set(night > 0.5 ? 0x8090c0 : 0xdfefff);
    const on = !state.powerOff;
    this.indoor.intensity = on ? night * 12 : 0; this.indoor.position.set((this.hw || 10) / 2, 2.2, (this.hh || 10) / 2);
    for (const gl of this.glasses || []) { gl.material.emissive.setHex(night > 0.4 && on ? 0xffc070 : 0x000000); gl.material.emissiveIntensity = 0.7; gl.material.opacity = night > 0.4 ? 0.7 : 0.35; }
    // lámparas, pantallas y fuego
    let li = 0;
    for (const o of state.objects) {
      const rec = this.objMeshes.get(o.id); if (!rec) continue;
      const using = o.users.some((u) => state.sims[u]?.cur?.phase === 'do');
      if (rec.g.userData.shade) {
        rec.g.userData.shade.material.emissive.setHex(night > 0.3 && on ? 0xffb860 : 0x000000);
        if (night > 0.3 && on && li < this.lampLights.length) {
          const L = this.lampLights[li]; L.position.set(o.x + 0.5, 1.45, o.y + 0.5); L.intensity = 3 * night; li++;
        }
      }
      for (const sc of rec.g.userData.screens || []) {
        const lit = using && on && OBJECTS[o.type].power;
        sc.material.emissive.setHex(lit ? [0x5aa8e8, 0x7dd3a8, 0xe8a85a, 0xa87de8][Math.floor(t / 0.7 + o.x) % 4] : 0x000000); sc.material.emissiveIntensity = lit ? 0.9 : 0;
      }
      if (rec.g.userData.flame) { rec.g.userData.flame.visible = using && on; rec.g.userData.flame.scale.y = 1 + Math.sin(t * 25) * 0.2; }
    }
    for (let i = li; i < this.lampLights.length; i++) this.lampLights[i].intensity = 0;
  }
  cutaway() {
    // paredes de espaldas a la cámara: se bajan para ver el interior
    const dir = new THREE.Vector3().subVectors(this.camera.position, this.cam.target).setY(0).normalize();
    for (const w of this.walls || []) { const facing = dir.dot(w.userData.normal) > -0.15; w.scale.y = facing ? 1 : 0.08; }
  }
  // Paredes construidas (exteriores e interiores) con sus puertas
  buildWalls(state) {
    const H = state.house || {}; const sig = JSON.stringify([state.walls, H.wall]);
    if (sig === this.wallSig) return; this.wallSig = sig;
    if (this.wallGroup) { this.scene.remove(this.wallGroup); this.wallGroup.traverse((o) => o.geometry?.dispose()); }
    const G = new THREE.Group(); this.wallGroup = G; this.scene.add(G); this.segs = [];
    const style = H.wall || { color: '#f3e7d6', pattern: 'rayas' };
    const wm = std({ map: wallTexture(style.color, style.pattern, 1.5), roughness: 0.9 });
    const top = mat(shadeHex(style.color, 0.2), { rough: 0.95 });
    const frame = mat('#fffaf2', { rough: 0.5 }), leaf = mat('#a8784a', { rough: 0.6 }), knob = mat('#d4b04a', { metal: 0.6, rough: 0.3 });
    this.glasses = (this.glasses || []).filter((gl) => !gl.userData.built);
    for (const q of state.walls || []) {
      const g = new THREE.Group(); G.add(g);
      const box = (w, hh, d, x, y, z, m = [wm, wm, top, top, wm, wm]) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; g.add(me); return me; };
      // se construye a lo largo de X y se gira si es vertical
      if (q.door) {
        const DW = 0.82, DH = 2.05, side = (1 - DW) / 2;
        box(side, WALL_H, WALL_T, side / 2, WALL_H / 2, 0); box(side, WALL_H, WALL_T, 1 - side / 2, WALL_H / 2, 0);
        box(DW, WALL_H - DH, WALL_T, 0.5, DH + (WALL_H - DH) / 2, 0);
        for (const [fw, fh, fx, fy] of [[0.05, DH, side, DH / 2], [0.05, DH, 1 - side, DH / 2], [DW + 0.05, 0.05, 0.5, DH]]) box(fw, fh, WALL_T + 0.03, fx, fy, 0, frame);
        const hinge = new THREE.Group(); hinge.position.set(side + 0.03, 0, 0); hinge.rotation.y = -1.25; g.add(hinge);
        const lf = new THREE.Mesh(new RoundedBoxGeometry(DW - 0.06, DH - 0.04, 0.04, 2, 0.01), leaf); lf.position.set((DW - 0.06) / 2, DH / 2, 0); lf.castShadow = true; hinge.add(lf);
        const kb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), knob); kb.position.set(DW - 0.16, 1.0, 0.04); hinge.add(kb);
      } else if (q.window) {
        const SILL = 0.85, TOP = 2.05, WW = 0.8, side = (1 - WW) / 2;
        box(side, WALL_H, WALL_T, side / 2, WALL_H / 2, 0); box(side, WALL_H, WALL_T, 1 - side / 2, WALL_H / 2, 0);
        box(WW, SILL, WALL_T, 0.5, SILL / 2, 0); box(WW, WALL_H - TOP, WALL_T, 0.5, TOP + (WALL_H - TOP) / 2, 0);
        const gl = new THREE.Mesh(new THREE.BoxGeometry(WW, TOP - SILL, 0.02), std({ color: 0xbfe3f5, transparent: true, opacity: 0.35, roughness: 0.05, emissive: 0x000000 }));
        gl.position.set(0.5, (SILL + TOP) / 2, 0); gl.userData.built = true; g.add(gl); (this.glasses ||= []).push(gl);
        for (const [fw, fh, fx, fy] of [[WW, 0.05, 0.5, SILL], [WW, 0.05, 0.5, TOP], [0.05, TOP - SILL, side, (SILL + TOP) / 2], [0.05, TOP - SILL, 1 - side, (SILL + TOP) / 2], [0.04, TOP - SILL, 0.5, (SILL + TOP) / 2]]) box(fw, fh, WALL_T + 0.02, fx, fy, 0, frame);
      } else box(1 + WALL_T, WALL_H, WALL_T, 0.5, WALL_H / 2, 0);
      if (q.d === 'h') { g.position.set(q.x, 0.05, q.y); g.userData.cx = q.x + 0.5; g.userData.cz = q.y; }
      else { g.rotation.y = -Math.PI / 2; g.position.set(q.x, 0.05, q.y); g.userData.cx = q.x; g.userData.cz = q.y + 0.5; }
      g.scale.y = this.wallsUp ? 1 : 0.14; // paredes bajas por defecto: se ve el interior y cuesta menos
      this.segs.push(g);
    }
  }
  setWallsUp(up) { this.wallsUp = up; localStorage.setItem('vidas_walls', up ? 'up' : 'down'); for (const g of this.segs || []) g.scale.y = up ? 1 : 0.14; if (this.gl.shadowMap.enabled) this.gl.shadowMap.needsUpdate = true; }

  // ---------- fotograma ----------
  render(state, view) {
    const t = performance.now() / 1000; const dt = Math.min(0.05, t - (this.lastT || t)); this.lastT = t;
    this.buildHouse(state);
    this.buildWalls(state);
    this.syncObjects(state, view);
    this.syncPeople(state, view, t, dt);
    this.syncPets(state, t, dt);
    this.season(state);
    this.lighting(state, t);
    this.updateCamera(); if (this.cam.yaw !== this.cutYaw) { this.cutYaw = this.cam.yaw; this.cutaway(); }
    if (!this.hq) {
      const skey = this.objKeySig + '|' + this.houseSig + '|' + this.wallSig + '|' + Math.round(hourOf(state.time) * 4);
      if (skey !== this.shadowKey) { this.shadowKey = skey; this.gl.shadowMap.needsUpdate = true; }
    }
    if (this.marker.visible) { const a = (performance.now() - this.markerT) / 700; if (a > 1) this.marker.visible = false; else { this.marker.scale.setScalar(1 + a * 1.4); this.marker.material.opacity = 1 - a; } }
    this.gl.render(this.scene, this.camera);
    this.drawOverlay(state, view, t);
  }

  // ---------- capa 2D: burbujas, nombres, corazones ----------
  drawOverlay(state, view, now) {
    const ctx = this.ctx; ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); ctx.clearRect(0, 0, this.w, this.h);
    const z = Math.max(0.7, Math.min(1.3, 22 / this.cam.dist));
    for (const s of visibleSims(state)) {
      const p = this.people.get(s.id); if (!p) continue;
      const head = new THREE.Vector3(); p.head.getWorldPosition(head);
      const hq = this.project(head.clone().add(new THREE.Vector3(0, 0.22, 0))), fq = this.project(p.root.position);
      if (hq.z > 1) continue;
      this.nameTag(s, fq, z, view.active === s.id);
      this.bubble(state, s, hq, z, now);
    }
    // mascotas: nombre y burbuja si necesitan algo
    for (const p of state.pets || []) {
      const m = this.pets?.get(p.id); if (!m || !m.root.visible) continue;
      const q = this.project(m.root.position.clone().add(new THREE.Vector3(0, 0.6, 0))), f = this.project(m.root.position);
      if (this.cam.dist < 30) { ctx.font = `800 ${9.5 * z}px ${FONT}`; ctx.textAlign = 'center'; const tw = ctx.measureText(p.name).width + 10 * z; ctx.fillStyle = 'rgba(255,240,215,0.92)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(f.x - tw / 2, f.y + 4 * z, tw, 13 * z, 6 * z) : ctx.rect(f.x - tw / 2, f.y + 4 * z, tw, 13 * z); ctx.fill(); ctx.fillStyle = '#5a3a1a'; ctx.fillText(p.name, f.x, f.y + 14 * z); }
      const low = Object.entries(p.needs).filter(([, v]) => v < 30).sort((a, b) => a[1] - b[1])[0];
      if (p.sleeping) this.zzz(q, z * 0.8, now);
      else if (p.bubble && p.bubble.until > state.time) this.bubbleIcon(q, z * 0.85, 'heart', '#ff4f86', null, now);
      else if (low) this.bubbleIcon(q, z * 0.85, { hambre: 'food', carino: 'heart', diversion: 'ball' }[low[0]], '#e5484d', '#f5a524', now);
    }
    // lluvia o nieve (pocas partículas, dibujadas en 2D)
    if (this.weatherType === 'lluvia' || this.weatherType === 'nieve') {
      const snow = this.weatherType === 'nieve'; ctx.strokeStyle = 'rgba(190,215,240,0.55)'; ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.2;
      for (let i = 0; i < 70; i++) {
        const sp = snow ? 40 : 520, x0 = (hash(i, 3) * this.w + (snow ? Math.sin(now + i) * 20 : -now * 60)) % this.w, y = (hash(i, 9) * this.h + now * sp) % this.h;
        const x = (x0 + this.w) % this.w;
        if (snow) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, TAU); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 3, y + 11); ctx.stroke(); }
      }
    }
    this.hearts = this.hearts.filter((h) => h.t < 2);
    for (const h of this.hearts) {
      h.t += 1 / 60; if (h.t < 0) continue;
      const q = this.project(new THREE.Vector3(h.x, 1.6 + h.t * 0.9, h.y));
      ctx.globalAlpha = Math.max(0, 1 - h.t / 2); heartPath(ctx, q.x + h.dx * h.t, q.y, 9 * z * h.s); ctx.fillStyle = '#ff4f86'; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  nameTag(s, q, z, active) {
    if (this.cam.dist > 30 && !active) return;
    const ctx = this.ctx; ctx.font = `800 ${10.5 * z}px ${FONT}`; ctx.textAlign = 'center';
    const tw = ctx.measureText(s.name).width + 12 * z, th = 15 * z, y = q.y + 6 * z;
    ctx.fillStyle = active ? '#25c48f' : s.home ? 'rgba(255,255,255,0.92)' : '#ffe9b8';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(q.x - tw / 2, y, tw, th, th / 2) : ctx.rect(q.x - tw / 2, y, tw, th); ctx.fill();
    ctx.fillStyle = active ? '#fff' : '#2a2f45'; ctx.fillText(s.name, q.x, y + 11 * z);
  }
  bubble(state, s, q, z, now) {
    let icon = null, color = '#2a2f45', ring = null;
    if (s.bubble) { icon = s.bubble.icon; color = icon === 'heart' ? '#ff4f86' : icon === 'zap' ? '#e5484d' : icon === 'smile' ? '#25a96f' : '#7a6f8f'; }
    else if (s.age === 'bebe' && s.crying) { const n = ['hambre', 'higiene', 'social'].sort((a, b) => s.needs[a] - s.needs[b])[0]; icon = { hambre: 'bottle', higiene: 'drop', social: 'heart' }[n]; color = '#e5484d'; ring = '#e5484d'; }
    else if (s.sleeping) return this.zzz(q, z, now);
    else if (s.home && s.age !== 'bebe') {
      const low = NEEDS.filter((n) => s.needs[n] < 30).sort((a, b) => s.needs[a] - s.needs[b])[0];
      if (low) { icon = NEED_IC[low]; color = NEED_COLOR[low]; ring = s.needs[low] < 15 ? '#e5484d' : '#f5a524'; }
      else if (s.worries.length && Math.floor(now / 3) % 3 === 0) { icon = 'cloud'; color = '#8b5cf6'; }
    }
    if (!icon) return;
    const ctx = this.ctx; const x = q.x + 16 * z, y = q.y - 12 * z + Math.sin(now * 3 + s.x) * 1.6, r = 13 * z;
    ctx.fillStyle = 'rgba(30,25,40,0.15)'; ctx.beginPath(); ctx.arc(x, y + 2 * z, r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 9 * z, y + 12 * z, 3 * z, 0, TAU); ctx.arc(x - 13 * z, y + 17 * z, 1.8 * z, 0, TAU); ctx.fill();
    if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
    const img = iconImage(icon, color, 2.4); if (img.complete) ctx.drawImage(img, x - r * 0.62, y - r * 0.62, r * 1.24, r * 1.24);
  }
  bubbleIcon(q, z, icon, color, ring, now) {
    const ctx = this.ctx; const x = q.x + 12 * z, y = q.y - 8 * z + Math.sin(now * 3) * 1.4, r = 12 * z;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
    const img = iconImage(icon, color, 2.4); if (img.complete) ctx.drawImage(img, x - r * 0.62, y - r * 0.62, r * 1.24, r * 1.24);
  }
  zzz(q, z, now) {
    const ctx = this.ctx; ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const t = (now * 0.6 + i / 3) % 1; ctx.globalAlpha = Math.sin(t * Math.PI);
      ctx.font = `900 ${(9 + t * 7) * z}px ${FONT}`; ctx.fillStyle = '#e9ecff'; ctx.strokeStyle = 'rgba(40,40,90,0.5)'; ctx.lineWidth = 2;
      const x = q.x + (10 + t * 12) * z, y = q.y - t * 26 * z; ctx.strokeText('z', x, y); ctx.fillText('z', x, y);
    }
    ctx.globalAlpha = 1;
  }
}

function buildPet(p) {
  const root = new THREE.Group(); const fur = std({ color: hex(p.color), roughness: 0.9 }); const dark = std({ color: 0x1d1512 });
  const dog = p.species === 'perro';
  const mk = (geo, m, parent, x, y, z) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); parent.add(me); return me; };
  const body = mk(new THREE.CapsuleGeometry(dog ? 0.11 : 0.085, dog ? 0.28 : 0.22, 3, 8), fur, root, 0, 0.3, 0); body.rotation.x = Math.PI / 2;
  const head = new THREE.Group(); head.position.set(0, 0.42, dog ? 0.24 : 0.19); root.add(head);
  mk(new THREE.SphereGeometry(dog ? 0.1 : 0.085, 12, 10), fur, head, 0, 0, 0);
  if (dog) { mk(new THREE.CapsuleGeometry(0.045, 0.06, 2, 6), fur, head, 0, -0.03, 0.09).rotation.x = Math.PI / 2; mk(new THREE.SphereGeometry(0.022, 8, 6), dark, head, 0, -0.02, 0.15); }
  for (const sd of [-1, 1]) {
    const ear = mk(dog ? new THREE.SphereGeometry(0.04, 8, 6) : new THREE.ConeGeometry(0.035, 0.07, 6), fur, head, sd * 0.06, dog ? 0.02 : 0.08, 0); if (dog) { ear.scale.set(0.6, 1.4, 0.8); ear.position.y = -0.01; ear.position.x = sd * 0.09; }
    mk(new THREE.SphereGeometry(0.014, 6, 5), dark, head, sd * 0.035, 0.02, dog ? 0.085 : 0.075);
  }
  const legs = [];
  for (const [lx, lz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const g = new THREE.Group(); g.position.set(lx * 0.06, 0.24, lz * (dog ? 0.13 : 0.1)); root.add(g); mk(new THREE.CylinderGeometry(0.022, 0.02, 0.22, 6), fur, g, 0, -0.11, 0); legs.push(g); }
  const tail = new THREE.Group(); tail.position.set(0, 0.34, dog ? -0.24 : -0.19); root.add(tail);
  mk(new THREE.CylinderGeometry(0.014, 0.022, dog ? 0.16 : 0.24, 6), fur, tail, 0, (dog ? 0.16 : 0.24) / 2, 0);
  const blob = new THREE.Mesh(BLOB_GEO, BLOB_MAT); blob.rotation.x = -Math.PI / 2; blob.position.y = 0.012; blob.scale.setScalar(0.7); root.add(blob);
  root.traverse((m) => { if (m.isMesh) m.userData.petId = p.id; });
  return { root, body, head, legs, tail, yaw: 0 };
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.9, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9); ctx.closePath();
}

// Miniaturas del catálogo: cada mueble renderizado en 3D en un lienzo aparte
let thumbCache = null;
export function catalogThumbs() {
  if (thumbCache) return thumbCache;
  thumbCache = {};
  try {
    const cv = document.createElement('canvas'); cv.width = cv.height = 192;
    const r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x9a8a70, 1.3));
    const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(3, 5, 4); sc.add(d);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.05, 50);
    for (const type of Object.keys(OBJECTS)) {
      const g = buildObject({ type, x: 0, y: 0, rot: 0, id: 'thumb', users: [] }); sc.add(g);
      const box = new THREE.Box3().setFromObject(g); const c = box.getCenter(new THREE.Vector3()); const size = box.getSize(new THREE.Vector3()).length();
      const dist = size / (2 * Math.tan(THREE.MathUtils.degToRad(15))) * 0.95;
      cam.position.set(c.x + dist * 0.62, c.y + dist * 0.55, c.z + dist * 0.62); cam.lookAt(c);
      r.render(sc, cam); thumbCache[type] = cv.toDataURL('image/png');
      sc.remove(g); g.traverse((o) => o.geometry?.dispose());
    }
    r.dispose(); r.forceContextLoss();
  } catch (e) { console.warn('Sin miniaturas', e); }
  return thumbCache;
}

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
