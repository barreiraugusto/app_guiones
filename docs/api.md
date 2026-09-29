# API de lectura `/api/v1`

Solo lectura, JSON, para scripts propios. Código en `app/routes/api.py`.

## Activarla

Definir `API_TOKEN` (en `config.py` o por variable de entorno; en el server de
aire, en el `environment=` del programa en Supervisor). Vacío = API
desactivada (503). Generar uno con:

    python -c "import secrets; print(secrets.token_urlsafe(32))"

Cada pedido lleva el header `Authorization: Bearer <token>`; si falta o no
coincide, 401.

## Formato

- Errores: `{"error": "mensaje"}` con 400, 401, 404, 405, 500 o 503.
- Listados paginados: `?limit=` (100 por defecto, máximo 1000) y `?offset=`.
  Responden `{"items": [...], "total": N, "limit": L, "offset": O}`.
- Fechas en ISO 8601.

## Endpoints

    export T=<token>; export API=http://localhost:5000/api/v1
    alias api='curl -s -H "Authorization: Bearer $T"'

| Endpoint | Ejemplo |
|---|---|
| Índice de rutas | `api $API/` |
| Guiones (`q`, paginado) | `api "$API/guiones?q=noticiero&limit=10"` |
| Guion con sus notas | `api $API/guiones/3` |
| Nota completa (graphs, bajadas, entrevistados, citas) | `api $API/notas/42` |
| Graph | `api $API/graphs/17` |
| Entrevistados (`q`, paginado) | `api "$API/entrevistados?q=perez"` |
| Entrevistado con sus citas | `api $API/entrevistados/5` |
| Bajadas (`q`, paginado) | `api "$API/bajadas?q=ruta"` |
| Plantillas | `api $API/plantillas` |
| Plantilla con capas | `api $API/plantillas/2` |
| Estado del aire: nota y graph activos, cronómetro, widgets | `api $API/en-vivo` |
| Grabaciones (Capturadora) | `api "$API/grabaciones?guion_id=3"` |
| Auditoría (`desde`, `hasta`, `nivel`, `entidad`, `ip`, `q`, paginado) | `api "$API/auditoria?desde=2026-09-01&hasta=2026-09-29&nivel=DANGER"` |
| Opciones fijas (música) | `api $API/opciones` |

Notas:
- `hasta` con solo fecha (`2026-09-29`) incluye todo ese día. Las fechas son
  hora local del server, sin zona; si se manda una zona (`-03:00`, `Z`) se
  ignora.
- `/grabaciones` con la Capturadora caída responde 200 con `"ok": false` y el
  error; sin `guion_id` trae solo el equipo, las tareas y las grabaciones
  ajenas al guion (`otras`).
- `/en-vivo` → `display` es el contenido de `display_config.json` con la mosca
  resuelta a su capa; `{}` si el archivo no existe.
