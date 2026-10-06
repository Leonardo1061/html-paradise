# PARADISE · Web

Las páginas que usan las modelos y el personal administrativo desde el navegador. Sitio
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
| `plan.html` | **Plan de trabajo** (TUS SHOWS): la misma pantalla del programa de escritorio |
| `fotografia.html` | **Fotografía**: malla del fotógrafo (agendarse y cancelar) y portafolio de estilos |
| `dashboard.html` | Tablero de métricas. Hoy con datos de ejemplo |

`panel.html` usa `js/panel.js`: los números los calcula la API (`/api/acceso/panel`)
con las mismas funciones del planificador, así que el panel y el plan no pueden
decir cosas distintas. La barra de abajo lleva a TUS SHOWS (`plan.html`), a
STATUS ROOM (`turnos.html`) y a FOTOGRAFÍA (`fotografia.html`).

`fotografia.html` usa `js/fotografia.js` y la API `/api/fotografia/…`. La malla
se vuelve a pedir cada 20 segundos mientras la página está a la vista, y las
fotos de referencia se comprimen en el teléfono antes de subirlas.

La contraseña inicial de una modelo son los últimos 4 dígitos de su cédula, igual
que en el programa de escritorio; la cambia desde PERFIL y vale para los dos.

`plan.html` usa `js/plan.js`. Pinta y pregunta: las reglas del plan (qué se
puede quitar, cuántos minutos hay que reponer) viven en la API, en una copia
exacta del archivo de reglas del escritorio. Si se reescribieran aquí, en un
mes el plan dependería de por dónde se abrió —y cualquiera podría saltárselas
desde la consola del navegador—.

Para entrar necesita el `token_sesion` que guarda `index.html` al iniciar
sesión. Si falta o caduca, la página devuelve al login sola.

## Web del personal administrativo

Para el equipo (monitores, CEO, Gerencia, Fotografía…). Se entra desde
`personal.html` (hay un enlace al pie del login de las modelos) con **el mismo
usuario y la misma contraseña del programa de escritorio** (PARADISE ADMIN,
`Configuracion/Monitores`). Las cuentas se siguen creando y cambiando en el
BackOffice del escritorio.

| Archivo | Qué es |
|---|---|
| `personal.html` | Login del personal: usuario + contraseña |
| `personal_panel.html` | **Inicio**: tareas, fotos de hoy y cuartos (los chats sin responder están en Chat) |
| `personal_chat.html` | **Chat** con las modelos y chat privado entre el personal (`js/chat_personal.js`, burbujas de `css/chat.css`) |
| `js/adjuntos.js` | Lo que se adjunta en TODOS los chats (modelos y personal): 📎 Galería, Cámara y Documento (PDF), y 🎤 nota de voz en WAV |
| `personal_fotografia.html` | **Fotografía**: la misma pantalla de las modelos; agenda a cualquier modelo (asunto o estilo del portafolio), marca Asistió / No Asistió y cancela (`js/fotografia_personal.js`) |
| `personal_status.html` | **Status Room**: la misma pantalla de las modelos; pone a cualquier modelo en un cuarto disponible o en un cupo vacío de la semana, o lo libera |
| `js/personal.js` | Lo común: sesión, barras y la 🔔 **campana de tareas** |
| `css/personal.css` | El aspecto (acento cian para no confundirla con la de las modelos) |

Las reglas de roles son las del escritorio y las aplica la API
(`/api/personal/…`, `reglas_personal.py`): solo CEO y Gerencia asignan tareas;
Soporte llega a Monitor Mañana, Tarde, Noche y Satélites según su jornada (y la
de su segundo rol); el chat de un rol le llega a quien tiene ese rol; Tropic
Studio solo lo ve quien está asignado a Tropic, el CEO y Gerencia, y el
asignado a Tropic no tiene Status Room. La página solo pinta lo que la API le
manda.

La sesión es `token_personal`, aparte del `token_sesion` de las modelos.

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
