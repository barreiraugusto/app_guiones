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

    // Función para actualizar la tabla
    function esVideo(url) {
        return url.match(/\.(mp4|webm|ogg)/i); // Verificar si la URL es un video
    }

    function actualizarTabla(textos) {
        const tbody = document.querySelector('#tablaTextos tbody');
        const filasExistentes = tbody.querySelectorAll('tr');
        const textosFiltrados = textos.filter(t => t.guion_id == guionId);

        // Ordenar los textos por "numero_de_nota" de menor a mayor
        textosFiltrados.sort((a, b) => a.numero_de_nota - b.numero_de_nota);

        // Crear un mapa de los textos actuales para comparar con los existentes
        const textosMap = new Map(textosFiltrados.map(t => [t.id, t]));

        // Eliminar filas que ya no están en los datos actualizados
        filasExistentes.forEach(fila => {
            const textoId = fila.getAttribute('data-texto-id');
            if (!textosMap.has(Number(textoId))) {
                fila.remove();
            }
        });

        // Actualizar o agregar filas
        textosFiltrados.forEach(t => {
            let fila = tbody.querySelector(`tr[data-texto-id="${t.id}"]`);

            if (!fila) {
                // Crear una nueva fila si no existe
                fila = document.createElement('tr');
                fila.setAttribute('data-texto-id', t.id);
                tbody.appendChild(fila);
            }

            // Convertir URLs en enlaces dentro del material
            const materialContent = convertirUrlsEnEnlaces(t.material || '');

            // Verificar si el contenido ha cambiado antes de actualizar
            const tituloActual = fila.querySelector('td:nth-child(2) strong')?.textContent;
            const contenidoActual = fila.querySelector('.contenido')?.innerHTML;
            const materialActual = fila.querySelector('.material')?.innerHTML;
            const musicaActual = fila.querySelector('.musica')?.innerHTML;
            const duracionActual = fila.querySelector('.duracion')?.innerHTML;

            if (tituloActual !== t.titulo || contenidoActual !== t.contenido || materialActual !== materialContent || musicaActual !== t.musica || duracionActual !== t.duracion) {
                // Actualizar el contenido de la fila solo si ha cambiado
                fila.innerHTML = `
                <td class="bg-secondary text-white text-center"><h3>${t.numero_de_nota}</h3></td>
                <td><strong>${t.titulo}</strong></td>  
                <td class="contenido">${t.contenido}</td> 
                <td class="material">${materialContent}</td>
                <td class="musica">${t.musica}</td>
<!--                <td class="duracion">${t.duracion}</td>-->
            `;
            }

            // Filas para los Graphs asociados al Texto
            if (t.graphs && t.graphs.length > 0) {
                // Eliminar los graphs existentes asociados a este texto
                const graphsExistentes = tbody.querySelectorAll(`tr[data-graph-parent-id="${t.id}"]`);
                graphsExistentes.forEach(graph => graph.remove());

                // Insertar los graphs debajo de la fila del texto
                t.graphs.forEach((g, index) => {
                    const filaGraph = document.createElement('tr');
                    filaGraph.setAttribute('data-graph-id', g.id);
                    filaGraph.setAttribute('data-graph-parent-id', t.id); // Asociar el graph al texto
                    filaGraph.innerHTML = `
                    <td></td>
                    <td></td>
                    <td class="bg-light" colspan="3">
                        <strong>Graph ${index + 1}</strong><br>
                        <hr>
                        <strong>Lugar:</strong> ${g.lugar}<br>
                        <strong>Tema:</strong> ${g.tema}<br>
                        <strong>Entrevistado:</strong> ${g.entrevistado}<br>
                        <strong>Primera Línea:</strong> ${g.primera_linea}<br>
                        <strong>Segunda Línea:</strong> ${g.segunda_linea}<br> 
                    </td>
                `;
                    // Insertar el graph debajo de la fila del texto
                    fila.insertAdjacentElement('afterend', filaGraph);
                });
            }
        });
    }

    // Suscribirse a las actualizaciones del servidor
    const eventSource = new EventSource('/stream_textos');

    eventSource.onmessage = function (event) {
        const textos = JSON.parse(event.data);
        actualizarTabla(textos);
    };

    // Cargar los textos al abrir la página
    fetch('/textos')
        .then(response => response.json())
        .then(textos => actualizarTabla(textos))
        .catch(error => console.error('Error al cargar los textos:', error));
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

            return response.blob().then(blob => ({ blob, filename }));
        })
        .then(({ blob, filename }) => {
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
