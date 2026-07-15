# Duplicar Plantillas y Capas de Forma Geométrica

**Fecha:** 2026-07-15
**Estado:** Aprobado para implementación

## Contexto

El editor de Plantillas (`/plantillas`, `app/routes/plantillas.py`, `app/static/js/plantillas.js`) permite armar zócalos con capas de imagen, video y texto, pero hoy: (a) no hay forma de partir de una plantilla existente para crear una variante — hay que rehacer todas las capas desde cero, y (b) no existe un tipo de capa para fondos/paneles/formas decorativas con color, borde y gradiente — solo se puede usar una imagen preexistente para eso. Este spec cubre ambas carencias.

## Decisiones de alcance (confirmadas con el usuario)

- **Duplicar:** botón en cada card del listado de `/plantillas`, crea una copia completa (con todas sus capas) con nombre `"{nombre} (copia)"`, y navega directo a editarla.
- **Formas:** un solo tipo nuevo `'forma'` (no tipos separados para rectángulo/círculo) — un `radio_esquina` configurable cubre desde rectángulo recto hasta óvalo/círculo.
- **Gradiente:** lineal, 2 colores, ángulo configurable en grados (0-360). Sin soporte de gradiente radial ni de más de 2 colores.
- **Color sólido vs. gradiente:** conviven vía un toggle `usar_gradiente` — si está desactivado, se usa `color_fondo` (sólido); si está activado, se usa el gradiente (`gradiente_color_inicio`/`gradiente_color_fin`/`gradiente_angulo`), ignorando `color_fondo`.
- **Opacidad:** aplica a la capa completa (fondo + borde + contenido), vía CSS `opacity` estándar — no hay opacidad separada por componente.
- **Animación de entrada/salida y duración:** las formas reusan los mismos campos ya existentes en `PlantillaCapa` (`animacion_entrada`, `animacion_salida`, `duracion_transicion_ms`) — no se agregan campos nuevos para esto.
- **Renderizado:** se duplica un bloque de estilo por cada uno de los 4 lugares donde ya se crean elementos de capa (`pantalla.js`, `control_live.js` ×2, `plantillas.js`) — mismo patrón de duplicación puntual ya usado en el proyecto para otros tipos de capa, sin crear un módulo compartido nuevo.

## Modelo de datos

### `PlantillaCapa` — columnas nuevas

| Campo | Tipo | Notas |
|---|---|---|
| `radio_esquina` | Integer, default 0, nullable=False | 0 = recto; valores altos (≥ mitad del lado menor) dan óvalo/círculo |
| `color_fondo` | String(20), nullable | color sólido; se ignora si `usar_gradiente=True` |
| `opacidad` | Integer, default 100, nullable=False | 0-100 |
| `color_borde` | String(20), nullable | |
| `ancho_borde` | Integer, default 0, nullable=False | 0 = sin borde |
| `usar_gradiente` | Boolean, default False, nullable=False | |
| `gradiente_color_inicio` | String(20), nullable | |
| `gradiente_color_fin` | String(20), nullable | |
| `gradiente_angulo` | Integer, default 90, nullable=False | grados, 0-360 |

`tipo` (`String(10)`, ya existente) admite el nuevo valor `'forma'`, junto a `'imagen'`, `'video'`, `'texto'`.

Migración Alembic nueva: agrega las 9 columnas, todas con default o nullable — sin backfill necesario (capas existentes quedan con los defaults, que no tienen efecto visual para tipos que no sean 'forma').

## Backend

### `app/routes/plantillas.py`

- `TIPOS_CAPA_VALIDOS` agrega `'forma'`.
- `_serializar_plantilla`: agrega las 9 columnas nuevas a la serialización de cada capa.
- `_crear_capas`: agrega las 9 columnas nuevas al `PlantillaCapa(...)` construido, con los mismos defaults del modelo si no vienen en el payload.
- Nuevo endpoint `POST /api/plantillas/<int:id>/duplicar`:
  - Busca la plantilla original (404 si no existe).
  - Crea una nueva `Plantilla` con `nombre = f"{original.nombre} (copia)"` (si ya existe una plantilla con ese nombre exacto — la restricción `UniqueConstraint('nombre')` lo exige — se agrega un sufijo numérico incremental hasta encontrar uno libre, ej. `"{nombre} (copia) 2"`), mismo `ancho`/`alto`.
  - Copia todas las capas de la original (mismos valores de todos los campos, incluidos los 9 nuevos), preservando el `orden`.
  - Devuelve `{"mensaje": "Plantilla duplicada", "id": <id de la copia>}`, 201.
  - Registra auditoría (`registrar('INFO', ...)`), mismo patrón que `crear_plantilla`.

### `app/routes/graphs.py` (`_resolver_capas_plantilla`)

Las capas de tipo `'forma'` no tienen valor de texto — se resuelven igual que las de imagen/video (se agregan al array de capas sin pasar por el filtro de "ocultar si vacío", que solo aplica a `tipo == 'texto'`). Se agregan los 9 campos nuevos al dict de cada capa devuelta (para todos los tipos, no solo forma — mismo patrón que ya existe para `x`/`y`/`ancho`/`alto`/etc., que se incluyen siempre sin importar el tipo).

## Frontend — renderizado (4 lugares)

En cada uno de estos 4 puntos, se agrega un `else if (capa.tipo === 'forma')` (o el branch equivalente) que crea un `<div>` con las clases base ya usadas (`capa`/`elemento-control`, sin `capa-media`/`capa-texto`) y aplica:

```js
el.style.borderRadius = `${capa.radio_esquina}px`;
el.style.opacity = capa.opacidad / 100;
if (capa.ancho_borde > 0) {
    el.style.border = `${capa.ancho_borde}px solid ${capa.color_borde || '#000000'}`;
}
if (capa.usar_gradiente) {
    el.style.background = `linear-gradient(${capa.gradiente_angulo}deg, ${capa.gradiente_color_inicio}, ${capa.gradiente_color_fin})`;
} else {
    el.style.background = capa.color_fondo || 'transparent';
}
```

- **`app/static/js/pantalla.js`** (`crearElementoCapa`): rama nueva, mismo patrón que las ramas de `'video'`/imagen (sin `else`, ya que el `else` final queda para imagen).
- **`app/static/js/control_live.js`** (`crearElementoZocalo`, zócalo real de solo lectura): misma rama.
- **`app/static/js/control_live.js`** (`crearElementoPreviewCapa`, preview interactivo): misma rama — las formas también son arrastrables/redimensionables como cualquier otra capa (ya heredan `elemento-editable` + resize-handle del código existente, sin cambios ahí).
- **`app/static/js/plantillas.js`** (`crearElementoEditable`, el editor mismo): misma rama, para que el editor muestre un preview fiel de la forma mientras se diseña.

## Frontend — editor de Plantillas (`app/static/js/plantillas.js`)

### Alta de capa

Nuevo botón `+ Forma` junto a los existentes (`+ Imagen`, `+ Video`, `+ Texto`) en `plantillas.html`, que llama a `agregarCapa('forma')`. `agregarCapa` (ya existente) se extiende para que, cuando `tipo === 'forma'`, la capa nueva arranque con: `radio_esquina=0`, `color_fondo='#ffffff'`, `opacidad=100`, `color_borde='#000000'`, `ancho_borde=0`, `usar_gradiente=false`, `gradiente_color_inicio='#ffffff'`, `gradiente_color_fin='#000000'`, `gradiente_angulo=90` (mismo patrón de defaults ya usado para los demás tipos en esa función).

### Panel de propiedades

`renderizarPanelPropiedades` (ya existente) gana un bloque de campos específicos para `capa.tipo === 'forma'` (mismo patrón condicional que ya separa texto de imagen/video):

- Radio de esquina (number).
- Color de fondo (color) — visible siempre, pero se deshabilita visualmente (no funcionalmente crítico) cuando el gradiente está activo.
- Checkbox "Usar gradiente".
- Color inicio, color fin, ángulo (number, 0-360) — solo relevantes si el checkbox está tildado, pero se muestran siempre para simplicidad (sin ocultar/mostrar condicional dentro del panel).
- Color de borde (color), ancho de borde (number).
- Opacidad (number, 0-100).
- Animación entrada/salida/duración — reusa el bloque ya existente y compartido con los demás tipos (no se duplica).

Todos los campos siguen el mismo patrón ya usado (`actualizarCapaSeleccionada({...})` en cada `addEventListener`).

## Frontend — listado de Plantillas (`app/templates/plantillas.html` + `app/static/js/plantillas.js`)

- Cada card del listado (`cargarListadoPlantillas`) gana un botón "Duplicar" (ícono `fa-copy`), con `stopPropagation` para que el click no dispare también `abrirPlantilla` (el click en el resto de la card ya abre la plantilla para editar).
- Al hacer click en "Duplicar": `POST /api/plantillas/<id>/duplicar`, y si la respuesta es exitosa, `abrirPlantilla(<id de la copia>)` directamente (sin pasar por el listado intermedio).

## Verificación manual

1. En `/plantillas`, click en "Duplicar" sobre una plantilla existente con varias capas (incluida alguna de texto/imagen): confirmar que se abre el editor de una plantilla nueva, con nombre `"{original} (copia)"` y las mismas capas en las mismas posiciones.
2. Duplicar la misma plantilla una segunda vez: confirmar que el nombre no colisiona (ej. `"{original} (copia) 2"`).
3. En el editor, click en "+ Forma": confirmar que aparece un rectángulo blanco en el lienzo, seleccionable y arrastrable como cualquier otra capa.
4. Configurar radio de esquina alto, borde de color y ancho visibles, opacidad al 50%: confirmar que el preview del editor refleja los 3 cambios.
5. Activar "Usar gradiente" con 2 colores distintos y un ángulo de 45°: confirmar que el fondo pasa a mostrar el gradiente diagonal en vez del color sólido.
6. Guardar la plantilla, asignarla a un Graph real, activarlo: confirmar que la forma se ve igual en `/pantalla` (al aire) que en el editor.
7. Seleccionar ese Graph en `/control_live`: confirmar que la forma aparece en el preview interactivo, y que se puede arrastrar/redimensionar igual que las demás capas, guardando la posición en la Plantilla compartida (mismo mecanismo ya existente).

## Fuera de alcance

- Gradiente radial o de más de 2 colores.
- Tipos de forma separados (círculo, triángulo, polígono libre).
- Opacidad independiente para fondo vs. borde.
- Sombra (box-shadow) u otros efectos visuales adicionales no pedidos.
