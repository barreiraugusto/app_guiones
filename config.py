import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Configuración para PostgreSQL
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'postgresql://abarreira:panasonic@localhost/guiones')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
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
