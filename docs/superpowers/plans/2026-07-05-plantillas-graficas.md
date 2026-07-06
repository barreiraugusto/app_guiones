# Sistema de Plantillas de Gráfica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el zócalo fijo de `pantalla.html` por un sistema de plantillas de gráfica reutilizables (imagen/video con alpha/texto vinculado a datos del graph), con un editor visual de capas y persistencia en base de datos.

**Architecture:** Dos tablas nuevas (`Plantilla`, `PlantillaCapa`) más una FK `plantilla_id` en `Graph`. Un blueprint `plantillas_bp` expone CRUD + subida de archivos. Un editor en `/plantillas` (drag & drop simple, sin librerías nuevas) arma capas. `pantalla.html`/`pantalla.js` dejan de tener HTML fijo y renderizan dinámicamente las capas de la plantilla del graph activo, recibidas vía el SSE existente (`/stream_display_config`).

**Tech Stack:** Flask 3.1, Flask-SQLAlchemy 3.1 / SQLAlchemy 2.0, Flask-Migrate (Alembic), Bootstrap 4 + jQuery + SweetAlert2 (ya presentes), JavaScript plano (sin frameworks nuevos).

## Global Constraints

- El proyecto no tiene suite de tests automatizados (confirmado en el spec). La verificación de cada tarea es **manual**: `flask run` / `python run.py` + `curl` + navegador. No escribir pytest.
- Seguir los patrones ya existentes en `app/routes/graphs.py` (manejo de errores try/except + rollback, `registrar(...)` de auditoría en cada mutación, `jsonify({"mensaje": ...})`).
- No usar `git add -A`; agregar archivos por nombre.
- Base de datos: PostgreSQL, conexión definida en `config.py`. Los comandos de migración requieren `export FLASK_APP=run.py` en la sesión de shell (no está seteado en el proyecto).
- Todas las rutas de archivos subidos son relativas a `app/static/` (ej. `archivo: "uploads/plantillas/xxx.webm"` se sirve en `/static/uploads/plantillas/xxx.webm` sin ruta nueva, Flask ya sirve todo `static/`).
- Spec de referencia: `docs/superpowers/specs/2026-07-05-plantillas-graficas-design.md`.

---

### Task 1: Modelos de datos y migración (Plantilla, PlantillaCapa, Graph.plantilla_id)

**Files:**
- Modify: `app/models.py`
- Create: `migrations/versions/a1f3c9d02b7e_agregar_plantillas_graficas.py`

**Interfaces:**
- Produces: clases `Plantilla` (`id`, `nombre`, `ancho`, `alto`, `capas` relationship) y `PlantillaCapa` (`id`, `plantilla_id`, `orden`, `tipo`, `x`, `y`, `ancho`, `alto`, `archivo`, `loop`, `campo_dato`, `texto_fijo`, `fuente`, `tamano_fuente`, `color`, `alineacion`, `animacion_entrada`, `animacion_salida`, `duracion_transicion_ms`) en `app/models.py`. `Graph.plantilla_id` (FK nullable) y `Graph.plantilla` (relationship). Tabla `plantilla` sembrada con una fila `"Zócalo clásico"` cuyo `id` es usado por defecto en `Graph.plantilla_id` de todos los graphs existentes.
- Consumes: nada (primera tarea).

- [ ] **Step 1: Agregar los modelos `Plantilla` y `PlantillaCapa` a `app/models.py`**

Agregar al final de `app/models.py` (después de la clase `Graph`, antes de `AuditLog`):

```python
class Plantilla(db.Model):
    __tablename__ = 'plantilla'
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False, unique=True)
    ancho = db.Column(db.Integer, nullable=False, default=1920)
    alto = db.Column(db.Integer, nullable=False, default=1080)

    capas = db.relationship(
        'PlantillaCapa',
        backref='plantilla',
        cascade="all, delete-orphan",
        order_by='PlantillaCapa.orden',
        lazy=True
    )


class PlantillaCapa(db.Model):
    __tablename__ = 'plantilla_capa'
    id = db.Column(db.Integer, primary_key=True)
    plantilla_id = db.Column(db.Integer, db.ForeignKey('plantilla.id', ondelete="CASCADE"), nullable=False)
    orden = db.Column(db.Integer, nullable=False, default=0)
    tipo = db.Column(db.String(10), nullable=False)  # 'imagen' | 'video' | 'texto'

    x = db.Column(db.Integer, nullable=False, default=0)
    y = db.Column(db.Integer, nullable=False, default=0)
    ancho = db.Column(db.Integer, nullable=False, default=200)
    alto = db.Column(db.Integer, nullable=False, default=100)

    archivo = db.Column(db.String(500), nullable=True)
    loop = db.Column(db.Boolean, nullable=False, default=True)

    campo_dato = db.Column(db.String(20), nullable=True)  # lugar|tema|entrevistado|bajada_1|bajada_2|None
    texto_fijo = db.Column(db.String(255), nullable=True)
    fuente = db.Column(db.String(100), nullable=False, default='Arial')
    tamano_fuente = db.Column(db.Integer, nullable=False, default=24)
    color = db.Column(db.String(20), nullable=False, default='#ffffff')
    alineacion = db.Column(db.String(10), nullable=False, default='left')

    animacion_entrada = db.Column(db.String(10), nullable=False, default='fade')
    animacion_salida = db.Column(db.String(10), nullable=False, default='fade')
    duracion_transicion_ms = db.Column(db.Integer, nullable=False, default=400)
```

- [ ] **Step 2: Agregar `plantilla_id` a la clase `Graph`**

En `app/models.py`, dentro de la clase `Graph` (después de la línea `activo = db.Column(...)`), agregar:

```python
    plantilla_id = db.Column(db.Integer, db.ForeignKey('plantilla.id', ondelete="SET NULL"), nullable=True)
    plantilla = db.relationship('Plantilla')
```

- [ ] **Step 3: Crear la migración de esquema + datos**

Crear `migrations/versions/a1f3c9d02b7e_agregar_plantillas_graficas.py`:

```python
"""agregar plantillas de gráficas

Revision ID: a1f3c9d02b7e
Revises: 7e6c4d0ed190
Create Date: 2026-07-05 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'a1f3c9d02b7e'
down_revision = '7e6c4d0ed190'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('plantilla',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=255), nullable=False),
        sa.Column('ancho', sa.Integer(), nullable=False),
        sa.Column('alto', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('nombre')
    )
    op.create_table('plantilla_capa',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('plantilla_id', sa.Integer(), nullable=False),
        sa.Column('orden', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=10), nullable=False),
        sa.Column('x', sa.Integer(), nullable=False),
        sa.Column('y', sa.Integer(), nullable=False),
        sa.Column('ancho', sa.Integer(), nullable=False),
        sa.Column('alto', sa.Integer(), nullable=False),
        sa.Column('archivo', sa.String(length=500), nullable=True),
        sa.Column('loop', sa.Boolean(), nullable=False),
        sa.Column('campo_dato', sa.String(length=20), nullable=True),
        sa.Column('texto_fijo', sa.String(length=255), nullable=True),
        sa.Column('fuente', sa.String(length=100), nullable=False),
        sa.Column('tamano_fuente', sa.Integer(), nullable=False),
        sa.Column('color', sa.String(length=20), nullable=False),
        sa.Column('alineacion', sa.String(length=10), nullable=False),
        sa.Column('animacion_entrada', sa.String(length=10), nullable=False),
        sa.Column('animacion_salida', sa.String(length=10), nullable=False),
        sa.Column('duracion_transicion_ms', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['plantilla_id'], ['plantilla.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.add_column(sa.Column('plantilla_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_graph_plantilla', 'plantilla', ['plantilla_id'], ['id'], ondelete='SET NULL'
        )

    plantilla_table = sa.table(
        'plantilla',
        sa.column('id', sa.Integer),
        sa.column('nombre', sa.String),
        sa.column('ancho', sa.Integer),
        sa.column('alto', sa.Integer),
    )
    capa_table = sa.table(
        'plantilla_capa',
        sa.column('id', sa.Integer),
        sa.column('plantilla_id', sa.Integer),
        sa.column('orden', sa.Integer),
        sa.column('tipo', sa.String),
        sa.column('x', sa.Integer),
        sa.column('y', sa.Integer),
        sa.column('ancho', sa.Integer),
        sa.column('alto', sa.Integer),
        sa.column('archivo', sa.String),
        sa.column('loop', sa.Boolean),
        sa.column('campo_dato', sa.String),
        sa.column('texto_fijo', sa.String),
        sa.column('fuente', sa.String),
        sa.column('tamano_fuente', sa.Integer),
        sa.column('color', sa.String),
        sa.column('alineacion', sa.String),
        sa.column('animacion_entrada', sa.String),
        sa.column('animacion_salida', sa.String),
        sa.column('duracion_transicion_ms', sa.Integer),
    )
    graph_table = sa.table(
        'graph',
        sa.column('id', sa.Integer),
        sa.column('plantilla_id', sa.Integer),
    )

    conn = op.get_bind()
    resultado = conn.execute(
        plantilla_table.insert().values(nombre='Zócalo clásico', ancho=1920, alto=1080)
    )
    plantilla_id = resultado.inserted_primary_key[0]

    base_capa = dict(
        plantilla_id=plantilla_id, archivo=None, loop=True, campo_dato=None, texto_fijo=None,
        fuente='Arial', tamano_fuente=24, color='#ffffff', alineacion='left',
        animacion_entrada='fade', animacion_salida='fade', duracion_transicion_ms=400,
    )

    conn.execute(capa_table.insert(), [
        {**base_capa, 'orden': 1, 'tipo': 'imagen', 'x': 50, 'y': 850, 'ancho': 150, 'alto': 150,
         'archivo': 'img/grafica/mosca.gif'},
        {**base_capa, 'orden': 2, 'tipo': 'imagen', 'x': 200, 'y': 850, 'ancho': 1737, 'alto': 152,
         'archivo': 'img/grafica/zocalo_sin_bordes.png'},
        {**base_capa, 'orden': 3, 'tipo': 'texto', 'x': 230, 'y': 860, 'ancho': 1600, 'alto': 50,
         'campo_dato': 'tema', 'color': '#00ccff', 'tamano_fuente': 30},
        {**base_capa, 'orden': 4, 'tipo': 'texto', 'x': 230, 'y': 920, 'ancho': 1600, 'alto': 70,
         'campo_dato': 'bajada_1', 'color': '#ffffff', 'tamano_fuente': 36},
        {**base_capa, 'orden': 5, 'tipo': 'imagen', 'x': 1623, 'y': 882, 'ancho': 291, 'alto': 45,
         'archivo': 'img/grafica/subida_localidad.png'},
        {**base_capa, 'orden': 6, 'tipo': 'texto', 'x': 1623, 'y': 882, 'ancho': 291, 'alto': 45,
         'campo_dato': 'lugar', 'color': '#003685', 'tamano_fuente': 24, 'alineacion': 'center'},
        {**base_capa, 'orden': 7, 'tipo': 'imagen', 'x': 1021, 'y': 929, 'ancho': 893, 'alto': 45,
         'archivo': 'img/grafica/subida_nombre.png'},
        {**base_capa, 'orden': 8, 'tipo': 'texto', 'x': 1021, 'y': 929, 'ancho': 893, 'alto': 45,
         'campo_dato': 'entrevistado', 'color': '#02b2ef', 'tamano_fuente': 24},
    ])

    conn.execute(graph_table.update().values(plantilla_id=plantilla_id))


def downgrade():
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.drop_constraint('fk_graph_plantilla', type_='foreignkey')
        batch_op.drop_column('plantilla_id')
    op.drop_table('plantilla_capa')
    op.drop_table('plantilla')
```

- [ ] **Step 4: Aplicar la migración y verificar**

```bash
export FLASK_APP=run.py
flask db upgrade
```

Expected: sin errores, termina mostrando `a1f3c9d02b7e`. Verificar con:

```bash
psql -U abarreira -d guiones -h localhost -c "SELECT id, nombre FROM plantilla;"
psql -U abarreira -d guiones -h localhost -c "SELECT count(*) FROM plantilla_capa;"
psql -U abarreira -d guiones -h localhost -c "SELECT count(*) FROM graph WHERE plantilla_id IS NULL;"
```

Expected: una fila `Zócalo clásico`, 8 filas en `plantilla_capa`, 0 graphs con `plantilla_id` nulo (si ya había graphs cargados).

- [ ] **Step 5: Commit**

```bash
git add app/models.py migrations/versions/a1f3c9d02b7e_agregar_plantillas_graficas.py
git commit -m "feat: agregar modelos Plantilla/PlantillaCapa y migrar zócalo actual como plantilla default"
```

---

### Task 2: Configuración de subida de archivos y blueprint `plantillas_bp`

**Files:**
- Modify: `config.py`
- Create: `app/routes/plantillas.py`
- Modify: `app/__init__.py`

**Interfaces:**
- Consumes: modelos `Plantilla`, `PlantillaCapa` (Task 1), `db`, `registrar` (`app/audit.py`).
- Produces: blueprint `plantillas_bp` registrado con prefijo raíz; endpoint `POST /plantillas/upload` que devuelve `{"ruta": "uploads/plantillas/<archivo>"}`. Usado por Task 5 (editor) y leído por Task 8 (pantalla.js).

- [ ] **Step 1: Agregar el límite de subida a `config.py`**

En `config.py`, dentro de `class Config`, agregar después de `SQLALCHEMY_TRACK_MODIFICATIONS`:

```python
    MAX_CONTENT_LENGTH = 50 * 1024 * 1024  # 50MB, límite de subida de plantillas
```

- [ ] **Step 2: Crear `app/routes/plantillas.py` con el endpoint de subida**

```python
import os
import uuid

from flask import Blueprint, jsonify, request, current_app
from werkzeug.utils import secure_filename

plantillas_bp = Blueprint('plantillas', __name__)

EXTENSIONES_PERMITIDAS = {'.webm', '.png', '.gif'}


@plantillas_bp.route('/plantillas/upload', methods=['POST'])
def subir_archivo_plantilla():
    if 'archivo' not in request.files:
        return jsonify({"mensaje": "No se envió ningún archivo"}), 400

    archivo = request.files['archivo']
    if archivo.filename == '':
        return jsonify({"mensaje": "Nombre de archivo vacío"}), 400

    extension = os.path.splitext(archivo.filename)[1].lower()
    if extension not in EXTENSIONES_PERMITIDAS:
        return jsonify({
            "mensaje": f"Extensión no permitida: {extension}. Use .webm, .png o .gif"
        }), 400

    nombre_seguro = secure_filename(archivo.filename)
    nombre_final = f"{uuid.uuid4().hex}_{nombre_seguro}"

    carpeta_destino = os.path.join(current_app.root_path, 'static', 'uploads', 'plantillas')
    os.makedirs(carpeta_destino, exist_ok=True)

    archivo.save(os.path.join(carpeta_destino, nombre_final))

    return jsonify({"ruta": f"uploads/plantillas/{nombre_final}"}), 201
```

- [ ] **Step 3: Registrar el blueprint en `app/__init__.py`**

En `app/__init__.py`, agregar el import junto a los demás (después de `from .routes.graphs import graphs_bp`):

```python
    from .routes.plantillas import plantillas_bp
```

Y el registro (después de `app.register_blueprint(graphs_bp)`):

```python
    app.register_blueprint(plantillas_bp)
```

- [ ] **Step 4: Verificar manualmente el endpoint de subida**

```bash
export FLASK_APP=run.py
python run.py &
sleep 2
printf 'contenido de prueba' > /tmp/prueba.png
curl -s -F "archivo=@/tmp/prueba.png" http://localhost:5000/plantillas/upload
```

Expected: JSON `{"ruta": "uploads/plantillas/<uuid>_prueba.png"}` con código 201. Verificar que el archivo existe:

```bash
ls app/static/uploads/plantillas/
```

Expected: aparece el archivo subido. Probar también el rechazo de extensión inválida:

```bash
printf 'x' > /tmp/prueba.mp4
curl -s -o /dev/null -w "%{http_code}\n" -F "archivo=@/tmp/prueba.mp4" http://localhost:5000/plantillas/upload
```

Expected: `400`. Detener el servidor: `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add config.py app/routes/plantillas.py app/__init__.py
git commit -m "feat: endpoint de subida de archivos para plantillas de gráfica"
```

---

### Task 3: CRUD API de plantillas

**Files:**
- Modify: `app/routes/plantillas.py`

**Interfaces:**
- Consumes: `Plantilla`, `PlantillaCapa`, `Graph` (modelos), `db`, `registrar`.
- Produces: `GET /api/plantillas` → `[{id, nombre}]`. `GET /api/plantillas/<id>` → objeto completo con `capas`. `POST /api/plantillas` y `PUT /api/plantillas/<id>` (payload `{nombre, ancho, alto, capas: [...]}`) → `{"mensaje", "id"?}`. `DELETE /api/plantillas/<id>` → 409 si hay graphs asociados. Consumido por Task 5 (editor) y Task 6 (selección en graph).

- [ ] **Step 1: Agregar imports y helpers a `app/routes/plantillas.py`**

Reemplazar todo el contenido del archivo desde el inicio hasta (sin incluir) la línea `@plantillas_bp.route('/plantillas/upload', methods=['POST'])` por lo siguiente (esto conserva la función `subir_archivo_plantilla` de la Task 2 intacta al final del archivo, solo se reemplazan los imports y se agregan los helpers):

```python
import os
import uuid

from flask import Blueprint, jsonify, request, render_template, current_app
from werkzeug.utils import secure_filename

from .. import db
from ..models import Plantilla, PlantillaCapa, Graph
from ..audit import registrar

plantillas_bp = Blueprint('plantillas', __name__)

EXTENSIONES_PERMITIDAS = {'.webm', '.png', '.gif'}
CAMPOS_DATO_VALIDOS = {'lugar', 'tema', 'entrevistado', 'bajada_1', 'bajada_2', None}
TIPOS_CAPA_VALIDOS = {'imagen', 'video', 'texto'}


def _serializar_plantilla(plantilla):
    return {
        "id": plantilla.id,
        "nombre": plantilla.nombre,
        "ancho": plantilla.ancho,
        "alto": plantilla.alto,
        "capas": [
            {
                "id": capa.id,
                "orden": capa.orden,
                "tipo": capa.tipo,
                "x": capa.x,
                "y": capa.y,
                "ancho": capa.ancho,
                "alto": capa.alto,
                "archivo": capa.archivo,
                "loop": capa.loop,
                "campo_dato": capa.campo_dato,
                "texto_fijo": capa.texto_fijo,
                "fuente": capa.fuente,
                "tamano_fuente": capa.tamano_fuente,
                "color": capa.color,
                "alineacion": capa.alineacion,
                "animacion_entrada": capa.animacion_entrada,
                "animacion_salida": capa.animacion_salida,
                "duracion_transicion_ms": capa.duracion_transicion_ms,
            }
            for capa in sorted(plantilla.capas, key=lambda c: c.orden)
        ]
    }


def _validar_capas(capas_data):
    for capa in capas_data:
        if capa.get('tipo') not in TIPOS_CAPA_VALIDOS:
            return f"Tipo de capa inválido: {capa.get('tipo')}"
        if capa.get('campo_dato') not in CAMPOS_DATO_VALIDOS:
            return f"campo_dato inválido: {capa.get('campo_dato')}"
    return None


def _crear_capas(plantilla, capas_data):
    for i, capa_data in enumerate(capas_data):
        plantilla.capas.append(PlantillaCapa(
            orden=capa_data.get('orden', i),
            tipo=capa_data['tipo'],
            x=capa_data.get('x', 0),
            y=capa_data.get('y', 0),
            ancho=capa_data.get('ancho', 200),
            alto=capa_data.get('alto', 100),
            archivo=capa_data.get('archivo'),
            loop=capa_data.get('loop', True),
            campo_dato=capa_data.get('campo_dato'),
            texto_fijo=capa_data.get('texto_fijo'),
            fuente=capa_data.get('fuente', 'Arial'),
            tamano_fuente=capa_data.get('tamano_fuente', 24),
            color=capa_data.get('color', '#ffffff'),
            alineacion=capa_data.get('alineacion', 'left'),
            animacion_entrada=capa_data.get('animacion_entrada', 'fade'),
            animacion_salida=capa_data.get('animacion_salida', 'fade'),
            duracion_transicion_ms=capa_data.get('duracion_transicion_ms', 400),
        ))
```

- [ ] **Step 2: Agregar la página del editor y el CRUD al final de `app/routes/plantillas.py`**

```python
@plantillas_bp.route('/plantillas')
def pagina_plantillas():
    return render_template('plantillas.html')


@plantillas_bp.route('/api/plantillas', methods=['GET'])
def listar_plantillas():
    plantillas = Plantilla.query.order_by(Plantilla.nombre).all()
    return jsonify([{"id": p.id, "nombre": p.nombre} for p in plantillas])


@plantillas_bp.route('/api/plantillas/<int:id>', methods=['GET'])
def obtener_plantilla(id):
    plantilla = Plantilla.query.get(id)
    if not plantilla:
        return jsonify({"mensaje": "Plantilla no encontrada"}), 404
    return jsonify(_serializar_plantilla(plantilla))


@plantillas_bp.route('/api/plantillas', methods=['POST'])
def crear_plantilla():
    data = request.json
    if not data or not data.get('nombre'):
        return jsonify({"mensaje": "Se requiere un nombre"}), 400

    error = _validar_capas(data.get('capas', []))
    if error:
        return jsonify({"mensaje": error}), 400

    try:
        plantilla = Plantilla(
            nombre=data['nombre'],
            ancho=data.get('ancho', 1920),
            alto=data.get('alto', 1080),
        )
        _crear_capas(plantilla, data.get('capas', []))
        db.session.add(plantilla)
        db.session.commit()

        registrar('INFO', f'Creó plantilla: {plantilla.nombre}', 'plantilla', plantilla.id, plantilla.nombre)

        return jsonify({"mensaje": "Plantilla creada", "id": plantilla.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al crear la plantilla: {str(e)}"}), 500


@plantillas_bp.route('/api/plantillas/<int:id>', methods=['PUT'])
def actualizar_plantilla(id):
    plantilla = Plantilla.query.get(id)
    if not plantilla:
        return jsonify({"mensaje": "Plantilla no encontrada"}), 404

    data = request.json
    if not data or not data.get('nombre'):
        return jsonify({"mensaje": "Se requiere un nombre"}), 400

    error = _validar_capas(data.get('capas', []))
    if error:
        return jsonify({"mensaje": error}), 400

    try:
        plantilla.nombre = data['nombre']
        plantilla.ancho = data.get('ancho', plantilla.ancho)
        plantilla.alto = data.get('alto', plantilla.alto)
        plantilla.capas = []
        _crear_capas(plantilla, data.get('capas', []))
        db.session.commit()

        registrar('WARNING', f'Editó plantilla: {plantilla.nombre}', 'plantilla', id, plantilla.nombre)

        return jsonify({"mensaje": "Plantilla actualizada"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al actualizar la plantilla: {str(e)}"}), 500


@plantillas_bp.route('/api/plantillas/<int:id>', methods=['DELETE'])
def eliminar_plantilla(id):
    plantilla = Plantilla.query.get(id)
    if not plantilla:
        return jsonify({"mensaje": "Plantilla no encontrada"}), 404

    graphs_asociados = Graph.query.filter_by(plantilla_id=id).count()
    if graphs_asociados > 0:
        return jsonify({
            "mensaje": f"No se puede eliminar: {graphs_asociados} graph(s) usan esta plantilla"
        }), 409

    nombre = plantilla.nombre
    try:
        db.session.delete(plantilla)
        db.session.commit()

        registrar('DANGER', f'Eliminó plantilla: {nombre}', 'plantilla', id, nombre)

        return jsonify({"mensaje": "Plantilla eliminada"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al eliminar la plantilla: {str(e)}"}), 500


```

El endpoint `/plantillas/upload` ya fue agregado en la Task 2 y no se toca en esta tarea — solo se agregan las rutas de arriba (`pagina_plantillas` y el CRUD).

- [ ] **Step 3: Verificar manualmente el CRUD**

```bash
export FLASK_APP=run.py
python run.py &
sleep 2

# Listar (debe incluir "Zócalo clásico")
curl -s http://localhost:5000/api/plantillas

# Crear una plantilla de prueba
curl -s -X POST http://localhost:5000/api/plantillas \
  -H "Content-Type: application/json" \
  -d '{"nombre": "Prueba Plan", "ancho": 1920, "alto": 1080, "capas": [
        {"tipo": "texto", "x": 10, "y": 10, "ancho": 300, "alto": 50, "campo_dato": "lugar"}
      ]}'
```

Expected: primer `curl` devuelve un array con al menos `{"id": 1, "nombre": "Zócalo clásico"}`. Segundo `curl` devuelve `{"mensaje": "Plantilla creada", "id": <n>}` con 201.

```bash
curl -s http://localhost:5000/api/plantillas/<n>
```

Expected: JSON con `nombre: "Prueba Plan"` y `capas` con 1 elemento `tipo: "texto"`, `campo_dato: "lugar"`.

```bash
curl -s -X DELETE http://localhost:5000/api/plantillas/<n>
```

Expected: `{"mensaje": "Plantilla eliminada"}`. Intentar eliminar la plantilla `Zócalo clásico` (que sí tiene graphs asociados si hay datos cargados):

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:5000/api/plantillas/1
```

Expected: `409` si existe al menos un graph. Detener servidor: `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add app/routes/plantillas.py
git commit -m "feat: CRUD de plantillas de gráfica con auditoría"
```

---

### Task 4: Página de listado y shell del editor de plantillas

**Files:**
- Create: `app/templates/plantillas.html`
- Create: `app/static/js/plantillas.js`
- Modify: `app/templates/index.html`

**Interfaces:**
- Consumes: `GET /api/plantillas` (Task 3).
- Produces: página `/plantillas` con listado de tarjetas + shell vacío del editor (`#editor-plantilla` oculto). Funciones globales `cargarListadoPlantillas()`, `nuevaPlantilla()`, `abrirPlantilla(id)`, `mostrarEditor()`, `cerrarEditor()` que la Task 5 completa.

- [ ] **Step 1: Crear `app/templates/plantillas.html`**

```html
{% extends "base.html" %}
{% block extratitle %} - Plantillas de Gráfica{% endblock %}

{% block extra_style %}
<style>
    #lista-plantillas .plantilla-card { cursor: pointer; }
    #editor-plantilla { display: none; }

    #lienzo-wrapper {
        background: repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 20px 20px;
        position: relative;
        overflow: hidden;
        border: 1px solid #999;
        width: 100%;
        max-width: 960px;
        aspect-ratio: 16 / 9;
    }

    #lienzo {
        position: relative;
        width: 1920px;
        height: 1080px;
        transform: scale(0.5);
        transform-origin: top left;
    }

    .capa-editor {
        position: absolute;
        box-sizing: border-box;
        border: 1px dashed rgba(0, 0, 0, 0.4);
        cursor: move;
        overflow: hidden;
    }

    .capa-editor.seleccionada { border: 2px solid #0d6efd; }

    .capa-editor img, .capa-editor video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
    }

    .capa-editor .capa-texto-preview {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        pointer-events: none;
        white-space: nowrap;
    }

    .resize-handle {
        position: absolute;
        width: 14px;
        height: 14px;
        background: #0d6efd;
        right: -7px;
        bottom: -7px;
        cursor: se-resize;
    }
</style>
{% endblock %}

{% block body %}
<div class="container-fluid mt-4">
    <h2>Plantillas de Gráfica</h2>

    <div id="lista-plantillas" class="row mb-4">
        <div class="col-md-3 mb-3">
            <div class="card plantilla-card h-100 border-primary" onclick="nuevaPlantilla()">
                <div class="card-body text-center d-flex align-items-center justify-content-center">
                    <div>
                        <i class="fas fa-plus fa-2x"></i>
                        <p class="mt-2 mb-0">Nueva plantilla</p>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div id="editor-plantilla">
        <div class="d-flex justify-content-between align-items-center mb-2 flex-wrap">
            <input type="text" id="plantilla-nombre" class="form-control w-auto mb-2"
                   placeholder="Nombre de la plantilla" style="min-width:300px;">
            <div class="mb-2">
                <button class="btn btn-outline-secondary" onclick="cerrarEditor()">Volver</button>
                <button class="btn btn-outline-danger" id="btn-eliminar-plantilla"
                        onclick="eliminarPlantillaActual()" style="display:none;">Eliminar</button>
                <button class="btn btn-primary" onclick="guardarPlantilla()">Guardar plantilla</button>
            </div>
        </div>

        <div class="row">
            <div class="col-md-9">
                <div id="lienzo-wrapper">
                    <div id="lienzo"></div>
                </div>
                <div class="mt-2 btn-group">
                    <button class="btn btn-sm btn-outline-secondary" onclick="agregarCapa('imagen')">+ Imagen</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="agregarCapa('video')">+ Video</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="agregarCapa('texto')">+ Texto</button>
                </div>
            </div>

            <div class="col-md-3">
                <div id="panel-propiedades" class="card p-3">
                    <p class="text-muted">Seleccioná una capa para editar sus propiedades.</p>
                </div>
            </div>
        </div>
    </div>
</div>
{% endblock %}

{% block extra_script %}
<script src="{{ url_for('static', filename='js/plantillas.js') }}"></script>
{% endblock %}
```

- [ ] **Step 2: Crear `app/static/js/plantillas.js` con el listado y navegación básica**

```javascript
const ANCHO_LIENZO = 1920;
const ALTO_LIENZO = 1080;
const ESCALA_LIENZO = 0.5;

let plantillaEditandoId = null;
let capas = [];
let capaSeleccionadaId = null;
let contadorIdTemporal = -1;

document.addEventListener('DOMContentLoaded', cargarListadoPlantillas);

async function cargarListadoPlantillas() {
    const response = await fetch('/api/plantillas');
    const plantillas = await response.json();
    const contenedor = document.getElementById('lista-plantillas');
    contenedor.querySelectorAll('.plantilla-existente').forEach(el => el.remove());

    plantillas.forEach(p => {
        const col = document.createElement('div');
        col.className = 'col-md-3 mb-3 plantilla-existente';
        col.innerHTML = `
            <div class="card plantilla-card h-100" onclick="abrirPlantilla(${p.id})">
                <div class="card-body">
                    <h5 class="card-title">${p.nombre}</h5>
                </div>
            </div>
        `;
        contenedor.appendChild(col);
    });
}

function nuevaPlantilla() {
    plantillaEditandoId = null;
    capas = [];
    capaSeleccionadaId = null;
    document.getElementById('plantilla-nombre').value = '';
    document.getElementById('btn-eliminar-plantilla').style.display = 'none';
    mostrarEditor();
}

async function abrirPlantilla(id) {
    const response = await fetch(`/api/plantillas/${id}`);
    if (!response.ok) {
        Swal.fire({ icon: 'error', title: 'No se pudo cargar la plantilla' });
        return;
    }
    const data = await response.json();
    plantillaEditandoId = data.id;
    capas = data.capas;
    capaSeleccionadaId = null;
    document.getElementById('plantilla-nombre').value = data.nombre;
    document.getElementById('btn-eliminar-plantilla').style.display = 'inline-block';
    mostrarEditor();
}

function mostrarEditor() {
    document.getElementById('lista-plantillas').style.display = 'none';
    document.getElementById('editor-plantilla').style.display = 'block';
    renderizarLienzo();
    renderizarPanelPropiedades();
}

function cerrarEditor() {
    document.getElementById('editor-plantilla').style.display = 'none';
    document.getElementById('lista-plantillas').style.display = 'flex';
    cargarListadoPlantillas();
}

function renderizarLienzo() {
    const lienzo = document.getElementById('lienzo');
    lienzo.innerHTML = '';
}

function renderizarPanelPropiedades() {
    const panel = document.getElementById('panel-propiedades');
    panel.innerHTML = '<p class="text-muted">Seleccioná una capa para editar sus propiedades.</p>';
}
```

`renderizarLienzo` y `renderizarPanelPropiedades` quedan como placeholders funcionales (no rompen nada) hasta la Task 5, que los completa.

- [ ] **Step 3: Agregar el link de navegación en `index.html`**

En `app/templates/index.html`, dentro de `.menu-card .card-body`, agregar un botón después del botón "Guiones" (línea con `onclick="window.location.href='/listado_guiones'"`):

```html
                <button class="btn btn-outline-primary btn-block btn-lg mt-3"
                        onclick="window.location.href='/plantillas'">
                    Plantillas de Gráfica
                </button>
```

- [ ] **Step 4: Verificar manualmente en el navegador**

```bash
export FLASK_APP=run.py
python run.py &
sleep 2
```

Abrir `http://localhost:5000/plantillas` en el navegador. Expected: se ve la tarjeta "Nueva plantilla" y una tarjeta "Zócalo clásico". Click en "Zócalo clásico" abre el editor (lienzo vacío por ahora, panel de propiedades con el mensaje por defecto). Click en "Volver" regresa al listado. Detener servidor: `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add app/templates/plantillas.html app/static/js/plantillas.js app/templates/index.html
git commit -m "feat: página de listado y shell del editor de plantillas"
```

---

### Task 5: Editor de capas — arrastre, redimensión y panel de propiedades

**Files:**
- Modify: `app/static/js/plantillas.js`

**Interfaces:**
- Consumes: `POST /plantillas/upload`, `POST /api/plantillas`, `PUT /api/plantillas/<id>`, `DELETE /api/plantillas/<id>` (Task 3).
- Produces: editor completo — capas arrastrables/redimensionables, panel de propiedades funcional, subida de archivos, guardado y eliminación de plantillas. Estructura de capa en memoria: `{id, orden, tipo, x, y, ancho, alto, archivo, loop, campo_dato, texto_fijo, fuente, tamano_fuente, color, alineacion, animacion_entrada, animacion_salida, duracion_transicion_ms}` — mismo shape que consume Task 8 vía el JSON del SSE.

- [ ] **Step 1: Reemplazar `renderizarLienzo`/`renderizarPanelPropiedades` y agregar el resto de funciones del editor**

En `app/static/js/plantillas.js`, reemplazar las dos funciones placeholder por la implementación completa, y agregar el resto de funciones al final del archivo:

```javascript
function renderizarLienzo() {
    const lienzo = document.getElementById('lienzo');
    lienzo.innerHTML = '';
    capas
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .forEach(capa => lienzo.appendChild(crearElementoEditable(capa)));
}

function crearElementoEditable(capa) {
    const div = document.createElement('div');
    div.className = 'capa-editor' + (capa.id === capaSeleccionadaId ? ' seleccionada' : '');
    div.dataset.capaId = capa.id;
    div.style.left = `${capa.x}px`;
    div.style.top = `${capa.y}px`;
    div.style.width = `${capa.ancho}px`;
    div.style.height = `${capa.alto}px`;
    div.style.zIndex = capa.orden;

    if (capa.tipo === 'imagen' && capa.archivo) {
        div.innerHTML = `<img src="/static/${capa.archivo}">`;
    } else if (capa.tipo === 'video' && capa.archivo) {
        div.innerHTML = `<video src="/static/${capa.archivo}" muted autoplay loop></video>`;
    } else if (capa.tipo === 'texto') {
        const justify = capa.alineacion === 'center' ? 'center' : (capa.alineacion === 'right' ? 'flex-end' : 'flex-start');
        const texto = capa.texto_fijo || (capa.campo_dato ? `{{${capa.campo_dato}}}` : 'Texto libre');
        div.innerHTML = `<div class="capa-texto-preview" style="font-family:${capa.fuente};font-size:${capa.tamano_fuente}px;color:${capa.color};justify-content:${justify};">${texto}</div>`;
    } else {
        div.style.background = 'rgba(255,0,0,0.15)';
    }

    div.addEventListener('mousedown', (e) => iniciarArrastre(e, capa.id));
    div.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarCapa(capa.id);
    });

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.addEventListener('mousedown', (e) => iniciarRedimension(e, capa.id));
    div.appendChild(handle);

    return div;
}

function seleccionarCapa(id) {
    capaSeleccionadaId = id;
    renderizarLienzo();
    renderizarPanelPropiedades();
}

let arrastre = null;

function iniciarArrastre(e, capaId) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarCapa(capaId);
    const capa = capas.find(c => c.id === capaId);
    arrastre = { capaId, xInicial: e.clientX, yInicial: e.clientY, xCapaInicial: capa.x, yCapaInicial: capa.y };
    document.addEventListener('mousemove', moverArrastre);
    document.addEventListener('mouseup', finalizarArrastre);
}

function moverArrastre(e) {
    if (!arrastre) return;
    const capa = capas.find(c => c.id === arrastre.capaId);
    const deltaX = (e.clientX - arrastre.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastre.yInicial) / ESCALA_LIENZO;
    capa.x = Math.max(0, Math.round(arrastre.xCapaInicial + deltaX));
    capa.y = Math.max(0, Math.round(arrastre.yCapaInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastre() {
    arrastre = null;
    document.removeEventListener('mousemove', moverArrastre);
    document.removeEventListener('mouseup', finalizarArrastre);
    renderizarPanelPropiedades();
}

let redimension = null;

function iniciarRedimension(e, capaId) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarCapa(capaId);
    const capa = capas.find(c => c.id === capaId);
    redimension = { capaId, xInicial: e.clientX, yInicial: e.clientY, anchoInicial: capa.ancho, altoInicial: capa.alto };
    document.addEventListener('mousemove', moverRedimension);
    document.addEventListener('mouseup', finalizarRedimension);
}

function moverRedimension(e) {
    if (!redimension) return;
    const capa = capas.find(c => c.id === redimension.capaId);
    const deltaX = (e.clientX - redimension.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - redimension.yInicial) / ESCALA_LIENZO;
    capa.ancho = Math.max(20, Math.round(redimension.anchoInicial + deltaX));
    capa.alto = Math.max(20, Math.round(redimension.altoInicial + deltaY));
    renderizarLienzo();
}

function finalizarRedimension() {
    redimension = null;
    document.removeEventListener('mousemove', moverRedimension);
    document.removeEventListener('mouseup', finalizarRedimension);
    renderizarPanelPropiedades();
}

function agregarCapa(tipo) {
    const nuevaCapa = {
        id: contadorIdTemporal--,
        orden: capas.length,
        tipo,
        x: 100,
        y: 100,
        ancho: tipo === 'texto' ? 400 : 200,
        alto: tipo === 'texto' ? 60 : 200,
        archivo: null,
        loop: true,
        campo_dato: null,
        texto_fijo: tipo === 'texto' ? 'Texto' : null,
        fuente: 'Arial',
        tamano_fuente: 24,
        color: '#ffffff',
        alineacion: 'left',
        animacion_entrada: 'fade',
        animacion_salida: 'fade',
        duracion_transicion_ms: 400,
    };
    capas.push(nuevaCapa);
    seleccionarCapa(nuevaCapa.id);
}

function eliminarCapaSeleccionada() {
    capas = capas.filter(c => c.id !== capaSeleccionadaId);
    capaSeleccionadaId = null;
    renderizarLienzo();
    renderizarPanelPropiedades();
}

function actualizarCapaSeleccionada(cambios) {
    const capa = capas.find(c => c.id === capaSeleccionadaId);
    if (!capa) return;
    Object.assign(capa, cambios);
    renderizarLienzo();
}

function renderizarPanelPropiedades() {
    const panel = document.getElementById('panel-propiedades');
    const capa = capas.find(c => c.id === capaSeleccionadaId);

    if (!capa) {
        panel.innerHTML = '<p class="text-muted">Seleccioná una capa para editar sus propiedades.</p>';
        return;
    }

    let camposEspecificos = '';
    if (capa.tipo === 'texto') {
        camposEspecificos = `
            <div class="form-group mb-2">
                <label>Vincular a:</label>
                <select class="form-control" id="prop-campo-dato">
                    <option value="">Texto libre</option>
                    <option value="lugar">Lugar</option>
                    <option value="tema">Tema</option>
                    <option value="entrevistado">Entrevistado</option>
                    <option value="bajada_1">Bajada 1</option>
                    <option value="bajada_2">Bajada 2</option>
                </select>
            </div>
            <div class="form-group mb-2">
                <label>Texto fijo:</label>
                <input type="text" class="form-control" id="prop-texto-fijo" value="${capa.texto_fijo || ''}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente:</label>
                <input type="text" class="form-control" id="prop-fuente" value="${capa.fuente}">
            </div>
            <div class="form-group mb-2">
                <label>Tamaño:</label>
                <input type="number" class="form-control" id="prop-tamano" value="${capa.tamano_fuente}">
            </div>
            <div class="form-group mb-2">
                <label>Color:</label>
                <input type="color" class="form-control" id="prop-color" value="${capa.color}">
            </div>
            <div class="form-group mb-2">
                <label>Alineación:</label>
                <select class="form-control" id="prop-alineacion">
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                </select>
            </div>
        `;
    } else {
        camposEspecificos = `
            <div class="form-group mb-2">
                <label>Archivo (${capa.tipo === 'video' ? '.webm' : '.png/.gif'}):</label>
                <input type="file" class="form-control" id="prop-archivo" accept="${capa.tipo === 'video' ? '.webm' : '.png,.gif'}">
                <small class="text-muted">${capa.archivo || 'Sin archivo'}</small>
            </div>
            ${capa.tipo === 'video' ? `
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-loop" ${capa.loop ? 'checked' : ''}>
                <label class="form-check-label">Repetir en loop</label>
            </div>` : ''}
        `;
    }

    panel.innerHTML = `
        <h6>Capa: ${capa.tipo}</h6>
        <div class="row">
            <div class="col-6 form-group mb-2"><label>X</label><input type="number" class="form-control" id="prop-x" value="${capa.x}"></div>
            <div class="col-6 form-group mb-2"><label>Y</label><input type="number" class="form-control" id="prop-y" value="${capa.y}"></div>
            <div class="col-6 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-ancho" value="${capa.ancho}"></div>
            <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-alto" value="${capa.alto}"></div>
        </div>
        ${camposEspecificos}
        <div class="form-group mb-2">
            <label>Animación entrada:</label>
            <select class="form-control" id="prop-anim-entrada">
                <option value="none">Ninguna</option>
                <option value="fade">Fundido</option>
                <option value="slide">Deslizar</option>
            </select>
        </div>
        <div class="form-group mb-2">
            <label>Animación salida:</label>
            <select class="form-control" id="prop-anim-salida">
                <option value="none">Ninguna</option>
                <option value="fade">Fundido</option>
                <option value="slide">Deslizar</option>
            </select>
        </div>
        <div class="form-group mb-3">
            <label>Duración transición (ms):</label>
            <input type="number" class="form-control" id="prop-duracion" value="${capa.duracion_transicion_ms}">
        </div>
        <button class="btn btn-outline-danger btn-block" onclick="eliminarCapaSeleccionada()">Eliminar capa</button>
    `;

    document.getElementById('prop-x').addEventListener('change', (e) => actualizarCapaSeleccionada({ x: parseInt(e.target.value) || 0 }));
    document.getElementById('prop-y').addEventListener('change', (e) => actualizarCapaSeleccionada({ y: parseInt(e.target.value) || 0 }));
    document.getElementById('prop-ancho').addEventListener('change', (e) => actualizarCapaSeleccionada({ ancho: parseInt(e.target.value) || 1 }));
    document.getElementById('prop-alto').addEventListener('change', (e) => actualizarCapaSeleccionada({ alto: parseInt(e.target.value) || 1 }));

    document.getElementById('prop-anim-entrada').value = capa.animacion_entrada;
    document.getElementById('prop-anim-salida').value = capa.animacion_salida;
    document.getElementById('prop-anim-entrada').addEventListener('change', (e) => actualizarCapaSeleccionada({ animacion_entrada: e.target.value }));
    document.getElementById('prop-anim-salida').addEventListener('change', (e) => actualizarCapaSeleccionada({ animacion_salida: e.target.value }));
    document.getElementById('prop-duracion').addEventListener('change', (e) => actualizarCapaSeleccionada({ duracion_transicion_ms: parseInt(e.target.value) || 400 }));

    if (capa.tipo === 'texto') {
        document.getElementById('prop-campo-dato').value = capa.campo_dato || '';
        document.getElementById('prop-alineacion').value = capa.alineacion;
        document.getElementById('prop-campo-dato').addEventListener('change', (e) => actualizarCapaSeleccionada({ campo_dato: e.target.value || null }));
        document.getElementById('prop-texto-fijo').addEventListener('change', (e) => actualizarCapaSeleccionada({ texto_fijo: e.target.value }));
        document.getElementById('prop-fuente').addEventListener('change', (e) => actualizarCapaSeleccionada({ fuente: e.target.value }));
        document.getElementById('prop-tamano').addEventListener('change', (e) => actualizarCapaSeleccionada({ tamano_fuente: parseInt(e.target.value) || 24 }));
        document.getElementById('prop-color').addEventListener('change', (e) => actualizarCapaSeleccionada({ color: e.target.value }));
        document.getElementById('prop-alineacion').addEventListener('change', (e) => actualizarCapaSeleccionada({ alineacion: e.target.value }));
    } else {
        document.getElementById('prop-archivo').addEventListener('change', (e) => subirArchivoCapa(e.target.files[0]));
        if (capa.tipo === 'video') {
            document.getElementById('prop-loop').addEventListener('change', (e) => actualizarCapaSeleccionada({ loop: e.target.checked }));
        }
    }
}

async function subirArchivoCapa(archivo) {
    if (!archivo) return;
    const formData = new FormData();
    formData.append('archivo', archivo);

    try {
        const response = await fetch('/plantillas/upload', { method: 'POST', body: formData });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al subir el archivo');
        }
        const data = await response.json();
        actualizarCapaSeleccionada({ archivo: data.ruta });
        renderizarPanelPropiedades();
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}

async function guardarPlantilla() {
    const nombre = document.getElementById('plantilla-nombre').value.trim();
    if (!nombre) {
        Swal.fire({ icon: 'error', title: 'Falta el nombre de la plantilla' });
        return;
    }

    const payload = {
        nombre,
        ancho: ANCHO_LIENZO,
        alto: ALTO_LIENZO,
        capas: capas.map((c, i) => {
            const { id, ...resto } = c;
            return { ...resto, orden: i };
        }),
    };

    try {
        const url = plantillaEditandoId ? `/api/plantillas/${plantillaEditandoId}` : '/api/plantillas';
        const method = plantillaEditandoId ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al guardar la plantilla');
        }

        Swal.fire({ icon: 'success', title: 'Plantilla guardada', showConfirmButton: false, timer: 1000 });
        cerrarEditor();
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}

async function eliminarPlantillaActual() {
    if (!plantillaEditandoId) return;
    const result = await Swal.fire({
        title: '¿Eliminar esta plantilla?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
        const response = await fetch(`/api/plantillas/${plantillaEditandoId}`, { method: 'DELETE' });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al eliminar la plantilla');
        }
        Swal.fire({ icon: 'success', title: 'Plantilla eliminada', showConfirmButton: false, timer: 1000 });
        cerrarEditor();
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}
```

- [ ] **Step 2: Verificar manualmente el editor completo**

```bash
export FLASK_APP=run.py
python run.py &
sleep 2
```

En el navegador, ir a `http://localhost:5000/plantillas`:
1. Click en "Zócalo clásico": deben verse 8 recuadros posicionados (logo arriba-izquierda, barra info al lado, tags a la derecha).
2. Click en una capa: se resalta con borde azul y el panel de propiedades muestra sus datos.
3. Arrastrar una capa: se mueve y los inputs X/Y del panel se actualizan al soltar.
4. Arrastrar el handle azul (esquina inferior derecha): cambia ancho/alto.
5. Click en "+ Texto": aparece una capa nueva de texto editable, cambiar "Vincular a" a "Lugar" y ver que el placeholder cambia a `{{lugar}}`.
6. Cambiar el nombre de la plantilla a "Zócalo clásico" (sin cambiar nada más) y click en "Guardar plantilla": debe mostrar el SweetAlert de éxito y volver al listado.
7. Volver a abrir "Zócalo clásico": debe conservar las 8 capas originales (verificando que el guardado no las duplicó ni perdió).

Detener servidor: `kill %1`.

- [ ] **Step 3: Commit**

```bash
git add app/static/js/plantillas.js
git commit -m "feat: editor de capas con arrastre, redimensión y panel de propiedades"
```

---

### Task 6: Selección de plantilla en el formulario de Graph

**Files:**
- Modify: `app/routes/graphs.py`
- Modify: `app/templates/control_graphs.html`
- Modify: `app/static/js/graphs.js`

**Interfaces:**
- Consumes: `GET /api/plantillas` (Task 3), modelo `Plantilla` (Task 1).
- Produces: `crear_graph`/`actualizar_graph` aceptan `plantilla_id` opcional en el payload (default: plantilla "Zócalo clásico" si no se especifica). `obtener_graph`/`obtener_graphs_por_texto` devuelven `plantilla_id` en la respuesta.

- [ ] **Step 1: Agregar el helper de plantilla default y usarlo en `crear_graph`**

En `app/routes/graphs.py`, modificar el import de modelos (línea 12) para incluir `Plantilla`:

```python
from ..models import Graph, Texto, Guion, Entrevistado, Bajada, Cita, Plantilla
```

Agregar el helper después de la línea `graphs_bp = Blueprint('graphs', __name__)`:

```python
def _plantilla_default_id():
    default = Plantilla.query.filter_by(nombre='Zócalo clásico').first()
    return default.id if default else None
```

En `crear_graph`, modificar la construcción de `nuevo_graph` (línea 26-31) para incluir `plantilla_id`:

```python
        nuevo_graph = Graph(
            lugar=data['lugar'],
            tema=data.get('tema'),
            texto_id=data['texto_id'],
            plantilla_id=data.get('plantilla_id') or _plantilla_default_id(),
            activo=True
        )
```

- [ ] **Step 2: Actualizar `actualizar_graph`, `obtener_graph` y `obtener_graphs_por_texto`**

En `actualizar_graph`, después de la línea `graph.tema = data.get('tema', graph.tema)`, agregar:

```python
        graph.plantilla_id = data.get('plantilla_id', graph.plantilla_id)
```

En `obtener_graph`, dentro del `jsonify({...})` de retorno, agregar la clave `"plantilla_id": graph.plantilla_id,` (junto a `"activo": graph.activo,`).

En `obtener_graphs_por_texto`, dentro de `graphs_data.append({...})`, agregar también `"plantilla_id": graph.plantilla_id,`.

- [ ] **Step 3: Agregar el select de plantilla al formulario en `control_graphs.html`**

En `app/templates/control_graphs.html`, dentro del `<div class="col-6 p-0 m-0">` que contiene el campo `entrevistado` (después del input `id="entrevistado"`), agregar:

```html
                                <div class="form-group m-0 mt-2">
                                    <label for="plantilla_id" class="mb-0">Plantilla:</label>
                                    <select class="form-control" id="plantilla_id">
                                        <!-- Las opciones se llenarán dinámicamente con JavaScript -->
                                    </select>
                                </div>
```

- [ ] **Step 4: Cargar y usar el select de plantilla en `graphs.js`**

En `app/static/js/graphs.js`, agregar al inicio del archivo (antes de `async function guardarGraph`):

```javascript
document.addEventListener('DOMContentLoaded', cargarPlantillasSelect);

async function cargarPlantillasSelect() {
    const select = document.getElementById('plantilla_id');
    if (!select) return;
    try {
        const response = await fetch('/api/plantillas');
        if (!response.ok) return;
        const plantillas = await response.json();
        select.innerHTML = '';
        plantillas.forEach(p => {
            const option = document.createElement('option');
            option.value = p.id;
            option.textContent = p.nombre;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error al cargar plantillas:', error);
    }
}
```

En `guardarGraph`, dentro del `body: JSON.stringify({...})` (línea ~62-68), agregar la clave `plantilla_id: document.getElementById('plantilla_id').value || null,`.

En `agregarNoCerrar`, dentro de su `body: JSON.stringify({...})` (línea ~172-178), agregar la misma clave `plantilla_id: document.getElementById('plantilla_id').value || null,`.

En `editarGraph`, después de la línea `document.getElementById('tema').value = graph.tema || '';`, agregar:

```javascript
        if (document.getElementById('plantilla_id') && graph.plantilla_id) {
            document.getElementById('plantilla_id').value = graph.plantilla_id;
        }
```

- [ ] **Step 5: Verificar manualmente en el navegador**

```bash
export FLASK_APP=run.py
python run.py &
sleep 2
```

Ir a `http://localhost:5000/listado_guiones`, abrir un guión existente (ruta `/control_graphs/<id>`). Abrir el modal "Carga de Graphs": el select "Plantilla" debe listar "Zócalo clásico" (y cualquier otra plantilla creada en la Task 5). Crear un graph nuevo sin tocar el select: verificar en la base de datos que quedó asociado a la plantilla default:

```bash
psql -U abarreira -d guiones -h localhost -c "SELECT id, lugar, plantilla_id FROM graph ORDER BY id DESC LIMIT 1;"
```

Expected: `plantilla_id` no nulo (id de "Zócalo clásico"). Editar ese mismo graph y confirmar que el select refleja la plantilla asignada al reabrir el modal. Detener servidor: `kill %1`.

- [ ] **Step 6: Commit**

```bash
git add app/routes/graphs.py app/templates/control_graphs.html app/static/js/graphs.js
git commit -m "feat: seleccionar plantilla de gráfica al crear/editar un graph"
```

---

### Task 7: Motor de renderizado — resolver la plantilla activa en el SSE

**Files:**
- Modify: `app/routes/graphs.py`

**Interfaces:**
- Consumes: `Graph.plantilla` (relationship, Task 1), modelos `Plantilla`/`PlantillaCapa`.
- Produces: la respuesta de `/stream_display_config` agrega la clave `"plantilla"` (objeto `{id, ancho, alto, capas: [...]}` con cada capa de texto trayendo `"valor"` ya resuelto, o `null` si no hay graph activo o el graph activo no tiene plantilla asignada). Consumido por `pantalla.js` (Task 8).

- [ ] **Step 1: Agregar la función de resolución de capas en `app/routes/graphs.py`**

Agregar antes de la definición de `stream_display_config` (antes de la línea `@graphs_bp.route('/stream_display_config')`, ubicada cerca del final del archivo, después de `get_display_config`):

```python
def _resolver_capas_plantilla(graph_activo):
    if not graph_activo or not graph_activo.plantilla:
        return None

    bajadas = sorted(graph_activo.bajadas, key=lambda b: b.id)
    bajada_1 = bajadas[0].texto if len(bajadas) > 0 else ""
    bajada_2 = bajadas[1].texto if len(bajadas) > 1 else ""
    entrevistado = graph_activo.citas[0].entrevistado.nombre if graph_activo.citas else ""

    valores_por_campo = {
        'lugar': graph_activo.lugar or "",
        'tema': graph_activo.tema or "",
        'entrevistado': entrevistado,
        'bajada_1': bajada_1,
        'bajada_2': bajada_2,
    }

    plantilla = graph_activo.plantilla
    capas = []
    for capa in sorted(plantilla.capas, key=lambda c: c.orden):
        capa_resuelta = {
            "id": capa.id,
            "orden": capa.orden,
            "tipo": capa.tipo,
            "x": capa.x,
            "y": capa.y,
            "ancho": capa.ancho,
            "alto": capa.alto,
            "archivo": capa.archivo,
            "loop": capa.loop,
            "fuente": capa.fuente,
            "tamano_fuente": capa.tamano_fuente,
            "color": capa.color,
            "alineacion": capa.alineacion,
            "animacion_entrada": capa.animacion_entrada,
            "animacion_salida": capa.animacion_salida,
            "duracion_transicion_ms": capa.duracion_transicion_ms,
        }
        if capa.tipo == 'texto':
            capa_resuelta["valor"] = valores_por_campo.get(capa.campo_dato, capa.texto_fijo or "")
        capas.append(capa_resuelta)

    return {"id": plantilla.id, "ancho": plantilla.ancho, "alto": plantilla.alto, "capas": capas}
```

- [ ] **Step 2: Usar la función dentro de `stream_display_config`, con eager loading de la plantilla**

En `stream_display_config`, dentro de `event_stream`, la consulta de `graph_activo` ya usa `.options(selectinload(Graph.bajadas), joinedload(Graph.citas)...)`. Agregar ahí también el eager loading de la plantilla y sus capas para no disparar una query extra por cada tick del SSE (cada 0.5s):

```python
                    graph_activo = db.session.query(Graph).options(
                        selectinload(Graph.bajadas),
                        joinedload(Graph.citas).joinedload(Cita.entrevistado),
                        joinedload(Graph.plantilla).selectinload(Plantilla.capas)
                    ).filter_by(activo=True).first()
```

Y modificar la construcción de `config` (bloque que empieza en `config = { "layout": ... }`) agregando la clave `"plantilla"`:

```python
                    config = {
                        "layout": saved_config.get("layout", {}),
                        "badges": saved_config.get("badges", {}),
                        "live":   saved_config.get("live",   {}),
                        "plantilla": _resolver_capas_plantilla(graph_activo),
                        "content": {
                            "primera_bajada": "",
                            "segunda_bajada": "",
                            "entrevistado":   "",
                            "lugar":          "",
                        }
                    }
```

- [ ] **Step 3: Verificar manualmente con curl**

```bash
export FLASK_APP=run.py
python run.py &
sleep 2

# Activar un graph existente que ya tenga plantilla_id (ver Task 6)
curl -s -X PUT http://localhost:5000/graphs/activo/<id_de_un_graph>

# Leer 2 eventos del stream y cortar
timeout 2 curl -s http://localhost:5000/stream_display_config
```

Expected: el JSON emitido incluye `"plantilla": {"id": ..., "ancho": 1920, "alto": 1080, "capas": [...]}` con al menos una capa `tipo: "texto"` que trae `"valor"` con el texto real del graph activo (ej. el `lugar` cargado). Desactivar el graph (`Graph.query.update({Graph.activo: False})` vía algún otro graph, o directamente en psql) y repetir el `curl`: `"plantilla"` debe ser `null`. Detener servidor: `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add app/routes/graphs.py
git commit -m "feat: resolver plantilla y valores de graph activo en el stream de display"
```

---

### Task 8: Renderizado dinámico en `pantalla.html`/`pantalla.js`

**Files:**
- Modify: `app/templates/pantalla.html`
- Modify: `app/static/js/pantalla.js`

**Interfaces:**
- Consumes: evento SSE de `/stream_display_config` con la forma `{layout, badges, live, plantilla, content}` (Task 7), donde `plantilla` es `{id, ancho, alto, capas: [{id, tipo, x, y, ancho, alto, archivo, loop, fuente, tamano_fuente, color, alineacion, animacion_entrada, animacion_salida, duracion_transicion_ms, valor?}]}` o `null`.
- Produces: overlay renderizado a pantalla completa, listo para usarse como Browser Source de OBS en resolución 1920×1080.

- [ ] **Step 1: Reemplazar el contenido de `app/templates/pantalla.html`**

```html
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Sobreimpresos</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            background: transparent;
            overflow: hidden;
        }

        .live-badge {
            position: fixed;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 18px;
            -webkit-text-stroke: 1px #1e1e1e;
            text-transform: uppercase;
            text-shadow: 1px -1px 2px rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: none;
        }

        #overlay-root {
            position: relative;
            width: 1920px;
            height: 1080px;
        }

        .capa {
            position: absolute;
            box-sizing: border-box;
            overflow: hidden;
        }

        .capa-media {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .capa-texto {
            display: flex;
            align-items: center;
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .anim-fade-enter { animation: fadeIn var(--dur, 400ms) ease forwards; }
        .anim-fade-exit  { animation: fadeOut var(--dur, 400ms) ease forwards; }
        .anim-slide-enter { animation: slideIn var(--dur, 400ms) ease forwards; }
        .anim-slide-exit  { animation: slideOut var(--dur, 400ms) ease forwards; }

        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideIn  { from { opacity: 0; transform: translateX(-40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes slideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(-40px); } }
    </style>
</head>
<body>
<div class="live-badge" id="liveBadge"></div>
<div id="overlay-root"></div>
<script type="module" src="{{ url_for('static', filename='js/pantalla.js') }}"></script>
</body>
</html>
```

Nota para el operador (agregar como comentario, no en el HTML): el Browser Source de OBS debe configurarse en 1920×1080 para que las posiciones de las capas coincidan sin distorsión.

- [ ] **Step 2: Reemplazar `app/static/js/pantalla.js` completo**

```javascript
let plantillaActualId = null;
let plantillaVisible = false;
let capasActuales = [];

function crearElementoCapa(capa) {
    let el;
    if (capa.tipo === 'texto') {
        el = document.createElement('div');
        el.classList.add('capa', 'capa-texto');
        el.style.fontFamily = capa.fuente;
        el.style.fontSize = `${capa.tamano_fuente}px`;
        el.style.color = capa.color;
        el.style.justifyContent = capa.alineacion === 'center' ? 'center' : (capa.alineacion === 'right' ? 'flex-end' : 'flex-start');
        el.textContent = capa.valor || '';
    } else if (capa.tipo === 'video') {
        el = document.createElement('video');
        el.classList.add('capa', 'capa-media');
        el.src = `/static/${capa.archivo}`;
        el.muted = true;
        el.autoplay = true;
        el.loop = !!capa.loop;
        el.playsInline = true;
    } else {
        el = document.createElement('img');
        el.classList.add('capa', 'capa-media');
        el.src = `/static/${capa.archivo}`;
    }

    el.id = `capa-${capa.id}`;
    el.style.left = `${capa.x}px`;
    el.style.top = `${capa.y}px`;
    el.style.width = `${capa.ancho}px`;
    el.style.height = `${capa.alto}px`;
    el.style.zIndex = capa.orden;
    return el;
}

function renderizarPlantilla(plantillaData) {
    const root = document.getElementById('overlay-root');
    root.innerHTML = '';
    plantillaActualId = plantillaData.id;
    plantillaData.capas
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .forEach(capa => root.appendChild(crearElementoCapa(capa)));
}

function actualizarTextos(plantillaData) {
    plantillaData.capas.forEach(capa => {
        if (capa.tipo !== 'texto') return;
        const el = document.getElementById(`capa-${capa.id}`);
        if (el) el.textContent = capa.valor || '';
    });
}

function aplicarAnimacion(tipo) {
    const root = document.getElementById('overlay-root');
    root.querySelectorAll('.capa').forEach(el => {
        const capaId = el.id.replace('capa-', '');
        const capa = capasActuales.find(c => String(c.id) === capaId);
        if (!capa) return;
        const animacion = tipo === 'entrada' ? capa.animacion_entrada : capa.animacion_salida;
        if (!animacion || animacion === 'none') return;
        el.style.setProperty('--dur', `${capa.duracion_transicion_ms}ms`);
        el.classList.add(`anim-${animacion}-${tipo === 'entrada' ? 'enter' : 'exit'}`);
    });
}

function updateDisplay(data) {
    const liveBadge = document.getElementById('liveBadge');
    if (data.live) {
        liveBadge.textContent = data.live.text || 'VIVO';
        liveBadge.style.display = data.live.show ? 'block' : 'none';
        liveBadge.style.top = data.live.top || '20px';
        liveBadge.style.right = data.live.right || '20px';
    }

    const root = document.getElementById('overlay-root');
    const hayGraphActivo = !!data.plantilla;

    if (hayGraphActivo && data.plantilla.id !== plantillaActualId) {
        renderizarPlantilla(data.plantilla);
        capasActuales = data.plantilla.capas;
        if (!plantillaVisible) {
            aplicarAnimacion('entrada');
            plantillaVisible = true;
        }
    } else if (hayGraphActivo) {
        actualizarTextos(data.plantilla);
        capasActuales = data.plantilla.capas;
        if (!plantillaVisible) {
            aplicarAnimacion('entrada');
            plantillaVisible = true;
        }
    } else if (!hayGraphActivo && plantillaVisible) {
        const duraciones = capasActuales.map(c => c.duracion_transicion_ms || 400);
        const maxDuracion = duraciones.length ? Math.max(...duraciones) : 400;
        aplicarAnimacion('salida');
        plantillaVisible = false;
        plantillaActualId = null;
        setTimeout(() => { root.innerHTML = ''; }, maxDuracion);
    }
}

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let eventSource;

function setupEventSource() {
    eventSource = new EventSource('/stream_display_config');

    eventSource.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            updateDisplay(data);
            reconnectAttempts = 0;
        } catch (error) {
            console.error('Error al analizar datos:', error);
        }
    };

    eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) return;
        if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(3000 * (reconnectAttempts + 1), 15000);
            reconnectAttempts++;
            eventSource.close();
            setTimeout(setupEventSource, delay);
        }
    };
}

export function initDisplay() {
    setupEventSource();
}

export function cleanupDisplay() {
    if (eventSource) eventSource.close();
}

if (typeof window !== 'undefined') {
    window.addEventListener('load', initDisplay);
    window.addEventListener('beforeunload', cleanupDisplay);
}
```

- [ ] **Step 3: Verificar manualmente en el navegador**

```bash
export FLASK_APP=run.py
python run.py &
sleep 2
```

Abrir dos pestañas: `http://localhost:5000/pantalla` y `http://localhost:5000/control_graphs/<id_de_un_guion>`. En la pestaña de control, activar un graph con "Zócalo clásico" asignado (`PUT /graphs/activo/<id>` desde el modal o vía botón existente en la UI de graphs). Expected: en `/pantalla` aparecen las 8 capas del zócalo con los textos reales (lugar, tema, bajada, entrevistado) en las posiciones esperadas, con transición de aparición (fade). Desactivar el graph (activar otro guión sin graph, o setear `activo=False` manualmente): Expected: el overlay hace fade out y desaparece. Verificar además que cambiar de un graph activo a otro (ambos con la misma plantilla) actualiza los textos sin parpadeo de las capas de imagen/video (no se recrea el DOM, solo cambia el texto). Detener servidor: `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add app/templates/pantalla.html app/static/js/pantalla.js
git commit -m "feat: renderizar overlay de forma dinámica a partir de la plantilla del graph activo"
```

---

### Task 9: Verificación end-to-end y ajuste de `.gitignore` de uploads

**Files:**
- Modify: `.gitignore`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: ninguno nuevo — tarea de verificación final y de excluir los archivos subidos por el usuario del control de versiones.

- [ ] **Step 1: Excluir la carpeta de archivos subidos del control de versiones**

En `.gitignore`, agregar al final:

```
app/static/uploads/
```

- [ ] **Step 2: Flujo completo manual (OBS incluido si está disponible)**

```bash
export FLASK_APP=run.py
python run.py &
sleep 2
```

1. Ir a `/plantillas`, crear una plantilla nueva llamada "Placa simple" con una sola capa de texto vinculada a `lugar`, guardar.
2. Ir a un guión (`/control_graphs/<id>`), crear un graph nuevo asignándole la plantilla "Placa simple", con `lugar = "ESTUDIO 1"`.
3. Activar ese graph.
4. Abrir `/pantalla` en el navegador: debe verse únicamente el texto "ESTUDIO 1" en la posición configurada, con fondo transparente (verificar con las herramientas de desarrollador que `body` tiene `background: transparent`).
5. Si hay OBS Studio disponible: agregar una fuente "Navegador" apuntando a `http://localhost:5000/pantalla`, ancho 1920, alto 1080, y confirmar que se ve igual que en el navegador, con transparencia sobre el resto de la escena.
6. Detener servidor: `kill %1`.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: excluir archivos subidos de plantillas del control de versiones"
```
