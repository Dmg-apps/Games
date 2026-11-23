// Menú de juegos de Simulación
import { icon } from './shared/icons.js';
import { renderCloud } from './shared/cloudui.js';
const load = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const eur = (n) => `${Math.round(n).toLocaleString('es-ES')} €`;
const chip = (t) => `<span class="chip">${t}</span>`;

const GAMES = [
  { id: 'vidas', href: 'vidas/', title: 'Vidas', ic: 'home', grad: 'linear-gradient(135deg,#ff8a6b,#ff5c8a)', desc: 'Crea una familia, cuida de ella y vive su día a día. Amor, hijos, trabajo, mascotas y un barrio con vida propia.',
    progress: () => { const s = load('vidas_save_v1'); if (!s) return null; const n = Object.values(s.sims || {}).filter((q) => q.home).length; return [`Familia ${s.surname}`, `${n} ${n === 1 ? 'miembro' : 'miembros'}`, `Día ${Math.floor(s.time / 1440) + 1}`]; } },
  { id: 'zoo', href: 'zoo/', title: 'Parque Salvaje', ic: 'paw', grad: 'linear-gradient(135deg,#6fcf6a,#2e9e8f)', desc: 'Diseña tu parque de animales: recintos por hábitat, crías, visitantes, tiendas y fama para desbloquear especies.',
    progress: () => { const s = load('parque_save_v1'); if (!s) return null; return [`${(s.animals || []).length} animales`, `${Math.round((s.fame || 0) * 2) / 2}★ de fama`, eur(s.money)]; } },
  { id: 'acuario', href: 'acuario/', title: 'Arrecife', ic: 'fish', grad: 'linear-gradient(135deg,#4ab0f0,#6a6af0)', desc: 'Tu tienda de peces: cuida los acuarios, cruza peces para descubrir variedades raras y atiende encargos.',
    progress: () => { const s = load('arrecife_save_v1'); if (!s) return null; return [`${(s.fish || []).length} peces`, `${(s.discovered || []).length}/96 variedades`, eur(s.money)]; } },
];
const deco = () => `<span class="deco" style="width:140px;height:140px;left:-30px;top:-40px"></span><span class="deco" style="width:90px;height:90px;right:30px;bottom:-30px"></span>`;
document.getElementById('games').innerHTML = GAMES.map((g) => {
  const p = g.progress();
  return `<a class="game" href="${g.href}"><div class="art" style="background:${g.grad}">${deco()}<span class="big">${icon(g.ic)}</span></div><span class="play">${icon('play')}</span>
    <div class="body"><h2>${g.title}</h2><p>${g.desc}</p><div class="prog">${p ? p.map(chip).join('') : chip('Nueva partida')}</div></div></a>`;
}).join('') + `<div class="game soon"><div class="art"><span class="big">${icon('plus')}</span></div><div class="body"><h2>Próximamente</h2><p>Más mundos en camino: granja, ciudad, restaurante…</p></div></div>`;

// Cuenta en la nube común: al entrar aquí, cada juego sincroniza su partida al abrirlo
document.getElementById('cloudttl').innerHTML = `${icon('cloud')} Copia en la nube`;
renderCloud(document.getElementById('cloud'));

// Un solo service worker para toda la app (funciona sin conexión y se actualiza solo)
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller; let done = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (had && !done) { done = true; location.reload(); } });
  navigator.serviceWorker.register('sw.js').then((r) => r.update().catch(() => {})).catch(() => {});
}
