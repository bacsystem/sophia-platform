# Changelog

Todas las modificaciones relevantes al proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

---

## [M2-Projects v1.0.0] — 2026-04-09 ✅ RELEASE

### Added
- Backend: project.schema.ts — Zod schemas (CreateProjectSchema con dual-refine para agentes requeridos/válidos, UpdateProjectSchema, ListProjectsQuerySchema)
- Backend: project.service.ts — CRUD + transiciones de estado (createProject, listProjects, getProject, updateProject, deleteProject, startProject, pauseProject, continueProject, retryProject)
- Backend: project.controller.ts — 10 handlers HTTP thin (delegan a service)
- Backend: project.routes.ts — 10 rutas Fastify autenticadas con JWT cookie
- Backend: project.service.test.ts — 15+ tests unitarios con Vitest + vi.mock Prisma
- Backend: project.integration.test.ts — tests de integración completos con buildApp() + app.inject()
- Frontend: (dashboard)/layout.tsx — nav wrapper con Sophia brand + link Projects
- Frontend: (dashboard)/projects/page.tsx — página lista con ProjectGrid (server component)
- Frontend: (dashboard)/projects/new/page.tsx — página creación con ProjectForm
- Frontend: (dashboard)/projects/[id]/page.tsx — página detalle con fetch + notFound()
- Frontend: (dashboard)/projects/[id]/edit/page.tsx — página edición (solo proyectos idle)
- Frontend: components/projects/ — ProjectForm, StackSelector, AgentSelector, ProjectCard, ProjectGrid, ProjectEmptyState, ProjectDetail, ProjectHeader, ProjectActions, ProjectTabs, ProjectSpecViewer, DeleteProjectDialog, date-utils
- Frontend: hooks/use-projects.ts — HTTP client hook (8 operaciones con credentials: include)
- Shared: packages/shared/src/types/projects.ts — tipos M2 (AgentName, Project, ProjectSpec, CreateProjectInput, etc.)
- Prisma: modelo Project + ProjectSpec con índices compuestos
- Migration: 20260408153434_m2_projects

### Fixed
- .gitignore: `projects/` → `/projects/` para evitar ignorar código fuente en apps/*/src/modules/projects/ y components/projects/

---

## [M1-Auth v1.3.1] — 2026-04-08

### Fixed
- spec.md: versión `1.3` → `1.3.0` (MAJOR.MINOR.PATCH — CodeRabbit finding #1)
- CHANGELOG.md: sección `### Removed` añadida a entrada v1.3 (CodeRabbit finding #2)
- login-form.tsx: `aria-label` + `aria-pressed` en botón toggle contraseña (CodeRabbit finding #5)
- register-form.tsx: `aria-label` + `aria-pressed` en ambos toggles contraseña (CodeRabbit finding #4)
- reset-password-form.tsx: `aria-label` + `aria-pressed` en ambos toggles contraseña (CodeRabbit finding #3)

### Added
- CLAUDE.md: sección "Release por Módulo" con convención de tags y versionamiento MAJOR.MINOR.PATCH
- CLAUDE.md: sección "CodeRabbit Review Protocol" con checklist obligatorio (Docstring Coverage ≥ 80%, a11y, SemVer)

---

## [M1-Auth v1.3.0] — 2026-04-08 ✅ RELEASE

### Added
- UI/UX premium completa: dark glassmorphism, gradientes violet/indigo, animaciones slide-up/fade-in
- Toggle show/hide password en todos los forms (login, register, reset-password)
- Layout split-panel en login: branding panel izquierdo + form panel derecho (responsive)
- Cards glass (backdrop-blur) para register, forgot-password, reset-password
- Estados visuales premium: error/success con iconos (CheckCircle2, AlertCircle, Loader2 spin)
- globals.css: variables CSS, utilidades `.glass`, `.glass-input`, `.btn-primary`, `.label-premium`, `.link-premium`, `.error-text`
- tailwind.config.cjs: keyframes `fadeIn`/`slideUp`, `shadow-glow`, font Inter
- app/page.tsx: dashboard placeholder con identidad visual premium

### Changed
- Versión spec.md: 1.2 → 1.3
- Todos los inputs: `rounded-md border-gray-300` → `glass-input rounded-xl`
- Todos los botones submit: `bg-indigo-600` → `btn-primary` (gradiente con glow)
- Error banners: `bg-red-50 text-red-700` → `bg-red-500/10 border border-red-500/20 text-red-400`
- Login page: layout centrado simple → split-panel con orbs decorativos
- forgot-password success state: badge verde plano → `CheckCircle2` + glassmorphism
- reset-password error/success: badges planos → iconos + glassmorphism

### Fixed
- jwt.ts: lazy `process.env` reads (ESM module-init timing bug — `secretOrPrivateKey must have a value`)
- tsconfig web: `@/*` alias `./src/*` → `./` (no existe directorio src/)
- postcss/tailwind configs: renombrados a `.cjs` (conflicto ESM/CJS)
- Código duplicado eliminado en register-form, forgot-password-form, reset-password-form
- Aria-labels en botones de visibilidad de contraseña (login, register, reset-password)

### Removed
- Ninguno

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
