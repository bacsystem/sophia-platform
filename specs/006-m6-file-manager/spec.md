# SPEC — M6: File Manager

# Sophia Platform

# Versión: 1.2 | Sprint: 4

---

## Descripción

Gestor de archivos generados por los agentes. Permite navegar la estructura del proyecto, ver el contenido de cada archivo con syntax highlighting (shiki) y descargar el proyecto completo como ZIP. Los archivos residen en el filesystem; la BD almacena solo metadata (`generated_files`).

---

## Stack

- Backend: `archiver` (npm) para generación de ZIP
- Frontend: `shiki` para syntax highlighting (consistente con M5), `@tanstack/react-virtual` para virtualización de archivos grandes (> 500 líneas)
- Archivos en filesystem, metadata en tabla `generated_files` (definida en M4)

---

## Dependencias

- **M4**: Agent Runner — tabla `generated_files` con `path`, `agent_type`, `size_bytes`, `project_id`
- **M2**: Projects — detalle del proyecto, estado (`status`)
- **M1**: Auth — protección de endpoints

---

## Historias de Usuario

### HU-23 — Ver árbol de archivos

**Como** usuario
**Quiero** navegar la estructura de archivos del proyecto generado
**Para** entender cómo está organizado

**Criterios de aceptación:**

- [x] Árbol de carpetas colapsable en el sidebar izquierdo del file manager
- [x] Ícono dinámico por extensión (mapa unificado con M5, usa componentes Lucide React):
  - `.ts` `.tsx` → `<FileCode />` (azul)
  - `.sql` → `<Database />`
  - `.prisma` → `<Gem />`
  - `.json` → `<FileJson />`
  - `.md` → `<FileText />`
  - `.yml` `.yaml` → `<Settings />`
  - `.css` → `<Palette />`
  - `.env` → `<Lock />`
  - otros → `<File />`
- [x] Al hacer clic en archivo → muestra contenido con syntax highlighting en panel derecho
- [x] Breadcrumb de navegación (`carpeta / subcarpeta / archivo.ext`)
- [x] Muestra tamaño de cada archivo (formateado: bytes, KB, MB)
- [x] Badge de color del agente que creó el archivo
- [x] Buscador de archivos por nombre (filtro client-side sobre la lista cargada)
- [x] Archivos binarios (si existieran): muestran info (nombre, tamaño, agente) sin preview de contenido

---

### HU-24 — Ver contenido de archivo

**Como** usuario
**Quiero** ver el contenido de un archivo generado
**Para** revisar el código producido por los agentes

**Criterios de aceptación:**

- [x] Syntax highlighting con `shiki` según extensión del archivo (TypeScript, SQL, Prisma, Markdown, JSON, YAML, CSS, etc.)
- [x] Número de líneas visible (gutter)
- [x] Botón "Copiar contenido" al portapapeles (`navigator.clipboard.writeText`)
- [x] Botón "Descargar archivo" (descarga individual)
- [x] Header del viewer muestra: nombre, extensión, agente que lo creó (badge), timestamp de creación, tamaño
- [x] Archivos grandes (> 500 líneas): virtualización con `@tanstack/react-virtual` o paginación

---

### HU-25 — Descargar proyecto como ZIP

**Como** usuario
**Quiero** descargar el proyecto generado
**Para** usarlo en mi entorno local

**Criterios de aceptación:**

- [x] Botón "⬇ Descargar ZIP" en el header del file manager
- [x] Solo disponible cuando `status = done` o `status = paused`
- [x] Deshabilitado con tooltip explicativo en otros estados
- [x] Muestra tamaño estimado del ZIP antes de descargar (suma de `size_bytes` de `generated_files` × 0.6 como estimado de compresión)
- [x] El ZIP mantiene la estructura de carpetas exacta del proyecto
- [x] Descarga directa vía `Content-Disposition: attachment` (sin abrir nueva pestaña)
- [x] Nombre del ZIP: `{nombre-proyecto}-sophia.zip` (slug del nombre)
- [x] Generación del ZIP en streaming (no cargar todo en memoria)

---

## Endpoints API

```
GET  /api/projects/:id/files             → Árbol de archivos (metadata de generated_files)
GET  /api/projects/:id/files/:fileId     → Contenido de un archivo (lee del filesystem vía path en BD)
GET  /api/projects/:id/files/:fileId/raw → Descarga individual del archivo
GET  /api/projects/:id/download          → Descarga ZIP del proyecto completo
```

### GET /api/projects/:id/files

**Response 200:**

```json
{
  "data": {
    "tree": [
      {
        "id": "uuid",
        "name": "src",
        "type": "directory",
        "children": [
          {
            "id": "uuid",
            "name": "index.ts",
            "type": "file",
            "extension": ".ts",
            "sizeBytes": 1234,
            "agentType": "backend",
            "createdAt": "2026-04-07T10:30:00Z"
          }
        ]
      }
    ],
    "totalFiles": 23,
    "totalSizeBytes": 45678
  }
}
```

> El servicio construye el árbol a partir de los `path` en `generated_files`, agrupando por directorio.

### GET /api/projects/:id/files/:fileId

**Response 200:**

```json
{
  "data": {
    "id": "uuid",
    "name": "index.ts",
    "path": "src/index.ts",
    "content": "import express from...",
    "extension": ".ts",
    "sizeBytes": 1234,
    "agentType": "backend",
    "createdAt": "2026-04-07T10:30:00Z",
    "lineCount": 42
  }
}
```

> **Seguridad**: el servicio valida que el `path` resuelto esté dentro del directorio base del proyecto (prevención path traversal, alineado con M4).

### GET /api/projects/:id/files/:fileId/raw

**Response:** Stream binario del archivo individual con headers:

```
Content-Type: <inferido por extensión> (e.g., text/typescript, application/json)
Content-Disposition: attachment; filename="index.ts"
```

> Lee el archivo del filesystem usando el `path` de `generated_files`. Aplica la misma validación de path traversal que `/files/:fileId`. Si el archivo no existe en disco, retorna `404 { "error": "FILE_NOT_FOUND", "message": "Archivo no encontrado en disco" }`.

### GET /api/projects/:id/download

**Response:** Stream binario con headers:

```
Content-Type: application/zip
Content-Disposition: attachment; filename="mi-proyecto-sophia.zip"
```

> Genera el ZIP en streaming con `archiver`. Valida `status = done | paused` antes de procesar.

---

## Archivos a Crear

### Backend

```
apps/api/src/modules/files/
├── file.routes.ts          → Rutas: GET /files, GET /files/:fileId, GET /files/:fileId/raw, GET /download
├── file.controller.ts      → Controladores con validación de ownership + status
├── file.service.ts         → Lógica: construir árbol, leer contenido, generar ZIP (archiver)
└── file.schema.ts          → Schemas Zod para params y query
```

### Frontend

```
apps/web/app/(dashboard)/projects/[id]/files/
└── page.tsx                → Página principal del file manager

apps/web/components/files/
├── file-tree.tsx            → Árbol de carpetas colapsable con búsqueda
├── file-tree-node.tsx       → Nodo individual del árbol (carpeta o archivo)
├── file-viewer.tsx          → Panel derecho: contenido con shiki + header info
├── file-breadcrumb.tsx      → Breadcrumb de navegación
├── file-search.tsx          → Input de búsqueda con filtro
└── download-button.tsx      → Botón descarga ZIP con estado y tamaño estimado

apps/web/lib/
└── file-tree-builder.ts     → Utilidad para transformar flat list → tree (si se necesita client-side)
```

---

## NFRs Específicos de M6

- **Seguridad**: Path traversal prevention en lectura de archivos (validar que ruta resuelta esté dentro de `{BASE_PATH}/{projectId}/`)
- **Ownership**: Solo el owner del proyecto puede ver/descargar archivos
- **Streaming**: ZIP generado en streaming, no buffered en memoria
- **Caché**: Response de contenido de archivo puede llevar `Cache-Control: private, max-age=3600` cuando el proyecto tiene `status = done`. Para proyectos en ejecución (`status = running|idle`), usar `Cache-Control: private, no-cache` ya que un retry podría regenerar archivos. Considerar ETag basado en `generated_files.created_at` para revalidación eficiente
- **Límite**: Archivos individuales > 1MB se truncan en el viewer con mensaje "Archivo demasiado grande para preview"

---

## Fuera de Scope (M6)

- Edición de archivos generados
- Diff/comparación entre versiones
- Terminal integrada
- Git integration (commit/push de archivos generados)
- Preview renderizado de HTML/Markdown

---

## Definición de Done

- [x] Árbol de archivos navega correctamente con carpetas colapsables
- [x] Íconos correctos por extensión (mapa unificado con M5)
- [x] Syntax highlighting con shiki funciona para TS, SQL, JSON, MD, YAML, CSS, Prisma
- [x] Breadcrumb refleja la ruta actual
- [x] Búsqueda de archivos filtra correctamente
- [x] Copiar contenido al portapapeles funciona
- [x] Descarga individual de archivo funciona
- [x] Descarga ZIP con estructura correcta de carpetas
- [x] ZIP solo disponible en `status = done | paused`
- [x] Path traversal prevention validado
- [x] UI responsive (árbol en sidebar ≥ 768px, stacked en mobile)
- [x] No hay `any` en TypeScript
