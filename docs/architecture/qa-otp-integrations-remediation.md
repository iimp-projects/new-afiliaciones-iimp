# QA — Remediación de integraciones OTP (WhatsApp / Email / SMS)

> **Fase:** 3D-6.7.1 · **Fecha:** 2026-09-21 · **Ámbito:** QA `https://afiliaciones-qa.iimp.org.pe`
> **Sin secretos ni PII.** `LEGACY_CHANGES=0`, `PRODUCTION_CHANGES=0`, `COMMITS=0`, `PUSHES=0`.
> **Resultado:** `QA_OTP_FUNCTIONALLY_READY = YES` · `QA_FUNCTIONALLY_READY = YES`.

---

## 1. Causa raíz y schema drift

- `schema.prisma` declara `enum VerificationChannel { EMAIL SMS WHATSAPP }`.
- La migración histórica `20260722192610_remove_flow_from_membership_application` creó el enum con
  `('EMAIL','SMS')`; **ninguna migración posterior agregaba `WHATSAPP`** (drift).
- En QA (creado con `prisma migrate deploy`), `reserve()` fallaba con
  `PostgresError 22P02 invalid input value for enum "VerificationChannel": "WHATSAPP"`, no era
  `VerificationError` y el `catch {}` lo convertía en 400 genérico sin log.
- La configuración de Meta ya era válida: llamada directa desde el contenedor → HTTP 200.

## 2. Migración creada

`prisma/migrations/20260921170000_add_whatsapp_verification_channel/migration.sql`:

```sql
ALTER TYPE "VerificationChannel" ADD VALUE IF NOT EXISTS 'WHATSAPP';
```

No se editó ninguna migración histórica. No se usó `migrate reset` ni `db push`.

## 3. Backup pre-migración

`pg_dump | gzip` → `s3://afiliaciones-qa-docs-.../backups/qa/2026/09/21/pre-otp-migration-<ts>.sql.gz`,
SSE `AES256`. `PRE_MIGRATION_BACKUP = PASS`.

## 4. migrate status y enum

| Momento | Valor |
|---|---|
| `migrate status` antes | 26 migraciones · "Database schema is up to date!" |
| enum antes | `EMAIL, SMS` |
| deploy | `ea5e3b1-otp-migration` → `prisma migrate deploy` |
| `_prisma_migrations` | `20260921170000_add_whatsapp_verification_channel · finished=t · ok=t` |
| enum después | `EMAIL, SMS, WHATSAPP` |
| `migrate status` después | 27 migraciones · "Database schema is up to date!" |

Sin cambios inesperados de tablas/columnas/índices (la migración solo agrega un valor de enum).

## 5. WhatsApp E2E

`validate-document` → `send-otp channel=WHATSAPP` → **HTTP 200**. Cadena:
`reserve()` persistió `VerificationCode.channel=WHATSAPP` (id 7, no usado) → `WhatsAppService` →
Meta Graph API → log `WHATSAPP_OTP_SEND`. `WHATSAPP_READY = YES`.

## 6. Email regression

`send-otp channel=EMAIL` → **HTTP 200** (SMTP aceptó). `EMAIL_READY = YES`.

## 7. SMS regression

`send-otp channel=SMS` → **HTTP 200** (SNS Publish aceptó). `SMS_READY = YES`.

## 8. Observabilidad

`OtpRecoveryService` ya no usa `catch {}`. Registra categorías sanitizadas sin PII:
`OTP_RESERVATION_ERROR`, `OTP_PROVIDER_FAILURE`, `OTP_CONFIGURATION_ERROR`, `OTP_DATABASE_ERROR`,
con `channel`, `provider` (`smtp`/`sns`/`meta`) y `category`. La respuesta pública sigue genérica.
Los `VerificationError` de negocio (p. ej. cooldown) se propagan sin enmascarar.

## 9. Channel availability

`destinationChannels(email, phone, availability)` solo ofrece un canal si existe destino **y** el
proveedor está habilitado/configurado. `resolveOtpChannelAvailability()` combina feature flags
(`OTP_WHATSAPP_ENABLED`, `OTP_EMAIL_ENABLED`, `OTP_SMS_ENABLED`, default true) con
`getWhatsAppConfig()` / `getSmtpConfig()`. SMS depende del flag (usa la cadena de credenciales AWS).
No se hacen llamadas externas en `validate-document`.

## 10. Tests

- `OtpChannelAvailability.test.ts` (nuevo): WhatsApp/SMTP configurados e incompletos, flags, y
  `destinationChannels` con proveedor deshabilitado.
- `Verification.test.ts`: categorías de error (provider/config/DB), invalidación y no-leak.
- `VerificationChannelParity.test.tsx`: paridad con proveedores configurados.
- Resultado: **89 files / 630 tests PASS** (13 nuevos respecto a 620).

## 11. Quality gates

| Gate | Resultado |
|---|---|
| TypeScript | PASS |
| ESLint (`--quiet`) | PASS |
| Tests focalizados | PASS |
| Suite completa | PASS (89/630) |
| Build | PASS |
| `security:secrets` | PASS |
| `security:runtime` | PASS (4 HIGH con excepción vigente de nodemailer) |
| `git diff --check` | 2 trailing-whitespace **preexistentes** en archivos ajenos a esta fase |

## 12. Redeploy QA

- Web: `ea5e3b1-otp-hardening` (`sha256:ad498d0b...`).
- Migración: `ea5e3b1-otp-migration` (`sha256:ee78dab6...`).
- Solo se recreó el contenedor `app`; `postgres`/`caddy` intactos. Health 200/200.

## 13. Regresión funcional

RENIEC PASS · SUNAT PASS (`VERIFIED`) · catálogos PASS · login QA PASS (302 + session) ·
flujo público DRAFT 201 (sin login) · upload 200 · PDF 200 (`%PDF`, 115,437 bytes) ·
WhatsApp/Email/SMS OTP 200. Sin pagos.

## 14. STOP/START + bootstrap

Stop → `stopped`; start → `running`; `/data` montado; `postgres`/`caddy`/`app` arriba; health 200/200.
Se movió `app.env` y se ejecutó `bootstrap-env.sh` (SSM → `app.env` 25 vars, `0600 root`), se recreó
`app` y se confirmó runtime `SET` para `WHATSAPP_*`, `SMTP_*`, `AWS_DEFAULT_REGION`, health 200/200.
`SSM_BOOTSTRAP_STATUS = PASS` (reconstrucción reproducible, no solo supervivencia en disco).

## 15. Scheduler

`afiliaciones-qa-start` y `-stop` ENABLED · `cron(0 8 ? * MON-FRI *)` / `cron(0 20 ? * MON-FRI *)` ·
`America/Lima`. Sin cambios.

## 16. Seguridad

- `SECRETS_IN_GIT=NO` · `SECRETS_IN_TFSTATE=NO` · `SECRETS_IN_IMAGE=NO` (imagen sin secretos baked) ·
  `SECRETS_IN_LOGS=NO`.
- `SSH_PUBLIC=NO`, `POSTGRES_PUBLIC=NO`, `APP_3000_PUBLIC=NO` (SG solo 80/443) · `IMDSV2=required` ·
  `EBS_ENCRYPTED=YES` (20 GB + 30 GB) · `S3_PRIVATE=YES`.
- WhatsApp token y SMTP pass en **SecureString**; AWS vía **instance role** (sin claves estáticas).

## 17. Riesgos residuales

1. El árbol de trabajo sigue con cambios no commiteados (no se hace commit/push en esta fase).
2. Artefactos QA de prueba: apps sintéticas (id 3,4,6), OTP rows, objetos S3 de prueba.
3. `security:runtime` mantiene 4 HIGH de nodemailer cubiertos por excepción vigente (no introducidos aquí).
4. La disponibilidad de SMS depende solo del feature flag (no hay sonda local de SNS).

## 18. Decisión final

`QA_OTP_FUNCTIONALLY_READY = YES` · `QA_FUNCTIONALLY_READY = YES`.
