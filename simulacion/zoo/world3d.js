// Aspecto del mundo del santuario (diseño propio, estilo de cubos):
// césped cortado a franjas, prado con flores alrededor, caminos de adoquín con bordillo,
// suelos de cada hábitat y vallas de cubos con estilo distinto según el hábitat.
import { THREE, RoundedBoxGeometry } from '../shared/engine3d.js';

const cache = {};
const once = (k, f) => cache[k] || (cache[k] = f());
function seeded(s) { let a = s >>> 0 || 1; return () => { a ^= a << 13; a ^= a >>> 17; a ^= a << 5; return ((a >>> 0) % 100000) / 100000; }; }
function tex(size, draw, repeat = 1) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat, repeat);
  t.anisotropy = 4; return t;
}
// manchas suaves y grandes (sin el patrón de rombos que se notaba al repetir)
function soft(x, s, R, cols, n, rMin, rMax, a) {
  for (let i = 0; i < n; i++) {
    const r = rMin + R() * (rMax - rMin), px = R() * s, py = R() * s;
    for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) { // dibuja también al otro lado: textura sin costuras
      const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); g.addColorStop(0, cols[i % cols.length]); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.globalAlpha = a; x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
    }
  }
  x.globalAlpha = 1;
}
function dots(x, s, R, cols, n, w, h, a = 0.5) { for (let i = 0; i < n; i++) { x.globalAlpha = a * (0.5 + R() * 0.5); x.fillStyle = cols[i % cols.length]; x.fillRect(R() * s, R() * s, w, h * (0.6 + R() * 0.8)); } x.globalAlpha = 1; }

// Césped del parque: franjas de cortacésped de 2 casillas. La textura cubre 4×4 casillas.
export const lawnTex = (N) => {
  const t = once('lawn', () => tex(512, (x, s) => {
    const R = seeded(11); const half = s / 2;
    x.fillStyle = '#8fc562'; x.fillRect(0, 0, half, s); x.fillStyle = '#74ab4c'; x.fillRect(half, 0, half, s);
    soft(x, s, R, ['#a2d070', '#6aa246'], 12, 120, 220, 0.12);
    dots(x, s, R, ['#a6d276', '#5f9a40', '#93c566'], 7000, 1.4, 3, 0.3);
  }));
  const c = t.clone(); c.needsUpdate = true; const rep = (N + 1) / 4; c.repeat.set(rep, rep); c.offset.set(-0.5 / 4, 0); return c;
};
// Prado de fuera: más oscuro y salvaje, con flores
export const meadowTex = (repeat) => {
  const t = once('meadow', () => tex(512, (x, s) => {
    const R = seeded(23); x.fillStyle = '#6f9a4c'; x.fillRect(0, 0, s, s);
    soft(x, s, R, ['#83ad58', '#5c8a3e', '#8aa85a'], 40, 50, 140, 0.22);
    dots(x, s, R, ['#88b45c', '#557f39', '#9cc070'], 7000, 1.5, 4, 0.5);
    for (let i = 0; i < 260; i++) { x.fillStyle = ['#fff7e8', '#ffd84a', '#f39ac0', '#c9b6ff'][i % 4]; const px = R() * s, py = R() * s; x.fillRect(px, py, 3, 3); }
  }));
  const c = t.clone(); c.needsUpdate = true; c.repeat.set(repeat, repeat); return c;
};
// Adoquines claros, irregulares, con juntas
export const cobbleTex = () => once('cobble', () => tex(128, (x, s) => {
  const R = seeded(5); x.fillStyle = '#a99c84'; x.fillRect(0, 0, s, s);
  const n = 4, w = s / n;
  for (let j = 0; j < n; j++) for (let i = -1; i <= n; i++) {
    const off = (j % 2) * w / 2, px = i * w + off, py = j * w, l = 0.9 + R() * 0.12;
    const c = [Math.round(232 * l), Math.round(222 * l), Math.round(200 * l)];
    x.fillStyle = `rgb(${c})`; x.beginPath(); x.roundRect(px + 2.5, py + 2.5, w - 5, w - 5, 6); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.22)'; x.beginPath(); x.roundRect(px + 4, py + 4, w - 12, (w - 8) * 0.4, 4); x.fill();
  }
  dots(x, s, R, ['#8a7d66', '#fff8ea'], 600, 1, 1, 0.5);
}));

// Suelo de cada hábitat (textura de 2×2 casillas)
const BIOME_LOOK = {
  pradera: { base: '#b8c46a', patch: ['#c8d27c', '#a6b45a', '#d4c47a'], dot: ['#d2dc8a', '#98a84e', '#e0cc80'], track: '#b0945e' },
  granja: { base: '#93c160', patch: ['#a8d070', '#7fae50', '#c9c27a'], dot: ['#b4d67e', '#6f9e48', '#d6c97e'], track: '#a7895a' },
  sabana: { base: '#d3bd72', patch: ['#e2d08c', '#c2a75c', '#b8b06a'], dot: ['#e8d896', '#a99250', '#9caa5a'], track: '#b8915a' },
  selva: { base: '#4d9446', patch: ['#5fa752', '#3c7c38', '#6a8a3a'], dot: ['#6cb45a', '#32682f', '#8a7448'], track: '#6e5a3a' },
  artico: { base: '#eaf2f7', patch: ['#ffffff', '#d6e4ee', '#c6d8e6'], dot: ['#ffffff', '#c2d4e2'], track: '#b8cad8' },
  humedal: { base: '#86baa6', patch: ['#9ccab8', '#6ea48e', '#8fae7a'], dot: ['#a8d4c2', '#5f8f78', '#7a9a60'], track: '#7c7354' },
  bosque: { base: '#6a9650', patch: ['#7aa65c', '#56803f', '#8a7a50'], dot: ['#7aa45a', '#43683a', '#8a6e46'], track: '#6e5636' },
};
export const biomeTex = (b) => once('biome-' + b, () => tex(256, (x, s) => {
  const L = BIOME_LOOK[b] || BIOME_LOOK.granja, R = seeded(b.length * 31);
  x.fillStyle = L.base; x.fillRect(0, 0, s, s);
  soft(x, s, R, L.patch, 7, 70, 130, 0.16);
  dots(x, s, R, L.dot, b === 'artico' ? 700 : 2600, b === 'selva' ? 2.5 : 1.4, b === 'sabana' || b === 'granja' ? 4 : 2, 0.4);
  if (b === 'humedal') { x.fillStyle = 'rgba(70,140,190,0.35)'; for (let i = 0; i < 4; i++) { x.beginPath(); x.ellipse(R() * s, R() * s, 18, 10, R() * 3, 0, 7); x.fill(); } }
}, 1));
export const trackColor = (b) => (BIOME_LOOK[b] || BIOME_LOOK.granja).track;
// Degradado para el camino de tierra que los animales marcan junto a la valla
const edgeTex = () => once('edge', () => { const t = tex(64, (x, s) => { const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.55, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); }); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; });

// Estilo de valla por hábitat
const FENCE = {
  pradera: { post: '#8a6440', rail: '#c09a64', cap: '#6a4a2c', rails: [0.3, 0.6] },
  granja: { post: '#7a5434', rail: '#b0844f', cap: '#5e3f24', rails: [0.3, 0.6] },
  sabana: { post: '#6b4e30', rail: '#94703f', cap: '#4e3822', rails: [0.32, 0.62] },
  selva: { post: '#5f8a34', rail: '#86ac4a', cap: '#4a6e2a', rails: [0.25, 0.5, 0.75] },
  artico: { post: '#c9d6e0', rail: '#f2f6f9', cap: '#9fb2c2', rails: [0.3, 0.6] },
  humedal: { post: '#6a5a40', rail: '#8f7b56', cap: '#4e4230', rails: [0.3, 0.6] },
  bosque: { post: '#553a24', rail: '#7a5636', cap: '#3e2a1a', rails: [0.3, 0.6] },
};
const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
const geos = () => once('fgeo', () => ({
  post: new RoundedBoxGeometry(0.11, 0.86, 0.11, 2, 0.025).translate(0, 0.43, 0),
  cap: new RoundedBoxGeometry(0.15, 0.06, 0.15, 2, 0.02).translate(0, 0.89, 0),
  rail: new RoundedBoxGeometry(1, 0.07, 0.06, 2, 0.02),
  curb: new RoundedBoxGeometry(1, 0.1, 0.2, 2, 0.03),
}));
function inst(geo, material, mats) { const m = new THREE.InstancedMesh(geo, material, Math.max(1, mats.length)); mats.forEach((x, i) => m.setMatrixAt(i, x)); m.castShadow = true; m.receiveShadow = true; return m; }

// Recinto completo: suelo, camino de tierra junto a la valla, bordillo de piedra y valla
export function enclosureBase(e) {
  const g = new THREE.Group(), n = e.n, cx = e.x + n / 2, cz = e.z + n / 2;
  const top = biomeTex(e.biome).clone(); top.needsUpdate = true; top.repeat.set(n / 2, n / 2);
  const side = lam('#9a8a70');
  const ground = new THREE.Mesh(new THREE.BoxGeometry(n - 0.04, 0.06, n - 0.04), [side, side, new THREE.MeshLambertMaterial({ map: top }), side, side, side]);
  ground.position.set(cx, 0.03, cz); ground.receiveShadow = true; ground.userData.ground = true; g.add(ground);
  // tierra pisada junto a la valla
  const em = new THREE.MeshLambertMaterial({ map: edgeTex(), color: trackColor(e.biome), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const w = Math.min(0.55, n * 0.12);
  for (const [px, pz, ry] of [[cx, e.z + w / 2, 0], [cx, e.z + n - w / 2, Math.PI], [e.x + w / 2, cz, -Math.PI / 2], [e.x + n - w / 2, cz, Math.PI / 2]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(n - 0.06, w), em); p.rotation.set(-Math.PI / 2, 0, ry); p.position.set(px, 0.062, pz); p.renderOrder = 1; g.add(p);
  }
  // valla
  const F = FENCE[e.biome] || FENCE.granja, G = geos(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const posts = [], caps = [], rails = [], curbs = [];
  const seen = new Set();
  for (let i = 0; i <= n; i++) for (const [x, z] of [[e.x + i, e.z], [e.x + i, e.z + n], [e.x, e.z + i], [e.x + n, e.z + i]]) {
    const k = x + ',' + z; if (seen.has(k)) continue; seen.add(k);
    posts.push(new THREE.Matrix4().makeTranslation(x, 0, z)); caps.push(new THREE.Matrix4().makeTranslation(x, 0, z));
  }
  for (let i = 0; i < n; i++) for (const [x, z, rot] of [[e.x + i + 0.5, e.z, 0], [e.x + i + 0.5, e.z + n, 0], [e.x, e.z + i + 0.5, Math.PI / 2], [e.x + n, e.z + i + 0.5, Math.PI / 2]]) {
    q.setFromAxisAngle(up, rot);
    for (const y of F.rails) { m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1.0, 1, 1)); rails.push(m4.clone()); }
    m4.compose(new THREE.Vector3(x, 0.05, z), q, new THREE.Vector3(1.02, 1, 1)); curbs.push(m4.clone());
  }
  g.add(inst(G.post, lam(F.post), posts), inst(G.cap, lam(F.cap), caps), inst(G.rail, lam(F.rail), rails));
  const cb = inst(G.curb, lam('#c9bfab'), curbs); cb.castShadow = false; g.add(cb);
  return g;
}

// Caminos: losa de adoquines y bordillo donde el camino termina
export function pathMesh(tiles, isPath, skip = () => false) {
  const g = new THREE.Group(); if (!tiles.length) return g;
  const slabMat = new THREE.MeshLambertMaterial({ map: cobbleTex() });
  const slab = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 1), [lam('#b8ab92'), lam('#b8ab92'), slabMat, lam('#b8ab92'), lam('#b8ab92'), lam('#b8ab92')], tiles.length);
  const m4 = new THREE.Matrix4(); tiles.forEach(([x, z], i) => { m4.makeTranslation(x + 0.5, 0.03, z + 0.5); slab.setMatrixAt(i, m4); }); slab.receiveShadow = true; g.add(slab);
  const curb = []; const q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const [x, z] of tiles) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (isPath(x + dx, z + dz) || skip(x + dx, z + dz)) continue;
    q.setFromAxisAngle(up, dx ? Math.PI / 2 : 0); m4.compose(new THREE.Vector3(x + 0.5 + dx * 0.47, 0.045, z + 0.5 + dz * 0.47), q, new THREE.Vector3(1.0, 0.9, 0.3)); curb.push(m4.clone());
  }
  if (curb.length) { const c = inst(geos().curb, lam('#ddd5c4'), curb); c.castShadow = false; g.add(c); }
  return g;
}

// Matas de hierba en cubitos y flores sueltas por el césped
export function lawnDetail(points, flowers) {
  const g = new THREE.Group(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), R = seeded(points.length + 7);
  if (points.length) {
    const blade = (h, x, z) => new THREE.BoxGeometry(0.035, h, 0.035).translate(x, h / 2, z);
    const parts = [blade(0.14, 0, 0), blade(0.1, 0.05, 0.03), blade(0.11, -0.04, 0.04), blade(0.08, 0.02, -0.05)];
    const geo = mergeBoxes(parts);
    const mats = points.map(([x, z]) => { q.setFromAxisAngle(up, R() * 6.3); const s = 0.8 + R() * 0.6; return m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s)).clone(); });
    const t = inst(geo, lam('#5f9a3e'), mats); t.castShadow = false; g.add(t);
  }
  if (flowers.length) {
    const head = new THREE.BoxGeometry(0.06, 0.05, 0.06).translate(0, 0.09, 0), stem = new THREE.BoxGeometry(0.015, 0.08, 0.015).translate(0, 0.04, 0);
    const cols = ['#fff6e6', '#ffd447', '#f58fb6', '#b9a4ff'];
    cols.forEach((c, ci) => {
      const ms = flowers.filter((_, i) => i % cols.length === ci).map(([x, z]) => m4.makeTranslation(x, 0, z).clone()); if (!ms.length) return;
      const h = inst(head, lam(c), ms); h.castShadow = false; g.add(h);
      const st = inst(stem, lam('#4f8a36'), ms); st.castShadow = false; g.add(st);
    });
  }
  return g;
}
function mergeBoxes(list) {
  const pos = [], nor = [], idx = []; let off = 0;
  for (const gm of list) { const g = gm.index ? gm : gm; const p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); } for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); off += p.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setIndex(idx); return out;
}

// Entrada del santuario: pilares de piedra, viga de madera y letrero
export function gate() {
  const g = new THREE.Group(); const stone = lam('#cbbfa6'), stoneD = lam('#a99c84'), wood = lam('#7a5232'), sign = lam('#f6ead0'), leaf = lam('#4f8f3a');
  const rb = (w, h, d, r, m) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), m);
  for (const sx of [-0.95, 0.95]) {
    const p = rb(0.42, 1.9, 0.42, 0.05, stone); p.position.set(sx, 0.95, 0); g.add(p);
    const b = rb(0.52, 0.18, 0.52, 0.04, stoneD); b.position.set(sx, 0.09, 0); g.add(b);
    const c = rb(0.54, 0.14, 0.54, 0.04, stoneD); c.position.set(sx, 1.95, 0); g.add(c);
    const pot = rb(0.34, 0.22, 0.34, 0.05, lam('#b8643e')); pot.position.set(sx, 2.13, 0); g.add(pot);
    const bush = rb(0.34, 0.26, 0.34, 0.1, leaf); bush.position.set(sx, 2.36, 0); g.add(bush);
  }
  const beam = rb(2.4, 0.2, 0.26, 0.05, wood); beam.position.set(0, 1.72, 0); g.add(beam);
  const board = rb(1.36, 0.46, 0.08, 0.06, sign); board.position.set(0, 2.08, 0.04); g.add(board);
  const frame = rb(1.46, 0.56, 0.06, 0.06, wood); frame.position.set(0, 2.08, -0.01); g.add(frame);
  // letrero pintado: una huella y el nombre
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 86; const x = cv.getContext('2d');
  x.fillStyle = '#f6ead0'; x.fillRect(0, 0, 256, 86); x.fillStyle = '#2f6b4f'; x.font = '900 34px Nunito, system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SANTUARIO', 128, 46);
  x.fillStyle = '#ee6f47'; for (const [cx, cy, r] of [[22, 46, 8], [14, 32, 4], [22, 28, 4], [30, 32, 4], [234, 46, 8], [226, 32, 4], [234, 28, 4], [242, 32, 4]]) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.43), new THREE.MeshLambertMaterial({ map: t })); face.position.set(0, 2.08, 0.085); g.add(face);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// Hierba alta de las zonas salvajes (más alta y algo más amarilla que la del césped)
export function tallGrass(points) {
  const R = seeded(points.length * 3 + 1), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const b = (h, x, z, rz) => new THREE.BoxGeometry(0.04, h, 0.04).translate(0, h / 2, 0).rotateZ(rz).translate(x, 0, z);
  const geo = mergeBoxes([b(0.32, 0, 0, 0.1), b(0.26, 0.06, 0.03, -0.2), b(0.22, -0.05, 0.04, 0.25), b(0.28, 0.02, -0.06, -0.05), b(0.2, -0.04, -0.03, 0.3)]);
  const g = new THREE.Group();
  [['#6c9a3e', 0], ['#94a84a', 1]].forEach(([c, v]) => {
    const ms = points.filter((_, i) => i % 2 === v).map(([x, z]) => { q.setFromAxisAngle(up, R() * 6.3); const s = 0.8 + R() * 0.5; return m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(s, s, s)).clone(); });
    if (ms.length) { const t = inst(geo, lam(c), ms); t.castShadow = false; g.add(t); }
  });
  return g;
}
// Bandada de pájaros que da vueltas sobre el parque (muy barata: 2 cajitas por pájaro)
export function birds(cx, cz, n = 6) {
  const g = new THREE.Group(), list = [], body = lam('#3a3a44'), wing = lam('#4a4a56');
  for (let i = 0; i < n; i++) {
    const b = new THREE.Group(); const bd = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.22), body); b.add(bd);
    const wl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.015, 0.1).translate(-0.13, 0, 0), wing), wr = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.015, 0.1).translate(0.13, 0, 0), wing);
    b.add(wl, wr); g.add(b); list.push({ b, wl, wr, r: 6 + (i % 3) * 1.4 + Math.random(), h: 6 + Math.random() * 1.5, ph: i * 0.55, sp: 0.16 + Math.random() * 0.03 });
  }
  return { group: g, update(t) {
    for (const o of list) { const a = t * o.sp + o.ph; o.b.position.set(cx + Math.cos(a) * o.r, o.h + Math.sin(t * 0.7 + o.ph) * 0.3, cz + Math.sin(a) * o.r); o.b.rotation.y = -a; const f = Math.sin(t * 9 + o.ph * 3) * 0.6; o.wl.rotation.z = f; o.wr.rotation.z = -f; }
  } };
}

// ---------- aspecto realista: texturas fotográficas (Poly Haven, CC0) y cielo real ----------
const loader = new THREE.TextureLoader();
const TEX = new URL('./tex/', import.meta.url).href;
function photoSrc(name) {
  return once('ph-' + name, () => {
    const d = loader.load(TEX + name + '_d.jpg'); d.colorSpace = THREE.SRGBColorSpace; d.wrapS = d.wrapT = THREE.RepeatWrapping; d.anisotropy = 8;
    const n = loader.load(TEX + name + '_n.jpg'); n.wrapS = n.wrapT = THREE.RepeatWrapping;
    return { d, n };
  });
}
// Material con foto y relieve. rep: veces que se repite (x, y). color tiñe la foto.
export function photoMat(name, rx = 1, ry = rx, { color = '#ffffff', rough = 0.95, normal = 0.9 } = {}) {
  const k = `pm-${name}-${rx}-${ry}-${color}`;
  return once(k, () => { const s = photoSrc(name); const d = s.d.clone(), n = s.n.clone(); d.repeat.set(rx, ry); n.repeat.set(rx, ry);
    return new THREE.MeshStandardMaterial({ map: d, normalMap: n, normalScale: new THREE.Vector2(normal, normal), roughness: rough, metalness: 0, color }); });
}
// Cielo fotográfico de fondo y como luz ambiental (reflejos y sombras suaves naturales)
export function realSky(eng, fogColor = '#c9d6df') {
  const sc = eng.scene; sc.fog = new THREE.Fog(fogColor, 38, 120);
  loader.load(TEX + 'sky.jpg', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping; t.colorSpace = THREE.SRGBColorSpace;
    sc.background = t; const pm = new THREE.PMREMGenerator(eng.gl); sc.environment = pm.fromEquirectangular(t).texture; pm.dispose();
    sc.environmentIntensity = 0.75; eng.dirty = true; eng.shadowsDirty?.();
  });
}
// Degradado opaco (gris) para usar como transparencia del camino de tierra junto a la valla
const edgeAlpha = () => once('edgeA', () => { const t = tex(64, (x, s) => { const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#d0d0d0'); g.addColorStop(0.5, '#707070'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(0, 0, s, s); }); t.colorSpace = THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t; });
const REAL_FENCE = {
  granja: { wood: '#ffffff', post: '#e8dccb' }, sabana: { wood: '#e8d2b0', post: '#d8c0a0' }, selva: { wood: '#c8d8a0', post: '#b8c890' },
  artico: { stone: true }, humedal: { wood: '#d8cfc0', post: '#c8bca8' }, bosque: { wood: '#a88e74', post: '#988068' },
};
export let REAL = false;
export function setReal(v) { REAL = v; }
export function enclosureBaseReal(e) {
  const g = new THREE.Group(), n = e.n, cx = e.x + n / 2, cz = e.z + n / 2;
  const TINT = { sabana: '#f0d6a0', granja: '#d8ecb0', bosque: '#e8f0d0', selva: '#d8f0c0', humedal: '#e0ecd8', artico: '#ffffff' };
  const top = photoMat(e.biome, n / 1.5, n / 1.5, { color: TINT[e.biome] || '#fff' }), side = photoMat('dirt', n / 2, 0.15);
  const ground = new THREE.Mesh(new THREE.BoxGeometry(n - 0.04, 0.06, n - 0.04), [side, side, top, side, side, side]);
  ground.position.set(cx, 0.03, cz); ground.receiveShadow = true; g.add(ground);
  const w = Math.min(0.6, n * 0.12);
  const em = new THREE.MeshStandardMaterial({ map: photoSrc('dirt').d.clone(), alphaMap: edgeAlpha(), transparent: true, depthWrite: false, roughness: 1, color: e.biome === 'artico' ? '#e8eef2' : '#ffffff', polygonOffset: true, polygonOffsetFactor: -1 });
  em.map.repeat.set(n / 1.2, w / 1.2);
  for (const [px, pz, ry] of [[cx, e.z + w / 2, 0], [cx, e.z + n - w / 2, Math.PI], [e.x + w / 2, cz, -Math.PI / 2], [e.x + n - w / 2, cz, Math.PI / 2]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(n - 0.06, w), em); p.rotation.set(-Math.PI / 2, 0, ry); p.position.set(px, 0.062, pz); p.renderOrder = 1; p.receiveShadow = true; g.add(p);
  }
  // valla de madera (postes redondos y travesaños de tabla); en el ártico, de piedra y madera clara
  const F = REAL_FENCE[e.biome] || REAL_FENCE.granja;
  const postM = F.stone ? photoMat('stone', 0.4, 1.2, { color: '#f0eee8' }) : photoMat('bark', 0.5, 1.5, { color: F.post });
  const railM = F.stone ? photoMat('wood', 1, 0.2, { color: '#f2ece2' }) : photoMat('wood', 1, 0.2, { color: F.wood });
  const postG = once('rpost', () => new THREE.CylinderGeometry(0.055, 0.065, 0.95, 10).translate(0, 0.47, 0));
  const railG = once('rrail', () => new RoundedBoxGeometry(1, 0.1, 0.045, 2, 0.015));
  const posts = [], rails = [], seen = new Set(), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i <= n; i++) for (const [x, z] of [[e.x + i, e.z], [e.x + i, e.z + n], [e.x, e.z + i], [e.x + n, e.z + i]]) { const k = x + ',' + z; if (seen.has(k)) continue; seen.add(k); q.setFromAxisAngle(up, (x * 13 + z * 7) % 6.28); posts.push(m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 0.95 + ((x * 7 + z * 3) % 5) * 0.02, 1)).clone()); }
  for (let i = 0; i < n; i++) for (const [x, z, rot] of [[e.x + i + 0.5, e.z, 0], [e.x + i + 0.5, e.z + n, 0], [e.x, e.z + i + 0.5, Math.PI / 2], [e.x + n, e.z + i + 0.5, Math.PI / 2]]) {
    q.setFromAxisAngle(up, rot); for (const y of [0.34, 0.68]) rails.push(m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(1.02, 1, 1)).clone());
  }
  g.add(inst(postG, postM, posts), inst(railG, railM, rails));
  return g;
}
export function pathMeshReal(tiles, isPath, skip = () => false) {
  const g = new THREE.Group(); if (!tiles.length) return g;
  const top = photoMat('path', 1), side = photoMat('stone', 1, 0.1);
  const slab = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.06, 1), [side, side, top, side, side, side], tiles.length);
  const m4 = new THREE.Matrix4(); tiles.forEach(([x, z], i) => { m4.makeTranslation(x + 0.5, 0.03, z + 0.5); slab.setMatrixAt(i, m4); }); slab.receiveShadow = true; g.add(slab);
  const curb = [], q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  for (const [x, z] of tiles) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (isPath(x + dx, z + dz) || skip(x + dx, z + dz)) continue; q.setFromAxisAngle(up, dx ? Math.PI / 2 : 0); curb.push(m4.compose(new THREE.Vector3(x + 0.5 + dx * 0.47, 0.045, z + 0.5 + dz * 0.47), q, new THREE.Vector3(1.0, 0.9, 0.3)).clone()); }
  if (curb.length) { const c = inst(geos().curb, photoMat('stone', 1, 0.15, { color: '#e8e2d6' }), curb); c.castShadow = false; g.add(c); }
  return g;
}
export function gateReal() {
  const g = new THREE.Group(); const stone = photoMat('stone', 0.6, 1.6), stoneS = photoMat('stone', 0.6, 0.3, { color: '#d8d0c0' }), wood = photoMat('wood', 1.5, 0.3, { color: '#c8a888' });
  for (const sx of [-0.95, 0.95]) {
    const p = new THREE.Mesh(new RoundedBoxGeometry(0.46, 1.9, 0.46, 2, 0.03), stone); p.position.set(sx, 0.95, 0); g.add(p);
    const c = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.14, 0.56, 2, 0.03), stoneS); c.position.set(sx, 1.97, 0); g.add(c);
  }
  const beam = new THREE.Mesh(new RoundedBoxGeometry(2.5, 0.22, 0.26, 2, 0.04), wood); beam.position.set(0, 1.72, 0); g.add(beam);
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 150; const x = cv.getContext('2d');
  x.fillStyle = '#3c2a1c'; x.fillRect(0, 0, 512, 150); x.fillStyle = '#f2e6cc'; x.font = '900 70px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SANTUARIO', 256, 80);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const board = new THREE.Mesh(new RoundedBoxGeometry(1.5, 0.44, 0.07, 2, 0.02), [wood, wood, wood, wood, new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }), wood]); board.position.set(0, 2.08, 0.02); g.add(board);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
