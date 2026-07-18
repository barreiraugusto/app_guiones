# Ticker: ángulo de rotación configurable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar un campo "Ángulo" (grados, -45 a 45) al ticker que rota la banda
completa (fondo + texto) alrededor de su propio centro, tanto en el editor de
control en vivo como en la salida real.

**Architecture:** El ticker no tiene modelo de base de datos — se persiste como
JSON libre en `display_config.json` vía endpoints ya existentes sin validación de
campos. Todo el trabajo es frontend: un input nuevo en `control_live.js` y un
`transform: rotate(...)` aplicado en ambos lados (editor y `pantalla.js`).

**Tech Stack:** JS vanilla, CSS `transform: rotate()` (sin librerías).

## Global Constraints

- Nuevo campo `ticker.angulo` en `display_config.json`, default `0`.
- Rango clamped a `[-45, 45]` grados en el input del panel, mismo criterio que ya
  usa `ancho` (`Math.max(20, ...)`).
- Sin control de arrastre/rotación con mouse — solo input numérico.
- Rotación sobre el centro del elemento (`transform-origin` por defecto de CSS),
  sin mover `left`/`top`.
- No hay suite de tests automatizados. Verificación: `node --check` (con el mismo
  workaround de sustituir `export`/`??` ya usado en este proyecto para estos
  archivos) más verificación manual en navegador real.

---

## Task 1: Editor de control en vivo — input de ángulo

**Files:**
- Modify: `app/static/js/control_live.js` (tres puntos, ver steps)

**Interfaces:**
- Produces: `tickerState.angulo` (number, clamped -45..45) — consumido por Task 2
  vía el mismo JSON de `display_config` que ya viaja sin transformación hacia
  `pantalla.js`.

- [ ] **Step 1: Agregar `angulo` a `tickerState` en `cargarConfig`**

En `app/static/js/control_live.js`, dentro de `cargarConfig` (bloque
`tickerState = { ... }`), agregar después de `scroll_direccion`:

```javascript
        scroll_direccion: (config.ticker && config.ticker.scroll_direccion) || 'izquierda',
        angulo: Math.max(-45, Math.min(45, parseFloat(config.ticker && config.ticker.angulo) || 0)),
```

- [ ] **Step 2: Aplicar la rotación en `crearElementoTicker`**

En `crearElementoTicker()`, agregar después de `el.style.opacity = tickerState.show ? '1' : '0.35';`:

```javascript
    el.style.transform = `rotate(${tickerState.angulo}deg)`;
```

- [ ] **Step 3: Agregar el input "Ángulo" al panel de propiedades**

En `renderizarPanelPropiedades`, bloque `elementoSeleccionado === 'ticker'`,
reemplazar:

```javascript
            <div class="form-group mb-2">
                <label>Dirección del texto</label>
                <select class="form-control" id="prop-ticker-scroll-direccion">
                    <option value="izquierda">Derecha → Izquierda</option>
                    <option value="derecha">Izquierda → Derecha</option>
                </select>
            </div>
        `;
```

por:

```javascript
            <div class="form-group mb-2">
                <label>Dirección del texto</label>
                <select class="form-control" id="prop-ticker-scroll-direccion">
                    <option value="izquierda">Derecha → Izquierda</option>
                    <option value="derecha">Izquierda → Derecha</option>
                </select>
            </div>
            <div class="form-group mb-2">
                <label>Ángulo</label>
                <input type="number" class="form-control" id="prop-ticker-angulo" min="-45" max="45" value="${tickerState.angulo}">
            </div>
        `;
```

- [ ] **Step 4: Agregar el listener del nuevo input**

Inmediatamente después del listener existente de `prop-ticker-scroll-direccion`
(el bloque termina con `guardarSeccion('ticker', tickerState);\n        });`,
antes del `return;` que cierra el bloque `if (elementoSeleccionado === 'ticker')`),
agregar:

```javascript
        document.getElementById('prop-ticker-angulo').addEventListener('blur', (e) => {
            tickerState.angulo = Math.max(-45, Math.min(45, parseFloat(e.target.value) || 0));
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
```

- [ ] **Step 5: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g' app/static/js/control_live.js > /tmp/cl_angulo_checkable.js
node --check /tmp/cl_angulo_checkable.js && echo "sintaxis OK"
```

- [ ] **Step 6: Verificación manual en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5061
```

Abrir `http://localhost:5061/control_live` (o `/control_live/<id>` con un guion
existente si la ruta lo requiere), seleccionar el ticker, escribir un ángulo (ej.
`20`) en el input y confirmar visualmente que la banda del ticker se inclina en el
lienzo del editor. Confirmar que valores fuera de rango (ej. `90`) se clampan a
`45` al perder el foco del input. Recargar la página y confirmar que el ángulo
persiste. Restaurar el valor a `0` antes de terminar si se dejó modificado en
`display_config.json`, y parar el servidor de prueba
(`pkill -f "flask run --port 5061"`).

- [ ] **Step 7: Commit**

Nota para quien ejecute esta tarea: `app/static/js/control_live.js` puede tener
cambios preexistentes sin commitear ajenos a este plan en el working tree (ha
sido el caso constante en este repo). Si es así, no hacer `git add`/`git commit`
del archivo completo — dejar los cambios en el working tree para que el
controller extraiga un commit quirúrgico, mismo procedimiento ya usado en los
planes anteriores de este proyecto.

Si el archivo está limpio en el momento de ejecutar esta tarea:

```bash
git add app/static/js/control_live.js
git commit -m "feat: ángulo de rotación configurable para el ticker en el editor"
```

---

## Task 2: Salida real — aplicar la rotación

**Files:**
- Modify: `app/static/js/pantalla.js:141-174` (`updateTicker`)

**Interfaces:**
- Consumes: `cfg.angulo` (llega tal cual desde `display_config.json` vía Task 1,
  sin transformación de backend).

- [ ] **Step 1: Aplicar la rotación en `updateTicker`**

En `app/static/js/pantalla.js`, dentro de `updateTicker`, agregar después de
`band.style.height = conPx(cfg.height, '50px');`:

```javascript
    band.style.transform = `rotate(${parseFloat(cfg.angulo) || 0}deg)`;
```

- [ ] **Step 2: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g' app/static/js/pantalla.js > /tmp/pj_angulo_checkable.js
node --check /tmp/pj_angulo_checkable.js && echo "sintaxis OK"
```

- [ ] **Step 3: Verificación manual en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5062
```

Abrir `http://localhost:5062/pantalla`. Como no hay framework de tests, inyectar
datos de prueba en la consola del navegador (mismo enfoque ya usado varias veces
en este proyecto: parchear el módulo para exponer `updateDisplay`/`updateTicker`
a `window` vía `fetch('/static/js/pantalla.js')` + quitar `export`). Llamar a
`window.updateTicker({ show: true, text: 'PRUEBA', angulo: 20, left: 200,
width: 800 })` y confirmar mediante `getComputedStyle(document.getElementById
('tickerBand')).transform` que el valor resultante corresponde a una rotación de
20 grados (no `"none"` ni `matrix(1, 0, 0, 1, ...)` sin componente de rotación).
Confirmar visualmente con una captura de pantalla que la banda se ve inclinada.

Parar el servidor de prueba al terminar (`pkill -f "flask run --port 5062"`).

- [ ] **Step 4: Commit**

Mismo criterio de git state que Task 1.

```bash
git add app/static/js/pantalla.js
git commit -m "feat: aplicar ángulo de rotación del ticker en la salida real"
```
