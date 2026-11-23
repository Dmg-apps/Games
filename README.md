# Simulación

App de juegos de simulación para el móvil (PWA, funciona sin conexión). Publicada en https://dmg-apps.github.io/Games/

## Juegos
- **Vidas** (`simulacion/vidas/`): simulador de vida inclusivo con familia, necesidades, trabajo, relaciones, hijos, mascotas, barrio, construcción, 3D con modo ligero, copia en la nube (Firebase) y notificaciones.
- **Parque Salvaje** (`simulacion/zoo/`): gestión de un parque de animales: caminos, recintos por hábitat, especies que se desbloquean con la fama, crías, visitantes con necesidades, tiendas, personal y economía diaria.
- **Arrecife** (`simulacion/acuario/`): tienda de peces: cuidado de acuarios (comida, agua, temperatura), cría con herencia y mutaciones, álbum de 96 variedades, clientes con encargos y mejoras.

## Estructura
- `simulacion/index.html` y `hub.js`: menú de juegos.
- `simulacion/shared/`: motor 3D ligero (`engine3d.js`), interfaz común (`ui.css`, `ui.js`), iconos, tipografía y Three.js.
- `simulacion/sw.js`: un único service worker para toda la app. **Regenerarlo al añadir o cambiar archivos**: `python3 tools/build-sw.py`.

## Añadir un juego nuevo
1. Crea `simulacion/<juego>/index.html` y su módulo, usando `../shared/engine3d.js` y `../shared/ui.js`.
2. Añádelo a la lista `GAMES` de `simulacion/hub.js`.
3. Ejecuta `python3 tools/build-sw.py`.

## Rendimiento
Los juegos dibujan solo cuando hace falta (pocas imágenes por segundo en reposo), usan materiales baratos, sin sombras en tiempo real en calidad ahorro y resolución contenida, para no calentar el móvil.

## Copia en la nube y notificaciones (Vidas)
Ver `simulacion/vidas/js/cloud-config.js` y `notifier/`. Reglas de Realtime Database:
```
{ "rules": { "partidas": { "$uid": { ".read": "auth != null && auth.uid === $uid", ".write": "auth != null && auth.uid === $uid" } } } }
```
El workflow `notify.yml` necesita los secretos `FIREBASE_SERVICE_ACCOUNT` y `VAPID_PRIVATE_KEY`.
