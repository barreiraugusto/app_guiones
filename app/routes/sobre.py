from flask import Blueprint, render_template
from ..models import Bajada  # Asegúrate de importar tu modelo Bajada

sobreimpresos_bp = Blueprint('sobreimpresos', __name__)

@sobreimpresos_bp.route('/sobreimpresos')
def mostrar_sobreimpresos():
    return render_template('sobreimpresos.html')
