# QA First Deployment Report — Afiliaciones IIMP

> **Fecha:** 2026-09-21 · **Región:** us-east-2 · **Cuenta:** `5649********7461` (masked)
> **URL QA:** https://afiliaciones-qa.iimp.org.pe
> **Estado:** desplegado y validado (Chromium resuelto con perfil seccomp mínimo; ver
> `qa-chromium-seccomp-profile.md`). Scheduler L-V 08:00–20:00 America/Lima activo.

---

## 1. Executive Summary

Se creó el entorno QA Ultra-Lean en AWS (35 recursos Terraform), se publicaron las imágenes
en ECR, se desplegó el stack (Caddy + Next.js + PostgreSQL) y se validó HTTPS, health checks,
migraciones y backup. **El sandbox de Chromium no funciona dentro del contenedor** (limitación
de Docker/seccomp y ausencia del helper setuid por un bug de nombre en el Dockerfile). No se
aplicó `--no-sandbox` ni otras reducciones de seguridad. La generación de PDF queda **bloqueada**
hasta una decisión técnica. El scheduler permanece **deshabilitado**.

## 2. AWS Account / Region

- Cuenta: `5649********7461` (masked) · Región: `us-east-2` · Principal: IAM user (masked).

## 3. Terraform Apply Summary

- Backend: S3 `iimp-afiliaciones-terraform-state-564914947461`, key `afiliaciones/qa/terraform.tfstate`, `use_lockfile=true`.
- `apply` sobre plan guardado: **35 added, 0 changed, 0 destroyed**.
- Sin ALB/ECS/RDS/NAT.

## 4. Resources Created

- EC2 `i-095d15242588ec268` (t3.small, AL2023, x86_64).
- EBS datos `vol-0e3662623be3dcf12` (30 GB gp3, cifrado).
- EIP `3.129.231.111`.
- VPC `vpc-0ce41db69d383e896`, subred pública, IGW, route table.
- SG `sg-0e12b78dad457272e` (80/443).
- IAM role/profile `afiliaciones-qa-ec2-role` + policy.
- S3 `afiliaciones-qa-docs-20260921034748577100000001`.
- ECR `564914947461.dkr.ecr.us-east-2.amazonaws.com/afiliaciones-qa-app`.
- CloudWatch log group `/ecs/afiliaciones-qa-app` (7 d).
- SSM: 7 parámetros String + 5 SecureString (QA).

## 5. Final Architecture

Internet → EIP → EC2 (Caddy + Docker: Next.js/Chromium + PostgreSQL) + S3/ECR/SSM/CloudWatch.

## 6. EC2 Details

t3.small · AL2023 · IMDSv2 required · IAM instance profile · `associate_public_ip=false` + EIP.

## 7. Network

VPC `10.20.0.0/16`, subred `10.20.0.0/24`, IGW, route table. Sin NAT/endpoints.

## 8. Security Group

Ingress 80/443 (0.0.0.0/0). **Sin** 22/3000/5432/3389. Egress amplio (documentado).

## 9. EBS

Raíz 20 GB gp3 + datos 30 GB gp3, ambos cifrados. `/data` montado (ext4) con persistencia.

## 10. EIP

`3.129.231.111` asociada a la instancia.

## 11. IAM

Instance Role con SSM Core + S3 (afiliaciones/*, backups/*) + SSM params + CloudWatch Logs + ECR pull.

## 12. SSM

`/afiliaciones/qa/`: String (AUTH_URL, NEXT_PUBLIC_APP_URL, AWS_DEFAULT_REGION, PAYMENT_*);
SecureString (auth-secret, payment-auth-secret, jwt-secret, database-url, db-password).

## 13. ECR

Imágenes `ea5e3b1-web` (1.24 GB) y `ea5e3b1-migration` (400 MB) publicadas.

## 14. Docker

`docker compose` con `caddy:2.8`, `postgres:16`, app ECR. Redes `afiliaciones-qa_edge` y `afiliaciones-qa_data`.

## 15. PostgreSQL

PostgreSQL 16 local, datos en `/data/postgres`, red interna, **no público**.

## 16. Migrations

`prisma migrate deploy` (imagen de migración) sobre PostgreSQL QA → **26 migraciones**, tablas creadas.

## 17. Caddy

HTTPS automático (Let's Encrypt) para `afiliaciones-qa.iimp.org.pe`, proxy a `app:3000`, HTTP→HTTPS.

## 18. DNS

`afiliaciones-qa.iimp.org.pe` (A, TTL 300) → `3.129.231.111`. Sin tocar `afiliacion.iimp.org.pe`.

## 19. HTTPS

Certificado Let's Encrypt válido (`ssl_verify_result=0`). Redirección HTTP→HTTPS.

## 20. Health Checks

- `/api/health/live` → **HTTP 200**.
- `/api/health/ready` → **HTTP 200** (`{"status":"ready"}`).

## 21. Chromium Test

- **RESUELTO** (FASE 3D-6.2): perfil seccomp mínimo (Docker default + `unshare`/`clone`) aplicado
  solo al contenedor `app`; `shm_size=512mb`.
- 1 PDF, 2 concurrentes, 3 secuenciales y PDF tipo Declaration → **PASS**.
- `--no-sandbox` en cmdline: **NO**. Zombies: 0. Sandbox de Chromium: **habilitado**.
- Detalle en `qa-chromium-seccomp-profile.md`.

## 22. Memory Test

- `free -m`: total 1909 MB, used 509, available 1194, swap 0.
- Docker stats: app 163 MiB, postgres 72 MiB, caddy 21 MiB.
- `T3_SMALL` = adecuado para web/DB; el PDF no pudo medirse (bloqueado).

## 23. Backup

`pg_dump` → gzip → S3 `backups/qa/2026/09/21/qa-db.sql.gz` (17,587 bytes, SSE AES256). **PASS**.

## 24. Restore

No ejecutado (pendiente; requiere decisión de procedimiento y no se corrompió la DB principal).
`BACKUP_RESTORE_VALIDATED=NO`.

## 25. CloudWatch

Log group creado (7 d). No se cargaron logs de la app (el stack escribe en `docker logs`;
integración del CloudWatch Agent pendiente).

## 26. STOP/START Test

**NO ejecutado** (el flujo lo condiciona a Chromium OK, que está bloqueado).

## 27. Scheduler

`enable_scheduler=false` (sin activar).

## 28. Cost Estimate

- 24x7 ≈ USD 24/mes; horario L-V 08:00–20:00 ≈ USD 14/mes (referencial).

## 29. Security Validation

SSH público NO · PostgreSQL público NO · app:3000 público NO · 80/443 únicamente · IMDSv2 SÍ ·
EBS cifrado SÍ · S3 privado SÍ · IAM mínimo SÍ · secretos fuera de Git/imagen/state SÍ.

## 30. Legacy Protection

`LEGACY_CHANGES=0` · `PRODUCTION_CHANGES=0`. `afiliacion.iimp.org.pe` intacto.

## 31. Remaining Risks

- **Chromium sandbox bloqueado** (decisión requerida).
- Restore no validado.
- STOP/START no validado.
- CloudWatch Agent no integrado.
- Dockerfile corregido (nombre del helper) pero imagen no reconstruida.

## 32. QA Access URL

https://afiliaciones-qa.iimp.org.pe (HTTPS válido; health 200).

## 33. Next Steps

1. Decidir estrategia de sandbox de Chromium (ver bloqueantes).
2. Reconstruir y republicar la imagen con el helper corregido.
3. Validar restore y STOP/START.
4. Integrar CloudWatch Agent.
5. Activar el scheduler solo tras STOP/START exitoso.
