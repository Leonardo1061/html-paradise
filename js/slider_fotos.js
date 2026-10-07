/* ===========================================================================
 * PARADISE · Visor de fotos en slider (portafolio de Fotografía)
 * ===========================================================================
 *
 *   SliderFotos.abrir(fuentes, indice, titulo)
 *
 * Pantalla completa, una foto a la vez. Se pasa con el dedo (swipe) hacia
 * los lados y es INFINITO: después de la última vuelve la primera, y antes de
 * la primera, la última. La ✕ de arriba a la derecha lo cierra; también Esc,
 * y en el computador las flechas ← →.
 *
 * Lo usan el portal de las modelos (js/fotografia.js) y la web del personal
 * (js/fotografia_personal.js). Trae su propio CSS para no depender de la hoja
 * de cada página.
 *
 * CÓMO ES INFINITO SIN COPIAR TODAS LAS FOTOS
 * -------------------------------------------
 * La pista tiene solo TRES casillas: la anterior, la actual y la siguiente.
 * Al soltar el dedo se anima hacia un lado, se cambia el índice (módulo el
 * total) y se vuelven a llenar las tres casillas en su sitio. Da igual que el
 * estilo tenga 5 fotos o 80: en pantalla nunca hay más de tres <img>.
 */

(function () {
'use strict';

const CSS = `
.slider-fotos { position: fixed; inset: 0; z-index: 200; background: #000;
  touch-action: none; user-select: none; -webkit-user-select: none; overflow: hidden; }
.slider-fotos .pista { position: absolute; inset: 0; display: flex; width: 300%;
  left: -100%; will-change: transform; }
.slider-fotos .casilla { width: 33.3333%; height: 100%; display: grid; place-items: center;
  padding: 56px 10px 46px; box-sizing: border-box; }
.slider-fotos .casilla img { max-width: 100%; max-height: 100%; object-fit: contain;
  border-radius: 8px; pointer-events: none; -webkit-user-drag: none; }
.slider-fotos .cerrar-slider { position: absolute; top: 10px; right: 10px; z-index: 2;
  width: 44px; height: 44px; border-radius: 50%; border: 0; cursor: pointer;
  background: rgba(255,255,255,.16); color: #fff; font-size: 22px; line-height: 44px; }
.slider-fotos .cerrar-slider:active { background: rgba(255,255,255,.3); }
.slider-fotos .titulo-slider { position: absolute; top: 18px; left: 16px; right: 70px; z-index: 2;
  color: #fff; font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; opacity: .9; }
.slider-fotos .contador { position: absolute; bottom: 14px; left: 0; right: 0; z-index: 2;
  text-align: center; color: rgba(255,255,255,.85); font-size: 13px; }
.slider-fotos .flecha-slider { position: absolute; top: 50%; z-index: 2; transform: translateY(-50%);
  width: 44px; height: 44px; border-radius: 50%; border: 0; cursor: pointer;
  background: rgba(255,255,255,.12); color: #fff; font-size: 22px; display: none; }
.slider-fotos .flecha-slider.izq { left: 12px; }
.slider-fotos .flecha-slider.der { right: 12px; }
@media (hover: hover) and (pointer: fine) { .slider-fotos .flecha-slider { display: block; } }
`;

let estilosPuestos = false;
function ponerEstilos() {
    if (estilosPuestos) return;
    const hoja = document.createElement('style');
    hoja.textContent = CSS;
    document.head.appendChild(hoja);
    estilosPuestos = true;
}

function abrir(fuentes, indice, titulo) {
    fuentes = (fuentes || []).filter(Boolean);
    if (!fuentes.length) return;
    ponerEstilos();
    cerrarAbierto();

    const total = fuentes.length;
    let actual = ((indice || 0) % total + total) % total;

    const raiz = document.createElement('div');
    raiz.className = 'slider-fotos';
    raiz.setAttribute('role', 'dialog');
    raiz.setAttribute('aria-label', 'Fotos');
    raiz.innerHTML =
        '<div class="titulo-slider"></div>' +
        '<button class="cerrar-slider" aria-label="Cerrar">✕</button>' +
        '<button class="flecha-slider izq" aria-label="Anterior">‹</button>' +
        '<button class="flecha-slider der" aria-label="Siguiente">›</button>' +
        '<div class="pista">' +
            '<div class="casilla"><img alt=""></div>' +
            '<div class="casilla"><img alt=""></div>' +
            '<div class="casilla"><img alt=""></div>' +
        '</div>' +
        '<div class="contador"></div>';
    raiz.querySelector('.titulo-slider').textContent = titulo || '';
    const pista = raiz.querySelector('.pista');
    const imagenes = raiz.querySelectorAll('.casilla img');
    const contador = raiz.querySelector('.contador');
    if (total < 2) raiz.querySelectorAll('.flecha-slider').forEach((b) => b.remove());

    const enRango = (i) => ((i % total) + total) % total;

    function llenar() {
        imagenes[0].src = fuentes[enRango(actual - 1)];
        imagenes[1].src = fuentes[actual];
        imagenes[2].src = fuentes[enRango(actual + 1)];
        contador.textContent = total > 1 ? (actual + 1) + ' / ' + total : '';
        pista.style.transition = 'none';
        pista.style.transform = 'translateX(0)';
    }

    let animando = false;
    function ir(paso) {
        if (total < 2 || animando) return;
        animando = true;
        pista.style.transition = 'transform .28s ease-out';
        pista.style.transform = 'translateX(' + (-paso * 33.3333) + '%)';
        setTimeout(() => {
            actual = enRango(actual + paso);
            llenar();
            animando = false;
        }, 280);
    }

    // --- swipe con el dedo (o arrastrando con el ratón) -----------------
    let inicioX = null;
    let inicioY = 0;
    let dx = 0;
    raiz.addEventListener('pointerdown', (e) => {
        if (animando || e.target.closest('button')) return;
        inicioX = e.clientX;
        inicioY = e.clientY;
        dx = 0;
        pista.style.transition = 'none';
        raiz.setPointerCapture(e.pointerId);
    });
    raiz.addEventListener('pointermove', (e) => {
        if (inicioX === null || total < 2) return;
        dx = e.clientX - inicioX;
        pista.style.transform = 'translateX(' + dx + 'px)';
    });
    const soltar = (e) => {
        if (inicioX === null) return;
        const dy = e.clientY - inicioY;
        inicioX = null;
        const umbral = Math.min(80, raiz.clientWidth * 0.18);
        if (total > 1 && Math.abs(dx) > umbral && Math.abs(dx) > Math.abs(dy)) {
            ir(dx < 0 ? 1 : -1);
        } else {
            pista.style.transition = 'transform .2s ease-out';
            pista.style.transform = 'translateX(0)';
        }
    };
    raiz.addEventListener('pointerup', soltar);
    raiz.addEventListener('pointercancel', soltar);

    // --- botones y teclado ----------------------------------------------
    raiz.querySelector('.cerrar-slider').onclick = cerrar;
    const izq = raiz.querySelector('.flecha-slider.izq');
    const der = raiz.querySelector('.flecha-slider.der');
    if (izq) izq.onclick = () => ir(-1);
    if (der) der.onclick = () => ir(1);

    // En captura y sin propagar: la página tiene su propio Esc (cierra la
    // hoja de detrás), y aquí solo debe cerrarse el visor.
    function teclado(e) {
        if (e.key === 'Escape') cerrar();
        else if (e.key === 'ArrowRight') ir(1);
        else if (e.key === 'ArrowLeft') ir(-1);
        else return;
        e.preventDefault();
        e.stopPropagation();
    }
    window.addEventListener('keydown', teclado, true);

    const desbordeAntes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function cerrar() {
        window.removeEventListener('keydown', teclado, true);
        document.body.style.overflow = desbordeAntes;
        raiz.remove();
        if (abierto === cerrar) abierto = null;
    }
    abierto = cerrar;

    llenar();
    document.body.appendChild(raiz);
}

let abierto = null;
function cerrarAbierto() { if (abierto) abierto(); }

window.SliderFotos = { abrir: abrir, cerrar: cerrarAbierto };
})();
