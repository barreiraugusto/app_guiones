# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Comandos

- Ejecutar la app: `python run.py` (Flask dev server en `0.0.0.0:5000`).
- Migraciones (Flask-Migrate/Alembic): `flask db migrate -m "mensaje"` y `flask db upgrade`. Migraciones en `migrations/versions/`.
- No hay `requirements.txt`; instalar deps según README.md (Flask 3.1.0, Flask-SQLAlchemy 3.1.1, Flask-Migrate 4.0.7, WeasyPrint, psycopg2-binary). Hay dos carpetas de venv en el repo (`.venv` y `.env`, ambas gitignored); `.env` es la que tiene las dependencias instaladas.
- No hay suite de tests ni linter configurado.

## Arquitectura

App factory Flask en `app/__init__.py`. Blueprints: `main`, `guiones`, `textos`, `graphs`, `reloj`, `sobreimpresos` (prefix `/sobreimpresos`), `auditoria`, `plantillas`.

Modelo de datos (`app/models.py`):
```
Guion → Texto (notas) → Graph (gráfico por nota)
                          ├── Bajada[] (lower-thirds, M:N vía graph_bajada)
                          ├── Entrevistado[] (M:N vía graph_entrevistado) → Cita[]
                          └── Plantilla → PlantillaCapa[] (capas: imagen/video/texto/forma)
```
- `Graph.bajada_activa_id`/`cita_activa_id` fijan qué bajada/cita se muestra; `bajadas_auto_*` controla la rotación automática (temporizador basado en `bajadas_auto_epoch_inicio`).
- `PlantillaCapa` es el sistema de plantillas gráficas: cada capa tiene posición, animación de entrada/salida, y `campo_dato` (bindea la capa a lugar/tema/entrevistado/bajada_N) o `texto_fijo`; puede estar `controlada_por` otra capa (visibilidad condicional). `es_mosca` marca la capa de logo, controlada aparte desde `control_live` (independiente del graph activo).
- `AuditLog` registra acciones (INFO/WARNING/DANGER) vía `app/audit.py::registrar()`, llamado desde las rutas de escritura.

Tiempo real: sin websockets, todo por Server-Sent Events (endpoints `/stream_*` en `textos.py`, `graphs.py`, `reloj.py`) consumidos con `EventSource` en el cliente. En producción con Gunicorn hace falta worker `gevent`/`eventlet` (sticky sessions si no).

Vistas por rol (piso de producción):
- `principal.html`/`guion.html` — redacción del guión.
- `ver_guion.html` — emisión: activar nota / marcar emitido en vivo.
- `siguiente.html` — monitor de "próxima nota" para el piso.
- `control_live.html` + `control_live.js` (~1800 líneas) — control central: activar gráficos, paneles de propiedades por widget (Cronómetro, Marcador, Ticker, Vivo). Decisiones de diseño documentadas en `docs/superpowers/specs/`.
- `pantalla.html`/`pantalla.js` — output real que renderiza las capas de la plantilla activa, incluye overlays de video WebM con canal alfa (ver `docs/videos-capas-plantillas.md` para el formato requerido).
- `plantillas.html`/`plantillas.js` — editor visual de plantillas gráficas (capas, animaciones, colores, gradientes).

`display_config.json` (cargado/guardado por `app/config_manager.py`) guarda posición de badges/overlays; es config, no dato de negocio en la BD.

`docs/superpowers/` tiene specs y planes de features ya implementadas — útil como historial de decisiones, no como trabajo pendiente.

README.md documenta instalación y API REST en detalle, pero está desactualizado: no menciona los blueprints/modelos `plantillas` y `auditoria`, agregados después.

---

# Reglas para Claude Code — Ahorra Tokens

## 1. No programar sin contexto
- ANTES de escribir codigo: lee los archivos relevantes, revisa git log, entiende la arquitectura.
- Si no tienes contexto suficiente, pregunta. No asumas.

## 2. Respuestas cortas
- Responde en 1-3 oraciones. Sin preambulos, sin resumen final.
- No repitas lo que el usuario dijo. No expliques lo obvio.
- Codigo habla por si mismo: no narres cada linea que escribes.

## 3. No reescribir archivos completos
- Usa Edit (reemplazo parcial), NUNCA Write para archivos existentes salvo que el cambio sea >80% del archivo.
- Cambia solo lo necesario. No "limpies" codigo alrededor del cambio.

## 4. No releer archivos ya leidos
- Si ya leiste un archivo en esta conversacion, no lo vuelvas a leer salvo que haya cambiado.
- Toma notas mentales de lo importante en tu primera lectura.

## 5. Validar antes de declarar hecho
- Despues de un cambio: compila, corre tests, o verifica que funciona.
- Nunca digas "listo" sin evidencia de que funciona.

## 6. Cero charla aduladora
- No digas "Excelente pregunta", "Gran idea", "Perfecto", etc.
- No halagues al usuario. Ve directo al trabajo.

## 7. Soluciones simples
- Implementa lo minimo que resuelve el problema. Nada mas.
- No agregues abstracciones, helpers, tipos, validaciones, ni features que no se pidieron.
- 3 lineas repetidas > 1 abstraccion prematura.

## 8. No pelear con el usuario
- Si el usuario dice "hazlo asi", hazlo asi. No debatas salvo riesgo real de seguridad o perdida de datos.
- Si discrepas, menciona tu concern en 1 oracion y procede con lo que pidio.

## 9. Leer solo lo necesario
- No leas archivos completos si solo necesitas una seccion. Usa offset y limit.
- Si sabes la ruta exacta, usa Read directo. No hagas Glob + Grep + Read cuando Read basta.

## 10. No narrar el plan antes de ejecutar
- No digas "Voy a leer el archivo, luego modificar la funcion, luego compilar...". Solo hazlo.
- El usuario ve tus tool calls. No necesita un preview en texto.

## 11. Paralelizar tool calls
- Si necesitas leer 3 archivos independientes, lee los 3 en un solo mensaje, no uno por uno.
- Menos roundtrips = menos tokens de contexto acumulado.

## 12. No duplicar codigo en la respuesta
- Si ya editaste un archivo, no copies el resultado en tu respuesta. El usuario lo ve en el diff.
- Si creaste un archivo, no lo muestres entero en texto tambien.

## 13. No usar Agent cuando Grep/Read basta
- Agent duplica todo el contexto en un subproceso. Solo usalo para busquedas amplias o tareas complejas.
- Para buscar una funcion o archivo especifico, usa Grep o Glob directo.
