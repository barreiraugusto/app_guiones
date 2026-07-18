# Ticker: ángulo de rotación configurable

## Problema

El ticker siempre se muestra como una banda horizontal recta. No hay forma de
inclinarlo para un efecto visual diagonal.

## Alcance

Un único campo nuevo: `angulo` (grados), que rota la banda completa (fondo +
texto) alrededor de su propio centro. No incluye control de arrastre con mouse
(solo input numérico), ni afecta la dirección/velocidad del scroll continuo del
texto (que sigue funcionando dentro de la banda ya rotada).

## Persistencia

Mismo mecanismo que el resto del ticker: JSON libre en `display_config.json`,
sección `ticker`, sin validación de backend (`app/routes/graphs.py:476-517`).

Nuevo campo:

```json
{
  "ticker": {
    "...": "...",
    "angulo": 0
  }
}
```

Rango permitido en el input del panel: `-45` a `45` grados (cubre inclinaciones
diagonales legibles sin llegar a invertir el texto). El valor se clampa en el
listener del input con `Math.max(-45, Math.min(45, ...))`, mismo criterio que
`ancho` (`Math.max(20, ...)`) ya usa.

## Editor de control en vivo (`app/static/js/control_live.js`)

`tickerState` (`cargarConfig`): agregar

```js
angulo: Math.max(-45, Math.min(45, parseFloat(config.ticker && config.ticker.angulo) || 0)),
```

`crearElementoTicker()`: agregar

```js
el.style.transform = `rotate(${tickerState.angulo}deg)`;
```

**Panel de propiedades** (bloque `elementoSeleccionado === 'ticker'`): agregar un
input numérico "Ángulo" (con `min="-45" max="45"`) junto a los demás campos,
mismo patrón de listener `blur` → clamp → `guardarSeccion('ticker', tickerState)`
→ `renderizarLienzo()` que ya usan `left`/`width`.

No se agrega arrastre/resize con mouse para este campo (decisión explícita, solo
input).

## Salida real (`app/static/js/pantalla.js`)

**No se puede aplicar como `band.style.transform` directo.** La banda tiene una
animación de entrada/salida (`anim-ticker-enter`/`anim-ticker-exit`, ver spec del
ticker "ancho y deslizamiento") con `animation-fill-mode: forwards`, y la clase de
entrada nunca se remueve mientras el ticker está visible — así que esa animación
controla la propiedad `transform` por completo durante toda la vida del elemento
mostrado, tapando cualquier `transform` inline. La rotación debe inyectarse dentro
de los propios keyframes vía una custom property:

En `app/templates/pantalla.html`, los keyframes `tickerSlideIn`/`tickerSlideOut`
deben componer `rotate(var(--angulo, 0deg))` junto al `translateX` existente, en
ese orden (`translateX(...) rotate(...)`, no al revés — con `rotate` primero en
la lista, el desplazamiento quedaría en diagonal en vez de horizontal, porque
`translateX` se aplicaría dentro del sistema de coordenadas ya rotado):

```css
@keyframes tickerSlideIn  { from { opacity: 0; transform: translateX(100%) rotate(var(--angulo, 0deg)); } to { opacity: 1; transform: translateX(0) rotate(var(--angulo, 0deg)); } }
@keyframes tickerSlideOut { from { opacity: 1; transform: translateX(0) rotate(var(--angulo, 0deg)); } to { opacity: 0; transform: translateX(100%) rotate(var(--angulo, 0deg)); } }
```

Y en `updateTicker(ticker)`, junto a donde ya se aplican `left`/`width`/`top`/
`height`, setear la custom property (no `style.transform`):

```js
band.style.setProperty('--angulo', `${parseFloat(cfg.angulo) || 0}deg`);
```

La rotación usa el `transform-origin` por defecto de CSS (`center`), así que la
banda gira sobre su propio centro sin desplazar la posición de referencia
(`left`/`top`) de la caja sin rotar. Verificado empíricamente: la matriz final
tiene el componente de rotación correcto y la trayectoria intermedia de la
animación de entrada no tiene componente vertical (el desplazamiento sigue siendo
horizontal recto).

## Fuera de alcance

- Control de arrastre/rotación con mouse en el editor.
- Cambios al mecanismo de scroll continuo del texto o a la animación de
  entrada/salida de la banda (siguen aplicándose sobre la banda ya rotada, sin
  cambios).
- Validación de backend.
