# M10: Superpowers Pipeline Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [X]`) syntax for tracking. Use superpowers:test-driven-development for all implementation tasks. Use superpowers:verification-before-completion at each phase checkpoint.

**Goal:** Six improvements to Sophia's generation pipeline, replicating Superpowers methodology internally: spec-agent intelligence (ambiguity detection + brainstorming), execution plan generation (layer 0 planner), TDD enforcement with test contracts, post-layer verification checkpoints, diagnostic QA retries with investigation reports, and advanced crash recovery with auto-resume.

**Architecture:** Add planner-agent as Layer 0 before DBA. Rewrite spec-agent with 3-phase generation (ambiguity → brainstorm → spec). Add batch-verifier post-layer. Enhance quality gate with diagnostic context. Persist pipeline state atomically for crash recovery. New WebSocket events for plan, checkpoints, and recovery.

**Tech Stack:** TypeScript 5.x, Node.js 22, Fastify, Prisma ORM, Anthropic SDK (tool use), BullMQ, @fastify/websocket, PostgreSQL 16, Redis 7, Vitest, Next.js 15

**Reference Spec:** `specs/010-m10-pipeline-improvements/spec.md` (business requirements, acceptance criteria, HU definitions)

---

## Architectural Decisions

- **AD-01**: Spec-agent phases (ambiguity → brainstorm → spec) executed as 3 sequential tool-use loops within the same agent conversation, not 3 separate agents — preserves conversational context between phases
- **AD-02**: Planner-agent uses claude-sonnet (not opus) — planning is simpler than code generation, saves tokens + time
- **AD-03**: Test contracts are Markdown (not JSON Schema) — easier for LLMs to both generate and consume; validated structurally by integration-agent
- **AD-04**: `verifyBatchOutput()` is a pure TypeScript function (no Claude call) — fast validation using filesystem checks, not AI-based review
- **AD-05**: PipelineState is a new Prisma model (not a column on Project) — separates concerns, allows multiple pipeline runs per project
- **AD-06**: TDD skill injected only into backend-agent and frontend-agent — DBA, Seed, Docs, Deploy, Security don't write tests
- **AD-07**: Investigation report triggered only after MAX_QA_RERUNS exhausted — not on first failure to avoid unnecessary token spend

## Data Model

New table `pipeline_states`:

```prisma
model PipelineState {
  id              String   @id @default(uuid())
  projectId       String   @map("project_id")
  status          String   @default("running") // running | completed | interrupted | failed
  currentLayer    Float    @default(0) @map("current_layer")
  completedLayers Json     @default("[]") @map("completed_layers") // Float[]
  startedAt       DateTime @default(now()) @map("started_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([projectId])
  @@map("pipeline_states")
}
```

New table `verification_checkpoints`:

```prisma
model VerificationCheckpoint {
  id        String   @id @default(uuid())
  projectId String   @map("project_id")
  layer     Float
  status    String   // pass | warn | fail
  details   Json     @default("[]") // VerificationDetail[]
  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, layer])
  @@map("verification_checkpoints")
}
```

## Dependencies Between Phases

```
Phase 1 (Spec-Agent Intelligence) → Phase 2 (Plan Generation) → Phase 3 (TDD)
                                                                       ↓
Phase 4 (Verification Checkpoints) ← depends on Phase 2 (plan needed for verification)
                                                                       ↓
Phase 5 (QA Diagnostic Retry) ← independent, but best after Phase 3+4
                                                                       ↓
Phase 6 (Pipeline Resilience) ← Phase 4 needed for resume verification
```

---

## Phase 1: Spec-Agent Intelligence (Sprint 7 — HU-48, HU-49)

**Purpose:** Rewrite spec-agent to detect ambiguities and brainstorm architectural approaches before generating spec output. New artifacts: `ambiguities.md`, `brainstorm.md`.

### Task 1: Rewrite spec-agent system.md with ambiguity detection

**Files:**
- Modify: `skills/spec-agent/system.md`

**Acceptance criteria (from HU-48):**
- Add "## Fase 0: Detección de Ambigüedades" section
- Instruct agent to scan description for vague terms, undefined scope, missing constraints
- Output format: `### Ambigüedad N` + `Término`, `Interpretación elegida`, `Alternativas descartadas`, `Justificación`
- If no ambiguities: generate file with "No se detectaron ambigüedades"

- [ ] Read current `skills/spec-agent/system.md` (~50 lines)
- [ ] Rewrite with 3-phase structure: Fase 0 (ambiguity) → Fase 1 (brainstorm) → Fase 2 (spec generation)
- [ ] Add ambiguity detection instructions with output format and examples
- [ ] Commit: `feat(M10-T001): rewrite spec-agent system.md with ambiguity detection`

### Task 2: Add brainstorming phase to spec-agent

**Files:**
- Modify: `skills/spec-agent/system.md` (already modified in T1)

**Acceptance criteria (from HU-49):**
- "## Fase 1: Brainstorming" section with architectural exploration
- Output: `### Decisión N: [tema]` + table `| Enfoque | Pros | Cons | Seleccionado |`
- Minimum 2 alternatives per major decision, max 5 decisions

- [ ] Add Fase 1 brainstorming section with pros/cons table format
- [ ] Add constraints: max 5 decisions, min 2 approaches each, max 3000 tokens total
- [ ] Verify full system.md is coherent and under 6000 tokens
- [ ] Commit: `feat(M10-T002): add brainstorming phase to spec-agent`

### Task 3: Create spec-agent task.md

**Files:**
- Create: `skills/spec-agent/task.md`

**Note:** Currently spec-agent has NO task.md. The task prompt is built entirely by context-builder.

- [ ] Create `skills/spec-agent/task.md` with template markers: `{{SPEC}}`, `{{FILES_LIST}}`
- [ ] Include sections for ambiguities.md, brainstorm.md, spec.md, data-model.md, api-design.md output
- [ ] Commit: `feat(M10-T003): create spec-agent task.md template`

### Task 4: Update context-builder to inject ambiguities.md and brainstorm.md

**Files:**
- Modify: `apps/api/src/agents/context-builder.ts` (~240 lines)

**Acceptance criteria (from HU-48, HU-49):**
- Inject `ambiguities.md` after spec.md for all layers ≥ 1
- Inject `brainstorm.md` after ambiguities.md for all layers ≥ 1

- [ ] Write failing test: `buildTaskPrompt()` with ambiguities.md present → verify injected in output
- [ ] Write failing test: `buildTaskPrompt()` with brainstorm.md present → verify injected in output
- [ ] Implement reading `spec/ambiguities.md` and `spec/brainstorm.md` from projectDir
- [ ] Inject after spec content, before project memory, with header `## Ambiguities` / `## Brainstorm`
- [ ] Run tests — verify GREEN
- [ ] Commit: `feat(M10-T004): inject ambiguities.md and brainstorm.md into agent context`

### Task 5: Update orchestrator for spec-agent new artifacts

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts` (~520 lines)

- [ ] Ensure `runLayer()` persists `ambiguities.md` and `brainstorm.md` as `GeneratedFile` records
- [ ] Add WebSocket events for new artifacts: `agent:artifact` with type `ambiguities` / `brainstorm`
- [ ] Commit: `feat(M10-T005): orchestrator support for spec-agent artifacts`

### Task 6: Tests for spec-agent intelligence

**Files:**
- Create/Modify: `apps/api/src/agents/__tests__/context-builder.test.ts`

- [ ] Test: ambiguities.md missing → no error, context built without it
- [ ] Test: both files present → injected in correct order (ambiguities before brainstorm)
- [ ] Test: files empty → headers still present with empty content
- [ ] Run `pnpm --filter @sophia/api test`
- [ ] Commit: `test(M10-T006): context-builder tests for ambiguities and brainstorm injection`

**Phase 1 Checkpoint:**
- [ ] Run `pnpm --filter @sophia/api lint` — zero violations
- [ ] Run `pnpm --filter @sophia/api build` — zero errors
- [ ] Run `pnpm --filter @sophia/api test` — all tests pass
- [ ] Verify: spec-agent system.md has Fase 0, 1, 2 sections
- [ ] Verify: context-builder injects new artifacts for layers ≥ 1

---

## Phase 2: Plan Generation — Layer 0 (Sprint 7 — HU-50, HU-51)

**Purpose:** Add planner-agent as Layer 0 that generates `execution-plan.md` before the pipeline runs. Dashboard shows plan with progress tracking.

### Task 7: Create planner-agent skills

**Files:**
- Create: `skills/planner-agent/system.md`
- Create: `skills/planner-agent/task.md`

**Acceptance criteria (from HU-50):**
- system.md: role as "strategic planner", output in Spanish, structured plan format
- task.md: template with `{{SPEC}}` marker, output structure per agent

- [ ] Create `skills/planner-agent/system.md` with planning instructions
- [ ] Create `skills/planner-agent/task.md` with `execution-plan.md` template: per-agent sections with Focus, Expected Files, Risks, Critical Dependencies
- [ ] Commit: `feat(M10-T007): create planner-agent skills`

### Task 8: Add Layer 0 to dependency graph

**Files:**
- Modify: `apps/api/src/agents/dependency-graph.ts` (~55 lines)

**Acceptance criteria (from HU-50):**
- New node: `{ layer: 0, type: 'planner-agent', dependsOn: [] }`
- Layer 1 (DBA) now depends on Layer 0

- [ ] Write failing test: `getNextLayers(new Set())` returns only planner (layer 0)
- [ ] Write failing test: `getNextLayers(new Set([0]))` returns DBA (layer 1)
- [ ] Add planner node to AGENT_GRAPH, update DBA dependsOn to `[0]`
- [ ] Run tests — verify GREEN
- [ ] Commit: `feat(M10-T008): add planner-agent as Layer 0 in dependency graph`

### Task 9: Update orchestrator to run planner

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-50):**
- Load planner skills and execute as first layer
- Planner output saved to `projects/{id}/plan/execution-plan.md`

- [ ] Update `runPipeline()` to handle layer 0 naturally through dependency graph (no special case needed)
- [ ] Ensure `runLayer()` loads `planner-agent/system.md` and `planner-agent/task.md`
- [ ] Commit: `feat(M10-T009): orchestrator runs planner-agent as Layer 0`

### Task 10: Inject execution-plan.md into downstream agents

**Files:**
- Modify: `apps/api/src/agents/context-builder.ts`

**Acceptance criteria (from HU-50):**
- `buildTaskPrompt()` injects `plan/execution-plan.md` for all layers ≥ 1

- [ ] Write failing test: `buildTaskPrompt()` with execution-plan.md present → injected after brainstorm
- [ ] Implement reading `plan/execution-plan.md` from projectDir
- [ ] Inject with header `## Execution Plan` after brainstorm section
- [ ] Run tests — verify GREEN
- [ ] Commit: `feat(M10-T010): inject execution-plan.md into agent context`

### Task 11: WebSocket event for plan generation

**Files:**
- Modify: `apps/api/src/websocket/ws.emitter.ts` (~140 lines)

**Acceptance criteria (from HU-51):**
- New event type `plan:generated` with plan content

- [ ] Add `'plan:generated'` to `AgentEventType` union
- [ ] Emit event after planner completes with `{ projectId, planContent }`
- [ ] Commit: `feat(M10-T011): WebSocket plan:generated event`

### Task 12: Frontend — execution plan component

**Files:**
- Create: `apps/web/src/components/projects/execution-plan.tsx`
- Modify: project detail page to include plan section

**Acceptance criteria (from HU-51):**
- Expandable view of execution plan in project detail
- Each agent section marked complete when agent finishes
- Plan persists on page reload

- [ ] Create `execution-plan.tsx` component with collapsible agent sections
- [ ] Wire `plan:generated` WebSocket event to update store
- [ ] Mark agent sections as completed when `agent:completed` events arrive
- [ ] Commit: `feat(M10-T012): execution plan dashboard component`

### Task 13: Tests for plan generation flow

**Files:**
- Modify: `apps/api/src/agents/__tests__/dependency-graph.test.ts`
- Modify: `apps/api/src/agents/__tests__/orchestrator.test.ts`

- [ ] Test: full graph resolution with layer 0 → correct execution order
- [ ] Test: planner output persisted as GeneratedFile
- [ ] Test: execution-plan.md injected in layer 1+ context
- [ ] Run `pnpm --filter @sophia/api test`
- [ ] Commit: `test(M10-T013): plan generation integration tests`

**Phase 2 Checkpoint:**
- [ ] Run `pnpm --filter @sophia/api lint` — zero violations
- [ ] Run `pnpm --filter @sophia/api build` — zero errors
- [ ] Run `pnpm --filter @sophia/api test` — all tests pass
- [ ] Run `pnpm --filter @sophia/web lint` — zero violations
- [ ] Run `pnpm --filter @sophia/web build` — zero errors
- [ ] Verify: `getNextLayers(new Set())` returns `[{ layer: 0, type: 'planner-agent' }]`
- [ ] Verify: execution-plan.md injected into all downstream agents

---

## Phase 3: TDD Enforcement (Sprint 7 — HU-52, HU-53)

**Purpose:** Create TDD shared skill and test contracts mechanism. Backend/frontend agents write tests before implementation. Seed-agent generates test contracts consumed downstream.

### Task 14: Create TDD shared skill

**Files:**
- Create: `skills/_shared/test-driven-development.md`

**Acceptance criteria (from HU-52):**
- Sections: RED-GREEN-REFACTOR cycle, when to write tests, test file structure, naming conventions
- Under 1000 tokens

- [ ] Create `skills/_shared/test-driven-development.md` with TDD methodology
- [ ] Include: cycle explanation, file naming (`*.test.ts` / `*.spec.ts`), describe/it structure, arrange-act-assert
- [ ] Verify total `_shared/*.md` stays under 4000 tokens
- [ ] Commit: `feat(M10-T014): create TDD shared skill`

### Task 15: Inject TDD skill selectively in orchestrator

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-52):**
- TDD skill injected only for backend-agent (layer 2) and frontend-agent (layer 3)
- `composeSystemPrompt()` accepts optional extra skills per agent type

- [ ] Write failing test: `composeSystemPrompt()` for backend-agent includes TDD skill
- [ ] Write failing test: `composeSystemPrompt()` for dba-agent does NOT include TDD skill
- [ ] Modify `composeSystemPrompt()` to accept `extraSkills?: string[]` parameter
- [ ] In `runLayer()`, pass TDD skill for layers 2 and 3 only
- [ ] Run tests — verify GREEN
- [ ] Commit: `feat(M10-T015): inject TDD skill selectively for code agents`

### Task 16: Update seed-agent to generate test contracts

**Files:**
- Modify: `skills/seed-agent/system.md` (~70 lines)

**Acceptance criteria (from HU-53):**
- Seed-agent generates `test-contracts.md` alongside factories.ts and test-constants.ts
- Contracts define expected TypeScript interfaces, function signatures, expected behaviors per entity

- [ ] Add test-contracts.md generation instructions to `skills/seed-agent/system.md`
- [ ] Define format: `### Entity: [name]` + interfaces + expected CRUD operations + validation rules
- [ ] Commit: `feat(M10-T016): seed-agent generates test-contracts.md`

### Task 17: Inject test contracts into code agents

**Files:**
- Modify: `apps/api/src/agents/context-builder.ts`

**Acceptance criteria (from HU-53):**
- `test-contracts.md` injected into backend-agent (layer 2) and frontend-agent (layer 3)
- Injected after execution-plan.md, before generated files

- [ ] Write failing test: `buildTaskPrompt()` for layer 2 with test-contracts.md → injected
- [ ] Write failing test: `buildTaskPrompt()` for layer 4 (QA) → NOT injected
- [ ] Implement conditional injection for layers 2 and 3
- [ ] Run tests — verify GREEN
- [ ] Commit: `feat(M10-T017): inject test-contracts.md into code agent context`

### Task 18: Tests for TDD enforcement

**Files:**
- Modify: `apps/api/src/agents/__tests__/orchestrator.test.ts`
- Modify: `apps/api/src/agents/__tests__/context-builder.test.ts`

- [ ] Test: TDD skill present in composed prompt for backend-agent
- [ ] Test: TDD skill absent in composed prompt for dba-agent
- [ ] Test: test-contracts.md injected only for layers 2 and 3
- [ ] Run `pnpm --filter @sophia/api test`
- [ ] Commit: `test(M10-T018): TDD enforcement tests`

**Phase 3 Checkpoint:**
- [ ] Run `pnpm --filter @sophia/api lint` — zero violations
- [ ] Run `pnpm --filter @sophia/api build` — zero errors
- [ ] Run `pnpm --filter @sophia/api test` — all tests pass
- [ ] Verify: `_shared/*.md` total < 4000 tokens
- [ ] Verify: TDD skill injected only for backend + frontend agents

---

## Phase 4: Verification Checkpoints (Sprint 7-8 — HU-54, HU-55)

**Purpose:** Add post-layer verification that checks output against execution plan. Emit checkpoint events to dashboard. Block pipeline on critical failures.

### Task 19: Create batch-verifier module

**Files:**
- Create: `apps/api/src/agents/batch-verifier.ts`
- Create: `apps/api/src/agents/__tests__/batch-verifier.test.ts`

**Acceptance criteria (from HU-54):**
- Pure TypeScript function — no Claude calls
- Checks: expected files exist, files not empty, correct extensions, naming conventions

- [ ] Write failing tests: file present → pass, file missing → CRITICAL, file empty → MEDIUM
- [ ] Implement `verifyBatchOutput(layerDef, projectDir, planContent?): VerificationResult`
- [ ] Define `VerificationResult`: `{ status: 'pass'|'warn'|'fail', details: VerificationDetail[] }`
- [ ] Define `VerificationDetail`: `{ severity: 'CRITICAL'|'MEDIUM'|'LOW', message, file? }`
- [ ] Run tests — verify GREEN
- [ ] Commit: `feat(M10-T019): create batch-verifier module`

### Task 20: Integrate verifier into orchestrator

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-54):**
- `verifyBatchOutput()` called after each `runLayer()` completes
- CRITICAL → pause pipeline, MEDIUM/LOW → log warning and continue

- [ ] Call `verifyBatchOutput()` in `runLayer()` after agent completes, before emitting `agent:completed`
- [ ] If critical failure: set project status to `paused`, emit `project:paused` with verification details
- [ ] If warn: log warning, continue pipeline
- [ ] Commit: `feat(M10-T020): integrate batch-verifier into orchestrator`

### Task 21: Persist verification checkpoints

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (~300 lines)

**Acceptance criteria (from HU-55):**
- New `VerificationCheckpoint` model (see Data Model section)
- Relation to Project

- [ ] Add `VerificationCheckpoint` model to schema.prisma
- [ ] Add `verificationCheckpoints` relation to Project model
- [ ] Run `pnpm db:migrate` — migration applied
- [ ] Commit: `feat(M10-T021): add VerificationCheckpoint model`

### Task 22: WebSocket checkpoint events

**Files:**
- Modify: `apps/api/src/websocket/ws.emitter.ts`

**Acceptance criteria (from HU-55):**
- New event `checkpoint:result` with layer, status, details

- [ ] Add `'checkpoint:result'` to `AgentEventType` union
- [ ] Emit after `verifyBatchOutput()` with `{ layer, status, details }`
- [ ] Commit: `feat(M10-T022): WebSocket checkpoint:result event`

### Task 23: Frontend — checkpoint indicators

**Files:**
- Create: `apps/web/src/components/projects/checkpoint-indicator.tsx`
- Modify: pipeline canvas/dashboard to show indicators

**Acceptance criteria (from HU-55):**
- Green/yellow/red indicator per layer in pipeline view
- Tooltip with verification details

- [ ] Create `checkpoint-indicator.tsx` with status badge (pass=green, warn=yellow, fail=red)
- [ ] Wire `checkpoint:result` WebSocket event to update pipeline canvas
- [ ] Add tooltip/popover with verification details on hover
- [ ] Commit: `feat(M10-T023): checkpoint indicators in dashboard`

### Task 24: Verification checkpoint tests

**Files:**
- Modify: `apps/api/src/agents/__tests__/batch-verifier.test.ts`
- Modify: `apps/api/src/agents/__tests__/orchestrator.test.ts`

- [ ] Test: verifier with plan → expected files validated against plan
- [ ] Test: verifier without plan → basic structural validation only
- [ ] Test: orchestrator pauses on CRITICAL verification failure
- [ ] Test: orchestrator continues on MEDIUM/LOW warnings
- [ ] Run `pnpm --filter @sophia/api test`
- [ ] Commit: `test(M10-T024): verification checkpoint integration tests`

**Phase 4 Checkpoint:**
- [ ] Run `pnpm --filter @sophia/api lint` — zero violations
- [ ] Run `pnpm --filter @sophia/api build` — zero errors
- [ ] Run `pnpm --filter @sophia/api test` — all tests pass
- [ ] Run `pnpm --filter @sophia/web lint` — zero violations
- [ ] Run `pnpm --filter @sophia/web build` — zero errors
- [ ] Verify: checkpoint persistido en BD after each layer
- [ ] Verify: dashboard shows checkpoint indicators

---

## Phase 5: QA Diagnostic Retry (Sprint 8 — HU-56, HU-57)

**Purpose:** Enhance quality gate retry with diagnostic context. Generate investigation report when all retries exhausted.

### Task 25: Create investigating-test-failures shared skill

**Files:**
- Create: `skills/_shared/investigating-test-failures.md`

- [ ] Create skill with sections: systematic diagnosis process, common failure patterns, report format
- [ ] Keep under 800 tokens
- [ ] Verify total `_shared/*.md` stays under 5000 tokens
- [ ] Commit: `feat(M10-T025): create investigating-test-failures shared skill`

### Task 26: Enhance enforceQaQualityGate with diagnostic context

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-56):**
- Extract uncovered criteria from QA result
- Build diagnostic retry prompt with specific failure context

- [ ] Write failing test: QA result with 60% coverage → retry prompt includes specific missing criteria names
- [ ] Modify `enforceQaQualityGate()` to extract missing criteria from `verifyCriteriaCoverage()` result
- [ ] Build `buildDiagnosticRetryPrompt()` with: uncovered criteria list, failed test details, files involved
- [ ] Inject investigating-test-failures skill into QA retry prompt
- [ ] Run tests — verify GREEN
- [ ] Commit: `feat(M10-T026): diagnostic context in QA retry prompt`

### Task 27: Update qa-agent for investigation reports

**Files:**
- Modify: `skills/qa-agent/system.md` (~40 lines)

**Acceptance criteria (from HU-57):**
- QA-agent knows how to generate `investigation-report.md` when instructed in retry
- Report format: uncovered criteria, hypothesized root causes, suspicious files, recommendations

- [ ] Add "## Investigation Mode" section to qa-agent system.md
- [ ] Define report format: `### Criterio no cubierto: [name]` + `Hipótesis`, `Archivos sospechosos`, `Recomendación`
- [ ] Commit: `feat(M10-T027): qa-agent investigation report capability`

### Task 28: Generate investigation report on max retries

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-57):**
- When MAX_QA_RERUNS exhausted, persist `investigation-report.md` in project
- Emit WebSocket event

- [ ] After final retry fails: read QA output, save `projects/{id}/qa/investigation-report.md`
- [ ] Add `'qa:investigation-report'` to AgentEventType in ws.emitter.ts
- [ ] Emit event with report path and summary
- [ ] Commit: `feat(M10-T028): generate investigation report on QA exhaustion`

### Task 29: Tests for diagnostic retry flow

**Files:**
- Modify: `apps/api/src/agents/__tests__/orchestrator.test.ts`

- [ ] Test: QA retry prompt includes missing criteria from previous attempt
- [ ] Test: after MAX_QA_RERUNS, investigation-report.md created
- [ ] Test: investigating-test-failures skill injected in retry prompts
- [ ] Run `pnpm --filter @sophia/api test`
- [ ] Commit: `test(M10-T029): QA diagnostic retry tests`

**Phase 5 Checkpoint:**
- [ ] Run `pnpm --filter @sophia/api lint` — zero violations
- [ ] Run `pnpm --filter @sophia/api build` — zero errors
- [ ] Run `pnpm --filter @sophia/api test` — all tests pass
- [ ] Verify: retry prompt contains diagnostic context (not generic "improve coverage")
- [ ] Verify: investigation report generated when QA exhausts retries

---

## Phase 6: Pipeline Resilience — Crash Recovery (Sprint 8 — HU-58, HU-59)

**Purpose:** Persist pipeline state atomically for crash recovery. Auto-detect interrupted pipelines on worker start. Dashboard offers resume.

### Task 30: Add PipelineState model to Prisma schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

**Acceptance criteria (from HU-58):**
- New `PipelineState` model (see Data Model section)
- Relation to Project model

- [ ] Add `PipelineState` model to schema.prisma with all fields
- [ ] Add `pipelineStates` relation to Project model
- [ ] Run `pnpm db:migrate` — migration applied
- [ ] Commit: `feat(M10-T030): add PipelineState model`

### Task 31: Persist pipeline state in orchestrator

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-58):**
- Create PipelineState record at pipeline start
- Update currentLayer + completedLayers atomically after each layer
- Set status to completed/failed at pipeline end

- [ ] Write failing test: pipeline start → PipelineState created with status `running`
- [ ] Write failing test: layer complete → PipelineState.completedLayers updated
- [ ] Write failing test: pipeline done → PipelineState.status = `completed`
- [ ] Implement `createPipelineState()`, `updateLayerCompleted()`, `completePipeline()` in orchestrator
- [ ] Run tests — verify GREEN
- [ ] Commit: `feat(M10-T031): persist pipeline state transitions`

### Task 32: Create pipeline-recovery module

**Files:**
- Create: `apps/api/src/agents/pipeline-recovery.ts`
- Create: `apps/api/src/agents/__tests__/pipeline-recovery.test.ts`

**Acceptance criteria (from HU-59):**
- Detect interrupted pipelines: status=running + updatedAt > 5min ago
- Mark as `interrupted`
- Provide resume function that continues from last completed layer

- [ ] Write failing test: PipelineState running + old → detected as interrupted
- [ ] Write failing test: PipelineState running + recent → NOT flagged (still active)
- [ ] Implement `detectInterruptedPipelines(): InterruptedPipeline[]`
- [ ] Implement `resumePipeline(projectId): void` that calls `runPipeline()` with `startFromLayer`
- [ ] Run tests — verify GREEN
- [ ] Commit: `feat(M10-T032): pipeline-recovery detection and resume`

### Task 33: Integrate recovery into worker startup

**Files:**
- Modify: `apps/api/src/worker.ts` or worker entry point

**Acceptance criteria (from HU-59):**
- On worker start, call `detectInterruptedPipelines()`
- Emit `pipeline:interrupted` events for each detected pipeline

- [ ] Add recovery check to worker initialization
- [ ] Emit WebSocket events for interrupted pipelines
- [ ] Log interrupted pipelines count on startup
- [ ] Commit: `feat(M10-T033): detect interrupted pipelines on worker start`

### Task 34: Add resume endpoint

**Files:**
- Modify: `apps/api/src/modules/projects/projects.routes.ts`
- Modify: `apps/api/src/modules/projects/projects.controller.ts`
- Modify: `apps/api/src/modules/projects/projects.service.ts`

**Acceptance criteria (from HU-59):**
- `POST /api/projects/:id/resume` triggers pipeline resume from last checkpoint
- Returns 409 if pipeline not in `interrupted` state

- [ ] Add route `POST /api/projects/:id/resume`
- [ ] Implement controller + service: validate state, enqueue resume job
- [ ] Commit: `feat(M10-T034): POST /api/projects/:id/resume endpoint`

### Task 35: WebSocket events for pipeline recovery

**Files:**
- Modify: `apps/api/src/websocket/ws.emitter.ts`

- [ ] Add `'pipeline:interrupted'` and `'pipeline:resumed'` to AgentEventType
- [ ] Emit `pipeline:interrupted` with `{ projectId, lastCompletedLayer, interruptedAt }`
- [ ] Emit `pipeline:resumed` with `{ projectId, resumeFromLayer }`
- [ ] Commit: `feat(M10-T035): WebSocket pipeline recovery events`

### Task 36: Frontend — pipeline recovery UI

**Files:**
- Create: `apps/web/src/components/projects/pipeline-recovery.tsx`
- Modify: project detail page

**Acceptance criteria (from HU-59):**
- Show "Pipeline Interrupted" banner for interrupted projects
- "Resume Pipeline" button that calls resume endpoint
- Progress indicator showing which layers completed before interruption

- [ ] Create `pipeline-recovery.tsx` with interrupted banner + resume button
- [ ] Wire to WebSocket `pipeline:interrupted` event
- [ ] Call `POST /api/projects/:id/resume` on button click
- [ ] Show progress of completed layers
- [ ] Commit: `feat(M10-T036): pipeline recovery UI component`

### Task 37: Resume integration with batch-verifier

**Files:**
- Modify: `apps/api/src/agents/pipeline-recovery.ts`

- [ ] Before resuming, run `verifyBatchOutput()` on last completed layer to ensure integrity
- [ ] If verification fails, flag to user instead of auto-resuming
- [ ] Commit: `feat(M10-T037): verify integrity before pipeline resume`

### Task 38: Pipeline resilience tests

**Files:**
- Modify: `apps/api/src/agents/__tests__/pipeline-recovery.test.ts`
- Modify: `apps/api/src/agents/__tests__/orchestrator.test.ts`

- [ ] Test: pipeline state created at start, updated per layer, completed at end
- [ ] Test: interrupted detection with time threshold
- [ ] Test: resume continues from correct layer
- [ ] Test: resume with verification failure → does not auto-resume
- [ ] Run `pnpm --filter @sophia/api test`
- [ ] Commit: `test(M10-T038): pipeline resilience integration tests`

**Phase 6 Checkpoint:**
- [ ] Run `pnpm --filter @sophia/api lint` — zero violations
- [ ] Run `pnpm --filter @sophia/api build` — zero errors
- [ ] Run `pnpm --filter @sophia/api test` — all tests pass
- [ ] Run `pnpm --filter @sophia/web lint` — zero violations
- [ ] Run `pnpm --filter @sophia/web build` — zero errors
- [ ] Verify: pipeline state persisted and updated per layer
- [ ] Verify: interrupted pipelines detected on worker restart
- [ ] Verify: resume works from correct checkpoint

---

## Final Verification (Sprint 8)

### Task 39: Full integration test

- [ ] Run complete pipeline with new layer 0 → verify all 10 agents execute in order
- [ ] Verify: ambiguities.md + brainstorm.md + execution-plan.md + test-contracts.md generated
- [ ] Verify: checkpoints pass for each layer
- [ ] Verify: TDD skill injected only for layers 2 and 3

### Task 40: Update documentation

- [ ] Update `CLAUDE.md` — add M10 to Estado Actual table
- [ ] Update `docs/task-tracker.md` with M10 count
- [ ] Update `CHANGELOG.md` with v0.10.0 entry
- [ ] Update `docs/context-map.md` with M10 file references
- [ ] Bump `package.json` version to v0.10.0

### Task 41: Final quality gate

- [ ] Run `pnpm --filter @sophia/api lint` — zero violations
- [ ] Run `pnpm --filter @sophia/api build` — zero errors
- [ ] Run `pnpm --filter @sophia/api test` — all tests pass
- [ ] Run `pnpm --filter @sophia/web lint` — zero violations
- [ ] Run `pnpm --filter @sophia/web build` — zero errors
- [ ] Commit: `docs(M10): update documentation and bump v0.10.0`
