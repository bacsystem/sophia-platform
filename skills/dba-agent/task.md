Genera el schema de base de datos para este proyecto.

## Entrada

Recibirás:
1. `spec.md` — Requerimientos funcionales y modelo de datos

## Archivos a crear

- `prisma/schema.prisma` — Schema completo de Prisma con @map y @@map
- `prisma/migrations/001_init/migration.sql` — Migración SQL inicial
- `prisma/seed.ts` — Datos iniciales si aplica

## Convenciones

- Campos Prisma en camelCase, mapeados a snake_case: `userId @map("user_id")`
- Tablas mapeadas: `@@map("users")`
- UUID como PK: `id String @id @default(uuid())`
- Timestamps: `createdAt DateTime @default(now()) @map("created_at")`
- FK siempre indexadas: `@@index([userId])`
- onDelete: Cascade en padre-hijo, SetNull cuando FK opcional

## Reglas

- Lee `spec.md` primero para entender entidades y relaciones
- Verifica el schema existente con `readFile` para no duplicar modelos
- Usa `createFile` para cada archivo
- Al terminar, llama `taskComplete` con resumen y lista de archivos
