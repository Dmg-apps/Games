// Envía las notificaciones pendientes de Vidas. Lo ejecuta GitHub Actions cada 30 minutos.
// Lee partidas/<uid>/push de la Realtime Database (con una cuenta de servicio), manda los avisos
// cuya hora ya ha llegado y los quita de la cola.
import webpush from 'web-push';
import { GoogleAuth } from 'google-auth-library';

const DB = process.env.FIREBASE_DB_URL;
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SA = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!DB || !VAPID_PRIVATE || !SA) { console.log('Faltan secretos: FIREBASE_SERVICE_ACCOUNT y/o VAPID_PRIVATE_KEY. No se envía nada.'); process.exit(0); }

webpush.setVapidDetails('https://dmg-apps.github.io/Games/', VAPID_PUBLIC, VAPID_PRIVATE);
const auth = new GoogleAuth({ credentials: JSON.parse(SA), scopes: ['https://www.googleapis.com/auth/firebase.database', 'https://www.googleapis.com/auth/userinfo.email'] });
const token = (await (await auth.getClient()).getAccessToken()).token;
const url = (path, extra = '') => `${DB.replace(/\/$/, '')}/${path}.json?access_token=${token}${extra}`;

const users = await (await fetch(url('partidas', '&shallow=true'))).json();
const now = Date.now(); let sent = 0;
for (const uid of Object.keys(users || {})) {
  const push = await (await fetch(url(`partidas/${uid}/push`))).json();
  if (!push || !push.sub || !Array.isArray(push.queue)) continue;
  const due = push.queue.filter((n) => n && n.at <= now);
  if (!due.length) continue;
  const fresh = due.filter((n) => now - n.at < 3 * 3600e3); // lo muy antiguo se descarta
  const last = fresh.slice(-2); // como mucho 2 avisos por pasada para no agobiar
  let gone = false;
  for (const n of last) {
    try { await webpush.sendNotification(push.sub, JSON.stringify({ title: n.title, body: n.body, tag: 'vidas-' + n.at })); sent++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { gone = true; break; } console.log('Error', uid, e.statusCode); }
  }
  const rest = push.queue.filter((n) => n && n.at > now);
  await fetch(url(`partidas/${uid}/push`), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(gone ? { sub: null, queue: null } : { queue: rest.length ? rest : null }) });
}
console.log(`Notificaciones enviadas: ${sent}`);
