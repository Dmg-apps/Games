// Copia en la nube con Firebase (Authentication + Realtime Database) usando sus API REST, sin librerías.
// Una sola cuenta para toda la app: Vidas guarda en partidas/{uid} y los demás juegos en partidas/{uid}/juegos/{juego}.
// Funciona "sin conexión primero": se guarda siempre en el móvil y se sube cuando hay internet.
import { CLOUD } from './cloud-config.js';

const SESSION_KEY = 'vidas_cloud_session';
const META_KEY = 'vidas_cloud_meta';
const AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts';
const TOKEN = 'https://securetoken.googleapis.com/v1/token';

const ERRORS = {
  EMAIL_EXISTS: 'Ya hay una cuenta con ese email. Prueba a entrar.',
  EMAIL_NOT_FOUND: 'No hay ninguna cuenta con ese email.',
  INVALID_PASSWORD: 'Contraseña incorrecta.',
  INVALID_LOGIN_CREDENTIALS: 'Email o contraseña incorrectos.',
  INVALID_EMAIL: 'Ese email no es válido.',
  MISSING_PASSWORD: 'Falta la contraseña.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Demasiados intentos. Espera un poco.',
  USER_DISABLED: 'Esta cuenta está desactivada.',
};

export const configured = () => !!(CLOUD.apiKey && (CLOUD.databaseURL || CLOUD.projectId));
// Realtime Database si hay databaseURL; si no, Firestore
const useRTDB = () => !!CLOUD.databaseURL;
const rtdbUrl = (uid, tok) => `${CLOUD.databaseURL.replace(/\/$/, '')}/partidas/${uid}.json?auth=${encodeURIComponent(tok)}`;
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => (v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k));

export function session() { return read(SESSION_KEY); }
export function meta() { return read(META_KEY) || { syncedAt: 0, pending: false }; }
function setMeta(m) { write(META_KEY, { ...meta(), ...m }); }

async function post(url, body) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const code = (j.error?.message || 'ERROR').split(' ')[0];
    if (code.startsWith('WEAK_PASSWORD')) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    throw new Error(ERRORS[code] || 'No se ha podido conectar. Inténtalo más tarde.');
  }
  return j;
}
function saveSession(j, email) {
  const s = { uid: j.localId || j.user_id, email: email || j.email, idToken: j.idToken || j.id_token, refreshToken: j.refreshToken || j.refresh_token, expiresAt: Date.now() + (Number(j.expiresIn || j.expires_in) - 60) * 1000 };
  write(SESSION_KEY, s); return s;
}

export async function signUp(email, password) {
  return saveSession(await post(`${AUTH}:signUp?key=${CLOUD.apiKey}`, { email, password, returnSecureToken: true }), email);
}
export async function signIn(email, password) {
  return saveSession(await post(`${AUTH}:signInWithPassword?key=${CLOUD.apiKey}`, { email, password, returnSecureToken: true }), email);
}
export async function resetPassword(email) {
  await post(`${AUTH}:sendOobCode?key=${CLOUD.apiKey}`, { requestType: 'PASSWORD_RESET', email });
}
export function signOut() { write(SESSION_KEY, null); write(META_KEY, null); for (const k of Object.keys(localStorage)) if (k.startsWith('cloud_meta_')) localStorage.removeItem(k); }

async function token() {
  const s = session(); if (!s) return null;
  if (Date.now() < s.expiresAt) return s;
  const r = await fetch(`${TOKEN}?key=${CLOUD.apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(s.refreshToken)}` });
  if (!r.ok) { if (r.status === 400) signOut(); return null; }
  return saveSession(await r.json(), s.email);
}
export const freshToken = () => token();
const docUrl = (uid) => `https://firestore.googleapis.com/v1/projects/${CLOUD.projectId}/databases/(default)/documents/partidas/${uid}`;

// Sube la partida. Si no hay conexión, queda marcada como pendiente.
export async function push(state) {
  if (!configured() || !session()) return { ok: false, reason: 'off' };
  setMeta({ pending: true });
  if (!navigator.onLine) return { ok: false, reason: 'offline' };
  try {
    const s = await token(); if (!s) return { ok: false, reason: 'auth' };
    if (useRTDB()) {
      const r = await fetch(rtdbUrl(s.uid, s.idToken), { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: JSON.stringify(state), savedAt: state.lastSaved || Date.now(), family: state.surname || '' }) });
      if (!r.ok) return { ok: false, reason: 'server' };
      setMeta({ pending: false, syncedAt: Date.now() });
      return { ok: true };
    }
    const body = { fields: {
      data: { stringValue: JSON.stringify(state) },
      savedAt: { integerValue: String(state.lastSaved || Date.now()) },
      family: { stringValue: state.surname || '' },
    } };
    const r = await fetch(docUrl(s.uid), { method: 'PATCH', keepalive: true, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.idToken}` }, body: JSON.stringify(body) });
    if (!r.ok) return { ok: false, reason: 'server' };
    setMeta({ pending: false, syncedAt: Date.now() });
    return { ok: true };
  } catch { return { ok: false, reason: 'offline' }; }
}

// Descarga la partida de la nube (o null si no hay)
export async function pull() {
  if (!configured() || !session() || !navigator.onLine) return null;
  try {
    const s = await token(); if (!s) return null;
    if (useRTDB()) {
      const r = await fetch(rtdbUrl(s.uid, s.idToken)); if (!r.ok) return null;
      const j = await r.json(); if (!j || !j.data) return null;
      return { state: JSON.parse(j.data), savedAt: Number(j.savedAt || 0), family: j.family || '' };
    }
    const r = await fetch(docUrl(s.uid), { headers: { Authorization: `Bearer ${s.idToken}` } });
    if (r.status === 404 || !r.ok) return null;
    const j = await r.json();
    const data = JSON.parse(j.fields?.data?.stringValue || 'null');
    return data ? { state: data, savedAt: Number(j.fields?.savedAt?.integerValue || 0), family: j.fields?.family?.stringValue || '' } : null;
  } catch { return null; }
}

// ---------- partidas de los demás juegos (una por juego) ----------
const slotUrl = (uid, slot, tok) => `${CLOUD.databaseURL.replace(/\/$/, '')}/partidas/${uid}/juegos/${slot}.json?auth=${encodeURIComponent(tok)}`;
export const slotMeta = (slot) => read('cloud_meta_' + slot) || { syncedAt: 0, pending: false };
const setSlotMeta = (slot, m) => write('cloud_meta_' + slot, { ...slotMeta(slot), ...m });

export async function pushSlot(slot, state) {
  if (!configured() || !useRTDB() || !session()) return { ok: false, reason: 'off' };
  setSlotMeta(slot, { pending: true });
  if (!navigator.onLine) return { ok: false, reason: 'offline' };
  try {
    const s = await token(); if (!s) return { ok: false, reason: 'auth' };
    const r = await fetch(slotUrl(s.uid, slot, s.idToken), { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: JSON.stringify(state), savedAt: state.lastSaved || Date.now() }) });
    if (!r.ok) return { ok: false, reason: 'server' };
    setSlotMeta(slot, { pending: false, syncedAt: Date.now() });
    return { ok: true };
  } catch { return { ok: false, reason: 'offline' }; }
}
// Devuelve la partida, null si no hay ninguna o undefined si no se ha podido consultar
export async function pullSlot(slot) {
  if (!configured() || !useRTDB() || !session() || !navigator.onLine) return undefined;
  try {
    const s = await token(); if (!s) return undefined;
    const r = await fetch(slotUrl(s.uid, slot, s.idToken)); if (!r.ok) return undefined;
    const j = await r.json(); if (!j || !j.data) return null;
    return { state: JSON.parse(j.data), savedAt: Number(j.savedAt || 0) };
  } catch { return undefined; }
}

// Sincronización automática de un juego: se sube como mucho una vez por minuto mientras juegas,
// siempre al salir de la app y al recuperar la conexión. Nunca se sube nada hasta haber comprobado
// la nube al abrir, para no pisar una partida más reciente jugada en otro dispositivo.
export function autoSync(slot, getState) {
  let last = 0, ready = false, checking = null;
  const now = () => { if (!session()) return; if (!ready) { setSlotMeta(slot, { pending: true }); return; } last = Date.now(); return pushSlot(slot, getState()); };
  const api = {
    now,
    get ready() { return ready; },
    saved() { if (!session()) return; if (ready && Date.now() - last > 60000) now(); else setSlotMeta(slot, { pending: true }); },
    // Partida de la nube si es más reciente que "base" (lo guardado aquí al abrir). Tras comprobarlo ya se puede subir.
    newer(base) {
      return (checking ||= pullSlot(slot).then((r) => {
        checking = null; if (r === undefined) return undefined;
        if (r && r.savedAt > (base ?? 0) + 5000) return r;
        ready = true; return null;
      }));
    },
    // Cuando se elige la partida de este móvil frente a la de la nube
    keepLocal() { ready = true; return now(); },
  };
  window.addEventListener('online', () => { if (!ready) api.onRetry?.(); else if (slotMeta(slot).pending) now(); });
  return api;
}
