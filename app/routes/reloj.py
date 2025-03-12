from flask import Blueprint, render_template, Response
import time
from threading import Thread

reloj_bp = Blueprint('reloj', __name__)

cronometro_activo = False
tiempo = 0


def simular_cronometro():
    global tiempo, cronometro_activo
    while True:
        if cronometro_activo:
            tiempo += 1
            print(f"Tiempo actual: {tiempo}")  # Depuración
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
        global tiempo, cronometro_activo
        while True:
            estado = "activo" if cronometro_activo else "inactivo"
            yield f"data: {tiempo},{estado}\n\n"
            time.sleep(1)

    return Response(event_stream(), mimetype='text/event-stream')


@reloj_bp.route('/iniciar')
def iniciar():
    global cronometro_activo
    cronometro_activo = True
    return '', 204


@reloj_bp.route('/detener')
def detener():
    global cronometro_activo
    cronometro_activo = False
    return '', 204


@reloj_bp.route('/restablecer')
def restablecer():
    global tiempo
    tiempo = 0
    return '', 204


# Iniciar el hilo para simular el cronómetro
Thread(target=simular_cronometro, daemon=True).start()
