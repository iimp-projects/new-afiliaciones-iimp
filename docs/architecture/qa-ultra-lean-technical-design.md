# Ultra-Lean QA — Diseño Técnico — Afiliaciones IIMP

> **Fecha:** 2026-09-20 · **Región:** us-east-2 · **Moneda:** USD · **PEN:** referencial (TC 3.70)
> **Método:** diseño + benchmark local + AWS Pricing API (read-only). Sin mutaciones AWS.
> **Precios verificados (us-east-2, 2026-09-20):** EC2 t3.small $0.0208/h, t3.medium $0.0416/h,
> EBS gp3 $0.08/GB-mo, IPv4 $0.005/h, S3 ~$0.023/GB-mo, ECR $0.10/GB-mo, CloudWatch $0.50/GB.

---

# Resumen para supervisor

**Usuarios esperados:** 20–30/día, concurrencia 1–3, PDFs ocasionales.

**Arquitectura propuesta (Ultra-Lean QA):** una sola instancia **EC2 t3.small** con Docker que
ejecuta **Caddy** (HTTPS automático), **Next.js + Chromium** y **PostgreSQL QA local**;
almacenamiento **EBS**; **S3** privado (documentos + backups); **ECR**; **SSM Parameter Store**
(secretos) y **SSM Session Manager** (administración sin SSH); **CloudWatch** 7 días; **IAM
Instance Role**. **Sin ALB, sin NAT, sin ECS, sin RDS.**

**Seguridad:** HTTPS (Let's Encrypt), base de datos no pública, secretos fuera del repositorio,
IAM de mínimo privilegio, S3 privado, sin SSH público, Security Group solo 443 (y 80 para el
desafío ACME). Se acepta un punto único de fallo por tratarse de QA.

**Costo estimado:** **≈ USD 24/mes 24x7** · **≈ USD 13/mes en horario laboral**.
**Ahorro:** ≈ **USD 95–109/mes** frente al diseño 24x7 (USD 119–133) y ≈ **USD 62/mes** frente
al office-hours anterior (USD 75).

**Limitaciones:** sin alta disponibilidad, mantenimiento manual, menor paridad con producción.
**No** se usa base de datos productiva ni datos reales.

**Recomendación:** aprobar el rediseño Terraform Ultra-Lean (fase 3D-5.6).

---

## 1. Executive Summary

Se validó técnicamente la arquitectura Ultra-Lean para QA. El benchmark local demuestra que
**2 GB de RAM son suficientes** para la aplicación + Chromium + PostgreSQL + Caddy (peak medido
~359–512 MiB en generación de PDF, 1–2 concurrentes). La arquitectura conserva los controles de
seguridad esenciales y reduce el costo ~80 % frente al diseño 24x7.

## 2. Workload

| Variable | Valor |
|---|---|
| Usuarios/día | 20–30 |
| Concurrencia | 1–3 |
| PDFs | Ocasionales (1–2 concurrentes) |
| HA / SLA | No requerido |
| Autoscaling | No |
| Horario | L-V 08:00–18:00 America/Lima (~217 h/mes) |

## 3. Proposed Ultra-Lean Architecture

```
Internet
   │ HTTPS (443)
   ▼
EC2 QA (t3.small, x86_64)
├── Caddy (TLS Let's Encrypt, reverse proxy → app:3000)
├── Docker
│   ├── app  (Next.js standalone + Chromium/Puppeteer + Prisma Client)
│   └── postgres (PostgreSQL 16, red interna, volumen EBS)
├── EBS gp3 (datos PostgreSQL + Docker)
├── IAM Instance Role
├── SSM Agent (Session Manager)
├── CloudWatch Agent / Docker logs (7 días)
└── egress por IP pública
     ├── SMTP  ├── Niubiz TEST  ├── SAP
     ├── WhatsApp  ├── APIS.NET.PE  └── SIE

AWS: S3 QA (documentos + backups) · ECR · SSM Parameter Store · CloudWatch Logs
```

`ARCHITECTURE_VALID` (con las condiciones de la sección 27).

## 4. EC2 Sizing Analysis

| Instance | vCPU | RAM | Chromium | PostgreSQL | Next.js | Classification | USD/mes 24x7 |
|---|---:|---:|---|---|---|---|---:|
| t3.micro | 2 (burst) | 1 GB | Riesgo OOM | Ajustado | Ajustado | **LIKELY_INSUFFICIENT** | 7.59 |
| **t3.small** | 2 (burst) | 2 GB | OK (bench) | OK | OK | **RECOMMENDED_FOR_QA** | 15.18 |
| t3.medium | 2 (burst) | 4 GB | Holgado | Holgado | Holgado | **OVERPROVISIONED** (QA) | 30.37 |

`t4g.small` (ARM, $0.0168/h) = **NEEDS_RUNTIME_VALIDATION** (la imagen validada es x86_64).

## 5. Local Benchmark

Ejecutado con la imagen web existente (`afiliaciones-iimp:web-regression`) bajo
`--memory=2g --memory-swap=2g` (simula t3.small). Sin AWS ni servicios externos.

| Prueba | Resultado |
|---|---|
| 1 PDF | OK · 11,032 bytes · **2,751 ms** · cgroup ~512 MiB |
| 2 PDFs concurrentes | OK · 11,412/11,512 bytes · **2,631 ms** |
| Peak (2 navegadores abiertos) | **≈ 359 MiB** cgroup |

Conclusión: **2 GB son suficientes** con ~1.5 GB de margen para OS/Docker/PostgreSQL/Next.js/Caddy.
No se ejecutó load testing agresivo.

## 6. PostgreSQL Decision

`LOCAL_POSTGRES_ACCEPTABLE_FOR_QA = SÍ`.
- Contenedor PostgreSQL 16 con volumen en EBS; **solo red interna Docker** (`postgres:5432`).
- **NO** escucha en `0.0.0.0:5432` ni se publica al host/Internet.
- Datos QA aislados de producción. No se comparte credencial ni schema productivo.
- Aislamiento de datos garantizado sin instancia RDS dedicada.

## 7. EBS Strategy

- **gp3 30 GB** (`$0.08/GB-mo` = $2.40/mes), cifrado, montado en `/data` para PostgreSQL y Docker.
- `delete_on_termination = false` en el volumen de datos (la terminación de la EC2 **no** borra los datos).
- Crecimiento: redimensionable en línea (gp3).

## 8. Backup Strategy

- `pg_dump` diario (cron en el host) → comprimido → **S3 QA** (`backups/qa/YYYY-MM-DD.dump.gz`).
- Cifrado (SSE), versioning, lifecycle (retención 30 días), IAM Instance Role con `PutObject`.
- Snapshots EBS semanales (retención 14 días) como respaldo del volumen completo.
- Sin datos productivos.

## 9. Restore Strategy

```
S3 (dump) → descargar → PostgreSQL QA vacío → pg_restore
  → prisma migrate deploy (si aplica) → reiniciar app → /api/health/ready
```
`BACKUP_RESTORE_VALIDATION_REQUIRED = true` (probar restauración antes de confiar en el backup).

## 10. Docker / Compose Design

`docker-compose.qa.yml` con servicios: `caddy`, `app`, `postgres`.
- Redes: `edge` (Caddy↔app) y `data` (app↔postgres); postgres sin puertos publicados.
- Volúmenes: `pgdata` (bind a `/data/postgres`), `caddy_data`, `caddy_config`.
- `restart: unless-stopped`; `healthcheck` por servicio; `depends_on` con condición.
- Límites de recursos en `app` (memoria) para proteger PostgreSQL/Caddy.
- Secretos inyectados por variables de entorno desde SSM (no en el compose).

## 11. Caddy / HTTPS Design

- Caddy en `:80`/`:443`, HTTPS automático (Let's Encrypt), redirección HTTP→HTTPS.
- Proxy a `app:3000`; cabeceras `X-Forwarded-For`, `X-Forwarded-Proto`, `Host`.
- **Historial de seguridad:** el código confía en el valor izquierdo de `X-Forwarded-For`.
  Con Caddy como único proxy, configurar `trusted_proxies` y que Caddy **sobrescriba** las
  cabeceras hacia el backend (evita spoofing). `MUST_FIX_BEFORE_PRODUCTION` se mantiene.

## 12. DNS / IP Strategy

| Opción | Estabilidad | Costo | Recomendación |
|---|---|---|---|
| IPv4 dinámica + DNS update | Baja (cambia al stop/start) | $3.65 | No |
| **Elastic IP** | Alta | $3.65 | **Recomendado** |
| Route53 automation | Alta | +complejidad | Futuro |

`DNS_IP_DECISION = ELASTIC_IP`. DNS: `afiliaciones-qa.iimp.org.pe` → EIP (registro **no** creado aún).

## 13. Office-Hours Strategy

L-V 08:00–18:00 America/Lima. Al detener la EC2: se detiene el cómputo; **EBS, EIP y S3 siguen**.
`START_QA` / `STOP_QA` vía **EventBridge Scheduler → SSM/EC2 API** (cron). Diseño, no implementado.
24x7 vs office: ahorro ~67 % del cómputo EC2.

## 14. SSM Administration

`SSM_READY_DESIGN = SÍ`. Admin → **Session Manager** → EC2 (sin SSH público). Requiere SSM Agent
(AMI Amazon Linux 2023 lo incluye), Instance Role con `AmazonSSMManagedInstanceCore` y egress
HTTPS. SG **sin puerto 22**.

## 15. Secrets Strategy

**SSM Parameter Store SecureString** (estándar, sin costo) para QA.
- STARTUP_REQUIRED: `DATABASE_URL`, `AUTH_SECRET`, `PAYMENT_AUTH_SECRET`.
- FEATURE_REQUIRED: `JWT_SECRET`, `SMTP_PASS`, `SAP_PASSWORD`, `APIS_NET_PE_TOKEN`,
  `WHATSAPP_ACCESS_TOKEN`, `ASSOCIATES_API_PASSWORD`, `NIUBIZ_TEST_USERNAME/PASSWORD`.
- Inyección al arrancar el contenedor (script de bootstrap que lee SSM → env). Valores **nunca**
  en Git, imagen, compose ni logs. Secrets Manager se reserva para producción.

## 16. IAM Instance Role

Least privilege:
```
s3:GetObject, s3:PutObject   on arn:aws:s3:::<qa-bucket>/afiliaciones/* y /backups/*
ssm:GetParameter(s)          on los parámetros QA (SecureString)
ssm:GetParameterHistory?     no
AmazonSSMManagedInstanceCore (managed, para Session Manager)
logs:CreateLogStream/PutLogEvents on el log group QA (si CloudWatch Agent)
sns:Publish                  solo si SMS está habilitado
```
Sin `AdministratorAccess` ni `Action="*"` (excepción documentada: `sns:Publish` para SMS directo).

## 17. Migration Strategy

`APPLICATION START != DATABASE MIGRATION`. En EC2:
```
deploy image → docker run --rm <migration-image> prisma migrate deploy → exit 0 → restart app
```
Usa la **imagen de migración** (con Prisma CLI), no la imagen web. No se ejecutan migraciones
automáticamente al arrancar la app.

## 18. Chromium Validation

- Navegador gestionado por Puppeteer, sandbox habilitado, usuario non-root, `tini` PID 1.
- `/dev/shm`: en Docker por defecto 64 MB; Chromium puede requerir más → usar `--shm-size=1g`
  (sin `--no-sandbox`).
- Benchmark local: 2 PDFs concurrentes OK bajo 2 GB.
- `CHROMIUM_EC2_READY = NEEDS_RUNTIME_VALIDATION` (validar en EC2 real; se espera OK).

## 19. Logging / CloudWatch

CloudWatch Logs **7 días** (mínimo): aplicación, startup, migraciones, Caddy, PostgreSQL, backup.
Costo ~$0.50/GB ingest. Complemento: `docker logs`. **No** se elimina la observabilidad.

## 20. Security Groups

Inbound: **443** (y **80** para ACME) desde `0.0.0.0/0`. **NO** 22/3000/5432 desde Internet.
Outbound: 443 (HTTPS), 80 (HTTP), 25/465/587 (SMTP) y AWS APIs. Restringir destinos dinámicos
de terceros no es practicable por IP; se permite egress saliente y se documenta la limitación.

## 21. Refined Monthly Cost

| Componente | 24x7 USD/mes | Office USD/mes | Required | Notas |
|---|---:|---:|---|---|
| EC2 t3.small (0.0208/h) | 15.18 | 4.51 | Sí | 730 h / 217 h |
| EBS gp3 30 GB (0.08) | 2.40 | 2.40 | Sí | persiste al detener |
| Elastic IP (0.005/h) | 3.65 | 3.65 | Sí | estable |
| S3 (docs+backups ~5 GB) | ~0.12 | ~0.12 | Sí | versioning |
| ECR (~2 GB) | 0.20 | 0.20 | Sí | imágenes |
| CloudWatch (7 d, ~1 GB) | ~0.50 | ~0.50 | Sí | diagnóstico |
| SSM Parameter Store | 0.00 | 0.00 | Sí | SecureString estándar |
| Snapshots EBS (~30 GB) | ~1.50 | ~1.50 | Opcional | publicado |
| Data transfer | variable | variable | — | bajo |
| **Total** | **≈ 23.55** | **≈ 12.88** | | |

PEN referencial: **≈ S/ 87/mes** (24x7) · **≈ S/ 48/mes** (office).
Escenarios alternos: t3.medium 24x7 ≈ USD 38.7; t3.medium office ≈ USD 17.4.

## 22. Previous vs Ultra-Lean Comparison

| Característica | Original QA (ALB+ECS+NAT+RDS) | Ultra-Lean QA |
|---|---|---|
| Costo 24x7 | USD 119–133 | **USD ~23.6** |
| Costo office | USD 71–75 | **USD ~12.9** |
| Complejidad | Alta | Media |
| HA | Media | Baja (SPOF) |
| Seguridad | Alta | Alta (esencial) |
| Paridad producción | Alta | Baja |
| Mantenimiento | Bajo | Manual |
| Backup | RDS auto | pg_dump→S3 + snapshots |
| Restore | PITR | pg_restore (validar) |
| Chromium | Fargate | EC2 (bench OK) |
| Observabilidad | CloudWatch 30 d | CloudWatch 7 d |
| Escalabilidad | Alta | Baja |
| Adecuación QA | Sobredimensionada | **Adecuada** |

## 23. QA vs Production Boundary

`QA_ARCHITECTURE != PRODUCTION_ARCHITECTURE`. Producción futura (propuesta, no aprobada) añadiría:
ALB+ACM, ECS Fargate ≥2 tasks, RDS Multi-AZ, NAT por AZ, autoscaling, WAF, alarmas,
Secrets Manager, backups/PITR. No se paga hoy por requisitos futuros.

## 24. Terraform Gap Analysis

| Current Module | Action | Replacement | Reason |
|---|---|---|---|
| `modules/network` | **REPLACE (simplify)** | VPC + 1 subnet pública + SG | Sin NAT/2 AZ/subnets privadas |
| `modules/alb` | **REMOVE** | Caddy en EC2 | Sin balanceador |
| `modules/ecs` | **REMOVE** | EC2 + Docker Compose | Sin ECS |
| `modules/rds` | **REMOVE** | PostgreSQL local en EC2 | Sin RDS |
| `modules/secrets` | **REPLACE** | SSM Parameter Store | Secretos QA en SSM |
| `modules/storage` | **KEEP** | S3 QA (+ backups) | Aislamiento |
| `modules/ecr` | **KEEP** | ECR | Imágenes |
| `modules/observability` | **KEEP (simplify)** | CloudWatch 7 d | Diagnóstico |
| `modules/iam` | **REPLACE** | Instance Role | Sin task/execution/migration roles ECS |
| `environments/qa` | **REPLACE** | Nuevo wiring | Arquitectura distinta |
| — | **NEW** | `modules/ec2` (EC2+EBS+EIP) | Compute |
| — | **NEW** | `modules/ssm` (parámetros) | Secretos |
| — | **NEW** | `modules/scheduler` (opcional) | Office hours |
| — | **NEW** | `modules/backup` (pg_dump/cron) | Backups |

## 25. Terraform Redesign Plan

**FASE 3D-5.6 — Ultra-Lean QA Terraform Refactor** (no ejecutada):
- Eliminar `alb`, `ecs`, `rds`; simplificar `network`; reemplazar `secrets`→`ssm`, `iam`→instance role.
- Nuevos: `ec2` (instancia, EBS, EIP), `ssm` (parámetros SecureString), `backup`, `scheduler` (opcional).
- Variables: `instance_type`, `data_volume_size_gb`, `enable_office_hours`, `qa_hostname`, `s3_bucket`, etc.
- Outputs: `instance_id`, `elastic_ip`, `s3_bucket`, `log_group`.
- `fmt`/`validate`/`plan`; **sin apply**.
- No conservar complejidad de producción innecesaria.

## 26. Risks

- SPOF; mantenimiento manual; menor paridad.
- Chromium en EC2 sin validar (bench local OK).
- Restore no validado aún.
- Let's Encrypt requiere dominio y 80/443.
- X-Forwarded-For: configurar Caddy para sobrescribir cabeceras.

## 27. Blocking Items

**BLOCKING_FOR_TERRAFORM_REFACTOR:** ninguno técnico; requiere aprobación del diseño.
**BLOCKING_FOR_QA_APPLY:** dominio/hostname QA; certificado Let's Encrypt (no ACM); AMI base;
autorización humana.
**BLOCKING_FOR_QA_DEPLOY:** validar Chromium en EC2; validar restore; cargar parámetros SSM;
publicar imágenes; migrar.
**BLOCKING_FOR_PRODUCTION:** cutover, migración de datos legacy, X-Forwarded-For, PII logs,
arquitectura de producción, RTO/RPO.

## 28. Supervisor Summary

Ver encabezado. Arquitectura de un nodo, segura y funcional para 20–30 usuarios/día, con costo
≈ USD 13–24/mes (ahorro ≈ USD 62–109/mes) y limitaciones de QA aceptadas explícitamente.

## 29. Final Decision

**`READY_FOR_ULTRA_LEAN_TERRAFORM_REFACTOR`** (con condiciones menores de validación runtime).

### Respuestas directas

| Pregunta | Respuesta |
|---|---|
| ¿Ultra-Lean técnicamente viable? | **YES** |
| ¿t3.small suficiente? | **NEEDS_RUNTIME_VALIDATION** (bench local favorable; 2 PDFs bajo 2 GB) |
| ¿PostgreSQL local aceptable? | **YES** |
| ¿ALB necesario? | **NO** |
| ¿NAT Gateway necesario? | **NO** |
| ¿RDS dedicado necesario? | **NO** |
| ¿CloudWatch eliminable? | **NO** — nivel mínimo 7 días |
| ¿SSM Parameter Store suficiente? | **YES** |
| ¿SSM Session Manager elimina SSH? | **YES** |
| ¿Caddy reemplaza ALB? | **YES** |
| ¿Office-hours recomendable? | **AFTER_VALIDATION** |
| ¿Terraform actual aplicable? | **NO** hasta reconciliar con Ultra-Lean |

## 30. Preconditions for Implementation

1. Aprobación del diseño Ultra-Lean.
2. Dominio QA y decisión de Let's Encrypt (HTTP-01/DNS-01).
3. AMI base (Amazon Linux 2023 x86_64).
4. Refactor Terraform (3D-5.6).
5. Validaciones runtime (Chromium, restore, SSM).

## 31. Nota sobre documentos previos

No se modifican. Tras aprobar, los documentos anteriores deben actualizarse para reflejar
Ultra-Lean (≈ USD 13–24/mes) como arquitectura QA oficial.
