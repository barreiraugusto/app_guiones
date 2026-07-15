# Rediseño de Control en Vivo (Fase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar `/control_live` (formulario de inputs sueltos) por un lienzo interactivo — mismo lenguaje visual que el editor de Plantillas — donde el Ticker y el badge "Vivo" se arrastran/redimensionan directamente sobre un preview en tiempo real del zócalo activo, con guardado automático.

**Architecture:** El backend reutiliza el mecanismo ya construido (`display_config.json` + merge por sección + SSE en `/stream_display_config`), solo se le quitan las secciones muertas `layout`/`badges` y el badge Vivo cambia de formato `top/right` a `top/left`. El frontend nuevo (`control_live.js`) es un editor de arrastre/resize calcado del patrón ya usado en `plantillas.js`, aplicado a dos elementos fijos (ticker, vivo) en vez de una lista de capas dinámica, con el zócalo activo dibujado encima en modo solo lectura vía el mismo SSE que ya consume `pantalla.js`.

**Tech Stack:** Flask (blueprint `graphs_bp`, sin cambios de modelo/DB), JSON plano en disco, JS vanilla + Server-Sent Events, Bootstrap 4.

## Global Constraints

- No hay framework de tests automatizados en este repo — cada tarea se verifica manualmente con `curl` (backend) y navegador (frontend), igual que en el plan anterior del ticker.
- El servidor se levanta con `python run.py` (o `create_app().run(...)`) desde la raíz del repo, puerto 5001 durante el desarrollo (el 5000 puede estar ocupado por otro proceso — no tocarlo).
- Guardado automático, sin botón "Guardar": cada cambio de propiedad dispara `POST /update_display_config` en `change`/`blur`; cada arrastre/resize dispara el guardado en `mouseup`, nunca en cada `mousemove`.
- El Ticker se arrastra/redimensiona solo en el eje vertical (ajusta `top`/`height`); ocupa siempre el ancho completo (1920px fijo), sin arrastre horizontal ni resize de ancho.
- El badge Vivo se arrastra libremente en X/Y (ajusta `left`/`top`); tamaño fijo, sin resize-handle.
- El badge Vivo cambia de formato `top`/`right` a `top`/`left` — es un cambio de contrato intencional (ver Task 2), no retrocompatible con el valor `right` que pueda existir en `display_config.json` de antes.
- Lienzo: 1920×1080 escalado a 0.5 (`ANCHO_LIENZO`/`ALTO_LIENZO`/`ESCALA_LIENZO` = 1920/1080/0.5), mismo valor que usa `plantillas.js`.
- Defaults al cargar si la sección/campo no existe todavía en `display_config.json`: ticker → `speed_seconds`=15, `color`='#ffffff', `bg_color`='#000000', `top`=1000, `height`=50; live → `text`='VIVO', `top`=150, `left`=1550 (posición aproximada al borde derecho del lienzo, equivalente a donde quedaba con `right`=150 antes).

---

## Task 1: Backend — eliminar `layout`/`badges` de `display_config`

**Files:**
- Modify: `app/routes/graphs.py:454-461` (`update_display_config`)
- Modify: `app/routes/graphs.py:568-587` (`stream_display_config` → `event_stream()`)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `POST /update_display_config` deja de aceptar las secciones `layout`/`badges` (quedan ignoradas si se mandan, ya no se persisten). `GET /stream_display_config` deja de emitir `data.layout`/`data.badges`. `data.live` y `data.ticker` siguen igual que antes en esta tarea (el cambio de formato de `live` es la Task 2, del lado del consumidor — el backend nunca validó la forma interna de `live`, así que no requiere cambios adicionales acá).

- [ ] **Step 1: Verificar el comportamiento actual (antes del cambio)**

Con el server corriendo en el puerto 5001 desde la raíz del worktree:

```bash
curl -s -X POST http://127.0.0.1:5001/update_display_config \
  -H "Content-Type: application/json" \
  -d '{"layout": {"main_vertical": "999px"}}'
curl -s http://127.0.0.1:5001/get_display_config | python3 -m json.tool
```

Expected: el POST responde `{"status": "success", ...}` y el GET siguiente muestra `"layout": {"main_vertical": "999px", ...}` — confirma que hoy todavía se persiste (comportamiento a eliminar).

- [ ] **Step 2: Sacar `layout`/`badges` de las secciones aceptadas por `update_display_config`**

En `app/routes/graphs.py`, reemplazar:

```python
        for section in ['layout', 'badges', 'live', 'ticker']:
```

por:

```python
        for section in ['live', 'ticker']:
```

- [ ] **Step 3: Sacar `layout`/`badges` del payload del SSE**

En `app/routes/graphs.py`, dentro de `stream_display_config` → `event_stream()`, reemplazar:

```python
                    try:
                        with open('display_config.json', 'r') as f:
                            saved_config = json.load(f)
                    except Exception as e:
                        app.logger.error(f"No se pudo cargar display_config.json: {str(e)}")
                        saved_config = {"layout": {}, "badges": {}, "live": {}, "ticker": {}}

                    config = {
                        "layout": saved_config.get("layout", {}),
                        "badges": saved_config.get("badges", {}),
                        "live":   saved_config.get("live",   {}),
                        "ticker": saved_config.get("ticker", {}),
                        "plantilla": _resolver_capas_plantilla(graph_activo),
                        "content": {
                            "primera_bajada": "",
                            "segunda_bajada": "",
                            "entrevistado":   "",
                            "lugar":          "",
                        }
                    }
```

por:

```python
                    try:
                        with open('display_config.json', 'r') as f:
                            saved_config = json.load(f)
                    except Exception as e:
                        app.logger.error(f"No se pudo cargar display_config.json: {str(e)}")
                        saved_config = {"live": {}, "ticker": {}}

                    config = {
                        "live":   saved_config.get("live",   {}),
                        "ticker": saved_config.get("ticker", {}),
                        "plantilla": _resolver_capas_plantilla(graph_activo),
                        "content": {
                            "primera_bajada": "",
                            "segunda_bajada": "",
                            "entrevistado":   "",
                            "lugar":          "",
                        }
                    }
```

- [ ] **Step 4: Verificar el cambio con `curl`**

Reiniciar el server (tomar el código nuevo), luego:

```bash
curl -s -X POST http://127.0.0.1:5001/update_display_config \
  -H "Content-Type: application/json" \
  -d '{"layout": {"main_vertical": "999px"}, "live": {"show": true, "text": "PRUEBA"}}'
curl -s http://127.0.0.1:5001/get_display_config | python3 -m json.tool
```

Expected: `live` se actualizó a `{"show": true, "text": "PRUEBA", ...}` (conserva claves previas por merge), pero **no aparece** una nueva clave `layout` con `main_vertical: 999px` — el POST de `layout` fue ignorado.

```bash
timeout 2 curl -sN http://127.0.0.1:5001/stream_display_config | head -n 2
```

Expected: el JSON del evento **no contiene** las claves `layout` ni `badges`, sí contiene `live` y `ticker`.

- [ ] **Step 5: Commit**

```bash
git add app/routes/graphs.py
git commit -m "feat: eliminar secciones muertas layout/badges de display_config"
```

---

## Task 2: Salida — badge Vivo de `right` a `left`

**Files:**
- Modify: `app/static/js/pantalla.js:110`

**Interfaces:**
- Consumes: `data.live.left` del SSE (antes leía `data.live.right`; el backend no valida esta forma, así que el cambio es puramente del lado del consumidor).
- Produces: nada consumido por otras tareas.

- [ ] **Step 1: Cambiar el campo leído**

En `app/static/js/pantalla.js`, dentro de `updateDisplay(data)`, reemplazar:

```js
        liveBadge.style.right = data.live.right || '20px';
```

por:

```js
        liveBadge.style.left = data.live.left || '20px';
```

- [ ] **Step 2: Verificar con curl + inspección**

Con el server corriendo en el puerto 5001:

```bash
curl -s -X POST http://127.0.0.1:5001/update_display_config \
  -H "Content-Type: application/json" \
  -d '{"live": {"show": true, "text": "EN VIVO", "top": "100px", "left": "300px"}}'
curl -s http://127.0.0.1:5001/static/js/pantalla.js | grep "liveBadge.style"
```

Expected: la línea servida muestra `liveBadge.style.left = data.live.left || '20px';` (no `.style.right`).

Si hay herramienta de navegador disponible, abrir `http://127.0.0.1:5001/pantalla` y confirmar visualmente que el badge "EN VIVO" aparece a 300px del borde izquierdo (no del derecho).

- [ ] **Step 3: Commit**

```bash
git add app/static/js/pantalla.js
git commit -m "fix: badge Vivo usa left en vez de right para posicionarse"
```

---

## Task 3: Página de control — estructura base, carga y zócalo de solo lectura

**Files:**
- Modify (reescritura completa, usar Write): `app/templates/control_live.html`
- Create: `app/static/js/control_live.js`

**Interfaces:**
- Consumes: `GET /get_display_config` (carga inicial de `ticker`/`live`), `GET /stream_display_config` (SSE, zócalo activo vía `data.plantilla`).
- Produces: variables de módulo `tickerState`, `liveState`, `elementoSeleccionado`, `plantillaActual` y funciones `renderizarLienzo()`, `renderizarPanelPropiedades()`, `seleccionarElemento(nombre)` — las Tasks 4 y 5 las consumen y las modifican (no son funciones "cerradas": Task 4 reescribe `renderizarPanelPropiedades()` agregando el caso `'ticker'`, Task 5 la reescribe de nuevo agregando `'live'`).

- [ ] **Step 1: Reescribir `app/templates/control_live.html`**

Reemplazar el archivo completo (el cambio supera el 80% del contenido — formulario de `layout`/`badges`/`live` reemplazado por un lienzo) con:

```html
{% extends "base.html" %}
{% block title %}Control en vivo{% endblock %}

{% block extra_style %}
<style>
    body { padding-top: 70px; }

    #lienzo-wrapper {
        background: repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 20px 20px;
        position: relative;
        overflow: hidden;
        border: 1px solid #999;
        width: 100%;
        max-width: 960px;
        aspect-ratio: 16 / 9;
    }

    #lienzo-control {
        position: relative;
        width: 1920px;
        height: 1080px;
        transform: scale(0.5);
        transform-origin: top left;
    }

    .elemento-control {
        position: absolute;
        box-sizing: border-box;
        overflow: hidden;
    }

    .elemento-editable {
        border: 1px dashed rgba(0, 0, 0, 0.4);
        cursor: move;
    }

    .elemento-editable.seleccionada { border: 2px solid #0d6efd; }

    .resize-handle {
        position: absolute;
        width: 14px;
        height: 14px;
        background: #0d6efd;
        right: -7px;
        bottom: -7px;
        cursor: ns-resize;
    }

    .capa-media { width: 100%; height: 100%; object-fit: contain; }
    .capa-texto { display: flex; align-items: center; white-space: pre-wrap; word-wrap: break-word; }

    #ticker-editor {
        display: flex;
        align-items: center;
        font-weight: bold;
        padding: 0 10px;
        white-space: nowrap;
    }

    #live-editor {
        border-radius: 20px;
        color: #fff;
        font-weight: bold;
        padding: 5px 15px;
        white-space: nowrap;
    }
</style>
{% endblock extra_style %}

{% block body %}
<div class="container-fluid mt-4">
    <h2>Control en vivo</h2>
    <div class="row">
        <div class="col-md-9">
            <div id="lienzo-wrapper">
                <div id="lienzo-control"></div>
            </div>
        </div>
        <div class="col-md-3">
            <div id="panel-propiedades-control" class="card p-3">
                <p class="text-muted">Seleccioná el ticker o el badge Vivo para editar sus propiedades.</p>
            </div>
        </div>
    </div>
</div>
{% endblock body %}

{% block extra_script %}
<script src="{{ url_for('static', filename='js/control_live.js') }}"></script>
{% endblock extra_script %}
```

- [ ] **Step 2: Crear `app/static/js/control_live.js` con estado, carga inicial, SSE del zócalo y render base**

```js
const ANCHO_LIENZO = 1920;
const ALTO_LIENZO = 1080;
const ESCALA_LIENZO = 0.5;

let tickerState = {};
let liveState = {};
let plantillaActual = null;
let elementoSeleccionado = null; // 'ticker' | 'live' | null

document.addEventListener('DOMContentLoaded', () => {
    cargarConfig();
    setupEventSource();
    document.getElementById('lienzo-control').addEventListener('click', () => {
        seleccionarElemento(null);
    });
});

async function cargarConfig() {
    const response = await fetch('/get_display_config');
    const config = await response.json();

    tickerState = {
        show: !!(config.ticker && config.ticker.show),
        text: (config.ticker && config.ticker.text) || '',
        speed_seconds: parseFloat(config.ticker && config.ticker.speed_seconds) || 15,
        color: (config.ticker && config.ticker.color) || '#ffffff',
        bg_color: (config.ticker && config.ticker.bg_color) || '#000000',
        top: parseFloat(config.ticker && config.ticker.top) || 1000,
        height: parseFloat(config.ticker && config.ticker.height) || 50,
    };

    liveState = {
        show: !!(config.live && config.live.show),
        text: (config.live && config.live.text) || 'VIVO',
        top: parseFloat(config.live && config.live.top) || 150,
        left: parseFloat(config.live && config.live.left) || 1550,
    };

    renderizarLienzo();
    renderizarPanelPropiedades();
}

let eventSource;

function setupEventSource() {
    eventSource = new EventSource('/stream_display_config');
    eventSource.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            plantillaActual = data.plantilla || null;
            renderizarLienzo();
        } catch (error) {
            console.error('Error al analizar datos del SSE:', error);
        }
    };
}

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

function crearElementoZocalo(capa) {
    let el;
    if (capa.tipo === 'texto') {
        el = document.createElement('div');
        el.classList.add('elemento-control', 'capa-texto');
        el.style.fontFamily = capa.fuente;
        el.style.fontSize = `${capa.tamano_fuente}px`;
        el.style.color = capa.color;
        el.style.justifyContent = capa.alineacion === 'center' ? 'center' : (capa.alineacion === 'right' ? 'flex-end' : 'flex-start');
        el.textContent = capa.valor || '';
    } else if (capa.tipo === 'video') {
        el = document.createElement('video');
        el.classList.add('elemento-control', 'capa-media');
        el.src = `/static/${capa.archivo}`;
        el.muted = true;
        el.autoplay = true;
        el.loop = !!capa.loop;
        el.playsInline = true;
    } else {
        el = document.createElement('img');
        el.classList.add('elemento-control', 'capa-media');
        el.src = `/static/${capa.archivo}`;
    }
    el.style.left = `${capa.x}px`;
    el.style.top = `${capa.y}px`;
    el.style.width = `${capa.ancho}px`;
    el.style.height = `${capa.alto}px`;
    el.style.zIndex = capa.orden;
    return el;
}

function crearElementoTicker() {
    const el = document.createElement('div');
    el.id = 'ticker-editor';
    el.className = 'elemento-control elemento-editable' + (elementoSeleccionado === 'ticker' ? ' seleccionada' : '');
    el.style.left = '0px';
    el.style.width = `${ANCHO_LIENZO}px`;
    el.style.top = `${tickerState.top}px`;
    el.style.height = `${tickerState.height}px`;
    el.style.backgroundColor = tickerState.bg_color;
    el.style.color = tickerState.color;
    el.style.zIndex = 900;
    el.style.opacity = tickerState.show ? '1' : '0.35';
    el.textContent = tickerState.text || '(ticker vacío)';
    return el;
}

function crearElementoLive() {
    const el = document.createElement('div');
    el.id = 'live-editor';
    el.className = 'elemento-control elemento-editable' + (elementoSeleccionado === 'live' ? ' seleccionada' : '');
    el.style.left = `${liveState.left}px`;
    el.style.top = `${liveState.top}px`;
    el.style.backgroundColor = '#666';
    el.style.zIndex = 1000;
    el.style.opacity = liveState.show ? '1' : '0.35';
    el.textContent = liveState.text || 'VIVO';
    return el;
}

function seleccionarElemento(nombre) {
    elementoSeleccionado = nombre;
    renderizarLienzo();
    renderizarPanelPropiedades();
}

function renderizarPanelPropiedades() {
    const panel = document.getElementById('panel-propiedades-control');
    panel.innerHTML = '<p class="text-muted">Seleccioná el ticker o el badge Vivo para editar sus propiedades.</p>';
}
```

- [ ] **Step 3: Verificar en el navegador (o con curl si no hay navegador disponible)**

Con el server corriendo en el puerto 5001 desde la raíz del worktree:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5001/control_live
curl -s http://127.0.0.1:5001/control_live | grep -o 'lienzo-control\|panel-propiedades-control'
```

Expected: `200`, y ambos ids aparecen en el HTML servido.

Si hay herramienta de navegador: abrir `http://127.0.0.1:5001/control_live` y confirmar que se ve el lienzo a cuadros con el ticker (banda semitransparente si `show` es false, o sólida si está activo) y el badge Vivo dibujados, sin poder arrastrarlos todavía (no tienen interactividad hasta las próximas tareas), y el panel a la derecha con el texto de placeholder. Si hay un `Graph` activo en la DB, confirmar que el zócalo también se ve en el lienzo.

- [ ] **Step 4: Commit**

```bash
git add app/templates/control_live.html app/static/js/control_live.js
git commit -m "feat: estructura base de la nueva pantalla de control en vivo con preview del zocalo"
```

---

## Task 4: Ticker interactivo (arrastre vertical, resize de alto, panel de propiedades)

**Files:**
- Modify: `app/static/js/control_live.js`

**Interfaces:**
- Consumes: `tickerState`, `renderizarLienzo()`, `renderizarPanelPropiedades()`, `seleccionarElemento()` de la Task 3.
- Produces: `guardarSeccion(nombre, datos)` — la Task 5 la reusa tal cual, sin modificarla.

- [ ] **Step 1: Agregar interactividad a `crearElementoTicker()`**

En `app/static/js/control_live.js`, reemplazar la función `crearElementoTicker` completa:

```js
function crearElementoTicker() {
    const el = document.createElement('div');
    el.id = 'ticker-editor';
    el.className = 'elemento-control elemento-editable' + (elementoSeleccionado === 'ticker' ? ' seleccionada' : '');
    el.style.left = '0px';
    el.style.width = `${ANCHO_LIENZO}px`;
    el.style.top = `${tickerState.top}px`;
    el.style.height = `${tickerState.height}px`;
    el.style.backgroundColor = tickerState.bg_color;
    el.style.color = tickerState.color;
    el.style.zIndex = 900;
    el.style.opacity = tickerState.show ? '1' : '0.35';
    el.textContent = tickerState.text || '(ticker vacío)';

    el.addEventListener('mousedown', iniciarArrastreTicker);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarElemento('ticker');
    });

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.addEventListener('mousedown', iniciarResizeTicker);
    el.appendChild(handle);

    return el;
}
```

- [ ] **Step 2: Agregar las funciones de arrastre y resize del ticker, y `guardarSeccion`**

Agregar al final de `app/static/js/control_live.js`:

```js
let arrastreTicker = null;

function iniciarArrastreTicker(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('ticker');
    arrastreTicker = { yInicial: e.clientY, topInicial: tickerState.top };
    document.addEventListener('mousemove', moverArrastreTicker);
    document.addEventListener('mouseup', finalizarArrastreTicker);
}

function moverArrastreTicker(e) {
    if (!arrastreTicker) return;
    const deltaY = (e.clientY - arrastreTicker.yInicial) / ESCALA_LIENZO;
    tickerState.top = Math.max(0, Math.round(arrastreTicker.topInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastreTicker() {
    if (!arrastreTicker) return;
    arrastreTicker = null;
    document.removeEventListener('mousemove', moverArrastreTicker);
    document.removeEventListener('mouseup', finalizarArrastreTicker);
    guardarSeccion('ticker', tickerState);
    renderizarPanelPropiedades();
}

let resizeTicker = null;

function iniciarResizeTicker(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('ticker');
    resizeTicker = { yInicial: e.clientY, alturaInicial: tickerState.height };
    document.addEventListener('mousemove', moverResizeTicker);
    document.addEventListener('mouseup', finalizarResizeTicker);
}

function moverResizeTicker(e) {
    if (!resizeTicker) return;
    const deltaY = (e.clientY - resizeTicker.yInicial) / ESCALA_LIENZO;
    tickerState.height = Math.max(10, Math.round(resizeTicker.alturaInicial + deltaY));
    renderizarLienzo();
}

function finalizarResizeTicker() {
    if (!resizeTicker) return;
    resizeTicker = null;
    document.removeEventListener('mousemove', moverResizeTicker);
    document.removeEventListener('mouseup', finalizarResizeTicker);
    guardarSeccion('ticker', tickerState);
    renderizarPanelPropiedades();
}

function guardarSeccion(nombre, datos) {
    fetch('/update_display_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [nombre]: datos })
    }).catch(error => console.error(`Error al guardar ${nombre}:`, error));
}
```

- [ ] **Step 3: Reemplazar `renderizarPanelPropiedades()` agregando el caso del ticker**

Reemplazar la función completa (la de la Task 3):

```js
function renderizarPanelPropiedades() {
    const panel = document.getElementById('panel-propiedades-control');

    if (elementoSeleccionado === 'ticker') {
        panel.innerHTML = `
            <h6>Ticker</h6>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-ticker-show" ${tickerState.show ? 'checked' : ''}>
                <label class="form-check-label" for="prop-ticker-show">Mostrar</label>
            </div>
            <div class="form-group mb-2">
                <label>Texto</label>
                <input type="text" class="form-control" id="prop-ticker-text" value="${tickerState.text}">
            </div>
            <div class="form-group mb-2">
                <label>Velocidad (seg/vuelta)</label>
                <input type="number" class="form-control" id="prop-ticker-speed" min="1" value="${tickerState.speed_seconds}">
            </div>
            <div class="form-group mb-2">
                <label>Color texto</label>
                <input type="color" class="form-control" id="prop-ticker-color" value="${tickerState.color}">
            </div>
            <div class="form-group mb-2">
                <label>Color fondo</label>
                <input type="color" class="form-control" id="prop-ticker-bgcolor" value="${tickerState.bg_color}">
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-ticker-top" value="${tickerState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-ticker-height" value="${tickerState.height}"></div>
            </div>
        `;

        document.getElementById('prop-ticker-show').addEventListener('change', (e) => {
            tickerState.show = e.target.checked;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-text').addEventListener('blur', (e) => {
            tickerState.text = e.target.value;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-speed').addEventListener('blur', (e) => {
            tickerState.speed_seconds = parseFloat(e.target.value) || 15;
            guardarSeccion('ticker', tickerState);
        });
        document.getElementById('prop-ticker-color').addEventListener('change', (e) => {
            tickerState.color = e.target.value;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-bgcolor').addEventListener('change', (e) => {
            tickerState.bg_color = e.target.value;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-top').addEventListener('blur', (e) => {
            tickerState.top = parseFloat(e.target.value) || 0;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-height').addEventListener('blur', (e) => {
            tickerState.height = parseFloat(e.target.value) || 10;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        return;
    }

    panel.innerHTML = '<p class="text-muted">Seleccioná el ticker o el badge Vivo para editar sus propiedades.</p>';
}
```

- [ ] **Step 4: Verificar en el navegador (o con curl la parte no visual)**

```bash
curl -s http://127.0.0.1:5001/static/js/control_live.js | grep -c "function iniciarArrastreTicker"
```

Expected: `1`.

Si hay herramienta de navegador: abrir `/control_live`, click en el ticker → se selecciona (borde azul) y aparece el panel con sus 7 campos. Arrastrar verticalmente y soltar → confirmar en `/pantalla` (otra pestaña) que el `top` cambió. Redimensionar con el handle inferior → confirmar que el `height` cambió en `/pantalla`. Cambiar texto/velocidad/colores desde el panel → confirmar reflejo en `/pantalla` sin recargar.

- [ ] **Step 5: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: ticker arrastrable (vertical) y redimensionable con panel de propiedades"
```

---

## Task 5: Badge Vivo interactivo (arrastre libre, panel de propiedades)

**Files:**
- Modify: `app/static/js/control_live.js`

**Interfaces:**
- Consumes: `liveState`, `renderizarLienzo()`, `renderizarPanelPropiedades()`, `seleccionarElemento()` de la Task 3, `guardarSeccion()` de la Task 4.
- Produces: nada consumido por otras tareas — última tarea del plan.

- [ ] **Step 1: Agregar interactividad a `crearElementoLive()`**

En `app/static/js/control_live.js`, reemplazar la función `crearElementoLive` completa:

```js
function crearElementoLive() {
    const el = document.createElement('div');
    el.id = 'live-editor';
    el.className = 'elemento-control elemento-editable' + (elementoSeleccionado === 'live' ? ' seleccionada' : '');
    el.style.left = `${liveState.left}px`;
    el.style.top = `${liveState.top}px`;
    el.style.backgroundColor = '#666';
    el.style.zIndex = 1000;
    el.style.opacity = liveState.show ? '1' : '0.35';
    el.textContent = liveState.text || 'VIVO';

    el.addEventListener('mousedown', iniciarArrastreLive);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarElemento('live');
    });

    return el;
}
```

- [ ] **Step 2: Agregar las funciones de arrastre del badge Vivo**

Agregar al final de `app/static/js/control_live.js`:

```js
let arrastreLive = null;

function iniciarArrastreLive(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('live');
    arrastreLive = { xInicial: e.clientX, yInicial: e.clientY, leftInicial: liveState.left, topInicial: liveState.top };
    document.addEventListener('mousemove', moverArrastreLive);
    document.addEventListener('mouseup', finalizarArrastreLive);
}

function moverArrastreLive(e) {
    if (!arrastreLive) return;
    const deltaX = (e.clientX - arrastreLive.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastreLive.yInicial) / ESCALA_LIENZO;
    liveState.left = Math.max(0, Math.round(arrastreLive.leftInicial + deltaX));
    liveState.top = Math.max(0, Math.round(arrastreLive.topInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastreLive() {
    if (!arrastreLive) return;
    arrastreLive = null;
    document.removeEventListener('mousemove', moverArrastreLive);
    document.removeEventListener('mouseup', finalizarArrastreLive);
    guardarSeccion('live', liveState);
    renderizarPanelPropiedades();
}
```

- [ ] **Step 3: Reemplazar `renderizarPanelPropiedades()` agregando el caso del badge Vivo**

Reemplazar la función completa (la de la Task 4, agregando el bloque `live` antes del `return` final):

```js
function renderizarPanelPropiedades() {
    const panel = document.getElementById('panel-propiedades-control');

    if (elementoSeleccionado === 'ticker') {
        panel.innerHTML = `
            <h6>Ticker</h6>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-ticker-show" ${tickerState.show ? 'checked' : ''}>
                <label class="form-check-label" for="prop-ticker-show">Mostrar</label>
            </div>
            <div class="form-group mb-2">
                <label>Texto</label>
                <input type="text" class="form-control" id="prop-ticker-text" value="${tickerState.text}">
            </div>
            <div class="form-group mb-2">
                <label>Velocidad (seg/vuelta)</label>
                <input type="number" class="form-control" id="prop-ticker-speed" min="1" value="${tickerState.speed_seconds}">
            </div>
            <div class="form-group mb-2">
                <label>Color texto</label>
                <input type="color" class="form-control" id="prop-ticker-color" value="${tickerState.color}">
            </div>
            <div class="form-group mb-2">
                <label>Color fondo</label>
                <input type="color" class="form-control" id="prop-ticker-bgcolor" value="${tickerState.bg_color}">
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-ticker-top" value="${tickerState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-ticker-height" value="${tickerState.height}"></div>
            </div>
        `;

        document.getElementById('prop-ticker-show').addEventListener('change', (e) => {
            tickerState.show = e.target.checked;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-text').addEventListener('blur', (e) => {
            tickerState.text = e.target.value;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-speed').addEventListener('blur', (e) => {
            tickerState.speed_seconds = parseFloat(e.target.value) || 15;
            guardarSeccion('ticker', tickerState);
        });
        document.getElementById('prop-ticker-color').addEventListener('change', (e) => {
            tickerState.color = e.target.value;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-bgcolor').addEventListener('change', (e) => {
            tickerState.bg_color = e.target.value;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-top').addEventListener('blur', (e) => {
            tickerState.top = parseFloat(e.target.value) || 0;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-height').addEventListener('blur', (e) => {
            tickerState.height = parseFloat(e.target.value) || 10;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        return;
    }

    if (elementoSeleccionado === 'live') {
        panel.innerHTML = `
            <h6>Vivo</h6>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-live-show" ${liveState.show ? 'checked' : ''}>
                <label class="form-check-label" for="prop-live-show">Mostrar</label>
            </div>
            <div class="form-group mb-2">
                <label>Texto</label>
                <input type="text" class="form-control" id="prop-live-text" value="${liveState.text}">
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-live-top" value="${liveState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-live-left" value="${liveState.left}"></div>
            </div>
        `;

        document.getElementById('prop-live-show').addEventListener('change', (e) => {
            liveState.show = e.target.checked;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-text').addEventListener('blur', (e) => {
            liveState.text = e.target.value;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-top').addEventListener('blur', (e) => {
            liveState.top = parseFloat(e.target.value) || 0;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-left').addEventListener('blur', (e) => {
            liveState.left = parseFloat(e.target.value) || 0;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        return;
    }

    panel.innerHTML = '<p class="text-muted">Seleccioná el ticker o el badge Vivo para editar sus propiedades.</p>';
}
```

- [ ] **Step 4: Verificación manual end-to-end de toda la Fase 1**

Con el server corriendo en el puerto 5001 y, si es posible, herramienta de navegador:

1. Abrir `/control_live`: se ve el lienzo con el zócalo activo (si hay uno, solo lectura), el ticker y el badge Vivo.
2. Click en el badge Vivo → se selecciona, aparece el panel con Mostrar/Texto/Top/Left.
3. Arrastrarlo a otra posición y soltar → confirmar en `/pantalla` que se movió, leyendo `left` (no `right`).
4. Togglear "Mostrar" del Vivo → confirmar que aparece/desaparece en `/pantalla`.
5. Click en el fondo del lienzo (zona vacía, sin tocar ticker/vivo/zócalo) → el panel vuelve al placeholder "Seleccioná...".
6. Repetir la verificación del ticker (arrastre, resize, texto, velocidad, colores) para confirmar que sigue funcionando tras los cambios de esta tarea.
7. Confirmar que ni `layout` ni `badges` aparecen en ningún lado de `/control_live` ni se escriben en `display_config.json` tras guardar cualquier cambio (`curl -s http://127.0.0.1:5001/get_display_config | python3 -m json.tool` no debe mostrar esas claves si no estaban ya de antes en el archivo).
8. Con un `Graph` activo (zócalo visible), confirmar que se ve correctamente en el lienzo de `/control_live` pero clicks sobre él no lo seleccionan ni lo mueven (cae al caso "deseleccionar" del listener de fondo, ya que las capas del zócalo no tienen `stopPropagation`).

- [ ] **Step 5: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: badge Vivo arrastrable con panel de propiedades"
```
