// Motor 3D ligero y compartido por los juegos de Simulación.
// Pensado para no calentar el móvil: materiales Lambert, sin sombras en tiempo real (sombras suaves fijas),
// resolución contenida y pocas imágenes por segundo cuando no pasa nada.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
export { THREE, RoundedBoxGeometry };

const quality = () => localStorage.getItem('sim_quality') || (Math.min(screen.width, screen.height) < 700 ? 'eco' : 'alta');

// ---------- materiales baratos con caché ----------
const cache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const m = new THREE.MeshLambertMaterial({ color: new THREE.Color(color), transparent: opts.opacity != null, opacity: opts.opacity ?? 1, emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0), side: opts.side ?? THREE.FrontSide });
  if (opts.opacity != null) m.depthWrite = false;
  cache.set(key, m); return m;
}
let blobTex = null;
export function blob(w = 0.6, d = 0.6, opacity = 0.45) {
  if (!blobTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, 'rgba(30,20,10,0.6)'); g.addColorStop(1, 'rgba(30,20,10,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); blobTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.01; return m;
}
export function canvasTexture(size, draw, repeat = [1, 1]) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); return t;
}
export const box = (w, h, d, color, r = 0) => new THREE.Mesh(r > 0 ? new RoundedBoxGeometry(w, h, d, 2, r) : new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color) : color);

// ---------- motor ----------
export class Engine {
  constructor(canvas, opts = {}) {
    this.c = canvas; this.hq = quality() === 'alta';
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: this.hq ? 'high-performance' : 'low-power' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.hq ? 1.75 : 1.3));
    this.gl.outputColorSpace = THREE.SRGBColorSpace; this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(opts.fov || 34, 1, 0.1, 300);
    this.cam = { target: new THREE.Vector3(...(opts.target || [0, 0, 0])), yaw: opts.yaw ?? Math.PI / 4, pitch: opts.pitch ?? 0.85, dist: opts.dist ?? 20, min: opts.minDist ?? 4, max: opts.maxDist ?? 60, tx: null, bounds: opts.bounds || 40 };
    this.hemi = new THREE.HemisphereLight(0xeaf4ff, 0x8a7a60, 1.1); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dd, 1.6); this.sun.position.set(10, 20, 8); this.scene.add(this.sun);
    this.ray = new THREE.Raycaster(); this.lastInput = performance.now(); this.lastRender = 0; this.activity = 'idle';
    this.onTap = null; this.onDragStart = null; this.onDragMove = null; this.onDragEnd = null; this.onFrame = null;
    this.resize(); window.addEventListener('resize', () => this.resize());
    this.input();
    this.loop = this.loop.bind(this); requestAnimationFrame(this.loop);
  }
  resize() {
    this.w = this.c.clientWidth || innerWidth; this.h = this.c.clientHeight || innerHeight;
    this.gl.setSize(this.w, this.h, false); this.camera.aspect = this.w / this.h; this.camera.updateProjectionMatrix();
    this.dirty = true;
  }
  // Distancia para que quepan "width" metros a lo ancho según la forma de la pantalla
  fitDist(width) { const t = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)); return width / (2 * t * Math.min(this.w / this.h, 1.5)); }
  // ---------- cámara ----------
  focus(x, z, dist = null, instant = false) { const t = new THREE.Vector3(x, 0, z); if (instant) { this.cam.target.copy(t); this.cam.tx = null; } else this.cam.tx = t; if (dist) this.cam.distT = dist; this.dirty = true; }
  pan(dx, dy) {
    this.cam.tx = null; const k = this.cam.dist * 0.0021, y = this.cam.yaw;
    this.cam.target.x += (-Math.cos(y) * dx - Math.sin(y) * dy * 1.4) * k;
    this.cam.target.z += (Math.sin(y) * dx - Math.cos(y) * dy * 1.4) * k;
    const b = this.cam.bounds; this.cam.target.x = Math.max(-b, Math.min(b, this.cam.target.x)); this.cam.target.z = Math.max(-b, Math.min(b, this.cam.target.z));
    this.dirty = true;
  }
  zoom(f) { this.cam.distT = null; this.cam.dist = Math.max(this.cam.min, Math.min(this.cam.max, this.cam.dist / f)); this.dirty = true; }
  rotate(a) { this.cam.yaw += a; this.dirty = true; }
  spin(a) { this.cam.yawT = (this.cam.yawT ?? this.cam.yaw) + a; }
  updateCamera() {
    const c = this.cam; let moving = false;
    if (c.yawT != null) { c.yaw += (c.yawT - c.yaw) * 0.15; if (Math.abs(c.yawT - c.yaw) < 0.002) { c.yaw = c.yawT; c.yawT = null; } moving = true; }
    if (c.tx) { c.target.lerp(c.tx, 0.15); if (c.target.distanceTo(c.tx) < 0.01) c.tx = null; moving = true; }
    if (c.distT) { c.dist += (c.distT - c.dist) * 0.15; if (Math.abs(c.distT - c.dist) < 0.05) c.distT = null; moving = true; }
    this.camera.position.set(c.target.x + Math.sin(c.yaw) * Math.cos(c.pitch) * c.dist, c.target.y + Math.sin(c.pitch) * c.dist, c.target.z + Math.cos(c.yaw) * Math.cos(c.pitch) * c.dist);
    this.camera.lookAt(c.target);
    return moving;
  }
  // ---------- selección ----------
  setRay(sx, sy) { this.ray.setFromCamera(new THREE.Vector2((sx / this.w) * 2 - 1, -(sy / this.h) * 2 + 1), this.camera); }
  ground(sx, sy, y = 0) { this.setRay(sx, sy); const p = new THREE.Vector3(); return this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), p) ? p : null; }
  pick(sx, sy, objects, key) {
    this.setRay(sx, sy);
    for (const h of this.ray.intersectObjects(objects, true)) { let o = h.object; while (o && o.userData[key] == null) o = o.parent; if (o) return o.userData[key]; }
    return null;
  }
  project(v) { const p = v.clone().project(this.camera); return { x: (p.x + 1) / 2 * this.w, y: (-p.y + 1) / 2 * this.h, z: p.z }; }
  // ---------- gestos: un dedo arrastra (o dibuja), dos dedos acercan/giran/desplazan ----------
  input() {
    const c = this.c, ptrs = new Map(); let moved = false, start = null, drag = false, pd = 0, pa = null, mid = null;
    c.addEventListener('pointerdown', (e) => {
      this.lastInput = performance.now(); c.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) { moved = false; start = { x: e.clientX, y: e.clientY }; drag = !!(this.onDragStart && this.onDragStart(e.clientX, e.clientY)); }
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pd = Math.hypot(a.x - b.x, a.y - b.y); pa = Math.atan2(b.y - a.y, b.x - a.x); mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; moved = true; if (drag) { drag = false; this.onDragEnd?.(true); } }
    });
    c.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId); if (!p) return; this.lastInput = performance.now();
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) {
        if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 9) moved = true;
        if (moved) { if (drag) this.onDragMove?.(e.clientX, e.clientY); else this.pan(dx, dy); }
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); const ang = Math.atan2(b.y - a.y, b.x - a.x); const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (pd) this.zoom(d / pd); pd = d;
        if (pa != null) { let da = ang - pa; da = Math.atan2(Math.sin(da), Math.cos(da)); this.rotate(-da); } pa = ang;
        if (mid) this.pan(m.x - mid.x, m.y - mid.y); mid = m;
      }
    });
    const up = (e) => {
      if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
      if (ptrs.size === 0) { if (drag) { drag = false; this.onDragEnd?.(false); } else if (!moved && e.type === 'pointerup') this.onTap?.(e.clientX, e.clientY); }
      if (ptrs.size < 2) { pd = 0; pa = null; mid = null; }
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.lastInput = performance.now(); this.zoom(e.deltaY < 0 ? 1.1 : 0.9); }, { passive: false });
  }
  // ---------- bucle: solo dibuja lo necesario ----------
  loop(t) {
    const dt = Math.min(0.25, (t - (this.lastT || t)) / 1000); this.lastT = t;
    this.onFrame?.(dt, t);
    const camMoving = this.cam.tx || this.cam.yawT != null || this.cam.distT || t - this.lastInput < 1200;
    const fps = camMoving ? (this.hq ? 60 : 30) : this.activity === 'busy' ? 20 : this.activity === 'calm' ? 10 : 4;
    if (this.dirty || t - this.lastRender >= 1000 / fps - 2) {
      this.lastRender = t; this.dirty = false;
      this.updateCamera(); this.onBeforeRender?.(t / 1000);
      this.gl.render(this.scene, this.camera);
      this.onAfterRender?.(t / 1000);
    }
    requestAnimationFrame(this.loop);
  }
}
