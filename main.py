from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime, timedelta

# --- 1. INICIALIZAR FASTAPI ---
app = FastAPI(title="API del Monitor de Estudio")

app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

try:
    if not firebase_admin._apps:
        cred = credentials.Certificate('firebase_credenciales.json')
        firebase_admin.initialize_app(cred)
    db = firestore.client()
    print("🔥 API conectada a Firebase exitosamente.")
except Exception as e:
    print(f"❌ Error al inicializar Firebase: {e}")

# ===========================================================================
# CONSTANTES DEL NEGOCIO
# ===========================================================================
DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
JORNADAS = ['Mañana', 'Tarde', 'Noche']
TOTAL_CUARTOS = 12

# Parejas de doble jornada que el monitor puede asignar desde el escritorio.
# Antes `doble_jornada` era un booleano que volvía a la modelo oficial en las
# TRES jornadas. Ahora son exactamente dos, y en la tercera compite en lista
# de espera como cualquiera.
PAREJAS_DOBLE = ("Mañana-Tarde", "Tarde-Noche", "Noche-Mañana")

# CIERRE DE LA FASE DE PRE-AGENDAMIENTO.
# Abierta jueves, viernes y sábado hasta las 11:59:59 AM.
# Desde las 12:00:01 PM del sábado la programación queda confirmada.
DIA_CIERRE = 6          # sábado (isoweekday)
HORA_CIERRE = 12        # medio día


# --- 2. MODELOS DE DATOS ---
class LoginModelo(BaseModel):
    nombre: str
    password: str

class AccionCuarto(BaseModel):
    room: int
    nombre: str
    estado: str
    jornada: str

class TomarCupo(BaseModel):
    nombre: str
    dia: str
    jornada: str
    room: int
    tipo_semana: str

class PreAgendamiento(BaseModel):
    """Días que la modelo SÍ va a venir, por jornada.

    EL CAMBIO DE CRITERIO
    ---------------------
    Antes se enviaban los días AUSENTES y se asumía que venía el resto. Ahora
    es al revés: por defecto está ausente y marca los días que sí viene. Es
    menos peligroso —un olvido no la compromete a una semana entera— y es lo
    que pidió el estudio.

    `dias` es {"Mañana": ["Lunes", "Martes"], "Tarde": [...], "Noche": [...]}
    """
    nombre: str
    dias: dict = {}
    motivo: str = ""
    foto_base64: str = ""

    # --- Compatibilidad con la página vieja que quede en caché del teléfono.
    # Si llega el formato antiguo se traduce solo. Se puede borrar dentro de
    # un par de semanas, cuando ya nadie tenga la versión anterior.
    jornada: str = ""
    dias_ausente: list = []
    es_doble: bool = False
    jornada_2: str = ""
    dias_ausente_2: list = []

class LiberarTurno(BaseModel):
    nombre: str
    dia: str
    jornada: str
    room: int
    motivo: str
    foto_base64: str = ""
    tipo_semana: str


# --- 3. FUNCIONES DE TIEMPO Y RUTAS BÁSICAS ---
def obtener_fecha_colombia(): return datetime.utcnow() - timedelta(hours=5)

def generar_semana_vacia():
    return {dia: {jor: {str(i): "" for i in range(1, TOTAL_CUARTOS + 1)} for jor in JORNADAS} for dia in DIAS}

def fase_abierta(ahora=None) -> bool:
    """¿Se puede pre-agendar ahora mismo?

    Jueves y viernes completos, y el sábado hasta las 11:59:59 AM.
    """
    ahora = ahora or obtener_fecha_colombia()
    dia = ahora.isoweekday()
    if dia in (4, 5):
        return True
    if dia == DIA_CIERRE:
        return ahora.hour < HORA_CIERRE
    return False

def jornadas_oficiales(perfil: dict) -> set:
    """Jornadas donde la modelo tiene el cupo ASEGURADO.

    - Con pareja asignada: exactamente esas dos.
    - Sin pareja pero con el booleano viejo: las tres (legado, hasta que el
      monitor le asigne su pareja desde el escritorio).
    - Satélites y jornadas raras: ninguna. Siempre van a lista de espera,
      que es justo lo que pidió el estudio.
    """
    tipo = (perfil.get('doble_jornada_tipo') or '').strip()
    if tipo in PAREJAS_DOBLE:
        return {p for p in tipo.split('-') if p in JORNADAS}

    if perfil.get('doble_jornada'):
        return set(JORNADAS)

    propia = perfil.get('jornada')
    return {propia} if propia in JORNADAS else set()

def normalizar_dias(datos: PreAgendamiento) -> dict:
    """Devuelve {jornada: [días que asiste]} venga como venga el payload.

    ⚠️ CUIDADO AL TOCAR ESTO. El formato se decide por los CAMPOS QUE LLEGAN,
    no por si `dias` viene vacío. Si se mirara solo `if datos.dias:`, una
    modelo que no marca ningún día caería en la rama antigua —donde "sin
    ausencias" significa "viene toda la semana"— y quedaría programada los
    siete días sin haberlo pedido. Es justo lo contrario de la regla nueva.
    """
    es_formato_viejo = (not datos.dias) and bool(
        datos.jornada or datos.dias_ausente or datos.es_doble
        or datos.jornada_2 or datos.dias_ausente_2)

    if not es_formato_viejo:
        limpio = {}
        for jornada in JORNADAS:
            marcados = (datos.dias or {}).get(jornada) or []
            limpio[jornada] = [d for d in DIAS if d in marcados]
        return limpio

    # --- Formato antiguo: días AUSENTES. Se invierte. ---
    limpio = {j: [] for j in JORNADAS}
    jor1 = datos.jornada if datos.jornada in JORNADAS else JORNADAS[0]
    limpio[jor1] = [d for d in DIAS if d not in (datos.dias_ausente or [])]
    if datos.es_doble and datos.jornada_2 in JORNADAS:
        limpio[datos.jornada_2] = [d for d in DIAS if d not in (datos.dias_ausente_2 or [])]
    return limpio


# ===========================================================
# REGISTRO DE HISTORIAL (leído por el módulo STATUS ROOM
# del panel de escritorio: colección 'Historial_Asignaciones')
# ===========================================================
# Tope del adjunto. Un documento de Firestore no puede pasar de 1 MiB y aquí
# caben además el motivo y el resto de campos. La web ya comprime la foto a
# ~800 px y JPEG, así que 700 KB es un techo que no se toca nunca; si alguien
# manda algo mayor se guarda el motivo SIN la foto, que es mejor que perder
# el evento entero.
TOPE_FOTO_BASE64 = 700_000


def registrar_historial(room, modelo, accion, jornada, autor, motivo="", dia="", tipo_semana="", foto=""):
    """Guarda un evento de asignación/entrega. Nunca interrumpe la operación principal."""
    try:
        try:
            room_int = int(room)
        except (TypeError, ValueError):
            room_int = 0

        if foto and len(foto) > TOPE_FOTO_BASE64:
            print(f"⚠️ Foto demasiado grande ({len(foto)} car.): se guarda el motivo sin ella.")
            foto = ""

        evento = {
            'room': room_int,
            'modelo': modelo or "Desconocida",
            'accion': accion,
            'jornada': jornada or "",
            'motivo': motivo or "",
            'dia': dia or "",
            'tipo_semana': tipo_semana or "",
            'origen': 'Pagina Web',
            'autor': autor,
            'fecha': firestore.SERVER_TIMESTAMP
        }

        # La foto solo se escribe si la hay: un campo vacío en cada uno de los
        # miles de documentos del historial no le sirve a nadie.
        if foto:
            evento['foto'] = foto

        db.collection('Historial_Asignaciones').add(evento)
    except Exception as e:
        print(f"⚠️ No se pudo registrar el historial: {e}")

@app.get("/")
def leer_raiz(): return {"mensaje": "API funcionando 🚀"}

# --- RUTAS RESTAURADAS PARA EL LOGIN ---
@app.get("/api/monitores")
def obtener_monitores():
    try:
        doc = db.collection('Configuracion').document('Monitores').get()
        if doc.exists: return {"monitores": list(doc.to_dict().get('credenciales', {}).keys()) or doc.to_dict().get('lista', [])}
        return {"monitores": []}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/modelos")
def obtener_modelos():
    try:
        docs = db.collection('Modelos').stream()
        lista_modelos = []
        for d in docs:
            datos = d.to_dict()
            if datos:
                lista_modelos.append({"nombre": datos.get('nombre', d.id), "jornada": datos.get('jornada', 'Todas')})
        return {"modelos": lista_modelos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
# ----------------------------------------


def calcular_aviso_login(nombre: str) -> str:
    """Aviso que ve la modelo nada más entrar.

    Si aplicó (quedó ::PENDIENTE) a una jornada que ya no tiene ni un cupo
    vacío, se le dice de frente en vez de que lo descubra sola mirando la
    grilla. Se calcula leyendo el documento que la página va a leer de todos
    modos: no cuesta ninguna lectura extra que no se fuera a hacer.
    """
    try:
        doc = db.collection('Estado_Estudio').document('Proxima_Semana').get()
        if not doc.exists:
            return ""
        semana = doc.to_dict().get("programacion", {})

        en_espera = set()
        libres = {j: 0 for j in JORNADAS}

        for dia in DIAS:
            for jor in JORNADAS:
                cuartos = semana.get(dia, {}).get(jor, {})
                for valor in cuartos.values():
                    if valor == "":
                        libres[jor] += 1
                    elif "::PENDIENTE" in valor and valor.split("::")[0] == nombre:
                        en_espera.add(jor)

        llenas = [j for j in en_espera if libres[j] == 0]
        if not llenas:
            return ""

        if len(llenas) == 1:
            return (f"Lamentablemente la jornada {llenas[0]} a la que aplicaste "
                    f"tomó todos los cupos. Se te avisará cuando desocupen uno.")
        return (f"Lamentablemente las jornadas {' y '.join(llenas)} a las que "
                f"aplicaste tomaron todos los cupos. Se te avisará cuando "
                f"desocupen uno.")
    except Exception as e:
        print(f"⚠️ No se pudo calcular el aviso de login: {e}")
        return ""


@app.post("/api/modelos/login")
def login_modelo(datos: LoginModelo):
    try:
        query = db.collection('Modelos').where('nombre', '==', datos.nombre).limit(1).get()
        if not query: raise HTTPException(status_code=404, detail="El nombre de la modelo no existe.")
        modelo_data = query[0].to_dict()
        password_bd = modelo_data.get('password', '')
        if not password_bd or password_bd != datos.password: raise HTTPException(status_code=401, detail="Contraseña incorrecta.")

        nombre = modelo_data.get('nombre', datos.nombre)
        return {
            "mensaje": "Login exitoso",
            "nombre": nombre,
            "jornada": modelo_data.get('jornada', 'Todas'),
            "doble_jornada_tipo": modelo_data.get('doble_jornada_tipo', '') or "",
            "aviso": calcular_aviso_login(nombre),
        }
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/cuartos")
def obtener_cuartos():
    try:
        doc_ref = db.collection('Estado_Estudio').document('Cuartos_Hoy')
        doc = doc_ref.get()
        if not doc.exists:
            cuartos = {str(i): {"nombre": "", "estado": "DISPONIBLE"} for i in range(1, TOTAL_CUARTOS + 1)}
            doc_ref.set(cuartos)
            return {"cuartos": cuartos}
        return {"cuartos": doc.to_dict()}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/cuartos/actualizar")
def actualizar_cuarto(accion: AccionCuarto):
    try:
        doc_ref = db.collection('Estado_Estudio').document('Cuartos_Hoy')

        # Leemos el estado previo ANTES de sobrescribir, para saber quién
        # estaba en el cuarto cuando la modelo lo entrega.
        snap = doc_ref.get()
        datos_previos = snap.to_dict() if snap.exists else {}
        prev = datos_previos.get(str(accion.room), {})
        if not isinstance(prev, dict): prev = {}
        ocupante_previo = prev.get('nombre', '')
        jornada_previa = prev.get('jornada', '')

        doc_ref.update({
            str(accion.room): {
                "nombre": accion.nombre,
                "estado": accion.estado,
                "jornada": accion.jornada,
                "ultima_modificacion": firestore.SERVER_TIMESTAMP
            }
        })

        # --- REGISTRO EN HISTORIAL ---
        if accion.estado == "OCUPADA" and accion.nombre != "":
            registrar_historial(
                room=accion.room,
                modelo=accion.nombre,
                accion="Toma de Cuarto",
                jornada=accion.jornada,
                autor=f"Modelo ({accion.nombre})"
            )
        else:
            quien = ocupante_previo or accion.nombre
            registrar_historial(
                room=accion.room,
                modelo=quien,
                accion="Entrega Voluntaria",
                jornada=accion.jornada or jornada_previa,
                autor=f"Modelo ({quien})" if quien else "Pagina Web"
            )
        # -----------------------------

        if accion.estado == "OCUPADA" and accion.nombre != "":
            hoy_str = obtener_fecha_colombia().strftime('%A')
            dias_es = {'Monday':'Lunes', 'Tuesday':'Martes', 'Wednesday':'Miércoles', 'Thursday':'Jueves', 'Friday':'Viernes', 'Saturday':'Sábado', 'Sunday':'Domingo'}
            dia_actual = dias_es.get(hoy_str, 'Lunes')
            doc_ref_sem = db.collection('Estado_Estudio').document('Semana_Actual')
            doc = doc_ref_sem.get()
            if doc.exists:
                semana = doc.to_dict().get("programacion", generar_semana_vacia())
                for r in range(1, TOTAL_CUARTOS + 1):
                    if semana[dia_actual][accion.jornada][str(r)] == accion.nombre: semana[dia_actual][accion.jornada][str(r)] = ""
                semana[dia_actual][accion.jornada][str(accion.room)] = accion.nombre
                doc_ref_sem.update({"programacion": semana})
        return {"mensaje": "Actualizado"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

# --- 4. MOTOR INTELIGENTE DE AGENDAMIENTO ---

def verificar_y_actualizar_semana():
    ahora = obtener_fecha_colombia()
    año, semana_iso, dia_semana = ahora.isocalendar()
    semana_logica = semana_iso + 1 if dia_semana == 7 else semana_iso

    doc_meta = db.collection('Estado_Estudio').document('Metadatos').get()
    ultima_semana = doc_meta.to_dict().get('semana_en_curso', 0) if doc_meta.exists else 0

    if ultima_semana == 0:
        db.collection('Estado_Estudio').document('Metadatos').set({"semana_en_curso": semana_logica, "ya_agendados": {}})
        return

    if semana_logica != ultima_semana:
        doc_prox = db.collection('Estado_Estudio').document('Proxima_Semana').get()
        datos_prox = doc_prox.to_dict().get("programacion", generar_semana_vacia()) if doc_prox.exists else generar_semana_vacia()

        for d in datos_prox:
            for j in datos_prox[d]:
                for r in datos_prox[d][j]:
                    if "::PENDIENTE" in datos_prox[d][j][r]:
                        datos_prox[d][j][r] = datos_prox[d][j][r].replace("::PENDIENTE", "")

        db.collection('Estado_Estudio').document('Semana_Actual').set({"programacion": datos_prox})
        db.collection('Estado_Estudio').document('Proxima_Semana').set({"programacion": generar_semana_vacia()})
        db.collection('Estado_Estudio').document('Metadatos').set({"semana_en_curso": semana_logica, "ya_agendados": {}})

@app.get("/api/semana")
def obtener_semana():
    try:
        verificar_y_actualizar_semana()
        doc_actual = db.collection('Estado_Estudio').document('Semana_Actual').get()
        semana_actual = doc_actual.to_dict().get("programacion", generar_semana_vacia()) if doc_actual.exists else generar_semana_vacia()

        doc_prox = db.collection('Estado_Estudio').document('Proxima_Semana').get()
        semana_proxima = doc_prox.to_dict().get("programacion", generar_semana_vacia()) if doc_prox.exists else generar_semana_vacia()

        docs = db.collection('Modelos').stream()
        perfiles = {}
        conteo_oficiales = {j: 0 for j in JORNADAS}

        for d in docs:
            data = d.to_dict()
            nom = data.get('nombre', d.id)
            oficiales = jornadas_oficiales(data)
            perfiles[nom] = {
                "cuarto_fijo": data.get('cuarto_fijo', None),
                "doble_jornada": bool(data.get('doble_jornada', False)),
                "doble_jornada_tipo": data.get('doble_jornada_tipo', '') or "",
                "jornada": data.get('jornada', 'Todas'),
                "jornadas_oficiales": sorted(oficiales),
            }
            # "Modelos oficiales de esa jornada": las que tienen el cupo
            # asegurado ahí. Una de doble Mañana-Tarde cuenta en las dos.
            for jornada in oficiales:
                conteo_oficiales[jornada] += 1

        doc_meta = db.collection('Estado_Estudio').document('Metadatos').get()
        meta_data = doc_meta.to_dict() if doc_meta.exists else {}
        ya_agendados = meta_data.get('ya_agendados', {})

        # Cuántas oficiales de cada jornada NO han hecho todavía su
        # programación. Es el número que se le enseña a la que está en lista
        # de espera: mientras queden por agendarse, su cupo no está decidido.
        faltantes = dict(conteo_oficiales)
        for nom in ya_agendados:
            for jornada in perfiles.get(nom, {}).get("jornadas_oficiales", []):
                faltantes[jornada] = max(0, faltantes[jornada] - 1)

        # Cupos todavía vacíos en la próxima semana, por jornada.
        libres = {j: 0 for j in JORNADAS}
        for dia in DIAS:
            for jor in JORNADAS:
                for valor in semana_proxima.get(dia, {}).get(jor, {}).values():
                    if valor == "":
                        libres[jor] += 1

        return {
            "semana_actual": semana_actual,
            "proxima_semana": semana_proxima,
            "perfiles": perfiles,
            "conteo_oficiales": conteo_oficiales,
            "faltantes": faltantes,
            "cupos_libres": libres,
            "selecciones_previas": ya_agendados,
            "fase_abierta": fase_abierta(),
        }
    except Exception as e:
        print(f"❌ Error en /api/semana: {e}")
        raise HTTPException(status_code=500, detail="Error de DB")

def _asignar_cuarto(semana, dia, jor, nombre, cuarto_fijo, es_oficial):
    valor_a_guardar = nombre if es_oficial else f"{nombre}::PENDIENTE"
    if es_oficial and cuarto_fijo:
        r_str = str(cuarto_fijo)
        ocupante = semana[dia][jor].get(r_str, "")
        if ocupante == "" or "::PENDIENTE" in ocupante:
            semana[dia][jor][r_str] = valor_a_guardar
            return
    for r in range(1, TOTAL_CUARTOS + 1):
        if semana[dia][jor][str(r)] == "":
            semana[dia][jor][str(r)] = valor_a_guardar
            return
    if es_oficial:
        for r in range(1, TOTAL_CUARTOS + 1):
            if "::PENDIENTE" in semana[dia][jor][str(r)]:
                semana[dia][jor][str(r)] = valor_a_guardar
                return

@app.post("/api/semana/pre_agendar")
def pre_agendar_semana(datos: PreAgendamiento):
    try:
        if not fase_abierta():
            raise HTTPException(status_code=403, detail="Fase cerrada.")

        doc_ref = db.collection('Estado_Estudio').document('Proxima_Semana')
        doc = doc_ref.get()
        semana = doc.to_dict().get("programacion", generar_semana_vacia()) if doc.exists else generar_semana_vacia()

        # Se borra de TODA la semana antes de volver a colocarla: así no
        # quedan restos de una programación anterior.
        for d in DIAS:
            for j in JORNADAS:
                for r in range(1, TOTAL_CUARTOS + 1):
                    if datos.nombre in semana[d][j][str(r)]:
                        semana[d][j][str(r)] = ""

        perfil_ref = db.collection('Modelos').where('nombre', '==', datos.nombre).limit(1).get()
        perfil = perfil_ref[0].to_dict() if perfil_ref else {}
        cuarto_fijo = perfil.get('cuarto_fijo')
        oficiales = jornadas_oficiales(perfil)

        dias_por_jornada = normalizar_dias(datos)

        for jornada in JORNADAS:
            es_oficial = jornada in oficiales
            for dia in dias_por_jornada.get(jornada, []):
                _asignar_cuarto(semana, dia, jornada, datos.nombre, cuarto_fijo, es_oficial)

        doc_ref.set({"programacion": semana})

        doc_meta = db.collection('Estado_Estudio').document('Metadatos').get()
        meta_data = doc_meta.to_dict() if doc_meta.exists else {}
        ya_agen = meta_data.get('ya_agendados', {})

        ya_agen[datos.nombre] = {
            "dias": dias_por_jornada,
            "motivo": datos.motivo or "",
        }

        db.collection('Estado_Estudio').document('Metadatos').set({"ya_agendados": ya_agen}, merge=True)

        # --- REGISTRO EN HISTORIAL (un solo evento resumen) ---
        partes = []
        for jornada in JORNADAS:
            marcados = dias_por_jornada.get(jornada, [])
            if marcados:
                estado = "oficial" if jornada in oficiales else "lista de espera"
                partes.append(f"{jornada} ({estado}): {', '.join(marcados)}")
        resumen = " | ".join(partes) if partes else "Sin días marcados"
        if datos.motivo:
            resumen += f" | Motivo: {datos.motivo}"

        registrar_historial(
            room=0,
            modelo=datos.nombre,
            accion="Pre-Agendamiento",
            jornada=", ".join(j for j in JORNADAS if dias_por_jornada.get(j)),
            autor=f"Modelo ({datos.nombre})",
            motivo=resumen,
            tipo_semana="proxima",
            foto=datos.foto_base64
        )
        # ------------------------------------------------------

        return {"mensaje": "Guardado exitosamente.", "dias": dias_por_jornada}
    except HTTPException: raise
    except Exception as e:
        print(f"❌ Error en pre_agendar: {e}")
        raise HTTPException(status_code=500, detail="Error en servidor.")

@app.post("/api/semana/tomar_cupo")
def tomar_cupo(datos: TomarCupo):
    try:
        doc_ref = db.collection('Estado_Estudio').document('Semana_Actual')
        semana = doc_ref.get().to_dict().get("programacion", generar_semana_vacia())

        ocupante = semana[datos.dia][datos.jornada].get(str(datos.room), "")
        if ocupante not in ("", datos.nombre):
            raise HTTPException(status_code=409,
                                detail="Ese cupo lo acaba de tomar alguien más.")

        for r in range(1, TOTAL_CUARTOS + 1):
            if semana[datos.dia][datos.jornada][str(r)] == datos.nombre: semana[datos.dia][datos.jornada][str(r)] = ""
        semana[datos.dia][datos.jornada][str(datos.room)] = datos.nombre
        doc_ref.update({"programacion": semana})

        # --- REGISTRO EN HISTORIAL ---
        registrar_historial(
            room=datos.room,
            modelo=datos.nombre,
            accion="Toma de Cupo",
            jornada=datos.jornada,
            autor=f"Modelo ({datos.nombre})",
            dia=datos.dia,
            tipo_semana=datos.tipo_semana
        )
        # -----------------------------

        return {"mensaje": "Cupo tomado"}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/semana/liberar")
def liberar_turno(datos: LiberarTurno):
    try:
        doc_name = 'Semana_Actual' if datos.tipo_semana == "actual" else 'Proxima_Semana'
        db.collection('Estado_Estudio').document(doc_name).update({f"programacion.{datos.dia}.{datos.jornada}.{datos.room}": ""})

        # --- REGISTRO EN HISTORIAL ---
        # OJO: hasta ahora `foto_base64` llegaba aquí y se TIRABA. El campo
        # existía en el modelo de datos desde el principio, la web lo mandaba
        # vacío y nadie guardaba nada. Ahora se conserva, y es lo que el
        # monitor ve en SEGUIMIENTO al pulsar «Motivos de inasistencia».
        registrar_historial(
            room=datos.room,
            modelo=datos.nombre,
            accion="Liberación Turno",
            jornada=datos.jornada,
            autor=f"Modelo ({datos.nombre})",
            motivo=datos.motivo,
            dia=datos.dia,
            tipo_semana=datos.tipo_semana,
            foto=datos.foto_base64
        )
        # -----------------------------

        return {"mensaje": "Turno liberado."}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail="Error al liberar.")


# ===========================================================================
# 5. MÓDULO DE REUNIONES MEET (página móvil de monitores)
# ===========================================================================
# Vive en reuniones.py como router independiente. Añade:
#     POST /api/reuniones        crea la sala de Meet y la registra
#     GET  /api/reuniones/hoy    historial del día
#     GET  /api/reuniones/salud  diagnóstico
#
# Va envuelto en try/except A PROPÓSITO: si faltara una librería de Google o
# la variable GOOGLE_TOKEN_JSON, un error aquí tumbaría TODA la API y con ella
# turnos.html, que es lo que hoy usan las modelos. Así, si el módulo nuevo
# falla, el resto sigue funcionando y el motivo queda escrito en los logs de
# Render.
try:
    from reuniones import router as router_reuniones
    app.include_router(router_reuniones)
    print("✅ Router de reuniones cargado correctamente.")
except Exception as e:
    print(f"⚠️ No se pudo cargar el router de reuniones: {e}")
    print("   Revisa que reuniones.py esté en la misma carpeta que main.py y")
    print("   que requirements.txt incluya google-api-python-client y google-auth.")
