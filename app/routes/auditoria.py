import csv
import io
from datetime import datetime
from functools import wraps

from flask import Blueprint, render_template, request, Response, session, redirect, url_for

from .. import db
from ..models import AuditLog

auditoria_bp = Blueprint('auditoria', __name__)

_POR_PAGINA  = 75
_CLAVE       = 'sigpro2026'   # ← cambiá esta clave


def _requiere_clave(f):
    """Decorador: redirige al login de auditoría si no hay sesión activa."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('auditoria_ok'):
            return redirect(url_for('auditoria.login_auditoria',
                                    next=request.url))
        return f(*args, **kwargs)
    return decorated


@auditoria_bp.route('/auditoria/login', methods=['GET', 'POST'])
def login_auditoria():
    error = None
    if request.method == 'POST':
        if request.form.get('clave') == _CLAVE:
            session['auditoria_ok'] = True
            next_url = request.args.get('next') or url_for('auditoria.auditoria')
            return redirect(next_url)
        error = 'Contraseña incorrecta'

    return render_template('auditoria_login.html', error=error)


@auditoria_bp.route('/auditoria/logout')
def logout_auditoria():
    session.pop('auditoria_ok', None)
    return redirect(url_for('auditoria.login_auditoria'))


@auditoria_bp.route('/auditoria')
@_requiere_clave
def auditoria():
    pagina         = request.args.get('p',       1,  type=int)
    nivel          = request.args.get('nivel',   '')
    ip_filtro      = request.args.get('ip',      '')
    entidad_filtro = request.args.get('entidad', '')

    q = AuditLog.query.order_by(AuditLog.timestamp.desc())
    if nivel:
        q = q.filter_by(nivel=nivel)
    if ip_filtro:
        q = q.filter(AuditLog.ip.like(f'%{ip_filtro}%'))
    if entidad_filtro:
        q = q.filter_by(tipo_entidad=entidad_filtro)

    total         = q.count()
    registros     = q.offset((pagina - 1) * _POR_PAGINA).limit(_POR_PAGINA).all()
    total_paginas = max(1, (total + _POR_PAGINA - 1) // _POR_PAGINA)

    total_info    = AuditLog.query.filter_by(nivel='INFO').count()
    total_warning = AuditLog.query.filter_by(nivel='WARNING').count()
    total_danger  = AuditLog.query.filter_by(nivel='DANGER').count()

    return render_template(
        'auditoria.html',
        registros=registros,
        pagina=pagina,
        total_paginas=total_paginas,
        total=total,
        total_info=total_info,
        total_warning=total_warning,
        total_danger=total_danger,
        nivel=nivel,
        ip_filtro=ip_filtro,
        entidad_filtro=entidad_filtro,
    )


@auditoria_bp.route('/auditoria/exportar')
@_requiere_clave
def exportar_csv():
    """Exporta el log filtrado como archivo CSV."""
    nivel          = request.args.get('nivel',   '')
    ip_filtro      = request.args.get('ip',      '')
    entidad_filtro = request.args.get('entidad', '')

    q = AuditLog.query.order_by(AuditLog.timestamp.desc())
    if nivel:
        q = q.filter_by(nivel=nivel)
    if ip_filtro:
        q = q.filter(AuditLog.ip.like(f'%{ip_filtro}%'))
    if entidad_filtro:
        q = q.filter_by(tipo_entidad=entidad_filtro)

    registros = q.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['ID', 'Fecha', 'Nivel', 'IP', 'Accion',
                     'Tipo_Entidad', 'ID_Entidad', 'Nombre_Entidad',
                     'Detalle', 'UserAgent'])
    for r in registros:
        writer.writerow([
            r.id,
            r.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
            r.nivel,
            r.ip,
            r.accion,
            r.tipo_entidad   or '',
            r.id_entidad     or '',
            r.nombre_entidad or '',
            r.detalle        or '',
            r.user_agent     or '',
        ])

    output.seek(0)
    filename = f'auditoria_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    return Response(
        output.getvalue(),
        mimetype='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename={filename}'},
    )
