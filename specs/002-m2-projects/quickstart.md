# Quickstart: M2 Projects

**Branch**: `002-m2-projects` | **Date**: 2026-04-08

---

## Prerequisito

M1 Auth completamente implementado y migrado (tabla `users` existente).

---

## Setup rápido

```bash
# 1. Cambiar a rama M2
git checkout 002-m2-projects

# 2. Instalar dependencias (si no están)
pnpm install

# 3. Verificar PostgreSQL y Redis corriendo
pg_isready && redis-cli ping

# 4. Aplicar migración M2 (después de actualizar schema.prisma)
pnpm db:migrate
# Nombre sugerido: "add_projects_tables"

# 5. Arrancar API en desarrollo
pnpm --filter @sophia/api dev

# 6. Arrancar frontend
pnpm --filter @sophia/web dev
```

---

## Archivos a crear (orden de implementación)

### Backend (apps/api/)
```
prisma/schema.prisma              ← añadir Project + ProjectSpec models
src/modules/projects/
  project.schema.ts               ← Zod: create, update, list query, config
  project.routes.ts               ← 9 rutas + register en app.ts
  project.controller.ts           ← handlers thin
  project.service.ts              ← lógica + Prisma
  __tests__/
    project.service.test.ts       ← unit tests
    project.integration.test.ts   ← integration flow
```

### Frontend (apps/web/)
```
app/(dashboard)/projects/
  page.tsx                        ← listado server component
  new/page.tsx                    ← crear proyecto server component
  [id]/page.tsx                   ← detalle server component
components/projects/
  project-form.tsx                ← "use client" — RHF + Zod
  project-card.tsx                ← card con status badge
  project-list.tsx                ← grid + paginación + filtros
  project-detail.tsx              ← header + progress
  project-tabs.tsx                ← tabs (placeholder M5/M6)
  delete-project-modal.tsx        ← confirmación con nombre
hooks/
  use-projects.ts                 ← fetch/create/update/delete
```

---

## Registrar módulo en app.ts

```typescript
// apps/api/src/app.ts — añadir después del auth plugin
import projectRoutes from './modules/projects/project.routes.js';
// ...
await app.register(projectRoutes, { prefix: '/api/projects' });
```

---

## Ejemplos de request

### Crear proyecto
```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  --cookie "access_token=<token>" \
  -d '{
    "name": "E-commerce Sistema",
    "description": "Plataforma de venta online con carrito, pagos y panel admin",
    "stack": "node-react",
    "config": {
      "model": "claude-3-5-sonnet-20241022",
      "agents": ["dba","seed","backend","frontend","qa","security","docs","deploy","integration"]
    }
  }'
```

### Listar proyectos (con paginación)
```bash
curl "http://localhost:3001/api/projects?page=1&limit=12&search=ecomm" \
  --cookie "access_token=<token>"
```

### Iniciar generación (stub)
```bash
curl -X POST http://localhost:3001/api/projects/<id>/start \
  --cookie "access_token=<token>"
# Response: { "data": { "id": "...", "status": "running" } }
```

---

## Zod dual refine (config.agents)

```typescript
const configSchema = z.object({
  model: z.string().min(1),
  agents: z.array(z.string()).min(1),
}).refine(
  (data) => ['seed', 'security', 'integration'].every(a => data.agents.includes(a)),
  { message: 'seed, security e integration son obligatorios', path: ['agents'] }
).refine(
  (data) => ['dba','backend','frontend','qa','docs','deploy'].some(a => data.agents.includes(a)),
  { message: 'Al menos un agente generador es requerido', path: ['agents'] }
);
```

---

## Status transitions (state machine)

```
idle ──/start──► running ──/pause──► paused ──/continue──► running
                    │
                    ├──[agente OK]──► done
                    └──[agente fail]► error
```

Validar en service antes de cada transición — retornar 409 si la transición no es válida.

---

## Error codes M2

| Code | HTTP | Descripción |
|------|------|-------------|
| `PROJECT_NOT_FOUND` | 404 | Proyecto no existe o no pertenece al usuario |
| `PROJECT_NOT_IDLE` | 409 | Update/delete requiere estado idle |
| `INVALID_TRANSITION` | 409 | Transición de estado no permitida |
| `PROJECT_RUNNING` | 409 | No se puede eliminar proyecto en ejecución |
