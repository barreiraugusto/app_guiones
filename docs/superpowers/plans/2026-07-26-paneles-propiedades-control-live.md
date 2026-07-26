# Paneles de propiedades de Control en Vivo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar en pestañas (Posición/Contenido/Estilo según el
panel) los paneles de propiedades de Ticker, Vivo, Cronómetro y Marcador
en `control_live.js`, mismos campos y mismo modelo de datos, sin tema
oscuro ni menú de acciones (no aplican acá).

**Architecture:** `renderizarPanelPropiedades()` sigue teniendo un bloque
`if (elementoSeleccionado === 'X') { ...; return; }` por panel (no se
fusionan). Dentro de cada uno, los campos existentes se reparten en
bloques `<div style="display:${...}">` según una única variable de estado
compartida `pestanaPropiedadesLiveActiva`, mismo patrón que
`pestanaPropiedadesActiva` en `plantillas.js`. El guard de reseteo
(`nombre !== elementoSeleccionado`) se aplica desde el primer commit para
no repetir el bug de arrastre que hubo que arreglar en `plantillas.js`
(`ee12aa6`).

**Tech Stack:** Flask (Jinja para `control_live.html`), JS vanilla,
Bootstrap 4.1.3 (mismas clases `nav nav-tabs nav-fill` que en
`plantillas.js`, sin plugin de tabs de Bootstrap — igual que allá).

## Global Constraints

- No se toca el modelo de datos (`tickerState`, `liveState`,
  `cronometroState`, `marcadorState`) ni los endpoints de `guardarSeccion`.
- Los `id` de los campos (`prop-ticker-*`, `prop-live-*`, `prop-cron-*`,
  `prop-marc-*`) y sus `addEventListener` existentes no cambian de nombre.
- `pestanaPropiedadesLiveActiva` se resetea a `'posicion'` dentro de
  `seleccionarElemento(nombre)` **solo** cuando `nombre !== elementoSeleccionado`
  — no en cada llamada, porque `iniciarArrastreTicker`/`iniciarResizeTicker`/
  `iniciarArrastreCronometro`/`iniciarResizeCronometro`/
  `iniciarArrastreMarcador`/`iniciarResizeMarcador`/`iniciarArrastreLive`
  llaman a `seleccionarElemento()` en cada `mousedown`, incluso
  re-seleccionando el elemento ya activo.
- Todos los bloques de pestañas de un panel se renderizan siempre los
  tres (o los dos), solo se oculta con `display:none` el que no está
  activo — los `addEventListener` de cada panel apuntan a esos `id` sin
  condición y romperían si un bloque no existiera en el DOM.
- Sin tema oscuro (esta vista queda en claro) y sin menú desplegable de
  acciones (no aplica: no son una lista de capas reordenable).
- No se toca el panel de "Mosca", el panel de composición de graph, ni
  los bloques estáticos de operación (play/stop cronómetro, tantos del
  marcador).
- No hay suite de tests automatizados en este proyecto. Verificación:
  `node --check` para sintaxis + navegador real para comportamiento.

---

## Task 1: Estado compartido, guard de reseteo, CSS, y pestañas de Ticker

**Files:**
- Modify: `app/static/js/control_live.js:12` (variable global)
- Modify: `app/static/js/control_live.js:650-656` (`seleccionarElemento`)
- Modify: `app/static/js/control_live.js:666-728` (panel de Ticker,
  `elementoSeleccionado === 'ticker'`)
- Modify: `app/templates/control_live.html` (bloque `<style>`)

**Interfaces:**
- Produces: `pestanaPropiedadesLiveActiva` (string:
  `'posicion'|'contenido'|'estilo'`), `cambiarPestanaPropiedadesLive(nombre)`.
  Las Tasks 2/3/4 consumen ambas — no vuelvan a declararlas.

- [ ] **Step 1: Agregar el estado de pestaña compartido**

En `app/static/js/control_live.js`, reemplazar (línea 12):

```js
let elementoSeleccionado = null; // 'ticker' | 'live' | 'mosca' | 'cronometro' | 'marcador' | null
```

por:

```js
let elementoSeleccionado = null; // 'ticker' | 'live' | 'mosca' | 'cronometro' | 'marcador' | null
let pestanaPropiedadesLiveActiva = 'posicion'; // 'posicion' | 'contenido' | 'estilo'
```

- [ ] **Step 2: Guard de reseteo en `seleccionarElemento`**

Reemplazar (líneas 650-656):

```js
function seleccionarElemento(nombre) {
    graphComposicionId = null;
    plantillaEnEdicion = null;
    elementoSeleccionado = nombre;
    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

por:

```js
function seleccionarElemento(nombre) {
    if (nombre !== elementoSeleccionado) {
        pestanaPropiedadesLiveActiva = 'posicion';
    }
    graphComposicionId = null;
    plantillaEnEdicion = null;
    elementoSeleccionado = nombre;
    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

- [ ] **Step 3: Verificar sintaxis antes de tocar el panel de Ticker**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
node --check app/static/js/control_live.js && echo "sintaxis OK"
```

Expected: `sintaxis OK`.

- [ ] **Step 4: Función de cambio de pestaña**

Insertar, inmediatamente antes de `function renderizarPanelPropiedades() {`
(línea 658 actual):

```js
function cambiarPestanaPropiedadesLive(nombre) {
    pestanaPropiedadesLiveActiva = nombre;
    renderizarPanelPropiedades();
}

```

- [ ] **Step 5: Reescribir el panel de Ticker con 3 pestañas**

Reemplazar todo el bloque, desde `if (elementoSeleccionado === 'ticker') {`
hasta el `return;` que lo cierra (líneas 666-818 del archivo original:
el `panel.innerHTML` completo más los `addEventListener`), por:

```js
    if (elementoSeleccionado === 'ticker') {
        panel.innerHTML = `
            <h6>Ticker</h6>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-ticker-show" ${tickerState.show ? 'checked' : ''}>
                <label class="form-check-label" for="prop-ticker-show">Mostrar</label>
            </div>
            <ul class="nav nav-tabs nav-fill mb-3" style="font-size: 0.85rem;">
                <li class="nav-item">
                    <button type="button" class="nav-link ${pestanaPropiedadesLiveActiva === 'posicion' ? 'active' : ''}"
                            onclick="cambiarPestanaPropiedadesLive('posicion')">Posición</button>
                </li>
                <li class="nav-item">
                    <button type="button" class="nav-link ${pestanaPropiedadesLiveActiva === 'contenido' ? 'active' : ''}"
                            onclick="cambiarPestanaPropiedadesLive('contenido')">Contenido</button>
                </li>
                <li class="nav-item">
                    <button type="button" class="nav-link ${pestanaPropiedadesLiveActiva === 'estilo' ? 'active' : ''}"
                            onclick="cambiarPestanaPropiedadesLive('estilo')">Estilo</button>
                </li>
            </ul>

            <div style="${pestanaPropiedadesLiveActiva === 'posicion' ? '' : 'display:none;'}">
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-ticker-top" value="${tickerState.top}"></div>
                    <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-ticker-height" value="${tickerState.height}"></div>
                </div>
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-ticker-left" value="${tickerState.left}"></div>
                    <div class="col-6 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-ticker-width" value="${tickerState.width}"></div>
                </div>
                <div class="form-group mb-2">
                    <label>Ángulo</label>
                    <input type="number" class="form-control" id="prop-ticker-angulo" min="-45" max="45" value="${tickerState.angulo}">
                </div>
            </div>

            <div style="${pestanaPropiedadesLiveActiva === 'contenido' ? '' : 'display:none;'}">
                <div class="form-group mb-2">
                    <label>Texto</label>
                    <input type="text" class="form-control" id="prop-ticker-text">
                </div>
                <div class="form-group mb-2">
                    <label>Velocidad (seg/vuelta)</label>
                    <input type="number" class="form-control" id="prop-ticker-speed" min="1" value="${tickerState.speed_seconds}">
                </div>
                <div class="form-group mb-2">
                    <label>Dirección del texto</label>
                    <select class="form-control" id="prop-ticker-scroll-direccion">
                        <option value="izquierda">Derecha → Izquierda</option>
                        <option value="derecha">Izquierda → Derecha</option>
                    </select>
                </div>
            </div>

            <div style="${pestanaPropiedadesLiveActiva === 'estilo' ? '' : 'display:none;'}">
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Color texto</label><input type="color" class="form-control" id="prop-ticker-color" value="${tickerState.color}"></div>
                    <div class="col-6 form-group mb-2"><label>Color fondo</label><input type="color" class="form-control" id="prop-ticker-bgcolor" value="${tickerState.bg_color}"></div>
                </div>
                <div class="row">
                    <div class="col-6 form-group mb-2">
                        <label>Fuente</label>
                        <select class="form-control" id="prop-ticker-fuente">
                            ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(tickerState.fuente) && tickerState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                            <option value="__custom__" ${!FUENTES_FIJAS.includes(tickerState.fuente) ? 'selected' : ''}>Personalizada...</option>
                        </select>
                        <input type="text" class="form-control mt-1" id="prop-ticker-fuente-custom" value="${tickerState.fuente}" style="${!FUENTES_FIJAS.includes(tickerState.fuente) ? '' : 'display:none;'}">
                    </div>
                    <div class="col-6 form-group mb-2">
                        <label>Tamaño de fuente</label>
                        <input type="number" class="form-control" id="prop-ticker-tamano" value="${tickerState.tamano_fuente}">
                    </div>
                </div>
                <div class="row">
                    <div class="col-6 form-check mb-2">
                        <input type="checkbox" class="form-check-input" id="prop-ticker-negrita" ${tickerState.negrita ? 'checked' : ''}>
                        <label class="form-check-label" for="prop-ticker-negrita">Negrita</label>
                    </div>
                    <div class="col-6 form-check mb-2">
                        <input type="checkbox" class="form-check-input" id="prop-ticker-cursiva" ${tickerState.cursiva ? 'checked' : ''}>
                        <label class="form-check-label" for="prop-ticker-cursiva">Cursiva</label>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('prop-ticker-text').value = tickerState.text;

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
        document.getElementById('prop-ticker-left').addEventListener('blur', (e) => {
            tickerState.left = parseFloat(e.target.value) || 0;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-width').addEventListener('blur', (e) => {
            tickerState.width = Math.max(20, parseFloat(e.target.value) || 20);
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-scroll-direccion').value = tickerState.scroll_direccion;
        document.getElementById('prop-ticker-scroll-direccion').addEventListener('change', (e) => {
            tickerState.scroll_direccion = e.target.value;
            guardarSeccion('ticker', tickerState);
        });
        document.getElementById('prop-ticker-angulo').addEventListener('blur', (e) => {
            tickerState.angulo = Math.max(-45, Math.min(45, parseFloat(e.target.value) || 0));
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-fuente').addEventListener('change', (e) => {
            const inputCustom = document.getElementById('prop-ticker-fuente-custom');
            if (e.target.value === '__custom__') {
                inputCustom.style.display = '';
                inputCustom.focus();
            } else {
                inputCustom.style.display = 'none';
                tickerState.fuente = e.target.value;
                guardarSeccion('ticker', tickerState);
                renderizarLienzo();
            }
        });
        document.getElementById('prop-ticker-fuente-custom').addEventListener('change', (e) => {
            tickerState.fuente = e.target.value;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-tamano').addEventListener('blur', (e) => {
            tickerState.tamano_fuente = parseFloat(e.target.value) || 32;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-negrita').addEventListener('change', (e) => {
            tickerState.negrita = e.target.checked;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-cursiva').addEventListener('change', (e) => {
            tickerState.cursiva = e.target.checked;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        return;
    }
```

Nótese: el orden de los `addEventListener` no cambió, solo el HTML que
los envuelve — así que no hace falta re-verificar cada uno por separado,
son copy-paste exacto del original.

- [ ] **Step 6: Agregar la regla CSS del fondo nativo del botón**

En `app/templates/control_live.html`, dentro del bloque `<style>`
existente (`{% block extra_style %}`, líneas 5-72 aproximadamente), al
final del bloque, agregar:

```css
    #panel-propiedades-control .nav-tabs .nav-link { background: transparent; width: 100%; }
```

- [ ] **Step 7: Verificar sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
node --check app/static/js/control_live.js && echo "sintaxis OK"
```

Expected: `sintaxis OK`.

- [ ] **Step 8: Verificación manual en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5087
```

Abrir `http://localhost:5087/control_live` (ajustar la ruta si el
blueprint usa otro path — confirmar con `grep -rn "control_live_bp\|/control_live"`
en `app/routes/` si hace falta), seleccionar el Ticker en el lienzo y
confirmar:

1. Aparecen 3 pestañas (Posición, Contenido, Estilo) sin fondo gris
   nativo detrás de las inactivas (deben verse iguales al fondo blanco
   de la card).
2. "Posición" muestra Top/Alto/Left/Ancho/Ángulo; "Contenido" muestra
   Texto/Velocidad/Dirección; "Estilo" muestra Color texto+fondo,
   Fuente+Tamaño, Negrita+Cursiva, cada par en una fila.
3. Editar un campo de cada pestaña se refleja en el lienzo (igual que
   antes).
4. Arrastrar el Ticker en el lienzo (dispara `finalizarArrastreTicker` →
   `renderizarPanelPropiedades()`) mantiene la pestaña que estaba activa
   en vez de volver a "Posición" — este es el chequeo del bug conocido.
5. Recargar la página y volver a seleccionar el Ticker: los valores
   guardados (`guardarSeccion`) se restauran igual que antes.

Parar el servidor al terminar (`pkill -f "flask run --port 5087"`).

- [ ] **Step 9: Commit**

```bash
git add app/static/js/control_live.js app/templates/control_live.html
git commit -m "feat: pestanas en el panel de propiedades del Ticker en control_live"
```

---

## Task 2: Pestañas del panel de Vivo

**Files:**
- Modify: `app/static/js/control_live.js` (bloque
  `elementoSeleccionado === 'live'`, líneas 820-911 del archivo original)

**Interfaces:**
- Consumes: `pestanaPropiedadesLiveActiva`, `cambiarPestanaPropiedadesLive(nombre)`
  (de Task 1 — ya existen en el archivo, no los vuelvas a declarar).

- [ ] **Step 1: Reescribir el panel de Vivo con 2 pestañas**

Reemplazar todo el bloque, desde `if (elementoSeleccionado === 'live') {`
hasta su `return;` (líneas 820-911 del archivo original: el
`panel.innerHTML` completo más los `addEventListener`), por:

```js
    if (elementoSeleccionado === 'live') {
        panel.innerHTML = `
            <h6>Vivo</h6>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-live-show" ${liveState.show ? 'checked' : ''}>
                <label class="form-check-label" for="prop-live-show">Mostrar</label>
            </div>
            <div class="form-group mb-2">
                <label>Texto</label>
                <input type="text" class="form-control" id="prop-live-text">
            </div>
            <ul class="nav nav-tabs nav-fill mb-3" style="font-size: 0.85rem;">
                <li class="nav-item">
                    <button type="button" class="nav-link ${pestanaPropiedadesLiveActiva === 'posicion' ? 'active' : ''}"
                            onclick="cambiarPestanaPropiedadesLive('posicion')">Posición</button>
                </li>
                <li class="nav-item">
                    <button type="button" class="nav-link ${pestanaPropiedadesLiveActiva === 'estilo' ? 'active' : ''}"
                            onclick="cambiarPestanaPropiedadesLive('estilo')">Estilo</button>
                </li>
            </ul>

            <div style="${pestanaPropiedadesLiveActiva === 'posicion' ? '' : 'display:none;'}">
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-live-top" value="${liveState.top}"></div>
                    <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-live-left" value="${liveState.left}"></div>
                </div>
            </div>

            <div style="${pestanaPropiedadesLiveActiva === 'estilo' ? '' : 'display:none;'}">
                <div class="row">
                    <div class="col-6 form-group mb-2">
                        <label>Fuente</label>
                        <select class="form-control" id="prop-live-fuente">
                            ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(liveState.fuente) && liveState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                            <option value="__custom__" ${!FUENTES_FIJAS.includes(liveState.fuente) ? 'selected' : ''}>Personalizada...</option>
                        </select>
                        <input type="text" class="form-control mt-1" id="prop-live-fuente-custom" value="${liveState.fuente}" style="${!FUENTES_FIJAS.includes(liveState.fuente) ? '' : 'display:none;'}">
                    </div>
                    <div class="col-6 form-group mb-2">
                        <label>Tamaño de fuente</label>
                        <input type="number" class="form-control" id="prop-live-tamano" value="${liveState.tamano_fuente}">
                    </div>
                </div>
                <div class="row">
                    <div class="col-6 form-check mb-2">
                        <input type="checkbox" class="form-check-input" id="prop-live-negrita" ${liveState.negrita ? 'checked' : ''}>
                        <label class="form-check-label" for="prop-live-negrita">Negrita</label>
                    </div>
                    <div class="col-6 form-check mb-2">
                        <input type="checkbox" class="form-check-input" id="prop-live-cursiva" ${liveState.cursiva ? 'checked' : ''}>
                        <label class="form-check-label" for="prop-live-cursiva">Cursiva</label>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('prop-live-text').value = liveState.text;

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
        document.getElementById('prop-live-fuente').addEventListener('change', (e) => {
            const inputCustom = document.getElementById('prop-live-fuente-custom');
            if (e.target.value === '__custom__') {
                inputCustom.style.display = '';
                inputCustom.focus();
            } else {
                inputCustom.style.display = 'none';
                liveState.fuente = e.target.value;
                guardarSeccion('live', liveState);
                renderizarLienzo();
            }
        });
        document.getElementById('prop-live-fuente-custom').addEventListener('change', (e) => {
            liveState.fuente = e.target.value;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-tamano').addEventListener('blur', (e) => {
            liveState.tamano_fuente = parseFloat(e.target.value) || 18;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-negrita').addEventListener('change', (e) => {
            liveState.negrita = e.target.checked;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-cursiva').addEventListener('change', (e) => {
            liveState.cursiva = e.target.checked;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        return;
    }
```

- [ ] **Step 2: Verificar sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
node --check app/static/js/control_live.js && echo "sintaxis OK"
```

- [ ] **Step 3: Verificación manual en navegador**

Levantar el servidor igual que en Task 1 (puerto 5087), seleccionar
"Vivo" en el lienzo y confirmar: 2 pestañas (Posición/Estilo) sin fondo
gris nativo; "Mostrar" y "Texto" quedan visibles arriba de las pestañas
en todo momento; arrastrar el badge de Vivo mantiene la pestaña activa;
los valores persisten al recargar. Parar el servidor al terminar.

- [ ] **Step 4: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: pestanas en el panel de propiedades de Vivo en control_live"
```

---

## Task 3: Pestañas del panel de Cronómetro

**Files:**
- Modify: `app/static/js/control_live.js` (bloque
  `elementoSeleccionado === 'cronometro'`, líneas 931-1053 del archivo
  original)

**Interfaces:**
- Consumes: `pestanaPropiedadesLiveActiva`, `cambiarPestanaPropiedadesLive(nombre)`
  (de Task 1).

- [ ] **Step 1: Reescribir el panel de Cronómetro con 2 pestañas**

Reemplazar todo el bloque, desde `if (elementoSeleccionado === 'cronometro') {`
hasta su `return;` (líneas 931-1053 del archivo original), por:

```js
    if (elementoSeleccionado === 'cronometro') {
        panel.innerHTML = `
            <h6>Cronómetro</h6>
            <ul class="nav nav-tabs nav-fill mb-3" style="font-size: 0.85rem;">
                <li class="nav-item">
                    <button type="button" class="nav-link ${pestanaPropiedadesLiveActiva === 'posicion' ? 'active' : ''}"
                            onclick="cambiarPestanaPropiedadesLive('posicion')">Posición</button>
                </li>
                <li class="nav-item">
                    <button type="button" class="nav-link ${pestanaPropiedadesLiveActiva === 'estilo' ? 'active' : ''}"
                            onclick="cambiarPestanaPropiedadesLive('estilo')">Estilo</button>
                </li>
            </ul>

            <div style="${pestanaPropiedadesLiveActiva === 'posicion' ? '' : 'display:none;'}">
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-cron-top" value="${cronometroState.top}"></div>
                    <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-cron-height" value="${cronometroState.height}"></div>
                </div>
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-cron-left" value="${cronometroState.left}"></div>
                    <div class="col-6 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-cron-width" value="${cronometroState.width}"></div>
                </div>
            </div>

            <div style="${pestanaPropiedadesLiveActiva === 'estilo' ? '' : 'display:none;'}">
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Color texto</label><input type="color" class="form-control" id="prop-cron-color" value="${cronometroState.color}"></div>
                    <div class="col-6 form-group mb-2"><label>Color fondo</label><input type="color" class="form-control" id="prop-cron-bgcolor" value="${cronometroState.bg_color}"></div>
                </div>
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Opacidad de fondo</label><input type="number" class="form-control" id="prop-cron-opacidad-fondo" min="0" max="100" value="${cronometroState.opacidad_fondo}"></div>
                    <div class="col-6 form-group mb-2"><label>Radio de esquina</label><input type="number" class="form-control" id="prop-cron-radio-esquina" min="0" value="${cronometroState.radio_esquina}"></div>
                </div>
                <div class="row">
                    <div class="col-6 form-group mb-2">
                        <label>Fuente</label>
                        <select class="form-control" id="prop-cron-fuente">
                            ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(cronometroState.fuente) && cronometroState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                            <option value="__custom__" ${!FUENTES_FIJAS.includes(cronometroState.fuente) ? 'selected' : ''}>Personalizada...</option>
                        </select>
                        <input type="text" class="form-control mt-1" id="prop-cron-fuente-custom" value="${cronometroState.fuente}" style="${!FUENTES_FIJAS.includes(cronometroState.fuente) ? '' : 'display:none;'}">
                    </div>
                    <div class="col-6 form-group mb-2">
                        <label>Tamaño de fuente</label>
                        <input type="number" class="form-control" id="prop-cron-tamano" value="${cronometroState.tamano_fuente}">
                    </div>
                </div>
                <div class="row">
                    <div class="col-6 form-check mb-2">
                        <input type="checkbox" class="form-check-input" id="prop-cron-negrita" ${cronometroState.negrita ? 'checked' : ''}>
                        <label class="form-check-label" for="prop-cron-negrita">Negrita</label>
                    </div>
                    <div class="col-6 form-check mb-2">
                        <input type="checkbox" class="form-check-input" id="prop-cron-cursiva" ${cronometroState.cursiva ? 'checked' : ''}>
                        <label class="form-check-label" for="prop-cron-cursiva">Cursiva</label>
                    </div>
                </div>
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
        document.getElementById('prop-cron-opacidad-fondo').addEventListener('blur', (e) => {
            cronometroState.opacidad_fondo = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-radio-esquina').addEventListener('blur', (e) => {
            cronometroState.radio_esquina = Math.max(0, parseInt(e.target.value) || 0);
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        return;
    }
```

- [ ] **Step 2: Verificar sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
node --check app/static/js/control_live.js && echo "sintaxis OK"
```

- [ ] **Step 3: Verificación manual en navegador**

Levantar el servidor (puerto 5087), seleccionar el Cronómetro en el
lienzo y confirmar: 2 pestañas sin fondo gris nativo; "Posición" agrupa
Top/Alto y Left/Ancho; "Estilo" agrupa Color texto/fondo, Opacidad/Radio,
Fuente/Tamaño, Negrita/Cursiva, cada par en fila; arrastrar mantiene la
pestaña activa; los valores persisten al recargar. Parar el servidor al
terminar.

- [ ] **Step 4: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: pestanas en el panel de propiedades del Cronometro en control_live"
```

---

## Task 4: Pestañas del panel de Marcador

**Files:**
- Modify: `app/static/js/control_live.js` (bloque
  `elementoSeleccionado === 'marcador'`, líneas 1055-1177 del archivo
  original)

**Interfaces:**
- Consumes: `pestanaPropiedadesLiveActiva`, `cambiarPestanaPropiedadesLive(nombre)`
  (de Task 1).

- [ ] **Step 1: Reescribir el panel de Marcador con 2 pestañas**

Reemplazar todo el bloque, desde `if (elementoSeleccionado === 'marcador') {`
hasta su `return;` (líneas 1055-1177 del archivo original), por:

```js
    if (elementoSeleccionado === 'marcador') {
        panel.innerHTML = `
            <h6>Marcador</h6>
            <ul class="nav nav-tabs nav-fill mb-3" style="font-size: 0.85rem;">
                <li class="nav-item">
                    <button type="button" class="nav-link ${pestanaPropiedadesLiveActiva === 'posicion' ? 'active' : ''}"
                            onclick="cambiarPestanaPropiedadesLive('posicion')">Posición</button>
                </li>
                <li class="nav-item">
                    <button type="button" class="nav-link ${pestanaPropiedadesLiveActiva === 'estilo' ? 'active' : ''}"
                            onclick="cambiarPestanaPropiedadesLive('estilo')">Estilo</button>
                </li>
            </ul>

            <div style="${pestanaPropiedadesLiveActiva === 'posicion' ? '' : 'display:none;'}">
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-marc-top" value="${marcadorState.top}"></div>
                    <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-marc-height" value="${marcadorState.height}"></div>
                </div>
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-marc-left" value="${marcadorState.left}"></div>
                    <div class="col-6 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-marc-width" value="${marcadorState.width}"></div>
                </div>
            </div>

            <div style="${pestanaPropiedadesLiveActiva === 'estilo' ? '' : 'display:none;'}">
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Color texto</label><input type="color" class="form-control" id="prop-marc-color" value="${marcadorState.color}"></div>
                    <div class="col-6 form-group mb-2"><label>Color fondo</label><input type="color" class="form-control" id="prop-marc-bgcolor" value="${marcadorState.bg_color}"></div>
                </div>
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Opacidad de fondo</label><input type="number" class="form-control" id="prop-marc-opacidad-fondo" min="0" max="100" value="${marcadorState.opacidad_fondo}"></div>
                    <div class="col-6 form-group mb-2"><label>Radio de esquina</label><input type="number" class="form-control" id="prop-marc-radio-esquina" min="0" value="${marcadorState.radio_esquina}"></div>
                </div>
                <div class="row">
                    <div class="col-6 form-group mb-2">
                        <label>Fuente</label>
                        <select class="form-control" id="prop-marc-fuente">
                            ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(marcadorState.fuente) && marcadorState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                            <option value="__custom__" ${!FUENTES_FIJAS.includes(marcadorState.fuente) ? 'selected' : ''}>Personalizada...</option>
                        </select>
                        <input type="text" class="form-control mt-1" id="prop-marc-fuente-custom" value="${marcadorState.fuente}" style="${!FUENTES_FIJAS.includes(marcadorState.fuente) ? '' : 'display:none;'}">
                    </div>
                    <div class="col-6 form-group mb-2">
                        <label>Tamaño de fuente</label>
                        <input type="number" class="form-control" id="prop-marc-tamano" value="${marcadorState.tamano_fuente}">
                    </div>
                </div>
                <div class="row">
                    <div class="col-6 form-check mb-2">
                        <input type="checkbox" class="form-check-input" id="prop-marc-negrita" ${marcadorState.negrita ? 'checked' : ''}>
                        <label class="form-check-label" for="prop-marc-negrita">Negrita</label>
                    </div>
                    <div class="col-6 form-check mb-2">
                        <input type="checkbox" class="form-check-input" id="prop-marc-cursiva" ${marcadorState.cursiva ? 'checked' : ''}>
                        <label class="form-check-label" for="prop-marc-cursiva">Cursiva</label>
                    </div>
                </div>
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
        document.getElementById('prop-marc-opacidad-fondo').addEventListener('blur', (e) => {
            marcadorState.opacidad_fondo = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-radio-esquina').addEventListener('blur', (e) => {
            marcadorState.radio_esquina = Math.max(0, parseInt(e.target.value) || 0);
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        return;
    }
```

- [ ] **Step 2: Verificar sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
node --check app/static/js/control_live.js && echo "sintaxis OK"
```

- [ ] **Step 3: Verificación manual en navegador**

Levantar el servidor (puerto 5087), seleccionar el Marcador en el lienzo
y confirmar: 2 pestañas sin fondo gris nativo; mismo agrupamiento que
Cronómetro; arrastrar mantiene la pestaña activa; los valores persisten
al recargar. Además, con los 4 paneles ya terminados (Ticker, Vivo,
Cronómetro, Marcador), hacer una pasada final alternando entre los 4
elementos del lienzo (click en cada uno) y confirmando que cada uno
arranca en "Posición" al seleccionarlo por primera vez, y que no queda
ningún error en la consola del navegador.

Parar el servidor al terminar.

- [ ] **Step 4: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: pestanas en el panel de propiedades del Marcador en control_live"
```
