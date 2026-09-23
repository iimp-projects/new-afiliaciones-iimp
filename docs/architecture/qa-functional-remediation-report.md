# QA — Reporte de remediación funcional (catálogos + APIS.NET.PE + validación E2E)

> **Fase:** 3D-6.4 · **Fecha:** 2026-09-21 · **Ámbito:** QA `https://afiliaciones-qa.iimp.org.pe`
> **Sin secretos ni PII.** `LEGACY_CHANGES=0`, `PRODUCTION_CHANGES=0`, `COMMITS=0`, `PUSHES=0`.

---

## 1. Executive Summary

La FASE 3D-6.3 demostró dos causas raíz independientes: (A) BD QA sin datos (migraciones DDL-only, sin seed)
y (B) `APIS_NET_PE_TOKEN` ausente. Esta fase ejecutó la remediación controlada:

- Se cargaron los **catálogos maestros** con el seed oficial idempotente (`tsx prisma/seed.ts`), sin usuarios
  (guard de producción `NODE_ENV=production`), y se creó **un único administrador QA** dedicado.
- Se configuró `APIS_NET_PE_TOKEN` como **SSM SecureString** (token existente del sistema legacy, autorizado
  por el operador; nunca impreso) y se inyectó al runtime.
- RENIEC y SUNAT funcionan a través del flujo real de la aplicación.
- El flujo de postulación (crear → recuperar → persistir), el PDF (Chromium real) y la persistencia STOP/START
  fueron validados. El scheduler L-V 08:00–20:00 America/Lima permanece activo.

**QA_FUNCTIONALLY_READY = YES.**

---

## 2. Baseline

`master` / `ea5e3b1` · EC2 QA `i-095d15242588ec268` running (us-east-2, `3.129.231.111`) · account `564914947461`.
Health inicial: live=200, ready=200. `QA_BASELINE_HEALTHY = YES`.

## 3. Pre-remediation backup

`pg_dump --format=custom --compress=6` de la BD `afiliaciones` (QA) → S3 QA
`backups/qa/pre-functional-remediation/20260921T050123Z/qa.dump` (215,075 bytes, SSE AES256). `PASS`.

## 4. Seed inventory

Se inspeccionaron `prisma/seed/**`, `prisma/seed.ts`, `prisma.config.ts`, `package.json`, `scripts/`, `migracion-*.ts`.

| Seed | Tablas | Tipo | Idempotente | Seguro QA | Ejecutar |
|---|---|---|---|---|---|
| auth/permissions, roles, role-permissions | `auth_*` | SAFE_MASTER_DATA | Sí (upsert) | Sí | Sí |
| geography/* | `catalog_*` | SAFE_MASTER_DATA | Sí | Sí | Sí |
| education/* (universities, specialties, academic-degrees) | `catalog_*` | SAFE_MASTER_DATA | Sí | Sí | Sí |
| benefits, membership-departments, address-types | `catalog_*` | SAFE_MASTER_DATA | Sí | Sí | Sí |
| system/system-settings | `sys_system_settings` | SAFE_MASTER_DATA | Sí | Sí | Sí |
| auth/users | `persons`,`auth_users`,`auth_credentials` | USER_DATA | Sí | No (78 usuarios) | No |
| development/demo-* | varias | USER_DATA/TRANSACTIONAL | parcial | No (`Demo123!`) | No |
| migracion-fase1/2/3/parche | muchas | LEGACY_DATA | No | No (`TRUNCATE`) | No |

**SAFE_SEEDS_IDENTIFIED** = catálogos + RBAC + system-settings (14 módulos). **SAFE_SEEDS_EXECUTED** = los mismos.

## 5. Seeds executed

Ejecutado en un contenedor one-off (imagen de tooling temporal) sobre la red `afiliaciones-qa_data`:
`npx tsx prisma/seed.ts` con `NODE_ENV=production`. Salida: 341 departamentos, 229 provincias, 96 distritos,
131 universidades, 36 especialidades, 6 departamentos de evaluación, 1 tipo de dirección, 13 system settings;
RBAC y países completados. El guard de producción omitió usuarios/demostración.

## 6. Catalog row counts

| Catálogo | Antes | Después |
|---|---:|---:|
| countries | 0 | **175** |
| departments | 0 | **341** |
| provinces | 0 | **229** |
| districts | 0 | **96** |
| universities | 0 | **131** |
| specialties | 0 | **36** |
| academic_degrees | 0 | 6 |
| benefits | 0 | 4 |
| membership_departments | 0 | 6 |
| address_types | 0 | 1 |
| system_settings | 0 | 13 |
| roles | 0 | **20** |
| permissions | 0 | **64** |
| role_permissions | 0 | 101 |

## 7. QA admin bootstrap

Un único admin QA: `qa.admin@iimp.org.pe` (SYSTEM_ADMIN, ACTIVE), creado con el mecanismo de usuario del
proyecto (Person + User + Credential bcrypt cost 12). Password aleatoria de 44 caracteres generada por el
operador, almacenada en `/afiliaciones/qa/qa-admin-password` (SecureString) y aplicada vía stdin (sin env,
cmdline, disco ni logs). Login validado por el flujo real de Auth.js (CSRF → credentials → session) con
control negativo. `QA_ADMIN_CREATED=YES`, `QA_ADMIN_LOGIN=PASS`.

## 8. APIS.NET.PE configuration

Token existente localizado en el controlador legacy `DocumentApiController::token()` (no impreso). Validado
contra APIS.NET.PE (autenticación correcta). Almacenado en `/afiliaciones/qa/apis-net-pe-token`
(**SecureString**, Standard). Inyectado en `/opt/afiliaciones-qa/app.env` (modo 600) y recreado el contenedor
`app`. `APIS_NET_PE_TOKEN_PRESENT=YES`. Sin exposición en Git, tfstate, imagen, compose, documentación ni logs.

## 9. RENIEC validation

Flujo real `POST /api/afiliaciones/postulacion/validate-document` (DNI sintético). Resultado:
`HTTP 200`, `person` presente (PII no registrada). `RENIEC_PROVIDER_REACHED=YES`, `RENIEC_PERSON_RETURNED=YES`.
Proveedor: APIS.NET.PE `/reniec/dni`. **RENIEC_STATUS = PASS**.

## 10. SUNAT validation

Flujo real `POST /api/afiliaciones/postulacion/validate-ruc` (RUC de prueba). Resultado: `HTTP 200`,
`success=true`, `status=VERIFIED`. Proveedor: APIS.NET.PE `/sunat/ruc/full` (mismo token que RENIEC).
**SUNAT_STATUS = PASS**.

## 11. Application flow validation

- Catálogos vía API pública: countries 175, departments 25 (Perú), provinces 7, districts 43,
  universities 131, specialties 36, degrees 6. **CATALOG_API_STATUS = PASS**.
- `POST /api/afiliaciones/postulacion` → `201` DRAFT con `trackingCode`/`applicationCode`.
- `GET /api/afiliaciones/postulacion/{trackingCode}` → `200` DRAFT ACTIVE.
- Persistencia en PostgreSQL verificada. Login admin `PASS`; `/intranet` y `/intranet/security/users` → `200`.
- **APPLICATION_FLOW_STATUS = PASS**.
- Observación (seed oficial, no bloqueante): `read:memberships` está asignado a `ATENCION_ASOCIADO`/`ASOCIADO_*`,
  no a `SYSTEM_ADMIN`, por lo que el modo interno de `generate-pdf` y la vista de expedientes administrativos
  requieren un rol de atención (o el cookie de consulta del postulante).

## 12. PDF/Chromium validation

Flujo real `POST /api/afiliaciones/postulacion/generate-pdf` → `DeclarationPdfService` → Puppeteer/Chromium
con sandbox (perfil seccomp custom, sin `--no-sandbox`). Resultado: `HTTP 200`,
`Content-Type: application/pdf`, **117,010 bytes**. `PDF_GENERATION=PASS`, `CHROMIUM_SANDBOX_ENABLED=YES`,
`NO_SANDBOX_FLAG=NO`.

## 13. Health validation

Post-remediación: live=200, ready=200; contenedores `healthy`; `RestartCount=0`, `OOMKilled=false`; sin
`ConfigurationError`/`Unhandled`/`ECONNREFUSED`/`OOM` en logs. **POST_REMEDIATION_HEALTH = PASS**.

## 14. STOP/START persistence

Stop → `stopped` (EIP retenido) → start → `running` + status checks OK. Tras el arranque: `/data` montado,
Docker/Compose (app, caddy, postgres) arriba, HTTPS y health 200/200, token presente, y conteos idénticos
(175|131|1|2|20). RENIEC y SUNAT siguen funcionando. EIP/DNS estables. **STOP_START_PERSISTENCE = PASS**.

## 15. Scheduler status

`ENABLED` · start `cron(0 8 ? * MON-FRI *)` · stop `cron(0 20 ? * MON-FRI *)` · `America/Lima` · target
únicamente la EC2 QA (`i-095d…`). **SCHEDULER_ENABLED = YES**.

## 16. Post-remediation backup

`backups/qa/post-functional-remediation/20260921T054551Z/qa.dump` (240,456 bytes, SSE AES256). **PASS**.
Sin restore destructivo sobre la BD activa.

## 17. Security validation

`SSH_PUBLIC=NO`, `POSTGRES_PUBLIC=NO`, `APP_3000_PUBLIC=NO` (SG solo 80/443), `HTTPS=YES`,
`IMDSV2=REQUIRED`, `EBS_ENCRYPTED=YES` (root 20GB + data 30GB), `S3_PRIVATE=YES`,
`SECRETS_IN_GIT=NO`, `SECRETS_IN_IMAGE=NO`, `SECRETS_IN_TFSTATE=NO`, `PRODUCTION_CREDENTIALS_USED=NO`,
`NO_SANDBOX_FLAG=NO`, `PRIVILEGED_CONTAINER=NO`. Sin passwords débiles/default introducidas.
**SECURITY_STATUS = PASS**.

## 18. Data integrity

```
countries=175 departments=341 provinces=229 districts=96
universities=131 specialties=36 academic_degrees=6 benefits=4
membership_departments=6 address_types=1 system_settings=13
roles=20 permissions=64 role_permissions=101
users=1 (qa.admin@iimp.org.pe) persons=1 applications=2 (sintéticas)
payments=0 audit_logs=0
```
`PRODUCTION_DATA_ROWS_IMPORTED=0`, `LEGACY_DATA_ROWS_IMPORTED=0`, `REAL_USERS_IMPORTED=0`.

## 19. Remaining risks

- El `catch {}` de `ValidateDocumentService`/`ApisNetPeService` colapsa `MISSING_CONFIG`, `401/403`,
  `timeout`, `5xx` y `NOT_FOUND` en el mismo `person:null`. Deuda de hardening (observabilidad), no bloqueante.
- `SYSTEM_ADMIN` sin `read:memberships` (diseño del seed); la vista de expedientes administrativos requiere
  un rol de atención.
- El token de APIS.NET.PE se comparte con el sistema legacy: si rota, QA debe actualizar el SecureString.
- `qa_persistence_marker` (tabla no Prisma) permanece como artefacto de pruebas previas.

## 20. Follow-up hardening

1. Diferenciar el origen del fallo en `validate-document`/`validate-ruc` (sin exponer PII) para telemetría.
2. Revisar el mapeo `SYSTEM_ADMIN` ↔ `read:memberships` si se requiere vista administrativa completa.
3. Rotación coordinada del token APIS.NET.PE (legacy + QA).
4. Considerar eliminar `qa_persistence_marker` en una limpieza futura.

## 21. Final decision

**QA_FUNCTIONALLY_READY = YES** — catálogos, autenticación, RENIEC, SUNAT, flujo E2E, PDF/Chromium,
persistencia STOP/START, health, backup y seguridad validados. Pendientes solo deuda de hardening.
