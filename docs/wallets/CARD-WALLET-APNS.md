# Apple APNs para actualizacion de pases — auditoria y correccion

## Fuentes oficiales consultadas
- Apple Developer — *Adding a Web Service to Update Passes* (WalletPasses).
- Apple Developer — *Establishing a token-based connection to APNs* (UserNotifications).

Citas relevantes de la doc de Wallet:
> "The notification uses the same certificate and private key that the creator of
> the pass used to sign the original, the push token registered by the device,
> and an empty JSON dictionary for the payload."
> "A push notification for a pass update works only in the production environment."

## Diagnostico
La implementacion original usaba **token-based APNs (JWT ES256 con `.p8`)**. Ese
mecanismo es valido para APNs en general, pero la documentacion **especifica de
Wallet** indica autenticarse con **el mismo certificado y clave privada del Pass
Type ID** que firma el pase. Por tanto, para Wallet se adopta la auth por
**certificado del pase** como mecanismo principal.

## Correccion (cambio minimo)
`ApplePushService` ahora soporta y **prefiere** auth por certificado:
- `Http2ApplePushTransport` abre `connect("https://api.push.apple.com", { cert, key, passphrase })`
  (client certificate TLS) cuando recibe `tls`.
- Headers: `apns-topic = <Pass Type ID>`, `apns-push-type: background`,
  `apns-priority: 5`, `content-length: 0` (payload vacio). Sin `authorization`.
- `CardWalletService.makePush` construye el push con `certificatePem`,
  `privateKeyPem` y `keyPassphrase` del Pass Type ID (mismos del `.pkpass`).
- Se conserva el modo token `.p8` como **fallback** (si no hay certificado),
  cacheando el JWT 50 min (APNs exige refresco entre 20 y 60 min; >1h => 403
  `ExpiredProviderToken`).
- 410 => `unregistered` (se elimina el registro); otros errores => `failed`
  (no rompe la sincronizacion institucional). Timeout 10 s.

## Reglas
- Endpoint de **produccion** `api.push.apple.com` para pases Wallet (no sandbox).
- `apns-topic` = Pass Type ID: aislamiento QA/LOCAL/PROD por topic.
- No usar la clave `.p8` de otra cuenta ni reutilizar credenciales LOCAL.
- La clave privada del pase puede estar cifrada: se usa `APPLE_WALLET_PASS_KEY_PASSPHRASE`.
- El `.p8` (si se usa fallback) es un **APNs Auth Key**, no la clave del pase.

## Tests (sin llamadas reales)
- `ApplePushService.test.ts`: certificado preferido (sin JWT), fallback token
  ES256, cache, token vacio, `unregistered`.
- `ApplePushTransport.test.ts`: HTTP/2, path `/3/device/<token>`, headers,
  client-cert TLS, 410 y otros estados.
