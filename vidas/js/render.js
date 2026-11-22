// Renderizador isométrico 2D en canvas. Solo lee el estado de la simulación.
// Para pasar a 3D bastaría con otra clase con la misma interfaz:
// resize(), render(state, view), screenToTile(x, y), pickSim(state, x, y), addHearts(x, y), centerOn(x, y)
import { OBJECTS, AGES, NEED_INFO, NEEDS } from './data.js';
import { GRID, HOUSE, EXIT, footprint, visibleSims, hourOf } from './sim.js';

const TW = 64, TH = 32, WALL = 74;

function shade(color, f) {
  let r, g, b, a = 1;
  if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255;
  } else {
    const m = color.match(/[\d.]+/g).map(Number); [r, g, b] = m; a = m[3] ?? 1;
  }
  const k = 1 - f;
  return `rgba(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)},${a})`;
}

function rotateBox(b, rot, w, h) {
  let [x, y, bw, bd, z, hh, c] = b; let W = w, H = h;
  for (let i = 0; i < rot; i++) {
    const nx = H - (y + bd), ny = x;
    x = nx; y = ny; [bw, bd] = [bd, bw]; [W, H] = [H, W];
  }
  return [x, y, bw, bd, z, hh, c];
}

export class IsoRenderer {
  constructor(canvas) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.hearts = [];
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    this.dpr = dpr;
    this.w = this.c.clientWidth; this.h = this.c.clientHeight;
    this.c.width = Math.round(this.w * dpr); this.c.height = Math.round(this.h * dpr);
    if (!this.cam.init) {
      this.cam.zoom = Math.min(1.4, Math.max(0.6, this.w / (GRID * TW * 0.95)));
      this.cam.init = true;
    }
  }
  origin() {
    // centro del solar en el centro de la pantalla
    const z = this.cam.zoom;
    return { x: this.w / 2 + this.cam.x, y: this.h / 2 + this.cam.y - GRID * TH / 2 * z + 20 };
  }
  iso(x, y, zpx = 0) {
    const o = this.origin(), z = this.cam.zoom;
    return { x: o.x + (x - y) * TW / 2 * z, y: o.y + (x + y) * TH / 2 * z - zpx * z };
  }
  screenToWorld(sx, sy) {
    const o = this.origin(), z = this.cam.zoom;
    const a = (sx - o.x) / (TW / 2 * z), b = (sy - o.y) / (TH / 2 * z);
    return { x: (a + b) / 2, y: (b - a) / 2 };
  }
  screenToTile(sx, sy) { const w = this.screenToWorld(sx, sy); return { x: Math.floor(w.x), y: Math.floor(w.y) }; }
  centerOn(x, y) {
    this.cam.x = 0; this.cam.y = 0;
    const p = this.iso(x + 0.5, y + 0.5);
    this.cam.x = this.w / 2 - p.x; this.cam.y = this.h / 2 - p.y + 40;
  }
  pan(dx, dy) { this.cam.x += dx; this.cam.y += dy; this.clampCam(); }
  zoomAt(f, sx, sy) {
    const before = this.screenToWorld(sx, sy);
    this.cam.zoom = Math.max(0.45, Math.min(2.6, this.cam.zoom * f));
    const p = this.iso(before.x, before.y);
    this.cam.x += sx - p.x; this.cam.y += sy - p.y; this.clampCam();
  }
  clampCam() {
    const lim = GRID * TW * this.cam.zoom * 0.6;
    this.cam.x = Math.max(-lim, Math.min(lim, this.cam.x));
    this.cam.y = Math.max(-lim, Math.min(lim, this.cam.y));
  }
  addHearts(x, y) { for (let i = 0; i < 6; i++) this.hearts.push({ x: x + 0.5, y: y + 0.5, t: -i * 0.15, dx: (Math.random() - 0.5) * 30 }); }

  pickSim(state, sx, sy) {
    const sims = visibleSims(state).slice().sort((a, b) => (b.x + b.y) - (a.x + a.y));
    for (const s of sims) {
      const p = this.simPoint(state, s); const k = this.cam.zoom * AGES[s.age].scale;
      if (Math.abs(sx - p.x) < 16 * k + 6 && sy > p.y - 56 * k && sy < p.y + 8 * k) return s;
    }
    return null;
  }
  // Objeto bajo el dedo, teniendo en cuenta su altura (el más cercano primero)
  pickObject(state, sx, sy) {
    const objs = state.objects.slice().sort((a, b) => {
      const fa = footprint(a.type, a.rot), fb = footprint(b.type, b.rot);
      return (b.x + fb.w + b.y + fb.h) - (a.x + fa.w + a.y + fa.h);
    });
    for (const o of objs) {
      const def = OBJECTS[o.type]; if (def.walkable) continue;
      const f = footprint(o.type, o.rot);
      const hmax = Math.max(...def.boxes.map((b) => b[4] + b[5]));
      for (let z = 0; z <= hmax; z += 4) {
        const w = this.screenToWorld(sx, sy + z * this.cam.zoom);
        if (w.x >= o.x && w.x < o.x + f.w && w.y >= o.y && w.y < o.y + f.h) return o;
      }
    }
    return null;
  }
  simPoint(state, s) {
    let z = 0;
    if (s.age === 'bebe') z = s.cribId ? 10 : 0;
    else if (this.isLying(state, s)) z = 18;
    else if (this.isSitting(state, s)) z = 10;
    return this.iso(s.x + 0.5, s.y + 0.5, z);
  }
  isLying(state, s) {
    const c = s.cur; if (!c) return false;
    if (c.kind === 'ko') return true;
    if (c.kind === 'obj' && c.phase === 'do' && c.onObj && (c.act === 'dormir' || c.act === 'siesta')) return true;
    if ((c.kind === 'soc' || c.kind === 'partner') && c.bedId && c.phase === 'do') return true;
    return false;
  }
  isSitting(state, s) { const c = s.cur; return c && c.kind === 'obj' && c.phase === 'do' && c.onObj && c.act === 'relajarse'; }

  // ---------- dibujo ----------
  render(state, view) {
    const ctx = this.ctx, z = this.cam.zoom, now = performance.now() / 1000;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const h = hourOf(state.time);
    const night = h < 6 || h >= 21 ? 1 : h < 8 ? (8 - h) / 2 : h > 19 ? (h - 19) / 2 : 0;
    ctx.fillStyle = night > 0.5 ? '#1c2440' : '#a8d8ea';
    ctx.fillRect(0, 0, this.w, this.h);

    // suelo
    for (let x = 0; x < GRID; x++) for (let y = 0; y < GRID; y++) {
      const inside = x < HOUSE && y < HOUSE;
      const path = !inside && y === EXIT.y;
      let col = inside ? ((x + y) % 2 ? '#d9b382' : '#d2ab78') : path ? '#c9c2b4' : ((x + y) % 2 ? '#86c26a' : '#7dba62');
      this.tile(x, y, col, view.build ? 'rgba(0,0,0,0.12)' : null);
    }
    // muros traseros
    this.wall(0, 0, HOUSE, 0, '#efe6da');
    this.wall(0, 0, 0, HOUSE, '#e6dccd');
    this.window(2.5, 0, 'x'); this.window(6.5, 0, 'x'); this.window(0, 4, 'y');
    // salida
    const ep = this.iso(EXIT.x + 0.5, EXIT.y + 0.5);
    ctx.font = `${16 * z}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('🚪', ep.x, ep.y + 5 * z);

    // alfombras
    for (const o of state.objects) if (OBJECTS[o.type].walkable) this.drawObject(state, o, 1, view);
    // objetos y personajes ordenados por profundidad
    const items = [];
    for (const o of state.objects) {
      if (OBJECTS[o.type].walkable) continue;
      const f = footprint(o.type, o.rot);
      items.push({ k: o.x + f.w - 1 + o.y + f.h - 1, draw: () => this.drawObject(state, o, 1, view) });
    }
    for (const s of visibleSims(state)) items.push({ k: s.x + s.y + 0.5, draw: () => this.drawSim(state, s, view, now) });
    if (view.ghost) {
      const g = view.ghost; const f = footprint(g.type, g.rot);
      items.push({ k: g.x + f.w - 1 + g.y + f.h - 1 + 0.6, draw: () => this.drawGhost(state, g) });
    }
    items.sort((a, b) => a.k - b.k).forEach((i) => i.draw());

    // burbujas encima de todo
    for (const s of visibleSims(state)) this.drawBubble(state, s, view, now);

    // corazones
    this.hearts = this.hearts.filter((p) => p.t < 2);
    for (const p of this.hearts) {
      p.t += 1 / 60;
      if (p.t < 0) continue;
      const q = this.iso(p.x, p.y, 60 + p.t * 50);
      ctx.globalAlpha = Math.max(0, 1 - p.t / 2);
      ctx.font = `${18 * z}px sans-serif`; ctx.fillText('❤️', q.x + p.dx * z * p.t, q.y);
      ctx.globalAlpha = 1;
    }

    // noche
    if (night > 0) {
      ctx.fillStyle = `rgba(15,20,60,${0.38 * night})`;
      ctx.fillRect(0, 0, this.w, this.h);
      if (!state.powerOff) for (const o of state.objects) if (o.type === 'lampara') {
        const p = this.iso(o.x + 0.5, o.y + 0.5, 50);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 120 * z);
        g.addColorStop(0, `rgba(255,220,140,${0.35 * night})`); g.addColorStop(1, 'rgba(255,220,140,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - 120 * z, p.y - 120 * z, 240 * z, 240 * z);
      }
    }
  }

  tile(x, y, fill, stroke) {
    const ctx = this.ctx;
    const a = this.iso(x, y), b = this.iso(x + 1, y), c = this.iso(x + 1, y + 1), d = this.iso(x, y + 1);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }
  quad(pts, fill) {
    const ctx = this.ctx; ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  }
  wall(x0, y0, x1, y1, col) {
    this.quad([this.iso(x0, y0), this.iso(x1, y1), this.iso(x1, y1, WALL), this.iso(x0, y0, WALL)], col);
    // remate superior
    const t = 0.12;
    const dx = x1 === x0 ? -t : 0, dy = y1 === y0 ? -t : 0;
    this.quad([this.iso(x0, y0, WALL), this.iso(x1, y1, WALL), this.iso(x1 + dx, y1 + dy, WALL), this.iso(x0 + dx, y0 + dy, WALL)], '#b9a68f');
    this.quad([this.iso(x0, y0), this.iso(x1, y1), this.iso(x1, y1, 6), this.iso(x0, y0, 6)], '#a8875f');
  }
  window(x, y, axis) {
    const w = 1.2;
    const pts = axis === 'x'
      ? [this.iso(x, y, 28), this.iso(x + w, y, 28), this.iso(x + w, y, 60), this.iso(x, y, 60)]
      : [this.iso(x, y, 28), this.iso(x, y + w, 28), this.iso(x, y + w, 60), this.iso(x, y, 60)];
    this.quad(pts, '#8a6a4a');
    const inset = 0.08;
    const p2 = axis === 'x'
      ? [this.iso(x + inset, y, 31), this.iso(x + w - inset, y, 31), this.iso(x + w - inset, y, 57), this.iso(x + inset, y, 57)]
      : [this.iso(x, y + inset, 31), this.iso(x, y + w - inset, 31), this.iso(x, y + w - inset, 57), this.iso(x, y + inset, 57)];
    this.quad(p2, '#bfe3f5');
  }
  box(x, y, w, d, z0, h, col) {
    const top = [this.iso(x, y, z0 + h), this.iso(x + w, y, z0 + h), this.iso(x + w, y + d, z0 + h), this.iso(x, y + d, z0 + h)];
    const right = [this.iso(x + w, y, z0), this.iso(x + w, y + d, z0), this.iso(x + w, y + d, z0 + h), this.iso(x + w, y, z0 + h)];
    const front = [this.iso(x, y + d, z0), this.iso(x + w, y + d, z0), this.iso(x + w, y + d, z0 + h), this.iso(x, y + d, z0 + h)];
    this.quad(right, shade(col, 0.14)); this.quad(front, shade(col, 0.28)); this.quad(top, col);
  }
  drawObject(state, o, alpha, view) {
    const def = OBJECTS[o.type]; const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    if (view?.selected === o.id) {
      const f = footprint(o.type, o.rot);
      for (let i = 0; i < f.w; i++) for (let j = 0; j < f.h; j++) this.tile(o.x + i, o.y + j, 'rgba(255,230,80,0.45)');
    }
    const boxes = def.boxes.map((b) => rotateBox(b, o.rot, def.w, def.h))
      .sort((a, b) => (a[0] + a[2] / 2 + a[1] + a[3] / 2) - (b[0] + b[2] / 2 + b[1] + b[3] / 2) || a[4] - b[4]);
    for (const b of boxes) {
      let col = b[6];
      if (def.power && state.powerOff && col === '#1a1a22') col = '#444';
      this.box(o.x + b[0], o.y + b[1], b[2], b[3], b[4], b[5], col);
    }
    if (o.type === 'tele' && !state.powerOff && o.users.length) {
      // pantalla encendida
      const p = this.iso(o.x + 0.5, o.y + 0.5, 42); ctx.fillStyle = 'rgba(120,200,255,0.5)';
      ctx.beginPath(); ctx.arc(p.x, p.y, 8 * this.cam.zoom, 0, 7); ctx.fill();
    }
    if (o.type === 'buzon' && state.bills.length) {
      const p = this.iso(o.x + 0.5, o.y + 0.5, 62); ctx.font = `${16 * this.cam.zoom}px sans-serif`; ctx.textAlign = 'center';
      ctx.fillText('🧾', p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
  drawGhost(state, g) {
    const f = footprint(g.type, g.rot);
    for (let i = 0; i < f.w; i++) for (let j = 0; j < f.h; j++) this.tile(g.x + i, g.y + j, g.ok ? 'rgba(80,220,120,0.45)' : 'rgba(240,70,70,0.5)');
    this.drawObject(state, { type: g.type, x: g.x, y: g.y, rot: g.rot, users: [] }, 0.75, {});
  }

  drawSim(state, s, view, now) {
    const ctx = this.ctx; const k = this.cam.zoom * AGES[s.age].scale; const L = s.look;
    const p = this.simPoint(state, s);
    const active = view.active === s.id;
    // sombra / selección
    ctx.fillStyle = active ? 'rgba(60,220,110,0.55)' : 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y, 13 * k, 6.5 * k, 0, 0, 7); ctx.fill();
    if (active) { ctx.strokeStyle = '#2bd46b'; ctx.lineWidth = 2; ctx.stroke(); }

    if (s.age === 'bebe') {
      ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.ellipse(p.x, p.y - 6 * k, 14 * k, 9 * k, 0, 0, 7); ctx.fill();
      ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(p.x - 10 * k, p.y - 12 * k, 9 * k, 0, 7); ctx.fill();
      ctx.fillStyle = L.hairColor; ctx.beginPath(); ctx.arc(p.x - 10 * k, p.y - 15 * k, 6 * k, Math.PI, 0); ctx.fill();
      this.eyes(p.x - 10 * k, p.y - 12 * k, k, s.sleeping);
      if (active) this.arrow(p.x, p.y - 34 * k, now);
      this.nameTag(s, p, view, k);
      return;
    }
    if (this.isLying(state, s)) {
      const inBed = s.cur.kind !== 'ko';
      ctx.fillStyle = inBed ? '#6a8fd0' : L.shirt;
      ctx.beginPath(); ctx.ellipse(p.x - 4 * k, p.y + 2 * k, 20 * k, 9 * k, -0.45, 0, 7); ctx.fill();
      ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(p.x + 15 * k, p.y - 8 * k, 8.5 * k, 0, 7); ctx.fill();
      this.hair(L, p.x + 15 * k, p.y - 8 * k, k);
      this.eyes(p.x + 15 * k, p.y - 7 * k, k, true);
      if (active) this.arrow(p.x, p.y - 40 * k, now);
      this.nameTag(s, p, view, k);
      return;
    }
    const walking = s.path && s.path.length > 0;
    const bob = walking ? Math.abs(Math.sin(now * 10)) * 2.5 * k : 0;
    const sit = this.isSitting(state, s);
    const by = p.y - bob;
    // piernas
    if (!sit) {
      const swing = walking ? Math.sin(now * 10) * 3 * k : 0;
      ctx.fillStyle = L.pants;
      ctx.fillRect(p.x - 6 * k + swing, by - 15 * k, 5 * k, 15 * k);
      ctx.fillRect(p.x + 1 * k - swing, by - 15 * k, 5 * k, 15 * k);
      ctx.fillStyle = '#3a2a22';
      ctx.fillRect(p.x - 7 * k + swing, by - 2 * k, 6 * k, 2.5 * k);
      ctx.fillRect(p.x + 1 * k - swing, by - 2 * k, 6 * k, 2.5 * k);
    } else {
      ctx.fillStyle = L.pants; ctx.fillRect(p.x - 7 * k, by - 16 * k, 14 * k, 6 * k);
    }
    // cuerpo
    ctx.fillStyle = L.shirt;
    if (s.gender === 'f' && L.hair !== 3) {
      ctx.beginPath(); ctx.moveTo(p.x - 7 * k, by - 33 * k); ctx.lineTo(p.x + 7 * k, by - 33 * k);
      ctx.lineTo(p.x + 10 * k, by - 13 * k); ctx.lineTo(p.x - 10 * k, by - 13 * k); ctx.closePath(); ctx.fill();
    } else this.roundRect(p.x - 8 * k, by - 33 * k, 16 * k, 20 * k, 4 * k);
    if (s.pregnant) { ctx.beginPath(); ctx.ellipse(p.x + 2 * k, by - 19 * k, 8 * k, 7 * k, 0, 0, 7); ctx.fill(); }
    // brazos
    ctx.fillStyle = L.skin;
    const arm = walking ? Math.sin(now * 10) * 2 * k : 0;
    ctx.fillRect(p.x - 11 * k, by - 31 * k + arm, 3.5 * k, 14 * k);
    ctx.fillRect(p.x + 7.5 * k, by - 31 * k - arm, 3.5 * k, 14 * k);
    // cabeza
    const hy = by - 42 * k;
    ctx.beginPath(); ctx.arc(p.x, hy, 9 * k, 0, 7); ctx.fill();
    this.hair(L, p.x, hy, k);
    this.eyes(p.x, hy + 1 * k, k, false);
    ctx.strokeStyle = 'rgba(80,30,30,0.7)'; ctx.lineWidth = Math.max(1, 1.2 * k);
    ctx.beginPath();
    if (s.mood >= 50) ctx.arc(p.x, hy + 3 * k, 3 * k, 0.2, Math.PI - 0.2);
    else ctx.arc(p.x, hy + 7 * k, 3 * k, Math.PI + 0.3, -0.3);
    ctx.stroke();
    if (active) this.arrow(p.x, hy - 22 * k, now);
    this.nameTag(s, p, view, k);
  }
  hair(L, x, y, k) {
    const ctx = this.ctx; ctx.fillStyle = L.hairColor;
    if (L.hair === 3) { ctx.beginPath(); ctx.arc(x, y, 9 * k, Math.PI * 1.1, Math.PI * 1.9); ctx.fill(); return; }
    ctx.beginPath(); ctx.arc(x, y - 1 * k, 9.6 * k, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    if (L.hair === 1) { ctx.fillRect(x - 10 * k, y - 2 * k, 4 * k, 15 * k); ctx.fillRect(x + 6 * k, y - 2 * k, 4 * k, 15 * k); }
    if (L.hair === 2) { ctx.beginPath(); ctx.arc(x, y - 11 * k, 5 * k, 0, 7); ctx.fill(); }
  }
  eyes(x, y, k, closed) {
    const ctx = this.ctx; ctx.fillStyle = '#222'; ctx.strokeStyle = '#222';
    if (closed) { ctx.lineWidth = Math.max(1, k); ctx.beginPath(); ctx.moveTo(x - 5 * k, y); ctx.lineTo(x - 1.5 * k, y); ctx.moveTo(x + 1.5 * k, y); ctx.lineTo(x + 5 * k, y); ctx.stroke(); return; }
    ctx.beginPath(); ctx.arc(x - 3.2 * k, y, 1.4 * k, 0, 7); ctx.arc(x + 3.2 * k, y, 1.4 * k, 0, 7); ctx.fill();
  }
  roundRect(x, y, w, h, r) {
    const ctx = this.ctx; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h); ctx.fill();
  }
  arrow(x, y, now) {
    const ctx = this.ctx; const z = this.cam.zoom; const b = Math.sin(now * 4) * 3 * z;
    ctx.fillStyle = '#2bd46b'; ctx.strokeStyle = '#137a3a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - 6 * z, y - 8 * z + b); ctx.lineTo(x + 6 * z, y - 8 * z + b); ctx.lineTo(x, y + b); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  nameTag(s, p, view, k) {
    if (this.cam.zoom < 0.7) return;
    const ctx = this.ctx; const z = this.cam.zoom;
    ctx.font = `600 ${10 * z}px system-ui, sans-serif`; ctx.textAlign = 'center';
    const tw = ctx.measureText(s.name).width + 8 * z;
    ctx.fillStyle = s.home ? 'rgba(255,255,255,0.85)' : 'rgba(255,236,190,0.9)';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(p.x - tw / 2, p.y + 6 * z, tw, 13 * z, 6 * z) : ctx.rect(p.x - tw / 2, p.y + 6 * z, tw, 13 * z); ctx.fill();
    ctx.fillStyle = '#333'; ctx.fillText(s.name, p.x, p.y + 16 * z);
  }
  drawBubble(state, s, view, now) {
    let icon = null;
    if (s.bubble) icon = s.bubble.icon;
    else if (s.age === 'bebe' && s.crying) {
      const n = ['hambre', 'higiene', 'social'].sort((a, b) => s.needs[a] - s.needs[b])[0];
      icon = { hambre: '🍼', higiene: '🧷', social: '😭' }[n];
    } else if (s.sleeping) icon = '💤';
    else if (s.cur && s.cur.phase === 'do' && s.cur.icon) icon = s.cur.icon;
    else if (s.home && s.age !== 'bebe') {
      const low = NEEDS.filter((n) => s.needs[n] < 30).sort((a, b) => s.needs[a] - s.needs[b])[0];
      if (low) icon = NEED_INFO[low].icon;
      else if (s.worries.length && Math.floor(now / 3) % 3 === 0) icon = '😟';
    }
    if (!icon) return;
    const ctx = this.ctx; const k = this.cam.zoom * AGES[s.age].scale; const z = this.cam.zoom;
    const p = this.simPoint(state, s);
    const lying = this.isLying(state, s) || s.age === 'bebe';
    const y = p.y - (lying ? 34 : 70) * k - 8 * z + Math.sin(now * 3 + s.x) * 2 * z;
    const x = p.x + 14 * z;
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 13 * z, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(x - 9 * z, y + 13 * z, 3 * z, 0, 7); ctx.fill();
    ctx.font = `${15 * z}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000'; ctx.fillText(icon, x, y + 1 * z);
    ctx.textBaseline = 'alphabetic';
  }
}

// Dibuja un retrato (para la interfaz y el editor de personajes)
export function drawPortrait(canvas, sim, size = 64) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = size * dpr; canvas.height = size * dpr;
  const ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const L = sim.look; const k = size / 64 * (sim.age === 'bebe' ? 0.8 : sim.age === 'nino' ? 0.9 : 1);
  const cx = size / 2, cy = size * 0.48;
  ctx.fillStyle = L.shirt; ctx.beginPath(); ctx.ellipse(cx, size + 4 * k, 22 * k, 22 * k, 0, 0, 7); ctx.fill();
  ctx.fillStyle = L.skin; ctx.beginPath(); ctx.arc(cx, cy, 17 * k, 0, 7); ctx.fill();
  ctx.fillStyle = L.hairColor;
  if (L.hair !== 3) {
    ctx.beginPath(); ctx.arc(cx, cy - 2 * k, 18 * k, Math.PI * 0.95, Math.PI * 2.05); ctx.fill();
    if (L.hair === 1) { ctx.fillRect(cx - 19 * k, cy - 4 * k, 7 * k, 26 * k); ctx.fillRect(cx + 12 * k, cy - 4 * k, 7 * k, 26 * k); }
    if (L.hair === 2) { ctx.beginPath(); ctx.arc(cx, cy - 21 * k, 8 * k, 0, 7); ctx.fill(); }
  } else { ctx.beginPath(); ctx.arc(cx, cy, 17 * k, Math.PI * 1.1, Math.PI * 1.9); ctx.fill(); }
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(cx - 6 * k, cy + 2 * k, 2.2 * k, 0, 7); ctx.arc(cx + 6 * k, cy + 2 * k, 2.2 * k, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(80,30,30,0.8)'; ctx.lineWidth = 1.6 * k; ctx.beginPath();
  if ((sim.mood ?? 70) >= 50) ctx.arc(cx, cy + 6 * k, 5 * k, 0.2, Math.PI - 0.2); else ctx.arc(cx, cy + 13 * k, 5 * k, Math.PI + 0.3, -0.3);
  ctx.stroke();
}
