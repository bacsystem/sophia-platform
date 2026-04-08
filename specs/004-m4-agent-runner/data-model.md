# Data Model: M4 Agent Runner

## Tablas nuevas

### `user_settings` (Sprint 2.5 prerequisito — reutilizado por M7)

```prisma
model UserSettings {
  id                        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId                    String   @unique @map("user_id") @db.Uuid
  anthropicApiKeyEncrypted  String?  @map("anthropic_api_key_encrypted")
  anthropicApiKeyIv         String?  @map("anthropic_api_key_iv")
  anthropicApiKeyTag        String?  @map("anthropic_api_key_tag")
  anthropicApiKeyLast4      String?  @map("anthropic_api_key_last4") @db.VarChar(4)
  createdAt                 DateTime @default(now()) @map("created_at")
  updatedAt                 DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("user_settings")
}
```

**Índices**: `userId` UNIQUE (ya incluido en modelo)

---

### `agents`

```prisma
model Agent {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId    String    @map("project_id") @db.Uuid
  type         String    @db.VarChar(20)   // dba, seed, backend, frontend, qa, security, docs, deploy, integration
  status       String    @default("idle") @db.VarChar(20)  // idle, queued, working, done, error, paused
  progress     Int       @default(0)
  currentTask  String?   @map("current_task")
  tokensInput  Int       @default(0) @map("tokens_input")
  tokensOutput Int       @default(0) @map("tokens_output")
  layer        Float                              // 1, 1.5, 2, 3, 4, 4.5, 5, 6, 7
  error        String?
  startedAt    DateTime? @map("started_at")
  completedAt  DateTime? @map("completed_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  project        Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  logs           AgentLog[]
  generatedFiles GeneratedFile[]

  @@unique([projectId, type], name: "uq_agents_project_type")
  @@index([projectId], name: "idx_agents_project_id")
  @@index([projectId, status], name: "idx_agents_project_status")
  @@map("agents")
}
```

---

### `agent_logs`

```prisma
model AgentLog {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  agentId   String   @map("agent_id") @db.Uuid
  projectId String   @map("project_id") @db.Uuid
  type      String   @db.VarChar(10)  // info, ok, warn, error
  message   String
  createdAt DateTime @default(now()) @map("created_at")

  agent   Agent   @relation(fields: [agentId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId], name: "idx_agent_logs_project_id")
  @@index([projectId, createdAt], name: "idx_agent_logs_project_created")
  @@index([projectId, type], name: "idx_agent_logs_project_type")
  @@map("agent_logs")
}
```

---

### `generated_files`

```prisma
model GeneratedFile {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId String   @map("project_id") @db.Uuid
  agentId   String   @map("agent_id") @db.Uuid
  name      String   @db.VarChar(255)
  path      String                           // Ruta relativa dentro del proyecto
  sizeBytes Int      @map("size_bytes")
  layer     Float                            // 1, 1.5, 2, 3, 4, 4.5, 5, 6, 7
  createdAt DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  agent   Agent   @relation(fields: [agentId], references: [id], onDelete: Cascade)

  @@index([projectId], name: "idx_generated_files_project_id")
  @@index([projectId, agentId], name: "idx_generated_files_project_agent")
  @@index([projectId, layer], name: "idx_generated_files_project_layer")
  @@map("generated_files")
}
```

---

## Relaciones

```
User ─── user_settings (1:1)
Project ─── agents (1:N)
Project ─── agent_logs (1:N, denorm)
Project ─── generated_files (1:N, denorm)
Agent ─── agent_logs (1:N)
Agent ─── generated_files (1:N)
```

## Cambios en modelos existentes

### `User` — añadir relación

```prisma
settings UserSettings?
```

### `Project` — añadir relaciones

```prisma
agents         Agent[]
agentLogs      AgentLog[]
generatedFiles GeneratedFile[]
```

## ERD Completo (M4 additions)

```
┌──────────────────────────────────────────────────────────────────────┐
│  user_settings                                                        │
│  id PK, user_id FK UNIQUE, anthropic_api_key_encrypted,              │
│  anthropic_api_key_iv, anthropic_api_key_tag, anthropic_api_key_last4│
└──────────────────────────────────────────────────────────────────────┘
         ↑ 1:1
┌────────────────────────────────────────────────────────────────────┐
│  agents                                                             │
│  id PK, project_id FK, type, status, progress, current_task,       │
│  tokens_input, tokens_output, layer, error, started_at, completed_at│
└────────────────────────────────────────────────────────────────────┘
         ↑ 1:N
┌─────────────────────────────────────────────────────────────────┐
│  agent_logs                                                      │
│  id PK, agent_id FK, project_id FK, type, message, created_at   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  generated_files                                                 │
│  id PK, project_id FK, agent_id FK, name, path, size_bytes,     │
│  layer, created_at                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Migración

Nombre: `20260408_m4_agent_runner`

```sql
-- Tabla user_settings
CREATE TABLE "user_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
  "anthropic_api_key_encrypted" TEXT,
  "anthropic_api_key_iv" TEXT,
  "anthropic_api_key_tag" TEXT,
  "anthropic_api_key_last4" VARCHAR(4),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla agents
CREATE TABLE "agents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "type" VARCHAR(20) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'idle',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "current_task" TEXT,
  "tokens_input" INTEGER NOT NULL DEFAULT 0,
  "tokens_output" INTEGER NOT NULL DEFAULT 0,
  "layer" REAL NOT NULL,
  "error" TEXT,
  "started_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE("project_id", "type")
);
CREATE INDEX "idx_agents_project_id" ON "agents"("project_id");
CREATE INDEX "idx_agents_project_status" ON "agents"("project_id", "status");

-- Tabla agent_logs
CREATE TABLE "agent_logs" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "agent_id" UUID NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "type" VARCHAR(10) NOT NULL,
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "idx_agent_logs_project_id" ON "agent_logs"("project_id");
CREATE INDEX "idx_agent_logs_project_created" ON "agent_logs"("project_id", "created_at");
CREATE INDEX "idx_agent_logs_project_type" ON "agent_logs"("project_id", "type");

-- Tabla generated_files
CREATE TABLE "generated_files" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "agent_id" UUID NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "path" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "layer" REAL NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX "idx_generated_files_project_id" ON "generated_files"("project_id");
CREATE INDEX "idx_generated_files_project_agent" ON "generated_files"("project_id", "agent_id");
CREATE INDEX "idx_generated_files_project_layer" ON "generated_files"("project_id", "layer");
```
