# app/__init__.py
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db = SQLAlchemy()
migrate = Migrate()

# Definir la lista de opciones de música
MUSICA_OPCIONES = [
    "Titulos", "Movil", "Deporte", "Ultimo momento", "Comunicacion", "Policial", "Tensión",
    "Alegre", "Misterio", "Acción", "Nostálgica", "Épica", "Relajante", "Neutral",
    "Impacto", "Romántica", "Dramática"
]


def create_app():
    app = Flask(__name__)
    app.config.from_object('config.Config')

    db.init_app(app)
    migrate.init_app(app, db)

    from .routes.main import main_bp
    from .routes.guiones import guiones_bp
    from .routes.textos import textos_bp
    from .routes.graphs import graphs_bp
    from .routes.reloj import reloj_bp

    app.register_blueprint(main_bp)
    app.register_blueprint(guiones_bp)
    app.register_blueprint(textos_bp)
    app.register_blueprint(graphs_bp)
    app.register_blueprint(reloj_bp)

    return app
