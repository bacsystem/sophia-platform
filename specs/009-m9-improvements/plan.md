# Implementation Plan: M9 Agent System Improvements

**Branch**: `009-m9-improvements` | **Date**: 2026-04-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/009-m9-improvements/spec.md`

## Summary

Cuatro mejoras estructurales al sistema de agentes más una mejora de resiliencia operativa: skills compartidas para consistencia, memoria persistente para resiliencia, paralelismo para velocidad, certificación de HUs para calidad, y hardening del ciclo de vida para operabilidad. Sprint 5 implementa las bases (shared skills + memory + lifecycle hardening), Sprint 6 las capacidades avanzadas (paralelismo + certificación + thread safety). 19 HUs (HU-29 a HU-47), 8 archivos nuevos, 18+ archivos modificados.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22
**Primary Dependencies**: Fastify, Prisma ORM, Anthropic SDK (tool use), BullMQ, @fastify/websocket, Redis 7, Zod
**Storage**: PostgreSQL 16 (nueva tabla `agent_messages`), Redis 7 (parallel coordination), Filesystem (skills/_shared/, project memory)
**Testing**: Vitest
**Target Platform**: Web (Fastify API + BullMQ Worker)
**Project Type**: web-service + worker (monorepo Turborepo)
**Performance Goals**: < 100ms latencia por turno de persistencia, pipeline -22% tiempo
**Constraints**: Backward-compatible con M4 existente, límite 3000 tokens para shared skills, quality gate threshold configurable
**Scale/Scope**: 5 mejoras, 19 HUs, 2 sprints

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Auth por Cookies | ✅ PASS | Sin cambios en auth — mejoras son internas al agent runner |
| II. Prisma Directo | ✅ PASS | Nueva tabla `agent_messages` con Prisma directo en base-agent |
| III. Pipeline 9 Agentes | ✅ PASS | Se mantienen 9 agentes; paralelismo agrupa pares sin eliminar capas |
| IV. pnpm Exclusivo | ✅ PASS | Sin dependencias nuevas externas |
| V. Patrón Backend | ✅ PASS | Nuevos archivos siguen patrón de módulos existentes |
| VI. Frontend Server-First | N/A | M9 es backend-only (cambios en frontend limitados a WS events) |
| VII. Seguridad Default | ✅ PASS | Sin nuevas superficies de ataque; path traversal prevention se mantiene |

## Project Structure

### Documentation (this feature)

```text
specs/009-m9-improvements/
├── spec.md          # Especificación de negocio (este archivo de referencia)
├── plan.md          # Este archivo
├── tasks.md         # Checklist de implementación
├── research.md      # Investigación técnica
└── data-model.md    # Modelo de datos (nueva tabla)
```

### Source Code — Archivos Nuevos

```text
apps/api/src/agents/
├── dependency-graph.ts          # Mejora 1: Grafo de dependencias tipado
├── criteria-extractor.ts        # Mejora 4: Parser de criterios de spec.md
├── certification-report.ts      # Mejora 4: Generador de certification.md
└── __tests__/
    ├── dependency-graph.test.ts
    ├── criteria-extractor.test.ts
    ├── certification-report.test.ts
    ├── context-builder.test.ts  # Mejora 3: Tests de priorización
    └── anthropic-client.test.ts # Mejora 5: Test de concurrencia SDK

apps/api/src/lib/
└── anthropic-client.ts          # Mejora 5: Factory/singleton thread-safe

skills/_shared/
├── conventions.md               # Mejora 2: Naming, paths, artefactos por capa
├── anti-patterns.md             # Mejora 2: Prohibiciones por dominio
└── output-format.md             # Mejora 2: Formato taskComplete, severidades
```

### Source Code — Archivos Modificados

```text
apps/api/prisma/schema.prisma    # Nueva tabla agent_messages
apps/api/src/agents/
├── base-agent.ts                # Persistir MessageParam[], reconstruir en retry, SIGTERM check, per-call timeout, memory monitor
├── orchestrator.ts              # Grafo, Promise.all, quality gate, compose skills, client factory
├── context-builder.ts           # project_memory, priorización, budget tokens
├── tool-executor.ts             # Checkpoint granular (upsert por createFile)
└── tool-definitions.ts          # Schema de test-mapping.json

apps/api/src/worker.ts           # SIGTERM/SIGINT handlers con shuttingDown flag

skills/
├── dba-agent/system.md          # Refactorizar (-30% duplicados)
├── seed-agent/system.md         # Refactorizar
├── backend-agent/system.md      # Refactorizar
├── frontend-agent/system.md     # Refactorizar
├── qa-agent/system.md           # Refactorizar
├── qa-agent/task.md             # Mapeo criterio→test, ref seed artifacts
├── security-agent/system.md     # Refactorizar, severity unificado
├── docs-agent/system.md         # Refactorizar
├── deploy-agent/system.md       # Refactorizar
├── integration-agent/system.md  # Refactorizar, severity unificado
└── integration-agent/task.md    # Lista explícita de archivos, certification
```

## Data Model

### agent_messages (NUEVA)

```prisma
model AgentMessage {
  id        String   @id @default(uuid())
  agentId   String   @map("agent_id")
  projectId String   @map("project_id")
  turn      Int      @map("turn_number")
  role      String   // "user" | "assistant"
  content   Json     // JSONB — MessageParam content (text, tool_use, tool_result)
  tokens    Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  agent   Agent   @relation(fields: [agentId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([agentId, turn])
  @@index([projectId])
  @@map("agent_messages")
}
```

**Relaciones**: Agent 1→N AgentMessage, Project 1→N AgentMessage
**Cleanup policy**: TTL 30 días (BullMQ scheduled job)

## Architectural Decisions

### AD-01: Grafo de dependencias vs. Array con metadata

**Decisión**: Grafo explícito con `dependsOn[]` por nodo.
**Alternativa descartada**: Agregar campo `canParallelWith` al array LAYERS existente.
**Razón**: El grafo es extensible — en el futuro se pueden agregar más capas o cambiar dependencias sin reescribir la lógica de resolución. El resolver genérico (`getNextLayers`) funciona con cualquier topología.

### AD-02: Persistencia sync vs. async de mensajes Claude

**Decisión**: Fire-and-forget async (no bloquear el loop de Tool Use).
**Alternativa descartada**: `await prisma.agentMessage.create()` síncrono en cada turno.
**Razón**: La latencia de 100ms por turno sería acumulativa (50 turnos → 5 segundos extra). El fire-and-forget con retry en background mantiene la velocidad y eventual consistency es aceptable (los mensajes se usan solo en retry/crash recovery, no en operación normal).

### AD-03: Quality gate re-run vs. warning

**Decisión**: Re-run QA hasta 2 veces, luego continuar con warning.
**Alternativa descartada**: Bloquear pipeline permanentemente si cobertura < threshold.
**Razón**: El pipeline debe ser resiliente — un criterio ambiguo no debe bloquear toda la generación. El warning se incluye en el certification report y el usuario decide si el resultado es aceptable.

### AD-04: Shared skills composición vs. herencia

**Decisión**: Concatenación de archivos markdown (`shared + agent-specific`).
**Alternativa descartada**: Template con `{{include _shared/conventions.md}}` placeholders.
**Razón**: Claude no procesa includes. La concatenación es simple, predecible y no requiere un template engine. El orden de composición importa: las instrucciones específicas del agente prevalecen sobre las compartidas por estar al final del prompt.

## Execution Order

### Sprint 5: Foundations

```
Phase 1: Shared Skills (Mejora 2)
  T001→T004: Crear _shared/*.md
  T005→T010: Refactorizar 9 system.md
  T011→T012: Actualizar orchestrator composición + tests
  ↓
Phase 2: Memory Persistence (Mejora 3)
  T013: Migración agent_messages
  T014→T015: Persistencia en base-agent + reconstrucción
  T016→T017: Project memory + orchestrator
  T018→T019: Checkpoint granular + context inteligente
  T020→T021: Tests
  ↓
Phase 2.5: Lifecycle Resilience (Mejora 5 parcial)
  T062→T063: SIGTERM handlers + graceful shutdown
  T064→T065: Per-call timeout + AbortController
  T066→T067: Memory monitoring + truncation
  T068: Tests
```

### Sprint 6: Advanced Capabilities

```
Phase 3: Agent Parallelism (Mejora 1)
  T022→T024: dependency-graph + orchestrator refactor
  T025→T026: WebSocket + progress tracking paralelo
  T027→T028: Pause/Retry con paralelos + tests
  ↓ (parallel with Phase 4 after T024)
Phase 4: HU Certification (Mejora 4)
  T029→T030: criteria-extractor + tests
  T031→T032: QA-agent mapping + skill update
  T033→T034: Quality gate + orchestrator
  T035→T036: Certification report + integration-agent
  T037→T038: E2E tests
  ↓
Phase 4.5: Thread Safety (Mejora 5 final)
  T069→T070: Anthropic client concurrency test + factory if needed
```

## Verification

### Automated

1. `pnpm --filter @sophia/api test` — todos los tests existentes + nuevos pasan
2. `pnpm --filter @sophia/api build` — build sin errores TypeScript
3. `pnpm --filter @sophia/api lint` — sin violations
4. Tests específicos:
   - `dependency-graph.test.ts`: resolución secuencial, paralela, ciclos
   - `criteria-extractor.test.ts`: fixtures con specs M1, M2, M4
   - `certification-report.test.ts`: generación correcta de markdown
   - `context-builder.test.ts`: priorización, budget tokens, project_memory
   - `base-agent.test.ts`: persist/reconstruct MessageParam[], SIGTERM shutdown, per-call timeout, memory truncation
   - `orchestrator.test.ts`: parallelism, quality gate, compose skills
   - `anthropic-client.test.ts`: concurrency test (2 simultaneous calls)

### Manual

1. **Proyecto canario**: Ejecutar pipeline completo en un proyecto de test y verificar:
   - Skills compartidas se cargan (verificar en agent_logs que no hay duplicaciones en prompt)
   - project_memory.md se genera y acumula
   - L4 y L4.5 corren en paralelo (timestamps solapados en agent_logs)
   - L5 y L6 corren en paralelo
   - test-mapping.json se genera con mapeo correcto
   - certification.md se genera con matriz completa
2. **Crash recovery**: Kill worker mid-layer, reiniciar, verificar que conversación se reconstruye
3. **Quality gate**: Generar spec con criterio imposible de testear, verificar que quality gate re-ejecuta QA y eventualmente emite warning
4. **Graceful shutdown**: Enviar SIGTERM al worker mid-agent, verificar que agente sale con `status: paused` (no zombie), restart retoma conversación
5. **Per-call timeout**: Mockear Anthropic API con delay >2min, verificar que se aborta y reintenta
6. **Memory monitoring**: Ejecutar agente con 40+ turnos, verificar warning en logs si heap crece >200MB

### Performance Benchmarks

| Métrica | Baseline | Target | Método |
|---------|----------|--------|--------|
| Pipeline time | ~45 min | ≤ 35 min | Timestamp start→done en 3 proyectos canarios |
| Persist latency/turn | N/A | < 100ms P99 | Vitest benchmark en base-agent |
| Skill load time | ~10ms | < 60ms | Timestamp en orchestrator (shared + agent) |
| Criteria extraction | N/A | < 1s | Vitest benchmark en criteria-extractor |
| Certification report | N/A | < 5s | Vitest benchmark en certification-report |
| Graceful shutdown time | N/A (zombie) | ≤ 30s | Timestamp SIGTERM→exit en worker |
| Per-call timeout | 10 min (full waste) | ≤ 2 min | AbortController signal verification |
| Memory overhead/turn | N/A | < 0.5ms | Vitest benchmark en process.memoryUsage() |

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
