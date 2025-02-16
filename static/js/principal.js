let guionEditando = null;
let textoEditando = null;

// Al cargar la página, establecer el guion seleccionado
window.addEventListener('load', () => {
    const guionSeleccionado = localStorage.getItem('guionSeleccionado');
    if (guionSeleccionado) {
        document.getElementById('guion_id').value = guionSeleccionado;
        seleccionarGuion(guionSeleccionado); // Cargar los textos del guion seleccionado
    }
});

// Cargar la lista de guiones al iniciar la página
cargarGuiones();
cargarGuionesEnSelect(); // Llenar el <select> con los guiones

async function cargarGuiones() {
    try {
        const response = await fetch('/guiones');
        if (!response.ok) throw new Error('Error al cargar los guiones');
        const guiones = await response.json();

        // Cargar la lista de guiones en el <ul>
        const lista = document.getElementById('listaGuiones');
        lista.innerHTML = '';
        guiones.forEach(g => {
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>${g.nombre}</strong><br>
                <em>${g.descripcion}</em><br>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-success" onclick="seleccionarGuion(${g.id})"><i class="fas fa-check"></i></button>
                    <button class="btn btn-outline-secondary" onclick="editarGuion(${g.id})"><i class="fas fa-edit"></i> </button>
                    <button class="btn btn-outline-danger" onclick="borrarGuion(${g.id})"><i class="fas fa-trash"></i></button>
                </div>
            `;
            lista.appendChild(li);
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
    const encabezado = document.getElementById("encabezado");
    const guionSelect = document.getElementById("guion_id");

    // Actualizar el encabezado con el nombre del guion seleccionado
    const opcionSeleccionada = Array.from(guionSelect.options).find(option => option.value == id);
    if (opcionSeleccionada) {
        encabezado.textContent = `${opcionSeleccionada.text}`;
    } else {
        encabezado.textContent = "";
    }

    // Obtener los datos del guion desde el backend
    const response = await fetch(`/guiones/${id}`);
    const guion = await response.json();

    // Ordenar los textos por "numero_de_nota"
    guion.textos.sort((a, b) => a.numero_de_nota - b.numero_de_nota);

    // Limpiar la tabla de textos
    const tbody = document.querySelector('#tablaTextos tbody');
    tbody.innerHTML = '';

    // Mostrar los textos en la tabla
    guion.textos.forEach(t => {
        // Crear la fila del texto
        const filaTexto = document.createElement('tr');
        if (t.activo) {
            filaTexto.classList.add('bg-success'); // Resaltar el texto activo
        }

        const materialContent = convertirUrlsEnEnlaces(t.material || '');

        filaTexto.innerHTML = `
            <td><strong>${t.titulo}</strong></td>
            <td>${t.contenido}</td>
            <td>${materialContent}</td>
            <td><h3>${t.numero_de_nota}</h3></td>
            <td>
                <div class="btn-group-vertical">
                    <button type="button" class="btn btn-outline-success" onclick="setTextoActivo(${t.id})"><i class="fas fa-check"></i></button>
                    <button type="button" class="btn btn-outline-secondary" onclick="editarTexto(event, ${t.id})"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn btn-outline-danger" onclick="borrarTexto(${t.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(filaTexto); // Agregar la fila del texto a la tabla

        // Cargar los graphs asociados a este texto
        if (t.graphs && t.graphs.length > 0) {
            // Inicializar el contador de Graphs para este texto
            let contadorGraph = 1;

            t.graphs.forEach(g => {
                const filaGraph = document.createElement('tr');

                // Crear el texto que se copiará al portapapeles
                const textoParaCopiar = `${g.lugar}\n${g.tema}\n${g.entrevistado}\n${g.primera_linea}\n${g.segunda_linea}`;

                filaGraph.innerHTML = `
            <td></td>
            <td class="bg-light" colspan="4">
                <strong>Graph ${contadorGraph}</strong><br>
                <hr>
                <strong>Lugar:</strong> ${g.lugar}<br>
                <strong>Tema:</strong> ${g.tema}<br>
                <strong>Entrevistado:</strong> ${g.entrevistado}<br>
                <strong>Primera Línea:</strong> ${g.primera_linea}<br>
                <strong>Segunda Línea:</strong> ${g.segunda_linea}<br>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" onclick="editarGraph(${g.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline-danger" onclick="eliminarGraph(${g.id})"><i class="fas fa-trash"></i></button>
                    <button class="btn btn-outline-primary btn-copiar" data-clipboard-text="${textoParaCopiar.replace(/"/g, '&quot;')}"><i class="fas fa-copy"></i></button>
                </div>
            </td>
        `;
                tbody.appendChild(filaGraph); // Insertar el graph debajo del texto

                // Incrementar el contador para el próximo Graph
                contadorGraph++;
            });

            // Inicializar clipboard.js
            new ClipboardJS('.btn-copiar');
        }
    });

    // Guardar el guion seleccionado en localStorage
    document.getElementById('guion_id').value = id;
    localStorage.setItem('guionSeleccionado', id);

    // Cargar los textos en el <select> de textos
    cargarTextosEnSelect(id);
}

function convertirUrlsEnEnlaces(texto) {
    // Expresión regular para detectar URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    return texto.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
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

async function cargarTextos() {
    const response = await fetch('/textos');
    const textos = await response.json();

    // Ordenar los textos por "numero_de_nota" de menor a mayor
    textos.sort((a, b) => a.numero_de_nota - b.numero_de_nota);

    const tbody = document.querySelector('#tablaTextos tbody');
    tbody.innerHTML = ''; // Limpiar la tabla antes de llenarla

    textos.forEach(t => {
        const fila = document.createElement('tr');
        if (t.activo) {
            fila.classList.add('bg-success'); // Resaltar la fila del texto activo
        }
        fila.innerHTML = `
            <td><strong>${t.titulo}</strong></td>
            <td>${t.contenido}</td>
            <td>${t.material || ''}</td>
            <td><h3>${t.numero_de_nota}</h3></td>
            <td>
                <div class="btn-group-vertical">
                    <button type="button" class="btn btn-outline-success" onclick="setTextoActivo(${t.id})"><i class="fas fa-check"></i></button>
                    <button type="button" class="btn btn-outline-secondary" onclick="editarTexto(event, ${t.id})"><i class="fas fa-edit"></i></button>
                    <button type="button" class="btn btn-outline-danger" onclick="borrarTexto(${t.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(fila);
    });
}

async function guardarTexto(event) {
    event.preventDefault();

    // Obtener los valores del formulario
    const numeroDeNota = document.getElementById('numero_de_nota').value;
    const titulo = document.getElementById('titulo').value;
    const contenido = quill.root.innerHTML; // Obtener el contenido de Quill
    const material = document.getElementById('material').value;
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
                contenido: contenido,
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
    quill.root.innerHTML = texto.contenido;
    document.getElementById('material').value = texto.material || '';
    document.getElementById('guion_id').value = texto.guion_id;

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

// Función para cargar textos en el <select>
async function cargarTextosEnSelect(guion_id = null) {
    try {
        const response = await fetch('/textos');
        if (!response.ok) {
            throw new Error('Error al cargar los textos');
        }
        const textos = await response.json();

        const selectTexto = document.getElementById('texto_id');
        selectTexto.innerHTML = '<option value="">Selecciona una Nota</option>'; // Opción por defecto

        // Filtrar textos por guion_id (si se proporciona)
        const textosFiltrados = guion_id ? textos.filter(t => t.guion_id == guion_id) : textos;

        textosFiltrados.forEach(t => {
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
            showConfirmButton: false, // No mostrar el botón "Aceptar"
            timer: 3000, // El mensaje desaparecerá después de 3 segundos
        });
    }
}

// Función para guardar un Graph
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

let graphEditando = null; // Variable para almacenar el ID del graph que se está editando

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

// Función para cargar y mostrar los Graphs asociados a un Texto
async function cargarGraphsPorTexto(texto_id) {
    try {
        const response = await fetch(`/textos/${texto_id}/graphs`);
        if (!response.ok) throw new Error('Error al cargar los graphs');
        const graphs = await response.json();

        // Mostrar los graphs en la tabla
        mostrarGraphsEnLista(graphs);
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message || 'Hubo un error al cargar los graphs. Por favor, inténtalo de nuevo.',
            showConfirmButton: false, // No mostrar el botón "Aceptar"
            timer: 3000, // El mensaje desaparecerá después de 3 segundos
        });
    }
}

function mostrarGraphsEnLista(graphs) {
    const tbody = document.querySelector('#tablaTextos tbody');
    if (!tbody) {
        console.error('Elemento tbody no encontrado en la tabla');
        return;
    }

    if (graphs.length === 0) {
        console.log('No hay Graphs para mostrar');
        return;
    }

    // Inicializar el contador
    let contador = 1;

    // Recorrer los Graphs y agregar filas a la tabla
    graphs.forEach(g => {
        const filaGraph = document.createElement('tr');
        filaGraph.innerHTML = `
            <td class="bg-light" colspan="4">
                <strong>Graph ${contador}</strong><br>
                <hr>
                <strong>Tema:</strong> ${g.tema}<br>
                <strong>Lugar:</strong> ${g.lugar}<br>
                <strong>Entrevistado:</strong> ${g.entrevistado}<br>
                <strong>Primera Línea:</strong> ${g.primera_linea}<br>
                <strong>Segunda Línea:</strong> ${g.segunda_linea}<br>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-secondary" onclick="editarGraph(${g.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline-danger" onclick="eliminarGraph(${g.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        tbody.appendChild(filaGraph);

        // Incrementar el contador para el próximo Graph
        contador++;
    });
}

async function setTextoActivo(id) {
    await fetch(`/textos/activo/${id}`, {
        method: 'PUT'
    });
    const guion_id = document.getElementById('guion_id').value;
    seleccionarGuion(guion_id);
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Lógica para ordenar la tabla por "N° de nota"
    let ordenAscendente = true;

    function ordenarPorNota() {
        const tabla = document.getElementById('tablaTextos');
        const tbody = tabla.querySelector('tbody');
        const filas = Array.from(tbody.querySelectorAll('tr'));
        const encabezadoNota = tabla.querySelector('th:nth-child(4)');

        // Ordenar las filas por el valor de "N° de nota"
        filas.sort((a, b) => {
            const notaA = parseInt(a.querySelector('td:nth-child(4)').textContent.trim(), 10);
            const notaB = parseInt(b.querySelector('td:nth-child(4)').textContent.trim(), 10);
            return ordenAscendente ? notaA - notaB : notaB - notaA;
        });

        // Limpiar el tbody y agregar las filas ordenadas
        tbody.innerHTML = '';
        filas.forEach(fila => tbody.appendChild(fila));

        // Cambiar el estado de la ordenación
        ordenAscendente = !ordenAscendente;

        // Actualizar el indicador visual
        encabezadoNota.textContent = `Nº ${ordenAscendente ? '▲' : '▼'}`;
    }

    // Agregar evento al encabezado de la columna
    document.querySelector('#tablaTextos th:nth-child(4)').addEventListener('click', ordenarPorNota);

    // 2. Lógica para restaurar el guion seleccionado y cargar los textos
    const guionSeleccionado = localStorage.getItem('guionSeleccionado');
    if (guionSeleccionado) {
        document.getElementById('guion_id').value = guionSeleccionado;
    }

    // Cargar los textos asociados al guion seleccionado
    cargarTextosEnSelect(guionSeleccionado);
});

document.addEventListener('DOMContentLoaded', () => {
    // Event listener para el cambio de guion
    document.getElementById('guion_id').addEventListener('change', (event) => {
        const guion_id = event.target.value;
        if (guion_id) {
            // Guardar el guion seleccionado en localStorage
            localStorage.setItem('guionSeleccionado', guion_id);

            // Cargar los textos asociados al guion seleccionado
            cargarTextosEnSelect(guion_id);
        } else {
            // Limpiar el select de textos si no hay guion seleccionado
            const selectTexto = document.getElementById('texto_id');
            selectTexto.innerHTML = '<option value="">Seleccione un texto</option>';
        }
    });

    // Restaurar el guion seleccionado al cargar la página
    const guionSeleccionado = localStorage.getItem('guionSeleccionado');
    if (guionSeleccionado) {
        document.getElementById('guion_id').value = guionSeleccionado;
        cargarTextosEnSelect(guionSeleccionado);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    // Obtener referencias a los elementos
    const botonFlotante = document.getElementById('botonFlotante');
    const formularioTextoContainer = document.getElementById('formularioTextoContainer');

    // Verificar si los elementos existen
    if (!botonFlotante || !formularioTextoContainer) {
        console.error('No se encontró el botón flotante o el formulario.');
        return;
    }

    // Función para verificar si el formulario está visible en la pantalla
    function formularioEsVisible() {
        const rect = formularioTextoContainer.getBoundingClientRect();
        return (
            rect.top >= 0 && // El formulario no está por encima de la pantalla
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) // El formulario no está por debajo de la pantalla
        );
    }

    // Función para desplazarse al formulario
    function desplazarseAlFormulario() {
        formularioTextoContainer.scrollIntoView({behavior: 'smooth', block: 'start'});
    }

    // Función para actualizar la visibilidad del botón flotante
    function actualizarVisibilidadBotonFlotante() {
        if (formularioEsVisible()) {
            botonFlotante.classList.remove('activo'); // Ocultar el botón
        } else {
            botonFlotante.classList.add('activo'); // Mostrar el botón
        }
    }

    // Escuchar el evento de scroll para actualizar la visibilidad del botón
    window.addEventListener('scroll', actualizarVisibilidadBotonFlotante);

    // Desplazarse al formulario al hacer clic en el botón flotante
    botonFlotante.addEventListener('click', desplazarseAlFormulario);

    // Verificar la visibilidad inicial del botón
    actualizarVisibilidadBotonFlotante();
});

document.addEventListener('DOMContentLoaded', () => {
    const clipboard = new ClipboardJS('.btn-copiar');

    clipboard.on('success', function (e) {
        Swal.fire({
            icon: 'success',
            title: "Texto copiado",
            showConfirmButton: false, // No mostrar el botón "Aceptar"
            timer: 1000, // El mensaje desaparecerá después de 2 segundos
        });
        e.clearSelection(); // Limpiar la selección
    });
});