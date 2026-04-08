## Tarea

Audita el código generado por los agentes anteriores (dba, backend, frontend, qa, docs, deploy) y genera archivos de hardening de seguridad.

## Pasos

1. Lee `apps/api/src/modules/auth/` — verifica JWT, bcrypt, cookies
2. Lee `apps/api/src/plugins/` — verifica que existan auth.ts, cors.ts
3. Lee todos los `*.routes.ts` — verifica que cada ruta tenga preHandler de auth y validación Zod
4. Lee todos los `*.service.ts` — verifica que no haya raw SQL, secrets hardcodeados, o datos sin sanitizar
5. Lee `apps/web/src/` — verifica que no haya tokens en localStorage, que use `credentials: 'include'`
6. Lee `.env.example` — verifica que todas las variables sensibles estén listadas
7. Genera los archivos de seguridad:
   - `SECURITY.md` con políticas y contacto
   - `apps/api/src/plugins/rate-limit.ts` con configuración por endpoint
   - `apps/api/src/plugins/helmet.ts` con headers de seguridad
8. Genera reporte de hallazgos en `taskComplete`

## Formato del reporte

```
SECURITY AUDIT REPORT
=====================
CRITICAL: [número]
HIGH: [número]
MEDIUM: [número]
LOW: [número]

HALLAZGOS:
[SEVERITY] archivo:línea — descripción — remediación sugerida
```

## Archivos de infraestructura a generar

### rate-limit.ts
```typescript
import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'

export async function rateLimitPlugin(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
  })
}
```

### helmet.ts
```typescript
import helmet from '@fastify/helmet'
import type { FastifyInstance } from 'fastify'

export async function helmetPlugin(app: FastifyInstance) {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
  })
}
```
