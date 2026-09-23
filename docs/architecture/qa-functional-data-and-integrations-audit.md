# QA — Auditoría funcional de datos y catálogos + integraciones externas (RENIEC/SUNAT)

> **Fase:** 3D-6.3 · **Fecha:** 2026-09-21 · **Ámbito:** QA `https://afiliaciones-qa.iimp.org.pe`
> **Modo:** AUDIT / READ-ONLY. Sin writes, sin seeds, sin cambios SSM/Terraform, sin deploy.
> Sin secretos ni PII. `LEGACY_CHANGES=0`, `PRODUCTION_CHANGES=0`, `AWS_INFRASTRUCTURE_CHANGES=0`, `DATABASE_WRITES=0`, `SECRETS_EXPOSED=0`, `DEPLOYS=0`, `COMMITS=0`, `PUSHES=0`.

---

## 1. Executive Summary

QA está sano a nivel infraestructura/runtime (health live/ready 200, HTTPS, Chromium, EBS, scheduler),
pero **la base de datos QA está vacía**: 26 migraciones aplicadas crearon solo el esquema, **sin datos**.
De 51 tablas de negocio, **todas tienen 0 filas** (la única excepción es `_prisma_migrations` con 26 y
una tabla de prueba `qa_persistence_marker` con 1). No se ejecutó el seed de catálogos.

Consecuencia directa: `/api/catalogs/countries` responde `200 []`, por lo que `/postulacion/asociado`
no muestra países, departamentos, provincias ni distritos.

RENIEC y SUNAT usan **el mismo proveedor (APIS.NET.PE)** y **el mismo secreto `APIS_NET_PE_TOKEN`**,
que **no existe en QA** (ni en SSM ni en el contenedor). La red/egress hacia el proveedor **sí funciona**
(401 sin token = esperado). Por eso `validate-document` devuelve `person: null` (HTTP 200, error absorbido
silenciosamente).

**Dos causas raíz independientes:** (a) `DATABASE_DATA_MISSING` (sin seed) y (b) `SECRET_MISSING`
(`APIS_NET_PE_TOKEN`). No hay bug de aplicación; el comportamiento observado es el esperado ante esos faltantes.

---

## 2. QA database inventory

- Motor: PostgreSQL 16.15 · BD/usuario: `afiliaciones` (nombres, sin credenciales).
- Tablas en `public`: **53** = 51 modelos Prisma + `_prisma_migrations` + `qa_persistence_marker` (artefacto de prueba STOP/START, no en schema).
- Migraciones aplicadas: **26**.

| TABLE | ROWS | CLASSIFICATION |
|---|---:|---|
| `_prisma_migrations` | 26 | CONFIGURATION |
| `qa_persistence_marker` | 1 | UNKNOWN (artefacto QA STOP/START, no Prisma) |
| `catalog_countries` | 0 | CATALOG |
| `catalog_departments` | 0 | CATALOG |
| `catalog_provinces` | 0 | CATALOG |
| `catalog_districts` | 0 | CATALOG |
| `catalog_universities` | 0 | CATALOG |
| `catalog_specialties` | 0 | CATALOG |
| `catalog_academic_degrees` | 0 | CATALOG |
| `catalog_specialty_categories` | 0 | CATALOG |
| `catalog_companies` | 0 | CATALOG |
| `catalog_company_sectors` | 0 | CATALOG |
| `catalog_job_positions` | 0 | CATALOG |
| `catalog_benefits` | 0 | CATALOG |
| `catalog_membership_departments` | 0 | CATALOG |
| `catalog_address_types` | 0 | CATALOG |
| `auth_roles` | 0 | AUTH |
| `auth_permissions` | 0 | AUTH |
| `auth_role_permissions` | 0 | AUTH |
| `auth_users` | 0 | AUTH |
| `auth_credentials` | 0 | AUTH/SECURITY |
| `auth_accounts` / `auth_sessions` / `auth_user_sessions` | 0 | AUTH |
| `auth_security_events` | 0 | SECURITY |
| `auth_verification_tokens` | 4 | SECURITY (transitorio) |
| `sys_system_settings` | 0 | CONFIGURATION |
| `sys_system_setting_values` | 0 | CONFIGURATION |
| `sys_configurations` | 0 | CONFIGURATION |
| `sys_audit_logs` | 0 | AUDIT |
| `sys_notifications` | 0 | CONFIGURATION |
| `operational_alert_*` (2) | 0 | APPLICATION_DATA |
| `persons` / `person_contacts` / `person_addresses` | 0 | APPLICATION_DATA |
| `membership_applications` | 0 | APPLICATION_DATA |
| `membership_*` (documents/history/approvals/observations/validations/area) | 0 | APPLICATION_DATA |
| `professional_*` (academics/employment/experiences) | 0 | APPLICATION_DATA |
| `payments` / `billings` / `invoices` | 0 | APPLICATION_DATA |
| `associate_integrations` / `associate_integration_attempts` | 0 | APPLICATION_DATA |
| `VerificationCode` | 0 | SECURITY |

**QA_SCHEMA_PRESENT = YES** · **QA_CATALOG_DATA_PRESENT = NO** · **QA_APPLICATION_DATA_PRESENT = NO**

---

## 3. Catalog completeness

Los catálogos viven en tablas `catalog_*`. QA = 0 filas en todas. Referencia local (dev, ya sembrado)
para dimensionar lo esperado (no es objetivo de QA, que solo carga el subconjunto curado del seed):

| Catálogo | Local (ref.) | QA |
|---|---:|---:|
| countries | 175 | 0 |
| departments | 341 | 0 |
| provinces | 229 | 0 |
| districts | 96 | 0 |
| universities | 442 | 0 |
| specialties | 751 | 0 |
| roles | 20 | 0 |
| permissions | 63 | 0 |

---

## 4. Prisma migrations vs seeds

- **26 migraciones, todas DDL-only.** Búsqueda de `INSERT`/`COPY` en `prisma/migrations/**/*.sql` = **0 coincidencias**. Solo `ON UPDATE CASCADE` (FK).
- Los catálogos entran exclusivamente por `prisma/seed/**` (orquestador `prisma/seed.ts`, config en `prisma.config.ts:11` → `tsx prisma/seed.ts`).
- **MIGRATIONS_CREATE_SCHEMA = YES** · **MIGRATIONS_LOAD_CATALOGS = NO** · **SEED_REQUIRED_FOR_CATALOGS = YES**.
- Los seeds activos son `upsert` (idempotentes). `seedUsers` está **guardado por `IS_PRODUCTION`** (`NODE_ENV==='production'`): en QA (Next standalone, `NODE_ENV=production`) **se omitiría**; requiere `SEED_USER_PASSWORD` (≥16) si se ejecutara.

| SEED | TABLES_AFFECTED | SAFE_FOR_QA | IDEMPOTENT | USERS | PASSWORDS | LEGACY_DATA | RECOMMENDATION |
|---|---|---|---|---|---|---|---|
| `auth/permissions.seed.ts` | `auth_permissions` | SÍ | SÍ | No | No | No | EJECUTAR |
| `auth/roles.seed.ts` | `auth_roles` | SÍ | SÍ | No | No | No | EJECUTAR |
| `auth/role-permissions.seed.ts` | `auth_role_permissions` | SÍ | SÍ | No | No | No | EJECUTAR |
| `geography/*` (countries/departments/provinces/districts) | `catalog_*` | SÍ | SÍ | No | No | No | EJECUTAR |
| `education/universities|specialties|academic-degrees` | `catalog_*` | SÍ | SÍ | No | No | No | EJECUTAR |
| `benefits` / `membership-departments` / `address-types` | `catalog_*` | SÍ | SÍ | No | No | No | EJECUTAR |
| `system/system-settings.seed.ts` | `sys_system_settings` | SÍ | SÍ | No | No | No | EJECUTAR |
| `auth/users.seed.ts` | `persons`,`auth_users`,`auth_credentials` | CONDICIONAL | SÍ | **Sí (78)** | **Sí (`SEED_USER_PASSWORD`)** | No | QA: crear 1 admin QA dedicado, no los 78 |
| `development/demo-*.seed.ts` | varias | NO | parcial | Sí | **`Demo123!`** | No | NO EJECUTAR (comentado) |
| `migracion-fase1/2/3/parche.ts` | muchas | **NO** | No | Sí | hashes legacy | **Sí** | NUNCA (fase3 hace `TRUNCATE`; requiere `ALLOW_LEGACY_MIGRATION`) |
| `scripts/*academic*` | catálogos | NO | — | No | No | legacy values | NO EJECUTAR |

---

## 5. Countries flow

`/postulacion/asociado` → `PersonalDataStep.tsx:688` `fetch("/api/catalogs/countries")` →
`app/api/catalogs/countries/route.ts` → `prisma.country.findMany({ where:{isActive:true} })` → `catalog_countries`.

- **COUNTRIES_SOURCE = DATABASE** (Prisma; ruta pública sin auth). Sin capa repositorio.
- **COUNTRIES_DB_ROWS = 0**
- **COUNTRIES_ENDPOINT_STATUS = 200** · **COUNTRIES_ENDPOINT_ROWS = 0** (`[]`)
- **ROOT_CAUSE_IF_EMPTY = DATABASE_DATA_MISSING** (seed de catálogos no ejecutado).
- Subcatálogos análogos: `/api/catalogs/{id}/departments|provinces|districts` → mismas tablas vacías.

---

## 6. RENIEC flow

`PersonalDataStep` → `ApplicationApi.validateDocument` → `POST /api/afiliaciones/postulacion/validate-document`
→ `ValidateDocumentService` → `ApisNetPeService.getDni` → `GET https://api.apis.net.pe/v2/reniec/dni`.

- **RENIEC_PROVIDER = APIS.NET.PE** (no RENIEC directo, no servicio interno). Base URL **hardcodeada**.
- Único secreto: **`APIS_NET_PE_TOKEN`** (`lib/config/env.ts:314`, lazy). Sin base-url/timeout configurables.
- `getToken()` se llama **fuera** del try interno de `getDni`; si falta el token lanza `ConfigurationError`, que es **absorbido por el `catch {}` vacío** de `ValidateDocumentService` → `person: null`, HTTP 200.

| VARIABLE | REQUIRED | SOURCE | SSM_PRESENT | VALUE_EXPOSED |
|---|---|---|---|---|
| `APIS_NET_PE_TOKEN` | Sí (al usar la integración) | SSM/entorno | **NO** | NO |

**RENIEC_CONFIG_STATUS = MISSING_SECRET** · **RENIEC_NETWORK_STATUS = OK** · **RENIEC_ROOT_CAUSE = SECRET_MISSING**.

---

## 7. SUNAT flow

`EmploymentStep`/`BillingDetailsStep`/`StatusObserved` → `ApplicationApi.validateRuc/lookupRuc`
→ `POST /api/afiliaciones/postulacion/validate-ruc` → `ApisNetPeService.getRuc` → `GET https://api.apis.net.pe/v2/sunat/ruc/full`.

- **SUNAT_PROVIDER = APIS.NET.PE** (el **mismo** que RENIEC; mismo `ApisNetPeService`, mismo `APIS_NET_PE_TOKEN`).
- Errores clasificados `VERIFIED | NOT_FOUND | SERVICE_ERROR`; HTTP 200/404/502.
- **SUNAT_CONFIG_STATUS = MISSING_SECRET** · **SUNAT_NETWORK_STATUS = OK** · **SUNAT_ROOT_CAUSE = SECRET_MISSING**.

---

## 8. SSM configuration matrix

Existentes en `/afiliaciones/qa/` (12): `AUTH_URL`, `AWS_DEFAULT_REGION`, `NEXT_PUBLIC_APP_URL`,
`PAYMENT_ENVIRONMENT`, `PAYMENT_TEST_AMOUNT`, `PAYMENT_MOCK_SCENARIO`, `PAYMENT_PROVIDER` (String);
`auth-secret`, `database-url`, `db-password`, `jwt-secret`, `payment-auth-secret` (SecureString).

| VARIABLE | TYPE | REQUIRED_BY | PRESENT_IN_QA | STATUS |
|---|---|---|---|---|
| `DATABASE_URL` (secure) | SecureString | app/prisma | SÍ | READY |
| `AUTH_SECRET` / `JWT_SECRET` / `PAYMENT_AUTH_SECRET` | SecureString | auth/pagos | SÍ | READY |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | String | auth | SÍ | READY |
| `PAYMENT_PROVIDER` / `PAYMENT_ENVIRONMENT` / `PAYMENT_MOCK_SCENARIO` / `PAYMENT_TEST_AMOUNT` | String | pagos (mock) | SÍ | READY |
| `AWS_BUCKET` / `AWS_DEFAULT_REGION` | String/entorno | S3 | SÍ | READY |
| **`APIS_NET_PE_TOKEN`** | SecureString | **RENIEC + SUNAT** | **NO** | **MISSING** |
| `ASSOCIATES_API_BASE_URL/USER/PASSWORD/TIMEOUT_MS` | SecureString/String | SIE sync | NO | MISSING |
| `SMTP_HOST/USER/PASS/PORT/SECURE/FROM` | SecureString/String | correo | NO | MISSING |
| `SAP_SERVICE_LAYER_URL/USER/PASSWORD/COMPANY_DB` | SecureString/String | SAP | NO | MISSING |
| `WHATSAPP_ACCESS_TOKEN/PHONE_NUMBER_ID/WABA_ID/GRAPH_API_VERSION` | SecureString/String | OTP WhatsApp | NO | MISSING |
| `NIUBIZ_TEST_*` | SecureString/String | pasarela TEST | NO | NOT_USED (QA usa `PAYMENT_PROVIDER=mock`) |
| `SEED_USER_PASSWORD` | SecureString | seed de usuarios | NO | MISSING (solo si se siembran usuarios) |

---

## 9. Network / egress validation

| HOST | DNS | TCP_443 | TLS | HTTP_REACHABLE |
|---|---|---|---|---|
| `api.apis.net.pe` | OK (`138.68.16.132`) | OK | OK | root=200; `/v2/reniec/dni`=401; `/v2/sunat/ruc/full`=401 (sin token = esperado) |
| `afiliaciones-qa.iimp.org.pe` | OK (`3.129.231.111`) | OK | OK | 200 |

**EXTERNAL_EGRESS_OK = YES** (se probó sin enviar DNI/RUC reales; solo una petición sin token).

---

## 10. Logs durante consulta controlada

Consulta única `POST /validate-document` con DNI **ficticio** (`12345678`) → `200`
`{"hasApplication":false,"requiresVerification":false,"channels":[],"options":[],"person":null}`.
Logs del contenedor `app`: solo banner de Next.js; **no se registra la causa** (el `catch {}` vacío la absorbe).
Clasificación: **SECRET_MISSING** (RENIEC) + **DATABASE_DATA_MISSING** (sin aplicaciones). Sin PII en logs.

---

## 11. validate-document analysis

El objeto exacto `{... "person": null}` se produce **solo en la rama DNI** de `ValidateDocumentService:23`
y exige: (1) `documentType==="DNI"`; (2) `hasApplication===false` (0 filas en `membership_applications`,
lo que además deja `requiresVerification:false`, `channels:[]`, `options:[]`); (3) la búsqueda de respaldo
sin `affiliateType` tampoco encuentra aplicación; (4) `getDni` no devuelve una persona válida y coincidente
(non-OK, JSON sin `numeroDocumento`, excepción, o DNI no coincide).

- **VALIDATE_DOCUMENT_ROOT_CAUSE = SECRET_MISSING (`APIS_NET_PE_TOKEN`) + DATABASE_DATA_MISSING (sin aplicaciones).**
- No es bug: errores externos se absorben por diseño (2 capas: `ApisNetPeService` → `null`; `ValidateDocumentService` → `catch {}`).
- La UI (`PersonalDataStep.tsx:826`) colapsa "sin token", "outage", "401/500" y "DNI no encontrado" en el mismo aviso genérico.

---

## 12. Local vs QA comparison (PRESENCE/ABSENCE)

| Item | LOCAL | QA |
|---|---|---|
| countries / departments / provinces / districts | 175 / 341 / 229 / 96 | 0 / 0 / 0 / 0 |
| universities / specialties | 442 / 751 | 0 / 0 |
| roles / permissions | 20 / 63 | 0 / 0 |
| users | 91 | 0 |
| applications | 5266 | 0 |
| `APIS_NET_PE_TOKEN` | **ABSENT** | **ABSENT** |
| `ASSOCIATES_API_*` | PRESENT | ABSENT |
| `NIUBIZ_TEST_*` / `NIUBIZ_PROD_*` | PRESENT | ABSENT |
| `SMTP_*` / `SAP_*` / `WHATSAPP_*` | PRESENT | ABSENT |
| `PAYMENT_PROVIDER` | (real/test) | `mock` |

Conclusión: **local funciona porque está sembrado** (catálogos + usuarios + aplicaciones). QA no lo está.
Nota: local **tampoco** tiene `APIS_NET_PE_TOKEN`, por lo que la preconsulta RENIEC también fallaría localmente;
el síntoma de "países vacíos" en QA es puramente de datos.

---

## 13. Remediation plan (NO ejecutado)

**A. REQUIRED_FOR_QA_CORE**
1. Ejecutar el **seed de catálogos** (`prisma/seed.ts` en su rama no-usuarios) contra la BD QA: permissions, roles, role-permissions, countries, departments, provinces, districts, universities, specialties, academic-degrees, benefits, membership-departments, address-types, system-settings. Idempotente (`upsert`).
2. Crear **1 usuario administrador QA dedicado** (no los 78 de `users.data.ts`), con `SEED_USER_PASSWORD` fuerte y único, o un seed QA específico. QA no debe reutilizar credenciales de local/producción.

**B. REQUIRED_FOR_RENIEC_SUNAT**
3. Crear `APIS_NET_PE_TOKEN` (SecureString) en `/afiliaciones/qa/` con un token **propio de QA** y reiniciar el contenedor `app`. Habilita RENIEC (DNI) y SUNAT (RUC) simultáneamente.

**C. OPTIONAL_FEATURES**
4. SMTP, SAP, WhatsApp, Associates API, Niubiz TEST: opcionales según qué flujos QA se quieran probar. Niubiz TEST no es necesario mientras `PAYMENT_PROVIDER=mock`.

**D. NEVER_COPY_FROM_PRODUCTION**
5. Datos de `migracion-fase1/2/3/parche.ts` (personas, solicitudes, staff emails), `demo-users` (`Demo123!`), cualquier PII productiva, credenciales productivas (Niubiz PROD, SAP PROD, tokens prod).

**Estrategia de catálogos preferida:** (1) seed idempotente existente; (2) si se requieren usuarios, seed QA mínimo dedicado; (3) nunca export productivo.

---

## 14. Security considerations

- QA no debe recibir PII productiva ni credenciales productivas.
- El token de APIS.NET.PE debe ser de QA (cuota/aislamiento), cargado como SecureString, sin exponerse en logs.
- `migracion-fase3.ts` hace `TRUNCATE ... CASCADE` y referencia correos reales: jamás habilitar en QA.
- `qa_persistence_marker` es un artefacto de prueba (no Prisma); considerar limpieza futura.
- El `catch {}` silencioso oculta fallos de proveedor; mejora futura: telemetría sanitizada (sin PII) — fuera de alcance de esta fase.

---

## 15. Final decision

**QA_DATA_AND_INTEGRATIONS_REMEDIATION_REQUIRED**

- Datos: **falta seed de catálogos** (y un usuario admin QA).
- Integraciones: **falta `APIS_NET_PE_TOKEN`** (RENIEC + SUNAT); red/egress OK.
- No se encontró bug de aplicación; el comportamiento observado es consecuencia de los faltantes.

**QA_FUNCTIONALLY_READY = NO** (hasta ejecutar la remediación A+B y validar).
