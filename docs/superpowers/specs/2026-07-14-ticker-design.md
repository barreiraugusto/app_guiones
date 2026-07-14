# Ticker (cinta de texto)

**Fecha:** 2026-07-14
**Estado:** Aprobado para implementación

## Contexto

Este spec es el primero de una descomposición mayor: replicar en `app_guiones` algunas funciones de [overlays.uno](https://overlays.uno/) (lower thirds — ya cubierto por el sistema de Plantillas —, tickers, countdowns, control remoto, URLs key/fill). Cada una es un sub-proyecto independiente con su propio spec. Este documento cubre solo el **ticker**.

La app ya tiene un mecanismo de overlay "config simple" para el badge "Vivo": una sección `live` en `display_config.json`, editable desde `control_live.html` (`POST /update_display_config`), leída por `GET /get_display_config` y reenviada en tiempo real por el SSE `/stream_display_config` (`app/routes/graphs.py`). `pantalla.js` la consume en `updateDisplay(data)` y pinta el badge sobre el lienzo fijo de 1920×1080 de `pantalla.html`, que se usa como Browser Source en OBS.

El ticker sigue exactamente ese mismo patrón: un overlay de texto simple, independiente del sistema de `Graph`/`Plantilla`, que convive en el mismo lienzo.

## Decisiones de alcance (confirmadas con el usuario)

- **Contenido:** un único campo de texto libre, editado a mano por el operador (no se arma automáticamente desde notas del guion).
- **Independencia:** el ticker se prende/apaga con su propio control, sin relación con el `Graph` activo — puede convivir con un zócalo en pantalla o mostrarse solo.
- **Persistencia:** `display_config.json`, no tabla nueva en base de datos. Reutiliza el mecanismo de merge por sección que ya tiene `/update_display_config`.
- **Posición:** configurable en px (`top`, `height`), igual que los badges de lugar/nombre — no fija por CSS.
- **Velocidad:** configurable por el operador (`speed_seconds` = segundos por vuelta completa de scroll).
- **Ubicación de los controles:**
  - Operativo (texto + on/off, se edita seguido durante la emisión) → `control_graphs.html`, junto al resto de la operación en vivo del guion.
  - Estilo (velocidad, colores, posición, se configura rara vez) → `control_live.html`, como sección nueva junto a `layout`/`badges`/`live`.

## Datos

Nueva sección `ticker` en `display_config.json`:

| Campo | Tipo | Notas |
|---|---|---|
| show | Boolean | on/off |
| text | String | contenido del ticker |
| speed_seconds | Number | segundos por vuelta completa de scroll |
| color | String | hex, color del texto |
| bg_color | String | hex, color de fondo de la banda |
| top | String (px) | posición vertical, igual convención que `live.top`/`live.right` |
| height | String (px) | alto de la banda |

## Backend (`app/routes/graphs.py`)

- `update_display_config`: agregar `'ticker'` a la lista de secciones válidas (junto a `'layout'`, `'badges'`, `'live'`) en el loop que hace merge por sección (línea ~457). Sin cambios de estructura, mismo mecanismo de merge que ya existe.
- `stream_display_config`: agregar `config['ticker'] = saved_config.get('ticker', {})` al payload junto a `layout`/`badges`/`live`, dentro de `event_stream()`.
- `get_display_config` / `DEFAULT_DISPLAY_CONFIG`: agregar bloque `ticker` con valores default (`show: False, text: '', speed_seconds: 15, color: '#ffffff', bg_color: '#000000', top: '1000px', height: '50px'`).

## Salida (`pantalla.html` / `pantalla.js`)

- Nuevo elemento fijo en `pantalla.html`: `<div id="ticker-band"><span id="ticker-text"></span></div>`, `position: fixed`, `overflow: hidden`, ancho 100%, oculto por default.
- Nueva animación CSS `@keyframes ticker-scroll { from { transform: translateX(100%); } to { transform: translateX(-100%); } }`, misma carpeta de `<style>` que las animaciones `anim-fade-*`/`anim-slide-*` existentes.
- En `pantalla.js`, dentro de `updateDisplay(data)`: bloque análogo al de `liveBadge`, procesado siempre (no depende de `hayGraphActivo` ni de `plantillaVisible`):
  - Si `data.ticker.show`: setea `top`/`height`/`color`/`background-color` de la banda, `textContent` del span, `animation-duration` = `speed_seconds`, y muestra la banda (`display: block`).
  - Si cambia el texto respecto al render anterior, se fuerza un reflow (quitar y reponer la clase de animación) para que no corte el scroll a mitad de vuelta.
  - Si `data.ticker.show` es false, oculta la banda (`display: none`).

## Control operativo (`control_graphs.html`)

- Input de texto + toggle on/off en el header o footer de la tabla de notas (junto al botón "Atrás").
- Guarda vía `fetch POST /update_display_config` con body `{ticker: {show, text}}` únicamente, al `blur` del input y al cambiar el toggle. El merge por sección del backend no pisa `speed_seconds`/`color`/`bg_color`/`top`/`height`.

## Control de estilo (`control_live.html`)

- Nueva `config-section` "Ticker", mismo patrón visual que la de "Vivo": campos `speed_seconds` (number), `color` (input color), `bg_color` (input color), `top` (px), `height` (px).
- Se integra en el `loadConfig`/`populateForm`/`onsubmit` existentes del formulario único de la página.

## Verificación manual

1. Levantar el server, abrir `pantalla.html` en un tab (o como Browser Source en OBS).
2. Activar el ticker con texto desde `control_graphs.html` → confirmar que aparece y hace scroll continuo.
3. Cambiar velocidad/colores/posición desde `control_live.html` → confirmar que se refleja en `pantalla.html` sin recargar (vía SSE).
4. Activar un `Graph` (zócalo) mientras el ticker está visible → confirmar que ambos conviven sin pisarse ni interferir en sus animaciones.
5. Apagar el ticker → confirmar que desaparece sin afectar el zócalo activo.

## Fuera de alcance

- Countdown, control remoto (Stream Deck/móvil) y URLs key/fill: sub-proyectos separados, no cubiertos por este spec.
- Múltiples tickers guardados o historial de mensajes.
- Contenido automático desde títulos de notas.
