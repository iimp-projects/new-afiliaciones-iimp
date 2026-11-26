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

## 16. CARD-WALLET-LOCAL-COMPLETION-03 — cierre local

Ejecución local sobre `local_bd_afiliaciones` (PostgreSQL 17, `localhost:5432`).
Sin despliegues, sin AWS, sin commits. Las migraciones `20261124180000` y
`20261124190000` ya estaban aplicadas y **no se reaplicaron**.

### 16.1 Defectos reales corregidos

1. **Sincronización quedaba `requeued` en vez de `COMPLETED`.**
   `complete()` comparaba `updated_at` (`TIMESTAMP(3)` sin zona) contra un `Date`
   que Prisma enlaza como `timestamptz` (`05:01:02.646-05` vs almacenado
   `10:01:02.646`), por lo que la igualdad nunca se cumplía y todo trabajo se
   devolvía a `PENDING`. Se normaliza el valor reclamado con `AT TIME ZONE 'UTC'`
   antes de comparar. Evidencia: el worker pasó de `claimed=2, completed=0,
   requeued=2` a `claimed=2, completed=2, requeued=0`.
2. **`revokedAt` no se limpiaba al re-sincronizar un carné reemitido.**
   `markSynced()` ahora fija `revokedAt = null`, evitando pases `SYNCED` con
   fecha de revocación residual.
3. **Fallo transitorio local no estaba conectado.** `getWalletSimulationFailure()`
   se importaba pero no se usaba. Ahora `syncPass()` devuelve
   `SIMULATED_TRANSIENT_ERROR` para el proveedor configurado, lo que ejercita el
   camino de reintento real del outbox.

### 16.2 Worker local y comandos npm

```bash
npm run wallet:sync         # un ciclo: recover + reconcile + claim + process + metrics
npm run wallet:sync:watch   # ciclos periódicos secuenciales con SIGINT/SIGTERM
```

- `wallet:sync` usa `scripts/process-card-wallet-jobs.ts` (one-shot).
- `wallet:sync:watch` usa `scripts/process-card-wallet-jobs-watch.ts`: sin
  solapamiento, respeta `CARD_WALLET_SYNC_INTERVAL_SECONDS`, recupera leases al
  reiniciar y cierra ordenadamente.
- Resultados verificados en PostgreSQL: trabajo `COMPLETED`, fallo transitorio →
  `RETRY` con `SIMULATED_TRANSIENT_ERROR` y `next_attempt_at`, recuperación a
  `COMPLETED` tras desactivar el fallo, revocación → pases `REVOKED`. En los tres
  casos `requeued=0` (ownership/lease correcto).

### 16.3 Responsive y UX

- El carné usa proporción fija `1.7:1` solo desde `sm`; en móvil crece con el
  contenido (`min-h-[300px]`, filas `auto/1fr/auto`), eliminando la superposición
  del pie con los datos que ocurría a 320–390 px.
- Verificado sin desbordamiento horizontal en 320, 375, 390, 430, 768, 1024,
  1440 y 1920 px (Puppeteer, `scrollWidth == clientWidth`).
- Botones Wallet: bloqueo síncrono anti doble clic con `useRef`; Apple Wallet con
  estilo propio (gradiente grafito + brillo/destellos) y `prefers-reduced-motion`.
- Panel admin: badges semánticos (verde solo para saludable; ámbar para
  pendiente/procesando/reintento; rojo para fallo; gris para deshabilitado/
  sin configurar/revocado).

### 16.4 Pruebas ejecutadas (evidencia)

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck` | OK |
| `npx vitest run lib/config/wallet.test.ts modules/afiliaciones/carnet/wallet/Tests` | 7 archivos, 48 pruebas OK |
| `npm test` (suite completa) | 289 archivos, 2467 pruebas OK, 0 fallos |
| `npx prisma validate` | Válido |
| `npm run security:secrets` | Sin coincidencias de alta confianza |
| `npm run build` | OK |
| `git diff --check` | OK |
| Docker `wallet-sync` | Imagen construida; Node 22.23.5, OpenSSL 3.0.22, Prisma Client y tsx presentes; worker conectó a la BD local (`completed=2` en métricas) |
| Docker `runner` | Imagen construida; arranca en `NODE_ENV=production` y `/login` responde 200 con placeholders locales |
| Puppeteer | Asociado vigente + Google/Apple simulación, asociado sin carné, no elegible, admin (API 200) y CAJA (403); sin errores JS en flujos válidos |

Capturas locales (fuera de Git):
`C:\Users\maxic\AppData\Local\Temp\opencode\wallet-evidence\`
(`01`–`05`, `06`, `09`, `16`–`18`, variantes responsive 320–1920,
`puppeteer-report.json`, `responsive-report.json`).

### 16.5 Usuarios sintéticos locales

`wallet.local.activo`, `wallet.local.nuevo`, `wallet.local.sinmembresia`,
`wallet.local.admin`, `wallet.local.caja` (`@iimp.org.pe`). Sus contraseñas se
resetean localmente mediante un script temporal con `WALLET_LOCAL_PASSWORD`
inyectada por variable de entorno; **no se versiona ninguna contraseña**.
El usuario `activo` conserva un carné `ISSUED` y ambos pases en `SYNCED`
(`SIMULATED-*`).

### 16.6 Aislamiento de simulación (recordatorio verificado)

- `getWalletSimulationEnabled()` exige `NODE_ENV !== production` **y** flag
  explícito; en las imágenes Docker (`NODE_ENV=production`) la simulación queda
  bloqueada.
- Un pase real no puede marcarse como sincronizado por el adaptador simulado
  (`LOCAL_SIMULATION`); un pase `SIMULATED-*` no se envía a proveedores reales ni
  genera APNs.
- Las rutas de simulación validan sesión, propiedad del carné y elegibilidad.

### 16.7 Pendientes externos (sin cambios respecto a lo anterior)

- QA/PROD **NOT AUTHORIZED**; AWS/SSM/Secrets Manager sin tocar.
- Google Wallet real y Apple Wallet real siguen **NOT VALIDATED**: requieren
  aprobación de clase Google, certificados Apple, APNs y dispositivos físicos.
- El badge oficial de Apple sigue **BLOCKED** por licencia; se mantiene botón
  propio accesible.

## 17. CARD-GOOGLE-WALLET-REAL-LOCAL-04 — Google real en local

Esta fase conecta **Google Wallet real** con datos sintéticos, manteniendo **Apple
Wallet en simulación**. Solo entorno local; sin QA, PROD, AWS ni publicación.

### 17.1 Configuración

- Proyecto Google Cloud: `iimp-digital-wallet` (número `736997702590`).
- API habilitada: `walletobjects.googleapis.com`.
- Issuer ID: `3388000000023251742`.
- Class ID local: `3388000000023251742.iimp_membership_local`.
- Cuenta de servicio: `iimp-wallet-service-local@iimp-digital-wallet.iam.gserviceaccount.com`
  (permiso Desarrollador; publicación **no** solicitada).
- Credenciales: `C:/IIMP/secrets/google-wallet/...json`, **fuera de htdocs**, sin
  copia expuesta. ACL restringida a Administradores/SYSTEM y el usuario local
  (lectura). No se versiona ni se imprime el contenido.

Variables server-side efectivas (`.env` local, ignorado por Git):

```env
CARD_GOOGLE_WALLET_ENABLED=true
CARD_APPLE_WALLET_ENABLED=true
CARD_GOOGLE_WALLET_MODE=REAL
CARD_APPLE_WALLET_MODE=SIMULATION
CARD_WALLET_LOCAL_SIMULATION=true        # habilita la simulación de Apple
GOOGLE_WALLET_ISSUER_ID=3388000000023251742
GOOGLE_WALLET_CLASS_ID=3388000000023251742.iimp_membership_local
GOOGLE_WALLET_CREDENTIALS_FILE=C:/IIMP/secrets/google-wallet/<archivo>.json
GOOGLE_WALLET_CLASS_AUTO_CREATE=true
```

`getWalletProviderMode(provider)` resuelve el modo por proveedor y **nunca**
habilita simulación en `NODE_ENV=production`.

### 17.2 Diagnóstico real

```bash
npm run wallet:google:doctor                 # solo lectura
npx tsx scripts/wallet-google-doctor.ts --create   # crea/reutiliza la clase
npx tsx scripts/wallet-google-doctor.ts --object <objectId>
```

Evidencia obtenida (sin exponer tokens):

```text
OAuth authentication: OK
Google Wallet API connectivity: OK
Issuer access: OK
Class exists: YES
Object query: OK
Objects in class: 1
Object state: active
Object class matches: OK
Object barcode: PRESENT
```

Resultado `--create`: `Class operation: CREATED`; ejecuciones posteriores la
reutilizan (GET `200`, sin duplicados).

### 17.3 Generic Object real

- Objeto: `3388000000023251742.iimp_card_<cardId>` (identificador opaco estable,
  sin DNI/correo/nombre).
- Primera emisión: `created=true`; segunda: `created=false` (GET + PATCH,
  idempotente) y `Objects in class: 1` (sin duplicados).
- Enlace: `https://pay.google.com/gp/v/save/<JWT RS256>` (el JWT no se imprime).
- Transición controlada: un pase local `SIMULATED-GOOGLE-*` se adopta a su
  identificador real solo para el fixture sintético; un pase real no se
  sobrescribe.
- En local (`http://localhost`) se omite `logo.sourceUri` y `origins` para no
  enviar a Google una URL inalcanzable; la verificación legal de publicación
  queda pendiente.

### 17.4 Sincronización, revocación y reemisión reales

Worker `npm run wallet:sync` con el fixture sintético:

| Acción | Resultado |
| --- | --- |
| Emisión | Google Object `created=true`, pase `SYNCED` |
| Repetición | `created=false`, sin duplicados |
| Revocación | job `COMPLETED`; objeto Google `state=inactive`; QR inválido |
| Reemisión | job `COMPLETED`; objeto `state=active`; QR válido; `revokedAt=null` |

Apple permaneció en simulación (sin APNs ni llamadas a Apple).

### 17.5 Seguridad y modo por proveedor

- Sin sesión: `POST /wallet/google` → 403; `GET /carnet/{personId}/wallet` → 401;
  `GET /wallet/apple` → 403 (denegado).
- `CARD_WALLET_LOCAL_SIMULATION` no puede activarse en producción; el modo por
  proveedor se resuelve en servidor.
- `.env` ignorado por Git; `security:secrets` sin coincidencias; credenciales con
  ACL restringida y fuera del web root.
- No se solicitó publicación; la cuenta opera en modo demostración (posible
  etiqueta **TEST ONLY** en Android).

### 17.6 Limitación del QR local y prueba Android

El QR contiene `http://localhost:3000/verificar-carnet/<token>`. Un Android no
resuelve `localhost` de la PC. La verificación local se validó por HTTP; para
probarla desde un teléfono se requiere una LAN controlada (autorizada) con datos
sintéticos. No se abren puertos públicos ni túneles.

Flujo manual de instalación física (pendiente de evidencia):

1. Iniciar sesión local como `wallet.local.activo@iimp.org.pe`.
2. Abrir `/intranet/mi-cuenta/carnet`.
3. Presionar **Agregar a Google Wallet** (genera el enlace real).
4. Abrir el enlace con una cuenta Google autorizada en el emisor (demo mode).
5. Confirmar y abrir Google Wallet en el Android.
6. Verificar campos y QR. La instalación física no se declara hasta confirmarla.

### 17.7 Capturas locales

`C:\Users\maxic\AppData\Local\Temp\opencode\google-wallet-evidence\`:
`02-asociado-carne-wallet-real.png`, `03-admin-google-wallet-estado.png`,
`05-apple-wallet-simulacion-local.png`, `06-google-wallet-revocacion.png`,
`01-admin-directorio.png`, más reportes JSON sanitizados.

### 17.8 Pruebas

`npm run typecheck`, `eslint --quiet`, 50 pruebas Wallet/config, suite completa
2469/2469, `prisma validate`, `security:secrets`, `npm run build` y
`git diff --check` en verde. Autenticación/objeto reales validados vía API de
Google; instalación física en Android **PENDING**.

## 18. CARD-GOOGLE-WALLET-QA-DEPLOYMENT-05 — estado QA

Objetivo: Google Wallet real en QA con **datos sintéticos**, Apple deshabilitado,
sin publicación y sin tocar LOCAL/PROD. Runbook detallado:
`docs/wallets/CARD-WALLET-QA-RUNBOOK.md`.

### 18.1 Evidencia real ejecutada

- Credenciales QA (`iimp-wallet-service-qa@...`) validadas de forma sanitizada:
  `type=service_account`, proyecto correcto, clave RS256 compatible.
- Autenticación real QA: `OAuth OK`, `API OK`, `Issuer access OK`.
- `Generic Class` QA `3388000000023251742.iimp_membership_qa`: `CREATED` y luego
  reutilizada (`Class exists: YES`, `Objects in class: 0`).
- LOCAL **intacto**: clase `..._local`, `Objects in class: 1`, objeto `active`,
  `class matches: OK`.

### 18.2 Aislamiento por ambiente (código)

- `GOOGLE_WALLET_OBJECT_PREFIX`: namespace del objeto (`iimp_card_` histórico
  LOCAL por defecto, `iimp_qa_card_` QA). El identificador LOCAL existente no
  cambia.
- `getGoogleWalletConfig` rechaza clases de otro issuer (`null`) y valida el
  prefijo del namespace antes de crear/modificar objetos.
- El cliente rechaza modificar un objeto existente cuya `classId` no coincida.
- Allowlist QA: `CARD_WALLET_ALLOWED_ASSOCIATE_PREFIXES` (p. ej. `QA-TEST-`) y/o
  `CARD_WALLET_ALLOWED_PERSON_IDS`. Aplica en emisión (`getGoogleLink`) y en el
  worker (`syncPass`); `ALLOWLIST_BLOCKED` es error permanente (sin reintentos).
- Pruebas: 57 Wallet/config (antes 50), suite completa 2476/2476.

### 18.3 Bloqueo de despliegue (no ejecutado)

`origin/qa` **no contiene** el módulo Wallet (`CardWalletService.ts` ausente), por
lo que la app QA actual no tiene esta funcionalidad. Además:

- `qa-deploy.yml` solo publica la imagen `app` y la despliega por SSM; **no**
  ejecuta migraciones ni provisiona worker.
- No existe servicio persistente `wallet-sync` en la instancia QA.
- El mapeo SSM→env del contenedor no está versionado en el repo (compose en la
  instancia), por lo que la inyección del JSON de Google QA no está verificada.
- No hay fixture sintético QA (`wallet.qa.activo`) creado ni acceso directo a la
  base QA (PostgreSQL local en la instancia, CIDR restringido).

Por seguridad **no** se desplegó, no se crearon secretos SSM ni se modificó AWS.
El plan exacto y los comandos quedan en el runbook.

## 19. Branding premium dorado de Google Wallet (QA)

> **Nota:** el `wideLogo` con degradado dorado + placa marfil y el fondo
> `#FAF8F3` descritos en esta sección fueron reemplazados por el refinamiento de
> la §20 (`wide-logo-light-v2.png`, fondo `#7F561E`). Se conserva el resto del
> historial.

- **Paleta institucional real** (`app/globals.css`): dorado `#7F561E` (primary),
  `#C39254` (primary-container), `#A87924` (acento UI), marfil `#FAF8F3`, texto
  `#1F1F1F`/`#5F5E5D`, estado `#237A45`. Sin azul marino.
- **Recursos** (HTTPS público, versionados con `?v=20261125-premium-gold-1`):
  - `public/images/wallet/gold/logo-square-v1.png` (720×720, escudo oficial
    centrado con 15 % de margen seguro, fondo marfil).
  - `public/images/wallet/gold/wide-logo-v1.png` (1280×400, degradado dorado con
    topografía sutil y placa marfil con el lockup oficial).
  - `public/images/wallet/gold/hero-v1.png` (1032×812, topografía y siluetas
    mineras de bajo contraste sobre marfil).
- **Campos nativos** (`GenericObject`): `cardTitle = "Carné Digital IIMP"`,
  `header` = nombre, `subheader` = membresía, `hexBackgroundColor = #FAF8F3`,
  `logo` (cuadrado), `wideLogo` (cabecera), `heroImage`, `textModulesData`
  (`membership_type`, `membership_status`, `associate_code`, `issued_at`,
  `institution`) y `linksModuleData.uris['verify']` con la descripción
  "Verificar autenticidad del carné". El `barcode` QR no cambia.
- **GenericClass**: la API oficial solo admite `classTemplateInfo` (el color y el
  título viven en el objeto). Plantilla con 2 filas (tipo|estado; código|emitido),
  detalle superior del QR "IIMP", lista (nombre; tipo) y 4 detalles (tipo|estado,
  código|emitido, institución, enlace de verificación).
- **Limitaciones**: Generic Pass no admite fotografía del titular; no existe badge
  verde personalizable (el estado se muestra como texto); tipografía y posición
  las controla Google; "TEST ONLY" permanece en modo demo.
- **Migración**: `npm run wallet:google:branding` (actualiza la clase con backup
  remoto previo) y `npm run wallet:google:refresh-objects` (aplica el mismo
  builder a los objetos existentes). El worker reutiliza el builder, por lo que
  preserva el diseño en futuras sincronizaciones.
- **Rollback**: el JSON previo de la clase queda en
  `%TEMP%\afiliaciones-wallet-branding\`; se puede re-PATCH el template anterior y
  re-sincronizar los objetos. No se alteran IDs, QR ni estado.

## 20. Refinamiento de la tarjeta de confirmación web (GOOGLE-WALLET-WEB-PREVIEW-REFINEMENT-04)

Esta fase corrige únicamente la presentación de la tarjeta que Google muestra al
presionar **Agregar a Google Wallet**. La integración funcional (IDs, JWT, QR,
credenciales, clase y reglas) no cambió.

### 20.1 Qué campos usa realmente la pantalla de confirmación

Según la plantilla oficial de Generic Pass
(`developers.google.com/wallet/generic/resources/template`):

- **Card title**: con `wideLogo` definido usa `wideLogo` (o `logo`), `header` y
  `hexBackgroundColor`. Sin `wideLogo` usa `logo`, `cardTitle`, `header` y
  `hexBackgroundColor`.
- **Title row**: `header` y `subheader`.
- En móvil, cuando existe `wideLogo`, la cabecera por defecto (logo + `cardTitle`)
  se reemplaza por el `wideLogo`. Por eso el logotipo debe bastarse por sí solo.
- `cardTemplateOverride` y `listTemplateOverride` **no** permiten cambiar la
  cabecera ni la pantalla de confirmación: `cardTemplateOverride` añade filas y
  `listTemplateOverride` controla la vista de lista de Wallet. No se usaron para
  forzar la pantalla.

Jerarquía aplicada: `cardTitle = "Carné IIMP"`, `header` = nombre completo,
`subheader` = tipo de membresía. Se conserva toda la información previa.

### 20.2 Recursos corregidos (PNG transparente real, 1280×400)

Se eliminó el fondo dorado incrustado, la placa marfil interna y los márgenes
excesivos. El lockup horizontal oficial (escudo + "Instituto de Ingenieros de
Minas del Perú") se recorta, se le retira el fondo marfil `#FAF8F3` con alfa real
y se compone al 90 % del alto del lienzo 16:5, centrado (≈84 % de ancho útil).

- `public/images/wallet/gold/wide-logo-light-v2.png` — lockup marfil (negativo)
  transparente para fondo dorado (Variante A). Geometría del escudo intacta; solo
  cambia el tono para contraste.
- `public/images/wallet/gold/wide-logo-dark-v2.png` — lockup oficial oscuro
  (texto grafito + escudo dorado) transparente para fondo marfil (Variante B).
- `public/images/wallet/gold/hero-v2.png` — topografía sutil transparente de bajo
  alfa para que el fondo nativo se vea uniforme (la Variante B conserva
  `hero-v1.png` marfil).
- La versión de caché sube a `20261126-premium-gold-2` en todas las URLs.

Validación de los recursos: 1280×400, PNG RGBA (color type 6), esquinas con
alfa 0, 71.4 % de transparencia y bbox de contenido centrado. Prueba automática:
`modules/afiliaciones/carnet/wallet/Tests/walletAssets.test.ts`.

### 20.3 Variantes y selección

| Variante | Fondo `hexBackgroundColor` | `wideLogo` | Texto Google |
| --- | --- | --- | --- |
| **A — Dorado institucional (activa)** | `#7F561E` (`--color-primary` real del repo) | `wide-logo-light-v2.png` | Claro (auto-contraste) |
| B — Marfil premium | `#FAF8F3` | `wide-logo-dark-v2.png` | Oscuro |

Se evaluó el dorado suave `#BDA16D` como referencia inicial, pero el escudo
dorado del lockup oficial pierde contraste sobre ese tono (y forzaría texto
oscuro). Se selecciona **A** con el `--color-primary` institucional `#7F561E`:
lockup marfil sobre dorado profundo, ratio ≈ 6.1:1, identidad reconocible y sin
rectángulo/placa blanca. B queda lista para comparar con `--variant ivory`.

### 20.4 Actualización técnica segura (QA)

`npm run wallet:google:refine -- --variant gold [--object <id>] [--print-link]`

El script `scripts/wallet-google-refine-preview.ts`:

1. **Aborta** si el destino parece LOCAL (`*_local` o `iimp_card_`) o si el origen
   no es HTTPS (evita que el PATCH borre los PNG).
2. Verifica por `HEAD`/`GET` que `logo`, `wideLogo` y `heroImage` sean PNG `200`
   accesibles.
3. Respalda el objeto remoto completo en
   `%TEMP%\afiliaciones-wallet-refine\<id>-visual-backup-<ts>.json`.
4. Aplica `PATCH` **solo** a `cardTitle`, `header`, `subheader`,
   `hexBackgroundColor`, `logo`, `wideLogo`, `heroImage`. No toca `state`,
   `barcode`, `textModules`, `links`, IDs ni la firma JWT.
5. Relee el objeto (`GET`) y compara los siete campos; falla si Google no los
   devuelve.
6. Genera un enlace firmado nuevo con la misma lógica JWT y lo escribe en
   `%TEMP%\afiliaciones-wallet-refine\<id>-save-link-<ts>.txt` (no se imprime el
   bearer salvo `--print-link`).

El worker y `wallet:google:refresh-objects` reutilizan
`buildGenericObjectPayload`, por lo que preservan color y recursos versionados en
futuras sincronizaciones (cubierto por prueba de `syncObject`).

### 20.5 Resultado del despliegue QA (26/11/2026)

- Deploy QA oficial (`qa-deploy.yml`, run
  https://github.com/iimp-projects/new-afiliaciones-iimp/actions/runs/45847628201):
  **SUCCESS** sobre `feature/card-google-wallet-qa-deploy`, SHA `d83bdf7`.
  Quality gates, build, push a ECR y despliegue SSM completados.
- Recursos en `https://afiliaciones-qa.iimp.org.pe`: `wide-logo-light-v2.png`,
  `wide-logo-dark-v2.png` y `hero-v2.png` responden `200 image/png`; el PNG
  dorado desplegado coincide byte a byte con el del repositorio (SHA-256). Health
  de la app: `200`.
- Refinamiento de objetos QA: **4/4 tarjetas** actualizadas y verificadas 7/7
  (`cardTitle`, `header`, `subheader`, `hexBackgroundColor`, `logo`, `wideLogo`,
  `heroImage`). Google devuelve `#7f561e` y las URLs `*-v2.png?v=20261126-...`.
- Se **omitió** 1 objeto de diagnóstico `iimp_qa_diag_...` por estar fuera del
  namespace `iimp_qa_card_`; no se modificó. El script reporta `skipped=1` y
  termina con código `0`.
- Respaldos y enlaces firmados por objeto en
  `%TEMP%\afiliaciones-wallet-refine\`. La captura visual real de la pantalla de
  confirmación requiere una sesión de Cuenta de Google: el enlace redirige a
  `accounts.google.com` (verificado con navegador headless), por lo que no se
  capturó sin credenciales.
- No se tocó LOCAL, PROD, AWS, credenciales, IDs, QR ni la firma JWT. El SHA de
  runtime desplegado es `d83bdf7`; los commits posteriores de la rama (`1012d05`)
  son solo de la herramienta de refinamiento.

### 20.6 Rollback

Restaurar el backup de `%TEMP%\afiliaciones-wallet-refine\...json` con el mismo
`PATCH` de campos visuales, o volver a ejecutar `wallet:google:refresh-objects`
con la versión de branding anterior. No se eliminan objetos ni se alteran IDs, QR
ni estado.
