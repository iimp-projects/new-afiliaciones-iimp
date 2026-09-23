# QA Minimal Architecture Review — Afiliaciones IIMP

> **Fecha:** 2026-09-20 · **Región:** us-east-2 · **Moneda:** USD · **PEN:** referencial (TC 3.70)
> **Método:** análisis de diseño + AWS Pricing API (read-only). Sin mutaciones AWS.
> **Precios verificados:** EC2/EBS/RDS/NAT/ALB/CloudWatch/Secrets (AWS Pricing API, 2026-09-20).

---

# Resumen para supervisor / QA

**Volumen esperado:** 20–30 usuarios/día, concurrencia baja, uso exclusivamente QA.

**Qué estaba sobredimensionado:** el diseño anterior replicaba patrones de producción
innecesarios para QA: **ALB** (balanceo/HA que no se usa), **NAT Gateway** (~USD 33/mes fijos),
**ECS Fargate** y **RDS dedicado**, además de 2 AZ de aplicación.

**Qué realmente necesitamos:** una sola instancia (compute) que ejecute la aplicación
Next.js + Chromium, con PostgreSQL QA separado, HTTPS, secretos fuera del repositorio,
S3 para documentos y logs mínimos.

**Nueva arquitectura propuesta (Ultra-Lean QA):**
una **EC2 pequeña** con Docker (Next.js + Chromium), **PostgreSQL local** (contenedor) con
`pg_dump` diario a S3, **Caddy** para HTTPS automático, **SSM Parameter Store** para secretos,
**IAM Instance Role**, S3 y CloudWatch 7 días. **Sin ALB, sin NAT, sin ECS, sin RDS.**

**Costo mensual estimado:** **≈ USD 22/mes** (24x7) o **≈ USD 12/mes** en horario laboral.

**Ahorro:** ≈ **USD 97–111/mes** frente al diseño aislado 24x7 (USD 119–133) y
≈ **USD 53/mes** frente al office-hours anterior (USD 75). Ahorro anual ≈ **USD 636–1,332**.

**Riesgos aceptados (por ser QA):** punto único de fallo, reinicios/mantenimiento manual,
menor paridad con producción. **No** se acepta: compartir producción, DB pública, HTTP sin TLS,
secretos en el repositorio ni Security Groups abiertos.

**Decisión requerida:** aprobar la arquitectura **Ultra-Lean QA** para continuar con el rediseño
de Terraform (fase posterior) y el apply.

---

## 1. Executive Summary

La arquitectura QA anterior (VPC + ALB + ECS Fargate + NAT + RDS + 2 AZ) está diseñada para
disponibilidad y paridad con producción, pero QA tiene 20–30 usuarios/día y acepta
indisponibilidad. Se propone una arquitectura de **un solo nodo** que conserva todos los
controles de seguridad esenciales (HTTPS, DB no pública, secretos gestionados, IAM, S3 privado)
y reduce el costo en ~70 %.

## 2. QA Workload Assumptions

| Variable | Supuesto |
|---|---|
| Usuarios/día | 20–30 |
| Concurrencia | Baja (1–3) |
| Disponibilidad | No requiere HA; ventanas de indisponibilidad aceptables |
| Autoscaling | No |
| Multi-AZ | No |
| Horario | L-V 08:00–18:00 (Lima), ~217 h/mes |
| PDF/Chromium | Uso ocasional, 1–2 concurrentes |
| Datos | QA aislados; no producción |

## 3. Current Architecture Review

| Recurso | Por qué existía | Requisito QA | Puede eliminarse | Puede simplificarse | Impacto seguridad | Impacto costo |
|---|---|---|---|---|---|---|
| VPC dedicada | Aislamiento | Sí (o VPC default + SG) | No | Sí | Neutro | Bajo |
| 2 AZ | HA | No | Sí (1 AZ) | — | Bajo | Bajo |
| ALB | Entrada HTTPS + balanceo | Solo HTTPS | **Sí** | Sí (Caddy) | Neutro si TLS propio | −USD 16.4 |
| ECS Fargate | Compute | Compute | **Sí** | Sí (EC2 Docker) | Neutro | −USD 36 |
| NAT Gateway | Egress privado | Egress | **Sí** | Sí (IP pública + SG) | Aceptable | −USD 33 |
| RDS dedicado | DB administrada | DB aislada | **Sí** | Sí (Postgres local) | Aceptable (no público) | −USD 13 |
| S3 | Documentos | Sí | No | No | Alto valor | Bajo |
| ECR | Imágenes | Sí | No | No | Alto valor | Bajo |
| Secrets Manager | Secretos | Sí | Sí | SSM Parameter Store | Similar | −USD 5 |
| CloudWatch | Logs | Sí | No | 7 días | Bajo | Bajo |

## 4. Load Balancer Analysis

**Separación clave:** `LOAD_BALANCING_REQUIREMENT = NO` (1 nodo, sin autoscaling/HA) vs
`HTTPS_PUBLIC_ENTRYPOINT_REQUIREMENT = SÍ`. HTTPS no implica ALB.

| Opción | Costo/mes | HTTPS | DB privada | Puppeteer | Ops | Seguridad | Complejidad | Paridad prod |
|---|---|---|---|---|---|---|---|---|
| A. ALB + ECS privado | ALB 16.4 + ECS 36 + NAT 33 | ACM | Sí | Sí | Media | Alta | Alta | Alta |
| B. ECS sin ALB | ECS 36 + NAT 33 | Difícil (sin TLS de borde) | Sí | Sí | Media | Media | Media | Media |
| C. App Runner | ~15–40 (vCPU/GB) | Gestionado | Sí (VPC connector) | **Riesgo** (Chromium/sandbox) | Baja | Alta | Baja | Media |
| D. **EC2 + reverse proxy** | EC2 ~15 + IP 3.65 | **Caddy/Let's Encrypt** | Sí (local) | **Sí** | Media | Alta | Baja | Media |
| E. CloudFront + EC2 | +CloudFront | ACM (us-east-1) | Sí | Sí | Media | Alta | Media | Media |

**Conclusión:** para 1 nodo, **no se necesita ALB**. La opción D (EC2 + Caddy) da HTTPS sin
ALB. `RESPUESTA: NO (OPTIONAL)`.

## 5. Database Analysis

**`DATA_ISOLATION != DEDICATED_RDS_INSTANCE`.** QA necesita datos separados, no una instancia RDS.

| Opción | Costo/mes | Aislamiento | Backups | Prisma | SSL | Mantenimiento |
|---|---|---|---|---|---|---|
| A. RDS PostgreSQL dedicado | 13.3 | Alto | Automáticos | Sí | Sí | Bajo |
| B. PostgreSQL en infra existente | — | **No existe opción no productiva** | — | — | — | — |
| C. **PostgreSQL local en compute QA** | 0 | Alto (no público) | `pg_dump` a S3 | Sí | local | Manual |
| D. Aurora Serverless v2 | ≥ 43 (mínimo) | Alto | Automáticos | Sí | Sí | Bajo |

**Conclusión:** **NO se requiere RDS dedicado**. Postgres local + `pg_dump` diario a S3 cumple
aislamiento y recuperabilidad para QA. `RESPUESTA: NO (OPTIONAL)`. Nunca compartir producción.

## 6. NAT Analysis

`PUBLIC_IP != PUBLIC_APPLICATION_PORTS`. Una EC2 con **IP pública** mantiene solo **443**
(HTTP 80 solo para ACME) expuesto por Security Group; el egress saliente (SMTP, Niubiz, SAP,
WhatsApp, APIS.NET.PE, SIE) sale por la IP pública sin NAT.

| Opción | Costo/mes | Egress | Seguridad | Complejidad |
|---|---|---|---|---|
| A. ECS privado + NAT | 33 | Sí | Alta | Media |
| B. **EC2 con IP pública + SG restrictivo** | 3.65 (IPv4) | Sí | Aceptable (443) | Baja |
| C. App Runner | incluido | Sí | Alta | Baja |
| D. EC2 público 443 + DB local | 3.65 | Sí | Aceptable | Baja |
| E. VPC endpoints + egress alternativo | ≥70 | Parcial | Alta | Alta |

**Conclusión:** se **elimina el NAT**; egress por IP pública con SG restrictivo.
`RESPUESTA: NAT NO necesario`.

## 7. CloudWatch Analysis

| Opción | Costo | Diagnóstico | Recomendación |
|---|---|---|---|
| A. 30 días | Bajo (variable) | Suficiente | — |
| B. **7 días** | Mínimo | Suficiente para QA | **Recomendado** |
| C. 3 días | Mínimo | Limitado | No |
| D. Solo logs locales | 0 | Riesgo de pérdida | Complementario |

Conservar: logs de aplicación, startup, migraciones, Chromium y health. `RESPUESTA: MINIMAL (7 días)`.

## 8. Compute / Puppeteer Analysis

Chromium es el verdadero driver de memoria, no el número de usuarios.

| Candidato | vCPU/RAM | Chromium | Clasificación |
|---|---|---|---|
| 0.25 vCPU / 0.5 GB | — | No | **LIKELY_INSUFFICIENT** |
| 0.5 vCPU / 1 GB | — | Riesgo OOM | **LIKELY_INSUFFICIENT** |
| 0.5 vCPU / 2 GB | — | Posible | **NEEDS_RUNTIME_VALIDATION** |
| 1 vCPU / 2 GB | — | Actual | **CURRENTLY_VALIDATED** (Docker local) |

**No reducir sin evidencia.** Benchmark posterior (no ejecutado): startup, login, PDF,
memoria/CPU peak, tiempo PDF, 2 PDFs y 5 requests concurrentes.

## 9. ECS vs EC2 vs App Runner

| Criterio | ECS Fargate | **EC2 (Docker)** | App Runner |
|---|---|---|---|
| Costo (1 nodo) | USD 36 | **USD 15** | USD 15–40 |
| Seguridad | Alta | Alta (SG + SSM) | Alta |
| Mantenimiento | Bajo | **Manual** | Bajo |
| Docker | Sí | **Sí** | Sí (imagen) |
| Puppeteer/Chromium | Sí | **Sí** | **Riesgo sandbox** |
| Postgres conectividad | RDS | **Local o RDS** | RDS |
| HTTPS | ALB | **Caddy** | Gestionado |
| IAM Role | Task Role | **Instance Role** | Instance Role |
| S3/Secrets | Sí | Sí | Sí |
| CI/CD | Alta | Media | Media |
| Paridad prod | Alta | Media | Media |

**Conclusión:** para 1 nodo, **EC2 con Docker** es la opción más económica y compatible con
Chromium. App Runner es interesante pero el sandbox de Chromium es un riesgo.

## 10. Secrets Analysis

13 secretos en Secrets Manager = USD 5.20/mes. Alternativa: **SSM Parameter Store
SecureString** (estándar, sin costo). Agrupación lógica opcional (no necesaria si SSM es gratis).

| Opción | Costo | Seguridad | Operación |
|---|---|---|---|
| Secrets Manager (13) | 5.20 | Alta | ECS secrets / bootstrap |
| **SSM Parameter Store SecureString** | 0 | Alta (KMS) | Bootstrap en EC2 |
| Agrupar en 4 secretos | ~1.6 | Media | Menor granularidad |

**Recomendación:** SSM Parameter Store para QA (sin costo, cifrado). Mantener Secrets Manager
para producción.

## 11. S3 / ECR

| Recurso | Costo/mes | Aislamiento | Clasificación |
|---|---|---|---|
| S3 QA (documentos) | <1 | Alto | **KEEP** |
| ECR (imágenes) | <1 | Alto | **KEEP** |

No se optimizan centavos a costa de aislamiento/complejidad.

## 12. Option 1 — Current Safe QA (office hours)

Dedicada (VPC + ALB + ECS + NAT + RDS), L-V 08:00–18:00. **≈ USD 71–75/mes.**

## 13. Option 2 — Lean QA (EC2 + RDS gestionado)

EC2 t3.small (Docker + Chromium + Caddy) + **RDS db.t4g.micro** + SSM + CloudWatch 7 d.
Sin ALB, sin NAT, sin ECS.

| Componente | 24x7 USD/mes |
|---|---:|
| EC2 t3.small (0.0208/h) | 15.18 |
| EBS gp3 30 GB (0.08/GB) | 2.40 |
| Public IPv4 (0.005/h) | 3.65 |
| RDS db.t4g.micro + 20 GB | 13.28 |
| SSM Parameter Store | 0.00 |
| CloudWatch 7 d | ~1.50 |
| S3 + ECR | ~0.50 |
| **Total** | **≈ 36.51** |

Office hours (217 h): **≈ USD 16–18/mes**.

## 14. Option 3 — Ultra-Lean QA (EC2 + PostgreSQL local)

EC2 t3.small (Docker: Next.js + Chromium + PostgreSQL) + Caddy + SSM + CloudWatch 7 d +
`pg_dump` diario a S3. Sin ALB, NAT, ECS ni RDS.

| Componente | 24x7 USD/mes |
|---|---:|
| EC2 t3.small (0.0208/h) | 15.18 |
| EBS gp3 30 GB | 2.40 |
| Public IPv4 | 3.65 |
| PostgreSQL local (contenedor) | 0.00 |
| SSM Parameter Store | 0.00 |
| CloudWatch 7 d | ~1.50 |
| S3 + ECR | ~0.50 |
| **Total** | **≈ 23.23** |

Office hours (217 h): **≈ USD 12–13/mes**.
Alternativa t3.medium (4 GB, más margen para Chromium): **≈ USD 38/mes** 24x7.

## 15. Cost Comparison

| Componente | Current (office) | Lean (EC2+RDS) | Ultra-Lean (EC2+PG local) |
|---|---|---|---|
| Compute | ECS Fargate | EC2 t3.small | EC2 t3.small |
| Database | RDS db.t4g.micro | RDS db.t4g.micro | PostgreSQL local |
| Load Balancer | ALB | Caddy (EC2) | Caddy (EC2) |
| NAT | Sí | No | No |
| HTTPS | ACM+ALB | Let's Encrypt | Let's Encrypt |
| Storage | S3 + ECR | S3 + ECR | S3 + ECR |
| Secrets | Secrets Manager | SSM | SSM |
| Logging | CW 30 d | CW 7 d | CW 7 d |
| Backup | RDS auto | RDS auto | pg_dump→S3 |
| Puppeteer | Sí | Sí | Sí |
| **USD/mes (24x7)** | ~119–133 | **~36.5** | **~23.2** |
| **USD/mes (office)** | ~71–75 | ~16–18 | **~12–13** |
| **PEN/mes (office, ref.)** | ~263–277 | ~59–67 | **~44–48** |
| Availability | Media | Baja | Baja (SPOF) |
| Security | Alta | Alta | Alta (controles esenciales) |
| Prod parity | Alta | Media | Baja |
| Ops complexity | Media | Media | Media-Alta |

## 16. Office Hours Analysis

- **EC2:** se **detiene** fuera de horario → ahorro ~67 % del compute (EBS y IPv4 siguen).
- **RDS:** stop/start válido (máx. 7 días) → ahorro ~67 % de la instancia; storage sigue.
- **NAT / ALB:** no aplican en Lean/Ultra-Lean (eliminados).
- **S3 / ECR / SSM:** costos fijos mínimos; no cambian.

## 17. Security Comparison

| Control | Current | Lean | Ultra-Lean |
|---|---|---|---|
| HTTPS | Sí (ACM+ALB) | Sí (LE) | Sí (LE) |
| DB no pública | Sí | Sí | Sí |
| Secretos fuera del repo | Sí | Sí | Sí |
| IAM mínimo | Sí | Sí | Sí |
| S3 privado | Sí | Sí | Sí |
| Sin SSH público | Sí | SSM | SSM |
| Aislamiento de datos | Alto | Alto | Alto |
| SPOF | No | Sí | Sí |

Todos los controles esenciales se conservan. Se acepta SPOF (QA).

## 18. Responses to QA

### ¿Necesitamos balanceador?
**NO (OPTIONAL).** Un solo nodo no requiere balanceo; HTTPS se resuelve con Caddy.
Solo si en el futuro se agrega HA se justificaría un ALB.

### ¿Necesitamos una instancia RDS dedicada?
**NO (OPTIONAL).** El requisito es **aislamiento de datos**, no una instancia dedicada.
Postgres local + `pg_dump` a S3 lo cumple. RDS queda como opción si se prefiere DB gestionada.

### ¿Necesitamos CloudWatch?
**MINIMAL.** Conservar logs de aplicación/startup/migraciones/Chromium/health con
retención **7 días** (o logs locales complementarios).

### ¿La arquitectura actual está sobredimensionada para 20–30 usuarios/día?
**YES.** ALB, NAT, ECS y RDS dedicado, junto con 2 AZ, no aportan valor para este volumen.

### ¿Qué recurso provoca costo innecesario?
1. **NAT Gateway** (~USD 33/mes) — eliminable con IP pública + SG.
2. **ECS Fargate** (~USD 36/mes) — sustituible por EC2 pequeña.
3. **ALB** (~USD 16/mes) — sustituible por Caddy.
4. **RDS dedicado** (~USD 13/mes) — sustituible por Postgres local.
5. **Secrets Manager** (~USD 5/mes) — sustituible por SSM.

## 19. Recommended QA Architecture

**Ultra-Lean QA** (Opción 3):

- **Compute:** 1× EC2 `t3.small` (x86_64, compatible con la imagen validada) con Docker.
- **Aplicación:** imagen web (Next.js + Chromium) en contenedor.
- **Base de datos:** PostgreSQL en contenedor con volumen EBS; `pg_dump` diario a S3.
- **HTTPS:** Caddy con Let's Encrypt (`afiliaciones-qa.iimp.org.pe` → EIP).
- **Egress:** IP pública; **SG solo 443** (+80 ACME); SSH deshabilitado (SSM Session Manager).
- **Secretos:** SSM Parameter Store SecureString; inyectados al arrancar el contenedor.
- **IAM:** Instance Role (S3 + SSM).
- **Logs:** CloudWatch 7 días.
- **Backups:** `pg_dump` diario a S3 versionado.
- **Sin** ALB, NAT, ECS, RDS.

Criterio: **MINIMUM_SAFE_FUNCTIONAL_QA**. `≈ USD 23/mes` 24x7 · `≈ USD 12–13/mes` office hours.

Si se prefiere DB gestionada, usar **Lean QA** (añadir RDS: +USD 13/mes).

## 20. Production Evolution Path

QA **no** debe replicar producción. Para producción se añadirían:

| Componente | QA (Ultra-Lean) | Producción futura (propuesta) |
|---|---|---|
| Compute | 1 EC2 | ECS Fargate ≥2 tasks (2 AZ) |
| Balanceo | Caddy | ALB + ACM |
| DB | PostgreSQL local | RDS PostgreSQL Multi-AZ |
| Egress | IP pública | NAT Gateway |
| Autoscaling | No | Sí |
| Observabilidad | CloudWatch 7 d | Alarmas + dashboards |
| WAF | No | Sí |
| Backups | pg_dump | PITR + snapshots |
| Secretos | SSM | Secrets Manager |

## 21. Risks

- Punto único de fallo (aceptado en QA).
- Postgres local: pérdida si falla EBS sin backup → mitigado con `pg_dump` diario.
- HTTPS vía Let's Encrypt requiere dominio público y puertos 80/443.
- Chromium en t3.small (2 GB) podría requerir t3.medium → validar.
- Mantenimiento manual (parches, reinicios).
- Menor paridad con producción (por diseño).

## 22. Required Validation

1. Benchmark de Chromium en EC2 (memoria/CPU/tiempo PDF).
2. HTTPS con Caddy + Let's Encrypt en el dominio QA.
3. `pg_dump`/restore a S3.
4. Inyección de secretos desde SSM al contenedor.
5. Egress a SMTP/Niubiz TEST/SAP/WhatsApp/APIS.NET.PE/SIE.
6. Health `/api/health/live` y `/ready`.

## 23. Next Steps

1. Revisión de QA/supervisor de este análisis.
2. Aprobar **Ultra-Lean QA** (o Lean con RDS).
3. Rediseñar Terraform (fase posterior) — **no en esta fase**.
4. Validaciones y apply con autorización explícita.

---

## Nota sobre documentos previos

No se modifican. Tras aprobar, `qa-architecture-and-costs.md` y
`qa-finops-and-existing-infrastructure-analysis.md` deberán actualizarse para reflejar la
arquitectura elegida (Ultra-Lean) y su costo (~USD 12–23/mes), reemplazando el baseline 24x7.
