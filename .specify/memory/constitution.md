<!--
Sync Impact Report
==================
Version change: (template sin ratificar) → 1.0.0
Modified principles: N/A (primera ratificación; se reemplazan todos los placeholders)
Added principles:
  - I. Aislamiento de Datos por Modelo (NO NEGOCIABLE)
  - II. Prevención de Colisiones / Double-Booking (NO NEGOCIABLE)
  - III. Autenticación Validada en el Backend
  - IV. Catálogo de Shows de Solo Lectura
  - V. Manejo de Errores Semántico y Amigable
  - VI. Simplicidad y Cero Código Sombra
Added sections:
  - Naturaleza del Proyecto (preámbulo)
  - Stack Tecnológico y Restricciones
  - Estructura y Estilo de Código
  - Governance (incluye regla "Fuente de la Verdad")
Removed sections: ninguna
Templates requiring updates: ninguno modificado (las plantillas leen la constitución en tiempo de ejecución)
Follow-up TODOs: ninguno
-->

# Paradise App - Portal de Modelos Constitution

Portal web operativo para que las modelos del estudio gestionen sus turnos, programen shows y
visualicen su progreso de manera aislada y segura.

## Core Principles

### I. Aislamiento de Datos por Modelo (NO NEGOCIABLE)

- Toda consulta o escritura sobre el Plan de Trabajo MUST validar en el backend la identidad del
  usuario autenticado antes de acceder a Firestore.
- El identificador de la modelo usado para filtrar o escribir datos MUST provenir del token
  verificado en el servidor, nunca de parámetros enviados por el cliente.
- Una modelo MUST NOT poder leer ni modificar la programación de otra modelo bajo ningún flujo.

**Rationale**: La privacidad entre modelos es un requisito operativo y de seguridad del estudio;
una fuga de programación ajena es un fallo crítico.

### II. Prevención de Colisiones / Double-Booking (NO NEGOCIABLE)

- Es la regla crítica del sistema: ningún bloque programado MUST escribirse en la base de datos
  sin que el backend haya validado primero que el lapso de tiempo está libre.
- La validación de disponibilidad y la escritura MUST ejecutarse en el backend (idealmente de forma
  atómica, p. ej. transacción de Firestore) para evitar condiciones de carrera.
- Un conflicto de horario MUST responder con HTTP 409 y MUST NOT persistir datos parciales.
- La validación en el frontend es solo cosmética y MUST NOT sustituir la validación del backend.

**Rationale**: Una reserva duplicada rompe la operación del estudio; el servidor es la única
autoridad confiable sobre la disponibilidad.

### III. Autenticación Validada en el Backend

- Todo flujo de programación MUST exigir un usuario con sesión activa, verificada en el backend
  mediante `firebase_admin` (Firebase Auth).
- Las peticiones sin sesión válida MUST responder HTTP 401 y MUST NOT tocar la base de datos.

**Rationale**: Sin identidad verificada en el servidor no es posible garantizar los Principios I y
II.

### IV. Catálogo de Shows de Solo Lectura

- Las modelos MUST poder consumir el catálogo de shows únicamente en modo lectura.
- Ningún endpoint accesible para modelos MUST permitir alterar textos, metas de tokens ni videos
  de referencia del catálogo.

**Rationale**: El catálogo es contenido curado por el estudio; su integridad no depende de las
usuarias del portal.

### V. Manejo de Errores Semántico y Amigable

- **UI**: MUST NOT exponer errores crudos ni stack traces al usuario final. Todo error técnico MUST
  traducirse a un mensaje amigable (ej.: "El horario seleccionado ya está ocupado").
- **Backend**: MUST retornar códigos HTTP semánticos: 400 (petición inválida), 401 (no
  autenticado), 404 (no encontrado), 409 (conflicto de reserva).

**Rationale**: Códigos consistentes permiten al frontend mapear cada caso a un mensaje claro sin
filtrar detalles internos.

### VI. Simplicidad y Cero Código Sombra

- Se MUST construir estrictamente lo documentado en `spec.md`.
- MUST NOT añadirse características "por si acaso" (paneles de administración, chats, etc.) que no
  estén especificadas.
- Se MUST evitar la sobreingeniería: sin capas, abstracciones ni dependencias no justificadas por
  la especificación.

**Rationale**: El desarrollo guiado por especificación (SDD) solo funciona si el código refleja
fielmente el `spec.md`.

## Stack Tecnológico y Restricciones

- **Frontend / UI**: HTML5, CSS3 puro y JavaScript Vanilla (ES6+). MUST NOT usarse frameworks de UI
  (React, Vue, etc.) ni frameworks de CSS (Tailwind, Bootstrap, etc.).
- **Backend**: Python con FastAPI, centralizado en el archivo `main.py`.
- **Base de Datos**: Firebase (Firestore y Auth). El acceso MUST realizarse ESTRICTAMENTE desde el
  backend en Python mediante el SDK `firebase_admin`. El frontend MUST NOT contener credenciales
  directas de base de datos.
- **Lenguajes**: Python en el servidor y JavaScript en el cliente.

## Estructura y Estilo de Código

- **Estructura plana**: usar la estructura existente en la raíz: `/css` para estilos, `/js` para
  lógica de cliente, archivos `.html` en la raíz y `main.py` para el backend.
- **Modularidad en JavaScript**: la lógica de UI MUST separarse de las peticiones `fetch`
  (p. ej. módulos de acceso a API distintos de los módulos de renderizado).
- **Nomenclatura**: `snake_case` para variables y funciones en Python (backend); `camelCase` para
  variables y funciones en JavaScript (frontend).

## Governance

- Esta constitución prevalece sobre cualquier otra práctica o instrucción del proyecto.
- **Fuente de la Verdad**: si una instrucción del usuario contradice esta constitución, o si el
  agente de IA detecta una falla lógica, el agente MUST detenerse, advertir del problema y
  solicitar la actualización del `spec.md` (o de esta constitución) antes de tocar el código fuente.
- **Enmiendas**: toda modificación MUST documentarse en este archivo mediante
  `/speckit-constitution`, con su Sync Impact Report y ajuste de versión.
- **Versionado** (semántico):
  - MAJOR: eliminación o redefinición incompatible de principios o reglas de gobierno.
  - MINOR: nuevo principio o sección, o ampliación material de una guía.
  - PATCH: aclaraciones, redacción o correcciones sin cambio semántico.
- **Cumplimiento**: cada plan (`plan.md`) MUST pasar el "Constitution Check" antes de
  implementarse, y toda revisión de cambios MUST verificar especialmente los Principios I, II y III.

**Version**: 1.0.0 | **Ratified**: 2026-09-29 | **Last Amended**: 2026-09-29
