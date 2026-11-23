// Arrecife: cría peces, cuida los acuarios y lleva tu tienda.
import { Engine, THREE, mat, blob, box, canvasTexture } from '../shared/engine3d.js';
import { $, esc, eur, icon, toast, modal, closeModal, modalOpen, info, confirm, Sheet, store } from '../shared/ui.js';
import { COLORS, PATTERNS, FINS, TOTAL_COMBOS, DECOS, UPGRADES, MAX_TANKS, TANK_CAP, TANK_PRICE, FISH_NAMES } from './data.js';

const KEY = 'arrecife_save_v1';
const SPEEDS = [0, 1, 3, 8];
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[ri(a.length)];
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const hourOf = (t) => (t % 1440) / 60, dayOf = (t) => Math.floor(t / 1440);

// ---------- estado ----------
function newTank(id) { return { id, deco: [], clean: 100, temp: 25, food: 70, breeding: null }; }
function newShop() {
  const st = { v: 1, nextId: 1, money: 500, time: 9 * 60, lastHour: 9, speed: 1, rep: 0, tanks: [], fish: [], discovered: [], requests: [], upgrades: [], sold: 0, lastSaved: Date.now() };
  st.tanks.push(newTank('t' + st.nextId++));
  for (let i = 0; i < 4; i++) addFish(st, st.tanks[0].id, commonGenes(), i % 2 ? 'm' : 'f', true);
  return st;
}
const commonGenes = () => ({ c: ri(4), p: ri(2), f: Math.random() < 0.8 ? 0 : 1, s: rnd(0.85, 1.1), glow: false });
function addFish(st, tank, g, sex, adult = false) {
  const f = { id: 'f' + st.nextId++, tank, g, sex: sex || (Math.random() < 0.5 ? 'm' : 'f'), born: st.time - (adult ? 2000 : 0), adult, health: 100, name: pick(FISH_NAMES) };
  st.fish.push(f); discover(st, g); return f;
}
const keyOf = (g) => `${g.c}-${g.p}-${g.f}`;
function discover(st, g) {
  const k = keyOf(g); if (st.discovered.includes(k)) return false;
  st.discovered.push(k);
  if (st.discovered.length > 4) { toast(`¡Nueva variedad descubierta: ${speciesName(g)}!`, 'good', 'sparkle'); }
  if (st.discovered.length % 10 === 0) { st.money += 150; st.rep += 2; toast(`Álbum: ${st.discovered.length} variedades. Premio de 150 €`, 'good', 'star'); }
  return true;
}
let st = store.load(KEY) || newShop();
const tankOf = (id) => st.tanks.find((t) => t.id === id);
const fishIn = (t) => st.fish.filter((f) => f.tank === t.id);
const has = (u) => st.upgrades.includes(u);

export function speciesName(g) { return `${FINS[g.f].short} ${PATTERNS[g.p].label} ${COLORS[g.c].label}${g.glow ? ' luminoso' : ''}`; }
function rarity(g) { return COLORS[g.c].r * PATTERNS[g.p].r * FINS[g.f].r * (g.glow ? 4 : 1); }
function tankHappy(t) {
  const n = fishIn(t).length; const deco = t.deco.reduce((s, d) => s + DECOS[d].happy, 0);
  return clamp(30 + Math.min(40, deco) + (has('luces') ? 10 : 0) + (t.clean - 50) * 0.3 - Math.max(0, n - 6) * 6);
}
function price(f) { const t = tankOf(f.tank); return Math.round(12 * rarity(f.g) * f.g.s * (f.adult ? 1 : 0.5) * (0.5 + f.health / 200) * (0.8 + (t ? tankHappy(t) : 50) / 250)); }
const idealTemp = (t) => t.temp >= 23.5 && t.temp <= 27.5;

// ---------- genética ----------
function inherit(a, b) {
  const g = { c: pick([a.c, b.c]), p: pick([a.p, b.p]), f: pick([a.f, b.f]), s: clamp((a.s + b.s) / 2 + rnd(-0.08, 0.1), 0.75, 1.4), glow: false };
  const mut = has('luces') ? 0.14 : 0.1;
  if (Math.random() < mut) g.c = ri(COLORS.length);
  if (Math.random() < mut) g.p = ri(PATTERNS.length);
  if (Math.random() < mut * 0.8) g.f = ri(FINS.length);
  g.glow = (a.glow || b.glow) ? Math.random() < 0.4 : Math.random() < 0.02;
  return g;
}

// ---------- simulación ----------
function tick(dt) {
  st.time += dt;
  const hr = Math.floor(st.time / 60);
  while (st.lastHour < hr) { st.lastHour++; hourly(st.lastHour % 24); }
  for (const t of st.tanks) {
    const n = fishIn(t).length;
    t.clean = clamp(t.clean - 0.0045 * n * dt * (has('filtro') ? 0.5 : 1));
    t.food = clamp(t.food - 0.012 * n * dt);
    t.temp += ((has('calefactor') ? 25.5 : 25 + Math.sin(st.time / 400) * 3.5) - t.temp) * 0.01 * dt;
    if (t.breeding && st.time >= t.breeding.until) hatch(t);
  }
  for (const f of st.fish) {
    const t = tankOf(f.tank); if (!t) continue;
    const bad = (t.food < 15 ? 1 : 0) + (t.clean < 30 ? 1 : 0) + (idealTemp(t) ? 0 : 1);
    f.health = clamp(f.health + (bad ? -0.03 * bad : 0.02) * dt);
    if (!f.adult && st.time - f.born > 720) { f.adult = true; toast(`${f.name} ya es adulto/a`, 'good', 'fish'); }
    if (f.health <= 0) { st.fish = st.fish.filter((q) => q !== f); toast(`${f.name} no ha sobrevivido. Cuida la comida, el agua y la temperatura.`, 'bad', 'fish'); }
  }
}
function hourly(h) {
  if (h % 3 === 0 && st.requests.length < 3) newRequest();
  st.requests = st.requests.filter((r) => r.until > st.time);
  if (has('comedero') && h === 10) st.tanks.forEach((t) => (t.food = Math.max(t.food, 80)));
  if (h === 21) endOfDay();
}
function newRequest() {
  const want = {}; const n = 1 + (Math.random() < 0.5 ? 1 : 0) + (st.rep > 8 && Math.random() < 0.4 ? 1 : 0);
  const keys = ['c', 'p', 'f'].sort(() => Math.random() - 0.5).slice(0, n);
  for (const k of keys) want[k] = ri(k === 'c' ? COLORS.length : k === 'p' ? PATTERNS.length : FINS.length);
  if (st.rep > 15 && Math.random() < 0.15) want.glow = true;
  const r = (want.c != null ? COLORS[want.c].r : 1.3) * (want.p != null ? PATTERNS[want.p].r : 1.2) * (want.f != null ? FINS[want.f].r : 1.2) * (want.glow ? 4 : 1);
  st.requests.push({ id: 'r' + st.nextId++, want, price: Math.round(18 * r * (1.6 + st.rep / 40)), until: st.time + 1440, who: pick(['Lucía', 'Marcos', 'Elena', 'Javier', 'Noa', 'Pablo', 'Irene', 'Hugo', 'Sara', 'Leo']) });
}
const matches = (f, w) => f.adult && (w.c == null || f.g.c === w.c) && (w.p == null || f.g.p === w.p) && (w.f == null || f.g.f === w.f) && (!w.glow || f.g.glow);
function wantText(w) {
  const parts = []; if (w.f != null) parts.push(FINS[w.f].label.toLowerCase()); if (w.p != null) parts.push(PATTERNS[w.p].label); if (w.c != null) parts.push(COLORS[w.c].label); if (w.glow) parts.push('luminoso');
  return 'Un pez ' + parts.join(', ');
}
function hatch(t) {
  const a = st.fish.find((f) => f.id === t.breeding.a), b = st.fish.find((f) => f.id === t.breeding.b); t.breeding = null;
  if (!a || !b) return;
  const room = TANK_CAP - fishIn(t).length; const n = Math.min(room, 2 + ri(has('luces') ? 3 : 2));
  if (n <= 0) return toast('No había sitio en el acuario para las crías', 'warn', 'egg');
  const names = [];
  for (let i = 0; i < n; i++) { const g = inherit(a.g, b.g); const f = addFish(st, t.id, g); names.push(speciesName(g)); }
  toast(`¡Han nacido ${n} alevines! ${names.slice(0, 2).join(', ')}${n > 2 ? '…' : ''}`, 'good', 'egg');
}
function endOfDay() { st.rep = Math.max(0, st.rep - 0.2); save(); }
function save() { st.lastSaved = Date.now(); store.save(KEY, st); }
function offline() {
  const mins = Math.min((Date.now() - st.lastSaved) / 1000 * 0.25, 1440); if (mins < 15) return;
  // pasa el tiempo con cuidado: sin muertes mientras no estás
  let left = mins; const deaths = st.fish.length;
  while (left > 0) { const d = Math.min(5, left); left -= d; tick(d); for (const f of st.fish) f.health = Math.max(25, f.health); for (const t of st.tanks) { t.food = Math.max(10, t.food); t.clean = Math.max(15, t.clean); } }
  info('Mientras no estabas…', `<p>Han pasado <b>${Math.round(mins / 60)} h</b> en Arrecife.</p>${st.tanks.some((t) => t.food < 30 || t.clean < 40) ? '<p>Algunos acuarios necesitan comida o limpieza.</p>' : '<p>Los peces están bien.</p>'}${st.requests.length ? `<p>Tienes <b>${st.requests.length}</b> clientes esperando.</p>` : ''}`);
}

// ---------- dibujo 3D ----------
const canvas = $('#stage');
const eng = new Engine(canvas, { target: [0, 0.8, 0.5], dist: 15, minDist: 2.2, maxDist: 60, bounds: 10, pitch: 0.55, yaw: 0.35 });
const overviewDist = () => eng.fitDist(13), tankDist = () => eng.fitDist(3.8);
eng.cam.dist = overviewDist();
const S3 = eng.scene;
const wood = canvasTexture(128, (x, s) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#c9965f' : '#bf8b55'; x.fillRect(0, i * s / 8, s, s / 8); } x.strokeStyle = 'rgba(80,40,10,0.25)'; for (let i = 0; i < 8; i++) { x.beginPath(); x.moveTo(0, i * s / 8); x.lineTo(s, i * s / 8); x.stroke(); } }, [5, 5]);
const floor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.2, 12), [mat('#8a5a35'), mat('#8a5a35'), new THREE.MeshLambertMaterial({ map: wood }), mat('#6e4528'), mat('#8a5a35'), mat('#8a5a35')]); floor.position.set(0, -0.1, 0.5); S3.add(floor);
const wallM = mat('#dcecef'); const w1 = box(16, 4, 0.2, wallM); w1.position.set(0, 2, -5.5); S3.add(w1); const w2 = box(0.2, 4, 12, mat('#cfe2e6')); w2.position.set(-8, 2, 0.5); S3.add(w2);
for (let i = 0; i < 5; i++) { const s = box(16, 0.05, 0.05, mat('#bcd8de')); s.position.set(0, 0.5 + i * 0.8, -5.38); S3.add(s); }
const counter = box(3.2, 1, 1, '#a8784a', 0.06); counter.position.set(5.2, 0.5, 4.2); S3.add(counter); const ctop = box(3.4, 0.08, 1.2, '#f4ece0', 0.03); ctop.position.set(5.2, 1.04, 4.2); S3.add(ctop);
const sign = box(4, 0.8, 0.08, '#2fa8e0', 0.06); sign.position.set(0, 3.2, -5.35); S3.add(sign);
const SLOTS = [[-4.5, -2.6], [0, -2.6], [4.5, -2.6], [-4.5, 1.4], [0, 1.4], [4.5, 1.4]];
const TW = 3, TH = 1.5, TD = 1.4, STAND = 0.75;
const tankGroups = new Map();
const patTex = new Map();
function fishTexture(g) {
  const k = `${g.c}-${g.p}`; if (patTex.has(k)) return patTex.get(k);
  const base = COLORS[g.c].hex;
  const t = canvasTexture(64, (x, s) => {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    if (g.p === 1) { x.fillStyle = 'rgba(20,20,30,0.55)'; for (let i = 0; i < 4; i++) x.fillRect(i * s / 4 + 4, 0, 5, s); }
    if (g.p === 2) { x.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 14; i++) { x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 3, 0, 7); x.fill(); } }
    if (g.p === 3) { const gr = x.createLinearGradient(0, 0, s, 0); gr.addColorStop(0, base); gr.addColorStop(1, COLORS[(g.c + 3) % COLORS.length].hex); x.fillStyle = gr; x.fillRect(0, 0, s, s); }
    x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(0, s * 0.62, s, s * 0.38);
  });
  patTex.set(k, t); return t;
}
function fishMesh(f) {
  const g = new THREE.Group(); const s = 0.13 * f.g.s * (f.adult ? 1 : 0.55);
  const m = new THREE.MeshLambertMaterial({ map: fishTexture(f.g), emissive: f.g.glow ? new THREE.Color(COLORS[f.g.c].hex).multiplyScalar(0.55) : new THREE.Color(0) });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), m); body.scale.set(s * 0.55, s * 0.75, s * 1.4); g.add(body);
  const finM = new THREE.MeshLambertMaterial({ color: COLORS[f.g.c].hex, transparent: true, opacity: 0.85, side: THREE.DoubleSide, emissive: m.emissive });
  const tl = [0.9, 1.4, 2.0][f.g.f];
  const tail = new THREE.Mesh(new THREE.ConeGeometry(s * 0.6 * tl, s * 1.1 * tl, 3), finM); tail.rotation.x = -Math.PI / 2; tail.scale.set(0.15, 1, 1); tail.position.z = -s * (1.3 + 0.4 * tl);
  const tailPivot = new THREE.Group(); tailPivot.position.z = -s * 1.1; tail.position.z = -s * 0.5 * tl; tailPivot.add(tail); g.add(tailPivot);
  const dorsal = new THREE.Mesh(new THREE.ConeGeometry(s * 0.35 * tl, s * 0.6 * tl, 3), finM); dorsal.scale.set(0.15, 1, 1); dorsal.position.set(0, s * 0.85, -s * 0.1); g.add(dorsal);
  for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(s * 0.14, 6, 5), mat('#111')); e.position.set(sd * s * 0.42, s * 0.18, s * 0.95); g.add(e); }
  g.userData.fish = f.id;
  return { g, tail: tailPivot, x: rnd(-1, 1), y: rnd(0.3, 1.1), z: rnd(-0.4, 0.4), tx: 0, ty: 0.6, tz: 0, sp: rnd(0.25, 0.5) };
}
function decoMesh(type, i) {
  const g = new THREE.Group(); const x = -1.1 + (i % 5) * 0.55, z = -0.35 + (i % 2) * 0.3; g.position.set(x, 0.12, z);
  if (type === 'planta') for (let k = 0; k < 4; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.6 + k * 0.1, 4), mat('#3a9a5a')); l.position.set(k * 0.05 - 0.07, 0.3, 0); l.rotation.z = (k - 1.5) * 0.15; g.add(l); }
  if (type === 'roca') for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1 + k * 0.03, 0), mat('#8a8a90')); r.position.set(k * 0.12 - 0.12, 0.08, (k % 2) * 0.08); g.add(r); }
  if (type === 'castillo') { const b = box(0.35, 0.35, 0.3, '#d8c8a8'); b.position.y = 0.17; g.add(b); for (const sx of [-0.15, 0.15]) { const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), mat('#d0c0a0')); tw.position.set(sx, 0.25, 0); g.add(tw); const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.15, 8), mat('#c05a4a')); c.position.set(sx, 0.57, 0); g.add(c); } }
  if (type === 'cofre') { const b = box(0.3, 0.16, 0.2, '#8a5a2a', 0.02); b.position.y = 0.08; g.add(b); const lid = box(0.3, 0.06, 0.2, '#a06a32'); lid.position.set(0, 0.2, -0.05); lid.rotation.x = -0.6; g.add(lid); const gold = box(0.24, 0.05, 0.14, '#f5c842'); gold.position.y = 0.17; g.add(gold); }
  if (type === 'burbujas') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.12, 8), mat('#555')); b.position.y = 0.06; g.add(b); g.userData.bubbles = true; }
  if (type === 'coral') for (let k = 0; k < 5; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.3 + k * 0.05, 5), mat(pick(['#f07a6a', '#f5a0c0', '#f5c06a']))); c.position.set(Math.cos(k) * 0.08, 0.15, Math.sin(k) * 0.08); c.rotation.z = (k - 2) * 0.3; g.add(c); }
  return g;
}
function buildTank(t, i) {
  const [x, z] = SLOTS[i]; const g = new THREE.Group(); g.position.set(x, 0, z); g.userData.tank = t.id; S3.add(g);
  const stand = box(TW + 0.2, STAND, TD + 0.2, '#7a5232', 0.04); stand.position.y = STAND / 2; g.add(stand);
  const inner = new THREE.Group(); inner.position.y = STAND + 0.02; g.add(inner);
  const sand = box(TW - 0.06, 0.12, TD - 0.06, '#e8d4a0'); sand.position.y = 0.06; inner.add(sand);
  const water = new THREE.Mesh(new THREE.BoxGeometry(TW - 0.06, TH - 0.15, TD - 0.06), new THREE.MeshLambertMaterial({ color: 0x5ab4e8, transparent: true, opacity: 0.28, depthWrite: false })); water.position.y = (TH - 0.15) / 2 + 0.04; inner.add(water);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(TW, TH, TD), new THREE.MeshLambertMaterial({ color: 0xdff2fa, transparent: true, opacity: 0.12, depthWrite: false })); glass.position.y = TH / 2; inner.add(glass);
  const rim = box(TW + 0.04, 0.06, TD + 0.04, '#2a2f45'); rim.position.y = TH; inner.add(rim);
  const lamp = box(TW * 0.9, 0.06, 0.25, has('luces') ? '#ffe8a0' : '#3a3f55'); lamp.position.y = TH + 0.06; inner.add(lamp);
  g.add(blob(TW + 0.8, TD + 0.8, 0.35));
  const rec = { g, inner, water, fish: new Map(), deco: new THREE.Group(), bubbles: [], sig: '' }; inner.add(rec.deco);
  tankGroups.set(t.id, rec); return rec;
}
function syncTanks(t0) {
  const seen = new Set();
  st.tanks.forEach((t, i) => {
    seen.add(t.id); let rec = tankGroups.get(t.id) || buildTank(t, i);
    const dsig = t.deco.join(',');
    if (dsig !== rec.sig) {
      rec.sig = dsig; rec.deco.clear(); rec.bubbles = [];
      t.deco.forEach((d, k) => { const m = decoMesh(d, k); rec.deco.add(m); if (m.userData.bubbles) for (let b = 0; b < 6; b++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), mat('#e8f6ff', { opacity: 0.7 })); s.userData.o = b / 6; s.userData.x = m.position.x; s.userData.z = m.position.z; rec.deco.add(s); rec.bubbles.push(s); } });
    }
    // agua más verde si está sucia
    rec.water.material.color.setHSL(0.55 - (100 - t.clean) * 0.0016, 0.6, 0.6 - (100 - t.clean) * 0.002);
    for (const b of rec.bubbles) { const k = (t0 * 0.4 + b.userData.o) % 1; b.position.set(b.userData.x + Math.sin(k * 9) * 0.03, 0.15 + k * (TH - 0.3), b.userData.z); }
    // peces
    const ids = new Set();
    for (const f of fishIn(t)) {
      ids.add(f.id); let m = rec.fish.get(f.id);
      if (!m || m.adult !== f.adult) { if (m) rec.inner.remove(m.g); m = fishMesh(f); m.adult = f.adult; rec.fish.set(f.id, m); rec.inner.add(m.g); }
    }
    for (const [k, m] of rec.fish) if (!ids.has(k)) { rec.inner.remove(m.g); rec.fish.delete(k); }
  });
  for (const [k, rec] of tankGroups) if (!seen.has(k)) { S3.remove(rec.g); tankGroups.delete(k); }
}
let lastSwim = 0;
function swim(t) {
  const dt = Math.min(0.2, t - (lastSwim || t)); lastSwim = t;
  for (const [tid, rec] of tankGroups) {
    const tank = tankOf(tid); const lively = tank && tank.food > 15 ? 1 : 0.5;
    for (const [fid, m] of rec.fish) {
      const f = st.fish.find((q) => q.id === fid); const sick = f && f.health < 40;
      if (Math.hypot(m.tx - m.x, m.ty - m.y, m.tz - m.z) < 0.08 || Math.random() < 0.003) { m.tx = rnd(-(TW / 2 - 0.35), TW / 2 - 0.35); m.ty = rnd(0.3, TH - 0.35); m.tz = rnd(-(TD / 2 - 0.3), TD / 2 - 0.3); }
      const dx = m.tx - m.x, dy = m.ty - m.y, dz = m.tz - m.z, d = Math.hypot(dx, dy, dz) || 1;
      const sp = m.sp * lively * (sick ? 0.4 : 1) * dt;
      m.x += dx / d * sp; m.y += dy / d * sp * 0.6; m.z += dz / d * sp;
      m.g.position.set(m.x, m.y + Math.sin(t * 2 + m.sp * 10) * 0.02, m.z);
      const yaw = Math.atan2(dx, dz); let a = yaw - m.g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); m.g.rotation.y += a * Math.min(1, dt * 4);
      m.g.rotation.z = sick ? 0.9 : 0;
      m.tail.rotation.y = Math.sin(t * (8 + m.sp * 6)) * 0.45;
    }
  }
}
eng.onBeforeRender = (t) => { syncTanks(t); swim(t); };
// luz según la hora
function light() { const h = hourOf(st.time); const night = h < 7 || h >= 21; eng.hemi.intensity = night ? 0.6 : 1.1; eng.sun.intensity = night ? 0.4 : 1.5; document.body.style.background = night ? 'linear-gradient(#1a2148,#3b3f72)' : 'linear-gradient(#bfe6f0,#eaf6f8)'; }

// ---------- interfaz ----------
const sheet = new Sheet();
let focusTank = null;
const selected = new Set();
function hud() {
  $('#money b').textContent = eur(st.money);
  const h = hourOf(st.time);
  $('#clock .t b').textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(st.time % 60)).padStart(2, '0')}`;
  $('#clock .t span').textContent = `Día ${dayOf(st.time) + 1} · ${st.fish.length} peces · ${st.discovered.length}/${TOTAL_COMBOS} variedades`;
  $('#rep b').textContent = `${Math.floor(st.rep)}`;
  document.querySelectorAll('#speeds button').forEach((b) => b.classList.toggle('on', +b.dataset.s === st.speed));
  document.querySelectorAll('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.t === sheet.name));
  const badge = $('#tools [data-t="clients"] .dot'); if (badge) badge.hidden = !st.requests.length;
  light();
}
function geneChips(g) { return `<span class="chip" style="background:${COLORS[g.c].hex};color:${g.c >= 7 || g.c === 2 ? '#333' : '#fff'}">${COLORS[g.c].label}</span><span class="chip">${PATTERNS[g.p].label}</span><span class="chip">${FINS[g.f].short}</span>${g.glow ? '<span class="chip gold">luminoso</span>' : ''}`; }
function openTank(tid) {
  focusTank = tid; selected.clear();
  const i = st.tanks.findIndex((t) => t.id === tid); const [x, z] = SLOTS[i]; eng.focus(x, z + 0.3, tankDist() * 0.9); eng.cam.target.y = -0.55; eng.cam.pitch = 0.2; eng.cam.yawT = 0.12;
  sheet.open('tank', `Acuario ${i + 1}`); renderPanel(); hud();
}
function openPanel(name) {
  if (sheet.name === name) return sheet.close();
  focusTank = null; eng.focus(0, 0.5, overviewDist()); eng.cam.target.y = 0.8; eng.cam.pitch = 0.55;
  sheet.open(name, { buy: 'Comprar', clients: 'Clientes', album: 'Álbum de variedades', shop: 'Mejoras de la tienda', info: 'Arrecife' }[name]); renderPanel(); hud();
}
function stat(ic, color, label, v, txt) { return `<div class="stat"><span class="tile" style="background:${color}">${icon(ic)}</span><span>${label}</span><div style="display:flex;gap:8px;align-items:center"><div class="bar"><i style="transform:scaleX(${v / 100});background:${v < 30 ? '#e5484d' : color}"></i></div>${txt ? `<b style="font-size:12px;min-width:38px">${txt}</b>` : ''}</div></div>`; }
function renderPanel() {
  const b = sheet.body; const name = sheet.name;
  if (name === 'tank') {
    const t = tankOf(focusTank); if (!t) return sheet.close(); const fs = fishIn(t);
    b.innerHTML = `${stat('food', '#f08a3c', 'Comida', t.food)}${stat('drop', '#2fa8e0', 'Agua limpia', t.clean)}${stat('thermo', idealTemp(t) ? '#25c48f' : '#e5484d', 'Temperatura', clamp((t.temp - 18) * 7), `${t.temp.toFixed(1)}°`)}${stat('heart', '#e0559a', 'Ánimo', tankHappy(t))}
      <div class="row" style="margin:8px 0"><button class="btn coral" id="feed">${icon('food')} Comida · 2 €</button><button class="btn alt" id="clean">${icon('drop')} Limpiar · 20 €</button></div>
      ${!has('calefactor') ? `<div class="row"><button class="btn alt sm" id="tdown">− Enfriar</button><span class="hint" style="flex:1;text-align:center;align-self:center">Ideal: 24–27 °C</span><button class="btn alt sm" id="tup">+ Calentar</button></div>` : '<p class="hint">El calefactor mantiene la temperatura perfecta.</p>'}
      ${t.breeding ? `<div class="card"><b>${icon('egg')} Hay huevos</b><div class="hint">Eclosionarán en ${Math.max(1, Math.round((t.breeding.until - st.time)))} min de juego</div></div>` : ''}
      <div class="sec">${icon('fish')} Peces (${fs.length}/${TANK_CAP})</div>
      <p class="hint">Marca un macho y una hembra adultos para criar. Las crías mezclan los rasgos de los padres y a veces sale algo nuevo.</p>
      <div class="list">${fs.map((f) => `<div class="li"><input type="checkbox" data-sel="${f.id}" ${selected.has(f.id) ? 'checked' : ''} ${f.adult ? '' : 'disabled'} style="width:20px;height:20px"><div style="flex:1;min-width:0"><b>${esc(f.name)}</b> <span class="hint">${f.sex === 'm' ? '♂' : '♀'} · ${f.adult ? 'adulto' : 'alevín'}${f.health < 40 ? ' · enfermo' : ''}</span><div class="chips" style="margin-top:4px">${geneChips(f.g)}</div></div><div style="display:flex;flex-direction:column;gap:4px"><button class="btn sm mint" data-sell="${f.id}">${eur(price(f))}</button><button class="btn sm alt" data-move="${f.id}">Mover</button></div></div>`).join('') || '<p class="hint">Este acuario está vacío. Compra peces en Comprar.</p>'}</div>
      <button class="btn" id="breed" style="width:100%;margin-top:6px" ${selected.size === 2 && !t.breeding ? '' : 'disabled'}>${icon('egg')} Criar con los dos marcados</button>
      <div class="sec">${icon('sparkle')} Decoración</div><div class="chips">${t.deco.map((d) => `<span class="chip">${DECOS[d].label}</span>`).join('') || '<span class="hint">Sin decoración</span>'}</div>
      <div class="grid" style="margin-top:8px">${Object.entries(DECOS).map(([k, d]) => `<button class="item" data-deco="${k}" ${t.deco.length >= 8 ? 'disabled' : ''}><span class="tilebox">${icon(d.ic)}</span>${d.label}<span class="p">${eur(d.price)}</span></button>`).join('')}</div>`;
    b.querySelector('#feed').onclick = () => { if (st.money < 2) return; st.money -= 2; t.food = clamp(t.food + 45); renderPanel(); hud(); };
    b.querySelector('#clean').onclick = () => { if (st.money < 20) return toast('No hay dinero suficiente', 'warn'); st.money -= 20; t.clean = 100; renderPanel(); hud(); };
    const td = b.querySelector('#tdown'), tu = b.querySelector('#tup'); if (td) td.onclick = () => { t.temp -= 1; renderPanel(); }; if (tu) tu.onclick = () => { t.temp += 1; renderPanel(); };
    b.querySelectorAll('[data-sel]').forEach((c) => (c.onchange = () => { c.checked ? selected.add(c.dataset.sel) : selected.delete(c.dataset.sel); if (selected.size > 2) selected.delete([...selected][0]); renderPanel(); }));
    b.querySelector('#breed').onclick = () => {
      const [a, c] = [...selected].map((id) => st.fish.find((f) => f.id === id));
      if (!a || !c || a.sex === c.sex) return toast('Hace falta un macho y una hembra', 'warn');
      if (fishIn(t).length >= TANK_CAP) return toast('El acuario está lleno: vende o mueve algún pez', 'warn');
      if (tankHappy(t) < 35) return toast('Los peces no están a gusto: decora y limpia el agua', 'warn');
      t.breeding = { a: a.id, b: c.id, until: st.time + 90 }; selected.clear(); toast(`${a.name} y ${c.name} han puesto huevos`, 'good', 'egg'); renderPanel(); save();
    };
    b.querySelectorAll('[data-sell]').forEach((x) => (x.onclick = () => { const f = st.fish.find((q) => q.id === x.dataset.sell); const p = price(f); confirm(`¿Vender a ${f.name} por ${eur(p)}?`, () => { st.money += p; st.fish = st.fish.filter((q) => q !== f); st.sold++; renderPanel(); hud(); save(); }); }));
    b.querySelectorAll('[data-move]').forEach((x) => (x.onclick = () => moveFish(x.dataset.move)));
    b.querySelectorAll('[data-deco]').forEach((x) => (x.onclick = () => { const d = DECOS[x.dataset.deco]; if (st.money < d.price) return toast('No hay dinero suficiente', 'warn'); st.money -= d.price; t.deco.push(x.dataset.deco); renderPanel(); hud(); save(); }));
  }
  if (name === 'buy') {
    const n = st.tanks.length;
    b.innerHTML = `<div class="sec">Peces del proveedor</div><div class="list">
      <button class="li" id="b1"><span class="tilebox">${icon('fish')}</span><div style="flex:1"><b>Pez común</b><div class="hint">Colores y aletas sencillos</div></div><b>15 €</b></button>
      <button class="li" id="b2"><span class="tilebox">${icon('egg')}</span><div style="flex:1"><b>Huevo sorpresa</b><div class="hint">Puede salir algo poco común</div></div><b>60 €</b></button></div>
      <div class="sec">Acuarios</div><button class="li" id="bt" style="width:100%" ${n >= MAX_TANKS ? 'disabled' : ''}><span class="tilebox">${icon('box')}</span><div style="flex:1;text-align:left"><b>Nuevo acuario</b><div class="hint">${n}/${MAX_TANKS} acuarios</div></div><b>${n >= MAX_TANKS ? 'Completo' : eur(TANK_PRICE(n))}</b></button>`;
    const target = () => st.tanks.find((t) => fishIn(t).length < TANK_CAP);
    b.querySelector('#b1').onclick = () => { const t = target(); if (!t) return toast('Todos los acuarios están llenos', 'warn'); if (st.money < 15) return toast('No hay dinero suficiente', 'warn'); st.money -= 15; const f = addFish(st, t.id, commonGenes(), null, true); toast(`${f.name} (${speciesName(f.g)}) llega al acuario ${st.tanks.indexOf(t) + 1}`, 'good', 'fish'); hud(); save(); };
    b.querySelector('#b2').onclick = () => { const t = target(); if (!t) return toast('Todos los acuarios están llenos', 'warn'); if (st.money < 60) return toast('No hay dinero suficiente', 'warn'); st.money -= 60; const g = { c: ri(COLORS.length), p: ri(PATTERNS.length), f: ri(FINS.length), s: rnd(0.9, 1.2), glow: Math.random() < 0.04 }; const f = addFish(st, t.id, g); toast(`Del huevo ha salido: ${speciesName(g)}`, 'good', 'egg'); hud(); save(); };
    b.querySelector('#bt').onclick = () => { if (n >= MAX_TANKS) return; const p = TANK_PRICE(n); if (st.money < p) return toast('No hay dinero suficiente', 'warn'); st.money -= p; st.tanks.push(newTank('t' + st.nextId++)); toast('Nuevo acuario instalado', 'good', 'box'); renderPanel(); hud(); save(); };
  }
  if (name === 'clients') {
    b.innerHTML = st.requests.length ? `<div class="list">${st.requests.map((r) => { const m = st.fish.filter((f) => matches(f, r.want)); return `<div class="li"><span class="tilebox">${icon('user')}</span><div style="flex:1"><b>${esc(r.who)}</b><div class="hint">${esc(wantText(r.want))}</div><div class="hint">Caduca en ${Math.round((r.until - st.time) / 60)} h</div></div><div style="text-align:right"><b>${eur(r.price)}</b><br><button class="btn sm ${m.length ? 'mint' : 'alt'}" data-r="${r.id}" ${m.length ? '' : 'disabled'}>${m.length ? 'Entregar' : 'No tienes'}</button></div></div>`; }).join('')}</div>` : '<p class="hint">Ahora mismo no hay clientes. Vuelven cada pocas horas. Con más reputación piden peces más raros y pagan más.</p>';
    b.querySelectorAll('[data-r]').forEach((x) => (x.onclick = () => {
      const r = st.requests.find((q) => q.id === x.dataset.r); const cands = st.fish.filter((f) => matches(f, r.want)).sort((a, c) => price(a) - price(c));
      const box2 = modal(`<h2>¿Qué pez entregas?</h2><p class="hint">${esc(r.who)} pide: ${esc(wantText(r.want))}. Paga ${eur(r.price)}.</p><div class="list">${cands.map((f) => `<button class="li" data-f="${f.id}"><span class="tilebox" style="background:${COLORS[f.g.c].hex}">${icon('fish')}</span><div style="flex:1"><b>${esc(f.name)}</b><div class="chips">${geneChips(f.g)}</div></div></button>`).join('')}</div><div class="actions"><button class="btn alt" id="cx">Cancelar</button></div>`);
      box2.querySelector('#cx').onclick = closeModal;
      box2.querySelectorAll('[data-f]').forEach((y) => (y.onclick = () => { st.fish = st.fish.filter((f) => f.id !== y.dataset.f); st.money += r.price; st.rep += 1; st.sold++; st.requests = st.requests.filter((q) => q !== r); closeModal(); toast(`${r.who} se va encantado/a: +${eur(r.price)}`, 'good', 'coin'); renderPanel(); hud(); save(); }));
    }));
  }
  if (name === 'album') {
    let h = `<p class="hint"><b>${st.discovered.length} de ${TOTAL_COMBOS}</b> variedades descubiertas. Cría peces para completar el álbum: cada 10 hay premio.</p>`;
    for (let f = 0; f < FINS.length; f++) {
      h += `<div class="sec">${FINS[f].label}</div><div class="album">`;
      for (let p = 0; p < PATTERNS.length; p++) for (let c = 0; c < COLORS.length; c++) { const k = `${c}-${p}-${f}`; const on = st.discovered.includes(k); h += `<span class="cell ${on ? 'on' : ''}" title="${on ? esc(speciesName({ c, p, f })) : '?'}" style="${on ? `background:${COLORS[c].hex}` : ''}">${on ? ['', '≡', '•', '◐'][p] : '?'}</span>`; }
      h += '</div>';
    }
    b.innerHTML = h;
  }
  if (name === 'shop') {
    b.innerHTML = `<div class="list">${Object.entries(UPGRADES).map(([k, u]) => `<div class="li"><span class="tilebox">${icon(u.ic)}</span><div style="flex:1"><b>${u.label}</b><div class="hint">${u.desc}</div></div>${has(k) ? '<span class="chip good">Instalado</span>' : `<button class="btn sm" data-u="${k}">${eur(u.price)}</button>`}</div>`).join('')}</div>`;
    b.querySelectorAll('[data-u]').forEach((x) => (x.onclick = () => { const u = UPGRADES[x.dataset.u]; if (st.money < u.price) return toast('No hay dinero suficiente', 'warn'); st.money -= u.price; st.upgrades.push(x.dataset.u); tankGroups.forEach((r) => S3.remove(r.g)); tankGroups.clear(); toast(`${u.label} instalado`, 'good', u.ic); renderPanel(); hud(); save(); }));
  }
  if (name === 'info') {
    b.innerHTML = `<div class="card"><div class="stat"><span class="tile" style="background:#f5a524">${icon('star')}</span><span>Reputación</span><b>${Math.floor(st.rep)}</b></div><div class="stat"><span class="tile" style="background:#25c48f">${icon('coin')}</span><span>Peces vendidos</span><b>${st.sold}</b></div><div class="stat"><span class="tile" style="background:#8b5cf6">${icon('sparkle')}</span><span>Variedades</span><b>${st.discovered.length}/${TOTAL_COMBOS}</b></div></div>
      <p class="hint">Cuida comida, agua y temperatura de cada acuario. Si te olvidas, enferman; con la app cerrada siguen vivos pero lo pasan peor.</p>
      <div class="sec">Calidad gráfica</div><div class="seg" id="q"><button data-v="eco">Ahorro</button><button data-v="alta">Alta</button></div>
      <div class="row" style="margin-top:16px"><a class="btn alt" href="../">${icon('home')} Menú de juegos</a><button class="btn red" id="reset">${icon('trash')} Empezar de nuevo</button></div>`;
    const q = localStorage.getItem('sim_quality') || (eng.hq ? 'alta' : 'eco'); b.querySelectorAll('#q button').forEach((x) => { x.classList.toggle('on', x.dataset.v === q); x.onclick = () => { localStorage.setItem('sim_quality', x.dataset.v); save(); location.reload(); }; });
    b.querySelector('#reset').onclick = () => confirm('Se borrará tu tienda. ¿Empezar de cero?', () => { localStorage.removeItem(KEY); st = newShop(); tankGroups.forEach((r) => S3.remove(r.g)); tankGroups.clear(); sheet.close(); hud(); save(); });
  }
}
function moveFish(fid) {
  const f = st.fish.find((q) => q.id === fid);
  const box2 = modal(`<h2>Mover a ${esc(f.name)}</h2><div class="list">${st.tanks.map((t, i) => `<button class="li" data-t="${t.id}" ${t.id === f.tank || fishIn(t).length >= TANK_CAP ? 'disabled' : ''}><span class="tilebox">${icon('box')}</span><div style="flex:1"><b>Acuario ${i + 1}</b><div class="hint">${fishIn(t).length}/${TANK_CAP} peces</div></div></button>`).join('')}</div><div class="actions"><button class="btn alt" id="mx">Cancelar</button></div>`);
  box2.querySelector('#mx').onclick = closeModal;
  box2.querySelectorAll('[data-t]').forEach((x) => (x.onclick = () => { f.tank = x.dataset.t; closeModal(); renderPanel(); save(); }));
}
eng.onTap = (sx, sy) => { if (modalOpen()) return; const tid = eng.pick(sx, sy, [...tankGroups.values()].map((r) => r.g), 'tank'); if (tid) openTank(tid); };
sheet.onClose = () => { focusTank = null; eng.cam.pitch = 0.55; eng.focus(0, 0.5, overviewDist()); eng.cam.target.y = 0.8; hud(); };

document.querySelector('#speeds').innerHTML = [['pause', 0], ['play', 1], ['ff', 2], ['fff', 3]].map(([ic, s]) => `<button data-s="${s}">${icon(ic)}</button>`).join('');
document.querySelector('#speeds').onclick = (e) => { const b = e.target.closest('button'); if (b) { st.speed = +b.dataset.s; hud(); } };
document.querySelector('#tools').innerHTML = [['tanks', 'box', 'Acuarios'], ['buy', 'fish', 'Comprar'], ['clients', 'users', 'Clientes'], ['album', 'book', 'Álbum'], ['shop', 'shop', 'Mejoras'], ['info', 'chart', 'Tienda']].map(([t, ic, l]) => `<button data-t="${t}" style="position:relative">${icon(ic)}<span>${l}</span>${t === 'clients' ? '<i class="dot" hidden></i>' : ''}</button>`).join('');
document.querySelector('#tools').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.t === 'tanks') { const t = st.tanks[(st.tanks.findIndex((q) => q.id === focusTank) + 1) % st.tanks.length]; openTank(t.id); } else openPanel(b.dataset.t); };
$('#money .badge').innerHTML = icon('coin'); $('#clock .badge').innerHTML = icon('fish'); $('#rep .badge').innerHTML = icon('star'); $('#back a').innerHTML = icon('home');
$('#camctl').innerHTML = `<button class="glass" data-r="1">${icon('rotate')}</button><button class="glass" data-r="-1" style="transform:scaleX(-1)">${icon('rotate')}</button>`;
$('#camctl').onclick = (e) => { const b = e.target.closest('button'); if (b) eng.spin(+b.dataset.r * Math.PI / 6); };

let uiT = 0, saveT = 0;
eng.onFrame = (dt) => {
  const paused = modalOpen() || st.speed === 0;
  if (!paused) { let g = dt * SPEEDS[st.speed]; while (g > 0) { const s = Math.min(g, 2); tick(s); g -= s; } }
  eng.activity = focusTank ? 'busy' : 'calm';
  uiT += dt; saveT += dt;
  if (uiT > 3) { uiT = 0; hud(); if (sheet.name === 'tank' && !document.activeElement?.matches('input')) { const sc = sheet.body.scrollTop; renderPanel(); sheet.body.scrollTop = sc; } }
  if (saveT > 20) { saveT = 0; save(); }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { offline(); hud(); } });
window.addEventListener('pagehide', save);
if (store.load(KEY)) offline(); else { save(); info('Te damos la bienvenida a Arrecife', `<p>Tu tienda de peces acaba de abrir.</p><ul style="padding-left:18px;line-height:1.6"><li>Toca un <b>acuario</b> para ver sus peces, darles de comer, limpiar y decorar.</li><li><b>Cría</b> un macho y una hembra: las crías mezclan rasgos y a veces salen variedades nuevas.</li><li>Completa el <b>álbum</b> de ${TOTAL_COMBOS} variedades.</li><li>Atiende a los <b>clientes</b>: piden peces concretos y pagan bien.</li></ul>`, '¡A abrir la tienda!'); }
if (!st.requests.length) newRequest();
hud();
window.reef = { eng, get st() { return st; } };
