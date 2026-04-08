# Research — M3: Spec Engine

**Branch**: `003-m3-spec-engine` | **Date**: 2026-04-08

---

## Decisiones Técnicas Investigadas

### 1. Streaming IA: SSE vs WebSocket vs Long-polling

| Opción | Unidireccional | Reconexión automática | Complejidad | Elegida |
|--------|---------------|----------------------|-------------|---------|
| Server-Sent Events (SSE) | ✅ (servidor → cliente) | ✅ nativa en browser | Baja | ✅ |
| WebSocket | ❌ (bidireccional, overhead) | ❌ manual | Alta | — |
| Long-polling | ❌ (ineficiente) | ❌ | Media | — |

**Decisión**: SSE vía `GET /api/projects/:id/spec/stream?jobId=xxx`. El frontend usa `EventSource` API nativa. Se implementó un buffer de eventos en memoria para replay al reconectar (C2). Headers `Cache-Control: no-cache` + `Connection: keep-alive` obligatorios.

### 2. Generación IA: Una llamada vs. Tres llamadas secuenciales

| Opción | Calidad output | Contexto acumulativo | Timeout riesgo |
|--------|---------------|---------------------|----------------|
| 1 llamada (3 docs en 1 prompt) | Menor (contexto mezclado) | N/A | Alto (1 timeout = todo falla) |
| 3 llamadas secuenciales | ✅ Mayor (prompt específico por doc) | ✅ (doc N recibe N-1 como contexto) | Medio (timeout por doc) |
| 3 llamadas en paralelo | Media | ❌ Sin contexto cruzado | Bajo |

**Decisión**: 3 llamadas secuenciales. `data-model.md` recibe `spec.md` como contexto; `api-design.md` recibe ambos. Permite prompts especializados (`skills/spec-agent/*.md`) y retry granular por documento.

### 3. Editor Markdown: @uiw/react-md-editor vs. SimpleMDE vs. CodeMirror

| Librería | SSR compatible | Preview live | Tamaño bundle | Mantenimiento |
|----------|---------------|-------------|---------------|---------------|
| @uiw/react-md-editor | ❌ (require ssr: false) | ✅ | ~180KB | ✅ Activo |
| SimpleMDE / EasyMDE | ✅ | ✅ | ~100KB | ⚠️ Lento |
| CodeMirror + remark | ✅ | Manual | ~250KB+ | ✅ Activo |

**Decisión**: `@uiw/react-md-editor`. Preview live nativo, API simple. Requiere `dynamic(() => import(...), { ssr: false })` en Next.js — documentado en CLAUDE.md. `MDEditor.Markdown` se usa también para el viewer de solo lectura.

### 4. Almacenamiento de Contenido: JSONB vs. Texto plano vs. Archivos S3

| Opción | Consultas | Versionamiento | Complejidad |
|--------|-----------|---------------|-------------|
| JSONB en `project_specs.content` | ✅ indexable por campo | ✅ version INT autoincremental | Baja | ✅ |
| Texto plano concatenado | ❌ difícil de separar docs | ✅ | Baja | — |
| Archivos en S3/filesystem | ❌ requiere storage externo | ✅ | Alta | — |

**Decisión**: JSONB con shape `{ spec: string, dataModel: string, apiDesign: string }`. La tabla `project_specs` ya estaba definida en M2 con `content Json`. Cada edit o generación crea una nueva fila con `version` incremental — no se sobreescriben registros.

### 5. Rate Limiting: Por proyecto vs. Por usuario

**Decisión**: Doble rate limit con Redis TTL counters:
- `spec:gen:{projectId}` → 10 generaciones/hora por proyecto (`EXPIRE 3600`)
- `spec:gen:user:{userId}` → 50 generaciones/día por usuario (`EXPIRE 86400`)

Reutiliza `checkRateLimit` de `apps/api/src/lib/redis.ts` (patrón establecido en M1).

### 6. Validación del Output de IA: Schema fijo vs. Secciones requeridas

| Opción | Robustez | Flexibilidad |
|--------|----------|-------------|
| JSON Schema estricto | Alta | Baja (Claude a veces omite campos) |
| Regex de secciones H2 obligatorias | ✅ Media-alta | ✅ Alta |
| Sin validación | — | Alta |

**Decisión**: Regex de secciones obligatorias en `spec.validator.ts`. Cada documento tiene un conjunto de headings H2 (`##`) que deben estar presentes. Si faltan → `valid: false`, el spec se guarda pero marcado como incompleto (C1). El usuario ve un badge de advertencia en el viewer.

### 7. Jobs de Generación: BullMQ vs. In-memory Map

| Opción | Persistencia | Complejidad | Adecuado para MVP |
|--------|-------------|-------------|-------------------|
| BullMQ (M4 usa BullMQ) | ✅ | Alta | No (M4 lo implementa) |
| In-memory Map (jobId → SpecJob) | ❌ (se pierde en restart) | Baja | ✅ |

**Decisión**: In-memory Map para MVP. `Map<string, SpecJob>` donde `SpecJob = { status, events[], listeners: Set<fn> }`. Fan-out a múltiples tabs vía `listeners`. Buffer de eventos para replay en reconexión (C2). M4 migrará a BullMQ cuando se implemente el orquestador de agentes.

---

## Trade-offs Aceptados

- **SSE sin autenticación a nivel de header**: EventSource API del browser no permite headers; la autorización se hace chequeando la cookie en el handler SSE (`authenticate` hook de Fastify).
- **In-memory jobs no persisten**: Un restart del servidor pierde jobs activos. Aceptable en MVP porque las generaciones duran <5 min y el usuario puede reintentar.
- **`ssr: false` en MDEditor**: Genera un breve flash de carga. Aceptable a cambio de simplicidad (no montar un parser markdown custom).

---

## Referencias

- [Anthropic Streaming Docs](https://docs.anthropic.com/en/api/messages-streaming)
- [MDN EventSource API](https://developer.mozilla.org/en-US/docs/Web/API/EventSource)
- [@uiw/react-md-editor](https://github.com/uiwjs/react-md-editor)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
