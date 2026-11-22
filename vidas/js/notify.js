// Notificaciones: locales (con la app en segundo plano) y push (con la app cerrada).
// Las push las envía una tarea programada de GitHub Actions (notifier/send.mjs) leyendo
// la cola de avisos que la app deja en Firebase al cerrarse.
import { CLOUD } from './cloud-config.js';
import * as Cloud from './cloud.js';

export const VAPID_PUBLIC = 'BPGojWRGqHJm7AayMiKqdb-FTbi7qKHToQPNS0MR3Iz76MYktQBpTMulLn1mK6pLPbSzBTmJSELueuIPr4HWSa8';
const PREF = 'vidas_notify';

export const supported = () => 'Notification' in window && 'serviceWorker' in navigator;
export const pushSupported = () => supported() && 'PushManager' in window;
export const permission = () => (supported() ? Notification.permission : 'denied');
export const enabled = () => permission() === 'granted' && localStorage.getItem(PREF) !== 'off';
// En iPhone las notificaciones solo funcionan con la app añadida a la pantalla de inicio
export const needsInstall = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches;

function b64ToBytes(b64) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// Pide permiso (debe llamarse desde un toque del usuario) y registra el push
export async function enable() {
  if (!supported()) return { ok: false, reason: 'unsupported' };
  const p = await Notification.requestPermission();
  if (p !== 'granted') return { ok: false, reason: 'denied' };
  localStorage.setItem(PREF, 'on');
  const push = await subscribe();
  return { ok: true, push };
}
export function disable() { localStorage.setItem(PREF, 'off'); saveRemote({ sub: null, queue: null }); }

async function subscribe() {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC) });
    return await saveRemote({ sub: sub.toJSON() });
  } catch { return false; }
}

// Guarda en Firebase (partidas/<uid>/push) la suscripción y la cola de avisos
async function saveRemote(patch) {
  const s = Cloud.session(); if (!s || !CLOUD.databaseURL || !navigator.onLine) return false;
  try {
    const tok = await Cloud.freshToken(); if (!tok) return false;
    const r = await fetch(`${CLOUD.databaseURL.replace(/\/$/, '')}/partidas/${tok.uid}/push.json?auth=${encodeURIComponent(tok.idToken)}`, {
      method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    });
    return r.ok;
  } catch { return false; }
}
export function uploadQueue(queue) { if (enabled()) return saveRemote({ queue, updatedAt: Date.now() }); }
export function clearQueue() { if (enabled()) return saveRemote({ queue: null }); }

// Aviso inmediato si la app está abierta pero no a la vista
export async function local(title, body, tag) {
  if (!enabled() || !document.hidden) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    reg.showNotification(title, { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true });
  } catch { /* sin service worker */ }
}
