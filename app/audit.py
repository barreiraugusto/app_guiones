"""
audit.py — Sistema de auditoría de acciones de usuarios.

Uso:
    from .audit import registrar

    registrar('INFO',    'Creó guión: Mediodía', 'guion', guion.id, guion.nombre)
    registrar('WARNING', 'Editó nota #3',        'texto', texto.id, texto.titulo)
    registrar('DANGER',  'Eliminó graph',         'graph', graph.id, graph.lugar)
"""

import sys
from flask import request


def _get_client_ip() -> str:
    """Devuelve la IP real del cliente respetando proxies inversos."""
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        return forwarded_for.split(',')[0].strip()
    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        return real_ip.strip()
    return request.remote_addr or '0.0.0.0'


def registrar(
    nivel: str,
    accion: str,
    tipo_entidad: str | None = None,
    id_entidad: int | None = None,
    nombre_entidad: str | None = None,
    detalle: str | None = None,
) -> None:
    """
    Registra una acción en la tabla audit_log.

    Parámetros
    ----------
    nivel          : 'INFO' | 'WARNING' | 'DANGER'
    accion         : Descripción breve de la acción (ej. "Creó guión: Mediodía").
    tipo_entidad   : Tipo del objeto afectado ('guion', 'texto', 'graph').
    id_entidad     : ID del registro afectado en la BD.
    nombre_entidad : Nombre legible del registro (para no depender del ID).
    detalle        : Información adicional de contexto (cadena libre).
    """
    try:
        # Importaciones internas para evitar importaciones circulares
        from . import db
        from .models import AuditLog

        entrada = AuditLog(
            nivel=nivel,
            ip=_get_client_ip(),
            user_agent=(request.headers.get('User-Agent') or '')[:300],
            accion=accion,
            tipo_entidad=tipo_entidad,
            id_entidad=id_entidad,
            nombre_entidad=(str(nombre_entidad) if nombre_entidad else '')[:255],
            detalle=detalle,
        )
        db.session.add(entrada)
        db.session.commit()

    except Exception as exc:
        # El logging nunca debe interrumpir el flujo principal
        try:
            from . import db
            db.session.rollback()
        except Exception:
            pass
        print(f'[AUDIT ERROR] {exc}', file=sys.stderr)
