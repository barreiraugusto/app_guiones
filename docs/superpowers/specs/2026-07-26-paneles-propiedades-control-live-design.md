# Reorganización de los paneles de propiedades de Control en Vivo

## Problema

En `control_live.js` (`renderizarPanelPropiedades()`, líneas 658-1180), los
paneles de propiedades de Ticker, Vivo, Cronómetro y Marcador son —cada
uno— una lista plana de campos apiladas (posición, tamaño, color, fuente,
etc.), igual que estaba el panel de propiedades de capas en
`plantillas.js` antes de reorganizarlo en pestañas (commits `12bc5d8`,
`f0164c3`, `b385b00`).

## Alcance

- Reorganizar en pestañas los 4 paneles: **Ticker**, **Vivo** ("live"),
  **Cronómetro**, **Marcador** — mismos campos, mismo modelo de datos
  (`tickerState`, `liveState`, `cronometroState`, `marcadorState`), mismos
  `id` y `addEventListener` existentes.
- Agrupar en la misma fila (`row`/`col-6`) los campos que hoy están
  apilados y son cortos: Fuente+Tamaño, Color texto+Color fondo,
  Negrita+Cursiva, Opacidad de fondo+Radio de esquina (Cronómetro y
  Marcador).
- **Fuera de alcance** (explícitamente descartado por el usuario):
  - Tema oscuro: esta vista queda en claro, tal como está hoy.
  - Menú desplegable de acciones tipo "⋮": no aplica — Ticker/Vivo/
    Cronómetro/Marcador no son una lista de capas reordenable/eliminable,
    son widgets fijos del sistema. No se agrega ningún menú.
  - Panel de "Mosca" (1 checkbox + texto de ayuda, líneas 913-929): ya es
    lo más simple posible, no se toca.
  - Panel de composición de graph (`renderizarPanelComposicion()`, bajada
    activa/cita activa): no fue pedido, no se toca.
  - Bloques estáticos de **operación** (play/stop del cronómetro, sumar
    tantos del marcador, `control_live.html` líneas 133-173): son
    controles operativos, no de estilo — no son "propiedades", no se
    tocan.

## Bug ya conocido a evitar desde el día 1

En `plantillas.js` encontramos (y arreglamos en `ee12aa6`) que arrastrar
una capa ya seleccionada reseteaba la pestaña activa a "Posición", porque
`iniciarArrastre()` llama a `seleccionarCapa()` en cada `mousedown` —
incluso re-seleccionando la misma capa — y `seleccionarCapa()` reseteaba
la pestaña sin condición.

**El mismo patrón exacto existe acá.** `iniciarArrastreTicker`,
`iniciarResizeTicker`, `iniciarArrastreCronometro`,
`iniciarResizeCronometro`, `iniciarArrastreMarcador`,
`iniciarResizeMarcador` e `iniciarArrastreLive` llaman todos a
`seleccionarElemento(nombre)` en cada `mousedown` (líneas 1187, 1219,
1248-ish, 1280-ish, 1312-ish, 1344-ish, 1384-ish), y
`finalizarArrastre*`/`finalizarResize*` solo llaman a
`renderizarPanelPropiedades()` al soltar. Si el reset de la pestaña no se
guarda con la misma condición desde el principio, arrastrar o redimensionar
cualquiera de los 4 elementos va a resetear la pestaña activa a
"Posición" en cada movimiento — el mismo bug, evitable desde ahora.

## Estado nuevo en `control_live.js`

Junto a `elementoSeleccionado` (línea 12):

```js
let pestanaPropiedadesLiveActiva = 'posicion'; // 'posicion' | 'contenido' | 'estilo'
```

`seleccionarElemento(nombre)` (línea 650-656) — reemplazar:

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

Una sola función de cambio de pestaña, reutilizada por los 4 paneles
(mismo patrón que `cambiarPestanaPropiedades` en `plantillas.js`):

```js
function cambiarPestanaPropiedadesLive(nombre) {
    pestanaPropiedadesLiveActiva = nombre;
    renderizarPanelPropiedades();
}
```

## Pestañas por panel

Cada panel sigue siendo su propio bloque `if (elementoSeleccionado === 'X') { ...; return; }`
dentro de `renderizarPanelPropiedades()` — no se fusionan entre sí. Dentro
de cada uno, los campos existentes (mismos `id`, mismos valores, mismos
listeners) se reparten en `<div style="display:${...}">` según
`pestanaPropiedadesLiveActiva`, igual que en `plantillas.js`: **los tres
bloques se renderizan siempre los tres**, solo se oculta con
`display:none` el que no está activo — necesario porque los
`addEventListener` de cada panel apuntan a esos `id` sin condición.

### Ticker — 3 pestañas (Posición / Contenido / Estilo)

Encabezado (fuera de las pestañas, como hoy): `<h6>Ticker</h6>` +
checkbox "Mostrar".

- **Posición**: Top+Alto (row), Left+Ancho (row), Ángulo.
- **Contenido**: Texto, Velocidad (seg/vuelta), Dirección del texto.
- **Estilo**: Color texto+Color fondo (row), Fuente+Tamaño de fuente
  (row, con el input de fuente personalizada debajo del select como ya
  está), Negrita+Cursiva (row).

### Vivo — 2 pestañas (Posición / Estilo)

Encabezado: `<h6>Vivo</h6>` + checkbox "Mostrar" + campo "Texto" (Vivo no
tiene una pestaña "Contenido" separada porque solo tiene ese único campo
de contenido; queda visible siempre, como Mostrar).

- **Posición**: Top+Left (row) — ya están en una row hoy, no cambia.
- **Estilo**: Fuente+Tamaño de fuente (row), Negrita+Cursiva (row).

### Cronómetro — 2 pestañas (Posición / Estilo)

Encabezado: `<h6>Cronómetro</h6>` (sin "Mostrar" — no existe en este
panel hoy, vive aparte en el card de operación).

- **Posición**: Top+Alto (row), Left+Ancho (row) — ya están en rows hoy.
- **Estilo**: Color texto+Color fondo (row), Opacidad de fondo+Radio de
  esquina (row), Fuente+Tamaño de fuente (row), Negrita+Cursiva (row).

### Marcador — 2 pestañas (Posición / Estilo)

Idéntico a Cronómetro, mismo agrupamiento, con los ids `prop-marc-*` y
`marcadorState`.

## CSS: mismo fix de fondo nativo del botón que en plantillas.js

En la revisión final de la rama de plantillas encontramos que
`<button class="nav-link">` sin una regla propia hereda el fondo nativo
gris claro del navegador (`ButtonFace`, Bootstrap 4.1.3 no lo resetea) en
vez de quedar transparente — ahí lo notamos porque desentonaba con el
tema oscuro, pero el defecto es independiente del tema: en esta vista
(clara) también se vería un rectángulo gris apagado detrás de las
pestañas inactivas, encima del fondo blanco de la card. Agregar, junto al
resto del `<style>` de `control_live.html`:

```css
#panel-propiedades-control .nav-tabs .nav-link { background: transparent; width: 100%; }
```

(No hace falta redefinir `color`/`border-color` como en plantillas.js —
acá no hay tema oscuro, los defaults de Bootstrap para `.nav-link` y
`.nav-link.active` ya son legibles en claro; solo falta neutralizar el
`background` nativo del `<button>` y el `width` para que `nav-fill`
funcione.)
