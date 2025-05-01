import json
import os
import time
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request, render_template
from flask import Response, stream_with_context
from flask import current_app

from .. import db
from ..models import Graph, Texto, Guion
from ..config_manager import display_config, save_config

graphs_bp = Blueprint('graphs', __name__)


@graphs_bp.route('/graphs', methods=['POST'])
def crear_graph():
    data = request.json
    if not data or 'primera_linea' not in data or 'segunda_linea' not in data or 'entrevistado' not in data or 'lugar' not in data or 'texto_id' not in data:
        return jsonify({"mensaje": "Datos incompletos"}), 400

    nuevo_graph = Graph(
        primera_linea=data['primera_linea'].upper(),
        segunda_linea=data['segunda_linea'].upper(),
        entrevistado=data['entrevistado'].upper(),
        lugar=data['lugar'].upper(),
        tema=data['tema'].upper(),
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


@graphs_bp.route('/stream_graphs')
def stream_graphs():
    def event_stream():
        while True:
            try:
                # Usar with para manejo adecuado de la sesión
                with current_app.app_context():
                    # Consulta modificada - LIMIT con valor literal
                    graph_activo = db.session.query(Graph).filter_by(activo=True).limit(1).first()

                    live_config = display_config.get('live', {
                        'show': True,
                        'text': 'VIVO',
                        'position': 'top-right'
                    })

                    data = {
                        "activo": bool(graph_activo),
                        "primera_linea": graph_activo.primera_linea if graph_activo else "",
                        "segunda_linea": graph_activo.segunda_linea if graph_activo else "",
                        "show_live": live_config['show'],
                        "live_text": live_config['text'],
                        "live_position": live_config['position']
                    }

                    yield f"data: {json.dumps(data)}\n\n"
                    time.sleep(1)

            except Exception as e:
                current_app.logger.error(f"Error en stream_graphs: {str(e)}")
                yield "event: error\ndata: {}\n\n"
                time.sleep(5)

    return Response(stream_with_context(event_stream()), content_type='text/event-stream')


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
    if graph:
        graph.activo = True
        db.session.commit()
        # Pequeña pausa para asegurar que la base de datos se actualice
        time.sleep(0.1)
        return jsonify({"mensaje": "Graph activo actualizado"})
    return jsonify({"error": "Graph no encontrado"}), 404


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


def get_base_xml_template():
    return '''<?xml version="1.0" encoding="ISO8859-1" ?>
      <Video TextDelay="0" Width="1" Height="1" Loop="1" PageName="05 COMPLETO OK" bannertime="0" bannerpause="0" bannerin="0" bannerout="0">
        5
        <Object#1 tipo="89" id="0" gradang="0" acolori="255" rcolori="232" gcolori="232" bcolori="232" acolorf="255" rcolorf="232" gcolorf="232" bcolorf="232" bidir="0" repeat1="0" linechar="1" shadow="False" Rshadow="0" gshadow="0" bshadow="0" shdireccion="8" tiposhadow="0" shadowradio="100" shadowoffset="3" MaskEnabled="0" Maskleft="4" Masktop="4" MaskHeight="570" MaskWidth="1015" outline="True" Aoutli="255" routli="38" goutli="38" boutli="38" useaudio="0" lastframe="-1" Aoutlf="255" routlf="38" goutlf="38" boutlf="38" outlinetype="solid" outlinegrad="0" outlinewidth="4" outlinebidir="0" outlinerepeat1="0" texture="False" texturepath="V:\\ID NUEVE NOTICIAS 2024\\ZOCALO\\ZOCALO.avi" texturesize="False" videodelay="0" looppoint="0" loopEndpoint="0" loopTextpoint="0" loop="0" speed="5" Movement="0" PIPNumber="0" font="Arial" fontsize="40" stilo="0" alineacion="0" w="0" h="0" layerx="0" layery="0" layerw="0" layerh="0" transparency="0"/>
        <Object#2 tipo="77" id="0" gradang="0" acolori="255" rcolori="209" gcolori="209" bcolori="209" acolorf="255" rcolorf="209" gcolorf="209" bcolorf="209" bidir="0" repeat1="0" linechar="1" shadow="False" Rshadow="0" gshadow="0" bshadow="0" shdireccion="8" tiposhadow="0" shadowradio="0" shadowoffset="6" MaskEnabled="0" Maskleft="4" Masktop="4" MaskHeight="570" MaskWidth="1015" outline="True" Aoutli="255" routli="38" goutli="38" boutli="38" useaudio="0" lastframe="-1" Aoutlf="255" routlf="38" goutlf="38" boutlf="38" outlinetype="solid" outlinegrad="0" outlinewidth="4" outlinebidir="0" outlinerepeat1="0" texture="False" texturesize="False" videodelay="0" looppoint="0" loopEndpoint="0" loopTextpoint="0" loop="0" speed="6" Movement="0" PIPNumber="0" font="Open Sans Extrabold" fontsize="52" stilo="0" alineacion="3" w="297" h="126" layerx="263" layery="849" layerw="0" layerh="0" transparency="0">
          {primera_linea}
        </Object#2>
        <Object#3 tipo="77" id="0" gradang="0" acolori="255" rcolori="0" gcolori="219" bcolori="255" acolorf="255" rcolorf="0" gcolorf="219" bcolorf="255" bidir="0" repeat1="0" linechar="1" shadow="False" Rshadow="0" gshadow="0" bshadow="0" shdireccion="6" tiposhadow="0" shadowradio="0" shadowoffset="6" MaskEnabled="0" Maskleft="4" Masktop="4" MaskHeight="570" MaskWidth="1015" outline="False" Aoutli="255" routli="38" goutli="38" boutli="38" useaudio="0" lastframe="-1" Aoutlf="255" routlf="38" goutlf="38" boutlf="38" outlinetype="solid" outlinegrad="0" outlinewidth="4" outlinebidir="0" outlinerepeat1="0" texture="False" texturepath="V:\\ID AHORA LITORAL 2024\\ZOCALO AL\\ZOCALO AL.avi" texturesize="False" videodelay="0" looppoint="0" loopEndpoint="0" loopTextpoint="0" loop="0" speed="5" Movement="0" PIPNumber="0" font="Open Sans Extrabold" fontsize="30" stilo="0" alineacion="3" w="161" h="74" layerx="279" layery="932" layerw="0" layerh="0" transparency="0">
          {tema}
        </Object#3>
        <Object#4 tipo="88" id="0" gradang="0" acolori="255" rcolori="209" gcolori="209" bcolori="209" acolorf="255" rcolorf="209" gcolorf="209" bcolorf="209" bidir="0" repeat1="0" linechar="1" shadow="False" Rshadow="0" gshadow="0" bshadow="0" shdireccion="8" tiposhadow="0" shadowradio="0" shadowoffset="6" MaskEnabled="0" Maskleft="4" Masktop="4" MaskHeight="570" MaskWidth="1015" outline="True" Aoutli="255" routli="38" goutli="38" boutli="38" useaudio="0" lastframe="-1" Aoutlf="255" routlf="38" goutlf="38" boutlf="38" outlinetype="solid" outlinegrad="0" outlinewidth="4" outlinebidir="0" outlinerepeat1="0" texture="False" texturepath="V:\\ID NUEVE NOTICIAS 2024\\SUBIDA NOMBRE\\SUBIDA NOMBRE_00075.png" texturesize="False" videodelay="0" looppoint="0" loopEndpoint="0" loopTextpoint="0" loop="0" speed="5" Movement="0" PIPNumber="0" font="Open Sans Extrabold" fontsize="65" stilo="0" alineacion="3" w="900" h="100" layerx="939" layery="819" layerw="0" layerh="0" transparency="255"/>
        <Object#5 tipo="88" id="0" gradang="0" acolori="255" rcolori="0" gcolori="216" bcolori="252" acolorf="255" rcolorf="0" gcolorf="216" bcolorf="252" bidir="0" repeat1="0" linechar="1" shadow="False" Rshadow="0" gshadow="0" bshadow="0" shdireccion="6" tiposhadow="0" shadowradio="0" shadowoffset="6" MaskEnabled="0" Maskleft="4" Masktop="4" MaskHeight="570" MaskWidth="1015" outline="False" Aoutli="255" routli="38" goutli="38" boutli="38" useaudio="0" lastframe="-1" Aoutlf="255" routlf="38" goutlf="38" boutlf="38" outlinetype="solid" outlinegrad="0" outlinewidth="4" outlinebidir="0" outlinerepeat1="0" texture="False" texturepath="V:\\ID NUEVE NOTICIAS 2024\\SUBIDA LOCALIDAD\\SUBIDA LOCALIDAD.avi" texturesize="False" videodelay="0,140000000596046" looppoint="0" loopEndpoint="0" loopTextpoint="7" loop="0" speed="5" Movement="0" PIPNumber="0" font="Open Sans Extrabold" fontsize="26" stilo="0" alineacion="3" w="300" h="100" layerx="1541" layery="775" layerw="0" layerh="0" transparency="255"/>
        <Object#6 tipo="77" id="0" gradang="0" acolori="255" rcolori="1" gcolori="30" bcolori="136" acolorf="255" rcolorf="1" gcolorf="30" bcolorf="136" bidir="0" repeat1="0" linechar="1" shadow="False" Rshadow="0" gshadow="0" bshadow="0" shdireccion="6" tiposhadow="0" shadowradio="0" shadowoffset="6" MaskEnabled="0" Maskleft="4" Masktop="4" MaskHeight="570" MaskWidth="1015" outline="False" Aoutli="255" routli="38" goutli="38" boutli="38" useaudio="0" lastframe="-1" Aoutlf="255" routlf="38" goutlf="38" boutlf="38" outlinetype="solid" outlinegrad="0" outlinewidth="4" outlinebidir="0" outlinerepeat1="0" texture="False" texturepath="V:\\ID AHORA LITORAL 2024\\ZOCALO AL\\ZOCALO AL.avi" texturesize="False" videodelay="0" looppoint="0" loopEndpoint="0" loopTextpoint="0" loop="0" speed="6" Movement="0" PIPNumber="0" font="Open Sans" fontsize="25" stilo="1" alineacion="3" w="145" h="67" layerx="1578" layery="801" layerw="0" layerh="0" transparency="0">
          {lugar}
        </Object#6>
        <Object#7 tipo="77" id="0" gradang="0" acolori="255" rcolori="0" gcolori="216" bcolori="252" acolorf="255" rcolorf="0" gcolorf="216" bcolorf="252" bidir="0" repeat1="0" linechar="1" shadow="False" Rshadow="0" gshadow="0" bshadow="0" shdireccion="6" tiposhadow="0" shadowradio="0" shadowoffset="6" MaskEnabled="0" Maskleft="4" Masktop="4" MaskHeight="570" MaskWidth="1015" outline="False" Aoutli="255" routli="38" goutli="38" boutli="38" useaudio="0" lastframe="-1" Aoutlf="255" routlf="38" goutlf="38" boutlf="38" outlinetype="solid" outlinegrad="0" outlinewidth="4" outlinebidir="0" outlinerepeat1="0" texture="False" texturepath="V:\\ID AHORA LITORAL 2024\\ZOCALO AL\\ZOCALO AL.avi" texturesize="False" videodelay="0" looppoint="0" loopEndpoint="0" loopTextpoint="0" loop="0" speed="5" Movement="0" PIPNumber="0" font="Open Sans Extrabold" fontsize="26" stilo="0" alineacion="3" w="159" h="68" layerx="982" layery="842" layerw="0" layerh="0" transparency="0">
          {entrevistado}
        </Object#7>
      </Video>'''


@graphs_bp.route('/generar_xml', methods=['PUT'])
def generar_xml_graphs():
    try:
        # Crear la carpeta Graphs si no existe
        graphs_dir = os.path.join(current_app.root_path, 'Graphs')
        if not os.path.exists(graphs_dir):
            os.makedirs(graphs_dir)

        # Obtener todos los textos con sus graphs relacionados
        textos = Texto.query.options(db.joinedload(Texto.graphs)).all()
        total_graphs = sum(len(t.graphs) for t in textos)

        for texto in textos:
            # Ordenar los graphs por ID para numeración consistente
            graphs = sorted(texto.graphs, key=lambda x: x.id)

            for i, graph in enumerate(graphs, start=1):
                # Crear el nombre del archivo
                nombre_archivo = f"{texto.numero_de_nota}_{i}.xml"
                ruta_archivo = os.path.join(graphs_dir, nombre_archivo)

                # Reemplazar los valores en el template
                xml_content = get_base_xml_template().format(
                    primera_linea=graph.primera_linea,
                    tema=graph.tema if graph.tema else "TEMA",
                    lugar=graph.lugar,
                    entrevistado=graph.entrevistado
                )

                # Guardar el archivo
                with open(ruta_archivo, 'w', encoding='ISO-8859-1') as f:
                    f.write(xml_content)

        return jsonify({
            'success': True,
            'mensaje': f"Se generaron {total_graphs} archivos XML en la carpeta Graphs"
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'mensaje': f"Error al generar los archivos XML: {str(e)}"
        }), 500


DEFAULT_DISPLAY_CONFIG = {
    "layout": {
        "main_bottom": "5%",
        "main_left": "20px",
        "main_width": "100%",
        "main_height": "10%",
        "logo_width": "10%",
        "text_width": "70%",
        "main_vertical": "850px",
        "main_horizontal": "50px"
    },
    "badges": {
        "lugar_x": "1571px",
        "lugar_y": "153px",
        "nombre_x": "988px",
        "nombre_y": "106px"
    },
    "live": {
        "show": True,
        "text": "VIVO",
        "top": "150px",
        "right": "150px"
    },
}

# Inicializa display_config con los valores por defecto
display_config = DEFAULT_DISPLAY_CONFIG.copy()


@graphs_bp.route('/update_display_config', methods=['POST'])
def update_display_config():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No data provided"}), 400

        # Cargar la configuración actual desde archivo
        config_file = 'display_config.json'
        current_config = {}
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                current_config = json.load(f)

        # Validación de booleano
        if 'live' in data and 'show' in data['live']:
            data['live']['show'] = str(data['live']['show']).lower() == 'true'

        # Actualización profunda
        for section in ['layout', 'badges', 'live']:
            if section in data:
                if section not in current_config:
                    current_config[section] = {}
                current_config[section].update(data[section])

        # Añadir timestamp
        current_config['last_updated'] = datetime.utcnow().isoformat()

        # Guardar
        with open(config_file, 'w') as f:
            json.dump(current_config, f, indent=4)

        return jsonify({
            "status": "success",
            "updated": current_config['last_updated']
        })

    except Exception as e:
        current_app.logger.error(f"Error updating display config: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500



_CONFIG_CACHE = None
_LAST_LOAD_TIME = None
_CACHE_EXPIRY = timedelta(seconds=5)  # Refrescar caché cada 5 segundos


@graphs_bp.route('/get_display_config')
def get_display_config():
    global _CONFIG_CACHE, _LAST_LOAD_TIME

    if _CONFIG_CACHE and _LAST_LOAD_TIME and (datetime.now() - _LAST_LOAD_TIME < _CACHE_EXPIRY):
        return jsonify(_CONFIG_CACHE)

    config_file = 'display_config.json'

    try:
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config = json.load(f)
                _CONFIG_CACHE = config
                _LAST_LOAD_TIME = datetime.now()
                return jsonify(config)
        else:
            return jsonify({}), 200

    except json.JSONDecodeError as e:
        current_app.logger.error(f"Invalid JSON in config file: {str(e)}")
        return jsonify({}), 500

    except Exception as e:
        current_app.logger.error(f"Error loading config: {str(e)}")
        return jsonify({}), 500



@graphs_bp.route('/stream_display_config')
def stream_display_config():
    app = current_app._get_current_object()

    def event_stream():
        last_sent = None
        while True:
            try:
                with app.app_context():
                    db.session.expire_all()
                    graph_activo = db.session.query(Graph).filter_by(activo=True).first()

                    # Leer display_config desde archivo
                    try:
                        with open('display_config.json', 'r') as f:
                            saved_config = json.load(f)
                    except Exception as e:
                        app.logger.error(f"No se pudo cargar display_config.json: {str(e)}")
                        saved_config = {
                            "layout": {},
                            "badges": {},
                            "live": {}
                        }

                    # Configuración enviada al cliente
                    config = {
                        "layout": saved_config.get("layout", {}),
                        "badges": saved_config.get("badges", {}),
                        "live": saved_config.get("live", {}),
                        "content": {
                            "primera_linea": "",
                            "segunda_linea": "",
                            "top_left": "",
                            "top_right": "",
                        }
                    }

                    if graph_activo:
                        config['content'] = {
                            "primera_linea": graph_activo.primera_linea or "",
                            "segunda_linea": graph_activo.segunda_linea or "",
                            "entrevistado": graph_activo.entrevistado or "",
                            "lugar": graph_activo.lugar or ""
                        }

                    config_json = json.dumps(config)
                    if config_json != last_sent:
                        yield f"data: {config_json}\n\n"
                        last_sent = config_json

                    time.sleep(0.5)

            except Exception as e:
                app.logger.error(f"SSE Error: {str(e)}")
                yield "event: error\ndata: {}\n\n"
                time.sleep(5)

    return Response(
        event_stream(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )

