const ANCHO_LIENZO = 1920;
const ALTO_LIENZO = 1080;
const ESCALA_LIENZO = 0.5;

let plantillaEditandoId = null;
let capas = [];
let capaSeleccionadaId = null;
let contadorIdTemporal = -1;

document.addEventListener('DOMContentLoaded', cargarListadoPlantillas);

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
                </div>
            </div>
        `;
        contenedor.appendChild(col);
    });
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

function renderizarLienzo() {
    const lienzo = document.getElementById('lienzo');
    lienzo.innerHTML = '';
    capas
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .forEach(capa => lienzo.appendChild(crearElementoEditable(capa)));
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
        div.innerHTML = `<div class="capa-texto-preview" style="font-family:${capa.fuente};font-size:${capa.tamano_fuente}px;color:${capa.color};justify-content:${justify};">${texto}</div>`;
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
        animacion_entrada: 'fade',
        animacion_salida: 'fade',
        duracion_transicion_ms: 400,
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

function actualizarCapaSeleccionada(cambios) {
    const capa = capas.find(c => c.id === capaSeleccionadaId);
    if (!capa) return;
    Object.assign(capa, cambios);
    renderizarLienzo();
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
                <input type="text" class="form-control" id="prop-fuente" value="${capa.fuente}">
            </div>
            <div class="form-group mb-2">
                <label>Tamaño:</label>
                <input type="number" class="form-control" id="prop-tamano" value="${capa.tamano_fuente}">
            </div>
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
        <h6>Capa: ${capa.tipo}</h6>
        <div class="row">
            <div class="col-6 form-group mb-2"><label>X</label><input type="number" class="form-control" id="prop-x" value="${capa.x}"></div>
            <div class="col-6 form-group mb-2"><label>Y</label><input type="number" class="form-control" id="prop-y" value="${capa.y}"></div>
            <div class="col-6 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-ancho" value="${capa.ancho}"></div>
            <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-alto" value="${capa.alto}"></div>
        </div>
        ${camposEspecificos}
        <div class="form-group mb-2">
            <label>Animación entrada:</label>
            <select class="form-control" id="prop-anim-entrada">
                <option value="none">Ninguna</option>
                <option value="fade">Fundido</option>
                <option value="slide">Deslizar</option>
            </select>
        </div>
        <div class="form-group mb-2">
            <label>Animación salida:</label>
            <select class="form-control" id="prop-anim-salida">
                <option value="none">Ninguna</option>
                <option value="fade">Fundido</option>
                <option value="slide">Deslizar</option>
            </select>
        </div>
        <div class="form-group mb-3">
            <label>Duración transición (ms):</label>
            <input type="number" class="form-control" id="prop-duracion" value="${capa.duracion_transicion_ms}">
        </div>
        <button class="btn btn-outline-danger btn-block" onclick="eliminarCapaSeleccionada()">Eliminar capa</button>
    `;

    document.getElementById('prop-x').addEventListener('change', (e) => actualizarCapaSeleccionada({ x: parseInt(e.target.value) || 0 }));
    document.getElementById('prop-y').addEventListener('change', (e) => actualizarCapaSeleccionada({ y: parseInt(e.target.value) || 0 }));
    document.getElementById('prop-ancho').addEventListener('change', (e) => actualizarCapaSeleccionada({ ancho: parseInt(e.target.value) || 1 }));
    document.getElementById('prop-alto').addEventListener('change', (e) => actualizarCapaSeleccionada({ alto: parseInt(e.target.value) || 1 }));

    document.getElementById('prop-anim-entrada').value = capa.animacion_entrada;
    document.getElementById('prop-anim-salida').value = capa.animacion_salida;
    document.getElementById('prop-anim-entrada').addEventListener('change', (e) => actualizarCapaSeleccionada({ animacion_entrada: e.target.value }));
    document.getElementById('prop-anim-salida').addEventListener('change', (e) => actualizarCapaSeleccionada({ animacion_salida: e.target.value }));
    document.getElementById('prop-duracion').addEventListener('change', (e) => actualizarCapaSeleccionada({ duracion_transicion_ms: parseInt(e.target.value) || 400 }));

    if (capa.tipo === 'texto') {
        document.getElementById('prop-campo-dato').value = capa.campo_dato || '';
        document.getElementById('prop-alineacion').value = capa.alineacion;
        document.getElementById('prop-campo-dato').addEventListener('change', (e) => actualizarCapaSeleccionada({ campo_dato: e.target.value || null }));
        document.getElementById('prop-texto-fijo').addEventListener('change', (e) => actualizarCapaSeleccionada({ texto_fijo: e.target.value }));
        document.getElementById('prop-fuente').addEventListener('change', (e) => actualizarCapaSeleccionada({ fuente: e.target.value }));
        document.getElementById('prop-tamano').addEventListener('change', (e) => actualizarCapaSeleccionada({ tamano_fuente: parseInt(e.target.value) || 24 }));
        document.getElementById('prop-color').addEventListener('change', (e) => actualizarCapaSeleccionada({ color: e.target.value }));
        document.getElementById('prop-alineacion').addEventListener('change', (e) => actualizarCapaSeleccionada({ alineacion: e.target.value }));
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
        capas: capas.map((c, i) => {
            const { id, ...resto } = c;
            return { ...resto, orden: i };
        }),
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

        Swal.fire({ icon: 'success', title: 'Plantilla guardada', showConfirmButton: false, timer: 1000 });
        cerrarEditor();
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
