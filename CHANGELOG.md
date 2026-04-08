# Changelog

Todas las modificaciones relevantes al proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado semántico a nivel de proyecto: `MAJOR.MINOR.PATCH`.

---

## [v0.3.0] — 2026-04-09 ✅ M3 Spec Engine

### Added
- M3 Spec Engine (HU-11→13): generación IA de specs técnicas con streaming SSE
- Backend: `spec.validator.ts` — validador de secciones requeridas por tipo de documento
- Backend: `spec.stream.ts` — utilidades SSE (initSseStream, sendSseEvent, endSseStream)
- Backend: `spec.service.ts` — generación secuencial con 3 llamadas Claude, reintentos (C1/C3), versionamiento
- Backend: `spec.controller.ts` + `spec.routes.ts` — 6 rutas (POST generate, GET stream, GET spec, GET versions, GET :version, PUT spec)
- Backend: `template.service.ts` + `template.controller.ts` + `template.routes.ts` — GET /api/templates
- Prisma: modelo `Template` + campos `source`/`valid` en `ProjectSpec`
- Migration: 20260409_m3_spec_engine
- Skills: `skills/spec-agent/` — 4 archivos de prompt (system.md, spec.md, data-model.md, api-design.md)
- Frontend: `TemplateGallery` — galería de 5 templates predefinidos con íconos Lucide
- Frontend: `NewProjectSection` — wrapper que conecta TemplateGallery con ProjectForm (key remounting)
- Frontend: `useSpecStream` — SSE hook con reconexión (C2 — buffered event replay)
- Frontend: `SpecStream` — indicadores de progreso en tiempo real por archivo
- Frontend: `SpecViewer` — viewer markdown 3 sub-tabs (spec.md/data-model.md/api-design.md), badge incompletitud (C1)
- Frontend: `SpecEditor` — editor @uiw/react-md-editor con dynamic SSR-safe import
- Frontend: `SpecVersionSelector` — dropdown de versiones con indicador de validez
- Frontend: `ProjectSpecViewer` — reemplazado placeholder M2 con orquestador completo (generate/stream/view/edit/version)
- Tests: `spec.validator.test.ts` (12 tests), `spec.service.test.ts` (20 tests), `template.service.test.ts` (4 tests)
- CLAUDE.md: regla de pre-implementación (Step 0) — `/speckit.clarify` + `/speckit.analyze` automático

### Changed
- `apps/web/components/projects/project-form.tsx`: exporta `TemplateFormValues`, acepta prop `templateValues`
- `apps/web/app/(dashboard)/projects/new/page.tsx`: usa `NewProjectSection` en lugar de `ProjectForm` directo
- `apps/api/src/app.ts`: registra `templateRoutes` y `specRoutes`

### Fixed
- N/A

### Removed
- N/A

---

## [v0.2.0] — 2026-04-09 ✅ M2 Projects

### Added
- M2 Projects (HU-06→10): CRUD completo de proyectos con transiciones de estado
- Backend: project.schema.ts, project.service.ts, project.controller.ts, project.routes.ts (10 rutas autenticadas)
- Backend: project.service.test.ts (15+ tests unitarios), project.integration.test.ts (tests de integración)
- Frontend: páginas /projects, /projects/new, /projects/[id], /projects/[id]/edit
- Frontend: components/projects/ — ProjectForm, StackSelector, AgentSelector, ProjectCard, ProjectGrid, ProjectEmptyState, ProjectDetail, ProjectHeader, ProjectActions, ProjectTabs, ProjectSpecViewer, DeleteProjectDialog, date-utils
- Frontend: hooks/use-projects.ts — HTTP client hook (8 operaciones)
- Shared: packages/shared/src/types/projects.ts — tipos M2 (AgentName, Project, ProjectSpec, etc.)
- Prisma: modelos Project + ProjectSpec con índices compuestos
- Migration: 20260408153434_m2_projects

### Changed
- N/A

### Fixed
- .gitignore: `projects/` → `/projects/` (evitaba indexar código fuente en modules/projects/ y components/projects/)
- Login redirect: `router.push('/')` → `router.push('/projects')` (la página raíz era un placeholder sin navbar)
- app/page.tsx: reemplazado placeholder estático con `redirect('/projects')` para acceso directo al módulo activo

### Removed
- N/A

---

## [v0.1.0] — 2026-04-08 ✅ M1 Auth

### Added
- M1 Auth (HU-01→05): autenticación completa con JWT httpOnly cookies
- UI/UX premium: dark glassmorphism, gradientes violet/indigo, animaciones slide-up/fade-in
- Toggle show/hide password en login, register, reset-password
- Layout split-panel en login (branding + form, responsive)
- Cards glass con backdrop-blur para register, forgot-password, reset-password
- globals.css: `.glass`, `.glass-input`, `.btn-primary`, `.label-premium`, `.link-premium`, `.error-text`
- tailwind.config.cjs: keyframes fadeIn/slideUp, shadow-glow, font Inter
- @fastify/helmet (CSP, HSTS, X-Frame-Options), CORS configurado
- Shared auth types: `User`, `AuthResponse`, `AuthError`
- LogoutButton component
- Performance smoke test (< 200ms p95)
- Rate limit countdown UI en LoginForm
- Speckit pipeline: plan.md + tasks.md para M1-M7
- CLAUDE.md: sección de Project Tracking & Versioning
- Configuración Speckit v0.5.1.dev0 (sequential branch numbering)

### Changed
- 422 response format alineado con constitución V: `{ error: 'VALIDATION_ERROR', errors: [...] }`
- Login page: layout centrado → split-panel con orbs decorativos

### Fixed
- jwt.ts: lazy `process.env` reads (ESM module-init timing bug)
- tsconfig web: alias `@/*` corregido (`./src/*` → `./`)
- postcss/tailwind configs: renombrados a `.cjs` (conflicto ESM/CJS)
- Aria-labels + aria-pressed en botones de visibilidad de contraseña (a11y)
- .gitignore: añadido `*.tsbuildinfo`; eliminado tsconfig.tsbuildinfo trackeado

### Removed
- N/A

---

## [v0.0.1] — 2026-04-07 🏗 Setup inicial

### Added
- Estructura inicial del monorepo Turborepo (apps/web, apps/api, packages/shared)
- 7 specs (M1-M7, 28 HUs) con constitución v1.0.0
- CLAUDE.md con convenciones, patrones y reglas de arquitectura
- 9 agent skills (DBA → Integration)

### Changed
- N/A

### Fixed
- N/A

### Removed
- N/A
