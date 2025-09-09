async function cargarGuiones() {
    try {
        const response = await fetch('/guiones');
        if (!response.ok) throw new Error('Error al cargar los guiones');
        const guiones = await response.json();

        // Cargar los guiones en el modal
        const contenedorModal = document.getElementById('listaGuionesModal');
        contenedorModal.innerHTML = '';

        guiones.forEach(g => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action';
            item.dataset.id = g.id;
            item.innerHTML = `
                <div class="d-flex w-100 justify-content-between align-items-center">
                    <h6 class="mb-1">${g.nombre}</h6>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-info" onclick="event.stopPropagation(); editarGuion(${g.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-outline-danger" onclick="event.stopPropagation(); borrarGuion(${g.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                ${g.descripcion ? `<p class="mb-1 small text-muted">${g.descripcion}</p>` : ''}
            `;

            item.addEventListener('click', (e) => {
                e.preventDefault();
                seleccionarGuion(g.id);
                $('#seleccionarGuionModal').modal('hide');
            });

            contenedorModal.appendChild(item);
        });

        // Cargar los guiones en el <select> (se mantiene igual)
        const select = document.getElementById('guion_id');
        select.innerHTML = '<option value="">Seleccione un guion</option>';
        guiones.forEach(g => {
            const option = document.createElement('option');
            option.value = g.id;
            option.textContent = g.nombre;
            select.appendChild(option);
        });

        const guionSeleccionado = localStorage.getItem('guionSeleccionado');
        if (guionSeleccionado) {
            // Llamar a seleccionarGuion con el ID para cargar los datos
            seleccionarGuion(guionSeleccionado);
        } else {
            // Si no hay guion seleccionado, limpiar la tabla
            seleccionarGuion(null);
        }
        return guiones; // Devolver la lista de guiones
    } catch (error) {
        console.error("Error en cargarGuiones:", error);
        Swal.fire({
            icon: 'error',
            title: "Error al cargar los guiones",
            showConfirmButton: false,
            timer: 1000,
        });
        throw error; // Relanzar el error para manejarlo arriba
    }
}

// Función para filtrar guiones en el modal
function filtrarGuiones() {
    const input = document.getElementById('buscarGuion');
    const filter = input.value.toLowerCase();
    const items = document.getElementById('listaGuionesModal').getElementsByClassName('list-group-item');

    for (let i = 0; i < items.length; i++) {
        const title = items[i].getElementsByTagName('h6')[0];
        if (title.textContent.toLowerCase().indexOf(filter) > -1) {
            items[i].style.display = "";
        } else {
            items[i].style.display = "none";
        }
    }
}

async function editarGuion(id) {
    try {
        // Obtener los datos del guion desde el servidor
        const response = await fetch(`/guiones/${id}`);
        const guion = await response.json();

        // Rellenar el formulario con los datos del guion
        document.getElementById('nombreGuion').value = guion.nombre;
        document.getElementById('descripcionGuion').value = guion.descripcion;

        // Cambiar el texto del botón de "Crear Guion" a "Guardar"
        document.getElementById('botonGuardarGuion').textContent = 'Guardar';

        // Mostrar el botón de cancelar (si está oculto)
        document.getElementById('botonCancelar').style.display = 'inline';

        // Guardar el ID del guion que se está editando
        guionEditando = id;

        // Abrir el modal
        $('#formularioGuionModal').modal('show');
    } catch (error) {
        console.error('Error al cargar el guion para editar:', error);
        // Puedes mostrar un mensaje de error al usuario si lo deseas
        alert('Hubo un error al cargar el guion. Por favor, inténtalo de nuevo.');
    }
}

async function guardarGuion(event) {
    event.preventDefault();
    const nombre = document.getElementById('nombreGuion').value;
    const descripcion = document.getElementById('descripcionGuion').value;

    try {
        let nuevoGuionId = null;

        if (guionEditando) {
            // Si se está editando un guion, enviar una solicitud PUT
            await fetch(`/guiones/${guionEditando}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({nombre, descripcion})
            });
        } else {
            // Si no se está editando, enviar una solicitud POST para crear un nuevo guion
            const response = await fetch('/guiones', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({nombre, descripcion})
            });

            // Obtener la respuesta del servidor con el ID del nuevo guion
            const result = await response.json();
            nuevoGuionId = result.id;
        }

        // Limpiar el formulario y restablecer el botón
        cancelarEdicionGiones();

        // Recargar la lista de guiones y esperar a que termine
        await cargarGuiones();
        await cargarGuionesEnSelect(); // Actualizar el <select>

        // Si es un nuevo guion, seleccionarlo automáticamente
        if (nuevoGuionId) {
            seleccionarGuion(nuevoGuionId);

            // Mostrar mensaje de confirmación
            Swal.fire({
                icon: 'success',
                title: 'Guion creado y seleccionado',
                showConfirmButton: false,
                timer: 1500
            });
        }

        // Cerrar el modal
        $('#formularioGuionModal').modal('hide');
    } catch (error) {
        console.error('Error al guardar el guion:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un error al guardar el guion. Por favor, inténtalo de nuevo.',
            showConfirmButton: true
        });
    }
}

function cancelarEdicionGiones() {
    // Limpiar el formulario
    document.getElementById('formularioGuion').reset();
    // Restablecer el botón a "Crear Guion"
    document.getElementById('botonGuardarGuion').textContent = 'Crear Guion';
    document.getElementById('botonCancelar').style.display = 'none';
    // Restablecer la variable de edición
    guionEditando = null;
}

let guionActual = null;

async function seleccionarGuion(id) {
    if (!id) {
        const tbody = document.querySelector('#tablaTextos tbody');
        const encabezado = document.getElementById("encabezado");

        if (tbody) tbody.innerHTML = '';
        if (encabezado) encabezado.textContent = 'Seleccione un guion';

        // También puedes ocultar toda la tabla si prefieres
        document.getElementById('tablaTextos').style.display = 'none';

        // Actualizar información del guion seleccionado
        document.getElementById('guionSeleccionadoInfo').textContent = 'Ningún guion seleccionado';

        return;
    }
    guionActual = id;
    try {
        // 1. Guardar estado actual antes de cambios
        const textoActivoId = localStorage.getItem('ultimoTextoActivo');
        const tablaContainer = document.querySelector('#tablaTextos tbody');
        const scrollPosition = tablaContainer.scrollTop;
        const elementoVisible = document.elementFromPoint(
            window.innerWidth / 2,
            window.innerHeight / 2
        );

        // Obtener ID (prioridad: parámetro > localStorage > null)
        const guionId = id || localStorage.getItem('guionSeleccionado');

        if (!guionId) {
            console.warn("No hay ID de guión proporcionado ni en localStorage");
            return;
        }

        // Actualizar localStorage y UI siempre
        localStorage.setItem('guionSeleccionado', guionId);

        // 2. Elementos del DOM
        const encabezado = document.getElementById("encabezado");
        const guionSelect = document.getElementById("guion_id");
        const tbody = document.querySelector('#tablaTextos tbody');

        if (!encabezado || !guionSelect || !tbody) {
            throw new Error("Elementos del DOM no encontrados");
        }

        guionSelect.value = guionId;

        // 3. Mostrar spinner
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3"><div class="spinner-border text-primary" role="status"></div></td></tr>';

        // 4. Actualizar encabezado
        const opcionSeleccionada = Array.from(guionSelect.options).find(option => option.value == id);
        encabezado.textContent = opcionSeleccionada?.text || "Guión no seleccionado";

        // 5. Obtener datos
        const response = await fetch(`/guiones/${id}`);

        // if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

        const guion = await response.json();

        await cargarTextosEnSelect();

        // 6. Ordenar textos
        guion.textos?.sort((a, b) => (parseInt(a.numero_de_nota) || 0) - (parseInt(b.numero_de_nota) || 0));

        // 7. Limpiar tabla
        tbody.innerHTML = '';

        // 8. Poblar tabla
        let textoActivoEncontrado = false;
        for (const t of guion.textos || []) {
            const filaTexto = document.createElement('tr');
            filaTexto.classList.add('bg-light');
            filaTexto.setAttribute('data-texto-id', t.id);

            if (t.emitido) filaTexto.classList.replace('bg-light', 'bg-secondary');
            else if (t.activo) filaTexto.classList.replace('bg-light', 'bg-warning');

            filaTexto.classList.add('texto-principal');
            filaTexto.dataset.id = t.id;
            filaTexto.innerHTML = `
                <td class="bg-secondary text-white text-center handle" style="cursor: move;">
                    <div style="display: inline-block; padding: 5px 10px;">
                        <h5 class="m-0">${t.numero_de_nota}</h5>
                    </div>
                </td>
                <td>
                    <strong>${t.titulo}</strong>
                    ${t.grabar ? '<div class="text-danger small font-weight-bold">GRABAR</div>' : ''}
                </td>
                <td>${convertirUrlsYPreservarSaltos(t.material || '')}</td>
                <td>${t.musica}</td>
                <td>${t.duracion}</td>
                <td>
                    <div class="btn-group">
                        <button type="button" class="btn btn-outline-primary" onclick="setTextoActivo(${t.id})">
                            <i class="fas fa-arrow-right"></i>
                        </button>
                        <button type="button" class="btn btn-outline-success" onclick="setTextoEmitido(${t.id})">
                            <i class="fas fa-check"></i>
                        </button>
                        <button type="button" class="btn btn-outline-info" onclick="editarTexto(event, ${t.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button type="button" class="btn btn-outline-primary" onclick="abrirModalGraph(${t.id})">
                        <i class="fas fa-plus"></i>
                        </button>
                        <button type="button" class="btn btn-outline-danger" onclick="borrarTexto(${t.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(filaTexto);

            inicializarSortable();

            // 9. Procesar graphs con ordenamiento de bajadas y citas
            if (Array.isArray(t.graphs) && t.graphs.length > 0) {
                t.graphs.forEach((g, index) => {
                    try {
                        const tieneLugar = g.lugar && g.lugar.trim() !== "";
                        const tieneTema = g.tema && g.tema.trim() !== "";

                        console.log(g)

                        // Ordenar bajadas por ID
                        const bajadasOrdenadas = [...(g.bajadas || [])].sort((a, b) => (a.id || 0) - (b.id || 0));
                        const tieneBajadas = bajadasOrdenadas.length > 0;

                        console.log(bajadasOrdenadas);

                        // Ordenar entrevistados y sus citas por ID
                        const entrevistadosOrdenados = [...(g.entrevistados || [])]
                            .sort((a, b) => (a.id || 0) - (b.id || 0))
                            .map(e => ({
                                ...e,
                                citas: [...(e.citas || [])].sort((a, b) => (a.id || 0) - (b.id || 0))
                            }));

                        const tieneEntrevistados = entrevistadosOrdenados.length > 0;

                        // Si no hay ningún dato relevante, no renderizar el Graph
                        if (!tieneLugar && !tieneTema && !tieneBajadas && !tieneEntrevistados) {
                            return;
                        }

                        const filaGraph = document.createElement('tr');
                        filaGraph.classList.add('graph-asociado');

                        // Procesar bajadas ordenadas - CORRECCIÓN: usar la propiedad correcta
                        let bajadasContent = '';
                        if (tieneBajadas) {
                            bajadasContent = `
                            <div class="mb-2">
                                <strong>Bajadas:</strong>
                                <ul>${bajadasOrdenadas.map(b => `<li>${b.texto || b}</li>`).join('')}</ul>
                            </div>
                        `;
                        }

                        // Procesar entrevistados y citas ordenadas
                        let entrevistadosContent = '';
                        if (tieneEntrevistados) {
                            entrevistadosContent = entrevistadosOrdenados.map(e => `
                                <div class="mb-2">
                                    <strong>${e.nombre}:</strong>
                                    <ul class="mb-0">${e.citas.map(c => `<li>${c}</li>`).join('')}</ul>
                                </div>
                            `).join('');
                        }

                        // Texto para copiar (solo incluir campos con datos)
                        const textoParaCopiar = [
                            tieneLugar ? `${g.lugar}` : null,
                            tieneTema ? `${g.tema}` : null,
                            tieneBajadas ? bajadasOrdenadas.map(b => {
                                // Si b es un objeto con propiedad texto, usamos eso, sino usamos b directamente
                                return typeof b === 'object' ? b.texto : b;
                            }).join('\n') : null,
                            tieneEntrevistados ? entrevistadosOrdenados.map(e => {
                                const nombre = e.nombre || 'Entrevistado';
                                const citas = e.citas ? e.citas.map(c => {
                                    // Si c es un objeto con propiedad texto, usamos eso, sino usamos c directamente
                                    return typeof c === 'object' ? c.texto : c;
                                }).join('\n') : '';
                                return `${nombre}\n${citas}`;
                            }).join('\n\n') : null
                        ].filter(Boolean).join('\n\n');

                        filaGraph.innerHTML = `
                            <td></td>
                            <td></td>
                            <td class="bg-light p-0" colspan="4">
                                <details>
                                    <summary class="bg-light" style="cursor: pointer;">
                                        <strong>Graph ${index + 1}</strong>
                                    </summary>
                                    <div class="p-3">
                                        ${tieneLugar ? `<div class="mb-2"><strong>Lugar:</strong> ${g.lugar}</div>` : ''}
                                        ${tieneTema ? `<div class="mb-2"><strong>Tema:</strong> ${g.tema}</div>` : ''}
                                        ${bajadasContent}
                                        ${entrevistadosContent}
                                        <div class="btn-group btn-group-sm mt-2">
                                            <button class="btn btn-outline-info" onclick="editarGraph(${g.id})">
                                                <i class="fas fa-edit"></i> Editar
                                            </button>
                                            <button class="btn btn-outline-danger" onclick="eliminarGraph(${g.id})">
                                                <i class="fas fa-trash"></i> Eliminar
                                            </button>
                                            ${textoParaCopiar.trim() !== '' ? `
                                                <button class="btn btn-outline-primary btn-copiar" 
                                                        data-clipboard-text="${textoParaCopiar.replace(/"/g, '&quot;')}">
                                                    <i class="fas fa-copy"></i> Copiar
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                </details>
                            </td>
                        `;

                        tbody.appendChild(filaGraph);
                    } catch (graphError) {
                        console.error(`Error procesando graph ${g?.id}:`, graphError);
                    }
                });
            }
        }

        // Inicializar ClipboardJS para los botones de copiar
        new ClipboardJS('.btn-copiar');

        // 10. Restaurar posición/scroll
        requestAnimationFrame(() => {
            tablaContainer.scrollTop = scrollPosition;

            // Opcional: Resaltar brevemente el elemento actualizado
            if (elementoVisible && elementoVisible.closest('tr')) {
                const fila = elementoVisible.closest('tr');
                fila.classList.add('updated-highlight');
                setTimeout(() => fila.classList.remove('updated-highlight'), 1000);
            }
        });

        // 11. Actualizar tiempo total
        actualizarTiempoTotal(id);

    } catch (error) {
        console.error("Error en seleccionarGuion:", error);
        const tbody = document.querySelector('#tablaTextos tbody') || document.body;
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger py-3">
                    <i class="fas fa-exclamation-triangle"></i> ${error.message || 'Error al cargar el guión'}
                </td>
            </tr>
        `;

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo cargar el guión',
            showConfirmButton: false,
            timer: 3000
        });
    }
}

async function borrarGuion(id) {
    // Mostrar un cuadro de confirmación con SweetAlert2
    const result = await Swal.fire({
        title: '¿Estás seguro?',
        text: "¡No podrás revertir esta acción!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, borrar',
        cancelButtonText: 'Cancelar',
    });

    // Si el usuario confirma la acción
    if (result.isConfirmed) {
        try {
            const response = await fetch(`/guiones/borrar/${id}`, {
                method: 'DELETE'
            });

            // Verifica si la respuesta es exitosa
            if (!response.ok) {
                const errorData = await response.json(); // Lee el mensaje de error del servidor
                throw new Error(errorData.mensaje || "Error al borrar el guion");
            }

            const result = await response.json(); // Lee la respuesta del servidor

            // Mostrar mensaje de éxito con SweetAlert2
            Swal.fire({
                icon: 'success',
                title: result.mensaje || "Guion borrado correctamente",
                showConfirmButton: false, // No mostrar el botón "Aceptar"
                timer: 1000, // El mensaje desaparecerá después de 2 segundos
            });

            // Actualizar la lista de guiones y el <select>
            cargarGuiones();
            cargarGuionesEnSelect();
        } catch (error) {
            // Mostrar mensaje de error con SweetAlert2
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.message,
                showConfirmButton: false, // No mostrar el botón "Aceptar"
                timer: 3000, // El mensaje desaparecerá después de 3 segundos
            });
        }
    }
}

async function cargarGuionesEnSelect() {
    try {
        const response = await fetch('/guiones');
        const guiones = await response.json();
        const select = document.getElementById('guion_id');
        select.innerHTML = '<option value="">Seleccione un guion</option>';

        guiones.forEach(g => {
            const option = document.createElement('option');
            option.value = g.id;
            option.textContent = g.nombre;
            select.appendChild(option);
        });

        // Establecer el guion seleccionado si existe en localStorage
        const guionSeleccionado = localStorage.getItem('guionSeleccionado');
        if (guionSeleccionado) {
            select.value = guionSeleccionado;
        }

        return guiones; // Devolver la lista de guiones
    } catch (error) {
        console.error('Error al cargar guiones en select:', error);
        throw error;
    }
}


function inicializarSortable() {
    const tbody = document.getElementById('tbodyTextos');
    if (!tbody) return;

    const textoPrincipalSelector = 'tr.texto-principal';
    const graphAsociadoClass = 'graph-asociado';
    let isUpdating = false;

    new Sortable(tbody, {
        animation: 150,
        handle: '.handle',
        filter: '.' + graphAsociadoClass,
        draggable: textoPrincipalSelector,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onStart: function (evt) {
            if (isUpdating) return false;
            evt.item._graphs = [];
            let next = evt.item.nextElementSibling;
            while (next && next.classList.contains(graphAsociadoClass)) {
                evt.item._graphs.push(next);
                next = next.nextElementSibling;
            }
        },
        onEnd: async function (evt) {
            if (isUpdating || !evt.item.classList.contains('texto-principal')) return;
            isUpdating = true;

            // Animación suave para mover los graphs
            if (evt.item._graphs?.length > 0) {
                const targetPosition = evt.newIndex + 1;
                const animationPromises = [];

                evt.item._graphs.forEach((graph, i) => {
                    const newPosition = targetPosition + i;
                    animationPromises.push(new Promise(resolve => {
                        const currentRect = graph.getBoundingClientRect();
                        tbody.insertBefore(graph, tbody.children[newPosition]);
                        const newRect = graph.getBoundingClientRect();

                        const invertX = currentRect.left - newRect.left;
                        const invertY = currentRect.top - newRect.top;

                        const animation = graph.animate([
                            {transform: `translate(${invertX}px, ${invertY}px)`},
                            {transform: 'translate(0, 0)'}
                        ], {
                            duration: 150,
                            easing: 'ease-out'
                        });

                        animation.onfinish = resolve;
                    }));
                });

                await Promise.all(animationPromises);
            }

            // Actualización optimizada de números
            const updateNumbers = () => {
                const textos = tbody.querySelectorAll(textoPrincipalSelector);
                const textosIds = [];

                textos.forEach((tr, index) => {
                    textosIds.push(parseInt(tr.dataset.id));
                    const numElement = tr.querySelector('.handle h3');
                    if (numElement) {
                        numElement.textContent = index + 1;
                    }
                });

                return textosIds;
            };

            const textosIds = updateNumbers();

            try {
                await actualizarNumerosNota(textosIds);
            } catch (error) {
                console.error('Error updating numbers:', error);
            } finally {
                isUpdating = false;
            }
        }
    });
}

// Función para actualizar los números de nota
async function actualizarNumerosNota(textosIds) {
    try {
        const response = await fetch('/textos/actualizar-orden', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                guion_id: guionActual,
                nuevos_orden: textosIds
            })
        });

        if (!response.ok) throw new Error('Error al actualizar el orden');

        // Recargar solo si es necesario
        if (guionActual) {
            await seleccionarGuion(guionActual);
        }
    } catch (error) {
        console.error('Error al actualizar orden:', error);
        // Mostrar error pero no recargar para no perder la posición
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo guardar el nuevo orden',
            showConfirmButton: false,
            timer: 2000
        });
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const id = localStorage.getItem('guionSeleccionado');
    if (id) {
        seleccionarGuion(id);
    } else {
        // Limpiar la tabla si no hay guion seleccionado
        seleccionarGuion(null);
    }
});

$(document).ready(function () {
    $('#modalClonarNotas').on('shown.bs.modal', function () {
        console.log('Modal visible, cargando datos...');
        cargarNotasYGuiones();
    });
});

// Variables globales
let notasDisponibles = [];
let guionesDisponibles = [];

let modalCargado = false;

$('#modalClonarNotas').on('show.bs.modal', function () {
    if (!modalCargado) {
        setTimeout(() => {
            cargarNotasYGuiones();
            modalCargado = true;
        }, 300);
    }
});

// Resetear cuando se cierra el modal
$('#modalClonarNotas').on('hidden.bs.modal', function () {
    modalCargado = false;

    // Limpiar para la próxima vez
    notasDisponibles = [];
    guionesDisponibles = [];

    const container = document.getElementById('listaNotasClonar');
    const select = document.getElementById('guionDestinoClonar');

    if (container) container.innerHTML = '';
    if (select) select.innerHTML = '<option value="">Seleccionar guion destino</option>';
});

// Función para cargar notas del guion actual y otros guiones
async function cargarNotasYGuiones() {
    try {
        const guionActualId = localStorage.getItem('guionSeleccionado');

        if (!guionActualId) {
            throw new Error('No hay ningún guion seleccionado. Por favor, selecciona un guion primero.');
        }

        // Ejecutar ambas peticiones en paralelo
        const [notasResponse, guionesResponse] = await Promise.all([
            fetch(`/guiones/${guionActualId}`),
            fetch(`/guiones/obtener_guiones?excluir_actual=${guionActualId}`)
        ]);

        // Verificar respuestas
        if (!notasResponse.ok) throw new Error(`Error al cargar notas: ${notasResponse.status}`);
        if (!guionesResponse.ok) throw new Error(`Error al cargar guiones: ${guionesResponse.status}`);

        // Procesar respuestas
        const guionData = await notasResponse.json();
        const guionesData = await guionesResponse.json();

        // Asegurarnos de usar la propiedad correcta (textos con x)
        notasDisponibles = guionData.textos || [];
        guionesDisponibles = guionesData;

        // Actualizar interfaz
        actualizarListaNotas();
        actualizarSelectGuiones();
        actualizarResumen();

    } catch (error) {
        console.error('Error:', error);
        mostrarErrorEnModal(error.message);

        // Mostrar error en la lista
        const container = document.getElementById('listaNotasClonar');
        if (container) {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Error:</strong> ${error.message}
                </div>
            `;
        }

        // Mostrar error en el select
        const select = document.getElementById('guionDestinoClonar');
        if (select) {
            select.innerHTML = '<option value="">Error al cargar</option>';
        }
    }
}

// Función para probar las rutas manualmente
async function probarRutas() {
    try {
        const guionActualId = localStorage.getItem('guionSeleccionado');
        console.log('=== PRUEBA DE RUTAS ===');

        // Probar ruta de guiones
        console.log('Probando /guiones/obtener_guiones...');
        const response = await fetch(`/guiones/obtener_guiones?excluir_actual=${guionActualId}`);
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        const data = await response.json().catch(e => console.log('No JSON response:', e));
        console.log('Data:', data);

    } catch (error) {
        console.error('Error en prueba de rutas:', error);
    }
}

// Actualizar lista de notas
function actualizarListaNotas() {
    const container = document.getElementById('listaNotasClonar');
    if (!container) return;

    if (notasDisponibles.length === 0) {
        container.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-info-circle"></i>
                No hay notas disponibles en el guion actual.
            </div>
        `;
        return;
    }

    let html = '';
    notasDisponibles.forEach(nota => {
        html += `
            <div class="form-check">
                <input class="form-check-input nota-checkbox" type="checkbox" 
                       value="${nota.id}" id="nota-${nota.id}" onchange="actualizarResumen()">
                <label class="form-check-label" for="nota-${nota.id}" style="cursor: pointer;">
                    <strong>Nota ${nota.numero_de_nota}:</strong> ${nota.titulo}
                    ${nota.graphs && nota.graphs.length > 0 ?
            `<span class="badge badge-info ml-1">${nota.graphs.length} graph(s)</span>` : ''}
                </label>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Actualizar select de guiones destino
function actualizarSelectGuiones() {
    const select = document.getElementById('guionDestinoClonar');
    if (!select) return;

    if (guionesDisponibles.length === 0) {
        select.innerHTML = '<option value="">No hay otros guiones disponibles</option>';
        return;
    }

    let html = '<option value="">Seleccionar guion destino</option>';
    guionesDisponibles.forEach(guion => {
        html += `<option value="${guion.id}">${guion.nombre}</option>`;
    });

    select.innerHTML = html;
    select.onchange = actualizarResumen;
}

// Mostrar error en el modal
function mostrarErrorEnModal(mensaje) {
    const errorDiv = document.getElementById('errorModal');
    const errorText = document.getElementById('errorText');

    if (errorDiv && errorText) {
        errorText.textContent = mensaje;
        errorDiv.classList.remove('d-none');
    }
}

// Actualizar resumen y habilitar/deshabilitar botón
function actualizarResumen() {
    const notasSeleccionadas = document.querySelectorAll('.nota-checkbox:checked');
    const guionDestinoId = document.getElementById('guionDestinoClonar').value;
    const btnClonar = document.getElementById('btnClonarNotas');
    const resumen = document.getElementById('resumenClonacion');

    if (notasSeleccionadas.length > 0 && guionDestinoId) {
        const guionDestino = guionesDisponibles.find(g => g.id == guionDestinoId);
        resumen.innerHTML = `
            <i class="fas fa-check-circle text-success"></i> 
            <strong>Listo para clonar:</strong><br>
            • ${notasSeleccionadas.length} nota(s) seleccionada(s)<br>
            • Guion destino: <strong>${guionDestino.nombre}</strong>
        `;
        resumen.className = 'alert alert-success';
        btnClonar.disabled = false;
    } else {
        if (notasSeleccionadas.length === 0) {
            resumen.innerHTML = '<i class="fas fa-info-circle"></i> Selecciona al menos una nota para clonar.';
        } else {
            resumen.innerHTML = '<i class="fas fa-info-circle"></i> Selecciona un guion destino.';
        }
        resumen.className = 'alert alert-info';
        btnClonar.disabled = true;
    }
}

// Seleccionar/Deseleccionar todas las notas
function seleccionarTodasNotas() {
    document.querySelectorAll('.nota-checkbox').forEach(checkbox => {
        checkbox.checked = true;
    });
    actualizarResumen();
}

function deseleccionarTodasNotas() {
    document.querySelectorAll('.nota-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    actualizarResumen();
}

// Función para clonar las notas
async function clonarNotas() {
    const notasSeleccionadas = Array.from(document.querySelectorAll('.nota-checkbox:checked'))
        .map(checkbox => checkbox.value);

    const guionDestinoId = document.getElementById('guionDestinoClonar').value;

    if (notasSeleccionadas.length === 0 || !guionDestinoId) {
        alert('Selecciona al menos una nota y un guion destino');
        return;
    }

    const guionActualId = localStorage.getItem('guionSeleccionado');
    const guionDestino = guionesDisponibles.find(g => g.id == guionDestinoId);

    // Mostrar confirmación
    const confirmacion = await Swal.fire({
        title: '¿Confirmar clonación?',
        html: `¿Estás seguro de clonar <b>${notasSeleccionadas.length} nota(s)</b> al guion <b>${guionDestino.nombre}</b>?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, clonar',
        cancelButtonText: 'Cancelar'
    });

    if (!confirmacion.isConfirmed) return;

    // Mostrar loader
    Swal.fire({
        title: 'Clonando notas...',
        text: 'Por favor espera',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const response = await fetch(`/guiones/clonar_notas/${guionActualId}/${guionDestinoId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                notas_seleccionadas: notasSeleccionadas
            })
        });

        const result = await response.json();

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: '¡Éxito!',
                html: result.mensaje,
                confirmButtonText: 'Aceptar'
            });

            // Cerrar modal
            $('#modalClonarNotas').modal('hide');

            // Si el guion destino es el actual, recargar
            if (guionDestinoId === localStorage.getItem('guionSeleccionado')) {
                seleccionarGuion(guionDestinoId);
            }

        } else {
            throw new Error(result.error || 'Error desconocido');
        }

    } catch (error) {
        console.error('Error al clonar notas:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Error al clonar las notas: ' + error.message
        });
    }
}

// Función para preservar saltos de línea (convertir \n a <br>)
function preservarSaltosDeLinea(texto) {
    if (!texto) return '';
    return texto.replace(/\n/g, '<br>');
}

// Función combinada que convierte URLs y preserva saltos
function convertirUrlsYPreservarSaltos(texto) {
    if (!texto) return '';
    const textoConSaltos = preservarSaltosDeLinea(texto);
    return convertirUrlsEnEnlaces(textoConSaltos);
}
