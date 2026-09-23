# QA — Auditoría de integraciones OTP (WhatsApp / SMS / Email)

> **Fase:** 3D-6.6b · **Fecha:** 2026-09-21 · **Ámbito:** QA `https://afiliaciones-qa.iimp.org.pe`
> **Modo:** DIAGNÓSTICO READ-ONLY. Sin cambios de código, sin SSM, sin deploys, sin envíos.
> `AWS_RESOURCE_MUTATIONS=0`, `SSM_CHANGES=0`, `DATABASE_WRITES=0`, `APPLICATION_CODE_CHANGES=0`,
> `DEPLOYS=0`, `EMAILS_SENT=0`, `SMS_SENT=0`, `WHATSAPP_MESSAGES_SENT=0`, `LEGACY_CHANGES=0`,
> `PRODUCTION_CHANGES=0`, `COMMITS=0`, `PUSHES=0`.
> **Sin secretos ni PII.**

---

## 1. Síntoma

Al consultar un documento con solicitud existente, la UI muestra los canales WhatsApp, SMS y Correo
(enmascarados). Al enviar por WhatsApp, `POST /api/afiliaciones/postulacion/send-otp` responde **HTTP 400**
y la UI muestra "No pudimos enviar el código por este medio.". En LOCAL funcionaba.

## 2. Request fallido

| Campo | Valor |
|---|---|
| Endpoint | `POST /api/afiliaciones/postulacion/send-otp` |
| HTTP | `400` |
| Body | `{"message":"No pudimos enviar el código por este medio."}` |
| Channel | `WHATSAPP` |
| Backend error | `VerificationError("No pudimos enviar el código por este medio.")` |
| Log histórico | **no disponible**: el contenedor `app` fue recreado (deploy 3D-6.6) y los logs del contenedor anterior se perdieron; no hay CloudWatch de app |

No se reprodujo el request en esta fase para respetar `DATABASE_WRITES=0` (todo `send-otp` hace
`reserve()` → escribe `verification_codes`). La causa se demuestra por configuración de runtime + código.

## 3. Arquitectura OTP

```
POST send-otp
  → parseOtpRequest (valida channel + context QUERY_CHALLENGE)
  → OtpRecoveryService.generateAndSendOtp
      → findApplication → destinationChannels (canales por email/phone)
      → reserve()  [DB write]
      → provider:
          EMAIL    → MailService   → SMTP (nodemailer)
          SMS      → SmsService    → AWS SNS PublishCommand
          WHATSAPP → WhatsAppService → Meta Graph API
      → catch {} → invalidate() → VerificationError → route 400
```

`OtpRecoveryService.ts:109-112` envuelve la llamada al proveedor en `catch {}` sin loguear el error
original; el route (`send-otp/route.ts:16`) devuelve el mensaje genérico para cualquier error que no
sea `VerificationError` explícito. El único rastro lo emiten los propios servicios
(`WhatsAppService.logFailure`, `SmsService`, `MailService`), salvo que la config falle antes del `try`.

## 4. WhatsApp

| Item | Detalle |
|---|---|
| Provider | Meta WhatsApp Cloud API (`https://graph.facebook.com/<v>/<phoneNumberId>/messages`) |
| Plantilla | `iimp_codigo_token`, idioma `es_PE`, body + botón URL |
| Config requerida | `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN` (obligatorias); `WHATSAPP_GRAPH_API_VERSION` (opcional, default `v26.0`) |
| `WHATSAPP_WABA_ID` | presente en local; **no** usado por el código (`grep` sin referencias) |
| Validación | `getWhatsAppConfig()` lanza `ConfigurationError` si faltan las obligatorias |

`WHATSAPP_GRAPH_API_VERSION` no está en el código más allá del default (`lib/config/env.ts:320`).

## 5. SMS

| Item | Detalle |
|---|---|
| Provider | **AWS SNS** (`PublishCommand`, SMS Transactional, SenderID `IIMP`) |
| Config | `AWS_DEFAULT_REGION` (SET en QA) + cadena de credenciales por defecto (instance role) |
| IAM | el rol `afiliaciones-qa-ec2-role` **no** incluye `sns:Publish` |
| Nota de diseño | la arquitectura QA (consolidada en `../QA_ARCHITECTURE.md`) prevé `sns:Publish` "solo si SMS está habilitado" (`enable_sns_publish`); nunca se habilitó |
| Sin envío | no se ejecutó `Publish` en esta fase |

## 6. Email

| Item | Detalle |
|---|---|
| Provider | SMTP vía `nodemailer` |
| Config requerida | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT` (obligatorias); `SMTP_SECURE`, `SMTP_FROM` (opcionales) |
| Validación | `getSmtpConfig()` lanza `ConfigurationError`; en `MailService.sendMail` se invoca **antes** del `try`, por lo que el fallo de config no se loguea |

## 7. Local vs QA

| Variable | LOCAL | QA (runtime) | REQUIRED | DIF | IMPACTO |
|---|---|---|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | SET | NOT_SET | Sí | YES | BLOQUEA WhatsApp |
| `WHATSAPP_ACCESS_TOKEN` | SET | NOT_SET | Sí | YES | BLOQUEA WhatsApp |
| `WHATSAPP_GRAPH_API_VERSION` | SET | NOT_SET | No (default) | YES | Ninguno |
| `WHATSAPP_WABA_ID` | SET | NOT_SET | No usado | YES | Ninguno |
| `SMTP_HOST` | SET | NOT_SET | Sí | YES | BLOQUEA Email |
| `SMTP_PORT` | SET | NOT_SET | Sí | YES | BLOQUEA Email |
| `SMTP_SECURE` | SET | NOT_SET | No | YES | Ninguno directo |
| `SMTP_USER` | SET | NOT_SET | Sí | YES | BLOQUEA Email |
| `SMTP_PASS` | SET | NOT_SET | Sí | YES | BLOQUEA Email |
| `SMTP_FROM` | SET | NOT_SET | No | YES | Ninguno directo |
| `AWS_DEFAULT_REGION` | SET | SET | Sí (SNS) | NO | — |
| Credenciales AWS | static keys (local) | instance role | Sí (SNS) | YES | BLOQUEA SMS (sin `sns:Publish`) |

`LOCAL_VS_QA_CONFIG_DIFFERENCE = YES`.

## 8. SSM QA

`/afiliaciones/qa/` contiene: `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `PAYMENT_ENVIRONMENT`,
`PAYMENT_TEST_AMOUNT`, `AWS_DEFAULT_REGION`, `PAYMENT_MOCK_SCENARIO`, `PAYMENT_PROVIDER`,
`auth-secret`, `database-url`, `db-password`, `jwt-secret`, `payment-auth-secret`,
`qa-admin-password`, `apis-net-pe-token`.

| Variable | SSM_PARAMETER | TYPE | EXISTS | INJECTED | STATUS |
|---|---|---|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | `/afiliaciones/qa/whatsapp-access-token` (referenciado en IAM) | SecureString | NO | NO | MISSING |
| `WHATSAPP_PHONE_NUMBER_ID` | — | — | NO | NO | MISSING |
| `WHATSAPP_GRAPH_API_VERSION` | — | — | NO | NO | MISSING (opcional) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_FROM` | — | — | NO | NO | MISSING |
| `SMTP_PASS` | `/afiliaciones/qa/smtp-pass` (referenciado en IAM) | SecureString | NO | NO | MISSING |
| SMS (SNS) | — (no requiere SSM) | — | N/A | N/A | IAM MISSING |

La IAM policy ya contempla `whatsapp-access-token` y `smtp-pass`, pero **los parámetros nunca se
crearon**. No existe parámetro para `WHATSAPP_PHONE_NUMBER_ID`.

## 9. Runtime injection

`/opt/afiliaciones-qa/app.env` (modo 600) alimenta el contenedor vía `env_file`. Claves presentes
(16): `APIS_NET_PE_TOKEN`, `AUTH_SECRET`, `AUTH_URL`, `AWS_BUCKET`, `AWS_DEFAULT_REGION`,
`DATABASE_URL`, `HOSTNAME`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `NODE_ENV`, `PAYMENT_AUTH_SECRET`,
`PAYMENT_ENVIRONMENT`, `PAYMENT_MOCK_SCENARIO`, `PAYMENT_PROVIDER`, `PAYMENT_TEST_AMOUNT`, `PORT`.

| Variable | SSM_EXISTS | BOOTSTRAP_READS | RUNTIME_VARIABLE | APP_READS |
|---|---|---|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | NO | NO | NOT_SET | Sí (`getWhatsAppConfig`) |
| `WHATSAPP_ACCESS_TOKEN` | NO | NO | NOT_SET | Sí |
| `SMTP_*` | NO | NO | NOT_SET | Sí (`getSmtpConfig`) |
| `AWS_DEFAULT_REGION` | Sí | Sí | SET | Sí (SNS) |

No existe un script de bootstrap persistente en el host: la inyección fue operativa/manual
(según el reporte 3D-6.4). La app **sí** lee estas variables; simplemente no están.

## 10. Network / egress

| Check | Resultado |
|---|---|
| `WHATSAPP_NETWORK` (DNS `graph.facebook.com` + HTTPS) | **PASS** (DNS OK; GET raíz `400` esperado sin token) |
| `SNS_NETWORK` (`sns.us-east-2.amazonaws.com`) | **PASS** (endpoint alcanzable, `404` en raíz) |
| `SMTP_NETWORK` | **NOT_APPLICABLE** (`SMTP_HOST` no configurado) |

El fallo **no** es de red/egress.

## 11. Error handling

`OTP_ERROR_HANDLING_STATUS = OPAQUE`. `OtpRecoveryService` captura con `catch {}` y descarta el error
original (sin log), invalidando el OTP y devolviendo un `VerificationError` genérico. El route responde
`400` con el mismo mensaje para cualquier fallo. `WhatsAppService` sí loguea su diagnóstico; `MailService`
no loguea cuando falla la config (ocurre antes del `try`); `SmsService` loguea el error de SNS.

`ROOT_EXCEPTION_SANITIZED`:
- WhatsApp: `WhatsAppServiceError(CONFIGURATION_ERROR)` ← `ConfigurationError: WHATSAPP_PHONE_NUMBER_ID (obligatorio); WHATSAPP_ACCESS_TOKEN (obligatorio)`.
- SMS: error de SNS `AccessDenied` (`sns:Publish` no permitido) → `Error("No se pudo enviar el mensaje...")`.
- Email: `ConfigurationError: SMTP_HOST; SMTP_USER; SMTP_PASS; SMTP_PORT` (obligatorios).

(Reproducido localmente contra `getWhatsAppConfig({})` / `getSmtpConfig({})`; solo nombres de variables,
sin valores.)

## 12. Causa raíz

| Canal | Clasificación | Evidencia |
|---|---|---|
| WhatsApp | `MISSING_CONFIG` (no configurado en QA) | runtime NOT_SET + SSM MISSING + `getWhatsAppConfig` requiere ambas |
| SMS | `IAM_FAILURE` (y no habilitado en QA) | rol QA sin `sns:Publish`; diseño lo marca "solo si SMS habilitado" |
| Email | `MISSING_CONFIG` (no configurado en QA) | runtime NOT_SET + SSM MISSING + `getSmtpConfig` requiere 4 |

No hay evidencia de bug de aplicación en el envío: el código falla correctamente cuando falta config.
Sí hay deuda: el `catch {}` oculta la causa (observabilidad) y `validate-document` ofrece canales sin
comprobar disponibilidad.

## 13. Plan de remediación (propuesto, NO aplicado)

1. **Operador** debe crear en `/afiliaciones/qa/`:
   - `WHATSAPP_PHONE_NUMBER_ID` (String) y `WHATSAPP_ACCESS_TOKEN` (SecureString) de un **sender QA**
     (no reutilizar producción sin autorización); opcional `WHATSAPP_GRAPH_API_VERSION`.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_FROM` (String) y `SMTP_PASS`
     (SecureString) de un SMTP QA.
2. **SMS**: añadir `sns:Publish` al rol `afiliaciones-qa-ec2-role` (least privilege) **solo** si se
   habilita SMS, y validar configuración de SMS de SNS (sandbox/origination) en QA.
3. Inyectar en `/opt/afiliaciones-qa/app.env` y recrear el contenedor `app` (mecanismo actual).
4. **No** copiar secretos de producción/legacy automáticamente: **requiere autorización explícita**.
5. Hardening recomendado (fase posterior, con aprobación): propagar/loguear el error del proveedor en
   `OtpRecoveryService` y que `validate-document` refleje disponibilidad real de canal.

## 14. Seguridad

- No se imprimieron valores; solo SET/NOT_SET/EXISTS/MISSING.
- No se enviaron mensajes (WhatsApp/SMS/email) ni se ejecutaron pagos.
- No se modificó SSM, IAM, infraestructura, BD, código ni documentación existente.
- El token APIS.NET.PE y demás secretos permanecen fuera de este reporte.

## 15. Estado final

- `QA_OTP_FUNCTIONALLY_READY = NO`.
- `CHANNEL_AVAILABILITY_VALIDATION = INCOMPLETE`: `destinationChannels` (`Verification.ts:10-21`) solo
  comprueba presencia de email/teléfono; `validate-document` no verifica que el proveedor del canal esté
  configurado/operativo. QA puede ofrecer WhatsApp/SMS/Email aunque ninguno esté habilitado.
- `REMEDIATION_REQUIRED = YES` (configuración operativa; sin cambio de código obligatorio para el 400).
- Causa raíz confirmada; **se detiene aquí a la espera de aprobación** antes de cualquier remediación.
