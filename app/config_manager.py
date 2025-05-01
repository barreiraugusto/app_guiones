import json
from pathlib import Path

CONFIG_FILE = Path(__file__).parent / 'display_config.json'


def load_config():
    """Carga la configuración desde el archivo JSON"""
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        # Configuración por defecto si el archivo no existe o es inválido
        default_config = {
            "layout": {
                "main_vertical": "850px",
                "main_horizontal": "50px"
            },
            "badges": {
                "lugar_x": "1590px",
                "lugar_y": "152px",
                "nombre_x": "989px",
                "nombre_y": "106px"
            },
            "live": {
                "show": True,
                "text": "VIVO",
                "top": "150px",
                "right": "150px"
            },
        }
        save_config(default_config)
        return default_config


def save_config(config):
    """Guarda la configuración en el archivo JSON"""
    with open(CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=4)


# Carga inicial de la configuración
display_config = load_config()
