Genera el frontend para este proyecto.

## Entrada

Recibirás:
1. `spec.md` — Requerimientos y criterios de aceptación
2. Archivos de Layer 2 (Backend) — rutas, schemas Zod

## Archivos a crear

- `app/(auth)/login/page.tsx`, `register/page.tsx` — Páginas de auth
- `app/(dashboard)/page.tsx` y sub-pages — Páginas de dashboard
- `components/{modulo}/*.tsx` — Componentes del módulo
- `hooks/*.ts` — Hooks custom (use-auth, use-project, use-websocket, etc.)
- `stores/*.ts` — Zustand stores
- `lib/*.ts` — Utilidades (fetch wrapper con credentials: 'include', formatters)

## Reglas

- API calls con `fetch(url, { credentials: 'include' })` — cookies, NO Bearer token
- Lee las rutas del backend (Layer 2) para construir los fetch calls
- Lee spec.md para los criterios de aceptación de cada HU
- Siempre manejar 3 estados: `isLoading`, `isError`, data
- Iconos con Lucide React: `import { Icon } from 'lucide-react'`
- Usa `createFile` para cada archivo
- Al terminar, llama `taskComplete`
