# CLAUDE.md — Sophia Platform
# Lee SOLO este archivo al iniciar. Nada más hasta que una tarea lo requiera.

---

## 🚀 ESTADO ACTUAL — LEER AL INICIAR CADA SESIÓN

| Módulo | Branch | Tareas | Versión | Estado |
|--------|--------|--------|---------|--------|
| M1 Auth | `001-m1-auth` | 46/46 | v0.1.0 | ✅ Completo |
| M2 Projects | `002-m2-projects` | 49/49 | v0.2.0 | ✅ Completo |
| M3 Spec Engine | `003-m3-spec-engine` | 31/31 | v0.3.0 | ✅ Completo |
| M4 Agent Runner | `004-m4-agent-runner` | 38/38 | v0.4.0 | ✅ Completo |
| M5 Dashboard | `005-m5-dashboard` | 22/22 | v0.5.0 | ✅ Completo |
| M6 File Manager | `006-m6-file-manager` | 23/23 | v0.6.0 | ✅ Completo |
| M7 Settings | `007-m7-settings` | 26/26 | v0.7.0 | ✅ Completo |
| 008 System Fixes | `008-system-wide-fixes` | 25/25 | v0.8.0 | ✅ Completo |
| M9 Improvements | `009-m9-improvements` | 70/70 | v0.9.0 | ✅ Completo |

**Tests:** 160/160 passing ✅ | **API build:** ✅ | **Web build:** ✅ (11 páginas)
**Próximo módulo:** Definir con el usuario antes de iniciar.

---

## ⚡ REGLAS DE SESIÓN — OBLIGATORIAS

### Al iniciar sesión
1. Lee SOLO este archivo + el plan activo en `docs/superpowers/plans/`
2. NO leas archivos de código hasta que una tarea específica lo requiera
3. Usa `docs/context-map.md` para saber exactamente qué archivos leer por módulo
4. Identifica la próxima tarea `- [ ]` en el plan activo

### Al implementar una tarea
1. Lee SOLO los archivos del módulo activo (ver `docs/context-map.md`)
2. NO leas archivos de otros módulos salvo dependencia explícita documentada
3. Sigue `superpowers:subagent-driven-development`: implementer → spec-reviewer → quality-reviewer

### Al completar una tarea
1. Marca `[X]` en `docs/superpowers/plans/*.md` inmediatamente
2. Actualiza `docs/task-tracker.md` con el nuevo conteo
3. Después de 4 tareas en la misma sesión → `/compact`

### Nunca
- Listar directorios completos para "entender el contexto" — lee `CLAUDE.md`
- Regenerar código ya marcado como `[X]` o `✅`
- Pedir confirmación entre subtareas de la misma tarea
- Explicar lo que vas a hacer antes de hacerlo — solo hazlo
- Leer: `pnpm-lock.yaml`, `node_modules/`, `.next/`, `dist/`, `.git/`

---

## 🌿 FLUJO DE RAMAS Y PR — OBLIGATORIO POR FEATURE

Cada feature o módulo nuevo vive en su propia rama y cierra con un PR automático.

### 1. Crear rama al iniciar feature
```bash
git checkout main
git pull origin main
git checkout -b NNN-nombre-feature
# Ejemplos:
# git checkout -b 010-superpowers-integration
# git checkout -b 011-m10-new-module
# git checkout -b 012-hotfix-auth-cookie
```

### 2. Implementar con Superpowers
Seguir el flujo normal: spec → plan → subagents → TDD → verify.
Commits frecuentes por tarea completada:
```bash
git add .
git commit -m "feat(M10-T001): create brainstorming skill in spec-agent"
# Convención de commits:
# feat(scope):     nueva funcionalidad
# fix(scope):      corrección de bug
# test(scope):     nuevos tests
# docs(scope):     documentación
# refactor(scope): refactor sin cambio funcional
# chore(scope):    mantenimiento (deps, config)
```

### 3. Cerrar feature — prompt para Superpowers
Al completar todas las tareas, pegar esto en Claude Code:
```
Usa superpowers:finishing-a-development-branch.

El módulo/feature está completo. Ejecuta en este orden exacto
y muéstrame la salida real de cada comando:

VERIFICACIÓN (no continuar si algo falla):
1. pnpm --filter @sophia/api lint
2. pnpm --filter @sophia/api build
3. pnpm --filter @sophia/api test
4. pnpm --filter @sophia/web lint
5. pnpm --filter @sophia/web build

Si TODO pasa en verde:

DOCUMENTACIÓN:
6. Actualizar CLAUDE.md → sección Estado Actual (nueva fila o actualizar estado)
7. Actualizar docs/task-tracker.md con nuevo conteo
8. Actualizar CHANGELOG.md con nueva entrada de versión
9. Bump versión en package.json (MINOR si es módulo, PATCH si es fix)

COMMIT Y PUSH:
10. git add .
11. git commit -m "feat(NNN): [nombre] — all tasks complete"
12. git push origin [branch-actual]

PR (preguntarme antes de ejecutar):
13. gh pr create \
    --title "feat(NNN): [Nombre del módulo/feature] — vX.Y.0" \
    --body "$(cat .github/pull_request_template.md)" \
    --base main \
    --label "feature"

NO hagas commit ni PR si algún check falla.
Pregúntame antes del paso 12 (push) y antes del paso 13 (PR).
```

### 4. Después del PR
```
CI (ci.yml) → lint + build + test automático en verde
CodeRabbit  → review automático — aplicar findings antes de merge
Tú          → apruebas y mergeas
release.yml → crea tag vX.Y.Z + GitHub Release automáticamente
```

### Convención de nombres de rama
```
NNN-descripcion-kebab-case

Módulos:  001-m1-auth, 009-m9-improvements, 010-m10-feature
Hotfixes: 011-hotfix-auth-cookie-expiry
Chores:   012-chore-update-dependencies
```

---

## 🔧 COMANDOS

```bash
# Desarrollo
pnpm dev                         # Dev completo (web + api + worker)
pnpm dev:clean                   # Dev con limpieza de caché .next
pnpm db:migrate                  # Prisma migrations
pnpm db:seed                     # Seed datos
pnpm docker:up                   # PostgreSQL + Redis via Docker
pnpm docker:down                 # Bajar contenedores

# Calidad (ejecutar antes de cada commit)
pnpm --filter @sophia/api lint   # Lint backend
pnpm --filter @sophia/web lint   # Lint frontend
pnpm --filter @sophia/api build  # Build backend (tsc --noEmit)
pnpm --filter @sophia/web build  # Build frontend (next build)
pnpm --filter @sophia/api test   # Tests backend

# Git y GitHub CLI
git checkout -b NNN-feature      # Nueva rama
git push origin NNN-feature      # Push rama
gh pr create --base main         # Crear PR
gh pr list                       # Ver PRs abiertos
gh pr status                     # Estado del PR actual
gh pr view --web                 # Abrir PR en browser
```

> **Clean build:** Si cambias `app/**/page.tsx` o layouts, ejecutar
> `rm -rf apps/web/.next && pnpm --filter @sophia/web build`

> **GitHub CLI:** Si no está instalado → `brew install gh && gh auth login`

---

## 🏗️ QUÉ ES ESTE PROYECTO

**Sophia Platform** — plataforma web autónoma de generación de software con agentes IA.
El usuario describe un sistema, Sophia orquesta 9 agentes Claude (Tool Use) que generan el código capa a capa.

### Stack
| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Framer Motion, Recharts |
| Backend | Node.js 22, Fastify, TypeScript, Prisma ORM |
| DB | PostgreSQL 16, Redis 7 |
| Queue | BullMQ (worker separado) |
| AI | Anthropic SDK — Claude Tool Use |
| WebSocket | @fastify/websocket |
| Email | Resend (prod) / console.log (dev) |
| Deploy | Railway (backend + DB + Redis) + Vercel (frontend) |

### Estructura del repositorio
```
sophia-platform/
├── .github/
│   ├── pull_request_template.md   # Template automático para PRs
│   └── workflows/
│       ├── ci.yml                 # lint + build + test en cada PR
│       └── release.yml            # tag + GitHub Release al merge a main
├── apps/web/                      # Frontend Next.js 15
├── apps/api/                      # Backend Fastify + BullMQ Worker
│   ├── src/agents/                # 9 agentes + orchestrator + dependency-graph
│   ├── src/modules/               # auth, projects, specs, agents, files, settings
│   ├── src/websocket/             # ws.emitter, ws.routes, ws.auth
│   ├── src/lib/                   # anthropic.ts (singleton), shutdown-state.ts
│   └── prisma/                    # schema.prisma + migrations
├── packages/shared/               # Tipos y constantes (@sophia/shared)
├── skills/                        # Prompts de los 9 agentes del pipeline
│   ├── _shared/                   # conventions.md, anti-patterns.md, output-format.md
│   ├── dba-agent/                 # Layer 1
│   ├── seed-agent/                # Layer 1.5
│   ├── backend-agent/             # Layer 2
│   ├── frontend-agent/            # Layer 3
│   ├── qa-agent/                  # Layer 4
│   ├── security-agent/            # Layer 4.5
│   ├── docs-agent/                # Layer 5
│   ├── deploy-agent/              # Layer 6
│   ├── integration-agent/         # Layer 7
│   └── spec-agent/                # M3: spec.md, data-model, api-design
├── specs/                         # Specs de módulos 001→009+
├── docs/                          # Documentación, certifications, context-map, ADRs
│   └── superpowers/plans/         # Planes de implementación (driver de ejecución)
└── projects/                      # Código generado en runtime (gitignored)
```

### Pipeline de agentes (M9 — con paralelismo)
```
Layer 1:     dba-agent          → schema.prisma, migrations
Layer 1.5:   seed-agent         → factories.ts, test-constants.ts
Layer 2:     backend-agent      → routes, controllers, services, schemas
Layer 3:     frontend-agent     → pages, components, hooks, stores
Layer 4‖4.5: qa ‖ security      → PARALELO
Layer 5‖6:   docs ‖ deploy      → PARALELO
Layer 7:     integration-agent  → cross-layer validation + certification.md
```

### Variables de entorno (apps/api/.env)
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/sophia_dev
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=<random-32-chars>
JWT_REFRESH_SECRET=<random-32-chars>
ENCRYPTION_KEY=<64-hex-chars>
ANTHROPIC_API_KEY=sk-ant-...
PROJECTS_BASE_DIR=./projects
RESEND_API_KEY=re_xxxxx
FRONTEND_URL=http://localhost:3000
PORT=3001
CLAUDE_CALL_TIMEOUT_MS=120000
CRITERIA_COVERAGE_THRESHOLD=80
AGENT_MEMORY_WARN_MB=200
AGENT_MEMORY_TRUNCATE_MB=500
```

---

## ⚙️ SUPERPOWERS — WORKFLOW OBLIGATORIO

**Versión:** v5.0.7 | **Constitution:** `.specify/memory/constitution.md`

### Flujo por feature (orden obligatorio)
1. **Branch** → `git checkout -b NNN-feature-name`
2. **Spec** → `specs/<branch>/spec.md`
3. **Plan** → `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`
4. **Execute** → `superpowers:subagent-driven-development`
5. **Verify** → `superpowers:verification-before-completion` en cada fase
6. **Debug** → `superpowers:systematic-debugging` si hay issues
7. **Parallel** → `superpowers:dispatching-parallel-agents` para tareas independientes
8. **Finish + PR** → `superpowers:finishing-a-development-branch` → `gh pr create`

### Skills activas (7/14)
| Skill | Cuándo usar |
|-------|------------|
| `subagent-driven-development` | Implementar cada tarea |
| `test-driven-development` | TODO código nuevo — RED-GREEN-REFACTOR |
| `verification-before-completion` | Checkpoint de cada fase |
| `systematic-debugging` | Bugs, build errors, tests fallando |
| `dispatching-parallel-agents` | Tareas independientes en paralelo |
| `finishing-a-development-branch` | Cerrar feature → PR |
| `requesting-code-review` | Antes de abrir PR |

### Skills pendientes de activar (7/14)
| Skill | Dónde aplicar en Sophia |
|-------|------------------------|
| `brainstorming` | `skills/spec-agent/system.md` |
| `handling-an-ambiguous-request` | `skills/spec-agent/system.md` |
| `writing-plans` | `START_PROJECT_PROMPT.md` |
| `executing-plans` | Orchestrator |
| `creating-a-minimal-test-case` | `skills/qa-agent/task.md` |
| `investigating-why-tests-fail` | Quality gate + QA skill |
| `doing-a-task` | `skills/_shared/output-format.md` |

---

## 📐 PATRONES DE CÓDIGO

> Ver completo: `skills/_shared/conventions.md` · `skills/_shared/anti-patterns.md` · `skills/_shared/output-format.md`

### Backend
```
src/modules/{nombre}/
├── {nombre}.routes.ts      → rutas Fastify
├── {nombre}.controller.ts  → handlers thin
├── {nombre}.service.ts     → lógica (Prisma directo, NO repository)
└── {nombre}.schema.ts      → Zod schemas
```
- Auth: cookies httpOnly `access_token` — **NUNCA Bearer**
- Respuestas: `{ data }` · `{ error, message }` · `{ error, errors[] }`

### Frontend
- Server components por defecto — `"use client"` solo si necesario
- `fetch(url, { credentials: 'include' })` — **NUNCA Bearer**
- Siempre 3 estados: loading · error · data

### Agentes (apps/api/src/agents/)
- `base-agent.ts` → Tool Use loop, AbortController, SIGTERM, memory monitoring
- `orchestrator.ts` → AGENT_GRAPH, Promise.all paralelo, quality gate
- `dependency-graph.ts` → `getNextLayers(completed: Set<number>)`
- `context-builder.ts` → token budget 40K, priorización, project_memory.md
- `criteria-extractor.ts` → `extractCriteria(spec): CriteriaMap`
- `certification-report.ts` → `generateCertificationReport(criteriaMap, testMapping)`

---

## 📋 TRACKING Y RELEASES

### Archivos a actualizar
| Archivo | Cuándo |
|---------|--------|
| `docs/superpowers/plans/*.md` | Al completar cada tarea `[X]` — inmediato |
| `docs/task-tracker.md` | Al completar cada fase |
| `CHANGELOG.md` | Al cerrar sprint |
| `docs/context-map.md` | Al agregar dependencias cross-module |
| `docs/system-design.html` | Al cambiar arquitectura o ERD |
| `CLAUDE.md` (Estado Actual) | Al completar un módulo |

### Checklist al completar un módulo
```bash
pnpm --filter @sophia/api lint    # → zero violations
pnpm --filter @sophia/api build   # → zero errors
pnpm --filter @sophia/api test    # → all pass
pnpm --filter @sophia/web lint    # → zero violations
pnpm --filter @sophia/web build   # → zero errors
# → bump package.json (MINOR)
# → actualizar CHANGELOG.md + CLAUDE.md
# → git commit + push + gh pr create
```

### Versionamiento
- `MAJOR` → rediseño de arquitectura global
- `MINOR` → módulo completo implementado
- `PATCH` → bugs, docs, CodeRabbit findings

### Release automático
- `ci.yml` → lint + build + test en cada PR
- `release.yml` → tag + GitHub Release al merge a `main`
- **NO crear tags manualmente**

### CodeRabbit
- Prioridad: Critical > Major > Minor
- Commit: `fix(coderabbit): resolve PR review findings`
- Docstrings ≥ 80% en funciones exported (backend + frontend)

---

## 🔄 RECENT CHANGES

- **v0.9.0 (M9):** paralelismo QA‖Security + Docs‖Deploy, shared skills, memory persistence, quality gate, lifecycle resilience (SIGTERM, per-call timeout 2min, memory monitoring), criteria extractor, certification report, singleton Anthropic client thread-safe
- **v0.8.0 (008):** session persistence, API key resilience, SSE errors, `dev:clean`, visual refresh
- **v0.7.0 (M7):** settings — API key AES-256-GCM, token usage, profile
- **v0.6.0 (M6):** file manager — tree view, shiki syntax, ZIP download
- **v0.5.0 (M5):** dashboard — Canvas API 9 nodos, WebSocket real-time, logs, métricas