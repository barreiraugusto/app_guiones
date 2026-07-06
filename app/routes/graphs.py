import json
import os
import time
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request, render_template
from flask import Response, stream_with_context
from flask import current_app

from sqlalchemy.orm import joinedload, selectinload
from .. import db
from ..models import Graph, Texto, Guion, Entrevistado, Bajada, Cita, Plantilla
from ..config_manager import display_config, save_config
from ..audit import registrar

graphs_bp = Blueprint('graphs', __name__)


def _plantilla_default_id():
    default = Plantilla.query.filter_by(nombre='Zócalo clásico').first()
    return default.id if default else None


@graphs_bp.route('/graphs', methods=['POST'])
def crear_graph():
    data = request.json
    if not data or 'lugar' not in data or 'texto_id' not in data or 'bajadas' not in data:
        return jsonify({"mensaje": "Datos incompletos: se requieren lugar, texto_id y bajadas"}), 400

    try:
        nuevo_graph = Graph(
            lugar=data['lugar'],
            tema=data.get('tema'),
            texto_id=data['texto_id'],
            plantilla_id=data.get('plantilla_id') or _plantilla_default_id(),
            activo=True
        )
        db.session.add(nuevo_graph)
        db.session.flush()

        for texto_bajada in data['bajadas']:
            bajada = Bajada(texto=texto_bajada)
            nuevo_graph.bajadas.append(bajada)

        if 'entrevistados' in data and data['entrevistados']:
            for entrevistado_data in data['entrevistados']:
                if entrevistado_data.get('nombre'):
                    entrevistado = Entrevistado(nombre=entrevistado_data.get('nombre', ''))
                    db.session.add(entrevistado)

                    citas = entrevistado_data.get('citas', [])
                    tiene_citas = any(c.strip() for c in citas)

                    if tiene_citas:
                        for cita_texto in citas:
                            if cita_texto.strip():
                                db.session.add(Cita(
                                    texto=cita_texto,
                                    entrevistado=entrevistado,
                                    graph=nuevo_graph
                                ))
                    else:
                        db.session.add(Cita(
                            texto="Sin cita",
                            entrevistado=entrevistado,
                            graph=nuevo_graph
                        ))

        db.session.commit()

        texto = Texto.query.get(data['texto_id'])
        registrar('INFO',
                  f'Agregó graph: {nuevo_graph.lugar}',
                  'graph', nuevo_graph.id, nuevo_graph.lugar,
                  f'Nota #{texto.numero_de_nota}: {texto.titulo}' if texto else f'texto_id={data["texto_id"]}')

        return jsonify({"mensaje": "Graph creado", "id": nuevo_graph.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al crear el graph: {str(e)}"}), 500


@graphs_bp.route('/graphs/<int:id>', methods=['PUT'])
def actualizar_graph(id):
    data = request.json
    graph = Graph.query.get(id)
    if not graph:
        return jsonify({"mensaje": "Graph no encontrado"}), 404

    try:
        graph.lugar = data.get('lugar', graph.lugar)
        graph.tema = data.get('tema', graph.tema)
        graph.plantilla_id = data.get('plantilla_id', graph.plantilla_id)

        graph.bajadas = []
        for texto_bajada in data['bajadas']:
            graph.bajadas.append(Bajada(texto=texto_bajada))

        Cita.query.filter_by(graph_id=id).delete()

        if 'entrevistados' in data and data['entrevistados']:
            for entrevistado_data in data['entrevistados']:
                if entrevistado_data.get('nombre'):
                    entrevistado = Entrevistado.query.filter_by(
                        nombre=entrevistado_data.get('nombre', '')
                    ).first()
                    if not entrevistado:
                        entrevistado = Entrevistado(nombre=entrevistado_data.get('nombre', ''))
                        db.session.add(entrevistado)

                    citas = entrevistado_data.get('citas', [])
                    tiene_citas = any(c.strip() for c in citas)

                    if tiene_citas:
                        for cita_texto in citas:
                            if cita_texto.strip():
                                db.session.add(Cita(
                                    texto=cita_texto,
                                    entrevistado=entrevistado,
                                    graph=graph
                                ))
                    else:
                        db.session.add(Cita(
                            texto="Sin cita",
                            entrevistado=entrevistado,
                            graph=graph
                        ))

        db.session.commit()

        registrar('WARNING',
                  f'Editó graph: {graph.lugar}',
                  'graph', id, graph.lugar)

        return jsonify({"mensaje": "Graph actualizado"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al actualizar el graph: {str(e)}"}), 500


@graphs_bp.route('/graphs/<int:id>', methods=['DELETE'])
def eliminar_graph(id):
    graph = Graph.query.get(id)
    if not graph:
        return jsonify({"mensaje": "Graph no encontrado"}), 404

    # Capturar antes de eliminar
    lugar_eliminado  = graph.lugar
    texto_id_parent  = graph.texto_id

    try:
        Cita.query.filter_by(graph_id=id).delete()
        for bajada in list(graph.bajadas):
            db.session.delete(bajada)
        db.session.delete(graph)
        db.session.commit()

        texto = Texto.query.get(texto_id_parent)
        registrar('DANGER',
                  f'Eliminó graph: {lugar_eliminado}',
                  'graph', id, lugar_eliminado,
                  f'Nota #{texto.numero_de_nota}: {texto.titulo}' if texto else f'texto_id={texto_id_parent}')

        return jsonify({"mensaje": "Graph eliminado correctamente"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al eliminar el graph: {str(e)}"}), 500


@graphs_bp.route('/graphs/<int:id>', methods=['GET'])
def obtener_graph(id):
    try:
        graph = db.session.query(Graph).options(
            selectinload(Graph.bajadas),
            joinedload(Graph.citas).joinedload(Cita.entrevistado)
        ).get(id)

        if not graph:
            return jsonify({"mensaje": "Graph no encontrado"}), 404

        citas_ordenadas  = sorted(graph.citas,  key=lambda c: c.id)
        bajadas_ordenadas = sorted(graph.bajadas, key=lambda b: b.id)

        entrevistados_dict = {}
        for cita in citas_ordenadas:
            nombre = cita.entrevistado.nombre
            if nombre not in entrevistados_dict:
                entrevistados_dict[nombre] = []
            if cita.texto not in entrevistados_dict[nombre]:
                entrevistados_dict[nombre].append(cita.texto)

        return jsonify({
            "id": graph.id,
            "lugar": graph.lugar or "",
            "tema": graph.tema or "",
            "texto_id": graph.texto_id,
            "activo": graph.activo,
            "plantilla_id": graph.plantilla_id,
            "bajadas": [b.texto for b in bajadas_ordenadas],
            "entrevistados": [
                {"nombre": nombre, "citas": citas}
                for nombre, citas in entrevistados_dict.items()
            ]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@graphs_bp.route('/textos/<int:texto_id>/graphs', methods=['GET'])
def obtener_graphs_por_texto(texto_id):
    texto = Texto.query.get(texto_id)
    if not texto:
        return jsonify({"mensaje": "Texto no encontrado"}), 404

    graphs = Graph.query.options(
        selectinload(Graph.bajadas),
        joinedload(Graph.citas).joinedload(Cita.entrevistado)
    ).filter_by(texto_id=texto_id).all()

    graphs_data = []
    for graph in graphs:
        bajadas = [b.texto for b in sorted(graph.bajadas, key=lambda b: b.id)]

        entrevistados_dict = {}
        for cita in graph.citas:
            nombre = cita.entrevistado.nombre
            if nombre not in entrevistados_dict:
                entrevistados_dict[nombre] = []
            entrevistados_dict[nombre].append(cita.texto)

        graphs_data.append({
            "id": graph.id,
            "lugar": graph.lugar,
            "tema": graph.tema,
            "bajadas": bajadas,
            "entrevistados": [{"nombre": n, "citas": c} for n, c in entrevistados_dict.items()],
            "activo": graph.activo,
            "plantilla_id": graph.plantilla_id
        })

    return jsonify(graphs_data)


@graphs_bp.route('/stream_graphs')
def stream_graphs():
    def event_stream():
        while True:
            try:
                with current_app.app_context():
                    graph_activo = Graph.query.options(
                        selectinload(Graph.bajadas),
                        joinedload(Graph.citas).joinedload(Cita.entrevistado)
                    ).filter_by(activo=True).first()

                    live_config = display_config.get('live', {
                        'show': True,
                        'text': 'VIVO',
                        'position': 'top-right'
                    })

                    data = {
                        "activo": bool(graph_activo),
                        "show_live": live_config['show'],
                        "live_text": live_config['text'],
                        "live_position": live_config.get('position', 'top-right')
                    }

                    if graph_activo:
                        primera_bajada = graph_activo.bajadas[0].texto if graph_activo.bajadas else ""
                        primer_entrevistado = ""
                        primera_cita = ""
                        if graph_activo.citas:
                            primer_entrevistado = graph_activo.citas[0].entrevistado.nombre
                            primera_cita = graph_activo.citas[0].texto

                        data.update({
                            "bajada": primera_bajada,
                            "entrevistado": primer_entrevistado,
                            "cita": primera_cita,
                            "lugar": graph_activo.lugar,
                            "tema": graph_activo.tema
                        })

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
    return "Guion no encontrado", 404


@graphs_bp.route('/graphs/activo/<int:id>', methods=['PUT'])
def setGraphsActivo(id):
    Graph.query.update({Graph.activo: False})
    graph = Graph.query.get(id)
    if not graph:
        return jsonify({"error": "Graph no encontrado"}), 404
    graph.activo = True
    db.session.commit()

    registrar('INFO',
              f'Activó graph: {graph.lugar}',
              'graph', id, graph.lugar)

    return jsonify({"mensaje": "Graph activo actualizado"})


@graphs_bp.route('/obtener_graph_activo')
def obtener_graph_activo():
    graph_activo = Graph.query.options(
        selectinload(Graph.bajadas),
        joinedload(Graph.citas).joinedload(Cita.entrevistado)
    ).filter_by(activo=True).first()

    if not graph_activo:
        return jsonify({"activo": False})

    primera_bajada = graph_activo.bajadas[0].texto if graph_activo.bajadas else ""
    primer_entrevistado = ""
    if graph_activo.citas:
        primer_entrevistado = graph_activo.citas[0].entrevistado.nombre

    return jsonify({
        "activo": True,
        "id": graph_activo.id,
        "lugar": graph_activo.lugar,
        "tema": graph_activo.tema,
        "primera_bajada": primera_bajada,
        "entrevistado": primer_entrevistado,
    })


def get_base_xml_template():
    return '''<?xml version="1.0" encoding="ISO8859-1" ?>
      <Video TextDelay="0" Width="1" Height="1" Loop="1" PageName="05 COMPLETO OK" bannertime="0" bannerpause="0" bannerin="0" bannerout="0">
        5
        <Object#1 tipo="89" id="0" gradang="0" acolori="255" rcolori="232" gcolori="232" bcolori="232" acolorf="255" rcolorf="232" gcolorf="232" bcolorf="232" bidir="0" repeat1="0" linechar="1" shadow="False" Rshadow="0" gshadow="0" bshadow="0" shdireccion="8" tiposhadow="0" shadowradio="100" shadowoffset="3" MaskEnabled="0" Maskleft="4" Masktop="4" MaskHeight="570" MaskWidth="1015" outline="True" Aoutli="255" routli="38" goutli="38" boutli="38" useaudio="0" lastframe="-1" Aoutlf="255" routlf="38" goutlf="38" boutlf="38" outlinetype="solid" outlinegrad="0" outlinewidth="4" outlinebidir="0" outlinerepeat1="0" texture="False" texturepath="V:\\ID NUEVE NOTICIAS 2024\\ZOCALO\\ZOCALO.avi" texturesize="False" videodelay="0" looppoint="0" loopEndpoint="0" loopTextpoint="0" loop="0" speed="5" Movement="0" PIPNumber="0" font="Arial" fontsize="40" stilo="0" alineacion="0" w="0" h="0" layerx="0" layery="0" layerw="0" layerh="0" transparency="0"/>
        <Object#2 tipo="77" id="0" gradang="0" acolori="255" rcolori="209" gcolori="209" bcolori="209" acolorf="255" rcolorf="209" gcolorf="209" bcolorf="209" bidir="0" repeat1="0" linechar="1" shadow="False" Rshadow="0" gshadow="0" bshadow="0" shdireccion="8" tiposhadow="0" shadowradio="0" shadowoffset="6" MaskEnabled="0" Maskleft="4" Masktop="4" MaskHeight="570" MaskWidth="1015" outline="True" Aoutli="255" routli="38" goutli="38" boutli="38" useaudio="0" lastframe="-1" Aoutlf="255" routlf="38" goutlf="38" boutlf="38" outlinetype="solid" outlinegrad="0" outlinewidth="4" outlinebidir="0" outlinerepeat1="0" texture="False" texturesize="False" videodelay="0" looppoint="0" loopEndpoint="0" loopTextpoint="0" loop="0" speed="6" Movement="0" PIPNumber="0" font="Open Sans Extrabold" fontsize="52" stilo="0" alineacion="3" w="297" h="126" layerx="263" layery="849" layerw="0" layerh="0" transparency="0">
          {primera_bajada}
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
        graphs_dir = os.path.join(current_app.root_path, 'Graphs')
        os.makedirs(graphs_dir, exist_ok=True)

        textos = Texto.query.options(
            selectinload(Texto.graphs).options(
                selectinload(Graph.bajadas),
                joinedload(Graph.citas).joinedload(Cita.entrevistado)
            )
        ).all()
        total_graphs = sum(len(t.graphs) for t in textos)

        for texto in textos:
            for i, graph in enumerate(sorted(texto.graphs, key=lambda x: x.id), start=1):
                primera_bajada = graph.bajadas[0].texto if graph.bajadas else ""
                primer_entrevistado = ""
                if graph.citas:
                    primer_entrevistado = graph.citas[0].entrevistado.nombre

                xml_content = get_base_xml_template().format(
                    primera_bajada=primera_bajada,
                    tema=graph.tema or "TEMA",
                    lugar=graph.lugar or "",
                    entrevistado=primer_entrevistado
                )

                ruta_archivo = os.path.join(graphs_dir, f"{texto.numero_de_nota}_{i}.xml")
                with open(ruta_archivo, 'w', encoding='ISO-8859-1') as f:
                    f.write(xml_content)

        registrar('INFO',
                  f'Generó XML de graphs ({total_graphs} archivos)',
                  None, None, None,
                  f'{total_graphs} archivos en carpeta Graphs')

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


@graphs_bp.route('/update_display_config', methods=['POST'])
def update_display_config():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"status": "error", "message": "No data provided"}), 400

        config_file = 'display_config.json'
        current_config = {}
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                current_config = json.load(f)

        if 'live' in data and 'show' in data['live']:
            data['live']['show'] = str(data['live']['show']).lower() == 'true'

        for section in ['layout', 'badges', 'live']:
            if section in data:
                if section not in current_config:
                    current_config[section] = {}
                current_config[section].update(data[section])

        current_config['last_updated'] = datetime.utcnow().isoformat()

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
_CACHE_EXPIRY = timedelta(seconds=5)


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
                    graph_activo = db.session.query(Graph).options(
                        selectinload(Graph.bajadas),
                        joinedload(Graph.citas).joinedload(Cita.entrevistado)
                    ).filter_by(activo=True).first()

                    try:
                        with open('display_config.json', 'r') as f:
                            saved_config = json.load(f)
                    except Exception as e:
                        app.logger.error(f"No se pudo cargar display_config.json: {str(e)}")
                        saved_config = {"layout": {}, "badges": {}, "live": {}}

                    config = {
                        "layout": saved_config.get("layout", {}),
                        "badges": saved_config.get("badges", {}),
                        "live":   saved_config.get("live",   {}),
                        "content": {
                            "primera_bajada": "",
                            "segunda_bajada": "",
                            "entrevistado":   "",
                            "lugar":          "",
                        }
                    }

                    if graph_activo:
                        bajadas = sorted(graph_activo.bajadas, key=lambda b: b.id)
                        primer_entrevistado = ""
                        if graph_activo.citas:
                            primer_entrevistado = graph_activo.citas[0].entrevistado.nombre

                        config['content'] = {
                            "primera_bajada": bajadas[0].texto if len(bajadas) > 0 else "",
                            "segunda_bajada": bajadas[1].texto if len(bajadas) > 1 else "",
                            "entrevistado":   primer_entrevistado,
                            "lugar":          graph_activo.lugar or ""
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
