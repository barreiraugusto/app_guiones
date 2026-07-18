# Enriquecer texto en capas de plantillas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar negrita, cursiva y un selector de fuentes (10 fijas + personalizada) a las capas de tipo `texto` en el editor de plantillas, propagando esos estilos a la salida real y al control en vivo.

**Architecture:** Dos columnas booleanas nuevas (`negrita`, `cursiva`) en `PlantillaCapa`. El backend las serializa/persiste igual que los campos de texto existentes (`fuente`, `color`, `alineacion`). El frontend aplica `font-weight`/`font-style` inline en los mismos puntos donde ya se aplica `font-family`.

**Tech Stack:** Flask + SQLAlchemy + Alembic (backend), JS vanilla + Bootstrap (frontend), PostgreSQL.

## Global Constraints

- Alcance por capa completa: los estilos se aplican a todo el contenido de la capa, no a fragmentos de texto dentro de ella.
- `fuente` sigue siendo `String` libre en el modelo y el backend; la restricción a 10 opciones + "Personalizada..." es solo UX del `<select>` en el editor.
- Lista fija de fuentes (exactamente estas 10, en este orden): Arial, Helvetica, Georgia, Times New Roman, Courier New, Verdana, Tahoma, Trebuchet MS, Impact, Segoe UI.
- Sin subida de archivos de fuente ni `@font-face`. Sin edición de texto enriquecido dentro de una capa (no WYSIWYG).
- Sin validación de nombre de fuente en backend: se acepta cualquier string, igual que hoy.
- No hay suite de tests automatizados en este proyecto (no hay carpeta `tests/` ni pytest configurado). La verificación de backend se hace con `app.test_client()` en scripts puntuales (no se agrega infraestructura de test nueva); la de frontend, con `node --check` para sintaxis y prueba manual en navegador.

---

## Task 1: Modelo y migración — columnas `negrita`/`cursiva`

**Files:**
- Modify: `app/models.py:122-169` (clase `PlantillaCapa`)
- Create: `migrations/versions/<hash>_agregar_negrita_cursiva_a_plantilla_.py`

**Interfaces:**
- Produces: `PlantillaCapa.negrita` (Boolean, default `False`, not null) y `PlantillaCapa.cursiva` (Boolean, default `False`, not null), consumidos por las Tasks 2 y 3.

- [ ] **Step 1: Agregar las columnas al modelo**

En `app/models.py`, dentro de `class PlantillaCapa`, justo después de la línea `alineacion = db.Column(db.String(10), nullable=False, default='left')` (línea 142):

```python
    negrita = db.Column(db.Boolean, nullable=False, default=False)
    cursiva = db.Column(db.Boolean, nullable=False, default=False)
```

- [ ] **Step 2: Generar la migración con autogenerate**

```bash
source .venv/bin/activate
FLASK_APP=run.py flask db migrate -m "agregar negrita y cursiva a plantilla_capa"
```

Expected: crea un archivo nuevo en `migrations/versions/` con un `upgrade()` que hace `add_column` de `negrita` y `cursiva` sobre `plantilla_capa`.

- [ ] **Step 3: Ajustar `server_default` en la migración generada**

Abrir el archivo generado y verificar que ambas columnas booleanas tengan `server_default=sa.false()` (Alembic autogenerate a veces lo omite y falla contra filas existentes). Debe quedar así, siguiendo el patrón de `migrations/versions/17f458c59481_agregar_es_mosca_a_plantilla_capa.py`:

```python
def upgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.add_column(sa.Column('negrita', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('cursiva', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('plantilla_capa', schema=None) as batch_op:
        batch_op.drop_column('cursiva')
        batch_op.drop_column('negrita')
```

- [ ] **Step 4: Aplicar la migración**

```bash
FLASK_APP=run.py flask db upgrade
```

Expected: termina sin error y `flask db current` muestra la nueva revisión como head.

- [ ] **Step 5: Verificar las columnas en la base**

```bash
psql -U abarreira -d guiones -c "\d plantilla_capa" | grep -E "negrita|cursiva"
```

Expected: dos filas mostrando `negrita` y `cursiva` como `boolean`, `not null`.

- [ ] **Step 6: Verificar que la migración es reversible**

```bash
FLASK_APP=run.py flask db downgrade -1
psql -U abarreira -d guiones -c "\d plantilla_capa" | grep -E "negrita|cursiva"
FLASK_APP=run.py flask db upgrade
```

Expected: tras el `downgrade`, el segundo comando no devuelve ninguna fila (columnas eliminadas); tras el `upgrade` final, vuelven a existir y `flask db current` vuelve a mostrar la nueva revisión como head.

- [ ] **Step 7: Commit**

```bash
git add app/models.py migrations/versions/
git commit -m "feat: agregar negrita y cursiva a PlantillaCapa"
```

---

## Task 2: Backend — `app/routes/plantillas.py`

**Files:**
- Modify: `app/routes/plantillas.py:18-61` (`_serializar_plantilla`)
- Modify: `app/routes/plantillas.py:85-116` (`_crear_capas`)
- Modify: `app/routes/plantillas.py:284-315` (`duplicar_plantilla`)

**Interfaces:**
- Consumes: `PlantillaCapa.negrita`, `PlantillaCapa.cursiva` (Task 1).
- Produces: los dicts JSON de capa devueltos por `GET /plantillas/<id>` y `POST /plantillas/<id>/duplicar` incluyen `"negrita"`/`"cursiva"`; `POST`/`PUT` de plantilla aceptan esos campos en el payload.

- [ ] **Step 1: Agregar los campos a la serialización**

En `app/routes/plantillas.py`, dentro de `_serializar_plantilla`, agregar dos líneas justo después de `"alineacion": capa.alineacion,` (línea 40):

```python
                "alineacion": capa.alineacion,
                "negrita": capa.negrita,
                "cursiva": capa.cursiva,
```

- [ ] **Step 2: Agregar los campos a la creación de capas**

En `_crear_capas`, dentro del constructor `PlantillaCapa(...)`, agregar después de `alineacion=capa_data.get('alineacion', 'left'),` (línea 99):

```python
            alineacion=capa_data.get('alineacion', 'left'),
            negrita=capa_data.get('negrita', False),
            cursiva=capa_data.get('cursiva', False),
```

- [ ] **Step 3: Agregar los campos a la duplicación de plantillas**

En `duplicar_plantilla`, dentro del constructor `PlantillaCapa(...)` que copia la capa original, agregar después de `alineacion=capa.alineacion,` (línea 298):

```python
                alineacion=capa.alineacion,
                negrita=capa.negrita,
                cursiva=capa.cursiva,
```

- [ ] **Step 4: Verificar con el test client de Flask**

Crear un script temporal de verificación (no forma parte del repo, se borra al final):

```bash
cat > /tmp/claude-1000/-home-augusto-Documentos-CODIGOS-APP-GUIONES-app-guiones/466a2a06-94ea-4b7e-ac71-de72cc0c062f/scratchpad/verificar_negrita_cursiva.py <<'EOF'
from app import create_app, db
from app.models import Plantilla

app = create_app()
client = app.test_client()

with app.app_context():
    payload = {
        "nombre": "Test negrita cursiva",
        "ancho": 1920,
        "alto": 1080,
        "capas": [{
            "tipo": "texto",
            "texto_fijo": "Hola",
            "fuente": "Georgia",
            "negrita": True,
            "cursiva": True,
        }],
    }
    resp = client.post("/api/plantillas", json=payload)
    assert resp.status_code == 201, resp.get_json()
    plantilla_id = resp.get_json()["id"]

    resp = client.get(f"/api/plantillas/{plantilla_id}")
    capa = resp.get_json()["capas"][0]
    assert capa["negrita"] is True, capa
    assert capa["cursiva"] is True, capa

    resp = client.post(f"/api/plantillas/{plantilla_id}/duplicar")
    assert resp.status_code == 201, resp.get_json()
    dup_id = resp.get_json()["id"]
    resp = client.get(f"/api/plantillas/{dup_id}")
    capa_dup = resp.get_json()["capas"][0]
    assert capa_dup["negrita"] is True, capa_dup
    assert capa_dup["cursiva"] is True, capa_dup

    Plantilla.query.filter(Plantilla.id.in_([plantilla_id, dup_id])).delete(synchronize_session=False)
    db.session.commit()

print("OK: negrita/cursiva se crean, serializan y duplican correctamente")
EOF
source .venv/bin/activate
python /tmp/claude-1000/-home-augusto-Documentos-CODIGOS-APP-GUIONES-app-guiones/466a2a06-94ea-4b7e-ac71-de72cc0c062f/scratchpad/verificar_negrita_cursiva.py
```

Expected: imprime `OK: negrita/cursiva se crean, serializan y duplican correctamente` sin AssertionError.

- [ ] **Step 5: Commit**

```bash
git add app/routes/plantillas.py
git commit -m "feat: persistir negrita y cursiva de capas de texto en plantillas"
```

---

## Task 3: Backend — `app/routes/graphs.py` (payload SSE)

**Files:**
- Modify: `app/routes/graphs.py:543-576` (`_serializar_capa_resuelta`)

**Interfaces:**
- Consumes: `PlantillaCapa.negrita`, `PlantillaCapa.cursiva` (Task 1).
- Produces: el dict devuelto por `_serializar_capa_resuelta` (consumido por `pantalla.js` vía SSE y por `_resolver_mosca`) incluye `"negrita"`/`"cursiva"`.

- [ ] **Step 1: Agregar los campos a `_serializar_capa_resuelta`**

En `app/routes/graphs.py`, dentro de `_serializar_capa_resuelta`, agregar después de `"alineacion": capa.alineacion,` (línea 557):

```python
        "alineacion": capa.alineacion,
        "negrita": capa.negrita,
        "cursiva": capa.cursiva,
```

- [ ] **Step 2: Verificar con el test client de Flask**

```bash
cat > /tmp/claude-1000/-home-augusto-Documentos-CODIGOS-APP-GUIONES-app-guiones/466a2a06-94ea-4b7e-ac71-de72cc0c062f/scratchpad/verificar_serializar_capa_resuelta.py <<'EOF'
from app import create_app
from app.models import PlantillaCapa
from app.routes.graphs import _serializar_capa_resuelta

app = create_app()
with app.app_context():
    capa = PlantillaCapa(tipo="texto", fuente="Georgia", negrita=True, cursiva=False)
    resultado = _serializar_capa_resuelta(capa)
    assert resultado["negrita"] is True, resultado
    assert resultado["cursiva"] is False, resultado

print("OK: _serializar_capa_resuelta incluye negrita/cursiva")
EOF
source .venv/bin/activate
python /tmp/claude-1000/-home-augusto-Documentos-CODIGOS-APP-GUIONES-app-guiones/466a2a06-94ea-4b7e-ac71-de72cc0c062f/scratchpad/verificar_serializar_capa_resuelta.py
```

Expected: imprime `OK: _serializar_capa_resuelta incluye negrita/cursiva` sin AssertionError.

- [ ] **Step 3: Commit**

```bash
git add app/routes/graphs.py
git commit -m "feat: incluir negrita y cursiva en el payload SSE de capas resueltas"
```

---

## Task 4: Editor — `app/static/js/plantillas.js`

**Files:**
- Modify: `app/static/js/plantillas.js:120-139` (`crearElementoEditable`, preview del lienzo)
- Modify: `app/static/js/plantillas.js:234-271` (`agregarCapa`, defaults de nueva capa)
- Modify: `app/static/js/plantillas.js:301-394` (`renderizarPanelPropiedades`, panel de propiedades de texto)
- Modify: `app/static/js/plantillas.js:495-503` (listeners de los campos de texto)

**Interfaces:**
- Consumes: `capa.negrita`, `capa.cursiva`, `capa.fuente` (strings/booleans en el objeto JS `capa`, ya presentes vía Task 2's serialización).
- Produces: `actualizarCapaSeleccionada({ negrita, cursiva, fuente })` — mismo patrón ya usado por los demás campos de la capa.

- [ ] **Step 1: Definir la lista fija de fuentes**

Cerca del inicio del archivo, junto a la constante existente `ICONO_TIPO_CAPA` (línea 83), agregar:

```javascript
const FUENTES_FIJAS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Segoe UI'];
```

- [ ] **Step 2: Agregar defaults a `agregarCapa`**

En la función `agregarCapa` (línea 234), agregar `negrita: false, cursiva: false,` después de `alineacion: 'left',` (línea 250):

```javascript
        alineacion: 'left',
        negrita: false,
        cursiva: false,
```

- [ ] **Step 3: Aplicar los estilos en el preview del lienzo**

En `crearElementoEditable` (línea 121), reemplazar el bloque `else if (capa.tipo === 'texto') { ... }` (líneas 135-138) por:

```javascript
    } else if (capa.tipo === 'texto') {
        const justify = capa.alineacion === 'center' ? 'center' : (capa.alineacion === 'right' ? 'flex-end' : 'flex-start');
        const texto = capa.texto_fijo || (capa.campo_dato ? `{{${capa.campo_dato}}}` : 'Texto libre');
        const peso = capa.negrita ? 'bold' : 'normal';
        const estilo = capa.cursiva ? 'italic' : 'normal';
        div.innerHTML = `<div class="capa-texto-preview" style="font-family:${capa.fuente};font-size:${capa.tamano_fuente}px;color:${capa.color};justify-content:${justify};font-weight:${peso};font-style:${estilo};">${texto}</div>`;
```

- [ ] **Step 4: Reemplazar el input de fuente por el select + input personalizado, y agregar los checkboxes**

En `renderizarPanelPropiedades` (línea 301), dentro del bloque `if (capa.tipo === 'texto') { camposEspecificos = ... }` (líneas 311-349), reemplazar el bloque completo por:

```javascript
    if (capa.tipo === 'texto') {
        const esFuentePersonalizada = !FUENTES_FIJAS.includes(capa.fuente);
        camposEspecificos = `
            <div class="form-group mb-2">
                <label>Vincular a:</label>
                <select class="form-control" id="prop-campo-dato">
                    <option value="">Texto libre</option>
                    <option value="lugar">Lugar</option>
                    <option value="tema">Tema</option>
                    <option value="entrevistado">Entrevistado</option>
                    <option value="cita">Cita</option>
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
                <select class="form-control" id="prop-fuente">
                    ${FUENTES_FIJAS.map(f => `<option value="${f}" ${!esFuentePersonalizada && capa.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                    <option value="__custom__" ${esFuentePersonalizada ? 'selected' : ''}>Personalizada...</option>
                </select>
                <input type="text" class="form-control mt-1" id="prop-fuente-custom" value="${capa.fuente}" style="${esFuentePersonalizada ? '' : 'display:none;'}">
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
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-negrita" ${capa.negrita ? 'checked' : ''}>
                <label class="form-check-label" for="prop-negrita">Negrita</label>
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-cursiva" ${capa.cursiva ? 'checked' : ''}>
                <label class="form-check-label" for="prop-cursiva">Cursiva</label>
            </div>
        `;
```

- [ ] **Step 5: Actualizar los listeners del bloque de texto**

En el bloque `if (capa.tipo === 'texto') { ... }` de los listeners (línea 495), reemplazar la línea del listener de `prop-fuente` (línea 500) y agregar los nuevos listeners, quedando:

```javascript
    if (capa.tipo === 'texto') {
        document.getElementById('prop-campo-dato').value = capa.campo_dato || '';
        document.getElementById('prop-alineacion').value = capa.alineacion;
        document.getElementById('prop-campo-dato').addEventListener('change', (e) => actualizarCapaSeleccionada({ campo_dato: e.target.value || null }));
        document.getElementById('prop-texto-fijo').addEventListener('change', (e) => actualizarCapaSeleccionada({ texto_fijo: e.target.value }));
        document.getElementById('prop-fuente').addEventListener('change', (e) => {
            const inputCustom = document.getElementById('prop-fuente-custom');
            if (e.target.value === '__custom__') {
                inputCustom.style.display = '';
                inputCustom.focus();
            } else {
                inputCustom.style.display = 'none';
                actualizarCapaSeleccionada({ fuente: e.target.value });
            }
        });
        document.getElementById('prop-fuente-custom').addEventListener('change', (e) => actualizarCapaSeleccionada({ fuente: e.target.value }));
        document.getElementById('prop-tamano').addEventListener('change', (e) => actualizarCapaSeleccionada({ tamano_fuente: parseInt(e.target.value) || 24 }));
        document.getElementById('prop-color').addEventListener('change', (e) => actualizarCapaSeleccionada({ color: e.target.value }));
        document.getElementById('prop-alineacion').addEventListener('change', (e) => actualizarCapaSeleccionada({ alineacion: e.target.value }));
        document.getElementById('prop-negrita').addEventListener('change', (e) => actualizarCapaSeleccionada({ negrita: e.target.checked }));
        document.getElementById('prop-cursiva').addEventListener('change', (e) => actualizarCapaSeleccionada({ cursiva: e.target.checked }));
    } else if (capa.tipo === 'forma') {
```

- [ ] **Step 6: Verificar sintaxis**

```bash
node --check app/static/js/plantillas.js
```

Expected: sin salida (exit code 0).

- [ ] **Step 7: Verificación manual en navegador**

```bash
source .venv/bin/activate
FLASK_APP=run.py flask run &
```

Abrir `http://localhost:5000/plantillas` en el navegador, crear o editar una plantilla, agregar una capa de texto y verificar:
1. El campo Fuente es un desplegable con las 10 fuentes fijas + "Personalizada...".
2. Elegir "Personalizada..." muestra un input de texto debajo; escribir un nombre ahí cambia la fuente del preview en el lienzo.
3. Los checkboxes "Negrita" y "Cursiva" existen; al tildarlos, el texto en el lienzo se ve en negrita/cursiva.
4. Guardar la plantilla, recargar la página y volver a abrir la capa: los valores de fuente/negrita/cursiva persisten.

Parar el servidor de prueba (`kill %1` o `Ctrl+C` según cómo se haya lanzado) al terminar.

- [ ] **Step 8: Commit**

```bash
git add app/static/js/plantillas.js
git commit -m "feat: selector de fuentes y checkboxes de negrita/cursiva en el editor de plantillas"
```

---

## Task 5: Salida real — `app/static/js/pantalla.js`

**Files:**
- Modify: `app/static/js/pantalla.js:9-16` (`crearElementoCapa`, rama `tipo === 'texto'`)

**Interfaces:**
- Consumes: `capa.negrita`, `capa.cursiva` (booleans en el payload SSE, Task 3).

- [ ] **Step 1: Aplicar `font-weight`/`font-style`**

En `crearElementoCapa`, dentro de la rama `if (capa.tipo === 'texto')` (líneas 9-16), agregar después de `el.style.color = capa.color;` (línea 14):

```javascript
        el.style.color = capa.color;
        el.style.fontWeight = capa.negrita ? 'bold' : 'normal';
        el.style.fontStyle = capa.cursiva ? 'italic' : 'normal';
```

- [ ] **Step 2: Verificar sintaxis**

```bash
node --check app/static/js/pantalla.js
```

Expected: sin salida (exit code 0).

- [ ] **Step 3: Verificación manual en navegador**

Con el servidor Flask corriendo (`FLASK_APP=run.py flask run`), abrir `http://localhost:5000/pantalla`, poner al aire un graph que use una plantilla con una capa de texto marcada como negrita/cursiva desde el editor (Task 4), y confirmar visualmente que el texto se muestra en negrita y cursiva.

- [ ] **Step 4: Commit**

```bash
git add app/static/js/pantalla.js
git commit -m "feat: aplicar negrita y cursiva de capas de texto en la salida real"
```

---

## Task 6: Control en vivo — `app/static/js/control_live.js`

**Files:**
- Modify: `app/static/js/control_live.js:143-152` (`crearElementoZocalo`)
- Modify: `app/static/js/control_live.js:204-212` (`crearElementoPreviewCapa`)

**Interfaces:**
- Consumes: `capa.negrita`, `capa.cursiva` (booleans, ya presentes en los objetos de capa que consume este archivo vía Task 3).

- [ ] **Step 1: Aplicar los estilos en `crearElementoZocalo`**

Agregar después de `el.style.color = capa.color;` (línea 150):

```javascript
        el.style.color = capa.color;
        el.style.fontWeight = capa.negrita ? 'bold' : 'normal';
        el.style.fontStyle = capa.cursiva ? 'italic' : 'normal';
```

- [ ] **Step 2: Aplicar los estilos en `crearElementoPreviewCapa`**

Agregar después de `el.style.color = capa.color;` (línea 210):

```javascript
        el.style.color = capa.color;
        el.style.fontWeight = capa.negrita ? 'bold' : 'normal';
        el.style.fontStyle = capa.cursiva ? 'italic' : 'normal';
```

- [ ] **Step 3: Verificar sintaxis**

```bash
node --check app/static/js/control_live.js
```

Expected: sin salida (exit code 0).

- [ ] **Step 4: Verificación manual en navegador**

Con el servidor Flask corriendo, abrir `http://localhost:5000/control_live` con un graph activo que use una plantilla con una capa de texto en negrita/cursiva, y confirmar que tanto el zócalo como el preview de esa capa se muestran con esos estilos.

- [ ] **Step 5: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: aplicar negrita y cursiva de capas de texto en control en vivo"
```
