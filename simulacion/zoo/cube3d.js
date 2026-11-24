// Animales "cubito": diseño original de este juego (sin modelos de terceros).
// Cuerpo de bloque redondeado, cabeza grande con cara pintada y rasgos de cada especie.
// Devuelve las mismas piezas que usa la animación del zoo: { g, body, legs, head, tail, neck, torso, neckRx, legH }.
import { THREE, RoundedBoxGeometry } from '../shared/engine3d.js';
import { SPECIES } from './data.js';

const geoCache = new Map(), matCache = new Map(), texCache = new Map();
const rgeo = (w, h, d, r) => { const k = [w, h, d, r].map((v) => v.toFixed(3)).join(); if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.05, h / 2.05, d / 2.05))); return geoCache.get(k); };
const lam = (c) => { const k = typeof c === 'string' ? c : c.uuid; if (!matCache.has(k)) matCache.set(k, typeof c === 'string' ? new THREE.MeshLambertMaterial({ color: c }) : new THREE.MeshLambertMaterial({ map: c })); return matCache.get(k); };
// Bloque redondeado; r = redondeo relativo al lado más corto
function block(w, h, d, m, r = 0.28) { const mesh = new THREE.Mesh(rgeo(w, h, d, Math.min(w, h, d) * r), typeof m === 'string' ? lam(m) : m); mesh.castShadow = true; return mesh; }
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
const mix = (a, b, k) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), k).getHexString();

function canvasTex(key, size, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); draw(x, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(key, t); return t;
}
// Pelaje: color base con barriga más clara y el dibujo de cada especie
function furTex(sp, kind, c0, c1, c2) {
  return canvasTex(`fur-${sp}`, 128, (x, s) => {
    x.fillStyle = c0; x.fillRect(0, 0, s, s);
    const g = x.createLinearGradient(0, 0, 0, s); g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.10)'); x.fillStyle = g; x.fillRect(0, 0, s, s);
    let seed = sp.length * 31 + sp.charCodeAt(0); const R = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    if (kind === 'stripes' || kind === 'tiger') { x.fillStyle = c2; for (let i = 0; i < 7; i++) { const cx = (i + 0.5) * s / 7; x.beginPath(); x.moveTo(cx - 5, 0); x.quadraticCurveTo(cx + 6, s * 0.4, cx - 3, s * (kind === 'tiger' ? 0.75 : 1)); x.lineTo(cx + 4, s * (kind === 'tiger' ? 0.75 : 1)); x.quadraticCurveTo(cx + 13, s * 0.4, cx + 5, 0); x.fill(); } }
    if (kind === 'spots') { x.fillStyle = c1; for (let i = 0; i < 14; i++) { const px = R() * s, py = R() * s, w = 10 + R() * 12; x.beginPath(); x.roundRect(px - w / 2, py - w / 2, w, w * (0.7 + R() * 0.5), 5); x.fill(); } x.strokeStyle = mix(c0, '#ffffff', 0.35); x.lineWidth = 3; }
    if (kind === 'patches') { x.fillStyle = c1; for (let i = 0; i < 5; i++) { x.beginPath(); x.ellipse(R() * s, R() * s, 14 + R() * 16, 10 + R() * 12, R() * 3, 0, 7); x.fill(); } }
    if (kind === 'wool') { for (let i = 0; i < 80; i++) { x.fillStyle = i % 2 ? mix(c0, '#ffffff', 0.25) : shade(c0, 0.9); x.beginPath(); x.arc(R() * s, R() * s, 4 + R() * 4, 0, 7); x.fill(); } }
    if (kind === 'shell') { x.fillStyle = shade(c0, 0.8); x.fillRect(0, 0, s, s); x.strokeStyle = shade(c0, 0.55); x.lineWidth = 4; for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) { const cx = q * 34 + (r % 2) * 17, cy = r * 30 + 12; x.fillStyle = mix(c1, c0, (q + r) % 2 ? 0.3 : 0); x.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; x.lineTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15); } x.closePath(); x.fill(); x.stroke(); } }
    // pelo suave
    for (let i = 0; i < 160; i++) { x.fillStyle = R() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'; x.fillRect(R() * s, R() * s, 1.5, 4); }
  });
}
// Cara: ojos grandes con brillo, mofletes y boca (cada especie con su detalle)
function faceTex(sp, look) {
  return canvasTex(`face-${sp}`, 128, (x, s) => {
    x.clearRect(0, 0, s, s);
    const ey = look.eyeY ?? 0.42, ex = look.eyeX ?? 0.26, er = look.eyeR ?? 0.13;
    if (look.mask) { x.fillStyle = look.mask; for (const sd of [-1, 1]) { x.beginPath(); x.ellipse(s * (0.5 + sd * ex), s * ey, s * er * 1.7, s * er * 2.1, sd * 0.5, 0, 7); x.fill(); } }
    if (look.faceLight) { x.fillStyle = look.faceLight; x.beginPath(); x.roundRect(s * 0.18, s * 0.3, s * 0.64, s * 0.62, s * 0.2); x.fill(); }
    for (const sd of [-1, 1]) {
      const cx = s * (0.5 + sd * ex), cy = s * ey;
      x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(cx, cy, s * er, s * er * 1.12, 0, 0, 7); x.fill();
      x.fillStyle = '#1b1a22'; x.beginPath(); x.ellipse(cx + sd * s * 0.012, cy + s * 0.012, s * er * 0.72, s * er * 0.86, 0, 0, 7); x.fill();
      x.fillStyle = '#ffffff'; x.beginPath(); x.arc(cx - s * er * 0.25, cy - s * er * 0.35, s * er * 0.3, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + s * er * 0.28, cy + s * er * 0.3, s * er * 0.13, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,120,140,0.45)'; x.beginPath(); x.ellipse(cx + sd * s * 0.06, cy + s * er * 1.75, s * 0.075, s * 0.045, 0, 0, 7); x.fill();
    }
    if (look.mouth !== false) { x.strokeStyle = '#3a2422'; x.lineWidth = s * 0.028; x.lineCap = 'round'; x.beginPath(); x.arc(s * 0.46, s * (look.mouthY ?? 0.74), s * 0.04, 0.2, Math.PI - 0.2); x.stroke(); x.beginPath(); x.arc(s * 0.54, s * (look.mouthY ?? 0.74), s * 0.04, 0.2, Math.PI - 0.2); x.stroke(); }
    if (look.nose) { x.fillStyle = look.nose; x.beginPath(); x.roundRect(s * 0.43, s * ((look.mouthY ?? 0.74) - 0.1), s * 0.14, s * 0.08, s * 0.04); x.fill(); }
  });
}
function facePlane(sp, look, w, h) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: faceTex(sp, look), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); m.renderOrder = 2; return m; }

// Rasgos de cada especie (lo que no sale de data.js)
const LOOK = {
  cabra: { fur: 'plain', ears: 'side', horns: 'goat', beard: true, snout: 0.5, tail: 'stub' },
  alpaca: { fur: 'wool', ears: 'up', snout: 0.45, tail: 'stub', fluffy: true },
  llama: { fur: 'wool', ears: 'up', snout: 0.5, tail: 'stub', fluffy: true },
  huarizo: { fur: 'wool', ears: 'up', snout: 0.45, tail: 'stub', fluffy: true },
  cebra: { fur: 'stripes', ears: 'up', mane: 'strip', snout: 0.6, tail: 'tuft' },
  caballo: { fur: 'plain', ears: 'up', mane: 'strip', snout: 0.6, tail: 'long' },
  burro: { fur: 'plain', ears: 'tall', mane: 'strip', snout: 0.55, tail: 'tuft' },
  mula: { fur: 'plain', ears: 'tall', mane: 'strip', snout: 0.6, tail: 'tuft' },
  cebrallo: { fur: 'plain', legStripes: true, ears: 'up', mane: 'strip', snout: 0.6, tail: 'long' },
  cebrasno: { fur: 'plain', legStripes: true, ears: 'tall', mane: 'strip', snout: 0.55, tail: 'tuft' },
  vaca: { fur: 'patches', ears: 'side', horns: 'cow', snout: 0.6, snoutColor: '#f0b8b0', tail: 'tuft' },
  ciervo: { fur: 'plain', ears: 'side', horns: 'antlers', snout: 0.5, tail: 'stub', whiteTail: true },
  jirafa: { fur: 'spots', ears: 'side', horns: 'ossicones', mane: 'strip', snout: 0.5, tail: 'tuft' },
  leon: { fur: 'plain', ears: 'round', mane: 'lion', snout: 0.4, tail: 'tuft', cat: true },
  ligre: { fur: 'plain', ears: 'round', mane: 'small', snout: 0.4, tail: 'tuft', cat: true, faintStripes: true },
  tigre: { fur: 'tiger', ears: 'round', snout: 0.4, tail: 'long', cat: true, mask: true },
  tigon: { fur: 'tiger', ears: 'round', mane: 'small', snout: 0.4, tail: 'long', cat: true },
  lobo: { fur: 'plain', ears: 'pointy', snout: 0.55, tail: 'bushy', mask: true },
  zorro: { fur: 'plain', ears: 'pointy', snout: 0.55, tail: 'bushy', whiteTip: true, mask: true },
  osopolar: { fur: 'plain', ears: 'round', snout: 0.45, tail: 'stub', bear: true },
  osopardo: { fur: 'plain', ears: 'round', snout: 0.45, tail: 'stub', bear: true },
  pizzly: { fur: 'plain', ears: 'round', snout: 0.45, tail: 'stub', bear: true },
  panda: { fur: 'panda', ears: 'round', snout: 0.35, tail: 'stub', bear: true, pandaMask: true },
  elefante: { fur: 'plain', ears: 'big', trunk: true, tusks: true, tail: 'tuft' },
  mono: { fur: 'plain', ears: 'side', snout: 0.3, tail: 'curl', faceLight: true },
  canguro: { arch: 'roo', fur: 'plain', ears: 'tall', snout: 0.5, tail: 'roo' },
  pinguino: { arch: 'penguin' },
  flamenco: { arch: 'flamingo' },
  tortuga: { arch: 'turtle' },
};

export function cubeModel(sp) {
  const S = SPECIES[sp] || SPECIES.cabra; const L = LOOK[sp] || { fur: 'plain', ears: 'side', snout: 0.5, tail: 'stub' };
  const [c0, c1, c2] = S.colors; const arch = L.arch || 'quad';
  if (arch === 'penguin') return penguin(sp, S);
  if (arch === 'flamingo') return flamingo(sp, S);
  if (arch === 'turtle') return turtle(sp, S);
  const roo = arch === 'roo';
  const [BL, BH, BW] = S.body; const Lb = BL * 1.0, Hb = BH * 0.95, Wb = BW * 1.05;
  const heavy = L.bear || L.trunk || sp === 'vaca';
  const legH = Math.max(0.12, S.legs * (roo ? 0.55 : 0.72)), legW = Math.max(0.08, Math.min(0.26, BW * (heavy ? 0.46 : 0.38)));
  const hs = Math.min(0.56, Math.max(0.18, Math.max(S.head * 2.0, BH * 0.66)));
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const furKind = L.fur === 'panda' ? 'plain' : L.fur; const furC = L.fur === 'panda' ? '#f6f4ee' : c0;
  const fur = lam(furTex(sp, furKind, furC, furKind === 'spots' ? c1 : furKind === 'patches' ? '#ffffff' : c1, c2));
  // tronco
  // tronco (el canguro, casi de pie e inclinado hacia delante)
  const torso = roo ? block(Wb, BL * 1.0, BH * 0.72, fur, 0.28) : block(Wb, Hb, Lb, fur, L.fluffy ? 0.38 : 0.22);
  if (roo) { at(torso, 0, legH + BL * 0.42, 0); torso.rotation.x = 0.32; } else at(torso, 0, legH + Hb / 2, 0);
  body.add(torso);
  // barriga clara
  if (!roo && !['stripes', 'tiger', 'patches', 'spots'].includes(L.fur) && L.fur !== 'panda') { const belly = block(Wb * 1.02, Hb * 0.25, Lb * 0.7, mix(c0, c1, 0.7), 0.4); at(belly, 0, legH + Hb * 0.16, 0); body.add(belly); }
  if (L.fur === 'panda') { const band = block(Wb * 1.04, Hb * 1.04, Lb * 0.34, '#1c1c1c', 0.3); at(band, 0, legH + Hb / 2, Lb * 0.22); body.add(band); }
  // patas
  const legs = []; const legColor = L.fur === 'panda' ? '#1c1c1c' : L.legStripes ? null : shade(c0, 0.92); const hoof = L.cat || L.bear || L.fur === 'panda' || sp === 'lobo' || sp === 'zorro' || sp === 'mono' ? null : c2;
  const legMat = L.legStripes ? lam(furTex(sp + '-leg', 'stripes', c0, c1, c2)) : lam(legColor);
  const nLegs = roo ? 2 : 4;
  for (let i = 0; i < nLegs; i++) {
    const front = roo ? false : i < 2, sd = i % 2 ? 1 : -1; const pv = new THREE.Group();
    const lx = sd * (Wb / 2 - legW * 0.6), lz = roo ? -BH * 0.12 : (front ? 1 : -1) * (Lb / 2 - legW * 0.85);
    pv.position.set(lx, legH, lz); g.add(pv);
    // la pata entra dentro del cuerpo: así nunca queda un hueco entre pata y tronco
    const w = roo ? legW * 1.3 : legW; const into = roo ? 0.08 : Hb * 0.45; const leg = block(w, legH + into, w, legMat, 0.25); at(leg, 0, (into - legH) / 2, 0); pv.add(leg);
    if (roo) { const foot = block(w * 1.1, w * 0.5, w * 3, legColor || c0, 0.3); at(foot, 0, -legH + w * 0.25, w * 0.9); pv.add(foot); }
    else if (hoof) { const h = block(w * 1.06, Math.min(0.06, legH * 0.18), w * 1.06, hoof, 0.25); at(h, 0, -legH + Math.min(0.03, legH * 0.09), 0); pv.add(h); }
    pv.userData.back = !front; legs.push(pv);
  }
  if (roo) for (const sd of [-1, 1]) { const arm = block(legW * 0.6, BH * 0.4, legW * 0.6, shade(c0, 0.92), 0.3); arm.rotation.x = 0.7; at(arm, sd * Wb * 0.34, legH + BL * 0.55, BH * 0.42); body.add(arm); }
  // cuello y cabeza
  const longNeck = S.neck > 0.3; const nlen = Math.max(0.04, S.neck * (longNeck ? 0.9 : 0.6)); const nw = Math.max(0.08, Math.min(hs * 0.62, Wb * 0.6));
  const lean = longNeck ? 0.22 : roo ? -0.1 : 0.6;
  const neck = new THREE.Group(); if (roo) neck.position.set(0, legH + BL * 0.86, BH * 0.3); else neck.position.set(0, legH + Hb * (longNeck ? 0.7 : 0.62), longNeck ? Lb / 2 - nw * 0.5 : Lb / 2 + hs * 0.16); neck.rotation.x = lean; body.add(neck);
  if (longNeck) { const nm = block(nw, nlen, nw * 0.95, fur, 0.3); at(nm, 0, nlen / 2, 0); neck.add(nm); }
  if (L.mane === 'strip') { const mn = block(nw * 0.35, nlen + hs * 0.3, nw * 0.3, c2, 0.3); at(mn, 0, (nlen + hs * 0.3) / 2, -nw * 0.5); neck.add(mn); if (!longNeck) { mn.scale.y = 0.6; } }
  const head = new THREE.Group(); head.position.y = longNeck ? nlen : nlen * 0.4; neck.add(head);
  const hi = new THREE.Group(); hi.rotation.x = -lean; head.add(hi); // la cabeza mira al frente
  const hx = hs, hy = hs * 0.92, hz = hs * 0.88; const headY = hy * 0.35, headZ = hz * 0.25;
  const headMat = L.fur === 'panda' ? lam('#f6f4ee') : lam(furTex(sp + '-h', 'plain', c0, c1, c2));
  const hm = block(hx, hy, hz, headMat, 0.3); at(hm, 0, headY, headZ); hi.add(hm);
  // melena
  if (L.mane === 'lion' || L.mane === 'small') { const k = L.mane === 'lion' ? 1.55 : 1.25; const mn = block(hx * k, hy * k, hz * 0.6, c2, 0.4); at(mn, 0, headY - hy * 0.03, headZ - hz * 0.3); hi.add(mn); }
  // hocico
  const fz = headZ + hz / 2;
  let faceY = 0.42, mouthY = 0.74, noseCol = c2;
  if (L.snout && !L.trunk) {
    const sw = hx * (L.cat || L.bear ? 0.55 : 0.6), sh = hy * L.snout * 0.7, sdp = hz * (L.cat || L.bear ? 0.25 : 0.42);
    const sn = block(sw, sh, sdp, L.snoutColor || mix(c0, c1, L.cat || L.bear ? 0.8 : 0.45), 0.35); at(sn, 0, headY - hy * 0.28, fz + sdp / 2 - 0.01); hi.add(sn);
    const nose = block(sw * (L.cat || L.bear || sp === 'lobo' || sp === 'zorro' ? 0.38 : 0.7), sh * 0.3, 0.02, L.cat ? '#c86a6a' : c2, 0.4); at(nose, 0, headY - hy * 0.28 + sh * 0.22, fz + sdp - 0.003); hi.add(nose);
    faceY = 0.36; mouthY = null;
  }
  const look = { eyeY: faceY, eyeX: L.trunk ? 0.3 : 0.24, eyeR: 0.12, mouth: mouthY != null && !L.trunk, mouthY: mouthY ?? 0.74, mask: L.pandaMask ? '#1c1c1c' : null, faceLight: L.faceLight ? mix(c1, '#ffffff', 0.2) : null };
  const face = facePlane(sp, look, hx * 0.98, hy * 0.98); at(face, 0, headY, fz + 0.004); hi.add(face);
  // orejas
  const earC = L.fur === 'panda' ? '#1c1c1c' : shade(c0, 0.9); const inner = mix(c0, '#f4b8b8', 0.5);
  for (const sd of [-1, 1]) {
    let e;
    if (L.ears === 'up' || L.ears === 'tall') { const t = L.ears === 'tall' ? 1.7 : 1.1; e = block(hx * 0.18, hy * 0.38 * t, hz * 0.1, earC, 0.4); at(e, sd * hx * 0.28, headY + hy / 2 + hy * 0.17 * t, headZ - hz * 0.05); e.rotation.z = -sd * 0.18; }
    else if (L.ears === 'round') { e = block(hx * 0.24, hy * 0.24, hz * 0.14, earC, 0.5); at(e, sd * hx * 0.36, headY + hy * 0.5, headZ - hz * 0.1); }
    else if (L.ears === 'pointy') { e = new THREE.Mesh(new THREE.ConeGeometry(hx * 0.14, hy * 0.36, 4), lam(earC)); at(e, sd * hx * 0.3, headY + hy * 0.62, headZ - hz * 0.05); e.rotation.y = Math.PI / 4; e.castShadow = true; }
    else if (L.ears === 'big') { e = block(hx * 0.12, hy * 0.85, hz * 0.75, shade(c0, 0.95), 0.3); at(e, sd * hx * 0.56, headY + hy * 0.02, headZ - hz * 0.15); e.rotation.y = sd * 0.35; const ie = block(hx * 0.02, hy * 0.62, hz * 0.52, inner, 0.3); at(ie, sd * hx * 0.03, 0, hz * 0.04); e.add(ie); }
    else { e = block(hx * 0.3, hy * 0.14, hz * 0.14, earC, 0.4); at(e, sd * hx * 0.6, headY + hy * 0.22, headZ - hz * 0.1); e.rotation.z = sd * 0.35; }
    hi.add(e);
  }
  // cuernos y adornos
  if (L.horns === 'goat') for (const sd of [-1, 1]) { const h = block(hx * 0.1, hy * 0.42, hz * 0.12, '#8a7a62', 0.4); at(h, sd * hx * 0.18, headY + hy * 0.62, headZ - hz * 0.12); h.rotation.x = -0.6; hi.add(h); }
  if (L.horns === 'cow') for (const sd of [-1, 1]) { const h = block(hx * 0.3, hy * 0.1, hz * 0.1, '#f2ead8', 0.45); at(h, sd * hx * 0.5, headY + hy * 0.48, headZ - hz * 0.1); h.rotation.z = sd * 0.4; hi.add(h); }
  if (L.horns === 'ossicones') for (const sd of [-1, 1]) { const h = block(hx * 0.09, hy * 0.36, hx * 0.09, c1, 0.4); at(h, sd * hx * 0.18, headY + hy * 0.64, headZ - hz * 0.15); hi.add(h); const k = block(hx * 0.14, hx * 0.14, hx * 0.14, c2, 0.5); at(k, 0, hy * 0.2, 0); h.add(k); }
  if (L.horns === 'antlers') for (const sd of [-1, 1]) { const a = new THREE.Group(); a.position.set(sd * hx * 0.22, headY + hy * 0.5, headZ - hz * 0.15); a.rotation.z = -sd * 0.35; hi.add(a); const ac = '#d8c6a0'; const st = block(hx * 0.07, hy * 0.6, hx * 0.07, ac, 0.4); at(st, 0, hy * 0.3, 0); a.add(st); for (let k = 0; k < 3; k++) { const br = block(hx * 0.06, hy * 0.26, hx * 0.06, ac, 0.4); at(br, sd * hx * 0.06, hy * (0.25 + k * 0.17), hx * 0.04); br.rotation.z = -sd * 0.9; br.rotation.x = -0.3; a.add(br); } }
  if (L.beard) { const b = block(hx * 0.16, hy * 0.28, hz * 0.12, mix(c0, '#ffffff', 0.3), 0.4); at(b, 0, headY - hy * 0.62, fz + hz * 0.1); hi.add(b); }
  if (L.trunk) { let p = hi; let y = headY - hy * 0.22, z = fz; const segs = []; for (let k = 0; k < 4; k++) { const tw = hx * (0.3 - k * 0.04); const sg = block(tw, hy * 0.26, tw, shade(c0, 0.97), 0.4); at(sg, 0, y - k * hy * 0.22, z + hz * 0.06 - k * 0.01); sg.rotation.x = -0.15 * k; hi.add(sg); segs.push(sg); } }
  if (L.tusks) for (const sd of [-1, 1]) { const t = block(hx * 0.07, hx * 0.07, hz * 0.4, '#f6f0e2', 0.45); at(t, sd * hx * 0.2, headY - hy * 0.42, fz + hz * 0.08); t.rotation.x = -0.4; hi.add(t); }
  // cola
  const tail = new THREE.Group(); if (roo) tail.position.set(0, legH + 0.12, -BH * 0.32); else tail.position.set(0, legH + Hb * 0.72, -Lb / 2 + 0.02); body.add(tail);
  const tc = shade(c0, 0.9);
  if (L.tail === 'long' || L.tail === 'tuft') { const tl = block(legW * 0.35, BL * 0.42, legW * 0.35, L.tail === 'long' && L.mane === 'strip' ? c2 : tc, 0.4); at(tl, 0, -BL * 0.17, -0.06); tl.rotation.x = -0.35; tail.add(tl); if (L.tail === 'tuft') { const tt = block(legW * 0.6, legW * 0.8, legW * 0.6, c2, 0.45); at(tt, 0, -BL * 0.36, -0.13); tail.add(tt); } }
  else if (L.tail === 'bushy') { const tl = block(legW * 0.9, legW * 0.9, BL * 0.5, tc, 0.45); at(tl, 0, -0.04, -BL * 0.22); tl.rotation.x = 0.45; tail.add(tl); if (L.whiteTip) { const tp = block(legW * 0.92, legW * 0.92, BL * 0.14, '#f4f0e6', 0.45); at(tp, 0, 0, -BL * 0.21); tl.add(tp); } }
  else if (L.tail === 'curl') { const tl = new THREE.Mesh(new THREE.TorusGeometry(BL * 0.22, legW * 0.18, 6, 14, Math.PI * 1.5), lam(tc)); at(tl, 0, BL * 0.15, -BL * 0.15); tl.rotation.y = Math.PI / 2; tail.add(tl); }
  else if (L.tail === 'roo') { const tl = block(legW * 0.9, legW * 0.8, BL * 0.9, tc, 0.4); at(tl, 0, -0.03, -BL * 0.4); tl.rotation.x = 0.18; tail.add(tl); }
  else { const tl = block(legW * 0.5, legW * 0.5, legW * 0.5, L.whiteTail ? '#f4f0e6' : tc, 0.45); at(tl, 0, 0, -0.02); tail.add(tl); }
  return { g, body, legs, head, tail, neck, torso, neckRx: lean, legH, headDown: longNeck ? 0.55 : 0.9 };
}

// ---------- formas especiales ----------
function penguin(sp, S) {
  const [c0, c1, c2] = S.colors; const H = S.body[1] * 1.15, W = S.body[2] * 1.2, D = S.body[0] * 0.9; const legH = 0.06;
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const belly = canvasTex(`peng-${sp}`, 64, (x, s) => { x.fillStyle = c0; x.fillRect(0, 0, s, s); x.fillStyle = c1; x.beginPath(); x.ellipse(s / 2, s * 0.62, s * 0.36, s * 0.45, 0, 0, 7); x.fill(); });
  const torso = block(W, H, D, lam(c0), 0.38); at(torso, 0, legH + H / 2, 0); body.add(torso);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W * 0.92, H * 0.95), new THREE.MeshLambertMaterial({ map: belly })); at(front, 0, legH + H / 2, D / 2 + 0.003); body.add(front);
  const neck = new THREE.Group(); neck.position.set(0, legH + H, 0); body.add(neck);
  const head = new THREE.Group(); neck.add(head);
  const hs = W * 0.95; const hm = block(hs, hs * 0.85, hs * 0.85, lam(c0), 0.35); at(hm, 0, hs * 0.38, 0); head.add(hm);
  const face = facePlane(sp, { eyeY: 0.45, eyeX: 0.24, eyeR: 0.13, mouth: false, mask: null, faceLight: c1 }, hs * 0.9, hs * 0.8); at(face, 0, hs * 0.38, hs * 0.43 + 0.003); head.add(face);
  const beak = block(hs * 0.3, hs * 0.14, hs * 0.26, c2, 0.4); at(beak, 0, hs * 0.26, hs * 0.5); head.add(beak);
  const legs = []; for (const sd of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(sd * W * 0.22, legH, 0.02); g.add(pv); const f = block(W * 0.26, legH, D * 0.6, c2, 0.3); at(f, 0, -legH / 2, D * 0.12); pv.add(f); legs.push(pv); }
  const tail = new THREE.Group(); tail.position.set(0, legH + H * 0.12, -D / 2); body.add(tail); tail.add(at(block(W * 0.3, 0.04, 0.08, c0, 0.3), 0, 0, -0.03));
  for (const sd of [-1, 1]) { const fl = block(0.04, H * 0.55, D * 0.5, c0, 0.4); at(fl, sd * (W / 2 + 0.01), legH + H * 0.55, 0); fl.rotation.z = sd * 0.25; body.add(fl); }
  return { g, body, legs, head, tail, neck, torso, neckRx: 0, legH };
}
function flamingo(sp, S) {
  const [c0, c1, c2] = S.colors; const L = S.body[0], H = S.body[1], W = S.body[2]; const legH = S.legs * 0.9;
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const torso = block(W * 1.05, H, L, lam(c0), 0.4); at(torso, 0, legH + H / 2, 0); body.add(torso);
  const wing = block(W * 1.12, H * 0.6, L * 0.75, mix(c0, '#ffffff', 0.25), 0.4); at(wing, 0, legH + H * 0.62, -L * 0.08); body.add(wing);
  const legs = []; for (const sd of [-1, 1]) { const pv = new THREE.Group(); pv.position.set(sd * W * 0.2, legH, 0); g.add(pv); const lg = block(0.03, legH, 0.03, '#e87a98', 0.3); at(lg, 0, -legH / 2, 0); pv.add(lg); const f = block(0.07, 0.02, 0.09, '#e87a98', 0.3); at(f, 0, -legH + 0.01, 0.03); pv.add(f); pv.userData.back = sd > 0; legs.push(pv); }
  const neck = new THREE.Group(); neck.position.set(0, legH + H * 0.75, L * 0.45); neck.rotation.x = 0.15; body.add(neck);
  const nl = S.neck * 0.9; const nm = block(0.05, nl, 0.05, lam(c0), 0.4); at(nm, 0, nl / 2, 0); neck.add(nm);
  const head = new THREE.Group(); head.position.y = nl; neck.add(head); const hi = new THREE.Group(); hi.rotation.x = -0.15; head.add(hi);
  const hs = 0.16; const hm = block(hs, hs * 0.9, hs * 0.9, lam(c0), 0.35); at(hm, 0, hs * 0.3, hs * 0.1); hi.add(hm);
  const face = facePlane(sp, { eyeY: 0.4, eyeX: 0.25, eyeR: 0.13, mouth: false }, hs * 0.9, hs * 0.8); at(face, 0, hs * 0.3, hs * 0.55 + 0.003); hi.add(face);
  const beak = block(hs * 0.32, hs * 0.22, hs * 0.5, c1, 0.35); at(beak, 0, hs * 0.08, hs * 0.75); beak.rotation.x = 0.5; hi.add(beak); const tip = block(hs * 0.33, hs * 0.16, hs * 0.2, c2, 0.35); at(tip, 0, -hs * 0.06, hs * 0.22); beak.add(tip);
  const tail = new THREE.Group(); tail.position.set(0, legH + H * 0.6, -L / 2); body.add(tail); tail.add(at(block(W * 0.6, 0.05, 0.1, mix(c0, '#ffffff', 0.25), 0.4), 0, 0.02, -0.04));
  return { g, body, legs, head, tail, neck, torso, neckRx: 0.15, legH };
}
function turtle(sp, S) {
  const [c0, c1, c2] = S.colors; const L = S.body[0], H = S.body[1], W = S.body[2]; const legH = 0.1;
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const skin = mix(c1, '#c8b880', 0.3);
  const torso = block(W * 0.85, H * 0.4, L * 0.8, lam(skin), 0.35); at(torso, 0, legH + H * 0.2, 0); body.add(torso);
  const shell = block(W, H * 0.75, L, lam(furTex(sp, 'shell', c0, c1, c2)), 0.45); at(shell, 0, legH + H * 0.55, 0); body.add(shell);
  const rim = block(W * 1.05, H * 0.12, L * 1.04, shade(c0, 0.7), 0.4); at(rim, 0, legH + H * 0.22, 0); body.add(rim);
  const legs = []; for (let i = 0; i < 4; i++) { const sd = i % 2 ? 1 : -1, fr = i < 2; const pv = new THREE.Group(); pv.position.set(sd * W * 0.4, legH + 0.04, (fr ? 1 : -1) * L * 0.32); g.add(pv); const lg = block(0.12, legH + 0.04, 0.12, skin, 0.35); at(lg, 0, -(legH + 0.04) / 2, 0); pv.add(lg); pv.userData.back = !fr; legs.push(pv); }
  const neck = new THREE.Group(); neck.position.set(0, legH + H * 0.28, L / 2 - 0.02); neck.rotation.x = 1.2; body.add(neck);
  const nm = block(0.11, 0.14, 0.11, skin, 0.35); at(nm, 0, 0.07, 0); neck.add(nm);
  const head = new THREE.Group(); head.position.y = 0.14; neck.add(head); const hi = new THREE.Group(); hi.rotation.x = -1.2; head.add(hi);
  const hs = 0.2; const hm = block(hs, hs * 0.85, hs, lam(skin), 0.35); at(hm, 0, hs * 0.2, hs * 0.2); hi.add(hm);
  const face = facePlane(sp, { eyeY: 0.42, eyeX: 0.25, eyeR: 0.12, mouth: true, mouthY: 0.72 }, hs * 0.92, hs * 0.8); at(face, 0, hs * 0.2, hs * 0.7 + 0.003); hi.add(face);
  const tail = new THREE.Group(); tail.position.set(0, legH + H * 0.2, -L / 2); body.add(tail); tail.add(at(block(0.06, 0.06, 0.1, skin, 0.4), 0, 0, -0.04));
  return { g, body, legs, head, tail, neck, torso, neckRx: 1.2, legH };
}
