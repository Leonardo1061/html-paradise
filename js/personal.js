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
 *
 * «NO REALIZADA» Y FILTRO POR PERSONA  (Leonardo, 2026-10-08)
 * -----------------------------------------------------------
 * Quien asignó una tarea la puede marcar «⛔ No realizada» (no se hizo en el
 * plazo): es final, como cerrarla, y tiene su propio filtro. En «Enviadas»,
 * a la derecha de los filtros, un desplegable deja ver las de una persona.
 *
 * SIN «TODAS» Y CAMPANA POR PENDIENTES  (Leonardo, 2026-10-11)
 * ------------------------------------------------------------
 * Las pestañas son Pendientes (la de entrada), En curso, Hechas, Cerradas y
 * No realizadas, para quien recibe y para quien asigna. Al pulsar «En curso»
 * o «Hecha» la tarea se va a esa pestaña y la campana se mueve con ella. La
 * campana cuenta las pendientes y las que tienen algo nuevo de quien la
 * asignó (se apaga al abrir la conversación). Cerrada, no realizada o
 * cancelada ya no tiene conversación.
 *
 * «👥 TODO EL PERSONAL» Y RESUMEN  (Leonardo, 2026-10-11; api/tareas_grupales.py)
 * -------------------------------------------------------------------------
 * Al asignar se puede elegir «👥 Todo el personal» (menos CEO, Gerencia y
 * Fotografía). La primera persona que pulsa «En curso» la toma: a las demás
 * les sale en curso con «La está haciendo X», sin botones ni conversación.
 * En «Enviadas», «📊 Por persona» enseña cuántas hizo y cuántas no realizó
 * cada uno (este mes, el pasado o todo); tocar a alguien filtra sus tareas.
 *
 * RECORDATORIO A LAS 24 HORAS  (Leonardo, 2026-10-12; api/tareas_recordatorio.py)
 * ------------------------------------------------------------------------
 * Una tarea pendiente hace más de 24 horas sale con «⏰ +24 h». Al entrar a
 * la web, si la persona está en su turno (nunca en su día de descanso), una
 * ventana le recuerda cuáles tiene, con «Ver tareas». Sale una vez cada vez
 * que abre la web (sessionStorage), no en cada cambio de página.
 *
 * EL DESCANSO DE LA SEMANA  (Leonardo, 2026-10-11; api/cronograma.py)
 * -------------------------------------------------------------------
 * De miércoles a viernes 11:59 pm, a Julian, Leonardo, Alexander y Mayra la
 * campana les enseña arriba de «Para mí» los días de la semana siguiente para
 * elegir su descanso. Mientras no elijan suma uno al globo. Viaja en
 * `descanso` de /tareas; la malla está en personal_cronograma.html.
 *
 * LAS ACTIVIDADES DEL CRONOGRAMA  (api/actividades.py)
 * ----------------------------------------------------
 * Capacitaciones de managers, capacitaciones a modelos y reuniones generales
 * llegan a la campana al programarlas y otra vez 15 minutos antes. Una
 * actividad personal solo llega si CEO o Gerencia la corrieron. Abrir la
 * campana las da por vistas. Viajan en `actividades` de /tareas; el INICIO
 * las escucha con el evento `personal:actividades`.
 *
 * ACTUALIZA TUS DATOS  (Leonardo, 2026-10-13; api/datos_personal.py)
 * -----------------------------------------------------------------
 * A quien le falte nombre, apellido, teléfono o un correo @gmail.com, la
 * campana le pone arriba de «Para mí» la tarjeta «📝 Actualiza tus datos»
 * y le suma uno al globo hasta que los guarde. Viaja en `mis_datos` de /tareas.
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
    { id: 'pendientes', texto: 'Pendientes', estados: ['pendiente'] },
    { id: 'en_curso', texto: 'En curso', estados: ['en curso'] },
    { id: 'hechas', texto: 'Hechas', estados: ['hecha'] },
    { id: 'cerradas', texto: 'Cerradas', estados: ['cerrada', 'cancelada'] },
    { id: 'no_realizadas', texto: 'No realizadas', estados: ['no realizada'] },
];

const MODULOS = [
    { id: 'inicio', texto: 'INICIO', simbolo: '▦', pagina: 'personal_panel.html' },
    { id: 'chat', texto: 'CHAT', simbolo: '💬', pagina: 'personal_chat.html' },
    { id: 'fotografia', texto: 'FOTOGRAFÍA', simbolo: '📷', pagina: 'personal_fotografia.html' },
    { id: 'status', texto: 'STATUS ROOM', simbolo: '📋', pagina: 'personal_status.html' },
    { id: 'cronograma', texto: 'CRONOGRAMA', simbolo: '🗓️', pagina: 'personal_cronograma.html' },
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
    PARADISE.olvidar(CLAVE_TOKEN);
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
    misTickets: [],                  // los que ESTA persona le mandó al CEO (no el CEO)
    tipos: null,                     // {tipos, otra, puede_editar}: los tipos de solicitud
    respuestas: [],                  // las que asignó y le contestaron sin que lo haya visto
    descanso: null,                  // la elección del descanso abierta (cronograma)
    actividades: [],                 // las del cronograma que le tocan (próximas)
    misDatos: null,                  // {pendiente, faltan} si le falta algún dato
    conocidas: null,                 // ids ya vistos (para pitar solo por las nuevas)
    reloj: null,
    abierta: null,                   // la hoja, si está abierta
};

/* Lo mismo que personal.cuenta_en_campana de la API. */
function cuentaEnCampana(t) {
    // Un ticket de una modelo, solo mientras no se ha visto (abrir la campana
    // lo da por visto): al CEO le cuenta lo nuevo, no todo lo abierto.
    if (t.ticket) return !t.leida;
    return t.estado === 'pendiente' || !t.leida;
}

function pintarGlobo() {
    const globo = document.getElementById('globo-tareas');
    if (!globo) return;
    const n = campana.tareas.filter(cuentaEnCampana).length + campana.respuestas.length +
        campana.misTickets.filter((t) => t.nuevo).length +
        (campana.descanso && campana.descanso.pendiente ? 1 : 0) +
        (campana.misDatos ? 1 : 0) +
        campana.actividades.filter(actividadSuena).length;
    globo.textContent = n > 99 ? '99+' : String(n);
    globo.classList.toggle('oculto', !n);
    document.dispatchEvent(new CustomEvent('personal:tareas', { detail: campana.tareas }));
    document.dispatchEvent(new CustomEvent('personal:actividades', { detail: campana.actividades }));
}

/* ¿Esta actividad enciende el globo? Nueva, a 15 min o corrida. */
function actividadSuena(a) { return a.nuevo || a.pronto || !!a.movida; }

/* ¿Es el CEO? (la API le pone el módulo de MIS TICKETS). */
function esCeo() { return (ficha().modulos || []).indexOf('tickets') >= 0; }

/* Los tickets que esta persona le mandó al CEO: su respuesta enciende el globo. */
async function revisarMisTickets() {
    if (esCeo()) return;
    try {
        const datos = await pedir('/api/personal/tickets/mios');
        const antes = new Set(campana.misTickets.filter((t) => t.nuevo).map((t) => t.id + t.num_respuestas));
        campana.misTickets = datos.tickets || [];
        const nuevos = campana.misTickets.filter((t) => t.nuevo && !antes.has(t.id + t.num_respuestas));
        if (nuevos.length && campana.conocidas) { pitar(); avisar('🎫 El CEO respondió: ' + nuevos[0].asunto); }
    } catch (e) { /* sin red: la siguiente vuelta */ }
}

async function revisarTareas(forzar) {
    if (forzar !== true && document.visibilityState !== 'visible') return;
    await revisarMisTickets();
    try {
        const datos = await pedir('/api/personal/tareas');
        campana.tareas = datos.tareas || [];
        campana.respuestas = datos.respuestas || [];
        const antes = campana.descanso;
        campana.descanso = datos.descanso || null;
        const faltabanDatos = campana.misDatos;
        campana.misDatos = datos.mis_datos || null;
        if (campana.misDatos && !faltabanDatos) {
            avisar('📝 Actualiza tus datos: nombre, apellido, teléfono y Gmail. Están en la 🔔 campana.');
        }
        const sonaban = new Set(campana.actividades.filter(actividadSuena)
            .map((a) => a.id + (a.pronto ? 'p' : '') + (a.movida ? 'm' : '')));
        campana.actividades = datos.actividades || [];
        const suenan = campana.actividades.filter(actividadSuena)
            .filter((a) => !sonaban.has(a.id + (a.pronto ? 'p' : '') + (a.movida ? 'm' : '')));
        if (suenan.length && campana.conocidas) {
            pitar();
            const a = suenan[0];
            avisar(a.movida ? '🗓️ ' + a.movida : (a.pronto ? '⏰ En 15 min: ' : a.icono + ' ') + a.titulo);
        }
        if (campana.descanso && campana.descanso.pendiente && campana.conocidas &&
            !(antes && antes.pendiente)) {
            pitar();
            avisar('🗓️ Ya puedes elegir tu día de descanso de la semana ' + campana.descanso.etiqueta);
        }
        // «Nueva» es una tarea que no estaba o que tiene un mensaje o un
        // estado distinto desde la última vuelta.
        const clave = (t) => t.id + '·' + (t.num_respuestas || 0) + '·' + t.estado;
        const pendientes = campana.tareas.filter(cuentaEnCampana).concat(campana.respuestas);
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
    return estado === 'hecha' || estado === 'cerrada' ? 'bien' : estado === 'en curso' ? 'cian' :
        estado === 'no realizada' ? 'urgente' : '';
}

/* «No realizada»: la pone quien asignó la tarea y ya no se retoma. */
async function marcarNoRealizada(t) {
    if (!confirm('¿Marcar «' + (t.titulo || 'la tarea') + '» como NO REALIZADA? ' +
                 'Queda cerrada y ya no se podrá retomar.')) return false;
    const r = await pedir('/api/personal/tareas/' + encodeURIComponent(t.id) + '/no_realizada', 'POST');
    avisar(r.mensaje, 'bueno');
    return true;
}

function tarjetaTarea(t, recibida, alCambiar) {
    const caja = document.createElement('div');
    const porVer = recibida ? !t.leida : t.leida_creador === false;
    caja.className = 'tarea' + (porVer ? ' nueva' : '');
    const prioridad = t.prioridad === 'Urgente' ? 'urgente' : t.prioridad === 'Alta' ? 'alta' : '';
    caja.innerHTML =
        '<div class="cabeza"><div class="t">' + escapar(t.titulo) + '</div>' +
        (t.prioridad !== 'Normal' ? '<span class="pildora ' + prioridad + '">' + escapar(t.prioridad) + '</span>' : '') +
        (t.vencida ? '<span class="pildora urgente" title="Pendiente hace más de 24 horas">⏰ +24 h</span>' : '') +
        '<span class="pildora ' + claseEstado(t.estado) + '">' + escapar(t.estado) + '</span></div>' +
        '<div class="meta">' + (t.ticket ? '🎫 Ticket de ' + escapar(t.modelo || t.creada_por || '¿?') +
            (t.de_personal ? ' (personal)' : '') +
            (t.enviado_por ? ' · ✍ lo envió ' + escapar(t.enviado_por) : '') +
            (t.tipo_solicitud ? ' · ' + escapar(t.tipo_solicitud) : '') :
            recibida ? 'De ' + escapar(t.creada_por || '¿?') + (t.para_todos ? ' · 👥 para todo el personal' : '') :
            t.para_todos ? '👥 Todo el personal (' + (t.n_grupo || '¿?') + ')' +
                (t.tomada_por ? ' · la tomó ' + escapar(t.tomada_por) : ' · sin tomar') :
            'Para ' + escapar(t.asignada_a || '¿?')) +
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
        const destino = { 'en curso': 'en_curso', 'hecha': 'hechas', 'cancelada': 'cerradas' }[estado];
        if (destino && campana.abierta) campana.abierta.filtro = destino;
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
    if (!t.ticket && (t.estado === 'cerrada' || t.estado === 'no realizada')) {
        const r = document.createElement('div');
        r.className = 'meta';
        r.textContent = (t.estado === 'cerrada' ? '🔒 Cerrada por ' : '⛔ No realizada · la marcó ') +
            (t.cerrada_por || '¿?') + (t.cerrada ? ' · ' + t.cerrada : '');
        caja.insertBefore(r, caja.querySelector('.miniaturas'));
    }
    // Desde 2026-10-12 el ticket también es una conversación hasta que el CEO lo finaliza.
    if (t.con_conversacion !== false && (!t.ticket || t.abierta)) {
        const b = document.createElement('button');
        b.className = 'boton-principal boton-conversacion';
        b.textContent = '💬 Conversación' + (t.num_respuestas ? ' (' + t.num_respuestas + ')' : '');
        b.onclick = () => abrirConversacion(t, alCambiar);
        botones.appendChild(b);
    }
    // Grupal que tomó otra persona: solo se mira.
    const deOtro = recibida && t.para_todos && t.tomada_por && t.tomada_por !== ficha().monitor;
    if (deOtro) {
        const r = document.createElement('div');
        r.className = 'meta de-otro';
        r.textContent = (t.estado === 'en curso' ? '👥 La está haciendo ' :
                         t.hecha_por ? '👥 La hizo ' : '👥 La tomó ') + t.tomada_por;
        caja.insertBefore(r, caja.querySelector('.miniaturas'));
    }
    if (recibida && t.abierta && !deOtro) {
        if (t.estado !== 'en curso') boton('▶ En curso', () => cambiar('en curso'));
        if (!t.ticket && t.estado !== 'hecha') boton('✓ Hecha', () => cambiar('hecha'));
    }
    if (!recibida && t.abierta && !t.ticket) {
        // Si se arrepiente en la confirmación, el botón vuelve a quedar activo.
        boton('⛔ No realizada', async () => {
            if (await marcarNoRealizada(t)) alCambiar();
            else throw new Error('No se marcó.');
        });
    }
    // En curso o hecha: quien la asignó la devuelve a pendientes (2026-10-12).
    if (!recibida && t.abierta && !t.ticket && (t.estado === 'en curso' || t.estado === 'hecha')) {
        boton('↩ Regresar a pendientes', async () => {
            const quien = t.para_todos ? 'todo el personal' : (t.asignada_a || 'la persona');
            if (!confirm('¿Regresar «' + (t.titulo || '') + '» a pendientes?\n\nLe vuelve a ' +
                         'salir en la campana a ' + quien + '.')) throw new Error('No se regresó.');
            const r = await pedir('/api/personal/tareas/' + encodeURIComponent(t.id) + '/a_pendientes', 'POST');
            avisar(r.mensaje, 'bueno');
            if (campana.abierta) campana.abierta.filtro = 'pendientes';
            alCambiar();
        });
    }
    if (!recibida && t.abierta) boton('✕ Cancelar', () => cambiar('cancelada'));
    // Quien la asignó la puede borrar del todo, esté como esté (2026-10-12).
    if (!recibida && !t.ticket) {
        boton('🗑 Eliminar', async () => {
            if (!confirm('¿Eliminar DEFINITIVAMENTE la tarea «' + (t.titulo || '') + '»?' +
                         (t.para_todos ? '\n\nSe borra para todo el personal.' : '') +
                         '\n\nSe borra también su conversación y no se puede deshacer.')) {
                throw new Error('No se eliminó.');
            }
            const r = await pedir('/api/personal/tareas/' + encodeURIComponent(t.id) + '/eliminar', 'POST');
            avisar(r.mensaje, 'bueno');
            caja.remove();
            alCambiar();
        });
    }
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
            fin.textContent = (info.tarea.estado === 'no realizada' ? '⛔ Marcada como NO REALIZADA' : '🔒 Tarea cerrada') +
                (info.tarea.cerrada_por ? ' por ' + info.tarea.cerrada_por : '') +
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
            pie.querySelector('.no-realizada').classList.toggle('oculto', !info.puede_cerrar || !!info.tarea.ticket);
            return;
        }
        pie.innerHTML =
            '<div class="archivo-elegido oculto"></div>' +
            '<div class="fila-escribir">' +
            '  <button class="boton-secundario adjuntar" title="Adjuntar foto, video, PDF o Excel">📎</button>' +
            '  <textarea maxlength="4000" rows="3" placeholder="Escribe tu respuesta"></textarea>' +
            '  <button class="boton-principal enviar">Enviar</button>' +
            '</div>' +
            '<input type="file" class="oculto" accept="' + ACEPTA_ARCHIVOS + '">' +
            '<button class="boton-secundario cerrar-tarea' + (info.puede_cerrar ? '' : ' oculto') + '">' +
                (info.tarea.ticket ? '🔒 Finalizar ticket' : '🔒 Cerrar tarea') + '</button>' +
            '<button class="boton-secundario no-realizada' + (info.puede_cerrar && !info.tarea.ticket ? '' : ' oculto') +
                '">⛔ No realizada</button>';
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
        pie.querySelector('.no-realizada').onclick = async (e) => {
            e.target.disabled = true;
            // Terminada, la conversación ya no se abre: se vuelve a la lista.
            try { if (await marcarNoRealizada(info.tarea)) { salir(); return; } } catch (error) { avisar(error.message, 'malo'); }
            e.target.disabled = false;
        };
        pie.querySelector('.cerrar-tarea').onclick = async (e) => {
            if (!confirm(info.tarea.ticket ? '¿Finalizar el ticket? Ya no se podrá escribir en él.'
                         : '¿Cerrar la tarea? Ya no se podrá retomar ni escribir en ella.')) return;
            e.target.disabled = true;
            try {
                const r = await pedir('/api/personal/tareas/' + encodeURIComponent(t.id) + '/cerrar', 'POST');
                avisar(r.mensaje, 'bueno');
                salir();
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
            cargar().catch((error) => {
                // La modelo borró su ticket (o alguien la tarea): se cierra.
                if (error.codigo === 404) {
                    const ticket = estado.info.tarea && estado.info.tarea.ticket;
                    avisar((ticket ? 'Este ticket' : 'Esta tarea') + ' ya no existe: se eliminó.', 'malo');
                    salir();
                }
            });
        }
    }, CADA_MS_CONVERSACION);
}

/* «⏰ Tienes tareas pendientes desde hace más de 24 horas». Una vez cada
 * vez que se abre la web; la API devuelve vacío fuera del turno. */
const CLAVE_RECORDATORIO = 'recordatorio_tareas_visto';

async function recordarTareas() {
    try { if (sessionStorage.getItem(CLAVE_RECORDATORIO)) return; } catch (e) { /* sin storage */ }
    let datos;
    try { datos = await pedir('/api/personal/tareas/recordatorio'); } catch (e) { return; }
    if (!datos.tareas || !datos.tareas.length) return;
    try { sessionStorage.setItem(CLAVE_RECORDATORIO, '1'); } catch (e) { /* sin storage */ }
    const capas = document.getElementById('capas-personal');
    if (!capas || capas.innerHTML) return;          // ya hay algo abierto encima
    const n = datos.tareas.length;
    capas.innerHTML =
        '<div class="velo"></div><div class="hoja recordatorio-tareas">' +
        '  <div class="hoja-cabecera"><h3>⏰ ' + (n === 1 ? 'Tienes 1 tarea pendiente' :
            'Tienes ' + n + ' tareas pendientes') + ' desde hace más de 24 horas</h3>' +
        '  <button class="cerrar" title="Cerrar">✕</button></div>' +
        '  <div class="hoja-cuerpo"><ul class="lista-recordatorio">' +
        datos.tareas.map((t) => '<li><b>' + escapar(t.titulo) + '</b><span>' +
            (t.ticket ? '🎫 ' : 'De ') + escapar(t.de || '¿?') + (t.creada ? ' · ' + escapar(t.creada) : '') +
            '</span></li>').join('') +
        '  </ul><div class="meta">Ponla «En curso» para que deje de salir este recordatorio.</div>' +
        '  <button class="boton-principal ver-tareas" style="margin-top:14px">Ver tareas</button></div></div>';
    const cerrar = () => { capas.innerHTML = ''; };
    capas.querySelector('.velo').onclick = cerrar;
    capas.querySelector('.cerrar').onclick = cerrar;
    capas.querySelector('.ver-tareas').onclick = () => { cerrar(); abrirCampana(); };
}

// =======================================================================
// TICKETS AL CEO: TIPOS DE SOLICITUD Y LOS DEL PERSONAL (2026-10-12)
// =======================================================================
async function cargarTipos() {
    campana.tipos = await pedir('/api/personal/tickets/tipos');
    return campana.tipos;
}

/* El CEO agrega, cambia de nombre o borra los tipos (los tickets que ya
 * llegaron se quedan con el tipo con que se mandaron). */
async function abrirTiposSolicitud(alGuardar) {
    let datos;
    try { datos = await cargarTipos(); } catch (error) { avisar(error.message, 'malo'); return; }
    const capa = document.createElement('div');
    capa.className = 'capa-conversacion';
    capa.innerHTML = '<div class="velo"></div><div class="hoja">' +
        '<div class="hoja-cabecera"><h3>⚙ Tipos de solicitud</h3><button class="cerrar" title="Cerrar">✕</button></div>' +
        '<div class="hoja-cuerpo"><div class="meta" style="margin-bottom:10px">Los ven las modelos y el personal al ' +
        'mandarte un ticket. Con «' + escapar(datos.otra || 'OTRA') + '» el asunto es obligatorio.</div>' +
        '<div class="lista-tipos"></div>' +
        '<button class="boton-secundario agregar-tipo" style="margin-top:8px">＋ Agregar tipo</button>' +
        '<button class="boton-principal guardar-tipos" style="margin-top:14px">Guardar</button></div></div>';
    document.getElementById('capas-personal').appendChild(capa);
    const lista = capa.querySelector('.lista-tipos');
    const fila = (valor) => {
        const f = document.createElement('div');
        f.className = 'fila-tipo';
        f.innerHTML = '<input maxlength="80"><button class="cerrar" title="Eliminar">🗑</button>';
        f.querySelector('input').value = valor || '';
        f.querySelector('button').onclick = () => {
            if (confirm('¿Eliminar el tipo «' + (f.querySelector('input').value || '') + '»?')) f.remove();
        };
        lista.appendChild(f);
        return f;
    };
    (datos.tipos || []).forEach(fila);
    const cerrar = () => capa.remove();
    capa.querySelector('.velo').onclick = cerrar;
    capa.querySelector('.cerrar').onclick = cerrar;
    capa.querySelector('.agregar-tipo').onclick = () => fila('').querySelector('input').focus();
    capa.querySelector('.guardar-tipos').onclick = async (e) => {
        const tipos = Array.from(lista.querySelectorAll('input')).map((i) => i.value.trim()).filter(Boolean);
        e.target.disabled = true;
        try {
            const r = await pedir('/api/personal/tickets/tipos', 'POST', { tipos: tipos });
            campana.tipos = Object.assign({}, campana.tipos, { tipos: r.tipos });
            avisar(r.mensaje, 'bueno');
            cerrar();
            if (alGuardar) alGuardar();
        } catch (error) { avisar(error.message, 'malo'); e.target.disabled = false; }
    };
}

/* Sin tildes y en minúsculas, para buscar la modelo. */
function textoBusqueda(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/* El formulario del ticket del personal: el mismo de las modelos. Con
 * `porModelo`, primero se elige la modelo y el ticket queda como suyo
 * (le aparece en su TICKET CEO; el CEO ve quién lo envió). 2026-10-16. */
async function formularioTicket(contenedor, alEnviar, porModelo) {
    let datos, modelos = [];
    try {
        datos = await cargarTipos();
        if (porModelo) modelos = (await pedir('/api/personal/tickets/modelos')).modelos || [];
    } catch (error) { avisar(error.message, 'malo'); return; }
    if (porModelo && !modelos.length) { avisar('No tienes modelos a las que mandarles un ticket.', 'malo'); return; }
    const otra = datos.otra || 'OTRA';
    const fotos = [];            // {archivo, vista}
    const archivos = [];         // videos y PDF
    contenedor.innerHTML =
        (porModelo ? '<div class="campo"><label>Modelo (queda como si ella lo enviara)</label>' +
            '<input class="k-buscar" placeholder="Buscar por nombre, apellido o cédula…" autocomplete="off">' +
            '<select class="k-modelo" style="margin-top:6px"></select></div>' : '') +
        '<div class="campo"><label>Tipo de solicitud</label><select class="k-tipo"><option value="">Elige el tipo…</option>' +
        (datos.tipos || []).map((x) => '<option>' + escapar(x) + '</option>').join('') + '</select></div>' +
        '<div class="campo"><label class="k-etiqueta">Asunto (opcional)</label><input class="k-asunto" maxlength="200"></div>' +
        '<div class="campo"><label>Cuéntale qué pasa (opcional)</label><textarea class="k-detalle" maxlength="4000"></textarea></div>' +
        '<div class="campo"><label>Adjuntos (opcional): hasta 6 fotos y 4 videos o PDF</label>' +
        '<button class="boton-secundario k-adjuntar">📎 Adjuntar</button>' +
        '<input type="file" class="oculto k-archivo" accept="image/*,video/*,application/pdf,.pdf" multiple>' +
        '<div class="miniaturas k-lista"></div></div>' +
        '<button class="boton-principal k-enviar">Enviar al CEO</button>' +
        '<button class="boton-secundario k-cancelar" style="margin-top:8px;width:100%">Cancelar</button>';
    const $ = (x) => contenedor.querySelector(x);
    if (porModelo) {
        const pintarModelos = () => {
            const buscado = textoBusqueda($('.k-buscar').value).trim();
            const antes = $('.k-modelo').value;
            const lista = modelos.filter((m) => !buscado ||
                textoBusqueda(m.nombre + ' ' + m.cedula + ' ' + (m.jornada || '')).indexOf(buscado) >= 0);
            $('.k-modelo').innerHTML = '<option value="">' + (lista.length ? 'Elige la modelo… (' + lista.length + ')' : 'Ninguna coincide') + '</option>' +
                lista.map((m) => '<option value="' + escapar(m.cedula) + '">' + escapar(m.nombre) +
                    ' · ' + escapar(m.jornada || '') + ' · ' + escapar(m.cedula) + '</option>').join('');
            if (lista.length === 1) $('.k-modelo').value = lista[0].cedula;
            else if (lista.some((m) => m.cedula === antes)) $('.k-modelo').value = antes;
        };
        $('.k-buscar').oninput = pintarModelos;
        pintarModelos();
    }
    $('.k-tipo').onchange = () => {
        $('.k-etiqueta').textContent = $('.k-tipo').value === otra ? 'Asunto (obligatorio con «' + otra + '»)' : 'Asunto (opcional)';
    };
    const pintarLista = () => {
        $('.k-lista').innerHTML = fotos.map((f) => '<img src="' + f.vista + '" alt="">').join('') +
            archivos.map((a) => '<span class="meta">' + (a.type === 'application/pdf' ? '📄 ' : '🎬 ') + escapar(a.name) + '</span>').join('');
    };
    $('.k-adjuntar').onclick = () => $('.k-archivo').click();
    $('.k-archivo').onchange = async (e) => {
        for (const archivo of Array.from(e.target.files || [])) {
            if ((archivo.type || '').indexOf('image/') === 0) {
                if (fotos.length >= 6) { avisar('Como mucho 6 fotos.', 'malo'); continue; }
                try { fotos.push({ archivo: archivo, vista: await comprimir(archivo) }); } catch (error) { avisar(error.message, 'malo'); }
            } else if (archivos.length < 4) archivos.push(archivo);
            else avisar('Como mucho 4 videos o PDF.', 'malo');
        }
        e.target.value = '';
        pintarLista();
    };
    $('.k-cancelar').onclick = () => alEnviar();
    $('.k-enviar').onclick = async () => {
        const tipo = $('.k-tipo').value;
        const asunto = $('.k-asunto').value.trim();
        const cedula = porModelo ? $('.k-modelo').value : '';
        if (porModelo && !cedula) { avisar('Elige la modelo.', 'malo'); return; }
        if (!tipo) { avisar('Elige el tipo de solicitud.', 'malo'); return; }
        if (tipo === otra && !asunto) { avisar('Con «' + otra + '», escribe el asunto.', 'malo'); return; }
        const formulario = new FormData();
        if (cedula) formulario.append('cedula', cedula);
        formulario.append('tipo', tipo);
        formulario.append('asunto', asunto);
        formulario.append('detalle', $('.k-detalle').value);
        formulario.append('vistas', JSON.stringify(fotos.map((f) => f.vista)));
        fotos.forEach((f) => formulario.append('fotos', f.archivo, f.archivo.name || 'foto.jpg'));
        archivos.forEach((a) => formulario.append('archivos', a, a.name || 'archivo'));
        const boton = $('.k-enviar');
        boton.disabled = true;
        boton.textContent = 'Enviando…';
        try {
            const r = await pedirFormulario('/api/personal/tickets/nuevo', formulario);
            avisar(r.mensaje || 'Ticket enviado al CEO.', 'bueno');
            alEnviar();
        } catch (error) {
            avisar(error.message, 'malo');
            boton.disabled = false;
            boton.textContent = 'Enviar al CEO';
        }
    };
}

function tarjetaMiTicket(t, alCambiar) {
    const caja = document.createElement('div');
    caja.className = 'tarea' + (t.nuevo ? ' nueva' : '');
    const estado = t.abierto ? (t.respuesta ? 'respondido' : 'pendiente') : (t.estado === 'cerrada' ? 'finalizado' : 'cerrado');
    caja.innerHTML = '<div class="cabeza"><div class="t"></div><span class="pildora ' +
        (t.abierto && !t.respuesta ? '' : 'bien') + '">' + estado + '</span></div>' +
        '<div class="meta">' + escapar(t.tipo_solicitud || '') + ' · enviado ' + escapar(t.creada || 'ahora') + '</div>' +
        (t.respuesta ? '<div class="desc ultima-respuesta"></div>' : '') + '<div class="botones"></div>';
    caja.querySelector('.t').textContent = t.asunto || '';
    if (t.respuesta) caja.querySelector('.ultima-respuesta').textContent = '💬 ' + (t.respondida_por || 'CEO') + ': ' + t.respuesta;
    if (t.con_conversacion || t.num_respuestas) {
        const b = document.createElement('button');
        b.className = 'boton-principal boton-conversacion';
        b.textContent = '💬 Conversación' + (t.num_respuestas ? ' (' + t.num_respuestas + ')' : '');
        b.onclick = () => abrirConversacion({ id: t.id, titulo: t.asunto }, () => revisarTareas(true).then(alCambiar));
        caja.querySelector('.botones').appendChild(b);
    }
    return caja;
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
        (esCeo() ? '' : '<button class="pestana" data-p="tickets">🎫 Mis tickets</button>') +
        '    </div><div class="cuerpo-pestana"></div>' +
        '  </div></div>';
    const cuerpo = capas.querySelector('.cuerpo-pestana');
    const cerrar = () => { capas.innerHTML = ''; campana.abierta = null; };
    capas.querySelector('.velo').onclick = cerrar;
    capas.querySelector('.cerrar').onclick = cerrar;

    const hoja = {
        pestana: 'recibidas',
        filtro: 'pendientes',
        persona: '',                 // «Enviadas»: solo las de esta persona
        resumen: false,              // «Enviadas»: viendo «📊 Por persona»
        periodo: 'este_mes',
        personas: [],
        historial: null,             // {filtro, tareas, hay_mas}: las cerradas de «Para mí»
        tipo: '',                    // el CEO: solo los tickets de este tipo de solicitud
        pintar() {
            capas.querySelectorAll('.pestana').forEach((b) => b.classList.toggle('activa', b.dataset.p === hoja.pestana));
            if (hoja.pestana === 'recibidas') pintarRecibidas();
            else if (hoja.pestana === 'enviadas') pintarEnviadas();
            else if (hoja.pestana === 'tickets') pintarMisTickets();
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

    /* El CEO: un tipo elegido deja solo los tickets de ese tipo. */
    function pasaTipo(t) {
        return !hoja.tipo || (t.ticket && (t.tipo_solicitud || 'OTRA') === hoja.tipo);
    }

    function barraTipos() {
        const fila = document.createElement('div');
        fila.className = 'filtros-tareas fila-tipos';
        const selector = document.createElement('select');
        selector.className = 'filtro-persona';
        const pintar = () => {
            const tipos = (campana.tipos && campana.tipos.tipos) || [];
            selector.innerHTML = '<option value="">🎫 Todos los tipos</option>' +
                tipos.map((x) => '<option>' + escapar(x) + '</option>').join('');
            selector.value = hoja.tipo;
        };
        pintar();
        if (!campana.tipos) cargarTipos().then(pintar).catch(() => {});
        selector.onchange = () => { hoja.tipo = selector.value; hoja.pintar(); };
        fila.appendChild(selector);
        // El editor de los tipos vive en el módulo MIS TICKETS (Leonardo, 2026-10-12).
        cuerpo.appendChild(fila);
    }

    /* «🎫 Mis tickets»: lo que le mandó al CEO, y el formulario para uno nuevo. */
    function pintarMisTickets() {
        cuerpo.innerHTML = '';
        const nuevo = document.createElement('button');
        nuevo.className = 'boton-principal';
        nuevo.textContent = '＋ Nuevo ticket al CEO';
        nuevo.onclick = () => formularioTicket(cuerpo, () => { revisarTareas(true); hoja.pintar(); });
        cuerpo.appendChild(nuevo);
        const porModelo = document.createElement('button');
        porModelo.className = 'boton-secundario';
        porModelo.style.cssText = 'margin-top:8px;width:100%';
        porModelo.textContent = '👩 Ticket en nombre de una modelo';
        porModelo.onclick = () => formularioTicket(cuerpo, () => { revisarTareas(true); hoja.pintar(); }, true);
        cuerpo.appendChild(porModelo);
        if (!campana.misTickets.length) {
            cuerpo.insertAdjacentHTML('beforeend', '<div class="vacio">No le has mandado tickets al CEO.</div>');
            return;
        }
        campana.misTickets.forEach((t) => cuerpo.appendChild(tarjetaMiTicket(t, () => hoja.pintar())));
        const vistos = campana.misTickets.filter((t) => t.nuevo).map((t) => t.id);
        if (vistos.length) {
            pedir('/api/personal/tickets/vistos', 'POST', { ids: vistos }).then(() => {
                campana.misTickets.forEach((t) => { if (vistos.indexOf(t.id) >= 0) t.nuevo = false; });
                pintarGlobo();
            }).catch(() => {});
        }
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
        const tipo = hoja.tipo;
        try {
            const datos = await pedir('/api/personal/tareas/historial?filtro=' + encodeURIComponent(filtro) +
                                      '&tipo=' + encodeURIComponent(tipo) + '&desde=' + desde);
            if (filtro !== hoja.filtro || tipo !== hoja.tipo) return;
            const previas = desde && hoja.historial ? hoja.historial.tareas : [];
            hoja.historial = { filtro: filtro, tipo: tipo, tareas: previas.concat(datos.tareas || []), hay_mas: datos.hay_mas };
        } catch (error) {
            hoja.historial = { filtro: filtro, tipo: tipo, tareas: [], hay_mas: false, error: error.message };
        }
        if (hoja.pestana === 'recibidas') pintarRecibidas();
    }

    function pintarRecibidas() {
        cuerpo.innerHTML = '';
        if (campana.misDatos) cuerpo.appendChild(tarjetaMisDatos(() => revisarTareas(true)));
        if (campana.descanso) cuerpo.appendChild(tarjetaDescanso(campana.descanso, () => revisarTareas(true)));
        if (campana.actividades.length) {
            const titulo = document.createElement('div');
            titulo.className = 'titulo-seccion';
            titulo.textContent = '🗓️ Actividades del cronograma';
            cuerpo.appendChild(titulo);
            campana.actividades.forEach((a) => cuerpo.appendChild(tarjetaActividad(a)));
            const porVer = campana.actividades.filter(actividadSuena).map((a) => a.id);
            if (porVer.length) {
                pedir('/api/personal/cronograma/vistas', 'POST', { ids: porVer }).then(() => {
                    campana.actividades.forEach((a) => {
                        if (porVer.indexOf(a.id) >= 0) { a.nuevo = false; a.pronto = false; a.movida = ''; }
                    });
                    pintarGlobo();
                }).catch(() => {});
            }
        }
        barraFiltros();
        // El filtro por tipo de los tickets vive en MIS TICKETS (Leonardo, 2026-10-12).
        if (campana.respuestas.length && !hoja.tipo) {
            const titulo = document.createElement('div');
            titulo.className = 'titulo-seccion';
            titulo.textContent = '💬 Te respondieron en tareas que asignaste';
            cuerpo.appendChild(titulo);
            campana.respuestas.forEach((t) => cuerpo.appendChild(tarjetaTarea(t, false, () => revisarTareas(true))));
        }
        const abiertas = campana.tareas.filter(pasaFiltro).filter(pasaTipo);
        abiertas.forEach((t) => cuerpo.appendChild(tarjetaTarea(t, true, () => revisarTareas(true))));
        // Al fondo, las ya cerradas (no vienen en la campana: se piden aparte).
        // Las terminadas no vienen en la campana: se piden aparte.
        const conHistorial = ['hechas', 'cerradas', 'no_realizadas'].indexOf(hoja.filtro) >= 0;
        const historial = hoja.historial && hoja.historial.filtro === hoja.filtro &&
            (hoja.historial.tipo || '') === hoja.tipo ? hoja.historial : null;
        if (conHistorial && !historial) {
            cuerpo.insertAdjacentHTML('beforeend', '<div class="cargando"><span class="girando">◌</span></div>');
            cargarHistorial(0);
        } else if (historial) {
            historial.tareas.forEach((t) => cuerpo.appendChild(tarjetaTarea(t, true, () => revisarTareas(true))));
            if (historial.hay_mas) cuerpo.appendChild(botonMas(() => cargarHistorial(historial.tareas.length)));
        }
        if (!abiertas.length && (!conHistorial || (historial && !historial.tareas.length))) {
            cuerpo.insertAdjacentHTML('beforeend', '<div class="vacio">' + (historial && historial.error ?
                escapar(historial.error) : hoja.filtro === 'pendientes' ?
                'No tienes tareas pendientes. 🎉' : 'No hay tareas en esta pestaña.') + '</div>');
        }
        // Las tareas ya no se dan por leídas al abrir: una pendiente cuenta
        // hasta que se pone en curso, y lo nuevo del CEO hasta que se abre la
        // conversación. Los TICKET de las modelos sí: vistos, dejan de sumar.
        const tickets = campana.tareas.filter((t) => t.ticket && !t.leida).map((t) => t.id);
        if (tickets.length) {
            pedir('/api/personal/tareas/leidas', 'POST', { ids: tickets }).then(() => {
                campana.tareas.forEach((t) => { if (tickets.indexOf(t.id) >= 0) t.leida = true; });
                pintarGlobo();
            }).catch(() => {});
        }
    }

    /* Todas las que asignó, ya ordenadas y filtradas por la API, de 20 en 20. */
    /* «📊 Por persona»: cuántas hizo y cuántas no realizó cada uno. */
    async function pintarResumen() {
        cuerpo.innerHTML = '';
        const cabeza = document.createElement('div');
        cabeza.className = 'cabeza-resumen';
        cabeza.innerHTML = '<button class="boton-secundario volver-lista">← Tareas</button>' +
            '<select class="filtro-persona periodo">' +
            [['este_mes', 'Este mes'], ['mes_pasado', 'Mes pasado'], ['todo', 'Todo']].map((p) =>
                '<option value="' + p[0] + '"' + (p[0] === hoja.periodo ? ' selected' : '') + '>' + p[1] + '</option>').join('') +
            '</select>';
        cuerpo.appendChild(cabeza);
        cabeza.querySelector('.volver-lista').onclick = () => { hoja.resumen = false; hoja.pintar(); };
        cabeza.querySelector('.periodo').onchange = (e) => { hoja.periodo = e.target.value; pintarResumen(); };
        const zona = document.createElement('div');
        zona.innerHTML = '<div class="cargando"><span class="girando">◌</span></div>';
        cuerpo.appendChild(zona);
        const periodo = hoja.periodo;
        try {
            const datos = await pedir('/api/personal/tareas/resumen?periodo=' + periodo);
            if (!hoja.resumen || hoja.periodo !== periodo) return;
            if (!datos.personas.length && !datos.grupales.no_realizadas && !datos.grupales.pendientes) {
                zona.innerHTML = '<div class="vacio">No asignaste tareas en ese periodo.</div>';
                return;
            }
            // Tocar un encabezado ordena por esa columna; otro toque invierte.
            // Sin tocar nada queda el orden que trae la API.
            const columnas = [['nombre', 'Persona'], ['hechas', '✅ Hechas'], ['no_realizadas', '⛔ No realizadas'],
                ['en_curso', '▶ En curso'], ['pendientes', 'Pendientes']];
            const pintarTabla = () => {
                const orden = hoja.ordenResumen;
                const personas = datos.personas.slice();
                if (orden) {
                    personas.sort((a, b) => {
                        const r = orden.col === 'nombre' ?
                            String(a.nombre).localeCompare(String(b.nombre), 'es', { sensitivity: 'base' }) :
                            (a[orden.col] || 0) - (b[orden.col] || 0);
                        return orden.asc ? r : -r;
                    });
                }
                zona.innerHTML = '<table class="tabla-resumen"><thead><tr>' +
                    columnas.map((c) => '<th data-col="' + c[0] + '" style="cursor:pointer;user-select:none">' + c[1] +
                        (orden && orden.col === c[0] ? (orden.asc ? ' ▲' : ' ▼') : '') + '</th>').join('') +
                    '</tr></thead><tbody>' +
                    personas.map((p) => '<tr data-persona="' + escapar(p.nombre) + '"><td>' + escapar(p.nombre) +
                        '</td><td>' + p.hechas + '</td><td>' + p.no_realizadas + '</td><td>' + p.en_curso +
                        '</td><td>' + p.pendientes + '</td></tr>').join('') +
                    '<tr class="grupales"><td>👥 Grupales sin tomar</td><td>—</td><td>' + datos.grupales.no_realizadas +
                    '</td><td>—</td><td>' + datos.grupales.pendientes + '</td></tr></tbody></table>' +
                    '<div class="meta" style="margin-top:8px">Por la fecha en que se asignó. «Hechas» incluye las ' +
                    'cerradas. Toca un encabezado para ordenar y a una persona para ver sus tareas.</div>';
                zona.querySelectorAll('th[data-col]').forEach((th) => {
                    th.onclick = () => {
                        const col = th.dataset.col;
                        // Los números empiezan de mayor a menor; el nombre, de la A a la Z.
                        hoja.ordenResumen = orden && orden.col === col ? { col: col, asc: !orden.asc } :
                            { col: col, asc: col === 'nombre' };
                        pintarTabla();
                    };
                });
                zona.querySelectorAll('tr[data-persona]').forEach((fila) => {
                    fila.onclick = () => {
                        hoja.persona = fila.dataset.persona;
                        hoja.resumen = false;
                        hoja.filtro = 'hechas';
                        hoja.pintar();
                    };
                });
            };
            pintarTabla();
        } catch (error) {
            zona.innerHTML = '<div class="vacio">' + escapar(error.message) + '</div>';
        }
    }

    async function pintarEnviadas() {
        if (hoja.resumen) { pintarResumen(); return; }
        cuerpo.innerHTML = '';
        barraFiltros();
        const botonResumen = document.createElement('button');
        botonResumen.className = 'filtro-tarea boton-resumen';
        botonResumen.textContent = '📊 Por persona';
        botonResumen.onclick = () => { hoja.resumen = true; pintarResumen(); };
        cuerpo.querySelector('.filtros-tareas').appendChild(botonResumen);
        // A la derecha de los filtros: las de una sola persona.
        const selector = document.createElement('select');
        selector.className = 'filtro-persona';
        const pintarPersonas = () => {
            selector.innerHTML = '<option value="">👤 Todas las personas</option>' +
                (hoja.personas || []).map((n) => '<option value="' + escapar(n) + '">' + escapar(n) + '</option>').join('');
            selector.value = hoja.persona || '';
        };
        pintarPersonas();
        selector.onchange = () => { hoja.persona = selector.value; pintarEnviadas(); };
        cuerpo.querySelector('.filtros-tareas').appendChild(selector);
        const lista = document.createElement('div');
        lista.innerHTML = '<div class="cargando"><span class="girando">◌</span></div>';
        cuerpo.appendChild(lista);
        const filtro = hoja.filtro;
        const persona = hoja.persona || '';
        const recargar = () => { if (hoja.pestana === 'enviadas') pintarEnviadas(); };
        const pagina = async (desde) => {
            const datos = await pedir('/api/personal/tareas/enviadas?filtro=' + encodeURIComponent(filtro) +
                                      '&persona=' + encodeURIComponent(persona) + '&desde=' + desde);
            if (hoja.pestana !== 'enviadas' || hoja.filtro !== filtro || (hoja.persona || '') !== persona) return;
            if (JSON.stringify(datos.personas || []) !== JSON.stringify(hoja.personas || [])) {
                hoja.personas = datos.personas || [];
                pintarPersonas();
            }
            if (!desde) lista.innerHTML = '';
            const viejo = lista.querySelector('.mostrar-mas');
            if (viejo) viejo.remove();
            if (!desde && !(datos.tareas || []).length) {
                lista.innerHTML = '<div class="vacio">' + (persona ? 'No hay tareas con ese filtro.' :
                    'No hay tareas en esta pestaña.') + '</div>';
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
        const imagenes = [];         // {archivo, vista}: el original va a Drive (2026-10-18)
        cuerpo.innerHTML =
            '<div class="campo"><label>Para</label><select class="t-para">' +
            (datos.todo_el_personal && (datos.todo_el_personal.personas || []).length ?
                '<option value="' + escapar(datos.todo_el_personal.valor) + '">' +
                escapar(datos.todo_el_personal.texto) + ' (' + datos.todo_el_personal.personas.length +
                ')</option>' : '') +
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
            imagenes.forEach((imagen, i) => {
                const envoltura = document.createElement('div');
                envoltura.className = 'quitar-img';
                envoltura.innerHTML = '<img alt=""><button title="Quitar">✕</button>';
                envoltura.querySelector('img').src = imagen.vista;
                envoltura.querySelector('img').onclick = () => abrirVisor(imagen.vista);
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
                try { imagenes.push({ archivo: archivo, vista: await comprimir(archivo) }); } catch (error) { avisar(error.message, 'malo'); }
            }
            pintarMinis();
        };
        $('.t-enviar').onclick = async () => {
            const boton = $('.t-enviar');
            boton.disabled = true;
            boton.textContent = 'Enviando…';
            try {
                const formulario = new FormData();
                formulario.append('asignada_a', $('.t-para').value);
                formulario.append('titulo', $('.t-titulo').value);
                formulario.append('descripcion', $('.t-desc').value);
                formulario.append('prioridad', $('.t-prioridad').value);
                formulario.append('vistas', JSON.stringify(imagenes.map((x) => x.vista)));
                imagenes.forEach((x) => formulario.append('fotos', x.archivo, x.archivo.name || 'foto.jpg'));
                const r = await pedirFormulario('/api/personal/tareas/nueva', formulario);
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
// EL DESCANSO DE LA SEMANA (cronograma)
// =======================================================================
/* Los siete días de la semana que se elige. info = `descanso` de /tareas
 * (o `eleccion` de /cronograma). alCambiar() se llama tras elegir. */
function tarjetaDescanso(info, alCambiar) {
    const caja = document.createElement('div');
    caja.className = 'tarea tarjeta-descanso' + (info.elegido == null ? ' por-elegir' : '');
    const nombre = (d) => (info.dias[d] || {}).nombre || '';
    const pie = info.elegido != null
        ? 'Descansas el <b>' + escapar(nombre(info.elegido).toLowerCase()) + '</b>. Puedes cambiarlo hasta ' + escapar(info.cierra_texto) + '.'
        : 'Si no eliges antes de ' + escapar(info.cierra_texto) + ' se queda el de esta semana' +
          (info.anterior != null ? ' (' + escapar(nombre(info.anterior).toLowerCase()) + ')' : '') + '.';
    caja.innerHTML =
        '<div class="titulo-seccion">🗓️ Tu día de descanso · semana ' + escapar(info.etiqueta) + '</div>' +
        '<div class="dias-descanso">' + info.dias.map((d) =>
            '<button type="button" class="dia-descanso' + (d.dia === info.elegido ? ' elegido' : '') + '"' +
            (d.libre ? '' : ' disabled title="' + escapar(d.motivo) + '"') + ' data-dia="' + d.dia + '">' +
            '<span>' + escapar(d.nombre.slice(0, 3)) + '</span><small>' + escapar(d.fecha || '') + '</small></button>').join('') +
        '</div><div class="pie-descanso">' + pie + '</div>';
    caja.querySelectorAll('.dia-descanso').forEach((b) => {
        b.onclick = async () => {
            const dia = Number(b.dataset.dia);
            if (dia === info.elegido) return;
            if (!confirm('¿Descansar el ' + nombre(dia).toLowerCase() + ' (' + (info.dias[dia].fecha || '') + ')?')) return;
            caja.querySelectorAll('button').forEach((x) => { x.disabled = true; });
            try {
                const r = await pedir('/api/personal/cronograma/elegir', 'POST', { dia: dia });
                avisar(r.mensaje, 'bueno');
            } catch (error) { avisar(error.message, 'malo'); }
            if (alCambiar) alCambiar();
        };
    });
    return caja;
}

/* «📝 Actualiza tus datos» arriba de «Para mí» mientras le falte alguno. */
function tarjetaMisDatos(alGuardar) {
    const caja = document.createElement('div');
    caja.className = 'tarea tarjeta-descanso por-elegir';
    caja.innerHTML =
        '<div class="titulo-seccion">📝 Actualiza tus datos</div>' +
        '<div class="pie-descanso">Déjanos tu nombre, apellido, teléfono y tu correo de Gmail ' +
        '(con ese te invitamos a las reuniones de Meet).</div>' +
        '<button class="boton-principal" style="margin-top:10px">Actualizar mis datos</button>';
    caja.querySelector('button').onclick = () => abrirMisDatos(alGuardar);
    return caja;
}

/* El formulario de los datos del personal (el mismo de las modelos, más corto). */
async function abrirMisDatos(alGuardar) {
    let datos;
    try { datos = await pedir('/api/personal/mis-datos'); } catch (error) { avisar(error.message, 'malo'); return; }
    const dominio = datos.dominio || 'gmail.com';
    const capa = document.createElement('div');
    capa.className = 'capa-conversacion';
    capa.innerHTML = '<div class="velo"></div><div class="hoja">' +
        '<div class="hoja-cabecera"><h3>📝 Actualiza tus datos</h3><button class="cerrar" title="Cerrar">✕</button></div>' +
        '<div class="hoja-cuerpo">' +
        '<div class="campo"><label>Nombres</label><input class="d-nombres" maxlength="40" autocomplete="given-name"></div>' +
        '<div class="campo"><label>Apellidos</label><input class="d-apellidos" maxlength="40" autocomplete="family-name"></div>' +
        '<div class="campo"><label>Teléfono</label><input class="d-telefono" maxlength="20" inputmode="tel" autocomplete="tel" placeholder="3001234567"></div>' +
        '<div class="campo"><label>Correo de Gmail</label><input class="d-correo" maxlength="120" type="email" inputmode="email" autocomplete="email" placeholder="tucorreo@' + escapar(dominio) + '"></div>' +
        '<button class="boton-principal guardar-datos">Guardar</button></div></div>';
    document.getElementById('capas-personal').appendChild(capa);
    const campo = (nombre) => capa.querySelector('.d-' + nombre);
    ['nombres', 'apellidos', 'telefono', 'correo'].forEach((n) => { campo(n).value = datos[n] || ''; });
    const cerrar = () => capa.remove();
    capa.querySelector('.velo').onclick = cerrar;
    capa.querySelector('.cerrar').onclick = cerrar;
    capa.querySelector('.guardar-datos').onclick = async (e) => {
        const cuerpo = {
            nombres: campo('nombres').value.trim(), apellidos: campo('apellidos').value.trim(),
            telefono: campo('telefono').value.trim(), correo: campo('correo').value.trim().toLowerCase(),
        };
        if (!cuerpo.nombres || !cuerpo.apellidos || !cuerpo.telefono || !cuerpo.correo) {
            avisar('Llena los cuatro datos.', 'malo'); return;
        }
        if (!cuerpo.correo.endsWith('@' + dominio)) { avisar('Usa un correo @' + dominio + '.', 'malo'); return; }
        e.target.disabled = true;
        try {
            const r = await pedir('/api/personal/mis-datos', 'POST', cuerpo);
            avisar(r.mensaje, 'bueno');
            cerrar();
            if (alGuardar) alGuardar();
        } catch (error) { avisar(error.message, 'malo'); e.target.disabled = false; }
    };
}

/* Una actividad del cronograma (campana e INICIO). */
function tarjetaActividad(a) {
    const caja = document.createElement('div');
    caja.className = 'tarea tarjeta-actividad' + (actividadSuena(a) ? ' por-elegir' : '');
    caja.style.borderLeft = '4px solid ' + (a.color || 'var(--cian)');
    const sello = a.movida ? 'Se movió' : a.pronto ? 'Empieza pronto' : a.nuevo ? 'Nueva' : '';
    caja.innerHTML =
        '<div style="display:flex;gap:8px;align-items:center"><b style="flex:1">' + escapar(a.icono + ' ' + a.titulo) + '</b>' +
        (sello ? '<span class="pildora urgente">' + sello + '</span>' : '') + '</div>' +
        '<div class="pie-descanso">' + escapar(a.texto_tipo + ' · ' + a.cuando) +
        (a.tipo === 'modelos' || a.tipo === 'privada' ? ' · ' + escapar(a.responsable) + ' con ' + escapar(a.modelo) : '') + '</div>' +
        (a.movida ? '<div class="pie-descanso" style="color:var(--ambar)">' + escapar(a.movida) + '</div>' : '') +
        (a.descripcion ? '<div class="pie-descanso">' + escapar(a.descripcion) + '</div>' : '') +
        (a.meet ? '<div class="botones" style="margin-top:8px"><a class="boton-secundario" target="_blank" rel="noopener" href="' +
            escapar(a.meet) + '">🎥 Entrar a la reunión</a></div>' : '');
    return caja;
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
        PARADISE.olvidar(CLAVE_TOKEN);
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
    const visibles = MODULOS.filter((m) => permitidos.indexOf(m.id) >= 0);
    // Con 6 o 7 botones la letra se achica para que quepan en un teléfono.
    nav.dataset.botones = visibles.length;
    nav.innerHTML = visibles.map((m) =>
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
        } else {
            recordarTareas();
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
    abrirCampana: abrirCampana, abrirTiposSolicitud: abrirTiposSolicitud, globoChat: globoChat, guardarFicha: guardarFicha, ficha: ficha,
    tarjetaTarea: tarjetaTarea, revisarTareas: revisarTareas, tarjetaDescanso: tarjetaDescanso,
    tarjetaActividad: tarjetaActividad, actividades: () => campana.actividades,
    tareas: () => campana.tareas, CLAVE_TOKEN: CLAVE_TOKEN,
};
})();
