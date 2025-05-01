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
        const urlRegex = /https?:\/\/[^\s]+/g;
        return texto.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
    }

    async function cargarTextos() {
        try {
            const response = await fetch('/textos');
            if (!response.ok) throw new Error('Error al cargar los textos');
            const textos = await response.json();

            // Filtrar textos por guion_id
            const textosFiltrados = textos.filter(t => t.guion_id == guionId);

            // Ordenar los textos por "numero_de_nota" de menor a mayor
            textosFiltrados.sort((a, b) => a.numero_de_nota - b.numero_de_nota);

            const tbody = document.querySelector('#tablaTextos tbody');
            tbody.innerHTML = ''; // Limpiar la tabla antes de llenarla

            textosFiltrados.forEach(t => {
                const fila = document.createElement('tr');
                if (t.activo) {
                    fila.classList.add('bg-warning'); // Resaltar la fila del texto activo
                }

                // Convertir URLs en enlaces dentro del material
                const materialContent = convertirUrlsEnEnlaces(t.material || '');
                fila.innerHTML = `
                    <td><strong>${t.titulo}</strong></td>
                    <td>${t.contenido}</td>
                    <td>${materialContent}</td>
                    <td><h3>${t.numero_de_nota}</h3></td>
                `;
                tbody.appendChild(fila);

                // Filas para los Graphs asociados al Texto
                if (t.graphs && t.graphs.length > 0) {
                    t.graphs.forEach((g, index) => {
                        const filaGraph = document.createElement('tr');
                        filaGraph.innerHTML = `
                            <td></td>
                            <td class="bg-light" colspan="3">
                                <strong>Graph ${index + 1}</strong><br>
                                <hr>
                                <strong>Activo:</strong> ${g.activo}<br>
                                <strong>Tema:</strong> ${g.tema}<br>
                                <strong>Lugar:</strong> ${g.lugar}<br>
                                <strong>Entrevistado:</strong> ${g.entrevistado}<br>
                                <strong>Primera Línea:</strong> ${g.primera_linea}<br>
                                <strong>Segunda Línea:</strong> ${g.segunda_linea}<br>
                            <div class="btn-group btn-group-sm">
                                <button type="button" class="btn btn-outline-success" onclick="setGraphActivo(${g.id})"><i class="fas fa-check"></i></button>
                                <button class="btn btn-outline-secondary" onclick="editarGraph(${g.id})"><i class="fas fa-edit"></i></button>
                                <button class="btn btn-outline-danger" onclick="eliminarGraph(${g.id})"><i class="fas fa-trash"></i></button>
                            </div>
                            </td>
                        `;
                        tbody.appendChild(filaGraph);
                    });
                }
            });
        } catch (error) {
            console.error('Error al cargar los textos:', error);
        }
    }


    // Actualizar la tabla cada 1 segundo
    setInterval(cargarTextos, 1000);

    // Cargar los textos al abrir la página
    cargarTextos();
});

// Función para activar el graphs
async function setGraphActivo(id) {
    await fetch(`/graphs/activo/${id}`, {
        method: 'PUT'
    });
}