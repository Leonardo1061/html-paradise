/* ===========================================================================
 * PARADISE · 🤝 Convenios, editor del CEO (personal_convenios.html)
 * ===========================================================================
 * La lista de convenios (también los ocultos) con ✏ Editar, Ocultar/Mostrar
 * y 🗑 Eliminar, y la hoja «Nuevo convenio»: nombre, descripción, requisitos,
 * foto y contacto: dirección y redes (WhatsApp, Instagram, Facebook, TikTok,
 * página web), cada una con su logo (img/redes/), y «Otros datos». Todo contra /api/personal/convenios (api/convenios.py),
 * que responde 403 a quien no es el CEO. Lo mismo que Admin › Convenios.
 */
(function () {
'use strict';
const P = window.Personal;
const esc = P.escapar;
const API = '/api/personal/convenios';
const $ = (id) => document.getElementById(id);
const estado = { convenios: [] };
// Los campos del contacto, con su logo (img/redes/<campo>.svg). La API los valida y limpia.
const REDES = [
    { campo: 'direccion', texto: 'Dirección', ejemplo: 'Cra 10 # 20-30, Medellín', tipo: 'text' },
    { campo: 'whatsapp', texto: 'WhatsApp', ejemplo: '300 123 4567', tipo: 'tel' },
    { campo: 'instagram', texto: 'Instagram', ejemplo: '@empresa', tipo: 'text' },
    { campo: 'facebook', texto: 'Facebook', ejemplo: 'Usuario de la página o su enlace', tipo: 'text' },
    { campo: 'tiktok', texto: 'TikTok', ejemplo: '@empresa', tipo: 'text' },
    { campo: 'web', texto: 'Página web', ejemplo: 'www.empresa.com', tipo: 'url' },
];

function logos(c) {
    return (c.enlaces || []).length ? '<div class="conv-redes">' + c.enlaces.map((e) =>
        '<a href="' + esc(e.url) + '" target="_blank" rel="noopener" title="' + esc(e.texto) + '">' +
        '<img src="img/redes/' + esc(e.tipo) + '.svg" alt="' + esc(e.tipo) + '"></a>').join('') + '</div>' : '';
}

function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

async function leer(mensaje) {
    try {
        const datos = await P.pedir(API);
        estado.convenios = datos.convenios || [];
        pintar();
        if (mensaje) P.avisar(mensaje, 'bueno');
    } catch (error) {
        $('lista').innerHTML = '<div class="vacio">' + esc(error.message) + '</div>';
    }
}

function pintar() {
    const buscado = normalizar($('buscar').value);
    const lista = estado.convenios.filter((c) => !buscado || normalizar(c.nombre).indexOf(buscado) >= 0);
    if (!lista.length) {
        $('lista').innerHTML = '<div class="vacio">' + (buscado ? 'Ningún convenio con ese nombre.'
            : 'Todavía no hay convenios. Crea el primero con «＋ Nuevo convenio».') + '</div>';
        return;
    }
    $('lista').innerHTML = lista.map((c) =>
        '<article class="conv-tarjeta' + (c.activo ? '' : ' apagado') + '">' +
        (c.foto_mini ? '<img class="conv-foto" alt="" src="' + esc(c.foto_mini) + '">'
            : '<div class="conv-foto vacia"><img src="img/convenios.png" alt=""></div>') +
        '<div class="conv-cuerpo">' +
        '<div class="bit-meta"><h3>' + esc(c.nombre) + '</h3><span class="bit-espacio"></span>' +
        (c.activo ? '<span class="bit-chip si">Visible</span>' : '<span class="bit-chip">Oculto</span>') + '</div>' +
        '<p>' + esc(c.descripcion) + '</p>' +
        (c.requisitos ? '<p class="conv-sec"><b>Requisitos:</b> ' + esc(c.requisitos) + '</p>' : '') +
        logos(c) +
        (c.contacto ? '<p class="conv-sec"><b>Otros datos:</b> ' + esc(c.contacto) + '</p>' : '') +
        '<div class="bit-meta"><span class="bit-autor">' + esc([c.editado_por || c.por,
            String(c.editado_cuando || c.cuando || '').slice(0, 10)].filter(Boolean).join(' · ')) + '</span>' +
        '<span class="bit-espacio"></span>' +
        '<button class="bit-icono" data-op="editar" data-id="' + esc(c.id) + '" title="Editar">✏</button>' +
        '<button class="bit-icono" data-op="activo" data-id="' + esc(c.id) + '" title="' +
            (c.activo ? 'Ocultar a las modelos' : 'Mostrar a las modelos') + '">' + (c.activo ? '🙈' : '👁') + '</button>' +
        '<button class="bit-icono" data-op="borrar" data-id="' + esc(c.id) + '" title="Eliminar">🗑</button>' +
        '</div></div></article>').join('');
    $('lista').querySelectorAll('button[data-op]').forEach((b) => {
        const c = estado.convenios.find((x) => x.id === b.dataset.id);
        b.onclick = () => {
            if (b.dataset.op === 'editar') abrirFormulario(c);
            else if (b.dataset.op === 'activo') cambiarActivo(c);
            else borrar(c);
        };
    });
}

async function cambiarActivo(c) {
    try {
        await P.pedir(API + '/' + encodeURIComponent(c.id) + '/activo', 'POST', { activo: !c.activo });
        leer(c.activo ? 'Convenio oculto: las modelos ya no lo ven.' : 'Convenio visible para las modelos.');
    } catch (error) { P.avisar(error.message, 'malo'); }
}

async function borrar(c) {
    if (!window.confirm('¿Eliminar el convenio «' + c.nombre + '»? No se puede deshacer.')) return;
    try {
        await P.pedir(API + '/' + encodeURIComponent(c.id), 'DELETE');
        leer('Se eliminó el convenio «' + c.nombre + '».');
    } catch (error) { P.avisar(error.message, 'malo'); }
}

function abrirFormulario(c) {
    let foto = null;                 // File nuevo
    let quitar = false;
    const capa = document.createElement('div');
    capa.innerHTML = '<div class="velo"></div><div class="hoja bit-formulario"><div class="hoja-cabecera"><div style="flex:1">' +
        '<h3>' + (c ? 'Editar convenio' : 'Nuevo convenio') + '</h3>' +
        '<div class="sub">Lo ven todas las modelos en Convenios.</div></div>' +
        '<button class="cerrar" aria-label="Cerrar">✕</button></div><div class="hoja-cuerpo">' +
        '<div class="campo"><label for="f-nombre">Nombre de la empresa *</label><input id="f-nombre" maxlength="80" ' +
        'placeholder="Ej.: Gimnasio BodyFit"></div>' +
        '<div class="campo"><label>Foto</label><div class="conv-elegir">' +
        '<div class="conv-foto" id="f-vista"></div><div class="conv-botones">' +
        '<button type="button" class="bit-adjuntar" id="f-elegir">🖼️ Elegir foto</button>' +
        '<button type="button" class="boton-secundario" id="f-quitar">✕ Quitar</button></div></div>' +
        '<input type="file" id="f-foto" class="oculto" accept="image/*"></div>' +
        '<div class="campo"><label for="f-descripcion">Descripción *</label><textarea id="f-descripcion" maxlength="2000" rows="4" ' +
        'placeholder="Qué ofrece: el descuento, en qué productos o servicios…"></textarea></div>' +
        '<div class="campo"><label for="f-requisitos">Requisitos</label><textarea id="f-requisitos" maxlength="2000" rows="3" ' +
        'placeholder="Ej.: Mostrar el carné del estudio. Válido de lunes a viernes."></textarea></div>' +
        '<div class="campo"><label>Contacto de la empresa</label><div class="conv-contacto">' +
        REDES.map((r) => '<label class="conv-red"><img src="img/redes/' + r.campo + '.svg" alt="">' +
            '<span>' + r.texto + '</span><input id="f-' + r.campo + '" type="' + r.tipo + '" maxlength="300" ' +
            'placeholder="' + esc(r.ejemplo) + '" autocomplete="off"></label>').join('') + '</div></div>' +
        '<div class="campo"><label for="f-contacto">Otros datos de contacto</label><textarea id="f-contacto" maxlength="400" rows="2" ' +
        'placeholder="Teléfono fijo, correo, horario…"></textarea></div>' +
        '<div class="bit-botones"><button class="boton-secundario" data-op="no">Cancelar</button>' +
        '<button class="boton-principal" id="f-guardar">' + (c ? 'Guardar cambios' : 'Crear convenio') + '</button></div>' +
        '</div></div>';
    document.body.appendChild(capa);
    const cerrar = () => capa.remove();
    capa.querySelector('.velo').onclick = cerrar;
    capa.querySelector('.cerrar').onclick = cerrar;
    capa.querySelector('[data-op="no"]').onclick = cerrar;

    $('f-nombre').value = c ? c.nombre : '';
    $('f-descripcion').value = c ? c.descripcion : '';
    $('f-requisitos').value = c ? c.requisitos : '';
    $('f-contacto').value = c ? c.contacto : '';
    REDES.forEach((r) => { $('f-' + r.campo).value = c ? (c[r.campo] || '') : ''; });

    const vista = (src) => {
        $('f-vista').classList.toggle('vacia', !src);
        $('f-vista').innerHTML = src ? '<img alt="" src="' + esc(src) + '">' : '<img src="img/convenios.png" alt="">';
        $('f-quitar').disabled = !src;
    };
    vista(c && c.foto_mini);
    $('f-elegir').onclick = () => $('f-foto').click();
    $('f-foto').onchange = () => {
        const archivo = ($('f-foto').files || [])[0];
        $('f-foto').value = '';
        if (!archivo) return;
        if (!/^image\//.test(archivo.type)) { P.avisar('La foto tiene que ser una imagen.', 'malo'); return; }
        if (archivo.size > 15 * 1024 * 1024) { P.avisar('La foto pesa más de 15 MB.', 'malo'); return; }
        foto = archivo;
        quitar = false;
        vista(URL.createObjectURL(archivo));
    };
    $('f-quitar').onclick = () => { foto = null; quitar = true; vista(''); };
    if (!c) $('f-nombre').focus();

    const guardar = $('f-guardar');
    guardar.onclick = async () => {
        const nombre = $('f-nombre').value.trim();
        const descripcion = $('f-descripcion').value.trim();
        if (!nombre) { P.avisar('Escribe el nombre de la empresa.', 'malo'); return; }
        if (!descripcion) { P.avisar('Escribe la descripción del convenio.', 'malo'); return; }
        const formulario = new FormData();
        formulario.append('nombre', nombre);
        formulario.append('descripcion', descripcion);
        formulario.append('requisitos', $('f-requisitos').value.trim());
        formulario.append('contacto', $('f-contacto').value.trim());
        REDES.forEach((r) => formulario.append(r.campo, $('f-' + r.campo).value.trim()));
        if (foto) formulario.append('foto', foto, foto.name);
        else if (c && quitar) formulario.append('quitar_foto', '1');
        guardar.disabled = true;
        guardar.textContent = foto ? 'Subiendo foto…' : 'Guardando…';
        try {
            const datos = await P.pedirFormulario(c ? API + '/' + encodeURIComponent(c.id) : API, formulario);
            cerrar();
            leer(datos.mensaje || 'Convenio guardado.');
        } catch (error) {
            guardar.disabled = false;
            guardar.textContent = c ? 'Guardar cambios' : 'Crear convenio';
            P.avisar(error.message, 'malo');
        }
    };
}

// ---------------------------------------------------------------------------
P.iniciar('convenios').then(() => {
    $('buscar').oninput = pintar;
    $('nuevo').onclick = () => abrirFormulario(null);
    leer();
});
})();
