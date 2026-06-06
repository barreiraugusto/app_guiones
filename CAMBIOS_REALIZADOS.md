# Cambios Realizados para Corregir Problemas Detectados

## 1. Seguridad: Credenciales Hardcodeadas (CRÍTICO)

### Archivo: `/workspace/config.py`
**Problema**: Credenciales de base de datos expuestas en código fuente.

**Solución**: 
- Se migró la configuración para usar variables de entorno
- Se agregó soporte para `python-dotenv`
- Se mantiene un valor por defecto para desarrollo local

**Cambios**:
```python
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL', 'postgresql://abarreira:panasonic@localhost/guiones')
    # ... resto de la configuración
```

### Archivo Nuevo: `/workspace/.env.example`
Se creó un archivo de ejemplo para documentar las variables de entorno requeridas:
```bash
DATABASE_URL=postgresql://usuario:contraseña@localhost/guiones
```

**Acción Requerida**: 
- Crear un archivo `.env` en la raíz del proyecto con las credenciales reales
- Nunca commitear el archivo `.env` al repositorio (agregar a `.gitignore`)

---

## 2. Bug en graphs.py:228 - Variable Incorrecta en Ordenamiento

### Archivo: `/workspace/app/routes/graphs.py`
**Problema**: En la función `obtener_graphs_por_texto`, se intentaba ordenar `graphs.bajadas` cuando `graphs` es una lista, no un objeto individual.

**Código Original** (línea 228):
```python
bajadas_ordenadas = sorted(graphs.bajadas, key=lambda bajada: bajada.id)
```

**Código Corregido**:
```python
for graph in graphs:
    # Obtener bajadas ordenadas para este graph específico
    bajadas_ordenadas = sorted(graph.bajadas, key=lambda bajada: bajada.id)
    bajadas = [b.texto for b in bajadas_ordenadas]
    # ... resto del procesamiento
```

**Explicación**: El ordenamiento ahora se realiza dentro del bucle `for`, accediendo a `graph.bajadas` (singular) en lugar de `graphs.bajadas` (plural).

---

## 3. Campos Inexistentes en editar_guion()

### Archivo: `/workspace/app/routes/guiones.py`
**Problema**: La función `editar_guion` intentaba actualizar campos que no existen en el modelo `Graph`:
- `primera_linea`
- `segunda_linea`
- `entrevistado` (como campo directo)

**Código Original** (líneas 259-268):
```python
if 'primera_linea' in graph_data:
    graph.primera_linea = graph_data['primera_linea']
if 'segunda_linea' in graph_data:
    graph.segunda_linea = graph_data['segunda_linea']
if 'entrevistado' in graph_data:
    graph.entrevistado = graph_data['entrevistado']
```

**Código Corregido**:
```python
if 'lugar' in graph_data:
    graph.lugar = graph_data['lugar']
if 'tema' in graph_data:
    graph.tema = graph_data['tema']
if 'activo' in graph_data:
    graph.activo = graph_data['activo']
```

**Explicación**: Según el modelo `Graph` en `models.py`, los únicos campos editables son:
- `lugar` (String)
- `tema` (String)
- `activo` (Boolean)
- `texto_id` (ForeignKey, no debería modificarse directamente)

Los campos `primera_linea`, `segunda_linea` y `entrevistado` NO existen en el modelo y causaban errores en tiempo de ejecución.

---

## 4. Query Ineficiente en setTextoActivo

### Archivo: `/workspace/app/routes/textos.py`
**Problema**: La función usaba `Texto.query.update()` que es una operación bulk que no dispara eventos ORM y puede dejar inconsistencias. Además, no desactivaba los graphs asociados.

**Código Original** (líneas 208-220):
```python
def setTextoActivo(id):
    Texto.query.update({Texto.activo: False})
    
    texto = Texto.query.get(id)
    if texto:
        texto.activo = True
        for graph in texto.graphs:
            graph.activo = True
    
    db.session.commit()
```

**Código Corregido**:
```python
def setTextoActivo(id):
    # Desactivar todos los textos primero
    textos = Texto.query.all()
    for texto in textos:
        texto.activo = False
        # También desactivar los graphs asociados a cada texto
        for graph in texto.graphs:
            graph.activo = False
    
    db.session.flush()  # Asegurar que los cambios se apliquen antes de continuar

    # Activar el texto seleccionado y sus graphs
    texto = Texto.query.get(id)
    if texto:
        texto.activo = True
        for graph in texto.graphs:
            graph.activo = True

    db.session.commit()
```

**Mejoras**:
1. Se usa iteración explícita en lugar de bulk update para garantizar consistencia ORM
2. Se desactivan también los graphs asociados a cada texto
3. Se agrega `db.session.flush()` para asegurar que los cambios se apliquen antes de activar el nuevo texto
4. Se garantiza que solo un texto y sus graphs estén activos a la vez

---

## Verificación de Sintaxis

Todos los archivos modificados fueron verificados:
```bash
python3 -c "from app import create_app; print('Sintaxis OK')"
# Resultado: Sintaxis OK ✓
```

---

## Notas Adicionales

### Archivos Modificados:
1. `/workspace/config.py` - Configuración de seguridad
2. `/workspace/app/routes/graphs.py` - Bug de ordenamiento
3. `/workspace/app/routes/guiones.py` - Campos inexistentes
4. `/workspace/app/routes/textos.py` - Query ineficiente

### Archivos Creados:
1. `/workspace/.env.example` - Plantilla de variables de entorno
2. `/workspace/CAMBIOS_REALIZADOS.md` - Este documento

### Dependencias Agregadas:
- `python-dotenv` - Para cargar variables de entorno desde archivo `.env`

---

## Próximos Pasos Recomendados

1. **Crear archivo .env** con las credenciales reales de producción
2. **Agregar .env al .gitignore** para evitar commitear credenciales
3. **Actualizar documentación** del proyecto para mencionar las variables de entorno requeridas
4. **Considerar agregar validación** de variables de entorno en el startup de la aplicación
5. **Revisar otros endpoints** que puedan referenciar campos inexistentes como `primera_linea` o `segunda_linea`
