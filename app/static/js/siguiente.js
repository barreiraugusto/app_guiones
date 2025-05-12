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

    // Nuevos elementos para graphs
    const graphTemaElement = document.getElementById('graph-tema');
    const graphBajadasElement = document.getElementById('graph-bajadas');
    const graphEntrevistadosElement = document.getElementById('graph-entrevistados');


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
            const graph = data.graphs[0]; // Tomamos el primer graph

            // Actualizar tema
            if (previousContent.graphTema !== graph.tema) {
                graphTemaElement.textContent = graph.tema || '';
                previousContent.graphTema = graph.tema;
            }

            // Actualizar bajadas si existen
            if (graph.bajadas && graph.bajadas.length > 0) {
                if (JSON.stringify(previousContent.graphBajadas) !== JSON.stringify(graph.bajadas)) {
                    graphBajadasElement.innerHTML = '';
                    graph.bajadas.forEach(bajada => {
                        const li = document.createElement('li');
                        li.textContent = bajada;
                        graphBajadasElement.appendChild(li);
                    });
                    previousContent.graphBajadas = [...graph.bajadas];
                }
            } else {
                // Limpiar si no hay bajadas
                graphBajadasElement.innerHTML = '';
                previousContent.graphBajadas = [];
            }

            // Actualizar entrevistados si existen
            if (graph.entrevistados && graph.entrevistados.length > 0) {
                if (JSON.stringify(previousContent.graphEntrevistados) !== JSON.stringify(graph.entrevistados)) {
                    graphEntrevistadosElement.innerHTML = '';

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

                    previousContent.graphEntrevistados = [...graph.entrevistados];
                }
            } else {
                // Limpiar si no hay entrevistados
                graphEntrevistadosElement.innerHTML = '';
                previousContent.graphEntrevistados = [];
            }
        } else {
            // Limpiar todo de graphs si no hay graphs
            graphTemaElement.textContent = '';
            graphBajadasElement.innerHTML = '';
            graphEntrevistadosElement.innerHTML = '';

            previousContent.graphTema = '';
            previousContent.graphBajadas = [];
            previousContent.graphEntrevistados = [];
        }
    } else {
        // Limpiar todo si no hay data
        tituloElement.textContent = "No hay un texto activo seleccionado.";
        contenidoElement.innerHTML = "";
        materialElement.innerHTML = "";
        musicaElement.innerHTML = "";

        // Limpiar los elementos de graph
        graphTemaElement.textContent = "";
        graphBajadasElement.innerHTML = "";
        graphEntrevistadosElement.innerHTML = "";

        // Actualizar previousContent para todo
        previousContent.titulo = "";
        previousContent.numero_de_nota = "";
        previousContent.contenido = "";
        previousContent.material = "";
        previousContent.musica = "";
        previousContent.graphTema = "";
        previousContent.graphBajadas = [];
        previousContent.graphEntrevistados = [];
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