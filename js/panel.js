/* ===========================================================================
 * PARADISE · Inicio de la modelo (panel.html) · rediseño 2026-11-15
 * ===========================================================================
 *
 * El inicio son los seis mosaicos, las capacitaciones y reuniones que vienen
 * y el chat con el estudio. Aquí solo queda lo poco que tiene de vivo:
 *
 *   · pedir `/api/acceso/panel` para saber si sigue con la contraseña de la
 *     cédula (y aconsejarle cambiarla) y refrescar su nombre en la cabecera;
 *   · pintar las actividades que manda js/barra_modelo.js;
 *   · montar el chat (js/chat.js) sin que la página salte hasta abajo.
 *
 * Los números y la gráfica de la semana están en js/seguimiento.js y el
 * producido en js/producido.js (pestaña de Pagos).
 */

(function () {
'use strict';

const API = PARADISE.API_URL;
const $ = (id) => document.getElementById(id);
const capas = $('capas');

const estado = {
    token: localStorage.getItem('token_sesion') || '',
    datos: null,
};

function escapar(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

let avisoActual = null;
function avisar(mensaje, tipo) {
    if (avisoActual) avisoActual.remove();
    const caja = document.createElement('div');
    caja.className = 'aviso ' + (tipo || '');
    caja.textContent = mensaje;
    document.body.appendChild(caja);
    avisoActual = caja;
    setTimeout(() => { if (caja === avisoActual) { caja.remove(); avisoActual = null; } },
              tipo === 'malo' ? 6000 : 3200);
}

async function pedir(ruta, metodo, cuerpo) {
    const respuesta = await fetch(API + ruta, {
        method: metodo || 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + estado.token },
        cache: 'no-store',
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (respuesta.status === 401) {
        PARADISE.olvidar('token_sesion');
        avisar('Tu sesión caducó. Entra otra vez.', 'malo');
        setTimeout(() => { window.location.href = PARADISE.URL_LOGIN; }, 1500);
        throw new Error('sesión caducada');
    }
    let datos = {};
    try { datos = await respuesta.json(); } catch (e) { datos = {}; }
    if (!respuesta.ok) throw new Error(datos.detail || 'No se pudo completar la acción.');
    return datos;
}

// =======================================================================
// CARGA
// =======================================================================
function pintarClave() {
    const caja = $('aviso-clave');
    if (localStorage.getItem('password_por_defecto') !== '1') { caja.innerHTML = ''; return; }
    caja.innerHTML = '<div class="sugerencia-clave">Estás entrando con los últimos 4 dígitos ' +
        'de tu cédula. Cualquiera que los sepa puede entrar a tu cuenta.<br>' +
        '<button id="btn-cambiar-ya">Cambiar mi contraseña ahora</button></div>';
    $('btn-cambiar-ya').onclick = () => PARADISE_BARRA.cambiarClave();
}

async function cargar() {
    if (!estado.token) {
        window.location.href = PARADISE.URL_LOGIN;
        return;
    }
    pintarClave();
    try {
        estado.datos = await pedir('/api/acceso/panel');
        // La API dice si HOY sigue con la de la cédula: lo guardado en el login
        // se queda viejo si la cambió en el escritorio o se la cambió el monitor.
        if (estado.datos.password_por_defecto === true) localStorage.setItem('password_por_defecto', '1');
        else if (estado.datos.password_por_defecto === false) localStorage.removeItem('password_por_defecto');
        pintarClave();
    } catch (error) { /* el inicio no depende de esto: los mosaicos ya están */ }
    pintarRank();
}

// El puesto de la semana pasada dentro del laurel (api: /api/rank, rank_semanal.py).
// Si aún se calcula o no tuvo producción, el laurel queda vacío.
async function pintarRank() {
    try {
        const rank = await pedir('/api/rank');
        if (rank.listo && rank.mi_puesto) $('rank-num').textContent = rank.mi_puesto;
    } catch (error) { /* el laurel vacío no estorba */ }
}

// Las capacitaciones y reuniones del cronograma, con la hora y quién la da.
document.addEventListener('paradise:actividades', (e) => {
    const lista = (e.detail || []).slice(0, 6);
    $('actividades-inicio').classList.toggle('oculto', !lista.length);
    $('lista-actividades').innerHTML = lista.map(PARADISE_BARRA.tarjetaActividad).join('');
});
// Si la barra las trajo antes de que este archivo cargara.
(function () {
    const ya = PARADISE_BARRA.actividades() || [];
    if (ya.length) document.dispatchEvent(new CustomEvent('paradise:actividades', { detail: ya }));
})();

PARADISE_BARRA.ponerExtra(() => {
    const espera = (estado.datos && estado.datos.turnos && estado.datos.turnos.en_espera) || 0;
    return espera ? '⏳ Tienes <b>' + espera + '</b> turno(s) en lista de espera. Míralos en Room.'
                  : '';
});

// Al cambiar la contraseña desaparece el consejo de cambiarla.
document.addEventListener('paradise:clave', pintarClave);

cargar();

// El inicio abre SIEMPRE arriba, en los mosaicos (el navegador no recuerda
// dónde se quedó la vez anterior).
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// El chat del inicio: Soporte y los privados, en un cuadro de una pantalla
// (`enCaja`): lo que baja al último mensaje es el cuadro, no la página.
if (estado.token && window.ChatParadise) {
    ChatParadise.montar($('chat'), { avisar: avisar, enCaja: true }).activar();
}

// Enlaces viejos a panel.html#perfil: abren el cambio de contraseña.
if (window.location.hash === '#perfil') {
    history.replaceState(null, '', window.location.pathname);
    PARADISE_BARRA.cambiarClave();
}

})();
