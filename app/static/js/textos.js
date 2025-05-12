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
    // 2. Lógica para restaurar el guion seleccionado y cargar los textos
    const guion_id = localStorage.getItem('guionSeleccionado');
    if (guion_id) {
        document.getElementById('guion_id').value = guion_id;
    }

    try {
        const url = textoEditando ? `/textos/editar/${textoEditando}` : '/textos';
        const method = textoEditando ? 'PUT' : 'POST';

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
    await fetch(`/textos/activo/${id}`, {
        method: 'PUT'
    });
    const guion_id = localStorage.getItem('guionSeleccionado');
    seleccionarGuion(guion_id);
}

async function setTextoEmitido(id) {
    await fetch(`/textos/emitido/${id}`, {
        method: 'PUT'
    });
    const guion_id = document.getElementById('guion_id').value;
    seleccionarGuion(guion_id);
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