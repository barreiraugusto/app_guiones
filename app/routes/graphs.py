import os
from flask import current_app
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom import minidom

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
