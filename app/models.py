from . import db, MUSICA_OPCIONES


class Guion(db.Model):
    __tablename__ = 'guion'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(200), nullable=False)
    descripcion = db.Column(db.String(500), nullable=False)
    textos = db.relationship('Texto', backref='guion', lazy=True)

class Texto(db.Model):
    __tablename__ = 'texto'
    id = db.Column(db.Integer, primary_key=True)
    numero_de_nota = db.Column(db.Integer, nullable=False)
    titulo = db.Column(db.String(100), nullable=False)
    contenido = db.Column(db.String(500), nullable=False)
    material = db.Column(db.String(500), nullable=True)
    activo = db.Column(db.Boolean, default=False)
    guion_id = db.Column(db.Integer, db.ForeignKey('guion.id'), nullable=False)
    musica = db.Column(db.String(50), nullable=True)
    graphs = db.relationship('Graph', backref='texto', cascade="all, delete-orphan", lazy=True)

    def set_musica(self, value):
        if value not in MUSICA_OPCIONES:
            raise ValueError(f"'{value}' no es una opción válida para música.")
        self.musica = value

class Graph(db.Model):
    __tablename__ = 'graph'
    id = db.Column(db.Integer, primary_key=True)
    primera_linea = db.Column(db.String(200), nullable=False)
    segunda_linea = db.Column(db.String(500), nullable=False)
    entrevistado = db.Column(db.String(100), nullable=False)
    lugar = db.Column(db.String(100), nullable=False)
    texto_id = db.Column(db.Integer, db.ForeignKey('texto.id'), nullable=False)
    tema = db.Column(db.String(100), default=None)
    activo = db.Column(db.Boolean, default=False)