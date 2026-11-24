// Arrecife: cría peces, cuida los acuarios y lleva tu tienda.
import { Engine, THREE, mat, blob, box, canvasTexture } from '../shared/engine3d.js';
import * as Look from '../shared/look.js';
import { $, esc, eur, icon, toast, modal, closeModal, modalOpen, info, confirm, Sheet, store, trash, edgePan, say, pickOne, Sound, avatar } from '../shared/ui.js';
import { autoSync, pullSlot, session as cloudSession } from '../shared/cloud.js';
import { renderCloud, chooseSave } from '../shared/cloudui.js';
import { thumbs, preview } from '../shared/thumbs.js';
import { COLORS, PATTERNS, FINS, TOTAL_COMBOS, DECOS, UPGRADES, SPECIES, MAX_TANKS, TANK_CAP, TANK_PRICE, FISH_NAMES, FISH_TRAITS, CUSTOMERS } from './data.js';

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
// Genes de un animal nuevo del proveedor (rare: huevo sorpresa)
function genesFor(sp, rare = false) {
  if (sp === 'pez') return rare ? { c: ri(COLORS.length), p: ri(PATTERNS.length), f: ri(FINS.length), s: rnd(0.9, 1.2), glow: Math.random() < 0.04 } : commonGenes();
  const S = SPECIES[sp]; return { c: rare ? pick(S.colors) : pick(S.colors.slice(0, 3)), p: rare ? pick(S.pats) : S.pats[0], f: 0, s: rnd(0.85, 1.15), glow: sp === 'medusa' || (rare && Math.random() < 0.04) };
}
const spOf = (f) => f.sp || 'pez';
function addFish(st, tank, g, sex, adult = false, sp = 'pez') {
  const f = { id: 'f' + st.nextId++, tank, g, sex: sex || (Math.random() < 0.5 ? 'm' : 'f'), born: st.time - (adult ? 2000 : 0), adult, health: 100, name: pick(FISH_NAMES), trait: pick(Object.keys(FISH_TRAITS)) };
  if (sp !== 'pez') f.sp = sp;
  st.fish.push(f); discover(st, g, sp); return f;
}
const keyOf = (g, sp = 'pez') => sp === 'pez' ? `${g.c}-${g.p}-${g.f}` : `${sp}:${g.c}-${g.p}`;
function discover(st, g, sp = 'pez') {
  const k = keyOf(g, sp); if (st.discovered.includes(k)) return false;
  st.discovered.push(k);
  if (st.discovered.length > 4) { (st.day ||= []).push({ kind: 'disc', text: speciesName(g, sp) }); toast(`¡Nueva variedad descubierta: ${speciesName(g, sp)}!`, 'good', 'sparkle'); }
  if (st.discovered.length % 10 === 0) { st.money += 150; st.rep += 2; toast(`Álbum: ${st.discovered.length} variedades. Premio de 150 €`, 'good', 'star'); }
  return true;
}
const HAD_LOCAL = !!store.load(KEY);
let st = store.load(KEY) || newShop();
for (const f of st.fish) f.trait ||= pick(Object.keys(FISH_TRAITS));
const fishTrait = (f) => FISH_TRAITS[f.trait]?.[f.sex] || '';
const LOCAL_SAVED_AT = HAD_LOCAL ? st.lastSaved : 0;
// Copia en la nube (cuenta común a toda la app)
const cloud = autoSync('arrecife', () => st);
let swapping = false; // al cambiar a la partida de la nube no se vuelve a guardar la de aquí
function useRemote(state) { swapping = true; store.save(KEY, state); sessionStorage.setItem('cloud_restored', '1'); location.reload(); }
async function afterCloudLogin() { const r = await pullSlot('arrecife'); if (r === undefined) return; if (r) chooseSave(r.savedAt, () => useRemote(r.state), () => cloud.keepLocal()); else cloud.keepLocal(); }
const tankOf = (id) => st.tanks.find((t) => t.id === id);
const fishIn = (t) => st.fish.filter((f) => f.tank === t.id);
const has = (u) => st.upgrades.includes(u);

export function speciesName(g, sp = 'pez') { return sp === 'pez' ? `${FINS[g.f].short} ${PATTERNS[g.p].label} ${COLORS[g.c].label}${g.glow ? ' luminoso' : ''}` : `${SPECIES[sp].label} (${COLORS[g.c].label}${g.p ? ', ' + PATTERNS[g.p].label : ''}${g.glow && sp !== 'medusa' ? ', luminoso' : ''})`; }
function rarity(g, sp = 'pez') { return COLORS[g.c].r * PATTERNS[g.p].r * (sp === 'pez' ? FINS[g.f].r : SPECIES[sp].val) * (g.glow && sp !== 'medusa' ? 4 : 1); }
function tankHappy(t) {
  const n = fishIn(t).length; const deco = t.deco.reduce((s, d) => s + DECOS[d].happy, 0);
  return clamp(30 + Math.min(40, deco) + (has('luces') ? 10 : 0) + (has('luces2') ? 10 : 0) + (t.clean - 50) * 0.3 - Math.max(0, n - 6) * 6);
}
function price(f) { const t = tankOf(f.tank); return Math.round(12 * rarity(f.g, spOf(f)) * f.g.s * (f.adult ? 1 : 0.5) * (0.5 + f.health / 200) * (0.8 + (t ? tankHappy(t) : 50) / 250)); }
const idealTemp = (t) => t.temp >= 23.5 && t.temp <= 27.5;
// Por qué enferman los peces de un acuario (y qué hacer)
function sickWhy(t) { const w = []; if (t.food < 15) w.push('pasan hambre: dales comida'); if (t.clean < 30) w.push('el agua está sucia: límpiala'); if (!idealTemp(t)) w.push(`la temperatura (${t.temp.toFixed(1)} °C) no es buena: ponla entre 24 y 27 °C`); return w; }
const medPrice = () => (has('botiquin') ? 8 : 15);
function medicine(t) {
  if (st.money < medPrice()) return toast('No hay dinero suficiente', 'warn');
  st.money -= medPrice(); t.medUntil = st.time + 360; for (const f of fishIn(t)) f.health = clamp(f.health + 30);
  const why = sickWhy(t); toast(why.length ? `Medicina echada. Ojo: ${why[0]}, o volverán a enfermar` : 'Medicina echada: se recuperarán en unas horas', why.length ? 'warn' : 'good', 'heart'); hud(); save();
}

// ---------- genética ----------
function inherit(a, b, sp = 'pez') {
  const g = { c: pick([a.c, b.c]), p: pick([a.p, b.p]), f: pick([a.f, b.f]), s: clamp((a.s + b.s) / 2 + rnd(-0.08, 0.1), 0.75, 1.4), glow: false };
  const mut = has('luces2') ? 0.2 : has('luces') ? 0.14 : 0.1;
  const S = SPECIES[sp];
  if (Math.random() < mut) g.c = sp === 'pez' ? ri(COLORS.length) : pick(S.colors);
  if (Math.random() < mut) g.p = sp === 'pez' ? ri(PATTERNS.length) : pick(S.pats);
  if (sp === 'pez' && Math.random() < mut * 0.8) g.f = ri(FINS.length);
  if (sp !== 'pez') g.f = 0;
  g.glow = sp === 'medusa' || ((a.glow || b.glow) ? Math.random() < 0.4 : Math.random() < 0.02);
  return g;
}

// ---------- simulación ----------
function tick(dt) {
  st.time += dt;
  const hr = Math.floor(st.time / 60);
  while (st.lastHour < hr) { st.lastHour++; hourly(st.lastHour % 24); }
  for (const t of st.tanks) {
    const fs = fishIn(t); const eat = fs.reduce((n, f) => n + SPECIES[spOf(f)].eat * (f.adult ? 1 : 0.5), 0);
    // los que limpian (gambas, caracoles, cangrejos) hacen que el agua se ensucie menos
    const cleaners = Math.min(0.6, fs.reduce((n, f) => n + (SPECIES[spOf(f)].clean || 0), 0));
    t.clean = clamp(t.clean - 0.0035 * fs.length * dt * (has('filtro') ? 0.5 : 1) * (has('filtro2') ? 0.4 : 1) * (1 - cleaners) + (has('filtro2') ? 0.004 * dt : 0));
    t.food = clamp(t.food - 0.005 * eat * dt * (has('vitaminas') ? 0.6 : 1) * (has('comedero2') ? 0.5 : 1));
    // aparatos automáticos
    if (has('comedero2') && t.food < 70) t.food = 100;
    else if (has('comedero') && t.food < 50 && st.money >= 2) { st.money -= 2; t.food = 95; }
    if (has('robot') && t.clean < 50 && st.money >= 5) { st.money -= 5; t.clean = 100; }
    t.temp += ((has('calefactor') ? 25.5 : 25 + Math.sin(st.time / 400) * 3.5) - t.temp) * 0.01 * dt;
    if (t.breeding && st.time >= t.breeding.until) hatch(t);
  }
  for (const f of st.fish) {
    const t = tankOf(f.tank); if (!t) continue;
    const bad = (t.food < 15 ? 1 : 0) + (t.clean < 30 ? 1 : 0) + (idealTemp(t) ? 0 : 1); const med = t.medUntil && st.time < t.medUntil;
    const resist = (has('botiquin') ? 0.6 : 1) * (has('vitaminas') ? 0.75 : 1);
    f.health = clamp(f.health + (bad ? -0.03 * bad * (med ? 0.3 : 1) * resist : 0.02 * (has('vitaminas') ? 1.6 : 1)) * dt + (med ? 0.06 * dt : 0));
    if (f.health < 40 && !f.warned) { f.warned = true; const why = sickWhy(t); toast(`${f.name} está enfermo/a${why.length ? ': ' + why[0] : ''}. Abre su acuario y dale medicina.`, 'warn', 'alert'); }
    if (f.health > 60) f.warned = false;
    if (!f.adult && st.time - f.born > 720) { f.adult = true; toast(`${f.name} ya es adulto/a`, 'good', 'fish'); }
    if (f.health <= 0) { st.fish = st.fish.filter((q) => q !== f); toast(`${f.name} no ha sobrevivido. Cuida la comida, el agua y la temperatura.`, 'bad', 'fish'); }
  }
}
function hourly(h) {
  if (h % (has('escaparate') ? 2 : 3) === 0 && st.requests.length < (has('escaparate') ? 4 : 3)) newRequest();
  st.requests = st.requests.filter((r) => r.until > st.time);
  if (h >= 9 && h < 21) shopSales();
  if (h === 21) endOfDay();
}
// ---------- venta con precio propio ----------
// Valor de mercado: lo que un cliente pagaría de buena gana (más que el proveedor)
const fairPrice = (f) => Math.max(5, Math.round(price(f) * 1.6));
// Probabilidad por hora de que alguien lo compre según lo caro que lo pongas
function buyChance(f, ask) { const r = ask / fairPrice(f); return Math.max(0, Math.min(0.6, 0.32 * Math.exp(-(r - 0.75) * 2.6))) * (has('escaparate') ? 1.5 : 1) * (1 + Math.min(st.rep, 30) / 60); }
function chanceLabel(c) { return c >= 0.3 ? ['Se venderá enseguida', '#25c48f'] : c >= 0.15 ? ['Se venderá pronto', '#25c48f'] : c >= 0.06 ? ['Tardará un poco', '#f5a524'] : c > 0.015 ? ['Muy caro: tardará mucho', '#e5484d'] : ['Nadie lo pagará', '#e5484d']; }
function shopSales() {
  for (const f of st.fish.filter((q) => q.ask)) {
    if (Math.random() >= buyChance(f, f.ask)) continue;
    const c = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)]; const fair = f.ask <= fairPrice(f) * 1.2;
    st.fish = st.fish.filter((q) => q !== f); selected.delete(f.id); st.money += f.ask; st.sold++; if (fair) st.rep += 0.3;
    toast(`${c.name} ha comprado a ${f.name} por ${eur(f.ask)}`, 'good', 'coin'); logDay('sale', c.name);
  }
}
function newRequest() {
  // a veces piden otra especie (de las que ya se pueden comprar)
  const others = Object.keys(SPECIES).filter((k) => k !== 'pez' && st.rep >= SPECIES[k].rep);
  if (others.length && Math.random() < 0.35) {
    const sp = pick(others), S = SPECIES[sp]; const want = { sp, c: pick(S.colors) }; if (S.pats.length > 1 && Math.random() < 0.4) want.p = pick(S.pats);
    const r = COLORS[want.c].r * (want.p != null ? PATTERNS[want.p].r : 1) * S.val;
    st.requests.push({ id: 'r' + st.nextId++, want, price: Math.round(16 * r * (1.6 + st.rep / 40) * (has('escaparate') ? 1.2 : 1)), until: st.time + 1440, cust: Math.floor(Math.random() * CUSTOMERS.length), who: '' }); const r0 = st.requests.at(-1); r0.who = CUSTOMERS[r0.cust].name; return;
  }
  const want = {}; const n = 1 + (Math.random() < 0.5 ? 1 : 0) + (st.rep > 8 && Math.random() < 0.4 ? 1 : 0);
  const keys = ['c', 'p', 'f'].sort(() => Math.random() - 0.5).slice(0, n);
  for (const k of keys) want[k] = ri(k === 'c' ? COLORS.length : k === 'p' ? PATTERNS.length : FINS.length);
  if (st.rep > 15 && Math.random() < 0.15) want.glow = true;
  const r = (want.c != null ? COLORS[want.c].r : 1.3) * (want.p != null ? PATTERNS[want.p].r : 1.2) * (want.f != null ? FINS[want.f].r : 1.2) * (want.glow ? 4 : 1);
  st.requests.push({ id: 'r' + st.nextId++, want, price: Math.round(18 * r * (1.6 + st.rep / 40) * (has('escaparate') ? 1.2 : 1)), until: st.time + 1440, cust: Math.floor(Math.random() * CUSTOMERS.length), who: '' }); const r0 = st.requests.at(-1); r0.who = CUSTOMERS[r0.cust].name;
}
const matches = (f, w) => f.adult && (w.sp || 'pez') === spOf(f) && (w.c == null || f.g.c === w.c) && (w.p == null || f.g.p === w.p) && (w.f == null || f.g.f === w.f) && (!w.glow || f.g.glow);
function wantText(w) {
  if (w.sp) return `${['gamba', 'medusa'].includes(w.sp) ? 'Una' : 'Un'} ${SPECIES[w.sp].label.toLowerCase()} de color ${COLORS[w.c].label}${w.p != null ? `, ${PATTERNS[w.p].label}` : ''}`;
  const parts = []; if (w.f != null) parts.push(FINS[w.f].label.toLowerCase()); if (w.p != null) parts.push(PATTERNS[w.p].label); if (w.c != null) parts.push(COLORS[w.c].label); if (w.glow) parts.push('luminoso');
  return 'Un pez ' + parts.join(', ');
}
function hatch(t) {
  const a = st.fish.find((f) => f.id === t.breeding.a), b = st.fish.find((f) => f.id === t.breeding.b); t.breeding = null;
  if (!a || !b) return;
  const sp = spOf(a); const room = TANK_CAP - fishIn(t).length; const n = Math.min(room, 2 + ri(has('luces') ? 3 : 2) + (has('incubadora') ? 1 : 0) + (has('luces2') ? 1 : 0));
  if (n <= 0) return toast('No había sitio en el acuario para las crías', 'warn', 'egg');
  const names = [];
  for (let i = 0; i < n; i++) { const g = inherit(a.g, b.g, sp); addFish(st, t.id, g, null, false, sp); names.push(speciesName(g, sp)); }
  logDay('birth', n);
  toast(`¡Han nacido ${n} alevines! ${names.slice(0, 2).join(', ')}${n > 2 ? '…' : ''}`, 'good', 'egg');
}
function logDay(kind, text) { (st.day ||= []).push({ kind, text }); }
// Al cierre: el boletín "Burbujas al día" con lo que ha pasado
function endOfDay() {
  st.rep = Math.max(0, st.rep - 0.2); const ev = st.day || []; st.day = [];
  const births = ev.filter((e) => e.kind === 'birth'), disc = ev.filter((e) => e.kind === 'disc'), sales = ev.filter((e) => e.kind === 'sale');
  let head, body;
  if (disc.length) { head = `Nueva variedad: ${disc[0].text}`; body = `Nunca se había visto en Arrecife. ${disc.length > 1 ? `Y no es la única: ${disc.length} variedades nuevas hoy.` : 'El álbum crece.'}`; }
  else if (births.length) { head = `${births.reduce((t, e) => t + e.text, 0)} alevines nuevos`; body = 'Diminutos y transparentes, ya nadan en grupo cerca del fondo.'; }
  else if (sales.length) { head = `${sales.length} ${sales.length > 1 ? 'clientes salen felices' : 'cliente sale feliz'}`; body = `${sales[0].text} ya presume de pez nuevo.`; }
  else { const f = st.fish.length && pick(st.fish); head = f ? `${f.name}, ${fishTrait(f).toLowerCase()} como siempre` : 'Un día tranquilo'; body = f ? FISH_TRAITS[f.trait].desc : 'El agua está en calma.'; }
  Sound.play('page');
  say('marina', null, `«${pickOne(['El mar enseña paciencia. Mañana, más.', 'Agua limpia, peces tranquilos. Así se hace.', 'Fíjate en cómo nadan: te dicen cómo están.', 'Cada pez tiene su carácter, como las personas.'])}»`, 'Seguir', null,
    `<div class="gazette"><div class="mast">Burbujas al día</div><div class="date">Día ${Math.floor(st.time / 1440) + 1} · ${st.fish.length} animales · ${st.discovered.length}/${TOTAL_COMBOS} variedades</div><h3>${esc(head)}</h3><p>${esc(body)}</p></div>`);
  save();
}
function save() { if (swapping) return; st.lastSaved = Date.now(); store.save(KEY, st); cloud.saved(); }
function offline() {
  const mins = Math.min((Date.now() - st.lastSaved) / 1000 * 0.25, 1440); if (mins < 15) return;
  // pasa el tiempo con cuidado: sin muertes mientras no estás
  let left = mins; const deaths = st.fish.length;
  while (left > 0) { const d = Math.min(5, left); left -= d; tick(d); for (const f of st.fish) f.health = Math.max(25, f.health); for (const t of st.tanks) { t.food = Math.max(10, t.food); t.clean = Math.max(15, t.clean); } }
  say('marina', 'Mientras no estabas…', `<p>Han pasado <b>${Math.round(mins / 60)} h</b> en Arrecife.</p>${st.tanks.some((t) => t.food < 30 || t.clean < 40) ? '<p>Algunos acuarios necesitan comida o limpieza.</p>' : '<p>Los peces están bien.</p>'}${st.requests.length ? `<p>Tienes <b>${st.requests.length}</b> clientes esperando.</p>` : ''}`);
}

// ---------- dibujo 3D ----------
const canvas = $('#stage');
// Tamaño de la tienda: se puede ampliar con el local de al lado (6 m más por nivel, 3 acuarios más)
const RW = 6 * (st.shopLevel || 0), CX = RW / 2;
const maxTanks = () => MAX_TANKS + 3 * (st.shopLevel || 0);
const SHOP_LEVELS = [{ price: 3000, rep: 5 }, { price: 8000, rep: 12 }];
const eng = new Engine(canvas, { target: [CX, 0.8, 0.5], dist: 15, minDist: 2.2, maxDist: 70, bounds: 10 + RW, pitch: 0.55, yaw: 0.35 });
const overviewDist = () => eng.fitDist(13 + RW * 0.85), tankDist = () => eng.fitDist(3.8);
eng.cam.dist = overviewDist();
const S3 = eng.scene;
Look.setupLook(eng, { cx: CX, cz: 0.5, size: 9.5 + RW / 2, height: 16, exposure: 1.05, sunColor: 0xfff0dc, hemiSky: 0xf2f6ff, hemiGround: 0x8a6a4a });
const shadowed = (o, cast = true, recv = true) => Look.shadows(o, cast, recv);
// la tienda está en una calle: acera alrededor, muros bajos delante (vista en corte) y calle que se pierde en la niebla
S3.fog = new THREE.Fog('#e6f2f6', 30, 75);
const street = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshLambertMaterial({ map: Look.pavingTex(60), color: '#d8d4cc' })); street.rotation.x = -Math.PI / 2; street.position.y = -0.21; street.receiveShadow = true; S3.add(street);
for (const [w, d, x, z] of [[16.4 + RW, 0.2, CX, 6.6], [0.2, 12.2, 8.1 + RW, 0.5]]) { const lw = box(w, 0.3, d, '#e4eef0'); lw.position.set(x, 0.05, z); S3.add(lw); const cap = box(w + 0.02, 0.04, d + 0.02, '#3a8fb8'); cap.position.set(x, 0.22, z); S3.add(cap); }
for (let i = 0; i < 10; i++) { const tr = Look.tree(i % 3 ? 'roble' : 'abedul', 1.6 + (i % 3) * 0.3, i); const side = i % 2; tr.position.set(side ? 11 + (i % 4) : -12 + i * 2.6, -0.2, side ? -6 + i * 1.6 : -9.5 - (i % 3)); S3.add(tr); }
const floor = new THREE.Mesh(new THREE.BoxGeometry(16 + RW, 0.2, 12), [mat('#8a5a35'), mat('#8a5a35'), new THREE.MeshLambertMaterial({ map: Look.woodTex([4 + RW / 4, 6], ['#c99a66', '#bb8a56']) }), mat('#6e4528'), mat('#8a5a35'), mat('#8a5a35')]); floor.position.set(CX, -0.1, 0.5); floor.receiveShadow = true; S3.add(floor);
// paredes: zócalo de azulejo y pintura arriba
const wallTex = canvasTexture(256, (x, s) => { x.fillStyle = '#eef6f7'; x.fillRect(0, 0, s, s); for (let i = 0; i < 900; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(80,110,120,0.05)'; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); } }, [4, 1]);
const w1 = new THREE.Mesh(new THREE.BoxGeometry(16 + RW, 4, 0.2), new THREE.MeshLambertMaterial({ map: wallTex, emissive: new THREE.Color('#3a4446') })); w1.position.set(CX, 2, -5.5); S3.add(w1);
const w2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 4, 12), new THREE.MeshLambertMaterial({ map: wallTex, color: '#eef4f6' })); w2.position.set(-8, 2, 0.5); S3.add(w2);
w1.receiveShadow = w2.receiveShadow = true;
const tiles1 = new THREE.Mesh(new THREE.BoxGeometry(16 + RW, 1.1, 0.05), new THREE.MeshLambertMaterial({ map: Look.tileTex([16 + RW, 1], '#f4f8f8', '#c6d4d8') })); tiles1.position.set(CX, 0.55, -5.38); S3.add(tiles1);
const tiles2 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 12), new THREE.MeshLambertMaterial({ map: Look.tileTex([12, 1], '#f4f8f8', '#c6d4d8') })); tiles2.position.set(-7.88, 0.55, 0.5); S3.add(tiles2);
for (const [w, d, x, z] of [[16 + RW, 0.06, CX, -5.35], [0.06, 12, -7.85, 0.5]]) { const t = box(w, 0.06, d, '#3a8fb8'); t.position.set(x, 1.12, z); S3.add(t); const bb = box(w, 0.12, d, '#6e4a2c'); bb.position.set(x, 0.06, z); S3.add(bb); }
// ventana con luz de día
const win = new THREE.Group(); win.position.set(-7.85, 2.3, 2.4);
const glassW = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), new THREE.MeshBasicMaterial({ map: canvasTexture(128, (x, s) => { const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#bfe4fa'); g.addColorStop(0.7, '#e8f6ff'); g.addColorStop(0.71, '#9ccc7a'); g.addColorStop(1, '#7ab05a'); x.fillStyle = g; x.fillRect(0, 0, s, s); x.fillStyle = 'rgba(255,255,255,0.9)'; for (const [cx, cy] of [[30, 30], [90, 20]]) { x.beginPath(); x.ellipse(cx, cy, 18, 7, 0, 0, 7); x.fill(); } }) }));
glassW.rotation.y = Math.PI / 2; win.add(glassW);
for (const [w, h, y, z] of [[0.1, 1.8, 0, 1.35], [0.1, 1.8, 0, -1.35], [0.1, 0.1, 0.85, 0], [0.1, 0.1, -0.85, 0], [0.1, 1.7, 0, 0]]) { const f = box(0.12, h, w === 0.1 && h === 0.1 ? 2.8 : 0.1, '#f4f4f0'); f.position.set(0.02, y, z); win.add(f); }
const sill = box(0.3, 0.06, 2.9, '#f4f4f0'); sill.position.set(0.12, -0.92, 0); win.add(sill); S3.add(win);
// estanterías con productos
function shelfUnit(x, z, rotY = 0) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rotY;
  const sideM = new THREE.MeshLambertMaterial({ map: Look.woodTex([1, 2], ['#f0e6d6', '#e8dcc8']) });
  for (const sx of [-0.9, 0.9]) { const sd = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.2, 0.45), sideM); sd.position.set(sx, 1.1, 0); g.add(sd); }
  const R = Look.seeded(Math.round(x * 10 + z));
  // productos: todas las cajas y botes en dos mallas instanciadas (dos llamadas de dibujo en vez de cien)
  const boxes = [], cans = [];
  for (let i = 0; i < 4; i++) { const sh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.45), sideM); sh.position.set(0, 0.2 + i * 0.6, 0); g.add(sh);
    let px = -0.8; while (px < 0.75) { const w = 0.1 + R() * 0.14, h = 0.15 + R() * 0.25; const c = ['#e5484d', '#2fa8e0', '#f5a524', '#25c48f', '#8b5cf6', '#f4f4f0'][Math.floor(R() * 6)];
      (R() < 0.3 ? cans : boxes).push({ x: px + w / 2, y: 0.22 + i * 0.6 + h / 2, w, h, c }); px += w + 0.03; } }
  for (const [list, geo, d] of [[boxes, new THREE.BoxGeometry(1, 1, 1), 0.22], [cans, new THREE.CylinderGeometry(0.5, 0.5, 1, 10), null]]) {
    const inst = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial(), list.length); const m4 = new THREE.Matrix4();
    list.forEach((it, k) => { m4.compose(new THREE.Vector3(it.x, it.y, 0.02), new THREE.Quaternion(), new THREE.Vector3(it.w, it.h, d ?? it.w)); inst.setMatrixAt(k, m4); inst.setColorAt(k, new THREE.Color(it.c)); });
    g.add(inst);
  }
  return shadowed(g);
}
S3.add(shelfUnit(-5.2, -5.12), shelfUnit(-2.8, -5.12));
// plantas en macetas
function pot(x, z, s = 1) { const g = new THREE.Group(); g.position.set(x, 0, z); const pt = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * s, 0.16 * s, 0.38 * s, 14), mat('#c8704a')); pt.position.y = 0.19 * s; g.add(pt); const b = Look.bush(0.32 * s, Math.round(x * 3 + z), '#2f6e34', '#6aae52'); b.position.y = 0.3 * s; g.add(b); for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, 0.6 * s, 4), mat('#3e8a44')); l.scale.z = 0.2; l.position.set(Math.cos(i) * 0.08 * s, 0.6 * s, Math.sin(i) * 0.08 * s); l.rotation.set(Math.sin(i) * 0.5, i, Math.cos(i) * 0.5); g.add(l); } return shadowed(g); }
S3.add(pot(-7.3, -4.8, 1.3), pot(7.3 + RW, -4.8, 1.1), pot(-7.3, 5.8, 1));
// en la parte ampliada: columna que marca el antiguo muro y otra estantería
if (RW) { const col = box(0.4, 4, 0.4, '#e4eef0'); col.position.set(8, 2, -5.3); S3.add(col); S3.add(shelfUnit(8 + RW - 2.4, -5.12)); }
// alfombra y mostrador con caja registradora
const rug = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.4), new THREE.MeshLambertMaterial({ map: canvasTexture(128, (x, s) => { x.fillStyle = '#2f6f8f'; x.fillRect(0, 0, s, s); x.strokeStyle = '#f2e6c8'; x.lineWidth = 4; x.strokeRect(8, 8, s - 16, s - 16); x.lineWidth = 2; x.strokeRect(16, 16, s - 32, s - 32); for (let i = 0; i < 500; i++) { x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(Math.random() * s, Math.random() * s, 2, 2); } }) }));
rug.rotation.x = -Math.PI / 2; rug.position.set(5, 0.01, 2.6); rug.receiveShadow = true; S3.add(rug);
const counter = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1, 1), new THREE.MeshLambertMaterial({ map: Look.woodTex([2, 1], ['#a8784a', '#9a6c40']) })); counter.position.set(5.2, 0.5, 4.2); S3.add(counter);
const ctop = box(3.4, 0.08, 1.2, '#f4ece0', 0.03); ctop.position.set(5.2, 1.04, 4.2); S3.add(ctop);
const reg = new THREE.Group(); reg.position.set(4.4, 1.08, 4.1); const rb = box(0.5, 0.18, 0.4, '#3a3f55', 0.03); rb.position.y = 0.09; reg.add(rb); const rs = box(0.36, 0.22, 0.04, '#24283a', 0.02); rs.position.set(0, 0.3, -0.1); rs.rotation.x = -0.3; reg.add(rs); const rsc = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.16), mat('#7fe0c0', { emissive: '#2a6a58' })); rsc.position.set(0, 0.305, -0.077); rsc.rotation.x = -0.3; reg.add(rsc); S3.add(reg);
S3.add(shadowed(pot(6.3, 4.1, 0.55)), shadowed(counter));
const sign = box(4, 0.8, 0.08, '#2fa8e0', 0.06); sign.position.set(0, 3.2, -5.35); S3.add(sign);
const signCv = document.createElement('canvas'); signCv.width = 512; signCv.height = 96; { const x = signCv.getContext('2d'); x.fillStyle = '#fff'; x.font = '900 64px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ARRECIFE', 256, 52); }
const signMap = new THREE.CanvasTexture(signCv); signMap.colorSpace = THREE.SRGBColorSpace; document.fonts?.ready.then(() => { const x = signCv.getContext('2d'); x.clearRect(0, 0, 512, 96); x.fillStyle = '#fff'; x.font = '900 64px Nunito, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('ARRECIFE', 256, 52); signMap.needsUpdate = true; eng.dirty = true; });
const signTxt = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 0.69), new THREE.MeshBasicMaterial({ transparent: true, map: signMap }));
signTxt.position.set(0, 3.2, -5.3); signTxt.scale.y = 1; S3.add(signTxt);
// Reflejos de luz en el fondo (cáusticas) y superficie del agua, animados moviendo la textura
const gravel = canvasTexture(256, (x, s) => { x.fillStyle = '#cdb488'; x.fillRect(0, 0, s, s); for (let i = 0; i < 1400; i++) { const r = 1.5 + Math.random() * 3.5; const l = 150 + Math.random() * 90; x.fillStyle = Math.random() < 0.1 ? `rgb(${l * 0.7},${l * 0.75},${l * 0.8})` : `rgb(${l},${l * 0.88},${l * 0.68})`; x.beginPath(); x.ellipse(Math.random() * s, Math.random() * s, r, r * 0.8, Math.random() * 3, 0, 7); x.fill(); x.fillStyle = 'rgba(255,255,255,0.25)'; } }, [3, 1.4]);
const caustic = canvasTexture(128, (x, s) => { x.clearRect(0, 0, s, s); x.strokeStyle = 'rgba(255,255,235,0.6)'; x.lineWidth = 2; for (let i = 0; i < 26; i++) { x.beginPath(); const cx = Math.random() * s, cy = Math.random() * s, r = 6 + Math.random() * 14; for (let k = 0; k <= 6; k++) { const a = k / 6 * Math.PI * 2; const rr = r * (0.7 + Math.random() * 0.5); k ? x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : x.moveTo(cx + rr, cy); } x.stroke(); } }, [2, 1]);
const ripple = canvasTexture(64, (x, s) => { x.fillStyle = 'rgba(180,225,250,0.5)'; x.fillRect(0, 0, s, s); x.strokeStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 10; i++) { x.beginPath(); x.arc(Math.random() * s, Math.random() * s, 4 + Math.random() * 10, 0, 7); x.stroke(); } }, [3, 2]);
const backdrop = canvasTexture(256, (x, s) => { const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, '#1d5f8a'); g.addColorStop(1, '#0e3550'); x.fillStyle = g; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 14; i++) { const px = Math.random() * s, h = s * (0.3 + Math.random() * 0.5); x.strokeStyle = `rgba(40,${110 + Math.random() * 60},90,0.55)`; x.lineWidth = 3 + Math.random() * 5; x.beginPath(); x.moveTo(px, s); x.quadraticCurveTo(px + rnd(-30, 30), s - h / 2, px + rnd(-20, 20), s - h); x.stroke(); }
  for (let i = 0; i < 8; i++) { x.fillStyle = 'rgba(60,70,80,0.6)'; x.beginPath(); x.ellipse(Math.random() * s, s - 6, 20 + Math.random() * 30, 14 + Math.random() * 16, 0, Math.PI, 0); x.fill(); } });
const shaftTex = canvasTexture(64, (x, s) => { const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(255,250,220,0.5)'); g.addColorStop(1, 'rgba(255,250,220,0)'); x.fillStyle = g; x.fillRect(0, 0, s, s); });
const SLOTS = [[-4.5, -2.6], [0, -2.6], [4.5, -2.6], [-4.5, 1.4], [0, 1.4], [4.5, 1.4]];
const TW = 3, TH = 1.5, TD = 1.4, STAND = 0.75;
// Posición de cada acuario en la tienda (se puede mover y girar). r = cuartos de vuelta.
function tankPos(t) { if (t.pos) return t.pos; const i = st.tanks.indexOf(t); const [x, z] = SLOTS[i] || [0, 0]; return { x, z, r: 0 }; }
// Un acuario nuevo va al primer hueco libre (los demás pueden haberse movido)
function placeNewTank() {
  const t = newTank('t' + st.nextId++); st.tanks.push(t);
  const spots = [...SLOTS.map(([x, z]) => ({ x, z, r: 0 }))]; for (let z = -4.5; z <= 5.5; z += 0.5) for (let x = -6; x <= 6.5 + RW; x += 0.5) spots.push({ x, z, r: 0 }, { x, z, r: 1 });
  t.pos = spots.find((p) => tankFits(t, p)) || { x: 0, z: 0, r: 0 };
}
const tankYaw = (t) => tankPos(t).r * Math.PI / 2;
function tankFits(t, p) {
  const odd = p.r % 2, hx = (odd ? TD : TW) / 2 + 0.1, hz = (odd ? TW : TD) / 2 + 0.1;
  if (p.x - hx < -7.85 || p.x + hx > 7.9 + RW || p.z - hz < -5.35 || p.z + hz > 6.4) return false;
  if (p.x + hx > 3.5 && p.x - hx < 6.9 && p.z + hz > 3.55 && p.z - hz < 4.85) return false; // mostrador
  return st.tanks.every((o) => { if (o === t) return true; const q = tankPos(o), oo = q.r % 2, ox = (oo ? TD : TW) / 2 + 0.1, oz = (oo ? TW : TD) / 2 + 0.1; return Math.abs(p.x - q.x) >= hx + ox + 0.2 || Math.abs(p.z - q.z) >= hz + oz + 0.2; });
}
const tankGroups = new Map();
const standMat = new THREE.MeshLambertMaterial({ map: Look.woodTex([1, 1], ['#6e4a2c', '#634226']) }), doorMat = new THREE.MeshLambertMaterial({ map: Look.woodTex([1, 1], ['#7a5232', '#6e4a2c']) });
const patTex = new Map();
function fishTexture(g) {
  const k = `${g.c}-${g.p}`; if (patTex.has(k)) return patTex.get(k);
  const base = COLORS[g.c].hex;
  const t = canvasTexture(128, (x, s) => {
    x.fillStyle = base; x.fillRect(0, 0, s, s);
    if (g.p === 1) { x.fillStyle = 'rgba(20,20,30,0.55)'; for (let i = 0; i < 4; i++) x.fillRect(i * s / 4 + 8, 0, 10, s); }
    if (g.p === 2) { x.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 26; i++) { x.beginPath(); x.arc(Math.random() * s, Math.random() * s * 0.75, 3 + Math.random() * 3, 0, 7); x.fill(); } }
    if (g.p === 3) { const gr = x.createLinearGradient(0, 0, s, 0); gr.addColorStop(0, base); gr.addColorStop(1, COLORS[(g.c + 3) % COLORS.length].hex); x.fillStyle = gr; x.fillRect(0, 0, s, s); }
    // lomo más oscuro, vientre claro, escamas y línea lateral
    let gr = x.createLinearGradient(0, 0, 0, s); gr.addColorStop(0, 'rgba(0,0,20,0.35)'); gr.addColorStop(0.45, 'rgba(0,0,0,0)'); gr.addColorStop(0.62, 'rgba(255,255,255,0.1)'); gr.addColorStop(1, 'rgba(255,255,250,0.55)'); x.fillStyle = gr; x.fillRect(0, 0, s, s);
    x.strokeStyle = 'rgba(255,255,255,0.18)'; x.lineWidth = 1; for (let row = 0; row < 14; row++) for (let col = 0; col < 16; col++) { x.beginPath(); x.arc(col * 8 + (row % 2) * 4, row * 7, 4, 0.2, Math.PI - 0.2); x.stroke(); }
    x.strokeStyle = 'rgba(255,255,255,0.3)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, s * 0.48); x.lineTo(s, s * 0.48); x.stroke();
  });
  patTex.set(k, t); return t;
}
// Cuerpo de pez: esfera que se estrecha hacia la cola y se aplana de lado
let fishGeo = null;
function fishBody() {
  if (fishGeo) return fishGeo;
  const g = new THREE.SphereGeometry(1, 22, 16); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const t = z < 0 ? 1 + z * 0.62 : 1 - z * z * 0.12; x *= t; y *= t * (1 + (y > 0 ? 0.08 : 0)); if (z > 0.6) y -= (z - 0.6) * 0.12; p.setXYZ(i, x, y, z); }
  g.computeVertexNormals(); fishGeo = g; return g;
}
const finGeos = [];
function finGeo(type) { // 0 corta, 1 larga (horquilla), 2 velo
  if (finGeos[type]) return finGeos[type];
  const sh = new THREE.Shape();
  if (type === 0) { sh.moveTo(0, 0); sh.quadraticCurveTo(0.35, 0.25, 0.6, 0.55); sh.quadraticCurveTo(0.45, 0.05, 0.5, 0); sh.quadraticCurveTo(0.45, -0.05, 0.6, -0.55); sh.quadraticCurveTo(0.35, -0.25, 0, 0); }
  else if (type === 1) { sh.moveTo(0, 0); sh.quadraticCurveTo(0.5, 0.3, 1.0, 0.75); sh.lineTo(0.62, 0); sh.lineTo(1.0, -0.75); sh.quadraticCurveTo(0.5, -0.3, 0, 0); }
  else { sh.moveTo(0, 0); sh.bezierCurveTo(0.5, 0.6, 1.2, 1.0, 1.5, 0.6); sh.bezierCurveTo(1.3, 0.2, 1.5, -0.2, 1.4, -0.6); sh.bezierCurveTo(1.1, -1.0, 0.5, -0.6, 0, 0); }
  const geo = new THREE.ShapeGeometry(sh, 10); geo.rotateY(Math.PI / 2); finGeos[type] = geo; return geo;
}
// ---------- otras especies ----------
function bodyMat(f, opts = {}) { return new THREE.MeshLambertMaterial({ map: fishTexture(f.g), transparent: !f.adult || !!opts.opacity, opacity: opts.opacity ?? (f.adult ? 1 : 0.82), side: opts.side ?? THREE.FrontSide, depthWrite: !opts.opacity, emissive: f.g.glow ? new THREE.Color(COLORS[f.g.c].hex).multiplyScalar(opts.glow ?? 0.55) : new THREE.Color(0) }); }
const tint = (hex, k) => new THREE.Color(hex).lerp(new THREE.Color(k > 0 ? '#ffffff' : '#000000'), Math.abs(k));
function eyesOn(g, s, pts) { for (const [x, y, z] of pts) { const e = new THREE.Mesh(new THREE.SphereGeometry(s * 0.09, 8, 6), mat('#111')); e.position.set(x, y, z); g.add(e); const hl = new THREE.Mesh(new THREE.SphereGeometry(s * 0.03, 5, 4), mat('#ffffff', { emissive: '#ffffff' })); hl.position.set(x + s * 0.02, y + s * 0.03, z + s * 0.06); g.add(hl); } }
function critterMesh(f) {
  const sp = spOf(f), g = new THREE.Group(); const s = 0.13 * f.g.s * (f.adult ? 1 : 0.6); const col = COLORS[f.g.c].hex;
  const tail = new THREE.Group(); let anim = () => {}; let gy = 0.2;
  const add = (o, x = 0, y = 0, z = 0, parent = g) => { o.position.set(x, y, z); parent.add(o); return o; };
  if (sp === 'gamba') {
    const m = bodyMat(f, { opacity: 0.88 }); const segs = [];
    for (let i = 0; i < 6; i++) { const a = i / 5; const seg = add(new THREE.Mesh(new THREE.SphereGeometry(s * (0.32 - a * 0.14), 10, 8), m), 0, s * (0.15 - a * a * 0.5), s * (0.55 - a * 1.25)); seg.scale.set(0.85, 0.8, 1.15); segs.push(seg); }
    const ros = add(new THREE.Mesh(new THREE.ConeGeometry(s * 0.06, s * 0.4, 5), m), 0, s * 0.2, s * 0.95); ros.rotation.x = Math.PI / 2;
    const ant = mat(tint(col, -0.3).getStyle()); for (const sd of [-1, 1]) { const a = add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.008, s * 0.012, s * 2.2, 3), ant), sd * s * 0.08, s * 0.55, s * 1.6); a.rotation.set(1.1, 0, sd * 0.35); }
    eyesOn(g, s, [[-s * 0.13, s * 0.3, s * 0.72], [s * 0.13, s * 0.3, s * 0.72]]);
    const legs = []; for (let i = 0; i < 5; i++) for (const sd of [-1, 1]) { const l = add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.012, s * 0.012, s * 0.32, 3), ant), sd * s * 0.12, -s * 0.15, s * (0.5 - i * 0.18)); l.rotation.z = sd * 0.5; legs.push(l); }
    tail.position.set(0, -s * 0.25, -s * 0.75); g.add(tail); const fan = new THREE.Mesh(finGeo(0), new THREE.MeshLambertMaterial({ color: tint(col, 0.2), side: THREE.DoubleSide, transparent: true, opacity: 0.85 })); fan.scale.setScalar(s * 0.5); fan.rotation.x = 0.5; tail.add(fan);
    gy = 0.14 + s * 0.35; anim = (t, mv) => { legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 14 + i) * (mv ? 0.5 : 0.1))); tail.rotation.x = Math.sin(t * 3) * 0.15; };
  } else if (sp === 'caracol') {
    const foot = add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.5, 12, 8), mat('#d9c7a6')), 0, s * 0.12, s * 0.1); foot.scale.set(0.55, 0.32, 1.5);
    const shellM = bodyMat(f); const shell = new THREE.Group(); shell.position.set(0, s * 0.42, -s * 0.15); g.add(shell);
    for (let i = 0; i < 16; i++) { const a = i * 0.62, r = s * 0.34 * Math.exp(-i * 0.1); const b = new THREE.Mesh(new THREE.SphereGeometry(r * 0.78, 10, 8), shellM); b.position.set(i * s * 0.008, Math.sin(a) * r * 0.75, Math.cos(a) * r * 0.75); shell.add(b); }
    const stalks = []; for (const sd of [-1, 1]) { const st2 = new THREE.Group(); st2.position.set(sd * s * 0.1, s * 0.2, s * 0.75); g.add(st2); const c = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.025, s * 0.035, s * 0.4, 5), mat('#cbb894')); c.position.y = s * 0.2; st2.add(c); const e = new THREE.Mesh(new THREE.SphereGeometry(s * 0.05, 6, 5), mat('#222')); e.position.y = s * 0.42; st2.add(e); st2.rotation.x = 0.4; stalks.push(st2); }
    gy = 0.13; anim = (t) => { stalks.forEach((q, i) => (q.rotation.z = Math.sin(t * 1.5 + i * 2) * 0.25)); foot.scale.z = 1.5 + Math.sin(t * 2) * 0.08; };
  } else if (sp === 'cangrejo') {
    const m = bodyMat(f); const body = add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.5, 14, 10), m), 0, s * 0.3, 0); body.scale.set(1.4, 0.55, 1);
    const lm = mat(tint(col, -0.15).getStyle()); const legs = [];
    for (let i = 0; i < 4; i++) for (const sd of [-1, 1]) { const hip = new THREE.Group(); hip.position.set(sd * s * 0.55, s * 0.25, s * (0.25 - i * 0.18)); g.add(hip); const up = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.035, s * 0.03, s * 0.4, 4), lm); up.position.set(sd * s * 0.15, s * 0.08, 0); up.rotation.z = sd * -1.0; hip.add(up); const lo = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.03, s * 0.012, s * 0.4, 4), lm); lo.position.set(sd * s * 0.38, -s * 0.08, 0); lo.rotation.z = sd * 0.5; hip.add(lo); legs.push(hip); }
    const claws = []; for (const sd of [-1, 1]) { const arm = new THREE.Group(); arm.position.set(sd * s * 0.4, s * 0.3, s * 0.4); g.add(arm); const a = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.05, s * 0.06, s * 0.35, 5), lm); a.rotation.set(Math.PI / 2 - 0.3, 0, sd * 0.5); a.position.set(sd * s * 0.06, 0, s * 0.12); arm.add(a); const cl = new THREE.Mesh(new THREE.SphereGeometry(s * 0.17, 10, 8), m); cl.scale.set(0.8, 0.6, 1.2); cl.position.set(sd * s * 0.14, s * 0.04, s * 0.38); arm.add(cl); const pin = new THREE.Mesh(new THREE.ConeGeometry(s * 0.05, s * 0.22, 4), lm); pin.rotation.x = Math.PI / 2; pin.position.set(sd * s * 0.14, s * 0.1, s * 0.56); arm.add(pin); claws.push(pin); }
    for (const sd of [-1, 1]) { const st2 = add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 0.2, 4), lm), sd * s * 0.14, s * 0.5, s * 0.38); st2.rotation.x = 0.2; }
    eyesOn(g, s, [[-s * 0.14, s * 0.62, s * 0.4], [s * 0.14, s * 0.62, s * 0.4]]);
    gy = 0.13; anim = (t, mv) => { legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 16 + i * 1.3) * (mv ? 0.45 : 0.05))); claws.forEach((c, i) => (c.rotation.z = Math.sin(t * 2 + i) * 0.3)); };
  } else if (sp === 'globo') {
    const m = bodyMat(f); const body = add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.55, 16, 12), m)); body.scale.set(0.9, 0.85, 1.05);
    const spk = mat(tint(col, 0.35).getStyle()); const spikes = new THREE.Group(); body.add(spikes);
    for (let i = 0; i < 34; i++) { const y = 1 - (i + 0.5) / 34 * 2, r = Math.sqrt(1 - y * y), a = i * 2.4; const n = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r); const c = new THREE.Mesh(new THREE.ConeGeometry(s * 0.035, s * 0.14, 4), spk); c.position.copy(n).multiplyScalar(s * 0.55); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); spikes.add(c); }
    tail.position.z = -s * 0.55; g.add(tail); const tf = new THREE.Mesh(finGeo(0), new THREE.MeshLambertMaterial({ color: tint(col, 0.15), transparent: true, opacity: 0.75, side: THREE.DoubleSide })); tf.scale.setScalar(s * 0.5); tail.add(tf);
    eyesOn(g, s * 1.5, [[-s * 0.3, s * 0.18, s * 0.38], [s * 0.3, s * 0.18, s * 0.38]]);
    const mouth = add(new THREE.Mesh(new THREE.TorusGeometry(s * 0.06, s * 0.025, 5, 10), mat(tint(col, -0.3).getStyle())), 0, -s * 0.05, s * 0.57);
    let puff = 0, nextPuff = 4 + Math.random() * 10; gy = 0.5;
    anim = (t) => { if (t > nextPuff) { puff = t; nextPuff = t + 10 + Math.random() * 20; } const k = puff && t - puff < 3 ? Math.sin(Math.min(1, (t - puff) / 3) * Math.PI) : 0; body.scale.set(0.9 + k * 0.5, 0.85 + k * 0.55, 1.05 + k * 0.35); spikes.scale.setScalar(1 + k * 0.4); };
  } else if (sp === 'caballito') {
    const m = bodyMat(f); const body = new THREE.Group(); g.add(body);
    for (let i = 0; i < 9; i++) { const a = i / 8; const sph = new THREE.Mesh(new THREE.SphereGeometry(s * (0.3 - a * 0.17), 10, 8), m); sph.position.set(0, s * (0.4 - a * 1.8), s * (Math.sin(a * Math.PI) * 0.28 - 0.1)); sph.scale.set(0.8, 1.15, 1); body.add(sph); }
    const curl = new THREE.Mesh(new THREE.TorusGeometry(s * 0.17, s * 0.055, 6, 14, Math.PI * 1.5), m); curl.rotation.y = Math.PI / 2; curl.position.set(0, -s * 1.52, s * 0.05); body.add(curl);
    const head = new THREE.Mesh(new THREE.SphereGeometry(s * 0.24, 12, 10), m); head.position.set(0, s * 0.72, s * 0.12); head.scale.set(0.8, 0.9, 1.1); body.add(head);
    const snout = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.05, s * 0.07, s * 0.42, 6), m); snout.rotation.x = Math.PI / 2 + 0.35; snout.position.set(0, s * 0.64, s * 0.42); body.add(snout);
    for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(s * 0.04, s * 0.14, 4), m); c.position.set(0, s * (0.95 - i * 0.04), s * (0.04 - i * 0.08)); body.add(c); }
    eyesOn(body, s, [[-s * 0.16, s * 0.76, s * 0.2], [s * 0.16, s * 0.76, s * 0.2]]);
    tail.position.set(0, -s * 0.1, -s * 0.3); body.add(tail); const fin = new THREE.Mesh(finGeo(0), new THREE.MeshLambertMaterial({ color: tint(col, 0.35), transparent: true, opacity: 0.7, side: THREE.DoubleSide })); fin.scale.setScalar(s * 0.45); fin.rotation.y = Math.PI; tail.add(fin);
    g.scale.setScalar(0.85); gy = 0.6; anim = (t) => { tail.rotation.y = Math.sin(t * 18) * 0.5; body.rotation.x = Math.sin(t * 0.8) * 0.08; curl.rotation.z = Math.sin(t * 0.7) * 0.15; };
  } else if (sp === 'medusa') {
    const c = new THREE.Color(col); const bell = new THREE.Mesh(new THREE.SphereGeometry(s * 0.6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: c, emissive: c.clone().multiplyScalar(0.45), transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }));
    bell.scale.y = 0.8; g.add(bell);
    const core = add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.28, 10, 8), new THREE.MeshLambertMaterial({ color: tint(col, 0.5), emissive: c.clone().multiplyScalar(0.6) })), 0, s * 0.12, 0); core.scale.y = 0.6;
    const tm = new THREE.MeshLambertMaterial({ color: tint(col, 0.3), emissive: c.clone().multiplyScalar(0.35), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }); const tents = [];
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; const pv = new THREE.Group(); pv.position.set(Math.cos(a) * s * 0.5, 0, Math.sin(a) * s * 0.5); g.add(pv); const tn = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.012, s * 0.004, s * 1.8, 3), tm); tn.position.y = -s * 0.9; pv.add(tn); tents.push(pv); }
    for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; const pv = new THREE.Group(); pv.position.set(Math.cos(a) * s * 0.1, 0, Math.sin(a) * s * 0.1); g.add(pv); const arm = new THREE.Mesh(new THREE.PlaneGeometry(s * 0.12, s * 1.0, 1, 6), tm); const p2 = arm.geometry.attributes.position; for (let k = 0; k < p2.count; k++) p2.setX(k, p2.getX(k) + Math.sin(p2.getY(k) * 30) * s * 0.04); arm.position.y = -s * 0.5; arm.rotation.y = a; pv.add(arm); tents.push(pv); }
    gy = 0.8; anim = (t) => { const k = Math.max(0, Math.sin(t * 2.2)); bell.scale.set(1 - k * 0.15, 0.8 + k * 0.15, 1 - k * 0.15); tents.forEach((q, i) => { q.rotation.x = Math.sin(t * 1.4 + i) * 0.18; q.rotation.z = Math.cos(t * 1.1 + i * 0.7) * 0.18; }); };
  }
  g.userData.fish = f.id; g.traverse((o) => { o.userData.fish = f.id; o.castShadow = false; });
  const mode = SPECIES[sp].move; const low = mode === 'bottom' || mode === 'crawl';
  return { g, tail, anim, kind: sp, mode, gy, x: rnd(-1, 1), y: low ? gy : rnd(0.4, 1.0), z: rnd(-0.4, 0.4), tx: 0, ty: low ? gy : 0.6, tz: 0, sp: { bottom: 0.18, crawl: 0.035, upright: 0.09, drift: 0.07, swim: 0.3 }[mode] * rnd(0.8, 1.2) };
}
function fishMesh(f) {
  if (spOf(f) !== 'pez') return critterMesh(f);
  const g = new THREE.Group(); const s = 0.13 * f.g.s * (f.adult ? 1 : 0.55);
  const m = new THREE.MeshLambertMaterial({ map: fishTexture(f.g), transparent: !f.adult, opacity: f.adult ? 1 : 0.82, emissive: f.g.glow ? new THREE.Color(COLORS[f.g.c].hex).multiplyScalar(0.55) : new THREE.Color(0) });
  const body = new THREE.Mesh(fishBody(), m); body.scale.set(s * 0.5, s * 0.78, s * 1.4); g.add(body);
  const finM = new THREE.MeshLambertMaterial({ color: new THREE.Color(COLORS[f.g.c].hex).lerp(new THREE.Color('#ffffff'), 0.15), transparent: true, opacity: 0.72, side: THREE.DoubleSide, emissive: m.emissive, depthWrite: false });
  const tl = [0.9, 1.25, 1.5][f.g.f];
  const tailPivot = new THREE.Group(); tailPivot.position.z = -s * 1.25; g.add(tailPivot);
  const tail = new THREE.Mesh(finGeo(f.g.f), finM); tail.scale.setScalar(s * tl * 0.9); tailPivot.add(tail);
  const dorsal = new THREE.Mesh(finGeo(f.g.f === 2 ? 2 : 0), finM); dorsal.scale.set(s * 0.7, s * 0.55 * tl, s * 0.7 * tl); dorsal.rotation.x = Math.PI / 2 - 0.45; dorsal.position.set(0, s * 0.7, s * 0.3); g.add(dorsal);
  const anal = new THREE.Mesh(finGeo(0), finM); anal.scale.setScalar(s * 0.4 * tl); anal.rotation.x = -Math.PI / 2 + 0.6; anal.position.set(0, -s * 0.6, -s * 0.5); g.add(anal);
  const eyeR = f.adult ? 0.13 : 0.24;
  for (const sd of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(s * eyeR * 1.3, 10, 8), mat('#f8f4e8')); w.position.set(sd * s * 0.36, s * 0.18, s * 0.9); g.add(w);
    const e = new THREE.Mesh(new THREE.SphereGeometry(s * eyeR, 10, 8), mat('#111')); e.position.set(sd * s * 0.43, s * 0.18, s * 0.96); g.add(e);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(s * eyeR * 0.3, 6, 4), mat('#ffffff', { emissive: '#ffffff' })); hl.position.set(sd * s * 0.47, s * 0.24, s * 1.0); g.add(hl);
  }
  // aletas laterales que se mueven al nadar
  const pects = [-1, 1].map((sd) => { const pv = new THREE.Group(); pv.position.set(sd * s * 0.42, -s * 0.18, s * 0.35); const fin = new THREE.Mesh(finGeo(0), finM); fin.scale.setScalar(s * 0.45); fin.rotation.y = sd * 0.6; fin.rotation.z = sd * 0.4; pv.add(fin); g.add(pv); return pv; });
  g.userData.fish = f.id; g.traverse((o) => { o.userData.fish = f.id; o.castShadow = false; });
  return { g, tail: tailPivot, pects, kind: 'pez', mode: 'swim', x: rnd(-1, 1), y: f.adult ? rnd(0.3, 1.1) : rnd(0.2, 0.5), z: rnd(-0.4, 0.4), tx: 0, ty: 0.6, tz: 0, sp: f.adult ? rnd(0.25, 0.5) : rnd(0.18, 0.3) };
}
const tid = (t) => t.id;
// hoja de planta acuática: cinta que se estrecha y se curva
const leafCache = new Map();
function leafGeo(h, k) { const key = h.toFixed(2) + (k % 3); if (leafCache.has(key)) return leafCache.get(key); const g = new THREE.PlaneGeometry(0.06, h, 1, 8); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i) + h / 2, t = y / h; p.setX(i, p.getX(i) * (1 - t * 0.85)); p.setY(i, y); p.setZ(i, t * t * 0.12 * (k % 2 ? 1 : -1)); } g.computeVertexNormals(); leafCache.set(key, g); return g; }
const tone = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
const lighten = (c, k) => '#' + new THREE.Color(c).lerp(new THREE.Color('#ffffff'), k).getHexString();
// Color elegido de una decoración (índice en su paleta)
const decoColor = (type, ci = 0) => { const p = DECOS[type]?.colors; return p ? (p[ci] || p[0])[1] : '#888888'; };
function decoMesh(type, i, pos, ci = 0) {
  const g = new THREE.Group(); const x = pos ? pos[0] : -1.1 + (i % 5) * 0.55, z = pos ? pos[1] : -0.35 + (i % 2) * 0.3; g.position.set(x, 0.12, z);
  const C = decoColor(type, ci);
  if (type === 'planta') { g.userData.sway = []; for (let k = 0; k < 9; k++) { const pv = new THREE.Group(); const a = k / 9 * Math.PI * 2; pv.position.set(Math.cos(a) * 0.05, 0, Math.sin(a) * 0.04); const l = new THREE.Mesh(leafGeo(0.5 + (k % 4) * 0.12, k), mat(k % 3 ? C : lighten(C, 0.25), { side: THREE.DoubleSide })); l.rotation.y = a; pv.add(l); pv.rotation.z = Math.cos(a) * 0.18; pv.rotation.x = Math.sin(a) * 0.18; pv.userData.base = pv.rotation.z; g.add(pv); g.userData.sway.push(pv); } }
  if (type === 'roca') for (let k = 0; k < 3; k++) { const r = Look.rock(0.09 + k * 0.035, k === 1 ? tone(C, 0.85) : C, k + 3); r.position.x = k * 0.13 - 0.13; r.position.z = (k % 2) * 0.08; r.rotation.y = k * 1.7; g.add(r); }
  if (type === 'castillo') { const b = box(0.35, 0.35, 0.3, C); b.position.y = 0.17; g.add(b); const door = box(0.1, 0.14, 0.02, '#2a2a34'); door.position.set(0, 0.07, 0.15); g.add(door); for (const sx of [-0.15, 0.15]) { const tw = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 8), mat(tone(C, 0.94))); tw.position.set(sx, 0.25, 0); g.add(tw); const c = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.15, 8), mat(ci === 3 ? '#3a5a9a' : ci === 1 ? '#a04a7a' : '#c05a4a')); c.position.set(sx, 0.57, 0); g.add(c); } }
  if (type === 'cofre') { const b = box(0.3, 0.16, 0.2, C, 0.02); b.position.y = 0.08; g.add(b); const band = box(0.31, 0.03, 0.21, '#c9a24a'); band.position.y = 0.12; g.add(band); const lid = box(0.3, 0.06, 0.2, lighten(C, 0.12)); lid.position.set(0, 0.2, -0.05); lid.rotation.x = -0.6; g.add(lid); const gold = box(0.24, 0.05, 0.14, '#f5c842'); gold.position.y = 0.17; g.add(gold); }
  if (type === 'burbujas') { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.12, 8), mat(C, { emissive: ci === 1 ? '#3a2a00' : undefined })); b.position.y = 0.06; g.add(b); const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.03, 8), mat(lighten(C, 0.3))); lid.position.y = 0.135; g.add(lid); g.userData.bubbles = true; }
  if (type === 'coral') { const col = mat(C); const seed = Look.seeded(i * 7 + 3); const branch = (parent, len, r, depth, rz, ry) => { const b = new THREE.Group(); b.rotation.set(0, ry, rz); parent.add(b); const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, len, 6), col); c.position.y = len / 2; b.add(c); const tip = new THREE.Mesh(new THREE.SphereGeometry(r * 0.75, 6, 5), col); tip.position.y = len; b.add(tip); if (depth > 0) { const nb = new THREE.Group(); nb.position.y = len * 0.85; b.add(nb); for (let k = 0; k < 2; k++) branch(nb, len * 0.72, r * 0.72, depth - 1, (k ? 1 : -1) * (0.45 + seed() * 0.3), seed() * 3); } }; for (let k = 0; k < 3; k++) branch(g, 0.14, 0.03, 2, (k - 1) * 0.35, k * 2); }
  if (type === 'barco') { const hull = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat(C, { side: THREE.DoubleSide })); hull.scale.set(1, 0.45, 0.42); hull.position.y = 0.13; hull.rotation.set(0, 0.25, 0.18); g.add(hull); const deck = box(0.6, 0.02, 0.28, tone(C, 1.15)); deck.position.y = 0.12; deck.rotation.set(0, 0.25, 0.18); g.add(deck); const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.5, 6), mat(tone(C, 0.8))); mast.position.set(0.04, 0.34, 0); mast.rotation.z = -0.5; g.add(mast); const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.22), mat('#d8d0bc', { side: THREE.DoubleSide, opacity: 0.85 })); sail.position.set(0.14, 0.38, 0.01); sail.rotation.z = -0.5; g.add(sail); for (let k = 0; k < 4; k++) { const weed = new THREE.Mesh(leafGeo(0.18 + k * 0.04, k), mat('#4a8a4a', { side: THREE.DoubleSide })); weed.position.set(-0.2 + k * 0.12, 0.12, 0.1); g.add(weed); } }
  if (type === 'anfora') { const amp = new THREE.Group(); const pts = [[0, 0], [0.05, 0.01], [0.09, 0.06], [0.1, 0.14], [0.07, 0.24], [0.035, 0.29], [0.04, 0.33], [0.045, 0.34]].map(([a, b]) => new THREE.Vector2(a, b)); amp.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 14), mat(C, { side: THREE.DoubleSide }))); for (const sd of [-1, 1]) { const h = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 10, Math.PI), mat(tone(C, 0.9))); h.position.set(sd * 0.05, 0.26, 0); h.rotation.z = sd * -Math.PI / 2; amp.add(h); } amp.rotation.z = 1.3; amp.position.set(0.14, 0.09, 0); g.add(amp); }
  if (type === 'concha') { const sh = mat(C, { side: THREE.DoubleSide }); for (const [rx, y] of [[-0.25, 0.02], [-0.95, 0.04]]) { const half = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), sh); half.scale.set(1, 0.35, 0.85); half.rotation.x = rx === -0.25 ? Math.PI : rx; half.position.set(0, rx === -0.25 ? 0.05 : 0.07, rx === -0.25 ? 0 : -0.06); g.add(half); } const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#fbf6ee', { emissive: '#3a3630' })); pearl.position.set(0, 0.07, 0.02); g.add(pearl); }
  if (type === 'estrella') { const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2, r = k % 2 ? 0.05 : 0.14; const px = Math.cos(a) * r, py = Math.sin(a) * r; k ? sh.lineTo(px, py) : sh.moveTo(px, py); } const st2 = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 1 }), mat(C)); st2.rotation.x = -Math.PI / 2; st2.position.y = 0.02; g.add(st2); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const d = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), mat(lighten(C, 0.5))); d.position.set(Math.cos(a) * 0.07, 0.07, -Math.sin(a) * 0.07); g.add(d); } }
  return g;
}
function buildTank(t, i) {
  const p = tankPos(t); const g = new THREE.Group(); g.position.set(p.x, 0, p.z); g.rotation.y = tankYaw(t); g.userData.tank = t.id; S3.add(g);
  const stand = new THREE.Mesh(new THREE.BoxGeometry(TW + 0.2, STAND, TD + 0.2), standMat); stand.position.y = STAND / 2; stand.castShadow = true; stand.receiveShadow = true; g.add(stand);
  for (const sx of [-0.75, 0.75]) { const door = box(1.35, STAND - 0.16, 0.02, '#5a3a22'); door.position.set(sx, STAND / 2, TD / 2 + 0.105); door.material = doorMat; g.add(door); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#d8c8a0')); kn.position.set(sx + (sx < 0 ? 0.55 : -0.55), STAND / 2, TD / 2 + 0.13); g.add(kn); }
  const inner = new THREE.Group(); inner.position.y = STAND + 0.02; g.add(inner);
  const sandSide = new THREE.MeshLambertMaterial({ map: gravel }); const sand = new THREE.Mesh(new THREE.BoxGeometry(TW - 0.06, 0.12, TD - 0.06), [sandSide, sandSide, sandSide, sandSide, sandSide, sandSide]); sand.position.y = 0.06; inner.add(sand);
  const caus = new THREE.Mesh(new THREE.PlaneGeometry(TW - 0.08, TD - 0.08), new THREE.MeshBasicMaterial({ map: caustic, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.55 })); caus.rotation.x = -Math.PI / 2; caus.position.y = 0.125; inner.add(caus);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(TW - 0.06, TH - 0.1), new THREE.MeshBasicMaterial({ map: backdrop })); back.position.set(0, TH / 2, -TD / 2 + 0.035); inner.add(back);
  for (let k = 0; k < 3; k++) { const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.35 + k * 0.1, TH - 0.2), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: has('luces') ? 0.5 : 0.28, side: THREE.DoubleSide })); sh.position.set(-0.8 + k * 0.8, TH / 2, -0.1 + k * 0.12); sh.rotation.z = 0.12 - k * 0.08; inner.add(sh); }
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(TW - 0.08, TD - 0.08), new THREE.MeshLambertMaterial({ map: ripple, transparent: true, opacity: 0.55, depthWrite: false })); surface.rotation.x = -Math.PI / 2; surface.position.y = TH - 0.11; inner.add(surface);
  const water = new THREE.Mesh(new THREE.BoxGeometry(TW - 0.06, TH - 0.15, TD - 0.06), new THREE.MeshLambertMaterial({ color: 0x5ab4e8, transparent: true, opacity: 0.28, depthWrite: false })); water.position.y = (TH - 0.15) / 2 + 0.04; inner.add(water);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(TW, TH, TD), new THREE.MeshLambertMaterial({ color: 0xdff2fa, transparent: true, opacity: 0.12, depthWrite: false })); glass.position.y = TH / 2; inner.add(glass); glass.material = glass.material.clone();
  const rim = box(TW + 0.04, 0.06, TD + 0.04, '#1e2232'); rim.position.y = TH; inner.add(rim);
  const base = box(TW + 0.04, 0.05, TD + 0.04, '#1e2232'); base.position.y = 0.0; inner.add(base);
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const c = box(0.035, TH, 0.035, '#1e2232'); c.position.set(cx * TW / 2, TH / 2, cz * TD / 2); inner.add(c); }
  const shine = new THREE.Mesh(new THREE.PlaneGeometry(0.12, TH * 0.85), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthWrite: false })); shine.position.set(-TW / 2 + 0.35, TH / 2, TD / 2 + 0.005); shine.rotation.z = -0.25; inner.add(shine);
  const lamp = box(TW * 0.9, 0.06, 0.25, has('luces') ? '#ffe8a0' : '#3a3f55'); lamp.position.y = TH + 0.06; inner.add(lamp);
  g.add(blob(TW + 0.8, TD + 0.8, 0.35));
  const rec = { g, inner, water, glass, fish: new Map(), deco: new THREE.Group(), bubbles: [], sig: '' }; inner.add(rec.deco);
  tankGroups.set(t.id, rec); eng.shadowsDirty?.(); return rec;
}
function syncTanks(t0) {
  const seen = new Set();
  st.tanks.forEach((t, i) => {
    seen.add(t.id); let rec = tankGroups.get(t.id) || buildTank(t, i);
    if (!(tmv && tmv.kind === 'tank' && tmv.t === t)) { const p = tankPos(t); rec.g.position.set(p.x, 0, p.z); rec.g.rotation.y = tankYaw(t); }
    const dsig = t.deco.join(',') + JSON.stringify(t.dp || []) + JSON.stringify(t.dc || []);
    if (dsig !== rec.sig) {
      rec.sig = dsig; rec.deco.clear(); rec.bubbles = [];
      t.deco.forEach((d, k) => { const m = decoMesh(d, k, t.dp && t.dp[k], (t.dc && t.dc[k]) || 0); m.userData.deco = t.id + ':' + k; rec.deco.add(m); if (m.userData.bubbles) for (let b = 0; b < 6; b++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), mat('#e8f6ff', { opacity: 0.7 })); s.userData.o = b / 6; s.userData.x = m.position.x; s.userData.z = m.position.z; rec.deco.add(s); rec.bubbles.push(s); } });
    }
    // huevos (cuando hay puesta): un racimo junto a la primera planta o en un rincón
    if (t.breeding && !rec.eggs) {
      const eg = new THREE.Group(); const plant = rec.deco.children.find((c) => c.userData.sway);
      eg.position.set(plant ? plant.position.x + 0.12 : -TW / 2 + 0.4, plant ? 0.35 : 0.16, plant ? plant.position.z + 0.05 : -TD / 2 + 0.3);
      const em = new THREE.MeshLambertMaterial({ color: 0xffb070, transparent: true, opacity: 0.85, emissive: 0x402010 }); const dot = mat('#3a2010');
      for (let k = 0; k < 16; k++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), em); e.position.set(rnd(-0.07, 0.07), rnd(-0.08, 0.08), rnd(-0.04, 0.04)); const d = new THREE.Mesh(new THREE.SphereGeometry(0.006, 5, 4), dot); d.position.z = 0.015; e.add(d); e.userData.eggs = tid(t); eg.add(e); }
      eg.userData.eggs = t.id; rec.inner.add(eg); rec.eggs = eg;
    }
    if (!t.breeding && rec.eggs) { rec.inner.remove(rec.eggs); rec.eggs = null; }
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
// Al dar de comer: bolitas que caen y los peces suben a por ellas (los glotones, los primeros)
function feedFx(tid) {
  const rec = tankGroups.get(tid); if (!rec) return; rec.feedT = performance.now() / 1000; Sound.play('pop');
  for (const [, m] of rec.fish) m.tx = m.x + 0.001; // fuerza elegir destino nuevo
  const g = new THREE.Group(); for (let i = 0; i < 14; i++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), mat('#c87a3a')); p.position.set(rnd(-0.5, 0.5), TH - 0.12, rnd(-0.25, 0.25)); p.userData.v = rnd(0.05, 0.12); g.add(p); }
  rec.inner.add(g); const t0 = performance.now();
  const fall = () => { const k = (performance.now() - t0) / 1000; g.children.forEach((p) => { p.position.y = Math.max(0.14, TH - 0.12 - k * p.userData.v * 3); p.position.x += Math.sin(k * 3 + p.userData.v * 50) * 0.001; }); eng.dirty = true; if (k < 5) requestAnimationFrame(fall); else rec.inner.remove(g); };
  requestAnimationFrame(fall);
}
function swim(t) {
  const dt = Math.min(0.2, t - (lastSwim || t)); lastSwim = t;
  for (const [tid, rec] of tankGroups) {
    const tank = tankOf(tid); const lively = tank && tank.food > 15 ? 1 : 0.5;
    for (const [fid, m] of rec.fish) {
      const f = st.fish.find((q) => q.id === fid); const sick = f && f.health < 40;
      if (Math.hypot(m.tx - m.x, m.ty - m.y, m.tz - m.z) < 0.08 || Math.random() < 0.003) {
        const parent = tank?.breeding && (tank.breeding.a === fid || tank.breeding.b === fid) && rec.eggs;
        if (parent) { const e = rec.eggs.position; m.tx = e.x + rnd(-0.25, 0.25); m.ty = e.y + rnd(0, 0.2); m.tz = e.z + rnd(0.05, 0.3); }
        else if (f && !f.adult) { const lead = [...rec.fish.values()].find((q) => q !== m && q.kind === m.kind && q.adult); m.tx = (lead ? lead.x : 0) + rnd(-0.3, 0.3); m.ty = rnd(0.2, 0.55); m.tz = (lead ? lead.z : 0) + rnd(-0.2, 0.2); m.tx = Math.max(-(TW / 2 - 0.3), Math.min(TW / 2 - 0.3, m.tx)); m.tz = Math.max(-(TD / 2 - 0.25), Math.min(TD / 2 - 0.25, m.tz)); }
        else if (rec.feedT && t - rec.feedT < 4 && m.mode === 'swim') { m.tx = rnd(-0.5, 0.5); m.ty = TH - 0.3; m.tz = rnd(-0.2, 0.2); }
        else if (f?.trait === 'timido' && rec.deco.children.length && Math.random() < 0.7) { const d = pick(rec.deco.children.filter((c) => c.userData.deco)); if (d) { m.tx = d.position.x + rnd(-0.15, 0.15); m.ty = rnd(0.2, 0.5); m.tz = d.position.z + rnd(-0.1, 0.15); } }
        else if (f?.trait === 'curioso' && close === tid && Math.random() < 0.7) { m.tx = rnd(-0.8, 0.8); m.ty = rnd(0.5, 1.0); m.tz = TD / 2 - 0.2; }
        else if (f?.trait === 'sociable' && rec.fish.size > 1) { const o = pick([...rec.fish.values()].filter((q) => q !== m)); m.tx = o.x + rnd(-0.2, 0.2); m.ty = o.y + rnd(-0.1, 0.1); m.tz = o.z + rnd(-0.15, 0.15); }
        else { m.tx = rnd(-(TW / 2 - 0.35), TW / 2 - 0.35); m.ty = rnd(0.3, TH - 0.35); m.tz = rnd(-(TD / 2 - 0.3), TD / 2 - 0.3); }
        m.tx = Math.max(-(TW / 2 - 0.25), Math.min(TW / 2 - 0.25, m.tx)); m.ty = Math.max(0.2, Math.min(TH - 0.25, m.ty)); m.tz = Math.max(-(TD / 2 - 0.2), Math.min(TD / 2 - 0.2, m.tz));
        if (m.mode === 'bottom' || m.mode === 'crawl') m.ty = m.gy; // viven en el fondo
        if (m.mode === 'upright' || m.mode === 'drift') m.ty = Math.max(0.55, m.ty);
      }
      const dx = m.tx - m.x, dy = m.ty - m.y, dz = m.tz - m.z, d = Math.hypot(dx, dy, dz) || 1;
      const feeding = rec.feedT && t - rec.feedT < 4; const sp = m.sp * lively * (sick ? 0.4 : 1) * (f?.trait === 'veloz' ? 1.6 : 1) * (feeding ? (f?.trait === 'gloton' ? 2.4 : 1.6) : 1) * dt;
      m.x += dx / d * sp; m.y += dy / d * sp * 0.6; m.z += dz / d * sp;
      const low = m.mode === 'bottom' || m.mode === 'crawl';
      m.g.position.set(m.x, m.y + (low ? 0 : Math.sin(t * (m.mode === 'drift' ? 1.1 : 2) + m.sp * 10) * (m.mode === 'drift' ? 0.06 : 0.02)), m.z);
      if (m.mode !== 'drift') { const yaw = Math.atan2(dx, dz) + (m.kind === 'cangrejo' ? Math.PI / 2 : 0); let a = yaw - m.g.rotation.y; a = Math.atan2(Math.sin(a), Math.cos(a)); m.g.rotation.y += a * Math.min(1, dt * (m.mode === 'swim' ? 4 : 2)); } else m.g.rotation.y += dt * 0.1;
      m.g.rotation.z = sick ? (low ? 0.35 : 0.9) : 0;
      if (m.anim) m.anim(t, d > 0.08); else m.tail.rotation.y = Math.sin(t * (8 + m.sp * 6)) * 0.45;
      if (m.pects) m.pects.forEach((pv, i) => (pv.rotation.y = Math.sin(t * 6 + i * 3) * 0.5));
    }
    for (const d of rec.deco.children) if (d.userData.sway) d.userData.sway.forEach((pv, i) => (pv.rotation.z = pv.userData.base + Math.sin(t * 1.3 + i) * 0.08));
    if (rec.eggs) rec.eggs.children.forEach((e, i) => e.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.06));
  }
}
eng.onBeforeRender = (t) => { syncTanks(t); swim(t); caustic.offset.set(Math.sin(t * 0.3) * 0.1, t * 0.03); ripple.offset.set(t * 0.02, Math.cos(t * 0.4) * 0.05); if (close) closeCard(); };
// luz según la hora
function light() { const h = hourOf(st.time); const night = h < 7 || h >= 21; eng.hemi.intensity = night ? 0.6 : 1.1; eng.sun.intensity = night ? 0.4 : 1.5; document.body.style.background = night ? 'linear-gradient(#1a2148,#3b3f72)' : 'linear-gradient(#bfe6f0,#e6f2f6)'; if (S3.fog) S3.fog.color.set(night ? '#3b3f72' : '#e6f2f6'); }

// ---------- interfaz ----------
const sheet = new Sheet();
let focusTank = null;
// ---------- vista de cerca ----------
let close = null, followId = null, entering = false, cardT = 0;
function fishWorld(fid) { for (const rec of tankGroups.values()) { const m = rec.fish.get(fid); if (m) { const v = new THREE.Vector3(); m.g.getWorldPosition(v); return v; } } return null; }
function enterClose(tid) {
  const i = st.tanks.findIndex((t) => t.id === tid); if (i < 0) return;
  close = tid; followId = null; entering = true; sheet.close(); entering = false; focusTank = tid;
  const t = st.tanks[i], { x, z } = tankPos(t); eng.cam.follow = null; eng.cam.min = 0.6; eng.cam.minPitch = -0.1;
  eng.cam.tx = new THREE.Vector3(x, STAND + TH * 0.45, z); eng.cam.distT = eng.fitDist(3.25); eng.cam.pitchT = 0.05;
  eng.cam.yawT = tankYaw(t) + Math.round((eng.cam.yaw - tankYaw(t)) / (Math.PI * 2)) * Math.PI * 2;
  $('#closebar').hidden = false; $('#camctl').hidden = true; renderCloseBar(); hud();
}
function exitClose() {
  close = null; followId = null; eng.cam.follow = null; eng.cam.min = 2.2; eng.cam.minPitch = 0.15;
  $('#closebar').hidden = true; $('#fishcard').hidden = true; $('#camctl').hidden = false;
  focusTank = null; eng.cam.pitchT = 0.55; eng.cam.tx = new THREE.Vector3(0, 0.8, 0.5); eng.cam.distT = overviewDist(); hud();
}
function followFish(fid) {
  followId = fid; eng.follow(() => (followId ? fishWorld(followId) : null)); eng.cam.distT = Math.min(eng.cam.dist, eng.fitDist(1.4)); cardT = 0; closeCard(true);
}
function renderCloseBar() {
  const t = tankOf(close); if (!t) return exitClose();
  const i = st.tanks.indexOf(t); const n = fishIn(t).length;
  const key = t.id + n + !!t.breeding; if ($('#closebar').dataset.k === key) return; $('#closebar').dataset.k = key;
  $('#closebar').innerHTML = `<span class="ttl">${icon('fish')} Acuario ${i + 1} · ${n} ${n === 1 ? 'animal' : 'animales'}${t.breeding ? ' · huevos' : ''}</span>
    <button class="btn sm" id="cb_f">${icon('eye')} Seguir a uno</button><button class="btn sm alt" id="cb_p">${icon('menu')} Panel</button><button class="btn sm alt" id="cb_x">${icon('x')}</button>`;
  $('#cb_f').onclick = () => { const fs = fishIn(t); if (!fs.length) return; const cur = fs.findIndex((f) => f.id === followId); followFish(fs[(cur + 1) % fs.length].id); };
  $('#cb_p').onclick = () => { const id = close; exitClose(); openTank(id); };
  $('#cb_x').onclick = exitClose;
}
// ficha flotante del pez que sigues (o de los huevos)
function closeCard(force = false) {
  const el = $('#fishcard'); const now = performance.now(); if (!force && now - cardT < 500) return; cardT = now;
  if (el.dataset.eggs) { const t = tankOf(el.dataset.eggs); if (!t || !t.breeding) { delete el.dataset.eggs; el.hidden = true; return; } el.innerHTML = `<b>${icon('egg')} Huevos</b><div class="hint">Eclosionarán en unos ${Math.max(1, Math.round(t.breeding.until - st.time))} min de juego. Los padres los vigilan.</div>`; el.hidden = false; return; }
  const f = followId && st.fish.find((q) => q.id === followId); if (!f) { el.hidden = true; return; }
  const age = Math.round((st.time - f.born) / 60);
  const ph = photos([photoOf(f)]);
  el.innerHTML = `<div class="row" style="align-items:center">${imgTag(ph[photoOf(f)], 52)}<div style="flex:1;min-width:0"><b>${esc(f.name)}</b> <span class="hint">${f.sex === 'm' ? '♂' : '♀'} · ${f.adult ? 'adulto' : `alevín (${age} h)`}</span> <span class="trait">${fishTrait(f)}</span><div class="hint">${esc(speciesName(f.g, spOf(f)))} · ${esc(FISH_TRAITS[f.trait]?.desc || '')}</div></div><b>${eur(price(f))}</b></div>
    ${f.health < 40 ? `<div class="sickrow">${icon('alert')}<span style="flex:1">Enfermo/a${sickWhy(tankOf(f.tank)).length ? ': ' + sickWhy(tankOf(f.tank))[0] : ''}</span><button class="btn sm coral" data-med="${f.tank}">Medicina · ${eur(medPrice())}</button></div>` : ''}
    <div class="stat" style="margin:6px 0 0"><span class="tile" style="background:#25c48f">${icon('heart')}</span><span>Salud</span><div class="bar"><i style="transform:scaleX(${f.health / 100});background:${f.health < 40 ? '#e5484d' : '#25c48f'}"></i></div></div>`;
  el.hidden = false;
}
const selected = new Set();
function hud() {
  $('#money b').textContent = eur(st.money);
  const h = hourOf(st.time);
  $('#clock .t b').textContent = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor(st.time % 60)).padStart(2, '0')}`;
  $('#clock .t span').textContent = `Día ${dayOf(st.time) + 1} · ${st.fish.length} animales · ${st.discovered.length}/${TOTAL_COMBOS} variedades`;
  $('#rep b').textContent = `${Math.floor(st.rep)}`;
  document.querySelectorAll('#speeds button').forEach((b) => b.classList.toggle('on', +b.dataset.s === st.speed));
  document.querySelectorAll('#tools button').forEach((b) => b.classList.toggle('on', b.dataset.t === sheet.name));
  const badge = $('#tools [data-t="clients"] .dot'); if (badge) badge.hidden = !st.requests.length;
  light();
}
function geneChips(g, sp = 'pez') { return `${sp !== 'pez' ? `<span class="chip">${SPECIES[sp].label}</span>` : ''}<span class="chip" style="background:${COLORS[g.c].hex};color:${g.c >= 7 || g.c === 2 ? '#333' : '#fff'}">${COLORS[g.c].label}</span>${sp === 'pez' || g.p ? `<span class="chip">${PATTERNS[g.p].label}</span>` : ''}${sp === 'pez' ? `<span class="chip">${FINS[g.f].short}</span>` : ''}${g.glow && sp !== 'medusa' ? '<span class="chip gold">luminoso</span>' : ''}`; }
// ---------- fotos de los peces ----------
const photoKey = (sp, g, adult = true) => `${sp}|${g.c}|${g.p}|${g.f || 0}|${g.glow ? 1 : 0}|${adult ? 1 : 0}`;
function photoBuild(k) { const [sp, c, p, f, glow, ad] = k.split('|'); const fake = { id: 'foto', g: { c: +c, p: +p, f: +f, s: 1, glow: glow === '1' }, adult: ad === '1' }; if (sp !== 'pez') fake.sp = sp; const m = fishMesh(fake); m.g.rotation.y = sp === 'cangrejo' ? 0 : -0.25; if (m.anim) m.anim(1.3, false); return m.g; }
// Devuelve las fotos (data URL) de una lista de claves; se dibujan una vez y se guardan
function photos(keys) { return thumbs('reef-photo', [...new Set(keys)], photoBuild, { size: 120, dir: [1, 0.3, 0.45], fit: 0.8 }); }
const photoOf = (f) => photoKey(spOf(f), f.g, f.adult);
const imgTag = (src, size = 56, extra = '') => src ? `<img class="fphoto" src="${src}" alt="" style="width:${size}px;height:${size}px;${extra}">` : `<span class="tilebox">${icon('fish')}</span>`;
function openTank(tid) {
  if (close) exitClose();
  focusTank = tid; selected.clear();
  const i = st.tanks.findIndex((t) => t.id === tid); const t = st.tanks[i], { x, z } = tankPos(t), yw = tankYaw(t);
  eng.focus(x + Math.sin(yw) * 0.3, z + Math.cos(yw) * 0.3, tankDist() * 0.9); eng.cam.target.y = -0.55; eng.cam.pitch = 0.2; eng.cam.yawT = yw + 0.12 + Math.round((eng.cam.yaw - yw) / (Math.PI * 2)) * Math.PI * 2;
  sheet.open('tank', `Acuario ${i + 1}`); renderPanel(); hud();
}
function openPanel(name) {
  if (sheet.name === name) return sheet.close();
  focusTank = null; eng.focus(CX, 0.5, overviewDist()); eng.cam.target.y = 0.8; eng.cam.pitch = 0.55;
  sheet.open(name, { buy: 'Comprar', clients: 'Clientes', album: 'Álbum de variedades', shop: 'Mejoras de la tienda', info: 'Arrecife' }[name]); renderPanel(); hud();
}
function stat(ic, color, label, v, txt) { return `<div class="stat"><span class="tile" style="background:${color}">${icon(ic)}</span><span>${label}</span><div style="display:flex;gap:8px;align-items:center"><div class="bar"><i style="transform:scaleX(${v / 100});background:${v < 30 ? '#e5484d' : color}"></i></div>${txt ? `<b style="font-size:12px;min-width:38px">${txt}</b>` : ''}</div></div>`; }
function renderPanel() {
  const b = sheet.body; const name = sheet.name;
  if (name === 'tank') {
    const t = tankOf(focusTank); if (!t) return sheet.close(); const fs = fishIn(t);
    const fph = photos(fs.map(photoOf));
    const dth = thumbs('reef-deco', Object.keys(DECOS), (k) => decoMesh(k, 0, [0, 0], 0), { size: 96 });
    b.innerHTML = `<button class="btn coral" id="seeclose" style="width:100%;margin-bottom:8px">${icon('eye')} Ver de cerca${t.breeding ? ' (hay huevos)' : ''}</button><div class="row" style="margin-bottom:10px"><button class="btn alt sm" style="flex:1" id="tmove">${icon('move')} Mover acuario</button><button class="btn alt sm" style="flex:1" id="trot">${icon('rotate')} Girar</button><button class="btn alt sm" id="tdel" aria-label="Quitar acuario">${icon('trash')}</button></div>${stat('food', '#f08a3c', 'Comida', t.food)}${stat('drop', '#2fa8e0', 'Agua limpia', t.clean)}${stat('thermo', idealTemp(t) ? '#25c48f' : '#e5484d', 'Temperatura', clamp((t.temp - 18) * 7), `${t.temp.toFixed(1)}°`)}${stat('heart', '#e0559a', 'Ánimo', tankHappy(t))}
      <div class="row" style="margin:8px 0"><button class="btn coral" id="feed">${icon('food')} Comida · 2 €</button><button class="btn alt" id="clean">${icon('drop')} Limpiar · 20 €</button></div>
      ${!has('calefactor') ? `<div class="row"><button class="btn alt sm" id="tdown">− Enfriar</button><span class="hint" style="flex:1;text-align:center;align-self:center">Ideal: 24–27 °C</span><button class="btn alt sm" id="tup">+ Calentar</button></div>` : '<p class="hint">El calefactor mantiene la temperatura perfecta.</p>'}
      ${(() => { const sick = fs.filter((f) => f.health < 40); const why = sickWhy(t); return sick.length || why.length ? `<div class="sickrow">${icon('alert')}<div style="flex:1;min-width:0"><b>${sick.length ? `${sick.length} ${sick.length > 1 ? 'peces enfermos' : 'pez enfermo'}` : 'Cuidado'}</b><div class="hint">${why.length ? why.join(' · ') : 'Las causas ya están resueltas: la medicina acelera la recuperación.'}${t.medUntil && st.time < t.medUntil ? ' · Medicina activa' : ''}</div></div>${sick.length ? `<button class="btn sm coral" id="med">Medicina · ${eur(medPrice())}</button>` : ''}</div>` : ''; })()}
      ${t.breeding ? `<div class="card"><b>${icon('egg')} Hay huevos</b><div class="hint">Eclosionarán en ${Math.max(1, Math.round((t.breeding.until - st.time)))} min de juego</div></div>` : ''}
      <div class="sec">${icon('fish')} Animales (${fs.length}/${TANK_CAP})</div>
      <p class="hint">Toca la foto de un macho y una hembra adultos de la misma especie para criar. Las crías mezclan los rasgos de los padres y a veces sale algo nuevo.</p>
      <div class="list">${fs.map((f) => `<div class="li fishrow"><label class="pick"><input type="checkbox" data-sel="${f.id}" ${selected.has(f.id) ? 'checked' : ''} ${f.adult ? '' : 'disabled'}>${imgTag(fph[photoOf(f)], 60)}</label><div style="flex:1;min-width:0"><b>${esc(f.name)}</b> <span class="hint">${f.sex === 'm' ? '♂' : '♀'} · ${f.adult ? 'adulto' : 'cría'}${f.health < 40 ? ' · enfermo' : ''}</span> <span class="trait">${fishTrait(f)}</span><div class="chips" style="margin-top:4px">${geneChips(f.g, spOf(f))}</div></div><div style="display:flex;flex-direction:column;gap:6px"><button class="btn sm mint" data-sell="${f.id}">${f.ask ? `En venta · ${eur(f.ask)}` : 'Vender'}</button><button class="btn sm alt" data-move="${f.id}">Mover</button></div></div>`).join('') || '<p class="hint">Este acuario está vacío. Compra animales en Comprar.</p>'}</div>
      <button class="btn" id="breed" style="width:100%;margin-top:6px" ${selected.size === 2 && !t.breeding ? '' : 'disabled'}>${icon('egg')} Criar con los dos marcados</button>
      <div class="sec">${icon('sparkle')} Decoración</div><div class="chips">${t.deco.map((d, k) => `<button class="chip" data-dk="${k}"><span class="cdot" style="background:${decoColor(d, t.dc?.[k])}"></span> ${DECOS[d].label}</button>`).join('') || '<span class="hint">Sin decoración</span>'}</div>
      <p class="hint" style="margin-top:8px">Toca una para verla de cerca y elegir el color antes de comprarla.${t.deco.length >= 8 ? ' <b>Este acuario ya tiene 8 decoraciones.</b>' : ''}</p>
      <div class="grid">${Object.entries(DECOS).map(([k, d]) => `<button class="item" data-deco="${k}" ${t.deco.length >= 8 ? 'disabled' : ''}><span class="tilebox" style="background:#2a6a8e;overflow:hidden">${dth[k] ? `<img src="${dth[k]}" alt="" style="width:100%;height:100%;object-fit:cover">` : icon(d.ic)}</span>${d.label}<span class="d">${d.colors.map((c) => `<span class="cdot" style="background:${c[1]}"></span>`).join('')}</span><span class="p">${eur(d.price)}</span></button>`).join('')}</div>`;
    b.querySelector('#seeclose').onclick = () => enterClose(t.id);
    const medB = b.querySelector('#med'); if (medB) medB.onclick = () => { medicine(t); renderPanel(); };
    b.querySelector('#tmove').onclick = () => armTank(t);
    b.querySelector('#tdel').onclick = () => removeTank(t);
    b.querySelector('#trot').onclick = () => { const p = tankPos(t), np = { ...p, r: (p.r + 1) % 4 }; if (!tankFits(t, np)) return toast('No cabe girado ahí: muévelo antes', 'warn'); t.pos = np; openTank(t.id); save(); };
    b.querySelectorAll('[data-dk]').forEach((x) => (x.onclick = () => decoCard(t, +x.dataset.dk)));
    b.querySelector('#feed').onclick = () => { if (st.money < 2) return; st.money -= 2; t.food = clamp(t.food + 45); feedFx(t.id); renderPanel(); hud(); };
    b.querySelector('#clean').onclick = () => { if (st.money < 20) return toast('No hay dinero suficiente', 'warn'); st.money -= 20; t.clean = 100; renderPanel(); hud(); };
    const td = b.querySelector('#tdown'), tu = b.querySelector('#tup'); if (td) td.onclick = () => { t.temp -= 1; renderPanel(); }; if (tu) tu.onclick = () => { t.temp += 1; renderPanel(); };
    b.querySelectorAll('[data-sel]').forEach((c) => (c.onchange = () => { c.checked ? selected.add(c.dataset.sel) : selected.delete(c.dataset.sel); if (selected.size > 2) selected.delete([...selected][0]); renderPanel(); }));
    b.querySelector('#breed').onclick = () => {
      const [a, c] = [...selected].map((id) => st.fish.find((f) => f.id === id));
      if (!a || !c || a.sex === c.sex) return toast('Hace falta un macho y una hembra', 'warn');
      if (spOf(a) !== spOf(c)) return toast('Solo pueden criar dos de la misma especie', 'warn');
      if (fishIn(t).length >= TANK_CAP) return toast('El acuario está lleno: vende o mueve algún pez', 'warn');
      if (tankHappy(t) < 35) return toast('Los peces no están a gusto: decora y limpia el agua', 'warn');
      t.breeding = { a: a.id, b: c.id, until: st.time + (has('incubadora') ? 45 : 90) }; selected.clear(); toast(`${a.name} y ${c.name} han puesto huevos`, 'good', 'egg'); renderPanel(); save();
    };
    b.querySelectorAll('[data-sell]').forEach((x) => (x.onclick = () => sellFish(st.fish.find((q) => q.id === x.dataset.sell))));
    b.querySelectorAll('[data-move]').forEach((x) => (x.onclick = () => moveFish(x.dataset.move)));
    b.querySelectorAll('[data-deco]').forEach((x) => (x.onclick = () => decoShop(t, x.dataset.deco)));
  }
  if (name === 'buy') {
    const n = st.tanks.length; const sps = Object.entries(SPECIES);
    const ph = photos(sps.map(([k, S]) => photoKey(k, k === 'pez' ? { c: 1, p: 1, f: 1 } : { c: S.colors[0], p: S.pats[S.pats.length > 1 ? 1 : 0], f: 0, glow: k === 'medusa' })));
    b.innerHTML = `<div class="sec">Animales del proveedor</div><p class="hint">Llegan adultos al primer acuario con sitio. Con más reputación (★) desbloqueas especies nuevas.</p><div class="list">
      ${sps.map(([k, S]) => { const lock = st.rep < S.rep; const pk = photoKey(k, k === 'pez' ? { c: 1, p: 1, f: 1 } : { c: S.colors[0], p: S.pats[S.pats.length > 1 ? 1 : 0], f: 0, glow: k === 'medusa' }); return `<div class="li" style="${lock ? 'opacity:.55' : ''}">${imgTag(ph[pk], 60)}<div style="flex:1;min-width:0"><b>${S.label}</b><div class="hint">${S.desc}${S.clean ? ' <b>Limpia.</b>' : ''}${lock ? ` <b>Necesita ${S.rep}★ de reputación.</b>` : ''}</div></div><button class="btn sm" data-sp="${k}" ${lock ? 'disabled' : ''}>${eur(S.price)}</button></div>`; }).join('')}
      <div class="li"><span class="tilebox">${icon('egg')}</span><div style="flex:1"><b>Huevo sorpresa</b><div class="hint">Un pez que puede salir poco común</div></div><button class="btn sm" id="b2">60 €</button></div></div>
      <div class="sec">Acuarios</div><button class="li" id="bt" style="width:100%" ${n >= maxTanks() ? 'disabled' : ''}><span class="tilebox">${icon('box')}</span><div style="flex:1;text-align:left"><b>Nuevo acuario</b><div class="hint">${n}/${maxTanks()} acuarios</div></div><b>${n >= maxTanks() ? 'Completo' : eur(TANK_PRICE(n))}</b></button>
      ${(() => { const lv = st.shopLevel || 0, nx = SHOP_LEVELS[lv]; return nx ? `<div class="card" style="margin-top:8px"><b>${icon('home')} Ampliar la tienda</b><div class="hint">Te quedas sin sitio: alquila el local de al lado. La tienda crece 6 metros y caben 3 acuarios más (hasta ${maxTanks() + 3}).${st.rep < nx.rep ? ` Necesitas ${nx.rep}★ de reputación.` : ''}</div><button class="btn coral" id="grow" style="width:100%;margin-top:8px" ${st.rep < nx.rep ? 'disabled' : ''}>${icon('home')} Ampliar · ${eur(nx.price)}</button></div>` : '<p class="hint">La tienda ya está ampliada al máximo.</p>'; })()}`;
    const target = () => st.tanks.find((t) => fishIn(t).length < TANK_CAP);
    b.querySelectorAll('[data-sp]').forEach((x) => (x.onclick = () => { const sp = x.dataset.sp, S = SPECIES[sp]; const t = target(); if (!t) return toast('Todos los acuarios están llenos', 'warn'); if (st.money < S.price) return toast('No hay dinero suficiente', 'warn'); st.money -= S.price; const g = genesFor(sp); const f = addFish(st, t.id, g, null, true, sp); toast(`${f.name} (${speciesName(g, sp)}) llega al acuario ${st.tanks.indexOf(t) + 1}`, 'good', 'fish'); renderPanel(); hud(); save(); }));
    b.querySelector('#b2').onclick = () => { const t = target(); if (!t) return toast('Todos los acuarios están llenos', 'warn'); if (st.money < 60) return toast('No hay dinero suficiente', 'warn'); st.money -= 60; const g = genesFor('pez', true); addFish(st, t.id, g); toast(`Del huevo ha salido: ${speciesName(g)}`, 'good', 'egg'); hud(); save(); };
    const growB = b.querySelector('#grow'); if (growB) growB.onclick = () => { const nx = SHOP_LEVELS[st.shopLevel || 0]; if (!nx) return; if (st.money < nx.price) return toast('No hay dinero suficiente', 'warn'); confirm(`¿Ampliar la tienda por ${eur(nx.price)}? Tendrás sitio para 3 acuarios más.`, () => { st.money -= nx.price; st.shopLevel = (st.shopLevel || 0) + 1; save(); location.reload(); }); };
    b.querySelector('#bt').onclick = () => { if (n >= maxTanks()) return; const p = TANK_PRICE(n); if (st.money < p) return toast('No hay dinero suficiente', 'warn'); st.money -= p; placeNewTank(); toast('Nuevo acuario instalado', 'good', 'box'); renderPanel(); hud(); save(); };
  }
  if (name === 'clients') {
    const wantKey = (w) => photoKey(w.sp || 'pez', { c: w.c ?? 0, p: w.p ?? 0, f: w.f ?? 0, glow: !!w.glow });
    const wph = photos(st.requests.filter((r) => r.want.c != null).map((r) => wantKey(r.want)));
    b.innerHTML = st.requests.length ? `<div class="list">${st.requests.map((r) => { const m = st.fish.filter((f) => matches(f, r.want)); return `<div class="li"><span class="hostface" style="width:46px;height:46px">${avatar(CUSTOMERS[r.cust ?? 0].look)}</span><div style="flex:1;min-width:0"><b>${esc(r.who)}</b><div class="hint" style="font-style:italic">«${esc(CUSTOMERS[r.cust ?? 0].ask.replace('{pez}', wantText(r.want).toLowerCase()))}»</div><div class="hint">Caduca en ${Math.round((r.until - st.time) / 60)} h</div>${r.want.c != null ? `<div class="wantpic">${imgTag(wph[wantKey(r.want)], 44)}<span class="hint">Más o menos así${r.want.p == null || r.want.f == null && !r.want.sp ? ' (el resto da igual)' : ''}</span></div>` : ''}</div><div style="text-align:right;display:flex;flex-direction:column;gap:6px;align-items:flex-end"><b>${eur(r.price)}</b>${r.haggled ? '' : `<button class="btn sm alt" data-hg="${r.id}">Regatear</button>`}<button class="btn sm ${m.length ? 'mint' : 'alt'}" data-r="${r.id}" ${m.length ? '' : 'disabled'}>${m.length ? 'Entregar' : 'No tienes'}</button></div></div>`; }).join('')}</div>` : '<p class="hint">Ahora mismo no hay clientes. Vuelven cada pocas horas. Con más reputación piden peces más raros y pagan más.</p>';
    b.querySelectorAll('[data-hg]').forEach((x) => (x.onclick = () => haggle(st.requests.find((q) => q.id === x.dataset.hg))));
    b.querySelectorAll('[data-r]').forEach((x) => (x.onclick = () => {
      const r = st.requests.find((q) => q.id === x.dataset.r); const cands = st.fish.filter((f) => matches(f, r.want)).sort((a, c) => price(a) - price(c)); const cph = photos(cands.map(photoOf));
      const box2 = modal(`<h2>¿Cuál entregas?</h2><p class="hint">${esc(r.who)} pide: ${esc(wantText(r.want))}. Paga ${eur(r.price)}.</p><div class="list">${cands.map((f) => `<button class="li" data-f="${f.id}">${imgTag(cph[photoOf(f)], 60)}<div style="flex:1;text-align:left"><b>${esc(f.name)}</b><div class="chips">${geneChips(f.g, spOf(f))}</div></div><b>${eur(r.price)}</b></button>`).join('')}</div><div class="actions"><button class="btn alt" id="cx">Cancelar</button></div>`);
      box2.querySelector('#cx').onclick = closeModal;
      box2.querySelectorAll('[data-f]').forEach((y) => (y.onclick = () => { st.fish = st.fish.filter((f) => f.id !== y.dataset.f); st.money += r.price; st.rep += 1; st.sold++; st.requests = st.requests.filter((q) => q !== r); closeModal(); toast(`${r.who}: «${CUSTOMERS[r.cust ?? 0].bye}» +${eur(r.price)}`, 'good', 'coin'); logDay('sale', r.who); renderPanel(); hud(); save(); }));
    }));
  }
  if (name === 'album') {
    const sec = (title, cells) => { const keys = cells.filter((c) => c.on).map((c) => c.pk); const ph = photos(keys); return `<div class="sec">${title}</div><div class="album">${cells.map((c) => `<span class="cell ${c.on ? 'on' : ''}" title="${c.on ? esc(c.name) : '?'}" ${c.on ? `data-name="${esc(c.name)}" data-pk="${c.pk}"` : ''} style="${c.on ? `background:radial-gradient(#7cc4ea,#2f7aa6)` : ''}">${c.on && ph[c.pk] ? `<img src="${ph[c.pk]}" alt="">` : '?'}</span>`).join('')}</div>`; };
    let h = `<p class="hint"><b>${st.discovered.length} de ${TOTAL_COMBOS}</b> variedades descubiertas. Cría para completar el álbum: cada 10 hay premio. Toca una foto para verla en grande.</p>`;
    for (let f = 0; f < FINS.length; f++) { const cells = []; for (let p = 0; p < PATTERNS.length; p++) for (let c = 0; c < COLORS.length; c++) { const g = { c, p, f }; cells.push({ on: st.discovered.includes(keyOf(g)), pk: photoKey('pez', g), name: speciesName(g) }); } h += sec(`Peces · ${FINS[f].label}`, cells); }
    for (const [sp, S] of Object.entries(SPECIES)) { if (sp === 'pez') continue; const cells = []; for (const p of S.pats) for (const c of S.colors) { const g = { c, p, f: 0, glow: sp === 'medusa' }; cells.push({ on: st.discovered.includes(keyOf(g, sp)), pk: photoKey(sp, g), name: speciesName(g, sp) }); } h += sec(`${S.plural}${st.rep < S.rep ? ` <span class="hint">· se desbloquea con ${S.rep}★</span>` : ''}`, cells); }
    b.innerHTML = h;
    b.querySelectorAll('.cell[data-pk]').forEach((x) => (x.onclick = () => { const ph = photos([x.dataset.pk]); info(esc(x.dataset.name), `<div class="photobig">${imgTag(ph[x.dataset.pk], 200)}</div>`, 'Cerrar'); }));
  }
  if (name === 'shop') {
    b.innerHTML = `<p class="hint">Las mejoras valen para todos los acuarios. Algunas tienen una versión mejor que se desbloquea al tener la primera.</p><div class="list">${Object.entries(UPGRADES).map(([k, u]) => { const lock = u.req && !has(u.req); return `<div class="li" style="${lock ? 'opacity:.55' : ''}"><span class="tilebox">${icon(u.ic)}</span><div style="flex:1"><b>${u.label}</b>${u.req ? ' <span class="chip">nivel 2</span>' : ''}<div class="hint">${u.desc}${lock ? ` <b>Necesita: ${UPGRADES[u.req].label}.</b>` : ''}</div></div>${has(k) ? '<span class="chip good">Instalado</span>' : `<button class="btn sm" data-u="${k}" ${lock ? 'disabled' : ''}>${eur(u.price)}</button>`}</div>`; }).join('')}</div>`;
    b.querySelectorAll('[data-u]').forEach((x) => (x.onclick = () => { const u = UPGRADES[x.dataset.u]; if (st.money < u.price) return toast('No hay dinero suficiente', 'warn'); st.money -= u.price; st.upgrades.push(x.dataset.u); tankGroups.forEach((r) => S3.remove(r.g)); tankGroups.clear(); toast(`${u.label} instalado`, 'good', u.ic); renderPanel(); hud(); save(); }));
  }
  if (name === 'info') {
    b.innerHTML = `<div class="card"><div class="stat"><span class="tile" style="background:#f5a524">${icon('star')}</span><span>Reputación</span><b>${Math.floor(st.rep)}</b></div><div class="stat"><span class="tile" style="background:#25c48f">${icon('coin')}</span><span>Peces vendidos</span><b>${st.sold}</b></div><div class="stat"><span class="tile" style="background:#8b5cf6">${icon('sparkle')}</span><span>Variedades</span><b>${st.discovered.length}/${TOTAL_COMBOS}</b></div></div>
      <p class="hint">Cuida comida, agua y temperatura de cada acuario. Si algo falla, los peces enferman (se ven ladeados): corrige la causa y dales medicina desde su acuario. Con la app cerrada siguen vivos pero lo pasan peor.</p>
      <div class="sec">${icon('cloud')} Copia en la nube</div><div id="cloudbox"></div>
      <div class="sec">Calidad gráfica</div><div class="seg" id="q"><button data-v="eco">Ahorro</button><button data-v="alta">Alta</button></div>
      <div class="sec">${icon('music')} Sonido</div><div class="row"><button class="btn sm ${Sound.prefs().music ? '' : 'alt'}" id="snd_m" style="flex:1">${icon('music')} Música ${Sound.prefs().music ? 'sí' : 'no'}</button><button class="btn sm ${Sound.prefs().sfx ? '' : 'alt'}" id="snd_s" style="flex:1">${icon('bell')} Efectos ${Sound.prefs().sfx ? 'sí' : 'no'}</button></div>
      <div class="row" style="margin-top:16px"><a class="btn alt" href="../">${icon('home')} Menú de juegos</a><button class="btn red" id="reset">${icon('trash')} Empezar de nuevo</button></div>`;
    renderCloud(b.querySelector('#cloudbox'), { slot: 'arrecife', sync: cloud, onLogin: afterCloudLogin, refresh: renderPanel });
    b.querySelector('#snd_m').onclick = () => { Sound.set('music', !Sound.prefs().music); renderPanel(); }; b.querySelector('#snd_s').onclick = () => { Sound.set('sfx', !Sound.prefs().sfx); renderPanel(); };
    const q = localStorage.getItem('sim_quality') || (eng.hq ? 'alta' : 'eco'); b.querySelectorAll('#q button').forEach((x) => { x.classList.toggle('on', x.dataset.v === q); x.onclick = () => { localStorage.setItem('sim_quality', x.dataset.v); save(); location.reload(); }; });
    b.querySelector('#reset').onclick = () => confirm('Se borrará tu tienda. ¿Empezar de cero?', () => { localStorage.removeItem(KEY); st = newShop(); tankGroups.forEach((r) => S3.remove(r.g)); tankGroups.clear(); sheet.close(); hud(); save(); });
  }
}
// Vender: con su foto grande, para ver bien qué se vende
function sellFish(f) {
  if (!f) return; const p = price(f), fair = fairPrice(f); const ph = photos([photoOf(f)]);
  let ask = f.ask || fair; const step = fair >= 200 ? 10 : fair >= 60 ? 5 : 1;
  const bx = modal(`<h2>Vender a ${esc(f.name)}</h2><div class="photobig">${imgTag(ph[photoOf(f)], 150)}</div>
    <p style="text-align:center;margin:4px 0"><b>${esc(speciesName(f.g, spOf(f)))}</b><br><span class="hint">${f.sex === 'm' ? '♂ macho' : '♀ hembra'} · ${f.adult ? 'adulto' : 'cría (vale la mitad)'} · ${fishTrait(f)}</span></p>
    <div class="card" style="margin-top:8px"><b>${icon('shop')} Ponerlo a la venta en la tienda</b><div class="hint">Tú eliges el precio. Los clientes que entran lo compran si les parece bien. Valor de mercado: unos <b>${eur(fair)}</b>.</div>
      <div class="pricer"><button class="btn alt sm" id="pm">−</button><b id="pv">${eur(ask)}</b><button class="btn alt sm" id="pp">+</button></div>
      <input type="range" id="pr" min="${Math.max(1, Math.round(fair * 0.4))}" max="${Math.round(fair * 3)}" step="${step}" value="${ask}" style="width:100%">
      <div id="pc" class="hint" style="text-align:center;font-weight:800"></div>
      <button class="btn coral" id="pset" style="width:100%;margin-top:6px">${icon('shop')} ${f.ask ? 'Cambiar precio' : 'Poner a la venta'}</button>${f.ask ? `<button class="btn alt sm" id="poff" style="width:100%;margin-top:6px">Retirar de la venta</button>` : ''}</div>
    <div class="actions"><button class="btn alt" id="sx">Cerrar</button><button class="btn mint" id="sok">${icon('coin')} Vender ya al proveedor · ${eur(p)}</button></div>`);
  const show = () => { bx.querySelector('#pv').textContent = eur(ask); bx.querySelector('#pr').value = ask; const [t, c] = chanceLabel(buyChance(f, ask)); const pc = bx.querySelector('#pc'); pc.textContent = t; pc.style.color = c; };
  show();
  bx.querySelector('#pr').oninput = (e) => { ask = +e.target.value; show(); };
  bx.querySelector('#pm').onclick = () => { ask = Math.max(1, ask - step); show(); };
  bx.querySelector('#pp').onclick = () => { ask += step; show(); };
  bx.querySelector('#pset').onclick = () => { f.ask = ask; closeModal(); toast(`${f.name} está a la venta por ${eur(ask)}`, 'good', 'shop'); renderPanel(); save(); };
  const off = bx.querySelector('#poff'); if (off) off.onclick = () => { delete f.ask; closeModal(); toast(`${f.name} ya no está a la venta`, 'info'); renderPanel(); save(); };
  bx.querySelector('#sx').onclick = closeModal;
  bx.querySelector('#sok').onclick = () => { closeModal(); st.money += p; st.fish = st.fish.filter((q) => q !== f); selected.delete(f.id); st.sold++; toast(`${f.name} vendido/a · +${eur(p)}`, 'good', 'coin'); renderPanel(); hud(); save(); };
}
// Regatear con un cliente que hace un encargo (una vez por cliente)
function haggle(r) {
  const base = r.price; let ask = Math.round(base * 1.3); const step = base >= 200 ? 10 : base >= 60 ? 5 : 1;
  const chance = (a) => Math.max(0.05, Math.min(0.97, 1 - (a / base - 1) * 1.5 + Math.min(st.rep, 30) / 100));
  const C = CUSTOMERS[r.cust ?? 0];
  const bx = modal(`<h2>Regatear con ${esc(r.who)}</h2><p class="hint">Ofrece ${eur(base)}. Pide más, pero si te pasas puede negarse. Solo se puede regatear una vez.</p>
    <div class="pricer"><button class="btn alt sm" id="pm">−</button><b id="pv"></b><button class="btn alt sm" id="pp">+</button></div>
    <input type="range" id="pr" min="${base}" max="${base * 2}" step="${step}" value="${ask}" style="width:100%"><div id="pc" class="hint" style="text-align:center;font-weight:800"></div>
    <div class="actions"><button class="btn alt" id="hx">Cancelar</button><button class="btn coral" id="hok">Pedir este precio</button></div>`);
  const show = () => { bx.querySelector('#pv').textContent = eur(ask); bx.querySelector('#pr').value = ask; const c = chance(ask); const pc = bx.querySelector('#pc'); pc.textContent = c > 0.8 ? 'Seguramente acepte' : c > 0.5 ? 'Puede que acepte' : c > 0.25 ? 'Difícil que acepte' : 'Casi seguro que dirá que no'; pc.style.color = c > 0.5 ? '#25c48f' : c > 0.25 ? '#f5a524' : '#e5484d'; };
  show();
  bx.querySelector('#pr').oninput = (e) => { ask = +e.target.value; show(); };
  bx.querySelector('#pm').onclick = () => { ask = Math.max(base, ask - step); show(); };
  bx.querySelector('#pp').onclick = () => { ask = Math.min(base * 2, ask + step); show(); };
  bx.querySelector('#hx').onclick = closeModal;
  bx.querySelector('#hok').onclick = () => {
    r.haggled = true; closeModal();
    if (Math.random() < chance(ask)) { r.price = ask; toast(`${r.who}: «Vale, trato hecho: ${eur(ask)}»`, 'good', 'coin'); }
    else if (ask > base * 1.6 && Math.random() < 0.4) { st.requests = st.requests.filter((q) => q !== r); toast(`${r.who} se ha ido sin comprar: «¡Qué caro!»`, 'bad'); }
    else toast(`${r.who}: «No, no. Mi oferta sigue siendo ${eur(base)}»`, 'warn');
    renderPanel(); save();
  };
}
function moveFish(fid) {
  const f = st.fish.find((q) => q.id === fid);
  const box2 = modal(`<h2>Mover a ${esc(f.name)}</h2><div class="list">${st.tanks.map((t, i) => `<button class="li" data-t="${t.id}" ${t.id === f.tank || fishIn(t).length >= TANK_CAP ? 'disabled' : ''}><span class="tilebox">${icon('box')}</span><div style="flex:1"><b>Acuario ${i + 1}</b><div class="hint">${fishIn(t).length}/${TANK_CAP} peces</div></div></button>`).join('')}</div><div class="actions"><button class="btn alt" id="mx">Cancelar</button></div>`);
  box2.querySelector('#mx').onclick = closeModal;
  box2.querySelectorAll('[data-t]').forEach((x) => (x.onclick = () => { f.tank = x.dataset.t; closeModal(); renderPanel(); save(); }));
}
// ---------- mover acuarios y decoración ----------
// Mantén pulsado un acuario (o, viéndolo de cerca, una decoración) y arrástralo. También desde su panel.
let tmv = null, armed = null;
const tankList = () => [...tankGroups.values()].map((r) => r.g);
function removeDeco(t, k) { const d = DECOS[t.deco[k]]; t.deco.splice(k, 1); if (t.dp) t.dp.splice(k, 1); if (t.dc) t.dc.splice(k, 1); st.money += Math.round(d.price / 2); toast(`${d.label} quitada · recuperas ${eur(d.price / 2)}`, 'info', 'trash'); if (sheet.name === 'tank') renderPanel(); hud(); save(); }
function removeTank(t) {
  if (st.tanks.length <= 1) return toast('Necesitas al menos un acuario', 'warn');
  if (fishIn(t).length) return toast('Saca antes los peces (véndelos o muévelos a otro acuario)', 'warn');
  confirm('¿Quitar este acuario? Recuperas la mitad de lo que costó.', () => { const refund = Math.round(TANK_PRICE(st.tanks.length - 1) / 2); st.tanks = st.tanks.filter((q) => q !== t); st.money += refund; if (close === t.id) exitClose(); sheet.close(); toast(`Acuario quitado · recuperas ${eur(refund)}`, 'info', 'trash'); hud(); save(); });
}
function beginTankMove(t, sx, sy) {
  const p = eng.ground(sx, sy); if (!p) return false; const tp = tankPos(t);
  tmv = { kind: 'tank', t, gx: p.x - tp.x, gz: p.z - tp.z, pos: { ...tp }, ok: true }; sheet.close(); Sound.play('lift'); trash.show(fishIn(t).length ? 'Vacíalo antes de quitarlo' : 'Suelta aquí para quitarlo'); return true;
}
function beginDecoMove(t, k) { const rec = tankGroups.get(t.id); const m = rec && rec.deco.children.find((c) => c.userData.deco === t.id + ':' + k); if (!m) return false; tmv = { kind: 'deco', t, k, m, rec }; trash.show('Suelta aquí para quitarla'); return true; }
function tankMoveDrag(sx, sy) {
  tmv.sx = sx; tmv.sy = sy; tmv.trash = trash.over(sx, sy);
  if (!tmv.trash && tmv.kind === 'tank' && tmv.t) { const rec = tankGroups.get(tmv.t.id); if (rec?.glass) rec.glass.material.opacity = 0.35; }
  if (tmv.kind === 'tank') {
    const p = eng.ground(sx, sy); if (!p) return; const snap = (v) => Math.round(v * 4) / 4;
    tmv.pos = { x: snap(p.x - tmv.gx), z: snap(p.z - tmv.gz), r: tankPos(tmv.t).r }; tmv.ok = tankFits(tmv.t, tmv.pos);
    const rec = tankGroups.get(tmv.t.id); rec.g.position.set(tmv.pos.x, 0.12, tmv.pos.z);
    if (rec.glass) rec.glass.material.color.set(tmv.ok ? 0xc8f5d8 : 0xffa8a8), (rec.glass.material.opacity = 0.35);
  } else {
    const y = STAND + 0.14; const p = eng.ground(sx, sy, y); if (!p) return;
    const l = tmv.rec.inner.worldToLocal(p.clone()); const lx = Math.max(-TW / 2 + 0.18, Math.min(TW / 2 - 0.18, l.x)), lz = Math.max(-TD / 2 + 0.15, Math.min(TD / 2 - 0.15, l.z));
    tmv.m.position.set(lx, 0.2, lz); tmv.lx = lx; tmv.lz = lz;
  }
  eng.shadowsDirty?.();
}
function endTankMove(cancel) {
  const m = tmv; tmv = null; trash.hide();
  if (!cancel && m.trash) { if (m.kind === 'tank') { const rec = tankGroups.get(m.t.id); if (rec?.glass) { rec.glass.material.color.set(0xdff2fa); rec.glass.material.opacity = 0.12; } removeTank(m.t); } else { m.rec.sig = ''; removeDeco(m.t, m.k); } armed = null; $('#toolinfo').hidden = true; return; }
  if (m.kind === 'tank') {
    const rec = tankGroups.get(m.t.id); if (rec?.glass) { rec.glass.material.color.set(0xdff2fa); rec.glass.material.opacity = 0.12; }
    if (!cancel && m.ok) { m.t.pos = m.pos; navigator.vibrate?.(10); Sound.play('place'); } else if (!cancel) toast('Ahí no cabe', 'warn');
  } else if (!cancel && m.lx != null) {
    const t = m.t; t.dp = t.deco.map((d, k) => (t.dp && t.dp[k]) || [-1.1 + (k % 5) * 0.55, -0.35 + (k % 2) * 0.3]); t.dp[m.k] = [+m.lx.toFixed(2), +m.lz.toFixed(2)];
  } else m.rec.sig = '';
  armed = null; $('#toolinfo').hidden = true; eng.shadowsDirty?.(); save();
}
function armTank(t) { sheet.close(); armed = { kind: 'tank', t }; showArmed(`${icon('move')} Arrastra el dedo para mover el acuario`); }
function armDeco(t, k) { closeModal(); enterClose(t.id); armed = { kind: 'deco', t, k }; showArmed(`${icon('move')} Arrastra el dedo para colocar ${DECOS[t.deco[k]].label.toLowerCase()}`); }
function showArmed(html) { const el = $('#toolinfo'); el.hidden = false; el.innerHTML = `${html}<button class="x" id="ti_x" aria-label="Cancelar">${icon('x')}</button>`; $('#ti_x').onclick = () => { armed = null; el.hidden = true; }; }
// Fila de colores para elegir
const swatches = (type, cur) => `<div class="swatches">${DECOS[type].colors.map(([n, c], i) => `<button class="sw ${i === cur ? 'on' : ''}" data-ci="${i}" style="background:${c}" aria-label="${n}" title="${n}"></button>`).join('')}</div>`;
// Tienda de decoración: la ves en 3D, eliges color y la compras
function decoShop(t, type) {
  const d = DECOS[type]; let ci = 0;
  const bx = modal(`<h2>${d.label}</h2><div id="pv" style="background:linear-gradient(#5ab4e8,#1f5f86);border-radius:16px"></div>
    <div class="sec" style="margin-top:10px">Color: <b id="cn">${d.colors[0][0]}</b></div>${swatches(type, 0)}
    <p class="hint">Alegra a los peces (+${d.happy} de ánimo). Gírala con el dedo. Después podrás moverla por la arena.</p>
    <div class="actions"><button class="btn alt" id="px">Cerrar</button><button class="btn coral" id="pok">${icon('coin')} Comprar · ${eur(d.price)}</button></div>`);
  const pv = preview(bx.querySelector('#pv'), { height: 190 }); const show = () => pv.set(decoMesh(type, 0, [0, 0], ci)); show();
  bx.querySelectorAll('[data-ci]').forEach((x) => (x.onclick = () => { ci = +x.dataset.ci; bx.querySelectorAll('.sw').forEach((q) => q.classList.toggle('on', q === x)); bx.querySelector('#cn').textContent = d.colors[ci][0]; Sound.play('tap'); show(); }));
  const done = () => { pv.stop(); closeModal(); };
  bx.querySelector('#px').onclick = done;
  bx.querySelector('#pok').onclick = () => {
    if (t.deco.length >= 8) return toast('Este acuario ya tiene 8 decoraciones', 'warn');
    if (st.money < d.price) return toast('No hay dinero suficiente', 'warn');
    st.money -= d.price; t.dc = t.deco.map((_, k) => (t.dc && t.dc[k]) || 0); t.deco.push(type); t.dc.push(ci);
    done(); toast(`${d.label} ${d.colors[ci][0].toLowerCase()} en el acuario`, 'good', 'sparkle'); renderPanel(); hud(); save();
  };
}
function decoCard(t, k) {
  const d = DECOS[t.deco[k]]; const cur = (t.dc && t.dc[k]) || 0;
  const bx = modal(`<h2>${d.label}</h2><p class="hint">Alegra a los peces del acuario. Puedes ponerla donde quieras sobre la arena.</p>
    <div class="sec">Cambiar color (gratis)</div>${swatches(t.deco[k], cur)}
    <div class="actions" style="flex-direction:column"><button class="btn" id="dmv">${icon('move')} Mover</button><button class="btn alt" id="ddel">${icon('trash')} Quitar (recuperas ${eur(d.price / 2)})</button><button class="btn alt" id="dx">Cerrar</button></div>`);
  bx.querySelectorAll('[data-ci]').forEach((x) => (x.onclick = () => { t.dc = t.deco.map((_, q) => (t.dc && t.dc[q]) || 0); t.dc[k] = +x.dataset.ci; bx.querySelectorAll('.sw').forEach((q) => q.classList.toggle('on', q === x)); Sound.play('tap'); if (sheet.name === 'tank') renderPanel(); save(); }));
  bx.querySelector('#dx').onclick = closeModal;
  bx.querySelector('#dmv').onclick = () => armDeco(t, k);
  bx.querySelector('#ddel').onclick = () => { closeModal(); removeDeco(t, k); };
}
eng.onLongPress = (sx, sy) => {
  if (modalOpen()) return false;
  if (close) { const rec = tankGroups.get(close); const key = rec && eng.pick(sx, sy, [rec.deco], 'deco'); if (!key) return false; const [tid, k] = key.split(':'); return beginDecoMove(tankOf(tid), +k); }
  const tid = eng.pick(sx, sy, tankList(), 'tank'); return tid ? beginTankMove(tankOf(tid), sx, sy) : false;
};
eng.onDragStart = (sx, sy) => {
  if (!armed) return false;
  if (armed.kind === 'tank') { const tp = tankPos(armed.t); const p = eng.ground(sx, sy); if (!p) return false; tmv = { kind: 'tank', t: armed.t, gx: p.x - tp.x, gz: p.z - tp.z, pos: { ...tp }, ok: true }; trash.show(fishIn(armed.t).length ? 'Vacíalo antes de quitarlo' : 'Suelta aquí para quitarlo'); }
  else if (!beginDecoMove(armed.t, armed.k)) return false;
  tankMoveDrag(sx, sy); return true;
};
eng.onDragMove = (sx, sy) => { if (tmv) tankMoveDrag(sx, sy); };
eng.onDragEnd = (cancel) => { if (tmv) endTankMove(cancel); };
eng.onTap = (sx, sy) => {
  if (modalOpen() || armed) return;
  if (close) {
    const rec = tankGroups.get(close); if (!rec) return;
    const eggs = eng.pick(sx, sy, rec.eggs ? [rec.eggs] : [], 'eggs');
    if (eggs) { followId = null; eng.cam.follow = null; $('#fishcard').dataset.eggs = close; return closeCard(true); }
    delete $('#fishcard').dataset.eggs;
    const fid = eng.pick(sx, sy, [...rec.fish.values()].map((m) => m.g), 'fish'); if (fid) return followFish(fid);
    const dk = eng.pick(sx, sy, [rec.deco], 'deco'); if (dk) decoCard(tankOf(close), +dk.split(':')[1]);
    return;
  }
  const tid = eng.pick(sx, sy, [...tankGroups.values()].map((r) => r.g), 'tank'); if (tid) openTank(tid);
};
eng.onDoubleTap = (sx, sy) => {
  if (close) { eng.cam.distT = Math.max(eng.cam.min, eng.cam.dist * 0.6); return; }
  const tid = eng.pick(sx, sy, [...tankGroups.values()].map((r) => r.g), 'tank'); if (tid) enterClose(tid);
};
sheet.onClose = () => { if (entering) return; focusTank = null; eng.cam.pitch = 0.55; eng.focus(CX, 0.5, overviewDist()); eng.cam.target.y = 0.8; hud(); };

document.querySelector('#speeds').innerHTML = [['pause', 0], ['play', 1], ['ff', 2], ['fff', 3]].map(([ic, s]) => `<button data-s="${s}">${icon(ic)}</button>`).join('');
document.querySelector('#speeds').onclick = (e) => { const b = e.target.closest('button'); if (b) { st.speed = +b.dataset.s; hud(); } };
document.querySelector('#tools').innerHTML = [['tanks', 'box', 'Acuarios'], ['buy', 'fish', 'Comprar'], ['clients', 'users', 'Clientes'], ['album', 'book', 'Álbum'], ['shop', 'shop', 'Mejoras'], ['info', 'chart', 'Tienda']].map(([t, ic, l]) => `<button data-t="${t}" style="position:relative">${icon(ic)}<span>${l}</span>${t === 'clients' ? '<i class="dot" hidden></i>' : ''}</button>`).join('');
document.querySelector('#tools').onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.t === 'tanks') { const t = st.tanks[(st.tanks.findIndex((q) => q.id === focusTank) + 1) % st.tanks.length]; openTank(t.id); } else openPanel(b.dataset.t); };
$('#money .badge').innerHTML = icon('coin'); $('#clock .badge').innerHTML = icon('fish'); $('#rep .badge').innerHTML = icon('star'); $('#back a').innerHTML = icon('home');
$('#camctl').innerHTML = `<button class="glass" data-r="1">${icon('rotate')}</button><button class="glass" data-r="-1" style="transform:scaleX(-1)">${icon('rotate')}</button>`;
$('#camctl').onclick = (e) => { const b = e.target.closest('button'); if (b) eng.spin(+b.dataset.r * Math.PI / 6); };

let uiT = 0, saveT = 0;
eng.onFrame = (dt) => {
  if (tmv && tmv.kind === 'tank' && tmv.sx != null) { const { dx, dy } = edgePan(tmv.sx, tmv.sy); if (dx || dy) { eng.pan(dx, dy); eng.lastInput = performance.now(); tankMoveDrag(tmv.sx, tmv.sy); } }
  const paused = modalOpen() || st.speed === 0;
  if (!paused) { let g = dt * SPEEDS[st.speed]; while (g > 0) { const s = Math.min(g, 2); tick(s); g -= s; } }
  eng.activity = close ? 'close' : focusTank ? 'busy' : 'calm';
  if (close && uiT > 2.9) renderCloseBar();
  uiT += dt; saveT += dt;
  if (uiT > 3) { uiT = 0; hud(); if (sheet.name === 'tank' && !document.activeElement?.matches('input')) { const sc = sheet.body.scrollTop; renderPanel(); sheet.body.scrollTop = sc; } }
  if (saveT > 20) { saveT = 0; save(); }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) { save(); cloud.now(); } else { offline(); hud(); } });
window.addEventListener('pagehide', save);
if (store.load(KEY)) offline(); else { save(); say('marina', 'Te damos la bienvenida a Arrecife', 'Soy Marina. Pasé media vida bajo el mar y ahora me toca enseñarte a cuidarlo desde aquí. Sin prisa, que los peces lo notan.', '¡A abrir la tienda!', null, `<p>Tu tienda de peces acaba de abrir.</p><ul style="padding-left:18px;line-height:1.6"><li>Toca un <b>acuario</b> para ver sus peces, darles de comer, limpiar y decorar.</li><li><b>Cría</b> un macho y una hembra: las crías mezclan rasgos y a veces salen variedades nuevas.</li><li>Completa el <b>álbum</b> de ${TOTAL_COMBOS} variedades.</li><li>Atiende a los <b>clientes</b>: piden peces concretos y pagan bien.</li></ul>`); }
if (!st.requests.length) newRequest();
hud();
Sound.init('acuario');
$('#fishcard').addEventListener('click', (ev) => { const b = ev.target.closest('[data-med]'); if (b) { medicine(tankOf(b.dataset.med)); closeCard(true); } });
window.reef = { eng, THREE, tick, get st() { return st; } };

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
