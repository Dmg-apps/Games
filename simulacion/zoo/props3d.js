// Tiendas, decoración y visitantes del parque, con más detalle.
// Cada quiosco tiene su forma, toldo, mostrador, cartel y un reclamo en el tejado.
// Los visitantes se dibujan "instanciados": todos juntos en pocas llamadas de dibujo, con piernas y brazos que se mueven.
import { peek, instance as modelInstance, preload as preloadModels, staticModel } from '../shared/assets.js';
import { THREE, mat, blob, canvasTexture } from '../shared/engine3d.js';
import { RoundedBoxGeometry } from '../shared/vendor/RoundedBoxGeometry.js';
import * as Look from '../shared/look.js';

const rb = (w, h, d, m, r = 0.03) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), typeof m === 'string' ? mat(m) : m);
const cyl = (rt, rbm, h, m, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rbm, h, seg), typeof m === 'string' ? mat(m) : m);
const sph = (r, m, w = 16, hgt = 12) => new THREE.Mesh(new THREE.SphereGeometry(r, w, hgt), typeof m === 'string' ? mat(m) : m);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

// ---------- texturas ----------
const tcache = new Map();
const once = (k, f) => tcache.get(k) || (tcache.set(k, f()), tcache.get(k));
const stripes = (c1, c2) => once('st' + c1 + c2, () => canvasTexture(64, (x, s) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? c2 : c1; x.fillRect(i * s / 8, 0, s / 8 + 1, s); } }));
const planks = (c) => once('pl' + c, () => { const t = Look.woodTex([1, 1], [c, new THREE.Color(c).multiplyScalar(0.9).getStyle()]); return t; });
// Cartel con texto (lienzo alargado para que las letras no se deformen)
function signTex(text, bg, fg = '#fff') {
  return once('sg' + text + bg, () => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
    x.fillStyle = bg; x.beginPath(); x.roundRect(0, 0, 256, 64, 14); x.fill(); x.strokeStyle = 'rgba(255,255,255,0.55)'; x.lineWidth = 4; x.beginPath(); x.roundRect(6, 6, 244, 52, 10); x.stroke();
    const draw = () => { x.fillStyle = bg; x.beginPath(); x.roundRect(8, 8, 240, 48, 9); x.fill(); x.fillStyle = fg; x.font = '900 34px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 34); t.needsUpdate = true; };
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; draw(); document.fonts?.ready.then(draw); return t;
  });
}
const sign = (text, bg, w = 0.62, h = 0.16) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: signTex(text, bg), transparent: true })); return m; };

// ---------- quiosco base ----------
function kiosk(B, label, wall, roofC, awning) {
  const g = new THREE.Group();
  g.add(at(rb(0.94, 0.06, 0.94, '#cfc6b4', 0.02), 0, 0.03, 0)); // base de piedra
  const body = rb(0.78, 0.66, 0.7, new THREE.MeshLambertMaterial({ map: planks(wall) }), 0.03); g.add(at(body, 0, 0.39, -0.03));
  g.add(at(rb(0.6, 0.3, 0.02, '#2a2420', 0.01), 0, 0.5, 0.325)); // ventana del mostrador (interior oscuro)
  g.add(at(rb(0.7, 0.04, 0.16, '#f4ece0', 0.015), 0, 0.36, 0.38)); // mostrador
  g.add(at(rb(0.72, 0.2, 0.03, roofC, 0.01), 0, 0.23, 0.335)); // frente bajo el mostrador
  // toldo de rayas inclinado con borde
  const aw = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.32), new THREE.MeshLambertMaterial({ map: stripes(awning, '#fffaf0'), side: THREE.DoubleSide })); aw.rotation.x = -1.0; g.add(at(aw, 0, 0.77, 0.43));
  for (let i = 0; i < 8; i++) { const sc = new THREE.Mesh(new THREE.CircleGeometry(0.055, 10, 0, Math.PI), mat(i % 2 ? '#fffaf0' : awning, { side: THREE.DoubleSide })); sc.rotation.z = Math.PI; g.add(at(sc, -0.37 + i * 0.106, 0.635, 0.565)); }
  // tejado y cartel
  g.add(at(rb(0.9, 0.08, 0.82, roofC, 0.03), 0, 0.76, -0.03));
  const sg = sign(label, roofC); g.add(at(sg, 0, 0.9, 0.36));
  g.add(at(rb(0.66, 0.2, 0.04, '#fffaf0', 0.02), 0, 0.9, 0.335));
  return g;
}

export function buildingMesh(b, BUILDINGS) {
  const B = BUILDINGS[b.type]; let g;
  if (b.type === 'helados') {
    g = kiosk(B, 'HELADOS', '#fde2ec', '#f27aa8', '#f49ac0');
    const cone = cyl(0.11, 0.015, 0.32, '#e0a85a', 12); cone.rotation.x = Math.PI; g.add(at(cone, 0, 1.05, -0.08));
    [['#fff3c4', 0, 1.24], ['#f49ac0', -0.06, 1.33], ['#8a5232', 0.06, 1.33]].forEach(([c, x, y]) => g.add(at(sph(0.1, c), x, y, -0.08)));
    g.add(at(sph(0.025, '#e5484d'), 0, 1.44, -0.08));
  } else if (b.type === 'comida') {
    g = kiosk(B, 'BURGERS', '#fff0d8', '#e8902c', '#e5484d');
    const top = sph(0.17, '#d8963a', 16, 10); top.scale.y = 0.55; g.add(at(top, 0, 1.17, -0.08));
    g.add(at(cyl(0.18, 0.18, 0.05, '#5a3420'), 0, 1.08, -0.08)); g.add(at(cyl(0.19, 0.19, 0.02, '#6ab04a'), 0, 1.11, -0.08)); g.add(at(cyl(0.185, 0.185, 0.015, '#f5c842'), 0, 1.06, -0.08));
    const bot = cyl(0.17, 0.16, 0.06, '#d8963a'); g.add(at(bot, 0, 1.02, -0.08));
    for (let i = 0; i < 6; i++) g.add(at(sph(0.012, '#fff6dc', 6, 4), Math.cos(i) * 0.09, 1.25, -0.08 + Math.sin(i * 2) * 0.09));
  } else if (b.type === 'bebidas') {
    g = kiosk(B, 'BEBIDAS', '#e2f0fb', '#2f8fd8', '#5ab0e8');
    g.add(at(cyl(0.12, 0.09, 0.32, '#f4f8fb'), 0, 1.0, -0.08)); g.add(at(cyl(0.122, 0.122, 0.08, '#2f8fd8'), 0, 1.02, -0.08)); g.add(at(cyl(0.125, 0.125, 0.03, '#e5484d'), 0, 1.17, -0.08));
    const straw = cyl(0.012, 0.012, 0.28, '#e5484d', 8); straw.rotation.z = 0.25; g.add(at(straw, 0.03, 1.3, -0.08));
  } else if (b.type === 'regalos') {
    g = new THREE.Group(); g.add(at(rb(0.94, 0.06, 0.94, '#cfc6b4', 0.02), 0, 0.03, 0));
    g.add(at(rb(0.82, 0.62, 0.74, new THREE.MeshLambertMaterial({ map: planks('#efe4fb') }), 0.03), 0, 0.37, -0.02));
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.36, 4), mat('#8a5ad0')); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.9; g.add(at(roof, 0, 0.86, -0.02));
    for (const sx of [-0.2, 0.2]) { g.add(at(rb(0.26, 0.26, 0.02, '#bfe4fa', 0.01), sx, 0.42, 0.36)); g.add(at(rb(0.3, 0.03, 0.05, '#fffaf0', 0.01), sx, 0.28, 0.37)); }
    g.add(at(rb(0.2, 0.36, 0.02, '#6a3aa8', 0.01), 0, 0.24, 0.355));
    g.add(at(sign('REGALOS', '#8a5ad0', 0.56, 0.14), 0, 0.68, 0.37));
    const box = rb(0.2, 0.18, 0.2, '#f5c842', 0.02); g.add(at(box, 0, 1.13, -0.02)); g.add(at(rb(0.21, 0.19, 0.04, '#e5484d', 0.01), 0, 1.13, -0.02)); g.add(at(rb(0.04, 0.19, 0.21, '#e5484d', 0.01), 0, 1.13, -0.02));
    for (const s of [-1, 1]) { const bow = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.014, 6, 12), mat('#e5484d')); bow.rotation.y = s * 0.6; g.add(at(bow, s * 0.035, 1.25, -0.02)); }
  } else if (b.type === 'banos') {
    g = new THREE.Group(); g.add(at(rb(0.94, 0.06, 0.94, '#cfc6b4', 0.02), 0, 0.03, 0));
    g.add(at(rb(0.84, 0.7, 0.76, new THREE.MeshLambertMaterial({ map: Look.tileTex([3, 3], '#e6eef4', '#c8d4dc') }), 0.03), 0, 0.41, -0.02));
    g.add(at(rb(0.92, 0.07, 0.84, '#5a7aa0', 0.03), 0, 0.8, -0.02));
    for (const [sx, c] of [[-0.2, '#3b82f6'], [0.2, '#e0559a']]) { g.add(at(rb(0.22, 0.42, 0.03, '#7a8a9a', 0.01), sx, 0.28, 0.36)); g.add(at(sph(0.012, '#d8d0b0', 6, 4), sx + 0.07, 0.28, 0.38)); g.add(at(cyl(0.035, 0.035, 0.01, c, 14), sx, 0.58, 0.37).rotateX(Math.PI / 2)); }
    g.add(at(sign('ASEOS', '#5a7aa0', 0.5, 0.13), 0, 0.72, 0.375));
    g.add(at(rb(0.12, 0.08, 0.12, '#9aa8b4', 0.02), 0.25, 0.88, -0.15));
  } else if (b.type === 'banco') {
    g = new THREE.Group(); const wood = new THREE.MeshLambertMaterial({ map: planks('#b07a46') }); const iron = mat('#2e3238');
    for (let i = 0; i < 3; i++) g.add(at(rb(0.74, 0.025, 0.07, wood, 0.008), 0, 0.24, -0.08 + i * 0.08));
    for (let i = 0; i < 2; i++) { const s = rb(0.74, 0.07, 0.022, wood, 0.008); s.rotation.x = -0.25; g.add(at(s, 0, 0.36 + i * 0.09, -0.15 - i * 0.02)); }
    for (const sx of [-0.32, 0.32]) { g.add(at(rb(0.03, 0.24, 0.03, iron, 0.006), sx, 0.12, 0.06)); g.add(at(rb(0.03, 0.44, 0.03, iron, 0.006), sx, 0.22, -0.13)); const arm = rb(0.03, 0.03, 0.22, iron, 0.008); g.add(at(arm, sx, 0.32, -0.04)); }
    g.add(blob(0.9, 0.45, 0.3));
  } else if (b.type === 'papelera') {
    g = new THREE.Group(); g.add(at(cyl(0.13, 0.11, 0.38, '#3f7a52'), 0, 0.2, 0)); g.add(at(cyl(0.14, 0.14, 0.04, '#2e5a3e'), 0, 0.4, 0));
    g.add(at(cyl(0.1, 0.1, 0.02, '#1a1a1a'), 0, 0.42, 0)); for (let i = 0; i < 4; i++) g.add(at(rb(0.012, 0.3, 0.01, '#2e5a3e', 0.004), Math.cos(i * 1.57) * 0.13, 0.2, Math.sin(i * 1.57) * 0.13));
    g.add(blob(0.4, 0.4, 0.3));
  } else if (b.type === 'farola') {
    g = new THREE.Group(); const iron = mat('#2a2e36');
    g.add(at(cyl(0.08, 0.1, 0.12, iron, 10), 0, 0.06, 0)); g.add(at(cyl(0.025, 0.04, 1.35, iron, 8), 0, 0.75, 0)); g.add(at(cyl(0.05, 0.03, 0.06, iron, 8), 0, 1.44, 0));
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.16, 6), new THREE.MeshLambertMaterial({ color: '#fff3c0', emissive: '#c8a040', emissiveIntensity: 0.4, transparent: true, opacity: 0.9 })); g.add(at(lamp, 0, 1.55, 0)); g.userData.lamp = lamp;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.1, 6), iron); g.add(at(cap, 0, 1.68, 0)); g.add(at(sph(0.02, iron, 6, 4), 0, 1.74, 0));
    g.add(blob(0.4, 0.4, 0.3));
  } else if (b.type === 'flores') {
    g = new THREE.Group(); const R = Look.seeded(b.x * 7 + b.z);
    g.add(at(cyl(0.42, 0.44, 0.1, '#bdb2a0', 20), 0, 0.05, 0)); g.add(at(cyl(0.38, 0.38, 0.02, '#5a3e28', 20), 0, 0.1, 0));
    const cols = ['#ff8fb1', '#ffd45c', '#ffffff', '#b99cff', '#ff7a5c'];
    for (let i = 0; i < 14; i++) { const a = R() * 6.28, d = Math.sqrt(R()) * 0.32; const fx = Math.cos(a) * d, fz = Math.sin(a) * d; const h = 0.1 + R() * 0.12;
      g.add(at(cyl(0.006, 0.006, h, '#3e8a3e', 4), fx, 0.1 + h / 2, fz)); const c = cols[Math.floor(R() * cols.length)];
      for (let k = 0; k < 5; k++) { const p = sph(0.022, c, 6, 4); p.scale.y = 0.4; g.add(at(p, fx + Math.cos(k * 1.26) * 0.022, 0.11 + h, fz + Math.sin(k * 1.26) * 0.022)); }
      g.add(at(sph(0.012, '#f5c842', 6, 4), fx, 0.115 + h, fz)); }
    const bush = Look.bush(0.12, b.x + b.z, '#2f6e34', '#6aae52'); g.add(at(bush, 0, 0.1, 0));
  } else if (b.type === 'arbolp') {
    g = new THREE.Group(); const t = staticModel(['nature/tree_oak.glb', 'nature/tree_fat.glb', 'nature/tree_pine.glb'][(b.x * 3 + b.z) % 3], { height: 2.1 }) || Look.tree((b.x + b.z) % 3 ? 'roble' : 'abedul', 1.1, b.x * 3 + b.z); t.rotation.y = (b.x * 7 + b.z) % 6; g.add(t);
    g.add(at(cyl(0.3, 0.32, 0.08, '#bdb2a0', 16), 0, 0.04, 0)); g.add(at(cyl(0.27, 0.27, 0.02, '#5a3e28', 16), 0, 0.08, 0)); g.add(blob(1.0, 1.0, 0.3));
  } else if (b.type === 'fuente') {
    g = new THREE.Group(); const stone = mat('#d8d0c2'), stone2 = mat('#c4baa8');
    g.add(at(cyl(0.48, 0.5, 0.2, stone, 8), 0, 0.1, 0)); g.add(at(cyl(0.5, 0.5, 0.03, stone2, 8), 0, 0.21, 0));
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.43, 8), new THREE.MeshLambertMaterial({ map: Look.waterTex(), transparent: true, opacity: 0.9 })); water.rotation.x = -Math.PI / 2; g.add(at(water, 0, 0.18, 0));
    g.add(at(cyl(0.06, 0.09, 0.5, stone, 10), 0, 0.42, 0)); g.add(at(cyl(0.22, 0.08, 0.1, stone, 12), 0, 0.68, 0));
    const w2 = new THREE.Mesh(new THREE.CircleGeometry(0.19, 12), new THREE.MeshLambertMaterial({ map: Look.waterTex(), transparent: true, opacity: 0.9 })); w2.rotation.x = -Math.PI / 2; g.add(at(w2, 0, 0.72, 0));
    g.add(at(cyl(0.03, 0.04, 0.16, stone, 8), 0, 0.8, 0)); g.add(at(sph(0.05, stone, 10, 8), 0, 0.9, 0));
    const fall = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.48, 16, 1, true), new THREE.MeshLambertMaterial({ color: '#cfeeff', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide })); g.add(at(fall, 0, 0.45, 0)); g.userData.fall = fall;
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.25, 10, 1, true), new THREE.MeshLambertMaterial({ color: '#e8f8ff', transparent: true, opacity: 0.5, depthWrite: false })); jet.rotation.x = Math.PI; g.add(at(jet, 0, 1.0, 0));
    g.add(blob(1.3, 1.3, 0.3));
  } else { g = new THREE.Group(); g.add(rb(0.5, 0.5, 0.5, '#ccc')); }
  if (B.cat === 'Tiendas') { g.add(blob(1.3, 1.3, 0.35)); }
  return g;
}

// ---------- visitores con modelos animados (Kenney Mini Characters, CC0) ----------
// Los primeros "max" visitantes se dibujan con personajes de verdad; el resto, con las figuras sencillas.
const PEOPLE_FILES = ['a', 'b', 'c', 'd', 'e', 'f'].flatMap((k) => [`people/mini_male_${k}.glb`, `people/mini_female_${k}.glb`]).filter((f) => !f.endsWith('female_a.glb')); // (esa lleva algo parecido a un arma)
export class GlbPeople {
  constructor(scene, max = 30) { this.scene = scene; this.max = max; this.map = new Map(); this.ready = false; this.lastT = 0; preloadModels(PEOPLE_FILES).then((r) => { this.ready = r.every(Boolean); }); }
  // Devuelve los visitantes que no ha dibujado (para las figuras sencillas)
  sync(list, t) {
    if (!this.ready) return list;
    const dt = this.lastT ? Math.min(0.1, t - this.lastT) : 0; this.lastT = t;
    const shown = list.slice(0, this.max); const seen = new Set();
    for (const p of shown) {
      seen.add(p.id); let r = this.map.get(p.id);
      if (!r) { const gl = peek(PEOPLE_FILES[Math.floor(Math.abs(p.id) * 1e6) % PEOPLE_FILES.length]); r = modelInstance(gl, { height: p.kid ? 0.48 : 0.66 }); r.g.add(blob(0.36, 0.36, 0.3)); r.g.traverse((o) => { o.castShadow = false; }); this.scene.add(r.g); this.map.set(p.id, r); }
      const walk = p.path && p.path.length; r.play(walk ? 'walk' : 'idle', { speed: walk ? 1.1 : 1 }); r.update(dt);
      r.g.position.set(p.x + 0.5, 0.05, p.z + 0.5); r.g.rotation.y = p.dir || 0;
    }
    for (const [id, r] of this.map) if (!seen.has(id)) { this.scene.remove(r.g); this.map.delete(id); }
    return list.slice(this.max);
  }
}

// ---------- visitores ----------
const PANTS = ['#2f3b5a', '#3a3a44', '#6a5a48', '#2a5a8a', '#8a8a92', '#1f2a3a'];
const HAIR = ['#2a1a10', '#5a3a20', '#8a5a30', '#d8b060', '#1a1a1a', '#a03a20', '#d8d8d8'];
export class People {
  constructor(scene, max = 90) {
    this.max = max; const m = new THREE.MeshLambertMaterial();
    const mk = (geo, n) => { const im = new THREE.InstancedMesh(geo, m, n); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.setColorAt(0, new THREE.Color()); scene.add(im); return im; };
    const torso = new THREE.CapsuleGeometry(0.085, 0.18, 4, 10); const head = new THREE.SphereGeometry(0.075, 12, 10);
    const hair = new THREE.SphereGeometry(0.08, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55);
    const leg = new THREE.CapsuleGeometry(0.035, 0.22, 3, 8); leg.translate(0, -0.145, 0);
    const arm = new THREE.CapsuleGeometry(0.026, 0.19, 3, 8); arm.translate(0, -0.12, 0);
    this.torso = mk(torso, max); this.head = mk(head, max); this.hair = mk(hair, max); this.legs = mk(leg, max * 2); this.arms = mk(arm, max * 2);
    this.shadow = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.34, 0.34), blob(0.34, 0.34, 0.3).material, max); this.shadow.count = 0; this.shadow.frustumCulled = false; scene.add(this.shadow);
    this.M = new THREE.Matrix4(); this.L = new THREE.Matrix4(); this.T = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.c = new THREE.Color(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
  }
  sync(list, t) {
    const n = Math.min(list.length, this.max); const { M, L, T, q, e, c, v, s } = this;
    const put = (im, i, base, x, y, z, rx = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { e.set(rx, 0, rz); q.setFromEuler(e); L.compose(v.set(x, y, z), q, s.set(sx, sy, sz)); T.multiplyMatrices(base, L); im.setMatrixAt(i, T); };
    for (let i = 0; i < n; i++) {
      const p = list[i]; const k = p.kid ? 0.72 : 1; const walk = p.path && p.path.length; const ph = t * 8 + p.id * 40; const sw = walk ? Math.sin(ph) * 0.55 : 0; const bob = walk ? Math.abs(Math.cos(ph)) * 0.02 : 0;
      e.set(0, p.dir || 0, 0); q.setFromEuler(e); M.compose(v.set(p.x + 0.5, 0.05 + bob, p.z + 0.5), q, s.set(k, k, k));
      const h = (Math.floor(p.id * 1e6) % 97);
      put(this.torso, i, M, 0, 0.48, 0); this.torso.setColorAt(i, c.set(p.color));
      put(this.head, i, M, 0, 0.71, 0.01); this.head.setColorAt(i, c.set(p.skin));
      put(this.hair, i, M, 0, 0.725, -0.004, -0.15); this.hair.setColorAt(i, c.set(HAIR[h % HAIR.length]));
      for (const sd of [-1, 1]) {
        const j = i * 2 + (sd > 0 ? 1 : 0);
        put(this.legs, j, M, sd * 0.045, 0.33, 0, sd * sw); this.legs.setColorAt(j, c.set(PANTS[h % PANTS.length]));
        put(this.arms, j, M, sd * 0.11, 0.6, 0, -sd * sw * 0.8, sd * 0.12); this.arms.setColorAt(j, c.set(p.color));
      }
      e.set(-Math.PI / 2, 0, 0); q.setFromEuler(e); T.compose(v.set(p.x + 0.5, 0.06, p.z + 0.5), q, s.set(k, k, k)); this.shadow.setMatrixAt(i, T);
    }
    for (const im of [this.torso, this.head, this.hair, this.shadow]) { im.count = n; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
    for (const im of [this.legs, this.arms]) { im.count = n * 2; im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; }
  }
}
