document.addEventListener('DOMContentLoaded', () => {
    cargarGuiones();
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
    const encabezadoNota = document.querySelector('#tablaTextos th:nth-child(4)');
    if (encabezadoNota) {
        encabezadoNota.addEventListener('click', ordenarPorNota);
    }

    // 2. Lógica para guiones seleccionados
    const guionSelect = document.getElementById('guion_id');
    const guionSeleccionado = localStorage.getItem('guionSeleccionado');

    // Restaurar selección al cargar
    if (guionSeleccionado && guionSelect) {
        guionSelect.value = guionSeleccionado;
        cargarTextosEnSelect(guionSeleccionado);
    }

    // Event listener para cambio de guion
    if (guionSelect) {
        guionSelect.addEventListener('change', (event) => {
            const guion_id = event.target.value;
            if (guion_id) {
                localStorage.setItem('guionSeleccionado', guion_id);
                cargarTextosEnSelect(guion_id);
            } else {
                const selectTexto = document.getElementById('texto_id');
                if (selectTexto) {
                    selectTexto.innerHTML = '<option value="">Seleccione un texto</option>';
                }
            }
        });
    }

    // 3. Lógica del botón flotante
    const botonFlotante = document.getElementById('botonFlotante');
    const formularioTextoContainer = document.getElementById('formularioTextoContainer');

    if (botonFlotante && formularioTextoContainer) {
        function formularioEsVisible() {
            const rect = formularioTextoContainer.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
            );
        }

        function desplazarseAlFormulario() {
            formularioTextoContainer.scrollIntoView({behavior: 'smooth', block: 'start'});
        }

        function actualizarVisibilidadBotonFlotante() {
            if (formularioEsVisible()) {
                botonFlotante.classList.remove('activo');
            } else {
                botonFlotante.classList.add('activo');
            }
        }

        window.addEventListener('scroll', actualizarVisibilidadBotonFlotante);
        botonFlotante.addEventListener('click', desplazarseAlFormulario);
        actualizarVisibilidadBotonFlotante();
    }

    // 4. ClipboardJS
    const clipboard = new ClipboardJS('.btn-copiar');
    clipboard.on('success', function(e) {
        Swal.fire({
            icon: 'success',
            title: "Texto copiado",
            showConfirmButton: false,
            timer: 1000,
        });
        e.clearSelection();
    });
});