const ANCHO_LIENZO = 1920;
const ALTO_LIENZO = 1080;
const ESCALA_LIENZO = 0.5;

let plantillaEditandoId = null;
let capas = [];
let capaSeleccionadaId = null;
let contadorIdTemporal = -1;
let pestanaPropiedadesActiva = 'posicion'; // 'posicion' | 'contenido' | 'comportamiento'
let subPestanaAnimacion = 'entrada'; // 'entrada' | 'salida'

document.addEventListener('DOMContentLoaded', cargarListadoPlantillas);

async function cargarListadoPlantillas() {
    const response = await fetch('/api/plantillas');
    const plantillas = await response.json();
    const contenedor = document.getElementById('lista-plantillas');
    contenedor.querySelectorAll('.plantilla-existente').forEach(el => el.remove());

    plantillas.forEach(p => {
        const item = document.createElement('div');
        item.className = 'list-group-item list-group-item-action plantilla-existente';
        item.style.cursor = 'pointer';
        item.dataset.plantillaId = p.id;
        item.textContent = p.nombre;
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
    document.getElementById('preview-plantilla-acciones').style.display = 'block';
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
    document.getElementById('preview-plantilla-acciones').style.display = 'none';
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

function nuevaPlantilla() {
    plantillaEditandoId = null;
    capas = [];
    capaSeleccionadaId = null;
    document.getElementById('plantilla-nombre').value = '';
    document.getElementById('btn-eliminar-plantilla').style.display = 'none';
    mostrarEditor();
}

async function abrirPlantilla(id) {
    const response = await fetch(`/api/plantillas/${id}`);
    if (!response.ok) {
        Swal.fire({ icon: 'error', title: 'No se pudo cargar la plantilla' });
        return;
    }
    const data = await response.json();
    plantillaEditandoId = data.id;
    capas = data.capas;
    capaSeleccionadaId = null;
    document.getElementById('plantilla-nombre').value = data.nombre;
    document.getElementById('btn-eliminar-plantilla').style.display = 'inline-block';
    mostrarEditor();
}

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

function renderizarLienzo() {
    const lienzo = document.getElementById('lienzo');
    lienzo.innerHTML = '';
    capas
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .forEach(capa => lienzo.appendChild(crearElementoEditable(capa)));
    renderizarListaCapas();
}

const ETIQUETA_TIPO_CAPA = { imagen: 'Imagen', video: 'Video', texto: 'Texto', forma: 'Forma' };
const ICONO_TIPO_CAPA = { imagen: 'fa-image', video: 'fa-video', texto: 'fa-font', forma: 'fa-square' };
const FUENTES_FIJAS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Segoe UI'];

function detalleCapa(capa) {
    if (capa.tipo === 'imagen' || capa.tipo === 'video') {
        return capa.archivo ? capa.archivo.split('/').pop() : '(sin archivo)';
    }
    if (capa.tipo === 'texto') {
        return capa.texto_fijo || (capa.campo_dato ? `{{${capa.campo_dato}}}` : 'texto libre');
    }
    if (capa.tipo === 'forma') {
        return `${capa.ancho}×${capa.alto}`;
    }
    return '';
}

function renderizarListaCapas() {
    const lista = document.getElementById('lista-capas');
    if (!lista) return;
    if (capas.length === 0) {
        lista.innerHTML = '<p class="text-muted mb-0 small">Sin capas todavía.</p>';
        return;
    }
    lista.innerHTML = capas
        .slice()
        .sort((a, b) => b.orden - a.orden)
        .map(capa => {
            const activa = capa.id === capaSeleccionadaId ? ' active' : '';
            return `
                <button type="button" class="list-group-item list-group-item-action py-1 px-2 small${activa}"
                        onclick="seleccionarCapa(${capa.id})">
                    <i class="fas ${ICONO_TIPO_CAPA[capa.tipo] || 'fa-layer-group'} mr-1"></i>
                    ${ETIQUETA_TIPO_CAPA[capa.tipo] || capa.tipo} — ${detalleCapa(capa)}${capa.es_mosca ? ' <span class="badge badge-info">Mosca</span>' : ''}
                </button>
            `;
        })
        .join('');
}

function crearElementoEditable(capa) {
    const div = document.createElement('div');
    div.className = 'capa-editor' + (capa.id === capaSeleccionadaId ? ' seleccionada' : '');
    div.dataset.capaId = capa.id;
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

    div.addEventListener('mousedown', (e) => iniciarArrastre(e, capa.id));
    div.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarCapa(capa.id);
    });

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.addEventListener('mousedown', (e) => iniciarRedimension(e, capa.id));
    div.appendChild(handle);

    return div;
}

function seleccionarCapa(id) {
    capaSeleccionadaId = id;
    pestanaPropiedadesActiva = 'posicion';
    renderizarLienzo();
    renderizarPanelPropiedades();
}

let arrastre = null;

function iniciarArrastre(e, capaId) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarCapa(capaId);
    const capa = capas.find(c => c.id === capaId);
    arrastre = { capaId, xInicial: e.clientX, yInicial: e.clientY, xCapaInicial: capa.x, yCapaInicial: capa.y };
    document.addEventListener('mousemove', moverArrastre);
    document.addEventListener('mouseup', finalizarArrastre);
}

function moverArrastre(e) {
    if (!arrastre) return;
    const capa = capas.find(c => c.id === arrastre.capaId);
    const deltaX = (e.clientX - arrastre.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastre.yInicial) / ESCALA_LIENZO;
    capa.x = Math.max(0, Math.round(arrastre.xCapaInicial + deltaX));
    capa.y = Math.max(0, Math.round(arrastre.yCapaInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastre() {
    arrastre = null;
    document.removeEventListener('mousemove', moverArrastre);
    document.removeEventListener('mouseup', finalizarArrastre);
    renderizarPanelPropiedades();
}

let redimension = null;

function iniciarRedimension(e, capaId) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarCapa(capaId);
    const capa = capas.find(c => c.id === capaId);
    redimension = { capaId, xInicial: e.clientX, yInicial: e.clientY, anchoInicial: capa.ancho, altoInicial: capa.alto };
    document.addEventListener('mousemove', moverRedimension);
    document.addEventListener('mouseup', finalizarRedimension);
}

function moverRedimension(e) {
    if (!redimension) return;
    const capa = capas.find(c => c.id === redimension.capaId);
    const deltaX = (e.clientX - redimension.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - redimension.yInicial) / ESCALA_LIENZO;
    capa.ancho = Math.max(20, Math.round(redimension.anchoInicial + deltaX));
    capa.alto = Math.max(20, Math.round(redimension.altoInicial + deltaY));
    renderizarLienzo();
}

function finalizarRedimension() {
    redimension = null;
    document.removeEventListener('mousemove', moverRedimension);
    document.removeEventListener('mouseup', finalizarRedimension);
    renderizarPanelPropiedades();
}

function agregarCapa(tipo) {
    const nuevaCapa = {
        id: contadorIdTemporal--,
        orden: capas.length,
        tipo,
        x: 100,
        y: 100,
        ancho: tipo === 'texto' ? 400 : 200,
        alto: tipo === 'texto' ? 60 : 200,
        archivo: null,
        loop: true,
        campo_dato: null,
        texto_fijo: tipo === 'texto' ? 'Texto' : null,
        fuente: 'Arial',
        tamano_fuente: 24,
        color: '#ffffff',
        alineacion: 'left',
        negrita: false,
        cursiva: false,
        animacion_entrada: 'fade',
        animacion_salida: 'fade',
        duracion_entrada_ms: 400,
        duracion_salida_ms: 400,
        direccion_entrada: 'izquierda',
        direccion_salida: 'izquierda',
        radio_esquina: 0,
        color_fondo: '#ffffff',
        opacidad: 100,
        color_borde: '#000000',
        ancho_borde: 0,
        usar_gradiente: false,
        gradiente_color_inicio: '#ffffff',
        gradiente_color_fin: '#000000',
        gradiente_angulo: 90,
        controlada_por_id: null,
        es_mosca: false,
    };
    capas.push(nuevaCapa);
    seleccionarCapa(nuevaCapa.id);
}

function eliminarCapaSeleccionada() {
    capas = capas.filter(c => c.id !== capaSeleccionadaId);
    capaSeleccionadaId = null;
    renderizarLienzo();
    renderizarPanelPropiedades();
}

function moverCapaSeleccionada(destino) {
    const idx = capas.findIndex(c => c.id === capaSeleccionadaId);
    if (idx === -1) return;
    const [capa] = capas.splice(idx, 1);
    if (destino === 'frente') {
        capas.push(capa);
    } else {
        capas.unshift(capa);
    }
    capas.forEach((c, i) => { c.orden = i; });
    renderizarLienzo();
    renderizarPanelPropiedades();
}

function actualizarCapaSeleccionada(cambios) {
    const capa = capas.find(c => c.id === capaSeleccionadaId);
    if (!capa) return;
    Object.assign(capa, cambios);
    renderizarLienzo();
}

function cambiarPestanaPropiedades(nombre) {
    pestanaPropiedadesActiva = nombre;
    renderizarPanelPropiedades();
}

function cambiarSubPestanaAnimacion(nombre) {
    subPestanaAnimacion = nombre;
    renderizarPanelPropiedades();
}

function renderizarPanelPropiedades() {
    const panel = document.getElementById('panel-propiedades');
    const capa = capas.find(c => c.id === capaSeleccionadaId);

    if (!capa) {
        panel.innerHTML = '<p class="text-muted">Seleccioná una capa para editar sus propiedades.</p>';
        return;
    }

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
        camposEspecificos = `
            <div class="form-group mb-2">
                <label>Archivo (${capa.tipo === 'video' ? '.webm' : '.png/.gif'}):</label>
                <input type="file" class="form-control" id="prop-archivo" accept="${capa.tipo === 'video' ? '.webm' : '.png,.gif'}">
                <small class="text-muted">${capa.archivo || 'Sin archivo'}</small>
            </div>
            ${capa.tipo === 'video' ? `
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-loop" ${capa.loop ? 'checked' : ''}>
                <label class="form-check-label">Repetir en loop</label>
            </div>` : ''}
        `;
    }

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

    document.getElementById('prop-x').addEventListener('change', (e) => actualizarCapaSeleccionada({ x: parseInt(e.target.value) || 0 }));
    document.getElementById('prop-y').addEventListener('change', (e) => actualizarCapaSeleccionada({ y: parseInt(e.target.value) || 0 }));
    document.getElementById('prop-ancho').addEventListener('change', (e) => actualizarCapaSeleccionada({ ancho: parseInt(e.target.value) || 1 }));
    document.getElementById('prop-alto').addEventListener('change', (e) => actualizarCapaSeleccionada({ alto: parseInt(e.target.value) || 1 }));

    document.getElementById('prop-anim-entrada').value = capa.animacion_entrada;
    document.getElementById('prop-anim-salida').value = capa.animacion_salida;
    document.getElementById('prop-anim-entrada').addEventListener('change', (e) => actualizarCapaSeleccionada({ animacion_entrada: e.target.value }));
    document.getElementById('prop-anim-salida').addEventListener('change', (e) => actualizarCapaSeleccionada({ animacion_salida: e.target.value }));

    document.getElementById('prop-direccion-entrada').value = capa.direccion_entrada;
    document.getElementById('prop-direccion-salida').value = capa.direccion_salida;
    document.getElementById('prop-direccion-entrada').addEventListener('change', (e) => actualizarCapaSeleccionada({ direccion_entrada: e.target.value }));
    document.getElementById('prop-direccion-salida').addEventListener('change', (e) => actualizarCapaSeleccionada({ direccion_salida: e.target.value }));
    document.getElementById('prop-duracion-entrada').addEventListener('change', (e) => actualizarCapaSeleccionada({ duracion_entrada_ms: parseInt(e.target.value) || 400 }));
    document.getElementById('prop-duracion-salida').addEventListener('change', (e) => actualizarCapaSeleccionada({ duracion_salida_ms: parseInt(e.target.value) || 400 }));

    document.getElementById('prop-controlada-por').value = capa.controlada_por_id || '';
    document.getElementById('prop-controlada-por').addEventListener('change', (e) => {
        actualizarCapaSeleccionada({ controlada_por_id: e.target.value ? parseInt(e.target.value) : null });
    });

    document.getElementById('prop-es-mosca').addEventListener('change', (e) => {
        actualizarCapaSeleccionada({ es_mosca: e.target.checked });
    });

    if (capa.tipo === 'texto') {
        document.getElementById('prop-campo-dato').value = capa.campo_dato || '';
        document.getElementById('prop-alineacion').value = capa.alineacion;
        document.getElementById('prop-campo-dato').addEventListener('change', (e) => actualizarCapaSeleccionada({ campo_dato: e.target.value || null }));
        document.getElementById('prop-texto-fijo').addEventListener('change', (e) => actualizarCapaSeleccionada({ texto_fijo: e.target.value }));
        document.getElementById('prop-fuente').addEventListener('change', (e) => {
            const inputCustom = document.getElementById('prop-fuente-custom');
            if (e.target.value === '__custom__') {
                inputCustom.style.display = '';
                inputCustom.focus();
            } else {
                inputCustom.style.display = 'none';
                actualizarCapaSeleccionada({ fuente: e.target.value });
            }
        });
        document.getElementById('prop-fuente-custom').addEventListener('change', (e) => actualizarCapaSeleccionada({ fuente: e.target.value }));
        document.getElementById('prop-tamano').addEventListener('change', (e) => actualizarCapaSeleccionada({ tamano_fuente: parseInt(e.target.value) || 24 }));
        document.getElementById('prop-color').addEventListener('change', (e) => actualizarCapaSeleccionada({ color: e.target.value }));
        document.getElementById('prop-alineacion').addEventListener('change', (e) => actualizarCapaSeleccionada({ alineacion: e.target.value }));
        document.getElementById('prop-negrita').addEventListener('change', (e) => actualizarCapaSeleccionada({ negrita: e.target.checked }));
        document.getElementById('prop-cursiva').addEventListener('change', (e) => actualizarCapaSeleccionada({ cursiva: e.target.checked }));
    } else if (capa.tipo === 'forma') {
        document.getElementById('prop-radio-esquina').addEventListener('change', (e) => actualizarCapaSeleccionada({ radio_esquina: parseInt(e.target.value) || 0 }));
        document.getElementById('prop-color-fondo').addEventListener('change', (e) => actualizarCapaSeleccionada({ color_fondo: e.target.value }));
        document.getElementById('prop-usar-gradiente').addEventListener('change', (e) => {
            actualizarCapaSeleccionada({ usar_gradiente: e.target.checked });
            document.getElementById('grupo-gradiente').style.display = e.target.checked ? '' : 'none';
        });
        document.getElementById('prop-gradiente-inicio').addEventListener('change', (e) => actualizarCapaSeleccionada({ gradiente_color_inicio: e.target.value }));
        document.getElementById('prop-gradiente-fin').addEventListener('change', (e) => actualizarCapaSeleccionada({ gradiente_color_fin: e.target.value }));
        document.getElementById('prop-gradiente-angulo').addEventListener('change', (e) => actualizarCapaSeleccionada({ gradiente_angulo: parseInt(e.target.value) || 0 }));
        document.getElementById('prop-color-borde').addEventListener('change', (e) => actualizarCapaSeleccionada({ color_borde: e.target.value }));
        document.getElementById('prop-ancho-borde').addEventListener('change', (e) => actualizarCapaSeleccionada({ ancho_borde: parseInt(e.target.value) || 0 }));
        document.getElementById('prop-opacidad').addEventListener('change', (e) => actualizarCapaSeleccionada({ opacidad: parseInt(e.target.value) || 0 }));
    } else {
        document.getElementById('prop-archivo').addEventListener('change', (e) => subirArchivoCapa(e.target.files[0]));
        if (capa.tipo === 'video') {
            document.getElementById('prop-loop').addEventListener('change', (e) => actualizarCapaSeleccionada({ loop: e.target.checked }));
        }
    }
}

async function subirArchivoCapa(archivo) {
    if (!archivo) return;
    const formData = new FormData();
    formData.append('archivo', archivo);

    try {
        const response = await fetch('/plantillas/upload', { method: 'POST', body: formData });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al subir el archivo');
        }
        const data = await response.json();
        actualizarCapaSeleccionada({ archivo: data.ruta });
        renderizarPanelPropiedades();
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}

async function guardarPlantilla() {
    const nombre = document.getElementById('plantilla-nombre').value.trim();
    if (!nombre) {
        Swal.fire({ icon: 'error', title: 'Falta el nombre de la plantilla' });
        return;
    }

    const payload = {
        nombre,
        ancho: ANCHO_LIENZO,
        alto: ALTO_LIENZO,
        // Se manda el id de cada capa (real o temporal) para que el backend
        // pueda resolver controlada_por_id dentro de este mismo payload.
        capas: capas.map((c, i) => ({ ...c, orden: i })),
    };

    try {
        const url = plantillaEditandoId ? `/api/plantillas/${plantillaEditandoId}` : '/api/plantillas';
        const method = plantillaEditandoId ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al guardar la plantilla');
        }

        const data = await response.json();
        if (!plantillaEditandoId) plantillaEditandoId = data.id;

        Swal.fire({ icon: 'success', title: 'Plantilla guardada', showConfirmButton: false, timer: 1000 });
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}

async function eliminarPlantillaActual() {
    if (!plantillaEditandoId) return;
    const result = await Swal.fire({
        title: '¿Eliminar esta plantilla?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    try {
        const response = await fetch(`/api/plantillas/${plantillaEditandoId}`, { method: 'DELETE' });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al eliminar la plantilla');
        }
        Swal.fire({ icon: 'success', title: 'Plantilla eliminada', showConfirmButton: false, timer: 1000 });
        cerrarEditor();
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}

async function duplicarPlantilla(id) {
    try {
        const response = await fetch(`/api/plantillas/${id}/duplicar`, { method: 'POST' });
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.mensaje || 'Error al duplicar la plantilla');
        }
        const data = await response.json();
        await abrirPlantilla(data.id);
    } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.message });
    }
}
