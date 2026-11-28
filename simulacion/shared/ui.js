// Ayudas de interfaz comunes: avisos, ventanas, hoja inferior y formato.
import { icon } from './icons.js';
import { Sound } from './sound.js';
export { icon, Sound };
export const $ = (s, el = document) => el.querySelector(s);
export const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const eur = (n) => `${Math.round(n).toLocaleString('es-ES')} €`;

let toastBox;
export function toast(msg, kind = 'info', ic = null) {
  if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; document.body.appendChild(toastBox); }
  const el = document.createElement('div'); el.className = `toast glass ${kind}`;
  el.innerHTML = `<span class="tile">${icon(ic || { good: 'check', warn: 'alert', bad: 'alert', info: 'bell' }[kind] || 'bell')}</span><span>${esc(msg)}</span>`;
  Sound.play(ic === 'heart' || ic === 'egg' || ic === 'sparkle' ? 'baby' : ic === 'coin' ? 'coin' : ic === 'trash' ? 'trash' : { good: 'good', warn: 'warn', bad: 'warn' }[kind] || 'tap');
  toastBox.prepend(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  while (toastBox.children.length > 3) toastBox.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, kind === 'bad' ? 6000 : 4000);
}
let modalEl;
// Tocar fuera de una ventana (o la tecla Esc) la cierra con su propio botón de cerrar/cancelar, si lo tiene
const CLOSE_RX = /^(Cerrar|Cancelar|Quedármelo|Vale|Seguir|No)$/;
function softClose() { if (!modalEl || modalEl.hidden) return; const b = [...modalEl.querySelectorAll('.mbody button')].find((x) => CLOSE_RX.test(x.textContent.trim())); if (b) b.click(); }
export function modal(html) {
  if (!modalEl) {
    modalEl = document.createElement('div'); modalEl.className = 'modal'; modalEl.innerHTML = `<div class="modal-box"><button class="mclose" aria-label="Cerrar ventana">${icon('x')}</button><div class="mbody"></div></div>`; document.body.appendChild(modalEl);
    // la ✕ siempre a la vista: usa el botón de cerrar de la ventana si lo tiene; si no, la cierra sin más
    modalEl.querySelector('.mclose').onclick = () => { const b = [...modalEl.querySelectorAll('.mbody button')].find((x) => CLOSE_RX.test(x.textContent.trim())); if (b) b.click(); else closeModal(); };
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) softClose(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') softClose(); });
  }
  modalEl.hidden = false; const box = modalEl.querySelector('.mbody'); box.innerHTML = html; box.scrollTop = 0; return box;
}
export const modalOpen = () => modalEl && !modalEl.hidden;
export function closeModal() { if (modalEl) modalEl.hidden = true; }
export function info(title, html, btn = 'Vale', cb) {
  const box = modal(`<h2>${title}</h2>${html}<div class="actions"><button class="btn coral" id="m_ok">${btn}</button></div>`);
  box.querySelector('#m_ok').onclick = () => { closeModal(); cb && cb(); };
}
export function confirm(text, yes) {
  const box = modal(`<h2>¿Lo confirmas?</h2><p>${esc(text)}</p><div class="actions"><button class="btn alt" id="m_no">Cancelar</button><button class="btn coral" id="m_yes">Sí</button></div>`);
  box.querySelector('#m_no').onclick = closeModal; box.querySelector('#m_yes').onclick = () => { closeModal(); yes(); };
}
// Hoja inferior reutilizable
// Hace un panel más cómodo: asa para arrastrar (abajo cierra, arriba lo agranda)
// y no salta arriba del todo cada vez que se actualiza su contenido.
export function sheetComfort(el, body, close) {
  const grab = document.createElement('div'); grab.className = 'grabber'; grab.innerHTML = '<i></i>'; el.prepend(grab);
  let saved = 0, restoring = false;
  body.addEventListener('scroll', () => { if (!restoring) saved = body.scrollTop; }, { passive: true });
  new MutationObserver(() => { if (!saved) return; restoring = true; body.scrollTop = saved; requestAnimationFrame(() => { body.scrollTop = Math.min(saved, body.scrollHeight); restoring = false; }); }).observe(body, { childList: true });
  let y0 = null, dy = 0;
  const handle = [grab, el.querySelector('.sheet-head')];
  for (const h of handle) {
    if (!h) continue;
    h.addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; el.style.transition = 'none'; try { h.setPointerCapture(e.pointerId); } catch { /* */ } });
    h.addEventListener('pointermove', (e) => { if (y0 == null) return; dy = e.clientY - y0; if (dy > 0) el.style.transform = `translateY(${dy}px)`; });
    const end = () => { if (y0 == null) return; y0 = null; el.style.transition = ''; el.style.transform = ''; if (dy > 70) close(); else if (dy < -30) el.classList.add('tall'); else if (Math.abs(dy) < 6 && h === grab) el.classList.toggle('tall'); };
    h.addEventListener('pointerup', end); h.addEventListener('pointercancel', end);
  }
  return { reset() { saved = 0; body.scrollTop = 0; }, };
}
export class Sheet {
  constructor() {
    this.el = document.createElement('section'); this.el.className = 'sheet closed';
    this.el.innerHTML = `<div class="sheet-head"><h2></h2><button class="close" aria-label="Cerrar">${icon('x')}</button></div><div class="sheet-body"></div>`;
    document.body.appendChild(this.el); this.body = this.el.querySelector('.sheet-body');
    this.el.querySelector('.close').onclick = () => this.close();
    this.name = null; this.onClose = null;
    this.comfort = sheetComfort(this.el, this.body, () => this.close());
  }
  open(name, title) { if (this.name !== name) { this.comfort.reset(); this.el.classList.remove('tall'); } this.name = name; this.el.querySelector('h2').textContent = title; this.el.classList.remove('closed'); }
  close() { if (!this.name) return; this.name = null; this.el.classList.add('closed'); this.onClose?.(); }
  get isOpen() { return !!this.name; }
}
// Guardado local sencillo
export const store = {
  load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* lleno */ } },
};

// Papelera para soltar lo que se está moviendo y quitarlo
let trashEl = null;
export const trash = {
  show(label = 'Suelta aquí para quitar') {
    if (!trashEl) { trashEl = document.createElement('div'); trashEl.className = 'trashzone'; document.body.appendChild(trashEl); }
    trashEl.innerHTML = `${icon('trash')}<span>${label}</span>`; trashEl.hidden = false; trashEl.classList.remove('over');
  },
  hide() { if (trashEl) trashEl.hidden = true; },
  over(x, y) { if (!trashEl || trashEl.hidden) return false; const r = trashEl.getBoundingClientRect(); const o = x > r.left - 12 && x < r.right + 12 && y > r.top - 16 && y < r.bottom + 16; trashEl.classList.toggle('over', o); return o; },
};
// Mientras se arrastra algo, si el dedo está cerca del borde la vista se desplaza sola
export function edgePan(x, y, w = innerWidth, h = innerHeight, m = 56) {
  const k = (d) => (d < m ? (m - d) / m : 0);
  return { dx: (k(x) - k(w - x)) * 9, dy: (k(y) - k(h - y)) * 9 };
}

// ---------- anfitriones: personajes que acompañan cada juego ----------
// Retratos dibujados (originales), con su forma de hablar.
export function avatar({ skin = '#e8b894', hair = '#4a3020', hat = null, hatC = '#c8a050', shirt = '#3a7a5a', glasses = false, bun = false, curls = false, bg = '#dff0e6', beard = false } = {}) {
  return `<svg viewBox="0 0 64 64" class="avatar" aria-hidden="true"><circle cx="32" cy="32" r="32" fill="${bg}"/>
  <path d="M10 64c2-12 11-18 22-18s20 6 22 18z" fill="${shirt}"/><path d="M26 46l6 7 6-7" fill="#fff" opacity=".85"/>
  <rect x="28" y="38" width="8" height="9" rx="3" fill="${skin}"/>
  ${bun ? `<circle cx="32" cy="12" r="7" fill="${hair}"/>` : ''}
  <ellipse cx="32" cy="29" rx="13" ry="14" fill="${skin}"/>
  ${curls ? `<g fill="${hair}"><circle cx="20" cy="24" r="5"/><circle cx="44" cy="24" r="5"/><circle cx="24" cy="17" r="5"/><circle cx="40" cy="17" r="5"/><circle cx="32" cy="15" r="6"/></g>` : `<path d="M19 28c0-10 6-15 13-15s13 5 13 15c-3-5-8-7-13-7s-10 2-13 7z" fill="${hair}"/>`}
  ${beard ? `<path d="M20 31c1 9 6 13 12 13s11-4 12-13c-3 4-7 5-12 5s-9-1-12-5z" fill="${hair}"/>` : ''}
  <circle cx="27" cy="30" r="1.8" fill="#2a2020"/><circle cx="37" cy="30" r="1.8" fill="#2a2020"/>
  <path d="M28 36q4 3 8 0" stroke="#8a4a3a" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <circle cx="24" cy="34" r="2.2" fill="#f08a8a" opacity=".45"/><circle cx="40" cy="34" r="2.2" fill="#f08a8a" opacity=".45"/>
  ${glasses ? `<g fill="none" stroke="#2a2a33" stroke-width="1.4"><circle cx="27" cy="30" r="4"/><circle cx="37" cy="30" r="4"/><path d="M31 30h2"/></g>` : ''}
  ${hat === 'safari' ? `<ellipse cx="32" cy="18" rx="19" ry="4" fill="${hatC}"/><path d="M21 18c0-8 5-11 11-11s11 3 11 11z" fill="${hatC}"/><rect x="21" y="15" width="22" height="3" fill="#7a5a30"/>` : ''}
  ${hat === 'beanie' ? `<path d="M18 22c0-9 6-14 14-14s14 5 14 14z" fill="${hatC}"/><rect x="17" y="19" width="30" height="5" rx="2.5" fill="${hatC}" opacity=".85"/><circle cx="32" cy="7" r="3" fill="${hatC}"/>` : ''}
  ${hat === 'band' ? `<path d="M19 22q13-6 26 0" stroke="${hatC}" stroke-width="3.5" fill="none"/>` : ''}
  </svg>`;
}
export const HOSTS = {
  rufina: { name: 'Rufina', role: 'Cuidadora jefa', look: { skin: '#c98e66', hair: '#9a9aa0', bun: true, hat: 'safari', hatC: '#c8a868', shirt: '#4a7a4a', glasses: true, bg: '#e4f2dc' } },
  marina: { name: 'Marina', role: 'Buceadora jubilada', look: { skin: '#8a5a3a', hair: '#2a1a14', curls: true, hat: 'beanie', hatC: '#d8483a', shirt: '#1f3a6a', bg: '#dceefa' } },
  pili: { name: 'Pili', role: 'Vecina del barrio', look: { skin: '#f0c8a8', hair: '#b84a2a', hat: 'band', hatC: '#f5c842', shirt: '#c45ab0', bg: '#fbe6f0' } },
};
export const hostFace = (id) => avatar(HOSTS[id].look);
// Ventana con el personaje hablando
export function say(id, title, text, btn = 'Vale', cb, extra = '') {
  const H = HOSTS[id];
  const box = modal(`<div class="host"><div class="hostface">${hostFace(id)}</div><div><b>${H.name}</b><div class="hint">${H.role}</div></div></div>
    ${title ? `<h2 style="margin-top:10px">${title}</h2>` : ''}<div class="speech">${text}</div>${extra}<div class="actions"><button class="btn coral" id="m_ok">${btn}</button></div>`);
  box.querySelector('#m_ok').onclick = () => { closeModal(); cb && cb(); };
  return box;
}
const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
export { pickOne };

// iPhone con la app instalada: a veces deja una franja abajo (bajo la barra de inicio) que no cuenta como zona segura.
// La medimos (alto de pantalla - alto de la app) para que la barra y el juego lleguen hasta el borde real.
function measureBand() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
  const portrait = innerHeight > innerWidth;
  const b = standalone && portrait ? Math.max(0, Math.min(60, Math.round(screen.height - innerHeight))) : 0;
  document.documentElement.style.setProperty('--band', b + 'px');
}
measureBand(); addEventListener('resize', measureBand); addEventListener('orientationchange', () => setTimeout(measureBand, 300));
