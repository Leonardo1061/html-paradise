/* ===========================================================================
 * PARADISE · Notificaciones con la aplicación cerrada
 * ===========================================================================
 *
 * CÓMO FUNCIONA, EN TRES PASOS
 * ----------------------------
 *   1. El navegador registra `sw.js`, que vive fuera de la página.
 *   2. La persona da permiso de notificaciones y el navegador crea una
 *      «suscripción»: una dirección única a la que su teléfono escucha.
 *   3. Esa dirección se guarda en la API. Cuando se acaba un show o le llega
 *      un mensaje de chat, el servidor manda el aviso a esa dirección y el
 *      teléfono lo enseña, aunque la aplicación esté cerrada o el teléfono
 *      bloqueado (el servidor lo manda con urgencia alta).
 *
 * LAS DOS WEBS
 * ------------
 * Las modelos se suscriben en `/api/push/suscribir` con `token_sesion`. El
 * personal, en `/api/personal/push/suscribir` con `token_personal`. Las
 * páginas personal_*.html son del personal; las demás, de las modelos.
 *
 * EL PERMISO
 * ----------
 * Los navegadores (y el iPhone siempre) solo dejan pedirlo al tocar un botón.
 * Por eso, si aún no lo dio, sale abajo una tarjeta «Activar avisos de
 * mensajes». Si ya lo dio, la suscripción se renueva sola al abrir la web,
 * sin preguntar nada. Si lo rechazó, no se insiste: solo puede volver a
 * darlo desde los ajustes del navegador.
 *
 * EN IPHONE solo funciona con la web INSTALADA en la pantalla de inicio
 * (Compartir → Agregar a inicio) y iOS 16.4 o más nuevo. En Safari normal no
 * existe; la tarjeta le explica cómo instalarla.
 *
 * SI ALGO DE ESTO NO ESTÁ DISPONIBLE no pasa nada: la web sigue funcionando
 * igual. Esto solo añade el aviso cuando la página NO está delante.
 */

window.PARADISE_PUSH = (function () {
'use strict';

const API = window.PARADISE ? PARADISE.API_URL : '';
const RUTAS_MODELO = { suscribir: '/api/push/suscribir', borrar: '/api/push/borrar' };
const RUTAS_PERSONAL = { suscribir: '/api/personal/push/suscribir', borrar: '/api/personal/push/borrar' };
const CLAVE_TARJETA = 'avisos_tarjeta_cerrada';
const DIAS_SIN_INSISTIR = 3;
let registro = null;

function soportado() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function esIphone() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function instalada() {
    return window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}

function esPaginaPersonal() {
    return /\/personal[^\/]*\.html$/.test(window.location.pathname);
}

/* Quién está en esta página: { token, rutas } o null si nadie entró. */
function sesion() {
    try {
        if (esPaginaPersonal()) {
            const token = localStorage.getItem('token_personal');
            return token ? { token: token, rutas: RUTAS_PERSONAL } : null;
        }
        const token = localStorage.getItem('token_sesion');
        return token ? { token: token, rutas: RUTAS_MODELO } : null;
    } catch (error) {
        return null;
    }
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

/* Pide permiso (si hace falta) y guarda este teléfono en la API. Devuelve
   true si quedará avisado aunque cierre la aplicación. Para pedir permiso
   tiene que llamarse desde un toque. `ruta` es la de suscribir: la de las
   modelos si no se dice otra. */
async function activar(token, ruta) {
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

        const guardado = await fetch(API + (ruta || RUTAS_MODELO.suscribir), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(suscripcion.toJSON()),
        });
        return guardado.ok;
    } catch (error) {
        console.warn('PARADISE: no se pudo activar el aviso en segundo plano', error);
        return false;
    }
}

/* Para el botón de ajustes: deja de recibir avisos en ESTE teléfono. */
async function desactivar(token, ruta) {
    try {
        const trabajador = await registrarTrabajador();
        if (!trabajador) return;
        const suscripcion = await trabajador.pushManager.getSubscription();
        if (!suscripcion) return;
        await fetch(API + (ruta || RUTAS_MODELO.borrar), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify({ endpoint: suscripcion.endpoint }),
        });
        await suscripcion.unsubscribe();
    } catch (error) { /* si falla, deja de llegar igual al caducar */ }
}

/* Al SALIR: que este teléfono deje de recibir lo de esa persona (el
   teléfono puede ser compartido) y que la sesión se borre en la API, porque
   ya no caduca sola. No quita la suscripción del navegador: si en el mismo
   teléfono hay otra cuenta entrada, a esa le sigue llegando. Nunca tarda
   más de dos segundos: salir no puede quedarse colgado por esto. */
async function salir(personal) {
    const token = localStorage.getItem(personal ? 'token_personal' : 'token_sesion') || '';
    if (!token) return;
    const rutas = personal ? RUTAS_PERSONAL : RUTAS_MODELO;
    const cabeceras = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
    const trabajo = (async () => {
        try {
            if (soportado() && navigator.serviceWorker.controller) {
                const trabajador = await navigator.serviceWorker.ready;
                const suscripcion = await trabajador.pushManager.getSubscription();
                if (suscripcion) {
                    await fetch(API + rutas.borrar, {
                        method: 'POST', headers: cabeceras, keepalive: true,
                        body: JSON.stringify({ endpoint: suscripcion.endpoint }),
                    });
                }
            }
        } catch (error) { /* da igual */ }
        try {
            await fetch(API + (personal ? '/api/personal/salir' : '/api/acceso/salir'),
                        { method: 'POST', headers: cabeceras, keepalive: true });
        } catch (error) { /* da igual */ }
    })();
    await Promise.race([trabajo, new Promise((r) => setTimeout(r, 2000))]);
}

async function estaActivo() {
    if (!soportado() || Notification.permission !== 'granted') return false;
    const trabajador = await registrarTrabajador();
    if (!trabajador) return false;
    return !!(await trabajador.pushManager.getSubscription());
}

/* ------------------------------------------------ la tarjeta de abajo --- */
function tarjetaCerradaHacePoco() {
    try {
        const cuando = Number(localStorage.getItem(CLAVE_TARJETA) || 0);
        return Date.now() - cuando < DIAS_SIN_INSISTIR * 24 * 3600 * 1000;
    } catch (error) {
        return false;
    }
}

function pintarTarjeta(texto, boton, alTocar) {
    if (document.getElementById('tarjeta-avisos')) return;
    const tarjeta = document.createElement('div');
    tarjeta.id = 'tarjeta-avisos';
    tarjeta.setAttribute('role', 'dialog');
    tarjeta.style.cssText =
        'position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));' +
        'z-index:9999;max-width:460px;margin:0 auto;background:#17171a;color:#f4f4f5;' +
        'border:1px solid rgba(168,85,247,.45);border-radius:14px;padding:14px 14px 12px;' +
        'box-shadow:0 10px 30px rgba(0,0,0,.45);font:14px/1.4 Poppins,-apple-system,sans-serif;';
    tarjeta.innerHTML =
        '<div style="display:flex;gap:10px;align-items:flex-start">' +
        '<div style="font-size:22px;line-height:1">🔔</div>' +
        '<div style="flex:1"><div class="t"></div>' +
        '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
        (boton ? '<button type="button" class="si" style="background:linear-gradient(135deg,#d946ef,#8b5cf6);color:#fff;border:0;' +
                 'border-radius:10px;padding:8px 14px;font-weight:600;cursor:pointer"></button>' : '') +
        '<button type="button" class="no" style="background:transparent;color:#a1a1aa;border:1px solid ' +
        '#3f3f46;border-radius:10px;padding:8px 14px;cursor:pointer">Ahora no</button>' +
        '</div></div></div>';
    tarjeta.querySelector('.t').textContent = texto;
    const cerrar = () => tarjeta.remove();
    tarjeta.querySelector('.no').onclick = () => {
        try { localStorage.setItem(CLAVE_TARJETA, String(Date.now())); } catch (e) { /* da igual */ }
        cerrar();
    };
    if (boton) {
        const si = tarjeta.querySelector('.si');
        si.textContent = boton;
        si.onclick = async () => {
            si.disabled = true;
            si.textContent = 'Activando…';
            const listo = await alTocar();
            if (listo) { cerrar(); return; }
            tarjeta.querySelector('.t').textContent = Notification.permission === 'denied'
                ? 'El navegador tiene bloqueadas las notificaciones de esta web. ' +
                  'Actívalas en los ajustes del navegador (el candado junto a la dirección).'
                : 'No se pudieron activar. Inténtalo otra vez en un momento.';
            si.remove();
        };
    }
    document.body.appendChild(tarjeta);
}

/* Al abrir cualquier página con sesión: deja este teléfono listo para
   recibir los mensajes del chat. */
async function prepararAvisos() {
    const quien = sesion();
    if (!quien) return;

    if (!soportado()) {
        if (esIphone() && !instalada() && !tarjetaCerradaHacePoco()) {
            pintarTarjeta('Para que te lleguen los mensajes del chat con el teléfono bloqueado, ' +
                          'instala esta web: toca Compartir (el cuadrado con la flecha) y luego ' +
                          '«Agregar a inicio». Después ábrela desde ese ícono.', '', null);
        }
        return;
    }

    if (Notification.permission === 'granted') {
        // Ya dio permiso: se renueva sin preguntar (por si se borraron los
        // datos, cambiaron las llaves o entró otra persona). Como mucho cada
        // 12 horas por cuenta, para no escribir en la base en cada página.
        const marca = 'avisos_renovados_' + (quien.rutas === RUTAS_PERSONAL ? 'personal' : 'modelo');
        const huella = quien.token.slice(0, 12);
        let anterior = '';
        try { anterior = localStorage.getItem(marca) || ''; } catch (e) { /* da igual */ }
        const [token, cuando] = anterior.split('|');
        const trabajador = await registrarTrabajador();
        const tiene = trabajador && await trabajador.pushManager.getSubscription();
        if (tiene && token === huella && Date.now() - Number(cuando || 0) < 12 * 3600 * 1000) return;
        if (await activar(quien.token, quien.rutas.suscribir)) {
            try { localStorage.setItem(marca, huella + '|' + Date.now()); } catch (e) { /* da igual */ }
        }
        return;
    }
    if (Notification.permission === 'default' && !tarjetaCerradaHacePoco()) {
        pintarTarjeta('Activa los avisos para que te lleguen los mensajes del chat al ' +
                      'instante, aunque tengas el teléfono bloqueado.',
                      'Activar avisos', () => activar(quien.token, quien.rutas.suscribir));
    }
}

// Se registra al cargar cualquier página: así la aplicación ya es
// «instalable» y el aviso puede llegar aunque hoy no abra el chat.
if (soportado()) registrarTrabajador();
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepararAvisos);
else prepararAvisos();

return { soportado, activar, desactivar, salir, estaActivo, registrarTrabajador,
         RUTAS_MODELO, RUTAS_PERSONAL };
})();
