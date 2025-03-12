function convertirUrlsEnEnlaces(texto) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    return texto.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
}

let previousContent = {
    titulo: "",
    contenido: "",
    material: "",
    musica: ""
};

function actualizarTextoActivo(data) {
    const tituloElement = document.getElementById('texto-activo-titulo');
    const numeroElement = document.getElementById('texto-activo-numero-de-nota');
    const contenidoElement = document.getElementById('texto-activo-contenido');
    const materialElement = document.getElementById('texto-activo-material');
    const musicaElement = document.getElementById('texto-activo-musica');

    if (data.titulo) {
        // Actualizar solo si el contenido ha cambiado
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
    } else {
        if (previousContent.titulo !== "") {
            tituloElement.textContent = "No hay un texto activo seleccionado.";
            previousContent.titulo = "";
        }

        if (previousContent.contenido !== "") {
            contenidoElement.innerHTML = "";
            previousContent.contenido = "";
        }

        if (previousContent.material !== "") {
            materialElement.innerHTML = "";
            previousContent.material = "";
        }
    }
}

// Suscribirse a las actualizaciones del servidor
const eventSource = new EventSource('/stream_texto_activo');

eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    actualizarTextoActivo(data);
};

// Actualizar el texto activo al cargar la página
actualizarTextoActivo({}); // Inicializar con un objeto vacío