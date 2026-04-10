Genera tests para el proyecto.

## Entrada

Recibirás:
1. `spec.md` — Criterios de aceptación (son los test cases)
2. Archivos de Layer 2 (Backend) — services, controllers a testear
3. Archivos de Layer 3 (Frontend) — components, hooks a testear
4. `apps/api/src/test-utils/factories.ts` — Factories de datos de prueba generadas por seed-agent (Layer 1.5)
5. `apps/api/src/test-utils/test-constants.ts` — Constantes de test (IDs, emails, etc.)

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

## Último paso obligatorio: generar test-mapping.json

Antes de llamar `taskComplete`, crea el archivo `test-mapping.json` en la raíz del proyecto.

**Formato:**
```json
{
  "mappings": [
    {
      "criteriaId": "HU-14.CA-01",
      "testFile": "src/modules/agents/__tests__/agent.service.test.ts",
      "testName": "runs pipeline in correct order",
      "type": "unit"
    }
  ]
}
```

**Reglas del mapeo:**
- `criteriaId`: ID del criterio en formato `HU-XX.CA-NN` (de la spec.md)
- `testFile`: ruta relativa al archivo de test (desde la raíz del proyecto generado)
- `testName`: nombre exacto del test (`it('...')` o `test('...')`)
- `type`: `"unit"` o `"integration"`
- Si un criterio no tiene test: `{ "criteriaId": "HU-XX.CA-NN", "testFile": null, "testName": null, "type": null }`
- Incluir TODOS los criterios de la spec, incluso los sin test

Al terminar, llama `taskComplete`
