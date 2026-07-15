# Control de Graphs desde Control en Vivo (Fase 2)

**Fecha:** 2026-07-14
**Estado:** Aprobado para implementación

## Contexto

La Fase 1 (`docs/superpowers/specs/2026-07-14-control-en-vivo-design.md`) reemplazó `/control_live` por un lienzo interactivo para el Ticker y el badge "Vivo", pero dejó fuera de alcance el control de `Graph`s (zócalos): eso seguía viviendo en `control_graphs.html` (tabla de notas por guion, modal de crear/editar, activar/desactivar). Esta Fase 2 lo absorbe, reemplazando `control_graphs.html` por completo, y agrega una capacidad que hoy no existe: el operador puede armar una composición del zócalo (qué bajada mostrar, qué cita mostrar, si mostrar lugar/tema) **antes** de ponerla al aire, en vez de que el sistema tome siempre la primera bajada y la primera cita de forma fija.

## Decisiones de alcance (confirmadas con el usuario)

- **Ruta:** `/control_live` pasa a depender del guion: `GET /control_live/<guion_id>` (misma firma que hoy tiene `/control_graphs/<id>`). Reemplaza tanto a la ruta global anterior como a `/control_graphs/<id>`.
- **`control_graphs.html`, `app/static/js/grafica.js` y la ruta `graphs.control_graphs` se eliminan.** Todo lo que hacían se reubica dentro de la nueva pantalla. El botón agregado en `listado_guiones.html` (Fase 1) pasa a apuntar a `main.control_live` con `guion_id`.
- **Preview separado de "al aire":** el operador arma la composición (bajada activa, cita activa, mostrar/ocultar lugar y tema) en memoria del navegador. Nada se persiste ni se refleja en `/pantalla` hasta apretar el botón **"Al aire"**.
- **"Al aire" activa el graph Y aplica la composición** en una sola acción — reemplaza al botón de activar que existe hoy. No hay un paso separado de "activar" y otro de "aplicar selección".
- **Una bajada visible por vez, alternable.** El operador elige, entre todas las bajadas guardadas del graph, cuál es la actualmente visible. No hay dos bajadas simultáneas.
- **Una cita visible por vez, entre todas las citas de todos los entrevistados del graph** (lista plana, no se elige primero el entrevistado). El nombre del entrevistado mostrado en pantalla se deriva de la cita activa.
- **Lugar y tema: toggle on/off manual**, independiente de si tienen dato cargado.
- **Capas vacías se ocultan solas**, sin agrupamiento: cualquier capa de texto de la Plantilla cuyo valor resuelto quede vacío (por dato faltante o por toggle apagado) se excluye de la salida — ni en `/pantalla` ni en el preview de `/control_live`. Sin configuración adicional en el editor de Plantillas.
- **Nuevo campo de plantilla `cita`** (texto de la cita activa), separado de `entrevistado` (que sigue resolviendo al nombre). `bajada_2` queda como opción existente en el editor de Plantillas pero sin uso funcional en el nuevo esquema (siempre se resuelve vacía, por ende esa capa no se muestra) — no se elimina del sistema, solo queda inerte.
- **Panel de composición reemplaza al panel de propiedades del Ticker/Vivo** (mismo lugar en pantalla) cuando hay un Graph seleccionado en el panel lateral.

## Modelo de datos

### `Graph` — 4 columnas nuevas
| Campo | Tipo | Notas |
|---|---|---|
| `bajada_activa_id` | Integer, FK → `bajada.id`, `ondelete=SET NULL`, nullable | Bajada visible actualmente. `None` = ninguna (capa de bajada oculta). |
| `cita_activa_id` | Integer, FK → `cita.id`, `ondelete=SET NULL`, nullable | Cita visible actualmente. `None` = ninguna (capas de cita/entrevistado ocultas). |
| `mostrar_lugar` | Boolean, default `True`, nullable=False | Toggle manual, independiente del dato. |
| `mostrar_tema` | Boolean, default `True`, nullable=False | Toggle manual, independiente del dato. |

Relaciones `db.relationship('Bajada')` / `db.relationship('Cita')` sobre esas FKs (sin `backref` necesario).

Migración Alembic: agrega las 4 columnas. Todas nullable o con default — sin backfill. Graphs existentes quedan con `bajada_activa_id=None`, `cita_activa_id=None`, `mostrar_lugar=True`, `mostrar_tema=True` (lugar/tema se siguen mostrando si tienen dato cargado; bajada/cita arrancan sin selección hasta la primera composición armada por el operador).

### `PlantillaCapa.campo_dato`
Se agrega `'cita'` a los valores posibles (hoy: `'lugar' | 'tema' | 'entrevistado' | 'bajada_1' | 'bajada_2' | None`). Sin cambio de tipo de columna (ya es `String(20)`, cabe).

## Backend (`app/routes/graphs.py`)

### `PUT /graphs/activo/<id>` — extendido
Sigue haciendo lo que ya hace (desactivar todos los graphs, activar `id`). Body opcional nuevo:
```json
{"bajada_activa_id": 12, "cita_activa_id": 34, "mostrar_lugar": true, "mostrar_tema": false}
```
Si estas claves vienen en el body, se persisten en el `Graph`. Si no vienen (ej. una reactivación simple sin cambiar composición), no se tocan — quedan como estaban.

### `GET /graphs/<id>` — extendido
El JSON de respuesta agrega `bajada_activa_id`, `cita_activa_id`, `mostrar_lugar`, `mostrar_tema`, para que el frontend pueda inicializar el estado del panel de composición al seleccionar un graph.

### `_resolver_capas_plantilla` — reescrito
Cambia de tomar `bajadas[0]`/`citas[0]` fijos a:

| campo_dato | Valor resuelto |
|---|---|
| `lugar` | `graph_activo.lugar` si `mostrar_lugar` es `True`, si no `""` |
| `tema` | `graph_activo.tema` si `mostrar_tema` es `True`, si no `""` |
| `entrevistado` | `graph_activo.cita_activa.entrevistado.nombre` si hay cita activa, si no `""` |
| `cita` (nuevo) | `graph_activo.cita_activa.texto` si hay cita activa, si no `""` |
| `bajada_1` | `graph_activo.bajada_activa.texto` si hay bajada activa, si no `""` |
| `bajada_2` | siempre `""` (inerte) |

**Ocultar capas vacías:** después de resolver `valor` para una capa de tipo texto, si `valor == ""` esa capa se excluye por completo del array `capas` devuelto (no se envía ni a `pantalla.js` ni a `control_live.js` — ambos consumen el mismo `_resolver_capas_plantilla` vía el mismo SSE, así que el cambio los cubre a los dos).

## Salida (`app/static/js/pantalla.js`) — remover capas que quedan vacías

Hoy, cuando la plantilla activa no cambia de `id` (`hayGraphActivo && data.plantilla.id === plantillaActualId`), `updateDisplay` solo llama `actualizarTextos(plantillaData)`, que itera `plantillaData.capas` y actualiza el `textContent` de los elementos DOM existentes — nunca remueve un elemento cuyo `capa-${id}` ya no aparece en el array nuevo. Con capas que se ocultan dinámicamente (bajada/cita/lugar/tema togueleados), esto dejaría un elemento huérfano en pantalla con el último texto que tuvo.

`actualizarTextos` pasa a recorrer también los elementos `.capa` ya presentes en `#overlay-root` y remover del DOM cualquiera cuyo `id` no esté en el array de capas recibido (comparación por `capa-${id}`). Se aplica la misma animación de salida (`aplicarAnimacion('salida')`, ya existente) a la capa que se remueve, usando su propia `duracion_transicion_ms` guardada en `capasActuales` antes de sacarla del DOM — mismo mecanismo que ya usa el código para ocultar toda la plantilla cuando no hay graph activo, aplicado ahora por capa individual en vez de al conjunto completo. `control_live.js` (zócalo de solo lectura, sin animaciones) hace la remoción simple, sin animación, consistente con que ese preview ya renderiza sin transiciones.

## Frontend

### Estructura de página (`control_live.html`)
Tres columnas: panel de notas/Graphs (izquierda) | lienzo (centro) | panel de propiedades/composición (derecha, ya existente de la Fase 1). El lienzo sigue mostrando en vivo el zócalo activo, ticker y badge Vivo exactamente igual que en la Fase 1 — sin cambios ahí.

### Panel lateral — notas y Graphs del guion
- `GET /textos` filtrado en el cliente por `guion_id` (mismo patrón que ya usa `grafica.js` hoy), ordenado por `numero_de_nota`. Cada texto ya viene con sus `graphs` anidados.
- Por nota: número + título, y debajo la lista de sus Graphs (etiqueta corta `lugar — tema`), resaltando el que tenga `activo: true`.
- Por Graph: botón **Seleccionar** (carga el panel de composición), **Editar** (abre el modal), **Eliminar** (igual que hoy).
- Botón "+ Nuevo graph" por nota (abre el modal con `texto_id` preseleccionado — reusa `abrirModalGraph`).
- Header del panel: nombre del guion + botón "Exportar XML" (reusa `ExportarGraphsXML`, sin cambios).

### Modal de crear/editar Graph
Se reubica el modal `formularioGraphModal` (HTML) y su lógica (`app/static/js/graphs.js`, prácticamente sin cambios: `guardarGraph`, `editarGraph`, `eliminarGraph`, `agregarBajada`, `agregarEntrevistado`, etc.) dentro de `control_live.html`. Único cambio funcional: el punto de refresco tras guardar/eliminar deja de llamar a `seleccionarGuion` (de `grafica.js`, que se elimina) y pasa a llamar a la función de recarga del panel lateral nuevo.

### Panel de composición (reemplaza el panel de Ticker/Vivo al seleccionar un Graph)
Al hacer click en "Seleccionar" sobre un Graph:
1. `GET /graphs/<id>` trae el estado completo (lugar, tema, bajadas, entrevistados/citas, `bajada_activa_id`, `cita_activa_id`, `mostrar_lugar`, `mostrar_tema`).
2. Se copia a un objeto local `composicion` — estado **solo en memoria**, no se guarda nada todavía.
3. El panel muestra:
   - Toggle Mostrar/Ocultar **Lugar** (label con el valor actual, de solo lectura — se edita desde el modal).
   - Toggle Mostrar/Ocultar **Tema**.
   - Radio buttons con todas las **bajadas** del graph + opción "Ninguna", marcando la activa.
   - Radio buttons con lista plana de todas las **citas** (`Nombre: "texto de la cita"`) de todos los entrevistados + opción "Ninguna", marcando la activa.
   - Botón grande **"Al aire"**.
4. Cada cambio en los controles solo modifica `composicion` en memoria (sin llamadas al backend).
5. **"Al aire"** manda `composicion` completo (`bajada_activa_id`, `cita_activa_id`, `mostrar_lugar`, `mostrar_tema`) a `PUT /graphs/activo/<id>`. Recién ahí se persiste y se refleja en `/pantalla` (vía el SSE, que ya está andando).

## Limpieza

- Eliminar `app/templates/control_graphs.html`, `app/static/js/grafica.js`, la ruta `graphs.control_graphs` (`app/routes/graphs.py:295-300`).
- Actualizar `app/templates/listado_guiones.html`: el botón de acceso (agregado en la Fase 1 del Ticker) pasa de `url_for('graphs.control_graphs', id=guion.id)` a `url_for('main.control_live', guion_id=guion.id)`.
- `app/routes/main.py`: la función `control_live()` pasa a aceptar `<int:guion_id>` y a resolver el `Guion` (404 si no existe), igual patrón que hoy tiene `graphs.control_graphs`.

## Editor de Plantillas (`app/static/js/plantillas.js`)
Se agrega `'cita'` al `<select id="prop-campo-dato">` de `renderizarPanelPropiedades()` (junto a lugar/tema/entrevistado/bajada_1/bajada_2), para que se pueda vincular una capa de texto a ese campo nuevo. Sin más cambios en el editor.

## Verificación manual

1. Abrir `/control_live/<guion_id>` de un guion con notas y Graphs existentes: confirmar que el panel izquierdo lista las notas con sus Graphs, y que el lienzo central sigue mostrando Ticker/Vivo/zócalo igual que en la Fase 1.
2. Crear un Graph nuevo desde el botón "+ Nuevo graph" de una nota — confirmar que aparece en el panel.
3. Seleccionar un Graph — confirmar que el panel derecho cambia al panel de composición con sus bajadas/citas/toggles.
4. Elegir una bajada y una cita, togglear "Ocultar tema", sin apretar "Al aire" — confirmar que `/pantalla` NO cambia todavía.
5. Apretar "Al aire" — confirmar que el zócalo aparece en `/pantalla` con la bajada y cita elegidas, sin el tema (esa capa no aparece en absoluto, no un espacio vacío).
6. Cambiar la bajada activa y volver a apretar "Al aire" — confirmar que la bajada se actualiza en `/pantalla` sin recargar.
7. Poner `bajada_activa_id` y `cita_activa_id` en "Ninguna" y "Al aire" — confirmar que esas capas desaparecen de `/pantalla` sin dejar hueco.
8. Editar un Graph desde el modal reubicado (cambiar lugar/tema/agregar una bajada) — confirmar que guarda igual que antes y el panel lateral se actualiza.
9. Confirmar que `/control_graphs/<id>` ya no existe (404) y que el botón de `listado_guiones.html` lleva a la nueva ruta.
10. En el editor de Plantillas (`/plantillas`), confirmar que el select de "Vincular a" de una capa de texto ahora incluye la opción "Cita".

## Fuera de alcance

- Reordenar/priorizar automáticamente qué bajada o cita "debería" estar activa (ej. la más reciente) — la elección es siempre manual del operador.
- Historial de composiciones usadas o "presets" guardados.
