# Rotación automática de bajadas

## Problema

Hoy, en el panel de composición de `control_live` (al seleccionar un graph),
la "Bajada activa" se elige manualmente con un radio button, una por una.
Se necesita poder reproducir las bajadas de un graph en secuencia
automática, con controles de Play/Stop y una opción de Loop (para que
vuelva a la primera al llegar a la última), y poder configurar cuánto
tiempo se muestra cada bajada antes de pasar a la siguiente.

## Alcance

- Rotación automática **dentro de un mismo graph** (entre sus bajadas). No
  incluye rotar entre distintos graphs/notas — eso queda fuera de alcance.
- El intervalo configurable ("duración") es el tiempo que se muestra cada
  bajada antes de pasar a la siguiente.
- La rotación debe sobrevivir a que se cierre o recargue la pestaña de
  `control_live` — el cálculo de qué bajada corresponde mostrar en cada
  momento se hace en el backend a partir del tiempo transcurrido, no
  depende de un timer en el navegador del operador.

## Datos (nuevas columnas en `Graph`, con migración)

```python
bajadas_auto_activo = db.Column(db.Boolean, default=False, nullable=False)
bajadas_auto_loop = db.Column(db.Boolean, default=False, nullable=False)
bajadas_auto_duracion_segundos = db.Column(db.Integer, default=5, nullable=False)
bajadas_auto_epoch_inicio = db.Column(db.Float, nullable=True)
bajadas_auto_indice_inicio = db.Column(db.Integer, default=0, nullable=False)
```

- `bajadas_auto_activo`: si está reproduciendo (Play) o detenido (Stop).
- `bajadas_auto_loop`: si al llegar a la última bajada vuelve a la primera
  (`true`) o se queda fija en la última (`false`).
- `bajadas_auto_duracion_segundos`: segundos que se muestra cada bajada.
  Default 5, editable solo mientras está detenido (evita que cambiar el
  número mientras corre desincronice el cálculo por tiempo transcurrido).
- `bajadas_auto_epoch_inicio`: timestamp Unix (segundos, float) de cuándo
  arrancó el ciclo actual de conteo. Se recalcula cada vez que se hace
  Play.
- `bajadas_auto_indice_inicio`: índice (dentro de las bajadas del graph
  ordenadas por `id` ascendente) desde el que arrancó a contar
  `bajadas_auto_epoch_inicio`.

Las bajadas de un graph no tienen campo de orden propio — se ordenan por
`id` ascendente, mismo criterio que ya usa `obtener_graph`
(`sorted(graph.bajadas, key=lambda b: b.id)`).

## Cálculo de la bajada efectiva (backend)

Función nueva en `app/routes/graphs.py`, usada por `_resolver_capas_plantilla`
en vez de `graph_activo.bajada_activa` directo:

```python
def _bajada_activa_efectiva(graph):
    bajadas_ordenadas = sorted(graph.bajadas, key=lambda b: b.id)
    if graph.bajadas_auto_activo and bajadas_ordenadas and graph.bajadas_auto_epoch_inicio:
        duracion = graph.bajadas_auto_duracion_segundos or 5
        transcurrido = time.time() - graph.bajadas_auto_epoch_inicio
        paso = int(transcurrido // duracion)
        indice = graph.bajadas_auto_indice_inicio + paso
        if graph.bajadas_auto_loop:
            indice = indice % len(bajadas_ordenadas)
        else:
            indice = min(indice, len(bajadas_ordenadas) - 1)
        return bajadas_ordenadas[indice]
    return graph.bajada_activa
```

Si `bajadas_auto_activo` es `false`, el comportamiento es exactamente el
actual (usa `bajada_activa_id` fijo, sin cambios).

## Endpoint nuevo

`PUT /graphs/<id>/bajadas-auto` — independiente del endpoint existente
`/graphs/activo/<id>` (que solo se usa para poner un graph al aire). Permite
controlar Play/Stop/Loop/duración de un graph sin necesidad de volver a
mandarlo al aire.

Body JSON, todos los campos opcionales (se aplican los que vengan):

```json
{ "accion": "play" }
```
```json
{ "accion": "stop" }
```
```json
{ "loop": true }
```
```json
{ "duracion_segundos": 8 }
```

Comportamiento de `"accion": "play"`:
- `bajadas_auto_indice_inicio` = índice actual de `bajada_activa_id` en las
  bajadas ordenadas (0 si no hay ninguna bajada activa, o el propio graph
  no tiene bajadas → no hace nada, responde error si `len(bajadas) == 0`).
- `bajadas_auto_epoch_inicio` = `time.time()` (ahora).
- `bajadas_auto_activo` = `true`.

Comportamiento de `"accion": "stop"`:
- Calcula la bajada efectiva en este instante (misma función de arriba) y
  la persiste en `bajada_activa_id` (así el graph queda "congelado" en lo
  que se estaba mostrando, igual que si se hubiera elegido a mano).
- `bajadas_auto_activo` = `false`.
- `bajadas_auto_epoch_inicio` = `None`.

`loop` y `duracion_segundos` se pueden mandar en el mismo request que
`accion`, o solos: `duracion_segundos` solo tiene efecto si
`bajadas_auto_activo` es `false` en ese momento (se ignora silenciosamente
si se manda mientras está reproduciendo, ya que el campo de la UI está
deshabilitado en ese estado — ver más abajo).

`GET /graphs/<id>` (ya existente) debe incluir los 5 campos nuevos en su
respuesta, para que el editor pueda restaurar el estado de los controles al
seleccionar el graph.

## Editor (`control_live.js` / `control_live.html`)

En `renderizarPanelComposicion()`, entre el bloque "Bajada activa" y el
bloque "Cita activa":

- 3 botones **solo ícono** (sin texto, `<i class="fas ...">` únicamente):
  - Play (`fa-play`): llama al endpoint con `{accion: "play"}`.
  - Stop (`fa-stop`): llama al endpoint con `{accion: "stop"}`.
  - Loop (`fa-sync-alt` o similar): toggle — al hacer click manda
    `{loop: !estado_actual}`. Se pinta como "activo" (`btn-primary` en vez
    de `btn-outline-secondary`) cuando `bajadas_auto_loop` es `true`.
- Un input numérico chico para la duración en segundos, al lado de los 3
  íconos. Deshabilitado (`disabled`) mientras `bajadas_auto_activo` es
  `true` (mismo criterio que ya usa el Cronómetro con sus campos de
  duración).
- Cada acción vuelve a pedir el graph (`GET /graphs/<id>`) para refrescar
  `composicion` con el estado real devuelto por el backend, y vuelve a
  renderizar el panel (para reflejar el nuevo estado de los botones/input).

**Click manual en una bajada** (radio button existente): si
`bajadas_auto_activo` es `true`, primero llama a `{accion: "stop"}` (para
no dejar la rotación corriendo en el fondo con un valor manual pisado) y
recién después aplica la selección manual normal.

**Actualización del preview en el editor**: el `setInterval` de 1 segundo
que ya existe (usado para refrescar el Cronómetro) se extiende para,
cuando `composicion` tiene `bajadas_auto_activo === true`, volver a llamar
a `renderizarLienzo()` cada segundo (recalculando localmente con la misma
fórmula de índice, usando `Date.now()/1000` como equivalente de
`time.time()`) — así el operador ve la rotación en su propio preview sin
tener que refrescar la página. Este cálculo local es solo para el preview;
la fuente de verdad para lo que sale al aire sigue siendo el backend.

## Fuera de alcance

- Rotar entre distintos graphs/notas (solo bajadas dentro de un mismo
  graph).
- Cambiar `duracion_segundos` mientras está reproduciendo sin detener
  primero.
- Pausar y reanudar desde el mismo punto (Stop siempre congela en el punto
  actual; un Play posterior arranca un ciclo nuevo desde ese punto, lo cual
  en la práctica logra el mismo efecto de "reanudar", pero conceptualmente
  es un ciclo nuevo, no una pausa).
