async function cargarTextos() {
    const response = await fetch('/textos');
    const textos = await response.json();

    // Ordenar los textos por "numero_de_nota" de menor a mayor
    textos.sort((a, b) => a.numero_de_nota - b.numero_de_nota);

    const tbody = document.querySelector('#tablaTextos tbody');
    tbody.innerHTML = ''; // Limpiar la tabla antes de llenarla

    textos.forEach(t => {
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
    });
}

async function guardarTexto(event) {
    event.preventDefault();

    // Obtener los valores del formulario
    const numeroDeNota = document.getElementById('numero_de_nota').value;
    const titulo = document.getElementById('titulo').value;
    const duracion = document.getElementById('duracion').value;
    const contenido = quill.root.innerHTML; // Obtener el contenido de Quill
    const material = document.getElementById('material').value;
    const musica = document.getElementById('musica').value;
    const grabar = document.getElementById('grabar').checked;
    // 2. Lógica para restaurar el guion seleccionado y cargar los textos
    const guion_id = localStorage.getItem('guionSeleccionado');
    if (guion_id) {
        document.getElementById('guion_id').value = guion_id;
    }

    try {
        const url = textoEditando ? `/textos/editar/${textoEditando}` : '/textos';
        const method = textoEditando ? 'PUT' : 'POST';

        console.log('Valor de grabar al guardar:', document.getElementById('grabar').checked);

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                numero_de_nota: numeroDeNota,
                titulo: titulo,
                duracion: duracion,
                contenido: contenido,
                musica: musica,
                material: material,
                grabar: grabar,
                guion_id: guion_id
            })
        });

        if (!response.ok) {
            throw new Error('Error al guardar el texto');
        }

        const result = await response.json();

        Swal.fire({
            icon: 'success',
            title: result.mensaje || "Texto guardado correctamente",
            showConfirmButton: false, // No mostrar el botón "Aceptar"
            timer: 1000, // El mensaje desaparecerá después de 2 segundos
        });

        // Limpiar el formulario y restablecer el botón
        cancelarEdicion();

        // Actualizar el <select> de textos
        await cargarTextosEnSelect();

        // Recargar la lista de textos en la tabla

        if (guion_id) {
            seleccionarGuion(guion_id);
        } else {
            cargarTextos();
        }
    } catch (error) {
        console.error('Error al guardar el texto:', error);

        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Hubo un error al guardar el texto. Por favor, inténtalo de nuevo.',
            showConfirmButton: false, // No mostrar el botón "Aceptar"
            timer: 1000, // El mensaje desaparecerá después de 3 segundos
        });
    }
}

async function editarTexto(event, id) {
    event.stopPropagation();
    const response = await fetch(`/textos/${id}`);
    const texto = await response.json();

    // Rellenar el formulario con los datos del texto
    document.getElementById('grabar').checked = texto.grabar || false;
    document.getElementById('numero_de_nota').value = texto.numero_de_nota;
    document.getElementById('titulo').value = texto.titulo;
    document.getElementById('duracion').value = texto.duracion;
    quill.root.innerHTML = texto.contenido;
    document.getElementById('material').value = texto.material || '';
    document.getElementById('guion_id').value = texto.guion_id;
    document.getElementById('musica').value = texto.musica;

    document.getElementById('botonGuardarTexto').textContent = 'Guardar';
    document.getElementById('botonCancelar').style.display = 'inline';
    textoEditando = id;

    const formularioDiv = document.getElementById('formularioTextoContainer');
    if (formularioDiv) {
        formularioDiv.scrollIntoView({behavior: 'smooth', block: 'start'});
    }
}

async function borrarTexto(id) {
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
            const response = await fetch(`/textos/borrar/${id}`, {
                method: 'DELETE'
            });

            // Verifica si la respuesta es exitosa
            if (!response.ok) {
                const errorData = await response.json(); // Lee el mensaje de error del servidor
                throw new Error(errorData.mensaje || "Error al borrar el texto");
            }

            const result = await response.json(); // Lee la respuesta del servidor

            // Mostrar mensaje de éxito con SweetAlert2
            Swal.fire({
                icon: 'success',
                title: result.mensaje || "Texto borrado correctamente",
                showConfirmButton: false, // No mostrar el botón "Aceptar"
                timer: 1000, // El mensaje desaparecerá después de 2 segundos
            });

            // Actualiza la interfaz de usuario
            const guion_id = document.getElementById('guion_id').value;
            if (guion_id) {
                seleccionarGuion(guion_id); // Recargar la tabla de textos
            } else {
                cargarTextos(); // Si no hay guion seleccionado, recargar todos los textos
            }
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

function cancelarEdicion() {
    // Limpiar el formulario
    document.getElementById('formularioTexto').reset();

    // Limpiar el editor Quill
    quill.root.innerHTML = ''; // Vaciar el contenido del editor

    // Restablecer el botón a "Agregar"
    document.getElementById('botonGuardarTexto').textContent = 'Agregar';
    document.getElementById('botonCancelar').style.display = 'none';

    // Restablecer la variable de edición
    textoEditando = null;
}

async function setTextoActivo(id) {
    try {
        // 1. Guardar posición del scroll
        const tablaContainer = document.querySelector('#tablaTextos tbody');
        const scrollPosition = tablaContainer.scrollTop;

         // 2. Actualizar todos los textos que tengan bg-warning
        document.querySelectorAll('tr.texto-principal.bg-warning').forEach(tr => {
            // Solo cambiar si no es el texto que vamos a activar
            if (tr.dataset.textoId !== id.toString()) {
                tr.classList.remove('bg-warning', 'activo');

                // Verificar si está emitido para aplicar el color correcto
                if (tr.classList.contains('emitido')) {
                    tr.classList.add('bg-secondary');
                } else {
                    tr.classList.add('bg-light');
                }
            }
        });

        // 3. Activar el nuevo texto
        const filaActual = document.querySelector(`tr[data-texto-id="${id}"]`);
        if (filaActual) {
            // Remover todas las clases de estado primero
            filaActual.classList.remove('bg-light', 'bg-secondary', 'bg-warning');

            // Aplicar clases según estado
            if (filaActual.classList.contains('emitido')) {
                filaActual.classList.add('bg-secondary', 'activo');
            } else {
                filaActual.classList.add('bg-warning', 'activo');
            }
        }

        // 4. Actualizar en el servidor
        const response = await fetch(`/textos/activo/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.content || ''
            }
        });

        if (!response.ok) throw new Error(await response.text() || 'Error al activar texto');

        // 5. Actualizar graphs asociados
        actualizarEstadoGraphs(id, 'activo');

        // 6. Restaurar posición del scroll
        requestAnimationFrame(() => {
            tablaContainer.scrollTop = scrollPosition;
        });

    } catch (error) {
        console.error("Error en setTextoActivo:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo activar el texto',
            timer: 2000
        });
    }
}

async function setTextoEmitido(id) {
    try {
        const filaActual = document.querySelector(`tr[data-texto-id="${id}"]`);
        if (filaActual) {
            // Cambiar estado visual inmediatamente
            if (filaActual.classList.contains('bg-secondary')) {
                filaActual.classList.remove('bg-secondary');
                filaActual.classList.add('bg-light');
            } else {
                filaActual.classList.remove('bg-light', 'bg-warning');
                filaActual.classList.add('bg-secondary');
            }
        }

        // Actualizar en el servidor
        const response = await fetch(`/textos/emitido/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.content || ''
            }
        });

        if (!response.ok) throw new Error(await response.text() || 'Error al marcar texto como emitido');

        // Actualizar graphs asociados
        actualizarEstadoGraphs(id, 'emitido');

    } catch (error) {
        console.error("Error en setTextoEmitido:", error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'No se pudo marcar el texto como emitido',
            timer: 2000
        });
    }
}

function actualizarEstadoGraphs(textoId, estado) {
    const filaTexto = document.querySelector(`tr[data-texto-id="${textoId}"]`);
    if (!filaTexto) return;

    // Encontrar todos los graphs asociados (filas siguientes hasta el próximo texto)
    let nextSibling = filaTexto.nextElementSibling;
    while (nextSibling && nextSibling.classList.contains('graph-asociado')) {
        if (estado === 'activo') {
            nextSibling.querySelector('details').style.backgroundColor = '#fff3cd';
        } else if (estado === 'emitido') {
            nextSibling.querySelector('details').style.backgroundColor = '#e2e3e5';
        } else {
            nextSibling.querySelector('details').style.backgroundColor = '#f8f9fa';
        }
        nextSibling = nextSibling.nextElementSibling;
    }
}

// Función para cargar textos en el <select>
async function cargarTextosEnSelect() {
    try {
        // Obtener el guion_id seleccionado actualmente
        const guion_id = document.getElementById('guion_id').value;

        if (!guion_id) {
            console.log("No hay guion seleccionado");
            return;
        }

        const response = await fetch(`/textos/por-guion/${guion_id}`);
        if (!response.ok) {
            throw new Error('Error al cargar los textos');
        }
        const textos = await response.json();

        const selectTexto = document.getElementById('texto_id');
        selectTexto.innerHTML = '<option value="">Selecciona una Nota</option>'; // Opción por defecto

        textos.forEach(t => {
            const option = document.createElement('option');
            option.value = t.id;
            option.textContent = `Nota: ${t.numero_de_nota} - ${t.titulo}`;
            selectTexto.appendChild(option);
        });

        // Restaurar el texto seleccionado si existe en localStorage
        const textoSeleccionado = localStorage.getItem('textoSeleccionado');
        if (textoSeleccionado) {
            selectTexto.value = textoSeleccionado;
        }
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Hubo un error al cargar los textos. Por favor, inténtalo de nuevo.',
            showConfirmButton: false,
            timer: 3000,
        });
    }
}

function convertirUrlsEnEnlaces(texto) {
    // Expresión regular para detectar URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    return texto.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
}

function inicializarEstadosTextos() {
    document.querySelectorAll('tr.texto-principal').forEach(tr => {
        // Limpiar clases de estado primero
        tr.classList.remove('bg-light', 'bg-warning', 'bg-secondary', 'activo', 'emitido');

        // Establecer estado inicial basado en datos
        const esActivo = tr.classList.contains('activo');
        const esEmitido = tr.classList.contains('emitido');

        if (esActivo && esEmitido) {
            tr.classList.add('bg-secondary', 'activo', 'emitido');
        } else if (esActivo) {
            tr.classList.add('bg-warning', 'activo');
        } else if (esEmitido) {
            tr.classList.add('bg-secondary', 'emitido');
        } else {
            tr.classList.add('bg-light');
        }
    });
}

// Llamar esta función al cargar la página
document.addEventListener('DOMContentLoaded', inicializarEstadosTextos);