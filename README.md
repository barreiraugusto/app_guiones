# SIGPRO — Sistema de Gestión de Producción

> Plataforma web de gestión de guiones para televisión con control en tiempo real de notas, gráficos y transmisión en vivo.

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat-square&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.1.0-000000?style=flat-square&logo=flask&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?style=flat-square&logo=postgresql&logoColor=white)
![Bootstrap](https://img.shields.io/badge/Bootstrap-4.1.3-7952B3?style=flat-square&logo=bootstrap&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=flat-square)

---

## Descripción

**SIGPRO** es un sistema integral para la producción de noticieros de televisión. Permite gestionar guiones completos con sus notas, gráficos de pantalla y estados de emisión en tiempo real, desde la redacción hasta el control central.

Diseñado para funcionar en red local de una emisora, múltiples operadores pueden trabajar simultáneamente: el editor arma el guión, el operador de cámara ve la próxima nota, y el controlista activa gráficos — todo sincronizado vía **Server-Sent Events (SSE)**.

---

## Características principales

- **Gestión de guiones** — Crear, editar y eliminar guiones con múltiples notas ordenadas
- **Control de notas en tiempo real** — Activar/marcar como emitido con actualización instantánea en todos los clientes conectados
- **Gráficos y sobreimpresos** — Gestión completa de lower-thirds con lugar, tema, bajadas y entrevistados con citas
- **Próxima nota** — Vista dedicada para monitor de estudio (número de nota grande, contenido y gráficos)
- **Exportación a PDF** — Generación de guiones impresos con WeasyPrint
- **Cronómetro integrado** — Control de tiempos de emisión por nota y total del guión
- **Clonación de notas** — Reutilización de contenido entre guiones
- **Responsive** — Optimizado para tabletas y celulares en el piso de grabación

---

## Tecnologías

| Capa | Tecnología |
|------|-----------|
| Backend | Flask 3.1.0, Flask-SQLAlchemy 3.1.1, Flask-Migrate 4.0.7 |
| Base de datos | PostgreSQL 15+ |
| ORM | SQLAlchemy 2.0 |
| Frontend | Bootstrap 4.1.3, Vanilla JS (ES6+) |
| Tiempo real | Server-Sent Events (SSE) |
| PDF | WeasyPrint |
| Plantillas | Jinja2 3.1 |

---

## Estructura del proyecto

```
app_guiones/
├── app/
│   ├── __init__.py              # App factory y configuración de blueprints
│   ├── models.py                # Modelos SQLAlchemy (Guion, Texto, Graph, etc.)
│   ├── config_manager.py        # Gestión de configuración de display (JSON)
│   ├── display_config.json      # Posiciones y configuración de overlays
│   ├── routes/
│   │   ├── main.py              # Rutas principales (index, pantalla, principal)
│   │   ├── guiones.py           # CRUD de guiones, exportación PDF, clonación
│   │   ├── textos.py            # CRUD de notas, streams SSE
│   │   ├── graphs.py            # CRUD de gráficos, generación XML, streams SSE
│   │   ├── reloj.py             # Cronómetro (iniciar/detener/restablecer)
│   │   └── sobre.py             # Sobreimpresos
│   ├── static/
│   │   ├── css/sigpro.css       # Estilos globales del sistema
│   │   └── js/                  # JavaScript por módulo
│   └── templates/               # Plantillas Jinja2
├── migrations/                  # Migraciones de base de datos (Flask-Migrate)
├── config.py                    # Configuración de conexión a BD
├── run.py                       # Punto de entrada
└── crear_secciones_definitivo.py # Script de inicialización de secciones
```

---

## Modelos de datos

```
Guion
  └── Texto (notas del guión)
        └── Graph (gráficos/overlays)
              ├── Bajada[] (lower-thirds, relación M:N)
              └── Cita[]
                    └── Entrevistado (relación M:N con Graph)
```

| Modelo | Descripción |
|--------|-------------|
| `Guion` | Guión de emisión (nombre, descripción) |
| `Texto` | Nota individual (título, contenido, duración, música, flags activo/emitido/grabar) |
| `Graph` | Gráfico de pantalla (lugar, tema, estado activo) |
| `Bajada` | Texto inferior del gráfico (lower-third) |
| `Entrevistado` | Persona entrevistada |
| `Cita` | Frase o dato atribuido a un entrevistado en un gráfico |

---

## Instalación

### Requisitos previos

- Python 3.10+
- PostgreSQL 15+
- Dependencias del sistema para WeasyPrint:

```bash
# Ubuntu/Debian
sudo apt-get install libffi-dev libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
  libgdk-pixbuf2.0-0 libxml2 libxslt1.1 shared-mime-info
```

### Pasos de instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/app-guiones.git
cd app-guiones

# 2. Crear y activar entorno virtual
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
# .venv\Scripts\activate         # Windows

# 3. Instalar dependencias
pip install Flask==3.1.0 \
            Flask-SQLAlchemy==3.1.1 \
            Flask-Migrate==4.0.7 \
            SQLAlchemy==2.0.36 \
            WeasyPrint \
            psycopg2-binary

# 4. Configurar base de datos (ver sección Configuración)

# 5. Inicializar esquema
flask db upgrade

# 6. Ejecutar la aplicación
python run.py
```

La aplicación quedará disponible en `http://localhost:5000`.

---

## Configuración

### Base de datos

Editar `config.py` con los datos de conexión a PostgreSQL:

```python
class Config:
    SQLALCHEMY_DATABASE_URI = 'postgresql://USUARIO:PASSWORD@HOST/NOMBRE_BD'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': 5,
        'max_overflow': 10,
        'pool_pre_ping': True,
        'pool_recycle': 3600,
    }
```

Crear la base de datos en PostgreSQL:

```sql
CREATE DATABASE guiones;
CREATE USER mi_usuario WITH PASSWORD 'mi_password';
GRANT ALL PRIVILEGES ON DATABASE guiones TO mi_usuario;
```

### Variables de entorno (recomendado para producción)

Se recomienda no hardcodear las credenciales. Usar variables de entorno:

```bash
export DATABASE_URL="postgresql://usuario:password@localhost/guiones"
export FLASK_SECRET_KEY="clave-secreta-aleatoria"
```

Y adaptar `config.py`:

```python
import os

class Config:
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'postgresql://localhost/guiones')
    SECRET_KEY = os.environ.get('FLASK_SECRET_KEY', 'dev-key')
```

---

## Uso

### Flujo de trabajo típico

```
1. Redacción (principal.html)
   └── Crear/editar guión con sus notas y gráficos

2. Emisión (ver_guion.html)
   ├── Activar nota → se actualiza en tiempo real en todos los clientes
   └── Marcar como emitido → resaltado visual de progreso

3. Control central (siguiente.html)
   └── Monitor dedicado que muestra la nota activa con número grande,
       contenido y gráficos en tiempo real

4. Control de gráficos (control_graphs.html)
   └── Activar gráficos individuales, generar XML para automatización
```

### Endpoints SSE (tiempo real)

| Endpoint | Intervalo | Descripción |
|----------|-----------|-------------|
| `/stream_texto_activo` | 1s | Nota activa completa (para monitor de estudio) |
| `/stream_guion/<id>` | 2s | Todas las notas del guión con contenido y estados |
| `/stream_textos` | 10s | Todas las notas de todos los guiones |
| `/stream_graphs` | 1s | Gráfico activo con configuración de display |
| `/stream_display_config` | 0.5s | Config de posición de badges de transmisión |
| `/stream` | 1s | Estado del cronómetro |

### Exportación

- **PDF** — `GET /exportar_pdf/<id>` — Genera guión imprimible con WeasyPrint
- **Texto plano** — Disponible desde la vista `ver_guion` (botón "Texto")
- **XML de gráficos** — `PUT /generar_xml` — Genera archivos XML para sistemas de automatización de broadcast

---

## API REST (principales endpoints)

### Guiones

```
GET    /guiones                     → Listar todos los guiones
POST   /guiones                     → Crear guión
GET    /guiones/<id>                → Guión completo con notas y gráficos
PUT    /guiones/<id>                → Actualizar guión
DELETE /guiones/<id>                → Eliminar guión
POST   /guiones/clonar_notas/<o>/<d> → Clonar notas entre guiones
```

### Notas

```
GET    /textos                      → Listar todas las notas
POST   /textos                      → Crear nota (con auto-renumeración)
PUT    /textos/editar/<id>          → Editar nota
DELETE /textos/borrar/<id>          → Eliminar nota (con reordenamiento)
PUT    /textos/activo/<id>          → Activar nota
PUT    /textos/emitido/<id>         → Marcar como emitido (toggle)
PUT    /textos/actualizar-orden     → Reordenar notas en lote
```

### Gráficos

```
POST   /graphs                      → Crear gráfico con bajadas y entrevistados
GET    /graphs/<id>                 → Obtener gráfico
PUT    /graphs/<id>                 → Actualizar gráfico
DELETE /graphs/<id>                 → Eliminar gráfico
PUT    /graphs/activo/<id>          → Activar gráfico
GET    /obtener_graph_activo        → Obtener gráfico actualmente activo
PUT    /generar_xml                 → Generar XML de automatización
```

### Cronómetro

```
GET    /iniciar                     → Iniciar cronómetro
GET    /detener                     → Detener cronómetro
GET    /restablecer                 → Reiniciar a cero
GET    /stream                      → SSE con valor actual cada 1s
```

---

## Despliegue en producción

### Con Gunicorn

```bash
pip install gunicorn

gunicorn --workers 4 \
         --worker-class gevent \
         --bind 0.0.0.0:5000 \
         --timeout 120 \
         "app:create_app()"
```

> **Importante:** Para que los streams SSE funcionen correctamente con múltiples workers, usar un worker asíncrono (`gevent` o `eventlet`) o configurar sticky sessions en el balanceador de carga.

### Con systemd (Linux)

```ini
[Unit]
Description=SIGPRO - Sistema de Gestión de Producción
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/opt/app_guiones
ExecStart=/opt/app_guiones/.venv/bin/gunicorn --workers 2 --bind 0.0.0.0:5000 "app:create_app()"
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Requisitos del sistema

| Componente | Mínimo | Recomendado |
|-----------|--------|-------------|
| CPU | 1 core | 2+ cores |
| RAM | 512 MB | 1 GB |
| Almacenamiento | 500 MB | 2 GB |
| Red | LAN 100 Mbps | LAN 1 Gbps |
| OS | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

---

## Licencia

Este proyecto está bajo la licencia [MIT](LICENSE).

---

## Autor

Desarrollado para uso en producción televisiva.  
Contribuciones y reportes de bugs son bienvenidos vía [Issues](../../issues).
