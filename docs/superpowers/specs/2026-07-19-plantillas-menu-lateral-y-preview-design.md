# Plantillas: menú lateral con preview

## Problema

La página `/plantillas` muestra las plantillas como una grilla de cards
(`#lista-plantillas`, `row` de `col-md-3`), cada una con solo un botón
"Duplicar". Al hacer click en cualquier parte de la card se abre
directamente el editor de pantalla completa. No hay forma de ver el
contenido de una plantilla sin entrar a editarla, ni de eliminarla desde la
lista (solo desde dentro del editor).

## Alcance

Cambios acotados a `app/templates/plantillas.html` y
`app/static/js/plantillas.js`. Sin cambios de backend: los endpoints que
hacen falta ya existen (`GET /api/plantillas`, `GET /api/plantillas/<id>`,
`DELETE /api/plantillas/<id>`, `POST /api/plantillas/<id>/duplicar`).

### Layout (estado "listado", cuando el editor no está abierto)

Reemplaza la grilla de cards por dos columnas dentro de un nuevo contenedor
`#vista-listado` (hermano de `#editor-plantilla`, mismo patrón de
mostrar/ocultar que ya usa `mostrarEditor()`/`cerrarEditor()`):

- **Columna izquierda** (angosta, `col-md-3`): `#lista-plantillas` pasa de
  `row` de cards a un `list-group` vertical. "+ Nueva plantilla" es el
  primer ítem de la lista (mismo comportamiento actual: abre el editor
  vacío directo, sin preview posible porque todavía no existe nada que
  previsualizar). Cada plantilla existente es un ítem con:
  - el nombre (click selecciona y muestra preview a la derecha),
  - tres botones chicos: **Editar**, **Duplicar**, **Borrar** (en ese
    orden, con `event.stopPropagation()` como ya hace "Duplicar" hoy para
    no disparar la selección del ítem).

- **Columna derecha** (ancha, `col-md-9`): `#preview-plantilla`, panel de
  solo lectura. Sin selección: mensaje `"Seleccioná una plantilla para ver
  su preview."` (mismo tono que el placeholder ya usado en
  `#panel-propiedades` de `control_live.html`). Con selección: lienzo
  escalado (mismo tamaño/escala que el editor, `1920×1080` a `0.5`) con las
  capas de la plantilla renderizadas, sin bordes punteados ni asas de
  redimensión ni drag (ver mecanismo).

### Comportamiento

- **Click en el nombre de un ítem** → `seleccionarPlantillaPreview(id)`:
  hace `fetch('/api/plantillas/<id>')` (mismo endpoint que ya usa
  `abrirPlantilla`), guarda las capas devueltas y renderiza el preview de
  solo lectura a la derecha. Marca el ítem como activo en la lista (clase
  `active` de Bootstrap `list-group-item`, mismo patrón visual que ya usa
  el proyecto en otros listados). No abre el editor.
- **Botón Editar** → mismo comportamiento que hoy tiene el click en la card
  completa: `abrirPlantilla(id)` → abre `#editor-plantilla` a pantalla
  completa (oculta `#vista-listado`).
- **Botón Duplicar** → sin cambios de comportamiento:
  `duplicarPlantilla(id)` duplica y abre el editor sobre la copia nueva.
- **Botón Borrar** → mismo diálogo de confirmación que ya usa
  `eliminarPlantillaActual()` dentro del editor (`Swal.fire` con
  `showCancelButton`), luego `DELETE /api/plantillas/<id>`, recarga la
  lista (`cargarListadoPlantillas()`). Si la plantilla borrada era la que
  estaba en preview, limpia el panel derecho al estado sin selección.
- **"Volver" del editor** → sigue mostrando `#vista-listado` (lista +
  preview) en vez de la grilla vieja; el preview queda vacío/sin selección
  al volver (no intenta recordar la última selección).

### Mecanismo del preview de solo lectura

Nueva función `crearElementoPreview(capa)` en `plantillas.js`, calcada de
la `crearElementoEditable(capa)` existente (mismo cálculo de estilos por
tipo de capa: imagen/video/texto/forma, mismos campos `x/y/ancho/alto/orden`,
mismo texto de fallback `{{campo_dato}}` para texto dinámico sin
`texto_fijo`) pero **sin** los listeners de `mousedown`/`click` para
arrastre/selección y **sin** el `resize-handle`. Se reutiliza para no
duplicar la lógica de estilos por tipo de capa; la diferencia es
únicamente la interactividad.

## Fuera de alcance

- Cambios de backend (todos los endpoints necesarios ya existen).
- Resolución de campos dinámicos (`{{lugar}}`, `{{entrevistado}}`, etc.) con
  datos reales de un graph — el preview muestra el placeholder literal,
  igual que ya hace hoy el editor (`crearElementoEditable` para texto).
- Recordar la última plantilla previsualizada al volver del editor o al
  recargar la página.
