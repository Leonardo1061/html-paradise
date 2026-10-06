/* ===========================================================================
 * PARADISE · Adjuntos de los chats (lo común a js/chat.js y js/chat_personal.js)
 * ===========================================================================
 *
 * Los dos chats web adjuntan lo mismo, como WhatsApp:
 *
 *   📎 → 🖼️ Galería     fotos y videos del teléfono o del ordenador
 *        📷 Cámara      abre la cámara y toma una foto
 *        📄 Documento   un PDF
 *   🎤  Nota de voz     se graba aquí, en WAV
 *
 *     Adjuntos.menu(boton, alElegir)          alElegir(archivo, 'galeria'|'camara'|'documento')
 *     Adjuntos.notaDeVoz(raiz, opciones)      el botón 🎤 y la barra de grabación
 *     Adjuntos.pintar(m, opciones)            el archivo dentro de una burbuja
 *     Adjuntos.comprimir(archivo, tope)       foto → JPEG en base64 (chats con modelos)
 *     Adjuntos.fotoParaDrive(archivo)         foto → JPEG más liviano (chat del personal)
 *
 * LA CÁMARA
 * ---------
 * En el teléfono se usa la cámara del sistema (`capture`): mejor foto y nada
 * que instalar. En el ordenador ese atributo no hace nada, así que se abre
 * una ventanita con la cámara del navegador y un botón para disparar.
 *
 * LA NOTA DE VOZ
 * --------------
 * Se guarda como WAV (16 kHz, mono): es el formato que el escritorio del
 * monitor reproduce DENTRO de la app con lo que ya trae Windows, sin instalar
 * nada. Por eso no se usa MediaRecorder, que da webm u m4a según el teléfono.
 */

(function () {
'use strict';

const TOPE_VIDEO = 100 * 1024 * 1024;           // los mismos de la API
const TOPE_AUDIO = 15 * 1024 * 1024;
const TOPE_PDF = 25 * 1024 * 1024;
const MAX_SEGUNDOS_AUDIO = 300;
const HZ_NOTA = 16000;                          // voz clara y 32 KB por segundo

function escapar(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function pesoLegible(bytes) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1).replace('.0', '') + ' MB';
}

function duracion(segundos) {
    return Math.floor(segundos / 60) + ':' + String(segundos % 60).padStart(2, '0');
}

function esTactil() {
    return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
}

/* ¿Qué es este archivo? 'imagen' | 'video' | 'pdf' | '' */
function tipoDe(archivo) {
    const mime = (archivo.type || '').toLowerCase();
    if (mime.indexOf('image/') === 0) return 'imagen';
    if (mime.indexOf('video/') === 0) return 'video';
    if (mime === 'application/pdf' || /\.pdf$/i.test(archivo.name || '')) return 'pdf';
    return '';
}

/* Mensaje de error si pesa más de lo que acepta la API; '' si cabe. */
function demasiadoGrande(archivo, tipo) {
    if (tipo === 'video' && archivo.size > TOPE_VIDEO) {
        return 'El video pesa ' + pesoLegible(archivo.size) + ': el máximo es 100 MB. Recórtalo o grábalo más corto.';
    }
    if (tipo === 'pdf' && archivo.size > TOPE_PDF) {
        return 'El PDF pesa ' + pesoLegible(archivo.size) + ': el máximo es 25 MB.';
    }
    return '';
}

// =======================================================================
// FOTOS
// =======================================================================
function cargarImagen(archivo) {
    return new Promise((resolver, rechazar) => {
        const url = URL.createObjectURL(archivo);
        const imagen = new Image();
        imagen.onload = () => { URL.revokeObjectURL(url); resolver(imagen); };
        imagen.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo abrir esa foto.')); };
        imagen.src = url;
    });
}

function lienzo(imagen, lado) {
    const escala = Math.min(1, lado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
    c.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(imagen, 0, 0, c.width, c.height);
    return c;
}

/* La foto en base64 (data URL) de menos de `tope` caracteres: va DENTRO del
   mensaje en los chats con las modelos, como las del escritorio. */
async function comprimir(archivo, tope) {
    const imagen = await cargarImagen(archivo);
    for (let lado = 1280; lado >= 480; lado = Math.round(lado * 0.8)) {
        for (const calidad of [0.78, 0.65, 0.5]) {
            const jpeg = lienzo(imagen, lado).toDataURL('image/jpeg', calidad);
            if (jpeg.length <= tope) return jpeg;
        }
    }
    throw new Error('La foto pesa demasiado aun comprimida.');
}

/* Para Drive: hasta 1600 px, JPEG. Una foto de 5 MB del teléfono queda en
   unos 300 KB y se sigue viendo bien. Si no se puede, va la original. */
async function fotoParaDrive(archivo) {
    try {
        const c = lienzo(await cargarImagen(archivo), 1600);
        const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
        if (blob && blob.size < archivo.size) return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
    } catch (error) { /* se manda tal cual */ }
    return archivo;
}

// =======================================================================
// EL MENÚ DEL 📎
// =======================================================================
function menu(boton, alElegir) {
    const entrada = (accept, capture) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        if (capture) input.setAttribute('capture', 'environment');
        input.className = 'oculto';
        input.onchange = () => {
            const archivo = input.files && input.files[0];
            input.value = '';
            if (archivo) alElegir(archivo, input.dataset.origen);
        };
        boton.parentNode.appendChild(input);
        return input;
    };
    const entradas = {
        galeria: entrada('image/*,video/*'),
        camara: entrada('image/*', true),
        documento: entrada('application/pdf,.pdf'),
    };
    Object.keys(entradas).forEach((k) => { entradas[k].dataset.origen = k; });

    const hoja = document.createElement('div');
    hoja.className = 'chat-menu oculto';
    hoja.innerHTML =
        '<button data-op="galeria"><span class="icono galeria">🖼️</span>Galería</button>' +
        '<button data-op="camara"><span class="icono camara">📷</span>Cámara</button>' +
        '<button data-op="documento"><span class="icono documento">📄</span>Documento</button>';
    (boton.closest('.chat-pie') || boton.parentNode).appendChild(hoja);

    const cerrar = () => { hoja.classList.add('oculto'); document.removeEventListener('click', fuera, true); };
    const fuera = (e) => { if (!hoja.contains(e.target) && e.target !== boton) cerrar(); };
    boton.onclick = () => {
        if (!hoja.classList.contains('oculto')) { cerrar(); return; }
        hoja.classList.remove('oculto');
        document.addEventListener('click', fuera, true);
    };
    hoja.querySelectorAll('button').forEach((b) => {
        b.onclick = async () => {
            cerrar();
            const op = b.dataset.op;
            if (op === 'camara' && !esTactil() && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const foto = await camara();
                if (foto) alElegir(foto, 'camara');
                return;
            }
            entradas[op].click();
        };
    });
    return { cerrar: cerrar };
}

/* La cámara del navegador (ordenador). Devuelve un File JPEG o null. */
function camara() {
    return new Promise(async (resolver) => {
        let flujo;
        try {
            flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        } catch (error) {
            window.alert('No hay permiso para usar la cámara. Actívalo en los ajustes del navegador.');
            resolver(null);
            return;
        }
        const capa = document.createElement('div');
        capa.className = 'chat-camara';
        capa.innerHTML = '<video autoplay playsinline muted></video>' +
            '<div class="botones-camara"><button class="cancelar" title="Cerrar">✕</button>' +
            '<button class="disparar" title="Tomar foto"></button></div>';
        document.body.appendChild(capa);
        const video = capa.querySelector('video');
        video.srcObject = flujo;
        const terminar = (archivo) => {
            flujo.getTracks().forEach((t) => t.stop());
            capa.remove();
            resolver(archivo);
        };
        capa.querySelector('.cancelar').onclick = () => terminar(null);
        capa.querySelector('.disparar').onclick = () => {
            if (!video.videoWidth) return;
            const c = document.createElement('canvas');
            c.width = video.videoWidth;
            c.height = video.videoHeight;
            c.getContext('2d').drawImage(video, 0, 0);
            c.toBlob((blob) => terminar(blob ? new File([blob], 'camara.jpg', { type: 'image/jpeg' }) : null),
                     'image/jpeg', 0.9);
        };
    });
}

// =======================================================================
// LA NOTA DE VOZ (WAV)
// =======================================================================
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

/* Conecta el 🎤 (`.chat-mic`) con la barra `.chat-grabando` que hay en `raiz`.
   opciones: avisar(texto, 'malo'), puedeEmpezar() → '' o el motivo para no,
             alTerminar(blobWav, segundos). Devuelve { cancelar() }. */
function notaDeVoz(raiz, opciones) {
    const el = (s) => raiz.querySelector(s);
    let grabacion = null;

    async function empezar() {
        if (grabacion) return;
        const motivo = opciones.puedeEmpezar ? opciones.puedeEmpezar() : '';
        if (motivo) { opciones.avisar(motivo, 'malo'); return; }
        const Contexto = window.AudioContext || window.webkitAudioContext;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !Contexto) {
            opciones.avisar('Este navegador no puede grabar audio. Prueba con Chrome o Safari actualizados.', 'malo');
            return;
        }
        let flujo;
        try {
            flujo = await navigator.mediaDevices.getUserMedia(
                { audio: { echoCancellation: true, noiseSuppression: true } });
        } catch (error) {
            opciones.avisar('No hay permiso para usar el micrófono. Actívalo en los ajustes del navegador.', 'malo');
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
            opciones.avisar('No se pudo empezar a grabar.', 'malo');
            return;
        }
        const trozos = [];
        const g = { inicio: Date.now(), reloj: null, parar: null };
        grabacion = g;
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
            grabacion = null;
            el('.chat-grabando').classList.add('oculto');
            el('.chat-barra').classList.remove('oculto');
            if (!enviar || !trozos.length) return;
            const muestras = aMuestras(trozos, hz);
            if (muestras.length < HZ_NOTA / 2) { opciones.avisar('La nota de voz es demasiado corta.', 'malo'); return; }
            const audio = aWav(muestras);
            if (audio.size > TOPE_AUDIO) { opciones.avisar('La nota de voz es demasiado larga.', 'malo'); return; }
            opciones.alTerminar(audio, Math.round(muestras.length / HZ_NOTA));
        };

        el('.chat-barra').classList.add('oculto');
        el('.chat-grabando').classList.remove('oculto');
        const tiempo = el('.chat-grabando .tiempo');
        tiempo.textContent = '0:00';
        g.reloj = setInterval(() => {
            const s = Math.floor((Date.now() - g.inicio) / 1000);
            tiempo.textContent = duracion(s);
            if (s >= MAX_SEGUNDOS_AUDIO) terminar(true);
        }, 250);
    }

    function terminar(enviar) {
        if (grabacion) grabacion.parar(enviar);
    }

    el('.chat-mic').onclick = empezar;
    el('.chat-grabando .cancelar').onclick = () => terminar(false);
    el('.chat-grabando .enviar').onclick = () => terminar(true);
    return { cancelar: () => terminar(false) };
}

const BARRA_GRABANDO =
    '<div class="chat-grabando oculto">' +
    '  <span class="punto"></span><span class="tiempo">0:00</span>' +
    '  <span class="pista">Grabando nota de voz…</span>' +
    '  <button class="cancelar" title="Descartar">✕</button>' +
    '  <button class="enviar" title="Enviar">➤</button>' +
    '</div>';

// =======================================================================
// EL ARCHIVO DENTRO DE LA BURBUJA
// =======================================================================
/* opciones:
     ruta        '/api/…/adjunto/{id}' de donde bajarlo
     bajar(ruta) → Promise<URL de blob>   (cada chat pone su token)
     cache       {id de mensaje: URL ya bajada}
     avisar, abrirVisor(src) */
function pintar(m, opciones) {
    const a = m.adjunto || {};
    const tipo = a.tipo === 'audio' || a.tipo === 'pdf' || a.tipo === 'imagen' ? a.tipo : 'video';
    const cache = opciones.cache;
    const local = cache[m.id] || m.medioLocal;

    if (tipo === 'imagen') return foto(m, local, opciones);
    if (tipo === 'pdf') return documento(m, local, opciones);
    if (local) return reproductor(tipo, local, false);

    const boton = document.createElement('button');
    boton.className = 'chat-medio';
    boton.innerHTML = '<span class="reproducir">▶</span><span>' +
        (tipo === 'audio' ? 'Nota de voz' : 'Video') +
        '<small>' + escapar(a.segundos ? duracion(a.segundos) : pesoLegible(a.bytes)) + '</small></span>';
    if (m.enviando) { boton.disabled = true; return boton; }
    boton.onclick = async () => {
        boton.disabled = true;
        boton.querySelector('.reproducir').textContent = '…';
        try {
            cache[m.id] = await opciones.bajar(opciones.ruta);
            boton.replaceWith(reproductor(tipo, cache[m.id], true));
        } catch (error) {
            boton.disabled = false;
            boton.querySelector('.reproducir').textContent = '▶';
            opciones.avisar(error.message, 'malo');
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

/* La foto que está en Drive: se baja sola al pintarla. */
function foto(m, local, opciones) {
    if (local) {
        const img = document.createElement('img');
        img.className = 'chat-foto';
        img.src = local;
        img.onclick = () => opciones.abrirVisor(local);
        return img;
    }
    const hueco = document.createElement('div');
    hueco.className = 'chat-foto-cargando';
    if (m.enviando) return hueco;
    opciones.bajar(opciones.ruta).then((url) => {
        opciones.cache[m.id] = url;
        hueco.replaceWith(foto(m, url, opciones));
    }).catch(() => { hueco.textContent = '🖼️'; });
    return hueco;
}

/* El PDF: una tarjeta con su nombre; al tocarla se abre en otra pestaña. */
function documento(m, local, opciones) {
    const a = m.adjunto || {};
    const tarjeta = document.createElement('button');
    tarjeta.className = 'chat-pdf';
    tarjeta.innerHTML = '<span class="hoja-pdf">PDF</span><span class="datos-pdf"><b>' +
        escapar(a.titulo || 'Documento') + '</b><small>' + escapar(pesoLegible(a.bytes) || 'PDF') +
        ' · Abrir</small></span>';
    if (m.enviando) { tarjeta.disabled = true; return tarjeta; }
    tarjeta.onclick = async () => {
        if (local || opciones.cache[m.id]) { window.open(local || opciones.cache[m.id], '_blank'); return; }
        // La pestaña se abre YA (dentro del toque); si no, el teléfono la bloquea.
        const ventana = window.open('', '_blank');
        tarjeta.disabled = true;
        try {
            const url = await opciones.bajar(opciones.ruta);
            opciones.cache[m.id] = url;
            if (ventana) ventana.location.href = url; else window.location.href = url;
        } catch (error) {
            if (ventana) ventana.close();
            opciones.avisar(error.message, 'malo');
        } finally {
            tarjeta.disabled = false;
        }
    };
    return tarjeta;
}

/* Lo que se ve en una lista de chats en lugar del archivo. */
function resumen(adjunto) {
    if (!adjunto) return '';
    return { audio: '🎤 Nota de voz', video: '🎬 Video', pdf: '📄 ' + (adjunto.titulo || 'Documento'),
             imagen: '🖼️ Foto' }[adjunto.tipo] || '🎬 Video';
}

window.Adjuntos = {
    menu: menu, camara: camara, notaDeVoz: notaDeVoz, BARRA_GRABANDO: BARRA_GRABANDO,
    pintar: pintar, resumen: resumen, comprimir: comprimir, fotoParaDrive: fotoParaDrive,
    tipoDe: tipoDe, demasiadoGrande: demasiadoGrande, pesoLegible: pesoLegible, duracion: duracion,
};
})();
