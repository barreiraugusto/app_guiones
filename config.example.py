"""Plantilla de configuración.

`config.py` NO está versionado: cada máquina tiene el suyo (desarrollo, el
server de aire, el de pruebas) con sus propias credenciales. Para instalar:

    cp config.example.py config.py

y editar los valores de abajo. Los secretos —SECRET_KEY, la contraseña de la
base, la clave de la Capturadora— conviene pasarlos por variables de entorno
en vez de escribirlos en el archivo; en el server de aire eso se hace desde
el `environment=` del programa en Supervisor.
"""

import os


class Config:
    # Firma las cookies de sesión: cambiarla invalida las sesiones abiertas.
    SECRET_KEY = os.environ.get('SECRET_KEY', 'cambiar-esta-clave')

    # PostgreSQL: usuario:contraseña@host/base
    SQLALCHEMY_DATABASE_URI = os.environ.get(
        'DATABASE_URL',
        'postgresql://usuario:contrasena@localhost/guiones'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB, límite de subida de plantillas

    # Servidor PHP que controla ffmpeg para el módulo de grabación (sistema viejo).
    # Se sigue usando solo si CAPTURADORA_API_URL está vacío.
    RECORDING_SERVER_URL = os.environ.get('RECORDING_SERVER_URL', 'http://192.168.2.62')

    # API de la Capturadora v2 (FastAPI en el mismo equipo de grabación).
    # La clave sale del entorno: es un secreto y no va escrita acá.
    CAPTURADORA_API_URL = os.environ.get('CAPTURADORA_API_URL', 'http://192.168.2.62:8000')
    CAPTURADORA_API_KEY = os.environ.get('CAPTURADORA_API_KEY', '')
    # Las notas del guión se graban siempre con este perfil: es el que pone el
    # sufijo _9r y dispara el envío a REDES del día en el storage .50.
    CAPTURADORA_PERFIL = os.environ.get('CAPTURADORA_PERFIL', 'redes')

    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 5,
        'max_overflow': 10,
        'pool_pre_ping': True,
        'pool_recycle': 3600,
        'connect_args': {
            'connect_timeout': 5,
            # Corta cualquier consulta que pase de 5s. Ojo al migrar: un
            # ALTER TABLE que espera el lock de la app en marcha muere acá.
            # Parar la app antes de `flask db upgrade`.
            'options': '-c statement_timeout=5000'
        }
    }
