const ANCHO_LIENZO = 1920;
const ALTO_LIENZO = 1080;
const FUENTES_FIJAS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Segoe UI'];
let ESCALA_LIENZO = 0.5;

let tickerState = {};
let liveState = {};
let moscaState = {};
let plantillaActual = null;
let elementoSeleccionado = null; // 'ticker' | 'live' | 'mosca' | null

function aplicarEscalaLienzo() {
    const wrapper = document.getElementById('lienzo-wrapper');
    const control = document.getElementById('lienzo-control');
    ESCALA_LIENZO = wrapper.clientWidth / ANCHO_LIENZO;
    control.style.transform = `scale(${ESCALA_LIENZO})`;
}

document.addEventListener('DOMContentLoaded', () => {
    aplicarEscalaLienzo();
    cargarConfig();
    setupEventSource();
    document.getElementById('lienzo-control').addEventListener('click', () => {
        seleccionarElemento(null);
    });
    window.addEventListener('resize', aplicarEscalaLienzo);

    document.getElementById('panel-mostrar-ticker').addEventListener('change', (e) => {
        tickerState.show = e.target.checked;
        guardarSeccion('ticker', tickerState);
        renderizarLienzo();
    });
    document.getElementById('panel-mostrar-vivo').addEventListener('change', (e) => {
        liveState.show = e.target.checked;
        guardarSeccion('live', liveState);
        renderizarLienzo();
    });
    document.getElementById('panel-mostrar-mosca').addEventListener('change', (e) => {
        moscaState.show = e.target.checked;
        guardarSeccion('mosca', { show: moscaState.show });
        renderizarLienzo();
    });
});

function renderizarPanelControlRapido() {
    document.getElementById('panel-mostrar-ticker').checked = !!tickerState.show;
    document.getElementById('panel-mostrar-vivo').checked = !!liveState.show;
    document.getElementById('panel-mostrar-mosca').checked = !!moscaState.show;
}

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
        left: parseFloat(config.ticker && config.ticker.left) || 0,
        width: parseFloat(config.ticker && config.ticker.width) || ANCHO_LIENZO,
        scroll_direccion: (config.ticker && config.ticker.scroll_direccion) || 'izquierda',
        angulo: Math.max(-45, Math.min(45, parseFloat(config.ticker && config.ticker.angulo) || 0)),
        fuente: (config.ticker && config.ticker.fuente) || 'Arial',
        tamano_fuente: parseFloat(config.ticker && config.ticker.tamano_fuente) || 32,
        negrita: (config.ticker && config.ticker.negrita) !== undefined ? !!config.ticker.negrita : true,
        cursiva: !!(config.ticker && config.ticker.cursiva),
    };

    liveState = {
        show: !!(config.live && config.live.show),
        text: (config.live && config.live.text) || 'VIVO',
        top: parseFloat(config.live && config.live.top) || 150,
        left: parseFloat(config.live && config.live.left) || 1550,
        fuente: (config.live && config.live.fuente) || 'Arial',
        tamano_fuente: parseFloat(config.live && config.live.tamano_fuente) || 18,
        negrita: (config.live && config.live.negrita) !== undefined ? !!config.live.negrita : true,
        cursiva: !!(config.live && config.live.cursiva),
    };

    moscaState = {
        show: !!(config.mosca && config.mosca.show),
        capa: (config.mosca && config.mosca.capa) || null,
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

    if (graphComposicionId && plantillaEnEdicion) {
        const capasOrdenadas = plantillaEnEdicion.capas.slice().sort((a, b) => a.orden - b.orden);

        // Valor resuelto de cada capa de texto (incluso vacío), para poder
        // decidir si una capa "controlada por" ella debe ocultarse también.
        const valorTextoPorCapaId = {};
        capasOrdenadas.forEach(capa => {
            if (capa.tipo === 'texto') {
                valorTextoPorCapaId[capa.id] = resolverValorCapa(capa, composicion);
            }
        });

        capasOrdenadas.forEach(capa => {
            let valor = null;
            if (capa.tipo === 'texto') {
                valor = valorTextoPorCapaId[capa.id];
                if (!valor) return;
            }

            if (capa.controlada_por_id) {
                const valorControl = valorTextoPorCapaId[capa.controlada_por_id];
                if (valorControl !== undefined && !valorControl) return;
            }

            const el = crearElementoPreviewCapa(capa, valor);
            lienzo.appendChild(el);
            if (capa.tipo === 'texto') ajustarTamanoTexto(el, capa.tamano_fuente);
            agregarResizeHandle(el, capa.id);
        });
    } else if (plantillaActual) {
        plantillaActual.capas
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .forEach(capa => lienzo.appendChild(crearElementoZocalo(capa)));
    }

    lienzo.appendChild(crearElementoTicker());
    lienzo.appendChild(crearElementoLive());
    const elMosca = crearElementoMosca();
    if (elMosca) lienzo.appendChild(elMosca);

    renderizarPanelControlRapido();
}

function crearElementoZocalo(capa) {
    let el;
    if (capa.tipo === 'texto') {
        el = document.createElement('div');
        el.classList.add('elemento-control', 'capa-texto');
        el.style.fontFamily = capa.fuente;
        el.style.fontSize = `${capa.tamano_fuente}px`;
        el.style.color = capa.color;
        el.style.fontWeight = capa.negrita ? 'bold' : 'normal';
        el.style.fontStyle = capa.cursiva ? 'italic' : 'normal';
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
    } else if (capa.tipo === 'forma') {
        el = document.createElement('div');
        el.classList.add('elemento-control');
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

function resolverValorCapa(capa, comp) {
    if (capa.tipo !== 'texto') return null;
    const bajada = comp.bajadas.find(b => b.id === comp.bajada_activa_id);
    const cita = comp.citas.find(c => c.id === comp.cita_activa_id);
    const valoresPorCampo = {
        lugar: comp.mostrar_lugar ? (comp.lugar || '') : '',
        tema: comp.mostrar_tema ? (comp.tema || '') : '',
        entrevistado: cita ? cita.entrevistado : '',
        cita: (cita && cita.texto) || '',
        // Si la cita activa no tiene texto (entrevistado sin cita), la bajada
        // activa se sigue mostrando en vez de quedar vacía.
        bajada_1: (cita && cita.texto) ? cita.texto : (bajada ? bajada.texto : ''),
        bajada_2: '',
    };
    return valoresPorCampo[capa.campo_dato] ?? (capa.texto_fijo || '');
}

function crearElementoPreviewCapa(capa, valor) {
    let el;
    if (capa.tipo === 'texto') {
        el = document.createElement('div');
        el.classList.add('elemento-control', 'elemento-editable', 'capa-texto');
        el.style.fontFamily = capa.fuente;
        el.style.color = capa.color;
        el.style.fontWeight = capa.negrita ? 'bold' : 'normal';
        el.style.fontStyle = capa.cursiva ? 'italic' : 'normal';
        el.style.justifyContent = capa.alineacion === 'center' ? 'center' : (capa.alineacion === 'right' ? 'flex-end' : 'flex-start');
        el.textContent = valor;
    } else if (capa.tipo === 'video') {
        el = document.createElement('video');
        el.classList.add('elemento-control', 'elemento-editable', 'capa-media');
        el.src = `/static/${capa.archivo}`;
        el.muted = true;
        el.autoplay = true;
        el.loop = !!capa.loop;
        el.playsInline = true;
    } else if (capa.tipo === 'forma') {
        el = document.createElement('div');
        el.classList.add('elemento-control', 'elemento-editable');
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
        el.classList.add('elemento-control', 'elemento-editable', 'capa-media');
        el.src = `/static/${capa.archivo}`;
    }
    el.style.left = `${capa.x}px`;
    el.style.top = `${capa.y}px`;
    el.style.width = `${capa.ancho}px`;
    el.style.height = `${capa.alto}px`;
    el.style.zIndex = capa.orden;

    el.addEventListener('mousedown', (e) => iniciarArrastreCapa(e, capa.id));
    el.addEventListener('click', (e) => e.stopPropagation());

    return el;
}

function agregarResizeHandle(el, capaId) {
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.addEventListener('mousedown', (e) => iniciarResizeCapa(e, capaId));
    el.appendChild(handle);
}

function crearElementoTicker() {
    const el = document.createElement('div');
    el.id = 'ticker-editor';
    el.className = 'elemento-control elemento-editable' + (elementoSeleccionado === 'ticker' ? ' seleccionada' : '');
    el.style.left = `${tickerState.left}px`;
    el.style.width = `${tickerState.width}px`;
    el.style.top = `${tickerState.top}px`;
    el.style.height = `${tickerState.height}px`;
    el.style.backgroundColor = tickerState.bg_color;
    el.style.color = tickerState.color;
    el.style.zIndex = 900;
    el.style.opacity = tickerState.show ? '1' : '0.35';
    el.style.transform = `rotate(${tickerState.angulo}deg)`;
    el.style.fontFamily = tickerState.fuente;
    el.style.fontSize = `${tickerState.tamano_fuente}px`;
    el.style.fontWeight = tickerState.negrita ? 'bold' : 'normal';
    el.style.fontStyle = tickerState.cursiva ? 'italic' : 'normal';
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
    el.style.fontFamily = liveState.fuente;
    el.style.fontSize = `${liveState.tamano_fuente}px`;
    el.style.fontWeight = liveState.negrita ? 'bold' : 'normal';
    el.style.fontStyle = liveState.cursiva ? 'italic' : 'normal';
    el.textContent = liveState.text || 'VIVO';

    el.addEventListener('mousedown', iniciarArrastreLive);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarElemento('live');
    });

    return el;
}

function crearElementoMosca() {
    if (!moscaState.capa) return null;

    // Posición y tamaño vienen de la capa de la plantilla (sin arrastre/resize
    // propios acá) -- solo se controla Mostrar/Ocultar desde control_live.
    const el = crearElementoZocalo(moscaState.capa);
    el.id = 'mosca-editor';
    el.classList.add('elemento-editable');
    if (elementoSeleccionado === 'mosca') el.classList.add('seleccionada');
    if (!moscaState.show) el.style.opacity = '0.35';

    el.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarElemento('mosca');
    });

    return el;
}

function seleccionarElemento(nombre) {
    graphComposicionId = null;
    plantillaEnEdicion = null;
    elementoSeleccionado = nombre;
    renderizarLienzo();
    renderizarPanelPropiedades();
}

function renderizarPanelPropiedades() {
    const panel = document.getElementById('panel-propiedades-control');

    if (graphComposicionId) {
        renderizarPanelComposicion();
        return;
    }

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
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-ticker-left" value="${tickerState.left}"></div>
                <div class="col-6 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-ticker-width" value="${tickerState.width}"></div>
            </div>
            <div class="form-group mb-2">
                <label>Dirección del texto</label>
                <select class="form-control" id="prop-ticker-scroll-direccion">
                    <option value="izquierda">Derecha → Izquierda</option>
                    <option value="derecha">Izquierda → Derecha</option>
                </select>
            </div>
            <div class="form-group mb-2">
                <label>Ángulo</label>
                <input type="number" class="form-control" id="prop-ticker-angulo" min="-45" max="45" value="${tickerState.angulo}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-ticker-fuente">
                    ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(tickerState.fuente) && tickerState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                    <option value="__custom__" ${!FUENTES_FIJAS.includes(tickerState.fuente) ? 'selected' : ''}>Personalizada...</option>
                </select>
                <input type="text" class="form-control mt-1" id="prop-ticker-fuente-custom" value="${tickerState.fuente}" style="${!FUENTES_FIJAS.includes(tickerState.fuente) ? '' : 'display:none;'}">
            </div>
            <div class="form-group mb-2">
                <label>Tamaño de fuente</label>
                <input type="number" class="form-control" id="prop-ticker-tamano" value="${tickerState.tamano_fuente}">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-ticker-negrita" ${tickerState.negrita ? 'checked' : ''}>
                <label class="form-check-label" for="prop-ticker-negrita">Negrita</label>
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-ticker-cursiva" ${tickerState.cursiva ? 'checked' : ''}>
                <label class="form-check-label" for="prop-ticker-cursiva">Cursiva</label>
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
        document.getElementById('prop-ticker-left').addEventListener('blur', (e) => {
            tickerState.left = parseFloat(e.target.value) || 0;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-width').addEventListener('blur', (e) => {
            tickerState.width = Math.max(20, parseFloat(e.target.value) || 20);
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-scroll-direccion').value = tickerState.scroll_direccion;
        document.getElementById('prop-ticker-scroll-direccion').addEventListener('change', (e) => {
            tickerState.scroll_direccion = e.target.value;
            guardarSeccion('ticker', tickerState);
        });
        document.getElementById('prop-ticker-angulo').addEventListener('blur', (e) => {
            tickerState.angulo = Math.max(-45, Math.min(45, parseFloat(e.target.value) || 0));
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-fuente').addEventListener('change', (e) => {
            const inputCustom = document.getElementById('prop-ticker-fuente-custom');
            if (e.target.value === '__custom__') {
                inputCustom.style.display = '';
                inputCustom.focus();
            } else {
                inputCustom.style.display = 'none';
                tickerState.fuente = e.target.value;
                guardarSeccion('ticker', tickerState);
                renderizarLienzo();
            }
        });
        document.getElementById('prop-ticker-fuente-custom').addEventListener('change', (e) => {
            tickerState.fuente = e.target.value;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-tamano').addEventListener('blur', (e) => {
            tickerState.tamano_fuente = parseFloat(e.target.value) || 32;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-negrita').addEventListener('change', (e) => {
            tickerState.negrita = e.target.checked;
            guardarSeccion('ticker', tickerState);
            renderizarLienzo();
        });
        document.getElementById('prop-ticker-cursiva').addEventListener('change', (e) => {
            tickerState.cursiva = e.target.checked;
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
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-live-fuente">
                    ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(liveState.fuente) && liveState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                    <option value="__custom__" ${!FUENTES_FIJAS.includes(liveState.fuente) ? 'selected' : ''}>Personalizada...</option>
                </select>
                <input type="text" class="form-control mt-1" id="prop-live-fuente-custom" value="${liveState.fuente}" style="${!FUENTES_FIJAS.includes(liveState.fuente) ? '' : 'display:none;'}">
            </div>
            <div class="form-group mb-2">
                <label>Tamaño de fuente</label>
                <input type="number" class="form-control" id="prop-live-tamano" value="${liveState.tamano_fuente}">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-live-negrita" ${liveState.negrita ? 'checked' : ''}>
                <label class="form-check-label" for="prop-live-negrita">Negrita</label>
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-live-cursiva" ${liveState.cursiva ? 'checked' : ''}>
                <label class="form-check-label" for="prop-live-cursiva">Cursiva</label>
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
        document.getElementById('prop-live-fuente').addEventListener('change', (e) => {
            const inputCustom = document.getElementById('prop-live-fuente-custom');
            if (e.target.value === '__custom__') {
                inputCustom.style.display = '';
                inputCustom.focus();
            } else {
                inputCustom.style.display = 'none';
                liveState.fuente = e.target.value;
                guardarSeccion('live', liveState);
                renderizarLienzo();
            }
        });
        document.getElementById('prop-live-fuente-custom').addEventListener('change', (e) => {
            liveState.fuente = e.target.value;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-tamano').addEventListener('blur', (e) => {
            liveState.tamano_fuente = parseFloat(e.target.value) || 18;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-negrita').addEventListener('change', (e) => {
            liveState.negrita = e.target.checked;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        document.getElementById('prop-live-cursiva').addEventListener('change', (e) => {
            liveState.cursiva = e.target.checked;
            guardarSeccion('live', liveState);
            renderizarLienzo();
        });
        return;
    }

    if (elementoSeleccionado === 'mosca') {
        panel.innerHTML = `
            <h6>Mosca</h6>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-mosca-show" ${moscaState.show ? 'checked' : ''}>
                <label class="form-check-label" for="prop-mosca-show">Mostrar</label>
            </div>
            <small class="text-muted">La posición y el tamaño se definen en el editor de Plantillas, en la capa marcada como Mosca.</small>
        `;

        document.getElementById('prop-mosca-show').addEventListener('change', (e) => {
            moscaState.show = e.target.checked;
            guardarSeccion('mosca', { show: moscaState.show });
            renderizarLienzo();
        });
        return;
    }

    panel.innerHTML = '<p class="text-muted">Seleccioná el ticker, el badge Vivo o la Mosca para editar sus propiedades.</p>';
}

let arrastreTicker = null;

function iniciarArrastreTicker(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('ticker');
    arrastreTicker = {
        xInicial: e.clientX, yInicial: e.clientY,
        leftInicial: tickerState.left, topInicial: tickerState.top,
    };
    document.addEventListener('mousemove', moverArrastreTicker);
    document.addEventListener('mouseup', finalizarArrastreTicker);
}

function moverArrastreTicker(e) {
    if (!arrastreTicker) return;
    const deltaX = (e.clientX - arrastreTicker.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastreTicker.yInicial) / ESCALA_LIENZO;
    tickerState.left = Math.max(0, Math.round(arrastreTicker.leftInicial + deltaX));
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
    resizeTicker = {
        xInicial: e.clientX, yInicial: e.clientY,
        anchoInicial: tickerState.width, alturaInicial: tickerState.height,
    };
    document.addEventListener('mousemove', moverResizeTicker);
    document.addEventListener('mouseup', finalizarResizeTicker);
}

function moverResizeTicker(e) {
    if (!resizeTicker) return;
    const deltaX = (e.clientX - resizeTicker.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - resizeTicker.yInicial) / ESCALA_LIENZO;
    tickerState.width = Math.max(20, Math.round(resizeTicker.anchoInicial + deltaX));
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

        const selTexto = document.getElementById('texto_id');
        if (selTexto) {
            const valorPrevio = selTexto.value;
            selTexto.innerHTML = textosFiltrados
                .map(t => `<option value="${t.id}">Nota: ${t.numero_de_nota} - ${t.titulo}</option>`)
                .join('');
            if (valorPrevio) selTexto.value = valorPrevio;
        }

        const contenedor = document.getElementById('lista-notas');
        contenedor.innerHTML = '';

        textosFiltrados.forEach(t => {
            const notaDiv = document.createElement('div');
            notaDiv.className = 'mb-2 border-bottom pb-2' + (t.activo ? ' bg-warning' : '');

            const graphsHtml = (t.graphs || []).map(g => `
                <div class="d-flex justify-content-between align-items-center small ${g.activo ? 'bg-warning' : ''} p-1 rounded">
                    <span style="cursor:pointer;" onclick="seleccionarGraph(${g.id})">${g.lugar || '(sin lugar)'}${g.tema ? ' — ' + g.tema : ''}</span>
                    <span>
                        <button class="btn btn-sm btn-mini btn-outline-secondary" onclick="editarGraph(${g.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-mini btn-outline-danger" onclick="eliminarGraph(${g.id})"><i class="fas fa-trash"></i></button>
                    </span>
                </div>
            `).join('');

            notaDiv.innerHTML = `
                <div class="d-flex justify-content-between align-items-center px-1">
                    <strong>#${t.numero_de_nota} ${t.titulo}</strong>
                    <button class="btn btn-sm btn-mini btn-outline-primary" onclick="abrirModalGraph(${t.id})"><i class="fas fa-plus"></i></button>
                </div>
                ${graphsHtml}
            `;
            contenedor.appendChild(notaDiv);
        });
    } catch (error) {
        console.error('Error al cargar notas y graphs:', error);
    }
}

let graphComposicionId = null;
let composicion = null;
let plantillaEnEdicion = null;

async function seleccionarGraph(id) {
    const response = await fetch(`/graphs/${id}`);
    if (!response.ok) return;
    const graph = await response.json();

    graphComposicionId = id;
    composicion = {
        lugar: graph.lugar,
        tema: graph.tema,
        bajadas: graph.bajadas_detalle,
        citas: graph.citas_detalle,
        bajada_activa_id: graph.bajada_activa_id,
        cita_activa_id: graph.cita_activa_id,
        mostrar_lugar: graph.mostrar_lugar,
        mostrar_tema: graph.mostrar_tema,
    };

    plantillaEnEdicion = null;
    if (graph.plantilla_id) {
        const respPlantilla = await fetch(`/api/plantillas/${graph.plantilla_id}`);
        if (respPlantilla.ok) plantillaEnEdicion = await respPlantilla.json();
    }

    elementoSeleccionado = null;
    renderizarLienzo();
    renderizarPanelPropiedades();
}

function renderizarPanelComposicion() {
    const panel = document.getElementById('panel-propiedades-control');
    if (!composicion) return;

    const bajadasHtml = composicion.bajadas.map(b => `
        <div class="form-check">
            <input type="radio" class="form-check-input" name="bajada-activa" id="bajada-${b.id}"
                   value="${b.id}" ${composicion.bajada_activa_id === b.id ? 'checked' : ''}>
            <label class="form-check-label" for="bajada-${b.id}">${b.texto}</label>
        </div>
    `).join('');

    const citasHtml = composicion.citas.map(c => `
        <div class="form-check">
            <input type="radio" class="form-check-input" name="cita-activa" id="cita-${c.id}"
                   value="${c.id}" ${composicion.cita_activa_id === c.id ? 'checked' : ''}>
            <label class="form-check-label" for="cita-${c.id}">${c.texto ? `${c.entrevistado}: "${c.texto}"` : `${c.entrevistado} (sin cita)`}</label>
        </div>
    `).join('');

    panel.innerHTML = `
        <h6>Graph: ${composicion.lugar || '(sin lugar)'}</h6>
        <div class="form-check mb-2">
            <input type="checkbox" class="form-check-input" id="comp-mostrar-lugar" ${composicion.mostrar_lugar ? 'checked' : ''}>
            <label class="form-check-label" for="comp-mostrar-lugar">Mostrar lugar (${composicion.lugar || '—'})</label>
        </div>
        <div class="form-check mb-3">
            <input type="checkbox" class="form-check-input" id="comp-mostrar-tema" ${composicion.mostrar_tema ? 'checked' : ''}>
            <label class="form-check-label" for="comp-mostrar-tema">Mostrar tema (${composicion.tema || '—'})</label>
        </div>
        <div class="mb-3">
            <label class="d-block"><strong>Bajada activa</strong></label>
            <div class="form-check">
                <input type="radio" class="form-check-input" name="bajada-activa" id="bajada-ninguna"
                       value="" ${!composicion.bajada_activa_id ? 'checked' : ''}>
                <label class="form-check-label" for="bajada-ninguna">Ninguna</label>
            </div>
            ${bajadasHtml}
        </div>
        <div class="mb-3">
            <label class="d-block"><strong>Cita activa</strong></label>
            <div class="form-check">
                <input type="radio" class="form-check-input" name="cita-activa" id="cita-ninguna"
                       value="" ${!composicion.cita_activa_id ? 'checked' : ''}>
                <label class="form-check-label" for="cita-ninguna">Ninguna</label>
            </div>
            ${citasHtml}
        </div>
        <button class="btn btn-primary btn-block" id="btn-al-aire">Al aire</button>
    `;

    document.getElementById('comp-mostrar-lugar').addEventListener('change', (e) => {
        composicion.mostrar_lugar = e.target.checked;
        renderizarLienzo();
    });
    document.getElementById('comp-mostrar-tema').addEventListener('change', (e) => {
        composicion.mostrar_tema = e.target.checked;
        renderizarLienzo();
    });
    document.querySelectorAll('input[name="bajada-activa"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            composicion.bajada_activa_id = e.target.value ? parseInt(e.target.value) : null;
            renderizarLienzo();
        });
    });
    document.querySelectorAll('input[name="cita-activa"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            composicion.cita_activa_id = e.target.value ? parseInt(e.target.value) : null;
            renderizarLienzo();
        });
    });
    document.getElementById('btn-al-aire').addEventListener('click', enviarAlAire);
}

async function enviarAlAire() {
    if (!graphComposicionId) return;
    try {
        await fetch(`/graphs/activo/${graphComposicionId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bajada_activa_id: composicion.bajada_activa_id,
                cita_activa_id: composicion.cita_activa_id,
                mostrar_lugar: composicion.mostrar_lugar,
                mostrar_tema: composicion.mostrar_tema,
            })
        });
        // La Mosca puede haber cambiado (auto-sigue al graph recién activado).
        await cargarConfig();
    } catch (error) {
        console.error('Error al enviar al aire:', error);
    }
}

async function sacarGraphDelAire() {
    try {
        await fetch('/graphs/activo', { method: 'DELETE' });
        await cargarNotasYGraphs();
    } catch (error) {
        console.error('Error al sacar el graph del aire:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    guionId = document.getElementById('guion-data').getAttribute('data-guion-id');
    cargarNotasYGraphs();
    setInterval(cargarNotasYGraphs, 1000);
});

let arrastreCapa = null;

function iniciarArrastreCapa(e, capaId) {
    e.preventDefault();
    e.stopPropagation();
    const capa = plantillaEnEdicion.capas.find(c => c.id === capaId);
    arrastreCapa = { capaId, xInicial: e.clientX, yInicial: e.clientY, xCapaInicial: capa.x, yCapaInicial: capa.y };
    document.addEventListener('mousemove', moverArrastreCapa);
    document.addEventListener('mouseup', finalizarArrastreCapa);
}

function moverArrastreCapa(e) {
    if (!arrastreCapa) return;
    const capa = plantillaEnEdicion.capas.find(c => c.id === arrastreCapa.capaId);
    const deltaX = (e.clientX - arrastreCapa.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastreCapa.yInicial) / ESCALA_LIENZO;
    capa.x = Math.max(0, Math.round(arrastreCapa.xCapaInicial + deltaX));
    capa.y = Math.max(0, Math.round(arrastreCapa.yCapaInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastreCapa() {
    if (!arrastreCapa) return;
    arrastreCapa = null;
    document.removeEventListener('mousemove', moverArrastreCapa);
    document.removeEventListener('mouseup', finalizarArrastreCapa);
    guardarPlantillaEnEdicion();
}

let resizeCapa = null;

function iniciarResizeCapa(e, capaId) {
    e.preventDefault();
    e.stopPropagation();
    const capa = plantillaEnEdicion.capas.find(c => c.id === capaId);
    resizeCapa = { capaId, xInicial: e.clientX, yInicial: e.clientY, anchoInicial: capa.ancho, altoInicial: capa.alto };
    document.addEventListener('mousemove', moverResizeCapa);
    document.addEventListener('mouseup', finalizarResizeCapa);
}

function moverResizeCapa(e) {
    if (!resizeCapa) return;
    const capa = plantillaEnEdicion.capas.find(c => c.id === resizeCapa.capaId);
    const deltaX = (e.clientX - resizeCapa.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - resizeCapa.yInicial) / ESCALA_LIENZO;
    capa.ancho = Math.max(20, Math.round(resizeCapa.anchoInicial + deltaX));
    capa.alto = Math.max(20, Math.round(resizeCapa.altoInicial + deltaY));
    renderizarLienzo();
}

function finalizarResizeCapa() {
    if (!resizeCapa) return;
    resizeCapa = null;
    document.removeEventListener('mousemove', moverResizeCapa);
    document.removeEventListener('mouseup', finalizarResizeCapa);
    guardarPlantillaEnEdicion();
}

function guardarPlantillaEnEdicion() {
    fetch(`/api/plantillas/${plantillaEnEdicion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(plantillaEnEdicion)
    }).catch(error => console.error('Error al guardar la plantilla:', error));
}
