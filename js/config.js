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
})();
