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

## Prevalidación documental con Gemini

Deshabilitada por defecto. Solo aplica a la constancia de estudios de Asociado Estudiante.

| Variable | Uso |
| --- | --- |
| `DOCUMENT_AI_VALIDATION_ENABLED` | `true` habilita la prevalidación. Cualquier otro valor la desactiva. |
| `GEMINI_API_KEY` | Clave server-side; obligatoria solo si la prevalidación está habilitada. |
| `DOCUMENT_AI_MODEL` | Modelo multimodal. Si no se define, se reutiliza `GEMINI_MODEL`. |
| `DOCUMENT_AI_TIMEOUT_MS` | Timeout por llamada (5000–60000; por defecto 25000). |
| `DOCUMENT_AI_MAX_RETRIES` | Reintentos ante 429/5xx/timeout/red (0–2; por defecto 1). |
| `DOCUMENT_AI_MAX_FILE_BYTES` | Tamaño máximo del archivo (por defecto 10 MB). |
| `DOCUMENT_AI_MAX_PAGES` | Máximo de páginas PDF (por defecto 5). |
| `DOCUMENT_AI_MAX_IMAGE_DIMENSION` | Resolución máxima de imágenes (por defecto 6000 px). |
| `DOCUMENT_AI_CACHE_TTL_HOURS` | Vigencia de la extracción reutilizable (por defecto 720 h). |
| `DOCUMENT_AI_VALIDITY_MAX_SEMESTERS` | Semestres previos aceptados además del actual (por defecto 1). |
| `DOCUMENT_AI_CURRENT_PERIOD` | Periodo académico institucional opcional, por ejemplo `2026-II`. |

No uses prefijo `NEXT_PUBLIC_` para estas variables. La clave y el contenido documental no deben registrarse en logs.

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
