# Vidas

Simulador de vida para el móvil (PWA), inclusivo: cualquier persona puede amar a quien quiera y formar una familia. Crea una familia de hasta 4 miembros, atiende sus necesidades, sus preocupaciones y a sus bebés, trabaja, decora la casa y forma relaciones.

## Probarlo
- En local: `cd vidas && python3 -m http.server 8000` y abre `http://localhost:8000`.
- En el móvil: publica la carpeta `vidas/` (por ejemplo con GitHub Pages: Settings → Pages → Source: GitHub Actions; el workflow incluido la publica al hacer push a `main`). Ábrela en el navegador y usa "Añadir a pantalla de inicio".

## Estructura
- `js/sim.js`: simulación pura (necesidades, autonomía, trabajo, relaciones, bebés, facturas, tiempo sin conexión). No dibuja nada.
- `js/render.js`: renderizador isométrico 2D en canvas. Para pasar a 3D se sustituye esta clase por otra con la misma interfaz.
- `js/ui.js`: interfaz (paneles, menús, creador de familia).
- `js/data.js`: objetos, acciones, interacciones, trabajos, rasgos.

## Copia en la nube (Firebase)
La partida se guarda siempre en el móvil (funciona sin conexión) y, si inicias sesión, se sube a Firebase al volver internet.
Para activarla, rellena `vidas/js/cloud-config.js` con `apiKey` y `databaseURL` (Realtime Database), activa
Authentication → Correo/contraseña y pon estas reglas en Realtime Database:

```
{
  "rules": {
    "partidas": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```
También funciona con Firestore si se rellena `projectId` en vez de `databaseURL`.

## Notificaciones
- Con la app abierta o en segundo plano: avisos locales.
- Con la app cerrada: al cerrarse, la app calcula qué irá pasando y deja una cola de avisos en
  `partidas/<uid>/push`. El workflow `notify.yml` (cada 30 min) los envía con Web Push.
  Necesita dos secretos en GitHub (Settings → Secrets and variables → Actions):
  `FIREBASE_SERVICE_ACCOUNT` (JSON de la cuenta de servicio de Firebase) y `VAPID_PRIVATE_KEY`.
- En iPhone solo funcionan con la app añadida a la pantalla de inicio (iOS 16.4 o superior).
