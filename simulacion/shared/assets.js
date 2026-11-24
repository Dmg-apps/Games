// Modelos 3D de libre uso (CC0, ver models/CREDITOS.txt): carga, copias y animaciones.
// Cada modelo se descarga una vez; cada animal o persona del juego es una copia ligera.
import { THREE } from './engine3d.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/meshopt_decoder.module.js';
import * as SkeletonUtils from './vendor/SkeletonUtils.js';

const BASE = new URL('./models/', import.meta.url).href;
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const cache = new Map(), ready = new Map();

// Colores naturales para los modelos de naturaleza (vienen en tonos pastel turquesa)
const RECOLOR = { leafsGreen: '#5c9e3c', leafsDark: '#3f7d3e', grass: '#6aa847', woodBark: '#7a5232', woodBarkDark: '#5e3e28', woodInner: '#d9b98a', wood: '#a8784a', woodDark: '#7a5432', dirt: '#8a6a48' };
const ROCK = { dirt: '#9a958c', grass: '#6aa847' };
// Los modelos "sin luz" se pasan a un material sencillo con luz y sombra (más bonito y barato)
function prep(scene, path = '') {
  const pal = path.includes('rock') ? { ...RECOLOR, ...ROCK } : RECOLOR;
  scene.traverse((o) => {
    if (!o.isMesh) return;
    const conv = (m) => {
      if (!m) return m;
      const n = new THREE.MeshLambertMaterial({ color: pal[m.name] ? new THREE.Color(pal[m.name]) : m.color ? m.color.clone() : 0xffffff, map: m.map || null, transparent: m.transparent, opacity: m.opacity, side: m.side, vertexColors: m.vertexColors, alphaTest: m.alphaTest });
      if (n.map) n.map.colorSpace = THREE.SRGBColorSpace;
      n.name = m.name; return n;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    o.castShadow = true; o.receiveShadow = false; o.frustumCulled = !o.isSkinnedMesh;
  });
}
export function loadModel(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(BASE + path).then((g) => { prep(g.scene, path); ready.set(path, g); return g; }).catch((e) => { console.warn('No se pudo cargar', path, e); ready.set(path, null); return null; }));
  return cache.get(path);
}
// El modelo ya cargado (o undefined si aún no está)
export const peek = (path) => ready.get(path);
export const preload = (paths) => Promise.all(paths.map(loadModel));

// Copia lista para usar. size: { height } o { length } en metros. Devuelve { g, mixer, play(name), update(dt) }
export function instance(gltf, { height = null, length = null, yaw = 0 } = {}) {
  const inner = SkeletonUtils.clone(gltf.scene); const g = new THREE.Group(); const pivot = new THREE.Group(); pivot.rotation.y = yaw; pivot.add(inner); g.add(pivot);
  inner.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(inner); const size = box.getSize(new THREE.Vector3());
  const k = height ? height / Math.max(1e-3, size.y) : length ? length / Math.max(1e-3, Math.max(size.x, size.z)) : 1;
  inner.scale.multiplyScalar(k);
  const c = box.getCenter(new THREE.Vector3()); inner.position.set(-c.x * k, -box.min.y * k, -c.z * k);
  const mixer = gltf.animations.length ? new THREE.AnimationMixer(inner) : null;
  let cur = null, curName = '';
  const find = (want) => { const rx = want instanceof RegExp ? want : new RegExp(want, 'i'); return gltf.animations.find((a) => rx.test(a.name.replace(/^.*\|/, ''))); };
  return {
    g, mixer, size: size.multiplyScalar(k),
    has: (want) => !!find(want),
    // Cambia de animación con una transición suave
    play(want, { speed = 1, fade = 0.25 } = {}) {
      if (!mixer) return; const key = String(want);
      if (key === curName) { if (cur) cur.timeScale = speed; return; }
      const clip = Array.isArray(want) ? want.map(find).find(Boolean) : find(want); if (!clip) return;
      const a = mixer.clipAction(clip); a.reset(); a.timeScale = speed; a.enabled = true; a.setEffectiveWeight(1); a.play();
      if (cur && cur !== a) cur.crossFadeTo(a, fade, false);
      cur = a; curName = key;
    },
    update(dt) { if (mixer) mixer.update(dt); },
  };
}

// Copia de un modelo sin animación (árboles, rocas…) o null si aún no se ha cargado
export function staticModel(path, opts) { const gl = peek(path); return gl ? instance(gl, opts).g : null; }
