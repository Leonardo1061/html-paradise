/* ===========================================================================
 * PARADISE · Fotografía (fotografia.html)
 * ===========================================================================
 *
 * Pinta lo que devuelve `/api/fotografia/…` y pregunta. Las reglas —la sede,
 * qué bloques se pueden tomar, quién puede cancelar qué— las decide la API:
 * aquí no se repiten, porque el navegador es de ella y cualquier regla escrita
 * en él se salta desde la consola.
 *
 * «EN TIEMPO REAL»
 * ----------------
 * La malla se vuelve a pedir al entrar, cada 20 segundos mientras la página
 * está a la vista y al volver a ella desde otra app. Si dos modelos pulsan el
 * mismo bloque, la API deja pasar a la primera y a la segunda le dice que se
 * lo acaban de tomar; la malla se recarga sola.
 *
 * LAS FOTOS DE REFERENCIA
 * -----------------------
 * Se comprimen AQUÍ, en el teléfono, antes de subirlas: un JPEG de cámara
 * pesa 3-5 MB y el documento de Firestore no admite más de 1 MB. Se prueba de
 * mejor a peor calidad hasta que todas juntas caben.
 */

(function () {
'use strict';

const API = PARADISE.API_URL;
const $ = (id) => document.getElementById(id);
const capas = $('capas');

const CADA_MS = 20000;              // refresco de la malla
const MAX_FOTOS = 4;                // las mismas que acepta la API
const TOPE_BASE64 = 850000;         // por debajo de los 900 000 de la API

const estado = {
    token: localStorage.getItem('token_sesion') || '',
    vista: 'agenda',
    indice: 0,                      // 0 = esta semana
    semana: null,
    diaElegido: null,               // 'AAAA-MM-DD'
    mias: [],
    estilos: null,
    pendiente: null,                // {id, nombre} si viene de «Agendar» del portafolio
    actualizada: 0,
    cargandoMalla: false,
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
    if (!respuesta.ok) {
        const error = new Error(datos.detail || 'No se pudo completar la acción.');
        error.codigo = respuesta.status;
        throw error;
    }
    return datos;
}

function claseEstadoSesion(texto) {
    if (texto === 'Asistió') return 'asistio';
    if (texto === 'No Asistió') return 'no-asistio';
    return 'programada';
}

function sedeCorta(sede) {
    return /TROPIC/i.test(sede || '') ? 'Tropic' : 'Paradise';
}

// =======================================================================
// AGENDA
// =======================================================================
async function cargarAgenda(silencioso) {
    if (estado.cargandoMalla) return;
    estado.cargandoMalla = true;
    try {
        const [semana, mias] = await Promise.all([
            pedir('/api/fotografia/semana?indice=' + estado.indice),
            pedir('/api/fotografia/mias'),
        ]);
        estado.semana = semana;
        estado.mias = mias.sesiones || [];
        estado.actualizada = Date.now();
        const fechas = semana.dias.map((d) => d.fecha);
        if (!fechas.includes(estado.diaElegido)) {
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

function pintarAgenda() {
    pintarPendiente();
    pintarMias();

    const semana = estado.semana;
    $('sem-rotulo').innerHTML = escapar(semana.etiqueta) +
        '<small>' + (semana.indice === 0 ? 'Esta semana' :
                     semana.indice === 1 ? 'La próxima semana' :
                     'En ' + semana.indice + ' semanas') + ' · lunes a sábado</small>';
    $('sem-anterior').disabled = semana.indice <= 0;
    $('sem-siguiente').disabled = semana.indice >= semana.max_indice;

    $('dias').innerHTML = semana.dias.map((dia) => {
        const libres = dia.bloques.filter((b) => b.estado === 'libre' && !b.pasado).length;
        const tengo = dia.bloques.some((b) => b.estado === 'mia');
        const partes = dia.etiqueta.split(' ');
        return '<button class="dia' + (dia.fecha === estado.diaElegido ? ' activo' : '') +
            '" data-fecha="' + dia.fecha + '">' +
            (tengo ? '<span class="punto"></span>' : '') +
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
        if (bloque.estado === 'mia') {
            lado = '<div style="text-align:right"><div class="estado">Tu sesión</div>' +
                '<div class="asunto">' + escapar(bloque.asunto) + '</div></div>';
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
            if (bloque.estado === 'mia') abrirMiSesion(dia, bloque);
            else if (bloque.estado === 'libre' && !bloque.pasado) abrirAgendar(dia, bloque);
        };
    });

    pintarActualizada();
}

function pintarActualizada() {
    if (!estado.actualizada) return;
    const segundos = Math.round((Date.now() - estado.actualizada) / 1000);
    $('al-dia').textContent = 'Se actualiza sola · ' +
        (segundos < 5 ? 'ahora mismo' : 'hace ' + segundos + ' s');
}

function pintarMias() {
    const caja = $('mis-sesiones');
    if (!estado.mias.length) {
        caja.innerHTML = '<div class="vacio">No tienes sesiones de fotos agendadas. ' +
            'Toca un bloque libre de la malla para agendarte.</div>';
        return;
    }
    caja.innerHTML = estado.mias.map((s, i) =>
        '<button class="sesion" data-i="' + i + '">' +
            '<div class="icono">📸</div>' +
            '<div><div class="cuando">' + escapar(s.dia) + ' · ' + escapar(s.rango.split(' – ')[0]) + '</div>' +
            '<div class="detalle">' + escapar(s.asunto) + ' · ' + escapar(sedeCorta(s.sede)) + '</div></div>' +
            '<span class="chapa ' + claseEstadoSesion(s.estado_sesion) + '">' +
                escapar(s.estado_sesion) + '</span>' +
        '</button>').join('');
    caja.querySelectorAll('.sesion').forEach((boton) => {
        boton.onclick = () => {
            const s = estado.mias[parseInt(boton.dataset.i, 10)];
            abrirMiSesion({ fecha: s.fecha, nombre: s.dia }, s, true);
        };
    });
}

function pintarPendiente() {
    const caja = $('pendiente');
    if (!estado.pendiente) { caja.innerHTML = ''; return; }
    caja.innerHTML = '<div class="pendiente"><div>Elige un bloque libre para ' +
        '<b>' + escapar(estado.pendiente.nombre) + '</b>.</div>' +
        '<button id="quitar-pendiente" title="Quitar">✕</button></div>';
    $('quitar-pendiente').onclick = () => { estado.pendiente = null; pintarPendiente(); };
}

// =======================================================================
// HOJAS
// =======================================================================
function cerrarHoja() { capas.innerHTML = ''; }

function abrirHoja(titulo, subtitulo, cuerpo) {
    capas.innerHTML = '<div class="velo" id="velo"></div>' +
        '<div class="hoja"><div class="hoja-cabecera"><div><h3>' + escapar(titulo) + '</h3>' +
            (subtitulo ? '<div class="sub">' + escapar(subtitulo) + '</div>' : '') + '</div>' +
            '<button class="cerrar" id="cerrar-hoja">✕</button></div>' +
        '<div class="hoja-cuerpo">' + cuerpo + '</div></div>';
    $('velo').onclick = cerrarHoja;
    $('cerrar-hoja').onclick = cerrarHoja;
}

function abrirVisor(src) {
    const visor = document.createElement('div');
    visor.className = 'visor';
    visor.innerHTML = '<img alt="Foto de referencia">';
    visor.querySelector('img').src = src;
    visor.onclick = () => visor.remove();
    document.body.appendChild(visor);
}

/* --- agendar un bloque libre ------------------------------------------ */
function abrirAgendar(dia, bloque) {
    const fotos = [];        // data URLs ya comprimidas
    const asuntoInicial = estado.pendiente ? estado.pendiente.nombre : '';

    abrirHoja('Agendar sesión de fotos',
        dia.nombre + ' ' + dia.fecha.slice(8, 10) + '/' + dia.fecha.slice(5, 7) + ' · ' +
        bloque.rango + ' · ' + bloque.sede,
        '<div class="campo"><label>Asunto de las fotos</label>' +
            '<textarea id="f-asunto" maxlength="200" placeholder="Ej: Fotos para mi perfil de Stripchat">' +
            escapar(asuntoInicial) + '</textarea></div>' +
        '<div class="campo"><label>Fotos de referencia (opcional, hasta ' + MAX_FOTOS + ')</label>' +
            '<div class="miniaturas" id="f-miniaturas"></div>' +
            '<div class="nota">El fotógrafo las verá en su malla para preparar la sesión.</div></div>' +
        '<button class="boton-principal" id="f-agendar">Agendar</button>');

    const pintarFotos = () => {
        const caja = $('f-miniaturas');
        if (!caja) return;
        caja.innerHTML = fotos.map((f, i) =>
            '<div class="miniatura"><img src="' + f + '" alt="Referencia ' + (i + 1) + '">' +
            '<button data-i="' + i + '" title="Quitar">✕</button></div>').join('') +
            (fotos.length < MAX_FOTOS
                ? '<button class="adjuntar" id="f-adjuntar"><span>＋</span>Adjuntar</button>' : '');
        caja.querySelectorAll('.miniatura button').forEach((b) => {
            b.onclick = () => { fotos.splice(parseInt(b.dataset.i, 10), 1); pintarFotos(); };
        });
        const adjuntar = $('f-adjuntar');
        if (adjuntar) adjuntar.onclick = () => elegirFotos(fotos, pintarFotos);
    };
    pintarFotos();

    $('f-agendar').onclick = async () => {
        const asunto = $('f-asunto').value.trim();
        if (!asunto) { avisar('Escribe el asunto de las fotos.', 'malo'); return; }
        const boton = $('f-agendar');
        boton.disabled = true;
        boton.textContent = 'Agendando…';
        try {
            const respuesta = await pedir('/api/fotografia/agendar', 'POST', {
                fecha: dia.fecha,
                hora_inicio: bloque.hora_inicio,
                asunto: asunto,
                fotos: fotos,
                portafolio_id: estado.pendiente ? estado.pendiente.id : '',
            });
            estado.pendiente = null;
            cerrarHoja();
            avisar(respuesta.mensaje || 'Quedaste agendada.', 'bueno');
        } catch (error) {
            avisar(error.message, 'malo');
            if (error.codigo === 409) cerrarHoja();
            else { boton.disabled = false; boton.textContent = 'Agendar'; }
        }
        cargarAgenda(true);
    };
}

/* --- una sesión suya: ver y cancelar ---------------------------------- */
function abrirMiSesion(dia, bloque) {
    const puedeCancelar = !bloque.pasado && bloque.estado_sesion === 'Programada';
    const fecha = dia.fecha.slice(8, 10) + '/' + dia.fecha.slice(5, 7);
    abrirHoja('Tu sesión de fotos', (dia.nombre.indexOf('/') >= 0 ? dia.nombre : dia.nombre + ' ' + fecha),
        '<div class="fila-dato"><span class="r">Hora</span><span>' + escapar(bloque.rango) + '</span></div>' +
        '<div class="fila-dato"><span class="r">Sede</span><span>' + escapar(bloque.sede) + '</span></div>' +
        '<div class="fila-dato"><span class="r">Asunto</span><span>' + escapar(bloque.asunto) + '</span></div>' +
        '<div class="fila-dato"><span class="r">Estado</span><span class="chapa ' +
            claseEstadoSesion(bloque.estado_sesion) + '">' + escapar(bloque.estado_sesion) + '</span></div>' +
        '<div class="fila-dato" style="border-bottom:0"><span class="r">Fotos</span><span>' +
            (bloque.referencias ? bloque.referencias + ' de referencia enviadas' : 'Sin fotos de referencia') +
        '</span></div>' +
        (puedeCancelar
            ? '<button class="boton-peligro" id="f-cancelar">Cancelar esta sesión</button>'
            : '<div class="nota">' + (bloque.pasado ? 'Esta sesión ya pasó.'
                                                  : 'El monitor ya cerró esta sesión.') + '</div>'));

    const cancelar = $('f-cancelar');
    if (!cancelar) return;
    cancelar.onclick = async () => {
        if (!confirm('¿Cancelar tu sesión de fotos de las ' + bloque.rango.split(' – ')[0] +
                     '? El bloque quedará libre para otra.')) return;
        cancelar.disabled = true;
        try {
            const respuesta = await pedir('/api/fotografia/cancelar', 'POST',
                                          { fecha: dia.fecha, hora_inicio: bloque.hora_inicio });
            cerrarHoja();
            avisar(respuesta.mensaje || 'Sesión cancelada.', 'bueno');
        } catch (error) {
            avisar(error.message, 'malo');
            cancelar.disabled = false;
        }
        cargarAgenda(true);
    };
}

// =======================================================================
// FOTOS: elegir y comprimir en el teléfono
// =======================================================================
function elegirFotos(fotos, alTerminar) {
    const selector = $('selector-fotos');
    selector.value = '';
    selector.onchange = async () => {
        const archivos = Array.from(selector.files || []).slice(0, MAX_FOTOS - fotos.length);
        if (!archivos.length) return;
        avisar('Preparando ' + archivos.length + ' foto(s)…');
        try {
            const imagenes = await Promise.all(archivos.map(cargarImagen));
            const todas = fotos.concat([]);
            const nuevas = comprimir(imagenes, todas);
            fotos.push.apply(fotos, nuevas);
            if (avisoActual) { avisoActual.remove(); avisoActual = null; }
        } catch (error) {
            avisar(error.message || 'No se pudo leer una de las fotos.', 'malo');
        }
        alTerminar();
    };
    selector.click();
}

function cargarImagen(archivo) {
    return new Promise((resolver, rechazar) => {
        const url = URL.createObjectURL(archivo);
        const imagen = new Image();
        imagen.onload = () => { URL.revokeObjectURL(url); resolver(imagen); };
        imagen.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo abrir «' + archivo.name + '».')); };
        imagen.src = url;
    });
}

function aJpeg(imagen, lado, calidad) {
    const escala = Math.min(1, lado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    lienzo.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#fff';                  // JPEG no guarda transparencia
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/jpeg', calidad);
}

/* De mejor a peor hasta que las nuevas, sumadas a las que ya había, caben. */
function comprimir(imagenes, previas) {
    const ocupado = previas.reduce((total, f) => total + f.length, 0);
    for (let lado = 1280; lado >= 480; lado = Math.round(lado * 0.8)) {
        for (const calidad of [0.78, 0.65, 0.5]) {
            const nuevas = imagenes.map((img) => aJpeg(img, lado, calidad));
            const peso = nuevas.reduce((total, f) => total + f.length, 0);
            if (ocupado + peso <= TOPE_BASE64) return nuevas;
        }
    }
    throw new Error('Las fotos pesan demasiado aun comprimidas. Quita alguna.');
}

// =======================================================================
// PORTAFOLIO
// =======================================================================
async function cargarPortafolio() {
    try {
        const datos = await pedir('/api/fotografia/portafolio');
        estado.estilos = datos.estilos || [];
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
        '<div class="galeria" id="galeria">' +
            (estilo.cantidad_fotos
                ? '<div class="vacio" style="grid-column:1/-1"><span class="girando">◌</span> Cargando fotos…</div>'
                : '<div class="vacio" style="grid-column:1/-1">Este estilo no tiene fotos.</div>') +
        '</div>' +
        '<div class="campo" style="margin-bottom:6px"><label>Requisitos</label></div>' +
        '<div class="requisitos">' + escapar(estilo.requisitos || 'Sin requisitos escritos.') + '</div>' +
        '<button class="boton-principal" id="f-agendar-estilo">Agendar</button>');

    $('f-agendar-estilo').onclick = () => {
        estado.pendiente = { id: estilo.id, nombre: estilo.nombre_sesion };
        cerrarHoja();
        cambiarVista('agenda');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (!estilo.cantidad_fotos) return;
    // Las fotos se piden solo al abrir el estilo: cada uno puede pesar casi 1 MB.
    pedir('/api/fotografia/portafolio/' + encodeURIComponent(estilo.id)).then((datos) => {
        const galeria = $('galeria');
        if (!galeria) return;          // la cerró antes de que llegaran
        const fotos = datos.fotos || [];
        galeria.innerHTML = fotos.length ? '' : '<div class="vacio" style="grid-column:1/-1">Este estilo no tiene fotos.</div>';
        fotos.forEach((b64) => {
            const img = document.createElement('img');
            img.alt = estilo.nombre_sesion;
            img.src = b64.indexOf('data:') === 0 ? b64 : 'data:image/jpeg;base64,' + b64;
            img.onclick = () => abrirVisor(img.src);
            galeria.appendChild(img);
        });
    }).catch((error) => {
        const galeria = $('galeria');
        if (galeria) galeria.innerHTML = '<div class="vacio" style="grid-column:1/-1">' +
            escapar(error.message) + '</div>';
    });
}

// =======================================================================
// PESTAÑAS Y ARRANQUE
// =======================================================================
// El chat con Fotografía: el mismo componente de chat.html, fijo en ese canal.
const chatFotografia = ChatParadise.montar($('vista-chat'), {
    canalFijo: 'fotografia', nombreFijo: 'Fotografía', avisar: avisar,
});

function cambiarVista(vista) {
    estado.vista = vista;
    $('tab-agenda').classList.toggle('activo', vista === 'agenda');
    $('tab-portafolio').classList.toggle('activo', vista === 'portafolio');
    $('tab-chat').classList.toggle('activo', vista === 'chat');
    $('vista-agenda').classList.toggle('oculto', vista !== 'agenda');
    $('vista-portafolio').classList.toggle('oculto', vista !== 'portafolio');
    $('vista-chat').classList.toggle('oculto', vista !== 'chat');
    if (vista === 'chat') chatFotografia.activar(); else chatFotografia.desactivar();
    if (vista === 'agenda') {
        if (estado.semana) pintarAgenda();
        cargarAgenda(!!estado.semana);
    } else if (vista === 'portafolio' && estado.estilos === null) {
        cargarPortafolio();
    }
}

if (!estado.token) {
    window.location.href = PARADISE.URL_LOGIN;
    return;
}

$('nombre-barra').textContent = 'Fotografía';
$('tab-agenda').onclick = () => cambiarVista('agenda');
$('tab-portafolio').onclick = () => cambiarVista('portafolio');
$('tab-chat').onclick = () => cambiarVista('chat');
$('buscador').oninput = pintarPortafolio;
$('sem-anterior').onclick = () => { if (estado.indice > 0) { estado.indice--; estado.diaElegido = null; cargarAgenda(); } };
$('sem-siguiente').onclick = () => { estado.indice++; estado.diaElegido = null; cargarAgenda(); };
$('btn-recargar').onclick = () => {
    if (estado.vista === 'agenda') cargarAgenda();
    else if (estado.vista === 'portafolio') { estado.estilos = null; cargarPortafolio(); }
};

$('nav-inicio').onclick = () => { window.location.href = 'panel.html'; };
$('nav-chat').onclick = () => { window.location.href = 'chat.html'; };
$('nav-programador').onclick = () => { window.location.href = 'plan.html'; };
$('nav-status').onclick = () => { window.location.href = 'turnos.html'; };
$('nav-fotografia').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
$('nav-perfil').onclick = () => { window.location.href = 'panel.html#perfil'; };
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const visor = document.querySelector('.visor');
    if (visor) visor.remove(); else cerrarHoja();
});

// Refresco: solo con la página a la vista, para no gastar batería ni lecturas.
setInterval(() => {
    if (document.visibilityState === 'visible' && estado.vista === 'agenda') cargarAgenda(true);
}, CADA_MS);
setInterval(pintarActualizada, 5000);
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && estado.vista === 'agenda') cargarAgenda(true);
});

if (new URLSearchParams(window.location.search).get('vista') === 'chat') cambiarVista('chat');
else cargarAgenda();

})();
