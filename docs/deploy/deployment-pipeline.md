# Deployment Pipeline — Sophia Platform

Pipeline completo desde desarrollo local hasta producción.

```mermaid
---
title: Deployment Pipeline — Sophia Platform
---
flowchart LR
    subgraph Dev["Desarrollo Local"]
        Code[Codigo] --> Commit[git commit]
        Commit --> Push[git push]
    end

    subgraph CI["CI Pipeline"]
        Push -->|Lint| Lint[ESLint + Prettier]
        Lint -->|Types| TypeCheck[tsc --noEmit]
        TypeCheck -->|Test| Test[Vitest]
        Test -->|Build| Build[turbo build]
    end

    subgraph DeployFrontend["Vercel — Frontend"]
        Build -->|Next.js| VercelDeploy[Deploy Next.js<br/>Automatic on push]
        VercelDeploy --> VercelPreview{Branch}
        VercelPreview -->|main| VercelProd[Production<br/>sophia.vercel.app]
        VercelPreview -->|feature| VercelPR[Preview<br/>pr-123.sophia.vercel.app]
    end

    subgraph DeployBackend["Railway — Backend"]
        Build -->|API| RailwayBuild[Docker Build<br/>Dockerfile.api]
        RailwayBuild -->|Migrate| DBMigrate[Prisma Migrate<br/>prisma migrate deploy]
        DBMigrate --> APIService[API Service<br/>api.sophia.app<br/>Puerto 3001]

        Build -->|Worker| WorkerBuild[Docker Build<br/>Dockerfile.worker]
        WorkerBuild --> WorkerService[Worker Service<br/>BullMQ process<br/>Concurrency: 3]
    end

    subgraph Infra["Railway — Infraestructura"]
        PG[(PostgreSQL 16<br/>Managed)]
        Redis[(Redis 7<br/>Managed)]

        APIService --> PG
        APIService --> Redis
        WorkerService --> PG
        WorkerService --> Redis
    end
```

## Servicios en producción

| Servicio | Plataforma | URL | Notas |
|----------|-----------|-----|-------|
| Frontend (Next.js 15) | Vercel | sophia.vercel.app | Auto-deploy on push to main |
| API (Fastify) | Railway | api.sophia.app | Dockerfile.api, puerto 3001 |
| Worker (BullMQ) | Railway | — (no HTTP) | Dockerfile.worker, concurrency 3 |
| PostgreSQL 16 | Railway | Internal URL | Managed, daily backups |
| Redis 7 | Railway | Internal URL | Managed, colas + sesiones |
