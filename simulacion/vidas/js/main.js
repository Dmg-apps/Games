import * as Sim from './sim.js';
import { OBJECTS, OBJ_IC, SOCIALS, GENDERS } from './data.js';
import { IsoRenderer } from './render.js';
import { Renderer3D, webglAvailable } from './render3d.js';
import { UI } from './ui.js';
import * as Cloud from './cloud.js';
import * as Notify from './notify.js';

const SPEEDS = [0, 1, 3, 10]; // minutos de juego por segundo real

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    // 3D si el móvil lo admite; si no, la vista isométrica 2D
    // Calidad: 'ligera' (2D), 'equilibrada' (3D ahorro, por defecto en móviles) o 'alta' (3D completo)
    const phone = Math.min(screen.width, screen.height) < 700;
    this.quality = localStorage.getItem('vidas_quality') || (phone ? 'equilibrada' : 'alta');
    this.maxFps = this.quality === 'alta' ? 60 : 30; this.lastRender = 0; this.lastInput = performance.now();
    try { this.renderer = webglAvailable() && this.quality !== 'ligera' ? new Renderer3D(this.canvas, this.quality) : new IsoRenderer(this.canvas); }
    catch (e) { console.warn('Sin 3D:', e); this.renderer = new IsoRenderer(this.canvas); }
    this.is3D = this.renderer instanceof Renderer3D;
    this.ui = new UI(this);
    this.view = { build: false, ghost: null, selected: null, active: null };
    this.state = null;
    this.last = performance.now(); this.uiT = 0; this.saveT = 0;
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('online', () => { if (this.state && Cloud.meta().pending) this.cloudPush(true); });
    navigator.storage?.persist?.().catch(() => {}); // pide al navegador que no borre los datos guardados
    this.lastPush = 0;
    this.setupInput();
    document.addEventListener('visibilitychange', () => {
      if (!this.state) return;
      if (document.hidden) { this.save(true); this.scheduleNotifications(); }
      else { Notify.clearQueue(); this.resumeFromBackground(); }
    });
    window.addEventListener('pagehide', () => this.save());

    this.showTitle();
    requestAnimationFrame((t) => this.loop(t));
  }
  // Pantalla de inicio con una familia de demostración viviendo detrás
  showTitle() {
    const saved = Sim.load();
    this.demo = Sim.newGame([
      { name: 'Alex', gender: 'x', look: Sim.randomLook('x'), partnerIdx: 1 },
      { name: 'Sol', gender: 'f', look: Sim.randomLook('f'), partnerIdx: 0 },
      { name: 'Leo', gender: 'm', age: 'nino', look: Sim.randomLook('m') },
    ], 'Demo');
    this.demo.settings.autonomy = 'normal'; this.demo.time = 17 * 60 + 30; this.demo.lastHour = 17;
    this.state = null; this.ui.showHud(false);
    this.renderer.centerOn(4.5, 4.5, true);
    const onNew = () => this.ui.createFamily((defs, surname) => this.start(defs, surname), () => this.showTitle());
    this.ui.showTitle(!!saved, () => this.continueGame(), onNew);
    // ¿Hay una partida en la nube? (por ejemplo, en un móvil nuevo)
    Cloud.pull().then((remote) => {
      this.remote = remote;
      if (remote && !saved && !this.state) this.ui.showTitle(true, () => this.continueGame(), onNew, remote.family);
    });
  }
  continueGame() {
    const local = Sim.load(); const remote = this.remote;
    if (remote && (!local || remote.savedAt > (local.lastSaved || 0) + 5000)) {
      if (!local) return this.loadState(remote.state);
      const when = new Date(remote.savedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
      return this.ui.choose('Partida más reciente en la nube', `Hay una copia en la nube guardada el ${when}, más nueva que la de este móvil. ¿Cuál quieres usar?`,
        [['Usar la de la nube', () => this.loadState(remote.state)], ['Usar la de este móvil', () => this.loadState(local)]]);
    }
    if (!local) return this.showTitle();
    this.loadState(local);
  }
  loadState(saved) {
    if (!saved || saved.v !== 1) return this.showTitle();
    Sim.ensureWalls(saved);
    if (!saved.settings.autoV2) { saved.settings.autonomy = 'total'; saved.settings.autoV2 = true; } // ahora hacen su vida por defecto
    if (saved.pendingEvent) setTimeout(() => this.ui.chooseEvent(saved.pendingEvent), 800);
    this.demo = null; this.state = saved;
    globalThis.__simTime = saved.time;
    const sum = Sim.offlineProgress(saved, Date.now() - saved.lastSaved);
    this.afterStart();
    if (sum) this.ui.showOffline(sum);
  }
  start(defs, surname) {
    Sim.wipe(); this.demo = null;
    this.state = Sim.newGame(defs, surname);
    globalThis.__simTime = this.state.time;
    this.afterStart();
    const u = this.ui;
    u.info(`Bienvenida, familia ${surname}`,
      `<ul>${u.li('user', 'Toca a alguien de tu familia (abajo) para controlarle.')}
      ${u.li('pin', 'Toca muebles, personas o el suelo para darle órdenes.')}
      ${u.li('heart', 'Tienen <b>vida propia</b>: se cuidan, trabajan, salen y persiguen sus sueños aunque no estés. Tú decides cuando quieras.')}
      ${u.li('phone', 'Busca trabajo en el teléfono, paga las facturas en el buzón e invita a gente.')}</ul>`, 'A jugar');
  }
  afterStart() {
    this.view.active = this.state.active;
    this.ui.showHud(true);
    this.renderer.centerOn(4.5, 4.5, true);
    this.ui.update();
    this.save();
  }
  newGame() {
    this.exitBuild(); this.ui.closePanel(); Sim.wipe();
    this.showTitle();
  }
  save(forceCloud = false) {
    if (!this.state) return;
    Sim.save(this.state);
    if (forceCloud || Date.now() - this.lastPush > 60000) this.cloudPush();
  }
  async cloudPush(manual = false) {
    if (!this.state || !Cloud.session()) return;
    this.lastPush = Date.now();
    const r = await Cloud.push(this.state);
    if (manual) this.ui.toast(r.ok ? 'Partida subida a la nube' : r.reason === 'offline' ? 'Sin conexión: se subirá al volver internet' : 'No se ha podido subir ahora', r.ok ? 'good' : 'warn');
    if (this.ui.panel === 'menu') this.ui.renderMenu();
  }
  async cloudLogin(mode, email, pass) {
    try {
      if (mode === 'up') await Cloud.signUp(email, pass); else await Cloud.signIn(email, pass);
      const remote = await Cloud.pull();
      if (remote && this.state && remote.savedAt > (this.state.lastSaved || 0) + 5000) {
        this.ui.choose('Ya tienes una partida en la nube', `En la nube está la familia ${remote.family}. ¿Cuál quieres conservar?`,
          [['La de la nube', () => { Sim.save(remote.state); this.exitBuild(); this.ui.closePanel(); this.loadState(Sim.load()); }], ['La de este móvil', () => this.cloudPush(true)]]);
      } else { await this.cloudPush(true); }
    } catch (e) { this.ui.toast(e.message, 'bad'); }
    if (this.ui.panel === 'menu') this.ui.renderMenu();
  }
  // Calcula qué pasará con la app cerrada y deja los avisos en la nube para enviarlos a su hora
  scheduleNotifications() {
    if (!this.state || !Notify.enabled() || !Cloud.session()) return;
    const pending = Sim.drainEvents(); const keepTime = globalThis.__simTime;
    const queue = []; const seen = new Set(); const now = Date.now();
    let clone = JSON.parse(JSON.stringify(this.state)); let elapsed = 0;
    const add = (h, title, body) => { const key = title + body; if (seen.has(key)) return; seen.add(key); queue.push({ at: now + h * 3600e3, title, body }); };
    for (const h of [0.5, 1, 2, 4, 8, 12, 24]) {
      const sum = Sim.offlineProgress(clone, (h - elapsed) * 3600e3); elapsed = h;
      if (!sum) continue;
      for (const l of sum.log) if (!/facturas pendientes/.test(l) || h >= 4) add(h, `Familia ${clone.surname}`, l.replace(/[\p{Extended_Pictographic}]\uFE0F?/gu, '').trim());
      for (const s of Sim.householdSims(clone)) {
        const low = Object.entries(s.needs).filter(([, v]) => v < 30).map(([n]) => n);
        if (s.age === 'bebe' && low.length) add(h, `${s.name} te necesita`, 'El bebé está llorando y necesita cuidados.');
        else if (low.length >= 2) add(h, `${s.name} te necesita`, `Tiene ${low.map((n) => ({ hambre: 'hambre', energia: 'sueño', higiene: 'ganas de ducharse', diversion: 'aburrimiento', social: 'ganas de compañía', vejiga: 'ganas de ir al baño' }[n])).join(' y ')}.`);
      }
    }
    add(24, `Familia ${this.state.surname}`, 'Te echan de menos. ¿Pasas a verles?');
    Sim.drainEvents(); globalThis.__simTime = keepTime;
    for (const ev of pending) this.handleEvent(ev);
    Notify.uploadQueue(queue.slice(0, 8));
  }
  async enableNotifications() {
    if (Notify.needsInstall()) return this.ui.info('Añádela a la pantalla de inicio', '<p>En iPhone las notificaciones solo funcionan si abres Vidas desde la pantalla de inicio: en Safari pulsa <b>Compartir → Añadir a pantalla de inicio</b> y ábrela desde ahí.</p>');
    const r = await Notify.enable();
    if (!r.ok) this.ui.toast(r.reason === 'denied' ? 'Has bloqueado las notificaciones. Actívalas en los ajustes del móvil.' : 'Este navegador no admite notificaciones', 'warn');
    else this.ui.toast(r.push ? 'Notificaciones activadas, también con la app cerrada' : Cloud.session() ? 'Notificaciones activadas con la app abierta' : 'Activadas. Inicia sesión en la nube para recibirlas también con la app cerrada', 'good');
    if (this.ui.panel === 'menu') this.ui.renderMenu();
  }
  cloudLogout() { Cloud.signOut(); this.ui.toast('Sesión cerrada. La partida sigue en este móvil.', 'info'); this.ui.renderMenu(); }
  onResize() {
    const wasPortrait = this.portrait; this.renderer.resize();
    this.portrait = window.innerHeight >= window.innerWidth;
    if (wasPortrait !== undefined && wasPortrait !== this.portrait) { this.renderer.fit(); this.renderer.centerOn(4.5, 4.5, true); }
    this.ui.movePill();
  }
  resumeFromBackground() {
    if (!this.state) return;
    const sum = Sim.offlineProgress(this.state, Date.now() - this.state.lastSaved);
    this.state.lastSaved = Date.now();
    this.last = performance.now();
    if (sum) this.ui.showOffline(sum);
  }
  setSpeed(s) { if (this.state?.settings.realTime && s > 1) { this.ui.toast('Con el reloj real no se puede acelerar el tiempo', 'info'); s = 1; } if (this.state) { this.state.speed = s; if (s > 0 && this.view.build) this.exitBuild(); this.ui.update(); } }
  selectSim(id, center) {
    const s = this.state.sims[id]; if (!s) return;
    this.state.active = id; this.view.active = id;
    if (center && s.location === 'casa') this.renderer.centerOn(s.x, s.y);
    if (s.location !== 'casa') this.ui.toast(`${s.name} está ${Sim.whereIs(this.state, s)}`, 'info', s.id);
    this.ui.sig = ''; this.ui.update();
  }
  centerOnSim(id) { const s = this.state.sims[id]; if (s && s.location === 'casa') this.renderer.centerOn(s.x, s.y); }

  // ---------- construcción ----------
  enterBuild() {
    if (this.view.build) return;
    this.view.build = true; this.prevSpeed = this.state.speed || 1; this.state.speed = 0;
    this.ui.renderBuildBar(); this.ui.update();
  }
  exitBuild() {
    if (!this.view.build) return;
    this.view.build = false; this.view.ghost = null; this.view.selected = null; this.view.wallTool = null; this.view.wallPreview = null;
    if (this.state) this.state.speed = this.prevSpeed || 1;
    this.ui.renderBuildBar(); this.ui.update();
  }
  startPlacing(type) {
    const c = this.renderer.screenToTile(window.innerWidth / 2, window.innerHeight / 2);
    const x = Math.max(0, Math.min(Sim.GRID - 1, c.x)), y = Math.max(0, Math.min(Sim.GRID - 1, c.y));
    this.view.selected = null;
    this.view.ghost = { type, x, y, rot: 0, mode: 'new' };
    this.validateGhost(); this.ui.renderBuildBar();
  }
  validateGhost() { const g = this.view.ghost; if (g) g.ok = Sim.canPlace(this.state, g.type, g.x, g.y, g.rot, g.objId); }
  rotateGhost() { const g = this.view.ghost; g.rot = (g.rot + 1) % 4; this.validateGhost(); }
  confirmGhost() {
    const g = this.view.ghost; this.validateGhost();
    if (!g.ok) return this.ui.toast('No cabe ahí', 'warn');
    if (g.mode === 'new') {
      if (this.state.money < OBJECTS[g.type].price) return this.ui.toast('No hay dinero suficiente', 'warn');
      Sim.placeObject(this.state, g.type, g.x, g.y, g.rot);
      this.ui.toast(`${OBJECTS[g.type].name} colocado/a`, 'good');
      if (this.state.money < OBJECTS[g.type].price) this.view.ghost = null;
    } else {
      const o = Sim.objById(this.state, g.objId); Sim.moveObject(this.state, o, g.x, g.y, g.rot); this.view.ghost = null;
    }
    this.ui.renderBuildBar(); this.ui.update();
  }
  cancelGhost() { this.view.ghost = null; this.ui.renderBuildBar(); }
  moveSelected() {
    const o = Sim.objById(this.state, this.view.selected); if (!o) return;
    this.view.ghost = { type: o.type, x: o.x, y: o.y, rot: o.rot, mode: 'move', objId: o.id };
    this.view.selected = null; this.validateGhost(); this.ui.renderBuildBar();
  }
  sellSelected() {
    const o = Sim.objById(this.state, this.view.selected); if (!o) return;
    Sim.sellObject(this.state, o); this.view.selected = null;
    this.ui.renderBuildBar(); this.ui.update();
  }

  // ---------- entrada táctil ----------
  setupInput() {
    const c = this.canvas; const ptrs = new Map(); let moved = false, pinchD = 0, pinchA = null, start = null;
    let drag = null; // arrastre de un mueble en modo construcción
    c.addEventListener('pointerdown', (e) => {
      this.lastInput = performance.now();
      c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { moved = false; start = { x: e.clientX, y: e.clientY }; drag = this.view.build ? this.dragTarget(e.clientX, e.clientY) : null; }
      if (ptrs.size === 2) drag = null;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); pinchA = Math.atan2(b.y - a.y, b.x - a.x); moved = true; }
    });
    c.addEventListener('pointermove', (e) => {
      this.lastInput = performance.now();
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) {
        if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 9) { moved = true; if (drag) this.beginDrag(drag); }
        if (moved && drag?.wall) { this.view.wallPreview = this.wallSegments(drag.start, this.wallCorner(e.clientX, e.clientY)); }
        else if (moved && drag) this.dragTo(e.clientX, e.clientY, drag);
        else if (moved) this.renderer.pan(dx, dy);
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; // desplazar con dos dedos
        if (this.lastMid) this.renderer.pan(mid.x - this.lastMid.x, mid.y - this.lastMid.y);
        this.lastMid = mid;
        if (pinchD) this.renderer.zoomAt(d / pinchD, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinchD = d;
        const ang = Math.atan2(b.y - a.y, b.x - a.x); // girar con dos dedos (3D)
        if (pinchA !== null && this.renderer.rotate) { let da = ang - pinchA; da = Math.atan2(Math.sin(da), Math.cos(da)); this.renderer.rotate(-da); }
        pinchA = ang;
      }
    });
    const up = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size === 0 && moved && drag?.wall) {
        const segs = (this.view.wallPreview || []).filter((q) => !q.bad); this.view.wallPreview = null;
        const n = segs.length ? Sim.addWalls(this.state, segs) : 0;
        if (n) this.ui.toast(`${n} tramo${n > 1 ? 's' : ''} de pared (−${n * Sim.WALL_PRICE} €)`, 'good');
        drag = null; this.ui.update();
      } else if (ptrs.size === 0 && moved && drag) { this.endDrag(); drag = null; }
      if (ptrs.size === 0 && !moved && e.type === 'pointerup') this.tap(e.clientX, e.clientY);
      if (ptrs.size < 2) { pinchD = 0; pinchA = null; this.lastMid = null; }
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.renderer.zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY); }, { passive: false });
  }

  // ---------- paredes ----------
  setWallTool(tool) {
    this.view.wallTool = tool; this.view.wallPreview = null; this.view.selected = null; this.view.ghost = null;
    this.ui.renderBuildBar();
  }
  wallCorner(x, y) { const w = this.renderer.screenToWorld(x, y); return { x: Math.max(0, Math.min(Sim.GRID, Math.round(w.x))), y: Math.max(0, Math.min(Sim.GRID, Math.round(w.y))) }; }
  wallSegments(a, b) {
    const segs = [];
    if (Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)) for (let x = Math.min(a.x, b.x); x < Math.max(a.x, b.x); x++) segs.push({ d: 'h', x, y: a.y });
    else for (let y = Math.min(a.y, b.y); y < Math.max(a.y, b.y); y++) segs.push({ d: 'v', x: a.x, y });
    return segs.map((q) => ({ ...q, bad: !!Sim.wallAt(this.state, q.d, q.x, q.y) || (q.d === 'h' && (q.y === 0 || q.y >= Sim.GRID)) || (q.d === 'v' && (q.x === 0 || q.x >= Sim.GRID)) }));
  }
  wallTap(x, y) {
    const st = this.state; const w = this.renderer.screenToWorld(x, y); const e = Sim.nearestEdge(w.x, w.y);
    if (e.dist > 0.42) return;
    const q = Sim.wallAt(st, e.d, e.x, e.y);
    if (this.view.wallTool === 'wall') { if (!q && Sim.addWalls(st, [e])) this.ui.toast(`Pared construida (−${Sim.WALL_PRICE} €)`, 'good'); }
    else if (!q) this.ui.toast('Toca justo encima de una pared', 'warn');
    else if (this.view.wallTool === 'door') { if (Sim.toggleDoor(st, q)) { if (q.door) q.window = false; this.ui.toast(q.door ? `Puerta puesta (−${Sim.DOOR_PRICE} €)` : 'Puerta quitada', 'good'); } }
    else if (this.view.wallTool === 'window') { if (Sim.toggleWindow(st, q)) this.ui.toast(q.window ? 'Ventana puesta' : 'Ventana quitada', 'good'); }
    else { Sim.removeWall(st, q); this.ui.toast('Pared quitada', 'good'); }
    this.view.wallHover = { d: e.d, x: e.x, y: e.y }; clearTimeout(this.hoverT); this.hoverT = setTimeout(() => (this.view.wallHover = null), 600);
    this.ui.update();
  }

  // ---------- arrastrar muebles ----------
  dragTarget(x, y) {
    if (this.view.wallTool === 'wall') return { wall: true, start: this.wallCorner(x, y) };
    if (this.view.wallTool) return null;
    const st = this.state; const g = this.view.ghost;
    const t = this.renderer.screenToTile(x, y);
    if (g) {
      const f = Sim.footprint(g.type, g.rot);
      if (t.x >= g.x && t.x < g.x + f.w && t.y >= g.y && t.y < g.y + f.h) return { ghost: true, ox: t.x - g.x, oy: t.y - g.y };
      return null;
    }
    const o = this.renderer.pickObject(st, x, y) || Sim.objectAt(st, t.x, t.y);
    if (!o || OBJECTS[o.type].fixed) return null;
    return { obj: o.id, ox: Math.max(0, t.x - o.x), oy: Math.max(0, t.y - o.y) };
  }
  beginDrag(d) {
    if (d.obj) { this.view.selected = d.obj; this.moveSelected(); }
    if (navigator.vibrate) navigator.vibrate(12);
  }
  dragTo(x, y, d) {
    const g = this.view.ghost; if (!g) return;
    const t = this.renderer.screenToTile(x, y - 20); // un poco por encima del dedo para verlo
    const f = Sim.footprint(g.type, g.rot);
    const nx = Math.max(0, Math.min(Sim.GRID - f.w, t.x - Math.min(d.ox, f.w - 1))), ny = Math.max(0, Math.min(Sim.GRID - f.h, t.y - Math.min(d.oy, f.h - 1)));
    if (nx !== g.x || ny !== g.y) { g.x = nx; g.y = ny; this.validateGhost(); }
  }
  endDrag() {
    const g = this.view.ghost; if (!g) return;
    if (g.mode === 'move' && g.ok) this.confirmGhost();
    else this.ui.renderBuildBar();
  }
  // Ir andando hasta una casilla, al momento
  walkTo(me, x, y) {
    const st = this.state;
    if (me.cur && !['ko', 'leave', 'partner'].includes(me.cur.kind)) Sim.cancelItem(st, me, -1);
    me.queue = me.queue.filter((q) => q.kind !== 'go');
    Sim.queueGo(st, me, x, y);
    if (me.queue.length > 1) me.queue.unshift(me.queue.pop());
    this.renderer.addMarker(x, y);
    this.ui.update();
  }
  editObject(o) {
    this.ui.closePanel(); this.enterBuild(); this.view.selected = o.id; this.moveSelected();
  }

  tap(x, y) {
    const st = this.state; if (!st) return;
    const t = this.renderer.screenToTile(x, y);
    const inGrid = t.x >= 0 && t.y >= 0 && t.x < Sim.GRID && t.y < Sim.GRID;
    if (this.view.build) {
      if (this.view.wallTool) return this.wallTap(x, y);
      if (this.view.ghost) { if (inGrid) { this.view.ghost.x = t.x; this.view.ghost.y = t.y; this.validateGhost(); } return; }
      const o = this.renderer.pickObject(st, x, y) || (inGrid && Sim.objectAt(st, t.x, t.y));
      this.view.selected = o ? o.id : null; this.ui.renderBuildBar();
      return;
    }
    const me = st.sims[st.active];
    const target = this.renderer.pickSim(st, x, y);
    const needMe = () => {
      if (!me) return false;
      if (me.location !== 'casa') { this.ui.toast(`${me.name} está ${Sim.whereIs(st, me)}`, 'warn'); return false; }
      if (me.age === 'bebe') { this.ui.toast('Un bebé no puede hacer nada solo. Elige a un adulto.', 'warn'); return false; }
      return true;
    };
    const pet = !target && this.renderer.pickPet?.(st, x, y);
    if (pet) {
      if (!needMe()) return;
      const opts = Sim.petActions(st, me, pet).map((a) => ({ icon: a.ic, label: a.label, disabled: a.disabled, cls: 'care', run: () => { Sim.queuePet(st, me, a.id, pet.id); this.ui.update(); } }));
      this.ui.showPie(x, y, { icon: 'heart', title: pet.name, sub: `${pet.species === 'perro' ? 'Perro' : 'Gato'} · ${Object.entries(pet.needs).filter(([, v]) => v < 35).length ? 'necesita atención' : 'feliz'}` }, opts);
      return;
    }
    if (target) {
      const opts = [];
      if (target.home && target.id !== st.active) opts.push({ icon: 'user', label: `Controlar a ${target.name}`, cls: 'main', run: () => this.selectSim(target.id) });
      if (target.id === st.active) {
        opts.push({ icon: 'heart', label: 'Ver su estado', cls: 'main', run: () => this.ui.openPanel('needs') });
      } else if (me && me.location === 'casa' && me.age !== 'bebe') {
        for (const a of Sim.socialActions(st, me, target)) {
          const d = SOCIALS[a.id];
          opts.push({ ...a, cls: d.romantic ? 'romantic' : d.care ? 'care' : d.bad ? 'bad' : '', run: () => { Sim.queueSocial(st, me, a.id, target.id); this.ui.update(); } });
        }
      }
      const rel = me && me !== target ? Sim.relLabel(st, me, target) : null;
      this.ui.showPie(x, y, { sim: target, title: target.name, sub: [target.home ? null : 'De visita', rel, GENDERS[target.gender].label].filter(Boolean).join(' · ') }, opts);
      return;
    }
    const o = this.renderer.pickObject(st, x, y) || (inGrid && Sim.objectAt(st, t.x, t.y));
    if (!o && !inGrid) return;
    if (o && !OBJECTS[o.type].walkable) {
      if (!needMe()) return;
      const opts = Sim.objectActions(st, me, o).map((a) => ({ ...a, run: () => { Sim.queueObject(st, me, a.id, o.id); this.ui.update(); } }));
      if (!OBJECTS[o.type].fixed) opts.push({ icon: 'move', label: 'Mover este mueble', cls: 'main', run: () => this.editObject(o) });
      this.ui.showPie(x, y, { icon: OBJ_IC[o.type], title: OBJECTS[o.type].name, sub: me.name }, opts);
      return;
    }
    if (!needMe()) return;
    this.walkTo(me, t.x, t.y);
  }

  // ---------- bucle ----------
  // ---------- fotos de la familia ----------
  photos() { try { return JSON.parse(localStorage.getItem('vidas_photos')) || []; } catch { return []; } }
  deletePhoto(i) { const p = this.photos(); p.splice(i, 1); localStorage.setItem('vidas_photos', JSON.stringify(p)); }
  takePhoto() {
    if (!this.state) return;
    this.renderer.render(this.state, this.view); // dibuja y captura en el mismo instante
    const src = this.canvas, ov = document.getElementById('overlay');
    const W = 360, H = Math.round(W * src.clientHeight / src.clientWidth);
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    x.fillStyle = getComputedStyle(document.body).backgroundImage.includes('gradient') ? '#9fd0ee' : '#7fc3ee'; x.fillRect(0, 0, W, H);
    try { x.drawImage(src, 0, 0, W, H); if (ov) x.drawImage(ov, 0, 0, W, H); } catch (e) { return this.ui.toast('No se ha podido hacer la foto', 'warn'); }
    const img = c.toDataURL('image/jpeg', 0.72);
    const list = this.photos(); list.unshift({ t: this.state.time, img }); if (list.length > 9) list.length = 9;
    try { localStorage.setItem('vidas_photos', JSON.stringify(list)); } catch { list.pop(); localStorage.setItem('vidas_photos', JSON.stringify(list)); }
    let f = document.getElementById('flash'); if (!f) { f = document.createElement('div'); f.id = 'flash'; document.body.appendChild(f); }
    f.classList.add('on'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('on')));
    this.ui.toast('Foto guardada en Gente → Recuerdos', 'good');
  }
  setQuality(q) { localStorage.setItem('vidas_quality', q); this.save(); location.reload(); }
  // ¿Toca dibujar? Limita las imágenes por segundo y casi para cuando no se mueve nada
  shouldRender(t) {
    const st = this.state;
    const camMoving = !!this.renderer.cam?.tx || this.renderer.cam?.yawT != null || t - this.lastInput < 1200;
    const shown = st || this.demo;
    const walking = shown && Object.values(shown.sims).some((s) => s.location === 'casa' && s.path?.length);
    // solo a tope mientras tocas o se mueve la cámara; si nada se mueve, muy pocas imágenes
    let fps = camMoving ? this.maxFps : walking ? 20 : 10;
    if (st && st.speed === 0 && !camMoving) fps = 4;
    if (!document.getElementById('modal').hidden) fps = Math.min(fps, 8);
    if (this.view.build && !camMoving) fps = Math.min(fps, 12);
    if (t - this.lastRender < 1000 / fps - 2) return false;
    this.lastRender = t; return true;
  }
  loop(t) {
    const dtReal = Math.min(0.25, (t - this.last) / 1000); this.last = t;
    if (this.demo && !this.state) {
      Sim.tick(this.demo, dtReal * 1.5); Sim.drainEvents();
      if (this.shouldRender(t)) this.renderer.render(this.demo, { active: null });
    }
    const st = this.state;
    if (st) {
      // si no estás (un minuto sin tocar la pantalla), hacen su vida por su cuenta
      const away = t - this.lastInput > 60000;
      if (away !== !!st._away) { st._away = away; if (!away && st.settings.autonomy !== 'total') this.ui.toast('Has vuelto: vuelves a llevar tú el control', 'info'); }
      let dt = st.settings.realTime ? dtReal / 60 : dtReal * SPEEDS[st.speed]; // con reloj real, 1 minuto de juego por minuto
      if (!document.getElementById('modal').hidden) dt = 0;
      while (dt > 0) { const step = Math.min(dt, 1.5); Sim.tick(st, step); dt -= step; }
      for (const ev of Sim.drainEvents()) this.handleEvent(ev);
      if (this.shouldRender(t)) this.renderer.render(st, this.view);
      this.uiT += dtReal; this.saveT += dtReal;
      if (this.uiT > 0.25) { this.uiT = 0; this.ui.update(); }
      if (this.saveT > 15) { this.saveT = 0; this.save(); }
    }
    requestAnimationFrame((tt) => this.loop(tt));
  }
  handleEvent(ev) {
    if (ev.type === 'toast') {
      this.ui.toast(ev.msg, ev.kind, ev.simId);
      if (ev.kind === 'bad' || ev.kind === 'warn') Notify.local(`Familia ${this.state?.surname || ''}`, ev.msg.replace(/[\p{Extended_Pictographic}]\uFE0F?/gu, '').trim(), ev.simId || ev.kind);
    }
    else if (ev.type === 'fade') this.ui.fade();
    else if (ev.type === 'hearts') this.renderer.addHearts(ev.x, ev.y);
    else if (ev.type === 'birth') this.ui.nameBaby(ev.babyId, ev.adopted);
    else if (ev.type === 'choice') this.ui.chooseEvent(ev.event);
    else if (ev.type === 'letter') this.ui.readLetter(ev.letter);
    else if (ev.type === 'ui') {
      if (ev.ui === 'job') this.ui.chooseJob(ev.simId);
      if (ev.ui === 'invite') this.ui.chooseInvite();
      if (ev.ui === 'adopt') this.ui.confirmAdopt();
      if (ev.ui === 'outing') this.ui.chooseOuting(ev.simId);
      if (ev.ui === 'pet') this.ui.choosePet();
      if (ev.ui === 'letter') this.ui.writeLetter(ev.simId);
    }
  }
}

window.game = new Game();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  // Si hay versión nueva, se instala y la página se recarga una vez para usarla
  const hadController = !!navigator.serviceWorker.controller; let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return; reloaded = true;
    window.game?.save?.(); location.reload();
  });
  navigator.serviceWorker.register('../sw.js', { scope: '../' }).then((reg) => {
    reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
}
