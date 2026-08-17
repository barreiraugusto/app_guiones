// static/js/grabacion.js - VERSIÓN COMPLETA

// Variables globales
window.estadosGrabacion = {};
window.guionSeleccionadoId = null;

// Escapa comillas simples y backslashes para poder interpolar un valor
// dentro de un atributo onclick="...('valor')" sin romper el HTML.
function escaparParaJs(str) {
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// ===== FUNCIONES DE INICIALIZACIÓN =====

document.addEventListener('DOMContentLoaded', function () {
    console.log('grabacion.js cargado');

    // Verificar si hay un guion seleccionado en localStorage
    const guionId = localStorage.getItem('guionSeleccionadoGrabacion');
    const guionNombre = localStorage.getItem('guionNombreGrabacion');

    if (guionId && guionNombre) {
        console.log('Guion encontrado en localStorage:', guionId, guionNombre);
        seleccionarGuionParaGrabacion(guionId, guionNombre);
    } else {
        console.log('No hay guion guardado en localStorage');
    }

    // Configurar eventos del modal
    if (typeof $ !== 'undefined') {
        $('#seleccionarGuionModalGrabacion').on('shown.bs.modal', function () {
            console.log('Modal mostrado, cargando guiones...');
            cargarGuionesParaGrabacion();
        });

        $('#seleccionarGuionModalGrabacion').on('hidden.bs.modal', function () {
            // Limpiar búsqueda
            const buscarInput = document.getElementById('buscarGuionGrabacion');
            if (buscarInput) {
                buscarInput.value = '';
                filtrarGuionesGrabacion();
            }
        });
    }
});

// ===== FUNCIONES DE GESTIÓN DE GUIONES =====

// Función para guardar selección en localStorage
function guardarSeleccionGrabacion(guionId, guionNombre) {
    try {
        localStorage.setItem('guionSeleccionadoGrabacion', guionId);
        localStorage.setItem('guionNombreGrabacion', guionNombre);
        console.log('Guion guardado en localStorage:', guionId, guionNombre);
    } catch (e) {
        console.error('Error guardando en localStorage:', e);
    }
}

// Función para cargar guiones
async function cargarGuionesParaGrabacion() {
    console.log('Cargando guiones...');
    try {
        const response = await fetch('/obtener_guiones');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const guiones = await response.json();
        console.log('Guiones recibidos:', guiones.length);

        const lista = document.getElementById('listaGuionesModalGrabacion');
        if (!lista) {
            console.error('Elemento listaGuionesModalGrabacion no encontrado');
            return;
        }

        lista.innerHTML = '';

        if (guiones.length === 0) {
            lista.innerHTML = '<div class="list-group-item text-center text-muted">No hay guiones disponibles</div>';
            return;
        }

        guiones.forEach(guion => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action';
            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1">${guion.nombre}</h6>
                        <small class="text-muted">${guion.descripcion || 'Sin descripción'}</small>
                    </div>
                    <span class="badge badge-primary">
                        ${guion.notas_para_grabar || 0}/${guion.cantidad_notas || 0}
                    </span>
                </div>
            `;

            item.onclick = function (e) {
                e.preventDefault();
                console.log('Guion seleccionado:', guion.id, guion.nombre);
                seleccionarGuionParaGrabacion(guion.id, guion.nombre);
                if (typeof $ !== 'undefined') {
                    $('#seleccionarGuionModalGrabacion').modal('hide');
                }
            };

            lista.appendChild(item);
        });

    } catch (error) {
        console.error('Error cargando guiones:', error);
        mostrarError('Error al cargar los guiones: ' + error.message);

        const lista = document.getElementById('listaGuionesModalGrabacion');
        if (lista) {
            lista.innerHTML = `
                <div class="list-group-item text-center text-danger">
                    <i class="fas fa-exclamation-triangle mr-2"></i>
                    Error al cargar guiones
                </div>
            `;
        }
    }
}

// Función para filtrar guiones
function filtrarGuionesGrabacion() {
    const busqueda = document.getElementById('buscarGuionGrabacion')?.value.toLowerCase() || '';
    const items = document.querySelectorAll('#listaGuionesModalGrabacion .list-group-item');

    console.log('Filtrando con:', busqueda);

    items.forEach(item => {
        const texto = item.textContent.toLowerCase();
        item.style.display = texto.includes(busqueda) ? 'block' : 'none';
    });
}

// Función para seleccionar guion
function seleccionarGuionParaGrabacion(guionId, guionNombre) {
    console.log('Seleccionando guion:', guionId, guionNombre);

    window.guionSeleccionadoId = guionId;

    const guionActualElement = document.getElementById('guionActual');
    const estadoGlobalElement = document.getElementById('estadoGlobal');

    if (guionActualElement) {
        guionActualElement.textContent = guionNombre;
    }

    if (estadoGlobalElement) {
        estadoGlobalElement.textContent = `Guion: ${guionNombre}`;
        estadoGlobalElement.className = 'badge badge-success';
    }

    // Guardar en localStorage
    guardarSeleccionGrabacion(guionId, guionNombre);

    // Cargar las notas para grabar
    cargarNotasParaGrabar(guionId);
}

// ===== FUNCIONES DE GRABACIÓN =====

// Función para cargar notas para grabar
async function cargarNotasParaGrabar(guionId) {
    console.log('Cargando notas para grabar del guion:', guionId);

    try {
        const tbody = document.getElementById('listaGrabaciones');
        if (!tbody) {
            console.error('Elemento listaGrabaciones no encontrado');
            return;
        }

        // Mostrar loading
        tbody.innerHTML = `
            <tr id="loading">
                <td colspan="4" class="text-center py-4">
                    <div class="spinner-border text-danger" role="status"></div>
                    <p class="mt-2">Cargando notas para grabar...</p>
                </td>
            </tr>
        `;

        // Obtener textos del guion
        const response = await fetch(`/textos/por-guion/${guionId}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const textos = await response.json();
        console.log('Textos recibidos:', textos.length);

        // Filtrar solo los que tienen grabar=true
        const textosParaGrabar = textos.filter(texto => texto.grabar === true);
        console.log('Textos para grabar:', textosParaGrabar.length);

        // Obtener el nombre del guion
        const guionNombre = document.getElementById('guionActual')?.textContent || 'Sin nombre';

        // Actualizar tabla
        tbody.innerHTML = '';

        if (textosParaGrabar.length === 0) {
            tbody.innerHTML = `
                <tr id="sinDatos">
                    <td colspan="4" class="empty-state">
                        <i class="fas fa-times-circle"></i>
                        <h5 class="mt-3">No hay notas para grabar</h5>
                        <p class="text-muted">No hay notas marcadas con "Grabar" en este guion</p>
                    </td>
                </tr>
            `;
            return;
        }

        // Agregar cada nota a la tabla
        textosParaGrabar.forEach(texto => {
            const fila = document.createElement('tr');
            fila.dataset.textoId = texto.id;
            fila.dataset.titulo = texto.titulo;
            fila.dataset.guionNombre = guionNombre;

            fila.innerHTML = `
                <td class="align-middle">${texto.numero_de_nota}</td>
                <td class="align-middle">
                    <strong>${texto.titulo}</strong>
                    ${texto.material ? `<br><small class="text-muted">${texto.material}</small>` : ''}
                </td>
                <td class="align-middle estado-grabacion"></td>
                <td class="align-middle acciones-grabacion"></td>
            `;

            tbody.appendChild(fila);

            // Estado inicial: refleja lo que ya quedó grabado en el guión
            // (persistido en la BD), no se resetea al recargar la página.
            const estadoInicial = texto.grabado ? 'grabado' : 'espera';
            window.estadosGrabacion[texto.id] = estadoInicial;
            actualizarInterfazGrabacion(texto.id, estadoInicial);
        });

    } catch (error) {
        console.error('Error cargando notas:', error);
        mostrarError('Error al cargar las notas para grabar: ' + error.message);

        const tbody = document.getElementById('listaGrabaciones');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-danger py-4">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p class="mt-2">Error al cargar las notas</p>
                        <small>${error.message}</small>
                    </td>
                </tr>
            `;
        }
    }
}

// Función para iniciar grabación CON CONTROL
async function iniciarGrabacionControl(textoId, titulo, guionNombre) {
    console.log('Iniciando grabación con control...', {textoId, titulo, guionNombre});

    if (!window.guionSeleccionadoId) {
        mostrarError('Primero selecciona un guion');
        return;
    }

    // Actualizar estado inmediatamente
    window.estadosGrabacion[textoId] = 'grabando';
    actualizarInterfazGrabacion(textoId, 'grabando');

    // Mostrar indicador de carga
    const fila = document.querySelector(`tr[data-texto-id="${textoId}"]`);
    if (fila) {
        const botonCell = fila.querySelector('.acciones-grabacion');
        if (botonCell) {
            botonCell.innerHTML = `
                <button class="btn btn-warning" disabled>
                    <i class="fas fa-spinner fa-spin"></i> Iniciando...
                </button>
            `;
        }
    }

    try {
        const response = await fetch('/proxy/iniciar_grabacion_control', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                texto_id: textoId,
                titulo: titulo,
                guion_nombre: guionNombre
            })
        });

        const data = await response.json();
        console.log('Respuesta del proxy (control):', data);

        if (data.success) {
            let mensaje = data.message || 'Grabación iniciada';
            if (data.pid) {
                mensaje += ` (PID: ${data.pid})`;
            }
            if (data.nombre_archivo) {
                mensaje += ` [${data.nombre_archivo}]`;
            }

            mostrarMensajeExito(mensaje);

            // Actualizar interfaz con botón STOP
            actualizarInterfazGrabacion(textoId, 'grabando');

            // Verificar estado después de 5 segundos
            setTimeout(() => {
                verificarEstadoGrabacion(textoId);
            }, 5000);

        } else {
            throw new Error(data.message || 'Error desconocido al iniciar grabación');
        }
    } catch (error) {
        console.error('Error iniciando grabación con control:', error);
        mostrarError('Error al iniciar la grabación: ' + error.message);
        window.estadosGrabacion[textoId] = 'espera';
        actualizarInterfazGrabacion(textoId, 'espera');
    }
}

// Persiste en el guión que esta nota quedó grabada
async function marcarTextoGrabado(textoId) {
    try {
        await fetch(`/textos/grabado/${textoId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ grabado: true })
        });
    } catch (error) {
        console.error('No se pudo persistir el estado grabado:', error);
    }
}

// Función para verificar estado de la grabación
async function verificarEstadoGrabacion(textoId) {
    try {
        const response = await fetch('/proxy/estado_grabacion');
        const estado = await response.text();
        console.log('Estado actual de grabación:', estado.substring(0, 200));

        // Si el estado indica que no hay grabación activa pero nosotros creemos que sí,
        // actualizar el estado
        if (estado.includes('No hay procesos ffmpeg') &&
            window.estadosGrabacion[textoId] === 'grabando') {
            console.log('⚠ Grabación parece haber terminado, actualizando estado...');
            window.estadosGrabacion[textoId] = 'grabado';
            actualizarInterfazGrabacion(textoId, 'grabado');
            marcarTextoGrabado(textoId);
        }
    } catch (error) {
        console.log('No se pudo verificar estado:', error);
    }
}

// Función para detener grabación CON CONTROL
async function detenerGrabacionControl(textoId, titulo) {
    console.log('Deteniendo grabación con control...', {textoId, titulo});

    if (!window.estadosGrabacion[textoId] || window.estadosGrabacion[textoId] !== 'grabando') {
        mostrarError('No hay grabación activa para detener');
        return;
    }

    if (!confirm(`¿Detener grabación: "${titulo}"?\n\nSe intentará una detención limpia para preservar el archivo.`)) {
        return;
    }

    // Estado deteniendo
    window.estadosGrabacion[textoId] = 'deteniendo';
    actualizarInterfazGrabacion(textoId, 'deteniendo');

    try {
        const response = await fetch('/proxy/detener_grabacion_limpia', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                texto_id: textoId,
                titulo: titulo
            })
        });

        const data = await response.json();
        console.log('Respuesta detención control:', data);

        if (data.success) {
            window.estadosGrabacion[textoId] = 'detenido';
            actualizarInterfazGrabacion(textoId, 'detenido');

            let mensaje = data.message || 'Grabación detenida';
            if (data.tamano) {
                mensaje += ` (${data.tamano})`;
            }
            if (data.duracion) {
                mensaje += ` [${data.duracion}]`;
            }
            if (data.valido === false) {
                mensaje += ' ⚠ Posible archivo corrupto';
            }

            mostrarMensajeExito(mensaje);

            // Después de 3 segundos, marcar como grabado
            setTimeout(() => {
                if (window.estadosGrabacion[textoId] === 'detenido') {
                    window.estadosGrabacion[textoId] = 'grabado';
                    actualizarInterfazGrabacion(textoId, 'grabado');
                    marcarTextoGrabado(textoId);
                }
            }, 3000);

        } else {
            // Si falla la detención limpia, intentar con método forzado
            console.log('Detención limpia falló, intentando método forzado...');
            await detenerGrabacionForzada(textoId, titulo);
        }
    } catch (error) {
        console.error('Error deteniendo con control:', error);
        mostrarError('Error al detener: ' + error.message);

        // Intentar con método forzado como fallback
        setTimeout(() => {
            detenerGrabacionForzada(textoId, titulo);
        }, 1000);
    }
}

// Función de fallback forzada
async function detenerGrabacionForzada(textoId, titulo) {
    console.log('Usando detención forzada como fallback');

    try {
        // Usar el endpoint antiguo o directo
        const response = await fetch('/proxy/detener_grabacion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                texto_id: textoId,
                titulo: titulo
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Respuesta detención forzada:', data);

            window.estadosGrabacion[textoId] = 'detenido';
            actualizarInterfazGrabacion(textoId, 'detenido');
            mostrarMensajeExito(data.message || 'Grabación detenida (forzada)');
        } else {
            throw new Error('Error en respuesta del servidor');
        }

    } catch (error) {
        console.warn('Error en detención forzada:', error);
        window.estadosGrabacion[textoId] = 'detenido';
        actualizarInterfazGrabacion(textoId, 'detenido');
        mostrarMensajeExito('Solicitud de detención enviada (modo forzado)');
    }
}

// Actualizar la función actualizarInterfazGrabacion para usar las nuevas funciones:
function actualizarInterfazGrabacion(textoId, estado) {
    const fila = document.querySelector(`tr[data-texto-id="${textoId}"]`);
    if (!fila) return;

    const estadoCell = fila.querySelector('.estado-grabacion');
    const botonCell = fila.querySelector('.acciones-grabacion');

    const titulo = escaparParaJs(fila.dataset.titulo);
    const guionNombre = escaparParaJs(fila.dataset.guionNombre);

    switch (estado) {
        case 'espera':
            estadoCell.innerHTML = '<span class="status-indicator status-espera"></span>En espera';
            estadoCell.className = 'estado-grabacion text-muted';
            botonCell.innerHTML = `
                <button class="btn btn-rec" onclick="iniciarGrabacionControl('${textoId}', '${titulo}', '${guionNombre}')">
                    <i class="fas fa-circle"></i> REC
                </button>
            `;
            break;

        case 'grabando':
            estadoCell.innerHTML = '<span class="status-indicator status-grabando"></span>GRABANDO...';
            estadoCell.className = 'estado-grabacion text-danger font-weight-bold';
            botonCell.innerHTML = `
                <button class="btn btn-stop" onclick="detenerGrabacionControl('${textoId}', '${titulo}')">
                    <i class="fas fa-stop"></i> STOP
                </button>
            `;
            break;

        case 'deteniendo':
            estadoCell.innerHTML = '<span class="status-indicator status-grabando"></span>DETENIENDO...';
            estadoCell.className = 'estado-grabacion text-warning font-weight-bold';
            botonCell.innerHTML = `
                <button class="btn btn-warning" disabled>
                    <i class="fas fa-spinner fa-spin"></i> Deteniendo...
                </button>
            `;
            break;

        case 'detenido':
            estadoCell.innerHTML = '<span class="status-indicator" style="background-color: #ffc107;"></span>Detenido';
            estadoCell.className = 'estado-grabacion text-warning';
            botonCell.innerHTML = `
                <button class="btn btn-outline-warning" disabled>
                    <i class="fas fa-pause"></i> Detenido
                </button>
            `;
            break;

        case 'grabado':
            estadoCell.innerHTML = '<span class="status-indicator status-grabado"></span>Grabado';
            estadoCell.className = 'estado-grabacion text-success';
            botonCell.innerHTML = `
                <button class="btn btn-outline-success" onclick="iniciarGrabacionControl('${textoId}', '${titulo}', '${guionNombre}')" title="Volver a grabar">
                    <i class="fas fa-redo"></i> Regrabar
                </button>
            `;
            break;
    }
}

// ===== FUNCIONES AUXILIARES =====

function mostrarMensajeExito(mensaje) {
    console.log('Éxito:', mensaje);
    Swal.fire({
        icon: 'success',
        title: mensaje,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
}

function mostrarError(mensaje) {
    console.error('Error:', mensaje);
    Swal.fire({
        icon: 'error',
        title: mensaje,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 5000,
        timerProgressBar: true
    });
}

// ===== EXPORTAR FUNCIONES PARA USO GLOBAL =====
// Esto permite que las funciones sean llamadas desde onclick en HTML
window.iniciarGrabacionControl = iniciarGrabacionControl;
window.detenerGrabacionControl = detenerGrabacionControl;
window.detenerGrabacionForzada = detenerGrabacionForzada;
window.verificarEstadoGrabacion = verificarEstadoGrabacion;
window.seleccionarGuionParaGrabacion = seleccionarGuionParaGrabacion;
window.cargarGuionesParaGrabacion = cargarGuionesParaGrabacion;
window.filtrarGuionesGrabacion = filtrarGuionesGrabacion;