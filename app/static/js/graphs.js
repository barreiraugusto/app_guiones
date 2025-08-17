// Función para guardar un Graph sin cerrar
async function guardarGraph(event) {
    event.preventDefault();

    // Obtener los valores básicos del formulario
    const graphId = document.getElementById('graph_id').value;
    const textoId = document.getElementById('texto_id').value;
    const lugar = document.getElementById('lugar').value;
    const tema = document.getElementById('tema').value;

    // Guardar la selección actual del texto
    const textoSeleccionado = document.getElementById('texto_id').value;

    // Recolectar todas las bajadas
    const bajadas = [];
    document.querySelectorAll('.bajada-input').forEach(input => {
        if (input.value.trim()) {
            bajadas.push(input.value.trim().toUpperCase());
        }
    });

    // Recolectar todos los entrevistados con sus citas
    const entrevistados = [];
    document.querySelectorAll('.entrevistado-group').forEach(group => {
        const nombre = group.querySelector('.entrevistado-nombre').value.trim();
        if (nombre) {
            const citas = [];
            group.querySelectorAll('.cita-texto').forEach(input => {
                if (input.value.trim()) {
                    citas.push(input.value.trim().toUpperCase());
                }
            });

            // Solo agregar entrevistado si tiene nombre o citas
            if (nombre || citas.length > 0) {
                entrevistados.push({
                    nombre: nombre.toUpperCase(), citas: citas
                });
            }
        }
    });

    // Validaciones básicas
    // if (bajadas.length === 0) {
    //     Swal.fire({
    //         icon: 'error',
    //         title: 'Error',
    //         text: 'Debe agregar al menos una bajada',
    //         showConfirmButton: false,
    //         timer: 3000,
    //     });
    //     return;
    // }

    try {
        const url = graphEditando ? `/graphs/${graphEditando}` : '/graphs';
        const method = graphEditando ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method, headers: {
                'Content-Type': 'application/json',
            }, body: JSON.stringify({
                texto_id: textoId,
                lugar: lugar.toUpperCase(),
                tema: tema ? tema.toUpperCase() : null,
                bajadas: bajadas,
                entrevistados: entrevistados
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.mensaje || 'Error al guardar el graph');
        }

        // Cerrar el modal y recargar
        $('#formularioGraphModal').modal('hide');
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
            await seleccionarGuion(guion_id);
        }

        // Restaurar la selección del texto
        document.getElementById('texto_id').value = textoSeleccionado;

        // Limpiar el formulario solo si se está editando
        if (graphEditando) {
            cancelarEdicionGraph();
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

// Función para guardar un Graph sin cerrar
async function agregarNoCerrar(event) {
    event.preventDefault();

    // Obtener los valores básicos del formulario
    const graphId = document.getElementById('graph_id').value;
    const textoId = document.getElementById('texto_id').value;
    const lugar = document.getElementById('lugar').value;
    const tema = document.getElementById('tema').value;

    // Guardar la selección actual del texto
    const textoSeleccionado = document.getElementById('texto_id').value;

    // Recolectar todas las bajadas
    const bajadas = [];
    document.querySelectorAll('.bajada-input').forEach(input => {
        if (input.value.trim()) {
            bajadas.push(input.value.trim().toUpperCase());
        }
    });

    // Recolectar todos los entrevistados con sus citas
    const entrevistados = [];
    document.querySelectorAll('.entrevistado-group').forEach(group => {
        const nombre = group.querySelector('.entrevistado-nombre').value.trim();
        if (nombre) {
            const citas = [];
            group.querySelectorAll('.cita-texto').forEach(input => {
                if (input.value.trim()) {
                    citas.push(input.value.trim().toUpperCase());
                }
            });

            // Solo agregar entrevistado si tiene nombre o citas
            if (nombre || citas.length > 0) {
                entrevistados.push({
                    nombre: nombre.toUpperCase(), citas: citas
                });
            }
        }
    });

    // Validaciones básicas
    if (bajadas.length === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Debe agregar al menos una bajada',
            showConfirmButton: false,
            timer: 3000,
        });
        return;
    }

    try {
        const url = graphEditando ? `/graphs/${graphEditando}` : '/graphs';
        const method = graphEditando ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method, headers: {
                'Content-Type': 'application/json',
            }, body: JSON.stringify({
                texto_id: textoId,
                lugar: lugar.toUpperCase(),
                tema: tema ? tema.toUpperCase() : null,
                bajadas: bajadas,
                entrevistados: entrevistados
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.mensaje || 'Error al guardar el graph');
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
            await seleccionarGuion(guion_id);
        }

        // Restaurar la selección del texto
        document.getElementById('texto_id').value = textoSeleccionado;

        // Limpiar el formulario solo si se está editando
        if (graphEditando) {
            cancelarEdicionGraph();
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

// Función para editar un graph (versión completa con actualización automática)
async function editarGraph(id) {
    try {
        // 1. Obtener datos del graph
        const response = await fetch(`/graphs/${id}`);
        if (!response.ok) throw new Error('Error al cargar el graph');
        const graph = await response.json();

        // 2. Rellenar formulario (código existente)
        document.getElementById('graph_id').value = graph.id;
        document.getElementById('texto_id').value = graph.texto_id;
        document.getElementById('lugar').value = graph.lugar || '';
        document.getElementById('tema').value = graph.tema || '';

        // Limpiar y poblar bajadas
        const bajadasContainer = document.getElementById('bajadas-container');
        bajadasContainer.innerHTML = '';
        graph.bajadas.forEach(bajada => {
            const div = document.createElement('div');
            div.className = 'input-group mb-2';
            div.innerHTML = `
                <input type="text" class="form-control bajada-input" 
                       value="${bajada}" 
                       placeholder="Texto de la bajada" required>
                <button class="btn btn-outline-danger" type="button" onclick="removerBajada(this)">
                    ×
                </button>
            `;
            bajadasContainer.appendChild(div);
        });

        // Limpiar y poblar entrevistados
        const entrevistadosContainer = document.getElementById('entrevistados-container');
        entrevistadosContainer.innerHTML = '';
        graph.entrevistados.forEach(entrevistado => {
            const div = document.createElement('div');
            div.className = 'entrevistado-group mb-3 p-2 border rounded';
            const citasHTML = entrevistado.citas.map(cita => `
                <div class="input-group mb-2">
                    <input type="text" class="form-control cita-texto" 
                           value="${cita}" 
                           placeholder="Cita textual">
                    <button class="btn btn-outline-danger" type="button" onclick="removerCita(this)">
                        ×
                    </button>
                </div>
            `).join('');

            div.innerHTML = `
                <div class="input-group mb-2">
                    <input type="text" class="form-control entrevistado-nombre" 
                           value="${entrevistado.nombre}" 
                           placeholder="Nombre del entrevistado" required>
                </div>
                <div class="citas-container">
                    ${citasHTML}
                </div>
                <button type="button" class="btn btn-sm btn-outline-secondary" onclick="agregarCita(this)">
                    <i class="fas fa-plus"></i> Añadir cita
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger float-end" onclick="removerEntrevistado(this)">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
            `;
            entrevistadosContainer.appendChild(div);
        });

        // 3. Configurar el guardado con actualización automática
        const formulario = document.getElementById('formularioGraph');
        const oldSubmit = formulario.onsubmit;

        formulario.onsubmit = async function (event) {
            // Ejecutar guardado normal
            if (oldSubmit) await oldSubmit(event);

            // Actualizar la vista si el guardado fue exitoso
            const graphElement = document.querySelector(`[data-graph-id="${id}"]`);
            if (graphElement) {
                // Actualizar lugar
                const lugarElement = graphElement.querySelector('.graph-lugar');
                if (lugarElement) {
                    lugarElement.textContent = document.getElementById('lugar').value.toUpperCase();
                }

                // Actualizar tema
                const temaElement = graphElement.querySelector('.graph-tema');
                if (temaElement) {
                    temaElement.textContent = document.getElementById('tema').value?.toUpperCase() || 'Sin tema';
                }

                // Actualizar conteo de bajadas
                const bajadasCountElement = graphElement.querySelector('.graph-bajadas-count');
                if (bajadasCountElement) {
                    const bajadasCount = document.querySelectorAll('.bajada-input').length;
                    bajadasCountElement.textContent = `${bajadasCount} bajada(s)`;
                }

                // Mostrar feedback visual
                graphElement.classList.add('updated-highlight');
                setTimeout(() => {
                    graphElement.classList.remove('updated-highlight');
                }, 1000);
            }
        };

        // 4. Mostrar interfaz
        document.getElementById('botonGuardarGraph').textContent = 'Guardar';
        document.getElementById('botonCancelarGraph').style.display = 'inline';
        graphEditando = id;
        $('#formularioGraphModal').modal('show');

    } catch (error) {
        console.error("Error al editar graph:", error);
        Swal.fire({
            icon: 'error', title: 'Error', text: error.message, showConfirmButton: false, timer: 3000
        });
    }
}

// Función para eliminar un graph
async function eliminarGraph(id) {
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

    if (result.isConfirmed) {
        try {
            const response = await fetch(`/graphs/${id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.mensaje || "Error al eliminar el graph");
            }

            const result = await response.json();
            Swal.fire({
                icon: 'success',
                title: result.mensaje || "Graph eliminado correctamente",
                showConfirmButton: false,
                timer: 1000,
            });

            // Recargar la lista de graphs
            const guion_id = document.getElementById('guion_id').value;
            if (guion_id) {
                await seleccionarGuion(guion_id);
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message || 'Hubo un error al eliminar el graph. Por favor, inténtalo de nuevo.',
                showConfirmButton: false,
                timer: 3000,
            });
        }
    }
}

// Función para cancelar la edición de un graph
function cancelarEdicionGraph() {
    // Limpiar el formulario
    document.getElementById('formularioGraph').reset();
    document.getElementById('graph_id').value = '';

    // Limpiar contenedores dinámicos
    document.getElementById('bajadas-container').innerHTML = '';
    document.getElementById('entrevistados-container').innerHTML = '';

    // Agregar campos vacíos por defecto
    agregarBajada();
    agregarEntrevistado();

    // Restablecer el botón a "Agregar Graph"
    document.getElementById('botonGuardarGraph').textContent = 'Agregar Graph';
    document.getElementById('botonCancelarGraph').style.display = 'none';

    // Restablecer la variable de edición
    graphEditando = null;

    // Cerrar el modal
    $('#formularioGraphModal').modal('hide');
}

// Función para agregar nueva bajada
function agregarBajada() {
    const container = document.getElementById('bajadas-container');
    const newBajada = document.createElement('div');
    newBajada.className = 'input-group mb-2';
    newBajada.innerHTML = `
        <input type="text" class="form-control bajada-input" placeholder="Texto de la bajada (max 255 caracteres)" maxlength="255">
        <div class="input-group-append">
            <button class="btn btn-outline-danger" type="button" onclick="removerBajada(this)">×</button>
        </div>
    `;
    container.appendChild(newBajada);
}

// Función para remover bajada
function removerBajada(button) {
    if (document.querySelectorAll('.bajada-input').length > 1) {
        button.closest('.input-group').remove();
    } else {
        alert('Debe haber al menos una bajada');
    }
}

// Función para agregar nuevo entrevistado
function agregarEntrevistado() {
    const container = document.getElementById('entrevistados-container');
    const newEntrevistado = document.createElement('div');
    newEntrevistado.className = 'entrevistado-group mb-3 p-2 border rounded';
    newEntrevistado.innerHTML = `
        <div class="input-group mb-2">
            <input type="text" class="form-control entrevistado-nombre" placeholder="Nombre del entrevistado">
        </div>
        <div class="citas-container">
            <div class="input-group mb-2">
                <input type="text" class="form-control cita-texto" placeholder="Cita textual (max 255 caracteres)" maxlength="255">
                <div class="input-group-append">
                    <button class="btn btn-outline-danger" type="button" onclick="removerCita(this)">×</button>
                </div>
            </div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary" onclick="agregarCita(this)">
            <i class="fas fa-plus"></i> Añadir otra cita
        </button>
        <button type="button" class="btn btn-sm btn-outline-danger float-right" onclick="removerEntrevistado(this)">
            <i class="fas fa-trash"></i> Eliminar entrevistado
        </button>
    `;
    container.appendChild(newEntrevistado);
}

// Función para agregar nueva cita a un entrevistado
function agregarCita(button) {
    const citasContainer = button.previousElementSibling;
    const newCita = document.createElement('div');
    newCita.className = 'input-group mb-2';
    newCita.innerHTML = `
        <input type="text" class="form-control cita-texto" placeholder="Cita textual (max 255 caracteres)" maxlength="255">
        <div class="input-group-append">
            <button class="btn btn-outline-danger" type="button" onclick="removerCita(this)">×</button>
        </div>
    `;
    citasContainer.appendChild(newCita);
}

// Función para remover cita
function removerCita(button) {
    const inputGroup = button.closest('.input-group');
    const citasContainer = inputGroup.parentElement;
    const todasLasCitas = citasContainer.querySelectorAll('.input-group');

    // Permitir eliminar siempre, dejando al menos un campo vacío si es la última
    if (todasLasCitas.length > 1) {
        inputGroup.remove();
    } else {
        // Resetear la última cita en lugar de eliminarla
        const input = inputGroup.querySelector('input');
        input.value = '';
        input.placeholder = "Cita textual (opcional)";
        input.focus();

        // Opcional: cambiar estilo para indicar que es opcional
        inputGroup.classList.add('border-light');
    }
}

// Función para remover entrevistado
function removerEntrevistado(button) {
    if (document.querySelectorAll('.entrevistado-group').length > 1) {
        button.closest('.entrevistado-group').remove();
    } else {
        alert('Debe haber al menos un entrevistado');
    }
}

async function ExportarGraphsXML() {
    try {
        const response = await fetch(`/generar_xml`, {
            method: 'PUT', headers: {
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
            icon: 'error', title: 'Error', text: error.message, showConfirmButton: true
        });
    }
}


function abrirModalGraph(textoId) {
    // Limpiar el formulario primero
    cancelarEdicionGraph();

    // Establecer el texto seleccionado
    document.getElementById('texto_id').value = textoId;

    // Buscar y seleccionar la opción correspondiente en el select
    const select = document.getElementById('texto_id');
    const option = select.querySelector(`option[value="${textoId}"]`);
    if (option) {
        option.selected = true;
    }

    // Abrir el modal
    $('#formularioGraphModal').modal('show');
}

