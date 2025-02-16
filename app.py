from flask import Flask, jsonify, request, render_template
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///textos.db'
db = SQLAlchemy(app)
migrate = Migrate(app, db)


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

    # Relación con Graph con eliminación en cascada
    graphs = db.relationship('Graph', backref='texto', cascade="all, delete-orphan", lazy=True)


class Graph(db.Model):
    __tablename__ = 'graph'
    id = db.Column(db.Integer, primary_key=True)
    primera_linea = db.Column(db.String(200), nullable=False)
    segunda_linea = db.Column(db.String(500), nullable=False)
    entrevistado = db.Column(db.String(100), nullable=False)
    lugar = db.Column(db.String(100), nullable=False)
    texto_id = db.Column(db.Integer, db.ForeignKey('texto.id'), nullable=False)
    tema = db.Column(db.String(100), default=None)  # Nuevo campo
    activo = db.Column(db.Boolean, default=False)


# Crear las tablas al iniciar la aplicación
with app.app_context():
    db.create_all()


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/pantalla')
def pantalla():
    return render_template('pantalla.html')


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
            "guion_id": t.guion_id,
            "graphs": [{
                "id": g.id,
                "primera_linea": g.primera_linea,
                "segunda_linea": g.segunda_linea,
                "entrevistado": g.entrevistado,
                "lugar": g.lugar,
                "tema": g.tema,
                "activo": g.activo
            } for g in t.graphs]
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
            "id": texto_activo.id,
            "numero_de_nota": texto_activo.numero_de_nota,
            "titulo": texto_activo.titulo,
            "contenido": texto_activo.contenido,
            "material": texto_activo.material,
            "activo": texto_activo.activo,
            "guion_id": texto_activo.guion_id,
            "graphs": [{
                "id": g.id,
                "primera_linea": g.primera_linea,
                "segunda_linea": g.segunda_linea,
                "entrevistado": g.entrevistado,
                "lugar": g.lugar
            } for g in texto_activo.graphs]
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
    try:
        texto = Texto.query.get(id)
        if texto:
            # No necesitas eliminar manualmente los Graph, la eliminación en cascada lo hará automáticamente
            db.session.delete(texto)
            db.session.commit()
            return jsonify({"mensaje": "Texto eliminado"})
        else:
            return jsonify({"mensaje": "Texto no encontrado"}), 404
    except Exception as e:
        print(f"Error al borrar el texto: {e}")
        db.session.rollback()  # Revertir la transacción en caso de error
        return jsonify({"mensaje": "Error interno del servidor"}), 500


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


@app.route('/graphs', methods=['POST'])
def crear_graph():
    data = request.json
    if not data or 'primera_linea' not in data or 'segunda_linea' not in data or 'entrevistado' not in data or 'lugar' not in data or 'texto_id' not in data:
        return jsonify({"mensaje": "Datos incompletos"}), 400

    nuevo_graph = Graph(
        primera_linea=data['primera_linea'],
        segunda_linea=data['segunda_linea'],
        entrevistado=data['entrevistado'],
        lugar=data['lugar'],
        tema=data['tema'],
        texto_id=data['texto_id']
    )
    db.session.add(nuevo_graph)
    db.session.commit()
    return jsonify({"mensaje": "Graph creado", "id": nuevo_graph.id}), 201


@app.route('/graphs/<int:id>', methods=['PUT'])
def actualizar_graph(id):
    data = request.json
    graph = Graph.query.get(id)
    if graph:
        graph.primera_linea = data.get('primera_linea', graph.primera_linea)
        graph.segunda_linea = data.get('segunda_linea', graph.segunda_linea)
        graph.entrevistado = data.get('entrevistado', graph.entrevistado)
        graph.lugar = data.get('lugar', graph.lugar)
        graph.tema = data.get('tema', graph.tema)
        db.session.commit()
        return jsonify({"mensaje": "Graph actualizado"})
    else:
        return jsonify({"mensaje": "Graph no encontrado"}), 404


@app.route('/graphs/<int:id>', methods=['DELETE'])
def eliminar_graph(id):
    graph = Graph.query.get(id)
    if graph:
        db.session.delete(graph)
        db.session.commit()
        return jsonify({"mensaje": "Graph eliminado"})
    else:
        return jsonify({"mensaje": "Graph no encontrado"}), 404


@app.route('/graphs/<int:id>', methods=['GET'])
def obtener_graph(id):
    graph = Graph.query.get(id)
    if graph:
        return jsonify({
            "id": graph.id,
            "primera_linea": graph.primera_linea,
            "segunda_linea": graph.segunda_linea,
            "entrevistado": graph.entrevistado,
            "lugar": graph.lugar,
            "tema": graph.tema,
            "texto_id": graph.texto_id
        })
    else:
        return jsonify({"mensaje": "Graph no encontrado"}), 404


@app.route('/textos/<int:texto_id>/graphs', methods=['GET'])
def obtener_graphs_por_texto(texto_id):
    texto = db.session.get(Texto, texto_id)
    if not texto:
        return jsonify({"mensaje": "Texto no encontrado"}), 404
    graphs = Graph.query.filter_by(texto_id=texto_id).all()
    return jsonify([{
        "id": g.id,
        "primera_linea": g.primera_linea,
        "segunda_linea": g.segunda_linea,
        "entrevistado": g.entrevistado,
        "lugar": g.lugar,
        "tema": g.tema
    } for g in graphs])


@app.route('/guiones/<int:id>', methods=['GET'])
def guion(id):
    guion = Guion.query.get(id)
    if guion:
        print(f"Editando este guion {id}")
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
                "activo": t.activo,
                "graphs": [{
                    "id": g.id,
                    "primera_linea": g.primera_linea,
                    "segunda_linea": g.segunda_linea,
                    "entrevistado": g.entrevistado,
                    "lugar": g.lugar,
                    "tema": g.tema
                } for g in t.graphs]
            } for t in guion.textos]
        })
    else:
        return jsonify({"mensaje": "Guion no encontrado"}), 404


@app.route('/guiones/<int:id>', methods=['PUT'])
def editar_guion(id):
    guion = Guion.query.get(id)
    if not guion:
        return jsonify({"mensaje": "Guion no encontrado"}), 404

    # Obtener los datos del cuerpo de la solicitud
    datos = request.get_json()

    # Actualizar los campos del guion con los datos recibidos
    if 'nombre' in datos:
        guion.nombre = datos['nombre']
    if 'descripcion' in datos:
        guion.descripcion = datos['descripcion']

    # Si hay textos en los datos, actualizarlos también
    if 'textos' in datos:
        for texto_data in datos['textos']:
            texto = next((t for t in guion.textos if t.id == texto_data['id']), None)
            if texto:
                if 'numero_de_nota' in texto_data:
                    texto.numero_de_nota = texto_data['numero_de_nota']
                if 'titulo' in texto_data:
                    texto.titulo = texto_data['titulo']
                if 'contenido' in texto_data:
                    texto.contenido = texto_data['contenido']
                if 'material' in texto_data:
                    texto.material = texto_data['material']
                if 'activo' in texto_data:
                    texto.activo = texto_data['activo']

                # Si hay graphs en los datos del texto, actualizarlos también
                if 'graphs' in texto_data:
                    for graph_data in texto_data['graphs']:
                        graph = next((g for g in texto.graphs if g.id == graph_data['id']), None)
                        if graph:
                            if 'primera_linea' in graph_data:
                                graph.primera_linea = graph_data['primera_linea']
                            if 'segunda_linea' in graph_data:
                                graph.segunda_linea = graph_data['segunda_linea']
                            if 'entrevistado' in graph_data:
                                graph.entrevistado = graph_data['entrevistado']
                            if 'lugar' in graph_data:
                                graph.lugar = graph_data['lugar']
                            if 'tema' in graph_data:
                                graph.tema = graph_data['tema']

    # Guardar los cambios en la base de datos
    db.session.commit()

    return jsonify({"mensaje": "Guion actualizado correctamente"}), 200


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


@app.route('/control_graphs/<int:id>')
def control_graphs(id):
    guion = Guion.query.get(id)
    if guion:
        return render_template('control_graphs.html', guion=guion)
    else:
        return "Guion no encontrado", 404


@app.route('/graphs/activo/<int:id>', methods=['PUT'])
def setGraphsActivo(id):
    Graph.query.update({Graph.activo: False})
    graph = Graph.query.get(id)
    graph.activo = True
    db.session.commit()
    return jsonify({"mensaje": "Graph activo actualizado"})


@app.route('/obtener_graph_activo')
def obtener_graph_activo():
    graphs_activo = Graph.query.filter_by(activo=True).first()
    if graphs_activo:
        return jsonify({
            "activo": graphs_activo.activo,
            "id": graphs_activo.id,
            "primera_linea": graphs_activo.primera_linea,
            "segunda_linea": graphs_activo.segunda_linea,
            "entrevistado": graphs_activo.entrevistado,
            "lugar": graphs_activo.lugar,
            "tema": graphs_activo.tema
        })
    else:
        return jsonify({
            "numero_de_nota": None,
            "titulo": None,
            "contenido": None,
            "material": None
        })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
