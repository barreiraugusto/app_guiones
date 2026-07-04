document.addEventListener('DOMContentLoaded', function () {
    const guionData = document.getElementById('guion-data');
    const guionId = guionData ? guionData.getAttribute('data-guion-id') : null;

    if (!guionId) {
        console.error('No se encontró el ID del guion.');
        return;
    }

    // ------------------------------------------------------------------
    // Utilidades
    // ------------------------------------------------------------------

    function convertirUrlsEnEnlaces(texto) {
        if (!texto) return '';
        const urlRegex = /https?:\/\/[^\s]+/g;
        return texto.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
    }

    function formatearSaltosDeLinea(texto) {
        if (!texto) return '';
        return texto.replace(/\n/g, '<br>').replace(/  /g, ' &nbsp;');
    }

    function aplicarResaltado(fila, activo, emitido) {
        fila.classList.remove('bg-light', 'bg-secondary', 'bg-warning');
        if (emitido)      fila.classList.add('bg-secondary');
        else if (activo)  fila.classList.add('bg-warning');
        else              fila.classList.add('bg-light');
    }

    // ------------------------------------------------------------------
    // Crear fila de graph (helper compartido)
    // ------------------------------------------------------------------

    function crearFilaGraph(g, textoId, activo, emitido) {
        const bajadas = (g.bajadas || [])
            .map(b => `${b.texto || b}<br>`)
            .join('');

        let entrevistados = '';
        if (g.entrevistados && g.entrevistados.length > 0) {
            entrevistados = g.entrevistados.map(e => `
                <div class="m-0">
                    <strong>${e.nombre}</strong>
                    <div class="m-0">${e.citas.join('<br>')}</div>
                </div>
            `).join('');
        }

        const filaGraph = document.createElement('tr');
        filaGraph.setAttribute('data-graph-id', g.id);
        filaGraph.setAttribute('data-graph-parent', textoId);
        filaGraph.className = 'graph-row';
        filaGraph.innerHTML = `
            <td></td>
            <td colspan="2" class="p-3">
                <div class="m-0">${g.lugar || ''}</div>
                <div class="m-0">${g.tema ? `*${g.tema}` : ''}</div>
                <div class="m-0">${bajadas}</div>
                <div class="m-0">${entrevistados}</div>
            </td>
        `;
        aplicarResaltado(filaGraph, activo, emitido);
        return filaGraph;
    }

    // ------------------------------------------------------------------
    // Construcción de la tabla (se llama UNA SOLA VEZ al cargar)
    // ------------------------------------------------------------------

    // Estado anterior por texto ID (para detectar cambios en SSE)
    const prevTextos = {};

    function construirTabla(textos) {
        const tbody = document.querySelector('#tablaTextos tbody');
        tbody.innerHTML = '';

        textos.sort((a, b) => a.numero_de_nota - b.numero_de_nota);

        textos.forEach((t, index) => {
            const numGraphs = t.graphs ? t.graphs.length : 0;
            const rowspan  = numGraphs > 0 ? numGraphs + 1 : 1;
            const material = convertirUrlsEnEnlaces(formatearSaltosDeLinea(t.material || ''));

            // --- Fila principal ---
            const filaTexto = document.createElement('tr');
            filaTexto.setAttribute('data-texto-id', t.id);
            filaTexto.innerHTML = `
                <td rowspan="${rowspan}" class="text-center">
                    <h3>${t.numero_de_nota}</h3>
                    <div class="btn-group">
                        <button type="button" class="btn btn-outline-primary" onclick="setTextoActivo(${t.id})">
                            <i class="fas fa-arrow-right"></i>
                        </button>
                        <button type="button" class="btn btn-outline-success" onclick="setTextoEmitido(${t.id})">
                            <i class="fas fa-check"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <strong>${t.titulo}</strong>
                    ${t.grabar ? '<div class="text-danger small font-weight-bold">GRABAR</div>' : ''}
                </td>
                <td>${t.contenido || ''}</td>
                <td>${material}</td>
            `;
            aplicarResaltado(filaTexto, t.activo, t.emitido);
            tbody.appendChild(filaTexto);

            // --- Filas de graphs ---
            if (t.graphs && t.graphs.length > 0) {
                const graphsOrdenados = [...t.graphs]
                    .sort((a, b) => (a.id || 0) - (b.id || 0))
                    .reverse();

                graphsOrdenados.forEach(g => {
                    tbody.appendChild(crearFilaGraph(g, t.id, t.activo, t.emitido));
                });
            }

            // --- Separador entre notas ---
            if (index < textos.length - 1) {
                const sep = document.createElement('tr');
                sep.className = 'linea-separadora';
                sep.innerHTML = '<td colspan="4" style="height: 3px; background-color: #495057; border: none; padding: 0;"></td>';
                tbody.appendChild(sep);
            }

            // Inicializar estado previo para evitar actualizaciones redundantes al primer SSE
            prevTextos[t.id] = {
                activo:    t.activo,
                emitido:   t.emitido,
                titulo:    t.titulo,
                grabar:    t.grabar,
                contenido: t.contenido,
                material:  t.material,
                graphsJson: JSON.stringify(t.graphs || [])
            };
        });
    }

    // ------------------------------------------------------------------
    // Actualizar filas de graphs dinámicamente (cuando cambia su contenido)
    // ------------------------------------------------------------------

    function actualizarGraphRows(filaTexto, t) {
        document.querySelectorAll(`tr[data-graph-parent="${t.id}"]`).forEach(gr => gr.remove());

        const numGraphs = t.graphs ? t.graphs.length : 0;
        filaTexto.cells[0].rowSpan = numGraphs > 0 ? numGraphs + 1 : 1;

        if (numGraphs > 0) {
            const graphsOrdenados = [...t.graphs]
                .sort((a, b) => (a.id || 0) - (b.id || 0))
                .reverse();

            let insertAfter = filaTexto;
            graphsOrdenados.forEach(g => {
                const filaGraph = crearFilaGraph(g, t.id, t.activo, t.emitido);
                insertAfter.insertAdjacentElement('afterend', filaGraph);
                insertAfter = filaGraph;
            });
        }
    }

    // ------------------------------------------------------------------
    // Actualización vía SSE: detecta cambios y actualiza solo lo necesario
    // ------------------------------------------------------------------

    function actualizarTextos(textos) {
        textos.forEach(t => {
            const fila = document.querySelector(`tr[data-texto-id="${t.id}"]`);
            if (!fila) return;

            const prev = prevTextos[t.id] || {};

            // Estado (activo/emitido) → color de fila
            if (prev.activo !== t.activo || prev.emitido !== t.emitido) {
                aplicarResaltado(fila, t.activo, t.emitido);
                document.querySelectorAll(`tr[data-graph-parent="${t.id}"]`).forEach(gr => {
                    aplicarResaltado(gr, t.activo, t.emitido);
                });
            }

            // Título + indicador GRABAR
            if (prev.titulo !== t.titulo || prev.grabar !== t.grabar) {
                fila.cells[1].innerHTML = `
                    <strong>${t.titulo}</strong>
                    ${t.grabar ? '<div class="text-danger small font-weight-bold">GRABAR</div>' : ''}
                `;
            }

            // Contenido
            if (prev.contenido !== t.contenido) {
                fila.cells[2].innerHTML = t.contenido || '';
            }

            // Material / Código
            if (prev.material !== t.material) {
                fila.cells[3].innerHTML = convertirUrlsEnEnlaces(formatearSaltosDeLinea(t.material || ''));
            }

            // Graphs (reconstruye solo las filas de este texto si cambiaron)
            const graphsJson = JSON.stringify(t.graphs || []);
            if (prev.graphsJson !== graphsJson) {
                actualizarGraphRows(fila, t);
            }

            prevTextos[t.id] = {
                activo:    t.activo,
                emitido:   t.emitido,
                titulo:    t.titulo,
                grabar:    t.grabar,
                contenido: t.contenido,
                material:  t.material,
                graphsJson
            };
        });
    }

    // ------------------------------------------------------------------
    // Carga inicial completa
    // ------------------------------------------------------------------

    fetch(`/guiones/${guionId}`)
        .then(r => {
            if (!r.ok) throw new Error('Error al cargar el guion');
            return r.json();
        })
        .then(data => {
            construirTabla(data.textos || []);
            actualizarTiempoTotal(guionId);
        })
        .catch(error => console.error('Error al cargar guion:', error));

    // ------------------------------------------------------------------
    // SSE: detecta cambios de contenido y estado cada 2s
    // ------------------------------------------------------------------

    const eventSource = new EventSource(`/stream_guion/${guionId}`);

    eventSource.onmessage = function (event) {
        try {
            actualizarTextos(JSON.parse(event.data));
        } catch (error) {
            console.error('Error al procesar actualización:', error);
        }
    };

    eventSource.onerror = function () {
        console.error('Error en la conexión SSE');
    };
});


// ------------------------------------------------------------------
// Exportar a PDF (via backend WeasyPrint)
// ------------------------------------------------------------------

function exportarAPDF() {
    document.getElementById('loader').style.display = 'block';
    const guionId = document.getElementById('guion-data').getAttribute('data-guion-id');

    fetch(`/exportar_pdf/${guionId}`)
        .then(response => {
            if (!response.ok) throw new Error('Error al generar el PDF');
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'guion.pdf';
            if (contentDisposition && contentDisposition.includes('filename=')) {
                filename = contentDisposition.split('filename=')[1].replace(/['"]/g, '');
            }
            return response.blob().then(blob => ({ blob, filename }));
        })
        .then(({ blob, filename }) => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            document.getElementById('loader').style.display = 'none';
        })
        .catch(error => {
            console.error('Error al generar el PDF:', error);
            document.getElementById('loader').style.display = 'none';
            alert('Hubo un error al generar el PDF. Por favor, inténtalo de nuevo.');
        });
}
