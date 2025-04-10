from flask import Blueprint, jsonify, request, render_template, make_response
from weasyprint import HTML

from .. import db
from ..models import Guion

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
                "duracion": t.duracion,
                "contenido": t.contenido,
                "musica": t.musica,
                "material": t.material,
                "activo": t.activo,
                "emitido": t.emitido,
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
    if guion:
        # Eliminar todos los textos asociados al guion
        for texto in guion.textos:
            db.session.delete(texto)
        db.session.delete(guion)
        db.session.commit()
        return jsonify({"mensaje": "Guion eliminado"})
    else:
        return jsonify({"mensaje": "Guion no encontrado"}), 404


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
        nombre_archivo = guion.nombre.replace("/", "_").replace("\\", "_").replace(":", "_")  # Reemplazar caracteres no válidos
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


