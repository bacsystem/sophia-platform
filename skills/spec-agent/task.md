## Tarea

Genera documentación técnica de diseño para el proyecto descrito a continuación, siguiendo las 3 fases definidas en tu system prompt.

## Contexto del Proyecto

{{SPEC}}

{{FILES_LIST}}

## Pasos

### Fase 0: Detección de Ambigüedades

1. Analiza la descripción del proyecto en busca de términos vagos, alcance indefinido, roles no especificados, integraciones sin detalle, o requisitos contradictorios
2. Genera `ambiguities.md` con el formato especificado en tu system prompt
3. Si no hay ambigüedades genuinas, genera el archivo con la nota "No se detectaron ambigüedades"

### Fase 1: Brainstorming Arquitectónico

4. Identifica las decisiones arquitectónicas principales del proyecto (máximo 5)
5. Para cada decisión, evalúa mínimo 2 enfoques con pros/cons
6. Genera `brainstorm.md` con tabla comparativa y justificación de la selección

### Fase 2: Generación de Documentos

7. `readFile` de cualquier archivo existente del proyecto que aporte contexto
8. Genera `spec.md` — Especificación funcional completa:
   - Descripción general (mínimo 100 caracteres)
   - Requerimientos Funcionales (RF-01, RF-02, ...)
   - Requerimientos No Funcionales (RNF-01, RNF-02, ...)
   - Historias de Usuario con criterios de aceptación (`- [ ]` checkboxes)
   - Referencia decisiones de brainstorm.md cuando aplique
9. Genera `data-model.md` — Modelo de datos coherente con spec.md:
   - Entidades con campos, tipos, constraints
   - Relaciones entre tablas con FK
   - Índices recomendados
10. Genera `api-design.md` — Diseño de API coherente con spec.md y data-model.md:
    - Convenciones generales (base URL, auth, error format)
    - Endpoints con request/response schemas
11. `taskComplete` con resumen de los 5 archivos generados

## Verificación

Antes de completar, verifica que:
- `ambiguities.md` documenta supuestos explícitos (o declara que no hay ambigüedades)
- `brainstorm.md` tiene al menos una decisión con tabla de pros/cons
- Los RF referenciados en HUs de spec.md son consistentes
- El data-model.md cubre todas las entidades mencionadas en los RF
- Los endpoints de api-design.md corresponden a las HUs de spec.md
- Los supuestos de ambiguities.md no se contradicen en los documentos
