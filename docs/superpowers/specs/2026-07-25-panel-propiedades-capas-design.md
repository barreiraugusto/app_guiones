# Reorganización del panel de propiedades de capas + tema oscuro del editor

## Problema

En la vista de edición de plantillas (`app/templates/plantillas.html:189-193`,
`app/static/js/plantillas.js:398-642`), el panel de propiedades de la capa
seleccionada es una lista plana de hasta 14 campos apilados (posición,
contenido según tipo, visibilidad, animación de entrada/salida) más los
botones de orden Z y "Eliminar capa" mezclados entre los campos. Para capas
de texto o forma hay que scrollear bastante para llegar a lo que se busca.

Se aprobó un mockup (comparación interactiva "actual vs propuesta") con:
pestañas para agrupar por función, un menú desplegable "⋮" en la esquina
superior derecha del panel para las acciones (traer al frente, llevar al
fondo, eliminar capa), y tema oscuro para toda la vista de edición.

## Alcance

- Reorganizar únicamente `panel-propiedades` (`plantillas.js:398-642`): su
  HTML generado y los listeners que ya cuelga de sus IDs. Los campos y el
  modelo de datos de la capa (`capa.x`, `capa.color`, etc.) no cambian.
- Tema oscuro fijo (sin toggle claro/oscuro) para todo `#editor-plantilla`
  (`plantillas.html:157-195`): panel de capas, lienzo (chrome, no el
  contenido gráfico), toolbar de nombre/guardar/volver y panel de
  propiedades. La vista de listado de plantillas (`#vista-listado`,
  fuera del editor) queda como está.
- Fuera de alcance: cambiar el modelo de datos, agregar campos nuevos,
  tema oscuro para el resto de la app (navbar ya es oscura, listado de
  plantillas sigue en claro).

## Estado nuevo en `plantillas.js`

Junto a las variables globales existentes (línea 5-8):

```js
let pestanaPropiedadesActiva = 'posicion'; // 'posicion' | 'contenido' | 'comportamiento'
let subPestanaAnimacion = 'entrada'; // 'entrada' | 'salida'
```

`pestanaPropiedadesActiva` se resetea a `'posicion'` dentro de
`seleccionarCapa()` (línea 265-269), pero solo cuando la selección
realmente cambia (`id !== capaSeleccionadaId`), antes de renderizar, así
cada capa nueva que se selecciona arranca mostrando Posición. Esto importa
porque `iniciarArrastre`/`iniciarRedimension` llaman a `seleccionarCapa()`
en cada `mousedown`, incluso al re-seleccionar la capa ya seleccionada
(para iniciar un arrastre o redimensión); en ese caso la pestaña no debe
resetearse. `subPestanaAnimacion` no se resetea (es una preferencia de
sesión, no de la capa).

Dos funciones nuevas, mismo patrón que las demás acciones del archivo
(mutan estado y vuelven a renderizar el panel):

```js
function cambiarPestanaPropiedades(nombre) {
    pestanaPropiedadesActiva = nombre;
    renderizarPanelPropiedades();
}

function cambiarSubPestanaAnimacion(nombre) {
    subPestanaAnimacion = nombre;
    renderizarPanelPropiedades();
}
```

## Cabecera del panel: tipo de capa + menú "⋮"

Reemplaza el `<h6>Capa: ${capa.tipo}</h6>` (línea 507) y saca de la lista de
campos la fila de orden Z (línea 514-517) y el botón final "Eliminar capa"
(línea 576):

```html
<div class="d-flex justify-content-between align-items-center mb-2">
    <h6 class="mb-0">Capa: ${ETIQUETA_TIPO_CAPA[capa.tipo] || capa.tipo}</h6>
    <div class="dropdown">
        <button class="btn btn-sm btn-link text-muted p-1" type="button"
                id="menu-acciones-capa" data-toggle="dropdown" aria-expanded="false">
            <i class="fas fa-ellipsis-v"></i>
        </button>
        <div class="dropdown-menu dropdown-menu-right" aria-labelledby="menu-acciones-capa">
            <button class="dropdown-item" type="button" onclick="moverCapaSeleccionada('frente')">
                <i class="fas fa-arrow-up mr-2"></i>Traer al frente
            </button>
            <button class="dropdown-item" type="button" onclick="moverCapaSeleccionada('fondo')">
                <i class="fas fa-arrow-down mr-2"></i>Llevar al fondo
            </button>
            <div class="dropdown-divider"></div>
            <button class="dropdown-item text-danger" type="button" onclick="eliminarCapaSeleccionada()">
                <i class="fas fa-trash mr-2"></i>Eliminar capa
            </button>
        </div>
    </div>
</div>
```

El dropdown usa el plugin nativo de Bootstrap (`data-toggle="dropdown"`),
ya cargado en `base.html` (jQuery + Popper + `bootstrap.bundle.js`) — no
hace falta JS propio para abrir/cerrar.

## Pestañas: Posición / Contenido / Comportamiento

Debajo de la cabecera, antes de los campos:

```html
<ul class="nav nav-tabs nav-fill mb-3" style="font-size: 0.85rem;">
    <li class="nav-item">
        <button type="button" class="nav-link ${pestanaPropiedadesActiva === 'posicion' ? 'active' : ''}"
                onclick="cambiarPestanaPropiedades('posicion')">Posición</button>
    </li>
    <li class="nav-item">
        <button type="button" class="nav-link ${pestanaPropiedadesActiva === 'contenido' ? 'active' : ''}"
                onclick="cambiarPestanaPropiedades('contenido')">Contenido</button>
    </li>
    <li class="nav-item">
        <button type="button" class="nav-link ${pestanaPropiedadesActiva === 'comportamiento' ? 'active' : ''}"
                onclick="cambiarPestanaPropiedades('comportamiento')">Comportamiento</button>
    </li>
</ul>
```

Cada pestaña se arma como un bloque de HTML condicional en la template
string (mismo mecanismo que ya usa `camposEspecificos`), envuelto en
`<div style="display:${pestanaPropiedadesActiva === 'X' ? '' : 'none'}">`.
No se usa el plugin de tabs de Bootstrap: como el panel entero se
regenera con `innerHTML` en cada acción, es más simple que la pestaña
activa sea un `if` en JS (mismo patrón que ya se usa para
`camposEspecificos` según `capa.tipo`) que depender del plugin. Los tres
bloques (Posición/Contenido/Comportamiento) se renderizan siempre los
tres, cada uno envuelto en su propio `display:none` cuando no está
activo; no se omite ningún bloque del DOM. Esto es necesario porque los
~30 `addEventListener` existentes en el archivo apuntan a ids dentro de
cada bloque de forma incondicional, y fallarían si algún bloque no
existiera en el DOM.

### Pestaña "Posición"

Contenido único, igual para todos los tipos de capa (el `grid4` del
mockup, con Bootstrap se arma con `row` + 4 `col-3`):

```html
<div class="row">
    <div class="col-3 form-group mb-2"><label>X</label><input type="number" class="form-control" id="prop-x" value="${capa.x}"></div>
    <div class="col-3 form-group mb-2"><label>Y</label><input type="number" class="form-control" id="prop-y" value="${capa.y}"></div>
    <div class="col-3 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-ancho" value="${capa.ancho}"></div>
    <div class="col-3 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-alto" value="${capa.alto}"></div>
</div>
```

Los 4 listeners (línea 579-582) no cambian.

### Pestaña "Contenido"

Es `camposEspecificos` (línea 407-504), tal cual existe hoy por tipo de
capa, sin cambios de campos. Dos ajustes menores de agrupamiento visual
(subtítulos, sin campos nuevos):

- **Texto**: un `<div class="small text-muted mb-1">Estilo</div>` antes de
  Color/Alineación/Negrita/Cursiva, para separarlos visualmente de
  Vincular a/Texto fijo/Fuente/Tamaño. Alineación, Negrita y Cursiva pueden
  quedar como están (select + 2 checkboxes) — no es necesario convertirlos
  a botones tipo ícono para resolver el problema de reorganización; si más
  adelante se quiere ese pulido visual, es un cambio aislado a esta franja.
- **Forma**: ocultar los 3 campos de gradiente
  (`prop-gradiente-inicio`, `prop-gradiente-fin`, `prop-gradiente-angulo`)
  cuando `usar_gradiente` está destildado, envolviéndolos en
  `<div id="grupo-gradiente" style="${capa.usar_gradiente ? '' : 'display:none;'}">`.
  El listener de `prop-usar-gradiente` (línea 629) le agrega una línea:
  `document.getElementById('grupo-gradiente').style.display = e.target.checked ? '' : 'none';`
  (sin re-render completo, igual que ya hace `prop-fuente` con
  `prop-fuente-custom` en la línea 610-619).
- **Imagen/Video**: sin cambios.

### Pestaña "Comportamiento"

Reemplaza el tramo final (línea 519-575), agrupado en dos secciones:

```html
<div class="small text-muted mb-1">Visibilidad</div>
<!-- prop-controlada-por, prop-es-mosca: igual que hoy -->

<div class="small text-muted mt-3 mb-1">Animación</div>
<div class="btn-group btn-group-sm btn-block mb-2" role="group">
    <button type="button" class="btn ${subPestanaAnimacion === 'entrada' ? 'btn-secondary' : 'btn-outline-secondary'}"
            onclick="cambiarSubPestanaAnimacion('entrada')">Entrada</button>
    <button type="button" class="btn ${subPestanaAnimacion === 'salida' ? 'btn-secondary' : 'btn-outline-secondary'}"
            onclick="cambiarSubPestanaAnimacion('salida')">Salida</button>
</div>
<!-- si subPestanaAnimacion === 'entrada': prop-anim-entrada, prop-direccion-entrada, prop-duracion-entrada -->
<!-- si subPestanaAnimacion === 'salida': prop-anim-salida, prop-direccion-salida, prop-duracion-salida -->
```

Los campos de "Entrada" y "Salida" son exactamente los que ya existen
(línea 535-575); ambos bloques se renderizan siempre, solo se alterna
cuál queda visible según `subPestanaAnimacion` (el otro queda con
`display:none`), en vez de los dos apilados y siempre visibles. Los `id`
(`prop-anim-entrada`, etc.) y sus listeners (línea 584-594) no cambian —
siguen existiendo en el DOM aunque su bloque esté oculto, porque ambos
bloques se renderizan siempre (igual que `camposEspecificos` ya hace por
tipo). Como los 6 IDs de animación no se solapan entre sí, no hace falta
ningún cambio en los `addEventListener`.

## Tema oscuro de `#editor-plantilla`

Se agrega al bloque `<style>` de `plantillas.html` (líneas 5-102), sin
tocar clases globales de Bootstrap ni el resto de la página. Reglas
scopeadas bajo `#editor-plantilla`, pisando lo mínimo de Bootstrap con
selectores directos (no hace falta un sistema de variables porque es un
único tema fijo):

```css
#editor-plantilla { background: #14171c; color: #e7eaee; padding: 12px; border-radius: 8px; }
#editor-plantilla .card { background: #1c2027; border-color: #2d333d; color: #e7eaee; }
#editor-plantilla .list-group-item { background: #1c2027; border-color: #2d333d; color: #e7eaee; }
#editor-plantilla .list-group-item.active { background: #24406b; border-color: #0d6efd; color: #fff; }
#editor-plantilla .list-group-item-action:hover { background: #262b33; }
#editor-plantilla .form-control,
#editor-plantilla .dropdown-menu { background: #14171c; border-color: #3c4450; color: #e7eaee; }
#editor-plantilla .form-control:focus { background: #14171c; color: #e7eaee; border-color: #0d6efd; box-shadow: 0 0 0 0.2rem rgba(13,110,253,.25); }
#editor-plantilla .dropdown-item { color: #e7eaee; }
#editor-plantilla .dropdown-item:hover { background: #262b33; color: #fff; }
#editor-plantilla .nav-tabs { border-color: #2d333d; }
#editor-plantilla .nav-tabs .nav-link { color: #9aa4b0; border-color: transparent; }
#editor-plantilla .nav-tabs .nav-link.active { color: #529cff; background: #1c2c47; border-color: #2d333d #2d333d #1c2c47; }
#editor-plantilla small.text-muted, #editor-plantilla .text-muted { color: #9aa4b0 !important; }
#editor-plantilla input[type="color"] { background: #14171c; border-color: #3c4450; }
```

El checkerboard de transparencia (`#lienzo-wrapper`, línea 49-57) no
cambia: representa la transparencia real del gráfico que se está
diseñando, no es "chrome" de la interfaz.

Los botones ya existentes (`btn-outline-secondary`, `btn-outline-danger`,
`btn-primary`, `btn-link`) se dejan con los estilos default de Bootstrap:
sobre el fondo oscuro nuevo siguen siendo legibles (mismo motivo por el
que la navbar ya usa `btn-outline-light`/`btn-light`/`btn-success` sobre
`bg-dark` sin problema).

## Fuera de alcance

- Toggle claro/oscuro conmutable por el usuario (tema fijo, como pidió).
- Tema oscuro para `#vista-listado` (listado y preview de plantillas).
- Convertir Alineación/Negrita/Cursiva a botones tipo ícono (queda igual
  que hoy; ver nota en "Pestaña Contenido").
- Cambios al modelo de datos de la capa o a los endpoints del backend.
