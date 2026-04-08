# Implementation Plan: M7 Settings

**Branch**: `007-m7-settings` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-m7-settings/spec.md`

## Summary

Configuración de plataforma: gestión de API key Anthropic (AES-256-GCM), visualización de uso de tokens con costos estimados (Recharts), y edición de perfil con cambio de contraseña. Reutiliza encryption.service.ts y tabla user_settings del Sprint 2.5.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22
**Primary Dependencies**: Fastify, Prisma ORM, crypto (AES-256-GCM), Anthropic SDK (verificación key), Recharts, Next.js 15, Zod
**Storage**: PostgreSQL 16 (user_settings, agents para aggregation), Redis 7 (rate limit verificación)
**Testing**: Vitest (incluyendo encrypt/decrypt roundtrip)
**Target Platform**: Web (Fastify API + Next.js frontend)
**Project Type**: web-service + web-app (monorepo Turborepo)
**Performance Goals**: Aggregation SQL con SUM/GROUP BY (no cargar todas las ejecuciones)
**Constraints**: API key nunca en logs ni responses completa, ENCRYPTION_KEY solo en .env, rate limit 5 verificaciones/hora
**Scale/Scope**: MVP — 3 HUs, 8 endpoints, 1 tabla (user_settings ya existe via Sprint 2.5)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Auth por Cookies | ✅ PASS | Endpoints protegidos via cookie |
| II. Prisma Directo | ✅ PASS | settings.service.ts con Prisma directo |
| III. Pipeline 9 Agentes | N/A | M7 gestiona settings, no agentes |
| IV. pnpm Exclusivo | ✅ PASS | |
| V. Patrón Backend | ✅ PASS | routes → controller → service → schema. Respuestas `{ data }` |
| VI. Frontend Server-First | ✅ PASS | Server components por defecto |
| VII. Seguridad Default | ✅ PASS | AES-256-GCM, bcrypt verify para cambio de password, rate limiting |

## Project Structure

### Documentation (this feature)

```text
specs/007-m7-settings/
├── spec.md
├── plan.md              # This file
└── tasks.md
```

### Source Code (repository root)

```text
apps/api/src/
├── lib/
│   └── encryption.service.ts     # AES-256-GCM (Sprint 2.5, reutilizado)
└── modules/settings/
    ├── settings.routes.ts
    ├── settings.controller.ts
    ├── settings.service.ts
    └── settings.schema.ts

apps/web/
├── app/(dashboard)/settings/
│   └── page.tsx
├── components/settings/
│   ├── api-key-section.tsx
│   ├── usage-overview.tsx
│   ├── usage-chart.tsx
│   ├── profile-form.tsx
│   └── password-form.tsx

packages/shared/constants/
└── pricing.ts                    # ANTHROPIC_PRICING constantes
```

## Data Model

### user_settings (creada en Sprint 2.5)
- `id` UUID PK, `user_id` FK→users UNIQUE
- `anthropic_api_key_encrypted` BYTEA, `anthropic_api_key_iv` BYTEA (12 bytes)
- `anthropic_api_key_tag` BYTEA (16 bytes), `anthropic_api_key_last4` VARCHAR(4)
- `created_at`, `updated_at` TIMESTAMPTZ

## API Contracts

| Method | Path | Status | Response |
|--------|------|--------|----------|
| GET | /api/settings | 200 | `{ data: { apiKey: { configured, last4, verifiedAt }, profile: { name, email } } }` |
| PUT | /api/settings/api-key | 200 | `{ data: { configured, last4, verifiedAt } }` |
| DELETE | /api/settings/api-key | 200 | `{ data: { message } }` |
| POST | /api/settings/api-key/verify | 200 | `{ data: { valid, verifiedAt } }` |
| GET | /api/settings/usage | 200 | `{ data: { totals, byProject } }` |
| GET | /api/settings/usage/daily | 200 | `{ data: [...daily] }` |
| PUT | /api/settings/profile | 200 | `{ data: { id, name, email, updatedAt } }` |
| PUT | /api/settings/password | 200 | `{ data: { message } }` |

## Architecture Decisions

1. **encryption.service.ts compartido** — creado en Sprint 2.5, vive en src/lib/, no en módulo settings
2. **API key verificación ligera** — `messages.create` con max_tokens: 1 para validar key
3. **Aggregation SQL** — SUM/GROUP BY sobre tabla agents por project_id y por día (completedAt)
4. **Pricing constantes en shared** — packages/shared/constants/pricing.ts importado por frontend
5. **Cambio password con validación actual** — bcrypt compare de currentPassword antes de permitir cambio

## Dependencies

- **M1**: Auth — sesión activa, validación password actual para cambio
- **M4**: Agent Runner — tabla agents (tokens_input, tokens_output, completedAt) para aggregation
- **Sprint 2.5**: encryption.service.ts + migración user_settings (prerequisito compartido)
