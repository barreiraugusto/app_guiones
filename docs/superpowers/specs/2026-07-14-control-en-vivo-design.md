# Rediseño de la pantalla de Control en Vivo (Fase 1: preview + Ticker + Vivo)

**Fecha:** 2026-07-14
**Estado:** Aprobado para implementación

## Contexto

Tras implementar el ticker (`docs/superpowers/specs/2026-07-14-ticker-design.md`) con sus controles repartidos entre `control_graphs.html` (texto/on-off) y `control_live.html` (velocidad/colores/posición), el resultado no convenció: la separación entre pantallas resulta incómoda para operar, y `control_live.html` es un formulario de inputs sueltos sin relación visual con lo que realmente se ve en pantalla.

Este spec reemplaza ese enfoque por una única pantalla de control con el mismo lenguaje visual que el editor de Plantillas ya existente (`app/templates/plantillas.html`, `app/static/js/plantillas.js`): un lienzo interactivo que refleja el estado real de salida, con overlays arrastrables directamente sobre él y un panel de propiedades al costado.

**Alcance de esta fase (Fase 1):** el lienzo interactivo, con el Ticker y el badge "Vivo" como los dos overlays controlables ahí (son overlays independientes del `Graph` activo, ya vive toda su config en `display_config.json`). El control de creación/edición de `Graph`s (zócalos: lugar, tema, entrevistados, bajadas, plantilla) queda fuera de este spec — es la Fase 2, sobre `control_graphs.html`, con spec propio posterior.

## Decisiones de alcance (confirmadas con el usuario)

- **Reemplaza `/control_live`** (misma ruta y punto de acceso ya existente en `app/routes/main.py`), no una URL nueva. `control_graphs.html` (control por guion) no se toca en esta fase.
- **Se elimina el código muerto de `layout`/`badges`**: confirmado por grep que `pantalla.js` no lee `data.layout` ni `data.badges` — son remanentes del zócalo hardcodeado previo al sistema de Plantillas. Se sacan del HTML, del JS y de `display_config.json` no hace falta migrarlos (simplemente dejan de escribirse; las claves viejas quedan inertes si el archivo ya las tiene, sin efecto).
- **Zócalo (`Graph` activo) en el lienzo: de solo lectura.** Se muestra vía el SSE ya existente (`/stream_display_config`) para dar contexto visual real, pero no es arrastrable ni editable desde esta pantalla — eso lo sigue haciendo el editor de Plantillas.
- **Ticker:** arrastre restringido a un eje — solo vertical (`top`), resize solo en altura (`height`). Sigue ocupando el ancho completo del lienzo (1920px fijo), igual que hoy.
- **Badge Vivo:** arrastre libre en X/Y como cualquier capa del editor de Plantillas, tamaño fijo (no redimensionable — su tamaño real depende del texto que contiene, se autoajusta).
- **Formato de posición del badge Vivo cambia de `top`/`right` a `top`/`left`.** Es más simple de implementar y consistente con cómo el resto del editor mide posiciones (desde arriba-izquierda). El valor `right` que hoy pueda existir en `display_config.json` de producción queda inerte y se reemplaza la primera vez que alguien arrastre el badge en la pantalla nueva.
- **Guardado automático**, sin botón "Guardar": cada cambio (soltar un arrastre/resize, tipear y perder foco, tocar un color, togglear mostrar/ocultar) dispara un `POST /update_display_config` inmediato — coherente con ser una pantalla de operación en vivo, no un editor de borradores.

## Datos

### Sección `ticker` en `display_config.json`
Sin cambios respecto al spec anterior: `show`, `text`, `speed_seconds`, `color`, `bg_color`, `top`, `height`.

### Sección `live` en `display_config.json`
Cambia de forma:

| Campo | Antes | Ahora |
|---|---|---|
| show | Boolean | Boolean (sin cambio) |
| text | String | String (sin cambio) |
| top | String (px) | String (px, sin cambio) |
| ~~right~~ | String (px) | **eliminado** |
| left | — | **nuevo**, String (px) |

### Secciones `layout` y `badges`
Se eliminan del flujo: ya no se leen ni se escriben desde ningún endpoint ni pantalla. No requiere migración de datos (simplemente dejan de usarse; si existen en el archivo, quedan como claves inertes sin efecto, igual que ya pasa hoy con `DEFAULT_DISPLAY_CONFIG`).

## Backend (`app/routes/graphs.py`)

- `update_display_config`: la lista de secciones aceptadas pasa de `['layout', 'badges', 'live', 'ticker']` a `['live', 'ticker']`.
- `stream_display_config`: el payload deja de incluir `layout` y `badges`. Sigue incluyendo `live` y `ticker` sin cambios de mecanismo (mismo `saved_config.get(...)`).
- `get_display_config`: sin cambios de código — sigue devolviendo el archivo tal cual, ahora sin que nadie escriba `layout`/`badges` en él.

## Salida (`pantalla.html` / `pantalla.js`)

- El badge "Vivo" (`#liveBadge`) cambia de posicionarse con `style.right` a `style.left`, leyendo `data.live.left` en vez de `data.live.right`.
- Sin más cambios: el ticker (ya implementado) y el resto del flujo SSE quedan igual.

## Página de control (`app/templates/control_live.html` + `app/static/js/control_live.js`, nuevo archivo)

Se reescribe el template y se extrae la lógica a un JS propio (el archivo actual tenía el script inline; dado el salto de complejidad — arrastre, resize, panel de propiedades dinámico — se separa siguiendo el mismo patrón que `plantillas.js`).

### Estructura de la página

Layout de 2 columnas, igual que el editor de Plantillas (`col-md-9` / `col-md-3`), sin lista de tarjetas superior (no hay múltiples "control en vivo" entre los que elegir):

```html
<div class="row">
    <div class="col-md-9">
        <div id="lienzo-wrapper">
            <div id="lienzo-control">
                <!-- zócalo activo (solo lectura), ticker y badge Vivo se renderizan acá -->
            </div>
        </div>
    </div>
    <div class="col-md-3">
        <div id="panel-propiedades-control" class="card p-3">
            <p class="text-muted">Seleccioná el ticker o el badge Vivo para editar sus propiedades.</p>
        </div>
    </div>
</div>
```

Reutiliza el CSS ya existente de `#lienzo-wrapper`/`#lienzo` (fondo a cuadros, `transform: scale(0.5)`, `ANCHO_LIENZO`/`ALTO_LIENZO`/`ESCALA_LIENZO` = 1920/1080/0.5) — se puede copiar el bloque de estilos de `plantillas.html` o, si se prefiere no duplicar, moverlo a una clase compartida en `base.html`. Para esta fase, copiarlo es aceptable (YAGNI, ambas páginas son independientes y no comparten JS).

### Zócalo activo (solo lectura)

- Se suscribe al mismo SSE `/stream_display_config` que ya consume `pantalla.js`.
- Renderiza `data.plantilla` con la misma lógica de `crearElementoCapa`/`renderizarPlantilla` de `pantalla.js` (capas de imagen/video/texto posicionadas), pero **sin** los listeners de `mousedown`/click de selección — son `<div>`s puramente visuales, ningún `resize-handle`.
- Se recomienda extraer esa función de renderizado (`crearElementoCapa` en modo solo-lectura) a algo reusable entre `pantalla.js` y este archivo si la duplicación resulta molesta; si no, una copia acotada del snippet es aceptable para esta fase (no es el foco del spec).

### Ticker (elemento arrastrable de un eje)

- Se dibuja como un `<div>` de ancho fijo 1920px, alto = `ticker.height`, `top` = `ticker.top`, con el texto/color/fondo actuales como preview.
- `mousedown` → inicia arrastre restringido a Y: igual que `iniciarArrastre`/`moverArrastre` de `plantillas.js`, pero el delta de X se ignora siempre (solo se actualiza `top`).
- `resize-handle` → inicia resize restringido a alto: igual que `iniciarRedimension`/`moverRedimension`, pero el delta de X se ignora (solo se actualiza `height`).
- Al soltar (`mouseup`): guarda el objeto `ticker` completo vía `POST /update_display_config`.

### Vivo (elemento arrastrable libre, tamaño fijo)

- Se dibuja como un `<div>` con el texto actual, posicionado en `left`/`top`. Sin `resize-handle` (tamaño fijo, se autoajusta al contenido de texto vía CSS, igual que hoy en `pantalla.html`).
- `mousedown` → arrastre libre en X/Y, igual patrón que las capas de Plantillas.
- Al soltar (`mouseup`): guarda el objeto `live` completo (`{show, text, top, left}`) vía `POST /update_display_config`.

### Panel de propiedades

Función `renderizarPanelPropiedades()` análoga a la de `plantillas.js`, con 3 estados:

**Nada seleccionado:**
```
Seleccioná el ticker o el badge Vivo para editar sus propiedades.
```

**Ticker seleccionado:**
- Checkbox "Mostrar" (`show`)
- Input texto "Texto" (`text`)
- Input number "Velocidad (seg/vuelta)" (`speed_seconds`)
- Input color "Color texto" (`color`)
- Input color "Color fondo" (`bg_color`)
- Input number "Top (px)" (`top`) — sincronizado en ambas direcciones con el arrastre vertical
- Input number "Alto (px)" (`height`) — sincronizado en ambas direcciones con el resize

**Vivo seleccionado:**
- Checkbox "Mostrar" (`show`)
- Input texto "Texto" (`text`)
- Input number "Top (px)" (`top`) — sincronizado con el arrastre
- Input number "Left (px)" (`left`) — sincronizado con el arrastre

Cada input dispara guardado en `change` (checkboxes/colores) o `blur` (textos/números), igual patrón que ya usa `control_graphs.html`.

### Selección

- Click en el ticker o en el badge Vivo → lo selecciona (resalta con el mismo estilo `.seleccionada` que usa el editor de Plantillas) y regenera el panel de propiedades.
- Click en el zócalo (solo lectura) o en el fondo del lienzo → deselecciona (vuelve al estado "nada seleccionado").

### Carga inicial y guardado

- Al cargar la página: `GET /get_display_config` trae `ticker` y `live` completos (con los mismos fallbacks ya usados: `speed_seconds`→15, `color`→'#ffffff', `bg_color`→'#000000', `ticker.top`→1000, `ticker.height`→50, `live.top`→150, `live.left`→150 — ancho del lienzo menos un margen razonable, ya que no hay valor previo de `left` en producción).
- Cada guardado (`change`/`blur`/`mouseup`) llama a una función común `guardarSeccion(nombre, datos)` que hace `POST /update_display_config` con `{[nombre]: datos}` (`datos` es siempre el objeto completo en memoria de esa sección, no un parcial).
- No hay indicador de "guardando..." ni de error visible más allá de un `.catch` con log a consola, igual que el resto de los controles operativos ya construidos (sin sobre-construir).

## Limpieza

- `app/templates/control_live.html`: reescritura completa (supera el 80% del archivo, se usa `Write` en vez de `Edit`).
- Se elimina el script inline viejo (`layout`/`badges`/`live` como formulario) y se reemplaza por `<script src="{{ url_for('static', filename='js/control_live.js') }}"></script>`.
- `DEFAULT_DISPLAY_CONFIG` (`app/routes/graphs.py:415`, ya confirmado código muerto en el spec del ticker) sigue sin tocarse — sigue sin usarse en ningún endpoint, ahora con más razón dado que `layout`/`badges` tampoco se escriben más.

## Verificación manual

1. Levantar el server, abrir `/control_live`: debe verse el lienzo con el zócalo activo (si hay uno) en modo solo lectura, más el ticker y el badge Vivo superpuestos y arrastrables.
2. Arrastrar el ticker verticalmente → soltar → confirmar en `/pantalla` (otra pestaña) que se movió, sin recargar.
3. Redimensionar el alto del ticker con el resize-handle → confirmar que cambia el alto de la banda en `/pantalla`.
4. Arrastrar el badge Vivo a una posición nueva → confirmar que se movió en `/pantalla`, leyendo `left` en vez de `right`.
5. Seleccionar el ticker, cambiar texto/velocidad/colores desde el panel → confirmar reflejo en `/pantalla`.
6. Seleccionar el badge Vivo, togglear "Mostrar" → confirmar que aparece/desaparece en `/pantalla`.
7. Con un `Graph` activo (zócalo visible), confirmar que se ve correctamente en el lienzo de `/control_live` pero no reacciona a clicks de arrastre.
8. Confirmar que `layout`/`badges` ya no aparecen en ningún lado de la UI ni se escriben en `display_config.json` tras guardar cualquier cambio.

## Fuera de alcance

- Control de creación/edición de `Graph`s (zócalos) dentro de esta pantalla — Fase 2, spec separado.
- Migración o backfill de datos viejos de `layout`/`badges`/`live.right` en `display_config.json` — quedan inertes, no se tocan.
- Extraer a un módulo compartido el renderizado de capas de Plantilla entre `pantalla.js` y esta pantalla (aceptable duplicar por ahora).
