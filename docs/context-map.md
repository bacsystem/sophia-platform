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
  skills/backend-agent/system.md
  apps/api/src/modules/agents/        → orquestador, base-agent, 6 agent runners
  apps/api/src/modules/websocket/     → eventos en tiempo real
  apps/api/src/worker/                → BullMQ worker (proceso separado)
  packages/shared/src/types/agents.ts

Dependencias explícitas:
  apps/api/src/modules/projects/projects.service.ts  → cambiar status del proyecto
  skills/*-agent/system.md + task.md                 → prompts de los 6 agentes
```

## M5 — Dashboard Canvas (HU-18→22)

```
Lee:
  specs/005-m5-dashboard/spec.md
  skills/frontend-agent/system.md
  apps/web/src/app/dashboard/
  apps/web/src/components/dashboard/agent-canvas.tsx  → Canvas API nativo
  apps/web/src/hooks/use-agent-events.ts              → WebSocket listener
  apps/web/src/stores/agent-store.ts                  → Zustand

NO leas: nada del backend salvo tipos compartidos
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
  apps/api/src/plugins/websocket.ts         → plugin @fastify/websocket
  apps/api/src/modules/websocket/websocket.routes.ts
  apps/web/src/hooks/use-agent-events.ts    → hook del cliente
  packages/shared/src/types/events.ts       → tipos de eventos compartidos

NO leas: lógica de agentes ni dashboard (solo los tipos de eventos)
```

## Crear / modificar un agente de Sophia (runtime)

```
Lee:
  skills/<agente>-agent/system.md + task.md  → prompt del agente
  apps/api/src/modules/agents/base-agent.ts  → clase base
  apps/api/src/modules/agents/dba-agent.ts   → ejemplo de implementación
  specs/004-m4-agent-runner/spec.md

NO existe "spec-agent" — los 6 agentes son: dba, backend, frontend, qa, docs, deploy
```

## Deploy / Docker

```
Lee:
  deployment/Dockerfile.api
  deployment/Dockerfile.worker
  docker-compose.yml
  .env.example

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
