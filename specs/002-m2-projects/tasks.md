# Tasks: M2 Projects

**Input**: Design documents from `/specs/002-m2-projects/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | data-model.md ✅ | contracts/ ✅ | research.md ✅ | quickstart.md ✅
**Last analyze**: 2026-04-08 — Pass 4: 3M+1L (indexes sync, api-spec regen, plan.md tree, metadata)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable — archivos distintos, sin dependencias de tareas incompletas
- **[US#]**: Historia de usuario a la que pertenece la tarea
- Siempre incluir ruta exacta del archivo

---

## Phase 1: Setup (Schema + Base Module)

**Purpose**: Prisma schema, migración y registro del módulo

- [ ] T001 Add `Project` and `ProjectSpec` Prisma models (with `tokensUsed`, `errorMessage`, all indexes) in `apps/api/prisma/schema.prisma`
- [ ] T002 Run `pnpm db:migrate` to generate and apply M2 migration for `projects` and `project_specs` tables
- [ ] T003 Register projects module plugin in `apps/api/src/app.ts` — import and register project routes

**Checkpoint**: `projects` and `project_specs` tables exist in DB; module registered

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schemas Zod + rutas declaradas — bloquean todas las HUs

⚠️ **CRITICAL**: Ninguna HU puede implementarse hasta completar esta fase

- [ ] T004 Create Zod schemas in `apps/api/src/modules/projects/project.schema.ts` — `CreateProjectSchema` (dual refine para agentes obligatorios + generadores), `UpdateProjectSchema` (partial), `ListProjectsQuerySchema` (page, limit, status, search)
- [ ] T004.5 Create M2 shared types in `packages/shared/src/types/projects.ts` — export `ProjectStatus` enum, `Project`, `ProjectSpec`, `CreateProjectInput`, `UpdateProjectInput`, `ListProjectsQuery`, `ProjectListMeta`; re-export from `packages/shared/src/index.ts`
- [ ] T005 Create routes file with all 10 routes declared in `apps/api/src/modules/projects/project.routes.ts` — GET/POST /api/projects, GET/PATCH/DELETE /api/projects/:id, POST start/pause/continue/retry, GET download

**Checkpoint**: Schemas compilados sin errores; rutas registradas (handlers vacíos OK)

---

## Phase 3: US1 — HU-06 Crear Proyecto (Priority: P1) 🎯 MVP

**Goal**: Usuario puede crear un proyecto con validación completa y ser redirigido al detalle

**Independent Test**: `POST /api/projects` con payload válido retorna 201 + `{ data: { id, status: "idle" } }`

- [ ] T006 [US1] Create `createProject(userId, input)` in `apps/api/src/modules/projects/project.service.ts` — Zod parse, `prisma.project.create`, return formatted DTO
- [ ] T007 [US1] Create `createProjectHandler` in `apps/api/src/modules/projects/project.controller.ts` — extract userId from JWT cookie, call service, return 201
- [ ] T008 [US1] Wire `POST /api/projects` route to handler in `project.routes.ts`
- [ ] T009 [P] [US1] Create project creation page at `apps/web/app/(dashboard)/projects/new/page.tsx` — server component, renders ProjectForm
- [ ] T010 [P] [US1] Create `ProjectForm` in `apps/web/components/projects/project-form.tsx` — "use client", React Hook Form + Zod, preview colapsable del prompt, botón "Usar template" con valores predefinidos (node-nextjs / claude-sonnet-4-6 / todos los agentes), redirect a /projects/[id] on success; acepta prop opcional `project?: Project` para modo edición (pre-popula `defaultValues` de RHF)
- [ ] T011 [P] [US1] Create `StackSelector` in `apps/web/components/projects/stack-selector.tsx` — opciones: node-nextjs | laravel-nextjs | python-nextjs con iconos/badges
- [ ] T012 [P] [US1] Create `AgentSelector` in `apps/web/components/projects/agent-selector.tsx` — checkboxes para 6 agentes opcionales (dba/backend/frontend/qa/docs/deploy); seed/security/integration siempre activos y deshabilitados

**Checkpoint**: Crear proyecto end-to-end: formulario → POST → redirect a /projects/[id]

---

## Phase 4: US2 — HU-07 Listar Proyectos (Priority: P1) 🎯 MVP

**Goal**: Grid paginado de project cards con búsqueda y filtros por estado

**Independent Test**: `GET /api/projects?page=1&limit=12` retorna 200 + `{ data: [...], meta: { total, page, limit, pages } }`

- [ ] T013 [US2] Create `listProjects(userId, query)` in `project.service.ts` — OFFSET/LIMIT pagination, ILIKE search on `name`, status filter enum, `WHERE deleted_at IS NULL AND user_id = userId`, order by `created_at DESC`, compute `currentLayerName`
- [ ] T014 [US2] Create `listProjectsHandler` in `project.controller.ts` — parse query params, call service, return 200
- [ ] T015 [US2] Wire `GET /api/projects` route to handler in `project.routes.ts`
- [ ] T016 [P] [US2] Create projects list page at `apps/web/app/(dashboard)/projects/page.tsx` — server component, fetch projects, pass to ProjectGrid
- [ ] T017 [P] [US2] Create `ProjectCard` in `apps/web/components/projects/project-card.tsx` — nome, stack badge, status color badge (idle/running/paused/done/error), progress %, current layer name, relative date, pulse animation for `running`, menu ⋯ con Eliminar
- [ ] T018 [P] [US2] Create `ProjectGrid` in `apps/web/components/projects/project-grid.tsx` — "use client", grid 12/página con paginación, buscador server-side, filtros por estado (Todos/En progreso/Completados/Con error/Pausados)
- [ ] T019 [P] [US2] Create `ProjectEmptyState` in `apps/web/components/projects/project-empty-state.tsx` — ilustración + botón "Crear primer proyecto" → link a /projects/new

**Checkpoint**: Listado funcional con paginación, búsqueda ILIKE y filtros; empty state visible cuando no hay proyectos

---

## Phase 5: US3 — HU-08 Ver Detalle del Proyecto (Priority: P1)

**Goal**: Página de detalle con header, tabs (con placeholders) y botones de acción por estado; stubs de transición de estado

**Independent Test**: `GET /api/projects/:id` retorna 200 con proyecto + spec; acceso de otro usuario retorna 403; proyecto eliminado retorna 404

- [ ] T020 [US3] Create `getProject(userId, id)` in `project.service.ts` — `prisma.project.findFirst` con `where: { id, deletedAt: null }`, 404 si no existe, 403 si `userId !== project.userId`, include `specs` (latest)
- [ ] T021 [US3] Create `getProjectHandler` in `project.controller.ts` — return 200 `{ data: project }`
- [ ] T022 [US3] Wire `GET /api/projects/:id` route to handler in `project.routes.ts`
- [ ] T023 [US3] Create `startProject()`, `pauseProject()`, `continueProject()`, `retryProject()` stubs in `project.service.ts` — validar transiciones de estado, retornar `INVALID_STATE_TRANSITION` 400 si inválida, actualizar `status` con `prisma.project.update`
- [ ] T024 [US3] Create stub handlers (`startHandler`, `pauseHandler`, `continueHandler`, `retryHandler`) in `project.controller.ts`
- [ ] T025 [US3] Wire `POST /api/projects/:id/start`, `/pause`, `/continue`, `/retry` routes in `project.routes.ts`
- [ ] T026 [US3] Wire `GET /api/projects/:id/download` route — handler retorna 501 `{ error: "NOT_IMPLEMENTED", message: "Descarga de archivos implementada en M6" }`
- [ ] T027 [P] [US3] Create detail layout at `apps/web/app/(dashboard)/projects/[id]/layout.tsx` — wrapper estructural (nav, breadcrumb); NO hace fetch del proyecto. Los datos del proyecto los obtiene `[id]/page.tsx` y los pasa como props a los componentes hijos
- [ ] T028 [P] [US3] Create detail page at `apps/web/app/(dashboard)/projects/[id]/page.tsx` — server component, fetch proyecto, render ProjectDetail + ProjectTabs
- [ ] T029 [P] [US3] Create `ProjectDetail` in `apps/web/components/projects/project-detail.tsx` — wrapper que compone ProjectHeader + ProjectActions + ProjectTabs
- [ ] T030 [P] [US3] Create `ProjectHeader` in `apps/web/components/projects/project-header.tsx` — nombre, stack badge, status color, barra de progreso, capa actual; si `status === "error"` mostrar alert rojo con `errorMessage` debajo del header
- [ ] T031 [US3] Create `ProjectActions` in `apps/web/components/projects/project-actions.tsx` — "use client", botón por estado: idle→"▶ Iniciar" | running→"⏸ Pausar" | paused→"▶ Continuar" | done→"⬇ Descargar ZIP" (deshabilitado) | error→"↺ Reintentar"; llama a POST stub endpoints. ⚠️ T036.5 y T040.5 también modifican este archivo — implementar secuencialmente (T031 → T036.5 → T040.5)
- [ ] T032 [P] [US3] Create `ProjectTabs` in `apps/web/components/projects/project-tabs.tsx` — "use client", 4 tabs: Dashboard (placeholder M5) | Archivos (placeholder M6) | Logs (placeholder M4) | Spec (render ProjectSpecViewer)
- [ ] T033 [P] [US3] Create `ProjectSpecViewer` in `apps/web/components/projects/project-spec-viewer.tsx` — render markdown read-only del spec del proyecto (usa librería markdown existente o `<pre>` si no hay)

**Checkpoint**: Detalle funcional con 403/404; transiciones de estado vía stubs retornan status correcto; tabs renderan placeholders y spec

---

## Phase 6: US4 — HU-09 Actualizar Proyecto (Priority: P2)

**Goal**: Editar nombre, descripción, stack, config solo en estado idle

**Independent Test**: `PATCH /api/projects/:id` en proyecto `idle` retorna 200; en `running`/`done`/`error` retorna 400 `PROJECT_NOT_EDITABLE`

- [ ] T034 [US4] Create `updateProject(userId, id, input)` in `project.service.ts` — 404/403 checks, validar `status === "idle"` (400 si no), Zod partial parse, `prisma.project.update`
- [ ] T035 [US4] Create `updateProjectHandler` in `project.controller.ts` — return 200 `{ data: updatedProject }`
- [ ] T036 [US4] Wire `PATCH /api/projects/:id` route to handler in `project.routes.ts`
- [ ] T036.5 [US4] Add edit button to `apps/web/components/projects/project-actions.tsx` — visible solo cuando `status === "idle"`, navega a `/projects/[id]/edit`. ⚠️ Depende de T031 (mismo archivo)
- [ ] T036.6 [P] [US4] Create edit page at `apps/web/app/(dashboard)/projects/[id]/edit/page.tsx` — server component; fetch del proyecto, pasa prop `project` a `ProjectForm` (modo edición, pre-populated vía `defaultValues`), PATCH on submit via `useProjects.updateProject()`, toast de éxito, redirect back a `/projects/[id]`

**Checkpoint**: Update bloqueado en estados non-idle; edit button solo visible en idle; toast de éxito tras guardar

---

## Phase 7: US5 — HU-10 Eliminar Proyecto (Priority: P2)

**Goal**: Soft delete con confirmación modal (requiere escribir nombre); no eliminar si `running`

**Independent Test**: `DELETE /api/projects/:id` en proyecto no-running retorna 200; en `running` retorna 400 `CANNOT_DELETE_RUNNING`; GET posterior al delete retorna 404

- [ ] T037 [US5] Create `deleteProject(userId, id)` in `project.service.ts` — 404/403 checks, validar `status !== "running"` (400 si running), `prisma.project.update({ deletedAt: new Date() })`
- [ ] T038 [US5] Create `deleteProjectHandler` in `project.controller.ts` — return 200 `{ data: { message: "Proyecto eliminado" } }`
- [ ] T039 [US5] Wire `DELETE /api/projects/:id` route to handler in `project.routes.ts`
- [ ] T040 [P] [US5] Create `DeleteProjectDialog` in `apps/web/components/projects/delete-project-dialog.tsx` — "use client", modal shadcn Dialog, input para escribir nombre del proyecto, botón confirmar (disabled si nombre no coincide), llama a DELETE endpoint y redirige a /projects
- [ ] T040.5 [US5] Wire `DeleteProjectDialog` en vista de detalle: añadir opción "Eliminar" al menú ⋯ de `apps/web/components/projects/project-actions.tsx` — visible cuando `status !== "running"`. ⚠️ Depende de T031 y T036.5 (mismo archivo)

**Checkpoint**: Soft delete funcional; GET en proyecto eliminado retorna 404; modal requiere nombre exacto; trigger de eliminación accesible desde card Y desde vista de detalle

---

## Phase 8: Polish & Cross-cutting

**Purpose**: Hook de datos, tests, lint y build final

- [ ] T041 Create `useProjects` hook in `apps/web/hooks/use-projects.ts` — funciones: `fetchProjects(query)`, `createProject(input)`, `updateProject(id, input)`, `deleteProject(id)`, `startProject(id)`, `pauseProject(id)`, `continueProject(id)`, `retryProject(id)` con `fetch(url, { credentials: "include" })`
- [ ] T042 [P] Write unit tests for `project.service.ts` in `apps/api/src/modules/projects/__tests__/project.service.test.ts` — happy path CRUD, state transition validation (all valid + all invalid), soft delete + opaque 404, ownership 403
- [ ] T043 [P] Write integration test in `apps/api/src/modules/projects/__tests__/project.integration.test.ts` — flow: create → list (paginación) → getById → start (idle→running) → pause (running→paused) → continue (paused→running) → update (400, not idle) → delete (400, running) → force idle → delete → GET 404
- [ ] T044 Run `pnpm --filter @sophia/api lint && pnpm --filter @sophia/api build` — fix all errors before commit
- [ ] T045 Run `pnpm --filter @sophia/web lint && pnpm --filter @sophia/web build` — fix all errors before commit

---

## Dependencies & Execution Order

```
Phase 1 (Setup)
  └── Phase 2 (Foundational)
        ├── Phase 3 (US1 Create)   ← MVP mínimo entregable
        ├── Phase 4 (US2 List)     ← puede paralelizar con US1
        └── Phase 5 (US3 Detail)   ← requiere US1 (necesita proyectos)
              ├── Phase 6 (US4 Update)
              └── Phase 7 (US5 Delete)
                    └── Phase 8 (Polish)
```

**Prerequisito externo**: M1 Auth — tabla `users` y middleware JWT deben existir (FK + `request.user.id`)

## Parallel Execution Examples

**US1 backend** (T006→T008) puede desarrollarse en paralelo con **US2 backend** (T013→T015).
**Todos los componentes frontend [P]** dentro de cada fase son paralelizables entre sí.
**Tests** (T042, T043) pueden escribirse en paralelo una vez que el servicio esté completo.

## Implementation Strategy

**MVP Phase** (Phases 1–4): Setup + Create + List — funcional sin detalle ni edición.
**Core Phase** (Phase 5): Detail con stubs de ejecución — habilita la máquina de estados.
**Complete Phase** (Phases 6–7): Update + Delete — CRUD completo.
**Polish Phase** (Phase 8): Hook + tests + lint/build.
- **Phase 7** (Stubs): Depends on Phase 2
- **Phase 8** (Tests): Depends on all previous
