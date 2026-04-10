# Context Map — Leer esto, no todo el proyecto

Mapa de qué archivos leer para cada situación. Minimiza contexto, maximiza precisión.

## M1 — Auth (HU-01→05)

```
Lee:
  specs/001-m1-auth/spec.md
  skills/backend-agent/system.md
  apps/api/src/modules/auth/          → solo los archivos existentes
  apps/api/src/plugins/auth.ts        → plugin JWT cookies
  packages/shared/src/types/auth.ts

NO leas: nada de apps/web/ salvo que la tarea sea frontend de auth
```

## M2 — Projects (HU-06→10)

```
Lee:
  specs/002-m2-projects/spec.md
  skills/backend-agent/system.md
  apps/api/src/modules/projects/
  packages/shared/src/types/projects.ts

NO leas: nada de auth salvo el plugin de autenticación
```

## M3 — Spec Engine (HU-11→13)

```
Lee:
  specs/003-m3-spec-engine/spec.md
  skills/backend-agent/system.md
  apps/api/src/modules/specs/
  packages/shared/src/types/specs.ts

NO leas: módulos de auth o projects (solo se importa el service si hay dependencia)
```

## M4 — Agent Runner (HU-14→17)

```
Lee:
  specs/004-m4-agent-runner/spec.md
  skills/{agent}-agent/system.md + task.md   → prompts de los 9 agentes
  apps/api/src/agents/                       → base-agent, orchestrator, context-builder, 9 agents
  apps/api/src/queue/                        → agent-queue.ts, agent-worker.ts
  apps/api/src/websocket/                    → ws.auth.ts, ws.emitter.ts, ws.routes.ts
  apps/api/src/modules/agents/               → agent.service.ts, agent.controller.ts, agent.routes.ts
  apps/api/src/lib/encryption.service.ts     → AES-256-GCM para API keys
  apps/api/src/worker.ts                     → BullMQ worker entry point

Dependencias explícitas:
  apps/api/src/modules/projects/project.service.ts  → cambiar status del proyecto
  apps/api/prisma/schema.prisma                     → modelos Agent, AgentLog, GeneratedFile
```

## M5 — Dashboard Canvas (HU-18→22)

```
Lee:
  specs/005-m5-dashboard/spec.md
  apps/web/app/(dashboard)/projects/[id]/dashboard/page.tsx  → Server component (página)
  apps/web/components/dashboard/                             → 13 componentes:
    agent-canvas.tsx              → Canvas API nativo con rAF + ResizeObserver
    agent-canvas-renderer.ts      → drawNode, drawConnection, clearCanvas
    agent-canvas-events.ts        → hit-testing circular
    agent-particles.ts            → sistema de partículas animadas
    agent-detail-panel.tsx        → panel lateral del agente seleccionado
    agent-log-panel.tsx           → logs en tiempo real con filtro y auto-scroll
    agent-files-panel.tsx         → archivos generados con Framer Motion
    file-preview-modal.tsx        → vista previa con shiki syntax highlighting
    agent-metrics-bar.tsx         → 5 indicadores + barra de progreso
    agent-controls.tsx            → pausar/continuar/reintentar
    dashboard-layout.tsx          → layout responsive (desktop canvas + mobile list)
    agent-list-mobile.tsx         → lista vertical de agentes para mobile
    dashboard-empty.tsx           → estado idle
  apps/web/hooks/use-dashboard-store.ts   → Zustand store (agentes, logs, files, métricas)
  apps/web/hooks/use-websocket.ts         → WebSocket hook con reconexión y replay
  apps/web/hooks/use-elapsed-time.ts      → timer mm:ss
  apps/web/lib/agent-config.ts            → configuración de 10 agentes (posición, color)
  apps/web/lib/ws-events.ts               → 7 tipos de eventos WebSocket
  packages/shared/constants/file-icons.ts → mapa de íconos SVG para Canvas

Dependencias explícitas:
  apps/api/src/websocket/ws.emitter.ts    → tipos de eventos (contract)
  packages/shared/src/types/projects.ts   → ProjectStatus, AgentName

NO leas: nada del backend salvo tipos compartidos y contract de WS events
```

## M6 — File Manager (HU-23→25)

```
Lee:
  specs/006-m6-file-manager/spec.md
  skills/frontend-agent/system.md
  apps/web/src/components/files/       → tree view, code viewer
  apps/api/src/modules/files/          → endpoints de archivos generados

NO leas: dashboard ni agents
```

## M7 — Settings (HU-26→28)

```
Lee:
  specs/007-m7-settings/spec.md
  apps/web/src/app/settings/
  apps/api/src/modules/settings/
  apps/api/src/modules/users/          → perfil del usuario

NO leas: nada más
```

## Schema Prisma

```
Lee:
  apps/api/prisma/schema.prisma
  docs/erd/erd.md                      → diagrama de referencia

NO leas: ningún módulo de backend (el schema es independiente)
```

## WebSocket / Eventos en tiempo real

```
Lee:
  apps/api/src/websocket/ws.routes.ts       → ruta WebSocket /ws/projects/:id
  apps/api/src/websocket/ws.emitter.ts      → 7 tipos de eventos, connection registry
  apps/api/src/websocket/ws.auth.ts         → autenticación JWT en handshake

NO leas: lógica de agentes ni dashboard (solo los tipos de eventos)
```

## Crear / modificar un agente de Sophia (runtime)

```
Lee:
  skills/<agente>-agent/system.md + task.md  → prompt del agente
  apps/api/src/agents/base-agent.ts          → Tool Use loop con backoff + AbortController timeout
  apps/api/src/agents/orchestrator.ts        → pipeline paralela (AGENT_GRAPH), pause/retry, quality gate
  apps/api/src/agents/dependency-graph.ts    → AGENT_GRAPH, getNextLayers()
  apps/api/src/agents/context-builder.ts     → buildTaskPrompt (token budget + test-mapping injection para L7)
  apps/api/src/agents/dba-agent.ts           → ejemplo (re-export de base-agent)
  specs/004-m4-agent-runner/spec.md

NOTA: `skills/spec-agent/` existe pero NO es un agente del pipeline — es el agente de generación de specs de M3 (usa system.md + spec.md + data-model.md + api-design.md). Los 9 agentes del pipeline son: dba, seed, backend, frontend, qa, security, docs, deploy, integration
```

## M9 — Agent Improvements (HU-29→47)

```
Lee:
  docs/superpowers/plans/2026-04-10-m9-agent-improvements.md   → plan completo
  apps/api/src/agents/                                          → todos los módulos nuevos
    criteria-extractor.ts   → extractCriteria(spec) → CriteriaMap
    quality-gate.ts         → verifyCriteriaCoverage(criteriaMap, testMapping, threshold?)
    certification-report.ts → generateCertificationReport(criteriaMap, testMapping)
    dependency-graph.ts     → AGENT_GRAPH, getNextLayers(completedLayers)
    tool-definitions.ts     → RESERVED_OUTPUT_SCHEMAS (test-mapping.json)
  apps/api/src/lib/
    anthropic.ts            → getAnthropicClient() singleton (thread-safe, ver ADR)
    shutdown-state.ts       → isShuttingDown(), setShuttingDown()
  docs/adr/singleton-anthropic-client.md   → decisión de arquitectura del cliente Anthropic

Dependencias cross-module:
  skills/qa-agent/task.md         → instrucciones para generar test-mapping.json
  skills/integration-agent/task.md → Fase 7 genera docs/certification.md

NO leas: módulos de M1–M7 (no hay dependencias directas, solo context-builder usa prisma)
```

## Deploy / Docker

```
Lee:
  deployment/docker/Dockerfile.api
  deployment/docker/Dockerfile.worker  ← pendiente de crear
  docker-compose.yml                   ← pendiente de crear
  .env.example                         ← pendiente de crear

NO leas: código de la aplicación
```

---

## Archivos que NUNCA necesitas leer

| Archivo | Razón |
|---------|-------|
| `pnpm-lock.yaml` | Generado automáticamente |
| `node_modules/` | Dependencias instaladas |
| `.next/` | Build output de Next.js |
| `dist/` | Build output de TypeScript |
| `.git/` | Control de versiones |
| `projects/` | Código generado por Sophia en runtime (gitignored) |
