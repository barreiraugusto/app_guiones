const ANCHO_LIENZO = 1920;
const ALTO_LIENZO = 1080;
const ESCALA_LIENZO = 0.5;

let tickerState = {};
let liveState = {};
let plantillaActual = null;
let elementoSeleccionado = null; // 'ticker' | 'live' | null

document.addEventListener('DOMContentLoaded', () => {
    cargarConfig();
    setupEventSource();
    document.getElementById('lienzo-control').addEventListener('click', () => {
        seleccionarElemento(null);
    });
});

async function cargarConfig() {
    const response = await fetch('/get_display_config');
    const config = await response.json();

    tickerState = {
        show: !!(config.ticker && config.ticker.show),
        text: (config.ticker && config.ticker.text) || '',
        speed_seconds: parseFloat(config.ticker && config.ticker.speed_seconds) || 15,
        color: (config.ticker && config.ticker.color) || '#ffffff',
        bg_color: (config.ticker && config.ticker.bg_color) || '#000000',
        top: parseFloat(config.ticker && config.ticker.top) || 1000,
        height: parseFloat(config.ticker && config.ticker.height) || 50,
    };

    liveState = {
        show: !!(config.live && config.live.show),
        text: (config.live && config.live.text) || 'VIVO',
        top: parseFloat(config.live && config.live.top) || 150,
        left: parseFloat(config.live && config.live.left) || 1550,
    };

    renderizarLienzo();
    renderizarPanelPropiedades();
}

let eventSource;

function setupEventSource() {
    eventSource = new EventSource('/stream_display_config');
    eventSource.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            plantillaActual = data.plantilla || null;
            renderizarLienzo();
        } catch (error) {
            console.error('Error al analizar datos del SSE:', error);
        }
    };
}

function renderizarLienzo() {
    const lienzo = document.getElementById('lienzo-control');
    lienzo.innerHTML = '';

    if (plantillaActual) {
        plantillaActual.capas
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .forEach(capa => lienzo.appendChild(crearElementoZocalo(capa)));
    }

    lienzo.appendChild(crearElementoTicker());
    lienzo.appendChild(crearElementoLive());
}

function crearElementoZocalo(capa) {
    let el;
    if (capa.tipo === 'texto') {
        el = document.createElement('div');
        el.classList.add('elemento-control', 'capa-texto');
        el.style.fontFamily = capa.fuente;
        el.style.fontSize = `${capa.tamano_fuente}px`;
        el.style.color = capa.color;
        el.style.justifyContent = capa.alineacion === 'center' ? 'center' : (capa.alineacion === 'right' ? 'flex-end' : 'flex-start');
        el.textContent = capa.valor || '';
    } else if (capa.tipo === 'video') {
        el = document.createElement('video');
        el.classList.add('elemento-control', 'capa-media');
        el.src = `/static/${capa.archivo}`;
        el.muted = true;
        el.autoplay = true;
        el.loop = !!capa.loop;
        el.playsInline = true;
    } else {
        el = document.createElement('img');
        el.classList.add('elemento-control', 'capa-media');
        el.src = `/static/${capa.archivo}`;
    }
    el.style.left = `${capa.x}px`;
    el.style.top = `${capa.y}px`;
    el.style.width = `${capa.ancho}px`;
    el.style.height = `${capa.alto}px`;
    el.style.zIndex = capa.orden;
    return el;
}

function crearElementoTicker() {
    const el = document.createElement('div');
    el.id = 'ticker-editor';
    el.className = 'elemento-control elemento-editable' + (elementoSeleccionado === 'ticker' ? ' seleccionada' : '');
    el.style.left = '0px';
    el.style.width = `${ANCHO_LIENZO}px`;
    el.style.top = `${tickerState.top}px`;
    el.style.height = `${tickerState.height}px`;
    el.style.backgroundColor = tickerState.bg_color;
    el.style.color = tickerState.color;
    el.style.zIndex = 900;
    el.style.opacity = tickerState.show ? '1' : '0.35';
    el.textContent = tickerState.text || '(ticker vacío)';

    el.addEventListener('mousedown', iniciarArrastreTicker);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarElemento('ticker');
    });

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.addEventListener('mousedown', iniciarResizeTicker);
    el.appendChild(handle);

    return el;
}

function crearElementoLive() {
    const el = document.createElement('div');
    el.id = 'live-editor';
    el.className = 'elemento-control elemento-editable' + (elementoSeleccionado === 'live' ? ' seleccionada' : '');
    el.style.left = `${liveState.left}px`;
    el.style.top = `${liveState.top}px`;
    el.style.backgroundColor = '#666';
    el.style.zIndex = 1000;
    el.style.opacity = liveState.show ? '1' : '0.35';
    el.textContent = liveState.text || 'VIVO';

    el.addEventListener('mousedown', iniciarArrastreLive);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarElemento('live');
    });

    return el;
}

function seleccionarElemento(nombre) {
    elementoSeleccionado = nombre;
    renderizarLienzo();
    renderizarPanelPropiedades();
}

function renderizarPanelPropiedades() {
    const panel = document.getElementById('panel-propiedades-control');

    if (elementoSeleccionado === 'ticker') {
        panel.innerHTML = `
            <h6>Ticker</h6>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-ticker-show" ${tickerState.show ? 'checked' : ''}>
                <label class="form-check-label" for="prop-ticker-show">Mostrar</label>
            </div>
            <div class="form-group mb-2">
                <label>Texto</label>
                <input type="text" class="form-control" id="prop-ticker-text">
            </div>
            <div class="form-group mb-2">
                <label>Velocidad (seg/vuelta)</label>
                <input type="number" class="form-control" id="prop-ticker-speed" min="1" value="${tickerState.speed_seconds}">
            </div>
            <div class="form-group mb-2">
                <label>Color texto</label>
                <input type="color" class="form-control" id="prop-ticker-color" value="${tickerState.color}">
            </div>
            <div class="form-group mb-2">
                <label>Color fondo</label>
                <input type="color" class="form-control" id="prop-ticker-bgcolor" value="${tickerState.bg_color}">
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-ticker-top" value="${tickerState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-ticker-height" value="${tickerState.height}"></div>
            </div>
        `;
        document.getElementById('prop-ticker-text').value = tickerState.text;

        document.getElementById('prop-ticker-show').addEventListener('change', (e) => {
            tickerState.show = e.target.checked;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-text').addEventListener('blur', (e) => {
            tickerState.text = e.target.value;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-speed').addEventListener('blur', (e) => {
            tickerState.speed_seconds = parseFloat(e.target.value) || 15;
            guardarSeccion('ticker', tickerState);
        });
        document.getElementById('prop-ticker-color').addEventListener('change', (e) => {
            tickerState.color = e.target.value;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-bgcolor').addEventListener('change', (e) => {
            tickerState.bg_color = e.target.value;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-top').addEventListener('blur', (e) => {
            tickerState.top = parseFloat(e.target.value) || 0;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-height').addEventListener('blur', (e) => {
            tickerState.height = parseFloat(e.target.value) || 10;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        return;
    }

    if (elementoSeleccionado === 'live') {
        panel.innerHTML = `
            <h6>Vivo</h6>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-live-show" ${liveState.show ? 'checked' : ''}>
                <label class="form-check-label" for="prop-live-show">Mostrar</label>
            </div>
            <div class="form-group mb-2">
                <label>Texto</label>
                <input type="text" class="form-control" id="prop-live-text">
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-live-top" value="${liveState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-live-left" value="${liveState.left}"></div>
            </div>
        `;
        document.getElementById('prop-live-text').value = liveState.text;

        document.getElementById('prop-live-show').addEventListener('change', (e) => {
            liveState.show = e.target.checked;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-text').addEventListener('blur', (e) => {
            liveState.text = e.target.value;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-top').addEventListener('blur', (e) => {
            liveState.top = parseFloat(e.target.value) || 0;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-left').addEventListener('blur', (e) => {
            liveState.left = parseFloat(e.target.value) || 0;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        return;
    }

    panel.innerHTML = '<p class="text-muted">Seleccioná el ticker o el badge Vivo para editar sus propiedades.</p>';
}

let arrastreTicker = null;

function iniciarArrastreTicker(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('ticker');
    arrastreTicker = { yInicial: e.clientY, topInicial: tickerState.top };
    document.addEventListener('mousemove', moverArrastreTicker);
    document.addEventListener('mouseup', finalizarArrastreTicker);
}

function moverArrastreTicker(e) {
    if (!arrastreTicker) return;
    const deltaY = (e.clientY - arrastreTicker.yInicial) / ESCALA_LIENZO;
    tickerState.top = Math.max(0, Math.round(arrastreTicker.topInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastreTicker() {
    if (!arrastreTicker) return;
    arrastreTicker = null;
    document.removeEventListener('mousemove', moverArrastreTicker);
    document.removeEventListener('mouseup', finalizarArrastreTicker);
    guardarSeccion('ticker', tickerState);
    renderizarPanelPropiedades();
}

let resizeTicker = null;

function iniciarResizeTicker(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('ticker');
    resizeTicker = { yInicial: e.clientY, alturaInicial: tickerState.height };
    document.addEventListener('mousemove', moverResizeTicker);
    document.addEventListener('mouseup', finalizarResizeTicker);
}

function moverResizeTicker(e) {
    if (!resizeTicker) return;
    const deltaY = (e.clientY - resizeTicker.yInicial) / ESCALA_LIENZO;
    tickerState.height = Math.max(10, Math.round(resizeTicker.alturaInicial + deltaY));
    renderizarLienzo();
}

function finalizarResizeTicker() {
    if (!resizeTicker) return;
    resizeTicker = null;
    document.removeEventListener('mousemove', moverResizeTicker);
    document.removeEventListener('mouseup', finalizarResizeTicker);
    guardarSeccion('ticker', tickerState);
    renderizarPanelPropiedades();
}

function guardarSeccion(nombre, datos) {
    fetch('/update_display_config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [nombre]: datos })
    }).catch(error => console.error(`Error al guardar ${nombre}:`, error));
}

let arrastreLive = null;

function iniciarArrastreLive(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('live');
    arrastreLive = { xInicial: e.clientX, yInicial: e.clientY, leftInicial: liveState.left, topInicial: liveState.top };
    document.addEventListener('mousemove', moverArrastreLive);
    document.addEventListener('mouseup', finalizarArrastreLive);
}

function moverArrastreLive(e) {
    if (!arrastreLive) return;
    const deltaX = (e.clientX - arrastreLive.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastreLive.yInicial) / ESCALA_LIENZO;
    liveState.left = Math.max(0, Math.round(arrastreLive.leftInicial + deltaX));
    liveState.top = Math.max(0, Math.round(arrastreLive.topInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastreLive() {
    if (!arrastreLive) return;
    arrastreLive = null;
    document.removeEventListener('mousemove', moverArrastreLive);
    document.removeEventListener('mouseup', finalizarArrastreLive);
    guardarSeccion('live', liveState);
    renderizarPanelPropiedades();
}

let guionId;

async function cargarNotasYGraphs() {
    try {
        const response = await fetch('/textos');
        const textos = await response.json();
        const textosFiltrados = textos
            .filter(t => t.guion_id == guionId)
            .sort((a, b) => a.numero_de_nota - b.numero_de_nota);

        const contenedor = document.getElementById('lista-notas');
        contenedor.innerHTML = '';

        textosFiltrados.forEach(t => {
            const notaDiv = document.createElement('div');
            notaDiv.className = 'mb-2 border-bottom pb-2';

            const graphsHtml = (t.graphs || []).map(g => `
                <div class="d-flex justify-content-between align-items-center small ${g.activo ? 'bg-warning' : ''} p-1 rounded">
                    <span style="cursor:pointer;" onclick="seleccionarGraph(${g.id})">${g.lugar || '(sin lugar)'}${g.tema ? ' — ' + g.tema : ''}</span>
                    <span>
                        <button class="btn btn-sm btn-outline-secondary" onclick="editarGraph(${g.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-outline-danger" onclick="eliminarGraph(${g.id})"><i class="fas fa-trash"></i></button>
                    </span>
                </div>
            `).join('');

            notaDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <strong>#${t.numero_de_nota} ${t.titulo}</strong>
                    <button class="btn btn-sm btn-outline-primary" onclick="abrirModalGraph(${t.id})"><i class="fas fa-plus"></i></button>
                </div>
                ${graphsHtml}
            `;
            contenedor.appendChild(notaDiv);
        });
    } catch (error) {
        console.error('Error al cargar notas y graphs:', error);
    }
}

function seleccionarGraph(id) {
    console.log('seleccionarGraph pendiente de implementación completa (Task 8):', id);
}

document.addEventListener('DOMContentLoaded', () => {
    guionId = document.getElementById('guion-data').getAttribute('data-guion-id');
    cargarNotasYGraphs();
    setInterval(cargarNotasYGraphs, 1000);
});
