/* ===========================================================================
 * PARADISE · Publicaciones de la modelo (2026-11-23)
 * ===========================================================================
 *
 * El personal las escribe en la Admin (Monitoría ▾ › Publicaciones) y la API
 * entrega solo lo de ella (`/api/publicaciones`, api/publicaciones.py):
 *
 *   Noticias  ancladas en el inicio (panel.html), debajo de los mosaicos.
 *             Si traen pregunta, «Sí, confirmo» la responde; las que faltan
 *             por confirmar van primero.
 *   Posts     Capacitaciones › Tips y videos (capacitaciones.html): tarjetas
 *             con filtro por categoría; un toque abre el post completo
 *             (poster, video, galería, descripción y recurso extra).
 *
 * Las imágenes llegan primero en miniatura (dentro del JSON) y el poster
 * entero se baja después desde Drive con el token (no hay enlace público).
 * La descripción viene en Markdown y se pinta aquí sin HTML ajeno.
 *
 *     PUBLICACIONES.noticias(contenedor)
 *     PUBLICACIONES.posts(contenedorFiltros, contenedorPosts)
 */

(function () {
'use strict';

const API = PARADISE.API_URL;
const token = () => localStorage.getItem('token_sesion') || '';
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const ICONO = { imagen: '🖼️', video: '🎬', pdf: '📄', audio: '🎤', archivo: '📎' };

function escapar(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function fecha(iso) {
    const p = String(iso || '').slice(0, 10).split('-');
    return p.length === 3 ? Number(p[2]) + ' ' + MESES[Number(p[1]) - 1] + ' ' + p[0] : '';
}

function peso(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1).replace('.0', '') + ' MB';
}

async function pedir(ruta, metodo) {
    const r = await fetch(API + ruta, {
        method: metodo || 'GET', cache: 'no-store',
        headers: { 'Authorization': 'Bearer ' + token() },
    });
    if (r.status === 401) {
        PARADISE.olvidar('token_sesion');
        window.location.href = PARADISE.URL_LOGIN;
        throw new Error('sesión caducada');
    }
    let datos = {};
    try { datos = await r.json(); } catch (e) { datos = {}; }
    if (!r.ok) throw new Error(datos.detail || 'No se pudo completar la acción.');
    return datos;
}

const blobs = {};
async function urlArchivo(ruta) {
    if (blobs[ruta]) return blobs[ruta];
    const r = await fetch(API + ruta, { headers: { 'Authorization': 'Bearer ' + token() } });
    if (!r.ok) throw new Error('No se pudo abrir el archivo.');
    blobs[ruta] = URL.createObjectURL(await r.blob());
    return blobs[ruta];
}

/* Cambia la miniatura por la imagen entera cuando llega. */
function mejorar(img, ruta) {
    urlArchivo(ruta).then((url) => { img.src = url; }).catch(() => {});
}

/* La ventana se abre YA, en el toque, o el navegador la bloquea. */
async function abrirArchivo(ruta, boton) {
    const ventana = window.open('', '_blank');
    if (boton) boton.disabled = true;
    try {
        const url = await urlArchivo(ruta);
        if (ventana) ventana.location.href = url; else window.location.href = url;
    } catch (error) {
        if (ventana) ventana.close();
        window.alert(error.message);
    }
    if (boton) boton.disabled = false;
}

// =======================================================================
// MARKDOWN (lo que escribe el editor de la Admin: títulos, negrita,
// cursiva, listas y enlaces). Se escapa TODO primero: nunca entra HTML.
// =======================================================================
function enLinea(texto) {
    const guardados = [];
    let t = escapar(texto).replace(/\\([\\`*_{}\[\]()#+\-.!|~>])/g, (_m, c) => {
        guardados.push(c);
        return '\u0000' + (guardados.length - 1) + '\u0000';
    });
    t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
                  '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
         .replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
         .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
         .replace(/__(.+?)__/g, '<strong>$1</strong>')
         .replace(/\*(.+?)\*/g, '<em>$1</em>')
         .replace(/(^|[\s(])_(.+?)_(?=$|[\s).,;:!?])/g, '$1<em>$2</em>');
    return t.replace(/\u0000(\d+)\u0000/g, (_m, i) => escapar(guardados[Number(i)]));
}

function markdown(texto) {
    const salida = [];
    let parrafo = [], lista = null, item = null;
    const cerrarParrafo = () => {
        if (parrafo.length) salida.push('<p>' + parrafo.join('') + '</p>');
        parrafo = [];
    };
    const cerrarLista = () => {
        if (lista) salida.push('<' + lista.tipo + '>' + lista.items.map((i) => '<li>' + i + '</li>').join('') +
                                '</' + lista.tipo + '>');
        lista = null; item = null;
    };
    const linea = (l) => {
        const duro = /( {2,}|\\)$/.test(l);
        const limpia = l.replace(/( {2,}|\\)$/, '').trim();
        return enLinea(limpia) + (duro ? '<br>' : ' ');
    };
    String(texto || '').replace(/\r/g, '').split('\n').forEach((l) => {
        let m;
        if (!l.trim()) { cerrarParrafo(); cerrarLista(); return; }
        if ((m = l.match(/^\s{0,3}(#{1,6})\s+(.*)$/))) {
            cerrarParrafo(); cerrarLista();
            const nivel = Math.min(4, m[1].length + 1);
            salida.push('<h' + nivel + '>' + enLinea(m[2].replace(/\s+#+\s*$/, '')) + '</h' + nivel + '>');
            return;
        }
        if ((m = l.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/))) {
            cerrarParrafo();
            const tipo = /\d/.test(m[1]) ? 'ol' : 'ul';
            if (!lista || lista.tipo !== tipo) { cerrarLista(); lista = { tipo, items: [] }; }
            lista.items.push(linea(m[2]));
            item = lista.items.length - 1;
            return;
        }
        if (lista && item !== null && /^\s+/.test(l)) { lista.items[item] += linea(l); return; }
        cerrarLista();
        parrafo.push(linea(l));
    });
    cerrarParrafo(); cerrarLista();
    return salida.join('');
}

function youtube(url) {
    const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/);
    return m ? m[1] : '';
}

// =======================================================================
// NOTICIAS DEL INICIO
// =======================================================================
function tarjetaNoticia(n) {
    const confirmar = n.pregunta && !n.confirmada;
    return '<article class="pub-noticia' + (confirmar ? '' : ' hecha') + '" data-id="' + escapar(n.id) + '">' +
        (n.poster_mini ? '<img class="pub-poster" alt="" src="' + escapar(n.poster_mini) + '">' : '') +
        '<div class="pub-cuerpo">' +
            '<span class="pub-sello">📌 Noticia</span>' +
            '<h3>' + escapar(n.titulo) + '</h3>' +
            '<div class="pub-meta">' + escapar(fecha(n.cuando)) + (n.por ? ' · ' + escapar(n.por) : '') + '</div>' +
            (n.descripcion ? '<div class="pub-texto corto">' + markdown(n.descripcion) + '</div>' +
                             '<button type="button" class="pub-mas oculto">Leer todo</button>' : '') +
            (n.recurso ? '<div><button type="button" class="pub-recurso" data-ruta="/api/publicaciones/noticias/' +
                encodeURIComponent(n.id) + '/archivo/recurso">' + (ICONO[n.recurso.tipo] || '📎') + ' ' +
                escapar(n.recurso.nombre) + (n.recurso.bytes ? ' · ' + peso(n.recurso.bytes) : '') + '</button></div>' : '') +
            (confirmar ? '<div class="pub-pregunta">❓ ' + escapar(n.pregunta) +
                '<button type="button" class="pd-boton pub-confirmar">Sí, confirmo</button></div>' : '') +
            (n.pregunta && n.confirmada ? '<div class="pub-confirmada">✔ Confirmaste' +
                (n.confirmada_en ? ' el ' + escapar(fecha(n.confirmada_en)) : '') + '</div>' : '') +
        '</div></article>';
}

async function noticias(caja) {
    if (!caja) return;
    let lista = [];
    try { lista = (await pedir('/api/publicaciones/noticias')).noticias || []; }
    catch (error) { return; /* el inicio no depende de esto */ }
    caja.innerHTML = lista.map(tarjetaNoticia).join('');
    caja.querySelectorAll('.pub-noticia').forEach((t) => {
        const id = t.dataset.id;
        const n = lista.find((x) => x.id === id);
        const img = t.querySelector('.pub-poster');
        if (img && n.poster) mejorar(img, '/api/publicaciones/noticias/' + encodeURIComponent(id) + '/archivo/poster');
        const texto = t.querySelector('.pub-texto.corto');
        const mas = t.querySelector('.pub-mas');
        if (texto && mas && texto.scrollHeight > texto.clientHeight + 4) {
            mas.classList.remove('oculto');
            mas.onclick = () => { texto.classList.remove('corto'); mas.remove(); };
        }
        const recurso = t.querySelector('.pub-recurso');
        if (recurso) recurso.onclick = () => abrirArchivo(recurso.dataset.ruta, recurso);
        const boton = t.querySelector('.pub-confirmar');
        if (boton) boton.onclick = async () => {
            boton.disabled = true; boton.textContent = 'Enviando…';
            try {
                await pedir('/api/publicaciones/noticias/' + encodeURIComponent(id) + '/confirmar', 'POST');
                noticias(caja);
            } catch (error) {
                boton.disabled = false; boton.textContent = 'Sí, confirmo';
                window.alert(error.message);
            }
        };
    });
}

// =======================================================================
// POSTS (Capacitaciones › Tips y videos)
// =======================================================================
async function posts(cajaFiltros, cajaPosts) {
    if (!cajaPosts) return;
    let datos;
    try { datos = await pedir('/api/publicaciones/posts'); }
    catch (error) {
        cajaPosts.innerHTML = '<div class="pub-vacio">No se pudieron cargar los tips: ' + escapar(error.message) + '</div>';
        return;
    }
    const lista = datos.posts || [];
    let filtro = '';
    function pintar() {
        const visibles = lista.filter((p) => !filtro || p.categorias.indexOf(filtro) >= 0);
        if (cajaFiltros) {
            cajaFiltros.innerHTML = (datos.categorias || []).length < 2 ? '' :
                ['<button type="button" data-c=""' + (filtro ? '' : ' class="activo"') + '>Todos</button>']
                .concat(datos.categorias.map((c) => '<button type="button" data-c="' + escapar(c) + '"' +
                        (c === filtro ? ' class="activo"' : '') + '>' + escapar(c) + '</button>')).join('');
            cajaFiltros.querySelectorAll('button').forEach((b) => { b.onclick = () => { filtro = b.dataset.c; pintar(); }; });
        }
        cajaPosts.classList.toggle('pub-posts', visibles.length > 0);
        cajaPosts.innerHTML = visibles.length ? visibles.map((p) =>
            '<button type="button" class="pub-post" data-id="' + escapar(p.id) + '">' +
                (p.poster_mini ? '<img alt="" src="' + escapar(p.poster_mini) + '">' : '') +
                '<div class="pie"><h3>' + (p.tiene_video ? '▶ ' : '') + escapar(p.titulo) + '</h3>' +
                (p.descripcion_corta ? '<p>' + escapar(p.descripcion_corta) + '</p>' : '') +
                '<div class="cats">' + escapar(p.categorias.join(' · ')) + '</div></div></button>').join('')
            : '<div class="pub-vacio">Muy pronto vas a encontrar aquí tips y videos de las mejores modelos del estudio.</div>';
        cajaPosts.querySelectorAll('.pub-post').forEach((b) => { b.onclick = () => abrirPost(b.dataset.id); });
    }
    pintar();
    const pedido = new URLSearchParams(window.location.search).get('post');
    if (pedido) abrirPost(pedido);
}

async function abrirPost(id) {
    const capa = document.createElement('div');
    capa.className = 'pub-capa';
    capa.innerHTML = '<div class="dentro"><button type="button" class="pub-cerrar">✕ Cerrar</button>' +
                     '<div class="pub-vacio">Cargando…</div></div>';
    document.body.appendChild(capa);
    document.body.style.overflow = 'hidden';
    const cerrar = () => { capa.remove(); document.body.style.overflow = ''; };
    capa.querySelector('.pub-cerrar').onclick = cerrar;
    const base = '/api/publicaciones/posts/' + encodeURIComponent(id);
    let p;
    try { p = (await pedir(base)).post; }
    catch (error) { capa.querySelector('.pub-vacio').textContent = error.message; return; }
    const yt = youtube(p.video_url);
    capa.querySelector('.dentro').innerHTML = '<button type="button" class="pub-cerrar">✕ Cerrar</button>' +
        '<h2>' + escapar(p.titulo) + '</h2>' +
        '<div class="pub-meta">' + escapar(p.categorias.join(' · ')) + (p.cuando ? ' · ' + escapar(fecha(p.cuando)) : '') + '</div>' +
        (yt ? '<div class="pub-video"><iframe src="https://www.youtube-nocookie.com/embed/' + escapar(yt) +
              '" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>'
            : (p.poster_mini ? '<img class="pub-poster" alt="" src="' + escapar(p.poster_mini) + '">' : '')) +
        (p.video_url && !yt ? '<a class="pd-boton" style="margin:12px 0" target="_blank" rel="noopener noreferrer" href="' +
              escapar(p.video_url) + '">▶ Ver el video</a>' : '') +
        (p.descripcion ? '<div class="pub-texto" style="margin-top:12px">' + markdown(p.descripcion) + '</div>'
                       : (p.descripcion_corta ? '<div class="pub-texto" style="margin-top:12px">' + escapar(p.descripcion_corta) + '</div>' : '')) +
        (p.galeria.length ? '<div class="pub-galeria">' + p.galeria.map((g, n) =>
              '<img alt="" data-n="' + n + '">').join('') + '</div>' : '') +
        (p.recurso ? '<button type="button" class="pub-recurso">' + (ICONO[p.recurso.tipo] || '📎') + ' ' +
              escapar(p.recurso.nombre) + (p.recurso.bytes ? ' · ' + peso(p.recurso.bytes) : '') + '</button>' : '');
    capa.querySelector('.pub-cerrar').onclick = cerrar;
    const poster = capa.querySelector('.pub-poster');
    if (poster && p.poster) mejorar(poster, base + '/archivo/poster');
    capa.querySelectorAll('.pub-galeria img').forEach((img) => {
        const ruta = base + '/archivo/galeria?n=' + img.dataset.n;
        mejorar(img, ruta);
        img.onclick = () => abrirArchivo(ruta);
    });
    const recurso = capa.querySelector('.pub-recurso');
    if (recurso) recurso.onclick = () => abrirArchivo(base + '/archivo/recurso', recurso);
}

window.PUBLICACIONES = { noticias, posts, markdown };

})();
