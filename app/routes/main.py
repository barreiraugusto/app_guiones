# app/routes/main.py
from flask import Blueprint, render_template
from app import MUSICA_OPCIONES  # Importar la variable

main_bp = Blueprint('main', __name__)


@main_bp.route('/')
def index():
    return render_template('index.html')


@main_bp.route('/pantalla')
def pantalla():
    return render_template('pantalla.html')


@main_bp.route('/principal')
def principal():
    return render_template('principal.html', musica_opciones=MUSICA_OPCIONES)


@main_bp.route('/control_live')
def control_live():
    return render_template('control_live.html')
