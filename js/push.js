/* ===========================================================================
 * PARADISE · Notificaciones con la aplicación cerrada
 * ===========================================================================
 *
 * CÓMO FUNCIONA, EN TRES PASOS
 * ----------------------------
 *   1. El navegador registra `sw.js`, que vive fuera de la página.
 *   2. Ella da permiso de notificaciones y el navegador crea una
 *      «suscripción»: una dirección única a la que su teléfono escucha.
 *   3. Esa dirección se guarda en la API. Cuando a un show se le acaba el
 *      tiempo, el servidor manda el aviso a esa dirección y el teléfono lo
 *      enseña, aunque la aplicación esté cerrada.
 *
 * El permiso se pide cuando pulsa «Empezar», que es el momento en que se
 * entiende para qué sirve. Pedirlo nada más entrar es la mejor forma de que
 * lo rechacen para siempre.
 *
 * SI ALGO DE ESTO NO ESTÁ DISPONIBLE no pasa nada: la cuenta atrás y la
 * alarma de la propia página siguen funcionando igual. Esto solo añade el
 * aviso cuando la página NO está delante.
 */

window.PARADISE_PUSH = (function () {
'use strict';

const API = window.PARADISE ? PARADISE.API_URL : '';
let registro = null;

function soportado() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/* El navegador quiere la llave pública en bytes; la API la manda en texto. */
function aBytes(base64) {
    const relleno = '='.repeat((4 - base64.length % 4) % 4);
    const limpio = (base64 + relleno).replace(/-/g, '+').replace(/_/g, '/');
    const crudo = window.atob(limpio);
    return Uint8Array.from([...crudo].map((c) => c.charCodeAt(0)));
}

async function registrarTrabajador() {
    if (!soportado()) return null;
    if (registro) return registro;
    try {
        registro = await navigator.serviceWorker.register('sw.js');
        await navigator.serviceWorker.ready;
        return registro;
    } catch (error) {
        console.warn('PARADISE: no se pudo registrar el service worker', error);
        return null;
    }
}

/* Se llama al pulsar «Empezar». Devuelve true si el teléfono quedará avisado
   aunque cierre la aplicación. */
async function activar(token) {
    if (!soportado()) return false;

    const trabajador = await registrarTrabajador();
    if (!trabajador) return false;

    let permiso = Notification.permission;
    if (permiso === 'default') permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return false;

    try {
        const respuesta = await fetch(API + '/api/push/clave', { cache: 'no-store' });
        const datos = await respuesta.json();
        if (!datos.clave) return false;        // el servidor no tiene push configurado

        let suscripcion = await trabajador.pushManager.getSubscription();
        if (!suscripcion) {
            suscripcion = await trabajador.pushManager.subscribe({
                userVisibleOnly: true,                     // obligatorio en Chrome
                applicationServerKey: aBytes(datos.clave),
            });
        }

        await fetch(API + '/api/push/suscribir', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(suscripcion.toJSON()),
        });
        return true;
    } catch (error) {
        console.warn('PARADISE: no se pudo activar el aviso en segundo plano', error);
        return false;
    }
}

/* Para el botón de ajustes: deja de recibir avisos en ESTE teléfono. */
async function desactivar(token) {
    try {
        const trabajador = await registrarTrabajador();
        if (!trabajador) return;
        const suscripcion = await trabajador.pushManager.getSubscription();
        if (!suscripcion) return;
        await fetch(API + '/api/push/borrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ endpoint: suscripcion.endpoint }),
        });
        await suscripcion.unsubscribe();
    } catch (error) { /* si falla, deja de llegar igual al caducar */ }
}

async function estaActivo() {
    if (!soportado() || Notification.permission !== 'granted') return false;
    const trabajador = await registrarTrabajador();
    if (!trabajador) return false;
    return !!(await trabajador.pushManager.getSubscription());
}

// Se registra al cargar cualquier página: así la aplicación ya es
// «instalable» y el aviso puede llegar aunque hoy no abra el programador.
if (soportado()) registrarTrabajador();

return { soportado, activar, desactivar, estaActivo, registrarTrabajador };
})();
