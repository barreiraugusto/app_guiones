from flask import Blueprint, jsonify, request, render_template
from ..models import Graph, Texto, Guion
from .. import db

graphs_bp = Blueprint('graphs', __name__)


@graphs_bp.route('/graphs', methods=['POST'])
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


@graphs_bp.route('/graphs/<int:id>', methods=['PUT'])
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


@graphs_bp.route('/graphs/<int:id>', methods=['DELETE'])
def eliminar_graph(id):
    graph = Graph.query.get(id)
    if graph:
        db.session.delete(graph)
        db.session.commit()
        return jsonify({"mensaje": "Graph eliminado"})
    else:
        return jsonify({"mensaje": "Graph no encontrado"}), 404


@graphs_bp.route('/graphs/<int:id>', methods=['GET'])
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


@graphs_bp.route('/textos/<int:texto_id>/graphs', methods=['GET'])
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

@graphs_bp.route('/control_graphs/<int:id>')
def control_graphs(id):
    guion = Guion.query.get(id)
    if guion:
        return render_template('control_graphs.html', guion=guion)
    else:
        return "Guion no encontrado", 404


@graphs_bp.route('/graphs/activo/<int:id>', methods=['PUT'])
def setGraphsActivo(id):
    Graph.query.update({Graph.activo: False})
    graph = Graph.query.get(id)
    graph.activo = True
    db.session.commit()
    return jsonify({"mensaje": "Graph activo actualizado"})


@graphs_bp.route('/obtener_graph_activo')
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
            "musica": None,
            "material": None
        })
