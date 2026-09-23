# Variables de entorno

Este documento enumera nombres observados en código. No contiene valores reales. La necesidad exacta depende de la capacidad activada.

## Núcleo

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Conexión PostgreSQL de Prisma. |
| `AUTH_SECRET` | Firma/seguridad de Auth.js y contexto de verificación. |
| `AUTH_URL` | URL base de autenticación y enlaces del servidor. |
| `NEXT_PUBLIC_APP_URL` | URL pública usada por enlaces; al ser pública no debe contener secretos. |
| `APP_URL` | Fallback observado para enlaces de avales. |
| `JWT_SECRET` | Tokens de revisión de avales. Debe ser secreto de servidor. |

## Correo

`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` y `SMTP_FROM`.

## AWS

| Variable | Uso observado |
| --- | --- |
| `AWS_DEFAULT_REGION` | Región para S3 y SNS. |
| `AWS_ACCESS_KEY_ID` | Credencial de servidor. |
| `AWS_SECRET_ACCESS_KEY` | Credencial de servidor. |
| `AWS_BUCKET` | Bucket de documentos. |

En despliegues AWS prefiere roles/IAM sobre claves estáticas cuando la plataforma lo permita. Nunca uses prefijo `NEXT_PUBLIC_` para estas variables.

## WhatsApp

`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_GRAPH_API_VERSION` y `WHATSAPP_WABA_ID`.

## SAP

`SAP_SERVICE_LAYER_URL`, `SAP_COMPANY_DB`, `SAP_USER` y `SAP_PASSWORD`.

## APIS.net.pe

`APIS_NET_PE_TOKEN`. Debe proporcionarse por entorno; un fallback hardcodeado en código es un hallazgo de seguridad y no debe copiarse ni conservarse como configuración válida.

## Pagos

Variables generales observadas:

- `PAYMENT_PROVIDER`
- `PAYMENT_ENVIRONMENT`
- `PAYMENT_MOCK_SCENARIO`
- `PAYMENT_TEST_AMOUNT`
- `PAYMENT_AUTH_SECRET` (obligatorio, mínimo 32 caracteres y exclusivo del dominio de pagos; no reutilizar `AUTH_SECRET`)
- `PAYMENT_AUTH_TTL_SECONDS`

Niubiz usa grupos equivalentes `NIUBIZ_TEST_*` y `NIUBIZ_PROD_*` para credenciales, endpoints, URLs de retorno, identidad del comercio y ubicación. Consulta `modules/afiliaciones/payments/Config/PaymentConfig.ts` y [PAYMENTS.md](PAYMENTS.md); no inventes nombres o valores.

## Reglas

- `.env.example` solo contiene nombres y valores seguros de ejemplo.
- `.env` nunca se versiona.
- No registres valores de entorno.
- Valida variables requeridas al arrancar la capacidad correspondiente.
- Separa TEST y PRODUCTION.
- Rota cualquier secreto que haya sido expuesto en código, logs o conversaciones.
