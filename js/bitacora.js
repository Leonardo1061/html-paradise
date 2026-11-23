/* ===========================================================================
 * PARADISE · Bitácora de la modelo (bitacora.html) · 2026-11-22
 * ===========================================================================
 *
 * Los registros que el personal escribió (Admin o web del personal) y marcó
 * «Compartir con la modelo» (`/api/bitacora`). Solo lectura. La evidencia la
 * sirve la API desde Drive (`/api/bitacora/{id}/adjunto/{n}`).
 * Antes era la parte de abajo de Seguimiento; las estadísticas se quitaron.
 */

(function () {
'use strict';

const API = PARADISE.API_URL;
const $ = (id) => document.getElementById(id);

const estado = {
    token: localStorage.getItem('token_sesion') || '',
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
function cargar() {
    if (!estado.token) {
        window.location.href = PARADISE.URL_LOGIN;
        return;
    }
    cargarBitacora();
}

// =======================================================================
// BITÁCORA
// =======================================================================
const ICONO_ADJUNTO = { imagen: '🖼️', video: '🎬', pdf: '📄', archivo: '📎' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function fechaLegible(iso) {
    const partes = String(iso || '').split('-');
    if (partes.length !== 3) return iso || '';
    return Number(partes[2]) + ' ' + MESES[Number(partes[1]) - 1] + ' ' + partes[0];
}

async function cargarBitacora() {
    const caja = $('bitacora');
    try {
        const datos = await pedir('/api/bitacora');
        const registros = datos.registros || [];
        if (!registros.length) {
            caja.innerHTML = '<div class="vacio-bitacora">Todavía no hay notas compartidas contigo. ' +
                'Cuando tu manager te comparta una, aparece aquí.</div>';
            return;
        }
        caja.innerHTML = registros.map((r) =>
            '<article class="tarjeta registro">' +
                '<div class="fecha">' + escapar(fechaLegible(r.fecha)) + (r.por ? ' · ' + escapar(r.por) : '') + '</div>' +
                '<h3>' + escapar(r.titulo) + '</h3>' +
                (r.texto ? '<div class="texto">' + escapar(r.texto) + '</div>' : '') +
                (r.adjuntos.length ? '<div class="adjuntos">' + r.adjuntos.map((a) =>
                    '<button type="button" data-id="' + escapar(r.id) + '" data-n="' + a.n + '">' +
                    (ICONO_ADJUNTO[a.tipo] || '📎') + ' ' + escapar(a.nombre) + '</button>').join('') + '</div>' : '') +
            '</article>').join('');
        caja.querySelectorAll('.adjuntos button').forEach((b) => {
            b.onclick = () => abrirEvidencia(b.dataset.id, b.dataset.n, b);
        });
    } catch (error) {
        caja.innerHTML = '<div class="vacio-bitacora">No se pudo cargar tu bitácora: ' + escapar(error.message) + '</div>';
    }
}

/* La ventana se abre YA, en el toque, o el navegador la bloquea. */
async function abrirEvidencia(id, n, boton) {
    const ventana = window.open('', '_blank');
    boton.disabled = true;
    try {
        const respuesta = await fetch(API + '/api/bitacora/' + encodeURIComponent(id) + '/adjunto/' + n,
                                      { headers: { 'Authorization': 'Bearer ' + estado.token } });
        if (!respuesta.ok) throw new Error('No se pudo abrir el archivo.');
        const url = URL.createObjectURL(await respuesta.blob());
        if (ventana) ventana.location.href = url; else window.location.href = url;
    } catch (error) {
        if (ventana) ventana.close();
        avisar(error.message, 'malo');
    }
    boton.disabled = false;
}

cargar();

})();
