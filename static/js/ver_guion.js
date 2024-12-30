document.addEventListener('DOMContentLoaded', function () {
    // Función para convertir URLs en enlaces
    function convertirUrlsEnEnlaces(texto) {
        // Expresión regular para detectar URLs
        const urlRegex = /https?:\/\/[^\s]+/g;
        return texto.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
    }

    async function cargarTextos() {
        // Obtener el ID del guion desde el atributo data-guion-id
        const guionData = document.getElementById('guion-data');
        const guionId = guionData.dataset.guionId;

        const response = await fetch(`/obtener_textos_guion/${guionId}`);
        const textos = await response.json();
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
        });
    }

    // Actualizar la tabla cada 1 segundos
    setInterval(cargarTextos, 1000);

    // Cargar los textos al abrir la página
    cargarTextos();
});