class Config:
    SECRET_KEY = 'sigpro-secret-2026-xk9'

    # Configuración para PostgreSQL
    SQLALCHEMY_DATABASE_URI = 'postgresql://abarreira:panasonic@localhost/guiones'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB, límite de subida de plantillas

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
