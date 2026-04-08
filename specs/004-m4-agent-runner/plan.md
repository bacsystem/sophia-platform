# Implementation Plan: M4 Agent Runner

**Branch**: `004-m4-agent-runner` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-m4-agent-runner/spec.md`

## Summary

Núcleo de Sophia: orquestador de 9 agentes IA que generan código capa por capa usando Claude Tool Use. BullMQ para cola de jobs, @fastify/websocket para eventos tiempo real, checkpoint por archivo para resumibilidad. Pipeline secuencial DBA→Seed→Backend→Frontend→QA→Security→Docs→Deploy→Integration.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22
**Primary Dependencies**: Fastify, Prisma ORM, Anthropic SDK (tool use), BullMQ, @fastify/websocket, Redis 7, Zod
**Storage**: PostgreSQL 16 (agents, agent_logs, generated_files), Redis 7 (queue + pause flags), Filesystem (archivos generados)
**Testing**: Vitest
**Target Platform**: Web (Fastify API + BullMQ Worker como proceso separado)
**Project Type**: web-service + worker (monorepo Turborepo)
**Performance Goals**: < 5 min por agente (timeout), < 100ms WebSocket event delivery
**Constraints**: 9 capas secuenciales, max 100 archivos/agente, max 100KB/archivo, path traversal prevention
**Scale/Scope**: MVP — 4 HUs + WS, 7 endpoints + 1 WS route, 3 tablas, 9 agentes, BullMQ worker

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Auth por Cookies | ✅ PASS | API via cookies, WS auth via JWT en handshake |
| II. Prisma Directo | ✅ PASS | agent.service.ts con Prisma directo |
| III. Pipeline 9 Agentes | ✅ PASS | 9 capas secuenciales, 4 tools: createFile/readFile/listFiles/taskComplete |
| IV. pnpm Exclusivo | ✅ PASS | |
| V. Patrón Backend | ✅ PASS | routes → controller → service → schema. Respuestas `{ data }` |
| VI. Frontend Server-First | N/A | M4 es backend-only (frontend en M5) |
| VII. Seguridad Default | ✅ PASS | Path traversal prevention, API key AES-256-GCM, WS auth |

## Project Structure

### Documentation (this feature)

```text
specs/004-m4-agent-runner/
├── spec.md
├── plan.md              # This file
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/
├── agents/
│   ├── base-agent.ts
│   ├── orchestrator.ts
│   ├── tool-executor.ts
│   ├── tool-definitions.ts
│   ├── context-builder.ts
│   ├── dba-agent.ts
│   ├── seed-agent.ts
│   ├── backend-agent.ts
│   ├── frontend-agent.ts
│   ├── qa-agent.ts
│   ├── security-agent.ts
│   ├── docs-agent.ts
│   ├── deploy-agent.ts
│   └── integration-agent.ts
├── queue/
│   ├── agent-queue.ts
│   └── agent-worker.ts
├── websocket/
│   ├── ws.routes.ts
│   ├── ws.auth.ts
│   └── ws.emitter.ts
├── modules/agents/
│   ├── agent.routes.ts
│   ├── agent.controller.ts
│   ├── agent.service.ts
│   └── agent.schema.ts
├── lib/
│   └── encryption.service.ts   # Sprint 2.5 prerequisito compartido
└── worker.ts                    # Entry point BullMQ worker (proceso separado)

skills/
├── dba-agent/          system.md + task.md
├── seed-agent/         system.md + task.md
├── backend-agent/      system.md + task.md
├── frontend-agent/     system.md + task.md
├── qa-agent/           system.md + task.md
├── security-agent/     system.md + task.md
├── docs-agent/         system.md + task.md
├── deploy-agent/       system.md + task.md
└── integration-agent/  system.md + task.md
```

## Data Model

### agents
- `id` UUID PK, `project_id` FK, `type` VARCHAR(20), `status` VARCHAR(20) default 'idle'
- `progress` INT 0-100, `current_task` TEXT, `tokens_input` INT, `tokens_output` INT
- `layer` REAL, `error` TEXT, `started_at`, `completed_at`, `created_at`, `updated_at`
- Índices: project_id, (project_id,type) UNIQUE, (project_id,status)

### agent_logs
- `id` UUID PK, `agent_id` FK, `project_id` FK (denorm), `type` VARCHAR(10), `message` TEXT
- `created_at` TIMESTAMPTZ
- Índices: project_id, (project_id,created_at), (project_id,type)

### generated_files
- `id` UUID PK, `project_id` FK, `agent_id` FK, `name` VARCHAR(255), `path` TEXT
- `size_bytes` INT, `layer` REAL, `created_at` TIMESTAMPTZ
- Índices: project_id, (project_id,agent_id), (project_id,layer)

## API Contracts

| Method | Path | Status | Response |
|--------|------|--------|----------|
| POST | /api/projects/:id/start | 200 | `{ data: { id, status, agents } }` |
| POST | /api/projects/:id/pause | 200 | `{ data: { id, status } }` |
| POST | /api/projects/:id/continue | 200 | `{ data: { id, status } }` |
| POST | /api/projects/:id/retry | 200 | `{ data: { id, status, retryFromLayer, retryFromLayerName } }` |
| GET | /api/projects/:id/agents | 200 | `{ data: [...agents] }` |
| GET | /api/projects/:id/logs | 200 | `{ data: [...logs], meta: { total, page, limit, pages } }` |
| WS | /ws/projects/:id | — | Eventos: agent:status, agent:log, file:created, project:progress/done/paused/error |

## Architecture Decisions

1. **Tool Use loop** — Claude decide qué archivos crear via tool_call, backend ejecuta y reporta
2. **BullMQ worker separado** — proceso independiente, concurrency: 3, timeout 10min/layer
3. **Checkpoint por archivo** — estado persistido en BD tras cada createFile (resumible en crash)
4. **Pause via Redis flag** — `project:pause:{id}` checked antes de cada tool_call
5. **Contexto entre capas** — cada agente recibe spec + resumen de archivos de capas anteriores
6. **Sprint 2.5 prerequisito** — encryption.service.ts + tabla user_settings creados antes de M4

## Dependencies

- **M1**: Auth — JWT validation, WS handshake auth
- **M2**: Projects — proyecto creado, stubs reemplazados
- **M3**: Spec Engine — spec generado como prerequisito
- **M7 (parcial)**: encryption.service.ts + user_settings (Sprint 2.5)
