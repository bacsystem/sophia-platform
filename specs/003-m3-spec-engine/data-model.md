# Data Model — M3: Spec Engine

**Branch**: `003-m3-spec-engine` | **Date**: 2026-04-08

---

## ERD

```
┌──────────────────────────────────────┐
│              projects                 │
├──────────────────────────────────────┤
│ id          UUID    PK               │
│ user_id     UUID    FK → users.id    │
│ name        VARCHAR(255)             │
│ description TEXT                     │
│ status      VARCHAR(20)              │
│ ...                                  │
└────────┬─────────────────────────────┘
         │ 1
         │
         │ N
┌────────▼─────────────────────────────┐
│           project_specs               │
├──────────────────────────────────────┤
│ id          UUID    PK               │
│ project_id  UUID    FK → projects.id │
│ version     INT                      │
│ content     JSONB                    │◄── { spec, dataModel, apiDesign }
│ source      VARCHAR(20) 'generated'  │◄── 'generated' | 'manual'
│ valid       BOOLEAN  true            │
│ created_at  TIMESTAMPTZ              │
└──────────────────────────────────────┘

┌──────────────────────────────────────┐
│             templates                 │
├──────────────────────────────────────┤
│ id          UUID    PK               │
│ name        VARCHAR(255)             │
│ description TEXT                     │
│ icon        VARCHAR(50)              │◄── Lucide React component name
│ stack       VARCHAR(50)              │
│ tags        TEXT[]                   │
│ defaults    JSONB                    │◄── { agents: string[], model: string }
│ created_at  TIMESTAMPTZ              │
└──────────────────────────────────────┘
```

---

## Tablas

### project_specs

> Definida en M2. M3 agrega lógica de versionamiento y generación IA.

| Campo | Tipo Prisma | DB Type | Nullable | Default | Descripción |
|-------|-------------|---------|----------|---------|-------------|
| id | String @id | UUID | No | uuid() | PK |
| projectId | String | UUID | No | — | FK → projects.id (cascade delete) |
| version | Int | INT4 | No | — | Número incremental de versión |
| content | Json | JSONB | No | — | `{ spec, dataModel, apiDesign }` — strings markdown |
| source | String | VARCHAR(20) | No | "generated" | `"generated"` o `"manual"` |
| valid | Boolean | BOOL | No | true | `false` si validación de secciones falló |
| createdAt | DateTime | TIMESTAMPTZ | No | now() | Timestamp de creación |

**Constraints:**
- `@@unique([projectId, version])` — alias `uq_project_specs_version`
- `@@index([projectId])` — alias `idx_project_specs_project_id`
- `onDelete: Cascade` — borrar proyecto borra sus specs

**Content JSONB shape:**
```json
{
  "spec": "# Spec: Nombre del Proyecto\n\n## 1. Descripción\n...",
  "dataModel": "# Data Model\n\n## Entidades\n...",
  "apiDesign": "# API Design\n\n## Endpoints\n..."
}
```

---

### templates

> Tabla de solo lectura — seed data. CRUD de templates personalizados fuera de MVP.

| Campo | Tipo Prisma | DB Type | Nullable | Default | Descripción |
|-------|-------------|---------|----------|---------|-------------|
| id | String @id | UUID | No | uuid() | PK |
| name | String | VARCHAR(255) | No | — | Nombre del template |
| description | String | TEXT | No | — | Descripción breve del template |
| icon | String | VARCHAR(50) | No | — | Nombre del componente Lucide React |
| stack | String | VARCHAR(50) | No | — | Stack tecnológico principal |
| tags | String[] | TEXT[] | No | — | Etiquetas para filtrado |
| defaults | Json | JSONB | No | — | `{ agents: string[], model: string }` |
| createdAt | DateTime | TIMESTAMPTZ | No | now() | Timestamp de creación |

**Defaults JSONB shape:**
```json
{
  "agents": ["dba-agent", "backend-agent", "frontend-agent"],
  "model": "claude-opus-4-5"
}
```

---

## Prisma Schema

```prisma
model ProjectSpec {
  id        String   @id @default(uuid())
  projectId String   @map("project_id")
  version   Int
  content   Json
  source    String   @default("generated") @db.VarChar(20)
  valid     Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, version], name: "uq_project_specs_version")
  @@index([projectId], name: "idx_project_specs_project_id")
  @@map("project_specs")
}

model Template {
  id          String   @id @default(uuid())
  name        String   @db.VarChar(255)
  description String
  icon        String   @db.VarChar(50)
  stack       String   @db.VarChar(50)
  tags        String[]
  defaults    Json
  createdAt   DateTime @default(now()) @map("created_at")

  @@map("templates")
}
```

---

## Migraciones

M3 no requiere nuevas migraciones de esquema — la tabla `project_specs` fue creada en M2. Solo se requiere el seed de templates:

```bash
pnpm db:migrate   # No aplica para M3 (sin schema changes)
pnpm db:seed      # Inserta los 5 templates predefinidos
```

---

## Seed Data — Templates

| id | name | icon | stack | tags |
|----|------|------|-------|------|
| (uuid) | ERP Módulo | Building2 | Node.js + React | erp, crud, roles |
| (uuid) | SaaS Starter | Rocket | Node.js + React | saas, multi-tenant, billing |
| (uuid) | REST API | Plug | Node.js | api, rest, backend |
| (uuid) | Landing + Admin | Monitor | React + Node.js | landing, admin, cms |
| (uuid) | EdTech | BookOpen | Node.js + React | education, courses, lms |

---

## Índices y Performance

| Tabla | Índice | Tipo | Propósito |
|-------|--------|------|-----------|
| project_specs | `idx_project_specs_project_id` | BTREE | Listar versiones de un proyecto |
| project_specs | `uq_project_specs_version` | UNIQUE | Integridad de versiones por proyecto |
| templates | (ninguno extra) | — | Tabla pequeña (~5 filas), tabla scan aceptable |
