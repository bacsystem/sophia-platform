# Investigating Test Failures

## Proceso de diagnóstico sistemático

Cuando recibes un retry por Quality Gate fallido, sigue este proceso:

1. **Identificar criterios faltantes** — Revisa la lista de `criteriaId` no cubiertos
2. **Localizar archivos relevantes** — Lee los archivos de servicio/controlador/componente relacionados
3. **Analizar cobertura existente** — Revisa `test-mapping.json` para entender qué ya está cubierto
4. **Escribir tests específicos** — Un test por criterio faltante, nombrado `[criteriaId] — [descripción]`
5. **Actualizar test-mapping.json** — Agregar entradas para cada test nuevo

## Patrones comunes de fallo

| Patrón | Causa típica | Solución |
|--------|-------------|----------|
| Criterio de validación no cubierto | Falta test 422 con input inválido | Agregar test con payload incorrecto |
| Criterio de auth no cubierto | Falta test 401 sin cookie | Agregar test sin `access_token` |
| Criterio de aislamiento no cubierto | Falta test con otro usuario | Crear segundo usuario, verificar 404 |
| Criterio de edge case no cubierto | Falta test de caso límite | Agregar test con datos extremos |

## Formato de investigation-report.md

Si se agotan los reintentos, genera `investigation-report.md` con:

```markdown
# Investigation Report

## Criterios no cubiertos
### [criteriaId]: [descripción]
- **Hipótesis:** por qué no se pudo cubrir
- **Archivos sospechosos:** archivos que deberían implementar la lógica
- **Recomendación:** acción manual sugerida

## Resumen
- Cobertura alcanzada: X%
- Criterios cubiertos: N/M
- Bloqueadores identificados: [lista]
```
