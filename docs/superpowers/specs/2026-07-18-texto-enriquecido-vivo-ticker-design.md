# Texto enriquecido para el badge Vivo y el Ticker

## Problema

Las capas de texto de las plantillas tienen selector de fuente (10 fijas +
personalizada), Negrita y Cursiva. El badge "Vivo" y el Ticker del panel de
control en vivo no tienen ninguno de estos controles: su tipografía está fijada
en el CSS de `pantalla.html` (`.live-badge { font-weight: bold; font-size: 18px;
}`, `#tickerText { font-size: 32px; font-weight: bold; }`), sin `font-family`
propio (heredan `Arial, sans-serif` del `body`).

## Alcance

Agregar los mismos 4 campos de estilo de texto a ambos elementos: selector de
fuente (10 fijas + personalizada), tamaño de fuente, Negrita, Cursiva. Mismo
patrón de UI y de datos que ya existe para las capas de texto de plantillas
(`docs/superpowers/specs/2026-07-18-enriquecer-texto-plantillas-design.md`).

No se agrega color de texto al Vivo (ya tiene un color CSS fijo blanco, fuera de
este pedido). El Ticker ya tiene `color` configurable, no se toca.

## Persistencia

Ninguno de los dos elementos tiene modelo de base de datos: se persisten como
JSON libre en `display_config.json`, secciones `live` y `ticker`, vía los
endpoints ya existentes sin validación de campos (`app/routes/graphs.py:476-517`).

Nuevos campos, con estos defaults (elegidos para no cambiar el aspecto visual
actual — hoy ambos elementos están siempre en negrita fija):

```json
{
  "live": {
    "...": "...",
    "fuente": "Arial",
    "tamano_fuente": 18,
    "negrita": true,
    "cursiva": false
  },
  "ticker": {
    "...": "...",
    "fuente": "Arial",
    "tamano_fuente": 32,
    "negrita": true,
    "cursiva": false
  }
}
```

## Editor de control en vivo (`app/static/js/control_live.js`)

**Lista de fuentes:** agregar la misma constante ya usada en `plantillas.js`:

```js
const FUENTES_FIJAS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Segoe UI'];
```

(duplicada, no compartida — `control_live.js` y `plantillas.js` son scripts
independientes sin mecanismo de módulos entre sí, mismo criterio ya usado en el
resto del proyecto).

**Estado:** agregar a `liveState` (`cargarConfig`) y a `tickerState`
(`cargarConfig`):

```js
fuente: (config.live && config.live.fuente) || 'Arial',
tamano_fuente: parseFloat(config.live && config.live.tamano_fuente) || 18,
negrita: (config.live && config.live.negrita) !== undefined ? !!config.live.negrita : true,
cursiva: !!(config.live && config.live.cursiva),
```

(mismo patrón para `tickerState`, con default de tamaño `32` en vez de `18`; la
sección de origen es `config.ticker` en ese caso).

**Preview del lienzo:** en `crearElementoLive()` y `crearElementoTicker()`,
aplicar:

```js
el.style.fontFamily = liveState.fuente; // o tickerState.fuente
el.style.fontSize = `${liveState.tamano_fuente}px`;
el.style.fontWeight = liveState.negrita ? 'bold' : 'normal';
el.style.fontStyle = liveState.cursiva ? 'italic' : 'normal';
```

**Panel de propiedades:** agregar a los bloques `elementoSeleccionado ===
'live'` y `elementoSeleccionado === 'ticker'` el mismo bloque de HTML +
listeners que ya usa `plantillas.js` para el selector de fuente y los
checkboxes, adaptado a `liveState`/`tickerState` en vez de `capa` y a
`guardarSeccion('live'/'ticker', ...)` en vez de `actualizarCapaSeleccionada`:

```html
<div class="form-group mb-2">
    <label>Fuente</label>
    <select class="form-control" id="prop-live-fuente">
        <!-- 10 opciones de FUENTES_FIJAS + "Personalizada..." (value="__custom__"),
             mismo patrón que prop-fuente en plantillas.js -->
    </select>
    <input type="text" class="form-control mt-1" id="prop-live-fuente-custom" ...>
</div>
<div class="form-group mb-2">
    <label>Tamaño</label>
    <input type="number" class="form-control" id="prop-live-tamano">
</div>
<div class="form-check mb-2">
    <input type="checkbox" class="form-check-input" id="prop-live-negrita">
    <label class="form-check-label" for="prop-live-negrita">Negrita</label>
</div>
<div class="form-check mb-2">
    <input type="checkbox" class="form-check-input" id="prop-live-cursiva">
    <label class="form-check-label" for="prop-live-cursiva">Cursiva</label>
</div>
```

(ids con prefijo `prop-live-`/`prop-ticker-` para no colisionar entre ambos
paneles; misma lógica de alternar el select a `__custom__` cuando el valor
guardado no está en `FUENTES_FIJAS`, igual que `plantillas.js`).

## Salida real (`app/static/js/pantalla.js` + `app/templates/pantalla.html`)

**CSS:** quitar los valores fijos de tipografía de `.live-badge` y
`#tickerText` en `pantalla.html` (pasan a aplicarse por JS inline, igual
criterio que ya se usó para `left`/`width`/`top`/`height` del ticker):

```css
.live-badge {
    /* sin font-weight ni font-size */
    ...
}
#tickerText {
    /* sin font-size ni font-weight */
    ...
}
```

**JS:** en el bloque `if (data.live) { ... }` de `updateDisplay`, agregar junto
a `top`/`left`:

```js
liveBadge.style.fontFamily = data.live.fuente || 'Arial';
liveBadge.style.fontSize = `${parseFloat(data.live.tamano_fuente) || 18}px`;
liveBadge.style.fontWeight = data.live.negrita !== false ? 'bold' : 'normal';
liveBadge.style.fontStyle = data.live.cursiva ? 'italic' : 'normal';
```

(`negrita !== false` en vez de `negrita` a secas: mantiene bold para configs
legadas que no tienen el campo, igual que el default `true` del lado del
editor).

En `updateTicker`, agregar junto a `color`:

```js
textEl.style.fontFamily = cfg.fuente || 'Arial';
textEl.style.fontSize = `${parseFloat(cfg.tamano_fuente) || 32}px`;
textEl.style.fontWeight = cfg.negrita !== false ? 'bold' : 'normal';
textEl.style.fontStyle = cfg.cursiva ? 'italic' : 'normal';
```

No hay riesgo de que estas propiedades queden tapadas por la animación de
entrada/salida del ticker (`anim-ticker-enter`/`anim-ticker-exit`): esas
animaciones solo tocan `opacity` y `transform` en `#tickerBand` (el contenedor),
no `font-*` en `#tickerText` (el span hijo) — a diferencia del bug de
`opacity`/`transform` ya corregido en este proyecto, aquí no hay conflicto de
propiedades porque son elementos y propiedades CSS distintos.

## Fuera de alcance

- Color de texto del Vivo.
- Cambios de backend/validación.
- Unificar `FUENTES_FIJAS` en un solo lugar compartido entre archivos.
