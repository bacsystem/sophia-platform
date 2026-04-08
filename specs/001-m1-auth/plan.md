# Implementation Plan: M1 Auth

**Branch**: `001-m1-auth` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-m1-auth/spec.md`

## Summary

Módulo de autenticación completo: registro, login, logout, refresh tokens y recuperación de contraseña. JWT almacenado en cookies httpOnly (Principio I de la constitución). Refresh token con rotación y revocación en BD. Rate limiting con Redis.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22
**Primary Dependencies**: Fastify, Prisma ORM, bcryptjs (cost 12), jsonwebtoken, Zod, React Hook Form, Next.js 15
**Storage**: PostgreSQL 16 (users, refresh_tokens, password_reset_tokens), Redis 7 (rate limiting)
**Testing**: Vitest (unit + integration)
**Target Platform**: Web (Fastify API + Next.js frontend)
**Project Type**: web-service + web-app (monorepo Turborepo)
**Performance Goals**: < 200ms p95 en endpoints auth, rate limiting < 5ms lookup
**Constraints**: JWT cookies httpOnly (NUNCA Bearer), bcrypt cost 12, Prisma directo (sin repository), pnpm exclusivo
**Scale/Scope**: MVP — 5 HUs, 7 endpoints, 3 tablas, 4 páginas frontend

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Auth por Cookies | ✅ PASS | JWT en cookie httpOnly + Secure + SameSite=Strict. Refresh token en cookie con Path=/api/auth |
| II. Prisma Directo | ✅ PASS | auth.service.ts usa Prisma directamente, sin repository layer |
| III. Pipeline 9 Agentes | N/A | No aplica a M1 |
| IV. pnpm Exclusivo | ✅ PASS | Monorepo con pnpm workspaces |
| V. Patrón Backend | ✅ PASS | routes → controller → service → schema. Respuestas `{ data }` / `{ error, message }` |
| VI. Frontend Server-First | ✅ PASS | Páginas auth server-side por defecto, forms con "use client" |
| VII. Seguridad Default | ✅ PASS | bcrypt cost 12, rate limiting Redis, tokens hasheados en BD |

## Project Structure

### Documentation (this feature)

```text
specs/001-m1-auth/
├── spec.md              # Requisitos de negocio
├── plan.md              # This file
├── tasks.md             # Task list (generated)
├── research.md          # Investigación técnica (decisiones, libs)
├── data-model.md        # Modelo de datos (tablas, Prisma schema)
├── quickstart.md        # Guía rápida de implementación
└── contracts/
    └── api-spec.json    # Contrato OpenAPI 3.0
```

### Source Code (repository root)

```text
apps/api/
├── src/
│   ├── modules/auth/
│   │   ├── auth.routes.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.schema.ts
│   │   └── auth.middleware.ts
│   └── lib/
│       ├── jwt.ts
│       ├── hash.ts
│       └── redis.ts
└── prisma/
    └── schema.prisma        # users, refresh_tokens, password_reset_tokens

apps/web/
├── app/(auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
├── components/auth/
│   ├── login-form.tsx
│   ├── register-form.tsx
│   ├── forgot-password-form.tsx
│   └── reset-password-form.tsx
├── lib/
│   ├── api.ts               # Cliente HTTP con interceptor refresh
│   └── auth.ts              # Helpers: getSession, isAuthenticated
└── middleware.ts             # Protección de rutas (JWT cookie validation)
```

**Structure Decision**: Monorepo Turborepo con `apps/api/` (Fastify) y `apps/web/` (Next.js). Módulo auth en `src/modules/auth/` siguiendo patrón backend estricto (Principio V).

## Data Model

### users
- `id` UUID PK, `name` VARCHAR(100), `email` VARCHAR(255) UNIQUE, `password` VARCHAR(255) bcrypt
- `created_at`, `updated_at` TIMESTAMPTZ

### refresh_tokens
- `id` UUID PK, `user_id` FK→users, `token` VARCHAR(255) SHA-256 hash
- `expires_at` TIMESTAMPTZ, `revoked_at` TIMESTAMPTZ nullable
- Índices: token, user_id, expires_at

### password_reset_tokens
- `id` UUID PK, `user_id` FK→users, `token` VARCHAR(255) SHA-256 hash
- `expires_at` TIMESTAMPTZ, `used_at` TIMESTAMPTZ nullable
- Índices: token, user_id

## API Contracts

| Method | Path | Status | Response |
|--------|------|--------|----------|
| POST | /api/auth/register | 201 | `{ data: { id, name, email } }` + Set-Cookie |
| POST | /api/auth/login | 200 | `{ data: { id, name, email } }` + Set-Cookie |
| POST | /api/auth/refresh | 200 | `{ data: { id, name, email } }` + Set-Cookie |
| POST | /api/auth/logout | 200 | `{ data: { message } }` + Clear-Cookie |
| POST | /api/auth/forgot-password | 200 | `{ data: { message } }` |
| POST | /api/auth/reset-password | 200 | `{ data: { message } }` |
| GET | /api/auth/me | 200 | `{ data: { id, name, email, createdAt } }` |

## Architecture Decisions

1. **Access token stateless** (15 min TTL) — no se persiste en BD, solo se valida JWT signature
2. **Refresh token con rotación** — cada refresh genera nuevo par access+refresh, el anterior se invalida
3. **Cookies con Path diferenciado** — access_token Path=/, refresh_token Path=/api/auth (limita scope)
4. **Rate limiting en Redis** — TTL-based counter por email (login) e IP (register)
5. **Email service abstracto** — Resend en prod, console.log en dev (configurable por env)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Token replay attack | HIGH | Refresh token rotation + revocación en BD |
| Timing attack en login | MEDIUM | Siempre ejecutar bcrypt compare (incluso si email no existe) |
| Rate limit bypass | MEDIUM | Rate limit por email + IP en Redis con TTL |
