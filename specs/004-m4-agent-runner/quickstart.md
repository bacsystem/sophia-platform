# Quickstart: M4 Agent Runner

## Setup inicial

```bash
# 1. Instalar dependencias M4
pnpm --filter @sophia/api add @fastify/websocket bullmq

# 2. Verificar variables de entorno en apps/api/.env
# Deben existir:
# REDIS_URL=redis://localhost:6379
# ANTHROPIC_API_KEY=sk-ant-...
# ENCRYPTION_KEY=<64-hex-chars>
# PROJECTS_BASE_DIR=./projects

# 3. Ejecutar migración
pnpm db:migrate

# 4. Check que las tablas existen
psql -d sophia_dev -c "\dt" | grep -E "agents|agent_logs|generated_files|user_settings"
```

## Flujo de prueba manual

### 1. Iniciar el API
```bash
pnpm dev
# API en http://localhost:3001
```

### 2. Iniciar el Worker (proceso separado)
```bash
pnpm --filter @sophia/api worker
# BullMQ worker escuchando la queue "agent-execution"
```

### 3. Probar el inicio de un proyecto (requiere proyecto con spec generado)
```bash
# Login primero para obtener cookie
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' \
  -c cookies.txt

# Iniciar ejecución del proyecto
curl -X POST http://localhost:3001/api/projects/{PROJECT_ID}/start \
  -b cookies.txt
# → 200: { data: { id, status: "running", agents: [...] } }
# → 400: { error: "NO_SPEC", ... } si no tiene spec generado
```

### 4. Ver agentes del proyecto
```bash
curl http://localhost:3001/api/projects/{PROJECT_ID}/agents -b cookies.txt
# → 200: { data: [{ id, type, status, progress, ... }] }
```

### 5. Ver logs
```bash
curl "http://localhost:3001/api/projects/{PROJECT_ID}/logs?page=1&limit=20" -b cookies.txt
# → 200: { data: [...], meta: { total, page, limit, pages } }
```

### 6. Conectar al WebSocket
```javascript
// En el browser (con cookie de auth):
const ws = new WebSocket('ws://localhost:3001/ws/projects/{PROJECT_ID}');
ws.onmessage = (event) => {
  const { event: type, data } = JSON.parse(event.data);
  console.log(type, data);
  // agent:status, agent:log, file:created, project:progress, project:done, ...
};
```

### 7. Pausar y continuar
```bash
# Pausar (graceful — termina el tool_call actual)
curl -X POST http://localhost:3001/api/projects/{PROJECT_ID}/pause -b cookies.txt

# Continuar desde donde paró
curl -X POST http://localhost:3001/api/projects/{PROJECT_ID}/continue -b cookies.txt
```

### 8. Reintentar desde error
```bash
# Solo funciona si el proyecto está en status "error"
curl -X POST http://localhost:3001/api/projects/{PROJECT_ID}/retry -b cookies.txt
# → 200: { data: { id, status: "running", retryFromLayer: 3, retryFromLayerName: "Frontend" } }
```

## Estructura de archivos generados

```
projects/{projectId}/
├── migrations/        ← dba-agent (Layer 1)
│   ├── 001_create_users.sql
│   └── 002_create_products.sql
├── seeds/             ← seed-agent (Layer 1.5)
│   └── seed.ts
├── src/               ← backend-agent (Layer 2)
│   └── modules/
│       └── users/
│           ├── user.service.ts
│           └── user.routes.ts
├── frontend/          ← frontend-agent (Layer 3)
│   └── pages/
├── tests/             ← qa-agent (Layer 4)
├── security/          ← security-agent (Layer 4.5)
│   └── OWASP.md
├── docs/              ← docs-agent (Layer 5)
│   ├── README.md
│   └── API.md
├── deploy/            ← deploy-agent (Layer 6)
│   ├── Dockerfile
│   └── docker-compose.yml
└── integration/       ← integration-agent (Layer 7)
    └── validation-report.md
```

## Troubleshooting

### "Cannot connect to Redis"
```bash
redis-cli ping
# Debe responder: PONG
# Si no: brew services start redis
```

### "ANTHROPIC_API_KEY not set"
```bash
echo $ANTHROPIC_API_KEY
# Debe mostrar el key
# Verificar que está en apps/api/.env
```

### "No spec generated"
El proyecto necesita tener spec generado (M3) antes de iniciar. Ve a la tab Spec del proyecto y haz click en "Generar Spec".

### Worker no procesa jobs
```bash
# Verificar que el worker está corriendo
pnpm --filter @sophia/api worker

# Ver jobs en la queue
redis-cli HGETALL "bull:agent-execution:waitingChildren"
```

### Archivos generados no aparecen en filesystem
```bash
# Verificar PROJECTS_BASE_DIR
echo $PROJECTS_BASE_DIR  # Default: ./projects (relativo a apps/api/)
ls apps/api/projects/{projectId}/
```

## Comandos útiles de desarrollo

```bash
# Lint
pnpm --filter @sophia/api lint

# Build (verifica tipos)
pnpm --filter @sophia/api build

# Tests
pnpm --filter @sophia/api test

# Tests de M4 específicamente
pnpm --filter @sophia/api test -- --grep "tool-executor\|orchestrator\|encryption"
```
