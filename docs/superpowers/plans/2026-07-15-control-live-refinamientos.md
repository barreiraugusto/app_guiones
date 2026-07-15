# Refinamientos de Control en Vivo (Fase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajustar el layout del panel lateral, agregar un preview interactivo del zócalo (con arrastre de capas que edita la Plantilla compartida) mientras se arma la composición, auto-ajustar el tamaño de fuente para que el texto siempre entre en una sola línea, y separar "activar una nota" de "poner un graph al aire".

**Architecture:** El preview reutiliza el patrón de arrastre/resize ya existente para el Ticker y el badge Vivo en `control_live.js`, aplicado a las capas de una Plantilla cargada completa (`GET /api/plantillas/<id>`, mismo endpoint que ya usa el editor de `/plantillas`). Los valores de texto del preview se calculan en el cliente con una réplica minimalista del mapeo que ya hace `_resolver_capas_plantilla` en el backend. El auto-ajuste de fuente vive en un archivo nuevo y compartido, cargado como script global antes de `pantalla.js` y `control_live.js`.

**Tech Stack:** Flask + SQLAlchemy (sin cambios de modelo en esta fase), JS vanilla + SSE, Bootstrap 4.

## Global Constraints

- No hay tests automatizados en este repo — verificación manual (`curl` para backend, navegador para frontend, o trace estático si no hay navegador disponible).
- El preview interactivo del lienzo reemplaza al zócalo real (SSE) SOLO mientras hay un Graph seleccionado en composición (`graphComposicionId` no null) — nunca conviven ambos a la vez, y al deseleccionar vuelve el zócalo real.
- Arrastrar/redimensionar una capa del preview edita la **Plantilla compartida** (mismo mecanismo que `/plantillas`, `PUT /api/plantillas/<id>` con el objeto completo) — afecta a todos los Graphs que usen esa Plantilla. Guardado en `mouseup`, nunca en cada `mousemove`.
- El auto-ajuste de fuente reduce `font-size` hasta que el texto entre en una sola línea dentro del ancho de la caja — nunca agranda por encima de `tamano_fuente`. Aplica en `pantalla.js` (salida real) y en el preview de `control_live.js` — no en `/plantillas`.
- El campo `campo_dato: 'cita'` (agregado al editor de Plantillas en la Fase 2) hoy es rechazado por la validación del backend — es un bug pendiente de esa fase, se corrige en este plan antes de construir nada que dependa de guardar plantillas con esa capa.
- Servidor de desarrollo en el puerto 5001 (el 5000 puede estar en uso — no tocarlo).

---

## Task 1: Layout del panel lateral

**Files:**
- Modify: `app/templates/control_live.html`
- Modify: `app/static/js/control_live.js`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: Ajustar el ancho de columnas**

En `app/templates/control_live.html`, dentro del `<div class="row">`, cambiar las clases de columna:

```html
        <div class="col-md-3">
            <div class="card p-2" style="max-height: 80vh; overflow-y: auto;">
```

(antes `col-md-2`) y:

```html
        <div class="col-md-6">
            <div id="lienzo-wrapper">
```

(antes `col-md-7`). La tercera columna (`col-md-3`, panel de propiedades/composición) queda igual. Suma: 3+6+3=12.

- [ ] **Step 2: Achicar los botones del panel lateral**

En `app/templates/control_live.html`, dentro del `<style>` de `extra_style`, agregar:

```css
    .btn-mini {
        padding: 0.1rem 0.3rem;
        font-size: 0.7rem;
        line-height: 1;
    }
```

En `app/static/js/control_live.js`, dentro de `cargarNotasYGraphs()`, agregar la clase `btn-mini` a los 3 botones generados (editar, eliminar, "+"). Reemplazar:

```js
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
```

por:

```js
            const graphsHtml = (t.graphs || []).map(g => `
                <div class="d-flex justify-content-between align-items-center small ${g.activo ? 'bg-warning' : ''} p-1 rounded">
                    <span style="cursor:pointer;" onclick="seleccionarGraph(${g.id})">${g.lugar || '(sin lugar)'}${g.tema ? ' — ' + g.tema : ''}</span>
                    <span>
                        <button class="btn btn-sm btn-mini btn-outline-secondary" onclick="editarGraph(${g.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-mini btn-outline-danger" onclick="eliminarGraph(${g.id})"><i class="fas fa-trash"></i></button>
                    </span>
                </div>
            `).join('');

            notaDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <strong>#${t.numero_de_nota} ${t.titulo}</strong>
                    <button class="btn btn-sm btn-mini btn-outline-primary" onclick="abrirModalGraph(${t.id})"><i class="fas fa-plus"></i></button>
                </div>
                ${graphsHtml}
            `;
```

- [ ] **Step 3: Verificar**

Con el server corriendo en el puerto 5001, `curl -s http://127.0.0.1:5001/control_live/<id_valido> | grep -o "col-md-3\|col-md-6\|btn-mini"` debe mostrar las 3 coincidencias. Si hay navegador: confirmar visualmente que la columna de notas es más ancha y los botones más chicos que antes.

- [ ] **Step 4: Commit**

```bash
git add app/templates/control_live.html app/static/js/control_live.js
git commit -m "feat: ensanchar columna de notas y achicar botones del panel lateral"
```

---

## Task 2: Fix — campo `cita` rechazado por el backend de Plantillas

**Files:**
- Modify: `app/routes/plantillas.py`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `POST/PUT /api/plantillas` aceptan `campo_dato: 'cita'` en una capa de texto — bug pendiente de la Fase 2 (el editor ya ofrece la opción "Cita" en el select, pero el backend la rechazaba con 400).

- [ ] **Step 1: Agregar `'cita'` a los campos válidos**

En `app/routes/plantillas.py`, reemplazar:

```python
CAMPOS_DATO_VALIDOS = {'lugar', 'tema', 'entrevistado', 'bajada_1', 'bajada_2', None}
```

por:

```python
CAMPOS_DATO_VALIDOS = {'lugar', 'tema', 'entrevistado', 'cita', 'bajada_1', 'bajada_2', None}
```

- [ ] **Step 2: Verificar con curl**

Con el server corriendo en el puerto 5001, usando una Plantilla real existente (conseguir un id con `curl -s http://127.0.0.1:5001/api/plantillas`):

```bash
curl -s http://127.0.0.1:5001/api/plantillas/<ID> | python3 -m json.tool
```

Guardar la misma plantilla agregándole una capa de texto con `campo_dato: "cita"` (usar el resto de los campos tal como vinieron en el GET, agregando una capa nueva a la lista `capas`):

```bash
curl -s -X PUT http://127.0.0.1:5001/api/plantillas/<ID> -H "Content-Type: application/json" \
  -d '{"nombre": "<NOMBRE_REAL_DE_LA_PLANTILLA>", "ancho": 1920, "alto": 1080, "capas": [<CAPAS_EXISTENTES_MAS_UNA_NUEVA_CON_campo_dato_cita>]}'
```

Expected: antes del fix, 400 "campo_dato inválido: cita"; después del fix, `{"mensaje": "Plantilla actualizada"}`. Si agregaste una capa de prueba, restaurá la plantilla a su forma original con otro PUT (o dejalo si la capa nueva no molesta — anotalo en el reporte).

- [ ] **Step 3: Commit**

```bash
git add app/routes/plantillas.py
git commit -m "fix: aceptar campo_dato cita en la validacion de capas de plantilla"
```

---

## Task 3: Auto-ajuste de tamaño de texto (compartido + salida real)

**Files:**
- Create: `app/static/js/ajuste-texto.js`
- Modify: `app/templates/pantalla.html`
- Modify: `app/templates/control_live.html`
- Modify: `app/static/js/pantalla.js`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: función global `ajustarTamanoTexto(el, tamanoMaximo)` — consumida por esta misma tarea en `pantalla.js`, y por la Task 4 en `control_live.js`.

- [ ] **Step 1: Crear el archivo compartido**

Crear `app/static/js/ajuste-texto.js`:

```js
function ajustarTamanoTexto(el, tamanoMaximo) {
    el.style.whiteSpace = 'nowrap';
    let tamano = tamanoMaximo;
    el.style.fontSize = `${tamano}px`;
    while (el.scrollWidth > el.clientWidth && tamano > 1) {
        tamano -= 1;
        el.style.fontSize = `${tamano}px`;
    }
}
```

- [ ] **Step 2: Cargar el script en ambos templates, antes de sus scripts principales**

En `app/templates/pantalla.html`, reemplazar:

```html
<script type="module" src="{{ url_for('static', filename='js/pantalla.js') }}"></script>
```

por:

```html
<script src="{{ url_for('static', filename='js/ajuste-texto.js') }}"></script>
<script type="module" src="{{ url_for('static', filename='js/pantalla.js') }}"></script>
```

En `app/templates/control_live.html`, dentro de `{% block extra_script %}`, reemplazar:

```html
<script src="{{ url_for('static', filename='js/control_live.js') }}"></script>
<script src="{{ url_for('static', filename='js/graphs.js') }}"></script>
```

por:

```html
<script src="{{ url_for('static', filename='js/ajuste-texto.js') }}"></script>
<script src="{{ url_for('static', filename='js/control_live.js') }}"></script>
<script src="{{ url_for('static', filename='js/graphs.js') }}"></script>
```

(`ajuste-texto.js` es un script plano, sin `type="module"` — queda en el scope global de `window`, accesible tanto desde `pantalla.js` (módulo, puede leer globals) como desde `control_live.js` (script normal). No importa el orden relativo entre `pantalla.js`/`control_live.js` y `graphs.js`, mientras `ajuste-texto.js` cargue antes de ambos.)

- [ ] **Step 3: Integrar en `pantalla.js`**

En `app/static/js/pantalla.js`, reemplazar `renderizarPlantilla`:

```js
function renderizarPlantilla(plantillaData) {
    const root = document.getElementById('overlay-root');
    root.innerHTML = '';
    plantillaActualId = plantillaData.id;
    plantillaData.capas
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .forEach(capa => root.appendChild(crearElementoCapa(capa)));
}
```

por:

```js
function renderizarPlantilla(plantillaData) {
    const root = document.getElementById('overlay-root');
    root.innerHTML = '';
    plantillaActualId = plantillaData.id;
    plantillaData.capas
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .forEach(capa => {
            const el = crearElementoCapa(capa);
            root.appendChild(el);
            if (capa.tipo === 'texto') ajustarTamanoTexto(el, capa.tamano_fuente);
        });
}
```

Y reemplazar `actualizarTextos`:

```js
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
```

por:

```js
    plantillaData.capas.forEach(capa => {
        const elExistente = document.getElementById(`capa-${capa.id}`);
        if (elExistente) {
            if (capa.tipo === 'texto') {
                elExistente.textContent = capa.valor || '';
                ajustarTamanoTexto(elExistente, capa.tamano_fuente);
            }
            return;
        }
        const elNuevo = crearElementoCapa(capa);
        root.appendChild(elNuevo);
        if (capa.tipo === 'texto') ajustarTamanoTexto(elNuevo, capa.tamano_fuente);
        if (capa.animacion_entrada && capa.animacion_entrada !== 'none') {
            elNuevo.style.setProperty('--dur', `${capa.duracion_transicion_ms}ms`);
            elNuevo.classList.add(`anim-${capa.animacion_entrada}-enter`);
        }
    });
```

No toques `crearElementoCapa`, `aplicarAnimacion`, `updateTicker`, `updateDisplay`, ni el resto del archivo — `ajustarTamanoTexto` se llama siempre DESPUÉS de que el elemento ya está insertado en el DOM (nunca dentro de `crearElementoCapa`, que solo crea el elemento sin insertarlo — si se llamara ahí, `clientWidth` daría 0).

- [ ] **Step 4: Verificar**

```bash
node --check app/static/js/ajuste-texto.js && echo "sintaxis OK"
```

Con el server corriendo en el puerto 5001: activar un Graph real con una bajada de texto largo en una capa angosta (podés usar el mismo Graph/Plantilla de pruebas anteriores). Si hay navegador: abrir `/pantalla` y confirmar visualmente que el texto largo se ve completo en una sola línea, con la fuente más chica que `tamano_fuente` si hace falta, sin desbordar la caja. Si no hay navegador, confirmar por trace estático que el orden de llamadas (insertar en DOM → ajustar tamaño) es correcto en los 3 puntos tocados.

- [ ] **Step 5: Commit**

```bash
git add app/static/js/ajuste-texto.js app/templates/pantalla.html app/templates/control_live.html app/static/js/pantalla.js
git commit -m "feat: auto-ajustar tamano de fuente para que el texto entre en una sola linea"
```

---

## Task 4: Preview interactivo del lienzo con arrastre de capas

**Files:**
- Modify: `app/static/js/control_live.js`

**Interfaces:**
- Consumes: `ajustarTamanoTexto` (Task 3), `GET /api/plantillas/<id>` y `PUT /api/plantillas/<id>` (ya existentes, `app/routes/plantillas.py`), `ESCALA_LIENZO` (ya existente).
- Produces: nada consumido por otras tareas — última pieza funcional grande del plan.

- [ ] **Step 1: Extender `seleccionarGraph` para cargar la Plantilla completa**

En `app/static/js/control_live.js`, agregar la variable de estado junto a las existentes (después de `let composicion = null;`):

```js
let plantillaEnEdicion = null;
```

Reemplazar `seleccionarGraph`:

```js
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

por:

```js
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

    plantillaEnEdicion = null;
    if (graph.plantilla_id) {
        const respPlantilla = await fetch(`/api/plantillas/${graph.plantilla_id}`);
        if (respPlantilla.ok) plantillaEnEdicion = await respPlantilla.json();
    }

    elementoSeleccionado = null;
    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

- [ ] **Step 2: Resetear `plantillaEnEdicion` al seleccionar Ticker/Vivo**

En `app/static/js/control_live.js`, `seleccionarElemento` pasa de:

```js
function seleccionarElemento(nombre) {
    graphComposicionId = null;
    elementoSeleccionado = nombre;
    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

a:

```js
function seleccionarElemento(nombre) {
    graphComposicionId = null;
    plantillaEnEdicion = null;
    elementoSeleccionado = nombre;
    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

- [ ] **Step 3: Agregar `resolverValorCapa` y `crearElementoPreviewCapa`**

En `app/static/js/control_live.js`, agregar (por ejemplo, después de `crearElementoZocalo`):

```js
function resolverValorCapa(capa, comp) {
    if (capa.tipo !== 'texto') return null;
    const bajada = comp.bajadas.find(b => b.id === comp.bajada_activa_id);
    const cita = comp.citas.find(c => c.id === comp.cita_activa_id);
    const valoresPorCampo = {
        lugar: comp.mostrar_lugar ? (comp.lugar || '') : '',
        tema: comp.mostrar_tema ? (comp.tema || '') : '',
        entrevistado: cita ? cita.entrevistado : '',
        cita: cita ? cita.texto : '',
        bajada_1: bajada ? bajada.texto : '',
        bajada_2: '',
    };
    return valoresPorCampo[capa.campo_dato] ?? (capa.texto_fijo || '');
}

function crearElementoPreviewCapa(capa, valor) {
    let el;
    if (capa.tipo === 'texto') {
        el = document.createElement('div');
        el.classList.add('elemento-control', 'elemento-editable', 'capa-texto');
        el.style.fontFamily = capa.fuente;
        el.style.color = capa.color;
        el.style.justifyContent = capa.alineacion === 'center' ? 'center' : (capa.alineacion === 'right' ? 'flex-end' : 'flex-start');
        el.textContent = valor;
    } else if (capa.tipo === 'video') {
        el = document.createElement('video');
        el.classList.add('elemento-control', 'elemento-editable', 'capa-media');
        el.src = `/static/${capa.archivo}`;
        el.muted = true;
        el.autoplay = true;
        el.loop = !!capa.loop;
        el.playsInline = true;
    } else {
        el = document.createElement('img');
        el.classList.add('elemento-control', 'elemento-editable', 'capa-media');
        el.src = `/static/${capa.archivo}`;
    }
    el.style.left = `${capa.x}px`;
    el.style.top = `${capa.y}px`;
    el.style.width = `${capa.ancho}px`;
    el.style.height = `${capa.alto}px`;
    el.style.zIndex = capa.orden;

    el.addEventListener('mousedown', (e) => iniciarArrastreCapa(e, capa.id));
    el.addEventListener('click', (e) => e.stopPropagation());

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.addEventListener('mousedown', (e) => iniciarResizeCapa(e, capa.id));
    el.appendChild(handle);

    return el;
}
```

- [ ] **Step 4: Modificar `renderizarLienzo` para mostrar el preview cuando corresponde**

En `app/static/js/control_live.js`, reemplazar `renderizarLienzo`:

```js
function renderizarLienzo() {
    const lienzo = document.getElementById('lienzo-control');
    lienzo.innerHTML = '';

    if (plantillaActual) {
        plantillaActual.capas
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .forEach(capa => lienzo.appendChild(crearElementoZocalo(capa)));
    }

    lienzo.appendChild(crearElementoTicker());
    lienzo.appendChild(crearElementoLive());
}
```

por:

```js
function renderizarLienzo() {
    const lienzo = document.getElementById('lienzo-control');
    lienzo.innerHTML = '';

    if (graphComposicionId && plantillaEnEdicion) {
        plantillaEnEdicion.capas
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .forEach(capa => {
                const valor = resolverValorCapa(capa, composicion);
                if (capa.tipo === 'texto' && !valor) return;
                const el = crearElementoPreviewCapa(capa, valor);
                lienzo.appendChild(el);
                if (capa.tipo === 'texto') ajustarTamanoTexto(el, capa.tamano_fuente);
            });
    } else if (plantillaActual) {
        plantillaActual.capas
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .forEach(capa => lienzo.appendChild(crearElementoZocalo(capa)));
    }

    lienzo.appendChild(crearElementoTicker());
    lienzo.appendChild(crearElementoLive());
}
```

- [ ] **Step 5: Agregar el arrastre y resize de capas, y el guardado en la Plantilla**

En `app/static/js/control_live.js`, agregar al final del archivo:

```js
let arrastreCapa = null;

function iniciarArrastreCapa(e, capaId) {
    e.preventDefault();
    e.stopPropagation();
    const capa = plantillaEnEdicion.capas.find(c => c.id === capaId);
    arrastreCapa = { capaId, xInicial: e.clientX, yInicial: e.clientY, xCapaInicial: capa.x, yCapaInicial: capa.y };
    document.addEventListener('mousemove', moverArrastreCapa);
    document.addEventListener('mouseup', finalizarArrastreCapa);
}

function moverArrastreCapa(e) {
    if (!arrastreCapa) return;
    const capa = plantillaEnEdicion.capas.find(c => c.id === arrastreCapa.capaId);
    const deltaX = (e.clientX - arrastreCapa.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastreCapa.yInicial) / ESCALA_LIENZO;
    capa.x = Math.max(0, Math.round(arrastreCapa.xCapaInicial + deltaX));
    capa.y = Math.max(0, Math.round(arrastreCapa.yCapaInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastreCapa() {
    if (!arrastreCapa) return;
    arrastreCapa = null;
    document.removeEventListener('mousemove', moverArrastreCapa);
    document.removeEventListener('mouseup', finalizarArrastreCapa);
    guardarPlantillaEnEdicion();
}

let resizeCapa = null;

function iniciarResizeCapa(e, capaId) {
    e.preventDefault();
    e.stopPropagation();
    const capa = plantillaEnEdicion.capas.find(c => c.id === capaId);
    resizeCapa = { capaId, xInicial: e.clientX, yInicial: e.clientY, anchoInicial: capa.ancho, altoInicial: capa.alto };
    document.addEventListener('mousemove', moverResizeCapa);
    document.addEventListener('mouseup', finalizarResizeCapa);
}

function moverResizeCapa(e) {
    if (!resizeCapa) return;
    const capa = plantillaEnEdicion.capas.find(c => c.id === resizeCapa.capaId);
    const deltaX = (e.clientX - resizeCapa.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - resizeCapa.yInicial) / ESCALA_LIENZO;
    capa.ancho = Math.max(20, Math.round(resizeCapa.anchoInicial + deltaX));
    capa.alto = Math.max(20, Math.round(resizeCapa.altoInicial + deltaY));
    renderizarLienzo();
}

function finalizarResizeCapa() {
    if (!resizeCapa) return;
    resizeCapa = null;
    document.removeEventListener('mousemove', moverResizeCapa);
    document.removeEventListener('mouseup', finalizarResizeCapa);
    guardarPlantillaEnEdicion();
}

function guardarPlantillaEnEdicion() {
    fetch(`/api/plantillas/${plantillaEnEdicion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plantillaEnEdicion)
    }).catch(error => console.error('Error al guardar la plantilla:', error));
}
```

- [ ] **Step 6: Verificar de punta a punta**

No hay tests automatizados. Con el server corriendo en el puerto 5001 y, si es posible, navegador:

1. Seleccionar un Graph real con Plantilla asignada: confirmar que el lienzo cambia a mostrar el preview de esa Plantilla (no el zócalo real activo si había otro).
2. Elegir otra bajada/cita en el panel de composición: confirmar que el lienzo (preview) refleja el cambio al instante.
3. Arrastrar una capa del preview: soltar, y confirmar con `curl -s http://127.0.0.1:5001/api/plantillas/<plantilla_id>` que la posición `x`/`y` cambió.
4. Redimensionar una capa: confirmar que `ancho`/`alto` cambió en la Plantilla.
5. Si hay otro Graph que use la misma Plantilla, confirmar que también se ve afectado por el cambio de posición (es compartida, no un override).
6. Deseleccionar el Graph (click en el fondo del lienzo): confirmar que vuelve a mostrarse el zócalo real activo (SSE), no el preview.
7. Si no hay navegador, documentar en el reporte cuáles pasos se verificaron por curl (2, 3, 4 son 100% verificables así) y cuáles requieren confirmación visual (1, 5, 6).

- [ ] **Step 7: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: preview interactivo del lienzo con arrastre de capas de la plantilla"
```

---

## Task 5: Separar "activar nota" de "poner al aire"

**Files:**
- Modify: `app/routes/textos.py`
- Modify: `app/static/js/control_live.js`

**Interfaces:**
- Consumes: `t.activo` (ya presente en el payload de `GET /textos`, usado por `cargarNotasYGraphs`).
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: Dejar de activar los Graphs al activar una nota**

En `app/routes/textos.py`, dentro de `setTextoActivo`, reemplazar:

```python
    try:
        # Desactivar todos los textos y graphs en una sola operación
        Texto.query.filter_by(activo=True).update({Texto.activo: False})
        Graph.query.filter_by(activo=True).update({Graph.activo: False})

        texto.activo = True
        for graph in texto.graphs:
            graph.activo = True

        db.session.commit()
```

por:

```python
    try:
        Texto.query.filter_by(activo=True).update({Texto.activo: False})
        texto.activo = True

        db.session.commit()
```

No toques el resto de la función (`registrar(...)`, el `return`, el manejo de excepción).

- [ ] **Step 2: Resaltar visualmente la nota activa en el panel lateral**

En `app/static/js/control_live.js`, dentro de `cargarNotasYGraphs()`, reemplazar:

```js
            const notaDiv = document.createElement('div');
            notaDiv.className = 'mb-2 border-bottom pb-2';
```

por:

```js
            const notaDiv = document.createElement('div');
            notaDiv.className = 'mb-2 border-bottom pb-2' + (t.activo ? ' bg-warning' : '');
```

No agregues ninguna otra lógica (sin auto-selección del graph, sin auto-apertura del panel de composición).

- [ ] **Step 3: Verificar**

Con el server corriendo en el puerto 5001, usando un Texto real que tenga al menos un Graph asociado:

```bash
curl -s -X PUT http://127.0.0.1:5001/textos/activo/<TEXTO_ID>
curl -s http://127.0.0.1:5001/textos/<TEXTO_ID> | python3 -m json.tool
```

(el `GET /textos/<id>` no devuelve los graphs anidados con su `activo` — usá en cambio `curl -s http://127.0.0.1:5001/textos | python3 -c "import json,sys; d=json.load(sys.stdin); t=[x for x in d if x['id']==<TEXTO_ID>][0]; print('texto.activo:', t['activo']); print('graphs:', [(g['id'], g['activo']) for g in t['graphs']])"`)

Expected: `texto.activo: True`, y los `graphs` mantienen el `activo` que tenían ANTES de este PUT (no se pusieron todos en `True`). Si algún Graph de ese texto ya estaba `activo: True` de antes (por una prueba anterior), confirmá que sigue en `True` sin que este endpoint lo haya cambiado — y que ningún OTRO Graph pasó a `True` como efecto colateral.

Si hay navegador: abrir `/control_live/<guion_id>`, activar la nota desde otra pantalla (`ver_guion.html` o el editor principal) mientras `/control_live` está abierto, y confirmar que la nota se resalta en el panel lateral (dentro del segundo de polling) sin que ningún Graph se ponga al aire en `/pantalla`.

- [ ] **Step 4: Commit**

```bash
git add app/routes/textos.py app/static/js/control_live.js
git commit -m "feat: separar activar nota de poner graph al aire, resaltar nota activa en control_live"
```
