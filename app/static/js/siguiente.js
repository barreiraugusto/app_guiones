function convertirUrlsEnEnlaces(texto) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return texto.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
}

const previousContent = {
    titulo: "",
    numero_de_nota: "",
    contenido: "",
    material: "",
    musica: "",
    graphTema: "",
    graphBajadas: [],
    graphEntrevistados: []
};

function actualizarTextoActivo(data) {
    const tituloElement = document.getElementById('texto-activo-titulo');
    const numeroElement = document.getElementById('texto-activo-numero-de-nota');
    const contenidoElement = document.getElementById('texto-activo-contenido');
    const materialElement = document.getElementById('texto-activo-material');
    const musicaElement = document.getElementById('texto-activo-musica');

    // Elementos contenedores para múltiples graphs
    const graphsContainerElement = document.getElementById('graphs-container'); // Asegúrate de tener este contenedor en tu HTML

    if (data && data.titulo) {
        // Actualizar solo si el contenido ha cambiado (parte original)
        if (previousContent.titulo !== data.titulo) {
            tituloElement.textContent = `${data.titulo}`;
            previousContent.titulo = data.titulo;
        }

        if (previousContent.numero_de_nota !== data.numero_de_nota) {
            numeroElement.textContent = `${data.numero_de_nota}`;
            previousContent.numero_de_nota = data.numero_de_nota;
        }

        if (previousContent.contenido !== data.contenido) {
            contenidoElement.innerHTML = data.contenido;
            previousContent.contenido = data.contenido;
        }

        if (previousContent.material !== data.material) {
            materialElement.innerHTML = convertirUrlsEnEnlaces(data.material || '');
            previousContent.material = data.material;
        }

        if (previousContent.musica !== data.musica) {
            musicaElement.innerHTML = convertirUrlsEnEnlaces(data.musica || '').toUpperCase();
            previousContent.musica = data.musica;
        }

        // Actualizar información de graphs si existe
        if (data.graphs && data.graphs.length > 0) {
            // Limpiar el contenedor de graphs
            graphsContainerElement.innerHTML = '';

            // Iterar sobre todos los graphs
            data.graphs.forEach((graph, index) => {
                // Crear un contenedor para cada graph
                const graphElement = document.createElement('div');
                graphElement.className = 'graph-container';

                // Crear elementos para este graph específico
                const graphTemaElement = document.createElement('h4');
                graphTemaElement.className = 'graph-tema';
                graphTemaElement.textContent = graph.tema || `Graph ${index + 1}`;
                graphElement.appendChild(graphTemaElement);

                // Crear elemento para bajadas
                const graphBajadasElement = document.createElement('ul');
                graphBajadasElement.className = 'graph-bajadas';

                // Actualizar bajadas si existen
                if (graph.bajadas && graph.bajadas.length > 0) {
                    graph.bajadas.forEach(bajada => {
                        const li = document.createElement('li');
                        li.textContent = bajada;
                        graphBajadasElement.appendChild(li);
                    });
                }
                graphElement.appendChild(graphBajadasElement);

                // Crear elemento para entrevistados
                const graphEntrevistadosElement = document.createElement('div');
                graphEntrevistadosElement.className = 'graph-entrevistados';

                // Actualizar entrevistados si existen
                if (graph.entrevistados && graph.entrevistados.length > 0) {
                    graph.entrevistados.forEach(entrevistado => {
                        const entrevistadoDiv = document.createElement('div');
                        entrevistadoDiv.className = 'entrevistado';

                        const nombreH5 = document.createElement('h5');
                        nombreH5.textContent = entrevistado.nombre;
                        entrevistadoDiv.appendChild(nombreH5);

                        if (entrevistado.citas && entrevistado.citas.length > 0) {
                            const citasUl = document.createElement('ul');
                            entrevistado.citas.forEach(cita => {
                                const li = document.createElement('li');
                                li.textContent = cita;
                                citasUl.appendChild(li);
                            });
                            entrevistadoDiv.appendChild(citasUl);
                        }

                        graphEntrevistadosElement.appendChild(entrevistadoDiv);
                    });
                }
                graphElement.appendChild(graphEntrevistadosElement);

                // Agregar el graph al contenedor principal
                graphsContainerElement.appendChild(graphElement);
            });

            // Actualizar previousContent para graphs
            previousContent.graphs = [...data.graphs];
        } else {
            // Limpiar todo de graphs si no hay graphs
            graphsContainerElement.innerHTML = '';
            previousContent.graphs = [];
        }
    } else {
        // Limpiar todo si no hay data
        tituloElement.textContent = "No hay un texto activo seleccionado.";
        contenidoElement.innerHTML = "";
        materialElement.innerHTML = "";
        musicaElement.innerHTML = "";
        graphsContainerElement.innerHTML = "";

        // Actualizar previousContent para todo
        previousContent.titulo = "";
        previousContent.numero_de_nota = "";
        previousContent.contenido = "";
        previousContent.material = "";
        previousContent.musica = "";
        previousContent.graphs = [];
    }
}

// Suscribirse a las actualizaciones del servidor
const eventSource = new EventSource('/stream_texto_activo');

eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);
    actualizarTextoActivo(data);
};

// Actualizar el texto activo al cargar la página
actualizarTextoActivo({}); // Inicializar con un objeto vacío