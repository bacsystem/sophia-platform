# Implementation Plan: M2 Projects

**Branch**: `002-m2-projects` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-m2-projects/spec.md`

## Summary

CRUD completo de proyectos con máquina de estados (idle→running→paused→done→error), paginación server-side, soft delete y stubs de ejecución que M4 reemplazará. Validación Zod con dual refine para agentes (obligatorios + generadores).

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22
**Primary Dependencies**: Fastify, Prisma ORM, Zod, Next.js 15, React Hook Form, shadcn/ui, Zustand
**Storage**: PostgreSQL 16 (projects, project_specs), Redis 7
**Testing**: Vitest (unit + integration)
**Target Platform**: Web (Fastify API + Next.js frontend)
**Project Type**: web-service + web-app (monorepo Turborepo)
**Performance Goals**: < 200ms p95 listado con paginación, ILIKE search < 100ms
**Constraints**: Cookies httpOnly auth, Prisma directo, 9 agentes en pipeline, pnpm exclusivo
**Scale/Scope**: MVP — 5 HUs, 9 endpoints, 2 tablas, 3 páginas frontend

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Auth por Cookies | ✅ PASS | Todos los endpoints protegidos via cookie access_token |
| II. Prisma Directo | ✅ PASS | project.service.ts con Prisma directo |
| III. Pipeline 9 Agentes | ✅ PASS | Config acepta 9 agentes; seed/security/integration obligatorios |
| IV. pnpm Exclusivo | ✅ PASS | |
| V. Patrón Backend | ✅ PASS | routes → controller → service → schema. Respuestas `{ data }` |
| VI. Frontend Server-First | ✅ PASS | Server components, "use client" solo para forms e interactividad |
| VII. Seguridad Default | ✅ PASS | Ownership validation, soft delete, Zod validation |

## Project Structure

### Documentation (this feature)

```text
specs/002-m2-projects/
├── spec.md
├── plan.md              # This file
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/modules/projects/
├── project.routes.ts
├── project.controller.ts
├── project.service.ts
└── project.schema.ts

apps/web/
├── app/(dashboard)/
│   ├── projects/page.tsx              # Listado (HU-07)
│   ├── projects/new/page.tsx          # Crear proyecto (HU-06)
│   └── projects/[id]/page.tsx         # Detalle con tabs (HU-08)
├── components/projects/
│   ├── project-card.tsx
│   ├── project-form.tsx
│   ├── project-list.tsx
│   ├── project-detail.tsx
│   ├── project-tabs.tsx
│   └── delete-project-modal.tsx
└── hooks/
    └── use-projects.ts
```

## Data Model

### projects
- `id` UUID PK, `user_id` FK→users, `name` VARCHAR(100), `description` TEXT
- `stack` VARCHAR(50), `status` VARCHAR(20) default 'idle', `progress` INT default 0
- `current_layer` REAL default 1, `config` JSONB `{ model, agents }`
- `deleted_at` TIMESTAMPTZ nullable (soft delete)
- `created_at`, `updated_at` TIMESTAMPTZ

### project_specs
- `id` UUID PK, `project_id` FK→projects, `version` INT auto-incremental
- `content` JSONB `{ spec, dataModel, apiDesign }`, `source` VARCHAR(20), `valid` BOOLEAN
- `created_at` TIMESTAMPTZ

## API Contracts

| Method | Path | Status | Response |
|--------|------|--------|----------|
| GET | /api/projects | 200 | `{ data: [...], meta: { total, page, limit, pages } }` |
| POST | /api/projects | 201 | `{ data: { id, name, stack, status, ... } }` |
| GET | /api/projects/:id | 200 | `{ data: { ...project, spec, agents } }` |
| PATCH | /api/projects/:id | 200 | `{ data: { ...project } }` |
| DELETE | /api/projects/:id | 200 | `{ data: { message } }` |
| POST | /api/projects/:id/start | 200 | `{ data: { id, status } }` (stub) |
| POST | /api/projects/:id/pause | 200 | `{ data: { id, status } }` (stub) |
| POST | /api/projects/:id/continue | 200 | `{ data: { id, status } }` (stub) |
| GET | /api/projects/:id/download | 200 | ZIP stream (implementado en M6) |

## Architecture Decisions

1. **Máquina de estados** — idle→running→paused→done→error con transiciones validadas
2. **Soft delete** — `deleted_at` timestamp, queries filtran con `WHERE deleted_at IS NULL`
3. **Stubs de ejecución** — start/pause/continue solo cambian status en M2; M4 reemplaza con lógica real
4. **Paginación server-side** — OFFSET/LIMIT con total count, 12 items por página
5. **ILIKE search** — búsqueda por nombre case-insensitive en PostgreSQL
6. **Zod dual refine** — valida agentes obligatorios (seed/security/integration) + al menos 1 generador

## Dependencies

- **M1**: Auth — middleware de autenticación, userId del JWT
- **M4**: Reemplaza stubs de start/pause/continue
- **M6**: Implementa GET /download (M2 solo declara ruta)
