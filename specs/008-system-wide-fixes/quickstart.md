# Quickstart: Correcciones del Sistema — Errores Runtime

**Branch**: `008-system-wide-fixes` | **Feature**: 008

## Prerequisitos

```bash
git checkout 008-system-wide-fixes
pnpm install
```

Verificar que el sistema base compila y los tests pasan:

```bash
pnpm --filter @sophia/api lint && pnpm --filter @sophia/api build && pnpm --filter @sophia/api test
pnpm --filter @sophia/web lint && pnpm --filter @sophia/web build
```

## Orden de Implementación

### Fase 1: Backend — API Key Verification (US1)

**Archivo**: `apps/api/src/modules/settings/settings.service.ts`

1. Modificar `verifyKeyWithAnthropic()` para agregar 1 retry con 1s delay
2. Diferenciar errores: `INVALID_KEY` | `TIMEOUT` | `NETWORK_ERROR`
3. Actualizar `saveApiKey()` para mapear los nuevos tipos de error a mensajes diferenciados
4. Lint → Build → Test

### Fase 2: Backend — Spec Generation Error Handling (US2)

**Archivos**:
- `apps/api/src/modules/spec/spec.service.ts`
- `apps/api/src/lib/anthropic.ts` (opcional: no cambiar si pre-validación es suficiente)

1. Agregar pre-validación de `ANTHROPIC_API_KEY` en `startSpecGeneration()` — lanzar HTTP 503 si no existe
2. Mejorar mensajes de error en catch de `runGeneration()` — clasificar errores de configuración vs transitorios
3. Lint → Build → Test

### Fase 3: Backend — Session Endpoint (US3)

**Archivos**:
- `apps/api/src/modules/auth/auth.routes.ts`
- `apps/api/src/modules/auth/auth.controller.ts`
- `apps/api/src/modules/auth/auth.service.ts`

1. Agregar `GET /api/auth/session` que decodifica access_token y retorna `{ expiresAt, user }`
2. Lint → Build → Test

### Fase 4: Frontend — Proactive Token Refresh (US3)

**Archivos**:
- `apps/web/hooks/use-token-refresh.ts` (nuevo)
- `apps/web/app/(dashboard)/layout.tsx` (agregar hook)

1. Crear `useTokenRefresh()` hook que llama `GET /api/auth/session` y configura timer
2. Integrar en layout del dashboard
3. Lint → Build

### Fase 5: Frontend — Error Handling en Spec Generation (US2)

**Archivos**: Componentes de spec generation en `apps/web/`

1. Verificar que el componente de spec generation escucha eventos `type: 'error'` del SSE
2. Mostrar mensaje de error y botón de reintentar en lugar de spinner
3. Lint → Build

### Fase 6: Dev Environment Script (US4)

**Archivo**: `package.json` (raíz)

1. Agregar script `"dev:clean": "rm -rf apps/web/.next && turbo dev"`
2. Documentar en README o CLAUDE.md

### Fase 7: Validación Final

```bash
pnpm --filter @sophia/api lint && pnpm --filter @sophia/api build && pnpm --filter @sophia/api test
pnpm --filter @sophia/web lint
rm -rf apps/web/.next && pnpm --filter @sophia/web build
```

## Archivos Clave (Context Map)

| Archivo | Motivo |
|---|---|
| `apps/api/src/modules/settings/settings.service.ts` | verifyKeyWithAnthropic + saveApiKey |
| `apps/api/src/modules/spec/spec.service.ts` | runGeneration + startSpecGeneration |
| `apps/api/src/modules/spec/spec.stream.ts` | SseEvent type, initSseStream |
| `apps/api/src/lib/anthropic.ts` | getAnthropicClient |
| `apps/api/src/lib/jwt.ts` | ACCESS_TTL_SECONDS |
| `apps/api/src/modules/auth/auth.routes.ts` | Nuevo endpoint /session |
| `apps/web/lib/api.ts` | refreshTokens, api() client |
| `apps/web/middleware.ts` | Server-side token refresh |
| `apps/web/hooks/use-token-refresh.ts` | Nuevo hook proactivo |
| `package.json` (raíz) | dev:clean script |

## Notas de Testing

- Los cambios en `settings.service.ts` y `spec.service.ts` deben pasar los tests existentes sin regresión
- El nuevo endpoint `GET /api/auth/session` necesita tests de integración
- El hook `useTokenRefresh` no necesita tests unitarios (es un timer simple) pero debe verificarse manualmente
- **Ejecutar `pnpm --filter @sophia/api test` después de cada fase backend**
