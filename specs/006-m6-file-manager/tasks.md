# Tasks: M6 File Manager

**Input**: Design documents from `/specs/006-m6-file-manager/`
**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Module Structure)

**Purpose**: Base module structure for file management

- [ ] T001 Create Zod schemas for file endpoints (params, query) in `apps/api/src/modules/files/file.schema.ts`
- [ ] T002 Create file routes with all 4 endpoints in `apps/api/src/modules/files/file.routes.ts`

**Checkpoint**: Module structure ready

---

## Phase 2: HU-23 — Ver Árbol de Archivos (Priority: P1) 🎯 MVP

**Goal**: Árbol colapsable con íconos Lucide y búsqueda

### Backend

- [ ] T003 Create `getFileTree()` in `apps/api/src/modules/files/file.service.ts` — query generated_files, build tree from flat paths
- [ ] T004 Create file tree handler in `apps/api/src/modules/files/file.controller.ts`
- [ ] T005 Wire GET /api/projects/:id/files route

### Frontend

- [ ] T006 Create FileTree component in `apps/web/components/files/file-tree.tsx` — collapsible folders with search
- [ ] T007 Create FileTreeNode component in `apps/web/components/files/file-tree-node.tsx` — icon by extension (shared map), badge agent color
- [ ] T008 Create FileBreadcrumb in `apps/web/components/files/file-breadcrumb.tsx`
- [ ] T009 Create FileSearch in `apps/web/components/files/file-search.tsx` — client-side filter
- [ ] T010 [P] Create file-tree-builder utility in `apps/web/lib/file-tree-builder.ts` — flat list → tree transformation

**Checkpoint**: File tree navigation functional

---

## Phase 3: HU-24 — Ver Contenido de Archivo (Priority: P1) 🎯 MVP

**Goal**: Viewer con syntax highlighting, line numbers, copy

### Backend

- [ ] T011 Create `getFileContent()` in `file.service.ts` — read from filesystem with path traversal prevention, include lineCount
- [ ] T012 Create `getRawFile()` in `file.service.ts` — stream file with Content-Disposition
- [ ] T013 Create file content + raw handlers in `file.controller.ts`
- [ ] T014 Wire GET /api/projects/:id/files/:fileId and GET /files/:fileId/raw routes

### Frontend

- [ ] T015 Create FileViewer component in `apps/web/components/files/file-viewer.tsx` — shiki highlight, line numbers, copy button, download button, header with agent badge
- [ ] T016 Create file manager page at `apps/web/app/(dashboard)/projects/[id]/files/page.tsx` — tree sidebar + viewer panel

**Checkpoint**: File viewing with syntax highlighting

---

## Phase 4: HU-25 — Descargar ZIP (Priority: P2)

**Goal**: ZIP streaming del proyecto completo

### Backend

- [ ] T017 Create `downloadProject()` in `file.service.ts` — archiver streaming, validate status done|paused
- [ ] T018 Create download handler in `file.controller.ts`
- [ ] T019 Wire GET /api/projects/:id/download route

### Frontend

- [ ] T020 Create DownloadButton component in `apps/web/components/files/download-button.tsx` — estimated size, disabled states with tooltip

**Checkpoint**: ZIP download functional

---

## Phase 5: Polish & Tests

- [ ] T021 [P] Unit tests for file.service.ts (tree building, path traversal prevention, ZIP) in `apps/api/src/modules/files/__tests__/file.service.test.ts`
- [ ] T022 [P] Component test for FileTree in `apps/web/components/files/__tests__/file-tree.test.tsx`

---

## Dependencies & Execution Order

- **Phase 1** (Setup): Depends on M4 (generated_files table must exist)
- **Phase 2** (HU-23 Tree): Depends on Phase 1
- **Phase 3** (HU-24 Content): Depends on Phase 1 (parallel with Phase 2)
- **Phase 4** (HU-25 ZIP): Depends on Phase 1
- **Phase 5** (Tests): Depends on all previous
