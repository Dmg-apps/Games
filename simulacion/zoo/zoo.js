// Parque Salvaje: gestiona tu propio parque de animales.
import { Engine, THREE, mat, blob, box, canvasTexture } from '../shared/engine3d.js';
import * as Look from '../shared/look.js';
import { buildingMesh as propMesh, People, GlbPeople } from './props3d.js';
import { animalModel as organicModel, setDetail as setAnimalDetail } from './animals3d.js';
import { cubeModel } from './cube3d.js';
import { $, esc, eur, icon, toast, modal, closeModal, modalOpen, info, confirm, Sheet, store, trash, edgePan, say, pickOne, Sound } from '../shared/ui.js';
import { autoSync, pullSlot, session as cloudSession } from '../shared/cloud.js';
import { renderCloud, chooseSave } from '../shared/cloudui.js';
import { thumbs, preview } from '../shared/thumbs.js';
import { loadModel, peek, instance as modelInstance, preload as preloadModels, staticModel } from '../shared/assets.js';
import { N, ENTRANCE, BIOMES, SIZES, SPECIES, ENRICH, enrichFor, BUILDINGS, PATH_PRICE, WAGES, FOOD_COST, ANIMAL_NAMES, CARNIVORES, HYBRIDS, CROSSES, crossChild, TRAITS, ILLNESS, VET_VISIT } from './data.js';

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
const HAD_LOCAL = !!store.load(KEY);
let st = store.load(KEY) || newPark();
st.staff.vet ??= 0;
for (const a of st.animals) a.trait ||= pick(Object.keys(TRAITS));
const traitLabel = (a) => TRAITS[a.trait]?.[a.sex] || '';
const LOCAL_SAVED_AT = HAD_LOCAL ? st.lastSaved : 0;
// Copia en la nube (cuenta común a toda la app)
const cloud = autoSync('parque', () => st);
let swapping = false; // al cambiar a la partida de la nube no se vuelve a guardar la de aquí
function useRemote(state) { swapping = true; store.save(KEY, state); sessionStorage.setItem('cloud_restored', '1'); location.reload(); }
async function afterCloudLogin() { const r = await pullSlot('parque'); if (r === undefined) return; if (r) chooseSave(r.savedAt, () => useRemote(r.state), () => cloud.keepLocal()); else cloud.keepLocal(); }
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
  const enrich = e.items.reduce((n, i) => n + (ENRICH[i.type]?.biome === e.biome ? 1.5 : ENRICH[i.type]?.biome ? 0.3 : 1), 0);
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
// Lo que dicen los visitantes (bocadillos sobre sus cabezas)
function logEvent(kind, text, who) { (st.today.events ||= []).push({ kind, text, who }); }
function speak(v, text) { if (visitors.filter((q) => q.say && q.say.until > st.time).length >= 4) return; v.say = { text, until: st.time + 9 }; }
function comment(v, e, as) {
  if (Math.random() > 0.35 || !as.length) return; const a = pick(as); const S = SPECIES[a.sp]; const name = a.name, sp = S.label.toLowerCase(); const un = S.fem ? 'una' : 'un', o = S.fem ? 'a' : 'o', ese = S.fem ? 'Esa' : 'Ese';
  const opts = [];
  if (S.hybrid) opts.push(`¿Eso es ${un} ${sp}?`, `¡Nunca había visto ${un} ${sp}!`, `¡Hay que hacerle una foto a ${name}!`);
  if (a.baby) opts.push(`¡Una cría de ${sp}!`, `¡Qué cosa más pequeña!`, `¡Mira, mamá, un bebé!`);
  if (a.trait === 'presumido') opts.push(`¡Cómo posa ${name}!`, `${name} sabe que la miramos…`);
  if (a.trait === 'curioso' && a.state === 'watch') opts.push(`¡${name} nos está mirando!`, `¡Hola, ${name}!`);
  if (a.state === 'sleep') opts.push(`Shhh, ${name} duerme`, `Qué siesta lleva…`);
  if (a.state === 'play') opts.push(`¡Mira cómo juega!`, `¡Qué divertido!`);
  if (encHappy(e) < 35) opts.push(`${ese} ${sp} parece triste…`, `Necesitan más espacio`);
  if (!opts.length) opts.push(`¡Qué ${sp} tan bonit${o}!`, `¡Mira, ${un} ${sp}!`, `Me encanta este parque`, `¿Cómo se llama ese? ¡${name}!`);
  speak(v, pick(opts));
}
function visitorArrive(v) {
  const t = v.target; v.target = null; if (!t) return;
  if (t.enc && !v.seen.has(t.enc)) {
    const e = st.enclosures.find((q) => q.id === t.enc); if (e) {
      v.seen.add(t.enc); const as = animalsIn(e); comment(v, e, as);
      const appeal = as.reduce((s, a) => s + SPECIES[a.sp].appeal * (a.baby ? 1.5 : 1), 0);
      v.happy = clamp(v.happy + Math.min(30, appeal * 1.6) * (encHappy(e) / 100) + (encHappy(e) < 35 ? -6 : 0) + as.filter((a) => a.trait === 'presumido' || a.trait === 'curioso').length * 3);
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
  if (Math.random() < 0.02 * dt && visitors.length) { const v = pick(visitors); if (v.hambre > 75) speak(v, pick(['¡Qué hambre tengo!', '¿Dónde se come aquí?'])); else if (v.sed > 75) speak(v, pick(['Necesito beber algo…', '¡Qué sed!'])); else if (st.litter.length > 12) speak(v, pick(['Qué sucio está esto…', 'Faltan papeleras'])); else if (v.happy > 85) speak(v, pick(['¡Volveré seguro!', '¡Qué día tan bonito!'])); }
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
  const used = new Set(st.animals.map((q) => q.name)); const free = ANIMAL_NAMES.filter((n) => !used.has(n));
  const a = { id: id(), sp, enc: e.id, x: e.x + rnd(0.5, e.n - 0.5), z: e.z + rnd(0.5, e.n - 0.5), tx: null, tz: null, hunger: 80, happy: 70, sex: Math.random() < 0.5 ? 'm' : 'f', baby, born: st.time, name: free.length ? pick(free) : pick(ANIMAL_NAMES) + ' ' + (used.size + 1), state: 'wander', trait: pick(Object.keys(TRAITS)) };
  st.animals.push(a); return a;
}
function animalsTick(dt) {
  for (const a of st.animals) {
    a.hunger = clamp(a.hunger - 0.07 * dt * (a.trait === 'gloton' ? 1.5 : 1));
    a.happy += (animalHappy(a) - a.happy) * Math.min(1, 0.02 * dt);
    if (a.baby && st.time - a.born > 4 * 1440) { a.baby = false; toast(`La cría de ${SPECIES[a.sp].label.toLowerCase()} ya es adulta`, 'good', 'paw'); }
    const e = st.enclosures.find((q) => q.id === a.enc); if (!e) continue;
    if (a.preg && st.time >= a.preg.until) {
      const child = a.preg.child || a.sp; a.preg = null; const b = addAnimal(child, e, true); b.mother = a.id; b.x = a.x + 0.2; b.z = a.z + 0.2;
      logEvent(child !== a.sp ? 'hybrid' : 'birth', SPECIES[child].label, a.name);
      if (child !== a.sp) { const first = !(st.hybrids ||= []).includes(child); if (first) st.hybrids.push(child); st.fame = clamp(st.fame + (first ? 0.4 : 0.1), 0, 5); toast(`¡Nueva cría híbrida: ${SPECIES[child].label}!${first ? ' Nueva en tu colección de cruces' : ''}`, 'good', 'sparkle'); }
      else toast(`¡${a.name} (${SPECIES[a.sp].label.toLowerCase()}) ha tenido una cría!`, 'good', 'heart');
    }
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
// ---------- salud ----------
// Enferman más si pasan hambre, están tristes, el parque está sucio o viven en un hábitat que no es el suyo.
// Se contagian dentro del recinto. Se curan llamando al veterinario o con un veterinario en plantilla.
function sickRisk(a) {
  const e = st.enclosures.find((q) => q.id === a.enc); if (!e) return 0;
  let r = 0.003 + (a.hunger < 30 ? 0.02 : 0) + (a.happy < 35 ? 0.015 : 0) + (st.litter.length > 15 ? 0.01 : 0) + (e.biome !== SPECIES[a.sp].biome ? 0.008 : 0);
  if (animalsIn(e).some((o) => o !== a && o.sick)) r += 0.02;
  return r;
}
function sickWhy(a) {
  const e = st.enclosures.find((q) => q.id === a.enc); const w = [];
  if (a.hunger < 30) w.push('pasa hambre'); if (a.happy < 35) w.push('está triste'); if (st.litter.length > 15) w.push('hay mucha basura');
  if (e && e.biome !== SPECIES[a.sp].biome) w.push(`no es su hábitat (prefiere ${BIOMES[SPECIES[a.sp].biome].label.toLowerCase()})`);
  return w;
}
function cure(a) { a.sick = null; a.restUntil = 0; }
function health() {
  const vets = st.staff.vet || 0; let cured = 0;
  for (const a of st.animals) {
    if (a.sick) { a.happy = clamp(a.happy - 2); if (vets && cured < vets * 3 && st.time - a.sick.since > 60) { cure(a); cured++; toast(`El veterinario ha curado a ${a.name}`, 'good', 'heart'); } continue; }
    if (Math.random() < sickRisk(a)) { a.sick = { kind: pick(Object.keys(ILLNESS)), since: st.time }; const why = sickWhy(a); toast(`${a.name} se encuentra mal: ${ILLNESS[a.sick.kind].toLowerCase()}. ${vets ? 'El veterinario lo atenderá.' : 'Toca el animal y llama al veterinario.'}${why.length ? ' Causa: ' + why[0] + '.' : ''}`, 'warn', 'alert'); logEvent('sick', a.name); }
  }
}
function callVet(a) {
  if (!a?.sick) return; if (st.money < VET_VISIT) return toast('No hay dinero suficiente para el veterinario', 'warn');
  st.money -= VET_VISIT; cure(a); toast(`El veterinario ha curado a ${a.name} (${eur(VET_VISIT)})`, 'good', 'heart'); hud(); save(); animalCardTick(true);
}
// Qué hace un animal ahora: dormir de noche, comer si hay comida, beber, pastar, jugar, seguir a su madre...
function decide(a, e) {
  const S = SPECIES[a.sp], h = hourOf(st.time), inside = (x, z) => ({ x: Math.min(e.x + e.n - 0.5, Math.max(e.x + 0.5, x)), z: Math.min(e.z + e.n - 0.5, Math.max(e.z + 0.5, z)) });
  const go = (x, z, state, mins) => { const p = inside(x, z); a.tx = p.x; a.tz = p.z; a.state = state; a.restUntil = st.time + mins; };
  if (a.sick && Math.random() < 0.7) return go(a.x, a.z, 'sick', rnd(20, 40));
  if (h >= 21 || h < 6) { if (a.state !== 'sleep') { const mom = a.mother && st.animals.find((m) => m.id === a.mother); go(mom ? mom.x + 0.2 : a.x + rnd(-1, 1), mom ? mom.z + 0.15 : a.z + rnd(-1, 1), 'sleep', 60); } else a.restUntil = st.time + 30; return; }
  if (e.food && st.time < e.food.until && a.hunger < 90) return go(e.food.x + rnd(-0.35, 0.35), e.food.z + rnd(-0.35, 0.35), 'eat', 25);
  const mom = a.baby && a.mother && st.animals.find((m) => m.id === a.mother && m.enc === a.enc);
  if (mom && Math.random() < 0.75) return go(mom.x + rnd(-0.5, 0.5), mom.z + rnd(-0.5, 0.5), 'follow', rnd(2, 6));
  const pond = e.items.find((i) => ENRICH[i.type]?.water), toy = e.items.find((i) => ENRICH[i.type]?.play);
  const r = Math.random();
  // carácter
  if (a.trait === 'dormilon' && r < 0.3) return go(a.x, a.z, 'sleep', rnd(20, 50));
  if (a.trait === 'jugueton' && r < 0.35) return toy ? go(toy.x + 0.5, toy.z + 0.5, 'play', 12) : go(a.x + rnd(-1.5, 1.5), a.z + rnd(-1.5, 1.5), 'play', 4);
  if (a.trait === 'curioso' && r < 0.4) { const P = pathSet(); let best = null; for (let i = 0; i < e.n; i++) for (const [x, z, ox, oz] of [[e.x + i, e.z - 1, 0.5, 0.6], [e.x + i, e.z + e.n, 0.5, -0.6], [e.x - 1, e.z + i, 0.6, 0.5], [e.x + e.n, e.z + i, -0.6, 0.5]]) if (P.has(pk(x, z))) best = [x + ox, z + oz]; if (best) return go(best[0], best[1], 'watch', rnd(10, 25)); }
  if (a.trait === 'timido' && r < 0.45) { const hide = e.items.find((i) => ENRICH[i.type]?.hide); if (hide) return go(hide.x + 0.5 + rnd(-0.5, 0.5), hide.z + 0.5 + rnd(-0.5, 0.5), 'hide', rnd(15, 35)); }
  if (a.trait === 'presumido' && r < 0.3) return go(a.x, a.z, 'pose', rnd(6, 14));
  if (a.trait === 'grunon' && r < 0.4) { const near = animalsIn(e).find((o) => o !== a && Math.hypot(o.x - a.x, o.z - a.z) < 1.2); if (near) return go(a.x + (a.x - near.x) * 2, a.z + (a.z - near.z) * 2, 'wander', 0); }
  if (pond && r < 0.12) return go(pond.x + 0.5 + rnd(-0.6, 0.6), pond.z + 0.5 + rnd(-0.6, 0.6), 'drink', 12);
  if (toy && r < 0.2) return go(toy.x + 0.5, toy.z + 0.5, 'play', 10);
  if (!CARNIVORES.includes(a.sp) && r < 0.45) return go(a.x + rnd(-0.5, 0.5), a.z + rnd(-0.5, 0.5), 'graze', rnd(8, 20));
  if (r < 0.65) return go(a.x, a.z, 'rest', rnd(6, 20));
  go(e.x + rnd(0.6, e.n - 0.6), e.z + rnd(0.6, e.n - 0.6), 'wander', 0);
}
const STATE_TXT = { sick: 'tumbado, se encuentra mal', watch: 'mirando a los visitantes', hide: 'escondido', pose: 'posando para las fotos', wander: 'paseando', rest: 'descansando', graze: 'pastando', eat: 'comiendo', drink: 'bebiendo', sleep: 'durmiendo', play: 'jugando', follow: 'siguiendo a su madre' };
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
      if (SPECIES[sp].sterile) continue;
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
      logEvent('hatch', SPECIES[n.sp].label, n.n);
      for (let i = 0; i < n.n; i++) { const b = addAnimal(n.sp, e, true); b.mother = n.mother; b.x = n.x + rnd(-0.2, 0.2); b.z = n.z + rnd(-0.2, 0.2); }
      toast(`¡Han salido ${n.n > 1 ? `${n.n} crías` : 'una cría'} del nido de ${SPECIES[n.sp].label.toLowerCase()}!`, 'good', 'egg');
    }
    if (e.nests) e.nests = e.nests.filter((q) => st.time < q.until);
  }
}
function hourly(h) {
  hatchNests(); health();
  if (h === 9 || h === 17) feedTimes();
  if (h === 6) breeding();
  for (let i = 0; i < st.staff.cleaner * 2 && st.litter.length; i++) st.litter.shift();
  if (h === 21) endOfDay();
}
// Al final del día: "La Gaceta Salvaje", el periódico del parque, con los titulares de la jornada
function endOfDay() {
  const wages = st.staff.keeper * WAGES.keeper + st.staff.cleaner * WAGES.cleaner + (st.staff.vet || 0) * WAGES.vet, food = st.animals.length * FOOD_COST;
  st.money -= wages + food; st.today.spent += wages + food;
  const d = { day: dayOf(st.time) + 1, ...st.today, profit: st.today.income - st.today.spent, stars: stars() };
  const prevBest = Math.max(0, ...st.history.map((h) => h.visitors));
  st.history.unshift({ ...d, events: undefined }); st.history.length = Math.min(st.history.length, 14);
  const ev = st.today.events || []; const find = (k) => ev.filter((e) => e.kind === k);
  let head, body;
  if (find('hybrid').length) { const e = find('hybrid')[0]; head = `¡Nace ${Object.values(SPECIES).find((q) => q.label === e.text)?.fem ? 'una' : 'un'} ${e.text.toLowerCase()} en el parque!`; body = `La pequeña criatura, hija de ${e.who}, ya es la estrella del parque. Se esperan colas para verla.`; }
  else if (find('birth').length || find('hatch').length) { const e = find('birth')[0] || find('hatch')[0]; head = e.kind === 'hatch' ? `Eclosionan huevos de ${e.text.toLowerCase()}` : `${e.who} ya es madre`; body = e.kind === 'hatch' ? 'Los cuidadores no se separan del nido. Las crías ya pían.' : `La cría de ${e.text.toLowerCase()} da sus primeros pasos ante la mirada de los visitantes.`; }
  else if (find('newsp').length) { const e = find('newsp')[0]; head = `Llega la primera especie de ${e.text.toLowerCase()}`; body = `${e.who} ha llegado hoy y ya curiosea su nuevo hogar.`; }
  else if (d.visitors > prevBest && d.visitors > 5) { head = `Récord: ${d.visitors} visitantes en un solo día`; body = 'Las taquillas no daban abasto. ¿Hará falta otra tienda de helados?'; }
  else if (d.profit < 0) { head = 'Un día flojo en taquilla'; body = 'Los expertos recomiendan animales más felices, más tiendas y algo de decoración.'; }
  else if (!st.animals.length) { head = 'Se busca: animales'; body = 'Los visitantes preguntan dónde están los animales. Toca Animales y elige un recinto.'; }
  else { const a = pick(st.animals); head = `${a.name}, ${(traitLabel(a) || 'tranquilo').toLowerCase()} como siempre`; body = `Los visitantes no se pierden a ${a.name}: ${TRAITS[a.trait]?.desc.toLowerCase() || 'una estrella del parque.'}`; }
  const quote = d.profit >= 0 ? pickOne(['Así da gusto. Mañana, más y mejor.', 'Buen día. Los animales están contentos, y yo también.', 'Si seguimos así, habrá que ampliar el parque.']) : pickOne(['Mañana será otro día. Revisa que los animales coman bien.', 'Unas flores y un banco nunca sobran, hazme caso.', 'Los visitantes vuelven si salen contentos. Cuidemos los detalles.']);
  Sound.play('page');
  say('rufina', null, `«${quote}»`, 'Siguiente día', null, `<div class="gazette"><div class="mast">La Gaceta Salvaje</div><div class="date">Día ${d.day} · ${'★'.repeat(Math.floor(d.stars))}${d.stars % 1 ? '½' : ''}</div>
    <h3>${esc(head)}</h3><p>${esc(body)}</p>
    <div class="cols"><div>${icon('users')} <b>${d.visitors}</b> visitantes</div><div>${icon('coin')} <b>${eur(d.income)}</b> ingresos</div><div>${icon('briefcase')} <b>${eur(d.spent)}</b> gastos</div><div>${icon('chart')} <b style="color:${d.profit >= 0 ? '#127a52' : '#c2343a'}">${d.profit >= 0 ? '+' : ''}${eur(d.profit)}</b></div></div></div>`);
  st.today = { visitors: 0, income: 0, spent: 0, events: [] };
  save();
}
function tick(dt) {
  st.time += dt;
  const hr = Math.floor(st.time / 60);
  while (st.lastHour < hr) { st.lastHour++; hourly(st.lastHour % 24); }
  animalsTick(dt); visitorsTick(dt);
}
function save() { if (swapping) return; st.lastSaved = Date.now(); store.save(KEY, st); cloud.saved(); }
// Con la app cerrada: pasa el tiempo más despacio y se estima lo ganado
function offline() {
  const mins = Math.min((Date.now() - st.lastSaved) / 1000 * 0.2, 1440); if (mins < 20) return;
  const last = st.history[0]; const est = last ? Math.max(0, last.profit) * (mins / 1440) * 0.5 : 0;
  st.time += mins; st.lastHour = Math.floor(st.time / 60); st.money += Math.round(est);
  for (const a of st.animals) a.hunger = st.staff.keeper * 8 >= st.animals.length ? 90 : Math.max(20, a.hunger - mins * 0.05);
  say('rufina', 'Mientras no estabas…', `<p>Han pasado <b>${Math.round(mins / 60)} h</b> en el parque.</p>${est ? `<p>Los visitantes han dejado unos <b>${eur(est)}</b>.</p>` : ''}${st.staff.keeper * 8 < st.animals.length ? '<p class="hint">Faltan cuidadores: algunos animales tienen hambre.</p>' : '<p class="hint">Tus cuidadores han atendido a los animales.</p>'}`);
}

// ---------- dibujo 3D ----------
const canvas = $('#stage');
const eng = new Engine(canvas, { target: [N / 2, 0, N / 2 + 2], dist: 26, maxDist: 90, bounds: N, pitch: 0.9 });
eng.cam.dist = eng.fitDist(15);
const S3 = eng.scene;
// Paisaje: luz cálida, sombras, niebla en el horizonte, campo y bosque alrededor del parque
setAnimalDetail(eng.hq ? 0.75 : 0.5);
Look.setupLook(eng, { cx: N / 2, cz: N / 2, size: N * 0.78, height: 30, fog: { color: '#d4eaf4', near: 45, far: 140 } });
const parkGround = new THREE.Mesh(new THREE.PlaneGeometry(N + 1, N + 1), new THREE.MeshLambertMaterial({ map: Look.grassTex(N / 3) }));
parkGround.rotation.x = -Math.PI / 2; parkGround.position.set(N / 2, 0, N / 2); parkGround.receiveShadow = true; S3.add(parkGround);
S3.add(Look.horizonGround(N / 2, N / 2, '#8fb070'));
{
  // seto alrededor del parque (con hueco en la entrada) y bosque de fondo
  const R = Look.seeded(7); const hedge = [];
  for (let i = -0.5; i <= N + 0.5; i += 0.7) for (const [x, z] of [[i, -0.6], [i, N + 0.6], [-0.6, i], [N + 0.6, i]]) if (!(Math.abs(x - ENTRANCE.x - 0.5) < 1.6 && z > N)) hedge.push([x, z]);
  S3.add(Look.hedge(hedge));
  const trees = []; for (let i = 0; i < 150 * Look.detail(eng); i++) { const a = R() * Math.PI * 2, d = N * 0.62 + 2 + Math.pow(R(), 0.7) * 34; const x = N / 2 + Math.cos(a) * d, z = N / 2 + Math.sin(a) * d; if (z > N + 1 && Math.abs(x - ENTRANCE.x) < 4) continue; trees.push({ x, z, s: 1.4 + R() * 1.4, kind: R() < 0.3 ? 'pino' : R() < 0.5 ? 'abedul' : 'roble' }); }
  S3.add(Look.forest(trees));
  const field = []; for (let i = 0; i < 260 * Look.detail(eng); i++) { const x = rnd(-8, N + 8), z = rnd(-8, N + 8); if (x > -1.2 && x < N + 1.2 && z > -1.2 && z < N + 1.2) continue; field.push([x, z]); } S3.add(Look.grassTufts(field, { size: 0.22 }));
}
// entrada
const gate = new THREE.Group(); gate.position.set(ENTRANCE.x + 0.5, 0, ENTRANCE.z + 0.5);
for (const sx of [-0.8, 0.8]) { const p = box(0.24, 2.1, 0.24, '#7a5032', 0.04); p.position.set(sx, 1.05, 0); gate.add(p); const cap = box(0.32, 0.12, 0.32, '#5a3a22', 0.03); cap.position.set(sx, 2.15, 0); gate.add(cap); }
const arch = box(2.1, 0.42, 0.3, '#2e7d4f', 0.06); arch.position.y = 2.2; gate.add(arch);
const archSign = box(1.5, 0.26, 0.04, '#f4e6c8', 0.03); archSign.position.set(0, 2.2, 0.16); gate.add(archSign);
for (const sx of [-1.3, 1.3]) { const b = Look.bush(0.35, sx > 0 ? 2 : 3, '#2c6a2e', '#68a84a'); b.position.set(sx, 0, 0.2); gate.add(b); }
Look.shadows(gate, true, false); S3.add(gate);
const groups = { tufts: new THREE.Group(), paths: new THREE.Group(), enc: new THREE.Group(), bld: new THREE.Group(), animals: new THREE.Group(), people: new THREE.Group(), litter: new THREE.Group(), ghost: new THREE.Group() };
Object.values(groups).forEach((g) => S3.add(g));
const ov = document.createElement('canvas'); ov.className = 'overlay2d'; canvas.after(ov); const octx = ov.getContext('2d');

let sig = {};
const pathMat = new THREE.MeshLambertMaterial({ map: Look.pavingTex(1) });
function rebuildPaths() {
  const g = groups.paths; g.clear(); const n = st.paths.length; if (!n) return;
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 0.05, 1), pathMat, n); inst.receiveShadow = true; const m = new THREE.Matrix4();
  st.paths.forEach((p, i) => { const [x, z] = p.split(',').map(Number); m.makeTranslation(x + 0.5, 0.03, z + 0.5); inst.setMatrixAt(i, m); });
  g.add(inst);
}
const BIOME_TREE = { granja: 'roble', sabana: 'roble', selva: 'palmera', artico: 'pino', humedal: 'abedul', bosque: 'pino' };
function tree(scale = 1, kind = 'roble', seed = 1) { const g = new THREE.Group(); const t = Look.tree(kind, scale, seed); if (kind === 'roble' && scale > 1.1) t.scale.y = scale * 0.85; g.add(t); g.add(blob(0.9 * scale, 0.9 * scale, 0.3)); return g; }
function enrichMesh(type, biome = 'sabana', seed = 1) {
  const g = new THREE.Group();
  // árboles y rocas con modelos de verdad (Kenney, CC0) cuando ya están cargados
  const GTREE = { granja: 'tree_oak', sabana: 'tree_fat', selva: 'tree_palm', artico: 'tree_pine_tall', humedal: 'tree_oak', bosque: 'tree_pine' };
  if (type === 'arbol') { const t = staticModel(`nature/${GTREE[biome] || 'tree_oak'}.glb`, { height: biome === 'selva' ? 2.6 : 2.3 }); if (t) { t.rotation.y = seed % 6; g.add(t, blob(1.1, 1.1, 0.3)); } else g.add(tree(1.25, BIOME_TREE[biome], seed)); }
  if (type === 'roca' && peek('nature/rock_large.glb')) { const a = staticModel('nature/rock_large.glb', { length: 0.75 }), b = staticModel('nature/rock_small.glb', { length: 0.35 }), c = staticModel('nature/rock_tall.glb', { length: 0.4 }); a.position.set(-0.15, 0, 0.05); b.position.set(0.3, 0, 0.25); c.position.set(0.15, 0, -0.25); a.rotation.y = seed; c.rotation.y = seed * 2; g.add(a, b, c); }
  else if (type === 'roca') { for (let i = 0; i < 3; i++) { const r = Look.rock(0.2 + i * 0.07, biome === 'artico' ? '#b8c0c8' : '#9a9286', seed + i); r.position.x = i * 0.26 - 0.26; r.position.z = (i % 2) * 0.2; r.rotation.y = i * 2; g.add(r); } }
  if (type === 'charca') {
    const bank = new THREE.Mesh(new THREE.CircleGeometry(0.88, 24), mat('#8a7a52')); bank.rotation.x = -Math.PI / 2; bank.position.y = 0.03; bank.receiveShadow = true; g.add(bank);
    const w = new THREE.Mesh(new THREE.CircleGeometry(0.74, 24), new THREE.MeshLambertMaterial({ map: Look.waterTex(), transparent: true, opacity: 0.92 })); w.rotation.x = -Math.PI / 2; w.position.y = 0.045; g.add(w); g.userData.water = w;
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + rnd(-0.2, 0.2); const r = Look.rock(0.07 + Math.random() * 0.05, '#8d877a', seed + i); r.position.set(Math.cos(a) * 0.8, 0.02, Math.sin(a) * 0.8); g.add(r); }
    if (biome !== 'artico') for (let i = 0; i < 6; i++) { const rd = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.35 + Math.random() * 0.2, 3), mat('#5a8a3a')); const a = 2 + i * 0.25; rd.position.set(Math.cos(a) * 0.68, 0.2, Math.sin(a) * 0.68); rd.rotation.z = rnd(-0.2, 0.2); g.add(rd); }
  }
  if (type === 'juguete') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshLambertMaterial({ map: ballTex() })); b.position.y = 0.22; b.rotation.z = 0.4; g.add(b, blob(0.5, 0.5)); }
  if (type === 'bambu') for (let i = 0; i < 7; i++) { const h = 1.0 + Math.random() * 0.6; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, h, 6, 4), mat(i % 2 ? '#7ab84a' : '#5e9e3c')); c.position.set(Math.cos(i * 1.7) * 0.22, h / 2, Math.sin(i * 2.3) * 0.22); c.rotation.z = rnd(-0.08, 0.08); g.add(c);
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 3), mat('#4e8e34')); l.scale.z = 0.2; l.position.set(c.position.x + 0.08, h * (0.55 + k * 0.15), c.position.z); l.rotation.z = -1.1; l.rotation.y = k * 2; g.add(l); } }
  const M = (c) => mat(c), cyl = (rt, rb, h, c, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'string' ? M(c) : c);
  const at = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  // ---- granja
  if (type === 'pajar') { const straw = new THREE.MeshLambertMaterial({ map: strawTex() }); for (const [x, y, z, r] of [[-0.2, 0.14, 0, 0.1], [0.2, 0.14, 0.05, -0.1], [0, 0.42, 0.02, 0.3]]) at(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.3), straw), x, y, z, r); for (let i = 0; i < 6; i++) { const w = box(0.02, 0.005, 0.12, '#e8c860'); at(w, rnd(-0.45, 0.45), 0.01, rnd(-0.35, 0.35), rnd(0, 3)); } }
  if (type === 'comedero') { at(box(0.8, 0.06, 0.32, '#8a5a32', 0.01), 0, 0.3, 0); for (const sz of [-1, 1]) { const sd = box(0.8, 0.14, 0.03, '#7a4e2a'); at(sd, 0, 0.38, sz * 0.15); } for (const [x, z] of [[-0.35, -0.12], [0.35, -0.12], [-0.35, 0.12], [0.35, 0.12]]) at(box(0.05, 0.3, 0.05, '#6a4222'), x, 0.15, z); const hay = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.24), new THREE.MeshLambertMaterial({ map: strawTex() })); at(hay, 0, 0.38, 0); }
  if (type === 'establo') { const wall = box(0.9, 0.55, 0.7, '#b8452e'); at(wall, 0, 0.275, 0); for (const sx of [-1, 1]) { const roof = box(0.56, 0.04, 0.82, '#5a4a40'); roof.rotation.z = sx * 0.6; at(roof, sx * 0.22, 0.7, 0); } const gable = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.45, 0.32, 3, 1), M('#b8452e')); gable.rotation.set(Math.PI / 2, 0, 0); gable.scale.set(1.05, 1, 0.66); at(gable, 0, 0.66, 0); const door = box(0.34, 0.4, 0.02, '#f2ece0'); at(door, 0, 0.2, 0.36); const x1 = box(0.42, 0.03, 0.025, '#f2ece0'); x1.rotation.z = 0.85; at(x1, 0, 0.2, 0.375); const x2 = box(0.42, 0.03, 0.025, '#f2ece0'); x2.rotation.z = -0.85; at(x2, 0, 0.2, 0.375); }
  // ---- sabana
  if (type === 'acacia') { const trunk = cyl(0.04, 0.07, 0.95, '#6a4a2e'); trunk.rotation.z = 0.12; at(trunk, 0, 0.47, 0); for (const [x, y, z, sc] of [[0.05, 1.0, 0, 1], [-0.25, 0.92, 0.1, 0.7], [0.3, 0.95, -0.12, 0.65]]) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.38 * sc, 10, 6), M(sc === 1 ? '#6e8a3a' : '#7e9a44')); c.scale.y = 0.28; at(c, x, y, z); } }
  if (type === 'termitero') { for (const [x, h, r] of [[0, 0.9, 0.2], [0.18, 0.55, 0.12], [-0.14, 0.42, 0.1]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9, 3), M('#b07a4a')); const p = c.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) * (1 + Math.sin(p.getY(i) * 14 + i) * 0.08)); c.geometry.computeVertexNormals(); at(c, x, h / 2, x * 0.4); } }
  if (type === 'tronco') { const t = cyl(0.12, 0.15, 0.7, '#7a5a3c', 10); at(t, 0, 0.35, 0); for (let i = 0; i < 5; i++) { const sc = box(0.01, 0.25, 0.02, '#c8a070'); const a = i * 0.5 - 1; at(sc, Math.cos(a) * 0.14, 0.4 + (i % 2) * 0.1, Math.sin(a) * 0.14, -a); } const top = cyl(0.12, 0.12, 0.01, '#c89a6a', 10); at(top, 0, 0.705, 0); }
  // ---- selva
  if (type === 'trepador') { for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) at(cyl(0.035, 0.04, 1.0, '#7a5232'), x, 0.5, z); at(box(0.82, 0.05, 0.82, '#9a6a3c', 0.01), 0, 0.82, 0); const rope = M('#d8c08a'); for (const [x, z] of [[-0.2, 0.36], [0.2, 0.36]]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.75, 4), rope); at(r, x, 0.42, z); } for (let i = 0; i < 4; i++) at(box(0.45, 0.025, 0.04, '#9a6a3c'), 0, 0.15 + i * 0.18, 0.36); const vine = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 4, 12, Math.PI), rope); vine.rotation.x = Math.PI; at(vine, 0, 0.82, -0.36); }
  if (type === 'helechos') for (let k = 0; k < 3; k++) { const cx = (k - 1) * 0.25, cz = (k % 2) * 0.18 - 0.08; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + k; const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.42, 3), M(i % 2 ? '#3f8a3a' : '#2f7032')); f.scale.z = 0.25; f.position.set(cx + Math.cos(a) * 0.12, 0.16, cz + Math.sin(a) * 0.12); f.rotation.set(Math.sin(a) * 0.9, -a, Math.cos(a) * 0.9 + Math.PI / 2 * 0); g.add(f); } }
  // ---- ártico
  if (type === 'hielo') { const ice = new THREE.MeshLambertMaterial({ color: 0xbfe6f5, transparent: true, opacity: 0.85 }); for (const [x, y, z, sz] of [[-0.2, 0.15, 0, 0.3], [0.18, 0.12, 0.1, 0.24], [0, 0.4, 0.02, 0.22], [0.25, 0.1, -0.22, 0.18]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), ice); b.rotation.set(rnd(-0.2, 0.2), rnd(0, 3), rnd(-0.2, 0.2)); at(b, x, y, z, b.rotation.y); } }
  if (type === 'tobogan') { const snow = M('#f4f8fb'); const hill = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), snow); hill.scale.set(1, 0.9, 0.8); at(hill, -0.15, 0, 0); const slide = box(0.26, 0.03, 0.85, '#bfe3f2'); slide.rotation.x = 0.55; at(slide, 0.15, 0.24, 0.2, 0.9); }
  if (type === 'cueva') { const ice = M('#e2f2fa'); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), ice); at(dome, 0, 0, 0); const hole = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12, 0, Math.PI), M('#3a5a6a')); at(hole, 0, 0.0, 0.44); for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45 * Math.cos(i * 0.45 + 0.2), 0.006, 3, 24), M('#c4dce8')); ring.rotation.x = Math.PI / 2; at(ring, 0, 0.45 * Math.sin(i * 0.45 + 0.2), 0); } }
  // ---- humedal
  if (type === 'nenufares') { const w = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), new THREE.MeshLambertMaterial({ map: Look.waterTex(), transparent: true, opacity: 0.9 })); w.rotation.x = -Math.PI / 2; at(w, 0, 0.04, 0); g.userData.water = w; for (let i = 0; i < 6; i++) { const pad = new THREE.Mesh(new THREE.CircleGeometry(0.1, 10, 0.3, Math.PI * 1.8), M('#4a9a4a')); pad.rotation.x = -Math.PI / 2; at(pad, rnd(-0.38, 0.38), 0.05, rnd(-0.38, 0.38)); if (i % 2 === 0) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.05, 6), M(i % 4 ? '#f6f0f4' : '#f08ab4')); at(fl, pad.position.x, 0.08, pad.position.z); } } }
  if (type === 'juncos') for (let i = 0; i < 16; i++) { const h = 0.45 + Math.random() * 0.4; const r = cyl(0.008, 0.014, h, i % 3 ? '#6a9a3a' : '#7aa848', 3); r.rotation.z = rnd(-0.18, 0.18); at(r, rnd(-0.35, 0.35), h / 2, rnd(-0.35, 0.35)); if (i % 3 === 0) at(cyl(0.022, 0.022, 0.09, '#6a4a2a', 6), r.position.x, h - 0.04, r.position.z); }
  if (type === 'islote') { const w = new THREE.Mesh(new THREE.CircleGeometry(0.85, 22), new THREE.MeshLambertMaterial({ map: Look.waterTex(), transparent: true, opacity: 0.92 })); w.rotation.x = -Math.PI / 2; at(w, 0, 0.04, 0); g.userData.water = w; const isl = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M('#8aa05a')); isl.scale.y = 0.35; at(isl, 0, 0.03, 0); const nest = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 5, 12), new THREE.MeshLambertMaterial({ map: strawTex() })); nest.rotation.x = Math.PI / 2; at(nest, 0, 0.14, 0); for (let i = 0; i < 2; i++) at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M('#f4efe2')), (i - 0.5) * 0.05, 0.14, 0); }
  // ---- bosque
  if (type === 'troncocaido') { const t = cyl(0.13, 0.15, 1.1, '#6a4a2e', 10); t.rotation.z = Math.PI / 2; at(t, 0, 0.14, 0, 0.5); for (const sx of [-1, 1]) { const end = cyl(0.13, 0.13, 0.01, '#c8a06a', 10); end.rotation.z = Math.PI / 2; end.position.set(sx * 0.55, 0, 0); t.add(end); end.rotation.set(0, 0, 0); end.position.set(0, sx * 0.555, 0); } for (let i = 0; i < 4; i++) at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), M('#4e7a3a')), rnd(-0.3, 0.3), 0.27, rnd(-0.12, 0.12)); for (let i = 0; i < 3; i++) { const m2 = cyl(0.03, 0.01, 0.04, '#d8c8a0', 6); at(m2, 0.3 + i * 0.05, 0.03, 0.15); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), M('#c0432a')); at(cap, 0.3 + i * 0.05, 0.05, 0.15); } }
  if (type === 'colmena') { const post = cyl(0.05, 0.06, 0.8, '#6a4a2e'); at(post, 0, 0.4, 0); const hive = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), M('#e0a830')); hive.scale.set(1, 1.25, 1); at(hive, 0.12, 0.66, 0); for (let i = 0; i < 4; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15 * Math.sin((i + 1) / 5 * Math.PI), 0.012, 4, 14), M('#c88a20')); ring.rotation.x = Math.PI / 2; at(ring, 0.12, 0.66 + (i - 1.5) * 0.08, 0); } const hole = new THREE.Mesh(new THREE.CircleGeometry(0.03, 8), M('#3a2a10')); at(hole, 0.12, 0.6, 0.155); const arm = box(0.16, 0.03, 0.03, '#6a4a2e'); at(arm, 0.06, 0.82, 0); }
  if (type === 'cuevaroca') { for (const [x, y, z, sz, c] of [[-0.3, 0.2, 0, 0.32, '#8a8378'], [0.3, 0.2, 0, 0.32, '#7d776d'], [0, 0.5, -0.05, 0.36, '#958e82'], [0, 0.18, -0.3, 0.28, '#8a8378']]) at(Look.rock(sz, c, seed + x * 10 + z * 7 + 1), x, y, z); const hole = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12, 0, Math.PI), M('#2a2620')); at(hole, 0, 0.02, 0.18); }
  Look.shadows(g, true, false);
  return g;
}
let strawT = null; const strawTex = () => strawT || (strawT = canvasTexture(64, (x, s) => { x.fillStyle = '#e2c066'; x.fillRect(0, 0, s, s); for (let i = 0; i < 220; i++) { x.strokeStyle = ['#c8a048', '#f0d880', '#b89038'][i % 3]; x.lineWidth = 1; const px = Math.random() * s, py = Math.random() * s; x.beginPath(); x.moveTo(px, py); x.lineTo(px + rnd(-10, 10), py + rnd(-3, 3)); x.stroke(); } }));
let ballT = null; const ballTex = () => ballT || (ballT = canvasTexture(64, (x, s) => { const c = ['#e5484d', '#fff', '#3b82f6', '#fff', '#f5c842', '#fff']; c.forEach((col, i) => { x.fillStyle = col; x.fillRect(i * s / 6, 0, s / 6 + 1, s); }); }));
const biomeTex = {};
function groundTex(b) {
  if (biomeTex[b]) return biomeTex[b];
  const base = BIOMES[b].color;
  biomeTex[b] = canvasTexture(128, (x, s) => {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    const dots = { granja: ['#86b25a', '#b8d07a', '#d8c070'], sabana: ['#c4ac5e', '#e2d290', '#a89a50'], selva: ['#3e8a3e', '#5aa84e', '#2f6e34'], artico: ['#ffffff', '#d8e6ee', '#c4d6e2'], humedal: ['#6aa898', '#9ccab8', '#5a7a5a'], bosque: ['#4e7a3e', '#7aa45a', '#6a5a3a'] }[b];
    for (let i = 0; i < 900; i++) { x.fillStyle = dots[i % 3]; const r = b === 'selva' ? 3 : 1.5; x.fillRect(Math.random() * s, Math.random() * s, r, b === 'sabana' || b === 'granja' ? 4 : r); }
    if (b === 'humedal') { x.fillStyle = 'rgba(80,150,200,0.45)'; for (let i = 0; i < 5; i++) { x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, 14, 8, 0, 0, 7); x.fill(); } }
  }, [2, 2]);
  return biomeTex[b];
}
const postGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.84, 6), postMat = mat('#6a4a2a');
function rebuildEnclosures() {
  const g = groups.enc; g.clear(); eng.shadowsDirty?.();
  for (const e of st.enclosures) {
    const eg = new THREE.Group(); eg.userData.enc = e.id; g.add(eg);
    const ground = new THREE.Mesh(new THREE.BoxGeometry(e.n - 0.05, 0.05, e.n - 0.05), [mat(BIOMES[e.biome].color), mat(BIOMES[e.biome].color), new THREE.MeshLambertMaterial({ map: groundTex(e.biome) }), mat(BIOMES[e.biome].color), mat(BIOMES[e.biome].color), mat(BIOMES[e.biome].color)]); ground.position.set(e.x + e.n / 2, 0.03, e.z + e.n / 2); ground.receiveShadow = true; eg.add(ground);
    const rail = mat('#8a6a42');
    for (const [x, z, w, d] of [[e.x + e.n / 2, e.z, e.n, 0.06], [e.x + e.n / 2, e.z + e.n, e.n, 0.06], [e.x, e.z + e.n / 2, 0.06, e.n], [e.x + e.n, e.z + e.n / 2, 0.06, e.n]]) {
      for (const y of [0.35, 0.65]) { const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), rail); r.position.set(x, y, z); eg.add(r); }
    }
    for (let i = 0; i <= e.n; i++) for (const [x, z] of [[e.x + i, e.z], [e.x + i, e.z + e.n], [e.x, e.z + i], [e.x + e.n, e.z + i]]) { const p = new THREE.Mesh(postGeo, postMat); p.position.set(x, 0.42, z); p.castShadow = true; eg.add(p); }
    eg.children.forEach((c) => { if (c.geometry?.type === 'BoxGeometry' && c !== ground) c.castShadow = true; });
    e.items.forEach((it, i) => { const m = enrichMesh(it.type, e.biome, it.x * 7 + it.z); m.position.set(it.x + 0.5, 0.05, it.z + 0.5); m.userData.item = e.id + ':' + i; eg.add(m); });
  }
}
function rebuildBuildings() { const g = groups.bld; g.clear(); eng.shadowsDirty?.(); for (const b of st.buildings) { const m = propMesh(b, BUILDINGS); Look.shadows(m, true, false); m.position.set(b.x + 0.5, 0.05, b.z + 0.5); m.rotation.y = faceToPath(b); m.userData.bld = b.id; g.add(m); } }
// las tiendas miran hacia el camino más cercano
function faceToPath(b) { const P = pathSet(); for (const [dx, dz, r] of [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]]) if (P.has(pk(b.x + dx, b.z + dz))) return r; return 0; }

// Animales orgánicos (ver animals3d.js)
const animalMeshes = new Map();
let glbReady = false; const GLB = {};
// naturaleza: al cargar, se rehacen recintos y decoración con los modelos nuevos
preloadModels(['tree_oak', 'tree_fat', 'tree_palm', 'tree_pine', 'tree_pine_tall', 'tree_autumn', 'rock_large', 'rock_small', 'rock_tall'].map((n) => `nature/${n}.glb`)).then(() => { rebuildEnclosures(); rebuildBuildings(); });
// Animales "cubito": diseño original del juego (cube3d.js)
function animalModel(sp) {
  const m = cubeModel(sp); const [L, , W] = SPECIES[sp].body; m.g.add(blob(Math.max(W, 0.3) * 1.9, Math.max(L, 0.3) * 1.6, 0.38)); return m;
}
function syncAnimals(t) {
  const seen = new Set();
  for (const a of st.animals) {
    seen.add(a.id); let m = animalMeshes.get(a.id);
    if (!m) { m = animalModel(a.sp); Look.shadows(m.g, eng.hq, false); m.g.userData.animal = a.id; animalMeshes.set(a.id, m); groups.animals.add(m.g); }
    const moving = a.tx != null && (Math.abs(a.tx - a.x) > 0.05 || Math.abs(a.tz - a.z) > 0.05);
    // giro suave (no de golpe) hacia donde va
    const rdt = m.rt ? Math.min(0.1, t - m.rt) : 0; m.rt = t;
    if (a.dir != null) { if (m.yaw == null) m.yaw = a.dir; let dA = a.dir - m.yaw; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); m.yaw += dA * Math.min(1, rdt * 5); m.g.rotation.y = m.yaw; }
    // velocidad real (para que las patas vayan al ritmo y no "patinen")
    if (m.px != null && rdt > 0) { const v = Math.hypot(a.x - m.px, a.z - m.pz) / rdt; m.vel = (m.vel || 0) + (Math.min(v, 8) - (m.vel || 0)) * Math.min(1, rdt * 6); }
    m.px = a.x; m.pz = a.z;
    m.g.position.set(a.x, 0.05, a.z);
    // mientras se mueve: el animal cogido va con el dedo; los de un recinto que se mueve, con él
    if (mv && mv.kind === 'animal' && mv.ref === a) m.g.position.set(mv.px, 0.55 + Math.sin(t * 6) * 0.04, mv.pz);
    else if (mv && mv.kind === 'enc' && a.enc === mv.ref.id) m.g.position.set(a.x + mv.x - mv.ref.x, 0.2, a.z + mv.z - mv.ref.z);
    const k = a.baby ? 0.55 : 1; m.g.scale.setScalar(k);
    const S = SPECIES[a.sp]; const w = moving ? Math.sin(t * (S.hop ? 9 : 7) + a.x) : 0;
    const sleeping = (a.state === 'sleep' || a.state === 'sick') && !moving, headDown = !moving && ['eat', 'drink', 'graze'].includes(a.state);
    if (m.glb) { // modelo animado: elige la animación según lo que hace y a qué velocidad va de verdad
      const L = (GLB[a.sp]?.len || 1) * (a.baby ? 0.55 : 1), v = m.vel || 0;
      m.walking = m.walking ? v > 0.04 : v > 0.12; // con margen, para que no parpadee entre andar y parar
      if (m.walking) { const walkV = 0.55 * L, runV = 2.2 * L; if (v > walkV * 1.9) m.play('Gallop', { speed: Math.max(0.7, Math.min(2, v / runV)) }); else m.play('Walk', { speed: Math.max(0.6, Math.min(1.8, v / walkV)) }); }
      else if (headDown) m.play('Eating'); else if (sleeping) m.play(['Idle_Headlow', 'Idle_2_HeadLow', 'Idle'], { speed: 0.35 });
      else if (a.state === 'play') m.play(['Jump_toIdle', 'Jump_ToIdle', 'Idle_2']); else m.play(['Idle', 'Idle_2']);
      m.update(rdt);
      continue;
    }
    m.body.position.y = S.hop && moving ? Math.abs(w) * 0.2 : sleeping ? -(m.legH ?? S.legs) * 0.85 : 0;
    m.legs.forEach((l, i) => { l.visible = !sleeping; l.rotation.x = S.hop ? 0 : (i % 2 === (i < 2 ? 0 : 1) ? w : -w) * 0.5; const k = l.userData.knee; if (k) k.rotation.x = l.userData.back ? -Math.max(0, l.rotation.x) * 1.1 : Math.max(0, -l.rotation.x) * 1.1; });
    m.neck.rotation.x = m.neckRx + (headDown ? (m.headDown ?? 0.9) + Math.sin(t * 3 + a.x) * 0.08 : sleeping ? (m.headDown ?? 0.9) * 0.6 : 0);
    m.head.rotation.x = moving ? 0 : headDown ? 0.4 : sleeping ? 0.3 : Math.sin(t * 0.8 + a.z) * 0.25 + 0.1;
    m.tail.rotation.z = Math.sin(t * (a.state === 'play' ? 8 : 3) + a.x) * (sleeping ? 0.05 : 0.3);
    m.torso.scale.x = (a.preg ? 1.3 : 1) * (m.torsoSX ??= m.torso.scale.x);
    if (a.state === 'play' && !moving) m.g.rotation.y += Math.sin(t * 4) * 0.02;
  }
  for (const [k, m] of animalMeshes) if (!seen.has(k)) { groups.animals.remove(m.g); animalMeshes.delete(k); }
}
const peopleMeshes = new Map();
let people = null;
let glbPeople = null;
function syncPeople(t) { const rest = (glbPeople ||= new GlbPeople(groups.people, eng.hq ? 40 : 24)).sync(visitors, t); (people ||= new People(groups.people, 90)).sync(rest, t); }
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
// Matas de hierba en las casillas libres del parque (se rehacen solo al construir)
const waterT = Look.waterTex();
function rebuildTufts() {
  const g = groups.tufts; g.clear(); const P = pathSet(), pts = [];
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) { if (P.has(pk(x, z)) || encAt(x, z) || buildingAt(x, z) || (x === ENTRANCE.x && z >= ENTRANCE.z - 1)) continue; const k = (x * 31 + z * 17) % 7; for (let i = 0; i < (eng.hq ? 2 + (k % 3) : k % 2); i++) pts.push([x + ((k * 13 + i * 37) % 97) / 97, z + ((k * 29 + i * 53) % 89) / 89]); }
  g.add(Look.grassTufts(pts));
}
function sync(t) {
  syncExtras();
  const s1 = st.paths.join(';'); if (s1 !== sig.paths) { sig.paths = s1; rebuildPaths(); }
  const s2 = JSON.stringify(st.enclosures); if (s2 !== sig.enc) { sig.enc = s2; rebuildEnclosures(); }
  const s3 = JSON.stringify(st.buildings) + st.paths.length; if (s3 !== sig.bld) { sig.bld = s3; rebuildBuildings(); }
  const s4 = st.litter.length; if (s4 !== sig.litter) { sig.litter = s4; rebuildLitter(); }
  const s5 = s1 + s2.length + s3; if (s5 !== sig.tufts) { sig.tufts = s5; rebuildTufts(); }
  waterT.offset.set(t * 0.02, Math.sin(t * 0.3) * 0.04);
  syncAnimals(t); syncPeople(t);
  // luz del día
  const h = hourOf(st.time); const night = h < 6 ? 1 : h < 7.5 ? (7.5 - h) / 1.5 : h > 21 ? 1 : h > 19.5 ? (h - 19.5) / 1.5 : 0;
  eng.sun.intensity = 1.6 * (1 - night * 0.8); eng.hemi.intensity = 1.1 - night * 0.6;
  document.body.style.background = night > 0.5 ? 'linear-gradient(#1a2148,#3b3f72)' : 'linear-gradient(#8fcdf0,#d8eef8)';
  if (S3.fog) S3.fog.color.set(night > 0.5 ? '#3b3f72' : '#d4eaf4');
  if (night !== sig.night) { sig.night = night; groups.bld.traverse((o) => { if (o.userData.lamp) o.userData.lamp.material.emissiveIntensity = 0.4 + night * 1.6; }); }
}
// capa 2D: avisos sobre los recintos
function overlay() {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  if (ov.width !== Math.round(eng.w * dpr)) { ov.width = eng.w * dpr; ov.height = eng.h * dpr; }
  octx.setTransform(dpr, 0, 0, dpr, 0, 0); octx.clearRect(0, 0, eng.w, eng.h);
  if (eng.cam.dist < 32) for (const v of visitors) {
    if (!v.say || v.say.until < st.time) continue; const q = eng.project(new THREE.Vector3(v.x + 0.5, v.kid ? 0.85 : 1.05, v.z + 0.5)); if (q.z > 1 || q.x < 0 || q.x > eng.w || q.y < 60) continue;
    octx.font = '700 12px Nunito, sans-serif'; const w = Math.min(190, octx.measureText(v.say.text).width + 18); const x = Math.max(4, Math.min(eng.w - w - 4, q.x - w / 2)), y = q.y - 30;
    octx.fillStyle = 'rgba(255,255,255,0.95)'; octx.beginPath(); octx.roundRect(x, y, w, 24, 12); octx.fill(); octx.beginPath(); octx.moveTo(q.x - 5, y + 23); octx.lineTo(q.x, y + 31); octx.lineTo(q.x + 5, y + 23); octx.fill();
    octx.fillStyle = '#1f2540'; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillText(v.say.text, x + w / 2, y + 12.5, w - 12);
  }
  if (close) for (const a of st.animals.filter((q) => q.enc === close)) {
    const m = animalMeshes.get(a.id); if (!m) continue; const h = (SPECIES[a.sp].legs + SPECIES[a.sp].body[1] + SPECIES[a.sp].neck * 0.8 + 0.25) * (a.baby ? 0.55 : 1);
    const q = eng.project(new THREE.Vector3(m.g.position.x, h, m.g.position.z)); if (q.z > 1 || q.x < 0 || q.x > eng.w) continue;
    octx.font = '800 12px Nunito, sans-serif'; const w = octx.measureText(a.name).width + 14; const sel = a.id === followId;
    octx.fillStyle = sel ? 'rgba(31,37,64,0.92)' : 'rgba(255,255,255,0.88)'; octx.beginPath(); octx.roundRect(q.x - w / 2, q.y - 11, w, 20, 10); octx.fill();
    octx.fillStyle = sel ? '#fff' : '#1f2540'; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillText(a.name, q.x, q.y);
  }
  for (const a of st.animals) {
    if (!a.sick) continue; const m = animalMeshes.get(a.id); if (!m) continue;
    const h = (SPECIES[a.sp].legs + SPECIES[a.sp].body[1] + 0.3) * (a.baby ? 0.55 : 1); const q = eng.project(new THREE.Vector3(m.g.position.x, h, m.g.position.z)); if (q.z > 1) continue;
    const y = q.y - (close ? 22 : 0); octx.fillStyle = '#fff'; octx.beginPath(); octx.arc(q.x, y, 11, 0, 7); octx.fill(); octx.strokeStyle = '#e5484d'; octx.lineWidth = 2; octx.stroke();
    octx.fillStyle = '#e5484d'; octx.fillRect(q.x - 6, y - 2, 12, 4); octx.fillRect(q.x - 2, y - 6, 4, 12);
  }
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
// ---------- mover cosas ----------
// Mantén pulsado un recinto, un objeto, una tienda o un animal y arrástralo. También con el botón "Mover" de su ficha.
let mv = null;
const LABEL = { enc: (r) => `el recinto de ${BIOMES[r.biome].label.toLowerCase()}`, bld: (r) => BUILDINGS[r.type].label.toLowerCase(), item: (r) => ENRICH[r.type].label.toLowerCase(), animal: (r) => `a ${r.name}` };
function moveTarget(sx, sy) {
  const aId = eng.pick(sx, sy, groups.animals.children, 'animal'); if (aId) return { kind: 'animal', ref: st.animals.find((a) => a.id === aId) };
  const it = eng.pick(sx, sy, groups.enc.children, 'item'); if (it) { const [eid, i] = it.split(':'); const e = st.enclosures.find((q) => q.id === eid); if (e && e.items[+i]) return { kind: 'item', ref: e.items[+i], enc: e }; }
  const b = eng.pick(sx, sy, groups.bld.children, 'bld'); if (b) return { kind: 'bld', ref: st.buildings.find((q) => q.id === b) };
  const t = tileAt(sx, sy); const e = t && encAt(t.x, t.z); if (e) return { kind: 'enc', ref: e };
  return null;
}
const without = (arr, item, fn) => { const i = arr.indexOf(item); if (i >= 0) arr.splice(i, 1); try { return fn(); } finally { if (i >= 0) arr.splice(i, 0, item); } };
function moveValid() {
  const r = mv.ref, x = mv.x, z = mv.z;
  if (mv.kind === 'enc') return without(st.enclosures, r, () => canPlaceEnclosure(x, z, r.n));
  if (mv.kind === 'bld') return inGrid(x, z) && without(st.buildings, r, () => !occupied(x, z)) && (BUILDINGS[r.type].cat !== 'Tiendas' || nextToPath(x, z));
  if (mv.kind === 'item') { const e = mv.enc; return x >= e.x && x < e.x + e.n && z >= e.z && z < e.z + e.n && !e.items.some((i) => i !== r && i.x === x && i.z === z); }
  if (mv.kind === 'animal') return !!mv.dest;
  return false;
}
function beginMove(target, sx, sy) {
  if (!target || !target.ref) return false;
  const t = tileAt(sx, sy); if (!t) return false; const r = target.ref;
  mv = { ...target, gx: t.x - Math.floor(r.x), gz: t.z - Math.floor(r.z), x: r.x, z: r.z, ok: true };
  if (target.kind === 'animal') { mv.dest = st.enclosures.find((q) => q.id === r.enc); mv.px = r.x; mv.pz = r.z; }
  $('#toolinfo').hidden = false; $('#toolinfo').innerHTML = `${icon('move')} Moviendo ${LABEL[target.kind](r)} · suelta para colocar`;
  Sound.play('lift');
  trash.show(target.kind === 'animal' ? 'Suelta aquí para venderlo' : target.kind === 'enc' ? 'Suelta aquí para derribarlo' : 'Suelta aquí para quitarlo');
  moveDrag(sx, sy); return true;
}
function moveDrag(sx, sy) {
  const r = mv.ref; let ghost = null; mv.sx = sx; mv.sy = sy;
  if (trash.over(sx, sy)) { mv.trash = true; showGhost(null); return; } mv.trash = false;
  if (mv.kind === 'animal') {
    const p = eng.ground(sx, sy); if (!p) return; mv.px = p.x; mv.pz = p.z;
    mv.dest = encAt(Math.floor(p.x), Math.floor(p.z)); mv.ok = moveValid();
    ghost = mv.dest ? { x: mv.dest.x, z: mv.dest.z, w: mv.dest.n, h: mv.dest.n, ok: true } : { x: Math.floor(p.x), z: Math.floor(p.z), w: 1, h: 1, ok: false };
  } else {
    const t = tileAt(sx, sy); if (!t) return; const n = mv.kind === 'enc' ? r.n : 1;
    mv.x = Math.max(0, Math.min(N - n, t.x - mv.gx)); mv.z = Math.max(0, Math.min(N - n, t.z - mv.gz)); mv.ok = moveValid();
    ghost = { x: mv.x, z: mv.z, w: n, h: n, ok: mv.ok };
    // el objeto real sigue al dedo, un poco levantado
    if (mv.kind === 'enc') { const g = groups.enc.children.find((c) => c.userData.enc === r.id); if (g) g.position.set(mv.x - r.x, 0.15, mv.z - r.z); }
    if (mv.kind === 'bld') { const g = groups.bld.children.find((c) => c.userData.bld === r.id); if (g) g.position.set(mv.x + 0.5, 0.35, mv.z + 0.5); }
    if (mv.kind === 'item') { const eg = groups.enc.children.find((c) => c.userData.enc === mv.enc.id); const g = eg && eg.children.find((c) => c.userData.item === mv.enc.id + ':' + mv.enc.items.indexOf(r)); if (g) g.position.set(mv.x + 0.5, 0.35, mv.z + 0.5); }
  }
  showGhost(ghost);
}
function endMove(cancel) {
  const r = mv.ref, m = mv; mv = null; showGhost(null); trash.hide();
  if (!cancel && m.trash) { sig.enc = sig.bld = null; if (view.tool === 'move') setTool(null); else renderToolInfo(); return removeThing(m); }
  if (!cancel && m.ok) {
    if (m.kind === 'enc') {
      const dx = m.x - r.x, dz = m.z - r.z; r.x = m.x; r.z = m.z;
      for (const i of r.items) { i.x += dx; i.z += dz; }
      for (const n of r.nests || []) { n.x += dx; n.z += dz; }
      if (r.food) { r.food.x += dx; r.food.z += dz; }
      for (const a of animalsIn(r)) { a.x += dx; a.z += dz; a.tx = null; a.restUntil = 0; }
      if (!encTouchesPath(r)) toast('Recuerda unirlo a un camino para que lo vean los visitantes', 'warn', 'path');
    } else if (m.kind === 'animal') {
      const e = m.dest; r.enc = e.id; r.x = Math.min(e.x + e.n - 0.5, Math.max(e.x + 0.5, m.px)); r.z = Math.min(e.z + e.n - 0.5, Math.max(e.z + 0.5, m.pz)); r.tx = null; r.restUntil = 0; r.state = 'wander';
      if (e.biome !== SPECIES[r.sp].biome) toast(`${r.name} prefiere el hábitat de ${BIOMES[SPECIES[r.sp].biome].label.toLowerCase()}`, 'warn', 'paw');
    } else { r.x = m.x; r.z = m.z; }
    navigator.vibrate?.(10); Sound.play('place');
  } else if (!cancel) toast(m.kind === 'animal' ? 'Suéltalo dentro de un recinto' : m.kind === 'bld' && BUILDINGS[r.type].cat === 'Tiendas' ? 'Ahí no cabe: las tiendas van junto a un camino' : 'Ahí no cabe', 'warn');
  sig.enc = sig.bld = null; if (view.tool === 'move') setTool(null); else renderToolInfo(); hud(); save();
}
// Quitar algo (desde la papelera o su ficha)
function removeThing(m) {
  const r = m.ref;
  if (m.kind === 'bld') { st.buildings = st.buildings.filter((q) => q !== r); st.money += Math.round(BUILDINGS[r.type].price / 2); toast(`${BUILDINGS[r.type].label} quitado · recuperas ${eur(BUILDINGS[r.type].price / 2)}`, 'info', 'trash'); }
  else if (m.kind === 'item') { m.enc.items = m.enc.items.filter((q) => q !== r); st.money += Math.round(ENRICH[r.type].price / 2); toast(`${ENRICH[r.type].label} quitado`, 'info', 'trash'); }
  else if (m.kind === 'animal') { const p = Math.round(SPECIES[r.sp].price * (r.baby ? 0.4 : 0.6)); return confirm(`¿Vender a ${r.name} por ${eur(p)}?`, () => { st.money += p; st.animals = st.animals.filter((q) => q !== r); hud(); save(); }); }
  else if (m.kind === 'enc') { const as = animalsIn(r); return confirm(as.length ? `Se venderán los ${as.length} animales. ¿Derribar el recinto?` : '¿Derribar el recinto?', () => { st.money += as.reduce((t, a) => t + SPECIES[a.sp].price * 0.6, 0) + SIZES[Object.keys(SIZES).find((k) => SIZES[k].n === r.n)].price * 0.4; st.animals = st.animals.filter((a) => a.enc !== r.id); st.enclosures = st.enclosures.filter((q) => q !== r); hud(); save(); }); }
  hud(); save();
}
// Desde una ficha: el siguiente arrastre mueve ese objeto
function armMove(target) { closeModal(); sheet.close(); setTool('move', target); }
eng.onLongPress = (sx, sy) => { if (view.tool || modalOpen()) return false; return beginMove(moveTarget(sx, sy), sx, sy); };
eng.onDragStart = (sx, sy) => {
  if (view.tool === 'move') return beginMove(view.opt, sx, sy);
  if (view.tool === 'path') { paintPath(tileAt(sx, sy)); return true; } return false;
};
eng.onDragMove = (sx, sy) => { if (mv) return moveDrag(sx, sy); if (view.tool === 'path') paintPath(tileAt(sx, sy)); };
eng.onDragEnd = (cancel) => { if (mv) return endMove(cancel); hud(); save(); };
eng.onTap = (sx, sy) => {
  if (modalOpen() || view.tool === 'move') return;
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
    st.money -= S.price; const a = addAnimal(view.opt, e); logEvent(st.animals.some((q) => q !== a && q.sp === a.sp) ? 'arrive' : 'newsp', S.label, a.name);
    toast(e.biome !== S.biome ? `${a.name} (${S.label.toLowerCase()}) ha llegado, pero prefiere el hábitat de ${BIOMES[S.biome].label.toLowerCase()}` : `${a.name} (${S.label.toLowerCase()}, ${a.sex === 'm' ? 'macho' : 'hembra'}) llega al parque. Puedes cambiarle el nombre en su ficha`, e.biome !== S.biome ? 'warn' : 'good', 'paw');
    hud(); save(); return;
  }
  if (view.tool === 'enrich') {
    const e = t && encAt(t.x, t.z); if (!e) return toast('Toca dentro de un recinto', 'warn');
    if (e.items.some((i) => i.x === t.x && i.z === t.z)) return; const E = ENRICH[view.opt]; if (E.biome && E.biome !== e.biome) return toast(`${E.label} es para recintos de ${BIOMES[E.biome].label.toLowerCase()}`, 'warn'); if (st.money < E.price) return toast('No hay dinero suficiente', 'warn');
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
  if (close) { const nest = eng.pick(sx, sy, groups.extra.children, 'nest'); if (nest) { nestCard = nest; followId = null; eng.cam.follow = null; return animalCardTick(true); } if (aId) return followAnimal(aId); const it = eng.pick(sx, sy, groups.enc.children, 'item'); if (it) return itemCard(it); return; }
  if (aId) return animalCard(aId);
  const itK = eng.pick(sx, sy, groups.enc.children, 'item'); if (itK) return itemCard(itK);
  const e = t && encAt(t.x, t.z); if (e) return encCard(e);
  const b = t && buildingAt(t.x, t.z); if (b) return bldCard(b);
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
  el.innerHTML = `<div class="row" style="align-items:center">${zimg(zooPhotos([a.sp])[a.sp], S.biome, 52)}<div style="flex:1;min-width:0"><b>${esc(a.name)}</b> <button class="renbtn" data-ren="${a.id}" aria-label="Cambiar nombre">${icon('pencil')}</button> <span class="hint">${S.label} · ${a.sex === 'm' ? '♂' : '♀'}${a.baby ? ' · cría' : ''}</span> <span class="trait" title="${TRAITS[a.trait]?.desc || ''}">${traitLabel(a)}</span>
    <div class="hint">Está ${STATE_TXT[a.state] || 'tranquilo'}${a.preg ? ` · embarazada (nace en ${Math.max(1, Math.round((a.preg.until - st.time) / 60))} h)` : ''}${kids ? ` · ${kids} ${kids > 1 ? 'crías' : 'cría'}` : ''}${mom ? ` · hija de ${esc(mom.name)}` : ''}</div></div></div>
    ${a.sick ? `<div class="sickrow">${icon('alert')} <div style="flex:1;min-width:0"><b>Se encuentra mal: ${ILLNESS[a.sick.kind].toLowerCase()}</b><div class="hint">${sickWhy(a).length ? 'Por qué: ' + sickWhy(a).join(', ') + '. ' : ''}${st.staff.vet ? 'El veterinario lo atenderá pronto.' : ''}</div></div><button class="btn sm coral" data-vet="${a.id}">Curar · ${eur(VET_VISIT)}</button></div>` : ''}
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
  if (view.tool === 'move') txt = `${icon('move')} Arrastra el dedo para mover ${LABEL[view.opt.kind](view.opt.ref)}`;
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
const soundRow = () => { const p = Sound.prefs(); return `<div class="sec">${icon('music')} Sonido</div><div class="row"><button class="btn sm ${p.music ? '' : 'alt'}" id="snd_m" style="flex:1">${icon('music')} Música ${p.music ? 'sí' : 'no'}</button><button class="btn sm ${p.sfx ? '' : 'alt'}" id="snd_s" style="flex:1">${icon('bell')} Efectos ${p.sfx ? 'sí' : 'no'}</button></div>`; };
function bindSound(b) { b.querySelector('#snd_m').onclick = () => { Sound.set('music', !Sound.prefs().music); renderPanel(); }; b.querySelector('#snd_s').onclick = () => { Sound.set('sfx', !Sound.prefs().sfx); renderPanel(); }; }
function renderPanel() {
  const b = sheet.body; const name = sheet.name;
  if (name === 'enc') {
    const sel = view.encSel || { biome: 'sabana', size: 'M' };
    const eth = thumbs('zoo-' + sel.biome, enrichFor(sel.biome).map(([k]) => k), (k) => enrichMesh(k, sel.biome, 3), { size: 96 });
    b.innerHTML = `<div class="sec">Hábitat</div><div class="seg" id="pb">${Object.entries(BIOMES).map(([k, v]) => `<button data-v="${k}" class="${k === sel.biome ? 'on' : ''}">${v.label}</button>`).join('')}</div>
      <div class="sec">Tamaño</div><div class="grid">${Object.entries(SIZES).map(([k, v]) => `<button class="item ${k === sel.size ? 'on' : ''}" data-s="${k}"><span class="tilebox" style="background:${BIOMES[sel.biome].color}">${icon('fence')}</span>${v.label} ${v.n}×${v.n}<span class="p">${eur(v.price)}</span></button>`).join('')}</div>
      <p class="hint">Cada especie prefiere un hábitat y necesita espacio. Coloca el recinto junto a un camino para que lo vean los visitantes.</p>
      <button class="btn coral" id="pgo" style="width:100%;margin-top:8px">${icon('fence')} Colocar recinto</button>
      <div class="sec">Objetos para ${BIOMES[sel.biome].label.toLowerCase()}</div><p class="hint">Cambia el hábitat de arriba para ver los objetos de cada zona. Los propios de su hábitat alegran más a los animales.</p><div class="grid">${enrichFor(sel.biome).map(([k, v]) => `<button class="item" data-e="${k}"><span class="tilebox" style="background:${BIOMES[sel.biome].color};overflow:hidden">${eth[k] ? `<img src="${eth[k]}" alt="" style="width:100%;height:100%;object-fit:cover">` : icon(v.ic)}</span>${v.label}<span class="d">${v.biome ? BIOMES[v.biome].label : 'Todos los hábitats'}</span><span class="p">${eur(v.price)}</span></button>`).join('')}</div>`;
    b.querySelector('#pb').onclick = (e) => { const x = e.target.closest('button'); if (x) { view.encSel = { ...sel, biome: x.dataset.v }; renderPanel(); } };
    b.querySelectorAll('[data-s]').forEach((x) => (x.onclick = () => { view.encSel = { ...sel, size: x.dataset.s }; renderPanel(); }));
    b.querySelector('#pgo').onclick = () => { sheet.close(); setTool('enc', sel); };
    b.querySelectorAll('[data-e]').forEach((x) => (x.onclick = () => enrichPreview(x.dataset.e, sel.biome)));
  }
  if (name === 'animal') {
    const zph = zooPhotos(Object.keys(SPECIES).filter((k) => !SPECIES[k].hybrid));
    b.innerHTML = `<p class="hint">Más fama desbloquea especies. Las felices tienen crías si hay macho y hembra y espacio.</p><div class="grid">${Object.entries(SPECIES).filter(([, v]) => !v.hybrid).map(([k, v]) => { const lock = st.fame < v.fame; return `<button class="item" data-a="${k}" ${lock ? 'disabled' : ''}>${zimg(zph[k], v.biome, 64)}${v.label}<span class="d">${BIOMES[v.biome].label}</span>${lock ? `<span class="lock">Fama ${v.fame}★</span>` : `<span class="p">${eur(v.price)}</span>`}</button>`; }).join('')}</div>`;
    b.insertAdjacentHTML('beforeend', `<div class="sec">${icon('sparkle')} Cruces · ${(st.hybrids || []).length}/${Object.keys(HYBRIDS).length} descubiertos</div><p class="hint">No se compran: nacen al cruzar especies emparentadas en un mismo recinto (toca el recinto → Cruces). Son muy raros y atraen muchos visitantes.</p><div class="grid">${CROSSES.map((c) => { const H = HYBRIDS[c.child], got = (st.hybrids || []).includes(c.child); return `<div class="item ${got ? '' : 'locked'}" style="cursor:default"><span class="tilebox" style="background:${got ? BIOMES[H.biome].color : '#e8e4f0'}">${icon(got ? 'paw' : 'sparkle')}</span>${got ? H.label : '¿?'}<span class="d">${SPECIES[c.a || c.m].label}${c.m ? ' ♂' : ''} × ${SPECIES[c.b || c.f].label}${c.f ? ' ♀' : ''}</span>${got ? `<span class="d">${H.desc}</span>` : ''}</div>`; }).join('')}</div>`);
    b.querySelectorAll('[data-a]').forEach((x) => (x.onclick = () => { sheet.close(); setTool('animal', x.dataset.a); }));
  }
  if (name === 'build') {
    const cats = ['Tiendas', 'Decoración'];
    b.innerHTML = cats.map((c) => `<div class="sec">${c}</div><div class="grid">${Object.entries(BUILDINGS).filter(([, v]) => v.cat === c).map(([k, v]) => `<button class="item" data-b="${k}"><span class="tilebox" ${v.color ? `style="background:${v.color};color:#fff"` : ''}>${icon(v.ic)}</span>${v.label}<span class="p">${eur(v.price)}</span>${v.sells ? `<span class="d">Vende a ${v.sells} €</span>` : ''}</button>`).join('')}</div>`).join('') + '<p class="hint">Las tiendas dan dinero y cubren hambre, sed y aseo de los visitantes. La decoración y las papeleras les ponen de buen humor.</p>';
    b.querySelectorAll('[data-b]').forEach((x) => (x.onclick = () => { sheet.close(); setTool('build', x.dataset.b); }));
  }
  if (name === 'staff') {
    const row = (k, label, desc) => `<div class="card"><div class="row" style="align-items:center"><span class="tilebox">${icon(k === 'keeper' ? 'paw' : k === 'vet' ? 'heart' : 'broom')}</span><div style="flex:1"><b>${label}: ${st.staff[k] || 0}</b><div class="hint">${desc} · ${WAGES[k]} €/día</div></div><button class="btn sm alt" data-m="${k}">−</button><button class="btn sm" data-p="${k}">+</button></div></div>`;
    b.innerHTML = row('keeper', 'Cuidadores', `Alimentan 8 animales cada uno (tienes ${st.animals.length})`) + row('cleaner', 'Limpiadores', `Recogen la basura (hay ${st.litter.length} restos)`) + row('vet', 'Veterinarios', `Curan solos a los animales enfermos (ahora ${st.animals.filter((a) => a.sick).length})`) + `<p class="hint">Los animales enferman más si pasan hambre, están tristes, hay basura o no viven en su hábitat. Sin veterinario, toca un animal enfermo y pulsa Curar (${eur(VET_VISIT)}).</p>`;
    b.querySelectorAll('[data-p]').forEach((x) => (x.onclick = () => { st.staff[x.dataset.p] = (st.staff[x.dataset.p] || 0) + 1; renderPanel(); save(); }));
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
      <div class="sec">${icon('cloud')} Copia en la nube</div><div id="cloudbox"></div>
      <div class="sec">Calidad gráfica</div><div class="seg" id="q"><button data-v="eco">Ahorro</button><button data-v="alta">Alta</button></div>
      ${soundRow()}
      <div class="row" style="margin-top:16px"><a class="btn alt" href="../">${icon('home')} Menú de juegos</a><button class="btn red" id="reset">${icon('trash')} Empezar de nuevo</button></div>`;
    bindSound(b);
    b.querySelector('#tm').onclick = () => { st.ticket = Math.max(0, st.ticket - 5); renderPanel(); };
    b.querySelector('#tp').onclick = () => { st.ticket = Math.min(60, st.ticket + 5); renderPanel(); };
    renderCloud(b.querySelector('#cloudbox'), { slot: 'parque', sync: cloud, onLogin: afterCloudLogin, refresh: renderPanel });
    const q = localStorage.getItem('sim_quality') || (eng.hq ? 'alta' : 'eco'); b.querySelectorAll('#q button').forEach((x) => { x.classList.toggle('on', x.dataset.v === q); x.onclick = () => { localStorage.setItem('sim_quality', x.dataset.v); save(); location.reload(); }; });
    b.querySelector('#reset').onclick = () => confirm('Se borrará tu parque. ¿Empezar de cero?', () => { localStorage.removeItem(KEY); st = newPark(); visitors = []; sig = {}; sheet.close(); hud(); save(); });
  }
}
function encCard(e) {
  const eph = zooPhotos(st.animals.filter((a) => a.enc === e.id).map((a) => a.sp));
  const as = animalsIn(e); const happy = Math.round(encHappy(e));
  const box2 = modal(`<h2>Recinto de ${BIOMES[e.biome].label.toLowerCase()}</h2><p class="hint">${e.n}×${e.n} · ${e.items.length} objetos · ánimo medio ${happy}%</p>
    <div class="list">${as.map((a) => `<div class="li">${zimg(eph[a.sp], SPECIES[a.sp].biome, a.baby ? 46 : 58)}<div style="flex:1;min-width:0"><b>${esc(a.name)}</b> <button class="renbtn" data-ren="${a.id}" aria-label="Cambiar nombre">${icon('pencil')}</button> <span class="hint">${SPECIES[a.sp].label}${a.baby ? ' (cría)' : ''} · ${a.sex === 'm' ? '♂' : '♀'}</span> <span class="trait">${traitLabel(a)}</span>
      <div class="hint">Hambre ${Math.round(a.hunger)}% · Feliz ${Math.round(a.happy)}%${e.biome !== SPECIES[a.sp].biome ? ' · hábitat equivocado' : ''}</div>${a.sick ? `<div class="sickrow" style="margin-top:4px">${icon('alert')}<span style="flex:1">${ILLNESS[a.sick.kind]}</span><button class="btn sm coral" data-vet="${a.id}">Curar · ${eur(VET_VISIT)}</button></div>` : ''}</div><button class="btn sm alt" data-mva="${a.id}" aria-label="Mover">${icon('move')}</button><button class="btn sm alt" data-sell="${a.id}">Vender</button></div>`).join('') || '<p class="hint">Aún no hay animales. Ve a Animales y toca este recinto.</p>'}</div>
    ${crossSection(e)}
    <div class="actions" style="flex-direction:column"><button class="btn" id="seeclose">${icon('eye')} Ver de cerca</button><button class="btn coral" id="feed" ${as.length ? '' : 'disabled'}>${icon('food')} Dar de comer (${as.length * 5} €)</button>${e.items.length ? `<div class="chips" style="justify-content:center">${e.items.map((it, i) => `<button class="chip" data-mvi="${i}">${icon('move')} ${ENRICH[it.type].label}</button>`).join('')}</div>` : ''}<button class="btn alt" id="mvenc">${icon('move')} Mover recinto</button><p class="hint" style="text-align:center;margin:0">También puedes mantener pulsado cualquier recinto, objeto, tienda o animal y arrastrarlo.</p><button class="btn alt" id="demo">${icon('trash')} Derribar recinto</button><button class="btn alt" id="close">Cerrar</button></div>`);
  box2.querySelector('#close').onclick = closeModal;
  box2.querySelectorAll('[data-vet]').forEach((x) => (x.onclick = () => { callVet(st.animals.find((q) => q.id === x.dataset.vet)); encCard(e); }));
  box2.querySelectorAll('[data-ren]').forEach((x) => (x.onclick = () => renameAnimal(st.animals.find((q) => q.id === x.dataset.ren), () => encCard(e))));
  box2.querySelectorAll('[data-cross]').forEach((x) => (x.onclick = () => { const [mid, fid] = x.dataset.cross.split('|'); doCross(st.animals.find((q) => q.id === mid), st.animals.find((q) => q.id === fid), e); }));
  box2.querySelector('#seeclose').onclick = () => enterClose(e);
  box2.querySelector('#mvenc').onclick = () => armMove({ kind: 'enc', ref: e });
  box2.querySelectorAll('[data-mvi]').forEach((x) => (x.onclick = () => armMove({ kind: 'item', ref: e.items[+x.dataset.mvi], enc: e })));
  box2.querySelectorAll('[data-mva]').forEach((x) => (x.onclick = () => armMove({ kind: 'animal', ref: st.animals.find((a) => a.id === x.dataset.mva) })));
  box2.querySelector('#feed').onclick = () => { if (st.money < as.length * 5) return toast('No hay dinero suficiente', 'warn'); st.money -= as.length * 5; putFood(e); closeModal(); toast('Has dejado comida en el recinto', 'good', 'food'); hud(); };
  box2.querySelector('#demo').onclick = () => { closeModal(); confirm(`Se venderán los ${as.length} animales. ¿Derribar?`, () => { st.money += as.reduce((t, a) => t + SPECIES[a.sp].price * 0.6, 0) + SIZES[Object.keys(SIZES).find((k) => SIZES[k].n === e.n)].price * 0.4; st.animals = st.animals.filter((a) => a.enc !== e.id); st.enclosures = st.enclosures.filter((q) => q !== e); hud(); save(); }); };
  box2.querySelectorAll('[data-sell]').forEach((x) => (x.onclick = () => { const a = st.animals.find((q) => q.id === x.dataset.sell); st.money += Math.round(SPECIES[a.sp].price * (a.baby ? 0.4 : 0.6)); st.animals = st.animals.filter((q) => q !== a); closeModal(); encCard(e); hud(); save(); }));
}
// ---------- cruces ----------
function crossPairs(e) {
  const as = animalsIn(e).filter((a) => !a.baby); const out = [];
  for (const m of as.filter((a) => a.sex === 'm')) for (const f of as.filter((a) => a.sex === 'f' && !a.preg)) { const child = crossChild(m.sp, f.sp); if (child && !SPECIES[f.sp].eggs) out.push({ m, f, child }); }
  return out;
}
// ---------- fotos de los animales ----------
// Se dibujan una vez por especie (con el mismo modelo 3D del parque) y se guardan
function zooPhotos(sps) { return thumbs('zoo-cube', [...new Set(sps)], (sp) => { const g = cubeModel(sp).g; g.rotation.y = 1.0; return g; }, { size: 120, dir: [0.2, 0.35, 1], fit: 0.85 }); }
const zimg = (src, biome, size = 56) => src ? `<img class="zphoto" src="${src}" alt="" style="width:${size}px;height:${size}px;background:radial-gradient(circle at 50% 40%, #fff8, transparent 70%), ${BIOMES[biome]?.color || '#9cc46a'}">` : `<span class="tilebox">${icon('paw')}</span>`;
function crossSection(e) {
  const pairs = crossPairs(e); const cph = zooPhotos(pairs.flatMap(({ m, f }) => [m.sp, f.sp]));
  const sps = new Set(animalsIn(e).map((a) => a.sp));
  const hints = CROSSES.filter((c) => sps.has(c.a || c.m) || sps.has(c.b || c.f)).map((c) => `${SPECIES[c.a || c.m].label}${c.m ? ' ♂' : ''} × ${SPECIES[c.b || c.f].label}${c.f ? ' ♀' : ''} → ${(st.hybrids || []).includes(c.child) ? SPECIES[c.child].label : '¿?'}`);
  return `<div class="sec">${icon('heart')} Cruces</div>${pairs.length ? `<div class="list">${pairs.slice(0, 6).map(({ m, f, child }) => `<div class="li">${zimg(cph[m.sp], SPECIES[m.sp].biome, 40)}${zimg(cph[f.sp], SPECIES[f.sp].biome, 40)}<div style="flex:1;min-width:0"><b>${esc(m.name)} ♂ × ${esc(f.name)} ♀</b><div class="hint">${SPECIES[m.sp].label} × ${SPECIES[f.sp].label} → ${child === f.sp ? 'cría de ' + SPECIES[child].label.toLowerCase() : (st.hybrids || []).includes(child) ? SPECIES[child].label : 'algo nuevo…'}</div></div><button class="btn sm coral" data-cross="${m.id}|${f.id}">Cruzar</button></div>`).join('')}</div>` : `<p class="hint">Junta en este recinto un macho y una hembra adultos de la misma especie o de especies emparentadas para cruzarlos.</p>`}${hints.length ? `<p class="hint" style="margin-top:6px">Cruces posibles con estas especies: ${hints.join(' · ')}</p>` : ''}`;
}
function doCross(m, f, e) {
  if (!m || !f) return;
  if (f.sick || m.sick) return toast('Primero hay que curar al animal enfermo', 'warn');
  if (f.happy < 50 || m.happy < 50) return toast('Tienen que estar contentos para criar: comida, espacio y su hábitat', 'warn');
  if (f.preg) return toast(`${f.name} ya espera una cría`, 'warn');
  const child = crossChild(m.sp, f.sp); if (!child) return toast('Estas especies no pueden cruzarse', 'warn');
  f.preg = { until: st.time + 1440, child, father: m.id }; closeModal();
  toast(child === f.sp ? `${f.name} espera una cría` : `${f.name} espera una cría de ${SPECIES[m.sp].label.toLowerCase()} y ${SPECIES[f.sp].label.toLowerCase()}`, 'good', 'heart'); save();
}
// Poner nombre a un animal
function renameAnimal(a, back) {
  if (!a) return;
  const bx = modal(`<h2>¿Cómo se llama?</h2><p class="hint">${SPECIES[a.sp].label}${a.baby ? ' (cría)' : ''} · ${a.sex === 'm' ? 'macho' : 'hembra'}</p><div class="field"><input type="text" id="rn" maxlength="16" value="${esc(a.name)}" autocomplete="off"></div>
    <div class="actions"><button class="btn alt" id="rnx">Cancelar</button><button class="btn coral" id="rnok">Guardar</button></div>`);
  const inp = bx.querySelector('#rn'); setTimeout(() => { inp.focus(); inp.select(); }, 50);
  const ok = () => { const v = inp.value.trim().slice(0, 16); if (!v) return toast('Escribe un nombre', 'warn'); a.name = v; closeModal(); save(); animalCardTick(true); if (back) back(); };
  bx.querySelector('#rnok').onclick = ok; inp.onkeydown = (ev) => { if (ev.key === 'Enter') ok(); };
  bx.querySelector('#rnx').onclick = () => { closeModal(); if (back) back(); };
}
function bldCard(b) {
  const B = BUILDINGS[b.type];
  const bx = modal(`<h2>${B.label}</h2><p class="hint">${B.cat === 'Tiendas' ? (B.sells ? `Cada visitante que compra deja ${eur(B.sells)}.` : 'Gratis para los visitantes: los deja más contentos.') : 'Decoración: alegra a los visitantes que pasan cerca.'}</p>
    <div class="actions" style="flex-direction:column"><button class="btn" id="bmv">${icon('move')} Mover</button><button class="btn alt" id="bdel">${icon('trash')} Quitar (recuperas ${eur(B.price / 2)})</button><button class="btn alt" id="bx">Cerrar</button></div>`);
  bx.querySelector('#bx').onclick = closeModal;
  bx.querySelector('#bmv').onclick = () => armMove({ kind: 'bld', ref: b });
  bx.querySelector('#bdel').onclick = () => { closeModal(); st.buildings = st.buildings.filter((q) => q !== b); st.money += Math.round(B.price / 2); hud(); save(); };
}
// Ver un objeto en 3D antes de comprarlo
function enrichPreview(k, biome) {
  const E = ENRICH[k];
  const bx = modal(`<h2>${E.label}</h2><div id="pv" style="background:${BIOMES[biome].color};border-radius:16px"></div><p class="hint">${E.biome ? `Propio de ${BIOMES[E.biome].label.toLowerCase()}: alegra más a sus animales.` : 'Vale para cualquier hábitat.'} ${E.hide ? 'Los tímidos se esconden en él.' : E.play ? 'Los juguetones juegan con él.' : E.water ? 'Pueden beber y refrescarse.' : ''} Gíralo con el dedo.</p>
    <div class="actions"><button class="btn alt" id="px">Cerrar</button><button class="btn coral" id="pok">${icon('tree')} Colocar · ${eur(E.price)}</button></div>`);
  const pv = preview(bx.querySelector('#pv'), { height: 180 }); pv.set(enrichMesh(k, biome, 3));
  const done = () => { pv.stop(); closeModal(); };
  bx.querySelector('#px').onclick = done;
  bx.querySelector('#pok').onclick = () => { done(); sheet.close(); setTool('enrich', k); };
}
function itemCard(key) {
  const [eid, i] = key.split(':'); const e = st.enclosures.find((q) => q.id === eid); const it = e && e.items[+i]; if (!it) return;
  const bx = modal(`<h2>${ENRICH[it.type].label}</h2><p class="hint">Los animales lo usan para entretenerse. También puedes mantenerlo pulsado y arrastrarlo, o soltarlo en la papelera.</p>
    <div class="actions" style="flex-direction:column"><button class="btn" id="imv">${icon('move')} Mover</button><button class="btn alt" id="idel">${icon('trash')} Quitar</button><button class="btn alt" id="ix">Cerrar</button></div>`);
  bx.querySelector('#ix').onclick = closeModal;
  bx.querySelector('#imv').onclick = () => armMove({ kind: 'item', ref: it, enc: e });
  bx.querySelector('#idel').onclick = () => { closeModal(); e.items.splice(+i, 1); st.money += Math.round(ENRICH[it.type].price / 2); hud(); save(); };
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
  if (mv && mv.sx != null) { const { dx, dy } = edgePan(mv.sx, mv.sy); if (dx || dy) { eng.pan(dx, dy); eng.lastInput = performance.now(); moveDrag(mv.sx, mv.sy); } }
  const paused = modalOpen() || st.speed === 0;
  if (!paused) { let g = dt * SPEEDS[st.speed]; while (g > 0) { const s = Math.min(g, 2); tick(s); g -= s; } }
  eng.activity = close ? 'close' : paused ? 'idle' : visitors.length && eng.cam.dist < 22 ? 'busy' : 'calm';
  if (close) { animalCardTick(); if (uiT > 0.45) renderCloseBar(); }
  uiT += dt; saveT += dt;
  if (uiT > 0.5) { uiT = 0; hud(); if (sheet.name === 'staff' || sheet.name === 'info') { /* refresco ligero */ } }
  if (saveT > 20) { saveT = 0; save(); }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); cloud.now(); } else { offline(); hud(); } });
window.addEventListener('pagehide', save);
if (store.load(KEY)) offline(); else say('rufina', 'Te damos la bienvenida a Parque Salvaje', `¡Hola! Soy Rufina, llevo cuarenta años cuidando animales y ahora te ayudaré con este parque.`, '¡A construir!', null, `<p>Construye tu propio parque de animales:</p><ul style="padding-left:18px;line-height:1.6"><li><b>Recintos</b>: elige hábitat y tamaño, junto a un camino.</li><li><b>Animales</b>: cada especie quiere su hábitat, espacio y compañía.</li><li><b>Caminos</b>: arrastra el dedo para que lleguen los visitantes.</li><li><b>Tiendas</b> y <b>decoración</b> para que gasten y vuelvan contentos.</li><li>La <b>fama</b> desbloquea especies nuevas.</li></ul>`);
hud();
$('#animalcard').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ren]'); if (b) renameAnimal(st.animals.find((q) => q.id === b.dataset.ren)); const v = ev.target.closest('[data-vet]'); if (v) callVet(st.animals.find((q) => q.id === v.dataset.vet)); });
Sound.init('zoo');
window.zoo = { eng, THREE, enterClose, rebuildEnclosures, organicModel, get st() { return st; }, get visitors() { return visitors; } };

// Al abrir: si en otro dispositivo hay una partida más reciente, se ofrece (o se recupera sola si aquí no había ninguna)
function cloudCheck() {
  if (!cloudSession()) return;
  cloud.newer(LOCAL_SAVED_AT).then((r) => {
    if (r === undefined) return; // sin conexión: se vuelve a mirar al recuperarla
    if (!r) return cloud.saved();
    if (!HAD_LOCAL) return useRemote(r.state);
    chooseSave(r.savedAt, () => useRemote(r.state), () => cloud.keepLocal());
  });
}
cloud.onRetry = cloudCheck;
if (sessionStorage.getItem('cloud_restored')) { sessionStorage.removeItem('cloud_restored'); setTimeout(() => toast('Partida recuperada de la nube', 'good', 'cloud'), 600); }
cloudCheck();
