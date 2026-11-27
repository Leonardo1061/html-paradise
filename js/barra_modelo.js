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
 * REDISEÑO NEGRO Y DORADO (2026-11-15): la cabecera fija ahora lleva ☰ menú,
 * foto de perfil, logo, nombre y jornada, 🔔 campana y ⚙️ ajustes (con los
 * iconos de img/). La barra de abajo es nueva y la pone este archivo
 * (`montarNav`): Fotografía · Room · Contenido · CEO · Pagos; la `.navegacion`
 * vieja de cada página se queda escondida. El ☰ abre el menú lateral
 * (`abrirMenu`). Lo que sigue describe lo de antes, que sigue valiendo
 * salvo donde este párrafo dice otra cosa.
 *
 * BOTÓN CHAT (Leonardo, 2026-11-22): la burbuja es ahora el botón CHAT con
 * img/chat-soporte.png (2026-11-23: auriculares con globo de chat rosa-azul,
 * fondo transparente, sin texto; antes el círculo dorado «CHAT»), sale también en el INICIO (ya no hay chat en la página) y se
 * arrastra por toda la pantalla como la del personal: al soltarlo se pega al
 * borde más cercano y recuerda su sitio en este teléfono. Un toque sin
 * arrastrar abre chat.html, que ahora es solo Soporte; por eso el globo
 * cuenta solo lo que llegó a Soporte. Ya no sale el aviso de Kwiky.
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
 * Desde 2026-11-27 los archivos van DIRECTO a Drive (subida reanudable, en
 * trozos, 2 a la vez): ya no pasan por Render y un corte sigue desde el
 * último trozo que llegó, no desde cero. Ver «SUBIDA DIRECTA A DRIVE».
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

const BM_EN_DATOS = /(^|\/)datos(\.html)?$/.test(window.location.pathname);
if (!BM_EN_DATOS && localStorage.getItem('token_sesion') && localStorage.getItem('datos_pendientes') === '1') {
    window.location.replace('datos.html');
}

window.PARADISE_BARRA = (function () {
'use strict';

const API = PARADISE.API_URL;
const MAX_FOTOS = 6;                 // los de tickets.py
const MAX_ARCHIVOS = 4;
const TOPE_VISTA = 880000;           // base64; la API acepta 900 000
// Eran 60 s y 30 s: se alargaron para gastar menos lecturas (2026-10-29).
const CADA_MS = 90000;
const CHAT_CADA_MS = 60000;
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
//     ese archivo sigue desde el último trozo que llegó a Drive (subirDirecto);
//   · al terminar sale una alerta grande, vibra y, si la página no está a la
//     vista, llega una notificación (si dio permiso de avisos).
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

// -----------------------------------------------------------------------
// SUBIDA DIRECTA A DRIVE (2026-11-27)
// -----------------------------------------------------------------------
// Antes el archivo entero iba al servidor (Render) en UNA petición y de ahí a
// Drive: con datos móviles se cortaba seguido y cada reintento empezaba de
// cero. Ahora la API solo abre en Drive una subida reanudable (devuelve su
// dirección) y el archivo va DIRECTO a Drive en trozos de pocos MB. Si se
// corta, se le pregunta a Drive hasta qué byte llegó y se sigue desde ahí.
// La dirección se recuerda unos días en este teléfono: si se recarga la
// página y vuelve a escoger el mismo archivo, sigue donde iba.
const TROZO_DRIVE = 8 * 1024 * 1024;     // múltiplo de 256 KB, como pide Drive
const TROZO_MINIMO = 1024 * 1024;        // con mala señal se manda en trozos más chicos
const TROZO_QUIETO_MS = 60000;           // un trozo sin avanzar en 1 minuto se corta
const FALLOS_SEGUIDOS = 10;              // cortes seguidos SIN avanzar ni un byte
const SUBIDAS_A_LA_VEZ = 2;              // archivos subiendo en paralelo
const RECUERDO_SUBIDA_MS = 6 * 24 * 3600 * 1000;   // Drive las borra a la semana
const PREFIJO_SUBIDA = 'paradise_subida|';

function errorDeRed(texto) { const e = new Error(texto); e.red = true; return e; }

function claveSubida(destino, archivo) {
    return PREFIJO_SUBIDA + destino + '|' + (archivo.name || '') + '|' + archivo.size + '|' + (archivo.lastModified || 0);
}

function subidaGuardada(clave) {
    try {
        const guardada = JSON.parse(localStorage.getItem(clave) || 'null');
        if (guardada && guardada.url && guardada.hasta > Date.now()) return guardada.url;
        localStorage.removeItem(clave);
    } catch (e) { /* sin localStorage: se abre una nueva */ }
    return '';
}

function guardarSubida(clave, url) {
    try { localStorage.setItem(clave, JSON.stringify({ url: url, hasta: Date.now() + RECUERDO_SUBIDA_MS })); } catch (e) { /* nada */ }
}

function olvidarSubida(clave) { try { localStorage.removeItem(clave); } catch (e) { /* nada */ } }

// Las que ya caducaron (de envíos viejos que no se terminaron).
try {
    Object.keys(localStorage).forEach((k) => { if (k.indexOf(PREFIJO_SUBIDA) === 0) subidaGuardada(k); });
} catch (e) { /* nada */ }

/* POST a la API para abrir una subida. Un corte o el servidor despertando
   (5xx) se pueden reintentar; un 4xx trae el motivo y no. */
async function pedirSubida(ruta, cuerpo) {
    let respuesta;
    try {
        respuesta = await fetch(API + ruta, {
            method: 'POST', cache: 'no-store', body: JSON.stringify(cuerpo),
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
        });
    } catch (e) { throw errorDeRed('Se cortó la conexión.'); }
    let datos = {};
    try { datos = await respuesta.json(); } catch (e) { datos = {}; }
    if (respuesta.status === 401) { salirPorSesion(); throw new Error('Tu sesión caducó.'); }
    if (respuesta.status >= 500 || respuesta.status === 429) throw errorDeRed(datos.detail || 'El servidor no respondió.');
    if (!respuesta.ok) throw new Error(datos.detail || 'No se pudo preparar la subida.');
    return datos;
}

/* Un PUT a la dirección de Drive: un trozo (`cuerpo`) o, sin cuerpo, la
   pregunta «¿hasta dónde llegó?». Resuelve {estado, hasta, datos}. */
function ponerEnDrive(url, cuerpo, rango, alAvanzar) {
    return new Promise((resolver, rechazar) => {
        const xhr = new XMLHttpRequest();
        let ultimo = Date.now(), volvio = false, listo = false;
        const revisar = () => {
            if (listo) return;
            const quieto = Date.now() - ultimo;
            if (quieto > TROZO_QUIETO_MS || (volvio && quieto > 15000)) xhr.abort();
            volvio = false;
        };
        const alVolver = () => { if (document.visibilityState === 'visible') { volvio = true; revisar(); } };
        const reloj = setInterval(revisar, 5000);
        document.addEventListener('visibilitychange', alVolver);
        const terminar = () => { listo = true; clearInterval(reloj); document.removeEventListener('visibilitychange', alVolver); };
        xhr.open('PUT', url);
        xhr.setRequestHeader('Content-Range', rango);
        xhr.upload.onprogress = (e) => { ultimo = Date.now(); if (alAvanzar) alAvanzar(e.loaded); };
        xhr.onload = () => {
            terminar();
            // «Range: bytes=0-8388607» = ya tiene hasta el byte 8388607.
            const r = /bytes=0-(\d+)/.exec(xhr.getResponseHeader('Range') || '');
            let datos = {};
            try { datos = JSON.parse(xhr.responseText || '{}'); } catch (e) { datos = {}; }
            resolver({ estado: xhr.status, hasta: r ? Number(r[1]) + 1 : 0, datos: datos });
        };
        xhr.onerror = () => { terminar(); rechazar(errorDeRed('Se cortó la conexión.')); };
        xhr.onabort = () => { terminar(); rechazar(errorDeRed('La subida se quedó quieta.')); };
        xhr.send(cuerpo);
    });
}

/* Sube UN archivo directo a Drive. `abrir()` pide a la API la dirección (la
   primera vez o si caducó). `alAvanzar(bytes)` dice cuánto tiene ya Drive,
   `alReintentar(n, bytes)` avisa de un corte y `cancelada()` corta el envío.
   Resuelve con lo que contesta Drive ({id, name, size}). */
async function subirDirecto(archivo, destino, abrir, alAvanzar, alReintentar, cancelada) {
    const clave = claveSubida(destino, archivo);
    const total = archivo.size;
    let url = subidaGuardada(clave);
    let preguntar = !!url;           // una dirección de antes: ¿hasta dónde llegó?
    let desde = 0, trozo = TROZO_DRIVE, fallos = 0;
    for (;;) {
        if (cancelada && cancelada()) throw new Error('Se canceló.');
        try {
            if (!url) {
                url = (await abrir()).url;
                if (!url) throw new Error('No se pudo preparar la subida.');
                guardarSubida(clave, url);
                desde = 0;
                preguntar = false;
            }
            let r;
            if (preguntar) {
                r = await ponerEnDrive(url, null, 'bytes */' + total);
            } else {
                const hasta = Math.min(total, desde + trozo);
                const base = desde;
                r = await ponerEnDrive(url, archivo.slice(base, hasta),
                                       'bytes ' + base + '-' + (hasta - 1) + '/' + total,
                                       (n) => alAvanzar(Math.min(total, base + n)));
            }
            if (r.estado === 200 || r.estado === 201) {
                olvidarSubida(clave);
                alAvanzar(total);
                return r.datos;
            }
            if (r.estado === 308) {
                if (r.hasta > desde) { fallos = 0; trozo = Math.min(TROZO_DRIVE, trozo * 2); }
                desde = r.hasta;
                preguntar = false;
                alAvanzar(desde);
                continue;
            }
            if (r.estado === 404 || r.estado === 410) {
                // La dirección caducó o Drive la cerró: se abre otra, desde cero.
                olvidarSubida(clave);
                url = '';
                continue;
            }
            throw errorDeRed('Drive no respondió (' + (r.estado || 'sin conexión') + ').');
        } catch (error) {
            if (!error.red) throw error;
            fallos++;
            if (fallos > FALLOS_SEGUIDOS) throw new Error('Se cortó la conexión muchas veces. Toca «Subir» para seguir donde iba.');
            trozo = Math.max(TROZO_MINIMO, trozo / 2);
            if (alReintentar) alReintentar(fallos, desde);
            await esperarConexion(Math.min(20000, 1000 * fallos * fallos));
            preguntar = !!url;
        }
    }
}

/* Corre las tareas de `cuantas` en `cuantas`. */
async function enParalelo(tareas, cuantas) {
    let siguiente = 0;
    const obrero = async () => { while (siguiente < tareas.length) await tareas[siguiente++](); };
    await Promise.all(Array.from({ length: Math.min(cuantas, tareas.length) }, obrero));
}

/* La barra, el porcentaje y la velocidad de todo el envío. */
function medidorSubida(barra, estadoTexto, tanda) {
    const total = tanda.reduce((suma, x) => suma + x.archivo.size, 0) || 1;
    let muestra = { t: Date.now(), bytes: 0 }, velocidad = 0, pintado = 0;
    return {
        pintar(forzar) {
            const ahora = Date.now();
            if (!forzar && ahora - pintado < 400) return;
            pintado = ahora;
            const bytes = tanda.reduce((suma, x) => suma + (x.enviado || 0), 0);
            if (ahora - muestra.t >= 2000) {
                const v = (bytes - muestra.bytes) / ((ahora - muestra.t) / 1000);
                velocidad = velocidad ? velocidad * 0.6 + Math.max(0, v) * 0.4 : Math.max(0, v);
                muestra = { t: ahora, bytes: bytes };
            }
            const pct = Math.min(100, Math.floor(bytes / total * 100));
            barra.firstChild.style.width = pct + '%';
            const activos = tanda.filter((x) => x.estado === 'subiendo');
            const hechos = tanda.filter((x) => x.estado === 'hecho').length;
            tanda.forEach((x) => {
                if (x.celda && x.estado === 'subiendo') {
                    x.celda.textContent = Math.floor((x.enviado || 0) / x.archivo.size * 100) + '% de ' + pesoTexto(x.archivo.size);
                }
            });
            if (!activos.length || activos.some((x) => x.aviso)) return;
            let texto = 'Subiendo · ' + pct + '% · ' + hechos + ' de ' + tanda.length + ' listos';
            if (velocidad > 1024) {
                const faltan = (total - bytes) / velocidad;
                texto += ' · ' + pesoTexto(velocidad) + '/s' +
                    (faltan > 90 ? ' · faltan ~' + Math.ceil(faltan / 60) + ' min' : faltan > 5 ? ' · faltan ~' + Math.ceil(faltan) + ' s' : '');
            }
            estadoTexto.textContent = texto;
        },
    };
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
    background: #1a1a1d; border: 1px solid #34322b; color: #f4f1e8; font-size: 17px;
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
:root { --bm-arriba: calc(66px + env(safe-area-inset-top)); }
body.bm-con-arriba { padding-top: var(--bm-arriba); }
/* Que lo último de la página pueda subir por encima de la burbuja. */
body.bm-con-burbuja { padding-bottom: calc(165px + env(safe-area-inset-bottom)) !important; }
.bm-arriba {
    position: fixed; top: 0; left: 0; right: 0; z-index: 35; height: var(--bm-arriba);
    padding: env(safe-area-inset-top) max(10px, env(safe-area-inset-right)) 0 max(10px, env(safe-area-inset-left));
    display: flex; align-items: center; gap: 8px;
    background: rgba(7,7,8,.95); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    border-bottom: 1px solid #8f6f22; font-family: 'Ubuntu', -apple-system, 'Segoe UI', sans-serif;
}
.bm-arriba .bm-derecha { margin-left: auto; display: flex; gap: 6px; align-items: center; flex: none; }
.bm-ic {
    background: none !important; border: 0 !important; padding: 4px; width: auto !important; height: auto !important;
    border-radius: 10px; cursor: pointer; display: grid; place-items: center; position: relative; flex: none;
    font-size: 0 !important; color: #f4f1e8; animation: none !important; box-shadow: none !important;
}
.bm-ic > img { display: block; width: 32px; height: 32px; object-fit: contain; }
.bm-ic.bm-menu > img { width: 30px; height: 30px; }
.bm-ic .bm-globo, .bm-ic .globo, .bm-ic .punto-campana {
    top: -1px !important; right: -3px !important; border: 0 !important; background: #e3262b !important;
    font-size: 11px !important; min-width: 18px; height: 18px;
}
.bm-ic.tiene-avisos > img { animation: bm-latido 1.6s infinite; }
@keyframes bm-latido { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
.bm-avatar {
    width: 46px; height: 46px; border-radius: 50%; border: 2px solid #d9b44a; padding: 0; flex: none;
    background: #1a1a1d; color: #f3d98b; font: 500 19px/1 'Ubuntu', sans-serif; overflow: hidden; cursor: pointer;
    display: grid; place-items: center;
}
.bm-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bm-quien {
    flex: 1; min-width: 0; background: none; border: 0; padding: 0; text-align: left; cursor: pointer;
    color: #f4f1e8; font-family: inherit; line-height: 1.1;
}
.bm-quien img { height: 21px; display: block; margin-bottom: 1px; }
.bm-quien b { display: block; font-weight: 400; font-size: 14.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bm-quien span { display: block; color: #d9b44a; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bm-volver {
    background: none; border: 0; color: #d9b44a; font: 13px 'Ubuntu', sans-serif; cursor: pointer;
    padding: 4px 8px 4px 0; white-space: nowrap; flex: none;
}
/* La barra de abajo: la vieja de cada página se esconde y manda esta. */
.navegacion { display: none !important; }
.bm-nav {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 33;
    display: grid; grid-template-columns: repeat(5, 1fr);
    background: #070708; border-top: 1px solid #8f6f22; border-radius: 20px 20px 0 0;
    padding: 8px max(4px, env(safe-area-inset-right)) calc(9px + env(safe-area-inset-bottom)) max(4px, env(safe-area-inset-left));
    font-family: 'Ubuntu', -apple-system, 'Segoe UI', sans-serif;
}
@media (min-width: 760px) { .bm-nav { left: 50%; right: auto; transform: translateX(-50%); width: 520px; border-left: 1px solid #8f6f22; border-right: 1px solid #8f6f22; } }
.bm-nav button {
    background: none; border: 0; color: #cfccc0; font: 12px 'Ubuntu', sans-serif; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 3px 0; border-radius: 10px;
}
.bm-nav button img { height: 32px; width: 44px; object-fit: contain; }
.bm-nav button.activo { color: #f3d98b; }
.bm-nav button.activo img { filter: sepia(1) saturate(4) hue-rotate(-12deg) brightness(.95); }
body.guardando .bm-nav { display: none; }
/* El menú ☰ */
.bm-cajon {
    position: fixed; top: 0; bottom: 0; left: 0; z-index: 2001; width: min(78vw, 320px);
    background: #09090a; border-right: 1px solid #8f6f22; color: #f4f1e8;
    padding: calc(18px + env(safe-area-inset-top)) 14px calc(18px + env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left));
    display: flex; flex-direction: column; gap: 2px; overflow-y: auto;
    font-family: 'Ubuntu', -apple-system, 'Segoe UI', sans-serif;
}
.bm-cajon > img { height: 32px; align-self: flex-start; margin-bottom: 12px; }
.bm-cajon button {
    background: none; border: 0; color: #f4f1e8; text-align: left; padding: 10px 6px; border-radius: 9px;
    font: 15px 'Ubuntu', sans-serif; cursor: pointer; display: flex; gap: 12px; align-items: center;
}
.bm-cajon button:hover, .bm-cajon button.activo { background: #1a1a1d; }
.bm-cajon button.activo { color: #f3d98b; }
.bm-cajon button img, .bm-cajon button span.e { width: 26px; height: 26px; object-fit: contain; text-align: center; flex: none; font-size: 19px; line-height: 26px; }
.bm-cajon hr { border: 0; border-top: 1px solid #34322b; margin: 8px 0; width: 100%; }
.bm-burbuja {
    position: fixed; z-index: 34; left: 0; top: 0;
    width: 91px; height: 91px; border-radius: 50%; border: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 1px;
    background: url('img/chat-soporte.png') center / contain no-repeat transparent;
    filter: drop-shadow(0 6px 10px rgba(0, 0, 0, .55)); cursor: grab; padding: 0;
    touch-action: none; -webkit-user-select: none; user-select: none;
    transition: left .18s ease, top .18s ease, transform .12s; }
.bm-burbuja.arrastrando { cursor: grabbing; transition: none; transform: scale(1.06); }
.bm-burbuja .bm-globo { top: -3px; right: -3px; }
/* Donde ya hay una caja de chat abajo o manda la barra de guardar, estorba. */
body.guardando .bm-burbuja, body:has(#vista-chat:not(.oculto)) .bm-burbuja { display: none; }
.bm-velo { position: fixed; inset: 0; background: rgba(0,0,0,.66); backdrop-filter: blur(3px); z-index: 2000; }
.bm-hoja {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 2001; background: #0e0e10; color: #f4f1e8;
    border-top: 1px solid #8f6f22; border-radius: 22px 22px 0 0; max-height: 92vh;
    display: flex; flex-direction: column; font-family: 'Ubuntu', -apple-system, 'Segoe UI', sans-serif;
}
@media (min-width: 760px) { .bm-hoja { left: 50%; transform: translateX(-50%); width: 480px; } }
.bm-cabecera { padding: 16px; border-bottom: 1px solid #34322b; display: flex; gap: 10px; align-items: center; }
.bm-cabecera h3 { margin: 0; font-size: 17px; flex: 1; }
.bm-cerrar { background: none; border: 0; color: #a9a595; font-size: 22px; padding: 4px 6px; cursor: pointer; }
.bm-cuerpo { padding: 16px; overflow-y: auto; }
.bm-opcion {
    width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; cursor: pointer;
    background: #1a1a1d; border: 1px solid #34322b; color: #f4f1e8; border-radius: 14px;
    padding: 14px; font-size: 15px; font-family: inherit; margin-bottom: 10px;
}
.bm-opcion .icono { font-size: 20px; width: 26px; text-align: center; }
.bm-opcion small { display: block; color: #a9a595; font-size: 12px; margin-top: 2px; }
.bm-campo { margin-bottom: 14px; }
.bm-campo label { display: block; font-size: 12px; color: #a9a595; margin-bottom: 6px; }
.bm-campo input, .bm-campo textarea {
    width: 100%; box-sizing: border-box; background: #1a1a1d; border: 1px solid #34322b;
    border-radius: 12px; padding: 12px 13px; color: #f4f1e8; font-size: 15px; font-family: inherit;
}
.bm-campo textarea { min-height: 96px; resize: vertical; }
.bm-campo select {
    width: 100%; box-sizing: border-box; background: #1a1a1d; border: 1px solid #34322b;
    border-radius: 12px; padding: 12px 13px; color: #f4f1e8; font-size: 15px; font-family: inherit;
}
.bm-conv { display: flex; flex-direction: column; gap: 8px; }
.bm-msj { max-width: 85%; align-self: flex-start; background: #1a1a1d; border: 1px solid #34322b;
    border-radius: 14px 14px 14px 4px; padding: 9px 12px; font-size: 14px; line-height: 1.45; }
.bm-msj.mio { align-self: flex-end; border-radius: 14px 14px 4px 14px; border-color: rgba(243, 217, 139,.45); }
.bm-msj .quien { font-size: 11.5px; color: #a9a595; margin-bottom: 3px; }
.bm-msj .txt { white-space: pre-wrap; word-break: break-word; }
.bm-msj img { max-width: 220px; max-height: 220px; border-radius: 10px; display: block; margin-top: 6px; cursor: zoom-in; }
.bm-msj .bm-secundario { margin-top: 6px; }
.bm-escribir { border-top: 1px solid #34322b; padding: 10px 12px 14px; }
.bm-escribir .fila { display: flex; gap: 8px; align-items: flex-end; }
.bm-escribir textarea { flex: 1; min-width: 0; min-height: 52px; max-height: 40vh; resize: vertical;
    background: #1a1a1d; border: 1px solid #34322b; border-radius: 12px; padding: 9px 11px;
    color: #f4f1e8; font: inherit; font-size: 14px; }
.bm-escribir .bm-principal { width: auto; padding: 12px 16px; }
.bm-fin { text-align: center; color: #a9a595; font-size: 13px; padding: 12px 6px; }
.bm-campo input.bm-invalido { border-color: rgba(239,68,68,.7); }
.bm-motivo { font-size: 12px; color: #fca5a5; margin-top: 6px; }
.bm-motivo:empty { display: none; }
.bm-sugerencias { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; align-items: center; }
.bm-sugerencias small { color: #a9a595; font-size: 12px; }
.bm-sugerencias .bm-secundario { padding: 6px 10px; font-size: 12px; }
.s-lista { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
.bm-subida {
    display: flex; align-items: center; gap: 8px; background: #1a1a1d; border: 1px solid #34322b;
    border-radius: 10px; padding: 6px 8px; font-size: 12px; color: #d8d4c6;
}
.bm-subida img { width: 40px; height: 40px; object-fit: cover; border-radius: 7px; flex: none; }
.bm-subida .tipo { width: 40px; text-align: center; font-size: 20px; flex: none; }
.bm-subida .nombre { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bm-subida .peso { color: #a9a595; flex: none; }
.bm-subida button { background: none; border: 0; color: #a9a595; cursor: pointer; font-size: 14px; flex: none; }
.bm-subida.hecho { border-color: rgba(217,180,74,.4); }
.bm-subida.error { border-color: rgba(239,68,68,.55); }
.bm-subida.error .nombre { white-space: normal; }
.bm-subida.subiendo { border-color: rgba(217, 180, 74,.6); }
.bm-pestanas { display: flex; gap: 6px; margin-bottom: 14px; background: #1a1a1d;
    border: 1px solid #34322b; border-radius: 12px; padding: 4px; }
.bm-pestanas button { flex: 1; background: none; border: 0; color: #a9a595; border-radius: 9px;
    padding: 9px 6px; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; }
.bm-pestanas button.activa { background: linear-gradient(135deg, #f6e3a1 0%, #d9b44a 45%, #b58a28 100%); color: #fff; }
.bm-kwiky-info { background: #1a1a1d; border: 1px solid rgba(217, 180, 74,.45); border-radius: 12px;
    padding: 11px 13px; font-size: 13.5px; line-height: 1.45; margin-bottom: 14px; }
.bm-kwiky-info b { color: #f3d98b; }
.bm-principal {
    width: 100%; background: linear-gradient(135deg, #f6e3a1 0%, #d9b44a 45%, #b58a28 100%); border: 0; color: #fff;
    font-weight: 600; border-radius: 12px; padding: 14px; font-size: 15px; font-family: inherit; cursor: pointer;
}
.bm-principal:disabled { opacity: .6; }
.bm-secundario {
    background: #1a1a1d; border: 1px solid #34322b; color: #d8d4c6; border-radius: 11px;
    padding: 9px 12px; font-size: 13px; font-family: inherit; cursor: pointer;
}
.bm-fila { display: flex; gap: 8px; flex-wrap: wrap; }
.bm-nota { font-size: 12px; color: #6f6c62; line-height: 1.5; margin-top: 10px; }
.bm-adjuntos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.bm-chip {
    display: flex; align-items: center; gap: 6px; background: #1a1a1d; border: 1px solid #34322b;
    border-radius: 10px; padding: 6px 8px; font-size: 12px; color: #d8d4c6; max-width: 100%;
}
.bm-chip img { width: 44px; height: 44px; object-fit: cover; border-radius: 7px; }
.bm-chip button { background: none; border: 0; color: #a9a595; cursor: pointer; font-size: 14px; }
.bm-progreso { height: 6px; background: #1a1a1d; border-radius: 99px; overflow: hidden; margin: 10px 0; }
.bm-progreso div { height: 100%; width: 0; background: linear-gradient(90deg, #f3d98b, #c9982e); transition: width .2s; color: #1a1404; }
.bm-ticket {
    background: #1a1a1d; border: 1px solid #34322b; border-radius: 14px; padding: 13px; margin-bottom: 10px;
    border-left: 4px solid #fbbf24;
}
.bm-ticket.respondido { border-left-color: #d9b44a; }
.bm-ticket.cerrado { border-left-color: #6f6c62; }
.bm-ticket.nuevo { box-shadow: 0 0 0 1px rgba(217,180,74,.5); }
.bm-ticket .cabeza { display: flex; gap: 8px; align-items: flex-start; }
.bm-ticket .asunto { font-weight: 600; font-size: 15px; flex: 1; }
.bm-ticket .meta { font-size: 12px; color: #a9a595; margin-top: 3px; }
.bm-ticket .detalle { font-size: 13px; margin-top: 8px; white-space: pre-wrap; color: #d8d4c6; }
.bm-ticket .respuesta {
    margin-top: 10px; background: rgba(217,180,74,.08); border: 1px solid rgba(217,180,74,.3);
    border-radius: 11px; padding: 10px 12px; font-size: 14px; white-space: pre-wrap;
}
.bm-ticket .respuesta b { display: block; font-size: 11px; color: #f3d98b; margin-bottom: 4px; letter-spacing: .5px; }
.bm-pildora { font-size: 11px; border-radius: 99px; padding: 3px 9px; background: rgba(251,191,36,.15); color: #fde68a; white-space: nowrap; }
.bm-pildora.respondido { background: rgba(217,180,74,.15); color: #f3d98b; }
.bm-pildora.cerrado { background: rgba(155,155,163,.15); color: #d8d4c6; }
.bm-miniaturas { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.bm-miniaturas img { width: 64px; height: 64px; object-fit: cover; border-radius: 9px; cursor: pointer; }
.bm-extra { margin-bottom: 14px; font-size: 13px; line-height: 1.45; color: #d8d4c6;
    background: #1a1a1d; border: 1px solid #34322b; border-radius: 12px; padding: 11px 13px; }
.bm-vacio { text-align: center; color: #6f6c62; padding: 26px 0; font-size: 14px; }
.bm-visor { position: fixed; inset: 0; z-index: 2010; background: rgba(0,0,0,.92); display: grid; place-items: center; }
.bm-visor img { max-width: 96vw; max-height: 92vh; border-radius: 10px; }
.bm-aviso {
    position: fixed; left: 16px; right: 16px; bottom: 100px; z-index: 10000; background: #1a1a1d; color: #f4f1e8;
    border: 1px solid #34322b; border-radius: 14px; padding: 13px 15px; font-size: 14px; line-height: 1.4;
    box-shadow: 0 16px 40px rgba(0,0,0,.6); font-family: 'Ubuntu', -apple-system, 'Segoe UI', sans-serif;
}
.bm-aviso.malo { border-color: rgba(239,68,68,.55); }
.bm-aviso.bueno { border-color: rgba(217,180,74,.5); }
@media (min-width: 760px) { .bm-aviso { left: 50%; transform: translateX(-50%); width: 460px; } }
.bm-no-salgas { background: rgba(251,191,36,.1); border: 1px solid rgba(251,191,36,.45); color: #fde68a;
    border-radius: 12px; padding: 10px 12px; font-size: 13px; line-height: 1.45; margin-bottom: 12px; }
.bm-final { position: fixed; inset: 0; z-index: 10001; background: rgba(0,0,0,.8); backdrop-filter: blur(4px);
    display: grid; place-items: center; padding: 20px; font-family: 'Ubuntu', -apple-system, 'Segoe UI', sans-serif; }
.bm-final .caja { width: 100%; max-width: 400px; background: #141416; color: #f4f1e8; border-radius: 22px;
    padding: 28px 22px 22px; text-align: center; border: 2px solid rgba(217,180,74,.6);
    box-shadow: 0 24px 60px rgba(0,0,0,.6); }
.bm-final .caja.mal { border-color: rgba(239,68,68,.65); }
.bm-final .icono { font-size: 64px; line-height: 1; }
.bm-final h2 { margin: 14px 0 8px; font-size: 22px; }
.bm-final p { margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #d8d4c6; white-space: pre-line; }
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
    const hoja = abrirHoja('tuerca', 'Ajustes');
    hoja.cuerpo.innerHTML =
        '<button class="bm-opcion" data-op="datos"><span class="icono">📝</span>' +
            '<span>Actualiza tus datos<small>Nombre, correo, celular, foto y cédula</small></span></button>' +
        '<button class="bm-opcion" data-op="clave"><span class="icono">🔑</span>' +
            '<span>Cambiar contraseña<small>La misma del programa de escritorio</small></span></button>' +
        '<button class="bm-opcion" data-op="prueba"><span class="icono">📳</span>' +
            '<span>Enviar alerta de prueba<small>Para comprobar que los avisos llegan a este teléfono</small></span></button>' +
        '<button class="bm-opcion" data-op="actualizar"><span class="icono">⬇️</span>' +
            '<span>Buscar actualización<small>Recarga la última versión de la web</small></span></button>' +
        '<button class="bm-opcion" data-op="salir"><span class="icono">⏻</span><span>Cerrar sesión</span></button>';
    hoja.cuerpo.querySelector('[data-op="actualizar"]').onclick = buscarActualizacion;
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
    return '<div class="bm-ticket' + (actividadSuena(a) ? ' nuevo' : '') + '" style="border-left:4px solid #d9b44a">' +
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
// regla de contenido.py). Cada archivo es su propia subida directa a Drive
// (de a dos a la vez): si uno falla, los otros ya quedaron guardados y solo
// se reintenta ese, desde donde iba. La carpeta llega a MULTIMEDIA del escritorio.
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
            x.celda = fila.querySelector('.peso');
            x.celda.textContent = x.estado === 'subiendo'
                ? Math.floor((x.enviado || 0) / x.archivo.size * 100) + '% de ' + pesoTexto(x.archivo.size)
                : pesoTexto(x.archivo.size);
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
        // Directo a Drive, de a SUBIDAS_A_LA_VEZ archivos (ver subirDirecto).
        let hechos = 0, fallidos = 0, carpeta = asunto;
        tanda.forEach((x) => { x.estado = 'listo'; x.error = ''; x.enviado = 0; x.aviso = ''; });
        const medidor = medidorSubida(barra, $('.s-estado'), tanda);
        enviar.textContent = 'Subiendo ' + tanda.length + (tanda.length === 1 ? ' archivo…' : ' archivos…');
        $('.s-estado').textContent = 'Preparando la subida…';
        await enParalelo(tanda.map((x) => async () => {
            if (!hoja.capa.isConnected) return;
            const nombre = x.archivo.name || (x.tipo === 'video' ? 'video.mp4' : 'foto.jpg');
            x.estado = 'subiendo';
            pintarLista();
            try {
                await subirDirecto(x.archivo, 'personal|' + claveAsunto(asunto), async () => {
                    const r = await pedirSubida('/api/contenido/sesion', {
                        asunto: asunto, nombre: nombre, mime: x.archivo.type || '', bytes: x.archivo.size });
                    carpeta = r.asunto || carpeta;
                    return r;
                }, (bytes) => {
                    if (bytes > (x.enviado || 0)) x.aviso = '';
                    x.enviado = bytes;
                    medidor.pintar();
                }, (n, bytes) => {
                    x.aviso = 'corte';
                    $('.s-estado').textContent = 'Se cortó la conexión: «' + nombre + '» sigue desde el ' +
                        Math.floor(bytes / x.archivo.size * 100) + '% cuando vuelva (intento ' + (n + 1) + ').';
                }, () => !hoja.capa.isConnected);
                x.estado = 'hecho';
                hechos++;
            } catch (error) {
                x.estado = 'error';
                x.error = error.message;
                fallidos++;
            }
            x.aviso = '';
            pintarLista();
            medidor.pintar(true);
        }), SUBIDAS_A_LA_VEZ);
        // Una vez por envío: la carpeta queda en MULTIMEDIA del monitor.
        if (hechos) await pedirSubida('/api/contenido/listo', { asunto: asunto }).catch(() => {});
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
            x.celda = fila.querySelector('.peso');
            x.celda.textContent = x.estado === 'subiendo'
                ? Math.floor((x.enviado || 0) / x.archivo.size * 100) + '% de ' + pesoTexto(x.archivo.size)
                : pesoTexto(x.archivo.size);
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
        // Directo a Drive, de a SUBIDAS_A_LA_VEZ videos (ver subirDirecto).
        let hechos = 0, fallidos = 0;
        tanda.forEach((x) => { x.estado = 'listo'; x.error = ''; x.enviado = 0; x.aviso = ''; });
        const medidor = medidorSubida(barra, $('.s-estado'), tanda);
        enviar.textContent = 'Subiendo ' + tanda.length + (tanda.length === 1 ? ' video…' : ' videos…');
        $('.s-estado').textContent = 'Preparando la subida…';
        const destino = 'kwiky|' + para + '|' + numero;
        await enParalelo(tanda.map((x) => async () => {
            if (!hoja.capa.isConnected) return;
            const nombre = x.archivo.name || 'video.mp4';
            x.estado = 'subiendo';
            pintarLista();
            try {
                await subirDirecto(x.archivo, destino, () => pedirSubida('/api/contenido/kwiky/sesion', {
                    numero: numero, para: para, nombre: nombre, mime: x.archivo.type || '', bytes: x.archivo.size,
                }), (bytes) => {
                    if (bytes > (x.enviado || 0)) x.aviso = '';
                    x.enviado = bytes;
                    medidor.pintar();
                }, (n, bytes) => {
                    x.aviso = 'corte';
                    $('.s-estado').textContent = 'Se cortó la conexión: «' + nombre + '» sigue desde el ' +
                        Math.floor(bytes / x.archivo.size * 100) + '% cuando vuelva (intento ' + (n + 1) + ').';
                }, () => !hoja.capa.isConnected);
                x.estado = 'hecho';
                faltan--;
                hechos++;
            } catch (error) {
                x.estado = 'error';
                x.error = error.message;
                fallidos++;
            }
            x.aviso = '';
            pintarLista();
            medidor.pintar(true);
        }), SUBIDAS_A_LA_VEZ);
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
        const suyos = (datos.mensajes || []).filter((m) => !m.de_modelo && (m.canal_id || 'soporte') === 'soporte');
        estado.chatSinLeer = suyos.length;
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

const LADO_BURBUJA = 91;
const MARGEN_BURBUJA = 12;
const CLAVE_BURBUJA = 'pdz_burbuja_chat';

/* Se arrastra con el dedo o el mouse por toda la pantalla (sin taparse con la
   cabecera ni con la barra de abajo); al soltarlo se pega al borde más
   cercano y guarda el sitio. Un toque sin arrastrar abre el chat. */
function arrastrable(b, abrir) {
    let sitio = { lado: 'der', altura: 0.7 };
    try { sitio = Object.assign(sitio, JSON.parse(localStorage.getItem(CLAVE_BURBUJA) || '{}')); } catch (e) { /* el de siempre */ }
    const topeArriba = () => (document.querySelector('.bm-arriba') ? document.querySelector('.bm-arriba').offsetHeight : 0) + 10;
    const topeAbajo = () => Math.max(topeArriba(), window.innerHeight - LADO_BURBUJA - 96);
    const limitar = (y) => Math.min(topeAbajo(), Math.max(topeArriba(), y));
    const xDe = (lado) => (lado === 'izq' ? MARGEN_BURBUJA : window.innerWidth - LADO_BURBUJA - MARGEN_BURBUJA);
    function colocar() {
        b.style.left = xDe(sitio.lado) + 'px';
        b.style.top = limitar(sitio.altura * window.innerHeight) + 'px';
    }
    colocar();
    window.addEventListener('resize', colocar);

    let toque = null;
    b.addEventListener('pointerdown', (e) => {
        b.setPointerCapture(e.pointerId);
        const caja = b.getBoundingClientRect();
        toque = { x: e.clientX, y: e.clientY, dx: e.clientX - caja.left, dy: e.clientY - caja.top, movio: false };
        b.classList.add('arrastrando');
    });
    b.addEventListener('pointermove', (e) => {
        if (!toque) return;
        if (Math.abs(e.clientX - toque.x) + Math.abs(e.clientY - toque.y) > 6) toque.movio = true;
        if (!toque.movio) return;
        b.style.left = Math.max(0, Math.min(window.innerWidth - LADO_BURBUJA, e.clientX - toque.dx)) + 'px';
        b.style.top = limitar(e.clientY - toque.dy) + 'px';
    });
    b.addEventListener('pointerup', () => {
        if (!toque) return;
        const movio = toque.movio;
        toque = null;
        b.classList.remove('arrastrando');
        if (!movio) { abrir(); return; }
        const caja = b.getBoundingClientRect();
        sitio = { lado: caja.left + LADO_BURBUJA / 2 < window.innerWidth / 2 ? 'izq' : 'der',
                  altura: caja.top / window.innerHeight };
        try { localStorage.setItem(CLAVE_BURBUJA, JSON.stringify(sitio)); } catch (e) { /* solo es comodidad */ }
        colocar();
    });
    b.addEventListener('pointercancel', () => { toque = null; b.classList.remove('arrastrando'); colocar(); });
    // Con teclado también abre (el clic del mouse ya lo resolvió `pointerup`).
    b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
    });
}

function montarBurbuja() {
    if (ES_CHAT) return;
    const b = document.createElement('button');
    b.className = 'bm-burbuja';
    b.setAttribute('aria-label', 'Abrir el chat con Soporte');
    b.innerHTML = '<span class="bm-globo bm-oculto"></span>';
    document.body.appendChild(b);
    arrastrable(b, () => { window.location.href = 'chat.html'; });
    document.body.classList.add('bm-con-burbuja');
    estado.burbuja = b;
    pintarBurbuja();
    revisarChat();
    setInterval(revisarChat, CHAT_CADA_MS);
    document.addEventListener('visibilitychange', revisarChat);
}

// =======================================================================
// LA CABECERA FIJA (rediseño 2026-11-15)
// =======================================================================
// ☰ menú · foto · logo, nombre y jornada · 🔔 campana · ⚙️ ajustes.
// Es la misma en todas las páginas y no se va con el scroll.
const PAGINA = (window.location.pathname.split('/').pop() || 'panel.html').replace(/\.html$/, '') || 'panel';
const EN_INICIO = PAGINA === 'panel' || PAGINA === '';

function icono(nombre) { return '<img src="img/' + nombre + '.png" alt="">'; }

function ir(pagina) {
    if (pagina === PAGINA + '.html') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    window.location.href = pagina;
}

/* La foto de perfil sale de /api/datos (la misma de «Actualiza tus datos»).
   Se guarda en el teléfono y se vuelve a pedir una vez al día. */
function pintarFoto(avatar) {
    let foto = '';
    try { foto = localStorage.getItem('pdz_foto_perfil') || ''; } catch (e) { foto = ''; }
    if (foto) {
        avatar.innerHTML = '<img alt="Tu foto">';
        avatar.querySelector('img').src = 'data:image/png;base64,' + foto;
    } else {
        avatar.textContent = ((localStorage.getItem('modelo_actual') || 'P').trim().charAt(0) || 'P').toUpperCase();
    }
}

async function cargarFoto(avatar) {
    const hoy = new Date().toISOString().slice(0, 10);
    let dia = '';
    try { dia = localStorage.getItem('pdz_foto_dia') || ''; } catch (e) { dia = ''; }
    if (dia === hoy) return;
    try {
        const ficha = await pedir('/api/datos');
        try {
            localStorage.setItem('pdz_foto_dia', hoy);
            if (ficha.foto_perfil) localStorage.setItem('pdz_foto_perfil', ficha.foto_perfil);
            else localStorage.removeItem('pdz_foto_perfil');
        } catch (e) { /* teléfono sin espacio: se queda la inicial */ }
        pintarFoto(avatar);
    } catch (error) { /* sin red: mañana se intenta otra vez */ }
}

async function buscarActualizacion() {
    cerrarHoja();
    avisar('Buscando la última versión…', 'bueno');
    try {
        if ('serviceWorker' in navigator) {
            const registro = await navigator.serviceWorker.getRegistration();
            if (registro) await registro.update();
        }
    } catch (e) { /* se recarga igual */ }
    window.location.reload();
}

function abrirMenu() {
    cerrarHoja();
    const capa = document.createElement('div');
    const opciones = [
        ['panel', '▦', 'Inicio'], ['plan', 'plan-de-trabajo', 'Plan de Trabajo'], ['convenios', 'convenios', 'Convenios'],
        ['sexshop', 'sexshop', 'SexShop'], ['capacitaciones', 'capacitaciones', 'Capacitaciones'],
        ['bitacora', 'bloc-de-notas', 'Bitácora'], ['rank', 'rank', 'Rank'], ['chat', 'chat', 'Chat'],
        ['datos', '📝', 'Mis datos'],
    ];
    capa.innerHTML = '<div class="bm-velo"></div><div class="bm-cajon"><img src="img/logo.png" alt="The Paradise">' +
        opciones.map(([pagina, ic, texto]) =>
            '<button data-pagina="' + pagina + '"' + (pagina === PAGINA ? ' class="activo"' : '') + '>' +
            (/^[a-z-]+$/.test(ic) ? icono(ic) : '<span class="e">' + ic + '</span>') + texto + '</button>').join('') +
        '<hr><button data-op="actualizar">' + icono('actualizar') + 'Buscar actualización</button>' +
        '<button data-op="salir"><span class="e">⏻</span>Cerrar sesión</button></div>';
    document.body.appendChild(capa);
    const hoja = { tipo: 'menu', capa: capa, cuerpo: capa.querySelector('.bm-cajon'), pintar: null };
    hoja.cerrar = () => { capa.remove(); if (estado.hoja === hoja) estado.hoja = null; };
    capa.querySelector('.bm-velo').onclick = hoja.cerrar;
    capa.querySelectorAll('[data-pagina]').forEach((b) => {
        b.onclick = () => { hoja.cerrar(); ir(b.dataset.pagina + '.html'); };
    });
    capa.querySelector('[data-op="actualizar"]').onclick = buscarActualizacion;
    capa.querySelector('[data-op="salir"]').onclick = salir;
    estado.hoja = hoja;
}

function montarCabecera() {
    const arriba = document.createElement('div');
    arriba.className = 'bm-arriba';

    const menu = document.createElement('button');
    menu.className = 'bm-ic bm-menu';
    menu.title = 'Menú';
    menu.setAttribute('aria-label', 'Menú');
    menu.innerHTML = icono('menu');
    menu.onclick = abrirMenu;

    const avatar = document.createElement('button');
    avatar.className = 'bm-avatar';
    avatar.title = 'Mis datos';
    avatar.onclick = () => ir('datos.html');
    pintarFoto(avatar);
    cargarFoto(avatar);

    const quien = document.createElement('button');
    quien.className = 'bm-quien';
    quien.title = 'Inicio';
    quien.innerHTML = '<img src="img/logo.png" alt="The Paradise"><b></b><span></span>';
    quien.querySelector('b').textContent = localStorage.getItem('modelo_actual') || '';
    quien.querySelector('span').textContent = localStorage.getItem('jornada_actual') || '';
    quien.onclick = () => ir('panel.html');

    const derecha = document.createElement('div');
    derecha.className = 'bm-derecha';
    arriba.appendChild(menu);
    arriba.appendChild(avatar);
    arriba.appendChild(quien);
    arriba.appendChild(derecha);

    // La campana de la página (turnos) se muda aquí con lo suyo.
    const campanaPropia = document.getElementById('btn-avisos') || document.getElementById('btn-campana');
    if (campanaPropia) {
        Array.from(campanaPropia.childNodes).forEach((n) => { if (n.nodeType === 3) n.remove(); });
        campanaPropia.classList.add('bm-ic');
        campanaPropia.insertAdjacentHTML('afterbegin', icono('campana'));
        campanaPropia.setAttribute('aria-label', 'Avisos y tickets');
        derecha.appendChild(campanaPropia);
    } else {
        const campana = boton_redondo('campana', 'Avisos y tickets');
        estado.globo = document.createElement('span');
        estado.globo.className = 'bm-globo bm-oculto';
        campana.appendChild(estado.globo);
        campana.onclick = abrirCampana;
        derecha.appendChild(campana);
    }
    const tuerca = boton_redondo('ajustes', 'Ajustes');
    tuerca.id = 'btn-tuerca';
    tuerca.onclick = abrirTuerca;
    derecha.appendChild(tuerca);

    document.body.insertBefore(arriba, document.body.firstChild);
    document.body.classList.add('bm-con-arriba');

    // En las páginas de adentro, «‹ Inicio» al lado del título de la página.
    if (!EN_INICIO && !BM_EN_DATOS) {
        const titulo = document.querySelector('body > .barra, body > header');
        if (titulo) {
            const volver = document.createElement('button');
            volver.className = 'bm-volver';
            volver.textContent = '‹ Inicio';
            volver.onclick = () => ir('panel.html');
            titulo.insertBefore(volver, titulo.firstChild);
        }
    }
}

// =======================================================================
// LA BARRA DE ABAJO (rediseño 2026-11-15)
// =======================================================================
// Fotografía · Room · Contenido · CEO · Pagos, con los iconos del diseño.
// La barra vieja de cada página (.navegacion) se queda escondida.
function montarNav() {
    const nav = document.createElement('nav');
    nav.className = 'bm-nav';
    const botones = [
        ['fotografia', 'fotografia', 'Fotografía', () => ir('fotografia.html')],
        ['turnos', 'room', 'Room', () => ir('turnos.html')],
        ['', 'contenido', 'Contenido', () => abrirSubir()],
        ['', 'ticket-ceo', 'CEO', () => abrirNuevo()],
        ['pagos', 'pagos', 'Pagos', () => ir('pagos.html')],
    ];
    botones.forEach(([pagina, ic, texto, accion]) => {
        const b = document.createElement('button');
        b.innerHTML = icono(ic) + texto;
        if (pagina && pagina === PAGINA) b.className = 'activo';
        b.onclick = accion;
        nav.appendChild(b);
    });
    document.body.appendChild(nav);
}

// =======================================================================
// MONTAJE
// =======================================================================
function boton_redondo(nombre, titulo) {
    const b = document.createElement('button');
    b.className = 'bm-ic';
    b.title = titulo;
    b.setAttribute('aria-label', titulo);
    b.innerHTML = icono(nombre);
    return b;
}

function montar() {
    estilos();
    montarCabecera();
    montarNav();
    montarBurbuja();
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
    abrirSubir: abrirSubir, abrirMenu: abrirMenu, pedir: pedir,
    cambiarClave: cambiarClave, salir: salir, revisar: revisar,
    /* La página pone algo arriba de la lista de tickets (panel: la lista de espera). */
    ponerExtra: (funcion) => { estado.extra = funcion; },
    cuenta: cuenta,
    /* Las capacitaciones y reuniones que vienen, y cómo se pintan (INICIO). */
    actividades: () => estado.actividades, tarjetaActividad: tarjetaActividad,
};
})();
