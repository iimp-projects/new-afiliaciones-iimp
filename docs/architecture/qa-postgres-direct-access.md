# QA — Acceso directo a PostgreSQL (pgAdmin)

> **Fase:** 3D-7.3 · **Fecha:** 2026-09-21 · **Ámbito:** QA `afiliaciones-qa.iimp.org.pe`
> **Decisión exclusiva de QA.** Producción y legacy no se tocan.
> **Sin secretos:** no incluye password, `DATABASE_URL` ni tokens.

---

## 1. Decisión

Habilitar acceso directo desde pgAdmin a PostgreSQL QA por TCP, con el Security Group como
control principal, restringido al pool NAT del operador:

- EC2 QA: `i-095d15242588ec268` · EIP `3.129.231.111`
- PostgreSQL: contenedor `afiliaciones-qa-postgres-1`, puerto `5432`
- CIDR autorizado: **`38.236.105.0/24`** (pool NAT variable; reemplaza la exigencia previa de `/32`)
- Nunca `0.0.0.0/0` ni `::/0`.

## 2. Motivo del /24

La conexión del operador no usa una IP pública estable: el egress es un pool dentro de
`38.236.105.0/24` (observadas `.84`, `.164`, `.54`, `.38`, `.240`, `.34`, `.100`). Un `/32` sería
no determinista. El máximo autorizado es exactamente `/24`.

## 3. Arquitectura

```
PC → pool NAT 38.236.105.0/24 → Internet → SG (TCP/5432 solo 38.236.105.0/24)
   → EC2 QA 3.129.231.111 → Docker postgres:16 → DB afiliaciones
```

## 4. Configuración

- **Docker Compose** (`/opt/afiliaciones-qa/docker-compose.yml`): el servicio `postgres` publica
  `ports: ["5432:5432"]`. Solo ese servicio; `app:3000` y el daemon Docker no se publican.
- **PostgreSQL**: `listen_addresses='*'`, `port=5432`, `password_encryption=scram-sha-256`,
  `pg_hba.conf` con `host all all all scram-sha-256` (conexiones remotas exigen password; sin trust).
- **Security Group** `sg-0e12b78dad457272e`: regla inbound TCP 5432 desde `38.236.105.0/24`
  (descripción `QA PostgreSQL pgAdmin restricted NAT pool`). Reglas 80/443 existentes intactas.
- **Terraform**: el SG es administrado por `module.ec2`. Se parametrizó con la variable
  `qa_postgres_allowed_cidr` (default `38.236.105.0/24`) y el recurso
  `aws_vpc_security_group_ingress_rule.postgres_admin` (se deshabilita con CIDR vacío).
  Cambiar el CIDR = editar `qa_postgres_allowed_cidr` y `terraform apply`.

## 5. pgAdmin

| Campo | Valor |
|---|---|
| Name | Afiliaciones QA |
| Host name/address | `3.129.231.111` |
| Port | `5432` |
| Maintenance database | `afiliaciones` |
| Username | `afiliaciones` |
| Password | obtener de SSM (ver §6) |
| SSL mode | `disable` (PostgreSQL QA no tiene TLS configurado) |

## 6. Obtener el password (read-only)

```bash
aws ssm get-parameter --name /afiliaciones/qa/db-password --with-decryption --region us-east-2 --query Parameter.Value --output text
```

## 7. Cambiar el CIDR autorizado

1. Actualizar `qa_postgres_allowed_cidr` (p. ej. a `X.X.X.X/32`) y `terraform apply`, **o**
2. revocar la regla actual y autorizar la nueva:
   ```bash
   aws ec2 revoke-security-group-ingress --group-id sg-0e12b78dad457272e --region us-east-2 \
     --protocol tcp --port 5432 --cidr 38.236.105.0/24
   aws ec2 authorize-security-group-ingress --group-id sg-0e12b78dad457272e --region us-east-2 \
     --ip-permissions 'IpProtocol=tcp,FromPort=5432,ToPort=5432,IpRanges=[{CidrIp=IP_NUEVA,Description="QA PostgreSQL pgAdmin"}]'
   ```

## 8. Revocación / rollback completo

1. Revocar TCP/5432:
   `aws ec2 revoke-security-group-ingress --group-id sg-0e12b78dad457272e --region us-east-2 --protocol tcp --port 5432 --cidr 38.236.105.0/24`
2. Quitar `ports: ["5432:5432"]` del servicio `postgres` en `docker-compose.yml`.
3. `docker compose up -d --force-recreate postgres` (los datos persisten en `/data/postgres`).
4. Verificar `docker port afiliaciones-qa-postgres-1` vacío y health 200/200.

## 9. Riesgo explícito

- El `/24` es más amplio que un `/32`: cualquier host del pool NAT (compartido) que alcance
  `3.129.231.111:5432` podría intentar autenticarse. La autenticación **SCRAM** sigue siendo
  obligatoria, por lo que sin la credencial no hay acceso.
- **Recomendación:** volver a `/32` o usar SSM port-forwarding cuando se disponga de una IP estable.

## 10. Reconciliación Terraform

La regla se aplicó por CLI porque Terraform no está disponible en la estación. Antes del próximo
`terraform apply`, importar la regla para evitar duplicado:

```bash
terraform import 'module.ec2.aws_vpc_security_group_ingress_rule.postgres_admin["38.236.105.0/24"]' \
  sg-0e12b78dad457272e_sgr-09b5e82a5676cc6e6
```

## 11. Persistencia

Validado tras `docker compose up --force-recreate postgres` y tras **EC2 stop/start**:
`/data` montado, contenedores arriba, `5432` republicado, DB `afiliaciones` disponible,
SG conserva `38.236.105.0/24`, health `live/ready = 200`.
