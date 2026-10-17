/* ===========================================================================
 * PARADISE · Reacciones y enlaces de los chats (js/chat.js y js/chat_personal.js)
 * ===========================================================================
 *
 * REACCIONES (Leonardo, 2026-10-17)
 * ---------------------------------
 * Mantener el dedo sobre un mensaje (o clic derecho en el ordenador) saca una
 * barra con los emojis. Tocar uno lo pone; tocar el que ya tienes lo quita.
 * Es el MISMO campo que usan los dos escritorios (`reacciones` del mensaje,
 * una llave por persona: 'modelo' o 'monitor:Nombre'), así que lo que pone la
 * modelo en la web lo ve el monitor en el escritorio y al revés. La API manda
 * en cada vuelta de «nuevos» las reacciones que cambiaron.
 *
 * La barra también trae «📋 Copiar»: copia el texto del mensaje (con sus
 * enlaces), que en el teléfono es lo que se busca al mantener el dedo.
 *
 * ENLACES
 * -------
 * `enlazar(texto)` convierte lo que parece una dirección (https://…, www.…)
 * en un enlace que se abre en otra pestaña. El resto sigue siendo texto: nada
 * del mensaje se mete como HTML.
 */

(function () {
'use strict';

// El orden es el de la barra. Los mismos que en los escritorios y en la API.
const EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏', '🔥', '👏', '😍', '🎉'];
const MS_PRESION = 450;              // lo que hay que mantener el dedo
const TOLERANCIA_PX = 10;            // moverse más que esto es hacer scroll

const PATRON_ENLACE = /\b((?:https?:\/\/|www\.)[^\s<>"']+)/gi;
const COLA_SOBRANTE = /[.,;:!?)\]}»"']+$/;

function direccion(enlace) {
    return /^https?:\/\//i.test(enlace) ? enlace : 'https://' + enlace;
}

/* El texto como nodos: texto normal y <a> para cada dirección. */
function enlazar(texto) {
    const fragmento = document.createDocumentFragment();
    const cadena = String(texto == null ? '' : texto);
    let desde = 0;
    cadena.replace(PATRON_ENLACE, (coincidencia, _g, posicion) => {
        // «mira esto: https://x.com/a.» -> el punto final no es del enlace.
        const sobra = (coincidencia.match(COLA_SOBRANTE) || [''])[0];
        const enlace = coincidencia.slice(0, coincidencia.length - sobra.length);
        if (!enlace) return coincidencia;
        if (posicion > desde) fragmento.appendChild(document.createTextNode(cadena.slice(desde, posicion)));
        const a = document.createElement('a');
        a.className = 'chat-enlace';
        a.href = direccion(enlace);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = enlace;
        fragmento.appendChild(a);
        desde = posicion + enlace.length;
        return coincidencia;
    });
    if (desde < cadena.length) fragmento.appendChild(document.createTextNode(cadena.slice(desde)));
    return fragmento;
}

function limpio(mapa) {
    const salida = {};
    Object.keys(mapa || {}).forEach((k) => { if (EMOJIS.indexOf(mapa[k]) >= 0) salida[k] = mapa[k]; });
    return salida;
}

function iguales(a, b) {
    const x = limpio(a), y = limpio(b);
    const kx = Object.keys(x).sort(), ky = Object.keys(y).sort();
    return kx.length === ky.length && kx.every((k, i) => k === ky[i] && x[k] === y[k]);
}

/* Las fichas «❤️ 2» debajo de la burbuja, o null si no hay ninguna. */
function fila(mapa, miClave, alPulsar) {
    const conteo = {};
    const reacciones = limpio(mapa);
    Object.keys(reacciones).forEach((k) => { conteo[reacciones[k]] = (conteo[reacciones[k]] || 0) + 1; });
    const mia = reacciones[miClave] || '';
    const presentes = EMOJIS.filter((e) => conteo[e]);
    if (!presentes.length) return null;
    const caja = document.createElement('div');
    caja.className = 'chat-reacciones';
    presentes.forEach((emoji) => {
        const ficha = document.createElement('button');
        ficha.type = 'button';
        ficha.className = 'chat-ficha' + (emoji === mia ? ' mia' : '');
        ficha.textContent = conteo[emoji] > 1 ? emoji + ' ' + conteo[emoji] : emoji;
        ficha.title = emoji === mia ? 'Quitar tu reacción' : 'Reaccionar con ' + emoji;
        if (alPulsar) ficha.onclick = (e) => { e.stopPropagation(); alPulsar(emoji === mia ? '' : emoji); };
        else ficha.disabled = true;
        caja.appendChild(ficha);
    });
    return caja;
}

// ------------------------------------------------------------- la barra
let abierta = null;

function cerrar() {
    if (!abierta) return;
    abierta.remove();
    abierta = null;
    document.removeEventListener('pointerdown', fuera, true);
    window.removeEventListener('scroll', cerrar, true);
}

function fuera(e) {
    if (abierta && !abierta.contains(e.target)) cerrar();
}

async function copiar(texto) {
    try {
        await navigator.clipboard.writeText(texto);
        return true;
    } catch (error) {
        // Navegadores viejos o sin permiso: el truco de siempre.
        const area = document.createElement('textarea');
        area.value = texto;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        area.remove();
        return ok;
    }
}

/* opciones: {mia: '❤️'|'', alElegir(emoji) (null = sin reacciones), texto, avisar} */
function mostrarBarra(x, y, opciones) {
    cerrar();
    const barra = document.createElement('div');
    barra.className = 'chat-barra-emojis';
    if (opciones.alElegir) {
        EMOJIS.forEach((emoji) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'emoji' + (emoji === opciones.mia ? ' mia' : '');
            b.textContent = emoji;
            b.onclick = () => { cerrar(); opciones.alElegir(emoji === opciones.mia ? '' : emoji); };
            barra.appendChild(b);
        });
    }
    if (opciones.texto) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'accion';
        b.textContent = '📋 Copiar';
        b.onclick = async () => {
            cerrar();
            const ok = await copiar(opciones.texto);
            if (opciones.avisar) opciones.avisar(ok ? 'Mensaje copiado.' : 'No se pudo copiar.', ok ? 'bueno' : 'malo');
        };
        barra.appendChild(b);
    }
    if (!barra.children.length) return;
    document.body.appendChild(barra);
    abierta = barra;
    // Encima del dedo, sin salirse de la pantalla.
    const ancho = barra.offsetWidth, alto = barra.offsetHeight;
    const izquierda = Math.max(8, Math.min(x - ancho / 2, window.innerWidth - ancho - 8));
    const arriba = y - alto - 14 < 8 ? y + 18 : y - alto - 14;
    barra.style.left = izquierda + 'px';
    barra.style.top = Math.max(8, Math.min(arriba, window.innerHeight - alto - 8)) + 'px';
    setTimeout(() => {
        document.addEventListener('pointerdown', fuera, true);
        window.addEventListener('scroll', cerrar, true);
    }, 0);
}

/* Mantener presionado o clic derecho sobre `elemento` abre la barra.
   `opciones()` se pide en ese momento: así la reacción «mía» está al día. */
function gestos(elemento, opciones) {
    let reloj = null, inicio = null;
    const soltar = () => { clearTimeout(reloj); reloj = null; };
    elemento.addEventListener('pointerdown', (e) => {
        if (e.button !== 0 || e.target.closest('a, button, audio, video, .chat-ficha')) return;
        inicio = { x: e.clientX, y: e.clientY };
        soltar();
        reloj = setTimeout(() => {
            reloj = null;
            if (navigator.vibrate) { try { navigator.vibrate(15); } catch (err) { /* da igual */ } }
            // Que el texto no quede seleccionado debajo de la barra.
            try { window.getSelection().removeAllRanges(); } catch (err) { /* da igual */ }
            mostrarBarra(inicio.x, inicio.y, opciones());
        }, MS_PRESION);
    });
    elemento.addEventListener('pointermove', (e) => {
        if (reloj && inicio && (Math.abs(e.clientX - inicio.x) > TOLERANCIA_PX ||
                                Math.abs(e.clientY - inicio.y) > TOLERANCIA_PX)) soltar();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => elemento.addEventListener(t, soltar));
    elemento.addEventListener('contextmenu', (e) => {
        // En el teléfono el menú del sistema sale con la presión larga: se
        // cambia por la barra. Sobre un enlace se deja el del navegador.
        if (e.target.closest('a')) return;
        e.preventDefault();
        soltar();
        mostrarBarra(e.clientX, e.clientY, opciones());
    });
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });

window.Reacciones = {
    EMOJIS: EMOJIS, enlazar: enlazar, fila: fila, gestos: gestos,
    iguales: iguales, limpio: limpio, cerrar: cerrar,
};
})();
