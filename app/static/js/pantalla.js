let plantillaActualId = null;
let plantillaVisible = false;
let capasActuales = [];
let clearTimeoutId = null;
let tickerLastText = null;

function crearElementoCapa(capa) {
    let el;
    if (capa.tipo === 'texto') {
        el = document.createElement('div');
        el.classList.add('capa', 'capa-texto');
        el.style.fontFamily = capa.fuente;
        el.style.fontSize = `${capa.tamano_fuente}px`;
        el.style.color = capa.color;
        el.style.justifyContent = capa.alineacion === 'center' ? 'center' : (capa.alineacion === 'right' ? 'flex-end' : 'flex-start');
        el.textContent = capa.valor || '';
    } else if (capa.tipo === 'video') {
        el = document.createElement('video');
        el.classList.add('capa', 'capa-media');
        el.src = `/static/${capa.archivo}`;
        el.muted = true;
        el.autoplay = true;
        el.loop = !!capa.loop;
        el.playsInline = true;
    } else {
        el = document.createElement('img');
        el.classList.add('capa', 'capa-media');
        el.src = `/static/${capa.archivo}`;
    }

    el.id = `capa-${capa.id}`;
    el.style.left = `${capa.x}px`;
    el.style.top = `${capa.y}px`;
    el.style.width = `${capa.ancho}px`;
    el.style.height = `${capa.alto}px`;
    el.style.zIndex = capa.orden;
    return el;
}

function renderizarPlantilla(plantillaData) {
    const root = document.getElementById('overlay-root');
    root.innerHTML = '';
    plantillaActualId = plantillaData.id;
    plantillaData.capas
        .slice()
        .sort((a, b) => a.orden - b.orden)
        .forEach(capa => root.appendChild(crearElementoCapa(capa)));
}

function actualizarTextos(plantillaData) {
    plantillaData.capas.forEach(capa => {
        if (capa.tipo !== 'texto') return;
        const el = document.getElementById(`capa-${capa.id}`);
        if (el) el.textContent = capa.valor || '';
    });
}

function aplicarAnimacion(tipo) {
    const root = document.getElementById('overlay-root');
    root.querySelectorAll('.capa').forEach(el => {
        const capaId = el.id.replace('capa-', '');
        const capa = capasActuales.find(c => String(c.id) === capaId);
        if (!capa) return;
        const animacion = tipo === 'entrada' ? capa.animacion_entrada : capa.animacion_salida;
        if (!animacion || animacion === 'none') return;
        el.style.setProperty('--dur', `${capa.duracion_transicion_ms}ms`);
        el.classList.add(`anim-${animacion}-${tipo === 'entrada' ? 'enter' : 'exit'}`);
    });
}

function conPx(valor, porDefecto) {
    if (valor === undefined || valor === null || valor === '') return porDefecto;
    return typeof valor === 'number' ? `${valor}px` : valor;
}

function updateTicker(ticker) {
    const band = document.getElementById('tickerBand');
    const textEl = document.getElementById('tickerText');
    const cfg = ticker || {};

    if (!cfg.show) {
        band.style.display = 'none';
        tickerLastText = null;
        return;
    }

    band.style.top = conPx(cfg.top, '1000px');
    band.style.height = conPx(cfg.height, '50px');
    band.style.backgroundColor = cfg.bg_color || '#000000';
    textEl.style.color = cfg.color || '#ffffff';
    band.style.display = 'flex';

    const speed = parseFloat(cfg.speed_seconds) || 15;
    const text = cfg.text || '';

    if (text !== tickerLastText) {
        textEl.textContent = text;
        textEl.style.animation = 'none';
        void textEl.offsetWidth;
        textEl.style.animation = `ticker-scroll ${speed}s linear infinite`;
        tickerLastText = text;
    } else {
        textEl.style.animationDuration = `${speed}s`;
    }
}

function updateDisplay(data) {
    updateTicker(data.ticker);

    const liveBadge = document.getElementById('liveBadge');
    if (data.live) {
        liveBadge.textContent = data.live.text || 'VIVO';
        liveBadge.style.display = data.live.show ? 'block' : 'none';
        liveBadge.style.top = conPx(data.live.top, '20px');
        liveBadge.style.left = conPx(data.live.left, '20px');
    }

    const root = document.getElementById('overlay-root');
    const hayGraphActivo = !!data.plantilla;

    if (clearTimeoutId !== null) {
        clearTimeout(clearTimeoutId);
        clearTimeoutId = null;
    }

    if (hayGraphActivo && data.plantilla.id !== plantillaActualId) {
        renderizarPlantilla(data.plantilla);
        capasActuales = data.plantilla.capas;
        if (!plantillaVisible) {
            aplicarAnimacion('entrada');
            plantillaVisible = true;
        }
    } else if (hayGraphActivo) {
        actualizarTextos(data.plantilla);
        capasActuales = data.plantilla.capas;
        if (!plantillaVisible) {
            aplicarAnimacion('entrada');
            plantillaVisible = true;
        }
    } else if (!hayGraphActivo && plantillaVisible) {
        const duraciones = capasActuales.map(c => c.duracion_transicion_ms || 400);
        const maxDuracion = duraciones.length ? Math.max(...duraciones) : 400;
        aplicarAnimacion('salida');
        plantillaVisible = false;
        plantillaActualId = null;
        clearTimeoutId = setTimeout(() => { root.innerHTML = ''; }, maxDuracion);
    }
}

let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let eventSource;

function setupEventSource() {
    eventSource = new EventSource('/stream_display_config');

    eventSource.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            updateDisplay(data);
            reconnectAttempts = 0;
        } catch (error) {
            console.error('Error al analizar datos:', error);
        }
    };

    eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) return;
        if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(3000 * (reconnectAttempts + 1), 15000);
            reconnectAttempts++;
            eventSource.close();
            setTimeout(setupEventSource, delay);
        }
    };
}

export function initDisplay() {
    setupEventSource();
}

export function cleanupDisplay() {
    if (eventSource) eventSource.close();
}

if (typeof window !== 'undefined') {
    window.addEventListener('load', initDisplay);
    window.addEventListener('beforeunload', cleanupDisplay);
}
