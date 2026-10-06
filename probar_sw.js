/* ===========================================================================
 * Prueba del service worker SIN navegador:  node probar_sw.js
 * ===========================================================================
 * Se le pone un `self` de mentira y se dispara el evento `push` igual que lo
 * haría el teléfono, para comprobar que la notificación sale con lo que tiene
 * que salir. No necesita internet, ni servidor, ni instalar nada.
 */
const fs = require('fs');
const vm = require('vm');

const manejadores = {};
let notificacion = null;
const self = {
  addEventListener: (nombre, f) => { manejadores[nombre] = f; },
  skipWaiting: () => {},
  clients: { claim: async () => {}, matchAll: async () => [], openWindow: async () => {} },
  registration: { showNotification: (titulo, opciones) => { notificacion = { titulo, opciones }; } },
};
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname, 'sw.js'), 'utf8'), { self });

const esperas = [];
manejadores.push({
  data: { json: () => ({ titulo: 'Se acabó «Baile Sexy»', cuerpo: 'Ahora sigue: Nalgadas · 30 min', url: 'plan.html' }) },
  waitUntil: (p) => esperas.push(p),
});

const ok = [];
const comprobar = (t, c) => { ok.push([t, c]); console.log((c ? '  OK   ' : '  FALLA') + '  ' + t); };
comprobar('el service worker escucha el push', typeof manejadores.push === 'function');
comprobar('y el clic en la notificación', typeof manejadores.notificationclick === 'function');
comprobar('enseña el título que manda el servidor', notificacion && notificacion.titulo === 'Se acabó «Baile Sexy»');
comprobar('con el show que sigue en el cuerpo', notificacion && /Nalgadas/.test(notificacion.opciones.body));
comprobar('se queda en pantalla hasta que la toquen', notificacion && notificacion.opciones.requireInteraction === true);
comprobar('vibra el teléfono', notificacion && Array.isArray(notificacion.opciones.vibrate));
comprobar('lleva el icono de la aplicación', notificacion && /iconos\//.test(notificacion.opciones.icon));

// Un mensaje de chat: se agrupa por conversación y no se queda fijo.
notificacion = null;
manejadores.push({
  data: { json: () => ({ titulo: '💬 Ana · Soporte', cuerpo: 'hola', url: 'personal_chat.html?cedula=1',
                         etiqueta: 'chat-modelo-1', fijo: false, accion: 'Abrir el chat' }) },
  waitUntil: (p) => esperas.push(p),
});
comprobar('un mensaje de chat lleva la etiqueta de su conversación', notificacion && notificacion.opciones.tag === 'chat-modelo-1');
comprobar('y vuelve a sonar si llega otro del mismo chat', notificacion && notificacion.opciones.renotify === true);
comprobar('el del chat no se queda fijo en pantalla', notificacion && notificacion.opciones.requireInteraction === false);
comprobar('el botón dice «Abrir el chat»', notificacion && notificacion.opciones.actions[0].title === 'Abrir el chat');

// Un push vacío (algunos servicios mandan uno de prueba sin datos) no debe romper nada.
notificacion = null;
manejadores.push({ waitUntil: (p) => esperas.push(p) });
comprobar('un aviso sin datos no revienta', notificacion && notificacion.titulo === 'PARADISE');

console.log(ok.every(([, c]) => c) ? '\nTODO EN VERDE' : '\nHAY FALLOS');
process.exit(ok.every(([, c]) => c) ? 0 : 1);
