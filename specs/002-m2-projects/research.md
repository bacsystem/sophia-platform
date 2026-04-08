# Research: M2 Projects

**Branch**: `002-m2-projects` | **Date**: 2026-04-08

---

## Decisiones Técnicas

### 1. Máquina de estados (status field)

**Opciones evaluadas:**
- `VARCHAR(20)` con constraint CHECK en Prisma
- Enum PostgreSQL
- Tabla de estados separada

**Decisión:** `String` con validación Zod en capa de aplicación. Enum en TypeScript compartido en `@sophia/shared`.

**Razón:** Flexibilidad para que M4 extienda transiciones sin migración de schema. Validación centralizada en Zod.

**Transiciones válidas:**
```
idle → running (via /start)
running → paused (via /pause)
paused → running (via /continue)
running → done    (automático via agente)
running → error   (automático via agente)
```

### 2. Paginación

**Decisión:** OFFSET/LIMIT server-side, 12 items/página (grid 3 columnas, 4 filas).

**Razón:** Simple, predecible. Cursor pagination innecesario para MVP (< 1000 proyectos por usuario).

**Response format:**
```json
{ "data": [...], "meta": { "total": 42, "page": 1, "limit": 12, "pages": 4 } }
```

### 3. ILIKE vs Full-text search

**Decisión:** ILIKE en `name` y `description`. Sin índice adicional en MVP.

**Razón:** Dataset pequeño (< 100 proyectos por usuario). Full-text search es over-engineering para MVP.

**Trade-off:** Performance ≤ 300ms p95 a escala de usuario individual.

### 4. Soft Delete

**Decisión:** Campo `deleted_at TIMESTAMPTZ`. Todas las queries filtran `WHERE deleted_at IS NULL`.

**Razón:** Permite recuperación accidental y auditoría. Prisma no tiene soporte nativo; se añade manualmente en cada service method.

**Alternativa descartada:** `isDeleted BOOLEAN` — menos información, mismo esfuerzo.

### 5. Config JSONB

**Decisión:** `config JSONB` almacena `{ model: string, agents: string[] }`.

**Razón:** Flexibilidad para M4 añadir campos sin migración. TypeScript type en `@sophia/shared`.

**Validación:** Zod schema con dual refine:
- Agentes obligatorios: `seed`, `security`, `integration`
- Al menos 1 agente generador: `dba`, `backend`, `frontend`, `qa`, `docs`, `deploy`

### 6. Dashboard route group

**Decisión:** `apps/web/app/(dashboard)/projects/` como route group.

**Razón:** Compartirá layout con M5 (Dashboard), M6 (File Manager). Permite protección de rutas en un solo middleware point.

**Layout**: M5 implementará `(dashboard)/layout.tsx`. M2 crea páginas sin layout propio (usa el default).

### 7. Ownership validation

**Decisión:** Cada endpoint verifica `project.userId === req.user.id` después de `findUnique`.

**Razón:** No exponer proyectos de otros usuarios. 404 en lugar de 403 para no filtrar existencia.

---

## Librerías

| Libería | Versión | Propósito |
|---------|---------|-----------|
| Prisma | ^6.x | ORM (ya instalado en M1) |
| Zod | ^3.x | Validación (ya instalado) |
| React Hook Form | ^7.x | Formularios frontend (ya instalado) |
| shadcn/ui | latest | Componentes UI (ya instalado) |
| @hookform/resolvers | ^3.x | Integración RHF+Zod (ya instalado) |

**Sin dependencias nuevas** — M2 reutiliza todo el stack de M1.

---

## Constraints identificados

- M2 **no implementa WebSocket** — progress en tiempo real es M4
- GET /download retorna 501 — implementado en M6
- `current_layer` es `REAL` (float) para mostrar sub-etapas (ej. 1.5 = entre capa 1 y 2)
- `project_specs` almacena historial de versiones del spec — útil para M3
