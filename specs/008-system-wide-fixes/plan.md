# Implementation Plan: Correcciones del Sistema — Errores Runtime

**Branch**: `008-system-wide-fixes` | **Date**: 2026-04-09 | **Spec**: `specs/008-system-wide-fixes/spec.md`
**Input**: Feature specification from `/specs/008-system-wide-fixes/spec.md`

## Summary

Corregir 6 errores runtime concretos reportados por el usuario: (1) 503 genérico al verificar API key con Anthropic — agregar 1 retry con mensajes diferenciados; (2) errors silenciados en generación de specs — agregar pre-validación de ANTHROPIC_API_KEY y mejorar error events en SSE; (3) pérdida de sesiones por expiración de access token — agregar refresh proactivo al 80% del TTL en frontend; (4) 404 en chunks y pérdida de CSS — agregar script `dev:clean` para limpieza de caché. No se requieren cambios en schema de BD, migraciones, ni nueva infraestructura.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 22, Next.js 15
**Primary Dependencies**: Fastify, Prisma, Anthropic SDK, Zustand, Tailwind CSS, shadcn/ui
**Storage**: PostgreSQL 16, Redis 7 (rate limiting + sessions)
**Testing**: Vitest (16 files, 160 tests — must maintain zero regressions)
**Target Platform**: Web application (server: Node.js, client: browser)
**Project Type**: web-service (monorepo: `apps/api` + `apps/web` + `packages/shared`)
**Performance Goals**: API key verification ≤15s total (including retry); spec error visible ≤5s; session refresh transparent
**Constraints**: No breaking changes to existing API contracts; no new DB migrations; 160 existing tests must pass
**Scale/Scope**: 4 User Stories, ~12 archivos modificados, 1 endpoint nuevo, 1 hook nuevo, 1 script nuevo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Relevancia | Estado |
|---|---|---|
| I. Auth por Cookies | US3 — refresh proactivo usa cookies httpOnly | ✅ Compatible |
| II. Prisma Directo | Sin repository layer — no aplica | ✅ N/A |
| III. Pipeline 9 Agentes | Sin cambios al pipeline | ✅ N/A |
| IV. pnpm Exclusivo | Script `dev:clean` usa `turbo dev` vía pnpm | ✅ Compatible |
| V. Patrón Backend | Nuevo endpoint sigue routes → controller → service | ✅ Compatible |
| VI. Frontend Server-First | `useTokenRefresh` hook es `"use client"` por necesidad (timer) | ✅ Justificado |
| VII. Seguridad por Defecto | Sin cambios a encriptación/rate-limiting | ✅ Compatible |

**GATE**: ✅ PASS — Sin violaciones de constitución.

### Re-check Post-Design

| Principio | Estado Post-Design |
|---|---|
| I. Auth por Cookies | ✅ — `GET /api/auth/session` protegido con cookie auth |
| V. Patrón Backend | ✅ — Endpoint sigue patrón `auth.routes.ts → auth.controller.ts → auth.service.ts` |
| VI. Frontend Server-First | ✅ — Hook con `"use client"` justificado (necesita `setTimeout`) |

**GATE POST-DESIGN**: ✅ PASS

## Project Structure

### Documentation (this feature)

```text
specs/008-system-wide-fixes/
├── plan.md              # This file
├── research.md          # Phase 0 output — decisions on retry, SSE errors, proactive refresh
├── data-model.md        # Phase 1 output — no schema changes needed
├── quickstart.md        # Phase 1 output — implementation order guide
├── contracts/
│   └── api-spec.json    # OpenAPI 3.0 — behavioral changes + 1 new endpoint
└── tasks.md             # Phase 2 output (pending /speckit.tasks)
```

### Source Code (archivos a modificar)

```text
apps/api/
├── src/
│   ├── modules/
│   │   ├── settings/
│   │   │   └── settings.service.ts      # US1: verify retry + error differentiation
│   │   ├── spec/
│   │   │   └── spec.service.ts          # US2: pre-validate ANTHROPIC_API_KEY + error messages
│   │   └── auth/
│   │       ├── auth.routes.ts           # US3: GET /api/auth/session endpoint
│   │       ├── auth.controller.ts       # US3: session handler
│   │       └── auth.service.ts          # US3: getSession logic
│   └── lib/
│       └── jwt.ts                       # US3: export ACCESS_TTL_SECONDS (already exported)
└── src/modules/auth/__tests__/          # US3: session endpoint tests

apps/web/
├── hooks/
│   └── use-token-refresh.ts             # US3: NEW — proactive refresh hook
├── app/(dashboard)/
│   └── layout.tsx                       # US3: integrate useTokenRefresh
└── components/spec/                     # US2: verify error event handling

package.json                             # US4: add dev:clean script
```

**Structure Decision**: Monorepo existente de Sophia Platform. No se crean nuevos módulos, solo se modifican archivos existentes + 1 hook nuevo + 1 endpoint nuevo.

## Complexity Tracking

No hay violaciones de constitución. Tabla vacía por diseño.
