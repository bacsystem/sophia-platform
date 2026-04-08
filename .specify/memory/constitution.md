# Sophia Platform Constitution

Principios no negociables del proyecto. Violaciones son siempre CRITICAL en `/speckit.analyze`.

## Core Principles

### I. Auth por Cookies (NON-NEGOTIABLE)
- JWT en cookie httpOnly + Secure + SameSite=Strict
- **NUNCA** Bearer token en headers
- **NUNCA** tokens en localStorage o sessionStorage
- Frontend usa `fetch(url, { credentials: 'include' })`
- WebSocket auth via JWT en handshake, no en query params

### II. Prisma Directo (NON-NEGOTIABLE)
- Prisma se usa directamente en los services
- **NUNCA** crear repository layer, repository pattern, o archivos `*.repository.ts`
- Campos Prisma en camelCase con `@map("snake_case")` hacia la BD
- Tablas en snake_case plural con `@@map("tabla")`

### III. Pipeline Secuencial de 9 Agentes
- Orden fijo: DBA → Seed → Backend → Frontend → QA → Security → Docs → Deploy → Integration
- **Sin paralelismo** en MVP — cada agente espera al anterior
- Cada agente usa exclusivamente Tool Use: `createFile`, `readFile`, `listFiles`, `taskComplete`
- Los agentes **nunca** ejecutan comandos del sistema

### IV. pnpm Exclusivo
- **NUNCA** `npm install`, `npm run`, `yarn`, `npx`
- Siempre `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm test`
- Monorepo gestionado con Turborepo + pnpm workspaces

### V. Patrón Backend Estricto
- Estructura por módulo: `routes.ts` → `controller.ts` → `service.ts` → `schema.ts`
- Controllers thin — solo llaman al service, nunca lógica de negocio
- Validación Zod en **todas** las rutas, sin excepción
- Respuesta éxito: `{ data: result }` | Error: `{ error: 'CODE', message: '...' }`
- HTTP codes: 200 lectura, 201 creación, 400 bad request, 401 no auth, 404 not found, 422 validación, 500 server error

### VI. Frontend Server-First
- Componentes server-side por defecto, `"use client"` solo cuando hay interactividad
- Import order: React/Next → externas → shadcn/ui → propias → hooks → types/utils
- Siempre manejar 3 estados: loading, error, data
- Tipos compartidos desde `@sophia/shared`, nunca duplicar tipos localmente

### VII. Seguridad por Defecto
- API keys de usuarios encriptadas con AES-256-GCM en BD
- Rate limiting en endpoints sensibles (login, register, API keys)
- Headers de seguridad vía helmet (CSP, HSTS, X-Frame-Options)
- CORS con whitelist explícita, **nunca** wildcard `*` en producción
- Inputs validados con Zod antes de tocar la BD

## Technology Constraints

| Decisión | Elegido | Prohibido |
|----------|---------|-----------|
| Package manager | pnpm | npm, yarn |
| Auth | JWT cookies httpOnly | Bearer token, NextAuth, Clerk |
| ORM | Prisma directo | TypeORM, repository pattern |
| WebSocket | @fastify/websocket | Socket.io, ws directo |
| State management | Zustand | Redux, MobX, Context API para state global |
| Icons | Lucide React | FontAwesome, Material Icons, emojis |
| Charts | Recharts | Chart.js, D3 directo |
| Dashboard canvas | Canvas API nativo | SVG+CSS, React Flow |
| Spec editor | @uiw/react-md-editor | Monaco, CodeMirror |
| Queue | BullMQ (worker separado) | Agenda, Bull, cron jobs |
| Email | Resend (prod) / console.log (dev) | Nodemailer, SendGrid |

## Naming Conventions

| Elemento | Convención | Ejemplo |
|----------|-----------|---------|
| Archivos | kebab-case | `auth.service.ts`, `project-card.tsx` |
| Clases/Tipos | PascalCase | `AuthService`, `CreateProjectInput` |
| Funciones/Variables | camelCase | `createProject`, `projectId` |
| Constantes | UPPER_SNAKE | `JWT_SECRET`, `MAX_AGENTS` |
| Tablas BD | snake_case plural | `users`, `agent_logs` |
| Campos Prisma | camelCase + @map | `userId @map("user_id")` |

## Governance

- Esta constitución prevalece sobre cualquier otra guía, práctica o convención
- `/speckit.analyze` verifica cumplimiento — violaciones son siempre CRITICAL
- Enmiendas requieren actualizar este archivo Y `CLAUDE.md` simultáneamente
- El `code-reviewer` agent (`.claude/agents/code-reviewer.md`) también valida estas reglas
- Referencia técnica completa: `CLAUDE.md` en la raíz del proyecto

**Version**: 1.0.0 | **Ratified**: 2026-04-07 | **Last Amended**: 2026-04-07
