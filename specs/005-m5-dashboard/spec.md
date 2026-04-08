# SPEC — M5: Dashboard (Visualización en Tiempo Real)

# Sophia Platform

# Versión: 1.2 | Sprint: 4

---

## Descripción

Dashboard visual interactivo que muestra los agentes trabajando en tiempo real. Nodos animados en Canvas API nativo con conexiones que reflejan el flujo secuencial de capas, log en vivo, archivos generados y métricas del proyecto. Vista simplificada en mobile.

---

## Stack

- Frontend: Next.js 15 + Canvas API nativo + Framer Motion (UI transitions)
- Estado: Zustand (dashboard store)
- WebSockets: hook personalizado con reconexión + replay
- Syntax highlight: shiki (preview de archivos)
- Iconos: Lucide React
- No Three.js, no D3, no librerías de canvas externas

> **Decisión**: Canvas API nativo en vez de SVG+CSS. Más control sobre animaciones y partículas. Sin overhead de D3 o Three.js. Eventos (hover, click) manejados con hit-testing manual sobre coordenadas del canvas.

---

## Dependencias

- **M2**: Projects — detalle del proyecto, tabs
- **M4**: Agent Runner — WebSocket events, endpoints de agents/logs, pause/continue/retry
- **M6** (parcial): File Manager — botón "Descargar ZIP" en HU-22 invoca endpoint de M6. Si M6 no está implementado, el botón se deshabilita con tooltip "Disponible cuando M6 esté implementado".

---

## Historias de Usuario

### HU-18 — Ver agentes en tiempo real

**Como** usuario
**Quiero** ver los agentes como nodos animados
**Para** entender qué está haciendo cada uno

**Criterios de aceptación:**

- [ ] Área principal del dashboard muestra nodos de agentes en un `<canvas>` HTML5
- [ ] 9 nodos de agentes reales (dba, seed, backend, frontend, qa, security, docs, deploy, integration) + 1 nodo visual "Orchestrator"
- [ ] El nodo Orchestrator refleja `projects.status` y `projects.current_layer` (no es un agente real)
- [ ] Conexiones reflejan el flujo secuencial real de capas:

```
Orchestrator
     │
     ▼
    DBA ─► Seed ─► Backend ─► Frontend ─► QA ─► Security ─► Docs ─► Deploy ─► Integration
```

- [ ] Estados visuales de cada nodo:
  - `queued` → gris claro, sin animación, label "En cola"
  - `idle` → gris, sin animación
  - `working` → color del agente, anillo CSS pulsando, label con tarea actual
  - `done` → verde, checkmark ✓, sin animación
  - `error` → rojo, animación CSS shake
  - `paused` → ámbar, anillo estático
- [ ] Conexión entre nodos se ilumina cuando la capa del destino está activa
- [ ] Partículas animadas viajan por la conexión activa (requestAnimationFrame)
- [ ] Tooltip al hover (overlay HTML posicionado sobre canvas): nombre, tarea actual, tokens usados, tiempo
- [ ] Clic en nodo (hit-testing circular) → expande panel lateral con detalle del agente (logs, archivos, progreso)
- [ ] Canvas responsive: escala con `devicePixelRatio` y redimensiona con `ResizeObserver`

**Nodos — posiciones y colores:**

```
Orchestrator: center-top    color: #5b8dee (azul)       radio: 38px
DBA:          row1-left      color: #f59e0b (ámbar)      radio: 28px
Seed:         row1-center    color: #84cc16 (lima)       radio: 24px
Backend:      row2-left      color: #a855f7 (púrpura)    radio: 28px
Frontend:     row2-center    color: #06d6a0 (cyan)       radio: 28px
QA:           row2-right     color: #10b981 (verde)      radio: 28px
Security:     row3-left      color: #ef4444 (rojo)       radio: 24px
Docs:         row3-center    color: #f97316 (naranja)    radio: 26px
Deploy:       row3-right     color: #6366f1 (indigo)     radio: 26px
Integration:  bottom-center  color: #ec4899 (rosa)       radio: 26px
```

**Posiciones Canvas (coordenadas lógicas 0-700 x 0-500, escaladas al tamaño real):**

```
Orchestrator: { cx: 350, cy: 40  }
DBA:          { cx: 120, cy: 140 }
Seed:         { cx: 280, cy: 140 }
Backend:      { cx: 120, cy: 260 }
Frontend:     { cx: 280, cy: 260 }
QA:           { cx: 440, cy: 260 }
Security:     { cx: 120, cy: 380 }
Docs:         { cx: 280, cy: 380 }
Deploy:       { cx: 440, cy: 380 }
Integration:  { cx: 350, cy: 470 }
```

---

### HU-19 — Ver log en tiempo real

**Como** usuario
**Quiero** ver el log de actividad de todos los agentes
**Para** saber exactamente qué está haciendo cada uno

**Criterios de aceptación:**

- [ ] Panel de log en sidebar derecho del dashboard
- [ ] Cada entrada: `mm:ss` | `[agente]` con color | mensaje
- [ ] Colores por tipo:
  - `info` → texto gris `●`
  - `ok` → texto verde `✓`
  - `warn` → texto ámbar `⚠`
  - `error` → texto rojo `✕`
- [ ] Auto-scroll al último mensaje
- [ ] Botón para pausar/reanudar auto-scroll
- [ ] Badge con contador de mensajes nuevos cuando scroll está pausado
- [ ] Ring buffer de 200 logs en Zustand — los más recientes
- [ ] Botón "Ver historial completo" → abre vista paginada (consume `GET /api/projects/:id/logs`)
- [ ] Filtro por agente (tabs o dropdown)

---

### HU-20 — Ver archivos generados en tiempo real

**Como** usuario
**Quiero** ver los archivos generándose conforme aparecen
**Para** confirmar que el proyecto se construye correctamente

**Criterios de aceptación:**

- [ ] Tab "Archivos" en el sidebar (junto a tab "Logs")
- [ ] Cada archivo aparece con animación Framer Motion (fade + slide down)
- [ ] Ícono dinámico por extensión (mapa unificado en `packages/shared/constants/file-icons.ts`, compartido con M6). Usa componentes Lucide React:
  - `.ts` `.tsx` → `<FileCode />` (azul)
  - `.sql` → `<Database />`
  - `.prisma` → `<Gem />`
  - `.json` → `<FileJson />`
  - `.md` → `<FileText />`
  - `.yml` `.yaml` → `<Settings />`
  - `.css` → `<Palette />`
  - `.env` → `<Lock />`
  - otros → `<File />`
  > En el Canvas (HU-18), los íconos se renderizan como SVG paths de Lucide dibujados con `ctx.fill()` / `ctx.stroke()`. El mapa exporta tanto el componente React como el path SVG raw.
- [ ] Muestra: ícono, nombre, ruta relativa, badge del agente que lo creó
- [ ] Badge "NEW" verde durante 3 segundos después de aparecer
- [ ] Clic en archivo → modal con contenido + syntax highlighting (shiki)
- [ ] Contador total: "23 archivos generados"
- [ ] Agrupados por carpeta (colapsables, expandidos por defecto en la capa activa)

---

### HU-21 — Ver métricas del proyecto

**Como** usuario
**Quiero** ver métricas actualizándose en tiempo real
**Para** tener una visión general del progreso

**Criterios de aceptación:**

- [ ] Barra de métricas en la parte superior del dashboard
- [ ] 5 métricas en cards:
  - `<Bot />` Agentes activos: `2 / 9`
  - `<BarChart3 />` Archivos creados: `12 / ~28` (creados vs estimados por heurística M4)
  - `<FolderOpen />` Archivos generados: `23`
  - `<Timer />` Tiempo transcurrido: `04:32` (timer local, sincronizado con `project.createdAt`)
  - `<Coins />` Tokens usados: `24,831` (formateado con separador de miles)
- [ ] Barra de progreso general debajo de métricas: `68%` con color gradient
- [ ] Indicador de capa actual: "Layer 2: Backend" con icono del agente
- [ ] Todas las métricas se actualizan via WebSocket events
- [ ] Timer local con `setInterval(1000)` que se limpia al desmontar

---

### HU-22 — Controlar ejecución desde el dashboard

**Como** usuario
**Quiero** pausar, continuar y reintentar desde el dashboard
**Para** tener control sin salir de la visualización

**Criterios de aceptación:**

- [ ] Botones en la barra superior junto a las métricas
- [ ] Estado `running` → botón "⏸ Pausar" (azul outline)
- [ ] Estado `paused` → botón "▶ Continuar" (azul solid) + nodos en estado visual paused
- [ ] Estado `error` → botón "↺ Reintentar" (rojo outline) + nodo con error resaltado
- [ ] Estado `done` → botón "⬇ Descargar ZIP" (verde solid) + todos los nodos verdes
- [ ] Al pausar → nodos activos cambian a estado visual `paused`, conexiones se atenúan (opacity 0.3)
- [ ] Al continuar → nodos retoman estado `working`, conexiones se reiluminan
- [ ] Confirmación antes de pausar: "El agente actual terminará su tarea antes de pausar"

---

## Vista Mobile (< 768px)

En pantallas pequeñas, el canvas se reemplaza por una vista simplificada:

```
┌─────────────────────────────────┐
│ Progress: ████████░░ 68%        │
│ Layer 2: Backend    ⏸ Pausar    │
├─────────────────────────────────┤
│ 🟢 DBA          ✓ Done    100% │
│ 🟢 Seed         ✓ Done    100% │
│ 🟥 Backend      ● Working  45% │
│ ⚪ Frontend     ○ Queued    0% │
│ ⚪ QA           ○ Queued    0% │
│ ⚪ Security     ○ Queued    0% │
│ ⚪ Docs         ○ Queued    0% │
│ ⚪ Deploy       ○ Queued    0% │
│ ⚪ Integration  ○ Queued    0% │
├─────────────────────────────────┤
│ Logs | Archivos                 │
│ ─────────────────               │
│ 10:32 [backend] ✓ Created...   │
│ 10:31 [backend] ● Generating...│
│ 10:30 [dba] ✓ Layer complete   │
└─────────────────────────────────┘
```

**Criterios:**

- [ ] Lista vertical de agentes con progress bar inline
- [ ] Progress bar general en top
- [ ] Botón de acción (pausar/continuar/etc.) siempre visible
- [ ] Tabs logs/archivos en parte inferior (full width)
- [ ] Sin canvas, sin partículas, sin conexiones

---

## WebSocket Hook

```typescript
// use-websocket.ts — hook tipado con reconexión y replay

interface UseWebSocketOptions {
  projectId: string;
  onAgentStatus: (data: AgentStatusEvent) => void;
  onAgentLog: (data: AgentLogEvent) => void;
  onFileCreated: (data: FileCreatedEvent) => void;
  onProjectProgress: (data: ProjectProgressEvent) => void;
  onProjectDone: (data: ProjectDoneEvent) => void;
  onProjectPaused: (data: ProjectPausedEvent) => void;
  onProjectError: (data: ProjectErrorEvent) => void;
}

function useWebSocket(options: UseWebSocketOptions) {
  // 1. Conectar a WS /ws/projects/:id (cookie auth automática)
  // 2. Al conectar → recibir snapshot inicial del servidor
  // 3. Escuchar eventos y llamar callbacks tipados
  // 4. Si se desconecta → reconectar cada 3s con lastEventId
  // 5. Al reconectar → servidor hace replay de eventos perdidos
  // 6. Cleanup: cerrar WS al desmontar componente
  // Returns: { connected, reconnecting, disconnect }
}
```

---

## Zustand Store

```typescript
interface DashboardStore {
  // Agents (9 agentes reales)
  agents: AgentNode[];
  updateAgent: (agentId: string, update: Partial<AgentNode>) => void;

  // Logs (ring buffer de 200)
  logs: AgentLog[];
  addLog: (log: AgentLog) => void; // Si > 200, elimina el más antiguo

  // Files
  files: GeneratedFile[];
  addFile: (file: GeneratedFile) => void;

  // Project metrics
  progress: number;
  currentLayer: number;
  currentLayerName: string;
  status: ProjectStatus;
  tokensUsed: number;
  totalFiles: number;
  activeAgents: number;

  // UI state
  connected: boolean;
  scrollPaused: boolean;
  selectedAgentId: string | null;
  activeTab: "logs" | "files";

  // Actions
  setConnected: (connected: boolean) => void;
  setScrollPaused: (paused: boolean) => void;
  selectAgent: (agentId: string | null) => void;
  setActiveTab: (tab: "logs" | "files") => void;
  applySnapshot: (snapshot: DashboardSnapshot) => void;
  reset: () => void;
}
```

```typescript
interface AgentNode {
  id: string;
  type: "dba" | "seed" | "backend" | "frontend" | "qa" | "security" | "docs" | "deploy" | "integration";
  status: "idle" | "queued" | "working" | "done" | "error" | "paused";
  progress: number;
  currentTask: string | null;
  tokensUsed: number;
  filesCreated: number;
  startedAt: string | null;
  completedAt: string | null;
  color: string;
  // Posiciones lógicas precalculadas por tipo (escaladas al renderizar en canvas)
  cx: number;
  cy: number;
  radius: number;
}
```

---

## Componentes Frontend

### Desktop layout

```
┌──────────────────────────────────────────────────────┐
│ [Metrics bar: progress, layer, agents, files, time]  │
│ [Actions: Pausar / Continuar / Reintentar / Download]│
├────────────────────────────────┬─────────────────────┤
│                                │ [Logs] [Archivos]   │
│      Canvas Agent Graph         │                     │
│   (nodos + conexiones +        │  Log entries...     │
│    partículas)                 │  or                 │
│                                │  File list...       │
│                                │                     │
├────────────────────────────────┴─────────────────────┤
│ [Agent detail panel — shown on agent click]          │
└──────────────────────────────────────────────────────┘
```

### Archivos a crear

```
apps/web/components/dashboard/
├── dashboard-layout.tsx         → Layout responsive (desktop canvas vs mobile list)
├── agent-canvas.tsx             → Canvas HTML5 con nodos, conexiones y partículas
├── agent-canvas-renderer.ts     → Funciones de renderizado: drawNode, drawConnection, drawParticle
├── agent-canvas-events.ts       → Hit-testing para hover/click en nodos del canvas
├── agent-particles.ts           → Sistema de partículas Canvas sobre conexiones activas
├── agent-log-panel.tsx          → Panel de logs con auto-scroll y filtro
├── agent-files-panel.tsx        → Panel de archivos con agrupación por carpeta
├── agent-metrics-bar.tsx        → Barra de métricas + progreso
├── agent-controls.tsx           → Botones de acción según estado
├── agent-detail-panel.tsx       → Panel expandible al clic en nodo
├── agent-list-mobile.tsx        → Vista mobile: lista de agentes con progress
├── file-preview-modal.tsx       → Modal con contenido + syntax highlighting (shiki)
└── dashboard-empty.tsx          → Estado vacío/idle antes de iniciar

apps/web/hooks/
├── use-websocket.ts             → Hook WS con reconexión, replay, tipado
├── use-dashboard-store.ts       → Zustand store export
└── use-elapsed-time.ts          → Timer local sincronizado con createdAt

apps/web/lib/
├── agent-config.ts              → Posiciones, colores, íconos por tipo de agente
└── ws-events.ts                 → Tipos de eventos WS (importados de packages/shared)
```

---

## Animaciones Canvas

Todas las animaciones se ejecutan en el render loop con `requestAnimationFrame`:

```typescript
// Pulso para nodo working
function drawPulse(ctx: CanvasRenderingContext2D, node: AgentNode, time: number) {
  const scale = 1 + 0.15 * Math.sin(time * 0.003); // oscila radio ±15%
  const alpha = 0.6 + 0.4 * Math.sin(time * 0.003); // oscila opacidad
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(node.cx, node.cy, node.radius * scale, 0, Math.PI * 2);
  ctx.strokeStyle = node.color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// Shake para nodo error
function drawShake(ctx: CanvasRenderingContext2D, node: AgentNode, time: number) {
  const offset = 4 * Math.sin(time * 0.02); // desplazamiento horizontal
  // Renderizar nodo con cx + offset
}

// Partículas viajando por conexión activa
function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = particle.color;
  ctx.fill();
}
```

---

## NFRs Específicos de M5

- **Rendimiento**: Dashboard debe mantener ≥45fps con 9 nodos + partículas activas (requestAnimationFrame). Target 60fps en hardware estándar. Medir con `performance.now()` delta entre frames; si delta > 22ms (≈45fps) consistentemente, reducir partículas.
- **Memory**: Ring buffer de 200 logs, cleanup de partículas después de 2s, cancelar rAF al desmontar
- **Responsive**: Canvas ≥ 768px (escala con ResizeObserver + devicePixelRatio), lista simplificada < 768px
- **Accesibilidad**: Tooltip HTML overlay al hover, `aria-live` en log panel, keyboard navigation con overlay buttons
- **Reconnect**: WebSocket reconecta cada 3s, replay de eventos perdidos con `lastEventId`
- **Cleanup**: `useEffect` cleanup para WS, timers, requestAnimationFrame y ResizeObserver al desmontar

---

## Fuera de Scope (M5)

- Three.js / WebGL rendering
- D3.js o librerías externas de Canvas
- Drag and drop de nodos
- Zoom y pan en el canvas
- Audio feedback (sonidos al completar)
- Tema oscuro/claro toggle (hereda del sistema)
- Multi-usuario viendo el mismo proyecto simultáneamente (funciona por diseño de WS rooms, pero no se testea explícitamente)

---

## Definición de Done

- [ ] Desktop: Canvas muestra 9 agentes + orchestrator con posiciones y colores correctos
- [ ] Animaciones Canvas para working (pulso), done (check), error (shake), paused (ámbar)
- [ ] Conexiones se iluminan al activar la capa correspondiente
- [ ] Partículas animadas viajan por la conexión al cambiar de capa
- [ ] Clic en nodo (hit-testing) expande panel de detalle del agente
- [ ] Log panel recibe y muestra eventos WS en tiempo real con auto-scroll
- [ ] Archivos panel muestra archivos agrupados por carpeta con animación de entrada
- [ ] Preview de archivo con syntax highlighting (shiki) funciona
- [ ] Métricas se actualizan en tiempo real, timer local funciona
- [ ] Botones pausar/continuar/reintentar/descargar funcionan correctamente
- [ ] Mobile: vista simplificada con lista de agentes + progress bars
- [ ] WebSocket hook con reconexión automática + replay funciona
- [ ] No hay memory leaks (cleanup de WS, timers, buffers al desmontar)
- [ ] Canvas responsive (ResizeObserver + devicePixelRatio)
- [ ] Tests de componentes clave (agent-canvas, log-panel, websocket hook)
- [ ] No hay `any` en TypeScript
