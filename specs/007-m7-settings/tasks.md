# Tasks: M7 Settings

**Input**: Design documents from `/specs/007-m7-settings/`
**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Module Structure + Shared Constants)

**Purpose**: Settings module structure, pricing constants

- [X] T001 Verify ANTHROPIC_PRICING exists in `packages/shared/constants/pricing.ts` and is exported via `@sophia/shared/constants/pricing`
- [X] T002 Create Zod schemas (apiKey, profile, password) in `apps/api/src/modules/settings/settings.schema.ts`
- [X] T003 Create settings routes with all 8 endpoints in `apps/api/src/modules/settings/settings.routes.ts`
- [X] T004 Create settings page at `apps/web/app/(dashboard)/settings/page.tsx`
- [X] T004b Add `verified_at` column to `UserSettings` Prisma model + generate migration
- [X] T004c Add Settings navigation link (⚙️) in `apps/web/app/(dashboard)/layout.tsx`

**Checkpoint**: Module structure, migration, and navigation ready ✅

---

## Phase 2: HU-26 — Configurar API Key (Priority: P1) 🎯 MVP

**Goal**: Guardar API key encriptada, verificar con Anthropic, mostrar ofuscada

### Backend

- [X] T005 Create `getSettings()` in `apps/api/src/modules/settings/settings.service.ts` — return apiKey status + profile
- [X] T006 Create `saveApiKey()` in `settings.service.ts` — validate format regex, verify with Anthropic (messages.create max_tokens:1), encrypt AES-256-GCM, save, log audit event
- [X] T007 Create `deleteApiKey()` in `settings.service.ts` — clear encrypted fields, log audit event
- [X] T008 Create `verifyApiKey()` in `settings.service.ts` — decrypt, call Anthropic, update verifiedAt, rate limit 5/hour
- [X] T009 Create handlers for GET /settings, PUT /api-key, DELETE /api-key, POST /api-key/verify in `apps/api/src/modules/settings/settings.controller.ts`
- [X] T010 Register settings routes in `apps/api/src/app.ts` (import + prefix `/api/settings`)

### Frontend

- [X] T011 Create ApiKeySection component in `apps/web/components/settings/api-key-section.tsx` — input, status display (sk-ant-...XXXX), delete confirmation modal

**Checkpoint**: API key management end-to-end with encryption ✅

---

## Phase 3: HU-27 — Ver Uso de Tokens (Priority: P2)

**Goal**: Resumen de tokens + costos estimados + gráfico diario

### Backend

- [X] T012 Create `getUsage()` in `settings.service.ts` — SQL SUM/GROUP BY on agents table by project_id
- [X] T013 Create `getDailyUsage()` in `settings.service.ts` — SQL GROUP BY date(completedAt), last 30-90 days
- [X] T014 Create handlers for GET /usage and GET /usage/daily in `settings.controller.ts`

### Frontend

- [X] T015 Create UsageOverview component in `apps/web/components/settings/usage-overview.tsx` — total cards + per-project table
- [X] T016 Create UsageChart component in `apps/web/components/settings/usage-chart.tsx` — Recharts bar chart, period filter

**Checkpoint**: Token usage tracking with chart ✅

---

## Phase 4: HU-28 — Editar Perfil (Priority: P2)

**Goal**: Editar nombre y cambiar contraseña con validación actual

### Backend

- [X] T017 Create `updateProfile()` in `settings.service.ts` — validate name, update user
- [X] T018 Create `changePassword()` in `settings.service.ts` — bcrypt compare currentPassword, hash new, update
- [X] T019 Create handlers for PUT /profile and PUT /password in `settings.controller.ts`

### Frontend

- [X] T020 Create ProfileForm component in `apps/web/components/settings/profile-form.tsx`
- [X] T021 Create PasswordForm component in `apps/web/components/settings/password-form.tsx` — collapsible, requires current password

**Checkpoint**: Profile + password management functional ✅

---

## Phase 5: Polish & Tests

- [X] T022 [P] Unit tests for encryption.service.ts roundtrip in `apps/api/src/lib/__tests__/encryption.service.test.ts` (already existed from M4)
- [X] T023 [P] Unit tests for settings.service.ts (API key CRUD, usage aggregation, profile, password) in `apps/api/src/modules/settings/__tests__/settings.service.test.ts` — 15 tests passing
- [X] T024 [P] Integration test: covered via settings.service.test.ts (full CRUD flow with mocks)

---

## Dependencies & Execution Order

- **Phase 1** (Setup): Depends on Sprint 2.5 (encryption.service.ts + user_settings table)
- **Phase 2** (HU-26 API Key): Depends on Phase 1
- **Phase 3** (HU-27 Usage): Depends on M4 (agents table with token data)
- **Phase 4** (HU-28 Profile): Depends on M1 (users table, bcrypt)
- **Phase 5** (Tests): Depends on all previous
