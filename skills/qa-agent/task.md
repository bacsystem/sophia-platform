Genera tests para el proyecto.

## Entrada

Recibirás:
1. `spec.md` — Criterios de aceptación (son los test cases)
2. Archivos de Layer 2 (Backend) — services, controllers a testear
3. Archivos de Layer 3 (Frontend) — components, hooks a testear

## Archivos a crear

Backend:
- `src/modules/{modulo}/__tests__/{modulo}.service.test.ts`
- `src/modules/{modulo}/__tests__/{modulo}.routes.test.ts` — Integration con `app.inject()`

Frontend:
- `components/{modulo}/__tests__/*.test.tsx`
- `hooks/__tests__/*.test.ts`

Helpers:
- `tests/helpers/app.ts` — Builder de app Fastify para tests
- `tests/helpers/auth.ts` — Crear usuario test + obtener cookie auth

## Reglas

- Cada criterio de aceptación de una HU = al menos 1 test case
- Backend integration: usa `app.inject()`, auth via cookie (NO Bearer)
- Frontend: Vitest + Testing Library, mock fetch calls
- Usa `createFile` para cada archivo
- Al terminar, llama `taskComplete`
