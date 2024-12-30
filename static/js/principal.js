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
    const response = await fetch('/guiones');
    const guiones = await response.json();
    const lista = document.getElementById('listaGuiones');
    lista.innerHTML = '';
    guiones.forEach(g => {
        const li = document.createElement('li');
        li.innerHTML = `
            <strong>${g.nombre}</strong><br>
            <em>${g.descripcion}</em><br>
            <div class="btn-group btn-group-sm">
                <button class="btn btn-outline-secondary" onclick="seleccionarGuion(${g.id})">Seleccionar</button>
                <button class="btn btn-outline-secondary" onclick="editarGuion(${g.id})">Editar</button>
                <button class="btn btn-outline-danger" onclick="borrarGuion(${g.id})">Borrar</button>
            </div>
        `;
        lista.appendChild(li);
    });
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

async function editarGuion(id) {
    const response = await fetch(`/guiones/${id}`);
    const guion = await response.json();
    // Rellenar el formulario con los datos del guion
    document.getElementById('nombreGuion').value = guion.nombre;
    document.getElementById('descripcionGuion').value = guion.descripcion;
    // Cambiar el botón de "Crear Guion" a "Guardar"
    document.getElementById('botonGuardarGuion').textContent = 'Guardar';
    document.getElementById('botonCancelar').style.display = 'inline';
    // Guardar el ID del guion que se está editando
    guionEditando = id;
}

async function guardarGuion(event) {
    event.preventDefault();
    const nombre = document.getElementById('nombreGuion').value;
    const descripcion = document.getElementById('descripcionGuion').value;

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
    const encabezado = document.querySelector("h2"); // Selecciona el encabezado <h2>
    const guionSelect = document.getElementById("guion_id"); // Selecciona el <select> con los nombres de los guiones

    // Busca la opción seleccionada que coincida con el ID
    const opcionSeleccionada = Array.from(guionSelect.options).find(option => option.value == id);

    // Actualiza el texto del encabezado si existe la opción
    if (opcionSeleccionada) {
        encabezado.textContent = `${opcionSeleccionada.text}`;
    } else {
        encabezado.textContent = ""; // Fallback en caso de error
    }
    const response = await fetch(`/guiones/${id}`);
    const guion = await response.json();
    const tbody = document.querySelector('#tablaTextos tbody');
    tbody.innerHTML = ''; // Limpiar la tabla antes de llenarla
    guion.textos.forEach(t => {
        const fila = document.createElement('tr');
        if (t.activo) {
            fila.classList.add('bg-success'); // Resaltar la fila del texto activo
        }

        // Convertir URLs en enlaces dentro del material
        const materialContent = convertirUrlsEnEnlaces(t.material || '');

        fila.innerHTML = `
            <td>${t.titulo}</td>
            <td>${t.contenido}</td>
            <td>${materialContent}</td>
            <td>${t.numero_de_nota}</td>
            <td>
                <div class="btn-group-vertical">
                    <button type="button" class="btn btn-outline-secondary" onclick="setTextoActivo(${t.id})">Seleccionar</button>
                    <button type="button" class="btn btn-outline-secondary" onclick="editarTexto(event, ${t.id})">Editar</button>
                    <button type="button" class="btn btn-outline-danger" onclick="borrarTexto(${t.id})">Borrar</button>
                </div>
            </td>
        `;
        tbody.appendChild(fila);
    });

    // Actualizar el valor del <select> guion_id
    document.getElementById('guion_id').value = id;

    // Guardar el ID del guion seleccionado en localStorage
    localStorage.setItem('guionSeleccionado', id);
}

function convertirUrlsEnEnlaces(texto) {
    // Expresión regular para detectar URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    return texto.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
}

async function borrarGuion(id) {
    if (confirm("¿Estás seguro de que quieres borrar este guion?")) {
        await fetch(`/guiones/borrar/${id}`, {
            method: 'DELETE'
        });
        window.location.reload(); // Recargar la página para actualizar la lista de guiones
    }
}

async function cargarTextos() {
    const response = await fetch('/textos');
    const textos = await response.json();
    const tbody = document.querySelector('#tablaTextos tbody');
    tbody.innerHTML = ''; // Limpiar la tabla antes de llenarla
    textos.forEach(t => {
        const fila = document.createElement('tr');
        if (t.activo) {
            fila.classList.add('bg-success'); // Resaltar la fila del texto activo
        }
        fila.innerHTML = `
            <td>${t.titulo}</td>
            <td>${t.contenido}</td>
            <td>${t.material || ''}</td>
            <td>${t.numero_de_nota}</td>
            <td>
                <div class="btn-group-vertical">
                    <button type="button" class="btn btn-outline-secondary" onclick="setTextoActivo(${t.id})">Seleccionar</button>
                    <button type="button" class="btn btn-outline-secondary" onclick="editarTexto(event, ${t.id})">Editar</button>
                    <button type="button" class="btn btn-outline-secondary" onclick="borrarTexto(${t.id})">Borrar</button>
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
    const guionId = document.getElementById('guion_id').value;

    if (textoEditando) {
        // Si se está editando un texto, enviar una solicitud PUT
        await fetch(`/textos/editar/${textoEditando}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                numero_de_nota: numeroDeNota,
                titulo: titulo,
                contenido: contenido,
                material: material,
                guion_id: guionId
            })
        });
    } else {
        // Si no se está editando, enviar una solicitud POST para crear un nuevo texto
        await fetch('/textos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                numero_de_nota: numeroDeNota,
                titulo: titulo,
                contenido: contenido,
                material: material,
                guion_id: guionId
            })
        });
    }

    // Limpiar el formulario y restablecer el botón
    cancelarEdicion();
    // Recargar la lista de textos
    seleccionarGuion(guionId);
}

async function editarTexto(event, id) {
    event.stopPropagation();
    const response = await fetch(`/textos/${id}`);
    const texto = await response.json();

    // Rellenar el formulario con los datos del texto
    document.getElementById('numero_de_nota').value = texto.numero_de_nota;
    document.getElementById('titulo').value = texto.titulo;

    // Rellenar el editor Quill con el contenido
    quill.root.innerHTML = texto.contenido; // Usar innerHTML para asignar el contenido

    document.getElementById('material').value = texto.material || '';
    document.getElementById('guion_id').value = texto.guion_id; // Establecer el guion correspondiente

    // Cambiar el botón de "Agregar" a "Guardar"
    document.getElementById('botonGuardarTexto').textContent = 'Guardar';
    document.getElementById('botonCancelar').style.display = 'inline';

    // Guardar el ID del texto que se está editando
    textoEditando = id;
}

async function borrarTexto(id) {
    if (confirm("¿Estás seguro de que quieres borrar este texto?")) {
        await fetch(`/textos/borrar/${id}`, {
            method: 'DELETE'
        });
        const guionId = document.getElementById('guion_id').value;
        if (guionId) {
            seleccionarGuion(guionId); // Recargar la tabla de textos
        } else {
            cargarTextos(); // Si no hay guion seleccionado, recargar todos los textos
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
    const guionId = document.getElementById('guion_id').value;
    seleccionarGuion(guionId);
}
