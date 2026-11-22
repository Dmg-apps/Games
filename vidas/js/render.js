// Renderizador isométrico 2D en canvas. Solo lee el estado de la simulación.
// Para pasar a 3D bastaría con otra clase con la misma interfaz:
// resize(), render(state, view), screenToTile(x, y), pickSim(state, x, y), pickObject(state, x, y), addHearts(x, y), centerOn(x, y)
import { OBJECTS, AGES, NEEDS, NEED_IC, NEED_COLOR } from './data.js';
import { GRID, HOUSE, EXIT, footprint, visibleSims, hourOf } from './sim.js';
import { iconImage } from './icons.js';

const TW = 64, TH = 32, WALL = 78, ISLAND = 30;
const FONT = '"Nunito", ui-rounded, system-ui, sans-serif';
const OUTLINE = 'rgba(48,32,24,0.55)';

// ---------- color ----------
function rgb(c) {
  if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255, 1]; }
  const m = c.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] ?? 1];
}
function shade(c, f) { const [r, g, b, a] = rgb(c); const k = 1 - f; return `rgba(${r * k | 0},${g * k | 0},${b * k | 0},${a})`; }
function tint(c, f) { const [r, g, b, a] = rgb(c); return `rgba(${r + (255 - r) * f | 0},${g + (255 - g) * f | 0},${b + (255 - b) * f | 0},${a})`; }
function mix(a, b, t) { const A = rgb(a), B = rgb(b); return `rgb(${A[0] + (B[0] - A[0]) * t | 0},${A[1] + (B[1] - A[1]) * t | 0},${A[2] + (B[2] - A[2]) * t | 0})`; }
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };

// Paleta del cielo por hora: [hora, arriba, abajo]
const SKY = [[0, '#0f1630', '#23305a'], [5, '#1a2148', '#3b3f72'], [6.5, '#f2a98a', '#f6d3a8'], [8.5, '#7fc3ee', '#d6eef9'],
  [17.5, '#7fc3ee', '#d6eef9'], [19.5, '#e98a6a', '#f4c48f'], [21, '#2a2c5e', '#4d4277'], [24, '#0f1630', '#23305a']];
function skyAt(h) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const [h0, a0, b0] = SKY[i], [h1, a1, b1] = SKY[i + 1];
    if (h >= h0 && h <= h1) { const t = (h - h0) / (h1 - h0); return [mix(a0, a1, t), mix(b0, b1, t)]; }
  }
  return [SKY[0][1], SKY[0][2]];
}
export function nightAmount(h) { return h < 5 ? 1 : h < 7.5 ? (7.5 - h) / 2.5 : h > 21 ? 1 : h > 18.5 ? (h - 18.5) / 2.5 : 0; }

function rotateBox(b, rot, w, h) {
  let [x, y, bw, bd, z, hh, c] = b; let H = h, W = w;
  for (let i = 0; i < rot; i++) { const nx = H - (y + bd), ny = x; x = nx; y = ny; [bw, bd] = [bd, bw]; [W, H] = [H, W]; }
  return [x, y, bw, bd, z, hh, c];
}

export class IsoRenderer {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, zoom: 1, tx: null };
    this.hearts = []; this.clouds = Array.from({ length: 5 }, (_, i) => ({ x: Math.random(), y: 0.08 + i * 0.07, s: 0.6 + Math.random() * 0.8, v: 0.004 + Math.random() * 0.006 }));
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.dpr = dpr; this.w = this.c.clientWidth; this.h = this.c.clientHeight;
    this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
    if (!this.cam.init) { this.fit(); this.cam.init = true; }
  }
  // Zoom para que la casa quepa: en vertical manda el ancho, en horizontal el alto
  fit() {
    const landscape = this.w > this.h;
    const byW = (this.w - (landscape ? 120 : 24)) / (HOUSE * TW + 40), byH = (this.h - (landscape ? 90 : 300)) / (HOUSE * TH + WALL + 30);
    this.cam.zoom = Math.min(1.6, Math.max(0.55, Math.min(byW, byH)));
  }
  origin() { const z = this.cam.zoom; return { x: this.w / 2 + this.cam.x, y: this.h / 2 + this.cam.y - GRID * TH / 2 * z }; }
  iso(x, y, zpx = 0) { const o = this.origin(), z = this.cam.zoom; return { x: o.x + (x - y) * TW / 2 * z, y: o.y + (x + y) * TH / 2 * z - zpx * z }; }
  screenToWorld(sx, sy) {
    const o = this.origin(), z = this.cam.zoom; const a = (sx - o.x) / (TW / 2 * z), b = (sy - o.y) / (TH / 2 * z);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }
  screenToTile(sx, sy) { const w = this.screenToWorld(sx, sy); return { x: Math.floor(w.x), y: Math.floor(w.y) }; }
  // Centra con un deslizamiento suave (se interpola en render)
  centerOn(x, y, instant = false) {
    const p = this.iso(x + 0.5, y + 0.5);
    const landscape = this.w > this.h;
    // centro del área libre: en horizontal descuenta la barra lateral y el panel abierto
    const cx = landscape ? (this.w - 90 - (this.insetRight || 0)) / 2 + 10 : this.w / 2;
    const cy = landscape ? this.h / 2 + 10 : this.h / 2 - 10;
    const tx = this.cam.x + cx - p.x, ty = this.cam.y + cy - p.y + (landscape ? 20 : 30);
    if (instant) { this.cam.x = tx; this.cam.y = ty; this.cam.tx = null; } else this.cam.tx = { x: tx, y: ty };
  }
  pan(dx, dy) { this.cam.tx = null; this.cam.x += dx; this.cam.y += dy; this.clampCam(); }
  zoomAt(f, sx, sy) {
    this.cam.tx = null;
    const before = this.screenToWorld(sx, sy);
    this.cam.zoom = Math.max(0.45, Math.min(2.6, this.cam.zoom * f));
    const p = this.iso(before.x, before.y); this.cam.x += sx - p.x; this.cam.y += sy - p.y; this.clampCam();
  }
  clampCam() { const lim = GRID * TW * this.cam.zoom * 0.6; this.cam.x = Math.max(-lim, Math.min(lim, this.cam.x)); this.cam.y = Math.max(-lim, Math.min(lim, this.cam.y)); }
  addMarker(x, y) { this.marker = { x, y, t: performance.now() }; }
  drawMarker() {
    const m = this.marker; if (!m) return;
    const age = (performance.now() - m.t) / 1000; if (age > 0.7) { this.marker = null; return; }
    const ctx = this.ctx, z = this.cam.zoom, p = this.iso(m.x + 0.5, m.y + 0.5);
    const k = 1 - Math.pow(1 - age / 0.7, 3);
    ctx.strokeStyle = `rgba(37,196,143,${1 - age / 0.7})`; ctx.lineWidth = 3 * z;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, (8 + 18 * k) * z, (4 + 9 * k) * z, 0, 0, 7); ctx.stroke();
  }
  addHearts(x, y) { for (let i = 0; i < 7; i++) this.hearts.push({ x: x + 0.5, y: y + 0.5, t: -i * 0.12, dx: (Math.random() - 0.5) * 34, s: 0.7 + Math.random() * 0.5 }); }

  // ---------- selección ----------
  pickSim(state, sx, sy) {
    const sims = visibleSims(state).slice().sort((a, b) => (b.x + b.y) - (a.x + a.y));
    for (const s of sims) {
      const p = this.simPoint(state, s); const k = this.cam.zoom * AGES[s.age].scale;
      if (Math.abs(sx - p.x) < 16 * k + 8 && sy > p.y - 58 * k && sy < p.y + 10 * k) return s;
    }
    return null;
  }
  pickObject(state, sx, sy) {
    const objs = state.objects.slice().sort((a, b) => {
      const fa = footprint(a.type, a.rot), fb = footprint(b.type, b.rot);
      return (b.x + fb.w + b.y + fb.h) - (a.x + fa.w + a.y + fa.h);
    });
    for (const o of objs) {
      const def = OBJECTS[o.type]; if (def.walkable) continue;
      // prueba contra el volumen real de cada caja (no contra un bloque alto), con un pequeño margen
      for (const b0 of def.boxes) {
        const [bx, bz, bw, bd, z0, h] = rotateBox(b0, o.rot, def.w, def.h);
        const m = 0.08;
        for (let z = z0; z <= z0 + h; z += 3) {
          const w = this.screenToWorld(sx, sy + z * this.cam.zoom);
          if (w.x >= o.x + bx - m && w.x < o.x + bx + bw + m && w.y >= o.y + bz - m && w.y < o.y + bz + bd + m) return o;
        }
      }
    }
    return null;
  }
  simPoint(state, s) {
    let z = 0;
    if (s.age === 'bebe') z = s.cribId ? 10 : 0;
    else if (this.isLying(state, s)) z = 18;
    else if (this.isSitting(state, s)) z = s.cur.act === 'vater' ? 15 : 10;
    return this.iso(s.x + 0.5, s.y + 0.5, z);
  }
  isLying(state, s) {
    const c = s.cur; if (!c) return false;
    if (c.kind === 'ko') return true;
    if (c.kind === 'obj' && c.phase === 'do' && c.onObj && (c.act === 'dormir' || c.act === 'siesta')) return true;
    return (c.kind === 'soc' || c.kind === 'partner') && c.bedId && c.phase === 'do';
  }
  isSitting(state, s) { const c = s.cur; return c && c.kind === 'obj' && c.phase === 'do' && c.onObj && (c.act === 'relajarse' || c.act === 'vater'); }

  // ---------- fotograma ----------
  render(state, view) {
    const ctx = this.ctx, z = this.cam.zoom, now = performance.now() / 1000;
    if (this.cam.tx) {
      this.cam.x += (this.cam.tx.x - this.cam.x) * 0.16; this.cam.y += (this.cam.tx.y - this.cam.y) * 0.16;
      if (Math.abs(this.cam.tx.x - this.cam.x) + Math.abs(this.cam.tx.y - this.cam.y) < 0.5) this.cam.tx = null;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const h = hourOf(state.time); const night = nightAmount(h);
    this.night = night; this.powerOff = state.powerOff;
    // cielo
    const [top, bot] = skyAt(h);
    const g = ctx.createLinearGradient(0, 0, 0, this.h); g.addColorStop(0, top); g.addColorStop(1, bot);
    ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
    if (night > 0.3) this.stars(night, now);
    this.drawClouds(night);
    this.island();
    // suelo
    for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) this.ground(x, y, view.build);
    this.walls(night);
    this.exitMark();
    // sombras de muebles
    for (const o of state.objects) if (!OBJECTS[o.type].walkable) this.objShadow(o);
    for (const o of state.objects) if (OBJECTS[o.type].walkable) this.drawObject(state, o, 1, view);
    this.drawMarker();
    // profundidad
    const items = [];
    for (const o of state.objects) {
      if (OBJECTS[o.type].walkable) continue;
      const f = footprint(o.type, o.rot);
      items.push({ k: o.x + f.w - 1 + o.y + f.h - 1, draw: () => this.drawObject(state, o, 1, view) });
    }
    for (const s of visibleSims(state)) items.push({ k: s.x + s.y + 0.5, draw: () => this.drawSim(state, s, view, now) });
    if (view.ghost) { const gh = view.ghost, f = footprint(gh.type, gh.rot); items.push({ k: gh.x + f.w - 1 + gh.y + f.h - 1 + 0.6, draw: () => this.drawGhost(state, gh) }); }
    items.sort((a, b) => a.k - b.k).forEach((i) => i.draw());

    // noche: velo azul + luces cálidas
    if (night > 0) {
      ctx.fillStyle = `rgba(18,22,70,${0.4 * night})`; ctx.fillRect(0, 0, this.w, this.h);
      if (!state.powerOff) {
        ctx.globalCompositeOperation = 'lighter';
        for (const o of state.objects) if (o.type === 'lampara' || o.type === 'tele' && o.users.length) {
          const p = this.iso(o.x + 0.5, o.y + 0.5, o.type === 'lampara' ? 55 : 35); const r = (o.type === 'lampara' ? 150 : 70) * z;
          const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
          gr.addColorStop(0, o.type === 'lampara' ? `rgba(255,190,110,${0.38 * night})` : `rgba(110,170,255,${0.3 * night})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = gr; ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
        }
        // luz general de la casa
        const c = this.iso(5, 5, 20); const r = 330 * z;
        const gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
        gr.addColorStop(0, `rgba(255,200,130,${0.16 * night})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gr; ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    for (const s of visibleSims(state)) this.drawBubble(state, s, view, now);
    this.drawHearts();
  }

  // ---------- escenario ----------
  stars(night, now) {
    const ctx = this.ctx;
    for (let i = 0; i < 40; i++) {
      const x = hash(i, 1) * this.w, y = hash(i, 2) * this.h * 0.45;
      ctx.globalAlpha = night * (0.4 + 0.4 * Math.sin(now * 1.5 + i));
      ctx.fillStyle = '#fff'; ctx.fillRect(x, y, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;
  }
  drawClouds(night) {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(255,255,255,${0.75 - night * 0.6})`;
    for (const c of this.clouds) {
      c.x += c.v / 60; if (c.x > 1.2) c.x = -0.3;
      const x = c.x * this.w, y = c.y * this.h, s = c.s * 34;
      ctx.beginPath();
      ctx.ellipse(x, y, s * 1.6, s * 0.55, 0, 0, 7); ctx.ellipse(x - s * 0.7, y + s * 0.1, s * 0.8, s * 0.45, 0, 0, 7); ctx.ellipse(x + s * 0.5, y - s * 0.25, s * 0.9, s * 0.6, 0, 0, 7);
      ctx.fill();
    }
  }
  island() {
    const ctx = this.ctx, z = this.cam.zoom;
    // sombra difusa bajo la maqueta
    const c = this.iso(GRID / 2, GRID / 2, -ISLAND - 40);
    const gr = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, GRID * TW * 0.55 * z);
    gr.addColorStop(0, 'rgba(20,30,60,0.28)'); gr.addColorStop(1, 'rgba(20,30,60,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(c.x, c.y, GRID * TW * 0.6 * z, GRID * TH * 0.6 * z, 0, 0, 7); ctx.fill();
    // laterales de tierra
    const A = this.iso(GRID, 0), B = this.iso(GRID, GRID), C = this.iso(0, GRID);
    const d = ISLAND * z, lip = 7 * z;
    this.quad([A, B, { x: B.x, y: B.y + lip }, { x: A.x, y: A.y + lip }], '#5f9e48');
    this.quad([C, B, { x: B.x, y: B.y + lip }, { x: C.x, y: C.y + lip }], '#6aac50');
    const g1 = ctx.createLinearGradient(0, A.y, 0, B.y + d);
    g1.addColorStop(0, '#9a6a42'); g1.addColorStop(1, '#6e4528');
    this.quad([{ x: A.x, y: A.y + lip }, { x: B.x, y: B.y + lip }, { x: B.x, y: B.y + d }, { x: A.x, y: A.y + d }], g1);
    const g2 = ctx.createLinearGradient(0, C.y, 0, B.y + d);
    g2.addColorStop(0, '#a8774c'); g2.addColorStop(1, '#7a4f2f');
    this.quad([{ x: C.x, y: C.y + lip }, { x: B.x, y: B.y + lip }, { x: B.x, y: B.y + d }, { x: C.x, y: C.y + d }], g2);
    // vetas
    ctx.strokeStyle = 'rgba(60,35,20,0.25)'; ctx.lineWidth = 1;
    for (const f of [0.45, 0.75]) {
      ctx.beginPath(); ctx.moveTo(A.x, A.y + d * f); ctx.lineTo(B.x, B.y + d * f); ctx.lineTo(C.x, C.y + d * f); ctx.stroke();
    }
  }
  ground(x, y, build) {
    const inside = x < HOUSE && y < HOUSE;
    const path = !inside && y === EXIT.y;
    const n = hash(x, y);
    if (inside) {
      const base = mix('#d7a873', '#cf9d68', n);
      this.tile(x, y, base);
      // juntas de las tablas
      const ctx = this.ctx; ctx.strokeStyle = 'rgba(120,70,35,0.22)'; ctx.lineWidth = 1;
      for (const f of [0.33, 0.66]) { const a = this.iso(x, y + f), b = this.iso(x + 1, y + f); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
      const off = (y % 2) * 0.5 + 0.25; const a = this.iso(x + off, y), b = this.iso(x + off, y + 0.33);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    } else if (path) {
      this.tile(x, y, '#9fb27d');
      this.tileInset(x, y, 0.12, mix('#d9d2c3', '#cfc6b4', n));
    } else {
      this.tile(x, y, mix('#86c565', '#7cbc5c', n));
      const ctx = this.ctx, z = this.cam.zoom;
      if (n > 0.55) { // matas de hierba
        const p = this.iso(x + 0.3 + hash(y, x) * 0.4, y + 0.3 + n * 0.4);
        ctx.strokeStyle = '#5c9e44'; ctx.lineWidth = 1.3 * z; ctx.beginPath();
        ctx.moveTo(p.x - 3 * z, p.y); ctx.lineTo(p.x - 4 * z, p.y - 5 * z); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - 7 * z); ctx.moveTo(p.x + 3 * z, p.y); ctx.lineTo(p.x + 4 * z, p.y - 5 * z); ctx.stroke();
      }
      if (n > 0.86) { // flores
        const p = this.iso(x + 0.6, y + 0.5);
        ctx.fillStyle = ['#ff8fb1', '#ffd45c', '#ffffff', '#b99cff'][(x * 7 + y) % 4];
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(p.x + (i - 1) * 5 * z, p.y - (i % 2) * 3 * z, 2.2 * z, 0, 7); ctx.fill(); }
      }
    }
    if (build) this.tileStroke(x, y, 'rgba(255,255,255,0.35)');
  }
  tile(x, y, fill) {
    const ctx = this.ctx; const a = this.iso(x, y), b = this.iso(x + 1, y), c = this.iso(x + 1, y + 1), d = this.iso(x, y + 1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = fill; ctx.lineWidth = 0.6; ctx.stroke(); // tapa las juntas de antialias
  }
  tileInset(x, y, m, fill) {
    const a = this.iso(x + m, y + m), b = this.iso(x + 1 - m, y + m), c = this.iso(x + 1 - m, y + 1 - m), d = this.iso(x + m, y + 1 - m);
    this.quad([a, b, c, d], fill);
  }
  tileStroke(x, y, col) {
    const ctx = this.ctx; const a = this.iso(x, y), b = this.iso(x + 1, y), c = this.iso(x + 1, y + 1), d = this.iso(x, y + 1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
  }
  quad(pts, fill, stroke) {
    const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  walls(night) {
    const ctx = this.ctx;
    const wall = (x0, y0, x1, y1, col) => {
      const p0 = this.iso(x0, y0), p1 = this.iso(x1, y1), q1 = this.iso(x1, y1, WALL), q0 = this.iso(x0, y0, WALL);
      const g = ctx.createLinearGradient(0, q0.y, 0, p0.y); g.addColorStop(0, tint(col, 0.25)); g.addColorStop(1, col);
      this.quad([p0, p1, q1, q0], g);
      // rayas del papel pintado
      ctx.strokeStyle = 'rgba(160,120,90,0.08)'; ctx.lineWidth = 3 * this.cam.zoom;
      const n = Math.abs(x1 - x0 + y1 - y0) * 3;
      for (let i = 1; i < n; i++) {
        const t = i / n, a = this.iso(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 8), b = this.iso(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, WALL);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      // zócalo
      this.quad([p0, p1, this.iso(x1, y1, 8), this.iso(x0, y0, 8)], '#f7f1e8', 'rgba(120,90,60,0.25)');
      // remate con grosor
      const t = 0.14, dx = x1 === x0 ? -t : 0, dy = y1 === y0 ? -t : 0;
      this.quad([q0, q1, this.iso(x1 + dx, y1 + dy, WALL), this.iso(x0 + dx, y0 + dy, WALL)], '#c9b49a');
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
    };
    wall(0, 0, HOUSE, 0, '#f3e7d6');
    wall(0, 0, 0, HOUSE, '#eadbc6');
    // canto exterior de los muros
    const e1 = this.iso(HOUSE, 0), e1t = this.iso(HOUSE, 0, WALL), e1b = this.iso(HOUSE, -0.14, WALL), e1c = this.iso(HOUSE, -0.14);
    this.quad([e1, e1t, e1b, e1c], '#d8c4a8');
    const e2 = this.iso(0, HOUSE), e2t = this.iso(0, HOUSE, WALL), e2b = this.iso(-0.14, HOUSE, WALL), e2c = this.iso(-0.14, HOUSE);
    this.quad([e2, e2t, e2b, e2c], '#cbb699');
    this.window(2.4, 'x', night); this.window(6.4, 'x', night); this.window(4, 'y', night);
    // marco de foto
    const fp = [this.iso(0, 7.6, 38), this.iso(0, 8.6, 38), this.iso(0, 8.6, 60), this.iso(0, 7.6, 60)];
    this.quad(fp, '#8a5a3a'); this.quad([this.iso(0, 7.7, 41), this.iso(0, 8.5, 41), this.iso(0, 8.5, 57), this.iso(0, 7.7, 57)], '#f0c27a');
    this.quad([this.iso(0, 7.7, 41), this.iso(0, 8.5, 41), this.iso(0, 8.2, 50), this.iso(0, 7.9, 47)], '#6aa36a');
  }
  window(pos, axis, night) {
    const w = 1.3, P = (t, z) => (axis === 'x' ? this.iso(pos + t, 0, z) : this.iso(0, pos + t, z));
    this.quad([P(-0.06, 26), P(w + 0.06, 26), P(w + 0.06, 64), P(-0.06, 64)], '#fffaf2', 'rgba(120,90,60,0.35)');
    const glass = night > 0.4 && !this.powerOff ? '#ffd892' : night > 0.4 ? '#2b3466' : '#bfe3f5';
    const g = this.ctx.createLinearGradient(P(0, 60).x, P(0, 60).y, P(w, 30).x, P(w, 30).y);
    g.addColorStop(0, tint(glass, 0.3)); g.addColorStop(1, glass);
    this.quad([P(0.06, 30), P(w - 0.06, 30), P(w - 0.06, 60), P(0.06, 60)], g);
    this.quad([P(w / 2 - 0.03, 30), P(w / 2 + 0.03, 30), P(w / 2 + 0.03, 60), P(w / 2 - 0.03, 60)], '#fffaf2');
    // alféizar
    this.quad([P(-0.12, 24), P(w + 0.12, 24), P(w + 0.12, 27), P(-0.12, 27)], '#e2d2bd');
  }
  exitMark() {
    // felpudo y farolillo junto a la salida
    this.tileInset(EXIT.x, EXIT.y, 0.18, '#b8664a');
    this.tileInset(EXIT.x, EXIT.y, 0.28, '#cc7a5a');
  }
  box(x, y, w, d, z0, h, col) {
    const top = [this.iso(x, y, z0 + h), this.iso(x + w, y, z0 + h), this.iso(x + w, y + d, z0 + h), this.iso(x, y + d, z0 + h)];
    const right = [this.iso(x + w, y, z0), this.iso(x + w, y + d, z0), this.iso(x + w, y + d, z0 + h), this.iso(x + w, y, z0 + h)];
    const front = [this.iso(x, y + d, z0), this.iso(x + w, y + d, z0), this.iso(x + w, y + d, z0 + h), this.iso(x, y + d, z0 + h)];
    const line = h > 3 && w > 0.06 && d > 0.06 ? 'rgba(48,32,24,0.28)' : null;
    this.quad(right, shade(col, 0.12), line); this.quad(front, shade(col, 0.26), line); this.quad(top, tint(col, 0.06), line);
    if (h > 3) { // brillo en el canto superior
      const ctx = this.ctx; ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(top[3].x, top[3].y); ctx.lineTo(top[2].x, top[2].y); ctx.lineTo(top[1].x, top[1].y); ctx.stroke();
    }
  }
  objShadow(o) {
    const f = footprint(o.type, o.rot), m = 0.04;
    const pts = [this.iso(o.x + m, o.y + m), this.iso(o.x + f.w + 0.12, o.y + m), this.iso(o.x + f.w + 0.12, o.y + f.h + 0.12), this.iso(o.x + m, o.y + f.h + 0.12)];
    this.quad(pts, 'rgba(60,35,20,0.13)');
  }
  drawObject(state, o, alpha, view) {
    const def = OBJECTS[o.type]; const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    if (view?.selected === o.id) {
      const f = footprint(o.type, o.rot);
      for (let i = 0; i < f.w; i++) for (let j = 0; j < f.h; j++) this.tile(o.x + i, o.y + j, 'rgba(255,214,90,0.6)');
    }
    const boxes = def.boxes.map((b) => rotateBox(b, o.rot, def.w, def.h))
      .sort((a, b) => (a[0] + a[2] / 2 + a[1] + a[3] / 2) - (b[0] + b[2] / 2 + b[1] + b[3] / 2) || a[4] - b[4]);
    for (const b of boxes) {
      let col = b[6];
      const on = def.power && !state.powerOff && o.users.some((u) => state.sims[u]?.cur?.phase === 'do');
      if (col === '#1a1a22') col = on ? ['#5aa8e8', '#7dd3a8', '#e8a85a', '#a87de8'][Math.floor(performance.now() / 700 + o.x) % 4] : '#1f2230';
      if (col === '#1e1e26' && on) col = '#6ab4ff';
      this.box(o.x + b[0], o.y + b[1], b[2], b[3], b[4], b[5], col);
    }
    if (o.type === 'cocina' && o.users.some((u) => state.sims[u]?.cur?.phase === 'do')) {
      const t = performance.now() / 1000; const f = this.iso(o.x + 0.32, o.y + 0.32, 40 + Math.sin(t * 20) * 1.5); const z = this.cam.zoom;
      ctx.fillStyle = 'rgba(255,140,40,0.85)'; ctx.beginPath(); ctx.ellipse(f.x, f.y, 5 * z, 3.5 * z, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,90,0.9)'; ctx.beginPath(); ctx.ellipse(f.x, f.y - 1 * z, 2.5 * z, 2 * z, 0, 0, 7); ctx.fill();
    }
    if (o.type === 'buzon' && state.bills.length) {
      const p = this.iso(o.x + 0.5, o.y + 0.5, 66); const z = this.cam.zoom;
      ctx.fillStyle = '#ff5c5c'; ctx.beginPath(); ctx.arc(p.x, p.y, 7 * z, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `800 ${10 * z}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', p.x, p.y + 0.5); ctx.textBaseline = 'alphabetic';
    }
    ctx.globalAlpha = 1;
  }
  drawGhost(state, g) {
    const f = footprint(g.type, g.rot);
    for (let i = 0; i < f.w; i++) for (let j = 0; j < f.h; j++) this.tile(g.x + i, g.y + j, g.ok ? 'rgba(70,210,140,0.5)' : 'rgba(240,80,80,0.5)');
    this.drawObject(state, { type: g.type, x: g.x, y: g.y, rot: g.rot, users: [] }, 0.8, {});
  }

  // ---------- personajes ----------
  drawSim(state, s, view, now) {
    const ctx = this.ctx; const z = this.cam.zoom; const k = z * AGES[s.age].scale; const L = s.look;
    const p = this.simPoint(state, s);
    const active = view.active === s.id;
    // sombra y anillo de selección
    ctx.fillStyle = 'rgba(40,25,15,0.22)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 12 * k, 6 * k, 0, 0, 7); ctx.fill();
    if (active) {
      const pulse = 1 + Math.sin(now * 4) * 0.08;
      ctx.fillStyle = 'rgba(56,214,160,0.28)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 17 * k * pulse, 8.5 * k * pulse, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#25c48f'; ctx.lineWidth = 2.2 * z; ctx.stroke();
    }
    const blink = (Math.floor(now * 10 + hash(s.x | 0, s.id.length) * 40) % 42) === 0;
    const dir = s.dir || 1;
    if (s.age === 'bebe') return this.drawBaby(s, p, k, view, now);
    if (this.isLying(state, s)) return this.drawLying(s, p, k, view);

    const walking = s.path && s.path.length > 0;
    const sw = walking ? Math.sin(now * 11) : 0;
    const pose = this.poseOf(state, s, now);
    const face = this.facing(state, s);
    const fdir = face.dir;
    const bob = walking ? Math.abs(sw) * 2 * k : pose.bounce ? Math.abs(Math.sin(now * 7)) * 3 * k : Math.sin(now * 2 + s.x) * 0.4 * k;
    const sit = pose.sit;
    const by = p.y - bob;
    const shower = pose.id === 'ducha';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = 1.3 * z; ctx.strokeStyle = OUTLINE;
    // piernas y zapatos
    if (!sit) {
      ctx.fillStyle = shower ? L.skin : L.pants;
      this.rr(p.x - 6 * k + sw * 2.5 * k, by - 14 * k, 5 * k, 13 * k, 2 * k, true);
      this.rr(p.x + 1 * k - sw * 2.5 * k, by - 14 * k, 5 * k, 13 * k, 2 * k, true);
      ctx.fillStyle = shower ? L.skin : '#3b2b25';
      this.ell(p.x - 3.5 * k + sw * 2.5 * k, by - 1.2 * k, 3.6 * k, 2 * k, true);
      this.ell(p.x + 3.5 * k - sw * 2.5 * k, by - 1.2 * k, 3.6 * k, 2 * k, true);
    } else {
      ctx.fillStyle = L.pants; this.rr(p.x - 7 * k + fdir * 2 * k, by - 17 * k, 14 * k, 6 * k, 3 * k, true);
      ctx.fillStyle = L.pants; this.rr(p.x - 6 * k + fdir * 6 * k, by - 13 * k, 5 * k, 10 * k, 2 * k, true); this.rr(p.x + 1 * k + fdir * 6 * k, by - 13 * k, 5 * k, 10 * k, 2 * k, true);
      ctx.fillStyle = '#3b2b25'; this.ell(p.x - 3.5 * k + fdir * 7 * k, by - 2 * k, 3.4 * k, 1.9 * k, true); this.ell(p.x + 3.5 * k + fdir * 7 * k, by - 2 * k, 3.4 * k, 1.9 * k, true);
    }
    const hy = by - 41 * k;
    // pelo largo por detrás (de espaldas se dibuja después)
    if (L.hair === 1 && !face.back) { ctx.fillStyle = shade(L.hairColor, 0.1); this.rr(p.x - 11 * k, by - 46 * k, 22 * k, 24 * k, 8 * k, true); }
    // de espaldas, lo que sostiene queda detrás del cuerpo
    if (face.back) this.drawProp(pose, p.x, by, k, fdir, now, L);
    // cuerpo
    ctx.fillStyle = shower ? L.skin : L.shirt;
    if (L.body === 'vestido' && !shower) {
      ctx.beginPath(); ctx.moveTo(p.x - 6.5 * k, by - 31 * k); ctx.lineTo(p.x + 6.5 * k, by - 31 * k);
      ctx.quadraticCurveTo(p.x + 10 * k, by - 18 * k, p.x + 11 * k, by - 11 * k); ctx.lineTo(p.x - 11 * k, by - 11 * k);
      ctx.quadraticCurveTo(p.x - 10 * k, by - 18 * k, p.x - 6.5 * k, by - 31 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else this.rr(p.x - 8 * k, by - 31 * k, 16 * k, 19 * k, 5 * k, true);
    if (s.pregnant) { this.ell(p.x + 2.5 * fdir * k, by - 18 * k, 7.5 * k, 6.5 * k, true); }
    ctx.fillStyle = 'rgba(0,0,0,0.1)'; ctx.fillRect(p.x + 2 * k, by - 30 * k, 5.5 * k, 17 * k);
    // brazos (hombro → mano) y manos
    const arm = walking ? sw * 2.5 : 0;
    const hands = pose.hands || [[-9.3, -18 + arm], [9.3, -18 - arm]];
    const shoulders = [[-7.5, -28.5], [7.5, -28.5]];
    for (let i = 0; i < 2; i++) {
      const [sx, sy] = shoulders[i], [hx, hy2] = hands[i];
      const ax = p.x + sx * k, ay = by + sy * k, bx = p.x + hx * k, byy = by + hy2 * k;
      ctx.lineWidth = 6.2 * k; ctx.strokeStyle = OUTLINE; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, byy); ctx.stroke();
      ctx.lineWidth = 4.2 * k; ctx.strokeStyle = shower ? L.skin : L.shirt; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, byy); ctx.stroke();
    }
    ctx.lineWidth = 1.3 * z; ctx.strokeStyle = OUTLINE; ctx.fillStyle = L.skin;
    for (const [hx, hy2] of hands) this.circ(p.x + hx * k, by + hy2 * k, 2.6 * k, true);
    if (pose.id === 'vater') { // taza del váter por delante, con su pie hasta el suelo
      const fy = p.y + 15 * this.cam.zoom; // suelo real (el personaje está elevado al sentarse)
      ctx.fillStyle = '#eef1f4'; ctx.strokeStyle = 'rgba(48,32,24,0.45)'; ctx.lineWidth = 1.2 * z;
      ctx.beginPath(); ctx.moveTo(p.x - 6 * k, fy - 1 * k); ctx.lineTo(p.x - 8 * k, by - 9 * k); ctx.lineTo(p.x + 8 * k, by - 9 * k); ctx.lineTo(p.x + 6 * k, fy - 1 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f7f9fb'; ctx.beginPath(); ctx.moveTo(p.x - 12 * k, by - 12 * k); ctx.quadraticCurveTo(p.x, by + 1 * k, p.x + 12 * k, by - 12 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e3e8ed'; this.ell(p.x, by - 12 * k, 12 * k, 3.6 * k, true);
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3 * z;
    }
    // cabeza
    ctx.fillStyle = L.skin; this.circ(p.x, hy, 11 * k, true);
    if (face.back) {
      if (L.hair !== 3) { ctx.fillStyle = L.hairColor; this.circ(p.x, hy - 0.5 * k, 11.4 * k, true); }
      if (L.hair === 1) { ctx.fillStyle = L.hairColor; this.rr(p.x - 10 * k, hy, 20 * k, 16 * k, 7 * k, true); }
      if (L.hair === 2) this.circ(p.x, hy - 12 * k, 5.5 * k, true);
    } else {
      this.hairFront(L, p.x, hy, k);
      const ex = fdir * 1.3 * k;
      this.face(p.x + ex, hy + 1.5 * k, k, blink || s.sleeping || pose.eyesClosed, pose.mood ?? s.mood, pose.talk ? Math.sin(now * 14) > 0 : pose.chew ? Math.sin(now * 9) > 0.3 : false);
      this.drawProp(pose, p.x, by, k, fdir, now, L);
    }
    if (shower) this.showerFx(p, by, k, z, now);
    this.nameTag(s, p, view, z, active);
  }

  // Hacia dónde mira: dir = izquierda/derecha en pantalla; back = de espaldas a la cámara
  facing(state, s) {
    const c = s.cur; let tx = null, ty = null;
    if (c && c.phase === 'do') {
      if (c.kind === 'obj' && !c.onObj) { const o = state.objects.find((q) => q.id === c.objId); if (o) { const f = footprint(o.type, o.rot); tx = o.x + f.w / 2 - 0.5; ty = o.y + f.h / 2 - 0.5; } }
      if (c.kind === 'soc' || c.kind === 'partner') { const t = state.sims[c.kind === 'soc' ? c.targetId : c.leaderId]; if (t) { tx = t.x; ty = t.y; } }
    } else if (s.path && s.path.length) { tx = s.path[0].x; ty = s.path[0].y; }
    if (tx === null) return { dir: s.dir || 1, back: false };
    const dx = tx - s.x, dy = ty - s.y;
    const dir = dx - dy >= 0 ? 1 : -1; s.dir = dir;
    return { dir, back: dx + dy < -0.35 };
  }

  // Postura según lo que esté haciendo
  poseOf(state, s, now) {
    const c = s.cur; const P = { id: null, sit: false };
    if (!c || c.phase !== 'do') return P;
    const d = s.dir || 1; const cyc = (now * 1.1) % 1;
    if (c.kind === 'soc' || c.kind === 'partner') {
      const act = c.kind === 'soc' ? c.act : state.sims[c.leaderId]?.cur?.act;
      if (act === 'abrazar' || act === 'consolar' || act === 'acunar') return { id: 'hug', hands: [[d * 6 - 5, -24], [d * 6 + 5, -24]] };
      if (act === 'discutir') return { id: 'argue', talk: true, mood: 20, hands: [[-11, -30 + Math.sin(now * 12) * 3], [11, -30 - Math.sin(now * 12) * 3]] };
      if (act === 'biberon') return { id: 'bottle', hands: [[d * 5 - 3, -22], [d * 8, -24]], prop: 'bottle' };
      if (act === 'bailar') return { id: 'dance', bounce: true };
      return { id: 'talk', talk: true, hands: [[-9.3, -18], [d * 11, -24 + Math.sin(now * 5) * 3]] };
    }
    switch (c.act) {
      case 'ducha': return { id: 'ducha', eyesClosed: true, hands: [[-6, -38], [6, -38]] };
      case 'vater': return { id: 'vater', sit: true, hands: [[-10, -20], [10, -20]], mood: 60 };
      case 'relajarse': return { id: 'sofa', sit: true, hands: [[-9, -17], [9, -17]] };
      case 'picar': case 'pizza': {
        const atMouth = cyc < 0.45;
        return { id: 'eat', chew: !atMouth, hands: [[d * 3 - 5, -21], atMouth ? [d * 4, -35] : [d * 6, -22]], prop: c.act === 'pizza' ? 'slice' : 'plate' };
      }
      case 'cocinar': {
        if (c.t < 30) return { id: 'cook', hands: [[d * 9, -21 + Math.sin(now * 6) * 1.5], [d * 2 - 6, -20]], prop: 'pan' };
        const atMouth = cyc < 0.45;
        return { id: 'eat', chew: !atMouth, hands: [[d * 3 - 5, -21], atMouth ? [d * 4, -35] : [d * 6, -22]], prop: 'plate' };
      }
      case 'jugarpc': case 'deberes': case 'buscartrabajo': {
        const o = state.objects.find((q) => q.id === c.objId);
        if (o && o.type === 'telefono') return { id: 'phone', talk: true, hands: [[-9.3, -18], [d * 7, -38]], prop: 'phone' };
        const j = Math.sin(now * 18) * 1.2;
        return { id: 'type', hands: [[d * 7 - 4, -22 + j], [d * 7 + 4, -22 - j]] };
      }
      case 'invitar': case 'adoptar': return { id: 'phone', talk: true, hands: [[-9.3, -18], [d * 7, -38]], prop: 'phone' };
      case 'leer': return { id: 'read', hands: [[d * 6 - 4, -25], [d * 6 + 4, -25]], prop: 'book' };
      case 'tele': return { id: 'tv', hands: [[-9.3, -18], [9.3, -18]], mood: 75 };
      case 'bailar': { const a = Math.sin(now * 7); return { id: 'dance', bounce: true, mood: 90, hands: [[-11, -34 + a * 6], [11, -34 - a * 6]] }; }
      case 'juguetes': return { id: 'toys', bounce: true, mood: 90, hands: [[d * 7 - 4, -20], [d * 7 + 6, -24 + Math.sin(now * 6) * 3]], prop: 'toy' };
      case 'regar': return { id: 'water', hands: [[-9.3, -18], [d * 11, -22]], prop: 'can' };
      default: return P;
    }
  }

  drawProp(pose, x, by, k, d, now, L) {
    const ctx = this.ctx; if (!pose.prop) return;
    const h = pose.hands; ctx.lineWidth = 1.1 * this.cam.zoom; ctx.strokeStyle = OUTLINE;
    const at = (i) => [x + h[i][0] * k, by + h[i][1] * k];
    if (pose.prop === 'plate') {
      const [px, py] = at(0); ctx.fillStyle = '#fff'; this.ell(px + d * 3 * k, py - 1 * k, 6 * k, 2.4 * k, true);
      ctx.fillStyle = '#e8a84a'; this.ell(px + d * 2 * k, py - 2.4 * k, 2.4 * k, 1.4 * k); ctx.fillStyle = '#6ab04c'; this.ell(px + d * 4.5 * k, py - 2.2 * k, 1.8 * k, 1.1 * k);
    } else if (pose.prop === 'slice') {
      const [px, py] = at(1); ctx.fillStyle = '#f2c14e'; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + d * 7 * k, py - 3 * k); ctx.lineTo(px + d * 6 * k, py + 3 * k); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d0453a'; this.circ(px + d * 4.5 * k, py, 1 * k);
    } else if (pose.prop === 'pan') {
      const [px, py] = at(0); ctx.strokeStyle = '#333'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + d * 5 * k, py - 1 * k); ctx.stroke();
      ctx.fillStyle = '#2d2d33'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1; this.ell(px + d * 10 * k, py - 1 * k, 6 * k, 2.6 * k, true);
      ctx.fillStyle = '#f3c26b'; this.ell(px + d * 10 * k, py - 1.6 * k, 3.5 * k, 1.4 * k);
      this.steam(px + d * 10 * k, py - 5 * k, k, now);
    } else if (pose.prop === 'phone') {
      const [px, py] = at(1); ctx.fillStyle = '#222'; this.rr(px - 1.5 * k, py - 4 * k, 3 * k, 6.5 * k, 1 * k, false);
    } else if (pose.prop === 'book') {
      const [ax, ay] = at(0), [bx] = at(1); ctx.fillStyle = '#c0504d'; this.rr(Math.min(ax, bx) - 2 * k, ay - 5 * k, Math.abs(bx - ax) + 4 * k, 7 * k, 1 * k, true);
      ctx.fillStyle = '#fff'; ctx.fillRect((ax + bx) / 2 - 0.4 * k, ay - 4.5 * k, 0.8 * k, 6 * k);
    } else if (pose.prop === 'can') {
      const [px, py] = at(1); ctx.fillStyle = '#4caf6a'; this.rr(px - 1 * k, py - 3 * k, 6 * k, 5 * k, 1.5 * k, true);
      ctx.strokeStyle = '#3a8a52'; ctx.lineWidth = 1.4 * k; ctx.beginPath(); ctx.moveTo(px + 5 * k, py - 1 * k); ctx.lineTo(px + d * 10 * k, py - 4 * k); ctx.stroke();
      ctx.fillStyle = '#7cc6ff'; for (let i = 0; i < 3; i++) { const t = (now * 2 + i / 3) % 1; this.circ(px + d * (10 + t * 2) * k, py - 4 * k + t * 14 * k, 1 * k); }
    } else if (pose.prop === 'bottle') {
      const [px, py] = at(1); ctx.fillStyle = '#f4f4f4'; this.rr(px - 1.5 * k, py - 5 * k, 3.5 * k, 7 * k, 1.2 * k, true); ctx.fillStyle = '#ffb3c7'; this.rr(px - 1 * k, py - 7 * k, 2.5 * k, 2.5 * k, 1 * k);
    } else if (pose.prop === 'toy') {
      const [px, py] = at(1); ctx.fillStyle = '#e05050'; this.circ(px, py - 3 * k, 3 * k, true); ctx.fillStyle = '#ffd45c'; this.circ(px - 1 * k, py - 4 * k, 1 * k);
    }
  }
  steam(x, y, k, now) {
    const ctx = this.ctx;
    for (let i = 0; i < 3; i++) {
      const t = (now * 0.8 + i / 3) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.55 * (1 - t)})`;
      this.circ(x + Math.sin(t * 6 + i) * 3 * k, y - t * 16 * k, (2 + t * 3) * k);
    }
  }
  // Ducha: agua cayendo, vapor y cristal empañado que tapa el cuerpo
  showerFx(p, by, k, z, now) {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(160,210,255,0.75)'; ctx.lineWidth = 1.2 * z;
    for (let i = 0; i < 9; i++) {
      const x = p.x + (i - 4) * 2.2 * k + Math.sin(i) * k; const off = ((now * 3 + i * 0.37) % 1) * 18 * k;
      ctx.beginPath(); ctx.moveTo(x, by - 62 * k + off); ctx.lineTo(x, by - 54 * k + off); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, by - 40 * k + off); ctx.lineTo(x, by - 33 * k + off); ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const t = (now * 0.35 + i / 5) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.35 * Math.sin(t * Math.PI)})`;
      this.circ(p.x + Math.sin(i * 2 + t * 4) * 9 * k, by - 30 * k - t * 40 * k, (5 + t * 6) * k);
    }
    const g = ctx.createLinearGradient(0, by - 30 * k, 0, by);
    g.addColorStop(0, 'rgba(230,242,250,0.25)'); g.addColorStop(0.25, 'rgba(230,242,250,0.88)'); g.addColorStop(1, 'rgba(225,238,248,0.95)');
    ctx.fillStyle = g; ctx.strokeStyle = 'rgba(150,190,215,0.8)'; ctx.lineWidth = 1;
    this.rr(p.x - 15 * k, by - 30 * k, 30 * k, 31 * k, 4 * k, true);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5 * z;
    ctx.beginPath(); ctx.moveTo(p.x - 10 * k, by - 22 * k); ctx.lineTo(p.x - 4 * k, by - 28 * k); ctx.stroke();
  }
  drawBaby(s, p, k, view, now) {
    const ctx = this.ctx, L = s.look, z = this.cam.zoom;
    ctx.lineWidth = 1.2 * z; ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = tint(L.shirt, 0.3); this.ell(p.x + 2 * k, p.y - 5 * k, 15 * k, 9 * k, true);
    ctx.fillStyle = L.skin; this.circ(p.x - 9 * k, p.y - 11 * k, 9.5 * k, true);
    ctx.fillStyle = L.hairColor; ctx.beginPath(); ctx.arc(p.x - 9 * k, p.y - 13 * k, 7 * k, Math.PI * 1.1, Math.PI * 1.9); ctx.fill();
    this.face(p.x - 9 * k, p.y - 10 * k, k, s.sleeping, s.crying ? 10 : 80);
    this.nameTag(s, p, view, z, view.active === s.id);
  }
  drawLying(s, p, k, view) {
    const ctx = this.ctx, L = s.look, z = this.cam.zoom;
    const inBed = s.cur.kind !== 'ko';
    ctx.lineWidth = 1.2 * z; ctx.strokeStyle = OUTLINE;
    ctx.fillStyle = inBed ? '#7fa2df' : L.shirt;
    ctx.beginPath(); ctx.ellipse(p.x - 4 * k, p.y + 2 * k, 21 * k, 9.5 * k, -0.46, 0, 7); ctx.fill(); ctx.stroke();
    if (inBed) { ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(p.x - 4 * k, p.y + 2 * k, 15 * k, 6 * k, -0.46, 0.3, 2.4); ctx.stroke(); ctx.strokeStyle = OUTLINE; }
    ctx.fillStyle = L.skin; this.circ(p.x + 15 * k, p.y - 8 * k, 9 * k, true);
    this.hairFront(L, p.x + 15 * k, p.y - 8 * k, k * 0.82);
    this.face(p.x + 15 * k, p.y - 7 * k, k * 0.85, true, 70);
    this.nameTag(s, p, view, z, view.active === s.id);
  }
  hairFront(L, x, y, k) {
    const ctx = this.ctx; ctx.fillStyle = L.hairColor;
    if (L.hair === 3) { ctx.beginPath(); ctx.arc(x, y, 11 * k, Math.PI * 1.12, Math.PI * 1.88); ctx.fill(); return; }
    ctx.beginPath(); ctx.arc(x, y - 1 * k, 11.6 * k, Math.PI * 0.98, Math.PI * 2.02);
    ctx.quadraticCurveTo(x + 4 * k, y - 6 * k, x - 3 * k, y - 4 * k); ctx.quadraticCurveTo(x - 8 * k, y - 3 * k, x - 11.5 * k, y + 0.5 * k);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (L.hair === 2) this.circ(x + 1 * k, y - 13.5 * k, 5.5 * k, true);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.6 * k;
    ctx.beginPath(); ctx.arc(x, y - 1 * k, 9 * k, Math.PI * 1.25, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3 * this.cam.zoom;
  }
  face(x, y, k, closed, mood, open = false) {
    const ctx = this.ctx; ctx.fillStyle = '#2a1d1a'; ctx.strokeStyle = '#2a1d1a';
    if (closed) {
      ctx.lineWidth = Math.max(1, 1.2 * k); ctx.beginPath();
      ctx.arc(x - 3.8 * k, y - 0.5 * k, 1.8 * k, 0.2, Math.PI - 0.2); ctx.moveTo(x + 5.6 * k, y - 0.2 * k); ctx.arc(x + 3.8 * k, y - 0.5 * k, 1.8 * k, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.ellipse(x - 3.8 * k, y, 1.5 * k, 2 * k, 0, 0, 7); ctx.ellipse(x + 3.8 * k, y, 1.5 * k, 2 * k, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3.3 * k, y - 0.8 * k, 0.6 * k, 0, 7); ctx.arc(x + 4.3 * k, y - 0.8 * k, 0.6 * k, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,120,120,0.28)'; ctx.beginPath(); ctx.arc(x - 6.5 * k, y + 3 * k, 2 * k, 0, 7); ctx.arc(x + 6.5 * k, y + 3 * k, 2 * k, 0, 7); ctx.fill();
    ctx.strokeStyle = '#7a3a33'; ctx.lineWidth = Math.max(1, 1.2 * k); ctx.beginPath();
    if (open) { ctx.stroke(); ctx.fillStyle = '#7a3a33'; ctx.beginPath(); ctx.ellipse(x, y + 5 * k, 2 * k, 1.6 * k, 0, 0, 7); ctx.fill(); ctx.beginPath(); }
    else if (mood >= 60) ctx.arc(x, y + 3.2 * k, 2.6 * k, 0.25, Math.PI - 0.25);
    else if (mood >= 35) { ctx.moveTo(x - 2 * k, y + 5 * k); ctx.lineTo(x + 2 * k, y + 5 * k); }
    else ctx.arc(x, y + 7.2 * k, 2.6 * k, Math.PI + 0.35, -0.35);
    ctx.stroke(); ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.3 * this.cam.zoom;
  }
  rr(x, y, w, h, r, stroke) { const ctx = this.ctx; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill(); if (stroke) ctx.stroke(); }
  ell(x, y, rx, ry, stroke) { const ctx = this.ctx; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); if (stroke) ctx.stroke(); }
  circ(x, y, r, stroke) { const ctx = this.ctx; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); if (stroke) ctx.stroke(); }
  nameTag(s, p, view, z, active) {
    if (z < 0.72 && !active) return;
    const ctx = this.ctx;
    ctx.font = `800 ${10.5 * z}px ${FONT}`; ctx.textAlign = 'center';
    const tw = ctx.measureText(s.name).width + 12 * z, th = 15 * z, y = p.y + 7 * z;
    ctx.fillStyle = 'rgba(30,25,40,0.18)'; this.rr(p.x - tw / 2, y + 1.5 * z, tw, th, th / 2);
    ctx.fillStyle = active ? '#25c48f' : s.home ? 'rgba(255,255,255,0.95)' : '#ffe9b8';
    this.rr(p.x - tw / 2, y, tw, th, th / 2);
    ctx.fillStyle = active ? '#fff' : '#2a2f45'; ctx.fillText(s.name, p.x, y + 11 * z);
  }
  drawBubble(state, s, view, now) {
    let icon = null, color = '#2a2f45', ring = null;
    if (s.bubble) { icon = s.bubble.icon; color = icon === 'heart' ? '#ff4f86' : icon === 'zap' ? '#e5484d' : icon === 'smile' ? '#25a96f' : '#7a6f8f'; }
    else if (s.age === 'bebe' && s.crying) {
      const n = ['hambre', 'higiene', 'social'].sort((a, b) => s.needs[a] - s.needs[b])[0];
      icon = { hambre: 'bottle', higiene: 'drop', social: 'heart' }[n]; color = '#e5484d'; ring = '#e5484d';
    } else if (s.sleeping) return this.zzz(state, s, now);
    else if (s.home && s.age !== 'bebe') {
      const low = NEEDS.filter((n) => s.needs[n] < 30).sort((a, b) => s.needs[a] - s.needs[b])[0];
      if (low) { icon = NEED_IC[low]; color = NEED_COLOR[low]; ring = s.needs[low] < 15 ? '#e5484d' : '#f5a524'; }
      else if (s.worries.length && Math.floor(now / 3) % 3 === 0) { icon = 'cloud'; color = '#8b5cf6'; }
    }
    if (!icon) return;
    const ctx = this.ctx, z = this.cam.zoom, k = z * AGES[s.age].scale;
    const p = this.simPoint(state, s);
    const lying = this.isLying(state, s) || s.age === 'bebe';
    const pop = s.bubble ? Math.min(1, (25 - (s.bubble.until - state.time)) / 2 + 0.6) : 1;
    const y = p.y - (lying ? 34 : 70) * k - 8 * z + Math.sin(now * 3 + s.x) * 1.6 * z;
    const x = p.x + 15 * z, r = 13 * z * pop;
    ctx.fillStyle = 'rgba(30,25,40,0.15)'; ctx.beginPath(); ctx.arc(x, y + 2 * z, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x - 9 * z, y + 12 * z, 3 * z, 0, 7); ctx.arc(x - 13 * z, y + 17 * z, 1.8 * z, 0, 7); ctx.fill();
    if (ring) { ctx.strokeStyle = ring; ctx.lineWidth = 2 * z; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); }
    const img = iconImage(icon, color, 2.4);
    if (img.complete) ctx.drawImage(img, x - r * 0.62, y - r * 0.62, r * 1.24, r * 1.24);
  }
  zzz(state, s, now) {
    const ctx = this.ctx, z = this.cam.zoom; const p = this.simPoint(state, s);
    ctx.textAlign = 'center';
    for (let i = 0; i < 3; i++) {
      const t = (now * 0.6 + i / 3) % 1;
      ctx.globalAlpha = Math.sin(t * Math.PI);
      ctx.font = `900 ${(9 + t * 7) * z}px ${FONT}`;
      ctx.fillStyle = '#e9ecff'; ctx.strokeStyle = 'rgba(40,40,90,0.5)'; ctx.lineWidth = 2;
      const x = p.x + (12 + t * 12) * z, y = p.y - (30 + t * 30) * z;
      ctx.strokeText('z', x, y); ctx.fillText('z', x, y);
    }
    ctx.globalAlpha = 1;
  }
  drawHearts() {
    const ctx = this.ctx, z = this.cam.zoom;
    this.hearts = this.hearts.filter((p) => p.t < 2);
    for (const p of this.hearts) {
      p.t += 1 / 60; if (p.t < 0) continue;
      const q = this.iso(p.x, p.y, 60 + p.t * 55);
      ctx.globalAlpha = Math.max(0, 1 - p.t / 2);
      heartPath(ctx, q.x + p.dx * z * p.t, q.y, 9 * z * p.s);
      ctx.fillStyle = '#ff4f86'; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y, x - s * 0.9, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.9, y - s * 1.1, x + s * 1.4, y, x, y + s * 0.9); ctx.closePath();
}

// Retrato para la interfaz y el editor de personajes
export function drawPortrait(canvas, sim, size = 64) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  if (canvas.width !== size * dpr) { canvas.width = size * dpr; canvas.height = size * dpr; }
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, size, size);
  const L = sim.look; const k = size / 64 * (sim.age === 'bebe' ? 0.82 : sim.age === 'nino' ? 0.92 : 1);
  const cx = size / 2, cy = size * 0.47;
  ctx.lineJoin = 'round'; ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.4 * k;
  if (L.hair === 1 && sim.age !== 'bebe') { ctx.fillStyle = shade(L.hairColor, 0.12); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(cx - 21 * k, cy - 14 * k, 42 * k, 40 * k, 14 * k) : ctx.rect(cx - 21 * k, cy - 14 * k, 42 * k, 40 * k); ctx.fill(); }
  ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.ellipse(cx, size + 6 * k, 24 * k, 24 * k, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(cx, cy, 18 * k, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = L.hairColor;
  if (L.hair !== 3) {
    ctx.beginPath(); ctx.arc(cx, cy - 2 * k, 19 * k, Math.PI * 0.98, Math.PI * 2.02);
    ctx.quadraticCurveTo(cx + 7 * k, cy - 10 * k, cx - 5 * k, cy - 7 * k); ctx.quadraticCurveTo(cx - 13 * k, cy - 5 * k, cx - 19 * k, cy + 1 * k);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (L.hair === 2) { ctx.beginPath(); ctx.arc(cx + 2 * k, cy - 22 * k, 8 * k, 0, 7); ctx.fill(); ctx.stroke(); }
  } else { ctx.beginPath(); ctx.arc(cx, cy, 18 * k, Math.PI * 1.12, Math.PI * 1.88); ctx.fill(); }
  ctx.fillStyle = '#2a1d1a';
  ctx.beginPath(); ctx.ellipse(cx - 6.5 * k, cy + 3 * k, 2.4 * k, 3.1 * k, 0, 0, 7); ctx.ellipse(cx + 6.5 * k, cy + 3 * k, 2.4 * k, 3.1 * k, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - 5.7 * k, cy + 1.8 * k, 0.9 * k, 0, 7); ctx.arc(cx + 7.3 * k, cy + 1.8 * k, 0.9 * k, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,120,120,0.3)'; ctx.beginPath(); ctx.arc(cx - 11 * k, cy + 8 * k, 3.2 * k, 0, 7); ctx.arc(cx + 11 * k, cy + 8 * k, 3.2 * k, 0, 7); ctx.fill();
  ctx.strokeStyle = '#7a3a33'; ctx.lineWidth = 1.8 * k; ctx.beginPath();
  const m = sim.mood ?? 70;
  if (m >= 60) ctx.arc(cx, cy + 8 * k, 4.5 * k, 0.25, Math.PI - 0.25);
  else if (m >= 35) { ctx.moveTo(cx - 3.5 * k, cy + 11 * k); ctx.lineTo(cx + 3.5 * k, cy + 11 * k); }
  else ctx.arc(cx, cy + 15 * k, 4.5 * k, Math.PI + 0.35, -0.35);
  ctx.stroke();
}
