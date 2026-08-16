import os


class Config:
    # Configuración para PostgreSQL
    SQLALCHEMY_DATABASE_URI = 'postgresql://abarreira:panasonic@localhost/guiones'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Servidor PHP que controla ffmpeg para el módulo de grabación
    RECORDING_SERVER_URL = os.environ.get('RECORDING_SERVER_URL', 'http://192.168.2.62')

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
