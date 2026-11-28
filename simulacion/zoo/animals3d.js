// Animales orgánicos: cada parte es una superficie continua generada a partir de formas suaves que se funden
// (campos de distancia + "surface nets"). El pelaje se pinta en 3D (rayas, manchas, zonas) sin estirarse.
// Cada especie se genera una vez y se comparte entre todos sus ejemplares: no añade coste al dibujar.
import { THREE } from '../shared/engine3d.js';

// ---------- vectores mínimos ----------
const V = (x = 0, y = 0, z = 0) => [x, y, z];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;

// ---------- primitivas ----------
const E = (c, r, tag = 'body', k) => ({ t: 'e', c, r, tag, k }); // elipsoide
const C = (a, b, ra, rb, tag = 'body', k) => ({ t: 'c', a, b, ra, rb, tag, k }); // cápsula que se estrecha
function sd(p, q) {
  if (q.t === 'e') { const x = (p[0] - q.c[0]) / q.r[0], y = (p[1] - q.c[1]) / q.r[1], z = (p[2] - q.c[2]) / q.r[2]; const k0 = Math.hypot(x, y, z); const k1 = Math.hypot(x / q.r[0], y / q.r[1], z / q.r[2]); return k1 < 1e-6 ? -Math.min(...q.r) : (k0 * (k0 - 1)) / k1; }
  const ba = sub(q.b, q.a), pa = sub(p, q.a); const t = clamp(dot(pa, ba) / Math.max(1e-9, dot(ba, ba)), 0, 1);
  return len(sub(pa, mul(ba, t))) - mix(q.ra, q.rb, t);
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

// ---------- malla por "surface nets" ----------
const CORNERS = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
// Detalle de las mallas: menos triángulos en modo Ahorro (las normales suaves disimulan la diferencia)
let DETAIL = 0.5;
export function setDetail(d) { if (d !== DETAIL) { DETAIL = d; cache.clear(); } }
function build(prims, { k = 0.05, paint, offset = V(), fur = 0, res = 24, minCell = 0.012 } = {}) {
  const field = (p) => {
    let d = 1e9, best = null, bd = 1e9;
    for (const q of prims) { const v = sd(p, q); d = d === 1e9 ? v : smin(d, v, q.k ?? k); if (v < bd) { bd = v; best = q; } }
    if (fur) d -= (Math.sin(p[0] * 61) * Math.sin(p[1] * 57) * Math.sin(p[2] * 67)) * fur;
    return [d, best];
  };
  // caja que contiene todo
  const lo = V(1e9, 1e9, 1e9), hi = V(-1e9, -1e9, -1e9);
  for (const q of prims) { const pts = q.t === 'e' ? [[q.c, Math.max(...q.r)]] : [[q.a, q.ra], [q.b, q.rb]]; for (const [c, r] of pts) for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], c[i] - r); hi[i] = Math.max(hi[i], c[i] + r); } }
  const size = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]); const h = Math.max(minCell * 1.6 / DETAIL, size / (res * DETAIL));
  for (let i = 0; i < 3; i++) { lo[i] -= h * 2; hi[i] += h * 2; }
  const n = [0, 1, 2].map((i) => Math.ceil((hi[i] - lo[i]) / h)); const [nx, ny, nz] = n;
  const P = (i, j, kk) => (kk * (ny + 1) + j) * (nx + 1) + i;
  const F = new Float32Array((nx + 1) * (ny + 1) * (nz + 1));
  for (let kk = 0; kk <= nz; kk++) for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) F[P(i, j, kk)] = field([lo[0] + i * h, lo[1] + j * h, lo[2] + kk * h])[0];
  const cellV = new Int32Array(nx * ny * nz).fill(-1); const C3 = (i, j, kk) => (kk * ny + j) * nx + i;
  const pos = [];
  for (let kk = 0; kk < nz; kk++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = CORNERS.map(([a, b, c]) => F[P(i + a, j + b, kk + c)]); let inside = 0; for (const x of v) if (x < 0) inside++;
    if (inside === 0 || inside === 8) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (const [a, b] of EDGES) { if ((v[a] < 0) === (v[b] < 0)) continue; const t = v[a] / (v[a] - v[b]); const A = CORNERS[a], B = CORNERS[b]; sx += A[0] + (B[0] - A[0]) * t; sy += A[1] + (B[1] - A[1]) * t; sz += A[2] + (B[2] - A[2]) * t; cnt++; }
    cellV[C3(i, j, kk)] = pos.length / 3; pos.push(lo[0] + (i + sx / cnt) * h, lo[1] + (j + sy / cnt) * h, lo[2] + (kk + sz / cnt) * h);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d); };
  for (let kk = 0; kk < nz; kk++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const s0 = F[P(i, j, kk)] < 0;
    if (j > 0 && kk > 0 && s0 !== (F[P(i + 1, j, kk)] < 0)) quad(cellV[C3(i, j - 1, kk - 1)], cellV[C3(i, j, kk - 1)], cellV[C3(i, j, kk)], cellV[C3(i, j - 1, kk)], !s0);
    if (i > 0 && kk > 0 && s0 !== (F[P(i, j + 1, kk)] < 0)) quad(cellV[C3(i - 1, j, kk - 1)], cellV[C3(i - 1, j, kk)], cellV[C3(i, j, kk)], cellV[C3(i, j, kk - 1)], !s0);
    if (i > 0 && j > 0 && s0 !== (F[P(i, j, kk + 1)] < 0)) quad(cellV[C3(i - 1, j - 1, kk)], cellV[C3(i, j - 1, kk)], cellV[C3(i, j, kk)], cellV[C3(i - 1, j, kk)], !s0);
  }
  // normales del campo (más suaves que las de los triángulos) y color
  const nor = new Float32Array(pos.length), col = new Float32Array(pos.length); const e = h * 0.5; const c = new THREE.Color();
  for (let vI = 0; vI < pos.length; vI += 3) {
    const p = [pos[vI], pos[vI + 1], pos[vI + 2]];
    const gx = field([p[0] + e, p[1], p[2]])[0] - field([p[0] - e, p[1], p[2]])[0], gy = field([p[0], p[1] + e, p[2]])[0] - field([p[0], p[1] - e, p[2]])[0], gz = field([p[0], p[1], p[2] + e])[0] - field([p[0], p[1], p[2] - e])[0];
    const gl = Math.hypot(gx, gy, gz) || 1; nor[vI] = gx / gl; nor[vI + 1] = gy / gl; nor[vI + 2] = gz / gl;
    const best = field(p)[1]; paint(add(p, offset), best.tag, c, [nor[vI], nor[vI + 1], nor[vI + 2]]); col[vI] = c.r; col[vI + 1] = c.g; col[vI + 2] = c.b;
  }
  // orientación correcta de cada triángulo (comparando con la normal del campo)
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, d] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const u = [pos[b] - pos[a], pos[b + 1] - pos[a + 1], pos[b + 2] - pos[a + 2]], w = [pos[d] - pos[a], pos[d + 1] - pos[a + 1], pos[d + 2] - pos[a + 2]];
    const fn = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    if (fn[0] * nor[a] + fn[1] * nor[a + 1] + fn[2] * nor[a + 2] < 0) { const tmp = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = tmp; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  return g;
}

// ---------- pelaje ----------
const hash3 = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function voronoi(p, cell) { // distancia a la 1ª y 2ª semilla más cercanas
  const q = p.map((v) => v / cell); const b = q.map(Math.floor); let d1 = 9, d2 = 9;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) { const c = [b[0] + i, b[1] + j, b[2] + k]; const s = [c[0] + hash3(...c), c[1] + hash3(c[1], c[2], c[0]), c[2] + hash3(c[2], c[0], c[1])]; const d = Math.hypot(s[0] - q[0], s[1] - q[1], s[2] - q[2]); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
  return [d1, d2];
}
const noise = (p) => Math.sin(p[0] * 23.1 + Math.sin(p[2] * 9.7)) * Math.sin(p[1] * 19.3 + p[2] * 7.1) * 0.5 + 0.5;
function painter(M) {
  const cs = {}; for (const [k, v] of Object.entries(M.col)) cs[k] = new THREE.Color(v);
  cs.dark ||= new THREE.Color('#222'); cs.mane ||= cs.dark; cs.tuft ||= cs.mane; cs.hoof ||= cs.dark; cs.nose ||= cs.dark; cs.face ||= cs.belly || cs.body; cs.spot ||= cs.dark;
  const yBelly = M.bodyY - M.H * 0.25;
  return (p, tag, out, nrm) => {
    let c = cs[tag] || cs.body; out.copy(c);
    const pat = M.pattern;
    if (tag === 'body' || tag === 'neck' || tag === 'leg' || tag === 'head' || tag === 'tail' || tag === 'snout') {
      // vientre más claro
      if (cs.belly && (tag === 'body' || tag === 'neck') && p[1] < yBelly && nrm[1] < 0.2) out.lerp(cs.belly, clamp((yBelly - p[1]) / (M.H * 0.3), 0, 1) * 0.8);
      if (pat === 'stripes' || (pat === 'legstripes' && (tag === 'leg' || (tag === 'body' && p[2] < -M.L * 0.25))) || pat === 'tiger' || pat === 'faint') {
        const along = tag === 'leg' || tag === 'tail' ? p[1] * 1.6 : tag === 'neck' ? p[1] * 1.1 + p[2] * 0.4 : tag === 'head' || tag === 'snout' ? p[2] * 0.9 + p[1] * 0.6 : p[2] + Math.sin(p[1] * 14) * 0.03;
        const f = pat === 'tiger' ? 15 : pat === 'faint' ? 13 : 18; const w = Math.sin(along * f * 2 + noise(p) * (pat === 'tiger' ? 2.5 : 1.2));
        const th = pat === 'tiger' ? 0.55 : pat === 'faint' ? 0.75 : 0.05;
        if (w > th && !(pat !== 'stripes' && tag === 'body' && p[1] < yBelly && nrm[1] < 0)) out.copy(cs.dark).lerp(c, pat === 'faint' ? 0.55 : 0);
      }
      if (pat === 'patches' && tag !== 'snout' && tag !== 'leg') { const n = Math.sin(p[0] * 13 + 1.3) * Math.sin(p[1] * 9 + 0.4) * Math.sin(p[2] * 11 + 0.7) + Math.sin(p[2] * 5 + p[0] * 4) * 0.35; if (n > 0.22) out.copy(cs.spot); }
      if (pat === 'spots' && tag !== 'snout') { const [d1, d2] = voronoi(p, 0.085); if (d2 - d1 > 0.12 && p[1] > M.legH * 0.45) out.copy(cs.spot); }
      if (pat === 'panda') { const black = tag === 'leg' || (tag === 'body' && Math.abs(p[2] - M.L * 0.15) < M.L * 0.16 && p[1] > M.bodyY - M.H * 0.35) || tag === 'ear'; if (black) out.copy(cs.dark); }
      if (pat === 'tuxedo') { if (nrm[2] > 0.15 && tag === 'body') out.copy(cs.belly); }
    }
    if (tag === 'shell') { const [d1, d2] = voronoi(p, 0.12); out.lerp(cs.dark, d2 - d1 < 0.1 ? 0.7 : 0.05); }
    // variación sutil de pelo
    const v = 0.93 + noise(mul(p, 3)) * 0.12; out.multiplyScalar(v);
  };
}

// ---------- modelos por especie ----------
// Parámetros comunes: L,H,W cuerpo; legH patas; neckL/neckA cuello; headR cabeza; snoutL hocico
const MODELS = {
  cabra: { arch: 'quad', L: 0.55, H: 0.32, W: 0.28, legH: 0.32, legR: 0.045, neckL: 0.16, neckA: 0.7, neckR: 0.07, headR: 0.09, snoutL: 0.11, snoutR: 0.04, col: { body: '#ece6d8', belly: '#f8f4ec', dark: '#5a4a3a', nose: '#3a302a', hoof: '#3a302a' }, ears: 'side', horns: true, beard: true, tail: 0.07, hooves: true },
  alpaca: { arch: 'quad', L: 0.58, H: 0.38, W: 0.34, legH: 0.4, legR: 0.05, neckL: 0.42, neckA: 0.15, neckR: 0.075, headR: 0.085, snoutL: 0.07, snoutR: 0.045, col: { body: '#e6cfa6', belly: '#efdcbc', dark: '#3a2a20', nose: '#3a2a20', hoof: '#3a2a20' }, ears: 'up', tail: 0.07, fur: 0.012, hooves: true, topknot: true },
  llama: { arch: 'quad', L: 0.64, H: 0.4, W: 0.33, legH: 0.5, legR: 0.05, neckL: 0.55, neckA: 0.12, neckR: 0.075, headR: 0.09, snoutL: 0.09, snoutR: 0.045, col: { body: '#f2ece0', belly: '#f6f2ea', dark: '#7a5a3a', spot: '#a8805a', nose: '#3a2a20', hoof: '#3a2a20' }, pattern: 'spots', ears: 'up', earL: 0.12, tail: 0.08, fur: 0.008, hooves: true },
  cebra: { arch: 'quad', L: 0.85, H: 0.42, W: 0.32, legH: 0.6, legR: 0.055, neckL: 0.36, neckA: 0.55, neckR: 0.085, headR: 0.1, snoutL: 0.2, snoutR: 0.05, col: { body: '#f6f6f2', belly: '#f6f6f2', dark: '#161616', nose: '#1a1a1a', hoof: '#222', mane: '#1a1a1a' }, pattern: 'stripes', ears: 'up', mane: 'short', tail: 0.32, tuft: true, hooves: true },
  caballo: { arch: 'quad', L: 0.92, H: 0.46, W: 0.34, legH: 0.64, legR: 0.058, neckL: 0.42, neckA: 0.5, neckR: 0.09, headR: 0.105, snoutL: 0.24, snoutR: 0.055, col: { body: '#8a5634', belly: '#9a6640', dark: '#2a180c', nose: '#3a2418', hoof: '#2a2420', mane: '#2a180c' }, ears: 'up', mane: 'long', tail: 0.42, tailHair: true, hooves: true },
  burro: { arch: 'quad', L: 0.68, H: 0.38, W: 0.3, legH: 0.44, legR: 0.05, neckL: 0.28, neckA: 0.6, neckR: 0.08, headR: 0.1, snoutL: 0.17, snoutR: 0.055, col: { body: '#8d8780', belly: '#d8d2c8', dark: '#2a2420', nose: '#e8e2d8', hoof: '#2a2420', mane: '#3a3430' }, ears: 'long', mane: 'short', tail: 0.3, tuft: true, hooves: true },
  jirafa: { arch: 'quad', L: 0.85, H: 0.5, W: 0.34, legH: 1.0, legR: 0.05, neckL: 1.1, neckA: 0.28, neckR: 0.08, headR: 0.09, snoutL: 0.15, snoutR: 0.045, slope: 0.18, col: { body: '#f0dcae', spot: '#b0622a', belly: '#f4e6c4', dark: '#5a3a1a', nose: '#5a3a1a', hoof: '#3a2a1a', mane: '#8a5022' }, pattern: 'spots', ears: 'side', ossicones: true, mane: 'short', tail: 0.38, tuft: true, hooves: true },
  leon: { arch: 'quad', L: 0.95, H: 0.48, W: 0.38, legH: 0.48, legR: 0.07, neckL: 0.14, neckA: 0.9, neckR: 0.11, headR: 0.15, snoutL: 0.09, snoutR: 0.07, round: true, col: { body: '#d6a25a', belly: '#ecc896', dark: '#6a3e16', nose: '#5a3020', mane: '#7a4818', tuft: '#4a2a10' }, ears: 'round', mane: 'lion', tail: 0.5, tuft: true, paws: true },
  tigre: { arch: 'quad', L: 1.0, H: 0.47, W: 0.37, legH: 0.46, legR: 0.07, neckL: 0.14, neckA: 0.9, neckR: 0.11, headR: 0.15, snoutL: 0.09, snoutR: 0.075, round: true, col: { body: '#e8862a', belly: '#f8f0e2', dark: '#171210', nose: '#c87a6a' }, pattern: 'tiger', ears: 'round', tail: 0.52, paws: true },
  osopolar: { arch: 'quad', L: 1.05, H: 0.6, W: 0.55, legH: 0.42, legR: 0.1, neckL: 0.24, neckA: 1.05, neckR: 0.15, headR: 0.15, snoutL: 0.13, snoutR: 0.075, round: true, col: { body: '#f2efe4', belly: '#e8e4d8', dark: '#222', nose: '#1a1a1a' }, ears: 'round', tail: 0.06, paws: true, fur: 0.0022 },
  osopardo: { arch: 'quad', L: 1.0, H: 0.6, W: 0.55, legH: 0.42, legR: 0.1, neckL: 0.2, neckA: 0.95, neckR: 0.15, headR: 0.16, snoutL: 0.11, snoutR: 0.075, round: true, hump: true, col: { body: '#6e4628', belly: '#5e3c22', dark: '#2a1a10', nose: '#1a1410' }, ears: 'round', tail: 0.06, paws: true, fur: 0.0028 },
  panda: { arch: 'quad', L: 0.8, H: 0.55, W: 0.5, legH: 0.34, legR: 0.1, neckL: 0.12, neckA: 1.0, neckR: 0.15, headR: 0.17, snoutL: 0.07, snoutR: 0.07, round: true, col: { body: '#f6f4ee', belly: '#f6f4ee', dark: '#161616', nose: '#161616' }, pattern: 'panda', ears: 'round', earDark: true, eyePatch: true, tail: 0.05, paws: true, fur: 0.005 },
  elefante: { arch: 'quad', L: 1.3, H: 0.95, W: 0.8, legH: 0.7, legR: 0.15, neckL: 0.12, neckA: 1.2, neckR: 0.26, headR: 0.32, snoutL: 0, snoutR: 0.1, round: true, col: { body: '#9a9aa0', belly: '#8a8a90', dark: '#6a6a70', nose: '#8a8a90', tuft: '#3a3a3a' }, ears: 'big', trunk: true, tusks: true, tail: 0.32, tuft: true, feet: true },
  mono: { arch: 'quad', L: 0.34, H: 0.34, W: 0.26, legH: 0.3, legR: 0.035, neckL: 0.06, neckA: 0.6, neckR: 0.06, headR: 0.11, snoutL: 0.04, snoutR: 0.05, round: true, slope: -0.2, col: { body: '#7a5232', belly: '#a07a52', face: '#e8c8a0', dark: '#3a2414', nose: '#5a3a2a' }, ears: 'monkey', tail: 0.5, tailCurl: true, paws: true, face: true },
  vaca: { arch: 'quad', L: 0.95, H: 0.5, W: 0.45, legH: 0.45, legR: 0.07, neckL: 0.2, neckA: 0.8, neckR: 0.12, headR: 0.12, snoutL: 0.14, snoutR: 0.07, col: { body: '#f2ece2', belly: '#f6f0e6', dark: '#2a2220', spot: '#2a2220', nose: '#d8a0a0', hoof: '#2a2420' }, pattern: 'patches', ears: 'side', horns: true, tail: 0.4, tuft: true, hooves: true },
  ciervo: { arch: 'quad', L: 0.85, H: 0.45, W: 0.32, legH: 0.6, legR: 0.045, neckL: 0.36, neckA: 0.5, neckR: 0.08, headR: 0.095, snoutL: 0.13, snoutR: 0.04, col: { body: '#9a6a40', belly: '#e8d4b0', dark: '#3a2a1a', nose: '#2a1a10', hoof: '#2a2018' }, ears: 'up', antlers: true, tail: 0.08, hooves: true },
  lobo: { arch: 'quad', L: 0.75, H: 0.38, W: 0.26, legH: 0.42, legR: 0.05, neckL: 0.14, neckA: 0.8, neckR: 0.09, headR: 0.11, snoutL: 0.15, snoutR: 0.045, col: { body: '#7c7c82', belly: '#d8d8d8', dark: '#2a2a2e', nose: '#1a1a1a' }, ears: 'up', earL: 0.07, tail: 0.42, paws: true, fur: 0.002 },
  zorro: { arch: 'quad', L: 0.5, H: 0.25, W: 0.18, legH: 0.22, legR: 0.03, neckL: 0.08, neckA: 0.8, neckR: 0.06, headR: 0.08, snoutL: 0.11, snoutR: 0.03, col: { body: '#d8742a', belly: '#f4ece0', dark: '#2a1a10', nose: '#1a1010' }, ears: 'up', earL: 0.065, tail: 0.38, paws: true },
  canguro: { arch: 'roo', L: 0.5, H: 0.55, W: 0.34, legH: 0.4, legR: 0.07, headR: 0.1, snoutL: 0.1, snoutR: 0.045, col: { body: '#c8885a', belly: '#e8c09a', dark: '#4a3020', nose: '#2a1a10' }, ears: 'up', earL: 0.13 },
  flamenco: { arch: 'bird', L: 0.36, H: 0.26, W: 0.22, legH: 0.62, headR: 0.06, col: { body: '#f4849f', belly: '#f8a8bc', dark: '#2a2a2a', beak: '#f0e0d0', leg: '#e07a90' } },
  pinguino: { arch: 'penguin', L: 0.3, H: 0.42, W: 0.28, legH: 0.06, headR: 0.1, col: { body: '#1c1f2a', belly: '#f4f4f0', dark: '#1c1f2a', beak: '#f0a030', leg: '#f0a030', cheek: '#f5c040' } },
  tortuga: { arch: 'turtle', L: 0.7, H: 0.32, W: 0.55, legH: 0.12, headR: 0.09, col: { body: '#8a8a5a', shell: '#7a6a3a', dark: '#4a3a1a', belly: '#c8b880' } },
};
// Híbridos: mezcla de los padres con su propio pelaje
const HYB = {
  cebrallo: ['caballo', 'cebra', { pattern: 'legstripes', col: { body: '#9a6a44', dark: '#1e1410', belly: '#a87a52' } }],
  cebrasno: ['burro', 'cebra', { pattern: 'legstripes', ears: 'long', col: { body: '#a8a29a', dark: '#1e1a18', belly: '#e0dad0' } }],
  mula: ['caballo', 'burro', { ears: 'long', col: { body: '#6e4a30', belly: '#a88a70', dark: '#2a1a10', nose: '#c8b8a8' } }],
  ligre: ['leon', 'tigre', { L: 1.15, H: 0.55, W: 0.43, legH: 0.54, headR: 0.17, pattern: 'faint', mane: 'small', col: { body: '#d89a50', belly: '#f0dcb4', dark: '#8a5a30' } }],
  tigon: ['tigre', 'leon', { L: 0.92, pattern: 'tiger', mane: 'small', col: { body: '#d8964a', belly: '#f2e2c4', dark: '#3a2414', mane: '#9a6430' } }],
  pizzly: ['osopolar', 'osopardo', { col: { body: '#c8ac86', belly: '#b89a74', dark: '#3a2a1a' } }],
  huarizo: ['llama', 'alpaca', { pattern: null, col: { body: '#ead8b8', belly: '#f2e6d0', dark: '#4a3a2a' } }],
};
export function modelOf(sp) {
  if (MODELS[sp]) return MODELS[sp];
  const h = HYB[sp]; if (!h) return MODELS.cabra;
  const [a, b, over] = h; const A = MODELS[a], B = MODELS[b]; const m = { ...A };
  for (const k of ['L', 'H', 'W', 'legH', 'legR', 'neckL', 'neckA', 'neckR', 'headR', 'snoutL', 'snoutR', 'tail']) if (typeof A[k] === 'number' && typeof B[k] === 'number') m[k] = (A[k] + B[k]) / 2;
  Object.assign(m, over, { col: { ...A.col, ...(over.col || {}) } }); MODELS[sp] = m; return m;
}

// ---------- construcción ----------
const furMat = new THREE.MeshLambertMaterial({ vertexColors: true });
const EYE_W = new THREE.MeshLambertMaterial({ color: '#f2ede2' }), EYE_P = new THREE.MeshLambertMaterial({ color: '#100c0a' }), EYE_H = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const solid = new Map(); const smat = (c) => solid.get(c) || (solid.set(c, new THREE.MeshLambertMaterial({ color: c })), solid.get(c));
const cache = new Map();

function eye(r, round) {
  const g = new THREE.Group();
  const w = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), EYE_W); w.scale.set(0.8, 1, 1); g.add(w);
  const p = new THREE.Mesh(new THREE.SphereGeometry(r * 0.78, 12, 10), EYE_P); p.position.z = r * (round ? 0.38 : 0.3); g.add(p);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.22, 6, 5), EYE_H); hl.position.set(r * 0.2, r * 0.32, r * 0.95); g.add(hl);
  return g;
}
function earMesh(type, r, color, inner) {
  const g = new THREE.Group();
  if (type === 'round' || type === 'monkey') { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), smat(color)); e.scale.set(1, 1, 0.45); g.add(e); const i = new THREE.Mesh(new THREE.SphereGeometry(r * 0.62, 10, 8), smat(inner)); i.scale.set(1, 1, 0.3); i.position.z = r * 0.16; g.add(i); return g; }
  if (type === 'big') { const e = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), smat(color)); e.scale.set(0.95, 1.1, 0.12); g.add(e); const i = new THREE.Mesh(new THREE.SphereGeometry(r * 0.8, 14, 10), smat(inner)); i.scale.set(0.95, 1.05, 0.06); i.position.z = r * 0.06; g.add(i); return g; }
  const e = new THREE.Mesh(new THREE.ConeGeometry(r * 0.42, r * 1.7, 10), smat(color)); e.scale.z = 0.45; e.position.y = r * 0.8; g.add(e);
  const i = new THREE.Mesh(new THREE.ConeGeometry(r * 0.26, r * 1.25, 8), smat(inner)); i.scale.z = 0.25; i.position.set(0, r * 0.72, r * 0.07); g.add(i);
  return g;
}

function quadParts(M) {
  const { L, H, W, legH, legR, headR } = M; const bodyY = legH + H * 0.45; M.bodyY = bodyY; const paint = painter(M); const sz = Math.max(L, H);
  const slope = M.slope || 0; // lomo inclinado (jirafa) o al revés (mono)
  const hipY = legH + H * 0.12, shY = legH + H * 0.12 + slope * 0.6;
  const parts = {};
  // tronco
  const torso = [E(V(0, bodyY + slope * 0.4, L * 0.27), V(W * 0.5, H * 0.56, L * 0.3)), E(V(0, bodyY + slope * 0.15, 0), V(W * 0.47, H * 0.5, L * 0.36)), E(V(0, bodyY - slope * 0.1, -L * 0.28), V(W * 0.5, H * 0.52, L * 0.28))];
  if (M.hump) torso.push(E(V(0, bodyY + H * 0.38, L * 0.22), V(W * 0.32, H * 0.3, L * 0.18)));
  for (const sx of [-1, 1]) { torso.push(E(V(sx * W * 0.27, hipY, -L * 0.3), V(legR * 1.5, legR * 1.7, legR * 1.6))); torso.push(E(V(sx * W * 0.28, shY, L * 0.3), V(legR * 1.3, legR * 1.5, legR * 1.3))); }
  const neckBase = V(0, bodyY + H * 0.22 + slope * 0.5, L * 0.38);
  torso.push(E(neckBase, V(M.neckR * 1.25, M.neckR * 1.25, M.neckR * 1.25), 'neck'));
  parts.torso = build(torso, { k: sz * 0.12, paint, fur: M.fur || 0 });
  // cuello
  const dir = V(0, Math.cos(M.neckA), Math.sin(M.neckA)); const top = mul(dir, M.neckL);
  const neck = [E(V(), V(M.neckR * 1.25, M.neckR * 1.25, M.neckR * 1.25), 'neck'), C(V(), top, M.neckR * 1.15, M.neckR * 0.78, 'neck'), E(top, V(M.neckR * 0.8, M.neckR * 0.8, M.neckR * 0.8), 'neck')];
  if (M.mane === 'lion') for (let i = 0; i < 3; i++) neck.push(E(mul(top, 0.25 + i * 0.3), V(M.neckR * 1.9, M.neckR * 1.9, M.neckR * 1.6), 'mane'));
  parts.neck = build(neck, { k: sz * 0.08, paint, offset: neckBase, fur: M.mane === 'lion' ? 0.018 : M.fur || 0 });
  parts.neckBase = neckBase; parts.neckTop = top;
  // cabeza (pivote en lo alto del cuello)
  const hc = V(0, headR * 0.35, headR * 0.25); const sTip = add(hc, V(0, -headR * 0.35 - (M.round ? 0 : M.snoutL * 0.45), headR * 0.6 + M.snoutL));
  const head = [E(V(), V(M.neckR * 0.8, M.neckR * 0.8, M.neckR * 0.8), 'neck'), E(hc, V(headR * 0.9, headR * 0.92, headR * 1.0), 'head'), C(add(hc, V(0, -headR * 0.1, headR * 0.4)), sTip, M.round ? headR * 0.62 : headR * 0.62, M.snoutR, 'snout'), E(add(sTip, V(0, 0, M.snoutR * 0.2)), V(M.snoutR * 1.05, M.snoutR * 0.85, M.snoutR * 0.7), 'nose')];
  if (M.round) head.push(E(add(hc, V(0, -headR * 0.3, headR * 0.7)), V(headR * 0.55, headR * 0.42, headR * 0.45), M.face ? 'face' : 'snout'));
  if (M.face) head.push(E(add(hc, V(0, headR * 0.05, headR * 0.65)), V(headR * 0.62, headR * 0.6, headR * 0.4), 'face'));
  if (M.mane === 'lion') for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; head.push(E(add(hc, V(Math.cos(a) * headR * 1.0, Math.sin(a) * headR * 1.0, -headR * 0.25)), V(headR * 0.55, headR * 0.55, headR * 0.5), 'mane')); }
  if (M.mane === 'small') for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; head.push(E(add(hc, V(Math.cos(a) * headR * 0.8, Math.sin(a) * headR * 0.8 - headR * 0.1, -headR * 0.3)), V(headR * 0.38, headR * 0.38, headR * 0.35), 'mane')); }
  if (M.topknot) head.push(E(add(hc, V(0, headR * 0.85, 0)), V(headR * 0.6, headR * 0.45, headR * 0.6), 'body'));
  if (M.beard) head.push(C(add(sTip, V(0, -M.snoutR * 0.6, -M.snoutR * 1.2)), add(sTip, V(0, -M.snoutR * 2.6, -M.snoutR * 1.6)), M.snoutR * 0.5, M.snoutR * 0.15, 'belly'));
  if (M.trunk) { let p = add(hc, V(0, -headR * 0.15, headR * 0.85)); let r = headR * 0.32; for (let i = 0; i < 6; i++) { const np = add(p, V(0, -headR * 0.32, headR * (0.16 - i * 0.07))); head.push(C(p, np, r, r * 0.86, 'snout')); p = np; r *= 0.86; } }
  parts.head = build(head, { k: headR * 0.35, paint, offset: add(neckBase, top), fur: M.mane === 'lion' ? 0.02 : M.fur || 0, res: 26, minCell: 0.008 });
  parts.hc = hc; parts.sTip = sTip;
  // patas: muslo (con rodilla) y caña (con pezuña o zarpa)
  const legLen = hipY; const up = legLen * 0.52;
  for (const back of [false, true]) {
    const r = legR * (back ? 1.12 : 1); const kz = back ? -r * 0.5 : r * 0.25;
    const upper = [E(V(), V(r * 1.5, r * 1.6, r * 1.5), 'leg'), C(V(), V(0, -up, kz), r * 1.25, r * 0.72, 'leg'), E(V(0, -up, kz), V(r * 0.72, r * 0.72, r * 0.72), 'leg')];
    parts[back ? 'upperB' : 'upperF'] = build(upper, { k: r * 0.8, paint, offset: V(0, hipY, back ? -L * 0.3 : L * 0.3), fur: M.fur || 0, res: 14, minCell: 0.008 });
    const low = legLen - up; const foot = M.hooves ? 'hoof' : 'leg';
    const lower = [E(V(), V(r * 0.72, r * 0.72, r * 0.72), 'leg'), C(V(), V(0, -low + r * 0.5, back ? r * 0.3 : 0), r * 0.68, r * (M.feet ? 0.85 : 0.5), 'leg')];
    if (M.hooves) lower.push(C(V(0, -low + r * 0.55, back ? r * 0.3 : 0), V(0, -low + r * 0.12, back ? r * 0.36 : r * 0.08), r * 0.55, r * 0.66, 'hoof'));
    else if (M.paws) lower.push(E(V(0, -low + r * 0.5, r * 0.45), V(r * 0.85, r * 0.55, r * 1.15), 'leg'));
    else lower.push(E(V(0, -low + r * 0.6, 0), V(r * 0.95, r * 0.6, r * 0.95), foot));
    parts[back ? 'lowerB' : 'lowerF'] = build(lower, { k: r * 0.6, paint, offset: V(0, hipY - up, back ? -L * 0.3 : L * 0.3), fur: M.fur ? M.fur * 0.5 : 0, res: 14, minCell: 0.008 });
    parts[back ? 'upB' : 'upF'] = up; parts.kz = parts.kz || {}; parts.kz[back ? 'B' : 'F'] = kz;
  }
  parts.hipY = hipY; parts.shY = shY;
  // cola
  const tl = M.tail; const tail = [E(V(), V(legR * 0.6, legR * 0.6, legR * 0.6), 'tail')];
  if (M.tailCurl) { let p = V(); for (let i = 0; i < 7; i++) { const a = i * 0.45; const np = add(p, V(0, Math.sin(a) * tl * 0.16 - 0.01, -Math.cos(a) * tl * 0.16)); tail.push(C(p, np, legR * 0.42, legR * 0.38, 'tail')); p = np; } }
  else { tail.push(C(V(), V(0, -tl * 0.9, -tl * 0.35), M.tailHair ? legR * 0.9 : legR * 0.5, M.tailHair ? legR * 1.1 : legR * 0.25, M.tailHair ? 'mane' : 'tail')); if (M.tuft) tail.push(E(V(0, -tl * 0.95, -tl * 0.37), V(legR * 0.55, legR * 0.9, legR * 0.55), 'tuft')); }
  parts.tail = build(tail, { k: legR * 0.4, paint, offset: V(0, bodyY, -L * 0.5), res: 12, minCell: 0.006 });
  // crin corta a lo largo del cuello
  if (M.mane === 'short' || M.mane === 'long') parts.maneGeo = build([C(V(0, 0, -M.neckR * 0.4), add(top, V(0, M.neckR * 0.2, -M.neckR * 0.7)), M.neckR * (M.mane === 'long' ? 0.55 : 0.4), M.neckR * 0.3, 'mane')], { k: 0.02, paint, offset: neckBase, res: 14, minCell: 0.006, fur: M.mane === 'long' ? 0.006 : 0 });
  return parts;
}

// Ensambla un animal de patas: devuelve la misma estructura que espera el juego
function assembleQuad(M, parts) {
  const { L, W, headR } = M;
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const torso = new THREE.Mesh(parts.torso, furMat); body.add(torso);
  const neck = new THREE.Group(); neck.position.set(...parts.neckBase); body.add(neck);
  neck.add(new THREE.Mesh(parts.neck, furMat)); if (parts.maneGeo) neck.add(new THREE.Mesh(parts.maneGeo, furMat));
  const head = new THREE.Group(); head.position.set(...parts.neckTop); neck.add(head);
  head.add(new THREE.Mesh(parts.head, furMat));
  const hc = parts.hc;
  // ojos
  const er = Math.max(0.012, headR * (M.round ? 0.14 : 0.15));
  for (const sd of [-1, 1]) { const e = eye(er, M.round); e.position.set(sd * headR * (M.round ? 0.48 : 0.68), hc[1] + headR * (M.round ? 0.28 : 0.25), hc[2] + headR * (M.round ? 0.78 : 0.55)); e.rotation.y = sd * (M.round ? 0.35 : 0.9); head.add(e);
    if (M.eyePatch) { const p = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.26, 12, 10), smat(M.col.dark)); p.scale.set(0.75, 1.1, 0.35); p.position.set(sd * headR * 0.47, hc[1] + headR * 0.22, hc[2] + headR * 0.74); p.rotation.set(0, sd * 0.4, sd * 0.5); head.add(p); e.position.z += headR * 0.04; } }
  // orejas, cuernos
  const earC = M.earDark ? M.col.dark : M.col.body, earIn = M.ears === 'big' ? '#8a7a80' : M.earDark ? '#2a2a2a' : '#d8a0a0';
  if (M.ears) for (const sd of [-1, 1]) {
    const t = M.ears; const r = t === 'big' ? headR * 1.15 : t === 'long' ? headR * 0.95 : t === 'round' ? headR * 0.32 : t === 'monkey' ? headR * 0.3 : (M.earL || headR * 0.55);
    const e = earMesh(t === 'long' ? 'up' : t === 'side' ? 'up' : t, r, earC, earIn);
    if (t === 'big') { e.position.set(sd * headR * 0.95, hc[1] - headR * 0.05, hc[2] - headR * 0.25); e.rotation.y = sd * 1.25; }
    else if (t === 'round') { e.position.set(sd * headR * 0.66, hc[1] + headR * 0.72, hc[2] - headR * 0.08); e.rotation.z = -sd * 0.3; }
    else if (t === 'monkey') { e.position.set(sd * headR * 0.92, hc[1] + headR * 0.15, hc[2]); e.rotation.y = sd * 1.4; }
    else if (t === 'side') { e.position.set(sd * headR * 0.75, hc[1] + headR * 0.45, hc[2] - headR * 0.25); e.rotation.z = -sd * 1.15; }
    else { e.position.set(sd * headR * 0.45, hc[1] + headR * 0.7, hc[2] - headR * 0.25); e.rotation.set(-0.25, 0, -sd * (t === 'long' ? 0.25 : 0.32)); }
    head.add(e);
    if (M.horns) { const h = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.16, headR * 1.3, 8), smat('#6a5a48')); h.position.set(sd * headR * 0.3, hc[1] + headR * 1.05, hc[2] - headR * 0.35); h.rotation.x = -0.75; head.add(h); }
    if (M.antlers) { const am = smat('#7a5e40'); const base = new THREE.Group(); base.position.set(sd * headR * 0.32, hc[1] + headR * 0.9, hc[2] - headR * 0.3); base.rotation.set(-0.35, 0, -sd * 0.45); head.add(base);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.06, headR * 0.1, headR * 2.2, 6), am); beam.position.y = headR * 1.1; base.add(beam);
      for (const [y, rz, l] of [[0.6, 0.9, 0.9], [1.2, -0.7, 0.8], [1.7, 0.6, 0.6]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.04, headR * 0.06, headR * l, 6), am); t.position.set(sd * headR * 0.22 * Math.sign(rz), headR * y + headR * 0.25, headR * 0.12); t.rotation.set(0.5, 0, -sd * rz); base.add(t); } }
    if (M.ossicones) { const o = new THREE.Mesh(new THREE.CylinderGeometry(headR * 0.12, headR * 0.15, headR * 0.9, 8), smat(M.col.spot || '#8a5a2a')); o.position.set(sd * headR * 0.28, hc[1] + headR * 1.1, hc[2] - headR * 0.2); head.add(o); const tip = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.18, 8, 6), smat('#3a2414')); tip.position.set(sd * headR * 0.28, hc[1] + headR * 1.55, hc[2] - headR * 0.2); head.add(tip); }
    if (M.tusks) { const tk = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.1, headR * 1.1, 10), smat('#f4efe0')); tk.position.set(sd * headR * 0.35, hc[1] - headR * 0.6, hc[2] + headR * 0.85); tk.rotation.x = 2.2; head.add(tk); }
  }
  // patas
  const legs = [];
  for (const [sx, back] of [[-1, false], [1, false], [-1, true], [1, true]]) {
    const pv = new THREE.Group(); pv.position.set(sx * W * (back ? 0.27 : 0.28), back ? parts.hipY : parts.shY, back ? -L * 0.3 : L * 0.3); body.add(pv);
    pv.add(new THREE.Mesh(parts[back ? 'upperB' : 'upperF'], furMat));
    const knee = new THREE.Group(); knee.position.set(0, -parts[back ? 'upB' : 'upF'], parts.kz[back ? 'B' : 'F']); pv.add(knee);
    knee.add(new THREE.Mesh(parts[back ? 'lowerB' : 'lowerF'], furMat));
    pv.userData.knee = knee; pv.userData.back = back; legs.push(pv);
  }
  const tail = new THREE.Group(); tail.position.set(0, M.bodyY, -L * 0.5); body.add(tail); tail.add(new THREE.Mesh(parts.tail, furMat)); tail.rotation.x = M.tailCurl ? -0.3 : 0.35;
  return { g, body, legs, head, tail, neck, torso, neckRx: 0 };
}

// ---------- canguro, aves, pingüino y tortuga ----------
function rooParts(M) {
  const { L, H, W, legR, headR } = M; M.bodyY = 0.45; M.legH = 0.2; const paint = painter(M); const P = {};
  P.torso = build([E(V(0, 0.42, 0), V(W * 0.5, H * 0.5, L * 0.38)), E(V(0, 0.6, 0.1), V(W * 0.38, H * 0.35, L * 0.28)), E(V(0, 0.28, -0.08), V(W * 0.55, H * 0.32, L * 0.4)), C(V(0, 0.3, -0.18), V(0, 0.04, -0.62), legR * 1.3, legR * 0.45, 'tail'),
    E(V(-W * 0.28, 0.25, -0.05), V(legR * 1.8, legR * 2.6, legR * 2.6)), E(V(W * 0.28, 0.25, -0.05), V(legR * 1.8, legR * 2.6, legR * 2.6)), C(V(-W * 0.2, 0.55, 0.22), V(-W * 0.22, 0.42, 0.32), legR * 0.45, legR * 0.3), C(V(W * 0.2, 0.55, 0.22), V(W * 0.22, 0.42, 0.32), legR * 0.45, legR * 0.3), E(V(0, 0.78, 0.18), V(legR * 1.1, legR * 1.1, legR * 1.1), 'neck')], { k: 0.07, paint });
  P.head = build([E(V(), V(legR * 1.1, legR * 1.1, legR * 1.1), 'neck'), E(V(0, 0.07, 0.04), V(headR * 0.85, headR * 0.85, headR * 1.0), 'head'), C(V(0, 0.05, 0.1), V(0, 0.01, 0.1 + M.snoutL), headR * 0.6, M.snoutR, 'snout'), E(V(0, 0.01, 0.12 + M.snoutL), V(M.snoutR, M.snoutR * 0.8, M.snoutR * 0.6), 'nose')], { k: 0.04, paint, offset: V(0, 0.78, 0.18), res: 30, minCell: 0.007 });
  P.leg = build([E(V(), V(legR * 1.2, legR * 1.2, legR * 1.2), 'leg'), C(V(), V(0, -0.2, -0.04), legR, legR * 0.6, 'leg'), C(V(0, -0.2, -0.04), V(0, -0.22, 0.16), legR * 0.55, legR * 0.4, 'leg')], { k: 0.03, paint, offset: V(0, 0.22, 0), res: 22, minCell: 0.007 });
  return P;
}
function birdParts(M) {
  const { L, H, W, headR } = M; const bodyY = M.legH + H * 0.4; M.bodyY = bodyY; const paint = painter(M); const P = {};
  P.torso = build([E(V(0, bodyY, 0), V(W * 0.5, H * 0.5, L * 0.55)), C(V(0, bodyY + 0.02, -L * 0.3), V(0, bodyY + 0.06, -L * 0.62), H * 0.3, 0.02, 'belly'), E(V(0, bodyY + H * 0.2, L * 0.35), V(0.035, 0.035, 0.035), 'neck')], { k: 0.06, paint });
  // cuello en S
  const pts = [V(0, 0, 0), V(0, 0.12, 0.08), V(0, 0.26, 0.04), V(0, 0.38, -0.02), V(0, 0.48, 0.04)]; const neck = [];
  for (let i = 0; i < pts.length - 1; i++) neck.push(C(pts[i], pts[i + 1], 0.034 - i * 0.003, 0.031 - i * 0.003, 'neck'));
  P.neck = build(neck, { k: 0.03, paint, offset: V(0, bodyY + H * 0.2, L * 0.35), res: 30, minCell: 0.006 }); P.neckTop = pts.at(-1); P.neckBase = V(0, bodyY + H * 0.2, L * 0.35);
  P.head = build([E(V(), V(0.024, 0.024, 0.024), 'neck'), E(V(0, 0.02, 0.02), V(headR * 0.75, headR * 0.7, headR * 0.85), 'head'), C(V(0, 0.015, 0.06), V(0, 0.0, 0.11), headR * 0.36, headR * 0.26, 'beak'), C(V(0, 0.0, 0.11), V(0, -0.04, 0.13), headR * 0.26, headR * 0.12, 'dark')], { k: 0.012, paint, offset: add(P.neckBase, P.neckTop), res: 26, minCell: 0.004 });
  P.upper = build([E(V(), V(0.03, 0.03, 0.03), 'body'), C(V(), V(0, -M.legH * 0.5, -0.02), 0.022, 0.011, 'leg'), E(V(0, -M.legH * 0.5, -0.02), V(0.014, 0.014, 0.014), 'leg')], { k: 0.01, paint, res: 24, minCell: 0.004 });
  P.lower = build([E(V(), V(0.013, 0.013, 0.013), 'leg'), C(V(), V(0, -M.legH * 0.5 + 0.01, 0.0), 0.011, 0.009, 'leg'), E(V(0, -M.legH * 0.5 + 0.008, 0.03), V(0.03, 0.007, 0.045), 'leg')], { k: 0.008, paint, res: 24, minCell: 0.004 });
  return P;
}
function penguinParts(M) {
  const { H, W, headR } = M; M.bodyY = 0.25; M.pattern = 'tuxedo'; const paint = painter(M); const P = {};
  P.torso = build([E(V(0, 0.24, 0), V(W * 0.5, H * 0.5, W * 0.45)), E(V(0, 0.08, 0.02), V(W * 0.45, 0.07, W * 0.42)), C(V(0, 0.06, -0.08), V(0, 0.02, -0.17), 0.04, 0.01), E(V(0, 0.46, 0.01), V(0.06, 0.06, 0.06), 'neck')], { k: 0.06, paint });
  P.head = build([E(V(), V(0.06, 0.06, 0.06), 'neck'), E(V(0, 0.05, 0.01), V(headR, headR * 0.95, headR), 'body'), C(V(0, 0.04, headR * 0.8), V(0, 0.03, headR * 1.5), headR * 0.25, headR * 0.06, 'beak')], { k: 0.04, paint, offset: V(0, 0.46, 0.01), res: 26, minCell: 0.006 });
  return P;
}
function turtleParts(M) {
  const { L, W, headR } = M; M.bodyY = 0.2; M.H = 0.3; const paint = painter(M); const P = {};
  P.torso = build([E(V(0, 0.18, 0), V(W * 0.5, 0.17, L * 0.5), 'shell'), E(V(0, 0.1, 0), V(W * 0.53, 0.05, L * 0.53), 'belly'), E(V(0, 0.2, L * 0.48), V(0.06, 0.06, 0.06), 'body')], { k: 0.03, paint });
  P.head = build([E(V(), V(0.06, 0.06, 0.06), 'body'), C(V(), V(0, 0.04, 0.1), 0.055, 0.05, 'body'), E(V(0, 0.06, 0.14), V(headR * 0.8, headR * 0.7, headR), 'body')], { k: 0.04, paint, offset: V(0, 0.2, L * 0.48), res: 24, minCell: 0.006 });
  P.leg = build([E(V(), V(0.05, 0.05, 0.05), 'body'), C(V(), V(0, -0.1, 0.02), 0.05, 0.045, 'body'), E(V(0, -0.11, 0.03), V(0.06, 0.03, 0.07), 'body')], { k: 0.03, paint, res: 18, minCell: 0.006 });
  return P;
}
function assembleOther(M, P) {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const torso = new THREE.Mesh(P.torso, furMat); body.add(torso);
  const legs = []; let neck, head, tail = new THREE.Group();
  const eyes = (parent, x, y, z, r, rotY = 0.9) => { for (const sd of [-1, 1]) { const e = eye(r, true); e.position.set(sd * x, y, z); e.rotation.y = sd * rotY; parent.add(e); } };
  if (M.arch === 'roo') {
    neck = new THREE.Group(); neck.position.set(0, 0.78, 0.18); body.add(neck); head = new THREE.Group(); neck.add(head); head.add(new THREE.Mesh(P.head, furMat));
    eyes(head, M.headR * 0.55, 0.1, 0.12, M.headR * 0.15);
    for (const sd of [-1, 1]) { const e = earMesh('up', M.earL, M.col.body, '#d8a0a0'); e.position.set(sd * M.headR * 0.4, 0.12, 0); e.rotation.z = -sd * 0.2; head.add(e); }
    for (const sx of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(sx * M.W * 0.3, 0.22, -0.02); body.add(pv); pv.add(new THREE.Mesh(P.leg, furMat)); legs.push(pv); }
  } else if (M.arch === 'bird') {
    neck = new THREE.Group(); neck.position.set(...P.neckBase); body.add(neck); neck.add(new THREE.Mesh(P.neck, furMat));
    head = new THREE.Group(); head.position.set(...P.neckTop); neck.add(head); head.add(new THREE.Mesh(P.head, furMat)); eyes(head, M.headR * 0.55, 0.035, 0.03, 0.009, 1.2);
    for (const sx of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(sx * M.W * 0.22, M.legH, 0); body.add(pv); pv.add(new THREE.Mesh(P.upper, furMat)); const knee = new THREE.Group(); knee.position.set(0, -M.legH * 0.5, -0.02); pv.add(knee); knee.add(new THREE.Mesh(P.lower, furMat)); pv.userData.knee = knee; pv.userData.back = true; legs.push(pv); }
  } else if (M.arch === 'penguin') {
    neck = new THREE.Group(); neck.position.set(0, 0.46, 0.01); body.add(neck); head = new THREE.Group(); neck.add(head); head.add(new THREE.Mesh(P.head, furMat)); eyes(head, M.headR * 0.5, 0.075, M.headR * 0.65, 0.012, 0.6);
    for (const sx of [-1, 1]) { const ch = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), smat(M.col.cheek)); ch.scale.set(0.4, 1, 0.8); ch.position.set(sx * M.headR * 0.9, 0.03, -0.01); head.add(ch);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), smat(M.col.body)); fl.scale.set(0.18, 1, 0.45); fl.position.set(sx * M.W * 0.5, 0.26, 0); fl.rotation.z = sx * 0.25; body.add(fl);
      const pv = new THREE.Group(); pv.position.set(sx * 0.06, 0.04, 0.02); body.add(pv); const ft = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6), smat(M.col.leg)); ft.scale.set(0.7, 0.25, 1); ft.position.set(0, -0.02, 0.03); pv.add(ft); legs.push(pv); }
  } else {
    neck = new THREE.Group(); neck.position.set(0, 0.2, M.L * 0.48); body.add(neck); head = new THREE.Group(); neck.add(head); head.add(new THREE.Mesh(P.head, furMat)); eyes(head, M.headR * 0.6, 0.09, 0.17, 0.014, 1.1);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const pv = new THREE.Group(); pv.position.set(sx * M.W * 0.42, 0.12, sz * M.L * 0.3); body.add(pv); pv.add(new THREE.Mesh(P.leg, furMat)); legs.push(pv); }
  }
  return { g, body, legs, head, tail, neck, torso, neckRx: 0 };
}

export function animalModel(sp) {
  const M = modelOf(sp);
  if (!cache.has(sp)) cache.set(sp, M.arch === 'quad' ? quadParts(M) : M.arch === 'roo' ? rooParts(M) : M.arch === 'bird' ? birdParts(M) : M.arch === 'penguin' ? penguinParts(M) : turtleParts(M));
  const parts = cache.get(sp);
  const m = M.arch === 'quad' ? assembleQuad(M, parts) : assembleOther(M, parts);
  m.g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return m;
}
export function hasModel(sp) { return !!(MODELS[sp] || HYB[sp]); }
