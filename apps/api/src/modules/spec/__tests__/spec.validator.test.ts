import { describe, it, expect } from 'vitest';
import { validateSpecOutput } from '../spec.validator.js';

// ---------------------------------------------------------------------------
// Valid content fixtures
// ---------------------------------------------------------------------------

const VALID_SPEC_CONTENT = `
# Especificación: Sistema de Gestión de Proyectos

Este sistema permite a los usuarios gestionar todos sus proyectos de software de manera eficiente,
centralizando la documentación, el estado de avance y la comunicación del equipo en un solo lugar.

## Requerimientos Funcionales

- RF-01: El sistema debe permitir crear proyectos con nombre, descripción y stack tecnológico.
- RF-02: El sistema debe mostrar una lista paginada de proyectos del usuario.
- RF-03: El sistema debe permitir editar los datos básicos de un proyecto.
- RF-04: El sistema debe permitir eliminar proyectos con confirmación.

## Requerimientos No Funcionales

- RNF-01: El sistema debe responder en menos de 500ms para operaciones básicas.
- RNF-02: El sistema debe ser accesible desde dispositivos móviles.

## Historias de Usuario

### HU-01: Crear proyecto
Como desarrollador
Quiero crear un nuevo proyecto con nombre y descripción
Para organizar mi trabajo de manera estructurada

**Criterios de aceptación:**
- [ ] El formulario valida que el nombre no esté vacío
- [ ] El sistema confirma la creación con un mensaje de éxito
- [x] El usuario es redirigido al detalle del proyecto tras crearlo

### HU-02: Listar proyectos
Como desarrollador
Quiero ver todos mis proyectos en una lista
Para tener una visión general de mi trabajo
- [ ] Los proyectos se muestran ordenados por fecha
`;

const VALID_DATA_MODEL_CONTENT = `
# Modelo de Datos

## Entidades

### Tabla: projects

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Clave primaria |
| name | VARCHAR(255) | Nombre del proyecto |
| status | VARCHAR(20) | Estado actual |
| created_at | TIMESTAMP | Fecha de creación |

### Tabla: project_specs

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | UUID | Clave primaria |
| project_id | UUID | FK → projects.id |
| version | INT | Número de versión |
| content | JSONB | Contenido generado |

## Relaciones

- FK project_id referencia a projects.id — CASCADE DELETE

## Índices

- index en projects(user_id) para filtros por usuario
`;

const VALID_API_DESIGN_CONTENT = `
# API Design

## Endpoints

### GET /api/projects
Lista paginada de proyectos.

**Response 200:**
\`\`\`json
{ "data": [], "meta": { "total": 0 } }
\`\`\`

### POST /api/projects
Crea un proyecto nuevo.

**Request body:**
\`\`\`json
{ "name": "Mi proyecto", "description": "..." }
\`\`\`

**Response 201:**
\`\`\`json
{ "data": { "id": "...", "name": "..." } }
\`\`\`

### GET /api/projects/:id
Obtiene el detalle de un proyecto.

**Response 200:** schema del proyecto
**Error 404:** Proyecto no encontrado

### Errores comunes

- 400: Datos inválidos
- 401: No autenticado
- 404: Recurso no encontrado
- 500: Error interno del servidor
`;

// ---------------------------------------------------------------------------
// Tests: validateSpec
// ---------------------------------------------------------------------------

describe('validateSpecOutput — spec', () => {
  it('returns valid:true for a complete spec.md', () => {
    const result = validateSpecOutput(VALID_SPEC_CONTENT, 'spec');
    expect(result.valid).toBe(true);
    expect(result.missingRequirements).toHaveLength(0);
  });

  it('returns valid:false when content is too short', () => {
    const result = validateSpecOutput('corto', 'spec');
    expect(result.valid).toBe(false);
    expect(result.missingRequirements).toContain(
      'Descripción general (mínimo 100 caracteres)',
    );
  });

  it('returns valid:false when fewer than 3 RF-XX requirements', () => {
    const content = VALID_SPEC_CONTENT.replace(/RF-03[\s\S]*?RF-04[^\n]*/m, '');
    const result = validateSpecOutput(content, 'spec');
    expect(result.valid).toBe(false);
    expect(result.missingRequirements).toContain(
      'Requerimientos Funcionales (mínimo 3 RF-XX numerados)',
    );
  });

  it('returns valid:false when fewer than 2 RNF-XX requirements', () => {
    const content = VALID_SPEC_CONTENT.replace(/- RNF-02.*/m, '');
    const result = validateSpecOutput(content, 'spec');
    expect(result.valid).toBe(false);
    expect(result.missingRequirements).toContain(
      'Requerimientos No Funcionales (mínimo 2 RNF-XX)',
    );
  });

  it('returns valid:false when fewer than 2 HU with Como/Quiero/Para', () => {
    const content = VALID_SPEC_CONTENT.replace(/Como desarrollador\nQuiero ver[\s\S]*?Para tener[^\n]*/m, '');
    const result = validateSpecOutput(content, 'spec');
    expect(result.valid).toBe(false);
    expect(result.missingRequirements).toContain(
      'Historias de Usuario (mínimo 2 con Como/Quiero/Para)',
    );
  });

  it('returns valid:false when no checkboxes present', () => {
    const content = VALID_SPEC_CONTENT.replace(/- \[[ xX]\][^\n]*/gm, '');
    const result = validateSpecOutput(content, 'spec');
    expect(result.valid).toBe(false);
    expect(result.missingRequirements).toContain(
      'Criterios de aceptación (checkboxes en HUs)',
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: validateDataModel
// ---------------------------------------------------------------------------

describe('validateSpecOutput — dataModel', () => {
  it('returns valid:true for a complete data-model.md', () => {
    const result = validateSpecOutput(VALID_DATA_MODEL_CONTENT, 'dataModel');
    expect(result.valid).toBe(true);
    expect(result.missingRequirements).toHaveLength(0);
  });

  it('returns valid:false when no table rows present', () => {
    const result = validateSpecOutput('# Modelo\nSin tablas.', 'dataModel');
    expect(result.valid).toBe(false);
    expect(result.missingRequirements).toContain(
      'Al menos 2 entidades documentadas con tablas markdown',
    );
  });

  it('returns valid:false when no FK references', () => {
    const content = VALID_DATA_MODEL_CONTENT.replace(/FK.*/g, '');
    const result = validateSpecOutput(content, 'dataModel');
    expect(result.valid).toBe(false);
    expect(result.missingRequirements).toContain('Relaciones (FK) documentadas');
  });

  it('returns valid:false when no indexes mentioned', () => {
    const content = VALID_DATA_MODEL_CONTENT.replace(/Índices[\s\S]*/m, '');
    const result = validateSpecOutput(content, 'dataModel');
    expect(result.valid).toBe(false);
    expect(result.missingRequirements).toContain('Índices definidos');
  });
});

// ---------------------------------------------------------------------------
// Tests: validateApiDesign
// ---------------------------------------------------------------------------

describe('validateSpecOutput — apiDesign', () => {
  it('returns valid:true for a complete api-design.md', () => {
    const result = validateSpecOutput(VALID_API_DESIGN_CONTENT, 'apiDesign');
    expect(result.valid).toBe(true);
    expect(result.missingRequirements).toHaveLength(0);
  });

  it('returns valid:false when fewer than 3 distinct endpoints', () => {
    const minimal = 'GET /api/one and POST /api/two only. Error 404.';
    const result = validateSpecOutput(minimal, 'apiDesign');
    expect(result.valid).toBe(false);
    expect(result.missingRequirements).toContain(
      'Al menos 3 endpoints documentados (método + path)',
    );
  });

  it('returns valid:false when no schema documentation', () => {
    const content = 'GET /one\nPOST /two\nDELETE /three\nError 400 404 500';
    const result = validateSpecOutput(content, 'apiDesign');
    expect(result.valid).toBe(false);
    expect(result.missingRequirements).toContain(
      'Request/response schemas documentados',
    );
  });

  it('returns valid:false when no error codes', () => {
    const content = 'GET /one\nPOST /two\nDELETE /three\nRequest body response schema';
    const result = validateSpecOutput(content, 'apiDesign');
    expect(result.valid).toBe(false);
    expect(result.missingRequirements).toContain('Códigos de error documentados');
  });
});
