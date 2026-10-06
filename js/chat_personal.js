/* ===========================================================================
 * PARADISE · Chat del personal administrativo (personal_chat.html)
 * ===========================================================================
 *
 * La otra punta del chat de las modelos (js/chat.js): la misma conversación
 * `Chats/{cedula}/Mensajes` que el escritorio del monitor, vista desde el
 * personal. Dos pantallas:
 *
 *   LISTA          la última línea de cada chat que le toca, los que esperan
 *                  respuesta arriba con un punto; «Escribir a una modelo».
 *   CONVERSACIÓN   los mensajes que le tocan de ESA modelo y la caja para
 *                  responder, con «Responder en:» si atiende varios canales.
 *
 * QUÉ CHATS LE TOCAN lo decide la API con las reglas del escritorio (rol,
 * segundo rol, jornada, Tropic). Aquí no se filtra nada: lo que no le toca
 * no llega.
 *
 * «EN TIEMPO REAL»: cada 5 s, solo con la página a la vista, se pregunta qué
 * llegó después (`/api/personal/chat/nuevos`), para todas sus conversaciones
 * a la vez. Si no llegó nada cuesta una lectura.
 *
 * ADJUNTOS (js/adjuntos.js, el mismo menú de las modelos): 📎 Galería (fotos
 * y videos), Cámara y Documento (PDF), y 🎤 nota de voz en WAV.
 *   · A una modelo: la foto va en base64 dentro del mensaje (el .exe de la
 *     modelo solo pinta esa); la nota de voz, el video y el PDF van a la
 *     carpeta de Drive de la modelo, como los que manda ella.
 *   · En el chat privado: TODO va a Drive, a «Chat Personal PARADISE», y se
 *     baja a través de la API.
 *
 * CHAT PRIVADO ENTRE EL PERSONAL: arriba de la lista, una fila con cada
 * persona de Configuracion/Monitores (menos él). Abre una conversación uno a
 * uno en la misma pantalla de conversación, sin «Responder en:». Va aparte de
 * los chats de las modelos (`/api/personal/privado`) y solo la leen los dos.
 * En la misma vuelta de 5 s se pregunta por el buzón (una lectura); sus no
 * leídos suman al globo de la barra.
 */

(function () {
'use strict';

const P = window.Personal;
const esc = P.escapar;
const CADA_MS = 5000;
const TOPE_FOTO = 650000;            // base64; la API acepta 700 000
const A = window.Adjuntos;

function etiquetaDia(fecha) {
    if (!fecha) return '';
    const hoy = new Date();
    const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    if (fecha === iso(hoy)) return 'Hoy';
    if (fecha === iso(new Date(hoy.getTime() - 86400000))) return 'Ayer';
    const [a, m, d] = fecha.split('-');
    return d + '/' + m + '/' + a;
}

function resumenDe(m) {
    if (m.texto) return m.texto;
    if (m.imagen) return '🖼️ Foto';
    if (m.adjunto) return A.resumen(m.adjunto);
    return '';
}

/* Subida con barra de progreso: fetch no la da, XMLHttpRequest sí. */
function subir(ruta, formulario, alAvanzar) {
    let xhr = null;
    const promesa = new Promise((resolver, rechazar) => {
        xhr = new XMLHttpRequest();
        xhr.open('POST', PARADISE.API_URL + ruta);
        xhr.setRequestHeader('Authorization', 'Bearer ' + (localStorage.getItem(P.CLAVE_TOKEN) || ''));
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) alAvanzar(e.loaded / e.total); };
        xhr.onload = () => {
            let datos = {};
            try { datos = JSON.parse(xhr.responseText); } catch (e) { datos = {}; }
            if (xhr.status >= 200 && xhr.status < 300) resolver(datos);
            else rechazar(new Error(xhr.status === 401 ? 'Tu sesión caducó. Entra otra vez.'
                                    : datos.detail || 'No se pudo enviar el archivo.'));
        };
        xhr.onerror = () => rechazar(new Error('Se cortó la conexión. Inténtalo otra vez.'));
        xhr.onabort = () => rechazar(new Error('cancelado'));
        xhr.send(formulario);
    });
    promesa.cancelar = () => xhr && xhr.abort();
    return promesa;
}

function montar(raiz) {
    const estado = {
        conversaciones: {},          // cedula -> {cedula, nombre, jornada, ultimo, esperando}
        abierta: null,               // {cedula, nombre, jornada, mensajes, canales, canal}
                                     // o {privado: true, persona, nombre, mensajes, cursor, ts}
        equipo: null,                // [{nombre, roles, sin_leer, ultimo, ultimo_de, ts}]
        vistos: new Set(),
        cursor: '',
        preguntando: false,
        filtro: '',
        fotoPendiente: '',           // base64, para una modelo
        fotoArchivo: null,           // File, para el chat privado (va a Drive)
        subida: null,
        fotos: {},
        medios: {},
    };

    raiz.innerHTML =
        '<section class="vista-lista">' +
        '  <div class="titulo-pagina"><h1>Chat</h1><p>Los chats que le llegan a tu rol.</p></div>' +
        '  <div class="equipo">' +
        '    <div class="equipo-rotulo">🔒 Chat privado con el personal</div>' +
        '    <div class="fila-equipo"><span class="equipo-vacio">Cargando…</span></div>' +
        '  </div>' +
        '  <div class="botones" style="margin-bottom:12px">' +
        '    <input class="buscador" placeholder="Buscar modelo…">' +
        '    <button class="boton-secundario btn-nueva">✏️ Escribir a una modelo</button>' +
        '  </div>' +
        '  <div class="tarjeta lista-conv"><div class="vacio">Cargando…</div></div>' +
        '</section>' +
        '<section class="vista-conv oculto">' +
        '  <div class="cabeza-conv">' +
        '    <button class="redondo btn-volver" title="Volver">←</button>' +
        '    <div class="quien-conv"><div class="nombre"></div><div class="jornada"></div></div>' +
        '  </div>' +
        '  <div class="chat-lista"></div>' +
        '  <div class="chat-pie">' +
        '    <div class="chat-previa"></div>' +
        '    <div class="fila-canal"><span>Responder en:</span><select class="sel-canal"></select></div>' +
        '    <div class="chat-barra">' +
        '      <button class="chat-clip" title="Adjuntar">📎</button>' +
        '      <textarea class="chat-texto" rows="1" maxlength="2000" placeholder="Escribe un mensaje…"></textarea>' +
        '      <button class="chat-mic" title="Grabar nota de voz">🎤</button>' +
        '      <button class="chat-enviar oculto" title="Enviar">➤</button>' +
        '    </div>' + A.BARRA_GRABANDO +
        '  </div>' +
        '</section>';

    const el = (s) => raiz.querySelector(s);
    const caja = el('.chat-texto');

    // ------------------------------------------------------------- el globo
    function actualizarGlobo() {
        P.globoChat(Object.values(estado.conversaciones).filter((c) => c.esperando).length +
                    (estado.equipo || []).filter((p) => p.sin_leer).length);
    }

    // ------------------------------------------------- la fila del personal
    function iniciales(nombre) {
        const partes = String(nombre || '').trim().split(/\s+/);
        return ((partes[0] || '')[0] || '?').toUpperCase() + ((partes[1] || '')[0] || '').toUpperCase();
    }

    function pintarEquipo() {
        const fila = el('.fila-equipo');
        if (!estado.equipo) return;
        if (!estado.equipo.length) {
            fila.innerHTML = '<span class="equipo-vacio">No hay más personas en el personal.</span>';
            return;
        }
        // Los que tienen algo sin leer, primero; luego por nombre.
        const lista = estado.equipo.slice().sort((a, b) =>
            (b.sin_leer ? 1 : 0) - (a.sin_leer ? 1 : 0) || a.nombre.localeCompare(b.nombre, 'es'));
        const abierta = estado.abierta && estado.abierta.privado ? estado.abierta.persona : '';
        fila.innerHTML = lista.map((p) =>
            '<button class="persona' + (p.nombre === abierta ? ' activa' : '') + '" data-nombre="' + esc(p.nombre) +
            '" title="' + esc(p.nombre + ' · ' + p.roles) + '">' +
            '<span class="avatar">' + esc(iniciales(p.nombre)) +
            (p.sin_leer ? '<span class="globo">' + (p.sin_leer > 9 ? '9+' : p.sin_leer) + '</span>' : '') + '</span>' +
            '<span class="nombre-persona">' + esc(p.nombre.split(' ')[0]) + '</span></button>'
        ).join('');
        fila.querySelectorAll('.persona').forEach((b) => { b.onclick = () => abrirPrivado(b.dataset.nombre, true); });
    }

    async function cargarEquipo() {
        try {
            const datos = await P.pedir('/api/personal/privado');
            estado.equipo = datos.personas || [];
            pintarEquipo();
            actualizarGlobo();
        } catch (error) {
            if (!estado.equipo) el('.fila-equipo').innerHTML = '<span class="equipo-vacio">' + esc(error.message) + '</span>';
        }
    }

    // ----------------------------------------------------------------- LISTA
    function pintarLista() {
        const contenedor = el('.lista-conv');
        const filtro = estado.filtro.toLowerCase();
        const lista = Object.values(estado.conversaciones)
            .filter((c) => !filtro || c.nombre.toLowerCase().indexOf(filtro) >= 0)
            .sort((a, b) => (b.ultimo.ts || '9') > (a.ultimo.ts || '9') ? 1 : -1);
        actualizarGlobo();
        if (!lista.length) {
            contenedor.innerHTML = '<div class="vacio">' + (filtro ? 'Ninguna conversación con ese nombre.'
                : 'Todavía no hay chats para tu rol. Cuando una modelo te escriba, aparece aquí.') + '</div>';
            return;
        }
        contenedor.innerHTML = lista.map((c) =>
            '<div class="fila conv" data-cedula="' + esc(c.cedula) + '">' +
            '<span class="punto' + (c.esperando ? ' encendido' : '') + '"></span>' +
            '<div class="principal"><div class="linea1">' + esc(c.nombre) +
            (c.jornada ? ' <span class="pildora">' + esc(c.jornada) + '</span>' : '') + '</div>' +
            '<div class="linea2">' + (c.ultimo.de_modelo ? '' : esc(c.ultimo.autor || 'Monitor') + ': ') +
            (c.ultimo.canal && c.ultimo.canal !== 'Soporte' ? '[' + esc(c.ultimo.canal) + '] ' : '') +
            esc(resumenDe(c.ultimo)) + '</div></div>' +
            '<div class="lado">' + esc(c.ultimo.fecha ? (etiquetaDia(c.ultimo.fecha) === 'Hoy' ? c.ultimo.hora : etiquetaDia(c.ultimo.fecha)) : '') + '</div></div>'
        ).join('');
        contenedor.querySelectorAll('.conv').forEach((f) => { f.onclick = () => abrir(f.dataset.cedula, true); });
    }

    async function cargarLista() {
        try {
            const datos = await P.pedir('/api/personal/chat/conversaciones?limite=300');
            (datos.conversaciones || []).forEach((c) => {
                estado.conversaciones[c.cedula] = c;
                estado.vistos.add(c.ultimo.id);
            });
            if (!estado.cursor) estado.cursor = datos.cursor;
            pintarLista();
        } catch (error) {
            el('.lista-conv').innerHTML = '<div class="vacio">No se pudo abrir el chat.<br><small>' +
                esc(error.message) + '</small></div>';
        }
    }

    async function elegirModelo() {
        const capas = document.getElementById('capas-personal');
        capas.innerHTML = '<div class="velo"></div><div class="hoja"><div class="hoja-cabecera">' +
            '<h3>Escribir a una modelo</h3><button class="cerrar">✕</button></div>' +
            '<div class="hoja-cuerpo"><div class="campo"><input class="buscar-modelo" placeholder="Buscar…"></div>' +
            '<div class="lista-modelos"><div class="cargando"><span class="girando">◌</span></div></div></div></div>';
        const cerrar = () => { capas.innerHTML = ''; };
        capas.querySelector('.velo').onclick = cerrar;
        capas.querySelector('.cerrar').onclick = cerrar;
        let modelos = [];
        const pintar = () => {
            const f = capas.querySelector('.buscar-modelo').value.toLowerCase();
            const lista = modelos.filter((m) => !f || m.nombre.toLowerCase().indexOf(f) >= 0);
            capas.querySelector('.lista-modelos').innerHTML = lista.length ? lista.map((m) =>
                '<div class="fila conv" data-cedula="' + esc(m.cedula) + '"><div class="principal"><div class="linea1">' +
                esc(m.nombre) + '</div><div class="linea2">' + esc(m.jornada) + '</div></div></div>').join('')
                : '<div class="vacio">Ninguna modelo.</div>';
            capas.querySelectorAll('.conv').forEach((fila) => {
                fila.onclick = () => { cerrar(); abrir(fila.dataset.cedula, true); };
            });
        };
        capas.querySelector('.buscar-modelo').oninput = pintar;
        try {
            modelos = (await P.pedir('/api/personal/chat/modelos')).modelos || [];
            pintar();
        } catch (error) {
            capas.querySelector('.lista-modelos').innerHTML = '<div class="vacio">' + esc(error.message) + '</div>';
        }
    }

    // ---------------------------------------------------------- CONVERSACIÓN
    function mostrar(vista) {
        el('.vista-lista').classList.toggle('oculto', vista !== 'lista');
        el('.vista-conv').classList.toggle('oculto', vista !== 'conv');
        document.body.classList.toggle('en-conversacion', vista === 'conv');
    }

    function volver() {
        nota.cancelar();
        estado.abierta = null;
        quitarPrevia();
        mostrar('lista');
        pintarLista();
        pintarEquipo();
        window.scrollTo({ top: 0 });
    }

    async function abrir(cedula, guardarHistorial) {
        if (guardarHistorial) history.pushState({ cedula: cedula }, '', '?cedula=' + encodeURIComponent(cedula));
        estado.desdeLista = !!guardarHistorial;
        quitarPrevia();
        const conocida = estado.conversaciones[cedula];
        estado.abierta = { cedula: cedula, nombre: conocida ? conocida.nombre : '', mensajes: [], canales: [] };
        el('.quien-conv .nombre').textContent = conocida ? conocida.nombre : 'Cargando…';
        el('.quien-conv .jornada').textContent = conocida ? conocida.jornada : '';
        el('.vista-conv .chat-lista').innerHTML = '<div class="chat-vacio">Cargando…</div>';
        mostrar('conv');
        try {
            const datos = await P.pedir('/api/personal/chat/' + encodeURIComponent(cedula));
            if (!estado.abierta || estado.abierta.cedula !== cedula) return;
            estado.abierta = {
                cedula: cedula, nombre: datos.nombre, jornada: datos.jornada,
                mensajes: datos.mensajes || [], canales: datos.canales || [],
            };
            (datos.mensajes || []).forEach((m) => estado.vistos.add(m.id));
            if (!estado.cursor) estado.cursor = datos.cursor;
            el('.quien-conv .nombre').textContent = datos.nombre;
            el('.quien-conv .jornada').textContent = datos.jornada || '';
            const sel = el('.sel-canal');
            sel.innerHTML = estado.abierta.canales.map((c) =>
                '<option value="' + esc(c.id) + '">' + esc(c.nombre) + '</option>').join('');
            sel.value = datos.canal_sugerido || (estado.abierta.canales[0] || {}).id || '';
            el('.fila-canal').classList.toggle('oculto', estado.abierta.canales.length < 2);
            const puede = estado.abierta.canales.length > 0;
            el('.chat-barra').classList.toggle('oculto', !puede);
            pintarConversacion(true);
        } catch (error) {
            el('.vista-conv .chat-lista').innerHTML = '<div class="chat-vacio">' + esc(error.message) + '</div>';
        }
    }

    function personaDel(nombre) {
        return (estado.equipo || []).find((p) => p.nombre === nombre);
    }

    async function abrirPrivado(nombre, guardarHistorial) {
        if (guardarHistorial) history.pushState({ persona: nombre }, '', '?persona=' + encodeURIComponent(nombre));
        estado.desdeLista = !!guardarHistorial;
        quitarPrevia();
        const persona = personaDel(nombre);
        const conv = { privado: true, persona: nombre, nombre: nombre, mensajes: [], cursor: '',
                       ts: persona ? persona.ts : '' };
        estado.abierta = conv;
        el('.quien-conv .nombre').textContent = nombre;
        el('.quien-conv .jornada').textContent = '🔒 Privado · ' + (persona ? persona.roles : '');
        el('.vista-conv .chat-lista').innerHTML = '<div class="chat-vacio">Cargando…</div>';
        el('.fila-canal').classList.add('oculto');
        el('.chat-barra').classList.remove('oculto');
        mostrar('conv');
        try {
            const datos = await P.pedir('/api/personal/privado/' + encodeURIComponent(nombre));
            if (estado.abierta !== conv) return;
            conv.persona = conv.nombre = datos.nombre;
            conv.mensajes = datos.mensajes || [];
            conv.cursor = datos.cursor;
            conv.mensajes.forEach((m) => estado.vistos.add(m.id));
            el('.quien-conv .nombre').textContent = datos.nombre;
            const leida = personaDel(datos.nombre);
            if (leida) { leida.sin_leer = 0; actualizarGlobo(); }
            pintarConversacion(true);
        } catch (error) {
            if (estado.abierta === conv) {
                el('.vista-conv .chat-lista').innerHTML = '<div class="chat-vacio">' + esc(error.message) + '</div>';
            }
        }
    }

    /* Lo nuevo del chat privado abierto, si su buzón dice que cambió. */
    async function traerPrivado() {
        const conv = estado.abierta;
        const persona = personaDel(conv.persona);
        if (!persona || !conv.cursor || persona.ts === conv.ts) return;
        const datos = await P.pedir('/api/personal/privado/' + encodeURIComponent(conv.persona) +
                                    '?desde=' + encodeURIComponent(conv.cursor));
        if (estado.abierta !== conv) return;
        conv.ts = persona.ts;
        conv.cursor = datos.cursor || conv.cursor;
        persona.sin_leer = 0;
        let hay = false;
        (datos.mensajes || []).forEach((m) => {
            if (estado.vistos.has(m.id)) return;
            estado.vistos.add(m.id);
            conv.mensajes.push(m);
            hay = true;
        });
        if (hay) {
            const cerca = window.innerHeight + window.scrollY >= document.body.scrollHeight - 160;
            pintarConversacion(cerca);
        }
    }

    function pintarConversacion(bajar) {
        const lista = el('.vista-conv .chat-lista');
        const mensajes = estado.abierta.mensajes.slice().sort((a, b) => (a.ts || '9') < (b.ts || '9') ? -1 : 1);
        if (!mensajes.length) {
            lista.innerHTML = '<div class="chat-vacio">' + (estado.abierta.privado
                ? 'Todavía no se han escrito. Lo que escribas aquí solo lo ven tú y ' + esc(estado.abierta.nombre) + '.'
                : 'Todavía no hay mensajes que te toquen con ' + esc(estado.abierta.nombre) +
                  '. Escribe y le llega en su chat.') + '</div>';
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
        if (bajar) requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight }));
    }

    function burbuja(m) {
        const fila = document.createElement('div');
        // La modelo a la izquierda; el personal (quien sea) a la derecha.
        // En el chat privado: el otro a la izquierda, él a la derecha.
        const privado = !!(estado.abierta && estado.abierta.privado);
        const izquierda = privado ? !m.mio : m.de_modelo;
        fila.className = 'chat-msg ' + (izquierda ? 'suyo' : 'mio') + (m.enviando ? ' enviando' : '');
        const globo = document.createElement('div');
        globo.className = 'chat-burbuja';
        const cabeza = privado ? '' : m.de_modelo ? (m.canal !== 'Soporte' ? 'Para ' + m.canal : '')
            : (m.mio ? '' : (m.autor || 'Monitor')) + (m.canal !== 'Soporte' ? (m.mio ? '' : ' · ') + m.canal : '');
        if (cabeza) {
            const autor = document.createElement('div');
            autor.className = 'chat-autor';
            autor.textContent = cabeza;
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
            img.onclick = () => P.abrirVisor(local);
            return img;
        }
        const hueco = document.createElement('div');
        hueco.className = 'chat-foto-cargando';
        const ruta = m.cedula ? '/api/personal/chat/' + encodeURIComponent(m.cedula)
            : '/api/personal/privado/' + encodeURIComponent(m.persona || estado.abierta.persona);
        P.pedir(ruta + '/imagen/' + encodeURIComponent(m.id))
            .then((datos) => {
                if (!datos.imagen) { hueco.remove(); return; }
                estado.fotos[m.id] = P.aDataUrl(datos.imagen);
                hueco.replaceWith(foto(m));
            }).catch(() => { hueco.textContent = '🖼️'; });
        return hueco;
    }

    function medio(m) {
        const ruta = m.cedula ? '/api/personal/chat/' + encodeURIComponent(m.cedula)
            : '/api/personal/privado/' + encodeURIComponent(m.persona || estado.abierta.persona);
        return A.pintar(m, {
            ruta: ruta + '/adjunto/' + encodeURIComponent(m.id), bajar: P.pedirArchivo,
            cache: estado.medios, avisar: P.avisar, abrirVisor: P.abrirVisor,
        });
    }

    // -------------------------------------------------------- lo que llega
    function registrar(m) {
        if (estado.vistos.has(m.id)) return false;
        estado.vistos.add(m.id);
        const previa = estado.conversaciones[m.cedula];
        if (!previa || (m.ts || '9') >= (previa.ultimo.ts || '')) {
            estado.conversaciones[m.cedula] = {
                cedula: m.cedula, nombre: m.nombre, jornada: previa ? previa.jornada : '',
                ultimo: m, esperando: m.de_modelo,
            };
        }
        if (estado.abierta && estado.abierta.cedula === m.cedula) estado.abierta.mensajes.push(m);
        return true;
    }

    async function preguntar() {
        if (estado.preguntando || !estado.cursor || document.visibilityState !== 'visible') return;
        estado.preguntando = true;
        try {
            // El chat privado: el buzón (una lectura) y, si cambió el abierto, lo suyo.
            const antes = {};
            (estado.equipo || []).forEach((p) => { antes[p.nombre] = p.sin_leer; });
            await cargarEquipo();
            if (estado.abierta && estado.abierta.privado) {
                await traerPrivado().catch(() => {});
                actualizarGlobo();
            }
            const otroPrivado = (estado.equipo || []).some((p) => p.sin_leer > (antes[p.nombre] || 0) &&
                !(estado.abierta && estado.abierta.privado && estado.abierta.persona === p.nombre));
            if (otroPrivado && estado.abierta) P.avisar('🔒 Mensaje privado nuevo.');

            const datos = await P.pedir('/api/personal/chat/nuevos?desde=' + encodeURIComponent(estado.cursor));
            estado.cursor = datos.cursor || estado.cursor;
            let aqui = false, otros = false;
            (datos.mensajes || []).forEach((m) => {
                if (!registrar(m)) return;
                if (estado.abierta && estado.abierta.cedula === m.cedula) aqui = true;
                else if (m.de_modelo) otros = true;
            });
            if (aqui) {
                const cerca = window.innerHeight + window.scrollY >= document.body.scrollHeight - 160;
                pintarConversacion(cerca);
            }
            if (!estado.abierta) pintarLista();
            else actualizarGlobo();
            if (otros && estado.abierta) P.avisar('💬 Mensaje nuevo en otro chat.');
        } catch (error) {
            // Sin red un momento: se intenta en la siguiente vuelta.
        } finally {
            estado.preguntando = false;
        }
    }

    // --------------------------------------------------------------- enviar
    function ajustarAltura() {
        caja.style.height = 'auto';
        caja.style.height = Math.min(caja.scrollHeight, 120) + 'px';
    }

    function actualizarBotones() {
        const hayAlgo = !!caja.value.trim() || !!estado.fotoPendiente || !!estado.fotoArchivo;
        el('.chat-enviar').classList.toggle('oculto', !hayAlgo);
        el('.chat-mic').classList.toggle('oculto', hayAlgo);
    }

    function quitarPrevia() {
        estado.fotoPendiente = '';
        estado.fotoArchivo = null;
        if (!estado.subida) el('.chat-previa').innerHTML = '';
        actualizarBotones();
    }

    /* Lo que acaba de mandar, ya con su id de verdad. */
    function confirmar(conv, provisional, real) {
        const i = conv.mensajes.indexOf(provisional);
        if (estado.vistos.has(real.id)) { if (i >= 0) conv.mensajes.splice(i, 1); } else {
            estado.vistos.add(real.id);
            if (provisional.fotoLocal) estado.fotos[real.id] = provisional.fotoLocal;
            if (provisional.medioLocal) estado.medios[real.id] = provisional.medioLocal;
            if (i >= 0) conv.mensajes[i] = real; else conv.mensajes.push(real);
        }
        if (!conv.privado) {
            estado.conversaciones[conv.cedula] = {
                cedula: conv.cedula, nombre: conv.nombre, jornada: conv.jornada, ultimo: real, esperando: false,
            };
            actualizarGlobo();
        }
        if (estado.abierta === conv) pintarConversacion(true);
    }

    function descartar(conv, provisional) {
        const i = conv.mensajes.indexOf(provisional);
        if (i >= 0) conv.mensajes.splice(i, 1);
        if (estado.abierta === conv) pintarConversacion(false);
    }

    /* Nota de voz, video, PDF (y, en el chat privado, la foto): por la API a Drive. */
    function enviarArchivo(archivo, tipo, nombre, segundos) {
        const conv = estado.abierta;
        if (!conv) return;
        const texto = caja.value.trim();
        caja.value = '';
        ajustarAltura();
        const canal = conv.privado ? '' : el('.sel-canal').value;
        const urlLocal = URL.createObjectURL(archivo);
        const provisional = {
            id: 'local-' + Date.now(), cedula: conv.cedula, de: '', de_modelo: false, mio: true, autor: '',
            canal_id: canal, canal: conv.privado ? '' : (conv.canales.find((c) => c.id === canal) || {}).nombre || 'Soporte',
            texto: texto, imagen: false, medioLocal: urlLocal, enviando: true, ts: '', hora: '', fecha: '',
            adjunto: { tipo: tipo, bytes: archivo.size, segundos: segundos || 0,
                       titulo: tipo === 'pdf' ? (archivo.name || '').replace(/\.pdf$/i, '') : '' },
        };
        conv.mensajes.push(provisional);
        pintarConversacion(true);

        const formulario = new FormData();
        if (canal) formulario.append('canal', canal);
        formulario.append('texto', texto);
        if (segundos) formulario.append('segundos', String(segundos));
        formulario.append('archivo', archivo, nombre || archivo.name || (tipo + '.bin'));
        const ruta = conv.privado ? '/api/personal/privado/' + encodeURIComponent(conv.persona) + '/adjunto'
            : '/api/personal/chat/' + encodeURIComponent(conv.cedula) + '/adjunto';

        const previa = el('.chat-previa');
        previa.innerHTML = '<span>' + ({ audio: '🎤', pdf: '📄', imagen: '🖼️' }[tipo] || '🎬') + '</span>' +
            '<span>Enviando…</span><div class="chat-progreso"><div></div></div>' +
            '<button class="quitar" title="Cancelar">✕</button>';
        const barra = previa.querySelector('.chat-progreso div');
        estado.subida = subir(ruta, formulario, (p) => { barra.style.width = Math.round(p * 100) + '%'; });
        previa.querySelector('.quitar').onclick = () => estado.subida && estado.subida.cancelar();
        estado.subida.then((datos) => confirmar(conv, provisional, datos.mensaje)).catch((error) => {
            descartar(conv, provisional);
            URL.revokeObjectURL(urlLocal);
            if (error.message !== 'cancelado') P.avisar(error.message, 'malo');
        }).finally(() => {
            estado.subida = null;
            previa.innerHTML = '';
            actualizarBotones();
        });
    }

    async function enviarPrivado(conv) {
        if (estado.fotoArchivo) {
            const foto = estado.fotoArchivo;
            quitarPrevia();
            enviarArchivo(foto, 'imagen', 'foto.jpg');
            return;
        }
        const texto = caja.value.trim();
        if (!texto) return;
        caja.value = '';
        ajustarAltura();
        actualizarBotones();
        const provisional = {
            id: 'local-' + Date.now(), de: '', mio: true, texto: texto, imagen: false,
            enviando: true, ts: '', hora: '', fecha: '',
        };
        conv.mensajes.push(provisional);
        pintarConversacion(true);
        try {
            const datos = await P.pedir('/api/personal/privado/' + encodeURIComponent(conv.persona) + '/enviar',
                                        'POST', { texto: texto });
            confirmar(conv, provisional, datos.mensaje);
        } catch (error) {
            descartar(conv, provisional);
            if (!caja.value) caja.value = texto;
            actualizarBotones();
            P.avisar(error.message, 'malo');
        }
    }

    async function enviar() {
        const conv = estado.abierta;
        if (!conv) return;
        if (conv.privado) { enviarPrivado(conv); return; }
        const texto = caja.value.trim();
        const imagen = estado.fotoPendiente;
        const canal = el('.sel-canal').value;
        if (!texto && !imagen) return;
        caja.value = '';
        ajustarAltura();
        quitarPrevia();
        const provisional = {
            id: 'local-' + Date.now(), cedula: conv.cedula, de_modelo: false, mio: true, autor: '',
            canal_id: canal, canal: (conv.canales.find((c) => c.id === canal) || {}).nombre || 'Soporte',
            texto: texto, imagen: !!imagen, fotoLocal: imagen, enviando: true, ts: '', hora: '', fecha: '',
        };
        conv.mensajes.push(provisional);
        pintarConversacion(true);
        try {
            const datos = await P.pedir('/api/personal/chat/' + encodeURIComponent(conv.cedula) + '/enviar', 'POST',
                                        { canal: canal, texto: texto, imagen: imagen });
            confirmar(conv, provisional, datos.mensaje);
        } catch (error) {
            descartar(conv, provisional);
            if (!caja.value) caja.value = texto;
            actualizarBotones();
            P.avisar(error.message, 'malo');
        }
    }

    async function alElegirArchivo(archivo) {
        const conv = estado.abierta;
        if (!conv) return;
        if (estado.subida) { P.avisar('Espera a que termine de enviarse el archivo anterior.', 'malo'); return; }
        const tipo = A.tipoDe(archivo);
        if (tipo === 'video' || tipo === 'pdf') {
            const motivo = A.demasiadoGrande(archivo, tipo);
            if (motivo) { P.avisar(motivo, 'malo'); return; }
            enviarArchivo(archivo, tipo);
            return;
        }
        if (tipo !== 'imagen') { P.avisar('Solo fotos, videos, notas de voz y PDF.', 'malo'); return; }
        let vista;
        try {
            if (conv.privado) {
                estado.fotoPendiente = '';
                estado.fotoArchivo = await A.fotoParaDrive(archivo);
                vista = URL.createObjectURL(estado.fotoArchivo);
            } else {
                estado.fotoArchivo = null;
                estado.fotoPendiente = vista = await A.comprimir(archivo, TOPE_FOTO);
            }
        } catch (error) {
            P.avisar(error.message, 'malo');
            return;
        }
        const previa = el('.chat-previa');
        previa.innerHTML = '<img alt=""><span>Foto lista. ' + (conv.privado ? 'Pulsa ➤ para enviarla.'
            : 'Escribe algo si quieres y pulsa ➤.') + '</span><button class="quitar" title="Quitar">✕</button>';
        previa.querySelector('img').src = vista;
        previa.querySelector('.quitar').onclick = quitarPrevia;
        actualizarBotones();
        caja.focus();
    }

    const nota = A.notaDeVoz(raiz, {
        avisar: P.avisar,
        puedeEmpezar: () => estado.subida ? 'Espera a que termine de enviarse el archivo anterior.' : '',
        alTerminar: (audio, segundos) => enviarArchivo(audio, 'audio', 'nota-de-voz.wav', segundos),
    });

    // -------------------------------------------------------------- eventos
    el('.buscador').oninput = (e) => { estado.filtro = e.target.value.trim(); pintarLista(); };
    el('.btn-nueva').onclick = elegirModelo;
    el('.btn-volver').onclick = () => {
        if (estado.desdeLista) { history.back(); return; }
        history.replaceState({}, '', window.location.pathname);      // llegó directo a un chat
        volver();
    };
    caja.addEventListener('input', () => { ajustarAltura(); actualizarBotones(); });
    caja.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); enviar(); }
    });
    el('.chat-enviar').onclick = enviar;
    A.menu(el('.chat-clip'), alElegirArchivo);
    window.addEventListener('popstate', (e) => {
        const cedula = e.state && e.state.cedula;
        const persona = e.state && e.state.persona;
        if (cedula) abrir(cedula, false); else if (persona) abrirPrivado(persona, false); else volver();
    });
    document.addEventListener('visibilitychange', preguntar);

    // ------------------------------------------------------------- arranque
    (async () => {
        await Promise.all([cargarLista(), cargarEquipo()]);
        const parametros = new URLSearchParams(window.location.search);
        const pedida = parametros.get('cedula');
        const persona = parametros.get('persona');
        if (pedida) {
            history.replaceState({ cedula: pedida }, '', '?cedula=' + encodeURIComponent(pedida));
            abrir(pedida, false);
        } else if (persona) {
            history.replaceState({ persona: persona }, '', '?persona=' + encodeURIComponent(persona));
            abrirPrivado(persona, false);
        } else {
            history.replaceState({}, '', window.location.pathname);
        }
        setInterval(preguntar, CADA_MS);
    })();
}

window.ChatPersonal = { montar: montar };
})();
