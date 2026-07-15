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
    return el;
}

function seleccionarElemento(nombre) {
    elementoSeleccionado = nombre;
    renderizarLienzo();
    renderizarPanelPropiedades();
}

function renderizarPanelPropiedades() {
    const panel = document.getElementById('panel-propiedades-control');
    panel.innerHTML = '<p class="text-muted">Seleccioná el ticker o el badge Vivo para editar sus propiedades.</p>';
}
