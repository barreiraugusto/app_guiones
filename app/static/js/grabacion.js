// static/js/grabacion.js — vista de grabaciones sobre la API de la Capturadora.
//
// El estado ya no se adivina: llega entero por SSE desde /stream_grabacion
// (qué graba el equipo, duración, bytes escritos, envíos al storage) y esta
// pantalla solo lo pinta. Las acciones son dos: GRABAR y DETENER.

window.guionSeleccionadoId = null;
window.textoActivoId = null;

let ultimoSnapshot = null;
let eventSourceGrabacion = null;
let notaEnTransicion = null;   // id de nota con un POST en vuelo
let logInterval = null;
let logTextoId = null;

// ===== ARRANQUE =====

document.addEventListener('DOMContentLoaded', function () {
    const guionId = localStorage.getItem('guionSeleccionadoGrabacion');
    const guionNombre = localStorage.getItem('guionNombreGrabacion');

    if (guionId && guionNombre) {
        seleccionarGuionParaGrabacion(guionId, guionNombre);
    } else {
        conectarStream(null);
    }

    if (typeof $ !== 'undefined') {
        $('#seleccionarGuionModalGrabacion').on('shown.bs.modal', cargarGuionesParaGrabacion);
        $('#seleccionarGuionModalGrabacion').on('hidden.bs.modal', function () {
            const buscar = document.getElementById('buscarGuionGrabacion');
            if (buscar) {
                buscar.value = '';
                filtrarGuionesGrabacion();
            }
        });
    }
});

// ===== SELECCIÓN DE GUION =====

async function cargarGuionesParaGrabacion() {
    const lista = document.getElementById('listaGuionesModalGrabacion');
    if (!lista) return;

    try {
        const response = await fetch('/obtener_guiones');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const guiones = await response.json();

        lista.innerHTML = '';
        if (!guiones.length) {
            lista.innerHTML = '<div class="list-group-item text-center text-muted">No hay guiones disponibles</div>';
            return;
        }

        guiones.forEach(guion => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action';
            item.innerHTML = `
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-1"></h6>
                        <small class="text-muted"></small>
                    </div>
                    <span class="badge badge-primary">${guion.notas_para_grabar || 0}/${guion.cantidad_notas || 0}</span>
                </div>`;
            item.querySelector('h6').textContent = guion.nombre;
            item.querySelector('small').textContent = guion.descripcion || 'Sin descripción';
            item.onclick = function (e) {
                e.preventDefault();
                seleccionarGuionParaGrabacion(guion.id, guion.nombre);
                if (typeof $ !== 'undefined') $('#seleccionarGuionModalGrabacion').modal('hide');
            };
            lista.appendChild(item);
        });
    } catch (error) {
        lista.innerHTML = `<div class="list-group-item text-center text-danger">
            <i class="fas fa-exclamation-triangle mr-2"></i>Error al cargar guiones</div>`;
    }
}

function filtrarGuionesGrabacion() {
    const busqueda = (document.getElementById('buscarGuionGrabacion')?.value || '').toLowerCase();
    document.querySelectorAll('#listaGuionesModalGrabacion .list-group-item').forEach(item => {
        item.style.display = item.textContent.toLowerCase().includes(busqueda) ? 'block' : 'none';
    });
}

function seleccionarGuionParaGrabacion(guionId, guionNombre) {
    if (hayGrabacionEnCurso()) {
        mostrarError('No se puede cambiar de guion mientras hay una grabación en curso');
        return;
    }

    window.guionSeleccionadoId = guionId;
    document.getElementById('guionActual').textContent = guionNombre;

    try {
        localStorage.setItem('guionSeleccionadoGrabacion', guionId);
        localStorage.setItem('guionNombreGrabacion', guionNombre);
    } catch (e) { /* modo privado */ }

    document.getElementById('listaGrabaciones').dataset.firma = '';
    conectarStream(guionId);
}

function volverAControl() {
    if (hayGrabacionEnCurso()) {
        mostrarError('No se puede volver a Control hasta detener la grabación en curso');
        return;
    }
    window.location.href = '/principal';
}

// ===== ESTADO EN VIVO =====

function conectarStream(guionId) {
    if (eventSourceGrabacion) eventSourceGrabacion.close();
    const url = guionId ? `/stream_grabacion?guion_id=${guionId}` : '/stream_grabacion';
    eventSourceGrabacion = new EventSource(url);
    eventSourceGrabacion.onmessage = function (event) {
        try {
            pintarSnapshot(JSON.parse(event.data));
        } catch (error) {
            console.log('Snapshot ilegible:', error);
        }
    };
}

// La nota activa en emisión llega por el mismo SSE que usa /siguiente.
const eventSourceTextoActivo = new EventSource('/stream_texto_activo');
eventSourceTextoActivo.onmessage = function (event) {
    try {
        const data = JSON.parse(event.data);
        window.textoActivoId = (data && data.id) ? String(data.id) : null;
        document.querySelectorAll('.gr-fila[data-texto-id]').forEach(fila => {
            fila.classList.toggle('fila-activa', fila.dataset.textoId === window.textoActivoId);
        });
    } catch (error) { /* sin nota activa */ }
};

function pintarSnapshot(datos) {
    ultimoSnapshot = datos;

    pintarConexion(datos);
    if (datos.perfil_aviso !== undefined) pintarAvisoPerfil(datos);
    if (!datos.ok) return;

    pintarEquipo(datos.equipo);
    pintarNotas(datos.notas || []);
    pintarContadores(datos.notas || []);
    pintarOtras(datos.otras || []);
    pintarTareas(datos.tareas || []);
    pintarPanelVivo(datos.notas || [], datos.otras || []);
    if (datos.programaciones !== undefined) pintarProgramaciones(datos.programaciones);
}

function pintarConexion(datos) {
    const chip = document.getElementById('chipConexion');
    const aviso = document.getElementById('avisoConexion');

    if (datos.ok) {
        chip.textContent = 'EN LÍNEA';
        chip.style.background = '#1f3a30';
        chip.style.color = '#8fd6b4';
        aviso.style.display = 'none';
    } else {
        chip.textContent = 'SIN CONEXIÓN';
        chip.style.background = '#3c1f1e';
        chip.style.color = '#ef9a95';
        aviso.style.display = 'block';
        aviso.textContent = `No se puede hablar con la Capturadora: ${datos.error || 'sin detalle'}`;
    }
}

function pintarAvisoPerfil(datos) {
    const aviso = document.getElementById('avisoPerfil');
    if (datos.perfil_ok || !datos.perfil_aviso) {
        aviso.style.display = 'none';
        return;
    }
    aviso.style.display = 'block';
    aviso.textContent = datos.perfil_aviso;
}

function pintarEquipo(equipo) {
    if (!equipo) return;

    const chips = document.getElementById('chipsEntradas');
    const entradas = equipo.inputs || {};
    chips.innerHTML = '';
    Object.keys(entradas).forEach(clave => {
        const entrada = entradas[clave];
        const span = document.createElement('span');
        span.className = 'gr-chip';
        span.innerHTML = `<span class="punto ${entrada.busy ? 'punto-ocupado' : 'punto-libre'}"></span>
            <span class="mono"></span>
            <span style="font-size:11px;font-weight:600;letter-spacing:.6px;">${entrada.busy ? 'OCUPADA' : 'LIBRE'}</span>`;
        span.querySelector('.mono').textContent = entrada.label || clave;
        chips.appendChild(span);
    });

    const disco = equipo.disk || {};
    document.getElementById('chipDisco').textContent = formatearBytes(disco.free_bytes);
    document.getElementById('chipDisco').style.color =
        disco.free_bytes < 20 * 1e9 ? '#ff6b63' : (disco.free_bytes < 100 * 1e9 ? '#e0a44a' : '#f4f4f2');
    document.getElementById('chipEnvios').textContent = equipo.envios_pendientes || 0;
}

function pintarContadores(notas) {
    const cuenta = estado => notas.filter(n => n.estado === estado).length;
    document.getElementById('contTotal').textContent = notas.length;
    document.getElementById('contGrabadas').textContent = cuenta('grabada') + cuenta('enviando');
    document.getElementById('contGrabando').textContent = cuenta('grabando') + cuenta('deteniendo');
    document.getElementById('contError').textContent = cuenta('fallo') + cuenta('fallo_envio');
}

const ETIQUETAS = {
    pendiente: ['PENDIENTE', ''],
    grabando: ['GRABANDO', 'badge-grabando'],
    deteniendo: ['DETENIENDO', 'badge-deteniendo'],
    grabada: ['GRABADA', 'badge-grabada'],
    enviando: ['ENVIANDO', 'badge-enviando'],
    fallo: ['FALLÓ', 'badge-fallo'],
    fallo_envio: ['NO SE ENVIÓ', 'badge-fallo'],
};

function pintarNotas(notas) {
    const contenedor = document.getElementById('listaGrabaciones');

    if (!window.guionSeleccionadoId) {
        contenedor.innerHTML = `<div class="vacio"><i class="fas fa-film fa-2x"></i>
            <h5 class="mt-3">No hay datos para mostrar</h5>
            <p>Seleccioná un guion para ver las notas marcadas para grabar</p></div>`;
        return;
    }
    if (!notas.length) {
        contenedor.innerHTML = `<div class="vacio"><i class="fas fa-film fa-2x"></i>
            <h5 class="mt-3">Este guion no tiene notas marcadas para grabar</h5></div>`;
        return;
    }

    const grabandoOtra = notas.some(n => n.estado === 'grabando' || n.estado === 'deteniendo');

    // Rearmar la tabla en cada tick del SSE se come los clicks: el botón
    // desaparece bajo el dedo. Solo se reconstruye si cambió algo estructural;
    // duración y tamaño se actualizan en la fila que ya está.
    const firma = notas.map(n => `${n.id}:${n.estado}:${n.recording_id || ''}`).join('|') +
        `#${grabandoOtra}#${ultimoSnapshot ? ultimoSnapshot.perfil_ok : ''}`;

    if (firma === contenedor.dataset.firma) {
        notas.forEach(actualizarFila);
        return;
    }

    contenedor.innerHTML = '';
    notas.forEach(nota => {
        contenedor.appendChild(construirFila(nota, grabandoOtra));
    });
    contenedor.dataset.firma = firma;
    filtrarNotas();
}

function actualizarFila(nota) {
    const fila = document.querySelector(`#listaGrabaciones .gr-fila[data-texto-id="${nota.id}"]`);
    if (!fila) return;
    const duracion = fila.querySelector('.celda-duracion');
    const tamano = fila.querySelector('.celda-tamano');
    if (duracion) {
        duracion.textContent = nota.duration_seconds == null ? '—' : formatearDuracion(nota.duration_seconds);
        duracion.classList.toggle('dato-vacio', nota.duration_seconds == null);
    }
    if (tamano) {
        tamano.textContent = nota.size_bytes ? formatearBytes(nota.size_bytes) : '—';
        tamano.classList.toggle('dato-vacio', !nota.size_bytes);
    }
}

function construirFila(nota, grabandoOtra) {
    const fila = document.createElement('div');
    fila.className = `gr-fila estado-${nota.estado}`;
    fila.dataset.textoId = String(nota.id);
    if (String(nota.id) === window.textoActivoId) fila.classList.add('fila-activa');

    const [etiqueta, clase] = ETIQUETAS[nota.estado] || ETIQUETAS.pendiente;
    const grabando = nota.estado === 'grabando' || nota.estado === 'deteniendo';
    const enTransicion = notaEnTransicion === nota.id;

    // Nº
    const col1 = document.createElement('div');
    col1.className = 'numero';
    col1.textContent = String(nota.numero_de_nota).padStart(2, '0');
    fila.appendChild(col1);

    // Título + archivo / error
    const col2 = document.createElement('div');
    col2.style.minWidth = '0';
    const titulo = document.createElement('div');
    titulo.className = 'titulo';
    titulo.textContent = nota.titulo;
    if (String(nota.id) === window.textoActivoId) {
        const aire = document.createElement('span');
        aire.className = 'badge-aire ml-2';
        aire.textContent = 'AL AIRE';
        titulo.appendChild(aire);
    }
    col2.appendChild(titulo);

    const detalle = document.createElement('div');
    if (nota.error) {
        detalle.style.cssText = 'font-size:12px;color:#a33a12;margin-top:3px;font-weight:500;';
        detalle.textContent = nota.error;
    } else if (nota.estado === 'fallo_envio' && nota.envio) {
        detalle.style.cssText = 'font-size:12px;color:#a33a12;margin-top:3px;font-weight:500;';
        detalle.textContent = `${nota.envio.nombre}: ${nota.envio.error || 'falló sin detalle'}`;
    } else {
        detalle.className = 'archivo';
        detalle.textContent = nota.archivo || `se guardará como …-${normalizar(nota.nombre_archivo)}_9r.mp4`;
    }
    col2.appendChild(detalle);
    fila.appendChild(col2);

    // Estado
    const col3 = document.createElement('div');
    const badge = document.createElement('span');
    badge.className = `badge-estado ${clase}`;
    if (grabando) badge.innerHTML = '<span class="dot-rec"></span>';
    badge.appendChild(document.createTextNode(etiqueta));
    col3.appendChild(badge);
    fila.appendChild(col3);

    // Duración
    const col4 = document.createElement('div');
    col4.className = 'celda-duracion dato col-oculta' + (nota.duration_seconds == null ? ' dato-vacio' : '') + (grabando ? ' dato-fuerte' : '');
    col4.textContent = nota.duration_seconds == null ? '—' : formatearDuracion(nota.duration_seconds);
    fila.appendChild(col4);

    // Tamaño
    const col5 = document.createElement('div');
    col5.className = 'celda-tamano dato col-oculta' + (nota.size_bytes ? '' : ' dato-vacio');
    col5.textContent = nota.size_bytes ? formatearBytes(nota.size_bytes) : '—';
    fila.appendChild(col5);

    // Acciones
    const col6 = document.createElement('div');
    col6.className = 'acciones col-oculta';

    if (grabando) {
        const stop = document.createElement('button');
        stop.type = 'button';
        stop.className = 'btn-gr btn-stop-nuevo';
        stop.innerHTML = '<i class="fas fa-stop"></i> DETENER';
        stop.disabled = enTransicion || nota.estado === 'deteniendo';
        stop.onclick = () => detenerNota(nota.id);
        col6.appendChild(stop);
    } else {
        if (nota.recording_id) {
            const log = document.createElement('button');
            log.type = 'button';
            log.className = 'btn-gr btn-neutro';
            log.textContent = 'Log';
            log.onclick = () => verLog(nota.id, nota.titulo);
            col6.appendChild(log);
        }
        const rec = document.createElement('button');
        rec.type = 'button';
        rec.className = 'btn-gr btn-rec-nuevo';
        rec.innerHTML = '<span class="dot-rec"></span> ' +
            (nota.estado === 'fallo' ? 'REINTENTAR' : 'GRABAR');
        rec.disabled = grabandoOtra || enTransicion ||
            (ultimoSnapshot && ultimoSnapshot.perfil_ok === false);
        rec.onclick = () => grabarNota(nota.id);
        col6.appendChild(rec);
    }

    fila.appendChild(col6);
    return fila;
}

function pintarOtras(otras) {
    const contenedor = document.getElementById('listaOtras');
    if (!otras.length) {
        contenedor.innerHTML = '<div class="vacio" style="padding:18px;">Nada más corriendo ahora.</div>';
        return;
    }

    contenedor.innerHTML = '';
    otras.forEach(rec => {
        const fila = document.createElement('div');
        fila.className = 'gr-fila';
        fila.style.gridTemplateColumns = 'minmax(0,1fr) 140px 100px 92px';
        fila.innerHTML = `
            <div style="min-width:0;">
                <div class="titulo"></div>
                <div class="archivo"></div>
            </div>
            <div><span class="badge-estado badge-grabando"><span class="dot-rec"></span>GRABANDO</span></div>
            <div class="dato">${formatearDuracion(rec.duration_seconds)}</div>
            <div class="dato">${formatearBytes(rec.size_bytes)}</div>`;
        fila.querySelector('.titulo').textContent = rec.name || '(sin nombre)';
        fila.querySelector('.archivo').textContent = `${rec.output || ''} · ${rec.input_key || ''} · ${rec.profile_key || ''}`;
        contenedor.appendChild(fila);
    });
}

const ESTADOS_TAREA = {
    en_cola: ['en cola', '#a2a6ac', '#6b6f76'],
    ejecutando: ['ejecutando', '#b06d12', '#8a5407'],
    listo: ['listo', '#2e7d5b', '#1f6349'],
    fallido: ['falló', '#c8322c', '#a52a24'],
};

function pintarTareas(tareas) {
    const contenedor = document.getElementById('listaTareas');
    const resumen = document.getElementById('resumenTareas');

    const pendientes = tareas.filter(t => t.estado === 'en_cola' || t.estado === 'ejecutando').length;
    resumen.textContent = pendientes ? `${pendientes} en cola` : '';

    if (!tareas.length) {
        contenedor.innerHTML = '<div class="vacio" style="padding:18px;">Sin envíos pendientes.</div>';
        return;
    }

    contenedor.innerHTML = '';
    tareas.forEach(tarea => {
        const [texto, color, colorTexto] = ESTADOS_TAREA[tarea.estado] || ESTADOS_TAREA.en_cola;
        const item = document.createElement('div');
        item.className = 'item-tarea';
        item.innerHTML = `
            <span class="punto" style="background:${color};margin-top:5px;"></span>
            <div style="min-width:0;">
                <div class="t-nombre" style="font-size:14px;font-weight:600;"></div>
                <div class="t-archivo archivo" style="margin-top:2px;"></div>
                <div class="t-estado" style="font-size:12px;margin-top:3px;font-weight:600;color:${colorTexto};"></div>
            </div>`;
        item.querySelector('.t-nombre').textContent = tarea.nombre || 'Acción posterior';
        item.querySelector('.t-archivo').textContent = tarea.archivo || '';
        item.querySelector('.t-estado').textContent =
            tarea.estado === 'fallido' ? `${texto} — ${tarea.error || 'sin detalle'}` : texto;
        contenedor.appendChild(item);
    });
}

function pintarPanelVivo(notas, otras) {
    const panel = document.getElementById('panelVivo');
    const enVivo = notas.find(n => n.estado === 'grabando' || n.estado === 'deteniendo');

    if (!enVivo) {
        detenerSeguimientoLog();
        delete panel.dataset.ultimoTamano;
        delete panel.dataset.lecturasQuietas;
        const firmaVacia = `vacio:${otras.length ? otras[0].id : ''}`;
        if (panel.dataset.firma === firmaVacia) {
            const crono = panel.querySelector('.crono');
            if (crono && otras.length) crono.textContent = formatearDuracion(otras[0].duration_seconds);
            return;
        }
        panel.dataset.firma = firmaVacia;
        const otra = otras[0];
        panel.innerHTML = otra ? `
            <div style="display:flex;align-items:center;gap:9px;">
                <span class="punto punto-ocupado"></span>
                <span style="font-size:12px;font-weight:700;letter-spacing:1px;">EL EQUIPO ESTÁ GRABANDO</span>
            </div>
            <div class="crono">${formatearDuracion(otra.duration_seconds)}</div>
            <div style="font-size:15px;font-weight:600;" id="pvNombre"></div>
            <div class="mono" style="font-size:12px;color:#9aa0a8;margin-top:4px;">no es una nota de este guion</div>` : `
            <div style="display:flex;align-items:center;gap:9px;">
                <span class="punto punto-gris"></span>
                <span style="font-size:12px;font-weight:700;letter-spacing:1px;">NADA GRABANDO</span>
            </div>
            <div class="crono">00:00:00</div>
            <div style="font-size:13px;color:#9aa0a8;">Elegí una nota y tocá GRABAR.</div>`;
        if (otra) panel.querySelector('#pvNombre').textContent = otra.name || '(sin nombre)';
        return;
    }

    // Aviso de captura muda: se levanta recién tras varias lecturas sin crecer,
    // para no gritar por el redondeo de un tick.
    const bytes = enVivo.size_bytes || 0;
    const previo = Number(panel.dataset.ultimoTamano || 0);
    let quietos = Number(panel.dataset.lecturasQuietas || 0);
    quietos = (panel.dataset.ultimoTamano !== undefined && bytes <= previo) ? quietos + 1 : 0;
    panel.dataset.lecturasQuietas = quietos;
    const creciendo = quietos < 3;

    const firma = `vivo:${enVivo.id}:${enVivo.estado}`;
    if (panel.dataset.firma === firma) {
        panel.querySelector('.crono').textContent = formatearDuracion(enVivo.duration_seconds);
        panel.querySelector('.pv-bytes').textContent = formatearBytes(bytes);
        panel.querySelector('.pv-barra').style.width = `${Math.min(100, (bytes / 2e9) * 100)}%`;
        const salud = panel.querySelector('.pv-salud');
        salud.textContent = creciendo ? 'el archivo crece' : 'el archivo NO crece — revisar la señal';
        salud.style.color = creciendo ? '#8fd6b4' : '#ffb4ae';
        panel.dataset.ultimoTamano = bytes;
        return;
    }
    panel.dataset.firma = firma;

    panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:9px;">
            <span class="punto punto-ocupado"></span>
            <span style="font-size:12px;font-weight:700;letter-spacing:1px;">
                ${enVivo.estado === 'deteniendo' ? 'DETENIENDO' : 'GRABANDO AHORA'}</span>
        </div>
        <div class="crono">${formatearDuracion(enVivo.duration_seconds)}</div>
        <div style="font-size:15px;font-weight:600;" id="pvNombre"></div>
        <div class="mono" style="font-size:12px;color:#9aa0a8;margin-top:4px;" id="pvArchivo"></div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:16px;">
            <div class="barra"><div class="pv-barra" style="width:${Math.min(100, (bytes / 2e9) * 100)}%;"></div></div>
            <span class="pv-bytes mono" style="font-size:12px;color:#d9dade;">${formatearBytes(bytes)}</span>
        </div>
        <div class="pv-salud" style="font-size:12px;margin-top:8px;color:${creciendo ? '#8fd6b4' : '#ffb4ae'};">
            ${creciendo ? 'el archivo crece' : 'el archivo NO crece — revisar la señal'}</div>
        <div style="display:flex;gap:10px;margin-top:18px;">
            <button type="button" id="pvStop" class="btn-gr"
                    style="flex-grow:1;height:48px;background:#fff;color:#14161a;justify-content:center;">DETENER</button>
        </div>`;
    panel.querySelector('#pvNombre').textContent = `Nota ${enVivo.numero_de_nota} — ${enVivo.titulo}`;
    panel.querySelector('#pvArchivo').textContent = enVivo.archivo || '';
    panel.querySelector('#pvStop').onclick = () => detenerNota(enVivo.id);
    panel.dataset.ultimoTamano = bytes;
    panel.dataset.lecturasQuietas = quietos;

    seguirLog(enVivo.id, enVivo.numero_de_nota);
}

function pintarProgramaciones(programaciones) {
    const contenedor = document.getElementById('listaProgramaciones');
    if (!programaciones || !programaciones.length) {
        contenedor.innerHTML = '<div class="vacio" style="padding:18px;">Sin programaciones.</div>';
        return;
    }

    contenedor.innerHTML = '';
    programaciones.slice(0, 6).forEach(prog => {
        const item = document.createElement('div');
        item.className = 'item-tarea';
        item.innerHTML = `
            <span class="punto" style="background:${prog.enabled ? '#2f4d76' : '#a2a6ac'};margin-top:5px;"></span>
            <div style="min-width:0;">
                <div class="p-nombre" style="font-size:14px;font-weight:600;"></div>
                <div class="p-detalle" style="font-size:12px;color:#6b6f76;margin-top:2px;"></div>
            </div>`;
        item.querySelector('.p-nombre').textContent = prog.name;
        item.querySelector('.p-detalle').textContent =
            (prog.description || `${prog.start} → ${prog.stop}`) + (prog.enabled ? '' : ' · pausada');
        contenedor.appendChild(item);
    });
}

// ===== LOG =====

function seguirLog(textoId, numero) {
    if (logTextoId === textoId) return;
    detenerSeguimientoLog();
    logTextoId = textoId;
    document.getElementById('tituloLog').textContent = `LOG DE FFMPEG · NOTA ${numero}`;
    document.getElementById('estadoLog').textContent = 'EN VIVO';
    cargarLog(textoId);
    logInterval = setInterval(() => cargarLog(textoId), 3000);
}

function detenerSeguimientoLog() {
    if (logInterval) clearInterval(logInterval);
    if (logTextoId !== null) {
        document.getElementById('estadoLog').textContent = 'ÚLTIMAS LÍNEAS';
    }
    logInterval = null;
    logTextoId = null;
}

async function cargarLog(textoId) {
    try {
        const response = await fetch(`/api/grabacion/log/${textoId}`);
        const data = await response.json();
        const caja = document.getElementById('cajaLog');
        const lineas = data.log || [];
        caja.textContent = lineas.length ? lineas.slice(-12).join('\n') : 'ffmpeg todavía no escribió nada.';
        caja.scrollTop = caja.scrollHeight;
    } catch (error) { /* el próximo tick reintenta */ }
}

async function verLog(textoId, titulo) {
    detenerSeguimientoLog();
    document.getElementById('tituloLog').textContent = `LOG · ${titulo}`;
    document.getElementById('estadoLog').textContent = 'ÚLTIMAS LÍNEAS';
    await cargarLog(textoId);
}

// ===== ACCIONES =====

async function grabarNota(textoId) {
    if (hayGrabacionEnCurso()) {
        mostrarError('Ya hay una grabación en curso. Detenela antes de empezar otra.');
        return;
    }

    notaEnTransicion = textoId;
    pintarNotas(ultimoSnapshot ? ultimoSnapshot.notas : []);

    try {
        const response = await fetch('/api/grabacion/iniciar', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({texto_id: textoId})
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        mostrarMensajeExito(`Grabando ${data.nombre_archivo}`);
    } catch (error) {
        mostrarError(error.message);
    } finally {
        notaEnTransicion = null;
    }
}

async function detenerNota(textoId) {
    notaEnTransicion = textoId;

    try {
        const response = await fetch('/api/grabacion/detener', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({texto_id: textoId})
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        mostrarMensajeExito('Grabación detenida. El envío al storage queda en la cola.');
    } catch (error) {
        mostrarError(error.message);
    } finally {
        notaEnTransicion = null;
    }
}

async function detenerTodo() {
    const confirmacion = await Swal.fire({
        title: '¿Detener todas las grabaciones?',
        text: 'Incluye lo que esté grabando el scheduler o la pantalla de redes.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#c8322c',
        confirmButtonText: 'Detener todo',
        cancelButtonText: 'Cancelar'
    });
    if (!confirmacion.isConfirmed) return;

    try {
        const response = await fetch('/api/grabacion/detener-todo', {method: 'POST'});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        mostrarMensajeExito(`${data.detenidas} grabación(es) detenida(s)`);
    } catch (error) {
        mostrarError(error.message);
    }
}

// ===== UTILIDADES =====

function hayGrabacionEnCurso() {
    if (!ultimoSnapshot || !ultimoSnapshot.notas) return false;
    return ultimoSnapshot.notas.some(n => n.estado === 'grabando' || n.estado === 'deteniendo');
}

function filtrarNotas() {
    const busqueda = (document.getElementById('filtroNotas')?.value || '').toLowerCase();
    document.querySelectorAll('#listaGrabaciones .gr-fila').forEach(fila => {
        fila.style.display = fila.textContent.toLowerCase().includes(busqueda) ? '' : 'none';
    });
}

function formatearDuracion(segundos) {
    if (segundos == null) return '—';
    const h = String(Math.floor(segundos / 3600)).padStart(2, '0');
    const m = String(Math.floor((segundos % 3600) / 60)).padStart(2, '0');
    const s = String(Math.floor(segundos % 60)).padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function formatearBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(2)} TB`;
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(2)} GB`;
    if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
    return `${Math.round(bytes / 1e3)} kB`;
}

// Misma normalización que hace la Capturadora, solo para previsualizar el nombre.
function normalizar(nombre) {
    return String(nombre || '')
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '_').replace(/[^A-Za-z0-9._-]/g, '_')
        .replace(/_+/g, '_').replace(/^[._-]+|[._-]+$/g, '')
        .toUpperCase();
}

function mostrarMensajeExito(mensaje) {
    Swal.fire({
        toast: true, position: 'top-end', icon: 'success', title: mensaje,
        showConfirmButton: false, timer: 2600, timerProgressBar: true
    });
}

function mostrarError(mensaje) {
    Swal.fire({
        toast: true, position: 'top-end', icon: 'error', title: mensaje,
        showConfirmButton: false, timer: 5000, timerProgressBar: true
    });
}
