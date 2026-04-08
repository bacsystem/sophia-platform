# Quickstart — M1: Auth

**Branch**: `001-m1-auth` | **Date**: 2026-04-08

---

## Pre-requisitos

- Node.js 22+
- pnpm 9+
- PostgreSQL 16 corriendo localmente
- Redis 7 corriendo localmente

## Setup rápido

```bash
# 1. Clonar e instalar dependencias
git clone <repo> && cd sophia-platform
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales locales:
#   DATABASE_URL=postgresql://user:pass@localhost:5432/sophia_dev
#   REDIS_URL=redis://localhost:6379
#   JWT_SECRET=<random-string-32-chars>
#   JWT_REFRESH_SECRET=<random-string-32-chars>
#   FRONTEND_URL=http://localhost:3000

# 3. Ejecutar migraciones
pnpm db:migrate

# 4. Iniciar en modo desarrollo
pnpm dev
```

## URLs locales

| Servicio | URL |
|----------|-----|
| Frontend (Next.js) | http://localhost:3000 |
| Backend (Fastify) | http://localhost:3001 |
| API Auth endpoints | http://localhost:3001/api/auth/* |

## Verificación rápida

```bash
# Registrar usuario
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password1"}' \
  -c cookies.txt -v

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password1","rememberMe":false}' \
  -c cookies.txt -v

# Get current user
curl http://localhost:3001/api/auth/me \
  -b cookies.txt

# Refresh tokens
curl -X POST http://localhost:3001/api/auth/refresh \
  -b cookies.txt -c cookies.txt

# Logout
curl -X POST http://localhost:3001/api/auth/logout \
  -b cookies.txt
```

## Estructura de archivos a implementar

```
apps/api/src/
├── modules/auth/
│   ├── auth.routes.ts       ← Registrar con: app.register(authRoutes, { prefix: '/api/auth' })
│   ├── auth.controller.ts   ← Handlers: register, login, refresh, logout, forgotPassword, resetPassword, me
│   ├── auth.service.ts      ← Lógica: createUser, validateCredentials, rotateTokens, etc.
│   ├── auth.schema.ts       ← Zod: registerSchema, loginSchema, resetPasswordSchema
│   └── auth.middleware.ts   ← authenticate(): extraer JWT de cookie, validar, inyectar user en request
├── lib/
│   ├── jwt.ts               ← signAccessToken, signRefreshToken, verifyAccessToken
│   ├── hash.ts              ← hashPassword, comparePassword (bcrypt cost 12)
│   └── redis.ts             ← getRedisClient, checkRateLimit, incrementRateLimit

apps/web/
├── app/(auth)/
│   ├── login/page.tsx
│   ├── register/page.tsx
│   ├── forgot-password/page.tsx
│   └── reset-password/page.tsx
├── components/auth/
│   ├── login-form.tsx       ← "use client", React Hook Form + Zod
│   ├── register-form.tsx
│   ├── forgot-password-form.tsx
│   └── reset-password-form.tsx
├── lib/
│   ├── api.ts               ← fetch wrapper con credentials: 'include' + refresh interceptor
│   └── auth.ts              ← getSession, isAuthenticated helpers
└── middleware.ts             ← Next.js middleware: proteger rutas, validar cookie
```

## Orden de implementación

1. **Phase 1**: Prisma schema + libs (jwt, hash, redis) + shared types
2. **Phase 2**: HU-01 Registro (backend + frontend)
3. **Phase 3**: HU-02 Login (backend + frontend)
4. **Phase 4**: HU-04 Refresh Token
5. **Phase 5**: HU-03 Logout
6. **Phase 6**: HU-05 Recuperar Contraseña
7. **Phase 7**: GET /me + Middleware Frontend
8. **Phase 8**: Helmet, CORS, tests, performance
