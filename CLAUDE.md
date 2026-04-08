# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repository Is

**Sophia Platform** — sistema autónomo de generación de software impulsado por IA. Orquesta agentes especializados (Claude con Tool Use) que generan código capa por capa.

### Tech Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Framer Motion, Lucide React, Recharts |
| Backend | Node.js 22, Fastify, TypeScript, Prisma ORM |
| DB | PostgreSQL 16, Redis 7 |
| Queue | BullMQ (worker separado) |
| AI | Anthropic SDK — Claude Tool Use |
| WebSocket | @fastify/websocket |
| Email | Resend (prod) / console.log (dev) |
| Deploy | Railway (backend) + Vercel (frontend) |

### Project Structure

```
sophia-platform/
├── apps/web/              # Frontend Next.js 15
├── apps/api/              # Backend Fastify + Worker BullMQ
├── packages/shared/       # Tipos, constantes compartidas
├── skills/                # Prompts de los 9 agentes (system.md + task.md)
│   ├── dba-agent/         #   Layer 1: Database
│   ├── seed-agent/        #   Layer 1.5: Seed Data
│   ├── backend-agent/     #   Layer 2: Backend
│   ├── frontend-agent/    #   Layer 3: Frontend
│   ├── qa-agent/          #   Layer 4: Testing
│   ├── security-agent/    #   Layer 4.5: Security Audit
│   ├── docs-agent/        #   Layer 5: Documentation
│   ├── deploy-agent/      #   Layer 6: Deployment
│   └── integration-agent/ #   Layer 7: Cross-layer Validation
├── specs/                 # Specs de módulos M1-M7
├── deployment/            # Dockerfiles, Railway config
├── projects/              # Código generado (gitignored, runtime)
└── docs/                  # Documentación
```

### Modules (28 HUs total)

| Sprint | Módulo | HUs |
|--------|--------|-----|
| 1 | M1 Auth, M2 Projects | HU-01→10 |
| 2 | M3 Spec Engine | HU-11→13 |
| 3 | M4 Agent Runner | HU-14→17 |
| 4 | M5 Dashboard, M6 File Manager, M7 Settings | HU-18→28 |

### Key Commands

```bash
pnpm dev                    # Dev (turbo: web + api)
pnpm docker:up              # PostgreSQL 16 + Redis 7
pnpm db:migrate             # Prisma migrations
pnpm build                  # Build all
pnpm test                   # Tests all
```

### Architecture Rules

- Monorepo Turborepo con pnpm workspaces
- Agentes ejecutan 9 capas secuencialmente (sin paralelismo en MVP)
- Cada agente usa Tool Use: `createFile`, `readFile`, `listFiles`, `taskComplete`
- Pipeline completo: DBA → Seed → Backend → Frontend → QA → Security → Docs → Deploy → Integration
- Archivos generados en `{PROJECTS_BASE_DIR}/{projectId}/` (filesystem)
- Metadata en BD (`generated_files`), contenido en filesystem
- WebSocket para eventos en tiempo real (auth via JWT en handshake)
- API keys de usuarios encriptadas con AES-256-GCM
- BullMQ worker corre como proceso separado

### Naming Conventions

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Clases | PascalCase | `AuthService`, `ProjectController` |
| Funciones | camelCase | `createProject`, `findUserById` |
| Variables | camelCase | `projectId`, `apiKey` |
| Constantes | UPPER_SNAKE | `JWT_SECRET`, `MAX_AGENTS` |
| Archivos | kebab-case | `auth.service.ts`, `project-card.tsx` |
| Tipos/Interfaces | PascalCase | `CreateProjectInput`, `ProjectConfig` |
| Tablas BD | snake_case plural | `users`, `agent_logs` |
| Campos Prisma | camelCase (@map) | `userId @map("user_id")` |

### Backend Pattern

```
src/modules/{nombre}/
├── {nombre}.routes.ts      → Definición de rutas Fastify
├── {nombre}.controller.ts  → Handlers (thin, solo llaman service)
├── {nombre}.service.ts     → Lógica de negocio (Prisma directo)
└── {nombre}.schema.ts      → Schemas Zod de validación
```

- **NO repository layer** — Prisma se usa directo en el service
- Auth: JWT cookies httpOnly (`access_token`) — **NO Bearer token**
- Respuesta éxito: `{ data: result }`
- Respuesta error: `{ error: 'ERROR_CODE', message: 'descripción' }`
- Error validación: `{ error: 'VALIDATION_ERROR', errors: zodError.errors }`
- HTTP codes: 200, 201, 400, 401, 404, 422, 500

### Frontend Pattern

- Import order: React/Next → librerías externas → UI (shadcn) → componentes propios → hooks → types/utils
- Componentes server-side por defecto, `"use client"` solo cuando necesario
- Siempre manejar 3 estados: loading, error, data
- API calls con `fetch(url, { credentials: 'include' })` — cookies, NO Bearer
- Tipos compartidos desde `@sophia/shared`

### Module Execution Order

Dentro de cada módulo, el orden de implementación es:
1. Schema Prisma (tablas nuevas)
2. Backend: routes → controller → service → schema
3. Frontend: pages → components → hooks → stores
4. Tests (unit + integration)
5. Documentación

### Token Optimization

Reglas para minimizar consumo de contexto al trabajar con agentes IA.

**Al iniciar sesión:**
1. Lee SOLO `CLAUDE.md` y el `tasks.md` del módulo activo (`specs/<módulo>/tasks.md`)
2. NO leas archivos de código hasta que una tarea específica lo requiera
3. Identifica la próxima tarea pendiente en `tasks.md`

**Al implementar una tarea:**
1. Lee SOLO los archivos del módulo que vas a tocar (ver Context Map en `docs/context-map.md`)
2. Lee SOLO la spec del módulo correspondiente (`specs/<módulo>/spec.md`)
3. NO leas archivos de otros módulos salvo que haya dependencia explícita

**Al completar una tarea:**
1. Marca la tarea como completada en `tasks.md` inmediatamente
2. Si llevas más de 4 tareas en la sesión, compacta el contexto

**Nunca:**
- Listar todo el directorio para "entender el contexto" — lee `CLAUDE.md`
- Regenerar código que ya está marcado como completado
- Pedir confirmación entre subtareas de la misma tarea
- Explicar lo que vas a hacer antes de hacerlo — solo hazlo
- Leer `pnpm-lock.yaml`, `node_modules/`, `.next/`, `dist/`, `.git/`

---

## Speckit Integration

This project also uses `speckit` for spec-driven development. It provides:

- A `.specify/` directory with scripts, templates, and memory that orchestrate a structured spec → plan → tasks → implement pipeline
- Claude Code skills (`.claude/skills/speckit-*/SKILL.md`) that power the `/speckit.*` slash commands
- Integration manifests (`.specify/integrations/`) for Claude and other AI agents

## Speckit Workflow (Primary Feature Pipeline)

Features move through this ordered sequence — each step gates the next:

1. `/speckit.specify <description>` — Creates a feature branch + `specs/<branch>/spec.md` (business requirements, no implementation details)
2. `/speckit.clarify` — Refines the spec interactively (max 5 questions); run before planning
3. `/speckit.plan` — Generates `plan.md`, `research.md`, `data-model.md`, and `contracts/`; runs `.specify/scripts/bash/setup-plan.sh --json`
4. `/speckit.checklist <domain>` — Creates quality checklists (e.g., `ux.md`, `security.md`) under `specs/<branch>/checklists/`
5. `/speckit.analyze` — Cross-artifact consistency analysis across `spec.md`, `plan.md`, `tasks.md` (read-only)
6. `/speckit.tasks` — Generates `tasks.md` with dependency-ordered, user-story-grouped tasks
7. `/speckit.implement` — Executes tasks from `tasks.md` phase by phase; marks tasks `[X]` as completed
8. `/speckit.constitution` — Creates/updates the project constitution at `.specify/memory/constitution.md`
9. `/speckit.taskstoissues` — Converts `tasks.md` tasks into GitHub Issues (only for GitHub remotes)

## Key Scripts

All scripts are in `.specify/scripts/bash/` and source `common.sh` for shared path resolution:

- `create-new-feature.sh` — Creates a git branch + `specs/<N>-<short-name>/spec.md`. Branch numbers are auto-detected from existing branches/specs. Supports `--timestamp` for timestamp prefixes instead of sequential numbers.
- `check-prerequisites.sh` — Validates feature context (current branch → feature dir → required docs). Used by most skills at startup. Flags: `--json`, `--require-tasks`, `--include-tasks`, `--paths-only`.
- `setup-plan.sh` — Copies the plan template into the feature dir. Called by `/speckit.plan`.
- `update-agent-context.sh` — Parses `plan.md` and updates agent context files (CLAUDE.md, AGENTS.md, etc.) with tech stack info. Called with agent type: `update-agent-context.sh claude`.

## Directory Structure

Feature specs live at `specs/<branch-name>/` and contain:
- `spec.md` — Business requirements (tech-agnostic)
- `plan.md` — Implementation plan (tech stack, architecture)
- `research.md`, `data-model.md`, `contracts/`, `quickstart.md` — Optional design artifacts
- `tasks.md` — Ordered implementation checklist
- `checklists/` — Requirements quality checklists

## Constitution

`.specify/memory/constitution.md` is the project constitution — non-negotiable principles that `/speckit.analyze` enforces. Constitution violations are always CRITICAL severity. To modify it, use `/speckit.constitution`.

## Branch Numbering

Branch prefix mode is set in `.specify/init-options.json` under `branch_numbering`:
- `"sequential"` (default) — `001-feature-name`
- `"timestamp"` — `20260407-123456-feature-name`

## Integration Context Updates

After `/speckit.plan`, run `.specify/scripts/bash/update-agent-context.sh claude` to regenerate CLAUDE.md with current feature tech stack. The script reads `plan.md` fields (`Language/Version`, `Primary Dependencies`, `Storage`, `Project Type`) and updates the `## Active Technologies` and `## Recent Changes` sections.

## Extension Hooks

All skills check `.specify/extensions.yml` for `hooks.before_<command>` and `hooks.after_<command>` entries. Hooks with `optional: false` execute automatically; `optional: true` hooks are presented to the user for manual invocation.
