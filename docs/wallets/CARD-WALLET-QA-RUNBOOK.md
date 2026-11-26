# CARD-WALLET QA — Runbook de despliegue (Google Wallet real)

Fase: CARD-GOOGLE-WALLET-QA-DEPLOYMENT-05. Ámbito: **solo QA**, datos sintéticos,
Apple deshabilitado, sin publicación. Este runbook documenta el estado real y los
pasos exactos; **no contiene secretos**.

## 1. Arquitectura QA verificada (solo lectura)

| Recurso | Valor verificado |
| --- | --- |
| Cuenta AWS | `564914947461` (`sara-aws-cli`) |
| Región | `us-east-2` |
| EC2 QA | `i-095d15242588ec268` (`afiliaciones-qa-ec2`, `Environment=qa`, running) |
| URL | `https://afiliaciones-qa.iimp.org.pe` |
| ECR | `564914947461.dkr.ecr.us-east-2.amazonaws.com/afiliaciones-qa-app` |
| Deploy | GitHub Actions `qa-deploy.yml` → OIDC → SSM `AfiliacionesQaDeploy` |
| Runtime | EC2 t3.small, Docker Compose en `/opt/afiliaciones-qa`, PostgreSQL local + Caddy |
| Secretos | **SSM Parameter Store** `/afiliaciones/qa/*` (String/SecureString). No se usa Secrets Manager en QA |

Migraciones: imagen `migration` one-shot (`prisma migrate deploy`). **El workflow
`qa-deploy.yml` solo publica y despliega la imagen `app`; no ejecuta migraciones ni
provisiona worker.**

## 2. Credenciales y clase QA (evidencia real)

- Cuenta de servicio QA: `iimp-wallet-service-qa@iimp-digital-wallet.iam.gserviceaccount.com`.
- JSON QA: `C:\IIMP\secrets\google-wallet\qa\iimp-digital-wallet-dcf8c878376c.json`
  (fuera de htdocs; no versionar ni imprimir).
- Validación sanitizada: `type=service_account`, proyecto correcto, RS256 OK.
- Autenticación real QA: `OAuth OK`, `API OK`, `Issuer access OK`.
- Clase QA `3388000000023251742.iimp_membership_qa`: `CREATED` y luego reutilizada
  (GET 200, `Objects in class: 0`).

## 3. Aislamiento de ambientes (implementado en código)

| Aspecto | LOCAL | QA |
| --- | --- | --- |
| `GOOGLE_WALLET_CLASS_ID` | `...iimp_membership_local` | `...iimp_membership_qa` |
| `GOOGLE_WALLET_OBJECT_PREFIX` | `iimp_card_` (histórico) | `iimp_qa_card_` |
| Allowlist | vacía (sin restricción) | por prefijo/personId sintético |
| Simulación | Apple permitida local | bloqueada (`NODE_ENV=production`) |
| Apple Wallet | simulación | deshabilitado |

Controles: validación issuer↔class, prefijo de namespace, rechazo de objetos de
otra clase, allowlist en emisión y worker (`ALLOWLIST_BLOCKED` permanente).

## 4. Variables de entorno QA (contrato)

No secretas (String):

```env
CARD_GOOGLE_WALLET_ENABLED=true
CARD_GOOGLE_WALLET_MODE=REAL
CARD_APPLE_WALLET_ENABLED=false
CARD_WALLET_LOCAL_SIMULATION=false
CARD_WALLET_SYNC_ENABLED=true
GOOGLE_WALLET_ISSUER_ID=3388000000023251742
GOOGLE_WALLET_CLASS_ID=3388000000023251742.iimp_membership_qa
GOOGLE_WALLET_OBJECT_PREFIX=iimp_qa_card_
GOOGLE_WALLET_CLASS_AUTO_CREATE=false
CARD_WALLET_ALLOWED_ASSOCIATE_PREFIXES=QA-TEST-
# Alternativa: CARD_WALLET_ALLOWED_PERSON_IDS=<id_sintetico>
```

Secreta (SecureString): `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64` con el JSON QA
codificado en base64 (una sola línea, apto para env). El parser acepta también
`GOOGLE_WALLET_SERVICE_ACCOUNT_JSON` (inline) o `GOOGLE_WALLET_CREDENTIALS_FILE`
(archivo montado).

### Inyección SSM (verificar antes de aplicar)

El proyecto carga config desde `/afiliaciones/qa/*`. Nombres no secretos existentes
conservan el nombre exacto (`AUTH_URL`, `NEXT_PUBLIC_APP_URL`); los secretos usan
minúsculas con guiones. **Antes de crear parámetros**, leer en la instancia el
generador de env del contenedor (compose/`env_file`) para confirmar el mapeo
nombre→variable. Si el generador aplica `UPPER(hyphen→underscore)`, los nombres en
MAYÚSCULAS con guiones bajos se conservan.

Comandos propuestos (NO ejecutados en esta fase):

```bash
# Secreto (base64, sin exponer el JSON en la línea de comandos)
base64 -w0 C:/IIMP/secrets/google-wallet/qa/<archivo>.json > /tmp/gw-qa.b64
aws ssm put-parameter --region us-east-2 \
  --name /afiliaciones/qa/GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64 \
  --type SecureString --value file:///tmp/gw-qa.b64
shred -u /tmp/gw-qa.b64

# No secretos
for p in CARD_GOOGLE_WALLET_ENABLED=true CARD_GOOGLE_WALLET_MODE=REAL \
         CARD_APPLE_WALLET_ENABLED=false CARD_WALLET_LOCAL_SIMULATION=false \
         CARD_WALLET_SYNC_ENABLED=true GOOGLE_WALLET_ISSUER_ID=3388000000023251742 \
         GOOGLE_WALLET_CLASS_ID=3388000000023251742.iimp_membership_qa \
         GOOGLE_WALLET_OBJECT_PREFIX=iimp_qa_card_ \
         GOOGLE_WALLET_CLASS_AUTO_CREATE=false \
         CARD_WALLET_ALLOWED_ASSOCIATE_PREFIXES=QA-TEST-; do
  name="/afiliaciones/qa/${p%%=*}"; value="${p#*=}"
  aws ssm put-parameter --region us-east-2 --name "$name" --type String --value "$value" --overwrite
done
```

IAM/Terraform: agregar el nombre del secreto a
`infra/terraform/environments/qa/variables.tf` → `secure_parameter_names`
(p. ej. `"GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64"`) y aplicar el plan QA para que el
rol EC2 pueda leerlo. Terraform solo gestiona ARNs; **no** el valor. No aplicar
hasta confirmar el mapeo env y tener la migración/worker listos.

## 5. Secuencia de despliegue (pendiente / bloqueada)

1. Commit acotado a Wallet + rama `feature/card-google-wallet-qa` → PR a `qa`
   (respetar protecciones/aprobaciones).
2. Quality gates (`qa-deploy.yml`: fmt/validate, secret scan, `npm run check`, build).
3. Build/push imagen `app` (y **también** `wallet-sync` si se agrega worker).
4. **Backup QA** (EBS snapshot o `pg_dump` dentro de la instancia) — obligatorio.
5. **Migraciones one-shot** con la imagen `migration` (`prisma migrate deploy`).
6. Deploy app por SSM (`AfiliacionesQaDeploy`) con health checks y rollback.
7. Provisionar/renovar worker persistente (ver §6).
8. Smoke tests HTTPS + E2E QA + validación Google.

### Bloqueos actuales (no simular éxito)

- `origin/qa` **no contiene** el módulo Wallet.
- El pipeline QA no ejecuta migraciones ni worker.
- El mapeo SSM→env del contenedor no está versionado en el repo.
- No existe servicio `wallet-sync` persistente en la instancia.
- No hay fixture sintético QA ni acceso directo a la base QA (PostgreSQL local en
  la instancia, CIDR restringido).
- Instalación física Android pendiente.

## 6. Worker persistente QA (propuesta)

Sin Redis ni servicios externos. Opción recomendada: servicio compose adicional con
la imagen `wallet-sync`, reinicio automático y el bucle existente:

```yaml
wallet-sync:
  image: <REGISTRY>/afiliaciones-qa-app:<tag-inmutable>
  command: ["npx", "tsx", "scripts/process-card-wallet-jobs-watch.ts"]
  env_file: .env
  restart: unless-stopped
  depends_on: [app]
```

El outbox (`card_wallet_sync_jobs`) usa claim/lease atómico, así que múltiples
réplicas no duplican trabajo. Alternativa: timer systemd cada N segundos invocando
`npm run wallet:sync` (one-shot). Logs a CloudWatch/`docker logs` sin JWT ni datos
sensibles.

## 7. QR HTTPS QA

`AUTH_URL`/`NEXT_PUBLIC_APP_URL` ya son `https://afiliaciones-qa.iimp.org.pe`, por
lo que `getAppBaseUrl` genera `https://afiliaciones-qa.iimp.org.pe/verificar-carnet/<token>`.
Verificar certificado válido, token opaco, estado vigente/revocado y reemisión. No
se exponen DNI/correo/teléfono en la verificación pública.

## 8. Prueba física Android (pendiente)

1. Chrome Android → `https://afiliaciones-qa.iimp.org.pe/login`.
2. Asociado sintético QA (allowlist).
3. Mi cuenta → Carné Virtual.
4. **Agregar a Google Wallet** → cuenta Google autorizada (modo demostración).
5. Confirmar y abrir Google Wallet; verificar campos y QR.
6. Revocar desde administración → verificar desactivación; reemitir → verificar.

La cuenta de servicio no es cuenta Android. El permiso Desarrollador habilita API,
no la cuenta personal. Posible etiqueta **TEST ONLY** por modo demostración. No
solicitar publicación.

## 9. Rollback

- App: `AfiliacionesQaDeploy` ya revierte a la imagen previa si el health falla.
- Config: revertir parámetros SSM a su versión anterior.
- Worker: detener el servicio `wallet-sync` (deshabilita nuevas emisiones/sync).
- DB: no revertir migraciones aditivas salvo necesidad; restaurar backup QA solo si
  hay corrupción demostrada.
- Google: si hace falta, limitar acciones a la clase/objetos QA autorizados. No
  borrar clases/objetos automáticamente.

## 10. Seguridad

- Secretos solo en SSM SecureString; nunca en Terraform/Git/imagen/state/logs.
- `.env` local ignorado por Git; `security:secrets` sin hallazgos.
- Roles IAM mínimos: GitHub OIDC solo ECR QA + SSM del documento/instancia QA; rol
  EC2 lee solo parámetros de su namespace.
- No reutilizar credenciales LOCAL. Preservar LOCAL/PROD.

## 11. Estado de fases (actualizado tras ejecución)

| Fase | Estado |
| --- | --- |
| Credenciales QA / OAuth / Issuer | COMPLETED |
| Generic Class QA | COMPLETED |
| Aislamiento código + pruebas | COMPLETED |
| Secreto SSM QA | COMPLETED |
| Backup PostgreSQL QA | COMPLETED |
| Migraciones QA | NOT_APPLICABLE (ya aplicadas y verificadas) |
| Deploy app QA | COMPLETED |
| Worker persistente QA | COMPLETED (systemd timer) |
| Fixture sintético QA | COMPLETED (personId 13286) |
| Generic Object QA / JWT | COMPLETED |
| QR HTTPS QA | COMPLETED |
| Revocación / reemisión QA | COMPLETED |
| Apple deshabilitado | COMPLETED |
| Instalación física Android | PENDING |

## 12. Despliegue ejecutado — resultados reales (2026-11-25)

- Rama QA: `feature/card-google-wallet-qa-deploy` (base `996eabe` + Wallet).
- Commit desplegado: `56bbf01` (código Wallet `ab771ab`; imagen idéntica).
- Workflow `qa-deploy.yml` run **45709542656**: SUCCESS.
- Imagen app: `qa-56bbf01…-45709542656-1`, digest `sha256:76e7a4d9…`.
- Imagen worker: `qa-wallet-sync-56bbf01…-45709542656-1`, digest `sha256:ef12864c…`.
- Backup QA: `/data/backups/wallet-qa-pre-20261125T205022Z.dump` (12.3 MB,
  sha256 `929783a9…`, `pg_restore --list` verificado).
- Migraciones Wallet ya aplicadas; no se reaplicaron.
- SSM QA: parámetros `CARD_GOOGLE_WALLET_*`, `CARD_APPLE_WALLET_ENABLED=false`,
  `CARD_WALLET_ALLOWED_PERSON_IDS=13286`, `GOOGLE_WALLET_OBJECT_PREFIX=iimp_qa_card_`
  y `GOOGLE_WALLET_SERVICE_ACCOUNT_JSON_B64` (SecureString, base64). Valores no
  versionados.
- Fixture: `wallet.qa.activo@iimp.org.pe` (personId 13286, código `QA-TEST-0001`,
  carné `ISSUED`).
- Emisión real: objeto `3388000000023251742.iimp_qa_card_qacard…`, enlace
  `pay.google.com`, `created=true`; objeto `active`, barcode presente, 1 objeto.
- Worker: `afiliaciones-qa-wallet-sync.timer` enabled/active; ciclo real
  (`claimed`/`completed`) conectado a Google QA.
- Revocación: pase `REVOKED`, job `COMPLETED`, objeto Google `inactive`, QR
  `revocada`.
- Reemisión: pase `SYNCED`, job `COMPLETED`, objeto `active`, QR válido.
- Apple: sin botón ni simulación en QA (`NODE_ENV=production`, flag false).
- LOCAL y PROD sin modificaciones.
- Nota: logins repetidos de Puppeteer pueden chocar con el rate-limit por IP de
  QA (control existente), no con Wallet.
- Pendiente: instalación física en Android (el responsable debe usar el fixture y
  la contraseña temporal entregada por canal seguro).
