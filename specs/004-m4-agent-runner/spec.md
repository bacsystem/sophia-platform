# SPEC — M4: Agent Runner

# Sophia Platform

# Versión: 1.3.0 | Sprint: 3

---

## Descripción

Motor de orquestación y ejecución de agentes IA. Es el núcleo de Sophia. Coordina agentes especializados que generan código capa por capa usando Claude con Tool Use, persiste estado y progreso en BD, y emite eventos WebSocket en tiempo real. Los agentes trabajan de forma iterativa — no en un solo shot — generando archivos a través de herramientas definidas.

---

## Stack

- Backend: Node.js 22 + Fastify + BullMQ (queue) + Redis 7 + Anthropic SDK (tool use)
- WebSockets: @fastify/websocket
- DB: PostgreSQL 16 (tablas agents, agent_logs, generated_files)
- Filesystem: `{PROJECTS_BASE_DIR}/{projectId}/` para archivos generados

---

## Dependencias

- **M1**: Auth — usuario autenticado, token validado en WebSocket handshake
- **M2**: Projects — proyecto creado, stubs de start/pause/continue se reemplazan con lógica real
- **M3**: Spec Engine — spec generado como prerequisito para iniciar ejecución
- **M7 (parcial)**: Settings — `encryption.service.ts` + tabla `user_settings` deben existir antes de Sprint 3. M4 necesita desencriptar la API key del usuario para llamar a Anthropic.

> **Resolución de dependencia M4→M7**: Antes de Sprint 3, se implementa un **prerequisito compartido (Sprint 2.5)**:
> 1. Crear `apps/api/src/lib/encryption.service.ts` (AES-256-GCM encrypt/decrypt)
> 2. Crear migración con tabla `user_settings` (schema completo de M7: `id`, `user_id`, `anthropic_api_key_encrypted`, `anthropic_api_key_iv`, `anthropic_api_key_tag`, `anthropic_api_key_last4`, `created_at`, `updated_at`)
> 3. Este código se implementa **antes** de M4, y M7 lo reutiliza sin duplicar.
> 4. El archivo vive en `src/lib/` (shared utility), NO en `src/modules/settings/`.

---

## Modelo de Ejecución: Tool Use

Los agentes NO generan código como texto plano. Cada agente usa Claude con **Tool Use** — Claude decide qué archivos crear/leer llamando tools definidas. El backend ejecuta las tools y reporta resultados.

```
┌─────────────┐     ┌──────────────┐     ┌────────────────┐
│  Orchestrator│────►│ Claude API   │────►│ Tool Execution │
│  (per layer) │     │ (tool_use)   │     │ (backend)      │
│              │◄────│              │◄────│                │
└─────────────┘     └──────────────┘     └────────────────┘
      │                                         │
      │  emit WS events                         │  write to filesystem
      ▼                                         ▼
  WebSocket clients                    {PROJECTS_BASE}/{id}/
```

### Tools disponibles para agentes:

```typescript
const agentTools = [
  {
    name: "createFile",
    description: "Crea un archivo en el proyecto",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ruta relativa del archivo" },
        content: { type: "string", description: "Contenido del archivo" }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "readFile",
    description: "Lee un archivo existente del proyecto",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ruta relativa del archivo" }
      },
      required: ["path"]
    }
  },
  {
    name: "listFiles",
    description: "Lista archivos en un directorio del proyecto",
    input_schema: {
      type: "object",
      properties: {
        directory: { type: "string", description: "Ruta del directorio" }
      },
      required: ["directory"]
    }
  },
  {
    name: "taskComplete",
    description: "Marca la tarea actual como completada",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "Resumen de lo realizado" },
        filesCreated: { type: "array", items: { type: "string" }, description: "Archivos creados (puede ser vacío para agentes de validación/auditoría)" }
      },
      required: ["summary"]
    }
  }
];
```

### Seguridad de Tools:

- `createFile` y `readFile` validan que la ruta esté dentro de `{PROJECTS_BASE}/{projectId}/` (prevención de path traversal)
- No hay tool `runCommand` — los agentes no pueden ejecutar comandos arbitrarios
- Tamaño máximo por archivo: 100KB
- Máximo 100 archivos por agente por ejecución

---

## Capas de Ejecución

> **Prerequisito**: El proyecto DEBE tener spec generado (M3) antes de iniciar.
> Layers 1-2 del spec original (Planning/Design) se eliminan — ya están cubiertos por M3.

Las capas se ejecutan **secuencialmente**. No hay paralelismo en MVP para evitar inconsistencias entre agentes.

```
Layer 1:   Database    → dba-agent         (schema, migraciones)
Layer 1.5: Seed Data   → seed-agent        (seed data, factories, constantes de test)
Layer 2:   Backend     → backend-agent     (models, services, controllers, routes)
Layer 3:   Frontend    → frontend-agent    (pages, components, hooks, schemas)
Layer 4:   Testing     → qa-agent          (unit tests, integration tests)
Layer 4.5: Security    → security-agent    (OWASP audit, rate limiting, headers)
Layer 5:   Docs        → docs-agent        (README, API docs, architecture)
Layer 6:   Deployment  → deploy-agent      (Dockerfile, docker-compose, CI/CD)
Layer 7:   Integration → integration-agent (cross-layer validation, contratos)
```

### Contexto entre capas

Cada agente recibe en su prompt:
1. **Spec completo** — de `project_specs` (spec.md + data-model.md + api-design.md)
2. **Resumen de capas anteriores** — lista de archivos generados con resumen por agente
3. **Archivos críticos** — contenido de archivos que el agente actual necesita leer

```
Layer 1   (dba):         spec + data-model
Layer 1.5 (seed):        spec + schema de Layer 1 (migrations)
Layer 2   (backend):     spec + api-design + schema de Layer 1 + seeds de Layer 1.5
Layer 3   (frontend):    spec + api-design + rutas del backend (Layer 2)
Layer 4   (qa):          spec + archivos de Layer 2 + Layer 3 + seeds de Layer 1.5
Layer 4.5 (security):    spec + archivos de Layer 2 + Layer 3 (análisis OWASP)
Layer 5   (docs):        spec + resumen de todos los archivos generados
Layer 6   (deploy):      spec + package.json + lista de dependencias + reporte de seguridad (Layer 4.5)
Layer 7   (integration): spec + todos los archivos generados (validación cross-layer)
```

---

## Historias de Usuario

### HU-14 — Ejecutar proyecto con agentes

**Como** usuario
**Quiero** que Sophia ejecute el proyecto automáticamente
**Para** recibir el código sin escribirlo manualmente

**Criterios de aceptación:**

- [ ] El proyecto DEBE tener spec generado (M3) — si no, error 400
- [ ] Al iniciar → crea registros de agentes en BD (uno por tipo activado en config, seed/security/integration siempre activos)
- [ ] Orquestador ejecuta capas 1→7 secuencialmente (9 layers)
- [ ] Cada agente usa Claude con Tool Use para generar archivos iterativamente
- [ ] Al completar cada archivo → guarda metadata en BD + archivo en filesystem + emite WS event
- [ ] Al completar cada capa → actualiza `projects.current_layer` y `projects.progress`
- [ ] Al completar Layer 7 → `projects.status = done` + emite `project:done`
- [ ] Si un agente falla → `projects.status = error` + emite `project:error`
- [ ] Cada agente tiene timeout de 5 minutos — si excede, falla con error claro
- [ ] Checkpoint: después de cada archivo creado, el estado se persiste en BD (resumible)

**Flujo detallado:**

```
POST /api/projects/:id/start
  → Validar: proyecto existe, es del usuario, status idle, tiene spec
  → Crear registros Agent en BD (status: idle, 9 tipos)
  → Encolar job en BullMQ: { projectId, layer: 1 }
  → Responder 200 { status: running }

BullMQ Worker procesa job:
  → Orchestrator.runLayer(projectId, layerNumber)
    → Leer spec de project_specs
    → Leer archivos generados de capas anteriores
    → Instanciar agente correspondiente
    → Agent.execute(context) — loop de Tool Use:
        1. Envía prompt + tools a Claude
        2. Claude responde con tool_call (createFile, readFile, etc.)
        3. Backend ejecuta la tool, registra en BD, emite WS
        4. Envía resultado de tool a Claude
        5. Claude responde con otro tool_call o end_turn
        6. Repite hasta end_turn o timeout
    → Actualizar agent.status = done
    → Actualizar project.current_layer, project.progress
    → Si hay más capas → encolar siguiente job
    → Si es última capa → project.status = done
```

---

### HU-15 — Pausar ejecución

**Como** usuario
**Quiero** pausar la ejecución
**Para** revisar el trabajo antes de continuar

**Criterios de aceptación:**

- [ ] Botón "Pausar" disponible cuando `status = running`
- [ ] Al pausar → se marca flag `paused = true` en Redis
- [ ] El agente activo termina su tool_call actual antes de detenerse (graceful)
- [ ] `projects.status = paused`
- [ ] El agente activo queda con `status = paused` (no `done` ni `error`)
- [ ] Emite evento WS: `project:paused` con `{ layer, lastFile }`
- [ ] El job de BullMQ no se reencola hasta que el usuario continúe

---

### HU-16 — Continuar proyecto pausado

**Como** usuario
**Quiero** continuar desde donde se pausó
**Para** no perder el trabajo realizado

**Criterios de aceptación:**

- [ ] Botón "Continuar" disponible cuando `status = paused`
- [ ] Al continuar → lee `projects.current_layer` y archivos ya generados
- [ ] Recrea el contexto del agente con los archivos existentes
- [ ] NO repite archivos ya creados (lee de `generated_files`)
- [ ] El agente retoma generando los archivos faltantes de la capa actual
- [ ] `projects.status = running`
- [ ] Emite WS: `agent:status { status: working }` + `project:progress`

---

### HU-17 — Reintentar desde error

**Como** usuario
**Quiero** reintentar un proyecto que falló
**Para** no perder el progreso de capas anteriores

**Criterios de aceptación:**

- [ ] Botón "Reintentar" disponible cuando `status = error`
- [ ] Al reintentar → retoma desde la capa que falló (no desde Layer 1)
- [ ] Los archivos de capas completadas se preservan
- [ ] El agente que falló se reinicia con status `idle`
- [ ] Si falló por rate limit de Claude → retry automático con backoff (1s, 2s, 4s), max 3 intentos
- [ ] Si falló por timeout → reintenta con timeout extendido (10 min)
- [ ] Si falla 3 veces consecutivas → error permanente, requiere intervención manual

---

## WebSocket

### Conexión

```
WS /ws/projects/:id

Handshake:
  - Cookie access_token debe estar presente
  - Servidor valida JWT y ownership del proyecto
  - Si falla auth → cierra conexión con code 4001
  - Si proyecto no existe o no es del usuario → cierra con code 4003

Rooms:
  - Cada proyecto es un room: `project:{projectId}`
  - Múltiples tabs/conexiones del mismo usuario se unen al mismo room
  - Al desconectarse, se limpia la suscripción
```

### Reconexión

```
Cliente:
  - Reconecta automáticamente cada 3 segundos
  - Envía lastEventId al reconectarse (timestamp del último evento recibido)

Servidor:
  - Si lastEventId presente → replay eventos desde agent_logs con created_at > lastEventId
  - Si no hay lastEventId → envía estado actual (snapshot) como primer mensaje
  - Snapshot: { agents: [...status], project: { progress, layer, status } }
```

### Eventos Server → Client

```typescript
// Estado de un agente
{ event: "agent:status", data: {
  agentId: string,
  agentType: "dba" | "seed" | "backend" | "frontend" | "qa" | "security" | "docs" | "deploy" | "integration",
  status: "idle" | "queued" | "working" | "done" | "error" | "paused",
  progress: number, // 0-100
  currentTask: string | null
}}

// Log de un agente
{ event: "agent:log", data: {
  agentId: string,
  agentType: string,
  type: "info" | "ok" | "warn" | "error",
  message: string,
  timestamp: string // ISO 8601
}}

// Archivo creado
{ event: "file:created", data: {
  agentId: string,
  agentType: string,
  fileName: string,
  filePath: string,
  fileSize: number
}}

// Progreso del proyecto
{ event: "project:progress", data: {
  progress: number, // 0-100
  layer: number,    // 1, 1.5, 2, 3, 4, 4.5, 5, 6, 7
  layerName: string
}}

// Proyecto completado
{ event: "project:done", data: {
  totalFiles: number,
  tokensInput: number,
  tokensOutput: number,
  duration: number // segundos
}}

// Proyecto pausado
{ event: "project:paused", data: {
  layer: number,
  layerName: string,
  lastFile: string | null
}}

// Error
{ event: "project:error", data: {
  agentId: string,
  agentType: string,
  error: string,
  retryable: boolean
}}
```

---

## Endpoints API

```
POST /api/projects/:id/start       → Iniciar ejecución (reemplaza stub de M2)
POST /api/projects/:id/pause       → Pausar ejecución (reemplaza stub de M2)
POST /api/projects/:id/continue    → Continuar ejecución (reemplaza stub de M2)
POST /api/projects/:id/retry       → Reintentar desde error
GET  /api/projects/:id/agents      → Listar agentes del proyecto
GET  /api/projects/:id/logs        → Logs del proyecto (paginados)
WS   /ws/projects/:id              → Stream de eventos en tiempo real
```

### POST /api/projects/:id/start

```json
// Response 200
{ "data": { "id": "uuid", "status": "running", "agents": [
  { "id": "uuid", "type": "dba", "status": "idle" },
  { "id": "uuid", "type": "seed", "status": "idle" },
  { "id": "uuid", "type": "backend", "status": "idle" },
  { "id": "uuid", "type": "frontend", "status": "idle" },
  { "id": "uuid", "type": "qa", "status": "idle" },
  { "id": "uuid", "type": "security", "status": "idle" },
  { "id": "uuid", "type": "docs", "status": "idle" },
  { "id": "uuid", "type": "deploy", "status": "idle" },
  { "id": "uuid", "type": "integration", "status": "idle" }
]}}

// Response 400
{ "error": "NO_SPEC", "message": "El proyecto debe tener spec generado antes de iniciar" }

// Response 400
{ "error": "INVALID_STATE_TRANSITION", "message": "Solo se puede iniciar un proyecto en estado 'idle'" }
```

### POST /api/projects/:id/retry

```json
// Response 200
{ "data": { "id": "uuid", "status": "running", "retryFromLayer": 3, "retryFromLayerName": "Frontend" } }

// Response 400
{ "error": "INVALID_STATE_TRANSITION", "message": "Solo se puede reintentar un proyecto en estado 'error'" }
```

### GET /api/projects/:id/agents

```json
// Response 200
{
  "data": [
    {
      "id": "uuid",
      "type": "dba",
      "status": "done",
      "progress": 100,
      "currentTask": null,
      "tokensInput": 5200,
      "tokensOutput": 3220,
      "filesCreated": 5,
      "startedAt": "2026-04-07T10:00:00Z",
      "completedAt": "2026-04-07T10:02:30Z"
    },
    {
      "id": "uuid",
      "type": "backend",
      "status": "working",
      "progress": 45,
      "currentTask": "Generando UserService.ts",
      "tokensInput": 7800,
      "tokensOutput": 4500,
      "filesCreated": 8,
      "startedAt": "2026-04-07T10:02:31Z",
      "completedAt": null
    }
  ]
}
```

### GET /api/projects/:id/logs

```json
// Query: ?page=1&limit=50&agentType=backend&type=error

// Response 200
{
  "data": [
    {
      "id": "uuid",
      "agentId": "uuid",
      "agentType": "backend",
      "type": "ok",
      "message": "Archivo creado: src/modules/auth/auth.service.ts",
      "createdAt": "2026-04-07T10:02:45Z"
    }
  ],
  "meta": {
    "total": 234,
    "page": 1,
    "limit": 50,
    "pages": 5
  }
}
```

---

## Data Model

### agents

| Campo        | Tipo         | Nullable | Default           | Descripción                         |
| ------------ | ------------ | -------- | ----------------- | ----------------------------------- |
| id           | uuid         | No       | gen_random_uuid() | PK                                  |
| project_id   | uuid         | No       | —                 | FK → projects                       |
| type         | varchar(20)  | No       | —                 | dba, seed, backend, frontend, qa, security, docs, deploy, integration |
| status       | varchar(20)  | No       | idle              | idle, queued, working, done, error, paused  |
| progress     | integer      | No       | 0                 | 0-100                               |
| current_task | text         | Sí       | null              | Descripción de tarea actual         |
| tokens_input | integer      | No       | 0                 | Tokens input consumidos             |
| tokens_output| integer      | No       | 0                 | Tokens output consumidos            |
| layer        | real         | No       | —                 | Capa asignada (1, 1.5, 2, 3, 4, 4.5, 5, 6, 7) |
| error        | text         | Sí       | null              | Mensaje de error si status = error  |
| started_at   | timestamptz  | Sí       | null              | Inicio de ejecución                 |
| completed_at | timestamptz  | Sí       | null              | Fin de ejecución                    |
| created_at   | timestamptz  | No       | now()             | —                                   |
| updated_at   | timestamptz  | No       | now()             | —                                   |

**Índices:**

- INDEX: `project_id`
- INDEX: `(project_id, type)` UNIQUE
- INDEX: `(project_id, status)`

### agent_logs

| Campo      | Tipo         | Nullable | Default           | Descripción                    |
| ---------- | ------------ | -------- | ----------------- | ------------------------------ |
| id         | uuid         | No       | gen_random_uuid() | PK                             |
| agent_id   | uuid         | No       | —                 | FK → agents                    |
| project_id | uuid         | No       | —                 | FK → projects (denormalizado)  |
| type       | varchar(10)  | No       | —                 | info, ok, warn, error          |
| message    | text         | No       | —                 | Mensaje del log                |
| created_at | timestamptz  | No       | now()             | Usado para replay en reconexión |

**Índices:**

- INDEX: `project_id`
- INDEX: `(project_id, created_at)` — para replay WS y paginación
- INDEX: `(project_id, type)` — para filtro por tipo

### generated_files (metadata — contenido en filesystem)

| Campo      | Tipo         | Nullable | Default           | Descripción                          |
| ---------- | ------------ | -------- | ----------------- | ------------------------------------ |
| id         | uuid         | No       | gen_random_uuid() | PK                                   |
| project_id | uuid         | No       | —                 | FK → projects                        |
| agent_id   | uuid         | No       | —                 | FK → agents                          |
| name       | varchar(255) | No       | —                 | Nombre del archivo                   |
| path       | text         | No       | —                 | Ruta relativa dentro del proyecto    |
| size_bytes | integer      | No       | —                 | Tamaño en bytes                      |
| layer      | real         | No       | —                 | Capa en la que se generó (1, 1.5, 2, 3, 4, 4.5, 5, 6, 7) |
| created_at | timestamptz  | No       | now()             | —                                    |

> **Nota**: El contenido del archivo vive en filesystem `{PROJECTS_BASE_DIR}/{projectId}/{path}`. La BD solo almacena metadata.

**Índices:**

- INDEX: `project_id`
- INDEX: `(project_id, agent_id)`
- INDEX: `(project_id, layer)`

---

## BullMQ Configuration

```typescript
// Queue
const agentQueue = new Queue("agent-execution", { connection: redis });

// Producer — encola un layer
agentQueue.add("run-layer", {
  projectId: string,
  layer: number,
  retryCount: number  // 0, 1, 2
}, {
  attempts: 1,          // Retries manejados manualmente con backoff
  removeOnComplete: { age: 86400 },   // Limpiar completados después de 24h
  removeOnFail: { age: 604800 },      // Limpiar fallidos después de 7 días
  timeout: 600000       // 10 minutos timeout duro por layer
});

// Worker — proceso separado
const worker = new Worker("agent-execution", processLayer, {
  connection: redis,
  concurrency: 3,       // Máximo 3 proyectos simultáneos
  limiter: {
    max: 10,
    duration: 60000     // Max 10 jobs por minuto (rate limit Anthropic)
  }
});

// Pause check: antes de cada tool_call, el worker revisa Redis
// Key: project:pause:{projectId} → si existe, el agente hace graceful stop
```

---

## Skills de Agentes

Los prompts de cada agente viven en archivos separados:

```
skills/
├── dba-agent/
│   ├── system.md          → Rol: DBA experto en PostgreSQL
│   └── task.md            → Instrucciones para generar schema + migraciones
├── seed-agent/
│   ├── system.md          → Rol: Data engineer para seed data
│   └── task.md            → Instrucciones para seed, factories, constantes
├── backend-agent/
│   ├── system.md          → Rol: Backend developer Fastify/TypeScript
│   └── task.md            → Instrucciones para generar módulos
├── frontend-agent/
│   ├── system.md          → Rol: Frontend developer Next.js/TypeScript
│   └── task.md            → Instrucciones para generar pages + components
├── qa-agent/
│   ├── system.md          → Rol: QA engineer
│   └── task.md            → Instrucciones para generar tests
├── security-agent/
│   ├── system.md          → Rol: Security auditor OWASP
│   └── task.md            → Instrucciones para auditoría, rate limiting, headers
├── docs-agent/
│   ├── system.md          → Rol: Technical writer
│   └── task.md            → Instrucciones para generar docs
├── deploy-agent/
│   ├── system.md          → Rol: DevOps engineer
│   └── task.md            → Instrucciones para Dockerfile, docker-compose, CI/CD
└── integration-agent/
    ├── system.md          → Rol: Integration validator
    └── task.md            → Instrucciones para validación cross-layer
```

> Los prompts exactos se definen en los archivos de skills. Este spec define la estructura y el contrato, no el contenido.

---

## Cálculo de Progreso

```
Progreso total del proyecto = suma ponderada de capas (9 layers)

Layer 1   (Database):     12%  → progress 0-12
Layer 1.5 (Seed Data):     3%  → progress 12-15
Layer 2   (Backend):      25%  → progress 15-40
Layer 3   (Frontend):     22%  → progress 40-62
Layer 4   (Testing):      13%  → progress 62-75
Layer 4.5 (Security):      5%  → progress 75-80
Layer 5   (Docs):          8%  → progress 80-88
Layer 6   (Deployment):    5%  → progress 88-93
Layer 7   (Integration):   7%  → progress 93-100

Dentro de cada capa:
  progress_capa = (archivos_creados / archivos_estimados) * peso_capa

  Heurística de archivos_estimados por capa:
    DBA:         3 + (entidades_en_data_model × 1)   → schema, migration, seed base
    Seed:        1 + (entidades × 1)                  → seed.ts + factory por entidad
    Backend:     (endpoints_en_api_design × 0.8) + (módulos × 4)  → routes + controller + service + schema por módulo
    Frontend:    (páginas × 2) + (componentes_estimados)  → page + layout + components
    QA:          archivos_Layer2 × 0.5 + archivos_Layer3 × 0.3  → tests proporcionales
    Security:    3 + (endpoints × 0.1)                → OWASP report + rate-limit config + headers
    Docs:        3                                    → README + API.md + ARCHITECTURE.md
    Deploy:      4                                    → Dockerfile + docker-compose + CI + .env
    Integration: 1 + (contratos_cross_layer × 0.5)    → validation report + contract checks

  Se recalcula al inicio de cada capa con los archivos reales de capas anteriores.
```

---

## Páginas Frontend

> Las páginas del dashboard visual (canvas, nodos) se implementan en M5.
> M4 expone los endpoints y WebSocket que M5 consume.

---

## Archivos a Crear

### Backend (apps/api/)

```
src/agents/
├── base-agent.ts            → Clase base: loop de Tool Use, emit WS, checkpoint
├── orchestrator.ts          → Ejecuta capas secuencialmente, contexto entre capas
├── tool-executor.ts         → Ejecuta tools (createFile, readFile, listFiles)
├── tool-definitions.ts      → Schema de tools para Claude API
├── context-builder.ts       → Construye prompt con spec + archivos previos
├── dba-agent.ts             → Layer 1: schema, migraciones
├── seed-agent.ts            → Layer 1.5: seed data, factories
├── backend-agent.ts         → Layer 2: models, services, controllers
├── frontend-agent.ts        → Layer 3: pages, components, hooks
├── qa-agent.ts              → Layer 4: tests
├── security-agent.ts        → Layer 4.5: auditoría OWASP, rate limiting
├── docs-agent.ts            → Layer 5: README, API docs
├── deploy-agent.ts          → Layer 6: Dockerfile, docker-compose, CI/CD
└── integration-agent.ts     → Layer 7: validación cross-layer

src/queue/
├── agent-queue.ts           → BullMQ queue + producer
└── agent-worker.ts          → BullMQ worker (proceso separado)

src/websocket/
├── ws.routes.ts             → Ruta WS /ws/projects/:id con auth
├── ws.auth.ts               → Validación JWT en handshake
└── ws.emitter.ts            → Emisor tipado de eventos WS

src/modules/agents/
├── agent.routes.ts          → GET /agents, GET /logs, POST /retry
├── agent.controller.ts      → Handlers
├── agent.service.ts         → Lógica de negocio
└── agent.schema.ts          → Schemas Zod
```

### Worker entry point

```
src/worker.ts                → Entry point separado para BullMQ worker
                               Se despliega como proceso independiente
```

---

## NFRs Específicos de M4

- **Timeout por agente**: 5 minutos por defecto, extendible a 10 min en retry
- **Max archivos por agente**: 100 archivos
- **Max tamaño por archivo**: 100KB
- **WebSocket auth**: JWT validado en handshake, ownership verificado
- **WebSocket reconnect**: replay desde `lastEventId` usando `agent_logs.created_at`
- **BullMQ concurrency**: 3 proyectos simultáneos
- **BullMQ cleanup**: completados 24h, fallidos 7d
- **Rate limit Claude**: respeta headers `retry-after`, backoff exponencial 1s/2s/4s
- **Path traversal**: tools validan que rutas estén dentro de `{PROJECTS_BASE}/{projectId}/`
- **Checkpoint**: estado persistido después de cada archivo creado (resumible en crash)

---

## Fuera de Scope (M4)

- Paralelismo de agentes dentro de una capa (post-MVP, cuando el sistema sea estable)
- `maxAgents` del config del proyecto (sin efecto en MVP secuencial)
- MCP servers externos (GitHub integration para commits automáticos)
- Agentes que ejecutan comandos del sistema (`npm install`, `prisma migrate`, etc.)
- VS Code extension integration

---

## Definición de Done

- [ ] 9 agentes ejecutan su capa correctamente usando Tool Use
- [ ] Orquestador ejecuta 9 capas secuencialmente con contexto entre ellas
- [ ] Archivos se guardan en filesystem + metadata en BD
- [ ] Pause funciona con graceful stop (termina tool_call actual)
- [ ] Continue retoma sin repetir archivos ya creados
- [ ] Retry retoma desde la capa fallida
- [ ] Errores se capturan y reportan con reintentos automáticos (backoff)
- [ ] WebSocket emite todos los eventos con auth en handshake
- [ ] Reconexión WS con replay funciona
- [ ] BullMQ worker corre como proceso separado
- [ ] Checkpoints por archivo permiten resume después de crash
- [ ] Path traversal prevention verificado
- [ ] Tests del orchestrator, tool-executor, y cada agente
- [ ] No hay `any` en TypeScript
