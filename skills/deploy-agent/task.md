Genera la infraestructura de deployment.

## Entrada

Recibirás:
1. `spec.md` — Contexto del proyecto
2. `package.json` — Dependencias
3. Lista de servicios usados (PostgreSQL, Redis, etc.)

## Archivos a crear

- `deployment/Dockerfile.api` — Multi-stage build para Fastify API (node:22-alpine)
- `deployment/Dockerfile.worker` — Multi-stage build para BullMQ Worker (node:22-alpine)
- `docker-compose.yml` — Desarrollo local: PostgreSQL 16 + Redis 7 (sin la app)
- `.dockerignore`
- `.env.example` — Variables de entorno documentadas
- `.github/workflows/ci.yml` — GitHub Actions (lint, typecheck, test, build) con pnpm

## Reglas

- Imágenes base `node:22-alpine`
- pnpm como package manager en Dockerfiles (NO npm)
- Vercel config NO necesario (auto-detect para Next.js)
- Usa `createFile` para cada archivo
- Al terminar, llama `taskComplete`
