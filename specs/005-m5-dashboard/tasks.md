# Tasks: M5 Dashboard

**Input**: Design documents from `/specs/005-m5-dashboard/`
**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Shared + Store + WS Hook)

**Purpose**: Shared file-icons, Zustand store, WebSocket hook, agent config

- [X] T001 Create unified file-icons map (Lucide components + SVG paths) in `packages/shared/constants/file-icons.ts`
- [X] T002 Create agent config (positions, colors, radii per type) in `apps/web/lib/agent-config.ts`
- [X] T003 Create WS event types in `apps/web/lib/ws-events.ts` (import from @sophia/shared)
- [X] T004 Create Zustand dashboard store in `apps/web/hooks/use-dashboard-store.ts` — agents, logs (ring buffer 200), files, metrics, UI state
- [X] T005 Create WebSocket hook with reconnection + replay in `apps/web/hooks/use-websocket.ts`
- [X] T006 Create elapsed time hook in `apps/web/hooks/use-elapsed-time.ts`

**Checkpoint**: Shared infrastructure, store, and WS hook ready

---

## Phase 2: HU-18 — Ver Agentes en Tiempo Real (Priority: P1) 🎯 MVP

**Goal**: Canvas con 9 nodos + orchestrator, conexiones, animaciones

- [X] T007 Create Canvas renderer functions (drawNode, drawConnection, drawLabel) in `apps/web/components/dashboard/agent-canvas-renderer.ts`
- [X] T008 Create Canvas hit-testing (hover/click on circular nodes) in `apps/web/components/dashboard/agent-canvas-events.ts`
- [X] T009 Create particle system (particles traveling active connections) in `apps/web/components/dashboard/agent-particles.ts`
- [X] T010 Create AgentCanvas component (Canvas HTML5, rAF loop, ResizeObserver) in `apps/web/components/dashboard/agent-canvas.tsx`
- [X] T011 Create AgentDetailPanel (expandable on node click) in `apps/web/components/dashboard/agent-detail-panel.tsx`

**Checkpoint**: Canvas with animated agents, connections, and click interaction

---

## Phase 3: HU-19 — Log en Tiempo Real (Priority: P1)

**Goal**: Panel de logs con auto-scroll, colores, filtros

- [X] T012 Create AgentLogPanel in `apps/web/components/dashboard/agent-log-panel.tsx` — auto-scroll, pause/resume, badge new count, filter by agent

**Checkpoint**: Live log panel receiving WS events

---

## Phase 4: HU-20 — Archivos Generados en Tiempo Real (Priority: P1)

**Goal**: Panel de archivos con animación de entrada, íconos Lucide, agrupación

- [X] T013 Create AgentFilesPanel in `apps/web/components/dashboard/agent-files-panel.tsx` — Framer Motion fade+slide, icons from shared map, grouped by folder
- [X] T014 Create FilePreviewModal (content + shiki syntax highlighting) in `apps/web/components/dashboard/file-preview-modal.tsx`

**Checkpoint**: Files panel with animated entries and preview

---

## Phase 5: HU-21 — Métricas del Proyecto (Priority: P2)

**Goal**: Barra de métricas con 5 cards + barra de progreso

- [X] T015 Create AgentMetricsBar in `apps/web/components/dashboard/agent-metrics-bar.tsx` — Bot, BarChart3, FolderOpen, Timer, Coins icons + progress bar

**Checkpoint**: Real-time metrics display

---

## Phase 6: HU-22 — Controlar Ejecución (Priority: P1)

**Goal**: Botones pausar/continuar/reintentar/descargar según estado

- [X] T016 Create AgentControls in `apps/web/components/dashboard/agent-controls.tsx` — state-driven buttons, confirmation before pause

**Checkpoint**: Execution controls functional

---

## Phase 7: Layout + Mobile + Empty State

**Purpose**: Responsive layout, mobile list view, empty state

- [X] T017 Create DashboardLayout (desktop canvas vs mobile list) in `apps/web/components/dashboard/dashboard-layout.tsx`
- [X] T018 Create AgentListMobile (< 768px, vertical list with progress bars) in `apps/web/components/dashboard/agent-list-mobile.tsx`
- [X] T019 Create DashboardEmpty (idle state before starting) in `apps/web/components/dashboard/dashboard-empty.tsx`

**Checkpoint**: Full responsive dashboard for desktop and mobile

---

## Phase 8: Polish & Tests

- [X] T020 [P] Unit tests for agent-canvas-renderer.ts in `apps/web/components/dashboard/__tests__/agent-canvas-renderer.test.ts`
- [X] T021 [P] Component test for AgentLogPanel in `apps/web/components/dashboard/__tests__/agent-log-panel.test.tsx`
- [X] T022 [P] Unit test for use-websocket.ts (reconnection, replay) in `apps/web/hooks/__tests__/use-websocket.test.ts`

---

## Dependencies & Execution Order

- **Phase 1** (Setup): Depends on M4 WebSocket events spec
- **Phase 2** (HU-18 Canvas): Depends on Phase 1
- **Phase 3** (HU-19 Logs): Depends on Phase 1 (parallel with Phase 2)
- **Phase 4** (HU-20 Files): Depends on Phase 1 (parallel with Phase 2)
- **Phase 5** (HU-21 Metrics): Depends on Phase 1
- **Phase 6** (HU-22 Controls): Depends on Phase 1
- **Phase 7** (Layout): Depends on Phases 2-6
- **Phase 8** (Tests): Depends on all previous
