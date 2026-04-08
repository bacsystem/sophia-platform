# Implementation Plan: M6 File Manager

**Branch**: `006-m6-file-manager` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/006-m6-file-manager/spec.md`

## Summary

Gestor de archivos generados: árbol colapsable, syntax highlighting (shiki), descarga individual y ZIP streaming. Metadata en BD (generated_files), contenido en filesystem. Íconos Lucide React unificados con M5 desde mapa shared.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22
**Primary Dependencies**: Fastify, Prisma ORM, archiver (ZIP), shiki, @tanstack/react-virtual, Lucide React, Next.js 15
**Storage**: PostgreSQL 16 (generated_files de M4), Filesystem ({PROJECTS_BASE_DIR}/{projectId}/)
**Testing**: Vitest
**Target Platform**: Web (Fastify API + Next.js frontend)
**Project Type**: web-service + web-app (monorepo Turborepo)
**Performance Goals**: ZIP streaming (sin buffered en memoria), virtualización > 500 líneas
**Constraints**: Path traversal prevention, archivos > 1MB truncados en viewer, ZIP solo status done|paused
**Scale/Scope**: MVP — 3 HUs, 4 endpoints, 0 tablas nuevas (usa generated_files)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Auth por Cookies | ✅ PASS | Endpoints protegidos via cookie |
| II. Prisma Directo | ✅ PASS | file.service.ts con Prisma directo |
| III. Pipeline 9 Agentes | N/A | M6 es consumer de archivos generados |
| IV. pnpm Exclusivo | ✅ PASS | |
| V. Patrón Backend | ✅ PASS | routes → controller → service → schema. Respuestas `{ data }` |
| VI. Frontend Server-First | ✅ PASS | Server components por defecto |
| VII. Seguridad Default | ✅ PASS | Path traversal prevention, ownership validation |

## Project Structure

### Documentation (this feature)

```text
specs/006-m6-file-manager/
├── spec.md
├── plan.md              # This file
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/modules/files/
├── file.routes.ts
├── file.controller.ts
├── file.service.ts           # Construir árbol, leer contenido, generar ZIP
└── file.schema.ts

apps/web/
├── app/(dashboard)/projects/[id]/files/
│   └── page.tsx
├── components/files/
│   ├── file-tree.tsx
│   ├── file-tree-node.tsx
│   ├── file-viewer.tsx
│   ├── file-breadcrumb.tsx
│   ├── file-search.tsx
│   └── download-button.tsx
└── lib/
    └── file-tree-builder.ts
```

## API Contracts

| Method | Path | Status | Response |
|--------|------|--------|----------|
| GET | /api/projects/:id/files | 200 | `{ data: { tree, totalFiles, totalSizeBytes } }` |
| GET | /api/projects/:id/files/:fileId | 200 | `{ data: { id, name, path, content, extension, ... } }` |
| GET | /api/projects/:id/files/:fileId/raw | 200 | Binary stream + Content-Disposition |
| GET | /api/projects/:id/download | 200 | ZIP stream + Content-Disposition |

## Architecture Decisions

1. **Árbol construido server-side** — flat list de generated_files → tree structure agrupando por directorios
2. **ZIP streaming** — archiver en modo stream, no buffered en memoria
3. **Cache condicional** — `Cache-Control: private, max-age=3600` si done; `no-cache` si running/queued
4. **ETag** — basado en `generated_files.created_at` para revalidación
5. **Virtualización** — @tanstack/react-virtual para archivos > 500 líneas
6. **Mapa de íconos unificado** — packages/shared/constants/file-icons.ts compartido con M5

## Dependencies

- **M1**: Auth — protección endpoints
- **M2**: Projects — estado del proyecto (status)
- **M4**: Agent Runner — tabla generated_files, filesystem de archivos generados
