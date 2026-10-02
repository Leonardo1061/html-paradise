/* ===========================================================================
 * PARADISE · Plan de trabajo de las modelos (plan.html)
 * ===========================================================================
 *
 * QUÉ HACE ESTE ARCHIVO
 * ---------------------
 * Pinta el plan y manda a la API lo que la modelo toca. Nada más. Las reglas
 * —qué se puede quitar, cuántos minutos hay que reponer, qué duraciones
 * valen— viven en la API (`plan.py`, que usa una copia exacta del archivo de
 * reglas del escritorio). Aquí no se repiten: se repiten los contadores que
 * ella necesita VER mientras elige, pero quien decide es el servidor.
 *
 * DESPUÉS DE CADA CAMBIO SE REPINTA CON LO QUE DEVUELVE LA API
 * -----------------------------------------------------------
 * Cada endpoint devuelve la semana entera tal como quedó en Firestore. Así,
 * si el monitor cambió algo desde su equipo al mismo tiempo, se ve en el
 * acto, y la pantalla nunca enseña algo que no esté guardado.
 *
 * LA SESIÓN
 * ---------
 * El token lo da el login (index.html) y lo guarda en localStorage. La cédula
 * NO viaja al navegador: la API la saca de la sesión. Si el token caduca, se
 * vuelve al login.
 */

(function () {
'use strict';

const API = PARADISE.API_URL;

// ---------------------------------------------------------------- estado
const estado = {
    token: localStorage.getItem('token_sesion') || '',
    nombre: localStorage.getItem('modelo_actual') || '',
    semana: 0,              // 0 esta · 1 la anterior · -1 la próxima
    dia: '',                // «Viernes»
    datos: null,            // la semana que devolvió la API
    catalogo: [],
    duraciones: [15, 30, 45, 60],
    reemplazando: null,     // el bloque del monitor que se está sustituyendo
    elegidos: [],           // shows elegidos para ese reemplazo
    vigilando: null,        // temporizador que mira si el monitor cambió algo
};

const $ = (id) => document.getElementById(id);
const capas = $('capas');

function escapar(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function textoMinutos(total) {
    const horas = Math.floor((total || 0) / 60), resto = (total || 0) % 60;
    if (horas && resto) return horas + ' h ' + resto + ' min';
    if (horas) return horas + ' h';
    return resto + ' min';
}

// ---------------------------------------------------------------- avisos
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

// ---------------------------------------------------------------- la API
async function pedir(ruta, metodo, cuerpo) {
    const respuesta = await fetch(API + ruta, {
        method: metodo || 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + estado.token,
        },
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

/* Envoltorio de las acciones: manda, repinta y enseña el error si lo hay.
   Los mensajes de la API están escritos para la modelo: se enseñan tal cual. */
async function accion(ruta, cuerpo, bien) {
    try {
        estado.datos = await pedir(ruta, 'POST', Object.assign({ semana: estado.semana }, cuerpo));
        pintar();
        if (bien) avisar(bien, 'bueno');
    } catch (error) {
        avisar(error.message, 'malo');
    }
}

// =======================================================================
// CARGA
// =======================================================================
async function cargar() {
    if (!estado.token) {
        avisar('Entra con tu nombre y tu contraseña para ver tu plan.', 'malo');
        setTimeout(() => { window.location.href = PARADISE.URL_LOGIN; }, 1500);
        return;
    }
    try {
        const [semana, catalogo] = await Promise.all([
            pedir('/api/plan/semana?indice=' + estado.semana),
            pedir('/api/plan/catalogo'),
        ]);
        estado.datos = semana;
        estado.catalogo = catalogo.shows || [];
        estado.duraciones = catalogo.duraciones || estado.duraciones;
        if (!estado.dia) estado.dia = semana.hoy || (semana.dias[0] || {}).dia;
        $('cargando').classList.add('oculto');
        $('dia').classList.remove('oculto');
        pintar();
        bienvenida(revisarAlMonitor(true));
        vigilar();
    } catch (error) {
        $('cargando').innerHTML = 'No se pudo cargar tu plan.<br><small>' +
            escapar(error.message) + '</small>';
    }
}

// =======================================================================
// LO QUE HIZO EL MONITOR
// =======================================================================
/* El plan lo escriben dos personas desde dos equipos. Esto compara lo que
 * puso el monitor con lo que había la última vez que ella entró, y se lo
 * dice: en el escritorio lo ve al momento porque hay un listener abierto;
 * aquí se mira al entrar y cada dos minutos, que para un turno sobra y no
 * convierte la página en una lectura constante de la base. */
function firmaDelMonitor() {
    const trozos = [];
    (estado.datos.dias || []).forEach((dia) => {
        (dia.bloques || []).forEach((bloque) => {
            if (bloque.es_del_monitor) {
                trozos.push(dia.dia + '|' + bloque.id + '|' + bloque.duracion + '|' + bloque.estado);
            }
        });
    });
    return trozos.join('~');
}

function revisarAlMonitor(guardarSiempre) {
    const clave = 'plan_monitor_' + (estado.datos.semana_inicio || '');
    const ahora = firmaDelMonitor();
    let anterior = null;
    try { anterior = localStorage.getItem(clave); } catch (e) { anterior = null; }

    const cambio = anterior !== null && anterior !== ahora;
    if (guardarSiempre || cambio) {
        try { localStorage.setItem(clave, ahora); } catch (e) { /* sin storage, no pasa nada */ }
    }
    return cambio;
}

function vigilar() {
    if (estado.vigilando) return;
    estado.vigilando = setInterval(async () => {
        // Ni con la pestaña en segundo plano ni con una hoja abierta: no se
        // le repinta el plan por debajo mientras está eligiendo un show.
        if (document.visibilityState !== 'visible') return;
        if (capas.innerHTML) return;
        try {
            const fresca = await pedir('/api/plan/semana?indice=' + estado.semana);
            const antes = JSON.stringify(estado.datos.dias);
            estado.datos = fresca;
            if (JSON.stringify(fresca.dias) !== antes) pintar();
            if (revisarAlMonitor(false)) {
                avisar('Tu monitor acaba de cambiar tu plan. Ya lo tienes actualizado.', 'malo');
            }
        } catch (error) { /* un fallo de red no tiene que molestarla */ }
    }, 120000);
}

// =======================================================================
// BIENVENIDA AL ABRIR EL PROGRAMADOR
// =======================================================================
/* Lo que el escritorio enseña en su barra de avisos, aquí en una tarjeta al
 * entrar: qué le programó el monitor, qué le falta y por dónde sigue. Sale
 * una vez al día por dispositivo; si vuelve a abrir el programador a media
 * tarde no le estorba. */
function bienvenida(huboCambios) {
    const dia = (estado.datos.dias || []).find((d) => d.es_hoy);
    if (!dia || estado.semana !== 0) return;

    const marca = 'plan_bienvenida';
    let visto = null;
    try { visto = localStorage.getItem(marca); } catch (e) { visto = null; }
    if (visto === dia.fecha && !huboCambios) return;
    try { localStorage.setItem(marca, dia.fecha); } catch (e) { /* da igual */ }

    const bloques = dia.bloques || [];
    const delMonitor = bloques.filter((b) => b.es_del_monitor && b.efectivo);
    const resumen = dia.resumen;
    const actual = bloques.find((b) => b.id === dia.id_actual);

    const lineas = [];

    if (huboCambios) {
        lineas.push(linea('🔔', 'Tu monitor <b>cambió tu plan</b> desde la última vez que entraste.', 'ojo'));
    }
    if (delMonitor.length) {
        const minutos = delMonitor.reduce((t, b) => t + b.duracion, 0);
        lineas.push(linea('📋', 'Tu monitor te programó <b>' + delMonitor.length + ' show' +
            (delMonitor.length > 1 ? 's' : '') + '</b> (' + textoMinutos(minutos) + ').'));
    }
    if (!bloques.length) {
        lineas.push(linea('🗓️', 'Hoy todavía <b>no tienes nada programado</b>. Arma tu turno ahora y ' +
            'llega con el plan hecho.', 'ojo'));
    } else if (resumen.pendientes) {
        lineas.push(linea('⏳', 'Te faltan <b>' + resumen.pendientes + ' show' +
            (resumen.pendientes > 1 ? 's' : '') + '</b> · ' + resumen.texto_pendientes + '.'));
    } else {
        lineas.push(linea('✅', '<b>Ya hiciste todo lo de hoy</b> (' + resumen.texto_minutos + ').', 'bien'));
    }
    if (actual) {
        lineas.push(linea(actual.icono, (actual.en_curso ? 'En vivo ahora: ' : 'Lo siguiente: ') +
            '<b>' + escapar(actual.nombre_show) + '</b> · ' + actual.duracion + ' min.'));
    }

    const principal = actual
        ? '<button class="boton-principal ancho" id="b-empezar">' +
          (actual.en_curso ? 'Seguir con mi turno' : '▶ Empezar ' + escapar(actual.nombre_show)) + '</button>'
        : '<button class="boton-principal ancho" id="b-armar">+ Armar mi turno de hoy</button>';

    capas.innerHTML = '<div class="centrado" id="velo-bienvenida"><div class="bienvenida">' +
        '<h3>Hola' + (estado.nombre ? ', ' + escapar(estado.nombre.split(' ')[0]) : '') + '</h3>' +
        '<div class="fecha">' + escapar(dia.dia) + ' ' + dia.dia_mes + ' · tu turno de hoy</div>' +
        lineas.join('') +
        '<div style="margin-top:18px">' + principal +
        '<button class="boton-saltar" style="width:100%;margin-top:8px" id="b-cerrar">Ver mi plan</button>' +
        '</div></div></div>';

    $('b-cerrar').onclick = cerrarHoja;
    $('velo-bienvenida').onclick = (evento) => {
        if (evento.target.id === 'velo-bienvenida') cerrarHoja();
    };
    const armar = $('b-armar');
    if (armar) armar.onclick = () => { cerrarHoja(); abrirCatalogo(); };
    const empezar = $('b-empezar');
    if (empezar) empezar.onclick = () => {
        cerrarHoja();
        if (!actual.en_curso) accion('/api/plan/empezar', { dia: dia.dia, id: actual.id });
    };
}

function linea(simbolo, texto, tono) {
    return '<div class="linea ' + (tono || '') + '"><span class="simbolo">' + simbolo +
           '</span><span>' + texto + '</span></div>';
}

async function cambiarSemana(indice) {
    estado.semana = indice;
    $('cargando').classList.remove('oculto');
    $('dia').classList.add('oculto');
    try {
        estado.datos = await pedir('/api/plan/semana?indice=' + indice);
        // Al cambiar de semana se mantiene el día elegido; si es la semana en
        // curso, se vuelve a hoy, que es lo que ella quiere ver.
        if (indice === 0 && estado.datos.hoy) estado.dia = estado.datos.hoy;
        $('cargando').classList.add('oculto');
        $('dia').classList.remove('oculto');
        pintar();
    } catch (error) {
        avisar(error.message, 'malo');
    }
}

// =======================================================================
// PINTAR
// =======================================================================
function diaActual() {
    return (estado.datos.dias || []).find((d) => d.dia === estado.dia) ||
           (estado.datos.dias || [])[0];
}

function pintar() {
    pintarCabecera();
    pintarDias();
    pintarDia();
}

function pintarCabecera() {
    $('quien').textContent = estado.nombre || '';
    const titulos = { 0: 'Esta semana', 1: 'Semana anterior', '-1': 'Próxima semana' };
    $('semana-titulo').textContent = titulos[estado.semana] || 'Semana';
    $('semana-rango').textContent = estado.datos.etiqueta || '';
    // Hacia atrás, el historial; hacia delante, solo la próxima: más allá no
    // hay nada que programar todavía.
    $('semana-atras').disabled = estado.semana >= 4;
    $('semana-adelante').disabled = estado.semana <= -1;
}

function pintarDias() {
    const contenedor = $('dias');
    contenedor.innerHTML = '';
    (estado.datos.dias || []).forEach((dia) => {
        const boton = document.createElement('button');
        boton.className = 'dia' +
            (dia.dia === estado.dia ? ' activo' : '') +
            (dia.es_hoy ? ' hoy' : '') +
            (dia.resumen.bloques ? ' lleno' : '');
        boton.innerHTML = '<div class="letra">' + escapar(dia.inicial) + '</div>' +
                          '<div class="numero">' + dia.dia_mes + '</div>';
        boton.onclick = () => { estado.dia = dia.dia; pintar(); };
        contenedor.appendChild(boton);
    });
}

function pintarDia() {
    const dia = diaActual();
    const caja = $('dia');
    if (!dia) { caja.innerHTML = ''; return; }

    const resumen = dia.resumen;
    const partes = [];
    partes.push('<div class="titulo-dia"><div>' +
        '<h2>Turno: ' + escapar(dia.dia) + ' ' + dia.dia_mes + '</h2>' +
        '<div class="resumen">' +
            (resumen.bloques ? resumen.bloques + ' bloques · ' + resumen.texto_minutos +
                (resumen.pendientes ? ' · faltan ' + resumen.texto_pendientes : ' · todo hecho')
             : 'Sin shows programados todavía') +
        '</div></div>' +
        '<div class="derecha"><button class="boton-principal" id="btn-anadir">+ Añadir show</button></div>' +
        '</div>');

    const bloques = dia.bloques || [];
    if (!bloques.length) {
        partes.push('<div class="vacio"><div class="emoji">🗓️</div>' +
            '<p>Este día está libre. Añade tu primer show y arma tu turno.</p>' +
            '<button class="boton-principal ancho" id="btn-vacio">+ Añadir el primero</button>' +
            '<div id="sugerencia" style="margin-top:14px"></div></div>');
    } else {
        bloques.forEach((bloque) => {
            partes.push(bloque.id === dia.id_actual ? tarjetaEnVivo(bloque)
                                                    : tarjetaBloque(bloque));
        });
        partes.push('<button class="hueco" id="btn-hueco">+ Añadir otro show al turno</button>');
    }

    caja.innerHTML = partes.join('');
    conectarDia(dia);
}

/* --- tarjeta pequeña (modo planeación) ------------------------------- */
function tarjetaBloque(bloque) {
    const clases = ['bloque', bloque.vibra];
    if (bloque.estado === 'completado' || bloque.estado === 'saltado') clases.push('hecho');
    if (bloque.estado === 'reemplazado') clases.push('reemplazado');

    const etiquetas = [];
    etiquetas.push('<span class="chip ' + bloque.vibra + '">' + escapar(bloque.etiqueta_vibra) + '</span>');
    etiquetas.push('<span class="chip">' + bloque.duracion + ' min</span>');
    if (bloque.es_del_monitor) etiquetas.push('<span class="chip monitor">De tu monitor</span>');
    if (bloque.reemplaza) etiquetas.push('<span class="chip mia">Lo pusiste tú</span>');
    if (bloque.estado === 'completado') etiquetas.push('<span class="chip">✓ Hecho</span>');
    if (bloque.estado === 'saltado') etiquetas.push('<span class="chip">Saltado</span>');
    if (bloque.estado === 'reemplazado') etiquetas.push('<span class="chip">Lo cambiaste</span>');

    const acciones = bloque.abierto ? (
        '<div class="acciones">' +
        '<button class="mini" data-mover="-1" data-id="' + bloque.id + '" title="Subir">▲</button>' +
        '<button class="mini" data-mover="1"  data-id="' + bloque.id + '" title="Bajar">▼</button>' +
        '<button class="mini" data-quitar="' + bloque.id + '" title="Quitar">✕</button>' +
        '</div>') : '';

    return '<div class="' + clases.join(' ') + '">' +
        '<div class="icono-tile">' + escapar(bloque.icono) + '</div>' +
        '<div class="texto" data-ficha="' + bloque.id_show + '" data-bloque="' + bloque.id + '">' +
            '<div class="nombre">' + escapar(bloque.nombre_show) + '</div>' +
            '<div class="meta">' + etiquetas.join('') + '</div>' +
        '</div>' + acciones + '</div>';
}

/* --- tarjeta grande «En vivo» ---------------------------------------- */
function tarjetaEnVivo(bloque) {
    const show = estado.catalogo.find((s) => s.id === bloque.id_show) || {};
    const tipo = show.tipo_tarjeta || 'pasos';
    const cuerpo = [];

    if (tipo === 'mindset') {
        if (show.tema_habitacion) cuerpo.push('<div class="frase">"' + escapar(show.tema_habitacion) + '"</div>');
        if (show.mindset) cuerpo.push('<div class="mindset"><b>Actitud:</b> ' + escapar(show.mindset) + '</div>');
    } else if (tipo === 'goals') {
        cuerpo.push('<div class="goals">' + (show.goals || []).map((goal) =>
            '<div class="goal"><span class="accion">' + escapar(goal.accion) + '</span>' +
            '<span class="precio">🪙 ' + goal.tokens + '</span></div>').join('') + '</div>');
    }

    if ((show.pasos || []).length) {
        const hechos = bloque.pasos_hechos || [];
        cuerpo.push('<ul class="pasos">' + show.pasos.map((paso, i) =>
            '<li class="paso' + (hechos.indexOf(i) >= 0 ? ' hecho' : '') + '">' +
            '<button class="marca" data-paso="' + i + '" data-id="' + bloque.id + '" ' +
                    'data-hecho="' + (hechos.indexOf(i) >= 0 ? '1' : '0') + '">' +
                (hechos.indexOf(i) >= 0 ? '✓' : '') + '</button>' +
            '<span>' + escapar(paso) + '</span></li>').join('') + '</ul>');
    }

    if (tipo !== 'mindset' && show.mindset) {
        cuerpo.push('<div class="mindset"><b>Mindset:</b> ' + escapar(show.mindset) + '</div>');
    }
    if (show.playlist) {
        cuerpo.push('<div class="mindset">🎵 ' + escapar(show.playlist) + '</div>');
    }

    const botones = bloque.en_curso
        ? '<button class="boton-saltar" data-detener="' + bloque.id + '" title="Volver a pendiente">⏸</button>' +
          '<button class="boton-saltar" data-estado="saltado" data-id="' + bloque.id + '">⏭ Saltar</button>' +
          '<button class="boton-principal" style="flex:1" data-estado="completado" data-id="' + bloque.id + '">Completado ✓</button>'
        : '<button class="boton-saltar" data-estado="saltado" data-id="' + bloque.id + '">⏭ Saltar</button>' +
          '<button class="boton-principal" style="flex:1" data-empezar="' + bloque.id + '">▶ Empezar este show</button>';

    return '<div class="envivo ' + bloque.vibra + '">' +
        '<div class="ahora">' + (bloque.en_curso ? '● En vivo ahora' : 'Lo siguiente en tu turno') + '</div>' +
        '<div class="encabezado">' +
            '<div class="icono-tile">' + escapar(bloque.icono) + '</div>' +
            '<div style="flex:1"><h3>' + escapar(bloque.nombre_show) + '</h3>' +
                '<div class="meta" style="margin-top:6px">' +
                '<span class="chip ' + bloque.vibra + '">' + escapar(bloque.etiqueta_vibra) + '</span>' +
                '<span class="chip">' + bloque.duracion + ' min</span>' +
                (bloque.es_del_monitor ? '<span class="chip monitor">De tu monitor</span>' : '') +
                (show.personalizado ? '<span class="chip mia">✏️ Mi versión</span>' : '') +
                '</div></div>' +
            '<button class="mini" data-ficha="' + bloque.id_show + '" title="Ver ficha">⋯</button>' +
        '</div>' +
        cuerpo.join('') +
        '<div class="botones">' + botones + '</div>' +
        '</div>';
}

/* --- enganchar los clics del día ------------------------------------- */
function conectarDia(dia) {
    const caja = $('dia');

    const anadir = $('btn-anadir'); if (anadir) anadir.onclick = () => abrirCatalogo();
    const vacio = $('btn-vacio');   if (vacio)  vacio.onclick  = () => abrirCatalogo();
    const hueco = $('btn-hueco');   if (hueco)  hueco.onclick  = () => abrirCatalogo();

    caja.querySelectorAll('[data-mover]').forEach((boton) => {
        boton.onclick = () => accion('/api/plan/mover', {
            dia: dia.dia, id: boton.dataset.id,
            desplazamiento: parseInt(boton.dataset.mover, 10),
        });
    });

    caja.querySelectorAll('[data-quitar]').forEach((boton) => {
        boton.onclick = () => quitar(dia, boton.dataset.quitar);
    });

    caja.querySelectorAll('[data-empezar]').forEach((boton) => {
        boton.onclick = () => accion('/api/plan/empezar', { dia: dia.dia, id: boton.dataset.empezar });
    });
    caja.querySelectorAll('[data-detener]').forEach((boton) => {
        boton.onclick = () => accion('/api/plan/detener', { dia: dia.dia, id: boton.dataset.detener });
    });
    caja.querySelectorAll('[data-estado]').forEach((boton) => {
        boton.onclick = () => accion('/api/plan/estado',
            { dia: dia.dia, id: boton.dataset.id, estado: boton.dataset.estado });
    });
    caja.querySelectorAll('[data-paso]').forEach((boton) => {
        boton.onclick = () => accion('/api/plan/paso', {
            dia: dia.dia, id: boton.dataset.id,
            indice: parseInt(boton.dataset.paso, 10),
            hecho: boton.dataset.hecho !== '1',
        });
    });
    caja.querySelectorAll('[data-ficha]').forEach((elemento) => {
        elemento.onclick = () => {
            const show = estado.catalogo.find((s) => s.id === elemento.dataset.ficha);
            if (show) abrirFicha(show, elemento.dataset.bloque || '');
            else avisar('Ese show ya no está en el catálogo del estudio.', 'malo');
        };
    });

    if (!(dia.bloques || []).length) sugerir(dia);
}

/* Cuando el día está vacío, la API propone el siguiente show (misma regla
   que el escritorio: rota Soft → Mid → High y evita lo recién hecho). */
async function sugerir(dia) {
    try {
        const respuesta = await pedir('/api/plan/sugerencia?dia=' +
            encodeURIComponent(dia.dia) + '&semana=' + estado.semana);
        const caja = $('sugerencia');
        if (!caja || !respuesta.show) return;
        const show = respuesta.show;
        caja.innerHTML = '<div class="aviso-minutos">Te propongo empezar con ' +
            escapar(show.icono) + ' <b>' + escapar(show.nombre) + '</b> (' +
            escapar(show.etiqueta_vibra) + ', ' + show.duracion_sugerida + ' min).</div>' +
            '<button class="boton-icono" id="btn-sugerido">Añadirlo al turno</button>';
        $('btn-sugerido').onclick = () => accion('/api/plan/agregar',
            { dia: dia.dia, id_show: show.id }, show.nombre + ' añadido.');
    } catch (error) { /* la sugerencia es un extra: si falla, no se dice nada */ }
}

// =======================================================================
// QUITAR / REEMPLAZAR
// =======================================================================
function quitar(dia, idBloque) {
    const bloque = (dia.bloques || []).find((b) => b.id === idBloque);
    if (!bloque) return;

    // Un bloque del monitor no se quita: se REEMPLAZA por otros que sumen al
    // menos sus minutos. La API lo impide igual; aquí se le ofrece el camino
    // bueno en vez de un error.
    if (bloque.es_del_monitor) {
        estado.reemplazando = bloque;
        estado.elegidos = [];
        abrirCatalogo();
        return;
    }
    accion('/api/plan/quitar', { dia: dia.dia, id: idBloque });
}

// =======================================================================
// HOJAS
// =======================================================================
function cerrarHoja() {
    capas.innerHTML = '';
    estado.reemplazando = null;
    estado.elegidos = [];
}

function abrirHoja(titulo, cuerpo, pie) {
    capas.innerHTML =
        '<div class="velo" id="velo"></div>' +
        '<div class="hoja">' +
            '<div class="hoja-cabecera"><h3>' + titulo + '</h3>' +
                '<button class="cerrar" id="cerrar-hoja">✕</button></div>' +
            '<div class="hoja-cuerpo" id="hoja-cuerpo">' + cuerpo + '</div>' +
            (pie ? '<div class="hoja-pie" id="hoja-pie">' + pie + '</div>' : '') +
        '</div>';
    $('velo').onclick = cerrarHoja;
    $('cerrar-hoja').onclick = cerrarHoja;
}

/* --- catálogo --------------------------------------------------------- */
const filtros = { texto: '', clave: 'todos' };

function abrirCatalogo() {
    filtros.texto = '';
    filtros.clave = 'todos';

    const reemplazo = estado.reemplazando;
    const titulo = reemplazo
        ? 'Reemplazar «' + escapar(reemplazo.nombre_show) + '»'
        : 'Biblioteca de shows';

    const aviso = reemplazo
        ? '<div class="aviso-minutos" id="contador">Tu monitor puso ' +
          '<b>' + escapar(reemplazo.nombre_show) + '</b> (' + reemplazo.duracion + ' min). ' +
          'Elige uno o varios shows que sumen al menos esos minutos.</div>'
        : '';

    abrirHoja(titulo,
        aviso +
        '<input class="buscador" id="buscar" placeholder="Buscar shows…" autocomplete="off">' +
        '<div class="filtros" id="filtros"></div>' +
        '<div id="lista-shows"></div>',
        reemplazo ? '<button class="boton-principal ancho" id="btn-confirmar">Reemplazar</button>' : '');

    const botones = [
        ['todos', 'Todos'], ['tokens', '🪙 + Tokens'], ['cortos', '🕐 Cortos'],
        ['soft', '❄ Soft'], ['mid', '👗 Mid'], ['high', '🔥 High'],
    ];
    $('filtros').innerHTML = botones.map(([clave, texto]) =>
        '<button class="filtro' + (clave === filtros.clave ? ' activo' : '') +
        '" data-filtro="' + clave + '">' + texto + '</button>').join('');
    $('filtros').querySelectorAll('[data-filtro]').forEach((boton) => {
        boton.onclick = () => {
            filtros.clave = boton.dataset.filtro;
            $('filtros').querySelectorAll('.filtro').forEach((b) => b.classList.remove('activo'));
            boton.classList.add('activo');
            pintarShows();
        };
    });

    $('buscar').oninput = (evento) => {
        filtros.texto = evento.target.value.trim().toLowerCase();
        pintarShows();
    };

    if (reemplazo) $('btn-confirmar').onclick = confirmarReemplazo;
    pintarShows();
}

function showsFiltrados() {
    return estado.catalogo.filter((show) => {
        if (filtros.texto) {
            const saco = (show.nombre + ' ' + show.descripcion_corta + ' ' +
                          show.mindset + ' ' + (show.pasos || []).join(' ')).toLowerCase();
            if (saco.indexOf(filtros.texto) < 0) return false;
        }
        if (filtros.clave === 'tokens') return show.es_rentable;
        if (filtros.clave === 'cortos') return show.es_corto;
        if (['soft', 'mid', 'high'].indexOf(filtros.clave) >= 0) return show.vibra === filtros.clave;
        return true;
    });
}

function pintarShows() {
    const lista = showsFiltrados();
    const caja = $('lista-shows');
    if (!lista.length) {
        caja.innerHTML = '<div class="vacio"><p>No hay shows con ese filtro.</p></div>';
        return;
    }

    const carriles = [
        ['high', '🔥 High Vibe · clímax y horas pico'],
        ['mid',  '👗 Mid Vibe · subir la temperatura'],
        ['soft', '❄ Soft Vibe · conectar y fidelizar'],
    ];

    caja.innerHTML = carriles.map(([vibra, titulo]) => {
        const suyos = lista.filter((s) => s.vibra === vibra);
        if (!suyos.length) return '';
        return '<div class="carril-titulo ' + vibra + '">' + titulo + '</div>' +
               suyos.map(filaShow).join('');
    }).join('');

    caja.querySelectorAll('[data-abrir]').forEach((fila) => {
        fila.onclick = () => {
            const show = estado.catalogo.find((s) => s.id === fila.dataset.abrir);
            if (!show) return;
            if (estado.reemplazando) alternarElegido(show);
            else abrirFicha(show, '');
        };
    });
    caja.querySelectorAll('[data-agregar]').forEach((boton) => {
        boton.onclick = (evento) => {
            evento.stopPropagation();
            const show = estado.catalogo.find((s) => s.id === boton.dataset.agregar);
            if (!show) return;
            if (estado.reemplazando) { alternarElegido(show); return; }
            cerrarHoja();
            accion('/api/plan/agregar', { dia: estado.dia, id_show: show.id },
                   show.nombre + ' añadido a tu ' + estado.dia.toLowerCase() + '.');
        };
    });
}

function filaShow(show) {
    const elegido = estado.elegidos.some((e) => e.id === show.id);
    return '<button class="fila-show' + (elegido ? ' elegido' : '') + '" data-abrir="' + show.id + '">' +
        '<div class="icono-tile">' + escapar(show.icono) + '</div>' +
        '<div style="flex:1;min-width:0">' +
            '<div class="nombre">' + escapar(show.nombre) +
                (show.personalizado ? ' <span class="chip mia">✏️ mi versión</span>' : '') + '</div>' +
            (show.descripcion_corta
                ? '<div class="descripcion">' + escapar(show.descripcion_corta) + '</div>' : '') +
            '<div class="meta" style="margin-top:6px">' +
                '<span class="chip ' + show.vibra + '">' + escapar(show.etiqueta_vibra) + '</span>' +
                '<span class="chip">' + show.duracion_sugerida + ' min</span>' +
                (show.tokens_maximos ? '<span class="chip">🪙 hasta ' + show.tokens_maximos + '</span>' : '') +
            '</div>' +
        '</div>' +
        '<div class="mas" data-agregar="' + show.id + '">' + (elegido ? '✓' : '+') + '</div>' +
        '</button>';
}

/* --- reemplazo: ir sumando minutos ------------------------------------ */
function alternarElegido(show) {
    const posicion = estado.elegidos.findIndex((e) => e.id === show.id);
    if (posicion >= 0) estado.elegidos.splice(posicion, 1);
    else estado.elegidos.push({ id: show.id, nombre: show.nombre,
                                duracion: show.duracion_sugerida });
    pintarShows();
    pintarContador();
}

function pintarContador() {
    const caja = $('contador');
    if (!caja || !estado.reemplazando) return;
    const suma = estado.elegidos.reduce((total, e) => total + e.duracion, 0);
    const falta = Math.max(0, estado.reemplazando.duracion - suma);
    caja.innerHTML = 'Tu monitor puso <b>' + escapar(estado.reemplazando.nombre_show) +
        '</b> (' + estado.reemplazando.duracion + ' min).<br>' +
        'Llevas <b>' + textoMinutos(suma) + '</b>' +
        (falta ? ' · te faltan <b>' + textoMinutos(falta) + '</b>' : ' · ya lo cubres ✓');
}

function confirmarReemplazo() {
    if (!estado.elegidos.length) { avisar('Elige al menos un show.', 'malo'); return; }
    const nuevos = estado.elegidos.map((e) => ({ id_show: e.id, duracion: e.duracion }));
    const bloque = estado.reemplazando;
    cerrarHoja();
    accion('/api/plan/reemplazar', { dia: estado.dia, id: bloque.id, nuevos: nuevos },
           'Listo: cambiaste «' + bloque.nombre_show + '».');
}

/* --- ficha del show --------------------------------------------------- */
function abrirFicha(show, idBloque) {
    const dia = diaActual();
    const bloque = idBloque ? (dia.bloques || []).find((b) => b.id === idBloque) : null;

    const partes = [];
    partes.push('<div class="encabezado" style="display:flex;gap:12px;align-items:flex-start">' +
        '<div class="icono-tile">' + escapar(show.icono) + '</div>' +
        '<div><div class="meta">' +
            '<span class="chip ' + show.vibra + '">' + escapar(show.etiqueta_vibra) + '</span>' +
            '<span class="chip">' + show.duracion_sugerida + ' min sugeridos</span>' +
            (show.personalizado ? '<span class="chip mia">✏️ Mi versión</span>' : '') +
        '</div>' +
        (show.descripcion_corta
            ? '<div class="descripcion" style="margin-top:8px;color:var(--tenue);font-size:13px">' +
              escapar(show.descripcion_corta) + '</div>' : '') +
        '</div></div>');

    if (show.tema_habitacion) partes.push('<div class="frase" style="margin-top:14px;color:#e879f9;font-style:italic">"' +
        escapar(show.tema_habitacion) + '"</div>');
    if (show.mindset) partes.push('<div class="mindset"><b>Mindset:</b> ' + escapar(show.mindset) + '</div>');

    if ((show.pasos || []).length) {
        partes.push('<ul class="pasos">' + show.pasos.map((paso) =>
            '<li class="paso"><span style="color:var(--mid)">•</span><span>' +
            escapar(paso) + '</span></li>').join('') + '</ul>');
    }
    if ((show.goals || []).length) {
        partes.push('<div class="goals">' + show.goals.map((goal) =>
            '<div class="goal"><span class="accion">' + escapar(goal.accion) + '</span>' +
            '<span class="precio">🪙 ' + goal.tokens + '</span></div>').join('') + '</div>');
        partes.push('<button class="boton-icono" style="margin-top:10px" id="btn-copiar-goals">' +
            '📋 Copiar el menú para la sala</button>');
    }
    if (show.playlist) partes.push('<div class="mindset">🎵 ' + escapar(show.playlist) + '</div>');
    if (show.video_referencia) partes.push('<div class="mindset">🎬 <a style="color:var(--mid)" target="_blank" rel="noopener" href="' +
        escapar(show.video_referencia) + '">Ver el video de referencia</a></div>');

    partes.push('<div id="imagenes" style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px"></div>');

    // Duración con la que se programa (píldoras, como en los PDF).
    if (!bloque) {
        partes.push('<div class="campo" style="margin-top:18px"><label>Duración del bloque</label>' +
            '<div class="opciones" id="duraciones">' + estado.duraciones.map((minutos) =>
                '<button class="opcion' + (minutos === show.duracion_sugerida ? ' activo' : '') +
                '" data-duracion="' + minutos + '">' + minutos + ' min</button>').join('') +
            '</div></div>');
    } else if (bloque.abierto) {
        partes.push('<div class="campo" style="margin-top:18px"><label>Cambiar la duración de este bloque</label>' +
            '<div class="opciones" id="duraciones-bloque">' + estado.duraciones.map((minutos) =>
                '<button class="opcion' + (minutos === bloque.duracion ? ' activo' : '') +
                '" data-duracion="' + minutos + '">' + minutos + ' min</button>').join('') +
            '</div></div>');
    }

    partes.push('<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:18px">' +
        '<button class="boton-icono" id="btn-editar">✏️ Editar solo para mí</button>' +
        (show.personalizado
            ? '<button class="boton-icono" id="btn-restaurar">↺ Volver al del estudio</button>' : '') +
        '</div>');

    const pie = bloque ? '' :
        '<button class="boton-principal ancho" id="btn-programar">📅 Programar en ' +
        escapar(estado.dia) + '</button>';

    abrirHoja(escapar(show.nombre), partes.join(''), pie);

    let duracion = show.duracion_sugerida;
    const grupo = $('duraciones');
    if (grupo) grupo.querySelectorAll('[data-duracion]').forEach((boton) => {
        boton.onclick = () => {
            duracion = parseInt(boton.dataset.duracion, 10);
            grupo.querySelectorAll('.opcion').forEach((b) => b.classList.remove('activo'));
            boton.classList.add('activo');
        };
    });

    const grupoBloque = $('duraciones-bloque');
    if (grupoBloque) grupoBloque.querySelectorAll('[data-duracion]').forEach((boton) => {
        boton.onclick = () => {
            cerrarHoja();
            accion('/api/plan/duracion', { dia: dia.dia, id: bloque.id,
                                           duracion: parseInt(boton.dataset.duracion, 10) });
        };
    });

    const programar = $('btn-programar');
    if (programar) programar.onclick = () => {
        cerrarHoja();
        accion('/api/plan/agregar', { dia: estado.dia, id_show: show.id, duracion: duracion },
               show.nombre + ' añadido a tu ' + estado.dia.toLowerCase() + '.');
    };

    const copiar = $('btn-copiar-goals');
    if (copiar) copiar.onclick = async () => {
        const texto = (show.goals || []).map((g) => g.accion + ' (' + g.tokens + 'tk)').join(' | ');
        try { await navigator.clipboard.writeText(texto); avisar('Menú copiado.', 'bueno'); }
        catch (e) { avisar('Tu navegador no deja copiar aquí. Mantén pulsado el texto.', 'malo'); }
    };

    $('btn-editar').onclick = () => abrirEditor(show);
    const restaurar = $('btn-restaurar');
    if (restaurar) restaurar.onclick = async () => {
        try {
            await pedir('/api/plan/restaurar', 'POST', { id_show: show.id });
            await recargarCatalogo();
            cerrarHoja();
            avisar('«' + show.nombre + '» vuelve a ser el del estudio.', 'bueno');
        } catch (error) { avisar(error.message, 'malo'); }
    };

    cargarImagenes(show);
}

async function cargarImagenes(show) {
    if (!(show.imagenes || []).length) return;
    try {
        const respuesta = await pedir('/api/plan/imagenes?ids=' + show.imagenes.join(','));
        const caja = $('imagenes');
        if (!caja) return;
        caja.innerHTML = Object.values(respuesta.imagenes || {}).map((dato) =>
            '<img src="' + (dato.startsWith('data:') ? dato : 'data:image/jpeg;base64,' + dato) +
            '" style="width:88px;height:88px;object-fit:cover;border-radius:12px;border:1px solid var(--borde)">'
        ).join('');
    } catch (error) { /* las imágenes son un extra */ }
}

/* --- editor «solo para mí» -------------------------------------------- */
function abrirEditor(show) {
    const vibras = [['soft', 'Soft'], ['mid', 'Mid'], ['high', 'High']];
    const tipos = [['pasos', 'Pasos'], ['mindset', 'Mindset'], ['goals', 'Menú de goals']];

    abrirHoja('Editar «' + escapar(show.nombre) + '» para mí',
        '<div class="aviso-minutos">Esto cambia el show <b>solo para ti</b>. El catálogo ' +
        'del estudio no se toca, y las demás modelos lo siguen viendo igual. ' +
        'Cada vez que lo programes, saldrá con tus cambios.</div>' +

        '<div class="campo"><label>Nombre</label>' +
        '<input id="e-nombre" maxlength="40" value="' + escapar(show.nombre) + '"></div>' +

        '<div class="campo"><label>Icono</label>' +
        '<input id="e-icono" maxlength="4" value="' + escapar(show.icono) + '"></div>' +

        '<div class="campo"><label>Vibra</label><div class="opciones" id="e-vibra">' +
        vibras.map(([clave, texto]) => '<button class="opcion' +
            (show.vibra === clave ? ' activo' : '') + '" data-valor="' + clave + '">' +
            texto + '</button>').join('') + '</div></div>' +

        '<div class="campo"><label>Duración sugerida</label><div class="opciones" id="e-duracion">' +
        estado.duraciones.map((minutos) => '<button class="opcion' +
            (show.duracion_sugerida === minutos ? ' activo' : '') + '" data-valor="' + minutos + '">' +
            minutos + ' min</button>').join('') + '</div></div>' +

        '<div class="campo"><label>Cómo se presenta en vivo</label><div class="opciones" id="e-tipo">' +
        tipos.map(([clave, texto]) => '<button class="opcion' +
            (show.tipo_tarjeta === clave ? ' activo' : '') + '" data-valor="' + clave + '">' +
            texto + '</button>').join('') + '</div></div>' +

        '<div class="campo"><label>Descripción corta</label>' +
        '<input id="e-descripcion" maxlength="90" value="' + escapar(show.descripcion_corta) + '">' +
        '<div class="ayuda">La línea que ves en la biblioteca. Máximo 90 caracteres.</div></div>' +

        '<div class="campo"><label>Mindset (actitud)</label>' +
        '<textarea id="e-mindset" rows="3">' + escapar(show.mindset) + '</textarea></div>' +

        '<div class="campo"><label>Frase del tema de la sala</label>' +
        '<input id="e-tema" value="' + escapar(show.tema_habitacion) + '"></div>' +

        '<div class="campo"><label>Pasos (uno por línea)</label>' +
        '<textarea id="e-pasos" rows="5">' + escapar((show.pasos || []).join('\n')) + '</textarea>' +
        '<div class="ayuda">Máximo 7: los lees de reojo mientras transmites.</div></div>' +

        '<div class="campo"><label>Menú de goals (uno por línea: acción: tokens)</label>' +
        '<textarea id="e-goals" rows="5">' +
        escapar((show.goals || []).map((g) => g.accion + ': ' + g.tokens).join('\n')) +
        '</textarea><div class="ayuda">Ejemplo:  Mirada profunda 🔥: 20</div></div>' +

        '<div class="campo"><label>Playlist</label>' +
        '<input id="e-playlist" value="' + escapar(show.playlist) + '"></div>' +

        '<div class="campo"><label>Video de referencia (enlace)</label>' +
        '<input id="e-video" value="' + escapar(show.video_referencia) + '"></div>',

        '<button class="boton-principal ancho" id="btn-guardar">Guardar mi versión</button>');

    const elegidos = {
        vibra: show.vibra,
        duracion: show.duracion_sugerida,
        tipo: show.tipo_tarjeta,
    };
    [['e-vibra', 'vibra'], ['e-duracion', 'duracion'], ['e-tipo', 'tipo']].forEach(([id, campo]) => {
        $(id).querySelectorAll('[data-valor]').forEach((boton) => {
            boton.onclick = () => {
                elegidos[campo] = campo === 'duracion'
                    ? parseInt(boton.dataset.valor, 10) : boton.dataset.valor;
                $(id).querySelectorAll('.opcion').forEach((b) => b.classList.remove('activo'));
                boton.classList.add('activo');
            };
        });
    });

    $('btn-guardar').onclick = async () => {
        const goals = $('e-goals').value.split('\n').map((linea) => {
            const partido = linea.match(/^\s*(.+?)\s*[:=]\s*(\d+)\s*$/);
            return partido ? { accion: partido[1].trim(), tokens: parseInt(partido[2], 10) } : null;
        }).filter(Boolean);

        try {
            await pedir('/api/plan/mi_version', 'POST', {
                id_show: show.id,
                nombre: $('e-nombre').value.trim(),
                icono: $('e-icono').value.trim() || '✨',
                vibra: elegidos.vibra,
                duracion_sugerida: elegidos.duracion,
                tipo_tarjeta: elegidos.tipo,
                descripcion_corta: $('e-descripcion').value.trim(),
                mindset: $('e-mindset').value.trim(),
                tema_habitacion: $('e-tema').value.trim(),
                pasos: $('e-pasos').value.split('\n').map((p) => p.trim()).filter(Boolean),
                goals: goals,
                playlist: $('e-playlist').value.trim(),
                video_referencia: $('e-video').value.trim(),
            });
            await recargarCatalogo();
            cerrarHoja();
            avisar('Guardado. Ese show ahora sale con tus cambios.', 'bueno');
        } catch (error) {
            avisar(error.message, 'malo');
        }
    };
}

async function recargarCatalogo() {
    const catalogo = await pedir('/api/plan/catalogo');
    estado.catalogo = catalogo.shows || [];
    pintar();
}

// =======================================================================
// ARRANQUE
// =======================================================================
$('btn-turnos').onclick = () => { window.location.href = 'panel.html'; };
$('nav-inicio').onclick = () => { window.location.href = 'panel.html'; };
$('nav-status').onclick = () => { window.location.href = 'turnos.html'; };
$('nav-perfil').onclick = () => { window.location.href = 'panel.html#perfil'; };
$('nav-programador').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
$('btn-salir').onclick = () => {
    ['token_sesion', 'modelo_actual', 'jornada_actual', 'password_por_defecto']
        .forEach((clave) => localStorage.removeItem(clave));
    window.location.href = PARADISE.URL_LOGIN;
};
$('semana-atras').onclick = () => cambiarSemana(estado.semana + 1);
$('semana-adelante').onclick = () => cambiarSemana(estado.semana - 1);

document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape') cerrarHoja();
});

cargar();

})();
