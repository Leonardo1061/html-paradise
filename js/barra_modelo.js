/* ===========================================================================
 * PARADISE · La barra de la modelo: cabecera fija, 💬 burbuja del chat,
 *            🎫 TICKET CEO y 📤 SUBIR CONTENIDO
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
 *   🔔 La campana: los tickets al CEO. Uno PENDIENTE se queda en la lista
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
 *
 * Y el botón 📤 SUBIR CONTENIDO (id `nav-subir`, entre STATUS ROOM y TICKET
 * CEO) abre la hoja para subir fotos y videos de la galería a su Drive, en
 * PERSONAL/{asunto}. El asunto solo vale si sirve de nombre de carpeta. Ver
 * `contenido.py` en la API: la carpeta llega a MULTIMEDIA del escritorio.
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
    localStorage.removeItem('token_sesion');
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

/* Con barra de progreso: un video tarda en subir y fetch no la da. */
function subir(ruta, formulario, alAvanzar) {
    return new Promise((resolver, rechazar) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', API + ruta);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token());
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) alAvanzar(e.loaded / e.total); };
        xhr.onload = () => {
            let datos = {};
            try { datos = JSON.parse(xhr.responseText); } catch (e) { datos = {}; }
            if (xhr.status === 401) { salirPorSesion(); rechazar(new Error('Tu sesión caducó.')); return; }
            if (xhr.status >= 200 && xhr.status < 300) resolver(datos);
            else rechazar(new Error(datos.detail || 'No se pudo enviar. Inténtalo otra vez.'));
        };
        xhr.onerror = () => rechazar(new Error('Se cortó la conexión. Inténtalo otra vez.'));
        xhr.send(formulario);
    });
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
        .forEach((clave) => localStorage.removeItem(clave));
    window.location.href = PARADISE.URL_LOGIN;
}

// =======================================================================
// 🔔 LA CAMPANA: los tickets
// =======================================================================
// El globo rojo sale SOLO cuando el CEO ya respondió y ella no lo ha visto.
// Los pendientes se ven al abrir la campana, sin número encima.
function cuenta() { return estado.nuevas; }

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
    if (t.abierto) return t.estado === 'en curso' ? ['En revisión', ''] : ['Pendiente', ''];
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
        '<div class="meta">Enviado ' + escapar(t.creada || 'ahora') + '</div>' +
        (t.detalle ? '<div class="detalle">' + escapar(t.detalle) + '</div>' : '') +
        (t.respuesta ? '<div class="respuesta"><b>RESPUESTA DEL CEO' +
            (t.respondida ? ' · ' + escapar(t.respondida) : '') + '</b>' + escapar(t.respuesta) + '</div>' : '') +
        (!t.abierto && !t.respuesta ? '<div class="meta">El CEO lo cerró sin escribir respuesta.</div>' : '') +
        '<div class="bm-fila" style="margin-top:10px"></div><div class="bm-miniaturas"></div>';
    const fila = caja.querySelector('.bm-fila');
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
    return caja;
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
        hoja.cuerpo.innerHTML = (extra ? '<div class="bm-extra">' + extra + '</div>' : '') +
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">' +
            '<b style="flex:1;font-size:15px">🎫 Tus tickets al CEO</b>' +
            '<button class="bm-secundario t-nuevo">＋ Nuevo</button></div><div class="t-lista"></div>';
        hoja.cuerpo.querySelector('.t-nuevo').onclick = abrirNuevo;
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
function abrirNuevo() {
    const A = window.Adjuntos;
    const hoja = abrirHoja('nuevo', '🎫 Ticket al CEO');
    const fotos = [];                // {archivo, vista}
    const archivos = [];             // File (video o PDF)
    hoja.cuerpo.innerHTML =
        '<div class="bm-campo"><label>Asunto</label><input class="t-asunto" maxlength="200" ' +
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
        if (!asunto) { avisar('Escribe el asunto del ticket.', 'malo'); $('.t-asunto').focus(); return; }
        const formulario = new FormData();
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
    $('.t-asunto').focus();
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
const ASUNTOS_RESERVADOS = ['personal', 'chat paradise', 'capturas', 'subidos', 'tickets ceo'];
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

function abrirSubir() {
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
        'Fotos de hasta 30 MB y videos de hasta 300 MB. No cierres esta ventana mientras sube.</p>';
    const $ = (s) => hoja.cuerpo.querySelector(s);
    const entradaAsunto = $('.s-asunto');

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
                const r = await subir('/api/contenido', formulario, (p) => {
                    barra.firstChild.style.width = Math.round((bytesHechos + p * x.archivo.size) / total * 100) + '%';
                    $('.s-estado').textContent = p >= 1 ? 'Guardando «' + nombre + '» en Drive…'
                        : 'Subiendo «' + nombre + '» · ' + Math.round(p * 100) + '%';
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
        if (!hoja.capa.isConnected) return;
        entradaAsunto.disabled = false;
        $('.s-galeria').disabled = false;
        barra.classList.add('bm-oculto');
        barra.firstChild.style.width = '0';
        if (!fallidos) {
            avisar('✅ ' + hechos + (hechos === 1 ? ' archivo guardado' : ' archivos guardados') +
                   ' en PERSONAL › ' + carpeta + '. Tu monitor ya lo tiene en Multimedia.', 'bueno');
            hoja.cerrar();
            return;
        }
        pintarLista();
        $('.s-estado').textContent = (hechos ? hechos + ' guardados. ' : '') + fallidos +
            (fallidos === 1 ? ' no se pudo subir' : ' no se pudieron subir') + ': toca «Subir» para reintentar.';
        avisar('Algunos archivos no se subieron. Revisa la lista y reinténtalo.', 'malo');
    };

    revisarBoton();
    entradaAsunto.focus();
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

function montar() {
    estilos();
    montarCabecera();
    montarBurbuja();

    const nav = document.getElementById('nav-ticket');
    if (nav) nav.onclick = abrirNuevo;
    const navSubir = document.getElementById('nav-subir');
    if (navSubir) navSubir.onclick = abrirSubir;
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
};
})();
