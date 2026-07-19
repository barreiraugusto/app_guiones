# Marcador: fondo transparente y esquinas redondeadas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar opacidad de fondo (0-100) y radio de esquina (px) al
widget Marcador, mismo mecanismo ya implementado y aprobado para el
Cronómetro.

**Architecture:** La función pura `colorFondoConOpacidad(hex, opacidadPct)`
ya existe en `control_live.js` y en `pantalla.js` (agregada por el feature
del Cronómetro) — este plan **no la duplica una tercera vez**, solo la
reutiliza aplicándola también al Marcador.

**Tech Stack:** JS vanilla, CSS `rgba()`/`border-radius` (sin librerías).

## Global Constraints

- `opacidad_fondo`: entero 0-100, default `100`. Clampeado siempre a
  `[0, 100]`.
- `radio_esquina`: entero en px, default `0`.
- La opacidad de fondo nunca afecta el texto del marcador — el texto queda
  siempre 100% opaco.
- No se toca el Cronómetro (ya tiene estos campos).
- No hay suite de tests automatizados en este proyecto. Verificación:
  `node --check` (con el workaround ya establecido en este proyecto para
  `export`/`??`/`?.`) y verificación manual en navegador real.

---

## Task 1: Editor — `control_live.js`

**Files:**
- Modify: `app/static/js/control_live.js` (múltiples puntos, ver steps)

**Interfaces:**
- Consumes: `colorFondoConOpacidad(hex, opacidadPct)` (ya existe en este
  archivo, agregada por el feature del Cronómetro — no se vuelve a definir).
- Produces: `marcadorState.opacidad_fondo`/`.radio_esquina` — persistidos en
  `display_config.json` vía `guardarSeccion('marcador', ...)`, consumidos
  por Task 2 (`pantalla.js`) tal cual, sin transformación de backend.

- [ ] **Step 1: Agregar los 2 campos a `marcadorState` en `cargarConfig`**

Reemplazar:

```javascript
        color: (config.marcador && config.marcador.color) || '#ffffff',
        bg_color: (config.marcador && config.marcador.bg_color) || '#000000',
    };
```

por:

```javascript
        color: (config.marcador && config.marcador.color) || '#ffffff',
        bg_color: (config.marcador && config.marcador.bg_color) || '#000000',
        opacidad_fondo: (config.marcador && config.marcador.opacidad_fondo) !== undefined ? Math.max(0, Math.min(100, parseInt(config.marcador.opacidad_fondo))) : 100,
        radio_esquina: parseInt(config.marcador && config.marcador.radio_esquina) || 0,
    };
```

- [ ] **Step 2: Aplicar ambos en `crearElementoMarcador`**

Reemplazar:

```javascript
    el.style.backgroundColor = marcadorState.bg_color;
    el.style.color = marcadorState.color;
```

por:

```javascript
    el.style.backgroundColor = colorFondoConOpacidad(marcadorState.bg_color, marcadorState.opacidad_fondo);
    el.style.borderRadius = `${marcadorState.radio_esquina}px`;
    el.style.color = marcadorState.color;
```

- [ ] **Step 3: Verificación manual de los Steps 1-2**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5076
```

Abrir `http://localhost:5076/control_live/<algún guion id>` y confirmar en
la consola del navegador que `marcadorState.opacidad_fondo === 100` y
`marcadorState.radio_esquina === 0` (valores por defecto). Confirmar
visualmente que el aspecto del Marcador en el lienzo no cambió (fondo sigue
opaco, esquinas rectas). Dejar el servidor corriendo para el Step 5.

- [ ] **Step 4: Agregar los inputs al panel lateral de propiedades**

Reemplazar:

```javascript
            <div class="form-group mb-2">
                <label>Color fondo</label>
                <input type="color" class="form-control" id="prop-marc-bgcolor" value="${marcadorState.bg_color}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-marc-fuente">
```

por:

```javascript
            <div class="form-group mb-2">
                <label>Color fondo</label>
                <input type="color" class="form-control" id="prop-marc-bgcolor" value="${marcadorState.bg_color}">
            </div>
            <div class="form-group mb-2">
                <label>Opacidad de fondo</label>
                <input type="number" class="form-control" id="prop-marc-opacidad-fondo" min="0" max="100" value="${marcadorState.opacidad_fondo}">
            </div>
            <div class="form-group mb-2">
                <label>Radio de esquina</label>
                <input type="number" class="form-control" id="prop-marc-radio-esquina" min="0" value="${marcadorState.radio_esquina}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-marc-fuente">
```

- [ ] **Step 5: Agregar los listeners de los nuevos inputs**

Inmediatamente después de (sin modificar) el listener existente:

```javascript
        document.getElementById('prop-marc-cursiva').addEventListener('change', (e) => {
            marcadorState.cursiva = e.target.checked;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        return;
    }

    panel.innerHTML = '<p class="text-muted">Seleccioná el ticker, el badge Vivo, la Mosca, el cronómetro o el marcador para editar sus propiedades.</p>';
```

insertar, antes del `return;`:

```javascript
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
```

- [ ] **Step 6: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g; s/?\.\([a-zA-Z_]\)/\.\1/g' app/static/js/control_live.js > /tmp/cl_marcbg_checkable.js
node --check /tmp/cl_marcbg_checkable.js && echo "sintaxis OK"
```

- [ ] **Step 7: Verificación manual completa en navegador**

Con el servidor del Step 3 corriendo (reiniciar si se cerró): seleccionar el
Marcador en el lienzo, confirmar que el panel lateral muestra "Opacidad de
fondo" y "Radio de esquina" junto a los demás campos de estilo. Bajar la
opacidad a 0: confirmar que el fondo desaparece completamente pero el texto
"{equipo1} {tantos1} - {tantos2} {equipo2}" se sigue viendo nítido. Subir el
radio de esquina a, por ejemplo, 20: confirmar que las esquinas del widget
se ven redondeadas. Recargar la página: confirmar que ambos valores
persisten. Confirmar también que el Cronómetro sigue funcionando sin cambios
(no se tocó su código).

Restaurar `display_config.json` a un estado limpio si quedó con datos de
prueba que no querés conservar. Parar el servidor de prueba al terminar
(`pkill -f "flask run --port 5076"`).

- [ ] **Step 8: Commit**

```bash
git add app/static/js/control_live.js
git commit -m "feat: opacidad de fondo y radio de esquina para el Marcador en el editor"
```

---

## Task 2: Salida real — `pantalla.js`

**Files:**
- Modify: `app/static/js/pantalla.js` (múltiples puntos, ver steps)

**Interfaces:**
- Consumes: `colorFondoConOpacidad(hex, opacidadPct)` (ya existe en este
  archivo, agregada por el feature del Cronómetro — no se vuelve a definir).
  `cfg.opacidad_fondo`/`cfg.radio_esquina` llegan tal cual desde
  `display_config.json` vía Task 1, sin transformación de backend.

- [ ] **Step 1: Aplicar ambos en `updateMarcador`**

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

- [ ] **Step 2: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g; s/?\.\([a-zA-Z_]\)/\.\1/g' app/static/js/pantalla.js > /tmp/pj_marcbg_checkable.js
node --check /tmp/pj_marcbg_checkable.js && echo "sintaxis OK"
```

- [ ] **Step 3: Verificación manual end-to-end en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5077
```

Abrir `http://localhost:5077/pantalla`. Como no hay framework de tests,
inyectar datos de prueba en la consola del navegador (mismo enfoque ya usado
varias veces en este proyecto: parchear el módulo para exponer
`updateDisplay` a `window` vía `fetch('/static/js/pantalla.js')` + quitar
`export`). Llamar a:

```javascript
window.updateDisplay({
  ticker: {}, live: {}, mosca: null,
  cronometro: {},
  marcador: { show: true, left: 100, top: 100, width: 400, height: 100, nombre_equipo_1: 'RIVER', nombre_equipo_2: 'BOCA', tantos_equipo_1: 2, tantos_equipo_2: 1, fuente: 'Arial', tamano_fuente: 36, negrita: true, cursiva: false, color: '#ffffff', bg_color: '#00aa00', opacidad_fondo: 40, radio_esquina: 15 }
});
```

y confirmar con
`getComputedStyle(document.getElementById('marcadorBand'))` que
`backgroundColor` es `rgba(0, 170, 0, 0.4)` y `borderRadius` es `15px`.
Confirmar visualmente con una captura de pantalla que el fondo se ve
translúcido con esquinas redondeadas y el texto "RIVER 2 - 1 BOCA" sigue
legible y opaco.

Parar el servidor de prueba al terminar (`pkill -f "flask run --port 5077"`).

- [ ] **Step 4: Commit**

```bash
git add app/static/js/pantalla.js
git commit -m "feat: aplicar opacidad de fondo y radio de esquina del Marcador en la salida real"
```
