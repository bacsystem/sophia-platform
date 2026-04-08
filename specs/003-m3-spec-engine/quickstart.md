# Quickstart — M3: Spec Engine

**Branch**: `003-m3-spec-engine` | **Date**: 2026-04-08

---

## Pre-requisitos

- Node.js 22+
- pnpm 9+
- PostgreSQL 16 corriendo localmente (con M2 migrado)
- Redis 7 corriendo localmente
- Variable `ANTHROPIC_API_KEY` configurada

## Setup rápido

```bash
# 1. Asegúrate de estar en la branch correcta
git checkout 003-m3-spec-engine

# 2. Instalar dependencias (incluyendo @uiw/react-md-editor)
pnpm install

# 3. Ejecutar seed de templates (requiere DB ya migrada desde M2)
pnpm --filter @sophia/api db:seed

# 4. Iniciar en modo desarrollo
pnpm dev
```

## Variables de entorno requeridas (apps/api/.env)

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/sophia_dev
REDIS_URL=redis://localhost:6379
JWT_ACCESS_SECRET=<random-32-chars>
JWT_REFRESH_SECRET=<random-32-chars>
ENCRYPTION_KEY=<64-hex-chars>
ANTHROPIC_API_KEY=sk-ant-...     # NUEVO en M3
FRONTEND_URL=http://localhost:3000
PORT=3001
```

## URLs locales

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Templates | http://localhost:3000/projects/new (galería de templates) |
| Spec viewer | http://localhost:3000/projects/:id (tab "Spec") |

## Flujo de prueba manual

### 1. Generar un spec

```bash
# Crear proyecto (requiere login previo — M1)
curl -X POST http://localhost:3001/api/projects \
  -H "Content-Type: application/json" \
  -b "access_token=<jwt>" \
  -d '{"name":"Test Project","description":"Un sistema de gestión de inventarios con CRUD de productos, categorías y reportes de stock","stack":"Node.js + React","agents":["dba-agent","backend-agent","frontend-agent"]}'

# Iniciar generación de spec (responde 202 + jobId)
curl -X POST http://localhost:3001/api/projects/<id>/spec/generate \
  -b "access_token=<jwt>"

# Ver progreso vía SSE
curl -N -H "Accept: text/event-stream" \
  "http://localhost:3001/api/projects/<id>/spec/stream?jobId=<jobId>" \
  -b "access_token=<jwt>"
```

### 2. Ver/editar spec generado

1. Ir a `http://localhost:3000/projects/<id>`
2. Hacer clic en la tab **"Spec"**
3. El spec renderizado aparece en 3 sub-tabs: `spec.md | data-model.md | api-design.md`
4. Botón **"Editar"** → editor markdown con preview
5. Botón **"Guardar versión"** → crea nueva versión
6. Dropdown de versiones → navegar historial

### 3. Usar un template

1. Ir a `http://localhost:3000/projects/new`
2. La galería de 5 templates aparece en la parte superior del formulario
3. Hacer clic en un template → pre-llena nombre, descripción, stack y agentes
4. Modificar valores y crear el proyecto

## Comandos de desarrollo

```bash
# Lint
pnpm --filter @sophia/api lint
pnpm --filter @sophia/web lint

# Build
pnpm --filter @sophia/api build
pnpm --filter @sophia/web build

# Tests
pnpm --filter @sophia/api test

# Clean build (si hay cambios en páginas)
rm -rf apps/web/.next && pnpm --filter @sophia/web build
```

## Módulos involucrados en M3

| Módulo | Archivos clave |
|--------|---------------|
| Backend spec | `apps/api/src/modules/spec/` |
| Backend templates | `apps/api/src/modules/templates/` |
| Frontend spec viewer | `apps/web/components/spec/` |
| Frontend orchestrator | `apps/web/components/projects/project-spec-viewer.tsx` |
| Hook SSE | `apps/web/hooks/use-spec-stream.ts` |
| Prompts IA | `skills/spec-agent/` |
| Seed templates | `apps/api/prisma/seed.ts` |

## Troubleshooting

| Problema | Solución |
|----------|----------|
| `ANTHROPIC_API_KEY` no configurada | Agregar la variable en `apps/api/.env` |
| Templates no aparecen en DB | Ejecutar `pnpm --filter @sophia/api db:seed` |
| Editor markdown no carga | Normal — usa `dynamic()` con `ssr: false`, hay un breve flash |
| Rate limit 429 | Esperar 1 hora (por proyecto) o 24h (por usuario) |
| SSE se desconecta | El browser reconecta automáticamente con replay de eventos buffer |
