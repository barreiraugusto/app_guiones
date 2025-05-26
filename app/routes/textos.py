import json
import time
from sqlite3 import IntegrityError

from flask import Blueprint, jsonify, request, render_template, stream_with_context, Response, current_app

from sqlalchemy.orm import joinedload, selectinload
from .. import db
from ..models import Texto, Guion, Graph, Cita

textos_bp = Blueprint('textos', __name__)


@textos_bp.route('/stream_textos')
def stream_textos():
    def event_stream():
        while True:
            try:
                with current_app.app_context():
                    db.session.expire_all()  # Limpiar la caché de SQLAlchemy

                    # Cargar todos los textos con sus relaciones
                    textos = Texto.query.options(
                        selectinload(Texto.graphs).options(
                            selectinload(Graph.bajadas),
                            joinedload(Graph.citas).joinedload(Cita.entrevistado)
                        )
                    ).all()

                    data = []
                    for t in textos:
                        texto_data = {
                            "id": t.id,
                            "numero_de_nota": t.numero_de_nota,
                            "titulo": t.titulo,
                            "contenido": t.contenido,
                            "musica": t.musica,
                            "duracion": t.duracion,
                            "material": t.material,
                            "activo": t.activo,
                            "emitido": t.emitido,
                            "guion_id": t.guion_id,
                            "graphs": []
                        }

                        for g in t.graphs:
                            # Usamos un defaultdict para agrupar citas por entrevistado
                            from collections import defaultdict
                            entrevistados_dict = defaultdict(list)

                            # Asegurarnos de que las citas están cargadas
                            if g.citas:
                                for cita in g.citas:
                                    # Verificar que la cita y el entrevistado existen
                                    if cita and cita.entrevistado:
                                        nombre = cita.entrevistado.nombre
                                        texto = cita.texto
                                        if texto:  # Solo agregar si hay texto
                                            entrevistados_dict[nombre].append(texto)

                            graph_data = {
                                "id": g.id,
                                "lugar": g.lugar,
                                "tema": g.tema,
                                "activo": g.activo,
                                "bajadas": [b.texto for b in g.bajadas],
                                "entrevistados": [
                                    {
                                        "nombre": nombre,
                                        "citas": citas
                                    } for nombre, citas in entrevistados_dict.items()
                                ]
                            }
                            texto_data["graphs"].append(graph_data)

                        data.append(texto_data)

                    data.append(texto_data)

                    yield f"data: {json.dumps(data)}\n\n"
                    time.sleep(10)  # Esperar 10 segundos antes de enviar la siguiente actualización

            except Exception as e:
                current_app.logger.error(f"Error en stream_textos: {str(e)}")
                yield "event: error\ndata: {}\n\n"
                time.sleep(5)  # Esperar antes de reintentar

            return Response(stream_with_context(event_stream()),
                            content_type='text/event-stream',
                            headers={'X-Accel-Buffering': 'no'})


@textos_bp.route('/textos', methods=['GET', 'POST'])
def textos():
    if request.method == 'POST':
        data = request.json
        if not data or 'numero_de_nota' not in data or 'titulo' not in data:
            return jsonify({"mensaje": "Datos incompletos"}), 400

        try:
            nuevo_texto = Texto(
                numero_de_nota=data['numero_de_nota'],
                titulo=data['titulo'],
                duracion=data.get('duracion', ''),
                contenido=data.get('contenido', ''),
                musica=data.get('musica', ''),
                material=data.get('material', ''),
                guion_id=data.get('guion_id')
            )
            db.session.add(nuevo_texto)
            db.session.commit()
            return jsonify({
                "mensaje": "Texto agregado",
                "id": nuevo_texto.id
            }), 201
        except Exception as e:
            db.session.rollback()
            return jsonify({"mensaje": f"Error al crear texto: {str(e)}"}), 500
    else:
        # GET method
        textos = Texto.query.options(
            joinedload(Texto.graphs).joinedload(Graph.bajadas),
            joinedload(Texto.graphs).joinedload(Graph.citas).joinedload(Cita.entrevistado)
        ).all()

        response_data = []
        for t in textos:
            texto_data = {
                "id": t.id,
                "numero_de_nota": t.numero_de_nota,
                "titulo": t.titulo,
                "duracion": t.duracion,
                "contenido": t.contenido,
                "musica": t.musica,
                "material": t.material,
                "activo": t.activo,
                "guion_id": t.guion_id,
                "graphs": []
            }

            for g in t.graphs:
                # Agrupar citas por entrevistado
                entrevistados_dict = {}
                for cita in g.citas:
                    nombre = cita.entrevistado.nombre
                    if nombre not in entrevistados_dict:
                        entrevistados_dict[nombre] = []
                    entrevistados_dict[nombre].append(cita.texto)

                graph_data = {
                    "id": g.id,
                    "lugar": g.lugar,
                    "tema": g.tema,
                    "activo": g.activo,
                    "bajadas": [b.texto for b in g.bajadas],
                    "entrevistados": [
                        {
                            "nombre": nombre,
                            "citas": citas
                        }
                        for nombre, citas in entrevistados_dict.items()
                    ]
                }
                texto_data["graphs"].append(graph_data)

            response_data.append(texto_data)

        return jsonify(response_data)


@textos_bp.route('/textos/por-guion/<int:guion_id>', methods=['GET'])
def textos_por_guion(guion_id):
    textos = Texto.query.filter_by(guion_id=guion_id).all()
    return jsonify([{
        "id": t.id,
        "numero_de_nota": t.numero_de_nota,
        "titulo": t.titulo,
        "duracion": t.duracion,
        "contenido": t.contenido,
        "musica": t.musica,
        "material": t.material
    } for t in textos])


@textos_bp.route('/textos/activo/<int:id>', methods=['PUT'])
def setTextoActivo(id):
    Texto.query.update({Texto.activo: False})
    texto = Texto.query.get(id)
    texto.activo = True
    db.session.commit()
    return jsonify({"mensaje": "Texto activo actualizado"})


@textos_bp.route('/textos/emitido/<int:id>', methods=['PUT'])
def setTextoEmitido(id):
    texto = Texto.query.get(id)
    if texto.emitido:
        texto.emitido = False
    else:
        texto.emitido = True
    db.session.commit()
    return jsonify({"mensaje": "El texto se marco como emitido"})


@textos_bp.route('/siguiente')
def mostrar_texto_activo():
    texto_activo = Texto.query.filter_by(activo=True).first()
    if texto_activo:
        return render_template('siguiente.html', texto=texto_activo)
    else:
        return render_template('siguiente.html', texto=None)


@textos_bp.route('/stream_texto_activo')
def stream_texto_activo():
    def event_stream():
        while True:
            try:
                with current_app.app_context():
                    db.session.expire_all()  # Limpiar la caché de SQLAlchemy

                    # Cargar el texto activo con todas sus relaciones
                    texto_activo = Texto.query.options(
                        selectinload(Texto.graphs).options(
                            selectinload(Graph.bajadas),
                            joinedload(Graph.citas).joinedload(Cita.entrevistado)
                        )
                    ).filter_by(activo=True).first()

                    if texto_activo:
                        # Construir respuesta con la nueva estructura
                        data = {
                            "id": texto_activo.id,
                            "numero_de_nota": texto_activo.numero_de_nota,
                            "titulo": texto_activo.titulo,
                            "contenido": texto_activo.contenido,
                            "material": texto_activo.material,
                            "musica": texto_activo.musica,
                            "activo": texto_activo.activo,
                            "guion_id": texto_activo.guion_id,
                            "graphs": []
                        }

                        for graph in texto_activo.graphs:
                            # Agrupar citas por entrevistado
                            entrevistados = {}
                            for cita in graph.citas:
                                nombre = cita.entrevistado.nombre
                                if nombre not in entrevistados:
                                    entrevistados[nombre] = []
                                entrevistados[nombre].append(cita.texto)

                            graph_data = {
                                "id": graph.id,
                                "lugar": graph.lugar,
                                "tema": graph.tema,
                                "bajadas": [b.texto for b in graph.bajadas],
                                "entrevistados": [
                                    {
                                        "nombre": nombre,
                                        "citas": citas
                                    } for nombre, citas in entrevistados.items()
                                ]
                            }
                            data["graphs"].append(graph_data)

                        yield f"data: {json.dumps(data)}\n\n"
                    else:
                        yield "data: {}\n\n"

                    time.sleep(1)  # Intervalo de actualización

            except Exception as e:
                current_app.logger.error(f"Error en stream_texto_activo: {str(e)}")
                yield "event: error\ndata: {}\n\n"
                time.sleep(5)  # Esperar más antes de reintentar

    return Response(stream_with_context(event_stream()),
                    content_type='text/event-stream',
                    headers={'X-Accel-Buffering': 'no'})  # Importante para Nginx


@textos_bp.route('/obtener_textos_guion/<int:id>')
def obtener_textos_guion(id):
    guion = Guion.query.get(id)
    if guion:
        return jsonify([{
            "id": t.id,
            "titulo": t.titulo,
            "contenido": t.contenido,
            "musica": t.musica,
            "material": t.material,
            "numero_de_nota": t.numero_de_nota,
            "activo": t.activo
        } for t in guion.textos])
    else:
        return jsonify({"mensaje": "Guion no encontrado"}), 404


@textos_bp.route('/textos/<int:id>', methods=['GET'])
def obtener_texto(id):
    texto = Texto.query.get(id)
    if texto:
        return jsonify({
            "id": texto.id,
            "numero_de_nota": texto.numero_de_nota,
            "titulo": texto.titulo,
            "duracion": texto.duracion,
            "contenido": texto.contenido,
            "musica": texto.musica,
            "material": texto.material,
            "activo": texto.activo
        })
    else:
        return jsonify({"mensaje": "Texto no encontrado"}), 404


@textos_bp.route('/tiempos/<int:id>', methods=['GET'])
def obtener_tiempos(id):
    print(f"el id es {id}")
    texto = Texto.query.filter_by(guion_id=id)
    print(f"el texto es: {texto}")
    if not texto:
        return jsonify({"mensaje": "Texto no encontrado"}), 404
    # Obtener todos los textos del mismo guion
    textos_del_guion = texto.all()
    # Calcular la suma total de las duraciones en segundos
    total_segundos = 0
    for t in textos_del_guion:
        if t.duracion:
            try:
                # Dividir en horas, minutos y segundos
                partes = t.duracion.split(':')

                if len(partes) == 3:  # Formato HH:MM:SS
                    h, m, s = map(int, partes)
                    total_segundos += h * 3600 + m * 60 + s
                elif len(partes) == 2:  # Formato MM:SS (para compatibilidad hacia atrás)
                    m, s = map(int, partes)
                    total_segundos += m * 60 + s
            except (ValueError, AttributeError):
                continue  # Ignora formatos inválidos
    # Convertir el total de segundos a HH:MM:SS
    horas, resto = divmod(total_segundos, 3600)
    minutos, segundos = divmod(resto, 60)
    duracion_total = f"{horas:02d}:{minutos:02d}:{segundos:02d}"
    print(f"Duracion total: {duracion_total}")
    return jsonify({"duracion_total": duracion_total})


@textos_bp.route('/textos/editar/<int:id>', methods=['PUT'])
def editar_texto(id):
    data = request.json
    texto = Texto.query.get(id)
    if texto:
        texto.numero_de_nota = data.get('numero_de_nota', texto.numero_de_nota)
        texto.titulo = data.get('titulo', texto.titulo)
        texto.duracion = data.get('duracion', texto.duracion)
        texto.contenido = data.get('contenido', texto.contenido)
        texto.musica = data.get('musica', texto.musica)
        texto.material = data.get('material', texto.material)
        db.session.commit()
        return jsonify({"mensaje": "Texto actualizado"})
    else:
        return jsonify({"mensaje": "Texto no encontrado"}), 404


@textos_bp.route('/textos/borrar/<int:id>', methods=['DELETE'])
def borrar_texto(id):
    try:
        # Cargamos el texto con todas las relaciones necesarias
        texto = Texto.query.options(
            selectinload(Texto.graphs).options(
                selectinload(Graph.bajadas),
                selectinload(Graph.citas),
                selectinload(Graph.entrevistados)
            )
        ).get(id)

        if not texto:
            return jsonify({"mensaje": "Texto no encontrado"}), 404

        # Primero eliminamos manualmente las relaciones many-to-many
        for graph in texto.graphs:
            # Limpiar la relación graph_entrevistado
            graph.entrevistados = []
            # Eliminar citas asociadas
            for cita in graph.citas:
                db.session.delete(cita)
            # Eliminar relaciones de bajadas
            graph.bajadas = []

        # Ahora podemos eliminar el texto (la cascada eliminará los graphs)
        db.session.delete(texto)
        db.session.commit()

        return jsonify({"mensaje": "Texto eliminado correctamente"})

    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.error(f"Error de integridad al borrar texto {id}: {str(e)}")
        return jsonify({
            "mensaje": "Error de integridad referencial",
            "error": str(e)
        }), 500

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al borrar texto {id}: {str(e)}")
        return jsonify({
            "mensaje": "Error interno del servidor",
            "error": str(e)
        }), 500
