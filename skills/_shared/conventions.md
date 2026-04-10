# Shared Skill: Conventions

Adhere to these naming conventions, file structures, API contracts, and layer artifact standards in all code you generate.

---

## Naming Conventions

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Clases, Tipos, Interfaces | PascalCase | `AuthService`, `CreateProjectInput`, `UserRole` |
| Funciones, Métodos | camelCase | `createProject()`, `findUserById()` |
| Variables, Parámetros | camelCase | `projectId`, `isActive`, `apiKey` |
| Constantes, Enums | UPPER_SNAKE | `JWT_SECRET`, `MAX_AGENTS`, `API_KEY` |
| Archivos, Directorios | kebab-case | `auth.service.ts`, `user-card.tsx`, `auth-middleware.ts` |
| Tablas Base de Datos | snake_case plural | `users`, `projects`, `agent_logs` |
| Campos Prisma | camelCase + `@map` | `userId @map("user_id")`, `createdAt @map("created_at")` |

---

## File Paths & Structure

### Backend (Fastify + Prisma)
```
src/modules/{module-name}/
├── {module-name}.routes.ts       # Route definitions
├── {module-name}.controller.ts   # Request handlers (thin, call service only)
├── {module-name}.service.ts      # Business logic (direct Prisma — NO repository layer)
└── {module-name}.schema.ts       # Zod validation schemas
```

### Frontend (Next.js 15)
```
app/
├── (dashboard)/layout.tsx         # Authenticated layout with navbar
└── {route}/page.tsx               # Server component by default; "use client" only when needed
components/{feature}/              # Shared React components
hooks/use{Feature}.ts              # Custom React hooks
stores/{feature}.store.ts          # Zustand state management
```

### Agent Skills
```
skills/{agent-name}/
├── system.md                      # Agent system prompt
└── task.md                        # Per-run task instructions
skills/_shared/                    # Injected into every agent (this directory)
```

---

## API Response Formats

**Success:**
```json
{ "data": { "id": "uuid", "name": "..." } }
```
HTTP `200` (query) or `201` (create).

**Error:**
```json
{ "error": "ERROR_CODE", "message": "Human-readable description" }
```
HTTP `400` Bad Request · `401` Unauthorized · `404` Not Found · `409` Conflict · `500` Server Error.

**Validation error:**
```json
{ "error": "VALIDATION_ERROR", "errors": [{ "field": "email", "message": "Invalid email" }] }
```
HTTP `422 Unprocessable Entity`.

**Rate limit:**
```json
{ "error": "RATE_LIMIT", "message": "Too many requests", "retryAfter": 60 }
```
HTTP `429 Too Many Requests`.

**Auth:** JWT cookies `httpOnly` (`access_token`). API calls use `fetch(url, { credentials: 'include' })` — **never Bearer tokens, never localStorage**.

---

## Artefactos por Capa

| Capa | Agente | Artefactos esperados |
|------|--------|----------------------|
| 1 | DBA | `prisma/schema.prisma` (models + relations), migration files |
| 1.5 | Seed | `prisma/seed.ts`, `tests/factories.ts`, `tests/test-constants.ts` |
| 2 | Backend | `{module}.routes.ts`, `{module}.controller.ts`, `{module}.service.ts`, `{module}.schema.ts` |
| 3 | Frontend | `app/{route}/page.tsx`, `components/`, `hooks/use{Feature}.ts`, `stores/{feature}.store.ts` |
| 4 | QA | `*.test.ts` / `*.test.tsx` (Vitest), `tests/integration/`, `test-mapping.json` |
| 4.5 | Security | `security-audit.md` (OWASP Top 10 findings table) |
| 5 | Docs | `README.md`, API docs, Mermaid architecture diagrams |
| 6 | Deploy | `Dockerfile`, `railway.toml`, `.env.example` |
| 7 | Integration | `integration-report.md`, `certification.md` (traceability matrix) |

---

## Core Principles

- **TDD mandatory**: write failing test → implement → verify GREEN (RED-GREEN-REFACTOR)
- **No repository layer**: Prisma used directly in service
- **No secrets in code**: all secrets via environment variables
- **No any in TypeScript**: use explicit types or `unknown`
- **No Float for money**: use `Decimal` or integer cents
- **No localStorage for tokens**: cookies `httpOnly` only
