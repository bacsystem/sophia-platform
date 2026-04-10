# Research: Correcciones del Sistema — Errores Runtime

**Branch**: `008-system-wide-fixes` | **Date**: 2026-04-09

## R1: Diferenciación de Errores en Verificación de API Key

### Contexto

`verifyKeyWithAnthropic()` en `settings.service.ts` L383-414 usa `AbortController` con timeout de 5s. Actualmente, TODOS los errores no-HTTP (timeout, red, DNS) caen al mismo catch que retorna `UPSTREAM_UNAVAILABLE`. No hay retry.

### Decision: Retry con clasificación de errores

- **1 reintento automático** ante errores transitorios (timeout, network error)
- **3 estados de error diferenciados**:
  - `INVALID_KEY`: Anthropic respondió 401/403 → key inválida
  - `TIMEOUT`: AbortController timeout en ambos intentos → latencia extrema
  - `NETWORK_ERROR`: catch en ambos intentos sin ser timeout → red/DNS
- **Mantener 5s timeout por intento** (10s máximo total con retry)

### Rationale

El retry simple con backoff corto (1s) resuelve la mayoría de timeouts transitorios sin complejidad excesiva. La diferenciación de mensajes permite al usuario saber si debe revisar su key o esperar.

### Alternatives Considered

| Alternativa | Rechazada porque |
|---|---|
| Exponential backoff con 3 reintentos | Demasiada espera (>20s) para verificación interactiva |
| Circuit breaker | Sobre-ingeniería para un endpoint usado infrecuentemente |
| Guardar key sin verificar (lazy validation) | Cambia el contrato — spec requiere validación al guardar |

### Implementation

```typescript
// Modificar verifyKeyWithAnthropic para:
// 1. Intentar fetch con 5s timeout
// 2. Si falla por timeout o network → esperar 1s → reintentar
// 3. Clasificar error final como INVALID_KEY | TIMEOUT | NETWORK_ERROR
```

---

## R2: Propagación de Errores de Generación de Specs vía SSE

### Contexto

`runGeneration()` en `spec.service.ts` L184+ ya tiene try-catch que emite `{ type: 'error' }` al canal SSE. Sin embargo:
- `getAnthropicClient()` lanza `"ANTHROPIC_API_KEY is not set"` — error interno expuesto al usuario
- `retryable: true` para errores de configuración es incorrecto
- No hay pre-validación antes de lanzar el background job

### Decision: Pre-validación + clasificación de errores mejorada

1. **Validar existencia de `ANTHROPIC_API_KEY`** en `startSpecGeneration()` ANTES de `void runGeneration()` — fallo sincrónico con HTTP 503
2. **Mejorar mensajes de error** en el catch de `runGeneration()`:
   - Errores de autenticación → "Error de autenticación con Anthropic API"
   - Errores de configuración → "El servicio de generación no está disponible"
   - Errores transitorios → mensaje genérico con `retryable: true`
3. **Frontend**: verificar que el componente de spec generation escucha eventos `type: 'error'` y reemplaza el spinner

### Rationale

La pre-validación convierte un error silencioso de background en un error sincrónico visible inmediatamente. El catch mejorado cubre errores que ocurran durante la generación.

### Alternatives Considered

| Alternativa | Rechazada porque |
|---|---|
| Health check endpoint para Anthropic | Agrega complejidad; la pre-validación de env var es suficiente |
| Validar config al startup del server | No detecta cambios de env en runtime (aunque es infrecuente) |

---

## R3: Refresh Proactivo de Token de Acceso

### Contexto

- Access token TTL: 15 minutos (`ACCESS_TTL_SECONDS = 900` en `jwt.ts`)
- Refresh token TTL: 24h (default) o 30d (rememberMe)
- `api.ts`: refresh reactivo post-401 con deduplicación (`isRefreshing`)
- `middleware.ts`: refresh server-side cuando access_token está ausente pero refresh_token existe

### Decision: Timer proactivo en frontend al ~80% del TTL

- **`useTokenRefresh()` hook**: configura `setTimeout` al 80% del TTL (12 minutos)
- **POST `/api/auth/refresh`** en background al dispararse el timer
- **Fallback**: si el proactive refresh falla, el mecanismo reactivo existente sigue activo
- **API endpoint**: agregar `GET /api/auth/session` que retorna `{ expiresAt }` para que el frontend calcule el timer sin depender de hardcoded TTL

### Rationale

Un timer simple es la solución más liviana. El 80% del TTL deja margen suficiente (3 min) para que el refresh se complete antes de la expiración. No requiere WebSocket ni polling activo.

### Alternatives Considered

| Alternativa | Rechazada porque |
|---|---|
| Polling cada 5min | Genera tráfico innecesario; un solo timer es más eficiente |
| WebSocket keepalive con refresh | Sobre-ingeniería; los WebSockets se usan solo para spec generation |
| Aumentar TTL del access token a 1h | Reduce ventana de seguridad; no resuelve el problema, solo lo pospone |
| Token rotation (nuevo access en cada request) | Cambia la arquitectura de auth; riesgo de race conditions |

### Implementation

```typescript
// apps/web/hooks/use-token-refresh.ts
// 1. Al montar, GET /api/auth/session → { expiresAt }
// 2. Calcular msUntilRefresh = (expiresAt - Date.now()) * 0.8
// 3. setTimeout(refreshTokens, msUntilRefresh)
// 4. Re-calcular timer después de cada refresh exitoso
// 5. Si falla, no-op (mecanismo reactivo es fallback)
```

---

## R4: Script de Desarrollo Limpio

### Contexto

Los errores 404 en chunks de Next.js y la pérdida de CSS son causados por caché stale en `.next/`. Ocurre especialmente al cambiar la estructura de páginas (`app/**/page.tsx`, `app/**/layout.tsx`).

### Decision: Script `dev:clean` en package.json raíz

```json
{
  "scripts": {
    "dev:clean": "rm -rf apps/web/.next && turbo dev"
  }
}
```

### Rationale

Un script simple que limpia el directorio `.next/` y arranca `turbo dev` es suficiente. No necesita detectar procesos colgados ni puertos en uso — eso ya lo maneja Next.js/Turbo.

### Alternatives Considered

| Alternativa | Rechazada porque |
|---|---|
| `prebuild` hook automático | Ralentiza TODOS los builds, no solo los problemáticos |
| File watcher que detecte cambios en pages | Complejidad excesiva para un problema de desarrollo |
| Instrucción manual en CLAUDE.md (existente) | Ya existe pero el usuario sigue encontrando el problema — un comando explícito es más visible |

---

## R5: Impacto en Constitution y Compatibilidad

### Verificaciones

| Principio | Impacto | Compatibilidad |
|---|---|---|
| I. Auth por Cookies | US3 usa cookies httpOnly — compatible | ✅ |
| II. Prisma Directo | No se agrega repository — compatible | ✅ |
| III. Pipeline 9 Agentes | No se modifica — no aplica | ✅ N/A |
| IV. pnpm Exclusivo | Script `dev:clean` usa pnpm — compatible | ✅ |
| V. Patrón Backend | Cambios en service.ts mantienen patrón — compatible | ✅ |
| VI. Frontend Server-First | Hook `useTokenRefresh` es client-side por necesidad (timer) — justificado | ✅ |
| VII. Seguridad por Defecto | No cambia encriptación ni rate limiting | ✅ |

### Conclusión

Todas las correcciones son compatibles con la constitución. No hay violaciones.
