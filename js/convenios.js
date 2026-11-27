/* ===========================================================================
 * PARADISE · 🤝 Convenios de la modelo (convenios.html, 2026-11-27)
 * ===========================================================================
 * Los descuentos con empresas aliadas que el CEO carga en la Admin o en la
 * web del personal. /api/convenios entrega los activos, con la foto en
 * miniatura. Se ven como la SexShop: cuadrícula de tarjetas (foto, nombre y
 * descripción corta) con buscador y el botón dorado «Más info», que abre la
 * hoja con todo; allí la foto se cambia por la entera desde Drive (con el
 * token). En el contacto, los enlaces y los teléfonos se pueden tocar.
 */
(function () {
'use strict';

const API = PARADISE.API_URL;
const token = () => localStorage.getItem('token_sesion') || '';
const caja = document.getElementById('convenios');
const $ = (id) => document.getElementById(id);
let convenios = [];

function escapar(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/* Enlaces (http…, www…, @instagram) y teléfonos de 7 a 13 cifras, ya escapado. */
function enlazar(texto) {
    return escapar(texto).replace(
        /(https?:\/\/[^\s<]+|www\.[^\s<]+)|(\+?\d[\d ]{6,16}\d)|(^|\s)@([A-Za-z0-9._]{2,30})/g,
        (todo, url, tel, antes, insta) => {
            if (url) return '<a href="' + (url.indexOf('http') === 0 ? url : 'https://' + url) +
                '" target="_blank" rel="noopener">' + url + '</a>';
            if (tel) {
                const cifras = tel.replace(/\D/g, '');
                if (cifras.length < 7 || cifras.length > 13) return tel;
                const wa = cifras.length === 10 ? '57' + cifras : cifras;
                return '<a href="tel:' + cifras + '">' + tel + '</a> · <a href="https://wa.me/' + wa +
                    '" target="_blank" rel="noopener">WhatsApp</a>';
            }
            return antes + '<a href="https://instagram.com/' + insta + '" target="_blank" rel="noopener">@' + insta + '</a>';
        });
}

async function pedir(ruta) {
    const r = await fetch(API + ruta, { cache: 'no-store', headers: { 'Authorization': 'Bearer ' + token() } });
    if (r.status === 401) {
        PARADISE.olvidar('token_sesion');
        window.location.href = PARADISE.URL_LOGIN;
        throw new Error('sesión caducada');
    }
    let datos = {};
    try { datos = await r.json(); } catch (e) { datos = {}; }
    if (!r.ok) throw new Error(datos.detail || 'No se pudieron cargar los convenios.');
    return datos;
}

function simple(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/* «Más info»: la hoja con la foto grande, la descripción, los requisitos y el contacto. */
function masInfo(c) {
    const capa = document.createElement('div');
    capa.className = 'conv-capa';
    capa.innerHTML = '<div class="conv-velo"></div><div class="conv-hoja" role="dialog" aria-label="' + escapar(c.nombre) + '">' +
        '<button class="cerrar" aria-label="Cerrar">✕</button>' +
        (c.foto_mini ? '<img class="foto" alt="" src="' + escapar(c.foto_mini) + '">' : '') +
        '<div class="cuerpo"><h2>' + escapar(c.nombre) + '</h2>' +
        '<p>' + escapar(c.descripcion) + '</p>' +
        (c.requisitos ? '<div class="conv-bloque"><b>Requisitos</b><p>' + escapar(c.requisitos) + '</p></div>' : '') +
        (c.contacto ? '<div class="conv-bloque"><b>Contacto</b><p>' + enlazar(c.contacto) + '</p></div>' : '') +
        '</div></div>';
    document.body.appendChild(capa);
    const cerrar = () => capa.remove();
    capa.querySelector('.conv-velo').onclick = cerrar;
    capa.querySelector('.cerrar').onclick = cerrar;
    if (c.tiene_foto) {
        fetch(API + '/api/convenios/' + encodeURIComponent(c.id) + '/foto',
              { headers: { 'Authorization': 'Bearer ' + token() } })
            .then((r) => (r.ok ? r.blob() : null))
            .then((b) => { const img = capa.querySelector('.foto'); if (b && img) img.src = URL.createObjectURL(b); })
            .catch(() => {});
    }
}

function tarjeta(c) {
    const div = document.createElement('div');
    div.className = 'prod';
    div.innerHTML = '<div class="im">' + (c.foto_mini ? '<img alt="" src="' + escapar(c.foto_mini) + '">'
                                                      : '<span class="sin">🤝</span>') + '</div>' +
        '<div class="tx"><b>' + escapar(c.nombre) + '</b><span class="desc">' + escapar(c.descripcion) + '</span>' +
        '<button class="bo">Más info</button></div>';
    div.querySelector('.bo').onclick = () => masInfo(c);
    div.querySelector('.im').onclick = () => masInfo(c);
    return div;
}

function pintar() {
    const q = simple($('buscar').value);
    const lista = q ? convenios.filter((c) => simple(c.nombre + ' ' + c.descripcion).indexOf(q) >= 0) : convenios;
    caja.innerHTML = '';
    lista.forEach((c) => caja.appendChild(tarjeta(c)));
    $('cuenta').textContent = lista.length ? lista.length + (lista.length === 1 ? ' convenio' : ' convenios') : '';
    $('aviso').classList.toggle('oculto', lista.length > 0);
    $('aviso').textContent = q ? 'No hay convenios con ese nombre.'
        : 'Todavía no hay convenios activos. Muy pronto vas a encontrar aquí los descuentos con negocios aliados del estudio.';
}

if (token()) {
    $('buscar').oninput = pintar;
    pedir('/api/convenios').then((datos) => { convenios = datos.convenios || []; pintar(); })
        .catch((error) => { $('aviso').textContent = error.message; });
}
})();
