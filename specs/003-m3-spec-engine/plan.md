# Implementation Plan: M3 Spec Engine

**Branch**: `003-m3-spec-engine` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-m3-spec-engine/spec.md`

## Summary

Motor de generación de specs con IA (Anthropic SDK). Convierte descripción en lenguaje natural en 3 documentos técnicos (spec.md, data-model.md, api-design.md) via 3 llamadas secuenciales a Claude. SSE streaming, versionamiento, validación de output, templates predefinidos con íconos Lucide React.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22
**Primary Dependencies**: Fastify, Prisma ORM, Anthropic SDK (streaming), @uiw/react-md-editor, Next.js 15, Zod
**Storage**: PostgreSQL 16 (project_specs, templates), Redis 7 (rate limiting generación)
**Testing**: Vitest
**Target Platform**: Web (Fastify API + Next.js frontend)
**Project Type**: web-service + web-app (monorepo Turborepo)
**Performance Goals**: Timeout 90s por documento, streaming visible < 2s primer chunk
**Constraints**: 10 generaciones/proyecto/hora, 50/usuario/día, max 50K chars por doc
**Scale/Scope**: MVP — 3 HUs, 7 endpoints, 2 tablas, 5 templates seed

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Auth por Cookies | ✅ PASS | Endpoints protegidos via cookie |
| II. Prisma Directo | ✅ PASS | spec.service.ts con Prisma directo |
| III. Pipeline 9 Agentes | N/A | M3 usa Claude directamente (no el orquestador M4) |
| IV. pnpm Exclusivo | ✅ PASS | |
| V. Patrón Backend | ✅ PASS | routes → controller → service → schema. Respuestas `{ data }` |
| VI. Frontend Server-First | ✅ PASS | |
| VII. Seguridad Default | ✅ PASS | Rate limiting, validación Zod |

## Project Structure

### Documentation (this feature)

```text
specs/003-m3-spec-engine/
├── spec.md
├── plan.md              # This file
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/
├── modules/spec/
│   ├── spec.routes.ts
│   ├── spec.controller.ts
│   ├── spec.service.ts
│   ├── spec.schema.ts
│   ├── spec.validator.ts         # Validación secciones obligatorias
│   └── spec.stream.ts            # SSE emitter
├── modules/templates/
│   ├── template.routes.ts
│   ├── template.controller.ts
│   └── template.service.ts
└── lib/
    └── anthropic.ts              # Cliente Anthropic SDK singleton

apps/web/
├── components/spec/
│   ├── spec-viewer.tsx
│   ├── spec-editor.tsx
│   ├── spec-stream.tsx
│   ├── spec-version-selector.tsx
│   └── template-gallery.tsx
└── hooks/
    └── use-spec-stream.ts        # Hook SSE

skills/spec-agent/
├── system.md
├── spec.md
├── data-model.md
└── api-design.md

prisma/
└── seed.ts                       # 5 templates predefinidos
```

## Data Model

### project_specs (definida en M2)
- `id` UUID PK, `project_id` FK, `version` INT, `content` JSONB, `source`, `valid`, `created_at`

### templates (seed data, solo lectura)
- `id` UUID PK, `name` VARCHAR(255), `description` TEXT, `icon` VARCHAR(50) Lucide component
- `stack` VARCHAR(50), `tags` TEXT[], `defaults` JSONB `{ agents, model }`
- `created_at` TIMESTAMPTZ

## API Contracts

| Method | Path | Status | Response |
|--------|------|--------|----------|
| POST | /api/projects/:id/spec/generate | 202 | `{ data: { jobId, message } }` |
| GET | /api/projects/:id/spec/stream | SSE | Event stream (start/chunk/validated/done/error) |
| GET | /api/projects/:id/spec | 200 | `{ data: { version, files, createdAt } }` |
| GET | /api/projects/:id/spec/versions | 200 | `{ data: [...] }` |
| GET | /api/projects/:id/spec/:version | 200 | `{ data: { version, files, source, valid, createdAt } }` |
| PUT | /api/projects/:id/spec | 200 | `{ data: { version, source, createdAt } }` |
| GET | /api/templates | 200 | `{ data: [...] }` |

## Architecture Decisions

1. **3 llamadas secuenciales** — spec→data-model→api-design, cada una recibe contexto del anterior
2. **SSE para streaming** — no WebSocket; spec generation es request-response, no bidireccional
3. **Validación de output** — schema de secciones obligatorias, retry con prompt corregido si falla
4. **Templates como seed** — tabla solo lectura, sin CRUD de usuario en MVP
5. **Íconos Lucide React** — campo `icon` con nombre de componente (Building2, Rocket, etc.), no emojis

## Dependencies

- **M1**: Auth — usuario autenticado
- **M2**: Projects — proyecto creado, tabla project_specs
