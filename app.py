from flask import Flask, jsonify, request, render_template
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///textos.db'
db = SQLAlchemy(app)


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


# Crear las tablas al iniciar la aplicación
with app.app_context():
    db.create_all()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/principal')
def principal():
    return render_template('principal.html')


@app.route('/textos', methods=['GET', 'POST'])
def textos():
    if request.method == 'POST':
        data = request.json
        nuevo_texto = Texto(
            numero_de_nota=data['numero_de_nota'],
            titulo=data['titulo'],
            contenido=data['contenido'],
            material=data.get('material', ''),
            guion_id=data['guion_id']
        )
        db.session.add(nuevo_texto)
        db.session.commit()
        return jsonify({"mensaje": "Texto agregado"}), 201
    else:
        textos = Texto.query.all()
        return jsonify([{
            "id": t.id,
            "numero_de_nota": t.numero_de_nota,
            "titulo": t.titulo,
            "contenido": t.contenido,
            "material": t.material,
            "activo": t.activo,
            "guion_id": t.guion_id
        } for t in textos])


@app.route('/textos/activo/<int:id>', methods=['PUT'])
def setTextoActivo(id):
    Texto.query.update({Texto.activo: False})
    texto = Texto.query.get(id)
    texto.activo = True
    db.session.commit()
    return jsonify({"mensaje": "Texto activo actualizado"})


@app.route('/siguiente')
def mostrar_texto_activo():
    texto_activo = Texto.query.filter_by(activo=True).first()
    if texto_activo:
        return render_template('siguiente.html', texto=texto_activo)
    else:
        return render_template('siguiente.html', texto=None)


@app.route('/obtener_texto_activo')
def obtener_texto_activo():
    texto_activo = Texto.query.filter_by(activo=True).first()
    if texto_activo:
        return jsonify({
            "numero_de_nota": texto_activo.numero_de_nota,
            "titulo": texto_activo.titulo,
            "contenido": texto_activo.contenido,
            "material": texto_activo.material
        })
    else:
        return jsonify({
            "numero_de_nota": None,
            "titulo": None,
            "contenido": None,
            "material": None
        })


@app.route('/obtener_textos_guion/<int:id>')
def obtener_textos_guion(id):
    guion = Guion.query.get(id)
    if guion:
        return jsonify([{
            "id": t.id,
            "titulo": t.titulo,
            "contenido": t.contenido,
            "material": t.material,
            "numero_de_nota": t.numero_de_nota,
            "activo": t.activo
        } for t in guion.textos])
    else:
        return jsonify({"mensaje": "Guion no encontrado"}), 404


@app.route('/textos/<int:id>', methods=['GET'])
def obtener_texto(id):
    texto = Texto.query.get(id)
    if texto:
        return jsonify({
            "id": texto.id,
            "numero_de_nota": texto.numero_de_nota,
            "titulo": texto.titulo,
            "contenido": texto.contenido,
            "material": texto.material,
            "activo": texto.activo
        })
    else:
        return jsonify({"mensaje": "Texto no encontrado"}), 404


@app.route('/textos/editar/<int:id>', methods=['PUT'])
def editar_texto(id):
    data = request.json
    texto = Texto.query.get(id)
    if texto:
        texto.numero_de_nota = data.get('numero_de_nota', texto.numero_de_nota)
        texto.titulo = data.get('titulo', texto.titulo)
        texto.contenido = data.get('contenido', texto.contenido)
        texto.material = data.get('material', texto.material)
        db.session.commit()
        return jsonify({"mensaje": "Texto actualizado"})
    else:
        return jsonify({"mensaje": "Texto no encontrado"}), 404


@app.route('/textos/borrar/<int:id>', methods=['DELETE'])
def borrar_texto(id):
    texto = Texto.query.get(id)
    if texto:
        db.session.delete(texto)
        db.session.commit()
        return jsonify({"mensaje": "Texto eliminado"})
    else:
        return jsonify({"mensaje": "Texto no encontrado"}), 404


@app.route('/guiones', methods=['GET', 'POST'])
def guiones():
    if request.method == 'POST':
        data = request.json
        nuevo_guion = Guion(
            nombre=data['nombre'],
            descripcion=data['descripcion']
        )
        db.session.add(nuevo_guion)
        db.session.commit()
        return jsonify({"mensaje": "Guion creado", "id": nuevo_guion.id}), 201
    else:
        guiones = Guion.query.all()
        return jsonify([{"id": g.id, "nombre": g.nombre, "descripcion": g.descripcion} for g in guiones])


@app.route('/guiones/<int:id>', methods=['GET', 'PUT', 'DELETE'])
def guion(id):
    if request.method == 'GET':
        guion = Guion.query.get(id)
        if guion:
            return jsonify({
                "id": guion.id,
                "nombre": guion.nombre,
                "descripcion": guion.descripcion,
                "textos": [{
                    "id": t.id,
                    "numero_de_nota": t.numero_de_nota,
                    "titulo": t.titulo,
                    "contenido": t.contenido,
                    "material": t.material,
                    "activo": t.activo
                } for t in guion.textos]
            })
        else:
            return jsonify({"mensaje": "Guion no encontrado"}), 404
    elif request.method == 'PUT':
        data = request.json
        guion = Guion.query.get(id)
        if guion:
            guion.nombre = data.get('nombre', guion.nombre)
            guion.descripcion = data.get('descripcion', guion.descripcion)
            db.session.commit()
            return jsonify({"mensaje": "Guion actualizado"})
        else:
            return jsonify({"mensaje": "Guion no encontrado"}), 404
    elif request.method == 'DELETE':
        guion = Guion.query.get(id)
        if guion:
            db.session.delete(guion)
            db.session.commit()
            return jsonify({"mensaje": "Guion eliminado"})
        else:
            return jsonify({"mensaje": "Guion no encontrado"}), 404


@app.route('/listado_guiones')
def listado_guiones():
    guiones = Guion.query.all()
    return render_template('listado_guiones.html', guiones=guiones)


@app.route('/ver_guion/<int:id>')
def ver_guion(id):
    guion = Guion.query.get(id)
    if guion:
        return render_template('ver_guion.html', guion=guion)
    else:
        return "Guion no encontrado", 404


@app.route('/guiones/borrar/<int:id>', methods=['DELETE'])
def borrar_guion(id):
    guion = Guion.query.get(id)
    if guion:
        # Eliminar todos los textos asociados al guion
        for texto in guion.textos:
            db.session.delete(texto)
        db.session.delete(guion)
        db.session.commit()
        return jsonify({"mensaje": "Guion eliminado"})
    else:
        return jsonify({"mensaje": "Guion no encontrado"}), 404


if __name__ == '__main__':
    app.run(debug=True)
