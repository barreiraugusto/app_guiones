/* siguiente.js — Próxima Nota
   Muestra en tiempo real el texto activo vía SSE.
   Compatible con el nuevo diseño oscuro de siguiente.html.
*/

function convertirUrlsEnEnlaces(texto) {
    if (!texto) return '';
    const urlRegex = /https?:\/\/[^\s]+/g;
    return texto.replace(urlRegex, url => `<a href="${url}" target="_blank" style="color:#64b5f6;">${url}</a>`);
}

const prev = {
    titulo: null,
    numero_de_nota: null,
    grabar: null,
    contenido: null,
    material: null,
    musica: null,
    graphs: null,
};

function actualizarTextoActivo(data) {
    const elNum      = document.getElementById('texto-activo-numero-de-nota');
    const elTitulo   = document.getElementById('texto-activo-titulo');
    const elGrabar   = document.getElementById('texto-activo-grabar');
    const elContenido= document.getElementById('texto-activo-contenido');
    const elMaterial = document.getElementById('texto-activo-material');
    const elMusica   = document.getElementById('texto-activo-musica');
    const elGraphs   = document.getElementById('graphs-container');

    if (!data || !data.titulo) {
        // Sin nota activa
        if (prev.titulo !== '') {
            elNum.textContent = '';
            elTitulo.textContent = 'Esperando nota activa…';
            elGrabar.classList.remove('visible');
            elContenido.innerHTML = '';
            elMaterial.innerHTML = '';
            elMusica.innerHTML = '';
            elGraphs.innerHTML = '';
            prev.titulo = '';
            prev.numero_de_nota = '';
            prev.grabar = false;
            prev.contenido = '';
            prev.material = '';
            prev.musica = '';
            prev.graphs = null;
        }
        return;
    }

    if (prev.numero_de_nota !== data.numero_de_nota) {
        elNum.textContent = data.numero_de_nota ?? '';
        prev.numero_de_nota = data.numero_de_nota;
    }

    if (prev.titulo !== data.titulo) {
        elTitulo.textContent = data.titulo;
        prev.titulo = data.titulo;
    }

    if (prev.grabar !== data.grabar) {
        if (data.grabar) {
            elGrabar.classList.add('visible');
        } else {
            elGrabar.classList.remove('visible');
        }
        prev.grabar = data.grabar;
    }

    if (prev.contenido !== data.contenido) {
        elContenido.innerHTML = data.contenido || '';
        prev.contenido = data.contenido;
    }

    if (prev.material !== data.material) {
        elMaterial.innerHTML = convertirUrlsEnEnlaces(data.material || '');
        prev.material = data.material;
    }

    if (prev.musica !== data.musica) {
        elMusica.textContent = (data.musica || '').toUpperCase();
        prev.musica = data.musica;
    }

    // Graphs: sólo re-render si cambiaron (comparación por JSON)
    const graphsJson = JSON.stringify(data.graphs || []);
    if (prev.graphs !== graphsJson) {
        renderGraphs(elGraphs, data.graphs || []);
        prev.graphs = graphsJson;
    }
}

function renderGraphs(container, graphs) {
    container.innerHTML = '';

    if (!graphs || graphs.length === 0) return;

    graphs.forEach(g => {
        const card = document.createElement('div');
        card.className = 'pn-graph-card';

        // Lugar
        if (g.lugar) {
            const lugar = document.createElement('div');
            lugar.className = 'pn-graph-lugar';
            lugar.textContent = g.lugar;
            card.appendChild(lugar);
        }

        // Tema
        if (g.tema) {
            const tema = document.createElement('div');
            tema.className = 'pn-graph-tema';
            tema.textContent = g.tema;
            card.appendChild(tema);
        }

        // Bajadas
        if (g.bajadas && g.bajadas.length > 0) {
            const list = document.createElement('div');
            list.className = 'pn-bajadas-list';
            g.bajadas.forEach(b => {
                const item = document.createElement('div');
                item.className = 'pn-bajada';
                item.textContent = b;
                list.appendChild(item);
            });
            card.appendChild(list);
        }

        // Entrevistados
        if (g.entrevistados && g.entrevistados.length > 0) {
            g.entrevistados.forEach(e => {
                if (!e.nombre) return;
                const entDiv = document.createElement('div');
                entDiv.className = 'pn-entrevistado';

                const nombre = document.createElement('div');
                nombre.className = 'pn-entrevistado-nombre';
                nombre.textContent = e.nombre;
                entDiv.appendChild(nombre);

                if (e.citas && e.citas.length > 0) {
                    e.citas.forEach(c => {
                        if (!c || c === 'Sin cita') return;
                        const cita = document.createElement('div');
                        cita.className = 'pn-cita';
                        cita.textContent = `"${c}"`;
                        entDiv.appendChild(cita);
                    });
                }

                card.appendChild(entDiv);
            });
        }

        container.appendChild(card);
    });
}

// ── SSE ────────────────────────────────────────
const eventSource = new EventSource('/stream_texto_activo');

eventSource.onmessage = function (event) {
    try {
        const data = JSON.parse(event.data);
        actualizarTextoActivo(data);
    } catch (e) {
        console.error('siguiente.js: error al parsear SSE', e);
    }
};

eventSource.onerror = function () {
    console.warn('siguiente.js: conexión SSE interrumpida, reintentando…');
};

// Estado inicial vacío
actualizarTextoActivo({});
