# Tasks: M4 Agent Runner

**Input**: Design documents from `/specs/004-m4-agent-runner/`
**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Schema + Infrastructure)

**Purpose**: Tablas, queue, WebSocket base, encryption prerequisito

- [ ] T001 Create `encryption.service.ts` (AES-256-GCM encrypt/decrypt) in `apps/api/src/lib/encryption.service.ts` (Sprint 2.5 prerequisito)
- [ ] T002 Add Prisma models for `user_settings`, `agents`, `agent_logs`, `generated_files` in `apps/api/prisma/schema.prisma`
- [ ] T003 Run Prisma migration for agent runner tables + user_settings
- [ ] T004 [P] Create BullMQ queue + producer in `apps/api/src/queue/agent-queue.ts`
- [ ] T005 [P] Create tool definitions (createFile, readFile, listFiles, taskComplete) in `apps/api/src/agents/tool-definitions.ts`
- [ ] T006 [P] Create tool executor (path traversal prevention, file ops) in `apps/api/src/agents/tool-executor.ts`
- [ ] T007 Create WebSocket auth (JWT validation in handshake) in `apps/api/src/websocket/ws.auth.ts`
- [ ] T008 Create WS event emitter (typed events) in `apps/api/src/websocket/ws.emitter.ts`
- [ ] T009 Create WS routes (/ws/projects/:id) in `apps/api/src/websocket/ws.routes.ts`

**Checkpoint**: Queue, tools, WebSocket, encryption infrastructure ready

---

## Phase 2: Agent Framework (Core)

**Purpose**: Base agent class, orchestrator, context builder

- [ ] T010 Create base agent class (Tool Use loop, WS emit, checkpoint) in `apps/api/src/agents/base-agent.ts`
- [ ] T011 Create context builder (spec + previous files → prompt) in `apps/api/src/agents/context-builder.ts`
- [ ] T012 Create orchestrator (sequential layer execution, progress calc) in `apps/api/src/agents/orchestrator.ts`

**Checkpoint**: Agent execution framework testable with mock agent

---

## Phase 3: HU-14 — Ejecutar Proyecto (Priority: P1) 🎯 MVP

**Goal**: 9 agentes ejecutan secuencialmente generando código via Tool Use

### 9 Agent Implementations

- [ ] T013 [P] Create DBA agent (Layer 1: schema, migrations) in `apps/api/src/agents/dba-agent.ts`
- [ ] T014 [P] Create Seed agent (Layer 1.5: seed data, factories) in `apps/api/src/agents/seed-agent.ts`
- [ ] T015 [P] Create Backend agent (Layer 2: modules) in `apps/api/src/agents/backend-agent.ts`
- [ ] T016 [P] Create Frontend agent (Layer 3: pages, components) in `apps/api/src/agents/frontend-agent.ts`
- [ ] T017 [P] Create QA agent (Layer 4: tests) in `apps/api/src/agents/qa-agent.ts`
- [ ] T018 [P] Create Security agent (Layer 4.5: OWASP audit) in `apps/api/src/agents/security-agent.ts`
- [ ] T019 [P] Create Docs agent (Layer 5: README, API docs) in `apps/api/src/agents/docs-agent.ts`
- [ ] T020 [P] Create Deploy agent (Layer 6: Dockerfile, CI/CD) in `apps/api/src/agents/deploy-agent.ts`
- [ ] T021 [P] Create Integration agent (Layer 7: cross-layer validation) in `apps/api/src/agents/integration-agent.ts`

### API + Worker

- [ ] T022 Create agent service (CRUD agents, logs, progress) in `apps/api/src/modules/agents/agent.service.ts`
- [ ] T023 Create agent controller + schema in `apps/api/src/modules/agents/agent.controller.ts` and `agent.schema.ts`
- [ ] T024 Create agent routes (GET /agents, GET /logs, POST /start, /retry) in `apps/api/src/modules/agents/agent.routes.ts`
- [ ] T025 Create BullMQ worker (processLayer, run agent, checkpoint) in `apps/api/src/queue/agent-worker.ts`
- [ ] T026 Create worker entry point in `apps/api/src/worker.ts`

### Skills (Prompts)

- [ ] T027 [P] Create system.md + task.md for all 9 agents in `skills/{agent-name}/`

**Checkpoint**: Full pipeline execution DBA→Integration with file generation

---

## Phase 4: HU-15 + HU-16 — Pausar y Continuar (Priority: P2)

**Goal**: Graceful pause con Redis flag, resume sin repetir archivos

- [ ] T028 Implement pause logic in orchestrator — Redis flag `project:pause:{id}`, check before each tool_call
- [ ] T029 Implement continue logic — read current_layer, rebuild context from existing generated_files
- [ ] T030 Wire POST /api/projects/:id/pause and /continue replacing M2 stubs

**Checkpoint**: Pause/Continue functional with graceful stop

---

## Phase 5: HU-17 — Reintentar desde Error (Priority: P2)

**Goal**: Retry desde capa fallida con backoff exponencial

- [ ] T031 Implement retry logic in orchestrator — retry from failed layer, preserve completed layers
- [ ] T032 Add exponential backoff for Claude rate limits (1s/2s/4s, max 3 attempts)
- [ ] T033 Wire POST /api/projects/:id/retry route

**Checkpoint**: Retry from failed layer preserving progress

---

## Phase 6: Polish & Tests

- [ ] T034 [P] Unit tests for tool-executor.ts (path traversal, file ops) in `apps/api/src/agents/__tests__/tool-executor.test.ts`
- [ ] T035 [P] Unit tests for encryption.service.ts (encrypt/decrypt roundtrip) in `apps/api/src/lib/__tests__/encryption.service.test.ts`
- [ ] T036 [P] Unit tests for orchestrator.ts (layer sequencing, progress calc) in `apps/api/src/agents/__tests__/orchestrator.test.ts`
- [ ] T037 Unit tests for ws.auth.ts (JWT handshake validation) in `apps/api/src/websocket/__tests__/ws.auth.test.ts`
- [ ] T038 Integration test: start → execute DBA layer → checkpoint → verify files in `apps/api/src/agents/__tests__/agent.integration.test.ts`

---

## Dependencies & Execution Order

- **Phase 1** (Setup): Depends on M1 (auth), M2 (projects table), M3 (project_specs)
- **Phase 2** (Framework): Depends on Phase 1
- **Phase 3** (HU-14 Execute): Depends on Phase 2
- **Phase 4** (HU-15/16 Pause/Continue): Depends on Phase 3
- **Phase 5** (HU-17 Retry): Depends on Phase 3
- **Phase 6** (Tests): Depends on all previous
