# Widgets de cronómetro y marcador de tantos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar dos overlays nuevos y configurables al panel de control en
vivo — un Cronómetro (cuenta regresiva con formato HH:MM:SS/MM:SS e Inicio/
Stop/Restablecer) y un Marcador (tantos de dos equipos con nombres y +/-) —
que se ven y controlan en `control_live` y se transmiten en `/pantalla`,
siguiendo el mismo patrón arquitectónico que el Ticker ya existente.

**Architecture:** Ninguno de los dos widgets tiene modelo de base de datos:
se persisten como JSON libre en `display_config.json` (secciones
`cronometro` y `marcador`) vía los endpoints ya existentes, sin lógica de
negocio en el backend. Todo el cálculo de tiempo del cronómetro vive en JS,
duplicado en `control_live.js` y `pantalla.js` (mismo criterio que
`FUENTES_FIJAS`, no hay módulos compartidos entre esos scripts). El tiempo
restante se deriva de un timestamp de inicio guardado en el servidor
(`epoch_inicio`), no de un contador local por pestaña, para que sobreviva
recargas y quede sincronizado entre `control_live` y `/pantalla`.

**Tech Stack:** JS vanilla, CSS puro, Flask solo como passthrough de JSON.

## Global Constraints

- Nuevas secciones en `display_config.json`: `cronometro` y `marcador` (ver
  spec para el esquema completo de cada una).
- El cronómetro nunca queda en tiempo negativo: al llegar a 0 mientras corre,
  pasa a `estado: "detenido"` automáticamente. Solo `control_live.js` hace
  esa auto-transición (escribe al servidor); `pantalla.js` únicamente lee y
  muestra, nunca escribe configuración.
- El formato de tiempo redondea hacia arriba (`Math.ceil`) los segundos
  restantes antes de formatear, para que el último segundo visible sea
  "00:00:01".
- Los tantos del marcador tienen piso en 0 (nunca negativos).
- Ambos widgets: posición/tamaño/fuente/color se editan en el panel lateral
  (mismo patrón que Ticker/Vivo — selector de 10 fuentes fijas +
  personalizada, tamaño, negrita, cursiva, color de texto y de fondo). Los
  controles operativos (Inicio/Stop/Restablecer, +/-, nombres de equipo, y el
  checkbox "Mostrar" de cada uno) van en un bloque fijo debajo del lienzo,
  siempre visible, no en el panel lateral.
- No hay suite de tests automatizados en este proyecto. Verificación:
  `node --check` (con el workaround ya establecido en este proyecto para
  `export`/`??`/`?.`), balance de llaves para CSS, y verificación manual en
  navegador real.

---

## Task 1: Backend + controles operativos en el HTML

**Files:**
- Modify: `app/routes/graphs.py:492`
- Modify: `app/templates/control_live.html`

**Interfaces:**
- Produces: los IDs de HTML (`cron-*`, `marc-*`) que Task 2 usa para sus
  listeners. Secciones `cronometro`/`marcador` aceptadas por
  `/update_display_config`.

- [ ] **Step 1: Aceptar las nuevas secciones en el backend**

En `app/routes/graphs.py`, dentro de `update_display_config`, reemplazar:

```python
        for section in ['live', 'ticker', 'mosca']:
```

por:

```python
        for section in ['live', 'ticker', 'mosca', 'cronometro', 'marcador']:
```

- [ ] **Step 2: Agregar las cards de controles operativos debajo del lienzo**

En `app/templates/control_live.html`, dentro de la columna `col-md-6` que ya
contiene `#lienzo-wrapper` y la card de checkboxes Ticker/Vivo/Mosca +
"Sacar del aire", agregar DOS cards nuevas inmediatamente después de esa card
existente (antes del cierre de `</div>` de la columna `col-md-6`):

```html
            <div class="card p-2 mt-2">
                <strong class="mb-2">Cronómetro</strong>
                <div class="d-flex flex-wrap align-items-center" style="gap: 0.75rem;">
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" id="cron-mostrar">
                        <label class="form-check-label" for="cron-mostrar">Mostrar</label>
                    </div>
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" id="cron-mostrar-horas">
                        <label class="form-check-label" for="cron-mostrar-horas">Mostrar horas</label>
                    </div>
                    <div class="input-group input-group-sm" style="width: auto;">
                        <input type="number" class="form-control" id="cron-horas" min="0" style="width: 60px;" placeholder="HH">
                        <input type="number" class="form-control" id="cron-minutos" min="0" max="59" style="width: 60px;" placeholder="MM">
                        <input type="number" class="form-control" id="cron-segundos" min="0" max="59" style="width: 60px;" placeholder="SS">
                    </div>
                    <span id="cron-display" class="font-weight-bold" style="min-width: 80px;">00:00</span>
                    <button class="btn btn-success btn-sm" id="cron-btn-inicio">Inicio</button>
                    <button class="btn btn-warning btn-sm" id="cron-btn-stop">Stop</button>
                    <button class="btn btn-outline-secondary btn-sm" id="cron-btn-restablecer">Restablecer</button>
                </div>
            </div>
            <div class="card p-2 mt-2">
                <strong class="mb-2">Marcador</strong>
                <div class="d-flex flex-wrap align-items-center" style="gap: 0.75rem;">
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" id="marc-mostrar">
                        <label class="form-check-label" for="marc-mostrar">Mostrar</label>
                    </div>
                    <input type="text" class="form-control form-control-sm" id="marc-nombre-1" style="width: 120px;" placeholder="Equipo 1">
                    <button class="btn btn-outline-secondary btn-sm" id="marc-menos-1">-</button>
                    <span id="marc-tantos-1" class="font-weight-bold" style="min-width: 24px; text-align: center;">0</span>
                    <button class="btn btn-outline-secondary btn-sm" id="marc-mas-1">+</button>
                    <span class="mx-2">-</span>
                    <button class="btn btn-outline-secondary btn-sm" id="marc-menos-2">-</button>
                    <span id="marc-tantos-2" class="font-weight-bold" style="min-width: 24px; text-align: center;">0</span>
                    <button class="btn btn-outline-secondary btn-sm" id="marc-mas-2">+</button>
                    <input type="text" class="form-control form-control-sm" id="marc-nombre-2" style="width: 120px;" placeholder="Equipo 2">
                    <button class="btn btn-outline-secondary btn-sm" id="marc-reiniciar">Reiniciar</button>
                </div>
            </div>
```

- [ ] **Step 3: Verificación**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
.venv/bin/python -c "
from app import create_app
app = create_app()
client = app.test_client()
resp = client.post('/update_display_config', json={'cronometro': {'show': True}})
print('POST cronometro ->', resp.status_code, resp.get_json())
resp = client.post('/update_display_config', json={'marcador': {'show': True}})
print('POST marcador ->', resp.status_code, resp.get_json())
resp = client.get('/get_display_config')
data = resp.get_json()
print('cronometro en config:', 'cronometro' in data, '| marcador en config:', 'marcador' in data)
"
```

Expected: ambos POST devuelven 200, y el GET final confirma que
`cronometro`/`marcador` quedaron persistidos. Luego revertir el efecto de
la prueba (dejar `display_config.json` como estaba, quitando las claves
`cronometro`/`marcador` que este script haya escrito, o simplemente
ponerlas en `{"show": false}` si ya existían de una prueba anterior — no
dejar el archivo con datos de prueba distintos a los que tenía antes de
este paso).

Abrir `http://localhost:5070/control_live/<algún guion id>` (levantar con
`FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5070`) y
confirmar visualmente que las dos cards nuevas aparecen debajo del lienzo,
con todos los controles visibles (aunque todavía sin funcionalidad — eso es
Task 2). Parar el servidor al terminar.

- [ ] **Step 4: Commit**

Nota para quien ejecute esta tarea: ambos archivos pueden tener cambios
preexistentes sin commitear ajenos a este plan en el working tree (aunque en
esta rama nueva, creada específicamente para este trabajo, es más probable
que estén limpios — verificar con `git status` antes de decidir). Si hay
cambios ajenos mezclados, no hacer `git add`/`git commit` del archivo
completo — dejar los cambios en el working tree para que el controller
extraiga un commit quirúrgico, mismo procedimiento ya usado en planes
anteriores de este proyecto.

Si los archivos están limpios en el momento de ejecutar esta tarea:

```bash
git add app/routes/graphs.py app/templates/control_live.html
git commit -m "feat: aceptar secciones cronometro/marcador y agregar sus controles operativos al HTML"
```

---

## Task 2: Editor — lógica y preview de ambos widgets en `control_live.js`

**Files:**
- Modify: `app/static/js/control_live.js` (múltiples puntos, ver steps)

**Interfaces:**
- Consumes: los IDs de HTML de Task 1 (`cron-*`, `marc-*`).
- Produces: `cronometroState`, `marcadorState` — persistidos en
  `display_config.json` vía `guardarSeccion('cronometro'/'marcador', ...)`,
  consumidos por Task 3 (`pantalla.js`) tal cual, sin transformación de
  backend.

- [ ] **Step 1: Agregar el estado de módulo**

Reemplazar:

```javascript
let tickerState = {};
let liveState = {};
let moscaState = {};
let plantillaActual = null;
let elementoSeleccionado = null; // 'ticker' | 'live' | 'mosca' | null
```

por:

```javascript
let tickerState = {};
let liveState = {};
let moscaState = {};
let cronometroState = {};
let marcadorState = {};
let plantillaActual = null;
let elementoSeleccionado = null; // 'ticker' | 'live' | 'mosca' | 'cronometro' | 'marcador' | null
let cronometroTerminado = false; // evita repetir el guardado de auto-detención en cada tick
```

- [ ] **Step 2: Cargar el estado en `cargarConfig`**

Reemplazar:

```javascript
    moscaState = {
        show: !!(config.mosca && config.mosca.show),
        capa: (config.mosca && config.mosca.capa) || null,
    };

    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

por:

```javascript
    moscaState = {
        show: !!(config.mosca && config.mosca.show),
        capa: (config.mosca && config.mosca.capa) || null,
    };

    cronometroState = {
        show: !!(config.cronometro && config.cronometro.show),
        left: parseFloat(config.cronometro && config.cronometro.left) || 0,
        top: parseFloat(config.cronometro && config.cronometro.top) || 0,
        width: parseFloat(config.cronometro && config.cronometro.width) || 300,
        height: parseFloat(config.cronometro && config.cronometro.height) || 80,
        mostrar_horas: (config.cronometro && config.cronometro.mostrar_horas) !== undefined ? !!config.cronometro.mostrar_horas : true,
        duracion_horas: parseInt(config.cronometro && config.cronometro.duracion_horas) || 0,
        duracion_minutos: config.cronometro && config.cronometro.duracion_minutos !== undefined ? parseInt(config.cronometro.duracion_minutos) : 5,
        duracion_segundos: parseInt(config.cronometro && config.cronometro.duracion_segundos) || 0,
        estado: (config.cronometro && config.cronometro.estado) || 'detenido',
        epoch_inicio: (config.cronometro && config.cronometro.epoch_inicio) || null,
        segundos_restantes: (config.cronometro && config.cronometro.segundos_restantes) !== undefined ? config.cronometro.segundos_restantes : null,
        fuente: (config.cronometro && config.cronometro.fuente) || 'Arial',
        tamano_fuente: parseFloat(config.cronometro && config.cronometro.tamano_fuente) || 40,
        negrita: (config.cronometro && config.cronometro.negrita) !== undefined ? !!config.cronometro.negrita : true,
        cursiva: !!(config.cronometro && config.cronometro.cursiva),
        color: (config.cronometro && config.cronometro.color) || '#ffffff',
        bg_color: (config.cronometro && config.cronometro.bg_color) || '#000000',
    };

    marcadorState = {
        show: !!(config.marcador && config.marcador.show),
        left: parseFloat(config.marcador && config.marcador.left) || 0,
        top: parseFloat(config.marcador && config.marcador.top) || 0,
        width: parseFloat(config.marcador && config.marcador.width) || 400,
        height: parseFloat(config.marcador && config.marcador.height) || 100,
        nombre_equipo_1: (config.marcador && config.marcador.nombre_equipo_1) || 'Equipo 1',
        nombre_equipo_2: (config.marcador && config.marcador.nombre_equipo_2) || 'Equipo 2',
        tantos_equipo_1: parseInt(config.marcador && config.marcador.tantos_equipo_1) || 0,
        tantos_equipo_2: parseInt(config.marcador && config.marcador.tantos_equipo_2) || 0,
        fuente: (config.marcador && config.marcador.fuente) || 'Arial',
        tamano_fuente: parseFloat(config.marcador && config.marcador.tamano_fuente) || 36,
        negrita: (config.marcador && config.marcador.negrita) !== undefined ? !!config.marcador.negrita : true,
        cursiva: !!(config.marcador && config.marcador.cursiva),
        color: (config.marcador && config.marcador.color) || '#ffffff',
        bg_color: (config.marcador && config.marcador.bg_color) || '#000000',
    };

    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

- [ ] **Step 3: Funciones puras de tiempo (nuevas, en cualquier punto de
  nivel superior del archivo, por ejemplo justo antes de `crearElementoTicker`)**

```javascript
function segundosRestantesCronometro(cfg) {
    const duracionTotal = (cfg.duracion_horas || 0) * 3600 + (cfg.duracion_minutos || 0) * 60 + (cfg.duracion_segundos || 0);
    if (cfg.estado === 'corriendo' && cfg.epoch_inicio) {
        return Math.max(0, duracionTotal - (Date.now() / 1000 - cfg.epoch_inicio));
    }
    if (cfg.estado === 'pausado' && cfg.segundos_restantes !== null) {
        return cfg.segundos_restantes;
    }
    return duracionTotal;
}

function formatearTiempoCronometro(segundos, mostrarHoras) {
    const totalSeg = Math.ceil(segundos);
    if (mostrarHoras) {
        const h = Math.floor(totalSeg / 3600);
        const m = Math.floor((totalSeg % 3600) / 60);
        const s = totalSeg % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const m = Math.floor(totalSeg / 60);
    const s = totalSeg % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

- [ ] **Step 4: Acciones del cronómetro (nuevas, junto a las funciones del Step 3)**

```javascript
function iniciarCronometro() {
    const duracionTotal = (cronometroState.duracion_horas || 0) * 3600 + (cronometroState.duracion_minutos || 0) * 60 + (cronometroState.duracion_segundos || 0);
    if (cronometroState.estado === 'detenido') {
        cronometroState.epoch_inicio = Date.now() / 1000;
    } else if (cronometroState.estado === 'pausado') {
        cronometroState.epoch_inicio = Date.now() / 1000 - (duracionTotal - cronometroState.segundos_restantes);
    } else {
        return;
    }
    cronometroState.estado = 'corriendo';
    cronometroState.segundos_restantes = null;
    cronometroTerminado = false;
    guardarSeccion('cronometro', cronometroState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}

function pausarCronometro() {
    if (cronometroState.estado !== 'corriendo') return;
    cronometroState.segundos_restantes = segundosRestantesCronometro(cronometroState);
    cronometroState.estado = 'pausado';
    cronometroState.epoch_inicio = null;
    guardarSeccion('cronometro', cronometroState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}

function restablecerCronometro() {
    cronometroState.estado = 'detenido';
    cronometroState.epoch_inicio = null;
    cronometroState.segundos_restantes = null;
    cronometroTerminado = false;
    guardarSeccion('cronometro', cronometroState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}
```

- [ ] **Step 5: Acciones del marcador (nuevas, junto a las anteriores)**

```javascript
function sumarTanto(equipo) {
    if (equipo === 1) marcadorState.tantos_equipo_1 += 1;
    else marcadorState.tantos_equipo_2 += 1;
    guardarSeccion('marcador', marcadorState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}

function restarTanto(equipo) {
    if (equipo === 1) marcadorState.tantos_equipo_1 = Math.max(0, marcadorState.tantos_equipo_1 - 1);
    else marcadorState.tantos_equipo_2 = Math.max(0, marcadorState.tantos_equipo_2 - 1);
    guardarSeccion('marcador', marcadorState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}

function reiniciarMarcador() {
    marcadorState.tantos_equipo_1 = 0;
    marcadorState.tantos_equipo_2 = 0;
    guardarSeccion('marcador', marcadorState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}
```

- [ ] **Step 6: Preview en el lienzo — `crearElementoCronometro`/
  `crearElementoMarcador` (nuevas, junto a `crearElementoTicker`)**

```javascript
function crearElementoCronometro() {
    const el = document.createElement('div');
    el.id = 'cronometro-editor';
    el.className = 'elemento-control elemento-editable' + (elementoSeleccionado === 'cronometro' ? ' seleccionada' : '');
    el.style.left = `${cronometroState.left}px`;
    el.style.top = `${cronometroState.top}px`;
    el.style.width = `${cronometroState.width}px`;
    el.style.height = `${cronometroState.height}px`;
    el.style.backgroundColor = cronometroState.bg_color;
    el.style.color = cronometroState.color;
    el.style.zIndex = 900;
    el.style.opacity = cronometroState.show ? '1' : '0.35';
    el.style.fontFamily = cronometroState.fuente;
    el.style.fontSize = `${cronometroState.tamano_fuente}px`;
    el.style.fontWeight = cronometroState.negrita ? 'bold' : 'normal';
    el.style.fontStyle = cronometroState.cursiva ? 'italic' : 'normal';
    el.textContent = formatearTiempoCronometro(segundosRestantesCronometro(cronometroState), cronometroState.mostrar_horas);

    el.addEventListener('mousedown', iniciarArrastreCronometro);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarElemento('cronometro');
    });

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.addEventListener('mousedown', iniciarResizeCronometro);
    el.appendChild(handle);

    return el;
}

function crearElementoMarcador() {
    const el = document.createElement('div');
    el.id = 'marcador-editor';
    el.className = 'elemento-control elemento-editable' + (elementoSeleccionado === 'marcador' ? ' seleccionada' : '');
    el.style.left = `${marcadorState.left}px`;
    el.style.top = `${marcadorState.top}px`;
    el.style.width = `${marcadorState.width}px`;
    el.style.height = `${marcadorState.height}px`;
    el.style.backgroundColor = marcadorState.bg_color;
    el.style.color = marcadorState.color;
    el.style.zIndex = 900;
    el.style.opacity = marcadorState.show ? '1' : '0.35';
    el.style.fontFamily = marcadorState.fuente;
    el.style.fontSize = `${marcadorState.tamano_fuente}px`;
    el.style.fontWeight = marcadorState.negrita ? 'bold' : 'normal';
    el.style.fontStyle = marcadorState.cursiva ? 'italic' : 'normal';
    el.textContent = `${marcadorState.nombre_equipo_1} ${marcadorState.tantos_equipo_1} - ${marcadorState.tantos_equipo_2} ${marcadorState.nombre_equipo_2}`;

    el.addEventListener('mousedown', iniciarArrastreMarcador);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarElemento('marcador');
    });

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.addEventListener('mousedown', iniciarResizeMarcador);
    el.appendChild(handle);

    return el;
}
```

- [ ] **Step 7: Agregarlos a `renderizarLienzo`**

Reemplazar:

```javascript
    lienzo.appendChild(crearElementoTicker());
    lienzo.appendChild(crearElementoLive());
    const elMosca = crearElementoMosca();
    if (elMosca) lienzo.appendChild(elMosca);

    renderizarPanelControlRapido();
```

por:

```javascript
    lienzo.appendChild(crearElementoTicker());
    lienzo.appendChild(crearElementoLive());
    const elMosca = crearElementoMosca();
    if (elMosca) lienzo.appendChild(elMosca);
    lienzo.appendChild(crearElementoCronometro());
    lienzo.appendChild(crearElementoMarcador());

    renderizarPanelControlRapido();
```

- [ ] **Step 8: Arrastre y resize de ambos widgets (nuevos, junto al bloque
  de arrastre/resize del ticker)**

```javascript
let arrastreCronometro = null;

function iniciarArrastreCronometro(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('cronometro');
    arrastreCronometro = {
        xInicial: e.clientX, yInicial: e.clientY,
        leftInicial: cronometroState.left, topInicial: cronometroState.top,
    };
    document.addEventListener('mousemove', moverArrastreCronometro);
    document.addEventListener('mouseup', finalizarArrastreCronometro);
}

function moverArrastreCronometro(e) {
    if (!arrastreCronometro) return;
    const deltaX = (e.clientX - arrastreCronometro.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastreCronometro.yInicial) / ESCALA_LIENZO;
    cronometroState.left = Math.max(0, Math.round(arrastreCronometro.leftInicial + deltaX));
    cronometroState.top = Math.max(0, Math.round(arrastreCronometro.topInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastreCronometro() {
    if (!arrastreCronometro) return;
    arrastreCronometro = null;
    document.removeEventListener('mousemove', moverArrastreCronometro);
    document.removeEventListener('mouseup', finalizarArrastreCronometro);
    guardarSeccion('cronometro', cronometroState);
    renderizarPanelPropiedades();
}

let resizeCronometro = null;

function iniciarResizeCronometro(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('cronometro');
    resizeCronometro = {
        xInicial: e.clientX, yInicial: e.clientY,
        anchoInicial: cronometroState.width, alturaInicial: cronometroState.height,
    };
    document.addEventListener('mousemove', moverResizeCronometro);
    document.addEventListener('mouseup', finalizarResizeCronometro);
}

function moverResizeCronometro(e) {
    if (!resizeCronometro) return;
    const deltaX = (e.clientX - resizeCronometro.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - resizeCronometro.yInicial) / ESCALA_LIENZO;
    cronometroState.width = Math.max(20, Math.round(resizeCronometro.anchoInicial + deltaX));
    cronometroState.height = Math.max(10, Math.round(resizeCronometro.alturaInicial + deltaY));
    renderizarLienzo();
}

function finalizarResizeCronometro() {
    if (!resizeCronometro) return;
    resizeCronometro = null;
    document.removeEventListener('mousemove', moverResizeCronometro);
    document.removeEventListener('mouseup', finalizarResizeCronometro);
    guardarSeccion('cronometro', cronometroState);
    renderizarPanelPropiedades();
}

let arrastreMarcador = null;

function iniciarArrastreMarcador(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('marcador');
    arrastreMarcador = {
        xInicial: e.clientX, yInicial: e.clientY,
        leftInicial: marcadorState.left, topInicial: marcadorState.top,
    };
    document.addEventListener('mousemove', moverArrastreMarcador);
    document.addEventListener('mouseup', finalizarArrastreMarcador);
}

function moverArrastreMarcador(e) {
    if (!arrastreMarcador) return;
    const deltaX = (e.clientX - arrastreMarcador.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastreMarcador.yInicial) / ESCALA_LIENZO;
    marcadorState.left = Math.max(0, Math.round(arrastreMarcador.leftInicial + deltaX));
    marcadorState.top = Math.max(0, Math.round(arrastreMarcador.topInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastreMarcador() {
    if (!arrastreMarcador) return;
    arrastreMarcador = null;
    document.removeEventListener('mousemove', moverArrastreMarcador);
    document.removeEventListener('mouseup', finalizarArrastreMarcador);
    guardarSeccion('marcador', marcadorState);
    renderizarPanelPropiedades();
}

let resizeMarcador = null;

function iniciarResizeMarcador(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('marcador');
    resizeMarcador = {
        xInicial: e.clientX, yInicial: e.clientY,
        anchoInicial: marcadorState.width, alturaInicial: marcadorState.height,
    };
    document.addEventListener('mousemove', moverResizeMarcador);
    document.addEventListener('mouseup', finalizarResizeMarcador);
}

function moverResizeMarcador(e) {
    if (!resizeMarcador) return;
    const deltaX = (e.clientX - resizeMarcador.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - resizeMarcador.yInicial) / ESCALA_LIENZO;
    marcadorState.width = Math.max(20, Math.round(resizeMarcador.anchoInicial + deltaX));
    marcadorState.height = Math.max(10, Math.round(resizeMarcador.alturaInicial + deltaY));
    renderizarLienzo();
}

function finalizarResizeMarcador() {
    if (!resizeMarcador) return;
    resizeMarcador = null;
    document.removeEventListener('mousemove', moverResizeMarcador);
    document.removeEventListener('mouseup', finalizarResizeMarcador);
    guardarSeccion('marcador', marcadorState);
    renderizarPanelPropiedades();
}
```

- [ ] **Step 9: Panel lateral de propiedades — bloques `cronometro` y
  `marcador` en `renderizarPanelPropiedades`**

Reemplazar:

```javascript
    if (elementoSeleccionado === 'mosca') {
        panel.innerHTML = `
            <h6>Mosca</h6>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-mosca-show" ${moscaState.show ? 'checked' : ''}>
                <label class="form-check-label" for="prop-mosca-show">Mostrar</label>
            </div>
            <small class="text-muted">La posición y el tamaño se definen en el editor de Plantillas, en la capa marcada como Mosca.</small>
        `;

        document.getElementById('prop-mosca-show').addEventListener('change', (e) => {
            moscaState.show = e.target.checked;
            guardarSeccion('mosca', { show: moscaState.show });
            renderizarLienzo();
        });
        return;
    }

    panel.innerHTML = '<p class="text-muted">Seleccioná el ticker, el badge Vivo o la Mosca para editar sus propiedades.</p>';
}
```

por:

```javascript
    if (elementoSeleccionado === 'mosca') {
        panel.innerHTML = `
            <h6>Mosca</h6>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-mosca-show" ${moscaState.show ? 'checked' : ''}>
                <label class="form-check-label" for="prop-mosca-show">Mostrar</label>
            </div>
            <small class="text-muted">La posición y el tamaño se definen en el editor de Plantillas, en la capa marcada como Mosca.</small>
        `;

        document.getElementById('prop-mosca-show').addEventListener('change', (e) => {
            moscaState.show = e.target.checked;
            guardarSeccion('mosca', { show: moscaState.show });
            renderizarLienzo();
        });
        return;
    }

    if (elementoSeleccionado === 'cronometro') {
        panel.innerHTML = `
            <h6>Cronómetro</h6>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-cron-top" value="${cronometroState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-cron-height" value="${cronometroState.height}"></div>
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-cron-left" value="${cronometroState.left}"></div>
                <div class="col-6 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-cron-width" value="${cronometroState.width}"></div>
            </div>
            <div class="form-group mb-2">
                <label>Color texto</label>
                <input type="color" class="form-control" id="prop-cron-color" value="${cronometroState.color}">
            </div>
            <div class="form-group mb-2">
                <label>Color fondo</label>
                <input type="color" class="form-control" id="prop-cron-bgcolor" value="${cronometroState.bg_color}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-cron-fuente">
                    ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(cronometroState.fuente) && cronometroState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                    <option value="__custom__" ${!FUENTES_FIJAS.includes(cronometroState.fuente) ? 'selected' : ''}>Personalizada...</option>
                </select>
                <input type="text" class="form-control mt-1" id="prop-cron-fuente-custom" value="${cronometroState.fuente}" style="${!FUENTES_FIJAS.includes(cronometroState.fuente) ? '' : 'display:none;'}">
            </div>
            <div class="form-group mb-2">
                <label>Tamaño de fuente</label>
                <input type="number" class="form-control" id="prop-cron-tamano" value="${cronometroState.tamano_fuente}">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-cron-negrita" ${cronometroState.negrita ? 'checked' : ''}>
                <label class="form-check-label" for="prop-cron-negrita">Negrita</label>
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-cron-cursiva" ${cronometroState.cursiva ? 'checked' : ''}>
                <label class="form-check-label" for="prop-cron-cursiva">Cursiva</label>
            </div>
        `;

        document.getElementById('prop-cron-top').addEventListener('blur', (e) => {
            cronometroState.top = parseFloat(e.target.value) || 0;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-height').addEventListener('blur', (e) => {
            cronometroState.height = Math.max(10, parseFloat(e.target.value) || 10);
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-left').addEventListener('blur', (e) => {
            cronometroState.left = parseFloat(e.target.value) || 0;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-width').addEventListener('blur', (e) => {
            cronometroState.width = Math.max(20, parseFloat(e.target.value) || 20);
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-color').addEventListener('change', (e) => {
            cronometroState.color = e.target.value;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-bgcolor').addEventListener('change', (e) => {
            cronometroState.bg_color = e.target.value;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-fuente').addEventListener('change', (e) => {
            const inputCustom = document.getElementById('prop-cron-fuente-custom');
            if (e.target.value === '__custom__') {
                inputCustom.style.display = '';
                inputCustom.focus();
            } else {
                inputCustom.style.display = 'none';
                cronometroState.fuente = e.target.value;
                guardarSeccion('cronometro', cronometroState);
                renderizarLienzo();
            }
        });
        document.getElementById('prop-cron-fuente-custom').addEventListener('change', (e) => {
            cronometroState.fuente = e.target.value;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-tamano').addEventListener('blur', (e) => {
            cronometroState.tamano_fuente = parseFloat(e.target.value) || 40;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-negrita').addEventListener('change', (e) => {
            cronometroState.negrita = e.target.checked;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-cursiva').addEventListener('change', (e) => {
            cronometroState.cursiva = e.target.checked;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        return;
    }

    if (elementoSeleccionado === 'marcador') {
        panel.innerHTML = `
            <h6>Marcador</h6>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-marc-top" value="${marcadorState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-marc-height" value="${marcadorState.height}"></div>
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-marc-left" value="${marcadorState.left}"></div>
                <div class="col-6 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-marc-width" value="${marcadorState.width}"></div>
            </div>
            <div class="form-group mb-2">
                <label>Color texto</label>
                <input type="color" class="form-control" id="prop-marc-color" value="${marcadorState.color}">
            </div>
            <div class="form-group mb-2">
                <label>Color fondo</label>
                <input type="color" class="form-control" id="prop-marc-bgcolor" value="${marcadorState.bg_color}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-marc-fuente">
                    ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(marcadorState.fuente) && marcadorState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                    <option value="__custom__" ${!FUENTES_FIJAS.includes(marcadorState.fuente) ? 'selected' : ''}>Personalizada...</option>
                </select>
                <input type="text" class="form-control mt-1" id="prop-marc-fuente-custom" value="${marcadorState.fuente}" style="${!FUENTES_FIJAS.includes(marcadorState.fuente) ? '' : 'display:none;'}">
            </div>
            <div class="form-group mb-2">
                <label>Tamaño de fuente</label>
                <input type="number" class="form-control" id="prop-marc-tamano" value="${marcadorState.tamano_fuente}">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-marc-negrita" ${marcadorState.negrita ? 'checked' : ''}>
                <label class="form-check-label" for="prop-marc-negrita">Negrita</label>
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-marc-cursiva" ${marcadorState.cursiva ? 'checked' : ''}>
                <label class="form-check-label" for="prop-marc-cursiva">Cursiva</label>
            </div>
        `;

        document.getElementById('prop-marc-top').addEventListener('blur', (e) => {
            marcadorState.top = parseFloat(e.target.value) || 0;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-height').addEventListener('blur', (e) => {
            marcadorState.height = Math.max(10, parseFloat(e.target.value) || 10);
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-left').addEventListener('blur', (e) => {
            marcadorState.left = parseFloat(e.target.value) || 0;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-width').addEventListener('blur', (e) => {
            marcadorState.width = Math.max(20, parseFloat(e.target.value) || 20);
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-color').addEventListener('change', (e) => {
            marcadorState.color = e.target.value;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-bgcolor').addEventListener('change', (e) => {
            marcadorState.bg_color = e.target.value;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-fuente').addEventListener('change', (e) => {
            const inputCustom = document.getElementById('prop-marc-fuente-custom');
            if (e.target.value === '__custom__') {
                inputCustom.style.display = '';
                inputCustom.focus();
            } else {
                inputCustom.style.display = 'none';
                marcadorState.fuente = e.target.value;
                guardarSeccion('marcador', marcadorState);
                renderizarLienzo();
            }
        });
        document.getElementById('prop-marc-fuente-custom').addEventListener('change', (e) => {
            marcadorState.fuente = e.target.value;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-tamano').addEventListener('blur', (e) => {
            marcadorState.tamano_fuente = parseFloat(e.target.value) || 36;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-negrita').addEventListener('change', (e) => {
            marcadorState.negrita = e.target.checked;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-cursiva').addEventListener('change', (e) => {
            marcadorState.cursiva = e.target.checked;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        return;
    }

    panel.innerHTML = '<p class="text-muted">Seleccioná el ticker, el badge Vivo, la Mosca, el cronómetro o el marcador para editar sus propiedades.</p>';
}
```

- [ ] **Step 10: Sincronizar y conectar los controles operativos debajo del
  lienzo — extender `renderizarPanelControlRapido` y el `DOMContentLoaded`
  inicial**

Reemplazar:

```javascript
function renderizarPanelControlRapido() {
    document.getElementById('panel-mostrar-ticker').checked = !!tickerState.show;
    document.getElementById('panel-mostrar-vivo').checked = !!liveState.show;
    document.getElementById('panel-mostrar-mosca').checked = !!moscaState.show;
}
```

por:

```javascript
function renderizarPanelControlRapido() {
    document.getElementById('panel-mostrar-ticker').checked = !!tickerState.show;
    document.getElementById('panel-mostrar-vivo').checked = !!liveState.show;
    document.getElementById('panel-mostrar-mosca').checked = !!moscaState.show;

    document.getElementById('cron-mostrar').checked = !!cronometroState.show;
    document.getElementById('cron-mostrar-horas').checked = !!cronometroState.mostrar_horas;
    const cronEditable = cronometroState.estado === 'detenido';
    document.getElementById('cron-horas').disabled = !cronEditable;
    document.getElementById('cron-minutos').disabled = !cronEditable;
    document.getElementById('cron-segundos').disabled = !cronEditable;
    if (document.activeElement.id !== 'cron-horas') document.getElementById('cron-horas').value = cronometroState.duracion_horas;
    if (document.activeElement.id !== 'cron-minutos') document.getElementById('cron-minutos').value = cronometroState.duracion_minutos;
    if (document.activeElement.id !== 'cron-segundos') document.getElementById('cron-segundos').value = cronometroState.duracion_segundos;
    document.getElementById('cron-display').textContent = formatearTiempoCronometro(segundosRestantesCronometro(cronometroState), cronometroState.mostrar_horas);

    document.getElementById('marc-mostrar').checked = !!marcadorState.show;
    if (document.activeElement.id !== 'marc-nombre-1') document.getElementById('marc-nombre-1').value = marcadorState.nombre_equipo_1;
    if (document.activeElement.id !== 'marc-nombre-2') document.getElementById('marc-nombre-2').value = marcadorState.nombre_equipo_2;
    document.getElementById('marc-tantos-1').textContent = marcadorState.tantos_equipo_1;
    document.getElementById('marc-tantos-2').textContent = marcadorState.tantos_equipo_2;
}
```

(el chequeo `document.activeElement.id !== '...'` evita pisarle al operador
lo que está escribiendo en ese input mientras lo tiene enfocado — mismo
problema que tendría cualquier input de texto/número re-renderizado en cada
tick del intervalo del Step 12).

Reemplazar el `DOMContentLoaded` inicial:

```javascript
document.addEventListener('DOMContentLoaded', () => {
    aplicarEscalaLienzo();
    cargarConfig();
    setupEventSource();
    document.getElementById('lienzo-control').addEventListener('click', () => {
        seleccionarElemento(null);
    });
    window.addEventListener('resize', aplicarEscalaLienzo);

    document.getElementById('panel-mostrar-ticker').addEventListener('change', (e) => {
        tickerState.show = e.target.checked;
        guardarSeccion('ticker', tickerState);
        renderizarLienzo();
    });
    document.getElementById('panel-mostrar-vivo').addEventListener('change', (e) => {
        liveState.show = e.target.checked;
        guardarSeccion('live', liveState);
        renderizarLienzo();
    });
    document.getElementById('panel-mostrar-mosca').addEventListener('change', (e) => {
        moscaState.show = e.target.checked;
        guardarSeccion('mosca', { show: moscaState.show });
        renderizarLienzo();
    });
});
```

por:

```javascript
document.addEventListener('DOMContentLoaded', () => {
    aplicarEscalaLienzo();
    cargarConfig();
    setupEventSource();
    document.getElementById('lienzo-control').addEventListener('click', () => {
        seleccionarElemento(null);
    });
    window.addEventListener('resize', aplicarEscalaLienzo);

    document.getElementById('panel-mostrar-ticker').addEventListener('change', (e) => {
        tickerState.show = e.target.checked;
        guardarSeccion('ticker', tickerState);
        renderizarLienzo();
    });
    document.getElementById('panel-mostrar-vivo').addEventListener('change', (e) => {
        liveState.show = e.target.checked;
        guardarSeccion('live', liveState);
        renderizarLienzo();
    });
    document.getElementById('panel-mostrar-mosca').addEventListener('change', (e) => {
        moscaState.show = e.target.checked;
        guardarSeccion('mosca', { show: moscaState.show });
        renderizarLienzo();
    });

    document.getElementById('cron-mostrar').addEventListener('change', (e) => {
        cronometroState.show = e.target.checked;
        guardarSeccion('cronometro', cronometroState);
        renderizarLienzo();
    });
    document.getElementById('cron-mostrar-horas').addEventListener('change', (e) => {
        cronometroState.mostrar_horas = e.target.checked;
        guardarSeccion('cronometro', cronometroState);
        renderizarLienzo();
        renderizarPanelControlRapido();
    });
    document.getElementById('cron-horas').addEventListener('blur', (e) => {
        cronometroState.duracion_horas = Math.max(0, parseInt(e.target.value) || 0);
        guardarSeccion('cronometro', cronometroState);
        renderizarLienzo();
        renderizarPanelControlRapido();
    });
    document.getElementById('cron-minutos').addEventListener('blur', (e) => {
        cronometroState.duracion_minutos = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
        guardarSeccion('cronometro', cronometroState);
        renderizarLienzo();
        renderizarPanelControlRapido();
    });
    document.getElementById('cron-segundos').addEventListener('blur', (e) => {
        cronometroState.duracion_segundos = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
        guardarSeccion('cronometro', cronometroState);
        renderizarLienzo();
        renderizarPanelControlRapido();
    });
    document.getElementById('cron-btn-inicio').addEventListener('click', iniciarCronometro);
    document.getElementById('cron-btn-stop').addEventListener('click', pausarCronometro);
    document.getElementById('cron-btn-restablecer').addEventListener('click', restablecerCronometro);

    document.getElementById('marc-mostrar').addEventListener('change', (e) => {
        marcadorState.show = e.target.checked;
        guardarSeccion('marcador', marcadorState);
        renderizarLienzo();
    });
    document.getElementById('marc-nombre-1').addEventListener('blur', (e) => {
        marcadorState.nombre_equipo_1 = e.target.value || 'Equipo 1';
        guardarSeccion('marcador', marcadorState);
        renderizarLienzo();
    });
    document.getElementById('marc-nombre-2').addEventListener('blur', (e) => {
        marcadorState.nombre_equipo_2 = e.target.value || 'Equipo 2';
        guardarSeccion('marcador', marcadorState);
        renderizarLienzo();
    });
    document.getElementById('marc-mas-1').addEventListener('click', () => sumarTanto(1));
    document.getElementById('marc-menos-1').addEventListener('click', () => restarTanto(1));
    document.getElementById('marc-mas-2').addEventListener('click', () => sumarTanto(2));
    document.getElementById('marc-menos-2').addEventListener('click', () => restarTanto(2));
    document.getElementById('marc-reiniciar').addEventListener('click', reiniciarMarcador);

    setInterval(() => {
        if (cronometroState.estado === 'corriendo') {
            if (segundosRestantesCronometro(cronometroState) <= 0 && !cronometroTerminado) {
                cronometroTerminado = true;
                cronometroState.estado = 'detenido';
                cronometroState.epoch_inicio = null;
                cronometroState.segundos_restantes = null;
                guardarSeccion('cronometro', cronometroState);
            }
            renderizarLienzo();
            renderizarPanelControlRapido();
        }
    }, 1000);
});
```

- [ ] **Step 11: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g; s/?\.\([a-zA-Z_]\)/\.\1/g' app/static/js/control_live.js > /tmp/cl_widgets_checkable.js
node --check /tmp/cl_widgets_checkable.js && echo "sintaxis OK"
```

- [ ] **Step 12: Verificación manual completa en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5071
```

Abrir `http://localhost:5071/control_live/<algún guion id>` y probar:

1. Seleccionar el Cronómetro en el lienzo (haciendo click sobre él):
   confirmar que aparece en el panel lateral con sus propiedades de estilo
   (posición/tamaño/color/fuente), y que arrastrarlo/redimensionarlo con el
   mouse actualiza `cronometroState.left/top/width/height`.
2. Con el Cronómetro en 0h 0m 10s, apretar "Inicio": confirmar que
   `#cron-display` cuenta hacia atrás segundo a segundo, y que los inputs
   HH/MM/SS quedan deshabilitados mientras corre.
3. Apretar "Stop" a mitad de camino: confirmar que el conteo se congela en
   el valor mostrado. Apretar "Inicio" de nuevo: confirmar que continúa
   desde donde quedó (no reinicia).
4. Dejar correr hasta 00:00:00: confirmar que se detiene solo (los botones
   HH/MM/SS vuelven a habilitarse, el estado pasa a "detenido").
5. Apretar "Restablecer" en cualquier momento: confirmar que vuelve a
   mostrar la duración configurada completa.
6. Tildar/destildar "Mostrar horas": confirmar que el formato cambia entre
   `HH:MM:SS` y `MM:SS`.
7. Seleccionar el Marcador: confirmar panel lateral de estilo, arrastre y
   resize. Escribir nombres de equipo, sumar/restar tantos con los botones
   +/-, confirmar que no baja de 0. Apretar "Reiniciar": confirmar que
   ambos tantos vuelven a 0 sin tocar los nombres.
8. Recargar la página: confirmar que el estado de ambos widgets (incluido
   el cronómetro corriendo, si estaba corriendo) persiste correctamente.

Restaurar `display_config.json` a un estado limpio si quedó con datos de
prueba que no querés conservar (por ejemplo, `cronometro.show`/
`marcador.show` en `false`). Parar el servidor de prueba al terminar.

- [ ] **Step 13: Commit**

Mismo criterio de git state que Task 1.

```bash
git add app/static/js/control_live.js
git commit -m "feat: lógica y preview de los widgets Cronómetro y Marcador en el editor"
```

---

## Task 3: Salida real — `pantalla.js` + `pantalla.html`

**Files:**
- Modify: `app/templates/pantalla.html`
- Modify: `app/static/js/pantalla.js`

**Interfaces:**
- Consumes: `data.cronometro`/`data.marcador` (llegan tal cual desde
  `display_config.json` vía Task 2, sin transformación de backend).

- [ ] **Step 1: Agregar el CSS y los divs de los overlays**

En `app/templates/pantalla.html`, agregar junto a la regla `#tickerBand`:

```css
        #cronometroBand {
            position: fixed;
            display: none;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            z-index: 900;
        }

        #marcadorBand {
            position: fixed;
            display: none;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            z-index: 900;
        }
```

y en el `<body>`, agregar junto a `<div id="tickerBand">...</div>`:

```html
<div id="cronometroBand"></div>
<div id="marcadorBand"></div>
```

- [ ] **Step 2: Funciones puras de tiempo (mismas que Task 2, duplicadas
  aquí)**

En `app/static/js/pantalla.js`, agregar en cualquier punto de nivel superior
del archivo (por ejemplo junto a `conPx`):

```javascript
function segundosRestantesCronometro(cfg) {
    const duracionTotal = (cfg.duracion_horas || 0) * 3600 + (cfg.duracion_minutos || 0) * 60 + (cfg.duracion_segundos || 0);
    if (cfg.estado === 'corriendo' && cfg.epoch_inicio) {
        return Math.max(0, duracionTotal - (Date.now() / 1000 - cfg.epoch_inicio));
    }
    if (cfg.estado === 'pausado' && cfg.segundos_restantes !== null) {
        return cfg.segundos_restantes;
    }
    return duracionTotal;
}

function formatearTiempoCronometro(segundos, mostrarHoras) {
    const totalSeg = Math.ceil(segundos);
    if (mostrarHoras) {
        const h = Math.floor(totalSeg / 3600);
        const m = Math.floor((totalSeg % 3600) / 60);
        const s = totalSeg % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const m = Math.floor(totalSeg / 60);
    const s = totalSeg % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

- [ ] **Step 3: `updateCronometro`/`updateMarcador` (nuevas, junto a
  `updateMosca`)**

```javascript
let cronometroCfgActual = null;

function updateCronometro(cfg) {
    const band = document.getElementById('cronometroBand');
    if (!cfg || !cfg.show) {
        band.style.display = 'none';
        cronometroCfgActual = null;
        return;
    }
    band.style.left = conPx(cfg.left, '0px');
    band.style.top = conPx(cfg.top, '0px');
    band.style.width = conPx(cfg.width, '300px');
    band.style.height = conPx(cfg.height, '80px');
    band.style.backgroundColor = cfg.bg_color || '#000000';
    band.style.color = cfg.color || '#ffffff';
    band.style.fontFamily = cfg.fuente || 'Arial';
    band.style.fontSize = `${parseFloat(cfg.tamano_fuente) || 40}px`;
    band.style.fontWeight = cfg.negrita !== false ? 'bold' : 'normal';
    band.style.fontStyle = cfg.cursiva ? 'italic' : 'normal';
    band.style.display = 'flex';
    cronometroCfgActual = cfg;
    band.textContent = formatearTiempoCronometro(segundosRestantesCronometro(cfg), cfg.mostrar_horas);
}

function updateMarcador(cfg) {
    const band = document.getElementById('marcadorBand');
    if (!cfg || !cfg.show) {
        band.style.display = 'none';
        return;
    }
    band.style.left = conPx(cfg.left, '0px');
    band.style.top = conPx(cfg.top, '0px');
    band.style.width = conPx(cfg.width, '400px');
    band.style.height = conPx(cfg.height, '100px');
    band.style.backgroundColor = cfg.bg_color || '#000000';
    band.style.color = cfg.color || '#ffffff';
    band.style.fontFamily = cfg.fuente || 'Arial';
    band.style.fontSize = `${parseFloat(cfg.tamano_fuente) || 36}px`;
    band.style.fontWeight = cfg.negrita !== false ? 'bold' : 'normal';
    band.style.fontStyle = cfg.cursiva ? 'italic' : 'normal';
    band.style.display = 'flex';
    band.textContent = `${cfg.nombre_equipo_1 || 'Equipo 1'} ${cfg.tantos_equipo_1 || 0} - ${cfg.tantos_equipo_2 || 0} ${cfg.nombre_equipo_2 || 'Equipo 2'}`;
}
```

- [ ] **Step 4: Llamarlas desde `updateDisplay` y agregar el intervalo de
  refresco propio del cronómetro**

Reemplazar:

```javascript
function updateDisplay(data) {
    updateTicker(data.ticker);
    updateMosca(data.mosca);
```

por:

```javascript
function updateDisplay(data) {
    updateTicker(data.ticker);
    updateMosca(data.mosca);
    updateCronometro(data.cronometro);
    updateMarcador(data.marcador);
```

Y agregar, en cualquier punto de nivel superior del archivo (por ejemplo
justo después de la definición de `updateCronometro`), un intervalo que
reformatee el texto del cronómetro cada segundo sin esperar al próximo
mensaje del SSE:

```javascript
setInterval(() => {
    if (cronometroCfgActual && cronometroCfgActual.show) {
        const band = document.getElementById('cronometroBand');
        band.textContent = formatearTiempoCronometro(segundosRestantesCronometro(cronometroCfgActual), cronometroCfgActual.mostrar_horas);
    }
}, 1000);
```

- [ ] **Step 5: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g; s/?\.\([a-zA-Z_]\)/\.\1/g' app/static/js/pantalla.js > /tmp/pj_widgets_checkable.js
node --check /tmp/pj_widgets_checkable.js && echo "sintaxis OK"
python3 -c "
import re
html = open('app/templates/pantalla.html').read()
css = re.search(r'<style>(.*?)</style>', html, re.DOTALL).group(1)
assert css.count('{') == css.count('}'), 'llaves desbalanceadas'
print('CSS balanceado:', css.count('{'), 'bloques')
"
```

- [ ] **Step 6: Verificación manual end-to-end en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5072
```

Abrir `http://localhost:5072/pantalla`. Como no hay framework de tests,
inyectar datos de prueba en la consola del navegador (mismo enfoque ya usado
varias veces en este proyecto: parchear el módulo para exponer
`updateDisplay` a `window` vía `fetch('/static/js/pantalla.js')` + quitar
`export`). Llamar a:

```javascript
window.updateDisplay({
  ticker: {}, live: {}, mosca: null,
  cronometro: { show: true, left: 100, top: 100, width: 300, height: 80, mostrar_horas: false, duracion_horas: 0, duracion_minutos: 0, duracion_segundos: 10, estado: 'corriendo', epoch_inicio: Date.now() / 1000, segundos_restantes: null, fuente: 'Arial', tamano_fuente: 40, negrita: true, cursiva: false, color: '#ffffff', bg_color: '#000000' },
  marcador: { show: true, left: 100, top: 300, width: 400, height: 100, nombre_equipo_1: 'RIVER', nombre_equipo_2: 'BOCA', tantos_equipo_1: 2, tantos_equipo_2: 1, fuente: 'Arial', tamano_fuente: 36, negrita: true, cursiva: false, color: '#ffffff', bg_color: '#000000' }
});
```

y confirmar visualmente (captura de pantalla) que ambos overlays aparecen en
la posición/tamaño esperados, que el cronómetro cuenta de 10 a 0 segundo a
segundo sin necesidad de volver a llamar `updateDisplay`, y que el marcador
muestra "RIVER 2 - 1 BOCA". Confirmar también que al llamar `updateDisplay`
de nuevo con `cronometro: { show: false }` el overlay desaparece
(`display: none`).

Parar el servidor de prueba al terminar (`pkill -f "flask run --port 5072"`).

- [ ] **Step 7: Commit**

Mismo criterio de git state que las tareas anteriores.

```bash
git add app/static/js/pantalla.js app/templates/pantalla.html
git commit -m "feat: renderizar los widgets Cronómetro y Marcador en la salida real"
```
