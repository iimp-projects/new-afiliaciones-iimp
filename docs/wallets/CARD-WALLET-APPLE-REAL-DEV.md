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

## Que archivo .env usa el script
`wallet:apple:static` usa `dotenv/config`, que carga `.env` desde el directorio
de trabajo actual; si no existe, puede apuntarse con `DOTENV_CONFIG_PATH`. En este
worktree **no** hay `.env` (esta gitignored). Usar el `.env` del repo principal
por ruta, sin copiar secretos al worktree:

```powershell
Set-Location 'C:\Users\maxic\AppData\Local\Temp\opencode\afiliaciones-apple-wallet-real-20261126'
$env:DOTENV_CONFIG_PATH='C:\xampp\htdocs\afiliaciones-desarrollo\.env'
$env:APPLE_WALLET_PASS_KEY_PASSPHRASE = Read-Host -AsSecureString | ConvertFrom-SecureString   # opcional; ver nota
npm run wallet:apple:static
```
> En PowerShell 5.1 `ConvertFrom-SecureString` devuelve texto cifrado, no la
> passphrase en claro. La forma recomendada es que el operador exporte la variable
> en su sesion con el metodo aprobado de su entorno; no se documenta ni imprime la
> passphrase aqui. Alternativa: ejecutar el script desde el repo principal, donde
> ya existe `.env`, una vez integrada la rama.

Apple Wallet no se considera funcional hasta la prueba fisica en dispositivo.
