// Parque Salvaje: gestiona tu propio parque de animales.
import { Engine, THREE, mat, blob, box, canvasTexture, RoundedBoxGeometry } from '../shared/engine3d.js';
import * as Look from '../shared/look.js';
Look.setStyle('cubito'); // vegetación y rocas en estilo cubito (diseño propio)
import { buildingMesh as propMesh, People } from './props3d.js';
import { animalModel as organicModel, setDetail as setAnimalDetail } from './animals3d.js';
import { cubeModel, cubeScale } from './cube3d.js';
import * as World from './world3d.js';
import { $, esc, eur, icon, toast, modal, closeModal, modalOpen, info, confirm, Sheet, store, trash, edgePan, say, pickOne, Sound } from '../shared/ui.js';
import { autoSync, pullSlot, session as cloudSession } from '../shared/cloud.js';
import { renderCloud, chooseSave } from '../shared/cloudui.js';
import { thumbs, preview } from '../shared/thumbs.js';
import { N as N0, ENTRANCE as ENTRANCE0, BIOMES, SIZES, SPECIES, ENRICH, enrichFor, BUILDINGS, PATH_PRICE, WAGES, FOOD_COST, SPONSOR, CARE, ANIMAL_NAMES, CARNIVORES, HYBRIDS, CROSSES, crossChild, TRAITS, ILLNESS, VET_VISIT, RESCUES } from './data.js';

const KEY = 'parque_save_v1';
const SPEEDS = [0, 1, 3, 8]; // minutos de juego por segundo real
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const pk = (x, z) => x + ',' + z;
const hourOf = (t) => (t % 1440) / 60, dayOf = (t) => Math.floor(t / 1440);

// ---------- estado ----------
// Tamaño del parque: empieza en 22×22 y se puede comprar más terreno (st.size)
let N = N0, ENTRANCE = { ...ENTRANCE0 };
const LAND = [{ size: 28, price: 5000, fame: 1.5 }, { size: 34, price: 12000, fame: 2.5 }, { size: 40, price: 25000, fame: 3.5 }];
function newPark() {
  const st = { v: 1, nextId: 1, money: 12000, time: 8 * 60, lastHour: 8, speed: 1, ticket: 15, fame: 1, paths: [], enclosures: [], animals: [], buildings: [], staff: { keeper: 1, cleaner: 0 }, litter: [], today: { visitors: 0, income: 0, spent: 0 }, history: [], lastSaved: Date.now() };
  for (let z = ENTRANCE.z; z >= ENTRANCE.z - 6; z--) st.paths.push(pk(ENTRANCE.x, z));
  for (let x = ENTRANCE.x - 4; x <= ENTRANCE.x + 4; x++) if (!st.paths.includes(pk(x, ENTRANCE.z - 6))) st.paths.push(pk(x, ENTRANCE.z - 6));
  return st;
}
const HAD_LOCAL = !!store.load(KEY);
let st = store.load(KEY) || newPark();
if (st.size) { N = st.size; ENTRANCE = { x: Math.floor(N / 2), z: N - 1 }; }
st.rescues ||= []; st.rescued ||= 0; st.chapter ||= 0; st.births ||= 0;
st.staff.vet ??= 0;
for (const a of st.animals) a.trait ||= pick(Object.keys(TRAITS));
// ---------- cuentas: todo el dinero que entra y sale, por categorías ----------
const INC = { entradas: 'Entradas', tiendas: 'Tiendas', donativos: 'Donativos de visitantes', padrinos: 'Padrinos de animales', premios: 'Premios de capítulos', ventas: 'Devoluciones (quitar cosas)', fuera: 'Mientras no estabas' };
const EXP = { sueldos: 'Sueldos del personal', comida: 'Comida diaria de animales', extra: 'Comida extra', cuidados: 'Premios y juguetes (confianza)', vet: 'Veterinario', obras: 'Obras: recintos, caminos y objetos', adopciones: 'Adopciones', terreno: 'Terreno' };
function earn(cat, n) { n = Math.round(n); if (!n) return; st.money += n; st.today.income += n; (st.today.inc ||= {})[cat] = (st.today.inc[cat] || 0) + n; }
function spend(cat, n) { n = Math.round(n); if (!n) return; st.money -= n; st.today.spent += n; (st.today.exp ||= {})[cat] = (st.today.exp[cat] || 0) + n; }
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
  earn('entradas', st.ticket); st.today.visitors++;
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
function logEvent(kind, text, who) { (st.today.events ||= []).push({ kind, text, who }); if (['birth', 'hatch', 'hybrid'].includes(kind)) st.births = (st.births || 0) + 1; }
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
      v.seen.add(t.enc); const as = animalsIn(e).filter((a) => !(a.den && a.state === 'hide')); comment(v, e, as); if (!as.length && Math.random() < 0.4) speak(v, pick(['¿Dónde están? Se habrán escondido', 'No se ve a nadie…', 'Shh, están dentro del refugio']));
      const appeal = as.reduce((s, a) => s + SPECIES[a.sp].appeal * (a.baby ? 1.5 : 1) * (0.5 + (a.trust ?? 100) / 200), 0);
      v.happy = clamp(v.happy + Math.min(30, appeal * 1.6) * (encHappy(e) / 100) + (encHappy(e) < 35 ? -6 : 0) + as.filter((a) => a.trait === 'presumido' || a.trait === 'curioso').length * 3);
    }
  }
  if (t.b) {
    const b = st.buildings.find((q) => q.id === t.b); const B = b && BUILDINGS[b.type];
    if (B && B.need) {
      if (B.need === 'recuerdo') { if (Math.random() < 0.5) { earn('tiendas', B.sells); v.happy = clamp(v.happy + 4); } }
      else { v[B.need] = clamp(v[B.need] - B.amount); earn('tiendas', B.sells); v.happy = clamp(v.happy + 3);
        if (B.sells && Math.random() < 0.3 && !st.buildings.some((q) => BUILDINGS[q.type].bin && Math.abs(q.x - v.x) + Math.abs(q.z - v.z) <= 4) && st.litter.length < 60) st.litter.push({ x: v.x, z: v.z, c: pick(['#e05a5a', '#f2f2f2', '#e8c04a']) }); }
    }
  }
}
// Cuántos visitantes caben a la vez: crece con el parque (y con cuidado de no calentar el móvil)
const maxVisitors = () => Math.min(eng.hq ? 70 : 50, 24 + st.enclosures.filter((e) => animalsIn(e).length).length * 6);
let wfCache = 50;
function visitorsTick(dt) {
  if (Math.random() < 0.02 * dt && visitors.length) { const v = pick(visitors); if (v.hambre > 75) speak(v, pick(['¡Qué hambre tengo!', '¿Dónde se come aquí?'])); else if (v.sed > 75) speak(v, pick(['Necesito beber algo…', '¡Qué sed!'])); else if (st.litter.length > 12) speak(v, pick(['Qué sucio está esto…', 'Faltan papeleras'])); else if (v.happy > 85) speak(v, pick(['¡Volveré seguro!', '¡Qué día tan bonito!'])); }
  const h = hourOf(st.time);
  if (h >= 9 && h < 19 && visitors.length < maxVisitors() && st.enclosures.some((e) => animalsIn(e).length)) {
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
  for (const v of visitors.filter((q) => q.gone)) { st.fame = clamp(st.fame + (v.happy / 20 - st.fame) * 0.02, 0, 5); if (v.happy > 45) earn('donativos', (v.happy - 45) / 55 * 6 * (0.5 + wfCache / 100)); }
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
    if (a.trust != null && a.trust < 100) a.trust = clamp(a.trust + (a.happy > 55 && !a.sick ? 0.012 * (st.staff.keeper ? 1 : 0.4) * (a.trait === 'timido' ? 0.6 : 1) : -0.004) * dt);
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
  spend('vet', VET_VISIT); cure(a); toast(`El veterinario ha curado a ${a.name} (${eur(VET_VISIT)})`, 'good', 'heart'); hud(); save(); animalCardTick(true);
}
// Qué hace un animal ahora: dormir de noche, comer si hay comida, beber, pastar, jugar, seguir a su madre...
// Lo que ocupa sitio dentro de un recinto (radio en casillas): los animales se ponen al lado, no dentro
const SOLID = { charca: 0.46, nenufares: 0.44, establo: 0.78, arbol: 0.32, acacia: 0.3, roca: 0.5, cueva: 0.62, cuevaroca: 0.66, trepador: 0.5, pajar: 0.45, comedero: 0.42, termitero: 0.3, tronco: 0.25, hielo: 0.42, tobogan: 0.5, troncocaido: 0.5, colmena: 0.2, juguete: 0.22, bambu: 0.3, helechos: 0.25, juncos: 0.2, islote: 0.48 };
function freeSpot(a, e, x, z) {
  const me = Math.max(0.18, SPECIES[a.sp].body[0] * 0.45 * cubeScale(a.sp) * (a.baby ? 0.55 : 1));
  for (let k = 0; k < 3; k++) {
    for (const it of e.items) { const r = SOLID[it.type]; if (!r) continue; const cx = it.x + 0.5, cz = it.z + 0.5, dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz), need = r + me; if (d < need) { const ux = d > 0.01 ? dx / d : Math.cos(a.x * 7), uz = d > 0.01 ? dz / d : Math.sin(a.z * 7); x = cx + ux * need; z = cz + uz * need; } }
    for (const o of st.animals) { if (o === a || o.enc !== a.enc) continue; const ox = o.tx ?? o.x, oz = o.tz ?? o.z, dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz), need = me + Math.max(0.18, SPECIES[o.sp].body[0] * 0.4 * cubeScale(o.sp)); if (d < need && !(a.baby && o.id === a.mother)) { const ux = d > 0.01 ? dx / d : 1, uz = d > 0.01 ? dz / d : 0; x = ox + ux * need; z = oz + uz * need; } }
  }
  return { x, z };
}
// Dónde se esconde: dentro de un refugio cerrado (establo, cueva) desaparece de la vista;
// detrás de un árbol o unas rocas se agacha en el lado contrario al camino; sin nada, se encoge en la esquina más lejana.
const DENS = { establo: 1, cueva: 1, cuevaroca: 1 };
function awayFromPath(e, x, z) {
  const P = pathSet(); let sx = 0, sz = 0, n = 0;
  for (let i = -1; i <= e.n; i++) for (const [px, pz] of [[e.x + i, e.z - 1], [e.x + i, e.z + e.n], [e.x - 1, e.z + i], [e.x + e.n, e.z + i]]) if (P.has(pk(px, pz))) { sx += px + 0.5; sz += pz + 0.5; n++; }
  if (!n) return { x: 0, z: -1 }; const dx = x - sx / n, dz = z - sz / n, d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d };
}
function hideSpot(a, e) {
  const covers = e.items.filter((i) => ENRICH[i.type]?.hide);
  const den = covers.filter((i) => DENS[i.type]).filter((i) => st.animals.filter((o) => o.den === i.x + ',' + i.z).length < 3)[0];
  if (den) return { x: den.x + 0.5, z: den.z + 0.5, den: den.x + ',' + den.z };
  if (covers.length) { const c = pick(covers); const u = awayFromPath(e, c.x + 0.5, c.z + 0.5); const r = (SOLID[c.type] || 0.3) + 0.3; return { x: c.x + 0.5 + u.x * r + rnd(-0.15, 0.15), z: c.z + 0.5 + u.z * r + rnd(-0.15, 0.15), crouch: true }; }
  const u = awayFromPath(e, e.x + e.n / 2, e.z + e.n / 2); return { x: e.x + e.n / 2 + u.x * e.n, z: e.z + e.n / 2 + u.z * e.n, crouch: true };
}
function decide(a, e) {
  a.den = null; a.crouch = false;
  const S = SPECIES[a.sp], h = hourOf(st.time), mg = Math.max(0.45, Math.min(e.n / 2 - 0.05, S.body[0] * 0.5 * cubeScale(a.sp) * (a.baby ? 0.55 : 1) + 0.28));
  const inside = (x, z) => ({ x: Math.min(e.x + e.n - mg, Math.max(e.x + mg, x)), z: Math.min(e.z + e.n - mg, Math.max(e.z + mg, z)) });
  const blocked = (x, z) => e.items.some((it) => SOLID[it.type] && Math.hypot(x - it.x - 0.5, z - it.z - 0.5) < SOLID[it.type] + 0.2);
  const go = (x, z, state, mins) => {
    let p = inside(x, z);
    for (let k = 0; k < 4; k++) { const q = freeSpot(a, e, p.x, p.z); p = inside(q.x, q.z); if (!blocked(p.x, p.z)) break; }
    // si sigue chocando (p. ej. una roca en una esquina), busca otro sitio libre del recinto
    for (let k = 0; k < 12 && blocked(p.x, p.z); k++) p = inside(e.x + rnd(mg, e.n - mg), e.z + rnd(mg, e.n - mg));
    a.tx = p.x; a.tz = p.z; a.state = state; a.restUntil = st.time + mins; };
  if (a.sick && Math.random() < 0.7) return go(a.x, a.z, 'sick', rnd(20, 40));
  const hideNow = (mins) => { const h = hideSpot(a, e); if (h.den) { a.tx = h.x; a.tz = h.z; a.state = 'hide'; a.den = h.den; a.restUntil = st.time + mins; } else { go(h.x, h.z, 'hide', mins); a.crouch = true; } };
  const tr = a.trust ?? 100;
  const calm = a.calmUntil > st.time;
  if (tr < 40 && !calm && Math.random() < 0.75 - tr / 100) return hideNow(rnd(25, 50) * (1 - tr / 80));
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
  if (a.trait === 'timido' && !calm && r < 0.3) return hideNow(rnd(12, 30));
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
      const g = as.filter((a) => a.sp === sp && !a.baby && (a.trust ?? 100) >= 50);
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
// ---------- santuario: rescates ----------
const pickSp = (list) => { const ok = list.filter((sp) => SPECIES[sp] && SPECIES[sp].fame <= st.fame + 0.6); return ok.length ? pick(ok) : null; };
function newRescue(first = false) {
  const kinds = Object.keys(RESCUES); let kind, sp;
  for (let i = 0; i < 12 && !sp; i++) { kind = first ? 'granja' : pick(kinds); sp = pickSp(first ? ['cabra', 'burro'] : RESCUES[kind].species); }
  if (!sp) return; const K = RESCUES[kind]; const n = first ? 2 : K.baby ? 1 : SPECIES[sp].social && Math.random() < 0.55 ? 2 : 1;
  st.rescues.push({ id: id(), kind, sp, n, sexes: n === 2 ? ['m', 'f'] : [Math.random() < 0.5 ? 'm' : 'f'], baby: !!K.baby, until: st.time + (first ? 99999 : 1440 * 1.5) });
  if (!first) toast(`Nuevo rescate: ${K.title.toLowerCase()} (${SPECIES[sp].label.toLowerCase()})`, 'info', 'paw');
  hud();
}
function rescueTick() {
  const before = st.rescues.length; const gone = st.rescues.filter((r) => r.until < st.time); st.rescues = st.rescues.filter((r) => r.until >= st.time);
  if (gone.length) toast(`Otro centro ha acogido ${gone.length > 1 ? 'a varios animales' : `al ${SPECIES[gone[0].sp].label.toLowerCase()}`} que esperaba hogar`, 'info');
  if (st.rescues.length < 3 && Math.random() < 0.22) newRescue();
  if (before !== st.rescues.length && sheet.name === 'animal') renderPanel();
}
// ¿Qué recintos le sirven? (su hábitat y algo de espacio)
function encFits(e, sp, n = 1) { const as = animalsIn(e); const used = as.reduce((t, m) => t + SPECIES[m.sp].space * (m.baby ? 0.5 : 1), 0); return { biome: e.biome === SPECIES[sp].biome, room: (e.n * e.n) - used >= SPECIES[sp].space * n * 0.9, danger: CARNIVORES.includes(sp) !== as.some((m) => CARNIVORES.includes(m.sp)) && as.length > 0 }; }
function acceptRescue(r) {
  const S = SPECIES[r.sp], K = RESCUES[r.kind];
  const list = st.enclosures.map((e) => ({ e, f: encFits(e, r.sp, r.n) }));
  const ok = list.filter((x) => x.f.room && !x.f.danger).sort((a, b) => (b.f.biome - a.f.biome));
  const bx = modal(`<h2>${K.title}</h2><div class="photobig">${zimg(zooPhotos([r.sp])[r.sp], S.biome, 150)}</div><p style="text-align:center;margin:4px 0"><b>${r.n > 1 ? `${r.n} × ` : ''}${S.label}${r.baby ? ' (cría)' : ''}</b></p><p class="hint" style="text-align:center">${K.story}</p>
    <div class="sec">¿En qué recinto vivirá?</div>${ok.length ? `<div class="list">${ok.map(({ e, f }) => `<button class="li" data-enc="${e.id}"><span class="tilebox" style="background:${BIOMES[e.biome].color}">${icon('fence')}</span><div style="flex:1;text-align:left"><b>Recinto de ${BIOMES[e.biome].label.toLowerCase()} ${e.n}×${e.n}</b><div class="hint">${animalsIn(e).length} animales${f.biome ? ' · <b style="color:#1a9a6a">su hábitat ideal</b>' : ` · prefiere ${BIOMES[S.biome].label.toLowerCase()}`}</div></div></button>`).join('')}</div>` : `<div class="card"><b>No tienes un recinto preparado</b><div class="hint">Construye un recinto de <b>${BIOMES[S.biome].label.toLowerCase()}</b> con sitio${CARNIVORES.includes(r.sp) ? ', solo para carnívoros' : ''}, y vuelve antes de que lo acoja otro centro.</div></div>`}
    <div class="actions"><button class="btn alt" id="rx">Cerrar</button>${ok.length ? '' : `<button class="btn coral" id="rbuild">${icon('fence')} Construir recinto</button>`}</div>`);
  bx.querySelector('#rx').onclick = closeModal;
  const rb = bx.querySelector('#rbuild'); if (rb) rb.onclick = () => { closeModal(); view.encSel = { biome: S.biome, size: SPECIES[r.sp].space > 5 ? 'L' : 'M' }; openPanel('enc'); };
  bx.querySelectorAll('[data-enc]').forEach((x) => (x.onclick = () => {
    const e = st.enclosures.find((q) => q.id === x.dataset.enc); closeModal();
    const names = [];
    for (let i = 0; i < r.n; i++) { const a = addAnimal(r.sp, e, r.baby); a.sex = r.sexes[i] || a.sex; a.rescued = r.kind; a.trust = K.trust + rnd(-5, 5); if (K.hungry) a.hunger = 25; if (K.injured) a.sick = { kind: 'pata', since: st.time }; a.story = K.story; a.arrived = dayOf(st.time) + 1; names.push(a.name); }
    st.rescues = st.rescues.filter((q) => q !== r); st.rescued += r.n; st.fame = clamp(st.fame + K.fame, 0, 5);
    logEvent('rescue', S.label, names.join(' y '));
    Sound.play('baby'); toast(`${names.join(' y ')} ${r.n > 1 ? 'han llegado' : 'ha llegado'} al santuario. Dale tiempo para ganar confianza.`, 'good', 'heart');
    if (st.rescued === r.n) say('rufina', '¡Tu primer rescate!', `${names[0]} está asustado/a y no conoce este sitio. Si come bien, tiene su hábitat y alguien que lo cuide, irá cogiendo confianza día a día.`, 'Entendido', null, '<p>Toca al animal para ver su historia y su <b>confianza</b>. Los animales con poca confianza se esconden y no crían.</p>');
    renderPanel(); hud(); save(); checkGoals();
  }));
}
// Bienestar del parque (0-100): felicidad, confianza y salud de todos los animales
function welfare() { if (!st.animals.length) return 0; return Math.round(st.animals.reduce((t, a) => t + a.happy * 0.6 + (a.trust ?? 100) * 0.25 + (a.sick ? 0 : 15), 0) / st.animals.length); }
// ---------- campaña ----------
const totalVisitors = () => st.history.reduce((t, h) => t + (h.visitors || 0), 0) + st.today.visitors;
const CHAPTERS = [
  { title: 'Abre el santuario', intro: 'Prepara tu primer recinto y acoge a un animal que necesita hogar.', reward: 1500, goals: [['Construye un recinto', () => st.enclosures.length >= 1], ['Acoge a tu primer animal rescatado', () => st.rescued >= 1], ['Recibe a 10 visitantes', () => totalVisitors() >= 10]] },
  { title: 'Un hogar para todos', intro: 'Cada vez llegan más avisos de rescate. Haz sitio y cuida bien de cada uno.', reward: 3000, goals: [['Acoge a 4 animales rescatados', () => st.rescued >= 4], ['Bienestar del parque al 60 %', () => welfare() >= 60], ['Abre una tienda para los visitantes', () => st.buildings.some((b) => BUILDINGS[b.type].sells)]] },
  { title: 'Ganarse su confianza', intro: 'Los animales rescatados desconfían. Con cuidados, comida y paciencia, se sentirán en casa.', reward: 4000, goals: [['3 animales con confianza al 80 %', () => st.animals.filter((a) => (a.trust ?? 100) >= 80 && a.rescued).length >= 3], ['Contrata a un veterinario', () => (st.staff.vet || 0) > 0]] },
  { title: 'Los felinos del circo', intro: 'Un circo va a cerrar y sus grandes felinos necesitan un sitio enorme y tranquilo.', reward: 6000, goals: [['Ten un recinto grande (8×8)', () => st.enclosures.some((e) => e.n >= 8)], ['Acoge a un león o un tigre', () => st.animals.some((a) => ['leon', 'tigre'].includes(a.sp) && a.rescued)]] },
  { title: 'Nueva vida', intro: 'Cuando un animal se siente seguro, forma familia. Ese es el mejor premio.', reward: 6000, goals: [['Nace una cría en el santuario', () => (st.births || 0) >= 1], ['Bienestar del parque al 70 %', () => welfare() >= 70]] },
  { title: 'Un santuario de referencia', intro: 'Todo el mundo habla de tu santuario. Demuestra que es el mejor.', reward: 10000, goals: [['Llega a 3★ de fama', () => st.fame >= 3], ['Ten 8 especies distintas', () => new Set(st.animals.map((a) => a.sp)).size >= 8], ['Bienestar del parque al 75 %', () => welfare() >= 75]] },
];
function checkGoals() {
  const C = CHAPTERS[st.chapter]; if (!C) return;
  if (C.goals.every(([, ok]) => ok())) {
    earn('premios', C.reward); st.chapter++; Sound.play('good'); const nx = CHAPTERS[st.chapter];
    say('rufina', `¡Capítulo completado: ${C.title}!`, nx ? `Te has ganado ${eur(C.reward)} para seguir creciendo. Siguiente reto: <b>${nx.title}</b>. ${nx.intro}` : `Te has ganado ${eur(C.reward)}. Has completado la campaña: tu santuario es un ejemplo para todos. Sigue rescatando y cuidando a tu ritmo.`, '¡Vamos!', null, nx ? `<div class="card"><b>${icon('flag')} ${nx.title}</b><ul style="padding-left:18px;margin:6px 0">${nx.goals.map(([t]) => `<li>${t}</li>`).join('')}</ul></div>` : '');
    hud(); save();
  }
  renderGoal();
}
function renderGoal() {
  let el = $('#goalpill'); if (!el) { el = document.createElement('button'); el.id = 'goalpill'; el.className = 'goalpill glass'; el.onclick = goalsModal; document.body.appendChild(el); }
  const C = CHAPTERS[st.chapter]; if (!C) { el.hidden = true; return; }
  const done = C.goals.filter(([, ok]) => ok()).length, next = C.goals.find(([, ok]) => !ok());
  el.hidden = false; const k = `${st.chapter}|${done}|${next?.[0]}`; if (el.dataset.k === k) return; el.dataset.k = k;
  el.innerHTML = `${icon('flag')}<span><b>${next ? next[0] : C.title}</b><i><span class="gp"><u style="transform:scaleX(${done / C.goals.length})"></u></span>Cap. ${st.chapter + 1} · ${done}/${C.goals.length}</i></span>`;
}
function goalsModal() {
  const C = CHAPTERS[st.chapter]; if (!C) return;
  const bx = modal(`<h2>${icon('flag')} Capítulo ${st.chapter + 1}: ${C.title}</h2><p class="hint">${C.intro}</p><div class="list">${C.goals.map(([t, ok]) => `<div class="li"><span class="tilebox" style="background:${ok() ? '#25c48f' : 'var(--fill)'};color:${ok() ? '#fff' : 'inherit'}">${icon(ok() ? 'check' : 'flag')}</span><div style="flex:1"><b>${t}</b></div></div>`).join('')}</div>
    <p class="hint">Recompensa: <b>${eur(C.reward)}</b>. Bienestar actual del parque: <b>${welfare()} %</b>.</p><div class="actions"><button class="btn coral" id="gx">Cerrar</button></div>`);
  bx.querySelector('#gx').onclick = closeModal;
}
function hourly(h) {
  wfCache = welfare(); rescueTick(); checkGoals();
  hatchNests(); health();
  if (h === 9 || h === 17) feedTimes();
  if (h === 6) breeding();
  for (let i = 0; i < st.staff.cleaner * 2 && st.litter.length; i++) st.litter.shift();
  if (h === 21) endOfDay();
}
// Al final del día: "La Gaceta Salvaje", el periódico del parque, con los titulares de la jornada
function endOfDay() {
  if (st.animals.length) st.fame = clamp(st.fame + (welfare() - 55) / 600, 0, 5);
  const wages = st.staff.keeper * WAGES.keeper + st.staff.cleaner * WAGES.cleaner + (st.staff.vet || 0) * WAGES.vet, food = st.animals.length * FOOD_COST;
  const fans = st.animals.filter((a) => (a.trust ?? 100) >= 80 && a.happy > 55 && !a.sick).length; earn('padrinos', fans * SPONSOR);
  spend('sueldos', wages); spend('comida', food);
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
  st.today = { visitors: 0, income: 0, spent: 0, events: [], inc: {}, exp: {} };
  save();
}
function tick(dt) {
  st.time += dt;
  const hr = Math.floor(st.time / 60);
  while (st.lastHour < hr) { st.lastHour++; hourly(st.lastHour % 24); }
  animalsTick(dt); visitorsTick(dt);
}
function expandLand() {
  const next = LAND.find((l) => l.size > N); if (!next) return;
  if (st.fame < next.fame) return toast(`Necesitas ${next.fame}★ de fama para comprar más terreno`, 'warn');
  if (st.money < next.price) return toast('No hay dinero suficiente', 'warn');
  confirm(`¿Comprar terreno hasta ${next.size}×${next.size} por ${eur(next.price)}? El parque crece por los lados y por el fondo.`, () => {
    const dx = Math.floor(next.size / 2) - Math.floor(N / 2), dz = next.size - N; const mv = (o) => { if (o) { o.x += dx; o.z += dz; } };
    for (const e of st.enclosures) { mv(e); e.items.forEach(mv); (e.nests || []).forEach(mv); mv(e.food); }
    for (const a of st.animals) { mv(a); if (a.tx != null) { a.tx += dx; a.tz += dz; } }
    st.buildings.forEach(mv); st.litter.forEach(mv);
    st.paths = st.paths.map((k) => { const [x, z] = k.split(',').map(Number); return pk(x + dx, z + dz); });
    // (la entrada antigua cae justo en la nueva: los caminos siguen conectados)
    spend('terreno', next.price); st.size = next.size; swapping = false; save(); location.reload();
  });
}
function save() { if (swapping) return; st.lastSaved = Date.now(); store.save(KEY, st); cloud.saved(); }
// Con la app cerrada: pasa el tiempo más despacio y se estima lo ganado
function offline() {
  const mins = Math.min((Date.now() - st.lastSaved) / 1000 * 0.2, 1440); if (mins < 20) return;
  const last = st.history[0]; const est = last ? Math.max(0, last.profit) * (mins / 1440) * 0.5 : 0;
  st.time += mins; st.lastHour = Math.floor(st.time / 60); earn('fuera', est);
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
const parkGround = new THREE.Mesh(new THREE.PlaneGeometry(N + 1, N + 1), new THREE.MeshLambertMaterial({ map: World.lawnTex(N) }));
parkGround.rotation.x = -Math.PI / 2; parkGround.position.set(N / 2, 0, N / 2); parkGround.receiveShadow = true; S3.add(parkGround);
{ const hg = new THREE.Mesh(new THREE.CircleGeometry(140, 48), new THREE.MeshLambertMaterial({ map: World.meadowTex(140 / 4) })); hg.rotation.x = -Math.PI / 2; hg.position.set(N / 2, -0.02, N / 2); hg.receiveShadow = true; S3.add(hg); }
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
const gate = World.gate(); gate.position.set(ENTRANCE.x + 0.5, 0, ENTRANCE.z + 0.5); S3.add(gate);
const groups = { tufts: new THREE.Group(), paths: new THREE.Group(), enc: new THREE.Group(), bld: new THREE.Group(), animals: new THREE.Group(), people: new THREE.Group(), litter: new THREE.Group(), ghost: new THREE.Group() };
Object.values(groups).forEach((g) => S3.add(g));
const ov = document.createElement('canvas'); ov.className = 'overlay2d'; canvas.after(ov); const octx = ov.getContext('2d');

let sig = {};
const pathMat = new THREE.MeshLambertMaterial({ map: Look.pavingTex(1) });
function rebuildPaths() {
  const g = groups.paths; g.clear(); const n = st.paths.length; if (!n) return;
  const P = pathSet(); g.add(World.pathMesh(st.paths.map((p) => p.split(',').map(Number)), (x, z) => P.has(pk(x, z)), (x, z) => x === ENTRANCE.x && z > ENTRANCE.z));
}
const BIOME_TREE = { granja: 'roble', sabana: 'roble', selva: 'palmera', artico: 'pino', humedal: 'abedul', bosque: 'pino' };
function tree(scale = 1, kind = 'roble', seed = 1) { const g = new THREE.Group(); const t = Look.tree(kind, scale, seed); if (kind === 'roble' && scale > 1.1) t.scale.y = scale * 0.85; g.add(t); g.add(blob(0.9 * scale, 0.9 * scale, 0.3)); return g; }
function enrichMesh(type, biome = 'sabana', seed = 1) {
  const g = new THREE.Group();
  if (type === 'arbol') g.add(tree(1.25, BIOME_TREE[biome], seed));
  if (type === 'roca') { for (let i = 0; i < 3; i++) { const r = Look.rock(0.2 + i * 0.07, biome === 'artico' ? '#b8c0c8' : '#9a9286', seed + i); r.position.x = i * 0.26 - 0.26; r.position.z = (i % 2) * 0.2; r.rotation.y = i * 2; g.add(r); } }
  if (type === 'charca') { // el agua se dibuja junta para todo el recinto (pondMesh); aquí solo la zona que se puede tocar
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.12, 0.95), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.06; g.add(hit);
  }
  if (type === 'juguete') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshLambertMaterial({ map: ballTex() })); b.position.y = 0.17; b.rotation.z = 0.4; g.add(b, blob(0.5, 0.5)); }
  if (type === 'bambu') for (let i = 0; i < 7; i++) { const h = 1.0 + Math.random() * 0.6; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, h, 6, 4), mat(i % 2 ? '#7ab84a' : '#5e9e3c')); c.position.set(Math.cos(i * 1.7) * 0.22, h / 2, Math.sin(i * 2.3) * 0.22); c.rotation.z = rnd(-0.08, 0.08); g.add(c);
    for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 3), mat('#4e8e34')); l.scale.z = 0.2; l.position.set(c.position.x + 0.08, h * (0.55 + k * 0.15), c.position.z); l.rotation.z = -1.1; l.rotation.y = k * 2; g.add(l); } }
  const M = (c) => mat(c), cyl = (rt, rb, h, c, seg = 8) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof c === 'string' ? M(c) : c);
  const at = (o, x, y, z, ry = 0) => { o.position.set(x, y, z); o.rotation.y = ry; g.add(o); return o; };
  // ---- granja
  if (type === 'pajar') { const straw = new THREE.MeshLambertMaterial({ map: strawTex() }); for (const [x, y, z, r] of [[-0.2, 0.14, 0, 0.1], [0.2, 0.14, 0.05, -0.1], [0, 0.42, 0.02, 0.3]]) at(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.3), straw), x, y, z, r); for (let i = 0; i < 6; i++) { const w = box(0.02, 0.005, 0.12, '#e8c860'); at(w, rnd(-0.45, 0.45), 0.01, rnd(-0.35, 0.35), rnd(0, 3)); } }
  if (type === 'comedero') { at(box(0.8, 0.06, 0.32, '#8a5a32', 0.01), 0, 0.3, 0); for (const sz of [-1, 1]) { const sd = box(0.8, 0.14, 0.03, '#7a4e2a'); at(sd, 0, 0.38, sz * 0.15); } for (const [x, z] of [[-0.35, -0.12], [0.35, -0.12], [-0.35, 0.12], [0.35, 0.12]]) at(box(0.05, 0.3, 0.05, '#6a4222'), x, 0.15, z); const hay = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.08, 0.24), new THREE.MeshLambertMaterial({ map: strawTex() })); at(hay, 0, 0.38, 0); }
  if (type === 'establo') { // granero de bloques: paredes, tejado a dos aguas bien encajado y puerta
    g.scale.setScalar(1.2); const red = M('#b8452e');
    const wall = new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.6, 0.75, 2, 0.03), red); at(wall, 0, 0.3, 0);
    const tri = new THREE.Shape(); tri.moveTo(-0.45, 0); tri.lineTo(0.45, 0); tri.lineTo(0, 0.3); tri.closePath();
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.75, bevelEnabled: false }), red); at(gable, 0, 0.6, -0.375);
    const ang = Math.atan2(0.3, 0.45), len = Math.hypot(0.45, 0.3) + 0.08;
    for (const sx of [-1, 1]) { const roof = box(len, 0.05, 0.86, '#4a3a32'); roof.rotation.z = -sx * ang; at(roof, sx * 0.225, 0.6 + 0.15 + 0.03, 0); }
    const door = box(0.32, 0.42, 0.02, '#f2ece0'); at(door, 0, 0.21, 0.38);
    for (const r of [0.9, -0.9]) { const x1 = box(0.4, 0.03, 0.025, '#f2ece0'); x1.rotation.z = r; at(x1, 0, 0.21, 0.395); }
    const win = box(0.14, 0.12, 0.02, '#f2ece0'); at(win, 0, 0.72, 0.385); }
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
  if (type === 'cueva') { g.scale.set(1.05, 1.25, 1.05); const ice = M('#e2f2fa'); const dome = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), ice); at(dome, 0, 0, 0); const hole = new THREE.Mesh(new THREE.CircleGeometry(0.17, 12, 0, Math.PI), M('#3a5a6a')); at(hole, 0, 0.0, 0.44); for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45 * Math.cos(i * 0.45 + 0.2), 0.006, 3, 24), M('#c4dce8')); ring.rotation.x = Math.PI / 2; at(ring, 0, 0.45 * Math.sin(i * 0.45 + 0.2), 0); } }
  // ---- humedal
  if (type === 'nenufares') { const w = new THREE.Mesh(new THREE.CircleGeometry(0.46, 20), new THREE.MeshLambertMaterial({ map: Look.waterTex(), transparent: true, opacity: 0.9 })); w.rotation.x = -Math.PI / 2; at(w, 0, 0.04, 0); g.userData.water = w; for (let i = 0; i < 5; i++) { const pad = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10, 0.3, Math.PI * 1.8), M('#4a9a4a')); pad.rotation.x = -Math.PI / 2; at(pad, rnd(-0.28, 0.28), 0.05, rnd(-0.28, 0.28)); if (i % 2 === 0) { const fl = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.05, 6), M(i % 4 ? '#f6f0f4' : '#f08ab4')); at(fl, pad.position.x, 0.08, pad.position.z); } } }
  if (type === 'juncos') for (let i = 0; i < 16; i++) { const h = 0.45 + Math.random() * 0.4; const r = cyl(0.008, 0.014, h, i % 3 ? '#6a9a3a' : '#7aa848', 3); r.rotation.z = rnd(-0.18, 0.18); at(r, rnd(-0.35, 0.35), h / 2, rnd(-0.35, 0.35)); if (i % 3 === 0) at(cyl(0.022, 0.022, 0.09, '#6a4a2a', 6), r.position.x, h - 0.04, r.position.z); }
  if (type === 'islote') { const w = new THREE.Mesh(new THREE.CircleGeometry(0.48, 22), new THREE.MeshLambertMaterial({ map: Look.waterTex(), transparent: true, opacity: 0.92 })); w.rotation.x = -Math.PI / 2; at(w, 0, 0.04, 0); g.userData.water = w; const isl = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), M('#8aa05a')); isl.scale.y = 0.35; at(isl, 0, 0.03, 0); const nest = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.04, 5, 12), new THREE.MeshLambertMaterial({ map: strawTex() })); nest.rotation.x = Math.PI / 2; at(nest, 0, 0.14, 0); for (let i = 0; i < 2; i++) at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M('#f4efe2')), (i - 0.5) * 0.05, 0.14, 0); }
  // ---- bosque
  if (type === 'troncocaido') { const t = cyl(0.13, 0.15, 1.1, '#6a4a2e', 10); t.rotation.z = Math.PI / 2; at(t, 0, 0.14, 0, 0.5); for (const sx of [-1, 1]) { const end = cyl(0.13, 0.13, 0.01, '#c8a06a', 10); end.rotation.z = Math.PI / 2; end.position.set(sx * 0.55, 0, 0); t.add(end); end.rotation.set(0, 0, 0); end.position.set(0, sx * 0.555, 0); } for (let i = 0; i < 4; i++) at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 4), M('#4e7a3a')), rnd(-0.3, 0.3), 0.27, rnd(-0.12, 0.12)); for (let i = 0; i < 3; i++) { const m2 = cyl(0.03, 0.01, 0.04, '#d8c8a0', 6); at(m2, 0.3 + i * 0.05, 0.03, 0.15); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), M('#c0432a')); at(cap, 0.3 + i * 0.05, 0.05, 0.15); } }
  if (type === 'colmena') { const post = cyl(0.05, 0.06, 0.8, '#6a4a2e'); at(post, 0, 0.4, 0); const hive = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), M('#e0a830')); hive.scale.set(1, 1.25, 1); at(hive, 0.12, 0.66, 0); for (let i = 0; i < 4; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15 * Math.sin((i + 1) / 5 * Math.PI), 0.012, 4, 14), M('#c88a20')); ring.rotation.x = Math.PI / 2; at(ring, 0.12, 0.66 + (i - 1.5) * 0.08, 0); } const hole = new THREE.Mesh(new THREE.CircleGeometry(0.03, 8), M('#3a2a10')); at(hole, 0.12, 0.6, 0.155); const arm = box(0.16, 0.03, 0.03, '#6a4a2e'); at(arm, 0.06, 0.82, 0); }
  if (type === 'cuevaroca') { g.scale.setScalar(1.15); for (const [x, y, z, sz, c] of [[-0.3, 0.2, 0, 0.32, '#8a8378'], [0.3, 0.2, 0, 0.32, '#7d776d'], [0, 0.5, -0.05, 0.36, '#958e82'], [0, 0.18, -0.3, 0.28, '#8a8378']]) at(Look.rock(sz, c, seed + x * 10 + z * 7 + 1), x, y, z); const hole = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12, 0, Math.PI), M('#2a2620')); at(hole, 0, 0.02, 0.18); }
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
// Charcas: las casillas de agua que se tocan forman una sola charca más grande, con una orilla continua
function pondMesh(e) {
  const tiles = e.items.filter((i) => i.type === 'charca'); if (!tiles.length) return null;
  const set = new Set(tiles.map((t) => pk(t.x, t.z))), has = (x, z) => set.has(pk(x, z));
  const PX = 48, S = e.n * PX; const cv = document.createElement('canvas'); cv.width = cv.height = S; const x = cv.getContext('2d');
  const shape = (r, w) => { // círculo en cada casilla + puentes entre vecinas + relleno de los huecos 2×2
    for (const t of tiles) { const cx = (t.x - e.x + 0.5) * PX, cz = (t.z - e.z + 0.5) * PX; x.beginPath(); x.arc(cx, cz, r * PX, 0, 7); x.fill();
      if (has(t.x + 1, t.z)) x.fillRect(cx, cz - w * PX / 2, PX, w * PX); if (has(t.x, t.z + 1)) x.fillRect(cx - w * PX / 2, cz, w * PX, PX);
      if (has(t.x + 1, t.z) && has(t.x, t.z + 1) && has(t.x + 1, t.z + 1)) x.fillRect(cx, cz, PX, PX); } };
  x.fillStyle = '#8a7a52'; shape(0.5, 1.0); // orilla de tierra
  x.fillStyle = '#6aa0b8'; shape(0.43, 0.86); // borde de agua poco profunda
  x.fillStyle = '#3f8fc4'; shape(0.36, 0.72); // agua
  x.globalCompositeOperation = 'source-atop'; x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 2; for (let i = 0; i < tiles.length * 5; i++) { const t = tiles[i % tiles.length]; const cx = (t.x - e.x + 0.2 + Math.random() * 0.6) * PX, cz = (t.z - e.z + 0.2 + Math.random() * 0.6) * PX; x.beginPath(); x.arc(cx, cz, 4 + Math.random() * 6, 3.6, 5.8); x.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(e.n, e.n), new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(e.x + e.n / 2, 0.062, e.z + e.n / 2); m.receiveShadow = true; m.renderOrder = 1; g.add(m);
  // piedras y juncos solo por el borde de fuera (donde no hay otra casilla de agua)
  const R = Look.seeded(tiles.length * 13 + e.x * 7 + e.z);
  for (const t of tiles) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (has(t.x + dx, t.z + dz)) continue;
    const ox = t.x + 0.5 + dx * 0.46 + (R() - 0.5) * 0.5 * (dz ? 1 : 0), oz = t.z + 0.5 + dz * 0.46 + (R() - 0.5) * 0.5 * (dx ? 1 : 0);
    if (R() < 0.6) { const r = Look.rock(0.05 + R() * 0.03, '#8d877a', Math.floor(R() * 99)); r.position.set(ox, 0.06, oz); g.add(r); }
    else if (e.biome !== 'artico') for (let k = 0; k < 3; k++) { const rd = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.28 + R() * 0.16, 0.022), mat(k % 2 ? '#5a8a3a' : '#6e9e44')); rd.position.set(ox + (R() - 0.5) * 0.12, 0.2, oz + (R() - 0.5) * 0.12); rd.rotation.z = (R() - 0.5) * 0.3; g.add(rd); } }
  return g;
}
const postGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.84, 6), postMat = mat('#6a4a2a');
function rebuildEnclosures() {
  const g = groups.enc; g.clear(); eng.shadowsDirty?.();
  for (const e of st.enclosures) {
    const eg = new THREE.Group(); eg.userData.enc = e.id; g.add(eg);
    eg.add(World.enclosureBase(e));
    e.items.forEach((it, i) => { const m = enrichMesh(it.type, e.biome, it.x * 7 + it.z); m.position.set(it.x + 0.5, 0.05, it.z + 0.5); m.userData.item = e.id + ':' + i; eg.add(m); });
    const pond = pondMesh(e); if (pond) eg.add(pond);
  }
}
function rebuildBuildings() { const g = groups.bld; g.clear(); eng.shadowsDirty?.(); for (const b of st.buildings) { const m = propMesh(b, BUILDINGS); Look.shadows(m, true, false); m.position.set(b.x + 0.5, 0.05, b.z + 0.5); m.rotation.y = faceToPath(b); m.userData.bld = b.id; g.add(m); } }
// las tiendas miran hacia el camino más cercano
function faceToPath(b) { const P = pathSet(); for (const [dx, dz, r] of [[0, 1, 0], [1, 0, Math.PI / 2], [0, -1, Math.PI], [-1, 0, -Math.PI / 2]]) if (P.has(pk(b.x + dx, b.z + dz))) return r; return 0; }

// Animales orgánicos (ver animals3d.js)
const animalMeshes = new Map();
let glbReady = false; const GLB = {};
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
    // dentro del refugio se desvanece (entra y desaparece); al salir vuelve a verse
    const inDen = a.den && a.state === 'hide' && !moving && !(mv && mv.ref === a); m.fade = (m.fade ?? 1) + ((inDen ? 0 : 1) - (m.fade ?? 1)) * Math.min(1, rdt * 4);
    m.g.visible = m.fade > 0.04;
    const k = (a.baby ? 0.55 : 1) * (m.baseScale || 1) * (0.35 + 0.65 * m.fade); m.g.scale.setScalar(k);
    const S = SPECIES[a.sp]; const w = moving ? Math.sin(t * (S.hop ? 9 : 7) + a.x) : 0;
    const crouch = a.state === 'hide' && a.crouch && !moving; const sleeping = (a.state === 'sleep' || a.state === 'sick') && !moving, headDown = !moving && ['eat', 'drink', 'graze'].includes(a.state);
    if (m.glb) { // modelo animado: elige la animación según lo que hace y a qué velocidad va de verdad
      const L = (GLB[a.sp]?.len || 1) * (a.baby ? 0.55 : 1), v = m.vel || 0;
      m.walking = m.walking ? v > 0.04 : v > 0.12; // con margen, para que no parpadee entre andar y parar
      if (m.walking) { const walkV = 0.55 * L, runV = 2.2 * L; if (v > walkV * 1.9) m.play('Gallop', { speed: Math.max(0.7, Math.min(2, v / runV)) }); else m.play('Walk', { speed: Math.max(0.6, Math.min(1.8, v / walkV)) }); }
      else if (headDown) m.play('Eating'); else if (sleeping) m.play(['Idle_Headlow', 'Idle_2_HeadLow', 'Idle'], { speed: 0.35 });
      else if (a.state === 'play') m.play(['Jump_toIdle', 'Jump_ToIdle', 'Idle_2']); else m.play(['Idle', 'Idle_2']);
      m.update(rdt);
      continue;
    }
    m.body.position.y = S.hop && moving ? Math.abs(w) * 0.2 : sleeping ? -(m.legH ?? S.legs) * 0.85 : crouch ? -(m.legH ?? S.legs) * 0.45 + Math.sin(t * 9 + a.x) * 0.006 : 0;
    m.legs.forEach((l, i) => { l.visible = !sleeping; l.rotation.x = S.hop ? 0 : (i % 2 === (i < 2 ? 0 : 1) ? w : -w) * 0.5; const k = l.userData.knee; if (k) k.rotation.x = l.userData.back ? -Math.max(0, l.rotation.x) * 1.1 : Math.max(0, -l.rotation.x) * 1.1; });
    m.neck.rotation.x = m.neckRx + (headDown ? (m.headDown ?? 0.9) + Math.sin(t * 3 + a.x) * 0.08 : sleeping ? (m.headDown ?? 0.9) * 0.6 : crouch ? (m.headDown ?? 0.9) * 0.45 : 0);
    m.head.rotation.x = moving ? 0 : headDown ? 0.4 : sleeping ? 0.3 : crouch ? 0.25 : Math.sin(t * 0.8 + a.z) * 0.25 + 0.1;
    m.tail.rotation.z = Math.sin(t * (a.state === 'play' ? 8 : 3) + a.x) * (sleeping || crouch ? 0.05 : 0.3);
    m.torso.scale.x = (a.preg ? 1.3 : 1) * (m.torsoSX ??= m.torso.scale.x);
    if (a.state === 'play' && !moving) m.g.rotation.y += Math.sin(t * 4) * 0.02;
  }
  for (const [k, m] of animalMeshes) if (!seen.has(k)) { groups.animals.remove(m.g); animalMeshes.delete(k); }
}
const peopleMeshes = new Map();
let people = null;
function syncPeople(t) { (people ||= new People(groups.people, 90)).sync(visitors, t); }
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
  const fl = [];
  for (let x = 0; x < N; x++) for (let z = 0; z < N; z++) { if (P.has(pk(x, z)) || encAt(x, z) || buildingAt(x, z) || (x === ENTRANCE.x && z >= ENTRANCE.z - 1)) continue; const k = (x * 31 + z * 17) % 7; for (let i = 0; i < (eng.hq ? 1 + (k % 2) : k % 2); i++) pts.push([x + ((k * 13 + i * 37) % 97) / 97, z + ((k * 29 + i * 53) % 89) / 89]); if (k === 3 || (eng.hq && k === 5)) for (let i = 0; i < 3; i++) fl.push([x + 0.2 + ((k * 7 + i * 41) % 61) / 100, z + 0.2 + ((k * 11 + i * 23) % 59) / 100]); }
  g.add(World.lawnDetail(pts, fl));
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
    const label = m.g.visible ? a.name : a.name + (a.sex === 'f' ? ' · escondida' : ' · escondido'); octx.font = '800 12px Nunito, sans-serif'; const w = octx.measureText(label).width + 14; const sel = a.id === followId;
    octx.fillStyle = sel ? 'rgba(31,37,64,0.92)' : 'rgba(255,255,255,0.88)'; octx.beginPath(); octx.roundRect(q.x - w / 2, q.y - 11, w, 20, 10); octx.fill();
    octx.fillStyle = sel ? '#fff' : '#1f2540'; octx.textAlign = 'center'; octx.textBaseline = 'middle'; octx.fillText(label, q.x, q.y);
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
  if (view.erase) { if (st.paths.includes(key) && !(t.x === ENTRANCE.x && t.z >= ENTRANCE.z - 1)) { st.paths = st.paths.filter((p) => p !== key); earn('ventas', PATH_PRICE / 2); } return; }
  if (occupied(t.x, t.z) || st.money < PATH_PRICE) return;
  st.paths.push(key); spend('obras', PATH_PRICE);
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
  if (m.kind === 'bld') { st.buildings = st.buildings.filter((q) => q !== r); earn('ventas', BUILDINGS[r.type].price / 2); toast(`${BUILDINGS[r.type].label} quitado · recuperas ${eur(BUILDINGS[r.type].price / 2)}`, 'info', 'trash'); }
  else if (m.kind === 'item') { m.enc.items = m.enc.items.filter((q) => q !== r); earn('ventas', ENRICH[r.type].price / 2); toast(`${ENRICH[r.type].label} quitado`, 'info', 'trash'); }
  else if (m.kind === 'animal') { const p = Math.round(SPECIES[r.sp].price * (r.baby ? 0.4 : 0.6)); return confirm(`¿Vender a ${r.name} por ${eur(p)}?`, () => { earn('ventas', p); st.animals = st.animals.filter((q) => q !== r); hud(); save(); }); }
  else if (m.kind === 'enc') { const as = animalsIn(r); return confirm(as.length ? `Se venderán los ${as.length} animales. ¿Derribar el recinto?` : '¿Derribar el recinto?', () => { earn('ventas', as.reduce((t, a) => t + SPECIES[a.sp].price * 0.6, 0) + SIZES[Object.keys(SIZES).find((k) => SIZES[k].n === r.n)].price * 0.4); st.animals = st.animals.filter((a) => a.enc !== r.id); st.enclosures = st.enclosures.filter((q) => q !== r); hud(); save(); }); }
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
    const S = SPECIES[view.opt]; const fee = Math.round(S.price * 0.5); if (st.money < fee) return toast('No hay dinero suficiente', 'warn');
    spend('adopciones', fee); const a = addAnimal(view.opt, e); a.trust = 55; a.rescued = 'adopcion'; a.story = 'Nació en otro santuario y ha venido en adopción. Se adapta rápido.'; a.arrived = dayOf(st.time) + 1; logEvent(st.animals.some((q) => q !== a && q.sp === a.sp) ? 'arrive' : 'newsp', S.label, a.name);
    toast(e.biome !== S.biome ? `${a.name} (${S.label.toLowerCase()}) ha llegado, pero prefiere el hábitat de ${BIOMES[S.biome].label.toLowerCase()}` : `${a.name} (${S.label.toLowerCase()}, ${a.sex === 'm' ? 'macho' : 'hembra'}) llega al parque. Puedes cambiarle el nombre en su ficha`, e.biome !== S.biome ? 'warn' : 'good', 'paw');
    hud(); save(); return;
  }
  if (view.tool === 'enrich') {
    const e = t && encAt(t.x, t.z); if (!e) return toast('Toca dentro de un recinto', 'warn');
    if (e.items.some((i) => i.x === t.x && i.z === t.z)) return; const E = ENRICH[view.opt]; if (E.biome && E.biome !== e.biome) return toast(`${E.label} es para recintos de ${BIOMES[E.biome].label.toLowerCase()}`, 'warn'); if (st.money < E.price) return toast('No hay dinero suficiente', 'warn');
    spend('obras', E.price); e.items.push({ type: view.opt, x: t.x, z: t.z }); hud(); save(); return;
  }
  if (view.tool === 'build') {
    if (!t || !inGrid(t.x, t.z) || occupied(t.x, t.z)) return toast('Ese sitio está ocupado', 'warn');
    const B = BUILDINGS[view.opt];
    if (B.cat === 'Tiendas' && !nextToPath(t.x, t.z)) return toast('Las tiendas deben estar junto a un camino', 'warn');
    if (st.money < B.price) return toast('No hay dinero suficiente', 'warn');
    spend('obras', B.price); st.buildings.push({ id: id(), type: view.opt, x: t.x, z: t.z }); hud(); save(); return;
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
  $('#closebar').hidden = false; document.body.classList.add('closeview'); renderCloseBar();
}
function exitClose() {
  close = null; followId = null; nestCard = null; eng.cam.follow = null; eng.cam.min = 4; eng.cam.pitchT = 0.9; eng.cam.distT = eng.fitDist(15);
  $('#closebar').hidden = true; $('#animalcard').hidden = true; document.body.classList.remove('closeview');
}
function followAnimal(aid) { followId = aid; nestCard = null; eng.follow(() => (followId ? animalWorld(followId) : null)); eng.cam.distT = Math.min(eng.cam.dist, eng.fitDist(3.2)); cardT = 0; animalCardTick(true); if (close) renderCloseBar(); }
function renderCloseBar() {
  const e = st.enclosures.find((q) => q.id === close); if (!e) return exitClose();
  const as = animalsIn(e);
  const key = e.id + as.length + e.biome + !!followId; if ($('#closebar').dataset.k === key) return; $('#closebar').dataset.k = key;
  $('#closebar').innerHTML = `<span class="ttl">${BIOMES[e.biome].label} <span class="cnt">${icon('paw')} ${as.length}</span></span><button class="btn sm" id="cb_f">${icon('eye')} ${followId ? 'Siguiente' : 'Seguir'}</button><button class="btn sm alt" id="cb_i" aria-label="Ficha del recinto">${icon('menu')}</button><button class="btn sm alt" id="cb_x" aria-label="Salir">${icon('x')}</button>`;
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
    <div class="hint" style="color:${animalStatus(a)[1]};font-weight:800">${animalStatus(a)[0]}${a.preg ? ` · embarazada (nace en ${Math.max(1, Math.round((a.preg.until - st.time) / 60))} h)` : ''}${kids ? ` · ${kids} ${kids > 1 ? 'crías' : 'cría'}` : ''}${mom ? ` · hija de ${esc(mom.name)}` : ''}</div></div></div>
    ${a.sick ? `<div class="sickrow">${icon('alert')} <div style="flex:1;min-width:0"><b>Se encuentra mal: ${ILLNESS[a.sick.kind].toLowerCase()}</b><div class="hint">${sickWhy(a).length ? 'Por qué: ' + sickWhy(a).join(', ') + '. ' : ''}${st.staff.vet ? 'El veterinario lo atenderá pronto.' : ''}</div></div><button class="btn sm coral" data-vet="${a.id}">Curar · ${eur(VET_VISIT)}</button></div>` : ''}
    <div class="stat" style="margin:6px 0 0"><span class="tile" style="background:#f08a3c">${icon('food')}</span><span>Hambre</span><div class="bar"><i style="transform:scaleX(${a.hunger / 100});background:${a.hunger < 30 ? '#e5484d' : '#f08a3c'}"></i></div></div>
    <div class="stat" style="margin:4px 0 0"><span class="tile" style="background:#25c48f">${icon('heart')}</span><span>Felicidad</span><div class="bar"><i style="transform:scaleX(${a.happy / 100});background:${a.happy < 35 ? '#e5484d' : '#25c48f'}"></i></div></div>
    ${a.trust != null ? `<div class="stat" style="margin:4px 0 0"><span class="tile" style="background:#8b5cf6">${icon('smile')}</span><span>Confianza</span><div class="bar"><i style="transform:scaleX(${a.trust / 100});background:${a.trust < 40 ? '#f5a524' : '#8b5cf6'}"></i></div></div>` : ''}
    ${a.story ? `<div class="hint" style="margin-top:6px">${icon('book')} ${a.story}${a.trust != null ? (a.trust < 40 ? ' Aún desconfía: se esconde y no criará.' : a.trust < 80 ? ' Va cogiendo confianza.' : ' Ya se siente en casa.') : ''}</div>` : ''}
    <div class="carerow" style="margin-top:6px">${careButtons(a, true)}</div>`;
  el.hidden = false;
}
// ---------- cuidados para ganar confianza ----------
function careLeft(a, k) { const t = (a.care || {})[k]; return t == null ? 0 : Math.max(0, t + CARE[k].cd - st.time); }
function careAnimal(a, k) {
  const C = CARE[k]; if (!a || !C) return; const left = careLeft(a, k);
  if (left > 0) return toast(`${a.name} necesita un rato tranquilo. Prueba otra vez en ${Math.ceil(left / 60)} h`, 'info');
  if (C.keeper && !st.staff.keeper) return toast('Necesitas un cuidador (en Personal)', 'warn');
  if (a.sick && k !== 'keeper') return toast(`${a.name} se encuentra mal: primero, el veterinario`, 'warn');
  if (st.money < C.price) return toast('No hay dinero suficiente', 'warn');
  spend('cuidados', C.price); (a.care ||= {})[k] = st.time;
  const tr0 = a.trust ?? 100, gain = Math.round(C.gain * (a.trait === 'timido' ? 0.75 : 1));
  if (a.trust != null) a.trust = clamp(a.trust + gain);
  a.happy = clamp(a.happy + (C.happy || 5)); if (k === 'treat') a.hunger = clamp(a.hunger + 12);
  a.calmUntil = st.time + 90; a.restUntil = 0; // sale del escondite un rato
  const o = a.sex === 'f' ? 'a' : 'o';
  const msg = tr0 < 25 ? pick([`${a.name} no se acerca, pero lo coge en cuanto te alejas`, `${a.name} te mira desde lejos, ya con menos miedo`]) : tr0 < 60 ? pick([`${a.name} se acerca despacio`, `${a.name} ya no sale corriendo`]) : pick([`${a.name} viene directo hacia ti`, `¡${a.name} está encantad${o}!`]);
  toast(a.trust != null && tr0 < 100 ? `${msg} · confianza +${gain}` : msg, 'good', C.ic); Sound.play('good'); hud(); save();
}
function careButtons(a, short = false) {
  return Object.entries(CARE).map(([k, C]) => { const left = careLeft(a, k), off = left > 0 || (C.keeper && !st.staff.keeper);
    return `<button class="btn sm ${off ? 'alt' : 'mint'}" data-care="${a.id}|${k}" ${off ? 'disabled' : ''} title="${C.desc}">${icon(C.ic)} ${short ? C.short : C.label}${left > 0 ? ` · ${Math.ceil(left / 60)} h` : C.price ? ' · ' + eur(C.price) : C.keeper && !st.staff.keeper ? ' · sin cuidador' : ''}</button>`; }).join('');
}
function animalStatus(a) {
  const o = a.sex === 'f' ? 'a' : 'o';
  if (a.sick) return [`Enferm${o}: ${ILLNESS[a.sick.kind].toLowerCase()}`, '#e5484d'];
  if (a.state === 'hide') return [a.den ? `Escondid${o} dentro del refugio` : `Escondid${o} y agachad${o}`, '#8b5cf6'];
  if (a.hunger < 30) return ['Tiene hambre', '#f08a3c'];
  if (a.happy < 35) return [`Triste`, '#f5a524'];
  const t = STATE_TXT[a.state] || 'tranquilo'; return [t[0].toUpperCase() + t.slice(1), '#25c48f'];
}
const needScore = (a) => (a.sick ? 300 : 0) + (a.hunger < 30 ? 150 : 0) + (100 - (a.trust ?? 100)) + (a.happy < 35 ? 60 : 0) + (a.state === 'hide' ? 20 : 0);
const minibar = (v, col) => `<span class="mbar"><i style="width:${Math.round(v)}%;background:${col}"></i></span>`;
function animalsOverview() {
  const flt = view.aflt || 'need'; const ph = zooPhotos(st.animals.map((a) => a.sp));
  let as = [...st.animals].sort((x, y) => needScore(y) - needScore(x));
  const hid = st.animals.filter((a) => a.state === 'hide').length, sick = st.animals.filter((a) => a.sick).length, shy = st.animals.filter((a) => (a.trust ?? 100) < 40).length, hungry = st.animals.filter((a) => a.hunger < 30).length;
  if (flt === 'need') as = as.filter((a) => needScore(a) >= 20); if (flt === 'hide') as = as.filter((a) => a.state === 'hide');
  return `<div class="chips" id="aflt"><button class="chip ${flt === 'need' ? 'on' : ''}" data-f="need">Necesitan algo</button><button class="chip ${flt === 'hide' ? 'on' : ''}" data-f="hide">Escondidos · ${hid}</button><button class="chip ${flt === 'all' ? 'on' : ''}" data-f="all">Todos · ${st.animals.length}</button></div>
    <p class="hint">${sick ? `${sick} enfermo${sick > 1 ? 's' : ''} · ` : ''}${hungry ? `${hungry} con hambre · ` : ''}${shy} desconfiado${shy === 1 ? '' : 's'} (se esconden mucho). Los cuidados suben la confianza; con un 80 % tendrán padrinos que pagan ${eur(SPONSOR)} al día.</p>
    <div class="list">${as.map((a) => { const [txt, col] = animalStatus(a); const e = st.enclosures.find((q) => q.id === a.enc); const tr = a.trust ?? 100;
      return `<div class="li aov">${zimg(ph[a.sp], SPECIES[a.sp].biome, 52)}<div style="flex:1;min-width:0"><b>${esc(a.name)}</b> <span class="hint">${SPECIES[a.sp].label}${a.baby ? ' (cría)' : ''}${e ? ' · ' + BIOMES[e.biome].label.toLowerCase() : ''}</span>
        <div class="hint" style="color:${col};font-weight:800">${txt}</div>
        <div class="mrow"><span>Confianza</span>${minibar(tr, tr < 40 ? '#f5a524' : '#8b5cf6')}<b>${Math.round(tr)}%</b><span>Feliz</span>${minibar(a.happy, a.happy < 35 ? '#e5484d' : '#25c48f')}<b>${Math.round(a.happy)}%</b><span>Comida</span>${minibar(a.hunger, a.hunger < 30 ? '#e5484d' : '#f08a3c')}<b>${Math.round(a.hunger)}%</b></div>
        <div class="carerow">${a.sick ? `<button class="btn sm coral" data-vet="${a.id}">Curar · ${eur(VET_VISIT)}</button>` : ''}${careButtons(a, true)}<button class="btn sm alt" data-see="${a.id}" aria-label="Ver">${icon('eye')}</button></div></div></div>`; }).join('') || `<p class="hint">${st.animals.length ? '¡Todos están bien! Nadie necesita nada ahora mismo.' : 'Aún no tienes animales. Acoge un rescate más abajo.'}</p>`}</div>`;
}
function bindOverview(b, again) {
  b.querySelectorAll('#aflt [data-f]').forEach((x) => (x.onclick = () => { view.aflt = x.dataset.f; again(); }));
  b.querySelectorAll('[data-care]').forEach((x) => (x.onclick = () => { const [aid, k] = x.dataset.care.split('|'); careAnimal(st.animals.find((q) => q.id === aid), k); again(); }));
  b.querySelectorAll('[data-vet]').forEach((x) => (x.onclick = () => { callVet(st.animals.find((q) => q.id === x.dataset.vet)); again(); }));
  b.querySelectorAll('[data-see]').forEach((x) => (x.onclick = () => { const a = st.animals.find((q) => q.id === x.dataset.see); const e = a && st.enclosures.find((q) => q.id === a.enc); if (!e) return; enterClose(e); followAnimal(a.id); }));
}
// ---------- cuentas ----------
function sumCats(days, key) { const out = {}; for (const d of days) { const m = d[key] || (key === 'inc' ? { otros: d.income || 0 } : { otros: d.spent || 0 }); for (const [k, v] of Object.entries(m)) out[k] = (out[k] || 0) + v; } return out; }
function catList(m, LBL, col) {
  const tot = Object.values(m).reduce((t, v) => t + v, 0); const rows = Object.entries(m).filter(([, v]) => v).sort((x, y) => y[1] - x[1]);
  if (!rows.length) return '<p class="hint">Nada todavía.</p>';
  return rows.map(([k, v]) => `<div class="frow"><span>${LBL[k] || 'Otros'}</span><span class="mbar"><i style="width:${Math.max(3, v / tot * 100)}%;background:${col}"></i></span><b>${eur(v)}</b></div>`).join('');
}
function financeTips(days) {
  const n = Math.max(1, days.length), inc = sumCats(days, 'inc'), exp = sumCats(days, 'exp'); const tips = [];
  const fixed = st.staff.keeper * WAGES.keeper + st.staff.cleaner * WAGES.cleaner + (st.staff.vet || 0) * WAGES.vet + st.animals.length * FOOD_COST;
  tips.push(`Gastos fijos de cada día: <b>${eur(fixed)}</b> (sueldos ${eur(fixed - st.animals.length * FOOD_COST)} + comida ${eur(st.animals.length * FOOD_COST)}). Se cobran a las 21:00.`);
  const obras = (exp.obras || 0) + (exp.terreno || 0) + (exp.adopciones || 0), allExp = Object.values(exp).reduce((t, v) => t + v, 0);
  if (allExp && obras / allExp > 0.3) tips.push(`El ${Math.round(obras / allExp * 100)} % de lo gastado son obras, terreno y adopciones: es inversión, no se repite cada día.`);
  if (!st.buildings.some((b) => BUILDINGS[b.type].sells)) tips.push('No tienes tiendas: cada visitante podría gastar 10-25 € más en comida, bebida y regalos.');
  else if ((inc.tiendas || 0) < (inc.entradas || 0) * 0.3) tips.push('Las tiendas venden poco: ponlas junto a caminos con mucho paso y añade aseos (si no, los visitantes se van antes).');
  if (st.staff.keeper > Math.ceil(st.animals.length / 8) + 1) tips.push(`Tienes más cuidadores de los necesarios: cada uno cuida 8 animales y cuesta ${eur(WAGES.keeper)} al día.`);
  const shy = st.animals.filter((a) => (a.trust ?? 100) < 80).length; if (shy) tips.push(`${shy} animal${shy > 1 ? 'es aún no confían' : ' aún no confía'} del todo. Con un 80 % de confianza consiguen padrinos: ${eur(SPONSOR)} al día cada uno.`);
  if (wfCache < 60) tips.push(`Bienestar del parque ${wfCache} %: los visitantes contentos dejan donativos; animales felices = más donativos y más fama.`);
  if (st.ticket < 15 && st.fame >= 2) tips.push('Con tu fama puedes subir un poco la entrada sin perder muchos visitantes.');
  const vis = days.reduce((t, d) => t + (d.visitors || 0), 0) / n; if (vis && vis < 40) tips.push(`Vienen unos ${Math.round(vis)} visitantes al día. Más recintos con animales y más fama atraen a más gente (caben ${maxVisitors()} a la vez).`);
  return tips;
}
function financeModal() {
  const per = view.fper || 'today'; const days = per === 'today' ? [st.today] : per === 'yest' ? st.history.slice(0, 1) : [st.today, ...st.history.slice(0, 6)];
  const inc = sumCats(days, 'inc'), exp = sumCats(days, 'exp'); const ti = Object.values(inc).reduce((t, v) => t + v, 0), te = Object.values(exp).reduce((t, v) => t + v, 0), pr = ti - te;
  const hist = [...st.history.slice(0, 10)].reverse(); const mx = Math.max(1, ...hist.map((h) => Math.abs(h.profit)));
  const bx = modal(`<h2>${icon('chart')} Cuentas del santuario</h2>
    <div class="seg" id="fper"><button data-v="today" class="${per === 'today' ? 'on' : ''}">Hoy</button><button data-v="yest" class="${per === 'yest' ? 'on' : ''}" ${st.history.length ? '' : 'disabled'}>Ayer</button><button data-v="week" class="${per === 'week' ? 'on' : ''}">7 días</button></div>
    <div class="ftot"><div><span>Ingresos</span><b style="color:#127a52">${eur(ti)}</b></div><div><span>Gastos</span><b style="color:#c2343a">${eur(te)}</b></div><div><span>Resultado</span><b style="color:${pr >= 0 ? '#127a52' : '#c2343a'}">${pr >= 0 ? '+' : ''}${eur(pr)}</b></div></div>
    ${per === 'today' ? '<p class="hint">El día aún no ha terminado: sueldos, comida y padrinos se suman a las 21:00.</p>' : ''}
    <div class="sec">Entra</div>${catList(inc, { ...INC, otros: 'Ingresos (sin desglose)' }, '#25c48f')}
    <div class="sec">Sale</div>${catList(exp, { ...EXP, otros: 'Gastos (sin desglose)' }, '#e5484d')}
    ${hist.length ? `<div class="sec">Beneficio de los últimos días</div><div class="fchart">${hist.map((h) => `<div title="Día ${h.day}: ${eur(h.profit)}"><i style="height:${Math.max(3, Math.abs(h.profit) / mx * 100)}%;background:${h.profit >= 0 ? '#25c48f' : '#e5484d'}"></i><span>${h.day}</span></div>`).join('')}</div>` : ''}
    <div class="sec">${icon('sparkle')} Consejos de Rufina</div><div class="list">${financeTips(per === 'today' ? [st.today, ...st.history.slice(0, 3)] : days).map((t) => `<div class="li" style="font-size:13.5px"><div>${t}</div></div>`).join('')}</div>
    <div class="actions"><button class="btn coral" id="fx">Cerrar</button></div>`);
  bx.querySelector('#fx').onclick = closeModal;
  bx.querySelectorAll('#fper button').forEach((x) => (x.onclick = () => { view.fper = x.dataset.v; closeModal(); financeModal(); }));
}
function hud() {
  $('#money b').textContent = eur(st.money);
  const h = hourOf(st.time); const open = h >= 9 && h < 20;
  $('#clock .t b').textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(st.time % 60)).padStart(2, '0')}`;
  $("#clock .t span").textContent = `Día ${dayOf(st.time) + 1}`;
  $('#fame b').textContent = `${stars()}`;
  const rdot = $('#tools [data-t="animal"] .dot'); if (rdot) rdot.hidden = !st.rescues.length;
  const spP = $('#sp_p'), spX = $('#sp_x'); if (spP) { const k = st.speed ? 'run' + st.speed : 'paused'; if (spP.dataset.k !== k) { spP.dataset.k = k; spP.innerHTML = icon(st.speed ? 'pause' : 'play'); spP.classList.toggle('paused', !st.speed); spX.textContent = `×${st.speed || lastSpeed || 1}`; spX.classList.toggle('fast', st.speed > 1); } }
  document.querySelectorAll('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.t === sheet.name || (b.dataset.t === 'path' && view.tool === 'path')));
}
function renderToolInfo() {
  const el = $('#toolinfo'); if (!view.tool) { el.hidden = true; return; } el.hidden = false;
  let txt = '';
  if (view.tool === 'path') txt = `${icon('path')} ${view.erase ? 'Borrar caminos: arrastra el dedo' : `Caminos: arrastra el dedo · ${PATH_PRICE} € por casilla`} <button class="btn sm alt" id="ti_erase">${view.erase ? 'Construir' : 'Borrar'}</button>`;
  if (view.tool === 'enc') txt = `${icon('fence')} Recinto ${SIZES[view.opt.size].label.toLowerCase()} de ${BIOMES[view.opt.biome].label.toLowerCase()} · toca el terreno ${view.pending ? `<button class="btn sm mint" id="ti_ok">Construir · ${eur(SIZES[view.opt.size].price)}</button>` : ''}`;
  if (view.tool === 'animal') txt = `${icon('paw')} Toca el recinto donde vivirá: ${SPECIES[view.opt].label} (adopción ${eur(Math.round(SPECIES[view.opt].price * 0.5))})`;
  if (view.tool === 'enrich') txt = `${icon('tree')} Toca dentro de un recinto: ${ENRICH[view.opt].label}`;
  if (view.tool === 'move') txt = `${icon('move')} Arrastra el dedo para mover ${LABEL[view.opt.kind](view.opt.ref)}`;
  if (view.tool === 'build') txt = `${icon('shop')} Toca una casilla libre${BUILDINGS[view.opt].cat === 'Tiendas' ? ' junto a un camino' : ''}: ${BUILDINGS[view.opt].label}`;
  el.innerHTML = `${txt}<button class="x" id="ti_x" aria-label="Terminar">${icon('x')}</button>`;
  $('#ti_x').onclick = () => setTool(null);
  const er = $('#ti_erase'); if (er) er.onclick = () => { view.erase = !view.erase; renderToolInfo(); };
  const ok = $('#ti_ok'); if (ok) ok.onclick = () => {
    const p = view.pending; const price = SIZES[view.opt.size].price; if (st.money < price) return toast('No hay dinero suficiente', 'warn');
    if (!canPlaceEnclosure(p.x, p.z, p.n)) return;
    spend('obras', price); const e = { id: id(), x: p.x, z: p.z, n: p.n, biome: view.opt.biome, items: [] }; st.enclosures.push(e);
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
    const adopt = (v) => Math.round(v.price * 0.5);
    b.innerHTML = `<div class="sec">${icon('paw')} Tus animales</div>${animalsOverview()}<div class="sec">${icon('heart')} Animales que necesitan hogar</div><p class="hint">Avisos de rescate: acógelos gratis si tienes un recinto preparado. Si tardas, los acogerá otro centro.</p>
      ${st.rescues.length ? `<div class="list">${st.rescues.map((r) => { const S = SPECIES[r.sp], K = RESCUES[r.kind]; const fit = st.enclosures.some((e) => { const f = encFits(e, r.sp, r.n); return f.room && !f.danger; }); return `<div class="li rescue">${zimg(zph[r.sp], S.biome, 64)}<div style="flex:1;min-width:0"><b>${K.title}</b><div class="hint"><b>${r.n > 1 ? `${r.n} × ` : ''}${S.label}${r.baby ? ' (cría)' : ''}</b> · ${BIOMES[S.biome].label}</div><div class="hint" style="font-style:italic">${K.story}</div><div class="hint">${r.until > st.time + 99000 ? '' : `Espera hogar ${Math.max(1, Math.round((r.until - st.time) / 60))} h más · `}${fit ? '<b style="color:#1a9a6a">Tienes sitio</b>' : 'Necesita recinto'}</div></div><div style="display:flex;flex-direction:column;gap:6px"><button class="btn sm coral" data-res="${r.id}">Acoger</button><button class="btn sm alt" data-skip="${r.id}">No puedo</button></div></div>`; }).join('')}</div>` : '<p class="hint">Ahora mismo no hay avisos. Llegan cada pocas horas.</p>'}
      <div class="sec">${icon('users')} Adoptar de otros centros</div><p class="hint">Animales nacidos en otros santuarios que buscan familia. Pagas una pequeña cuota de adopción y el transporte. Más fama desbloquea especies.</p><div class="grid">${Object.entries(SPECIES).filter(([, v]) => !v.hybrid).map(([k, v]) => { const lock = st.fame < v.fame; return `<button class="item" data-a="${k}" ${lock ? 'disabled' : ''}>${zimg(zph[k], v.biome, 64)}${v.label}<span class="d">${BIOMES[v.biome].label}</span>${lock ? `<span class="lock">Fama ${v.fame}★</span>` : `<span class="p">${eur(adopt(v))}</span>`}</button>`; }).join('')}</div>`;
    bindOverview(b, renderPanel);
    b.querySelectorAll('[data-res]').forEach((x) => (x.onclick = () => acceptRescue(st.rescues.find((r) => r.id === x.dataset.res))));
    b.querySelectorAll('[data-skip]').forEach((x) => (x.onclick = () => { st.rescues = st.rescues.filter((r) => r.id !== x.dataset.skip); toast('Otro centro se encargará de él', 'info'); renderPanel(); save(); }));
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
      <button class="btn mint" id="fin" style="width:100%;margin-top:6px">${icon('chart')} Ver cuentas: ingresos y gastos</button>
      ${last ? `<div class="stat"><span class="tile" style="background:#2fa8e0">${icon('chart')}</span><span>Ayer</span><b>${eur(last.profit)} de beneficio</b></div>` : ''}
      <div class="stat"><span class="tile" style="background:#8b5cf6">${icon('paw')}</span><span>Animales</span><b>${st.animals.length} en ${st.enclosures.length} recintos</b></div></div>
      <div class="sec">Precio de la entrada</div><div class="row" style="align-items:center"><button class="btn sm alt" id="tm">−</button><b style="flex:1;text-align:center;font-size:20px">${st.ticket} €</b><button class="btn sm alt" id="tp">+</button></div>
      <p class="hint">Más caro da más por visitante pero vienen menos.</p>
      <div class="sec">${icon('map')} Terreno</div>${(() => { const nx = LAND.find((l) => l.size > N); return `<div class="card"><b>Tu parque mide ${N}×${N} casillas</b><div class="hint">${nx ? `Si se te queda pequeño, compra terreno: crece hasta ${nx.size}×${nx.size}.${st.fame < nx.fame ? ` Necesitas ${nx.fame}★ de fama.` : ''}` : 'Has comprado todo el terreno disponible.'}</div>${nx ? `<button class="btn coral" id="land" style="width:100%;margin-top:8px" ${st.fame < nx.fame ? 'disabled' : ''}>${icon('map')} Comprar terreno · ${eur(nx.price)}</button>` : ''}</div>`; })()}
      <div class="sec">${icon('cloud')} Copia en la nube</div><div id="cloudbox"></div>
      <div class="sec">Calidad gráfica</div><div class="seg" id="q"><button data-v="eco">Ahorro</button><button data-v="alta">Alta</button></div>
      ${soundRow()}
      <div class="row" style="margin-top:16px"><a class="btn alt" href="../">${icon('home')} Menú de juegos</a><button class="btn red" id="reset">${icon('trash')} Empezar de nuevo</button></div>`;
    bindSound(b);
    b.querySelector('#fin').onclick = financeModal;
    const landB = b.querySelector('#land'); if (landB) landB.onclick = expandLand;
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
  box2.querySelector('#feed').onclick = () => { if (st.money < as.length * 5) return toast('No hay dinero suficiente', 'warn'); spend('extra', as.length * 5); putFood(e); closeModal(); toast('Has dejado comida en el recinto', 'good', 'food'); hud(); };
  box2.querySelector('#demo').onclick = () => { closeModal(); confirm(`Se venderán los ${as.length} animales. ¿Derribar?`, () => { earn('ventas', as.reduce((t, a) => t + SPECIES[a.sp].price * 0.6, 0) + SIZES[Object.keys(SIZES).find((k) => SIZES[k].n === e.n)].price * 0.4); st.animals = st.animals.filter((a) => a.enc !== e.id); st.enclosures = st.enclosures.filter((q) => q !== e); hud(); save(); }); };
  box2.querySelectorAll('[data-sell]').forEach((x) => (x.onclick = () => { const a = st.animals.find((q) => q.id === x.dataset.sell); earn('ventas', SPECIES[a.sp].price * (a.baby ? 0.4 : 0.6)); st.animals = st.animals.filter((q) => q !== a); closeModal(); encCard(e); hud(); save(); }));
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
  bx.querySelector('#bdel').onclick = () => { closeModal(); st.buildings = st.buildings.filter((q) => q !== b); earn('ventas', B.price / 2); hud(); save(); };
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
  bx.querySelector('#idel').onclick = () => { closeModal(); e.items.splice(+i, 1); earn('ventas', ENRICH[it.type].price / 2); hud(); save(); };
}
function animalCard(aid) { const a = st.animals.find((q) => q.id === aid); if (!a) return; encCard(st.enclosures.find((e) => e.id === a.enc)); }

// Velocidad: un botón de pausa y otro que cambia el ritmo (×1 → ×2 → ×3)
document.querySelector('#speeds').innerHTML = `<button id="sp_p" aria-label="Pausa"></button><button id="sp_x" aria-label="Velocidad"></button>`;
let lastSpeed = 1;
$('#sp_p').onclick = () => { if (st.speed) { lastSpeed = st.speed; st.speed = 0; } else st.speed = lastSpeed || 1; hud(); };
$('#sp_x').onclick = () => { st.speed = st.speed ? (st.speed % 3) + 1 : lastSpeed || 1; lastSpeed = st.speed; hud(); };
document.querySelector('#tools').innerHTML = [['path', 'path', 'Caminos'], ['enc', 'fence', 'Recintos'], ['animal', 'heart', 'Animales'], ['build', 'shop', 'Tiendas'], ['staff', 'users', 'Personal'], ['info', 'chart', 'Parque']].map(([t, ic, l]) => `<button data-t="${t}" style="position:relative">${icon(ic)}<span>${l}</span>${t === 'animal' ? '<i class="dot" hidden></i>' : ''}</button>`).join('');
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
if (store.load(KEY)) offline(); else { newRescue(true); say('rufina', 'Este santuario es tuyo', '¡Hola! Soy Rufina. Aquí no se compran animales: se rescatan, se cuidan y se les da una segunda vida.', '¡Empezamos!', null, `<div class="pillars">
    <div><span class="ic" style="background:#ee6f47">${icon('heart')}</span><span><b>Rescata</b>Llegan avisos de animales sin hogar. Acógelos en un recinto de su hábitat.</span></div>
    <div><span class="ic" style="background:#7c5cd6">${icon('smile')}</span><span><b>Gánate su confianza</b>Llegan con miedo y se esconden. Premios, juegos y su cuidador les ayudan.</span></div>
    <div><span class="ic" style="background:#2aa876">${icon('users')}</span><span><b>Abre las puertas</b>Caminos y tiendas atraen visitantes, y ellos pagan los gastos.</span></div></div>
    <p class="hint" style="margin-top:10px">Tu primer aviso ya está aquí: dos animales de una granja abandonada. Toca <b>Animales</b> abajo.</p>`); }
renderGoal();
hud();
$('#animalcard').addEventListener('click', (ev) => { const b = ev.target.closest('[data-ren]'); if (b) renameAnimal(st.animals.find((q) => q.id === b.dataset.ren)); const v = ev.target.closest('[data-vet]'); if (v) callVet(st.animals.find((q) => q.id === v.dataset.vet)); const c = ev.target.closest('[data-care]'); if (c) { const [aid, k] = c.dataset.care.split('|'); careAnimal(st.animals.find((q) => q.id === aid), k); animalCardTick(true); } });
Sound.init('zoo');
window.zoo = { eng, THREE, parkGround, enterClose, rebuildEnclosures, organicModel, tick, addAnimal, decide, financeModal, followAnimal, get st() { return st; }, get visitors() { return visitors; } };

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
$('#money').onclick = financeModal; $('#money').setAttribute('role', 'button'); $('#money').setAttribute('aria-label', 'Ver cuentas');
