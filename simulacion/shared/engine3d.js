// Motor 3D ligero y compartido por los juegos de Simulación.
// Pensado para no calentar el móvil: materiales Lambert, sin sombras en tiempo real (sombras suaves fijas),
// resolución contenida y pocas imágenes por segundo cuando no pasa nada.
import * as THREE from './vendor/three.module.min.js';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';
import { Gestures } from './gestures.js';
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
  // Acerca hacia el punto de la pantalla (si se da) para que lo que tocas se quede bajo los dedos
  zoom(f, sx, sy) {
    this.cam.distT = null; const old = this.cam.dist;
    this.cam.dist = Math.max(this.cam.min, Math.min(this.cam.max, this.cam.dist / f));
    if (sx != null && !this.cam.follow) { const p = this.ground(sx, sy, this.cam.target.y); if (p) { const k = 1 - this.cam.dist / old; this.cam.target.x += (p.x - this.cam.target.x) * k; this.cam.target.z += (p.z - this.cam.target.z) * k; } }
    this.dirty = true;
  }
  tilt(d) { this.cam.pitch = Math.max(this.cam.minPitch ?? 0.15, Math.min(this.cam.maxPitch ?? 1.35, this.cam.pitch + d)); this.dirty = true; }
  // La cámara sigue a algo que se mueve (una función que devuelve su posición)
  follow(fn) { this.cam.follow = fn; this.cam.tx = null; this.dirty = true; }
  rotate(a) { this.cam.yaw += a; this.dirty = true; }
  spin(a) { this.cam.yawT = (this.cam.yawT ?? this.cam.yaw) + a; }
  updateCamera() {
    const c = this.cam; let moving = false;
    if (c.yawT != null) { c.yaw += (c.yawT - c.yaw) * 0.15; if (Math.abs(c.yawT - c.yaw) < 0.002) { c.yaw = c.yawT; c.yawT = null; } moving = true; }
    if (c.tx) { c.target.lerp(c.tx, 0.15); if (c.target.distanceTo(c.tx) < 0.01) c.tx = null; moving = true; }
    if (c.distT) { c.dist += (c.distT - c.dist) * 0.15; if (Math.abs(c.distT - c.dist) < 0.05) c.distT = null; moving = true; }
    if (c.pitchT != null) { c.pitch += (c.pitchT - c.pitch) * 0.15; if (Math.abs(c.pitchT - c.pitch) < 0.003) c.pitchT = null; moving = true; }
    if (c.follow) { const p = c.follow(); if (p) { c.target.x += (p.x - c.target.x) * 0.12; c.target.z += (p.z - c.target.z) * 0.12; if (p.y != null) c.target.y += (p.y - c.target.y) * 0.12; moving = true; } else c.follow = null; }
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
  // ---------- gestos (ver gestures.js) ----------
  input() {
    const self = this;
    this.gestures = new Gestures(this.c, {
      onInput() { self.lastInput = performance.now(); },
      pan(dx, dy) { if (self.cam.follow) self.cam.follow = null; self.pan(dx, dy); },
      zoom(f, x, y) { self.zoom(f, x, y); },
      rotate(a) { self.rotate(a); },
      tilt(d) { self.tilt(d); },
      onTap(x, y) { self.onTap?.(x, y); },
      onDoubleTap(x, y) { if (self.onDoubleTap) return self.onDoubleTap(x, y); const p = self.ground(x, y); if (p) { self.cam.tx = new THREE.Vector3(p.x, self.cam.target.y, p.z); self.cam.distT = Math.max(self.cam.min, self.cam.dist * 0.5); } },
      onDragStart(x, y) { return !!self.onDragStart?.(x, y); },
      onLongPress(x, y) { return !!self.onLongPress?.(x, y); },
      onDragMove(x, y) { self.onDragMove?.(x, y); },
      onDragEnd(c) { self.onDragEnd?.(c); },
    });
  }
  // ---------- bucle: solo dibuja lo necesario ----------
  loop(t) {
    const dt = Math.min(0.25, (t - (this.lastT || t)) / 1000); this.lastT = t;
    this.onFrame?.(dt, t);
    const camMoving = this.cam.tx || this.cam.yawT != null || this.cam.distT || this.cam.pitchT != null || t - this.lastInput < 1200;
    const following = !!this.cam.follow;
    const fps = camMoving ? (this.hq ? 60 : 30) : following || this.activity === 'close' ? 24 : this.activity === 'busy' ? 20 : this.activity === 'calm' ? 10 : 4;
    if (this.dirty || t - this.lastRender >= 1000 / fps - 2) {
      this.lastRender = t; this.dirty = false;
      this.updateCamera(); this.onBeforeRender?.(t / 1000);
      this.gl.render(this.scene, this.camera);
      this.onAfterRender?.(t / 1000);
    }
    requestAnimationFrame(this.loop);
  }
}
