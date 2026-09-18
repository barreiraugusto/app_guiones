import os


class Config:
    SECRET_KEY = 'sigpro-secret-2026-xk9'

    # Configuración para PostgreSQL
    SQLALCHEMY_DATABASE_URI = 'postgresql://abarreira:panasonic@localhost/guiones'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB, límite de subida de plantillas

    # Servidor PHP que controla ffmpeg para el módulo de grabación (sistema viejo).
    # Se sigue usando solo si CAPTURADORA_API_URL está vacío.
    RECORDING_SERVER_URL = os.environ.get('RECORDING_SERVER_URL', 'http://192.168.2.62')

    # API de la Capturadora v2 (FastAPI en el mismo equipo de grabación).
    # Con la URL vacía, /grabacion sigue hablando con los PHP viejos.
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
            'options': '-c statement_timeout=5000'
        }
    }
