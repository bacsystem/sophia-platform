# SPEC — M9: Agent System Improvements

# Sophia Platform

# Versión: 1.0.0 | Sprint: 5–6

---

## Descripción

Cuatro mejoras estructurales al sistema de agentes IA de Sophia Platform: skills compartidas entre agentes, memoria persistente entre sesiones, ejecución paralela de capas independientes, y certificación automática de criterios de aceptación. Estas mejoras reducen inconsistencias, eliminan pérdida de contexto, aceleran la generación y garantizan trazabilidad requisito→código→test.

---

## Stack

- Backend: Node.js 22 + Fastify + BullMQ + Anthropic SDK (tool use)
- DB: PostgreSQL 16 (tablas nuevas: `agent_messages`, `certification_results`)
- Redis 7 (parallel layer coordination)
- Filesystem: `skills/_shared/`, `projects/{id}/memory/`

---

## Dependencias

- **M4**: Agent Runner — orquestador, base-agent, tool-executor, context-builder (código base a modificar)
- **M3**: Spec Engine — spec.validator.ts, project_specs (criterios de aceptación a parsear)
- **M5**: Dashboard — WebSocket events (adaptar para capas paralelas)

---

## Requerimientos Funcionales

- **RF-01**: El orquestador debe componer prompts con skills compartidas + skills específicas del agente
- **RF-02**: El historial de conversación Claude (MessageParam[]) debe persistirse en BD turno a turno
- **RF-03**: Cada proyecto debe acumular un archivo `project_memory.md` con decisiones y patrones
- **RF-04**: Las capas QA+Security y Docs+Deploy deben ejecutarse en paralelo
- **RF-05**: Los criterios de aceptación de spec.md deben extraerse a estructura JSON
- **RF-06**: El QA-agent debe generar un mapeo explícito criterio→test en su output
- **RF-07**: Un quality gate debe bloquear el pipeline si la cobertura de criterios es < 80%
- **RF-08**: Se debe generar un certification report con matriz de trazabilidad HU→test→resultado
- **RF-09**: El worker debe apagarse limpiamente al recibir SIGTERM/SIGINT, dejando al agente activo en estado `paused`
- **RF-10**: Cada llamada individual a Claude API debe tener timeout propio de 2 min (configurable)
- **RF-11**: El cliente Anthropic debe soportar requests concurrentes sin race conditions para operación paralela
- **RF-12**: El sistema debe monitorear memoria heap por agente y truncar mensajes antiguos si excede umbral

## Requerimientos No Funcionales

- **RNF-01**: El paralelismo no debe aumentar el consumo de tokens más de un 5%
- **RNF-02**: La composición de skills compartidas debe agregar < 50ms al tiempo de carga de prompts
- **RNF-03**: La persistencia de mensajes debe agregar < 100ms de latencia por turno de Tool Use
- **RNF-04**: El certification report debe generarse en < 5s por proyecto
- **RNF-05**: El graceful shutdown debe completar en ≤ 30 segundos tras recibir señal
- **RNF-06**: El monitoreo de memoria debe agregar < 0.5ms de overhead por turno

---

## MEJORA 1: Paralelismo de Agentes

### Problema actual

El orquestador (`apps/api/src/agents/orchestrator.ts`) ejecuta las 9 capas en un loop `for...of` + `await runAgent()` — **100% secuencial**. Sin embargo, el análisis del grafo de dependencias revela que hay pares de capas sin dependencia mutua que podrían ejecutarse simultáneamente:

```
Layer 1   (DBA)         → generador independiente
Layer 1.5 (Seed)        → depende de schema.prisma (Layer 1) ← SECUENCIAL
Layer 2   (Backend)     → depende de Layer 1 + 1.5
Layer 3   (Frontend)    → depende de Layer 2
Layer 4   (QA)          → depende de Layer 2 + 3 ← SIN dependencia con L4.5
Layer 4.5 (Security)    → depende de Layer 2 + 3 ← SIN dependencia con L4
Layer 5   (Docs)        → depende de L1–L4.5     ← SIN dependencia con L6
Layer 6   (Deploy)      → depende de L1–L4.5     ← SIN dependencia con L5
Layer 7   (Integration) → depende de TODO
```

**Evidencia**: `orchestrator.ts` líneas ~170 — `for (const layerDef of LAYERS) { await runAgent(...) }`.

**Impacto**: Un pipeline de 9 pasos secuenciales toma ~45 minutos (5 min/agente promedio). Dos pares paralelos reducirían a 7 pasos efectivos (~35 min, -22%).

> **Nota**: DBA + Seed NO pueden correr en paralelo. Seed-agent depende explícitamente de `schema.prisma` generado por DBA-agent. El `context-builder.ts` inyecta archivos de `layer < currentLayer`.

### Solución propuesta

Reemplazar el array lineal `LAYERS[]` con un grafo de dependencias tipado. Cada nodo declara sus dependencias explícitas. El ejecutor resuelve el grafo y lanza `Promise.all()` para nodos cuyas dependencias ya se cumplieron.

```
Grafo optimizado:

L1 (DBA) → L1.5 (Seed) → L2 (Backend) → L3 (Frontend) → ┬─ L4 (QA)        ─┬→ ┬─ L5 (Docs)   ─┬→ L7 (Integration)
                                                           └─ L4.5 (Security) ─┘  └─ L6 (Deploy) ─┘
```

Pipeline: 9 pasos secuenciales → 7 pasos efectivos.

### Historias de Usuario

#### HU-29: Grafo de dependencias entre agentes

**Como** desarrollador de Sophia
**Quiero** que las dependencias entre capas estén declaradas como un grafo tipado
**Para** que el orquestador pueda resolver automáticamente qué capas pueden ejecutarse en paralelo

**Criterios de aceptación:**

- [ ] Existe un archivo `apps/api/src/agents/dependency-graph.ts` con la definición del grafo
- [ ] Cada nodo declara: `type`, `layer`, `dependsOn: layer[]`
- [ ] El grafo resuelve correctamente: L4 y L4.5 como paralelos cuando L3 está completa
- [ ] El grafo resuelve correctamente: L5 y L6 como paralelos cuando L4 y L4.5 están completas
- [ ] Existe función `getNextLayers(completedLayers: Set<number>): LayerDef[]` que retorna las capas listas
- [ ] Tests unitarios cubren: resolución secuencial, resolución paralela, detección de ciclos

#### HU-30: Ejecución paralela de capas independientes

**Como** usuario de Sophia
**Quiero** que QA+Security y Docs+Deploy se ejecuten simultáneamente
**Para** reducir el tiempo total de generación de mi proyecto

**Criterios de aceptación:**

- [ ] El orquestador usa `Promise.all()` para ejecutar capas paralelas (L4||L4.5 y L5||L6)
- [ ] `context-builder.ts` usa `layer <= maxCompletedParallelLayer` en vez de `layer < currentLayer`
- [ ] Si una capa paralela falla, la otra se cancela gracefully (no queda zombie)
- [ ] `projects.progress` se actualiza correctamente con capas paralelas (cada capa contribuye su peso proporcional)
- [ ] El pipeline completo se reduce de 9 pasos a 7 pasos efectivos

#### HU-31: WebSocket y tracking para capas paralelas

**Como** usuario de Sophia
**Quiero** ver el progreso de capas paralelas simultáneamente en el dashboard
**Para** entender qué agentes están trabajando al mismo tiempo

**Criterios de aceptación:**

- [ ] WebSocket emite `agent:status` para ambas capas paralelas con `status: working` simultáneo
- [ ] El dashboard (M5) muestra múltiples agentes activos (estado `working`) al mismo tiempo
- [ ] Los logs de agentes paralelos tienen timestamps correctos para ordering
- [ ] La pausa (`project:pause`) detiene ambas capas paralelas gracefully
- [ ] El retry desde error reinicia solo la capa que falló (no su par paralelo si ya completó)

### Métricas de éxito

- **Antes**: Pipeline 9 pasos secuenciales, ~45 min por proyecto
- **Después**: Pipeline 7 pasos efectivos, ~35 min por proyecto (-22% tiempo)

### Archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `apps/api/src/agents/dependency-graph.ts` | CREAR | Grafo tipado de dependencias entre capas con resolver |
| `apps/api/src/agents/orchestrator.ts` | MODIFICAR | Reemplazar `for...of` lineal por resolución de grafo + `Promise.all` |
| `apps/api/src/agents/context-builder.ts` | MODIFICAR | Ajustar query de `layer < current` a `layer <= maxCompleted` para pares |
| `apps/api/src/websocket/ws.emitter.ts` | MODIFICAR | Soportar múltiples `agent:status working` simultáneos |
| `apps/api/src/agents/__tests__/dependency-graph.test.ts` | CREAR | Tests unitarios del grafo |
| `apps/api/src/agents/__tests__/orchestrator.test.ts` | MODIFICAR | Tests de ejecución paralela |

### Dependencias

- M4 completado (orquestador funcional)
- Mejora 2 (Skills compartidas) aplicada — para que ambos agentes paralelos lean el mismo formato compartido

### Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Race condition en `generated_files` (dos agentes escriben en paralelo) | Media | Upsert con `ON CONFLICT` + paths únicos por layer — capas paralelas generan archivos en directorios distintos |
| Rate limit Anthropic con 2 llamadas simultáneas | Media | Worker `CONCURRENCY=3` ya existe; 2 agentes paralelos caben dentro del límite. Monitorear `429` responses |
| Agente paralelo zombie si el otro falla | Baja | AbortController por par paralelo; si uno falla, abort signal al otro |

### Estimación

- **Complejidad**: Media
- **Sprint sugerido**: 6

---

## MEJORA 2: Skills Compartidas

### Problema actual

Los 9 agentes tienen `system.md` + `task.md` propios sin contexto compartido. Se identifican las siguientes duplicaciones e inconsistencias:

**Duplicaciones** (aparecen en los 9 `system.md`):
- Instrucciones de Tool Use: "NO ejecutes comandos", "Usa SOLO createFile/readFile/listFiles/taskComplete"
- Naming conventions: PascalCase, camelCase, snake_case según contexto
- Formato de `taskComplete`: summary + filesCreated

**Inconsistencias detectadas**:
- Security-agent reporta severidades como `CRITICAL/HIGH/MEDIUM/LOW`; integration-agent usa `BROKEN/MISMATCH/MISSING/OK`
- Seed-agent genera `factories.ts` y `test-constants.ts`, pero qa-agent no referencia estos artefactos
- Integration-agent `task.md` no explicita qué archivos DEBE leer de cada capa previa
- Backend-agent define response format `{ data: result }`, pero esta convención no está centralizada

**Evidencia**: `skills/` contiene 10 directorios, 18+ archivos, sin directorio `_shared/`. El orquestador carga skills vía `readSkillFile('dba-agent/system.md')` sin composición.

### Solución propuesta

Crear `skills/_shared/` con 3 documentos de contexto compartido. Modificar el orquestador para componer el system prompt como: `_shared/conventions.md` + `_shared/anti-patterns.md` + `_shared/output-format.md` + `{agent}/system.md`. Refactorizar los 9 `system.md` para eliminar duplicaciones.

### Historias de Usuario

#### HU-32: Crear skills compartidas

**Como** maintainer de Sophia
**Quiero** convenciones centralizadas que todos los agentes hereden
**Para** eliminar duplicaciones y garantizar consistencia entre capas

**Criterios de aceptación:**

- [ ] Existe `skills/_shared/conventions.md` con naming (PascalCase, camelCase, snake_case), file paths, response formats
- [ ] Existe `skills/_shared/anti-patterns.md` con prohibiciones categorizadas por dominio (backend, frontend, security, DB)
- [ ] Existe `skills/_shared/output-format.md` con formato estándar de `taskComplete`, severity levels unificados, y estructura de reportes
- [ ] Los 3 archivos suman < 3000 tokens (para no saturar context window)
- [ ] Cada archivo tiene header `# Shared Skill: [nombre]` y secciones claras con bullets

#### HU-33: Composición de prompts con skills compartidas

**Como** desarrollador de Sophia
**Quiero** que el orquestador componga automáticamente shared + agent-specific skills
**Para** que cada agente reciba convenciones unificadas sin duplicar contenido

**Criterios de aceptación:**

- [ ] `orchestrator.ts` carga `_shared/*.md` una sola vez al inicio de `runPipeline()` (no por cada layer)
- [ ] El system prompt se compone como: `[shared conventions] + [shared anti-patterns] + [shared output-format] + [agent system.md]`
- [ ] Función `composeSystemPrompt(sharedSkills: string[], agentSystemMd: string): string` está testeada
- [ ] Los 9 `system.md` se refactorizan para eliminar contenido que ahora vive en `_shared/`
- [ ] Cada `system.md` reduce su tamaño en ≥ 30% tras la refactorización

#### HU-34: Estandarización de reportes entre agentes

**Como** usuario de Sophia
**Quiero** que todos los reportes de auditoría usen el mismo formato de severidad
**Para** poder comparar y priorizar hallazgos sin ambigüedad

**Criterios de aceptación:**

- [ ] `output-format.md` define severidades unificadas: `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, `INFO`
- [ ] Security-agent adopta el enum unificado (elimina duplicado en su `system.md`)
- [ ] Integration-agent mapea `BROKEN→CRITICAL`, `MISMATCH→HIGH`, `MISSING→MEDIUM`, `OK→INFO`
- [ ] Ambos reportes usan formato tabular idéntico: `| # | Severidad | Componente | Hallazgo | Remediación |`
- [ ] QA-agent adopta el mismo formato para reportar test failures

#### HU-35: Referencias cruzadas entre agentes

**Como** agente de Sophia (QA, Security, Integration)
**Quiero** saber exactamente qué artefactos generaron las capas anteriores
**Para** no asumir rutas o nombres de archivo incorrectos

**Criterios de aceptación:**

- [ ] `conventions.md` incluye sección "Artefactos por Capa" listando outputs esperados de cada layer
- [ ] QA-agent `task.md` referencia `factories.ts` y `test-constants.ts` de seed-agent
- [ ] Integration-agent `task.md` tiene lista explícita de archivos a validar por capa (no genérico "leer TODO")
- [ ] Docs-agent `task.md` referencia el certification report (Mejora 4) como input
- [ ] Cada referencia cruzada usa rutas relativas consistentes

### Métricas de éxito

- **Antes**: 9 duplicaciones de Tool Use instructions, 3 inconsistencias de formato, 0 archivos shared
- **Después**: 0 duplicaciones, 0 inconsistencias, 3 archivos en `_shared/`, `system.md` -30% tamaño cada uno

### Archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `skills/_shared/conventions.md` | CREAR | Naming, file paths, response formats, artefactos por capa |
| `skills/_shared/anti-patterns.md` | CREAR | Prohibiciones por dominio (backend, frontend, security, DB) |
| `skills/_shared/output-format.md` | CREAR | Formato taskComplete, severidades unificadas, estructura reportes |
| `skills/dba-agent/system.md` | MODIFICAR | Eliminar Tool Use instructions y naming duplicados |
| `skills/seed-agent/system.md` | MODIFICAR | Eliminar Tool Use instructions y naming duplicados |
| `skills/backend-agent/system.md` | MODIFICAR | Eliminar Tool Use instructions, response format duplicado |
| `skills/frontend-agent/system.md` | MODIFICAR | Eliminar Tool Use instructions y naming duplicados |
| `skills/qa-agent/system.md` | MODIFICAR | Eliminar Tool Use instructions, agregar referencia a seed artifacts |
| `skills/qa-agent/task.md` | MODIFICAR | Referenciar factories.ts y test-constants.ts |
| `skills/security-agent/system.md` | MODIFICAR | Adoptar severity enum unificado |
| `skills/docs-agent/system.md` | MODIFICAR | Eliminar duplicados |
| `skills/deploy-agent/system.md` | MODIFICAR | Eliminar duplicados |
| `skills/integration-agent/system.md` | MODIFICAR | Adoptar severity enum unificado |
| `skills/integration-agent/task.md` | MODIFICAR | Lista explícita de archivos a validar por capa |
| `apps/api/src/agents/orchestrator.ts` | MODIFICAR | Componer shared + agent-specific skills |

### Dependencias

- Ninguna — esta mejora es fundacional y no depende de las otras

### Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Shared skills saturan context window de Claude | Media | Límite hard de 3000 tokens para `_shared/`; monitorear `tokensInput` |
| Refactorizar 9 system.md introduce regresiones en agentes | Media | Ejecutar pipeline completo de test en un proyecto canario antes de merge |
| Agentes pierden instrucciones específicas al extraer a shared | Baja | Diff line-by-line de cada system.md antes/después; validar que nada se pierde |

### Estimación

- **Complejidad**: Baja
- **Sprint sugerido**: 5

---

## MEJORA 3: Memoria entre Sesiones

### Problema actual

El historial de conversación Claude (`MessageParam[]` en `base-agent.ts`) es **volátil** — vive en memoria del proceso worker. Si el servidor crashea mid-layer, se pierde el contexto completo de la conversación del agente activo.

Además, `context-builder.ts` tiene límites duros:
- `MAX_CONTEXT_FILES = 20` — si un proyecto genera >20 archivos en capas previas, las layers posteriores pierden contexto
- `MAX_FILE_CHARS = 80000` (~80KB) — archivos grandes se truncan

No existe un mecanismo de **memoria acumulativa** entre capas. Cada agente recibe los archivos de capas anteriores como contexto crudo, pero no hay un resumen de decisiones, patrones elegidos, o constraints descubiertos durante la generación.

**Evidencia**:
- `base-agent.ts`: `const messages: MessageParam[] = [...]` — array en memoria, no persistido
- `context-builder.ts` línea ~55: `const MAX_CONTEXT_FILES = 20`
- Tabla `agent_logs` guarda logs de texto libre, no mensajes Claude
- No existe `project_memory.md` ni nada similar

### Solución propuesta

1. **Persistir mensajes Claude**: Nueva tabla `agent_messages` para guardar cada turno de la conversación (role, content, tool_use blocks) — permite replay exacto en caso de crash.
2. **Project Memory**: Cada agente al completar genera un resumen estructurado que se acumula en `projects/{id}/memory/project_memory.md`. Este archivo se inyecta en el contexto de capas siguientes.
3. **Checkpoint granular**: Persistir metadata de archivos por cada `createFile` (no solo al fin del agente).
4. **Context window inteligente**: Reemplazar el límite hard de 20 archivos con un sistema de priorización que selecciona los archivos más relevantes para cada capa.

### Historias de Usuario

#### HU-36: Persistencia de conversación Claude

**Como** desarrollador de Sophia
**Quiero** que cada turno de la conversación agente-Claude se persista en BD
**Para** poder retomar la conversación exacta si el worker crashea mid-execution

**Criterios de aceptación:**

- [ ] Existe tabla `agent_messages` con campos: `id`, `agent_id`, `project_id`, `turn_number`, `role` (user|assistant), `content` (JSONB), `tokens`, `created_at`
- [ ] `base-agent.ts` persiste cada `MessageParam` después de recibir respuesta de Claude (no en batch al final)
- [ ] Al retomar un agente después de crash, se reconstruye `MessageParam[]` desde `agent_messages`
- [ ] Los tool_use blocks y tool_results se serializan correctamente en JSONB
- [ ] La persistencia agrega < 100ms de latencia por turno (medido con tests de performance)
- [ ] Al completar un agente, los mensajes se marcan como `completed` (no se borran, para auditoría)

#### HU-37: Memoria acumulativa de proyecto

**Como** agente de Sophia (cualquier capa)
**Quiero** recibir un resumen de decisiones y patrones de capas anteriores
**Para** generar código consistente con lo que ya se decidió

**Criterios de aceptación:**

- [ ] Cada agente al completar (`taskComplete`) genera una sección de memoria con: decisiones tomadas, patrones usados, constraints descubiertos
- [ ] El orquestador acumula estas secciones en `projects/{id}/memory/project_memory.md`
- [ ] `context-builder.ts` inyecta `project_memory.md` en el prompt de cada agente (después del spec, antes de los archivos)
- [ ] El formato de memoria es estructurado: `## Layer N: [nombre]\n### Decisiones\n- ...\n### Patrones\n- ...\n### Constraints\n- ...`
- [ ] `project_memory.md` no excede 5000 tokens (se resumen las entradas más antiguas si es necesario)

#### HU-38: Checkpoint granular por archivo

**Como** sistema (orquestador)
**Quiero** registrar metadata en BD inmediatamente después de cada `createFile`
**Para** que el contexto esté disponible incluso si el agente falla antes de completar

**Criterios de aceptación:**

- [ ] `tool-executor.ts` ejecuta un `prisma.generatedFile.upsert()` inmediatamente después de cada `createFile` exitoso
- [ ] El `generated_files` tiene timestamp preciso de creación (no solo al fin del agente)
- [ ] `context-builder.ts` puede reconstruir contexto desde `generated_files` para retry mid-layer
- [ ] No hay duplicados en `generated_files` si el agente escribe el mismo path dos veces (upsert por `projectId + path`)

#### HU-39: Context window inteligente

**Como** agente de Sophia (capas 5-7)
**Quiero** recibir los archivos más relevantes para mi tarea en vez de un corte arbitrario de 20
**Para** generar output de mayor calidad con contexto preciso

**Criterios de aceptación:**

- [ ] `context-builder.ts` implementa priorización: archivos referenciados en `task.md` del agente > archivos de la capa inmediata anterior > archivos más grandes > resto
- [ ] El límite se calcula por tokens disponibles (no por cantidad de archivos): budget de 40K tokens para contexto de archivos
- [ ] Archivos muy grandes (>10KB) se incluyen con resumen (primeras 50 líneas + últimas 20 líneas) en vez de completos
- [ ] El `project_memory.md` tiene prioridad máxima (siempre se incluye)
- [ ] Integration-agent (L7) recibe al menos un resumen de cada capa (no omite capas)

### Métricas de éxito

- **Antes**: Contexto recuperable post-crash = 0% (MessageParam[] volátil). Archivos visibles por layer = máx 20 (hard limit). Historial de decisiones = ninguno.
- **Después**: Contexto recuperable = 100% (replay desde BD). Archivos visibles = dinámico por tokens (~50+). Historial = `project_memory.md` acumulativo.

### Archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `apps/api/prisma/schema.prisma` | MODIFICAR | Agregar modelo `AgentMessage` (turno por turno) |
| `apps/api/src/agents/base-agent.ts` | MODIFICAR | Persistir MessageParam[] turno a turno + reconstruir desde BD en retry |
| `apps/api/src/agents/context-builder.ts` | MODIFICAR | Inyectar project_memory.md, priorización inteligente, budget por tokens |
| `apps/api/src/agents/orchestrator.ts` | MODIFICAR | Generar/acumular project_memory.md tras cada layer completado |
| `apps/api/src/agents/tool-executor.ts` | MODIFICAR | Upsert generatedFile por cada createFile (checkpoint granular) |
| `apps/api/src/agents/__tests__/context-builder.test.ts` | CREAR | Tests de priorización y budget de tokens |
| `apps/api/src/agents/__tests__/base-agent.test.ts` | MODIFICAR | Tests de persistencia y reconstrucción de mensajes |

### Dependencias

- M4 completado (base-agent, tool-executor, context-builder existentes)
- Mejora 2 (Skills compartidas) — para que `project_memory.md` use el formato estándar de output-format.md

### Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Persistencia por turno introduce latencia perceptible | Media | Insert asíncrono sin await (fire-and-forget con retry en background). Medir P99 latency |
| `agent_messages` crece rápido (50 turnos × 9 agentes × N proyectos) | Alta | TTL de 30 días + tabla particionada por `created_at`. Cleanup job en BullMQ |
| `project_memory.md` genera alucinación si el resumen es impreciso | Baja | Template estructurado con fields obligatorios; validar que el agente no invente |
| Context window inteligente es difícil de testear | Media | Golden tests con proyectos de referencia: verificar que archivos correctos se seleccionan |

### Estimación

- **Complejidad**: Alta
- **Sprint sugerido**: 5

---

## MEJORA 4: Certificación de HUs

### Problema actual

No existe verificación automática de que el código generado cumple los criterios de aceptación definidos en `spec.md`. Actualmente:

1. `spec.validator.ts` valida **estructura** del spec (tiene RF/RNF/HU/checkboxes), pero **NO contenido** individual
2. QA-agent genera tests mapeados a criterios, pero el mapeo es **implícito** (texto en describe/it), no trazable
3. Integration-agent genera un reporte, pero es **informativo** — no bloquea el pipeline si hay fallos
4. No existe matriz de trazabilidad: `HU-01.criterio-3 → test-file:L45 → PASS/FAIL`

**Evidencia**:
- `spec.validator.ts`: `if (checkboxes.length < 1)` — solo valida que exista ≥1 checkbox
- QA-agent `task.md`: "Cada criterio de aceptación = al menos 1 test case" — regla en texto, sin enforcement
- No existe ningún archivo `certification.md`, `traceability.md` o similar en el repo

### Solución propuesta

1. **Criteria Extractor**: Parser que extraiga checkboxes de `spec.md` a estructura JSON con IDs únicos (`HU-XX.CA-YY`).
2. **QA-agent output mapping**: El QA-agent debe generar un archivo `test-mapping.json` que conecta cada criterio con el test que lo valida.
3. **Quality Gate**: Post QA+Security, el orquestador verifica que ≥80% de criterios tienen test asociado. Si no, re-ejecuta QA con los criterios faltantes.
4. **Certification Report**: Integration-agent genera `docs/certification.md` con matriz completa HU→criterio→test→status.

### Historias de Usuario

#### HU-40: Extractor de criterios de aceptación

**Como** sistema (orquestador)
**Quiero** parsear los criterios de aceptación de spec.md a un formato estructurado
**Para** poder rastrear cada criterio individualmente a lo largo del pipeline

**Criterios de aceptación:**

- [ ] Existe `apps/api/src/agents/criteria-extractor.ts` con función `extractCriteria(specContent: string): CriteriaMap`
- [ ] `CriteriaMap` es `{ huId: string, huName: string, criteria: { id: string, text: string, covered: boolean }[] }[]`
- [ ] Parsea correctamente el patrón markdown: `### HU-XX — Nombre\n...\n- [ ] criterio`
- [ ] Asigna IDs únicos: `HU-14.CA-01`, `HU-14.CA-02`, etc.
- [ ] Maneja HUs sin criterios (warning, no error)
- [ ] Tests unitarios con specs reales del repo (M1, M2, M4) como fixtures

#### HU-41: Mapeo criterio → test por QA-agent

**Como** QA-agent
**Quiero** generar un mapeo explícito de cada criterio al test que lo valida
**Para** que el sistema pueda verificar cobertura de criterios automáticamente

**Criterios de aceptación:**

- [ ] QA-agent genera `test-mapping.json` como último archivo antes de `taskComplete`
- [ ] Formato: `{ "mappings": [{ "criteriaId": "HU-14.CA-01", "testFile": "auth.service.test.ts", "testName": "should register user", "type": "unit|integration" }] }`
- [ ] Cada criterio de spec.md aparece en el mapping (con `testFile: null` si no hay test)
- [ ] `task.md` del qa-agent se actualiza con instrucciones explícitas para generar este archivo
- [ ] El orquestador lee `test-mapping.json` después de completar L4 (QA)

#### HU-42: Quality gate de cobertura de criterios

**Como** usuario de Sophia
**Quiero** que el pipeline se detenga si los criterios de aceptación no están cubiertos por tests
**Para** garantizar que el código generado cumple los requisitos del spec

**Criterios de aceptación:**

- [ ] Después de Layer 4 (QA), el orquestador ejecuta `verifyCriteriaCoverage(criteriaMap, testMapping)`
- [ ] Si cobertura < 80% → el orquestador re-ejecuta QA-agent con prompt adicional: "Criterios sin cobertura: [lista]"
- [ ] Máximo 2 re-ejecuciones de QA — si después de 2 intentos sigue < 80%, continúa con warning en logs
- [ ] El umbral (80%) es configurable vía variable de entorno `CRITERIA_COVERAGE_THRESHOLD`
- [ ] El resultado del quality gate se emite por WebSocket: `{ event: "quality:gate", data: { coverage: 85, threshold: 80, passed: true } }`
- [ ] Los re-runs de QA no regeneran tests ya existentes — solo agregan los faltantes

#### HU-43: Certification report con trazabilidad

**Como** usuario de Sophia
**Quiero** un reporte de certificación que muestre qué criterios se cumplen y cuáles no
**Para** tener confianza medible en el código generado

**Criterios de aceptación:**

- [ ] Integration-agent genera `docs/certification.md` como parte de su output (Layer 7)
- [ ] El reporte incluye matriz: `| HU | Criterio | Test | Archivo Test | Status |`
- [ ] Status posibles: `✅ COVERED` (test existe), `⚠️ PARTIAL` (test existe pero no cubre todo), `❌ MISSING` (sin test)
- [ ] Resumen al inicio: `Cobertura total: X/Y criterios (Z%)`
- [ ] El reporte se registra en `generated_files` y se muestra como archivo descargable en File Manager (M6)
- [ ] Tests verifican que el reporte se genera correctamente con datos de fixture

### Métricas de éxito

- **Antes**: Trazabilidad criterio→test = 0% (mapeo implícito). Quality gate = inexistente. Certification report = no existe.
- **Después**: Trazabilidad = 100% (mapeo explícito en JSON). Quality gate = activo (≥80% cobertura). Certification report = generado automáticamente con matriz.

### Archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `apps/api/src/agents/criteria-extractor.ts` | CREAR | Parser de checkboxes de spec.md a CriteriaMap JSON |
| `apps/api/src/agents/certification-report.ts` | CREAR | Generador del reporte de certificación |
| `apps/api/src/agents/orchestrator.ts` | MODIFICAR | Quality gate post-L4, inyectar CriteriaMap en QA prompt |
| `skills/qa-agent/task.md` | MODIFICAR | Instrucción explícita de generar `test-mapping.json` |
| `skills/integration-agent/task.md` | MODIFICAR | Instrucción de generar `docs/certification.md` con matriz |
| `apps/api/src/agents/tool-definitions.ts` | MODIFICAR | Agregar schema de `test-mapping.json` como output conocido |
| `apps/api/src/agents/__tests__/criteria-extractor.test.ts` | CREAR | Tests con specs reales como fixtures |
| `apps/api/src/agents/__tests__/certification-report.test.ts` | CREAR | Tests de generación de reporte |

### Dependencias

- M4 completado (orquestador, base-agent, tool-executor)
- Mejora 2 (Skills compartidas) — formato unificado de reportes
- Mejora 3 (Memoria entre sesiones) — project_memory.md como input para integration-agent

### Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| QA-agent no genera `test-mapping.json` correctamente | Alta | Validación Zod del JSON output; si falla parsing, retry con feedback específico al agente |
| Quality gate genera loop infinito de re-ejecuciones | Baja | Hard limit de 2 re-runs + timeout de 15 min para QA |
| Criterios ambiguos no son mapeables a tests | Media | Criteria extractor emite warnings para criterios que no siguen patrón medible; docs lo reportan |
| Certification report engaña con falsos positivos | Baja | Integration-agent valida que el test realmente testea lo que dice el mapping (no solo el nombre) |

### Estimación

- **Complejidad**: Alta
- **Sprint sugerido**: 6

---

## MEJORA 5: Resiliencia del Ciclo de Vida

### Problema actual

El análisis del ciclo de vida de los agentes (`base-agent.ts` → `orchestrator.ts` → `worker.ts`) revela 4 gaps de resiliencia operativa:

1. **Sin graceful shutdown**: Si el worker recibe `SIGTERM` (deploy en Railway, OOM kill, restart), el agente muere mid-ejecución. No hay signal handler — un `createFile` podría dejar un archivo a medio escribir, y el agente queda con status `working` permanentemente (zombie).

2. **Sin timeout por llamada individual a Claude**: Existe timeout global de 10 min por agente (`TOOL_USE_TIMEOUT_MS` en `base-agent.ts`), pero NO hay timeout por cada `client.messages.create()`. Si una llamada se cuelga (red, API de Anthropic degradada), consume el budget completo sin progreso.

3. **Anthropic client singleton con paralelismo**: `getAnthropicClient()` retorna un singleton. Con Mejora 1 (paralelismo), dos agentes harían `client.messages.create()` simultáneamente sobre la misma instancia. El SDK de Anthropic usa HTTP stateless, pero no se ha verificado thread-safety con requests concurrentes.

4. **Sin monitoreo de memoria por agente**: `MessageParam[]` crece con cada turno (hasta 50 turnos × ~40KB por turno). Con `CONCURRENCY=3` en el worker, podrían acumularse ~6MB+ simultáneos. No hay alerta ni circuit breaker.

**Evidencia**:
- `worker.ts`: `const worker = startWorker(); console.log(...)` — sin handler de `SIGTERM`/`SIGINT`
- `base-agent.ts` línea ~55: `await callWithBackoff(() => client.messages.create({...}))` — backoff por rate limit (429), pero sin timeout por llamada
- `base-agent.ts` línea ~39: `const client = getAnthropicClient()` — singleton, compartido entre ejecuciones

### Solución propuesta

1. **SIGTERM handler**: Registrar handlers en `worker.ts` que setean flag `shuttingDown = true`. El loop de Tool Use en `base-agent.ts` verifica el flag antes de cada llamada a Claude y, si está activo, persiste estado actual y sale gracefully con `agent.status = 'paused'`.

2. **Per-call timeout**: Envolver cada `client.messages.create()` con `AbortController` + timeout de 2 minutos. Si una llamada excede el timeout, se aborta y se reintenta (contando contra los 3 reintentos de backoff existentes).

3. **Client safety para parallelismo**: Verificar que el SDK de Anthropic soporta requests concurrentes. Si no, crear instancia por agente (no singleton) durante ejecución paralela.

4. **Memory monitor**: Registrar `process.memoryUsage().heapUsed` al inicio y después de cada turno. Si crece >200MB sobre baseline, emitir warning en logs y truncar mensajes más antiguos del array.

### Historias de Usuario

#### HU-44: Graceful shutdown del worker

**Como** operador de Sophia (DevOps)
**Quiero** que el worker se apague limpiamente cuando recibe señales del sistema
**Para** que el agente activo no quede en estado zombie y pueda retomarse

**Criterios de aceptación:**

- [ ] `worker.ts` registra handlers para `SIGTERM` y `SIGINT`
- [ ] Al recibir señal, setea flag global `shuttingDown = true`
- [ ] `base-agent.ts` verifica `shuttingDown` antes de cada llamada a `client.messages.create()`
- [ ] Si `shuttingDown = true`, persiste `MessageParam[]` actual en `agent_messages` (Mejora 3) y setea `agent.status = 'paused'`
- [ ] El worker espera máximo 30 segundos para que el tool_call actual termine antes de forzar exit
- [ ] Al restart, el agente retoma desde el último turno persistido (no desde el inicio de la capa)
- [ ] Tests unitarios simulan `SIGTERM` y verifican que el agente sale con status `paused`

#### HU-45: Timeout por llamada individual a Claude API

**Como** sistema (orquestador)
**Quiero** que cada llamada individual a Claude tenga timeout propio
**Para** que una llamada colgada no consuma el budget completo del agente

**Criterios de aceptación:**

- [ ] Cada `client.messages.create()` tiene timeout de 2 minutos vía `AbortController.signal`
- [ ] Si timeout se excede, la llamada se aborta y cuenta como 1 intento de los 3 de backoff existentes
- [ ] Si los 3 intentos fallan por timeout, el agente falla con error descriptivo: `"Claude API timeout after 3 attempts (2min each)"`
- [ ] El timeout es configurable vía variable de entorno `CLAUDE_CALL_TIMEOUT_MS` (default: 120000)
- [ ] Tests unitarios mockean una llamada que nunca responde y verifican que se aborta en < 130s

#### HU-46: Thread-safety del Anthropic client para paralelismo

**Como** desarrollador de Sophia
**Quiero** que el cliente de Anthropic funcione correctamente con agentes paralelos
**Para** que Mejora 1 (paralelismo) no cause race conditions o errores de SDK

**Criterios de aceptación:**

- [ ] Test de integración ejecuta 2 llamadas simultáneas a `client.messages.create()` con el mismo singleton
- [ ] Si el test falla (error de SDK, respuesta corrupta, deadlock), se implementa factory `createAnthropicClient()` que retorna instancia nueva por agente
- [ ] Si el test pasa, se documenta en `docs/adr/` la decisión de mantener singleton con evidencia
- [ ] El orquestador en modo paralelo (Mejora 1) usa el patrón validado (singleton o factory)
- [ ] Performance: no más de 5% overhead en creación de instancias si se usa factory

#### HU-47: Monitoreo de memoria por agente

**Como** operador de Sophia
**Quiero** alertas cuando un agente consume memoria excesiva
**Para** prevenir OOM kills que corrompen el estado del pipeline

**Criterios de aceptación:**

- [ ] `base-agent.ts` registra `process.memoryUsage().heapUsed` al inicio del agente y después de cada turno
- [ ] Si heap crece >200MB sobre baseline, emite warning en `agent_logs`: `"Memory warning: heap grew ${delta}MB in ${turns} turns"`
- [ ] Si heap crece >500MB sobre baseline, trunca los primeros 30% de `MessageParam[]` (mantiene los más recientes) y emite warning
- [ ] El threshold es configurable vía `AGENT_MEMORY_WARN_MB` (default: 200) y `AGENT_MEMORY_TRUNCATE_MB` (default: 500)
- [ ] WebSocket emite evento `agent:warning` con `{ type: 'memory', heapMB, deltaMB, turns }`
- [ ] Tests unitarios verifican truncación de messages y emission de warning

### Métricas de éxito

- **Antes**: Agentes zombie después de SIGTERM = frecuente (cada deploy). Llamadas colgadas consumen 10 min completos. Sin monitoreo de memoria.
- **Después**: Zero zombies (graceful shutdown). Llamadas colgadas abort en 2 min (80% reducción de desperdicio). Memory warnings antes de OOM.

### Archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `apps/api/src/worker.ts` | MODIFICAR | Agregar SIGTERM/SIGINT handlers con flag `shuttingDown` + wait de 30s |
| `apps/api/src/agents/base-agent.ts` | MODIFICAR | Verificar `shuttingDown` antes de cada Claude call, AbortController per-call con timeout 2min, memory monitoring por turno |
| `apps/api/src/agents/orchestrator.ts` | MODIFICAR | Pasar client factory/singleton según modo (secuencial vs paralelo) |
| `apps/api/src/lib/anthropic-client.ts` | CREAR | Factory o singleton verificado para thread-safety — extraer de `getAnthropicClient()` actual |
| `apps/api/src/agents/__tests__/base-agent.test.ts` | MODIFICAR | Tests de SIGTERM shutdown, per-call timeout, memory truncation |
| `apps/api/src/agents/__tests__/anthropic-client.test.ts` | CREAR | Test de concurrencia del SDK |

### Dependencias

- M4 completado (worker.ts, base-agent.ts existentes)
- Mejora 3 (Memoria entre sesiones) — para persistir MessageParam[] en shutdown
- Mejora 1 (Paralelismo) — HU-46 directamente relacionada

### Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| SIGTERM handler no se ejecuta en OOM kill (SIGKILL) | Media | Solo mitigable con Mejora 3 (checkpoint granular). SIGKILL no es interceptable — la persistencia turno a turno es el safety net |
| AbortController no funciona con SDK de Anthropic | Baja | El SDK soporta `signal` en options. Alternativa: `Promise.race([apiCall, timeout])` |
| Truncar MessageParam[] causa incoherencia en Claude | Media | Solo truncar mensajes antiguos (primeros 30%); el contexto más reciente se preserva. Claude tolera bien historia parcial |
| Memory monitoring tiene overhead | Baja | `process.memoryUsage()` es ~0.1ms — negligible vs. 2min de API call |

### Estimación

- **Complejidad**: Media
- **Sprint sugerido**: 5 (HU-44, HU-45, HU-47) + Sprint 6 (HU-46 — requiere paralelismo)

---

## HOJA DE RUTA

| Sprint | Mejora | HUs | Dependencias | Impacto |
|--------|--------|-----|--------------|---------|
| 5 | Mejora 2 — Skills Compartidas | HU-32, HU-33, HU-34, HU-35 | Ninguna | Consistencia: elimina duplicaciones e inconsistencias entre 9 agentes |
| 5 | Mejora 3 — Memoria entre Sesiones | HU-36, HU-37, HU-38, HU-39 | Mejora 2 (formato) | Resiliencia: 0% → 100% contexto recuperable post-crash |
| 5 | Mejora 5 — Resiliencia Ciclo de Vida (parcial) | HU-44, HU-45, HU-47 | Mejora 3 (persistencia) | Operabilidad: zero zombies, timeout granular, memory alerts |
| 6 | Mejora 1 — Paralelismo de Agentes | HU-29, HU-30, HU-31 | Mejora 2 (consistencia), M4 | Rendimiento: -22% tiempo de pipeline (~45min → ~35min) |
| 6 | Mejora 4 — Certificación de HUs | HU-40, HU-41, HU-42, HU-43 | Mejora 2 + 3, M4 | Calidad: trazabilidad y quality gate automáticos |
| 6 | Mejora 5 — Resiliencia Ciclo de Vida (final) | HU-46 | Mejora 1 (paralelismo) | Seguridad: thread-safety verificado para ejecución concurrente |

```
Sprint 5                                         Sprint 6
┌──────────────────────────────────────────┐    ┌──────────────────────────────────────┐
│ Mejora 2: Skills Compartidas             │    │ Mejora 1: Paralelismo de Agentes     │
│ HU-32 → HU-33 → HU-34 → HU-35          │───►│ HU-29 → HU-30 → HU-31              │
│                                          │    │                                      │
│ Mejora 3: Memoria entre Sesiones         │    │ Mejora 4: Certificación de HUs       │
│ HU-36 → HU-37 → HU-38 → HU-39          │───►│ HU-40 → HU-41 → HU-42 → HU-43     │
│                                          │    │                                      │
│ Mejora 5 (parcial): Resiliencia          │    │ Mejora 5 (final): Thread Safety      │
│ HU-44 → HU-45 → HU-47                   │───►│ HU-46                               │
└──────────────────────────────────────────┘    └──────────────────────────────────────┘
```

---

## RESUMEN EJECUTIVO

Las 5 mejoras transforman el Agent Runner de un pipeline secuencial sin memoria a un sistema inteligente, resiliente y observable:

1. **Consistencia garantizada** (Skills compartidas): Los 9 agentes comparten convenciones, anti-patterns y formatos. Se eliminan 9 duplicaciones de instrucciones y 3 inconsistencias de formato. El mantenimiento de convenciones pasa de 9 archivos a 3 archivos centralizados.

2. **Resiliencia total** (Memoria): El contexto de ejecución pasa de volátil (0% recuperable) a persistente (100% recuperable). Los agentes de capas posteriores reciben decisiones y patrones acumulados, mejorando coherencia del código generado. El límite de 20 archivos se reemplaza por un budget inteligente de tokens.

3. **Velocidad optimizada** (Paralelismo): El pipeline se reduce de 9 a 7 pasos efectivos (-22% tiempo). QA y Security corren simultáneamente, al igual que Docs y Deploy. El ahorro es de ~10 minutos por proyecto generado.

4. **Calidad certificable** (Certificación HUs): Cada criterio de aceptación se rastrea desde el spec hasta el test que lo valida. Un quality gate bloquea el pipeline si la cobertura es insuficiente. El certification report genera evidencia auditable de cumplimiento.

5. **Operabilidad robusta** (Resiliencia Ciclo de Vida): Graceful shutdown elimina agentes zombie en deploys. Timeout granular por llamada a Claude evita waste de 10 min en llamadas colgadas. Monitoreo de memoria previene OOM kills. Thread-safety verificada para ejecución paralela segura.

**Impacto combinado**: tiempo de generación -22%, inconsistencias entre agentes -100%, contexto perdido en crash -100%, trazabilidad requisito→test de 0% a 100%, agentes zombie en deploy -100%, waste por llamadas colgadas -80%.

**Total**: 19 HUs nuevas (HU-29 a HU-47), 2 sprints, 8 archivos nuevos, 18+ archivos modificados.

---

## DEFINICIÓN DE DONE

### Mejora 1 — Paralelismo de Agentes
- [ ] `dependency-graph.ts` existe con tests unitarios pasando (resolución secuencial + paralela + ciclos)
- [ ] Pipeline ejecuta L4||L4.5 y L5||L6 en paralelo verificable por timestamps en `agent_logs`
- [ ] Si una capa paralela falla, la otra se cancela en < 5s
- [ ] WebSocket muestra 2 agentes `working` simultáneamente
- [ ] Tiempo de pipeline medido en 3 proyectos canarios promedia ≤ 80% del baseline secuencial
- [ ] Pausa y retry funcionan correctamente con capas paralelas
- [ ] Lint + Build + Tests pasan en CI

### Mejora 2 — Skills Compartidas
- [ ] `skills/_shared/` contiene 3 archivos (< 3000 tokens total)
- [ ] Los 9 `system.md` están refactorizados (cada uno -30% tamaño mínimo)
- [ ] Cero instrucciones de Tool Use duplicadas fuera de `_shared/`
- [ ] Security e Integration usan el mismo enum de severidades
- [ ] QA-agent referencia artefactos de seed-agent
- [ ] Pipeline de test en proyecto canario genera output equivalente al baseline
- [ ] Lint + Build + Tests pasan en CI

### Mejora 3 — Memoria entre Sesiones
- [ ] Tabla `agent_messages` existe con migración aplicada
- [ ] Crash simulado mid-layer + restart reconstruye conversación exacta desde BD
- [ ] `project_memory.md` se genera y acumula correctamente para capas 2-7
- [ ] Context-builder prioriza archivos relevantes dentro de budget de 40K tokens
- [ ] Persistencia por turno agrega < 100ms P99 (medido con benchmark)
- [ ] Lint + Build + Tests pasan en CI

### Mejora 4 — Certificación de HUs
- [ ] `criteria-extractor.ts` parsea specs reales (M1, M2, M4) correctamente
- [ ] QA-agent genera `test-mapping.json` válido (Zod parse sin errores)
- [ ] Quality gate bloquea pipeline cuando cobertura < threshold configurable
- [ ] Quality gate re-ejecuta QA con criterios faltantes (máx 2 veces)
- [ ] `docs/certification.md` se genera con matriz trazabilidad completa
- [ ] Cobertura ≥ 80% en al menos 3 proyectos canarios
- [ ] Lint + Build + Tests pasan en CI

### Mejora 5 — Resiliencia del Ciclo de Vida
- [ ] `worker.ts` registra handlers SIGTERM/SIGINT — agente activo sale con `status: paused` (no zombie)
- [ ] Each `client.messages.create()` tiene AbortController con timeout de 2 min
- [ ] Llamadas colgadas se abortan y cuentan contra los 3 reintentos de backoff
- [ ] Test de concurrencia del SDK de Anthropic pasa (2 llamadas simultáneas al singleton)
- [ ] Si singleton no es thread-safe, factory `createAnthropicClient()` implementado y validado
- [ ] Memory monitoring registra heap por turno y emite warning si >200MB delta
- [ ] Truncación automática de MessageParam[] si heap >500MB delta
- [ ] Lint + Build + Tests pasan en CI
