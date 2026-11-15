/* ===========================================================================
 * PARADISE · 💵 Mi producido (pestaña de pagos.html)
 * ===========================================================================
 *
 * Lo que la modelo lleva producido en dólares, página por página, con la
 * semana en curso y la anterior (`/api/nomina/mio`). La semana va del domingo
 * 12:00 am al sábado 11:59:59 pm (el corte).
 *
 * Antes vivía en el INICIO (js/panel.js). Con el rediseño de 2026-11-15 pasó
 * a la pestaña «Mi producido» de Pagos.
 *
 *     ProducidoParadise.cargar(caja, lista)
 *         caja   el bloque entero: se esconde si no hay páginas
 *         lista  donde se pintan las páginas
 */
window.ProducidoParadise = (function () {
'use strict';

function escapar(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function dolares(n) {
    return '$' + Number(n || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function cifraSemana(semana, p) {
    const rotulo = semana.en_curso ? 'Esta semana' : 'Semana anterior';
    return '<div><div class="rotulo">' + rotulo + '</div><div class="usd">' +
        (p && p.ok ? dolares(p.usd) : '—') + '</div><div class="rotulo">' +
        escapar(semana.etiqueta.replace(/^del /, '')) + '</div></div>';
}

function paginaProducido(f, semanas) {
    const actual = (f.semanas || [])[0] || {};
    const error = !actual.ok ? '<div class="nota">' + escapar(actual.error || '') + '</div>' : '';
    const detalle = (actual.detalle || []).map((d) =>
        '<div><span>' + escapar(d.concepto) + '</span><span>' + dolares(d.usd) + '</span></div>').join('');
    return '<div class="pagina-producido"><div class="cabeza"><span>' + escapar(f.pagina) + '</span><span>' +
        escapar(f.nick || '') + '</span></div><div class="cifras">' +
        semanas.map((s, i) => cifraSemana(s, (f.semanas || [])[i])).join('') + '</div>' + error +
        (detalle ? '<div class="detalle oculto">' + detalle + '</div>' : '') + '</div>';
}

async function cargar(caja, lista) {
    let datos;
    try {
        datos = await PARADISE_BARRA.pedir('/api/nomina/mio');
    } catch (e) {
        lista.innerHTML = '<div class="vacio-producido">No se pudo cargar tu producido. Inténtalo más tarde.</div>';
        return;
    }
    const paginas = datos.paginas || [];
    if (!paginas.length) {
        lista.innerHTML = '<div class="vacio-producido">Todavía no hay producido para mostrar.</div>';
        return;
    }
    lista.innerHTML = paginas.map((f) => paginaProducido(f, datos.semanas || [])).join('');
    lista.querySelectorAll('.pagina-producido').forEach((bloque) => {
        bloque.onclick = () => { const d = bloque.querySelector('.detalle'); if (d) d.classList.toggle('oculto'); };
    });
}

return { cargar: cargar };
})();
