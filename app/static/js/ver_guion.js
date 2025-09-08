document.addEventListener('DOMContentLoaded', function () {
    // Obtener el ID del guion desde el atributo data-guion-id
    const guionData = document.getElementById('guion-data');
    const guionId = guionData ? guionData.getAttribute('data-guion-id') : null;

    if (!guionId) {
        console.error('No se encontró el ID del guion.');
        return;
    }

    // Función para convertir URLs en enlaces
    function convertirUrlsEnEnlaces(texto) {
        if (!texto) return '';
        const urlRegex = /https?:\/\/[^\s]+/g;
        return texto.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
    }

    // Función para actualizar la tabla
    function actualizarTabla(textos) {
    const tbody = document.querySelector('#tablaTextos tbody');
    const textosFiltrados = textos.filter(t => t.guion_id == guionId);

    // Ordenar los textos por "numero_de_nota"
    textosFiltrados.sort((a, b) => a.numero_de_nota - b.numero_de_nota);

    // Crear un mapa de los textos actuales
    const textosMap = new Map(textosFiltrados.map(t => [t.id, t]));

    // Eliminar filas que ya no están en los datos (notas y separadores)
    document.querySelectorAll('#tablaTextos tr[data-texto-id], #tablaTextos tr.linea-separadora').forEach(fila => {
        if (fila.classList.contains('linea-separadora') ||
            !textosMap.has(Number(fila.getAttribute('data-texto-id')))) {
            fila.remove();
        }
    });

    // Actualizar o agregar filas
    textosFiltrados.forEach((t, index) => {
        let filaTexto = tbody.querySelector(`tr[data-texto-id="${t.id}"]`);
        const numGraphs = t.graphs ? t.graphs.length : 0;
        const rowspanValue = numGraphs > 0 ? numGraphs + 1 : 1;

        if (!filaTexto) {
            filaTexto = document.createElement('tr');
            filaTexto.setAttribute('data-texto-id', t.id);
            tbody.appendChild(filaTexto);
        }

        // Convertir URLs en material
        const materialContent = convertirUrlsEnEnlaces(t.material || '');

        // Actualizar contenido del texto
        filaTexto.innerHTML = `
            <td rowspan="${rowspanValue}" class="text-center"><h3>${t.numero_de_nota}</h3></td>
            <td>
                <strong>${t.titulo}</strong>
                ${t.grabar ? '<div class="text-danger small font-weight-bold">GRABAR</div>' : ''}
            </td>
            <td>${t.contenido || ''}</td>
            <td>${materialContent}</td>
        `;

        // Procesar graphs del texto
        if (t.graphs && t.graphs.length > 0) {
            // Eliminar graphs existentes de este texto
            document.querySelectorAll(`tr[data-graph-parent="${t.id}"]`).forEach(el => el.remove());

            // Ordenar los graphs por ID antes de procesarlos
            const graphsOrdenados = [...t.graphs].sort((a, b) => (a.id || 0) - (b.id || 0)).reverse();

            // Agregar nuevos graphs (ordenados por ID)
            graphsOrdenados.forEach((g, graphIndex) => {
                const filaGraph = document.createElement('tr');
                filaGraph.setAttribute('data-graph-id', g.id);
                filaGraph.setAttribute('data-graph-parent', t.id);
                filaGraph.className = 'graph-row';

                // Ordenar bajadas por ID (ascendente)
                const bajadasOrdenadas = [...(g.bajadas || [])].sort((a, b) => (a.id || 0) - (b.id || 0)).reverse();

                // Procesar bajadas (sin viñetas)
                let bajadasContent = bajadasOrdenadas ? bajadasOrdenadas.map(b => `${b.texto || b}</br>`).join('') : '';

                // Procesar entrevistados y citas (sin viñetas)
                let entrevistadosContent = '';
                if (g.entrevistados && g.entrevistados.length > 0) {
                    entrevistadosContent = g.entrevistados.map(e => `
                        <div class="m-0">
                            <strong>${e.nombre}</strong>
                            <div class="m-0">${e.citas.join('<br>')}</div>
                        </div>
                    `).join('');
                }

                filaGraph.innerHTML = `
                    <td></td>
                    <td colspan="2" class="p-3">
                        <div class="m-0">${g.lugar || ''}</div>
                        <div class="m-0">${g.tema ? `*${g.tema}` : ''}</div>
                        <div class="m-0">
                            ${bajadasContent}
                        </div>
                        <div class="m-0">
                            ${entrevistadosContent || ''}
                        </div>
                    </td>
                `;

                filaTexto.insertAdjacentElement('afterend', filaGraph);
            });
        }

        // AGREGAR LÍNEA SEPARADORA OSCURA Y ANCHA DESPUÉS DE TODA LA NOTA (incluyendo graphs)
        if (index < textosFiltrados.length - 1) {
            // Usar setTimeout para asegurar que todos los elementos se hayan insertado
            setTimeout(() => {
                const lineaSeparadora = document.createElement('tr');
                lineaSeparadora.className = 'linea-separadora';
                lineaSeparadora.innerHTML = `
                    <td colspan="4" style="height: 3px; background-color: #495057; border: none; padding: 0;"></td>
                `;

                // Encontrar la última fila de esta nota
                const graphRows = tbody.querySelectorAll(`tr[data-graph-parent="${t.id}"]`);
                const lastRow = graphRows.length > 0 ? graphRows[graphRows.length - 1] : filaTexto;

                lastRow.insertAdjacentElement('afterend', lineaSeparadora);
            }, 0);
        }
    });
}

    actualizarTiempoTotal(guionId);

    // Suscribirse a las actualizaciones del servidor
    const eventSource = new EventSource('/stream_textos');

    eventSource.onmessage = function (event) {
        try {
            const textos = JSON.parse(event.data);
            actualizarTabla(textos);
        } catch (error) {
            console.error('Error al procesar actualización:', error);
        }
    };

    eventSource.onerror = function () {
        console.error('Error en la conexión SSE');
    };

    // Cargar los textos iniciales
    fetch('/textos')
        .then(response => {
            if (!response.ok) throw new Error('Error al cargar textos');
            return response.json();
        })
        .then(actualizarTabla)
        .catch(error => {
            console.error('Error:', error);
        });
});

function exportarAPDF() {
    // Mostrar el loader
    document.getElementById('loader').style.display = 'block';

    // Obtener el ID del guion
    const guionId = document.getElementById('guion-data').getAttribute('data-guion-id');

    // Llamar al backend para generar el PDF
    fetch(`/exportar_pdf/${guionId}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Error al generar el PDF');
            }

            // Obtener el nombre del archivo desde la cabecera Content-Disposition
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = "guion.pdf"; // Nombre por defecto

            if (contentDisposition && contentDisposition.includes('filename=')) {
                // Extraer el nombre del archivo de la cabecera
                filename = contentDisposition
                    .split('filename=')[1]
                    .replace(/['"]/g, ''); // Eliminar comillas si las hay
            }

            return response.blob().then(blob => ({blob, filename}));
        })
        .then(({blob, filename}) => {
            // Crear un enlace para descargar el PDF
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename; // Usar el nombre del archivo desde el backend
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);

            // Ocultar el loader
            document.getElementById('loader').style.display = 'none';
        })
        .catch(error => {
            console.error('Error al generar el PDF:', error);
            // Ocultar el loader en caso de error
            document.getElementById('loader').style.display = 'none';
            alert('Hubo un error al generar el PDF. Por favor, inténtalo de nuevo.');
        });
}
