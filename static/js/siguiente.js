// Función para convertir URLs en enlaces
function convertirUrlsEnEnlaces(texto) {
    // Expresión regular para detectar URLs
    const urlRegex = /https?:\/\/[^\s]+/g;
    return texto.replace(urlRegex, url => `<a href="${url}" target="_blank">${url}</a>`);
}

async function actualizarTextoActivo() {
    const response = await fetch('/obtener_texto_activo');
    const data = await response.json();
    const tituloElement = document.getElementById('texto-activo-titulo');
    const numeroElement = document.getElementById('texto-activo-numero-de-nota');
    const contenidoElement = document.getElementById('texto-activo-contenido');
    const materialElement = document.getElementById('texto-activo-material');
    const musicaElement = document.getElementById('texto-activo-musica');

    if (data.titulo) {
        tituloElement.textContent = `${data.titulo}`;
        numeroElement.textContent = `${data.numero_de_nota}`;
        contenidoElement.innerHTML = data.contenido; // Usar innerHTML para renderizar HTML

        // Convertir URLs en enlaces dentro del material
        materialElement.innerHTML = convertirUrlsEnEnlaces(data.material || '');
        musicaElement.innerHTML = convertirUrlsEnEnlaces(data.musica || '').toUpperCase();
    } else {
        tituloElement.textContent = "No hay un texto activo seleccionado.";
        contenidoElement.innerHTML = ""; // Usar innerHTML para limpiar el contenido
        materialElement.innerHTML = "";
    }
}

// Actualizar el texto activo cada 1 segundos
setInterval(actualizarTextoActivo, 1000);

// Actualizar el texto activo al cargar la página
actualizarTextoActivo();