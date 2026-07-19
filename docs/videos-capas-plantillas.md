# Videos con transparencia para capas de plantilla

Guía para preparar archivos `.webm` que se usan en capas de tipo `video` (zócalos, moscas, animaciones) sin que consuman CPU de más en `/pantalla`.

## Formato que funciona

| Propiedad | Valor |
|---|---|
| Contenedor | WebM (Matroska) |
| Códec | VP9, Profile 0 |
| Pixel format | `yuva420p` (con canal alfa) |
| Alpha | Real, vía `BlockAdditional` de Matroska (no un blend mode en CSS) |
| Resolución del archivo | Ajustada al contenido visible, **no** al lienzo completo (ver más abajo) |
| Frame rate | 30fps (no es necesario bajarlo) |

`pantalla.js` renderiza estos videos como `<video autoplay muted loop>` dentro de un `<div class="capa">` con `object-fit: contain`. No hay `mix-blend-mode` ni chroma-key en el CSS — la transparencia tiene que venir del archivo.

## Por qué importa el tamaño del archivo, no solo el bitrate

El costo de CPU de decodificar VP9 en el navegador depende principalmente de **cuántos píxeles hay que decodificar por frame**, no del bitrate. Un video de 1920×1080 con mucho relleno negro/transparente alrededor de una barra o un logo chico decodifica ese relleno igual que si tuviera contenido — bajar el CRF/bitrate casi no reduce ese costo (medido: ~5% de mejora). Recortar el archivo a la zona con contenido real sí lo reduce, en proporción directa a la cantidad de píxeles que se sacan (medido: 2.4x–13x más rápido según cuánto relleno tenía cada archivo).

**Regla práctica**: el archivo de video debe cubrir solo el área donde hay contenido visible (con un margen chico), no el lienzo de 1920×1080 completo. La posición se ajusta con `x`/`y`/`ancho`/`alto` de la capa en el editor de plantillas para que caiga en el mismo lugar en pantalla.

## Cómo procesar un video para que quede transparente y liviano

### 1. Encontrar el recuadro de contenido real

Extraer todos los frames y calcular el bounding box de píxeles no negros (aproximación válida incluso sin poder leer el alfa, ver sección siguiente):

```bash
ffmpeg -i entrada.webm -pix_fmt rgba frames/f_%03d.png
```

```python
from PIL import Image, ImageChops
import glob

min_l, min_t, max_r, max_b = 99999, 99999, 0, 0
for f in sorted(glob.glob("frames/*.png")):
    im = Image.open(f).convert("RGB")
    black = Image.new("RGB", im.size, (0, 0, 0))
    bbox = ImageChops.difference(im, black).getbbox()
    if bbox:
        l, t, r, b = bbox
        min_l, min_t = min(min_l, l), min(min_t, t)
        max_r, max_b = max(max_r, r), max(max_b, b)
print(min_l, min_t, max_r, max_b)
```

Usar **todos los frames**, no una muestra — una animación de entrada/salida puede mover el contenido fuera del bbox de un frame intermedio. Agregar ~5-8px de margen al resultado.

### 2. Recortar y reencodear preservando el alfa

```bash
ffmpeg -y -c:v libvpx-vp9 -i entrada.webm \
  -vf "crop=ANCHO:ALTO:X:Y" \
  -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 \
  -crf 32 -b:v 0 -deadline good -cpu-used 4 \
  salida.webm
```

**El `-c:v libvpx-vp9` antes de `-i` es obligatorio, no opcional.** Es el punto donde falla si se omite (ver siguiente sección).

### 3. Reposicionar la capa

Con el recorte `crop=ANCHO:ALTO:X:Y` aplicado sobre un archivo original que estaba mapeado a una capa con `x0,y0,ancho0,alto0` (normalmente el lienzo completo 1920×1080, `ancho0`/`alto0` pueden diferir levemente de 1920×1080 por redondeos previos):

```
nueva_ancho = ancho0 * (ANCHO / 1920)
nueva_alto  = alto0  * (ALTO  / 1080)
nueva_x     = x0 + ancho0 * (X / 1920)
nueva_y     = y0 + alto0  * (Y / 1080)
```

Esto se actualiza en las columnas `x`, `y`, `ancho`, `alto` de `plantilla_capa`, o directamente en el editor de plantillas si se prefiere hacerlo a mano arrastrando la capa.

## El error que rompe la transparencia (y cómo no repetirlo)

**Por defecto, el decodificador VP9 nativo de ffmpeg no lee el canal alfa embebido en WebM** (el que va como `BlockAdditional` de Matroska). Da como resultado un video con el tag `ALPHA_MODE=1` en los metadatos —o sea, *parece* que tiene alfa— pero el canal alfa decodificado es 100% opaco. Cualquier pipeline de ffmpeg que decodifique con el decodificador por defecto y vuelva a encodear (crop, escalado, cambio de bitrate, etc.) va a producir un archivo sin transparencia real, aunque el archivo de origen sí la tenga y se vea bien en el navegador.

La solución es forzar el decodificador correcto **en la entrada**, antes del filtro:

```bash
# MAL — pierde el alfa silenciosamente
ffmpeg -i entrada.webm -vf crop=... -c:v libvpx-vp9 -pix_fmt yuva420p salida.webm

# BIEN — decodifica el alfa real
ffmpeg -c:v libvpx-vp9 -i entrada.webm -vf crop=... -c:v libvpx-vp9 -pix_fmt yuva420p salida.webm
```

### Cómo verificar que el alfa es real (no confiar en el tag)

El tag de metadata no prueba nada. Hay que leer el plano alfa decodificado:

```bash
ffmpeg -y -c:v libvpx-vp9 -i archivo.webm \
  -vf "select=eq(n\,N),format=yuva420p" -vframes 1 \
  -f rawvideo /tmp/check.yuva420p
```

```python
w, h = ANCHO, ALTO  # dimensiones del video
y_size = w * h
uv_size = (w // 2) * (h // 2)
data = open("/tmp/check.yuva420p", "rb").read()
alpha = data[y_size + 2 * uv_size : y_size + 2 * uv_size + y_size]
import collections
print(collections.Counter(alpha[::13]).most_common(5))
```

Si el resultado es solo `{255: N}` (todo opaco), el alfa se perdió. Si hay una mezcla de `0` (transparente), `255` (opaco) y valores intermedios (bordes antialiaseados), el alfa es real.

Otra forma rápida y visual: componer el frame extraído sobre un fondo magenta con Pillow (`Image.alpha_composite`) y mirarlo — si el magenta se ve alrededor del contenido, hay transparencia real.

## Checklist antes de subir un video nuevo a una plantilla

1. ¿Es VP9 en WebM con `-pix_fmt yuva420p`? (`ffprobe -show_streams` → `codec_name=vp9`)
2. ¿El archivo está recortado a su contenido real, no al lienzo completo?
3. ¿Se verificó el alfa real (no solo el tag `alpha_mode`) con el método de arriba?
4. ¿Se ajustaron `x`/`y`/`ancho`/`alto` de la capa para que el recorte caiga en la posición correcta?
