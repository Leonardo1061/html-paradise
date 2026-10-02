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
| `index.html` | Login de las modelos. Es la portada del sitio |
| `turnos.html` | Pre-agendamiento y toma de cupos de la semana |
| `reuniones.html` | Reuniones de Meet (uso de los monitores) |
| `dashboard.html` | Tablero de métricas. Hoy con datos de ejemplo |

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

## Este repositorio es PÚBLICO

Nada de credenciales aquí dentro: ni llaves de Firebase, ni tokens, ni
contraseñas. El código del backend tampoco: vive en el repositorio `api`, que
es privado.

## Despliegue

Render sirve estos archivos tal cual, sin compilar nada. Un push a `main` se
publica solo.
