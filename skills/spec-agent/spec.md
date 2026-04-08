# Prompt — Generar spec.md

Genera el documento `spec.md` para el siguiente proyecto:

**Nombre:** {project.name}
**Stack:** {project.stack}
**Descripción:** {project.description}
**Configuración de agentes:** {project.config}

## Estructura requerida del documento

El documento debe incluir **todas** las siguientes secciones en este orden:

### 1. Descripción General
Párrafo de contexto: qué problema resuelve, para quién, valor de negocio. Mínimo 100 caracteres.

### 2. Requerimientos Funcionales
Lista numerada de al menos 3 requerimientos funcionales con identificadores RF-01, RF-02, RF-03, etc.

Ejemplo:
- **RF-01** — El sistema debe permitir a los usuarios registrarse con email y contraseña
- **RF-02** — Los usuarios autenticados deben poder crear, editar y eliminar recursos

### 3. Requerimientos No Funcionales
Lista numerada de al menos 2 requerimientos con identificadores RNF-01, RNF-02, etc.

Ejemplo:
- **RNF-01** — Tiempo de respuesta < 500ms en el 95% de las peticiones
- **RNF-02** — El sistema debe soportar autenticación segura con JWT y HTTPS

### 4. Historias de Usuario
Al menos 2 historias de usuario con formato:

**HU-XX — Título**
**Como** [rol]
**Quiero** [acción]
**Para** [beneficio]

**Criterios de aceptación:**
- [ ] Criterio 1
- [ ] Criterio 2

### 5. Restricciones y supuestos
Lista de restricciones técnicas, de negocio o suposiciones clave.

---

Genera el documento completo ahora. Responde únicamente con el contenido Markdown del documento spec.md, sin preámbulos.
