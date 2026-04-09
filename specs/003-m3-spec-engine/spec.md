# SPEC — M3: Spec Engine

# Sophia Platform

# Versión: 1.3 | Sprint: 2

---

## Descripción

Motor de generación de specs usando IA. Convierte la descripción en lenguaje natural del usuario en un spec técnico completo: requerimientos funcionales/no funcionales, data model y diseño de API. M3 usa Anthropic SDK directamente — no depende del orquestador de agentes (M4).

---

## Stack

- Backend: Node.js 22 + Fastify + Anthropic SDK (streaming)
- Frontend: Next.js 15 + `@uiw/react-md-editor` (editor markdown ligero)
- DB: PostgreSQL 16 (tabla `project_specs` definida en M2)
- Cache: Redis 7 (rate limiting de generaciones)

---

## Dependencias

- **M1**: Auth — usuario autenticado para generar specs
- **M2**: Projects — proyecto creado, tabla `project_specs` existe

---

## Historias de Usuario

### HU-11 — Generar spec automáticamente

**Como** usuario
**Quiero** que Sophia genere el spec completo del proyecto
**Para** no escribir documentación técnica manualmente

**Criterios de aceptación:**

- [x] Al hacer clic en "Generar Spec" en el proyecto → inicia generación
- [x] Solo se puede generar si el proyecto está en estado `idle`
- [x] Sophia genera 3 documentos en secuencia (3 llamadas independientes a Claude):
  1. `spec.md` — requerimientos funcionales, NFR, historias de usuario
  2. `data-model.md` — entidades, campos, tipos, índices, relaciones
  3. `api-design.md` — endpoints REST con request/response schemas
- [x] El usuario ve el progreso en tiempo real (SSE streaming por documento)
- [x] Si la descripción del proyecto es menor de 20 chars → error 422
- [x] Timeout de 90 segundos por documento — si se excede, guarda lo parcial y reporta error
- [x] Si Claude falla → retry automático hasta 3 veces, luego error al usuario (ver C3 para detalle por tipo de error Anthropic)
- [x] El output de cada documento se valida contra un schema de secciones obligatorias
- [x] El spec se guarda en `project_specs` con version incremental
- [x] Rate limit aplicado (ver NFRs Específicos de M3)

**Flujo de generación:**

```
POST /api/projects/:id/spec/generate
  → Valida proyecto (existe, es del usuario, estado idle)
  → Crea job de generación, devuelve { jobId }
  → El job hace 3 llamadas secuenciales a Claude:
      1. spec.md (prompt de requerimientos)
      2. data-model.md (prompt de modelo, recibe spec.md como contexto)
      3. api-design.md (prompt de API, recibe spec.md + data-model.md como contexto)
  → Cada documento se valida al completarse
  → Se guarda en project_specs como nuevo version

GET /api/projects/:id/spec/stream?jobId=xxx
  → SSE stream del progreso de generación
```

---

### HU-12 — Ver y editar spec generado

**Como** usuario
**Quiero** revisar y editar el spec antes de ejecutar
**Para** ajustar detalles antes de generar el código

**Criterios de aceptación:**

- [x] El spec se muestra en formato Markdown renderizado (tab "Spec" del proyecto)
- [x] 3 sub-tabs: spec.md | data-model.md | api-design.md
- [x] Botón "Editar" → abre editor markdown con preview al lado
- [x] El usuario puede modificar cualquiera de los 3 documentos
- [x] Botón "Guardar cambios" → crea nueva versión en `project_specs` (no sobreescribe)
- [x] Botón "Regenerar" → regenera desde la descripción original
- [x] Modal de confirmación antes de regenerar ("Se creará una nueva versión, la actual se conserva")
- [x] Dropdown para ver versiones anteriores del spec

---

### HU-13 — Templates predefinidos

**Como** usuario
**Quiero** usar un template como base para mi proyecto
**Para** acelerar la creación

**Criterios de aceptación:**

- [x] Galería de templates en la página de crear proyecto
- [x] 5 templates del sistema (seed data, no editables). Cada template usa un ícono Lucide React:
  - `<Building2 />` ERP Módulo — módulo empresarial con CRUD, reportes, roles
  - `<Rocket />` SaaS Starter — multi-tenant con billing, auth, dashboard
  - `<Plug />` REST API — API backend pura con auth, CRUD, docs
  - `<Monitor />` Landing + Admin — landing page con panel administrativo
  - `<BookOpen />` EdTech — plataforma educativa con cursos, estudiantes, progreso
- [x] Al seleccionar template → pre-llena nombre, descripción, stack y agentes en el formulario de crear proyecto
- [x] El usuario puede modificar los valores antes de crear
- [x] Los templates no generan spec automáticamente — solo pre-llenan el formulario

> **Fuera de MVP**: CRUD de templates personalizados y guardar proyecto existente como template.

---

## Endpoints API

```
POST /api/projects/:id/spec/generate   → Iniciar generación (devuelve jobId)
GET  /api/projects/:id/spec/stream     → SSE stream del progreso (?jobId=xxx)
GET  /api/projects/:id/spec            → Leer spec actual (última versión)
GET  /api/projects/:id/spec/versions   → Listar versiones del spec
GET  /api/projects/:id/spec/:version   → Leer versión específica del spec

### GET /api/projects/:id/spec/:version

```json
// Response 200
{
  "data": {
    "version": 1,
    "files": {
      "spec": "# Spec: Módulo Contabilidad\n\n...",
      "dataModel": "# Data Model\n\n...",
      "apiDesign": "# API Design\n\n..."
    },
    "source": "generated",
    "valid": true,
    "createdAt": "2026-04-07T12:00:00Z"
  }
}

// Response 404
{ "error": "VERSION_NOT_FOUND", "message": "Versión no encontrada" }
```

PUT  /api/projects/:id/spec            → Guardar edición manual (crea nueva versión)
GET  /api/templates                    → Listar templates del sistema
```

### POST /api/projects/:id/spec/generate

```json
// Request — sin body, usa la descripción del proyecto

// Response 202 (accepted)
{
  "data": {
    "jobId": "uuid",
    "message": "Generación iniciada"
  }
}

// Response 400
{ "error": "INVALID_STATE", "message": "Solo se puede generar spec de un proyecto en estado 'idle'" }

// Response 422
{ "error": "DESCRIPTION_TOO_SHORT", "message": "La descripción debe tener al menos 20 caracteres" }

// Response 429
{ "error": "GENERATION_LIMIT", "message": "Máximo 10 generaciones por hora", "retryAfter": 3600 }
```

### GET /api/projects/:id/spec/stream

```
// Query: ?jobId=uuid
// Headers: Accept: text/event-stream
// Response: Server-Sent Events

// Eventos:
data: {"type":"start","file":"spec.md","step":1,"totalSteps":3}
data: {"type":"chunk","file":"spec.md","content":"# Spec: Módulo Contabilidad\n\n## 1. Descripción..."}
data: {"type":"validated","file":"spec.md","valid":true}
data: {"type":"start","file":"data-model.md","step":2,"totalSteps":3}
data: {"type":"chunk","file":"data-model.md","content":"# Data Model\n\n## users..."}
data: {"type":"validated","file":"data-model.md","valid":true}
data: {"type":"start","file":"api-design.md","step":3,"totalSteps":3}
data: {"type":"chunk","file":"api-design.md","content":"# API Design\n\n## Auth..."}
data: {"type":"validated","file":"api-design.md","valid":true}
data: {"type":"done","version":2,"files":["spec.md","data-model.md","api-design.md"]}

// Error:
data: {"type":"error","file":"data-model.md","message":"Timeout después de 90s","retryable":true}
```

### GET /api/projects/:id/spec

```json
// Response 200
{
  "data": {
    "version": 2,
    "files": {
      "spec": "# Spec: Módulo Contabilidad\n\n...",
      "dataModel": "# Data Model\n\n...",
      "apiDesign": "# API Design\n\n..."
    },
    "source": "generated",
    "valid": true,
    "createdAt": "2026-04-07T12:00:00Z"
  }
}

// Response 404
{ "error": "NO_SPEC", "message": "Este proyecto no tiene spec generado" }
```

### GET /api/projects/:id/spec/versions

```json
// Response 200
{
  "data": [
    { "version": 2, "createdAt": "2026-04-07T14:00:00Z", "source": "manual" },
    { "version": 1, "createdAt": "2026-04-07T12:00:00Z", "source": "generated" }
  ]
}
```

### PUT /api/projects/:id/spec

```json
// Request
{
  "files": {
    "spec": "# Spec actualizado...",
    "dataModel": "# Data Model actualizado...",
    "apiDesign": "# API actualizado..."
  }
}

// Response 200
{
  "data": {
    "version": 3,
    "source": "manual",
    "createdAt": "2026-04-07T15:00:00Z"
  }
}
```

### GET /api/templates

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "name": "ERP Módulo",
      "description": "Módulo completo para sistema ERP con CRUD, reportes y roles de usuario",
      "icon": "Building2",
      "stack": "laravel-nextjs",
      "tags": ["Laravel", "Next.js", "PostgreSQL", "Multi-role"],
      "defaults": {
        "agents": ["dba", "seed", "backend", "frontend", "qa", "security", "docs", "deploy", "integration"],
        "model": "claude-sonnet-4-6"
      }
    }
  ]
}
```

---

## Validación del Output

Cada documento generado se valida contra un schema de secciones obligatorias:

### spec.md — secciones requeridas:

```
- Descripción General (>100 chars)
- Requerimientos Funcionales (al menos 3 RF-XX numerados)
- Requerimientos No Funcionales (al menos 2 RNF-XX)
- Historias de Usuario (al menos 2 HU con Como/Quiero/Para)
- Criterios de aceptación (checkboxes en cada HU)
```

### data-model.md — secciones requeridas:

```
- Al menos 2 entidades con tablas
- Cada tabla tiene: Campo, Tipo, Nullable, Descripción
- Relaciones documentadas (FK)
- Índices definidos
```

### api-design.md — secciones requeridas:

```
- Al menos 3 endpoints
- Cada endpoint tiene: método, path, request schema, response schema
- Códigos de error documentados
```

Si la validación falla → retry automático con prompt corregido (max 3 intentos). Si 3 fallan → guardar lo generado con flag `valid: false` y notificar al usuario.

---

## Prompts

Los prompts viven en archivos separados, no inline:

```
skills/
├── spec-agent/
│   ├── system.md          → System prompt del agente de specs
│   ├── spec.md            → Prompt para generar spec.md
│   ├── data-model.md      → Prompt para generar data-model.md
│   └── api-design.md      → Prompt para generar api-design.md
```

### Variables disponibles en prompts:

```
{project.name}        → Nombre del proyecto
{project.description} → Descripción en lenguaje natural
{project.stack}       → Stack seleccionado
{project.config}      → Configuración de agentes
{spec.content}        → Contenido de spec.md (para data-model y api-design)
{dataModel.content}   → Contenido de data-model.md (para api-design)
```

> Los prompts exactos se definen en los archivos de skills, no en este spec. Este spec define la estructura, no el contenido de los prompts.

---

## Data Model

### project_specs (definida en M2, referencia)

| Campo      | Tipo        | Nullable | Default           | Descripción                           |
| ---------- | ----------- | -------- | ----------------- | ------------------------------------- |
| id         | uuid        | No       | gen_random_uuid() | PK                                    |
| project_id | uuid        | No       | —                 | FK → projects                         |
| version    | integer     | No       | 1                 | Versión auto-incremental por proyecto |
| content    | jsonb       | No       | —                 | `{ spec, dataModel, apiDesign }`      |
| source     | varchar(20) | No       | generated         | `generated` o `manual`                |
| valid      | boolean     | No       | true              | Pasó validación de secciones          |
| created_at | timestamptz | No       | now()             | —                                     |

**Content JSONB schema:**

```ts
{
  spec: string,       // Markdown de spec.md
  dataModel: string,  // Markdown de data-model.md
  apiDesign: string   // Markdown de api-design.md
}
```

### templates (seed data)

| Campo       | Tipo         | Nullable | Default           | Descripción                |
| ----------- | ------------ | -------- | ----------------- | -------------------------- |
| id          | uuid         | No       | gen_random_uuid() | PK                         |
| name        | varchar(255) | No       | —                 | Nombre del template        |
| description | text         | No       | —                 | Descripción                |
| icon        | varchar(50)  | No       | —                 | Nombre componente Lucide React |
| stack       | varchar(50)  | No       | —                 | Stack predeterminado       |
| tags        | text[]       | No       | —                 | Tags para filtro           |
| defaults    | jsonb        | No       | —                 | `{ agents, model }` |
| created_at  | timestamptz  | No       | now()             | —                          |

> **Nota**: Tabla de solo lectura en MVP. Se pobla con seed de Prisma. No hay `user_id` ni CRUD de usuario.

---

## Clarificaciones (speckit.clarify)

Las siguientes decisiones fueron tomadas durante la fase de clarificación:

### C1 — Generación parcial (fallo en un documento)

**Pregunta**: Si `spec.md` se genera OK pero `data-model.md` falla tras 3 retries, ¿qué hacer?

**Decisión**: **Guardar parcial con `valid: false`**. Se guarda lo que se generó correctamente, la versión se marca con `valid = false` en la tabla `project_specs`, y el usuario puede reintentar la generación completa. En el frontend se muestra un badge "Generación incompleta" y el botón "Regenerar" permanece activo.

### C2 — Navegación durante streaming SSE

**Pregunta**: Si el usuario navega fuera de la página mientras se transmite la generación por SSE, ¿qué hacer?

**Decisión**: **Continuar en background**. El job de generación sigue ejecutándose en el backend independientemente de la conexión SSE. Cuando el usuario vuelve a la página del proyecto, se consulta el estado actual del job/spec y se muestra el resultado si ya terminó, o se reconecta al stream si aún está en progreso.

### C3 — API key de Anthropic inválida o cuota agotada

**Pregunta**: Si la API key de Anthropic es inválida o se recibe 429 (cuota agotada), ¿qué hacer?

**Decisión**: **Reintentos con backoff + error descriptivo**. Se aplican hasta 3 reintentos con backoff exponencial (1s, 2s, 4s). Si persisten los errores:
- **401/403 (key inválida)**: Error inmediato sin reintentos → `ANTHROPIC_AUTH_ERROR` con mensaje "La API key de Anthropic no es válida. Verifique la configuración."
- **429 (rate limit)**: Reintentos con backoff. Si falla tras 3 intentos → `ANTHROPIC_RATE_LIMIT` con mensaje "Servicio temporalmente no disponible. Intente en unos minutos."
- **500+ (error servidor)**: Reintentos con backoff. Si falla → `ANTHROPIC_SERVICE_ERROR` con mensaje "Error del servicio de IA. Intente nuevamente."

---

## NFRs Específicos de M3

- **Rate limit generación**: 10 por proyecto/hora (Redis `spec:gen:{projectId}`), 50 por usuario/día (Redis `spec:gen:user:{userId}`)
- **Timeout por documento**: 90 segundos
- **Retry automático**: max 3 intentos por documento con backoff exponencial (1s, 2s, 4s)
- **Tamaño máximo spec**: 50,000 caracteres por documento
- **Modelo por defecto**: usa `project.config.model`, fallback `claude-sonnet-4-6`

---

## Páginas Frontend

```
/projects/[id]  → Tab "Spec" (viewer + editor inline)
```

> Los templates se muestran en `/projects/new` como sección de la página de crear proyecto (no página separada en MVP).

---

## Archivos a Crear

### Backend (apps/api/)

```
src/modules/spec/
├── spec.routes.ts            → Rutas Fastify (generate, stream, CRUD, versions)
├── spec.controller.ts        → Handlers
├── spec.service.ts           → Lógica: llamar Claude, validar output, guardar versión
├── spec.schema.ts            → Schemas Zod de request/response
├── spec.validator.ts         → Validación de secciones obligatorias del output
└── spec.stream.ts            → SSE emitter para streaming de generación

src/modules/templates/
├── template.routes.ts        → GET /api/templates
├── template.controller.ts    → Handler listado
└── template.service.ts       → Query de templates

src/lib/
└── anthropic.ts              → Cliente Anthropic SDK configurado (singleton)
```

### Frontend (apps/web/)

```
components/spec/
├── spec-viewer.tsx           → Renderiza markdown con tabs por documento
├── spec-editor.tsx           → Editor markdown (@uiw/react-md-editor)
├── spec-stream.tsx           → Componente que muestra generación en tiempo real
├── spec-version-selector.tsx → Dropdown de versiones
└── template-gallery.tsx      → Cards de templates en página de crear proyecto

hooks/
└── use-spec-stream.ts        → Hook SSE para streaming de generación
```

### Skills

```
skills/spec-agent/
├── system.md                 → System prompt
├── spec.md                   → Prompt para spec.md
├── data-model.md             → Prompt para data-model.md
└── api-design.md             → Prompt para api-design.md
```

### Prisma

```
prisma/schema.prisma → Agregar modelo Template
prisma/seed.ts       → Seed de 5 templates predefinidos
```

---

## Fuera de Scope (M3)

- CRUD de templates personalizados (post-MVP)
- Guardar proyecto como template (post-MVP)
- Modo chat interactivo para refinar spec (post-MVP)
- Generación de specs con upload de documentos .pdf/.docx (post-MVP)
- A/B testing de prompts (post-MVP)
- Ejecutar agentes de código — eso es M4

---

## Definición de Done

- [x] Generación de spec produce 3 documentos (spec.md, data-model.md, api-design.md)
- [x] Streaming SSE funciona — el usuario ve el texto aparecer en tiempo real
- [x] Cada documento se valida contra schema de secciones obligatorias
- [x] Retry automático funciona (hasta 3 intentos) con backoff
- [x] Timeout de 90s por documento funciona y guarda parcial
- [x] El spec se guarda en `project_specs` con versionamiento
- [x] Edición manual crea nueva versión sin perder la anterior
- [x] Rate limiting activo (10/proyecto/hora, 50/usuario/día)
- [x] 5 templates del sistema se muestran en la galería
- [x] Tests del spec service cubriendo generación, validación, versiones y errores
- [x] UI responsive en mobile y desktop
- [x] No hay `any` en TypeScript
