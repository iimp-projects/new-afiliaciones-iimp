# Plan de Convergencia Git — Afiliaciones IIMP

> **⚠️ HISTÓRICO / ACTUALIZADO.** El plan Fase 5A–5D siguiente (2026-10-16, rama
> `integration/afiliaciones-consolidacion-20261016`, base `e856422`/`13b26ea`) describe un
> estado ya superado. La convergencia real se ejecutó vía PRs #22–#26 y hoy `origin/master`
> (`a204222`, PROD = `ba591b4`) y `origin/development` (`184dfb5`) están **divergidas**.
> Ver abajo "Estado actual (2026-10-26)" y `docs/auditorias/AFILIACIONES-RELEASE-AUDIT-01.md`.

> Fase 5A (auditoría final). Fecha: 2026-10-16.
> Rama de integración: `integration/afiliaciones-consolidacion-20261016` (HEAD `97e4ed1`).
> Este documento es una PROPUESTA. No se han ejecutado merges.

## Estado actual (2026-10-26)

- **PROD (`origin/master` `a204222`):** despliega `ba591b4` (PR #26) = SMTP multiproveedor + parches de seguridad (`next 16.4.3`, `zod 4.6.7`, `puppeteer 25.16.0`, `follow-redirects 1.16.1`, aval por asociado activo).
- **DEV (`origin/development` `184dfb5`):** Niubiz CERT-02 + sincronización documental no destructiva + importe real/código postal. **Falta** el bump de seguridad y el enum/migración SMTP.
- **Divergencia `master ↔ development`:** master +11 (CI/seguridad/SMTP) vs development +8 (Niubiz/pagos/sync). Ya no es cadena lineal.

### Secuencia de PRs recomendada (sin ejecutar)

1. **PR-A — Seguridad:** realinear `development` a `master` (deps + `schema.prisma` `EmailSmtpAccount` + migración `20261023000000`).
2. **PR-B — Niubiz CERT-02 + pagos** (`dd0aecb`→`0345d13` + `184dfb5`).
3. **PR-C — Sincronización documental** (`8c4de8e` ≡ `8fe8b9f`).
4. **PR-D — Aval histórico SIE** (`0157765`, reconciliado con `1a06033`).
5. **PR-E (decidir):** `feature/actualizar-contenido` (#19), `hotfix/qa-whatsapp-wamid-tracing`, `hotfix/aval-prod-minimal`.

Detalle completo en `docs/auditorias/AFILIACIONES-RELEASE-AUDIT-01.md`. Documento original (histórico) a continuación.

---


## 1. Topología final propuesta

```
main (nueva base estable) ── derivada de la línea PROD consolidada
  └─ qa ─────────────────── validación de cambios antes de producción
  └─ release/* ──────────── releases inmutables (histórico)
feature/*  ────────────────── desarrollos temporales
hotfix/*  ─────────────────── correcciones urgentes
```

**Fuente de verdad:** la línea PROD (`release/directorio-unificado-prod` → `e856422`), por ser el código desplegado y funcional. `master` y `qa` deben converger hacia ella sin reescribir historial.

## 2. Estado de convergencia (resumen)

| Línea | Commit | Relación con integración |
|---|---|---|
| PROD desplegado | `e856422` | **BASE** (integración = e856422 + docs/tests + SieActiveCodeSyncService) |
| QA desplegado | `a7f55ff` | Convergido en app code; difiere en provisión PENDING + scripts históricos |
| master local | `e799400` | Divergente: tiene selección SMTP + cuota (3 migraciones extra) |
| origin/master | `13b26ea` | = master + carnet MVP (#20) + CI (#21); ya reflejado en la base |
| release PROD posterior | `6aad2e3` | Enriquecimiento histórico (script manual) |

## 3. Funcionalidades PENDIENTES de integración

| Funcionalidad | Origen | Commit | Estado | Bloqueo |
|---|---|---|---|---|
| Selección de cuentas SMTP | master | `74bb8d8` | PENDIENTE | Decisión arquitectónica (cuenta fija DEFAULT vs selección); NO activar PROV |
| Cuota por proveedor | master | `74bb8d8` | PENDIENTE | Decisión; preservar cuota global actual |
| 3 migraciones SMTP de master | master | `74bb8d8` | PENDIENTE | `20261009000000_add_email_campaign_smtp_account`, `20261009180000_add_smtp_daily_quota`, `20261009190000_add_email_campaign_paused_by_quota` |
| Provisión PENDING SIE | QA | `e6749d9`/`b7e1b5e` | PRESERVADA EN ORIGEN | Seguridad (ACTIVE vs PENDING) |
| Enriquecimiento histórico | `6aad2e3` | `sie-historical-profile-enrichment.ts` | PENDIENTE | Herramienta manual; riesgos de sobrescritura |
| Validaciones SIE de carnet | worktree | (untracked) | PRESERVADA EN ORIGEN | PROD las desactivó (`cfbcdc3`) |
| Scripts históricos QA | QA | varios | PRESERVADA EN ORIGEN | Herramientas manuales, no automatizar |

## 4. Decisiones arquitectónicas pendientes

1. **SMTP:** mantener DEFAULT activo; evaluar selección de cuentas + cuota de master **sin** activar PROV; no mezclar con la recuperación del error Gmail 535 (separado).
2. **SIE provisión:** conservar ACTIVE desplegado; documentar contrato PENDING; no activar nuevas políticas.
3. **Carnet:** emisión deshabilitada por defecto (`CARD_ISSUANCE_ENABLED=false`); evaluar variantes SIE; no emitir.
4. **Prisma:** 40 migraciones versionadas (PROD/QA) + 3 exclusivas de master (SMTP). Comparar checksums; no editar migraciones aplicadas.
5. **Infra:** Terraform difiere entre ramas (`pgproxy`, `security`, `campaign-send-tick`). Verificar que ningún merge revierta arreglos de RDS/SMTP; no `terraform apply`.

## 5. Plan de integración por lotes (propuesta)

| Lote | Contenido | Origen | Pruebas | Criterio de aceptación |
|---|---|---|---|---|
| 1 | (Ya hecho) Base PROD + SieActiveCodeSyncService + docs | PROD/QA | 478 tests | tsc/eslint/validate/build verdes |
| 2 | Selección SMTP + cuota (solo si se autoriza) | master `74bb8d8` | smtpQuota.test + regresión correos | No activar PROV; circuit-breaker intacto; 3 migraciones aplicadas solo si se decide |
| 3 | Provisión PENDING SIE (solo si se autoriza contrato) | QA | SieUserProvisioningService.test | No alterar usuarios; ACTIVE sigue funcionando |
| 4 | Enriquecimiento histórico (herramienta manual) | `6aad2e3` | manual, dry-run | No auto-ejecutable; reporte de conflictos |
| 5 | Validaciones SIE de carnet (solo si se autoriza) | worktree | cardData.test | Emisión sigue deshabilitada |

**Condición de rollback local:** cada lote se hace en un commit separado sobre la rama de integración; el rollback es `git reset --hard <commit-anterior>` (local, sin push).

## 6. Riesgos

- Reintroducir `new MailService("PROV")` desde master (rompe campañas, PROV no configurado).
- Revertir el circuit-breaker (master no lo tiene).
- Aplicar las 3 migraciones SMTP de master sin decisión (cambio de esquema).
- Revertir arreglos de RDS/SMTP/Terraform al fusionar infraestructura.
- Activar la provisión PENDING sin contrato (cambia comportamiento de cuentas).
- Re-activar validaciones SIE de carnet (cambia elegibilidad de carnets).

## 7. Validaciones obligatorias (previa a cualquier despliegue)

- `tsc --noEmit`, `eslint`, `vitest run` (478+ tests), `prisma validate`.
- `next build` (verificado viable con placeholders + red).
- Revisión manual del diff de cada lote; escaneo de secretos.
- Comparación de `terraform plan` (sin apply) para QA y PROD.
- Regresión: SMTP DEFAULT, circuit-breaker, subsanaciones, SIE/auth, carnet (emisión OFF), notificaciones.

## 8. Plan para actualizar master y QA (posterior)

1. Converger `main`/`master` a la línea de integración consolidada (merge, no rebase, sin force-push).
2. Recrear `qa` desde `main` + cambios QA autorizados.
3. Mantener `release/*` como históricos inmutables.
4. Actualizar `main` **solo tras** validar contra PROD (nunca asumir paridad).

## 9. Estrategia de archivado (sin eliminación automática)

- Ramas ya fusionadas: etiquetar `archive/` (renombrar) o dejar intactas; NO `branch -D`.
- Worktrees temporales (detached/prunable): no limpiar en esta fase.
- Scripts históricos: conservar en `scripts/` con header de "no ejecutar en producción" y listado en la matriz.

## 10. Estado del build

- **BUILD = PASS** en el worktree aislado con `DATABASE_URL`/`AUTH_SECRET`/`JWT_SECRET`/`PAYMENT_AUTH_SECRET` placeholders y red disponible.
- Chromium **no** es bloqueante del build (solo runtime PDF). El `next/font/google` requiere red (disponible).
- Sin conexiones a PROD/QA ni efectos externos.

## 11. Resultado Fase 5B (ejecución por lotes)

Punto de recuperación creado: `backup/integration-4ec0240` (ref no destructiva).

| Lote | Funcionalidad | Decisión | Motivo |
|---|---|---|---|
| 1 | Selección SMTP + cuota por proveedor (master `74bb8d8`) | **PRESERVADA EN ORIGEN / PENDIENTE DE ACTIVACIÓN** | Requiere 3 migraciones; la migración `add_email_campaign_smtp_account` define `smtp_account DEFAULT 'PROV'` (revertiría el fix DEFAULT `38c8fe2`). |
| 2 | Provisión SIE PENDING (QA `e6749d9`) | **PRESERVADA EN ORIGEN** | Decisión de seguridad ACTIVE vs PENDING; no cambiar política activa. |
| 3 | Enriquecimiento histórico (`6aad2e3`) | **PRESERVADA EN ORIGEN** | Herramienta manual con escritura a BD; no auto-ejecutable. |
| 4 | Variante SIE del carnet (worktree) | **PRESERVADA EN ORIGEN** | Decisión de negocio; PROD desactivó validaciones SIE (`cfbcdc3`). |
| 5 | Prisma / infra / scripts | **VERIFICADO, SIN CAMBIOS** | 40 migraciones versionadas; 3 de master pendientes; infra sin `apply`; scripts inventariados. |
| 6 | Validación integral | **PASS** | tsc 0, eslint 0, prisma validate válido, vitest 1783/1783, build PASS. |

**Resultado neto: sin cambios de código.** Las 4 funcionalidades pendientes quedan preservadas en sus ramas de origen (master, QA, `6aad2e3`, worktree/respaldo) con referencias exactas. Ningún merge, migración, script ni despliegue ejecutado.

### Referencias exactas de funcionalidades preservadas

- Selección SMTP + cuota: `master` (`e799400`), commit `74bb8d8`; migraciones `20261009000000_add_email_campaign_smtp_account`, `20261009180000_add_smtp_daily_quota`, `20261009190000_add_email_campaign_paused_by_quota`.
- Provisión PENDING: `release/sie-historicos-qa` (`a7f55ff`), commits `e6749d9`/`b7e1b5e`; `modules/afiliaciones/asociados/Services/SieUserProvisioningService.ts`.
- Enriquecimiento histórico: `release/directorio-unificado-prod` (`6aad2e3`); `scripts/sie-historical-profile-enrichment.ts`.
- Variante SIE carnet: respaldo persistente (worktree original, untracked); `modules/afiliaciones/carnet/Services/cardData.ts`, `cardPdf.ts`.

### Condiciones de activación futura (por funcionalidad)

- **SMTP cuota:** autorización de esquema (3 migraciones) + reemplazar `DEFAULT 'PROV'` por `DEFAULT` y conservar circuit-breaker; mantener DEFAULT activo.
- **Provisión PENDING:** contrato de seguridad explícito (activación de cuenta por flujo de verificación de correo); no migrar usuarios existentes.
- **Enriquecimiento:** ejecución manual con dry-run y reporte de conflictos; idempotencia verificada.
- **Carnet SIE:** autorización de negocio para re-activar elegibilidad SIE; mantener `CARD_ISSUANCE_ENABLED=false`.

## 12. Resultado Fase 5C (preparación final)

### Simulación de merge (`origin/master` ← `integration`)

- Merge-base: `7ab57e3`. Comandos usados: `git merge-tree --write-tree` (no destructivo, sin refs).
- **7 conflictos de archivo:** 5 de carnet (add/add: `carnet/page.tsx`, `cardData.ts`, `cardPdf.ts`, `cardData.test.ts`, `CardView.tsx`) + `NavigationService.test.ts` + `Config/Navigation.ts`.
- `prisma/schema.prisma` auto-merge (sin conflicto; requiere revisión de modelos de carnet).
- Commits únicos de `origin/master` (NO en integración): `13b26ea` (carnet MVP #20) y `86be950` (CI #21) — **ambos ya presentes en integración como cherry-picks** (`1192d4b`, `5f6971d`).
- Integración tiene **35 commits** no presentes en `origin/master`.
- **Riesgo SMTP:** `origin/master` usa `new MailService("PROV")`; la integración usa DEFAULT. El merge debe resolver a DEFAULT.

### Estrategia de PR propuesta

- **Origen:** `integration/afiliaciones-consolidacion-20261016` (`bad5d6c`).
- **Destino:** `master` (o nueva `main`).
- **Resolución de conflictos:** mantener carnet de integración (completo) y SMTP DEFAULT. NO usar ours/theirs sin análisis por archivo.
- **Fuera del PR:** selección SMTP + cuota (`74bb8d8`, solo en master local `e799400`) y sus 3 migraciones; provisión PENDING, enriquecimiento y carnet SIE (preservados en origen).
- **Reversión:** el PR es un merge; revertir es `git revert -m 1 <merge-commit>` o re-apuntar `master` a `13b26ea` (historial intacto).
- **Posterior:** alinear `qa` desde la nueva `main` + cambios QA autorizados; mantener `release/*` inmutables.
