import os
import uuid

from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename

plantillas_bp = Blueprint('plantillas', __name__)

EXTENSIONES_PERMITIDAS = {'.webm', '.png', '.gif'}


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

    carpeta_destino = os.path.join(current_app.root_path, 'static', 'uploads', 'plantillas')
    os.makedirs(carpeta_destino, exist_ok=True)

    archivo.save(os.path.join(carpeta_destino, nombre_final))

    return jsonify({"ruta": f"uploads/plantillas/{nombre_final}"}), 201
