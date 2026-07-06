# Sistema de Plantillas de Gráfica Animada

**Fecha:** 2026-07-05
**Estado:** Aprobado para implementación

## Contexto

La app ya tiene un sistema de "graphs" (zócalos) ligados a notas (`Texto`) con datos como `lugar`, `tema`, entrevistados y bajadas (`app/routes/graphs.py`, `app/models.py`). Estos se muestran en `pantalla.html` vía Server-Sent Events (`/stream_display_config`), pensado para usarse como Browser Source en OBS. Hoy el diseño visual es un único zócalo fijo, cableado en HTML/CSS con imágenes estáticas (`app/static/img/grafica/*.png|gif`).

El objetivo de este spec es reemplazar ese diseño fijo por un **sistema de plantillas** reutilizables: el usuario podrá importar gráficas animadas (video WebM con alpha) o imágenes estáticas, ubicar dónde va cada dato del graph (lugar, tema, entrevistado, bajadas) sobre esa gráfica, y que esa configuración persista para generarse con datos reales.

Este spec cubre **solo la autoría de plantillas y el motor de renderizado**. La mejora del panel de control en vivo (selección rápida, cola, preview) queda para un spec posterior.

## Decisiones de alcance (confirmadas con el usuario)

- Formato de animación soportado: **video WebM con canal alpha** (VP9), reproducido nativamente con `<video>` — Chromium/OBS lo soporta sin trucos de canvas. También se admite imagen estática (PNG/GIF) para capas que no necesitan animación.
- Generación propia en la interfaz: **editor simple de capas** (posición, texto con fuente/color/tamaño, transición CSS de entrada/salida). No incluye editor de keyframes/motion graphics.
- El zócalo actual se migra como la plantilla por defecto, no se descarta.
- Asociación plantilla↔graph: **plantilla global reutilizable**, cada `Graph` referencia una `Plantilla` (elegible desde el formulario existente), y la plantilla define dónde se ubica cada campo de dato.

## Modelo de datos

### `Plantilla`
| Campo | Tipo | Notas |
|---|---|---|
| id | Integer PK | |
| nombre | String(255) | único, ej. "Zócalo clásico", "Placa entrevista" |
| ancho | Integer | default 1920 |
| alto | Integer | default 1080 |

### `PlantillaCapa`
| Campo | Tipo | Notas |
|---|---|---|
| id | Integer PK | |
| plantilla_id | FK → Plantilla, `ondelete=CASCADE` | |
| orden | Integer | define el z-index (stacking), menor = atrás |
| tipo | String | `'imagen'` \| `'video'` \| `'texto'` |
| x, y | Integer | posición en px sobre el lienzo de `ancho`×`alto` de la plantilla |
| ancho, alto | Integer | tamaño de la capa en px |
| archivo | String, nullable | ruta relativa bajo `static/uploads/plantillas/`, solo para tipo imagen/video |
| loop | Boolean, default True | solo aplica a tipo video |
| campo_dato | String, nullable | solo tipo texto: `'lugar'` \| `'tema'` \| `'entrevistado'` \| `'bajada_1'` \| `'bajada_2'` \| `null` (texto libre) |
| texto_fijo | String, nullable | usado cuando `campo_dato` es null (texto libre) |
| fuente | String, default `'Arial'` | solo tipo texto |
| tamano_fuente | Integer, default 24 | solo tipo texto |
| color | String, default `'#ffffff'` | solo tipo texto, hex |
| alineacion | String, default `'left'` | `'left'` \| `'center'` \| `'right'` |
| animacion_entrada | String, default `'fade'` | `'none'` \| `'fade'` \| `'slide'` |
| animacion_salida | String, default `'fade'` | `'none'` \| `'fade'` \| `'slide'` |
| duracion_transicion_ms | Integer, default 400 | |

### Cambio en `Graph`
- Nueva columna `plantilla_id` (FK → `Plantilla`, nullable, `ondelete=SET NULL`). Al crear un `Graph` sin especificar plantilla, se asigna la plantilla marcada como default (ver migración de datos).

## Subida de archivos

- Endpoint `POST /plantillas/upload` (multipart/form-data, campo `archivo`).
- Extensiones permitidas: `.webm` (video), `.png`, `.gif` (imagen). Cualquier otra extensión → 400.
- Límite de tamaño: `MAX_CONTENT_LENGTH = 50 * 1024 * 1024` (50MB) agregado a `config.Config`. Flask devuelve 413 automáticamente si se excede.
- Guardado: `werkzeug.utils.secure_filename` + prefijo `uuid4()` para evitar colisiones, en `app/static/uploads/plantillas/`. La carpeta se crea con `os.makedirs(..., exist_ok=True)` igual que el patrón ya usado para la carpeta `Graphs` en `graphs.py`.
- Respuesta: `{"ruta": "uploads/plantillas/<uuid>_<nombre>.webm"}` para que el editor la asigne a la capa.

## Endpoints nuevos (`app/routes/plantillas.py`, blueprint `plantillas_bp`)

- `GET /plantillas` — página del editor/listado (`render_template('plantillas.html')`).
- `GET /api/plantillas` — lista `{id, nombre}` de todas las plantillas.
- `POST /api/plantillas` — crea plantilla con sus capas (payload completo: nombre, ancho, alto, capas[]).
- `GET /api/plantillas/<id>` — devuelve plantilla completa con capas ordenadas.
- `PUT /api/plantillas/<id>` — reemplaza nombre + capas (mismo patrón que `actualizar_graph`: borra capas existentes y recrea).
- `DELETE /api/plantillas/<id>` — elimina plantilla (falla con 409 si algún `Graph` la referencia, para no dejar graphs huérfanos de diseño).
- `POST /plantillas/upload` — subida de archivo descrita arriba.

Todas las mutaciones (crear/editar/eliminar plantilla) registran auditoría vía `registrar(...)` siguiendo el patrón existente en `graphs.py`.

## Editor de plantillas (`plantillas.html` + `static/js/plantillas.js`)

- Listado de plantillas existentes (tarjetas con nombre + botón "Editar" / "Nueva").
- Al editar/crear: lienzo central que representa el frame de `ancho`×`alto` escalado a un tamaño manejable en pantalla (ej. 40%, o el que quepa en el viewport manteniendo la relación de aspecto). Fondo del lienzo: gris/checkerboard para visualizar transparencia.
- Cada capa se dibuja como un `div` posicionado en absoluto (position/size en la escala del lienzo, convertido a las coordenadas reales de la plantilla al guardar). Capas de tipo video muestran un `<video muted loop autoplay>` con el archivo subido; capas de texto muestran el `texto_fijo` o un placeholder (`{{campo_dato}}`) para previsualizar ubicación.
- Arrastre: mousedown/mousemove/mouseup simple (sin librería nueva) para mover una capa seleccionada; resize con handles en las esquinas.
- Panel lateral de propiedades de la capa seleccionada:
  - Comunes: x, y, ancho, alto (inputs numéricos, sincronizados con el drag), orden, animación entrada/salida, duración transición.
  - Tipo imagen/video: botón "Subir archivo" (llama a `/plantillas/upload`), checkbox loop (video).
  - Tipo texto: select "vincular a campo" (lugar/tema/entrevistado/bajada_1/bajada_2/texto libre), si es texto libre un input de texto, más fuente/tamaño/color/alineación.
- Botón "Agregar capa" (elige tipo) y "Eliminar capa".
- Botón "Guardar plantilla" → `POST`/`PUT` según corresponda.

## Motor de renderizado (`pantalla.html` + `pantalla.js`)

- `pantalla.html` deja de tener el HTML/CSS fijo del zócalo. Queda un contenedor vacío `<div id="overlay-root">` a pantalla completa (1920×1080 con `object-fit`/escalado responsivo, igual que hoy).
- `stream_display_config` (en `graphs.py`) se extiende: además de `layout`/`badges`/`live`, agrega `plantilla` con las capas de la plantilla del graph activo, y cada capa de tipo texto ya trae el valor resuelto (`valor` = contenido real de `lugar`/`tema`/`entrevistado`/`bajada_1`/`bajada_2`/`texto_fijo` según corresponda). Si no hay graph activo, no se envía `plantilla` (el overlay queda vacío).
- `pantalla.js` reescribe `updateDisplay`: al recibir una plantilla nueva o distinta a la actual, reconstruye el DOM de `#overlay-root` creando un elemento por capa (ordenados por `orden`), aplicando posición/tamaño absolutos y, para texto, fuente/color/tamaño/alineación. Al pasar de "sin graph activo" a "con graph activo" (o viceversa), aplica la clase CSS de `animacion_entrada`/`animacion_salida` correspondiente (clases `.anim-fade-in`, `.anim-slide-in`, etc. definidas una vez en el `<style>` de `pantalla.html`) con la duración de `duracion_transicion_ms`.
- El badge "VIVO" (`live`) y su configuración de posición (`display_config.json`) no cambian — siguen siendo independientes de las plantillas.

## Migración de datos: "Zócalo clásico"

Una migración de Alembic (`migrations/versions/`) además del cambio de esquema:
1. Crea las tablas `plantilla` y `plantilla_capa`, agrega columna `plantilla_id` a `graph`.
2. Inserta una fila en `Plantilla` (`nombre='Zócalo clásico'`, `ancho=1920`, `alto=1080`).
3. Inserta sus capas equivalentes al diseño actual de `pantalla.html`:
   - Capa imagen: `mosca.gif` (logo), posición/tamaño según `.logo` actual (150×150, dentro del grupo en x=50,y=850 aprox., ver `display_config.json`).
   - Capa imagen: `zocalo_sin_bordes.png` (fondo barra info), 1737×152.
   - Capa texto: `campo_dato='tema'` (equivalente a `.blue-text`/linea1).
   - Capa texto: `campo_dato='bajada_1'` (equivalente a `.main-text`/linea2).
   - Capa imagen: `subida_localidad.png` con capa texto superpuesta `campo_dato='lugar'`.
   - Capa imagen: `subida_nombre.png` con capa texto superpuesta `campo_dato='entrevistado'`.
4. Actualiza todos los `Graph` existentes con `plantilla_id` = id de "Zócalo clásico".

Los archivos PNG/GIF existentes se referencian desde `app/static/img/grafica/` (no hace falta copiarlos a `uploads/plantillas/`, el campo `archivo` admite cualquier ruta bajo `static/`).

## Testing

- Pruebas manuales guiadas (no hay suite de tests automatizados en el proyecto): crear una plantilla nueva con una capa de video WebM con alpha subida, una capa de texto vinculada a `lugar`, guardar, asignarla a un graph existente, activar ese graph, y verificar en `pantalla.html` (abierto directamente en navegador y como Browser Source de OBS) que se renderiza con la posición y datos correctos, y que la migración no rompe el zócalo clásico para graphs preexistentes.
- Validar límite de tamaño de archivo (subir >50MB → 413) y extensión inválida (subir `.mp4` → 400).

## Fuera de alcance

- Selector de plantilla en vivo desde el panel de control sin editar el graph (fase siguiente).
- Cola/orden de múltiples graphs disparándose en secuencia (fase siguiente).
- Editor de keyframes / motion graphics.
- Soporte de secuencias de imágenes PNG o GIF animado como fondo (solo WebM con alpha o imagen estática por ahora).
