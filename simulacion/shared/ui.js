// Ayudas de interfaz comunes: avisos, ventanas, hoja inferior y formato.
import { icon } from './icons.js';
export { icon };
export const $ = (s, el = document) => el.querySelector(s);
export const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const eur = (n) => `${Math.round(n).toLocaleString('es-ES')} €`;

let toastBox;
export function toast(msg, kind = 'info', ic = null) {
  if (!toastBox) { toastBox = document.createElement('div'); toastBox.className = 'toasts'; document.body.appendChild(toastBox); }
  const el = document.createElement('div'); el.className = `toast glass ${kind}`;
  el.innerHTML = `<span class="tile">${icon(ic || { good: 'check', warn: 'alert', bad: 'alert', info: 'bell' }[kind] || 'bell')}</span><span>${esc(msg)}</span>`;
  toastBox.prepend(el); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  while (toastBox.children.length > 3) toastBox.lastChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 220); }, kind === 'bad' ? 6000 : 4000);
}
let modalEl;
export function modal(html) {
  if (!modalEl) { modalEl = document.createElement('div'); modalEl.className = 'modal'; modalEl.innerHTML = '<div class="modal-box"></div>'; document.body.appendChild(modalEl); }
  modalEl.hidden = false; const box = modalEl.firstChild; box.innerHTML = html; box.scrollTop = 0; return box;
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
export class Sheet {
  constructor() {
    this.el = document.createElement('section'); this.el.className = 'sheet closed';
    this.el.innerHTML = `<div class="sheet-head"><h2></h2><button class="close" aria-label="Cerrar">${icon('x')}</button></div><div class="sheet-body"></div>`;
    document.body.appendChild(this.el); this.body = this.el.querySelector('.sheet-body');
    this.el.querySelector('.close').onclick = () => this.close();
    this.name = null; this.onClose = null;
  }
  open(name, title) { this.name = name; this.el.querySelector('h2').textContent = title; this.el.classList.remove('closed'); this.body.scrollTop = 0; }
  close() { if (!this.name) return; this.name = null; this.el.classList.add('closed'); this.onClose?.(); }
  get isOpen() { return !!this.name; }
}
// Guardado local sencillo
export const store = {
  load(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* lleno */ } },
};
