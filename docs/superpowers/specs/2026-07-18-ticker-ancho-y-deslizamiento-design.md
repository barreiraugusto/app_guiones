# Ticker: ancho configurable y deslizamiento horizontal

## Problema

El ticker (`#tickerBand` en `pantalla.html`) ocupa siempre el 100% del ancho de
pantalla, fijo a la izquierda (`left: 0`), sin forma de acortarlo ni reposicionarlo
horizontalmente. Además, al mostrar/ocultar el ticker (`show` true/false) la banda
aparece/desaparece de golpe, sin animación, a diferencia de las capas de las
plantillas que ya soportan un efecto "Deslizar". El scroll continuo del texto
dentro del ticker (la cinta que se desplaza) también está fijo a una sola
dirección (derecha → izquierda).

## Alcance

Tres mejoras independientes sobre el ticker existente:

1. Ancho y posición horizontal configurables (`width`, `left`).
2. Animación de entrada/salida de la banda completa al mostrar/ocultar (deslizamiento
   fijo desde/hacia la derecha, sin controles configurables).
3. Dirección configurable del scroll continuo del texto (derecha→izquierda /
   izquierda→derecha).

No se toca el mecanismo de scroll continuo en sí (velocidad, texto), solo se le
agrega la opción de dirección. No se agrega animación configurable (dirección/
duración) para la entrada/salida de la banda — queda fija, igual criterio que ya
se usó para el efecto Deslizar de las capas de plantillas (ver
`docs/superpowers/specs/2026-07-18-enriquecer-texto-plantillas-design.md` para
contexto de ese trabajo previo, no relacionado a los datos de esta spec).

## Persistencia

El ticker no tiene modelo en base de datos: se persiste como JSON libre en
`display_config.json`, sección `ticker`, vía `POST /update_display_config` (sin
validación de campos, ver `app/routes/graphs.py:476-517`) y se lee con
`GET /get_display_config`. No se requiere ningún cambio de backend.

Nuevos campos en la sección `ticker`, con estos defaults (mismo criterio que los
campos existentes: se leen con fallback si faltan, para no romper configs viejas
sin estos campos):

```json
{
  "ticker": {
    "...": "...",
    "left": 0,
    "width": 1920,
    "scroll_direccion": "izquierda"
  }
}
```

`scroll_direccion` acepta `"izquierda"` (comportamiento actual: el texto entra por
la derecha y se desplaza hacia la izquierda) o `"derecha"` (nuevo: el texto entra
por la izquierda y se desplaza hacia la derecha).

## Editor de control en vivo (`app/static/js/control_live.js`)

`tickerState` (cargado en `cargarConfig`, línea ~54-62): agregar

```js
left: parseFloat(config.ticker && config.ticker.left) || 0,
width: parseFloat(config.ticker && config.ticker.width) || ANCHO_LIENZO,
scroll_direccion: (config.ticker && config.ticker.scroll_direccion) || 'izquierda',
```

`crearElementoTicker()` (línea ~262-288): reemplazar los valores fijos

```js
el.style.left = '0px';
el.style.width = `${ANCHO_LIENZO}px`;
```

por

```js
el.style.left = `${tickerState.left}px`;
el.style.width = `${tickerState.width}px`;
```

**Arrastre horizontal:** extender el flujo existente de arrastre vertical
(`iniciarArrastreTicker` / `moverArrastreTicker`, línea ~476-490) para trackear
también `xInicial`/`leftInicial` y aplicar `deltaX` a `tickerState.left`, siguiendo
exactamente el mismo patrón ya usado para capas de plantilla en
`moverArrastreCapa` (línea ~767-775: `deltaX`/`deltaY` combinados sobre `capa.x`/
`capa.y`).

**Resize horizontal:** extender el flujo existente de resize vertical
(`iniciarResizeTicker` / `moverResizeTicker`, línea ~503-517) para trackear también
`anchoInicial` y aplicar `deltaX` a `tickerState.width`, siguiendo el mismo patrón
de `moverResizeCapa` (línea ~796-804).

**Panel de propiedades** (`renderizarPanelPropiedades`, bloque `elementoSeleccionado
=== 'ticker'`, línea ~345-409): agregar al `<div class="row">` que ya contiene
Top/Alto, dos campos más "Left" y "Ancho" (mismo patrón de input numérico +
listener `blur` → actualizar `tickerState` → `guardarSeccion('ticker', tickerState)`
→ `renderizarLienzo()`), y un `<select>` "Dirección" con opciones "Derecha →
Izquierda" (`value="izquierda"`) / "Izquierda → Derecha" (`value="derecha"`), mismo
patrón de listener `change` que los demás selects del panel.

## Animación de entrada/salida de la banda (`pantalla.js` + `pantalla.html`)

**CSS** (`pantalla.html`, junto a las clases `anim-fade-*`/`anim-slide-*` ya
existentes, línea ~89-97): agregar

```css
.anim-ticker-enter { animation: tickerSlideIn 400ms ease forwards; }
.anim-ticker-exit  { animation: tickerSlideOut 400ms ease forwards; }

@keyframes tickerSlideIn  { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
@keyframes tickerSlideOut { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(100%); } }
```

`translateX(100%)` es relativo al propio ancho del elemento (`#tickerBand`), igual
criterio que el fix aplicado a `direccionAPx` en el trabajo previo de animaciones de
capas: la banda entra/sale desplazándose su propio ancho completo, sin importar el
valor de `width` configurado. Dirección fija (siempre desde/hacia la derecha) y
duración fija (400ms), sin variables `--dur`/`--dir` ni controles en el panel.

`#tickerBand` (línea ~29-38): quitar `left: 0; width: 100%;` del CSS base (pasan a
fijarse por JS inline, igual que `top`/`height` ya se hace hoy).

**JS** (`pantalla.js`, `updateTicker`, línea ~135-164): la función hoy se llama en
cada tick del SSE (cada ~1s) y hace `display:none`/`display:flex` de forma
inmediata según `cfg.show`, sin distinguir un cambio real de estado de una
repetición del mismo estado. Para animar solo en la transición:

1. Agregar una variable de módulo `let tickerVisible = false;` (junto a
   `tickerLastText`, línea ~5) y `let tickerHideTimeoutId = null;`.
2. Al entrar (`cfg.show` true y `!tickerVisible`): aplicar `left`/`width` desde la
   config, poner `display:flex`, agregar la clase `anim-ticker-enter`, marcar
   `tickerVisible = true`.
3. Al salir (`cfg.show` false y `tickerVisible`): agregar la clase
   `anim-ticker-exit`, marcar `tickerVisible = false`, y con `setTimeout(() => {
   band.style.display = 'none'; }, 400)` recién ocultar tras la animación —
   mismo patrón que ya usa `updateDisplay` para el `clearTimeoutId` de las
   plantillas (`pantalla.js` línea ~204-207, ~223-229: cancelar el timeout
   pendiente si llega un nuevo estado antes de que termine).
4. Si `cfg.show` es true y ya estaba visible (`tickerVisible` true): actualizar
   `left`/`width`/`top`/`height`/colores/texto/velocidad como hoy, sin re-aplicar
   la clase de animación de entrada (para no re-dispararla en cada tick del SSE).

**Dirección del scroll continuo:** agregar en `pantalla.html` una segunda variante
de las reglas ya existentes para `#tickerText`/`@keyframes ticker-scroll`:

```css
.ticker-dir-izquierda { padding-left: 100%; }
.ticker-dir-derecha   { padding-right: 100%; }

@keyframes ticker-scroll-izquierda { from { transform: translateX(0); } to { transform: translateX(-100%); } }
@keyframes ticker-scroll-derecha   { from { transform: translateX(-100%); } to { transform: translateX(0); } }
```

(la regla actual `#tickerText { padding-left: 100%; }` se reemplaza por la clase
`.ticker-dir-izquierda`, y `@keyframes ticker-scroll` se renombra a
`ticker-scroll-izquierda`, agregando la variante `-derecha`).

En `updateTicker`, al aplicar la clase de dirección al `textEl`
(`ticker-dir-izquierda` o `ticker-dir-derecha` según `cfg.scroll_direccion`) y el
nombre del keyframe correspondiente en `textEl.style.animation`, junto al mismo
mecanismo ya existente de reiniciar la animación cuando cambia el texto (línea
~155-160: `style.animation = 'none'; void textEl.offsetWidth; style.animation =
...`). Si `scroll_direccion` cambia sin que cambie el texto, también debe
reiniciarse la animación (agregar `scroll_direccion` a la condición que dispara el
reinicio, junto a `text !== tickerLastText`).

## Fuera de alcance

- Animación de entrada/salida configurable (dirección/duración) para la banda del
  ticker — queda fija.
- Cambios de backend/validación en `/update_display_config` o `/get_display_config`.
- Cambios al mecanismo de velocidad (`speed_seconds`) del scroll continuo.
