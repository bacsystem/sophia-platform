# Research: M4 Agent Runner

## Decisiones Técnicas

### 1. BullMQ vs otras soluciones de queue

**Elegido: BullMQ**

| Opción | Pros | Contras |
|--------|------|---------|
| BullMQ | Mature, Redis-backed, TypeScript nativo, retry/backoff built-in | Requiere Redis (ya lo tenemos) |
| pg-boss | PostgreSQL-based, sin Redis extra | Menos features, más lento |
| node-cron | Simple | Sin persistencia, sin retries, no escala |

**Razón**: BullMQ usa Redis (ya requerido para rate limiting de M1/M2) — no añade infra nueva. Tiene concurrencia configurable, cleanup automático, y backoff exponencial nativo.

### 2. WebSocket vs SSE para eventos en tiempo real

**Elegido: WebSocket (`@fastify/websocket`)**

| Opción | Pros | Contras |
|--------|------|---------|
| WebSocket | Bidireccional, reconexión con replay, soporte nativo en todos los browsers | Más complejo que SSE |
| SSE (usado en M3) | Simple, HTTP, auto-reconnect nativo | Solo unidireccional, no soporta auth header en handshake |

**Razón**: M4 necesita autenticación JWT en el handshake (los browsers no pueden enviar headers custom en SSE). WebSocket permite auth via `?token=...` query param o header en handshake inicial. M3 usó SSE porque no requería auth — M4 sí.

**Nota**: `@fastify/websocket` es el plugin oficial de Fastify, compatible con la arquitectura existente.

### 3. Proceso separado para el Worker vs mismo proceso

**Elegido: Proceso separado (`src/worker.ts`)**

**Razón**: 
- Railway permite múltiples procesos (web + worker como servicios separados)
- El worker puede fallar sin afectar el API server
- Escalabilidad independiente (scale worker sin scale API)
- Patrón estándar con BullMQ

### 4. Claude Tool Use vs generación de texto plano

**Elegido: Tool Use**

**Razón**: Los agentes necesitan crear archivos atómicamente, no generar bloques de texto que el backend parsea. Tool Use garantiza estructura — el agente llama `createFile(path, content)` y el backend ejecuta la operación. Más seguro y predecible que parsear texto libre.

### 5. Checkpoints por archivo vs por capa

**Elegido: Checkpoint por archivo**

**Razón**: Si un agente falla a mitad de una capa (ej. backend-agent creó 15/20 archivos), el checkpoint por archivo permite saber exactamente hasta dónde llegó. Al reintentar, puede continuar desde donde paró leyendo `generated_files` de esa capa. Checkpoint por capa perdería todo el trabajo de la capa fallida.

### 6. AES-256-GCM para encryption de API keys

**Razón**: GCM (Galois/Counter Mode) provee tanto cifrado como autenticación (AEAD). Sin GCM, un atacante podría modificar el ciphertext sin detección. La `ENCRYPTION_KEY` de 64 hex chars = 32 bytes = 256 bits, correcto para AES-256.

### 7. Path traversal prevention en tool-executor

**Estrategia**: `path.resolve(baseDir, userPath)` y verificar que el resultado empieza con `baseDir`. Si no, rechazar con error. No usar `path.join` solo — no previene `../../../etc/passwd`.

### 8. Contexto entre capas — tamaño del prompt

**Problema**: El contexto acumulado de 9 capas puede exceder el context window de Claude.

**Solución**: 
- Capas anteriores → solo lista de rutas de archivos + resumen de 1-2 líneas por archivo
- Solo se incluye el contenido completo de archivos "críticos" para el agente actual (según mapping en `context-builder.ts`)
- El spec completo siempre se incluye (está en la BD, tamaño conocido)

### 9. Rate limit handling para Claude API

**Estrategia**: Backoff exponencial: 1s → 2s → 4s (máx 3 intentos). Si el header `retry-after` está presente, usar ese valor. Después de 3 intentos, marcar el agente como error.

### 10. Security audit logging

**Patrón**: `agent_logs` con tipos `info|ok|warn|error`. Los logs de seguridad (security-agent) usan tipo `warn` o `error` para vulnerabilidades OWASP encontradas. Paginados en GET /logs.
