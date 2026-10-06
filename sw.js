/* ===========================================================================
 * PARADISE · Service Worker
 * ===========================================================================
 *
 * QUÉ ES ESTO
 * -----------
 * Un trozo de código del navegador que vive FUERA de la página. Sigue ahí
 * cuando la persona cierra la pestaña o bloquea el teléfono, y es lo único
 * que puede enseñar una notificación con la aplicación en segundo plano.
 *
 * Hace dos cosas, y nada más:
 *
 *   1. `push`              el servidor avisa (se acabó un show, o llegó un
 *                          mensaje de chat) → se enseña la notificación,
 *                          con sonido y vibración.
 *   2. `notificationclick` la toca → se abre la página del aviso (o se trae
 *                          al frente la pestaña que ya estuviera abierta).
 *
 * Sirve a las dos webs: la de las modelos y la del personal (personal_*.html).
 * El servidor dice en cada aviso qué página abrir.
 *
 * LO QUE NO HACE: GUARDAR PÁGINAS
 * -------------------------------
 * No se cachea nada a propósito. Un service worker que sirve archivos viejos
 * es la forma más rápida de que alguien siga viendo la versión de la semana
 * pasada después de un despliegue, y aquí los datos cambian cada día.
 * El `fetch` va derecho a la red; está declarado solo porque Android lo pide
 * para considerar la web «instalable».
 *
 * AL CAMBIAR ESTE ARCHIVO hay que subir VERSION: así el navegador se entera
 * de que hay uno nuevo y lo reemplaza en la siguiente visita.
 */

const VERSION = 'paradise-2';

self.addEventListener('install', (evento) => {
    // Sin esperar a que se cierren las pestañas viejas: no hay caché que
    // proteger, así que cuanto antes mande el nuevo, mejor.
    self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
    evento.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (evento) => {
    // A la red, siempre. Ver el comentario de arriba.
    return;
});

function absoluta(url) {
    return new URL(url || 'plan.html', self.registration.scope).href;
}

/* --------------------------------------------------------------- PUSH --- */
self.addEventListener('push', (evento) => {
    let datos = {};
    try { datos = evento.data ? evento.data.json() : {}; } catch (error) { datos = {}; }

    const titulo = datos.titulo || 'PARADISE';
    // Los avisos de antes (la alarma del show) no traen `fijo`: se quedan en
    // pantalla hasta que la toque. Los del chat se pueden ir solos.
    const fijo = datos.fijo !== false;
    const opciones = {
        body: datos.cuerpo || '',
        icon: 'iconos/icono-192.png',
        badge: 'iconos/icono-192.png',
        // Una conversación = una etiqueta: el mensaje nuevo reemplaza al
        // anterior de ese mismo chat en vez de apilar veinte, y `renotify`
        // hace que vuelva a sonar y vibrar.
        tag: datos.etiqueta || 'paradise-plan',
        renotify: true,
        requireInteraction: fijo,
        vibrate: fijo ? [400, 180, 400, 180, 600] : [250, 120, 250],
        timestamp: Date.now(),
        data: { url: datos.url || 'plan.html' },
        actions: [{ action: 'abrir', title: datos.accion || 'Abrir el programador' }],
    };
    evento.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (evento) => {
    evento.notification.close();
    const destino = absoluta(evento.notification.data && evento.notification.data.url);
    const pagina = new URL(destino).pathname;

    evento.waitUntil((async () => {
        const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        // Mejor una pestaña que ya esté en esa misma página (chat del
        // personal o de la modelo); si no, cualquiera de la aplicación.
        const ordenadas = abiertas.slice().sort((a, b) =>
            (new URL(b.url).pathname === pagina) - (new URL(a.url).pathname === pagina));
        for (const cliente of ordenadas) {
            if ('focus' in cliente) {
                const enfocado = await cliente.focus();
                if (cliente.url !== destino && 'navigate' in (enfocado || cliente)) {
                    try { await (enfocado || cliente).navigate(destino); } catch (error) { /* da igual */ }
                }
                return;
            }
        }
        if (self.clients.openWindow) await self.clients.openWindow(destino);
    })());
});

/* Si el servidor cambia las llaves, el navegador cancela la suscripción y
   avisa aquí. No se puede renovar sola sin la llave pública, así que lo
   único sensato es no romper nada: la próxima vez que abra la página,
   `js/push.js` la vuelve a crear. */
self.addEventListener('pushsubscriptionchange', (evento) => {
    // Intencionadamente vacío. Ver el comentario.
});
