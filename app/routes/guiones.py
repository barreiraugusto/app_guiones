from collections import defaultdict

from flask import Blueprint, jsonify, request, render_template, make_response
from sqlalchemy.orm import joinedload, selectinload
from weasyprint import HTML

from .. import db
from ..models import Guion, Texto, Graph, Cita, graph_bajada, Bajada, Entrevistado

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
                "grabar": texto.grabar,
                "activo": texto.activo,
                "emitido": texto.emitido,
                "graphs": []
            }

            for graph in texto.graphs:
                # Usamos defaultdict para acumular citas por entrevistado
                from collections import defaultdict
                entrevistados_dict = defaultdict(list)

                # 1. Procesar citas con entrevistados
                citas_ordenadas = sorted(graph.citas, key=lambda c: c.id)
                for cita in citas_ordenadas:
                    if cita.entrevistado and cita.entrevistado.nombre.strip():
                        nombre = cita.entrevistado.nombre
                        if cita.texto and cita.texto.strip():
                            entrevistados_dict[nombre].append(cita.texto)

                # 2. Procesar entrevistados sin citas
                for entrevistado in graph.entrevistados:
                    if entrevistado.nombre.strip() and entrevistado.nombre not in entrevistados_dict:
                        entrevistados_dict[entrevistado.nombre] = ["Sin cita"]

                bajadas_ordenadas = sorted(graph.bajadas, key=lambda b: b.id)

                graph_data = {
                    "id": graph.id,
                    "lugar": graph.lugar,
                    "tema": graph.tema,
                    "activo": graph.activo,
                    "bajadas": [b.texto for b in bajadas_ordenadas],
                    "entrevistados": [
                        {
                            "nombre": nombre,
                            "citas": citas
                        } for nombre, citas in entrevistados_dict.items()
                    ]
                }
                texto_data["graphs"].append(graph_data)

            respuesta["textos"].append(texto_data)

        return jsonify(respuesta)

    except Exception as e:
        return jsonify({"mensaje": "Error interno", "error": str(e)}), 500


@guiones_bp.route('/guiones/obtener_guiones', methods=['GET'])
def obtener_guiones():
    """Obtener todos los guiones excepto el actual"""
    try:
        guion_actual_id = request.args.get('excluir_actual', type=int)
        guiones = Guion.query.all()

        resultado = []
        for guion in guiones:
            if guion.id != guion_actual_id:
                resultado.append({
                    'id': guion.id,
                    'nombre': guion.nombre
                })

        return jsonify(resultado)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@guiones_bp.route('/guiones/clonar_notas/<int:guion_origen_id>/<int:guion_destino_id>', methods=['POST'])
def clonar_notas(guion_origen_id, guion_destino_id):
    """Clonar notas de un guion a otro directamente"""
    try:
        guion_origen = Guion.query.options(
            joinedload(Guion.textos).joinedload(Texto.graphs).joinedload(Graph.bajadas),
            joinedload(Guion.textos).joinedload(Texto.graphs).joinedload(Graph.citas).joinedload(Cita.entrevistado)
        ).get_or_404(guion_origen_id)

        guion_destino = Guion.query.get_or_404(guion_destino_id)

        # Obtener IDs de notas seleccionadas del request
        notas_seleccionadas_ids = request.json.get('notas_seleccionadas', [])

        notas_clonadas = []

        for texto in guion_origen.textos:
            if str(texto.id) in notas_seleccionadas_ids:
                # Clonar la nota
                nueva_nota = Texto(
                    numero_de_nota=texto.numero_de_nota,
                    titulo=texto.titulo,
                    contenido=texto.contenido,
                    material=texto.material,
                    grabar=texto.grabar,
                    duracion=texto.duracion,
                    musica=texto.musica,
                    guion_id=guion_destino.id
                )

                db.session.add(nueva_nota)
                db.session.flush()

                # Clonar graphs
                for graph in texto.graphs:
                    nuevo_graph = Graph(
                        lugar=graph.lugar,
                        tema=graph.tema,
                        texto_id=nueva_nota.id
                    )

                    db.session.add(nuevo_graph)
                    db.session.flush()

                    # Clonar bajadas
                    for bajada in graph.bajadas:
                        nueva_bajada = Bajada(texto=bajada.texto)
                        nuevo_graph.bajadas.append(nueva_bajada)

                    # Clonar entrevistados y citas
                    for cita in graph.citas:
                        # Buscar si el entrevistado ya existe en el sistema
                        entrevistado_existente = Entrevistado.query.filter_by(
                            nombre=cita.entrevistado.nombre
                        ).first()

                        if not entrevistado_existente:
                            entrevistado_existente = Entrevistado(nombre=cita.entrevistado.nombre)
                            db.session.add(entrevistado_existente)
                            db.session.flush()

                        nueva_cita = Cita(
                            texto=cita.texto,
                            entrevistado_id=entrevistado_existente.id,
                            graph_id=nuevo_graph.id
                        )
                        db.session.add(nueva_cita)

                notas_clonadas.append({
                    'id_original': texto.id,
                    'id_nuevo': nueva_nota.id,
                    'titulo': nueva_nota.titulo,
                    'numero_de_nota': nueva_nota.numero_de_nota
                })

        db.session.commit()

        return jsonify({
            'mensaje': f'Se clonaron {len(notas_clonadas)} notas al guion "{guion_destino.nombre}"',
            'notas_clonadas': notas_clonadas
        })

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


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
        from datetime import datetime

        # Obtener el guion con todos sus textos y relaciones
        guion = Guion.query.options(
            joinedload(Guion.textos).joinedload(Texto.graphs).joinedload(Graph.bajadas),
            joinedload(Guion.textos).joinedload(Texto.graphs).joinedload(Graph.citas).joinedload(Cita.entrevistado)
        ).get_or_404(guion_id)

        # Ordenar textos por número_de_nota
        guion.textos = sorted(guion.textos, key=lambda x: x.numero_de_nota or 0)

        # Obtener la fecha y hora actual
        ahora = datetime.now()

        # Renderizar el template HTML con los datos del guion
        html = render_template('guion_pdf.html', guion=guion, ahora=ahora)

        # Crear un objeto HTML con WeasyPrint
        pdf = HTML(string=html).write_pdf()

        # Limpiar el nombre del guion para usarlo como nombre de archivo
        nombre_archivo = guion.nombre.replace("/", "_").replace("\\", "_").replace(":", "_")
        nombre_archivo = nombre_archivo.replace(" ", "_")

        # Crear una respuesta con el PDF
        response = make_response(pdf)
        response.headers['Content-Type'] = 'application/pdf'
        response.headers['Content-Disposition'] = f'attachment; filename={nombre_archivo}.pdf'

        return response
    except Exception as e:
        # Registrar el error y devolver una respuesta de error
        print(f"Error al generar el PDF: {e}")
        return "Error al generar el PDF", 500


@guiones_bp.route('/guiones/<int:id>/texto_completo', methods=['GET'])
def obtener_texto_completo_guion(id):
    try:
        guion = Guion.query.options(
            joinedload(Guion.textos).joinedload(Texto.graphs).joinedload(Graph.bajadas),
            joinedload(Guion.textos).joinedload(Texto.graphs).joinedload(Graph.citas).joinedload(Cita.entrevistado)
        ).get(id)

        if not guion:
            return jsonify({"mensaje": "Guion no encontrado"}), 404

        # Preparar los datos para la respuesta
        datos_guion = {
            "id": guion.id,
            "nombre": guion.nombre,
            "textos": []
        }

        for texto in guion.textos:
            texto_data = {
                "id": texto.id,
                "numero_de_nota": texto.numero_de_nota,
                "titulo": texto.titulo,
                "material": texto.material,
                "graphs": []
            }

            for graph in texto.graphs:
                # Procesar bajadas
                bajadas = [b.texto for b in graph.bajadas]

                # Procesar entrevistados y citas
                entrevistados_dict = {}
                for cita in graph.citas:
                    nombre = cita.entrevistado.nombre
                    if nombre not in entrevistados_dict:
                        entrevistados_dict[nombre] = []
                    entrevistados_dict[nombre].append(cita.texto)

                entrevistados = [{"nombre": nombre, "citas": citas}
                                 for nombre, citas in entrevistados_dict.items()]

                graph_data = {
                    "id": graph.id,
                    "lugar": graph.lugar,
                    "tema": graph.tema,
                    "bajadas": bajadas,
                    "entrevistados": entrevistados
                }

                texto_data["graphs"].append(graph_data)

            datos_guion["textos"].append(texto_data)

        return jsonify(datos_guion)

    except Exception as e:
        return jsonify({"mensaje": f"Error al obtener el texto completo: {str(e)}"}), 500
