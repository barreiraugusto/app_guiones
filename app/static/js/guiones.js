async function cargarGuiones() {
    try {
        const response = await fetch('/guiones');
        if (!response.ok) throw new Error('Error al cargar los guiones');
        const guiones = await response.json();

        // Cargar los guiones en tarjetas Bootstrap en una columna
        const contenedor = document.getElementById('listaGuiones');
        contenedor.innerHTML = '';
        guiones.forEach(g => {
            const cardWrapper = document.createElement('div');
            cardWrapper.className = 'mb-3'; // Margen inferior entre tarjetas
            cardWrapper.innerHTML = `
        <div class="card card-guion">
            <div class="card-body">
                <h6 class="card-title">${g.nombre}</h6>
<!--                <p class="card-text">${g.descripcion}</p>-->
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-success" onclick="seleccionarGuion(${g.id})">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-outline-info" onclick="editarGuion(${g.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-outline-danger" onclick="borrarGuion(${g.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
            contenedor.appendChild(cardWrapper);
        });

        // Cargar los guiones en el <select>
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
    } catch (error) {
        console.error("Error en cargarGuiones:", error); // Debug 4
        Swal.fire({
            icon: 'success',
            title: result.mensaje || "Error al cargar los guiones",
            showConfirmButton: false, // No mostrar el botón "Aceptar"
            timer: 1000, // El mensaje desaparecerá después de 2 segundos
        });
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
            await fetch('/guiones', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({nombre, descripcion})
            });
        }

        // Limpiar el formulario y restablecer el botón
        cancelarEdicionGiones();

        // Recargar la lista de guiones
        cargarGuiones();
        cargarGuionesEnSelect(); // Actualizar el <select>

        // Cerrar el modal
        $('#formularioGuionModal').modal('hide');
    } catch (error) {
        console.error('Error al guardar el guion:', error);
        // Puedes mostrar un mensaje de error al usuario si lo deseas
        alert('Hubo un error al guardar el guion. Por favor, inténtalo de nuevo.');
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

async function seleccionarGuion(id) {
    try {
        // 1. Validar elementos del DOM
        const encabezado = document.getElementById("encabezado");
        const guionSelect = document.getElementById("guion_id");
        const tbody = document.querySelector('#tablaTextos tbody');

        if (!encabezado || !guionSelect || !tbody) {
            throw new Error("Elementos del DOM no encontrados");
        }

        guionSelect.value = id;

        // 2. Mostrar estado de carga
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3"><div class="spinner-border text-primary" role="status"></div></td></tr>';

        // 3. Guardar selección actual
        const textoIdSeleccionado = document.getElementById('texto_id')?.value;

        // 4. Actualizar encabezado
        const opcionSeleccionada = Array.from(guionSelect.options).find(option => option.value == id);
        encabezado.textContent = opcionSeleccionada?.text || "Guión no seleccionado";

        // 5. Obtener datos del guión
        const response = await fetch(`/guiones/${id}`);

        if (!response.ok) {
            throw new Error(`Error al cargar guión: ${response.statusText}`);
        }

        const guion = await response.json();

        localStorage.setItem('guionSeleccionado', id);
        await cargarTextosEnSelect();

        if (guionSelect && !guionSelect._listenerAdded) {
            guionSelect.addEventListener('change', cargarTextosEnSelect);
            guionSelect._listenerAdded = true;
        }

        // 6. Validar estructura de la respuesta
        if (!guion || typeof guion !== 'object') {
            throw new Error("Respuesta inválida del servidor");
        }

        if (!Array.isArray(guion.textos)) {
            console.warn("La propiedad 'textos' no es un array", guion);
            guion.textos = [];
        }

        // ORDENAR LOS TEXTOS POR numero_de_nota
        guion.textos.sort((a, b) => {
            const notaA = parseInt(a.numero_de_nota) || 0;
            const notaB = parseInt(b.numero_de_nota) || 0;
            return notaA - notaB;
        });

        // 7. Limpiar y poblar la tabla
        tbody.innerHTML = '';

        if (guion.textos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3">No hay textos en este guión</td></tr>';
            return;
        }

        // 8. Procesar cada texto
        for (const t of guion.textos) {
            try {
                // Crear fila de texto
                const filaTexto = document.createElement('tr');
                filaTexto.classList.add('bg-light');

                if (t.emitido) {
                    filaTexto.classList.replace('bg-light', 'bg-secondary');
                } else if (t.activo) {
                    filaTexto.classList.replace('bg-light', 'bg-warning');
                }

                const materialContent = convertirUrlsEnEnlaces(t.material || '');

                filaTexto.innerHTML = `
                    <td class="bg-secondary text-white text-center"><h3>${t.numero_de_nota}</h3></td>
                    <td><strong>${t.titulo}</strong></td>
                    <td>${materialContent}</td>
                    <td>${t.musica}</td>
                    <td>${t.duracion}</td>
                    <td>
                        <div class="btn-group">
                            <button type="button" class="btn btn-outline-warning" onclick="setTextoActivo(${t.id})">
                                <i class="fas fa-arrow-right"></i>
                            </button>
                            <button type="button" class="btn btn-outline-success" onclick="setTextoEmitido(${t.id})">
                                <i class="fas fa-check"></i>
                            </button>
                            <button type="button" class="btn btn-outline-info" onclick="editarTexto(event, ${t.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button type="button" class="btn btn-outline-danger" onclick="borrarTexto(${t.id})">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                `;
                tbody.appendChild(filaTexto);

                // 9. Procesar graphs del texto
                if (Array.isArray(t.graphs) && t.graphs.length > 0) {
                    t.graphs.forEach((g, index) => {
                        try {
                            const tieneLugar = g.lugar && g.lugar.trim() !== "";
                            const tieneTema = g.tema && g.tema.trim() !== "";
                            const tieneBajadas = Array.isArray(g.bajadas) && g.bajadas.length > 0;
                            const tieneEntrevistados = Array.isArray(g.entrevistados) && g.entrevistados.length > 0;

                            // Si no hay ningún dato relevante, no renderizar el Graph
                            if (!tieneLugar && !tieneTema && !tieneBajadas && !tieneEntrevistados) {
                                return;
                            }

                            const filaGraph = document.createElement('tr');

                            // Procesar bajadas (solo si existen)
                            let bajadasContent = '';
                            if (tieneBajadas) {
                                bajadasContent = `
                                    <div class="mb-2">
                                        <strong>Bajadas:</strong>
                                        <ul>${g.bajadas.map(b => `<li>${b}</li>`).join('')}</ul>
                                    </div>
                                `;
                            }

                            // Procesar entrevistados y citas
                            let entrevistadosContent = '';
                            if (g.entrevistados && g.entrevistados.length > 0) {
                                entrevistadosContent = g.entrevistados.map(e => `
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
                                tieneBajadas ? `${g.bajadas.map(b => `${b}`).join('\n')}` : null,
                                tieneEntrevistados ? `${g.entrevistados.map(e =>
                                    `${e.nombre}\n${(e.citas || []).map(c => `${c}`).join('\n')}`
                                ).join('\n')}` : null
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
            } catch (textoError) {
                console.error(`Error procesando texto ${t?.id}:`, textoError);
            }
        }

        // 10. Inicializar clipboard.js
        new ClipboardJS('.btn-copiar');

        // 11. Restaurar selección de texto
        if (textoIdSeleccionado) {
            const selectTexto = document.getElementById('texto_id');
            if (selectTexto) {
                const opcionExiste = Array.from(selectTexto.options).some(option => option.value === textoIdSeleccionado);
                if (opcionExiste) {
                    selectTexto.value = textoIdSeleccionado;
                }
            }
        }

        // 12. Actualizar tiempo total
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
    const response = await fetch('/guiones');
    const guiones = await response.json();
    const select = document.getElementById('guion_id');
    select.innerHTML = '<option value="">Seleccione un guion</option>'; // Opción por defecto
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
}
