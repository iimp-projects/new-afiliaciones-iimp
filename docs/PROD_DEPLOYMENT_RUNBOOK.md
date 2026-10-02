# RUNBOOK — PRIMER DESPLIEGUE PROD AFILIACIONES IIMP

> Procedimiento operativo real y numerado para el primer provisioning de AWS PROD.
> Estado: `DRAFT_APPROVED_PENDING_EXECUTION`. No ejecutar sin aprobación humana de cada fase mutante.
> Última actualización: 02 de octubre de 2026.

## Contexto congelado

```text
ACCOUNT_ID        = 564914947461
REGION            = us-east-2  (CloudFront/WAF/ACM global: us-east-1)
BACKEND_KEY       = afiliaciones/prod/terraform.tfstate
PROD_HOSTNAME     = afiliaciones.iimp.org.pe
LEGACY_HOSTNAME   = afiliacion.iimp.org.pe   (PROTECTED, NO tocar)
HOSTED_ZONE_ID    = Z2EVMBK8QMV35W
ECR_REPOSITORY    = afiliaciones-prod-app
ECR_URI           = 564914947461.dkr.ecr.us-east-2.amazonaws.com/afiliaciones-prod-app
RDS_DB_NAME       = afiliaciones
RDS_MASTER_USER   = afiliaciones_admin
RDS_PORT          = 5432
ASG_SIZING        = min 1 / desired 1 / max 1 (1 EC2 activa, self-healing)
PLAN (create_dns) = 69 add / 0 change / 0 destroy / 0 replace
```

## Estrategia de bootstrap (aprobada)

**Opción A — apply completo (69 recursos) + bootstrap runtime post-apply.**

No se usa `-target` como mecanismo normal. El apply crea ECR, RDS, SSM (no secretos),
ALB, CloudFront, WAF, ASG/Launch Template y DNS/ACM en un solo paso. La EC2 quedará
`unhealthy` en el intervalo (imagen `pending` + SSM sin secretos) — estado esperado e
inocuo, porque todavía no hay tráfico y el go-live está gated por DNS + validación.

---

## PHASE 0 — Preflight (read-only)

- **PURPOSE:** confirmar identidad, backend y plan congelado.
- **PREREQUISITES:** repo limpio de secretos; commit `c3a7127`.
- **COMMANDS:**
  ```bash
  aws sts get-caller-identity   # esperar Account 564914947461
  terraform fmt -check -recursive
  terraform validate
  terraform plan -out=prod.tfplan   # esperar 69/0/0/0
  ```
- **EXPECTED_RESULT:** identidad correcta, plan 69/0/0/0.
- **VALIDATION:** `PLAN_DESTROY=0`, `PLAN_REPLACE=0`, QA/legacy/other = 0.
- **STOP_CONDITION:** account != 564914947461, o destroy/replace > 0.
- **ROLLBACK:** N/A (read-only).
- **AWS_MUTATION:** NO · **HUMAN_APPROVAL_REQUIRED:** NO (solo lectura).

## PHASE 1 — Infrastructure apply (69 recursos)

- **PURPOSE:** crear toda la infraestructura PROD (incluye ECR, RDS, DNS/ACM).
- **PREREQUISITES:** PHASE 0 OK; `TF_VAR_origin_protect_header_value` (>=32, alta entropía) disponible vía entorno.
- **COMMANDS:**
  ```bash
  TF_VAR_origin_protect_header_value="<secreto>" terraform apply prod.tfplan
  ```
- **EXPECTED_RESULT:** 69 recursos creados; ACM validado (DNS); EC2 lanzada pero `unhealthy`.
- **VALIDATION:** `terraform state list`; ALB/CloudFront/RDS visibles; `PLAN_DESTROY` previo = 0.
- **STOP_CONDITION:** error de apply, o drift que requiera destruir/reemplazar algo.
- **ROLLBACK:** no destructivo por defecto; revisar error antes de re-aplicar.
- **AWS_MUTATION:** YES · **HUMAN_APPROVAL_REQUIRED:** YES.

## PHASE 2 — Build + push imagen Docker

- **PURPOSE:** publicar la imagen exacta del código congelado.
- **PREREQUISITES:** PHASE 1 (ECR existente).
- **COMMANDS:**
  ```bash
  docker build -t afiliaciones-prod-app:prod-c3a7127 .
  aws ecr get-login-password --region us-east-2 | docker login --username AWS --password-stdin 564914947461.dkr.ecr.us-east-2.amazonaws.com
  docker tag afiliaciones-prod-app:prod-c3a7127 564914947461.dkr.ecr.us-east-2.amazonaws.com/afiliaciones-prod-app:prod-c3a7127
  docker push 564914947461.dkr.ecr.us-east-2.amazonaws.com/afiliaciones-prod-app:prod-c3a7127
  ```
- **EXPECTED_RESULT:** imagen inmutable `prod-c3a7127` en ECR.
- **VALIDATION:** `aws ecr describe-images --repository-name afiliaciones-prod-app --image-ids imageTag=prod-c3a7127`.
- **STOP_CONDITION:** push fallido (NO usar `latest`).
- **ROLLBACK:** eliminar el tag recién publicado.
- **AWS_MUTATION:** YES · **HUMAN_APPROVAL_REQUIRED:** YES.

## PHASE 3 — Poblar SSM (config + secretos)

- **PURPOSE:** dejar `/afiliaciones/prod/*` completo para el bootstrap EC2.
- **PREREQUISITES:** PHASE 1 (namespace SSM); valores reales autorizados.
- **COMMANDS:** cargar (fuera de Terraform, sin imprimir valores):
  - SecureString: `auth-secret`, `payment-auth-secret`, `jwt-secret`, `database-url`, `smtp-pass`,
    `sap-password`, `apis-net-pe-token`, `whatsapp-access-token`, `associates-api-password`,
    `niubiz-prod-username`, `niubiz-prod-password`.
  - `database-url` = cadena de conexión PostgreSQL compuesta por: endpoint RDS + usuario maestro
    + password (recuperado de Secrets Manager `rds_master_secret_arn`) + puerto 5432 + database `afiliaciones`.
    No escribir la URL literal ni imprimir credenciales.
  - String (no secretos, ya creados por Terraform con create_dns=true): `AUTH_URL`, `NEXT_PUBLIC_APP_URL`.
- **EXPECTED_RESULT:** 11 SecureString + 2 String presentes; EC2 solo puede LEERLOS.
- **VALIDATION:** `aws ssm get-parameters-by-path --path /afiliaciones/prod --recursive` (solo nombres).
- **STOP_CONDITION:** cualquier valor hardcodeado en repo.
- **ROLLBACK:** reemplazar valores; no se rompe infra.
- **AWS_MUTATION:** YES · **HUMAN_APPROVAL_REQUIRED:** YES.

## PHASE 4 — Database: migraciones

- **PURPOSE:** crear esquema en RDS PROD vacío.
- **PREREQUISITES:** PHASE 1 (RDS); `database-url` en SSM; `DATABASE_URL` disponible para el runner.
- **COMMANDS:**
  ```bash
  npx prisma migrate deploy   # 34 migraciones; NUNCA migrate dev ni db push
  ```
- **EXPECTED_RESULT:** 34 migraciones aplicadas sobre DB vacía.
- **VALIDATION:** `npx prisma migrate status`.
- **STOP_CONDITION:** migración fallida → snapshot antes de reintentar.
- **ROLLBACK:** restore RDS point-in-time (no revert destructivo automático).
- **AWS_MUTATION:** YES · **HUMAN_APPROVAL_REQUIRED:** YES.

## PHASE 5 — Database: seeds

- **PURPOSE:** cargar datos de referencia (catálogos, roles, permisos, system settings).
- **PREREQUISITES:** PHASE 4.
- **COMMANDS:**
  ```bash
  NODE_ENV=production npx tsx prisma/seed.ts   # omite datos demo en producción
  ```
- **EXPECTED_RESULT:** catálogos/roles/permisos poblados.
- **VALIDATION:** conteo de registros clave (roles, países, universidades).
- **STOP_CONDITION:** seed fallido.
- **ROLLBACK:** re-ejecutar seed (idempotente).
- **AWS_MUTATION:** YES · **HUMAN_APPROVAL_REQUIRED:** YES.

## PHASE 6 — Runtime activation (imagen + refresh)

- **PURPOSE:** apuntar el Launch Template a la imagen real y refrescar instancias.
- **PREREQUISITES:** PHASE 2–5 completadas.
- **COMMANDS:**
  ```bash
  # fijar app_image_tag = prod-c3a7127 (variables.tf default / terraform.tfvars)
  terraform apply   # nueva versión del Launch Template
  aws autoscaling start-instance-refresh --auto-scaling-group-name afiliaciones-prod-asg
  ```
- **EXPECTED_RESULT:** EC2 re-bootstrappean → SSM → ECR pull → app arranca → ALB healthy.
- **VALIDATION:** `/api/health/live` y `/api/health/ready` = 200; ALB target healthy.
- **STOP_CONDITION:** bootstrap falla (logs `/var/log/afiliaciones-prod-bootstrap.log`).
- **ROLLBACK:** fijar tag anterior y refrescar.
- **AWS_MUTATION:** YES · **HUMAN_APPROVAL_REQUIRED:** YES.

## PHASE 7 — Health / functional validation

- **PURPOSE:** smoke tests sin transacciones reales (login, consulta, postulación).
- **PREREQUISITES:** PHASE 6.
- **COMMANDS:** curl a `https://afiliaciones.iimp.org.pe/api/health/ready`, `/login`, `/consulta`.
- **EXPECTED_RESULT:** respuestas 200; HTTPS activo; legacy intacto.
- **VALIDATION:** smoke documentado.
- **STOP_CONDITION:** cualquier 5xx persistente.
- **ROLLBACK:** legacy sigue operativo (no hay cutover).
- **AWS_MUTATION:** NO · **HUMAN_APPROVAL_REQUIRED:** NO.

## PHASE 8 — WAF observación (COUNT → BLOCK)

- **PURPOSE:** observar falsos positivos de CommonRuleSet antes de promover a BLOCK.
- **PREREQUISITES:** PHASE 7 + tráfico.
- **COMMANDS:** monitorear métricas WAF (COUNT) durante un periodo acordado.
- **EXPECTED_RESULT:** línea base de falsos positivos.
- **VALIDATION:** métricas WAF.
- **STOP_CONDITION:** falsos positivos altos.
- **ROLLBACK:** revertir regla a COUNT.
- **AWS_MUTATION:** NO (observación) → YES al cambiar COUNT→BLOCK · **HUMAN_APPROVAL_REQUIRED:** YES para BLOCK.

## PHASE 9 — Go-live approval

- **PURPOSE:** aprobación humana final de go-live público.
- **PREREQUISITES:** PHASE 7 OK; noindex verificado; WAF observado.
- **COMMANDS:** checklist GO/NO-GO.
- **EXPECTED_RESULT:** tráfico productivo con monitoreo activo.
- **VALIDATION:** checklist completo.
- **STOP_CONDITION:** bloqueante.
- **ROLLBACK:** legacy sigue disponible.
- **AWS_MUTATION:** NO · **HUMAN_APPROVAL_REQUIRED:** YES.

---

## Resumen de mutaciones

```text
FIRST_MUTATING_PHASE   = PHASE 1 (terraform apply del plan 69/0/0/0)
FIRST_MUTATING_COMMAND = TF_VAR_origin_protect_header_value="<secreto>" terraform apply prod.tfplan
                         (NO ejecutar sin aprobación humana)
```

## Post-go-live (diferido, fases separadas)

```text
IAM hardening (MFA, rol dedicado, STS, GitHub OIDC, retiro de AdministratorAccess)
ALB/CloudFront/WAF logging, CloudWatch Agent para logs de contenedor
CUTOVER del dominio legacy (afiliacion.iimp.org.pe → afiliaciones.iimp.org.pe), con aprobación humana
```
