# SPEC — M7: Settings

# Sophia Platform

# Versión: 1.2 | Sprint: 4

---

## Descripción

Configuración de la plataforma. Permite al usuario gestionar su API key de Anthropic (obligatoria para ejecutar proyectos), ver uso de tokens con costos estimados y editar su perfil.

---

## Dependencias

- **M1**: Auth — sesión activa, cambio de contraseña (validación de contraseña actual)
- **M4**: Agent Runner — datos de tokens usados por ejecución (tabla `agents`, columnas `tokens_input` + `tokens_output`)

> **Nota**: `encryption.service.ts` y tabla `user_settings` se implementan como **prerequisito compartido (Sprint 2.5)** en `apps/api/src/lib/encryption.service.ts`, antes de M4. M7 reutiliza ese servicio — NO lo re-crea en `src/modules/settings/`.

---

## Modelo de Datos

### Tabla `user_settings`

```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

  -- API Key (encriptada AES-256-GCM)
  anthropic_api_key_encrypted BYTEA,       -- ciphertext
  anthropic_api_key_iv        BYTEA,       -- IV único (12 bytes)
  anthropic_api_key_tag       BYTEA,       -- auth tag (16 bytes)
  anthropic_api_key_last4     VARCHAR(4),  -- últimos 4 chars para display

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);
```

### Encriptación

- **Algoritmo**: AES-256-GCM (confidencialidad + integridad)
- **Clave maestra**: Variable de entorno `ENCRYPTION_KEY` (32 bytes hex, 64 caracteres)
- **IV**: Generado con `crypto.randomBytes(12)` — único por registro
- **Auth Tag**: 16 bytes, almacenado por separado
- **Implementación**: Node.js `crypto.createCipheriv('aes-256-gcm', key, iv)`

> **IMPORTANTE**: `ENCRYPTION_KEY` se genera una vez y **nunca** se rota sin migrar las keys existentes. Documentar procedimiento de rotación para post-MVP.

---

## Historias de Usuario

### HU-26 — Configurar API key de Anthropic

**Como** usuario
**Quiero** configurar mi propia API key de Anthropic
**Para** poder ejecutar agentes en mis proyectos

**Criterios de aceptación:**

- [ ] Campo para ingresar API key con validación de formato: `sk-ant-api03-...` (regex: `/^sk-ant-api03-[A-Za-z0-9_-]{90,110}$/`)
- [ ] Al guardar → el sistema verifica la key haciendo una llamada ligera a Anthropic (`messages.create` con max_tokens: 1, prompt trivial)
- [ ] Si la key es válida → se encripta con AES-256-GCM y se almacena en BD
- [ ] Se muestra solo: `sk-ant-...XXXX` (últimos 4 caracteres)
- [ ] Botón "Eliminar API key" con modal de confirmación ("¿Seguro? No podrás ejecutar proyectos sin ella")
- [ ] Si no hay API key → mensaje claro: "Configura tu API key de Anthropic para ejecutar proyectos" con enlace a docs de Anthropic
- [ ] Sin API key → los botones de ejecutar proyecto (M2/M4) están deshabilitados con tooltip
- [ ] Rate limit en verificación: máximo 5 intentos por hora por usuario

> **Decisión MVP**: No hay API key del sistema. Cada usuario debe proporcionar su propia key. Esto elimina problemas de costos compartidos y abuso.

---

### HU-27 — Ver uso de tokens

**Como** usuario
**Quiero** ver cuántos tokens he usado y el costo estimado
**Para** controlar mis gastos

**Criterios de aceptación:**

- [ ] Card resumen: tokens totales input + output (todos los proyectos)
- [ ] Costo estimado total en USD (marcado como "~estimado")
- [ ] Tabla de uso por proyecto:
  - Nombre proyecto | Tokens input | Tokens output | Costo estimado | Fecha
- [ ] Precios configurables desde `packages/shared/constants/pricing.ts`:

```typescript
export const ANTHROPIC_PRICING = {
  model: "claude-sonnet-4-20250514",
  inputPerMTok: 3.0,   // USD por millón de tokens input
  outputPerMTok: 15.0,  // USD por millón de tokens output
  lastUpdated: "2026-04-01",
} as const;
```

- [ ] Disclaimer visible: "Los precios son estimados basados en tarifas públicas de Anthropic y pueden variar"
- [ ] Gráfico de barras de uso por día (últimos 30 días) con `recharts`
- [ ] Filtro por período: última semana / último mes / últimos 3 meses / todo
- [ ] Datos provienen de sumar `tokens_input` y `tokens_output` de la tabla `agents` agrupados por `project_id`

---

### HU-28 — Editar perfil

**Como** usuario
**Quiero** actualizar mi nombre y contraseña
**Para** mantener mi cuenta al día

**Criterios de aceptación:**

- [ ] Campo editable: nombre (min 2, max 100 caracteres)
- [ ] Sección cambio de contraseña (colapsable, separada del nombre):
  - Contraseña actual (obligatoria para validar identidad)
  - Nueva contraseña (min 8 caracteres, mismas reglas que registro M1)
  - Confirmar nueva contraseña
- [ ] Validación: la contraseña actual debe ser correcta (bcrypt compare) antes de aplicar cambio
- [ ] Toast de éxito al guardar nombre
- [ ] Toast de éxito al cambiar contraseña + cierra la sección colapsable
- [ ] Errores inline por campo (no solo toast genérico)

---

## Endpoints API

```
GET    /api/settings                      → Ver settings del usuario (con API key ofuscada)
PUT    /api/settings/api-key              → Guardar API key (encripta + almacena)
DELETE /api/settings/api-key              → Eliminar API key
POST   /api/settings/api-key/verify       → Verificar API key con Anthropic (rate limited: 5/hora)
GET    /api/settings/usage                → Uso de tokens agregado + por proyecto
GET    /api/settings/usage/daily          → Uso diario (últimos 30-90 días para gráfico)
PUT    /api/settings/profile              → Actualizar nombre
PUT    /api/settings/password             → Cambiar contraseña (requiere contraseña actual)
```

### GET /api/settings

**Response 200:**

```json
{
  "data": {
    "apiKey": {
      "configured": true,
      "last4": "AbCd",
      "verifiedAt": "2026-04-07T10:30:00Z"
    },
    "profile": {
      "name": "Christian",
      "email": "christian@example.com"
    }
  }
}
```

> Si no hay API key configurada, `apiKey` devuelve `{ "configured": false, "last4": null, "verifiedAt": null }`.

### PUT /api/settings/api-key

**Request:**

```json
{
  "apiKey": "sk-ant-api03-..."
}
```

**Response 200:**

```json
{
  "data": {
    "configured": true,
    "last4": "AbCd",
    "verifiedAt": "2026-04-07T10:30:00Z"
  }
}
```

> El endpoint valida formato, verifica con Anthropic, encripta y almacena en un solo paso.

**Response 422:** `{ "error": "INVALID_API_KEY_FORMAT", "message": "Formato de API key inválido. Debe comenzar con sk-ant-api03-" }`
**Response 400:** `{ "error": "API_KEY_VERIFICATION_FAILED", "message": "No se pudo verificar la API key con Anthropic" }`
**Response 429:** `{ "error": "TOO_MANY_ATTEMPTS", "message": "Máximo 5 verificaciones por hora", "retryAfter": 3600 }`

### DELETE /api/settings/api-key

**Response 200:**

```json
{
  "data": { "message": "API key eliminada" }
}
```

**Response 404:** `{ "error": "NO_API_KEY", "message": "No hay API key configurada" }`

### POST /api/settings/api-key/verify

> Verifica la API key almacenada sin modificarla. Útil para verificar que sigue siendo válida.

**Response 200:**

```json
{
  "data": {
    "valid": true,
    "verifiedAt": "2026-04-08T10:30:00Z"
  }
}
```

**Response 400:** `{ "error": "API_KEY_INVALID", "message": "La API key ya no es válida con Anthropic" }`
**Response 404:** `{ "error": "NO_API_KEY", "message": "No hay API key configurada" }`
**Response 429:** `{ "error": "TOO_MANY_ATTEMPTS", "message": "Máximo 5 verificaciones por hora", "retryAfter": 3600 }`

### PUT /api/settings/profile

**Request:**

```json
{
  "name": "Christian Nuevo"
}
```

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "name": "Christian Nuevo",
    "email": "christian@example.com",
    "updatedAt": "2026-04-08T10:30:00Z"
  }
}
```

**Response 422:** `{ "error": "VALIDATION_ERROR", "errors": [{ "path": ["name"], "message": "Mínimo 2 caracteres" }] }`

### GET /api/settings/usage

**Response 200:**

```json
{
  "data": {
    "totals": {
      "tokensInput": 124500,
      "tokensOutput": 45200,
      "estimatedCostUsd": 1.05
    },
    "byProject": [
      {
        "projectId": "uuid",
        "projectName": "Mi App",
        "tokensInput": 80000,
        "tokensOutput": 30000,
        "estimatedCostUsd": 0.69,
        "lastExecutionAt": "2026-04-07T10:30:00Z"
      }
    ]
  }
}
```

### GET /api/settings/usage/daily

**Query params:** `?days=30` (default 30, max 90)

**Response 200:**

```json
{
  "data": [
    {
      "date": "2026-04-07",
      "tokensInput": 12000,
      "tokensOutput": 4500,
      "estimatedCostUsd": 0.10,
      "executions": 2
    }
  ]
}
```

> Agrupa tokens de la tabla `agents` por día (campo `completedAt`), filtrando por `user_id` del proyecto. Se usa en el gráfico Recharts de consumo diario. Días sin actividad se omiten del array (el frontend los interpola como 0).

### PUT /api/settings/password

**Request:**

```json
{
  "currentPassword": "...",
  "newPassword": "...",
  "confirmPassword": "..."
}
```

**Response 200:** `{ "data": { "message": "Contraseña actualizada" } }`
**Response 400:** `{ "error": "INVALID_PASSWORD", "message": "Contraseña actual incorrecta" }`

---

## Archivos a Crear

### Backend

```
apps/api/src/lib/
└── encryption.service.ts       → AES-256-GCM encrypt/decrypt (creado en Sprint 2.5, reutilizado)

apps/api/src/modules/settings/
├── settings.routes.ts          → Todas las rutas bajo /api/settings
├── settings.controller.ts      → Controladores con auth middleware
├── settings.service.ts         → Lógica: CRUD settings, agregación de tokens
└── settings.schema.ts          → Schemas Zod (apiKey, profile, password)

packages/shared/constants/
└── pricing.ts                  → ANTHROPIC_PRICING constantes
```

### Frontend

```
apps/web/app/(dashboard)/settings/
└── page.tsx                    → Página de settings con tabs/secciones

apps/web/components/settings/
├── api-key-section.tsx         → Gestión de API key (input, estado, eliminar)
├── usage-overview.tsx          → Cards resumen + tabla por proyecto
├── usage-chart.tsx             → Gráfico recharts uso diario
├── profile-form.tsx            → Editar nombre
└── password-form.tsx           → Cambiar contraseña (colapsable)
```

---

## NFRs Específicos de M7

- **Seguridad**: API key encriptada AES-256-GCM, nunca en logs, nunca en responses completa
- **Seguridad**: `ENCRYPTION_KEY` solo en .env, nunca en código ni en BD
- **Seguridad**: Cambio de contraseña requiere contraseña actual (previene session hijacking)
- **Rate limit**: Verificación de API key: 5 intentos/hora/usuario (Redis counter)
- **Auditabilidad**: Log (interno, no visible al usuario) cuando se añade/elimina API key
- **Rendimiento**: Agregación de tokens usa query SQL con SUM/GROUP BY, no carga todas las ejecuciones

---

## Fuera de Scope (M7)

- Billing real / cobros / Stripe integration
- Múltiples API keys (solo una por usuario)
- API keys de otros providers (OpenAI, Google, etc.)
- Rotación automática de `ENCRYPTION_KEY`
- Exportar datos de uso (CSV/PDF)
- Notificaciones de límite de tokens
- Tema oscuro/claro toggle (hereda del sistema)
- Eliminación de cuenta

---

## Definición de Done

- [ ] API key se guarda encriptada con AES-256-GCM en BD
- [ ] API key se muestra ofuscada (`sk-ant-...XXXX`)
- [ ] Verificación con Anthropic funciona y tiene rate limit
- [ ] Sin API key → ejecución de proyectos bloqueada con mensaje claro
- [ ] Uso de tokens muestra totales + por proyecto con costos estimados
- [ ] Gráfico recharts de uso diario renderiza correctamente
- [ ] Disclaimer de precios estimados visible
- [ ] Editar nombre funciona con validación
- [ ] Cambiar contraseña valida la actual antes de aplicar
- [ ] UI responsive
- [ ] `encryption.service.ts` tiene tests unitarios (encrypt → decrypt roundtrip)
- [ ] No hay `any` en TypeScript
