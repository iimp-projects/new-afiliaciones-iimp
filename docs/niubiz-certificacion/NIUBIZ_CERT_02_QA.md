# NIUBIZ-CERT-02 — Despliegue controlado a QA

> Documento de evidencia del intento de despliegue a QA. Generado el 2026-10-20.
> **Ámbito autorizado: exclusivamente QA.** Prohibido producción.

## Estado global

```text
NIUBIZ_CERT_02_STATUS        = PARTIAL
QA_DEPLOYED                  = NO
QA_HEALTH                    = FAIL            (no verificable: el despliegue no se ejecutó)
NIUBIZ_SANDBOX_SESSION       = PENDING
NIUBIZ_CHECKOUT              = PENDING
SANDBOX_APPROVED_PAYMENT     = PENDING
SANDBOX_DECLINED_PAYMENT     = PENDING
READY_FOR_CERTIFICATION_PDF  = NO
```

**Motivo del detenimiento (FASE 04):** los campos institucionales de fallback del `dataMap` de Session que exige NIUBIZ-CERT-01 **no están configurados** en el Parameter Store de QA. Desplegar el código sin esa configuración haría que el flujo de pago Niubiz falle con `503` al iniciar la sesión. La instrucción de la tarea exige detenerse y reportar exactamente qué falta.

---

## FASE 01 — Auditoría previa

- **Rama de origen:** `feature/niubiz-cert-01` (confirmada).
- **Base:** `origin/master` = `5bbb30c` (idéntico a la rama de trabajo; sin divergencia).
- **`origin/qa/stable`** = `869a117` (por detrás de `master`; el flujo QA documentado despliega desde `master` vía `workflow_dispatch`).
- **Cambios preexistentes ajenos preservados:** `infra/terraform/environments/prod/variables.tf` (modificación previa, **NO** incluida en el commit, **NO** desplegada).
- **Otras funcionalidades:** no se identificaron cambios ajenos no evaluados en el working tree; el único archivo no relacionado con Niubiz es `prod/variables.tf`.
- **Prisma/migraciones:** las correcciones de NIUBIZ-CERT-01 son solo código TypeScript + pruebas + documentación. **Sin cambios de `schema.prisma` ni migraciones.**

## FASE 02 — Consolidación de cambios

- Rama de integración segura: `integration/niubiz-cert-02-qa`.
- Commit: `dd0aecb` `feat(niubiz): corregir integración Niubiz V3 para certificación`.
- Archivos incluidos (9): exclusivamente Niubiz (código, pruebas y documentación).

```text
docs/niubiz-certificacion/NIUBIZ_CERT_01.md
modules/afiliaciones/payments/Config/PaymentConfig.ts
modules/afiliaciones/payments/Providers/NiubizPaymentProvider.ts
modules/afiliaciones/payments/Services/Niubiz/NiubizResponseMapper.ts
modules/afiliaciones/payments/Services/Niubiz/NiubizSecurityService.ts
modules/afiliaciones/payments/Services/PaymentService.ts
modules/afiliaciones/payments/Tests/NiubizCertification.test.ts
modules/afiliaciones/payments/Tests/NiubizPaymentProvider.test.ts
modules/afiliaciones/payments/Tests/NiubizServices.test.ts
```

- **Excluidos:** `infra/terraform/environments/prod/variables.tf` (Terraform PROD) y cualquier archivo con secretos. Sin force push. Sin conflictos (la base es `origin/master`).

## FASE 03 — Validación previa al despliegue

```text
npm run typecheck  → OK (0 errores)
npm run lint       → OK (0 errores)
npm run test       → OK (210 archivos, 1867 tests)
npm run build      → OK (1 warning preexistente en instrumentation.ts, no relacionado)
```

Confirmado: MDD4/MDD32/MDD75/MDD77, `dataMap` de 6 campos, Checkout + Authorization, fecha America/Lima. Sin regresiones. Sin migraciones pendientes.

## FASE 04 — Configuración QA (auditada en SSM `/afiliaciones/qa`)

### Presente y correcto

| Variable | Valor/Estado |
|---|---|
| `PAYMENT_PROVIDER` | `NIUBIZ` |
| `PAYMENT_ENVIRONMENT` | `TEST` |
| `NIUBIZ_TEST_MERCHANT_ID` | `456879852` (Sandbox PEN) |
| `NIUBIZ_TEST_SECURITY_URL` | `https://apisandbox.vnforappstest.com/api.security/v1/security` |
| `NIUBIZ_TEST_SESSION_URL` | `https://apisandbox.vnforappstest.com/api.ecommerce/v2/ecommerce/token/session` |
| `NIUBIZ_TEST_AUTHORIZATION_URL` | `https://apisandbox.vnforappstest.com/api.authorization/v3/authorization/ecommerce` |
| `NIUBIZ_TEST_CHECKOUT_URL` | `https://static-content-qas.vnforapps.com/env/sandbox/js/checkout.js` |
| `NIUBIZ_TEST_CALLBACK_URL` | `https://afiliaciones-qa.iimp.org.pe/api/payments/niubiz/callback` (QA) |
| `NIUBIZ_TEST_TIMEOUT_URL` | `https://afiliaciones-qa.iimp.org.pe/consulta` (QA) |
| Authorization `dataMap` (5 campos) | URL_ADDRESS, CITY_NAME=Lima, COUNTRY_CODE=PE, SUBDIVISION=LIM, POSTAL=15024 |
| Credenciales Security | `niubiz-test-username` / `niubiz-test-password` (SecureString, presentes; valores no leídos) |

### BLOQUEANTE — faltan los campos institucionales de fallback del `dataMap` (Session)

NIUBIZ-CERT-01 introdujo `assertCardholderDataConfigured()` en `NiubizPaymentProvider`, que exige estos 5 campos (y recomienda el sexto) en la configuración del servidor. **No existen** en SSM QA:

| Parámetro SSM requerido | Estado |
|---|---|
| `/afiliaciones/qa/NIUBIZ_TEST_CARDHOLDER_CITY` | **FALTA** |
| `/afiliaciones/qa/NIUBIZ_TEST_CARDHOLDER_COUNTRY` | **FALTA** |
| `/afiliaciones/qa/NIUBIZ_TEST_CARDHOLDER_ADDRESS` | **FALTA** |
| `/afiliaciones/qa/NIUBIZ_TEST_CARDHOLDER_POSTAL_CODE` | **FALTA** |
| `/afiliaciones/qa/NIUBIZ_TEST_CARDHOLDER_STATE` | **FALTA** |
| `/afiliaciones/qa/NIUBIZ_TEST_CARDHOLDER_PHONE` | **FALTA** (opcional si el teléfono real del postulante siempre está presente) |

Sin estos valores, `POST /api/payments` devolverá `503 "Sesión Niubiz incompleta. Faltan: ..."` y el Checkout no se abrirá.

### Qué se necesita para desbloquear (no ejecutar sin autorización)

1. Confirmar con IIMP/Niubiz los valores institucionales exactos. Candidatos **por confirmar** (NO inventados, derivados de datos ya confirmados en el sistema):
   - `CARDHOLDER_CITY` = `Lima`
   - `CARDHOLDER_COUNTRY` = `PE`
   - `CARDHOLDER_STATE` = `LIM` (o el departamento según el formato oficial de la guía)
   - `CARDHOLDER_POSTAL_CODE` = `15024`
   - `CARDHOLDER_ADDRESS` = dirección institucional (ej. `Calle Los Canarios 155-157, La Molina`)
   - `CARDHOLDER_PHONE` = teléfono institucional oficial (no disponible en el código actual)
2. Cargar los parámetros como `String` en SSM `/afiliaciones/qa/` (vía `terraform.tfvars` + `terraform apply` manual autorizado, o `aws ssm put-parameter`).
3. Confirmar que el `docker-compose.yml` de la instancia QA expone esas variables como `NIUBIZ_TEST_CARDHOLDER_*` al contenedor `app`.
4. Re-ejecutar el despliegue QA (`git push` + `workflow_dispatch` `confirm_deploy=true`).

## FASE 05 — Despliegue QA

**NO ejecutado** (detenido en FASE 04 por falta de configuración obligatoria).

## FASE 06 — Pruebas posteriores

**No aplican** (no hubo despliegue). Quedan PENDIENTE: acceso, postulación, pago sintético, sesión Niubiz, Checkout, HTTPS/dominio callback, doble pago, errores controlados, y pruebas Sandbox de aprobación/rechazo.

## FASE 07 — Incidencias y pendientes

1. **Bloqueante:** faltan 5 (+1 recomendado) parámetros `NIUBIZ_TEST_CARDHOLDER_*` en QA.
2. **Confirmación de valores institucionales:** no se inventaron; requieren aprobación IIMP/Niubiz.
3. **Naming de credenciales:** `niubiz-test-username`/`niubiz-test-password` (SecureString) → confirmar mapeo a `NIUBIZ_TEST_USERNAME`/`NIUBIZ_TEST_PASSWORD` en el compose de la instancia (pre-existente, no introducido por CERT-01).
4. Autenticidad del callback Niubiz y semántica MDD/`TRANSACTION_DATE`: pendientes de contrato oficial (ver NIUBIZ_CERT_01).

## FASE 08 — Resultado

Ver bloque "Estado global" al inicio de este documento.
