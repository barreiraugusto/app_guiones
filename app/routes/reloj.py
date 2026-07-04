from flask import Blueprint, render_template, Response
import time
from threading import Thread, Lock

reloj_bp = Blueprint('reloj', __name__)

_lock = Lock()
cronometro_activo = False
tiempo = 0


def simular_cronometro():
    global tiempo, cronometro_activo
    while True:
        with _lock:
            if cronometro_activo:
                tiempo += 1
        time.sleep(1)


@reloj_bp.route('/reloj')
def reloj():
    return render_template('reloj.html')


@reloj_bp.route('/control')
def control():
    return render_template('control.html')


@reloj_bp.route('/stream')
def stream():
    def event_stream():
        while True:
            with _lock:
                t = tiempo
                activo = cronometro_activo
            estado = "activo" if activo else "inactivo"
            yield f"data: {t},{estado}\n\n"
            time.sleep(1)

    return Response(event_stream(), mimetype='text/event-stream')


@reloj_bp.route('/iniciar')
def iniciar():
    global cronometro_activo
    with _lock:
        cronometro_activo = True
    return '', 204


@reloj_bp.route('/detener')
def detener():
    global cronometro_activo
    with _lock:
        cronometro_activo = False
    return '', 204


@reloj_bp.route('/restablecer')
def restablecer():
    global tiempo
    with _lock:
        tiempo = 0
    return '', 204


Thread(target=simular_cronometro, daemon=True).start()
