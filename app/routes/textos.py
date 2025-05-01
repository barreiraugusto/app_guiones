import json
import time

from flask import Blueprint, jsonify, request, render_template, stream_with_context, Response

from .. import db
from ..models import Texto, Guion

textos_bp = Blueprint('textos', __name__)


@textos_bp.route('/stream_textos')
def stream_textos():
    def event_stream():
        while True:
            db.session.expire_all()  # Limpiar la caché de SQLAlchemy
            textos = Texto.query.all()
            data = [{
                "id": t.id,
                "numero_de_nota": t.numero_de_nota,
                "titulo": t.titulo,
                "contenido": t.contenido,
                "musica": t.musica,
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
            } for t in textos]

            yield f"data: {json.dumps(data)}\n\n"
            time.sleep(10)  # Esperar 1 segundo antes de enviar la siguiente actualización

    return Response(stream_with_context(event_stream()), content_type='text/event-stream')


@textos_bp.route('/textos', methods=['GET', 'POST'])
def textos():
    if request.method == 'POST':
        data = request.json
        nuevo_texto = Texto(
            numero_de_nota=data['numero_de_nota'],
            titulo=data['titulo'],
            duracion=data['duracion'],
            contenido=data['contenido'],
            musica=data['musica'],
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
            "duracion": t.duracion,
            "contenido": t.contenido,
            "musica": t.musica,
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
            db.session.expire_all()  # Limpiar la caché de SQLAlchemy
            texto_activo = Texto.query.filter_by(activo=True).first()
            if texto_activo:
                data = {
                    "id": texto_activo.id,
                    "numero_de_nota": texto_activo.numero_de_nota,
                    "titulo": texto_activo.titulo,
                    "contenido": texto_activo.contenido,
                    "material": texto_activo.material,
                    "musica": texto_activo.musica,
                    "activo": texto_activo.activo,
                    "guion_id": texto_activo.guion_id,
                    "graphs": [{
                        "id": g.id,
                        "primera_linea": g.primera_linea,
                        "segunda_linea": g.segunda_linea,
                        "entrevistado": g.entrevistado,
                        "lugar": g.lugar
                    } for g in texto_activo.graphs]
                }
                yield f"data: {json.dumps(data)}\n\n"
            else:
                yield "data: {}\n\n"
            time.sleep(1)  # Esperar 1 segundo antes de enviar la siguiente actualización

    return Response(stream_with_context(event_stream()), content_type='text/event-stream')


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
