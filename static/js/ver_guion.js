document.addEventListener('DOMContentLoaded', function () {
    // Función para convertir URLs en enlaces
    function convertirUrlsEnEnlaces(texto) {
        // Expresión regular para detectar URLs
        const urlRegex = /https?:\/\/[^\s]+/g;
        return texto.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
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

            // Convertir URLs en enlaces dentro del material
            const materialContent = convertirUrlsEnEnlaces(t.material || '');
            fila.innerHTML = `
                <td>${t.titulo}</td>
                <td>${t.contenido}</td>
                <td>${materialContent}</td>
                <td>${t.numero_de_nota}</td>
            `;
            tbody.appendChild(fila);

            // Filas para los Graphs asociados al Texto

            if (t.graphs && t.graphs.length > 0) {
                t.graphs.forEach(g => {
                    const filaGraph = document.createElement('tr');
                    filaGraph.innerHTML = `
                    <td></td>
                    <td colspan="3">
                        <strong>Lugar:</strong> ${g.lugar}<br>
                        <strong>Entrevistado:</strong> ${g.entrevistado}<br>
                        <strong>Primera Línea:</strong> ${g.primera_linea}<br>
                        <strong>Segunda Línea:</strong> ${g.segunda_linea}
                    </td>
                `;
                    tbody.appendChild(filaGraph);
                });
            }
        });
    }

    // Actualizar la tabla cada 1 segundos
    setInterval(cargarTextos, 1000);

    // Cargar los textos al abrir la página
    cargarTextos();

});


