# Salida key+fill vía Blackmagic DeckLink Duo a mixer de video

## Contexto

`control_live` + `/pantalla` (`app/templates/pantalla.html`, `app/static/js/pantalla.js`) hoy solo se ven en el monitor de la PC que corre la app Flask. `/pantalla` ya renderiza con `background: transparent` (`pantalla.html:11`) y compone capas de plantilla (imagen/video/texto/forma), incluyendo videos WebM VP9 con canal alfa real (ver `docs/videos-capas-plantillas.md`).

Se necesita, por primera vez, sacar esa gráfica hacia un mixer de video externo mediante SDI, usando el método broadcast estándar de **key + fill**: dos señales separadas (fill = color, key = matte de luminancia) que el mixer combina sobre la señal de cámara en vivo. El hardware disponible es una **Blackmagic DeckLink Duo** (2 puertos SDI), ideal para sacar fill por un puerto y key por el otro.

## Decisión de enfoque

Se descartó escribir una integración a medida contra el SDK de Blackmagic (captura de frames del navegador + composición manual de key/fill) por ser mucho más trabajo de desarrollo y mantenimiento.

Se eligió **CasparCG Server** como motor de playout:
- Su **HTML producer** (Chromium embebido) puede cargar una URL directamente — en este caso `/pantalla` — y preserva el canal alfa real del render, igual que ya se aprovecha en el navegador con los WebM de `docs/videos-capas-plantillas.md`.
- Su **consumer `decklink`** soporta salida key+fill dual-link nativa sobre los dos puertos de una tarjeta como la Duo, con key en formato **luma** (confirmado como lo que espera el mixer).

Esto significa que `/pantalla` y `pantalla.js` no requieren reescritura: se reutilizan tal cual, tratando a CasparCG como un reemplazo de "OBS Browser Source" pero con salida SDI nativa en vez de composición en software.

## Arquitectura

```
[Servidor Flask: control_live + /pantalla + SSE]   (sin cambios)
                    │  HTTP (LAN)
                    ▼
        [PC dedicada, con DeckLink Duo]  (máquina separada del servidor Flask)
        CasparCG Server
          └─ Canal 1: formato 1080i50
               ├─ Layer HTML → http://<servidor>:5000/pantalla
               │    (Chromium embebido, alfa real)
               └─ Consumer "decklink" en modo key/fill separado
                      ├─ SDI puerto A de la Duo → Fill
                      └─ SDI puerto B de la Duo → Key (luma)
                             ▼
                      Entradas del mixer de video
```

`/pantalla` no requiere autenticación (`app/routes/main.py:14`), así que el Chromium embebido de CasparCG puede cargarla sin manejo de sesión/login.

## Control on/off

**No se integra AMCP con `control_live`.** El layer HTML de CasparCG queda siempre cargado mostrando `/pantalla`; el operador del mixer decide si sale al aire o no con el fader de su propio canal de key. `control_live` sigue controlando el contenido de la gráfica exactamente como hoy (vía SSE) — este diseño no cambia qué se ve adentro de `/pantalla`, solo cómo esa salida llega físicamente al mixer.

Esto queda explícitamente fuera de alcance: si más adelante se quiere un botón "salida al aire" en `control_live` que cargue/descargue el layer en CasparCG vía AMCP, es un diseño aparte.

## Configuración de CasparCG (conceptual)

- Canal: `1080i5000` (1080i50).
- Producer: `[HTML] http://<servidor>:5000/pantalla`.
- Consumer `decklink`:
  - `device` = puerto A de la Duo (fill).
  - `key-device` = puerto B de la Duo (key), separado del de fill.
  - `keyer` = `external`/key separado (no internal keyer de la tarjeta).
  - Formato de key: **luma**.
  - `embedded-audio` = off (no hay audio que enviar por esta vía).

Los valores exactos de nombres de dispositivo (`device`/`key-device`) se determinan en la instalación real según cómo Desktop Video enumere los dos puertos de la Duo en esa PC.

## Riesgos

**CasparCG en Linux no es el target oficial.** El binario oficial de CasparCG Server es Windows-first. En Linux depende de builds/forks de comunidad (compilación propia o Docker) para las dos piezas más sensibles de este diseño: el HTML producer (Chromium embebido) y el consumer `decklink` (Blackmagic SDK). Los drivers Blackmagic Desktop Video para Linux además solo están certificados para un conjunto acotado de distros/kernels (típicamente ciertas versiones de Ubuntu LTS).

Mitigación: antes de tocar nada del lado de `control_live`/`pantalla`, se valida esto de forma aislada en la PC real (ver plan de verificación). Si algún eslabón no es viable en Linux, la salida de emergencia es correr el mismo CasparCG + Duo en una PC/VM Windows dedicada solo al playout — el resto del diseño (Flask intacto, `/pantalla` sin cambios, key+fill luma) no cambia.

## Plan de verificación

1. Confirmar distro/kernel exactos de la PC destino y su compatibilidad certificada con Desktop Video para Linux.
2. Instalar Desktop Video, confirmar que la Duo es detectada (herramienta de diagnóstico de Blackmagic).
3. Levantar CasparCG con un layer HTML apuntando a una URL de prueba simple (no `/pantalla` todavía) y verificar salida SDI fill+key con un monitor de forma de onda o directo en el mixer.
4. Apuntar el layer a `/pantalla` real (con datos de un guion de prueba) y validar en vivo: transparencia correcta en fondo y capas, reproducción de WebM con alfa, ausencia de lag perceptible en las actualizaciones por SSE.
5. Documentar la configuración final (`casparcg.config` completo, fuente/versión exacta del build de CasparCG usado, versión de Desktop Video) en `docs/`, siguiendo el estilo de `docs/videos-capas-plantillas.md`.

## Fuera de alcance

- Integración AMCP para prender/apagar la salida desde `control_live` (el mixer corta con su propio fader).
- Cualquier cambio funcional en `/pantalla`/`pantalla.js` — se reutilizan tal cual; ajustes cosméticos, si aparecen durante la verificación, se resuelven ahí y no se anticipan acá.
- Autenticación (no aplica, `/pantalla` es pública dentro de la LAN).
