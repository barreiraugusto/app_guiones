# Cronómetro: fondo transparente y esquinas redondeadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar opacidad de fondo (0-100) y radio de esquina (px) al widget
Cronómetro, sin afectar la opacidad del texto del tiempo.

**Architecture:** El fondo se aplica hoy como `background-color` con un
string hex directo. Para que la opacidad afecte solo el fondo (no el texto),
se convierte ese hex a `rgba(r,g,b,opacidad/100)` con una función pura nueva,
duplicada en `control_live.js` y `pantalla.js` (mismo criterio ya usado para
`FUENTES_FIJAS` y las funciones de tiempo del cronómetro — no hay módulos
compartidos entre estos dos scripts). El radio de esquina es directo
(`border-radius`).

**Tech Stack:** JS vanilla, CSS `rgba()`/`border-radius` (sin librerías).

## Global Constraints

- Solo el Cronómetro — el Marcador queda explícitamente fuera de alcance.
- `opacidad_fondo`: entero 0-100, default `100` (fondo opaco, igual al
  comportamiento actual). Clampeado siempre a `[0, 100]`.
- `radio_esquina`: entero en px, default `0` (esquinas rectas, igual al
  comportamiento actual).
- La opacidad de fondo nunca afecta el texto del tiempo — el texto queda
  siempre 100% opaco.
- No hay suite de tests automatizados en este proyecto. Verificación:
  `node --check` (con el workaround ya establecido en este proyecto para
  `export`/`??`/`?.`) y verificación manual en navegador real.

---

## Task 1: Editor — `control_live.js`

**Files:**
- Modify: `app/static/js/control_live.js` (múltiples puntos, ver steps)

**Interfaces:**
- Produces: `cronometroState.opacidad_fondo`/`.radio_esquina` — persistidos
  en `display_config.json` vía `guardarSeccion('cronometro', ...)`,
  consumidos por Task 2 (`pantalla.js`) tal cual, sin transformación de
  backend.

- [ ] **Step 1: Función pura `colorFondoConOpacidad` (nueva, junto a
  `segundosRestantesCronometro`/`formatearTiempoCronometro`)**

```javascript
function colorFondoConOpacidad(hex, opacidadPct) {
    const valor = (hex || '#000000').replace('#', '');
    const r = parseInt(valor.substring(0, 2), 16) || 0;
    const g = parseInt(valor.substring(2, 4), 16) || 0;
    const b = parseInt(valor.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacidadPct)) / 100})`;
}
```

- [ ] **Step 2: Agregar los 2 campos a `cronometroState` en `cargarConfig`**

Reemplazar:

```javascript
        color: (config.cronometro && config.cronometro.color) || '#ffffff',
        bg_color: (config.cronometro && config.cronometro.bg_color) || '#000000',
    };
```

por:

```javascript
        color: (config.cronometro && config.cronometro.color) || '#ffffff',
        bg_color: (config.cronometro && config.cronometro.bg_color) || '#000000',
        opacidad_fondo: (config.cronometro && config.cronometro.opacidad_fondo) !== undefined ? Math.max(0, Math.min(100, parseInt(config.cronometro.opacidad_fondo))) : 100,
        radio_esquina: parseInt(config.cronometro && config.cronometro.radio_esquina) || 0,
    };
```

- [ ] **Step 3: Aplicar ambos en `crearElementoCronometro`**

Reemplazar:

```javascript
    el.style.backgroundColor = cronometroState.bg_color;
    el.style.color = cronometroState.color;
```

por:

```javascript
    el.style.backgroundColor = colorFondoConOpacidad(cronometroState.bg_color, cronometroState.opacidad_fondo);
    el.style.borderRadius = `${cronometroState.radio_esquina}px`;
    el.style.color = cronometroState.color;
```

- [ ] **Step 4: Verificación manual de los Steps 1-3**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5074
```

Abrir `http://localhost:5074/control_live/<algún guion id>` y confirmar en
la consola del navegador que `cronometroState.opacidad_fondo === 100` y
`cronometroState.radio_esquina === 0` (valores por defecto, ya que
`display_config.json` todavía no tiene esos campos). Confirmar visualmente
que el aspecto del Cronómetro en el lienzo no cambió (fondo sigue opaco,
esquinas rectas). Dejar el servidor corriendo para el Step 6.

- [ ] **Step 5: Agregar los inputs al panel lateral de propiedades**

Reemplazar:

```javascript
            <div class="form-group mb-2">
                <label>Color fondo</label>
                <input type="color" class="form-control" id="prop-cron-bgcolor" value="${cronometroState.bg_color}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-cron-fuente">
```

por:

```javascript
            <div class="form-group mb-2">
                <label>Color fondo</label>
                <input type="color" class="form-control" id="prop-cron-bgcolor" value="${cronometroState.bg_color}">
            </div>
            <div class="form-group mb-2">
                <label>Opacidad de fondo</label>
                <input type="number" class="form-control" id="prop-cron-opacidad-fondo" min="0" max="100" value="${cronometroState.opacidad_fondo}">
            </div>
            <div class="form-group mb-2">
                <label>Radio de esquina</label>
                <input type="number" class="form-control" id="prop-cron-radio-esquina" min="0" value="${cronometroState.radio_esquina}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-cron-fuente">
```

- [ ] **Step 6: Agregar los listeners de los nuevos inputs**

Inmediatamente después de (sin modificar) el listener existente:

```javascript
        document.getElementById('prop-cron-cursiva').addEventListener('change', (e) => {
            cronometroState.cursiva = e.target.checked;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        return;
    }

    if (elementoSeleccionado === 'marcador') {
```

insertar, antes del `return;`:

```javascript
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
```

- [ ] **Step 7: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g; s/?\.\([a-zA-Z_]\)/\.\1/g' app/static/js/control_live.js > /tmp/cl_bg_checkable.js
node --check /tmp/cl_bg_checkable.js && echo "sintaxis OK"
```

- [ ] **Step 8: Verificación manual completa en navegador**

Con el servidor del Step 4 corriendo (reiniciar si se cerró): seleccionar el
Cronómetro en el lienzo, confirmar que el panel lateral muestra "Opacidad de
fondo" y "Radio de esquina" junto a los demás campos de estilo. Bajar la
opacidad a 0: confirmar que el fondo desaparece completamente pero el texto
del tiempo se sigue viendo nítido (sin transparencia). Subir el radio de
esquina a, por ejemplo, 20: confirmar que las esquinas del widget se ven
redondeadas en el lienzo. Recargar la página: confirmar que ambos valores
persisten.

Restaurar `display_config.json` a un estado limpio si quedó con datos de
prueba que no querés conservar. Parar el servidor de prueba al terminar
(`pkill -f "flask run --port 5074"`).

- [ ] **Step 9: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: opacidad de fondo y radio de esquina para el Cronómetro en el editor"
```

---

## Task 2: Salida real — `pantalla.js`

**Files:**
- Modify: `app/static/js/pantalla.js` (múltiples puntos, ver steps)

**Interfaces:**
- Consumes: `cfg.opacidad_fondo`/`cfg.radio_esquina` (llegan tal cual desde
  `display_config.json` vía Task 1, sin transformación de backend).

- [ ] **Step 1: Función pura `colorFondoConOpacidad` (misma que Task 1,
  duplicada aquí — nueva, junto a `segundosRestantesCronometro`/
  `formatearTiempoCronometro`)**

```javascript
function colorFondoConOpacidad(hex, opacidadPct) {
    const valor = (hex || '#000000').replace('#', '');
    const r = parseInt(valor.substring(0, 2), 16) || 0;
    const g = parseInt(valor.substring(2, 4), 16) || 0;
    const b = parseInt(valor.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacidadPct)) / 100})`;
}
```

- [ ] **Step 2: Aplicar ambos en `updateCronometro`**

Reemplazar:

```javascript
    band.style.backgroundColor = cfg.bg_color || '#000000';
    band.style.color = cfg.color || '#ffffff';
```

por:

```javascript
    band.style.backgroundColor = colorFondoConOpacidad(cfg.bg_color, cfg.opacidad_fondo !== undefined ? cfg.opacidad_fondo : 100);
    band.style.borderRadius = `${parseFloat(cfg.radio_esquina) || 0}px`;
    band.style.color = cfg.color || '#ffffff';
```

- [ ] **Step 3: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g; s/?\.\([a-zA-Z_]\)/\.\1/g' app/static/js/pantalla.js > /tmp/pj_bg_checkable.js
node --check /tmp/pj_bg_checkable.js && echo "sintaxis OK"
```

Confirmar también que `colorFondoConOpacidad` quedó byte-idéntica entre
`control_live.js` y `pantalla.js`:

```bash
diff <(sed -n '/^function colorFondoConOpacidad/,/^}/p' app/static/js/control_live.js) <(sed -n '/^function colorFondoConOpacidad/,/^}/p' app/static/js/pantalla.js) && echo "IDÉNTICAS"
```

- [ ] **Step 4: Verificación manual end-to-end en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5075
```

Abrir `http://localhost:5075/pantalla`. Como no hay framework de tests,
inyectar datos de prueba en la consola del navegador (mismo enfoque ya usado
varias veces en este proyecto: parchear el módulo para exponer
`updateDisplay` a `window` vía `fetch('/static/js/pantalla.js')` + quitar
`export`). Llamar a:

```javascript
window.updateDisplay({
  ticker: {}, live: {}, mosca: null, marcador: {},
  cronometro: { show: true, left: 100, top: 100, width: 300, height: 80, mostrar_horas: false, duracion_horas: 0, duracion_minutos: 0, duracion_segundos: 30, estado: 'corriendo', epoch_inicio: Date.now() / 1000, segundos_restantes: null, fuente: 'Arial', tamano_fuente: 40, negrita: true, cursiva: false, color: '#ffffff', bg_color: '#ff0000', opacidad_fondo: 30, radio_esquina: 25 }
});
```

y confirmar con `getComputedStyle(document.getElementById('cronometroBand'))`
que `backgroundColor` es `rgba(255, 0, 0, 0.3)` y `borderRadius` es `25px`.
Confirmar visualmente con una captura de pantalla que el fondo se ve
translúcido con esquinas redondeadas y el texto del tiempo sigue legible y
opaco.

Parar el servidor de prueba al terminar (`pkill -f "flask run --port 5075"`).

- [ ] **Step 5: Commit**

```bash
git add app/static/js/pantalla.js
git commit -m "feat: aplicar opacidad de fondo y radio de esquina del Cronómetro en la salida real"
```
