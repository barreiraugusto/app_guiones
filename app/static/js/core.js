// Variables globales
let guionEditando = null;
let textoEditando = null;
let graphEditando = null;

// Funciones de inicialización
function inicializarAplicacion() {
    // Al cargar la página, establecer el guion seleccionado
    const guionSeleccionado = localStorage.getItem('guionSeleccionado');
    if (guionSeleccionado) {
        document.getElementById('guion_id').value = guionSeleccionado;
        seleccionarGuion(guionSeleccionado);
    }

    cargarGuiones();
    cargarGuionesEnSelect();
}

// Otras funciones básicas que se usan en varios lugares
function mostrarError(mensaje) {
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        showConfirmButton: false,
        timer: 3000
    });
}

function mostrarExito(mensaje) {
    Swal.fire({
        icon: 'success',
        title: mensaje,
        showConfirmButton: false,
        timer: 1000
    });
}