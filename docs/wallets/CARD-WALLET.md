# Billeteras digitales del Carné Virtual IIMP

Documento técnico de la integración **CARD-WALLET-INTEGRATION-01**. Complementa a
`docs/ARCHITECTURE.md`, `docs/BUSINESS_RULES.md` y `docs/DATABASE.md`.

## 1. Resultado de la retirada PWA

| Verificación | Resultado |
| --- | --- |
| Código PWA en el repositorio | **NOT_APPLICABLE**: no se creó manifest, Service Worker, hook de instalación, pantalla offline ni endpoints PWA. |
| Dependencias PWA | No se instaló ninguna dependencia. `package.json` y `package-lock.json` no cambian. |
| Migraciones PWA | No existen. |
| Variables de entorno PWA | No existen. |
| Service Workers registrados | No se registró ninguno desde este repositorio. |
| Ramas/commits PWA | No se crearon commits. La única actividad previa fue auditoría de solo lectura. |

La búsqueda de `manifest.webmanifest`, `beforeinstallprompt`, `appinstalled`,
`serviceWorker`, `AFILIACIONES_PWA`, `mi-carne` y `sw.js` no devuelve coincidencias
en el código de la aplicación. No hay nada que desregistrar ni caché PWA que purgar.

> Si en el futuro se detectara una PWA desplegada por otro medio, debe publicarse
> temporalmente un `sw.js` que se auto-desregistre y elimine únicamente sus propias
> cachés. No se debe limpiar todo el almacenamiento del dominio.

## 2. Principio de diseño

**Un carné institucional, múltiples formatos de presentación.**

| Formato | Fuente |
| --- | --- |
| Web | `modules/afiliaciones/carnet/Views/CardView.tsx` |
| PDF / impresión | `modules/afiliaciones/carnet/Services/cardPdf.ts` |
| Google Wallet | `modules/afiliaciones/carnet/wallet/Google` |
| Apple Wallet | `modules/afiliaciones/carnet/wallet/Apple` |

Todos dependen de `AssociateCard`, de `resolveCardData()` y del verificador QR
existente. La integración Wallet **no crea, emite ni regenera carnés**.

## 3. Arquitectura implementada

```text
modules/afiliaciones/carnet/wallet/
  Api/walletHttp.ts              utilidades HTTP, errores y resolución del titular
  Types/wallet.ts                DTOs, códigos de error, snapshot del carné
  Services/
    walletIdentity.ts            IDs estables, token HMAC de PassKit, URL de verificación
    walletState.ts               proyección del estado institucional existente
    walletAudit.ts               auditoría sin datos sensibles
    CardWalletService.ts         coordinador (Google/Apple, estado y sincronización)
    ApplePassKitService.ts       protocolo PassKit de actualización de pases
  Repositories/CardWalletRepository.ts
  Google/GoogleWalletClient.ts   OAuth, clase/objeto Generic, JWT de incorporación
  Apple/ApplePassBuilder.ts      pass.json, manifest, .pkpass
  Apple/OpenSslPassSigner.ts     firma PKCS#7 con openssl del runtime
  Apple/ApplePushService.ts      push silencioso APNs (HTTP/2)
  Views/WalletButtons.tsx        portal del asociado
  Views/WalletStatusPanel.tsx    panel administrativo
  Tests/                         pruebas unitarias con proveedores simulados

app/api/afiliaciones/carnet/wallet/
  google/route.ts                POST: genera enlace "Add to Google Wallet"
  apple/route.ts                 GET: entrega .pkpass firmado
  apple/v1/...                   protocolo PassKit (registro, desregistro, updates, pase, log)
app/api/afiliaciones/carnet/[personId]/wallet/
  route.ts                       GET: estado administrativo (sin secretos)
  sync/route.ts                  POST: reintento de sincronización (permiso revoke:cards)
```

Puntos de integración institucional:

- Emisión (`/api/afiliaciones/carnet/me` y `/issue`), regeneración y revocación
  ejecutan `after(() => CardWalletService.syncSafely(...))`. Un fallo del proveedor
  **no revierte** la operación institucional.
- El QR del pase es la URL `/verificar-carnet/<token>` ya existente. Regenerar el
  carné cambia el token y la sincronización actualiza el pase. Revocar invalida el QR
  de inmediato, aunque falle Google o Apple.

## 4. Modelo de datos

Migración aditiva: `prisma/migrations/20261124180000_add_card_wallet_passes/migration.sql`.
**No se ha aplicado** desde este entorno.

- `card_wallet_passes`: relación 1:1 por `card_id` + proveedor; guarda el
  identificador externo, estado de sincronización, versión y error controlado.
- `apple_pass_registrations`: dispositivos y push tokens del protocolo PassKit.
- `card_wallet_sync_jobs`: outbox persistente por `wallet_pass_id` (uno por pase),
  con operación, estado, intentos, backoff, lease y errores controlados.
  Migración: `prisma/migrations/20261124190000_add_card_wallet_sync_jobs/`.

El token de autenticación del pase Apple **no se persiste**: se deriva con
HMAC-SHA256 de un secreto versionado y el serial estable del pase, y se verifica
en tiempo constante. No se guardan DNI, correo, teléfono ni fotos.

## 5. Feature flags

```env
CARD_GOOGLE_WALLET_ENABLED=false
CARD_APPLE_WALLET_ENABLED=false
```

- Independientes de `CARD_ISSUANCE_ENABLED`.
- Deshabilitar un proveedor impide **nuevas** vinculaciones, pero la sincronización
  y la revocación de pases existentes siguen ejecutándose.
- Ocultar la funcionalidad en el servidor no elimina pases ya instalados en los
  celulares. La verificación del QR sigue siendo la fuente de verdad.

## 6. Configuración

Nunca usar `NEXT_PUBLIC_*` para secretos. Inyectar desde Secrets Manager/SSM como el
resto de credenciales del ECS task (no se añadió un SDK nuevo; el contrato es el
mismo `process.env` server-side que ya usa `lib/config/env.ts`).

### Google Wallet

```env
GOOGLE_WALLET_ISSUER_ID=
GOOGLE_WALLET_CLASS_ID=            # sufijo o classId completo
GOOGLE_WALLET_SERVICE_ACCOUNT_JSON # JSON de cuenta de servicio (o *_B64)
GOOGLE_WALLET_CLASS_AUTO_CREATE=true
```

El `classId` se normaliza a `<issuerId>.<sufijo>` si no incluye punto. El objeto usa
`<issuerId>.iimp_card_<cardId>` (estable, sin datos personales). La clase se crea
idempotentemente con `reviewStatus: UNDER_REVIEW`; requiere aprobación del emisor en
Google Wallet antes de producción.

### Apple Wallet

```env
APPLE_WALLET_TEAM_ID=
APPLE_WALLET_PASS_TYPE_ID=
APPLE_WALLET_WEB_SERVICE_URL=https://<host>/api/afiliaciones/carnet/wallet/apple
APPLE_WALLET_PASS_CERT_B64=        # certificado del pase (PEM en base64)
APPLE_WALLET_PASS_KEY_B64=         # clave privada (PEM en base64)
APPLE_WALLET_WWDR_CERT_B64=        # Apple WWDR G4 (PEM en base64)
CARD_WALLET_PASS_AUTH_SECRET=      # >= 32 caracteres, exclusivo de Wallet
CARD_WALLET_PASS_AUTH_SECRET_VERSION=1
CARD_WALLET_PASS_AUTH_SECRET_PREVIOUS=      # opcional durante rotación
CARD_WALLET_PASS_AUTH_SECRET_PREVIOUS_VERSION=  # opcional
APPLE_WALLET_ORGANIZATION_NAME=Instituto de Ingenieros de Minas del Perú
# Opcional para APNs:
APPLE_WALLET_APNS_KEY_ID=
APPLE_WALLET_APNS_TEAM_ID=
APPLE_WALLET_APNS_KEY_B64=         # llave .p8 en base64
```

### Procesador de sincronización

```env
CARD_WALLET_SYNC_ENABLED=false
CARD_WALLET_SYNC_BATCH_SIZE=25
CARD_WALLET_SYNC_MAX_ATTEMPTS=8
CARD_WALLET_SYNC_LEASE_SECONDS=120
CARD_WALLET_SYNC_INTERVAL_SECONDS=60
```

El scheduler debe invocar el contenedor one-shot `wallet-sync`
(`npx tsx scripts/process-card-wallet-jobs.ts`) con la periodicidad configurada.
Los límites se validan con rangos acotados; valores inválidos usan el valor por
defecto. `CARD_WALLET_SYNC_ENABLED=false` detiene el procesamiento automático, pero
los trabajos quedan persistidos y el reintento manual sigue disponible.

La firma PKCS#7 se ejecuta con el binario `openssl` del contenedor de producción
(`node:22-bookworm-slim` ya lo incluye). En Windows local sin `openssl` la generación
de `.pkpass` responde con error controlado; las pruebas unitarias usan un firmador
simulado.

## 7. Seguridad

- Endpoints del asociado: sesión Auth.js + `requireAffiliate()`; el `personId` se
  resuelve desde la cuenta autenticada, nunca desde el cuerpo o query.
- Endpoints administrativos: `read:cards` / `revoke:cards` existentes.
- PassKit: `Authorization: ApplePass <token>` derivado; token inválido → 401.
- POST mutantes: validación de `Origin` contra la URL pública.
- Rate limiting en memoria por usuario/dispositivo (complementar con WAF/CloudFront).
- Respuestas autenticadas: `Cache-Control: private, no-store`.
- Auditoría: `CARD_WALLET_GOOGLE_LINK_READY`, `CARD_WALLET_APPLE_PASS_GENERATED`,
  `CARD_WALLET_SYNC_SUCCEEDED/FAILED`, `CARD_WALLET_PASSKIT_REGISTERED/UNREGISTERED/AUTH_FAILED`.
  Sin tokens, URLs firmadas, certificados ni identificadores de dispositivo.
- El token de PassKit no autoriza el portal; es exclusivo del protocolo de pases.

## 8. Sincronización persistente y revocación

1. Emisión/regeneración/revocación y la creación/actualización del trabajo de
   sincronización se ejecutan en **la misma transacción PostgreSQL**.
2. El worklist es `card_wallet_sync_jobs` (outbox). Un solo registro por pase
   (`wallet_pass_id` único) serializa los cambios; una nueva modificación reutiliza
   el registro y eleva `target_version`.
3. El procesador reclama lotes con `FOR UPDATE SKIP LOCKED`, lease y `locked_by`.
   Los trabajos abandonados vuelven a `RETRY` al vencer el lease.
4. Antes de llamar al proveedor se **relee el estado institucional vigente**. Un
   trabajo antiguo no puede reactivar un carné revocado.
5. Si el pase cambia mientras está `PROCESSING`, `complete()` detecta el `updated_at`
   modificado y lo devuelve a `PENDING` (estado `requeued`), sin perder la novedad.
6. Google: `PATCH` del Generic Object; revocado → `state: INACTIVE`. Apple: el
   próximo `.pkpass` incluye `voided: true`; APNs solicita la actualización.
7. Fallos transitorios: backoff exponencial con jitter y máximo de intentos.
   Fallos permanentes (configuración/carné inexistente) pasan a `FAILED`.
8. Reconciliación: cada ciclo encola pases con `last_synced_at` mayor a 24 h o
   carnés revocados cuyo pase aún no figura revocado. Esto cubre cambios de
   elegibilidad provenientes de cuotas/perfil sin acoplar cada módulo.
9. `after()` solo acelera el primer procesamiento; la persistencia garantiza que el
   scheduler retome el trabajo si el proceso se reinicia.
10. La revocación institucional es inmediata en el verificador QR aunque falle el
    proveedor. Un pase emitido no equivale a pase instalado: solo PassKit confirma
    registro en Apple; Google no informa instalación al portal.

## 9. Runbook QA

1. **Orden obligatorio**: aplicar primero las migraciones
   (`20261124180000_add_card_wallet_passes` y
   `20261124190000_add_card_wallet_sync_jobs`) con el pipeline
   (`prisma migrate deploy`). El código nuevo encola trabajos en la misma
   transacción que revoca/regenera; si la tabla no existe, la operación falla.
   No usar `db push` ni `migrate reset`.
2. Desplegar con flags de proveedor y `CARD_WALLET_SYNC_ENABLED=false`.
3. Configurar credenciales de QA y ejecutar el contenedor `wallet-sync` una vez
   con `CARD_WALLET_SYNC_ENABLED=true` para validar el procesador.
4. Activar `CARD_GOOGLE_WALLET_ENABLED=true` y/o `CARD_APPLE_WALLET_ENABLED=true`.
5. Verificar:
   - carné emitido, revocado y regenerado;
   - QR válido/revocado en `/verificar-carnet` inmediatamente tras revocar;
   - trabajo creado en `card_wallet_sync_jobs` y estado final;
   - enlace Google (apertura de Wallet);
   - descarga `.pkpass`, registro PassKit y `304` con `If-Modified-Since`;
   - panel administrativo: operación, estado del trabajo, intentos, próximo
     reintento, dispositivos Apple y reintento manual;
   - cache-control privado y ausencia de tokens en auditoría;
   - recuperación tras matar el proceso a mitad de un lote (lease expirado).
6. Programar el scheduler (EventBridge/one-shot) para ejecutar `wallet-sync` cada
   `CARD_WALLET_SYNC_INTERVAL_SECONDS`; sin scheduler solo funciona `after()` y el
   reintento manual.
7. Probar actualización real de pases solo con dispositivos físicos.

## 10. Runbook de producción

1. Completar aprobación del emisor Google Wallet y alta del `passTypeIdentifier`
   Apple con certificados de producción.
2. Cargar secretos en Secrets Manager/SSM; rotar el certificado Apple antes de su
   vencimiento (Apple notifica ~30 días antes).
3. Aplicar la migración con la tarea one-shot del pipeline.
4. Activar flags gradualmente.
5. Monitorear errores de sincronización y auditoría.
6. Rollback funcional: poner flags en `false` (no desinstala pases) y mantener la
   sincronización de revocación operativa. El QR sigue siendo la autoridad.

## 11. Rotación de certificados

- Apple: reemplazar `APPLE_WALLET_PASS_CERT_B64`/`_KEY_B64` y redesplegar. Mantener
  `APPLE_WALLET_PASS_TYPE_ID` y serial estable para no duplicar pases.
- Google: rotar la clave de la cuenta de servicio y actualizar el secreto.
- `CARD_WALLET_PASS_AUTH_SECRET`: rotación versionada sin invalidar pases instalados:
  1. Mover el secreto actual a `CARD_WALLET_PASS_AUTH_SECRET_PREVIOUS` y fijar
     `CARD_WALLET_PASS_AUTH_SECRET_PREVIOUS_VERSION` con la versión anterior.
  2. Configurar el nuevo `CARD_WALLET_PASS_AUTH_SECRET` y subir
     `CARD_WALLET_PASS_AUTH_SECRET_VERSION`.
  3. Los pases nuevos usan la versión activa; los instalados conservan su token
     (`<version>.<hmac>`) y se validan con el secreto previo.
  4. Retirar el secreto previo solo cuando se confirme la reemisión de los pases
     antiguos. Tras retirarlo, los tokens de esa versión dejan de ser válidos.
- Procedimiento excepcional ante compromiso: rotar de inmediato, revocar los pases
  institucionales afectados, regenerar carnés y forzar la reinstalación de Wallet
  (no existe eliminación remota garantizada de una copia local).

## 12. Pruebas

Automatizadas (Vitest, proveedores simulados): configuración, flags, rate limit,
mismo origen, IDs/token versionado, rotación HMAC, JWT Google, `.pkpass`/manifest/
firma simulada, coordinador, revocación, PassKit, reclasificación/requeue de
trabajos, backoff, errores permanentes/transitorios y agotamiento de intentos.

```bash
npx vitest run lib/config/wallet.test.ts lib/security modules/afiliaciones/carnet/wallet/Tests
npm run typecheck
npx eslint . --quiet --ignore-pattern ".tmp/**"
npm run build
```

Pendiente de validación real (requiere credenciales/dispositivos): aprobación de
clase Google, emisión real Google, firma Apple con certificados institucionales,
registro PassKit, APNs, `openssl` en el artefacto desplegado y presentación offline.
Las pruebas SQL del outbox (`SKIP LOCKED`, lease, recuperación) requieren una base
PostgreSQL de integración; no se ejecutaron contra producción.

## 13. Limitaciones conocidas

- No se validó contra Google Wallet ni Apple Wallet reales por ausencia de
  credenciales institucionales.
- APNs no se probó; si no está configurado, la sincronización no envía push.
- El rate limiting es por instancia (no distribuido).
- La carga de secretos usa variables de entorno; la integración directa con AWS
  Secrets Manager/SSM queda a cargo del pipeline/ECS existente.
- `openssl` es requisito del runtime para firmar Apple Wallet. La imagen runner ya
  lo instala, pero no se construyó/ejecutó la imagen en este entorno local.
- El procesador es one-shot: la periodicidad depende de que el scheduler existente
  invoque el contenedor `wallet-sync`.
- La reconciliación de cambios de elegibilidad provenientes de cuotas/perfil es
  periódica (24 h) o manual; no todos los módulos emiten eventos Wallet.
- El outbox garantiza entrega al menos una vez; la actualización de pases es
  idempotente por identificador estable y relectura del estado.
- El entorno local (`next dev`) mantiene bloqueado el binario de Prisma; la
  regeneración del cliente puede requerir detener el servidor de desarrollo.

## 14. Guía rápida

Asociado: ingresa a **Mi carné virtual**, sección “Lleva tu carné siempre contigo”,
elige la billetera de su celular y confirma la incorporación.

Administración: en el detalle del asociado → Carné → **Billeteras digitales**, revisa
estado, última sincronización, dispositivos Apple registrados y reintenta la
sincronización. La revocación se realiza con el flujo institucional existente.


## 15. Hardening CARD-WALLET-HARDENING-02

### Defectos corregidos

1. La sincronización dependía de `after()`; ahora existe un outbox PostgreSQL
   (`card_wallet_sync_jobs`) con lease, reintentos y recuperación.
2. Podía perderse un cambio si llegaba mientras el pase estaba `PROCESSING`;
   `complete()` compara `updated_at` y reencola (`requeued`).
3. La rotación HMAC invalidaba pases; ahora el token es versionado
   (`<version>.<hmac>`) y admite secreto previo.
4. El panel no exponía próximo reintento, intentos ni operación; ahora sí.
5. El endpoint `/v1/log` no tenía límites de cuerpo/tasa; ahora limita a 32 KiB y
   240 req/min por instancia.
6. Apple `Last-Modified` se construía con una expresión ambigua; ahora usa el
   `updatedAt` real del pase.
7. No había scheduler; se añadió el contenedor one-shot `wallet-sync`.

### Scheduler

- Guion: `scripts/process-card-wallet-jobs.ts`.
- Stage Docker: `wallet-sync` (incluye `openssl`, Prisma Client y `tsx`).
- Invocación: `docker run ... wallet-sync` o el scheduler one-shot existente.
- Métricas en el log `card_wallet_sync_run`: pendientes, procesando, retry,
  fallidos, completados, antigüedad del pendiente más antiguo.
- No se añadió Redis, cola externa ni microservicio.

### Google Wallet: enlace de incorporación

El JWT de `Add to Google Wallet` es un enlace bearer: quien lo posea puede intentar
añadir el pase a su propia billetera. Google no lo vincula criptográficamente al
dispositivo ni a la identidad física. Controles aplicados: se genera solo tras
autenticación/elegibilidad, no se cachea, no se registra y se emite bajo demanda.
El QR del IIMP sigue siendo la fuente de verdad para recepción; la posesión del
pase no acredita identidad física.

### Google Wallet: clasificación

La guía oficial de Generic Pass incluye expresamente “Membership cards” como caso
de uso y describe Generic Private Pass para datos sensibles (PII/health IDs), sujeto
a aprobación previa. La decisión implementada es **Generic Pass sin fotografía,
DNI, correo, teléfono ni dirección**, con nombre, código, tipo/estado y QR de
verificación. Si la revisión legal institucional clasifica el carné como dato
sensible, deberá solicitarse acceso a Generic Private Pass
(https://developers.google.com/wallet/generic-private-pass) antes de emitir datos
reales. No se publicó información real en este entorno.

### Recursos oficiales de marca

- Google: se incorporó el SVG oficial en español de Latinoamérica
  (`public/wallet/badges/google/add-to-google-wallet-es.svg`, 48 dp mínimo,
  espacio libre y proporción sin alterar).
- Apple: **BLOCKED**. El asset oficial requiere aceptar el Wallet Marketing
  Agreement y descargarlo desde la cuenta Apple Developer. Hasta que el IIMP lo
  entregue en `public/wallet/badges/apple/`, se mantiene un botón textual que no
  imita la marca. No se creó ni se modificó artwork de Apple.

### Evidencia de regresiones preexistentes

- Los 8 fallos de `AssociateProvisioningService`, `ExportAsociadosService` y
  `AsociadosMapper` provienen de cambios locales no confirmados en asociados
  (`AssociateCodeService.ts` es untracked y los servicios están modificados). No
  fueron introducidos por Wallet y no se tocaron.
- `security:secrets` marca `modules/afiliaciones/control-accesos/Tests/accessToken.test.ts`
  como `hardcoded-secret`; es un fixture de prueba preexistente, no una credencial
  real. El escáner no se desactivó.
- Lint completo local falla al incluir `.tmp/` (archivos de trabajo del usuario);
  excluyendo `.tmp` el lint pasa.
- Docker: `node:22-bookworm-slim` + `openssl` 3.0.22 ejecutó
  `openssl smime -binary -sign ... -outform DER` correctamente (PKCS#7 detached).
- Suite completa: 2446 pasan, 8 fallan (los 3 archivos preexistentes de asociados).
  Typecheck, lint excluyendo `.tmp`, `prisma validate`, `git diff --check` y
  `npm run build` pasan.
- Evidencia HEAD: `git show HEAD:modules/afiliaciones/asociados/Services/AssociateProvisioningService.ts`
  no contiene `AssociateCode`; el archivo actual sí, y `AssociateCodeService.ts`
  está untracked. Los fallos son del trabajo local de asociados.
- El token del hallazgo `security:secrets` es un fixture
  (`AbCdEfGhIjKlMnOpQrStUv12`), no una credencial real.
- Migraciones aplicadas correctamente en PostgreSQL 16 desechable (Docker):
  todas las migraciones históricas + `20261124180000` + `20261124190000`.
- Prueba de integración del outbox en esa BD desechable: `SKIP LOCKED` entregó
  el trabajo a un solo worker, el cambio durante `PROCESSING` provocó requeue,
  `recoverExpired` recuperó el lease, el procesador completó el trabajo y
  `reconcileStale` no revivió un `FAILED` pero sí reencoló un `COMPLETED` stale.

### Estado de preparación

- Implementación técnica: lista para QA con migraciones aplicadas y credenciales de
  prueba. La sincronización persistente, la rotación HMAC y el procesador están
  implementados y probados de forma simulada.
- Funcionamiento real Google/Apple: **NOT VALIDATED** hasta contar con credenciales,
  certificados y dispositivos físicos.
