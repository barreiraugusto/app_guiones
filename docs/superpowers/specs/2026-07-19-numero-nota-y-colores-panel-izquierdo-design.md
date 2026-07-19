# Número de nota en panel de propiedades y colores en panel izquierdo

## Problema

En `control_live` (editor de la salida en vivo):

1. El panel de propiedades (`#panel-propiedades-control`), al seleccionar un
   graph, muestra `Graph: {lugar}` pero no indica a qué nota pertenece.
2. El panel izquierdo (`#lista-notas`) solo distingue la nota activa del
   rundown (amarillo), sin distinguir notas ya emitidas (gris, como en la
   pantalla de guion) ni el graph que está efectivamente al aire ahora mismo.

## Alcance

Dos cambios, ambos acotados a `app/static/js/control_live.js` (sin cambios
de backend ni de modelos — todos los campos usados ya existen y ya viajan en
las respuestas de `/textos` y `/graphs/<id>`).

### 1. Número de nota en el panel de propiedades

Al seleccionar un graph (`seleccionarGraph`), el panel de composición
(`renderizarPanelComposicion`) debe mostrar el número de nota a la que
pertenece, arriba del lugar del graph.

Mecanismo: `cargarNotasYGraphs()` ya itera `textosFiltrados` (cada `t` tiene
`numero_de_nota`) para armar el HTML de cada graph. Se pasa
`t.numero_de_nota` como segundo argumento en el `onclick="seleccionarGraph(...)"`
existente, y `seleccionarGraph` lo guarda en `composicion.numero_de_nota`. No
hace falta tocar el backend (`GET /graphs/<id>` no incluye
`numero_de_nota`, pero no hace falta: el dato ya está disponible en el
frontend en el momento del click).

`renderizarPanelComposicion` antepone `Nota #{numero_de_nota}` al título
existente `Graph: {lugar}`.

### 2. Colores en el panel izquierdo (`#lista-notas`)

Mismo criterio que ya usa `app/static/js/guiones.js` para el guion, con un
color nuevo agregado para "en vivo":

**Fila de la nota** (`notaDiv`, contiene el número/título de la nota y sus
graphs) — misma prioridad que en `guiones.js` (`emitido` gana sobre
`activo`):
- `emitido` (Texto.emitido) → gris (`bg-secondary`)
- si no, `activo` (Texto.activo — nota activa del rundown) → amarillo
  (`bg-warning`)
- si no, sin color (comportamiento actual)

**Fila de cada graph** (dentro de la nota):
- `activo` (Graph.activo — el graph que está efectivamente al aire ahora
  mismo, mismo campo que usa `stream_display_config` para resolver qué se
  transmite) → rojo (`bg-danger`)
- si no, sin color

Esto reemplaza el `g.activo ? 'bg-warning' : ''` actual: hoy la fila del
graph comparte el amarillo con la nota activa del rundown, lo cual mezcla
dos conceptos distintos (nota activa del rundown vs. graph al aire). Pasa a
ser rojo para distinguirlos.

## Fuera de alcance

- Cambios de backend o de modelos (todos los campos usados ya existen).
- Cambios a `guiones.js` / la pantalla de guion (ya tiene su propio
  coloreado, usado como referencia).
- Actualización en tiempo real vía SSE de estos colores (se recalculan cada
  vez que se recarga la lista, igual que hoy).
