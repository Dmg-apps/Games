// Modelos low-poly de Quaternius (CC0) para todo el santuario: vegetación, objetos, tiendas y pájaros.
// Los árboles y plantas que se repiten mucho se dibujan "instanciados" (todas las copias en una sola llamada).
import { THREE } from '../shared/engine3d.js';
import { peek, instance as modelInstance, preload as preloadModels } from '../shared/assets.js';

export const Q = (n) => `q/${n}.glb`;
export const TREES = ['nature/commontree_1', 'nature/commontree_2', 'nature/commontree_3', 'nature/commontree_4', 'nature/commontree_5'];
export const BIRCH = ['nature/birchtree_1', 'nature/birchtree_2', 'nature/birchtree_3'];
export const PINES = ['nature/pinetree_1', 'nature/pinetree_2', 'nature/pinetree_3'];
export const BUSHES = ['nature/bush_1', 'nature/bush_2', 'nature/bushberries_1', 'nature/bushberries_2'];
export const ROCKS = ['nature/rock_1', 'nature/rock_2', 'nature/rock_3', 'nature/rock_moss_1', 'nature/rock_moss_2'];
export const GRASS = ['nature/grass', 'nature/grass_2', 'nature/grass_short'];
const ALL = [...TREES, ...BIRCH, ...PINES, ...BUSHES, ...ROCKS, ...GRASS, 'nature/flowers', 'nature/plant_1', 'nature/plant_3', 'nature/lilypad', 'nature/treestump', 'nature/woodlog', 'nature/woodlog_moss', 'nature/willow_1',
  'props/marketstand_1', 'props/marketstand_2', 'props/cart', 'props/bench_1', 'props/barrel', 'props/crate', 'props/hay', 'props/well', 'props/trashcan_green', 'props/light_floor1', 'props/bag', 'props/fence'];
export let ready = false;
export const loaded = preloadModels(ALL.map(Q)).then((r) => { ready = r.every(Boolean); return ready; });

// Una copia suelta (con sus materiales), a una altura dada en casillas
export function one(name, height, yaw = 0) { const gl = peek(Q(name)); if (!gl) return null; const it = modelInstance(gl, { height, yaw }); it.g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return it.g; }

// Muchas copias de varios modelos: list = [{ name, x, z, h, ry }]. Devuelve un grupo con una InstancedMesh por pieza.
export function many(list, { shadows = true } = {}) {
  const g = new THREE.Group(); const by = new Map();
  for (const it of list) { if (!peek(Q(it.name))) continue; (by.get(it.name) || by.set(it.name, []).get(it.name)).push(it); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), s = new THREE.Vector3();
  for (const [name, items] of by) {
    const gl = peek(Q(name)); const root = gl.scene; root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root); const h0 = Math.max(1e-3, box.max.y - box.min.y); const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    root.traverse((o) => {
      if (!o.isMesh) return;
      // la pieza, colocada respecto a la base del modelo y a altura 1
      const local = new THREE.Matrix4().makeTranslation(-cx, -box.min.y, -cz).premultiply(new THREE.Matrix4().makeScale(1 / h0, 1 / h0, 1 / h0)); local.multiply(o.matrixWorld);
      const im = new THREE.InstancedMesh(o.geometry, o.material, items.length);
      items.forEach((it, i) => { q.setFromAxisAngle(up, it.ry || 0); m4.compose(v.set(it.x, it.y || 0, it.z), q, s.setScalar(it.h)); m4.multiply(local); im.setMatrixAt(i, m4); });
      im.castShadow = shadows; im.receiveShadow = true; g.add(im);
    });
  }
  return g;
}

// Pájaros: de vez en cuando cruza el cielo una pequeña bandada y se va (no dan vueltas sin parar)
export function birds(scene, cx, cz, span) {
  const g = new THREE.Group(); scene.add(g); let flock = [], next = 8 + Math.random() * 20, last = 0;
  const spawn = (t) => {
    const gl = peek(Q('animals/bird')); if (!gl) return;
    const a = Math.random() * Math.PI * 2, d = span * 0.9; const from = new THREE.Vector3(cx + Math.cos(a) * d, 5 + Math.random() * 2, cz + Math.sin(a) * d);
    const to = new THREE.Vector3(cx - Math.cos(a + (Math.random() - 0.5)) * d, from.y + (Math.random() - 0.5), cz - Math.sin(a + (Math.random() - 0.5)) * d);
    const n = 2 + Math.floor(Math.random() * 4); const dir = to.clone().sub(from).normalize(); const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (let i = 0; i < n; i++) { const it = modelInstance(gl, { length: 0.3, yaw: Math.PI }); it.play(['PlaneAction', 'ArmatureAction', 'Plane.001Action']); g.add(it.g);
      const off = side.clone().multiplyScalar((i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.5).add(dir.clone().multiplyScalar(-Math.ceil(i / 2) * 0.45));
      flock.push({ it, from: from.clone().add(off), to: to.clone().add(off), t0: t, dur: 16 + Math.random() * 6, yaw: Math.atan2(dir.x, dir.z) }); }
  };
  return { update(t) {
    const dt = last ? Math.min(0.1, t - last) : 0; last = t;
    if (!flock.length && (next -= dt) <= 0) { spawn(t); next = 25 + Math.random() * 50; }
    for (const b of flock) { const k = (t - b.t0) / b.dur; b.it.g.position.lerpVectors(b.from, b.to, k); b.it.g.position.y += Math.sin(t * 1.3 + b.from.x) * 0.15; b.it.g.rotation.y = b.yaw; b.it.update(dt * 1.6); b.done = k >= 1; }
    for (const b of flock.filter((q) => q.done)) g.remove(b.it.g); flock = flock.filter((q) => !q.done);
  } };
}
