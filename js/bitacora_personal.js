/* ===========================================================================
 * PARADISE · 📝 Bitácora de las modelos (personal_bitacora.html)
 * ===========================================================================
 * La misma Bitácora de la Admin de escritorio, para todo el personal:
 *   1) la lista de sus modelos, con buscador (nombre o cédula) y jornada;
 *   2) la bitácora de una: registros con buscador y filtro, editar y borrar
 *      (quien lo escribió o el CEO: lo dice la API en `puede_cambiar`), y la
 *      Hoja de vida;
 *   3) la hoja «Nueva observación»: título, texto, fecha, evidencia y
 *      «Compartir con la modelo».
 * La modelo elegida va en ?modelo= para que «atrás» y recargar la conserven.
 * Mockup: https://claude.ai/artifact/UYCAR4ZjQUviwjD1aswrrc
 */
(function () {
'use strict';
const P = window.Personal;
const esc = P.escapar;
const API = '/api/personal/bitacora';
const MAX_ARCHIVOS = 6;
const ACEPTA = 'image/*,video/*,audio/*,.pdf';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const HOJA = ['perfil', 'fortalezas', 'debilidades', 'intereses'];
const $ = (id) => document.getElementById(id);

const estado = { modelos: [], jornada: '', cedula: '', modelo: null, registros: [], turno: 0 };

function hoy() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());
}

function fechaLegible(iso) {
    const p = String(iso || '').split('-');
    if (p.length !== 3) return iso || '—';
    return Number(p[2]) + ' ' + MESES[Number(p[1]) - 1] + ' ' + p[0];
}

function fechaCorta(iso) {
    const p = String(iso || '').split('-');
    return p.length === 3 ? Number(p[2]) + ' ' + MESES[Number(p[1]) - 1] : '';
}

function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function iniciales(nombre) {
    const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
    return ((partes[0] || '?')[0] + (partes[1] ? partes[1][0] : (partes[0] || '?')[1] || '')).toUpperCase();
}

function resumenModelo(m) {
    return ['Doc. ' + m.cedula, m.jornada, m.cuarto ? 'Room ' + m.cuarto : ''].filter(Boolean).join(' · ');
}

// ---------------------------------------------------------------------------
// 1) LA LISTA
// ---------------------------------------------------------------------------
async function cargarModelos() {
    try {
        const datos = await P.pedir(API);
        estado.modelos = datos.modelos || [];
        $('jornadas').innerHTML = ['', ...(datos.jornadas || [])].map((j) =>
            '<button class="pestana' + (j === estado.jornada ? ' activa' : '') + '" data-j="' + esc(j) + '">' +
            esc(j || 'Todas') + '</button>').join('');
        $('jornadas').querySelectorAll('button').forEach((b) => {
            b.onclick = () => {
                estado.jornada = b.dataset.j;
                $('jornadas').querySelectorAll('button').forEach((x) => x.classList.toggle('activa', x === b));
                pintarModelos();
            };
        });
        pintarModelos();
    } catch (error) {
        $('lista-modelos').innerHTML = '<div class="vacio">' + esc(error.message) + '</div>';
    }
}

function pintarModelos() {
    const buscado = normalizar($('buscar-modelo').value);
    const visibles = estado.modelos.filter((m) =>
        (!estado.jornada || m.jornada === estado.jornada) &&
        (!buscado || normalizar(m.nombre).indexOf(buscado) >= 0 || String(m.cedula).indexOf(buscado) >= 0));
    const lista = $('lista-modelos');
    if (!visibles.length) {
        lista.innerHTML = '<div class="vacio">' + (estado.modelos.length ? 'Ninguna modelo con esa búsqueda.' :
            'No tienes modelos en tu jornada.') + '</div>';
        return;
    }
    lista.innerHTML = '<div class="bit-contador">' + visibles.length + (visibles.length === 1 ? ' MODELO' : ' MODELOS') +
        '</div>' + visibles.map((m) =>
            '<button class="bit-fila" data-c="' + esc(m.cedula) + '">' +
            '<span class="bit-avatar">' + esc(iniciales(m.nombre)) + '</span>' +
            '<span class="bit-datos"><b>' + esc(m.nombre) + '</b><span>' + esc(resumenModelo(m)) + '</span></span>' +
            '<span class="bit-cuenta' + (m.registros ? '' : ' cero') + '"><b>' + m.registros + '</b><span>' +
            (m.registros ? esc(fechaCorta(m.ultima)) : 'sin registros') + '</span></span></button>').join('');
    lista.querySelectorAll('.bit-fila').forEach((b) => { b.onclick = () => abrirModelo(b.dataset.c, true); });
}

// ---------------------------------------------------------------------------
// 2) LA BITÁCORA DE UNA MODELO
// ---------------------------------------------------------------------------
function mostrarVista(conModelo) {
    $('vista-lista').classList.toggle('oculto', conModelo);
    $('vista-modelo').classList.toggle('oculto', !conModelo);
    window.scrollTo(0, 0);
}

function abrirModelo(cedula, apilar) {
    estado.cedula = String(cedula);
    if (apilar) history.pushState({ modelo: estado.cedula }, '', '?modelo=' + encodeURIComponent(estado.cedula));
    const m = estado.modelos.find((x) => String(x.cedula) === estado.cedula);
    pintarCabecera(m || { cedula: estado.cedula, nombre: '…' });
    elegirPestana('bitacora');
    $('buscar-registro').value = '';
    $('filtro-registros').value = '';
    $('registros').innerHTML = '<div class="cargando"><span class="girando">◌</span> Cargando…</div>';
    $('pie-registros').textContent = '';
    mostrarVista(true);
    leerModelo();
}

function volverALista() {
    estado.cedula = '';
    mostrarVista(false);
    cargarModelos();      // los contadores pudieron cambiar
}

function pintarCabecera(m) {
    $('cabecera-modelo').innerHTML = '<span class="bit-avatar grande">' + esc(iniciales(m.nombre)) + '</span>' +
        '<span class="bit-datos"><b>' + esc(m.nombre) + '</b><span>' + esc(m.jornada ? resumenModelo(m) : 'Doc. ' + m.cedula) +
        '</span></span>';
}

async function leerModelo(mensaje) {
    const turno = ++estado.turno;
    const cedula = estado.cedula;
    try {
        const datos = await P.pedir(API + '/' + encodeURIComponent(cedula));
        if (turno !== estado.turno) return;
        estado.modelo = datos.modelo;
        estado.registros = datos.registros || [];
        pintarCabecera(datos.modelo);
        pintarRegistros();
        pintarHoja(datos.hoja || {});
        if (mensaje) P.avisar(mensaje, 'bueno');
    } catch (error) {
        if (turno !== estado.turno) return;
        $('registros').innerHTML = '<div class="vacio">' + esc(error.message) + '</div>';
    }
}

function elegirPestana(p) {
    $('pestanas').querySelectorAll('.pestana').forEach((b) => b.classList.toggle('activa', b.dataset.p === p));
    $('panel-bitacora').classList.toggle('oculto', p !== 'bitacora');
    $('panel-hoja').classList.toggle('oculto', p !== 'hoja');
    $('anadir').classList.toggle('oculto', p !== 'bitacora');
}

function pintarRegistros() {
    const filtro = $('filtro-registros').value;
    const buscado = normalizar($('buscar-registro').value);
    const visibles = estado.registros.filter((r) =>
        (!filtro || r.compartida === (filtro === 'si')) &&
        (!buscado || normalizar(r.titulo + ' ' + r.texto + ' ' + r.por).indexOf(buscado) >= 0));
    const caja = $('registros');
    caja.innerHTML = '';
    if (!visibles.length) {
        caja.innerHTML = '<div class="vacio">' + (estado.registros.length ? 'No hay registros con esa búsqueda.' :
            'Todavía no hay registros. Añade el primero con el botón dorado.') + '</div>';
    }
    visibles.forEach((r) => caja.appendChild(tarjetaRegistro(r)));
    const compartidas = estado.registros.filter((r) => r.compartida).length;
    $('pie-registros').textContent = visibles.length + ' de ' + estado.registros.length + ' registros · ' +
        compartidas + ' compartidos con la modelo';
    const boton = $('pestanas').querySelector('[data-p="bitacora"]');
    boton.textContent = 'Bitácora (' + estado.registros.length + ')';
}

function tarjetaRegistro(r) {
    const tarjeta = document.createElement('article');
    tarjeta.className = 'bit-registro';
    tarjeta.innerHTML = '<div class="bit-meta"><b>' + esc(fechaLegible(r.fecha)) + '</b>' +
        (r.compartida ? '<span class="bit-chip si">Compartida con la modelo</span>'
            : '<span class="bit-chip">Solo del estudio</span>') + '<span class="bit-espacio"></span>' +
        (r.puede_cambiar ? '<button class="bit-icono" data-op="editar" aria-label="Editar" title="Editar">✏</button>' +
            '<button class="bit-icono" data-op="borrar" aria-label="Borrar" title="Borrar">🗑</button>' : '') +
        '</div><h3>' + esc(r.titulo) + '</h3>' + (r.texto ? '<p>' + esc(r.texto) + '</p>' : '') +
        '<div class="bit-evidencias"></div><span class="bit-autor">Por ' + esc(r.por || '—') +
        (r.editado_por ? ' · editado por ' + esc(r.editado_por) : '') + '</span>';
    const zona = tarjeta.querySelector('.bit-evidencias');
    (r.adjuntos || []).forEach((a) => zona.appendChild(botonEvidencia(r, a)));
    const editar = tarjeta.querySelector('[data-op="editar"]');
    if (editar) editar.onclick = () => abrirFormulario(r);
    const borrar = tarjeta.querySelector('[data-op="borrar"]');
    if (borrar) borrar.onclick = () => pedirBorrar(r);
    return tarjeta;
}

function botonEvidencia(r, a) {
    const boton = document.createElement('button');
    boton.className = 'boton-secundario bit-evidencia';
    const iconos = { imagen: '🖼️ ', video: '🎬 ', pdf: '📄 ', audio: '🎙️ ' };
    boton.textContent = (iconos[a.tipo] || '📎 ') + a.nombre;
    boton.onclick = async () => {
        // Video, PDF y audio en otra pestaña (abierta en el toque, o el navegador la bloquea).
        const ventana = a.tipo === 'imagen' ? null : window.open('', '_blank');
        boton.disabled = true;
        try {
            const url = await P.pedirArchivo(API + '/registro/' + encodeURIComponent(r.id) + '/adjunto/' + a.n);
            if (ventana) ventana.location.href = url;
            else P.abrirVisor(url);
        } catch (error) {
            if (ventana) ventana.close();
            P.avisar(error.message, 'malo');
        } finally {
            boton.disabled = false;
        }
    };
    return boton;
}

function pedirBorrar(r) {
    const capa = document.createElement('div');
    capa.innerHTML = '<div class="velo"></div><div class="hoja"><div class="hoja-cabecera"><h3>¿Borrar este registro?</h3>' +
        '<button class="cerrar" aria-label="Cerrar">✕</button></div><div class="hoja-cuerpo">' +
        '<p class="bit-nota"><b>' + esc(r.titulo) + '</b> del ' + esc(fechaLegible(r.fecha)) + '.' +
        (r.compartida ? ' La modelo deja de verlo.' : '') + ' No se puede deshacer.</p>' +
        '<div class="bit-botones"><button class="boton-secundario" data-op="no">Cancelar</button>' +
        '<button class="boton-principal bit-peligro" data-op="si">Sí, borrar</button></div></div></div>';
    document.body.appendChild(capa);
    const cerrar = () => capa.remove();
    capa.querySelector('.velo').onclick = cerrar;
    capa.querySelector('.cerrar').onclick = cerrar;
    capa.querySelector('[data-op="no"]').onclick = cerrar;
    const si = capa.querySelector('[data-op="si"]');
    si.onclick = async () => {
        si.disabled = true;
        try {
            await P.pedir(API + '/registro/' + encodeURIComponent(r.id), 'DELETE');
            cerrar();
            leerModelo('Registro borrado.');
        } catch (error) {
            si.disabled = false;
            P.avisar(error.message, 'malo');
        }
    };
}

// ---------------------------------------------------------------------------
// 3) NUEVA OBSERVACIÓN / EDITAR
// ---------------------------------------------------------------------------
function abrirFormulario(registro) {
    const m = estado.modelo || {};
    const archivos = [];
    const capa = document.createElement('div');
    capa.innerHTML = '<div class="velo"></div><div class="hoja bit-formulario"><div class="hoja-cabecera"><div style="flex:1">' +
        '<h3>' + (registro ? 'Editar observación' : 'Nueva observación') + '</h3>' +
        '<div class="sub">' + esc(m.nombre || '') + ' · Doc. ' + esc(m.cedula || estado.cedula) + '</div></div>' +
        '<button class="cerrar" aria-label="Cerrar">✕</button></div><div class="hoja-cuerpo">' +
        '<div class="campo"><label for="f-titulo">Título</label><input id="f-titulo" maxlength="140" ' +
        'placeholder="Ej.: Informe de acompañamiento semanal"></div>' +
        '<div class="campo"><label for="f-texto">Observación</label><textarea id="f-texto" maxlength="6000" rows="6" ' +
        'placeholder="Lo que pasó, las tareas y las metas."></textarea></div>' +
        '<div class="bit-dos"><div class="campo"><label for="f-fecha">Fecha</label><input id="f-fecha" type="date"></div>' +
        '<div class="campo"><label>Evidencia</label><button type="button" class="bit-adjuntar" id="f-adjuntar">📎 Foto o archivo</button>' +
        '<input type="file" id="f-archivos" class="oculto" multiple accept="' + ACEPTA + '"></div></div>' +
        '<div id="f-lista" class="bit-archivos"></div>' +
        (registro && (registro.adjuntos || []).length ? '<p class="bit-nota">Conserva ' + registro.adjuntos.length +
            ' evidencia(s); lo que adjuntes se suma.</p>' : '') +
        '<label class="bit-compartir"><input type="checkbox" id="f-compartir"><span><b>Compartir con la modelo</b>' +
        '<span>La ve en su web, en Seguimiento › Bitácora. Si no, queda solo del estudio.</span></span></label>' +
        '<div class="bit-botones"><button class="boton-secundario" data-op="no">Cancelar</button>' +
        '<button class="boton-principal" id="f-guardar">Guardar</button></div></div></div>';
    document.body.appendChild(capa);
    const cerrar = () => capa.remove();
    capa.querySelector('.velo').onclick = cerrar;
    capa.querySelector('.cerrar').onclick = cerrar;
    capa.querySelector('[data-op="no"]').onclick = cerrar;

    $('f-titulo').value = registro ? registro.titulo : '';
    $('f-texto').value = registro ? registro.texto : '';
    $('f-fecha').value = registro ? registro.fecha : hoy();
    $('f-compartir').checked = !!(registro && registro.compartida);
    if (!registro) $('f-titulo').focus();

    const pintarArchivos = () => {
        $('f-lista').innerHTML = archivos.map((a, i) =>
            '<div class="bit-archivo"><span>' + esc(a.name) + '</span><small>' + Math.max(1, Math.round(a.size / 1024)) +
            ' KB</small><button type="button" data-i="' + i + '" aria-label="Quitar">✕</button></div>').join('');
        $('f-lista').querySelectorAll('button').forEach((b) => {
            b.onclick = () => { archivos.splice(Number(b.dataset.i), 1); pintarArchivos(); };
        });
    };
    $('f-adjuntar').onclick = () => $('f-archivos').click();
    $('f-archivos').onchange = () => {
        Array.from($('f-archivos').files || []).forEach((f) => {
            if (archivos.length < MAX_ARCHIVOS) archivos.push(f);
            else P.avisar('Máximo ' + MAX_ARCHIVOS + ' archivos por registro.', 'malo');
        });
        $('f-archivos').value = '';
        pintarArchivos();
    };

    const guardar = $('f-guardar');
    guardar.onclick = async () => {
        const titulo = $('f-titulo').value.trim();
        const texto = $('f-texto').value.trim();
        const previos = registro ? (registro.adjuntos || []).length : 0;
        if (!titulo) { P.avisar('Escribe el título.', 'malo'); return; }
        if (!texto && !archivos.length && !previos) { P.avisar('Escribe el texto o adjunta la evidencia.', 'malo'); return; }
        if (!$('f-fecha').value) { P.avisar('Revisa la fecha.', 'malo'); return; }
        const formulario = new FormData();
        formulario.append('titulo', titulo);
        formulario.append('texto', texto);
        formulario.append('fecha', $('f-fecha').value);
        formulario.append('compartida', $('f-compartir').checked ? '1' : '');
        archivos.forEach((a) => formulario.append('archivos', a, a.name));
        guardar.disabled = true;
        guardar.textContent = archivos.length ? 'Subiendo…' : 'Guardando…';
        try {
            const ruta = registro ? API + '/registro/' + encodeURIComponent(registro.id)
                : API + '/' + encodeURIComponent(estado.cedula);
            await P.pedirFormulario(ruta, formulario);
            const compartida = $('f-compartir').checked;
            cerrar();
            leerModelo('Registro guardado' + (compartida ? ': la modelo ya lo ve en su Seguimiento.' : '.'));
        } catch (error) {
            guardar.disabled = false;
            guardar.textContent = 'Guardar';
            P.avisar(error.message, 'malo');
        }
    };
}

// ---------------------------------------------------------------------------
// HOJA DE VIDA
// ---------------------------------------------------------------------------
function pintarHoja(hoja) {
    HOJA.forEach((c) => { $('hoja-' + c).value = hoja[c] || ''; });
    $('pie-hoja').textContent = hoja.por ? 'Última vez: ' + hoja.por + ' · ' + String(hoja.cuando || '').slice(0, 16).replace('T', ' ')
        : 'Todavía no se ha llenado.';
}

async function guardarHoja() {
    const boton = $('guardar-hoja');
    const cuerpo = {};
    HOJA.forEach((c) => { cuerpo[c] = $('hoja-' + c).value; });
    boton.disabled = true;
    try {
        await P.pedir(API + '/' + encodeURIComponent(estado.cedula) + '/hoja', 'POST', cuerpo);
        leerModelo('Hoja de vida guardada.');
    } catch (error) {
        P.avisar(error.message, 'malo');
    } finally {
        boton.disabled = false;
    }
}

// ---------------------------------------------------------------------------
P.iniciar('bitacora').then(() => {
    $('buscar-modelo').oninput = pintarModelos;
    $('buscar-registro').oninput = pintarRegistros;
    $('filtro-registros').onchange = pintarRegistros;
    $('pestanas').querySelectorAll('.pestana').forEach((b) => { b.onclick = () => elegirPestana(b.dataset.p); });
    $('anadir').onclick = () => abrirFormulario(null);
    $('guardar-hoja').onclick = guardarHoja;
    $('atras').onclick = () => history.back();
    window.addEventListener('popstate', () => {
        const cedula = new URLSearchParams(window.location.search).get('modelo');
        if (cedula) abrirModelo(cedula, false);
        else volverALista();
    });
    const inicial = new URLSearchParams(window.location.search).get('modelo');
    cargarModelos().then(() => {
        if (inicial) {
            history.replaceState(null, '', window.location.pathname);
            history.pushState({ modelo: inicial }, '', '?modelo=' + encodeURIComponent(inicial));
            abrirModelo(inicial, false);
        }
    });
});
})();
