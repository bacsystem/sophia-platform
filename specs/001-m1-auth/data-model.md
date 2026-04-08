# Data Model — M1: Auth

**Branch**: `001-m1-auth` | **Date**: 2026-04-08

---

## ERD

```
┌─────────────────────────┐
│         users            │
├─────────────────────────┤
│ id          UUID    PK   │
│ name        VARCHAR(100) │
│ email       VARCHAR(255) │◄── UNIQUE
│ password    VARCHAR(255) │    bcrypt cost 12
│ created_at  TIMESTAMPTZ  │
│ updated_at  TIMESTAMPTZ  │
└────────┬────────────────┘
         │ 1
         │
         ├──────────────────┐
         │ N                │ N
┌────────▼────────────────┐ ┌────────▼──────────────────┐
│    refresh_tokens        │ │  password_reset_tokens     │
├─────────────────────────┤ ├───────────────────────────┤
│ id          UUID    PK   │ │ id          UUID    PK     │
│ user_id     UUID    FK   │ │ user_id     UUID    FK     │
│ token       VARCHAR(255) │ │ token       VARCHAR(255)   │
│ expires_at  TIMESTAMPTZ  │ │ expires_at  TIMESTAMPTZ    │
│ revoked_at  TIMESTAMPTZ? │ │ used_at     TIMESTAMPTZ?   │
│ created_at  TIMESTAMPTZ  │ │ created_at  TIMESTAMPTZ    │
└─────────────────────────┘ └───────────────────────────┘
```

## Tablas

### users

| Campo | Tipo | Nullable | Default | Prisma Field | Descripción |
|-------|------|----------|---------|-------------|-------------|
| id | UUID | No | `gen_random_uuid()` | `id String @id @default(uuid())` | Primary key |
| name | VARCHAR(100) | No | — | `name String @db.VarChar(100)` | Nombre completo |
| email | VARCHAR(255) | No | — | `email String @unique @db.VarChar(255)` | Email único |
| password | VARCHAR(255) | No | — | `password String @db.VarChar(255)` | Hash bcrypt cost 12 |
| created_at | TIMESTAMPTZ | No | `now()` | `createdAt DateTime @default(now()) @map("created_at")` | — |
| updated_at | TIMESTAMPTZ | No | `now()` | `updatedAt DateTime @updatedAt @map("updated_at")` | — |

**Índices**: UNIQUE(`email`)

### refresh_tokens

| Campo | Tipo | Nullable | Default | Prisma Field | Descripción |
|-------|------|----------|---------|-------------|-------------|
| id | UUID | No | `gen_random_uuid()` | `id String @id @default(uuid())` | Primary key |
| user_id | UUID | No | — | `userId String @map("user_id")` | FK → users |
| token | VARCHAR(255) | No | — | `token String @db.VarChar(255)` | SHA-256 del refresh token |
| expires_at | TIMESTAMPTZ | No | — | `expiresAt DateTime @map("expires_at")` | 24h o 30d según rememberMe |
| revoked_at | TIMESTAMPTZ | Sí | null | `revokedAt DateTime? @map("revoked_at")` | null=activo, fecha=revocado |
| created_at | TIMESTAMPTZ | No | `now()` | `createdAt DateTime @default(now()) @map("created_at")` | — |

**Índices**: INDEX(`token`), INDEX(`user_id`), INDEX(`expires_at`)

**Relaciones**: `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`

### password_reset_tokens

| Campo | Tipo | Nullable | Default | Prisma Field | Descripción |
|-------|------|----------|---------|-------------|-------------|
| id | UUID | No | `gen_random_uuid()` | `id String @id @default(uuid())` | Primary key |
| user_id | UUID | No | — | `userId String @map("user_id")` | FK → users |
| token | VARCHAR(255) | No | — | `token String @db.VarChar(255)` | SHA-256 del token |
| expires_at | TIMESTAMPTZ | No | — | `expiresAt DateTime @map("expires_at")` | 1 hora desde creación |
| used_at | TIMESTAMPTZ | Sí | null | `usedAt DateTime? @map("used_at")` | null=no usado |
| created_at | TIMESTAMPTZ | No | `now()` | `createdAt DateTime @default(now()) @map("created_at")` | — |

**Índices**: INDEX(`token`), INDEX(`user_id`)

**Relaciones**: `user User @relation(fields: [userId], references: [id], onDelete: Cascade)`

## Redis Keys (Rate Limiting)

| Key Pattern | Value | TTL | Propósito |
|-------------|-------|-----|-----------|
| `auth:attempts:{email}` | int counter | 900s (15 min) | Login: max 5 intentos |
| `auth:register:{ip}` | int counter | 3600s (1 hora) | Register: max 3/hora |
| `auth:reset:{email}` | int counter | 3600s (1 hora) | Forgot password: max 3/hora |

## Prisma Schema Fragment

```prisma
model User {
  id        String   @id @default(uuid())
  name      String   @db.VarChar(100)
  email     String   @unique @db.VarChar(255)
  password  String   @db.VarChar(255)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  refreshTokens       RefreshToken[]
  passwordResetTokens  PasswordResetToken[]

  @@map("users")
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  token     String    @db.VarChar(255)
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@index([expiresAt])
  @@map("refresh_tokens")
}

model PasswordResetToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  token     String    @db.VarChar(255)
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@map("password_reset_tokens")
}
```
