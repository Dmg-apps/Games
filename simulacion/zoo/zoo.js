// Parque Salvaje: gestiona tu propio parque de animales.
import { Engine, THREE, mat, blob, box, canvasTexture } from '../shared/engine3d.js';
import { $, esc, eur, icon, toast, modal, closeModal, modalOpen, info, confirm, Sheet, store } from '../shared/ui.js';
import { N, ENTRANCE, BIOMES, SIZES, SPECIES, ENRICH, BUILDINGS, PATH_PRICE, WAGES, FOOD_COST, ANIMAL_NAMES, CARNIVORES } from './data.js';

const KEY = 'parque_save_v1';
const SPEEDS = [0, 1, 3, 8]; // minutos de juego por segundo real
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const pk = (x, z) => x + ',' + z;
const hourOf = (t) => (t % 1440) / 60, dayOf = (t) => Math.floor(t / 1440);

// ---------- estado ----------
function newPark() {
  const st = { v: 1, nextId: 1, money: 12000, time: 8 * 60, lastHour: 8, speed: 1, ticket: 15, fame: 1, paths: [], enclosures: [], animals: [], buildings: [], staff: { keeper: 1, cleaner: 0 }, litter: [], today: { visitors: 0, income: 0, spent: 0 }, history: [], lastSaved: Date.now() };
  for (let z = ENTRANCE.z; z >= ENTRANCE.z - 6; z--) st.paths.push(pk(ENTRANCE.x, z));
  for (let x = ENTRANCE.x - 4; x <= ENTRANCE.x + 4; x++) if (!st.paths.includes(pk(x, ENTRANCE.z - 6))) st.paths.push(pk(x, ENTRANCE.z - 6));
  return st;
}
let st = store.load(KEY) || newPark();
const pathSet = () => new Set(st.paths);
const id = () => 'z' + st.nextId++;

// ---------- reglas ----------
function encAt(x, z) { return st.enclosures.find((e) => x >= e.x && x < e.x + e.n && z >= e.z && z < e.z + e.n); }
function buildingAt(x, z) { return st.buildings.find((b) => b.x === x && b.z === z); }
function occupied(x, z) { return pathSet().has(pk(x, z)) || encAt(x, z) || buildingAt(x, z) || (x === ENTRANCE.x && z === ENTRANCE.z); }
const inGrid = (x, z) => x >= 0 && z >= 0 && x < N && z < N;
function nextToPath(x, z) { const P = pathSet(); return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => P.has(pk(x + dx, z + dz))); }
function encTouchesPath(e) { const P = pathSet(); for (let i = -1; i <= e.n; i++) for (const [x, z] of [[e.x + i, e.z - 1], [e.x + i, e.z + e.n], [e.x - 1, e.z + i], [e.x + e.n, e.z + i]]) if (P.has(pk(x, z))) return true; return false; }
function canPlaceEnclosure(x, z, n) { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!inGrid(x + i, z + j) || occupied(x + i, z + j)) return false; return true; }
const animalsIn = (e) => st.animals.filter((a) => a.enc === e.id);
function animalHappy(a) {
  const e = st.enclosures.find((q) => q.id === a.enc); const S = SPECIES[a.sp]; if (!e) return 0;
  const mates = animalsIn(e); const same = mates.filter((m) => m.sp === a.sp).length;
  const space = (e.n * e.n) / mates.reduce((t, m) => t + SPECIES[m.sp].space * (m.baby ? 0.5 : 1), 0);
  const enrich = e.items.length;
  let h = a.hunger * 0.35 + (e.biome === S.biome ? 25 : 0) + Math.min(1, space) * 18 + Math.min(1, enrich / 3) * 12 + (S.social ? (same >= 2 ? 10 : 0) : 10);
  if (space < 0.6) h -= 15;
  return clamp(h);
}
function encHappy(e) { const as = animalsIn(e); return as.length ? as.reduce((t, a) => t + a.happy, 0) / as.length : 0; }
function stars() { return Math.round(clamp(st.fame, 0, 5) * 2) / 2; }
function decorAround(x, z) { return st.buildings.filter((b) => Math.abs(b.x - x) <= 3 && Math.abs(b.z - z) <= 3).reduce((t, b) => t + (BUILDINGS[b.type].decor || 0), 0); }

// ---------- visitantes (no se guardan) ----------
let visitors = [];
function bfsPath(from, to) {
  const P = pathSet(); const start = pk(from.x, from.z), goal = pk(to.x, to.z);
  const prev = new Map([[start, null]]); const q = [start];
  while (q.length) { const c = q.shift(); if (c === goal) break; const [cx, cz] = c.split(',').map(Number); for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = pk(cx + dx, cz + dz); if ((P.has(n) || n === goal) && !prev.has(n)) { prev.set(n, c); q.push(n); } } }
  if (!prev.has(goal)) return null;
  const path = []; let c = goal; while (c && c !== start) { const [x, z] = c.split(',').map(Number); path.unshift({ x, z }); c = prev.get(c); }
  return path;
}
function attractions() {
  // casillas de camino junto a recintos con animales o junto a edificios
  const P = pathSet(); const out = [];
  for (const e of st.enclosures) { if (!animalsIn(e).length) continue; for (let i = -1; i <= e.n; i++) for (const [x, z] of [[e.x + i, e.z - 1], [e.x + i, e.z + e.n], [e.x - 1, e.z + i], [e.x + e.n, e.z + i]]) if (P.has(pk(x, z))) out.push({ x, z, enc: e.id }); }
  for (const b of st.buildings) if (BUILDINGS[b.type].need) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (P.has(pk(b.x + dx, b.z + dz))) out.push({ x: b.x + dx, z: b.z + dz, b: b.id });
  return out;
}
function spawnVisitor() {
  if (!pathSet().has(pk(ENTRANCE.x, ENTRANCE.z - 1)) && !pathSet().has(pk(ENTRANCE.x, ENTRANCE.z))) return;
  const v = { id: Math.random(), x: ENTRANCE.x, z: ENTRANCE.z, path: [], happy: 55, hambre: rnd(0, 40), sed: rnd(0, 40), vejiga: rnd(0, 30), seen: new Set(), leaveAt: st.time + rnd(150, 300), color: pick(['#e05a5a', '#4a9ae0', '#5ab06a', '#e8c04a', '#c45ab0', '#f2f2f2', '#3a3a44', '#e8964a']), skin: pick(['#f6d7c3', '#d29b74', '#a8704a', '#7a4b2c']), kid: Math.random() < 0.3 };
  st.money += st.ticket; st.today.income += st.ticket; st.today.visitors++;
  visitors.push(v);
}
function visitorThink(v) {
  const leaving = st.time >= v.leaveAt || v.happy < 15 || hourOf(st.time) >= 20.5;
  if (leaving) { v.leaving = true; v.path = bfsPath(v, ENTRANCE) || []; if (!v.path.length) v.gone = true; return; }
  const need = ['hambre', 'sed', 'vejiga'].filter((n) => v[n] > 65).sort((a, b) => v[b] - v[a])[0];
  const A = attractions();
  let cands = need ? A.filter((a) => a.b && BUILDINGS[st.buildings.find((b) => b.id === a.b)?.type]?.need === need) : A.filter((a) => a.enc && !v.seen.has(a.enc));
  if (!cands.length) cands = A.filter((a) => a.enc);
  if (!cands.length) { const P = st.paths; const [x, z] = pick(P).split(',').map(Number); cands = [{ x, z }]; }
  const t = pick(cands); v.target = t; v.path = bfsPath(v, t) || [];
}
function visitorArrive(v) {
  const t = v.target; v.target = null; if (!t) return;
  if (t.enc && !v.seen.has(t.enc)) {
    const e = st.enclosures.find((q) => q.id === t.enc); if (e) {
      v.seen.add(t.enc); const as = animalsIn(e);
      const appeal = as.reduce((s, a) => s + SPECIES[a.sp].appeal * (a.baby ? 1.5 : 1), 0);
      v.happy = clamp(v.happy + Math.min(30, appeal * 1.6) * (encHappy(e) / 100) + (encHappy(e) < 35 ? -6 : 0));
    }
  }
  if (t.b) {
    const b = st.buildings.find((q) => q.id === t.b); const B = b && BUILDINGS[b.type];
    if (B && B.need) {
      if (B.need === 'recuerdo') { if (Math.random() < 0.5) { st.money += B.sells; st.today.income += B.sells; v.happy = clamp(v.happy + 4); } }
      else { v[B.need] = clamp(v[B.need] - B.amount); st.money += B.sells; st.today.income += B.sells; v.happy = clamp(v.happy + 3);
        if (B.sells && Math.random() < 0.3 && !st.buildings.some((q) => BUILDINGS[q.type].bin && Math.abs(q.x - v.x) + Math.abs(q.z - v.z) <= 4) && st.litter.length < 60) st.litter.push({ x: v.x, z: v.z, c: pick(['#e05a5a', '#f2f2f2', '#e8c04a']) }); }
    }
  }
}
function visitorsTick(dt) {
  const h = hourOf(st.time);
  if (h >= 9 && h < 19 && visitors.length < 30 && st.enclosures.some((e) => animalsIn(e).length)) {
    const rate = 0.08 * (0.4 + st.fame / 2.5) * Math.max(0.25, Math.min(1.3, 1.45 - st.ticket / 40)) * Math.min(3, 0.5 + st.enclosures.length * 0.4);
    if (Math.random() < rate * dt) spawnVisitor();
  }
  for (const v of visitors) {
    v.hambre += 0.25 * dt; v.sed += 0.3 * dt; v.vejiga += 0.2 * dt;
    for (const n of ['hambre', 'sed', 'vejiga']) if (v[n] > 90) v.happy -= 0.15 * dt;
    if (st.litter.some((l) => Math.abs(l.x - v.x) + Math.abs(l.z - v.z) <= 1)) v.happy -= 0.05 * dt;
    v.happy = clamp(v.happy + decorAround(Math.round(v.x), Math.round(v.z)) * 0.004 * dt);
    if (v.path.length) {
      let step = 1.6 * dt;
      while (step > 0 && v.path.length) { const n = v.path[0]; const dx = n.x - v.x, dz = n.z - v.z, d = Math.hypot(dx, dz); if (d <= step) { v.x = n.x; v.z = n.z; v.path.shift(); step -= d; } else { v.x += dx / d * step; v.z += dz / d * step; step = 0; } v.dir = Math.atan2(dx, dz); }
      if (!v.path.length) { if (v.leaving) v.gone = true; else visitorArrive(v); }
    } else if (!v.wait || st.time > v.wait) { v.wait = st.time + rnd(4, 12); visitorThink(v); }
  }
  for (const v of visitors.filter((q) => q.gone)) st.fame = clamp(st.fame + (v.happy / 20 - st.fame) * 0.02, 0, 5);
  visitors = visitors.filter((v) => !v.gone);
}

// ---------- animales ----------
function addAnimal(sp, e, baby = false) {
  const a = { id: id(), sp, enc: e.id, x: e.x + rnd(0.5, e.n - 0.5), z: e.z + rnd(0.5, e.n - 0.5), tx: null, tz: null, hunger: 80, happy: 70, sex: Math.random() < 0.5 ? 'm' : 'f', baby, born: st.time, name: pick(ANIMAL_NAMES), state: 'wander' };
  st.animals.push(a); return a;
}
function animalsTick(dt) {
  for (const a of st.animals) {
    a.hunger = clamp(a.hunger - 0.07 * dt);
    a.happy += (animalHappy(a) - a.happy) * Math.min(1, 0.02 * dt);
    if (a.baby && st.time - a.born > 4 * 1440) { a.baby = false; toast(`La cría de ${SPECIES[a.sp].label.toLowerCase()} ya es adulta`, 'good', 'paw'); }
    const e = st.enclosures.find((q) => q.id === a.enc); if (!e) continue;
    if (a.preg && st.time >= a.preg.until) { a.preg = null; const b = addAnimal(a.sp, e, true); b.mother = a.id; b.x = a.x + 0.2; b.z = a.z + 0.2; toast(`¡${a.name} (${SPECIES[a.sp].label.toLowerCase()}) ha tenido una cría!`, 'good', 'heart'); }
    const arrived = a.tx == null || (Math.abs(a.tx - a.x) < 0.05 && Math.abs(a.tz - a.z) < 0.05);
    if (a.state === 'eat' && arrived) a.hunger = clamp(a.hunger + 1.2 * dt);
    if (arrived && (!a.restUntil || st.time > a.restUntil)) decide(a, e);
    if (!arrived) {
      const S = SPECIES[a.sp]; const sp = (S.hop ? 1.4 : 0.9) * dt * (a.baby ? 0.8 : 1) * 0.6;
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz);
      if (d <= sp) { a.x = a.tx; a.z = a.tz; } else { a.x += dx / d * sp; a.z += dz / d * sp; a.dir = Math.atan2(dx, dz); }
    }
  }
}
// Qué hace un animal ahora: dormir de noche, comer si hay comida, beber, pastar, jugar, seguir a su madre...
function decide(a, e) {
  const S = SPECIES[a.sp], h = hourOf(st.time), inside = (x, z) => ({ x: Math.min(e.x + e.n - 0.5, Math.max(e.x + 0.5, x)), z: Math.min(e.z + e.n - 0.5, Math.max(e.z + 0.5, z)) });
  const go = (x, z, state, mins) => { const p = inside(x, z); a.tx = p.x; a.tz = p.z; a.state = state; a.restUntil = st.time + mins; };
  if (h >= 21 || h < 6) { if (a.state !== 'sleep') { const mom = a.mother && st.animals.find((m) => m.id === a.mother); go(mom ? mom.x + 0.2 : a.x + rnd(-1, 1), mom ? mom.z + 0.15 : a.z + rnd(-1, 1), 'sleep', 60); } else a.restUntil = st.time + 30; return; }
  if (e.food && st.time < e.food.until && a.hunger < 90) return go(e.food.x + rnd(-0.35, 0.35), e.food.z + rnd(-0.35, 0.35), 'eat', 25);
  const mom = a.baby && a.mother && st.animals.find((m) => m.id === a.mother && m.enc === a.enc);
  if (mom && Math.random() < 0.75) return go(mom.x + rnd(-0.5, 0.5), mom.z + rnd(-0.5, 0.5), 'follow', rnd(2, 6));
  const pond = e.items.find((i) => i.type === 'charca'), toy = e.items.find((i) => i.type === 'juguete');
  const r = Math.random();
  if (pond && r < 0.12) return go(pond.x + 0.5 + rnd(-0.6, 0.6), pond.z + 0.5 + rnd(-0.6, 0.6), 'drink', 12);
  if (toy && r < 0.2) return go(toy.x + 0.5, toy.z + 0.5, 'play', 10);
  if (!CARNIVORES.includes(a.sp) && r < 0.45) return go(a.x + rnd(-0.5, 0.5), a.z + rnd(-0.5, 0.5), 'graze', rnd(8, 20));
  if (r < 0.65) return go(a.x, a.z, 'rest', rnd(6, 20));
  go(e.x + rnd(0.6, e.n - 0.6), e.z + rnd(0.6, e.n - 0.6), 'wander', 0);
}
const STATE_TXT = { wander: 'paseando', rest: 'descansando', graze: 'pastando', eat: 'comiendo', drink: 'bebiendo', sleep: 'durmiendo', play: 'jugando', follow: 'siguiendo a su madre' };
// Pone un montón de comida en el recinto (los animales van a comer)
function putFood(e) { e.food = { x: e.x + e.n / 2 + rnd(-0.8, 0.8), z: e.z + e.n / 2 + rnd(-0.8, 0.8), until: st.time + 150 }; for (const a of animalsIn(e)) if (a.state !== 'sleep') a.restUntil = 0; }
function feedTimes() {
  // cada cuidador alimenta a 8 animales dos veces al día
  let capacity = st.staff.keeper * 8;
  const hungry = st.animals.slice().sort((a, b) => a.hunger - b.hunger);
  const fed = new Set();
  for (const a of hungry) { if (capacity-- <= 0) break; fed.add(a.enc); }
  for (const e of st.enclosures) if (fed.has(e.id)) putFood(e);
  if (st.animals.length > st.staff.keeper * 8) toast('Faltan cuidadores: hay animales sin comer. Contrata más o dales de comer tú.', 'warn', 'paw');
}
function breeding() {
  for (const e of st.enclosures) {
    const as = animalsIn(e);
    for (const sp of new Set(as.map((a) => a.sp))) {
      const g = as.filter((a) => a.sp === sp && !a.baby);
      if (!g.some((a) => a.sex === 'm') || !g.some((a) => a.sex === 'f')) continue;
      const avg = g.reduce((t, a) => t + a.happy, 0) / g.length;
      const space = (e.n * e.n) / (as.reduce((t, m) => t + SPECIES[m.sp].space, 0) + SPECIES[sp].space * 0.5);
      const mom = g.find((a) => a.sex === 'f' && !a.preg);
      if (mom && avg > 65 && space >= 0.9 && Math.random() < 0.3 && !(e.nests || []).some((n) => n.sp === sp)) {
        if (SPECIES[sp].eggs) { e.nests = [...(e.nests || []), { sp, mother: mom.id, x: mom.x, z: mom.z, n: 1 + (Math.random() < 0.4 ? 1 : 0), until: st.time + 1440 }]; toast(`${mom.name} (${SPECIES[sp].label.toLowerCase()}) ha puesto huevos en un nido`, 'good', 'egg'); }
        else { mom.preg = { until: st.time + 1440 }; toast(`${mom.name} (${SPECIES[sp].label.toLowerCase()}) espera una cría`, 'good', 'heart'); }
      }
    }
  }
}
function hatchNests() {
  for (const e of st.enclosures) {
    for (const n of (e.nests || []).filter((q) => st.time >= q.until)) {
      for (let i = 0; i < n.n; i++) { const b = addAnimal(n.sp, e, true); b.mother = n.mother; b.x = n.x + rnd(-0.2, 0.2); b.z = n.z + rnd(-0.2, 0.2); }
      toast(`¡Han salido ${n.n > 1 ? `${n.n} crías` : 'una cría'} del nido de ${SPECIES[n.sp].label.toLowerCase()}!`, 'good', 'egg');
    }
    if (e.nests) e.nests = e.nests.filter((q) => st.time < q.until);
  }
}
function hourly(h) {
  hatchNests();
  if (h === 9 || h === 17) feedTimes();
  if (h === 6) breeding();
  for (let i = 0; i < st.staff.cleaner * 2 && st.litter.length; i++) st.litter.shift();
  if (h === 21) endOfDay();
}
function endOfDay() {
  const wages = st.staff.keeper * WAGES.keeper + st.staff.cleaner * WAGES.cleaner, food = st.animals.length * FOOD_COST;
  st.money -= wages + food; st.today.spent += wages + food;
  const d = { day: dayOf(st.time) + 1, ...st.today, profit: st.today.income - st.today.spent, stars: stars() };
  st.history.unshift(d); st.history.length = Math.min(st.history.length, 14);
  info(`Fin del día ${d.day}`, `<div class="card"><div class="stat"><span class="tile" style="background:#25c48f">${icon('users')}</span><span>Visitantes</span><b>${d.visitors}</b></div>
    <div class="stat"><span class="tile" style="background:#2fa8e0">${icon('coin')}</span><span>Ingresos</span><b>${eur(d.income)}</b></div>
    <div class="stat"><span class="tile" style="background:#e5484d">${icon('briefcase')}</span><span>Gastos</span><b>${eur(d.spent)}</b></div>
    <div class="stat"><span class="tile" style="background:#f5a524">${icon('star')}</span><span>Fama</span><b>${'★'.repeat(Math.floor(d.stars))}${d.stars % 1 ? '½' : ''}</b></div></div>
    <p class="hint">${d.profit >= 0 ? `¡Beneficio de ${eur(d.profit)}!` : `Pérdidas de ${eur(-d.profit)}. Atrae más visitantes con animales felices, tiendas y decoración.`}</p>`, 'Siguiente día');
  st.today = { visitors: 0, income: 0, spent: 0 };
  save();
}
function tick(dt) {
  st.time += dt;
  const hr = Math.floor(st.time / 60);
  while (st.lastHour < hr) { st.lastHour++; hourly(st.lastHour % 24); }
  animalsTick(dt); visitorsTick(dt);
}
function save() { st.lastSaved = Date.now(); store.save(KEY, st); }
// Con la app cerrada: pasa el tiempo más despacio y se estima lo ganado
function offline() {
  const mins = Math.min((Date.now() - st.lastSaved) / 1000 * 0.2, 1440); if (mins < 20) return;
  const last = st.history[0]; const est = last ? Math.max(0, last.profit) * (mins / 1440) * 0.5 : 0;
  st.time += mins; st.lastHour = Math.floor(st.time / 60); st.money += Math.round(est);
  for (const a of st.animals) a.hunger = st.staff.keeper * 8 >= st.animals.length ? 90 : Math.max(20, a.hunger - mins * 0.05);
  info('Mientras no estabas…', `<p>Han pasado <b>${Math.round(mins / 60)} h</b> en el parque.</p>${est ? `<p>Los visitantes han dejado unos <b>${eur(est)}</b>.</p>` : ''}${st.staff.keeper * 8 < st.animals.length ? '<p class="hint">Faltan cuidadores: algunos animales tienen hambre.</p>' : '<p class="hint">Tus cuidadores han atendido a los animales.</p>'}`);
}

// ---------- dibujo 3D ----------
const canvas = $('#stage');
const eng = new Engine(canvas, { target: [N / 2, 0, N / 2 + 2], dist: 26, maxDist: 90, bounds: N, pitch: 0.9 });
eng.cam.dist = eng.fitDist(15);
const S3 = eng.scene;
const grass = canvasTexture(128, (x, s) => { x.fillStyle = '#7dbb5c'; x.fillRect(0, 0, s, s); for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(${40 + Math.random() * 50},${110 + Math.random() * 60},40,0.5)`; x.fillRect(Math.random() * s, Math.random() * s, 1, 3); } }, [N / 3, N / 3]);
const island = new THREE.Mesh(new THREE.BoxGeometry(N + 2, 0.8, N + 2), [mat('#7a4f2f'), mat('#7a4f2f'), new THREE.MeshLambertMaterial({ map: grass }), mat('#6e4528'), mat('#8a5a35'), mat('#8a5a35')]);
island.position.set(N / 2, -0.4, N / 2); S3.add(island);
// entrada
const gate = new THREE.Group(); gate.position.set(ENTRANCE.x + 0.5, 0, ENTRANCE.z + 0.5);
for (const sx of [-0.7, 0.7]) { const p = box(0.18, 2, 0.18, '#8a5a3a'); p.position.set(sx, 1, 0); gate.add(p); }
const arch = box(1.8, 0.35, 0.25, '#2e7d4f', 0.05); arch.position.y = 2.05; gate.add(arch); S3.add(gate);
const groups = { paths: new THREE.Group(), enc: new THREE.Group(), bld: new THREE.Group(), animals: new THREE.Group(), people: new THREE.Group(), litter: new THREE.Group(), ghost: new THREE.Group() };
Object.values(groups).forEach((g) => S3.add(g));
const ov = document.createElement('canvas'); ov.className = 'overlay2d'; canvas.after(ov); const octx = ov.getContext('2d');

let sig = {};
function rebuildPaths() {
  const g = groups.paths; g.clear(); const n = st.paths.length; if (!n) return;
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.98, 0.06, 0.98), mat('#e3d4b0'), n); const m = new THREE.Matrix4();
  st.paths.forEach((p, i) => { const [x, z] = p.split(',').map(Number); m.makeTranslation(x + 0.5, 0.03, z + 0.5); inst.setMatrixAt(i, m); });
  g.add(inst);
}
function tree(scale = 1) { const t = new THREE.Group(); const tr = box(0.12 * scale, 0.7 * scale, 0.12 * scale, '#7a5232'); tr.position.y = 0.35 * scale; t.add(tr); const l = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * scale, 0), mat('#3e8a3e')); l.position.y = 0.95 * scale; t.add(l); const l2 = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 * scale, 0), mat('#4ea04e')); l2.position.set(0.15 * scale, 1.2 * scale, 0.05); t.add(l2); t.add(blob(0.9 * scale, 0.9 * scale)); return t; }
function enrichMesh(type) {
  const g = new THREE.Group();
  if (type === 'arbol') g.add(tree(1.2));
  if (type === 'roca') { for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22 + i * 0.06, 0), mat('#8a8a8a')); r.position.set(i * 0.25 - 0.25, 0.15, (i % 2) * 0.2); g.add(r); } }
  if (type === 'charca') { const w = new THREE.Mesh(new THREE.CircleGeometry(0.75, 20), mat('#4a9ad0')); w.rotation.x = -Math.PI / 2; w.position.y = 0.04; g.add(w); }
  if (type === 'juguete') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), mat('#e05050')); b.position.y = 0.22; g.add(b, blob(0.5, 0.5)); }
  if (type === 'bambu') for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), mat('#6ab04a')); c.position.set(Math.cos(i) * 0.2, 0.6, Math.sin(i * 2) * 0.2); g.add(c); }
  return g;
}
const biomeTex = {};
function groundTex(b) {
  if (biomeTex[b]) return biomeTex[b];
  const base = BIOMES[b].color;
  biomeTex[b] = canvasTexture(128, (x, s) => {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    const dots = { granja: ['#86b25a', '#b8d07a', '#d8c070'], sabana: ['#c4ac5e', '#e2d290', '#a89a50'], selva: ['#3e8a3e', '#5aa84e', '#2f6e34'], artico: ['#ffffff', '#d8e6ee', '#c4d6e2'], humedal: ['#6aa898', '#9ccab8', '#5a7a5a'] }[b];
    for (let i = 0; i < 900; i++) { x.fillStyle = dots[i % 3]; const r = b === 'selva' ? 3 : 1.5; x.fillRect(Math.random() * s, Math.random() * s, r, b === 'sabana' || b === 'granja' ? 4 : r); }
    if (b === 'humedal') { x.fillStyle = 'rgba(80,150,200,0.45)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, 14, 8, 0, 0, 7); x.fill(); } }
  }, [2, 2]);
  return biomeTex[b];
}
function rebuildEnclosures() {
  const g = groups.enc; g.clear();
  for (const e of st.enclosures) {
    const eg = new THREE.Group(); eg.userData.enc = e.id; g.add(eg);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(e.n - 0.05, 0.05, e.n - 0.05), [mat(BIOMES[e.biome].color), mat(BIOMES[e.biome].color), new THREE.MeshLambertMaterial({ map: groundTex(e.biome) }), mat(BIOMES[e.biome].color), mat(BIOMES[e.biome].color), mat(BIOMES[e.biome].color)]); ground.position.set(e.x + e.n / 2, 0.03, e.z + e.n / 2); eg.add(ground);
    const rail = mat('#8a6a42');
    for (const [x, z, w, d] of [[e.x + e.n / 2, e.z, e.n, 0.06], [e.x + e.n / 2, e.z + e.n, e.n, 0.06], [e.x, e.z + e.n / 2, 0.06, e.n], [e.x + e.n, e.z + e.n / 2, 0.06, e.n]]) {
      for (const y of [0.35, 0.65]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), rail); r.position.set(x, y, z); eg.add(r); }
    }
    for (let i = 0; i <= e.n; i++) for (const [x, z] of [[e.x + i, e.z], [e.x + i, e.z + e.n], [e.x, e.z + i], [e.x + e.n, e.z + i]]) { const p = box(0.09, 0.8, 0.09, '#6a4a2a'); p.position.set(x, 0.4, z); eg.add(p); }
    for (const it of e.items) { const m = enrichMesh(it.type); m.position.set(it.x + 0.5, 0.05, it.z + 0.5); eg.add(m); }
  }
}
function buildingMesh(b) {
  const B = BUILDINGS[b.type]; const g = new THREE.Group();
  if (B.cat === 'Tiendas') {
    const base = box(0.85, 0.75, 0.85, b.type === 'banos' ? '#dfe6ee' : '#fff4e4', 0.04); base.position.y = 0.4; g.add(base);
    const roof = box(1.0, 0.12, 1.0, B.color, 0.04); roof.position.y = 0.86; g.add(roof);
    for (let i = 0; i < 4; i++) { const s = box(0.24, 0.1, 0.06, i % 2 ? '#fff' : B.color); s.position.set(-0.36 + i * 0.24, 0.7, 0.45); g.add(s); }
    const sign = box(0.5, 0.18, 0.05, B.color, 0.03); sign.position.set(0, 1.05, 0.2); g.add(sign);
  } else if (b.type === 'banco') { const s = box(0.7, 0.06, 0.25, '#a8784a'); s.position.y = 0.25; g.add(s); const r = box(0.7, 0.25, 0.05, '#a8784a'); r.position.set(0, 0.4, -0.11); g.add(r); }
  else if (b.type === 'papelera') { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.35, 10), mat('#4a7a5a')); c.position.y = 0.18; g.add(c); }
  else if (b.type === 'farola') { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), mat('#3a3a44')); p.position.y = 0.7; g.add(p); const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat('#fff0b0', { emissive: '#7a6a30' })); l.position.y = 1.45; g.add(l); }
  else if (b.type === 'flores') for (let i = 0; i < 7; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), mat(pick(['#ff8fb1', '#ffd45c', '#fff', '#b99cff']))); f.position.set(rnd(-0.35, 0.35), 0.08, rnd(-0.35, 0.35)); g.add(f); }
  else if (b.type === 'arbolp') g.add(tree(1));
  else if (b.type === 'fuente') { const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.25, 16), mat('#d8d0c4')); bs.position.y = 0.13; g.add(bs); const w = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 16), mat('#6ab4e8')); w.position.y = 0.26; g.add(w); const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 8), mat('#d8d0c4')); c.position.y = 0.5; g.add(c); }
  if (B.cat === 'Tiendas') g.add(blob(1.2, 1.2));
  return g;
}
function rebuildBuildings() { const g = groups.bld; g.clear(); for (const b of st.buildings) { const m = buildingMesh(b); m.position.set(b.x + 0.5, 0.05, b.z + 0.5); m.userData.bld = b.id; g.add(m); } }

// Animales generados a partir de su descripción
const animalMeshes = new Map();
function animalModel(sp) {
  const S = SPECIES[sp]; const [L, H, W] = S.body; const [c1, c2, c3] = S.colors; const F = S.feat;
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  const m1 = mat(c1), m2 = mat(c2), m3 = mat(c3);
  const legH = S.legs; const bodyY = S.biped ? legH + H * 0.5 : legH + H * 0.4;
  let torso;
  if (F.includes('penguin')) { torso = new THREE.Mesh(new THREE.CapsuleGeometry(W * 0.55, H * 0.6, 4, 10), m1); torso.position.y = H * 0.55 + legH; const belly = new THREE.Mesh(new THREE.SphereGeometry(W * 0.48, 10, 8), m2); belly.scale.set(1, 1.5, 0.6); belly.position.set(0, H * 0.5 + legH, W * 0.25); body.add(belly); }
  else { torso = new THREE.Mesh(new THREE.CapsuleGeometry(Math.min(W, H) * 0.5, L * 0.7, 4, 10), F.includes('shell') ? mat('#5a6a3a') : m1); torso.rotation.x = Math.PI / 2; torso.position.y = bodyY; torso.scale.set(W / Math.min(W, H), 1, H / Math.min(W, H)); }
  body.add(torso);
  if (F.includes('shell')) { const sh = new THREE.Mesh(new THREE.SphereGeometry(L * 0.55, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), m1); sh.scale.set(W / L * 1.1, 0.8, 1); sh.position.y = bodyY - 0.02; body.add(sh); }
  if (F.includes('stripes') || F.includes('spots') || F.includes('panda')) {
    for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, F.includes('spots') ? 0.07 : H * 0.95, 0.05), m2); if (F.includes('spots')) { s.scale.set(0.3, 1, 1.4); s.position.set(rnd(-W * 0.4, W * 0.4), bodyY + H * 0.45, -L * 0.35 + i * L * 0.18); } else s.position.set(0, bodyY, -L * 0.35 + i * L * 0.17); if (!F.includes('panda') || i === 0 || i === 1) body.add(s); }
  }
  const legs = [];
  const legPos = S.biped ? [[-W * 0.25, 0], [W * 0.25, 0]] : [[-W * 0.32, L * 0.32], [W * 0.32, L * 0.32], [-W * 0.32, -L * 0.32], [W * 0.32, -L * 0.32]];
  for (const [lx, lz] of legPos) {
    const pv = new THREE.Group(); pv.position.set(lx, legH, lz); body.add(pv);
    const thick = S.biped ? 0.025 : Math.max(0.035, W * 0.16);
    const lg = new THREE.Mesh(new THREE.CylinderGeometry(thick, thick * 0.85, legH, 6), F.includes('panda') ? m2 : (S.biped && !F.includes('penguin') ? m3 : m1)); lg.position.y = -legH / 2; pv.add(lg);
    if (F.includes('penguin')) { lg.material = m3; }
    legs.push(pv);
  }
  // cuello y cabeza
  const neck = new THREE.Group(); neck.position.set(0, S.biped ? bodyY + H * 0.3 : bodyY + H * 0.2, S.biped ? W * 0.1 : L * 0.42); body.add(neck);
  if (S.neck > 0.05) { const nk = new THREE.Mesh(new THREE.CylinderGeometry(Math.max(0.03, S.head * 0.4), Math.max(0.04, S.head * 0.55), S.neck, 8), F.includes('spots') ? m1 : m1); nk.position.set(0, S.neck / 2, S.neck * 0.15); nk.rotation.x = 0.25; neck.add(nk); }
  const head = new THREE.Group(); head.position.set(0, S.neck, S.neck * 0.3 + S.head * 0.3); neck.add(head);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(S.head, 12, 10), F.includes('panda') ? m1 : m1); hd.scale.set(1, 0.95, 1.2); head.add(hd);
  if (!F.includes('beak') && !F.includes('penguin')) { const sn = new THREE.Mesh(new THREE.SphereGeometry(S.head * 0.55, 10, 8), F.includes('face') ? m2 : (F.includes('stripes') ? m2 : m1)); sn.position.set(0, -S.head * 0.25, S.head * 0.85); sn.scale.set(0.9, 0.7, 1); head.add(sn); }
  if (F.includes('beak')) { const bk = new THREE.Mesh(new THREE.ConeGeometry(S.head * 0.35, S.head * 1.2, 6), m3); bk.rotation.x = Math.PI / 2; bk.position.set(0, -S.head * 0.1, S.head * 1.1); head.add(bk); }
  for (const sd of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.012, S.head * 0.12), 6, 5), mat('#111')); eye.position.set(sd * S.head * 0.55, S.head * 0.2, S.head * 0.75); head.add(eye);
    if (F.includes('panda')) { const p = new THREE.Mesh(new THREE.SphereGeometry(S.head * 0.25, 8, 6), m2); p.scale.set(1, 1.2, 0.4); p.position.set(sd * S.head * 0.5, S.head * 0.15, S.head * 0.78); head.add(p); }
    if (F.includes('ears_up')) { const e = new THREE.Mesh(new THREE.ConeGeometry(S.head * 0.25, S.head * 0.9, 6), m1); e.position.set(sd * S.head * 0.45, S.head * 1.0, 0); head.add(e); }
    if (F.includes('ears_round') || F.includes('panda')) { const e = new THREE.Mesh(new THREE.SphereGeometry(S.head * 0.3, 8, 6), F.includes('panda') ? m2 : m1); e.position.set(sd * S.head * 0.7, S.head * 0.75, -S.head * 0.1); head.add(e); }
    if (F.includes('ears_big')) { const e = new THREE.Mesh(new THREE.SphereGeometry(S.head * 0.75, 10, 8), m3); e.scale.set(0.15, 1, 0.9); e.position.set(sd * S.head * 1.0, 0, -S.head * 0.2); head.add(e); }
    if (F.includes('horns')) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 5), m3); h.position.set(sd * 0.05, S.head * 1.0, -0.02); h.rotation.x = -0.4; head.add(h); }
    if (F.includes('ossicones')) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.12, 5), m3); h.position.set(sd * 0.05, S.head * 1.1, 0); head.add(h); }
    if (F.includes('tusks')) { const t = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.3, 6), mat('#f4f0e0')); t.rotation.x = Math.PI / 2 + 0.4; t.position.set(sd * 0.14, -S.head * 0.45, S.head * 0.9); head.add(t); }
  }
  if (F.includes('trunk')) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.6, 8), m1); t.position.set(0, -S.head * 0.6, S.head * 1.05); t.rotation.x = 0.35; head.add(t); }
  if (F.includes('mane')) { const m = new THREE.Mesh(new THREE.SphereGeometry(S.head * 1.45, 12, 10), m3); m.position.set(0, 0, -S.head * 0.25); head.add(m); }
  if (F.includes('mane_short')) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, S.neck * 1.1), m2); m.position.set(0, S.neck * 0.55, 0); m.rotation.x = -1.2; neck.add(m); }
  if (F.includes('fluffy')) { const f = new THREE.Mesh(new THREE.SphereGeometry(S.head * 0.6, 8, 6), m2); f.position.set(0, S.head * 0.8, 0); head.add(f); }
  if (F.includes('beard')) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 5), m2); b.rotation.x = Math.PI; b.position.set(0, -S.head * 0.6, S.head * 0.7); head.add(b); }
  // cola
  const tail = new THREE.Group(); tail.position.set(0, bodyY + H * 0.1, -L * 0.48); body.add(tail);
  const tl = F.includes('tail_long') ? 0.45 : 0.15;
  const tm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, F.includes('tail_long') && S.hop ? 0.07 : 0.025, tl, 5), m1); tm.position.y = -tl / 2; tail.add(tm); tail.rotation.x = S.hop ? -2.3 : 0.6;
  g.add(blob(Math.max(W, 0.3) * 1.8, Math.max(L, 0.3) * 1.5, 0.35));
  return { g, body, legs, head, tail, neck, torso, neckRx: neck.rotation.x };
}
function syncAnimals(t) {
  const seen = new Set();
  for (const a of st.animals) {
    seen.add(a.id); let m = animalMeshes.get(a.id);
    if (!m) { m = animalModel(a.sp); m.g.userData.animal = a.id; animalMeshes.set(a.id, m); groups.animals.add(m.g); }
    const moving = a.tx != null && (Math.abs(a.tx - a.x) > 0.05 || Math.abs(a.tz - a.z) > 0.05);
    m.g.position.set(a.x, 0.05, a.z); if (a.dir != null) m.g.rotation.y = a.dir;
    const k = a.baby ? 0.55 : 1; m.g.scale.setScalar(k);
    const S = SPECIES[a.sp]; const w = moving ? Math.sin(t * (S.hop ? 9 : 7) + a.x) : 0;
    const sleeping = a.state === 'sleep' && !moving, headDown = !moving && ['eat', 'drink', 'graze'].includes(a.state);
    m.body.position.y = S.hop && moving ? Math.abs(w) * 0.2 : sleeping ? -S.legs * 0.85 : 0;
    m.legs.forEach((l, i) => { l.visible = !sleeping; l.rotation.x = S.hop ? 0 : (i % 2 === (i < 2 ? 0 : 1) ? w : -w) * 0.5; });
    m.neck.rotation.x = m.neckRx + (headDown ? 0.9 + Math.sin(t * 3 + a.x) * 0.08 : sleeping ? 0.6 : 0);
    m.head.rotation.x = moving ? 0 : headDown ? 0.4 : sleeping ? 0.3 : Math.sin(t * 0.8 + a.z) * 0.25 + 0.1;
    m.tail.rotation.z = Math.sin(t * (a.state === 'play' ? 8 : 3) + a.x) * (sleeping ? 0.05 : 0.3);
    m.torso.scale.x = (a.preg ? 1.3 : 1) * (m.torsoSX ??= m.torso.scale.x);
    if (a.state === 'play' && !moving) m.g.rotation.y += Math.sin(t * 4) * 0.02;
  }
  for (const [k, m] of animalMeshes) if (!seen.has(k)) { groups.animals.remove(m.g); animalMeshes.delete(k); }
}
const peopleMeshes = new Map();
function syncPeople(t) {
  const seen = new Set();
  for (const v of visitors) {
    seen.add(v.id); let m = peopleMeshes.get(v.id);
    if (!m) {
      const g = new THREE.Group(); const s = v.kid ? 0.7 : 1;
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.12 * s, 0.35 * s, 3, 6), mat(v.color)); b.position.y = 0.4 * s; g.add(b);
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.1 * s, 8, 6), mat(v.skin)); hd.position.y = 0.78 * s; g.add(hd);
      g.add(blob(0.35, 0.35, 0.3)); m = { g }; peopleMeshes.set(v.id, m); groups.people.add(g);
    }
    m.g.position.set(v.x + 0.5, 0.05 + (v.path.length ? Math.abs(Math.sin(t * 9 + v.id * 10)) * 0.04 : 0), v.z + 0.5); if (v.dir != null) m.g.rotation.y = v.dir;
  }
  for (const [k, m] of peopleMeshes) if (!seen.has(k)) { groups.people.remove(m.g); peopleMeshes.delete(k); }
}
function rebuildLitter() { const g = groups.litter; g.clear(); for (const l of st.litter) { const b = box(0.12, 0.04, 0.08, l.c); b.position.set(l.x + 0.3 + Math.random() * 0.4, 0.08, l.z + 0.3 + Math.random() * 0.4); b.rotation.y = Math.random() * 3; g.add(b); } }

groups.extra = new THREE.Group(); S3.add(groups.extra);
function syncExtras() {
  const key = JSON.stringify(st.enclosures.map((e) => [e.food && st.time < e.food.until ? [e.food.x, e.food.z] : 0, (e.nests || []).map((n) => [n.x, n.z, n.n, n.sp])]));
  if (key === sig.extra) return; sig.extra = key; const g = groups.extra; g.clear();
  for (const e of st.enclosures) {
    if (e.food && st.time < e.food.until) {
      const carn = animalsIn(e).some((a) => CARNIVORES.includes(a.sp)); const pile = new THREE.Group(); pile.position.set(e.food.x, 0.06, e.food.z);
      for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(carn ? new THREE.DodecahedronGeometry(0.07, 0) : new THREE.BoxGeometry(0.22, 0.04, 0.05), mat(carn ? '#a8423a' : pick(['#d8c060', '#c8a848', '#7ab04a', '#e89a4a']))); p.position.set(rnd(-0.2, 0.2), 0.03 + (i % 3) * 0.03, rnd(-0.2, 0.2)); p.rotation.y = rnd(0, 3); pile.add(p); }
      g.add(pile);
    }
    for (const n of e.nests || []) {
      const nest = new THREE.Group(); nest.position.set(n.x, 0.06, n.z);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 14), mat(n.sp === 'tortuga' ? '#c8a870' : '#8a6a3a')); ring.rotation.x = Math.PI / 2; nest.add(ring);
      for (let i = 0; i < n.n + 1; i++) { const egg = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(n.sp === 'pinguino' ? '#e8f0f4' : n.sp === 'tortuga' ? '#f4ecd8' : '#f8e8e0')); egg.scale.y = 1.25; egg.position.set((i - n.n / 2) * 0.09, 0.06, (i % 2) * 0.05); egg.userData.nest = e.id; nest.add(egg); }
      g.add(nest);
    }
  }
}
function sync(t) {
  syncExtras();
  const s1 = st.paths.join(';'); if (s1 !== sig.paths) { sig.paths = s1; rebuildPaths(); }
  const s2 = JSON.stringify(st.enclosures); if (s2 !== sig.enc) { sig.enc = s2; rebuildEnclosures(); }
  const s3 = JSON.stringify(st.buildings); if (s3 !== sig.bld) { sig.bld = s3; rebuildBuildings(); }
  const s4 = st.litter.length; if (s4 !== sig.litter) { sig.litter = s4; rebuildLitter(); }
  syncAnimals(t); syncPeople(t);
  // luz del día
  const h = hourOf(st.time); const night = h < 6 ? 1 : h < 7.5 ? (7.5 - h) / 1.5 : h > 21 ? 1 : h > 19.5 ? (h - 19.5) / 1.5 : 0;
  eng.sun.intensity = 1.6 * (1 - night * 0.8); eng.hemi.intensity = 1.1 - night * 0.6;
  document.body.style.background = night > 0.5 ? 'linear-gradient(#1a2148,#3b3f72)' : 'linear-gradient(#8fcdf0,#d8eef8)';
}
// capa 2D: avisos sobre los recintos
function overlay() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  if (ov.width !== Math.round(eng.w * dpr)) { ov.width = eng.w * dpr; ov.height = eng.h * dpr; }
  octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, eng.w, eng.h);
  for (const e of st.enclosures) {
    const as = animalsIn(e); if (!as.length) continue;
    const hungry = as.some((a) => a.hunger < 35), sad = encHappy(e) < 40;
    if (!hungry && !sad) continue;
    const q = eng.project(new THREE.Vector3(e.x + e.n / 2, 1.6, e.z + e.n / 2)); if (q.z > 1) continue;
    octx.fillStyle = '#fff'; octx.beginPath(); octx.arc(q.x, q.y, 14, 0, 7); octx.fill();
    octx.strokeStyle = '#e5484d'; octx.lineWidth = 2; octx.stroke();
    octx.font = '800 15px Nunito, sans-serif'; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillStyle = '#e5484d'; octx.fillText(hungry ? '🍖' : '☹', q.x, q.y + 1);
  }
}
eng.onBeforeRender = (t) => sync(t);
eng.onAfterRender = () => overlay();

// ---------- herramientas ----------
const view = { tool: null, opt: null, ghost: null, erase: false };
function setTool(tool, opt = null) { view.tool = tool; view.opt = opt; view.erase = false; showGhost(null); renderToolInfo(); }
function showGhost(spec) {
  const g = groups.ghost; g.clear(); view.ghost = spec; if (!spec) { eng.dirty = true; return; }
  const ok = spec.ok; const m = new THREE.Mesh(new THREE.BoxGeometry(spec.w, 0.08, spec.h), new THREE.MeshBasicMaterial({ color: ok ? 0x46d28c : 0xf05050, transparent: true, opacity: 0.55, depthWrite: false }));
  m.position.set(spec.x + spec.w / 2, 0.1, spec.z + spec.h / 2); g.add(m); eng.dirty = true;
}
function tileAt(sx, sy) { const p = eng.ground(sx, sy); return p ? { x: Math.floor(p.x), z: Math.floor(p.z) } : null; }
function paintPath(t) {
  if (!t || !inGrid(t.x, t.z)) return;
  const key = pk(t.x, t.z);
  if (view.erase) { if (st.paths.includes(key) && !(t.x === ENTRANCE.x && t.z >= ENTRANCE.z - 1)) { st.paths = st.paths.filter((p) => p !== key); st.money += PATH_PRICE / 2; } return; }
  if (occupied(t.x, t.z) || st.money < PATH_PRICE) return;
  st.paths.push(key); st.money -= PATH_PRICE;
}
eng.onDoubleTap = (sx, sy) => {
  if (view.tool) return;
  const t = tileAt(sx, sy); const e = t && encAt(t.x, t.z);
  if (e && !close) return enterClose(e);
  const p = eng.ground(sx, sy); if (p) { eng.cam.follow = null; eng.cam.tx = new THREE.Vector3(p.x, 0, p.z); eng.cam.distT = Math.max(eng.cam.min, eng.cam.dist * 0.55); }
};
eng.onDragStart = (sx, sy) => { if (view.tool === 'path') { paintPath(tileAt(sx, sy)); return true; } return false; };
eng.onDragMove = (sx, sy) => { if (view.tool === 'path') paintPath(tileAt(sx, sy)); };
eng.onDragEnd = () => { hud(); save(); };
eng.onTap = (sx, sy) => {
  if (modalOpen()) return;
  const t = tileAt(sx, sy);
  if (view.tool === 'path') { paintPath(t); hud(); return; }
  if (view.tool === 'enc' && t) {
    const n = SIZES[view.opt.size].n; const x = Math.min(N - n, Math.max(0, t.x - Math.floor(n / 2))), z = Math.min(N - n, Math.max(0, t.z - Math.floor(n / 2)));
    const ok = canPlaceEnclosure(x, z, n); showGhost({ x, z, w: n, h: n, ok });
    view.pending = ok ? { x, z, n } : null; renderToolInfo(); return;
  }
  if (view.tool === 'animal') {
    const e = t && encAt(t.x, t.z); if (!e) return toast('Toca dentro de un recinto', 'warn');
    const S = SPECIES[view.opt]; if (st.money < S.price) return toast('No hay dinero suficiente', 'warn');
    st.money -= S.price; const a = addAnimal(view.opt, e);
    toast(e.biome !== S.biome ? `${S.label} añadido, pero prefiere hábitat de ${BIOMES[S.biome].label.toLowerCase()}` : `${S.label} (${a.sex === 'm' ? 'macho' : 'hembra'}) llega al parque`, e.biome !== S.biome ? 'warn' : 'good', 'paw');
    hud(); save(); return;
  }
  if (view.tool === 'enrich') {
    const e = t && encAt(t.x, t.z); if (!e) return toast('Toca dentro de un recinto', 'warn');
    if (e.items.some((i) => i.x === t.x && i.z === t.z)) return; const E = ENRICH[view.opt]; if (st.money < E.price) return toast('No hay dinero suficiente', 'warn');
    st.money -= E.price; e.items.push({ type: view.opt, x: t.x, z: t.z }); hud(); save(); return;
  }
  if (view.tool === 'build') {
    if (!t || !inGrid(t.x, t.z) || occupied(t.x, t.z)) return toast('Ese sitio está ocupado', 'warn');
    const B = BUILDINGS[view.opt];
    if (B.cat === 'Tiendas' && !nextToPath(t.x, t.z)) return toast('Las tiendas deben estar junto a un camino', 'warn');
    if (st.money < B.price) return toast('No hay dinero suficiente', 'warn');
    st.money -= B.price; st.buildings.push({ id: id(), type: view.opt, x: t.x, z: t.z }); hud(); save(); return;
  }
  // sin herramienta: información
  const aId = eng.pick(sx, sy, groups.animals.children, 'animal');
  if (close) { const nest = eng.pick(sx, sy, groups.extra.children, 'nest'); if (nest) { nestCard = nest; followId = null; eng.cam.follow = null; return animalCardTick(true); } if (aId) return followAnimal(aId); return; }
  if (aId) return animalCard(aId);
  const e = t && encAt(t.x, t.z); if (e) return encCard(e);
  const b = t && buildingAt(t.x, t.z); if (b) return confirm(`¿Quitar ${BUILDINGS[b.type].label.toLowerCase()}? Recuperas la mitad.`, () => { st.buildings = st.buildings.filter((q) => q !== b); st.money += Math.round(BUILDINGS[b.type].price / 2); hud(); save(); });
};

// ---------- interfaz ----------
const sheet = new Sheet();
// ---------- vista de cerca ----------
let close = null, followId = null, cardT = 0, nestCard = null;
function animalWorld(aid) { const m = animalMeshes.get(aid); return m ? m.g.position : null; }
function enterClose(e) {
  close = e.id; followId = null; nestCard = null; sheet.close(); setTool(null); closeModal();
  eng.cam.follow = null; eng.cam.min = 1.5; eng.cam.tx = new THREE.Vector3(e.x + e.n / 2, 0, e.z + e.n / 2); eng.cam.distT = eng.fitDist(e.n * 0.95); eng.cam.pitchT = 0.42;
  $('#closebar').hidden = false; $('#tools').parentElement.classList.add('closing'); renderCloseBar();
}
function exitClose() {
  close = null; followId = null; nestCard = null; eng.cam.follow = null; eng.cam.min = 4; eng.cam.pitchT = 0.9; eng.cam.distT = eng.fitDist(15);
  $('#closebar').hidden = true; $('#animalcard').hidden = true; $('#tools').parentElement.classList.remove('closing');
}
function followAnimal(aid) { followId = aid; nestCard = null; eng.follow(() => (followId ? animalWorld(followId) : null)); eng.cam.distT = Math.min(eng.cam.dist, eng.fitDist(3.2)); cardT = 0; animalCardTick(true); }
function renderCloseBar() {
  const e = st.enclosures.find((q) => q.id === close); if (!e) return exitClose();
  const as = animalsIn(e);
  const key = e.id + as.length + e.biome; if ($('#closebar').dataset.k === key) return; $('#closebar').dataset.k = key;
  $('#closebar').innerHTML = `<span class="ttl">${icon('fence')} ${BIOMES[e.biome].label} · ${as.length} ${as.length === 1 ? 'animal' : 'animales'}</span><button class="btn sm" id="cb_f">${icon('eye')} Seguir a uno</button><button class="btn sm alt" id="cb_i">${icon('menu')} Ficha</button><button class="btn sm alt" id="cb_x">${icon('x')}</button>`;
  $('#cb_f').onclick = () => { if (!as.length) return; const i = as.findIndex((a) => a.id === followId); followAnimal(as[(i + 1) % as.length].id); };
  $('#cb_i').onclick = () => encCard(e);
  $('#cb_x').onclick = exitClose;
}
function animalCardTick(force = false) {
  const el = $('#animalcard'); const now = performance.now(); if (!force && now - cardT < 600) return; cardT = now;
  if (nestCard) {
    const e = st.enclosures.find((q) => q.id === nestCard); const n = e && (e.nests || [])[0];
    if (!n) { nestCard = null; el.hidden = true; return; }
    el.innerHTML = `<b>${icon('egg')} Nido de ${SPECIES[n.sp].label.toLowerCase()}</b><div class="hint">${n.n + 1} huevos · eclosionan en unas ${Math.max(1, Math.round((n.until - st.time) / 60))} h</div>`; el.hidden = false; return;
  }
  const a = followId && st.animals.find((q) => q.id === followId); if (!a) { el.hidden = true; return; }
  const S = SPECIES[a.sp]; const kids = st.animals.filter((k) => k.mother === a.id && k.baby).length; const mom = a.mother && st.animals.find((m) => m.id === a.mother);
  el.innerHTML = `<div class="row" style="align-items:center"><span class="tilebox" style="background:${BIOMES[S.biome].color}">${icon('paw')}</span><div style="flex:1;min-width:0"><b>${esc(a.name)}</b> <span class="hint">${S.label} · ${a.sex === 'm' ? '♂' : '♀'}${a.baby ? ' · cría' : ''}</span>
    <div class="hint">Está ${STATE_TXT[a.state] || 'tranquilo'}${a.preg ? ` · embarazada (nace en ${Math.max(1, Math.round((a.preg.until - st.time) / 60))} h)` : ''}${kids ? ` · ${kids} ${kids > 1 ? 'crías' : 'cría'}` : ''}${mom ? ` · hija de ${esc(mom.name)}` : ''}</div></div></div>
    <div class="stat" style="margin:6px 0 0"><span class="tile" style="background:#f08a3c">${icon('food')}</span><span>Hambre</span><div class="bar"><i style="transform:scaleX(${a.hunger / 100});background:${a.hunger < 30 ? '#e5484d' : '#f08a3c'}"></i></div></div>
    <div class="stat" style="margin:4px 0 0"><span class="tile" style="background:#25c48f">${icon('heart')}</span><span>Felicidad</span><div class="bar"><i style="transform:scaleX(${a.happy / 100});background:${a.happy < 35 ? '#e5484d' : '#25c48f'}"></i></div></div>`;
  el.hidden = false;
}
function hud() {
  $('#money b').textContent = eur(st.money);
  const h = hourOf(st.time); const open = h >= 9 && h < 20;
  $('#clock .t b').textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(st.time % 60)).padStart(2, '0')}`;
  $('#clock .t span').textContent = `Día ${dayOf(st.time) + 1} · ${open ? 'Abierto' : 'Cerrado'} · ${visitors.length} visitantes`;
  $('#fame b').textContent = `${stars()}★`;
  document.querySelectorAll('#speeds button').forEach((b) => b.classList.toggle('on', +b.dataset.s === st.speed));
  document.querySelectorAll('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.t === sheet.name || (b.dataset.t === 'path' && view.tool === 'path')));
}
function renderToolInfo() {
  const el = $('#toolinfo'); if (!view.tool) { el.hidden = true; return; } el.hidden = false;
  let txt = '';
  if (view.tool === 'path') txt = `${icon('path')} ${view.erase ? 'Borrar caminos: arrastra el dedo' : `Caminos: arrastra el dedo · ${PATH_PRICE} € por casilla`} <button class="btn sm alt" id="ti_erase">${view.erase ? 'Construir' : 'Borrar'}</button>`;
  if (view.tool === 'enc') txt = `${icon('fence')} Recinto ${SIZES[view.opt.size].label.toLowerCase()} de ${BIOMES[view.opt.biome].label.toLowerCase()} · toca el terreno ${view.pending ? `<button class="btn sm mint" id="ti_ok">Construir · ${eur(SIZES[view.opt.size].price)}</button>` : ''}`;
  if (view.tool === 'animal') txt = `${icon('paw')} Toca un recinto para soltar: ${SPECIES[view.opt].label} (${eur(SPECIES[view.opt].price)})`;
  if (view.tool === 'enrich') txt = `${icon('tree')} Toca dentro de un recinto: ${ENRICH[view.opt].label}`;
  if (view.tool === 'build') txt = `${icon('shop')} Toca una casilla libre${BUILDINGS[view.opt].cat === 'Tiendas' ? ' junto a un camino' : ''}: ${BUILDINGS[view.opt].label}`;
  el.innerHTML = `${txt}<button class="x" id="ti_x" aria-label="Terminar">${icon('x')}</button>`;
  $('#ti_x').onclick = () => setTool(null);
  const er = $('#ti_erase'); if (er) er.onclick = () => { view.erase = !view.erase; renderToolInfo(); };
  const ok = $('#ti_ok'); if (ok) ok.onclick = () => {
    const p = view.pending; const price = SIZES[view.opt.size].price; if (st.money < price) return toast('No hay dinero suficiente', 'warn');
    if (!canPlaceEnclosure(p.x, p.z, p.n)) return;
    st.money -= price; const e = { id: id(), x: p.x, z: p.z, n: p.n, biome: view.opt.biome, items: [] }; st.enclosures.push(e);
    if (!encTouchesPath(e)) toast('Haz un camino hasta el recinto para que los visitantes lo vean', 'warn', 'path');
    view.pending = null; showGhost(null); setTool(null); hud(); save();
  };
}
function openPanel(name) {
  if (sheet.name === name) return sheet.close();
  setTool(null);
  const titles = { enc: 'Recintos', animal: 'Animales', build: 'Tiendas y decoración', staff: 'Personal', info: 'Parque' };
  sheet.open(name, titles[name]); renderPanel(); hud();
}
function renderPanel() {
  const b = sheet.body; const name = sheet.name;
  if (name === 'enc') {
    const sel = view.encSel || { biome: 'sabana', size: 'M' };
    b.innerHTML = `<div class="sec">Hábitat</div><div class="seg" id="pb">${Object.entries(BIOMES).map(([k, v]) => `<button data-v="${k}" class="${k === sel.biome ? 'on' : ''}">${v.label}</button>`).join('')}</div>
      <div class="sec">Tamaño</div><div class="grid">${Object.entries(SIZES).map(([k, v]) => `<button class="item ${k === sel.size ? 'on' : ''}" data-s="${k}"><span class="tilebox" style="background:${BIOMES[sel.biome].color}">${icon('fence')}</span>${v.label} ${v.n}×${v.n}<span class="p">${eur(v.price)}</span></button>`).join('')}</div>
      <p class="hint">Cada especie prefiere un hábitat y necesita espacio. Coloca el recinto junto a un camino para que lo vean los visitantes.</p>
      <button class="btn coral" id="pgo" style="width:100%;margin-top:8px">${icon('fence')} Colocar recinto</button>
      <div class="sec">Objetos para los animales</div><div class="grid">${Object.entries(ENRICH).map(([k, v]) => `<button class="item" data-e="${k}"><span class="tilebox">${icon(v.ic)}</span>${v.label}<span class="p">${eur(v.price)}</span></button>`).join('')}</div>`;
    b.querySelector('#pb').onclick = (e) => { const x = e.target.closest('button'); if (x) { view.encSel = { ...sel, biome: x.dataset.v }; renderPanel(); } };
    b.querySelectorAll('[data-s]').forEach((x) => (x.onclick = () => { view.encSel = { ...sel, size: x.dataset.s }; renderPanel(); }));
    b.querySelector('#pgo').onclick = () => { sheet.close(); setTool('enc', sel); };
    b.querySelectorAll('[data-e]').forEach((x) => (x.onclick = () => { sheet.close(); setTool('enrich', x.dataset.e); }));
  }
  if (name === 'animal') {
    b.innerHTML = `<p class="hint">Más fama desbloquea especies. Las felices tienen crías si hay macho y hembra y espacio.</p><div class="grid">${Object.entries(SPECIES).map(([k, v]) => { const lock = st.fame < v.fame; return `<button class="item" data-a="${k}" ${lock ? 'disabled' : ''}><span class="tilebox" style="background:${BIOMES[v.biome].color}">${icon('paw')}</span>${v.label}<span class="d">${BIOMES[v.biome].label}</span>${lock ? `<span class="lock">Fama ${v.fame}★</span>` : `<span class="p">${eur(v.price)}</span>`}</button>`; }).join('')}</div>`;
    b.querySelectorAll('[data-a]').forEach((x) => (x.onclick = () => { sheet.close(); setTool('animal', x.dataset.a); }));
  }
  if (name === 'build') {
    const cats = ['Tiendas', 'Decoración'];
    b.innerHTML = cats.map((c) => `<div class="sec">${c}</div><div class="grid">${Object.entries(BUILDINGS).filter(([, v]) => v.cat === c).map(([k, v]) => `<button class="item" data-b="${k}"><span class="tilebox" ${v.color ? `style="background:${v.color};color:#fff"` : ''}>${icon(v.ic)}</span>${v.label}<span class="p">${eur(v.price)}</span>${v.sells ? `<span class="d">Vende a ${v.sells} €</span>` : ''}</button>`).join('')}</div>`).join('') + '<p class="hint">Las tiendas dan dinero y cubren hambre, sed y aseo de los visitantes. La decoración y las papeleras les ponen de buen humor.</p>';
    b.querySelectorAll('[data-b]').forEach((x) => (x.onclick = () => { sheet.close(); setTool('build', x.dataset.b); }));
  }
  if (name === 'staff') {
    const row = (k, label, desc) => `<div class="card"><div class="row" style="align-items:center"><span class="tilebox">${icon(k === 'keeper' ? 'paw' : 'broom')}</span><div style="flex:1"><b>${label}: ${st.staff[k]}</b><div class="hint">${desc} · ${WAGES[k]} €/día</div></div><button class="btn sm alt" data-m="${k}">−</button><button class="btn sm" data-p="${k}">+</button></div></div>`;
    b.innerHTML = row('keeper', 'Cuidadores', `Alimentan 8 animales cada uno (tienes ${st.animals.length})`) + row('cleaner', 'Limpiadores', `Recogen la basura (hay ${st.litter.length} restos)`);
    b.querySelectorAll('[data-p]').forEach((x) => (x.onclick = () => { st.staff[x.dataset.p]++; renderPanel(); save(); }));
    b.querySelectorAll('[data-m]').forEach((x) => (x.onclick = () => { st.staff[x.dataset.m] = Math.max(0, st.staff[x.dataset.m] - 1); renderPanel(); save(); }));
  }
  if (name === 'info') {
    const last = st.history[0];
    b.innerHTML = `<div class="card"><div class="stat"><span class="tile" style="background:#f5a524">${icon('star')}</span><span>Fama</span><div class="bar"><i style="transform:scaleX(${st.fame / 5});background:#f5a524"></i></div></div>
      <div class="stat"><span class="tile" style="background:#25c48f">${icon('users')}</span><span>Hoy</span><b>${st.today.visitors} visitantes · ${eur(st.today.income)}</b></div>
      ${last ? `<div class="stat"><span class="tile" style="background:#2fa8e0">${icon('chart')}</span><span>Ayer</span><b>${eur(last.profit)} de beneficio</b></div>` : ''}
      <div class="stat"><span class="tile" style="background:#8b5cf6">${icon('paw')}</span><span>Animales</span><b>${st.animals.length} en ${st.enclosures.length} recintos</b></div></div>
      <div class="sec">Precio de la entrada</div><div class="row" style="align-items:center"><button class="btn sm alt" id="tm">−</button><b style="flex:1;text-align:center;font-size:20px">${st.ticket} €</b><button class="btn sm alt" id="tp">+</button></div>
      <p class="hint">Más caro da más por visitante pero vienen menos.</p>
      <div class="sec">Calidad gráfica</div><div class="seg" id="q"><button data-v="eco">Ahorro</button><button data-v="alta">Alta</button></div>
      <div class="row" style="margin-top:16px"><a class="btn alt" href="../">${icon('home')} Menú de juegos</a><button class="btn red" id="reset">${icon('trash')} Empezar de nuevo</button></div>`;
    b.querySelector('#tm').onclick = () => { st.ticket = Math.max(0, st.ticket - 5); renderPanel(); };
    b.querySelector('#tp').onclick = () => { st.ticket = Math.min(60, st.ticket + 5); renderPanel(); };
    const q = localStorage.getItem('sim_quality') || (eng.hq ? 'alta' : 'eco'); b.querySelectorAll('#q button').forEach((x) => { x.classList.toggle('on', x.dataset.v === q); x.onclick = () => { localStorage.setItem('sim_quality', x.dataset.v); save(); location.reload(); }; });
    b.querySelector('#reset').onclick = () => confirm('Se borrará tu parque. ¿Empezar de cero?', () => { localStorage.removeItem(KEY); st = newPark(); visitors = []; sig = {}; sheet.close(); hud(); save(); });
  }
}
function encCard(e) {
  const as = animalsIn(e); const happy = Math.round(encHappy(e));
  const box2 = modal(`<h2>Recinto de ${BIOMES[e.biome].label.toLowerCase()}</h2><p class="hint">${e.n}×${e.n} · ${e.items.length} objetos · ánimo medio ${happy}%</p>
    <div class="list">${as.map((a) => `<div class="li"><span class="tilebox">${icon('paw')}</span><div style="flex:1"><b>${SPECIES[a.sp].label}${a.baby ? ' (cría)' : ''}</b> <span class="hint">${a.sex === 'm' ? '♂' : '♀'}</span>
      <div class="hint">Hambre ${Math.round(a.hunger)}% · Feliz ${Math.round(a.happy)}%${e.biome !== SPECIES[a.sp].biome ? ' · hábitat equivocado' : ''}</div></div><button class="btn sm alt" data-sell="${a.id}">Vender</button></div>`).join('') || '<p class="hint">Aún no hay animales. Ve a Animales y toca este recinto.</p>'}</div>
    <div class="actions" style="flex-direction:column"><button class="btn" id="seeclose">${icon('eye')} Ver de cerca</button><button class="btn coral" id="feed" ${as.length ? '' : 'disabled'}>${icon('food')} Dar de comer (${as.length * 5} €)</button><button class="btn alt" id="demo">${icon('trash')} Derribar recinto</button><button class="btn alt" id="close">Cerrar</button></div>`);
  box2.querySelector('#close').onclick = closeModal;
  box2.querySelector('#seeclose').onclick = () => enterClose(e);
  box2.querySelector('#feed').onclick = () => { if (st.money < as.length * 5) return toast('No hay dinero suficiente', 'warn'); st.money -= as.length * 5; putFood(e); closeModal(); toast('Has dejado comida en el recinto', 'good', 'food'); hud(); };
  box2.querySelector('#demo').onclick = () => { closeModal(); confirm(`Se venderán los ${as.length} animales. ¿Derribar?`, () => { st.money += as.reduce((t, a) => t + SPECIES[a.sp].price * 0.6, 0) + SIZES[Object.keys(SIZES).find((k) => SIZES[k].n === e.n)].price * 0.4; st.animals = st.animals.filter((a) => a.enc !== e.id); st.enclosures = st.enclosures.filter((q) => q !== e); hud(); save(); }); };
  box2.querySelectorAll('[data-sell]').forEach((x) => (x.onclick = () => { const a = st.animals.find((q) => q.id === x.dataset.sell); st.money += Math.round(SPECIES[a.sp].price * (a.baby ? 0.4 : 0.6)); st.animals = st.animals.filter((q) => q !== a); closeModal(); encCard(e); hud(); save(); }));
}
function animalCard(aid) { const a = st.animals.find((q) => q.id === aid); if (!a) return; encCard(st.enclosures.find((e) => e.id === a.enc)); }

document.querySelector('#speeds').innerHTML = [['pause', 0], ['play', 1], ['ff', 2], ['fff', 3]].map(([ic, s]) => `<button data-s="${s}">${icon(ic)}</button>`).join('');
document.querySelector('#speeds').onclick = (e) => { const b = e.target.closest('button'); if (b) { st.speed = +b.dataset.s; hud(); } };
document.querySelector('#tools').innerHTML = [['path', 'path', 'Caminos'], ['enc', 'fence', 'Recintos'], ['animal', 'paw', 'Animales'], ['build', 'shop', 'Tiendas'], ['staff', 'users', 'Personal'], ['info', 'chart', 'Parque']].map(([t, ic, l]) => `<button data-t="${t}">${icon(ic)}<span>${l}</span></button>`).join('');
document.querySelector('#tools').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.t === 'path') { sheet.close(); setTool(view.tool === 'path' ? null : 'path'); hud(); } else openPanel(b.dataset.t); };
$('#money .badge').innerHTML = icon('coin'); $('#clock .badge').innerHTML = icon('sun'); $('#fame .badge').innerHTML = icon('star'); $('#back a').innerHTML = icon('home');
$('#camctl').innerHTML = `<button class="glass" data-r="1">${icon('rotate')}</button><button class="glass" data-r="-1" style="transform:scaleX(-1)">${icon('rotate')}</button>`;
$('#camctl').onclick = (e) => { const b = e.target.closest('button'); if (b) eng.spin(+b.dataset.r * Math.PI / 4); };
sheet.onClose = () => hud();

// ---------- bucle ----------
let uiT = 0, saveT = 0;
eng.onFrame = (dt) => {
  const paused = modalOpen() || st.speed === 0;
  if (!paused) { let g = dt * SPEEDS[st.speed]; while (g > 0) { const s = Math.min(g, 2); tick(s); g -= s; } }
  eng.activity = close ? 'close' : paused ? 'idle' : visitors.length && eng.cam.dist < 22 ? 'busy' : 'calm';
  if (close) { animalCardTick(); if (uiT > 0.45) renderCloseBar(); }
  uiT += dt; saveT += dt;
  if (uiT > 0.5) { uiT = 0; hud(); if (sheet.name === 'staff' || sheet.name === 'info') { /* refresco ligero */ } }
  if (saveT > 20) { saveT = 0; save(); }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); else { offline(); hud(); } });
window.addEventListener('pagehide', save);
if (store.load(KEY)) offline(); else info('Te damos la bienvenida a Parque Salvaje', `<p>Construye tu propio parque de animales:</p><ul style="padding-left:18px;line-height:1.6"><li><b>Recintos</b>: elige hábitat y tamaño, junto a un camino.</li><li><b>Animales</b>: cada especie quiere su hábitat, espacio y compañía.</li><li><b>Caminos</b>: arrastra el dedo para que lleguen los visitantes.</li><li><b>Tiendas</b> y <b>decoración</b> para que gasten y vuelvan contentos.</li><li>La <b>fama</b> desbloquea especies nuevas.</li></ul>`, '¡A construir!');
hud();
window.zoo = { eng, THREE, enterClose, rebuildEnclosures, get st() { return st; }, get visitors() { return visitors; } };
