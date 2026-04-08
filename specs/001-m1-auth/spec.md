# SPEC — M1: Auth

# Sophia Platform

# Versión: 1.3 | Sprint: 1 | Estado: ✅ COMPLETADO

---

## Clarifications

### Session 2026-04-08

- Q: Concurrent refresh con mismo token (múltiples tabs) → A: First-wins. La primera request rota el token, la segunda recibe 401 y redirige a login.
- Q: Navegar a /reset-password sin token o con token inválido → A: Mostrar mensaje "Token inválido o expirado" con link a /forgot-password (no redirect silencioso).
- Q: Comportamiento de rate limiting si Redis no está disponible → A: Fail-open. Permitir el request sin rate limit y loguear warning. No bloquear login/registro por caída de Redis.

---

## Descripción

Módulo de autenticación y gestión de sesión de usuario. Permite registro, login, logout, refresh de tokens y recuperación de contraseña.

---

## Stack

- Frontend: Next.js 15 + React Hook Form + Zod
- Backend: Node.js 22 + Fastify + JWT (access + refresh) + bcryptjs (cost 12)
- DB: PostgreSQL 16 (tablas users, refresh_tokens, password_reset_tokens via Prisma)
- Cache: Redis 7 (rate limiting de intentos de login) — **fail-open**: si Redis no está disponible, permitir request sin rate limit (log warning)
- Email: Resend (producción) | console.log (desarrollo)

> **Decisión**: Se elimina NextAuth.js v5. El backend Fastify es el único auth server. Next.js consume el JWT almacenado en cookie httpOnly.

---

## Arquitectura de Tokens

```
┌─────────────────────────────────────────────────┐
│  Access Token                                   │
│  - Almacenado en cookie httpOnly Secure SameSite│
│  - Vida: 15 minutos                             │
│  - Stateless (no se guarda en BD)               │
│  - Payload: { sub: userId, email, name }        │
├─────────────────────────────────────────────────┤
│  Refresh Token                                  │
│  - Almacenado en cookie httpOnly Secure SameSite│
│  - Vida: 24 horas (sin rememberMe)              │
│         30 días (con rememberMe)                │
│  - Guardado en BD (tabla refresh_tokens)         │
│  - Revocable en logout                          │
│  - Rotación: cada refresh genera nuevo par       │
└─────────────────────────────────────────────────┘
```

### Cookies

```
Set-Cookie: access_token=<jwt>; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=900
Set-Cookie: refresh_token=<opaque>; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=<ttl>
```

---

## Historias de Usuario

### HU-01 — Registro

**Como** desarrollador nuevo
**Quiero** crear una cuenta en Sophia
**Para** acceder a la plataforma

**Criterios de aceptación:**

- [ ] Formulario con: nombre, email, contraseña, confirmar contraseña
- [ ] Email debe ser único — error claro si ya existe
- [ ] Contraseña mínimo 8 caracteres con al menos 1 número
- [ ] Confirmar contraseña debe coincidir
- [ ] Al registrarse exitosamente → set cookies + redirige al dashboard
- [ ] Muestra errores inline bajo cada campo
- [ ] Rate limit: máximo 3 registros por IP por hora

**Validaciones Zod (frontend-only — el backend NO valida confirmPassword, solo recibe name/email/password):**

```ts
z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/\d/, "Debe tener al menos un número"),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});
```

---

### HU-02 — Login

**Como** usuario registrado
**Quiero** iniciar sesión
**Para** acceder a mis proyectos

**Criterios de aceptación:**

- [ ] Formulario con: email, contraseña
- [ ] Si credenciales incorrectas → mensaje genérico "Credenciales incorrectas" (no revelar cuál falló)
- [ ] Checkbox "Recordarme" → refresh token de 30 días
- [ ] Sin "Recordarme" → refresh token de 24 horas
- [ ] Después de 5 intentos fallidos → bloqueo 15 minutos con mensaje claro y countdown
- [ ] Link "Olvidé mi contraseña" visible
- [ ] Al login exitoso → set cookies + redirige al dashboard

**Rate limiting (Redis):**

```
Key:    auth:attempts:{email}
Value:  contador de intentos
TTL:    15 minutos (auto-expira)
Límite: 5 intentos
```

**Validaciones Zod (frontend-only — el backend recibe solo email/password/rememberMe):**

```ts
z.object({
  email: z.string().email(),
  password: z.string().min(1, "Contraseña requerida"),
  rememberMe: z.boolean().default(false),
});
```

---

### HU-03 — Logout

**Como** usuario autenticado
**Quiero** cerrar sesión
**Para** proteger mi cuenta

**Criterios de aceptación:**

- [ ] Botón de logout visible en el sidebar o header
- [ ] Al hacer logout → refresh token revocado en BD
- [ ] Cookies de access y refresh eliminadas
- [ ] Redirige a /login
- [ ] No puede acceder a rutas protegidas después del logout

---

### HU-04 — Refresh Token

**Como** usuario autenticado
**Quiero** que mi sesión se mantenga activa automáticamente
**Para** no tener que hacer login cada 15 minutos

**Criterios de aceptación:**

- [ ] Cuando el access token expira, el frontend hace refresh automático
- [ ] Si el refresh es exitoso → nuevo access token + nuevo refresh token (rotación)
- [ ] El refresh token anterior se invalida en BD
- [ ] Si el refresh token expiró o fue revocado → redirige a /login
- [ ] El refresh es transparente para el usuario (no ve interrupción)
- [ ] Concurrent refresh (ej. múltiples tabs): first-wins — la primera request rota el token, las siguientes reciben 401 y redirigen a /login

---

### HU-05 — Recuperar contraseña

**Como** usuario que olvidó su contraseña
**Quiero** recuperar acceso a mi cuenta
**Para** seguir usando Sophia

**Criterios de aceptación:**

- [ ] Formulario con campo email en /forgot-password
- [ ] Siempre muestra mensaje genérico "Si el email existe, recibirás instrucciones" (no confirma si existe)
- [ ] Si el email existe → envía email con link de reset
- [ ] Link de reset válido por 1 hora, uso único
- [ ] Token de reset hasheado en BD (no plaintext)
- [ ] Link redirige a /reset-password?token=xxx
- [ ] Formulario de reset con: nueva contraseña, confirmar contraseña
- [ ] Al resetear exitosamente → redirige a /login con mensaje de éxito
- [ ] Token expirado o ya usado → mensaje de error con opción de solicitar nuevo
- [ ] Acceso a /reset-password sin token o con token inválido → mostrar "Token inválido o expirado" con link a /forgot-password
- [ ] Rate limit: máximo 3 solicitudes por email por hora

---

## Endpoints API

```
POST /api/auth/register        → Crear cuenta + set cookies (access + refresh)
POST /api/auth/login           → Login + set cookies (access + refresh)
POST /api/auth/refresh         → Rotar tokens (refresh → nuevo access + nuevo refresh)
POST /api/auth/logout          → Revocar refresh token + clear cookies
POST /api/auth/forgot-password → Enviar email de reset
POST /api/auth/reset-password  → Resetear contraseña con token
GET  /api/auth/me              → Obtener usuario autenticado
```

### POST /api/auth/register

```json
// Request
{ "name": "string", "email": "string", "password": "string" }

// Response 201 — Set-Cookie: access_token, refresh_token
{ "data": { "id": "uuid", "name": "string", "email": "string" } }

// Response 409
{ "error": "EMAIL_ALREADY_EXISTS", "message": "El email ya está registrado" }

// Response 422
{ "error": "VALIDATION_ERROR", "message": "Error de validación", "errors": [{"path": ["password"], "message": "Mínimo 8 caracteres"}] }

// Response 429
{ "error": "TOO_MANY_REQUESTS", "message": "Demasiados registros, intenta más tarde", "retryAfter": 3600 }
```

### POST /api/auth/login

```json
// Request
{ "email": "string", "password": "string", "rememberMe": false }

// Response 200 — Set-Cookie: access_token, refresh_token
{ "data": { "id": "uuid", "name": "string", "email": "string" } }

// Response 401
{ "error": "INVALID_CREDENTIALS", "message": "Credenciales incorrectas" }

// Response 429
{ "error": "TOO_MANY_ATTEMPTS", "message": "Cuenta bloqueada por 15 minutos", "retryAfter": 900 }
```

### POST /api/auth/refresh

```json
// Request — No body, usa cookie refresh_token

// Response 200 — Set-Cookie: access_token (nuevo), refresh_token (nuevo)
{ "data": { "id": "uuid", "name": "string", "email": "string" } }

// Response 401
{ "error": "INVALID_REFRESH_TOKEN", "message": "Sesión expirada" }
```

### POST /api/auth/logout

```json
// Request — No body, usa cookie refresh_token

// Response 200 — Clear-Cookie: access_token, refresh_token
{ "data": { "message": "Sesión cerrada" } }
```

### POST /api/auth/forgot-password

```json
// Request
{ "email": "string" }

// Response 200 (siempre, exista o no el email)
{ "data": { "message": "Si el email existe, recibirás instrucciones" } }

// Response 429
{ "error": "TOO_MANY_REQUESTS", "message": "Demasiadas solicitudes", "retryAfter": 3600 }
```

### POST /api/auth/reset-password

```json
// Request
{ "token": "string", "password": "string" }

// Response 200
{ "data": { "message": "Contraseña actualizada exitosamente" } }

// Response 400
{ "error": "INVALID_TOKEN", "message": "Token inválido o expirado" }
```

### GET /api/auth/me

```json
// Headers: Cookie: access_token=<jwt>

// Response 200
{ "data": { "id": "uuid", "name": "string", "email": "string", "createdAt": "iso8601" } }

// Response 401
{ "error": "UNAUTHORIZED", "message": "No autenticado" }
```

---

## Data Model

### users

| Campo      | Tipo         | Nullable | Default            | Descripción         |
| ---------- | ------------ | -------- | ------------------ | ------------------- |
| id         | uuid         | No       | gen_random_uuid()  | PK                  |
| name       | varchar(100) | No       | —                  | Nombre completo     |
| email      | varchar(255) | No       | —                  | Email único         |
| password   | varchar(255) | No       | —                  | Hash bcrypt cost 12 |
| created_at | timestamptz  | No       | now()              | —                   |
| updated_at | timestamptz  | No       | now()              | —                   |

**Índices:**

- UNIQUE: `email`

> **Nota**: La API key de Anthropic se gestiona en tabla separada `user_settings` (M7). Los tokens consumidos se calculan desde la tabla `agents` (M4). `email_verified_at` queda para post-MVP.

### refresh_tokens

| Campo      | Tipo         | Nullable | Default            | Descripción                     |
| ---------- | ------------ | -------- | ------------------ | ------------------------------- |
| id         | uuid         | No       | gen_random_uuid()  | PK                              |
| user_id    | uuid         | No       | —                  | FK → users                      |
| token      | varchar(255) | No       | —                  | Hash SHA-256 del refresh token  |
| expires_at | timestamptz  | No       | —                  | Expiración (24h o 30d)          |
| revoked_at | timestamptz  | Sí       | null               | Null = activo, fecha = revocado |
| created_at | timestamptz  | No       | now()              | —                               |

**Índices:**

- INDEX: `token`
- INDEX: `user_id`
- INDEX: `expires_at` (para limpieza periódica)

### password_reset_tokens

| Campo      | Tipo         | Nullable | Default            | Descripción                          |
| ---------- | ------------ | -------- | ------------------ | ------------------------------------ |
| id         | uuid         | No       | gen_random_uuid()  | PK                                   |
| user_id    | uuid         | No       | —                  | FK → users                           |
| token      | varchar(255) | No       | —                  | Hash SHA-256 del token               |
| expires_at | timestamptz  | No       | —                  | 1 hora desde creación                |
| used_at    | timestamptz  | Sí       | null               | Null = no usado                      |
| created_at | timestamptz  | No       | now()              | —                                    |

**Índices:**

- INDEX: `token`
- INDEX: `user_id`

---

## Páginas Frontend

```
/login              → HU-02
/register           → HU-01
/forgot-password    → HU-05 (paso 1: pedir email)
/reset-password     → HU-05 (paso 2: nueva contraseña)
```

### Middleware de protección (Next.js)

```ts
// middleware.ts — protege todas las rutas excepto /login, /register, /forgot-password, /reset-password
// Lee cookie access_token, valida JWT
// Si no hay token válido → intenta refresh automático
// Si refresh falla → redirect a /login
```

---

## Archivos a Crear

### Backend (apps/api/)

```
src/modules/auth/
├── auth.routes.ts          → Definición de rutas Fastify
├── auth.controller.ts      → Handlers de cada endpoint
├── auth.service.ts         → Lógica de negocio (register, login, refresh, etc.)
├── auth.schema.ts          → Schemas de validación Zod
└── auth.middleware.ts       → Middleware: extraer y validar access token de cookie

src/lib/
├── jwt.ts                  → Funciones sign/verify para access y refresh
├── hash.ts                 → bcrypt hash/compare (cost 12)
└── redis.ts                → Cliente Redis + helpers rate limiting
```

### Frontend (apps/web/)

```
app/(auth)/
├── login/page.tsx
├── register/page.tsx
├── forgot-password/page.tsx
└── reset-password/page.tsx

components/auth/
├── login-form.tsx
├── register-form.tsx
├── forgot-password-form.tsx
└── reset-password-form.tsx

lib/
├── api.ts                  → Cliente HTTP con interceptor de refresh automático
└── auth.ts                 → Helpers: getSession, isAuthenticated

middleware.ts               → Protección de rutas + refresh automático
```

### Prisma

```
prisma/
├── schema.prisma           → Modelos: User, RefreshToken, PasswordResetToken
└── migrations/             → Migración inicial M1
```

---

## NFRs Específicos de M1

- **CORS**: `origin: [FRONTEND_URL]`, `credentials: true`
- **Rate limit registro**: 3 por IP por hora (Redis key `auth:register:{ip}`)
- **Rate limit login**: 5 por email en 15 min (Redis key `auth:attempts:{email}`)
- **Rate limit forgot-password**: 3 por email por hora (Redis key `auth:reset:{email}`)
- **Password hashing**: bcrypt cost 12
- **Token refresh**: SHA-256 hasheado en BD, plaintext solo en cookie
- **Token reset**: SHA-256 hasheado en BD, plaintext solo en email link

---

## Fuera de Scope (M1)

- Email verification (se evalúa post-MVP)
- OAuth / login social (Google, GitHub)
- Cambio de nombre / perfil (`PATCH /api/auth/me`)
- Gestión de API keys de Anthropic (M7)
- Two-factor authentication (2FA)

---

## Definición de Done

- [ ] Registro funciona end-to-end (formulario → API → BD → cookies → dashboard)
- [ ] Login devuelve access + refresh en cookies httpOnly
- [ ] Refresh automático funciona sin intervención del usuario
- [ ] Logout revoca refresh token en BD y limpia cookies
- [ ] Forgot/reset password funciona con token hasheado y expiración
- [ ] Rate limiting activo en register, login y forgot-password
- [ ] Rutas protegidas redirigen a /login si no hay sesión válida
- [ ] Tests de endpoints cubriendo happy path y errores
- [ ] UI responsive en mobile y desktop
- [ ] No hay `any` en TypeScript
- [ ] CORS configurado correctamente
