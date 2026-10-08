/* ===========================================================================
 * PARADISE · Lo común de la web del personal administrativo
 * ===========================================================================
 *
 * Cada página personal_*.html hace:
 *
 *     <script src="js/config.js"></script>
 *     <script src="js/personal.js"></script>
 *     Personal.iniciar('chat').then((yo) => { ...la página... });
 *
 * y esto pone la barra de arriba (nombre, roles, 🔔 campana de tareas y
 * salir), la barra de abajo (solo con los módulos que su rol y su jornada le
 * permiten) y la hoja de tareas.
 *
 * LA SESIÓN
 * ---------
 * `token_personal`, aparte del `token_sesion` de las modelos: en un mismo
 * teléfono pueden convivir las dos sin pisarse. Quién es y qué puede hacer
 * lo decide la API en cada petición; lo que se guarda aquí es solo para
 * pintar la barra sin esperar.
 *
 * LA CAMPANA
 * ----------
 * Cada 30 s, solo con la página a la vista, se pregunta por las tareas
 * abiertas. Si hay alguna nueva suena un pitido corto y se enciende el globo.
 * Solo CEO y Gerencia ven «Asignar»: la API lo vuelve a comprobar.
 *
 * Los TICKET CEO de las modelos llegan aquí como una tarea más (al CEO), con
 * «🎫 Ticket de …», sus videos y PDF, y «💬 Responder» en lugar de «Hecha».
 * El aviso del teléfono abre la campana con personal_panel.html?tareas=1.
 *
 * LA CONVERSACIÓN DE CADA TAREA  (api/tareas_conversacion.py)
 * -----------------------------------------------------------
 * «💬 Conversación» abre, encima de la campana, los mensajes entre quien
 * recibió la tarea y quien la asignó: texto y un archivo por mensaje (foto,
 * video, PDF, Excel…), que van a Drive. Se leen de 20 en 20 («Ver
 * anteriores») y, con la conversación abierta, cada 8 s se piden los nuevos.
 * Quien la asignó tiene «🔒 Cerrar tarea»: cerrada ya no se retoma y queda
 * en solo lectura. Lo que le contestan a quien asigna llega en `respuestas`
 * de /tareas y también enciende el globo de la campana. El aviso del
 * teléfono abre la conversación con ?tareas=1&tarea=ID.
 *
 * ORDEN Y FILTRO  (Leonardo, 2026-10-08)
 * --------------------------------------
 * En «Para mí» y en «Enviadas»: arriba las pendientes, luego las en curso y
 * al fondo las hechas y las cerradas (la API ya las manda en ese orden). Un
 * filtro encima: Todas · Pendientes · En curso · Hechas · Cerradas. Las
 * cerradas de «Para mí» no vienen en la campana: se piden aparte
 * (/tareas/historial) solo al verlas, de 20 en 20 con «Mostrar más».
 */

(function () {
'use strict';

const API = PARADISE.API_URL;
const CLAVE_TOKEN = 'token_personal';
const CLAVE_FICHA = 'ficha_personal';
const CADA_MS_TAREAS = 30000;
const TOPE_IMAGEN = 880000;          // base64; la API acepta 900 000
const MAX_IMAGENES = 6;
const FILTROS_TAREA = [
    { id: '', texto: 'Todas' },
    { id: 'pendientes', texto: 'Pendientes', estados: ['pendiente'] },
    { id: 'en_curso', texto: 'En curso', estados: ['en curso'] },
    { id: 'hechas', texto: 'Hechas', estados: ['hecha'] },
    { id: 'cerradas', texto: 'Cerradas', estados: ['cerrada', 'cancelada'] },
];

const MODULOS = [
    { id: 'inicio', texto: 'INICIO', simbolo: '▦', pagina: 'personal_panel.html' },
    { id: 'chat', texto: 'CHAT', simbolo: '💬', pagina: 'personal_chat.html' },
    { id: 'fotografia', texto: 'FOTOGRAFÍA', simbolo: '📷', pagina: 'personal_fotografia.html' },
    { id: 'status', texto: 'STATUS ROOM', simbolo: '📋', pagina: 'personal_status.html' },
    // Solo el CEO: la API se lo añade a sus módulos (personal.es_ceo).
    { id: 'tickets', texto: 'MIS TICKETS', simbolo: '🎫', pagina: 'personal_tickets.html' },
];

function escapar(texto) {
    return String(texto == null ? '' : texto)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function token() { return localStorage.getItem(CLAVE_TOKEN) || ''; }

function aLogin() { window.location.href = PARADISE.URL_LOGIN + 'personal.html'; }

function salirPorSesion() {
    localStorage.removeItem(CLAVE_TOKEN);
    setTimeout(aLogin, 1500);
}

async function pedir(ruta, metodo, cuerpo) {
    const respuesta = await fetch(API + ruta, {
        method: metodo || 'GET',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token() },
        cache: 'no-store',
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    let datos = {};
    try { datos = await respuesta.json(); } catch (e) { datos = {}; }
    if (respuesta.status === 401) {
        salirPorSesion();
        throw new Error(datos.detail || 'Tu sesión caducó. Entra otra vez.');
    }
    if (!respuesta.ok) {
        const error = new Error(datos.detail || 'No se pudo completar la acción.');
        error.codigo = respuesta.status;
        throw error;
    }
    return datos;
}

/* Para subir archivos (multipart): sin Content-Type, lo pone el navegador. */
async function pedirFormulario(ruta, formulario) {
    const respuesta = await fetch(API + ruta, {
        method: 'POST', headers: { 'Authorization': 'Bearer ' + token() }, body: formulario,
    });
    let datos = {};
    try { datos = await respuesta.json(); } catch (e) { datos = {}; }
    if (respuesta.status === 401) {
        salirPorSesion();
        throw new Error(datos.detail || 'Tu sesión caducó. Entra otra vez.');
    }
    if (!respuesta.ok) throw new Error(datos.detail || 'No se pudo enviar.');
    return datos;
}

async function pedirArchivo(ruta) {
    const respuesta = await fetch(API + ruta, { headers: { 'Authorization': 'Bearer ' + token() } });
    if (!respuesta.ok) throw new Error('No se pudo abrir el archivo.');
    return URL.createObjectURL(await respuesta.blob());
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

function abrirVisor(src) {
    const visor = document.createElement('div');
    visor.className = 'visor';
    visor.innerHTML = '<img alt="">';
    visor.querySelector('img').src = src;
    visor.onclick = () => visor.remove();
    document.body.appendChild(visor);
}

function aDataUrl(b64) {
    return String(b64 || '').indexOf('data:') === 0 ? b64 : 'data:image/jpeg;base64,' + b64;
}

/* ---------------------------------------------------- fotos comprimidas */
function cargarImagen(archivo) {
    return new Promise((resolver, rechazar) => {
        const url = URL.createObjectURL(archivo);
        const imagen = new Image();
        imagen.onload = () => { URL.revokeObjectURL(url); resolver(imagen); };
        imagen.onerror = () => { URL.revokeObjectURL(url); rechazar(new Error('No se pudo abrir esa imagen.')); };
        imagen.src = url;
    });
}

async function comprimir(archivo, tope) {
    const imagen = await cargarImagen(archivo);
    for (let lado = 1600; lado >= 480; lado = Math.round(lado * 0.8)) {
        for (const calidad of [0.85, 0.72, 0.6, 0.5]) {
            const escala = Math.min(1, lado / Math.max(imagen.naturalWidth, imagen.naturalHeight));
            const lienzo = document.createElement('canvas');
            lienzo.width = Math.max(1, Math.round(imagen.naturalWidth * escala));
            lienzo.height = Math.max(1, Math.round(imagen.naturalHeight * escala));
            const ctx = lienzo.getContext('2d');
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, lienzo.width, lienzo.height);
            ctx.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
            const jpeg = lienzo.toDataURL('image/jpeg', calidad);
            if (jpeg.length <= (tope || TOPE_IMAGEN)) return jpeg;
        }
    }
    throw new Error('La imagen pesa demasiado aun comprimida.');
}

/* ------------------------------------------------------------- pitido */
function pitar() {
    try {
        const Contexto = window.AudioContext || window.webkitAudioContext;
        const ctx = new Contexto();
        const osc = ctx.createOscillator();
        const vol = ctx.createGain();
        osc.frequency.value = 1400;
        vol.gain.value = 0.08;
        osc.connect(vol); vol.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.25);
        osc.onended = () => ctx.close();
    } catch (e) { /* sin audio: el globo basta */ }
}

// =======================================================================
// LA CAMPANA DE TAREAS
// =======================================================================
const campana = {
    tareas: [],
    respuestas: [],                  // las que asignó y le contestaron sin que lo haya visto
    conocidas: null,                 // ids ya vistos (para pitar solo por las nuevas)
    reloj: null,
    abierta: null,                   // la hoja, si está abierta
};

function pintarGlobo() {
    const globo = document.getElementById('globo-tareas');
    if (!globo) return;
    const n = campana.tareas.filter((t) => !t.leida).length + campana.respuestas.length;
    globo.textContent = n > 99 ? '99+' : String(n);
    globo.classList.toggle('oculto', !n);
    document.dispatchEvent(new CustomEvent('personal:tareas', { detail: campana.tareas }));
}

async function revisarTareas(forzar) {
    if (forzar !== true && document.visibilityState !== 'visible') return;
    try {
        const datos = await pedir('/api/personal/tareas');
        campana.tareas = datos.tareas || [];
        campana.respuestas = datos.respuestas || [];
        // «Nueva» es una tarea que no estaba o que tiene un mensaje o un
        // estado distinto desde la última vuelta.
        const clave = (t) => t.id + '·' + (t.num_respuestas || 0) + '·' + t.estado;
        const pendientes = campana.tareas.filter((t) => !t.leida).concat(campana.respuestas);
        const ids = new Set(campana.tareas.concat(campana.respuestas).map(clave));
        if (campana.conocidas) {
            const nuevas = pendientes.filter((t) => !campana.conocidas.has(clave(t)));
            if (nuevas.length) {
                pitar();
                const t = nuevas[0];
                avisar(t.num_respuestas && t.ultima_de && t.ultima_de !== ficha().monitor
                    ? '💬 ' + t.ultima_de + ': ' + t.titulo : '🔔 Tarea nueva: ' + t.titulo);
            }
        }
        campana.conocidas = ids;
        pintarGlobo();
        // No se repinta mientras se escribe la respuesta a un ticket: se perdería.
        if (campana.abierta && campana.abierta.pestana === 'recibidas' &&
            !document.querySelector('.respuesta-ticket')) campana.abierta.pintar();
    } catch (error) { /* sin red un momento: se intenta en la siguiente vuelta */ }
}

function claseEstado(estado) {
    return estado === 'hecha' || estado === 'cerrada' ? 'bien' : estado === 'en curso' ? 'cian' : '';
}

function tarjetaTarea(t, recibida, alCambiar) {
    const caja = document.createElement('div');
    const porVer = recibida ? !t.leida : t.leida_creador === false;
    caja.className = 'tarea' + (porVer ? ' nueva' : '');
    const prioridad = t.prioridad === 'Urgente' ? 'urgente' : t.prioridad === 'Alta' ? 'alta' : '';
    caja.innerHTML =
        '<div class="cabeza"><div class="t">' + escapar(t.titulo) + '</div>' +
        (t.prioridad !== 'Normal' ? '<span class="pildora ' + prioridad + '">' + escapar(t.prioridad) + '</span>' : '') +
        '<span class="pildora ' + claseEstado(t.estado) + '">' + escapar(t.estado) + '</span></div>' +
        '<div class="meta">' + (t.ticket ? '🎫 Ticket de ' + escapar(t.modelo || t.creada_por || '¿?') :
            recibida ? 'De ' + escapar(t.creada_por || '¿?') : 'Para ' + escapar(t.asignada_a || '¿?')) +
        (t.creada ? ' · ' + escapar(t.creada) : '') + '</div>' +
        (t.descripcion ? '<div class="desc">' + escapar(t.descripcion) + '</div>' : '') +
        '<div class="miniaturas"></div><div class="botones"></div>';
    const botones = caja.querySelector('.botones');
    const boton = (texto, alPulsar) => {
        const b = document.createElement('button');
        b.className = 'boton-secundario';
        b.textContent = texto;
        b.onclick = async () => {
            b.disabled = true;
            try { await alPulsar(); } catch (error) { avisar(error.message, 'malo'); b.disabled = false; }
        };
        botones.appendChild(b);
    };
    const cambiar = async (estado) => {
        const r = await pedir('/api/personal/tareas/' + encodeURIComponent(t.id) + '/estado', 'POST', { estado: estado });
        avisar(r.mensaje, 'bueno');
        alCambiar();
    };
    if (t.num_imagenes) {
        boton('🖼️ Ver ' + t.num_imagenes + (t.num_imagenes === 1 ? ' imagen' : ' imágenes'), async () => {
            const datos = await pedir('/api/personal/tareas/' + encodeURIComponent(t.id) + '/imagenes');
            const mini = caja.querySelector('.miniaturas');
            mini.innerHTML = '';
            (datos.imagenes || []).forEach((b64) => {
                const img = document.createElement('img');
                img.src = aDataUrl(b64);
                img.onclick = () => abrirVisor(img.src);
                mini.appendChild(img);
            });
        });
    }
    (t.adjuntos || []).forEach((a, i) => {
        boton(a.tipo === 'pdf' ? '📄 ' + (a.titulo || 'Documento') : '🎬 Video', async () => {
            // La ventana se abre en el toque; si no, el navegador la bloquea.
            const ventana = window.open('', '_blank');
            try {
                const url = await pedirArchivo('/api/personal/tareas/' + encodeURIComponent(t.id) + '/adjunto/' + i);
                if (ventana) ventana.location.href = url; else window.location.href = url;
            } catch (error) { if (ventana) ventana.close(); throw error; }
            botones.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        });
    });
    if (t.ticket && t.respuesta) {
        const r = document.createElement('div');
        r.className = 'desc';
        r.textContent = '💬 ' + (t.respondida_por || '') + ': ' + t.respuesta;
        caja.insertBefore(r, caja.querySelector('.miniaturas'));
    }
    if (!t.ticket && t.num_respuestas && t.ultima_de) {
        const r = document.createElement('div');
        r.className = 'desc ultima-respuesta';
        r.textContent = '💬 ' + t.ultima_de + ': ' + (t.ultima_texto || '');
        caja.insertBefore(r, caja.querySelector('.miniaturas'));
    }
    if (!t.ticket && t.estado === 'cerrada') {
        const r = document.createElement('div');
        r.className = 'meta';
        r.textContent = '🔒 Cerrada por ' + (t.cerrada_por || '¿?') + (t.cerrada ? ' · ' + t.cerrada : '');
        caja.insertBefore(r, caja.querySelector('.miniaturas'));
    }
    if (!t.ticket) {
        const b = document.createElement('button');
        b.className = 'boton-principal boton-conversacion';
        b.textContent = '💬 Conversación' + (t.num_respuestas ? ' (' + t.num_respuestas + ')' : '');
        b.onclick = () => abrirConversacion(t, alCambiar);
        botones.appendChild(b);
    }
    if (recibida && t.abierta) {
        if (t.estado !== 'en curso') boton('▶ En curso', () => cambiar('en curso'));
        if (t.ticket) boton('💬 Responder', async () => responderTicket(caja, t, alCambiar));
        else if (t.estado !== 'hecha') boton('✓ Hecha', () => cambiar('hecha'));
    }
    if (!recibida && t.abierta) boton('✕ Cancelar', () => cambiar('cancelada'));
    return caja;
}

/* Debajo del ticket: la respuesta, que cierra el ticket y le avisa a la modelo. */
function responderTicket(caja, t, alCambiar) {
    if (caja.querySelector('.respuesta-ticket')) return;
    const zona = document.createElement('div');
    zona.className = 'respuesta-ticket campo';
    zona.style.marginTop = '10px';
    zona.innerHTML = '<label>Respuesta para ' + escapar(t.modelo || 'la modelo') + '</label>' +
        '<textarea maxlength="4000" placeholder="Le llega en su campana y en el teléfono"></textarea>' +
        '<button class="boton-principal" style="margin-top:8px">Enviar respuesta</button>';
    caja.appendChild(zona);
    const texto = zona.querySelector('textarea');
    const enviar = zona.querySelector('button');
    texto.focus();
    enviar.onclick = async () => {
        if (!texto.value.trim()) { avisar('Escribe la respuesta.', 'malo'); return; }
        enviar.disabled = true;
        try {
            const r = await pedir('/api/personal/tareas/' + encodeURIComponent(t.id) + '/responder', 'POST',
                                  { respuesta: texto.value });
            avisar(r.mensaje, 'bueno');
            alCambiar();
        } catch (error) {
            avisar(error.message, 'malo');
            enviar.disabled = false;
        }
    };
    caja.querySelectorAll('.botones button').forEach((b) => { b.disabled = false; });
}

// =======================================================================
// LA CONVERSACIÓN DE UNA TAREA
// =======================================================================
const CADA_MS_CONVERSACION = 8000;
const ACEPTA_ARCHIVOS = 'image/*,video/*,.pdf,.xlsx,.xls,.xlsm,.csv,.doc,.docx,.txt,.ppt,.pptx,.zip';

function pesoLegible(bytes) {
    const n = Number(bytes || 0);
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
}

function abrirConversacion(t, alSalir) {
    const ruta = '/api/personal/tareas/' + encodeURIComponent(t.id) + '/conversacion';
    const capa = document.createElement('div');
    capa.className = 'capa-conversacion';
    capa.innerHTML =
        '<div class="velo"></div><div class="hoja conversacion-tarea">' +
        '  <div class="hoja-cabecera"><button class="cerrar volver" title="Volver">←</button>' +
        '    <div style="flex:1"><h3></h3><div class="sub"></div></div>' +
        '    <button class="cerrar salir" title="Cerrar">✕</button></div>' +
        '  <div class="hoja-cuerpo mensajes-tarea">' +
        '    <div class="cargando"><span class="girando">◌</span></div></div>' +
        '  <div class="pie-conversacion"></div>' +
        '</div>';
    capa.querySelector('h3').textContent = t.titulo || 'Tarea';
    document.getElementById('capas-personal').appendChild(capa);
    const lista = capa.querySelector('.mensajes-tarea');
    const pie = capa.querySelector('.pie-conversacion');
    const estado = { mensajes: [], hayMas: false, reloj: null, vivo: true, info: null };

    const salir = () => {
        estado.vivo = false;
        clearInterval(estado.reloj);
        capa.remove();
        if (alSalir) alSalir();
        revisarTareas(true);
    };
    capa.querySelector('.velo').onclick = salir;
    capa.querySelector('.volver').onclick = salir;
    capa.querySelector('.salir').onclick = () => {
        salir();
        document.getElementById('capas-personal').innerHTML = '';
        campana.abierta = null;
    };

    function burbuja(m) {
        const b = document.createElement('div');
        b.className = 'burbuja-tarea' + (m.mio ? ' mia' : '');
        b.innerHTML = '<div class="autor">' + escapar(m.mio ? 'Tú' : m.de) + ' · ' + escapar(m.cuando) + '</div>' +
            (m.texto ? '<div class="texto"></div>' : '') + '<div class="archivo"></div>';
        if (m.texto) b.querySelector('.texto').textContent = m.texto;
        const a = m.adjunto;
        if (!a) return b;
        const zona = b.querySelector('.archivo');
        const rutaArchivo = ruta + '/' + encodeURIComponent(m.id) + '/adjunto';
        if (a.tipo === 'imagen') {
            const img = document.createElement('img');
            img.alt = a.titulo || 'Foto';
            zona.appendChild(img);
            pedirArchivo(rutaArchivo).then((url) => {
                img.src = url;
                img.onclick = () => abrirVisor(url);
            }).catch(() => { zona.textContent = '🖼️ La foto no se pudo cargar.'; });
            return b;
        }
        const boton = document.createElement('button');
        boton.className = 'boton-secundario';
        const icono = a.tipo === 'video' ? '🎬 ' : a.tipo === 'pdf' ? '📄 ' : '📎 ';
        boton.textContent = icono + (a.titulo || a.nombre || 'Archivo') + ' · ' + pesoLegible(a.bytes);
        boton.onclick = async () => {
            // Video y PDF en otra pestaña (que se abre en el toque, o el navegador
            // la bloquea); Excel y demás se descargan con su nombre.
            const ventana = a.tipo === 'archivo' ? null : window.open('', '_blank');
            boton.disabled = true;
            try {
                const url = await pedirArchivo(rutaArchivo);
                if (ventana) ventana.location.href = url;
                else {
                    const enlace = document.createElement('a');
                    enlace.href = url;
                    enlace.download = a.titulo || a.nombre || 'archivo';
                    document.body.appendChild(enlace);
                    enlace.click();
                    enlace.remove();
                }
            } catch (error) {
                if (ventana) ventana.close();
                avisar(error.message, 'malo');
            }
            boton.disabled = false;
        };
        zona.appendChild(boton);
        return b;
    }

    function pintar(alFinal) {
        const info = estado.info;
        lista.innerHTML = '';
        if (estado.hayMas) {
            const mas = document.createElement('button');
            mas.className = 'boton-secundario ver-anteriores';
            mas.textContent = '⬆ Ver anteriores';
            mas.onclick = anteriores;
            lista.appendChild(mas);
        } else {
            // El principio de la conversación: la tarea tal como se asignó.
            const cabeza = document.createElement('div');
            cabeza.className = 'tarea';
            cabeza.innerHTML = '<div class="meta"></div>' + (info.tarea.descripcion ? '<div class="desc"></div>' : '');
            cabeza.querySelector('.meta').textContent = (info.tarea.creada_por || '') + ' → ' +
                (info.tarea.asignada_a || '') + (info.tarea.creada ? ' · ' + info.tarea.creada : '');
            if (info.tarea.descripcion) cabeza.querySelector('.desc').textContent = info.tarea.descripcion;
            lista.appendChild(cabeza);
        }
        if (!estado.mensajes.length) {
            const vacio = document.createElement('div');
            vacio.className = 'vacio';
            vacio.textContent = info.puede_escribir ? 'Todavía no hay mensajes. Escribe el primero.' : 'Sin mensajes.';
            lista.appendChild(vacio);
        }
        estado.mensajes.forEach((m) => lista.appendChild(burbuja(m)));
        if (!info.puede_escribir) {
            const fin = document.createElement('div');
            fin.className = 'fin-conversacion';
            fin.textContent = '🔒 Tarea cerrada' + (info.tarea.cerrada_por ? ' por ' + info.tarea.cerrada_por : '') +
                (info.tarea.cerrada ? ' · ' + info.tarea.cerrada : '') + '. Ya no se puede retomar.';
            lista.appendChild(fin);
        }
        if (alFinal) lista.scrollTop = lista.scrollHeight;
    }

    function pintarPie() {
        const info = estado.info;
        capa.querySelector('h3').textContent = info.tarea.titulo || t.titulo || 'Tarea';
        capa.querySelector('.sub').textContent = 'Con ' + (info.con || '¿?') + ' · ' + info.tarea.estado;
        if (!info.puede_escribir) { pie.innerHTML = ''; return; }
        if (pie.querySelector('textarea')) {
            pie.querySelector('.cerrar-tarea').classList.toggle('oculto', !info.puede_cerrar);
            return;
        }
        pie.innerHTML =
            '<div class="archivo-elegido oculto"></div>' +
            '<div class="fila-escribir">' +
            '  <button class="boton-secundario adjuntar" title="Adjuntar foto, video, PDF o Excel">📎</button>' +
            '  <textarea maxlength="4000" rows="2" placeholder="Escribe tu respuesta"></textarea>' +
            '  <button class="boton-principal enviar">Enviar</button>' +
            '</div>' +
            '<input type="file" class="oculto" accept="' + ACEPTA_ARCHIVOS + '">' +
            '<button class="boton-secundario cerrar-tarea' + (info.puede_cerrar ? '' : ' oculto') + '">🔒 Cerrar tarea</button>';
        const entrada = pie.querySelector('input[type=file]');
        const elegido = pie.querySelector('.archivo-elegido');
        const texto = pie.querySelector('textarea');
        const enviar = pie.querySelector('.enviar');
        let archivo = null;
        const pintarArchivo = () => {
            elegido.classList.toggle('oculto', !archivo);
            elegido.innerHTML = archivo ? '📎 ' + escapar(archivo.name) + ' · ' + pesoLegible(archivo.size) +
                ' <button class="cerrar" title="Quitar">✕</button>' : '';
            if (archivo) elegido.querySelector('button').onclick = () => { archivo = null; pintarArchivo(); };
        };
        pie.querySelector('.adjuntar').onclick = () => entrada.click();
        entrada.onchange = () => { archivo = entrada.files[0] || null; entrada.value = ''; pintarArchivo(); };
        enviar.onclick = async () => {
            if (!texto.value.trim() && !archivo) { avisar('Escribe un mensaje o adjunta un archivo.', 'malo'); return; }
            enviar.disabled = true;
            enviar.textContent = archivo ? 'Subiendo…' : 'Enviando…';
            try {
                const formulario = new FormData();
                formulario.append('texto', texto.value);
                if (archivo) formulario.append('archivo', archivo, archivo.name);
                const r = await pedirFormulario(ruta, formulario);
                texto.value = '';
                archivo = null;
                pintarArchivo();
                if (!estado.mensajes.some((m) => m.id === r.mensaje.id)) estado.mensajes.push(r.mensaje);
                pintar(true);
            } catch (error) { avisar(error.message, 'malo'); }
            enviar.disabled = false;
            enviar.textContent = 'Enviar';
        };
        pie.querySelector('.cerrar-tarea').onclick = async (e) => {
            if (!confirm('¿Cerrar la tarea? Ya no se podrá retomar ni escribir en ella.')) return;
            e.target.disabled = true;
            try {
                const r = await pedir('/api/personal/tareas/' + encodeURIComponent(t.id) + '/cerrar', 'POST');
                avisar(r.mensaje, 'bueno');
                await cargar(true);
            } catch (error) { avisar(error.message, 'malo'); e.target.disabled = false; }
        };
    }

    /* Los 20 últimos. Lo de «Ver anteriores» que ya estaba se conserva. */
    async function cargar(forzar) {
        const datos = await pedir(ruta);
        if (!estado.vivo) return;
        const primero = datos.mensajes.length ? datos.mensajes[0].ts : '';
        const antiguos = primero ? estado.mensajes.filter((m) => m.ts && m.ts < primero) : [];
        const antes = estado.mensajes.map((m) => m.id).join(',');
        const mensajes = antiguos.concat(datos.mensajes);
        const cambio = forzar === true || !estado.info || antes !== mensajes.map((m) => m.id).join(',') ||
            datos.puede_escribir !== estado.info.puede_escribir;
        const abajo = !estado.info || lista.scrollHeight - lista.scrollTop - lista.clientHeight < 80;
        estado.mensajes = mensajes;
        if (!antiguos.length) estado.hayMas = datos.hay_mas;
        estado.info = datos;
        pintarPie();
        if (cambio) pintar(abajo);
    }

    async function anteriores() {
        const primero = estado.mensajes[0];
        if (!primero) return;
        try {
            const datos = await pedir(ruta + '?antes=' + encodeURIComponent(primero.ts));
            const alto = lista.scrollHeight;
            estado.mensajes = datos.mensajes.concat(estado.mensajes);
            estado.hayMas = datos.hay_mas;
            pintar(false);
            lista.scrollTop = lista.scrollHeight - alto;
        } catch (error) { avisar(error.message, 'malo'); }
    }

    cargar().catch((error) => {
        lista.innerHTML = '<div class="vacio"></div>';
        lista.firstChild.textContent = error.message;
    });
    estado.reloj = setInterval(() => {
        if (document.visibilityState === 'visible' && estado.info && estado.info.puede_escribir) {
            cargar().catch(() => {});
        }
    }, CADA_MS_CONVERSACION);
}

function abrirCampana() {
    const yo = ficha();
    const capas = document.getElementById('capas-personal');
    capas.innerHTML =
        '<div class="velo"></div><div class="hoja">' +
        '  <div class="hoja-cabecera"><h3>🔔 Tareas</h3><button class="cerrar" title="Cerrar">✕</button></div>' +
        '  <div class="hoja-cuerpo">' +
        '    <div class="pestanas">' +
        '      <button class="pestana" data-p="recibidas">Para mí</button>' +
        (yo.puede_asignar ? '<button class="pestana" data-p="enviadas">Enviadas</button>' +
                            '<button class="pestana" data-p="nueva">＋ Asignar</button>' : '') +
        '    </div><div class="cuerpo-pestana"></div>' +
        '  </div></div>';
    const cuerpo = capas.querySelector('.cuerpo-pestana');
    const cerrar = () => { capas.innerHTML = ''; campana.abierta = null; };
    capas.querySelector('.velo').onclick = cerrar;
    capas.querySelector('.cerrar').onclick = cerrar;

    const hoja = {
        pestana: 'recibidas',
        filtro: '',
        historial: null,             // {filtro, tareas, hay_mas}: las cerradas de «Para mí»
        pintar() {
            capas.querySelectorAll('.pestana').forEach((b) => b.classList.toggle('activa', b.dataset.p === hoja.pestana));
            if (hoja.pestana === 'recibidas') pintarRecibidas();
            else if (hoja.pestana === 'enviadas') pintarEnviadas();
            else pintarNueva();
        },
    };
    campana.abierta = hoja;
    capas.querySelectorAll('.pestana').forEach((b) => { b.onclick = () => { hoja.pestana = b.dataset.p; hoja.pintar(); }; });

    /* La fila de filtros, encima de la lista. Cambiar de filtro repinta. */
    function barraFiltros() {
        const barra = document.createElement('div');
        barra.className = 'filtros-tareas';
        FILTROS_TAREA.forEach((f) => {
            const b = document.createElement('button');
            b.className = 'filtro-tarea' + (f.id === hoja.filtro ? ' activo' : '');
            b.textContent = f.texto;
            b.onclick = () => { hoja.filtro = f.id; hoja.pintar(); };
            barra.appendChild(b);
        });
        cuerpo.appendChild(barra);
    }

    function pasaFiltro(t) {
        const f = FILTROS_TAREA.find((x) => x.id === hoja.filtro);
        return !f || !f.estados || f.estados.indexOf(t.estado) >= 0;
    }

    function botonMas(alPulsar) {
        const b = document.createElement('button');
        b.className = 'boton-secundario mostrar-mas';
        b.textContent = 'Mostrar más';
        b.onclick = async () => { b.disabled = true; b.textContent = 'Cargando…'; await alPulsar(); };
        return b;
    }

    /* Las cerradas de «Para mí» (solo con Todas, Hechas o Cerradas). */
    async function cargarHistorial(desde) {
        const filtro = hoja.filtro;
        try {
            const datos = await pedir('/api/personal/tareas/historial?filtro=' + encodeURIComponent(filtro) +
                                      '&desde=' + desde);
            if (filtro !== hoja.filtro) return;
            const previas = desde && hoja.historial ? hoja.historial.tareas : [];
            hoja.historial = { filtro: filtro, tareas: previas.concat(datos.tareas || []), hay_mas: datos.hay_mas };
        } catch (error) {
            hoja.historial = { filtro: filtro, tareas: [], hay_mas: false, error: error.message };
        }
        if (hoja.pestana === 'recibidas') pintarRecibidas();
    }

    function pintarRecibidas() {
        cuerpo.innerHTML = '';
        barraFiltros();
        if (!hoja.filtro && campana.respuestas.length) {
            const titulo = document.createElement('div');
            titulo.className = 'titulo-seccion';
            titulo.textContent = '💬 Te respondieron en tareas que asignaste';
            cuerpo.appendChild(titulo);
            campana.respuestas.forEach((t) => cuerpo.appendChild(tarjetaTarea(t, false, () => revisarTareas(true))));
        }
        const abiertas = campana.tareas.filter(pasaFiltro);
        abiertas.forEach((t) => cuerpo.appendChild(tarjetaTarea(t, true, () => revisarTareas(true))));
        // Al fondo, las ya cerradas (no vienen en la campana: se piden aparte).
        const conHistorial = ['', 'hechas', 'cerradas'].indexOf(hoja.filtro) >= 0;
        const historial = hoja.historial && hoja.historial.filtro === hoja.filtro ? hoja.historial : null;
        if (conHistorial && !historial) {
            cuerpo.insertAdjacentHTML('beforeend', '<div class="cargando"><span class="girando">◌</span></div>');
            cargarHistorial(0);
        } else if (historial) {
            historial.tareas.forEach((t) => cuerpo.appendChild(tarjetaTarea(t, true, () => revisarTareas(true))));
            if (historial.hay_mas) cuerpo.appendChild(botonMas(() => cargarHistorial(historial.tareas.length)));
        }
        if (!abiertas.length && (!conHistorial || (historial && !historial.tareas.length))) {
            cuerpo.insertAdjacentHTML('beforeend', '<div class="vacio">' + (historial && historial.error ?
                escapar(historial.error) : hoja.filtro ? 'No hay tareas con ese filtro.' :
                'No tienes tareas pendientes. 🎉') + '</div>');
        }
        // Al abrir la campana se dan por leídas (como el escritorio).
        const sinLeer = campana.tareas.filter((t) => !t.leida).map((t) => t.id);
        if (sinLeer.length) {
            pedir('/api/personal/tareas/leidas', 'POST', { ids: sinLeer }).then(() => {
                campana.tareas.forEach((t) => { if (sinLeer.indexOf(t.id) >= 0) t.leida = true; });
                pintarGlobo();
            }).catch(() => {});
        }
    }

    /* Todas las que asignó, ya ordenadas y filtradas por la API, de 20 en 20. */
    async function pintarEnviadas() {
        cuerpo.innerHTML = '';
        barraFiltros();
        const lista = document.createElement('div');
        lista.innerHTML = '<div class="cargando"><span class="girando">◌</span></div>';
        cuerpo.appendChild(lista);
        const filtro = hoja.filtro;
        const recargar = () => { if (hoja.pestana === 'enviadas') pintarEnviadas(); };
        const pagina = async (desde) => {
            const datos = await pedir('/api/personal/tareas/enviadas?filtro=' + encodeURIComponent(filtro) +
                                      '&desde=' + desde);
            if (hoja.pestana !== 'enviadas' || hoja.filtro !== filtro) return;
            if (!desde) lista.innerHTML = '';
            const viejo = lista.querySelector('.mostrar-mas');
            if (viejo) viejo.remove();
            if (!desde && !(datos.tareas || []).length) {
                lista.innerHTML = '<div class="vacio">' + (filtro ? 'No hay tareas con ese filtro.' :
                    'Todavía no has asignado tareas.') + '</div>';
                return;
            }
            datos.tareas.forEach((t) => lista.appendChild(tarjetaTarea(t, false, recargar)));
            if (datos.hay_mas) lista.appendChild(botonMas(() => pagina(desde + datos.tareas.length)));
        };
        try { await pagina(0); } catch (error) {
            lista.innerHTML = '<div class="vacio">' + escapar(error.message) + '</div>';
        }
    }

    async function pintarNueva() {
        cuerpo.innerHTML = '<div class="cargando"><span class="girando">◌</span></div>';
        let datos;
        try { datos = await pedir('/api/personal/tareas/destinatarios'); } catch (error) {
            cuerpo.innerHTML = '<div class="vacio">' + escapar(error.message) + '</div>';
            return;
        }
        if (hoja.pestana !== 'nueva') return;
        const imagenes = [];
        cuerpo.innerHTML =
            '<div class="campo"><label>Para</label><select class="t-para">' +
            (datos.monitores || []).map((m) => '<option value="' + escapar(m.nombre) + '">' +
                escapar(m.nombre) + ' · ' + escapar(m.roles) + '</option>').join('') + '</select></div>' +
            '<div class="campo"><label>Título</label><input class="t-titulo" maxlength="200" placeholder="Qué hay que hacer"></div>' +
            '<div class="campo"><label>Detalle (opcional)</label><textarea class="t-desc" maxlength="4000"></textarea></div>' +
            '<div class="campo"><label>Prioridad</label><select class="t-prioridad">' +
            (datos.prioridades || ['Normal']).map((p) => '<option>' + escapar(p) + '</option>').join('') + '</select></div>' +
            '<div class="campo"><label>Imágenes (opcional, hasta ' + MAX_IMAGENES + ')</label>' +
            '<button class="boton-secundario t-adjuntar">📎 Adjuntar imagen</button>' +
            '<input type="file" class="t-archivo oculto" accept="image/*" multiple>' +
            '<div class="miniaturas t-miniaturas"></div></div>' +
            '<button class="boton-principal t-enviar">Asignar tarea</button>';
        const $ = (s) => cuerpo.querySelector(s);
        const pintarMinis = () => {
            const mini = $('.t-miniaturas');
            mini.innerHTML = '';
            imagenes.forEach((src, i) => {
                const envoltura = document.createElement('div');
                envoltura.className = 'quitar-img';
                envoltura.innerHTML = '<img alt=""><button title="Quitar">✕</button>';
                envoltura.querySelector('img').src = src;
                envoltura.querySelector('img').onclick = () => abrirVisor(src);
                envoltura.querySelector('button').onclick = () => { imagenes.splice(i, 1); pintarMinis(); };
                mini.appendChild(envoltura);
            });
        };
        $('.t-adjuntar').onclick = () => $('.t-archivo').click();
        $('.t-archivo').onchange = async (e) => {
            const archivos = Array.from(e.target.files || []);
            e.target.value = '';
            for (const archivo of archivos) {
                if (imagenes.length >= MAX_IMAGENES) { avisar('Como mucho ' + MAX_IMAGENES + ' imágenes.', 'malo'); break; }
                try { imagenes.push(await comprimir(archivo)); } catch (error) { avisar(error.message, 'malo'); }
            }
            pintarMinis();
        };
        $('.t-enviar').onclick = async () => {
            const boton = $('.t-enviar');
            boton.disabled = true;
            boton.textContent = 'Enviando…';
            try {
                const r = await pedir('/api/personal/tareas', 'POST', {
                    asignada_a: $('.t-para').value, titulo: $('.t-titulo').value,
                    descripcion: $('.t-desc').value, prioridad: $('.t-prioridad').value,
                    imagenes: imagenes,
                });
                avisar(r.mensaje, 'bueno');
                hoja.pestana = 'enviadas';
                hoja.pintar();
            } catch (error) {
                avisar(error.message, 'malo');
                boton.disabled = false;
                boton.textContent = 'Asignar tarea';
            }
        };
    }

    hoja.pintar();
}

// =======================================================================
// BARRAS
// =======================================================================
function ficha() {
    try { return JSON.parse(localStorage.getItem(CLAVE_FICHA) || '{}'); } catch (e) { return {}; }
}

function guardarFicha(datos) {
    const copia = Object.assign({}, datos);
    delete copia.token;
    localStorage.setItem(CLAVE_FICHA, JSON.stringify(copia));
}

function pintarBarras(actual, yo) {
    let barra = document.getElementById('barra-personal');
    if (!barra) {
        barra = document.createElement('div');
        barra.id = 'barra-personal';
        document.body.insertBefore(barra, document.body.firstChild);
    }
    barra.className = 'barra';
    barra.innerHTML =
        '<div class="marca">P</div>' +
        '<div class="quien"><div class="nombre">' + escapar(yo.monitor || '—') + '</div>' +
        '<div class="roles">' + escapar(yo.texto_roles || '') +
        (yo.jornada && yo.jornada !== 'Todas' ? ' · ' + escapar(yo.jornada) : '') + '</div></div>' +
        '<div class="derecha">' +
        '  <button class="redondo" id="btn-campana" title="Tareas">🔔<span class="globo oculto" id="globo-tareas">0</span></button>' +
        '  <button class="redondo" id="btn-salir" title="Cerrar sesión">⏻</button>' +
        '</div>';
    document.getElementById('btn-campana').onclick = abrirCampana;
    document.getElementById('btn-salir').onclick = async () => {
        // La sesión ya no caduca: solo este botón la cierra. Antes se le
        // dice a la API que este teléfono deja de recibir sus mensajes.
        if (window.PARADISE_PUSH) await PARADISE_PUSH.salir(true);
        else { try { await pedir('/api/personal/salir', 'POST'); } catch (e) { /* da igual */ } }
        localStorage.removeItem(CLAVE_TOKEN);
        localStorage.removeItem(CLAVE_FICHA);
        aLogin();
    };

    let nav = document.getElementById('nav-personal');
    if (!nav) {
        nav = document.createElement('nav');
        nav.id = 'nav-personal';
        document.body.appendChild(nav);
    }
    nav.className = 'navegacion';
    const permitidos = ['inicio'].concat(yo.modulos || []);
    nav.innerHTML = MODULOS.filter((m) => permitidos.indexOf(m.id) >= 0).map((m) =>
        '<button class="' + (m.id === actual ? 'activo' : '') + '" data-pagina="' + m.pagina + '" data-id="' + m.id + '">' +
        '<span class="simbolo">' + m.simbolo + '</span>' + m.texto +
        (m.id === 'chat' ? '<span class="globo oculto" id="globo-chat">0</span>' : '') + '</button>').join('');
    nav.querySelectorAll('button').forEach((b) => {
        b.onclick = () => {
            if (b.dataset.id === actual) window.scrollTo({ top: 0, behavior: 'smooth' });
            else window.location.href = b.dataset.pagina;
        };
    });

    if (!document.getElementById('capas-personal')) {
        const capas = document.createElement('div');
        capas.id = 'capas-personal';
        document.body.appendChild(capas);
    }
}

function globoChat(n) {
    const globo = document.getElementById('globo-chat');
    if (!globo) return;
    globo.textContent = n > 99 ? '99+' : String(n);
    globo.classList.toggle('oculto', !n);
}

/* Arranca la página: comprueba la sesión, pinta las barras y la campana.
 * Devuelve la ficha (quién es) o no resuelve nunca si hay que ir al login. */
async function iniciar(actual) {
    if (!token()) { aLogin(); return new Promise(() => {}); }
    pintarBarras(actual, ficha());
    let yo;
    try {
        yo = await pedir('/api/personal/yo');
    } catch (error) {
        if (!token()) return new Promise(() => {});
        avisar(error.message, 'malo');
        yo = ficha();
    }
    guardarFicha(yo);
    pintarBarras(actual, yo);
    if (actual !== 'inicio' && (yo.modulos || []).indexOf(actual) < 0) {
        window.location.href = 'personal_panel.html';
        return new Promise(() => {});
    }
    revisarTareas(true).then(() => {
        // El aviso de un ticket nuevo abre aquí con ?tareas=1.
        const parametros = new URLSearchParams(window.location.search);
        if (parametros.get('tareas')) {
            history.replaceState(null, '', window.location.pathname);
            abrirCampana();
            // El aviso de un mensaje en una tarea abre directo su conversación.
            const id = parametros.get('tarea');
            const t = id && campana.tareas.concat(campana.respuestas).find((x) => x.id === id);
            if (id) abrirConversacion(t || { id: id, titulo: 'Tarea' },
                                      () => { if (campana.abierta) campana.abierta.pintar(); });
        }
    });
    campana.reloj = setInterval(revisarTareas, CADA_MS_TAREAS);
    document.addEventListener('visibilitychange', revisarTareas);
    return yo;
}

/* Lista de modelos con buscador, dentro de `contenedor`. Llama a
 * `alElegir(modelo)` al tocar una. modelos = [{cedula, nombre, jornada}]. */
function selectorModelos(contenedor, modelos, alElegir) {
    const sinTildes = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    let elegida = '';
    contenedor.classList.add('selector-modelos');
    contenedor.innerHTML = '<input class="buscar" type="search" placeholder="Buscar modelo…" autocomplete="off">' +
        '<div class="opciones"></div>';
    const buscar = contenedor.querySelector('.buscar');
    const opciones = contenedor.querySelector('.opciones');
    function pintar() {
        const f = sinTildes(buscar.value.trim());
        const lista = modelos.filter((m) => !f || sinTildes(m.nombre + ' ' + m.jornada).indexOf(f) >= 0);
        opciones.innerHTML = lista.length ? lista.map((m) =>
            '<button type="button" class="opcion' + (m.cedula === elegida ? ' elegida' : '') +
            '" data-cedula="' + escapar(m.cedula) + '"><span>' + escapar(m.nombre) + '</span><small>' +
            escapar(m.jornada) + '</small></button>').join('')
            : '<div class="vacio">Ninguna modelo con ese nombre.</div>';
        opciones.querySelectorAll('.opcion').forEach((b) => {
            b.onclick = () => {
                elegida = b.dataset.cedula;
                pintar();
                alElegir(modelos.find((m) => m.cedula === elegida));
            };
        });
    }
    buscar.oninput = pintar;
    pintar();
}

window.Personal = {
    selectorModelos: selectorModelos,
    iniciar: iniciar, pedir: pedir, pedirArchivo: pedirArchivo, avisar: avisar,
    escapar: escapar, abrirVisor: abrirVisor, abrirConversacion: abrirConversacion, aDataUrl: aDataUrl, comprimir: comprimir,
    abrirCampana: abrirCampana, globoChat: globoChat, guardarFicha: guardarFicha, ficha: ficha,
    tarjetaTarea: tarjetaTarea, revisarTareas: revisarTareas,
    tareas: () => campana.tareas, CLAVE_TOKEN: CLAVE_TOKEN,
};
})();
