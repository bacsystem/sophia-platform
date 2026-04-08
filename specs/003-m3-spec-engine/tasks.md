# Tasks: M3 Spec Engine

**Input**: Design documents from `/specs/003-m3-spec-engine/`
**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Schema + Anthropic Client)

**Purpose**: Modelo templates, cliente Anthropic, estructura base

- [ ] T001 Add Prisma model for `templates` in `apps/api/prisma/schema.prisma`
- [ ] T002 Run Prisma migration for templates table
- [ ] T003 Create Anthropic SDK singleton client in `apps/api/src/lib/anthropic.ts`
- [ ] T004 Create Zod schemas for spec endpoints in `apps/api/src/modules/spec/spec.schema.ts`
- [ ] T005 [P] Create Zod schema for templates in `apps/api/src/modules/templates/template.routes.ts` (inline, simple)

**Checkpoint**: Anthropic client + templates schema ready

---

## Phase 2: HU-13 — Templates Predefinidos (Priority: P2)

**Goal**: 5 templates seed con íconos Lucide React disponibles en galería

- [ ] T006 Create seed data for 5 templates (Building2, Rocket, Plug, Monitor, BookOpen) in `apps/api/prisma/seed.ts`
- [ ] T007 Create `listTemplates()` in `apps/api/src/modules/templates/template.service.ts`
- [ ] T008 Create template controller + routes (GET /api/templates) in `apps/api/src/modules/templates/template.controller.ts` and `template.routes.ts`
- [ ] T009 Create TemplateGallery component in `apps/web/components/spec/template-gallery.tsx` — cards with Lucide icons, onClick pre-fills form

**Checkpoint**: Templates available in project creation UI

---

## Phase 3: HU-11 — Generar Spec (Priority: P1) 🎯 MVP

**Goal**: Generación IA de 3 documentos con streaming SSE

### Backend

- [ ] T010 Create output validator for spec sections in `apps/api/src/modules/spec/spec.validator.ts` — validates required sections per doc type
- [ ] T011 Create SSE emitter utility in `apps/api/src/modules/spec/spec.stream.ts`
- [ ] T012 Create `generateSpec()` in `apps/api/src/modules/spec/spec.service.ts` — 3 sequential Claude calls, validate output, save version, retry logic
- [ ] T013 Create generate + stream handlers in `apps/api/src/modules/spec/spec.controller.ts`
- [ ] T014 Wire POST /api/projects/:id/spec/generate and GET /api/projects/:id/spec/stream routes in `spec.routes.ts`

### Frontend

- [ ] T015 Create `useSpecStream` SSE hook in `apps/web/hooks/use-spec-stream.ts`
- [ ] T016 Create SpecStream component in `apps/web/components/spec/spec-stream.tsx` — real-time text display with progress indicators

**Checkpoint**: Full spec generation with SSE streaming

---

## Phase 4: HU-12 — Ver y Editar Spec (Priority: P1)

**Goal**: Viewer markdown + editor con versionamiento

### Backend

- [ ] T017 Create `getSpec()`, `getSpecVersions()`, `getSpecVersion()`, `updateSpec()` in `apps/api/src/modules/spec/spec.service.ts`
- [ ] T018 Create CRUD handlers in `apps/api/src/modules/spec/spec.controller.ts`
- [ ] T019 Wire GET /spec, GET /spec/versions, GET /spec/:version, PUT /spec routes in `spec.routes.ts`

### Frontend

- [ ] T020 Create SpecViewer component in `apps/web/components/spec/spec-viewer.tsx` — markdown rendered, 3 sub-tabs
- [ ] T021 Create SpecEditor component in `apps/web/components/spec/spec-editor.tsx` — @uiw/react-md-editor with preview
- [ ] T022 Create SpecVersionSelector dropdown in `apps/web/components/spec/spec-version-selector.tsx`

**Checkpoint**: View, edit, and version spec documents

---

## Phase 5: Polish & Tests

- [ ] T023 [P] Unit tests for spec.service.ts (generate, validate, version CRUD) in `apps/api/src/modules/spec/__tests__/spec.service.test.ts`
- [ ] T024 [P] Unit tests for spec.validator.ts in `apps/api/src/modules/spec/__tests__/spec.validator.test.ts`
- [ ] T025 [P] Unit tests for template.service.ts in `apps/api/src/modules/templates/__tests__/template.service.test.ts`

---

## Dependencies & Execution Order

- **Phase 1** (Setup): Depends on M2 (project_specs model)
- **Phase 2** (Templates): Depends on Phase 1 (can start early)
- **Phase 3** (Generate): Depends on Phase 1 + Anthropic client
- **Phase 4** (View/Edit): Depends on Phase 3 (needs generated specs)
- **Phase 5** (Tests): Depends on all previous
