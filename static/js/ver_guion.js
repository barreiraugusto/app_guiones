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

                // Convertir URLs en enlaces dentro del material
                const materialContent = convertirUrlsEnEnlaces(t.material || '');
                fila.innerHTML = `
                    <td class="bg-secondary text-white text-center"><h3>${t.numero_de_nota}</h3></td>
                    <td><strong>${t.titulo}</strong></td>  
                    <td>${t.contenido}</td> 
                    <td>${materialContent}</td>
                    <td>${t.musica}</td>
                `;
                tbody.appendChild(fila);

                // Filas para los Graphs asociados al Texto
                if (t.graphs && t.graphs.length > 0) {
                    t.graphs.forEach((g, index) => {
                        const filaGraph = document.createElement('tr');
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

function exportarAPDF() {
    // Mostrar el loader
    document.getElementById('loader').style.display = 'block';

    if (typeof html2canvas === 'undefined') {
        console.error('html2canvas no está cargado.');
        document.getElementById('loader').style.display = 'none'; // Ocultar el loader en caso de error
        return;
    }

    const elemento = document.querySelector('.card');
    const tituloGuion = document.querySelector('.card-header h2').innerText;

    html2canvas(elemento, {
        scale: 2,
        useCORS: true,
        logging: true,
        scrollY: -window.scrollY,
        windowHeight: elemento.scrollHeight,
    }).then((canvas) => {
        const {jsPDF} = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const imgData = canvas.toDataURL('image/png');
        const imgWidth = doc.internal.pageSize.getWidth();
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let position = 0;
        const pageHeight = doc.internal.pageSize.getHeight();

        while (position < imgHeight) {
            doc.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);
            position += pageHeight;

            if (position < imgHeight) {
                doc.addPage();
            }
        }

        doc.save(`${tituloGuion}.pdf`);

        // Ocultar el loader una vez que el PDF se haya generado
        document.getElementById('loader').style.display = 'none';
    }).catch((error) => {
        console.error('Error al generar el PDF:', error);
        document.getElementById('loader').style.display = 'none'; // Ocultar el loader en caso de error
    });
}
