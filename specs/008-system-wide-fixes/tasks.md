# Tasks: Correcciones del Sistema — Errores Runtime

**Feature Branch**: `008-system-wide-fixes`
**Generated**: 2026-04-09
**Spec**: `specs/008-system-wide-fixes/spec.md`
**Plan**: `specs/008-system-wide-fixes/plan.md`

## Progress

- Total: 25 tasks
- Completed: 25/25
- Current Phase: Done ✅

---

## Phase 1: Setup

**Purpose**: Verify baseline before making changes

- [x] T001 [P] Verify API lint passes: `pnpm --filter @sophia/api lint`
- [x] T002 [P] Verify API build passes: `pnpm --filter @sophia/api build`
- [x] T003 [P] Verify API tests pass: `pnpm --filter @sophia/api test`
- [x] T004 [P] Verify Web lint passes: `pnpm --filter @sophia/web lint`
- [x] T005 [P] Verify Web build passes: `pnpm --filter @sophia/web build`

---

## Phase 2: User Story 1 — Verificación de API Key Resiliente (P1)

**Purpose**: Add retry logic and differentiated error messages to API key verification

- [x] T006 [US1] Add retry with 1s delay and error classification (`INVALID_KEY` | `TIMEOUT` | `NETWORK_ERROR`) to `verifyKeyWithAnthropic()` in `apps/api/src/modules/settings/settings.service.ts`
- [x] T007 [US1] Update `saveApiKey()` to map new error types to user-facing differentiated messages in `apps/api/src/modules/settings/settings.service.ts`
- [x] T008 [US1] Verify API lint + build + tests pass after US1 changes

---

## Phase 3: User Story 2 — Errores Visibles en Generación de Specs (P1)

**Purpose**: Pre-validate ANTHROPIC_API_KEY and improve error propagation via SSE

- [x] T009 [US2] Add `ANTHROPIC_API_KEY` pre-validation in `startSpecGeneration()` — return HTTP 503 with clear message if missing — in `apps/api/src/modules/spec/spec.service.ts`
- [x] T010 [US2] Improve error messages in `runGeneration()` catch block — classify auth errors, config errors, and transient errors with appropriate `retryable` flag in `apps/api/src/modules/spec/spec.service.ts`
- [x] T011 [US2] Verify API lint + build + tests pass after US2 backend changes
- [x] T012 [US2] Verify frontend spec generation component handles SSE `type: 'error'` events — replace spinner with error message and retry button; ensure safety timeout shows generic error if SSE closes without emitting error event — in `apps/web/components/spec/`
- [x] T013 [US2] Verify Web lint + build pass after US2 frontend changes

---

## Phase 4: User Story 3 — Sesiones Persistentes Durante Uso Activo (P2)

**Purpose**: Add proactive token refresh to prevent session loss during active use

- [x] T014 [US3] Add `GET /api/auth/session` route definition in `apps/api/src/modules/auth/auth.routes.ts`
- [x] T015 [US3] Add session handler in `apps/api/src/modules/auth/auth.controller.ts`
- [x] T016 [US3] Add `getSession()` service method that decodes access_token and returns `{ expiresAt, user }` in `apps/api/src/modules/auth/auth.service.ts`
- [x] T017 [US3] Add integration test for `GET /api/auth/session` endpoint (authenticated returns expiresAt+user, unauthenticated returns 401) in `apps/api/src/modules/auth/__tests__/`
- [x] T018 [US3] Verify API lint + build + tests pass after session endpoint
- [x] T019 [US3] Create `useTokenRefresh()` hook — fetch session expiry, set timer at ~80% TTL, call POST `/api/auth/refresh` proactively, re-arm timer on success, no-op on failure (fallback to reactive refresh) in `apps/web/hooks/use-token-refresh.ts`
- [x] T020 [US3] Integrate `useTokenRefresh()` hook in `apps/web/app/(dashboard)/layout.tsx`
- [x] T021 [US3] Verify Web lint + build pass after US3 frontend changes

---

## Phase 5: User Story 4 — Entorno de Desarrollo Estable (P3)

**Purpose**: Add dev:clean script for cache-busting development workflow

- [x] T022 [US4] Add `"dev:clean": "rm -rf apps/web/.next && turbo dev"` script to root `package.json`
- [x] T023 [US4] Document `pnpm dev:clean` command in `CLAUDE.md` Key Commands section

---

## Phase 6: Polish

**Purpose**: Final validation across all packages

- [x] T024 [P] Run full validation: `pnpm --filter @sophia/api lint && pnpm --filter @sophia/api build && pnpm --filter @sophia/api test`
- [x] T025 [P] Run clean web build: `rm -rf apps/web/.next && pnpm --filter @sophia/web lint && pnpm --filter @sophia/web build`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on Phase 1 — API key verification changes
- **Phase 3 (US2)**: Depends on Phase 1 — spec generation error handling (independent of US1)
- **Phase 4 (US3)**: Depends on Phase 1 — session persistence (independent of US1/US2)
- **Phase 5 (US4)**: Depends on Phase 1 — dev script (independent of all other stories)
- **Phase 6 (Polish)**: Depends on all phases complete

### Parallel Opportunities

- Phase 1: All setup tasks (T001-T005) can run in parallel
- Phases 2-5: All user stories are independent and can be worked in parallel
- Within US3: Backend (T014-T018) must complete before frontend (T019-T021)
- Phase 6: Both polish tasks (T024-T025) can run in parallel

### Within Each User Story

- Backend changes before frontend changes
- Lint + build verification after each user story
- No DB migrations required for any story

## Implementation Strategy

### Recommended Order (Sequential)

1. Phase 1: Setup verification (T001-T005)
2. Phase 2: US1 — API Key (T006-T008) — highest impact, P1
3. Phase 3: US2 — Spec Errors (T009-T013) — second P1
4. Phase 4: US3 — Session Persistence (T014-T021) — P2
5. Phase 5: US4 — Dev Script (T022-T023) — P3, quickest
6. Phase 6: Polish (T024-T025) — final gate
