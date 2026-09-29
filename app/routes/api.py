"""API de lectura /api/v1 para scripts propios. Detalle en docs/api.md.

Solo lectura: nada de acá escribe en la BD, en display_config.json ni en la
Capturadora. Las rutas /api/* de los otros blueprints las usa el frontend sin
token y no se tocan.
"""

import hmac

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import HTTPException

from .. import MUSICA_OPCIONES

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
    current_app.logger.exception('Error en la API')
    return jsonify({'error': 'Error interno'}), 500


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
