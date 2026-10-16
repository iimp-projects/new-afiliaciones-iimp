# Matriz de Preservación de Funcionalidades — Afiliaciones IIMP

> Consolidación Git **Fase 1** — SMTP, correos masivos y circuit-breaker.
> Fecha: 2026-10-16
> Rama de integración: `integration/afiliaciones-consolidacion-20261016`
> Base: `e856422` (imagen PROD `prod-e856422-enrich`)

## Referencias

| Referencia | Commit | Nota |
|---|---|---|
| PROD | `e856422` | imagen `prod-e856422-enrich`; línea `release/directorio-unificado-prod` |
| QA | `a7f55ff` | imagen `qa-a7f55ff…`; rama `release/sie-historicos-qa` |
| master local | `e799400` | divergente (2 commits únicos) |
| origin/master | `13b26ea` | merge PR #20 (carnet MVP) |
| HEAD | `496a5d5` | `qa/adjuntos-opcionales` |

## Resumen ejecutivo

La base de integración `e856422` **ya contiene** la implementación canónica del módulo de correos masivos y su configuración SMTP (SMTP DEFAULT + circuit-breaker + clasificación de errores + deduplicación + lotes + reanudación + personalización). No se importó código equivalente de `fix/*` (ya es ancestro de la base) ni de `qa/*` (cherry-picks idénticos por patch-id).

**master/HEAD** desarrollaron en paralelo una variante incompatible: `new MailService("PROV")` por defecto, sin circuit-breaker, y con dos funcionalidades exclusivas — **selección de cuentas SMTP** y **cuota diaria por proveedor** (`Config/smtpAccounts.ts`, `Config/smtpQuota.ts`, `Services/SmtpQuotaService.ts`, `Repositories/SmtpQuotaRepository.ts`). Estas dos funcionalidades **NO se incorporaron** en esta fase y quedan **PRESERVADAS EN ORIGEN** (rama `master`, commit `74bb8d8`), documentadas como PENDIENTES para decisión arquitectónica posterior.

## Convenciones de decisión

- **INTEGRADA** — presente y activa en la base de integración.
- **PRESERVADA EN ORIGEN** — se conserva en su rama/commit original; no se incorpora aún.
- **PENDIENTE** — requiere decisión arquitectónica; documentada, no eliminada.
- **BLOQUEADA** — requiere resolver conflictos antes de decidir.

## Matriz resumen

| Funcionalidad | Rama/commit origen | PROD | QA | master | Integración | Decisión |
|---|---|---|---|---|---|---|
| Correos masivos (módulo base) | `35b9275` (master ancestral) | SÍ | SÍ | SÍ | SÍ | INTEGRADA |
| SMTP DEFAULT activo para campañas | `38c8fe2` / `5bb2a83` | SÍ | SÍ | **NO (usa PROV)** | SÍ | INTEGRADA |
| SMTP PROV (implementación) | `env.ts getSmtpConfig` | Sí (latente) | Sí (latente) | Sí (activo por defecto) | Sí (latente) | PRESERVADA (aislada) |
| Circuit-breaker SMTP | `35e2597` | SÍ | SÍ | **NO** | SÍ | INTEGRADA |
| Clasificación errores 535/421/450/429 | `MailService.ts` (canónico) | SÍ | SÍ | NO (simplificado) | SÍ | INTEGRADA |
| Deduplicación de destinatarios | `6750401` (reserva atómica) | SÍ | SÍ | Parcial | SÍ | INTEGRADA |
| Procesamiento por lotes | `220045c` (motor) | SÍ | SÍ | SÍ | SÍ | INTEGRADA |
| Reanudación segura (pausa) | migración `20261013000000` | SÍ | SÍ | NO | SÍ | INTEGRADA |
| Personalización de asociados | `1a1c2fe` / `63971c0` / `30fbcd7` | SÍ | SÍ | Parcial (otra plantilla) | SÍ | INTEGRADA |
| Selección de cuentas SMTP | `74bb8d8` (master) | NO | NO | SÍ | NO | PENDIENTE (preservada) |
| Cuota por proveedor | `74bb8d8` (master) | NO | NO | SÍ | NO | PENDIENTE (preservada) |
| Estados SENT/ERROR/PENDING | `email_deliveries` / `email_campaign_recipients` | SÍ | SÍ | SÍ | SÍ | INTEGRADA |

## Detalle por funcionalidad

### 1. Correos masivos (módulo base)
- **Descripción:** campañas de correo a asociados con destinatarios, listas, plantillas y motor de envío.
- **Origen:** commit `35b9275` ("feat(communications): add mass email campaigns module"), ancestro común de PROD/QA/master.
- **Estado:** PROD SÍ · QA SÍ · master SÍ · Integración SÍ.
- **Pruebas:** `CampaignService.test.ts`, `CampaignActions.test.ts`, `CampaignMailService.test.ts`, `CampaignSendService.test.ts`, `EmailDeliveryRepository.test.ts`, `RecipientImport.test.ts`, `RecipientListService.test.ts`, `TemplateRenderer.test.ts`.
- **Conflictos:** master divergió en la personalización (plantilla `AssociateWelcomeTemplate.ts` vs `Templates/BienvenidaAccesoTemplate.ts`) y en la cuenta SMTP.
- **Decisión:** INTEGRADA. **Evidencia:** 189 tests verdes en la base de integración.

### 2. SMTP DEFAULT activo para campañas
- **Descripción:** las campañas envían por la cuenta institucional `SMTP_*` (Gmail `smtp.gmail.com:465`), no por PROV.
- **Origen:** `fix/correos-masivos-smtp` (`38c8fe2`), cherry-pick equivalente `qa/correos-masivos-smtp` (`5bb2a83`).
- **Estado:** PROD SÍ · QA SÍ · master NO (usa `new MailService("PROV")`) · Integración SÍ.
- **Pruebas:** `CampaignMailService.smtp-account.test.ts` (nueva, 2 casos), `lib/config/env.test.ts` (`getSmtpConfig` DEFAULT/PROV).
- **Conflictos:** master/HEAD revirtieron a PROV; PROV no está configurado en SSM de PROD.
- **Decisión:** INTEGRADA (DEFAULT es canónico). **Evidencia:** constructor de `CampaignMailService` en `e856422` = `new MailService()`; test nuevo verifica que valida con `SMTP_*` y falla con solo `PROV_MAIL_*`.

### 3. SMTP PROV (implementación)
- **Descripción:** cuenta institucional independiente vía `PROV_MAIL_*` (usuario/clave propios), soportada por `getSmtpConfig(env, "PROV")`.
- **Origen:** `lib/config/env.ts` (`getSmtpConfig`, tipo `SmtpAccount = "DEFAULT" | "PROV"`), presente en todas las líneas.
- **Estado:** PROD latente (código presente, no activo) · QA latente · master activo por defecto (erróneo) · Integración latente.
- **Pruebas:** `lib/config/env.test.ts` ("PROV resuelve desde PROV_MAIL_*", "PROV NO hace fallback silencioso a DEFAULT").
- **Conflictos:** master lo usó por defecto para campañas; PROD/QA lo desactivaron (`38c8fe2`).
- **Decisión:** PRESERVADA EN ORIGEN (aislada, no activa). **Evidencia:** `getSmtpConfig` conserva soporte PROV; `CampaignMailService` no lo referencia.

### 4. Circuit-breaker SMTP
- **Descripción:** pausa automática de la campaña ante N errores consecutivos de autenticación SMTP, con ventana temporal y posterior al último SENT.
- **Origen:** `35e2597` ("circuit-breaker SMTP con ventana temporal y posterior al último SENT"), config en `Config/campaignSend.ts` (`CAMPAIGN_CIRCUIT_BREAKER_THRESHOLD=5`, `_COOLDOWN_MS=60m`, `_WINDOW_MS=15m`).
- **Estado:** PROD SÍ · QA SÍ · master NO · Integración SÍ.
- **Pruebas:** `CampaignSendService.pause.test.ts`.
- **Conflictos:** master no tiene `countConsecutiveAuthErrors` ni la config de circuit-breaker.
- **Decisión:** INTEGRADA. **Evidencia:** `EmailDeliveryRepository.countConsecutiveAuthErrors` presente en `e856422`.

### 5. Clasificación de errores SMTP (535/421/450/429)
- **Descripción:** `sanitizeMailError` mapea EAUTH/535→AUTH, ECONNECTION/ETIMEDOUT→CONNECTION, 421/429/450/451/452→RATE_LIMITED, cuota→QUOTA_EXCEEDED, 4xx/5xx→PERMANENT.
- **Origen:** `modules/shared/Services/MailService.ts` (canónico en PROD/QA).
- **Estado:** PROD SÍ · QA SÍ · master NO (versión simplificada sin `MailErrorKind`) · Integración SÍ.
- **Pruebas:** `MailService.test.ts` (clasificación 535/421/450/429/cuota).
- **Conflictos:** master tiene `sanitizeMailError` que devuelve solo string, sin `kind`.
- **Decisión:** INTEGRADA. **Evidencia:** `MailErrorKind` y `SMTP_AUTH_ERROR_MESSAGE` presentes en `e856422`.

### 6. Deduplicación de destinatarios
- **Descripción:** reserva atómica del delivery (crea `EmailDelivery` en la misma transacción) y detección de envíos en vuelo para no duplicar.
- **Origen:** `6750401` ("reserva atómica crea delivery en la misma transacción"), constraint única `[campaignId, recipientId, attemptNumber]`.
- **Estado:** PROD SÍ · QA SÍ · master parcial · Integración SÍ.
- **Pruebas:** `EmailDeliveryRepository.test.ts` (recoverStaleDeliveries, hasInFlightDelivery, createPendingDelivery), `CampaignMailService.test.ts` (P2002 → SKIPPED).
- **Decisión:** INTEGRADA.

### 7. Procesamiento por lotes
- **Descripción:** motor server-side independiente de sesión/navegador, un lote por tick (`CAMPAIGN_BATCH_SIZE`), invocado por timer systemd.
- **Origen:** `220045c` ("motor de envío independiente de sesión y navegador") + `ec8ab60` (timer).
- **Estado:** PROD SÍ · QA SÍ · master SÍ · Integración SÍ.
- **Pruebas:** `CampaignSendService.test.ts`, `CampaignSendService.worker.test.ts`.
- **Decisión:** INTEGRADA.

### 8. Reanudación segura (pausa)
- **Descripción:** `pausedUntil`/`pauseReason` en `email_campaigns`; reanuda automáticamente al vencer la espera; recupera deliveries obsoletos.
- **Origen:** migración `20261013000000_add_email_campaign_pause` + `CampaignSendService.pauseCampaign`.
- **Estado:** PROD SÍ · QA SÍ · master NO · Integración SÍ.
- **Pruebas:** `CampaignSendService.pause.test.ts`.
- **Decisión:** INTEGRADA. **Evidencia:** migración presente en BD PROD (auditoría previa) y en `CampaignSendService`.

### 9. Personalización de correos de asociados
- **Descripción:** resuelve `{{nombre_completo}}`/`{{correo_acceso}}`/`{{enlace_activacion}}` desde la fuente de autenticación; excluye si el correo cambió.
- **Origen:** `1a1c2fe` (integración) + `63971c0` (por userId) + `30fbcd7` (prueba); archivos `AssociateRecipientRepository.ts`, `Templates/BienvenidaAccesoTemplate.ts`.
- **Estado:** PROD SÍ · QA SÍ · master parcial (usa `AssociateWelcomeTemplate.ts` distinto) · Integración SÍ.
- **Pruebas:** `CampaignMailService.associate.test.ts`, `AssociateRecipientSourceService.test.ts`.
- **Decisión:** INTEGRADA (enfoque de PROD/QA).

### 10. Selección de cuentas SMTP (EXCLUSIVA de master)
- **Descripción:** permite elegir la cuenta SMTP por proveedor (`Config/smtpAccounts.ts`).
- **Origen:** master local `e799400`, commit `74bb8d8` ("seleccion de cuenta SMTP y cuota diaria por proveedor").
- **Estado:** PROD NO · QA NO · master SÍ · Integración NO.
- **Pruebas:** no específicas en base (residen en `Tests/smtpQuota.test.ts` de master).
- **Conflictos:** incompatible con el modelo "cuenta fija DEFAULT" de PROD; introduciría el riesgo de volver a PROV por defecto.
- **Decisión:** **PENDIENTE** (PRESERVADA EN ORIGEN). **Evidencia:** archivos `Config/smtpAccounts.ts` presentes únicamente en `e799400`, no en `e856422`.

### 11. Cuota por proveedor (EXCLUSIVA de master)
- **Descripción:** tope diario de envíos por proveedor (`Config/smtpQuota.ts`, `Services/SmtpQuotaService.ts`, `Repositories/SmtpQuotaRepository.ts`).
- **Origen:** master local `e799400`, commit `74bb8d8`.
- **Estado:** PROD NO (usa `CAMPAIGN_DAILY_QUOTA_LIMIT` global) · QA NO · master SÍ · Integración NO.
- **Pruebas:** `Tests/smtpQuota.test.ts` (en master).
- **Conflictos:** requiere decisión arquitectónica (cuota global vs por proveedor) sin romper la cuota global actual de PROD.
- **Decisión:** **PENDIENTE** (PRESERVADA EN ORIGEN). **Evidencia:** archivos `Config/smtpQuota.ts` y `Services/SmtpQuotaService.ts` presentes únicamente en `e799400`.

### 12. Estados SENT/ERROR/PENDING
- **Descripción:** estados en `email_deliveries` (por intento) y `email_campaign_recipients` (por destinatario); contadores `sendCount`/`lastSentAt`.
- **Origen:** migraciones `20261012000000_add_email_campaign_recipient_metadata` y `20261013000000_add_email_campaign_pause` + repositorios.
- **Estado:** PROD SÍ · QA SÍ · master SÍ · Integración SÍ.
- **Pruebas:** `EmailDeliveryRepository.test.ts`, `CampaignSendService.test.ts`.
- **Decisión:** INTEGRADA.

## Funcionalidades de master NO incorporadas (PRESERVADAS)

> Una funcionalidad PENDIENTE **no equivale a eliminada**. Las ramas de origen y sus commits originales se conservan íntegramente.

| Funcionalidad | Rama origen | Commit | Archivos | Motivo de no incorporación |
|---|---|---|---|---|
| Selección de cuentas SMTP | `master` (`e799400`) | `74bb8d8` | `Config/smtpAccounts.ts` | Decisión arquitectónica; no activar PROV por defecto |
| Cuota por proveedor | `master` (`e799400`) | `74bb8d8` | `Config/smtpQuota.ts`, `Services/SmtpQuotaService.ts`, `Repositories/SmtpQuotaRepository.ts` | Decisión arquitectónica; preservar cuota global actual |

## Validación (Fase 1.4)

- TypeScript (`tsc --noEmit`): **0 errores** (tras regenerar el cliente Prisma con `DATABASE_URL` placeholder; ver nota).
- ESLint (focalizado `modules/communications` + `MailService` + `env.ts`): **0 errores**.
- Pruebas focalizadas (`vitest` sobre `modules/communications` + `MailService.test.ts`): **189/189 OK** (18 archivos).
- Prueba nueva: `modules/communications/Tests/CampaignMailService.smtp-account.test.ts` (2 casos).

> Nota de entorno: `npm ci` no generó el cliente Prisma porque `prisma.config.ts` exige `DATABASE_URL` incluso para `prisma generate`. Al regenerar con `DATABASE_URL` placeholder (`postgresql://…/placeholder`), `tsc` pasa a 0 errores. Es un requisito de tooling, no un defecto de código.

## Fase 2 — Subsanaciones legacy

### Auditoría comparativa (PROD vs QA vs hotfix)

| Referencia | Commit | Rol |
|---|---|---|
| Subsanación documental PROD | `10e73ba` | **ya en la base** (`e856422`) |
| Compatibilidad especialidades PROD | `f00a5d3` | **ya en la base** (`e856422`) |
| Subsanación documental QA | `fa3ec71` | EQUIVALENTE (0 diff en los 4 archivos) |
| Compatibilidad especialidades QA | `c579216` | OLDER: sin `DraftComparison`, sin notificaciones internas |
| Hotfix de contención | `6da2bfc` | CONTENCIÓN TEMPORAL (no activar) |

### Conclusiones

1. **La base `e856422` ya contiene la implementación canónica** de subsanaciones:
   - `DraftComparison.ts` (`findUnauthorizedChange` + `normalizeForComparison`): comparación semántica que trata `null`/`undefined`/`""` como vacíos equivalentes (fix "sin bloqueos por normalización").
   - `StudentAcademicRules.ts`: `LEGACY_STUDENT_SPECIALTY_CODES` (`ESP-MIN`, `ESP-GEO`, `ESP-MET`, `ESP-GEOL`) y raíces terminológicas (minas/geología/metalurgia).
   - `AcademicInfoPersistence.ts`: `cycle` numérico → `termOrSemester` string (`String(study.cycle)`).
   - Notificaciones internas (`ApplicationNotificationEvents.notifyCorrectionReceived`) y correo (`NotifyApplicantService`).
   - `markCorrectionSubmitted` en transacción (integridad de documentos, historial `membershipValidationHistory`, auditoría).

2. **No hay mejoras exclusivas en QA** que importar: `fa3ec71` es equivalente (0 diff) y `c579216` es una versión anterior (comparación inline con `JSON.stringify` sin normalización, y sin notificaciones). Nada que incorporar.

3. **Hotfix `6da2bfc`** bloqueaba temporalmente el guardado OBSERVED (mensaje "en mantenimiento") para impedir la pérdida de documentos por `syncPersistedEntities`. Es **CONTENCIÓN TEMPORAL**, superada por la corrección definitiva ya presente en la base. **No se activa**; se conserva como referencia histórica.

### Funcionalidades únicas preservadas (PRESERVADAS EN ORIGEN)

| Funcionalidad | Rama/commit | Estado |
|---|---|---|
| Comparación inline de borradores (QA `c579216`) | `fix/afiliaciones-legacy-specialty-compatibility` | PRESERVADA EN ORIGEN (superada por `DraftComparison`) |
| Contención temporal de subsanaciones | `hotfix/containment-subsanacion` `6da2bfc` | PRESERVADA EN ORIGEN (no activar) |

### Casos históricos cubiertos por la base

- Solicitud OBSERVED → subsanación permitida (rutas observadas).
- Solicitud COMPLETED → edición rechazada (`APPLICATION_NOT_EDITABLE`).
- Actualización exclusiva de `universityLetter`.
- `cycle` numérico → `termOrSemester` string.
- `null`/`""`/omitido equivalentes en comparación de borradores.
- Especialidades históricas `ESP-MIN`/`ESP-GEO`/`ESP-MET`/`ESP-GEOL`.
- Documentos no modificados se preservan (transacción).

### Pruebas ejecutadas (Fase 2.4/2.5)

- `DraftComparison.test.ts`, `LegacySpecialtyCompatibility.test.ts`, `AcademicInfoPersistence.test.ts`, `StudentAcademicRules.test.ts`, `AcademicStudyValidator.test.ts`.
- Regresión Fase 1 (SMTP/correos masivos) re-ejecutada: **sin regresión**.
- Total focalizado: **392 tests OK** (23 archivos). TypeScript **0 errores** · ESLint focalizado **0 errores**.

### Riesgos identificados

- Reintroducir el hotfix de contención bloquearía las subsanaciones (evitar).
- Importar `c579216` (QA) reintroduciría la comparación sin normalización semántica → regresión de "bloqueos por normalización".

### Decisiones pendientes

- Ninguna pendiente en esta fase: la base ya es canónica. (Pendientes globales documentados arriba: selección de cuentas SMTP y cuota por proveedor.)

## Cambios de esta fase (Fase 2)

- Sin cambios de código de producción: la base `e856422` ya contiene la implementación canónica de subsanaciones.
- Documentación actualizada: este archivo (sección Fase 2).
- Ningún merge/cherry-pick/rebase ejecutado. Ningún archivo de producción modificado.

## Fase 3A — SIE histórico, directorio unificado y autenticación (auditoría)

### Auditoría de commits (7ab57e3 → e856422 PROD vs 7ab57e3 → a7f55ff QA)

| Área | PROD (`e856422`) | QA (`a7f55ff`) | Estado |
|---|---|---|---|
| Directorio unificado SIE+V2 + reconciliación | `a2a9925` (`SieNameReconciliation.ts`) | `a21305d` (mismo archivo) | **CONVERGIDO** (archivo idéntico) |
| Vinculación SAFE_MATCH | `6fbc678` (`sie-safe-match-link.ts`) | — | SOLO PROD (script) |
| Acceso histórico + mustChangePassword + password-change | `e5deb4e` | `6ce2a71`+`39b415b`+`a7f55ff` | **CONVERGIDO** (código idéntico) |
| Activar/provisionar cuentas históricas | `e856422` (métodos en `SieLegacyCredentialService`) | `e6749d9` (`SieUserProvisioningService`) | **DIVERGENTE** (ver conflicto) |
| Códigos institucionales SIE A/E | — | `527e8d2` (`SieActiveCodeSyncService`) | SOLO QA |
| Migración histórica (dry-run, lotes, análisis) | — | `73a25b0`, `4dbad69`, `eac1e82`, `aea313e` | SOLO QA (scripts) |
| Compatibilidad credenciales históricas (Clave 4-6) | (parcial en `e5deb4e`) | `6b78a03`, `c107394` | Convergido en servicio; scripts QA |

### Matriz de funcionalidades (SIE / autenticación)

| Funcionalidad | PROD | QA | master | Integración | Origen | Decisión |
|---|---|---|---|---|---|---|
| Consulta de asociados API SIE | SÍ | SÍ | parcial | SÍ | convergido | YA INTEGRADA |
| Migración de asociados históricos | parcial | SÍ (scripts) | NO | parcial | QA scripts | SOLO QA (scripts) |
| Provisión de usuarios | SÍ (ACTIVE) | SÍ (PENDING) | NO | SÍ (ACTIVE) | PROD | REQUIERE DECISIÓN |
| Detección duplicados DNI/CE/pasaporte | SÍ | SÍ | parcial | SÍ | convergido | YA INTEGRADA |
| Reconciliación de perfiles | SÍ (`SieNameReconciliation`) | SÍ | NO | SÍ | convergido | YA INTEGRADA |
| Activos/estudiantes/históricos | SÍ | SÍ | parcial | SÍ | convergido | YA INTEGRADA |
| Códigos históricos compatibles | SÍ | SÍ | NO | SÍ | convergido | YA INTEGRADA |
| Estados ACTIVE/PENDING | SÍ | SÍ | — | SÍ | divergente (provisión) | REQUIERE DECISIÓN |
| Autenticación por contraseña | SÍ | SÍ | SÍ | SÍ | convergido | YA INTEGRADA |
| mustChangePassword | SÍ | SÍ | NO | SÍ | convergido | YA INTEGRADA |
| Activación/recuperación cuenta | SÍ | SÍ | SÍ | SÍ | convergido | YA INTEGRADA |
| Sincronización datos SIE | SÍ (directorio) | SÍ (sincronizador A/E) | NO | SÍ (directorio) | divergente | REQUIERE DECISIÓN |
| Directorio unificado | SÍ | SÍ | NO | SÍ | convergido | YA INTEGRADA |
| Fotografías asociados | SÍ | SÍ | parcial | SÍ | convergido | YA INTEGRADA |
| Nacionalidad y direcciones | SÍ (6aad2e3) | parcial | — | NO | PROD posterior | SOLO PROD (pendiente) |
| Historial de membresías | SÍ | SÍ | — | SÍ | convergido | YA INTEGRADA |
| Auditoría de cambios | SÍ | SÍ | — | SÍ | convergido | YA INTEGRADA |
| Roles y permisos | SÍ | SÍ | — | SÍ | convergido | YA INTEGRADA |
| Integración notificaciones | SÍ | SÍ | — | SÍ | convergido | YA INTEGRADA |
| Compatibilidad correos masivos | SÍ | SÍ | — | SÍ | convergido | YA INTEGRADA |

### Autenticación y seguridad (FASE 3A.3)

- Código de auth **convergido** entre PROD y QA: `modules/auth/login`, `modules/auth/context`, `modules/auth/password-change`, `app/(auth)/cambiar-contrasena` son **idénticos** (no aparecen en el diff `e856422..a7f55ff`).
- `bcryptjs` cost 12 para credenciales legacy (ambas líneas).
- `mustChangePassword` + `api-authorization` (bloqueo de APIs internas) presente en ambas.
- Sin conflicto de autenticación. Sin cambios de credenciales en esta fase.

### Prisma y migraciones (FASE 3A.4)

- `schema.prisma` **idéntico** entre PROD y QA (diff vacío).
- **41 migraciones idénticas** en ambas líneas, incluidas las 4 preservadas en el respaldo de Fase 0 (`20261010*`, `20261012*`, `20261013*`) y `20261014000000_add_must_change_password`.
- Única diferencia: BOM y `\ No newline` en `20261014000000_add_must_change_password/migration.sql` (inocuo, mismo SQL).
- **Sin conflicto de migraciones.** Las 4 migraciones "untracked" del worktree original ya están commitadas en `e856422`.

### Conflictos identificados (FASE 3A.5)

| Conflicto | PROD | QA | Riesgo | Propuesta |
|---|---|---|---|---|
| Provisión de cuentas históricas | `activateLegacyAccount`/`provisionLegacyAccount` en `SieLegacyCredentialService` (provisión **ACTIVE**) | `SieUserProvisioningService` (provisión **PENDING**) | Provisión ACTIVE activa cuentas sin validación de correo | Evaluar adoptar PENDING (más seguro); decisión de seguridad explícita |
| Sincronizador SIE (códigos A/E) | — | `SieActiveCodeSyncService` + `sie-active-code-sync.ts` | Falta en PROD | Incorporar si aporta valor (SOLO QA) |
| Perfiles enriquecidos (nacionalidad/geográfico) | `6aad2e3` (posterior, no desplegado) | — | No en base | Revisar para Fase 3B |

### Plan de integración propuesto (FASE 3A.6) — lotes

1. **Mantener** directorio unificado + auth convergido (ya en base).
2. **Decidir** provisión ACTIVE (PROD) vs PENDING (QA) — decisión de seguridad.
3. **Evaluar** incorporar `SieActiveCodeSyncService` (QA) y `sie-historical-profile-enrichment` (PROD `6aad2e3`) si se confirman ausentes.
4. **Preservar** scripts de migración histórica QA como referencia (no se ejecutan en integración).
5. **Reconciliar** si procede la variante PENDING de provisión.
6. Pruebas de regresión (SIE, auth, mustChangePassword, directorio).

### Decisiones pendientes

- Provisión ACTIVE vs PENDING (seguridad).
- Incorporación de sincronizador A/E (QA) y enriquecimiento de perfiles (PROD `6aad2e3`).

## Cambios de esta fase (Fase 3A)

- Sin cambios de código (auditoría). Solo documentación actualizada (esta sección).
- Ningún merge/cherry-pick/rebase ejecutado.
