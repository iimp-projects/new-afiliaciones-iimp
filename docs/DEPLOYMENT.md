# Despliegue y preflight

La plataforma de hosting, CI/CD y estrategia de rollback no están documentadas como contrato definitivo. Este archivo define comprobaciones independientes de proveedor.

## Preflight obligatorio

```bash
npm ci
npx prisma generate
npm run check
npm run build
```

Además:

- variables del ambiente presentes y separadas por TEST/PRODUCTION;
- base objetivo y permisos confirmados;
- migraciones revisadas y aprobadas por separado;
- secretos administrados por el sistema de despliegue;
- proveedores externos en el ambiente correcto;
- plan de rollback de aplicación y de datos;
- observabilidad sin PII ni secretos.

## Base de datos

El despliegue de aplicación y el de schema son decisiones separadas. No ejecutes `db push` en producción. Una migración requiere:

1. diff revisado;
2. compatibilidad hacia atrás durante el rollout;
3. respaldo/verificación;
4. ventana y responsable;
5. rollback o estrategia roll-forward;
6. `prisma migrate deploy` solo en el proceso autorizado.

## Verificación posterior

- health y carga de rutas públicas;
- login y control de acceso con cuentas de prueba;
- consulta/postulación sin enviar mensajes reales salvo plan de smoke test;
- conexión a PostgreSQL;
- errores y latencia;
- ningún secreto en HTML, bundles o logs.

Pagos, SAP, S3/SNS, correo y WhatsApp requieren checklist propio y credenciales de prueba. No actives Niubiz producción basándote únicamente en que el build sea verde.

## Procedimiento de release incremental (QA → PROD)

> Vigente desde AFILIACIONES-RELEASE-AUDIT-01 (2026-10-26). El primer provisioning
> documentado en `PROD_DEPLOYMENT_RUNBOOK.md` queda como histórico (ver allí). Este
> procedimiento aplica a releases posteriores, promoviendo el **mismo artefacto inmutable
> (imagen ECR)** entre ambientes.

### R1 — Verificación del commit realmente desplegado

```bash
# PROD: leer la imagen del Launch Template (UserData IMAGE=...)
aws ec2 describe-launch-template-versions \
  --region us-east-2 \
  --launch-template-name afiliaciones-prod-lt-20261002165621212700000001 \
  --query 'LaunchTemplateVersions[0].LaunchTemplateData.UserData' --output text | base64 -d | grep '^IMAGE='

# QA: imagen vigente vía SSM/ECR (tag qa-<sha>-<run>-<attempt>)
aws ecr describe-images --region us-east-2 --repository-name afiliaciones-qa-app \
  --query 'imageDetails[?contains(join(",",imageTags),"qa-")].[imageTags,imageDigest]'
```

- Confirmar SHA del commit objetivo y su digest ECR. No asumir que `master`/`development`
  es el código desplegado: usar el artefacto y el registro de deployment.

### R2 — Comparación exacta de cambios

```bash
git fetch origin
git diff --stat origin/master...<rama-candidata>
git diff --name-status origin/master...<rama-candidata> -- prisma/ infra/ .github/
```

- Revisar `prisma/schema.prisma` y `prisma/migrations/` (nunca revertir el enum
  `EmailSmtpAccount` ni la migración `20261023000000`).
- Revisar `infra/terraform/` (sin drift destructivo) y `package.json`/`package-lock.json`
  (no revertir `next 16.4.3`, `zod 4.6.7`, `puppeteer 25.16.0`, `follow-redirects 1.16.1`).
- Tratar commits con SHA distinto por **patch-id**: `git cherry origin/master <rama>`.

### R3 — Seguridad, tests y build

```bash
npm ci
npx prisma generate
npm run security:secrets     # blocking
npm run security:runtime     # blocking (CRITICAL/HIGH)
npm run check                # typecheck + eslint + vitest
npm run build
```

- `terraform fmt -check -recursive` y `terraform validate` (QA y PROD).
- Verificar que el cambio no introduce migraciones nuevas sin decisión explícita.

### R4 — Construcción y publicación ECR

- **QA:** `workflow_dispatch` `qa-deploy.yml` (`confirm_deploy=true`) → imagen inmutable
  `qa-<sha>-<run>-<attempt>` en `afiliaciones-qa-app` + deploy SSM a la instancia QA.
- **PROD:** `workflow_dispatch` `prod-deploy.yml` con `build_publish=true` y
  `deploy=false` → imagen inmutable `prod-<sha>` en `afiliaciones-prod-app`.
  Verificar digest en ECR (`describe-images`) contra el digest del build.

### R5 — Revisión Terraform (solo imagen, sin destroy/replace)

```bash
cd infra/terraform/environments/prod
TF_VAR_app_image_tag=prod-<sha> terraform plan -refresh=false -out=prod.tfplan -detailed-exitcode
terraform show -no-color prod.tfplan   # verificar: sin "will be destroyed"/"must be replaced"; solo aws_launch_template
```

### R6 — Blue/green con ASG

```bash
aws autoscaling update-auto-scaling-group --auto-scaling-group-name afiliaciones-prod-asg --max-size 2
terraform apply prod.tfplan
aws autoscaling start-instance-refresh \
  --auto-scaling-group-name afiliaciones-prod-asg \
  --preferences '{"MinHealthyPercentage":100,"MaxHealthyPercentage":200,"InstanceWarmup":60}'
# esperar estado Successful
aws autoscaling update-auto-scaling-group --auto-scaling-group-name afiliaciones-prod-asg --max-size 1
```

### R7 — Rollback

- **QA:** re-dispatch de un run anterior (imagen `qa-<sha>-<run>` previa); el deploy SSM es idempotente por tag.
- **PROD:** re-apuntar `app_image_tag` al tag anterior y `start-instance-refresh`:
  `TF_VAR_app_image_tag=prod-ba591b49... terraform apply` + refresh. No destruir infraestructura.

### R8 — Verificación funcional

- `GET /api/health/live` y `/api/health/ready` → 200.
- Smoke: `/login`, `/consulta`, postulación sin envíos reales.
- Pagos (Niubiz), correo (SMTP DEFAULT/PROV), SIE/auth, carnet (emisión OFF): checklist propio con credenciales de prueba.

### R9 — Registro de SHA, digest y workflow run

- Anotar en el PR/issue de release: SHA desplegado, tag de imagen, digest ECR, `workflow run id`, entorno, fecha y responsable.
- Actualizar `AUTHORIZED_COMMIT_SHA` en `prod-deploy.yml` solo a través de un commit en `master` (release gate).
