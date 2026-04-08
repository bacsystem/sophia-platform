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

| Sprint | Módulo | HUs | Estado |
|--------|--------|-----|--------|
| 1 | M1 Auth | HU-01→05 | ✅ v1.3 completado |
| 1 | M2 Projects | HU-06→10 | ✅ v0.2.0 completado |
| 2 | M3 Spec Engine | HU-11→13 | 📋 Spec ready |
| 3 | M4 Agent Runner | HU-14→17 | 📋 Spec ready |
| 4 | M5 Dashboard, M6 File Manager, M7 Settings | HU-18→28 | 📋 Spec ready |

### Sprint Status (actualización al iniciar sesión)

| Módulo | Branch | Tareas | Versión | Último commit |
|--------|--------|--------|---------|---------------|
| M1 Auth | `001-m1-auth` | 46/46 | v0.1.0 | fix(coderabbit): resolve PR review findings |
| M2 Projects | `002-m2-projects` | 49/49 | v0.2.0 | feat(M2): implement projects module — all 49 tasks complete |
| M3–M7 | — | 0/131 | — | pendiente |

### Key Commands

```bash
pnpm dev                    # Dev (turbo: web + api)
pnpm db:migrate             # Prisma migrations
pnpm build                  # Build all
pnpm test                   # Tests all
pnpm --filter @sophia/web lint  # ESLint frontend
pnpm --filter @sophia/api lint  # ESLint backend
pnpm --filter @sophia/web build # Build frontend (next build)
pnpm --filter @sophia/api build # Build backend (tsc)
```

### Local Development

- PostgreSQL 16 y Redis 7 corren **nativos** (instalados localmente, no Docker)
- `pnpm dev` levanta web + api con Turborepo
- Hot reload via tsx watch en el API

### Environment Variables

```bash
# apps/api/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/sophia_dev
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=<random-32-chars>
JWT_REFRESH_SECRET=<random-32-chars>
ENCRYPTION_KEY=<64-hex-chars>          # AES-256-GCM para API keys
RESEND_API_KEY=re_xxxxx                # Solo prod (dev usa console.log)
FRONTEND_URL=http://localhost:3000
PORT=3001
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

Módulos con autenticación agregan `{nombre}.middleware.ts` (hooks de auth/rate-limit).

- **NO repository layer** — Prisma se usa directo en el service
- Auth: JWT cookies httpOnly (`access_token`) — **NO Bearer token**
- Respuesta éxito: `{ data: result }`
- Respuesta error: `{ error: 'ERROR_CODE', message: 'descripción' }`
- Error rate limit: `{ error: 'ERROR_CODE', message: 'descripción', retryAfter: seconds }`
- Error validación: `{ error: 'VALIDATION_ERROR', errors: zodError.errors }`
- HTTP codes: 200, 201, 400, 401, 404, 409, 422, 429, 500

### Frontend Pattern

- Import order: React/Next → librerías externas → UI (shadcn) → componentes propios → hooks → types/utils
- Componentes server-side por defecto, `"use client"` solo cuando necesario
- Siempre manejar 3 estados: loading, error, data
- API calls con `fetch(url, { credentials: 'include' })` — cookies, NO Bearer
- Tipos compartidos desde `@sophia/shared`
- **Lint obligatorio**: ejecutar `pnpm --filter @sophia/web lint` después de cada cambio en `apps/web/`

### Speckit Artifacts per Module

Cada módulo debe tener los siguientes artefactos en `specs/<módulo>/`. Si alguno no existe, **créalo antes de implementar**:

```
specs/<módulo>/
├── spec.md              # Requisitos de negocio (obligatorio)
├── plan.md              # Plan de implementación (obligatorio)
├── tasks.md             # Checklist de tareas (obligatorio)
├── research.md          # Investigación técnica (decisiones, libs, trade-offs)
├── data-model.md        # Modelo de datos (tablas, índices, relaciones, Prisma schema)
├── quickstart.md        # Guía rápida para empezar a implementar
└── contracts/
    └── api-spec.json    # Contrato OpenAPI 3.0 de los endpoints del módulo
```

### Module Execution Order

Dentro de cada módulo, el orden de implementación es:
1. Schema Prisma (tablas nuevas)
2. Backend: routes → controller → service → schema → **lint** → **build** (`tsc --noEmit`)
3. Frontend: pages → components → hooks → stores → **lint** → **build** (`next build`)
4. Tests (unit + integration)
5. **Validación de rutas** (ver regla abajo)
6. Documentación

> **Lint obligatorio**: ejecutar `pnpm --filter @sophia/web lint` y `pnpm --filter @sophia/api lint` después de cada cambio en `apps/web/` o `apps/api/` respectivamente.
> **Build obligatorio**: ejecutar `pnpm --filter @sophia/api build` y `pnpm --filter @sophia/web build` para verificar que compila sin errores antes de commit.
> **Test obligatorio**: ejecutar `pnpm --filter @sophia/api test` antes de commit para verificar que todos los tests pasan.
> **Clean build obligatorio**: si se cambia la estructura de páginas (`app/**/page.tsx`, `app/**/layout.tsx`) o se elimina/renombra una ruta, ejecutar `rm -rf apps/web/.next && pnpm --filter @sophia/web build` para evitar cache corrupto (`Cannot find module './XXX.js'`).

### Validación de Rutas y Navegación (Post-Implementación)

Al completar un módulo, feature, o fix que involucre frontend:

1. **Verificar que las rutas nuevas son accesibles** desde la navegación principal (navbar, sidebar, links internos)
2. **Verificar el flujo post-login**: el redirect después del login (`router.push(...)`) debe llevar a una página funcional con navbar visible
3. **Verificar que `app/page.tsx`** (raíz) redirige a la página principal activa del sistema (actualmente `/projects`)
4. **Verificar que el layout `(dashboard)/layout.tsx`** incluye links a todas las secciones implementadas
5. **Checklist rápido:**
   - [ ] Login → redirect → página con navbar ✅
   - [ ] Todas las rutas nuevas aparecen en la navegación
   - [ ] Rutas públicas vs protegidas correctamente configuradas en `middleware.ts`
   - [ ] No hay páginas placeholder huérfanas (sin navbar ni links de acceso)

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
5. `/speckit.tasks` — Generates `tasks.md` with dependency-ordered, user-story-grouped tasks
6. `/speckit.analyze` — Cross-artifact consistency analysis across `spec.md`, `plan.md`, `tasks.md` (read-only)
7. `/speckit.implement` — Executes tasks from `tasks.md` phase by phase; marks tasks `[X]` as completed
8. `/speckit.constitution` — Creates/updates the project constitution at `.specify/memory/constitution.md`
9. `/speckit.taskstoissues` — Converts `tasks.md` tasks into GitHub Issues (only for GitHub remotes)

## Key Scripts

All scripts are in `.specify/scripts/bash/` and source `common.sh` for shared path resolution:

- `create-new-feature.sh` — Creates a git branch + `specs/<N>-<short-name>/spec.md`. Branch numbers are auto-detected from existing branches/specs. Supports `--timestamp` for timestamp prefixes instead of sequential numbers.
- `check-prerequisites.sh` — Validates feature context (current branch → feature dir → required docs). Used by most skills at startup. Flags: `--json`, `--require-tasks`, `--include-tasks`, `--paths-only`.
- `setup-plan.sh` — Copies the plan template into the feature dir. Called by `/speckit.plan`.
- `update-agent-context.sh` — Parses `plan.md` and updates agent context files (CLAUDE.md, AGENTS.md, etc.) with tech stack info. Called with agent type: `update-agent-context.sh claude`.

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

---

## Project Tracking & Versioning

### Versionamiento Semántico

El **proyecto** usa una única versión semántica (`MAJOR.MINOR.PATCH`) en `package.json` raíz:

- **MAJOR**: Rediseño de arquitectura o cambio de alcance global (>50% de HUs)
- **MINOR**: Módulo completo implementado y en producción (M1, M2, M3...)
- **PATCH**: Hotfixes, correcciones de bugs, mejoras de a11y, docs post-release

Los `spec.md` individuales usan `# Versión: X.Y` como referencia interna del artefacto (no del proyecto).

### Changelog

Mantener `CHANGELOG.md` (raíz del proyecto) actualizado con cada cambio relevante. Formato:

```markdown
## [v0.3.0] — 2026-04-XX ✅ M3 Spec Engine
### Added
- ...
### Fixed
- ...
```

Reglas:
- Una entrada por versión de proyecto (no por módulo)
- La versión coincide con `package.json` y el tag git
- Agrupar por `Added`, `Changed`, `Fixed`, `Removed`

### Archivos de Tracking

| Archivo | Propósito | Cuándo actualizar |
|---------|-----------|-------------------|
| `docs/context-map.md` | Mapa de dependencias entre módulos — qué archivos lee cada módulo | Al agregar dependencias cross-module o nuevos archivos compartidos |
| `docs/task-tracker.md` | Resumen de progreso global — tareas completadas vs pendientes por módulo | Al completar una fase o sprint |
| `specs/<módulo>/spec.md` | Versión en header | Al modificar requisitos, endpoints, o modelo de datos |
| `specs/<módulo>/plan.md` | Constitution Check table | Al cambiar decisiones de arquitectura |
| `specs/<módulo>/tasks.md` | Checkboxes `[X]` | Inmediatamente al completar cada tarea |
| `.specify/memory/constitution.md` | Version field | Al enmendar principios (requiere actualizar CLAUDE.md también) |
| `CHANGELOG.md` | Entradas por módulo | Al cerrar un sprint, completar analyze, o hacer cambios significativos |
| `docs/system-design.html` | Documento visual de arquitectura (HTML standalone) | Al cambiar capas, agentes, ERD, decisiones técnicas o infraestructura |

### Regla de Actualización

**Al completar cualquier tarea o grupo de tareas:**
1. Marcar `[X]` en `tasks.md`
2. Actualizar `docs/task-tracker.md` con el nuevo conteo
3. Si hubo cambios en spec/plan, incrementar versión y agregar entrada en `CHANGELOG.md`
4. Si se agregaron dependencias cross-module, actualizar `docs/context-map.md`

### Regla de Módulo Completado

**Al completar todas las tareas de un módulo (100% ✅):**
1. Ejecutar lint + build + verificar que todo pasa
2. **Validación de rutas**: ejecutar checklist de "Validación de Rutas y Navegación" (ver sección Module Execution Order)
3. Bump versión en `package.json` raíz (MINOR)
4. Actualizar `CHANGELOG.md` y `CLAUDE.md` (Sprint Status)
5. Commit y push la feature branch
6. **Preguntar al usuario:** "Módulo MX completado. ¿Deseas continuar con el módulo M(X+1)?"
7. Solo iniciar el siguiente módulo si el usuario lo confirma

### Release

El release se gestiona mediante **GitHub Actions** — no se crean tags manualmente.

**Flujo completo:**
1. Completar todas las tareas del módulo en la feature branch (`XXX-mN-nombre`)
2. Bump versión en `package.json` raíz (MINOR por módulo nuevo, PATCH por hotfix)
3. Actualizar `CHANGELOG.md` con la nueva versión
4. Push la feature branch y crear/actualizar el PR hacia `main`
5. CI (`ci.yml`) ejecuta: lint → build → test — debe pasar en verde
6. Tú apruebas y mergeas el PR
7. `release.yml` detecta el merge a `main`, lee `package.json`, crea tag `vX.Y.Z` y GitHub Release automáticamente

**NO hacer manualmente:**
- `git tag` — lo hace GitHub Actions al merge
- `git push --tags` — lo hace GitHub Actions

**Workflows:**
- `.github/workflows/ci.yml` — PR quality gate (lint, build, test con Postgres+Redis)
- `.github/workflows/release.yml` — Tag + GitHub Release automático al merge a `main`

**Cuándo subir versión en `package.json`:**
- `PATCH`: hotfixes post-release (bugs, a11y, docs, CodeRabbit findings)
- `MINOR`: módulo completo implementado (implementación, tests, build ✅)
- `MAJOR`: rediseño de arquitectura global o cambio de alcance mayor

### CodeRabbit Review Protocol

Cada PR pasa por revisión automática de CodeRabbit. Al recibir findings:

1. **Verificar** cada finding contra el código actual antes de aplicar el fix
2. **Prioridad:** Critical > Major > Minor > Warning
3. **Aplicar** solo los fixes necesarios (no aplicar si el código ya cumple)
4. **Actualizar** CHANGELOG.md con los fixes en la sección `### Fixed`
5. **Commit:** `fix(coderabbit): resolve PR review findings` con lista de issues

**Checks obligatorios que deben pasar en verde:**
- Docstring Coverage ≥ 80% — todas las funciones públicas (`export function`, `export const`) deben tener JSDoc en frontend y TSDoc en backend
- Semantic Versioning — versiones en `spec.md` usan `MAJOR.MINOR.PATCH`
- CHANGELOG estructura — cada entrada incluye `Added/Changed/Fixed/Removed`
- Accessibility — botones icon-only deben tener `aria-label` dinámico + `aria-pressed` para toggles

**Regla de docstrings:**
- Backend (`apps/api/src/**`): JSDoc en todas las funciones exported de `*.service.ts`, `*.controller.ts`, `*.routes.ts`
- Frontend (`apps/web/**`): JSDoc en todos los componentes React exported y hooks custom
- Formato mínimo: `/** @description ... */` o `/** descripción de una línea */`
