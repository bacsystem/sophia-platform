Genera la API backend para este proyecto.

## Entrada

Recibirás:
1. `spec.md` — Requerimientos y historias de usuario
2. Archivos de Layer 1 (Database) — schema.prisma, migraciones

## Archivos a crear

Por cada módulo:
- `src/modules/{modulo}/{modulo}.routes.ts` — Definición de rutas Fastify
- `src/modules/{modulo}/{modulo}.controller.ts` — Handlers (thin, solo llaman service)
- `src/modules/{modulo}/{modulo}.service.ts` — Lógica de negocio (Prisma directo)
- `src/modules/{modulo}/{modulo}.schema.ts` — Schemas Zod de validación

Infraestructura:
- `src/server.ts` — Entry point Fastify
- `src/plugins/auth.ts` — Middleware JWT cookies httpOnly
- `src/plugins/error-handler.ts` — Error handler global
- `src/plugins/cors.ts` — CORS config

## Reglas

- Lee el schema.prisma de Layer 1 para entender las entidades
- NO crees archivos `.repository.ts` — Prisma se usa directo en el service
- Usa `createFile` para cada archivo
- Al terminar, llama `taskComplete`
