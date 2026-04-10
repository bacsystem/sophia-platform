# Changelog

Todas las modificaciones relevantes al proyecto se documentan aquí.
Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versionado semántico a nivel de proyecto: `MAJOR.MINOR.PATCH`.

---

## [v0.7.1] — 2026-04-10 ✅ System-wide fixes

### Added
- Sistema de theming global con soporte `light` / `dark` / `system`, color themes persistentes y 6 paletas dark configurables
- Nueva ruta `/settings/profile` para centralizar Apariencia, Perfil y Cambio de contraseña
- Hooks `use-color-theme`, `use-dark-palette` y `use-token-refresh` para persistencia visual y renovación proactiva de sesión
- Provider de tema y utilidades UI reutilizables para superficies, botones e inputs consistentes en todo `apps/web`

### Changed
- `/settings` ahora prioriza API key y uso, dejando la configuración personal en una página dedicada
- Se unificó la tipografía de la app con `Syne` + `Space Mono` mediante variables CSS y Tailwind tokens
- Se actualizó `CLAUDE.md` y el tracker global para reflejar el cierre del hotfix `008-system-wide-fixes`

### Fixed
- Persistencia del tema de color y de la dark palette después de refresh restaurando atributos antes de la hidratación
- Eliminación de colores hardcodeados en botones, cards, iconos, dashboards, auth, proyectos, files y spec viewer
- Redirección de “Mi perfil” hacia `/settings/profile` y visibilidad correcta de opciones de apariencia según el modo activo
- Verificación de API key con reintentos y mensajes diferenciados, errores SSE más claros en generación de specs y refresh proactivo de sesión
- Se ignoró `apps/api/projects/` como salida runtime para evitar commits accidentales de código generado

### Removed
- N/A

## [v0.7.0] — 2026-06-07 ✅ M7 Settings

### Added
- M7 Settings (HU-26→28): configuración de usuario — API key, uso de tokens, perfil
- Backend: módulo `settings/` con 8 endpoints REST (GET /, PUT/DELETE /api-key, POST /api-key/verify, GET /usage, GET /usage/daily, PUT /profile, PUT /password)
- `settings.service.ts` — saveApiKey (AES-256-GCM encrypt + Anthropic verification), deleteApiKey, verifyApiKey (rate limit 5/hr), getSettings, getUsage (token aggregation per project), getDailyUsage (SQL GROUP BY date), updateProfile, changePassword (bcrypt)
- `settings.controller.ts` — 8 handlers con Zod validation + error handling
- `settings.schema.ts` — 4 schemas Zod (apiKey regex, profile name, password strength, daily usage query)
- `settings.routes.ts` — 8 endpoints con authenticate hook
- Frontend: página de configuración con 5 secciones
- `api-key-section.tsx` — guardado/verificación/eliminación de API key con indicadores de estado
- `usage-overview.tsx` — cards de totales + tabla per-project con costos estimados
- `usage-chart.tsx` — gráfico de barras Recharts con selector de período (7d/30d/90d)
- `profile-form.tsx` — edición de nombre con react-hook-form + feedback visual
- `password-form.tsx` — cambio de contraseña colapsable con validación en tiempo real
- Prisma migration: `api_key_verified_at` column en `user_settings`
- Settings nav link (⚙️) en dashboard layout
- 15 unit tests para settings.service.ts

### Fixed
- Certificación M1-M7: 283/283 criterios verificados y marcados en specs
- M6: mapa de íconos unificado desde `@sophia/shared`, breadcrumb ruta completa, detección binarios
- M7: display API key como `sk-ant-...XXXX`, modal confirmación delete, mensaje sin key + link Anthropic, disclaimer precios, filtro período "Todo" (365d)
- M5: badge unreadCount logs, handler fetchHistory, labels métricas, colores botones, texto pausa
- M4: validación spec en startProject, persistencia progress/currentLayer, status `done`, eventos WS renombrados
- M2: status `running` (antes `generating`), banners éxito inline
- M1: LogoutButton visible, tests rate limit, redirect post-registro

### Dependencies
- `recharts` añadido a `@sophia/web`

## [v0.6.0] — 2026-05-09 ✅ M6 File Manager

### Added
- M6 File Manager (HU-23→25): gestor de archivos generados por agentes
- Backend: módulo `files/` con 4 endpoints (tree, content, raw, download ZIP)
- `file.service.ts` — getFileTree (flat→tree), getFileContent (1MB truncation, path traversal prevention), getRawFile (stream), downloadProject (archiver ZIP streaming)
- `file.controller.ts` — handlers con Cache-Control + ETag para contenido, Content-Disposition para descargas
- `file.schema.ts` — validación Zod con UUID params
- `file.routes.ts` — 4 GET routes con authenticate preHandler
- Frontend: file manager con tree sidebar + viewer panel responsive
- `file-tree.tsx` — árbol colapsable con búsqueda client-side, stats (archivos/tamaño)
- `file-tree-node.tsx` — nodos con íconos por extensión (Lucide), badges de color por agente
- `file-viewer.tsx` — syntax highlighting con shiki (async import), line numbers, @tanstack/react-virtual para >500 líneas, copy/download
- `file-search.tsx` — búsqueda con Cmd+F shortcut
- `file-breadcrumb.tsx` — navegación por path con segmentos clickeables
- `download-button.tsx` — descarga ZIP con tamaño estimado, estados disabled con tooltips
- `file-tree-builder.ts` — utilidad flat→tree transformation
- `file-manager-client.tsx` — layout responsive (md:flex-row sidebar + viewer, stacked mobile)
- Page SSR: `projects/[id]/files/page.tsx` con fetch de proyecto + tree
- Tests: `file.service.test.ts` (9 unit tests), `file-tree.test.tsx` (7 component tests) — 16 tests total
- Dependencias: archiver, shiki, @tanstack/react-virtual

### Changed
- `project-tabs.tsx`: tab "Archivos" ahora enlaza al gestor de archivos (`/projects/:id/files`)

### Fixed
- Eliminado stub `downloadProjectHandler` de `project.routes.ts` / `project.controller.ts` (conflicto de ruta con M6)

### Removed
- N/A

---

## [v0.5.0] — 2026-05-08 ✅ M5 Dashboard

### Added
- M5 Dashboard (HU-18→22): visualización en tiempo real de la ejecución de agentes IA
- Canvas API nativo: 10 agentes animados con conexiones, partículas, tooltips y selección por click
- `agent-canvas.tsx` — renderizado rAF con devicePixelRatio scaling, ResizeObserver, ref pattern (`renderFnRef`)
- `agent-canvas-renderer.ts` — dibujado de nodos (4 estados: idle/working/done/error), conexiones activas/inactivas, labels
- `agent-canvas-events.ts` — hit-testing circular con tolerancia de 4px
- `agent-particles.ts` — sistema de partículas con lifetime 2s y spawn 400ms
- `agent-log-panel.tsx` — panel de logs en tiempo real con auto-scroll, filtro por agente, pause/play
- `agent-files-panel.tsx` — panel de archivos generados con agrupación por carpeta, badge NEW (3s), Framer Motion
- `file-preview-modal.tsx` — vista previa de archivos con shiki syntax highlighting (github-dark), copy to clipboard
- `agent-metrics-bar.tsx` — 5 indicadores (agentes, capa, archivos, tiempo, tokens) + barra de progreso gradient
- `agent-controls.tsx` — controles de ejecución: Pausar (con confirmación), Continuar, Reintentar, Download ZIP (placeholder M6)
- `agent-detail-panel.tsx` — panel lateral con status badge, elapsed time, últimos 8 logs y archivos del agente seleccionado
- `dashboard-layout.tsx` — layout responsive: desktop (canvas + sidebar tabs) / mobile (<768px lista + tabs)
- `agent-list-mobile.tsx` — lista vertical de agentes con status dot, progress bar y porcentaje
- `dashboard-empty.tsx` — estado idle antes de iniciar generación
- `use-dashboard-store.ts` — Zustand store con ring buffer (200 logs), 10 agent nodes, métricas, acciones
- `use-websocket.ts` — WebSocket hook con reconexión (3s), replay via `?since=lastEventId`, 7 event types
- `use-elapsed-time.ts` — timer hook con formato mm:ss
- `packages/shared/constants/file-icons.ts` — mapa de íconos SVG para Canvas (12 extensiones)
- `apps/web/lib/agent-config.ts` — configuración de 10 agentes (posición, color, conexiones) en canvas 700×500
- `apps/web/lib/ws-events.ts` — 7 tipos de eventos WebSocket
- Link "Ver Dashboard" en `project-actions.tsx` (visible cuando status !== 'idle')
- Tests: `agent-canvas-renderer.test.ts` (10), `agent-log-panel.test.tsx` (4), `use-websocket.test.ts` (4) — 18 tests total
- Testing infra: Vitest 3.2.4 + React Testing Library + jsdom en `apps/web/`

### Changed
- `apps/web/components/projects/project-actions.tsx`: añadido enlace Dashboard con ícono LayoutDashboard

### Fixed
- `agent-files-panel.tsx`: corregido `useState(() => setTimeout)` → `useEffect` con cleanup

### Removed
- N/A

---

## [v0.4.0] — 2026-05-07 ✅ M4 Agent Runner

### Added
- M4 Agent Runner (HU-14→17): orquestador de 9 agentes IA que generan código capa por capa
- Backend: `encryption.service.ts` — AES-256-GCM encrypt/decrypt para API keys (Sprint 2.5 prereq)
- Backend: `agent-queue.ts` — BullMQ Queue + `enqueueAgentRun` producer
- Backend: `tool-definitions.ts` — 4 tools para Claude Tool Use: createFile, readFile, listFiles, taskComplete
- Backend: `tool-executor.ts` — ejecutor de tools con path traversal prevention y límites de seguridad
- Backend: `ws.auth.ts` — autenticación JWT en handshake WebSocket
- Backend: `ws.emitter.ts` — emisor de 7 tipos de eventos WS con Map<projectId> connection registry
- Backend: `ws.routes.ts` — ruta WebSocket `/ws/projects/:id` con auth + replay via `?since=`
- Backend: `base-agent.ts` — Tool Use loop (claude-opus-4-5, MAX_TURNS=50, 10min timeout) con backoff exponencial para rate limits
- Backend: `context-builder.ts` — construye prompts con spec.md + archivos de capas previas
- Backend: `orchestrator.ts` — pipeline secuencial 9 capas con pause/resume Redis + retry desde capa fallida
- Backend: 9 agent files (dba, seed, backend, frontend, qa, security, docs, deploy, integration)
- Backend: `agent.service.ts` + `agent.controller.ts` + `agent.routes.ts` — CRUD agentes y logs
- Backend: `agent-worker.ts` — BullMQ Worker concurrency=3 + `worker.ts` entry point
- Prisma: modelos `UserSettings`, `Agent`, `AgentLog`, `GeneratedFile` + migration M4
- Skills: `skills/{9 agents}/system.md + task.md` — prompts de sistema y tarea para cada agente
- Redis: flag `project:pause:{id}` para pause/continue graceful entre capas
- Tests: `tool-executor.test.ts` (12), `encryption.service.test.ts` (9), `orchestrator.test.ts` (5), `ws.auth.test.ts` (8), `agent.integration.test.ts` (3)

### Changed
- `project.service.ts`: `startProject` encola BullMQ, `pauseProject` sets Redis flag, `continueProject` clears Redis flag, `retryProject` re-encola desde capa fallida
- `app.ts`: registra `@fastify/websocket` + `wsRoutes` + `agentRoutes`
- `package.json` (api): añade script `"worker": "tsx src/worker.ts"`



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
