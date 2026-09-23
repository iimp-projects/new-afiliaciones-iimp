# QA FinOps y Análisis de Infraestructura Existente — Afiliaciones IIMP

> **Fecha de análisis:** 2026-09-20
> **Cuenta AWS:** `5649********7461` (enmascarada) · alias `iimp`
> **Región objetivo QA:** us-east-2
> **Moneda:** USD · **Conversión PEN:** referencial (TC 3.70, no contractual)
> **Método:** AWS CLI read-only + Cost Explorer + AWS Pricing API. Sin mutaciones.

---

# Resumen para supervisor

**¿Cuánto gastamos actualmente en AWS?**
≈ **USD 400/mes** (promedio 6 meses: ~USD 403; agosto 2026: USD 402). El gasto se concentra
casi por completo en **sa-east-1 (São Paulo)**, donde vive el sistema legacy:
RDS MySQL Multi-AZ (~USD 208), almacenamiento/snapshots EBS (~USD 93), EC2 t2.micro (~USD 28),
Lightsail (~USD 24) y direcciones IPv4 (~USD 22).

**¿Cuánto agregaría Afiliaciones QA?**
QA es infraestructura **nueva y aislada**; el costo es **incremental**:
- **Aislamiento total 24x7:** ≈ **USD 115–119/mes** (≈ S/ 440).
- **Aislamiento total con horario de oficina:** ≈ **USD 71–75/mes** (≈ S/ 277).

**¿Por qué el diseño original costaba ~USD 119–184/mes?**
Porque mantiene 24x7 un NAT Gateway (USD 33), un ALB (USD 16), una tarea Fargate (USD 36)
y una base RDS (USD 13), más IPv4 pública y secretos.

**¿Cuánto costaría la alternativa optimizada?**
**USD ~75/mes** deteniendo ECS y RDS fuera del horario de oficina (≈217 h/mes) y manteniendo
todos los controles de seguridad. **Ahorro ≈ USD 44/mes ≈ USD 528/año** (≈ S/ 1,954/año referencial).

**¿Qué seguridad se mantiene?**
ALB como único punto público, ECS y RDS privados, PostgreSQL no público, S3 privado,
secretos en Secrets Manager, IAM de mínimo privilegio, HTTPS. **No** se elimina NAT ni ALB
(rompería integraciones/HTTPS), **no** se expone ECS, **no** se comparte la base productiva.

**¿Qué decisión necesita aprobación?**
Autorizar la arquitectura QA **dedicada con horario operativo** (Escenario B) e iniciar la
Fase 3D-6 (creación de infraestructura).

---

## 1. Executive Summary

La cuenta AWS IIMP no posee infraestructura moderna reutilizable para QA: **no hay ECS, ALB,
NAT, ECR, VPC endpoints ni VPC personalizadas**; solo VPC por defecto y recursos legacy en
sa-east-1. Por tanto, **no es posible reutilizar** infraestructura (Escenario C no aplica).

El costo de QA es **incremental** (~USD 75–119/mes según horario) sobre el gasto legacy
existente (~USD 400/mes). La palanca de ahorro más efectiva y segura es **operar QA en horario
de oficina** (detener ECS/RDS fuera de horario), manteniendo NAT y ALB 24x7 por requisitos
técnicos y de seguridad.

## 2. AWS Account Inventory

- Cuenta: `5649********7461` (alias `iimp`), caller `user/sara-aws-cli`, región `us-east-2`.
- **us-east-2:** sin ECS, ALB, RDS, ECR, NAT, EIP, VPC endpoints, log groups ni secretos.
  Solo VPC por defecto `172.31.0.0/16`.
- **us-east-1:** sin compute; 2 buckets `iimp-certificados-*` y 1 secreto.
- **sa-east-1:** legacy — EC2 `Web Afiliacion` (+ otras), RDS MySQL `iimpwebsites-db`,
  4 EIPs, bucket Elastic Beanstalk, SNS `sns_alertas_iimp`.
- Sin organización AWS (`AWSOrganizationsNotInUseException`).

## 3. Current AWS Cost

Totales por mes (Cost Explorer, UnblendedCost):

| Mes | USD |
|---|---:|
| 2026-03 | 416.85 |
| 2026-04 | 409.31 |
| 2026-05 | 412.96 |
| 2026-06 | 370.17 |
| 2026-07 | 406.96 |
| 2026-08 | **402.45** |
| 2026-09 (1–20) | 248.79 |

Últimos 30 días por región: **sa-east-1 ≈ USD 133.8**, us-east-1 ≈ USD 9.0, global ≈ USD 0.6.
**us-east-2 = USD 0** (sin recursos).

Top uso (agosto 2026):

| UsageType | USD | Naturaleza |
|---|---:|---|
| SAE1-Multi-AZUsage:db.t3.medium | 208.32 | RDS MySQL legacy |
| SAE1-EBS:SnapshotUsage | 49.15 | Snapshots legacy |
| SAE1-EBS:VolumeUsage.gp2 | 43.70 | Volúmenes legacy |
| SAE1-BoxUsage:t2.micro | 27.66 | EC2 legacy |
| USE1-BundleUsage:4GB | 23.99 | Lightsail |
| SAE1-RDS:Multi-AZ-GP3-Storage | 17.52 | RDS storage |
| SAE1-PublicIPv4:InUseAddress | 14.88 | 4 EIPs |
| SAE1-PublicIPv4:IdleAddress | 7.44 | EIPs sin uso |
| SAE1-DataTransfer-Out-Bytes | 2.38 | Egress |
| HostedZone / DNS-Queries | 2.00 / 1.94 | Route53 |
| SAE1-RDS:ChargedBackupUsage | 1.53 | Backups RDS |
| USE1-AWSSecretsManager-Secrets | 0.40 | 1 secreto |

**No existe NAT Gateway** en la cuenta.

## 4. Existing Applications

| Aplicación | ECS | ALB | RDS | S3 | NAT/VPC | Costo atribuible | Confianza |
|---|---|---|---|---|---|---|---|
| Websites legacy (EB/PHP) | No | No | MySQL `iimpwebsites-db` | EB bucket | VPC default sa-east-1 | ~USD 250/mes | MEDIUM |
| EC2 "Web Afiliacion" | No | No | (local/unknown) | — | EIP sa-east-1 | ~USD 30/mes | MEDIUM |
| Certificados | No | No | No | `iimp-certificados-*` | — | ~USD 1/mes | MEDIUM |
| Lightsail (sitios) | No | No | No | No | — | ~USD 24/mes | LOW |
| Afiliaciones QA (nuevo) | — | — | — | — | — | **incremental** | — |

## 5. Existing Shared Infrastructure

**Ninguna reutilizable para QA.** No hay ECS, ALB, NAT, ECR, VPC endpoints ni VPC personalizada.
Clasificación de candidatos: ECS `UNKNOWN` (no existe), ALB `NOT_RECOMMENDED` (no existe),
NAT `NOT_RECOMMENDED` (no existe), VPC `NOT_RECOMMENDED` (solo default), Route53 `SAFE_TO_SHARE`
(zona existente), ACM `UNKNOWN` (no existe).

## 6. Current Afiliaciones QA Architecture

Baseline documentado en `docs/architecture/qa-architecture-and-costs.md`:
VPC dedicada + ALB + ECS Fargate (1 vCPU/2 GB, 1 task) + RDS PostgreSQL db.t4g.micro Single-AZ +
NAT single + S3 + ECR + Secrets (13) + CloudWatch 30 d + IAM. Plan: 82/0/0.

## 7. Cost Drivers (arquitectura QA)

| Rank | Componente | USD/mes fijo | Tipo |
|---|---|---:|---|
| 1 | NAT Gateway | 32.85 | fijo 24x7 |
| 2 | ECS Fargate | 36.04 | fijo 24x7 |
| 3 | ALB | 16.43 | fijo 24x7 |
| 4 | RDS instancia | 11.68 | fijo 24x7 |
| 5 | Public IPv4 (NAT+ALB) | 10.95 | fijo 24x7 |
| 6 | Secrets Manager | 5.20 | fijo |
| 7 | RDS storage gp3 | 1.60 | fijo |
| 8 | ECR | 0.20 | variable |
| 9 | CloudWatch / S3 / transfer | variable | variable |

## 8. Scenario A — Dedicated 24x7

| Componente | USD/mes |
|---|---:|
| NAT Gateway | 32.85 |
| Fargate (730 h) | 36.04 |
| ALB | 16.43 |
| RDS instancia + storage | 13.28 |
| Public IPv4 | 10.95 |
| Secrets Manager (13) | 5.20 |
| ECR | 0.20 |
| **Fijo** | **≈ 114.95** |
| Variable (esc. normal) | ≈ 18.5 |
| **Total** | **≈ 133** |

Rango por actividad: **USD 119–184/mes**.

## 9. Scenario B — Office Hours

Supuesto: Lunes–Viernes 08:00–18:00 (Lima) ≈ **217 h/mes** (50 h/semana).

| Componente | 24x7 | Office hours | Nota |
|---|---:|---:|---|
| ECS Fargate | 36.04 | **10.71** | desiredCount 0 fuera de horario |
| RDS instancia | 11.68 | **3.47** | stop/start programado |
| RDS storage | 1.60 | 1.60 | storage se cobra igual |
| NAT Gateway | 32.85 | **32.85** | **no se apaga** |
| ALB | 16.43 | **16.43** | **no se apaga** |
| Public IPv4 | 10.95 | **10.95** | 24x7 |
| Secrets Manager | 5.20 | 5.20 | fijo |
| ECR | 0.20 | 0.20 | — |
| **Fijo** | 114.95 | **≈ 71.41** | |
| Variable | ≈ 18.5 | ≈ 4 | menor uso |
| **Total** | ≈ 133 | **≈ 75** | |

**Ahorro ≈ USD 44/mes (≈33%).**

Limitaciones reales: RDS stop tiene máximo de 7 días (un scheduler diario es válido);
NAT y ALB no se pueden “apagar” sin destruirlos; detener ECS no elimina el costo NAT.

## 10. Scenario C — Shared Infrastructure

**NOT_AVAILABLE.** No existe ECS, ALB, NAT ni VPC personalizada que compartir. No hay costo
incremental que evitar. Se documenta como no viable.

## 11. Scenario D — Minimum Safe QA

| Medida | Ahorro/mes | Seguridad | Operación | Recomendación |
|---|---:|---|---|---|
| Office hours ECS/RDS (Esc. B) | ~44 | Sin cambio | Media | **Recomendado** |
| Retención logs 30→7 d | ~1–3 | Baja | Baja | Opcional |
| Fargate Spot | hasta ~25 | Media (interrupción) | Media | Solo si se acepta |
| Agrupar secretos | ~2–3 | Media | Media | No prioritario |
| Eliminar NAT (ECS con IP pública) | ~33 | **Degrada aislamiento** | Alta | **No recomendado** |
| Graviton/ARM64 | ~20% Fargate | Requiere validación | Alta | FUTURE_OPTIMIZATION |

**Minimum Safe QA = Escenario B** (todos los controles intactos). Eliminar NAT se descarta por
degradar el aislamiento y complicar las integraciones.

## 12. NAT Analysis

- No existe NAT previo en la cuenta → no hay reutilización.
- El NAT es **necesario** para SAP, SMTP, Niubiz, WhatsApp, APIS.NET.PE y SIE.
- NAT no se “apaga” con office hours: costo fijo 24x7 (~USD 32.85 + datos).
- Break-even vs interface endpoints: los endpoints interface suman ~USD 70/mes (5 endpoints ×
  2 AZ); con tráfico QA bajo, el NAT es más económico. **Mantener NAT, diferir endpoints.**
- Eliminar NAT (ECS con IP pública) ahorra ~USD 33/mes pero **degrada el aislamiento**: no recomendado.

## 13. ALB Analysis

- No existe ALB previo → no hay ALB compartido (host-based routing no aplicable).
- ALB dedicado QA (~USD 16.43/mes) es el punto de entrada HTTPS; **mantener 24x7**.
- Compartir un ALB existente no es posible (no existe). `NOT_AVAILABLE`.

## 14. ECS Analysis

- No existe ECS previo. QA usará Fargate 1 vCPU/2 GB, 1 task, X86_64.
- **No reducir CPU/RAM** sin evidencia: Chromium/Puppeteer incluido
  (`CHROMIUM_FARGATE_VALIDATION_REQUIRED=true`). Cualquier reducción = `NEEDS_RUNTIME_VALIDATION`.
- Office hours (desiredCount 0 fuera de horario) es la palanca segura.

## 15. RDS Analysis

- No existe RDS PostgreSQL previo (solo MySQL legacy, que **no** se reutiliza).
- QA: PostgreSQL 16, db.t4g.micro, Single-AZ, privado, cifrado.
- Office hours stop/start válido (máx. 7 días). Alternativa serverless (Aurora Serverless v2)
  no se recomienda: mayor costo mínimo y complejidad para QA.
- **No compartir** la base legacy ni producción.

## 16. Incremental Cost Comparison

| Escenario | Incremental USD/mes | PEN/mes (ref.) | Ahorro vs A | Complejidad | Aislamiento |
|---|---:|---:|---:|---|---|
| A — Dedicated 24x7 | ~119–133 | ~440–492 | — | Baja | Alto |
| B — Dedicated Office Hours | **~71–75** | ~263–277 | ~44 | Media | Alto |
| C — Shared Infrastructure | NOT_AVAILABLE | — | — | — | — |
| D — Minimum Safe QA | ~71–75 | ~263–277 | ~44 | Media | Alto |

(No se incluye el gasto legacy de ~USD 400/mes, que es preexistente.)

## 17. Annual Cost Comparison

| Escenario | USD/año | PEN/año (ref.) |
|---|---:|---:|
| A — Dedicated 24x7 | ~1,428–1,596 | ~5,284–5,905 |
| B — Dedicated Office Hours | **~852–900** | ~3,152–3,330 |
| C — Shared | NOT_AVAILABLE | — |
| D — Minimum Safe QA | ~852–900 | ~3,152–3,330 |

Ahorro anual B vs A: **≈ USD 528–696 (≈ S/ 1,954–2,575)**.

## 18. Security vs Cost Analysis

| Optimización | Ahorro | Seguridad | Operación | Recomendación |
|---|---:|---|---|---|
| Office hours ECS/RDS | ~USD 44/mes | Sin cambio | Media | **Sí** |
| Diferir interface endpoints | ~USD 70/mes | Sin cambio | Baja | **Sí (aplicado)** |
| Retención logs 7 d | ~USD 1–3/mes | Baja | Baja | Opcional |
| Fargate Spot | ~USD 25/mes | Media | Media | Condicional |
| Eliminar NAT | ~USD 33/mes | **Degrada** | Alta | **No** |
| RDS público | ~USD 0 | **Crítico** | — | **Prohibido** |
| Secretos en env files | ~USD 5/mes | **Crítico** | — | **Prohibido** |
| `--no-sandbox` Chromium | ~USD 0 | **Crítico** | — | **Prohibido** |

## 19. Recommended QA Architecture

**Escenario B — Infraestructura dedicada con horario operativo.**

- VPC dedicada, ALB dedicado, NAT single, ECS Fargate 1 vCPU/2 GB, RDS PostgreSQL db.t4g.micro
  Single-AZ, S3 privado, ECR, Secrets Manager, CloudWatch (7–30 d).
- ECS y RDS con stop/start fuera de horario (L-V 08:00–18:00).
- NAT y ALB 24x7 (requisitos técnicos/seguridad).
- Sin interface endpoints (diferidos); S3 gateway endpoint.
- Chromium/sandbox sin cambios; validación Fargate pendiente.

Criterio: **LOWEST_REASONABLE_COST_WITHOUT_COMPROMISING_REQUIRED_SECURITY**.

## 20. Risks

- Chromium en Fargate sin validar.
- Office-hours requiere scheduler (no implementado).
- RDS stop limitado a 7 días (requiere gestión).
- PII en logs antes de producción.
- Migración de datos legacy fuera de alcance.
- CIDR corporativo no verificable.

## 21. Required Approvals

- Aprobar arquitectura QA **Escenario B** (dedicada + horario).
- Autorizar Fase 3D-6 (creación de infraestructura).
- Definir certificado ACM, backend Terraform y rol CI/OIDC.
- Definir responsables de carga de secretos.

## 22. Next Steps

1. Revisión humana de este análisis.
2. Aprobación del Escenario B y presupuesto (~USD 75/mes incremental).
3. Ajustar Terraform para office-hours (fase posterior).
4. Fase 3D-6 — QA Infrastructure Apply (con autorización explícita).

---

## Nota sobre el documento anterior

`docs/architecture/qa-architecture-and-costs.md` **no se modifica** en esta fase. Tras aprobar
una arquitectura deberá actualizarse para:
- reemplazar “costo razonable” por “Costo estimado de la arquitectura QA aislada 24x7”
  (USD ~119–133/mes) y compararla objetivamente con el Escenario B (~USD 75/mes);
- reflejar la decisión de horario operativo y el ahorro (~USD 44/mes).
