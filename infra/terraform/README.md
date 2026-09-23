# Infraestructura Terraform — Afiliaciones IIMP

> Estado: **diseño**. No se ha ejecutado `apply`. No hay backend remoto configurado.
> No se administra ningún recurso legacy.

## Entorno QA — Ultra-Lean (vigente)

QA es un entorno **aislado, económico y de un solo nodo**, dimensionado para
20–30 usuarios/día. NO replica producción.

```
Internet → Elastic IP → EC2 t3.small (Caddy + Docker: Next.js/Chromium + PostgreSQL local)
Servicios: S3 (documentos+backups) · ECR · SSM Parameter Store · CloudWatch 7d · IAM Instance Role
Administración: SSM Session Manager (sin SSH) · EventBridge Scheduler (L-V 08:00-20:00 America/Lima)
```

- **Sin** ALB, ECS, Fargate, NAT Gateway, RDS ni Secrets Manager.
- Security Group: solo **80/443** público; sin 22/3000/5432.
- PostgreSQL local en contenedor (red interna Docker), datos en EBS `/data`; `pg_dump` diario a S3.
- HTTPS con **Caddy + Let's Encrypt** (no ACM).
- Secretos en **SSM Parameter Store SecureString** (valores cargados fuera de Terraform).

Módulos usados por QA: `network` (VPC + 1 subred pública), `ec2`, `ssm`, `storage`,
`ecr`, `observability`, `scheduler`.

Módulos conservados para una futura arquitectura productiva (NO usados por QA):
`alb`, `ecs`, `rds`, `iam` (ECS), `secrets` (Secrets Manager), `security` (ALB/ECS/RDS).

### Validación local

```bash
terraform fmt -recursive
terraform init -backend=false -lockfile=readonly
terraform validate
terraform plan   # read-only; sin apply
```

### Primer despliegue

1. Aprobar arquitectura y presupuesto.
2. Bootstrap del backend de state (fase posterior).
3. `terraform apply` **con autorización explícita**.
4. Cargar parámetros SecureString en SSM (fuera de Terraform).
5. Publicar imágenes en ECR.
6. Desplegar `docker-compose` (Caddy + app + postgres) en `/opt/afiliaciones-qa`.
7. Validar HTTPS, health endpoints, Chromium, backups.
8. Probar STOP/START manual.
9. Recién entonces `enable_scheduler = true`.

### Estado remoto (backend) — NOT_CONFIGURED_YET

Antes del primer `apply`: bucket S3 (versionado, cifrado KMS, PAB), locking nativo
(`use_lockfile`), IAM de acceso, bootstrap separado. Sin secretos en el state.

### Migraciones Prisma

Imagen de migración separada (con Prisma CLI) ejecutada como one-shot; nunca al arrancar la app.
