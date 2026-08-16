import json
import re
import time
from sqlite3 import IntegrityError

from flask import Blueprint, jsonify, request, render_template, stream_with_context, Response, current_app

from sqlalchemy.orm import joinedload, selectinload
from .. import db
from ..models import Texto, Guion, Graph, Cita, Bajada
from ..audit import registrar
import requests

textos_bp = Blueprint('textos', __name__)


# ---------------------------------------------------------------------------
# Helpers de reordenamiento
# ---------------------------------------------------------------------------

def _incrementar_notas_desde(guion_id, desde):
    """Incrementa en 1 todas las notas con numero_de_nota >= desde en el guion."""
    notas = Texto.query.filter(
        Texto.guion_id == guion_id,
        Texto.numero_de_nota >= desde
    ).order_by(Texto.numero_de_nota.desc()).all()
    for nota in notas:
        nota.numero_de_nota += 1


def _decrementar_notas_desde(guion_id, desde):
    """Decrementa en 1 todas las notas con numero_de_nota > desde en el guion."""
    notas = Texto.query.filter(
        Texto.guion_id == guion_id,
        Texto.numero_de_nota > desde
    ).all()
    for nota in notas:
        nota.numero_de_nota -= 1


def _mover_rango_notas(guion_id, numero_actual, nuevo_numero):
    """Reordena notas al mover una nota de numero_actual a nuevo_numero."""
    if nuevo_numero > numero_actual:
        notas = Texto.query.filter(
            Texto.guion_id == guion_id,
            Texto.numero_de_nota > numero_actual,
            Texto.numero_de_nota <= nuevo_numero
        ).all()
        for nota in notas:
            nota.numero_de_nota -= 1
    else:
        notas = Texto.query.filter(
            Texto.guion_id == guion_id,
            Texto.numero_de_nota >= nuevo_numero,
            Texto.numero_de_nota < numero_actual
        ).all()
        for nota in notas:
            nota.numero_de_nota += 1


# ---------------------------------------------------------------------------
# Serialización
# ---------------------------------------------------------------------------

def _serializar_texto(t):
    """Convierte un objeto Texto (con graphs cargados) a dict."""
    texto_data = {
        "id": t.id,
        "numero_de_nota": t.numero_de_nota,
        "titulo": t.titulo,
        "contenido": t.contenido,
        "musica": t.musica,
        "duracion": t.duracion,
        "material": t.material,
        "activo": t.activo,
        "grabar": t.grabar,
        "emitido": t.emitido,
        "guion_id": t.guion_id,
        "graphs": []
    }
    for g in t.graphs:
        entrevistados = {}
        for cita in g.citas:
            nombre = cita.entrevistado.nombre
            if nombre not in entrevistados:
                entrevistados[nombre] = []
            entrevistados[nombre].append(cita.texto)

        texto_data["graphs"].append({
            "id": g.id,
            "lugar": g.lugar,
            "tema": g.tema,
            "activo": g.activo,
            "bajadas": [b.texto for b in g.bajadas],
            "entrevistados": [
                {"nombre": nombre, "citas": citas}
                for nombre, citas in entrevistados.items()
            ]
        })
    return texto_data


# ---------------------------------------------------------------------------
# SSE: todos los textos (uso general, desde principal.html)
# ---------------------------------------------------------------------------

@textos_bp.route('/stream_textos')
def stream_textos():
    def event_stream():
        while True:
            try:
                textos = Texto.query.options(
                    selectinload(Texto.graphs).options(
                        selectinload(Graph.bajadas),
                        joinedload(Graph.citas).joinedload(Cita.entrevistado)
                    )
                ).all()
                data = [_serializar_texto(t) for t in textos]
                yield f"data: {json.dumps(data)}\n\n"
            except Exception as e:
                current_app.logger.error(f"Error en stream_textos: {str(e)}")
                yield "event: error\ndata: {}\n\n"
                time.sleep(5)
                continue
            finally:
                db.session.remove()
            time.sleep(10)

    return Response(stream_with_context(event_stream()),
                    content_type='text/event-stream',
                    headers={'X-Accel-Buffering': 'no'})


# ---------------------------------------------------------------------------
# SSE: estados liviano por guion (usado desde ver_guion.html)
# Envia solo {id, activo, emitido} cada 2s para el guion indicado.
# Mucho mas eficiente que stream_textos para la vista de lectura.
# ---------------------------------------------------------------------------

@textos_bp.route('/stream_guion/<int:guion_id>')
def stream_guion(guion_id):
    def event_stream():
        while True:
            try:
                textos = Texto.query.filter_by(guion_id=guion_id).options(
                    selectinload(Texto.graphs).options(
                        selectinload(Graph.bajadas),
                        joinedload(Graph.citas).joinedload(Cita.entrevistado)
                    )
                ).all()
                data = [_serializar_texto(t) for t in textos]
                yield f"data: {json.dumps(data)}\n\n"
            except Exception as e:
                current_app.logger.error(f"Error en stream_guion: {str(e)}")
                yield "event: error\ndata: {}\n\n"
                time.sleep(5)
                continue
            finally:
                db.session.remove()
            time.sleep(2)

    return Response(
        stream_with_context(event_stream()),
        content_type='text/event-stream',
        headers={'X-Accel-Buffering': 'no'}
    )


# ---------------------------------------------------------------------------
# SSE: texto activo (usado desde siguiente.html / pantalla de control)
# ---------------------------------------------------------------------------

@textos_bp.route('/stream_texto_activo')
def stream_texto_activo():
    def event_stream():
        while True:
            try:
                texto_activo = Texto.query.options(
                    selectinload(Texto.graphs).options(
                        selectinload(Graph.bajadas),
                        joinedload(Graph.citas).joinedload(Cita.entrevistado)
                    )
                ).filter_by(activo=True).first()

                if texto_activo:
                    yield f"data: {json.dumps(_serializar_texto(texto_activo))}\n\n"
                else:
                    yield "data: {}\n\n"
            except Exception as e:
                current_app.logger.error(f"Error en stream_texto_activo: {str(e)}")
                yield "event: error\ndata: {}\n\n"
                time.sleep(5)
                continue
            finally:
                db.session.remove()
            time.sleep(1)

    return Response(stream_with_context(event_stream()),
                    content_type='text/event-stream',
                    headers={'X-Accel-Buffering': 'no'})


# ---------------------------------------------------------------------------
# CRUD Textos
# ---------------------------------------------------------------------------

@textos_bp.route('/textos', methods=['GET', 'POST'])
def textos():
    if request.method == 'POST':
        data = request.json
        if not data or 'numero_de_nota' not in data or 'titulo' not in data:
            return jsonify({"mensaje": "Datos incompletos"}), 400

        try:
            numero_de_nota = int(data['numero_de_nota'])
            guion_id = data.get('guion_id')

            if Texto.query.filter_by(numero_de_nota=numero_de_nota, guion_id=guion_id).first():
                _incrementar_notas_desde(guion_id, numero_de_nota)

            nuevo_texto = Texto(
                numero_de_nota=numero_de_nota,
                titulo=data['titulo'],
                duracion=data.get('duracion', ''),
                contenido=data.get('contenido', ''),
                musica=data.get('musica', ''),
                material=data.get('material', ''),
                grabar=data.get('grabar', False),
                guion_id=guion_id
            )
            db.session.add(nuevo_texto)
            db.session.commit()

            guion = Guion.query.get(guion_id)
            registrar('INFO',
                      f'Agregó nota #{nuevo_texto.numero_de_nota}: {nuevo_texto.titulo}',
                      'texto', nuevo_texto.id, nuevo_texto.titulo,
                      f'Guión: {guion.nombre if guion else guion_id}')

            return jsonify({"mensaje": "Texto agregado", "id": nuevo_texto.id}), 201

        except ValueError:
            db.session.rollback()
            return jsonify({"mensaje": "Número de nota debe ser un valor numérico"}), 400
        except Exception as e:
            db.session.rollback()
            return jsonify({"mensaje": f"Error al crear texto: {str(e)}"}), 500

    # GET
    textos = Texto.query.options(
        joinedload(Texto.graphs).joinedload(Graph.bajadas),
        joinedload(Texto.graphs).joinedload(Graph.citas).joinedload(Cita.entrevistado)
    ).all()
    return jsonify([_serializar_texto(t) for t in textos])


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
        "material": t.material,
        "grabar": t.grabar
    } for t in textos])


@textos_bp.route('/textos/<int:id>', methods=['GET'])
def obtener_texto(id):
    texto = Texto.query.get(id)
    if not texto:
        return jsonify({"mensaje": "Texto no encontrado"}), 404
    return jsonify({
        "id": texto.id,
        "numero_de_nota": texto.numero_de_nota,
        "titulo": texto.titulo,
        "duracion": texto.duracion,
        "contenido": texto.contenido,
        "musica": texto.musica,
        "material": texto.material,
        "grabar": texto.grabar,
        "activo": texto.activo
    })


@textos_bp.route('/textos/editar/<int:id>', methods=['PUT'])
def editar_texto(id):
    data = request.json
    texto = Texto.query.get(id)
    if not texto:
        return jsonify({"mensaje": "Texto no encontrado"}), 404

    nuevo_numero = int(data.get('numero_de_nota', texto.numero_de_nota))
    numero_actual = texto.numero_de_nota
    guion_id = texto.guion_id

    if nuevo_numero != numero_actual:
        nota_existente = Texto.query.filter_by(
            numero_de_nota=nuevo_numero,
            guion_id=guion_id
        ).first()
        if nota_existente and nota_existente.id != id:
            _mover_rango_notas(guion_id, numero_actual, nuevo_numero)

    texto.numero_de_nota = nuevo_numero
    texto.titulo = data.get('titulo', texto.titulo)
    texto.duracion = data.get('duracion', texto.duracion)
    texto.contenido = data.get('contenido', texto.contenido)
    texto.musica = data.get('musica', texto.musica)
    texto.material = data.get('material', texto.material)
    texto.grabar = data.get('grabar', texto.grabar)

    db.session.commit()

    registrar('WARNING',
              f'Editó nota #{texto.numero_de_nota}: {texto.titulo}',
              'texto', id, texto.titulo)

    return jsonify({"mensaje": "Texto actualizado"})


@textos_bp.route('/textos/borrar/<int:id>', methods=['DELETE'])
def borrar_texto(id):
    try:
        texto = Texto.query.options(
            selectinload(Texto.graphs).options(
                selectinload(Graph.bajadas),
                selectinload(Graph.citas),
                selectinload(Graph.entrevistados)
            )
        ).get(id)

        if not texto:
            return jsonify({"mensaje": "Texto no encontrado"}), 404

        # Capturar antes de eliminar
        titulo_eliminado = texto.titulo
        num_eliminado    = texto.numero_de_nota
        guion_id         = texto.guion_id
        numero_nota_eliminada = texto.numero_de_nota

        for graph in texto.graphs:
            graph.entrevistados = []
            for cita in graph.citas:
                db.session.delete(cita)
            graph.bajadas = []

        db.session.delete(texto)
        _decrementar_notas_desde(guion_id, numero_nota_eliminada)
        db.session.commit()

        registrar('DANGER',
                  f'Eliminó nota #{num_eliminado}: {titulo_eliminado}',
                  'texto', id, titulo_eliminado,
                  f'guion_id={guion_id}')

        return jsonify({"mensaje": "Texto eliminado correctamente"})

    except IntegrityError as e:
        db.session.rollback()
        current_app.logger.error(f"Error de integridad al borrar texto {id}: {str(e)}")
        return jsonify({"mensaje": "Error de integridad referencial", "error": str(e)}), 500
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error al borrar texto {id}: {str(e)}")
        return jsonify({"mensaje": "Error interno del servidor", "error": str(e)}), 500


@textos_bp.route('/textos/actualizar-orden', methods=['PUT'])
def actualizar_orden_textos():
    data = request.json
    guion_id = data['guion_id']
    nuevos_orden = data['nuevos_orden']

    try:
        textos_dict = {t.id: t for t in Texto.query.filter_by(guion_id=guion_id).all()}
        for nuevo_numero, texto_id in enumerate(nuevos_orden, start=1):
            if texto_id in textos_dict:
                textos_dict[texto_id].numero_de_nota = nuevo_numero
        db.session.commit()
        return jsonify({"mensaje": "Orden actualizado correctamente"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al actualizar el orden: {str(e)}"}), 500


# ---------------------------------------------------------------------------
# Activar / Emitir
# ---------------------------------------------------------------------------

@textos_bp.route('/textos/activo/<int:id>', methods=['PUT'])
def setTextoActivo(id):
    texto = Texto.query.get(id)
    if not texto:
        return jsonify({"mensaje": "Texto no encontrado"}), 404

    try:
        Texto.query.filter_by(activo=True).update({Texto.activo: False})
        texto.activo = True

        db.session.commit()

        registrar('INFO',
                  f'Activó nota #{texto.numero_de_nota}: {texto.titulo}',
                  'texto', id, texto.titulo)

        return jsonify({"mensaje": "Texto activado"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al activar texto: {str(e)}"}), 500


@textos_bp.route('/textos/emitido/<int:id>', methods=['PUT'])
def setTextoEmitido(id):
    texto = Texto.query.get(id)
    if not texto:
        return jsonify({"mensaje": "Texto no encontrado"}), 404

    texto.emitido = not texto.emitido
    db.session.commit()

    estado = 'emitido' if texto.emitido else 'no emitido'
    registrar('INFO',
              f'Marcó nota #{texto.numero_de_nota} como {estado}: {texto.titulo}',
              'texto', id, texto.titulo,
              f'Estado emitido: {texto.emitido}')

    return jsonify({"mensaje": "El texto se marcó como emitido", "emitido": texto.emitido})


# ---------------------------------------------------------------------------
# Tiempos
# ---------------------------------------------------------------------------

@textos_bp.route('/tiempos/<int:id>', methods=['GET'])
def obtener_tiempos(id):
    textos_del_guion = Texto.query.filter_by(guion_id=id).all()
    if not textos_del_guion:
        return jsonify({"mensaje": "Guion no encontrado"}), 404

    total_segundos = 0
    for t in textos_del_guion:
        if t.duracion:
            try:
                partes = t.duracion.split(':')
                if len(partes) == 3:
                    h, m, s = map(int, partes)
                    total_segundos += h * 3600 + m * 60 + s
                elif len(partes) == 2:
                    m, s = map(int, partes)
                    total_segundos += m * 60 + s
            except (ValueError, AttributeError):
                continue

    horas, resto = divmod(total_segundos, 3600)
    minutos, segundos = divmod(resto, 60)
    return jsonify({"duracion_total": f"{horas:02d}:{minutos:02d}:{segundos:02d}"})


# ---------------------------------------------------------------------------
# Vistas
# ---------------------------------------------------------------------------

@textos_bp.route('/siguiente')
def mostrar_texto_activo():
    texto_activo = Texto.query.filter_by(activo=True).first()
    return render_template('siguiente.html', texto=texto_activo)


@textos_bp.route('/obtener_textos_guion/<int:id>')
def obtener_textos_guion(id):
    guion = Guion.query.get(id)
    if not guion:
        return jsonify({"mensaje": "Guion no encontrado"}), 404
    return jsonify([{
        "id": t.id,
        "titulo": t.titulo,
        "contenido": t.contenido,
        "musica": t.musica,
        "material": t.material,
        "grabar": t.grabar,
        "numero_de_nota": t.numero_de_nota,
        "activo": t.activo
    } for t in guion.textos])


# ---------------------------------------------------------------------------
# Bajadas
# ---------------------------------------------------------------------------

@textos_bp.route('/api/bajadas', methods=['GET'])
def get_bajadas():
    try:
        bajadas = Bajada.query.options(joinedload(Bajada.graphs)).all()
        result = []
        for bajada in bajadas:
            for graph in bajada.graphs:
                result.append({
                    'id': bajada.id,
                    'texto': bajada.texto,
                    'graph_id': graph.id,
                    'graph_lugar': graph.lugar,
                    'graph_tema': graph.tema
                })
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@textos_bp.route('/api/show_bajada/<int:bajada_id>', methods=['POST'])
def show_bajada(bajada_id):
    try:
        bajada = Bajada.query.get_or_404(bajada_id)
        return jsonify({
            'success': True,
            'message': f'Bajada "{bajada.texto}" mostrada en pantalla'
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@textos_bp.route('/api/bajadas')
def get_all_bajadas():
    bajadas = Bajada.query.all()
    return jsonify([{
        'id': b.id,
        'texto': b.texto,
        'graph_id': b.graphs[0].id if b.graphs else None
    } for b in bajadas])


def reordenar_notas_despues_de_agregar(guion_id, numero_nota_nueva):
    """Reordena las notas existentes cuando se agrega una nueva"""
    notas_a_actualizar = Texto.query.filter(
        Texto.guion_id == guion_id,
        Texto.numero_de_nota >= numero_nota_nueva
    ).order_by(Texto.numero_de_nota.desc()).all()

    for nota in notas_a_actualizar:
        if nota.numero_de_nota == numero_nota_nueva:
            # Solo incrementar las que tienen el mismo número o mayor
            nota.numero_de_nota += 1

    return True


@textos_bp.route('/obtener_guiones', methods=['GET'])
def obtener_guiones():
    try:
        guiones = Guion.query.all()
        result = []
        for guion in guiones:
            # Contar notas para grabar
            notas_para_grabar = sum(1 for texto in guion.textos if texto.grabar)

            result.append({
                "id": guion.id,
                "nombre": guion.nombre,
                "descripcion": guion.descripcion or "",
                "cantidad_notas": len(guion.textos),
                "notas_para_grabar": notas_para_grabar
            })
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@textos_bp.route('/proxy/detener_grabacion', methods=['POST'])
def proxy_detener_grabacion():
    try:
        # USAR LA NUEVA VERSIÓN SIMPLE
        php_url = f"{current_app.config['RECORDING_SERVER_URL']}/detener_grabacion_simple.php"

        print("Enviando solicitud de detención a PHP")
        response = requests.get(php_url, timeout=10)

        print(f"Respuesta detención: status={response.status_code}, text={response.text[:200]}")

        try:
            data = response.json()
        except:
            # Si no es JSON, convertirlo
            data = {
                "success": response.status_code == 200,
                "message": response.text
            }

        return jsonify(data), response.status_code

    except Exception as e:
        print(f"Error en proxy detener: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Error: {str(e)}"
        }), 500


# En textos.py, agrega estas rutas:

@textos_bp.route('/proxy/iniciar_grabacion_control', methods=['POST'])
def proxy_iniciar_grabacion_control():
    """
    Proxy para iniciar grabación con control (nuevo script)
    """
    try:
        data = request.json
        texto_id = data.get('texto_id')
        titulo = data.get('titulo')
        guion_nombre = data.get('guion_nombre')

        print(f"Proxy iniciar control - Parámetros: texto_id={texto_id}, titulo={titulo}, guion={guion_nombre}")

        if not all([texto_id, titulo, guion_nombre]):
            return jsonify({
                "success": False,
                "message": "Faltan parámetros"
            }), 400

        # 1. Obtener el tema del primer graph para el nombre del archivo
        nombre_para_grabacion = titulo

        try:
            texto = Texto.query.get(texto_id)
            if texto and texto.graphs:
                graphs_ordenados = sorted(texto.graphs, key=lambda g: g.id)
                primer_graph = graphs_ordenados[0] if graphs_ordenados else None

                if primer_graph and primer_graph.tema and primer_graph.tema.strip():
                    nombre_para_grabacion = primer_graph.tema.strip()
                    print(f"✓ Usando tema del graph: {nombre_para_grabacion}")
                else:
                    print(f"⚠ Graph sin tema, usando título: {titulo}")
            else:
                print(f"⚠ Texto sin graphs, usando título: {titulo}")
        except Exception as e:
            print(f"✗ Error obteniendo tema: {e}")
            # Continuar con el título

        # 2. URL del NUEVO PHP con control
        php_url = f"{current_app.config['RECORDING_SERVER_URL']}/grabar_nota_con_nombre_control.php"

        # 3. Parámetros
        params = {
            'texto_id': texto_id,
            'titulo': nombre_para_grabacion,
            'guion_nombre': guion_nombre
        }

        print(f"Enviando a PHP: {php_url}")
        print(f"Params: {params}")

        # 4. Timeout más largo para inicio de grabación
        response = requests.get(php_url, params=params, timeout=20)

        print(f"Respuesta PHP - Status: {response.status_code}")
        print(f"Respuesta PHP - Texto: {response.text[:200]}")

        if response.status_code == 200:
            # Intentar extraer PID si está en la respuesta
            pid_match = re.search(r'\(PID:\s*(\d+)\)', response.text)
            pid = pid_match.group(1) if pid_match else None

            return jsonify({
                "success": True,
                "message": response.text,
                "pid": pid,
                "nombre_archivo": nombre_para_grabacion
            }), 200
        else:
            return jsonify({
                "success": False,
                "message": f"Error del servidor: {response.status_code} - {response.text[:100]}"
            }), response.status_code

    except requests.exceptions.Timeout:
        print("✗ Timeout al conectar con PHP")
        return jsonify({
            "success": False,
            "message": "Timeout: El servidor de grabación no responde (puede que la grabación se haya iniciado igual)"
        }), 504
    except requests.exceptions.ConnectionError:
        print("✗ Connection error al conectar con PHP")
        return jsonify({
            "success": False,
            "message": "No se pudo conectar con el servidor de grabación"
        }), 502
    except Exception as e:
        print(f"✗ Error interno en proxy: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Error interno: {str(e)}"
        }), 500


@textos_bp.route('/proxy/detener_grabacion_limpia', methods=['POST'])
def proxy_detener_grabacion_limpia():
    """
    Proxy para detención limpia con control
    """
    try:
        # URL del NUEVO PHP de detención limpia
        php_url = f"{current_app.config['RECORDING_SERVER_URL']}/detener_grabacion_limpio.php"

        print("Enviando solicitud de detención limpia a PHP")
        response = requests.get(php_url, timeout=15)

        print(f"Respuesta detención limpia - Status: {response.status_code}")

        try:
            data = response.json()
        except json.JSONDecodeError:
            # Si no es JSON válido, crear respuesta
            data = {
                "success": response.status_code == 200,
                "message": response.text[:200] if response.text else "Sin respuesta del servidor"
            }

        print(f"Respuesta detención limpia - Data: {data}")

        return jsonify(data), response.status_code

    except requests.exceptions.Timeout:
        print("✗ Timeout en detención limpia")
        return jsonify({
            "success": False,
            "message": "Timeout al intentar detener la grabación"
        }), 504
    except requests.exceptions.ConnectionError:
        print("✗ Connection error en detención limpia")
        return jsonify({
            "success": False,
            "message": "No se pudo conectar para detener la grabación"
        }), 502
    except Exception as e:
        print(f"✗ Error en proxy detención limpia: {str(e)}")
        return jsonify({
            "success": False,
            "message": f"Error: {str(e)}"
        }), 500


@textos_bp.route('/proxy/estado_grabacion', methods=['GET'])
def proxy_estado_grabacion():
    """
    Proxy para obtener estado actual de la grabación
    """
    try:
        php_url = f"{current_app.config['RECORDING_SERVER_URL']}/estado_grabacion.php"

        response = requests.get(php_url, timeout=5)

        return Response(response.text, mimetype='text/plain'), response.status_code

    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"Error obteniendo estado: {str(e)}"
        }), 500
