/* ===========================================================================
 * PARADISE · Chat de la modelo (chat.html y la pestaña Chat de fotografia.html)
 * ===========================================================================
 *
 * Un componente que se monta en cualquier página:
 *
 *     const chat = ChatParadise.montar(elemento, { canalFijo: 'fotografia' });
 *     chat.activar();      // empieza a preguntar por mensajes nuevos
 *     chat.desactivar();   // deja de preguntar (pestaña escondida)
 *
 * Sin `canalFijo` enseña arriba los chats: Soporte y uno por cada rol del
 * estudio. Con él, solo esa conversación (el chat con Fotografía).
 *
 * TODO VA AL MISMO SITIO
 * ----------------------
 * La API escribe en la misma conversación que el monitor ya tiene en el
 * escritorio, con el canal marcado en cada mensaje. Soporte lo atiende el
 * monitor de turno (Mañana, Tarde, Noche o Satélites). Cada chip de rol
 * (Monitor Mañana, Programación, CEO, Gerencia…) es privado: solo lo lee
 * quien tiene ese rol (api/reglas_personal.py y repo_chats del escritorio).
 *
 * «EN TIEMPO REAL»
 * ----------------
 * Cada 4 segundos, solo con la página a la vista, se pregunta qué llegó
 * después de la última vez (`/api/chat/nuevos`). Si no llegó nada cuesta
 * una lectura. Lo que llega a otro canal enciende su contador.
 *
 * «VISTO POR» (2026-10-07): debajo de cada mensaje suyo sale quién del
 * personal lo vio («✓✓ Visto por Alejandro Gomez»). La misma vuelta de 4 s
 * trae los vistos nuevos (`vistos` en `/api/chat/nuevos`).
 *
 * LA BURBUJA 💬 (js/barra_modelo.js): en las demás páginas cuenta lo que le
 * escribieron después de `chat_visto_hasta`. Con el chat completo abierto
 * (sin `canalFijo`, o con `marcaVisto` como chat.html, fijo en Soporte) ese
 * cursor se guarda en cada vuelta: lo que ve ya no cuenta.
 *
 * REACCIONES Y ENLACES (2026-10-17, js/reacciones.js): mantener el dedo sobre
 * un mensaje saca la barra de emojis; la reacción es la misma que ve el
 * monitor en el escritorio. La vuelta de 4 s trae las que cambiaron
 * (`reacciones` en `/api/chat/nuevos`). Las direcciones del texto son enlaces.
 *
 * LO QUE SE ADJUNTA (js/adjuntos.js, el mismo menú del chat del personal)
 * ------------------------------------------------------------------------
 * La barra va al estilo WhatsApp: 😊 emojis, «Mensaje», 📎 y 📷 dentro de la
 * píldora; fuera, el botón dorado 🎤 que pasa a ➤ cuando hay texto.
 * 📎 Galería (fotos y videos), Cámara (una foto) y Documento (PDF), y 🎤 la
 * nota de voz en WAV. La foto va comprimida DENTRO del mensaje, como las del
 * escritorio. La nota de voz, el video y el PDF van a su carpeta de Drive a
 * través de la API; para oírlos o abrirlos se piden a la API, porque su
 * navegador no tiene permiso sobre esa carpeta.
 */

(function () {
'use strict';

const API = PARADISE.API_URL;
const CADA_MS = 10000;                      // eran 4 s (lecturas de Firestore, 2026-10-29)
const TOPE_FOTO = 650000;                       // base64; la API acepta 700 000
const A = window.Adjuntos;
const R = window.Reacciones;
const MI_CLAVE = 'modelo';                      // su llave en `reacciones`

function escapar(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function token() { return localStorage.getItem('token_sesion') || ''; }

function salirPorSesion() {
    PARADISE.olvidar('token_sesion');
    setTimeout(() => { window.location.href = PARADISE.URL_LOGIN; }, 1500);
}

async function pedir(ruta, metodo, cuerpo) {
    const respuesta = await fetch(API + ruta, {
        method: metodo || 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
        cache: 'no-store',
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    if (respuesta.status === 401) {
        salirPorSesion();
        throw new Error('Tu sesión caducó. Entra otra vez.');
    }
    let datos = {};
    try { datos = await respuesta.json(); } catch (e) { datos = {}; }
    if (!respuesta.ok) throw new Error(datos.detail || 'No se pudo completar la acción.');
    return datos;
}

/* Subida con barra de progreso: fetch no la da, XMLHttpRequest sí. */
function subir(ruta, formulario, alAvanzar) {
    let xhr = null;
    const promesa = new Promise((resolver, rechazar) => {
        xhr = new XMLHttpRequest();
        xhr.open('POST', API + ruta);
        xhr.setRequestHeader('Authorization', 'Bearer ' + token());
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) alAvanzar(e.loaded / e.total); };
        xhr.onload = () => {
            let datos = {};
            try { datos = JSON.parse(xhr.responseText); } catch (e) { datos = {}; }
            if (xhr.status === 401) { salirPorSesion(); rechazar(new Error('Tu sesión caducó.')); return; }
            if (xhr.status >= 200 && xhr.status < 300) resolver(datos);
            else rechazar(new Error(datos.detail || 'No se pudo enviar el archivo.'));
        };
        xhr.onerror = () => rechazar(new Error('Se cortó la conexión. Inténtalo otra vez.'));
        xhr.onabort = () => rechazar(new Error('cancelado'));
        xhr.send(formulario);
    });
    promesa.cancelar = () => xhr && xhr.abort();
    return promesa;
}

async function pedirArchivo(ruta) {
    const respuesta = await fetch(API + ruta, { headers: { 'Authorization': 'Bearer ' + token() } });
    if (!respuesta.ok) throw new Error('No se pudo abrir el archivo.');
    return URL.createObjectURL(await respuesta.blob());
}

function etiquetaDia(fecha) {
    if (!fecha) return '';
    const hoy = new Date();
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    if (fecha === iso(hoy)) return 'Hoy';
    const ayer = new Date(hoy.getTime() - 86400000);
    if (fecha === iso(ayer)) return 'Ayer';
    const [a, m, d] = fecha.split('-');
    return d + '/' + m + '/' + a;
}

// =======================================================================
// LA BARRA DE ESCRIBIR (estilo WhatsApp, 2026-11-23)
// =======================================================================
/* Píldora con 😊 · «Mensaje» · 📎 · 📷 y, fuera, el botón redondo dorado:
   🎤 sin texto, ➤ con texto. Iconos de línea en SVG (heredan el color). */
const svg = (d) => '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ' +
    'stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const ICONO = {
    emoji: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/>' +
               '<circle cx="9" cy="10" r=".6" fill="currentColor"/><circle cx="15" cy="10" r=".6" fill="currentColor"/>'),
    teclado: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>'),
    clip: svg('<path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/>'),
    camara: svg('<path d="M4 8h3l2-2.5h6L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/>' +
                '<circle cx="12" cy="13" r="3.6"/>'),
    mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'),
    enviar: '<svg viewBox="0 0 24 24" width="21" height="21" fill="currentColor" aria-hidden="true">' +
            '<path d="M3.4 20.4l17.4-7.5a1 1 0 0 0 0-1.8L3.4 3.6a.9.9 0 0 0-1.3 1L4 11l9 1-9 1-1.9 6.4a.9.9 0 0 0 1.3 1z"/></svg>',
};

const esTactil = () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

/* 📷 dentro de la píldora: en el teléfono abre la cámara del sistema (que
   también deja elegir de la galería); en el ordenador, la del navegador. */
function conectarCamara(boton, alElegir) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.className = 'oculto';
    input.onchange = () => {
        const archivo = input.files && input.files[0];
        input.value = '';
        if (archivo) alElegir(archivo, 'camara');
    };
    boton.parentNode.appendChild(input);
    boton.onclick = async () => {
        if (!esTactil() && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            const foto = await A.camara();
            if (foto) alElegir(foto, 'camara');
            return;
        }
        input.click();
    };
}

const GRUPOS_EMOJI = [
    ['😊', 'Caras', '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 💩 👻 💀 🤡'],
    ['👍', 'Gestos', '👍 👎 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ ✋ 🤚 🖐️ 🖖 👋 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 👀 👁️ 👅 👄 💋 🙋‍♀️ 🙆‍♀️ 🙅‍♀️ 🤷‍♀️ 🤦‍♀️ 💁‍♀️ 🙇‍♀️ 💃 🧘‍♀️'],
    ['❤️', 'Corazones', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💯 💢 💥 💫 💦 💨 🔥 ✨ ⭐ 🌟 💤 ✅ ❌ ❗ ❓ ⚠️ 🔞'],
    ['🎉', 'Cosas', '🎉 🎊 🎁 🎈 🎂 🍾 🥂 🍷 🍸 ☕ 🍓 🍒 🍑 🍆 🌹 🌸 🌺 💐 🌙 ☀️ 🌈 💄 👠 👙 👗 💍 💎 👑 💰 💵 💸 📸 📷 🎥 💻 📱 🎧 🎤 🎶 🕯️ ⏰ 📅 📌 🔒 🔑 🏠 🚗 ✈️'],
];

/* 😊 dentro de la píldora: un panel encima de la barra; cada emoji se mete
   donde está el cursor. Abierto, el icono pasa a teclado (como WhatsApp). */
function conectarEmojis(boton, caja, alCambiar) {
    const pie = boton.closest('.chat-pie');
    const panel = document.createElement('div');
    panel.className = 'chat-emojis oculto';
    panel.innerHTML =
        '<div class="chat-emojis-grupos">' + GRUPOS_EMOJI.map((g, i) =>
            '<button data-g="' + i + '" title="' + g[1] + '">' + g[0] + '</button>').join('') +
        '</div><div class="chat-emojis-rejilla"></div>';
    pie.insertBefore(panel, pie.firstChild);
    const rejilla = panel.querySelector('.chat-emojis-rejilla');

    function pintarGrupo(i) {
        rejilla.innerHTML = GRUPOS_EMOJI[i][2].split(' ').map((e) => '<button>' + e + '</button>').join('');
        rejilla.scrollTop = 0;
        panel.querySelectorAll('.chat-emojis-grupos button').forEach((b) =>
            b.classList.toggle('activo', Number(b.dataset.g) === i));
    }
    panel.querySelectorAll('.chat-emojis-grupos button').forEach((b) => {
        b.onclick = () => pintarGrupo(Number(b.dataset.g));
    });
    rejilla.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const emoji = b.textContent;
        if (caja.maxLength > 0 && caja.value.length + emoji.length > caja.maxLength) return;
        const inicio = caja.selectionStart != null ? caja.selectionStart : caja.value.length;
        const fin = caja.selectionEnd != null ? caja.selectionEnd : inicio;
        caja.value = caja.value.slice(0, inicio) + emoji + caja.value.slice(fin);
        const cursor = inicio + emoji.length;
        caja.setSelectionRange(cursor, cursor);
        if (!esTactil()) caja.focus();              // en el teléfono no sube el teclado
        alCambiar();
    });

    const abierto = () => !panel.classList.contains('oculto');
    const fuera = (e) => { if (!panel.contains(e.target) && !boton.contains(e.target)) cerrar(); };
    function cerrar() {
        panel.classList.add('oculto');
        boton.innerHTML = ICONO.emoji;
        boton.title = 'Emojis';
        document.removeEventListener('click', fuera, true);
    }
    function abrir() {
        if (!rejilla.firstChild) pintarGrupo(0);
        if (esTactil()) caja.blur();
        panel.classList.remove('oculto');
        boton.innerHTML = ICONO.teclado;
        boton.title = 'Teclado';
        document.addEventListener('click', fuera, true);
    }
    boton.onclick = () => {
        if (!abierto()) { abrir(); return; }
        cerrar();
        caja.focus();
    };
    // En el teléfono, tocar el texto saca el teclado y esconde los emojis.
    caja.addEventListener('focus', () => { if (esTactil() && abierto()) cerrar(); });
}

// =======================================================================
// EL COMPONENTE
// =======================================================================
function montar(raiz, opciones) {
    opciones = opciones || {};
    const avisar = opciones.avisar || ((texto) => window.alert(texto));
    const fijo = opciones.canalFijo || '';

    const estado = {
        canales: [fijo ? { id: fijo, nombre: opciones.nombreFijo || fijo } : { id: 'soporte', nombre: 'Soporte' }],
        canal: fijo || 'soporte',
        porCanal: {},                   // id -> [mensajes]
        cargados: {},                   // id -> true si ya se pidió su historial
        vistos: new Set(),              // ids ya pintados o contados
        sinLeer: {},                    // id de canal -> cuántos del monitor
        cursor: '',
        activo: false,
        reloj: null,
        preguntando: false,
        fotoPendiente: '',
        subida: null,
        medios: {},                     // id de mensaje -> URL ya descargada
        fotos: {},                      // id de mensaje -> data URL
    };

    raiz.innerHTML =
        '<div class="chat-canales' + (fijo ? ' oculto' : '') + '"></div>' +
        '<div class="chat-ayuda"></div>' +
        '<div class="chat-lista"><div class="chat-vacio">Cargando…</div></div>' +
        '<div class="chat-pie">' +
        '  <div class="chat-previa"></div>' +
        '  <div class="chat-barra estilo-wa">' +
        '    <div class="chat-pildora">' +
        '      <button class="chat-emoji" title="Emojis">' + ICONO.emoji + '</button>' +
        '      <textarea class="chat-texto" rows="1" maxlength="2000" placeholder="Mensaje"></textarea>' +
        '      <button class="chat-clip" title="Adjuntar">' + ICONO.clip + '</button>' +
        '      <button class="chat-foto-boton" title="Tomar o subir una foto">' + ICONO.camara + '</button>' +
        '    </div>' +
        '    <button class="chat-mic" title="Grabar nota de voz">' + ICONO.mic + '</button>' +
        '    <button class="chat-enviar oculto" title="Enviar">' + ICONO.enviar + '</button>' +
        '  </div>' +
        A.BARRA_GRABANDO +
        '</div>';

    const el = (sel) => raiz.querySelector(sel);
    const lista = el('.chat-lista');
    const caja = el('.chat-texto');

    // ------------------------------------------------------------ canales
    function nombreCanal(id) {
        const canal = estado.canales.find((c) => c.id === id);
        return canal ? canal.nombre : id;
    }

    function pintarCanales() {
        if (fijo) return;
        el('.chat-canales').innerHTML = estado.canales.map((c) => {
            const n = estado.sinLeer[c.id] || 0;
            return '<button class="chat-canal' + (c.id === estado.canal ? ' activo' : '') +
                '" data-canal="' + escapar(c.id) + '">' + 
                escapar(c.nombre) + (n ? '<span class="contador">' + n + '</span>' : '') + '</button>';
        }).join('');
        el('.chat-canales').querySelectorAll('.chat-canal').forEach((b) => {
            b.onclick = () => elegirCanal(b.dataset.canal);
        });
    }

    function pintarAyuda() {
        const nombre = nombreCanal(estado.canal);
        el('.chat-ayuda').textContent = estado.canal === 'soporte'
            ? 'Soporte del estudio: te responde el monitor de turno.'
            : 'Mensaje privado para ' + nombre + ': solo lo lee quien tiene ese rol.';
        caja.placeholder = 'Mensaje';
    }

    function elegirCanal(id) {
        estado.canal = id;
        estado.sinLeer[id] = 0;
        pintarCanales();
        pintarAyuda();
        if (estado.cargados[id]) pintarLista(true);
        else cargarCanal(id);
        const activo = el('.chat-canal.activo');
        if (activo) activo.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }

    // ----------------------------------------------------------- mensajes
    function agregar(mensaje) {
        if (estado.vistos.has(mensaje.id)) return false;
        estado.vistos.add(mensaje.id);
        const canal = mensaje.canal_id || 'soporte';
        if (!estado.porCanal[canal]) estado.porCanal[canal] = [];
        estado.porCanal[canal].push(mensaje);
        return true;
    }

    async function cargarCanal(id) {
        lista.innerHTML = '<div class="chat-vacio">Cargando…</div>';
        try {
            const datos = await pedir('/api/chat/mensajes?canal=' + encodeURIComponent(id));
            (datos.mensajes || []).forEach(agregar);
            estado.cargados[id] = true;
            if (!estado.cursor) estado.cursor = datos.cursor;
            marcarVisto();
            if (estado.canal === id) pintarLista(true);
        } catch (error) {
            if (estado.canal === id) {
                lista.innerHTML = '<div class="chat-vacio">No se pudo abrir el chat.<br><small>' +
                    escapar(error.message) + '</small></div>';
            }
        }
    }

    function marcarVisto() {
        if ((fijo && !opciones.marcaVisto) || !estado.activo || !estado.cursor) return;
        try { localStorage.setItem('chat_visto_hasta', estado.cursor); } catch (e) { /* da igual */ }
    }

    // Con `enCaja` (el INICIO) el chat es un cuadro de una pantalla y lo que se
    // desplaza es la lista de adentro, no la página.
    if (opciones.enCaja) raiz.classList.add('chat-en-caja');

    function cercaDelFinal() {
        if (opciones.enCaja) return lista.scrollTop + lista.clientHeight >= lista.scrollHeight - 120;
        return window.innerHeight + window.scrollY >= document.body.scrollHeight - 160;
    }

    function alFinal() {
        if (opciones.enCaja) { lista.scrollTop = lista.scrollHeight; return; }
        window.scrollTo({ top: document.body.scrollHeight });
    }

    function pintarLista(bajar) {
        const mensajes = (estado.porCanal[estado.canal] || []).slice()
            .sort((a, b) => (a.ts || '9') < (b.ts || '9') ? -1 : 1);
        if (!mensajes.length) {
            lista.innerHTML = '<div class="chat-vacio">' + (estado.canal === 'soporte'
                ? 'Todavía no hay mensajes. Escribe y el monitor te responde aquí.'
                : 'Todavía no le has escrito a ' + escapar(nombreCanal(estado.canal)) + '.') + '</div>';
            return;
        }
        lista.innerHTML = '';
        let dia = '';
        mensajes.forEach((m) => {
            if (m.fecha && m.fecha !== dia) {
                dia = m.fecha;
                const sep = document.createElement('div');
                sep.className = 'chat-dia';
                sep.textContent = etiquetaDia(dia);
                lista.appendChild(sep);
            }
            lista.appendChild(burbuja(m));
        });
        if (bajar) requestAnimationFrame(alFinal);
    }

    function burbuja(m) {
        const fila = document.createElement('div');
        fila.className = 'chat-msg ' + (m.de_modelo ? 'mio' : 'suyo') + (m.enviando ? ' enviando' : '');
        const globo = document.createElement('div');
        globo.className = 'chat-burbuja';
        if (!m.de_modelo && m.autor) {
            const autor = document.createElement('div');
            autor.className = 'chat-autor';
            autor.textContent = m.autor;
            globo.appendChild(autor);
        }
        if (m.imagen) globo.appendChild(foto(m));
        if (m.adjunto) globo.appendChild(medio(m));
        if (m.texto) globo.appendChild(R.enlazar(m.texto));
        fila.appendChild(globo);
        const real = !m.enviando && String(m.id || '').indexOf('local-') !== 0;
        const fichas = R.fila(m.reacciones, MI_CLAVE, real ? (emoji) => reaccionar(m, emoji) : null);
        if (fichas) fila.appendChild(fichas);
        const meta = document.createElement('div');
        meta.className = 'chat-meta';
        meta.textContent = m.enviando ? 'Enviando…' : (m.hora || '');
        if (m.de_modelo && !m.enviando && (m.vistos || []).length) {
            const visto = document.createElement('span');
            visto.className = 'chat-visto';
            visto.textContent = ' · ✓✓ Visto por ' + m.vistos.join(', ');
            meta.appendChild(visto);
        }
        fila.appendChild(meta);
        if (real) {
            R.gestos(globo, () => ({
                mia: (m.reacciones || {})[MI_CLAVE] || '',
                alElegir: (emoji) => reaccionar(m, emoji),
                texto: m.texto || '', avisar: avisar,
            }));
        }
        return fila;
    }

    /* Pone, cambia o quita ("") su reacción. Se pinta con lo que guardó la API. */
    async function reaccionar(m, emoji) {
        const antes = m.reacciones || {};
        m.reacciones = Object.assign({}, antes);
        if (emoji) m.reacciones[MI_CLAVE] = emoji; else delete m.reacciones[MI_CLAVE];
        pintarLista(false);
        try {
            const datos = await pedir('/api/chat/reaccionar', 'POST', { id: m.id, emoji: emoji });
            m.reacciones = datos.reacciones || {};
        } catch (error) {
            m.reacciones = antes;
            avisar(error.message, 'malo');
        }
        if ((m.canal_id || 'soporte') === estado.canal) pintarLista(false);
    }

    function foto(m) {
        const local = estado.fotos[m.id] || m.fotoLocal;
        if (local) {
            const img = document.createElement('img');
            img.className = 'chat-foto';
            img.src = local;
            img.onclick = () => abrirVisor(local);
            return img;
        }
        const hueco = document.createElement('div');
        hueco.className = 'chat-foto-cargando';
        pedir('/api/chat/imagen/' + encodeURIComponent(m.id)).then((datos) => {
            const b64 = datos.imagen || '';
            if (!b64) { hueco.remove(); return; }
            estado.fotos[m.id] = b64.indexOf('data:') === 0 ? b64 : 'data:image/jpeg;base64,' + b64;
            hueco.replaceWith(foto(m));
        }).catch(() => { hueco.textContent = '🖼️'; });
        return hueco;
    }

    function medio(m) {
        return A.pintar(m, {
            ruta: '/api/chat/adjunto/' + encodeURIComponent(m.id), bajar: pedirArchivo,
            cache: estado.medios, avisar: avisar, abrirVisor: abrirVisor,
        });
    }

    function abrirVisor(src) {
        const visor = document.createElement('div');
        visor.className = 'chat-visor';
        visor.innerHTML = '<img alt="">';
        visor.querySelector('img').src = src;
        visor.onclick = () => visor.remove();
        document.body.appendChild(visor);
    }

    // ---------------------------------------------------- lo que va llegando
    async function preguntar() {
        if (!estado.activo || estado.preguntando || !estado.cursor ||
            document.visibilityState !== 'visible') return;
        estado.preguntando = true;
        try {
            const datos = await pedir('/api/chat/nuevos?desde=' + encodeURIComponent(estado.cursor));
            estado.cursor = datos.cursor || estado.cursor;
            let aqui = false;
            (datos.mensajes || []).forEach((m) => {
                const canal = m.canal_id || 'soporte';
                if (fijo && canal !== fijo) return;
                if (!agregar(m)) return;
                if (canal === estado.canal) aqui = true;
                else if (!m.de_modelo) estado.sinLeer[canal] = (estado.sinLeer[canal] || 0) + 1;
            });
            (datos.vistos || []).forEach((v) => {
                const m = (estado.porCanal[v.canal_id || 'soporte'] || []).find((x) => x.id === v.id);
                if (!m || (m.vistos || []).join('|') === (v.vistos || []).join('|')) return;
                m.vistos = v.vistos;
                if ((v.canal_id || 'soporte') === estado.canal) aqui = true;
            });
            (datos.reacciones || []).forEach((r) => {
                const m = (estado.porCanal[r.canal_id || 'soporte'] || []).find((x) => x.id === r.id);
                if (!m || R.iguales(m.reacciones, r.reacciones)) return;
                m.reacciones = r.reacciones || {};
                if ((r.canal_id || 'soporte') === estado.canal) aqui = true;
            });
            if (aqui) { const bajar = cercaDelFinal(); pintarLista(bajar); }
            pintarCanales();
            marcarVisto();
        } catch (error) {
            // Sin red un momento: se vuelve a intentar en la siguiente vuelta.
        } finally {
            estado.preguntando = false;
        }
    }

    /* Lo que ella acaba de enviar se pinta ya, sin esperar a la siguiente vuelta. */
    function confirmado(provisional, real) {
        const canal = provisional.canal_id;
        const lista_ = estado.porCanal[canal] || [];
        const i = lista_.indexOf(provisional);
        if (estado.vistos.has(real.id)) {
            if (i >= 0) lista_.splice(i, 1);             // ya llegó por la otra vía
        } else {
            estado.vistos.add(real.id);
            if (provisional.fotoLocal) estado.fotos[real.id] = provisional.fotoLocal;
            if (provisional.medioLocal) estado.medios[real.id] = provisional.medioLocal;
            if (i >= 0) lista_[i] = real; else lista_.push(real);
        }
        if (estado.canal === canal) pintarLista(true);
    }

    function provisional(datos) {
        const m = Object.assign({
            id: 'local-' + Date.now(), canal_id: estado.canal, de_modelo: true, autor: '',
            texto: '', imagen: false, ts: '', hora: '', fecha: '', enviando: true,
        }, datos);
        (estado.porCanal[m.canal_id] = estado.porCanal[m.canal_id] || []).push(m);
        if (m.canal_id === estado.canal) pintarLista(true);
        return m;
    }

    function quitarProvisional(m) {
        const lista_ = estado.porCanal[m.canal_id] || [];
        const i = lista_.indexOf(m);
        if (i >= 0) lista_.splice(i, 1);
        if (estado.canal === m.canal_id) pintarLista(false);
    }

    // ------------------------------------------------------------- enviar
    function actualizarBotones() {
        const hayAlgo = !!caja.value.trim() || !!estado.fotoPendiente;
        el('.chat-enviar').classList.toggle('oculto', !hayAlgo);
        el('.chat-mic').classList.toggle('oculto', hayAlgo);
    }

    function ajustarAltura() {
        caja.style.height = 'auto';
        caja.style.height = Math.min(caja.scrollHeight, 120) + 'px';
    }

    async function enviarTexto() {
        const texto = caja.value.trim();
        const imagen = estado.fotoPendiente;
        if (!texto && !imagen) return;
        caja.value = '';
        ajustarAltura();
        quitarPrevia();
        const m = provisional({ texto: texto, imagen: !!imagen, fotoLocal: imagen });
        try {
            const datos = await pedir('/api/chat/enviar', 'POST',
                { canal: m.canal_id, texto: texto, imagen: imagen });
            confirmado(m, datos.mensaje);
        } catch (error) {
            quitarProvisional(m);
            if (!caja.value) caja.value = texto;
            actualizarBotones();
            avisar(error.message, 'malo');
        }
    }

    function enviarArchivo(archivo, tipo, nombre, segundos) {
        const texto = caja.value.trim();
        caja.value = '';
        ajustarAltura();
        actualizarBotones();
        const urlLocal = URL.createObjectURL(archivo);
        const m = provisional({
            texto: texto, medioLocal: urlLocal,
            adjunto: { tipo: tipo, bytes: archivo.size, segundos: segundos || 0,
                       titulo: tipo === 'pdf' ? (archivo.name || '').replace(/\.pdf$/i, '') : '' },
        });
        const formulario = new FormData();
        formulario.append('canal', m.canal_id);
        formulario.append('texto', texto);
        if (segundos) formulario.append('segundos', String(segundos));
        formulario.append('archivo', archivo, nombre || archivo.name || (tipo + '.bin'));

        const previa = el('.chat-previa');
        previa.innerHTML = '<span>' + ({ audio: '🎤', pdf: '📄' }[tipo] || '🎬') + '</span>' +
            '<span>Enviando…</span><div class="chat-progreso"><div></div></div>' +
            '<button class="quitar" title="Cancelar">✕</button>';
        const barra = previa.querySelector('.chat-progreso div');
        estado.subida = subir('/api/chat/adjunto', formulario,
            (p) => { barra.style.width = Math.round(p * 100) + '%'; });
        previa.querySelector('.quitar').onclick = () => estado.subida && estado.subida.cancelar();

        estado.subida.then((datos) => {
            confirmado(m, datos.mensaje);
        }).catch((error) => {
            quitarProvisional(m);
            URL.revokeObjectURL(urlLocal);
            if (error.message !== 'cancelado') avisar(error.message, 'malo');
        }).finally(() => {
            estado.subida = null;
            previa.innerHTML = '';
        });
    }

    // ------------------------------------------------------ foto o video
    function quitarPrevia() {
        estado.fotoPendiente = '';
        if (!estado.subida) el('.chat-previa').innerHTML = '';
        actualizarBotones();
    }

    async function alElegirArchivo(archivo) {
        if (estado.subida) { avisar('Espera a que termine de enviarse el archivo anterior.', 'malo'); return; }
        const tipo = A.tipoDe(archivo);
        if (tipo === 'video' || tipo === 'pdf') {
            const motivo = A.demasiadoGrande(archivo, tipo);
            if (motivo) { avisar(motivo, 'malo'); return; }
            enviarArchivo(archivo, tipo);
            return;
        }
        if (tipo !== 'imagen') { avisar('Solo fotos, videos, notas de voz y PDF.', 'malo'); return; }
        try {
            estado.fotoPendiente = await A.comprimir(archivo, TOPE_FOTO);
        } catch (error) {
            avisar(error.message, 'malo');
            return;
        }
        const previa = el('.chat-previa');
        previa.innerHTML = '<img alt=""><span>Foto lista. Escribe algo si quieres y pulsa ➤.</span>' +
            '<button class="quitar" title="Quitar">✕</button>';
        previa.querySelector('img').src = estado.fotoPendiente;
        previa.querySelector('.quitar').onclick = quitarPrevia;
        actualizarBotones();
        caja.focus();
    }

    // ------------------------------------------------------- nota de voz
    const nota = A.notaDeVoz(raiz, {
        avisar: avisar,
        puedeEmpezar: () => estado.subida ? 'Espera a que termine de enviarse el archivo anterior.' : '',
        alTerminar: (audio, segundos) => enviarArchivo(audio, 'audio', 'nota-de-voz.wav', segundos),
    });

    // ------------------------------------------------------------ eventos
    caja.addEventListener('input', () => { ajustarAltura(); actualizarBotones(); });
    // Ctrl+V con una imagen en el portapapeles: lista para enviar, como la del 📎.
    caja.addEventListener('paste', (e) => {
        const items = Array.from((e.clipboardData && e.clipboardData.items) || []);
        const imagen = items.find((i) => i.kind === 'file' && i.type.indexOf('image/') === 0);
        const archivo = imagen && imagen.getAsFile();
        if (!archivo) return;
        e.preventDefault();
        alElegirArchivo(archivo);
    });
    caja.addEventListener('keydown', (e) => {
        // En el ordenador Enter envía y Mayús+Enter salta de línea. En el
        // teléfono el teclado no tiene Mayús: allí se envía con ➤.
        if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
            e.preventDefault();
            enviarTexto();
        }
    });
    el('.chat-enviar').onclick = enviarTexto;
    A.menu(el('.chat-clip'), alElegirArchivo);
    conectarCamara(el('.chat-foto-boton'), alElegirArchivo);
    conectarEmojis(el('.chat-emoji'), caja, () => { ajustarAltura(); actualizarBotones(); });
    document.addEventListener('visibilitychange', preguntar);

    // ------------------------------------------------------------ arranque
    async function arrancar() {
        pintarAyuda();
        if (!fijo) {
            try {
                const datos = await pedir('/api/chat/canales');
                estado.canales = datos.canales || [];
            } catch (error) {
                estado.canales = [{ id: 'soporte', nombre: 'Soporte' }];
            }
            const pedido = new URLSearchParams(window.location.search).get('canal');
            if (pedido && estado.canales.some((c) => c.id === pedido)) estado.canal = pedido;
            pintarCanales();
            pintarAyuda();
        }
        await cargarCanal(estado.canal);
    }
    let arrancado = false;

    return {
        activar() {
            estado.activo = true;
            if (!arrancado) { arrancado = true; arrancar(); }
            else pintarLista(true);
            if (!estado.reloj) estado.reloj = setInterval(preguntar, CADA_MS);
        },
        desactivar() {
            estado.activo = false;
            clearInterval(estado.reloj);
            estado.reloj = null;
            nota.cancelar();
        },
    };
}

window.ChatParadise = { montar: montar };
})();
