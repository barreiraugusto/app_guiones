import os
import uuid

from flask import Blueprint, jsonify, request, render_template, current_app
from werkzeug.utils import secure_filename

from .. import db
from ..models import Plantilla, PlantillaCapa, Graph
from ..audit import registrar

plantillas_bp = Blueprint('plantillas', __name__)

EXTENSIONES_PERMITIDAS = {'.webm', '.png', '.gif'}
CAMPOS_DATO_VALIDOS = {'lugar', 'tema', 'entrevistado', 'cita', 'bajada_1', 'bajada_2', None}
TIPOS_CAPA_VALIDOS = {'imagen', 'video', 'texto', 'forma'}


def _serializar_plantilla(plantilla):
    return {
        "id": plantilla.id,
        "nombre": plantilla.nombre,
        "ancho": plantilla.ancho,
        "alto": plantilla.alto,
        "capas": [
            {
                "id": capa.id,
                "orden": capa.orden,
                "tipo": capa.tipo,
                "x": capa.x,
                "y": capa.y,
                "ancho": capa.ancho,
                "alto": capa.alto,
                "archivo": capa.archivo,
                "loop": capa.loop,
                "campo_dato": capa.campo_dato,
                "texto_fijo": capa.texto_fijo,
                "fuente": capa.fuente,
                "tamano_fuente": capa.tamano_fuente,
                "color": capa.color,
                "alineacion": capa.alineacion,
                "negrita": capa.negrita,
                "cursiva": capa.cursiva,
                "animacion_entrada": capa.animacion_entrada,
                "animacion_salida": capa.animacion_salida,
                "duracion_transicion_ms": capa.duracion_transicion_ms,
                "radio_esquina": capa.radio_esquina,
                "color_fondo": capa.color_fondo,
                "opacidad": capa.opacidad,
                "color_borde": capa.color_borde,
                "ancho_borde": capa.ancho_borde,
                "usar_gradiente": capa.usar_gradiente,
                "gradiente_color_inicio": capa.gradiente_color_inicio,
                "gradiente_color_fin": capa.gradiente_color_fin,
                "gradiente_angulo": capa.gradiente_angulo,
            }
            for capa in sorted(plantilla.capas, key=lambda c: c.orden)
        ]
    }


def _validar_capas(capas_data):
    for capa in capas_data:
        if capa.get('tipo') not in TIPOS_CAPA_VALIDOS:
            return f"Tipo de capa inválido: {capa.get('tipo')}"
        if capa.get('campo_dato') not in CAMPOS_DATO_VALIDOS:
            return f"campo_dato inválido: {capa.get('campo_dato')}"
    return None


def _crear_capas(plantilla, capas_data):
    for i, capa_data in enumerate(capas_data):
        plantilla.capas.append(PlantillaCapa(
            orden=capa_data.get('orden', i),
            tipo=capa_data['tipo'],
            x=capa_data.get('x', 0),
            y=capa_data.get('y', 0),
            ancho=capa_data.get('ancho', 200),
            alto=capa_data.get('alto', 100),
            archivo=capa_data.get('archivo'),
            loop=capa_data.get('loop', True),
            campo_dato=capa_data.get('campo_dato'),
            texto_fijo=capa_data.get('texto_fijo'),
            fuente=capa_data.get('fuente', 'Arial'),
            tamano_fuente=capa_data.get('tamano_fuente', 24),
            color=capa_data.get('color', '#ffffff'),
            alineacion=capa_data.get('alineacion', 'left'),
            negrita=capa_data.get('negrita', False),
            cursiva=capa_data.get('cursiva', False),
            animacion_entrada=capa_data.get('animacion_entrada', 'fade'),
            animacion_salida=capa_data.get('animacion_salida', 'fade'),
            duracion_transicion_ms=capa_data.get('duracion_transicion_ms', 400),
            radio_esquina=capa_data.get('radio_esquina', 0),
            color_fondo=capa_data.get('color_fondo'),
            opacidad=capa_data.get('opacidad', 100),
            color_borde=capa_data.get('color_borde'),
            ancho_borde=capa_data.get('ancho_borde', 0),
            usar_gradiente=capa_data.get('usar_gradiente', False),
            gradiente_color_inicio=capa_data.get('gradiente_color_inicio'),
            gradiente_color_fin=capa_data.get('gradiente_color_fin'),
            gradiente_angulo=capa_data.get('gradiente_angulo', 90),
        ))


@plantillas_bp.route('/plantillas/upload', methods=['POST'])
def subir_archivo_plantilla():
    if 'archivo' not in request.files:
        return jsonify({"mensaje": "No se envió ningún archivo"}), 400

    archivo = request.files['archivo']
    if archivo.filename == '':
        return jsonify({"mensaje": "Nombre de archivo vacío"}), 400

    extension = os.path.splitext(archivo.filename)[1].lower()
    if extension not in EXTENSIONES_PERMITIDAS:
        return jsonify({
            "mensaje": f"Extensión no permitida: {extension}. Use .webm, .png o .gif"
        }), 400

    nombre_seguro = secure_filename(archivo.filename)
    nombre_final = f"{uuid.uuid4().hex}_{nombre_seguro}"

    try:
        carpeta_destino = os.path.join(current_app.root_path, 'static', 'uploads', 'plantillas')
        os.makedirs(carpeta_destino, exist_ok=True)

        archivo.save(os.path.join(carpeta_destino, nombre_final))

        return jsonify({"ruta": f"uploads/plantillas/{nombre_final}"}), 201
    except Exception as e:
        return jsonify({"mensaje": f"Error al guardar el archivo: {str(e)}"}), 500


@plantillas_bp.route('/plantillas')
def pagina_plantillas():
    return render_template('plantillas.html')


@plantillas_bp.route('/api/plantillas', methods=['GET'])
def listar_plantillas():
    plantillas = Plantilla.query.order_by(Plantilla.nombre).all()
    return jsonify([{"id": p.id, "nombre": p.nombre} for p in plantillas])


@plantillas_bp.route('/api/plantillas/<int:id>', methods=['GET'])
def obtener_plantilla(id):
    plantilla = Plantilla.query.get(id)
    if not plantilla:
        return jsonify({"mensaje": "Plantilla no encontrada"}), 404
    return jsonify(_serializar_plantilla(plantilla))


@plantillas_bp.route('/api/plantillas', methods=['POST'])
def crear_plantilla():
    data = request.json
    if not data or not data.get('nombre'):
        return jsonify({"mensaje": "Se requiere un nombre"}), 400

    error = _validar_capas(data.get('capas', []))
    if error:
        return jsonify({"mensaje": error}), 400

    try:
        plantilla = Plantilla(
            nombre=data['nombre'],
            ancho=data.get('ancho', 1920),
            alto=data.get('alto', 1080),
        )
        _crear_capas(plantilla, data.get('capas', []))
        db.session.add(plantilla)
        db.session.commit()

        registrar('INFO', f'Creó plantilla: {plantilla.nombre}', 'plantilla', plantilla.id, plantilla.nombre)

        return jsonify({"mensaje": "Plantilla creada", "id": plantilla.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al crear la plantilla: {str(e)}"}), 500


@plantillas_bp.route('/api/plantillas/<int:id>', methods=['PUT'])
def actualizar_plantilla(id):
    plantilla = Plantilla.query.get(id)
    if not plantilla:
        return jsonify({"mensaje": "Plantilla no encontrada"}), 404

    data = request.json
    if not data or not data.get('nombre'):
        return jsonify({"mensaje": "Se requiere un nombre"}), 400

    error = _validar_capas(data.get('capas', []))
    if error:
        return jsonify({"mensaje": error}), 400

    try:
        plantilla.nombre = data['nombre']
        plantilla.ancho = data.get('ancho', plantilla.ancho)
        plantilla.alto = data.get('alto', plantilla.alto)
        plantilla.capas = []
        _crear_capas(plantilla, data.get('capas', []))
        db.session.commit()

        registrar('WARNING', f'Editó plantilla: {plantilla.nombre}', 'plantilla', id, plantilla.nombre)

        return jsonify({"mensaje": "Plantilla actualizada"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al actualizar la plantilla: {str(e)}"}), 500


@plantillas_bp.route('/api/plantillas/<int:id>', methods=['DELETE'])
def eliminar_plantilla(id):
    plantilla = Plantilla.query.get(id)
    if not plantilla:
        return jsonify({"mensaje": "Plantilla no encontrada"}), 404

    graphs_asociados = Graph.query.filter_by(plantilla_id=id).count()
    if graphs_asociados > 0:
        return jsonify({
            "mensaje": f"No se puede eliminar: {graphs_asociados} graph(s) usan esta plantilla"
        }), 409

    nombre = plantilla.nombre
    try:
        db.session.delete(plantilla)
        db.session.commit()

        registrar('DANGER', f'Eliminó plantilla: {nombre}', 'plantilla', id, nombre)

        return jsonify({"mensaje": "Plantilla eliminada"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al eliminar la plantilla: {str(e)}"}), 500


@plantillas_bp.route('/api/plantillas/<int:id>/duplicar', methods=['POST'])
def duplicar_plantilla(id):
    original = Plantilla.query.get(id)
    if not original:
        return jsonify({"mensaje": "Plantilla no encontrada"}), 404

    nombre_base = f"{original.nombre} (copia)"
    nombre_nuevo = nombre_base
    contador = 2
    while Plantilla.query.filter_by(nombre=nombre_nuevo).first():
        nombre_nuevo = f"{nombre_base} {contador}"
        contador += 1

    try:
        nueva = Plantilla(nombre=nombre_nuevo, ancho=original.ancho, alto=original.alto)
        db.session.add(nueva)
        db.session.flush()

        for capa in sorted(original.capas, key=lambda c: c.orden):
            nueva.capas.append(PlantillaCapa(
                orden=capa.orden,
                tipo=capa.tipo,
                x=capa.x,
                y=capa.y,
                ancho=capa.ancho,
                alto=capa.alto,
                archivo=capa.archivo,
                loop=capa.loop,
                campo_dato=capa.campo_dato,
                texto_fijo=capa.texto_fijo,
                fuente=capa.fuente,
                tamano_fuente=capa.tamano_fuente,
                color=capa.color,
                alineacion=capa.alineacion,
                negrita=capa.negrita,
                cursiva=capa.cursiva,
                animacion_entrada=capa.animacion_entrada,
                animacion_salida=capa.animacion_salida,
                duracion_transicion_ms=capa.duracion_transicion_ms,
                radio_esquina=capa.radio_esquina,
                color_fondo=capa.color_fondo,
                opacidad=capa.opacidad,
                color_borde=capa.color_borde,
                ancho_borde=capa.ancho_borde,
                usar_gradiente=capa.usar_gradiente,
                gradiente_color_inicio=capa.gradiente_color_inicio,
                gradiente_color_fin=capa.gradiente_color_fin,
                gradiente_angulo=capa.gradiente_angulo,
            ))

        db.session.commit()

        registrar('INFO', f'Duplicó plantilla: {original.nombre} -> {nueva.nombre}',
                  'plantilla', nueva.id, nueva.nombre)

        return jsonify({"mensaje": "Plantilla duplicada", "id": nueva.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al duplicar la plantilla: {str(e)}"}), 500
