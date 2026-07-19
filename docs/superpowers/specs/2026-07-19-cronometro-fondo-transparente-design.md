# Cronómetro: fondo transparente y esquinas redondeadas

## Problema

El widget Cronómetro (cuenta regresiva) no tiene forma de hacer su fondo
transparente ni de redondear sus esquinas. Solo el Marcador no está en
alcance para esto — el pedido es específicamente para el Cronómetro.

## Alcance

Dos campos nuevos, solo para el Cronómetro:

1. **Opacidad de fondo** (0-100, control numérico): a diferencia de la
   opacidad general que ya existe para ocultar/mostrar el widget completo en
   el editor (`el.style.opacity` cuando `show` es falso), esta opacidad
   afecta **solo el color de fondo** — el texto del tiempo debe seguir
   viéndose siempre nítido, incluso con el fondo en 0% (totalmente
   transparente).
2. **Radio de esquina** (px, input numérico): mismo criterio que
   `radio_esquina` ya usado en las capas de tipo "forma" de las plantillas.

## Datos (`display_config.json.cronometro`)

Nuevos campos:

```json
{
  "cronometro": {
    "...": "...",
    "opacidad_fondo": 100,
    "radio_esquina": 0
  }
}
```

- `opacidad_fondo`: entero 0-100, default `100` (fondo completamente opaco,
  igual al comportamiento actual).
- `radio_esquina`: entero en px, default `0` (esquinas rectas, igual al
  comportamiento actual).

## Por qué no alcanza con `el.style.opacity`

El color de fondo se aplica hoy con `el.style.backgroundColor =
cronometroState.bg_color` (un string hex, ej `"#000000"`). Aplicar
`el.style.opacity` a todo el elemento afectaría también el texto del
cronómetro, que debe quedar siempre 100% opaco. La opacidad debe aplicarse
únicamente al canal alfa del color de fondo, convirtiendo el hex a
`rgba(r, g, b, opacidad/100)`.

Función pura nueva, duplicada en `control_live.js` y `pantalla.js` (mismo
criterio ya usado para `FUENTES_FIJAS` y las funciones de tiempo del
cronómetro — no hay módulos compartidos entre estos dos scripts):

```js
function colorFondoConOpacidad(hex, opacidadPct) {
    const valor = (hex || '#000000').replace('#', '');
    const r = parseInt(valor.substring(0, 2), 16) || 0;
    const g = parseInt(valor.substring(2, 4), 16) || 0;
    const b = parseInt(valor.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacidadPct)) / 100})`;
}
```

Reemplaza `el.style.backgroundColor = cronometroState.bg_color;` (editor) y
`band.style.backgroundColor = cfg.bg_color || '#000000';` (salida real) por
`el.style.backgroundColor = colorFondoConOpacidad(cronometroState.bg_color,
cronometroState.opacidad_fondo);` / el equivalente con `cfg`.

## Radio de esquina

Directo, sin cálculo: `el.style.borderRadius =
`${cronometroState.radio_esquina}px`;` (editor) y `band.style.borderRadius =
`${parseFloat(cfg.radio_esquina) || 0}px`;` (salida real).

## Editor (`control_live.js`)

**Estado** (`cargarConfig`, bloque `cronometroState`): agregar

```js
opacidad_fondo: (config.cronometro && config.cronometro.opacidad_fondo) !== undefined ? Math.max(0, Math.min(100, parseInt(config.cronometro.opacidad_fondo))) : 100,
radio_esquina: parseInt(config.cronometro && config.cronometro.radio_esquina) || 0,
```

**Preview** (`crearElementoCronometro`): usar `colorFondoConOpacidad(...)`
para `el.style.backgroundColor`, agregar `el.style.borderRadius`.

**Panel lateral**: agregar, junto al campo "Color fondo" existente, un input
numérico "Opacidad de fondo" (0-100) y un input numérico "Radio de esquina"
(px), mismo patrón `blur` → clamp → `guardarSeccion('cronometro', ...)` →
`renderizarLienzo()` que ya usan los demás campos numéricos del panel.

## Salida real (`pantalla.js` + `pantalla.html`)

**`updateCronometro`**: mismo reemplazo — `colorFondoConOpacidad(...)` para
el `background-color`, y `borderRadius` nuevo.

No hace falta tocar `pantalla.html` (no hay CSS fijo de `background-color`
ni `border-radius` para `#cronometroBand` que haya que quitar — ya se
aplican 100% por JS inline, igual que el resto de sus propiedades).

## Fuera de alcance

- Marcador (explícitamente descartado por el usuario para este pedido).
- Transparencia parcial del texto o de otros elementos del Cronómetro.
- Cambios de backend/validación.
