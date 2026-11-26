# Configuracion AWS QA para Apple Wallet (plan; NO aplicar aun)

## Mecanismo existente en QA
- QA = EC2 + Docker Compose (sin ECS/RDS/Secrets Manager).
- Configuracion via **SSM Parameter Store** `/afiliaciones/qa/*` (String y
  SecureString) materializada en `/opt/afiliaciones-qa/app.env`.
- El contenedor app y el worker leen ese `env_file`. La app actualiza su imagen
  via SSM `AfiliacionesQaDeploy`; el worker via el script alineado (ver
  `CARD-WALLET-WORKER-ALIGNMENT.md`).
- `NODE_ENV=production` en el contenedor => `getWalletProviderMode` fuerza REAL;
  el control efectivo de visibilidad es `CARD_APPLE_WALLET_ENABLED`.

## Variables que consume la implementacion Apple (exactas)
No secretas (String):
```
APPLE_WALLET_TEAM_ID=3U46BQMK52
APPLE_WALLET_PASS_TYPE_ID=pass.pe.org.iimp.membership.qa
APPLE_WALLET_ORGANIZATION_NAME="Instituto de Ingenieros de Minas del Peru"
APPLE_WALLET_UPDATES_ENABLED=true
APPLE_WALLET_WEB_SERVICE_URL=https://afiliaciones-qa.iimp.org.pe/api/afiliaciones/carnet/wallet/apple
APPLE_WALLET_OPENSSL_PATH=/usr/bin/openssl
CARD_APPLE_WALLET_ENABLED=false          # inicialmente deshabilitado
CARD_APPLE_WALLET_MODE=REAL              # informativo; prod fuerza REAL
CARD_WALLET_PASS_AUTH_SECRET_VERSION=1
```
Secretas (SecureString):
```
APPLE_WALLET_PASS_CERT_B64=              # PEM del certificado QA en base64
APPLE_WALLET_PASS_KEY_B64=               # PEM de la clave privada QA en base64
APPLE_WALLET_PASS_KEY_PASSPHRASE=        # passphrase de la clave QA
CARD_WALLET_PASS_AUTH_SECRET=            # >= 32 chars, independiente
# Opcional (push APNs):
APPLE_WALLET_APNS_KEY_ID=
APPLE_WALLET_APNS_TEAM_ID=3U46BQMK52
APPLE_WALLET_APNS_KEY_B64=               # .p8 APNs Auth Key (NO la clave del pase)
```
Publica (puede ser String): `APPLE_WALLET_WWDR_CERT_B64` (WWDR G4).

> La implementacion soporta `_B64`, `_PEM` y `_FILE`. En QA Linux se recomienda
> **`_B64`** (PEM en base64) por simplicidad y por seguir el patron ya usado para
> Google. **No** usar rutas `C:/...` en el contenedor. Alternativa: montar
> archivos read-only 0400 y usar `_FILE` con rutas `/run/secrets/...`.

## Reglas de seguridad
- Secretos solo en SSM SecureString; nunca en Terraform state, Dockerfile,
  imagen, GitHub Actions logs ni repositorio.
- La passphrase QA no se reutiliza de LOCAL.
- `CARD_WALLET_PASS_AUTH_SECRET`: generar con `openssl rand -base64 48` (no
  imprimir). Independiente de otros secretos; usar versionado para rotacion.
- Allowlist de prueba: mantener `CARD_WALLET_ALLOWED_PERSON_IDS=13287,13288,13289`
  (QA-TEST-0004 = 13289). No ampliar sin autorizacion.
- No exponer certificados/claves en `/api`, logs, ni respuestas.

## Plan de aplicacion (cuando se autorice)
1. Crear credenciales QA (ver `CARD-WALLET-QA-APPLE-CREDENTIALS.md`).
2. Codificar a base64 (una linea) sin imprimir contenido.
3. `aws ssm put-parameter` (String/SecureString) con `--overwrite` para los
   nombres exactos de arriba.
4. Regenerar `/opt/afiliaciones-qa/app.env` con el mecanismo aprobado y
   reiniciar la app (deploy normal). Mantener `CARD_APPLE_WALLET_ENABLED=false`.
5. Verificar que `getAppleWalletConfig()` resuelve (sin exponer valores) y que
   Google Wallet/pagos siguen funcionando.
6. Tras instalacion fisica y autorizacion: `CARD_APPLE_WALLET_ENABLED=true` solo
   para asociados de la allowlist; revertir si falla.
7. APNs (opcional): crear APNs Auth Key `.p8` y cargar `APPLE_WALLET_APNS_KEY_*`.

No modificar AWS en esta fase.
