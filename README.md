# PARADISE · Web

Las páginas que usan las modelos y los monitores desde el navegador. Sitio
**estático**: solo HTML, CSS y JavaScript. Desplegado en Render.

    https://paradise-go1a.onrender.com

## El mapa del proyecto

| Pieza | Repositorio | Dónde vive |
|---|---|---|
| Páginas web (esto) | `html-paradise` | `paradise-go1a.onrender.com` |
| API | `api` (privado) | `api-v03l.onrender.com` |
| Escritorio del monitor | `1.PARADISE_ADMIN` | .exe en los equipos del estudio |
| Escritorio de las modelos | `2.PARADISE_MODEL` | .exe en los equipos de las modelos |

Las cuatro piezas hablan con la MISMA base de Firestore.

## Páginas

| Archivo | Qué es |
|---|---|
| `index.html` | Login por **cédula + contraseña**. Es la portada del sitio |
| `panel.html` | **Panel de inicio**: resumen de su semana y la barra de navegación |
| `turnos.html` | Pre-agendamiento y toma de cupos de la semana |
| `reuniones.html` | Reuniones de Meet (uso de los monitores) |
| `plan.html` | **Plan de trabajo**: la misma pantalla del programa de escritorio |
| `dashboard.html` | Tablero de métricas. Hoy con datos de ejemplo |

`panel.html` usa `js/panel.js`: los números los calcula la API (`/api/acceso/panel`)
con las mismas funciones del planificador, así que el panel y el plan no pueden
decir cosas distintas. La barra de abajo lleva a PROGRAMADOR (`plan.html`) y a
STATUS (`turnos.html`).

La contraseña inicial de una modelo son los últimos 4 dígitos de su cédula, igual
que en el programa de escritorio; la cambia desde PERFIL y vale para los dos.

`plan.html` usa `js/plan.js`. Pinta y pregunta: las reglas del plan (qué se
puede quitar, cuántos minutos hay que reponer) viven en la API, en una copia
exacta del archivo de reglas del escritorio. Si se reescribieran aquí, en un
mes el plan dependería de por dónde se abrió —y cualquiera podría saltárselas
desde la consola del navegador—.

Para entrar necesita el `token_sesion` que guarda `index.html` al iniciar
sesión. Si falta o caduca, la página devuelve al login sola.

## La configuración está en un solo sitio

`js/config.js` guarda la dirección de la API y la del propio sitio. Las
páginas la leen así:

```js
const API_URL   = PARADISE.API_URL;
const URL_LOGIN = PARADISE.URL_LOGIN;
```

Para probar contra una API local, abre la página con `?api=http://localhost:8000`.
Queda guardado para esa pestaña y no afecta a nadie más.

**No escribas direcciones dentro de los .html.** El día que cambie el servicio
tocaría editar cuatro archivos y se te olvidaría uno.

## Se instala en el teléfono (PWA)

| Archivo | Qué es |
|---|---|
| `manifest.webmanifest` | Nombre, iconos y colores de la aplicación instalada |
| `sw.js` | Service worker: enseña las notificaciones con la app cerrada |
| `js/push.js` | Registra el service worker y suscribe el teléfono a los avisos |
| `iconos/` | Los iconos de la aplicación |
| `probar_sw.js` | Prueba del service worker sin navegador: `node probar_sw.js` |

**Para instalarla**, la modelo abre el sitio en Chrome y elige «Instalar
aplicación» / «Añadir a la pantalla de inicio». Queda como un icono más, sin
barra del navegador.

**Los avisos con la aplicación cerrada** los manda la API (ver su README:
llaves VAPID y cron). El permiso se pide cuando pulsa «Empezar» un show, que
es cuando se entiende para qué sirve; también puede activarlos o probarlos
desde PERFIL. Si los rechaza, todo lo demás sigue funcionando: solo pierde el
aviso cuando la página no está delante.

`sw.js` **no cachea nada** a propósito. Un service worker que sirve archivos
viejos es la forma más rápida de que una modelo siga viendo la versión de la
semana pasada después de un despliegue.

## Este repositorio es PÚBLICO

Nada de credenciales aquí dentro: ni llaves de Firebase, ni tokens, ni
contraseñas. El código del backend tampoco: vive en el repositorio `api`, que
es privado.

## Despliegue

Render sirve estos archivos tal cual, sin compilar nada. Un push a `main` se
publica solo.
