const ANCHO_LIENZO = 1920;
const ALTO_LIENZO = 1080;
const FUENTES_FIJAS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Segoe UI'];
let ESCALA_LIENZO = 0.5;

let tickerState = {};
let liveState = {};
let moscaState = {};
let cronometroState = {};
let marcadorState = {};
let plantillaActual = null;
let elementoSeleccionado = null; // 'ticker' | 'live' | 'mosca' | 'cronometro' | 'marcador' | null
let cronometroTerminado = false; // evita repetir el guardado de auto-detención en cada tick

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

    document.getElementById('cron-mostrar').addEventListener('change', (e) => {
        cronometroState.show = e.target.checked;
        guardarSeccion('cronometro', cronometroState);
        renderizarLienzo();
    });
    document.getElementById('cron-mostrar-horas').addEventListener('change', (e) => {
        cronometroState.mostrar_horas = e.target.checked;
        guardarSeccion('cronometro', cronometroState);
        renderizarLienzo();
        renderizarPanelControlRapido();
    });
    document.getElementById('cron-horas').addEventListener('blur', (e) => {
        cronometroState.duracion_horas = Math.max(0, parseInt(e.target.value) || 0);
        guardarSeccion('cronometro', cronometroState);
        renderizarLienzo();
        renderizarPanelControlRapido();
    });
    document.getElementById('cron-minutos').addEventListener('blur', (e) => {
        cronometroState.duracion_minutos = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
        guardarSeccion('cronometro', cronometroState);
        renderizarLienzo();
        renderizarPanelControlRapido();
    });
    document.getElementById('cron-segundos').addEventListener('blur', (e) => {
        cronometroState.duracion_segundos = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
        guardarSeccion('cronometro', cronometroState);
        renderizarLienzo();
        renderizarPanelControlRapido();
    });
    document.getElementById('cron-btn-inicio').addEventListener('click', iniciarCronometro);
    document.getElementById('cron-btn-stop').addEventListener('click', pausarCronometro);
    document.getElementById('cron-btn-restablecer').addEventListener('click', restablecerCronometro);

    document.getElementById('marc-mostrar').addEventListener('change', (e) => {
        marcadorState.show = e.target.checked;
        guardarSeccion('marcador', marcadorState);
        renderizarLienzo();
    });
    document.getElementById('marc-nombre-1').addEventListener('blur', (e) => {
        marcadorState.nombre_equipo_1 = e.target.value || 'Equipo 1';
        guardarSeccion('marcador', marcadorState);
        renderizarLienzo();
    });
    document.getElementById('marc-nombre-2').addEventListener('blur', (e) => {
        marcadorState.nombre_equipo_2 = e.target.value || 'Equipo 2';
        guardarSeccion('marcador', marcadorState);
        renderizarLienzo();
    });
    document.getElementById('marc-mas-1').addEventListener('click', () => sumarTanto(1));
    document.getElementById('marc-menos-1').addEventListener('click', () => restarTanto(1));
    document.getElementById('marc-mas-2').addEventListener('click', () => sumarTanto(2));
    document.getElementById('marc-menos-2').addEventListener('click', () => restarTanto(2));
    document.getElementById('marc-reiniciar').addEventListener('click', reiniciarMarcador);

    setInterval(() => {
        if (cronometroState.estado === 'corriendo') {
            if (segundosRestantesCronometro(cronometroState) <= 0 && !cronometroTerminado) {
                cronometroTerminado = true;
                cronometroState.estado = 'terminado';
                cronometroState.epoch_inicio = null;
                cronometroState.segundos_restantes = null;
                guardarSeccion('cronometro', cronometroState);
            }
            renderizarLienzo();
            renderizarPanelControlRapido();
        }
        if (composicion && composicion.bajadas_auto_activo) {
            composicion.bajada_activa_id = bajadaActivaEfectivaId(composicion);
            renderizarLienzo();
        }
    }, 1000);
});

function renderizarPanelControlRapido() {
    document.getElementById('panel-mostrar-ticker').checked = !!tickerState.show;
    document.getElementById('panel-mostrar-vivo').checked = !!liveState.show;
    document.getElementById('panel-mostrar-mosca').checked = !!moscaState.show;

    document.getElementById('cron-mostrar').checked = !!cronometroState.show;
    document.getElementById('cron-mostrar-horas').checked = !!cronometroState.mostrar_horas;
    const cronEditable = cronometroState.estado === 'detenido' || cronometroState.estado === 'terminado';
    document.getElementById('cron-horas').disabled = !cronEditable;
    document.getElementById('cron-minutos').disabled = !cronEditable;
    document.getElementById('cron-segundos').disabled = !cronEditable;
    if (document.activeElement.id !== 'cron-horas') document.getElementById('cron-horas').value = cronometroState.duracion_horas;
    if (document.activeElement.id !== 'cron-minutos') document.getElementById('cron-minutos').value = cronometroState.duracion_minutos;
    if (document.activeElement.id !== 'cron-segundos') document.getElementById('cron-segundos').value = cronometroState.duracion_segundos;
    document.getElementById('cron-display').textContent = formatearTiempoCronometro(segundosRestantesCronometro(cronometroState), cronometroState.mostrar_horas);

    document.getElementById('marc-mostrar').checked = !!marcadorState.show;
    if (document.activeElement.id !== 'marc-nombre-1') document.getElementById('marc-nombre-1').value = marcadorState.nombre_equipo_1;
    if (document.activeElement.id !== 'marc-nombre-2') document.getElementById('marc-nombre-2').value = marcadorState.nombre_equipo_2;
    document.getElementById('marc-tantos-1').textContent = marcadorState.tantos_equipo_1;
    document.getElementById('marc-tantos-2').textContent = marcadorState.tantos_equipo_2;
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

    cronometroState = {
        show: !!(config.cronometro && config.cronometro.show),
        left: parseFloat(config.cronometro && config.cronometro.left) || 0,
        top: parseFloat(config.cronometro && config.cronometro.top) || 0,
        width: parseFloat(config.cronometro && config.cronometro.width) || 300,
        height: parseFloat(config.cronometro && config.cronometro.height) || 80,
        mostrar_horas: (config.cronometro && config.cronometro.mostrar_horas) !== undefined ? !!config.cronometro.mostrar_horas : true,
        duracion_horas: parseInt(config.cronometro && config.cronometro.duracion_horas) || 0,
        duracion_minutos: config.cronometro && config.cronometro.duracion_minutos !== undefined ? parseInt(config.cronometro.duracion_minutos) : 5,
        duracion_segundos: parseInt(config.cronometro && config.cronometro.duracion_segundos) || 0,
        estado: (config.cronometro && config.cronometro.estado) || 'detenido',
        epoch_inicio: (config.cronometro && config.cronometro.epoch_inicio) || null,
        segundos_restantes: (config.cronometro && config.cronometro.segundos_restantes) !== undefined ? config.cronometro.segundos_restantes : null,
        fuente: (config.cronometro && config.cronometro.fuente) || 'Arial',
        tamano_fuente: parseFloat(config.cronometro && config.cronometro.tamano_fuente) || 40,
        negrita: (config.cronometro && config.cronometro.negrita) !== undefined ? !!config.cronometro.negrita : true,
        cursiva: !!(config.cronometro && config.cronometro.cursiva),
        color: (config.cronometro && config.cronometro.color) || '#ffffff',
        bg_color: (config.cronometro && config.cronometro.bg_color) || '#000000',
        opacidad_fondo: (config.cronometro && config.cronometro.opacidad_fondo) !== undefined ? Math.max(0, Math.min(100, parseInt(config.cronometro.opacidad_fondo))) : 100,
        radio_esquina: parseInt(config.cronometro && config.cronometro.radio_esquina) || 0,
    };

    marcadorState = {
        show: !!(config.marcador && config.marcador.show),
        left: parseFloat(config.marcador && config.marcador.left) || 0,
        top: parseFloat(config.marcador && config.marcador.top) || 0,
        width: parseFloat(config.marcador && config.marcador.width) || 400,
        height: parseFloat(config.marcador && config.marcador.height) || 100,
        nombre_equipo_1: (config.marcador && config.marcador.nombre_equipo_1) || 'Equipo 1',
        nombre_equipo_2: (config.marcador && config.marcador.nombre_equipo_2) || 'Equipo 2',
        tantos_equipo_1: parseInt(config.marcador && config.marcador.tantos_equipo_1) || 0,
        tantos_equipo_2: parseInt(config.marcador && config.marcador.tantos_equipo_2) || 0,
        fuente: (config.marcador && config.marcador.fuente) || 'Arial',
        tamano_fuente: parseFloat(config.marcador && config.marcador.tamano_fuente) || 36,
        negrita: (config.marcador && config.marcador.negrita) !== undefined ? !!config.marcador.negrita : true,
        cursiva: !!(config.marcador && config.marcador.cursiva),
        color: (config.marcador && config.marcador.color) || '#ffffff',
        bg_color: (config.marcador && config.marcador.bg_color) || '#000000',
        opacidad_fondo: (config.marcador && config.marcador.opacidad_fondo) !== undefined ? Math.max(0, Math.min(100, parseInt(config.marcador.opacidad_fondo))) : 100,
        radio_esquina: parseInt(config.marcador && config.marcador.radio_esquina) || 0,
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
    lienzo.appendChild(crearElementoCronometro());
    lienzo.appendChild(crearElementoMarcador());

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

function iniciarCronometro() {
    const duracionTotal = (cronometroState.duracion_horas || 0) * 3600 + (cronometroState.duracion_minutos || 0) * 60 + (cronometroState.duracion_segundos || 0);
    if (cronometroState.estado === 'detenido' || cronometroState.estado === 'terminado') {
        cronometroState.epoch_inicio = Date.now() / 1000;
    } else if (cronometroState.estado === 'pausado') {
        cronometroState.epoch_inicio = Date.now() / 1000 - (duracionTotal - cronometroState.segundos_restantes);
    } else {
        return;
    }
    cronometroState.estado = 'corriendo';
    cronometroState.segundos_restantes = null;
    cronometroTerminado = false;
    guardarSeccion('cronometro', cronometroState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}

function pausarCronometro() {
    if (cronometroState.estado !== 'corriendo') return;
    cronometroState.segundos_restantes = segundosRestantesCronometro(cronometroState);
    cronometroState.estado = 'pausado';
    cronometroState.epoch_inicio = null;
    guardarSeccion('cronometro', cronometroState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}

function restablecerCronometro() {
    cronometroState.estado = 'detenido';
    cronometroState.epoch_inicio = null;
    cronometroState.segundos_restantes = null;
    cronometroTerminado = false;
    guardarSeccion('cronometro', cronometroState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}

function sumarTanto(equipo) {
    if (equipo === 1) marcadorState.tantos_equipo_1 += 1;
    else marcadorState.tantos_equipo_2 += 1;
    guardarSeccion('marcador', marcadorState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}

function restarTanto(equipo) {
    if (equipo === 1) marcadorState.tantos_equipo_1 = Math.max(0, marcadorState.tantos_equipo_1 - 1);
    else marcadorState.tantos_equipo_2 = Math.max(0, marcadorState.tantos_equipo_2 - 1);
    guardarSeccion('marcador', marcadorState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}

function reiniciarMarcador() {
    marcadorState.tantos_equipo_1 = 0;
    marcadorState.tantos_equipo_2 = 0;
    guardarSeccion('marcador', marcadorState);
    renderizarLienzo();
    renderizarPanelControlRapido();
}

function crearElementoCronometro() {
    const el = document.createElement('div');
    el.id = 'cronometro-editor';
    el.className = 'elemento-control elemento-editable' + (elementoSeleccionado === 'cronometro' ? ' seleccionada' : '');
    el.style.left = `${cronometroState.left}px`;
    el.style.top = `${cronometroState.top}px`;
    el.style.width = `${cronometroState.width}px`;
    el.style.height = `${cronometroState.height}px`;
    el.style.backgroundColor = colorFondoConOpacidad(cronometroState.bg_color, cronometroState.opacidad_fondo);
    el.style.borderRadius = `${cronometroState.radio_esquina}px`;
    el.style.color = cronometroState.color;
    el.style.zIndex = 900;
    el.style.opacity = cronometroState.show ? '1' : '0.35';
    el.style.fontFamily = cronometroState.fuente;
    el.style.fontSize = `${cronometroState.tamano_fuente}px`;
    el.style.fontWeight = cronometroState.negrita ? 'bold' : 'normal';
    el.style.fontStyle = cronometroState.cursiva ? 'italic' : 'normal';
    el.textContent = formatearTiempoCronometro(segundosRestantesCronometro(cronometroState), cronometroState.mostrar_horas);

    el.addEventListener('mousedown', iniciarArrastreCronometro);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarElemento('cronometro');
    });

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.addEventListener('mousedown', iniciarResizeCronometro);
    el.appendChild(handle);

    return el;
}

function crearElementoMarcador() {
    const el = document.createElement('div');
    el.id = 'marcador-editor';
    el.className = 'elemento-control elemento-editable' + (elementoSeleccionado === 'marcador' ? ' seleccionada' : '');
    el.style.left = `${marcadorState.left}px`;
    el.style.top = `${marcadorState.top}px`;
    el.style.width = `${marcadorState.width}px`;
    el.style.height = `${marcadorState.height}px`;
    el.style.backgroundColor = colorFondoConOpacidad(marcadorState.bg_color, marcadorState.opacidad_fondo);
    el.style.borderRadius = `${marcadorState.radio_esquina}px`;
    el.style.color = marcadorState.color;
    el.style.zIndex = 900;
    el.style.opacity = marcadorState.show ? '1' : '0.35';
    el.style.fontFamily = marcadorState.fuente;
    el.style.fontSize = `${marcadorState.tamano_fuente}px`;
    el.style.fontWeight = marcadorState.negrita ? 'bold' : 'normal';
    el.style.fontStyle = marcadorState.cursiva ? 'italic' : 'normal';
    el.textContent = `${marcadorState.nombre_equipo_1} ${marcadorState.tantos_equipo_1} - ${marcadorState.tantos_equipo_2} ${marcadorState.nombre_equipo_2}`;

    el.addEventListener('mousedown', iniciarArrastreMarcador);
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        seleccionarElemento('marcador');
    });

    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.addEventListener('mousedown', iniciarResizeMarcador);
    el.appendChild(handle);

    return el;
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

    if (elementoSeleccionado === 'cronometro') {
        panel.innerHTML = `
            <h6>Cronómetro</h6>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-cron-top" value="${cronometroState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-cron-height" value="${cronometroState.height}"></div>
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-cron-left" value="${cronometroState.left}"></div>
                <div class="col-6 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-cron-width" value="${cronometroState.width}"></div>
            </div>
            <div class="form-group mb-2">
                <label>Color texto</label>
                <input type="color" class="form-control" id="prop-cron-color" value="${cronometroState.color}">
            </div>
            <div class="form-group mb-2">
                <label>Color fondo</label>
                <input type="color" class="form-control" id="prop-cron-bgcolor" value="${cronometroState.bg_color}">
            </div>
            <div class="form-group mb-2">
                <label>Opacidad de fondo</label>
                <input type="number" class="form-control" id="prop-cron-opacidad-fondo" min="0" max="100" value="${cronometroState.opacidad_fondo}">
            </div>
            <div class="form-group mb-2">
                <label>Radio de esquina</label>
                <input type="number" class="form-control" id="prop-cron-radio-esquina" min="0" value="${cronometroState.radio_esquina}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-cron-fuente">
                    ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(cronometroState.fuente) && cronometroState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                    <option value="__custom__" ${!FUENTES_FIJAS.includes(cronometroState.fuente) ? 'selected' : ''}>Personalizada...</option>
                </select>
                <input type="text" class="form-control mt-1" id="prop-cron-fuente-custom" value="${cronometroState.fuente}" style="${!FUENTES_FIJAS.includes(cronometroState.fuente) ? '' : 'display:none;'}">
            </div>
            <div class="form-group mb-2">
                <label>Tamaño de fuente</label>
                <input type="number" class="form-control" id="prop-cron-tamano" value="${cronometroState.tamano_fuente}">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-cron-negrita" ${cronometroState.negrita ? 'checked' : ''}>
                <label class="form-check-label" for="prop-cron-negrita">Negrita</label>
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-cron-cursiva" ${cronometroState.cursiva ? 'checked' : ''}>
                <label class="form-check-label" for="prop-cron-cursiva">Cursiva</label>
            </div>
        `;

        document.getElementById('prop-cron-top').addEventListener('blur', (e) => {
            cronometroState.top = parseFloat(e.target.value) || 0;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-height').addEventListener('blur', (e) => {
            cronometroState.height = Math.max(10, parseFloat(e.target.value) || 10);
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-left').addEventListener('blur', (e) => {
            cronometroState.left = parseFloat(e.target.value) || 0;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-width').addEventListener('blur', (e) => {
            cronometroState.width = Math.max(20, parseFloat(e.target.value) || 20);
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-color').addEventListener('change', (e) => {
            cronometroState.color = e.target.value;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-bgcolor').addEventListener('change', (e) => {
            cronometroState.bg_color = e.target.value;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-fuente').addEventListener('change', (e) => {
            const inputCustom = document.getElementById('prop-cron-fuente-custom');
            if (e.target.value === '__custom__') {
                inputCustom.style.display = '';
                inputCustom.focus();
            } else {
                inputCustom.style.display = 'none';
                cronometroState.fuente = e.target.value;
                guardarSeccion('cronometro', cronometroState);
                renderizarLienzo();
            }
        });
        document.getElementById('prop-cron-fuente-custom').addEventListener('change', (e) => {
            cronometroState.fuente = e.target.value;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-tamano').addEventListener('blur', (e) => {
            cronometroState.tamano_fuente = parseFloat(e.target.value) || 40;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-negrita').addEventListener('change', (e) => {
            cronometroState.negrita = e.target.checked;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-cursiva').addEventListener('change', (e) => {
            cronometroState.cursiva = e.target.checked;
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-opacidad-fondo').addEventListener('blur', (e) => {
            cronometroState.opacidad_fondo = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        document.getElementById('prop-cron-radio-esquina').addEventListener('blur', (e) => {
            cronometroState.radio_esquina = Math.max(0, parseInt(e.target.value) || 0);
            guardarSeccion('cronometro', cronometroState);
            renderizarLienzo();
        });
        return;
    }

    if (elementoSeleccionado === 'marcador') {
        panel.innerHTML = `
            <h6>Marcador</h6>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Top</label><input type="number" class="form-control" id="prop-marc-top" value="${marcadorState.top}"></div>
                <div class="col-6 form-group mb-2"><label>Alto</label><input type="number" class="form-control" id="prop-marc-height" value="${marcadorState.height}"></div>
            </div>
            <div class="row">
                <div class="col-6 form-group mb-2"><label>Left</label><input type="number" class="form-control" id="prop-marc-left" value="${marcadorState.left}"></div>
                <div class="col-6 form-group mb-2"><label>Ancho</label><input type="number" class="form-control" id="prop-marc-width" value="${marcadorState.width}"></div>
            </div>
            <div class="form-group mb-2">
                <label>Color texto</label>
                <input type="color" class="form-control" id="prop-marc-color" value="${marcadorState.color}">
            </div>
            <div class="form-group mb-2">
                <label>Color fondo</label>
                <input type="color" class="form-control" id="prop-marc-bgcolor" value="${marcadorState.bg_color}">
            </div>
            <div class="form-group mb-2">
                <label>Opacidad de fondo</label>
                <input type="number" class="form-control" id="prop-marc-opacidad-fondo" min="0" max="100" value="${marcadorState.opacidad_fondo}">
            </div>
            <div class="form-group mb-2">
                <label>Radio de esquina</label>
                <input type="number" class="form-control" id="prop-marc-radio-esquina" min="0" value="${marcadorState.radio_esquina}">
            </div>
            <div class="form-group mb-2">
                <label>Fuente</label>
                <select class="form-control" id="prop-marc-fuente">
                    ${FUENTES_FIJAS.map(f => `<option value="${f}" ${FUENTES_FIJAS.includes(marcadorState.fuente) && marcadorState.fuente === f ? 'selected' : ''}>${f}</option>`).join('')}
                    <option value="__custom__" ${!FUENTES_FIJAS.includes(marcadorState.fuente) ? 'selected' : ''}>Personalizada...</option>
                </select>
                <input type="text" class="form-control mt-1" id="prop-marc-fuente-custom" value="${marcadorState.fuente}" style="${!FUENTES_FIJAS.includes(marcadorState.fuente) ? '' : 'display:none;'}">
            </div>
            <div class="form-group mb-2">
                <label>Tamaño de fuente</label>
                <input type="number" class="form-control" id="prop-marc-tamano" value="${marcadorState.tamano_fuente}">
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-marc-negrita" ${marcadorState.negrita ? 'checked' : ''}>
                <label class="form-check-label" for="prop-marc-negrita">Negrita</label>
            </div>
            <div class="form-check mb-2">
                <input type="checkbox" class="form-check-input" id="prop-marc-cursiva" ${marcadorState.cursiva ? 'checked' : ''}>
                <label class="form-check-label" for="prop-marc-cursiva">Cursiva</label>
            </div>
        `;

        document.getElementById('prop-marc-top').addEventListener('blur', (e) => {
            marcadorState.top = parseFloat(e.target.value) || 0;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-height').addEventListener('blur', (e) => {
            marcadorState.height = Math.max(10, parseFloat(e.target.value) || 10);
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-left').addEventListener('blur', (e) => {
            marcadorState.left = parseFloat(e.target.value) || 0;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-width').addEventListener('blur', (e) => {
            marcadorState.width = Math.max(20, parseFloat(e.target.value) || 20);
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-color').addEventListener('change', (e) => {
            marcadorState.color = e.target.value;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-bgcolor').addEventListener('change', (e) => {
            marcadorState.bg_color = e.target.value;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-fuente').addEventListener('change', (e) => {
            const inputCustom = document.getElementById('prop-marc-fuente-custom');
            if (e.target.value === '__custom__') {
                inputCustom.style.display = '';
                inputCustom.focus();
            } else {
                inputCustom.style.display = 'none';
                marcadorState.fuente = e.target.value;
                guardarSeccion('marcador', marcadorState);
                renderizarLienzo();
            }
        });
        document.getElementById('prop-marc-fuente-custom').addEventListener('change', (e) => {
            marcadorState.fuente = e.target.value;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-tamano').addEventListener('blur', (e) => {
            marcadorState.tamano_fuente = parseFloat(e.target.value) || 36;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-negrita').addEventListener('change', (e) => {
            marcadorState.negrita = e.target.checked;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-cursiva').addEventListener('change', (e) => {
            marcadorState.cursiva = e.target.checked;
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-opacidad-fondo').addEventListener('blur', (e) => {
            marcadorState.opacidad_fondo = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        document.getElementById('prop-marc-radio-esquina').addEventListener('blur', (e) => {
            marcadorState.radio_esquina = Math.max(0, parseInt(e.target.value) || 0);
            guardarSeccion('marcador', marcadorState);
            renderizarLienzo();
        });
        return;
    }

    panel.innerHTML = '<p class="text-muted">Seleccioná el ticker, el badge Vivo, la Mosca, el cronómetro o el marcador para editar sus propiedades.</p>';
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

let arrastreCronometro = null;

function iniciarArrastreCronometro(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('cronometro');
    arrastreCronometro = {
        xInicial: e.clientX, yInicial: e.clientY,
        leftInicial: cronometroState.left, topInicial: cronometroState.top,
    };
    document.addEventListener('mousemove', moverArrastreCronometro);
    document.addEventListener('mouseup', finalizarArrastreCronometro);
}

function moverArrastreCronometro(e) {
    if (!arrastreCronometro) return;
    const deltaX = (e.clientX - arrastreCronometro.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastreCronometro.yInicial) / ESCALA_LIENZO;
    cronometroState.left = Math.max(0, Math.round(arrastreCronometro.leftInicial + deltaX));
    cronometroState.top = Math.max(0, Math.round(arrastreCronometro.topInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastreCronometro() {
    if (!arrastreCronometro) return;
    arrastreCronometro = null;
    document.removeEventListener('mousemove', moverArrastreCronometro);
    document.removeEventListener('mouseup', finalizarArrastreCronometro);
    guardarSeccion('cronometro', cronometroState);
    renderizarPanelPropiedades();
}

let resizeCronometro = null;

function iniciarResizeCronometro(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('cronometro');
    resizeCronometro = {
        xInicial: e.clientX, yInicial: e.clientY,
        anchoInicial: cronometroState.width, alturaInicial: cronometroState.height,
    };
    document.addEventListener('mousemove', moverResizeCronometro);
    document.addEventListener('mouseup', finalizarResizeCronometro);
}

function moverResizeCronometro(e) {
    if (!resizeCronometro) return;
    const deltaX = (e.clientX - resizeCronometro.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - resizeCronometro.yInicial) / ESCALA_LIENZO;
    cronometroState.width = Math.max(20, Math.round(resizeCronometro.anchoInicial + deltaX));
    cronometroState.height = Math.max(10, Math.round(resizeCronometro.alturaInicial + deltaY));
    renderizarLienzo();
}

function finalizarResizeCronometro() {
    if (!resizeCronometro) return;
    resizeCronometro = null;
    document.removeEventListener('mousemove', moverResizeCronometro);
    document.removeEventListener('mouseup', finalizarResizeCronometro);
    guardarSeccion('cronometro', cronometroState);
    renderizarPanelPropiedades();
}

let arrastreMarcador = null;

function iniciarArrastreMarcador(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('marcador');
    arrastreMarcador = {
        xInicial: e.clientX, yInicial: e.clientY,
        leftInicial: marcadorState.left, topInicial: marcadorState.top,
    };
    document.addEventListener('mousemove', moverArrastreMarcador);
    document.addEventListener('mouseup', finalizarArrastreMarcador);
}

function moverArrastreMarcador(e) {
    if (!arrastreMarcador) return;
    const deltaX = (e.clientX - arrastreMarcador.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - arrastreMarcador.yInicial) / ESCALA_LIENZO;
    marcadorState.left = Math.max(0, Math.round(arrastreMarcador.leftInicial + deltaX));
    marcadorState.top = Math.max(0, Math.round(arrastreMarcador.topInicial + deltaY));
    renderizarLienzo();
}

function finalizarArrastreMarcador() {
    if (!arrastreMarcador) return;
    arrastreMarcador = null;
    document.removeEventListener('mousemove', moverArrastreMarcador);
    document.removeEventListener('mouseup', finalizarArrastreMarcador);
    guardarSeccion('marcador', marcadorState);
    renderizarPanelPropiedades();
}

let resizeMarcador = null;

function iniciarResizeMarcador(e) {
    e.preventDefault();
    e.stopPropagation();
    seleccionarElemento('marcador');
    resizeMarcador = {
        xInicial: e.clientX, yInicial: e.clientY,
        anchoInicial: marcadorState.width, alturaInicial: marcadorState.height,
    };
    document.addEventListener('mousemove', moverResizeMarcador);
    document.addEventListener('mouseup', finalizarResizeMarcador);
}

function moverResizeMarcador(e) {
    if (!resizeMarcador) return;
    const deltaX = (e.clientX - resizeMarcador.xInicial) / ESCALA_LIENZO;
    const deltaY = (e.clientY - resizeMarcador.yInicial) / ESCALA_LIENZO;
    marcadorState.width = Math.max(20, Math.round(resizeMarcador.anchoInicial + deltaX));
    marcadorState.height = Math.max(10, Math.round(resizeMarcador.alturaInicial + deltaY));
    renderizarLienzo();
}

function finalizarResizeMarcador() {
    if (!resizeMarcador) return;
    resizeMarcador = null;
    document.removeEventListener('mousemove', moverResizeMarcador);
    document.removeEventListener('mouseup', finalizarResizeMarcador);
    guardarSeccion('marcador', marcadorState);
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
            const colorNota = t.emitido ? ' bg-secondary' : (t.activo ? ' bg-warning' : '');
            notaDiv.className = 'mb-2 border-bottom pb-2' + colorNota;

            const graphsHtml = (t.graphs || []).map(g => `
                <div class="d-flex justify-content-between align-items-center small ${g.activo ? 'bg-danger' : ''} p-1 rounded">
                    <span style="cursor:pointer;" onclick="seleccionarGraph(${g.id}, ${t.numero_de_nota})">${g.lugar || '(sin lugar)'}${g.tema ? ' — ' + g.tema : ''}</span>
                    <span>
                        <button class="btn btn-sm btn-mini ${t.emitido && !g.activo ? 'btn-outline-light' : 'btn-outline-secondary'}" onclick="editarGraph(${g.id})"><i class="fas fa-edit"></i></button>
                        <button class="btn btn-sm btn-mini ${g.activo ? 'btn-outline-light' : 'btn-outline-danger'}" onclick="eliminarGraph(${g.id})"><i class="fas fa-trash"></i></button>
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

async function seleccionarGraph(id, numeroDeNota) {
    const response = await fetch(`/graphs/${id}`);
    if (!response.ok) return;
    const graph = await response.json();

    graphComposicionId = id;
    composicion = {
        numero_de_nota: numeroDeNota,
        lugar: graph.lugar,
        tema: graph.tema,
        bajadas: graph.bajadas_detalle,
        citas: graph.citas_detalle,
        bajada_activa_id: graph.bajada_activa_id,
        cita_activa_id: graph.cita_activa_id,
        mostrar_lugar: graph.mostrar_lugar,
        mostrar_tema: graph.mostrar_tema,
        bajadas_auto_activo: graph.bajadas_auto_activo,
        bajadas_auto_loop: graph.bajadas_auto_loop,
        bajadas_auto_duracion_segundos: graph.bajadas_auto_duracion_segundos,
        bajadas_auto_epoch_inicio: graph.bajadas_auto_epoch_inicio,
        bajadas_auto_indice_inicio: graph.bajadas_auto_indice_inicio,
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

function bajadaActivaEfectivaId(comp) {
    if (!comp.bajadas_auto_activo || !comp.bajadas.length || !comp.bajadas_auto_epoch_inicio) {
        return comp.bajada_activa_id;
    }
    const bajadasOrdenadas = comp.bajadas.slice().sort((a, b) => a.id - b.id);
    const duracion = comp.bajadas_auto_duracion_segundos || 5;
    const transcurrido = (Date.now() / 1000) - comp.bajadas_auto_epoch_inicio;
    const paso = Math.floor(transcurrido / duracion);
    let indice = comp.bajadas_auto_indice_inicio + paso;
    if (comp.bajadas_auto_loop) {
        indice = ((indice % bajadasOrdenadas.length) + bajadasOrdenadas.length) % bajadasOrdenadas.length;
    } else {
        indice = Math.min(indice, bajadasOrdenadas.length - 1);
    }
    return bajadasOrdenadas[indice].id;
}

async function actualizarBajadasAuto(cambios) {
    if (!graphComposicionId) return;
    const respAccion = await fetch(`/graphs/${graphComposicionId}/bajadas-auto`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cambios),
    });
    if (!respAccion.ok) {
        const error = await respAccion.json().catch(() => ({}));
        Swal.fire({ icon: 'error', title: 'No se pudo actualizar la rotación', text: error.error || '' });
        return;
    }
    const response = await fetch(`/graphs/${graphComposicionId}`);
    const graph = await response.json();
    composicion.bajada_activa_id = graph.bajada_activa_id;
    composicion.bajadas_auto_activo = graph.bajadas_auto_activo;
    composicion.bajadas_auto_loop = graph.bajadas_auto_loop;
    composicion.bajadas_auto_duracion_segundos = graph.bajadas_auto_duracion_segundos;
    composicion.bajadas_auto_epoch_inicio = graph.bajadas_auto_epoch_inicio;
    composicion.bajadas_auto_indice_inicio = graph.bajadas_auto_indice_inicio;
}

function iniciarRotacionBajadas() {
    actualizarBajadasAuto({ accion: 'play' }).then(() => {
        renderizarLienzo();
        renderizarPanelComposicion();
    });
}

function detenerRotacionBajadas() {
    actualizarBajadasAuto({ accion: 'stop' }).then(() => {
        renderizarLienzo();
        renderizarPanelComposicion();
    });
}

function toggleLoopBajadas() {
    actualizarBajadasAuto({ loop: !composicion.bajadas_auto_loop }).then(() => {
        renderizarPanelComposicion();
    });
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
        <h6>Nota #${composicion.numero_de_nota} — Graph: ${composicion.lugar || '(sin lugar)'}</h6>
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
        <div class="mb-3 d-flex align-items-center" style="gap: 0.5rem;">
            <button type="button" class="btn btn-sm btn-outline-success" id="btn-bajadas-play" title="Reproducir">
                <i class="fas fa-play"></i>
            </button>
            <button type="button" class="btn btn-sm btn-outline-secondary" id="btn-bajadas-stop" title="Detener">
                <i class="fas fa-stop"></i>
            </button>
            <button type="button" class="btn btn-sm ${composicion.bajadas_auto_loop ? 'btn-primary' : 'btn-outline-secondary'}" id="btn-bajadas-loop" title="Loop">
                <i class="fas fa-sync-alt"></i>
            </button>
            <input type="number" class="form-control form-control-sm" id="comp-bajadas-duracion" min="1"
                   style="width: 70px;" value="${composicion.bajadas_auto_duracion_segundos}"
                   ${composicion.bajadas_auto_activo ? 'disabled' : ''} title="Segundos por bajada">
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
        radio.addEventListener('change', async (e) => {
            const valorElegido = e.target.value ? parseInt(e.target.value) : null;
            if (composicion.bajadas_auto_activo) {
                await actualizarBajadasAuto({ accion: 'stop' });
            }
            composicion.bajada_activa_id = valorElegido;
            renderizarLienzo();
            renderizarPanelComposicion();
        });
    });
    document.getElementById('btn-bajadas-play').addEventListener('click', iniciarRotacionBajadas);
    document.getElementById('btn-bajadas-stop').addEventListener('click', detenerRotacionBajadas);
    document.getElementById('btn-bajadas-loop').addEventListener('click', toggleLoopBajadas);
    document.getElementById('comp-bajadas-duracion').addEventListener('blur', (e) => {
        const valor = Math.max(1, parseInt(e.target.value) || 5);
        actualizarBajadasAuto({ duracion_segundos: valor }).then(() => renderizarPanelComposicion());
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
