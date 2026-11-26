# Apple Wallet REAL — desarrollo sobre la base QA consolidada

Esta rama parte de `origin/qa` consolidado (Wallet + pagos) para continuar la
implementacion de Apple Wallet REAL sin reintroducir la divergencia que causo la
regresion de QA (ver `CARD-WALLET-QA-DEPLOY-GUARD.md`).

## Capacidades Apple incorporadas
- Credenciales desde archivo (`*_FILE`), PEM inline (`*_PEM`) o base64 (`*_B64`).
  Precedencia: `_B64` > `_PEM` > `_FILE`. Fuentes con contenido distinto se
  rechazan con `ConfigurationError` (solo nombra variables, nunca valores).
- Clave privada PKCS#8 cifrada mediante `-passin env:` (nunca en argumentos/logs).
- Ruta de OpenSSL configurable (`APPLE_WALLET_OPENSSL_PATH`), soporta espacios.
- Capacidad de actualizaciones separada (`APPLE_WALLET_UPDATES_ENABLED`):
  - `true` (default QA/PROD): exige HTTPS + secreto HMAC y usa PassKit/APNs.
  - `false` (LOCAL): pase estatico sin `webServiceURL`/`authenticationToken`/APNs.
- Variables nuevas: `APPLE_WALLET_PASS_CERT_FILE`, `APPLE_WALLET_PASS_KEY_FILE`,
  `APPLE_WALLET_WWDR_CERT_FILE`, `APPLE_WALLET_PASS_KEY_PASSPHRASE`,
  `APPLE_WALLET_OPENSSL_PATH`, `APPLE_WALLET_UPDATES_ENABLED`.

## Seguridad
- Certificados, claves y passphrase permanecen fuera del repositorio y no se
  versionan. `.env` local no se commitea; `.env.example` solo documenta nombres.
- No habilitar Apple REAL en QA hasta validar la instalacion en un iPhone real.

## Procedimiento de prueba local
1. Completar `APPLE_WALLET_PASS_KEY_PASSPHRASE` manualmente en `.env` (no por chat).
2. `APPLE_WALLET_UPDATES_ENABLED=false` para pase estatico LOCAL.
3. `npm run wallet:apple:static` genera un `.pkpass` sintetico en `.tmp/apple-wallet/`.
4. Instalar en iPhone (AirDrop/Correo) y verificar render + QR.

Apple Wallet no se considera funcional hasta la prueba fisica en dispositivo.
