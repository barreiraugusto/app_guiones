from collections import defaultdict

from flask import Blueprint, jsonify, request, render_template, make_response
from sqlalchemy.orm import joinedload, selectinload
from weasyprint import HTML

from .. import db
from ..models import Guion, Texto, Graph, Cita, graph_bajada

guiones_bp = Blueprint('guiones', __name__)


@guiones_bp.route('/guiones', methods=['GET', 'POST'])
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


@guiones_bp.route('/guiones/<int:id>', methods=['GET'])
def obtener_guion(id):
    try:
        # Carga optimizada para la nueva estructura
        guion = db.session.query(Guion).options(
            selectinload(Guion.textos).options(
                selectinload(Texto.graphs).options(
                    selectinload(Graph.bajadas),
                    selectinload(Graph.citas).joinedload(Cita.entrevistado),
                    selectinload(Graph.entrevistados)
                )
            )
        ).get(id)

        if not guion:
            return jsonify({"mensaje": "Guion no encontrado"}), 404

        # Procesamiento para combinar ambas fuentes de entrevistados
        respuesta = {
            "id": guion.id,
            "nombre": guion.nombre,
            "descripcion": guion.descripcion,
            "textos": []
        }

        for texto in guion.textos:
            texto_data = {
                "id": texto.id,
                "numero_de_nota": texto.numero_de_nota,
                "titulo": texto.titulo,
                "duracion": texto.duracion,
                "contenido": texto.contenido,
                "musica": texto.musica,
                "material": texto.material,
                "activo": texto.activo,
                "emitido": texto.emitido,
                "graphs": []
            }

            for graph in texto.graphs:
                # Combinar entrevistados de ambas relaciones
                todos_entrevistados = {}

                # 1. Entrevistados con citas
                for cita in graph.citas:
                    if cita.entrevistado.nombre.strip():
                        todos_entrevistados[cita.entrevistado.id] = {
                            "nombre": cita.entrevistado.nombre,
                            "citas": [cita.texto] if cita.texto.strip() else ["Sin cita"]
                        }

                # 2. Entrevistados sin citas (relación directa)
                for entrevistado in graph.entrevistados:
                    if entrevistado.id not in todos_entrevistados and entrevistado.nombre.strip():
                        todos_entrevistados[entrevistado.id] = {
                            "nombre": entrevistado.nombre,
                            "citas": ["Sin cita"]
                        }

                graph_data = {
                    "id": graph.id,
                    "lugar": graph.lugar,
                    "tema": graph.tema,
                    "activo": graph.activo,
                    "bajadas": [b.texto for b in graph.bajadas],
                    "entrevistados": list(todos_entrevistados.values())
                }
                texto_data["graphs"].append(graph_data)

            respuesta["textos"].append(texto_data)

        return jsonify(respuesta)

    except Exception as e:
        return jsonify({"mensaje": "Error interno", "error": str(e)}), 500


@guiones_bp.route('/guiones/<int:id>', methods=['PUT'])
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
                if 'duracion' in texto_data:
                    texto.duracion = texto_data['duracion']
                if 'contenido' in texto_data:
                    texto.contenido = texto_data['contenido']
                if 'musica' in texto_data:
                    texto.musica = texto_data['musica']
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


@guiones_bp.route('/listado_guiones')
def listado_guiones():
    guiones = Guion.query.all()
    return render_template('listado_guiones.html', guiones=guiones)


@guiones_bp.route('/ver_guion/<int:id>')
def ver_guion(id):
    guion = Guion.query.get(id)
    if guion:
        return render_template('ver_guion.html', guion=guion)
    else:
        return "Guion no encontrado", 404


@guiones_bp.route('/guiones/borrar/<int:id>', methods=['DELETE'])
def borrar_guion(id):
    guion = Guion.query.get(id)
    if not guion:
        return jsonify({"mensaje": "Guion no encontrado"}), 404

    try:
        # Eliminar en cascada manual para evitar problemas
        for texto in guion.textos:
            for graph in texto.graphs:
                # 1. Eliminar las relaciones many-to-many en graph_bajada
                db.session.execute(
                    db.delete(graph_bajada).where(graph_bajada.c.graph_id == graph.id)
                )

                # 2. Eliminar todas las citas asociadas al graph
                for cita in graph.citas:
                    db.session.delete(cita)

                # 3. Finalmente eliminar el graph
                db.session.delete(graph)

            # Eliminar el texto
            db.session.delete(texto)

        # Eliminar el guion
        db.session.delete(guion)
        db.session.commit()

        return jsonify({"mensaje": "Guion eliminado correctamente"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al eliminar: {str(e)}"}), 500


@guiones_bp.route('/exportar_pdf/<int:guion_id>')
def exportar_pdf(guion_id):
    try:
        # Obtener el guion de la base de datos
        guion = Guion.query.get_or_404(guion_id)

        # Renderizar el template HTML con los datos del guion
        html = render_template('guion_pdf.html', guion=guion)

        # Crear un objeto HTML con WeasyPrint
        pdf = HTML(string=html).write_pdf()

        # Limpiar el nombre del guion para usarlo como nombre de archivo
        nombre_archivo = guion.nombre.replace("/", "_").replace("\\", "_").replace(":",
                                                                                   "_")  # Reemplazar caracteres no válidos
        nombre_archivo = nombre_archivo.replace(" ", "_")  # Reemplazar espacios con guiones bajos

        # Crear una respuesta con el PDF
        response = make_response(pdf)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename={nombre_archivo}.pdf'

        return response
    except Exception as e:
        # Registrar el error y devolver una respuesta de error
        print(f"Error al generar el PDF: {e}")
        return "Error al generar el PDF", 500
