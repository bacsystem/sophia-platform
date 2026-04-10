# SPEC — M10: Superpowers Pipeline Integration

# Sophia Platform

# Versión: 1.0.0 | Sprint: 7–8

---

## Descripción

Seis mejoras al pipeline de generación de Sophia, inspiradas en la metodología Superpowers: inteligencia del spec-agent (detección de ambigüedades + brainstorming), generación de plan de ejecución (layer 0), TDD enforcement en agentes de código, checkpoints de verificación post-capa, reintentos diagnósticos en QA, y resiliencia de pipeline (crash recovery avanzado). Estas mejoras replican dentro de Sophia los mismos patrones que Superpowers usa para desarrollar Sophia.

---

## Stack

- Backend: Node.js 22 + Fastify + BullMQ + Anthropic SDK (tool use)
- DB: PostgreSQL 16 (tablas nuevas: `pipeline_states`, `verification_checkpoints`)
- Redis 7 (coordination)
- Filesystem: `skills/_shared/`, `skills/planner-agent/`, `projects/{id}/plan/`

---

## Dependencias

- **M4**: Agent Runner — orquestador, base-agent, dependency-graph, context-builder (código base a modificar)
- **M9**: Agent Improvements — shared skills, parallel execution, quality gate, certification (extender)
- **M5**: Dashboard — WebSocket events (nuevos eventos checkpoint + plan)
- **M3**: Spec Engine — spec-agent skills (reescribir system.md)

---

## Requerimientos Funcionales

- **RF-01**: El spec-agent debe detectar ambigüedades en la descripción del usuario y documentar supuestos explícitos
- **RF-02**: El spec-agent debe explorar múltiples enfoques arquitectónicos antes de elegir uno
- **RF-03**: Un planner-agent (layer 0) debe generar un plan de ejecución antes del pipeline
- **RF-04**: El dashboard debe mostrar el plan de ejecución con progreso por agente
- **RF-05**: Existe un shared skill de TDD que los agentes de código deben seguir
- **RF-06**: El seed-agent debe generar test contracts que los agentes posteriores consumen
- **RF-07**: El orquestador debe verificar el output de cada capa antes de continuar
- **RF-08**: Los checkpoints de verificación deben emitir eventos WebSocket al dashboard
- **RF-09**: El quality gate de QA debe inyectar contexto diagnóstico en reintentos
- **RF-10**: El QA-agent debe generar un investigation report cuando tests fallan
- **RF-11**: El estado del pipeline debe persistirse atómicamente en BD para crash recovery
- **RF-12**: El worker debe auto-detectar pipelines interrumpidos y ofrecer resume

## Requerimientos No Funcionales

- **RNF-01**: La detección de ambigüedades no debe agregar más de 30s al tiempo del spec-agent
- **RNF-02**: El planner-agent debe completar en < 2 minutos
- **RNF-03**: La verificación post-capa debe completar en < 3s por capa
- **RNF-04**: La persistencia de estado debe agregar < 50ms de latencia por transición
- **RNF-05**: El auto-resume debe detectar pipelines interrumpidos en < 5s al iniciar el worker
- **RNF-06**: Los test contracts no deben exceder 2000 tokens para no saturar el context

---

## MEJORA 1: Spec-Agent Intelligence

### Problema actual

El spec-agent (`skills/spec-agent/system.md`) actúa como un "arquitecto de software senior" que recibe una descripción libre y genera `spec.md`, `data-model.md` y `api-design.md`. No tiene mecanismo para:

1. **Detectar ambigüedades** — Si la descripción del usuario dice "el sistema debe ser rápido", el agente no pregunta qué significa "rápido". No se generan supuestos explícitos.
2. **Explorar alternativas** — Si hay 3 formas de modelar un dominio (SQL relacional, document store, event sourcing), el agente elige una sin documentar por qué descartó las otras.

**Evidencia**: `skills/spec-agent/system.md` no contiene secciones de "ambiguity detection" ni "brainstorming".

**Impacto**: Los agentes downstream reciben specs con supuestos implícitos. Cuando el backend-agent interpreta diferente al frontend-agent, se generan inconsistencias que solo el integration-agent detecta al final del pipeline.

### Solución propuesta

Reescribir `skills/spec-agent/system.md` para incluir dos fases previas a la generación:

1. **Fase de Detección de Ambigüedades**: El agente analiza la descripción, identifica términos vagos, y genera `ambiguities.md` con supuestos explícitos + alternativas descartadas.
2. **Fase de Brainstorming**: Para cada decisión arquitectónica mayor, el agente evalúa 2-3 enfoques con tabla de pros/cons y selecciona uno con justificación.

Ambos artefactos se inyectan en el context de los agentes downstream para que hereden las decisiones.

### Historias de Usuario

#### HU-48: Detección de ambigüedades en spec-agent

**Como** usuario de Sophia
**Quiero** que el spec-agent identifique ambigüedades en mi descripción
**Para** que los supuestos queden documentados y los agentes downstream no inventen interpretaciones

**Criterios de aceptación:**

- [ ] `skills/spec-agent/system.md` contiene sección "## Fase 0: Detección de Ambigüedades"
- [ ] El spec-agent genera `ambiguities.md` con formato: `### Ambigüedad N` + `Término`, `Interpretación elegida`, `Alternativas descartadas`, `Justificación`
- [ ] Cada ambigüedad detectada tiene al menos 2 interpretaciones alternativas
- [ ] Si no hay ambigüedades, `ambiguities.md` contiene "No se detectaron ambigüedades en la descripción"
- [ ] `context-builder.ts` inyecta `ambiguities.md` en el prompt de todos los agentes downstream (layer ≥ 1)
- [ ] El archivo `ambiguities.md` se persiste en `projects/{id}/spec/ambiguities.md`
- [ ] Test unitario: descripción ambigua → agente genera ≥ 2 ambigüedades documentadas
- [ ] Test unitario: descripción clara → agente genera archivo con "No se detectaron ambigüedades"

#### HU-49: Brainstorming arquitectónico en spec-agent

**Como** usuario de Sophia
**Quiero** que el spec-agent explore múltiples enfoques antes de decidir la arquitectura
**Para** tomar decisiones informadas con pros/cons documentados

**Criterios de aceptación:**

- [ ] `skills/spec-agent/system.md` contiene sección "## Fase 1: Brainstorming"
- [ ] El spec-agent genera `brainstorm.md` con formato: `### Decisión N: [tema]` + tabla `| Enfoque | Pros | Cons | Seleccionado |`
- [ ] Cada decisión evalúa mínimo 2 enfoques alternativos
- [ ] `brainstorm.md` se persiste en `projects/{id}/spec/brainstorm.md` y se inyecta en context downstream

### Métricas de éxito

- **Antes**: 0 ambigüedades documentadas, 0 decisiones con trade-offs explícitos
- **Después**: ≥ 3 ambigüedades/decisiones documentadas por spec promedio

### Archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `skills/spec-agent/system.md` | MODIFICAR | Agregar fases de ambigüedad y brainstorming |
| `apps/api/src/agents/context-builder.ts` | MODIFICAR | Inyectar `ambiguities.md` y `brainstorm.md` en context downstream |
| `apps/api/src/agents/__tests__/context-builder.test.ts` | MODIFICAR | Tests de inyección de nuevos artefactos |

### Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Spec-agent genera ambigüedades falsas (over-detects) | Media | Instruir que solo detecte ambigüedades que afecten decisiones de código |
| Brainstorming consume tokens sin valor | Baja | Limitar a máximo 5 decisiones, 3 enfoques por decisión |

---

## MEJORA 2: Plan de Ejecución (Layer 0)

### Problema actual

El pipeline ejecuta 9 agentes siguiendo el dependency-graph pero ningún agente tiene visibilidad del plan completo. Cada agente recibe la spec + archivos de capas anteriores, pero no sabe:

- Qué deberían generar las capas posteriores
- Cuáles son los puntos de riesgo del proyecto
- Qué módulos del spec son más complejos y necesitan más atención

**Impacto**: Los agentes tempranos (DBA, Backend) no optimizan sus decisiones pensando en las necesidades de agentes posteriores. El usuario no ve qué va a pasar antes de que empiece.

### Solución propuesta

Agregar un **planner-agent** como **Layer 0** que:
1. Lee la spec completa + `ambiguities.md` + `brainstorm.md`
2. Genera `execution-plan.md` con: foco por agente, archivos esperados, riesgos, dependencias críticas
3. El plan se inyecta en el context de todos los agentes downstream
4. El dashboard muestra el plan con progreso

### Historias de Usuario

#### HU-50: Planner-agent (Layer 0)

**Como** Sophia Platform
**Quiero** un agente planificador que genere un plan de ejecución antes del pipeline
**Para** que cada agente tenga visibilidad completa del objetivo y los demás agentes

**Criterios de aceptación:**

- [ ] Existe `skills/planner-agent/system.md` con instrucciones de planificación
- [ ] Existe `skills/planner-agent/task.md` con template de `execution-plan.md`
- [ ] `dependency-graph.ts` incluye nodo Layer 0 (planner) sin dependencias, dependido por Layer 1
- [ ] El planner-agent genera `projects/{id}/plan/execution-plan.md` con secciones: `## Agente N: [nombre]` + `Foco`, `Archivos esperados`, `Riesgos`, `Dependencias críticas`
- [ ] `context-builder.ts` inyecta `execution-plan.md` en todos los agentes (layer ≥ 1)
- [ ] `orchestrator.ts` carga skills de planner-agent y lo ejecuta como primera capa
- [ ] Test: spec de input → planner genera plan con los 9 agentes listados

#### HU-51: Dashboard — visualización del plan de ejecución

**Como** usuario de Sophia
**Quiero** ver el plan de ejecución en el dashboard antes de que el pipeline comience
**Para** entender qué va a generar cada agente y cuánto tiempo tomará

**Criterios de aceptación:**

- [ ] WebSocket emite evento `plan:generated` con el contenido del plan cuando Layer 0 completa
- [ ] El dashboard muestra el plan en una vista expandible dentro del proyecto
- [ ] Cada sección del plan se marca como completada cuando el agente correspondiente termina
- [ ] El plan persiste en BD y se muestra aunque el usuario recargue la página

### Archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `skills/planner-agent/system.md` | CREAR | System prompt del planner |
| `skills/planner-agent/task.md` | CREAR | Task template con estructura del plan |
| `apps/api/src/agents/dependency-graph.ts` | MODIFICAR | Agregar nodo Layer 0 |
| `apps/api/src/agents/orchestrator.ts` | MODIFICAR | Ejecutar planner como primera capa |
| `apps/api/src/agents/context-builder.ts` | MODIFICAR | Inyectar `execution-plan.md` |
| `apps/web/src/components/projects/execution-plan.tsx` | CREAR | Componente de plan en dashboard |
| `apps/api/src/websocket/ws.emitter.ts` | MODIFICAR | Evento `plan:generated` |

### Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Planner consume 2 min extra de API time | Media | Usar claude-sonnet en vez de opus para planner (más rápido, suficiente para planificación) |
| Plan genérico sin valor real | Baja | Task.md con template estricto que force contenido específico por agente |

---

## MEJORA 3: TDD Enforcement

### Problema actual

Los agentes de código (backend-agent, frontend-agent) generan implementación primero y tests después (si los genera el QA-agent). No existe un ciclo RED-GREEN-REFACTOR. Los Superpowers usan TDD consistentemente con:
- Test primero → implementación después
- Test contracts que definen interfaces antes de la implementación

**Impacto**: Tests post-hoc cubren lo que ya existe, no lo que debería existir. Gaps de cobertura son comunes.

### Solución propuesta

1. Crear `skills/_shared/test-driven-development.md` que instruya a backend-agent y frontend-agent a escribir tests antes de implementar
2. El seed-agent genera **test contracts** — archivos que declaran interfaces/tipos esperados que los agentes de código deben satisfacer
3. Los test contracts se inyectan en el context del backend-agent y frontend-agent

### Historias de Usuario

#### HU-52: Shared skill de TDD

**Como** agente de código de Sophia (backend, frontend)
**Quiero** seguir una metodología TDD con instrucciones claras
**Para** generar tests antes de implementación, aumentando la cobertura

**Criterios de aceptación:**

- [ ] Existe `skills/_shared/test-driven-development.md` con secciones: ciclo RED-GREEN-REFACTOR, cuándo escribir tests, estructura de test files, naming conventions para tests
- [ ] `orchestrator.ts` → `composeSystemPrompt()` inyecta el TDD skill en backend-agent y frontend-agent (no en DBA, Seed, Docs, Deploy)
- [ ] Los `_shared/*.md` totales (incluyendo el nuevo) siguen bajo 4000 tokens

#### HU-53: Test contracts del seed-agent

**Como** backend-agent y frontend-agent
**Quiero** recibir test contracts que definan las interfaces esperadas
**Para** implementar código que satisfaga contratos pre-definidos

**Criterios de aceptación:**

- [ ] `skills/seed-agent/system.md` instruye generar `test-contracts.md` además de factories y constants
- [ ] `test-contracts.md` define: interfaces TypeScript esperadas, function signatures, expected behaviors por módulo
- [ ] `context-builder.ts` inyecta `test-contracts.md` en backend-agent (layer 2) y frontend-agent (layer 3)
- [ ] Test: seed-agent output incluye `test-contracts.md` con al menos un contrato por entidad del data-model

### Archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `skills/_shared/test-driven-development.md` | CREAR | Shared skill TDD |
| `skills/seed-agent/system.md` | MODIFICAR | Agregar generación de test-contracts.md |
| `apps/api/src/agents/orchestrator.ts` | MODIFICAR | Inyectar TDD skill selectivamente |
| `apps/api/src/agents/context-builder.ts` | MODIFICAR | Inyectar test-contracts.md |

---

## MEJORA 4: Checkpoints de Verificación

### Problema actual

El orquestador ejecuta cada capa y pasa a la siguiente sin validar que el output cumpla expectativas mínimas. Si el backend-agent genera archivos con nombres incorrectos o falta un archivo esperado, no se detecta hasta que el integration-agent (layer 7) lo reporta — demasiado tarde.

**Impacto**: Errores se propagan por 5-6 capas antes de detectarse, desperdiciando tokens y tiempo.

### Solución propuesta

Agregar `verifyBatchOutput()` en el orquestador que se ejecuta después de cada capa. Verifica:
- Archivos esperados existen según `execution-plan.md`
- Naming conventions match `conventions.md`
- No hay archivos vacíos o con errores de sintaxis obvios

Emite eventos WebSocket `checkpoint:pass` / `checkpoint:fail` para el dashboard.

### Historias de Usuario

#### HU-54: Verificación post-capa en orquestador

**Como** Sophia Platform
**Quiero** verificar el output de cada capa antes de continuar al siguiente agente
**Para** detectar errores tempranamente y evitar propagación

**Criterios de aceptación:**

- [ ] Existe función `verifyBatchOutput(layerDef, projectDir, plan): VerificationResult` en orchestrator
- [ ] Verifica: archivos esperados del plan existen, archivos no están vacíos, extensiones correctas
- [ ] Si verificación falla con severidad CRITICAL, el pipeline se pausa (no continúa)
- [ ] Si verificación falla con severidad MEDIUM/LOW, agrega warning al log y continúa
- [ ] Test: layer output con archivo faltante → verificación retorna CRITICAL

#### HU-55: Eventos WebSocket de checkpoint

**Como** usuario de Sophia
**Quiero** ver el resultado de verificación de cada capa en el dashboard
**Para** saber si cada paso del pipeline cumplió expectativas

**Criterios de aceptación:**

- [ ] WebSocket emite `checkpoint:result` con `{ layer, status: 'pass'|'warn'|'fail', details[] }`
- [ ] El dashboard muestra indicador visual (verde/amarillo/rojo) por capa en el canvas de pipeline
- [ ] Los detalles del checkpoint son accesibles en un tooltip o modal expandible

### Archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `apps/api/src/agents/orchestrator.ts` | MODIFICAR | Agregar `verifyBatchOutput()` |
| `apps/api/src/agents/batch-verifier.ts` | CREAR | Lógica de verificación extraída |
| `apps/api/src/websocket/ws.emitter.ts` | MODIFICAR | Evento `checkpoint:result` |
| `apps/web/src/components/projects/checkpoint-indicator.tsx` | CREAR | Indicador visual en dashboard |
| `apps/api/src/agents/__tests__/batch-verifier.test.ts` | CREAR | Tests de verificación |

---

## MEJORA 5: QA Diagnostic Retry

### Problema actual

El quality gate (`enforceQaQualityGate()`) re-ejecuta QA-agent hasta 2 veces si la cobertura de criterios es < 80%. El prompt de reintento es genérico: no incluye información sobre qué tests fallaron ni por qué.

**Evidencia**: `orchestrator.ts` L94-146 — `enforceQaQualityGate()` con `MAX_QA_RERUNS=2`. El prompt de reintento simplemente pide "mejorar cobertura" sin detalles.

**Impacto**: Reintentos ciegos desperdician tokens en los mismos errores.

### Solución propuesta

1. Cuando QA falla, extraer qué criterios no se cubrieron y qué tests fallaron
2. Inyectar esta información como "contexto diagnóstico" en el prompt de reintento
3. Si el QA falla después de reintentos, generar `investigation-report.md` con análisis de root cause

### Historias de Usuario

#### HU-56: Prompt diagnóstico en reintentos de QA

**Como** QA-agent ejecutándose en reintento
**Quiero** recibir contexto sobre qué falló en el intento anterior
**Para** enfocar mi esfuerzo en los criterios no cubiertos

**Criterios de aceptación:**

- [ ] `enforceQaQualityGate()` extrae los criterios no cubiertos del resultado del QA
- [ ] El prompt de reintento incluye: lista de criterios faltantes, tests que fallaron, archivos involucrados
- [ ] Test: QA con 60% cobertura → reintento recibe los criterios específicos del 40% faltante

#### HU-57: Investigation report en fallos persistentes de QA

**Como** usuario de Sophia
**Quiero** un reporte de investigación cuando los tests siguen fallando después de reintentos
**Para** entender la raíz del problema y tomar acción manual si es necesario

**Criterios de aceptación:**

- [ ] Cuando QA falla después de `MAX_QA_RERUNS`, genera `investigation-report.md` en `projects/{id}/qa/`
- [ ] El reporte incluye: criterios no cubiertos, hipótesis de causas raíz, archivos sospechosos, recomendaciones
- [ ] WebSocket emite `qa:investigation-report` con la ruta del archivo al dashboard

### Archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `apps/api/src/agents/orchestrator.ts` | MODIFICAR | Mejorar `enforceQaQualityGate()` con diagnóstico |
| `skills/qa-agent/system.md` | MODIFICAR | Agregar sección de investigation report |
| `skills/_shared/investigating-test-failures.md` | CREAR | Skill compartido de investigación |
| `apps/api/src/agents/__tests__/orchestrator.test.ts` | MODIFICAR | Tests de retry diagnóstico |

### Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Diagnóstico consume tokens extra sin mejorar cobertura | Baja | Limitar diagnóstico a 500 tokens, solo criterios más críticos |

---

## MEJORA 6: Pipeline Resilience (Crash Recovery Avanzado)

### Problema actual

M9 implementó persistencia de mensajes Claude turn-by-turn (`agent_messages`) y `reconstructMessages()` para reconstruir conversación después de un crash. Sin embargo:

1. **No hay estado global del pipeline** — Si el worker cae entre Layer 3 y Layer 4, el sistema no sabe en qué capa estaba
2. **No hay auto-resume** — Después de un crash, se requiere intervención manual para reiniciar
3. **No hay UI de recovery** — El dashboard no muestra que un pipeline fue interrumpido ni ofrece "Resume"

### Solución propuesta

1. Persistir `pipeline_state` en BD (atomically updated on each layer transition)
2. Al iniciar el worker, escanear pipelines con estado `running` + `updatedAt > 5min` → marcar como `interrupted`
3. Ofrecer auto-resume o manual-resume desde el dashboard

### Historias de Usuario

#### HU-58: Persistencia de estado del pipeline

**Como** Sophia Platform
**Quiero** que el estado del pipeline se persista atómicamente en BD
**Para** saber exactamente dónde se interrumpió en caso de crash

**Criterios de aceptación:**

- [ ] Existe tabla `pipeline_states` con: `projectId`, `status` (running/completed/interrupted/failed), `currentLayer`, `completedLayers[]`, `startedAt`, `updatedAt`
- [ ] El orquestador actualiza `pipeline_states` atómicamente al iniciar cada capa y al completarla
- [ ] Al inicio del pipeline, crea registro con `status: running`, `currentLayer: 0`
- [ ] Al completar, actualiza a `status: completed` con timestamp

#### HU-59: Auto-resume de pipelines interrumpidos

**Como** usuario de Sophia
**Quiero** que los pipelines interrumpidos por crash se detecten y ofrezcan resume automático
**Para** no perder el progreso generado antes del crash

**Criterios de aceptación:**

- [ ] Al iniciar el worker, escanea `pipeline_states` con `status: running` + `updatedAt` > 5 min → marca como `interrupted`
- [ ] WebSocket emite `pipeline:interrupted` con `projectId` y `lastCompletedLayer` al dashboard
- [ ] El dashboard muestra botón "Resume Pipeline" para pipelines interrumpidos
- [ ] Al hacer resume, el pipeline continúa desde `lastCompletedLayer + 1` sin re-ejecutar capas completadas

### Archivos a crear o modificar

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `apps/api/prisma/schema.prisma` | MODIFICAR | Agregar modelo `PipelineState` |
| `apps/api/src/agents/orchestrator.ts` | MODIFICAR | Persistir estado + lógica de resume |
| `apps/api/src/agents/pipeline-recovery.ts` | CREAR | Detección de interrupciones + resume |
| `apps/api/src/websocket/ws.emitter.ts` | MODIFICAR | Eventos `pipeline:interrupted` |
| `apps/web/src/components/projects/pipeline-recovery.tsx` | CREAR | UI de recovery en dashboard |
| `apps/api/src/agents/__tests__/pipeline-recovery.test.ts` | CREAR | Tests de detección y resume |

### Riesgos

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Resume corrompe estado si archivos parciales quedaron | Media | Verificar integridad de archivos de capa actual antes de resume (usar verifyBatchOutput de Mejora 4) |
| Falso positivo de interrupción (worker lento, no crasheado) | Baja | Threshold de 5min configurable + heartbeat (pipeline_states.updatedAt) |

---

## Estimación Global

| Mejora | HUs | Criterios | Sprint | Complejidad |
|--------|-----|-----------|--------|-------------|
| 1. Spec-Agent Intelligence | 2 (HU-48,49) | 12 | 7 | Media |
| 2. Plan Generation | 2 (HU-50,51) | 11 | 7 | Alta |
| 3. TDD Enforcement | 2 (HU-52,53) | 7 | 7 | Media |
| 4. Verification Checkpoints | 2 (HU-54,55) | 8 | 7-8 | Media |
| 5. QA Diagnostic Retry | 2 (HU-56,57) | 6 | 8 | Media |
| 6. Pipeline Resilience | 2 (HU-58,59) | 8 | 8 | Alta |
| **Total** | **12** | **52** | **7-8** | — |
