/* ===========================================================================
 * PARADISE · Panel de inicio de la modelo (panel.html)
 * ===========================================================================
 *
 * Pinta lo que devuelve `/api/acceso/panel`: su semana del plan de trabajo y
 * sus turnos. Ningún número se calcula aquí —los calcula la API con las
 * mismas funciones del planificador— para que el panel y el plan no puedan
 * decir cosas distintas.
 *
 * La barra de abajo lleva a las pantallas de verdad: TUS SHOWS (plan.html),
 * STATUS ROOM (turnos.html) y FOTOGRAFÍA (fotografia.html).
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
        localStorage.removeItem('token_sesion');
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
        $('cargando').innerHTML = 'No se pudo cargar tu panel.<br><small>' +
            escapar(error.message) + '</small>';
    }
}

// =======================================================================
// PINTAR
// =======================================================================
function pintar() {
    const datos = estado.datos;
    const hoy = datos.hoy, semana = datos.semana, turnos = datos.turnos;

    $('nombre-barra').textContent = datos.nombre || '';
    $('jornada-barra').textContent = localStorage.getItem('jornada_actual') || 'PARADISE';

    if (turnos.en_espera) {
        $('globo-avisos').textContent = turnos.en_espera;
        $('globo-avisos').classList.remove('oculto');
    }

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

    // --- si sigue con la contraseña de la cédula
    if (localStorage.getItem('password_por_defecto') === '1') {
        partes.push('<div class="sugerencia-clave">Estás entrando con los últimos 4 dígitos ' +
            'de tu cédula. Cualquiera que los sepa puede entrar a tu cuenta.<br>' +
            '<button id="btn-cambiar-ya">Cambiar mi contraseña ahora</button></div>');
    }

    $('tablero').innerHTML = partes.join('');

    const irPlan = $('btn-ir-plan');
    if (irPlan) irPlan.onclick = () => { window.location.href = 'plan.html'; };
    const cambiarYa = $('btn-cambiar-ya');
    if (cambiarYa) cambiarYa.onclick = abrirPerfil;

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
        const relleno = dia.es_hoy ? 'url(#hoy)' : 'rgba(168,85,247,.42)';

        return (altura
            ? '<rect class="barra" data-dia="' + dia.dia + '" data-minutos="' + dia.minutos + '" ' +
              'x="' + (centro - grosor / 2) + '" y="' + y + '" width="' + grosor + '" ' +
              'height="' + altura + '" rx="1.6" fill="' + relleno + '"></rect>'
            : '<rect x="' + (centro - grosor / 2) + '" y="' + (base - 1.6) + '" width="' + grosor +
              '" height="1.6" rx=".8" fill="rgba(255,255,255,.07)"></rect>') +
            (dia.minutos
                ? '<text x="' + centro + '" y="' + (y - 3) + '" text-anchor="middle" ' +
                  'font-size="4.6" font-weight="600" fill="' +
                  (dia.es_hoy ? '#f4f4f5' : '#9b9ba3') + '">' + dia.minutos + '</text>'
                : '') +
            '<text x="' + centro + '" y="' + (alto - 1.5) + '" text-anchor="middle" font-size="4.6" ' +
            'fill="' + (dia.es_hoy ? '#f4f4f5' : '#6b6b73') + '">' + dia.inicial + '</text>';
    }).join('');

    return '<svg viewBox="0 0 ' + ancho + ' ' + alto + '" ' +
        'role="img" aria-label="Minutos programados por día de la semana">' +
        '<defs><linearGradient id="hoy" x1="0" y1="1" x2="0" y2="0">' +
            '<stop offset="0%" stop-color="#8b5cf6"></stop>' +
            '<stop offset="100%" stop-color="#d946ef"></stop>' +
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

// =======================================================================
// PERFIL · CAMBIAR CONTRASEÑA
// =======================================================================
function cerrarHoja() { capas.innerHTML = ''; }

function abrirPerfil() {
    capas.innerHTML =
        '<div class="velo" id="velo"></div>' +
        '<div class="hoja"><div class="hoja-cabecera"><h3>Mi contraseña</h3>' +
            '<button class="cerrar" id="cerrar-hoja">✕</button></div>' +
        '<div class="hoja-cuerpo">' +
            '<div class="campo"><label>Contraseña actual</label>' +
                '<input type="password" id="p-actual" autocomplete="current-password"></div>' +
            '<div class="campo"><label>Contraseña nueva</label>' +
                '<input type="password" id="p-nueva" autocomplete="new-password"></div>' +
            '<div class="campo"><label>Repite la nueva</label>' +
                '<input type="password" id="p-repetida" autocomplete="new-password"></div>' +
            '<button class="boton-principal" id="btn-guardar-clave">Guardar</button>' +
            '<div style="border-top:1px solid var(--borde);margin:18px 0 14px"></div>' +
            '<div style="font-size:13px;color:var(--tenue);line-height:1.5;margin-bottom:10px">' +
                '<b style="color:var(--texto)">Avisos del teléfono</b><br>' +
                'Para que te avise cuando se acabe un show aunque tengas la ' +
                'aplicación cerrada. <span id="estado-avisos"></span></div>' +
            '<button class="boton-secundario" id="btn-avisos-on" style="margin-top:0">' +
                'Activar avisos en este teléfono</button>' +
            '<button class="boton-secundario" id="btn-avisos-probar">Mandarme uno de prueba</button>' +
            '<div style="border-top:1px solid var(--borde);margin:18px 0 14px"></div>' +
            '<button class="boton-secundario" id="btn-cerrar-sesion" style="margin-top:0">Cerrar sesión</button>' +
            '<p style="font-size:12px;color:var(--apagado);line-height:1.5;margin-top:14px">' +
            'Si la olvidas, tu monitor puede devolvértela a los últimos 4 dígitos de tu cédula. ' +
            'Es la misma contraseña del programa de escritorio.</p>' +
        '</div></div>';

    $('velo').onclick = cerrarHoja;
    $('cerrar-hoja').onclick = cerrarHoja;
    $('btn-cerrar-sesion').onclick = salir;
    conectarAvisos();

    $('btn-guardar-clave').onclick = async () => {
        try {
            await pedir('/api/acceso/password', 'POST', {
                actual: $('p-actual').value.trim(),
                nueva: $('p-nueva').value.trim(),
                repetida: $('p-repetida').value.trim(),
            });
            localStorage.removeItem('password_por_defecto');
            cerrarHoja();
            avisar('Contraseña actualizada. Úsala también en el programa de escritorio.', 'bueno');
            pintar();
        } catch (error) {
            avisar(error.message, 'malo');
        }
    };
}

/* --- avisos del teléfono (ver js/push.js) ---------------------------- */
async function conectarAvisos() {
    const rotulo = $('estado-avisos');
    const encender = $('btn-avisos-on');
    const probar = $('btn-avisos-probar');
    if (!rotulo || !window.PARADISE_PUSH) {
        if (rotulo) rotulo.textContent = 'Tu navegador no admite estos avisos.';
        return;
    }
    if (!PARADISE_PUSH.soportado()) {
        rotulo.textContent = 'Tu navegador no admite estos avisos.';
        encender.disabled = probar.disabled = true;
        return;
    }

    const pintarEstado = async () => {
        const activo = await PARADISE_PUSH.estaActivo();
        rotulo.innerHTML = activo
            ? '<span style="color:#6ee7b7">Activados en este teléfono.</span>'
            : '<span style="color:#fbbf24">Todavía no están activados aquí.</span>';
        encender.textContent = activo ? 'Desactivarlos en este teléfono'
                                      : 'Activar avisos en este teléfono';
        return activo;
    };

    let activo = await pintarEstado();

    encender.onclick = async () => {
        encender.disabled = true;
        try {
            if (activo) {
                await PARADISE_PUSH.desactivar(estado.token);
                avisar('Listo: ya no te avisaré en este teléfono.', 'bueno');
            } else {
                const listo = await PARADISE_PUSH.activar(estado.token);
                avisar(listo ? 'Listo: te avisaré aunque cierres la aplicación.'
                             : 'No se pudieron activar. Revisa que el navegador ' +
                               'tenga permiso para enviarte notificaciones.',
                       listo ? 'bueno' : 'malo');
            }
        } catch (error) {
            avisar('No se pudo cambiar el ajuste de avisos.', 'malo');
        }
        activo = await pintarEstado();
        encender.disabled = false;
    };

    probar.onclick = async () => {
        try {
            await pedir('/api/push/prueba', 'POST', {});
            avisar('Te lo acabo de mandar. Debería llegarte en unos segundos.', 'bueno');
        } catch (error) {
            avisar(error.message, 'malo');
        }
    };
}

function salir() {
    ['token_sesion', 'modelo_actual', 'jornada_actual', 'password_por_defecto']
        .forEach((clave) => localStorage.removeItem(clave));
    window.location.href = PARADISE.URL_LOGIN;
}

// =======================================================================
// ARRANQUE
// =======================================================================
$('nav-programador').onclick = () => { window.location.href = 'plan.html'; };
$('nav-status').onclick = () => { window.location.href = 'turnos.html'; };
$('nav-fotografia').onclick = () => { window.location.href = 'fotografia.html'; };
$('nav-perfil').onclick = abrirPerfil;
$('nav-inicio').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
$('btn-salir').onclick = salir;
$('btn-avisos').onclick = () => {
    const espera = (estado.datos && estado.datos.turnos.en_espera) || 0;
    avisar(espera ? 'Tienes ' + espera + ' turno(s) en lista de espera. Míralos en STATUS ROOM.'
                  : 'No tienes turnos en lista de espera.', espera ? 'malo' : 'bueno');
};
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarHoja(); });

cargar();

// turnos.html y plan.html mandan aquí con #perfil para abrir la contraseña
// sin tener que duplicar el formulario en cada página.
if (window.location.hash === '#perfil') {
    history.replaceState(null, '', window.location.pathname);
    abrirPerfil();
}

})();
