# Duplicar Plantillas y Capas de Forma Geométrica Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un botón "Duplicar" en el listado de Plantillas, y un nuevo tipo de capa `'forma'` (rectángulo con esquinas redondeadas, color/gradiente de fondo, borde, opacidad) editable en `/plantillas` y renderizable en la salida real, el preview de `/control_live` y el editor mismo.

**Architecture:** El modelo `PlantillaCapa` gana 9 columnas nuevas (nullable/con default, sin backfill). El backend expone esos campos en la serialización ya existente y agrega un endpoint de duplicado que copia una `Plantilla` y todas sus `PlantillaCapa`. El frontend duplica un bloque de estilo puntual (`border-radius`/`background`/`border`/`opacity`) en los 4 lugares donde ya se crean elementos de capa — mismo patrón de duplicación ya usado en el proyecto para los demás tipos, sin introducir un módulo compartido nuevo.

**Tech Stack:** Flask + SQLAlchemy + Alembic (migración nueva), JS vanilla, Bootstrap 4.

## Global Constraints

- No hay tests automatizados en este repo — verificación manual (`curl` para backend, navegador para frontend, o trace estático si no hay navegador disponible).
- Servidor de desarrollo en el puerto 5001 (el 5000 puede estar en uso por el usuario — no tocarlo). Base de datos Postgres compartida real ya configurada.
- El gradiente es siempre lineal, 2 colores, ángulo en grados — sin radial ni más de 2 colores (confirmado fuera de alcance).
- La opacidad aplica a la capa completa (`el.style.opacity`), no a fondo/borde por separado.
- Las animaciones de entrada/salida y su duración ya existen en el modelo — las formas los reusan sin cambios de esquema.
- No crear un módulo JS compartido para el estilo de "forma" — se duplica el bloque en cada uno de los 4 puntos de renderizado, siguiendo el patrón ya establecido en el proyecto.

---

## Task 1: Modelo de datos — columnas de forma geométrica

**Files:**
- Modify: `app/models.py` (clase `PlantillaCapa`)
- Create: `migrations/versions/f28a71c9de63_agregar_columnas_forma_geometrica.py`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `PlantillaCapa.radio_esquina`, `.color_fondo`, `.opacidad`, `.color_borde`, `.ancho_borde`, `.usar_gradiente`, `.gradiente_color_inicio`, `.gradiente_color_fin`, `.gradiente_angulo` — consumidos por las Tasks 2-6.

- [ ] **Step 1: Agregar las columnas a `PlantillaCapa`**

En `app/models.py`, dentro de la clase `PlantillaCapa`, después del bloque `duracion_transicion_ms` (última columna existente), agregar:

```python
    radio_esquina = db.Column(db.Integer, nullable=False, default=0)
    color_fondo = db.Column(db.String(20), nullable=True)
    opacidad = db.Column(db.Integer, nullable=False, default=100)
    color_borde = db.Column(db.String(20), nullable=True)
    ancho_borde = db.Column(db.Integer, nullable=False, default=0)
    usar_gradiente = db.Column(db.Boolean, nullable=False, default=False)
    gradiente_color_inicio = db.Column(db.String(20), nullable=True)
    gradiente_color_fin = db.Column(db.String(20), nullable=True)
    gradiente_angulo = db.Column(db.Integer, nullable=False, default=90)
```

No toques el comentario `# 'imagen' | 'video' | 'texto'` de la columna `tipo` todavía (lo actualiza la Task 2, junto con la validación real).

- [ ] **Step 2: Escribir la migración**

Crear `migrations/versions/f28a71c9de63_agregar_columnas_forma_geometrica.py`:

```python
"""agregar columnas de forma geometrica a plantilla_capa

Revision ID: f28a71c9de63
Revises: d4e8f1a92c67
Create Date: 2026-07-15 16:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'f28a71c9de63'
down_revision = 'd4e8f1a92c67'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.add_column(sa.Column('radio_esquina', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('color_fondo', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('opacidad', sa.Integer(), nullable=False, server_default='100'))
        batch_op.add_column(sa.Column('color_borde', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('ancho_borde', sa.Integer(), nullable=False, server_default='0'))
        batch_op.add_column(sa.Column('usar_gradiente', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('gradiente_color_inicio', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('gradiente_color_fin', sa.String(length=20), nullable=True))
        batch_op.add_column(sa.Column('gradiente_angulo', sa.Integer(), nullable=False, server_default='90'))


def downgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.drop_column('gradiente_angulo')
        batch_op.drop_column('gradiente_color_fin')
        batch_op.drop_column('gradiente_color_inicio')
        batch_op.drop_column('usar_gradiente')
        batch_op.drop_column('ancho_borde')
        batch_op.drop_column('color_borde')
        batch_op.drop_column('opacidad')
        batch_op.drop_column('color_fondo')
        batch_op.drop_column('radio_esquina')
```

- [ ] **Step 3: Correr la migración y verificar**

```bash
.venv/bin/python -m flask db upgrade
.venv/bin/python -m flask db current
```

Expected: sin errores, termina en `f28a71c9de63 (head)`.

```bash
.venv/bin/python -c "
from run import app
with app.app_context():
    from app.models import PlantillaCapa
    c = PlantillaCapa.query.first()
    print('radio_esquina:', c.radio_esquina, 'opacidad:', c.opacidad, 'usar_gradiente:', c.usar_gradiente, 'gradiente_angulo:', c.gradiente_angulo)
"
```

Expected: `radio_esquina: 0`, `opacidad: 100`, `usar_gradiente: False`, `gradiente_angulo: 90` (defaults aplicados a capas existentes, sin error de NOT NULL).

- [ ] **Step 4: Commit**

```bash
git add app/models.py migrations/versions/f28a71c9de63_agregar_columnas_forma_geometrica.py
git commit -m "feat: agregar columnas de forma geometrica a PlantillaCapa"
```

---

## Task 2: Backend — soporte del tipo `'forma'` en Plantillas

**Files:**
- Modify: `app/routes/plantillas.py`

**Interfaces:**
- Consumes: columnas de la Task 1.
- Produces: `POST/PUT /api/plantillas` aceptan capas con `tipo: 'forma'` y los 9 campos nuevos. `GET /api/plantillas/<id>` los devuelve para TODAS las capas (no solo forma) — consumido por las Tasks 5-7.

- [ ] **Step 1: Aceptar `'forma'` como tipo válido**

En `app/routes/plantillas.py`, reemplazar:

```python
TIPOS_CAPA_VALIDOS = {'imagen', 'video', 'texto'}
```

por:

```python
TIPOS_CAPA_VALIDOS = {'imagen', 'video', 'texto', 'forma'}
```

- [ ] **Step 2: Serializar los 9 campos nuevos**

En `app/routes/plantillas.py`, dentro de `_serializar_plantilla`, en el dict de cada capa (después de `"duracion_transicion_ms": capa.duracion_transicion_ms,`), agregar:

```python
                "radio_esquina": capa.radio_esquina,
                "color_fondo": capa.color_fondo,
                "opacidad": capa.opacidad,
                "color_borde": capa.color_borde,
                "ancho_borde": capa.ancho_borde,
                "usar_gradiente": capa.usar_gradiente,
                "gradiente_color_inicio": capa.gradiente_color_inicio,
                "gradiente_color_fin": capa.gradiente_color_fin,
                "gradiente_angulo": capa.gradiente_angulo,
```

- [ ] **Step 3: Aceptar los 9 campos nuevos al crear capas**

En `app/routes/plantillas.py`, dentro de `_crear_capas`, en el `PlantillaCapa(...)` (después de `duracion_transicion_ms=capa_data.get('duracion_transicion_ms', 400),`), agregar:

```python
            radio_esquina=capa_data.get('radio_esquina', 0),
            color_fondo=capa_data.get('color_fondo'),
            opacidad=capa_data.get('opacidad', 100),
            color_borde=capa_data.get('color_borde'),
            ancho_borde=capa_data.get('ancho_borde', 0),
            usar_gradiente=capa_data.get('usar_gradiente', False),
            gradiente_color_inicio=capa_data.get('gradiente_color_inicio'),
            gradiente_color_fin=capa_data.get('gradiente_color_fin'),
            gradiente_angulo=capa_data.get('gradiente_angulo', 90),
```

- [ ] **Step 4: Verificar con curl**

Con el server corriendo en el puerto 5001, usando una Plantilla real (conseguir un id con `curl -s http://127.0.0.1:5001/api/plantillas`):

```bash
curl -s http://127.0.0.1:5001/api/plantillas/<ID> | python3 -m json.tool
```

Guardar la misma plantilla agregando una capa de tipo `'forma'` (usar el resto de las capas existentes tal cual, agregando una nueva a la lista):

```bash
curl -s -X PUT http://127.0.0.1:5001/api/plantillas/<ID> -H "Content-Type: application/json" \
  -d '{"nombre": "<NOMBRE_REAL>", "ancho": 1920, "alto": 1080, "capas": [<CAPAS_EXISTENTES>, {"tipo": "forma", "x": 10, "y": 10, "ancho": 100, "alto": 100, "radio_esquina": 20, "color_fondo": "#ff0000", "opacidad": 80, "color_borde": "#000000", "ancho_borde": 2, "usar_gradiente": false, "gradiente_angulo": 90}]}'
curl -s http://127.0.0.1:5001/api/plantillas/<ID> | python3 -m json.tool
```

Expected: el PUT responde `{"mensaje": "Plantilla actualizada"}` (antes de este cambio, hubiera dado 400 "Tipo de capa inválido: forma"), y el GET posterior muestra la nueva capa con `tipo: "forma"` y sus 9 campos. Restaurá la plantilla a su forma original con otro PUT si era una plantilla real en uso, o dejalo anotado en el reporte.

- [ ] **Step 5: Commit**

```bash
git add app/routes/plantillas.py
git commit -m "feat: aceptar tipo de capa forma con sus atributos de estilo"
```

---

## Task 3: Backend — endpoint para duplicar una Plantilla

**Files:**
- Modify: `app/routes/plantillas.py`

**Interfaces:**
- Consumes: `Plantilla`, `PlantillaCapa` (modelo, con las columnas de la Task 1).
- Produces: `POST /api/plantillas/<int:id>/duplicar` — consumido por la Task 7.

- [ ] **Step 1: Agregar el endpoint**

En `app/routes/plantillas.py`, agregar después de `eliminar_plantilla`:

```python
@plantillas_bp.route('/api/plantillas/<int:id>/duplicar', methods=['POST'])
def duplicar_plantilla(id):
    original = Plantilla.query.get(id)
    if not original:
        return jsonify({"mensaje": "Plantilla no encontrada"}), 404

    nombre_base = f"{original.nombre} (copia)"
    nombre_nuevo = nombre_base
    contador = 2
    while Plantilla.query.filter_by(nombre=nombre_nuevo).first():
        nombre_nuevo = f"{nombre_base} {contador}"
        contador += 1

    try:
        nueva = Plantilla(nombre=nombre_nuevo, ancho=original.ancho, alto=original.alto)
        db.session.add(nueva)
        db.session.flush()

        for capa in sorted(original.capas, key=lambda c: c.orden):
            nueva.capas.append(PlantillaCapa(
                orden=capa.orden,
                tipo=capa.tipo,
                x=capa.x,
                y=capa.y,
                ancho=capa.ancho,
                alto=capa.alto,
                archivo=capa.archivo,
                loop=capa.loop,
                campo_dato=capa.campo_dato,
                texto_fijo=capa.texto_fijo,
                fuente=capa.fuente,
                tamano_fuente=capa.tamano_fuente,
                color=capa.color,
                alineacion=capa.alineacion,
                animacion_entrada=capa.animacion_entrada,
                animacion_salida=capa.animacion_salida,
                duracion_transicion_ms=capa.duracion_transicion_ms,
                radio_esquina=capa.radio_esquina,
                color_fondo=capa.color_fondo,
                opacidad=capa.opacidad,
                color_borde=capa.color_borde,
                ancho_borde=capa.ancho_borde,
                usar_gradiente=capa.usar_gradiente,
                gradiente_color_inicio=capa.gradiente_color_inicio,
                gradiente_color_fin=capa.gradiente_color_fin,
                gradiente_angulo=capa.gradiente_angulo,
            ))

        db.session.commit()

        registrar('INFO', f'Duplicó plantilla: {original.nombre} -> {nueva.nombre}',
                  'plantilla', nueva.id, nueva.nombre)

        return jsonify({"mensaje": "Plantilla duplicada", "id": nueva.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({"mensaje": f"Error al duplicar la plantilla: {str(e)}"}), 500
```

- [ ] **Step 2: Verificar con curl**

```bash
curl -s -X POST http://127.0.0.1:5001/api/plantillas/<ID_REAL>/duplicar | python3 -m json.tool
```

Expected: 201, `{"mensaje": "Plantilla duplicada", "id": <nuevo_id>}`.

```bash
curl -s http://127.0.0.1:5001/api/plantillas/<nuevo_id> | python3 -m json.tool
```

Expected: `nombre` termina en `" (copia)"`, mismo `ancho`/`alto`, mismas capas (mismo `orden`/`tipo`/`x`/`y`/etc.) que la original, con `id`s de capa DISTINTOS a los de la original (son filas nuevas).

Repetí el POST de duplicar sobre la MISMA plantilla original una segunda vez:

```bash
curl -s -X POST http://127.0.0.1:5001/api/plantillas/<ID_REAL>/duplicar | python3 -m json.tool
```

Expected: 201, con `nombre` terminando en `" (copia) 2"` (sin colisión con la primera copia).

Limpiá las plantillas de prueba creadas si no las necesitás (`DELETE /api/plantillas/<id>` — solo funciona si no tienen Graphs asociados, lo cual es el caso de estas copias de prueba recién creadas).

- [ ] **Step 3: Commit**

```bash
git add app/routes/plantillas.py
git commit -m "feat: endpoint para duplicar una plantilla con todas sus capas"
```

---

## Task 4: Backend — exponer los campos de forma en el SSE de Graphs

**Files:**
- Modify: `app/routes/graphs.py`

**Interfaces:**
- Consumes: columnas de la Task 1.
- Produces: el array `capas` de `_resolver_capas_plantilla` (consumido por `/pantalla` y `/control_live` vía `/stream_display_config`) incluye los 9 campos nuevos para TODAS las capas (no solo `'forma'`) — consumido por la Task 5.

- [ ] **Step 1: Agregar los 9 campos al dict de cada capa resuelta**

En `app/routes/graphs.py`, dentro de `_resolver_capas_plantilla`, en el dict `capa_resuelta` (después de `"duracion_transicion_ms": capa.duracion_transicion_ms,`), agregar:

```python
            "radio_esquina": capa.radio_esquina,
            "color_fondo": capa.color_fondo,
            "opacidad": capa.opacidad,
            "color_borde": capa.color_borde,
            "ancho_borde": capa.ancho_borde,
            "usar_gradiente": capa.usar_gradiente,
            "gradiente_color_inicio": capa.gradiente_color_inicio,
            "gradiente_color_fin": capa.gradiente_color_fin,
            "gradiente_angulo": capa.gradiente_angulo,
```

Estos campos se agregan al dict base (fuera del `if capa.tipo == 'texto':`), así que aplican a las capas de imagen/video/forma también — sin cambiar el resto de la función.

- [ ] **Step 2: Verificar con curl**

Con un Graph real activo con Plantilla asignada (o activar uno de prueba temporalmente y restaurar después):

```bash
timeout 2 curl -sN http://127.0.0.1:5001/stream_display_config | head -n 2
```

Expected: cada capa del array `plantilla.capas` incluye ahora `radio_esquina`, `color_fondo`, `opacidad`, `color_borde`, `ancho_borde`, `usar_gradiente`, `gradiente_color_inicio`, `gradiente_color_fin`, `gradiente_angulo` (con los defaults `0`/`null`/`100`/`null`/`0`/`false`/`null`/`null`/`90` para capas que no son de tipo forma, ya que esas columnas tienen ese valor en la DB para capas viejas).

- [ ] **Step 3: Commit**

```bash
git add app/routes/graphs.py
git commit -m "feat: incluir campos de forma geometrica en el payload de capas del SSE"
```

---

## Task 5: Frontend — renderizar capas de tipo `'forma'` (4 lugares)

**Files:**
- Modify: `app/static/js/pantalla.js`
- Modify: `app/static/js/control_live.js`
- Modify: `app/static/js/plantillas.js`

**Interfaces:**
- Consumes: los 9 campos nuevos del payload (Task 4 para pantalla.js/control_live.js; Task 2 para plantillas.js).
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: `pantalla.js` — `crearElementoCapa`**

En `app/static/js/pantalla.js`, dentro de `crearElementoCapa`, reemplazar:

```js
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
```

por:

```js
    } else if (capa.tipo === 'video') {
        el = document.createElement('video');
        el.classList.add('capa', 'capa-media');
        el.src = `/static/${capa.archivo}`;
        el.muted = true;
        el.autoplay = true;
        el.loop = !!capa.loop;
        el.playsInline = true;
    } else if (capa.tipo === 'forma') {
        el = document.createElement('div');
        el.classList.add('capa');
        el.style.borderRadius = `${capa.radio_esquina}px`;
        el.style.opacity = capa.opacidad / 100;
        if (capa.ancho_borde > 0) {
            el.style.border = `${capa.ancho_borde}px solid ${capa.color_borde || '#000000'}`;
        }
        if (capa.usar_gradiente) {
            el.style.background = `linear-gradient(${capa.gradiente_angulo}deg, ${capa.gradiente_color_inicio}, ${capa.gradiente_color_fin})`;
        } else {
            el.style.background = capa.color_fondo || 'transparent';
        }
    } else {
        el = document.createElement('img');
        el.classList.add('capa', 'capa-media');
        el.src = `/static/${capa.archivo}`;
    }
```

- [ ] **Step 2: `control_live.js` — `crearElementoZocalo`**

Aplicar el mismo cambio (mismo bloque `else if (capa.tipo === 'forma') {...}`, adaptando la clase base a `'elemento-control'` en vez de `'capa'`) en `crearElementoZocalo`, entre la rama `'video'` y el `else` final.

- [ ] **Step 3: `control_live.js` — `crearElementoPreviewCapa`**

Mismo cambio en `crearElementoPreviewCapa`, con las clases base `'elemento-control', 'elemento-editable'` (sin agregar `'capa-media'`/`'capa-texto'`, igual que las otras ramas de esta función).

- [ ] **Step 4: `plantillas.js` — `crearElementoEditable`**

En `app/static/js/plantillas.js`, dentro de `crearElementoEditable`, reemplazar:

```js
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
```

por:

```js
    if (capa.tipo === 'imagen' && capa.archivo) {
        div.innerHTML = `<img src="/static/${capa.archivo}">`;
    } else if (capa.tipo === 'video' && capa.archivo) {
        div.innerHTML = `<video src="/static/${capa.archivo}" muted autoplay loop></video>`;
    } else if (capa.tipo === 'texto') {
        const justify = capa.alineacion === 'center' ? 'center' : (capa.alineacion === 'right' ? 'flex-end' : 'flex-start');
        const texto = capa.texto_fijo || (capa.campo_dato ? `{{${capa.campo_dato}}}` : 'Texto libre');
        div.innerHTML = `<div class="capa-texto-preview" style="font-family:${capa.fuente};font-size:${capa.tamano_fuente}px;color:${capa.color};justify-content:${justify};">${texto}</div>`;
    } else if (capa.tipo === 'forma') {
        div.style.borderRadius = `${capa.radio_esquina}px`;
        div.style.opacity = capa.opacidad / 100;
        if (capa.ancho_borde > 0) {
            div.style.borderWidth = `${capa.ancho_borde}px`;
            div.style.borderStyle = 'solid';
            div.style.borderColor = capa.color_borde || '#000000';
        }
        if (capa.usar_gradiente) {
            div.style.background = `linear-gradient(${capa.gradiente_angulo}deg, ${capa.gradiente_color_inicio}, ${capa.gradiente_color_fin})`;
        } else {
            div.style.background = capa.color_fondo || 'transparent';
        }
    } else {
        div.style.background = 'rgba(255,0,0,0.15)';
    }
```

(En `plantillas.js` el borde se setea con `border-width`/`border-style`/`border-color` por separado en vez de la propiedad corta `border`, porque `.capa-editor` ya define `border: 1px dashed rgba(0,0,0,0.4)` como estilo de EDICIÓN — sobreescribir con la propiedad corta `border` completa pisaría ese estilo de edición cuando `ancho_borde` es 0; separando las sub-propiedades, si `ancho_borde` es 0 no se tocan y el borde punteado de edición se sigue viendo.)

- [ ] **Step 5: Verificar**

```bash
node --check app/static/js/pantalla.js 2>&1 | grep -v "??"
```

Con el server corriendo y una capa de tipo `'forma'` ya guardada en una Plantilla real (de la Task 2): si hay navegador, abrir `/plantillas` y confirmar que la forma se ve con su color/borde/radio en el editor; activar un Graph con esa Plantilla y confirmar en `/pantalla` y en el preview de `/control_live` que se ve igual. Si no hay navegador, documentar en el reporte que se verificó por trace estático que los 4 bloques son equivalentes y están en el lugar correcto de cada función (antes del `else` final, después de la rama `'video'`).

- [ ] **Step 6: Commit**

```bash
git add app/static/js/pantalla.js app/static/js/control_live.js app/static/js/plantillas.js
git commit -m "feat: renderizar capas de tipo forma en salida real, preview y editor"
```

---

## Task 6: Frontend — alta y panel de propiedades de formas en el editor

**Files:**
- Modify: `app/templates/plantillas.html`
- Modify: `app/static/js/plantillas.js`

**Interfaces:**
- Consumes: `crearElementoEditable` (Task 5, ya soporta el tipo `'forma'` visualmente).
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: Agregar el botón "+ Forma"**

En `app/templates/plantillas.html`, reemplazar:

```html
                <div class="mt-2 btn-group">
                    <button class="btn btn-sm btn-outline-secondary" onclick="agregarCapa('imagen')">+ Imagen</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="agregarCapa('video')">+ Video</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="agregarCapa('texto')">+ Texto</button>
                </div>
```

por:

```html
                <div class="mt-2 btn-group">
                    <button class="btn btn-sm btn-outline-secondary" onclick="agregarCapa('imagen')">+ Imagen</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="agregarCapa('video')">+ Video</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="agregarCapa('texto')">+ Texto</button>
                    <button class="btn btn-sm btn-outline-secondary" onclick="agregarCapa('forma')">+ Forma</button>
                </div>
```

- [ ] **Step 2: Defaults al crear una capa de forma**

En `app/static/js/plantillas.js`, dentro de `agregarCapa`, reemplazar el objeto `nuevaCapa`:

```js
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
```

por:

```js
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
        radio_esquina: 0,
        color_fondo: '#ffffff',
        opacidad: 100,
        color_borde: '#000000',
        ancho_borde: 0,
        usar_gradiente: false,
        gradiente_color_inicio: '#ffffff',
        gradiente_color_fin: '#000000',
        gradiente_angulo: 90,
    };
    capas.push(nuevaCapa);
    seleccionarCapa(nuevaCapa.id);
}
```

- [ ] **Step 3: Panel de propiedades para formas**

En `app/static/js/plantillas.js`, dentro de `renderizarPanelPropiedades`, reemplazar el bloque `else` que arma `camposEspecificos` para imagen/video:

```js
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
```

por:

```js
    } else if (capa.tipo === 'forma') {
        camposEspecificos = `
            <div class="form-group mb-2">
                <label>Radio de esquina:</label>
                <input type="number" class="form-control" id="prop-radio-esquina" value="${capa.radio_esquina}">
            </div>
            <div class="form-group mb-2">
                <label>Color de fondo:</label>
                <input type="color" class="form-control" id="prop-color-fondo" value="${capa.color_fondo || '#ffffff'}">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-usar-gradiente" ${capa.usar_gradiente ? 'checked' : ''}>
                <label class="form-check-label">Usar gradiente</label>
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Color inicio</label><input type="color" class="form-control" id="prop-gradiente-inicio" value="${capa.gradiente_color_inicio || '#ffffff'}"></div>
                <div class="col-6 form-group mb-2"><label>Color fin</label><input type="color" class="form-control" id="prop-gradiente-fin" value="${capa.gradiente_color_fin || '#000000'}"></div>
            </div>
            <div class="form-group mb-2">
                <label>Ángulo del gradiente (grados):</label>
                <input type="number" class="form-control" id="prop-gradiente-angulo" value="${capa.gradiente_angulo}">
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Color de borde</label><input type="color" class="form-control" id="prop-color-borde" value="${capa.color_borde || '#000000'}"></div>
                <div class="col-6 form-group mb-2"><label>Ancho de borde</label><input type="number" class="form-control" id="prop-ancho-borde" value="${capa.ancho_borde}"></div>
            </div>
            <div class="form-group mb-2">
                <label>Opacidad (%):</label>
                <input type="number" class="form-control" id="prop-opacidad" min="0" max="100" value="${capa.opacidad}">
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
```

Y, en la sección final de `renderizarPanelPropiedades` donde se agregan los `addEventListener` (después del bloque `if (capa.tipo === 'texto') {...} else {...}` ya existente, que cubre imagen/video), agregar un bloque nuevo para `'forma'`. Reemplazar:

```js
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
```

por:

```js
    if (capa.tipo === 'texto') {
        document.getElementById('prop-campo-dato').value = capa.campo_dato || '';
        document.getElementById('prop-alineacion').value = capa.alineacion;
        document.getElementById('prop-campo-dato').addEventListener('change', (e) => actualizarCapaSeleccionada({ campo_dato: e.target.value || null }));
        document.getElementById('prop-texto-fijo').addEventListener('change', (e) => actualizarCapaSeleccionada({ texto_fijo: e.target.value }));
        document.getElementById('prop-fuente').addEventListener('change', (e) => actualizarCapaSeleccionada({ fuente: e.target.value }));
        document.getElementById('prop-tamano').addEventListener('change', (e) => actualizarCapaSeleccionada({ tamano_fuente: parseInt(e.target.value) || 24 }));
        document.getElementById('prop-color').addEventListener('change', (e) => actualizarCapaSeleccionada({ color: e.target.value }));
        document.getElementById('prop-alineacion').addEventListener('change', (e) => actualizarCapaSeleccionada({ alineacion: e.target.value }));
    } else if (capa.tipo === 'forma') {
        document.getElementById('prop-radio-esquina').addEventListener('change', (e) => actualizarCapaSeleccionada({ radio_esquina: parseInt(e.target.value) || 0 }));
        document.getElementById('prop-color-fondo').addEventListener('change', (e) => actualizarCapaSeleccionada({ color_fondo: e.target.value }));
        document.getElementById('prop-usar-gradiente').addEventListener('change', (e) => actualizarCapaSeleccionada({ usar_gradiente: e.target.checked }));
        document.getElementById('prop-gradiente-inicio').addEventListener('change', (e) => actualizarCapaSeleccionada({ gradiente_color_inicio: e.target.value }));
        document.getElementById('prop-gradiente-fin').addEventListener('change', (e) => actualizarCapaSeleccionada({ gradiente_color_fin: e.target.value }));
        document.getElementById('prop-gradiente-angulo').addEventListener('change', (e) => actualizarCapaSeleccionada({ gradiente_angulo: parseInt(e.target.value) || 0 }));
        document.getElementById('prop-color-borde').addEventListener('change', (e) => actualizarCapaSeleccionada({ color_borde: e.target.value }));
        document.getElementById('prop-ancho-borde').addEventListener('change', (e) => actualizarCapaSeleccionada({ ancho_borde: parseInt(e.target.value) || 0 }));
        document.getElementById('prop-opacidad').addEventListener('change', (e) => actualizarCapaSeleccionada({ opacidad: parseInt(e.target.value) || 0 }));
    } else {
        document.getElementById('prop-archivo').addEventListener('change', (e) => subirArchivoCapa(e.target.files[0]));
        if (capa.tipo === 'video') {
            document.getElementById('prop-loop').addEventListener('change', (e) => actualizarCapaSeleccionada({ loop: e.target.checked }));
        }
    }
```

- [ ] **Step 4: Verificar**

```bash
node --check app/static/js/plantillas.js 2>&1
```

Si hay navegador: en `/plantillas`, abrir una plantilla, click en "+ Forma", confirmar que aparece un rectángulo blanco seleccionable en el lienzo y el panel de propiedades muestra los 8 campos nuevos (radio, color de fondo, gradiente + sus 3 sub-campos, borde × 2, opacidad). Cambiar cada campo y confirmar que el lienzo refleja el cambio al instante. Si no hay navegador, verificar con curl que `POST /api/plantillas` con una capa `tipo: 'forma'` (armada manualmente con los mismos campos que produciría el frontend) se guarda sin error 400.

- [ ] **Step 5: Commit**

```bash
git add app/templates/plantillas.html app/static/js/plantillas.js
git commit -m "feat: alta y panel de propiedades de capas de forma en el editor"
```

---

## Task 7: Frontend — botón "Duplicar" en el listado de Plantillas

**Files:**
- Modify: `app/static/js/plantillas.js`

**Interfaces:**
- Consumes: `POST /api/plantillas/<id>/duplicar` (Task 3), `abrirPlantilla` (ya existente).
- Produces: nada consumido por otras tareas — última tarea del plan.

- [ ] **Step 1: Agregar el botón a cada card del listado**

En `app/static/js/plantillas.js`, dentro de `cargarListadoPlantillas`, reemplazar:

```js
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
```

por:

```js
    plantillas.forEach(p => {
        const col = document.createElement('div');
        col.className = 'col-md-3 mb-3 plantilla-existente';
        col.innerHTML = `
            <div class="card plantilla-card h-100" onclick="abrirPlantilla(${p.id})">
                <div class="card-body">
                    <h5 class="card-title">${p.nombre}</h5>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); duplicarPlantilla(${p.id})">
                        <i class="fas fa-copy"></i> Duplicar
                    </button>
                </div>
            </div>
        `;
        contenedor.appendChild(col);
    });
```

- [ ] **Step 2: Agregar la función `duplicarPlantilla`**

En `app/static/js/plantillas.js`, agregar después de `eliminarPlantillaActual`:

```js
async function duplicarPlantilla(id) {
    try {
        const response = await fetch(`/api/plantillas/${id}/duplicar`, { method: 'POST' });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al duplicar la plantilla');
        }
        const data = await response.json();
        await abrirPlantilla(data.id);
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}
```

- [ ] **Step 3: Verificar**

```bash
node --check app/static/js/plantillas.js 2>&1
curl -s http://127.0.0.1:5001/plantillas | grep -o "duplicarPlantilla\|fa-copy" | head -2
```

Si hay navegador: en `/plantillas`, click en "Duplicar" sobre una card existente (sin que se dispare `abrirPlantilla` de la card por el `stopPropagation`), confirmar que se abre directamente el editor de la copia nueva con nombre `"{original} (copia)"` y las mismas capas.

- [ ] **Step 4: Commit**

```bash
git add app/static/js/plantillas.js
git commit -m "feat: boton para duplicar una plantilla desde el listado"
```
