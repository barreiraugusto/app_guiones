# Rotación automática de bajadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir reproducir en secuencia automática las bajadas de un
graph (Play/Stop/Loop + duración configurable), con el cálculo hecho en el
backend a partir del tiempo transcurrido para que sobreviva a cerrar la
pestaña de `control_live`.

**Architecture:** Nuevas columnas en `Graph` (estado de la rotación:
activo/loop/duración/epoch de inicio/índice de inicio) + un endpoint nuevo
para controlarlas, independiente del endpoint existente de "Al aire". La
función que arma lo que sale al aire (`_resolver_capas_plantilla`) calcula
la bajada efectiva a partir del tiempo transcurrido en vez de leer
`bajada_activa_id` directo cuando la rotación está activa. El editor
replica la misma fórmula del lado del cliente solo para refrescar su propio
preview cada segundo (la fuente de verdad sigue siendo el backend).

**Tech Stack:** Flask, SQLAlchemy + Alembic (migración), JS vanilla.

## Global Constraints

- Rotación acotada a las bajadas de un mismo graph (no rota entre graphs).
- Orden de las bajadas: por `id` ascendente (mismo criterio que ya usa
  `obtener_graph`).
- `duracion_segundos` solo se puede cambiar mientras la rotación está
  detenida (`bajadas_auto_activo == False`); si se manda mientras está
  reproduciendo, se ignora en silencio.
- `"accion": "play"` con 0 bajadas en el graph → error 400, no cambia nada.
- `"accion": "stop"` congela `bajada_activa_id` en la bajada que estaba
  efectivamente mostrándose en ese instante.
- No hay suite de tests automatizados en este proyecto. Verificación:
  Task 1 con `curl` + inspección de la base; Task 2 con `node --check` y
  navegador real.

---

## Task 1: Backend — modelo, migración, cálculo por tiempo y endpoint

**Files:**
- Modify: `app/models.py` (clase `Graph`)
- Create: `migrations/versions/5e0e3b8f8016_agregar_rotacion_automatica_de_bajadas_a_.py`
- Modify: `app/routes/graphs.py` (nueva función, `_resolver_capas_plantilla`, `obtener_graph`, nuevo endpoint)

**Interfaces:**
- Produces: `Graph.bajadas_auto_activo` / `.bajadas_auto_loop` /
  `.bajadas_auto_duracion_segundos` / `.bajadas_auto_epoch_inicio` /
  `.bajadas_auto_indice_inicio`; función `_bajada_activa_efectiva(graph)`
  (retorna un `Bajada` o `None`); endpoint
  `PUT /graphs/<id>/bajadas-auto`; los 5 campos nuevos agregados a la
  respuesta de `GET /graphs/<id>` — todo esto lo consume Task 2.

- [ ] **Step 1: Agregar las columnas nuevas al modelo `Graph`**

En `app/models.py`, reemplazar:

```python
    mostrar_lugar = db.Column(db.Boolean, default=True, nullable=False)
    mostrar_tema = db.Column(db.Boolean, default=True, nullable=False)


class Plantilla(db.Model):
```

por:

```python
    mostrar_lugar = db.Column(db.Boolean, default=True, nullable=False)
    mostrar_tema = db.Column(db.Boolean, default=True, nullable=False)

    bajadas_auto_activo = db.Column(db.Boolean, default=False, nullable=False)
    bajadas_auto_loop = db.Column(db.Boolean, default=False, nullable=False)
    bajadas_auto_duracion_segundos = db.Column(db.Integer, default=5, nullable=False)
    bajadas_auto_epoch_inicio = db.Column(db.Float, nullable=True)
    bajadas_auto_indice_inicio = db.Column(db.Integer, default=0, nullable=False)


class Plantilla(db.Model):
```

- [ ] **Step 2: Crear la migración**

Crear `migrations/versions/5e0e3b8f8016_agregar_rotacion_automatica_de_bajadas_a_.py`:

```python
"""agregar rotacion automatica de bajadas a graph

Revision ID: 5e0e3b8f8016
Revises: 8a400de5674e
Create Date: 2026-07-19 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '5e0e3b8f8016'
down_revision = '8a400de5674e'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.add_column(sa.Column('bajadas_auto_activo', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('bajadas_auto_loop', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('bajadas_auto_duracion_segundos', sa.Integer(), nullable=False, server_default='5'))
        batch_op.add_column(sa.Column('bajadas_auto_epoch_inicio', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('bajadas_auto_indice_inicio', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    with op.batch_alter_table('graph', schema=None) as batch_op:
        batch_op.drop_column('bajadas_auto_indice_inicio')
        batch_op.drop_column('bajadas_auto_epoch_inicio')
        batch_op.drop_column('bajadas_auto_duracion_segundos')
        batch_op.drop_column('bajadas_auto_loop')
        batch_op.drop_column('bajadas_auto_activo')
```

- [ ] **Step 3: Aplicar la migración**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask db upgrade
```

Confirmar que corre sin errores y que `flask db heads` ahora muestra
`5e0e3b8f8016`.

- [ ] **Step 4: Función de cálculo de la bajada efectiva**

En `app/routes/graphs.py`, reemplazar:

```python
def _resolver_capas_plantilla(graph_activo):
    if not graph_activo or not graph_activo.plantilla:
        return None

    bajada_texto = graph_activo.bajada_activa.texto if graph_activo.bajada_activa else ""
```

por:

```python
def _bajada_activa_efectiva(graph):
    bajadas_ordenadas = sorted(graph.bajadas, key=lambda b: b.id)
    if graph.bajadas_auto_activo and bajadas_ordenadas and graph.bajadas_auto_epoch_inicio:
        duracion = graph.bajadas_auto_duracion_segundos or 5
        transcurrido = time.time() - graph.bajadas_auto_epoch_inicio
        paso = int(transcurrido // duracion)
        indice = graph.bajadas_auto_indice_inicio + paso
        if graph.bajadas_auto_loop:
            indice = indice % len(bajadas_ordenadas)
        else:
            indice = min(indice, len(bajadas_ordenadas) - 1)
        return bajadas_ordenadas[indice]
    return graph.bajada_activa


def _resolver_capas_plantilla(graph_activo):
    if not graph_activo or not graph_activo.plantilla:
        return None

    bajada_activa_efectiva = _bajada_activa_efectiva(graph_activo)
    bajada_texto = bajada_activa_efectiva.texto if bajada_activa_efectiva else ""
```

- [ ] **Step 5: Incluir los campos nuevos en `GET /graphs/<id>`**

Reemplazar:

```python
            "bajada_activa_id": graph.bajada_activa_id,
            "cita_activa_id": graph.cita_activa_id,
            "mostrar_lugar": graph.mostrar_lugar,
            "mostrar_tema": graph.mostrar_tema,
        })
    except Exception as e:
```

por:

```python
            "bajada_activa_id": graph.bajada_activa_id,
            "cita_activa_id": graph.cita_activa_id,
            "mostrar_lugar": graph.mostrar_lugar,
            "mostrar_tema": graph.mostrar_tema,
            "bajadas_auto_activo": graph.bajadas_auto_activo,
            "bajadas_auto_loop": graph.bajadas_auto_loop,
            "bajadas_auto_duracion_segundos": graph.bajadas_auto_duracion_segundos,
            "bajadas_auto_epoch_inicio": graph.bajadas_auto_epoch_inicio,
            "bajadas_auto_indice_inicio": graph.bajadas_auto_indice_inicio,
        })
    except Exception as e:
```

- [ ] **Step 6: Endpoint `PUT /graphs/<id>/bajadas-auto`**

Insertar, inmediatamente después (sin modificar) del cierre de
`setGraphsActivo`:

```python
    registrar('INFO',
              f'Activó graph: {graph.lugar}',
              'graph', id, graph.lugar)

    return jsonify({"mensaje": "Graph activo actualizado"})


@graphs_bp.route('/obtener_graph_activo')
```

por:

```python
    registrar('INFO',
              f'Activó graph: {graph.lugar}',
              'graph', id, graph.lugar)

    return jsonify({"mensaje": "Graph activo actualizado"})


@graphs_bp.route('/graphs/<int:id>/bajadas-auto', methods=['PUT'])
def actualizarBajadasAuto(id):
    graph = Graph.query.get(id)
    if not graph:
        return jsonify({"error": "Graph no encontrado"}), 404

    data = request.get_json(silent=True) or {}
    bajadas_ordenadas = sorted(graph.bajadas, key=lambda b: b.id)

    if 'loop' in data:
        graph.bajadas_auto_loop = bool(data['loop'])

    if 'duracion_segundos' in data and not graph.bajadas_auto_activo:
        graph.bajadas_auto_duracion_segundos = max(1, int(data['duracion_segundos']))

    accion = data.get('accion')
    if accion == 'play':
        if not bajadas_ordenadas:
            return jsonify({"error": "El graph no tiene bajadas"}), 400
        indice_actual = 0
        if graph.bajada_activa_id:
            for i, b in enumerate(bajadas_ordenadas):
                if b.id == graph.bajada_activa_id:
                    indice_actual = i
                    break
        graph.bajadas_auto_indice_inicio = indice_actual
        graph.bajadas_auto_epoch_inicio = time.time()
        graph.bajadas_auto_activo = True
    elif accion == 'stop':
        bajada_efectiva = _bajada_activa_efectiva(graph)
        graph.bajada_activa_id = bajada_efectiva.id if bajada_efectiva else None
        graph.bajadas_auto_activo = False
        graph.bajadas_auto_epoch_inicio = None

    db.session.commit()
    return jsonify({"mensaje": "Rotación de bajadas actualizada"})


@graphs_bp.route('/obtener_graph_activo')
```

- [ ] **Step 7: Verificación manual con `curl`**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5085
```

En otra terminal, usando un graph real que tenga al menos 2 bajadas
(ajustar `<id>` al graph elegido):

```bash
# Estado inicial
curl -s http://localhost:5085/graphs/<id> | python3 -m json.tool | grep bajadas_auto

# Play
curl -s -X PUT http://localhost:5085/graphs/<id>/bajadas-auto -H "Content-Type: application/json" -d '{"accion":"play"}'
curl -s http://localhost:5085/graphs/<id> | python3 -m json.tool | grep bajadas_auto

# Poner a este graph al aire y esperar más que la duración configurada (default 5s),
# luego confirmar que /stream_display_config va devolviendo bajadas distintas:
curl -s -X PUT "http://localhost:5085/graphs/activo/<id>" -H "Content-Type: application/json" -d '{}'
timeout 3 curl -sN http://localhost:5085/stream_display_config | grep -o '"bajada_1":"[^"]*"' | head -3
sleep 6
timeout 3 curl -sN http://localhost:5085/stream_display_config | grep -o '"bajada_1":"[^"]*"' | head -3
# confirmar que el valor de bajada_1 cambió entre las dos capturas

# Loop
curl -s -X PUT http://localhost:5085/graphs/<id>/bajadas-auto -H "Content-Type: application/json" -d '{"loop":true}'

# Stop — confirmar que bajada_activa_id queda fijo y bajadas_auto_activo pasa a false
curl -s -X PUT http://localhost:5085/graphs/<id>/bajadas-auto -H "Content-Type: application/json" -d '{"accion":"stop"}'
curl -s http://localhost:5085/graphs/<id> | python3 -m json.tool | grep -E "bajada_activa_id|bajadas_auto"

# Play con un graph sin bajadas (usar un id sin bajadas) -> debe dar 400
```

Parar el servidor al terminar (`pkill -f "flask run --port 5085"`).

- [ ] **Step 8: Commit**

```bash
git add app/models.py migrations/versions/5e0e3b8f8016_agregar_rotacion_automatica_de_bajadas_a_.py app/routes/graphs.py
git commit -m "feat: rotacion automatica de bajadas por tiempo transcurrido (backend)"
```

---

## Task 2: Editor — controles Play/Stop/Loop/duración en `control_live.js`

**Files:**
- Modify: `app/static/js/control_live.js` (múltiples puntos, ver steps)

**Interfaces:**
- Consumes: `GET /graphs/<id>` (campos `bajadas_auto_*` de Task 1),
  `PUT /graphs/<id>/bajadas-auto` (Task 1).

- [ ] **Step 1: Guardar los campos nuevos al seleccionar un graph**

En `seleccionarGraph`, reemplazar:

```javascript
    composicion = {
        numero_de_nota: numeroDeNota,
        lugar: graph.lugar,
        tema: graph.tema,
        bajadas: graph.bajadas_detalle,
        citas: graph.citas_detalle,
        bajada_activa_id: graph.bajada_activa_id,
        cita_activa_id: graph.cita_activa_id,
        mostrar_lugar: graph.mostrar_lugar,
        mostrar_tema: graph.mostrar_tema,
    };
```

por:

```javascript
    composicion = {
        numero_de_nota: numeroDeNota,
        lugar: graph.lugar,
        tema: graph.tema,
        bajadas: graph.bajadas_detalle,
        citas: graph.citas_detalle,
        bajada_activa_id: graph.bajada_activa_id,
        cita_activa_id: graph.cita_activa_id,
        mostrar_lugar: graph.mostrar_lugar,
        mostrar_tema: graph.mostrar_tema,
        bajadas_auto_activo: graph.bajadas_auto_activo,
        bajadas_auto_loop: graph.bajadas_auto_loop,
        bajadas_auto_duracion_segundos: graph.bajadas_auto_duracion_segundos,
        bajadas_auto_epoch_inicio: graph.bajadas_auto_epoch_inicio,
        bajadas_auto_indice_inicio: graph.bajadas_auto_indice_inicio,
    };
```

- [ ] **Step 2: Función de cálculo local (mismo criterio que el backend) y función de actualización**

Insertar, antes de `function renderizarPanelComposicion() {`:

```javascript
function bajadaActivaEfectivaId(comp) {
    if (!comp.bajadas_auto_activo || !comp.bajadas.length || !comp.bajadas_auto_epoch_inicio) {
        return comp.bajada_activa_id;
    }
    const bajadasOrdenadas = comp.bajadas.slice().sort((a, b) => a.id - b.id);
    const duracion = comp.bajadas_auto_duracion_segundos || 5;
    const transcurrido = (Date.now() / 1000) - comp.bajadas_auto_epoch_inicio;
    const paso = Math.floor(transcurrido / duracion);
    let indice = comp.bajadas_auto_indice_inicio + paso;
    if (comp.bajadas_auto_loop) {
        indice = ((indice % bajadasOrdenadas.length) + bajadasOrdenadas.length) % bajadasOrdenadas.length;
    } else {
        indice = Math.min(indice, bajadasOrdenadas.length - 1);
    }
    return bajadasOrdenadas[indice].id;
}

async function actualizarBajadasAuto(cambios) {
    if (!graphComposicionId) return;
    const respAccion = await fetch(`/graphs/${graphComposicionId}/bajadas-auto`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
    });
    if (!respAccion.ok) {
        const error = await respAccion.json().catch(() => ({}));
        Swal.fire({ icon: 'error', title: 'No se pudo actualizar la rotación', text: error.error || '' });
        return;
    }
    const response = await fetch(`/graphs/${graphComposicionId}`);
    const graph = await response.json();
    composicion.bajada_activa_id = graph.bajada_activa_id;
    composicion.bajadas_auto_activo = graph.bajadas_auto_activo;
    composicion.bajadas_auto_loop = graph.bajadas_auto_loop;
    composicion.bajadas_auto_duracion_segundos = graph.bajadas_auto_duracion_segundos;
    composicion.bajadas_auto_epoch_inicio = graph.bajadas_auto_epoch_inicio;
    composicion.bajadas_auto_indice_inicio = graph.bajadas_auto_indice_inicio;
}

function iniciarRotacionBajadas() {
    actualizarBajadasAuto({ accion: 'play' }).then(() => {
        renderizarLienzo();
        renderizarPanelComposicion();
    });
}

function detenerRotacionBajadas() {
    actualizarBajadasAuto({ accion: 'stop' }).then(() => {
        renderizarLienzo();
        renderizarPanelComposicion();
    });
}

function toggleLoopBajadas() {
    actualizarBajadasAuto({ loop: !composicion.bajadas_auto_loop }).then(() => {
        renderizarPanelComposicion();
    });
}

```

- [ ] **Step 3: Agregar los controles al panel (íconos + duración) entre Bajada activa y Cita activa**

Reemplazar:

```javascript
            ${bajadasHtml}
        </div>
        <div class="mb-3">
            <label class="d-block"><strong>Cita activa</strong></label>
```

por:

```javascript
            ${bajadasHtml}
        </div>
        <div class="mb-3 d-flex align-items-center" style="gap: 0.5rem;">
            <button type="button" class="btn btn-sm btn-outline-success" id="btn-bajadas-play" title="Reproducir">
                <i class="fas fa-play"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-bajadas-stop" title="Detener">
                <i class="fas fa-stop"></i>
            </button>
            <button type="button" class="btn btn-sm ${composicion.bajadas_auto_loop ? 'btn-primary' : 'btn-outline-secondary'}" id="btn-bajadas-loop" title="Loop">
                <i class="fas fa-sync-alt"></i>
            </button>
            <input type="number" class="form-control form-control-sm" id="comp-bajadas-duracion" min="1"
                   style="width: 70px;" value="${composicion.bajadas_auto_duracion_segundos}"
                   ${composicion.bajadas_auto_activo ? 'disabled' : ''} title="Segundos por bajada">
        </div>
        <div class="mb-3">
            <label class="d-block"><strong>Cita activa</strong></label>
```

- [ ] **Step 4: Listeners de los controles nuevos y ajuste del listener de "bajada-activa" existente**

Reemplazar:

```javascript
    document.querySelectorAll('input[name="bajada-activa"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            composicion.bajada_activa_id = e.target.value ? parseInt(e.target.value) : null;
            renderizarLienzo();
        });
    });
```

por:

```javascript
    document.querySelectorAll('input[name="bajada-activa"]').forEach(radio => {
        radio.addEventListener('change', async (e) => {
            const valorElegido = e.target.value ? parseInt(e.target.value) : null;
            if (composicion.bajadas_auto_activo) {
                await actualizarBajadasAuto({ accion: 'stop' });
            }
            composicion.bajada_activa_id = valorElegido;
            renderizarLienzo();
            renderizarPanelComposicion();
        });
    });
    document.getElementById('btn-bajadas-play').addEventListener('click', iniciarRotacionBajadas);
    document.getElementById('btn-bajadas-stop').addEventListener('click', detenerRotacionBajadas);
    document.getElementById('btn-bajadas-loop').addEventListener('click', toggleLoopBajadas);
    document.getElementById('comp-bajadas-duracion').addEventListener('blur', (e) => {
        const valor = Math.max(1, parseInt(e.target.value) || 5);
        actualizarBajadasAuto({ duracion_segundos: valor }).then(() => renderizarPanelComposicion());
    });
```

- [ ] **Step 5: Refrescar el preview del editor cada segundo mientras rota**

Reemplazar:

```javascript
    setInterval(() => {
        if (cronometroState.estado === 'corriendo') {
            if (segundosRestantesCronometro(cronometroState) <= 0 && !cronometroTerminado) {
                cronometroTerminado = true;
                cronometroState.estado = 'terminado';
                cronometroState.epoch_inicio = null;
                cronometroState.segundos_restantes = null;
                guardarSeccion('cronometro', cronometroState);
            }
            renderizarLienzo();
            renderizarPanelControlRapido();
        }
    }, 1000);
```

por:

```javascript
    setInterval(() => {
        if (cronometroState.estado === 'corriendo') {
            if (segundosRestantesCronometro(cronometroState) <= 0 && !cronometroTerminado) {
                cronometroTerminado = true;
                cronometroState.estado = 'terminado';
                cronometroState.epoch_inicio = null;
                cronometroState.segundos_restantes = null;
                guardarSeccion('cronometro', cronometroState);
            }
            renderizarLienzo();
            renderizarPanelControlRapido();
        }
        if (composicion && composicion.bajadas_auto_activo) {
            composicion.bajada_activa_id = bajadaActivaEfectivaId(composicion);
            renderizarLienzo();
        }
    }, 1000);
```

- [ ] **Step 6: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g; s/?\.\([a-zA-Z_]\)/\.\1/g' app/static/js/control_live.js > /tmp/cl_bajadas_checkable.js
node --check /tmp/cl_bajadas_checkable.js && echo "sintaxis OK"
```

- [ ] **Step 7: Verificación manual en navegador**

Con el servidor de Task 1 corriendo (reiniciar si se cerró) y un guion con
un graph de al menos 2 bajadas: seleccionar ese graph, confirmar que entre
"Bajada activa" y "Cita activa" aparecen los 3 íconos y el campo de
duración. Bajar la duración a 2. Click en Play: confirmar que cada ~2
segundos el preview del lienzo (el texto de la bajada) cambia solo, sin
tocar nada más. Confirmar que el campo de duración queda deshabilitado
mientras reproduce. Click en Stop: confirmar que el preview deja de
cambiar y que el radio "Bajada activa" queda marcado en la que estaba
mostrándose. Click en Play de nuevo, esperar unos segundos, click en Loop,
confirmar (dejándolo correr más de un ciclo completo) que vuelve a la
primera bajada en vez de quedarse en la última. Hacer click manual en un
radio de bajada mientras está reproduciendo: confirmar que la rotación se
detiene (el ícono de duración vuelve a habilitarse) y que el preview queda
en la bajada elegida a mano. Recargar la página con la rotación
reproduciendo: confirmar que al volver a seleccionar el mismo graph, el
estado (play/stop, loop, duración) se restaura tal cual quedó.

Parar el servidor de prueba al terminar (`pkill -f "flask run --port 5085"`).

- [ ] **Step 8: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: controles Play/Stop/Loop y duracion para rotar bajadas en el editor"
```
