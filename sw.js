/* ===========================================================================
 * PARADISE · Service Worker
 * ===========================================================================
 *
 * QUÉ ES ESTO
 * -----------
 * Un trozo de código del navegador que vive FUERA de la página. Sigue ahí
 * cuando ella cierra la pestaña o bloquea el teléfono, y es lo único que
 * puede enseñar una notificación con la aplicación en segundo plano.
 *
 * Hace dos cosas, y nada más:
 *
 *   1. `push`              el servidor avisa de que se acabó un show → se
 *                          enseña la notificación, con sonido y vibración.
 *   2. `notificationclick` ella la toca → se abre el programador (o se trae
 *                          al frente la pestaña que ya estuviera abierta).
 *
 * LO QUE NO HACE: GUARDAR PÁGINAS
 * -------------------------------
 * No se cachea nada a propósito. Un service worker que sirve archivos viejos
 * es la forma más rápida de que una modelo siga viendo la versión de la
 * semana pasada después de un despliegue, y aquí los datos cambian cada día.
 * El `fetch` va derecho a la red; está declarado solo porque Android lo pide
 * para considerar la web «instalable».
 *
 * AL CAMBIAR ESTE ARCHIVO hay que subir VERSION: así el navegador se entera
 * de que hay uno nuevo y lo reemplaza en la siguiente visita.
 */

const VERSION = 'paradise-1';

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

/* --------------------------------------------------------------- PUSH --- */
self.addEventListener('push', (evento) => {
    let datos = {};
    try { datos = evento.data ? evento.data.json() : {}; } catch (error) { datos = {}; }

    const titulo = datos.titulo || 'PARADISE';
    const opciones = {
        body: datos.cuerpo || '',
        icon: 'iconos/icono-192.png',
        badge: 'iconos/icono-192.png',
        tag: datos.etiqueta || 'paradise-plan',
        renotify: true,
        // Se queda en pantalla hasta que la toque: si está transmitiendo y no
        // mira el teléfono en ese momento, el aviso tiene que seguir ahí.
        requireInteraction: true,
        vibrate: [400, 180, 400, 180, 600],
        data: { url: datos.url || 'plan.html' },
        actions: [{ action: 'abrir', title: 'Abrir el programador' }],
    };
    evento.waitUntil(self.registration.showNotification(titulo, opciones));
});

self.addEventListener('notificationclick', (evento) => {
    evento.notification.close();
    const destino = (evento.notification.data && evento.notification.data.url) || 'plan.html';

    evento.waitUntil((async () => {
        const abiertas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const cliente of abiertas) {
            // Ya tiene la aplicación abierta: se trae al frente en vez de
            // abrir una segunda copia.
            if ('focus' in cliente) {
                await cliente.focus();
                if ('navigate' in cliente && cliente.url.indexOf(destino) < 0) {
                    try { await cliente.navigate(destino); } catch (error) { /* da igual */ }
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
