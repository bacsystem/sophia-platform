# Feature Specification: Correcciones del Sistema — Errores Runtime

**Feature Branch**: `008-system-wide-fixes`
**Created**: 2026-04-09
**Status**: Draft
**Input**: User description: "solucionar errores runtime del sistema: 503 API key, 404 chunks, pérdida de sesiones, pérdida de CSS, ANTHROPIC_API_KEY not set, spec requerido"

## Clarifications

### Session 2026-04-09

- Q: ¿Debe reemplazarse el spec genérico con errores concretos o agregar una User Story? → A: Reemplazar completo con User Stories por error concreto
- Q: ¿Cómo resolver la pérdida de sesiones por expiración de access token? → A: Refresh proactivo en frontend al ~80% del TTL
- Q: ¿Cómo manejar errores en generación de specs (ANTHROPIC_API_KEY faltante)? → A: Propagar error como evento en canal de streaming
- Q: ¿Cómo mejorar la verificación de API key con Anthropic? → A: Timeout 5s + 1 reintento automático + mensajes diferenciados
- Q: ¿Cómo prevenir errores 404 chunks y pérdida de CSS en desarrollo? → A: Script `pnpm dev:clean` para clean-rebuild automático

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Verificación de API Key Resiliente (Priority: P1)

Como usuario, cuando guardo mi API key en Configuración, necesito que la verificación sea resiliente a fallos de red transitorios y que reciba retroalimentación clara sobre el resultado, en lugar de ver un mensaje genérico de "No se pudo conectar con Anthropic" que no me permite distinguir si mi key es inválida o si hubo un problema temporal.

**Why this priority**: Sin una API key guardada exitosamente, el usuario no puede generar specs ni ejecutar agentes — es el bloqueante más inmediato del sistema.

**Independent Test**: Intentar guardar una API key válida y una inválida, verificando que ambos casos producen mensajes claros y diferenciados.

**Acceptance Scenarios**:

1. **Given** el servicio de Anthropic responde lento (>5s primera vez), **When** el usuario guarda su API key, **Then** el sistema reintenta automáticamente 1 vez antes de reportar fallo, y el usuario ve un indicador de progreso durante la verificación
2. **Given** una API key inválida (formato correcto pero rechazada por Anthropic), **When** el usuario intenta guardarla, **Then** el sistema muestra "La clave API es inválida" (no "No se pudo conectar")
3. **Given** un fallo de red o timeout después del reintento, **When** la verificación falla, **Then** el sistema muestra "No se pudo verificar la clave: problema de conexión temporal. Intenta de nuevo" diferenciándolo de key inválida

---

### User Story 2 — Errores Visibles en Generación de Specs (Priority: P1)

Como usuario, cuando inicio la generación de un spec y hay un error de configuración o fallo en el proceso, necesito ver un mensaje de error claro en la pantalla en lugar de un spinner infinito, para poder tomar acción (configurar la clave, reintentar, o reportar el problema).

**Why this priority**: Sin generación de specs funcional, el usuario no puede iniciar ningún proyecto. El spinner infinito sin feedback es la peor experiencia posible — el usuario no sabe si debe esperar o actuar.

**Independent Test**: Intentar generar un spec sin clave de sistema configurada y verificar que aparece un mensaje de error claro en menos de 5 segundos.

**Acceptance Scenarios**:

1. **Given** que la clave del sistema no está configurada, **When** el usuario inicia la generación de un spec, **Then** el sistema muestra un error claro indicando que la configuración del servicio es incompleta, dentro de los primeros 5 segundos
2. **Given** que la generación falla por un error inesperado durante el proceso, **When** el error ocurre, **Then** el canal de streaming emite un evento de error y el frontend reemplaza el spinner con el mensaje de error y un botón de reintentar
3. **Given** que el usuario ve el mensaje "El proyecto debe tener spec generado antes de iniciar", **When** no puede generar el spec por un error previamente silenciado, **Then** el mensaje de error de generación le fue visible antes de intentar iniciar el proyecto

---

### User Story 3 — Sesiones Persistentes Durante Uso Activo (Priority: P2)

Como usuario, necesito que mi sesión se mantenga activa mientras estoy usando el sistema, sin experimentar desconexiones inesperadas, pérdida de estado o redirecciones al login mientras navego o trabajo en un proyecto.

**Why this priority**: La pérdida de sesión durante uso activo interrumpe el flujo de trabajo y genera frustración. Es especialmente crítico durante operaciones largas como la generación de specs o la ejecución de agentes.

**Independent Test**: Mantener el sistema abierto durante 1 hora con uso intermitente y verificar que la sesión se mantiene activa sin interrupciones visibles.

**Acceptance Scenarios**:

1. **Given** un usuario autenticado con uso activo, **When** el token de acceso está próximo a expirar (al ~80% de su tiempo de vida), **Then** el sistema renueva el token automáticamente en segundo plano sin que el usuario perciba interrupción
2. **Given** un usuario inactivo por menos de 24 horas (o 30 días con "recordarme"), **When** retoma actividad, **Then** la sesión se restaura automáticamente sin pasar por la pantalla de login
3. **Given** un refresh de token exitoso en segundo plano, **When** el usuario hace cualquier acción inmediatamente después, **Then** la acción se ejecuta sin error 401 ni flash de pantalla de login

---

### User Story 4 — Entorno de Desarrollo Estable (Priority: P3)

Como desarrollador, necesito que el entorno de desarrollo local no muestre errores 404 en archivos del sistema ni pierda estilos visuales, para poder trabajar sin interrupciones y confiar en lo que veo en pantalla.

**Why this priority**: Los 404 en chunks y la pérdida de CSS impiden el uso del sistema en desarrollo, pero son causados por caché stale y se resuelven con un proceso de limpieza. La prevención sistémica reduce fricción.

**Independent Test**: Ejecutar el comando de desarrollo limpio y verificar que la aplicación carga sin errores 404 ni pérdida de estilos.

**Acceptance Scenarios**:

1. **Given** un entorno de desarrollo con caché potencialmente corrupto, **When** el desarrollador ejecuta el comando de desarrollo limpio, **Then** la aplicación se reconstruye desde cero y todas las rutas cargan correctamente sin errores 404
2. **Given** un cambio en la estructura de páginas del frontend, **When** el desarrollador ejecuta el comando de desarrollo limpio, **Then** los nuevos chunks se generan correctamente y los estilos se cargan completos
3. **Given** el sistema funcionando en desarrollo, **When** se navega a cualquier ruta (/projects, /settings, etc.), **Then** los estilos visuales se muestran correctamente y no hay recursos faltantes en la consola del navegador

---

### Edge Cases

- ¿Qué ocurre si el reintento de verificación de API key también falla por timeout? El sistema muestra error de conexión y NO guarda la key
- ¿Qué ocurre si el canal de streaming se cierra antes de poder emitir el evento de error? El frontend tiene un timeout de seguridad que muestra error genérico
- ¿Qué ocurre si el refresh proactivo del token falla? El sistema cae al mecanismo reactivo existente (refresh post-401) como fallback
- ¿Qué ocurre si el desarrollador tiene procesos de Node colgados que bloquean el puerto? Turbo/Next.js reporta nativamente el conflicto de puerto al iniciar

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Al guardar una API key, el sistema DEBE reintentar la verificación 1 vez ante timeout o error de red antes de reportar fallo
- **FR-002**: Los mensajes de error al guardar API key DEBEN diferenciar entre: key inválida, timeout de conexión, y error de red
- **FR-003**: Los errores durante la generación de specs DEBEN propagarse como eventos a través del canal de streaming al frontend
- **FR-004**: El frontend DEBE reemplazar el indicador de progreso con un mensaje de error claro cuando recibe un evento de error de generación
- **FR-005**: El frontend DEBE renovar el token de acceso automáticamente al alcanzar el ~80% de su tiempo de vida, en segundo plano
- **FR-006**: Si el refresh proactivo falla, el sistema DEBE caer al mecanismo reactivo existente como fallback sin pérdida de funcionalidad
- **FR-007**: El proyecto DEBE incluir un comando de desarrollo que limpie caché y reconstruya el frontend desde cero
- **FR-008**: Las correcciones NO DEBEN alterar la lógica de negocio existente ni romper la suite de tests

### Key Entities

- **Sesión de usuario**: Token de acceso (corta duración) + token de refresh (larga duración), con ciclo de renovación proactiva
- **Verificación de API key**: Resultado tipificado con estados distinguibles: válida, inválida, timeout, error de red
- **Evento de streaming**: Mensaje tipificado que puede ser progreso, resultado exitoso, o error con detalle accionable

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de los intentos de guardar API key con key válida e Anthropic accesible resultan en guardado exitoso (incluyendo reintentos transparentes)
- **SC-002**: El usuario recibe un mensaje de error específico (no genérico) en menos de 15 segundos cuando la verificación de API key falla definitivamente
- **SC-003**: Cuando la generación de spec falla, el usuario ve un mensaje de error claro en menos de 5 segundos desde que ocurre el fallo
- **SC-004**: Un usuario activo mantiene su sesión sin interrupciones visibles durante al menos 8 horas de uso continuo
- **SC-005**: El comando de desarrollo limpio resuelve el 100% de los errores 404 de chunks y pérdida de CSS causados por caché stale
- **SC-006**: La suite completa de tests pasa sin regresiones después de todas las correcciones aplicadas

## Assumptions

- El sistema está en estado funcional con 235/235 tareas completadas — los errores son de configuración, manejo de errores y resiliencia, no de funcionalidad core
- El servicio de Anthropic es generalmente disponible pero puede experimentar latencia variable (>5s ocasionalmente)
- Los errores 404 de chunks y pérdida de CSS son exclusivamente causados por caché stale de compilación, no por errores en el código fuente
- La arquitectura de tokens JWT (access + refresh) se mantiene sin cambios — solo se agrega la renovación proactiva en el frontend
- El entorno de desarrollo local tiene las dependencias necesarias instaladas (Node.js, PostgreSQL, Redis)
