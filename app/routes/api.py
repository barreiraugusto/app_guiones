"""API de lectura /api/v1 para scripts propios. Detalle en docs/api.md.

Solo lectura: nada de acá escribe en la BD, en display_config.json ni en la
Capturadora. Las rutas /api/* de los otros blueprints las usa el frontend sin
token y no se tocan.
"""

import hmac
import json
from datetime import datetime, timedelta

from flask import Blueprint, abort, current_app, jsonify, request
from werkzeug.exceptions import HTTPException

from .. import db, MUSICA_OPCIONES
from ..models import AuditLog, Bajada, Entrevistado, Graph, Guion, Plantilla, PlantillaCapa, Texto
from . import reloj
from .grabacion import _snapshot
from .graphs import _resolver_mosca

api_bp = Blueprint('api', __name__)

LIMIT_DEFAULT = 100
LIMIT_MAX = 1000


@api_bp.before_request
def _verificar_token():
    token = current_app.config.get('API_TOKEN', '')
    if not token:
        return jsonify({'error': 'API desactivada: falta API_TOKEN'}), 503
    enviado = request.headers.get('Authorization', '')
    # En bytes: compare_digest con str no acepta caracteres no ASCII.
    if not hmac.compare_digest(enviado.encode(), f'Bearer {token}'.encode()):
        return jsonify({'error': 'Token inválido o ausente'}), 401


@api_bp.app_errorhandler(HTTPException)
def _error_http(e):
    # A nivel app para cubrir también las URLs de /api/v1 que no existen
    # (esas no llegan a los handlers del blueprint). El resto, como siempre.
    if not request.path.startswith('/api/v1'):
        return e
    return jsonify({'error': e.description}), e.code


@api_bp.errorhandler(Exception)
def _error_interno(e):
    # Flask prueba los handlers del blueprint antes que los de la app, así que
    # los 404/400 de las vistas caen acá también.
    if isinstance(e, HTTPException):
        return _error_http(e)
    current_app.logger.exception('Error en la API')
    return jsonify({'error': 'Error interno'}), 500


def _paginar(query, serializar):
    limit = request.args.get('limit', LIMIT_DEFAULT, type=int)
    offset = request.args.get('offset', 0, type=int)
    limit = max(1, min(limit, LIMIT_MAX))
    offset = max(0, offset)
    return jsonify({
        'items': [serializar(x) for x in query.limit(limit).offset(offset).all()],
        'total': query.order_by(None).count(),
        'limit': limit,
        'offset': offset,
    })


def _guion_resumen(g):
    return {'id': g.id, 'nombre': g.nombre, 'descripcion': g.descripcion,
            'cantidad_notas': len(g.textos)}


def _nota_resumen(t):
    return {'id': t.id, 'numero_de_nota': t.numero_de_nota, 'titulo': t.titulo,
            'duracion': t.duracion, 'musica': t.musica, 'activo': t.activo,
            'emitido': t.emitido, 'grabar': t.grabar, 'grabado': t.grabado,
            'cantidad_graphs': len(t.graphs)}


def _graph(g):
    return {
        'id': g.id,
        'texto_id': g.texto_id,
        'lugar': g.lugar,
        'tema': g.tema,
        'activo': g.activo,
        'mostrar_lugar': g.mostrar_lugar,
        'mostrar_tema': g.mostrar_tema,
        'plantilla': {'id': g.plantilla.id, 'nombre': g.plantilla.nombre} if g.plantilla else None,
        'bajadas': [{'id': b.id, 'texto': b.texto} for b in sorted(g.bajadas, key=lambda b: b.id)],
        'bajada_activa_id': g.bajada_activa_id,
        'entrevistados': [{'id': e.id, 'nombre': e.nombre}
                          for e in sorted(g.entrevistados, key=lambda e: e.id)],
        'citas': [{'id': c.id, 'texto': c.texto, 'entrevistado_id': c.entrevistado_id}
                  for c in sorted(g.citas, key=lambda c: c.id)],
        'cita_activa_id': g.cita_activa_id,
        'bajadas_auto': {
            'activo': g.bajadas_auto_activo,
            'loop': g.bajadas_auto_loop,
            'duracion_segundos': g.bajadas_auto_duracion_segundos,
            'epoch_inicio': g.bajadas_auto_epoch_inicio,
            'indice_inicio': g.bajadas_auto_indice_inicio,
        },
    }


def _nota(t):
    datos = _nota_resumen(t)
    datos.update({
        'contenido': t.contenido,
        'material': t.material,
        'grabando': t.grabando,
        'recording_id': t.recording_id,
        'archivo': t.archivo,
        'guion': {'id': t.guion.id, 'nombre': t.guion.nombre},
        'graphs': [_graph(g) for g in sorted(t.graphs, key=lambda g: g.id)],
    })
    return datos


def _capa(capa):
    return {col.name: getattr(capa, col.name) for col in PlantillaCapa.__table__.columns}


@api_bp.route('/')
def indice():
    """Lista de endpoints disponibles."""
    rutas = [
        {'ruta': regla.rule,
         'descripcion': (current_app.view_functions[regla.endpoint].__doc__ or '').strip()}
        for regla in current_app.url_map.iter_rules()
        if regla.endpoint.startswith('api.')
    ]
    return jsonify({'rutas': sorted(rutas, key=lambda r: r['ruta'])})


@api_bp.route('/opciones')
def opciones():
    """Valores fijos del sistema (opciones de música)."""
    return jsonify({'musica': MUSICA_OPCIONES})


@api_bp.route('/guiones')
def guiones():
    """Guiones (filtro q por nombre, paginado)."""
    q = Guion.query.order_by(db.func.lower(Guion.nombre).desc(), Guion.id.desc())
    if request.args.get('q'):
        q = q.filter(Guion.nombre.ilike(f"%{request.args['q']}%"))
    return _paginar(q, _guion_resumen)


@api_bp.route('/guiones/<int:id>')
def guion(id):
    """Un guion con el resumen de sus notas."""
    g = db.get_or_404(Guion, id, description=f'Guion {id} no encontrado')
    datos = _guion_resumen(g)
    datos['notas'] = [_nota_resumen(t) for t in sorted(g.textos, key=lambda t: t.numero_de_nota)]
    return jsonify(datos)


@api_bp.route('/notas/<int:id>')
def nota(id):
    """Una nota completa con sus graphs, bajadas, entrevistados y citas."""
    t = db.get_or_404(Texto, id, description=f'Nota {id} no encontrada')
    return jsonify(_nota(t))


@api_bp.route('/graphs/<int:id>')
def graph(id):
    """Un graph con bajadas, entrevistados, citas y plantilla."""
    g = db.get_or_404(Graph, id, description=f'Graph {id} no encontrado')
    return jsonify(_graph(g))


@api_bp.route('/entrevistados')
def entrevistados():
    """Entrevistados (filtro q por nombre, paginado)."""
    q = Entrevistado.query.order_by(Entrevistado.id)
    if request.args.get('q'):
        q = q.filter(Entrevistado.nombre.ilike(f"%{request.args['q']}%"))
    return _paginar(q, lambda e: {'id': e.id, 'nombre': e.nombre, 'cantidad_citas': len(e.citas)})


@api_bp.route('/entrevistados/<int:id>')
def entrevistado(id):
    """Un entrevistado con sus citas."""
    e = db.get_or_404(Entrevistado, id, description=f'Entrevistado {id} no encontrado')
    return jsonify({
        'id': e.id,
        'nombre': e.nombre,
        'cantidad_citas': len(e.citas),
        'citas': [{'id': c.id, 'texto': c.texto, 'graph_id': c.graph_id}
                  for c in sorted(e.citas, key=lambda c: c.id)],
    })


@api_bp.route('/bajadas')
def bajadas():
    """Bajadas (filtro q por texto, paginado)."""
    q = Bajada.query.order_by(Bajada.id)
    if request.args.get('q'):
        q = q.filter(Bajada.texto.ilike(f"%{request.args['q']}%"))
    return _paginar(q, lambda b: {'id': b.id, 'texto': b.texto})


@api_bp.route('/plantillas')
def plantillas():
    """Plantillas gráficas."""
    return jsonify({'items': [
        {'id': p.id, 'nombre': p.nombre, 'ancho': p.ancho, 'alto': p.alto,
         'cantidad_capas': len(p.capas)}
        for p in Plantilla.query.order_by(Plantilla.id).all()
    ]})


@api_bp.route('/plantillas/<int:id>')
def plantilla(id):
    """Una plantilla con todas sus capas."""
    p = db.get_or_404(Plantilla, id, description=f'Plantilla {id} no encontrada')
    return jsonify({'id': p.id, 'nombre': p.nombre, 'ancho': p.ancho, 'alto': p.alto,
                    'capas': [_capa(c) for c in p.capas]})


def _leer_display():
    # Misma ruta relativa que usa graphs.get_display_config, sin su caché.
    try:
        with open('display_config.json') as f:
            config = json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}
    config['mosca'] = _resolver_mosca(config.get('mosca', {}))
    return config


@api_bp.route('/en-vivo')
def en_vivo():
    """Nota y graph activos, cronómetro y config de widgets del aire."""
    nota_activa = Texto.query.filter_by(activo=True).first()
    graph_activo = Graph.query.filter_by(activo=True).first()
    nota = None
    if nota_activa:
        nota = _nota_resumen(nota_activa)
        nota['guion'] = {'id': nota_activa.guion.id, 'nombre': nota_activa.guion.nombre}
    with reloj._lock:
        cronometro = {'segundos': reloj.tiempo, 'activo': reloj.cronometro_activo}
    return jsonify({
        'nota_activa': nota,
        'graph_activo': _graph(graph_activo) if graph_activo else None,
        'cronometro': cronometro,
        'display': _leer_display(),
    })


@api_bp.route('/grabaciones')
def grabaciones():
    """Estado de la Capturadora y de las notas de un guion (guion_id opcional)."""
    guion_id = request.args.get('guion_id', type=int)
    if guion_id:
        db.get_or_404(Guion, guion_id, description=f'Guion {guion_id} no encontrado')
    return jsonify(_snapshot(guion_id, todas=True))


def _fecha(nombre):
    valor = request.args.get(nombre)
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor)
    except ValueError:
        abort(400, f"'{nombre}' no es una fecha ISO válida: {valor}")


@api_bp.route('/auditoria')
def auditoria():
    """Log de auditoría (filtros desde, hasta, nivel, entidad, ip, q; paginado)."""
    q = AuditLog.query.order_by(AuditLog.timestamp.desc())
    desde = _fecha('desde')
    hasta = _fecha('hasta')
    if desde:
        q = q.filter(AuditLog.timestamp >= desde)
    if hasta:
        # Solo fecha (YYYY-MM-DD): incluye el día entero.
        if len(request.args['hasta']) == 10:
            q = q.filter(AuditLog.timestamp < hasta + timedelta(days=1))
        else:
            q = q.filter(AuditLog.timestamp <= hasta)
    if request.args.get('nivel'):
        q = q.filter_by(nivel=request.args['nivel'])
    if request.args.get('entidad'):
        q = q.filter_by(tipo_entidad=request.args['entidad'])
    if request.args.get('ip'):
        q = q.filter(AuditLog.ip.like(f"%{request.args['ip']}%"))
    if request.args.get('q'):
        patron = f"%{request.args['q']}%"
        q = q.filter(db.or_(AuditLog.accion.ilike(patron),
                            AuditLog.nombre_entidad.ilike(patron),
                            AuditLog.detalle.ilike(patron)))
    return _paginar(q, lambda a: {
        'id': a.id, 'timestamp': a.timestamp.isoformat(), 'nivel': a.nivel, 'ip': a.ip,
        'user_agent': a.user_agent, 'accion': a.accion, 'tipo_entidad': a.tipo_entidad,
        'id_entidad': a.id_entidad, 'nombre_entidad': a.nombre_entidad, 'detalle': a.detalle,
    })
