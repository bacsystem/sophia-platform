# Tasks: M2 Projects

**Input**: Design documents from `/specs/002-m2-projects/`
**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Schema + Base Module)

**Purpose**: Prisma schema y estructura base del módulo projects

- [ ] T001 Add Prisma models for `projects` and `project_specs` in `apps/api/prisma/schema.prisma`
- [ ] T002 Run Prisma migration for projects tables
- [ ] T003 Create Zod schemas (create, update, list query, config with dual refine) in `apps/api/src/modules/projects/project.schema.ts`
- [ ] T004 Create project routes file with all 9 routes in `apps/api/src/modules/projects/project.routes.ts`

**Checkpoint**: Schema and route structure ready

---

## Phase 2: HU-06 — Crear Proyecto (Priority: P1) 🎯 MVP

**Goal**: Usuarios pueden crear proyectos con validación completa

- [ ] T005 Create `createProject()` in `apps/api/src/modules/projects/project.service.ts` — validate Zod, create with Prisma, return formatted
- [ ] T006 Create create handler in `apps/api/src/modules/projects/project.controller.ts`
- [ ] T007 Wire POST /api/projects route in `project.routes.ts`
- [ ] T008 [P] Create project creation page at `apps/web/app/(dashboard)/projects/new/page.tsx`
- [ ] T009 [P] Create ProjectForm component in `apps/web/components/projects/project-form.tsx` ("use client", React Hook Form + Zod, agent checkboxes with mandatory 3)
- [ ] T009.5 [P] Create StackSelector component in `apps/web/components/projects/stack-selector.tsx` — stack options with icons/badges
- [ ] T009.6 [P] Create AgentSelector component in `apps/web/components/projects/agent-selector.tsx` — checkboxes with seed/security/integration locked

**Checkpoint**: Project creation flow functional with Zod dual refine

---

## Phase 3: HU-07 — Listar Proyectos (Priority: P1) 🎯 MVP

**Goal**: Grid de project cards con paginación, búsqueda y filtros

- [ ] T010 Create `listProjects()` in `project.service.ts` — paginación OFFSET/LIMIT, ILIKE search, status filter, WHERE deleted_at IS NULL
- [ ] T011 Create list handler in `project.controller.ts`
- [ ] T012 Wire GET /api/projects route
- [ ] T013 [P] Create projects list page at `apps/web/app/(dashboard)/projects/page.tsx`
- [ ] T014 [P] Create ProjectCard component in `apps/web/components/projects/project-card.tsx` — status badge, progress, layer name
- [ ] T015 [P] Create ProjectGrid component in `apps/web/components/projects/project-grid.tsx` — grid, pagination, search, filters
- [ ] T015.5 [P] Create ProjectEmptyState component in `apps/web/components/projects/project-empty-state.tsx` — illustration + "Crear primer proyecto" CTA button

**Checkpoint**: Projects listing with pagination and filtering

---

## Phase 4: HU-08 — Ver Detalle del Proyecto (Priority: P1)

**Goal**: Página de detalle con tabs y botones de acción por estado

- [ ] T016 Create `getProject()` in `project.service.ts` — include spec, ownership check, 404
- [ ] T017 Create get handler in `project.controller.ts`
- [ ] T018 Wire GET /api/projects/:id route
- [ ] T019 Create project detail page at `apps/web/app/(dashboard)/projects/[id]/page.tsx`
- [ ] T020 [P] Create ProjectDetail component in `apps/web/components/projects/project-detail.tsx` — header, status, progress bar
- [ ] T020.5 [P] Create ProjectHeader component in `apps/web/components/projects/project-header.tsx` — name, stack badge, status color, progress bar, current layer
- [ ] T020.6 [P] Create ProjectActions component in `apps/web/components/projects/project-actions.tsx` — action buttons per state (start/pause/continue/retry/download)
- [ ] T021 [P] Create ProjectTabs component in `apps/web/components/projects/project-tabs.tsx` — Dashboard/Archivos/Logs/Spec tabs (placeholders for M5/M6)
- [ ] T021.5 [P] Create ProjectSpecViewer component in `apps/web/components/projects/project-spec-viewer.tsx` — read-only markdown render of project spec

**Checkpoint**: Project detail page with tabs and action buttons

---

## Phase 5: HU-09 — Actualizar Proyecto (Priority: P2)

**Goal**: Editar nombre, descripción, config (solo estado idle)

- [ ] T022 Create `updateProject()` in `project.service.ts` — validate idle state, Zod partial, Prisma update
- [ ] T023 Create update handler in `project.controller.ts`
- [ ] T024 Wire PATCH /api/projects/:id route

**Checkpoint**: Project update restricted to idle state

---

## Phase 6: HU-10 — Eliminar Proyecto (Priority: P2)

**Goal**: Soft delete con confirmación y validación de estado

- [ ] T025 Create `deleteProject()` in `project.service.ts` — validate not running, set deleted_at
- [ ] T026 Create delete handler in `project.controller.ts`
- [ ] T027 Wire DELETE /api/projects/:id route
- [ ] T028 Create DeleteProjectDialog in `apps/web/components/projects/delete-project-dialog.tsx` — type project name to confirm

**Checkpoint**: Soft delete with confirmation modal

---

## Phase 7: Stubs de Ejecución

**Purpose**: Stubs start/pause/continue que M4 reemplazará

- [ ] T029 Create `startProject()`, `pauseProject()`, `continueProject()`, `retryProject()` stubs in `project.service.ts` — validate state transitions, update status
- [ ] T030 Create start/pause/continue handlers in `project.controller.ts`
- [ ] T031 Wire POST /api/projects/:id/start, /pause, /continue, /retry routes
- [ ] T032 Declare GET /api/projects/:id/download route stub (returns 501 "Implementado en M6")

**Checkpoint**: State machine transitions working via stubs

---

## Phase 8: Hooks + Polish

- [ ] T033 Create `useProjects` hook in `apps/web/hooks/use-projects.ts` — fetch, create, update, delete with SWR/fetch
- [ ] T034 [P] Unit tests for project.service.ts (CRUD, state transitions, soft delete) in `apps/api/src/modules/projects/__tests__/project.service.test.ts`
- [ ] T035 [P] Integration test: create → list → update → delete flow in `apps/api/src/modules/projects/__tests__/project.integration.test.ts`

---

## Dependencies & Execution Order

- **Phase 1** (Setup): Depends on M1 Phase 1 (users table must exist for FK)
- **Phase 2** (HU-06 Create): Depends on Phase 1
- **Phase 3** (HU-07 List): Depends on Phase 1 (can parallel with Phase 2)
- **Phase 4** (HU-08 Detail): Depends on Phase 2 (needs projects to exist)
- **Phase 5** (HU-09 Update): Depends on Phase 2
- **Phase 6** (HU-10 Delete): Depends on Phase 2
- **Phase 7** (Stubs): Depends on Phase 2
- **Phase 8** (Tests): Depends on all previous
