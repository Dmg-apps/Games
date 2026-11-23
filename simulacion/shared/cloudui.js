// Tarjeta de "Copia en la nube" para el menú y los juegos. Una sola cuenta para toda la app.
import * as Cloud from './cloud.js';
import { icon, esc, toast, confirm, modal, closeModal } from './ui.js';

const ago = (t) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'ahora mismo' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} días`; };

// Pregunta qué partida conservar cuando hay dos distintas
export function chooseSave(remoteSavedAt, onCloud, onLocal) {
  const box = modal(`<h2>Hay una partida en la nube</h2><p>Se guardó ${ago(remoteSavedAt)}. ¿Con cuál quieres seguir? La otra se sustituirá.</p>
    <div class="actions" style="flex-direction:column"><button class="btn coral" id="m_cloud">${icon('cloud')} La de la nube</button><button class="btn alt" id="m_local">La de este móvil</button></div>`);
  box.querySelector('#m_cloud').onclick = () => { closeModal(); onCloud(); };
  box.querySelector('#m_local').onclick = () => { closeModal(); onLocal(); };
}

// el: contenedor. opts.slot/opts.sync: partida del juego (si no, solo la cuenta, p. ej. en el menú).
// opts.onLogin(): tras entrar. opts.refresh(): volver a pintar.
export function renderCloud(el, opts = {}) {
  const again = () => (opts.refresh ? opts.refresh() : renderCloud(el, opts));
  if (!Cloud.configured()) { el.innerHTML = `<p class="hint">La copia en la nube no está disponible en esta versión. La partida se guarda en este móvil.</p>`; return; }
  const s = Cloud.session();
  if (!s) {
    el.innerHTML = `<p class="hint" style="margin-top:0">Con una cuenta, ${opts.slot ? 'esta partida se guarda' : 'todas tus partidas se guardan'} también fuera del móvil y puedes seguir en otro dispositivo. Sin conexión se guarda aquí y se sube sola al volver internet.</p>
      <div class="field"><input type="email" id="cem" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" placeholder="Email"></div>
      <div class="field"><input type="password" id="cpw" autocomplete="current-password" placeholder="Contraseña (mín. 6)"></div>
      <div class="row"><button class="btn coral" id="cin">Entrar</button><button class="btn alt" id="cup">Crear cuenta</button></div>
      <p style="text-align:center;margin:10px 0 0"><button class="hint" id="cfg" style="text-decoration:underline">He olvidado la contraseña</button></p>`;
    const v = () => [el.querySelector('#cem').value.trim(), el.querySelector('#cpw').value];
    const go = async (mode) => {
      const [e, p] = v(); if (!e || !p) return toast('Escribe tu email y una contraseña', 'warn');
      el.querySelectorAll('button').forEach((b) => (b.disabled = true));
      try {
        if (mode === 'up') await Cloud.signUp(e, p); else await Cloud.signIn(e, p);
        toast(mode === 'up' ? 'Cuenta creada' : 'Has entrado en tu cuenta', 'good', 'cloud');
        await opts.onLogin?.();
      } catch (err) { toast(err.message, 'bad'); }
      again();
    };
    el.querySelector('#cin').onclick = () => go('in'); el.querySelector('#cup').onclick = () => go('up');
    el.querySelector('#cfg').onclick = async () => { const [e] = v(); if (!e) return toast('Escribe tu email primero', 'warn'); try { await Cloud.resetPassword(e); toast('Te hemos enviado un email para cambiarla', 'good'); } catch (err) { toast(err.message, 'bad'); } };
    return;
  }
  let status = 'Tus partidas se guardan en la nube';
  let pending = false;
  if (opts.slot) {
    const m = Cloud.slotMeta(opts.slot); pending = m.pending;
    status = m.pending ? (navigator.onLine ? 'Hay cambios por subir' : 'Sin conexión: se subirá al volver internet') : m.syncedAt ? `Guardada en la nube ${ago(m.syncedAt)}` : 'Aún no se ha subido';
  }
  el.innerHTML = `<div class="card"><div class="h" style="display:flex;align-items:center;gap:10px"><span class="tilebox" style="background:${pending ? '#fff3dc' : '#e3f7ee'};color:${pending ? '#b7791f' : '#127a52'}">${icon(pending ? 'clock' : 'check')}</span><div style="min-width:0"><b style="word-break:break-all">${esc(s.email)}</b><div class="hint">${status}</div></div></div></div>
    <div class="row" style="margin-top:8px">${opts.sync ? `<button class="btn alt" id="cpush">${icon('cloud')} Subir ahora</button>` : ''}<button class="btn alt" id="cout">${icon('logout')} Salir</button></div>`;
  const pb = el.querySelector('#cpush');
  if (pb) pb.onclick = async () => { pb.disabled = true; const r = await opts.sync.now(); toast(r?.ok ? 'Partida guardada en la nube' : 'Sin conexión: se subirá más tarde', r?.ok ? 'good' : 'warn', 'cloud'); again(); };
  el.querySelector('#cout').onclick = () => confirm('¿Cerrar sesión en la nube? Las partidas seguirán guardadas en este móvil.', () => { Cloud.signOut(); toast('Sesión cerrada', 'info'); again(); });
}
