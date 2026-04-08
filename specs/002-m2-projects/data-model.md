# Data Model: M2 Projects

**Branch**: `002-m2-projects` | **Date**: 2026-04-08

---

## Tablas

### `projects`

| Campo | Tipo Prisma | DB Type | Constraints | Descripción |
|-------|-------------|---------|-------------|-------------|
| `id` | `String @id @default(uuid())` | UUID PK | NOT NULL | Identificador único |
| `userId` | `String @map("user_id")` | UUID | FK → users(id) | Propietario |
| `name` | `String` | VARCHAR(100) | NOT NULL | Nombre del proyecto |
| `description` | `String` | TEXT | NOT NULL | Descripción del sistema a generar |
| `stack` | `String` | VARCHAR(50) | NOT NULL | Stack tecnológico (ej. "node-react") |
| `status` | `String @default("idle")` | VARCHAR(20) | NOT NULL | Estado de ejecución |
| `progress` | `Int @default(0)` | INTEGER | NOT NULL | Progreso 0-100 |
| `currentLayer` | `Float @default(1) @map("current_layer")` | REAL | NOT NULL | Capa actual del pipeline |
| `config` | `Json` | JSONB | NOT NULL | `{ model: string, agents: string[] }` |
| `tokensUsed` | `Int @default(0) @map("tokens_used")` | INTEGER | NOT NULL | Tokens acumulados (actualizado por M4) |
| `errorMessage` | `String? @map("error_message")` | TEXT | nullable | Mensaje del último error (actualizado por M4) |
| `deletedAt` | `DateTime? @map("deleted_at")` | TIMESTAMPTZ | nullable | Soft delete timestamp |
| `createdAt` | `DateTime @default(now()) @map("created_at")` | TIMESTAMPTZ | NOT NULL | |
| `updatedAt` | `DateTime @updatedAt @map("updated_at")` | TIMESTAMPTZ | NOT NULL | |

**Índices:**
- `idx_projects_user_id` — búsqueda por usuario
- `idx_projects_status` — filtrado por status
- `idx_projects_deleted_at` — donde `deleted_at IS NULL` en WHERE común

### `project_specs`

| Campo | Tipo Prisma | DB Type | Constraints | Descripción |
|-------|-------------|---------|-------------|-------------|
| `id` | `String @id @default(uuid())` | UUID PK | NOT NULL | |
| `projectId` | `String @map("project_id")` | UUID | FK → projects(id) CASCADE | |
| `version` | `Int` | INTEGER | NOT NULL | Auto-incremental por proyecto |
| `content` | `Json` | JSONB | NOT NULL | `{ spec, dataModel, apiDesign }` |
| `createdAt` | `DateTime @default(now()) @map("created_at")` | TIMESTAMPTZ | NOT NULL | |

**Índices:**
- `idx_project_specs_project_id` — lookup por proyecto
- `UNIQUE(project_id, version)` — evitar duplicados de versión

---

## Prisma Schema

```prisma
model Project {
  id           String    @id @default(uuid())
  userId       String    @map("user_id")
  name         String    @db.VarChar(100)
  description  String
  stack        String    @db.VarChar(50)
  status       String    @default("idle") @db.VarChar(20)
  progress     Int       @default(0)
  currentLayer Float     @default(1) @map("current_layer")
  config       Json
  tokensUsed   Int       @default(0) @map("tokens_used")
  errorMessage String?   @map("error_message")
  deletedAt    DateTime? @map("deleted_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  user  User          @relation(fields: [userId], references: [id])
  specs ProjectSpec[]

  @@index([userId], name: "idx_projects_user_id")
  @@index([status], name: "idx_projects_status")
  @@index([deletedAt], name: "idx_projects_deleted_at")
  @@map("projects")
}

model ProjectSpec {
  id        String   @id @default(uuid())
  projectId String   @map("project_id")
  version   Int
  content   Json
  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, version], name: "uq_project_specs_version")
  @@index([projectId], name: "idx_project_specs_project_id")
  @@map("project_specs")
}
```

---

## Relaciones

```
users (M1)
  └──< projects (M2)
         └──< project_specs (M2)
```

- `users.id` → `projects.user_id` (ON DELETE RESTRICT — no borrar usuario con proyectos)
- `projects.id` → `project_specs.project_id` (ON DELETE CASCADE — spec se borra con proyecto)

---

## Estado válidos (`status`)

```typescript
type ProjectStatus = 'idle' | 'running' | 'paused' | 'done' | 'error';
```

## Config JSONB shape

```typescript
interface ProjectConfig {
  model: string;      // ej. "claude-3-5-sonnet-20241022"
  agents: string[];   // ej. ["dba", "seed", "backend", "frontend", "qa", "security", "docs", "deploy", "integration"]
}
```

**Agentes obligatorios:** `seed`, `security`, `integration`
**Agentes generadores (≥1 requerido):** `dba`, `backend`, `frontend`, `qa`, `docs`, `deploy`
