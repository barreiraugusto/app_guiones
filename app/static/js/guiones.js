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
    const encabezado = document.getElementById("encabezado");
    const guionSelect = document.getElementById("guion_id");

    // Guardar la selección actual del <select> de textos
    const textoIdSeleccionado = document.getElementById('texto_id').value;

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
        // Agregar la clase bg-light al <tr>
        filaTexto.classList.add('bg-light');
        if (t.emitido) {
            console.log("Emitido");
            filaTexto.classList.replace('bg-light', 'bg-secondary');
        } else if (t.activo) {
            console.log("Activo");
            filaTexto.classList.replace('bg-light', 'bg-warning');
        }

        const materialContent = convertirUrlsEnEnlaces(t.material || '');

        filaTexto.innerHTML = `
            <td class="bg-secondary text-white text-center"><h3>${t.numero_de_nota}</h3></td>
            <td><strong>${t.titulo}</strong></td>
<!--            <td>${t.contenido}</td>-->
            <td>${materialContent}</td>
            <td>${t.musica}</td>
            <td>${t.duracion}</td>
            <td>
                <div class="btn-group">
                    <button type="button" class="btn btn-outline-warning" onclick="setTextoActivo(${t.id})"><i class="fas fa-arrow-right"></i></button>
                    <button type="button" class="btn btn-outline-success" onclick="setTextoEmitido(${t.id})"><i class="fas fa-check"></i></button>
                    <button type="button" class="btn btn-outline-info" onclick="editarTexto(event, ${t.id})"><i class="fas fa-edit"></i></button>
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
            <td></td>
            <td class="bg-light p-0" colspan="4">
             <details>
              <summary class="bg-light" style="cursor: pointer;">
                <strong>Graph ${contadorGraph}</strong><br>
                </summary>
                <hr>
                <strong>Lugar:</strong> ${g.lugar}<br>
                <strong>Tema:</strong> ${g.tema}<br>
                <strong>Entrevistado:</strong> ${g.entrevistado}<br>
                <strong>Primera Línea:</strong> ${g.primera_linea}<br>
                <strong>Segunda Línea:</strong> ${g.segunda_linea}<br>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-info" onclick="editarGraph(${g.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-outline-danger" onclick="eliminarGraph(${g.id})"><i class="fas fa-trash"></i></button>
                    <button class="btn btn-outline-primary btn-copiar" data-clipboard-text="${textoParaCopiar.replace(/"/g, '&quot;')}"><i class="fas fa-copy"></i></button>
                </div>
                </details>
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
    await cargarTextosEnSelect(id);

    // Restaurar la selección del <select> de textos
    const selectTexto = document.getElementById('texto_id');
    const opcionExiste = Array.from(selectTexto.options).some(option => option.value === textoIdSeleccionado);

    if (opcionExiste) {
        selectTexto.value = textoIdSeleccionado; // Restaurar la selección
    } else {
        console.warn("La opción seleccionada ya no está disponible.");
    }
    actualizarTiempoTotal(id);
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

async function actualizarTiempoTotal(Id) {
    try {
        // Hacer la petición a tu endpoint Flask
        const response = await fetch(`/tiempos/${Id}`);
        const data = await response.json();

        if (response.ok) {
            // Mostrar la duración total en el elemento th
            document.getElementById('tiempo_total').textContent = data.duracion_total;
        } else {
            console.error('Error:', data.mensaje);
            document.getElementById('tiempo_total').textContent = '00:00';
        }
    } catch (error) {
        console.error('Error al obtener los tiempos:', error);
        document.getElementById('tiempo_total').textContent = '00:00';
    }
}
