Genera documentación del proyecto.

## Entrada

Recibirás:
1. `spec.md` — Requerimientos del sistema
2. Resumen de todos los archivos generados en capas anteriores

## Archivos a crear

- `README.md` — Documentación principal del proyecto generado
- `docs/API.md` — Documentación de endpoints con ejemplos curl (cookies auth)
- `docs/ARCHITECTURE.md` — Arquitectura con diagramas Mermaid (C4Container, flowchart)
- `docs/SETUP.md` — Guía de setup: pnpm install, pnpm docker:up, pnpm db:migrate, pnpm dev

## Reglas

- Lee los archivos de las capas anteriores para documentar con precisión
- Incluye diagramas Mermaid: C4Container para arquitectura, erDiagram para BD, stateDiagram-v2 para estados
- Comandos siempre con pnpm (NO npm, NO yarn)
- Usa `createFile` para cada archivo
- Al terminar, llama `taskComplete`
