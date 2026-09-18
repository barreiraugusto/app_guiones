# /grabaciones sobre la API de la Capturadora

La vista de grabación de SIGPRO ya no habla con los PHP sueltos de
`/var/www/html` del `.62`: usa la **API REST de la Capturadora v2**
(<https://github.com/tecnicacode/capturadora>), que corre en el mismo equipo en
el puerto 8000.

El cambio de fondo: el estado dejó de ser un booleano en la BD de SIGPRO. Cada
nota guarda el `recording_id` que devuelve el equipo (`texto.recording_id`) y
todo lo demás —duración, bytes escritos, log de ffmpeg, envío al storage— se lee
en vivo de la API.

## Configuración en SIGPRO

Variables de entorno (ver `config.py`):

| Variable | Default | Qué hace |
|---|---|---|
| `CAPTURADORA_API_URL` | `http://192.168.2.62:8000` | Base de la API. Vacía = la vista muestra "sin conexión". |
| `CAPTURADORA_API_KEY` | `''` | La `X-API-Key` del equipo (`server.api_key` de su `config.json`). Equivale a un administrador. |
| `CAPTURADORA_PERFIL` | `redes` | Perfil con el que se graban **todas** las notas del guion. |

La clave no está hardcodeada: sin ella la API responde 401 y la vista lo dice.

## Configuración que tiene que tener el equipo

Las notas del guion se graban siempre con el perfil de redes, que es el que
deja el archivo con el sufijo `_9r` y lo manda a `REDES` del día en el storage
`.50`. Eso vive en `/etc/capturadora/config.json`, no en SIGPRO:

```json
"profiles": {
  "redes": {
    "label": "Redes 1080i (CRF 21)",
    "extension": "mp4",
    "filename_suffix": "_9r",
    "output_args": ["…"],
    "post_actions": [
      {
        "nombre": "Crear la carpeta del día",
        "command": ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10",
                    "root@192.168.2.50",
                    "mkdir -p /media/storage/noticias/{fecha}/REDES/"]
      },
      {
        "nombre": "Enviar al storage",
        "command": ["rsync", "-a", "--partial", "-e", "ssh -o BatchMode=yes -o ConnectTimeout=10",
                    "{archivo}",
                    "root@192.168.2.50:/media/storage/noticias/{fecha}/REDES/"]
      }
    ]
  }
}
```

`{fecha}` se reemplaza por `AAAA/MM/DD` y `{archivo}` por la ruta absoluta de
**esa** grabación (el `sync_redes.sh` viejo subía "el último `_9r.mp4` de la
carpeta", que no siempre era el correcto).

La vista valida esto sola al abrirse: si el perfil no existe, no usa `_9r` o no
tiene acciones posteriores, aparece un aviso amarillo arriba y los botones
GRABAR quedan deshabilitados. Mejor eso que descubrirlo cuando el material no
llegó.

El equipo necesita, como el sistema viejo, clave SSH del usuario que corre la
Capturadora hacia `root@192.168.2.50` (ver la nota del server `.62`).

## Qué endpoint usa cada cosa

| En la vista | Endpoint de la Capturadora |
|---|---|
| Barra superior: entradas ocupadas/libres, disco, envíos pendientes | `GET /api/status` |
| Duración, tamaño y estado de cada nota | `GET /api/status` (activas) + `GET /api/recordings/{id}` (terminadas) |
| Botón GRABAR | `POST /api/recordings` con `{"name", "profile": "redes", "mode": "continuous"}` |
| Botón DETENER | `POST /api/recordings/{id}/stop` (por PID propio, no `killall`) |
| Detener todo | `POST /api/recordings/stop-all` |
| Panel de log | `GET /api/recordings/{id}/log` |
| "Después de grabar" (envíos al storage) | `GET /api/recordings/tareas/posteriores` |
| "Programado en el equipo" | `GET /api/schedules` |
| Validación del perfil | `GET /api/config` |

No se mandan `input` ni `subdir`: van los del equipo. El nombre del archivo lo
normaliza la Capturadora (`AAAA-MM-DD_HHMMSS-NOMBRE_9r.mp4`); SIGPRO solo elige
el nombre, que sale del `tema` del primer graph de la nota o, si no tiene, del
título.

## Rutas de SIGPRO

| Ruta | Qué hace |
|---|---|
| `GET /grabaciones` (y `/grabacion`) | La vista |
| `GET /stream_grabacion?guion_id=N` | SSE, un snapshot completo cada 2 s |
| `GET /api/grabacion/estado?guion_id=N` | El mismo snapshot, una sola vez |
| `POST /api/grabacion/iniciar` | `{"texto_id": N}` |
| `POST /api/grabacion/detener` | `{"texto_id": N}` |
| `POST /api/grabacion/detener-todo` | — |
| `GET /api/grabacion/log/<texto_id>` | Últimas líneas de ffmpeg |

La Capturadora tiene WebSocket (`/ws/status`), pero acá se poletea por HTTP y se
reemite por SSE: es el patrón que ya usa el resto de la app y no obliga a meter
websockets en Flask.

## Lo que quedó afuera

- **Recortes (`/api/clips`) y copia a playout (`copiar_a`, `/api/playouts`)**: la
  API los soporta, pero el material del guion va siempre a REDES.
- **Reintentar un envío fallido**: la API no expone un endpoint para reintentar
  una acción posterior. Cuando falla, la vista muestra el error (por ejemplo
  `ssh: connection refused`) y hay que reintentarlo en el equipo.
- Las rutas `/proxy/*_grabacion*` de `textos.py` siguen en el código apuntando a
  los PHP viejos. Ya no las usa nadie; quedan como referencia del sistema
  anterior.
