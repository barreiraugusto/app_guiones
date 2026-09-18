"""Módulo de grabación sobre la API de la Capturadora v2.

El estado deja de ser un booleano en la BD: cada nota guarda el `recording_id`
que devuelve el equipo y todo lo demás (duración, tamaño, log, envío al
storage) se lee de la API en vivo.

Las notas del guión se graban siempre con el perfil de redes: sufijo `_9r` y
envío automático a REDES del día en el storage .50.
"""

import json
import time

from flask import Blueprint, jsonify, render_template, request, current_app, Response, stream_with_context

from .. import db
from ..models import Texto
from ..audit import registrar
from .. import capturadora
from ..capturadora import CapturadoraError

grabacion_bp = Blueprint('grabacion', __name__)

# Estados que la API considera "corriendo"
ACTIVOS = {'starting', 'recording', 'stopping'}


# ---------------------------------------------------------------------------
# Vista
# ---------------------------------------------------------------------------

@grabacion_bp.route('/grabaciones')
def vista_grabaciones():
    return render_template('grabacion.html')


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _nombre_para_grabacion(texto):
    """El tema del primer graph manda; si no tiene, el título de la nota."""
    if texto.graphs:
        primero = sorted(texto.graphs, key=lambda g: g.id)[0]
        if primero.tema and primero.tema.strip():
            return primero.tema.strip()
    return texto.titulo


def _perfil_configurado(opciones):
    """Avisa si el perfil de redes no está como corresponde en el equipo.

    Sin `_9r` el material no se reconoce después como material de redes, y sin
    acciones posteriores la grabación nunca llega al storage.
    """
    clave = capturadora.perfil()
    perfiles = {p.get('key'): p for p in (opciones or {}).get('profiles', [])}
    encontrado = perfiles.get(clave)

    if not encontrado:
        return False, (f"El equipo no tiene configurado el perfil '{clave}'. "
                       "Las notas no se pueden grabar hasta agregarlo en config.json.")
    if encontrado.get('filename_suffix') != '_9r':
        return False, (f"El perfil '{clave}' no usa el sufijo _9r "
                       f"(usa '{encontrado.get('filename_suffix')}'): el material no se va a "
                       "reconocer como material de redes.")
    if not encontrado.get('post_actions'):
        return False, (f"El perfil '{clave}' no tiene acciones posteriores: "
                       "la grabación no se va a enviar a REDES del storage.")
    return True, None


def _tareas_por_grabacion(tareas):
    por_id = {}
    for tarea in tareas:
        por_id.setdefault(tarea.get('recording_id'), []).append(tarea)
    return por_id


def _estado_de_nota(texto, activas, terminadas, tareas_por_id):
    """Cruza la nota con lo que dice el equipo."""
    base = {
        'id': texto.id,
        'numero_de_nota': texto.numero_de_nota,
        'titulo': texto.titulo,
        'nombre_archivo': _nombre_para_grabacion(texto),
        'recording_id': texto.recording_id,
        'archivo': texto.archivo,
        'estado': 'pendiente',
        'duration_seconds': None,
        'size_bytes': None,
        'error': None,
        'envio': None,
    }

    if not texto.recording_id:
        return base

    ficha = activas.get(texto.recording_id) or terminadas.get(texto.recording_id)
    if ficha:
        base['archivo'] = ficha.get('output') or texto.archivo
        base['duration_seconds'] = ficha.get('duration_seconds')
        base['size_bytes'] = ficha.get('size_bytes')
        base['error'] = ficha.get('error')
        estado_api = ficha.get('status')
        if estado_api in ACTIVOS:
            base['estado'] = 'deteniendo' if estado_api == 'stopping' else 'grabando'
        elif estado_api == 'failed':
            base['estado'] = 'fallo'
        else:
            base['estado'] = 'grabada'
    else:
        # El servicio se reinició y ya no la recuerda: vale lo último de la BD.
        base['estado'] = 'grabada' if texto.grabado else 'pendiente'

    for tarea in tareas_por_id.get(texto.recording_id, []):
        estado_tarea = tarea.get('estado')
        base['envio'] = {
            'nombre': tarea.get('nombre'),
            'estado': estado_tarea,
            'error': tarea.get('error'),
        }
        if estado_tarea in ('en_cola', 'ejecutando') and base['estado'] == 'grabada':
            base['estado'] = 'enviando'
        elif estado_tarea == 'fallido':
            base['estado'] = 'fallo_envio'
        if estado_tarea in ('en_cola', 'ejecutando', 'fallido'):
            break

    return base


def _snapshot(guion_id, incluir_contexto=True):
    """Todo lo que la vista necesita en un tick."""
    datos = {
        'ok': True,
        'error': None,
        'perfil': capturadora.perfil(),
        'perfil_ok': True,
        'perfil_aviso': None,
        'equipo': None,
        'notas': [],
        'otras': [],
        'tareas': [],
    }

    try:
        estado = capturadora.estado()
        tareas = capturadora.tareas_posteriores().get('tareas', [])
    except CapturadoraError as exc:
        datos['ok'] = False
        datos['error'] = str(exc)
        return datos

    activas = {r['id']: r for r in estado.get('active', [])}
    datos['equipo'] = {
        'recording': estado.get('recording', False),
        'inputs': estado.get('inputs', {}),
        'disk': estado.get('disk', {}),
        'envios_pendientes': estado.get('envios_pendientes', 0),
        'timestamp': estado.get('timestamp'),
    }
    datos['tareas'] = tareas[:10]

    tareas_por_id = _tareas_por_grabacion(tareas)

    notas = []
    if guion_id:
        notas = (Texto.query
                 .filter_by(guion_id=guion_id, grabar=True)
                 .order_by(Texto.numero_de_nota)
                 .all())

    # Las grabaciones que la API ya no tiene entre las activas se piden de a una:
    # es la única forma de saber si terminaron bien o con error.
    terminadas = {}
    for texto in notas:
        if texto.recording_id and texto.recording_id not in activas:
            try:
                terminadas[texto.recording_id] = capturadora.grabacion(texto.recording_id)
            except CapturadoraError:
                pass

    datos['notas'] = [_estado_de_nota(t, activas, terminadas, tareas_por_id) for t in notas]

    # Lo que graba el equipo sin ser una nota de este guión (scheduler, tablet de redes)
    ids_del_guion = {t.recording_id for t in notas if t.recording_id}
    datos['otras'] = [r for rid, r in activas.items() if rid not in ids_del_guion]

    if incluir_contexto:
        try:
            ok, aviso = _perfil_configurado(capturadora.opciones())
            datos['perfil_ok'] = ok
            datos['perfil_aviso'] = aviso
        except CapturadoraError:
            pass
        try:
            datos['programaciones'] = capturadora.programaciones().get('schedules', [])
        except CapturadoraError:
            datos['programaciones'] = []

    return datos


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------

@grabacion_bp.route('/api/grabacion/estado')
def estado_grabacion():
    guion_id = request.args.get('guion_id', type=int)
    return jsonify(_snapshot(guion_id))


@grabacion_bp.route('/stream_grabacion')
def stream_grabacion():
    """Estado del equipo en vivo. La Capturadora tiene WebSocket, pero acá
    alcanza con seguir el patrón SSE que ya usa el resto de la app."""
    guion_id = request.args.get('guion_id', type=int)

    def event_stream():
        tick = 0
        while True:
            try:
                # El perfil y las programaciones cambian poco: cada 30 s.
                datos = _snapshot(guion_id, incluir_contexto=(tick % 15 == 0))
                yield f"data: {json.dumps(datos)}\n\n"
            except Exception as e:
                current_app.logger.error(f"Error en stream_grabacion: {str(e)}")
                yield "event: error\ndata: {}\n\n"
                time.sleep(5)
                continue
            finally:
                db.session.remove()
            tick += 1
            time.sleep(2)

    return Response(stream_with_context(event_stream()),
                    content_type='text/event-stream',
                    headers={'X-Accel-Buffering': 'no'})


@grabacion_bp.route('/api/grabacion/log/<int:texto_id>')
def log_grabacion(texto_id):
    texto = Texto.query.get(texto_id)
    if not texto:
        return jsonify({'error': 'Nota no encontrada'}), 404
    if not texto.recording_id:
        return jsonify({'log': []})
    try:
        return jsonify(capturadora.log(texto.recording_id))
    except CapturadoraError as exc:
        return jsonify({'error': str(exc)}), 502


# ---------------------------------------------------------------------------
# Escritura
# ---------------------------------------------------------------------------

@grabacion_bp.route('/api/grabacion/iniciar', methods=['POST'])
def iniciar_grabacion():
    data = request.json or {}
    texto = Texto.query.get(data.get('texto_id'))
    if not texto:
        return jsonify({'error': 'Nota no encontrada'}), 404

    nombre = _nombre_para_grabacion(texto)

    try:
        ficha = capturadora.iniciar(nombre)
    except CapturadoraError as exc:
        return jsonify({'error': str(exc)}), 502

    # Solo una nota grabando a la vez, igual que antes.
    Texto.query.filter(Texto.id != texto.id, Texto.grabando == True).update({Texto.grabando: False})
    texto.recording_id = ficha.get('id')
    texto.archivo = ficha.get('output')
    texto.grabando = True
    texto.grabado = False
    db.session.commit()

    registrar('WARNING',
              f'Inició la grabación de la nota #{texto.numero_de_nota}: {texto.titulo}',
              'texto', texto.id, texto.titulo,
              f"Archivo: {texto.archivo} · perfil {ficha.get('profile_key')} · id {texto.recording_id}")

    return jsonify({'ok': True, 'grabacion': ficha, 'nombre_archivo': nombre})


@grabacion_bp.route('/api/grabacion/detener', methods=['POST'])
def detener_grabacion():
    data = request.json or {}
    texto = Texto.query.get(data.get('texto_id'))
    if not texto:
        return jsonify({'error': 'Nota no encontrada'}), 404
    if not texto.recording_id:
        return jsonify({'error': 'Esa nota no tiene ninguna grabación asociada'}), 400

    try:
        ficha = capturadora.detener(texto.recording_id)
    except CapturadoraError as exc:
        return jsonify({'error': str(exc)}), 502

    texto.grabando = False
    texto.grabado = ficha.get('status') != 'failed'
    texto.archivo = ficha.get('output') or texto.archivo
    db.session.commit()

    registrar('WARNING',
              f'Detuvo la grabación de la nota #{texto.numero_de_nota}: {texto.titulo}',
              'texto', texto.id, texto.titulo,
              f"Archivo: {texto.archivo} · {ficha.get('duration_seconds')} s")

    return jsonify({'ok': True, 'grabacion': ficha})


@grabacion_bp.route('/api/grabacion/detener-todo', methods=['POST'])
def detener_todo():
    try:
        resultado = capturadora.detener_todo()
    except CapturadoraError as exc:
        return jsonify({'error': str(exc)}), 502

    detenidas = {r.get('id') for r in resultado.get('stopped', [])}
    if detenidas:
        (Texto.query
         .filter(Texto.recording_id.in_(detenidas))
         .update({Texto.grabando: False, Texto.grabado: True}, synchronize_session=False))
        db.session.commit()

    registrar('DANGER', 'Detuvo todas las grabaciones del equipo', 'grabacion', None, None,
              f'{len(detenidas)} grabación(es) detenida(s)')

    return jsonify({'ok': True, 'detenidas': len(detenidas)})
