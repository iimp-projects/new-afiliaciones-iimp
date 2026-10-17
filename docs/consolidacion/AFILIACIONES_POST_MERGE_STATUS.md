# Estado post-merge — Afiliaciones IIMP

> Fase 6A. Fecha: 2026-10-16.

## Master consolidado

- `origin/master` = `3106816` (merge commit del PR #22, padres `13b26ea` + `03e7155`).
- Contiene: SMTP DEFAULT + circuit-breaker, correos masivos, subsanaciones legacy, SIE directorio unificado + `SieActiveCodeSyncService` + `mustChangePassword`, carnet virtual (emisión OFF), centro de notificaciones, 40 migraciones.

## Nuevo entorno de desarrollo

- Rama: `development/afiliaciones-post-consolidacion` (apunta a `3106816`, trackea `origin/master`).
- Worktree: `C:\xampp\htdocs\afiliaciones-desarrollo` (limpio, HEAD = `3106816`).

## Validaciones (worktree nuevo)

- Vitest completo: **1783/1783** (204 archivos).
- TypeScript **0 errores** · ESLint **0 errores** · Prisma validate **válido** · Next.js build **PASS** (placeholders).
- SMTP DEFAULT activo · Carnet emisión deshabilitada (`CARD_ISSUANCE_ENABLED=false`) · Notificaciones y SIE presentes · 40 migraciones.

## Referencias preservadas

- PROD `e856422` · QA `a7f55ff` · master local `e799400` (sin tocar) · integración `daee113` · rama PR `integration/pr-consolidacion-master` (`03e7155`).
- Respaldo persistente: `C:\Users\maxic\Documents\afiliaciones-iimp-backup-20261016`.
- Repositorio original: `qa/adjuntos-opcionales` (`496a5d5`, 124 líneas sin commitear) — intacto.

## Diferencias pendientes (4 funcionalidades preservadas en origen)

1. Selección SMTP + cuota por proveedor — `master` local `74bb8d8` (3 migraciones).
2. Provisión SIE PENDING — QA `e6749d9`/`b7e1b5e`.
3. Enriquecimiento histórico SIE — `6aad2e3`.
4. Variante SIE del carnet — respaldo del worktree original.

Ninguna se activa. Recuperables desde sus referencias.

## Plan de alineación QA (propuesto, no ejecutado)

- QA (`a7f55ff`) difiere del nuevo master (`3106816`) en 20 archivos de app/código:
  - `SieLegacyCredentialService.ts` (QA sin `activateLegacyAccount`/`provisionLegacyAccount`).
  - `SieUserProvisioningService.ts` (QA-exclusivo, PENDING).
  - Circuit-breaker (QA simple; master con ventana temporal).
  - 10 scripts SIE de migración/provisión (QA-exclusivos).
- **Propuesta:** alinear QA sobre el master consolidado (re-branch de QA desde `3106816`), conservando `SieUserProvisioningService` (PENDING) y los scripts SIE como referencia **sin** re-aplicarlos automáticamente. Decisión de seguridad pendiente (ACTIVE vs PENDING).
- **No** se actualiza QA ni se publica PR en esta fase.

## Restricciones de producción

- No desplegar, no migrar, no modificar usuarios/credenciales, no Terraform apply, no ejecutar scripts históricos.
- Próximo paso requiere autorización: publicar el PR de alineación QA.
