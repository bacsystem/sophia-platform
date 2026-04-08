# Implementation Plan: M5 Dashboard

**Branch**: `005-m5-dashboard` | **Date**: 2026-04-07 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-m5-dashboard/spec.md`

## Summary

Dashboard visual interactivo con Canvas API nativo mostrando 9 agentes como nodos animados + 1 orchestrator. Conexiones, partículas, log en tiempo real, archivos generados, métricas y controles de ejecución. Vista simplificada en mobile. WebSocket para eventos en tiempo real via Zustand store.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 22
**Primary Dependencies**: Next.js 15, Canvas API nativo, Framer Motion, Zustand, shiki, Lucide React, @sophia/shared
**Storage**: N/A (consume endpoints M4 y WebSocket)
**Testing**: Vitest + React Testing Library
**Target Platform**: Web (Next.js frontend)
**Project Type**: web-app (frontend-only, consume API M4)
**Performance Goals**: ≥ 45fps con 9 nodos + partículas, target 60fps, ring buffer 200 logs
**Constraints**: Canvas API nativo (sin D3/Three.js), Lucide React (sin emojis), Zustand (sin Redux)
**Scale/Scope**: MVP — 5 HUs, 0 endpoints (consume M4), Canvas + mobile list, WS hook

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Auth por Cookies | ✅ PASS | Fetch con credentials: 'include', WS auth via cookies |
| II. Prisma Directo | N/A | Frontend-only |
| III. Pipeline 9 Agentes | ✅ PASS | 9 nodos de agentes reales + orchestrator visual |
| IV. pnpm Exclusivo | ✅ PASS | |
| V. Patrón Backend | N/A | Frontend-only |
| VI. Frontend Server-First | ✅ PASS | Layout server-side, canvas/interactividad "use client" |
| VII. Seguridad Default | ✅ PASS | Fetch credentials: 'include', no bearer tokens |

## Project Structure

### Documentation (this feature)

```text
specs/005-m5-dashboard/
├── spec.md
├── plan.md              # This file
└── tasks.md
```

### Source Code (repository root)

```text
apps/web/
├── components/dashboard/
│   ├── dashboard-layout.tsx
│   ├── agent-canvas.tsx
│   ├── agent-canvas-renderer.ts
│   ├── agent-canvas-events.ts
│   ├── agent-particles.ts
│   ├── agent-log-panel.tsx
│   ├── agent-files-panel.tsx
│   ├── agent-metrics-bar.tsx
│   ├── agent-controls.tsx
│   ├── agent-detail-panel.tsx
│   ├── agent-list-mobile.tsx
│   ├── file-preview-modal.tsx
│   └── dashboard-empty.tsx
├── hooks/
│   ├── use-websocket.ts
│   ├── use-dashboard-store.ts
│   └── use-elapsed-time.ts
└── lib/
    ├── agent-config.ts         # Posiciones, colores, radios por tipo
    └── ws-events.ts            # Tipos WS (importados de @sophia/shared)

packages/shared/constants/
└── file-icons.ts               # Mapa unificado extensión → Lucide component + SVG path
```

## Architecture Decisions

1. **Canvas API nativo** — sin D3/Three.js, hit-testing manual con coordenadas circulares
2. **requestAnimationFrame loop** — pulso, shake, partículas; performance monitoring via delta
3. **Zustand store** — estado centralizado de agents, logs (ring buffer 200), files, metrics
4. **WebSocket hook** — reconexión 3s, replay via lastEventId, snapshot en primera conexión
5. **Responsive** — Canvas ≥768px con ResizeObserver + devicePixelRatio; lista mobile <768px
6. **shiki** — syntax highlighting consistente con M6

## Dependencies

- **M2**: Projects — detalle proyecto, tabs
- **M4**: Agent Runner — WebSocket events, endpoints agents/logs, pause/continue/retry
- **M6 (parcial)**: File Manager — botón "Descargar ZIP" (deshabilitado si M6 no existe)
