from datetime import datetime

from . import db, MUSICA_OPCIONES
from sqlalchemy import Table, Column, Integer, ForeignKey

# Tabla de relación muchos-a-muchos para Graph y Entrevistado
graph_entrevistado = db.Table(
    'graph_entrevistado',
    db.Column('graph_id', db.Integer, db.ForeignKey('graph.id', ondelete="CASCADE"), primary_key=True),
    db.Column('entrevistado_id', db.Integer, db.ForeignKey('entrevistado.id', ondelete="CASCADE"), primary_key=True)
)


class Guion(db.Model):
    __tablename__ = 'guion'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False)
    descripcion = db.Column(db.Text, nullable=True)
    textos = db.relationship('Texto', backref='guion', lazy=True, cascade="all, delete-orphan")


class Texto(db.Model):
    __tablename__ = 'texto'
    id = db.Column(db.Integer, primary_key=True)
    numero_de_nota = db.Column(db.Integer, nullable=False, index=True)
    titulo = db.Column(db.String(255), nullable=False)
    contenido = db.Column(db.Text, nullable=False)
    material = db.Column(db.Text, nullable=True)
    activo = db.Column(db.Boolean, default=False, nullable=False)
    grabar = db.Column(db.Boolean, default=False, nullable=False)
    emitido = db.Column(db.Boolean, default=False, nullable=False)
    duracion = db.Column(db.String(10), default='00:00', nullable=False)
    guion_id = db.Column(db.Integer, db.ForeignKey('guion.id', ondelete="CASCADE"), nullable=False)
    musica = db.Column(db.String(50), nullable=True)
    graphs = db.relationship('Graph', backref='texto', cascade="all, delete-orphan", lazy=True)

    def set_musica(self, value):
        if value not in MUSICA_OPCIONES:
            raise ValueError(f"'{value}' no es una opción válida para música.")
        self.musica = value


class Entrevistado(db.Model):
    __tablename__ = 'entrevistado'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False)


class Cita(db.Model):
    __tablename__ = 'cita'
    id = db.Column(db.Integer, primary_key=True)
    texto = db.Column(db.String(255), nullable=True)
    entrevistado_id = db.Column(db.Integer, db.ForeignKey('entrevistado.id', ondelete="CASCADE"), nullable=False)
    graph_id = db.Column(db.Integer, db.ForeignKey('graph.id', ondelete="CASCADE"), nullable=False)

    entrevistado = db.relationship('Entrevistado', backref='citas')
    graph = db.relationship('Graph', backref='citas')


class Bajada(db.Model):
    __tablename__ = 'bajada'
    id = db.Column(db.Integer, primary_key=True)
    texto = db.Column(db.String(255), nullable=False)


# Tabla de relación para bajadas
graph_bajada = db.Table(
    'graph_bajada',
    db.Model.metadata,
    Column('graph_id', Integer, ForeignKey('graph.id', ondelete="CASCADE"), primary_key=True),
    Column('bajada_id', Integer, ForeignKey('bajada.id', ondelete="CASCADE"), primary_key=True)
)


class Graph(db.Model):
    __tablename__ = 'graph'
    id = db.Column(db.Integer, primary_key=True)
    lugar = db.Column(db.String(255), nullable=False)
    texto_id = db.Column(db.Integer, db.ForeignKey('texto.id', ondelete="CASCADE"), nullable=False)
    tema = db.Column(db.String(255), default=None)
    activo = db.Column(db.Boolean, default=False, nullable=False)

    # Relación con bajadas
    bajadas = db.relationship('Bajada', secondary=graph_bajada, backref='graphs', lazy='select')

    # Nueva relación directa con entrevistados
    entrevistados = db.relationship(
        'Entrevistado',
        secondary=graph_entrevistado,
        backref=db.backref('graphs', lazy='dynamic'),
        lazy='select'
    )

    plantilla_id = db.Column(db.Integer, db.ForeignKey('plantilla.id', ondelete="SET NULL"), nullable=True)
    plantilla = db.relationship('Plantilla')


class Plantilla(db.Model):
    __tablename__ = 'plantilla'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False, unique=True)
    ancho = db.Column(db.Integer, nullable=False, default=1920)
    alto = db.Column(db.Integer, nullable=False, default=1080)

    capas = db.relationship(
        'PlantillaCapa',
        backref='plantilla',
        cascade="all, delete-orphan",
        order_by='PlantillaCapa.orden',
        lazy=True
    )


class PlantillaCapa(db.Model):
    __tablename__ = 'plantilla_capa'
    id = db.Column(db.Integer, primary_key=True)
    plantilla_id = db.Column(db.Integer, db.ForeignKey('plantilla.id', ondelete="CASCADE"), nullable=False)
    orden = db.Column(db.Integer, nullable=False, default=0)
    tipo = db.Column(db.String(10), nullable=False)  # 'imagen' | 'video' | 'texto'

    x = db.Column(db.Integer, nullable=False, default=0)
    y = db.Column(db.Integer, nullable=False, default=0)
    ancho = db.Column(db.Integer, nullable=False, default=200)
    alto = db.Column(db.Integer, nullable=False, default=100)

    archivo = db.Column(db.String(500), nullable=True)
    loop = db.Column(db.Boolean, nullable=False, default=True)

    campo_dato = db.Column(db.String(20), nullable=True)  # lugar|tema|entrevistado|bajada_1|bajada_2|None
    texto_fijo = db.Column(db.String(255), nullable=True)
    fuente = db.Column(db.String(100), nullable=False, default='Arial')
    tamano_fuente = db.Column(db.Integer, nullable=False, default=24)
    color = db.Column(db.String(20), nullable=False, default='#ffffff')
    alineacion = db.Column(db.String(10), nullable=False, default='left')

    animacion_entrada = db.Column(db.String(10), nullable=False, default='fade')
    animacion_salida = db.Column(db.String(10), nullable=False, default='fade')
    duracion_transicion_ms = db.Column(db.Integer, nullable=False, default=400)


class AuditLog(db.Model):
    """Registro de acciones de usuarios para auditoría."""
    __tablename__ = 'audit_log'

    id             = db.Column(db.Integer, primary_key=True)
    timestamp      = db.Column(db.DateTime, nullable=False, default=datetime.now, index=True)
    nivel          = db.Column(db.String(10),  nullable=False)   # INFO | WARNING | DANGER
    ip             = db.Column(db.String(45),  nullable=False)
    user_agent     = db.Column(db.String(300), nullable=True)
    accion         = db.Column(db.String(255), nullable=False)
    tipo_entidad   = db.Column(db.String(50),  nullable=True)    # guion | texto | graph
    id_entidad     = db.Column(db.Integer,     nullable=True)
    nombre_entidad = db.Column(db.String(255), nullable=True)
    detalle        = db.Column(db.Text,        nullable=True)