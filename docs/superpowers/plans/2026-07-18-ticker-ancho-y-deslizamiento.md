# Ticker: ancho configurable y deslizamiento horizontal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer el ancho y la posición horizontal del ticker configurables (inputs +
arrastre/resize con mouse), agregar una animación de entrada/salida fija a la banda
completa del ticker, y permitir elegir la dirección del scroll continuo del texto.

**Architecture:** El ticker no tiene modelo de base de datos — se persiste como JSON
libre en `display_config.json` vía endpoints ya existentes sin validación de campos
(`app/routes/graphs.py:476-517`), así que no hay cambios de backend. Todo el trabajo
es frontend: `control_live.js` (editor visual) y `pantalla.js`/`pantalla.html`
(salida real).

**Tech Stack:** JS vanilla, CSS puro (animaciones vía keyframes + clases, sin
librerías), Flask solo como servidor de archivos estáticos para este feature.

## Global Constraints

- Nuevos campos en la sección `ticker` de `display_config.json`: `left` (default
  `0`), `width` (default `1920`), `scroll_direccion` (default `"izquierda"`).
- La animación de entrada/salida de la banda es fija: siempre desde/hacia la
  derecha, duración fija 400ms, desplazamiento del 100% del propio ancho de la
  banda (`translateX(100%)`, relativo al elemento, no un valor en px fijo). Sin
  controles configurables en el panel para esto.
- `scroll_direccion` acepta `"izquierda"` (comportamiento actual, default) o
  `"derecha"`.
- No se toca el mecanismo de velocidad (`speed_seconds`) del scroll continuo, ni se
  agrega validación de backend.
- No hay suite de tests automatizados en este proyecto. La verificación de JS es
  `node --check` (aplicar el mismo workaround ya usado antes si el archivo contiene
  `export`/`??`: sustituir en una copia scratch antes de chequear) más verificación
  manual en navegador real.

---

## Task 1: Editor de control en vivo — ancho, posición y panel del ticker

**Files:**
- Modify: `app/static/js/control_live.js` (múltiples puntos, ver steps)
- Modify: `app/templates/control_live.html:38-46` (cursor del `.resize-handle`)

**Interfaces:**
- Produces: `tickerState.left`, `tickerState.width`, `tickerState.scroll_direccion`
  — consumidos por Task 3 vía el mismo objeto que ya viaja en el payload SSE de
  `display_config` hacia `pantalla.js` (el campo `ticker` de `display_config.json`
  se sirve tal cual, sin transformación, así que lo que esta tarea persiste es
  exactamente lo que Task 3 leerá).

- [ ] **Step 1: Agregar los nuevos campos a `tickerState` en `cargarConfig`**

En `app/static/js/control_live.js`, dentro de `cargarConfig` (línea ~54-62),
reemplazar:

```javascript
    tickerState = {
        show: !!(config.ticker && config.ticker.show),
        text: (config.ticker && config.ticker.text) || '',
        speed_seconds: parseFloat(config.ticker && config.ticker.speed_seconds) || 15,
        color: (config.ticker && config.ticker.color) || '#ffffff',
        bg_color: (config.ticker && config.ticker.bg_color) || '#000000',
        top: parseFloat(config.ticker && config.ticker.top) || 1000,
        height: parseFloat(config.ticker && config.ticker.height) || 50,
    };
```

por:

```javascript
    tickerState = {
        show: !!(config.ticker && config.ticker.show),
        text: (config.ticker && config.ticker.text) || '',
        speed_seconds: parseFloat(config.ticker && config.ticker.speed_seconds) || 15,
        color: (config.ticker && config.ticker.color) || '#ffffff',
        bg_color: (config.ticker && config.ticker.bg_color) || '#000000',
        top: parseFloat(config.ticker && config.ticker.top) || 1000,
        height: parseFloat(config.ticker && config.ticker.height) || 50,
        left: parseFloat(config.ticker && config.ticker.left) || 0,
        width: parseFloat(config.ticker && config.ticker.width) || ANCHO_LIENZO,
        scroll_direccion: (config.ticker && config.ticker.scroll_direccion) || 'izquierda',
    };
```

- [ ] **Step 2: Usar `tickerState.left`/`tickerState.width` en `crearElementoTicker`**

En la misma función (línea ~262-288), reemplazar:

```javascript
    el.style.left = '0px';
    el.style.width = `${ANCHO_LIENZO}px`;
```

por:

```javascript
    el.style.left = `${tickerState.left}px`;
    el.style.width = `${tickerState.width}px`;
```

- [ ] **Step 3: Verificación manual del Step 1-2**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5054
```

Abrir `http://localhost:5054/control_live`, confirmar en la consola del navegador
que `tickerState.left === 0` y `tickerState.width === 1920` (valores por defecto,
ya que `display_config.json` todavía no tiene esos campos) y que el ticker se ve
ocupando todo el ancho como antes (sin regresión visual).

- [ ] **Step 4: Extender el arrastre para incluir el eje horizontal**

Reemplazar:

```javascript
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
```

por:

```javascript
function iniciarArrastreTicker(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('ticker');
    arrastreTicker = {
        xInicial: e.clientX, yInicial: e.clientY,
        leftInicial: tickerState.left, topInicial: tickerState.top,
    };
    document.addEventListener('mousemove', moverArrastreTicker);
    document.addEventListener('mouseup', finalizarArrastreTicker);
}

function moverArrastreTicker(e) {
    if (!arrastreTicker) return;
    const deltaX = (e.clientX - arrastreTicker.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastreTicker.yInicial) / ESCALA_LIENZO;
    tickerState.left = Math.max(0, Math.round(arrastreTicker.leftInicial + deltaX));
    tickerState.top = Math.max(0, Math.round(arrastreTicker.topInicial + deltaY));
    renderizarLienzo();
}
```

(`finalizarArrastreTicker` no cambia: ya guarda `tickerState` completo).

- [ ] **Step 5: Extender el resize para incluir el ancho**

Reemplazar:

```javascript
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
```

por:

```javascript
function iniciarResizeTicker(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('ticker');
    resizeTicker = {
        xInicial: e.clientX, yInicial: e.clientY,
        anchoInicial: tickerState.width, alturaInicial: tickerState.height,
    };
    document.addEventListener('mousemove', moverResizeTicker);
    document.addEventListener('mouseup', finalizarResizeTicker);
}

function moverResizeTicker(e) {
    if (!resizeTicker) return;
    const deltaX = (e.clientX - resizeTicker.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - resizeTicker.yInicial) / ESCALA_LIENZO;
    tickerState.width = Math.max(20, Math.round(resizeTicker.anchoInicial + deltaX));
    tickerState.height = Math.max(10, Math.round(resizeTicker.alturaInicial + deltaY));
    renderizarLienzo();
}
```

(`finalizarResizeTicker` no cambia).

- [ ] **Step 6: Corregir el cursor del resize-handle a bidireccional**

En `app/templates/control_live.html`, dentro de `.resize-handle` (línea ~38-46),
cambiar:

```css
        cursor: ns-resize;
```

por:

```css
        cursor: se-resize;
```

(mismo cursor ya usado en `app/templates/plantillas.html:61` para el resize-handle
de las capas, que también es bidireccional; este handle en `control_live.html` ya
se comparte con el resize de capas de graphs vía `agregarResizeHandle`, que también
es bidireccional — este cambio corrige una inconsistencia visual preexistente
además de reflejar el nuevo resize horizontal del ticker).

- [ ] **Step 7: Verificación manual del arrastre y resize**

Con el servidor del Step 3 corriendo, en `http://localhost:5054/control_live`:
seleccionar el ticker, arrastrarlo horizontalmente y confirmar que `tickerState.left`
cambia y el elemento se mueve en el lienzo; arrastrar el resize-handle horizontalmente
y confirmar que `tickerState.width` cambia. Confirmar que el cursor sobre el handle
es una flecha diagonal (`se-resize`), no vertical.

- [ ] **Step 8: Agregar los campos Left, Ancho y Dirección al panel de propiedades**

En `renderizarPanelPropiedades`, bloque `elementoSeleccionado === 'ticker'`
(línea ~345-372), reemplazar:

```javascript
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-ticker-top" value="${tickerState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-ticker-height" value="${tickerState.height}"></div>
            </div>
        `;
```

por:

```javascript
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-ticker-top" value="${tickerState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-ticker-height" value="${tickerState.height}"></div>
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-ticker-left" value="${tickerState.left}"></div>
                <div class="col-6 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-ticker-width" value="${tickerState.width}"></div>
            </div>
            <div class="form-group mb-2">
                <label>Dirección del texto</label>
                <select class="form-control" id="prop-ticker-scroll-direccion">
                    <option value="izquierda">Derecha → Izquierda</option>
                    <option value="derecha">Izquierda → Derecha</option>
                </select>
            </div>
        `;
```

- [ ] **Step 9: Agregar los listeners de los nuevos campos del panel**

Inmediatamente después de (sin modificar) el listener existente:

```javascript
        document.getElementById('prop-ticker-height').addEventListener('blur', (e) => {
            tickerState.height = parseFloat(e.target.value) || 10;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        return;
    }
```

insertar, antes del `return;`:

```javascript
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
```

(el `.value = tickerState.scroll_direccion` va antes del listener, mismo patrón ya
usado en el archivo para inicializar selects, p. ej. `prop-anim-entrada` en
`plantillas.js`).

- [ ] **Step 10: Verificación manual del panel completo**

Con el servidor corriendo: abrir el panel de propiedades del ticker, cambiar Left,
Ancho y Dirección desde los inputs, confirmar que el lienzo se actualiza y que
`fetch('/get_display_config')` (recargando la página) devuelve los valores nuevos
persistidos en `ticker.left`, `ticker.width`, `ticker.scroll_direccion`. Parar el
servidor de prueba al terminar (`pkill -f "flask run --port 5054"`).

- [ ] **Step 11: Commit**

Nota para quien ejecute esta tarea: `app/static/js/control_live.js` y
`app/templates/control_live.html` pueden tener cambios preexistentes sin commitear
ajenos a este plan en el working tree. Si ese es el caso, no hacer `git add`/`git
commit` de los archivos completos — dejar los cambios en el working tree y que el
controller (quien ejecuta el plan a nivel de sesión) extraiga un commit quirúrgico
con solo el diff de esta tarea, siguiendo el mismo procedimiento ya usado en el plan
anterior (`docs/superpowers/plans/2026-07-18-enriquecer-texto-plantillas.md`).

Si los archivos están limpios (sin cambios ajenos) en el momento de ejecutar esta
tarea:

```bash
git add app/static/js/control_live.js app/templates/control_live.html
git commit -m "feat: ancho, posición y dirección de scroll configurables para el ticker"
```

---

## Task 2: CSS de animación de entrada/salida y dirección de scroll del ticker

**Files:**
- Modify: `app/templates/pantalla.html:29-51`

**Interfaces:**
- Produces: clases CSS `anim-ticker-enter`, `anim-ticker-exit`,
  `ticker-dir-izquierda`, `ticker-dir-derecha`, y los keyframes
  `tickerSlideIn`/`tickerSlideOut`/`ticker-scroll-izquierda`/`ticker-scroll-derecha`
  — consumidos por Task 3 (`pantalla.js`).

- [ ] **Step 1: Quitar el ancho/posición fijos de `#tickerBand`**

Reemplazar:

```css
        #tickerBand {
            position: fixed;
            left: 0;
            width: 100%;
            display: none;
            align-items: center;
            overflow: hidden;
            box-sizing: border-box;
            z-index: 900;
        }
```

por:

```css
        #tickerBand {
            position: fixed;
            display: none;
            align-items: center;
            overflow: hidden;
            box-sizing: border-box;
            z-index: 900;
        }
```

(`left`/`width` pasan a fijarse por JS inline en Task 3, igual que ya ocurre con
`top`/`height`).

- [ ] **Step 2: Reemplazar `#tickerText`/`@keyframes ticker-scroll` por las dos variantes de dirección**

Reemplazar:

```css
        #tickerText {
            display: inline-block;
            white-space: nowrap;
            padding-left: 100%;
            font-size: 32px;
            font-weight: bold;
        }

        @keyframes ticker-scroll {
            from { transform: translateX(0); }
            to   { transform: translateX(-100%); }
        }
```

por:

```css
        #tickerText {
            display: inline-block;
            white-space: nowrap;
            font-size: 32px;
            font-weight: bold;
        }

        .ticker-dir-izquierda { padding-left: 100%; }
        .ticker-dir-derecha   { padding-left: 100%; }

        @keyframes ticker-scroll-izquierda {
            from { transform: translateX(0); }
            to   { transform: translateX(-100%); }
        }
        @keyframes ticker-scroll-derecha {
            from { transform: translateX(-100%); }
            to   { transform: translateX(0); }
        }
```

(las dos clases usan el mismo `padding-left: 100%` — solo cambia el keyframe. El
padding ubica el texto fuera de la banda al inicio del ciclo, independientemente de
hacia dónde se mueva después; usar `padding-right` en `derecha` deja el texto
detenido y visible en el borde izquierdo en vez de completar el barrido fuera de
pantalla, verificado empíricamente durante la implementación de este plan)

- [ ] **Step 3: Agregar las clases de animación de entrada/salida de la banda**

Junto a las clases `.anim-fade-*`/`.anim-slide-*` ya existentes (línea ~89-97 antes
de este cambio), agregar después del bloque `@keyframes slideOut { ... }`:

```css
        .anim-ticker-enter { animation: tickerSlideIn 400ms ease forwards; }
        .anim-ticker-exit  { animation: tickerSlideOut 400ms ease forwards; }

        @keyframes tickerSlideIn  { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
        @keyframes tickerSlideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(100%); } }
```

- [ ] **Step 4: Verificación de sintaxis CSS**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
python3 -c "
import re
html = open('app/templates/pantalla.html').read()
css = re.search(r'<style>(.*?)</style>', html, re.DOTALL).group(1)
assert css.count('{') == css.count('}'), 'llaves desbalanceadas'
print('CSS balanceado:', css.count('{'), 'bloques')
"
```

Expected: imprime `CSS balanceado: N bloques` sin AssertionError.

- [ ] **Step 5: Commit**

Mismo criterio de git state que Task 1 — verificar si `app/templates/pantalla.html`
tiene cambios ajenos sin commitear antes de decidir entre commit directo o
extracción quirúrgica por parte del controller.

```bash
git add app/templates/pantalla.html
git commit -m "feat: CSS de animación de entrada/salida y dirección de scroll del ticker"
```

---

## Task 3: `pantalla.js` — animar entrada/salida del ticker y aplicar dirección de scroll

**Files:**
- Modify: `app/static/js/pantalla.js:1-5` (variables de módulo)
- Modify: `app/static/js/pantalla.js:135-164` (`updateTicker`)

**Interfaces:**
- Consumes: clases CSS de Task 2 (`anim-ticker-enter`, `anim-ticker-exit`,
  `ticker-dir-izquierda`, `ticker-dir-derecha`, keyframes
  `ticker-scroll-izquierda`/`ticker-scroll-derecha`); campos `ticker.left`,
  `ticker.width`, `ticker.scroll_direccion` de Task 1 (llegan tal cual en el JSON
  de `/stream_display_config`, sin transformación de backend).

- [ ] **Step 1: Agregar variables de módulo para trackear visibilidad y timeout de ocultamiento**

En `app/static/js/pantalla.js`, reemplazar la línea 5:

```javascript
let tickerLastText = null;
```

por:

```javascript
let tickerLastText = null;
let tickerLastDireccion = null;
let tickerVisible = false;
let tickerHideTimeoutId = null;
```

- [ ] **Step 2: Reescribir `updateTicker` con animación de entrada/salida y dirección de scroll**

Reemplazar la función completa:

```javascript
function updateTicker(ticker) {
    const band = document.getElementById('tickerBand');
    const textEl = document.getElementById('tickerText');
    const cfg = ticker || {};

    if (!cfg.show) {
        band.style.display = 'none';
        tickerLastText = null;
        return;
    }

    band.style.top = conPx(cfg.top, '1000px');
    band.style.height = conPx(cfg.height, '50px');
    band.style.backgroundColor = cfg.bg_color || '#000000';
    textEl.style.color = cfg.color || '#ffffff';
    band.style.display = 'flex';

    const speed = parseFloat(cfg.speed_seconds) || 15;
    const text = cfg.text || '';

    if (text !== tickerLastText) {
        textEl.textContent = text;
        textEl.style.animation = 'none';
        void textEl.offsetWidth;
        textEl.style.animation = `ticker-scroll ${speed}s linear infinite`;
        tickerLastText = text;
    } else {
        textEl.style.animationDuration = `${speed}s`;
    }
}
```

por:

```javascript
function updateTicker(ticker) {
    const band = document.getElementById('tickerBand');
    const textEl = document.getElementById('tickerText');
    const cfg = ticker || {};

    if (!cfg.show) {
        if (tickerVisible) {
            band.classList.remove('anim-ticker-enter');
            band.classList.add('anim-ticker-exit');
            tickerVisible = false;
            tickerLastText = null;
            if (tickerHideTimeoutId !== null) clearTimeout(tickerHideTimeoutId);
            tickerHideTimeoutId = setTimeout(() => {
                band.style.display = 'none';
                band.classList.remove('anim-ticker-exit');
                tickerHideTimeoutId = null;
            }, 400);
        }
        return;
    }

    if (tickerHideTimeoutId !== null) {
        clearTimeout(tickerHideTimeoutId);
        tickerHideTimeoutId = null;
        band.classList.remove('anim-ticker-exit');
    }

    band.style.left = conPx(cfg.left, '0px');
    band.style.width = conPx(cfg.width, '1920px');
    band.style.top = conPx(cfg.top, '1000px');
    band.style.height = conPx(cfg.height, '50px');
    band.style.backgroundColor = cfg.bg_color || '#000000';
    textEl.style.color = cfg.color || '#ffffff';
    band.style.display = 'flex';

    if (!tickerVisible) {
        band.classList.add('anim-ticker-enter');
        tickerVisible = true;
    }

    const speed = parseFloat(cfg.speed_seconds) || 15;
    const text = cfg.text || '';
    const direccion = cfg.scroll_direccion === 'derecha' ? 'derecha' : 'izquierda';

    if (text !== tickerLastText || direccion !== tickerLastDireccion) {
        textEl.textContent = text;
        textEl.classList.remove('ticker-dir-izquierda', 'ticker-dir-derecha');
        textEl.classList.add(`ticker-dir-${direccion}`);
        textEl.style.animation = 'none';
        void textEl.offsetWidth;
        textEl.style.animation = `ticker-scroll-${direccion} ${speed}s linear infinite`;
        tickerLastText = text;
        tickerLastDireccion = direccion;
    } else {
        textEl.style.animationDuration = `${speed}s`;
    }
}
```

- [ ] **Step 3: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //' app/static/js/pantalla.js > /tmp/pantalla_ticker_checkable.js
node --check /tmp/pantalla_ticker_checkable.js && echo "sintaxis OK"
```

Si falla por otro motivo pre-existente no relacionado (p. ej. un operador `??` en
otra parte del archivo), sustituirlo también en la copia scratch antes de
concluir, y anotarlo como no relacionado a este cambio — mismo procedimiento que ya
se usó en tareas previas de este proyecto.

- [ ] **Step 4: Verificación manual end-to-end en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5055
```

Abrir `http://localhost:5055/pantalla`. Como no hay framework de tests, inyectar
datos de prueba en la consola del navegador para evitar depender de un Graph real
(mismo enfoque ya usado para depurar el efecto Deslizar de las capas: parchear el
módulo para exponer `updateDisplay`/`updateTicker` a `window` vía
`fetch('/static/js/pantalla.js')` + `document.createElement('script')`, quitando
`export`). Con eso:

1. Llamar a algo equivalente a `window.updateTicker({ show: true, text: 'PRUEBA',
   left: 200, width: 800, scroll_direccion: 'izquierda', speed_seconds: 8 })` y
   confirmar visualmente que la banda aparece deslizándose desde la derecha
   (`anim-ticker-enter`), ubicada en `left: 200px` con `width: 800px`, y que el
   texto se desplaza de derecha a izquierda dentro de esa banda.
2. Llamar de nuevo con `scroll_direccion: 'derecha'` y confirmar que el texto
   ahora entra por la izquierda y se mueve hacia la derecha (reinicio de la
   animación del texto sin necesidad de tocar `text`).
3. Llamar con `show: false` y confirmar que la banda se desliza hacia la derecha
   (`anim-ticker-exit`) y recién después de ~400ms queda con `display: none`
   (verificable leyendo `getComputedStyle(band).display` antes y después de
   esperar ese tiempo, o forzando `band.getAnimations()[0].currentTime` como se
   hizo al depurar el efecto Deslizar, dado que la pestaña de un navegador
   automatizado en segundo plano puede congelar animaciones CSS — no tratar ese
   congelamiento como un bug si ocurre solo bajo automatización).

Parar el servidor de prueba al terminar (`pkill -f "flask run --port 5055"`).

- [ ] **Step 5: Commit**

Mismo criterio de git state que las tareas anteriores.

```bash
git add app/static/js/pantalla.js
git commit -m "feat: animar entrada/salida del ticker y aplicar dirección de scroll configurable"
```
