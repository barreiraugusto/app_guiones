# Texto enriquecido para el badge Vivo y el Ticker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar selector de fuente (10 fijas + personalizada), tamaño de
fuente, Negrita y Cursiva al badge "Vivo" y al Ticker del panel de control en
vivo, con los mismos defaults visuales que tienen hoy (ambos en negrita fija).

**Architecture:** Ninguno de los dos elementos tiene modelo de base de datos —
se persisten como JSON libre en `display_config.json` vía endpoints ya
existentes sin validación de campos. Todo el trabajo es frontend:
`control_live.js` (editor) y `pantalla.js`/`pantalla.html` (salida real).

**Tech Stack:** JS vanilla, CSS puro.

## Global Constraints

- Nuevos campos en `live` y `ticker`: `fuente` (default `"Arial"`),
  `tamano_fuente` (default `18` para live, `32` para ticker), `negrita`
  (default `true` — ambos elementos están siempre en negrita hoy), `cursiva`
  (default `false`).
- Lista fija de fuentes, idéntica a la ya usada en `plantillas.js`: Arial,
  Helvetica, Georgia, Times New Roman, Courier New, Verdana, Tahoma, Trebuchet
  MS, Impact, Segoe UI — más "Personalizada..." (`value="__custom__"`) con
  input de texto libre.
- Sin color de texto nuevo para el Vivo (fuera de alcance). Sin cambios de
  backend.
- No hay suite de tests automatizados. Verificación: `node --check` (con el
  workaround ya establecido en este proyecto para `export`/`??`), balance de
  llaves para el CSS, y verificación manual en navegador real.

---

## Task 1: Editor de control en vivo — fuente, tamaño, negrita, cursiva

**Files:**
- Modify: `app/static/js/control_live.js` (múltiples puntos, ver steps)

**Interfaces:**
- Produces: `liveState.fuente`/`.tamano_fuente`/`.negrita`/`.cursiva` y
  `tickerState.fuente`/`.tamano_fuente`/`.negrita`/`.cursiva` — consumidos por
  Task 2 vía el mismo JSON de `display_config` que ya viaja sin transformación
  hacia `pantalla.js`.

- [ ] **Step 1: Agregar la constante `FUENTES_FIJAS`**

En `app/static/js/control_live.js`, cerca del inicio del archivo (junto a
`const ANCHO_LIENZO = 1920;`), agregar:

```javascript
const FUENTES_FIJAS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Segoe UI'];
```

- [ ] **Step 2: Agregar los 4 campos a `tickerState` en `cargarConfig`**

Reemplazar:

```javascript
        scroll_direccion: (config.ticker && config.ticker.scroll_direccion) || 'izquierda',
        angulo: Math.max(-45, Math.min(45, parseFloat(config.ticker && config.ticker.angulo) || 0)),
    };
```

por:

```javascript
        scroll_direccion: (config.ticker && config.ticker.scroll_direccion) || 'izquierda',
        angulo: Math.max(-45, Math.min(45, parseFloat(config.ticker && config.ticker.angulo) || 0)),
        fuente: (config.ticker && config.ticker.fuente) || 'Arial',
        tamano_fuente: parseFloat(config.ticker && config.ticker.tamano_fuente) || 32,
        negrita: (config.ticker && config.ticker.negrita) !== undefined ? !!config.ticker.negrita : true,
        cursiva: !!(config.ticker && config.ticker.cursiva),
    };
```

- [ ] **Step 3: Agregar los 4 campos a `liveState` en `cargarConfig`**

Reemplazar:

```javascript
    liveState = {
        show: !!(config.live && config.live.show),
        text: (config.live && config.live.text) || 'VIVO',
        top: parseFloat(config.live && config.live.top) || 150,
        left: parseFloat(config.live && config.live.left) || 1550,
    };
```

por:

```javascript
    liveState = {
        show: !!(config.live && config.live.show),
        text: (config.live && config.live.text) || 'VIVO',
        top: parseFloat(config.live && config.live.top) || 150,
        left: parseFloat(config.live && config.live.left) || 1550,
        fuente: (config.live && config.live.fuente) || 'Arial',
        tamano_fuente: parseFloat(config.live && config.live.tamano_fuente) || 18,
        negrita: (config.live && config.live.negrita) !== undefined ? !!config.live.negrita : true,
        cursiva: !!(config.live && config.live.cursiva),
    };
```

- [ ] **Step 4: Aplicar los estilos en `crearElementoTicker`**

Reemplazar:

```javascript
    el.style.opacity = tickerState.show ? '1' : '0.35';
    el.style.transform = `rotate(${tickerState.angulo}deg)`;
    el.textContent = tickerState.text || '(ticker vacío)';
```

por:

```javascript
    el.style.opacity = tickerState.show ? '1' : '0.35';
    el.style.transform = `rotate(${tickerState.angulo}deg)`;
    el.style.fontFamily = tickerState.fuente;
    el.style.fontSize = `${tickerState.tamano_fuente}px`;
    el.style.fontWeight = tickerState.negrita ? 'bold' : 'normal';
    el.style.fontStyle = tickerState.cursiva ? 'italic' : 'normal';
    el.textContent = tickerState.text || '(ticker vacío)';
```

- [ ] **Step 5: Aplicar los estilos en `crearElementoLive`**

Reemplazar:

```javascript
    el.style.opacity = liveState.show ? '1' : '0.35';
    el.textContent = liveState.text || 'VIVO';
```

por:

```javascript
    el.style.opacity = liveState.show ? '1' : '0.35';
    el.style.fontFamily = liveState.fuente;
    el.style.fontSize = `${liveState.tamano_fuente}px`;
    el.style.fontWeight = liveState.negrita ? 'bold' : 'normal';
    el.style.fontStyle = liveState.cursiva ? 'italic' : 'normal';
    el.textContent = liveState.text || 'VIVO';
```

- [ ] **Step 6: Verificación manual de los Steps 1-5**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5067
```

Abrir `http://localhost:5067/control_live` y confirmar en la consola del
navegador que `tickerState.fuente === 'Arial'`, `tickerState.tamano_fuente ===
32`, `tickerState.negrita === true`, y lo mismo para `liveState` con
`tamano_fuente === 18` — valores por defecto ya que `display_config.json`
todavía no tiene esos campos. Confirmar visualmente que el aspecto del Vivo y
el Ticker en el lienzo no cambió (siguen en negrita, mismo tamaño aparente).

- [ ] **Step 7: Agregar el bloque de fuente + tamaño + checkboxes al panel del Ticker**

En `renderizarPanelPropiedades`, bloque `elementoSeleccionado === 'ticker'`,
reemplazar:

```javascript
            <div class="form-group mb-2">
                <label>Ángulo</label>
                <input type="number" class="form-control" id="prop-ticker-angulo" min="-45" max="45" value="${tickerState.angulo}">
            </div>
        `;
```

por:

```javascript
            <div class="form-group mb-2">
                <label>Ángulo</label>
                <input type="number" class="form-control" id="prop-ticker-angulo" min="-45" max="45" value="${tickerState.angulo}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-ticker-fuente">
                    ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(tickerState.fuente) && tickerState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                    <option value="__custom__" ${!FUENTES_FIJAS.includes(tickerState.fuente) ? 'selected' : ''}>Personalizada...</option>
                </select>
                <input type="text" class="form-control mt-1" id="prop-ticker-fuente-custom" value="${tickerState.fuente}" style="${!FUENTES_FIJAS.includes(tickerState.fuente) ? '' : 'display:none;'}">
            </div>
            <div class="form-group mb-2">
                <label>Tamaño de fuente</label>
                <input type="number" class="form-control" id="prop-ticker-tamano" value="${tickerState.tamano_fuente}">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-ticker-negrita" ${tickerState.negrita ? 'checked' : ''}>
                <label class="form-check-label" for="prop-ticker-negrita">Negrita</label>
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-ticker-cursiva" ${tickerState.cursiva ? 'checked' : ''}>
                <label class="form-check-label" for="prop-ticker-cursiva">Cursiva</label>
            </div>
        `;
```

- [ ] **Step 8: Agregar los listeners del bloque del Ticker**

Inmediatamente después de (sin modificar) el listener existente:

```javascript
        document.getElementById('prop-ticker-angulo').addEventListener('blur', (e) => {
            tickerState.angulo = Math.max(-45, Math.min(45, parseFloat(e.target.value) || 0));
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        return;
    }
```

insertar, antes del `return;`:

```javascript
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
```

- [ ] **Step 9: Agregar el bloque de fuente + tamaño + checkboxes al panel del Vivo**

En el bloque `elementoSeleccionado === 'live'`, reemplazar:

```javascript
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-live-top" value="${liveState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-live-left" value="${liveState.left}"></div>
            </div>
        `;
```

por:

```javascript
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-live-top" value="${liveState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-live-left" value="${liveState.left}"></div>
            </div>
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-live-fuente">
                    ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(liveState.fuente) && liveState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                    <option value="__custom__" ${!FUENTES_FIJAS.includes(liveState.fuente) ? 'selected' : ''}>Personalizada...</option>
                </select>
                <input type="text" class="form-control mt-1" id="prop-live-fuente-custom" value="${liveState.fuente}" style="${!FUENTES_FIJAS.includes(liveState.fuente) ? '' : 'display:none;'}">
            </div>
            <div class="form-group mb-2">
                <label>Tamaño de fuente</label>
                <input type="number" class="form-control" id="prop-live-tamano" value="${liveState.tamano_fuente}">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-live-negrita" ${liveState.negrita ? 'checked' : ''}>
                <label class="form-check-label" for="prop-live-negrita">Negrita</label>
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-live-cursiva" ${liveState.cursiva ? 'checked' : ''}>
                <label class="form-check-label" for="prop-live-cursiva">Cursiva</label>
            </div>
        `;
```

- [ ] **Step 10: Agregar los listeners del bloque del Vivo**

Inmediatamente después de (sin modificar) el listener existente:

```javascript
        document.getElementById('prop-live-left').addEventListener('blur', (e) => {
            liveState.left = parseFloat(e.target.value) || 0;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        return;
    }
```

insertar, antes del `return;`:

```javascript
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
```

- [ ] **Step 11: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g' app/static/js/control_live.js > /tmp/cl_texto_checkable.js
node --check /tmp/cl_texto_checkable.js && echo "sintaxis OK"
```

- [ ] **Step 12: Verificación manual completa en navegador**

Con el servidor del Step 6 corriendo (reiniciar si se cerró):

1. Seleccionar el Ticker: cambiar la fuente a "Georgia", el tamaño a 40,
   tildar/destildar Negrita y Cursiva. Confirmar visualmente que el preview del
   ticker en el lienzo refleja los cambios.
2. Elegir "Personalizada..." en el selector de fuente del Ticker: confirmar
   que aparece el input de texto libre, escribir un nombre y confirmar que se
   aplica.
3. Repetir 1-2 para el Vivo.
4. Recargar la página y confirmar que todos los valores (incluida la fuente
   personalizada) persisten y el select vuelve a mostrar "Personalizada..."
   correctamente para el campo que se dejó en modo libre.

Parar el servidor de prueba al terminar (`pkill -f "flask run --port 5067"`).

- [ ] **Step 13: Commit**

Nota para quien ejecute esta tarea: `app/static/js/control_live.js` puede tener
cambios preexistentes sin commitear ajenos a este plan en el working tree (ha
sido el caso constante en este repo). Si es así, no hacer `git add`/`git
commit` del archivo completo — dejar los cambios en el working tree para que
el controller extraiga un commit quirúrgico.

Si el archivo está limpio en el momento de ejecutar esta tarea:

```bash
git add app/static/js/control_live.js
git commit -m "feat: fuente, tamaño, negrita y cursiva configurables para Vivo y Ticker en el editor"
```

---

## Task 2: Salida real — aplicar fuente, tamaño, negrita y cursiva

**Files:**
- Modify: `app/static/js/pantalla.js` (dos puntos, ver steps)
- Modify: `app/templates/pantalla.html` (dos reglas CSS, ver steps)

**Interfaces:**
- Consumes: `data.live.fuente`/`.tamano_fuente`/`.negrita`/`.cursiva` y
  `cfg.fuente`/`.tamano_fuente`/`.negrita`/`.cursiva` (llegan tal cual desde
  `display_config.json` vía Task 1, sin transformación de backend).

- [ ] **Step 1: Quitar los valores fijos de tipografía del CSS**

En `app/templates/pantalla.html`, reemplazar:

```css
        .live-badge {
            position: fixed;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 18px;
            -webkit-text-stroke: 1px #1e1e1e;
            text-transform: uppercase;
            text-shadow: 1px -1px 2px rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: none;
        }
```

por:

```css
        .live-badge {
            position: fixed;
            color: white;
            padding: 5px 15px;
            border-radius: 20px;
            -webkit-text-stroke: 1px #1e1e1e;
            text-transform: uppercase;
            text-shadow: 1px -1px 2px rgba(0, 0, 0, 0.5);
            z-index: 1000;
            display: none;
        }
```

y reemplazar:

```css
        #tickerText {
            display: inline-block;
            white-space: nowrap;
            font-size: 32px;
            font-weight: bold;
        }
```

por:

```css
        #tickerText {
            display: inline-block;
            white-space: nowrap;
        }
```

- [ ] **Step 2: Aplicar los estilos al badge Vivo en `updateDisplay`**

En `app/static/js/pantalla.js`, reemplazar:

```javascript
    const liveBadge = document.getElementById('liveBadge');
    if (data.live) {
        liveBadge.textContent = data.live.text || 'VIVO';
        liveBadge.style.display = data.live.show ? 'block' : 'none';
        liveBadge.style.top = conPx(data.live.top, '20px');
        liveBadge.style.left = conPx(data.live.left, '20px');
    }
```

por:

```javascript
    const liveBadge = document.getElementById('liveBadge');
    if (data.live) {
        liveBadge.textContent = data.live.text || 'VIVO';
        liveBadge.style.display = data.live.show ? 'block' : 'none';
        liveBadge.style.top = conPx(data.live.top, '20px');
        liveBadge.style.left = conPx(data.live.left, '20px');
        liveBadge.style.fontFamily = data.live.fuente || 'Arial';
        liveBadge.style.fontSize = `${parseFloat(data.live.tamano_fuente) || 18}px`;
        liveBadge.style.fontWeight = data.live.negrita !== false ? 'bold' : 'normal';
        liveBadge.style.fontStyle = data.live.cursiva ? 'italic' : 'normal';
    }
```

- [ ] **Step 3: Aplicar los estilos al texto del Ticker en `updateTicker`**

En la misma función, reemplazar:

```javascript
    band.style.setProperty('--angulo', `${parseFloat(cfg.angulo) || 0}deg`);
    band.style.backgroundColor = cfg.bg_color || '#000000';
    textEl.style.color = cfg.color || '#ffffff';
    band.style.display = 'flex';
```

por:

```javascript
    band.style.setProperty('--angulo', `${parseFloat(cfg.angulo) || 0}deg`);
    band.style.backgroundColor = cfg.bg_color || '#000000';
    textEl.style.color = cfg.color || '#ffffff';
    textEl.style.fontFamily = cfg.fuente || 'Arial';
    textEl.style.fontSize = `${parseFloat(cfg.tamano_fuente) || 32}px`;
    textEl.style.fontWeight = cfg.negrita !== false ? 'bold' : 'normal';
    textEl.style.fontStyle = cfg.cursiva ? 'italic' : 'normal';
    band.style.display = 'flex';
```

- [ ] **Step 4: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g' app/static/js/pantalla.js > /tmp/pj_texto_checkable.js
node --check /tmp/pj_texto_checkable.js && echo "sintaxis OK"
python3 -c "
import re
html = open('app/templates/pantalla.html').read()
css = re.search(r'<style>(.*?)</style>', html, re.DOTALL).group(1)
assert css.count('{') == css.count('}'), 'llaves desbalanceadas'
print('CSS balanceado:', css.count('{'), 'bloques')
"
```

- [ ] **Step 5: Verificación manual end-to-end en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5068
```

Abrir `http://localhost:5068/pantalla`. Como no hay framework de tests,
inyectar datos de prueba en la consola del navegador (mismo enfoque ya usado
varias veces en este proyecto: parchear el módulo para exponer `updateDisplay`
a `window` vía `fetch('/static/js/pantalla.js')` + quitar `export`). Llamar a:

```javascript
window.updateDisplay({
  live: { show: true, text: 'EN VIVO', top: 100, left: 100, fuente: 'Georgia', tamano_fuente: 30, negrita: false, cursiva: true },
  ticker: { show: true, text: 'PRUEBA TICKER', left: 0, width: 1920, top: 900, height: 60, fuente: 'Impact', tamano_fuente: 40, negrita: true, cursiva: false, scroll_direccion: 'izquierda' },
  mosca: null
});
```

y confirmar mediante `getComputedStyle` en `#liveBadge` y `#tickerText` que
`fontFamily`, `fontSize`, `fontWeight` y `fontStyle` reflejan los valores
pasados. Confirmar también que una capa/config SIN estos campos (objeto `{
show: true, text: 'X' }`) sigue mostrando negrita por defecto (compatibilidad
con `display_config.json` real, que todavía no tiene estos campos). Confirmar
visualmente con una captura de pantalla.

Parar el servidor de prueba al terminar (`pkill -f "flask run --port 5068"`).

- [ ] **Step 6: Commit**

Mismo criterio de git state que Task 1.

```bash
git add app/static/js/pantalla.js app/templates/pantalla.html
git commit -m "feat: aplicar fuente, tamaño, negrita y cursiva de Vivo y Ticker en la salida real"
```
