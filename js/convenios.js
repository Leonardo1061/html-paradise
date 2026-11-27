/* ===========================================================================
 * PARADISE · 🤝 Convenios de la modelo (convenios.html, 2026-11-27)
 * ===========================================================================
 * Los descuentos con empresas aliadas que el CEO carga en la Admin o en la
 * web del personal. /api/convenios entrega los activos, con la foto en
 * miniatura; un toque en la foto la baja entera desde Drive (con el token).
 * En el contacto, los enlaces y los teléfonos se pueden tocar.
 */
(function () {
'use strict';

const API = PARADISE.API_URL;
const token = () => localStorage.getItem('token_sesion') || '';
const caja = document.getElementById('convenios');

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

async function verFoto(c, mini) {
    const visor = document.createElement('div');
    visor.className = 'conv-visor';
    visor.innerHTML = '<img alt="" src="' + escapar(mini) + '">';
    visor.onclick = () => visor.remove();
    document.body.appendChild(visor);
    try {
        const r = await fetch(API + '/api/convenios/' + encodeURIComponent(c.id) + '/foto',
                              { headers: { 'Authorization': 'Bearer ' + token() } });
        if (r.ok) visor.querySelector('img').src = URL.createObjectURL(await r.blob());
    } catch (e) { /* se queda la miniatura */ }
}

function pintar(lista) {
    if (!lista.length) {
        caja.innerHTML = '<div class="pd-pronto"><img src="img/convenios.png" alt=""><h2>Convenios Paradise</h2>' +
            '<p>Todavía no hay convenios activos. Muy pronto vas a encontrar aquí los descuentos con negocios aliados del estudio.</p></div>';
        return;
    }
    caja.innerHTML = lista.map((c, i) =>
        '<article class="conv-tarjeta">' +
        (c.foto_mini ? '<img class="conv-foto" data-i="' + i + '" alt="' + escapar(c.nombre) + '" src="' + escapar(c.foto_mini) + '">' : '') +
        '<div class="conv-cuerpo"><h2>' + escapar(c.nombre) + '</h2>' +
        '<p>' + escapar(c.descripcion) + '</p>' +
        (c.requisitos ? '<div class="conv-bloque"><b>Requisitos</b><p>' + escapar(c.requisitos) + '</p></div>' : '') +
        (c.contacto ? '<div class="conv-bloque"><b>Contacto</b><p>' + enlazar(c.contacto) + '</p></div>' : '') +
        '</div></article>').join('');
    caja.querySelectorAll('.conv-foto').forEach((img) => {
        const c = lista[Number(img.dataset.i)];
        img.onclick = () => verFoto(c, c.foto_mini);
    });
}

if (token()) {
    pedir('/api/convenios').then((datos) => pintar(datos.convenios || []))
        .catch((error) => { caja.innerHTML = '<div class="conv-vacio">' + escapar(error.message) + '</div>'; });
}
})();
