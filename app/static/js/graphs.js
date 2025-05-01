async function guardarGraph(event) {
    event.preventDefault();

    // Obtener los valores del formulario
    const graphId = document.getElementById('graph_id').value;
    const textoId = document.getElementById('texto_id').value;
    const lugar = document.getElementById('lugar').value;
    const tema = document.getElementById('tema').value;
    const entrevistado = document.getElementById('entrevistado').value;
    const primeraLinea = document.getElementById('primera_linea').value;
    const segundaLinea = document.getElementById('segunda_linea').value;

    try {
        const url = graphEditando ? `/graphs/${graphEditando}` : '/graphs';
        const method = graphEditando ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                texto_id: textoId,
                lugar: lugar,
                tema: tema,
                entrevistado: entrevistado,
                primera_linea: primeraLinea,
                segunda_linea: segundaLinea,
            }),
        });

        if (!response.ok) {
            throw new Error('Error al guardar el graph');
        }

        // Cerrar el modal
        $('#formularioGraphModal').modal('hide');

        const result = await response.json();
        Swal.fire({
            icon: 'success',
            title: result.mensaje || "Graph guardado correctamente",
            showConfirmButton: false, // No mostrar el botón "Aceptar"
            timer: 1000, // El mensaje desaparecerá después de 2 segundos
        });

        // Limpiar el formulario solo si se está editando
        if (graphEditando) {
            cancelarEdicionGraph(); // Limpiar el formulario y restablecer el botón
        }
        // Si no se está editando, no borrar los datos del formulario

        // Recargar la lista de graphs
        const guion_id = document.getElementById('guion_id').value;
        if (guion_id) {
            await seleccionarGuion(guion_id); // Recargar la tabla de textos y graphs
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Hubo un error al guardar el graph. Por favor, inténtalo de nuevo.',
            showConfirmButton: false, // No mostrar el botón "Aceptar"
            timer: 3000, // El mensaje desaparecerá después de 3 segundos
        });
    }
}

// Función para guardar un Graph sin cerrar
async function agregarNoCerrar(event) {
    event.preventDefault();

    // Obtener los valores del formulario
    const graphId = document.getElementById('graph_id').value;
    const textoId = document.getElementById('texto_id').value;
    const lugar = document.getElementById('lugar').value;
    const tema = document.getElementById('tema').value;
    const entrevistado = document.getElementById('entrevistado').value;
    const primeraLinea = document.getElementById('primera_linea').value;
    const segundaLinea = document.getElementById('segunda_linea').value;

    // Guardar la selección actual de los elementos <select>
    const lugarSeleccionado = document.getElementById('lugar').value;
    const temaSeleccionado = document.getElementById('tema').value;
    const entrevistadoSeleccionado = document.getElementById('entrevistado').value;

    try {
        const url = graphEditando ? `/graphs/${graphEditando}` : '/graphs';
        const method = graphEditando ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                texto_id: textoId,
                lugar: lugar,
                tema: tema,
                entrevistado: entrevistado,
                primera_linea: primeraLinea,
                segunda_linea: segundaLinea,
            }),
        });

        if (!response.ok) {
            throw new Error('Error al guardar el graph');
        }

        const result = await response.json();
        Swal.fire({
            icon: 'success',
            title: result.mensaje || "Graph guardado correctamente",
            showConfirmButton: false,
            timer: 1000,
        });

        // Recargar la lista de graphs
        const guion_id = document.getElementById('guion_id').value;
        if (guion_id) {
            await seleccionarGuion(guion_id); // Recargar la tabla de textos y graphs
        }

        // Restaurar la selección de los elementos <select> después de recargar
        document.getElementById('texto_id').value = textoId;

        // Limpiar el formulario solo si se está editando
        if (graphEditando) {
            cancelarEdicionGraph(); // Limpiar el formulario y restablecer el botón
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Hubo un error al guardar el graph. Por favor, inténtalo de nuevo.',
            showConfirmButton: false,
            timer: 3000,
        });
    }
}

// Función para editar un graph
async function editarGraph(id) {
    try {
        // Obtener los datos del graph desde el servidor
        const response = await fetch(`/graphs/${id}`);
        if (!response.ok) throw new Error('Error al cargar el graph');
        const graph = await response.json();

        // Rellenar el formulario con los datos del graph
        document.getElementById('graph_id').value = graph.id;
        document.getElementById('texto_id').value = graph.texto_id;
        document.getElementById('lugar').value = graph.lugar;
        document.getElementById('tema').value = graph.tema;
        document.getElementById('entrevistado').value = graph.entrevistado;
        document.getElementById('primera_linea').value = graph.primera_linea;
        document.getElementById('segunda_linea').value = graph.segunda_linea;

        // 2. Actualizar el select de textos (¡ESTE ES EL PASO CLAVE!)
        const selectTexto = document.getElementById('texto_id');

        // Opción A: Si ya tiene opciones cargadas
        if (selectTexto.options.length > 1) {
            selectTexto.value = graph.texto_id;
        }
        // Opción B: Si necesita cargar opciones primero
        else {
            await cargarTextosEnSelect(); // Tu función existente
            selectTexto.value = graph.texto_id;
        }

        // Cambiar el botón de "Agregar Graph" a "Guardar"
        document.getElementById('botonGuardarGraph').textContent = 'Guardar';

        // Mostrar el botón de cancelar
        document.getElementById('botonCancelarGraph').style.display = 'inline';

        // Guardar el ID del graph que se está editando
        graphEditando = id;

        // Abrir el modal
        $('#formularioGraphModal').modal('show');
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Hubo un error al cargar el graph. Por favor, inténtalo de nuevo.',
            showConfirmButton: false,
            timer: 3000,
        });
    }
}

// Función para eliminar un graph
async function eliminarGraph(id) {
    // Mostrar un cuadro de confirmación con SweetAlert2
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "¡No podrás revertir esta acción!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
    });

    // Si el usuario confirma la acción
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/graphs/${id}`, {
                method: 'DELETE'
            });

            // Verifica si la respuesta es exitosa
            if (!response.ok) {
                const errorData = await response.json(); // Lee el mensaje de error del servidor
                throw new Error(errorData.mensaje || "Error al eliminar el graph");
            }

            const result = await response.json(); // Lee la respuesta del servidor

            // Mostrar mensaje de éxito con SweetAlert2
            Swal.fire({
                icon: 'success',
                title: result.mensaje || "Graph eliminado correctamente",
                showConfirmButton: false, // No mostrar el botón "Aceptar"
                timer: 1000, // El mensaje desaparecerá después de 2 segundos
            });

            // Recargar la lista de graphs
            const guion_id = document.getElementById('guion_id').value;
            if (guion_id) {
                await seleccionarGuion(guion_id); // Recargar la tabla de textos y graphs
            }
        } catch (error) {
            // Mostrar mensaje de error con SweetAlert2
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Hubo un error al eliminar el graph. Por favor, inténtalo de nuevo.',
                showConfirmButton: false, // No mostrar el botón "Aceptar"
                timer: 3000, // El mensaje desaparecerá después de 3 segundos
            });
        }
    }
}

// Función para cancelar la edición de un graph
function cancelarEdicionGraph() {
    // Limpiar el formulario
    document.getElementById('formularioGraph').reset();
    document.getElementById('graph_id').value = '';

    // Restablecer el botón a "Agregar Graph"
    document.getElementById('botonGuardarGraph').textContent = 'Agregar Graph';
    document.getElementById('botonCancelarGraph').style.display = 'none';

    // Restablecer la variable de edición
    graphEditando = null;
    // Cerrar el modal
    $('#formularioGraphModal').modal('hide');
}

async function ExportarGraphsXML() {
    try {
        const response = await fetch(`/generar_xml`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.mensaje || 'Error al generar los archivos');
        }

        Swal.fire({
            icon: 'success',
            title: result.mensaje || "Archivos XML generados correctamente",
            showConfirmButton: false,
            timer: 2000  // 2 segundos
        });

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message,
            showConfirmButton: true
        });
    }
}