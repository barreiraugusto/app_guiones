# API de lectura `/api/v1` — diseño

## Objetivo

Exponer por HTTP/JSON la mayor cantidad posible de información de SIGPRO para
scripts y herramientas propias (automatizaciones, reportes). **Solo lectura**:
ningún endpoint modifica la BD, `display_config.json` ni la Capturadora.

## Arquitectura

- Blueprint nuevo `api` en `app/routes/api.py`, `url_prefix='/api/v1'`,
  registrado en `app/__init__.py`.
- Serializadores (`_guion(g)`, `_nota(t)`, `_graph(g)`, …) como funciones
  privadas en el mismo archivo. No se tocan las rutas `/api/*` existentes:
  las sigue usando el frontend sin token.
- Reutiliza lo que ya existe en vez de duplicarlo:
  - `grabacion._snapshot(guion_id, incluir_contexto=True, todas=...)` para el
    estado de grabación.
  - `graphs._resolver_mosca()` para la mosca.
  - Los globals `reloj.tiempo` / `reloj.cronometro_activo` (leídos bajo
    `reloj._lock`) para el cronómetro.
  - `display_config.json` se lee igual que `get_display_config` (ruta relativa
    al cwd), sin pasar por su caché.

## Autenticación

- `Config.API_TOKEN = os.environ.get('API_TOKEN', '')` en `config.example.py`
  (y cada `config.py` local).
- `before_request` del blueprint:
  - `API_TOKEN` vacío → `503 {"error": "API desactivada: falta API_TOKEN"}`.
  - Header `Authorization: Bearer <token>` ausente o distinto → `401`.
  - Comparación con `hmac.compare_digest`.
- No se registra en auditoría (es lectura).

## Convenciones

- Todas las respuestas son JSON. Errores: `{"error": "mensaje"}` con código
  404 (no existe), 400 (parámetro inválido), 401, 503, 502 (Capturadora caída).
  Un `errorhandler` del blueprint convierte 404/400/500 en JSON.
- Listados: `?limit=` (default 100, máx 1000) y `?offset=` (default 0).
  Respuesta `{"items": [...], "total": N, "limit": L, "offset": O}`.
- Fechas en ISO 8601.
- Orden de listados: guiones por `nombre` desc (como la UI actual), notas por
  `numero_de_nota`, auditoría por `timestamp` desc, resto por `id`.

## Endpoints (todos `GET`)

| Ruta | Parámetros | Devuelve |
|---|---|---|
| `/` | — | Índice: lista de rutas del blueprint con su descripción |
| `/guiones` | `q` (busca en nombre, ilike), paginación | `id, nombre, descripcion, cantidad_notas` |
| `/guiones/<id>` | — | Guión + `notas[]` resumidas (`id, numero_de_nota, titulo, duracion, activo, emitido, grabar, grabado, musica, cantidad_graphs`) |
| `/notas/<id>` | — | Nota completa: todos los campos de `Texto` (incluye `contenido`, `material`, `recording_id`, `archivo`) + `guion {id, nombre}` + `graphs[]` completos |
| `/graphs/<id>` | — | Graph completo (ver abajo) |
| `/entrevistados` | `q`, paginación | `id, nombre, cantidad_citas` |
| `/entrevistados/<id>` | — | Entrevistado + `citas[] {id, texto, graph_id}` |
| `/bajadas` | `q`, paginación | `id, texto` |
| `/plantillas` | — | `id, nombre, ancho, alto, cantidad_capas` |
| `/plantillas/<id>` | — | Plantilla + `capas[]` con todas las columnas de `PlantillaCapa` |
| `/en-vivo` | — | Estado del aire (ver abajo) |
| `/grabaciones` | `guion_id` (opcional) | Salida de `_snapshot(guion_id, todas=True)`: con `guion_id`, el estado de todas sus notas; sin él, solo equipo, tareas y `otras` |
| `/auditoria` | `desde`, `hasta` (ISO date/datetime), `nivel`, `entidad`, `ip`, `q` (en accion/nombre_entidad/detalle), paginación | Registros de `AuditLog` |
| `/opciones` | — | `{"musica": MUSICA_OPCIONES}` |

### Graph serializado

`id, texto_id, lugar, tema, activo, mostrar_lugar, mostrar_tema,
plantilla {id, nombre} | null, bajadas[] {id, texto}, bajada_activa_id,
entrevistados[] {id, nombre}, citas[] {id, texto, entrevistado_id},
cita_activa_id, bajadas_auto {activo, loop, duracion_segundos, epoch_inicio,
indice_inicio}`.

### `/en-vivo`

```json
{
  "nota_activa":  { ...nota resumida + guion {id, nombre} } | null,
  "graph_activo": { ...graph serializado } | null,
  "cronometro":   { "segundos": 125, "activo": true },
  "display":      { "live": {...}, "ticker": {...}, "marcador": {...},
                    "cronometro": {...}, "mosca": {"show": true, "capa": {...}|null},
                    "last_updated": "..." }
}
```

`nota_activa` = primer `Texto` con `activo=True`; `graph_activo` = primer
`Graph` con `activo=True`.

## Errores de dependencias

- Capturadora caída: `_snapshot` ya devuelve `ok: false` + `error`; se responde
  200 con eso tal cual (el script decide).
- `display_config.json` inexistente o inválido → `display: {}`.

## Documentación

`docs/api.md`: cómo configurar `API_TOKEN`, formato de respuestas y un ejemplo
`curl` por endpoint. Una línea en `CLAUDE.md` apuntando al blueprint y al doc.

## Pruebas

No hay suite de tests. Verificación manual con la app levantada y `curl`:
sin token (401), token incorrecto (401), `API_TOKEN` vacío (503), cada
endpoint con un id válido e inválido (404), paginación y filtros de auditoría.

## Fuera de alcance

Escritura, control en vivo, SSE/streaming, múltiples tokens o permisos por
endpoint, rate limiting.
