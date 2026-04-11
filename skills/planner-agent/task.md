## Tarea

Genera el plan de ejecución (`execution-plan.md`) para el pipeline de generación de código.

## Contexto del Proyecto

{{SPEC}}

{{FILES_LIST}}

## Estructura del Plan

Genera un documento con la siguiente estructura exacta:

```markdown
# Plan de Ejecución

## Resumen
[1-2 párrafos: qué se va a construir, complejidad estimada, puntos de atención]

## Agente 1: DBA Agent (Layer 1)
### Foco
[Qué tablas crear, relaciones clave, decisiones de schema]
### Archivos esperados
- `prisma/schema.prisma` — [descripción específica]
- `prisma/migrations/...` — [migración]
### Riesgos
- [Riesgo concreto con mitigación]
### Dependencias críticas
- [Nada — es el primer agente]

## Agente 1.5: Seed Agent (Layer 1.5)
[misma estructura]

## Agente 2: Backend Agent (Layer 2)
[misma estructura — listar módulos/rutas específicas]

## Agente 3: Frontend Agent (Layer 3)
[misma estructura — listar páginas/componentes específicos]

## Agente 4: QA Agent (Layer 4)
[misma estructura — áreas de testing prioritarias]

## Agente 4.5: Security Agent (Layer 4.5)
[misma estructura — superficies de ataque a auditar]

## Agente 5: Docs Agent (Layer 5)
[misma estructura]

## Agente 6: Deploy Agent (Layer 6)
[misma estructura]

## Agente 7: Integration Agent (Layer 7)
[misma estructura — qué validaciones cross-layer ejecutar]
```

## Pasos

1. Lee la spec completa incluyendo ambiguities.md y brainstorm.md si están disponibles
2. Identifica las entidades del modelo de datos → plan para DBA
3. Identifica los endpoints/módulos → plan para Backend
4. Identifica las páginas/componentes → plan para Frontend
5. Identifica las áreas de riesgo → plan para QA y Security
6. Genera `execution-plan.md` con los 9 agentes
7. `taskComplete` con resumen

## Verificación

- Cada agente tiene al menos 1 archivo esperado listado
- Los riesgos son específicos del proyecto (no genéricos)
- Las dependencias críticas reflejan el flujo real del pipeline
