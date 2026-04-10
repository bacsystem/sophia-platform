# Shared Skill: Anti-Patterns

Do not generate code that matches any of the following patterns. These are hard prohibitions enforced across all layers.

---

## Backend

- **No repository layer** — use Prisma directly in the service. Never create `*.repository.ts` files.
- **No secrets in code** — all secrets, tokens, and keys must come from `process.env`. Never hardcode them.
- **No `Float` for money or currency** — use `Decimal` (Prisma) or integer cents (number of cents as `Int`).
- **No `any` in TypeScript** — use explicit types or `unknown`. Never widen types to silence the compiler.
- **No `console.log` in production paths** — use the Fastify logger (`request.log`, `server.log`).
- **No catching errors silently** — every `catch` block must either rethrow, log, or return a structured error response.
- **No unvalidated external input** — all HTTP request bodies, query params, and route params must be validated with Zod before use.
- **No synchronous file I/O in request handlers** — use async `fs.promises.*` exclusively.
- **No direct `process.exit()`** — let the worker lifecycle manage shutdown.

## Frontend

- **No tokens in localStorage** — authentication tokens must use cookies `httpOnly`. Never `localStorage.setItem('token', ...)`.
- **No Bearer token in fetch calls** — use `fetch(url, { credentials: 'include' })`. Never `Authorization: Bearer`.
- **No `any` in TypeScript** — same rule as backend.
- **No client-only data-fetching on server components** — use `"use client"` only when strictly necessary (event handlers, browser APIs, React state).
- **No hardcoded API base URLs** — use `NEXT_PUBLIC_API_URL` env var or relative paths via proxy.
- **No unhandled loading/error states** — every data-fetching component must render a loading skeleton and an error message.
- **No unchecked cookie reads** — validate cookie presence before use; never assume it exists.

## Security

- **No plain-text passwords** — use `bcrypt` (cost ≥ 12) for hashing. Never store or log passwords.
- **No CORS wildcard in production** — `Access-Control-Allow-Origin: *` is forbidden on authenticated endpoints.
- **No JWT secrets below 32 characters** — enforce length in startup validation.
- **No missing `httpOnly` on auth cookies** — always set `httpOnly: true`, `sameSite: 'strict'`, `secure: true` in production.
- **No SQL string interpolation** — use Prisma parameterized queries exclusively. Never raw template literals in SQL.
- **No exposed stack traces in responses** — production error handler must return only `{ error, message }`, never `stack`.
- **No unprotected rate-limit routes** — all auth, registration, and password-reset endpoints require a rate-limiter plugin.

## Database

- **No soft-delete patterns** — Sophia does not implement soft deletes. Delete records directly.
- **No integer primary keys** — use `uuid()` as default for all PKs.
- **No nullable foreign keys without `onDelete` strategy** — always declare `onDelete: Cascade` or `onDelete: SetNull` explicitly.
- **No unindexed foreign key columns** — every `@relation` field must have a corresponding `@@index`.
- **No schema changes without migration** — always run `pnpm db:migrate`. Never edit the DB schema manually.

## Agent Code Generation

- **No files outside the project directory** — all `createFile` calls must write inside `{PROJECTS_BASE_DIR}/{projectId}/`.
- **No calling `taskComplete` before all required artifacts exist** — verify the artifact list from the Conventions shared skill before completing.
- **No skipping `test-mapping.json` in QA layer** — this file is mandatory output of Layer 4.
- **No omitting error handling in generated services** — every service method must handle and propagate errors.
