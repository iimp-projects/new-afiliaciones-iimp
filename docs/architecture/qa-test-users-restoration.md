# QA — Restauración de usuarios de prueba del seed

> **Fase:** 3D-6.8 / 3D-6.8.1 · **Fecha:** 2026-09-21 · **Ámbito:** QA `afiliaciones-qa.iimp.org.pe`
> **Sin secretos ni PII.** `PRODUCTION_CHANGES=0`, `LEGACY_CHANGES=0`, `COMMITS=0`, `PUSHES=0`.

---

## 1. Baseline

`master` / `ea5e3b1` · EC2 QA `i-095d15242588ec268` running · health live/ready `200`.
`auth_users=1` (`qa.admin@iimp.org.pe`, SYSTEM_ADMIN), `persons=1`, `auth_credentials=1`,
`auth_roles=20`, `auth_role_permissions=101`.

## 2. Causa por la que QA solo tenía el admin

`prisma/seed.ts` ejecuta `seedUsers` solo si `!IS_PRODUCTION` (`lib/seed/constants.ts`).
En 3D-6.4 el seed se corrió con `NODE_ENV=production`, por lo que los usuarios de prueba se
omitieron deliberadamente.

## 3. Seed real (fuente de verdad)

- `prisma/seed/auth/users.seed.ts` → función `seedUsers` (upsert de `Person`, `User`, `Credential`).
- `prisma/seed/auth/data/users.data.ts` → **81 usuarios** en 20 roles.
- Password: `SEED_USER_PASSWORD` (env, ≥16), hasheada con `hashSeedPassword` (bcrypt, cost 12). Un solo password para todos. **No hay password en el repo.**
- Idempotente por `upsert` (email / documentType+documentNumber).

## 4. Usuarios definidos

81 usuarios; **no** son 2 por rol:

| Rol | Nº | Rol | Nº |
|---|--:|---|--:|
| SUPER_ADMIN | 3 | OPERACIONES | 3 |
| SYSTEM_ADMIN | 3 | TESORERIA | 3 |
| GERENCIA_GENERAL | 2 | CONTABILIDAD | 3 |
| SECRETARIA_GENERAL | 2 | CAJA | 3 |
| COMITE_EVALUADOR | 4 | LEGAL | 2 |
| LOGISTICA | 3 | COMUNICACIONES | 2 |
| ATENCION_ASOCIADO | 4 | MESA_PARTES | 3 |
| VALIDADOR | 5 | AUDITOR | 3 |
| POSTULANTE | 10 | ASOCIADO_ACTIVO | 10 |
| ASOCIADO_ESTUDIANTE | 8 | INVITADO | 5 |

`TWO_USERS_PER_ROLE_CONFIRMED = NO`. `ROLES_WITHOUT_TEST_USERS = 0`.

## 5. Excepciones QA autorizadas

El operador modificó intencionalmente 2 cuentas para recibir correos reales de prueba:

| Email | Person (seed) | DNI | Rol |
|---|---|---|---|
| `ext_analistaprogramador2@iimp.org.pe` | id 60 | 41000057 (Andrea Paredes Gil) | ASOCIADO_ACTIVO |
| `max.ichajaya2@gmail.com` | id 61 | 41000058 (Carmen Flores Aguilar) | ASOCIADO_ACTIVO |

Ocupan los `Person` de `asociado_activo.01/.02`. `User.personId` es `@unique`, por lo que el seed no
puede recrear `.01/.02` mientras estas excepciones existan (skip determinista, sin duplicados).
`OPERATOR_CONFIRMED_TEST_EMAILS = YES`.

## 6. Password de testing

- `SEED_USER_PASSWORD` no existía → se generó uno fuerte y se guardó como **SSM SecureString**
  `/afiliaciones/qa/seed-user-password`. `SEED_USER_PASSWORD_EXPOSED = NO`.
- Recuperación (operador): `aws ssm get-parameter --name /afiliaciones/qa/seed-user-password --with-decryption --region us-east-2 --query Parameter.Value --output text`.

## 7. Procedimiento ejecutado

1. Backup pre-seed → S3 (`backups/qa/pre-test-users-seed/...`, SSE AES256).
2. `seedUsers` únicamente (runner temporal con `tsx`, `NODE_ENV=staging`, `DATABASE_URL` QA,
   `SEED_USER_PASSWORD` desde SSM). No se corrieron catálogos ni datos demo.
3. Validaciones. 4. Backup post-seed → S3.

## 8. Before/After

`QA_USERS_BEFORE = 1` → `QA_USERS_AFTER = 82` (1 admin + 81 del seed; 2 con email de excepción).
`persons = 82`, `auth_credentials = 82`. Sin duplicados. `qa.admin` intacto.

## 9. Login E2E

Login real Auth.js (CSRF → credentials → session). Credenciales verificadas con bcrypt:
**81/81 @iimp OK (CRED_BAD=0)**. Login por rol: **20/20 roles OK**.
(El rate limiter de login es `20/15min` por IP, por diseño; por eso la validación de credenciales se
hizo criptográficamente y el login HTTP por rol.)

## 10. RBAC

- Positivo: SUPER_ADMIN y SYSTEM_ADMIN → `/api/security/users` = 200.
- Negativo: los otros 18 roles → denegados (no 200).
- `/intranet` autenticado: 200 (ASOCIADO_* redirige 307 a su landing).
- Deuda preexistente: `/api/security/users` devuelve **500** en vez de 403 por un `catch` genérico
  (`app/api/security/users/route.ts:44-50`). No es bypass (deniega), pero conviene mapear a 403.

## 11. Idempotencia

Segunda ejecución: 79 upserts OK + 2 skips (`Unique constraint failed on person_id` para
`asociado_activo.01/.02` por las excepciones). `DUPLICATE_USERS = 0`. Conteo estable en 82.

## 12. Regresiones

Catálogos 200 · RENIEC 200 · SUNAT 200 (`VERIFIED`) · health live/ready 200. Sin crear datos innecesarios.

## 13. Backups

Pre-seed y post-seed en `s3://.../backups/qa/{pre,post}-test-users-seed/...`, SSE AES256.

## 14. Seguridad

`SECRETS_IN_GIT=NO` · `SECRETS_IN_TFSTATE=NO` · `SECRETS_IN_IMAGE=NO` · `SECRETS_IN_LOGS=NO` ·
`SEED_PASSWORD_PRINTED=NO` · `REAL_PII_IMPORTED=0` · `PRODUCTION_USERS_IMPORTED=0` ·
`LEGACY_USERS_IMPORTED=0`.

## 15. Riesgos residuales

1. Las 2 excepciones ocupan los `Person` de `asociado_activo.01/.02`; el seed no puede recrear esos
   emails (skip determinista). Si se desea el estado 100% seed, habría que reasignar los `Person` de
   las excepciones (requiere decisión del operador).
2. `/api/security/users` responde 500 en vez de 403 para no-autorizados (deuda de error-handling).
3. El login HTTP masivo está limitado a 20/15min por IP (diseño).

## 16. Decisión final

`QA_TEST_USERS_READY = YES` · `QA_FUNCTIONALLY_READY = YES`.
