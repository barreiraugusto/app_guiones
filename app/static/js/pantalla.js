let plantillaActualId = null;
let plantillaVisible = false;
let capasActuales = [];
let clearTimeoutId = null;
let tickerLastText = null;
let tickerLastDireccion = null;
let tickerVisible = false;
let tickerHideTimeoutId = null;

function crearElementoCapa(capa) {
    let el;
    if (capa.tipo === 'texto') {
        el = document.createElement('div');
        el.classList.add('capa', 'capa-texto');
        el.style.fontFamily = capa.fuente;
        el.style.fontSize = `${capa.tamano_fuente}px`;
        el.style.color = capa.color;
        el.style.fontWeight = capa.negrita ? 'bold' : 'normal';
        el.style.fontStyle = capa.cursiva ? 'italic' : 'normal';
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
    } else if (capa.tipo === 'forma') {
        el = document.createElement('div');
        el.classList.add('capa');
        el.style.borderRadius = `${capa.radio_esquina}px`;
        el.style.opacity = capa.opacidad / 100;
        if (capa.ancho_borde > 0) {
            el.style.border = `${capa.ancho_borde}px solid ${capa.color_borde || '#000000'}`;
        }
        if (capa.usar_gradiente) {
            el.style.background = `linear-gradient(${capa.gradiente_angulo}deg, ${capa.gradiente_color_inicio}, ${capa.gradiente_color_fin})`;
        } else {
            el.style.background = capa.color_fondo || 'transparent';
        }
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
        .forEach(capa => {
            const el = crearElementoCapa(capa);
            root.appendChild(el);
            if (capa.tipo === 'texto') ajustarTamanoTexto(el, capa.tamano_fuente);
        });
}

function direccionAPx(direccion, ancho) {
    return direccion === 'derecha' ? `${ancho}px` : `-${ancho}px`;
}

function actualizarTextos(plantillaData) {
    const root = document.getElementById('overlay-root');
    const idsNuevos = new Set(plantillaData.capas.map(c => c.id));

    document.querySelectorAll('#overlay-root .capa').forEach(el => {
        const capaId = Number(el.id.replace('capa-', ''));
        if (idsNuevos.has(capaId)) return;

        const capaVieja = capasActuales.find(c => c.id === capaId);
        const duracion = capaVieja ? (capaVieja.duracion_salida_ms || 400) : 400;
        const animacion = capaVieja ? capaVieja.animacion_salida : 'none';
        if (animacion && animacion !== 'none') {
            el.style.setProperty('--dur', `${duracion}ms`);
            el.style.setProperty('--dir', direccionAPx(capaVieja.direccion_salida, capaVieja.ancho));
            el.style.setProperty('--opacidad-final', capaVieja.opacidad != null ? capaVieja.opacidad / 100 : 1);
            el.classList.add(`anim-${animacion}-exit`);
            setTimeout(() => el.remove(), duracion);
        } else {
            el.remove();
        }
    });

    plantillaData.capas.forEach(capa => {
        const elExistente = document.getElementById(`capa-${capa.id}`);
        if (elExistente) {
            if (capa.tipo === 'texto') {
                elExistente.textContent = capa.valor || '';
                ajustarTamanoTexto(elExistente, capa.tamano_fuente);
            }
            return;
        }
        const elNuevo = crearElementoCapa(capa);
        root.appendChild(elNuevo);
        if (capa.tipo === 'texto') ajustarTamanoTexto(elNuevo, capa.tamano_fuente);
        if (capa.animacion_entrada && capa.animacion_entrada !== 'none') {
            elNuevo.style.setProperty('--dur', `${capa.duracion_entrada_ms}ms`);
            elNuevo.style.setProperty('--dir', direccionAPx(capa.direccion_entrada, capa.ancho));
            elNuevo.style.setProperty('--opacidad-final', capa.opacidad != null ? capa.opacidad / 100 : 1);
            elNuevo.classList.add(`anim-${capa.animacion_entrada}-enter`);
        }
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
        const duracion = tipo === 'entrada' ? capa.duracion_entrada_ms : capa.duracion_salida_ms;
        const direccion = tipo === 'entrada' ? capa.direccion_entrada : capa.direccion_salida;
        el.style.setProperty('--dur', `${duracion}ms`);
        el.style.setProperty('--dir', direccionAPx(direccion, capa.ancho));
        el.style.setProperty('--opacidad-final', capa.opacidad != null ? capa.opacidad / 100 : 1);
        el.classList.add(`anim-${animacion}-${tipo === 'entrada' ? 'enter' : 'exit'}`);
    });
}

function conPx(valor, porDefecto) {
    if (valor === undefined || valor === null || valor === '') return porDefecto;
    return typeof valor === 'number' ? `${valor}px` : valor;
}

function segundosRestantesCronometro(cfg) {
    const duracionTotal = (cfg.duracion_horas || 0) * 3600 + (cfg.duracion_minutos || 0) * 60 + (cfg.duracion_segundos || 0);
    if (cfg.estado === 'corriendo' && cfg.epoch_inicio) {
        return Math.max(0, duracionTotal - (Date.now() / 1000 - cfg.epoch_inicio));
    }
    if (cfg.estado === 'pausado' && cfg.segundos_restantes !== null) {
        return cfg.segundos_restantes;
    }
    if (cfg.estado === 'terminado') {
        return 0;
    }
    return duracionTotal;
}

function formatearTiempoCronometro(segundos, mostrarHoras) {
    const totalSeg = Math.ceil(segundos);
    if (mostrarHoras) {
        const h = Math.floor(totalSeg / 3600);
        const m = Math.floor((totalSeg % 3600) / 60);
        const s = totalSeg % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    const m = Math.floor(totalSeg / 60);
    const s = totalSeg % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function colorFondoConOpacidad(hex, opacidadPct) {
    const valor = (hex || '#000000').replace('#', '');
    const r = parseInt(valor.substring(0, 2), 16) || 0;
    const g = parseInt(valor.substring(2, 4), 16) || 0;
    const b = parseInt(valor.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacidadPct)) / 100})`;
}

function updateTicker(ticker) {
    const band = document.getElementById('tickerBand');
    const textEl = document.getElementById('tickerText');
    const cfg = ticker || {};

    if (!cfg.show) {
        if (tickerVisible) {
            band.classList.remove('anim-ticker-enter');
            band.classList.add('anim-ticker-exit');
            tickerVisible = false;
            tickerLastText = null;
            if (tickerHideTimeoutId !== null) clearTimeout(tickerHideTimeoutId);
            tickerHideTimeoutId = setTimeout(() => {
                band.style.display = 'none';
                band.classList.remove('anim-ticker-exit');
                tickerHideTimeoutId = null;
            }, 400);
        }
        return;
    }

    if (tickerHideTimeoutId !== null) {
        clearTimeout(tickerHideTimeoutId);
        tickerHideTimeoutId = null;
        band.classList.remove('anim-ticker-exit');
    }

    band.style.left = conPx(cfg.left, '0px');
    band.style.width = conPx(cfg.width, '1920px');
    band.style.top = conPx(cfg.top, '1000px');
    band.style.height = conPx(cfg.height, '50px');
    band.style.setProperty('--angulo', `${parseFloat(cfg.angulo) || 0}deg`);
    band.style.backgroundColor = cfg.bg_color || '#000000';
    textEl.style.color = cfg.color || '#ffffff';
    textEl.style.fontFamily = cfg.fuente || 'Arial';
    textEl.style.fontSize = `${parseFloat(cfg.tamano_fuente) || 32}px`;
    textEl.style.fontWeight = cfg.negrita !== false ? 'bold' : 'normal';
    textEl.style.fontStyle = cfg.cursiva ? 'italic' : 'normal';
    band.style.display = 'flex';

    if (!tickerVisible) {
        band.classList.add('anim-ticker-enter');
        tickerVisible = true;
    }

    const speed = parseFloat(cfg.speed_seconds) || 15;
    const text = cfg.text || '';
    const direccion = cfg.scroll_direccion === 'derecha' ? 'derecha' : 'izquierda';

    if (text !== tickerLastText || direccion !== tickerLastDireccion) {
        textEl.textContent = text;
        textEl.classList.remove('ticker-dir-izquierda', 'ticker-dir-derecha');
        textEl.classList.add(`ticker-dir-${direccion}`);
        textEl.style.animation = 'none';
        void textEl.offsetWidth;
        textEl.style.animation = `ticker-scroll-${direccion} ${speed}s linear infinite`;
        tickerLastText = text;
        tickerLastDireccion = direccion;
    } else {
        textEl.style.animationDuration = `${speed}s`;
    }
}

let moscaCapaIdActual = null;

function updateMosca(mosca) {
    const root = document.getElementById('mosca-root');
    const mostrar = !!(mosca && mosca.show && mosca.capa);

    if (!mostrar) {
        if (moscaCapaIdActual !== null) {
            root.innerHTML = '';
            moscaCapaIdActual = null;
        }
        return;
    }

    if (mosca.capa.id !== moscaCapaIdActual) {
        root.innerHTML = '';
        const el = crearElementoCapa(mosca.capa);
        root.appendChild(el);
        if (mosca.capa.tipo === 'texto') ajustarTamanoTexto(el, mosca.capa.tamano_fuente);
        moscaCapaIdActual = mosca.capa.id;
    }
}

let cronometroCfgActual = null;

function updateCronometro(cfg) {
    const band = document.getElementById('cronometroBand');
    if (!cfg || !cfg.show) {
        band.style.display = 'none';
        cronometroCfgActual = null;
        return;
    }
    band.style.left = conPx(cfg.left, '0px');
    band.style.top = conPx(cfg.top, '0px');
    band.style.width = conPx(cfg.width, '300px');
    band.style.height = conPx(cfg.height, '80px');
    band.style.backgroundColor = colorFondoConOpacidad(cfg.bg_color, cfg.opacidad_fondo !== undefined ? cfg.opacidad_fondo : 100);
    band.style.borderRadius = `${parseFloat(cfg.radio_esquina) || 0}px`;
    band.style.color = cfg.color || '#ffffff';
    band.style.fontFamily = cfg.fuente || 'Arial';
    band.style.fontSize = `${parseFloat(cfg.tamano_fuente) || 40}px`;
    band.style.fontWeight = cfg.negrita !== false ? 'bold' : 'normal';
    band.style.fontStyle = cfg.cursiva ? 'italic' : 'normal';
    band.style.display = 'flex';
    cronometroCfgActual = cfg;
    band.textContent = formatearTiempoCronometro(segundosRestantesCronometro(cfg), cfg.mostrar_horas);
}

function updateMarcador(cfg) {
    const band = document.getElementById('marcadorBand');
    if (!cfg || !cfg.show) {
        band.style.display = 'none';
        return;
    }
    band.style.left = conPx(cfg.left, '0px');
    band.style.top = conPx(cfg.top, '0px');
    band.style.width = conPx(cfg.width, '400px');
    band.style.height = conPx(cfg.height, '100px');
    band.style.backgroundColor = colorFondoConOpacidad(cfg.bg_color, cfg.opacidad_fondo !== undefined ? cfg.opacidad_fondo : 100);
    band.style.borderRadius = `${parseFloat(cfg.radio_esquina) || 0}px`;
    band.style.color = cfg.color || '#ffffff';
    band.style.fontFamily = cfg.fuente || 'Arial';
    band.style.fontSize = `${parseFloat(cfg.tamano_fuente) || 36}px`;
    band.style.fontWeight = cfg.negrita !== false ? 'bold' : 'normal';
    band.style.fontStyle = cfg.cursiva ? 'italic' : 'normal';
    band.style.display = 'flex';
    band.textContent = `${cfg.nombre_equipo_1 || 'Equipo 1'} ${cfg.tantos_equipo_1 || 0} - ${cfg.tantos_equipo_2 || 0} ${cfg.nombre_equipo_2 || 'Equipo 2'}`;
}

setInterval(() => {
    if (cronometroCfgActual && cronometroCfgActual.show) {
        const band = document.getElementById('cronometroBand');
        band.textContent = formatearTiempoCronometro(segundosRestantesCronometro(cronometroCfgActual), cronometroCfgActual.mostrar_horas);
    }
}, 1000);

function updateDisplay(data) {
    updateTicker(data.ticker);
    updateMosca(data.mosca);
    updateCronometro(data.cronometro);
    updateMarcador(data.marcador);

    const liveBadge = document.getElementById('liveBadge');
    if (data.live) {
        liveBadge.textContent = data.live.text || 'VIVO';
        liveBadge.style.display = data.live.show ? 'block' : 'none';
        liveBadge.style.top = conPx(data.live.top, '20px');
        liveBadge.style.left = conPx(data.live.left, '20px');
        liveBadge.style.fontFamily = data.live.fuente || 'Arial';
        liveBadge.style.fontSize = `${parseFloat(data.live.tamano_fuente) || 18}px`;
        liveBadge.style.fontWeight = data.live.negrita !== false ? 'bold' : 'normal';
        liveBadge.style.fontStyle = data.live.cursiva ? 'italic' : 'normal';
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
        const duraciones = capasActuales.map(c => c.duracion_salida_ms || 400);
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
