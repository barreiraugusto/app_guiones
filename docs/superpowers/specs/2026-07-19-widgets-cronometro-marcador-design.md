# Widgets de cuenta regresiva y marcador de tantos

## Problema

El panel de control en vivo (`control_live`) hoy permite agregar overlays
configurables (Ticker, badge Vivo, Mosca) que se muestran tanto en el editor
como en la salida real (`/pantalla`). Se necesitan dos overlays nuevos con el
mismo alcance:

1. **Cronómetro**: cuenta regresiva con formato configurable (`HH:MM:SS` o
   `MM:SS`), con controles de Inicio, Stop y Restablecer.
2. **Marcador**: contador de tantos para dos equipos, con nombres
   configurables y control de suma/resta de tantos por equipo.

## Alcance

Ambos widgets se transmiten al aire (mismo patrón que el Ticker): son
overlays posicionables/redimensionables en el lienzo de `control_live`, con
sus propiedades de estilo (posición, tamaño, fuente, color, negrita, cursiva)
editables en el panel lateral cuando están seleccionados — y además, a
diferencia del Ticker, tienen sus **controles operativos** (los que se usan
constantemente durante la transmisión: Inicio/Stop/Restablecer, +/-) en un
bloque fijo **debajo del lienzo**, siempre visible, no en el panel lateral.

No hay modelo de base de datos para ninguno de los dos: se persisten como
JSON libre en `display_config.json`, mismo mecanismo que Ticker/Vivo/Mosca.

## Backend

`app/routes/graphs.py:492`, `update_display_config`: agregar `'cronometro'` y
`'marcador'` a la lista de secciones válidas:

```python
for section in ['live', 'ticker', 'mosca', 'cronometro', 'marcador']:
```

Sin más cambios de backend. Ninguna de las dos secciones tiene lógica de
negocio en Python — el backend solo persiste el JSON que le manda el
frontend, igual que las secciones existentes. En particular, el cálculo del
tiempo restante del cronómetro vive enteramente en JS (ver más abajo), no en
el servidor.

## Widget Cronómetro

### Datos (`display_config.json`, sección `cronometro`)

```json
{
  "cronometro": {
    "show": false,
    "left": 0, "top": 0, "width": 300, "height": 80,
    "mostrar_horas": true,
    "duracion_horas": 0, "duracion_minutos": 5, "duracion_segundos": 0,
    "estado": "detenido",
    "epoch_inicio": null,
    "segundos_restantes": null,
    "fuente": "Arial", "tamano_fuente": 40, "negrita": true, "cursiva": false,
    "color": "#ffffff", "bg_color": "#000000"
  }
}
```

- `estado`: `"detenido"` | `"corriendo"` | `"pausado"` | `"terminado"`.
  `"terminado"` es un estado distinto de `"detenido"`, usado solo por la
  auto-detención al llegar a cero (ver más abajo) — si compartiera el mismo
  valor que `"detenido"`, el tiempo mostrado saltaría de `00:00` de vuelta a
  la duración configurada completa apenas termina el conteo, en vez de
  quedarse fijo en cero (bug real encontrado en la revisión final de este
  feature, corregido antes de mergear).
- `epoch_inicio`: `Date.now() / 1000` (segundos, no ms) en el momento en que
  se calcula el arranque — ver más abajo cómo se ajusta al reanudar desde
  pausa. `null` salvo cuando `estado === "corriendo"`.
- `segundos_restantes`: snapshot del tiempo que quedaba al pausar. `null`
  salvo cuando `estado === "pausado"`.
- `duracion_horas`/`duracion_minutos`/`duracion_segundos`: la duración
  configurada por el operador (de la que arranca la cuenta regresiva cada vez
  que se Restablece o se inicia desde "detenido"). `duracion_total_seg =
  duracion_horas*3600 + duracion_minutos*60 + duracion_segundos`.

### Lógica de tiempo (JS, duplicada en `control_live.js` y `pantalla.js` —
mismo criterio ya usado para `FUENTES_FIJAS`, no hay módulos compartidos
entre estos scripts)

**Botón Inicio** (`iniciarCronometro()`):
- Si `estado === 'detenido'` o `estado === 'terminado'`: `epoch_inicio =
  Date.now() / 1000`, `estado = 'corriendo'`, `segundos_restantes = null`
  (arranca desde la duración configurada completa en ambos casos).
- Si `estado === 'pausado'`: `epoch_inicio = Date.now() / 1000 -
  (duracion_total_seg - segundos_restantes)` (retrocede el "inicio" lo
  suficiente para que el tiempo transcurrido ya contabilizado antes de la
  pausa se preserve), `estado = 'corriendo'`, `segundos_restantes = null`.
- Sin efecto si ya `estado === 'corriendo'`.
- Llamar `guardarSeccion('cronometro', cronometroState)` al final.

**Botón Stop** (`pausarCronometro()`, solo tiene efecto si `estado ===
'corriendo'`):
- `segundos_restantes = Math.max(0, Math.min(duracion_total_seg,
  duracion_total_seg - (Date.now() / 1000 - epoch_inicio)))`.
- `estado = 'pausado'`, `epoch_inicio = null`.
- Llamar `guardarSeccion('cronometro', cronometroState)`.

**Botón Restablecer** (`restablecerCronometro()`, siempre tiene efecto):
- `estado = 'detenido'`, `epoch_inicio = null`, `segundos_restantes = null`.
- Llamar `guardarSeccion('cronometro', cronometroState)`.

**Tiempo a mostrar en cualquier momento** (función pura `segundosRestantes
(cfg)`, usada tanto para el preview del editor como para la salida real):

```js
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
```

**Formato de texto** (función pura `formatearTiempo(segundos, mostrarHoras)`):
- `segundos` se redondea hacia arriba a entero (`Math.ceil`) antes de
  formatear, para que el último segundo visible sea "00:00:01" y no salte de
  "00:00:01" a "00:00:00" antes de tiempo por redondeo hacia abajo.
- Si `mostrarHoras`: `HH:MM:SS` con cada campo con padding a 2 dígitos, sin
  límite superior en horas (si la duración configurada supera 99 horas,
  igual se muestran todos los dígitos que hagan falta).
- Si no `mostrarHoras`: `MM:SS`, donde `MM` es el total de minutos
  (`Math.floor(segundos / 60)`, sin volver a acumular horas por separado) —
  o sea, una duración de 1h30m con `mostrar_horas: false` se muestra como
  `90:00`, no se trunca a `30:00`.

**Auto-detención al llegar a 0**: solo en `control_live.js` (nunca en
`pantalla.js`, que no debe escribir configuración), en el `setInterval` que
refresca el preview cada segundo: si `cronometroState.estado === 'corriendo'`
y `segundosRestantesCronometro(cronometroState) <= 0`, hacer `estado =
'terminado'` (no `'detenido'` — son estados distintos, ver arriba),
`epoch_inicio = null`, `segundos_restantes = null`, y llamar
`guardarSeccion('cronometro', cronometroState)` una sola vez — usar una
bandera local para no repetir el guardado en cada tick mientras el estado
siga en `'terminado'` tras la transición. El tiempo mostrado queda fijo en
`00:00` (o `00:00:00`) hasta que el operador apriete Inicio (reinicia el
conteo completo) o Restablecer.

### Panel lateral (propiedades de estilo, cuando el widget está seleccionado
en el lienzo)

Mismo patrón que Ticker: Top/Left/Ancho/Alto, Color de texto, Color de
fondo, selector de Fuente (`FUENTES_FIJAS` + Personalizada) + Tamaño +
Negrita + Cursiva. Sin el campo "Mostrar" (ese va en el bloque debajo del
lienzo, ver a continuación) ni ningún campo de duración/formato/estado (esos
también van debajo del lienzo, son controles operativos de uso frecuente,
no propiedades de estilo).

### Controles debajo del lienzo (siempre visibles, no dependen de tener el
widget seleccionado)

Nueva card en `control_live.html`, debajo de la card de checkboxes existente
(Ticker/Vivo/Mosca + Sacar del aire):

```html
<div class="card p-2 mt-2">
    <strong class="mb-2">Cronómetro</strong>
    <div class="d-flex flex-wrap align-items-center" style="gap: 0.75rem;">
        <div class="form-check">
            <input type="checkbox" class="form-check-input" id="cron-mostrar">
            <label class="form-check-label" for="cron-mostrar">Mostrar</label>
        </div>
        <div class="form-check">
            <input type="checkbox" class="form-check-input" id="cron-mostrar-horas">
            <label class="form-check-label" for="cron-mostrar-horas">Mostrar horas</label>
        </div>
        <div class="input-group input-group-sm" style="width: auto;">
            <input type="number" class="form-control" id="cron-horas" min="0" style="width: 60px;" placeholder="HH">
            <input type="number" class="form-control" id="cron-minutos" min="0" max="59" style="width: 60px;" placeholder="MM">
            <input type="number" class="form-control" id="cron-segundos" min="0" max="59" style="width: 60px;" placeholder="SS">
        </div>
        <span id="cron-display" class="font-weight-bold" style="min-width: 80px;">00:00</span>
        <button class="btn btn-success btn-sm" id="cron-btn-inicio">Inicio</button>
        <button class="btn btn-warning btn-sm" id="cron-btn-stop">Stop</button>
        <button class="btn btn-outline-secondary btn-sm" id="cron-btn-restablecer">Restablecer</button>
    </div>
</div>
```

- Los 3 inputs de duración están habilitados cuando `estado === 'detenido'`
  o `estado === 'terminado'`, y deshabilitados (`disabled`) mientras
  `estado === 'corriendo'` o `'pausado'` (si el cronómetro está corriendo o
  pausado, cambiarlos no debe alterar la cuenta en curso — para eso primero
  hay que pararlo).
- `#cron-display` muestra en vivo el tiempo restante (actualizado por el
  mismo `setInterval` de refresco del preview), formateado con
  `formatearTiempo`.

## Widget Marcador

### Datos (`display_config.json`, sección `marcador`)

```json
{
  "marcador": {
    "show": false,
    "left": 0, "top": 0, "width": 400, "height": 100,
    "nombre_equipo_1": "Equipo 1", "nombre_equipo_2": "Equipo 2",
    "tantos_equipo_1": 0, "tantos_equipo_2": 0,
    "fuente": "Arial", "tamano_fuente": 36, "negrita": true, "cursiva": false,
    "color": "#ffffff", "bg_color": "#000000"
  }
}
```

### Lógica

- `sumarTanto(equipo)` / `restarTanto(equipo)`: `tantos_equipo_N += 1` /
  `tantos_equipo_N = Math.max(0, tantos_equipo_N - 1)` (piso en 0, nunca
  negativo). Llamar `guardarSeccion('marcador', marcadorState)`.
- `reiniciarMarcador()`: `tantos_equipo_1 = 0`, `tantos_equipo_2 = 0`. Los
  nombres de equipo NO se resetean (solo los tantos).
- Cambiar el nombre de un equipo: actualiza `nombre_equipo_N` y guarda,
  mismo patrón `blur` que el resto de inputs de texto del proyecto.

### Formato de texto en el overlay

`"{nombre_equipo_1} {tantos_equipo_1} - {tantos_equipo_2} {nombre_equipo_2}"`
en una sola línea (ej: `"RIVER 2 - 1 BOCA"`), usando el mismo elemento de
texto para todo (nombres y tantos comparten fuente/tamaño/color — no hay
estilo diferenciado entre el nombre y el número, para mantener el modelo de
datos simple, igual criterio que el Ticker no diferencia estilo dentro de su
propio texto).

### Panel lateral (propiedades de estilo)

Mismo patrón que Cronómetro: Top/Left/Ancho/Alto, Color de texto, Color de
fondo, Fuente + Tamaño + Negrita + Cursiva. Sin nombres/tantos/Mostrar (van
debajo del lienzo).

### Controles debajo del lienzo

```html
<div class="card p-2 mt-2">
    <strong class="mb-2">Marcador</strong>
    <div class="d-flex flex-wrap align-items-center" style="gap: 0.75rem;">
        <div class="form-check">
            <input type="checkbox" class="form-check-input" id="marc-mostrar">
            <label class="form-check-label" for="marc-mostrar">Mostrar</label>
        </div>
        <input type="text" class="form-control form-control-sm" id="marc-nombre-1" style="width: 120px;" placeholder="Equipo 1">
        <button class="btn btn-outline-secondary btn-sm" id="marc-menos-1">-</button>
        <span id="marc-tantos-1" class="font-weight-bold" style="min-width: 24px; text-align: center;">0</span>
        <button class="btn btn-outline-secondary btn-sm" id="marc-mas-1">+</button>
        <span class="mx-2">-</span>
        <button class="btn btn-outline-secondary btn-sm" id="marc-menos-2">-</button>
        <span id="marc-tantos-2" class="font-weight-bold" style="min-width: 24px; text-align: center;">0</span>
        <button class="btn btn-outline-secondary btn-sm" id="marc-mas-2">+</button>
        <input type="text" class="form-control form-control-sm" id="marc-nombre-2" style="width: 120px;" placeholder="Equipo 2">
        <button class="btn btn-outline-secondary btn-sm" id="marc-reiniciar">Reiniciar</button>
    </div>
</div>
```

## Editor — preview en el lienzo (`control_live.js`)

Ambos widgets siguen exactamente el patrón ya usado por `crearElementoTicker`
(`el.id`, posición/tamaño/estilo inline, `mousedown` → arrastre, resize-handle
→ redimensión, `click` → `seleccionarElemento(...)`), agregados a
`elementoSeleccionado` como nuevos valores posibles (`'cronometro'`,
`'marcador'`), y a `renderizarLienzo()`/`renderizarPanelPropiedades()` con un
bloque más cada uno, mismo patrón que los 3 elementos existentes.

Un `setInterval` de 1000ms (arrancado una vez en `DOMContentLoaded`, igual
que `aplicarEscalaLienzo()`) refresca el texto mostrado del cronómetro en el
lienzo mientras `cronometroState.estado === 'corriendo'`, y hace la
auto-detección de fin de cuenta descripta arriba. El marcador no necesita
refresco por intervalo (solo cambia por acción del operador).

## Salida real (`pantalla.js` + `pantalla.html`)

Dos elementos nuevos en `pantalla.html`, mismo patrón que `#tickerBand`:

```html
<div id="cronometroBand"></div>
<div id="marcadorBand"></div>
```

con CSS `position: fixed; display: none;` (el resto de posición/tamaño se
aplica por JS inline, igual que el Ticker).

`pantalla.js`: `updateCronometro(cfg)` y `updateMarcador(cfg)`, llamadas
desde `updateDisplay(data)` junto a `updateTicker`/`updateMosca`. Aplican
posición/tamaño/fuente/color/display igual que `updateTicker` (sin animación
de entrada/salida — no fue pedida para estos widgets, quedan mostrados/
ocultos de forma directa con `display`, igual que el badge Vivo).

Un `setInterval` de 1000ms propio en `pantalla.js` (separado del refresco
por SSE, que sigue siendo cada 1s pero no está sincronizado con este) vuelve
a formatear y pintar el texto del cronómetro mientras esté corriendo, para
que no dependa de la latencia/jitter del SSE — se guarda el último `cfg` de
cronómetro recibido en una variable de módulo y el intervalo solo reformatea
el texto a partir de ese `cfg`, no recalcula todo el overlay.

## Fuera de alcance

- Animación de entrada/salida para estos dos widgets.
- Sonido/alerta al llegar a 00:00:00.
- Múltiples cronómetros o marcadores simultáneos (cada uno es singleton,
  igual que Ticker/Vivo/Mosca).
- Persistencia del cronómetro/marcador en la base de datos (viven solo en
  `display_config.json`, se resetean si se edita el archivo a mano).
