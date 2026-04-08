## Tarea

Genera datos de prueba para el entorno de desarrollo.

## Pasos

1. `readFile` de `apps/api/prisma/schema.prisma` → entender todas las tablas, campos, relaciones y enums
2. Generar `apps/api/prisma/seed.ts`:
   - Importar PrismaClient y bcrypt
   - Crear usuarios de prueba (3)
   - Crear proyectos asociados a usuarios (3 por usuario regular)
   - Crear specs para proyectos que las necesiten
   - Crear agent_logs para proyecto completed (6 logs, uno por capa)
   - Crear generated_files para proyecto completed
   - Usar `upsert` por email para idempotencia
   - Agregar `main().catch(console.error).finally(() => prisma.$disconnect())`
3. Generar `apps/api/src/test-utils/factories.ts`:
   - Factory para cada tabla principal: user, project, spec, agentLog, generatedFile
   - Cada factory recibe `overrides` opcional
   - Genera datos únicos (email con timestamp, nombres aleatorios)
4. Generar `apps/api/src/test-utils/test-constants.ts`:
   - UUIDs fijos para tests (ADMIN_USER_ID, REGULAR_USER_ID, etc.)
   - Datos de referencia constantes
5. `taskComplete` con resumen de archivos generados

## Verificación

Antes de generar, verifica que:
- Cada FK en seed.ts apunta a un registro que se crea antes
- Los enums usados coinciden con los del schema.prisma
- Los campos obligatorios están todos presentes
- No hay UUIDs duplicados
