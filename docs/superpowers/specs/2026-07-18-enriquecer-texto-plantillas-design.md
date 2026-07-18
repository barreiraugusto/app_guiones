# Enriquecer texto en capas de plantillas

## Problema

El editor de plantillas (`plantillas.js`) permite crear capas de tipo `texto`, pero el
panel de propiedades solo ofrece fuente (input de texto libre), tamaño, color y
alineación. Faltan negrita, cursiva y una forma más guiada de elegir la fuente.

## Alcance

Enriquecimiento por capa completa: los estilos (fuente, negrita, cursiva) se aplican
a todo el contenido de la capa de texto, no a fragmentos dentro de ella. No se
introduce edición de texto enriquecido (rich text / WYSIWYG) dentro de una capa.

## Modelo de datos

`app/models.py`, tabla `plantilla_capa`, agrego dos columnas junto a las existentes
`fuente`/`tamano_fuente`/`color`/`alineacion`:

```python
negrita = db.Column(db.Boolean, nullable=False, default=False)
cursiva = db.Column(db.Boolean, nullable=False, default=False)
```

`fuente` no cambia de tipo (sigue siendo `String(100)`, sin restricción a nivel de
base de datos ni backend): la restricción a una lista fija es puramente de UX en el
editor.

Migración Alembic nueva agregando ambas columnas a `plantilla_capa` (mismo patrón que
`migrations/versions/17f458c59481_agregar_es_mosca_a_plantilla_capa.py`).

## Backend

`app/routes/plantillas.py`:
- Serialización de capas (listar plantilla, `GET`): agregar `negrita` y `cursiva` al
  dict de salida, junto a `fuente`/`color`/`alineacion`.
- Creación/actualización de capas (`POST`/`PUT`): leer `negrita`/`cursiva` del body
  con default `False`, mismo patrón que `alineacion=capa_data.get('alineacion', 'left')`.

`app/routes/graphs.py`:
- Payload SSE que resuelve las capas activas: agregar `negrita`/`cursiva` junto a
  `fuente`/`tamano_fuente`/`color`/`alineacion` (dos puntos: serialización de capas y
  resolución de valores, siguiendo las líneas ya existentes ~35-40, ~293-298, ~554-557).

Sin validación de lista de fuentes en backend: se acepta cualquier string, igual que
hoy.

## Editor (`app/static/js/plantillas.js`)

Panel de propiedades de capa `texto`:
- El input de fuente se reemplaza por un `<select id="prop-fuente">` con estas 10
  opciones fijas: Arial, Helvetica, Georgia, Times New Roman, Courier New, Verdana,
  Tahoma, Trebuchet MS, Impact, Segoe UI — más una opción final `Personalizada...`
  (`value="__custom__"`).
- Cuando el select vale `__custom__`, se muestra un `<input type="text"
  id="prop-fuente-custom">` debajo con el nombre de fuente actual, editable. Al
  escribir ahí se actualiza `capa.fuente` con el valor libre.
- Al renderizar el panel para una capa existente: si `capa.fuente` no coincide con
  ninguna de las 10 opciones fijas, el select se inicializa en `__custom__` y el input
  de texto custom se muestra con el valor de `capa.fuente` (para no perder datos de
  capas ya guardadas con cualquier fuente libre).
- Se agregan dos `<input type="checkbox">` con sus labels: "Negrita" y "Cursiva",
  reflejando `capa.negrita`/`capa.cursiva`, con el mismo patrón de eventos
  `change` → `actualizarCapaSeleccionada({...})` que ya usan los demás campos.

Creación de nueva capa de texto: agregar `negrita: false, cursiva: false` a los
defaults (junto a `fuente: 'Arial'`, `tamano_fuente: 24`, etc.).

Preview del lienzo (`capa-texto-preview`, función que arma el `innerHTML` con
`font-family`/`font-size`/`color`): agregar `font-weight` (`bold`/`normal`) y
`font-style` (`italic`/`normal`) según `capa.negrita`/`capa.cursiva`.

## Salida real y control en vivo

`app/static/js/pantalla.js`, función `crearElementoCapa` (rama `tipo === 'texto'`,
donde hoy se setean `fontFamily`/`fontSize`/`color`/`justifyContent`): agregar

```js
el.style.fontWeight = capa.negrita ? 'bold' : 'normal';
el.style.fontStyle = capa.cursiva ? 'italic' : 'normal';
```

`app/static/js/control_live.js`: mismo agregado en los dos puntos donde ya se setea
`el.style.fontFamily = capa.fuente` (líneas ~148 y ~209 al momento de escribir esta
spec).

## Fuera de alcance

- Subida de archivos de fuente (.ttf/.otf/.woff) y generación de `@font-face`.
- Rich text / edición de fragmentos con distinto estilo dentro de la misma capa.
- Validación de nombres de fuente en backend.
