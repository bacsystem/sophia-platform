## Descripción
<!-- Qué hace este PR en 1-2 oraciones -->

## Módulo / Feature
<!-- M1 Auth | M2 Projects | M9 Improvements | 010-feature-name | etc. -->

## Tipo de cambio
- [ ] ✨ Nueva feature (módulo nuevo o feature dentro de módulo)
- [ ] 🐛 Bug fix
- [ ] ♻️ Refactor (sin cambio de funcionalidad)
- [ ] 📝 Documentación
- [ ] 🔒 Seguridad
- [ ] ⚡ Performance

## HUs completadas
<!-- Lista las HUs implementadas en este PR -->
- HU-XX: nombre
- HU-XX: nombre

## Checklist de calidad
### Backend
- [ ] `pnpm --filter @sophia/api lint` → zero violations
- [ ] `pnpm --filter @sophia/api build` → zero TypeScript errors
- [ ] `pnpm --filter @sophia/api test` → all tests pass

### Frontend
- [ ] `pnpm --filter @sophia/web lint` → zero violations
- [ ] `pnpm --filter @sophia/web build` → zero errors
- [ ] Rutas nuevas accesibles desde navegación principal
- [ ] Flujo post-login funciona correctamente

### Documentación
- [ ] `docs/task-tracker.md` actualizado con nuevo conteo
- [ ] `docs/superpowers/plans/*.md` checkboxes marcados `[X]`
- [ ] `CHANGELOG.md` actualizado con entrada de versión
- [ ] `CLAUDE.md` Sprint Status actualizado
- [ ] `package.json` versión bumpeada

### Agentes (si aplica)
- [ ] `docs/context-map.md` actualizado si hay nuevas dependencias cross-module
- [ ] `docs/certifications.md` actualizado si hay nuevas HUs certificadas
- [ ] `docs/system-design.html` actualizado si cambió la arquitectura

## Tests añadidos
<!-- Nuevos archivos de test o nuevos casos -->
- `path/to/test.ts` — describe qué cubre

## Breaking changes
<!-- Cambios que rompen compatibilidad con versiones anteriores. Si no hay, escribir "Ninguno" -->

## Screenshots (si aplica)
<!-- Para cambios de UI -->

## Notas para el reviewer
<!-- Contexto adicional, decisiones técnicas, trade-offs -->