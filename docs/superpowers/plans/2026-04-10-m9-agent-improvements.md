# M9: Agent System Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [X]`) syntax for tracking. Use superpowers:test-driven-development for all implementation tasks. Use superpowers:verification-before-completion at each phase checkpoint.

**Goal:** Five structural improvements to the agent system — shared skills, persistent memory, parallel execution, HU certification, and lifecycle resilience — reducing pipeline time by 22%, eliminating context loss, and guaranteeing requirement→test traceability.

**Architecture:** Replace sequential 9-layer pipeline with a dependency graph that enables parallel execution (QA‖Security, Docs‖Deploy). Persist Claude conversation turn-by-turn to PostgreSQL for crash recovery. Compose agent prompts from shared skills + agent-specific skills. Add quality gate post-QA with criteria→test mapping. Harden worker lifecycle with graceful shutdown, per-call timeouts, and memory monitoring.

**Tech Stack:** TypeScript 5.x, Node.js 22, Fastify, Prisma ORM, Anthropic SDK (tool use), BullMQ, @fastify/websocket, PostgreSQL 16, Redis 7, Vitest

**Reference Spec:** `specs/009-m9-improvements/spec.md` (business requirements, acceptance criteria, HU definitions)

---

## Architectural Decisions

- **AD-01**: Dependency graph with `dependsOn[]` per node (not `canParallelWith` on LAYERS array) — extensible to any topology
- **AD-02**: Fire-and-forget async persistence (not blocking Tool Use loop) — avoids 5s cumulative latency over 50 turns
- **AD-03**: QA re-run max 2× then continue with warning (not permanent pipeline block) — resilient to ambiguous criteria
- **AD-04**: Markdown concatenation for shared skills (not `{{include}}` templates) — Claude doesn't process includes; order = priority

## Data Model

New table `agent_messages`:

```prisma
model AgentMessage {
  id        String   @id @default(uuid())
  agentId   String   @map("agent_id")
  projectId String   @map("project_id")
  turn      Int      @map("turn_number")
  role      String   // "user" | "assistant"
  content   Json     // JSONB — MessageParam content
  tokens    Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  agent   Agent   @relation(fields: [agentId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([agentId, turn])
  @@index([projectId])
  @@map("agent_messages")
}
```

## Dependencies Between Phases

```
Phase 1 (no deps) → Phase 2 → Phase 2.5 → Phase 3 ─→ Phase 4.5 → Phase 5
                                              ↘              ↗
                                          Phase 4 ──────────┘
```

---

## Phase 1: Shared Skills (Sprint 5 — HU-32, HU-33, HU-34, HU-35)

**Purpose:** Create `skills/_shared/` with 3 shared documents. Refactor 9 agent `system.md` to eliminate duplications. Update orchestrator to compose prompts.

### Task 1: Create shared conventions

**Files:**
- Create: `skills/_shared/conventions.md`

**Acceptance criteria (from HU-32):**
- Naming (PascalCase, camelCase, snake_case), file paths, response formats `{ data }` / `{ error }`
- Section "Artefactos por Capa" listing expected outputs of each layer (HU-35)
- Header `# Shared Skill: Conventions` with clear bullet sections

- [X] Write `skills/_shared/conventions.md` with naming conventions, file paths, response formats, and per-layer artifact list
- [X] Verify document follows bullet-point structure with clear sections
- [X] Commit: `feat(M9): create shared conventions skill`

### Task 2: Create shared anti-patterns

**Files:**
- Create: `skills/_shared/anti-patterns.md`

**Acceptance criteria (from HU-32):**
- Prohibitions categorized by domain: backend (no .repository.ts, no secrets in code, no Float for money), frontend (no localStorage tokens, no any, no fetch without credentials), security (no plain text passwords, no CORS wildcard), DB (no soft delete, UUID for PKs)

- [X] Write `skills/_shared/anti-patterns.md` with domain-categorized prohibitions
- [X] Commit: `feat(M9): create shared anti-patterns skill`

### Task 3: Create shared output format

**Files:**
- Create: `skills/_shared/output-format.md`

**Acceptance criteria (from HU-32, HU-34):**
- Standard `taskComplete` format (summary + filesCreated)
- Unified severity levels: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`
- Tabular report format: `| # | Severity | Component | Finding | Remediation |`

- [X] Write `skills/_shared/output-format.md` with taskComplete format, unified severities, report structure
- [X] Commit: `feat(M9): create shared output-format skill`

### Task 4: Validate shared skills token count

**Files:**
- Read: `skills/_shared/conventions.md`, `skills/_shared/anti-patterns.md`, `skills/_shared/output-format.md`

- [X] Measure total token count of all 3 `_shared/*.md` files (target: < 3000 tokens)
- [X] If over budget, trim content while preserving all critical rules
- [X] Commit if changes needed: `fix(M9): trim shared skills to token budget`

### Task 5: Refactor dba-agent and seed-agent system.md

**Files:**
- Modify: `skills/dba-agent/system.md`
- Modify: `skills/seed-agent/system.md`

- [X] Remove duplicated Tool Use instructions and naming conventions from both files (target: -30% size each)
- [X] Verify no agent-specific instructions are accidentally removed
- [X] Commit: `refactor(M9): extract shared content from dba + seed system.md`

### Task 6: Refactor backend-agent and frontend-agent system.md

**Files:**
- Modify: `skills/backend-agent/system.md`
- Modify: `skills/frontend-agent/system.md`

- [X] Remove Tool Use instructions, naming conventions, response format duplicates (target: -30% each)
- [X] Commit: `refactor(M9): extract shared content from backend + frontend system.md`

### Task 7: Refactor qa-agent system.md and task.md

**Files:**
- Modify: `skills/qa-agent/system.md`
- Modify: `skills/qa-agent/task.md`

**Acceptance criteria (from HU-33, HU-35):**
- Remove Tool Use duplicates from system.md
- Add reference to `factories.ts` and `test-constants.ts` from seed-agent in task.md

- [X] Remove duplicates from `skills/qa-agent/system.md`
- [X] Add seed artifact references in `skills/qa-agent/task.md`
- [X] Commit: `refactor(M9): extract shared content from qa-agent, add seed refs`

### Task 8: Refactor security-agent and integration-agent

**Files:**
- Modify: `skills/security-agent/system.md`
- Modify: `skills/integration-agent/system.md`
- Modify: `skills/integration-agent/task.md`

**Acceptance criteria (from HU-33, HU-34, HU-35):**
- Security-agent adopts unified severity enum (removes duplicate)
- Integration-agent maps `BROKEN→CRITICAL`, `MISMATCH→HIGH`, `MISSING→MEDIUM`, `OK→INFO`
- Integration-agent task.md gets explicit file list to validate per layer

- [X] Refactor `skills/security-agent/system.md` — adopt unified severity from `output-format.md`
- [X] Refactor `skills/integration-agent/system.md` — adopt unified severity mapping
- [X] Update `skills/integration-agent/task.md` — add explicit file list per layer
- [X] Commit: `refactor(M9): unify severity format in security + integration agents`

### Task 9: Refactor docs-agent and deploy-agent system.md

**Files:**
- Modify: `skills/docs-agent/system.md`
- Modify: `skills/deploy-agent/system.md`

- [X] Remove Tool Use and naming duplicates from both files (target: -30% each)
- [X] Commit: `refactor(M9): extract shared content from docs + deploy system.md`

### Task 10: Implement composeSystemPrompt in orchestrator

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-33):**
- Load `_shared/*.md` once at pipeline start (not per layer)
- Compose: `[shared conventions] + [shared anti-patterns] + [shared output-format] + [agent system.md]`
- Function `composeSystemPrompt(sharedSkills: string[], agentSystemMd: string): string`

- [X] Write failing test for `composeSystemPrompt()` verifying composition order and no duplicated instructions
- [X] Implement `composeSystemPrompt()` in orchestrator
- [X] Run tests — verify GREEN
- [X] Run `pnpm --filter @sophia/api lint`
- [X] Commit: `feat(M9): implement shared skill composition in orchestrator`

### Task 11: Create orchestrator composition tests

**Files:**
- Create/Modify: `apps/api/src/agents/__tests__/orchestrator.test.ts`

- [X] Write tests: verify shared skills loaded once, composition order correct, agent-specific content preserved
- [X] Run `pnpm --filter @sophia/api test`
- [X] Commit: `test(M9): add orchestrator composition tests`

**Phase 1 Checkpoint:**
- [X] Run `pnpm --filter @sophia/api lint` — zero violations
- [X] Run `pnpm --filter @sophia/api build` — zero errors
- [X] Run `pnpm --filter @sophia/api test` — all tests pass
- [X] Verify: each of 9 `system.md` files reduced by ≥30%
- [X] Verify: `_shared/*.md` total < 3000 tokens

---

## Phase 2: Memory Persistence (Sprint 5 — HU-36, HU-37, HU-38, HU-39)

**Purpose:** Persist Claude conversation turn-by-turn, generate project memory, implement granular checkpoints, and intelligent context windowing.

### Task 12: Add AgentMessage model to Prisma schema

**Files:**
- Modify: `apps/api/prisma/schema.prisma`

- [X] Add `AgentMessage` model (see Data Model section above) with relations to Agent and Project
- [X] Add `agentMessages` relation fields to existing Agent and Project models
- [X] Commit: `feat(M9): add AgentMessage model to schema`

### Task 13: Run Prisma migration

- [X] Run `pnpm db:migrate` to create `agent_messages` table
- [X] Verify migration applied successfully
- [X] Commit: `feat(M9): migration for agent_messages table`

### Task 14: Implement message persistence in base-agent

**Files:**
- Modify: `apps/api/src/agents/base-agent.ts`

**Acceptance criteria (from HU-36):**
- Persist each MessageParam after Claude response (fire-and-forget async)
- Serialize tool_use blocks and tool_results correctly in JSONB
- Mark messages as `completed` when agent finishes

- [X] Write failing test: persist MessageParam → read from DB → verify round-trip with tool_use blocks
- [X] Implement fire-and-forget persistence after each Claude response in `runAgent()`
- [X] Add `completed` flag logic on agent success
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): persist Claude messages turn-by-turn`

### Task 15: Implement message reconstruction for crash recovery

**Files:**
- Modify: `apps/api/src/agents/base-agent.ts`

**Acceptance criteria (from HU-36):**
- `reconstructMessages(agentId): MessageParam[]` rebuilds from `agent_messages` table
- Used on retry after crash

- [X] Write failing test: insert messages to DB → reconstruct → verify identical to original
- [X] Implement `reconstructMessages()` in base-agent
- [X] Wire into retry flow — if agent has existing messages in DB, reconstruct instead of starting fresh
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): implement message reconstruction for crash recovery`

### Task 16: Implement project memory generation

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-37):**
- After each layer completes, generate memory section (decisions, patterns, constraints)
- Append to `projects/{id}/memory/project_memory.md`
- Format: `## Layer N: [name]\n### Decisions\n- ...\n### Patterns\n- ...\n### Constraints\n- ...`

- [X] Implement memory section generation after layer completion in orchestrator
- [X] Write to filesystem at `projects/{projectId}/memory/project_memory.md`
- [X] Cap at 5000 tokens (summarize older entries if needed)
- [X] Commit: `feat(M9): generate project_memory.md after each layer`

### Task 17: Inject project memory into context-builder

**Files:**
- Modify: `apps/api/src/agents/context-builder.ts`

**Acceptance criteria (from HU-37):**
- Inject `project_memory.md` into agent prompt (after spec, before files)
- Maximum priority — always included

- [X] Modify `buildTaskPrompt()` to read and inject `project_memory.md`
- [X] Ensure it appears after spec content, before generated files
- [X] Commit: `feat(M9): inject project_memory into agent context`

### Task 18: Implement granular checkpoint per createFile

**Files:**
- Modify: `apps/api/src/agents/tool-executor.ts`

**Acceptance criteria (from HU-38):**
- `prisma.generatedFile.upsert()` immediately after each `createFile` (not batched)
- No duplicates if agent writes same path twice (upsert by `projectId + path`)

- [X] Write failing test: createFile → verify generatedFile record exists immediately (not after agent completes)
- [X] Implement upsert in tool-executor after each successful createFile
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): granular checkpoint per createFile`

### Task 19: Support mid-layer recovery in context-builder

**Files:**
- Modify: `apps/api/src/agents/context-builder.ts`

**Acceptance criteria (from HU-38):**
- Read `generated_files` for current layer (not just `layer < current`) for retry scenarios

- [X] Modify file query to support mid-layer recovery
- [X] Commit: `feat(M9): support mid-layer file recovery in context-builder`

### Task 20: Implement token-budget prioritization

**Files:**
- Modify: `apps/api/src/agents/context-builder.ts`

**Acceptance criteria (from HU-39):**
- Replace hard limit of 20 files with 40K token budget
- Priority: task.md references > immediate prior layer > larger files > rest
- Files >10KB use summary (first 50 + last 20 lines)
- `project_memory.md` always included (max priority)
- Integration-agent (L7) gets at least summary from every layer

- [X] Write failing test for token-budget prioritization logic
- [X] Implement prioritization replacing `MAX_CONTEXT_FILES = 20`
- [X] Implement file summarization for files >10KB
- [X] Ensure integration-agent gets cross-layer summaries
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): implement token-budget context prioritization`

### Task 21: Create context-builder tests

**Files:**
- Create: `apps/api/src/agents/__tests__/context-builder.test.ts`

- [X] Write tests: token budget calculation, file prioritization, summarization, project_memory injection
- [X] Run `pnpm --filter @sophia/api test`
- [X] Commit: `test(M9): add context-builder prioritization tests`

### Task 22: Create base-agent persistence tests

**Files:**
- Modify: `apps/api/src/agents/__tests__/base-agent.test.ts`

- [X] Write tests: persist messages, reconstruct from DB, verify round-trip with tool_use blocks, completed flag
- [X] Run `pnpm --filter @sophia/api test`
- [X] Commit: `test(M9): add base-agent persistence tests`

**Phase 2 Checkpoint:**
- [X] Run `pnpm --filter @sophia/api lint` — zero violations
- [X] Run `pnpm --filter @sophia/api build` — zero errors
- [X] Run `pnpm --filter @sophia/api test` — all tests pass
- [X] Verify: messages persist turn-by-turn (check DB)
- [X] Verify: project_memory.md generates and accumulates
- [X] Verify: crash recovery reconstructs conversation

---

## Phase 2.5: Lifecycle Resilience (Sprint 5 — HU-44, HU-45, HU-47)

**Purpose:** Graceful shutdown, per-call timeout, memory monitoring — hardening agent lifecycle.

### Task 23: Implement SIGTERM/SIGINT handlers in worker

**Files:**
- Modify: `apps/api/src/worker.ts`

**Acceptance criteria (from HU-44):**
- Register handlers for `SIGTERM` and `SIGINT`
- Set global `shuttingDown = true` flag, export for base-agent access
- Worker waits max 30s before force exit

- [X] Write failing test: simulate SIGTERM → verify `shuttingDown` flag set
- [X] Implement signal handlers in worker.ts with 30s grace period
- [X] Export `shuttingDown` flag
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): implement graceful shutdown handlers`

### Task 24: Check shuttingDown in base-agent

**Files:**
- Modify: `apps/api/src/agents/base-agent.ts`

**Acceptance criteria (from HU-44):**
- Check `shuttingDown` before each `client.messages.create()`
- If true: persist MessageParam[] and set `agent.status = 'paused'`

- [X] Write failing test: set shuttingDown → verify agent exits with `paused` status and messages persisted
- [X] Implement shutdown check in Tool Use loop
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): graceful agent exit on shutdown signal`

### Task 25: Implement per-call timeout with AbortController

**Files:**
- Modify: `apps/api/src/agents/base-agent.ts`

**Acceptance criteria (from HU-45):**
- Each `client.messages.create()` wrapped with AbortController + 2min timeout
- Timeout counts as 1 attempt of existing 3-retry backoff
- Configurable via `CLAUDE_CALL_TIMEOUT_MS` (default: 120000)

- [X] Write failing test: mock hung API call → verify abort in <130s
- [X] Wrap each Claude call with AbortController + setTimeout
- [X] Add `CLAUDE_CALL_TIMEOUT_MS` env var support
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): per-call Claude API timeout with AbortController`

### Task 26: Implement memory monitoring per agent

**Files:**
- Modify: `apps/api/src/agents/base-agent.ts`

**Acceptance criteria (from HU-47):**
- Record `process.memoryUsage().heapUsed` at agent start and after each turn
- Warning if delta >200MB (`AGENT_MEMORY_WARN_MB`)
- Truncate first 30% of MessageParam[] if delta >500MB (`AGENT_MEMORY_TRUNCATE_MB`)
- Emit WebSocket `agent:warning` event

- [X] Write failing test: verify memory warning emission and message truncation
- [X] Implement memory monitoring in Tool Use loop
- [X] Add env vars `AGENT_MEMORY_WARN_MB` and `AGENT_MEMORY_TRUNCATE_MB`
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): memory monitoring and auto-truncation`

### Task 27: Lifecycle resilience tests

**Files:**
- Modify: `apps/api/src/agents/__tests__/base-agent.test.ts`

- [X] Write comprehensive tests: SIGTERM → paused status, per-call timeout abort, memory warning + truncation
- [X] Run `pnpm --filter @sophia/api test`
- [X] Commit: `test(M9): add lifecycle resilience tests`

**Phase 2.5 Checkpoint:**
- [X] Run `pnpm --filter @sophia/api lint` — zero violations
- [X] Run `pnpm --filter @sophia/api build` — zero errors
- [X] Run `pnpm --filter @sophia/api test` — all tests pass
- [X] Verify: SIGTERM produces `paused` status (not zombie)
- [X] Verify: hung API call aborts within 2min
- [X] Verify: memory warning fires at threshold

---

## Phase 3: Agent Parallelism (Sprint 6 — HU-29, HU-30, HU-31)

**Purpose:** Execute independent layer pairs in parallel (QA‖Security, Docs‖Deploy).

### Task 28: Create dependency graph

**Files:**
- Create: `apps/api/src/agents/dependency-graph.ts`
- Create: `apps/api/src/agents/__tests__/dependency-graph.test.ts`

**Acceptance criteria (from HU-29):**
- Typed graph with nodes declaring `dependsOn: number[]`
- `getNextLayers(completed: Set<number>): LayerDef[]` returns ready layers
- L4 and L4.5 parallel when L3 complete; L5 and L6 parallel when L4+L4.5 complete
- Cycle detection

- [X] Write failing tests: sequential resolution, parallel resolution (L4‖L4.5, L5‖L6), cycle detection, empty graph
- [X] Implement `dependency-graph.ts` with typed nodes and `getNextLayers()`
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): create agent dependency graph`

### Task 29: Refactor orchestrator for graph-driven execution

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-30):**
- Replace `for (const layerDef of LAYERS)` with: `while (pending) { next = getNextLayers(); Promise.all(next.map(runAgent)); markCompleted(); }`
- Progress calculation: each parallel layer contributes proportional weight

- [X] Write failing test: verify parallel execution of L4+L4.5 and L5+L6
- [X] Replace sequential loop with graph-driven `Promise.all()` execution
- [X] Update progress calculation for proportional parallel weights
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): graph-driven parallel orchestrator execution`

### Task 30: Update context-builder for parallel-safe context

**Files:**
- Modify: `apps/api/src/agents/context-builder.ts`

**Acceptance criteria (from HU-30):**
- Change `layer < currentLayer` to `layer in completedLayers` for parallel-safe injection

- [X] Modify context query to use `completedLayers` set instead of `layer < current`
- [X] Write test verifying parallel agents only see completed layers
- [X] Commit: `feat(M9): parallel-safe context injection`

### Task 31: Implement AbortController per parallel pair

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-30):**
- If one parallel agent fails, abort the other (cancel gracefully within 5s)

- [X] Write failing test: one parallel agent fails → other receives abort signal
- [X] Implement shared AbortController per parallel pair
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): abort parallel pair on failure`

### Task 32: WebSocket support for parallel agents

**Files:**
- Modify: `apps/api/src/websocket/ws.emitter.ts`

**Acceptance criteria (from HU-31):**
- Support multiple simultaneous `agent:status { status: working }` events
- Agent logs have correct timestamps for ordering

- [X] Modify WebSocket emitter to emit status for parallel agents
- [X] Verify timestamp ordering in agent_logs
- [X] Commit: `feat(M9): WebSocket parallel agent status events`

### Task 33: Implement pause/retry for parallel agents

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-31):**
- Pause cancels both parallel agents via AbortController
- Retry restarts only the failed layer (not its pair if already completed)

- [X] Write failing tests: pause cancels both agents, retry only restarts failed one
- [X] Implement parallel-aware pause and retry logic
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): parallel-aware pause and retry`

### Task 34: Orchestrator parallel execution tests

**Files:**
- Modify: `apps/api/src/agents/__tests__/orchestrator.test.ts`

- [X] Write comprehensive tests: parallel execution, abort on failure, progress with parallel layers
- [X] Commit: `test(M9): add parallel execution tests`

### Task 35: Integration test for parallel pipeline

- [X] Write integration test: start pipeline → verify L4+L4.5 overlapping timestamps → verify L5+L6 overlapping timestamps
- [X] Run `pnpm --filter @sophia/api test`
- [X] Commit: `test(M9): add parallel pipeline integration test`

**Phase 3 Checkpoint:**
- [X] Run `pnpm --filter @sophia/api lint` — zero violations
- [X] Run `pnpm --filter @sophia/api build` — zero errors
- [X] Run `pnpm --filter @sophia/api test` — all tests pass
- [X] Verify: pipeline runs 7 effective steps (not 9)
- [X] Verify: L4+L4.5 timestamps overlap in agent_logs
- [X] Verify: pause/retry work correctly with parallel layers

---

## Phase 4: HU Certification (Sprint 6 — HU-40, HU-41, HU-42, HU-43)

**Purpose:** Requirement→test traceability, quality gate, certification report.

*Can run in parallel with Phase 3 after Phase 2 is complete.*

### Task 36: Create criteria extractor

**Files:**
- Create: `apps/api/src/agents/criteria-extractor.ts`
- Create: `apps/api/src/agents/__tests__/criteria-extractor.test.ts`

**Acceptance criteria (from HU-40):**
- `extractCriteria(specContent: string): CriteriaMap`
- Parse `### HU-XX — Name` + `- [X] criterion` checkboxes
- Assign IDs: `HU-14.CA-01`, `HU-14.CA-02`
- Handle HUs without criteria (warning, not error)

- [X] Write failing tests with real specs as fixtures (M1 auth, M4 agent-runner)
- [X] Implement `criteria-extractor.ts` with regex parsing and ID assignment
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): create criteria extractor`

### Task 37: Update QA-agent to generate test-mapping.json

**Files:**
- Modify: `skills/qa-agent/task.md`

**Acceptance criteria (from HU-41):**
- Add explicit instruction to generate `test-mapping.json` as last file before `taskComplete`
- Format: `{ "mappings": [{ "criteriaId": "HU-14.CA-01", "testFile": "...", "testName": "...", "type": "unit|integration" }] }`

- [X] Update `skills/qa-agent/task.md` with test-mapping.json generation instructions
- [X] Include format example and edge case handling (criteria with no test → `testFile: null`)
- [X] Commit: `feat(M9): instruct QA-agent to generate test-mapping.json`

### Task 38: Orchestrator reads test-mapping.json after QA

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-41):**
- After L4 (QA) completes, read and parse `test-mapping.json` from project filesystem
- Validate with Zod schema

- [X] Write failing test: mock QA output → verify orchestrator reads and validates test-mapping.json
- [X] Implement file read and Zod validation after L4
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): read test-mapping.json after QA layer`

### Task 39: Implement quality gate

**Files:**
- Modify: `apps/api/src/agents/orchestrator.ts`

**Acceptance criteria (from HU-42):**
- `verifyCriteriaCoverage(criteriaMap, testMapping)` returns coverage percentage
- If < threshold, re-queue QA with uncovered criteria (max 2 re-runs)
- Configurable via `CRITERIA_COVERAGE_THRESHOLD` (default: 80)
- WebSocket event `quality:gate` with coverage data

- [X] Write failing test: coverage below threshold → QA re-queued with additional prompt
- [X] Implement quality gate and re-run logic
- [X] Add `CRITERIA_COVERAGE_THRESHOLD` env var
- [X] Emit WebSocket event after gate evaluation
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): implement quality gate for criteria coverage`

### Task 40: Add test-mapping.json to tool definitions

**Files:**
- Modify: `apps/api/src/agents/tool-definitions.ts`

- [X] Add `test-mapping.json` schema to known output schemas for validation
- [X] Commit: `feat(M9): add test-mapping.json to tool definitions`

### Task 41: Create certification report generator

**Files:**
- Create: `apps/api/src/agents/certification-report.ts`
- Create: `apps/api/src/agents/__tests__/certification-report.test.ts`

**Acceptance criteria (from HU-43):**
- `generateCertificationReport(criteriaMap, testMapping): string` outputs markdown
- Matrix: `| HU | Criterion | Test | Test File | Status |`
- Status: ✅ COVERED, ⚠️ PARTIAL, ❌ MISSING
- Summary: `Coverage: X/Y criteria (Z%)`

- [X] Write failing tests with fixture data — verify matrix generation, status assignment, coverage calculation
- [X] Implement `certification-report.ts`
- [X] Run tests — verify GREEN
- [X] Commit: `feat(M9): create certification report generator`

### Task 42: Update integration-agent to generate certification.md

**Files:**
- Modify: `skills/integration-agent/task.md`

**Acceptance criteria (from HU-43):**
- Integration-agent generates `docs/certification.md` with full traceability matrix
- Receives `criteriaMap` + `testMapping` as context input

- [X] Update `skills/integration-agent/task.md` with certification.md generation instructions
- [X] Modify context-builder to inject criteriaMap + testMapping for L7
- [X] Commit: `feat(M9): instruct integration-agent to generate certification.md`

### Task 43: Certification E2E test

- [X] Write integration test: full pipeline with spec → QA generates test-mapping.json → quality gate passes → certification.md generated with correct matrix
- [X] Run `pnpm --filter @sophia/api test`
- [X] Commit: `test(M9): add certification E2E test`

**Phase 4 Checkpoint:**
- [X] Run `pnpm --filter @sophia/api lint` — zero violations
- [X] Run `pnpm --filter @sophia/api build` — zero errors
- [X] Run `pnpm --filter @sophia/api test` — all tests pass
- [X] Verify: criteria extracted from spec correctly
- [X] Verify: quality gate blocks when coverage < threshold
- [X] Verify: certification.md generated with full matrix

---

## Phase 4.5: Thread Safety (Sprint 6 — HU-46)

**Purpose:** Verify Anthropic SDK thread-safety for parallel execution.

### Task 44: Anthropic client concurrency test

**Files:**
- Create: `apps/api/src/agents/__tests__/anthropic-client.test.ts`

- [X] Write test: 2 simultaneous `client.messages.create()` on same singleton → verify both return valid responses
- [X] Run test

### Task 45: Implement factory if singleton fails

**Files:**
- Create (if needed): `apps/api/src/lib/anthropic-client.ts`
- Modify (if needed): `apps/api/src/agents/orchestrator.ts`

- [X] If singleton test fails: extract to `createAnthropicClient()` factory, update orchestrator to pass client per agent
- [X] If singleton test passes: document in `docs/adr/singleton-anthropic-client.md`
- [X] Commit: `feat(M9): verify/implement thread-safe Anthropic client`

**Phase 4.5 Checkpoint:**
- [X] Run `pnpm --filter @sophia/api test` — all tests pass
- [X] Verify: parallel agents use validated client pattern

---

## Phase 5: Polish & Validation (Sprints 5–6)

**Purpose:** Final quality checks, performance benchmarks, documentation updates.

### Task 46: Lint check

- [X] Run `pnpm --filter @sophia/api lint` — zero violations
- [X] Fix any remaining lint issues

### Task 47: Build check

- [X] Run `pnpm --filter @sophia/api build` (`tsc --noEmit`) — zero errors
- [X] Fix any remaining type errors

### Task 48: Full test suite

- [X] Run `pnpm --filter @sophia/api test` — all tests pass (existing + new)
- [X] Verify no test regressions

### Task 49: Performance benchmarks

- [X] Measure persist latency per turn (target: < 100ms P99)
- [X] Measure pipeline time on canary projects (target: ≤ 35 min average)
- [X] Measure skill load time (target: < 60ms)
- [X] Document results

### Task 50: Update CHANGELOG.md

- [X] Add M9 entries under appropriate version
- [X] Commit: `docs(M9): update CHANGELOG`

### Task 51: Update context-map and task-tracker

**Files:**
- Modify: `docs/context-map.md`
- Modify: `docs/task-tracker.md`

- [X] Add new cross-module dependencies to context-map
- [X] Update task-tracker with M9 progress
- [X] Commit: `docs(M9): update tracking docs`

### Task 52: Final integration verification

- [X] Run full pipeline on canary project — verify all 5 improvements work together
- [X] Verify shared skills loaded (no duplications in agent_logs)
- [X] Verify project_memory.md generated and accumulated
- [X] Verify L4+L4.5 parallel, L5+L6 parallel (overlapping timestamps)
- [X] Verify test-mapping.json and certification.md generated
- [X] Verify graceful shutdown (SIGTERM → paused, not zombie)

**Phase 5 Checkpoint:**
- [X] All lint/build/test pass
- [X] Performance targets met
- [X] Documentation updated
- [X] Integration verified on canary project

---

## Summary

| Phase | Tasks | HUs | Sprint |
|-------|-------|-----|--------|
| Phase 1: Shared Skills | Task 1–11 | HU-32, HU-33, HU-34, HU-35 | 5 |
| Phase 2: Memory Persistence | Task 12–22 | HU-36, HU-37, HU-38, HU-39 | 5 |
| Phase 2.5: Lifecycle Resilience | Task 23–27 | HU-44, HU-45, HU-47 | 5 |
| Phase 3: Agent Parallelism | Task 28–35 | HU-29, HU-30, HU-31 | 6 |
| Phase 4: HU Certification | Task 36–43 | HU-40, HU-41, HU-42, HU-43 | 6 |
| Phase 4.5: Thread Safety | Task 44–45 | HU-46 | 6 |
| Phase 5: Polish & Validation | Task 46–52 | — | 5–6 |
| **Total** | **52 tasks** | **19 HUs** | **2 sprints** |

> **Note:** Task count differs from original speckit tasks (70) because superpowers format consolidates related subtasks into cohesive Task units with multiple TDD steps each. Coverage is equivalent.

---

## Performance Benchmarks

| Metric | Baseline | Target | Method |
|--------|----------|--------|--------|
| Pipeline time | ~45 min | ≤ 35 min | Timestamp start→done on 3 canary projects |
| Persist latency/turn | N/A | < 100ms P99 | Vitest benchmark in base-agent |
| Skill load time | ~10ms | < 60ms | Timestamp in orchestrator (shared + agent) |
| Criteria extraction | N/A | < 1s | Vitest benchmark in criteria-extractor |
| Certification report | N/A | < 5s | Vitest benchmark in certification-report |
| Graceful shutdown | N/A (zombie) | ≤ 30s | Timestamp SIGTERM→exit in worker |
| Per-call timeout | 10 min (full waste) | ≤ 2 min | AbortController signal verification |
| Memory overhead/turn | N/A | < 0.5ms | Vitest benchmark on process.memoryUsage() |
