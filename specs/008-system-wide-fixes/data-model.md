# Data Model: Correcciones del Sistema — Errores Runtime

**Branch**: `008-system-wide-fixes` | **Date**: 2026-04-09

## Resumen

Este feature NO requiere cambios en el esquema de base de datos (Prisma). Las correcciones son de resiliencia, manejo de errores, y experiencia de usuario. Las entidades afectadas ya existen en el schema actual.

## Entidades Existentes Involucradas

### 1. UserSettings

```prisma
model UserSettings {
  id                        String   @id @default(uuid())
  userId                    String   @unique @map("user_id")
  anthropicApiKeyEncrypted  String?  @map("anthropic_api_key_encrypted")
  anthropicApiKeyIv         String?  @map("anthropic_api_key_iv")
  anthropicApiKeyTag        String?  @map("anthropic_api_key_tag")
  anthropicApiKeyLast4      String?  @map("anthropic_api_key_last4")
  apiKeyVerifiedAt          DateTime? @map("api_key_verified_at")
  // ...
  user User @relation(fields: [userId], references: [id])
  @@map("user_settings")
}
```

**Cambios**: Ninguno. La verificación mejorada (retry + mensajes diferenciados) opera sobre el mismo flujo de lectura/escritura existente.

### 2. ProjectSpec (indirecta)

```prisma
model ProjectSpec {
  id        String   @id @default(uuid())
  projectId String   @map("project_id")
  version   Int
  content   Json
  source    String   @default("generated")
  valid     Boolean  @default(false)
  // ...
  project Project @relation(fields: [projectId], references: [id])
  @@map("project_specs")
}
```

**Cambios**: Ninguno. La mejora de propagación de errores opera sobre el canal SSE en memoria, no sobre el modelo.

## Entidades In-Memory (No Persistidas)

### 3. SpecJob (in-memory store)

```typescript
interface SpecJob {
  jobId: string;
  projectId: string;
  status: 'running' | 'done' | 'error';
  events: SseEvent[];
  listeners: Set<(event: SseEvent) => void>;
}
```

**Cambios lógicos** (no schema):
- Clasificación mejorada de errores emitidos en `events[]`
- Pre-validación antes de crear el job (ANTHROPIC_API_KEY check)

### 4. SseEvent (tipos)

```typescript
export type SseEvent =
  | { type: 'start'; file: string; step: number; totalSteps: number }
  | { type: 'chunk'; file: string; content: string }
  | { type: 'validated'; file: string; valid: boolean }
  | { type: 'done'; version: number; files: string[] }
  | { type: 'error'; file: string; message: string; retryable: boolean };
```

**Cambios**: Ninguno al tipo — los mensajes se mejoran semánticamente sin cambiar la estructura.

## Nuevas Entidades

Ninguna.

## Migraciones Requeridas

Ninguna.

## Decisión

No se requiere `prisma migrate dev` para este feature. Todas las correcciones son a nivel de lógica de aplicación, manejo de errores, y frontend.
