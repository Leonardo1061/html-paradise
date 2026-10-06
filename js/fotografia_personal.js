/* ===========================================================================
 * PARADISE · Fotografía del personal (personal_fotografia.html)
 * ===========================================================================
 *
 * La misma pantalla que js/fotografia.js de las modelos, contra
 * `/api/personal/fotografia/…`. Las diferencias:
 *
 *   BLOQUE LIBRE      «Agendar» pide además la MODELO (cualquiera que la
 *                     persona vea) y acepta un estilo del portafolio.
 *   BLOQUE RESERVADO  ficha con la modelo, su celular y las fotos de
 *                     referencia; Programada / Asistió / No Asistió;
 *                     cancelar la sesión.
 *   PORTAFOLIO        «Agendar» lleva a la malla con el estilo elegido.
 *
 * La malla se vuelve a pedir cada 20 s con la página a la vista.
 */

(function () {
'use strict';

const P = window.Personal;
const escapar = P.escapar;
const avisar = P.avisar;
const $ = (id) => document.getElementById(id);

const CADA_MS = 20000;
const MAX_FOTOS = 4;
const TOPE_BASE64 = 850000;

const estado = {
    vista: 'agenda',
    indice: 0,
    semana: null,
    diaElegido: null,
    estilos: null,
    modelos: null,                 // a quién puede agendar
    pendiente: null,               // {id, nombre}: estilo del portafolio
    actualizada: 0,
    cargandoMalla: false,
};

const pedir = (ruta, metodo, cuerpo) => P.pedir('/api/personal/fotografia' + ruta, metodo, cuerpo);

function claseEstadoSesion(texto) {
    if (texto === 'Asistió') return 'asistio';
    if (texto === 'No Asistió') return 'no-asistio';
    return 'programada';
}

function sedeCorta(sede) { return /TROPIC/i.test(sede || '') ? 'Tropic' : 'Paradise'; }

function capas() { return $('capas-personal'); }

// =======================================================================
// AGENDA
// =======================================================================
async function cargarAgenda(silencioso) {
    if (estado.cargandoMalla) return;
    estado.cargandoMalla = true;
    try {
        const semana = await pedir('/semana?indice=' + estado.indice);
        estado.semana = semana;
        estado.actualizada = Date.now();
        if (!semana.dias.some((d) => d.fecha === estado.diaElegido)) {
            const hoy = semana.dias.find((d) => d.es_hoy);
            estado.diaElegido = (hoy || semana.dias[0]).fecha;
        }
        pintarAgenda();
    } catch (error) {
        if (!silencioso) {
            $('bloques').innerHTML = '<div class="cargando">No se pudo cargar la malla.<br><small>' +
                escapar(error.message) + '</small></div>';
        }
    } finally {
        estado.cargandoMalla = false;
    }
}

function textoSemana(indice) {
    if (indice === 0) return 'Esta semana';
    if (indice === 1) return 'La próxima semana';
    if (indice === -1) return 'La semana pasada';
    return indice > 0 ? 'En ' + indice + ' semanas' : 'Hace ' + (-indice) + ' semanas';
}

function pintarAgenda() {
    pintarPendiente();
    const semana = estado.semana;
    $('sem-rotulo').innerHTML = escapar(semana.etiqueta) +
        '<small>' + textoSemana(semana.indice) + ' · lunes a sábado</small>';
    $('sem-anterior').disabled = semana.indice <= semana.min_indice;
    $('sem-siguiente').disabled = semana.indice >= semana.max_indice;

    $('dias').innerHTML = semana.dias.map((dia) => {
        const libres = dia.bloques.filter((b) => b.estado === 'libre' && !b.pasado).length;
        const sesiones = dia.bloques.some((b) => b.estado === 'reservado');
        const partes = dia.etiqueta.split(' ');
        return '<button class="dia' + (dia.fecha === estado.diaElegido ? ' activo' : '') +
            '" data-fecha="' + dia.fecha + '">' +
            (sesiones ? '<span class="punto"></span>' : '') +
            '<span class="nombre">' + escapar(dia.es_hoy ? 'Hoy' : partes[0]) + '</span>' +
            '<span class="numero">' + escapar((partes[1] || '').split('/')[0]) + '</span>' +
            '<span class="libres">' + libres + ' libres</span></button>';
    }).join('');
    document.querySelectorAll('.dia').forEach((boton) => {
        boton.onclick = () => { estado.diaElegido = boton.dataset.fecha; pintarAgenda(); };
    });

    const dia = semana.dias.find((d) => d.fecha === estado.diaElegido) || semana.dias[0];
    let corteHecho = false;
    $('bloques').innerHTML = dia.bloques.map((bloque) => {
        let corte = '';
        if (!corteHecho && sedeCorta(bloque.sede) === 'Tropic') {
            corteHecho = true;
            corte = '<div class="corte-sede">Desde las 2:00 PM · Sede Tropic <span class="linea"></span></div>';
        }
        const clases = ['bloque', bloque.estado];
        if (bloque.pasado) clases.push('pasado');
        let lado;
        if (bloque.estado === 'reservado') {
            lado = '<div style="text-align:right"><div class="estado">' + escapar(bloque.nombre || 'Reservado') + '</div>' +
                '<div class="asunto">' + escapar(bloque.asunto) + '</div></div>' +
                '<span class="chapa ' + claseEstadoSesion(bloque.estado_sesion) + '">' +
                escapar(bloque.estado_sesion) + '</span>';
        } else if (bloque.estado === 'ocupado') {
            lado = '<span class="estado">Ocupado</span>';
        } else {
            lado = '<span class="estado">' + (bloque.pasado ? '—' : 'Libre ＋') + '</span>';
        }
        return corte + '<button class="' + clases.join(' ') + '" data-hora="' + bloque.hora_inicio + '">' +
            '<div><div class="hora">' + escapar(bloque.rango.split(' – ')[0]) + '</div>' +
            '<div class="sede">' + escapar(sedeCorta(bloque.sede)) + ' · 30 min</div></div>' +
            '<div class="lado">' + lado + '</div></button>';
    }).join('');

    document.querySelectorAll('.bloque').forEach((boton) => {
        boton.onclick = () => {
            const bloque = dia.bloques.find((b) => b.hora_inicio === boton.dataset.hora);
            if (!bloque) return;
            if (bloque.estado === 'reservado') abrirSesion(dia, bloque);
            else if (bloque.estado === 'libre' && !bloque.pasado) abrirAgendar(dia, bloque);
        };
    });
    pintarActualizada();
}

function pintarActualizada() {
    if (!estado.actualizada) return;
    const segundos = Math.round((Date.now() - estado.actualizada) / 1000);
    $('al-dia').textContent = 'Se actualiza sola · ' + (segundos < 5 ? 'ahora mismo' : 'hace ' + segundos + ' s');
}

function pintarPendiente() {
    const caja = $('pendiente');
    if (!estado.pendiente) { caja.innerHTML = ''; return; }
    caja.innerHTML = '<div class="pendiente"><div>Elige un bloque libre para la sesión ' +
        '<b>' + escapar(estado.pendiente.nombre) + '</b>.</div>' +
        '<button id="quitar-pendiente" title="Quitar">✕</button></div>';
    $('quitar-pendiente').onclick = () => { estado.pendiente = null; pintarPendiente(); };
}

// =======================================================================
// HOJAS
// =======================================================================
function cerrarHoja() { capas().innerHTML = ''; }

function abrirHoja(titulo, subtitulo, cuerpo) {
    capas().innerHTML = '<div class="velo" id="velo"></div>' +
        '<div class="hoja"><div class="hoja-cabecera"><div><h3>' + escapar(titulo) + '</h3>' +
            (subtitulo ? '<div class="sub">' + escapar(subtitulo) + '</div>' : '') + '</div>' +
            '<button class="cerrar" id="cerrar-hoja">✕</button></div>' +
        '<div class="hoja-cuerpo">' + cuerpo + '</div></div>';
    $('velo').onclick = cerrarHoja;
    $('cerrar-hoja').onclick = cerrarHoja;
}

async function modelos() {
    if (!estado.modelos) estado.modelos = (await pedir('/modelos')).modelos || [];
    return estado.modelos;
}

/* --- agendar a una modelo en un bloque libre ---------------------------- */
async function abrirAgendar(dia, bloque) {
    const fotos = [];
    let elegida = null;
    const estilo = estado.pendiente;

    abrirHoja('Agendar sesión de fotos',
        dia.nombre + ' ' + dia.fecha.slice(8, 10) + '/' + dia.fecha.slice(5, 7) + ' · ' +
        bloque.rango + ' · ' + bloque.sede,
        '<div class="campo"><label>Modelo</label><div id="f-modelos"><div class="cargando"><span class="girando">◌</span></div></div>' +
            '<div class="modelo-elegida" id="f-elegida"></div></div>' +
        '<div class="campo"><label>' + (estilo ? 'Sesión del portafolio' : 'Asunto de las fotos') + '</label>' +
            '<textarea id="f-asunto" maxlength="200" placeholder="Ej: Fotos para perfil">' +
            escapar(estilo ? estilo.nombre : '') + '</textarea></div>' +
        '<div class="campo"><label>Fotos de referencia (opcional, hasta ' + MAX_FOTOS + ')</label>' +
            '<div class="miniaturas" id="f-miniaturas"></div></div>' +
        '<button class="boton-principal" id="f-agendar">Agendar</button>');

    const pintarFotos = () => {
        const caja = $('f-miniaturas');
        if (!caja) return;
        caja.innerHTML = fotos.map((f, i) =>
            '<div class="miniatura"><img src="' + f + '" alt="Referencia ' + (i + 1) + '">' +
            '<button data-i="' + i + '" title="Quitar">✕</button></div>').join('') +
            (fotos.length < MAX_FOTOS ? '<button class="adjuntar" id="f-adjuntar"><span>＋</span>Adjuntar</button>' : '');
        caja.querySelectorAll('.miniatura button').forEach((b) => {
            b.onclick = () => { fotos.splice(parseInt(b.dataset.i, 10), 1); pintarFotos(); };
        });
        const adjuntar = $('f-adjuntar');
        if (adjuntar) adjuntar.onclick = () => elegirFotos(fotos, pintarFotos);
    };
    pintarFotos();

    $('f-agendar').onclick = async () => {
        if (!elegida) { avisar('Elige la modelo.', 'malo'); return; }
        const asunto = $('f-asunto').value.trim();
        if (!asunto) { avisar('Escribe el asunto de las fotos.', 'malo'); return; }
        const boton = $('f-agendar');
        boton.disabled = true;
        boton.textContent = 'Agendando…';
        try {
            const r = await pedir('/agendar', 'POST', {
                fecha: dia.fecha, hora_inicio: bloque.hora_inicio, cedula: elegida.cedula,
                asunto: asunto, fotos: fotos, portafolio_id: estilo ? estilo.id : '',
            });
            estado.pendiente = null;
            cerrarHoja();
            avisar(r.mensaje || 'Agendada.', 'bueno');
        } catch (error) {
            avisar(error.message, 'malo');
            if (error.codigo === 409) cerrarHoja();
            else { boton.disabled = false; boton.textContent = 'Agendar'; }
        }
        cargarAgenda(true);
    };

    try {
        const lista = await modelos();
        const caja = $('f-modelos');
        if (!caja) return;
        P.selectorModelos(caja, lista, (m) => {
            elegida = m;
            $('f-elegida').textContent = m ? '✓ ' + m.nombre + (m.jornada ? ' · ' + m.jornada : '') : '';
        });
    } catch (error) {
        const caja = $('f-modelos');
        if (caja) caja.innerHTML = '<div class="vacio">' + escapar(error.message) + '</div>';
    }
}

/* --- una sesión reservada: ficha, estado y cancelar --------------------- */
function abrirSesion(dia, bloque) {
    const fecha = dia.fecha.slice(8, 10) + '/' + dia.fecha.slice(5, 7);
    abrirHoja(bloque.nombre || 'Sesión de fotos', dia.nombre + ' ' + fecha + ' · ' + bloque.rango,
        '<div class="fila-dato"><span class="r">Sede</span><span>' + escapar(bloque.sede) + '</span></div>' +
        '<div class="fila-dato"><span class="r">Asunto</span><span>' + escapar(bloque.asunto) + '</span></div>' +
        (bloque.celular ? '<div class="fila-dato"><span class="r">Celular</span><a style="color:#a5f3fc" href="tel:' +
            escapar(bloque.celular) + '">' + escapar(bloque.celular) + '</a></div>' : '') +
        (bloque.creado_por ? '<div class="fila-dato"><span class="r">Agendó</span><span>' + escapar(bloque.creado_por) + '</span></div>' : '') +
        '<div class="fila-dato" style="border-bottom:0"><span class="r">Fotos</span><span id="f-refs">' +
            (bloque.referencias ? '<button class="boton-secundario" id="f-ver-refs">🖼️ Ver ' + bloque.referencias +
                ' de referencia</button>' : 'Sin fotos de referencia') + '</span></div>' +
        '<div class="campo" style="margin:12px 0 0"><label>Estado de la sesión</label></div>' +
        '<div class="botones-estado">' + (estado.semana.estados || []).map((e) =>
            '<button data-estado="' + escapar(e) + '" class="' + (e === bloque.estado_sesion ? 'elegido' : '') + '">' +
            escapar(e) + '</button>').join('') + '</div>' +
        '<button class="boton-peligro" id="f-cancelar">Cancelar esta sesión</button>');

    document.querySelectorAll('.botones-estado button').forEach((b) => {
        b.onclick = async () => {
            if (b.dataset.estado === bloque.estado_sesion) return;
            b.disabled = true;
            try {
                const r = await pedir('/estado', 'POST',
                    { fecha: dia.fecha, hora_inicio: bloque.hora_inicio, estado: b.dataset.estado });
                bloque.estado_sesion = b.dataset.estado;
                document.querySelectorAll('.botones-estado button').forEach((x) =>
                    x.classList.toggle('elegido', x.dataset.estado === bloque.estado_sesion));
                avisar(r.mensaje, 'bueno');
                pintarAgenda();
            } catch (error) { avisar(error.message, 'malo'); }
            b.disabled = false;
        };
    });

    const verRefs = $('f-ver-refs');
    if (verRefs) verRefs.onclick = async () => {
        verRefs.disabled = true;
        try {
            const r = await pedir('/referencias/' + encodeURIComponent(bloque.id));
            const galeria = document.createElement('div');
            galeria.className = 'galeria';
            galeria.style.marginTop = '8px';
            (r.fotos || []).forEach((f) => {
                const img = document.createElement('img');
                img.src = P.aDataUrl(f);
                img.onclick = () => P.abrirVisor(img.src);
                galeria.appendChild(img);
            });
            $('f-refs').replaceWith(galeria);
        } catch (error) { avisar(error.message, 'malo'); verRefs.disabled = false; }
    };

    $('f-cancelar').onclick = async () => {
        if (!confirm('¿Cancelar la sesión de ' + (bloque.nombre || 'esta modelo') + ' de las ' +
                     bloque.rango.split(' – ')[0] + '? El bloque quedará libre.')) return;
        const boton = $('f-cancelar');
        boton.disabled = true;
        try {
            const r = await pedir('/liberar', 'POST', { fecha: dia.fecha, hora_inicio: bloque.hora_inicio });
            cerrarHoja();
            avisar(r.mensaje, 'bueno');
        } catch (error) { avisar(error.message, 'malo'); boton.disabled = false; }
        cargarAgenda(true);
    };
}

// =======================================================================
// FOTOS DE REFERENCIA: elegir y comprimir en el teléfono
// =======================================================================
function elegirFotos(fotos, alTerminar) {
    const selector = $('selector-fotos');
    selector.value = '';
    selector.onchange = async () => {
        const archivos = Array.from(selector.files || []).slice(0, MAX_FOTOS - fotos.length);
        if (!archivos.length) return;
        avisar('Preparando ' + archivos.length + ' foto(s)…');
        try {
            const usado = fotos.reduce((t, f) => t + f.length, 0);
            const tope = Math.max(60000, Math.floor((TOPE_BASE64 - usado) / archivos.length));
            for (const archivo of archivos) fotos.push(await P.comprimir(archivo, tope));
        } catch (error) {
            avisar(error.message || 'No se pudo leer una de las fotos.', 'malo');
        }
        alTerminar();
    };
    selector.click();
}

// =======================================================================
// PORTAFOLIO
// =======================================================================
async function cargarPortafolio() {
    try {
        estado.estilos = (await pedir('/portafolio')).estilos || [];
        pintarPortafolio();
    } catch (error) {
        $('estilos').innerHTML = '<div class="cargando">No se pudo cargar el portafolio.<br><small>' +
            escapar(error.message) + '</small></div>';
    }
}

function sinTildes(texto) {
    return String(texto || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function pintarPortafolio() {
    const filtro = sinTildes($('buscador').value.trim());
    const lista = (estado.estilos || []).filter((e) => !filtro ||
        sinTildes(e.nombre_sesion + ' ' + e.requisitos).indexOf(filtro) >= 0);
    if (!lista.length) {
        $('estilos').innerHTML = '<div class="vacio">' + (estado.estilos.length
            ? 'Ninguna sesión coincide con «' + escapar($('buscador').value.trim()) + '».'
            : 'Todavía no hay sesiones en el portafolio.') + '</div>';
        return;
    }
    $('estilos').innerHTML = lista.map((e) =>
        '<button class="estilo" data-id="' + escapar(e.id) + '">' +
            '<div class="icono">🎞️</div>' +
            '<div style="min-width:0"><div class="nombre">' + escapar(e.nombre_sesion) + '</div>' +
            '<div class="resumen">' + escapar(e.requisitos) + '</div>' +
            '<div class="resumen" style="margin-top:4px">📷 ' + e.cantidad_fotos +
                (e.cantidad_fotos === 1 ? ' foto' : ' fotos') + '</div></div>' +
            '<span class="flecha">›</span></button>').join('');
    document.querySelectorAll('.estilo').forEach((boton) => {
        boton.onclick = () => abrirEstilo(estado.estilos.find((e) => e.id === boton.dataset.id));
    });
}

function abrirEstilo(estilo) {
    if (!estilo) return;
    abrirHoja(estilo.nombre_sesion, 'Portafolio de fotografía',
        '<div class="galeria" id="galeria">' + (estilo.cantidad_fotos
            ? '<div class="vacio" style="grid-column:1/-1"><span class="girando">◌</span> Cargando fotos…</div>'
            : '<div class="vacio" style="grid-column:1/-1">Este estilo no tiene fotos.</div>') + '</div>' +
        '<div class="campo" style="margin-bottom:6px"><label>Requisitos</label></div>' +
        '<div class="requisitos">' + escapar(estilo.requisitos || 'Sin requisitos escritos.') + '</div>' +
        '<button class="boton-principal" id="f-agendar-estilo">Agendar a una modelo</button>');

    $('f-agendar-estilo').onclick = () => {
        estado.pendiente = { id: estilo.id, nombre: estilo.nombre_sesion };
        cerrarHoja();
        cambiarVista('agenda');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    if (!estilo.cantidad_fotos) return;
    pedir('/portafolio/' + encodeURIComponent(estilo.id)).then((datos) => {
        const galeria = $('galeria');
        if (!galeria) return;
        const fotos = datos.fotos || [];
        galeria.innerHTML = fotos.length ? '' : '<div class="vacio" style="grid-column:1/-1">Este estilo no tiene fotos.</div>';
        fotos.forEach((b64) => {
            const img = document.createElement('img');
            img.alt = estilo.nombre_sesion;
            img.src = P.aDataUrl(b64);
            img.onclick = () => P.abrirVisor(img.src);
            galeria.appendChild(img);
        });
    }).catch((error) => {
        const galeria = $('galeria');
        if (galeria) galeria.innerHTML = '<div class="vacio" style="grid-column:1/-1">' + escapar(error.message) + '</div>';
    });
}

// =======================================================================
// PESTAÑAS Y ARRANQUE
// =======================================================================
function cambiarVista(vista) {
    estado.vista = vista;
    $('tab-agenda').classList.toggle('activo', vista === 'agenda');
    $('tab-portafolio').classList.toggle('activo', vista === 'portafolio');
    $('vista-agenda').classList.toggle('oculto', vista !== 'agenda');
    $('vista-portafolio').classList.toggle('oculto', vista !== 'portafolio');
    if (vista === 'agenda') {
        if (estado.semana) pintarAgenda();
        cargarAgenda(!!estado.semana);
    } else if (estado.estilos === null) {
        cargarPortafolio();
    }
}

P.iniciar('fotografia').then(() => {
    $('tab-agenda').onclick = () => cambiarVista('agenda');
    $('tab-portafolio').onclick = () => cambiarVista('portafolio');
    $('buscador').oninput = pintarPortafolio;
    $('sem-anterior').onclick = () => { estado.indice--; estado.diaElegido = null; cargarAgenda(); };
    $('sem-siguiente').onclick = () => { estado.indice++; estado.diaElegido = null; cargarAgenda(); };
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const visor = document.querySelector('.visor');
        if (visor) visor.remove(); else cerrarHoja();
    });
    setInterval(() => {
        // No se repinta con una hoja abierta: se perdería lo que están escribiendo.
        if (document.visibilityState === 'visible' && estado.vista === 'agenda' && !capas().innerHTML) cargarAgenda(true);
    }, CADA_MS);
    setInterval(pintarActualizada, 5000);
    cargarAgenda();
});

})();
