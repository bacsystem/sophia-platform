# Tasks: M7 Settings

**Input**: Design documents from `/specs/007-m7-settings/`
**Prerequisites**: plan.md (required), spec.md (required)

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup (Module Structure + Shared Constants)

**Purpose**: Settings module structure, pricing constants

- [ ] T001 Create ANTHROPIC_PRICING constants in `packages/shared/constants/pricing.ts`
- [ ] T002 Create Zod schemas (apiKey, profile, password) in `apps/api/src/modules/settings/settings.schema.ts`
- [ ] T003 Create settings routes with all 8 endpoints in `apps/api/src/modules/settings/settings.routes.ts`
- [ ] T004 Create settings page at `apps/web/app/(dashboard)/settings/page.tsx`

**Checkpoint**: Module structure and constants ready

---

## Phase 2: HU-26 — Configurar API Key (Priority: P1) 🎯 MVP

**Goal**: Guardar API key encriptada, verificar con Anthropic, mostrar ofuscada

### Backend

- [ ] T005 Create `getSettings()` in `apps/api/src/modules/settings/settings.service.ts` — return apiKey status + profile
- [ ] T006 Create `saveApiKey()` in `settings.service.ts` — validate format regex, verify with Anthropic (messages.create max_tokens:1), encrypt AES-256-GCM, save
- [ ] T007 Create `deleteApiKey()` in `settings.service.ts` — clear encrypted fields
- [ ] T008 Create `verifyApiKey()` in `settings.service.ts` — decrypt, call Anthropic, update verifiedAt, rate limit 5/hour
- [ ] T009 Create handlers for GET /settings, PUT /api-key, DELETE /api-key, POST /api-key/verify in `apps/api/src/modules/settings/settings.controller.ts`
- [ ] T010 Wire settings routes

### Frontend

- [ ] T011 Create ApiKeySection component in `apps/web/components/settings/api-key-section.tsx` — input, status display (sk-ant-...XXXX), delete confirmation modal

**Checkpoint**: API key management end-to-end with encryption

---

## Phase 3: HU-27 — Ver Uso de Tokens (Priority: P2)

**Goal**: Resumen de tokens + costos estimados + gráfico diario

### Backend

- [ ] T012 Create `getUsage()` in `settings.service.ts` — SQL SUM/GROUP BY on agents table by project_id
- [ ] T013 Create `getDailyUsage()` in `settings.service.ts` — SQL GROUP BY date(completedAt), last 30-90 days
- [ ] T014 Create handlers for GET /usage and GET /usage/daily in `settings.controller.ts`

### Frontend

- [ ] T015 Create UsageOverview component in `apps/web/components/settings/usage-overview.tsx` — total cards + per-project table
- [ ] T016 Create UsageChart component in `apps/web/components/settings/usage-chart.tsx` — Recharts bar chart, period filter

**Checkpoint**: Token usage tracking with chart

---

## Phase 4: HU-28 — Editar Perfil (Priority: P2)

**Goal**: Editar nombre y cambiar contraseña con validación actual

### Backend

- [ ] T017 Create `updateProfile()` in `settings.service.ts` — validate name, update user
- [ ] T018 Create `changePassword()` in `settings.service.ts` — bcrypt compare currentPassword, hash new, update
- [ ] T019 Create handlers for PUT /profile and PUT /password in `settings.controller.ts`

### Frontend

- [ ] T020 Create ProfileForm component in `apps/web/components/settings/profile-form.tsx`
- [ ] T021 Create PasswordForm component in `apps/web/components/settings/password-form.tsx` — collapsible, requires current password

**Checkpoint**: Profile + password management functional

---

## Phase 5: Polish & Tests

- [ ] T022 [P] Unit tests for encryption.service.ts roundtrip in `apps/api/src/lib/__tests__/encryption.service.test.ts` (if not already in M4)
- [ ] T023 [P] Unit tests for settings.service.ts (API key CRUD, usage aggregation, profile, password) in `apps/api/src/modules/settings/__tests__/settings.service.test.ts`
- [ ] T024 [P] Integration test: save API key → verify → get settings → delete in `apps/api/src/modules/settings/__tests__/settings.integration.test.ts`

---

## Dependencies & Execution Order

- **Phase 1** (Setup): Depends on Sprint 2.5 (encryption.service.ts + user_settings table)
- **Phase 2** (HU-26 API Key): Depends on Phase 1
- **Phase 3** (HU-27 Usage): Depends on M4 (agents table with token data)
- **Phase 4** (HU-28 Profile): Depends on M1 (users table, bcrypt)
- **Phase 5** (Tests): Depends on all previous
