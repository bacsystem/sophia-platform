# Tasks: M1 Auth

**Input**: Design documents from `/specs/001-m1-auth/`
**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: HU-01..HU-05
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prisma schema, lib utilities, auth middleware base, security headers, CORS, shared types

- [ ] T001 Create Prisma models for `users`, `refresh_tokens`, `password_reset_tokens` in `apps/api/prisma/schema.prisma`
- [ ] T002 Ensure PostgreSQL and Redis are running locally, then run Prisma migration: `pnpm db:migrate` to create auth tables
- [ ] T003 [P] Create JWT utility (`sign`, `verify`, `decode`) in `apps/api/src/lib/jwt.ts`
- [ ] T004 [P] Create bcrypt utility (`hash`, `compare`, cost 12) in `apps/api/src/lib/hash.ts`
- [ ] T005 [P] Create Redis client + rate limiting helpers in `apps/api/src/lib/redis.ts` — fail-open design: if Redis is unavailable, allow requests through (log warning, don't block auth)
- [ ] T006 Create auth middleware (extract + validate access_token cookie) in `apps/api/src/modules/auth/auth.middleware.ts`
- [ ] T042 Configure @fastify/helmet on Fastify instance with CSP, HSTS, X-Frame-Options in `apps/api/src/app.ts`
- [ ] T043 Configure CORS on Fastify instance (`origin: [FRONTEND_URL]`, `credentials: true`) in `apps/api/src/app.ts`
- [ ] T044 [P] Create shared auth types (`User`, `AuthResponse`, `AuthError`) in `packages/shared/types/auth.ts` — import from `@sophia/shared` in both apps

**Checkpoint**: Auth infrastructure ready — JWT, bcrypt, Redis, middleware, helmet, CORS, shared types available

---

## Phase 2: HU-01 — Registro (Priority: P1) 🎯 MVP

**Goal**: Usuarios pueden crear cuenta y recibir cookies de sesión

**Independent Test**: POST /api/auth/register con datos válidos → 201 + cookies

- [ ] T007 Create Zod schema for register input in `apps/api/src/modules/auth/auth.schema.ts`
- [ ] T008 Create `register()` in `apps/api/src/modules/auth/auth.service.ts` — check rate limit (3/IP/hour via Redis `auth:register:{ip}`), hash password, create user, generate tokens, set cookies
- [ ] T009 Create register handler in `apps/api/src/modules/auth/auth.controller.ts`
- [ ] T010 Create POST /api/auth/register route in `apps/api/src/modules/auth/auth.routes.ts`
- [ ] T011 [P] Create register page at `apps/web/app/(auth)/register/page.tsx` (server component)
- [ ] T012 [P] Create RegisterForm component in `apps/web/components/auth/register-form.tsx` ("use client", React Hook Form + Zod)

**Checkpoint**: Registration flow end-to-end functional

---

## Phase 3: HU-02 — Login (Priority: P1) 🎯 MVP

**Goal**: Usuarios pueden iniciar sesión con rate limiting

- [ ] T013 Add Zod schema for login input in `apps/api/src/modules/auth/auth.schema.ts`
- [ ] T014 Create `login()` in `apps/api/src/modules/auth/auth.service.ts` — rate limit check (Redis 5/email/15min), verify credentials (always run bcrypt.compare even if user not found to prevent timing attacks), generate tokens, set cookies
- [ ] T015 Create login handler in `apps/api/src/modules/auth/auth.controller.ts`
- [ ] T016 Add POST /api/auth/login route in `apps/api/src/modules/auth/auth.routes.ts`
- [ ] T017 [P] Create login page at `apps/web/app/(auth)/login/page.tsx`
- [ ] T018 [P] Create LoginForm component in `apps/web/components/auth/login-form.tsx` ("use client", rememberMe checkbox, countdown timer UI when rate limited — show minutes:seconds until lockout expires)

**Checkpoint**: Login flow + rate limiting + countdown UI functional

---

## Phase 4: HU-04 — Refresh Token (Priority: P1) 🎯 MVP

**Goal**: Sesiones se mantienen activas automáticamente con rotación de tokens

- [ ] T019 Create `refresh()` in `apps/api/src/modules/auth/auth.service.ts` — validate refresh cookie, rotate tokens, invalidate old. Concurrent refresh strategy: first-wins (second request with already-revoked token returns 401)
- [ ] T020 Create refresh handler in `apps/api/src/modules/auth/auth.controller.ts`
- [ ] T021 Add POST /api/auth/refresh route in `apps/api/src/modules/auth/auth.routes.ts`
- [ ] T022 Create API client with automatic refresh interceptor in `apps/web/lib/api.ts`

**Checkpoint**: Token refresh + rotation working transparently

---

## Phase 5: HU-03 — Logout (Priority: P1)

**Goal**: Usuarios pueden cerrar sesión revocando tokens

- [ ] T023 Create `logout()` in `apps/api/src/modules/auth/auth.service.ts` — revoke refresh token in BD, clear cookies
- [ ] T024 Create logout handler in `apps/api/src/modules/auth/auth.controller.ts`
- [ ] T025 Add POST /api/auth/logout route in `apps/api/src/modules/auth/auth.routes.ts`
- [ ] T045 Create LogoutButton component in `apps/web/components/auth/logout-button.tsx` — visible in sidebar/header, calls POST /logout, clears state, redirects to /login

**Checkpoint**: Logout revokes token, clears cookies, and UI redirects

---

## Phase 6: HU-05 — Recuperar Contraseña (Priority: P2)

**Goal**: Usuarios pueden recuperar acceso via email

- [ ] T026 Add Zod schemas for forgot-password and reset-password in `apps/api/src/modules/auth/auth.schema.ts`
- [ ] T027 Create `forgotPassword()` in `apps/api/src/modules/auth/auth.service.ts` — check rate limit (3/email/hour via Redis `auth:reset:{email}`), generate SHA-256 hashed token, send email (Resend/console.log)
- [ ] T028 Create `resetPassword()` in `apps/api/src/modules/auth/auth.service.ts` — validate token, update password hash
- [ ] T029 Create forgot-password and reset-password handlers in `apps/api/src/modules/auth/auth.controller.ts`
- [ ] T030 Add POST /api/auth/forgot-password and POST /api/auth/reset-password routes in `apps/api/src/modules/auth/auth.routes.ts`
- [ ] T031 [P] Create forgot-password page at `apps/web/app/(auth)/forgot-password/page.tsx`
- [ ] T032 [P] Create ForgotPasswordForm in `apps/web/components/auth/forgot-password-form.tsx`
- [ ] T033 [P] Create reset-password page at `apps/web/app/(auth)/reset-password/page.tsx` — read token from URL query param, show error state if token is missing/invalid/expired
- [ ] T034 [P] Create ResetPasswordForm in `apps/web/components/auth/reset-password-form.tsx` — handle 3 states: form (valid token), success, error (invalid/expired token with link back to forgot-password)

**Checkpoint**: Full password recovery flow (forgot + reset) functional

---

## Phase 7: GET /me + Middleware Frontend

**Purpose**: Endpoint de sesión y protección de rutas Next.js

- [ ] T035 Create `getMe()` in `apps/api/src/modules/auth/auth.service.ts`
- [ ] T036 Create GET /api/auth/me handler + route in `apps/api/src/modules/auth/auth.controller.ts` and `auth.routes.ts`
- [ ] T037 Create auth helpers (`getSession`, `isAuthenticated`) in `apps/web/lib/auth.ts`
- [ ] T038 Create Next.js middleware for route protection in `apps/web/middleware.ts` — validate cookie, auto-refresh, redirect to /login

**Checkpoint**: All auth endpoints functional, frontend routes protected

---

## Phase 8: Polish & Cross-Cutting

- [ ] T039 [P] Unit tests for auth.service.ts (register, login, refresh, logout, forgot, reset) in `apps/api/src/modules/auth/__tests__/auth.service.test.ts`
- [ ] T040 [P] Unit tests for jwt.ts and hash.ts in `apps/api/src/lib/__tests__/`
- [ ] T041 Integration test: full auth flow (register → login → refresh → logout) in `apps/api/src/modules/auth/__tests__/auth.integration.test.ts`
- [ ] T046 [P] Performance smoke test: assert auth endpoints respond < 200ms p95 in `apps/api/src/modules/auth/__tests__/auth.perf.test.ts`

---

## Dependencies & Execution Order

- **Phase 1** (Setup): No dependencies — start immediately
- **Phase 2** (HU-01 Register): Depends on Phase 1
- **Phase 3** (HU-02 Login): Depends on Phase 2 (sequential — shares auth.schema.ts, auth.service.ts, auth.controller.ts, auth.routes.ts)
- **Phase 4** (HU-04 Refresh): Depends on Phase 3 (needs token generation logic)
- **Phase 5** (HU-03 Logout): Depends on Phase 2 (refresh_tokens table populated by register/login)
- **Phase 6** (HU-05 Recovery): Depends on Phase 2 (adds to auth.schema.ts, auth.service.ts, auth.controller.ts, auth.routes.ts created in register flow)
- **Phase 7** (GET /me + Middleware): Depends on Phase 4 (needs refresh interceptor)
- **Phase 8** (Tests): Depends on all previous phases
