# Prompt — Generar api-design.md

Genera el documento `api-design.md` para el proyecto:

**Nombre:** {project.name}
**Stack:** {project.stack}
**Descripción:** {project.description}

## Contexto: documentos ya generados

### spec.md
```
{spec.content}
```

### data-model.md
```
{dataModel.content}
```

## Estructura requerida del documento

El documento debe incluir **todas** las siguientes secciones:

### 1. Convenciones generales
- Base URL, formato de respuesta, autenticación
- Manejo de errores estándar

### 2. Endpoints
Para cada endpoint (mínimo 3), documentar:

#### METHOD /path

**Descripción:** Qué hace el endpoint

**Request:**
```json
{
  "campo": "tipo"
}
```

**Response 2XX:**
```json
{
  "data": { ... }
}
```

**Errores:**
- `400 BAD_REQUEST` — descripción
- `401 UNAUTHORIZED` — No autenticado
- `404 NOT_FOUND` — Recurso no encontrado

### 3. Resumen de endpoints

| Método | Path | Descripción | Auth |
|--------|------|-------------|------|
| GET | /api/... | ... | Sí |

---

Genera el documento completo ahora. Responde únicamente con el contenido Markdown del documento api-design.md, sin preámbulos. Los endpoints deben cubrir todas las entidades definidas en el data model.
