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
 * escritorio, con el canal marcado en cada mensaje. Por ahora todos los
 * canales los atiende el monitor; aquí solo se separan para que ella vea
 * cada conversación por su lado.
 *
 * «EN TIEMPO REAL»
 * ----------------
 * Cada 4 segundos, solo con la página a la vista, se pregunta qué llegó
 * después de la última vez (`/api/chat/nuevos`). Si no llegó nada cuesta
 * una lectura. Lo que llega a otro canal enciende su contador.
 *
 * NOTAS DE VOZ Y VIDEOS
 * ---------------------
 * La nota de voz se graba aquí y se guarda como WAV (16 kHz, mono): es el
 * formato que el escritorio del monitor reproduce DENTRO de la app con lo
 * que ya trae Windows, sin instalar nada. Por eso no se usa MediaRecorder,
 * que da webm u m4a según el teléfono. El video se elige de la
 * galería o se graba con la cámara. Los dos van a su carpeta de Drive a
 * través de la API; para oírlos o verlos se piden a la API, porque su
 * navegador no tiene permiso sobre esa carpeta.
 */

(function () {
'use strict';

const API = PARADISE.API_URL;
const CADA_MS = 4000;
const TOPE_FOTO = 650000;                       // base64; la API acepta 700 000
const TOPE_VIDEO = 100 * 1024 * 1024;           // el mismo de la API
const TOPE_AUDIO = 15 * 1024 * 1024;
const MAX_SEGUNDOS_AUDIO = 300;

function escapar(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function token() { return localStorage.getItem('token_sesion') || ''; }

function salirPorSesion() {
    localStorage.removeItem('token_sesion');
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

function pesoLegible(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1).replace('.0', '') + ' MB';
}

function duracion(segundos) {
    return Math.floor(segundos / 60) + ':' + String(segundos % 60).padStart(2, '0');
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

/* ----------------------------------------------------- fotos comprimidas */
function cargarImagen(archivo) {
    return new Promise((resolver, rechazar) => {
        const url = URL.createObjectURL(archivo);
        const imagen = new Image();
        imagen.onload = () => { URL.revokeObjectURL(url); resolver(imagen); };
        imagen.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo abrir esa foto.')); };
        imagen.src = url;
    });
}

function aJpeg(imagen, lado, calidad) {
    const escala = Math.min(1, lado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    lienzo.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    const ctx = lienzo.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/jpeg', calidad);
}

function comprimir(imagen) {
    for (let lado = 1280; lado >= 480; lado = Math.round(lado * 0.8)) {
        for (const calidad of [0.78, 0.65, 0.5]) {
            const jpeg = aJpeg(imagen, lado, calidad);
            if (jpeg.length <= TOPE_FOTO) return jpeg;
        }
    }
    throw new Error('La foto pesa demasiado aun comprimida.');
}

/* ---------------------------------------------- la nota de voz, en WAV */
const HZ_NOTA = 16000;          // voz clara y 32 KB por segundo

/* Junta los trozos del micrófono y los baja a 16 kHz (promediando). */
function aMuestras(trozos, hzOrigen) {
    const total = trozos.reduce((n, t) => n + t.length, 0);
    const todo = new Float32Array(total);
    let pos = 0;
    trozos.forEach((t) => { todo.set(t, pos); pos += t.length; });
    const paso = hzOrigen / HZ_NOTA;
    if (paso <= 1) return todo;
    const salida = new Float32Array(Math.floor(total / paso));
    for (let i = 0; i < salida.length; i++) {
        const desde = Math.floor(i * paso), hasta = Math.min(total, Math.floor((i + 1) * paso));
        let suma = 0;
        for (let k = desde; k < hasta; k++) suma += todo[k];
        salida[i] = suma / Math.max(1, hasta - desde);
    }
    return salida;
}

/* WAV PCM de 16 bits, mono: lo más sencillo que existe y Windows lo suena solo. */
function aWav(muestras) {
    const datos = new DataView(new ArrayBuffer(44 + muestras.length * 2));
    const texto = (pos, t) => { for (let i = 0; i < t.length; i++) datos.setUint8(pos + i, t.charCodeAt(i)); };
    texto(0, 'RIFF'); datos.setUint32(4, 36 + muestras.length * 2, true); texto(8, 'WAVE');
    texto(12, 'fmt '); datos.setUint32(16, 16, true); datos.setUint16(20, 1, true);
    datos.setUint16(22, 1, true); datos.setUint32(24, HZ_NOTA, true);
    datos.setUint32(28, HZ_NOTA * 2, true); datos.setUint16(32, 2, true); datos.setUint16(34, 16, true);
    texto(36, 'data'); datos.setUint32(40, muestras.length * 2, true);
    for (let i = 0; i < muestras.length; i++) {
        const v = Math.max(-1, Math.min(1, muestras[i]));
        datos.setInt16(44 + i * 2, v < 0 ? v * 0x8000 : v * 0x7FFF, true);
    }
    return new Blob([datos], { type: 'audio/wav' });
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
        grabacion: null,
        medios: {},                     // id de mensaje -> URL ya descargada
        fotos: {},                      // id de mensaje -> data URL
    };

    raiz.innerHTML =
        '<div class="chat-canales' + (fijo ? ' oculto' : '') + '"></div>' +
        '<div class="chat-ayuda"></div>' +
        '<div class="chat-lista"><div class="chat-vacio">Cargando…</div></div>' +
        '<div class="chat-pie">' +
        '  <div class="chat-previa"></div>' +
        '  <div class="chat-barra">' +
        '    <button class="chat-clip" title="Adjuntar foto o video">📎</button>' +
        '    <textarea class="chat-texto" rows="1" maxlength="2000" placeholder="Escribe un mensaje…"></textarea>' +
        '    <button class="chat-mic" title="Grabar nota de voz">🎤</button>' +
        '    <button class="chat-enviar oculto" title="Enviar">➤</button>' +
        '  </div>' +
        '  <div class="chat-grabando oculto">' +
        '    <span class="punto"></span><span class="tiempo">0:00</span>' +
        '    <span class="pista">Grabando nota de voz…</span>' +
        '    <button class="cancelar" title="Descartar">✕</button>' +
        '    <button class="enviar" title="Enviar">➤</button>' +
        '  </div>' +
        '</div>' +
        '<input type="file" class="chat-archivo oculto" accept="image/*,video/*">';

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
            : 'Mensaje privado para ' + nombre + '. Por ahora lo recibe el monitor y se lo hace llegar.';
        caja.placeholder = 'Escribe a ' + nombre + '…';
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
            if (estado.canal === id) pintarLista(true);
        } catch (error) {
            if (estado.canal === id) {
                lista.innerHTML = '<div class="chat-vacio">No se pudo abrir el chat.<br><small>' +
                    escapar(error.message) + '</small></div>';
            }
        }
    }

    function cercaDelFinal() {
        return window.innerHeight + window.scrollY >= document.body.scrollHeight - 160;
    }

    function alFinal() {
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
        if (m.texto) globo.appendChild(document.createTextNode(m.texto));
        fila.appendChild(globo);
        const meta = document.createElement('div');
        meta.className = 'chat-meta';
        meta.textContent = m.enviando ? 'Enviando…' : (m.hora || '');
        fila.appendChild(meta);
        return fila;
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
        const tipo = m.adjunto.tipo === 'audio' ? 'audio' : 'video';
        const url = estado.medios[m.id];
        if (url) return reproductor(tipo, url, false);
        const boton = document.createElement('button');
        boton.className = 'chat-medio';
        boton.innerHTML = '<span class="reproducir">▶</span><span>' +
            (tipo === 'audio' ? 'Nota de voz' : 'Video') +
            '<small>' + escapar(m.adjunto.segundos ? duracion(m.adjunto.segundos)
                                                   : pesoLegible(m.adjunto.bytes)) + '</small></span>';
        if (m.enviando) { boton.disabled = true; return boton; }
        boton.onclick = async () => {
            boton.disabled = true;
            boton.querySelector('.reproducir').textContent = '…';
            try {
                estado.medios[m.id] = await pedirArchivo('/api/chat/adjunto/' + encodeURIComponent(m.id));
                boton.replaceWith(reproductor(tipo, estado.medios[m.id], true));
            } catch (error) {
                boton.disabled = false;
                boton.querySelector('.reproducir').textContent = '▶';
                avisar(error.message, 'malo');
            }
        };
        return boton;
    }

    function reproductor(tipo, url, arrancar) {
        const elemento = document.createElement(tipo);
        elemento.controls = true;
        elemento.preload = 'metadata';
        if (tipo === 'video') elemento.playsInline = true;
        elemento.src = url;
        if (arrancar) elemento.play().catch(() => {});
        return elemento;
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
            if (aqui) { const bajar = cercaDelFinal(); pintarLista(bajar); }
            pintarCanales();
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
            texto: texto, adjunto: { tipo: tipo, bytes: archivo.size, segundos: segundos || 0 },
            medioLocal: urlLocal,
        });
        const formulario = new FormData();
        formulario.append('canal', m.canal_id);
        formulario.append('texto', texto);
        if (segundos) formulario.append('segundos', String(segundos));
        formulario.append('archivo', archivo, nombre || archivo.name || (tipo + '.bin'));

        const previa = el('.chat-previa');
        previa.innerHTML = '<span>' + (tipo === 'audio' ? '🎤' : '🎬') + '</span>' +
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

    async function alElegirArchivo(evento) {
        const archivo = evento.target.files && evento.target.files[0];
        evento.target.value = '';
        if (!archivo) return;
        if (estado.subida) { avisar('Espera a que termine de enviarse el archivo anterior.', 'malo'); return; }
        const tipo = archivo.type || '';
        if (tipo.indexOf('video/') === 0) {
            if (archivo.size > TOPE_VIDEO) {
                avisar('El video pesa ' + pesoLegible(archivo.size) + ': el máximo es 100 MB. ' +
                       'Recórtalo o grábalo más corto.', 'malo');
                return;
            }
            enviarArchivo(archivo, 'video');
            return;
        }
        if (tipo.indexOf('image/') !== 0) { avisar('Solo fotos, videos y notas de voz.', 'malo'); return; }
        try {
            estado.fotoPendiente = comprimir(await cargarImagen(archivo));
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
    async function empezarGrabacion() {
        if (estado.grabacion) return;
        if (estado.subida) { avisar('Espera a que termine de enviarse el archivo anterior.', 'malo'); return; }
        const Contexto = window.AudioContext || window.webkitAudioContext;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !Contexto) {
            avisar('Este navegador no puede grabar audio. Prueba con Chrome o Safari actualizados.', 'malo');
            return;
        }
        let flujo;
        try {
            flujo = await navigator.mediaDevices.getUserMedia(
                { audio: { echoCancellation: true, noiseSuppression: true } });
        } catch (error) {
            avisar('No hay permiso para usar el micrófono. Actívalo en los ajustes del navegador.', 'malo');
            return;
        }
        let contexto, fuente, procesador;
        try {
            contexto = new Contexto();
            if (contexto.state === 'suspended') await contexto.resume();
            fuente = contexto.createMediaStreamSource(flujo);
            // ScriptProcessor está «en desuso» pero funciona en todos los
            // teléfonos, Safari incluido, y no necesita un archivo aparte.
            procesador = contexto.createScriptProcessor(4096, 1, 1);
        } catch (error) {
            flujo.getTracks().forEach((t) => t.stop());
            avisar('No se pudo empezar a grabar.', 'malo');
            return;
        }
        const trozos = [];
        const g = { inicio: Date.now(), reloj: null, parar: null };
        estado.grabacion = g;
        procesador.onaudioprocess = (e) => trozos.push(new Float32Array(e.inputBuffer.getChannelData(0)));
        fuente.connect(procesador);
        procesador.connect(contexto.destination);      // sin esto Chrome no lo llama

        g.parar = (enviar) => {
            procesador.onaudioprocess = null;
            try { fuente.disconnect(); procesador.disconnect(); } catch (e) { /* ya estaba */ }
            flujo.getTracks().forEach((t) => t.stop());
            const hz = contexto.sampleRate;
            contexto.close().catch(() => {});
            clearInterval(g.reloj);
            estado.grabacion = null;
            el('.chat-grabando').classList.add('oculto');
            el('.chat-barra').classList.remove('oculto');
            if (!enviar || !trozos.length) return;
            const muestras = aMuestras(trozos, hz);
            if (muestras.length < HZ_NOTA / 2) { avisar('La nota de voz es demasiado corta.', 'malo'); return; }
            const audio = aWav(muestras);
            if (audio.size > TOPE_AUDIO) { avisar('La nota de voz es demasiado larga.', 'malo'); return; }
            enviarArchivo(audio, 'audio', 'nota-de-voz.wav', Math.round(muestras.length / HZ_NOTA));
        };

        el('.chat-barra').classList.add('oculto');
        el('.chat-grabando').classList.remove('oculto');
        const tiempo = el('.chat-grabando .tiempo');
        tiempo.textContent = '0:00';
        g.reloj = setInterval(() => {
            const s = Math.floor((Date.now() - g.inicio) / 1000);
            tiempo.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
            if (s >= MAX_SEGUNDOS_AUDIO) terminarGrabacion(true);
        }, 250);
    }

    function terminarGrabacion(enviar) {
        if (estado.grabacion) estado.grabacion.parar(enviar);
    }

    // ------------------------------------------------------------ eventos
    caja.addEventListener('input', () => { ajustarAltura(); actualizarBotones(); });
    caja.addEventListener('keydown', (e) => {
        // En el ordenador Enter envía y Mayús+Enter salta de línea. En el
        // teléfono el teclado no tiene Mayús: allí se envía con ➤.
        if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
            e.preventDefault();
            enviarTexto();
        }
    });
    el('.chat-enviar').onclick = enviarTexto;
    el('.chat-mic').onclick = empezarGrabacion;
    el('.chat-grabando .cancelar').onclick = () => terminarGrabacion(false);
    el('.chat-grabando .enviar').onclick = () => terminarGrabacion(true);
    el('.chat-clip').onclick = () => el('.chat-archivo').click();
    el('.chat-archivo').onchange = alElegirArchivo;
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
            terminarGrabacion(false);
        },
    };
}

window.ChatParadise = { montar: montar };
})();
