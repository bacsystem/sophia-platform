# Research — M1: Auth

**Branch**: `001-m1-auth` | **Date**: 2026-04-08

---

## Decisiones Técnicas Investigadas

### 1. JWT Storage: Cookie httpOnly vs localStorage vs Memory

| Opción | XSS-safe | CSRF-safe | Refresh automático | Elegida |
|--------|----------|-----------|-------------------|---------|
| Cookie httpOnly + SameSite=Strict | ✅ | ✅ | ✅ | ✅ |
| localStorage | ❌ | ✅ | ✅ | — |
| Memory (variable JS) | ✅ | ✅ | ❌ (se pierde al recargar) | — |

**Decisión**: Cookie httpOnly. Es la única opción inmune a XSS y compatible con refresh transparente. SameSite=Strict mitiga CSRF.

### 2. Refresh Token: Rotación vs Estático

- **Rotación** (elegida): Cada refresh genera nuevo par access+refresh, el anterior se invalida. Si un atacante roba un refresh token y el usuario legítimo lo usa primero, el token robado queda inválido.
- **Estático**: Un solo refresh token para toda la sesión. Si se roba, el atacante tiene acceso hasta que expire.

**Referencia**: [OWASP Token Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)

### 3. Password Hashing: bcrypt vs Argon2 vs scrypt

| Algoritmo | Seguridad | Soporte Node.js | Performance |
|-----------|-----------|-----------------|-------------|
| bcrypt (cost 12) | ✅ Alta | `bcryptjs` (JS puro) | ~250ms |
| Argon2id | ✅ Muy alta | `argon2` (binding C) | ~300ms |
| scrypt | ✅ Alta | `crypto.scrypt` (nativo) | ~200ms |

**Decisión**: bcrypt cost 12 via `bcryptjs`. Buena seguridad, amplio soporte, sin dependencias nativas (simplifica deploy). Argon2 queda como opción post-MVP.

### 4. Rate Limiting: Redis TTL vs Middleware Plugin

- **Redis TTL counter** (elegido): Simple, preciso, compartido entre instancias.
  - `INCR auth:attempts:{email}` + `EXPIRE 900` para login (5 intentos / 15 min)
  - `INCR auth:register:{ip}` + `EXPIRE 3600` para registro (3 / hora)
  - `INCR auth:reset:{email}` + `EXPIRE 3600` para forgot-password (3 / hora)
- **@fastify/rate-limit**: Plugin global, menos granular. Útil para rate limit general pero no para lógica por email/IP específica.

**Decisión**: Redis TTL para auth-specific limits. Plugin general para DDoS protection en Phase 8.

### 5. Email Service: Resend vs Nodemailer vs SendGrid

| Servicio | Free tier | API moderna | SDK TypeScript |
|----------|-----------|-------------|----------------|
| Resend | 3,000/mes | ✅ REST | ✅ `resend` |
| SendGrid | 100/día | REST legacy | ✅ |
| Nodemailer | N/A (SMTP) | ❌ | 🟡 |

**Decisión**: Resend para producción. En desarrollo, `console.log` del contenido del email (configurable via `EMAIL_PROVIDER` env var).

### 6. Timing Attack Defense

El endpoint de login no debe revelar si un email existe o no por diferencia de tiempo.

```ts
// Si el usuario no existe, ejecutar bcrypt.compare con hash dummy
// para igualar el tiempo de respuesta
const DUMMY_HASH = await bcrypt.hash('dummy', 12); // Precalculado al boot

if (!user) {
  await bcrypt.compare(password, DUMMY_HASH); // ~250ms
  throw new UnauthorizedError('INVALID_CREDENTIALS');
}
```

---

## Librerías Seleccionadas

| Librería | Versión | Propósito |
|----------|---------|-----------|
| `jsonwebtoken` | ^9.x | Sign/verify JWT (access token) |
| `bcryptjs` | ^2.x | Hash/compare passwords (JS puro) |
| `crypto` (node) | built-in | SHA-256 para refresh/reset tokens |
| `ioredis` | ^5.x | Cliente Redis para rate limiting |
| `resend` | ^4.x | Email service (producción) |
| `@fastify/cookie` | ^11.x | Parsear/setear cookies |
| `@fastify/helmet` | ^13.x | Security headers (CSP, HSTS, etc.) |
| `@fastify/cors` | ^10.x | CORS configuration |
| `react-hook-form` | ^7.x | Form handling (frontend) |
| `zod` | ^3.x | Schema validation |
| `@hookform/resolvers` | ^3.x | Zod ↔ React Hook Form bridge |
