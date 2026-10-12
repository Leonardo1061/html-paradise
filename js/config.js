/* ===========================================================================
 * PARADISE · Configuración común de las páginas web
 * ===========================================================================
 *
 * QUÉ ES
 * ------
 * Las direcciones de los dos servicios del proyecto. Antes estaban escritas
 * dentro de cada .html, así que cambiar de servicio obligaba a editar cuatro
 * archivos y olvidarse de uno era cuestión de tiempo. Aquí están una vez.
 *
 *     API    api-v03l.onrender.com       el backend (FastAPI, repo `api`)
 *     WEB    paradise-go1a.onrender.com  estas mismas páginas (repo `html-paradise`)
 *
 * CÓMO SE USA
 * -----------
 * En cada página, ANTES del <script> que la hace funcionar:
 *
 *     <script src="js/config.js"></script>
 *
 * y dentro del script:
 *
 *     const API_URL   = PARADISE.API_URL;
 *     const URL_LOGIN = PARADISE.URL_LOGIN;
 *
 * EN LOCAL NO HACE FALTA TOCAR NADA
 * ---------------------------------
 * `URL_LOGIN` se calcula a partir de la página que se está viendo. Si abres
 * turnos.html desde tu PC, «cerrar sesión» te devuelve a TU index.html, no al
 * de producción. Antes esa URL estaba fija y probar en local te echaba al
 * servidor de verdad a mitad de prueba.
 *
 * Para apuntar a una API local mientras desarrollas, basta con añadir
 * `?api=http://localhost:8000` a la dirección de la página: queda guardado
 * para esa pestaña (sessionStorage) y no afecta a nadie más.
 */

(function () {
    'use strict';

    var API_PRODUCCION = "https://api-v03l.onrender.com";

    // La raíz de donde salió esta página: sirve para volver al login sin
    // escribir el dominio a mano.
    function raizDelSitio() {
        var ruta = window.location.pathname.replace(/\/[^\/]*$/, '/');
        return window.location.origin + ruta;
    }

    // Permite probar contra otra API sin tocar el código ni subir nada.
    function apiElegida() {
        try {
            var parametro = new URLSearchParams(window.location.search).get('api');
            if (parametro) {
                sessionStorage.setItem('paradise_api', parametro);
                return parametro;
            }
            return sessionStorage.getItem('paradise_api') || API_PRODUCCION;
        } catch (error) {
            return API_PRODUCCION;      // navegador sin sessionStorage
        }
    }

    var api = apiElegida();

    window.PARADISE = {
        API_URL: api,
        URL_LOGIN: raizDelSitio(),
        ES_PRODUCCION: api === API_PRODUCCION,

        /* Atajo para las llamadas: PARADISE.url('/api/semana', true)
         * El segundo parámetro añade el ?t=… que evita la caché del navegador,
         * que es lo que ya se hacía a mano en cada fetch. */
        url: function (ruta, sinCache) {
            var completa = api + ruta;
            if (!sinCache) return completa;
            return completa + (ruta.indexOf('?') >= 0 ? '&' : '?') + 't=' + Date.now();
        }
    };

    if (!window.PARADISE.ES_PRODUCCION) {
        console.warn('PARADISE: usando API de pruebas →', api);
    }

    /* ------------------------------------------------ LA SESIÓN NO SE PIERDE
     * El token vive en localStorage, pero el teléfono puede vaciarlo sin
     * avisar: el navegador lo borra cuando le falta espacio, Safari limpia lo
     * que guardan las páginas, algunos navegadores borran «datos del sitio»
     * al cerrarse... y la persona vuelve a ver el login aunque la sesión siga
     * viva en la API. Por eso se guarda una copia en una cookie de 400 días
     * (lo máximo que aceptan los navegadores) que se renueva en cada visita,
     * y si localStorage aparece vacío se rellena desde ahí antes de que la
     * página lo lea. Este archivo va el primero en todas las páginas.
     *
     * Para cerrar sesión hay que usar PARADISE.olvidar(...): si solo se borra
     * localStorage, la cookie la devolvería en la página siguiente. */
    var CLAVES_SESION = ['token_sesion', 'modelo_actual', 'jornada_actual', 'token_personal'];
    var PREFIJO_COOKIE = 'pdz_';
    var SEGUNDOS_COOKIE = 400 * 24 * 60 * 60;

    function leerCookie(nombre) {
        var partes = document.cookie ? document.cookie.split('; ') : [];
        for (var i = 0; i < partes.length; i++) {
            var igual = partes[i].indexOf('=');
            if (partes[i].slice(0, igual) === nombre) {
                try { return decodeURIComponent(partes[i].slice(igual + 1)); } catch (e) { return ''; }
            }
        }
        return '';
    }

    function escribirCookie(nombre, valor, segundos) {
        var seguro = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = nombre + '=' + encodeURIComponent(valor) + '; Max-Age=' + segundos +
            '; Path=/; SameSite=Strict' + seguro;
    }

    try {
        CLAVES_SESION.forEach(function (clave) {
            var guardado = localStorage.getItem(clave);
            var copia = leerCookie(PREFIJO_COOKIE + clave);
            if (guardado) escribirCookie(PREFIJO_COOKIE + clave, guardado, SEGUNDOS_COOKIE);
            else if (copia) localStorage.setItem(clave, copia);
        });
    } catch (error) { /* sin almacenamiento: no hay nada que copiar */ }

    // Que el navegador no vacíe este sitio por falta de espacio. En una app
    // instalada Chrome lo concede sin preguntar; si no, no pasa nada.
    try {
        if (navigator.storage && navigator.storage.persist) {
            navigator.storage.persisted().then(function (ya) {
                if (!ya) navigator.storage.persist();
            }).catch(function () { /* da igual */ });
        }
    } catch (error) { /* da igual */ }

    /* Borra estas claves de localStorage Y de la copia. Para salir. */
    window.PARADISE.olvidar = function () {
        for (var i = 0; i < arguments.length; i++) {
            var clave = arguments[i];
            try { localStorage.removeItem(clave); } catch (e) { /* da igual */ }
            if (CLAVES_SESION.indexOf(clave) >= 0) escribirCookie(PREFIJO_COOKIE + clave, '', 0);
        }
    };
})();
