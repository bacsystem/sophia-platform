# Changelog

Todas las modificaciones relevantes al proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

---

## [M1-Auth v1.2] — 2026-04-08

### Added
- T042: Configure @fastify/helmet (CSP, HSTS, X-Frame-Options)
- T043: Configure CORS on Fastify (`origin: [FRONTEND_URL]`, `credentials: true`)
- T044: Shared auth types (`User`, `AuthResponse`, `AuthError`) en `packages/shared/types/auth.ts`
- T045: LogoutButton component en frontend
- T046: Performance smoke test (< 200ms p95)
- Countdown timer UI en LoginForm (T018) para rate limit lockout

### Changed
- 422 response format alineado con constitución V: `{ error: 'VALIDATION_ERROR', errors: [...] }`
- Zod schemas en spec.md marcados como "frontend-only" (HU-01 y HU-02)
- Phase 3 ahora secuencial después de Phase 2 (comparten 4 archivos)
- Phase 5 dependencia corregida: depende de Phase 2, no Phase 4
- T002 incluye `pnpm docker:up` como prerequisito
- T008: rate limit explícito `auth:register:{ip}` 3/hora
- T014: timing attack defense (dummy bcrypt.compare si user no existe)
- T027: rate limit explícito `auth:reset:{email}` 3/hora
- plan.md: tasks.md status actualizado a "generated"

### Fixed
- 15 findings de `/speckit.analyze` (iteraciones Copilot Chat + Claude Code combinadas)

---

## [Speckit Pipeline] — 2026-04-08

### Added
- plan.md para los 7 módulos (M1-M7): tech context, constitution check, architecture decisions
- tasks.md para los 7 módulos (M1-M7): phased task lists por user story
- Sección "Project Tracking & Versioning" en CLAUDE.md
- CHANGELOG.md en raíz del proyecto

### Changed
- Directorios de specs renombrados con prefijos numéricos (001-007)
- Feature branch `001-m1-auth` creada para pipeline Speckit

---

## [Initial Setup] — 2026-04-07

### Added
- Estructura inicial del proyecto con 7 specs (M1-M7, 28 HUs)
- Constitución v1.0.0 con 7 principios non-negotiable
- Configuración Speckit v0.5.1.dev0 (sequential branch numbering)
- CLAUDE.md con convenciones, patrones y reglas de arquitectura
- 9 agent skills (DBA → Integration)
