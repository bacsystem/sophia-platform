# SPEC — M2: Projects

# Sophia Platform

# Versión: 1.3 | Sprint: 1

---

## Descripción

Módulo de gestión de proyectos. Permite crear, listar, ver detalle, actualizar y eliminar proyectos. Es el punto de entrada para iniciar la generación de sistemas. Los endpoints de ejecución (`start`, `pause`, `continue`) son stubs que cambian estado — la lógica real de orquestación la implementa M4 (Agent Runner).

---

## Stack

- Frontend: Next.js 15 + React Hook Form + Zod + shadcn/ui
- Backend: Node.js 22 + Fastify + Prisma
- DB: PostgreSQL 16 (tablas projects, project_specs)

---

## Historias de Usuario

### HU-06 — Crear proyecto

**Como** usuario autenticado
**Quiero** crear un nuevo proyecto describiendo el sistema
**Para** que Sophia lo genere automáticamente

**Criterios de aceptación:**

- [ ] Formulario estructurado con los siguientes campos:
  - Nombre del proyecto (requerido, 3-100 chars)
  - Descripción en lenguaje natural (requerido, 20-5000 chars)
  - Selector de stack: `node-nextjs` | `laravel-nextjs` | `python-nextjs`
  - Selector de agentes a activar (checkboxes, mínimo 1): dba, seed, backend, frontend, qa, security, docs, deploy, integration
  - > **Nota**: `seed`, `security` e `integration` están siempre activos y no son deseleccionables. Los checkboxes solo aplican a los 6 agentes opcionales: dba, backend, frontend, qa, docs, deploy.
  - Selector de modelo: `claude-sonnet-4-6` (recomendado) | `claude-opus-4-6` | `claude-haiku-4-5`
  - ~~Selector de agentes en paralelo: 3 | 5 | 7~~ → **Sin efecto en MVP** (ejecución secuencial). Se oculta del formulario. Se implementará en post-MVP.
- [ ] Preview del prompt que se enviará a Claude (colapsable)
- [ ] Botón "Usar template" carga valores predefinidos en el formulario
- [ ] Al crear → redirige automáticamente al dashboard del proyecto `/projects/[id]`
- [ ] Muestra errores inline bajo cada campo

> **Fuera de MVP**: Modo chat libre y subir documento (.md, .txt, .pdf). Se implementan en M2.1.

**Validaciones Zod:**

```ts
z.object({
  name: z.string().min(3).max(100),
  description: z.string().min(20).max(5000),
  stack: z.enum(["node-nextjs", "laravel-nextjs", "python-nextjs"]),
  config: z.object({
    model: z.enum([
      "claude-sonnet-4-6",
      "claude-opus-4-6",
      "claude-haiku-4-5",
    ]),
    agents: z
      .array(
        z.enum(["dba", "seed", "backend", "frontend", "qa", "security", "docs", "deploy", "integration"])
      )
      .min(1, "Selecciona al menos un agente")
      .refine(
        (agents) => ["seed", "security", "integration"].every(a => agents.includes(a)),
        "seed, security e integration son obligatorios"
      )
      .refine(
        (agents) => ["dba", "backend", "frontend", "qa", "docs", "deploy"].some(a => agents.includes(a)),
        "Debe incluir al menos un agente generador (dba, backend, frontend, qa, docs o deploy)"
      ),
  }),
});
```

---

### HU-07 — Listar proyectos

**Como** usuario autenticado
**Quiero** ver todos mis proyectos
**Para** monitorear su estado y acceder a ellos

**Criterios de aceptación:**

- [ ] Grid de project cards con paginación server-side (12 por página)
- [ ] Cada card muestra: nombre, stack badge, estado con color, progreso (%), capa actual con nombre, fecha relativa
- [ ] Proyectos en estado `running` muestran indicador animado (pulso)
- [ ] Buscador por nombre (server-side, ILIKE en Postgres)
- [ ] Filtro por estado: Todos | En progreso | Completados | Con error | Pausados
- [ ] Ordenamiento por fecha de creación (más reciente primero)
- [ ] Si no hay proyectos → empty state con ilustración y botón "Crear primer proyecto"
- [ ] Al hacer clic en una card → navega a `/projects/[id]`

**Estados y colores:**

```
idle    → gris    "En espera"
running → azul    "Generando..." (con pulso animado)
paused  → ámbar   "Pausado"
done    → verde   "Completado"
error   → rojo    "Error"
```

**Capas y nombres (referencia M4):**

```
1   → Database     (DBA agent)
1.5 → Seed Data    (Seed agent)
2   → Backend      (Backend agent)
3   → Frontend     (Frontend agent)
4   → Testing      (QA agent)
4.5 → Security     (Security agent)
5   → Docs         (Docs agent)
6   → Deployment   (Deploy agent)
7   → Integration  (Integration agent)
```

---

### HU-08 — Ver detalle del proyecto

**Como** usuario
**Quiero** ver el detalle de un proyecto
**Para** monitorear su progreso y acceder al dashboard

**Criterios de aceptación:**

- [ ] Header con: nombre, stack badge, estado con color, progreso total (barra), capa actual
- [ ] Tabs: Dashboard | Archivos | Logs | Spec
  - Tab Dashboard → placeholder "Disponible cuando M5 esté implementado" (hasta Sprint 4)
  - Tab Archivos → placeholder "Disponible cuando M6 esté implementado" (hasta Sprint 5)
  - Tab Logs → lista de logs basica (tabla con timestamp, agente, tipo, mensaje)
  - Tab Spec → render del spec generado en markdown (read-only)
- [ ] Botones de acción según estado:
  - `idle` → "▶ Iniciar"
  - `running` → "⏸ Pausar"
  - `paused` → "▶ Continuar"
  - `done` → "⬇ Descargar ZIP"
  - `error` → "↺ Reintentar"
- [ ] Solo el owner del proyecto puede acceder (403 si no es suyo)

---

### HU-09 — Actualizar proyecto

**Como** usuario
**Quiero** editar el nombre, descripción o configuración de un proyecto
**Para** corregir errores o ajustar antes de ejecutar

**Criterios de aceptación:**

- [ ] Solo editable en estado `idle` (no se puede editar en ejecución, completado o error)
- [ ] Campos editables: nombre, descripción, stack, config
- [ ] Mismas validaciones Zod que en creación
- [ ] Toast de éxito al guardar

---

### HU-10 — Eliminar proyecto

**Como** usuario
**Quiero** eliminar un proyecto
**Para** mantener mi workspace ordenado

**Criterios de aceptación:**

- [ ] Opción de eliminar en menú ⋯ de cada project card y en el detalle
- [ ] Modal de confirmación con nombre del proyecto (el usuario debe escribir el nombre para confirmar)
- [ ] No se puede eliminar un proyecto en estado `running`
- [ ] Soft delete: marca `deleted_at` en BD, no se devuelve en queries
- [ ] Toast de éxito después de eliminar
- [ ] La lista se actualiza inmediatamente (optimistic update)
- [ ] Limpieza real de archivos se ejecuta via job asíncrono (BullMQ, implementado en M4)

---

## Endpoints API

```
GET    /api/projects                → Listar proyectos (paginado, filtrable)
POST   /api/projects                → Crear proyecto
GET    /api/projects/:id            → Ver proyecto con spec y agentes
PATCH  /api/projects/:id            → Actualizar proyecto (solo estado idle)
DELETE /api/projects/:id            → Soft delete proyecto
POST   /api/projects/:id/start      → Stub: cambia status a running (M4 encola job)
POST   /api/projects/:id/pause      → Stub: cambia status a paused (M4 señala agentes)
POST   /api/projects/:id/continue   → Stub: cambia status a running (M4 retoma)
GET    /api/projects/:id/download   → Descargar ZIP (implementado en M6, M2 solo declara ruta)
```

### GET /api/projects

```json
// Query params: ?page=1&limit=12&status=running&search=contabilidad

// Response 200
{
  "data": [
    {
      "id": "uuid",
      "name": "Módulo Contabilidad",
      "stack": "laravel-nextjs",
      "status": "running",
      "progress": 68,
      "currentLayer": 3,
      "currentLayerName": "Backend",
      "tokensUsed": 24831,
      "createdAt": "2026-04-07T10:00:00Z",
      "updatedAt": "2026-04-07T12:30:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 12,
    "pages": 4
  }
}
```

### POST /api/projects

```json
// Request
{
  "name": "Módulo Contabilidad",
  "description": "Sistema contable basado en PCGE peruano con libro diario, mayor, balance de comprobación...",
  "stack": "laravel-nextjs",
  "config": {
    "model": "claude-sonnet-4-6",
    "agents": ["dba", "seed", "backend", "frontend", "qa", "security", "docs", "deploy", "integration"]
  }
}

// Response 201
{
  "data": {
    "id": "uuid",
    "name": "Módulo Contabilidad",
    "stack": "laravel-nextjs",
    "status": "idle",
    "progress": 0,
    "currentLayer": 1,
    "config": { "model": "claude-sonnet-4-6", "agents": ["..."] },
    "createdAt": "2026-04-07T10:00:00Z"
  }
}

// Response 422
{ "errors": { "name": ["Mínimo 3 caracteres"] } }
```

### PATCH /api/projects/:id

```json
// Request (campos parciales)
{
  "name": "Módulo Contabilidad v2",
  "config": { "model": "claude-opus-4-6" }
}

// Response 200
{ "data": { "id": "uuid", "name": "Módulo Contabilidad v2", "...": "..." } }

// Response 400 (proyecto no está idle)
{ "error": "PROJECT_NOT_EDITABLE", "message": "Solo se puede editar en estado 'idle'" }
```

### POST /api/projects/:id/start

```json
// Response 200
{ "data": { "id": "uuid", "status": "running" } }

// Response 400
{ "error": "INVALID_STATE_TRANSITION", "message": "Solo se puede iniciar desde estado 'idle'" }

// Response 400
{ "error": "ALREADY_RUNNING", "message": "El proyecto ya está en ejecución" }
```

### POST /api/projects/:id/pause

```json
// Response 200
{ "data": { "id": "uuid", "status": "paused" } }

// Response 400
{ "error": "INVALID_STATE_TRANSITION", "message": "Solo se puede pausar un proyecto en ejecución" }
```

### POST /api/projects/:id/continue

```json
// Response 200
{ "data": { "id": "uuid", "status": "running" } }

// Response 400
{ "error": "INVALID_STATE_TRANSITION", "message": "Solo se puede continuar un proyecto pausado" }
```

### DELETE /api/projects/:id

```json
// Response 200
{ "data": { "message": "Proyecto eliminado" } }

// Response 400
{ "error": "CANNOT_DELETE_RUNNING", "message": "No se puede eliminar un proyecto en ejecución" }

// Response 404
{ "error": "NOT_FOUND", "message": "Proyecto no encontrado" }
```

### GET /api/projects/:id/download

```json
// Response 200 — Content-Type: application/zip, Transfer-Encoding: chunked
// Streaming del ZIP

// Response 400
{ "error": "NOT_DOWNLOADABLE", "message": "El proyecto debe estar al menos en capa 3 (Backend)" }

// Response 404
{ "error": "NO_FILES", "message": "No hay archivos generados para descargar" }
```

---

## Máquina de estados del proyecto

```
         ┌────────────────────────────────┐
         │                                │
         ▼                                │
    ┌─────────┐  start   ┌─────────┐     │
    │  idle   │────────►│ running │     │
    └─────────┘          └────┬────┘     │
         ▲                    │           │
         │               pause│    done   │
         │                    ▼           │
         │             ┌──────────┐  ┌────┴────┐
         │             │  paused  │  │  done   │
         │             └────┬─────┘  └─────────┘
         │                  │
         │            continue
         │                  │
         │                  ▼
         │             ┌─────────┐
         └─────────────│ running │
                       └────┬────┘
                            │
                       error│
                            ▼
                       ┌─────────┐  retry  ┌─────────┐
                       │  error  │────────►│ running │
                       └─────────┘         └─────────┘
```

**Transiciones válidas:**

| Desde    | Hacia    | Trigger   |
| -------- | -------- | --------- |
| idle     | running  | start     |
| running  | paused   | pause     |
| running  | done     | (auto)    |
| running  | error    | (auto)    |
| paused   | running  | continue  |
| error    | running  | retry     |

**Transiciones inválidas → Response 400 `INVALID_STATE_TRANSITION`**

---

## Data Model

### projects

| Campo         | Tipo         | Nullable | Default           | Descripción                              |
| ------------- | ------------ | -------- | ----------------- | ---------------------------------------- |
| id            | uuid         | No       | gen_random_uuid() | PK                                       |
| user_id       | uuid         | No       | —                 | FK → users                               |
| name          | varchar(100) | No       | —                 | Nombre del proyecto                      |
| description   | text         | No       | —                 | Descripción en lenguaje natural          |
| stack         | varchar(50)  | No       | —                 | node-nextjs, laravel-nextjs, python-nextjs |
| status        | varchar(20)  | No       | idle              | idle/running/paused/done/error           |
| progress      | integer      | No       | 0                 | Progreso 0-100                           |
| current_layer | real         | No       | 1                 | Capa actual (1, 1.5, 2, 3, 4, 4.5, 5, 6, 7) |
| tokens_used   | integer      | No       | 0                 | Caché denormalizado (actualizado por M4) |
| config        | jsonb        | No       | —                 | `{ model, agents[] }`                    |
| deleted_at    | timestamptz  | Sí       | null              | Soft delete                              |
| created_at    | timestamptz  | No       | now()             | —                                        |
| updated_at    | timestamptz  | No       | now()             | —                                        |

**Índices:**

- INDEX: `user_id`
- INDEX: `status`
- INDEX: `(user_id, deleted_at)` — queries de listado filtran `deleted_at IS NULL`
- INDEX: `(user_id, status, deleted_at)` — queries con filtro de estado

**Config JSONB schema:**

```ts
{
  model: "claude-sonnet-4-6" | "claude-opus-4-6" | "claude-haiku-4-5",
  agents: ("dba" | "seed" | "backend" | "frontend" | "qa" | "security" | "docs" | "deploy" | "integration")[]
}
```

> **Nota**: Se elimina `output_path`. La ruta de archivos se calcula como `{PROJECTS_BASE_DIR}/{project.id}/`.

---

### project_specs

| Campo      | Tipo        | Nullable | Default           | Descripción             |
| ---------- | ----------- | -------- | ----------------- | ----------------------- |
| id         | uuid        | No       | gen_random_uuid() | PK                      |
| project_id | uuid        | No       | —                 | FK → projects           |
| version    | integer     | No       | 1                 | Versión del spec        |
| content    | jsonb       | No       | —                 | Spec completo generado  |
| created_at | timestamptz | No       | now()             | —                       |

**Índices:**

- UNIQUE: `(project_id, version)`
- INDEX: `project_id`

> **Nota**: El spec se separa de `projects` para evitar cargar JSON grande en queries de listado y permitir versionamiento.

---

## Páginas Frontend

```
/                          → Lista de proyectos (dashboard principal)
/projects/new              → Crear nuevo proyecto
/projects/[id]             → Detalle + tabs (Dashboard, Archivos, Logs, Spec)
```

---

## Archivos a Crear

### Backend (apps/api/)

```
src/modules/projects/
├── project.routes.ts          → Definición de rutas Fastify
├── project.controller.ts      → Handlers de cada endpoint
├── project.service.ts         → Lógica de negocio + validación de transiciones + queries Prisma (listado paginado, filtros, soft delete)
└── project.schema.ts          → Schemas de validación Zod
```

### Frontend (apps/web/)

```
app/(dashboard)/
├── page.tsx                          → Lista de proyectos
├── projects/new/page.tsx             → Crear proyecto
└── projects/[id]/
    ├── page.tsx                      → Detalle del proyecto (tabs)
    └── layout.tsx                    → Layout con header del proyecto

components/projects/
├── project-card.tsx                  → Card de proyecto en grid
├── project-grid.tsx                  → Grid con paginación + filtros
├── project-form.tsx                  → Formulario crear/editar
├── project-header.tsx                → Header del detalle
├── project-actions.tsx               → Botones iniciar/pausar/continuar/descargar
├── project-tabs.tsx                  → Tab navigation
├── project-spec-viewer.tsx           → Render markdown del spec
├── stack-selector.tsx                → Selector de stack con iconos
├── agent-selector.tsx                → Checkboxes de agentes
├── delete-project-dialog.tsx         → Modal confirmación (requiere escribir nombre)
└── project-empty-state.tsx           → Empty state con ilustración
```

### Prisma

```
prisma/schema.prisma → Modelos: Project, ProjectSpec
prisma/migrations/   → Migración M2
```

---

## Fuera de Scope (M2)

- Modo chat libre para descripción del proyecto (M2.1)
- Upload de documentos .md, .txt, .pdf (M2.1)
- Lógica real de orquestación de agentes (M4)
- Canvas visual de agentes (M5)
- Árbol de archivos interactivo (M6)
- Templates CRUD completo (M3 o posterior)

---

## Definición de Done

- [ ] CRUD de proyectos funciona end-to-end (crear, listar, ver, editar, soft delete)
- [ ] Paginación server-side con búsqueda y filtros funciona
- [ ] Máquina de estados valida transiciones correctamente (400 en transición inválida)
- [ ] Start/pause/continue cambian status correctamente (stubs para M4)
- [ ] Download genera ZIP con streaming (guard: mínimo capa 3)
- [ ] Spec se almacena en tabla separada con versionamiento
- [ ] Soft delete implementado (no hard delete)
- [ ] Solo el owner puede ver/editar/eliminar sus proyectos (403)
- [ ] Tests de endpoints cubriendo happy path, errores y transiciones inválidas
- [ ] UI responsive en mobile y desktop
- [ ] No hay `any` en TypeScript
