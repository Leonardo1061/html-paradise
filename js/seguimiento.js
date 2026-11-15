/* ===========================================================================
 * PARADISE · Seguimiento de la modelo (seguimiento.html)
 * ===========================================================================
 *
 * Sus estadísticas de la semana: lo que antes era el INICIO (hasta el
 * rediseño de 2026-11-15). Pinta lo que devuelve `/api/acceso/panel`: los
 * cuatro números, lo siguiente de hoy y la gráfica de minutos por día.
 * Ningún número se calcula aquí —los calcula la API con las mismas funciones
 * del planificador— para que esta pantalla y el plan no puedan decir cosas
 * distintas.
 *
 * La BITÁCORA (lo que el monitor anota de su semana) todavía no existe en la
 * API: la página deja el aviso de «Próximamente».
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
async function cargar() {
    if (!estado.token) {
        window.location.href = PARADISE.URL_LOGIN;
        return;
    }
    try {
        estado.datos = await pedir('/api/acceso/panel');
        $('cargando').classList.add('oculto');
        $('tablero').classList.remove('oculto');
        pintar();
    } catch (error) {
        $('cargando').innerHTML = 'No se pudo cargar tu seguimiento.<br><small>' +
            escapar(error.message) + '</small>';
    }
}

// =======================================================================
// PINTAR
// =======================================================================
function pintar() {
    const datos = estado.datos;
    const hoy = datos.hoy, semana = datos.semana, turnos = datos.turnos;

    const partes = [];

    partes.push('<div class="saludo"><h1>Hola, ' + escapar((datos.nombre || '').split(' ')[0]) + '</h1>' +
        '<p>' + escapar(hoy.dia) + ' · ' + escapar(semana.etiqueta) + '</p></div>');

    // --- los cuatro números de arriba
    const cumplidoHoy = hoy.bloques ? hoy.completados + ' de ' + hoy.bloques + ' hechos' : 'Sin shows aún';
    partes.push('<div class="rejilla">' +
        tarjetaDato('Hoy', hoy.texto_minutos, cumplidoHoy, hoy.pendientes ? 'ojo' : 'bien') +
        tarjetaDato('Shows de hoy', String(hoy.bloques),
                    hoy.pendientes ? hoy.pendientes + ' por hacer' : 'Todo hecho',
                    hoy.pendientes ? 'ojo' : 'bien') +
        tarjetaDato('Esta semana', semana.texto_minutos, semana.bloques + ' bloques', '') +
        tarjetaDato('Cumplimiento', semana.cumplimiento + '%',
                    semana.completados + ' de ' + semana.bloques,
                    semana.cumplimiento >= 70 ? 'bien' : 'ojo') +
        '</div>');

    // --- lo siguiente en su turno
    if (hoy.siguiente) {
        partes.push('<div class="tarjeta siguiente ' + escapar(hoy.siguiente.vibra) + '">' +
            '<div class="icono">' + escapar(hoy.siguiente.icono) + '</div>' +
            '<div><div class="rotulo">' +
                (hoy.siguiente.en_curso ? '● En vivo ahora' : 'Lo siguiente hoy') + '</div>' +
            '<div class="nombre">' + escapar(hoy.siguiente.nombre) + '</div></div>' +
            '<button class="ir" id="btn-ir-plan">Abrir</button></div>');
    }

    // --- la gráfica de la semana
    partes.push('<div class="tarjeta grafica">' +
        '<div class="encabezado"><div>' +
            '<h2>Minutos programados</h2>' +
            '<div class="sub">Tu semana, día por día</div>' +
        '</div></div>' +
        graficaSemana(semana.por_dia) +
        '<div class="pie-grafica">' +
            '<div class="celda"><div class="cuadro">✅</div><div>' +
                '<div class="rotulo">Turnos confirmados</div>' +
                '<div class="cifra">' + turnos.confirmados + '</div></div></div>' +
            '<div class="celda"><div class="cuadro">⏳</div><div>' +
                '<div class="rotulo">En lista de espera</div>' +
                '<div class="cifra">' + turnos.en_espera + '</div></div></div>' +
        '</div></div>');

    $('tablero').innerHTML = partes.join('');

    const irPlan = $('btn-ir-plan');
    if (irPlan) irPlan.onclick = () => { window.location.href = 'plan.html'; };

    conectarGrafica();
}

function tarjetaDato(rotulo, cifra, pie, tono) {
    return '<div class="tarjeta dato"><div class="rotulo">' + escapar(rotulo) + '</div>' +
        '<div class="cifra">' + escapar(cifra) + '</div>' +
        '<div class="pie ' + (tono || '') + '">' + escapar(pie) + '</div></div>';
}

/* --- barras: una por día, una sola serie, sin leyenda ------------------
 * Barras y no líneas porque son siete días sueltos, no una medida continua:
 * una línea insinuaría valores entre el lunes y el martes que no existen.
 * Cada barra lleva su número encima, así no hace falta eje vertical ni
 * rejilla; el día de hoy va en el degradado de la marca. */
function graficaSemana(dias) {
    const ancho = 100, alto = 60;          // viewBox; el SVG escala al ancho
    const maximo = Math.max(60, ...dias.map((d) => d.minutos));
    const paso = ancho / dias.length;
    const grosor = paso * 0.52;
    const base = alto - 9;

    const barras = dias.map((dia, i) => {
        const centro = paso * i + paso / 2;
        const altura = dia.minutos ? Math.max(2.5, (dia.minutos / maximo) * (alto - 22)) : 0;
        const y = base - altura;
        const relleno = dia.es_hoy ? 'url(#hoy)' : 'rgba(217, 180, 74,.38)';

        return (altura
            ? '<rect class="barra" data-dia="' + dia.dia + '" data-minutos="' + dia.minutos + '" ' +
              'x="' + (centro - grosor / 2) + '" y="' + y + '" width="' + grosor + '" ' +
              'height="' + altura + '" rx="1.6" fill="' + relleno + '"></rect>'
            : '<rect x="' + (centro - grosor / 2) + '" y="' + (base - 1.6) + '" width="' + grosor +
              '" height="1.6" rx=".8" fill="rgba(255,255,255,.07)"></rect>') +
            (dia.minutos
                ? '<text x="' + centro + '" y="' + (y - 3) + '" text-anchor="middle" ' +
                  'font-size="4.6" font-weight="600" fill="' +
                  (dia.es_hoy ? '#f4f1e8' : '#a9a595') + '">' + dia.minutos + '</text>'
                : '') +
            '<text x="' + centro + '" y="' + (alto - 1.5) + '" text-anchor="middle" font-size="4.6" ' +
            'fill="' + (dia.es_hoy ? '#f4f1e8' : '#6f6c62') + '">' + dia.inicial + '</text>';
    }).join('');

    return '<svg viewBox="0 0 ' + ancho + ' ' + alto + '" ' +
        'role="img" aria-label="Minutos programados por día de la semana">' +
        '<defs><linearGradient id="hoy" x1="0" y1="1" x2="0" y2="0">' +
            '<stop offset="0%" stop-color="#b58a28"></stop>' +
            '<stop offset="100%" stop-color="#f6e3a1"></stop>' +
        '</linearGradient></defs>' +
        '<line x1="0" y1="' + base + '" x2="' + ancho + '" y2="' + base +
        '" stroke="rgba(255,255,255,.08)" stroke-width=".4"></line>' +
        barras + '</svg>' +
        '<div id="pista" style="font-size:12px;color:var(--tenue);margin-top:8px;min-height:17px"></div>';
}

/* Tocar una barra dice el día completo: en un móvil no hay «hover», así que
   el mismo gesto sirve para los dos. */
function conectarGrafica() {
    const pista = $('pista');
    if (!pista) return;
    document.querySelectorAll('rect.barra').forEach((barra) => {
        const contar = () => {
            const minutos = parseInt(barra.dataset.minutos, 10);
            const horas = Math.floor(minutos / 60), resto = minutos % 60;
            const texto = horas ? (resto ? horas + ' h ' + resto + ' min' : horas + ' h')
                                : minutos + ' min';
            pista.textContent = barra.dataset.dia + ': ' + texto + ' programados';
        };
        barra.addEventListener('mouseenter', contar);
        barra.addEventListener('click', contar);
        barra.style.cursor = 'pointer';
    });
}

cargar();

})();
