import * as Sim from './sim.js';
import { OBJECTS } from './data.js';
import { IsoRenderer } from './render.js';
import { UI } from './ui.js';

const SPEEDS = [0, 1, 3, 10]; // minutos de juego por segundo real

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new IsoRenderer(this.canvas);
    this.ui = new UI(this);
    this.view = { build: false, ghost: null, selected: null, active: null };
    this.state = null;
    this.last = performance.now(); this.uiT = 0; this.saveT = 0;
    window.addEventListener('resize', () => this.renderer.resize());
    this.setupInput();
    document.addEventListener('visibilitychange', () => {
      if (!this.state) return;
      if (document.hidden) this.save();
      else this.resumeFromBackground();
    });
    window.addEventListener('pagehide', () => this.save());

    const saved = Sim.load();
    if (saved) {
      this.state = saved;
      globalThis.__simTime = saved.time;
      const sum = Sim.offlineProgress(saved, Date.now() - saved.lastSaved);
      this.afterStart();
      if (sum) this.ui.showOffline(sum);
    } else this.ui.createFamily((defs, surname) => this.start(defs, surname));
    requestAnimationFrame((t) => this.loop(t));
  }
  start(defs, surname) {
    this.state = Sim.newGame(defs, surname);
    globalThis.__simTime = this.state.time;
    this.afterStart();
    this.ui.info('¡Bienvenidos a casa! 🏡',
      `<p>Esta es la casa de la familia ${surname}.</p><ul>
      <li>Toca a alguien de tu familia (abajo) para controlarlo.</li>
      <li>Toca objetos, personas o el suelo para darle órdenes.</li>
      <li>Están en <b>autonomía baja</b>: si no les atiendes, lo pasarán mal. Puedes cambiarlo en el Menú.</li>
      <li>Busca trabajo en el teléfono, paga las facturas en el buzón 📬 e invita a los vecinos.</li></ul>`, '¡A jugar!');
  }
  afterStart() {
    this.view.active = this.state.active;
    this.renderer.centerOn(5, 5);
    this.ui.update();
    this.save();
  }
  newGame() {
    Sim.wipe(); this.state = null; this.exitBuild(); this.ui.closePanel();
    this.ui.createFamily((defs, surname) => this.start(defs, surname));
  }
  save() { if (this.state) Sim.save(this.state); }
  resumeFromBackground() {
    const sum = Sim.offlineProgress(this.state, Date.now() - this.state.lastSaved);
    this.state.lastSaved = Date.now();
    this.last = performance.now();
    if (sum) this.ui.showOffline(sum);
  }
  setSpeed(s) { if (this.state) { this.state.speed = s; if (s > 0 && this.view.build) this.exitBuild(); this.ui.update(); } }
  selectSim(id, center) {
    const s = this.state.sims[id]; if (!s) return;
    this.state.active = id; this.view.active = id;
    if (center && s.location === 'casa') this.renderer.centerOn(s.x, s.y);
    if (s.location !== 'casa') this.ui.toast(`${s.name} está ${s.location === 'escuela' ? 'en el cole' : 'trabajando'}`);
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
    this.view.build = false; this.view.ghost = null; this.view.selected = null;
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
    const c = this.canvas; const ptrs = new Map(); let moved = false, pinchD = 0, start = null;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { moved = false; start = { x: e.clientX, y: e.clientY }; }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinchD = Math.hypot(a.x - b.x, a.y - b.y); moved = true; }
    });
    c.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) {
        if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 9) moved = true;
        if (moved) this.renderer.pan(dx, dy);
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchD) this.renderer.zoomAt(d / pinchD, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinchD = d;
      }
    });
    const up = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size === 0 && !moved && e.type === 'pointerup') this.tap(e.clientX, e.clientY);
      if (ptrs.size < 2) pinchD = 0;
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.renderer.zoomAt(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY); }, { passive: false });
  }

  tap(x, y) {
    const st = this.state; if (!st) return;
    const t = this.renderer.screenToTile(x, y);
    const inGrid = t.x >= 0 && t.y >= 0 && t.x < Sim.GRID && t.y < Sim.GRID;
    if (this.view.build) {
      if (this.view.ghost) { if (inGrid) { this.view.ghost.x = t.x; this.view.ghost.y = t.y; this.validateGhost(); } return; }
      const o = this.renderer.pickObject(st, x, y) || (inGrid && Sim.objectAt(st, t.x, t.y));
      this.view.selected = o ? o.id : null; this.ui.renderBuildBar();
      return;
    }
    const me = st.sims[st.active];
    const target = this.renderer.pickSim(st, x, y);
    const needMe = () => {
      if (!me) return false;
      if (me.location !== 'casa') { this.ui.toast(`${me.name} no está en casa`, 'warn'); return false; }
      if (me.age === 'bebe') { this.ui.toast('Un bebé no puede hacer nada solo. Elige a un adulto.', 'warn'); return false; }
      return true;
    };
    if (target) {
      const opts = [];
      if (target.home && target.id !== st.active) opts.push({ icon: '👤', label: `Controlar a ${target.name}`, run: () => this.selectSim(target.id) });
      if (target.id === st.active) {
        opts.push({ icon: '❤️', label: 'Ver su estado', run: () => this.ui.openPanel('needs') });
      } else if (me && me.location === 'casa' && me.age !== 'bebe') {
        for (const a of Sim.socialActions(st, me, target)) opts.push({ ...a, run: () => { Sim.queueSocial(st, me, a.id, target.id); this.ui.update(); } });
      }
      this.ui.showPie(x, y, target.name + (target.home ? '' : ' (visita)'), opts);
      return;
    }
    const o = this.renderer.pickObject(st, x, y) || (inGrid && Sim.objectAt(st, t.x, t.y));
    if (!o && !inGrid) return;
    if (o && !OBJECTS[o.type].walkable) {
      if (!needMe()) return;
      const opts = Sim.objectActions(st, me, o).map((a) => ({ ...a, run: () => { Sim.queueObject(st, me, a.id, o.id); this.ui.update(); } }));
      this.ui.showPie(x, y, OBJECTS[o.type].name, opts);
      return;
    }
    if (!needMe()) return;
    this.ui.showPie(x, y, 'Suelo', [{ icon: '🚶', label: 'Ir aquí', run: () => { Sim.queueGo(st, me, t.x, t.y); this.ui.update(); } }]);
  }

  // ---------- bucle ----------
  loop(t) {
    const dtReal = Math.min(0.25, (t - this.last) / 1000); this.last = t;
    const st = this.state;
    if (st) {
      let dt = dtReal * SPEEDS[st.speed];
      if (!document.getElementById('modal').hidden) dt = 0;
      while (dt > 0) { const step = Math.min(dt, 1.5); Sim.tick(st, step); dt -= step; }
      for (const ev of Sim.drainEvents()) this.handleEvent(ev);
      this.renderer.render(st, this.view);
      this.uiT += dtReal; this.saveT += dtReal;
      if (this.uiT > 0.25) { this.uiT = 0; this.ui.update(); }
      if (this.saveT > 15) { this.saveT = 0; this.save(); }
    }
    requestAnimationFrame((tt) => this.loop(tt));
  }
  handleEvent(ev) {
    if (ev.type === 'toast') this.ui.toast(ev.msg, ev.kind, ev.simId);
    else if (ev.type === 'fade') this.ui.fade();
    else if (ev.type === 'hearts') this.renderer.addHearts(ev.x, ev.y);
    else if (ev.type === 'birth') this.ui.nameBaby(ev.babyId, ev.adopted);
    else if (ev.type === 'ui') {
      if (ev.ui === 'job') this.ui.chooseJob(ev.simId);
      if (ev.ui === 'invite') this.ui.chooseInvite();
      if (ev.ui === 'adopt') this.ui.confirmAdopt();
    }
  }
}

window.game = new Game();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
