/* ===========================================================================
 * PARADISE · Seguimiento Interno del CEO (personal_seguimiento.html)
 * ===========================================================================
 * Tres pestañas sobre /api/personal/seguimiento:
 *   Faltas       histórico, notificar y anular. Una falta no se borra.
 *   Actividades  lo que hizo cada persona: cifras y detalle.
 *   Pantallazos  las capturas que toma la Admin de escritorio, por día.
 * Mockup: https://claude.ai/artifact/RBq6YPDinUwbJK2tkFiWGx
 */
(function () {
'use strict';
const P = window.Personal;
const esc = P.escapar;
const API = '/api/personal/seguimiento';
const RONDAS_POR_PAGINA = 12;
const cuerpo = document.getElementById('cuerpo');

const estado = { pestana: 'faltas', personas: [], tipos: [], turno: 0 };

function hoy() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function mesDe(fecha) { return fecha.slice(0, 7); }

function opcionesPersonas(elegida, conTodos) {
    return (conTodos ? '<option value="">Todo el personal</option>' : '') +
        estado.personas.map((p) => '<option value="' + esc(p.nombre) + '"' +
            (p.nombre === elegida ? ' selected' : '') + '>' + esc(p.nombre) + ' · ' + esc(p.rol) + '</option>').join('');
}

function mesesAtras() {
    const salida = [];
    const base = new Date(hoy() + 'T12:00:00');
    for (let n = 0; n < 12; n++) {
        const d = new Date(base.getFullYear(), base.getMonth() - n, 1);
        const valor = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        salida.push({ valor: valor, texto: d.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }) });
    }
    return salida;
}

/* ------------------------------------------------------------------ Faltas */
const filtrosFaltas = { persona: '', mes: '', tipo: '' };

async function pintarFaltas() {
    const turno = ++estado.turno;
    cuerpo.innerHTML =
        '<button class="boton-principal" id="nueva-falta" style="background:var(--rojo)">＋ Notificar falta</button>' +
        '<div class="filtros-seguimiento">' +
        '<select id="f-persona" aria-label="Persona">' + opcionesPersonas(filtrosFaltas.persona, true) + '</select>' +
        '<select id="f-mes" aria-label="Mes"><option value="">Todos los meses</option>' + mesesAtras().map((m) =>
            '<option value="' + m.valor + '"' + (m.valor === filtrosFaltas.mes ? ' selected' : '') + '>' + esc(m.texto) + '</option>').join('') + '</select>' +
        '<select id="f-tipo" aria-label="Tipo"><option value="">Todos los tipos</option>' + estado.tipos.map((t) =>
            '<option' + (t === filtrosFaltas.tipo ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>' +
        '</div><div id="lista-faltas"><div class="cargando"><span class="girando">◌</span> Cargando…</div></div>';
    document.getElementById('nueva-falta').onclick = abrirNuevaFalta;
    [['f-persona', 'persona'], ['f-mes', 'mes'], ['f-tipo', 'tipo']].forEach(([id, campo]) => {
        document.getElementById(id).onchange = (e) => { filtrosFaltas[campo] = e.target.value; pintarFaltas(); };
    });
    const lista = document.getElementById('lista-faltas');
    try {
        const datos = await P.pedir(API + '/faltas?persona=' + encodeURIComponent(filtrosFaltas.persona) +
            '&mes=' + encodeURIComponent(filtrosFaltas.mes) + '&tipo=' + encodeURIComponent(filtrosFaltas.tipo));
        if (turno !== estado.turno) return;
        if (!datos.faltas.length) { lista.innerHTML = '<div class="vacio">No hay faltas con ese filtro.</div>'; return; }
        lista.innerHTML = '';
        datos.faltas.forEach((f) => lista.appendChild(tarjetaFalta(f)));
    } catch (error) {
        lista.innerHTML = '<div class="vacio">' + esc(error.message) + '</div>';
    }
}

function tarjetaFalta(f) {
    const caja = document.createElement('div');
    caja.className = 'tarjeta tarjeta-falta' + (f.anulada ? ' anulada' : '');
    const pildora = f.anulada ? '<span class="pildora">Anulada</span>'
        : f.version ? '<span class="pildora bien">Dio su versión</span>'
        : f.vista ? '<span class="pildora bien">Vista</span>'
        : '<span class="pildora alta">Sin ver</span>';
    caja.innerHTML =
        '<div class="cabeza-falta"><b>' + esc(f.persona) + '</b>' + pildora + '</div>' +
        '<div class="tipo-falta">' + esc(f.tipo) + '</div>' +
        (f.sesion ? '<div class="nota-falta">Sesión: ' + esc(f.sesion) + '</div>' : '') +
        '<div class="detalle-falta">' + esc(f.detalle) + '</div>' +
        (f.version ? '<div class="version-falta"><b>Su versión:</b> ' + esc(f.version) + '</div>' : '') +
        (f.anulada ? '<div class="version-falta"><b>Motivo:</b> ' + esc(f.motivo_anulacion) + '</div>' : '') +
        '<div class="nota-falta">Fecha del hecho: ' + esc(f.fecha) + (f.vista_en ? ' · Vista: ' + esc(f.vista_en) : '') + '</div>' +
        (f.anulada ? '' : '<button class="boton-secundario anular" style="margin-top:10px">Anular</button>');
    const anular = caja.querySelector('.anular');
    if (anular) {
        anular.onclick = async () => {
            const motivo = window.prompt('¿Por qué se anula esta falta?');
            if (!motivo || !motivo.trim()) return;
            anular.disabled = true;
            try {
                await P.pedir(API + '/faltas/' + encodeURIComponent(f.id) + '/anular', 'POST', { texto: motivo.trim() });
                P.avisar('Falta anulada. Sigue en el histórico.', 'bueno');
                pintarFaltas();
            } catch (error) {
                P.avisar(error.message, 'malo');
                anular.disabled = false;
            }
        };
    }
    return caja;
}

function abrirNuevaFalta() {
    const capa = document.createElement('div');
    capa.className = 'capa-conversacion';
    capa.innerHTML = '<div class="velo"></div><div class="hoja">' +
        '<div class="hoja-cabecera"><h3>Notificar una falta</h3><button class="cerrar" title="Cerrar">✕</button></div>' +
        '<div class="hoja-cuerpo">' +
        '<div class="campo"><label>Persona *</label><select class="n-persona"><option value="">Elige a la persona</option>' + opcionesPersonas('', false) + '</select></div>' +
        '<div class="campo"><label>Tipo de falta *</label><select class="n-tipo">' + estado.tipos.map((t) => '<option>' + esc(t) + '</option>').join('') + '</select></div>' +
        '<div class="campo"><label>Fecha del hecho *</label><input class="n-fecha" type="date" value="' + hoy() + '" max="' + hoy() + '"></div>' +
        '<div class="campo n-caja-sesion"><label>Sesión programada</label><select class="n-sesion"><option value="">Cargando…</option></select></div>' +
        '<div class="campo"><label>Detalle *</label><textarea class="n-detalle" maxlength="2000" placeholder="Qué pasó"></textarea></div>' +
        '<button class="boton-principal n-enviar" style="background:var(--rojo)">Notificar</button></div></div>';
    document.getElementById('capas-personal').appendChild(capa);
    const $ = (c) => capa.querySelector(c);
    const cerrar = () => capa.remove();
    $('.velo').onclick = cerrar;
    $('.cerrar').onclick = cerrar;

    async function cargarSesiones() {
        const esDeSesion = $('.n-tipo').value.indexOf('sesión de fotos') >= 0;
        $('.n-caja-sesion').classList.toggle('oculto', !esDeSesion);
        if (!esDeSesion) { $('.n-sesion').innerHTML = ''; return; }
        try {
            const datos = await P.pedir(API + '/faltas/sesiones?persona=' + encodeURIComponent($('.n-persona').value) +
                                        '&fecha=' + encodeURIComponent($('.n-fecha').value));
            $('.n-sesion').innerHTML = '<option value="">Ninguna de estas</option>' +
                datos.sesiones.map((s) => '<option>' + esc(s.texto) + '</option>').join('');
        } catch (error) {
            $('.n-sesion').innerHTML = '<option value="">Ninguna de estas</option>';
        }
    }
    $('.n-tipo').onchange = cargarSesiones;
    $('.n-fecha').onchange = cargarSesiones;
    cargarSesiones();

    $('.n-enviar').onclick = async (e) => {
        if (!$('.n-persona').value) { P.avisar('Elige a la persona.', 'malo'); return; }
        if (!$('.n-detalle').value.trim()) { P.avisar('Escribe el detalle.', 'malo'); return; }
        e.target.disabled = true;
        try {
            const r = await P.pedir(API + '/faltas', 'POST', {
                persona: $('.n-persona').value, tipo: $('.n-tipo').value, fecha: $('.n-fecha').value,
                detalle: $('.n-detalle').value.trim(), sesion: $('.n-sesion').value || '',
            });
            P.avisar(r.mensaje, 'bueno');
            cerrar();
            pintarFaltas();
        } catch (error) {
            P.avisar(error.message, 'malo');
            e.target.disabled = false;
        }
    };
}

/* ------------------------------------------------------------- Actividades */
const filtrosActividad = { persona: '', desde: '', hasta: '' };

async function pintarActividades() {
    const turno = ++estado.turno;
    filtrosActividad.desde = filtrosActividad.desde || hoy();
    filtrosActividad.hasta = filtrosActividad.hasta || hoy();
    cuerpo.innerHTML =
        '<div class="filtros-seguimiento">' +
        '<select id="a-persona" aria-label="Persona">' + opcionesPersonas(filtrosActividad.persona, true) + '</select>' +
        '<label>Desde <input id="a-desde" type="date" value="' + filtrosActividad.desde + '"></label>' +
        '<label>Hasta <input id="a-hasta" type="date" value="' + filtrosActividad.hasta + '"></label>' +
        '</div><div id="datos-actividad"><div class="cargando"><span class="girando">◌</span> Cargando…</div></div>';
    [['a-persona', 'persona'], ['a-desde', 'desde'], ['a-hasta', 'hasta']].forEach(([id, campo]) => {
        document.getElementById(id).onchange = (e) => { filtrosActividad[campo] = e.target.value; pintarActividades(); };
    });
    const destino = document.getElementById('datos-actividad');
    try {
        const d = await P.pedir(API + '/actividades?persona=' + encodeURIComponent(filtrosActividad.persona) +
            '&desde=' + filtrosActividad.desde + '&hasta=' + filtrosActividad.hasta);
        if (turno !== estado.turno) return;
        destino.innerHTML =
            '<div class="rejilla">' + d.cifras.map((c) => '<div class="tarjeta dato"><div class="rotulo">' + esc(c.rotulo) +
                '</div><div class="cifra">' + esc(c.cifra) + '</div></div>').join('') + '</div>' +
            '<div class="seccion tarjeta"><h2>Detalle</h2>' + (d.eventos.length ? d.eventos.map((e) =>
                '<div class="fila"><div class="principal"><div class="linea1 envuelve">' + esc(e.texto) + '</div>' +
                '<div class="linea2">' + (filtrosActividad.persona ? '' : esc(e.persona) + ' · ') + esc(e.modelo || '—') + ' · ' + esc(e.desde) + '</div></div>' +
                '<div class="lado">' + esc(e.fecha) + '<br>' + esc(e.hora) + '</div></div>').join('')
                : '<div class="vacio">Sin actividad registrada en esas fechas. Se cuenta desde que se publicó este módulo.</div>') + '</div>' +
            '<p class="nota-seguimiento">Del chat solo se cuenta con cuántas modelos interactuó; no se leen los mensajes.</p>';
    } catch (error) {
        destino.innerHTML = '<div class="vacio">' + esc(error.message) + '</div>';
    }
}

/* ------------------------------------------------------------- Pantallazos */
const filtrosCaptura = { persona: '', fecha: '' };

function horaLegible(hora) {
    const h = parseInt(hora.slice(0, 2), 10);
    return (h % 12 || 12) + ':' + hora.slice(2, 4) + (h < 12 ? ' a. m.' : ' p. m.');
}

async function pintarPantallazos() {
    const turno = ++estado.turno;
    filtrosCaptura.fecha = filtrosCaptura.fecha || hoy();
    cuerpo.innerHTML = '<div class="cargando"><span class="girando">◌</span> Cargando…</div>';
    let dia;
    try {
        dia = await P.pedir(API + '/capturas/dia?fecha=' + filtrosCaptura.fecha);
    } catch (error) {
        cuerpo.innerHTML = '<div class="vacio">' + esc(error.message) + '</div>';
        return;
    }
    if (turno !== estado.turno) return;
    if (!filtrosCaptura.persona && dia.personas.length) {
        const conCapturas = dia.personas.find((p) => p.capturas);
        filtrosCaptura.persona = (conCapturas || dia.personas[0]).nombre;
    }
    cuerpo.innerHTML =
        '<div class="filtros-seguimiento">' +
        '<select id="c-persona" aria-label="Persona">' + dia.personas.map((p) =>
            '<option value="' + esc(p.nombre) + '"' + (p.nombre === filtrosCaptura.persona ? ' selected' : '') + '>' +
            esc(p.nombre) + ' · ' + (p.capturas ? p.capturas + ' capturas' : 'sin capturas') + '</option>').join('') + '</select>' +
        '<input id="c-fecha" type="date" aria-label="Día" value="' + filtrosCaptura.fecha + '" max="' + hoy() + '">' +
        '</div><div id="capturas"><div class="cargando"><span class="girando">◌</span> Cargando…</div></div>' +
        '<p class="nota-seguimiento">Se guardan cada 10 minutos desde la Admin de escritorio y se borran solas a los 30 días.</p>';
    document.getElementById('c-persona').onchange = (e) => { filtrosCaptura.persona = e.target.value; pintarPantallazos(); };
    document.getElementById('c-fecha').onchange = (e) => { filtrosCaptura.fecha = e.target.value || hoy(); pintarPantallazos(); };
    const destino = document.getElementById('capturas');
    if (!filtrosCaptura.persona) { destino.innerHTML = '<div class="vacio">No hay personal.</div>'; return; }
    try {
        const d = await P.pedir(API + '/capturas?persona=' + encodeURIComponent(filtrosCaptura.persona) + '&fecha=' + filtrosCaptura.fecha);
        if (turno !== estado.turno) return;
        if (!d.horas.length) {
            destino.innerHTML = '<div class="vacio">Sin capturas: ese día no abrió la Admin en su computador. ' +
                'Lo que haga en la web o en el teléfono no genera pantallazos.</div>';
            return;
        }
        destino.innerHTML = '<div class="rejilla-capturas" id="rejilla-capturas"></div>' +
            '<button class="boton-secundario oculto" id="mas-capturas" style="width:100%;margin-top:12px">Mostrar más</button>';
        mostrarRondas(d.horas, 0, turno);
    } catch (error) {
        destino.innerHTML = '<div class="vacio">' + esc(error.message) + '</div>';
    }
}

async function mostrarRondas(horas, desde, turno) {
    const rejilla = document.getElementById('rejilla-capturas');
    const mas = document.getElementById('mas-capturas');
    const lote = horas.slice(desde, desde + RONDAS_POR_PAGINA);
    const pendientes = [];
    lote.forEach((ronda) => {
        const caja = document.createElement('div');
        caja.className = 'tarjeta ronda-captura';
        caja.innerHTML = '<div class="hora-captura">' + esc(horaLegible(ronda.hora)) + '</div><div class="pantallas-captura"></div>';
        const fila = caja.querySelector('.pantallas-captura');
        ronda.pantallas.forEach((p) => {
            const boton = document.createElement('button');
            boton.className = 'pantalla-captura';
            boton.textContent = 'Pantalla ' + p.numero;
            fila.appendChild(boton);
            pendientes.push({ boton: boton, id: p.id });
        });
        rejilla.appendChild(caja);
    });
    mas.classList.toggle('oculto', desde + RONDAS_POR_PAGINA >= horas.length);
    mas.onclick = () => mostrarRondas(horas, desde + RONDAS_POR_PAGINA, turno);
    // Una a la vez: no se le pide a Drive todo de golpe.
    for (const p of pendientes) {
        if (turno !== estado.turno) return;
        try {
            const url = await P.pedirArchivo(API + '/capturas/imagen?persona=' + encodeURIComponent(filtrosCaptura.persona) +
                '&fecha=' + filtrosCaptura.fecha + '&id=' + encodeURIComponent(p.id));
            const texto = p.boton.textContent;
            p.boton.innerHTML = '<img alt="' + esc(texto) + '" src="' + url + '">';
            p.boton.onclick = () => P.abrirVisor(url);
        } catch (error) {
            p.boton.textContent = 'No se pudo abrir';
        }
    }
}

/* ------------------------------------------------------------------ Inicio */
function pintar() {
    document.querySelectorAll('#pestanas .pestana').forEach((b) => b.classList.toggle('activa', b.dataset.p === estado.pestana));
    if (estado.pestana === 'faltas') pintarFaltas();
    else if (estado.pestana === 'actividades') pintarActividades();
    else pintarPantallazos();
}

P.iniciar('seguimiento').then(async () => {
    try {
        const datos = await P.pedir(API + '/personas');
        estado.personas = datos.personas || [];
        estado.tipos = datos.tipos_falta || [];
    } catch (error) {
        cuerpo.innerHTML = '<div class="vacio">' + esc(error.message) + '</div>';
        return;
    }
    document.querySelectorAll('#pestanas .pestana').forEach((b) => {
        b.onclick = () => { estado.pestana = b.dataset.p; pintar(); };
    });
    filtrosFaltas.mes = '';
    pintar();
});
})();
