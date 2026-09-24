"""Cliente de la API de la Capturadora v2 (FastAPI en el equipo de grabación).

Reemplaza a los PHP sueltos de /var/www/html: acá cada grabación tiene un id,
duración, tamaño y log propios, y el estado lo manda el equipo, no la BD.
"""

import requests
from flask import current_app


class CapturadoraError(RuntimeError):
    """Error al hablar con la Capturadora. El mensaje va tal cual a la vista."""


def habilitada():
    return bool(current_app.config.get('CAPTURADORA_API_URL'))


def perfil():
    return current_app.config.get('CAPTURADORA_PERFIL') or 'redes'


def _url(ruta):
    base = (current_app.config.get('CAPTURADORA_API_URL') or '').rstrip('/')
    if not base:
        raise CapturadoraError('La API de la Capturadora no está configurada (CAPTURADORA_API_URL).')
    return f"{base}{ruta}"


def _headers():
    clave = current_app.config.get('CAPTURADORA_API_KEY') or ''
    return {'X-API-Key': clave} if clave else {}


def _pedir(metodo, ruta, timeout=10, **kwargs):
    try:
        respuesta = requests.request(metodo, _url(ruta), headers=_headers(), timeout=timeout, **kwargs)
    except requests.exceptions.Timeout:
        raise CapturadoraError('La Capturadora no respondió a tiempo.')
    except requests.exceptions.ConnectionError:
        raise CapturadoraError('No se pudo conectar con la Capturadora.')

    if respuesta.status_code >= 400:
        raise CapturadoraError(_detalle(respuesta))

    if not respuesta.content:
        return {}
    try:
        return respuesta.json()
    except ValueError:
        raise CapturadoraError(f'Respuesta inesperada de la Capturadora: {respuesta.text[:200]}')


def _detalle(respuesta):
    """El motivo que manda la API; si no es JSON, el texto crudo."""
    try:
        cuerpo = respuesta.json()
        detalle = cuerpo.get('detail') if isinstance(cuerpo, dict) else None
        if isinstance(detalle, list) and detalle:
            detalle = detalle[0].get('msg', str(detalle[0]))
        if detalle:
            return str(detalle)
    except ValueError:
        pass
    return f'Error {respuesta.status_code} de la Capturadora: {respuesta.text[:200]}'


# ---------------------------------------------------------------------------
# Lectura
# ---------------------------------------------------------------------------

def estado():
    """Snapshot del equipo: qué graba, entradas, disco, envíos pendientes."""
    return _pedir('GET', '/api/status', timeout=5)


def opciones():
    """Entradas y perfiles configurados. Sirve para validar el perfil de redes."""
    return _pedir('GET', '/api/config', timeout=5)


def grabacion(recording_id):
    return _pedir('GET', f'/api/recordings/{recording_id}', timeout=5)


def log(recording_id, lineas=40):
    return _pedir('GET', f'/api/recordings/{recording_id}/log',
                  timeout=5, params={'lines': lineas})


def tareas_posteriores(limite=20):
    """Envíos al storage y demás acciones que quedan corriendo al cerrar."""
    return _pedir('GET', '/api/recordings/tareas/posteriores',
                  timeout=5, params={'limite': limite})


def programaciones():
    return _pedir('GET', '/api/schedules', timeout=5)


def historial(limite=20):
    return _pedir('GET', '/api/history', timeout=5, params={'limit': limite})


# ---------------------------------------------------------------------------
# Escritura
# ---------------------------------------------------------------------------

def iniciar(nombre, subdir=None):
    """Arranca una grabación con el perfil de redes y devuelve su ficha.

    No se manda `input`: va el del equipo. `subdir` es la carpeta (dentro del
    storage del equipo) donde queda el archivo; sin ella se usa la
    `default_subdir` del equipo. El sufijo _9r y el envío a REDES del día los
    pone el perfil, del lado de la Capturadora.
    """
    cuerpo = {'name': nombre, 'profile': perfil(), 'mode': 'continuous'}
    if subdir:
        cuerpo['subdir'] = subdir
    return _pedir('POST', '/api/recordings', timeout=20, json=cuerpo)


def detener(recording_id):
    return _pedir('POST', f'/api/recordings/{recording_id}/stop', timeout=25)


def detener_todo():
    return _pedir('POST', '/api/recordings/stop-all', timeout=25)
