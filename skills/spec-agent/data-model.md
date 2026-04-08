# Prompt — Generar data-model.md

Genera el documento `data-model.md` para el proyecto:

**Nombre:** {project.name}
**Stack:** {project.stack}
**Descripción:** {project.description}

## Contexto: spec.md generado

A continuación está el spec.md ya generado para este proyecto. El modelo de datos debe ser coherente con los requerimientos funcionales e historias de usuario descritos:

```
{spec.content}
```

## Estructura requerida del documento

El documento debe incluir **todas** las siguientes secciones:

### 1. Entidades
Para cada entidad principal del sistema, documentar:

**Tabla: nombre_tabla** (mínimo 2 tablas)

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| id | uuid | No | gen_random_uuid() | PK |
| ... | ... | ... | ... | ... |

### 2. Relaciones
Diagrama o descripción de relaciones entre entidades con claves foráneas (FK).

Ejemplo:
- `orders.user_id` → FK → `users.id` (N:1)

### 3. Índices
Lista de índices recomendados para rendimiento y unicidad.

Ejemplo:
- `users.email` — UNIQUE
- `orders.created_at` — INDEX (para filtros por fecha)

### 4. Notas de implementación
Consideraciones especiales: soft delete, auditoría, particionamiento, full-text search, etc.

---

Genera el documento completo ahora. Responde únicamente con el contenido Markdown del documento data-model.md, sin preámbulos.
