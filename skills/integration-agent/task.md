## Tarea

Valida la consistencia cross-layer de todo el código generado y genera un reporte de integración.

## Pasos

### Fase 1 — Inventario de rutas
1. `listFiles` en `apps/api/src/modules/` → colectar todos los `*.routes.ts`
2. Para cada routes.ts, `readFile` y extraer: método, path, schema de validación
3. Resultado: mapa completo de endpoints backend

### Fase 2 — Inventario de fetch del frontend
1. `listFiles` en `apps/web/src/` → buscar todos los archivos con `fetch(`
2. Para cada archivo, `readFile` y extraer: URL, método, body esperado
3. Comparar contra el mapa de endpoints del Paso 1
4. Reportar: endpoints llamados que no existen, métodos incorrectos, bodies incompatibles

### Fase 3 — Consistencia de tipos
1. `listFiles` en `packages/shared/src/types/`
2. Verificar que cada tipo exportado se importa correctamente en backend y frontend
3. Buscar tipos duplicados (definidos localmente en vez de importar de shared)

### Fase 4 — WebSocket events
1. `readFile` de todos los archivos que contengan `ws.send` o `socket.send` en el backend
2. Extraer tipos de eventos emitidos
3. `readFile` de hooks/stores del frontend que escuchan WebSocket
4. Comparar: cada evento emitido debe tener un listener

### Fase 5 — Variables de entorno
1. `readFile` de `.env.example`
2. Buscar todos los `process.env.` en el código
3. Buscar todos los `NEXT_PUBLIC_` en el frontend
4. Reportar variables usadas que no están en `.env.example`
5. Reportar variables sensibles expuestas al frontend

### Fase 6 — Reporte
1. Compilar todos los hallazgos
2. Generar `docs/integration-report.md`
3. Si faltan tipos compartidos, generar en `packages/shared/src/types/`
4. `taskComplete` con resumen
