// Simulación pura (sin dibujo ni DOM). El renderizador solo lee el estado,
// así que puede sustituirse por uno 3D sin tocar este archivo.
import {
  NEEDS, BABY_NEEDS, DECAY, BABY_DECAY, TRAITS, AGES, AGE_ORDER, OBJECTS, ACTIONS, SOCIALS,
  CAREERS, SCHOOL, MOODLETS, WORRIES, SKINS, HAIR_COLORS, CLOTHES, NAMES_F, NAMES_M, NAMES_X, gx, SKILLS, ASPIRATIONS, REWARDS, OUTINGS, PETS, PET_NEEDS, PET_NAMES, SEASONS, WEATHER, WINDOW_PRICE, EYE_STYLES, EYE_COLORS, FLOOR_STYLES, WALL_COLORS, WALL_PATTERNS, TINTS, FURN_STYLES,
} from './data.js';

export const GRID = 12;      // tamaño del solar
export const HOUSE = 10;     // interior de la casa (0..9)
export const EXIT = { x: 11, y: 6 };
export const MAX_HOUSEHOLD = 4;
const WALK_SPEED = 2.6;      // casillas por minuto de juego
const SAVE_VERSION = 1;

// ---------- utilidades ----------
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const events = [];
export function drainEvents() { return events.splice(0); }
function emit(type, data = {}) { events.push({ type, ...data }); }
function toast(msg, kind = 'info', simId = null) { emit('toast', { msg, kind, simId }); }

export const isAdult = (s) => s.age === 'adulto' || s.age === 'anciano';
export const dayOf = (t) => Math.floor(t / 1440);
export const hourOf = (t) => (t % 1440) / 60;
export const dowOf = (t) => dayOf(t) % 7;

// ---------- creación ----------
export function randomLook(gender) {
  return {
    skin: pick(SKINS), hair: gender === 'f' ? pick([0, 1, 1, 2]) : gender === 'x' ? pick([0, 1, 2, 3]) : pick([0, 0, 3, 2]),
    body: gender === 'f' ? (Math.random() < 0.7 ? 'vestido' : 'recto') : gender === 'x' ? pick(['recto', 'vestido']) : 'recto',
    hairColor: pick(HAIR_COLORS.slice(0, 6)), shirt: pick(CLOTHES), pants: pick(CLOTHES),
    eyes: pick(Object.keys(EYE_STYLES)), eyeColor: pick(EYE_COLORS.slice(0, 6)),
  };
}

export function randomName(gender) { return pick(gender === 'f' ? NAMES_F : gender === 'x' ? NAMES_X : NAMES_M); }
export const ALL_GENDERS = ['f', 'm', 'x'];
export function defaultFertility(g) { return { canCarry: g === 'f', canSire: g === 'm' }; }

export function makeSim(state, def) {
  const id = 's' + state.nextId++;
  const age = def.age || 'adulto';
  const needs = {};
  (age === 'bebe' ? BABY_NEEDS : NEEDS).forEach((n) => (needs[n] = rnd(65, 90)));
  const sim = {
    id, name: def.name || randomName(def.gender), surname: def.surname || '', gender: def.gender || 'f', age, ageDays: def.ageDays || 0,
    look: def.look || randomLook(def.gender), traits: def.traits || [],
    needs, mood: 70, x: def.x ?? 5, y: def.y ?? 5, path: [], queue: [], cur: null,
    job: null, school: age === 'nino' ? { grade: 60 } : null, rel: {}, partner: null, married: false,
    parents: def.parents || [], pregnant: null, worries: [], moodlets: [], home: !!def.home,
    location: def.location || (def.home ? 'casa' : 'fuera'), alerted: {}, bubble: null, nextThink: 0,
    neglect: 0, warnings: 0, visitUntil: 0, cribId: null, sleeping: false, perfWarn: 0,
    attraction: def.attraction || [...ALL_GENDERS],
    aspiration: def.aspiration || null, aspDone: 0, points: 0, rewards: [], skills: {}, paintings: 0,
    canCarry: def.canCarry ?? defaultFertility(def.gender || 'f').canCarry,
    canSire: def.canSire ?? defaultFertility(def.gender || 'f').canSire,
  };
  if (!sim.look.body) sim.look.body = sim.gender === 'f' ? 'vestido' : 'recto';
  state.sims[id] = sim;
  return sim;
}

// Tamaño interior de la casa (varía por partida; las antiguas eran de 10×10)
export const houseDims = (state) => ({ w: state?.house?.w || HOUSE, h: state?.house?.h || HOUSE });

// Casa aleatoria: tamaño, suelo, paredes, ventanas y muebles colocados de forma distinta
export function randomHouse() {
  const w = pick([8, 9, 9, 10, 10]), h = pick([8, 9, 9, 10, 10]);
  const wins = [];
  for (let i = 0; i < pick([1, 2, 2]); i++) wins.push({ axis: 'x', pos: 1 + Math.random() * (w - 3) });
  for (let i = 0; i < pick([1, 1, 2]); i++) wins.push({ axis: 'y', pos: 1 + Math.random() * (h - 3) });
  return {
    w, h, seed: Math.floor(Math.random() * 1000),
    floor: pick(FLOOR_STYLES).id,
    wall: { color: pick(WALL_COLORS), pattern: pick(Object.keys(WALL_PATTERNS)) },
    windows: wins.filter((a, i) => !wins.some((b, j) => j < i && b.axis === a.axis && Math.abs(b.pos - a.pos) < 1.7)),
    frame: Math.random() < 0.7,
  };
}
// Coloca los muebles iniciales comprobando que todo queda accesible
function furnish(state) {
  const { w, h } = houseDims(state);
  placeObject(state, 'buzon', 11, 3, 0, true);
  const againstWall = () => {
    const opts = [];
    for (let x = 0; x < w; x++) for (const rot of [0, 1]) opts.push([x, 0, rot]);
    for (let y = 0; y < h; y++) for (const rot of [0, 1]) opts.push([0, y, rot]);
    return opts;
  };
  const anywhere = (pad = 1) => { const o = []; for (let x = pad; x < w - pad; x++) for (let y = pad; y < h - pad; y++) for (const rot of [0, 1]) o.push([x, y, rot]); return o; };
  const garden = () => { const o = []; for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) if ((x >= w || y >= h) && y !== EXIT.y && !(x >= 10 && y >= 2 && y <= 4)) o.push([x, y, 0]); return o; };
  const tryPlace = (type, opts, near = null) => {
    let list = opts.sort(() => Math.random() - 0.5);
    if (near) list = list.sort((a, b) => (Math.abs(a[0] - near.x) + Math.abs(a[1] - near.y)) - (Math.abs(b[0] - near.x) + Math.abs(b[1] - near.y)));
    for (const [x, y, rot] of list) {
      if (!canPlace(state, type, x, y, rot)) continue;
      const o = placeObject(state, type, x, y, rot, true);
      if (allReachable(state)) return o;
      state.objects.pop();
    }
    return null;
  };
  const fridge = tryPlace('nevera', againstWall());
  tryPlace('cocina', againstWall(), fridge);
  if (Math.random() < 0.75) tryPlace('mesa', anywhere(), fridge);
  const shower = tryPlace('ducha', againstWall());
  tryPlace('vater', againstWall(), shower);
  tryPlace('cama', againstWall());
  const sofa = tryPlace('sofa', anywhere());
  tryPlace('tele', anywhere(), sofa);
  tryPlace('telefono', againstWall());
  for (const t of ['planta', 'lampara', 'estanteria', 'cuadro']) if (Math.random() < 0.5) tryPlace(t, t === 'estanteria' ? againstWall() : anywhere(t === 'cuadro' ? 1 : 0));
  for (let i = 0, n = pick([1, 2, 3]); i < n; i++) tryPlace(pick(['arbol', 'arbol', 'planta']), garden());
  // cada casa nueva tiene su propio estilo de muebles (a veces mezclado)
  const ks = Object.keys(FURN_STYLES), hs = pick(ks), alt = pick(ks);
  for (const o of state.objects) { const d = OBJECTS[o.type]; const sty = Math.random() < 0.8 ? hs : alt; if (sty !== 'moderno') o.style = sty; if (d.tint && Math.random() < 0.45) o.tint = pick(TINTS); }
}
function allReachable(state) {
  const { dist, blocked } = bfs(state, EXIT.x, EXIT.y);
  for (const o of state.objects) {
    if (OBJECTS[o.type].walkable) continue;
    const ok = objTiles(o).some((t) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const nx = t.x + dx, ny = t.y + dy;
      return nx >= 0 && ny >= 0 && nx < GRID && ny < GRID && !blocked[ny * GRID + nx] && dist[ny * GRID + nx] >= 0;
    }));
    if (!ok) return false;
  }
  return true;
}

export function newGame(familyDefs, surname) {
  const state = {
    v: SAVE_VERSION, nextId: 1, time: 8 * 60, speed: 1, money: 4000, lastSaved: Date.now(), powerOff: false,
    bills: [], household: [], active: null, sims: {}, objects: [], lastHour: 8, lastDay: 0,
    settings: { autonomy: 'total', aging: true, autoV2: true }, surname: surname || 'Familia',
  };
  state.house = randomHouse();
  ensureWalls(state);
  furnish(state);
  familyDefs.forEach((d, i) => {
    const t = randomFreeTile(state);
    const s = makeSim(state, { ...d, home: true, x: t.x, y: t.y, surname });
    state.household.push(s.id);
  });
  // parentesco: adultos de la familia inicial son pareja si hay dos y se marca así
  state.active = state.household[0];
  const adults = state.household.map((id) => state.sims[id]).filter(isAdult);
  const kids = state.household.map((id) => state.sims[id]).filter((s) => !isAdult(s));
  kids.forEach((k) => (k.parents = adults.slice(0, 2).map((a) => a.id)));
  state.household.forEach((a) => state.household.forEach((b) => {
    if (a !== b) setRel(state, state.sims[a], state.sims[b], 45, 0, true);
  }));
  familyDefs.forEach((d, i) => {
    if (d.partnerIdx != null && familyDefs[d.partnerIdx]) {
      const a = state.sims[state.household[i]], b = state.sims[state.household[d.partnerIdx]];
      a.partner = b.id; b.partner = a.id; a.married = b.married = true;
      setRel(state, a, b, 70, 75, true);
    }
  });
  // vecinos
  for (let i = 0; i < 5; i++) {
    const g = i === 4 ? 'x' : i % 2 ? 'f' : 'm';
    const used = new Set(Object.values(state.sims).map((q) => q.name)); let nm = randomName(g); for (let k = 0; k < 20 && used.has(nm); k++) nm = randomName(g);
    const n = makeSim(state, { name: nm, gender: g, traits: pickTraits(), home: false, location: 'fuera', attraction: randomAttraction(g) });
    if (Math.random() < 0.7) n.job = { id: pick(Object.keys(CAREERS)), level: Math.floor(rnd(0, 3)), perf: 50 };
  }
  for (const s of householdSims(state)) {
    for (const n of neighbors(state)) setRel(state, s, n, Math.floor(rnd(-5, 15)), 0, true);
  }
  return state;
}

function randomAttraction(g) {
  const r = Math.random();
  if (r < 0.45) return [...ALL_GENDERS];
  if (r < 0.7) return g === 'x' ? ['f', 'm', 'x'] : [g === 'f' ? 'm' : 'f'];
  if (r < 0.9) return g === 'x' ? ['x', 'f'] : [g];
  return g === 'm' ? ['m', 'x'] : ['f', 'x'];
}
export const attractedTo = (a, b) => (a.attraction || ALL_GENDERS).includes(b.gender);

function pickTraits() {
  const keys = Object.keys(TRAITS);
  const a = pick(keys); let b = pick(keys);
  while (b === a) b = pick(keys);
  return [a, b];
}

export const householdSims = (st) => st.household.map((id) => st.sims[id]).filter(Boolean);
export const neighbors = (st) => Object.values(st.sims).filter((s) => !s.home);
export const visibleSims = (st) => Object.values(st.sims).filter((s) => s.location === 'casa');

// ---------- relaciones ----------
export function getRel(a, b) { return a.rel[b.id] || { a: 0, r: 0 }; }
export function setRel(state, a, b, da, dr, absolute = false) {
  for (const [x, y] of [[a, b], [b, a]]) {
    const r = x.rel[y.id] || { a: 0, r: 0 };
    if (absolute) { r.a = da; r.r = dr; } else { r.a = clamp(r.a + da, -100, 100); r.r = clamp(r.r + dr, 0, 100); }
    x.rel[y.id] = r;
  }
}
export function relLabel(state, a, b) {
  const r = getRel(a, b);
  if (a.partner === b.id) return a.married ? 'Cónyuge' : 'Pareja';
  if (a.parents.includes(b.id)) return gx(b, 'Padre', 'Madre', 'Mapadre');
  if (b.parents.includes(a.id)) return gx(b, 'Hijo', 'Hija', 'Hije');
  if (a.parents.length && a.parents.some((p) => b.parents.includes(p))) return gx(b, 'Hermano', 'Hermana', 'Hermane');
  if (r.r >= 30) return 'Atracción';
  if (r.a >= 75) return 'Mejor amistad';
  if (r.a >= 40) return 'Amistad';
  if (r.a <= -40) return 'Enemistad';
  if (r.a <= -15) return 'Mala relación';
  return 'Conocido/a';
}
function related(a, b) {
  return a.parents.includes(b.id) || b.parents.includes(a.id) || (a.parents.length && a.parents.some((p) => b.parents.includes(p)));
}

// ---------- objetos y casillas ----------
export function footprint(type, rot) {
  const d = OBJECTS[type];
  return rot % 2 === 0 ? { w: d.w, h: d.h } : { w: d.h, h: d.w };
}
export function objTiles(o) {
  const { w, h } = footprint(o.type, o.rot); const t = [];
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) t.push({ x: o.x + i, y: o.y + j });
  return t;
}
function blockedMap(state, ignoreId = null) {
  const m = new Uint8Array(GRID * GRID);
  for (const o of state.objects) {
    if (o.id === ignoreId || OBJECTS[o.type].walkable) continue;
    for (const t of objTiles(o)) m[t.y * GRID + t.x] = 1;
  }
  return m;
}
export function objectAt(state, x, y) {
  // prioriza objetos no pisables
  let found = null;
  for (const o of state.objects) {
    if (objTiles(o).some((t) => t.x === x && t.y === y)) {
      if (!OBJECTS[o.type].walkable) return o;
      found = o;
    }
  }
  return found;
}
export function canPlace(state, type, x, y, rot, ignoreId = null) {
  const { w, h } = footprint(type, rot);
  const walk = OBJECTS[type].walkable;
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) {
    const tx = x + i, ty = y + j;
    if (tx < 0 || ty < 0 || tx >= GRID || ty >= GRID) return false;
    if (tx === EXIT.x && ty === EXIT.y) return false;
    for (const o of state.objects) {
      if (o.id === ignoreId) continue;
      if (!!OBJECTS[o.type].walkable !== !!walk) continue; // las alfombras pueden ir debajo de cosas
      if (objTiles(o).some((t) => t.x === tx && t.y === ty)) return false;
    }
    if (!walk) for (const s of visibleSims(state)) if (Math.round(s.x) === tx && Math.round(s.y) === ty) return false;
    const ws = wallSet(state);
    if (i + 1 < w && edgeBlocked(ws, tx, ty, tx + 1, ty)) return false;
    if (j + 1 < h && edgeBlocked(ws, tx, ty, tx, ty + 1)) return false;
  }
  return true;
}
export function placeObject(state, type, x, y, rot, free = false, style = null) {
  const o = { id: 'o' + state.nextId++, type, x, y, rot, users: [] }; if (style && style !== 'moderno') o.style = style;
  state.objects.push(o);
  if (!free) state.money -= OBJECTS[type].price;
  return o;
}
export function moveObject(state, o, x, y, rot) {
  freeObjectUsers(state, o);
  o.x = x; o.y = y; o.rot = rot;
}
export function restyleObject(state, o) {
  const ks = Object.keys(FURN_STYLES); const n = ks[(ks.indexOf(o.style || 'moderno') + 1) % ks.length];
  if (n === 'moderno') delete o.style; else o.style = n; return n;
}
export function recolorObject(state, o) {
  const d = OBJECTS[o.type]; if (!d.tint) return;
  o.tint = TINTS[(TINTS.indexOf(o.tint) + 1) % TINTS.length];
}
export function setHouseStyle(state, patch, cost) {
  if (state.money < cost) { toast('No hay dinero suficiente', 'warn'); return false; }
  state.house = { ...(state.house || { w: HOUSE, h: HOUSE, wall: { color: '#f3e7d6', pattern: 'rayas' }, floor: 'roble' }) };
  if (patch.floor) state.house.floor = patch.floor;
  if (patch.wall) state.house.wall = { ...state.house.wall, ...patch.wall };
  state.money -= cost; return true;
}
export function sellObject(state, o) {
  freeObjectUsers(state, o);
  state.objects = state.objects.filter((p) => p !== o);
  state.money += Math.round(OBJECTS[o.type].price * 0.7);
}
function freeObjectUsers(state, o) {
  for (const id of [...o.users]) { const s = state.sims[id]; if (s) interrupt(state, s); }
  for (const s of Object.values(state.sims)) if (s.cribId === o.id) s.cribId = null;
  o.users = [];
}
export const objById = (state, id) => state.objects.find((o) => o.id === id);
export function decorScore(state) {
  return state.objects.reduce((sum, o) => sum + (o.x < HOUSE + 2 ? OBJECTS[o.type].decor : 0), 0) + (state.walls || []).filter((q) => q.window).length;
}

// ---------- paredes ----------
// Una pared ocupa un borde entre casillas. 'h': borde horizontal en la línea y (entre (x,y-1) y (x,y)).
// 'v': borde vertical en la línea x (entre (x-1,y) y (x,y)). Con door: true se puede pasar.
export const WALL_PRICE = 60, DOOR_PRICE = 150;
const wkey = (d, x, y) => `${d}:${x}:${y}`;
export function ensureWalls(state) {
  if (state.walls) return;
  const { w, h } = houseDims(state);
  state.walls = [];
  for (let x = 0; x < w; x++) state.walls.push({ d: 'h', x, y: h });
  for (let y = 0; y < h; y++) state.walls.push({ d: 'v', x: w, y });
  // puerta principal hacia la salida
  const front = EXIT.y < h ? state.walls.find((q) => q.d === 'v' && q.y === EXIT.y) : state.walls.find((q) => q.d === 'h' && q.x === w - 1);
  if (front) front.door = true;
}
function wallSet(state) {
  if (state._wallCache && state._wallCache.src === state.walls) return state._wallCache.set;
  const set = new Set();
  for (const q of state.walls || []) if (!q.door) set.add(wkey(q.d, q.x, q.y));
  Object.defineProperty(state, '_wallCache', { value: { src: state.walls, set }, enumerable: false, configurable: true, writable: true });
  return set;
}
function touchWalls(state) { state.walls = [...(state.walls || [])]; }
// ¿Hay pared entre dos casillas vecinas (ortogonales)?
function edgeBlocked(ws, ax, ay, bx, by) {
  if (bx === ax + 1) return ws.has(wkey('v', bx, ay));
  if (bx === ax - 1) return ws.has(wkey('v', ax, ay));
  if (by === ay + 1) return ws.has(wkey('h', ax, by));
  if (by === ay - 1) return ws.has(wkey('h', ax, ay));
  return false;
}
function stepBlocked(ws, cx, cy, nx, ny) {
  if (cx === nx || cy === ny) return edgeBlocked(ws, cx, cy, nx, ny);
  // en diagonal no se cuela por las esquinas de las paredes
  return edgeBlocked(ws, cx, cy, nx, cy) || edgeBlocked(ws, nx, cy, nx, ny) || edgeBlocked(ws, cx, cy, cx, ny) || edgeBlocked(ws, cx, ny, nx, ny);
}
export function wallAt(state, d, x, y) { return (state.walls || []).find((q) => q.d === d && q.x === x && q.y === y); }
export function addWalls(state, segs) {
  ensureWalls(state); let n = 0;
  for (const g of segs) {
    if (g.x < 0 || g.y < 0 || g.x > GRID || g.y > GRID) continue;
    if (g.d === 'h' && (g.x >= GRID || g.y === 0 || g.y === GRID)) continue;
    if (g.d === 'v' && (g.y >= GRID || g.x === 0 || g.x === GRID)) continue;
    if (wallAt(state, g.d, g.x, g.y)) continue;
    if (state.money < WALL_PRICE) { toast('No hay dinero suficiente', 'warn'); break; }
    // no partir un mueble de varias casillas
    if (state.objects.some((o) => { const t = objTiles(o); return t.some((a) => t.some((b) => g.d === 'v' ? (b.x === a.x + 1 && b.y === a.y && b.x === g.x && a.y === g.y) : (b.y === a.y + 1 && b.x === a.x && b.y === g.y && a.x === g.x))); })) continue;
    state.walls.push({ d: g.d, x: g.x, y: g.y }); state.money -= WALL_PRICE; n++;
  }
  touchWalls(state); return n;
}
export function toggleDoor(state, q) {
  if (!q.door && state.money < DOOR_PRICE) { toast('No hay dinero suficiente', 'warn'); return false; }
  q.door = !q.door; state.money += q.door ? -DOOR_PRICE : Math.round(DOOR_PRICE * 0.5); touchWalls(state); return true;
}
export function removeWall(state, q) {
  state.walls = state.walls.filter((w) => w !== q); state.money += Math.round(WALL_PRICE * 0.5) + (q.door ? Math.round(DOOR_PRICE * 0.5) : 0);
}
// Borde más cercano a un punto del suelo (coordenadas de casilla con decimales)
export function nearestEdge(px, py) {
  const hy = Math.round(py), vx = Math.round(px);
  const dh = Math.abs(py - hy), dv = Math.abs(px - vx);
  return dh < dv ? { d: 'h', x: Math.floor(px), y: hy, dist: dh } : { d: 'v', x: vx, y: Math.floor(py), dist: dv };
}

// ---------- caminos ----------
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
function bfs(state, sx, sy) {
  const blocked = blockedMap(state); const ws = wallSet(state);
  const dist = new Int16Array(GRID * GRID).fill(-1);
  const prev = new Int16Array(GRID * GRID).fill(-1);
  const start = sy * GRID + sx;
  if (sx < 0 || sy < 0 || sx >= GRID || sy >= GRID) return { dist, prev, blocked };
  dist[start] = 0;
  const q = [start];
  while (q.length) {
    const c = q.shift(); const cx = c % GRID, cy = (c / GRID) | 0;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const n = ny * GRID + nx;
      if (blocked[n] || dist[n] >= 0) continue;
      if (dx && dy && (blocked[cy * GRID + nx] || blocked[ny * GRID + cx])) continue;
      if (stepBlocked(ws, cx, cy, nx, ny)) continue;
      dist[n] = dist[c] + 1; prev[n] = c; q.push(n);
    }
  }
  return { dist, prev, blocked, ws };
}
function buildPath(prev, sx, sy, tx, ty) {
  const path = []; let c = ty * GRID + tx; const s = sy * GRID + sx;
  while (c !== s && c >= 0) { path.unshift({ x: c % GRID, y: (c / GRID) | 0 }); c = prev[c]; }
  return path;
}
// Busca la casilla libre más cercana adyacente a un conjunto de casillas
function nearestSpot(state, sim, tiles, diag = false) {
  const sx = Math.round(sim.x), sy = Math.round(sim.y);
  const { dist, prev, blocked, ws } = bfs(state, sx, sy);
  let best = null, bd = 1e9;
  const dirs = diag ? DIRS : DIRS.slice(0, 4);
  for (const t of tiles) for (const [dx, dy] of dirs) {
    const nx = t.x + dx, ny = t.y + dy;
    if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
    const n = ny * GRID + nx;
    if (blocked[n] || dist[n] < 0) continue;
    if (stepBlocked(ws, t.x, t.y, nx, ny)) continue; // no usar un mueble a través de una pared
    if (tiles.some((q) => q.x === nx && q.y === ny)) continue;
    const taken = visibleSims(state).some((o) => o !== sim && o.cur?.spot && o.cur.spot.x === nx && o.cur.spot.y === ny);
    const d = dist[n] + (taken ? 6 : 0);
    if (d < bd) { bd = d; best = { x: nx, y: ny }; }
  }
  if (!best) return null;
  return { spot: best, path: buildPath(prev, sx, sy, best.x, best.y) };
}
function pathTo(state, sim, x, y) {
  const sx = Math.round(sim.x), sy = Math.round(sim.y);
  const { dist, prev } = bfs(state, sx, sy);
  if (dist[y * GRID + x] < 0) return null;
  return buildPath(prev, sx, sy, x, y);
}
function randomFreeTile(state, inside = true) {
  const blocked = blockedMap(state);
  for (let i = 0; i < 60; i++) {
    const { w, h } = houseDims(state);
    const x = Math.floor(rnd(0, inside ? w : GRID)), y = Math.floor(rnd(0, inside ? h : GRID));
    if (!blocked[y * GRID + x]) return { x, y };
  }
  return { x: 5, y: 5 };
}

// ---------- humor ----------
export function computeMood(state, s) {
  const list = s.age === 'bebe' ? BABY_NEEDS : NEEDS;
  let m = list.reduce((a, n) => a + s.needs[n], 0) / list.length;
  const lowest = Math.min(...list.map((n) => s.needs[n]));
  if (lowest < 20) m -= (20 - lowest) * 0.8;
  for (const t of s.traits) m += TRAITS[t]?.mood || 0;
  for (const r of s.rewards || []) m += REWARDS[r]?.mood || 0;
  for (const ml of s.moodlets) m += MOODLETS[ml.id]?.mood || 0;
  for (const w of s.worries) m += WORRIES[w]?.mood || 0;
  for (const d of derivedMoodlets(state, s)) m += d.mood;
  return clamp(m);
}
export function derivedMoodlets(state, s) {
  const out = [];
  if (!s.home) return out;
  const decor = decorScore(state);
  if (decor >= 18) out.push({ label: 'Casa bonita', mood: 6 });
  if (state.powerOff) out.push({ label: 'Sin luz', mood: -8 });
  if (s.age !== 'bebe' && s.needs.higiene < 15) out.push({ label: 'Huele mal', mood: -8 });
  if (s.age !== 'bebe' && householdSims(state).some((b) => b.age === 'bebe' && b.crying)) out.push({ label: 'Bebé llorando', mood: -8 });
  if (s.age !== 'bebe' && (state.pets || []).some((p) => Math.min(...Object.values(p.needs)) < 20)) out.push({ label: 'La mascota está triste', mood: -6 });
  return out;
}
function addMoodlet(s, id) {
  const def = MOODLETS[id]; if (!def) return;
  if (s.home) { s.dayLog ||= []; if (!s.dayLog.includes(id)) s.dayLog.push(id); }
  s.moodlets = s.moodlets.filter((m) => m.id !== id);
  s.moodlets.push({ id, until: def.dur + (globalThis.__simTime || 0) });
}
function addWorry(state, s, id) {
  if (s.worries.includes(id)) return;
  if (!WORRIES[id].ages.includes(s.age)) return;
  s.worries.push(id);
  if (s.home) toast(`${s.name}: ${WORRIES[id].label.toLowerCase()}. ${WORRIES[id].hint}.`, 'worry', s.id);
}
export function resolveWorry(state, s, id) {
  if (!s.worries.includes(id)) return;
  s.worries = s.worries.filter((w) => w !== id);
  if (s.home) toast(`${s.name} ya no tiene: ${WORRIES[id].label.toLowerCase()} 😌`, 'good', s.id);
}

// ---------- acciones disponibles ----------
export function objectActions(state, sim, o) {
  const def = OBJECTS[o.type];
  const out = [];
  for (const id of def.acts) {
    const a = ACTIONS[id];
    if (!a.ages.includes(sim.age)) continue;
    let disabled = null;
    if ((def.power) && state.powerOff) disabled = 'Sin luz: paga las facturas';
    else if (a.cost && state.money < a.cost) disabled = 'No hay dinero';
    else if (id === 'pagar' && !state.bills.length) disabled = 'No hay facturas';
    else if (id === 'deberes' && !sim.worries.includes('deberes')) disabled = 'No tiene deberes';
    else if (id === 'adoptar' && householdSims(state).length + pendingBabies(state) >= MAX_HOUSEHOLD) disabled = 'La familia está completa';
    else if ((o.users.length >= (def.cap || 1)) && !o.users.includes(sim.id) && !def.acts.includes('pagar')) disabled = 'En uso';
    out.push({ id, label: a.label, icon: a.ic, disabled });
  }
  return out;
}
function pendingBabies(state) { return householdSims(state).filter((s) => s.pregnant).length; }

export function socialActions(state, actor, target) {
  const out = [];
  if (actor === target || actor.age === 'bebe') return out;
  for (const [id, d] of Object.entries(SOCIALS)) {
    const r = socialReq(state, actor, target, id, d);
    if (r === false) continue;
    out.push({ id, label: d.label, icon: d.ic, disabled: r === true ? null : r });
  }
  return out;
}
function socialReq(state, actor, target, id, d) {
  const rel = getRel(actor, target);
  if (target.age === 'bebe') {
    if (!d.care) return false;
    if (id !== 'acunar' && !isAdult(actor)) return false;
    return true;
  }
  if (d.care) return false;
  if (id === 'consolar') return isAdult(actor) && target.worries.includes('miedo') ? true : false;
  if (id === 'jugarnino') return (actor.age === 'nino' || target.age === 'nino') ? true : false;
  if (id === 'despedir') return !target.home ? true : false;
  if (id === 'mudarse') {
    if (target.home || !isAdult(target) || !isAdult(actor)) return false;
    if (householdSims(state).length + pendingBabies(state) >= MAX_HOUSEHOLD) return 'La familia está completa';
    if (rel.a < 50 && actor.partner !== target.id) return 'Necesitáis más amistad (50)';
    return true;
  }
  if (d.romantic) {
    if (!isAdult(actor) || !isAdult(target) || related(actor, target)) return false;
    if (id === 'pedirsalir' && actor.partner === target.id) return false;
    if (id === 'casarse' && (actor.partner !== target.id || actor.married)) return false;
    if (d.minR && rel.r < d.minR && !(d.bed && actor.partner === target.id)) return `Necesitáis más romance (${d.minR})`;
    if (d.bed && !state.objects.some((o) => OBJECTS[o.type].cap === 2 && OBJECTS[o.type].acts.includes('dormir'))) return 'Necesitáis una cama doble';
    if (id === 'bebe') {
      if (!target.home || !actor.home) return 'Tenéis que vivir juntos';
      if (actor.partner !== target.id) return 'Tenéis que ser pareja';
      if (actor.pregnant || target.pregnant) return 'Ya hay un bebé en camino';
      if (!conceptionPair(actor, target)) return 'Podéis adoptar desde el teléfono';
      if (householdSims(state).length + pendingBabies(state) >= MAX_HOUSEHOLD) return 'La familia está completa';
    }
    return true;
  }
  if (id === 'romper') return actor.partner === target.id ? true : false;
  if (d.minA && rel.a < d.minA) return `Necesitáis más amistad (${d.minA})`;
  return true;
}

// ---------- cola de acciones ----------
export function queueObject(state, sim, actId, objId) {
  const a = ACTIONS[actId];
  if (sim.queue.length >= 6) return toast('La cola de acciones está llena');
  sim.queue.push({ kind: 'obj', act: actId, objId, icon: a.ic, label: a.label });
}
export function queueSocial(state, sim, socId, targetId) {
  const d = SOCIALS[socId];
  if (sim.queue.length >= 6) return toast('La cola de acciones está llena');
  sim.queue.push({ kind: 'soc', act: socId, targetId, icon: d.ic, label: d.label + ' con ' + state.sims[targetId].name });
}
export function queueGo(state, sim, x, y) {
  sim.queue.push({ kind: 'go', x, y, icon: 'pin', label: 'Ir allí' });
}
export function cancelItem(state, sim, idx) {
  if (idx === -1) interrupt(state, sim);
  else sim.queue.splice(idx, 1);
}

function interrupt(state, s) {
  const c = s.cur; if (!c) return;
  s.cur = null; s.path = []; s.sleeping = false;
  if (c.objId) {
    const o = objById(state, c.objId);
    if (o) o.users = o.users.filter((u) => u !== s.id);
    if (c.onObj && c.spot) { s.x = c.spot.x; s.y = c.spot.y; }
  }
  if (c.bedId) {
    const o = objById(state, c.bedId);
    if (o) o.users = o.users.filter((u) => u !== s.id);
    if (c.spot) { s.x = c.spot.x; s.y = c.spot.y; }
  }
  if (c.kind === 'soc') {
    const t = state.sims[c.targetId];
    if (t && t.cur?.kind === 'partner' && t.cur.leaderId === s.id) interrupt(state, t);
  }
  if (c.kind === 'partner') {
    const l = state.sims[c.leaderId];
    if (l && l.cur?.kind === 'soc' && l.cur.targetId === s.id) interrupt(state, l);
  }
  s.x = Math.round(s.x); s.y = Math.round(s.y);
}

function busyReason(state, t) {
  if (t.location !== 'casa') return 'no está en casa';
  if (t.cur?.kind === 'ko') return 'no puede ahora';
  if (t.cur?.kind === 'partner' || (t.cur?.kind === 'soc' && t.cur.phase === 'do')) return 'está ocupado/a';
  if (t.sleeping && t.age !== 'bebe') return 'está durmiendo';
  if (t.cur?.kind === 'leave') return 'se está yendo';
  return null;
}

function startNext(state, s) {
  const item = s.queue.shift(); if (!item) return;
  if (item.kind === 'pet') return startPet(state, s, item);
  if (item.kind === 'go') {
    const p = pathTo(state, s, item.x, item.y);
    if (!p) return toast(`${s.name} no puede llegar ahí`, 'warn', s.id);
    s.cur = { kind: 'go', icon: item.icon, label: item.label }; s.path = p; return;
  }
  if (item.kind === 'obj') {
    const o = objById(state, item.objId); const a = ACTIONS[item.act]; const def = o && OBJECTS[o.type];
    if (!o) return;
    const avail = objectActions(state, s, o).find((x) => x.id === item.act);
    if (!avail || avail.disabled) { if (s.home) toast(`${s.name}: ${avail ? avail.disabled : 'no puede'}`, 'warn', s.id); return; }
    const r = nearestSpot(state, s, objTiles(o));
    if (!r) { if (s.home) toast(`${s.name} no puede llegar a ${def.name}`, 'warn', s.id); return; }
    o.users.push(s.id);
    s.cur = { kind: 'obj', act: item.act, objId: o.id, phase: 'walk', t: 0, spot: r.spot, onObj: !!def.onObj, icon: a.ic, label: a.label };
    s.path = r.path;
    return;
  }
  if (item.kind === 'soc') {
    const t = state.sims[item.targetId]; const d = SOCIALS[item.act];
    if (!t) return;
    const busy = busyReason(state, t);
    if (busy) { if (s.home) toast(`${t.name} ${busy}`, 'warn', s.id); return; }
    const req = socialReq(state, s, t, item.act, d);
    if (req !== true) { if (s.home && req) toast(req, 'warn', s.id); return; }
    let bed = null, r;
    if (d.bed) {
      bed = state.objects.find((o) => OBJECTS[o.type].cap === 2 && OBJECTS[o.type].acts.includes('dormir') && o.users.length === 0);
      if (!bed) { toast('La cama doble está ocupada', 'warn', s.id); return; }
      r = nearestSpot(state, s, objTiles(bed));
    } else {
      r = nearestSpot(state, s, [{ x: Math.round(t.x), y: Math.round(t.y) }], true);
    }
    if (!r) { toast(`${s.name} no puede llegar hasta ${t.name}`, 'warn', s.id); return; }
    interrupt(state, t);
    if (t.age !== 'bebe') t.queue = t.home ? t.queue : [];
    s.cur = { kind: 'soc', act: item.act, targetId: t.id, phase: 'walk', t: 0, spot: r.spot, icon: d.ic, label: item.label, bedId: bed?.id };
    s.path = r.path;
    t.cur = { kind: 'partner', leaderId: s.id, phase: 'wait', icon: d.ic, label: d.label + ' con ' + s.name };
    if (bed) {
      bed.users.push(s.id, t.id);
      const r2 = nearestSpot(state, t, objTiles(bed));
      t.path = r2 ? r2.path : []; t.cur.spot = r2 ? r2.spot : { x: Math.round(t.x), y: Math.round(t.y) }; t.cur.bedId = bed.id;
    }
  }
}

// ---------- bucle principal ----------
export function tick(state, dt) {
  if (dt <= 0) return;
  state.time += dt;
  globalThis.__simTime = state.time;
  const hour = Math.floor(state.time / 60);
  while (state.lastHour < hour) { state.lastHour++; hourly(state, false); }
  processPendingVisits(state);
  for (const s of Object.values(state.sims)) {
    if (s.location === 'trabajo' || s.location === 'escuela') { atWork(state, s, dt); schedule(state, s); continue; }
    if (s.location === 'salida') { outingTick(state, s, dt); continue; }
    if (s.location !== 'casa') continue;
    updateNeeds(state, s, dt);
    if (s.home) schedule(state, s);
    if (s.location !== 'casa') continue;
    s.mood = computeMood(state, s);
    if (s.age === 'bebe') { babyUpdate(state, s, dt); continue; }
    failures(state, s);
    if (!s.cur && s.queue.length) startNext(state, s);
    if (!s.cur) autonomy(state, s);
    if (s.cur) runCur(state, s, dt);
    updateBubble(state, s);
  }
  for (const p of state.pets || []) petTick(state, p, dt);
}

// ---------- dónde está cada cual ----------
const hhmm = (t) => `${String(Math.floor(hourOf(t))).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export function whereIs(state, s) {
  if (s.location === 'casa') return s.home ? 'en casa' : 'de visita en tu casa';
  if (s.location === 'trabajo') return `trabajando (vuelve a las ${CAREERS[s.job?.id]?.end ?? '?'}:00)`;
  if (s.location === 'escuela') return `en el cole (vuelve a las ${SCHOOL.end}:00)`;
  if (s.location === 'salida' && s.outing) {
    const back = `vuelve a las ${hhmm(s.outing.until)}`;
    if (s.outing.dest === 'paseo') return `de paseo con la mascota (${back})`;
    if (s.outing.dest === 'visita') return `en casa de ${state.sims[s.outing.host]?.name || 'un vecino'} (${back})`;
    return `en el ${OUTINGS[s.outing.dest]?.label.toLowerCase() || 'barrio'} (${back})`;
  }
  // vecinos en su vida diaria
  if (!s.home) { const c = s.job && CAREERS[s.job.id]; const h = hourOf(state.time); if (c && dowOf(state.time) <= 4 && h >= c.start && h < c.end) return 'trabajando'; return h >= 23 || h < 7 ? 'durmiendo en su casa' : 'en su casa'; }
  return 'fuera de casa';
}

// ---------- periódico del barrio: los vecinos viven aunque no los veas ----------
export function addNews(state, text) { state.news ||= []; state.news.unshift({ t: state.time, text }); if (state.news.length > 30) state.news.length = 30; }
function neighborhoodLife(state) {
  if (Math.random() > 0.035) return;
  const ns = neighbors(state).filter((n) => n.location !== 'casa'); if (!ns.length) return;
  const n = pick(ns); const r = Math.random();
  if (r < 0.25) {
    const m = ns.find((q) => q !== n && !q.partner && !n.partner && isAdult(q) && isAdult(n) && attractedTo(n, q) && attractedTo(q, n));
    if (m) { n.partner = m.id; m.partner = n.id; setRel(state, n, m, 60, 70, true); return addNews(state, `💞 ${n.name} y ${m.name} han empezado a salir. ¡Todo el barrio lo comenta!`); }
  }
  if (r < 0.4 && n.partner && !n.married && state.sims[n.partner]) { n.married = state.sims[n.partner].married = true; return addNews(state, `💍 ¡${n.name} y ${state.sims[n.partner].name} se casan este fin de semana!`); }
  if (r < 0.55 && n.job) { n.job.level = Math.min(4, n.job.level + 1); return addNews(state, `🎉 ${n.name} ha ascendido a ${CAREERS[n.job.id].levels[n.job.level]}.`); }
  if (r < 0.65 && !n.job) { n.job = { id: pick(Object.keys(CAREERS)), level: 0, perf: 50 }; return addNews(state, `💼 ${n.name} ha encontrado trabajo en ${CAREERS[n.job.id].label}.`); }
  if (r < 0.75) return addNews(state, pick([`🌻 ${n.name} ha plantado un huerto en su jardín.`, `🐶 ${n.name} pasea un perro nuevo por el barrio.`, `🎨 ${n.name} ha empezado clases de pintura.`, `🏃 ${n.name} ha corrido su primera media maratón.`, `🍰 ${n.name} ganó el concurso de tartas del barrio.`]));
  if (r < 0.85 && n.partner) return addNews(state, `👶 ${n.name} y ${state.sims[n.partner]?.name} esperan un bebé.`);
  const fam = householdSims(state).filter(isAdult); const f = fam.length && pick(fam);
  if (f) { const rel = getRel(f, n).a; return addNews(state, rel > 40 ? `💬 ${n.name} va diciendo que ${f.name} es de lo mejor del barrio.` : rel < -20 ? `🙄 Dicen que ${n.name} no soporta a ${f.name}.` : `👋 ${n.name} pregunta por la familia ${state.surname}.`); }
}

// ---------- salidas ----------
export function canGoOut(state, s) {
  if (s.location !== 'casa' || s.age === 'bebe') return false;
  return !s.cur || !['ko', 'leave', 'partner'].includes(s.cur.kind);
}
export function startOuting(state, group, dest, host = null) {
  const O = OUTINGS[dest]; const cost = O.cost * group.length;
  if (state.money < cost) { toast('No hay dinero suficiente', 'warn'); return false; }
  state.money -= cost;
  for (const s of group) { interrupt(state, s); s.queue = []; s.location = 'salida'; s.outing = { dest, until: state.time + O.dur, with: group.map((g) => g.id), host }; s.bubble = null; }
  const names = group.map((g) => g.name).join(', ');
  toast(dest === 'visita' ? `🏡 ${names} ${group.length > 1 ? 'van' : 'va'} a casa de ${state.sims[host]?.name}` : `🚶 ${names} ${group.length > 1 ? 'se van' : 'se va'} al ${O.label.toLowerCase()}`, 'info', group[0].id);
  return true;
}
function outingTick(state, s, dt) {
  const o = s.outing; if (!o) { s.location = 'casa'; return; }
  const O = OUTINGS[o.dest] || { rate: { diversion: 0.3, social: 0.1 }, skill: ['forma', 0.03] };
  const list = s.age === 'bebe' ? BABY_NEEDS : NEEDS;
  for (const n of list) s.needs[n] = clamp(s.needs[n] - DECAY[n] / 60 * 0.5 * dt + (O.rate[n] || 0) * dt);
  if (O.skill) gainSkill(state, s, O.skill[0], O.skill[1] * dt);
  s.mood = computeMood(state, s); s.moodlets = s.moodlets.filter((m) => m.until > state.time);
  if (state.time < o.until) return;
  // vuelta a casa
  s.location = 'casa'; s.x = EXIT.x; s.y = EXIT.y; s.cur = null; s.path = []; s.outing = null;
  const rain = ['lluvia', 'nieve'].includes(weatherOf(state).type);
  addMoodlet(s, O.outdoor && rain ? 'gris' : (O.moodlet || 'paseo'));
  const others = o.with.map((id) => state.sims[id]).filter((q) => q && q !== s);
  for (const q of others) setRel(state, s, q, 2, s.partner === q.id ? 3 : 0);
  if (o.with[0] === s.id) {
    if (o.dest === 'visita') {
      const hostSim = state.sims[o.host];
      if (hostSim) { for (const id of o.with) { const q = state.sims[id]; if (q) setRel(state, q, hostSim, 10, 0); } if (!hostSim.visited) { hostSim.visited = true; addMemory(state, `Primera visita a casa de ${hostSim.name}`, 'home', o.with); } }
    } else if (o.dest === 'paseo') {
      const pet = (state.pets || []).find((p) => p.id === o.pet); if (pet) { pet.out = 0; pet.x = EXIT.x; pet.y = EXIT.y; pet.needs.diversion = 100; pet.needs.carino = clamp(pet.needs.carino + 30); }
      if (Math.random() < 0.4) { const n = pick(neighbors(state)); if (n) { setRel(state, s, n, 8, 0); toast(`Durante el paseo, ${s.name} ha charlado con ${n.name}`, 'good', s.id); } }
    } else if (others.length >= 2) addMemory(state, `Tarde de ${OUTINGS[o.dest].label.toLowerCase()} en familia`, OUTINGS[o.dest].ic, o.with);
    else if (others.length === 1 && s.partner === others[0].id) addMemory(state, `${s.name} y ${others[0].name} tuvieron una cita en el ${OUTINGS[o.dest].label.toLowerCase()}`, 'heart', o.with);
  }
  const t = randomFreeTile(state); queueGo(state, s, t.x, t.y);
}

// ---------- mascotas ----------
export function adoptPet(state, species, name, color) {
  state.pets ||= [];
  if (state.pets.length >= 2) { toast('Ya tenéis dos mascotas', 'warn'); return null; }
  if (state.money < 200) { toast('No hay dinero suficiente', 'warn'); return null; }
  state.money -= 200;
  const p = { id: 'p' + state.nextId++, species, name: name || pick(PET_NAMES), color: color || pick(PETS[species].colors), x: EXIT.x, y: EXIT.y, path: [], needs: { hambre: 80, carino: 80, diversion: 80 }, nextThink: 0, neglect: 0, out: 0 };
  state.pets.push(p);
  toast(`🐾 ¡${p.name} llega a casa!`, 'good'); addMemory(state, `${p.name} (${PETS[species].label.toLowerCase()}) llegó a la familia`, 'heart');
  return p;
}
export const petById = (state, id) => (state.pets || []).find((p) => p.id === id);
function petTick(state, p, dt) {
  if (p.out && state.time < p.out) return;
  for (const [n, r] of Object.entries(PETS[p.species].decay)) p.needs[n] = clamp(p.needs[n] - r / 60 * dt * (p.sleeping ? 0.4 : 1));
  const h = hourOf(state.time);
  p.sleeping = (h >= 23 || h < 7) && !p.busy;
  if (p.busy && state.time > p.busy) p.busy = 0;
  if (Object.values(p.needs).some((v) => v <= 0)) {
    p.neglect += dt;
    if (p.neglect > 1440) {
      state.pets = state.pets.filter((q) => q !== p);
      toast(`💔 ${p.name} se ha escapado de casa porque nadie le cuidaba`, 'bad'); addMemory(state, `${p.name} se escapó de casa`, 'heartbreak');
      return;
    }
  } else p.neglect = 0;
  if (Math.min(...Object.values(p.needs)) < 20 && !p.alert) { p.alert = true; toast(`🐾 ${p.name} necesita atención`, 'warn'); }
  if (Math.min(...Object.values(p.needs)) > 40) p.alert = false;
  if (p.sleeping || p.busy) { p.path = []; return; }
  if (p.path.length) { walk(p, dt * 0.85); return; }
  if (state.time < p.nextThink) return;
  p.nextThink = state.time + 6 + Math.random() * 14;
  const fam = householdSims(state).filter((q) => q.location === 'casa');
  let target;
  if (fam.length && Math.random() < 0.55) { const f = pick(fam); target = { x: Math.round(f.x) + pick([-1, 1, 0]), y: Math.round(f.y) + pick([-1, 1]) }; }
  else target = randomFreeTile(state);
  target.x = Math.max(0, Math.min(GRID - 1, target.x)); target.y = Math.max(0, Math.min(GRID - 1, target.y));
  const path = pathTo(state, p, target.x, target.y); if (path) p.path = path.slice(0, 8);
}
export function petActions(state, s, p) {
  const out = [{ id: 'comer', label: `Dar de comer a ${p.name}`, ic: 'food' }, { id: 'acariciar', label: 'Acariciar', ic: 'heart' }, { id: 'jugar', label: 'Jugar', ic: 'ball' }];
  if (p.species === 'perro' && isAdult(s)) out.push({ id: 'pasear', label: 'Sacar a pasear', ic: 'pin' });
  return out.map((a) => ({ ...a, disabled: p.sleeping ? 'Está durmiendo' : p.out ? 'Está de paseo' : null }));
}
const PET_ACT = { comer: { dur: 6, pet: { hambre: 80, carino: 10 }, cost: 3 }, acariciar: { dur: 10, pet: { carino: 55 }, sim: { social: 15 } }, jugar: { dur: 20, pet: { diversion: 60, carino: 30 }, sim: { diversion: 25 } }, pasear: { dur: 2 } };
export function queuePet(state, s, act, petId) {
  if (s.queue.length >= 6) return;
  s.queue.push({ kind: 'pet', act, petId, icon: PET_ACT[act] ? { comer: 'food', acariciar: 'heart', jugar: 'ball', pasear: 'pin' }[act] : 'heart', label: `${{ comer: 'Dar de comer', acariciar: 'Acariciar', jugar: 'Jugar', pasear: 'Pasear' }[act]} a ${petById(state, petId)?.name || ''}` });
}
function startPet(state, s, item) {
  const p = petById(state, item.petId); if (!p || p.out) return;
  const r = nearestSpot(state, s, [{ x: Math.round(p.x), y: Math.round(p.y) }], true);
  if (!r) { toast(`${s.name} no llega hasta ${p.name}`, 'warn', s.id); return; }
  p.busy = state.time + 60; p.path = [];
  s.cur = { kind: 'pet', act: item.act, petId: p.id, phase: 'walk', t: 0, spot: r.spot, icon: item.icon, label: item.label }; s.path = r.path;
}
function runPet(state, s, c, dt) {
  const p = petById(state, c.petId); const A = PET_ACT[c.act];
  if (!p) { s.cur = null; return; }
  if (c.phase === 'walk') { c.phase = 'do'; if (A.cost) state.money -= A.cost; }
  c.t += dt;
  if (c.t < A.dur) return;
  if (c.act === 'pasear') {
    s.cur = null; p.busy = 0;
    s.location = 'salida'; s.outing = { dest: 'paseo', until: state.time + 45, with: [s.id], pet: p.id }; p.out = state.time + 45;
    toast(`🐕 ${s.name} sale a pasear con ${p.name}`, 'info', s.id); return;
  }
  for (const [n, v] of Object.entries(A.pet || {})) p.needs[n] = clamp(p.needs[n] + v);
  for (const [n, v] of Object.entries(A.sim || {})) if (n in s.needs) s.needs[n] = clamp(s.needs[n] + v);
  addMoodlet(s, 'mascota'); p.busy = 0; p.bubble = { icon: 'heart', until: state.time + 20 };
  s.cur = null;
}

// ---------- clima y estaciones ----------
export const seasonOf = (state) => SEASONS[Math.floor(dayOf(state.time) / 7) % 4];
export function weatherOf(state) { return state.weather || { type: 'sol' }; }
function updateWeather(state) {
  if (state.weather && state.time < state.weather.until) return;
  const w = seasonOf(state).w; const total = Object.values(w).reduce((a, b) => a + b, 0);
  let r = Math.random() * total, type = 'sol';
  for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) { type = k; break; } }
  const prev = state.weather?.type;
  state.weather = { type, until: state.time + rnd(240, 600) };
  if (prev && prev !== type && (type === 'lluvia' || type === 'nieve')) toast(type === 'nieve' ? '❄️ Ha empezado a nevar' : '🌧️ Empieza a llover', 'info');
}

// ---------- ventanas ----------
export function toggleWindow(state, q) {
  if (!q.window && state.money < WINDOW_PRICE) { toast('No hay dinero suficiente', 'warn'); return false; }
  q.window = !q.window; if (q.window) q.door = false;
  state.money += q.window ? -WINDOW_PRICE : Math.round(WINDOW_PRICE / 2); touchWalls(state); return true;
}

// ---------- diario íntimo ----------
const DIARY = {
  beso: 'me han dado un beso precioso', intimidad: 'me siento muy enamorado/a', pareja: '¡tengo pareja!', boda: '¡me he casado!', ruptura: 'me han roto el corazón',
  quemada: 'se me ha quemado la comida', gourmet: 'he cocinado como en un restaurante', comida_rica: 'he comido de maravilla', discusion: 'he discutido y me siento fatal',
  rechazo: 'me han dado calabazas', ascenso: '¡me han ascendido!', despedido: 'me han despedido', nacimiento: 'ha llegado un bebé a casa', objetivo: 'he cumplido uno de mis sueños',
  ternura: 'un gatito me ha robado el corazón', premio: '¡nos ha tocado la lotería!', buena_persona: 'he hecho lo correcto', culpa: 'me siento culpable por algo',
  desmayo: 'me he desmayado de hambre, qué vergüenza', humillado: 'he tenido un accidente horrible', suelo: 'me he dormido en el suelo', crecer: 'he cumplido años',
  mascota: 'he pasado un rato con mi mascota', aire_libre: 'he disfrutado del aire libre', en_forma: 'he ido al gimnasio', peli: 'he visto una peli genial',
  paseo: 'he dado un buen paseo', inspirado: 'me siento inspirado/a', frustrado: 'algo me ha salido mal', acogedor: 'ha sido una tarde de lluvia muy a gusto', gris: 'el día gris me ha bajado el ánimo',
  carta: 'he leído una carta que me ha emocionado', fresco: 'me he dado una buena ducha',
};
const WORRY_1P = { facturas: 'me agobian las facturas', soledad: 'me siento solo/a', estres: 'estoy muy estresado/a', quiere_hijo: 'tengo muchas ganas de tener un hijo', ascenso: 'sueño con un ascenso', sin_trabajo: 'me preocupa el dinero', casa_fea: 'la casa no me gusta nada', miedo: 'tengo miedo', deberes: 'tengo deberes pendientes', aburrido: 'me aburro muchísimo' };
const WISH = { hambre: 'comer algo rico', energia: 'dormir mucho', higiene: 'darme una ducha', diversion: 'divertirme un poco', social: 'ver a alguien', vejiga: 'ir al baño a tiempo' };
function writeDiary(state) {
  for (const s of householdSims(state)) {
    if (s.age === 'bebe' || s.location !== 'casa') continue;
    const log = (s.dayLog || []).filter((k) => DIARY[k]);
    const open = s.mood >= 70 ? 'Hoy ha sido un día genial.' : s.mood >= 45 ? 'Hoy ha sido un día normal.' : 'Qué día más duro.';
    const bits = log.slice(-3).map((k) => DIARY[k]);
    let text = open + (bits.length ? ' ' + bits.map((b, i) => (i === 0 ? b[0].toUpperCase() + b.slice(1) : b)).join(bits.length > 2 ? ', ' : ' y ').replace(/, ([^,]*)$/, ' y $1') + '.' : '');
    if (s.worries.length) text += ` Además, ${WORRY_1P[s.worries[0]] || 'algo me preocupa'}.`;
    else { const low = NEEDS.filter((n) => s.needs[n] < 45).sort((a, b) => s.needs[a] - s.needs[b])[0]; if (low) text += ` Mañana quiero ${WISH[low]}.`; }
    s.diary ||= []; s.diary.unshift({ day: dayOf(state.time), text }); if (s.diary.length > 14) s.diary.length = 14;
    s.dayLog = [];
  }
}

// ---------- cartas al futuro ----------
export function writeLetter(state, from, to, text) {
  state.letters ||= [];
  const L = { from: from.id, fromName: from.name, to, text: text.slice(0, 400), t: state.time, open: false };
  if (to === 'familia') L.openDay = dayOf(state.time) + 7;
  state.letters.push(L);
  toast(to === 'familia' ? '✉️ Cápsula del tiempo guardada: se abrirá dentro de 7 días' : `✉️ Carta guardada: ${state.sims[to]?.name} la leerá cuando sea adulto/a`, 'good', from.id);
}
function deliverLetters(state, grownId = null) {
  const day = dayOf(state.time);
  for (const L of state.letters || []) {
    if (L.open) continue;
    if ((grownId && L.to === grownId) || (L.to === 'familia' && day >= L.openDay)) {
      L.open = true; emit('letter', { letter: L });
      const rec = L.to === 'familia' ? householdSims(state) : [state.sims[L.to]].filter(Boolean);
      rec.forEach((r) => addMoodlet(r, 'carta'));
      addMemory(state, L.to === 'familia' ? `Abrimos la cápsula del tiempo de ${L.fromName}` : `${state.sims[L.to]?.name} leyó la carta de ${L.fromName}`, 'pencil', [L.from, L.to]);
    }
  }
}

// ---------- reloj real ----------
export function syncRealTime(state) {
  const now = new Date(); const m = now.getHours() * 60 + now.getMinutes();
  let d = dayOf(state.time); if (m < (state.time % 1440) - 2) d++;
  state.time = d * 1440 + m; state.lastHour = Math.floor(state.time / 60) - 0;
}

function needMult(s, n) {
  let m = 1;
  for (const t of s.traits) m *= TRAITS[t]?.decay?.[n] || 1;
  for (const r of s.rewards || []) m *= REWARDS[r]?.decay?.[n] || 1;
  if (s.worries?.includes('resfriado') && (n === 'energia' || n === 'higiene')) m *= 1.4; // resfriado: cansa y hay que ducharse más
  return m;
}
// ---------- habilidades ----------
export const skillLevel = (s, k) => Math.floor(s.skills?.[k] || 0);
export function gainSkill(state, s, k, amount) {
  if (!s.home || s.age === 'bebe') return;
  s.skills ||= {}; const before = Math.floor(s.skills[k] || 0);
  let learn = 1; for (const r of s.rewards || []) learn *= REWARDS[r]?.learn || 1;
  s.skills[k] = Math.min(10, (s.skills[k] || 0) + amount * learn / (1 + before * 0.5));
  const after = Math.floor(s.skills[k]);
  if (after > before) toast(`${s.name} sube a nivel ${after} de ${SKILLS[k].label}`, 'good', s.id);
}
// ---------- recuerdos ----------
export function addMemory(state, text, ic = 'star', simIds = []) {
  state.memories ||= [];
  state.memories.unshift({ t: state.time, text, ic, simIds });
  if (state.memories.length > 80) state.memories.length = 80;
}
// ---------- aspiraciones ----------
export function ensureAspiration(s) {
  if (!isAdult(s) || !s.home || s.aspiration) return;
  s.aspiration = pick(Object.keys(ASPIRATIONS)); s.aspDone = 0; s.points ||= 0; s.rewards ||= [];
}
function friendsCount(state, s, min) { return Object.entries(s.rel).filter(([id, r]) => state.sims[id] && r.a >= min).length; }
function aspStepMet(state, s, i) {
  const st = state, k = s.aspiration;
  if (k === 'familia') return [() => !!s.partner, () => s.married, () => householdSims(st).some((o) => o.parents.includes(s.id)), () => householdSims(st).length >= 4][i]();
  if (k === 'fortuna') return [() => st.money >= 8000, () => st.money >= 20000, () => decorScore(st) >= 30, () => st.money >= 50000][i]();
  if (k === 'social') return [() => friendsCount(st, s, 40) >= 3, () => friendsCount(st, s, 75) >= 1, () => skillLevel(s, 'carisma') >= 5, () => friendsCount(st, s, 40) >= 6][i]();
  if (k === 'carrera') return [() => !!s.job, () => s.job && s.job.level >= 2, () => s.job && s.job.level >= 4, () => s.job && skillLevel(s, CAREERS[s.job.id].skill) >= 8][i]();
  if (k === 'artista') return [() => skillLevel(s, 'creatividad') >= 3, () => (s.paintings || 0) >= 5, () => skillLevel(s, 'creatividad') >= 7, () => (s.paintings || 0) >= 25][i]();
  return false;
}
function checkAspirations(state) {
  for (const s of householdSims(state)) {
    ensureAspiration(s);
    if (!s.aspiration || s.aspDone >= 4) continue;
    if (aspStepMet(state, s, s.aspDone)) {
      const A = ASPIRATIONS[s.aspiration]; const step = A.steps[s.aspDone];
      s.aspDone++; s.points = (s.points || 0) + 100 * s.aspDone; addMoodlet(s, 'objetivo');
      if (s.aspDone >= 4) { s.points += 500; toast(`🏆 ¡${s.name} ha cumplido su aspiración «${A.label}»! +600 puntos`, 'good', s.id); addMemory(state, `${s.name} cumplió su aspiración «${A.label}»`, 'star', [s.id]); }
      else { toast(`⭐ ${s.name}: «${step}» conseguido (+${100 * s.aspDone} puntos)`, 'good', s.id); addMemory(state, `${s.name}: ${step.toLowerCase()}`, 'flag', [s.id]); }
    }
  }
}
export function buyReward(state, s, id) {
  const r = REWARDS[id]; if (!r || (s.rewards || []).includes(id)) return false;
  if ((s.points || 0) < r.cost) { toast('No tiene puntos suficientes', 'warn', s.id); return false; }
  s.points -= r.cost; s.rewards = [...(s.rewards || []), id]; toast(`${s.name} consigue «${r.label}»`, 'good', s.id); return true;
}
export function setAspiration(s, k) { s.aspiration = k; s.aspDone = 0; }

function updateNeeds(state, s, dt, factor = 1) {
  const baby = s.age === 'bebe';
  const list = baby ? BABY_NEEDS : NEEDS;
  for (const n of list) {
    let r = (baby ? BABY_DECAY : DECAY)[n] / 60 * needMult(s, n) * factor;
    if (s.sleeping && (n === 'hambre' || n === 'vejiga')) r *= 0.4;
    if (s.sleeping && n === 'energia') r = 0;
    if (s.cur?.kind === 'soc' && s.cur.phase === 'do' && n === 'social') r = 0;
    if (s.cur?.kind === 'partner' && n === 'social') r = 0;
    s.needs[n] = clamp(s.needs[n] - r * dt);
  }
  s.moodlets = s.moodlets.filter((m) => m.until > state.time);
}

function failures(state, s) {
  if (!s.home || s.cur?.kind === 'ko') return;
  if (s.needs.vejiga <= 0) {
    interrupt(state, s); s.queue = [];
    s.needs.vejiga = 100; s.needs.higiene = 0; addMoodlet(s, 'humillado');
    toast(`¡${s.name} no ha llegado al váter a tiempo! 😳`, 'bad', s.id);
  } else if (s.needs.energia <= 0) {
    interrupt(state, s); s.queue = [];
    s.cur = { kind: 'ko', t: 0, dur: 240, sleep: true, icon: 'moon', label: 'Dormido/a en el suelo' }; s.sleeping = true;
    addMoodlet(s, 'suelo'); toast(`${s.name} se ha quedado dormido/a en el suelo de agotamiento`, 'bad', s.id);
  } else if (s.needs.hambre <= 0) {
    interrupt(state, s); s.queue = [];
    s.cur = { kind: 'ko', t: 0, dur: 120, icon: 'alert', label: 'Desmayado/a' }; s.needs.hambre = 25;
    addMoodlet(s, 'desmayo'); toast(`¡${s.name} se ha desmayado de hambre!`, 'bad', s.id);
  }
}

function runCur(state, s, dt) {
  const c = s.cur;
  if (c.kind === 'ko') {
    c.t += dt;
    if (c.sleep) s.needs.energia = clamp(s.needs.energia + 0.22 * dt);
    if (c.t >= c.dur) { s.cur = null; s.sleeping = false; }
    return;
  }
  if (c.kind === 'partner') {
    if (s.path.length) walk(s, dt);
    const l = state.sims[c.leaderId];
    if (!l || l.cur?.kind !== 'soc' || l.cur.targetId !== s.id) { interrupt(state, s); }
    return;
  }
  if (s.path.length) { walk(s, dt); return; }
  if (c.kind === 'go') { s.cur = null; return; }
  if (c.kind === 'leave') {
    s.location = c.to; s.cur = null; s.queue = []; s.bubble = null;
    if (c.to === 'trabajo' || c.to === 'escuela') { s.workMood = 0; s.workT = 0; s.late = c.late; }
    return;
  }
  if (c.kind === 'pet') return runPet(state, s, c, dt);
  if (c.kind === 'obj') runObj(state, s, c, dt);
  else if (c.kind === 'soc') runSoc(state, s, c, dt);
}

function walk(s, dt) {
  let step = WALK_SPEED * dt;
  while (step > 0 && s.path.length) {
    const n = s.path[0]; const dx = n.x - s.x, dy = n.y - s.y; const d = Math.hypot(dx, dy);
    if (d <= step) { s.x = n.x; s.y = n.y; s.path.shift(); step -= d; }
    else { s.x += dx / d * step; s.y += dy / d * step; s.dir = dx - dy >= 0 ? 1 : -1; step = 0; }
  }
}

function runObj(state, s, c, dt) {
  const o = objById(state, c.objId); const a = ACTIONS[c.act];
  if (!o) { s.cur = null; return; }
  if (c.phase === 'walk') {
    c.phase = 'do';
    if (a.cost) { if (state.money < a.cost) { toast('No hay dinero', 'warn', s.id); interrupt(state, s); return; } state.money -= a.cost; }
    if (a.ui) { emit('ui', { ui: a.ui, simId: s.id }); }
    if (a.pay) { payBills(state); interrupt(state, s); return; }
    if (c.onObj) {
      const idx = Math.max(0, o.users.indexOf(s.id));
      const tiles = objTiles(o); const t = tiles[Math.min(idx, tiles.length - 1)];
      s.x = t.x; s.y = t.y;
    }
    s.sleeping = !!a.sleep;
  }
  c.t += dt;
  if (a.sleep && c.t > 10 && (s.needs.hambre < 8 || s.needs.vejiga < 8)) {
    if (s.home) toast(`${s.name} se ha despertado: ${s.needs.hambre < 8 ? 'tiene mucha hambre' : 'necesita ir al baño'}`, 'warn', s.id);
    interrupt(state, s); return;
  }
  if (a.rate) for (const [n, r] of Object.entries(a.rate)) if (n in s.needs) s.needs[n] = clamp(s.needs[n] + r * dt);
  if (a.skill) gainSkill(state, s, a.skill[0], a.skill[1] * dt);
  const done = c.t >= a.dur || (a.until && c.t >= (a.minDur || 0) && s.needs[a.until] >= 99.5);
  if (done) {
    if (c.act === 'cocinar') {
      const lv = skillLevel(s, 'cocina');
      if (lv < 2 && Math.random() < 0.3 - lv * 0.1) { addMoodlet(s, 'quemada'); toast(`A ${s.name} se le ha quemado la comida`, 'warn', s.id); s.needs.hambre = clamp(s.needs.hambre - 25); }
      else addMoodlet(s, lv >= 5 ? 'gourmet' : 'comida_rica');
    } else if (a.moodlet) addMoodlet(s, a.moodlet);
    if (a.sells) {
      const lv = s.skills?.creatividad || 0; const price = Math.round(12 + lv * 14 + Math.random() * 20);
      state.money += price; s.paintings = (s.paintings || 0) + 1;
      toast(`🎨 ${s.name} ha vendido un cuadro por ${price} €`, 'good', s.id);
      if (s.paintings === 1) addMemory(state, `${s.name} vendió su primer cuadro`, 'brush', [s.id]);
      if (lv >= 6 && Math.random() < 0.3) addMoodlet(s, 'inspirado');
    }
    if (a.resolves) {
      resolveWorry(state, s, a.resolves);
      // el médico atiende a toda la familia que esté en casa
      if (a.resolves === 'resfriado') for (const o of householdSims(state)) if (o !== s && o.location === 'casa') resolveWorry(state, o, 'resfriado');
      if (a.resolves === 'deberes' && s.school) s.school.grade = clamp(s.school.grade + 6);
    }
    interrupt(state, s);
  }
}

function runSoc(state, s, c, dt) {
  const t = state.sims[c.targetId]; const d = SOCIALS[c.act];
  if (!t || t.location !== 'casa') { interrupt(state, s); return; }
  if (c.phase === 'walk') {
    if (c.bedId && t.path.length) return; // espera a la otra persona
    c.phase = 'do';
    if (c.bedId) {
      const bed = objById(state, c.bedId); const tiles = objTiles(bed);
      s.x = tiles[0].x; s.y = tiles[0].y; t.x = tiles[1].x; t.y = tiles[1].y;
      if (s.home || t.home) emit('fade', {});
    }
    t.cur.phase = 'do';
  }
  c.t += dt;
  if (c.t >= d.dur) {
    resolveSocial(state, s, t, c.act);
    interrupt(state, s);
  }
}

function resolveSocial(state, a, t, id) {
  const d = SOCIALS[id]; const rel = getRel(a, t);
  let chance = d.chance + (a.mood - 50) / 300 + (t.mood - 50) / 250 + rel.a / 500;
  for (const tr of a.traits) {
    chance *= TRAITS[tr]?.social || 1;
    if (d.joke) chance *= TRAITS[tr]?.joke || 1;
    if (d.romantic) chance *= TRAITS[tr]?.romance ? 1.15 : 1;
  }
  for (const tr of t.traits) if (tr === 'grunon') chance -= 0.1;
  if (!d.care && t.age !== 'bebe') {
    if (a.needs.higiene < 15) chance -= 0.2;
    if (d.romantic && t.partner && t.partner !== a.id) chance -= 0.45;
    if (d.romantic && rel.a < 0) chance -= 0.3;
    if (d.romantic && !attractedTo(t, a)) chance -= 0.75;
  }
  chance += skillLevel(a, 'carisma') * 0.015;
  for (const r of a.rewards || []) chance *= REWARDS[r]?.social || 1;
  if (d.bad) chance = 1;
  const ok = Math.random() < chance;
  if (ok && !d.care && !d.bad && t.age !== 'bebe') gainSkill(state, a, 'carisma', 0.12);
  const showHeart = d.romantic && ok;
  if (ok) {
    let rm = 1; for (const tr of a.traits) rm *= TRAITS[tr]?.romance || 1;
    setRel(state, a, t, d.a || 0, (d.r || 0) * (d.r > 0 ? rm : 1));
    if (d.social) { if ('social' in a.needs) a.needs.social = clamp(a.needs.social + d.social); if ('social' in t.needs) t.needs.social = clamp(t.needs.social + d.social); }
    if (d.fun) { if ('diversion' in a.needs) a.needs.diversion = clamp(a.needs.diversion + d.fun); if ('diversion' in t.needs) t.needs.diversion = clamp(t.needs.diversion + d.fun); }
    if (d.baby) { for (const [n, v] of Object.entries(d.baby)) t.needs[n] = clamp(t.needs[n] + v); t.neglect = 0; }
    if (d.moodlet) { addMoodlet(a, d.moodlet); addMoodlet(t, d.moodlet); }
    if (d.bed) { a.needs.energia = clamp(a.needs.energia - 10); t.needs.energia = clamp(t.needs.energia - 10); }
    if (id === 'discutir') { addMoodlet(a, 'discusion'); addMoodlet(t, 'discusion'); }
    if (d.resolves) { resolveWorry(state, a, d.resolves); resolveWorry(state, t, d.resolves); }
    special(state, a, t, d.special);
    a.bubble = { icon: showHeart ? 'heart' : d.bad ? 'zap' : 'smile', until: state.time + 25 };
    t.bubble = { icon: showHeart ? 'heart' : d.bad ? 'zap' : 'smile', until: state.time + 25 };
    if (showHeart) emit('hearts', { x: (a.x + t.x) / 2, y: (a.y + t.y) / 2 });
  } else {
    setRel(state, a, t, -4, d.romantic ? -4 : 0);
    addMoodlet(a, 'rechazo');
    a.bubble = { icon: 'frown', until: state.time + 25 }; t.bubble = { icon: 'meh', until: state.time + 25 };
    if (a.home || t.home) toast(d.romantic && !attractedTo(t, a) ? `A ${t.name} no le atrae ${a.name} de esa forma, pero no pasa nada` : `A ${t.name} no le ha gustado: ${d.label.toLowerCase()}`, 'warn', a.id);
  }
}

function special(state, a, t, sp) {
  if (!sp) return;
  if (sp === 'pareja') {
    for (const x of [a, t]) if (x.partner && x.partner !== a.id && x.partner !== t.id) { const ex = state.sims[x.partner]; if (ex) { ex.partner = null; ex.married = false; addMoodlet(ex, 'ruptura'); } }
    a.partner = t.id; t.partner = a.id; addMoodlet(a, 'pareja'); addMoodlet(t, 'pareja');
    toast(`💞 ${a.name} y ${t.name} ahora son pareja`, 'good', a.id); addMemory(state, `${a.name} y ${t.name} empezaron a salir`, 'heart', [a.id, t.id]);
  } else if (sp === 'boda') {
    a.married = t.married = true; addMoodlet(a, 'boda'); addMoodlet(t, 'boda');
    toast(`💍 ¡${a.name} y ${t.name} se han casado!`, 'good', a.id); addMemory(state, `Boda de ${a.name} y ${t.name}`, 'ring', [a.id, t.id]); emit('hearts', { x: a.x, y: a.y });
  } else if (sp === 'romper') {
    a.partner = t.partner = null; a.married = t.married = false; addMoodlet(a, 'ruptura'); addMoodlet(t, 'ruptura');
    toast(`💔 ${a.name} y ${t.name} lo han dejado`, 'bad', a.id);
  } else if (sp === 'embarazo') {
    const pair = conceptionPair(a, t);
    if (!pair) { toast(`${a.name} y ${t.name} pueden adoptar desde el teléfono`, 'info', a.id); return; }
    const [mother, father] = pair;
    if (Math.random() < 0.6) {
      mother.pregnant = { due: state.time + 2 * 1440, father: father.id };
      addMoodlet(mother, 'embarazo');
      toast(`🤰 ¡${mother.name} está esperando un bebé!`, 'good', mother.id);
    } else toast(`Esta vez no ha habido suerte. Podéis volver a intentarlo.`, 'info', a.id);
  } else if (sp === 'mudarse') {
    t.home = true; t.surname = state.surname; state.household.push(t.id); t.visitUntil = 0; t.queue = [];
    toast(`🏠 ${t.name} se muda con la familia`, 'good', t.id); addMemory(state, `${t.name} se mudó a casa`, 'home', [t.id]);
  } else if (sp === 'despedir') {
    t.visitUntil = state.time;
  }
}

function updateBubble(state, s) {
  if (s.bubble && s.bubble.until < state.time) s.bubble = null;
  if (!s.home) return;
  const list = NEEDS;
  for (const n of list) {
    if (s.needs[n] < 15 && !s.alerted[n]) {
      s.alerted[n] = true;
      const msgs = { hambre: 'tiene mucha hambre', energia: 'está agotado/a', higiene: 'necesita una ducha urgente', diversion: 'se muere de aburrimiento', social: 'necesita hablar con alguien', vejiga: 'necesita ir al baño YA' };
      toast(`⚠️ ${s.name} ${msgs[n]}`, 'warn', s.id);
    } else if (s.needs[n] > 40) s.alerted[n] = false;
  }
}

// ---------- autonomía ----------
const NEED_ACTS = {
  hambre: ['cocinar', 'picar'], energia: ['dormir', 'siesta'], higiene: ['ducha'], vejiga: ['vater'],
  diversion: ['tele', 'jugarpc', 'juguetes', 'bailar', 'leer', 'relajarse'],
};
// Nivel de autonomía efectivo: 'total' (hacen su vida), 'normal' o 'baja'.
// Si no estás (app cerrada o sin tocar la pantalla un rato) siempre hacen su vida.
export const autonomyLevel = (state) => (state._away ? 'total' : state.settings.autonomy || 'total');
function autonomy(state, s) {
  if (state.time < s.nextThink) return;
  s.nextThink = state.time + 5 + Math.random() * 5;
  const npc = !s.home;
  if (npc) return npcThink(state, s);
  if (autonomyLevel(state) === 'total') return lifeThink(state, s);
  const low = autonomyLevel(state) !== 'normal';
  const thr = low ? 18 : 45;
  if (low && Math.random() < 0.35) return;
  const h = hourOf(state.time);
  const urgent = NEEDS.filter((n) => s.needs[n] < (low ? 18 : 30) && n !== 'energia').sort((x, y) => s.needs[x] - s.needs[y]);
  for (const n of urgent) if (tryNeed(state, s, n)) return;
  if (!low && (h >= 23 || h < 6) && s.needs.energia < 80) { if (tryNeed(state, s, 'energia')) return; }
  if (!low && isAdult(s)) {
    const baby = householdSims(state).find((b) => b.age === 'bebe' && b.location === 'casa' && Math.min(b.needs.hambre, b.needs.higiene, b.needs.social) < 35 && !b.cur);
    if (baby) {
      const n = ['hambre', 'higiene', 'social'].sort((x, y) => baby.needs[x] - baby.needs[y])[0];
      const act = { hambre: 'biberon', higiene: 'panal', social: 'acunar' }[n];
      queueSocial(state, s, act, baby.id); return;
    }
  }
  const needs = NEEDS.filter((n) => s.needs[n] < thr).sort((a, b) => s.needs[a] - s.needs[b]);
  for (const n of needs) if (tryNeed(state, s, n)) return;
  if (!low && isAdult(s)) {
    const pet = (state.pets || []).find((p) => !p.out && !p.sleeping && !p.busy && Math.min(...Object.values(p.needs)) < 35);
    if (pet) { const n = Object.entries(pet.needs).sort((a, b) => a[1] - b[1])[0][0]; queuePet(state, s, { hambre: 'comer', carino: 'acariciar', diversion: 'jugar' }[n], pet.id); return; }
  }
  if (!low && Math.random() < 0.3) { const t = randomFreeTile(state); queueGo(state, s, t.x, t.y); }
}
// ---------- vida propia ----------
const wchoice = (opts) => { const t = opts.reduce((a, o) => a + Math.max(0, o.w), 0); if (t <= 0) return null; let r = Math.random() * t; for (const o of opts) { r -= Math.max(0, o.w); if (r <= 0) return o; } return null; };
const freeAt = (state, s, mins) => { const sch = scheduleOf(s); if (!sch || dowOf(state.time) > 4) return true; const h = hourOf(state.time); return h + mins / 60 + 0.5 < sch.start || h >= sch.end; };
function objFor(state, s, act) { return state.objects.find((o) => OBJECTS[o.type].acts.includes(act) && objectActions(state, s, o).some((a) => a.id === act && !a.disabled)); }
function bestCareer(s) {
  const sk = s.skills || {};
  if (s.aspiration === 'artista' || (sk.creatividad || 0) >= 3) return 'arte';
  if ((sk.cocina || 0) >= 3) return 'cocina';
  if ((sk.logica || 0) >= 3) return pick(['oficina', 'medicina']);
  return pick(Object.keys(CAREERS));
}
function lifeThink(state, s) {
  const h = hourOf(state.time), day = dayOf(state.time), adult = isAdult(s);
  const fam = householdSims(state);
  // 1. necesidades urgentes y dormir de noche
  const urgent = NEEDS.filter((n) => s.needs[n] < 35 && n !== 'energia').sort((a, b) => s.needs[a] - s.needs[b]);
  for (const n of urgent) if (tryNeed(state, s, n)) return;
  if ((h >= 23 || h < 7 || s.needs.energia < 25) && s.needs.energia < 85) { if (tryNeed(state, s, 'energia')) return; }
  // 2. cuidar de bebés, niños asustados y mascotas
  if (adult) {
    const baby = fam.find((b) => b.age === 'bebe' && b.location === 'casa' && Math.min(b.needs.hambre, b.needs.higiene, b.needs.social) < 50 && !b.cur);
    if (baby) { const n = ['hambre', 'higiene', 'social'].sort((x, y) => baby.needs[x] - baby.needs[y])[0]; return queueSocial(state, s, { hambre: 'biberon', higiene: 'panal', social: 'acunar' }[n], baby.id); }
    const scared = fam.find((k) => k.worries.includes('miedo') && k.location === 'casa' && !busyReason(state, k));
    if (scared) return queueSocial(state, s, 'consolar', scared.id);
    const pet = (state.pets || []).find((p) => !p.out && !p.sleeping && !p.busy && Math.min(...Object.values(p.needs)) < 45);
    if (pet) { const n = Object.entries(pet.needs).sort((a, b) => a[1] - b[1])[0][0]; return queuePet(state, s, { hambre: 'comer', carino: 'acariciar', diversion: 'jugar' }[n], pet.id); }
    // 3. asuntos de la casa: facturas y trabajo
    if (state.bills.length && state.bills.some((b) => day - b.day >= 1) && state.money >= billsTotal(state) && !fam.some((o) => o.cur?.act === 'pagar' || o.queue.some((q) => q.act === 'pagar'))) {
      const box = state.objects.find((o) => o.type === 'buzon'); if (box) return queueObject(state, s, 'pagar', box.id);
    }
    if (s.age === 'adulto' && !s.job && s.jobSearchDay !== day && (state.money < 6000 || s.aspiration === 'carrera')) { s.jobSearchDay = day; setJob(state, s, bestCareer(s)); return; }
  }
  if (s.worries.includes('deberes') && h >= 14 && h < 22) { const pc = objFor(state, s, 'deberes'); if (pc) return queueObject(state, s, 'deberes', pc.id); }
  if (s.worries.includes('estres') || s.worries.includes('soledad')) {
    const friend = fam.find((o) => o !== s && o.age !== 'bebe' && !busyReason(state, o) && getRel(s, o).a >= 15);
    if (friend) return queueSocial(state, s, s.worries.includes('estres') ? 'desahogarse' : 'charlar', friend.id);
  }
  // 4. necesidades no urgentes
  const needs = NEEDS.filter((n) => s.needs[n] < 55 && n !== 'social' && n !== 'diversion').sort((a, b) => s.needs[a] - s.needs[b]);
  for (const n of needs) if (tryNeed(state, s, n)) return;
  // 5. tiempo libre: según aspiración, personalidad y ánimo
  const weekend = dowOf(state.time) >= 5, daytime = h >= 10 && h <= 20, rain = ['lluvia', 'nieve'].includes(weatherOf(state).type);
  const others = fam.filter((o) => o !== s && o.age !== 'bebe' && o.location === 'casa' && !busyReason(state, o));
  const partner = s.partner && state.sims[s.partner];
  const trait = (t) => s.traits.includes(t);
  const fun = 100 - s.needs.diversion, soc = 100 - s.needs.social;
  const opts = [
    { w: 1 + fun / 30 + (trait('jugueton') ? 1 : 0), go: () => tryNeed(state, s, 'diversion') },
    { w: objFor(state, s, 'pintar') ? (s.aspiration === 'artista' ? 4 : (s.skills?.creatividad || 0) > 2 ? 2 : 0.6) : 0, go: () => { const o = objFor(state, s, 'pintar'); return o && (queueObject(state, s, 'pintar', o.id), true); } },
    { w: s.aspiration === 'carrera' || s.aspiration === 'social' ? 1.5 : 0.6, go: () => { const o = objFor(state, s, 'leer'); return o && (queueObject(state, s, 'leer', o.id), true); } },
    { w: adult && s.needs.hambre < 80 ? 1 : 0, go: () => { const o = objFor(state, s, 'cocinar'); return o && (queueObject(state, s, 'cocinar', o.id), true); } },
    { w: others.length ? 1 + soc / 25 + (trait('sociable') ? 1.5 : 0) - (trait('solitario') ? 1 : 0) : 0, go: () => {
      const o = partner && others.includes(partner) && Math.random() < 0.5 ? partner : pick(others);
      const rel = getRel(s, o); let act = pick(['charlar', 'charlar', 'chiste', 'halagar']);
      if (rel.a > 40 && Math.random() < 0.3) act = 'abrazar';
      if (o === partner && Math.random() < 0.4) act = rel.r > 40 ? 'besar' : 'coquetear';
      if (o.age === 'nino' || s.age === 'nino') act = Math.random() < 0.5 ? 'jugarnino' : 'charlar';
      if (socialReq(state, s, o, act, SOCIALS[act]) !== true) act = 'charlar';
      queueSocial(state, s, act, o.id); return true; } },
    { w: partner && others.includes(partner) && adult && h >= 21 && h < 24 && getRel(s, partner).r >= 60 ? 0.5 : 0, go: () => {
      const wantBaby = (s.aspiration === 'familia' || partner.aspiration === 'familia') && socialReq(state, s, partner, 'bebe', SOCIALS.bebe) === true;
      const act = wantBaby ? 'bebe' : 'intimidad'; if (socialReq(state, s, partner, act, SOCIALS[act]) !== true) return false;
      queueSocial(state, s, act, partner.id); return true; } },
    { w: adult && daytime && freeAt(state, s, 150) ? (weekend ? 1.4 : 0.45) : 0, go: () => {
      let dest = s.needs.hambre < 60 ? 'restaurante' : (s.skills?.forma || 0) < 3 && Math.random() < 0.3 ? 'gimnasio' : rain ? 'cine' : pick(['parque', 'cine', 'parque']);
      const O = OUTINGS[dest]; const group = [s];
      for (const o of others) if ((o === partner || o.age === 'nino') && Math.random() < 0.7 && freeAt(state, o, O.dur)) group.push(o);
      if (state.money < O.cost * group.length + 200) dest = 'parque';
      return startOuting(state, group, dest); } },
    { w: adult && daytime && h < 21 ? 0.4 + (trait('sociable') ? 0.4 : 0) : 0, go: () => {
      const friends = neighbors(state).filter((n) => n.location === 'fuera' && whereIs(state, n) === 'en su casa' && getRel(s, n).a >= 15);
      if (friends.length && freeAt(state, s, 120) && Math.random() < 0.5) return startOuting(state, [s], 'visita', pick(friends).id);
      const anyone = neighbors(state).filter((n) => n.location === 'fuera' && getRel(s, n).a >= 0);
      if (anyone.length && !neighbors(state).some((n) => n.location === 'casa' || n.pendingVisit)) { inviteNeighbor(state, pick(anyone).id, true); return true; }
      return false; } },
    { w: adult && (state.pets || []).some((p) => p.species === 'perro' && !p.out && !p.sleeping && p.needs.diversion < 75) && daytime && !rain ? 0.7 : 0, go: () => { const p = state.pets.find((q) => q.species === 'perro' && !q.out); queuePet(state, s, 'pasear', p.id); return true; } },
    { w: (state.pets || []).length ? 0.4 : 0, go: () => { const p = pick(state.pets.filter((q) => !q.out && !q.sleeping)); if (!p) return false; queuePet(state, s, pick(['acariciar', 'jugar']), p.id); return true; } },
    { w: 0.5, go: () => { const t = randomFreeTile(state); queueGo(state, s, t.x, t.y); return true; } },
  ];
  for (let i = 0; i < 3; i++) { const o = wchoice(opts); if (!o) return; if (o.go()) return; o.w = 0; }
}

function tryNeed(state, s, n) {
  if (n === 'social') {
    const others = visibleSims(state).filter((o) => o !== s && o.age !== 'bebe' && !busyReason(state, o));
    if (!others.length) return false;
    others.sort((a, b) => Math.hypot(a.x - s.x, a.y - s.y) - Math.hypot(b.x - s.x, b.y - s.y));
    queueSocial(state, s, pick(['charlar', 'charlar', 'chiste', 'halagar']), others[0].id);
    return true;
  }
  const acts = NEED_ACTS[n] || [];
  let best = null, bd = 1e9;
  for (const o of state.objects) {
    for (const av of objectActions(state, s, o)) {
      if (!acts.includes(av.id) || av.disabled) continue;
      const a = ACTIONS[av.id];
      if (a.ui || (a.cost && a.cost > 20)) continue;
      const d = Math.hypot(o.x - s.x, o.y - s.y) + acts.indexOf(av.id) * 2;
      if (d < bd) { bd = d; best = { o, id: av.id }; }
    }
  }
  if (!best) return false;
  queueObject(state, s, best.id, best.o.id);
  return true;
}
function npcThink(state, s) {
  if (state.time >= s.visitUntil || s.needs.energia < 15) {
    s.queue = []; const p = pathTo(state, s, EXIT.x, EXIT.y);
    s.cur = { kind: 'leave', to: 'fuera', icon: 'logout', label: 'Se va a casa' }; s.path = p || [];
    return;
  }
  const r = Math.random();
  const hosts = householdSims(state).filter((h) => h.location === 'casa' && h.age !== 'bebe' && !busyReason(state, h));
  if (r < 0.45 && hosts.length) {
    const h = pick(hosts); const rel = getRel(s, h);
    let opts = ['charlar', 'charlar', 'chiste', 'halagar'];
    if (rel.a > 35) opts.push('abrazar');
    if (isAdult(s) && isAdult(h) && !related(s, h) && attractedTo(s, h) && (!h.partner || h.partner === s.id) && rel.a > 25) opts.push('coquetear');
    if (rel.r > 45 && h.partner === s.id) opts.push('besar');
    if (rel.a < -30) opts.push('discutir');
    const id = pick(opts);
    if (socialReq(state, s, h, id, SOCIALS[id]) === true) { queueSocial(state, s, id, h.id); return; }
  }
  const low = NEEDS.filter((n) => n !== 'social' && s.needs[n] < 50).sort((a, b) => s.needs[a] - s.needs[b]);
  for (const n of low) if (tryNeed(state, s, n)) return;
  if (Math.random() < 0.5) { const t = randomFreeTile(state); queueGo(state, s, t.x, t.y); }
}

// ---------- bebés ----------
function babyUpdate(state, s, dt) {
  if (s.cur?.kind === 'partner') { runCur(state, s, dt); }
  let crib = s.cribId && objById(state, s.cribId);
  if (!crib) {
    crib = state.objects.find((o) => OBJECTS[o.type].crib && !Object.values(state.sims).some((b) => b !== s && b.cribId === o.id));
    if (crib) s.cribId = crib.id;
  }
  if (crib) { s.x = crib.x; s.y = crib.y; }
  if (!s.sleeping && s.needs.energia < 30) s.sleeping = true;
  if (s.sleeping) {
    s.needs.energia = clamp(s.needs.energia + (crib ? 0.3 : 0.12) * dt);
    if (s.needs.energia >= 99) s.sleeping = false;
  }
  s.crying = BABY_NEEDS.some((n) => n !== 'energia' && s.needs[n] < 25) || (!crib && s.needs.energia < 20);
  if (s.bubble && s.bubble.until < state.time) s.bubble = null;
  if (BABY_NEEDS.some((n) => s.needs[n] <= 0)) {
    s.neglect += dt;
    if (s.neglect > 240) {
      s.neglect = 0; s.warnings++;
      if (s.warnings >= 3) {
        toast(`🚨 Los servicios sociales se han llevado a ${s.name}. Cuidad mejor a los bebés.`, 'bad');
        removeFromHousehold(state, s);
      } else toast(`🚨 Aviso ${s.warnings}/2 de servicios sociales: ${s.name} está desatendido/a`, 'bad', s.id);
    }
  }
  if (s.crying && !s.alerted.cry) { s.alerted.cry = true; toast(`😭 ${s.name} está llorando`, 'warn', s.id); }
  if (!s.crying) s.alerted.cry = false;
}
function removeFromHousehold(state, s) {
  state.household = state.household.filter((id) => id !== s.id);
  delete state.sims[s.id];
  for (const o of Object.values(state.sims)) delete o.rel[s.id];
  if (state.active === s.id) state.active = state.household[0];
}
function makeBaby(state, mother, father) {
  const g = pick(['f', 'm', 'f', 'm', 'x']);
  const look = randomLook(g);
  if (mother && father) {
    look.skin = Math.random() < 0.5 ? mother.look.skin : father.look.skin;
    look.hairColor = Math.random() < 0.5 ? mother.look.hairColor : father.look.hairColor;
  }
  const b = makeSim(state, { gender: g, age: 'bebe', home: true, location: 'casa', parents: [mother?.id, father?.id].filter(Boolean), surname: state.surname, look });
  BABY_NEEDS.forEach((n) => (b.needs[n] = 80));
  b.x = mother ? Math.round(mother.x) : 5; b.y = mother ? Math.round(mother.y) : 5;
  state.household.push(b.id);
  for (const p of householdSims(state)) if (p !== b) setRel(state, p, b, b.parents.includes(p.id) ? 50 : 30, 0, true);
  for (const p of householdSims(state)) { if (isAdult(p)) { addMoodlet(p, 'nacimiento'); resolveWorry(state, p, 'quiere_hijo'); } }
  return b;
}
// Quién gesta y quién aporta: cualquier pareja puede, según lo que se haya elegido para cada persona
function conceptionPair(a, b) {
  const opts = [];
  if (a.canCarry && b.canSire) opts.push([a, b]);
  if (b.canCarry && a.canSire) opts.push([b, a]);
  return opts.length ? pick(opts) : null;
}
export function adoptBaby(state) {
  if (state.money < 1000) return toast('No hay dinero suficiente para adoptar', 'warn');
  if (householdSims(state).length + pendingBabies(state) >= MAX_HOUSEHOLD) return toast('La familia está completa', 'warn');
  state.money -= 1000;
  const b = makeBaby(state, null, null);
  b.look.skin = pick(SKINS);
  emit('birth', { babyId: b.id, adopted: true }); addMemory(state, `Llegó un bebé a la familia por adopción`, 'baby', [b.id]);
}

// ---------- trabajo y escuela ----------
export function setJob(state, s, careerId) {
  s.job = careerId ? { id: careerId, level: 0, perf: 40 } : null;
  if (careerId) { toast(`💼 ${s.name} trabaja ahora en ${CAREERS[careerId].label} como ${CAREERS[careerId].levels[0]}`, 'good', s.id); resolveWorry(state, s, 'sin_trabajo'); addMemory(state, `${s.name} empezó a trabajar en ${CAREERS[careerId].label}`, 'briefcase', [s.id]); }
}
export function skipToday(state, s) { s.skipDay = dayOf(state.time); }
function scheduleOf(s) {
  if (s.age === 'nino') return SCHOOL;
  if (s.job && isAdult(s)) return CAREERS[s.job.id];
  return null;
}
function schedule(state, s) {
  const sch = scheduleOf(s); if (!sch) return;
  const day = dayOf(state.time), h = hourOf(state.time);
  if (dowOf(state.time) > 4) return;
  const what = s.age === 'nino' ? 'el cole' : 'el trabajo';
  if (s.location === 'casa') {
    if (h >= sch.start - 1 && h < sch.start && s.notified !== day) {
      s.notified = day; toast(`🚗 ${s.name} sale hacia ${what} en 1 hora`, 'info', s.id);
    }
    if (h >= sch.start && h < sch.end - 2 && s.workedDay !== day && s.skipDay !== day && s.cur?.kind !== 'ko' && s.cur?.kind !== 'leave') {
      interrupt(state, s); s.queue = [];
      s.cur = { kind: 'leave', to: s.age === 'nino' ? 'escuela' : 'trabajo', late: h > sch.start + 0.75, icon: s.age === 'nino' ? 'backpack' : 'briefcase', label: ('Ir a ' + what).replace(/^Ir a el /, 'Ir al ') };
      s.path = pathTo(state, s, EXIT.x, EXIT.y) || [];
      s.workedDay = day;
    }
    if (h >= sch.end && s.workedDay !== day && s.missedDay !== day) {
      s.missedDay = day;
      if (s.job) { s.job.perf = clamp(s.job.perf - 15); toast(`${s.name} ha faltado al trabajo (−rendimiento)`, 'bad', s.id); checkFired(state, s); }
      if (s.school) { s.school.grade = clamp(s.school.grade - 12); toast(`${s.name} ha faltado al cole`, 'bad', s.id); }
    }
  } else if ((s.location === 'trabajo' || s.location === 'escuela') && (h >= sch.end || dayOf(state.time) !== s.workedDay)) {
    finishWork(state, s, false);
  }
}
function atWork(state, s, dt) {
  const f = { hambre: 0.7, energia: 1.1, higiene: 0.8, diversion: s.job && CAREERS[s.job.id].fun ? -0.5 : 1, social: -0.8, vejiga: 0 };
  for (const n of NEEDS) s.needs[n] = clamp(s.needs[n] - DECAY[n] / 60 * f[n] * dt);
  s.mood = computeMood(state, s);
  s.workMood = (s.workMood || 0) + s.mood * dt; s.workT = (s.workT || 0) + dt;
  s.moodlets = s.moodlets.filter((m) => m.until > state.time);
}
function finishWork(state, s, offline) {
  const avg = offline ? 55 : (s.workT ? s.workMood / s.workT : 50);
  s.location = 'casa'; s.x = EXIT.x; s.y = EXIT.y; s.cur = null; s.path = [];
  const p = randomFreeTile(state); s.queue = []; if (!offline) queueGo(state, s, p.x, p.y);
  if (s.school && s.age === 'nino') {
    s.school.grade = clamp(s.school.grade + (avg - 50) / 6 + (s.late ? -4 : 0));
    addWorry(state, s, 'deberes');
    if (!offline) toast(`🎒 ${s.name} vuelve del cole (nota ${Math.round(s.school.grade / 10)})`, 'info', s.id);
    return { pay: 0 };
  }
  if (!s.job) return { pay: 0 };
  const c = CAREERS[s.job.id];
  let wm = 1; for (const t of s.traits) wm *= TRAITS[t]?.work || 1;
  s.job.perf = clamp(s.job.perf + ((avg - 45) / 3.5) * wm + (s.late ? -8 : 0) + skillLevel(s, c.skill) * 0.8);
  if (c.skill) gainSkill(state, s, c.skill, 0.25);
  const pay = c.pay[s.job.level];
  state.money += pay;
  if (!offline) toast(`💼 ${s.name} vuelve del trabajo: +${pay} €`, 'good', s.id);
  if (s.job.perf >= 100 && s.job.level < c.levels.length - 1) {
    s.job.level++; s.job.perf = 35; addMoodlet(s, 'ascenso'); resolveWorry(state, s, 'ascenso');
    toast(`🎉 ¡${s.name} ha ascendido a ${c.levels[s.job.level]}!`, 'good', s.id); addMemory(state, `${s.name} ascendió a ${c.levels[s.job.level]}`, 'briefcase', [s.id]);
  }
  if (s.job.perf < 30 && Math.random() < 0.3) addWorry(state, s, 'estres');
  checkFired(state, s);
  return { pay };
}
function checkFired(state, s) {
  if (!s.job || s.job.perf > 0) return;
  s.perfWarn++;
  if (s.perfWarn >= 2) { toast(`📉 ${s.name} ha sido despedido/a`, 'bad', s.id); s.job = null; s.perfWarn = 0; addMoodlet(s, 'despedido'); }
  else { toast(`⚠️ El jefe de ${s.name} está muy descontento (último aviso)`, 'bad', s.id); s.job.perf = 15; }
}

// ---------- facturas ----------
export function billsTotal(state) { return state.bills.reduce((a, b) => a + b.amount, 0); }
function payBills(state) {
  const total = billsTotal(state);
  if (!total) return;
  if (state.money < total) return toast(`No hay dinero para pagar ${total} € en facturas`, 'bad');
  state.money -= total; state.bills = [];
  if (state.powerOff) toast('💡 Ha vuelto la luz', 'good');
  state.powerOff = false;
  toast(`🧾 Facturas pagadas (−${total} €)`, 'good');
  for (const s of householdSims(state)) resolveWorry(state, s, 'facturas');
}

// ---------- eventos horarios ----------
function hourly(state, offline) {
  const t = state.lastHour * 60; const h = state.lastHour % 24; const day = Math.floor(state.lastHour / 24);
  if (h === 0 && day > state.lastDay) { state.lastDay = day; daily(state, offline); }
  // facturas cada 3 días
  if (h === 9 && day % 3 === 2) {
    const value = state.objects.reduce((a, o) => a + OBJECTS[o.type].price, 0);
    const amount = 60 + Math.round(value * 0.035);
    state.bills.push({ amount, day });
    toast(`📬 Han llegado facturas: ${amount} €. Págalas en el buzón`, 'warn');
  }
  if (state.bills.some((b) => day - b.day >= 1)) for (const s of householdSims(state)) if (isAdult(s)) addWorry(state, s, 'facturas');
  if (!state.powerOff && state.bills.some((b) => day - b.day >= 3)) { state.powerOff = true; toast('🔌 Os han cortado la luz por no pagar las facturas', 'bad'); }
  // embarazos
  for (const s of householdSims(state)) {
    if (s.pregnant && t >= s.pregnant.due) {
      const father = state.sims[s.pregnant.father];
      s.pregnant = null; s.moodlets = s.moodlets.filter((m) => m.id !== 'embarazo');
      const b = makeBaby(state, s, father);
      emit('birth', { babyId: b.id, adopted: false, offline }); addMemory(state, `Nació ${b.name}, hijo/a de ${s.name}`, 'baby', [b.id, s.id]);
      if (offline) state._offlineLog?.push(`Ha nacido ${b.name} 👶`);
    }
  }
  // resolución de preocupaciones
  const decor = decorScore(state);
  for (const s of householdSims(state)) {
    if (s.worries.includes('soledad') && s.needs.social >= 85) resolveWorry(state, s, 'soledad');
    if (s.worries.includes('aburrido') && s.needs.diversion >= 85) resolveWorry(state, s, 'aburrido');
    if (s.worries.includes('casa_fea') && decor >= 12) resolveWorry(state, s, 'casa_fea');
    if (s.worries.includes('sin_trabajo') && s.job) resolveWorry(state, s, 'sin_trabajo');
    if (s.worries.includes('miedo') && h >= 8 && h < 20 && Math.random() < 0.3) resolveWorry(state, s, 'miedo');
    // dormir bien en una cama cura el resfriado poco a poco
    if (s.worries.includes('resfriado') && s.cur?.act === 'dormir' && Math.random() < 0.2) resolveWorry(state, s, 'resfriado');
  }
  if (offline) return;
  // nuevas preocupaciones
  if (h >= 8 && h <= 22) for (const s of householdSims(state)) {
    if (s.location !== 'casa' || s.age === 'bebe' || s.worries.length >= 2 || Math.random() > 0.05) continue;
    const c = [];
    if (s.needs.social < 50) c.push('soledad');
    if (s.needs.diversion < 40) c.push('aburrido');
    if (isAdult(s) && s.job && (s.job.perf < 40 || Math.random() < 0.3)) c.push('estres');
    if (s.age === 'adulto' && s.partner && !s.pregnant && householdSims(state).length < MAX_HOUSEHOLD && !householdSims(state).some((b) => b.age === 'bebe')) c.push('quiere_hijo');
    if (s.job && (s.traits.includes('ambicioso') || Math.random() < 0.3)) c.push('ascenso');
    if (s.age === 'adulto' && !s.job && state.money < 3000) c.push('sin_trabajo');
    if (decor < 8) c.push('casa_fea');
    if (s.age === 'nino' && h >= 19) c.push('miedo', 'miedo');
    // resfriados: más fácil si está agotado o sin duchar, y se contagian en casa
    if (s.needs.energia < 25 || s.needs.higiene < 25) c.push('resfriado', 'resfriado');
    if (householdSims(state).some((o) => o !== s && o.worries.includes('resfriado'))) c.push('resfriado');
    if (Math.random() < 0.15) c.push('resfriado');
    if (c.length) addWorry(state, s, pick(c));
  }
  checkAspirations(state);
  updateWeather(state);
  if (h >= 8 && h <= 22) neighborhoodLife(state);
  if (h === 23) writeDiary(state);
  deliverLetters(state);
  if (['lluvia', 'nieve'].includes(weatherOf(state).type) && h >= 9 && h <= 21) for (const s of householdSims(state)) if (s.location === 'casa' && s.age !== 'bebe' && Math.random() < 0.3) addMoodlet(s, s.needs.diversion > 50 ? 'acogedor' : 'gris');
  // sucesos inesperados (como mucho uno al día)
  if (!state._away && h >= 10 && h <= 21 && state.lastEventDay !== day && Math.random() < 0.05) {
    const ev = pickEvent(state);
    if (ev) { state.lastEventDay = day; state.pendingEvent = ev; emit('choice', { event: ev }); }
  }
  // visitas espontáneas
  const visitors = neighbors(state).filter((n) => n.location === 'casa');
  if (h >= 10 && h <= 20 && visitors.length < 2 && Math.random() < 0.06) {
    const free = neighbors(state).filter((n) => n.location === 'fuera');
    if (free.length) arriveVisitor(state, pick(free), 'pasa a saludar');
  }
  if (h === 23) for (const v of visitors) v.visitUntil = Math.min(v.visitUntil, t);
}
// ---------- sucesos con decisión ----------
const EVENTS = {
  tarta: { need: (st) => neighbors(st).some((n) => n.location === 'fuera'), make: (st) => { const n = pick(neighbors(st).filter((q) => q.location === 'fuera')); return { who: n.id, title: 'Llaman a la puerta', text: `${n.name} trae una tarta casera para la familia.`, options: ['Invitar a pasar', 'Darle las gracias'] }; } },
  cartera: { make: () => ({ title: 'Una cartera en la calle', text: 'Alguien de la familia encuentra una cartera con 150 € y un carné.', options: ['Devolverla', 'Quedarse el dinero'] }) },
  extra: { need: (st) => householdSims(st).some((s) => s.job), make: (st) => { const s = pick(householdSims(st).filter((q) => q.job)); return { who: s.id, title: 'Trabajo extra', text: `A ${s.name} le ofrecen un encargo este fin de semana por 250 €. Le dejará agotado/a.`, options: ['Aceptar', 'Rechazar'] }; } },
  loteria: { make: () => ({ title: 'Lotería del barrio', text: '¿Compráis un boleto por 20 €? Dicen que este año toca mucho.', options: ['Comprar un boleto', 'No, gracias'] }) },
  averia: { need: (st) => st.objects.some((o) => OBJECTS[o.type].power), make: (st) => { const o = pick(st.objects.filter((q) => OBJECTS[q.type].power)); return { obj: o.id, title: 'Algo se ha roto', text: `${OBJECTS[o.type].name}: hace un ruido raro y deja de funcionar bien.`, options: ['Llamar al técnico (120 €)', 'Intentar arreglarlo'] }; } },
  gatito: { make: () => ({ title: 'Un gatito en la puerta', text: 'Un gatito callejero maúlla en la entrada. Parece tener hambre.', options: ['Darle de comer', 'Dejarlo estar'] }) },
};
function pickEvent(state) {
  const opts = Object.entries(EVENTS).filter(([, e]) => !e.need || e.need(state));
  if (!opts.length) return null;
  const [id, e] = pick(opts); return { id, ...e.make(state) };
}
export function resolveEvent(state, ev, choice) {
  state.pendingEvent = null;
  const fam = householdSims(state).filter((s) => s.age !== 'bebe');
  const all = (fn) => fam.forEach(fn); const who = state.sims[ev.who];
  if (ev.id === 'tarta') {
    if (choice === 0 && who) { arriveVisitor(state, who, 'entra con la tarta'); fam.forEach((s) => { setRel(state, s, who, 8, 0); s.needs.hambre = clamp(s.needs.hambre + 20); }); }
    else if (who) fam.forEach((s) => setRel(state, s, who, 3, 0));
  } else if (ev.id === 'cartera') {
    if (choice === 0) { all((s) => addMoodlet(s, 'buena_persona')); const n = pick(neighbors(state)); if (n) fam.forEach((s) => setRel(state, s, n, 10, 0)); toast('El dueño era del barrio y está muy agradecido', 'good'); addMemory(state, 'La familia devolvió una cartera perdida', 'heart'); }
    else { state.money += 150; all((s) => addMoodlet(s, 'culpa')); }
  } else if (ev.id === 'extra') {
    if (choice === 0 && who) { state.money += 250; who.needs.energia = clamp(who.needs.energia - 35); who.needs.diversion = clamp(who.needs.diversion - 20); toast(`${who.name} cobra 250 € extra`, 'good', who.id); }
    else if (who) who.needs.diversion = clamp(who.needs.diversion + 10);
  } else if (ev.id === 'loteria') {
    if (choice === 0) {
      if (state.money < 20) return toast('No hay dinero', 'warn');
      state.money -= 20;
      if (Math.random() < 0.05) { state.money += 3000; all((s) => addMoodlet(s, 'premio')); toast('🎉 ¡Os ha tocado la lotería: 3.000 €!', 'good'); addMemory(state, 'Nos tocó la lotería: 3.000 €', 'coin'); }
      else toast('Esta vez no ha tocado', 'info');
    }
  } else if (ev.id === 'averia') {
    if (choice === 0) { state.money -= 120; toast('El técnico lo deja como nuevo (−120 €)', 'info'); }
    else {
      const fixer = fam.filter(isAdult).sort((a, b) => (b.skills?.logica || 0) - (a.skills?.logica || 0))[0];
      const ok = Math.random() < 0.4 + skillLevel(fixer || {}, 'logica') * 0.07;
      if (ok) { toast(`${fixer?.name || 'Alguien'} lo arregla sin gastar nada`, 'good', fixer?.id); if (fixer) gainSkill(state, fixer, 'logica', 0.5); }
      else { state.money -= 60; if (fixer) addMoodlet(fixer, 'frustrado'); toast('Lo empeora y toca comprar piezas (−60 €)', 'bad', fixer?.id); }
    }
  } else if (ev.id === 'gatito') {
    if (choice === 0) { state.money -= 5; all((s) => addMoodlet(s, 'ternura')); addMemory(state, 'Dimos de comer a un gatito callejero', 'heart'); }
  }
}

export function arriveVisitor(state, n, why = 'ha venido de visita') {
  if (n.location === 'casa') return;
  n.location = 'casa'; n.x = EXIT.x; n.y = EXIT.y; n.cur = null; n.queue = []; n.path = [];
  NEEDS.forEach((k) => (n.needs[k] = rnd(60, 95)));
  n.visitUntil = state.time + rnd(180, 300);
  n.nextThink = 0;
  toast(`🔔 ${n.name} ${why}`, 'info', n.id);
}
export function inviteNeighbor(state, id, quiet = false) {
  const n = state.sims[id]; if (!n || n.location === 'casa') return;
  const h = hourOf(state.time);
  if (h >= 22 || h < 8) return quiet ? null : toast(`${n.name} dice que es muy tarde. Mejor mañana.`, 'warn');
  if (getRel(n, state.sims[state.active] || n).a < -30) return toast(`${n.name} no quiere venir`, 'warn');
  n.pendingVisit = state.time + 30;
  toast(`📞 ${n.name} vendrá en un rato`, 'info');
}

function daily(state, offline) {
  if (!state.settings.aging) return;
  for (const s of householdSims(state)) {
    s.ageDays++;
    const def = AGES[s.age];
    if (s.ageDays >= def.days) {
      const next = AGE_ORDER[AGE_ORDER.indexOf(s.age) + 1]; if (!next) continue;
      const prev = s.age; s.age = next; s.ageDays = 0; addMoodlet(s, 'crecer');
      if (prev === 'bebe') {
        s.cribId = null; s.sleeping = false; NEEDS.forEach((n) => (s.needs[n] = s.needs[n] ?? 80));
        s.school = { grade: 60 }; s.crying = false;
        const p = randomFreeTile(state); s.x = p.x; s.y = p.y;
      }
      if (prev === 'nino') { s.school = null; s.worries = s.worries.filter((w) => WORRIES[w].ages.includes('adulto')); }
      const msg = `🎂 ¡${s.name} ha crecido y ahora es ${AGES[next].label.toLowerCase()}!`;
      addMemory(state, `${s.name} cumplió años y pasó a ser ${AGES[next].label.toLowerCase()}`, 'star', [s.id]);
      if (next === 'adulto') { ensureAspiration(s); deliverLetters(state, s.id); }
      toast(msg, 'good', s.id);
      if (offline) state._offlineLog?.push(msg);
    }
  }
}

export function processPendingVisits(state) {
  for (const n of neighbors(state)) if (n.pendingVisit && state.time >= n.pendingVisit) { n.pendingVisit = 0; arriveVisitor(state, n, 'ha llegado'); }
}

// ---------- progreso con la app cerrada ----------
export function offlineProgress(state, ms) {
  // con reloj real pasa el mismo tiempo que en la vida (máx. 3 días); si no, 6 min de juego por minuto real (máx. 2 días)
  const mins = state.settings?.realTime ? Math.min(ms / 60000, 3 * 1440) : Math.min((ms / 1000) * 0.1, 2 * 1440);
  if (mins < 10) return null;
  const startMoney = state.money, startMem = (state.memories || []).length;
  const keep = drainEvents(); const log = []; const seen = new Set(); const letters = [];
  const wasAway = state._away; state._away = true;
  // se simula de verdad: hacen su vida con total autonomía
  let left = mins;
  while (left > 0) {
    const dt = Math.min(2, left); left -= dt; tick(state, dt);
    for (const e of drainEvents()) {
      if (e.type === 'letter') letters.push(e.letter);
      if (e.type !== 'toast' || !['good', 'bad', 'worry'].includes(e.kind)) continue;
      const t = e.msg.replace(/[\p{Extended_Pictographic}]\uFE0F?/gu, '').trim();
      const key = t.replace(/[0-9]+/g, '#'); if (seen.has(key)) continue; seen.add(key); log.push(t);
    }
  }
  state._away = wasAway;
  if (state.settings?.realTime) syncRealTime(state);
  for (const e of keep) events.push(e);
  const newMem = (state.memories || []).slice(0, (state.memories || []).length - startMem).map((m) => m.text);
  if (state.bills.length) log.push(`Hay ${billsTotal(state)} € en facturas pendientes`);
  for (const L of letters) events.push({ type: 'letter', letter: L });
  return { mins, money: state.money - startMoney, log: log.slice(-14), memories: newMem.slice(0, 6) };
}

// ---------- guardado ----------
const KEY = 'vidas_save_v1';
export function save(state) {
  state.lastSaved = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* almacenamiento lleno */ }
}
export function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === SAVE_VERSION) { ensureWalls(s); return s; } } catch (e) { }
  return null;
}
export function wipe() { localStorage.removeItem(KEY); }
