# PR — Convergencia de integración a master (PROPUESTA, no publicada)

> **Estado:** propuesta preparada. **No publicada** (pendiente de autorización).

## Rama origen y destino

- **Origen:** `integration/afiliaciones-consolidacion-20261016` (HEAD `f8d805b`, base funcional `bad5d6c`).
- **Destino:** `master` (actualmente `13b26ea` en origin).

## Resumen funcional

Consolida en una sola línea todo el desarrollo desplegado en PROD (`e856422`) y QA (`a7f55ff`), más la clasificación de códigos SIE (`SieActiveCodeSyncService`) y la documentación de consolidación.

## Cambios incluidos

- SMTP DEFAULT activo + circuit-breaker (ventana temporal + "tras último SENT") + clasificación de errores 535/421/450.
- Correos masivos (motor server-side, deduplicación, pausa/reanudación, personalización de asociados).
- Subsanaciones legacy (comparación semántica de borradores + especialidades históricas).
- SIE directorio unificado + reconciliación de identidades + `SieActiveCodeSyncService` + `mustChangePassword`.
- Carnet virtual (emisión **deshabilitada** por defecto) + Centro de Notificaciones.
- 40 migraciones Prisma versionadas.

## Funcionalidades preservadas (fuera de este PR, en origen)

- Selección SMTP + cuota por proveedor (`master` `74bb8d8`) + 3 migraciones — pendiente de decisión.
- Provisión SIE PENDING (`QA`) — pendiente de decisión de seguridad.
- Enriquecimiento histórico SIE (`6aad2e3`) — herramienta manual.
- Variante SIE del carnet — pendiente de decisión de negocio.

## Conflictos a resolver (7)

| Archivo | Resolución |
|---|---|
| `app/(workspace)/intranet/mi-cuenta/carnet/page.tsx` (add/add) | Mantener versión de integración (carnet completo) |
| `modules/afiliaciones/carnet/Services/cardData.ts` (add/add) | Mantener integración (elegibilidad simplificada de PROD) |
| `modules/afiliaciones/carnet/Services/cardPdf.ts` (add/add) | Mantener integración (con fallback "Pendiente de sincronización SIE") |
| `modules/afiliaciones/carnet/Tests/cardData.test.ts` (add/add) | Mantener integración |
| `modules/afiliaciones/carnet/Views/CardView.tsx` (add/add) | Mantener integración |
| `modules/navigation/Tests/NavigationService.test.ts` (content) | Mantener integración |
| `modules/security/Config/Navigation.ts` (content) | Mantener integración (incluye carnet + notificaciones) |

**SMTP:** garantizar `CampaignMailService` queda con `new MailService()` (DEFAULT), nunca `"PROV"`.

## Pruebas ejecutadas

- Vitest completo: **1783/1783** (204 archivos).
- TypeScript 0 errores · ESLint 0 errores · Prisma validate válido · Next.js build PASS (placeholders + red).

## Migraciones incluidas

- Las 40 migraciones ya versionadas en integración. **No** se incluyen las 3 migraciones SMTP de master (pendientes). No se ejecuta `migrate deploy` como parte de este PR.

## Riesgos

- Reintroducir `new MailService("PROV")` si el merge no resuelve CampaignMailService a DEFAULT.
- Regresión de carnet si se elige la versión MVP de master sobre la completa.

## Plan de reversión Git

- `git revert -m 1 <merge-commit>` (revert del merge), o
- re-apuntar `master` a `13b26ea` (historial intacto, no destructivo).

## Confirmación de producción no modificada

- Este PR es **solo Git**. No ejecuta migraciones, no despliega, no toca AWS/SSM/RDS, no modifica usuarios ni datos. Los workflows de CI (`security.yml`) solo ejecutan quality gates; no hay deploy automático a producción.
