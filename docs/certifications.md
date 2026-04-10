# Certificaciones — Sophia Platform

Última actualización: 2026-04-10

---

## RESUMEN EJECUTIVO

| Módulo | HUs | Criterios | ✅ Pass | Progreso | Certificación |
|--------|-----|-----------|---------|----------|---------------|
| M1 Auth | 5 | 36 | 36 | 100% | ✅ CERTIFICADO |
| M2 Projects | 5 | 28 | 28 | 100% | ✅ CERTIFICADO |
| M3 Spec Engine | 3 | 35 | 35 | 100% | ✅ CERTIFICADO |
| M4 Agent Runner | 4 | 45 | 45 | 100% | ✅ CERTIFICADO |
| M5 Dashboard | 5 | 62 | 62 | 100% | ✅ CERTIFICADO |
| M6 File Manager | 3 | 43 | 43 | 100% | ✅ CERTIFICADO |
| M7 Settings | 3 | 34 | 34 | 100% | ✅ CERTIFICADO |
| M9 Agent Improvements | 19 | 104 | 104 | 100% | ✅ CERTIFICADO |
| **TOTAL** | **47** | **387** | **387** | **100%** | **✅ 100% certificado** |

---

## M1 — AUTH

**Estado:** ✅ CERTIFICADO — 36/36 criterios
**Spec:** `specs/001-m1-auth/spec.md`

Fixes aplicados durante certificación:
- LogoutButton agregado al dashboard layout (era invisible)
- 5 tests nuevos de rate limit
- Redirect post-registro cambiado a `/projects`

---

## M2 — PROJECTS

**Estado:** ✅ CERTIFICADO — 28/28 criterios
**Spec:** `specs/002-m2-projects/spec.md`

Fixes aplicados durante certificación:
- Status `'generating'` → `'running'` en 6 lugares del backend
- Banners de éxito inline para update y delete de proyectos

---

## M3 — SPEC ENGINE

**Estado:** ✅ CERTIFICADO — 35/35 criterios
**Spec:** `specs/003-m3-spec-engine/spec.md`

Sin issues. Pasó todos los criterios sin cambios.

---

## M4 — AGENT RUNNER

**Estado:** ✅ CERTIFICADO — 45/45 criterios
**Spec:** `specs/004-m4-agent-runner/spec.md`

Fixes aplicados durante certificación:
- Validación de spec en `startProject()` antes de ejecutar
- Persistencia de progress/currentLayer en BD tras cada capa
- Status final `completed` → `done`
- Eventos WS: `pipeline:completed` → `project:done`, `pipeline:failed` → `project:error`, `agent:paused` → `project:paused`

---

## M5 — DASHBOARD

**Estado:** ✅ CERTIFICADO — 62/62 criterios
**Spec:** `specs/005-m5-dashboard/spec.md`

Fixes aplicados durante certificación:
- Badge `+N` de logs no leídos (unreadCount en Zustand store)
- Handler `fetchHistory` con endpoint `/api/projects/:id/logs?limit=500`
- Métricas corregidas: "Agentes X/9", "Creados X/~est", "Generados X"
- Colores Pausar (azul outline) / Continuar (azul solid)
- Texto de confirmación de pausa explicativo

---

## M6 — FILE MANAGER

**Estado:** ✅ CERTIFICADO — 43/43 criterios
**Spec:** `specs/006-m6-file-manager/spec.md`

Fixes aplicados durante certificación:
- Mapa de íconos unificado con M5 (`@sophia/shared/constants/file-icons`)
- Breadcrumb muestra ruta completa (campo `path` en FileTreeNodeData)
- Detección de archivos binarios: `BINARY_EXTENSIONS` en backend, vista informativa en frontend

---

## M7 — SETTINGS

**Estado:** ✅ CERTIFICADO — 34/34 criterios
**Spec:** `specs/007-m7-settings/spec.md`

Fixes aplicados durante certificación:
- Display API key como `sk-ant-...XXXX` en vez de puntos genéricos
- Modal de confirmación al eliminar API key
- Mensaje informativo + enlace a Anthropic docs cuando no hay key configurada
- Disclaimer de precios estimados en usage overview
- Opción "Todo" (365 días) en filtro de período del gráfico

---

## M9 — AGENT IMPROVEMENTS

**Estado:** ✅ CERTIFICADO — 104/104 criterios
**Spec:** `specs/009-m9-improvements/spec.md`

19 HUs certificadas:
- **HU-29** Grafo de dependencias entre agentes (6 criterios)
- **HU-30** Ejecución paralela de capas independientes (5 criterios)
- **HU-31** WebSocket y tracking para capas paralelas (5 criterios)
- **HU-32** Crear skills compartidas (5 criterios)
- **HU-33** Composición de prompts con skills compartidas (5 criterios)
- **HU-34** Estandarización de reportes entre agentes (5 criterios)
- **HU-35** Referencias cruzadas entre agentes (5 criterios)
- **HU-36** Persistencia de conversación Claude (6 criterios)
- **HU-37** Memoria acumulativa de proyecto (5 criterios)
- **HU-38** Checkpoint granular por archivo (4 criterios)
- **HU-39** Context window inteligente (5 criterios)
- **HU-40** Extractor de criterios de aceptación (6 criterios)
- **HU-41** Mapeo criterio → test por QA-agent (4 criterios)
- **HU-42** Quality gate de cobertura de criterios (6 criterios)
- **HU-43** Certification report con trazabilidad (5 criterios)
- **HU-44** Graceful shutdown del worker (7 criterios)
- **HU-45** Timeout por llamada individual a Claude API (5 criterios)
- **HU-46** Thread-safety del Anthropic client para paralelismo (5 criterios)
- **HU-47** Monitoreo de memoria por agente (7 criterios)

Fixes aplicados durante implementación:
- Singleton Anthropic client validado como thread-safe (ADR documentado)
- Quality gate con max 2 re-runs de QA antes de continuar con warning
- `PARTIAL` status para test-mapping entries con testFile pero sin testName

---

## VALIDACIÓN GLOBAL

- **Lint**: `pnpm --filter @sophia/web lint` ✅ | `pnpm --filter @sophia/api lint` ✅
- **Tests**: 30 archivos, 254/254 passing ✅
- **API build** (tsc): ✅
- **Web build** (next build): ✅ — 11 páginas compiladas

---

## ESTADOS

- ✅ CERTIFICADO — todos los criterios funcionales pasan + tests cubren paths principales
- ⚠️ PARCIAL — criterios funcionales pasan pero faltan tests en algunos
- ❌ NO CERTIFICADO — uno o más criterios funcionales fallan
