# Control de Graphs desde Control en Vivo (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `control_graphs.html` por completo: `/control_live/<guion_id>` pasa a mostrar, además del lienzo con Ticker/Vivo (Fase 1), un panel lateral con las notas del guion y sus Graphs, el modal de crear/editar Graph reubicado, y un panel de composición donde el operador arma qué bajada/cita/lugar/tema mostrar **antes** de ponerlo al aire con un botón explícito.

**Architecture:** El modelo `Graph` gana 4 columnas (`bajada_activa_id`, `cita_activa_id`, `mostrar_lugar`, `mostrar_tema`) que representan la composición actualmente al aire — se persisten solo al apretar "Al aire" (`PUT /graphs/activo/<id>`, extendido). `_resolver_capas_plantilla` usa esas columnas en vez de tomar siempre la primera bajada/cita, y excluye del array de capas cualquier capa de texto cuyo valor resuelto quede vacío. El preview de composición vive enteramente en memoria del navegador (`control_live.js`) hasta ese POST. El resto de la Fase 1 (lienzo, Ticker, Vivo) no se toca.

**Tech Stack:** Flask + SQLAlchemy + Alembic (migración nueva), JS vanilla + SSE, Bootstrap 4.

## Global Constraints

- No hay tests automatizados en este repo — verificación manual (`curl` para backend, navegador para frontend).
- El preview de composición (bajada/cita activa, toggles lugar/tema) es **solo en memoria** hasta apretar "Al aire" — ningún cambio en esos controles dispara un guardado por sí solo.
- "Al aire" activa el graph (desactivando cualquier otro) Y persiste la composición en una sola llamada a `PUT /graphs/activo/<id>`.
- Una bajada visible por vez, una cita visible por vez (entre todas las citas de todos los entrevistados del graph, sin elegir primero el entrevistado).
- Cualquier capa de texto de la Plantilla cuyo valor resuelto quede vacío se excluye por completo del array de capas devuelto por `_resolver_capas_plantilla` — tanto para `/pantalla` como para el preview de `/control_live`.
- `control_graphs.html`, `app/static/js/grafica.js` y la ruta `graphs.control_graphs` se eliminan al final del plan (Task 9), una vez que `control_live.html` cubre todo lo que hacían.
- Servidor de desarrollo en el puerto 5001 (el 5000 puede estar en uso por otro proceso — no tocarlo). Base de datos Postgres ya configurada y accesible.

---

## Task 1: Modelo de datos — composición del graph activo

**Files:**
- Modify: `app/models.py` (clase `Graph`)
- Create: `migrations/versions/d4e8f1a92c67_agregar_composicion_graph_activo.py`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `Graph.bajada_activa_id`, `Graph.bajada_activa` (relationship a `Bajada`), `Graph.cita_activa_id`, `Graph.cita_activa` (relationship a `Cita`), `Graph.mostrar_lugar` (bool), `Graph.mostrar_tema` (bool) — consumidos por la Task 2 (backend) y expuestos en `GET /graphs/<id>`.

- [ ] **Step 1: Agregar las columnas y relaciones a `Graph`**

En `app/models.py`, dentro de la clase `Graph` (después del bloque `plantilla_id`/`plantilla` existente, línea ~94-95), agregar:

```python
    bajada_activa_id = db.Column(db.Integer, db.ForeignKey('bajada.id', ondelete="SET NULL"), nullable=True)
    bajada_activa = db.relationship('Bajada', foreign_keys=[bajada_activa_id])

    cita_activa_id = db.Column(db.Integer, db.ForeignKey('cita.id', ondelete="SET NULL"), nullable=True)
    cita_activa = db.relationship('Cita', foreign_keys=[cita_activa_id])

    mostrar_lugar = db.Column(db.Boolean, default=True, nullable=False)
    mostrar_tema = db.Column(db.Boolean, default=True, nullable=False)
```

No toques nada más de la clase `Graph` ni de `Bajada`/`Cita` (sus `backref` existentes — `Bajada.graphs` vía `graph_bajada`, `Cita.graph`/`Graph.citas` — quedan intactos; las nuevas relaciones usan FKs distintas y no colisionan).

- [ ] **Step 2: Escribir la migración**

Crear `migrations/versions/d4e8f1a92c67_agregar_composicion_graph_activo.py`:

```python
"""agregar composicion de graph activo (bajada/cita activa, mostrar lugar/tema)

Revision ID: d4e8f1a92c67
Revises: a1f3c9d02b7e
Create Date: 2026-07-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'd4e8f1a92c67'
down_revision = 'a1f3c9d02b7e'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.add_column(sa.Column('bajada_activa_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('cita_activa_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('mostrar_lugar', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.add_column(sa.Column('mostrar_tema', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.create_foreign_key(
            'fk_graph_bajada_activa', 'bajada', ['bajada_activa_id'], ['id'], ondelete='SET NULL'
        )
        batch_op.create_foreign_key(
            'fk_graph_cita_activa', 'cita', ['cita_activa_id'], ['id'], ondelete='SET NULL'
        )


def downgrade():
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.drop_constraint('fk_graph_cita_activa', type_='foreignkey')
        batch_op.drop_constraint('fk_graph_bajada_activa', type_='foreignkey')
        batch_op.drop_column('mostrar_tema')
        batch_op.drop_column('mostrar_lugar')
        batch_op.drop_column('cita_activa_id')
        batch_op.drop_column('bajada_activa_id')
```

- [ ] **Step 3: Correr la migración y verificar**

Desde la raíz del repo, con el venv activo:

```bash
.venv/bin/python -m flask db upgrade
```

Expected: sin errores, termina en la revisión `d4e8f1a92c67`.

```bash
.venv/bin/python -c "
from run import app
with app.app_context():
    from app.models import Graph
    g = Graph.query.first()
    print('bajada_activa_id:', g.bajada_activa_id)
    print('cita_activa_id:', g.cita_activa_id)
    print('mostrar_lugar:', g.mostrar_lugar)
    print('mostrar_tema:', g.mostrar_tema)
"
```

Expected: `bajada_activa_id: None`, `cita_activa_id: None`, `mostrar_lugar: True`, `mostrar_tema: True` (defaults aplicados a filas existentes, sin errores de NOT NULL).

- [ ] **Step 4: Commit**

```bash
git add app/models.py migrations/versions/d4e8f1a92c67_agregar_composicion_graph_activo.py
git commit -m "feat: agregar bajada/cita activa y toggles de lugar/tema al modelo Graph"
```

---

## Task 2: Backend — composición del graph activo y ocultar capas vacías

**Files:**
- Modify: `app/routes/graphs.py` (`setGraphsActivo`, `obtener_graph`, `_resolver_capas_plantilla`)

**Interfaces:**
- Consumes: `Graph.bajada_activa`, `Graph.cita_activa`, `Graph.mostrar_lugar`, `Graph.mostrar_tema` (Task 1).
- Produces: `PUT /graphs/activo/<id>` acepta body opcional `{bajada_activa_id, cita_activa_id, mostrar_lugar, mostrar_tema}`. `GET /graphs/<id>` agrega `bajada_activa_id`, `cita_activa_id`, `mostrar_lugar`, `mostrar_tema`, `bajadas_detalle` (`[{id, texto}]`), `citas_detalle` (`[{id, texto, entrevistado}]`) a la respuesta — sin tocar los campos `bajadas`/`entrevistados` existentes (los sigue usando el modal de crear/editar, sin cambios). El array `capas` que devuelve `_resolver_capas_plantilla` (consumido por `/pantalla` y `/control_live` vía el mismo SSE) nunca incluye una capa de texto con valor vacío.

- [ ] **Step 1: Extender `PUT /graphs/activo/<id>`**

En `app/routes/graphs.py`, reemplazar `setGraphsActivo` completo:

```python
@graphs_bp.route('/graphs/activo/<int:id>', methods=['PUT'])
def setGraphsActivo(id):
    Graph.query.update({Graph.activo: False})
    graph = Graph.query.get(id)
    if not graph:
        return jsonify({"error": "Graph no encontrado"}), 404
    graph.activo = True

    data = request.get_json(silent=True) or {}
    if 'bajada_activa_id' in data:
        graph.bajada_activa_id = data['bajada_activa_id']
    if 'cita_activa_id' in data:
        graph.cita_activa_id = data['cita_activa_id']
    if 'mostrar_lugar' in data:
        graph.mostrar_lugar = bool(data['mostrar_lugar'])
    if 'mostrar_tema' in data:
        graph.mostrar_tema = bool(data['mostrar_tema'])

    db.session.commit()

    registrar('INFO',
              f'Activó graph: {graph.lugar}',
              'graph', id, graph.lugar)

    return jsonify({"mensaje": "Graph activo actualizado"})
```

- [ ] **Step 2: Extender `GET /graphs/<id>`**

En `app/routes/graphs.py`, dentro de `obtener_graph`, reemplazar el `return jsonify({...})`:

```python
        return jsonify({
            "id": graph.id,
            "lugar": graph.lugar or "",
            "tema": graph.tema or "",
            "texto_id": graph.texto_id,
            "activo": graph.activo,
            "plantilla_id": graph.plantilla_id,
            "bajadas": [b.texto for b in bajadas_ordenadas],
            "bajadas_detalle": [{"id": b.id, "texto": b.texto} for b in bajadas_ordenadas],
            "entrevistados": [
                {"nombre": nombre, "citas": citas}
                for nombre, citas in entrevistados_dict.items()
            ],
            "citas_detalle": [
                {"id": c.id, "texto": c.texto, "entrevistado": c.entrevistado.nombre}
                for c in citas_ordenadas
            ],
            "bajada_activa_id": graph.bajada_activa_id,
            "cita_activa_id": graph.cita_activa_id,
            "mostrar_lugar": graph.mostrar_lugar,
            "mostrar_tema": graph.mostrar_tema,
        })
```

- [ ] **Step 3: Reescribir `_resolver_capas_plantilla`**

En `app/routes/graphs.py`, reemplazar la función completa:

```python
def _resolver_capas_plantilla(graph_activo):
    if not graph_activo or not graph_activo.plantilla:
        return None

    bajada_texto = graph_activo.bajada_activa.texto if graph_activo.bajada_activa else ""
    cita_activa = graph_activo.cita_activa
    entrevistado_texto = cita_activa.entrevistado.nombre if cita_activa else ""
    cita_texto = cita_activa.texto if cita_activa else ""

    valores_por_campo = {
        'lugar': (graph_activo.lugar or "") if graph_activo.mostrar_lugar else "",
        'tema': (graph_activo.tema or "") if graph_activo.mostrar_tema else "",
        'entrevistado': entrevistado_texto,
        'cita': cita_texto,
        'bajada_1': bajada_texto,
        'bajada_2': "",
    }

    plantilla = graph_activo.plantilla
    capas = []
    for capa in sorted(plantilla.capas, key=lambda c: c.orden):
        valor = None
        if capa.tipo == 'texto':
            valor = valores_por_campo.get(capa.campo_dato, capa.texto_fijo or "")
            if not valor:
                continue

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
            capa_resuelta["valor"] = valor
        capas.append(capa_resuelta)

    return {"id": plantilla.id, "ancho": plantilla.ancho, "alto": plantilla.alto, "capas": capas}
```

- [ ] **Step 4: Verificar con curl**

Con el server corriendo en el puerto 5001 y al menos un `Graph` existente con bajadas y citas (usar uno real de la DB; conseguir un id con `curl -s http://127.0.0.1:5001/textos | python3 -m json.tool | grep -A2 '"graphs"'`):

```bash
# Activar el graph SIN composición (bajada/cita activa quedan en null)
curl -s -X PUT http://127.0.0.1:5001/graphs/activo/<ID> -H "Content-Type: application/json" -d '{}'
curl -s http://127.0.0.1:5001/graphs/<ID> | python3 -m json.tool
```

Expected: `bajada_activa_id: null`, `cita_activa_id: null`, `mostrar_lugar: true`, `mostrar_tema: true`, `bajadas_detalle`/`citas_detalle` presentes con `id`/`texto`.

```bash
timeout 2 curl -sN http://127.0.0.1:5001/stream_display_config | head -n 2
```

Expected: si el graph no tiene `bajada_activa`/`cita_activa` seteadas, las capas de `bajada_1`/`entrevistado`/`cita` NO aparecen en el array `plantilla.capas` del evento (quedaron vacías → excluidas). Si la plantilla del graph tiene una capa de `lugar` con dato, esa SÍ aparece (mostrar_lugar es true por default).

```bash
# Tomar un id de bajada_detalle y uno de citas_detalle del paso anterior
curl -s -X PUT http://127.0.0.1:5001/graphs/activo/<ID> -H "Content-Type: application/json" \
  -d '{"bajada_activa_id": <BAJADA_ID>, "cita_activa_id": <CITA_ID>, "mostrar_lugar": false}'
timeout 2 curl -sN http://127.0.0.1:5001/stream_display_config | head -n 2
```

Expected: ahora la capa `bajada_1` trae el texto de esa bajada, `entrevistado`/`cita` traen los de esa cita, y la capa de `lugar` (si existía) ya NO aparece en el array (mostrar_lugar es false).

- [ ] **Step 5: Commit**

```bash
git add app/routes/graphs.py
git commit -m "feat: componer graph activo (bajada/cita activa, toggles lugar/tema) y ocultar capas vacias"
```

---

## Task 3: Salida — remover del DOM las capas que quedan vacías (`pantalla.js`)

**Files:**
- Modify: `app/static/js/pantalla.js`

**Interfaces:**
- Consumes: el array `plantilla.capas` del SSE ya no incluye capas de texto vacías (Task 2) — puede tener MENOS elementos que en el ciclo anterior aunque `plantilla.id` no cambie.
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: Reescribir `actualizarTextos` para reconciliar el DOM contra el array nuevo**

En `app/static/js/pantalla.js`, reemplazar la función `actualizarTextos` completa:

```js
function actualizarTextos(plantillaData) {
    const root = document.getElementById('overlay-root');
    const idsNuevos = new Set(plantillaData.capas.map(c => c.id));

    document.querySelectorAll('#overlay-root .capa').forEach(el => {
        const capaId = Number(el.id.replace('capa-', ''));
        if (idsNuevos.has(capaId)) return;

        const capaVieja = capasActuales.find(c => c.id === capaId);
        const duracion = capaVieja ? (capaVieja.duracion_transicion_ms || 400) : 400;
        const animacion = capaVieja ? capaVieja.animacion_salida : 'none';
        if (animacion && animacion !== 'none') {
            el.style.setProperty('--dur', `${duracion}ms`);
            el.classList.add(`anim-${animacion}-exit`);
            setTimeout(() => el.remove(), duracion);
        } else {
            el.remove();
        }
    });

    plantillaData.capas.forEach(capa => {
        const elExistente = document.getElementById(`capa-${capa.id}`);
        if (elExistente) {
            if (capa.tipo === 'texto') elExistente.textContent = capa.valor || '';
            return;
        }
        const elNuevo = crearElementoCapa(capa);
        root.appendChild(elNuevo);
        if (capa.animacion_entrada && capa.animacion_entrada !== 'none') {
            elNuevo.style.setProperty('--dur', `${capa.duracion_transicion_ms}ms`);
            elNuevo.classList.add(`anim-${capa.animacion_entrada}-enter`);
        }
    });
}
```

Esta función ahora maneja 3 casos en una sola pasada: capas que desaparecieron (removidas del DOM con animación de salida), capas que ya estaban y siguen (solo se actualiza el texto), y capas nuevas que antes no estaban por estar vacías y ahora tienen valor (se crean y animan de entrada). No toques `crearElementoCapa`, `renderizarPlantilla`, `aplicarAnimacion`, ni el resto de `updateDisplay` — siguen igual.

- [ ] **Step 2: Verificar con curl + inspección de código**

No hay tests automatizados. Con el server corriendo en el puerto 5001:

```bash
node --check app/static/js/pantalla.js && echo "sintaxis OK"
```

Si hay herramienta de navegador: activar un graph con `bajada_activa_id`/`cita_activa_id` seteados (Task 2, Step 4), abrir `/pantalla`, confirmar que las capas de bajada/entrevistado/cita aparecen. Luego hacer `PUT /graphs/activo/<id>` de nuevo con `bajada_activa_id: null` y confirmar que esa capa desaparece de `/pantalla` con su animación de salida (no queda huérfana ni con el texto viejo). Si no hay navegador, documentar en el reporte que se verificó por trace estático del código (comparación de sets de ids, reflow de animación, remoción con `setTimeout`).

- [ ] **Step 3: Commit**

```bash
git add app/static/js/pantalla.js
git commit -m "fix: remover del DOM las capas que quedan vacias, con su animacion de salida"
```

---

## Task 4: Editor de Plantillas — nuevo campo `cita`

**Files:**
- Modify: `app/static/js/plantillas.js`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: capas de tipo texto pueden vincularse a `campo_dato: 'cita'` — consumido por `_resolver_capas_plantilla` (Task 2, ya implementada, ya soporta esta clave).

- [ ] **Step 1: Agregar la opción al select**

En `app/static/js/plantillas.js`, dentro de `renderizarPanelPropiedades`, reemplazar:

```js
                <select class="form-control" id="prop-campo-dato">
                    <option value="">Texto libre</option>
                    <option value="lugar">Lugar</option>
                    <option value="tema">Tema</option>
                    <option value="entrevistado">Entrevistado</option>
                    <option value="bajada_1">Bajada 1</option>
                    <option value="bajada_2">Bajada 2</option>
                </select>
```

por:

```js
                <select class="form-control" id="prop-campo-dato">
                    <option value="">Texto libre</option>
                    <option value="lugar">Lugar</option>
                    <option value="tema">Tema</option>
                    <option value="entrevistado">Entrevistado</option>
                    <option value="cita">Cita</option>
                    <option value="bajada_1">Bajada 1</option>
                    <option value="bajada_2">Bajada 2</option>
                </select>
```

- [ ] **Step 2: Verificar**

Con el server corriendo, abrir `/plantillas`, editar una plantilla, agregar una capa de texto, y confirmar que el select "Vincular a" tiene la opción "Cita". Si no hay navegador, `curl -s http://127.0.0.1:5001/static/js/plantillas.js | grep 'value="cita"'` debe devolver la línea agregada.

- [ ] **Step 3: Commit**

```bash
git add app/static/js/plantillas.js
git commit -m "feat: agregar campo Cita al editor de plantillas"
```

---

## Task 5: Ruta — `/control_live/<guion_id>`

**Files:**
- Modify: `app/routes/main.py`

**Interfaces:**
- Consumes: `Guion` (modelo ya existente).
- Produces: `GET /control_live/<int:guion_id>` — 404 si el guion no existe, si no `render_template('control_live.html', guion=guion)`. Consumido por la Task 6 (el template necesita `guion.id`/`guion.nombre`).

- [ ] **Step 1: Extender la ruta**

En `app/routes/main.py`, agregar el import y reemplazar la función `control_live`:

```python
# app/routes/main.py
from flask import Blueprint, render_template
from app import MUSICA_OPCIONES  # Importar la variable
from ..models import Guion

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


@main_bp.route('/control_live/<int:guion_id>')
def control_live(guion_id):
    guion = Guion.query.get(guion_id)
    if not guion:
        return "Guion no encontrado", 404
    return render_template('control_live.html', guion=guion)
```

- [ ] **Step 2: Verificar con curl**

Con el server corriendo en el puerto 5001:

```bash
curl -s -o /dev/null -w "guion existente: %{http_code}\n" http://127.0.0.1:5001/control_live/<ID_VALIDO>
curl -s -o /dev/null -w "guion inexistente: %{http_code}\n" http://127.0.0.1:5001/control_live/999999
curl -s -o /dev/null -w "ruta vieja sin id: %{http_code}\n" http://127.0.0.1:5001/control_live
```

Expected: `200`, `404`, `404` (la ruta vieja sin id ya no matchea ningún endpoint).

Nota: en este punto `control_live.html` todavía no usa `guion` en su contenido (eso es la Task 6) — el `render_template` no falla igual porque Jinja no exige que una variable pasada se use.

- [ ] **Step 3: Commit**

```bash
git add app/routes/main.py
git commit -m "feat: control_live pasa a depender de un guion"
```

---

## Task 6: Panel lateral — notas y Graphs del guion

**Files:**
- Modify: `app/templates/control_live.html`
- Modify: `app/static/js/control_live.js`

**Interfaces:**
- Consumes: `GET /textos` (ya existente, trae `graphs` anidados por texto — mismo patrón que usaba `grafica.js`), `guion` (Task 5, disponible en el template).
- Produces: función `cargarNotasYGraphs()` y función global `seleccionarGraph(id)` (placeholder que por ahora solo loguea — la Task 8 la reemplaza por completo con la lógica real del panel de composición). Las funciones `editarGraph`/`eliminarGraph`/`abrirModalGraph` referenciadas en el HTML generado son provistas por la Task 7 (todavía no existen al terminar esta tarea — es esperado, no rompe nada mientras no se haga click en esos botones).

- [ ] **Step 1: Agregar la columna del panel lateral y el div de datos del guion**

En `app/templates/control_live.html`, reemplazar el bloque `{% block body %}` completo:

```html
{% block body %}
<div class="container-fluid mt-4">
    <h2>Control en vivo</h2>
    <div id="guion-data" data-guion-id="{{ guion.id }}"></div>
    <div class="row">
        <div class="col-md-2">
            <div class="card p-2" style="max-height: 80vh; overflow-y: auto;">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <h6 class="mb-0">{{ guion.nombre }}</h6>
                    <button class="btn btn-sm btn-outline-secondary" onclick="ExportarGraphsXML()" title="Exportar XML">
                        <i class="fas fa-file-export"></i>
                    </button>
                </div>
                <div id="lista-notas"></div>
            </div>
        </div>
        <div class="col-md-7">
            <div id="lienzo-wrapper">
                <div id="lienzo-control"></div>
            </div>
        </div>
        <div class="col-md-3">
            <div id="panel-propiedades-control" class="card p-3">
                <p class="text-muted">Seleccioná el ticker, el badge Vivo o un graph para editar sus propiedades.</p>
            </div>
        </div>
    </div>
</div>
{% endblock body %}
```

(Cambios respecto a la Fase 1: se agrega `#guion-data`, la columna `col-md-2` nueva, `col-md-9` del lienzo pasa a `col-md-7`, y el texto de placeholder del panel derecho se actualiza para mencionar también los graphs.)

- [ ] **Step 2: Agregar la carga y el renderizado del panel lateral**

En `app/static/js/control_live.js`, agregar al final del archivo:

```js
const guionId = document.getElementById('guion-data').getAttribute('data-guion-id');

async function cargarNotasYGraphs() {
    try {
        const response = await fetch('/textos');
        const textos = await response.json();
        const textosFiltrados = textos
            .filter(t => t.guion_id == guionId)
            .sort((a, b) => a.numero_de_nota - b.numero_de_nota);

        const contenedor = document.getElementById('lista-notas');
        contenedor.innerHTML = '';

        textosFiltrados.forEach(t => {
            const notaDiv = document.createElement('div');
            notaDiv.className = 'mb-2 border-bottom pb-2';

            const graphsHtml = (t.graphs || []).map(g => `
                <div class="d-flex justify-content-between align-items-center small ${g.activo ? 'bg-warning' : ''} p-1 rounded">
                    <span style="cursor:pointer;" onclick="seleccionarGraph(${g.id})">${g.lugar || '(sin lugar)'}${g.tema ? ' — ' + g.tema : ''}</span>
                    <span>
                        <button class="btn btn-sm btn-outline-secondary" onclick="editarGraph(${g.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarGraph(${g.id})"><i class="fas fa-trash"></i></button>
                    </span>
                </div>
            `).join('');

            notaDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <strong>#${t.numero_de_nota} ${t.titulo}</strong>
                    <button class="btn btn-sm btn-outline-primary" onclick="abrirModalGraph(${t.id})"><i class="fas fa-plus"></i></button>
                </div>
                ${graphsHtml}
            `;
            contenedor.appendChild(notaDiv);
        });
    } catch (error) {
        console.error('Error al cargar notas y graphs:', error);
    }
}

function seleccionarGraph(id) {
    console.log('seleccionarGraph pendiente de implementación completa (Task 8):', id);
}

document.addEventListener('DOMContentLoaded', () => {
    cargarNotasYGraphs();
    setInterval(cargarNotasYGraphs, 1000);
});
```

Este es un segundo `DOMContentLoaded` listener, independiente del que ya existe (con `cargarConfig`/`setupEventSource`/el listener de click del lienzo) — JS permite múltiples listeners para el mismo evento, no hace falta fusionarlos.

- [ ] **Step 3: Verificar con curl + navegador si está disponible**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5001/control_live/<ID_VALIDO>
curl -s http://127.0.0.1:5001/control_live/<ID_VALIDO> | grep -o 'lista-notas\|guion-data'
```

Expected: `200`, ambos ids presentes en el HTML.

Si hay navegador: abrir `/control_live/<id>` de un guion con notas y graphs, confirmar que el panel izquierdo lista las notas con número/título y, debajo, sus graphs (lugar/tema). Click en "Editar"/"+"/eliminar no van a funcionar todavía (es esperado, la Task 7 los agrega) — no debería haber errores de JS por *funciones no definidas* hasta que se haga click en esos botones específicos (el `onclick` con una función inexistente solo falla al ejecutarse, no al renderizar el HTML).

- [ ] **Step 4: Commit**

```bash
git add app/templates/control_live.html app/static/js/control_live.js
git commit -m "feat: panel lateral de notas y graphs en control_live"
```

---

## Task 7: Modal de crear/editar Graph — reubicado

**Files:**
- Modify: `app/templates/control_live.html`
- Modify: `app/static/js/graphs.js`

**Interfaces:**
- Consumes: `#guion-data[data-guion-id]` (Task 6), `cargarNotasYGraphs()` (Task 6).
- Produces: `guardarGraph`, `agregarNoCerrar`, `editarGraph`, `eliminarGraph`, `cancelarEdicionGraph`, `agregarBajada`, `removerBajada`, `agregarEntrevistado`, `agregarCita`, `removerCita`, `removerEntrevistado`, `ExportarGraphsXML`, `abrirModalGraph` — mismas funciones que ya existían en `control_graphs.html`/`graphs.js`, ahora servidas desde `control_live.html`. Consumidas por los `onclick` que la Task 6 ya generó en el panel lateral.

- [ ] **Step 1: Agregar el modal al template y cargar `graphs.js`**

En `app/templates/control_live.html`, agregar el modal completo (copiado tal cual de `control_graphs.html`, sin cambios) justo antes de `{% endblock body %}`:

```html
    <!-- Modal para el formulario de Graph -->
    <div class="modal fade bd-example-modal-lg" id="formularioGraphModal" tabindex="-1" role="dialog"
         aria-labelledby="formularioGraphModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header text-white bg-primary">
                    <h5 class="modal-title" id="formularioGraphModalLabel">Carga de Graphs</h5>
                    <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
                <div class="modal-body">
                    <form id="formularioGraph" onsubmit="guardarGraph(event)">
                        <input type="hidden" id="graph_id" value="">
                        <div class="form-group mb-3">
                            <label for="texto_id">Nota:</label>
                            <select class="form-control" id="texto_id" required>
                            </select>
                        </div>
                        <div class="row p-0 m-0">
                            <div class="col-6 p-0 m-0">
                                <input type="text" class="form-control m-0" id="lugar" placeholder="Lugar">
                                <input type="text" class="form-control m-0" id="tema" placeholder="Tema">
                            </div>
                            <div class="col-6 p-0 m-0">
                                <input type="text" class="form-control m-0" id="entrevistado"
                                       placeholder="Entrevistado">
                                <div class="form-group m-0 mt-2">
                                    <label for="plantilla_id" class="mb-0">Plantilla:</label>
                                    <select class="form-control" id="plantilla_id">
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div id="bajadas-container"></div>
                        <button type="button" class="btn btn-sm btn-outline-secondary mb-2" onclick="agregarBajada()">
                            <i class="fas fa-plus"></i> Añadir bajada
                        </button>
                        <div id="entrevistados-container"></div>
                        <button type="button" class="btn btn-sm btn-outline-secondary mb-2" onclick="agregarEntrevistado()">
                            <i class="fas fa-plus"></i> Añadir entrevistado
                        </button>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="submit" class="btn btn-outline-success" id="botonGuardarGraph" form="formularioGraph">
                        Guardar y cerrar
                    </button>
                    <button type="button" class="btn btn-outline-success" onclick="agregarNoCerrar(event)"
                            id="agregarNoCerrar"><i class="fas fa-plus"></i>&nbsp;Agregar
                    </button>
                    <button type="button" class="btn btn-outline-danger" onclick="cancelarEdicionGraph()"
                            id="botonCancelarGraph" style="display: none;">Cancelar
                    </button>
                </div>
            </div>
        </div>
    </div>
{% endblock body %}
```

Nota: `control_graphs.html` tenía además los campos legacy `#primera_linea`/`#segunda_linea` (sin `bajadas-container`/`entrevistados-container` propiamente dichos en el HTML estático — esos contenedores se poblaban dinámicamente por `graphs.js`/`cancelarEdicionGraph`). Se incluyen acá `#bajadas-container` y `#entrevistados-container` explícitos (que `agregarBajada()`/`agregarEntrevistado()` ya esperan por `getElementById`) en vez de los campos legacy `primera_linea`/`segunda_linea`, que no los usa ninguna función real de `graphs.js` (`guardarGraph` solo lee `.bajada-input`/`.entrevistado-group`, nunca esos dos ids) — se dejan fuera de la reubicación como limpieza de HTML muerto.

Agregar el script en el bloque `extra_script` (después del script de `control_live.js` ya existente):

```html
{% block extra_script %}
<script src="{{ url_for('static', filename='js/control_live.js') }}"></script>
<script src="{{ url_for('static', filename='js/graphs.js') }}"></script>
{% endblock extra_script %}
```

- [ ] **Step 2: Ajustar `graphs.js` para no depender de `seleccionarGuion`/`#guion_id`**

En `app/static/js/graphs.js`, hay 3 bloques idénticos (dentro de `guardarGraph`, `agregarNoCerrar`, `eliminarGraph`) con esta forma:

```js
        // Recargar la lista de graphs
        const guion_id = document.getElementById('guion_id').value;
        if (guion_id) {
            await seleccionarGuion(guion_id);
        }
```

Reemplazar los 3 por:

```js
        // Recargar la lista de graphs
        await cargarNotasYGraphs();
```

(En `eliminarGraph` no lleva `await` delante en el original salvo que ya esté en una función `async` — confirmá que la línea que reemplazás mantiene el mismo `await`/no-`await` que tenía el bloque original en cada uno de los 3 sitios; las 3 funciones ya son `async function`, así que `await cargarNotasYGraphs()` es válido en los 3.)

No toques ninguna otra parte de `graphs.js` — `cargarPlantillasSelect`, `editarGraph`, `cancelarEdicionGraph`, `agregarBajada`, etc. quedan exactamente igual.

- [ ] **Step 3: Verificar con navegador o curl**

```bash
node --check app/static/js/graphs.js && echo "sintaxis OK"
curl -s http://127.0.0.1:5001/control_live/<ID_VALIDO> | grep -o 'formularioGraphModal'
```

Si hay navegador: abrir `/control_live/<id>`, click en "+" de una nota → se abre el modal con esa nota preseleccionada. Guardar un graph nuevo con lugar/tema/una bajada → confirmar que aparece en el panel lateral sin recargar la página (gracias al polling de `cargarNotasYGraphs`). Editar un graph existente → confirmar que el modal se puebla con sus datos y que guardar actualiza el panel. Eliminar un graph → confirma que desaparece del panel.

- [ ] **Step 4: Commit**

```bash
git add app/templates/control_live.html app/static/js/graphs.js
git commit -m "feat: reubicar el modal de crear/editar graph en control_live"
```

---

## Task 8: Panel de composición y botón "Al aire"

**Files:**
- Modify: `app/static/js/control_live.js`

**Interfaces:**
- Consumes: `GET /graphs/<id>` (Task 2, trae `bajadas_detalle`/`citas_detalle`/`bajada_activa_id`/`cita_activa_id`/`mostrar_lugar`/`mostrar_tema`), `PUT /graphs/activo/<id>` (Task 2), `seleccionarElemento`/`renderizarPanelPropiedades`/`renderizarLienzo` (Fase 1, ya existentes).
- Produces: reemplaza el `seleccionarGraph(id)` placeholder de la Task 6 por la implementación real. Modifica `seleccionarElemento` y el inicio de `renderizarPanelPropiedades` (ambas de la Fase 1) para coordinar cuál panel se muestra.

- [ ] **Step 1: Reemplazar el `seleccionarGraph` placeholder por la carga real**

En `app/static/js/control_live.js`, reemplazar:

```js
function seleccionarGraph(id) {
    console.log('seleccionarGraph pendiente de implementación completa (Task 8):', id);
}
```

por:

```js
let graphComposicionId = null;
let composicion = null;

async function seleccionarGraph(id) {
    const response = await fetch(`/graphs/${id}`);
    if (!response.ok) return;
    const graph = await response.json();

    graphComposicionId = id;
    composicion = {
        lugar: graph.lugar,
        tema: graph.tema,
        bajadas: graph.bajadas_detalle,
        citas: graph.citas_detalle,
        bajada_activa_id: graph.bajada_activa_id,
        cita_activa_id: graph.cita_activa_id,
        mostrar_lugar: graph.mostrar_lugar,
        mostrar_tema: graph.mostrar_tema,
    };

    elementoSeleccionado = null;
    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

- [ ] **Step 2: Coordinar la selección con el Ticker/Vivo (Fase 1)**

En `app/static/js/control_live.js`, la función `seleccionarElemento` (ya existente desde la Fase 1) pasa de:

```js
function seleccionarElemento(nombre) {
    elementoSeleccionado = nombre;
    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

a:

```js
function seleccionarElemento(nombre) {
    graphComposicionId = null;
    elementoSeleccionado = nombre;
    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

- [ ] **Step 3: Delegar `renderizarPanelPropiedades` al panel de composición cuando corresponda**

En `app/static/js/control_live.js`, la función `renderizarPanelPropiedades` (ya existente, con los casos `'ticker'`/`'live'`/fallback de la Fase 1) gana un chequeo al principio:

```js
function renderizarPanelPropiedades() {
    const panel = document.getElementById('panel-propiedades-control');

    if (graphComposicionId) {
        renderizarPanelComposicion();
        return;
    }

    if (elementoSeleccionado === 'ticker') {
```

(El resto de la función — los bloques `'ticker'`/`'live'`/fallback — sigue exactamente igual, solo se le agrega este chequeo al principio, antes del primer `if`.)

- [ ] **Step 4: Implementar `renderizarPanelComposicion` y `enviarAlAire`**

En `app/static/js/control_live.js`, agregar al final del archivo:

```js
function renderizarPanelComposicion() {
    const panel = document.getElementById('panel-propiedades-control');
    if (!composicion) return;

    const bajadasHtml = composicion.bajadas.map(b => `
        <div class="form-check">
            <input type="radio" class="form-check-input" name="bajada-activa" id="bajada-${b.id}"
                   value="${b.id}" ${composicion.bajada_activa_id === b.id ? 'checked' : ''}>
            <label class="form-check-label" for="bajada-${b.id}">${b.texto}</label>
        </div>
    `).join('');

    const citasHtml = composicion.citas.map(c => `
        <div class="form-check">
            <input type="radio" class="form-check-input" name="cita-activa" id="cita-${c.id}"
                   value="${c.id}" ${composicion.cita_activa_id === c.id ? 'checked' : ''}>
            <label class="form-check-label" for="cita-${c.id}">${c.entrevistado}: "${c.texto}"</label>
        </div>
    `).join('');

    panel.innerHTML = `
        <h6>Graph: ${composicion.lugar || '(sin lugar)'}</h6>
        <div class="form-check mb-2">
            <input type="checkbox" class="form-check-input" id="comp-mostrar-lugar" ${composicion.mostrar_lugar ? 'checked' : ''}>
            <label class="form-check-label" for="comp-mostrar-lugar">Mostrar lugar (${composicion.lugar || '—'})</label>
        </div>
        <div class="form-check mb-3">
            <input type="checkbox" class="form-check-input" id="comp-mostrar-tema" ${composicion.mostrar_tema ? 'checked' : ''}>
            <label class="form-check-label" for="comp-mostrar-tema">Mostrar tema (${composicion.tema || '—'})</label>
        </div>
        <div class="mb-3">
            <label class="d-block"><strong>Bajada activa</strong></label>
            <div class="form-check">
                <input type="radio" class="form-check-input" name="bajada-activa" id="bajada-ninguna"
                       value="" ${!composicion.bajada_activa_id ? 'checked' : ''}>
                <label class="form-check-label" for="bajada-ninguna">Ninguna</label>
            </div>
            ${bajadasHtml}
        </div>
        <div class="mb-3">
            <label class="d-block"><strong>Cita activa</strong></label>
            <div class="form-check">
                <input type="radio" class="form-check-input" name="cita-activa" id="cita-ninguna"
                       value="" ${!composicion.cita_activa_id ? 'checked' : ''}>
                <label class="form-check-label" for="cita-ninguna">Ninguna</label>
            </div>
            ${citasHtml}
        </div>
        <button class="btn btn-primary btn-block" id="btn-al-aire">Al aire</button>
    `;

    document.getElementById('comp-mostrar-lugar').addEventListener('change', (e) => {
        composicion.mostrar_lugar = e.target.checked;
    });
    document.getElementById('comp-mostrar-tema').addEventListener('change', (e) => {
        composicion.mostrar_tema = e.target.checked;
    });
    document.querySelectorAll('input[name="bajada-activa"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            composicion.bajada_activa_id = e.target.value ? parseInt(e.target.value) : null;
        });
    });
    document.querySelectorAll('input[name="cita-activa"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            composicion.cita_activa_id = e.target.value ? parseInt(e.target.value) : null;
        });
    });
    document.getElementById('btn-al-aire').addEventListener('click', enviarAlAire);
}

async function enviarAlAire() {
    if (!graphComposicionId) return;
    try {
        await fetch(`/graphs/activo/${graphComposicionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bajada_activa_id: composicion.bajada_activa_id,
                cita_activa_id: composicion.cita_activa_id,
                mostrar_lugar: composicion.mostrar_lugar,
                mostrar_tema: composicion.mostrar_tema,
            })
        });
    } catch (error) {
        console.error('Error al enviar al aire:', error);
    }
}
```

Ningún cambio en estos controles (radios, checkboxes) llama a `guardarSeccion`, `fetch`, ni ninguna función de red — solo mutan el objeto `composicion` en memoria. La única llamada de red de este panel es `enviarAlAire`, disparada exclusivamente por el click en "Al aire".

- [ ] **Step 5: Verificar de punta a punta**

Con el server corriendo en el puerto 5001 y, si es posible, navegador:

1. Abrir `/control_live/<id>`, click en un graph del panel lateral → aparece el panel de composición con sus bajadas/citas y toggles.
2. Elegir una bajada distinta a la actual, sin apretar "Al aire" → `curl -s http://127.0.0.1:5001/graphs/<graph_id>` debe seguir mostrando el `bajada_activa_id` viejo (nada se guardó todavía).
3. Apretar "Al aire" → el mismo curl ahora muestra el `bajada_activa_id` nuevo, y `curl -sN http://127.0.0.1:5001/stream_display_config | head -n 2` (con timeout) muestra esa bajada en el array de capas.
4. Click en el Ticker o el badge Vivo (Fase 1) mientras había un graph seleccionado → el panel cambia al de Ticker/Vivo correctamente (confirma que `seleccionarElemento` resetea `graphComposicionId`).

Si no hay navegador, hacer los pasos 2-3 completos por curl (son 100% verificables sin UI) y documentar en el reporte que el paso 1/4 (selección visual, cambio de panel) se verificó por trace estático del código.

- [ ] **Step 6: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: panel de composicion del graph (bajada/cita activa, toggles) y boton Al aire"
```

---

## Task 9: Limpieza — eliminar `control_graphs.html` y `grafica.js`

**Files:**
- Delete: `app/templates/control_graphs.html`
- Delete: `app/static/js/grafica.js`
- Modify: `app/routes/graphs.py` (eliminar la ruta `control_graphs`)
- Modify: `app/templates/listado_guiones.html` (actualizar los 2 links)

**Interfaces:**
- Consumes: `main.control_live` (Task 5) debe estar completamente funcional antes de esta tarea (última del plan).
- Produces: nada consumido por otras tareas — es la última.

- [ ] **Step 1: Eliminar los archivos**

```bash
git rm app/templates/control_graphs.html app/static/js/grafica.js
```

- [ ] **Step 2: Eliminar la ruta `control_graphs`**

En `app/routes/graphs.py`, eliminar el bloque completo:

```python
@graphs_bp.route('/control_graphs/<int:id>')
def control_graphs(id):
    guion = Guion.query.get(id)
    if guion:
        return render_template('control_graphs.html', guion=guion)
    return "Guion no encontrado", 404
```

No toques nada más de `graphs.py`. `Guion` puede quedar sin usarse en el resto del archivo tras este borrado — si `from ..models import ... Guion ...` (línea 12) ya no se usa en ningún otro punto del archivo, quitalo del import; si se sigue usando en otra función, dejalo.

- [ ] **Step 3: Actualizar `listado_guiones.html`**

En `app/templates/listado_guiones.html`, reemplazar las 2 ocurrencias de:

```html
                            <a href="{{ url_for('graphs.control_graphs', id=guion.id) }}"
                               class="btn btn-outline-secondary btn-sm">
                                <i class="fas fa-broadcast-tower"></i>
                            </a>
```

(vista desktop) por:

```html
                            <a href="{{ url_for('main.control_live', guion_id=guion.id) }}"
                               class="btn btn-outline-secondary btn-sm">
                                <i class="fas fa-broadcast-tower"></i>
                            </a>
```

y la de la vista mobile (mismo cambio, sin `btn-sm`):

```html
                    <a href="{{ url_for('graphs.control_graphs', id=guion.id) }}"
                       class="btn btn-outline-secondary">
                        <i class="fas fa-broadcast-tower"></i>
                    </a>
```

por:

```html
                    <a href="{{ url_for('main.control_live', guion_id=guion.id) }}"
                       class="btn btn-outline-secondary">
                        <i class="fas fa-broadcast-tower"></i>
                    </a>
```

- [ ] **Step 4: Verificar**

```bash
curl -s -o /dev/null -w "control_graphs (debe ser 404): %{http_code}\n" http://127.0.0.1:5001/control_graphs/1
curl -s -o /dev/null -w "control_live nuevo: %{http_code}\n" http://127.0.0.1:5001/control_live/<ID_VALIDO>
curl -s http://127.0.0.1:5001/listado_guiones | grep -o "main.control_live\|control_live/[0-9]*" | head -5
.venv/bin/python -c "from app import create_app; create_app(); print('OK: la app importa sin errores')"
```

Expected: `404` para la ruta vieja, `200` para la nueva, el listado ya no referencia `control_graphs`, y la app importa sin `ImportError`/`NameError` (confirma que ningún template roto o import huérfano quedó colgado).

- [ ] **Step 5: Commit**

```bash
git add app/routes/graphs.py app/templates/listado_guiones.html
git commit -m "chore: eliminar control_graphs.html y grafica.js, reemplazados por control_live"
```
