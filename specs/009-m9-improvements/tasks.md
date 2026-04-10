# Tasks: M9 Agent System Improvements

**Input**: Design documents from `/specs/009-m9-improvements/`
**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Shared Skills (Mejora 2 — Sprint 5)

**Purpose**: Crear skills compartidas y refactorizar system.md de los 9 agentes para eliminar duplicaciones

- [ ] T001 [P] [HU-32] Create `skills/_shared/conventions.md` — naming (PascalCase/camelCase/snake_case), file paths, response formats `{ data }` / `{ error }`, artefactos esperados por capa
- [ ] T002 [P] [HU-32] Create `skills/_shared/anti-patterns.md` — prohibiciones categorizadas: backend (no .repository.ts, no secrets in code, no Float for money), frontend (no localStorage tokens, no any, no fetch sin credentials), security (no plain text passwords, no CORS wildcard), DB (no soft delete, UUID for PKs)
- [ ] T003 [P] [HU-32] Create `skills/_shared/output-format.md` — formato estándar de `taskComplete` (summary + filesCreated), severity levels unificados (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`), formato tabular de reportes
- [ ] T004 [HU-32] Validate total token count of `_shared/*.md` < 3000 tokens (use tiktoken or manual estimation)

- [ ] T005 [P] [HU-33] Refactor `skills/dba-agent/system.md` — eliminar Tool Use instructions y naming conventions duplicados (target: -30% tamaño)
- [ ] T006 [P] [HU-33] Refactor `skills/seed-agent/system.md` — eliminar duplicados
- [ ] T007 [P] [HU-33] Refactor `skills/backend-agent/system.md` — eliminar duplicados + response format
- [ ] T008 [P] [HU-33] Refactor `skills/frontend-agent/system.md` — eliminar duplicados
- [ ] T009 [P] [HU-33] Refactor `skills/qa-agent/system.md` + `skills/qa-agent/task.md` — eliminar duplicados, agregar referencia a `factories.ts` y `test-constants.ts` de seed-agent [HU-35]
- [ ] T010 [P] [HU-33] Refactor `skills/security-agent/system.md` — eliminar duplicados, adoptar severity enum unificado de `output-format.md` [HU-34]
- [ ] T011 [P] [HU-33] Refactor `skills/docs-agent/system.md`, `skills/deploy-agent/system.md` — eliminar duplicados
- [ ] T012 [P] [HU-33] Refactor `skills/integration-agent/system.md` + `skills/integration-agent/task.md` — adoptar severity unificado, lista explícita de archivos a validar por capa [HU-34] [HU-35]

- [ ] T013 [P] [HU-33] Modify `apps/api/src/agents/orchestrator.ts` — implement `composeSystemPrompt()`: load `_shared/*.md` once at pipeline start, compose `[shared] + [agent system.md]` per layer
- [ ] T014 [HU-33] Create unit tests for `composeSystemPrompt()` in `apps/api/src/agents/__tests__/orchestrator.test.ts` — verify composition order, verify no duplicated instructions

**Checkpoint**: Skills compartidas creadas, 9 system.md refactorizados, orchestrator compone prompts. Run pipeline canario para verificar output equivalente.

---

## Phase 2: Memory Persistence (Mejora 3 — Sprint 5)

**Purpose**: Persistir conversación Claude, generar project memory, checkpoint granular, context inteligente

- [ ] T015 [P] [HU-36] Add `AgentMessage` model to `apps/api/prisma/schema.prisma` — fields: id, agentId, projectId, turn, role, content (Json), tokens, createdAt. Indexes: (agentId, turn), (projectId). Relation: Agent 1→N, Project 1→N
- [ ] T016 [P] [HU-36] Run Prisma migration for `agent_messages` table
- [ ] T017 [P] [HU-36] Modify `apps/api/src/agents/base-agent.ts` — persist each MessageParam to `agent_messages` after Claude response (fire-and-forget async, no blocking Tool Use loop)
- [ ] T018 [P] [HU-36] Modify `apps/api/src/agents/base-agent.ts` — implement `reconstructMessages(agentId): MessageParam[]` that rebuilds conversation from `agent_messages` table for crash recovery
- [ ] T019 [HU-36] Add `completed` flag to `agent_messages` — mark all messages as completed when agent finishes successfully

- [ ] T020 [P] [HU-37] Modify `apps/api/src/agents/orchestrator.ts` — after each layer completes, generate memory section (decisions, patterns, constraints) and append to `projects/{id}/memory/project_memory.md`
- [ ] T021 [P] [HU-37] Modify `apps/api/src/agents/context-builder.ts` — inject `project_memory.md` into agent prompt (after spec, before files). Cap at 5000 tokens.

- [ ] T022 [P] [HU-38] Modify `apps/api/src/agents/tool-executor.ts` — execute `prisma.generatedFile.upsert()` immediately after each successful `createFile` (not batched at end of agent)
- [ ] T023 [HU-38] Modify `apps/api/src/agents/context-builder.ts` — support mid-layer recovery by reading `generated_files` for current layer (not just `layer < current`)

- [ ] T024 [P] [HU-39] Modify `apps/api/src/agents/context-builder.ts` — replace hard limit of 20 files with token-budget prioritization (40K tokens budget). Priority: task.md references > immediate prior layer > larger files > rest
- [ ] T025 [HU-39] Implement file summarization in `context-builder.ts` — files >10KB use first 50 lines + last 20 lines instead of full content
- [ ] T026 [HU-39] Ensure `project_memory.md` always included (max priority) and integration-agent (L7) gets at least summary from every layer

- [ ] T027 [HU-36] Create tests in `apps/api/src/agents/__tests__/base-agent.test.ts` — persist messages, reconstruct from DB, verify round-trip with tool_use blocks
- [ ] T028 [HU-39] Create tests in `apps/api/src/agents/__tests__/context-builder.test.ts` — token budget prioritization, file summarization, project_memory injection

**Checkpoint**: Messages persist turno a turno, project_memory se genera y acumula, checkpoint granular por createFile, context-builder prioriza inteligentemente. Crash recovery verificado: kill worker mid-layer, restart, conversación reconstruida.

---

## Phase 3: Agent Parallelism (Mejora 1 — Sprint 6)

**Purpose**: Ejecutar pares independientes en paralelo (QA||Security, Docs||Deploy)

- [ ] T029 [P] [HU-29] Create `apps/api/src/agents/dependency-graph.ts` — typed graph with nodes declaring `dependsOn: number[]`. Implement `getNextLayers(completed: Set<number>): LayerDef[]`
- [ ] T030 [P] [HU-29] Create tests in `apps/api/src/agents/__tests__/dependency-graph.test.ts` — sequential resolution, parallel resolution (L4||L4.5 when L3 done, L5||L6 when L4+L4.5 done), cycle detection, empty graph

- [ ] T031 [P] [HU-30] Modify `apps/api/src/agents/orchestrator.ts` — replace `for (const layerDef of LAYERS)` with graph-driven execution: `while (pending layers) { next = getNextLayers(); Promise.all(next.map(runAgent)); markCompleted(); }`
- [ ] T032 [P] [HU-30] Modify `apps/api/src/agents/context-builder.ts` — change `layer < currentLayer` to `layer in completedLayers` for parallel-safe context injection
- [ ] T033 [HU-30] Implement AbortController per parallel pair — if one fails, signal abort to the other (cancel gracefully within 5s)
- [ ] T034 [HU-30] Modify progress calculation in orchestrator — each parallel layer contributes proportional weight (e.g., L4 = 11%, L4.5 = 11% when running in parallel)

- [ ] T035 [P] [HU-31] Modify `apps/api/src/websocket/ws.emitter.ts` — support multiple simultaneous `agent:status { status: working }` events
- [ ] T036 [HU-31] Verify agent_logs timestamps ordering for parallel agents (distinct log entries with correct createdAt)
- [ ] T037 [HU-31] Modify pause logic in orchestrator — `project:pause` cancels both parallel agents gracefully via AbortController
- [ ] T038 [HU-31] Modify retry logic in orchestrator — retry only the failed parallel layer (not its pair if already completed)

- [ ] T039 [HU-30] Update orchestrator tests — parallel execution, abort on failure, progress calculation with parallel layers
- [ ] T040 [HU-31] Integration test: start pipeline → verify L4+L4.5 run in parallel (overlapping timestamps) → verify L5+L6 run in parallel

**Checkpoint**: Pipeline runs 7 effective steps instead of 9. QA and Security execute in parallel. Docs and Deploy execute in parallel. Pause/Retry work correctly with parallel layers.

---

## Phase 4: HU Certification (Mejora 4 — Sprint 6)

**Purpose**: Trazabilidad criterio→test, quality gate, certification report

- [ ] T041 [P] [HU-40] Create `apps/api/src/agents/criteria-extractor.ts` — function `extractCriteria(specContent: string): CriteriaMap`. Parse `### HU-XX — Nombre` + `- [ ] criterio` checkboxes. Assign IDs: `HU-14.CA-01`
- [ ] T042 [P] [HU-40] Create tests in `apps/api/src/agents/__tests__/criteria-extractor.test.ts` — fixtures with real specs (M1 auth spec, M4 agent-runner spec). Verify ID assignment, missing criteria warning, malformed HU handling

- [ ] T043 [P] [HU-41] Modify `skills/qa-agent/task.md` — add explicit instruction: "Generate `test-mapping.json` as last file before taskComplete with format: `{ mappings: [{ criteriaId, testFile, testName, type }] }`"
- [ ] T044 [P] [HU-41] Modify `apps/api/src/agents/orchestrator.ts` — after L4 (QA) completes, read and parse `test-mapping.json` from project filesystem. Validate with Zod schema.

- [ ] T045 [P] [HU-42] Implement quality gate in `apps/api/src/agents/orchestrator.ts` — `verifyCriteriaCoverage(criteriaMap, testMapping)` returns coverage percentage. If < threshold, re-queue QA with additional prompt listing uncovered criteria
- [ ] T046 [HU-42] Add `CRITERIA_COVERAGE_THRESHOLD` env var (default: 80). Hard limit: max 2 QA re-runs before continuing with warning
- [ ] T047 [HU-42] Emit WebSocket event `quality:gate` with `{ coverage, threshold, passed, uncoveredCriteria }` after gate evaluation
- [ ] T048 [HU-42] Modify `apps/api/src/agents/tool-definitions.ts` — add `test-mapping.json` to known output schemas for validation

- [ ] T049 [P] [HU-43] Create `apps/api/src/agents/certification-report.ts` — function `generateCertificationReport(criteriaMap, testMapping): string` outputs markdown with traceability matrix
- [ ] T050 [P] [HU-43] Modify `skills/integration-agent/task.md` — add instruction to generate `docs/certification.md` including traceability matrix `| HU | Criterio | Test | Archivo | Status |` with statuses: ✅ COVERED, ⚠️ PARTIAL, ❌ MISSING
- [ ] T051 [HU-43] Integration-agent receives `criteriaMap` + `testMapping` as context input (inject via context-builder)

- [ ] T052 [HU-43] Create tests in `apps/api/src/agents/__tests__/certification-report.test.ts` — verify matrix generation, coverage calculation, status assignment
- [ ] T053 Integration test: full pipeline with spec → QA generates test-mapping.json → quality gate passes → certification.md generated with correct matrix

**Checkpoint**: Criteria extracted from spec.md, QA generates test-mapping.json, quality gate blocks if coverage < 80%, certification report generated with full traceability. E2E verified on canary project.

---

## Phase 4.5: Thread Safety (Mejora 5 final — Sprint 6)

**Purpose**: Verificar thread-safety del SDK Anthropic para ejecución paralela; implementar factory si necesario

- [ ] T069 [P] [HU-46] Create test in `apps/api/src/agents/__tests__/anthropic-client.test.ts` — execute 2 simultaneous `client.messages.create()` calls on the same singleton. Verify both return valid responses without corruption or deadlock
- [ ] T070 [HU-46] If singleton test fails: extract `getAnthropicClient()` to `apps/api/src/lib/anthropic-client.ts` as `createAnthropicClient()` factory that returns new instance per agent. Update orchestrator to pass client per agent in parallel mode. If test passes: document decision in `docs/adr/singleton-anthropic-client.md`

**Checkpoint**: SDK concurrency verified. Parallel agents use validated client pattern (singleton or factory).

---

## Phase 2.5: Lifecycle Resilience (Mejora 5 parcial — Sprint 5)

**Purpose**: Graceful shutdown, per-call timeout, memory monitoring — hardening del ciclo de vida del agente

- [ ] T062 [P] [HU-44] Modify `apps/api/src/worker.ts` — register `SIGTERM` and `SIGINT` handlers that set global `shuttingDown = true` flag. Export flag for base-agent access
- [ ] T063 [P] [HU-44] Modify `apps/api/src/agents/base-agent.ts` — check `shuttingDown` before each `client.messages.create()`. If true: persist current `MessageParam[]` to `agent_messages` (Mejora 3), set `agent.status = 'paused'`, return gracefully. Worker waits max 30s before force exit

- [ ] T064 [P] [HU-45] Modify `apps/api/src/agents/base-agent.ts` — wrap each `client.messages.create()` with `AbortController` + `setTimeout(2 * 60 * 1000)`. On timeout: abort, count as 1 attempt of existing 3-retry backoff
- [ ] T065 [HU-45] Add `CLAUDE_CALL_TIMEOUT_MS` env var (default: 120000). Update error message: `"Claude API timeout after 3 attempts (2min each)"`

- [ ] T066 [P] [HU-47] Modify `apps/api/src/agents/base-agent.ts` — record `process.memoryUsage().heapUsed` at agent start and after each turn. If delta > `AGENT_MEMORY_WARN_MB` (default: 200): emit warning to `agent_logs`
- [ ] T067 [HU-47] Implement MessageParam[] truncation in `base-agent.ts` — if heap delta > `AGENT_MEMORY_TRUNCATE_MB` (default: 500): remove first 30% of messages, emit warning. Emit WebSocket `agent:warning` event with `{ type: 'memory', heapMB, deltaMB, turns }`

- [ ] T068 [HU-44] [HU-45] [HU-47] Create/update tests in `apps/api/src/agents/__tests__/base-agent.test.ts` — simulate SIGTERM and verify agent exits with `paused` status; mock hung API call and verify abort in <130s; verify memory warning emission and message truncation

**Checkpoint**: Worker shuts down gracefully (no zombies). Individual Claude calls timeout after 2 min. Memory warnings fire before OOM. All verified with unit tests.

---

## Phase 5: Polish & Validation (Sprints 5–6)

**Purpose**: Lint, build, integration tests, performance benchmarks

- [ ] T054 Run `pnpm --filter @sophia/api lint` — zero violations
- [ ] T055 Run `pnpm --filter @sophia/api build` (`tsc --noEmit`) — zero errors
- [ ] T056 Run `pnpm --filter @sophia/api test` — all tests pass (existing + new)
- [ ] T057 Performance benchmark: measure persist latency per turn (target: < 100ms P99)
- [ ] T058 Performance benchmark: measure pipeline time on 3 canary projects (target: ≤ 35 min average)
- [ ] T059 Update `CHANGELOG.md` with M9 entries
- [ ] T060 Update `docs/context-map.md` with new cross-module dependencies
- [ ] T061 Update `docs/task-tracker.md` with M9 progress

**Checkpoint**: All quality checks passed. Pipeline performance verified. Documentation updated.

---

## Dependencies & Execution Order

- **Phase 1** (Shared Skills): No dependencies — start immediately
- **Phase 2** (Memory): Depends on Phase 1 (output-format.md for memory format)
- **Phase 2.5** (Lifecycle): Depends on Phase 2 (message persistence for graceful shutdown)
- **Phase 3** (Parallelism): Depends on Phase 1 (consistent skills for parallel agents) — *can start in Sprint 6 while Phase 2.5 wraps up*
- **Phase 4** (Certification): Depends on Phase 1 (report format) + Phase 2 (context builder improvements) — *parallel with Phase 3 after Phase 2 completes*
- **Phase 4.5** (Thread Safety): Depends on Phase 3 (parallelism must exist to test concurrency)
- **Phase 5** (Polish): Depends on all previous phases

## Summary

| Phase | Tasks | HUs | Sprint |
|-------|-------|-----|--------|
| Phase 1: Shared Skills | T001–T014 (14 tasks) | HU-32, HU-33, HU-34, HU-35 | 5 |
| Phase 2: Memory Persistence | T015–T028 (14 tasks) | HU-36, HU-37, HU-38, HU-39 | 5 |
| Phase 2.5: Lifecycle Resilience | T062–T068 (7 tasks) | HU-44, HU-45, HU-47 | 5 |
| Phase 3: Agent Parallelism | T029–T040 (12 tasks) | HU-29, HU-30, HU-31 | 6 |
| Phase 4: HU Certification | T041–T053 (13 tasks) | HU-40, HU-41, HU-42, HU-43 | 6 |
| Phase 4.5: Thread Safety | T069–T070 (2 tasks) | HU-46 | 6 |
| Phase 5: Polish & Validation | T054–T061 (8 tasks) | — | 5–6 |
| **Total** | **70 tasks** | **19 HUs** | **2 sprints** |
