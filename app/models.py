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