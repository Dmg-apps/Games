// Gestos táctiles compartidos por los juegos de Simulación.
// - Un dedo: arrastrar la vista (con inercia) o, si el juego lo pide, dibujar/mover cosas.
// - Dos dedos: el gesto se "decide" al empezar para que no se mezcle: girar, pellizcar (acercar) o inclinar.
//   Al pellizcar también se desplaza siguiendo el punto medio. El zoom va hacia donde están los dedos.
// - Doble toque: acercar a ese punto. Rueda del ratón: zoom.
export class Gestures {
  constructor(el, h) {
    this.el = el; this.h = h; this.ptrs = new Map(); this.vel = { x: 0, y: 0, a: 0 }; this.lastTap = null; this.inertia = null;
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e)); el.addEventListener('pointercancel', (e) => this.up(e));
    el.addEventListener('wheel', (e) => { e.preventDefault(); h.onInput?.(); h.zoom?.(e.deltaY < 0 ? 1.12 : 0.89, e.clientX, e.clientY); }, { passive: false });
  }
  stopInertia() { if (this.inertia) cancelAnimationFrame(this.inertia); this.inertia = null; }
  down(e) {
    this.h.onInput?.(); this.stopInertia();
    try { this.el.setPointerCapture(e.pointerId); } catch { /* puntero sintético o ya liberado */ }
    this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    if (this.ptrs.size === 1) {
      this.start = { x: e.clientX, y: e.clientY, t: performance.now() }; this.moved = false; this.vel = { x: 0, y: 0, a: 0 };
      this.drag = !!this.h.onDragStart?.(e.clientX, e.clientY);
    } else if (this.ptrs.size === 2) {
      if (this.drag) { this.drag = false; this.h.onDragEnd?.(true); }
      const [a, b] = [...this.ptrs.values()];
      this.two = { d0: Math.hypot(a.x - b.x, a.y - b.y), a0: Math.atan2(b.y - a.y, b.x - a.x), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, mode: null, lastA: Math.atan2(b.y - a.y, b.x - a.x), lastD: Math.hypot(a.x - b.x, a.y - b.y), lastM: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
      this.moved = true;
    }
  }
  move(e) {
    const p = this.ptrs.get(e.pointerId); if (!p) return; this.h.onInput?.();
    const now = performance.now(); const dx = e.clientX - p.x, dy = e.clientY - p.y, dt = Math.max(1, now - p.t);
    p.x = e.clientX; p.y = e.clientY; p.t = now;
    if (this.ptrs.size === 1) {
      if (!this.moved && Math.hypot(e.clientX - this.start.x, e.clientY - this.start.y) > 8) this.moved = true;
      if (!this.moved) return;
      if (this.drag) return this.h.onDragMove?.(e.clientX, e.clientY);
      this.h.pan?.(dx, dy);
      // velocidad suavizada para la inercia
      this.vel.x = this.vel.x * 0.6 + (dx / dt) * 0.4 * 16; this.vel.y = this.vel.y * 0.6 + (dy / dt) * 0.4 * 16;
    } else if (this.ptrs.size === 2 && this.two) {
      const [a, b] = [...this.ptrs.values()]; const T = this.two;
      const d = Math.hypot(a.x - b.x, a.y - b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let dAng = ang - T.a0; dAng = Math.atan2(Math.sin(dAng), Math.cos(dAng));
      if (!T.mode) {
        // se elige el gesto según lo que cambie primero de forma clara
        const scale = Math.abs(Math.log(d / T.d0)), vert = m.y - T.m0.y, horiz = m.x - T.m0.x;
        if (Math.abs(dAng) > 0.22 && scale < 0.15) T.mode = 'rotate';
        else if (scale > 0.1) T.mode = 'pinch';
        else if (Math.abs(vert) > 28 && Math.abs(vert) > Math.abs(horiz) * 1.5 && scale < 0.06 && this.h.tilt) T.mode = 'tilt';
        else if (Math.hypot(horiz, vert) > 30) T.mode = 'pinch';
      }
      if (T.mode === 'rotate') { let da = ang - T.lastA; da = Math.atan2(Math.sin(da), Math.cos(da)); this.h.rotate?.(-da); this.vel.a = this.vel.a * 0.5 - da * 0.5; }
      if (T.mode === 'pinch') { this.h.zoom?.(d / T.lastD, m.x, m.y); this.h.pan?.(m.x - T.lastM.x, m.y - T.lastM.y); }
      if (T.mode === 'tilt') this.h.tilt?.((m.y - T.lastM.y) * 0.006);
      T.lastA = ang; T.lastD = d; T.lastM = m;
    }
  }
  up(e) {
    if (!this.ptrs.has(e.pointerId)) return; this.ptrs.delete(e.pointerId);
    if (this.ptrs.size === 1 && this.two) { const rot = this.two.mode === 'rotate'; this.two = null; const r = [...this.ptrs.values()][0]; this.start = { x: r.x, y: r.y, t: performance.now() }; if (rot) this.spinInertia(); this.vel.x = this.vel.y = 0; return; }
    if (this.ptrs.size > 0) return;
    this.two = null;
    if (this.drag) { this.drag = false; if (!this.moved && e.type === 'pointerup') { this.h.onDragEnd?.(true); this.h.onTap?.(e.clientX, e.clientY); } else this.h.onDragEnd?.(false); return; }
    if (!this.moved && e.type === 'pointerup') {
      const now = performance.now(); const lt = this.lastTap;
      // el toque responde al instante; si llega un segundo toque rápido, además se hace el doble toque
      if (lt && now - lt.t < 320 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30 && this.h.onDoubleTap) { this.lastTap = null; this.h.onDoubleTap(e.clientX, e.clientY); return; }
      this.lastTap = { t: now, x: e.clientX, y: e.clientY };
      this.h.onTap?.(e.clientX, e.clientY);
      return;
    }
    if (this.moved && Math.hypot(this.vel.x, this.vel.y) > 1.5) this.panInertia();
  }
  panInertia() {
    let { x, y } = this.vel;
    const step = () => { x *= 0.9; y *= 0.9; if (Math.hypot(x, y) < 0.3) { this.inertia = null; return; } this.h.pan?.(x, y); this.inertia = requestAnimationFrame(step); };
    this.inertia = requestAnimationFrame(step);
  }
  spinInertia() {
    let a = this.vel.a; if (Math.abs(a) < 0.004) return;
    const step = () => { a *= 0.88; if (Math.abs(a) < 0.001) { this.inertia = null; return; } this.h.rotate?.(a); this.inertia = requestAnimationFrame(step); };
    this.inertia = requestAnimationFrame(step);
  }
}
