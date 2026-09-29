# API de lectura `/api/v1` — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blueprint `api` de solo lectura bajo `/api/v1`, con token Bearer, que expone guiones, notas, gráficos, entrevistados, bajadas, plantillas, estado en vivo, grabaciones y auditoría como JSON.

**Architecture:** Un archivo nuevo `app/routes/api.py` con el blueprint, los serializadores privados y los endpoints. Reutiliza `grabacion._snapshot`, `graphs._resolver_mosca` y el estado global de `reloj`. No toca las rutas `/api/*` existentes (las usa el frontend sin token).

**Tech Stack:** Python 3.12, Flask 3.1, Flask-SQLAlchemy 3.1 (`db.get_or_404`), PostgreSQL. Intérprete: `.venv/bin/python`.

**Spec:** `docs/superpowers/specs/2026-09-29-api-lectura-design.md`

## Global Constraints

- Solo lectura: ningún endpoint escribe en la BD, `display_config.json` ni la Capturadora.
- Token: `Config.API_TOKEN = os.environ.get('API_TOKEN', '')`; vacío → 503 `{"error": "API desactivada: falta API_TOKEN"}`; header `Authorization: Bearer <token>` ausente o distinto → 401. Comparación con `hmac.compare_digest`.
- Todas las respuestas bajo `/api/v1` son JSON; errores con forma `{"error": "mensaje"}`.
- Listados: `limit` default 100, máx 1000; `offset` default 0; respuesta `{"items", "total", "limit", "offset"}`.
- Fechas en ISO 8601.
- Orden: guiones por `lower(nombre)` desc y `id` desc; notas por `numero_de_nota`; auditoría por `timestamp` desc; el resto por `id`.
- No hay suite de tests: cada tarea verifica con `app.test_client()` en un heredoc contra la BD local (tiene 1 guion, 6 notas, 6 graphs). No se agrega `tests/`.
- `config.py` no está versionado: se edita localmente pero no se commitea; sí se commitea `config.example.py`.
- Estilo del repo: comentarios y nombres en español, comentarios escasos.

## Review Focus

1. Ruta inexistente bajo `/api/v1` (p. ej. `/api/v1/nada`) o método no permitido → debe responder JSON `{"error"}` con 404/405, no la página HTML de Flask. (Task 1)
2. Header `Authorization` con caracteres no ASCII → `hmac.compare_digest` con `str` lanza `TypeError`; debe responder 401, no 500. (Task 1)
3. `limit`/`offset` no numéricos, negativos o `limit=0`/`limit=5000` → se acotan a los rangos válidos, sin 500. (Task 2)
4. `hasta=2026-09-29` (solo fecha) en auditoría → debe incluir todo ese día, no cortar a las 00:00. Fecha inválida → 400. (Task 3)
5. Graph sin plantilla / sin bajadas / nota sin graphs / sin nota activa → `null` o `[]`, sin 500. (Tasks 2 y 3)

---

### Task 1: Blueprint, token, errores JSON, índice y `/opciones`

**Files:**
- Create: `app/routes/api.py`
- Modify: `app/__init__.py` (registrar blueprint)
- Modify: `config.example.py` (agregar `API_TOKEN`)
- Modify (local, sin commit): `config.py`

**Interfaces:**
- Produces: `api_bp` (Blueprint, nombre `'api'`, prefix `/api/v1`); constantes `LIMIT_DEFAULT = 100`, `LIMIT_MAX = 1000`. Cada vista del blueprint debe tener docstring de una línea: el índice `/api/v1/` la usa como descripción.

- [ ] **Step 1: Correr la verificación (debe fallar)**

```bash
cd /home/augusto/CODIGOS/app_guiones && .venv/bin/python - <<'EOF'
from app import create_app
app = create_app()
c = app.test_client()
H = {'Authorization': 'Bearer prueba'}

app.config['API_TOKEN'] = ''
r = c.get('/api/v1/opciones', headers=H)
assert r.status_code == 503 and r.json['error'].startswith('API desactivada'), (r.status_code, r.data[:200])

app.config['API_TOKEN'] = 'prueba'
assert c.get('/api/v1/opciones').status_code == 401
assert c.get('/api/v1/opciones', headers={'Authorization': 'Bearer otro'}).status_code == 401
assert c.get('/api/v1/opciones', headers={'Authorization': 'prueba'}).status_code == 401
r = c.get('/api/v1/opciones', headers={'Authorization': 'Bearer ñandú'})
assert r.status_code == 401, r.status_code

r = c.get('/api/v1/opciones', headers=H)
assert r.status_code == 200 and 'Titulos' in r.json['musica']

r = c.get('/api/v1/', headers=H)
assert r.status_code == 200
rutas = {x['ruta']: x['descripcion'] for x in r.json['rutas']}
assert '/api/v1/opciones' in rutas and rutas['/api/v1/opciones'], rutas

r = c.get('/api/v1/nada', headers=H)
assert r.status_code == 404 and 'error' in r.json, r.data[:200]
r = c.post('/api/v1/opciones', headers=H)
assert r.status_code == 405 and 'error' in r.json, r.data[:200]

# Fuera de /api/v1 el 404 sigue siendo el HTML de siempre
r = c.get('/no-existe')
assert r.status_code == 404 and r.is_json is False
print('OK')
EOF
```

Expected: FAIL (`AssertionError` en la primera aserción: 404 HTML porque la ruta no existe).

- [ ] **Step 2: Agregar `API_TOKEN` a `config.example.py`**

Después del bloque `CAPTURADORA_PERFIL` (antes de `SQLALCHEMY_ENGINE_OPTIONS`), agregar:

```python

    # Token de la API de lectura /api/v1 (ver docs/api.md). Vacío = API
    # desactivada. Es un secreto: pasarlo por variable de entorno.
    API_TOKEN = os.environ.get('API_TOKEN', '')
```

Agregar la misma línea (`API_TOKEN = os.environ.get('API_TOKEN', '')`) dentro de `class Config` del `config.py` local. **No commitear `config.py`.**

- [ ] **Step 3: Crear `app/routes/api.py`**

```python
"""API de lectura /api/v1 para scripts propios. Detalle en docs/api.md.

Solo lectura: nada de acá escribe en la BD, en display_config.json ni en la
Capturadora. Las rutas /api/* de los otros blueprints las usa el frontend sin
token y no se tocan.
"""

import hmac

from flask import Blueprint, current_app, jsonify, request
from werkzeug.exceptions import HTTPException

from .. import MUSICA_OPCIONES

api_bp = Blueprint('api', __name__)

LIMIT_DEFAULT = 100
LIMIT_MAX = 1000


@api_bp.before_request
def _verificar_token():
    token = current_app.config.get('API_TOKEN', '')
    if not token:
        return jsonify({'error': 'API desactivada: falta API_TOKEN'}), 503
    enviado = request.headers.get('Authorization', '')
    # En bytes: compare_digest con str no acepta caracteres no ASCII.
    if not hmac.compare_digest(enviado.encode(), f'Bearer {token}'.encode()):
        return jsonify({'error': 'Token inválido o ausente'}), 401


@api_bp.app_errorhandler(HTTPException)
def _error_http(e):
    # A nivel app para cubrir también las URLs de /api/v1 que no existen
    # (esas no llegan a los handlers del blueprint). El resto, como siempre.
    if not request.path.startswith('/api/v1'):
        return e
    return jsonify({'error': e.description}), e.code


@api_bp.errorhandler(Exception)
def _error_interno(e):
    current_app.logger.exception('Error en la API')
    return jsonify({'error': 'Error interno'}), 500


@api_bp.route('/')
def indice():
    """Lista de endpoints disponibles."""
    rutas = [
        {'ruta': regla.rule,
         'descripcion': (current_app.view_functions[regla.endpoint].__doc__ or '').strip()}
        for regla in current_app.url_map.iter_rules()
        if regla.endpoint.startswith('api.')
    ]
    return jsonify({'rutas': sorted(rutas, key=lambda r: r['ruta'])})


@api_bp.route('/opciones')
def opciones():
    """Valores fijos del sistema (opciones de música)."""
    return jsonify({'musica': MUSICA_OPCIONES})
```

- [ ] **Step 4: Registrar el blueprint en `app/__init__.py`**

Junto a los otros imports de blueprints:

```python
    from .routes.api import api_bp
```

Y después de `app.register_blueprint(grabacion_bp)`:

```python
    app.register_blueprint(api_bp, url_prefix='/api/v1')
```

- [ ] **Step 5: Correr la verificación del Step 1**

Expected: imprime `OK`.

- [ ] **Step 6: Commit**

```bash
git add app/routes/api.py app/__init__.py config.example.py
git commit -m "feat(api): blueprint /api/v1 de lectura con token Bearer"
```

---

### Task 2: Contenido — guiones, notas, graphs, entrevistados, bajadas, plantillas

**Files:**
- Modify: `app/routes/api.py`

**Interfaces:**
- Consumes: `api_bp`, `LIMIT_DEFAULT`, `LIMIT_MAX` (Task 1).
- Produces (usados por Task 3):
  - `_paginar(query, serializar) -> Response` — aplica `limit`/`offset` del request.
  - `_nota_resumen(t: Texto) -> dict` — `id, numero_de_nota, titulo, duracion, musica, activo, emitido, grabar, grabado, cantidad_graphs`.
  - `_graph(g: Graph) -> dict` — graph serializado completo.

- [ ] **Step 1: Correr la verificación (debe fallar)**

```bash
cd /home/augusto/CODIGOS/app_guiones && .venv/bin/python - <<'EOF'
from app import create_app
from app.models import Guion, Texto, Graph, Entrevistado, Plantilla
app = create_app()
app.config['API_TOKEN'] = 'prueba'
c = app.test_client()
H = {'Authorization': 'Bearer prueba'}
with app.app_context():
    guion = Guion.query.first()
    texto = Texto.query.first()
    graph = Graph.query.first()
    entrevistado = Entrevistado.query.first()
    plantilla = Plantilla.query.first()
    gid, tid, grid = guion.id, texto.id, graph.id
    eid = entrevistado.id if entrevistado else None
    pid = plantilla.id if plantilla else None

r = c.get('/api/v1/guiones', headers=H)
assert r.status_code == 200, r.data[:300]
assert set(r.json) == {'items', 'total', 'limit', 'offset'} and r.json['limit'] == 100
assert {'id', 'nombre', 'descripcion', 'cantidad_notas'} <= set(r.json['items'][0])

# Paginación acotada, sin 500
for qs, lim, off in [('limit=abc&offset=xyz', 100, 0), ('limit=-5&offset=-3', 1, 0),
                     ('limit=0', 1, 0), ('limit=5000', 1000, 0), ('limit=1&offset=1', 1, 1)]:
    r = c.get(f'/api/v1/guiones?{qs}', headers=H)
    assert r.status_code == 200 and (r.json['limit'], r.json['offset']) == (lim, off), (qs, r.json)
r = c.get('/api/v1/guiones?q=zzzz_no_existe', headers=H)
assert r.json['total'] == 0 and r.json['items'] == []

r = c.get(f'/api/v1/guiones/{gid}', headers=H)
assert r.status_code == 200 and r.json['notas'], r.data[:300]
numeros = [n['numero_de_nota'] for n in r.json['notas']]
assert numeros == sorted(numeros)
assert {'id', 'numero_de_nota', 'titulo', 'duracion', 'musica', 'activo', 'emitido',
        'grabar', 'grabado', 'cantidad_graphs'} == set(r.json['notas'][0])

r = c.get(f'/api/v1/notas/{tid}', headers=H)
assert r.status_code == 200
assert {'contenido', 'material', 'grabando', 'recording_id', 'archivo', 'guion', 'graphs'} <= set(r.json)
assert set(r.json['guion']) == {'id', 'nombre'}

r = c.get(f'/api/v1/graphs/{grid}', headers=H)
assert r.status_code == 200
assert {'id', 'texto_id', 'lugar', 'tema', 'activo', 'mostrar_lugar', 'mostrar_tema', 'plantilla',
        'bajadas', 'bajada_activa_id', 'entrevistados', 'citas', 'cita_activa_id',
        'bajadas_auto'} == set(r.json), set(r.json)
assert set(r.json['bajadas_auto']) == {'activo', 'loop', 'duracion_segundos', 'epoch_inicio', 'indice_inicio'}
assert r.json['plantilla'] is None or set(r.json['plantilla']) == {'id', 'nombre'}

for ruta in ['/api/v1/guiones/999999', '/api/v1/notas/999999', '/api/v1/graphs/999999',
             '/api/v1/entrevistados/999999', '/api/v1/plantillas/999999']:
    r = c.get(ruta, headers=H)
    assert r.status_code == 404 and 'error' in r.json, (ruta, r.data[:200])

r = c.get('/api/v1/entrevistados', headers=H)
assert r.status_code == 200 and 'total' in r.json
if eid:
    r = c.get(f'/api/v1/entrevistados/{eid}', headers=H)
    assert r.status_code == 200 and isinstance(r.json['citas'], list)

r = c.get('/api/v1/bajadas?q=a', headers=H)
assert r.status_code == 200 and 'total' in r.json

r = c.get('/api/v1/plantillas', headers=H)
assert r.status_code == 200 and isinstance(r.json['items'], list)
if pid:
    r = c.get(f'/api/v1/plantillas/{pid}', headers=H)
    assert r.status_code == 200 and isinstance(r.json['capas'], list)
    if r.json['capas']:
        assert {'tipo', 'x', 'y', 'campo_dato', 'es_mosca', 'controlada_por_id'} <= set(r.json['capas'][0])
print('OK')
EOF
```

Expected: FAIL (404 en `/api/v1/guiones`).

- [ ] **Step 2: Imports**

En `app/routes/api.py`, reemplazar los imports de `..` por:

```python
from .. import db, MUSICA_OPCIONES
from ..models import Bajada, Entrevistado, Graph, Guion, Plantilla, PlantillaCapa, Texto
```

- [ ] **Step 3: Helpers y serializadores** (debajo de `_error_interno`)

```python
def _paginar(query, serializar):
    limit = request.args.get('limit', LIMIT_DEFAULT, type=int)
    offset = request.args.get('offset', 0, type=int)
    limit = max(1, min(limit, LIMIT_MAX))
    offset = max(0, offset)
    return jsonify({
        'items': [serializar(x) for x in query.limit(limit).offset(offset).all()],
        'total': query.order_by(None).count(),
        'limit': limit,
        'offset': offset,
    })


def _guion_resumen(g):
    return {'id': g.id, 'nombre': g.nombre, 'descripcion': g.descripcion,
            'cantidad_notas': len(g.textos)}


def _nota_resumen(t):
    return {'id': t.id, 'numero_de_nota': t.numero_de_nota, 'titulo': t.titulo,
            'duracion': t.duracion, 'musica': t.musica, 'activo': t.activo,
            'emitido': t.emitido, 'grabar': t.grabar, 'grabado': t.grabado,
            'cantidad_graphs': len(t.graphs)}


def _graph(g):
    return {
        'id': g.id,
        'texto_id': g.texto_id,
        'lugar': g.lugar,
        'tema': g.tema,
        'activo': g.activo,
        'mostrar_lugar': g.mostrar_lugar,
        'mostrar_tema': g.mostrar_tema,
        'plantilla': {'id': g.plantilla.id, 'nombre': g.plantilla.nombre} if g.plantilla else None,
        'bajadas': [{'id': b.id, 'texto': b.texto} for b in sorted(g.bajadas, key=lambda b: b.id)],
        'bajada_activa_id': g.bajada_activa_id,
        'entrevistados': [{'id': e.id, 'nombre': e.nombre}
                          for e in sorted(g.entrevistados, key=lambda e: e.id)],
        'citas': [{'id': c.id, 'texto': c.texto, 'entrevistado_id': c.entrevistado_id}
                  for c in sorted(g.citas, key=lambda c: c.id)],
        'cita_activa_id': g.cita_activa_id,
        'bajadas_auto': {
            'activo': g.bajadas_auto_activo,
            'loop': g.bajadas_auto_loop,
            'duracion_segundos': g.bajadas_auto_duracion_segundos,
            'epoch_inicio': g.bajadas_auto_epoch_inicio,
            'indice_inicio': g.bajadas_auto_indice_inicio,
        },
    }


def _nota(t):
    datos = _nota_resumen(t)
    datos.update({
        'contenido': t.contenido,
        'material': t.material,
        'grabando': t.grabando,
        'recording_id': t.recording_id,
        'archivo': t.archivo,
        'guion': {'id': t.guion.id, 'nombre': t.guion.nombre},
        'graphs': [_graph(g) for g in sorted(t.graphs, key=lambda g: g.id)],
    })
    return datos


def _capa(capa):
    return {col.name: getattr(capa, col.name) for col in PlantillaCapa.__table__.columns}
```

- [ ] **Step 4: Endpoints** (debajo de `opciones`)

```python
@api_bp.route('/guiones')
def guiones():
    """Guiones (filtro q por nombre, paginado)."""
    q = Guion.query.order_by(db.func.lower(Guion.nombre).desc(), Guion.id.desc())
    if request.args.get('q'):
        q = q.filter(Guion.nombre.ilike(f"%{request.args['q']}%"))
    return _paginar(q, _guion_resumen)


@api_bp.route('/guiones/<int:id>')
def guion(id):
    """Un guion con el resumen de sus notas."""
    g = db.get_or_404(Guion, id, description=f'Guion {id} no encontrado')
    datos = _guion_resumen(g)
    datos['notas'] = [_nota_resumen(t) for t in sorted(g.textos, key=lambda t: t.numero_de_nota)]
    return jsonify(datos)


@api_bp.route('/notas/<int:id>')
def nota(id):
    """Una nota completa con sus graphs, bajadas, entrevistados y citas."""
    t = db.get_or_404(Texto, id, description=f'Nota {id} no encontrada')
    return jsonify(_nota(t))


@api_bp.route('/graphs/<int:id>')
def graph(id):
    """Un graph con bajadas, entrevistados, citas y plantilla."""
    g = db.get_or_404(Graph, id, description=f'Graph {id} no encontrado')
    return jsonify(_graph(g))


@api_bp.route('/entrevistados')
def entrevistados():
    """Entrevistados (filtro q por nombre, paginado)."""
    q = Entrevistado.query.order_by(Entrevistado.id)
    if request.args.get('q'):
        q = q.filter(Entrevistado.nombre.ilike(f"%{request.args['q']}%"))
    return _paginar(q, lambda e: {'id': e.id, 'nombre': e.nombre, 'cantidad_citas': len(e.citas)})


@api_bp.route('/entrevistados/<int:id>')
def entrevistado(id):
    """Un entrevistado con sus citas."""
    e = db.get_or_404(Entrevistado, id, description=f'Entrevistado {id} no encontrado')
    return jsonify({
        'id': e.id,
        'nombre': e.nombre,
        'cantidad_citas': len(e.citas),
        'citas': [{'id': c.id, 'texto': c.texto, 'graph_id': c.graph_id}
                  for c in sorted(e.citas, key=lambda c: c.id)],
    })


@api_bp.route('/bajadas')
def bajadas():
    """Bajadas (filtro q por texto, paginado)."""
    q = Bajada.query.order_by(Bajada.id)
    if request.args.get('q'):
        q = q.filter(Bajada.texto.ilike(f"%{request.args['q']}%"))
    return _paginar(q, lambda b: {'id': b.id, 'texto': b.texto})


@api_bp.route('/plantillas')
def plantillas():
    """Plantillas gráficas."""
    return jsonify({'items': [
        {'id': p.id, 'nombre': p.nombre, 'ancho': p.ancho, 'alto': p.alto,
         'cantidad_capas': len(p.capas)}
        for p in Plantilla.query.order_by(Plantilla.id).all()
    ]})


@api_bp.route('/plantillas/<int:id>')
def plantilla(id):
    """Una plantilla con todas sus capas."""
    p = db.get_or_404(Plantilla, id, description=f'Plantilla {id} no encontrada')
    return jsonify({'id': p.id, 'nombre': p.nombre, 'ancho': p.ancho, 'alto': p.alto,
                    'capas': [_capa(c) for c in p.capas]})
```

- [ ] **Step 5: Correr la verificación del Step 1**

Expected: imprime `OK`. Correr también la verificación de Task 1: debe seguir en `OK`.

- [ ] **Step 6: Commit**

```bash
git add app/routes/api.py
git commit -m "feat(api): endpoints de guiones, notas, graphs, entrevistados, bajadas y plantillas"
```

---

### Task 3: En vivo, grabaciones, auditoría y documentación

**Files:**
- Modify: `app/routes/api.py`
- Create: `docs/api.md`
- Modify: `CLAUDE.md` (una línea en Arquitectura)

**Interfaces:**
- Consumes: `_paginar`, `_nota_resumen`, `_graph` (Task 2); `grabacion._snapshot(guion_id, incluir_contexto=True, todas=False) -> dict`; `graphs._resolver_mosca(mosca_config: dict) -> {'show', 'capa'}`; `reloj._lock`, `reloj.tiempo` (int), `reloj.cronometro_activo` (bool).

- [ ] **Step 1: Correr la verificación (debe fallar)**

```bash
cd /home/augusto/CODIGOS/app_guiones && .venv/bin/python - <<'EOF'
from datetime import datetime, timedelta
from app import create_app, db
from app.models import Guion, AuditLog
app = create_app()
app.config['API_TOKEN'] = 'prueba'
c = app.test_client()
H = {'Authorization': 'Bearer prueba'}
with app.app_context():
    gid = Guion.query.first().id
    ultimo = AuditLog.query.order_by(AuditLog.timestamp.desc()).first()
    dia = ultimo.timestamp.date().isoformat() if ultimo else None

r = c.get('/api/v1/en-vivo', headers=H)
assert r.status_code == 200, r.data[:300]
assert set(r.json) == {'nota_activa', 'graph_activo', 'cronometro', 'display'}
assert set(r.json['cronometro']) == {'segundos', 'activo'}
if r.json['nota_activa']:
    assert set(r.json['nota_activa']['guion']) == {'id', 'nombre'}
if r.json['display']:
    assert set(r.json['display']['mosca']) == {'show', 'capa'}

r = c.get(f'/api/v1/grabaciones?guion_id={gid}', headers=H)
assert r.status_code == 200 and 'ok' in r.json and 'notas' in r.json, r.data[:300]
r = c.get('/api/v1/grabaciones', headers=H)
assert r.status_code == 200 and r.json['notas'] == []
r = c.get('/api/v1/grabaciones?guion_id=999999', headers=H)
assert r.status_code == 404

r = c.get('/api/v1/auditoria', headers=H)
assert r.status_code == 200 and 'total' in r.json
if r.json['items']:
    assert {'id', 'timestamp', 'nivel', 'ip', 'user_agent', 'accion', 'tipo_entidad',
            'id_entidad', 'nombre_entidad', 'detalle'} == set(r.json['items'][0])
    ts = [x['timestamp'] for x in r.json['items']]
    assert ts == sorted(ts, reverse=True)
if dia:
    # hasta con solo fecha incluye todo el día
    r = c.get(f'/api/v1/auditoria?desde={dia}&hasta={dia}', headers=H)
    assert r.status_code == 200 and r.json['total'] >= 1, r.json
r = c.get('/api/v1/auditoria?desde=ayer', headers=H)
assert r.status_code == 400 and 'error' in r.json
r = c.get('/api/v1/auditoria?nivel=NO_EXISTE', headers=H)
assert r.json['total'] == 0
r = c.get('/api/v1/auditoria?hasta=2000-01-01T00:00:00', headers=H)
assert r.json['total'] == 0
print('OK')
EOF
```

Expected: FAIL (404 en `/api/v1/en-vivo`).

- [ ] **Step 2: Imports**

Reemplazar el bloque de imports de `app/routes/api.py` por:

```python
import hmac
import json
from datetime import datetime, timedelta

from flask import Blueprint, abort, current_app, jsonify, request
from werkzeug.exceptions import HTTPException

from .. import db, MUSICA_OPCIONES
from ..models import AuditLog, Bajada, Entrevistado, Graph, Guion, Plantilla, PlantillaCapa, Texto
from . import reloj
from .grabacion import _snapshot
from .graphs import _resolver_mosca
```

- [ ] **Step 3: Endpoints** (al final del archivo)

```python
def _leer_display():
    # Misma ruta relativa que usa graphs.get_display_config, sin su caché.
    try:
        with open('display_config.json') as f:
            config = json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}
    config['mosca'] = _resolver_mosca(config.get('mosca', {}))
    return config


@api_bp.route('/en-vivo')
def en_vivo():
    """Nota y graph activos, cronómetro y config de widgets del aire."""
    nota_activa = Texto.query.filter_by(activo=True).first()
    graph_activo = Graph.query.filter_by(activo=True).first()
    nota = None
    if nota_activa:
        nota = _nota_resumen(nota_activa)
        nota['guion'] = {'id': nota_activa.guion.id, 'nombre': nota_activa.guion.nombre}
    with reloj._lock:
        cronometro = {'segundos': reloj.tiempo, 'activo': reloj.cronometro_activo}
    return jsonify({
        'nota_activa': nota,
        'graph_activo': _graph(graph_activo) if graph_activo else None,
        'cronometro': cronometro,
        'display': _leer_display(),
    })


@api_bp.route('/grabaciones')
def grabaciones():
    """Estado de la Capturadora y de las notas de un guion (guion_id opcional)."""
    guion_id = request.args.get('guion_id', type=int)
    if guion_id:
        db.get_or_404(Guion, guion_id, description=f'Guion {guion_id} no encontrado')
    return jsonify(_snapshot(guion_id, todas=True))


def _fecha(nombre):
    valor = request.args.get(nombre)
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor)
    except ValueError:
        abort(400, f"'{nombre}' no es una fecha ISO válida: {valor}")


@api_bp.route('/auditoria')
def auditoria():
    """Log de auditoría (filtros desde, hasta, nivel, entidad, ip, q; paginado)."""
    q = AuditLog.query.order_by(AuditLog.timestamp.desc())
    desde = _fecha('desde')
    hasta = _fecha('hasta')
    if desde:
        q = q.filter(AuditLog.timestamp >= desde)
    if hasta:
        # Solo fecha (YYYY-MM-DD): incluye el día entero.
        if len(request.args['hasta']) == 10:
            q = q.filter(AuditLog.timestamp < hasta + timedelta(days=1))
        else:
            q = q.filter(AuditLog.timestamp <= hasta)
    if request.args.get('nivel'):
        q = q.filter_by(nivel=request.args['nivel'])
    if request.args.get('entidad'):
        q = q.filter_by(tipo_entidad=request.args['entidad'])
    if request.args.get('ip'):
        q = q.filter(AuditLog.ip.like(f"%{request.args['ip']}%"))
    if request.args.get('q'):
        patron = f"%{request.args['q']}%"
        q = q.filter(db.or_(AuditLog.accion.ilike(patron),
                            AuditLog.nombre_entidad.ilike(patron),
                            AuditLog.detalle.ilike(patron)))
    return _paginar(q, lambda a: {
        'id': a.id, 'timestamp': a.timestamp.isoformat(), 'nivel': a.nivel, 'ip': a.ip,
        'user_agent': a.user_agent, 'accion': a.accion, 'tipo_entidad': a.tipo_entidad,
        'id_entidad': a.id_entidad, 'nombre_entidad': a.nombre_entidad, 'detalle': a.detalle,
    })
```

- [ ] **Step 4: Correr la verificación del Step 1, y las de Task 1 y Task 2**

Expected: las tres imprimen `OK`.

- [ ] **Step 5: Escribir `docs/api.md`**

```markdown
# API de lectura `/api/v1`

Solo lectura, JSON, para scripts propios. Código en `app/routes/api.py`.

## Activarla

Definir `API_TOKEN` (en `config.py` o por variable de entorno; en el server de
aire, en el `environment=` del programa en Supervisor). Vacío = API
desactivada (503). Generar uno con:

    python -c "import secrets; print(secrets.token_urlsafe(32))"

Cada pedido lleva el header `Authorization: Bearer <token>`; si falta o no
coincide, 401.

## Formato

- Errores: `{"error": "mensaje"}` con 400, 401, 404, 405, 500 o 503.
- Listados paginados: `?limit=` (100 por defecto, máximo 1000) y `?offset=`.
  Responden `{"items": [...], "total": N, "limit": L, "offset": O}`.
- Fechas en ISO 8601.

## Endpoints

    export T=<token>; export API=http://localhost:5000/api/v1
    alias api='curl -s -H "Authorization: Bearer $T"'

| Endpoint | Ejemplo |
|---|---|
| Índice de rutas | `api $API/` |
| Guiones (`q`, paginado) | `api "$API/guiones?q=noticiero&limit=10"` |
| Guion con sus notas | `api $API/guiones/3` |
| Nota completa (graphs, bajadas, entrevistados, citas) | `api $API/notas/42` |
| Graph | `api $API/graphs/17` |
| Entrevistados (`q`, paginado) | `api "$API/entrevistados?q=perez"` |
| Entrevistado con sus citas | `api $API/entrevistados/5` |
| Bajadas (`q`, paginado) | `api "$API/bajadas?q=ruta"` |
| Plantillas | `api $API/plantillas` |
| Plantilla con capas | `api $API/plantillas/2` |
| Estado del aire: nota y graph activos, cronómetro, widgets | `api $API/en-vivo` |
| Grabaciones (Capturadora) | `api "$API/grabaciones?guion_id=3"` |
| Auditoría (`desde`, `hasta`, `nivel`, `entidad`, `ip`, `q`, paginado) | `api "$API/auditoria?desde=2026-09-01&hasta=2026-09-29&nivel=DANGER"` |
| Opciones fijas (música) | `api $API/opciones` |

Notas:
- `hasta` con solo fecha (`2026-09-29`) incluye todo ese día.
- `/grabaciones` con la Capturadora caída responde 200 con `"ok": false` y el
  error; sin `guion_id` trae solo el equipo, las tareas y las grabaciones
  ajenas al guion (`otras`).
- `/en-vivo` → `display` es el contenido de `display_config.json` con la mosca
  resuelta a su capa; `{}` si el archivo no existe.
```

- [ ] **Step 6: Línea en `CLAUDE.md`**

En la sección `## Arquitectura`, en la línea `Blueprints: ...`, agregar `api` (prefix `/api/v1`) a la lista, y después del párrafo de `AuditLog` agregar:

```markdown
- API de lectura para scripts (`app/routes/api.py`, prefix `/api/v1`): token Bearer en `API_TOKEN`, solo GET. Detalle en `docs/api.md`. No confundir con las rutas `/api/*` de los otros blueprints, que usa el frontend sin token.
```

- [ ] **Step 7: Prueba manual con curl contra la app levantada**

```bash
cd /home/augusto/CODIGOS/app_guiones
API_TOKEN=prueba .venv/bin/python run.py &   # en otra terminal / background
curl -s -o /dev/null -w '%{http_code}\n' localhost:5000/api/v1/guiones                          # 401
curl -s -H 'Authorization: Bearer prueba' localhost:5000/api/v1/ | head -c 400                  # índice
curl -s -H 'Authorization: Bearer prueba' localhost:5000/api/v1/en-vivo | head -c 400
curl -s -H 'Authorization: Bearer prueba' 'localhost:5000/api/v1/auditoria?limit=2'
```

Expected: `401`, luego JSON válido en los tres. Detener el server al terminar.

- [ ] **Step 8: Commit**

```bash
git add app/routes/api.py docs/api.md CLAUDE.md
git commit -m "feat(api): en vivo, grabaciones y auditoría; docs de la API"
```
