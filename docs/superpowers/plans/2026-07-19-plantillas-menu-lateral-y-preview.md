# Plantillas: menú lateral con preview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la grilla de cards de `/plantillas` por un menú lateral
tipo lista (con botones Editar/Duplicar/Borrar) y un panel de preview de
solo lectura a la derecha que se actualiza al hacer click en una plantilla.

**Architecture:** Un nuevo contenedor `#vista-listado` (dos columnas:
lista + preview) reemplaza a la vieja `#lista-plantillas` como hermano de
`#editor-plantilla`, con el mismo patrón mostrar/ocultar que ya usan
`mostrarEditor()`/`cerrarEditor()`. El preview reutiliza el mismo cálculo de
estilos por tipo de capa que ya usa el editor (`crearElementoEditable`),
copiado a una función nueva sin interactividad.

**Tech Stack:** JS vanilla, Bootstrap 4 (`list-group`), SweetAlert2 (`Swal`,
ya usado en el archivo).

## Global Constraints

- Sin cambios de backend — los endpoints ya existen: `GET /api/plantillas`,
  `GET /api/plantillas/<id>`, `DELETE /api/plantillas/<id>`,
  `POST /api/plantillas/<id>/duplicar`.
- El preview es de solo lectura: sin listeners de `mousedown`/`click` para
  arrastre/selección, sin `resize-handle`.
- El texto dinámico sin `texto_fijo` se muestra como `{{campo_dato}}`
  literal (no se resuelve con datos de un graph) — igual que ya hace hoy
  `crearElementoEditable` para texto en el editor.
- No hay suite de tests automatizados en este proyecto. Verificación:
  `node --check` (con el workaround ya establecido:
  `sed 's/^export //; s/??/||/g; s/?\.\([a-zA-Z_]\)/\.\1/g'`) y verificación
  manual en navegador real.

---

## Task 1: Menú lateral, preview de solo lectura y botones Editar/Borrar

**Files:**
- Modify: `app/templates/plantillas.html` (CSS + estructura HTML)
- Modify: `app/static/js/plantillas.js` (listado, preview, borrar, toggle editor)

**Interfaces:**
- Consumes: `GET /api/plantillas` (lista `{id, nombre}`),
  `GET /api/plantillas/<id>` (detalle con `capas`, mismo shape que ya
  consume `abrirPlantilla`), `DELETE /api/plantillas/<id>`.
- Produces: nada consumido por otro archivo — cambio autocontenido en la
  página de plantillas.

- [ ] **Step 1: CSS — quitar el estilo de card, agregar preview y capa-preview**

En `app/templates/plantillas.html`, reemplazar:

```html
<style>
    body { padding-top: 70px; }
    #lista-plantillas .plantilla-card { cursor: pointer; }
    #editor-plantilla { display: none; }

    #lienzo-wrapper {
        background: repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 20px 20px;
        position: relative;
        overflow: hidden;
        border: 1px solid #999;
        width: 100%;
        max-width: 960px;
        aspect-ratio: 16 / 9;
    }
```

por:

```html
<style>
    body { padding-top: 70px; }
    #editor-plantilla { display: none; }

    #preview-lienzo-wrapper {
        background: repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 20px 20px;
        position: relative;
        overflow: hidden;
        border: 1px solid #999;
        width: 100%;
        max-width: 960px;
        aspect-ratio: 16 / 9;
    }

    #preview-lienzo {
        position: relative;
        width: 1920px;
        height: 1080px;
        transform: scale(0.5);
        transform-origin: top left;
    }

    .capa-preview {
        position: absolute;
        box-sizing: border-box;
        overflow: hidden;
    }

    .capa-preview img, .capa-preview video {
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
    }

    .capa-preview .capa-texto-preview {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        pointer-events: none;
        white-space: nowrap;
    }

    #lienzo-wrapper {
        background: repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 20px 20px;
        position: relative;
        overflow: hidden;
        border: 1px solid #999;
        width: 100%;
        max-width: 960px;
        aspect-ratio: 16 / 9;
    }
```

- [ ] **Step 2: HTML — reemplazar la grilla de cards por lista + preview**

Reemplazar:

```html
    <div id="lista-plantillas" class="row mb-4">
        <div class="col-md-3 mb-3">
            <div class="card plantilla-card h-100 border-primary" onclick="nuevaPlantilla()">
                <div class="card-body text-center d-flex align-items-center justify-content-center">
                    <div>
                        <i class="fas fa-plus fa-2x"></i>
                        <p class="mt-2 mb-0">Nueva plantilla</p>
                    </div>
                </div>
            </div>
        </div>
    </div>
```

por:

```html
    <div id="vista-listado" class="row mb-4">
        <div class="col-md-3">
            <div class="list-group" id="lista-plantillas">
                <button type="button" class="list-group-item list-group-item-action list-group-item-primary" onclick="nuevaPlantilla()">
                    <i class="fas fa-plus"></i> Nueva plantilla
                </button>
            </div>
        </div>
        <div class="col-md-9">
            <div id="preview-plantilla" class="card p-3">
                <p class="text-muted" id="preview-plantilla-vacio">Seleccioná una plantilla para ver su preview.</p>
                <div id="preview-lienzo-wrapper" style="display:none;">
                    <div id="preview-lienzo"></div>
                </div>
            </div>
        </div>
    </div>
```

- [ ] **Step 3: JS — listado como list-group con Editar/Duplicar/Borrar**

En `app/static/js/plantillas.js`, reemplazar:

```javascript
async function cargarListadoPlantillas() {
    const response = await fetch('/api/plantillas');
    const plantillas = await response.json();
    const contenedor = document.getElementById('lista-plantillas');
    contenedor.querySelectorAll('.plantilla-existente').forEach(el => el.remove());

    plantillas.forEach(p => {
        const col = document.createElement('div');
        col.className = 'col-md-3 mb-3 plantilla-existente';
        col.innerHTML = `
            <div class="card plantilla-card h-100" onclick="abrirPlantilla(${p.id})">
                <div class="card-body">
                    <h5 class="card-title">${p.nombre}</h5>
                    <button type="button" class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); duplicarPlantilla(${p.id})">
                        <i class="fas fa-copy"></i> Duplicar
                    </button>
                </div>
            </div>
        `;
        contenedor.appendChild(col);
    });
}
```

por:

```javascript
async function cargarListadoPlantillas() {
    const response = await fetch('/api/plantillas');
    const plantillas = await response.json();
    const contenedor = document.getElementById('lista-plantillas');
    contenedor.querySelectorAll('.plantilla-existente').forEach(el => el.remove());

    plantillas.forEach(p => {
        const item = document.createElement('div');
        item.className = 'list-group-item list-group-item-action plantilla-existente d-flex justify-content-between align-items-center';
        item.style.cursor = 'pointer';
        item.dataset.plantillaId = p.id;
        item.innerHTML = `
            <span>${p.nombre}</span>
            <span>
                <button type="button" class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); abrirPlantilla(${p.id})">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary" onclick="event.stopPropagation(); duplicarPlantilla(${p.id})">
                    <i class="fas fa-copy"></i> Duplicar
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="event.stopPropagation(); borrarPlantillaDesdeLista(${p.id})">
                    <i class="fas fa-trash"></i> Borrar
                </button>
            </span>
        `;
        item.addEventListener('click', () => seleccionarPlantillaPreview(p.id));
        contenedor.appendChild(item);
    });
}

let plantillaPreviewId = null;

async function seleccionarPlantillaPreview(id) {
    const response = await fetch(`/api/plantillas/${id}`);
    if (!response.ok) {
        Swal.fire({ icon: 'error', title: 'No se pudo cargar la plantilla' });
        return;
    }
    const data = await response.json();
    plantillaPreviewId = id;

    document.querySelectorAll('#lista-plantillas .plantilla-existente').forEach(el => {
        el.classList.toggle('active', Number(el.dataset.plantillaId) === id);
    });

    document.getElementById('preview-plantilla-vacio').style.display = 'none';
    document.getElementById('preview-lienzo-wrapper').style.display = 'block';
    const lienzo = document.getElementById('preview-lienzo');
    lienzo.innerHTML = '';
    data.capas
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .forEach(capa => lienzo.appendChild(crearElementoPreview(capa)));
}

function limpiarPreviewPlantilla() {
    plantillaPreviewId = null;
    document.getElementById('preview-plantilla-vacio').style.display = 'block';
    document.getElementById('preview-lienzo-wrapper').style.display = 'none';
    document.getElementById('preview-lienzo').innerHTML = '';
}

function crearElementoPreview(capa) {
    const div = document.createElement('div');
    div.className = 'capa-preview';
    div.style.left = `${capa.x}px`;
    div.style.top = `${capa.y}px`;
    div.style.width = `${capa.ancho}px`;
    div.style.height = `${capa.alto}px`;
    div.style.zIndex = capa.orden;

    if (capa.tipo === 'imagen' && capa.archivo) {
        div.innerHTML = `<img src="/static/${capa.archivo}">`;
    } else if (capa.tipo === 'video' && capa.archivo) {
        div.innerHTML = `<video src="/static/${capa.archivo}" muted autoplay loop></video>`;
    } else if (capa.tipo === 'texto') {
        const justify = capa.alineacion === 'center' ? 'center' : (capa.alineacion === 'right' ? 'flex-end' : 'flex-start');
        const texto = capa.texto_fijo || (capa.campo_dato ? `{{${capa.campo_dato}}}` : 'Texto libre');
        const peso = capa.negrita ? 'bold' : 'normal';
        const estilo = capa.cursiva ? 'italic' : 'normal';
        div.innerHTML = `<div class="capa-texto-preview" style="font-family:${capa.fuente};font-size:${capa.tamano_fuente}px;color:${capa.color};justify-content:${justify};font-weight:${peso};font-style:${estilo};">${texto}</div>`;
    } else if (capa.tipo === 'forma') {
        div.style.borderRadius = `${capa.radio_esquina}px`;
        div.style.opacity = capa.opacidad / 100;
        if (capa.ancho_borde > 0) {
            div.style.borderWidth = `${capa.ancho_borde}px`;
            div.style.borderStyle = 'solid';
            div.style.borderColor = capa.color_borde || '#000000';
        }
        if (capa.usar_gradiente) {
            div.style.background = `linear-gradient(${capa.gradiente_angulo}deg, ${capa.gradiente_color_inicio}, ${capa.gradiente_color_fin})`;
        } else {
            div.style.background = capa.color_fondo || 'transparent';
        }
    } else {
        div.style.background = 'rgba(255,0,0,0.15)';
    }

    return div;
}

async function borrarPlantillaDesdeLista(id) {
    const result = await Swal.fire({
        title: '¿Eliminar esta plantilla?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
        const response = await fetch(`/api/plantillas/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al eliminar la plantilla');
        }
        if (plantillaPreviewId === id) limpiarPreviewPlantilla();
        Swal.fire({ icon: 'success', title: 'Plantilla eliminada', showConfirmButton: false, timer: 1000 });
        cargarListadoPlantillas();
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}
```

- [ ] **Step 4: JS — mostrar/ocultar `#vista-listado` en vez de `#lista-plantillas`**

Reemplazar:

```javascript
function mostrarEditor() {
    document.getElementById('lista-plantillas').style.display = 'none';
    document.getElementById('editor-plantilla').style.display = 'block';
    renderizarLienzo();
    renderizarPanelPropiedades();
}

function cerrarEditor() {
    document.getElementById('editor-plantilla').style.display = 'none';
    document.getElementById('lista-plantillas').style.display = 'flex';
    cargarListadoPlantillas();
}
```

por:

```javascript
function mostrarEditor() {
    document.getElementById('vista-listado').style.display = 'none';
    document.getElementById('editor-plantilla').style.display = 'block';
    renderizarLienzo();
    renderizarPanelPropiedades();
}

function cerrarEditor() {
    document.getElementById('editor-plantilla').style.display = 'none';
    document.getElementById('vista-listado').style.display = 'flex';
    limpiarPreviewPlantilla();
    cargarListadoPlantillas();
}
```

- [ ] **Step 5: Verificación de sintaxis**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
sed 's/^export //; s/??/||/g; s/?\.\([a-zA-Z_]\)/\.\1/g' app/static/js/plantillas.js > /tmp/pl_checkable.js
node --check /tmp/pl_checkable.js && echo "sintaxis OK"
```

- [ ] **Step 6: Verificación manual en navegador**

```bash
cd /home/augusto/Documentos/CODIGOS/APP_GUIONES/app_guiones
FLASK_APP=run.py PYTHONPATH=. .venv/bin/python -m flask run --port 5082
```

Abrir `http://localhost:5082/plantillas` y confirmar:
- La lista aparece como menú lateral angosto a la izquierda, con "+ Nueva
  plantilla" arriba de todo.
- Cada plantilla existente muestra su nombre y los 3 botones (Editar,
  Duplicar, Borrar).
- Click en el nombre de una plantilla (no en los botones) → aparece el
  preview a la derecha con sus capas renderizadas, sin bordes punteados ni
  asas de redimensión, y el ítem queda resaltado como activo en la lista.
- Click en "Editar" → abre el editor de pantalla completa (comportamiento
  igual al que hoy tiene el click en la card).
- Click en "Duplicar" → duplica y abre el editor sobre la copia (sin
  disparar la selección de preview del original).
- Click en "Borrar" → pide confirmación, elimina, refresca la lista; si la
  plantilla borrada estaba en preview, el panel derecho vuelve al mensaje
  vacío.
- "Volver" desde el editor regresa a la vista lista+preview (preview vacío).
- "+ Nueva plantilla" sigue abriendo el editor vacío directo.

Parar el servidor de prueba al terminar (`pkill -f "flask run --port 5082"`).

- [ ] **Step 7: Commit**

```bash
git add app/templates/plantillas.html app/static/js/plantillas.js
git commit -m "feat: menu lateral con preview de solo lectura para plantillas"
```
