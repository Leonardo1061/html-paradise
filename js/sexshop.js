/* ===========================================================================
 * PARADISE · SexShop de la web de modelos (2026-11-15)
 * ===========================================================================
 * Pide el catálogo una vez (GET /api/tienda/sexshop) y aquí:
 *   - busca por nombre (sin tildes ni mayúsculas) mientras escribe,
 *   - muestra 20 productos por página con botones 1, 2, 3…,
 *   - «Solicitar» abre el ticket al CEO con el producto ya escrito.
 * La lista se recuerda en sessionStorage 5 min para no pedirla en cada vuelta.
 * ======================================================================== */
(function () {
'use strict';

const POR_PAGINA = 20;
const API = PARADISE.API_URL;
const CLAVE_CACHE = 'pdz_sexshop';
const MS_CACHE = 5 * 60 * 1000;
const $ = (id) => document.getElementById(id);

let productos = [];
let filtrados = [];
let pagina = 1;

const simple = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/\s+/g, ' ').trim();
const pesos = (n) => '$' + Math.round(n).toLocaleString('es-CO');
function escapar(t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ------------------------------------------------------------------ pestañas
$('tabs').addEventListener('click', (ev) => {
    const boton = ev.target.closest('button[data-tab]');
    if (!boton) return;
    document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('activo', b === boton));
    ['catalogo', 'solicitudes', 'deuda'].forEach((t) =>
        $('tab-' + t).classList.toggle('oculto', t !== boton.dataset.tab));
});
$('ver-campana').onclick = () => window.PARADISE_BARRA && PARADISE_BARRA.abrirCampana();

// ------------------------------------------------------------------ catálogo
function tarjeta(p) {
    const div = document.createElement('div');
    div.className = 'prod';
    const precio = p.precio == null ? '' :
        (p.precio > 0 ? '<span class="precio">' + pesos(p.precio) + '</span>' : '');
    div.innerHTML =
        '<div class="im">' + (p.foto
            ? '<img loading="lazy" decoding="async" alt="">'
            : '<span class="sin">🛍️</span>') + '</div>' +
        '<div class="tx"><b>' + escapar(p.nombre) + '</b>' + precio +
        '<button class="bo">Solicitar</button></div>';
    if (p.foto) {
        const img = div.querySelector('img');
        img.src = API + p.foto;
        img.alt = p.nombre;
        img.onerror = () => { img.parentNode.innerHTML = '<span class="sin">🛍️</span>'; };
    }
    div.querySelector('.bo').onclick = () => solicitar(p);
    return div;
}

function solicitar(p) {
    if (!window.PARADISE_BARRA) return;
    const precio = p.precio ? ' (' + pesos(p.precio) + ')' : '';
    PARADISE_BARRA.abrirNuevo({
        tipo: /produc|sex\s*shop|tienda|compra/i,
        asunto: 'SexShop: ' + p.nombre,
        detalle: 'Quiero solicitar este producto de la SexShop: ' + p.nombre + precio +
            '.\nCuotas que quiero (opcional): ',
    });
}

function botonPagina(texto, destino, clase, apagado) {
    const b = document.createElement('button');
    b.textContent = texto;
    if (clase) b.className = clase;
    b.disabled = !!apagado;
    b.onclick = () => { pagina = destino; pintar(true); };
    return b;
}

function pintarPaginas(total) {
    const nav = $('paginas');
    nav.innerHTML = '';
    if (total <= 1) return;
    nav.appendChild(botonPagina('‹', pagina - 1, '', pagina === 1));
    // 1 … (actual-1) actual (actual+1) … última
    const ver = new Set([1, total, pagina - 1, pagina, pagina + 1]);
    if (pagina <= 3) [2, 3, 4].forEach((n) => ver.add(n));
    if (pagina >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => ver.add(n));
    let anterior = 0;
    [...ver].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b).forEach((n) => {
        if (n - anterior > 1) {
            const puntos = document.createElement('span');
            puntos.className = 'puntos';
            puntos.textContent = '…';
            nav.appendChild(puntos);
        }
        nav.appendChild(botonPagina(String(n), n, n === pagina ? 'activa' : ''));
        anterior = n;
    });
    nav.appendChild(botonPagina('›', pagina + 1, '', pagina === total));
}

function pintar(subir) {
    const total = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
    pagina = Math.min(Math.max(1, pagina), total);
    const caja = $('prods');
    caja.innerHTML = '';
    const desde = (pagina - 1) * POR_PAGINA;
    filtrados.slice(desde, desde + POR_PAGINA).forEach((p) => caja.appendChild(tarjeta(p)));

    const buscando = simple($('buscar').value);
    if (!filtrados.length) {
        $('aviso').textContent = buscando ? 'No hay productos con ese nombre.' : 'Todavía no hay productos en la SexShop.';
        $('aviso').classList.remove('oculto');
    } else {
        $('aviso').classList.add('oculto');
    }
    $('cuenta').textContent = filtrados.length
        ? filtrados.length + (filtrados.length === 1 ? ' producto' : ' productos') +
          (total > 1 ? ' · página ' + pagina + ' de ' + total : '')
        : '';
    pintarPaginas(total);
    if (subir) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function filtrar() {
    const q = simple($('buscar').value);
    filtrados = q ? productos.filter((p) => p._clave.includes(q)) : productos.slice();
    pagina = 1;
    pintar(false);
}

let espera = 0;
$('buscar').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(filtrar, 150); });
$('buscar').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ev.target.blur(); });

function usar(datos) {
    productos = (datos.productos || []).map((p) => Object.assign({ _clave: simple(p.nombre) }, p));
    filtrar();
}

async function cargar() {
    try {
        const guardado = JSON.parse(sessionStorage.getItem(CLAVE_CACHE) || 'null');
        if (guardado && Date.now() - guardado.cuando < MS_CACHE) { usar(guardado.datos); return; }
    } catch (e) { /* sin caché */ }
    try {
        const datos = await PARADISE_BARRA.pedir('/api/tienda/sexshop');
        usar(datos);
        try { sessionStorage.setItem(CLAVE_CACHE, JSON.stringify({ cuando: Date.now(), datos })); } catch (e) { /* lleno */ }
    } catch (error) {
        $('aviso').innerHTML = escapar(error.message || 'No se pudo cargar el catálogo.') +
            '<br><button class="pd-boton linea" id="reintentar">Reintentar</button>';
        $('reintentar').onclick = () => { $('aviso').textContent = 'Cargando el catálogo…'; cargar(); };
    }
}

cargar();
})();
