// Función para animación de aparición
function fadeIn(element) {
    if (!element) return;
    element.style.opacity = '0';
    element.style.transition = 'opacity 0.5s ease, visibility 0.5s ease';
    element.style.visibility = 'hidden';
    requestAnimationFrame(() => {
        element.style.opacity = '1';
        element.style.visibility = 'visible';
    });
}

// Validación de datos mejorada
function validateDisplayData(data) {
    return data && (
        (data.content && (
            data.content.primera_linea !== undefined ||
            data.content.segunda_linea !== undefined ||
            data.content.lugar !== undefined ||
            data.content.nombre !== undefined
        )) ||
        (data.badges && (
            data.badges.top_left !== undefined ||
            data.badges.top_right !== undefined
        )) ||
        (data.live && data.live.show !== undefined)
    );
}

// Aplicar estilos con soporte para Flexbox y posicionamiento mejorado
function applyStyles(element, styles) {
    if (!element || !styles) return;

    // Preservar propiedades críticas para flexbox
    const preservedProps = ['display', 'justifyContent', 'alignItems'];
    const currentStyles = {};

    preservedProps.forEach(prop => {
        currentStyles[prop] = element.style[prop];
    });

    // Aplicar position primero si está en los estilos
    if ('position' in styles) {
        element.style.position = styles.position;
    }

    Object.assign(element.style, styles);

    // Restaurar propiedades críticas si no se especificaron
    preservedProps.forEach(prop => {
        if (styles[prop] === undefined) {
            element.style[prop] = currentStyles[prop] || '';
        }
    });
}

// Manejo de visibilidad sin afectar el posicionamiento
function setElementVisibility(element, isVisible) {
    if (!element) return;

    if (isVisible) {
        element.style.visibility = 'visible';
        element.style.opacity = '1';
    } else {
        element.style.visibility = 'hidden';
        element.style.opacity = '0';
    }
}

// Función para ajustar texto usando Canvas (precisión mejorada)
function adjustFontSizeWithCanvas(element) {
    if (!element || !element.textContent.trim()) return;

    const text = element.textContent;
    const container = element;
    const minFontSize = 16;  // Tamaño mínimo de fuente
    const maxFontSize = 24;  // Tamaño máximo inicial
    const padding = 40;      // Ajusta según el padding del contenedor

    // Crear canvas oculto para medir el texto
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    // Obtener estilos del elemento real
    const style = window.getComputedStyle(element);
    context.font = `${maxFontSize}px ${style.fontFamily}`;

    let fontSize = maxFontSize;
    let textWidth = context.measureText(text).width;
    const containerWidth = container.clientWidth - padding;

    // Reducir tamaño hasta que el texto quepa o alcance el mínimo
    while (textWidth > containerWidth && fontSize > minFontSize) {
        fontSize -= 1;
        context.font = `${fontSize}px ${style.fontFamily}`;
        textWidth = context.measureText(text).width;
    }

    // Aplicar el tamaño calculado
    element.style.fontSize = `${fontSize}px`;
    element.style.whiteSpace = 'nowrap';
    element.style.overflow = 'hidden';
    element.style.textOverflow = 'ellipsis';

    // Limpiar el canvas
    canvas.remove();
}

// Función para ajustar texto multilínea (para linea1 y linea2)
function adjustMultiLineText(element) {
    if (!element) return;
    element.style.whiteSpace = 'normal';
    element.style.overflow = 'visible';
    element.style.textOverflow = 'clip';
    element.style.wordWrap = 'break-word';
    element.style.overflowWrap = 'break-word';
}

// Función principal de actualización con posicionamiento mejorado
function updateDisplay(data) {
    console.log('📦 Datos recibidos:', data);
    const elements = {
        grupo: document.getElementById('grupo'),
        liveBadge: document.getElementById('liveBadge'),
        lugar: document.getElementById('lugar'),
        nombre: document.getElementById('nombre'),
        linea1: document.getElementById('linea1'),
        linea2: document.getElementById('linea2'),
        topLeftContainer: document.querySelector('.top-left-container'),
        topRightContainer: document.querySelector('.top-right-container')
    };

    // Contenido principal con transición
    if (data.content) {
        if (data.content.primera_linea !== undefined) {
            elements.linea1.textContent = data.content.primera_linea;
            adjustMultiLineText(elements.linea1);
            fadeIn(elements.linea1);
        }
        if (data.content.segunda_linea !== undefined) {
            elements.linea2.textContent = data.content.segunda_linea;
            adjustMultiLineText(elements.linea2);
            fadeIn(elements.linea2);
        }
    }

    // Badges superiores
    const lugarText = data.content?.lugar || data.badges?.top_left || '';
    const nombreText = data.content?.entrevistado || data.badges?.top_right || '';

    elements.lugar.textContent = lugarText;
    elements.nombre.textContent = nombreText;

    // Ajustar texto para los badges con canvas
    if (lugarText.trim() !== '') {
        adjustFontSizeWithCanvas(elements.lugar);
        setElementVisibility(elements.lugar, true);
    } else {
        setElementVisibility(elements.lugar, false);
    }

    if (nombreText.trim() !== '') {
        adjustFontSizeWithCanvas(elements.nombre);
        setElementVisibility(elements.nombre, true);
    } else {
        setElementVisibility(elements.nombre, false);
    }

    // Ajustar contenedores si es necesario
    if (elements.topLeftContainer) {
        elements.topLeftContainer.style.justifyContent = lugarText.trim() !== '' ? 'center' : 'flex-start';
    }
    if (elements.topRightContainer) {
        elements.topRightContainer.style.justifyContent = nombreText.trim() !== '' ? 'center' : 'flex-end';
    }

    // Estilos para 'lugar' con posicionamiento absoluto
    if (data.badges) {
        const lugarStyles = {
            position: 'absolute',
            bottom: data.badges.lugar_y || '153px',
            left: data.badges.lugar_x || '6px',
            ...(data.badges.styles || {})
        };
        applyStyles(elements.lugar, lugarStyles);
    }

    // Estilos para 'nombre' con posicionamiento absoluto
    if (data.badges) {
        const nombreStyles = {
            position: 'absolute',
            bottom: data.badges.nombre_y || '106px',
            left: data.badges.nombre_x || '6px',
            ...(data.badges.styles || {})
        };
        applyStyles(elements.nombre, nombreStyles);
    }

    // Estilos para el grupo principal
    if (data.layout) {
        const grupoStyles = {
            top: data.layout.main_vertical || '850px',
            left: data.layout.main_horizontal || '50px',
            ...(data.layout.styles || {})
        };
        applyStyles(elements.grupo, grupoStyles);
    }

    // Badge "VIVO" con estilos dinámicos
    if (data.live) {
        elements.liveBadge.textContent = data.live.text || 'VIVO';
        setElementVisibility(elements.liveBadge, data.live.show);

        const liveStyles = {
            top: data.live.top || '20px',
            right: data.live.right || '20px',
            position: 'fixed',
            ...(data.live.styles || {})
        };
        applyStyles(elements.liveBadge, liveStyles);
    }

    // Aplicar estilos generales si existen
    if (data.styles) {
        for (const [elementId, styles] of Object.entries(data.styles)) {
            const element = document.getElementById(elementId);
            applyStyles(element, styles);
        }
    }
}

// Configuración SSE con reconexión mejorada
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let eventSource;

function setupEventSource() {
    eventSource = new EventSource('/stream_display_config');

    eventSource.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            if (validateDisplayData(data)) {
                updateDisplay(data);
                reconnectAttempts = 0;
            } else {
                console.warn('Datos no válidos recibidos:', data);
            }
        } catch (error) {
            console.error('Error al analizar datos:', error);
        }
    };

    eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
            console.log('Conexión cerrada por el servidor');
            return;
        }

        if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(3000 * (reconnectAttempts + 1), 15000);
            reconnectAttempts++;
            console.warn(`Error de conexión (intento ${reconnectAttempts}), reconectando en ${delay}ms...`);
            eventSource.close();
            setTimeout(setupEventSource, delay);
        } else {
            console.error('Máximo de intentos de reconexión alcanzado');
            const errorElement = document.getElementById('connection-error');
            if (errorElement) {
                errorElement.textContent = 'Error de conexión con el servidor';
                setElementVisibility(errorElement, true);
            }
        }
    };
}

// Observador de redimensionamiento para ajuste automático
const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        const element = entry.target;
        if (element.id === 'lugar' || element.id === 'nombre') {
            adjustFontSizeWithCanvas(element);
        }
    }
});

// Gestión de conexión
export function initDisplay() {
    setupEventSource();

    // Iniciar observación de los elementos al cargar
    const lugar = document.getElementById('lugar');
    const nombre = document.getElementById('nombre');
    if (lugar) resizeObserver.observe(lugar);
    if (nombre) resizeObserver.observe(nombre);
}

export function cleanupDisplay() {
    if (eventSource) {
        eventSource.close();
        console.log('Conexión SSE finalizada');
    }
    resizeObserver.disconnect();
}

// Manejo automático de eventos de página
if (typeof window !== 'undefined') {
    window.addEventListener('load', initDisplay);
    window.addEventListener('beforeunload', cleanupDisplay);
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            initDisplay();
        } else {
            cleanupDisplay();
        }
    });
}