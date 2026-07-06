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
}

function renderizarPanelPropiedades() {
    const panel = document.getElementById('panel-propiedades');
    panel.innerHTML = '<p class="text-muted">Seleccioná una capa para editar sus propiedades.</p>';
}
