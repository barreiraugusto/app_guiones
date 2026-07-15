# Refinamientos de Control en Vivo (Fase 3)

**Fecha:** 2026-07-15
**Estado:** Aprobado para implementación

## Contexto

Tras la Fase 2 (`docs/superpowers/specs/2026-07-14-control-de-graphs-design.md`), `/control_live/<guion_id>` ya tiene lienzo + Ticker/Vivo + panel lateral de notas/Graphs + panel de composición con "Al aire". Este spec cubre 4 ajustes de uso real detectados al operar la pantalla:

1. Layout del panel lateral (ancho, tamaño de botones).
2. Preview visual en el lienzo mientras se arma la composición, en vez de a ciegas.
3. Poder reposicionar las capas de la Plantilla activa directamente desde `/control_live`.
4. Separar "activar una nota" (en `ver_guion`/editor principal) de "poner un graph al aire" (exclusivo de `/control_live`).
5. Auto-ajuste de tamaño de fuente para que el texto siempre entre en una sola línea dentro de su caja.

## Decisiones de alcance (confirmadas con el usuario)

- **Layout:** la columna de notas pasa a ser 50% más ancha; los botones Editar/+/Eliminar del panel lateral se achican.
- **Preview:** mientras hay un Graph seleccionado en el panel de composición, el lienzo de `/control_live` muestra cómo quedaría esa composición — sin afectar `/pantalla` hasta apretar "Al aire". Al deseleccionar el Graph (o después de "Al aire"), el lienzo vuelve a mostrar el zócalo real activo (vía SSE, como hoy).
- **Resolución del preview:** client-side, instantánea. El valor de cada capa de texto se calcula en el navegador con el mismo mapeo simple que ya usa `_resolver_capas_plantilla` en el backend (duplicación mínima y aceptada, a cambio de reacción instantánea sin roundtrip por cada click).
- **Reposicionar capas:** el lienzo, mientras muestra el preview de un Graph seleccionado, permite arrastrar/redimensionar sus capas igual que el editor de Plantillas (`/plantillas`). El cambio de posición se guarda en la **Plantilla compartida** (mismo mecanismo que `/plantillas`, `PUT /api/plantillas/<id>`) — afecta a todos los Graphs que usen esa Plantilla, no es un override por Graph.
- **Activar nota ≠ poner al aire:** `PUT /textos/activo/<id>` (el endpoint compartido detrás del botón "Activar" tanto en `ver_guion.html` como en el editor principal) deja de activar los `Graph`s del texto — solo activa el `Texto` en sí, en todos los casos de uso del endpoint, sin diferenciar por pantalla de origen. `/control_live` resalta visualmente en el panel lateral la nota marcada como `Texto.activo`, sin auto-abrir su panel de composición ni tocar ningún `Graph.activo`. La única forma de poner un Graph al aire pasa a ser el botón "Al aire" de `/control_live`.
- **Auto-ajuste de texto:** aplica en la salida real (`pantalla.js`) y en el preview de `/control_live` — no en el editor de Plantillas (`/plantillas`), que sigue mostrando el `tamano_fuente` configurado tal cual (ahí se diseña con contenido de ejemplo, no el final real). `tamano_fuente` es un tope: si el texto entra cómodo se usa tal cual; si no, se reduce hasta que quepa en una sola línea dentro del ancho de la caja. Nunca se agranda.

## Layout del panel lateral (`app/templates/control_live.html`)

- Columnas: `col-md-2` (notas) → `col-md-3` (50% más ancha: 2×1.5=3). Ajustar las otras dos columnas para seguir sumando 12 — el lienzo (`col-md-7` → `col-md-6`) cede el espacio, el panel de propiedades/composición (`col-md-3`) queda igual.
- Botones Editar/+/Eliminar del panel lateral: agregar clase `btn-sm` (o reducir `font-size`/`padding` si `btn-sm` no alcanza visualmente) a los 3 botones generados en `cargarNotasYGraphs()`.

## Auto-ajuste de tamaño de texto

Nuevo archivo `app/static/js/ajuste-texto.js`, con una única función:

```js
function ajustarTamanoTexto(el, tamanoMaximo) {
    el.style.whiteSpace = 'nowrap';
    let tamano = tamanoMaximo;
    el.style.fontSize = `${tamano}px`;
    while (el.scrollWidth > el.clientWidth && tamano > 1) {
        tamano -= 1;
        el.style.fontSize = `${tamano}px`;
    }
}
```

- Se carga como `<script>` plano (no módulo) en `pantalla.html` y `control_live.html`, ANTES de sus scripts principales, para que la función esté disponible como global cuando se necesite.
- En `pantalla.js`: se llama en `crearElementoCapa` (capas de tipo texto, después de setear `el.textContent`, y después de que el elemento ya esté insertado en `#overlay-root` — si se llama antes de insertar, `clientWidth` da 0) y en el punto de `actualizarTextos` que actualiza el `textContent` de una capa existente (el texto puede cambiar sin que la capa se recree, así que hay que re-ajustar ahí también).
- En el preview de `control_live.js` (ver sección siguiente): se llama en el mismo punto donde se resuelve y asigna el `valor` client-side de cada capa de texto.
- No se toca `plantillas.js` (fuera de alcance, confirmado).

## Preview interactivo del lienzo (`app/static/js/control_live.js`)

### Carga al seleccionar un Graph

`seleccionarGraph(id)` (ya existente, Fase 2) se extiende: además de cargar la composición (`GET /graphs/<id>`), carga la **Plantilla completa** del Graph vía `GET /api/plantillas/<plantilla_id>` (mismo endpoint que ya usa el editor de Plantillas, `_serializar_plantilla` — trae TODAS las capas con todos sus atributos, no solo las de texto con valor). Se guarda en una variable nueva `plantillaEnEdicion` (objeto completo `{id, nombre, ancho, alto, capas: [...]}`).

### Cálculo de valores client-side

Función nueva `resolverValorCapa(capa, composicion)`, réplica minimalista del mapeo que ya hace `_resolver_capas_plantilla` en el backend:

```js
function resolverValorCapa(capa, comp) {
    if (capa.tipo !== 'texto') return null;
    const bajada = comp.bajadas.find(b => b.id === comp.bajada_activa_id);
    const cita = comp.citas.find(c => c.id === comp.cita_activa_id);
    const valoresPorCampo = {
        lugar: comp.mostrar_lugar ? (comp.lugar || '') : '',
        tema: comp.mostrar_tema ? (comp.tema || '') : '',
        entrevistado: cita ? cita.entrevistado : '',
        cita: cita ? cita.texto : '',
        bajada_1: bajada ? bajada.texto : '',
        bajada_2: '',
    };
    return valoresPorCampo[capa.campo_dato] ?? (capa.texto_fijo || '');
}
```

### Renderizado del preview

Mientras `graphComposicionId` no es null, `renderizarLienzo()` (ya existente) deja de dibujar `plantillaActual` (el zócalo real del SSE) y en su lugar dibuja `plantillaEnEdicion.capas`, cada una con:
- Capas de texto: `valor = resolverValorCapa(capa, composicion)`; si `valor` es vacío, la capa NO se dibuja (mismo criterio que ya aplica el backend real — consistencia visual entre preview y salida real).
- Todas las capas (texto, imagen, video) llevan la clase `elemento-editable` (arrastre/resize), igual que hoy tienen el Ticker y el badge Vivo — reutilizando el mismo patrón de `iniciarArrastre`/`moverArrastre`/`finalizarArrastre` ya usado en `plantillas.js`, adaptado a este archivo.

Cuando `graphComposicionId` es null (nada seleccionado, o Ticker/Vivo seleccionados), `renderizarLienzo()` vuelve a dibujar `plantillaActual` (SSE) como hasta ahora — sin cambios en ese camino.

### Guardado de posición

Al soltar un arrastre/resize de una capa de la plantilla en edición: actualizar `x`/`y`/`ancho`/`alto` de esa capa dentro de `plantillaEnEdicion.capas` (en memoria), y guardar la Plantilla completa con `PUT /api/plantillas/${plantillaEnEdicion.id}` (mismo formato que ya espera ese endpoint, usado por `guardarPlantilla()` en `plantillas.js`). Se guarda en `mouseup`, no en cada `mousemove` — mismo patrón que ya usan el Ticker y el badge Vivo.

## Separar "activar nota" de "poner al aire"

### Backend (`app/routes/textos.py`)

`setTextoActivo` deja de tocar `Graph`: se elimina el bloque `Graph.query.filter_by(activo=True).update({Graph.activo: False})` y el `for graph in texto.graphs: graph.activo = True`. Solo queda la activación del `Texto` (desactivar los demás textos, activar este).

### Frontend (`app/static/js/control_live.js`)

`cargarNotasYGraphs()` ya recibe `t.activo` en el payload de `GET /textos` — se agrega una clase visual (ej. `bg-warning`, mismo criterio de resaltado que ya usa `ver_guion.js` para la fila activa) a la nota que tenga `activo: true` en el panel lateral. Sin lógica adicional: no se auto-selecciona ni se auto-abre su panel de composición.

## Verificación manual

1. Abrir `/control_live/<guion_id>`: confirmar que la columna de notas es visiblemente más ancha y los botones Editar/+/Eliminar son más chicos que antes.
2. Escribir un texto largo en una bajada y activarla en un Graph con una capa angosta: confirmar en `/pantalla` que el texto se ve completo en una sola línea, con la fuente reducida si hace falta (no desborda la caja ni salta de línea).
3. Seleccionar un Graph en el panel lateral: confirmar que el lienzo cambia a mostrar el preview de ESE Graph, no el zócalo real activo.
4. Elegir otra bajada/cita, togglear lugar/tema, sin apretar "Al aire": confirmar que el lienzo (preview) refleja el cambio al instante, y que `/pantalla` NO cambia.
5. Arrastrar una capa del preview a otra posición: confirmar que se guarda en la Plantilla (recargar `/plantillas` y ver la nueva posición ahí) y que afecta a otro Graph que use la misma Plantilla.
6. Apretar "Al aire": confirmar que `/pantalla` ahora sí refleja la composición armada, con las posiciones de capa recién movidas.
7. Deseleccionar el Graph (click en el fondo del lienzo): confirmar que vuelve a mostrarse el zócalo real activo.
8. Desde `ver_guion.html` (u otra pantalla con el botón "Activar" nota), activar una nota que tenga un Graph: confirmar que el Graph NO se pone al aire (no cambia `/pantalla`), y que en `/control_live` esa nota aparece resaltada en el panel lateral.
9. Confirmar que el único camino para poner un Graph al aire sigue siendo el botón "Al aire" de `/control_live`.

## Fuera de alcance

- Auto-ajuste de tamaño de texto en el editor de Plantillas (`/plantillas`) — sigue mostrando `tamano_fuente` tal cual.
- Overrides de posición por Graph individual — el arrastre siempre edita la Plantilla compartida.
- Ajuste de altura de caja en el auto-shrink de texto (solo se garantiza que entre en el ancho, en una sola línea).
