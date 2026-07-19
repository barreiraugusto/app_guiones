# Número de nota en panel de propiedades y colores en panel izquierdo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En `control_live`, mostrar el número de nota en el panel de
propiedades al seleccionar un graph, y pintar el panel izquierdo con el
mismo criterio de colores que ya usa la pantalla de guion (gris = emitida,
amarillo = nota activa del rundown) más un color nuevo para el graph que
está efectivamente al aire.

**Architecture:** Un solo archivo (`app/static/js/control_live.js`), tres
funciones ya existentes. El número de nota se propaga desde
`cargarNotasYGraphs()` (que ya itera los textos con `numero_de_nota`) hasta
`seleccionarGraph()` como parámetro extra del `onclick` ya existente — sin
tocar el backend.

**Tech Stack:** JS vanilla, clases de Bootstrap ya usadas en el proyecto
(`bg-secondary`, `bg-warning`, `bg-danger`).

## Global Constraints

- Sin cambios de backend ni de modelos — todos los campos (`emitido`,
  `activo` de Texto, `activo` de Graph, `numero_de_nota`) ya viajan en las
  respuestas existentes.
- Prioridad de color en la fila de la nota: `emitido` gana sobre `activo`
  (igual que `app/static/js/guiones.js:277-278`).
- La fila de cada graph usa `bg-danger` cuando `graph.activo` (reemplaza el
  `bg-warning` actual — ver spec para el porqué).
- No hay suite de tests automatizados en este proyecto. Verificación:
  `node --check` (con el workaround ya establecido:
  `sed 's/^export //; s/??/||/g; s/?\.\([a-zA-Z_]\)/\.\1/g'`) y verificación
  manual en navegador real.

---

## Task 1: Colores del panel izquierdo y número de nota en el panel de propiedades

**Files:**
- Modify: `app/static/js/control_live.js` (tres puntos, ver steps)

**Interfaces:**
- Consumes: campos ya existentes en la respuesta de `GET /textos`
  (`t.emitido`, `t.activo`, `t.numero_de_nota`, `t.graphs[].activo`,
  `t.graphs[].id`) — sin cambios de backend.
- Produces: `composicion.numero_de_nota`, consumido por
  `renderizarPanelComposicion()` en el mismo archivo.

- [ ] **Step 1: Colorear la fila de la nota (gris/amarillo) y la fila del graph (rojo)**

En `cargarNotasYGraphs()`, reemplazar:

```javascript
        textosFiltrados.forEach(t => {
            const notaDiv = document.createElement('div');
            notaDiv.className = 'mb-2 border-bottom pb-2' + (t.activo ? ' bg-warning' : '');

            const graphsHtml = (t.graphs || []).map(g => `
                <div class="d-flex justify-content-between align-items-center small ${g.activo ? 'bg-warning' : ''} p-1 rounded">
                    <span style="cursor:pointer;" onclick="seleccionarGraph(${g.id})">${g.lugar || '(sin lugar)'}${g.tema ? ' — ' + g.tema : ''}</span>
```

por:

```javascript
        textosFiltrados.forEach(t => {
            const notaDiv = document.createElement('div');
            const colorNota = t.emitido ? ' bg-secondary' : (t.activo ? ' bg-warning' : '');
            notaDiv.className = 'mb-2 border-bottom pb-2' + colorNota;

            const graphsHtml = (t.graphs || []).map(g => `
                <div class="d-flex justify-content-between align-items-center small ${g.activo ? 'bg-danger' : ''} p-1 rounded">
                    <span style="cursor:pointer;" onclick="seleccionarGraph(${g.id}, ${t.numero_de_nota})">${g.lugar || '(sin lugar)'}${g.tema ? ' — ' + g.tema : ''}</span>
```

- [ ] **Step 2: Propagar el número de nota a `seleccionarGraph`**

Reemplazar:

```javascript
async function seleccionarGraph(id) {
    const response = await fetch(`/graphs/${id}`);
    if (!response.ok) return;
    const graph = await response.json();

    graphComposicionId = id;
    composicion = {
        lugar: graph.lugar,
        tema: graph.tema,
```

por:

```javascript
async function seleccionarGraph(id, numeroDeNota) {
    const response = await fetch(`/graphs/${id}`);
    if (!response.ok) return;
    const graph = await response.json();

    graphComposicionId = id;
    composicion = {
        numero_de_nota: numeroDeNota,
        lugar: graph.lugar,
        tema: graph.tema,
```

- [ ] **Step 3: Mostrar el número de nota en el panel de propiedades**

En `renderizarPanelComposicion()`, reemplazar:

```javascript
    panel.innerHTML = `
        <h6>Graph: ${composicion.lugar || '(sin lugar)'}</h6>
```

por:

```javascript
    panel.innerHTML = `
        <h6>Nota #${composicion.numero_de_nota} — Graph: ${composicion.lugar || '(sin lugar)'}</h6>
```

- [ ] **Step 4: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g; s/?\.\([a-zA-Z_]\)/\.\1/g' app/static/js/control_live.js > /tmp/cl_notacolor_checkable.js
node --check /tmp/cl_notacolor_checkable.js && echo "sintaxis OK"
```

- [ ] **Step 5: Verificación manual en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5079
```

Abrir `http://localhost:5079/control_live/<un guion con notas y graphs>` y
confirmar:
- Una nota marcada como emitida (`emitido: true` en la base) se ve gris,
  aunque también esté marcada `activo`.
- La nota activa del rundown (sin emitir) se ve amarilla.
- El graph que tiene `activo: true` (el que está al aire — se puede
  verificar cuál es consultando `GET /graphs/<id>` o mirando cuál dispara
  `stream_display_config`) se ve rojo, no amarillo.
- Al hacer click en un graph, el panel de propiedades muestra
  "Nota #{numero} — Graph: {lugar}" arriba.

Parar el servidor de prueba al terminar (`pkill -f "flask run --port 5079"`).

- [ ] **Step 6: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: numero de nota en panel de propiedades y colores de estado en panel izquierdo"
```
