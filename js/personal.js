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
 */

(function () {
'use strict';

const API = PARADISE.API_URL;
const CLAVE_TOKEN = 'token_personal';
const CLAVE_FICHA = 'ficha_personal';
const CADA_MS_TAREAS = 30000;
const TOPE_IMAGEN = 880000;          // base64; la API acepta 900 000
const MAX_IMAGENES = 6;

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
    conocidas: null,                 // ids ya vistos (para pitar solo por las nuevas)
    reloj: null,
    abierta: null,                   // la hoja, si está abierta
};

function pintarGlobo() {
    const globo = document.getElementById('globo-tareas');
    if (!globo) return;
    const n = campana.tareas.filter((t) => !t.leida).length;
    globo.textContent = n > 99 ? '99+' : String(n);
    globo.classList.toggle('oculto', !n);
    document.dispatchEvent(new CustomEvent('personal:tareas', { detail: campana.tareas }));
}

async function revisarTareas(forzar) {
    if (forzar !== true && document.visibilityState !== 'visible') return;
    try {
        const datos = await pedir('/api/personal/tareas');
        campana.tareas = datos.tareas || [];
        const ids = new Set(campana.tareas.map((t) => t.id));
        if (campana.conocidas) {
            const nuevas = campana.tareas.filter((t) => !campana.conocidas.has(t.id) && !t.leida);
            if (nuevas.length) {
                pitar();
                avisar('🔔 Tarea nueva: ' + nuevas[0].titulo);
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
    return estado === 'hecha' ? 'bien' : estado === 'en curso' ? 'cian' : '';
}

function tarjetaTarea(t, recibida, alCambiar) {
    const caja = document.createElement('div');
    caja.className = 'tarea' + (recibida && !t.leida ? ' nueva' : '');
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
    if (recibida && t.abierta) {
        if (t.estado !== 'en curso') boton('▶ En curso', () => cambiar('en curso'));
        if (t.ticket) boton('💬 Responder', async () => responderTicket(caja, t, alCambiar));
        else boton('✓ Hecha', () => cambiar('hecha'));
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
        pintar() {
            capas.querySelectorAll('.pestana').forEach((b) => b.classList.toggle('activa', b.dataset.p === hoja.pestana));
            if (hoja.pestana === 'recibidas') pintarRecibidas();
            else if (hoja.pestana === 'enviadas') pintarEnviadas();
            else pintarNueva();
        },
    };
    campana.abierta = hoja;
    capas.querySelectorAll('.pestana').forEach((b) => { b.onclick = () => { hoja.pestana = b.dataset.p; hoja.pintar(); }; });

    function pintarRecibidas() {
        cuerpo.innerHTML = '';
        if (!campana.tareas.length) {
            cuerpo.innerHTML = '<div class="vacio">No tienes tareas pendientes. 🎉</div>';
            return;
        }
        campana.tareas.forEach((t) => cuerpo.appendChild(tarjetaTarea(t, true, () => revisarTareas(true))));
        // Al abrir la campana se dan por leídas (como el escritorio).
        const sinLeer = campana.tareas.filter((t) => !t.leida).map((t) => t.id);
        if (sinLeer.length) {
            pedir('/api/personal/tareas/leidas', 'POST', { ids: sinLeer }).then(() => {
                campana.tareas.forEach((t) => { if (sinLeer.indexOf(t.id) >= 0) t.leida = true; });
                pintarGlobo();
            }).catch(() => {});
        }
    }

    async function pintarEnviadas() {
        cuerpo.innerHTML = '<div class="cargando"><span class="girando">◌</span></div>';
        try {
            const datos = await pedir('/api/personal/tareas/enviadas');
            if (hoja.pestana !== 'enviadas') return;
            cuerpo.innerHTML = '';
            if (!(datos.tareas || []).length) {
                cuerpo.innerHTML = '<div class="vacio">Todavía no has asignado tareas.</div>';
                return;
            }
            datos.tareas.forEach((t) => cuerpo.appendChild(tarjetaTarea(t, false, pintarEnviadas)));
        } catch (error) {
            cuerpo.innerHTML = '<div class="vacio">' + escapar(error.message) + '</div>';
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
    escapar: escapar, abrirVisor: abrirVisor, aDataUrl: aDataUrl, comprimir: comprimir,
    abrirCampana: abrirCampana, globoChat: globoChat, guardarFicha: guardarFicha, ficha: ficha,
    tarjetaTarea: tarjetaTarea, revisarTareas: revisarTareas,
    tareas: () => campana.tareas, CLAVE_TOKEN: CLAVE_TOKEN,
};
})();
