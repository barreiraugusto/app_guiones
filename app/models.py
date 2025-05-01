from . import db, MUSICA_OPCIONES

class Guion(db.Model):
    __tablename__ = 'guion'
    id = db.Column(db.Integer, primary_key=True)
    # Aumenté el tamaño de String para PostgreSQL que maneja mejor textos largos
    nombre = db.Column(db.String(255), nullable=False)
    descripcion = db.Column(db.Text, nullable=True)  # Cambiado a Text para descripciones largas
    textos = db.relationship('Texto', backref='guion', lazy=True, cascade="all, delete-orphan")

class Texto(db.Model):
    __tablename__ = 'texto'
    id = db.Column(db.Integer, primary_key=True)
    numero_de_nota = db.Column(db.Integer, nullable=False, index=True)  # Añadido index
    titulo = db.Column(db.String(255), nullable=False)  # Aumentado tamaño
    contenido = db.Column(db.Text, nullable=False)  # Cambiado a Text para contenido largo
    material = db.Column(db.Text, nullable=True)  # Cambiado a Text
    activo = db.Column(db.Boolean, default=False, nullable=False)  # Explicitado nullable
    emitido = db.Column(db.Boolean, default=False, nullable=False)
    duracion = db.Column(db.String(10), default='00:00', nullable=False)  # Aumentado tamaño
    guion_id = db.Column(db.Integer, db.ForeignKey('guion.id', ondelete="CASCADE"), nullable=False)
    musica = db.Column(db.String(50), nullable=True)
    graphs = db.relationship('Graph', backref='texto', cascade="all, delete-orphan", lazy=True)

    def set_musica(self, value):
        if value not in MUSICA_OPCIONES:
            raise ValueError(f"'{value}' no es una opción válida para música.")
        self.musica = value

class Graph(db.Model):
    __tablename__ = 'graph'
    id = db.Column(db.Integer, primary_key=True)
    primera_linea = db.Column(db.Text, nullable=False)  # Cambiado a Text
    segunda_linea = db.Column(db.Text, nullable=False)  # Cambiado a Text
    entrevistado = db.Column(db.String(255), nullable=False)  # Aumentado tamaño
    lugar = db.Column(db.String(255), nullable=False)  # Aumentado tamaño
    texto_id = db.Column(db.Integer, db.ForeignKey('texto.id', ondelete="CASCADE"), nullable=False)
    tema = db.Column(db.String(255), default=None)  # Aumentado tamaño
    activo = db.Column(db.Boolean, default=False, nullable=False)  # Explicitado nullable