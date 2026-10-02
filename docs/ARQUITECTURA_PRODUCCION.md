# ARQUITECTURA DE PRODUCCIÓN — AFILIACIONES IIMP

> Documento maestro y fuente de verdad para la implementación Terraform y el despliegue a producción del Sistema de Afiliaciones IIMP.
> Estado: `APPROVED_BASELINE_WITH_PENDING_VALIDATIONS` (revisión V1.1: alta disponibilidad de aplicación + CloudFront + WAF).
> Última actualización: 01 de octubre de 2026.

## Requisitos obligatorios (revisión con líder técnico)

```text
HIGH_AVAILABILITY_APP = NOT_REQUIRED (self-healing con 1 EC2 + ASG; tolerancia 2–6 min)
EC2_MIRROR_INSTANCES = 1  (una EC2 normalmente activa; ASG reemplaza ante fallo)

CLOUDFRONT = REQUIRED
AWS_WAF = REQUIRED

SEARCH_ENGINE_INDEXING = DISABLED

SECURITY_LEVEL = REASONABLE_PRODUCTION_SECURITY (no enterprise over-engineering)
```

---

## 1. Fuentes de verdad

Este documento se deriva de:

- Repositorio (`prisma/schema.prisma`, `modules/`, `Dockerfile`, `next.config.ts`, `lib/auth.config.ts`).
- Terraform QA existente (`infra/terraform/`).
- Documentación QA (`docs/QA_ARCHITECTURE.md`, `docs/AWS_ARCHITECTURE.md`).
- Auditorías de seguridad (`auditoria_seguridad*.md`, `docs/SECURITY.md`).
- Workflows GitHub Actions (`.github/workflows/qa-deploy.yml`, `security.yml`).
- Último análisis de arquitectura PROD (sesiones previas de evaluación).

Convención de estado de cada afirmación:

```text
CONFIRMED            = verificado en el repositorio
PROPOSED             = diseñado y aprobado como baseline, aún no implementado
PENDING_VALIDATION   = requiere confirmación externa o prueba antes de dar por cierto
EXTERNAL_DEPENDENCY  = depende de contrato/proveedor fuera del repo
FUTURE               = diferido, se activa con métricas/requisitos
```

Skills aplicadas: `terraform-style-guide` (estructura/estilo, seguridad del state, Secrets Manager nativo), `aws-serverless` (patrones HA/ALB, checklist de producción, anti-patrones), `security-audit` (superficie, secretos, límite de confianza), `next-best-practices` (self-hosting standalone, cache handler multi-instancia, health checks).

---

## 2. Requisitos de negocio

```text
USERS_NORMAL_DAY          = 20–30
PEAK_USERS_ESTIMATE       = 150–200
PEAK_CONCURRENCY          = NOT_CONFIRMED

ACCEPTABLE_APPLICATION_RECOVERY = 2–6 minutes
TARGET_RTO_APPLICATION    <= 6 minutes
```

> Nota: `150–200` usuarios en pico **no** significa usuarios concurrentes. Incluye postulantes, revisores, administradores y personal interno. No existe evidencia para afirmar concurrencia ni requests/segundo; se clasifica como `NOT_CONFIRMED`.

Prioridades de la arquitectura (en orden):

1. Disponibilidad (recuperación automática con 1 EC2 activa + ASG self-healing).
2. Seguridad (CloudFront + WAF + least privilege).
3. Simplicidad operativa.
4. Costo razonable.
5. Mantenibilidad.

---

## 3. Arquitectura PROD baseline

```text
                        INTERNET
                           │
                           ▼
                       Route53
                           │
                           ▼
                       CloudFront
                           │
                        AWS WAF
                           │
                           ▼
                     ALB + ACM
                     HTTPS / TLS
                            │
                            ▼
                      EC2 PROD (una activa)
                            │
                      Auto Scaling Group
                     min     = 1
                     desired = 1
                     max     = 1
                           │
                    Launch Template
                           │
                         Docker
                           │
                     Next.js :3000
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
     PostgreSQL           S3           SSM / Secrets
     RDS Single-AZ       privado
          │
          ▼
      Backup / PITR
```

Servicios complementarios:

```text
ECR · CloudWatch · IAM · GitHub Actions OIDC · Route53 · ACM ·
SMTP · Niubiz · APIS.net.pe · SAP · SIE · WhatsApp
```

---

## 4. Decisiones de arquitectura

| Decisión | Estado | Justificación |
|---|---|---|
| EC2 + Docker | APPROVED | PDF con Puppeteer/Chromium exige sandbox (seccomp) solo disponible en Docker sobre EC2 (`DeclarationPdfService.ts`, `Dockerfile`) |
| CloudFront | APPROVED (REQUIRED) | Entrada HTTPS global + asociación WAF + `X-Robots-Tag` noindex |
| AWS WAF | APPROVED (REQUIRED) | Reglas gestionadas (COUNT) + rate-based (BLOCK) sobre CloudFront |
| ALB | APPROVED | Health checks, TLS, distribución, único origen detrás de CloudFront |
| ACM | APPROVED | TLS gratuito y renovación automática (ALB en us-east-2, CloudFront en us-east-1) |
| ASG desired=1 (min=1, max=1) | APPROVED | Self-healing: 1 EC2 activa; ASG reemplaza ante fallo (recuperación 2–6 min aceptada) |
| RDS Single-AZ | APPROVED | Costo razonable; failover de base diferido |
| S3 PROD separado | APPROVED | Aislamiento QA/PROD |
| Caddy PROD | REMOVE / REDUNDANT | ALB+ACM resuelve TLS/headers/redirect |
| NAT Gateway | NOT INITIAL | EC2 en subredes públicas endurecidas; ahorro ~USD 33/mes |
| Autoscaling dinámico (CPU) | FUTURE | El ASG se usa para salud/reemplazo/self-healing, no escala masiva |
| RDS Multi-AZ | FUTURE | Con requisito de continuidad de base |
| CloudFront caché agresiva | FUTURE | Aplicación dinámica autenticada; caché deshabilitada por defecto |

**Riesgos aceptados:** ver sección 30.

---

## 5. Caddy

QA:

```text
Internet → Caddy → Next.js
```

PROD:

```text
Internet → CloudFront + WAF → ALB + ACM → Next.js :3000
```

Caddy se elimina de PROD porque cada responsabilidad la asume el ALB/ACM:

| Responsabilidad | QA | PROD |
|---|---|---|
| TLS | Caddy + Let's Encrypt | ACM |
| Reverse proxy | Caddy | ALB + Target Group |
| HTTP→HTTPS | Caddy | Listener ALB |
| Health checks | Caddy/Compose | Target Group |
| Forwarded headers | Caddy | ALB (`X-Forwarded-*`) |

No se modifica QA: Caddy permanece vigente allí.

---

## 6. Self-healing

```text
EC2-A falla
   ↓
ALB health check detecta unhealthy
   ↓
ALB deja de enrutar a EC2-A (EC2-B sigue sirviendo)
   ↓
ASG retira EC2-A
   ↓
ASG crea EC2-C (Launch Template)
   ↓
Bootstrap
   ↓
ECR pull
   ↓
Docker
   ↓
Next.js
   ↓
/ready = 200
   ↓
ALB HEALTHY (agrega EC2-C)
```

```text
RTO <= 6 minutes   (recuperación total de capacidad; el tráfico NO se interrumpe
                    porque EC2-B permanece sirviendo durante el reemplazo)
ESTADO_INICIAL = NOT_VERIFIED
```

No declarar cumplido hasta ejecutar la prueba real (sección 27).

---

## 7. Networking

```text
VPC PROD (separada de QA)

Public subnet AZ-A   → CloudFront/WAF (edge, global) + ALB-A + EC2-A
Public subnet AZ-B   → ALB-B + EC2-B

Private DB subnet AZ-A
Private DB subnet AZ-B
```

Baseline inicial:

```text
CloudFront + WAF → edge global (us-east-1 para WAF/certificado)
ALB       → public subnets (AZ-A, AZ-B)
EC2 / ASG → public subnets (AZ-A, AZ-B), 1 instancia activa (self-healing)
RDS       → private DB subnets
```

Reglas de exposición de EC2:

```text
INBOUND DIRECT INTERNET → DENY
ALB SG → EC2:3000       → ALLOW
CloudFront → ALB        → protegido por header de origen (x-origin-verify)
SSM → administration
SSH → DISABLED
```

**Por qué `NAT_GATEWAY = NO` inicialmente:** la aplicación necesita egress a proveedores externos con IP dinámica (Niubiz, SAP, WhatsApp, SMTP, APIS.net.pe); los VPC endpoints solo cubren servicios AWS, no esos proveedores. Manteniendo EC2 en subred pública (con IP pública para egress) se evita el NAT sin exponer el puerto 3000 (el SG solo acepta ingreso desde el ALB). Impacto de introducir NAT posteriormente: ver sección 23.

---

## 8. Security Groups

```text
ALB_SG
  80   ← Internet
  443  ← Internet

APP_SG
  3000 ← ALB_SG only

RDS_SG
  5432 ← APP_SG only
```

Prohibido:

```text
5432 → 0.0.0.0/0
3000 → 0.0.0.0/0
22   → 0.0.0.0/0
```

Administración de EC2 exclusivamente por SSM Session Manager (sin SSH).

---

## 9. Terraform — estructura objetivo

Estructura conceptual (compatible con el repo; no se crean archivos todavía):

```text
infra/terraform/
│
├── modules/
│   ├── network/
│   ├── alb/
│   ├── autoscaling/
│   ├── rds/
│   ├── s3/
│   ├── iam/
│   ├── ecr/
│   ├── monitoring/
│   └── dns/
│
└── environments/
    ├── qa/
    └── prod/
        ├── main.tf
        ├── variables.tf
        ├── outputs.tf
        ├── providers.tf
        ├── versions.tf
        ├── backend.tf
        └── terraform.tfvars.example
```

La estructura real actual usa nombres ligeramente distintos (`network`, `storage`, `observability`, `ec2`, `alb`, `rds`, `ecr`, `iam`, `secrets`, `security`, `ssm`, `scheduler`, `ecs`, `github-actions-qa-deploy`). El objetivo respeta los módulos existentes y añade los que faltan.

| Módulo Terraform (objetivo) | Existe QA | Reutilizable | Requiere cambios | Nuevo PROD |
|---|---|---|---|---|
| network | Sí (`network`) | Sí | Ampliar subredes privadas DB (2 AZ) | No |
| alb | Sí (`alb`) | Sí | `enable_https`, ACM, listener prod | No |
| autoscaling | No | — | — | **Sí** (launch template + ASG) |
| rds | Sí (`rds`) | Sí | Deletion protection, subnet group | No |
| s3 | Sí (`storage`) | Sí | Bucket PROD | No |
| iam | Sí (`iam`, parcial) | Parcial | Roles PROD (app/migration/terraform) | Parcial |
| ecr | Sí (`ecr`) | Sí | No | No |
| monitoring | Sí (`observability`, parcial) | Parcial | Añadir alarmas | Parcial |
| dns | No (el módulo `alb` tiene record opcional) | — | — | **Sí** |
| secrets | Sí (`secrets`) | Sí | Namespace prod | No |
| ssm | Sí (`ssm`) | Sí | Namespace prod | No |
| security | Sí (`security`) | Parcial | SGs PROD | Parcial |
| ec2 (instancia puntual) | Sí | No en PROD (reemplazado por autoscaling) | — | No usar |
| ecs | Sí | No (no usado en PROD) | — | FUTURE |
| scheduler | Sí | Parcial | Jobs single-instance | FUTURE |

---

## 10. Terraform state

```text
QA STATE != PROD STATE
```

PROD jamás comparte state con QA.

```text
S3 backend      = bucket dedicado por environment, versionado, cifrado
encryption      = KMS (o SSE) 
versioning      = enabled
locking         = use_lockfile (locking nativo del backend S3)
environment separation = key distinta por environment
```

Nunca secretos en el state de forma deliberada; el state se trata como dato altamente sensible.

---

## 11. Recursos Terraform PROD

Inventario completo esperado:

```text
aws_vpc
aws_subnet (public ×2, private-db ×2)
aws_route_table + aws_route
aws_internet_gateway

aws_security_group (ALB, APP, RDS)

aws_lb
aws_lb_listener (80 redirect, 443 forward)
aws_lb_target_group

aws_acm_certificate
aws_acm_certificate_validation

aws_launch_template
aws_autoscaling_group

aws_db_subnet_group
aws_db_instance

aws_s3_bucket
aws_s3_bucket_versioning
aws_s3_bucket_server_side_encryption_configuration
aws_s3_bucket_public_access_block
aws_s3_bucket_ownership_controls
aws_s3_bucket_lifecycle_configuration

aws_ecr_repository

aws_iam_role / aws_iam_policy / aws_iam_instance_profile
aws_iam_openid_connect_provider (reutiliza el de la cuenta si aplica)

aws_cloudwatch_log_group
aws_cloudwatch_metric_alarm

aws_route53_record
```

Clasificación:

| Recurso | Clase |
|---|---|
| aws_vpc, subnets, IGW, route tables | CREATE |
| aws_lb, listeners, target group | CREATE |
| aws_acm_certificate | CREATE (PENDING_VALIDATION: dominio) |
| aws_launch_template, aws_autoscaling_group | CREATE |
| aws_db_subnet_group, aws_db_instance | CREATE |
| aws_s3_bucket + controles | CREATE |
| aws_ecr_repository | CREATE (reutiliza patrón QA) |
| aws_iam_* (app, migration, terraform, ops) | CREATE |
| aws_cloudwatch_log_group, metric_alarm | CREATE |
| aws_route53_record | CREATE (PENDING_VALIDATION: dominio) |
| aws_iam_openid_connect_provider | REUSE (mismo account/provider) |
| WAF, NAT, Multi-AZ, desired=2 | FUTURE |

---

## 12. Launch Template

Debe contener:

```text
AMI                 = Amazon Linux 2023 (parámetro SSM público, x86_64)
instance type       = t3.small
IAM instance profile= rol EC2 aplicación (least privilege)
IMDSv2              = required (http_tokens = required)
security groups     = APP_SG
user_data           = bootstrap (templatefile; sin secretos)
EBS                 = gp3 cifrado, root 20 GB
tags                = Project, Environment, ManagedBy, Application
```

Sin secretos en `user_data`.

---

## 13. Bootstrap EC2

```text
EC2 starts
 ↓
Docker disponible
 ↓
AWS IAM authentication (instance role)
 ↓
SSM / Secrets (config + secretos)
 ↓
ECR login
 ↓
pull exact IMAGE DIGEST (nunca :latest)
 ↓
docker run (tini, no-root, restart unless-stopped)
 ↓
RDS connection
 ↓
S3 access
 ↓
/live = 200
 ↓
/ready = 200
 ↓
ALB HEALTHY
```

Requisitos:

```text
IDEMPOTENT   = se puede ejecutar N veces sin efectos laterales
REPRODUCIBLE = mismo input → mismo resultado
OBSERVABLE   = logs de bootstrap a CloudWatch
```

---

## 14. RDS

Baseline:

```text
PostgreSQL 16
Single-AZ
private
encrypted
20 GB initial
autoscaling storage (hasta 100 GB)
backups automáticos (7–14 días) + PITR
deletion protection = true
```

Separación de usuarios:

```text
MASTER USER      = gestionado por RDS (manage_master_user_password)
APPLICATION USER = rol/usuario de conexión de la app (mínimo privilegio)
MIGRATION USER   = para prisma migrate deploy (privilegios de DDL acotados)
```

Migraciones PROD: **únicamente** `prisma migrate deploy` (job one-shot autorizado). Nunca `prisma migrate dev` ni `prisma db push`.

---

## 15. S3

```text
PROD bucket != QA bucket
Block Public Access = TRUE
Encryption          = TRUE (KMS)
Versioning          = TRUE
Least privilege     = por prefijo
Lifecycle           = versiones no corrientes
Presigned URLs      = corta duración
```

---

## 16. Secrets

Separación:

```text
/afiliaciones/qa/*
/afiliaciones/prod/*
```

| Variable | Tipo | Storage recomendado |
|---|---|---|
| AUTH_SECRET | SECRET | SSM SecureString |
| JWT_SECRET | SECRET | SSM SecureString |
| DATABASE_URL | SECRET | SSM SecureString / Secrets Manager |
| SMTP_PASS | SECRET | SSM SecureString |
| SAP_PASSWORD / APIS token | SECRET | SSM SecureString |
| NIUBIZ PROD merchant/user/pass | SECRET | SSM SecureString |
| AUTH_URL / NEXT_PUBLIC_APP_URL | PUBLIC / SERVER_ONLY | SSM String |
| Endpoints externos (URLs) | SERVER_ONLY | SSM String |

No incluir valores reales.

---

## 17. IAM

```text
EC2_APPLICATION  → s3 (prefijos), ssm:GetParameter (ARNs exactos), ecr pull, logs, (sns:Publish si SMS)
GITHUB_ACTIONS   → OIDC: ecr push + ssm:SendCommand (documento + instancia exacta)
TERRAFORM        → rol de despliegue IaC (scope por environment)
MIGRATION_JOB    → RDS connect + secrets (solo migrate deploy)
OPERATIONS       → ssm:StartSession (Session Manager), sin SSH
```

Prohibido: `Action=*`, `Resource=*`, `AdministratorAccess`. IMDSv2 obligatorio.

---

## 18. CI/CD PROD

```text
PR
 ↓
TypeScript
 ↓
Lint
 ↓
Tests
 ↓
Security
 ↓
Terraform validate/plan
 ↓
Docker build
 ↓
ECR
 ↓
MANUAL PROD APPROVAL
 ↓
Migration
 ↓
Deploy digest
 ↓
Instance Refresh
 ↓
Smoke Tests
 ↓
Monitoring
```

GitHub → AWS mediante OIDC (sin access keys persistentes).

---

## 19. Dominio

```text
PROD_PRIMARY_HOSTNAME = afiliaciones.iimp.org.pe
PROD_URL              = https://afiliaciones.iimp.org.pe

HOSTED_ZONE           = iimp.org.pe (ID: Z2EVMBK8QMV35W, pública, administrada por AWS)

AUTH_URL              = https://afiliaciones.iimp.org.pe
NEXT_PUBLIC_APP_URL   = https://afiliaciones.iimp.org.pe

LEGACY_HOSTNAME       = afiliacion.iimp.org.pe
LEGACY_PROTECTED      = YES
LEGACY_MODIFIED       = NO
CUTOVER_STATUS        = DEFERRED
```

Coexistencia temporal (sin cutover):

```text
afiliacion.iimp.org.pe    → SISTEMA LEGACY (PROTEGIDO, NO tocar)
afiliaciones.iimp.org.pe  → NUEVO SISTEMA PROD
```

El cutover/migración del dominio legacy será una fase futura, separada y con
aprobación humana. No crear todavía `afiliacion-antiguo.iimp.org.pe` ni
`afiliacion-legacy.iimp.org.pe`.

Flujo DNS/TLS (create_dns=true):

```text
Route53 (alias a CloudFront)
 ↓
CloudFront (aliases = afiliaciones.iimp.org.pe, ACM us-east-1)
 ↓
WAF
 ↓
ALB + ACM (us-east-2, listener HTTPS, origin protection x-origin-verify)
```

---

## 20. Costos — obligatorio y detallado

Región: `us-east-2`. Arquitectura: ASG desired=1, EC2 t3.small, RDS Single-AZ, ALB, **NO NAT**, **NO WAF**. On-demand, 24/7. Tasa PEN referencial ~3.7 (no fijada).

| Servicio | Configuración | USD/mes | PEN/mes | Tipo |
|---|---|---:|---:|---|
| ALB | 0.0225/h × 730 | 16.43 | 61 | FIXED |
| ALB LCU | tráfico bajo | 3.00 | 11 | VARIABLE |
| CloudFront | PriceClass 100, tráfico bajo, caché deshabilitada | 3.00 | 11 | VARIABLE |
| AWS WAF | 1 WebACL + reglas gestionadas + rate-based + requests | 7.00 | 26 | FIXED |
| EC2 | t3.small × 2 × 730 h | 30.36 | 112 | VARIABLE |
| Public IPv4 | auto-assign (sin EIP) | 0.00 | 0 | FREE |
| EBS | root gp3 20 GB × 2 | 3.20 | 12 | FIXED |
| RDS instance | db.t4g.micro | 11.68 | 43 | FIXED |
| RDS storage | gp3 20 GB | 2.30 | 9 | FIXED |
| RDS backups | dentro de la asignación (20 GB) | 0.00 | 0 | FREE |
| S3 | ~10 GB | 0.23 | 1 | VARIABLE |
| S3 requests | bajo | 0.10 | 0 | VARIABLE |
| ECR | ~5 GB | 0.50 | 2 | VARIABLE |
| SSM Parameter Store | Standard | 0.00 | 0 | FREE |
| Secrets Manager | 1 secreto (master RDS) | 0.50 | 2 | FIXED |
| CloudWatch logs | ~2 GB ingest, 14 d | 1.50 | 6 | VARIABLE |
| CloudWatch alarms | ~6 alarmas | 0.60 | 2 | FIXED |
| Route53 | zona + consultas | 0.60 | 2 | FIXED |
| ACM | certificado público | 0.00 | 0 | FREE |
| Data Transfer | ~10–20 GB out | 2.50 | 9 | VARIABLE |
| Terraform state S3 | versionado | 0.05 | 0 | NEGLIGIBLE |
| **TOTAL esperado** | | **~84** | **~311** | |

```text
FIXED               = ALB, WAF, EBS, RDS instance+storage, Secrets Manager, alarmas, Route53
VARIABLE            = LCU, CloudFront, EC2, S3, ECR, CloudWatch logs, Data Transfer
FREE_OR_NEGLIGIBLE  = Public IPv4 auto, SSM Standard, ACM, backups dentro de asignación, state S3
EXTERNAL            = Niubiz, WhatsApp, SMTP/SES, SAP, APIS.net.pe, SIE, SNS/SMS
```

---

## 21. Escenarios de costo

### ESCENARIO A — Esperado

```text
20–30 usuarios/día · 1 instancia activa · bajo almacenamiento/logs · caché deshabilitada
```

```text
MONTHLY_USD = ~84
MONTHLY_PEN = ~311
ANNUAL_PEN  = ~3,732
```

### ESCENARIO B — Conservador

```text
150–200 usuarios en pico · más logs · más documentos · db.t3.small · más transfer CloudFront
```

```text
MONTHLY_USD = ~120
MONTHLY_PEN = ~444
ANNUAL_PEN  = ~5,328
```

### ESCENARIO C — HA futura

```text
RDS Multi-AZ (+ standby) · mayor transfer · autoscaling dinámico si se justifica
```

```text
MONTHLY_USD = ~140–160
MONTHLY_PEN = ~518–592
ANNUAL_PEN  = ~6,200–7,100
```

> Estimaciones de planificación, no facturación garantizada.

---

## 22. Costos externos

Separados y clasificados `EXTERNAL_DEPENDENCY` (sin contrato/certificación no son estimables):

```text
Niubiz
WhatsApp
SMTP / SES
SAP
APIS.net.pe
SIE
SNS/SMS
```

---

## 23. Costo de NAT Gateway

```text
CURRENT_BASELINE:
NAT = NO
COST = 0
```

```text
IF_PRIVATE_EC2_REQUIRES_NAT:
ADDITIONAL_MONTHLY_COST = ~USD 33 (NAT Gateway 0.045/h) + data processing
```

Se visualiza por qué no se introduce inicialmente: ~USD 33/mes (~USD 400/año) adicionales sin mejora material de seguridad en el baseline (la EC2 ya no acepta ingreso directo).

---

## 24. Plan por fases

```text
FASE 0  Discovery                    COMPLETED
FASE 1  Application Readiness        PENDING
FASE 2  Terraform Foundation         PENDING
FASE 3  Data Layer                   PENDING
FASE 4  Compute                      PENDING
FASE 5  ALB / ACM / Traffic          PENDING
FASE 6  ASG / Self-Healing           PENDING
FASE 7  Integrations                 PENDING
FASE 8  Security Validation          PENDING
FASE 9  Go-Live Preparation          PENDING
FASE 10 Go-Live                      PENDING
FASE 11 Post-Go-Live                 PENDING
FASE 12 Future HA                    FUTURE
```

### FASE 0 — Discovery
- **Objetivo:** relevar evidencia y fijar baseline (completado).
- **Terraform:** no aplica. **Código:** no aplica. **Recursos AWS:** ninguno.
- **Riesgos:** ninguno (solo lectura). **Pruebas:** —. **Rollback:** —.
- **Costo incremental:** 0. **Criterio de aceptación:** documento maestro aprobado.
- **Checkpoint humano:** aprobación de este documento.

### FASE 1 — Application Readiness
- **Objetivo:** dejar la app lista para ALB/ASG: `TrustedClientIpService`, health checks (`/live`, `/ready`), jobs single-instance, statelessness, logging sin PII, graceful shutdown, readiness Niubiz PROD.
- **Terraform:** no aplica. **Código:** `lib/` (XFF), `app/api/health/*`, `modules/auth/rate-limit/*` (sin cambio, ya es DB), job `synchronize-alerts`.
- **Recursos AWS:** ninguno nuevo.
- **Riesgos:** regresión en login/rate limiters por cambio de XFF. **Pruebas:** unit + smoke local.
- **Rollback:** `git revert` (solo código). **Costo incremental:** 0.
- **Criterio de aceptación:** IP de cliente normalizada y confiable detrás del ALB; job idempotente/single-instance.
- **Checkpoint humano:** revisión de PR + aprobación.

### FASE 2 — Terraform Foundation
- **Objetivo:** state/backend PROD, providers, network, IAM base, SGs.
- **Terraform:** `backend.tf`, `versions.tf`, `providers.tf`, módulo `network`, `iam`.
- **Código:** no aplica. **Recursos AWS:** VPC, subnets, IGW, route tables, SG base, roles IAM.
- **Riesgos:** tocar recursos de QA por error de state. **Pruebas:** `fmt`, `validate`, `plan` (destroy=0).
- **Rollback:** `terraform apply` revertido (destrucción de recursos nuevos).
- **Costo incremental:** ≈ 0–1 USD/mes (SGs/roles son gratuitos; IGW gratis).
- **Criterio de aceptación:** `plan` limpio, QA sin cambios.
- **Checkpoint humano:** aprobación del plan.

### FASE 3 — Data Layer
- **Objetivo:** RDS + S3 + backups + restore test.
- **Terraform:** módulos `rds`, `storage`.
- **Código:** no aplica. **Recursos AWS:** RDS Single-AZ, bucket S3 PROD.
- **Riesgos:** sobredimensionar/ subdimensionar RDS. **Pruebas:** restore PITR en aislado, conectividad.
- **Rollback:** snapshot antes de cambios; `prevent_destroy` en RDS/bucket.
- **Costo incremental:** ≈ 15–16 USD/mes (RDS ~14 + S3 ~0.5).
- **Criterio de aceptación:** restore test documentado OK.
- **Checkpoint humano:** aprobación.

### FASE 4 — Compute
- **Objetivo:** Launch Template, EC2, bootstrap, ECR, SSM.
- **Terraform:** módulo `autoscaling` (launch template), `ecr`, `ssm`, `secrets`.
- **Código:** `user_data` templatefile (bootstrap).
- **Recursos AWS:** Launch Template, ECR repo, SSM params prod, EC2 inicial.
- **Riesgos:** bootstrap no idempotente. **Pruebas:** `fmt/validate/plan`, bootstrap manual en instancia.
- **Rollback:** recrear instancia con template anterior.
- **Costo incremental:** ≈ 17–18 USD/mes (EC2 15.18 + EBS 1.6 + ECR 0.5).
- **Criterio de aceptación:** instancia levanta app y `run` conecta RDS/S3.
- **Checkpoint humano:** aprobación.

### FASE 5 — ALB / ACM / Traffic
- **Objetivo:** ALB, ACM, listeners, target group, health checks, preparación DNS.
- **Terraform:** módulos `alb`, `dns`.
- **Código:** no aplica. **Recursos AWS:** ALB, TG, listener, cert ACM (requiere dominio).
- **Riesgos:** cert pendiente de dominio. **Pruebas:** health checks, redirect HTTP→HTTPS.
- **Rollback:** quitar registro DNS / listener.
- **Costo incremental:** ≈ 19–20 USD/mes (ALB ~16.5 + LCU ~3).
- **Criterio de aceptación:** `/live` y `/ready` 200 vía ALB.
- **Checkpoint humano:** aprobación (bloqueado por dominio).

### FASE 6 — ASG / Self-Healing
- **Objetivo:** ASG desired=1, prueba de reemplazo, medición RTO.
- **Terraform:** `autoscaling_group`.
- **Código:** no aplica. **Recursos AWS:** ASG.
- **Riesgos:** reemplazo no medido. **Pruebas:** self-healing test (sección 27).
- **Rollback:** reducir max/min o quitar ASG.
- **Costo incremental:** ≈ 0 (misma EC2).
- **Criterio de aceptación:** RTO ≤ 6 min medido.
- **Checkpoint humano:** aprobación con evidencia de RTO.

### FASE 7 — Integrations
- **Objetivo:** SMTP, Niubiz PROD, APIS.net.pe, SIE, SAP.
- **Terraform:** no aplica (secretos/endpoints). **Código:** config provider.
- **Recursos AWS:** secretos prod en SSM/Secrets.
- **Riesgos:** `EXTERNAL_DEPENDENCY`. **Pruebas:** integración en modo seguro.
- **Rollback:** revertir a TEST.
- **Costo incremental:** externo (no estimable).
- **Criterio de aceptación:** integraciones verificadas sin transacciones reales.
- **Checkpoint humano:** aprobación por proveedor/negocio.

### FASE 8 — Security Validation
- **Objetivo:** validar IAM, S3, RDS, headers, rate limiting, secrets, logging.
- **Terraform:** `iam`, `security`, `monitoring`.
- **Código:** headers CSP PROD, logging sin PII.
- **Recursos AWS:** alarmas CloudWatch.
- **Riesgos:** hallazgo bloqueante. **Pruebas:** security review, smoke.
- **Rollback:** revertir config. **Costo incremental:** ≈ 2–3 USD/mes (logs/alarmas).
- **Criterio de aceptación:** security review PASS.
- **Checkpoint humano:** aprobación.

### FASE 9 — Go-Live Preparation
- **Objetivo:** migraciones, backup, smoke, rollback, monitoring.
- **Terraform:** no aplica (ops). **Código:** no aplica.
- **Recursos AWS:** ninguno nuevo.
- **Riesgos:** migración incompatible. **Pruebas:** smoke full, rollback.
- **Rollback:** PITR / imagen anterior.
- **Costo incremental:** 0.
- **Criterio de aceptación:** checklist GO/NO-GO completo.
- **Checkpoint humano:** GO/NO-GO.

### FASE 10 — Go-Live
- **Objetivo:** activar tráfico productivo con monitoreo activo.
- **Terraform:** no aplica. **Código:** no aplica. **Recursos AWS:** ninguno nuevo.
- **Riesgos:** incidente de arranque. **Pruebas:** canarios login/consulta.
- **Rollback:** plan de reversión.
- **Costo incremental:** 0.
- **Criterio de aceptación:** tráfico estable.
- **Checkpoint humano:** ventana con responsables.

### FASE 11 — Post-Go-Live
- **Objetivo:** estabilización, tuning, documentar métricas.
- **Terraform:** ajustes. **Código:** fixes. **Recursos AWS:** ajustes.
- **Riesgos:** deuda observada. **Pruebas:** continuas.
- **Rollback:** por caso. **Costo incremental:** variable.
- **Criterio de aceptación:** sin bloqueadores.
- **Checkpoint humano:** por cambio.

### FASE 12 — Future HA
- **Objetivo:** desired=2 (si métricas lo justifican), RDS Multi-AZ, WAF en BLOCK.
- **Terraform:** ASG desired, RDS multi_az, WAF. **Código:** no aplica.
- **Recursos AWS:** +1 EC2, standby RDS, WAF.
- **Riesgos:** costo. **Pruebas:** failover AZ, RDS failover.
- **Rollback:** revertir desired/multi_az.
- **Costo incremental:** ≈ +60–80 USD/mes.
- **Criterio de aceptación:** failover medido.
- **Checkpoint humano:** justificación por métricas.

---

## 25. Matriz de costo incremental por fase

| Fase | Recursos nuevos | Incremento USD/mes | Incremento PEN/mes |
|---|---:|---:|---:|
| 0 Discovery | — | 0 | 0 |
| 1 App Readiness | — | 0 | 0 |
| 2 Terraform Foundation | VPC/SG/IAM | ~1 | ~4 |
| 3 Data Layer | RDS + S3 | ~16 | ~59 |
| 4 Compute | EC2 + ECR + SSM | ~18 | ~67 |
| 5 ALB/ACM/Traffic | ALB + ACM | ~20 | ~74 |
| 6 ASG/Self-Healing | ASG | 0 | 0 |
| 7 Integrations | secrets | externo | externo |
| 8 Security Validation | alarmas/logs | ~3 | ~11 |
| 9–11 Go-Live | — | 0 | 0 |
| 12 Future HA | +EC2, Multi-AZ, WAF | +60–80 | +222–296 |

> Costo acumulado al final de FASE 8 (baseline completo): ~USD 57/mes.

---

## 26. Pruebas

```text
Terraform fmt / validate / plan

Docker build / run
/live = 200
/ready = 200

RDS connectivity
S3 (presigned)
Secrets (SSM read)
IAM (least privilege)

ALB health
ASG replacement

PITR restore

Niubiz (modo seguro)
SMTP

Security smoke
Application smoke
```

---

## 27. Self-healing test

```text
EC2-A HEALTHY
 ↓
terminate (intencional)
 ↓
T0
 ↓
ASG replacement
 ↓
bootstrap
 ↓
Docker
 ↓
Next.js
 ↓
/ready
 ↓
ALB HEALTHY
 ↓
T1
```

```text
RECOVERY_TIME = T1 - T0
PASS    <= 6 min
WARNING = 6–8 min
FAIL    > 8 min
```

---

## 28. Rollback

```text
APPLICATION_ROLLBACK    = redeploy imagen anterior por digest (SSM / instance refresh reverso)
INFRASTRUCTURE_ROLLBACK = terraform apply revertido (autorizado)
DATABASE_ROLLBACK       = PITR / snapshot (NO git revert)
CONFIGURATION_ROLLBACK  = versión previa de SSM/Secrets
DNS_ROLLBACK            = devolver alias al endpoint anterior
```

---

## 29. Go-live checklist

```text
[ ] Terraform plan revisado (destroy=0)
[ ] QA sin cambios
[ ] PROD state separado
[ ] RDS privado
[ ] S3 privado
[ ] IAM least privilege
[ ] Secrets separados prod/qa
[ ] HTTPS + ACM
[ ] DNS apuntando al ALB
[ ] ALB healthy
[ ] Self-healing <= 6 min (medido)
[ ] PITR probado
[ ] Niubiz PROD validado (sin transacciones reales)
[ ] SMTP validado
[ ] Migraciones validadas (migrate deploy)
[ ] Rollback probado
[ ] CloudWatch + alarmas
[ ] Security review PASS
[ ] Smoke tests (login, consulta, postulación)
[ ] Aprobación humana
```

---

## 30. Riesgos aceptados

| Riesgo | Motivo de aceptación | Mitigación | Trigger de evolución |
|---|---|---|---|
| RDS Single-AZ | Costo; RPO/RTO de base asumido | Backups + PITR + restore test | Contrato de continuidad o incidente |
| Reglas WAF gestionadas en COUNT inicial | Evitar falsos positivos antes de BLOCK | Monitorear métricas WAF y promover a BLOCK | Volumen de ataques bloqueables |
| No NAT inicial | EC2 en subredes públicas endurecidas | SG solo acepta ALB; SSM sin SSH | Requisito de postura privada |
| Caché CloudFront deshabilitada | App dinámica autenticada | Servir assets por CloudFront solo si se valida | Métricas de latencia/transfer |

---

## 31. Evolución futura

```text
CURRENT:
CloudFront + WAF → ALB → ASG desired=1 (self-healing) → RDS Single-AZ
```

Evolución:

```text
RDS Multi-AZ → autoscaling dinámico (CPU) → caché CloudFront selectiva
```

Disparadores: crecimiento sostenido de tráfico, requisito de continuidad ante pérdida de AZ, incidente de seguridad, o contrato de SLA.

---

## 32. Puntos pendientes

```text
DOMAIN_PROD (RESUELTO: afiliaciones.iimp.org.pe; cutover legacy DEFERRED)
Niubiz PROD contract/config
real concurrency/RPS
PII retention policy
SMTP vs SES
ISR/cache strategy
TrustedClientIpService design
synchronize-alerts execution model
official AWS cost validation
```

No inventar respuestas para estos puntos.

---

## 33. Estado del documento

```text
DOCUMENT = docs/ARQUITECTURA_PRODUCCION.md

ARCHITECTURE_STATUS = APPROVED_BASELINE_WITH_PENDING_VALIDATIONS

PHASE_0 = COMPLETED
PHASE_1 = NOT_STARTED

TERRAFORM_IMPLEMENTATION = NOT_STARTED
AWS_PROD = NOT_CREATED

NEXT_ACTION =
Complete pending design validations and request human approval for FASE 1.
```
