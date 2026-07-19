# Marcador: fondo transparente y esquinas redondeadas

## Problema

El widget Marcador (contador de tantos) no tiene forma de hacer su fondo
transparente ni de redondear sus esquinas. Mismo pedido ya resuelto para el
Cronómetro (`docs/superpowers/specs/2026-07-19-cronometro-fondo-transparente-design.md`),
extendido ahora al Marcador con el mismo mecanismo y los mismos nombres de
campo.

## Alcance

Los mismos dos campos, exactamente el mismo comportamiento, solo para el
Marcador (el Cronómetro ya los tiene desde el feature anterior):

1. **Opacidad de fondo** (0-100): afecta solo el color de fondo — el texto
   "{equipo1} {tantos1} - {tantos2} {equipo2}" debe seguir viéndose siempre
   nítido, incluso con el fondo en 0% (totalmente transparente).
2. **Radio de esquina** (px).

## Datos (`display_config.json.marcador`)

Nuevos campos, mismos nombres y defaults que el Cronómetro:

```json
{
  "marcador": {
    "...": "...",
    "opacidad_fondo": 100,
    "radio_esquina": 0
  }
}
```

## Mecanismo (idéntico al del Cronómetro)

Misma función pura `colorFondoConOpacidad(hex, opacidadPct)` ya implementada
para el Cronómetro en `control_live.js` y `pantalla.js` — **no se duplica
una tercera vez**: el Marcador reutiliza la función que ya existe en cada
uno de esos dos archivos (ambos scripts ya la tienen, agregada por el
feature anterior), simplemente aplicándola también a
`marcadorState.bg_color`/`cfg.bg_color`.

```js
function colorFondoConOpacidad(hex, opacidadPct) {
    const valor = (hex || '#000000').replace('#', '');
    const r = parseInt(valor.substring(0, 2), 16) || 0;
    const g = parseInt(valor.substring(2, 4), 16) || 0;
    const b = parseInt(valor.substring(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(100, opacidadPct)) / 100})`;
}
```

## Editor (`control_live.js`)

**Estado** (`cargarConfig`, bloque `marcadorState`): agregar

```js
opacidad_fondo: (config.marcador && config.marcador.opacidad_fondo) !== undefined ? Math.max(0, Math.min(100, parseInt(config.marcador.opacidad_fondo))) : 100,
radio_esquina: parseInt(config.marcador && config.marcador.radio_esquina) || 0,
```

**Preview** (`crearElementoMarcador`): reemplazar
`el.style.backgroundColor = marcadorState.bg_color;` por
`el.style.backgroundColor = colorFondoConOpacidad(marcadorState.bg_color, marcadorState.opacidad_fondo);`
y agregar `el.style.borderRadius = `${marcadorState.radio_esquina}px`;`.

**Panel lateral**: agregar, junto al campo "Color fondo" existente del
bloque `elementoSeleccionado === 'marcador'`, un input numérico "Opacidad de
fondo" (0-100) y un input numérico "Radio de esquina" (px), mismo patrón
`blur` → clamp → `guardarSeccion('marcador', ...)` →
`renderizarLienzo()` que ya usan los demás campos numéricos de ese panel.

## Salida real (`pantalla.js`)

**`updateMarcador`**: reemplazar `band.style.backgroundColor = cfg.bg_color
|| '#000000';` por `band.style.backgroundColor =
colorFondoConOpacidad(cfg.bg_color, cfg.opacidad_fondo !== undefined ?
cfg.opacidad_fondo : 100);` y agregar `band.style.borderRadius =
`${parseFloat(cfg.radio_esquina) || 0}px`;`.

No hace falta tocar `pantalla.html` (mismo criterio que el Cronómetro: sin
CSS fijo de `background-color`/`border-radius` para `#marcadorBand` que haya
que quitar).

## Fuera de alcance

- Cambios al Cronómetro (ya tiene estos campos, no se toca).
- Cambios de backend/validación.
