# Sophia Platform

Sistema autónomo de generación de software impulsado por IA (Claude Code). Sophia orquesta agentes especializados que generan código capa por capa usando Claude con Tool Use.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Framer Motion, Lucide React, Recharts |
| Backend | Node.js 22, Fastify, TypeScript, Prisma ORM |
| Base de datos | PostgreSQL 16, Redis 7 |
| Cola de trabajos | BullMQ (proceso worker separado) |
| IA | Anthropic SDK — Claude con Tool Use |
| WebSockets | @fastify/websocket |
| Deploy | Railway (backend) + Vercel (frontend) |
 
## Estructura

```
sophia-platform/
├── apps/web/              # Frontend Next.js
├── apps/api/              # Backend Fastify + BullMQ worker
├── packages/shared/       # Tipos y constantes compartidas
├── skills/                # Prompts de los 6 agentes (system.md + task.md)
├── specs/                 # Specs de módulos (M1-M7)
├── deployment/            # Dockerfiles + config de deploy
├── projects/              # Código generado por agentes (gitignored)
└── docs/                  # Documentación
```

## Módulos

| # | Módulo | Sprint | HUs |
|---|--------|--------|-----|
| M1 | Auth | 1 | HU-01 → HU-05 |
| M2 | Projects | 1 | HU-06 → HU-10 |
| M3 | Spec Engine | 2 | HU-11 → HU-13 |
| M4 | Agent Runner | 3 | HU-14 → HU-17 |
| M5 | Dashboard | 4 | HU-18 → HU-22 |
| M6 | File Manager | 4 | HU-23 → HU-25 |
| M7 | Settings | 4 | HU-26 → HU-28 |

## Quick Start

```bash
# 1. Instalar dependencias
pnpm install

# 2. Levantar PostgreSQL + Redis
pnpm docker:up

# 3. Copiar variables de entorno
cp .env.example .env

# 4. Ejecutar migraciones
pnpm db:migrate

# 5. Desarrollo
pnpm dev
```

## Agentes (6 capas secuenciales)

```
Layer 1: Database    → dba-agent
Layer 2: Backend     → backend-agent
Layer 3: Frontend    → frontend-agent
Layer 4: Testing     → qa-agent
Layer 5: Docs        → docs-agent
Layer 6: Deployment  → deploy-agent
```

Cada agente usa Claude con Tool Use. No genera texto plano — crea archivos iterativamente a través de herramientas (`createFile`, `readFile`, `listFiles`, `taskComplete`).
