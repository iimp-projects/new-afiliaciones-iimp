# Registro de decisiones técnicas

Usa este archivo como índice de decisiones duraderas. No registres aquí cambios triviales ni decisiones todavía no aprobadas.

## Decisiones vigentes observadas

| ID | Decisión | Evidencia |
| --- | --- | --- |
| ADR-001 | Organización principal por dominio en `modules/`. | `docs/ARCHITECTURE.md` y estructura real. |
| ADR-002 | PostgreSQL con Prisma; schema como fuente de estructura persistida. | `prisma/schema.prisma`. |
| ADR-003 | Sesiones persistidas y autorización RBAC mediante `contextService`. | `docs/AUTHENTICACION.md` y `modules/auth`. |
| ADR-004 | Matriz compartida para Postulación y Consulta. | `docs/APPLICATION_MATRIX.md`. |
| ADR-005 | `proxy.ts` reemplaza la convención obsoleta `middleware.ts` en Next.js 16. | `proxy.ts` y build vigente. |
| ADR-006 | Compuerta local: typecheck + ESLint bloqueante + Vitest. | `package.json` y `docs/QUALITY_GATES.md`. |

## Plantilla para una nueva decisión

```markdown
## ADR-NNN — Título

- Estado: propuesta | aceptada | reemplazada
- Fecha: YYYY-MM-DD
- Contexto:
- Decisión:
- Alternativas consideradas:
- Consecuencias:
- Migración/rollback:
- Evidencia y enlaces:
```

Si la decisión cambia datos, seguridad, pagos o contratos externos, requiere aprobación explícita antes de marcarse aceptada.
