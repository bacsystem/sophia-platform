# Test-Driven Development (TDD)

Aplica TDD para todo código funcional que generes. Las instrucciones de este documento son obligatorias cuando estén presentes en tu contexto.

## Ciclo RED-GREEN-REFACTOR

1. **RED** — Escribe el test primero. Debe fallar porque la implementación no existe.
2. **GREEN** — Escribe el mínimo código para que el test pase.
3. **REFACTOR** — Mejora el código sin cambiar comportamiento. Los tests deben seguir pasando.

## Estructura de tests

```
src/
├── modules/{nombre}/
│   ├── {nombre}.service.ts
│   └── __tests__/
│       └── {nombre}.service.test.ts
├── components/
│   ├── my-component.tsx
│   └── __tests__/
│       └── my-component.test.tsx
```

## Convenciones

- Archivos: `*.test.ts` para backend, `*.test.tsx` para frontend
- Usa `describe` para agrupar por unidad, `it` para cada caso
- Patrón AAA: Arrange → Act → Assert
- Un assert lógico por test (puede ser múltiples `expect` del mismo resultado)
- Nombra tests como comportamiento: `it('returns 404 when project not found')`
- Mock solo dependencias externas (DB, APIs, filesystem)

## Qué testear

- Cada función pública del service
- Cada ruta/endpoint (happy path + error cases)
- Validaciones de schema (inputs inválidos)
- Edge cases: listas vacías, null, límites numéricos

## Qué NO testear

- Getters/setters triviales
- Código de terceros (Prisma, Fastify internals)
- Estilos CSS o layout puro
