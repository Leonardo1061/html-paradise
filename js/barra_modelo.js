/* ===========================================================================
 * PARADISE · La barra de la modelo: cabecera fija, 💬 burbuja del chat,
 *            🎫 TICKET CEO, 📤 SUBIR CONTENIDO y 💳 MIS PAGOS
 * ===========================================================================
 *
 * Va en TODAS las páginas de la modelo (panel, chat, plan, fotografía y
 * turnos), al final del <body> y después de config.js, push.js y adjuntos.js:
 *
 *     <script src="js/barra_modelo.js"></script>
 *
 * CABECERA FIJA (2026-10-08): una franja arriba que no se va con el scroll,
 * igual en las cinco páginas. A la izquierda ▦ INICIO (panel.html); a la
 * derecha 🔔 campana, ⚙️ tuerca y ⏻ salir. Respeta la muesca del iPhone
 * instalado como app (safe-area). Su alto queda en `--bm-arriba`: lo que la
 * página tenga pegado arriba (sticky) usa `top: var(--bm-arriba, 0px)`.
 * INICIO y CHAT ya no van en la barra de abajo.
 *
 * 💬 BURBUJA DEL CHAT: flotante abajo a la derecha, encima de la barra, en
 * todas las páginas menos chat.html. Lleva cuántos mensajes le escribieron
 * desde la última vez que abrió el chat (`chat_visto_hasta`, lo guarda
 * js/chat.js) y lleva al canal del último.
 *
 *   ⚙️ La tuerca (lo que antes era PERFIL en la barra de abajo):
 *        📝 Actualiza tus datos      datos.html (/api/datos)
 *        🔑 Cambiar contraseña       /api/acceso/password
 *        📳 Enviar alerta de prueba  /api/push/prueba (activa los avisos
 *                                    de este teléfono si aún no lo están)
 *        ⏻  Cerrar sesión
 *
 *   🔔 La campana: las CAPACITACIONES y REUNIONES GENERALES del cronograma
 *      (api/actividades.py: /api/cronograma/modelo). Le llegan a TODAS las
 *      modelos; ir es opcional. Suman al globo al programarlas y otra vez 15
 *      minutos antes; abrir la campana las da por vistas. El INICIO las
 *      escucha con el evento `paradise:actividades`.
 *   🔔 Y los tickets al CEO. Uno PENDIENTE se queda en la lista
 *      hasta que el CEO lo responda, pero sin globo rojo: el número sale solo
 *      con las respuestas que la modelo todavía no ha abierto.
 *      Si la página ya tiene su campana (panel.html, turnos.html) se usa esa:
 *      la página escucha el evento `paradise:tickets` y llama a
 *      PARADISE_BARRA.abrirCampana(). Esa campana se muda a la cabecera fija.
 *
 * Y el botón 🎫 TICKET CEO de la barra de abajo (id `nav-ticket`) abre el
 * formulario: asunto, detalle, fotos, videos y PDF. Los archivos se escogen
 * con lo mismo de los chats (js/adjuntos.js): galería, cámara y documento.
 * La foto viaja dos veces: una vista previa pequeña (la ve el CEO en su
 * campana del escritorio y de la web) y el original a Drive. Los videos y
 * los PDF van a Drive. Ver `tickets.py` en la API.
 * Desde 2026-10-12 lleva un «Tipo de solicitud» obligatorio (la lista la
 * maneja el CEO; con «OTRA» el asunto es obligatorio) y cada ticket es una
 * CONVERSACIÓN con el CEO («💬 Conversación»): ella le contesta con texto,
 * foto, video o PDF hasta que el CEO lo finaliza.
 *
 * Y el botón 📤 SUBIR CONTENIDO (id `nav-subir`, entre STATUS ROOM y TICKET
 * CEO) abre la hoja para subir fotos y videos de la galería a su Drive, en
 * PERSONAL/{asunto}. El asunto solo vale si sirve de nombre de carpeta. Ver
 * `contenido.py` en la API: la carpeta llega a MULTIMEDIA del escritorio.
 * Arriba tiene dos pestañas: «📁 Personal» (lo de siempre) y «⚡ Kwiky»
 * (2026-10-15): EXACTAMENTE 5 videos por envío, de hasta 2 GB, a
 * KWIKY VIDEOS/{número siguiente}. Esas no van a MULTIMEDIA: el monitor las
 * sube a Streamate desde SEGUIMIENTO KWIKY de la Admin, una carpeta por día.
 * Desde 2026-10-16, en las dos pestañas: la pantalla no se apaga mientras
 * sube (Wake Lock), un corte de conexión se reintenta solo al volver y al
 * final sale una alerta grande (y notificación si la página no está a la vista).
 *
 * Y 💳 MIS PAGOS (2026-10-26): la barra pone el botón `nav-pagos` a la
 * derecha de TICKET CEO en todas las páginas y lleva a pagos.html (los
 * recibos de nómina, api: nomina_recibos.py). Su «Reportar» abre el ticket
 * con PARADISE_BARRA.abrirNuevo({asunto, detalle, tipo}).
 *
 * Todo el aspecto vive aquí (clases `bm-`), para verse igual en las cinco
 * páginas aunque cada una tenga su hoja de estilos.
 *
 * DATOS PENDIENTES (2026-10-09): la modelo que la Admin creó solo con cédula
 * y jornada entra con `datos_pendientes = '1'` (lo guarda index.html) y
 * cualquier página de la modelo la manda a datos.html hasta que los llene.
 * Así no alcanza a agendarse con la cédula como nombre.
 */

if (localStorage.getItem('token_sesion') && localStorage.getItem('datos_pendientes') === '1') {
    window.location.replace('datos.html');
}

window.PARADISE_BARRA = (function () {
'use strict';

const API = PARADISE.API_URL;
const MAX_FOTOS = 6;                 // los de tickets.py
const MAX_ARCHIVOS = 4;
const TOPE_VISTA = 880000;           // base64; la API acepta 900 000
const CADA_MS = 60000;
const CHAT_CADA_MS = 30000;
const ES_CHAT = /(^|\/)chat(\.html)?$/.test(window.location.pathname);

const estado = {
    tickets: [],
    pendientes: 0,
    nuevas: 0,
    actividades: [],                 // capacitaciones y reuniones que vienen
    extra: null,                     // función -> html que la página pone arriba de la campana
    hoja: null,                      // la hoja abierta: {tipo, pintar, cerrar}
    globo: null,                     // el globo de la campana inyectada (si la hay)
    burbuja: null,                   // la 💬 flotante (no en chat.html)
    chatSinLeer: 0,
    chatCanal: '',                   // canal del último que le escribieron
};

function escapar(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function token() { return localStorage.getItem('token_sesion') || ''; }

function salirPorSesion() {
    PARADISE.olvidar('token_sesion');
    avisar('Tu sesión caducó. Entra otra vez.', 'malo');
    setTimeout(() => { window.location.href = PARADISE.URL_LOGIN; }, 1500);
}

async function pedir(ruta, metodo, cuerpo) {
    const respuesta = await fetch(API + ruta, {
        method: metodo || 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
        cache: 'no-store',
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    let datos = {};
    try { datos = await respuesta.json(); } catch (e) { datos = {}; }
    if (respuesta.status === 401) { salirPorSesion(); throw new Error('Tu sesión caducó.'); }
    if (!respuesta.ok) throw new Error(datos.detail || 'No se pudo completar la acción.');
    return datos;
}

/* Con barra de progreso: un video tarda en subir y fetch no la da.
   Un error con `red = true` es de conexión (o del servidor despertando): ese
   se puede reintentar solo. Si el envío se queda quieto (el teléfono durmió
   la página y la conexión quedó colgada) se corta para reintentarlo. */
const QUIETO_MS = 120000;
function subir(ruta, formulario, alAvanzar) {
    return new Promise((resolver, rechazar) => {
        const xhr = new XMLHttpRequest();
        let ultimo = Date.now();
        let enviado = false;         // ya subió todo: ahora el servidor lo pasa a Drive
        let cortado = false;
        let volvio = false;          // acaba de volver a la vista
        const deRed = (texto) => { const e = new Error(texto); e.red = true; return e; };
        const revisar = () => {
            if (enviado || cortado) return;
            const quieto = Date.now() - ultimo;
            if (quieto > QUIETO_MS || (document.visibilityState === 'visible' && quieto > 20000 && volvio)) {
                cortado = true;
                xhr.abort();
            }
            volvio = false;
        };
        const alVolver = () => { if (document.visibilityState === 'visible') { volvio = true; revisar(); } };
        const reloj = setInterval(revisar, 10000);
        document.addEventListener('visibilitychange', alVolver);
        const terminar = () => { clearInterval(reloj); document.removeEventListener('visibilitychange', alVolver); };
        xhr.open('POST', API + ruta);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token());
        xhr.upload.onprogress = (e) => {
            ultimo = Date.now();
            if (e.lengthComputable) alAvanzar(e.loaded / e.total);
        };
        xhr.upload.onload = () => { enviado = true; };
        xhr.onload = () => {
            terminar();
            let datos = {};
            try { datos = JSON.parse(xhr.responseText); } catch (e) { datos = {}; }
            if (xhr.status === 401) { salirPorSesion(); rechazar(new Error('Tu sesión caducó.')); return; }
            if (xhr.status >= 200 && xhr.status < 300) resolver(datos);
            else if (xhr.status === 502 || xhr.status === 503 || xhr.status === 504) {
                rechazar(deRed('El servidor no respondió. Inténtalo otra vez.'));
            } else rechazar(new Error(datos.detail || 'No se pudo enviar. Inténtalo otra vez.'));
        };
        xhr.onerror = () => { terminar(); rechazar(deRed('Se cortó la conexión. Inténtalo otra vez.')); };
        xhr.onabort = () => { terminar(); rechazar(deRed('La subida se quedó quieta. Inténtalo otra vez.')); };
        xhr.send(formulario);
    });
}

// -----------------------------------------------------------------------
// Subidas largas en el teléfono (2026-10-16)
// -----------------------------------------------------------------------
// Una página no puede seguir subiendo con la pantalla apagada de forma
// segura: el teléfono la duerme (en iPhone casi enseguida). Por eso:
//   · mientras sube, se pide que la pantalla NO se apague (Wake Lock);
//   · si la conexión se corta, se espera a que vuelva la página y la red y
//     se reintenta solo ese archivo, sin que ella toque nada;
//   · al terminar sale una alerta grande, vibra y, si la página no está a la
//     vista, llega una notificación (si dio permiso de avisos).
const REINTENTOS = 6;
let pantalla = null;                 // el Wake Lock activo
let quiereDespierta = false;

async function pedirPantalla() {
    if (!quiereDespierta || pantalla || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
    try {
        pantalla = await navigator.wakeLock.request('screen');
        pantalla.addEventListener('release', () => { pantalla = null; });
    } catch (e) { pantalla = null; }
}

function mantenerDespierta(si) {
    quiereDespierta = si;
    if (si) pedirPantalla();
    else if (pantalla) { pantalla.release().catch(() => {}); pantalla = null; }
}

// Al volver a la página el navegador suelta el Wake Lock: se pide otra vez.
document.addEventListener('visibilitychange', () => { if (quiereDespierta) pedirPantalla(); });

function esperarConexion(pausa) {
    return new Promise((listo) => {
        const revisar = () => {
            if (document.visibilityState === 'visible' && navigator.onLine !== false) {
                document.removeEventListener('visibilitychange', revisar);
                window.removeEventListener('online', revisar);
                setTimeout(listo, pausa);
            }
        };
        document.addEventListener('visibilitychange', revisar);
        window.addEventListener('online', revisar);
        revisar();
    });
}

/* `subir` con reintentos solos ante cortes de conexión. `yaLlego` (opcional)
   pregunta a la API si el archivo sí quedó guardado antes del corte, para no
   mandarlo dos veces. `alReintentar(n)` deja poner el aviso en la hoja. */
async function subirConReintento(ruta, formulario, alAvanzar, yaLlego, alReintentar) {
    for (let intento = 1; ; intento++) {
        try {
            return await subir(ruta, formulario, alAvanzar);
        } catch (error) {
            if (!error.red || intento >= REINTENTOS) throw error;
            if (alReintentar) alReintentar(intento);
            await esperarConexion(Math.min(30000, 2000 * intento * intento));
            if (yaLlego) {
                try { if (await yaLlego()) return {}; } catch (e) { /* se reintenta igual */ }
            }
        }
    }
}

async function notificarFin(titulo, cuerpo) {
    if (!('Notification' in window) || Notification.permission !== 'granted' || !('serviceWorker' in navigator)) return;
    try {
        const registro = await navigator.serviceWorker.getRegistration();
        if (!registro) return;
        await registro.showNotification(titulo, {
            body: cuerpo, icon: 'iconos/icono-192.png', badge: 'iconos/icono-192.png',
            tag: 'paradise-subida', renotify: true, requireInteraction: true,
            vibrate: [300, 150, 300], data: { url: window.location.pathname.split('/').pop() || 'panel.html' },
        });
    } catch (e) { /* la alerta grande ya está en la página */ }
}

/* La alerta grande del final, encima de todo. `bien` la pinta verde. */
function alertaFinal(bien, titulo, cuerpo) {
    estilos();
    const capa = document.createElement('div');
    capa.className = 'bm-final';
    capa.innerHTML = '<div class="caja ' + (bien ? 'bien' : 'mal') + '">' +
        '<div class="icono">' + (bien ? '✅' : '⚠️') + '</div><h2></h2><p></p>' +
        '<button class="bm-principal">Entendido</button></div>';
    capa.querySelector('h2').textContent = titulo;
    capa.querySelector('p').textContent = cuerpo;
    const tituloPagina = document.title;
    document.title = (bien ? '✅ ' : '⚠️ ') + titulo;
    capa.querySelector('button').onclick = () => { capa.remove(); document.title = tituloPagina; };
    document.body.appendChild(capa);
    try { if (navigator.vibrate) navigator.vibrate(bien ? [200, 100, 200] : [500, 150, 500]); } catch (e) { /* nada */ }
    if (document.visibilityState !== 'visible') notificarFin((bien ? '✅ ' : '⚠️ ') + titulo, cuerpo);
}

/* Mientras sube: pantalla encendida, aviso para no salir y franja en la hoja. */
function modoSubida(hoja, si) {
    mantenerDespierta(si);
    let franja = hoja.cuerpo.querySelector('.bm-no-salgas');
    if (si && !franja) {
        franja = document.createElement('div');
        franja.className = 'bm-no-salgas';
        franja.textContent = '🔆 No salgas de esta pantalla ni la bloquees hasta que termine. ' +
            'Si se corta la conexión, la subida sigue sola cuando vuelvas.';
        hoja.cuerpo.prepend(franja);
    } else if (!si && franja) franja.remove();
}

let avisoActual = null;
function avisar(mensaje, tipo) {
    if (avisoActual) avisoActual.remove();
    const caja = document.createElement('div');
    caja.className = 'bm-aviso ' + (tipo || '');
    caja.textContent = mensaje;
    document.body.appendChild(caja);
    avisoActual = caja;
    setTimeout(() => { if (caja === avisoActual) { caja.remove(); avisoActual = null; } },
               tipo === 'malo' ? 6000 : 3500);
}

// =======================================================================
// ESTILOS
// =======================================================================
function estilos() {
    if (document.getElementById('bm-estilos')) return;
    const css = document.createElement('style');
    css.id = 'bm-estilos';
    css.textContent = `
/* Seis botones abajo (con 💳 MIS PAGOS): en el teléfono el texto va en dos líneas. */
.navegacion.bm-nav6 button { white-space: normal; line-height: 1.15; text-align: center; padding-left: 1px; padding-right: 1px; }
@media (min-width: 760px) { .navegacion.bm-nav6 { width: 600px; } .navegacion.bm-nav6 button { white-space: nowrap; } }
.bm-redondo {
    width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center;
    background: #1b1a22; border: 1px solid #2a2932; color: #f4f4f5; font-size: 17px;
    position: relative; cursor: pointer; font-family: inherit; padding: 0; flex: none;
}
.bm-globo {
    position: absolute; top: -5px; right: -5px; min-width: 19px; height: 19px;
    border-radius: 999px; background: #ef4444; color: #fff; font-size: 11px; font-weight: 700;
    display: grid; place-items: center; padding: 0 5px; border: 2px solid #0a0a0b;
}
.bm-oculto { display: none !important; }
/* Los nombres largos de abajo (STATUS ROOM, SUBIR CONTENIDO) bajan a dos
   renglones en vez de montarse sobre el vecino. */
.navegacion button { white-space: normal !important; line-height: 1.1; text-align: center; }
:root { --bm-arriba: calc(56px + env(safe-area-inset-top)); }
body.bm-con-arriba { padding-top: var(--bm-arriba); }
/* Que lo último de la página pueda subir por encima de la burbuja. */
body.bm-con-burbuja { padding-bottom: calc(165px + env(safe-area-inset-bottom)) !important; }
.bm-arriba {
    position: fixed; top: 0; left: 0; right: 0; z-index: 35; height: var(--bm-arriba);
    padding: env(safe-area-inset-top) max(14px, env(safe-area-inset-right)) 0 max(14px, env(safe-area-inset-left));
    display: flex; align-items: center; gap: 8px;
    background: rgba(10,10,11,.94); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid #2a2932; font-family: 'Poppins', -apple-system, 'Segoe UI', sans-serif;
}
.bm-arriba .bm-derecha { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.bm-inicio {
    height: 40px; border-radius: 13px; border: 0; padding: 0 13px; display: flex; align-items: center; gap: 7px;
    background: #1b1a22; box-shadow: inset 0 0 0 1px #2a2932; color: #f4f4f5;
    font: 600 12px/1 'Poppins', -apple-system, 'Segoe UI', sans-serif; letter-spacing: .3px; cursor: pointer;
}
.bm-inicio span { font-size: 17px; }
.bm-inicio.activo { background: linear-gradient(90deg, #d946ef 0%, #8b5cf6 100%); box-shadow: 0 8px 20px rgba(168,85,247,.3); }
.bm-burbuja {
    position: fixed; z-index: 34; right: max(16px, env(safe-area-inset-right));
    bottom: calc(96px + env(safe-area-inset-bottom));
    width: 54px; height: 54px; border-radius: 50%; border: 0; display: grid; place-items: center;
    background: linear-gradient(135deg, #d946ef 0%, #8b5cf6 100%); color: #fff; font-size: 24px;
    box-shadow: 0 12px 28px rgba(139,92,246,.5); cursor: pointer; padding: 0;
}
.bm-burbuja .bm-globo { top: -3px; right: -3px; }
@media (min-width: 760px) { .bm-burbuja { right: calc(50% - 250px); } }
/* Donde ya hay una caja de chat abajo o manda la barra de guardar, estorba. */
body.guardando .bm-burbuja, body:has(#vista-chat:not(.oculto)) .bm-burbuja { display: none; }
.bm-velo { position: fixed; inset: 0; background: rgba(0,0,0,.66); backdrop-filter: blur(3px); z-index: 2000; }
.bm-hoja {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 2001; background: #141318; color: #f4f4f5;
    border-top: 1px solid #2a2932; border-radius: 22px 22px 0 0; max-height: 92vh;
    display: flex; flex-direction: column; font-family: 'Poppins', -apple-system, 'Segoe UI', sans-serif;
}
@media (min-width: 760px) { .bm-hoja { left: 50%; transform: translateX(-50%); width: 480px; } }
.bm-cabecera { padding: 16px; border-bottom: 1px solid #2a2932; display: flex; gap: 10px; align-items: center; }
.bm-cabecera h3 { margin: 0; font-size: 17px; flex: 1; }
.bm-cerrar { background: none; border: 0; color: #9b9ba3; font-size: 22px; padding: 4px 6px; cursor: pointer; }
.bm-cuerpo { padding: 16px; overflow-y: auto; }
.bm-opcion {
    width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; cursor: pointer;
    background: #1b1a22; border: 1px solid #2a2932; color: #f4f4f5; border-radius: 14px;
    padding: 14px; font-size: 15px; font-family: inherit; margin-bottom: 10px;
}
.bm-opcion .icono { font-size: 20px; width: 26px; text-align: center; }
.bm-opcion small { display: block; color: #9b9ba3; font-size: 12px; margin-top: 2px; }
.bm-campo { margin-bottom: 14px; }
.bm-campo label { display: block; font-size: 12px; color: #9b9ba3; margin-bottom: 6px; }
.bm-campo input, .bm-campo textarea {
    width: 100%; box-sizing: border-box; background: #1b1a22; border: 1px solid #2a2932;
    border-radius: 12px; padding: 12px 13px; color: #f4f4f5; font-size: 15px; font-family: inherit;
}
.bm-campo textarea { min-height: 96px; resize: vertical; }
.bm-campo select {
    width: 100%; box-sizing: border-box; background: #1b1a22; border: 1px solid #2a2932;
    border-radius: 12px; padding: 12px 13px; color: #f4f4f5; font-size: 15px; font-family: inherit;
}
.bm-conv { display: flex; flex-direction: column; gap: 8px; }
.bm-msj { max-width: 85%; align-self: flex-start; background: #1b1a22; border: 1px solid #2a2932;
    border-radius: 14px 14px 14px 4px; padding: 9px 12px; font-size: 14px; line-height: 1.45; }
.bm-msj.mio { align-self: flex-end; border-radius: 14px 14px 4px 14px; border-color: rgba(217,70,239,.45); }
.bm-msj .quien { font-size: 11.5px; color: #9b9ba3; margin-bottom: 3px; }
.bm-msj .txt { white-space: pre-wrap; word-break: break-word; }
.bm-msj img { max-width: 220px; max-height: 220px; border-radius: 10px; display: block; margin-top: 6px; cursor: zoom-in; }
.bm-msj .bm-secundario { margin-top: 6px; }
.bm-escribir { border-top: 1px solid #2a2932; padding: 10px 12px 14px; }
.bm-escribir .fila { display: flex; gap: 8px; align-items: flex-end; }
.bm-escribir textarea { flex: 1; min-width: 0; min-height: 52px; max-height: 40vh; resize: vertical;
    background: #1b1a22; border: 1px solid #2a2932; border-radius: 12px; padding: 9px 11px;
    color: #f4f4f5; font: inherit; font-size: 14px; }
.bm-escribir .bm-principal { width: auto; padding: 12px 16px; }
.bm-fin { text-align: center; color: #9b9ba3; font-size: 13px; padding: 12px 6px; }
.bm-campo input.bm-invalido { border-color: rgba(239,68,68,.7); }
.bm-motivo { font-size: 12px; color: #fca5a5; margin-top: 6px; }
.bm-motivo:empty { display: none; }
.bm-sugerencias { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; align-items: center; }
.bm-sugerencias small { color: #9b9ba3; font-size: 12px; }
.bm-sugerencias .bm-secundario { padding: 6px 10px; font-size: 12px; }
.s-lista { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.bm-subida {
    display: flex; align-items: center; gap: 8px; background: #1b1a22; border: 1px solid #2a2932;
    border-radius: 10px; padding: 6px 8px; font-size: 12px; color: #d4d4d8;
}
.bm-subida img { width: 40px; height: 40px; object-fit: cover; border-radius: 7px; flex: none; }
.bm-subida .tipo { width: 40px; text-align: center; font-size: 20px; flex: none; }
.bm-subida .nombre { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bm-subida .peso { color: #9b9ba3; flex: none; }
.bm-subida button { background: none; border: 0; color: #9b9ba3; cursor: pointer; font-size: 14px; flex: none; }
.bm-subida.hecho { border-color: rgba(52,211,153,.4); }
.bm-subida.error { border-color: rgba(239,68,68,.55); }
.bm-subida.error .nombre { white-space: normal; }
.bm-subida.subiendo { border-color: rgba(139,92,246,.6); }
.bm-pestanas { display: flex; gap: 6px; margin-bottom: 14px; background: #1b1a22;
    border: 1px solid #2a2932; border-radius: 12px; padding: 4px; }
.bm-pestanas button { flex: 1; background: none; border: 0; color: #9b9ba3; border-radius: 9px;
    padding: 9px 6px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; }
.bm-pestanas button.activa { background: linear-gradient(90deg, #d946ef 0%, #8b5cf6 100%); color: #fff; }
.bm-kwiky-info { background: #1b1a22; border: 1px solid rgba(139,92,246,.45); border-radius: 12px;
    padding: 11px 13px; font-size: 13.5px; line-height: 1.45; margin-bottom: 14px; }
.bm-kwiky-info b { color: #e9d5ff; }
.bm-principal {
    width: 100%; background: linear-gradient(90deg, #d946ef 0%, #8b5cf6 100%); border: 0; color: #fff;
    font-weight: 600; border-radius: 12px; padding: 14px; font-size: 15px; font-family: inherit; cursor: pointer;
}
.bm-principal:disabled { opacity: .6; }
.bm-secundario {
    background: #1b1a22; border: 1px solid #2a2932; color: #d4d4d8; border-radius: 11px;
    padding: 9px 12px; font-size: 13px; font-family: inherit; cursor: pointer;
}
.bm-fila { display: flex; gap: 8px; flex-wrap: wrap; }
.bm-nota { font-size: 12px; color: #6b6b73; line-height: 1.5; margin-top: 10px; }
.bm-adjuntos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.bm-chip {
    display: flex; align-items: center; gap: 6px; background: #1b1a22; border: 1px solid #2a2932;
    border-radius: 10px; padding: 6px 8px; font-size: 12px; color: #d4d4d8; max-width: 100%;
}
.bm-chip img { width: 44px; height: 44px; object-fit: cover; border-radius: 7px; }
.bm-chip button { background: none; border: 0; color: #9b9ba3; cursor: pointer; font-size: 14px; }
.bm-progreso { height: 6px; background: #1b1a22; border-radius: 99px; overflow: hidden; margin: 10px 0; }
.bm-progreso div { height: 100%; width: 0; background: linear-gradient(90deg, #d946ef, #8b5cf6); transition: width .2s; }
.bm-ticket {
    background: #1b1a22; border: 1px solid #2a2932; border-radius: 14px; padding: 13px; margin-bottom: 10px;
    border-left: 4px solid #fbbf24;
}
.bm-ticket.respondido { border-left-color: #34d399; }
.bm-ticket.cerrado { border-left-color: #6b6b73; }
.bm-ticket.nuevo { box-shadow: 0 0 0 1px rgba(52,211,153,.5); }
.bm-ticket .cabeza { display: flex; gap: 8px; align-items: flex-start; }
.bm-ticket .asunto { font-weight: 600; font-size: 15px; flex: 1; }
.bm-ticket .meta { font-size: 12px; color: #9b9ba3; margin-top: 3px; }
.bm-ticket .detalle { font-size: 13px; margin-top: 8px; white-space: pre-wrap; color: #d4d4d8; }
.bm-ticket .respuesta {
    margin-top: 10px; background: rgba(52,211,153,.08); border: 1px solid rgba(52,211,153,.3);
    border-radius: 11px; padding: 10px 12px; font-size: 14px; white-space: pre-wrap;
}
.bm-ticket .respuesta b { display: block; font-size: 11px; color: #6ee7b7; margin-bottom: 4px; letter-spacing: .5px; }
.bm-pildora { font-size: 11px; border-radius: 99px; padding: 3px 9px; background: rgba(251,191,36,.15); color: #fde68a; white-space: nowrap; }
.bm-pildora.respondido { background: rgba(52,211,153,.15); color: #6ee7b7; }
.bm-pildora.cerrado { background: rgba(155,155,163,.15); color: #d4d4d8; }
.bm-miniaturas { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.bm-miniaturas img { width: 64px; height: 64px; object-fit: cover; border-radius: 9px; cursor: pointer; }
.bm-extra { margin-bottom: 14px; font-size: 13px; line-height: 1.45; color: #d4d4d8;
    background: #1b1a22; border: 1px solid #2a2932; border-radius: 12px; padding: 11px 13px; }
.bm-vacio { text-align: center; color: #6b6b73; padding: 26px 0; font-size: 14px; }
.bm-visor { position: fixed; inset: 0; z-index: 2010; background: rgba(0,0,0,.92); display: grid; place-items: center; }
.bm-visor img { max-width: 96vw; max-height: 92vh; border-radius: 10px; }
.bm-aviso {
    position: fixed; left: 16px; right: 16px; bottom: 100px; z-index: 10000; background: #1b1a22; color: #f4f4f5;
    border: 1px solid #2a2932; border-radius: 14px; padding: 13px 15px; font-size: 14px; line-height: 1.4;
    box-shadow: 0 16px 40px rgba(0,0,0,.6); font-family: 'Poppins', -apple-system, 'Segoe UI', sans-serif;
}
.bm-aviso.malo { border-color: rgba(239,68,68,.55); }
.bm-aviso.bueno { border-color: rgba(52,211,153,.5); }
@media (min-width: 760px) { .bm-aviso { left: 50%; transform: translateX(-50%); width: 460px; } }
.bm-no-salgas { background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.45); color: #fde68a;
    border-radius: 12px; padding: 10px 12px; font-size: 13px; line-height: 1.45; margin-bottom: 12px; }
.bm-final { position: fixed; inset: 0; z-index: 10001; background: rgba(0,0,0,.8); backdrop-filter: blur(4px);
    display: grid; place-items: center; padding: 20px; font-family: 'Poppins', -apple-system, 'Segoe UI', sans-serif; }
.bm-final .caja { width: 100%; max-width: 400px; background: #141318; color: #f4f4f5; border-radius: 22px;
    padding: 28px 22px 22px; text-align: center; border: 2px solid rgba(52,211,153,.6);
    box-shadow: 0 24px 60px rgba(0,0,0,.6); }
.bm-final .caja.mal { border-color: rgba(239,68,68,.65); }
.bm-final .icono { font-size: 64px; line-height: 1; }
.bm-final h2 { margin: 14px 0 8px; font-size: 22px; }
.bm-final p { margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #d4d4d8; white-space: pre-line; }
.chat-camara {
    position: fixed; inset: 0; z-index: 2020; background: #000;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; padding: 16px;
}
.chat-camara video { max-width: 100%; max-height: calc(100% - 110px); border-radius: 12px; background: #111; }
.botones-camara { display: flex; align-items: center; gap: 28px; }
.botones-camara .cancelar { width: 46px; height: 46px; border-radius: 50%; border: 0; background: rgba(255,255,255,.15); color: #fff; font-size: 18px; cursor: pointer; }
.botones-camara .disparar { width: 70px; height: 70px; border-radius: 50%; border: 5px solid #fff; background: rgba(255,255,255,.25); cursor: pointer; }
`;
    document.head.appendChild(css);
}

// =======================================================================
// LA HOJA (una a la vez)
// =======================================================================
function abrirHoja(tipo, titulo) {
    cerrarHoja();
    const capa = document.createElement('div');
    capa.innerHTML = '<div class="bm-velo"></div><div class="bm-hoja">' +
        '<div class="bm-cabecera"><h3>' + titulo + '</h3><button class="bm-cerrar" title="Cerrar">✕</button></div>' +
        '<div class="bm-cuerpo"></div></div>';
    document.body.appendChild(capa);
    const hoja = { tipo: tipo, capa: capa, cuerpo: capa.querySelector('.bm-cuerpo'), pintar: null };
    hoja.cerrar = () => { capa.remove(); if (estado.hoja === hoja) estado.hoja = null; };
    capa.querySelector('.bm-velo').onclick = hoja.cerrar;
    capa.querySelector('.bm-cerrar').onclick = hoja.cerrar;
    estado.hoja = hoja;
    return hoja;
}

function cerrarHoja() { if (estado.hoja) estado.hoja.cerrar(); }

function abrirVisor(src) {
    const visor = document.createElement('div');
    visor.className = 'bm-visor';
    visor.innerHTML = '<img alt="">';
    visor.querySelector('img').src = src;
    visor.onclick = () => visor.remove();
    document.body.appendChild(visor);
}

// =======================================================================
// ⚙️ LA TUERCA
// =======================================================================
function abrirTuerca() {
    const hoja = abrirHoja('tuerca', '⚙️ Ajustes');
    hoja.cuerpo.innerHTML =
        '<button class="bm-opcion" data-op="datos"><span class="icono">📝</span>' +
            '<span>Actualiza tus datos<small>Nombre, correo, celular, foto y cédula</small></span></button>' +
        '<button class="bm-opcion" data-op="clave"><span class="icono">🔑</span>' +
            '<span>Cambiar contraseña<small>La misma del programa de escritorio</small></span></button>' +
        '<button class="bm-opcion" data-op="prueba"><span class="icono">📳</span>' +
            '<span>Enviar alerta de prueba<small>Para comprobar que los avisos llegan a este teléfono</small></span></button>' +
        '<button class="bm-opcion" data-op="salir"><span class="icono">⏻</span><span>Cerrar sesión</span></button>';
    hoja.cuerpo.querySelector('[data-op="datos"]').onclick = () => { window.location.href = 'datos.html'; };
    hoja.cuerpo.querySelector('[data-op="clave"]').onclick = cambiarClave;
    hoja.cuerpo.querySelector('[data-op="prueba"]').onclick = alertaDePrueba;
    hoja.cuerpo.querySelector('[data-op="salir"]').onclick = salir;
}

function cambiarClave() {
    const hoja = abrirHoja('clave', '🔑 Cambiar contraseña');
    hoja.cuerpo.innerHTML =
        '<div class="bm-campo"><label>Contraseña actual</label><input type="password" class="c-actual" autocomplete="current-password"></div>' +
        '<div class="bm-campo"><label>Contraseña nueva</label><input type="password" class="c-nueva" autocomplete="new-password"></div>' +
        '<div class="bm-campo"><label>Repite la nueva</label><input type="password" class="c-repetida" autocomplete="new-password"></div>' +
        '<button class="bm-principal c-guardar">Guardar</button>' +
        '<p class="bm-nota">Si la olvidas, tu monitor puede devolvértela a los últimos 4 dígitos de tu cédula. ' +
        'Es la misma contraseña del programa de escritorio.</p>';
    const $ = (s) => hoja.cuerpo.querySelector(s);
    $('.c-guardar').onclick = async () => {
        $('.c-guardar').disabled = true;
        try {
            await pedir('/api/acceso/password', 'POST', {
                actual: $('.c-actual').value.trim(), nueva: $('.c-nueva').value.trim(),
                repetida: $('.c-repetida').value.trim(),
            });
            localStorage.removeItem('password_por_defecto');
            hoja.cerrar();
            avisar('Contraseña actualizada. Úsala también en el programa de escritorio.', 'bueno');
            document.dispatchEvent(new CustomEvent('paradise:clave'));
        } catch (error) {
            avisar(error.message, 'malo');
            $('.c-guardar').disabled = false;
        }
    };
    $('.c-actual').focus();
}

async function alertaDePrueba() {
    cerrarHoja();
    const P = window.PARADISE_PUSH;
    if (!P || !P.soportado()) {
        avisar('Este navegador no admite avisos. En iPhone, instala la web en la pantalla de inicio.', 'malo');
        return;
    }
    try {
        if (!(await P.estaActivo())) {
            const listo = await P.activar(token());
            if (!listo) {
                avisar('No se pudieron activar los avisos. Revisa que el navegador tenga permiso ' +
                       'para enviarte notificaciones.', 'malo');
                return;
            }
        }
        await pedir('/api/push/prueba', 'POST', {});
        avisar('Te la acabo de mandar. Debería llegarte en unos segundos.', 'bueno');
    } catch (error) {
        avisar(error.message, 'malo');
    }
}

async function salir() {
    // La sesión no caduca: solo esto la cierra (y deja de avisar aquí).
    if (window.PARADISE_PUSH) { try { await PARADISE_PUSH.salir(false); } catch (e) { /* da igual */ } }
    ['token_sesion', 'modelo_actual', 'jornada_actual', 'password_por_defecto', 'datos_pendientes']
        .forEach((clave) => PARADISE.olvidar(clave));
    window.location.href = PARADISE.URL_LOGIN;
}

// =======================================================================
// 🔔 LA CAMPANA: los tickets
// =======================================================================
// El globo rojo sale SOLO cuando el CEO ya respondió y ella no lo ha visto.
// Los pendientes se ven al abrir la campana, sin número encima.
function actividadSuena(a) { return a.nuevo || a.pronto; }
function cuenta() { return estado.nuevas + estado.actividades.filter(actividadSuena).length; }

async function revisarActividades(forzar) {
    try {
        const datos = await pedir('/api/cronograma/modelo');
        const antes = new Set(estado.actividades.filter(actividadSuena).map((a) => a.id + (a.pronto ? 'p' : '')));
        estado.actividades = datos.actividades || [];
        const recien = estado.actividades.filter(actividadSuena).filter((a) => !antes.has(a.id + (a.pronto ? 'p' : '')));
        if (recien.length && forzar !== true) {
            const a = recien[0];
            avisar((a.pronto ? '⏰ En 15 min: ' : a.icono + ' ') + a.titulo, 'bueno');
        }
        document.dispatchEvent(new CustomEvent('paradise:actividades', { detail: estado.actividades }));
        pintarGlobo();
        if (estado.hoja && estado.hoja.tipo === 'campana') estado.hoja.pintar();
    } catch (error) { /* sin red: en la siguiente vuelta */ }
}

/* Una capacitación o reunión (campana e INICIO). */
function tarjetaActividad(a) {
    const sello = a.pronto ? 'Empieza pronto' : a.nuevo ? 'Nueva' : '';
    return '<div class="bm-ticket' + (actividadSuena(a) ? ' nuevo' : '') + '" style="border-left:4px solid ' + escapar(a.color) + '">' +
        '<div class="cabeza"><div class="asunto">' + escapar(a.icono + ' ' + a.titulo) + '</div>' +
        (sello ? '<span class="bm-pildora respondido">' + sello + '</span>' : '') + '</div>' +
        '<div class="meta">' + escapar(a.cuando) + '</div>' +
        (a.tipo === 'modelos' ? '<div class="meta">Reunión con <b>' + escapar(a.responsable) + '</b>' +
            (a.para_mi ? ' · es para ti' : ' · puedes ir de refuerzo') + '</div>'
            : a.tipo === 'privada' ? '<div class="meta">🔒 Reunión privada con <b>' + escapar(a.responsable) + '</b> · solo para ti</div>'
            : '<div class="meta">Reunión general: todas las modelos y el personal</div>') +
        (a.descripcion ? '<div class="detalle">' + escapar(a.descripcion) + '</div>' : '') +
        (a.meet ? '<div class="bm-fila" style="margin-top:8px"><a class="bm-secundario" target="_blank" rel="noopener" href="' +
            escapar(a.meet) + '">🎥 Entrar a la reunión</a></div>' : '') + '</div>';
}

async function revisar(forzar) {
    if (!token() || (forzar !== true && document.visibilityState !== 'visible')) return;
    try {
        const datos = await pedir('/api/tickets');
        const antes = estado.tickets.filter((t) => t.nuevo).map((t) => t.id);
        estado.tickets = datos.tickets || [];
        estado.pendientes = datos.pendientes || 0;
        estado.nuevas = datos.respuestas_nuevas || 0;
        const recien = estado.tickets.filter((t) => t.nuevo && antes.indexOf(t.id) < 0);
        if (recien.length && forzar !== true) avisar('🎫 El CEO respondió: ' + recien[0].asunto, 'bueno');
        pintarGlobo();
        if (estado.hoja && estado.hoja.tipo === 'campana') estado.hoja.pintar();
    } catch (error) { /* sin red un momento: en la siguiente vuelta */ }
    revisarActividades(forzar);
}

function pintarGlobo() {
    const n = cuenta();
    if (estado.globo) {
        estado.globo.textContent = n > 99 ? '99+' : String(n);
        estado.globo.classList.toggle('bm-oculto', !n);
    }
    document.dispatchEvent(new CustomEvent('paradise:tickets', {
        detail: { pendientes: estado.pendientes, nuevas: estado.nuevas, total: n },
    }));
}

function textoEstado(t) {
    if (t.abierto && t.respuesta) return ['Respondido', 'respondido'];
    if (t.abierto) return t.estado === 'en curso' ? ['En revisión', ''] : ['Pendiente', ''];
    if (t.estado === 'cerrada') return ['Finalizado', 'cerrado'];
    if (t.respuesta) return ['Respondido', 'respondido'];
    return ['Cerrado', 'cerrado'];
}

function tarjeta(t) {
    const [texto, clase] = textoEstado(t);
    const caja = document.createElement('div');
    caja.className = 'bm-ticket ' + clase + (t.nuevo ? ' nuevo' : '');
    caja.innerHTML =
        '<div class="cabeza"><div class="asunto">' + escapar(t.asunto) + '</div>' +
        '<span class="bm-pildora ' + clase + '">' + texto + '</span></div>' +
        '<div class="meta">' + (t.tipo_solicitud ? escapar(t.tipo_solicitud) + ' · ' : '') +
            'Enviado ' + escapar(t.creada || 'ahora') + '</div>' +
        (t.detalle ? '<div class="detalle">' + escapar(t.detalle) + '</div>' : '') +
        (t.respuesta ? '<div class="respuesta"><b>RESPUESTA DEL CEO' +
            (t.respondida ? ' · ' + escapar(t.respondida) : '') + '</b>' + escapar(t.respuesta) + '</div>' : '') +
        (!t.abierto && !t.respuesta ? '<div class="meta">El CEO lo cerró sin escribir respuesta.</div>' : '') +
        '<div class="bm-fila" style="margin-top:10px"></div><div class="bm-miniaturas"></div>';
    const fila = caja.querySelector('.bm-fila');
    // La conversación con el CEO: abierta hasta que él la finaliza.
    if (t.con_conversacion || t.num_respuestas) {
        const b = boton('💬 Conversación' + (t.num_respuestas ? ' (' + t.num_respuestas + ')' : ''));
        b.onclick = () => abrirConversacionTicket(t);
        fila.appendChild(b);
    }
    if (t.num_imagenes) {
        const b = boton('🖼️ ' + t.num_imagenes + (t.num_imagenes === 1 ? ' foto' : ' fotos'));
        b.onclick = async () => {
            b.disabled = true;
            try {
                const datos = await pedir('/api/tickets/' + encodeURIComponent(t.id) + '/imagenes');
                const mini = caja.querySelector('.bm-miniaturas');
                mini.innerHTML = '';
                (datos.imagenes || []).forEach((b64) => {
                    const img = document.createElement('img');
                    img.src = String(b64).indexOf('data:') === 0 ? b64 : 'data:image/jpeg;base64,' + b64;
                    img.onclick = () => abrirVisor(img.src);
                    mini.appendChild(img);
                });
            } catch (error) { avisar(error.message, 'malo'); b.disabled = false; }
        };
        fila.appendChild(b);
    }
    (t.adjuntos || []).forEach((a, i) => {
        const b = boton(a.tipo === 'pdf' ? '📄 ' + (a.titulo || 'Documento') : '🎬 Video');
        b.onclick = () => abrirArchivo(t.id, i, a, b);
        fila.appendChild(b);
    });
    // Ya respondido: lo puede borrar (para ella, el CEO y el personal).
    if (t.puede_eliminar) {
        const b = boton('🗑 Eliminar');
        b.style.color = '#fca5a5';
        b.onclick = () => eliminarTicket(t, b);
        fila.appendChild(b);
    }
    return caja;
}

async function eliminarTicket(t, b) {
    if (!window.confirm('¿Eliminar el ticket «' + (t.asunto || '') + '»?\n\n' +
        'Se borrará para siempre con toda su conversación, también para el CEO.')) return;
    b.disabled = true;
    try {
        await pedir('/api/tickets/' + encodeURIComponent(t.id), 'DELETE');
        estado.tickets = estado.tickets.filter((x) => x.id !== t.id);
        avisar('Ticket eliminado.', 'bueno');
        pintarGlobo();
        if (estado.hoja && estado.hoja.tipo === 'campana') estado.hoja.pintar();
        revisar(true);
    } catch (error) { avisar(error.message, 'malo'); b.disabled = false; }
}

function boton(texto) {
    const b = document.createElement('button');
    b.className = 'bm-secundario';
    b.textContent = texto;
    return b;
}

/* El archivo lo sirve la API desde Drive (la modelo no tiene permiso en
   esa carpeta). La ventana se abre YA, en el toque, o el navegador la bloquea. */
async function abrirArchivo(id, indice, adjunto, b) {
    const ventana = window.open('', '_blank');
    b.disabled = true;
    try {
        const respuesta = await fetch(API + '/api/tickets/' + encodeURIComponent(id) + '/adjunto/' + indice,
                                      { headers: { 'Authorization': 'Bearer ' + token() } });
        if (!respuesta.ok) throw new Error('No se pudo abrir el archivo.');
        const url = URL.createObjectURL(await respuesta.blob());
        if (ventana) ventana.location.href = url; else window.location.href = url;
    } catch (error) {
        if (ventana) ventana.close();
        avisar(error.message, 'malo');
    }
    b.disabled = false;
}

function abrirCampana() {
    const hoja = abrirHoja('campana', '🔔 Avisos');
    hoja.pintar = () => {
        const extra = estado.extra ? estado.extra() : '';
        const agenda = estado.actividades.length
            ? '<b style="display:block;font-size:15px;margin-bottom:10px">🗓️ Capacitaciones y reuniones</b>' +
              estado.actividades.map(tarjetaActividad).join('') + '<div style="height:10px"></div>' : '';
        hoja.cuerpo.innerHTML = (extra ? '<div class="bm-extra">' + extra + '</div>' : '') + agenda +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
            '<b style="flex:1;font-size:15px">🎫 Tus tickets al CEO</b>' +
            '<button class="bm-secundario t-nuevo">＋ Nuevo</button></div><div class="t-lista"></div>';
        hoja.cuerpo.querySelector('.t-nuevo').onclick = abrirNuevo;
        // Abrir la campana da por vistas las capacitaciones y reuniones.
        const vistas = estado.actividades.filter(actividadSuena).map((a) => a.id);
        if (vistas.length) {
            pedir('/api/cronograma/modelo/vistas', 'POST', { ids: vistas }).then(() => {
                estado.actividades.forEach((a) => { if (vistas.indexOf(a.id) >= 0) { a.nuevo = false; a.pronto = false; } });
                pintarGlobo();
            }).catch(() => {});
        }
        const lista = hoja.cuerpo.querySelector('.t-lista');
        if (!estado.tickets.length) {
            lista.innerHTML = '<div class="bm-vacio">No has mandado tickets. Usa 🎫 TICKET CEO ' +
                'para escribirle al CEO.</div>';
            return;
        }
        estado.tickets.forEach((t) => lista.appendChild(tarjeta(t)));
        // Lo respondido se da por visto al abrir la campana.
        const vistos = estado.tickets.filter((t) => t.nuevo).map((t) => t.id);
        if (vistos.length) {
            pedir('/api/tickets/vistos', 'POST', { ids: vistos }).then(() => {
                estado.tickets.forEach((t) => { if (vistos.indexOf(t.id) >= 0) t.nuevo = false; });
                estado.nuevas = 0;
                pintarGlobo();
            }).catch(() => {});
        }
    };
    hoja.pintar();
    revisar(true);
}

// =======================================================================
// 🎫 NUEVO TICKET
// =======================================================================
function abrirNuevo(opciones) {
    // «Reportar» de Mis pagos lo abre con el asunto y el detalle ya escritos.
    const pre = (opciones && !(opciones instanceof Event)) ? opciones : {};
    const A = window.Adjuntos;
    const hoja = abrirHoja('nuevo', '🎫 Ticket al CEO');
    const fotos = [];                // {archivo, vista}
    const archivos = [];             // File (video o PDF)
    hoja.cuerpo.innerHTML =
        '<div class="bm-campo"><label>Tipo de solicitud</label><select class="t-tipo">' +
            '<option value="">Cargando…</option></select></div>' +
        '<div class="bm-campo"><label class="t-etiqueta-asunto">Asunto (opcional)</label>' +
            '<input class="t-asunto" maxlength="200" ' +
            'placeholder="Ej: Revisión de mi pago de la semana"></div>' +
        '<div class="bm-campo"><label>Cuéntale qué pasa (opcional)</label>' +
            '<textarea class="t-detalle" maxlength="4000"></textarea></div>' +
        '<div class="bm-campo"><label>Adjuntos (opcional): hasta ' + MAX_FOTOS + ' fotos y ' +
            MAX_ARCHIVOS + ' videos o PDF</label>' +
        '<div class="bm-fila"><button class="bm-secundario" data-op="galeria">🖼️ Galería</button>' +
            '<button class="bm-secundario" data-op="camara">📷 Cámara</button>' +
            '<button class="bm-secundario" data-op="documento">📄 Documento</button></div>' +
        '<input type="file" class="bm-oculto" data-entrada="galeria" accept="image/*,video/*" multiple>' +
        '<input type="file" class="bm-oculto" data-entrada="camara" accept="image/*" capture="environment">' +
        '<input type="file" class="bm-oculto" data-entrada="documento" accept="application/pdf,.pdf" multiple>' +
        '<div class="bm-adjuntos"></div></div>' +
        '<div class="bm-progreso bm-oculto"><div></div></div>' +
        '<button class="bm-principal t-enviar">Enviar al CEO</button>' +
        '<p class="bm-nota">Le llega al CEO al momento. El ticket se queda en tu 🔔 campana como ' +
        'pendiente hasta que te responda, y te aviso en el teléfono cuando lo haga.</p>';
    const $ = (s) => hoja.cuerpo.querySelector(s);
    let otra = 'OTRA';
    // La lista la maneja el CEO: se pide cada vez.
    pedir('/api/tickets/tipos').then((datos) => {
        otra = datos.otra || otra;
        $('.t-tipo').innerHTML = '<option value="">Elige el tipo…</option>' +
            (datos.tipos || []).map((t) => '<option>' + escapar(t) + '</option>').join('');
        if (pre.tipo) {
            const tipo = (datos.tipos || []).find((t) => pre.tipo.test(t));
            if (tipo) $('.t-tipo').value = tipo;
            $('.t-tipo').onchange();
        }
    }).catch(() => { $('.t-tipo').innerHTML = '<option value="">No se pudo cargar. Cierra y vuelve a abrir.</option>'; });
    $('.t-tipo').onchange = () => {
        $('.t-etiqueta-asunto').textContent = $('.t-tipo').value === otra ? 'Asunto (obligatorio con «OTRA»)'
            : 'Asunto (opcional)';
    };

    if (pre.asunto) $('.t-asunto').value = pre.asunto;
    if (pre.detalle) $('.t-detalle').value = pre.detalle;

    const pintarAdjuntos = () => {
        const caja = $('.bm-adjuntos');
        caja.innerHTML = '';
        fotos.forEach((f, i) => {
            const chip = document.createElement('div');
            chip.className = 'bm-chip';
            chip.innerHTML = '<img alt=""><button title="Quitar">✕</button>';
            chip.querySelector('img').src = f.vista;
            chip.querySelector('img').onclick = () => abrirVisor(f.vista);
            chip.querySelector('button').onclick = () => { fotos.splice(i, 1); pintarAdjuntos(); };
            caja.appendChild(chip);
        });
        archivos.forEach((a, i) => {
            const chip = document.createElement('div');
            chip.className = 'bm-chip';
            chip.innerHTML = '<span></span><button title="Quitar">✕</button>';
            chip.querySelector('span').textContent = (A.tipoDe(a) === 'pdf' ? '📄 ' : '🎬 ') +
                (a.name || 'archivo') + ' · ' + A.pesoLegible(a.size);
            chip.querySelector('button').onclick = () => { archivos.splice(i, 1); pintarAdjuntos(); };
            caja.appendChild(chip);
        });
    };

    const agregar = async (archivo) => {
        const tipo = A.tipoDe(archivo);
        if (!tipo) { avisar('Solo fotos, videos y PDF.', 'malo'); return; }
        const grande = A.demasiadoGrande(archivo, tipo);
        if (grande) { avisar(grande, 'malo'); return; }
        if (tipo === 'imagen') {
            if (fotos.length >= MAX_FOTOS) { avisar('Como mucho ' + MAX_FOTOS + ' fotos.', 'malo'); return; }
            try {
                fotos.push({ archivo: await A.fotoParaDrive(archivo), vista: await A.comprimir(archivo, TOPE_VISTA) });
            } catch (error) { avisar(error.message, 'malo'); return; }
        } else {
            if (archivos.length >= MAX_ARCHIVOS) { avisar('Como mucho ' + MAX_ARCHIVOS + ' videos o PDF.', 'malo'); return; }
            archivos.push(archivo);
        }
        pintarAdjuntos();
    };

    hoja.cuerpo.querySelectorAll('input[type=file]').forEach((entrada) => {
        entrada.onchange = async () => {
            const lista = Array.from(entrada.files || []);
            entrada.value = '';
            for (const archivo of lista) await agregar(archivo);
        };
    });
    hoja.cuerpo.querySelectorAll('[data-op]').forEach((b) => {
        b.onclick = async () => {
            const op = b.dataset.op;
            const tactil = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
            if (op === 'camara' && !tactil && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const foto = await A.camara();
                if (foto) await agregar(foto);
                return;
            }
            hoja.cuerpo.querySelector('[data-entrada="' + op + '"]').click();
        };
    });

    $('.t-enviar').onclick = async () => {
        const asunto = $('.t-asunto').value.trim();
        const tipo = $('.t-tipo').value;
        if (!tipo) { avisar('Elige el tipo de solicitud.', 'malo'); $('.t-tipo').focus(); return; }
        if (tipo === otra && !asunto) {
            avisar('Con «OTRA», escribe el asunto del ticket.', 'malo'); $('.t-asunto').focus(); return;
        }
        const formulario = new FormData();
        formulario.append('tipo', tipo);
        formulario.append('asunto', asunto);
        formulario.append('detalle', $('.t-detalle').value);
        formulario.append('vistas', JSON.stringify(fotos.map((f) => f.vista)));
        fotos.forEach((f) => formulario.append('fotos', f.archivo, f.archivo.name || 'foto.jpg'));
        archivos.forEach((a) => formulario.append('archivos', a, a.name || 'archivo'));
        const enviar = $('.t-enviar');
        const barra = $('.bm-progreso');
        enviar.disabled = true;
        enviar.textContent = 'Enviando…';
        if (fotos.length || archivos.length) barra.classList.remove('bm-oculto');
        try {
            const r = await subir('/api/tickets', formulario, (p) => {
                barra.firstChild.style.width = Math.round(p * 100) + '%';
                if (p >= 1) enviar.textContent = 'Guardando en Drive…';
            });
            avisar(r.mensaje || 'Ticket enviado al CEO.', 'bueno');
            await revisar(true);
            abrirCampana();
        } catch (error) {
            avisar(error.message, 'malo');
            enviar.disabled = false;
            enviar.textContent = 'Enviar al CEO';
            barra.classList.add('bm-oculto');
        }
    };
    $('.t-tipo').focus();
}

// =======================================================================
// 💬 LA CONVERSACIÓN DE UN TICKET
// =======================================================================
// Mensajes de 20 en 20 (api: /api/tickets/{id}/conversacion). Ella escribe
// texto y/o un archivo (foto, video o PDF) hasta que el CEO lo finaliza.
// Con la hoja abierta, cada 10 s se piden los nuevos.
const CONV_CADA_MS = 10000;

function abrirConversacionTicket(t) {
    const hoja = abrirHoja('conversacion', '💬 ' + escapar(t.asunto || 'Ticket'));
    const ruta = '/api/tickets/' + encodeURIComponent(t.id) + '/conversacion';
    hoja.capa.querySelector('.bm-hoja').style.height = '92vh';
    hoja.cuerpo.style.flex = '1';
    hoja.cuerpo.innerHTML = '<button class="bm-secundario t-volver" style="margin-bottom:10px">← Tus tickets</button>' +
        '<div class="bm-conv"><div class="bm-vacio">Cargando…</div></div>';
    hoja.cuerpo.querySelector('.t-volver').onclick = () => { abrirCampana(); };
    const lista = hoja.cuerpo.querySelector('.bm-conv');
    const pie = document.createElement('div');
    pie.className = 'bm-escribir';
    hoja.capa.querySelector('.bm-hoja').appendChild(pie);
    const est = { mensajes: [], hayMas: false, info: null };

    const archivoUrl = async (m) => {
        const r = await fetch(API + ruta + '/' + encodeURIComponent(m.id) + '/adjunto',
                              { headers: { 'Authorization': 'Bearer ' + token() } });
        if (!r.ok) throw new Error('No se pudo abrir el archivo.');
        return URL.createObjectURL(await r.blob());
    };

    function burbuja(m) {
        const b = document.createElement('div');
        b.className = 'bm-msj' + (m.mio ? ' mio' : '');
        b.innerHTML = '<div class="quien">' + escapar(m.mio ? 'Tú' : m.de) + ' · ' + escapar(m.cuando || '') + '</div>' +
            (m.texto ? '<div class="txt"></div>' : '');
        if (m.texto) b.querySelector('.txt').textContent = m.texto;
        const a = m.adjunto;
        if (a && a.tipo === 'imagen') {
            const img = document.createElement('img');
            b.appendChild(img);
            archivoUrl(m).then((url) => { img.src = url; img.onclick = () => abrirVisor(url); })
                .catch(() => { img.remove(); });
        } else if (a) {
            const boton_ = boton((a.tipo === 'video' ? '🎬 ' : a.tipo === 'pdf' ? '📄 ' : '📎 ') +
                (a.titulo || a.nombre || 'Archivo'));
            boton_.onclick = async () => {
                const ventana = window.open('', '_blank');
                try {
                    const url = await archivoUrl(m);
                    if (ventana) ventana.location.href = url; else window.location.href = url;
                } catch (error) { if (ventana) ventana.close(); avisar(error.message, 'malo'); }
            };
            b.appendChild(boton_);
        }
        return b;
    }

    function pintar(alFinal) {
        lista.innerHTML = '';
        if (est.hayMas) {
            const mas = boton('⬆ Ver anteriores');
            mas.onclick = anteriores;
            lista.appendChild(mas);
        } else {
            const inicio = document.createElement('div');
            inicio.className = 'bm-msj mio';
            inicio.innerHTML = '<div class="quien">Tu ticket · ' + escapar(t.tipo_solicitud || '') + '</div>' +
                '<div class="txt"></div>';
            inicio.querySelector('.txt').textContent = (t.asunto || '') + (t.detalle ? '\n\n' + t.detalle : '');
            lista.appendChild(inicio);
            // Lo que el CEO respondió antes de que existiera la conversación.
            if (!est.mensajes.length && t.respuesta) {
                lista.appendChild(burbuja({ de: 'CEO', texto: t.respuesta, cuando: t.respondida || '' }));
            }
        }
        est.mensajes.forEach((m) => lista.appendChild(burbuja(m)));
        if (est.info && !est.info.puede_escribir) {
            lista.insertAdjacentHTML('beforeend', '<div class="bm-fin">🔒 El CEO finalizó este ticket.</div>');
        }
        if (alFinal) hoja.cuerpo.scrollTop = hoja.cuerpo.scrollHeight;
    }

    function pintarPie() {
        if (!est.info.puede_escribir) { pie.remove(); return; }
        if (pie.querySelector('textarea')) return;
        pie.innerHTML = '<div class="bm-nota t-elegido" style="margin:0 0 6px"></div>' +
            '<div class="fila"><button class="bm-secundario t-adjuntar" title="Foto, video o PDF">📎</button>' +
            '<textarea maxlength="4000" placeholder="Escríbele al CEO"></textarea>' +
            '<button class="bm-principal t-enviar">Enviar</button></div>' +
            '<input type="file" class="bm-oculto" accept="image/*,video/*,application/pdf,.pdf">';
        const entrada = pie.querySelector('input[type=file]');
        const elegido = pie.querySelector('.t-elegido');
        let archivo = null;
        const pintarArchivo = () => { elegido.textContent = archivo ? '📎 ' + archivo.name : ''; };
        pie.querySelector('.t-adjuntar').onclick = () => entrada.click();
        entrada.onchange = () => { archivo = entrada.files[0] || null; entrada.value = ''; pintarArchivo(); };
        const enviar = pie.querySelector('.t-enviar');
        enviar.onclick = async () => {
            const texto = pie.querySelector('textarea');
            if (!texto.value.trim() && !archivo) { avisar('Escribe un mensaje o adjunta un archivo.', 'malo'); return; }
            enviar.disabled = true;
            enviar.textContent = archivo ? 'Subiendo…' : 'Enviando…';
            try {
                const formulario = new FormData();
                formulario.append('texto', texto.value);
                if (archivo) formulario.append('archivo', archivo, archivo.name || 'archivo');
                const r = await subir(ruta, formulario, () => {});
                texto.value = '';
                archivo = null;
                pintarArchivo();
                est.mensajes.push(r.mensaje);
                pintar(true);
            } catch (error) { avisar(error.message, 'malo'); }
            enviar.disabled = false;
            enviar.textContent = 'Enviar';
        };
    }

    async function cargar() {
        const datos = await pedir(ruta);
        if (estado.hoja !== hoja) return;
        const primero = datos.mensajes.length ? datos.mensajes[0].ts : '';
        const viejos = primero ? est.mensajes.filter((m) => m.ts && m.ts < primero) : [];
        const antes = est.mensajes.map((m) => m.id).join(',');
        est.mensajes = viejos.concat(datos.mensajes);
        if (!viejos.length) est.hayMas = datos.hay_mas;
        const cambio = !est.info || antes !== est.mensajes.map((m) => m.id).join(',') ||
            est.info.puede_escribir !== datos.puede_escribir;
        est.info = datos;
        if (datos.ticket) Object.assign(t, datos.ticket);
        if (cambio) pintar(true);
        pintarPie();
    }

    async function anteriores() {
        if (!est.mensajes.length) return;
        try {
            const datos = await pedir(ruta + '?antes=' + encodeURIComponent(est.mensajes[0].ts));
            est.mensajes = datos.mensajes.concat(est.mensajes);
            est.hayMas = datos.hay_mas;
            pintar(false);
        } catch (error) { avisar(error.message, 'malo'); }
    }

    cargar().catch((error) => { lista.innerHTML = '<div class="bm-vacio"></div>'; lista.firstChild.textContent = error.message; });
    const reloj = setInterval(() => {
        if (estado.hoja !== hoja) { clearInterval(reloj); return; }
        if (document.visibilityState === 'visible' && est.info && est.info.puede_escribir) cargar().catch(() => {});
    }, CONV_CADA_MS);
}

// =======================================================================
// 📤 SUBIR CONTENIDO
// =======================================================================
// Fotos y videos de la galería a su Drive: PERSONAL/{asunto}. El asunto es el
// nombre de la carpeta, así que solo se deja enviar uno válido (la misma
// regla de contenido.py). Los archivos van DE UNO EN UNO: un video grande no
// arrastra a los demás y, si uno falla, los otros ya quedaron guardados y
// solo se reintenta ese. La carpeta llega a MULTIMEDIA del escritorio.
const ASUNTO_MIN = 3;
const ASUNTO_MAX = 60;
const ASUNTO_PATRON = /^[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ _-]+$/;
const ASUNTOS_RESERVADOS = ['personal', 'chat paradise', 'capturas', 'subidos', 'tickets ceo', 'kwiky videos'];
const MB = 1024 * 1024;
const TOPE_FOTO_CONTENIDO = 30 * MB;      // los de contenido.py
const TOPE_VIDEO_CONTENIDO = 300 * MB;
const MAX_CONTENIDO = 60;
const EXT_VIDEO = /\.(mp4|mov|m4v|3gp|webm|mkv|avi)$/i;
const EXT_FOTO = /\.(jpe?g|png|heic|heif|webp|gif)$/i;

function claveAsunto(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/\s+/g, ' ').trim();
}

function limpiarAsunto(texto) { return String(texto || '').replace(/\s+/g, ' ').trim(); }

/* '' si vale; si no, el motivo para enseñarlo debajo del campo. */
function motivoAsunto(texto) {
    const asunto = limpiarAsunto(texto);
    if (!asunto) return 'Escribe el asunto: será el nombre de la carpeta.';
    if (asunto.length < ASUNTO_MIN) return 'El asunto debe tener al menos ' + ASUNTO_MIN + ' caracteres.';
    if (asunto.length > ASUNTO_MAX) return 'El asunto puede tener como mucho ' + ASUNTO_MAX + ' caracteres.';
    if (!ASUNTO_PATRON.test(asunto)) {
        return 'Solo letras, números, espacios, guion (-) y guion bajo (_). Sin / \\ : * ? " < > | . ni emojis.';
    }
    if (!/[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(asunto)) return 'El asunto necesita letras o números.';
    if (ASUNTOS_RESERVADOS.indexOf(claveAsunto(asunto)) >= 0) return 'Ese nombre ya lo usa el programa. Escoge otro asunto.';
    return '';
}

function tipoContenido(archivo) {
    const mime = String(archivo.type || '').toLowerCase();
    if (mime.indexOf('image/') === 0) return 'imagen';
    if (mime.indexOf('video/') === 0) return 'video';
    if (!mime || mime === 'application/octet-stream') {
        if (EXT_VIDEO.test(archivo.name || '')) return 'video';
        if (EXT_FOTO.test(archivo.name || '')) return 'imagen';
    }
    return '';
}

function pesoTexto(bytes) {
    return bytes >= MB ? (bytes / MB).toFixed(bytes >= 100 * MB ? 0 : 1) + ' MB'
                       : Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

/* Las dos pestañas de arriba. Cambiar de pestaña vuelve a abrir la hoja en la
   otra, salvo con una subida a medias. */
function pestanasSubir(hoja, activa, ocupada) {
    const caja = document.createElement('div');
    caja.className = 'bm-pestanas';
    [['personal', '📁 Personal'], ['kwiky', '⚡ Kwiky']].forEach(([modo, texto]) => {
        const b = document.createElement('button');
        b.textContent = texto;
        if (modo === activa) b.className = 'activa';
        b.onclick = () => {
            if (modo === activa) return;
            if (ocupada()) { avisar('Espera a que termine de subir.', 'malo'); return; }
            abrirSubir(modo);
        };
        caja.appendChild(b);
    });
    hoja.cuerpo.prepend(caja);
}

function abrirSubir(modo) {
    if (modo === 'kwiky') { abrirKwiky(); return; }
    const hoja = abrirHoja('subir', '📤 Subir contenido');
    const lista = [];                // {archivo, tipo, estado: listo|subiendo|hecho|error, error, vista}
    let subiendo = false;
    hoja.cuerpo.innerHTML =
        '<div class="bm-campo"><label>Asunto (será el nombre de la carpeta)</label>' +
            '<input class="s-asunto" maxlength="' + ASUNTO_MAX + '" autocomplete="off" ' +
            'placeholder="Ej: jasmin club de fans, kwikis o club de fans">' +
            '<div class="bm-motivo s-motivo"></div>' +
            '<div class="bm-sugerencias s-sugerencias bm-oculto"></div></div>' +
        '<div class="bm-campo"><label>Fotos y videos de tu galería</label>' +
            '<button class="bm-secundario s-galeria">🖼️ Escoger de la galería</button>' +
            '<input type="file" class="bm-oculto s-entrada" accept="image/*,video/*" multiple>' +
            '<div class="s-lista"></div></div>' +
        '<div class="bm-progreso bm-oculto"><div></div></div>' +
        '<div class="bm-nota s-estado"></div>' +
        '<button class="bm-principal s-enviar" disabled>Subir</button>' +
        '<p class="bm-nota">Se guarda en tu Drive, en la carpeta PERSONAL › (tu asunto). Si ya ' +
        'usaste ese asunto, se agrega a la misma carpeta. Tu monitor la recibe en Multimedia. ' +
        'Fotos de hasta 30 MB y videos de hasta 300 MB. No cierres esta ventana ni bloquees el teléfono mientras sube: ' +
        'la pantalla se queda encendida sola y, si se corta la conexión, sigue cuando vuelvas.</p>';
    const $ = (s) => hoja.cuerpo.querySelector(s);
    const entradaAsunto = $('.s-asunto');
    pestanasSubir(hoja, 'personal', () => subiendo);

    const pendientes = () => lista.filter((x) => x.estado !== 'hecho');

    // El botón queda apagado, con el motivo a la vista, mientras algo no valga.
    const revisarBoton = () => {
        const motivo = motivoAsunto(entradaAsunto.value);
        const escrito = entradaAsunto.value.trim() !== '';
        $('.s-motivo').textContent = escrito ? motivo : '';
        entradaAsunto.classList.toggle('bm-invalido', escrito && !!motivo);
        if (subiendo) return;
        const faltan = pendientes().length;
        const enviar = $('.s-enviar');
        enviar.disabled = !!motivo || !faltan;
        enviar.textContent = faltan ? 'Subir ' + faltan + (faltan === 1 ? ' archivo' : ' archivos') : 'Subir';
        let ayuda = '';
        if (!escrito) ayuda = 'Escribe el asunto: será el nombre de la carpeta.';
        else if (!faltan && !motivo) ayuda = 'Escoge al menos una foto o un video.';
        if (!lista.some((x) => x.estado === 'error')) $('.s-estado').textContent = ayuda;
    };

    const pintarLista = () => {
        const caja = $('.s-lista');
        caja.innerHTML = '';
        lista.forEach((x, i) => {
            const fila = document.createElement('div');
            fila.className = 'bm-subida ' + x.estado;
            const icono = { listo: '', subiendo: '⏫', hecho: '✅', error: '⚠️' }[x.estado];
            fila.innerHTML = (x.vista ? '<img alt="">'
                                      : '<span class="tipo">' + (x.tipo === 'video' ? '🎬' : '🖼️') + '</span>') +
                '<span class="nombre"></span><span class="peso"></span>' +
                (icono ? '<span>' + icono + '</span>' : '') +
                (!subiendo && (x.estado === 'listo' || x.estado === 'error') ? '<button title="Quitar">✕</button>' : '');
            if (x.vista) fila.querySelector('img').src = x.vista;
            fila.querySelector('.nombre').textContent = (x.archivo.name || 'archivo') + (x.error ? ' · ' + x.error : '');
            fila.querySelector('.peso').textContent = pesoTexto(x.archivo.size);
            const quitar = fila.querySelector('button');
            if (quitar) {
                quitar.onclick = () => {
                    if (x.vista) URL.revokeObjectURL(x.vista);
                    lista.splice(i, 1);
                    pintarLista();
                };
            }
            caja.appendChild(fila);
        });
        revisarBoton();
    };

    const agregar = (archivo) => {
        const nombre = archivo.name || 'archivo';
        const tipo = tipoContenido(archivo);
        if (!tipo) { avisar('«' + nombre + '» no es una foto ni un video.', 'malo'); return; }
        const tope = tipo === 'video' ? TOPE_VIDEO_CONTENIDO : TOPE_FOTO_CONTENIDO;
        if (archivo.size > tope) {
            avisar('«' + nombre + '» pesa ' + pesoTexto(archivo.size) + ': el máximo es ' + (tope / MB) + ' MB.', 'malo');
            return;
        }
        if (!archivo.size) { avisar('«' + nombre + '» está vacío.', 'malo'); return; }
        if (lista.length >= MAX_CONTENIDO) { avisar('Como mucho ' + MAX_CONTENIDO + ' archivos por vez.', 'malo'); return; }
        if (lista.some((x) => x.archivo.name === archivo.name && x.archivo.size === archivo.size)) return;
        // Miniatura sin leer el archivo entero: una URL local del navegador.
        const vista = tipo === 'imagen' && /jpe?g|png|webp|gif/i.test(archivo.type) ? URL.createObjectURL(archivo) : '';
        lista.push({ archivo: archivo, tipo: tipo, estado: 'listo', error: '', vista: vista });
    };

    $('.s-galeria').onclick = () => $('.s-entrada').click();
    $('.s-entrada').onchange = () => {
        Array.from($('.s-entrada').files || []).forEach(agregar);
        $('.s-entrada').value = '';
        pintarLista();
    };
    entradaAsunto.oninput = revisarBoton;

    // Los asuntos que ya tiene, para tocar uno y no escribirlo distinto.
    pedir('/api/contenido/asuntos').then((datos) => {
        const asuntos = (datos && datos.asuntos) || [];
        if (!asuntos.length || !hoja.capa.isConnected) return;
        const caja = $('.s-sugerencias');
        caja.innerHTML = '<small>Ya usaste:</small>';
        asuntos.forEach((a) => {
            const b = document.createElement('button');
            b.className = 'bm-secundario';
            b.textContent = a;
            b.onclick = () => { if (!subiendo) { entradaAsunto.value = a; revisarBoton(); } };
            caja.appendChild(b);
        });
        caja.classList.remove('bm-oculto');
    }).catch(() => {});

    // Cerrar con archivos a medio subir corta la subida: se pregunta antes.
    const cerrarNormal = hoja.cerrar;
    const alSalir = (e) => { e.preventDefault(); e.returnValue = ''; };
    hoja.cerrar = () => {
        if (subiendo && !window.confirm('Todavía se están subiendo archivos. Si cierras, se corta la subida. ¿Cerrar?')) return;
        window.removeEventListener('beforeunload', alSalir);
        lista.forEach((x) => { if (x.vista) URL.revokeObjectURL(x.vista); });
        cerrarNormal();
    };
    hoja.capa.querySelector('.bm-velo').onclick = hoja.cerrar;
    hoja.capa.querySelector('.bm-cerrar').onclick = hoja.cerrar;

    $('.s-enviar').onclick = async () => {
        const motivo = motivoAsunto(entradaAsunto.value);
        if (motivo) { avisar(motivo, 'malo'); entradaAsunto.focus(); return; }
        const tanda = pendientes();
        if (!tanda.length) return;
        const asunto = limpiarAsunto(entradaAsunto.value);
        entradaAsunto.value = asunto;
        subiendo = true;
        window.addEventListener('beforeunload', alSalir);
        modoSubida(hoja, true);
        entradaAsunto.disabled = true;
        $('.s-galeria').disabled = true;
        const enviar = $('.s-enviar');
        enviar.disabled = true;
        const barra = $('.bm-progreso');
        barra.classList.remove('bm-oculto');
        const total = tanda.reduce((suma, x) => suma + x.archivo.size, 0) || 1;
        let hechos = 0, fallidos = 0, bytesHechos = 0, carpeta = asunto;
        for (let i = 0; i < tanda.length; i++) {
            if (!hoja.capa.isConnected) break;
            const x = tanda[i];
            const nombre = x.archivo.name || 'archivo';
            x.estado = 'subiendo';
            x.error = '';
            pintarLista();
            enviar.textContent = 'Subiendo ' + (i + 1) + ' de ' + tanda.length + '…';
            const formulario = new FormData();
            formulario.append('asunto', asunto);
            formulario.append('archivo', x.archivo, x.archivo.name || (x.tipo === 'video' ? 'video.mp4' : 'foto.jpg'));
            try {
                const r = await subirConReintento('/api/contenido', formulario, (p) => {
                    barra.firstChild.style.width = Math.round((bytesHechos + p * x.archivo.size) / total * 100) + '%';
                    $('.s-estado').textContent = p >= 1 ? 'Guardando «' + nombre + '» en Drive…'
                        : 'Subiendo «' + nombre + '» · ' + Math.round(p * 100) + '%';
                }, null, (n) => {
                    $('.s-estado').textContent = 'Se cortó la conexión: «' + nombre + '» se reintenta solo (intento ' + (n + 1) + ').';
                });
                x.estado = 'hecho';
                carpeta = r.asunto || carpeta;
                hechos++;
            } catch (error) {
                x.estado = 'error';
                x.error = error.message;
                fallidos++;
            }
            bytesHechos += x.archivo.size;
            barra.firstChild.style.width = Math.round(bytesHechos / total * 100) + '%';
        }
        subiendo = false;
        window.removeEventListener('beforeunload', alSalir);
        modoSubida(hoja, false);
        if (!hoja.capa.isConnected) return;
        entradaAsunto.disabled = false;
        $('.s-galeria').disabled = false;
        barra.classList.add('bm-oculto');
        barra.firstChild.style.width = '0';
        if (!fallidos) {
            hoja.cerrar();
            alertaFinal(true, '¡Subida completa!', hechos + (hechos === 1 ? ' archivo quedó guardado' : ' archivos quedaron guardados') +
                        ' en tu Drive, en PERSONAL › ' + carpeta + '.\nTu monitor ya lo tiene en Multimedia.');
            return;
        }
        pintarLista();
        $('.s-estado').textContent = (hechos ? hechos + ' guardados. ' : '') + fallidos +
            (fallidos === 1 ? ' no se pudo subir' : ' no se pudieron subir') + ': toca «Subir» para reintentar.';
        alertaFinal(false, 'Faltaron archivos', (hechos ? hechos + (hechos === 1 ? ' se guardó' : ' se guardaron') + ', pero ' : '') +
                    fallidos + (fallidos === 1 ? ' no se pudo subir.' : ' no se pudieron subir.') +
                    '\nToca «Subir» para reintentar los que faltan.');
    };

    revisarBoton();
    entradaAsunto.focus();
}

// =======================================================================
// ⚡ KWIKY: 5 videos exactos a KWIKY VIDEOS/{número}
// =======================================================================
// La API dice qué carpeta toca y cuántos faltan (5, o menos si el último envío
// se cortó a mitad: entonces se retoma la misma carpeta). Justo antes de subir
// se pide `paquete`, que crea la carpeta, y los videos van de uno en uno.
// Con DOS cuentas de Streamate («Streamate» y «Streamate_2») primero se
// pregunta «KWIKIS PARA: nick1 · nick2 · Ambos»: la segunda tiene su propia
// numeración en KWIKY VIDEOS › SECUNDARIOS; «Ambos» va a la principal marcada
// para las dos.
const TOPE_VIDEO_KWIKY = 2 * 1024 * MB;   // el de contenido.py
const VIDEOS_KWIKY = 5;

function abrirKwiky() {
    const hoja = abrirHoja('subir', '📤 Subir contenido');
    const lista = [];                // {archivo, estado: listo|subiendo|hecho|error, error}
    let subiendo = false;
    let numero = 0, faltan = 0;      // lo que dice la API
    let para = '', carpeta = '';     // para quién (con dos cuentas) y la ruta en Drive
    let cuentas = null;              // {principal, secundaria} si tiene dos Streamate
    hoja.cuerpo.innerHTML =
        '<div class="bm-campo s-para bm-oculto"><label>Kwikis para</label>' +
            '<div class="bm-pestanas"></div></div>' +
        '<div class="bm-kwiky-info s-info">Buscando tu carpeta de Kwiky…</div>' +
        '<div class="bm-campo"><label>Videos de tu galería</label>' +
            '<button class="bm-secundario s-galeria" disabled>🎬 Escoger videos</button>' +
            '<input type="file" class="bm-oculto s-entrada" accept="video/*" multiple>' +
            '<div class="s-lista"></div></div>' +
        '<div class="bm-progreso bm-oculto"><div></div></div>' +
        '<div class="bm-nota s-estado"></div>' +
        '<button class="bm-principal s-enviar" disabled>Subir</button>' +
        '<p class="bm-nota">Cada envío son exactamente ' + VIDEOS_KWIKY + ' videos, de hasta 2 GB cada uno. ' +
        'Se guardan en tu Drive, en KWIKY VIDEOS › (número), y tu monitor los sube a Streamate. ' +
        'Si tienes más, envíalos de ' + VIDEOS_KWIKY + ' en ' + VIDEOS_KWIKY + '. No cierres esta ventana ni bloquees el ' +
        'teléfono mientras sube: la pantalla se queda encendida sola y, si se corta la conexión, sigue cuando vuelvas.</p>';
    const $ = (s) => hoja.cuerpo.querySelector(s);
    pestanasSubir(hoja, 'kwiky', () => subiendo);

    const pendientes = () => lista.filter((x) => x.estado !== 'hecho');

    // «dos», o el número si tiene Streamate_3 en adelante (la API manda `cantidad`).
    const cuantasCuentas = () => {
        const n = (cuentas && cuentas.cantidad) || 2;
        return n === 2 ? 'dos' : String(n);
    };

    const pintarInfo = () => {
        const info = $('.s-info');
        info.innerHTML = (faltan === VIDEOS_KWIKY
            ? 'Se guardará en <b></b>. Escoge exactamente <b></b> videos.'
            : 'La carpeta <b></b> quedó incompleta. Escoge ' +
              (faltan === 1 ? 'el <b></b> video que le falta.' : 'los <b></b> videos que le faltan.')) +
            (para === 'ambos' ? ' Son para tus ' + cuantasCuentas() + ' cuentas.' : '');
        const negritas = info.querySelectorAll('b');
        negritas[0].textContent = carpeta || ('KWIKY VIDEOS › ' + numero);
        negritas[1].textContent = faltan;
    };

    const tomar = (datos) => {
        numero = datos.numero;
        faltan = datos.faltan;
        carpeta = datos.carpeta || '';
    };

    // Con dos cuentas: los tres botones; al tocar uno se pregunta su carpeta.
    const elegir = (opcion, boton) => {
        if (subiendo) return;
        para = opcion;
        $('.s-para .bm-pestanas').querySelectorAll('button').forEach((b) => b.classList.toggle('activa', b === boton));
        $('.s-info').textContent = 'Buscando tu carpeta de Kwiky…';
        $('.s-galeria').disabled = true;
        numero = 0;
        revisarBoton();
        pedir('/api/contenido/kwiky?para=' + encodeURIComponent(opcion)).then((datos) => {
            if (!hoja.capa.isConnected || para !== opcion) return;
            tomar(datos);
            pintarInfo();
            $('.s-galeria').disabled = false;
            revisarBoton();
        }).catch((error) => { if (hoja.capa.isConnected) $('.s-info').textContent = error.message; });
    };

    const pintarCuentas = () => {
        const caja = $('.s-para .bm-pestanas');
        caja.innerHTML = '';
        [['principal', cuentas.principal], ['secundaria', cuentas.secundaria], ['ambos', 'Ambos']].forEach(([opcion, texto]) => {
            const b = document.createElement('button');
            b.textContent = texto;
            b.onclick = () => elegir(opcion, b);
            caja.appendChild(b);
        });
        $('.s-para').classList.remove('bm-oculto');
        $('.s-info').textContent = 'Tienes ' + cuantasCuentas() + ' cuentas de Streamate: escoge para cuál son estos Kwikis.';
    };

    // Subir solo se enciende con justo los que faltan, ni uno más ni uno menos.
    const revisarBoton = () => {
        if (subiendo) return;
        const cuantos = pendientes().length;
        const enviar = $('.s-enviar');
        enviar.disabled = !numero || cuantos !== faltan;
        enviar.textContent = cuantos ? 'Subir ' + cuantos + (cuantos === 1 ? ' video' : ' videos') : 'Subir';
        let ayuda = '';
        if (numero && cuantos < faltan) {
            const resto = faltan - cuantos;
            ayuda = cuantos ? 'Te falta' + (resto === 1 ? ' 1 video.' : 'n ' + resto + ' videos.')
                            : 'Escoge ' + faltan + (faltan === 1 ? ' video.' : ' videos.');
        } else if (cuantos > faltan) {
            ayuda = 'Son ' + faltan + ' exactos: quita ' + (cuantos - faltan) + '.';
        }
        if (!lista.some((x) => x.estado === 'error')) $('.s-estado').textContent = ayuda;
    };

    const pintarLista = () => {
        const caja = $('.s-lista');
        caja.innerHTML = '';
        lista.forEach((x, i) => {
            const fila = document.createElement('div');
            fila.className = 'bm-subida ' + x.estado;
            const icono = { listo: '', subiendo: '⏫', hecho: '✅', error: '⚠️' }[x.estado];
            fila.innerHTML = '<span class="tipo">🎬</span><span class="nombre"></span><span class="peso"></span>' +
                (icono ? '<span>' + icono + '</span>' : '') +
                (!subiendo && (x.estado === 'listo' || x.estado === 'error') ? '<button title="Quitar">✕</button>' : '');
            fila.querySelector('.nombre').textContent = (x.archivo.name || 'video') + (x.error ? ' · ' + x.error : '');
            fila.querySelector('.peso').textContent = pesoTexto(x.archivo.size);
            const quitar = fila.querySelector('button');
            if (quitar) quitar.onclick = () => { lista.splice(i, 1); pintarLista(); };
            caja.appendChild(fila);
        });
        revisarBoton();
    };

    const agregar = (archivo) => {
        const nombre = archivo.name || 'video';
        if (tipoContenido(archivo) !== 'video') { avisar('«' + nombre + '» no es un video.', 'malo'); return; }
        if (archivo.size > TOPE_VIDEO_KWIKY) {
            avisar('«' + nombre + '» pesa ' + pesoTexto(archivo.size) + ': el máximo es 2 GB.', 'malo');
            return;
        }
        if (!archivo.size) { avisar('«' + nombre + '» está vacío.', 'malo'); return; }
        if (lista.some((x) => x.archivo.name === archivo.name && x.archivo.size === archivo.size)) return;
        if (pendientes().length >= faltan) {
            avisar('Son ' + faltan + ' videos exactos: «' + nombre + '» no cabe.', 'malo');
            return;
        }
        lista.push({ archivo: archivo, estado: 'listo', error: '' });
    };

    $('.s-galeria').onclick = () => $('.s-entrada').click();
    $('.s-entrada').onchange = () => {
        Array.from($('.s-entrada').files || []).forEach(agregar);
        $('.s-entrada').value = '';
        pintarLista();
    };

    pedir('/api/contenido/kwiky').then((datos) => {
        if (!hoja.capa.isConnected) return;
        if (datos.cuentas && datos.numero === null) {
            cuentas = datos.cuentas;
            pintarCuentas();
            return;
        }
        tomar(datos);
        para = datos.para || '';
        pintarInfo();
        $('.s-galeria').disabled = false;
        revisarBoton();
    }).catch((error) => {
        if (hoja.capa.isConnected) $('.s-info').textContent = error.message;
    });

    const cerrarNormal = hoja.cerrar;
    const alSalir = (e) => { e.preventDefault(); e.returnValue = ''; };
    hoja.cerrar = () => {
        if (subiendo && !window.confirm('Todavía se están subiendo videos. Si cierras, se corta la subida. ¿Cerrar?')) return;
        window.removeEventListener('beforeunload', alSalir);
        cerrarNormal();
    };
    hoja.capa.querySelector('.bm-velo').onclick = hoja.cerrar;
    hoja.capa.querySelector('.bm-cerrar').onclick = hoja.cerrar;

    $('.s-enviar').onclick = async () => {
        const tanda = pendientes();
        if (!tanda.length || tanda.length !== faltan) return;
        subiendo = true;
        window.addEventListener('beforeunload', alSalir);
        modoSubida(hoja, true);
        $('.s-galeria').disabled = true;
        const enviar = $('.s-enviar');
        enviar.disabled = true;
        enviar.textContent = 'Preparando la carpeta…';
        pintarLista();
        // La carpeta se crea ahora. Si en otro teléfono ya la llenaron a
        // medias, la API dice otro número de faltantes y se pide revisar.
        try {
            const paquete = await pedir('/api/contenido/kwiky/paquete?para=' + encodeURIComponent(para), 'POST');
            const cambio = paquete.numero !== numero || paquete.faltan !== faltan;
            tomar(paquete);
            if (cambio) {
                subiendo = false;
                window.removeEventListener('beforeunload', alSalir);
                modoSubida(hoja, false);
                $('.s-galeria').disabled = false;
                pintarInfo();
                pintarLista();
                avisar('Tu carpeta de Kwiky cambió: revisa cuántos videos faltan.', 'malo');
                return;
            }
        } catch (error) {
            subiendo = false;
            window.removeEventListener('beforeunload', alSalir);
            modoSubida(hoja, false);
            $('.s-galeria').disabled = false;
            pintarLista();
            avisar(error.message, 'malo');
            return;
        }
        const barra = $('.bm-progreso');
        barra.classList.remove('bm-oculto');
        const total = tanda.reduce((suma, x) => suma + x.archivo.size, 0) || 1;
        let hechos = 0, fallidos = 0, bytesHechos = 0;
        for (let i = 0; i < tanda.length; i++) {
            if (!hoja.capa.isConnected) break;
            const x = tanda[i];
            const nombre = x.archivo.name || 'video';
            x.estado = 'subiendo';
            x.error = '';
            pintarLista();
            enviar.textContent = 'Subiendo ' + (i + 1) + ' de ' + tanda.length + '…';
            const formulario = new FormData();
            formulario.append('numero', String(numero));
            formulario.append('para', para);
            formulario.append('archivo', x.archivo, x.archivo.name || 'video.mp4');
            try {
                // Tras un corte se pregunta a la API si el video sí llegó (le
                // falta uno menos, o la carpeta ya se completó) para no repetirlo.
                const yaLlego = async () => {
                    const ahora = await pedir('/api/contenido/kwiky?para=' + encodeURIComponent(para));
                    return ahora.numero !== numero || ahora.faltan < faltan;
                };
                await subirConReintento('/api/contenido/kwiky', formulario, (p) => {
                    barra.firstChild.style.width = Math.round((bytesHechos + p * x.archivo.size) / total * 100) + '%';
                    $('.s-estado').textContent = p >= 1 ? 'Guardando «' + nombre + '» en Drive…'
                        : 'Subiendo «' + nombre + '» · ' + Math.round(p * 100) + '%';
                }, yaLlego, (n) => {
                    $('.s-estado').textContent = 'Se cortó la conexión: «' + nombre + '» se reintenta solo (intento ' + (n + 1) + ').';
                });
                x.estado = 'hecho';
                faltan--;
                hechos++;
            } catch (error) {
                x.estado = 'error';
                x.error = error.message;
                fallidos++;
            }
            bytesHechos += x.archivo.size;
            barra.firstChild.style.width = Math.round(bytesHechos / total * 100) + '%';
        }
        subiendo = false;
        window.removeEventListener('beforeunload', alSalir);
        modoSubida(hoja, false);
        if (!hoja.capa.isConnected) return;
        $('.s-galeria').disabled = false;
        barra.classList.add('bm-oculto');
        barra.firstChild.style.width = '0';
        if (!fallidos) {
            hoja.cerrar();
            alertaFinal(true, '¡Kwikis subidos!', 'Tus ' + hechos + (hechos === 1 ? ' video quedó guardado' : ' videos quedaron guardados') +
                        ' en ' + (carpeta || 'KWIKY VIDEOS › ' + numero) + '.\nTu monitor los sube a Streamate.');
            return;
        }
        pintarInfo();
        pintarLista();
        $('.s-estado').textContent = (hechos ? hechos + ' guardados. ' : '') + fallidos +
            (fallidos === 1 ? ' no se pudo subir' : ' no se pudieron subir') + ': toca «Subir» para reintentar.';
        alertaFinal(false, 'Faltaron videos', (hechos ? hechos + (hechos === 1 ? ' se guardó' : ' se guardaron') + ', pero ' : '') +
                    fallidos + (fallidos === 1 ? ' no se pudo subir.' : ' no se pudieron subir.') +
                    '\nToca «Subir» para reintentar: van a la misma carpeta.');
    };

    revisarBoton();
}

// =======================================================================
// 💬 LA BURBUJA DEL CHAT
// =======================================================================
// Cuenta lo que el estudio le escribió después de `chat_visto_hasta` (el
// cursor que guarda js/chat.js con el chat abierto). El cursor no avanza
// aquí: el número sube hasta que ella abre el chat. La primera vez, sin
// cursor, se toma la hora del servidor y se empieza en cero.
async function revisarChat() {
    if (!estado.burbuja || !token() || document.visibilityState !== 'visible') return;
    let desde = '';
    try { desde = localStorage.getItem('chat_visto_hasta') || ''; } catch (e) { /* sin almacenamiento */ }
    try {
        const datos = await pedir('/api/chat/nuevos?desde=' + encodeURIComponent(desde || new Date().toISOString()));
        if (!desde) {
            try { localStorage.setItem('chat_visto_hasta', datos.cursor); } catch (e) { /* da igual */ }
            return;
        }
        const suyos = (datos.mensajes || []).filter((m) => !m.de_modelo);
        estado.chatSinLeer = suyos.length;
        estado.chatCanal = suyos.length ? (suyos[suyos.length - 1].canal_id || '') : '';
        pintarBurbuja();
    } catch (error) { /* sin red un momento: en la siguiente vuelta */ }
}

function pintarBurbuja() {
    const b = estado.burbuja;
    if (!b) return;
    const n = estado.chatSinLeer;
    const globo = b.querySelector('.bm-globo');
    globo.textContent = n > 99 ? '99+' : String(n);
    globo.classList.toggle('bm-oculto', !n);
    b.title = n ? 'Chat: ' + n + (n === 1 ? ' mensaje nuevo' : ' mensajes nuevos') : 'Chat';
}

function montarBurbuja() {
    if (ES_CHAT) return;
    const b = document.createElement('button');
    b.className = 'bm-burbuja';
    b.setAttribute('aria-label', 'Abrir el chat');
    b.innerHTML = '💬<span class="bm-globo bm-oculto"></span>';
    b.onclick = () => {
        const canal = estado.chatSinLeer && estado.chatCanal;
        window.location.href = 'chat.html' + (canal ? '?canal=' + encodeURIComponent(canal) : '');
    };
    document.body.appendChild(b);
    document.body.classList.add('bm-con-burbuja');
    estado.burbuja = b;
    pintarBurbuja();
    revisarChat();
    setInterval(revisarChat, CHAT_CADA_MS);
    document.addEventListener('visibilitychange', revisarChat);
}

// =======================================================================
// LA CABECERA FIJA
// =======================================================================
function montarCabecera() {
    const arriba = document.createElement('div');
    arriba.className = 'bm-arriba';
    const enInicio = /(^|\/)(panel(\.html)?)?$/.test(window.location.pathname);
    const inicio = document.createElement('button');
    inicio.className = 'bm-inicio' + (enInicio ? ' activo' : '');
    inicio.title = 'Inicio';
    inicio.innerHTML = '<span>▦</span>INICIO';
    inicio.onclick = () => {
        if (enInicio) window.scrollTo({ top: 0, behavior: 'smooth' });
        else window.location.href = 'panel.html';
    };
    const derecha = document.createElement('div');
    derecha.className = 'bm-derecha';
    arriba.appendChild(inicio);
    arriba.appendChild(derecha);

    // La campana de la página (panel, turnos) se muda aquí con lo suyo.
    const campanaPropia = document.getElementById('btn-avisos') || document.getElementById('btn-campana');
    if (campanaPropia) {
        derecha.appendChild(campanaPropia);
    } else {
        const campana = boton_redondo('🔔', 'Avisos y tickets');
        estado.globo = document.createElement('span');
        estado.globo.className = 'bm-globo bm-oculto';
        campana.appendChild(estado.globo);
        campana.onclick = abrirCampana;
        derecha.appendChild(campana);
    }
    const tuerca = boton_redondo('⚙️', 'Ajustes');
    tuerca.id = 'btn-tuerca';
    tuerca.onclick = abrirTuerca;
    derecha.appendChild(tuerca);
    const fuera = boton_redondo('🚪', 'Cerrar sesión');
    fuera.id = 'btn-salir';
    fuera.onclick = salir;
    derecha.appendChild(fuera);

    document.body.insertBefore(arriba, document.body.firstChild);
    document.body.classList.add('bm-con-arriba');
}

// =======================================================================
// MONTAJE
// =======================================================================
function boton_redondo(simbolo, titulo) {
    const b = document.createElement('button');
    b.className = 'bm-redondo';
    b.title = titulo;
    b.textContent = simbolo;
    return b;
}

// =======================================================================
// ⚡ «TU CUENTA NO SE ESTÁ REVISANDO» (Leonardo, 2026-10-23)
// =======================================================================
// Seis días después de que la Admin exporte las cuentas de Streamate, a la
// modelo cuya cuenta nunca desbloqueó el Kwiky la API le dice que muestre
// este aviso (kwiky_revision.py). Sale al entrar, una vez al día en cada
// equipo, hasta que la cuenta se desbloquee.
async function avisoKwiky() {
    const hoy = new Date().toISOString().slice(0, 10);
    let visto = '';
    try { visto = localStorage.getItem('pdz_aviso_kwiky') || ''; } catch (e) { visto = ''; }
    if (visto === hoy) return;
    let datos = null;
    try { datos = await pedir('/api/streamate/aviso-kwiky'); } catch (e) { return; }
    if (!datos || !datos.mostrar || estado.hoja) return;
    try { localStorage.setItem('pdz_aviso_kwiky', hoy); } catch (e) { /* sin almacenamiento */ }
    const hoja = abrirHoja('aviso-kwiky', '⚠️ Kwiky');
    hoja.cuerpo.innerHTML =
        '<div class="bm-kwiky-info s-texto" style="font-size:15px"></div>' +
        '<button class="bm-principal s-chat">💬 Escribir al monitor</button>' +
        '<button class="bm-secundario s-ok" style="width:100%;margin-top:8px">Entendido</button>';
    hoja.cuerpo.querySelector('.s-texto').textContent = datos.texto;
    hoja.cuerpo.querySelector('.s-chat').onclick = () => { window.location.href = 'chat.html'; };
    hoja.cuerpo.querySelector('.s-ok').onclick = hoja.cerrar;
}

// 💳 MIS PAGOS (2026-10-26): el sexto botón de la barra de abajo, a la
// derecha de TICKET CEO. Se pone aquí para no tocar las cinco páginas;
// pagos.html ya lo trae marcado como activo.
function montarNavPagos(navTicket) {
    if (!navTicket) return;
    let boton = document.getElementById('nav-pagos');
    if (!boton) {
        boton = document.createElement('button');
        boton.id = 'nav-pagos';
        boton.innerHTML = '<span class="simbolo">💳</span>MIS PAGOS';
        navTicket.insertAdjacentElement('afterend', boton);
    }
    if (!boton.classList.contains('activo')) boton.onclick = () => { window.location.href = 'pagos.html'; };
    navTicket.parentElement.classList.add('bm-nav6');
}

function montar() {
    estilos();
    montarCabecera();
    montarBurbuja();
    setTimeout(avisoKwiky, 1500);

    const nav = document.getElementById('nav-ticket');
    if (nav) nav.onclick = abrirNuevo;
    const navSubir = document.getElementById('nav-subir');
    if (navSubir) navSubir.onclick = abrirSubir;
    montarNavPagos(nav);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarHoja(); });

    revisar(true).then(() => {
        // El aviso del teléfono «El CEO respondió» abre aquí con ?tickets=1.
        const parametros = new URLSearchParams(window.location.search);
        if (parametros.get('tickets')) {
            parametros.delete('tickets');
            const resto = parametros.toString();
            history.replaceState(null, '', window.location.pathname + (resto ? '?' + resto : ''));
            abrirCampana();
        }
    });
    setInterval(revisar, CADA_MS);
    document.addEventListener('visibilitychange', () => revisar());
}

if (token()) montar();

return {
    abrirCampana: abrirCampana, abrirNuevo: abrirNuevo, abrirTuerca: abrirTuerca,
    abrirSubir: abrirSubir,
    cambiarClave: cambiarClave, salir: salir, revisar: revisar,
    /* La página pone algo arriba de la lista de tickets (panel: la lista de espera). */
    ponerExtra: (funcion) => { estado.extra = funcion; },
    cuenta: cuenta,
    /* Las capacitaciones y reuniones que vienen, y cómo se pintan (INICIO). */
    actividades: () => estado.actividades, tarjetaActividad: tarjetaActividad,
};
})();
