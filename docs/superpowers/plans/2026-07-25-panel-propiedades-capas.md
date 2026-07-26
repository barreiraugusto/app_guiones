# Reorganización del panel de propiedades de capas + tema oscuro Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganizar el panel de propiedades de capas del editor de
plantillas en pestañas (Posición / Contenido / Comportamiento) con las
acciones (traer al frente, llevar al fondo, eliminar capa) movidas a un
menú desplegable "⋮" en la esquina superior derecha, y aplicar un tema
oscuro fijo a toda la vista de edición (`#editor-plantilla`).

**Architecture:** `renderizarPanelPropiedades()` (única función que arma
el HTML del panel) pasa de generar una lista plana a generar 3 bloques
condicionales según dos variables de estado nuevas (`pestanaPropiedadesActiva`,
`subPestanaAnimacion`), mismo patrón que ya usa `camposEspecificos` para
variar por `capa.tipo`. Los IDs de los campos y sus listeners no cambian.
El tema oscuro es CSS puro, scopeado bajo `#editor-plantilla`, sin tocar
Bootstrap global ni la vista de listado de plantillas.

**Tech Stack:** Flask (Jinja para `plantillas.html`), JS vanilla,
Bootstrap 4.1.3 (dropdown nativo vía `data-toggle="dropdown"`, ya cargado
con jQuery + Popper en `base.html`).

## Global Constraints

- No se toca el modelo de datos de la capa ni ningún endpoint del backend.
- `pestanaPropiedadesActiva` se resetea a `'posicion'` en `seleccionarCapa()`
  solo cuando la selección realmente cambia (`id !== capaSeleccionadaId`),
  no en cada llamada (`iniciarArrastre`/`iniciarRedimension` llaman a
  `seleccionarCapa()` en cada mousedown, incluso re-seleccionando la capa ya
  activa); `subPestanaAnimacion` no se resetea entre capas.
- Los `id` de los campos (`prop-x`, `prop-anim-entrada`, etc.) y sus
  `addEventListener` existentes no cambian de nombre.
- Tema oscuro fijo (sin toggle claro/oscuro), aplicado solo dentro de
  `#editor-plantilla`; `#vista-listado` queda sin cambios.
- El checkerboard de transparencia (`#lienzo-wrapper`) no se re-estiliza:
  es contenido del gráfico, no chrome de la interfaz.
- No hay suite de tests automatizados en este proyecto (sin `package.json`
  ni framework JS). Verificación: `node --check` para sintaxis + navegador
  real para comportamiento.

---

## Task 1: Panel de propiedades — cabecera con menú "⋮" y pestañas

**Files:**
- Modify: `app/static/js/plantillas.js:5-8` (variables globales)
- Modify: `app/static/js/plantillas.js:265-269` (`seleccionarCapa`)
- Modify: `app/static/js/plantillas.js:398-642` (`renderizarPanelPropiedades`)

**Interfaces:**
- Produces: `pestanaPropiedadesActiva` (string: `'posicion'|'contenido'|'comportamiento'`),
  `subPestanaAnimacion` (string: `'entrada'|'salida'`),
  `cambiarPestanaPropiedades(nombre)`, `cambiarSubPestanaAnimacion(nombre)`.
  Nada de esto lo consume Task 2 (Task 2 es solo CSS).

- [ ] **Step 1: Agregar el estado de pestañas**

En `app/static/js/plantillas.js`, reemplazar (líneas 5-8):

```js
let plantillaEditandoId = null;
let capas = [];
let capaSeleccionadaId = null;
let contadorIdTemporal = -1;
```

por:

```js
let plantillaEditandoId = null;
let capas = [];
let capaSeleccionadaId = null;
let contadorIdTemporal = -1;
let pestanaPropiedadesActiva = 'posicion'; // 'posicion' | 'contenido' | 'comportamiento'
let subPestanaAnimacion = 'entrada'; // 'entrada' | 'salida'
```

- [ ] **Step 2: Resetear la pestaña activa al cambiar de capa seleccionada**

Reemplazar (líneas 265-269):

```js
function seleccionarCapa(id) {
    capaSeleccionadaId = id;
    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

por:

```js
function seleccionarCapa(id) {
    if (id !== capaSeleccionadaId) {
        pestanaPropiedadesActiva = 'posicion';
    }
    capaSeleccionadaId = id;
    renderizarLienzo();
    renderizarPanelPropiedades();
}
```

- [ ] **Step 3: Verificar sintaxis antes de tocar la función grande**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
node --check app/static/js/plantillas.js && echo "sintaxis OK"
```

Expected: `sintaxis OK` (los steps 1 y 2 no deberían romper nada).

- [ ] **Step 4: Agregar las funciones de cambio de pestaña**

Insertar, inmediatamente antes de `function renderizarPanelPropiedades() {`
(línea 398 actual):

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

- [ ] **Step 5: Reescribir el template del panel — cabecera, menú "⋮" y armado de pestañas**

Reemplazar todo el bloque de `camposEspecificos` para `'texto'` y `'forma'`
(líneas 407-490 del archivo original, es decir desde
`let camposEspecificos = '';` hasta el cierre de la rama `else if (capa.tipo === 'forma')`)
por la misma lógica más el `id="grupo-gradiente"` envolviendo los 3 campos
de gradiente y el subtítulo "Estilo" para texto:

```js
    let camposEspecificos = '';
    if (capa.tipo === 'texto') {
        const esFuentePersonalizada = !FUENTES_FIJAS.includes(capa.fuente);
        camposEspecificos = `
            <div class="form-group mb-2">
                <label>Vincular a:</label>
                <select class="form-control" id="prop-campo-dato">
                    <option value="">Texto libre</option>
                    <option value="lugar">Lugar</option>
                    <option value="tema">Tema</option>
                    <option value="entrevistado">Entrevistado</option>
                    <option value="cita">Cita</option>
                    <option value="bajada_1">Bajada 1</option>
                    <option value="bajada_2">Bajada 2</option>
                </select>
            </div>
            <div class="form-group mb-2">
                <label>Texto fijo:</label>
                <input type="text" class="form-control" id="prop-texto-fijo" value="${capa.texto_fijo || ''}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente:</label>
                <select class="form-control" id="prop-fuente">
                    ${FUENTES_FIJAS.map(f => `<option value="${f}" ${!esFuentePersonalizada && capa.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                    <option value="__custom__" ${esFuentePersonalizada ? 'selected' : ''}>Personalizada...</option>
                </select>
                <input type="text" class="form-control mt-1" id="prop-fuente-custom" value="${capa.fuente}" style="${esFuentePersonalizada ? '' : 'display:none;'}">
            </div>
            <div class="form-group mb-2">
                <label>Tamaño:</label>
                <input type="number" class="form-control" id="prop-tamano" value="${capa.tamano_fuente}">
            </div>
            <div class="small text-muted mb-1">Estilo</div>
            <div class="form-group mb-2">
                <label>Color:</label>
                <input type="color" class="form-control" id="prop-color" value="${capa.color}">
            </div>
            <div class="form-group mb-2">
                <label>Alineación:</label>
                <select class="form-control" id="prop-alineacion">
                    <option value="left">Izquierda</option>
                    <option value="center">Centro</option>
                    <option value="right">Derecha</option>
                </select>
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-negrita" ${capa.negrita ? 'checked' : ''}>
                <label class="form-check-label" for="prop-negrita">Negrita</label>
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-cursiva" ${capa.cursiva ? 'checked' : ''}>
                <label class="form-check-label" for="prop-cursiva">Cursiva</label>
            </div>
        `;
    } else if (capa.tipo === 'forma') {
        camposEspecificos = `
            <div class="form-group mb-2">
                <label>Radio de esquina:</label>
                <input type="number" class="form-control" id="prop-radio-esquina" value="${capa.radio_esquina}">
            </div>
            <div class="form-group mb-2">
                <label>Color de fondo:</label>
                <input type="color" class="form-control" id="prop-color-fondo" value="${capa.color_fondo || '#ffffff'}">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-usar-gradiente" ${capa.usar_gradiente ? 'checked' : ''}>
                <label class="form-check-label">Usar gradiente</label>
            </div>
            <div id="grupo-gradiente" style="${capa.usar_gradiente ? '' : 'display:none;'}">
                <div class="row">
                    <div class="col-6 form-group mb-2"><label>Color inicio</label><input type="color" class="form-control" id="prop-gradiente-inicio" value="${capa.gradiente_color_inicio || '#ffffff'}"></div>
                    <div class="col-6 form-group mb-2"><label>Color fin</label><input type="color" class="form-control" id="prop-gradiente-fin" value="${capa.gradiente_color_fin || '#000000'}"></div>
                </div>
                <div class="form-group mb-2">
                    <label>Ángulo del gradiente (grados):</label>
                    <input type="number" class="form-control" id="prop-gradiente-angulo" value="${capa.gradiente_angulo}">
                </div>
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Color de borde</label><input type="color" class="form-control" id="prop-color-borde" value="${capa.color_borde || '#000000'}"></div>
                <div class="col-6 form-group mb-2"><label>Ancho de borde</label><input type="number" class="form-control" id="prop-ancho-borde" value="${capa.ancho_borde}"></div>
            </div>
            <div class="form-group mb-2">
                <label>Opacidad (%):</label>
                <input type="number" class="form-control" id="prop-opacidad" min="0" max="100" value="${capa.opacidad}">
            </div>
        `;
    } else {
```

El resto de esa rama (`camposEspecificos` para imagen/video, líneas
492-503 originales) no cambia.

- [ ] **Step 6: Reemplazar el template final del panel (cabecera + tabs + tab-panes)**

Reemplazar todo el bloque desde `panel.innerHTML = \`` (línea 506 original)
hasta el `\`;` que lo cierra (línea 577 original) por:

```js
    panel.innerHTML = `
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

        <div style="${pestanaPropiedadesActiva === 'posicion' ? '' : 'display:none;'}">
            <div class="row">
                <div class="col-3 form-group mb-2"><label>X</label><input type="number" class="form-control" id="prop-x" value="${capa.x}"></div>
                <div class="col-3 form-group mb-2"><label>Y</label><input type="number" class="form-control" id="prop-y" value="${capa.y}"></div>
                <div class="col-3 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-ancho" value="${capa.ancho}"></div>
                <div class="col-3 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-alto" value="${capa.alto}"></div>
            </div>
        </div>

        <div style="${pestanaPropiedadesActiva === 'contenido' ? '' : 'display:none;'}">
            ${camposEspecificos}
        </div>

        <div style="${pestanaPropiedadesActiva === 'comportamiento' ? '' : 'display:none;'}">
            <div class="small text-muted mb-1">Visibilidad</div>
            <div class="form-group mb-2">
                <label>Ocultar junto con (capa de texto):</label>
                <select class="form-control" id="prop-controlada-por">
                    <option value="">Ninguna</option>
                    ${capas.filter(c => c.tipo === 'texto' && c.id !== capa.id).map(c => `
                        <option value="${c.id}">${detalleCapa(c)}</option>
                    `).join('')}
                </select>
                <small class="text-muted">Si esa capa de texto queda vacía, esta capa también desaparece.</small>
            </div>
            <div class="form-check mb-3">
                <input type="checkbox" class="form-check-input" id="prop-es-mosca" ${capa.es_mosca ? 'checked' : ''}>
                <label class="form-check-label" for="prop-es-mosca">Mosca</label>
                <small class="text-muted d-block">Se controla aparte desde control_live (Mostrar/Ocultar), independiente del graph al aire.</small>
            </div>

            <div class="small text-muted mt-2 mb-1">Animación</div>
            <div class="btn-group btn-group-sm btn-block mb-2" role="group">
                <button type="button" class="btn ${subPestanaAnimacion === 'entrada' ? 'btn-secondary' : 'btn-outline-secondary'}"
                        onclick="cambiarSubPestanaAnimacion('entrada')">Entrada</button>
                <button type="button" class="btn ${subPestanaAnimacion === 'salida' ? 'btn-secondary' : 'btn-outline-secondary'}"
                        onclick="cambiarSubPestanaAnimacion('salida')">Salida</button>
            </div>
            <div style="${subPestanaAnimacion === 'entrada' ? '' : 'display:none;'}">
                <div class="form-group mb-2">
                    <label>Animación entrada:</label>
                    <select class="form-control" id="prop-anim-entrada">
                        <option value="none">Ninguna</option>
                        <option value="fade">Fundido</option>
                        <option value="slide">Deslizar</option>
                    </select>
                </div>
                <div class="row">
                    <div class="col-6 form-group mb-2">
                        <label>Dirección entrada</label>
                        <select class="form-control" id="prop-direccion-entrada">
                            <option value="izquierda">Desde la izquierda</option>
                            <option value="derecha">Desde la derecha</option>
                        </select>
                    </div>
                    <div class="col-6 form-group mb-2">
                        <label>Duración entrada (ms)</label>
                        <input type="number" class="form-control" id="prop-duracion-entrada" value="${capa.duracion_entrada_ms}">
                    </div>
                </div>
            </div>
            <div style="${subPestanaAnimacion === 'salida' ? '' : 'display:none;'}">
                <div class="form-group mb-2">
                    <label>Animación salida:</label>
                    <select class="form-control" id="prop-anim-salida">
                        <option value="none">Ninguna</option>
                        <option value="fade">Fundido</option>
                        <option value="slide">Deslizar</option>
                    </select>
                </div>
                <div class="row">
                    <div class="col-6 form-group mb-2">
                        <label>Dirección salida</label>
                        <select class="form-control" id="prop-direccion-salida">
                            <option value="izquierda">Hacia la izquierda</option>
                            <option value="derecha">Hacia la derecha</option>
                        </select>
                    </div>
                    <div class="col-6 form-group mb-2">
                        <label>Duración salida (ms)</label>
                        <input type="number" class="form-control" id="prop-duracion-salida" value="${capa.duracion_salida_ms}">
                    </div>
                </div>
            </div>
        </div>
    `;
```

Los bloques que siguen después (los `addEventListener`, líneas 579-641
originales) no se tocan: siguen colgando de los mismos `id` y funcionan
igual porque esos elementos existen en el DOM (solo su contenedor padre
tiene `display:none` cuando la pestaña no está activa).

- [ ] **Step 7: Agregar el listener de progressive disclosure del gradiente**

Reemplazar (dentro del bloque `else if (capa.tipo === 'forma')` de los
listeners, línea 629 original):

```js
        document.getElementById('prop-usar-gradiente').addEventListener('change', (e) => actualizarCapaSeleccionada({ usar_gradiente: e.target.checked }));
```

por:

```js
        document.getElementById('prop-usar-gradiente').addEventListener('change', (e) => {
            actualizarCapaSeleccionada({ usar_gradiente: e.target.checked });
            document.getElementById('grupo-gradiente').style.display = e.target.checked ? '' : 'none';
        });
```

- [ ] **Step 8: Verificar sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
node --check app/static/js/plantillas.js && echo "sintaxis OK"
```

Expected: `sintaxis OK`.

- [ ] **Step 9: Verificación manual en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5085
```

Abrir `http://localhost:5085/plantillas`, crear o editar una plantilla, y
para cada tipo de capa (Texto, Forma, Imagen, Video) confirmar:

1. Al seleccionar la capa aparece la cabecera "Capa: <tipo>" con el botón
   "⋮" a la derecha; al hacer click se despliega el menú con "Traer al
   frente", "Llevar al fondo" y "Eliminar capa" (roja); cada acción
   funciona igual que antes.
2. Las 3 pestañas (Posición, Contenido, Comportamiento) cambian el
   contenido visible sin recargar la página; "Posición" siempre muestra
   X/Y/Ancho/Alto y los cambios se reflejan en el lienzo en vivo.
3. Para una capa de **Forma**: destildar "Usar gradiente" oculta Color
   inicio/Color fin/Ángulo sin cerrar la pestaña; volver a tildarlo los
   muestra de nuevo con los valores previos conservados.
4. En "Comportamiento", el selector Entrada/Salida cambia qué bloque de
   campos de animación se ve, y los valores configurados en cada uno
   persisten al alternar entre ambos.
5. Arrastrar o redimensionar la capa en el lienzo (que dispara un
   re-render completo del panel) mantiene la pestaña que estaba activa,
   en vez de volver a "Posición".
6. Guardar la plantilla (`guardarPlantilla()`) y volver a abrirla:
   confirmar que todos los valores (incluida la config de gradiente y
   animación) se guardaron correctamente — esto confirma que no se rompió
   ningún `id` de campo.

Parar el servidor al terminar (`pkill -f "flask run --port 5085"`).

- [ ] **Step 10: Commit**

```bash
git add app/static/js/plantillas.js
git commit -m "feat: pestanas y menu de acciones en el panel de propiedades de capas"
```

---

## Task 2: Tema oscuro de la vista de edición (`#editor-plantilla`)

**Files:**
- Modify: `app/templates/plantillas.html:5-102` (bloque `<style>`)

**Interfaces:**
- No produce ni consume nada de Task 1: es CSS puro, scopeado por el
  selector `#editor-plantilla` que ya existe en el HTML (`plantillas.html:157`).

- [ ] **Step 1: Agregar las reglas de tema oscuro**

En `app/templates/plantillas.html`, reemplazar el cierre del bloque
`<style>` (línea 101-102 original):

```css
    .resize-handle {
        position: absolute;
        width: 14px;
        height: 14px;
        background: #0d6efd;
        right: -7px;
        bottom: -7px;
        cursor: se-resize;
    }
</style>
```

por:

```css
    .resize-handle {
        position: absolute;
        width: 14px;
        height: 14px;
        background: #0d6efd;
        right: -7px;
        bottom: -7px;
        cursor: se-resize;
    }

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
</style>
```

- [ ] **Step 2: Verificación manual en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5085
```

Abrir `http://localhost:5085/plantillas`, entrar al editor de una
plantilla (`#editor-plantilla` visible) y confirmar:

1. El listado de plantillas (`#vista-listado`, antes de entrar al editor)
   sigue en claro, sin cambios.
2. Dentro del editor: panel de capas, lienzo (chrome alrededor, no el
   checkerboard de transparencia en sí) y panel de propiedades se ven en
   fondo oscuro, con texto e inputs legibles (sin texto oscuro sobre
   fondo oscuro en ningún campo, incluidos los `<select>` y `<input type="color">`).
3. La capa activa en la lista de capas (`.list-group-item.active`) se
   distingue claramente del resto.
4. Las pestañas de Task 1 (si ya está aplicado) y el menú "⋮" se ven
   legibles sobre el fondo oscuro; si Task 1 todavía no se aplicó, el
   panel de propiedades plano de antes también debe verse legible en
   oscuro (mismas reglas de `.form-control`/`.card` aplican).
5. Los botones existentes (`+ Imagen`, `+ Video`, `+ Texto`, `+ Forma`,
   "Guardar plantilla", "Volver") siguen siendo legibles.

Parar el servidor al terminar (`pkill -f "flask run --port 5085"`).

- [ ] **Step 3: Commit**

```bash
git add app/templates/plantillas.html
git commit -m "style: tema oscuro para la vista de edicion de plantillas"
```
