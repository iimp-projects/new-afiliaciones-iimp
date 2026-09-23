# Ultra-Lean QA — Terraform Refactor & Plan

> **Fecha:** 2026-09-20 · **Región:** us-east-2 · **Moneda:** USD · **PEN:** referencial (TC 3.70)
> **Plan Terraform:** 35 add / 0 change / 0 destroy · **Sin apply**.
> Precios verificados vía AWS Pricing API (us-east-2).

---

## 1. Executive Summary

Se refactorizó el Terraform QA a la arquitectura **Ultra-Lean**: una única EC2 con Caddy,
Docker (Next.js + Chromium) y PostgreSQL local, más S3, ECR, SSM Parameter Store, CloudWatch
(7 días), IAM Instance Role y un scheduler opcional. Se **eliminaron** ALB, ECS, NAT Gateway,
RDS y Secrets Manager del entorno QA. El plan resultante es **35 add / 0 change / 0 destroy**,
sin recursos de producción ni legacy. Costo ≈ **USD 24/mes 24x7** o **≈ USD 14/mes** en horario
L-V 08:00–20:00 America/Lima.

## 2. Final QA Architecture

```
Internet → Elastic IP → EC2 t3.small (x86_64)
                          ├── Caddy (:80/:443, Let's Encrypt) → app:3000
                          └── Docker
                                ├── app (Next.js standalone + Chromium + Prisma Client)
                                └── postgres (PostgreSQL 16, red interna)
                          ├── EBS gp3 (raíz 20 GB + datos 30 GB, cifrados)
                          ├── IAM Instance Role (S3, SSM, Logs, ECR pull)
                          ├── SSM Agent (Session Manager, sin SSH)
                          ├── CloudWatch Logs (7 días)
                          └── egress por IP pública (SMTP/Niubiz/SAP/WhatsApp/APIS/SIE)
Servicios: S3 QA (documentos + backups) · ECR · SSM Parameter Store · CloudWatch
Opcional: EventBridge Scheduler (L-V 08:00–20:00 America/Lima)
```

## 3. Diagrama ASCII

```
                         Internet
                            │  HTTPS 443 / HTTP 80 (ACME)
                            ▼
                     [ Elastic IP ]
                            │
                            ▼
        ┌───────────────────────────────────────────┐
        │ EC2 t3.small (Amazon Linux 2023, x86_64)  │
        │  ┌───────────┐   :443   ┌──────────────┐  │
        │  │  Caddy    │─────────▶│  app:3000    │  │
        │  └───────────┘          │ Next.js +    │  │
        │        │                │ Chromium     │  │
        │        │                └──────┬───────┘  │
        │        │                       │          │
        │        │              ┌────────▼───────┐  │
        │        │              │ postgres:5432  │  │
        │        │              │ (red interna)  │  │
        │        │              └────────┬───────┘  │
        │        └───────────── /data ───┴── EBS gp3 │
        └───────────────────────────────────────────┘
             │ egress                    │ SSM/S3/ECR/Logs
             ▼                           ▼
    SMTP · Niubiz · SAP · WhatsApp   S3 · ECR · SSM · CloudWatch
    APIS.NET.PE · SIE
```

## 4. AWS Resources (plan)

| Categoría | Recursos | Cantidad |
|---|---|---:|
| Network | VPC, subnet pública, IGW, route table, route, asociación | 6 |
| EC2 | instancia, SG + 2 reglas, IAM role/profile/policy/attachment, EBS datos, volume attachment, EIP, asociación | 13 |
| ECR | repositorio + lifecycle | 2 |
| Observability | CloudWatch log group | 1 |
| SSM | parámetros String (config) | 7 |
| Storage | bucket + ownership + PAB + SSE + versioning + lifecycle | 6 |
| Scheduler | (deshabilitado) | 0 |
| **Total** | | **35** |

## 5. EC2 Specification

- Tipo: **t3.small** (2 vCPU burstable, 2 GB), x86_64.
- AMI: Amazon Linux 2023 vía parámetro público SSM `/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64`.
- Raíz: gp3 20 GB cifrado (`delete_on_termination=true`).
- Datos: EBS gp3 30 GB cifrado, recurso independiente (persiste al terminar la instancia).
- `associate_public_ip_address=false` (usa Elastic IP); IMDSv2 obligatorio.
- Administración: SSM Session Manager (sin SSH).

## 6. Docker Architecture

`docker compose` (colocado en `/opt/afiliaciones-qa` en el despliegue): servicios `caddy`,
`app`, `postgres`. Redes `edge` y `data`; PostgreSQL sin puertos publicados; volúmenes en `/data`;
`restart: unless-stopped`; healthchecks. Secretos vía env desde SSM (nunca en el compose).

## 7. PostgreSQL Architecture

PostgreSQL 16 en contenedor, datos en `/data/postgres` (EBS), solo red Docker interna
(`postgres:5432`), **no** accesible desde Internet. `DATABASE_URL` con hostname interno
`postgres`. Sin contraseñas reales en el repositorio.

## 8. Network Architecture

VPC dedicada `10.20.0.0/16`, **una** subred pública `10.20.0.0/24` (us-east-2a), IGW y route
table. **Sin NAT, sin endpoints, sin subredes privadas.** Aislamiento explícito respecto de
producción a costo ~0.

## 9. Security Architecture

- SG: inbound **80/443** únicamente; **sin** 22/3000/5432/3389.
- Egress amplio (AWS APIs + integraciones externas) documentado.
- EBS cifrado; S3 privado; IMDSv2; administración por SSM.

## 10. IAM

Instance Role con:
`AmazonSSMManagedInstanceCore` + inline: S3 (`GetObject/PutObject` en `afiliaciones/*`,
`backups/*`; `ListBucket`), SSM (`GetParameter(s)`, `GetParametersByPath` sobre los ARNs QA),
CloudWatch Logs (`CreateLogStream`, `PutLogEvents`, `DescribeLogStreams`), ECR
(`GetAuthorizationToken`, `GetDownloadUrlForLayer`, `BatchGetImage`, `BatchCheckLayerAvailability`).
`SNS Publish` solo si se habilita. Sin `AdministratorAccess` ni `Action="*"` salvo
`ecr:GetAuthorizationToken` y `sns:Publish` (justificados).

## 11. Secrets / SSM

Namespace `/afiliaciones/qa/`.
- **String (no sensibles)** creados por Terraform: `AUTH_URL`, `NEXT_PUBLIC_APP_URL`,
  `AWS_DEFAULT_REGION`, `PAYMENT_PROVIDER`, `PAYMENT_ENVIRONMENT`, `PAYMENT_MOCK_SCENARIO`,
  `PAYMENT_TEST_AMOUNT`.
- **SecureString (secretos)** NO creados por Terraform (solo se derivan sus ARNs para IAM):
  `auth-secret`, `payment-auth-secret`, `jwt-secret`, `database-url`, `smtp-pass`,
  `sap-password`, `apis-net-pe-token`, `whatsapp-access-token`, `associates-api-password`,
  `niubiz-test-username`, `niubiz-test-password`. Valores cargados fuera del repositorio.
- `SECRETS_IN_TERRAFORM_STATE = NO_BY_DESIGN`.

## 12. HTTPS / Caddy

Caddy con TLS automático (Let's Encrypt) para `afiliaciones-qa.iimp.org.pe`; HTTP→HTTPS.
Configurar `trusted_proxies` y **sobrescritura** de `X-Forwarded-For/Proto/Host` hacia el backend
(mitiga el hallazgo histórico de confianza en XFF). Sin ACM (Let's Encrypt en su lugar).

## 13. Backup Strategy

`pg_dump` diario → `s3://<bucket>/backups/qa/YYYY/MM/DD/` (SSE, versioning, 30 días) +
snapshots EBS semanales (opcional). Sin datos productivos.

## 14. Restore Strategy

`S3 → pg_restore → prisma migrate deploy → restart app → /api/health/live y /ready`.
`BACKUP_RESTORE_VALIDATION_REQUIRED = true`.

## 15. Logging

CloudWatch Logs, retención **7 días**: aplicación, startup, Caddy, PostgreSQL, migraciones,
backup, errores de Chromium. Deuda de PII en logs permanece pendiente (fuera de alcance).

## 16. Health Checks

`GET /api/health/live` (proceso) y `GET /api/health/ready` (PostgreSQL). Caddy solo hace proxy;
el health se valida externamente.

## 17. Scheduler (08:00–20:00 America/Lima)

EventBridge Scheduler con `schedule_expression_timezone = "America/Lima"`:
- start `cron(0 8 ? * MON-FRI *)`, stop `cron(0 20 ? * MON-FRI *)`.
- `enable_scheduler` (default **false**) para períodos de validación.
- IAM mínimo: `ec2:StartInstances`/`StopInstances` solo sobre la EC2 QA.

## 18. Cost 24x7

| Componente | USD/mes |
|---|---:|
| EC2 t3.small (730 h) | 15.18 |
| EBS gp3 50 GB | 4.00 |
| Elastic IP | 3.65 |
| S3 + ECR + CloudWatch | ~1.20 |
| **Total** | **≈ 24.03** |

PEN ref.: ≈ **S/ 89/mes**.

## 19. Cost Office Hours (L-V 08:00–20:00)

12 h/día × 5 días ≈ 260 h/mes:
- EC2: 0.0208 × 260 = **5.41**; EBS 4.00 (continúa); EIP 3.65 (continúa); S3/ECR/CW ~1.20.
- **Total ≈ 14.26 USD/mes** (≈ **S/ 53/mes**).

## 20. Terraform Plan Summary

- `ADD = 35` · `CHANGE = 0` · `DESTROY = 0`.
- Sin `aws_lb`, `aws_ecs_*`, `aws_db_instance`, `aws_nat_gateway`.
- `fmt` PASS · `validate` PASS · `plan` PASS.

## 21. Remaining Risks

- Validación runtime de Chromium en EC2.
- Restore no validado.
- DNS/Let's Encrypt pendientes (hostname no creado).
- Deuda de PII en logs.
- Backend de state no configurado (requiere bootstrap).

## 22. Deployment Preconditions

- Aprobar arquitectura y costo.
- Bootstrap del backend de state.
- Crear DNS `afiliaciones-qa.iimp.org.pe` → EIP.
- Cargar parámetros SecureString en SSM.
- Publicar imágenes en ECR.
- Autorización humana explícita para apply.

## 23. Production Boundary

`PRODUCTION = OUT_OF_SCOPE`. La arquitectura Ultra-Lean **no** es de producción. Producción
futura requeriría ALB, ECS ≥2 tasks, RDS Multi-AZ, NAT, autoscaling, WAF, Secrets Manager,
PITR y alarmas. No se modifica ni se toca el sistema legacy ni `afiliacion.iimp.org.pe`.
