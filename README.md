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
La partida se guarda siempre en el móvil (funciona sin conexión) y, si inicias sesión, se sube a Firestore al volver internet.
Para activarla, rellena `vidas/js/cloud-config.js` con `apiKey` y `projectId` de la app web de Firebase, activa
Authentication → Correo/contraseña y crea Firestore con estas reglas:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /partidas/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
