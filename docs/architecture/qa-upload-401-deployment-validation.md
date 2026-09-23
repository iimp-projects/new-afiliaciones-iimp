# QA — Deploy del fix Upload 401 + Revalidación E2E del flujo público

> **Fase:** 3D-6.6 · **Fecha:** 2026-09-21 · **Ámbito:** QA `https://afiliaciones-qa.iimp.org.pe`
> **Sin secretos ni PII.** `LEGACY_CHANGES=0`, `PRODUCTION_CHANGES=0`, `COMMITS=0`, `PUSHES=0` (Git).
> **Decisión:** `QA_UPLOAD_FIX_DEPLOYED_AND_VALIDATED`.

---

## 1. Baseline

| Item | Valor |
|---|---|
| Git branch / HEAD | `master` / `ea5e3b1` |
| Working tree | 165 archivos tracked modificados + 419 untracked (272 entradas) |
| EC2 QA | `i-095d15242588ec268` running, `3.129.231.111`, us-east-2, cuenta `564914947461` |
| Contenedores | `app` + `caddy` + `postgres` (healthy) |
| Imagen previa | tag `ea5e3b1-web` · digest `sha256:e506fcc99ef11cb341d502bda03ad350f242efe09e0f7fe0a907679830994455` |
| Health inicial | live=200, ready=200 |
| HTTPS | PASS |
| `QA_BASELINE_HEALTHY` | YES |

## 2. Causa raíz (3D-6.5, reconfirmada)

`PersonalDataStep.submit()` subía foto/documento **antes** de `onSave → api.start`, es decir antes de
que existiera el DRAFT y la cookie `iimp_application_access`. `/upload` validaba correctamente esa
cookie y devolvía 401. No era S3, IAM, CORS, RENIEC, AUTH_SECRET ni NextAuth.

## 3. Revisión del working tree y fuente del deploy

- Imagen en ejecución: se confirmó (grep dentro del contenedor) que contiene el hardening del
  working tree (`"Verifica tu identidad para subir archivos."` y `identity-documents`), es decir la
  imagen QA se construyó desde el working tree (no desde `ea5e3b1` limpio).
- Análisis de `mtime` (UTC) de todos los tracked modificados + untracked: todo archivo relevante para
  el build es anterior a la creación de la imagen (`2026-09-21T01:49:30Z`). Las únicas excepciones
  posteriores son los archivos del fix 3D-6.5 y `Dockerfile`.
- `Dockerfile` (untracked) cambió después del build: la imagen previa usó
  `find ... -name chrome-sandbox ...` (no-op, porque Chrome for Testing provee `chrome_sandbox`), y el
  working tree actual agrega `chown root:root` + `chmod 4755` + symlink sobre `chrome_sandbox`.
- Para no introducir un cambio de sandbox no validado, el build 3D-6.6 usó un **Dockerfile temporal
  equivalente al baseline** (mismo paso de sandbox no-op que la imagen previa), fuera del repo. Así el
  único delta de la nueva imagen es el fix 3D-6.5.
- No se usó ninguna operación Git destructiva. No se hizo commit/push.

`DEPLOY_SOURCE_SAFE = YES` (base: working tree ya desplegado + solo el fix 3D-6.5).

## 4. Fix desplegado (diff de código)

| Archivo | Cambio |
|---|---|
| `modules/afiliaciones/postulacion/Views/ApplicationView.tsx` | `savePersonalInformation` crea el DRAFT (`api.start`) **antes** de resolver/subsir uploads y luego `updateDraft` |
| `modules/afiliaciones/postulacion/Components/ApplicationStepper/PersonalDataStep.tsx` | `submit` ya no sube archivos; entrega el form a `onSave` |
| `modules/afiliaciones/postulacion/Services/PersonalInformationUploads.ts` | helper puro que sube `File` con carpetas allow-list y no re-sube referencias |
| `app/api/afiliaciones/postulacion/upload/route.test.ts` | tests de autorización del endpoint |
| `modules/afiliaciones/postulacion/Tests/PersonalInformationUploads.test.ts` | tests del helper |
| `docs/architecture/qa-upload-authorization-remediation.md` | diagnóstico 3D-6.5 |

Orden verificado en código: `api.start` → DRAFT + cookie → `resolvePersonalInformationUploads`
(upload foto + documento) → `updateDraft`.

## 5. Imagen anterior (rollback)

- Tag: `ea5e3b1-web`
- Digest: `sha256:e506fcc99ef11cb341d502bda03ad350f242efe09e0f7fe0a907679830994455`
- Estado: **conservada** en ECR y en el host.

## 6. Imagen nueva

- Tag: `ea5e3b1-upload401-fix`
- Digest ECR: `sha256:fd157df497e29ca5aea745bacef29b4514012a33b3fdb95f5cf212bc98be2481`
- Image ID en host: `sha256:d8f5cc84fc01c6f1871be706608e89ad06b5f8bb7b4333ea87cd4fd75c90db4f`
- `BUILD_ID` nuevo: `nTXUNccS2stu-JvlTPDMD` (previo `kKjrhh60CRlVfrrB5Lq6D`)
- Sandbox helper: `chrome_sandbox` `0755 nextjs:nodejs` (idéntico al baseline).
- Build sin `NEXT_PUBLIC_APP_URL` (igual que el baseline; la URL es runtime desde `app.env`).

## 7. Quality gates (código candidato)

| Gate | Resultado |
|---|---|
| TypeScript | PASS |
| ESLint (`--quiet`) | PASS |
| Tests | 88 files / **620 passed** (13 nuevos) |
| Build | PASS (Next 16.3.5, 61 páginas) |
| `security:secrets` | PASS (sin coincidencias) |

## 8. Orden real de requests (E2E QA, sesión limpia sin login)

```
POST validate-document            → 200 (RENIEC)
GET  catalogs/countries           → 200
GET  catalogs/1/departments       → 200
POST /api/afiliaciones/postulacion→ 201 DRAFT id=3 + Set-Cookie iimp_application_access
POST .../upload (foto)            → 200
POST .../upload (documento)       → 200
PATCH .../{trackingCode}          → 200 (updateDraft)
GET   .../{trackingCode}          → 200 (refs persistidas)
```

Método: reproducción HTTP exacta del contrato de red del navegador (cookie jar limpio, sin login).
La orquestación del frontend (start antes de upload) se verificó por código + tests unitarios.

## 9. Cookie de autorización

- `COOKIE_NAME = iimp_application_access`
- `HttpOnly = true`, `Secure = true`, `SameSite = strict`, `Path = /api`, `Max-Age = 900`
- Emitida por `POST /api/afiliaciones/postulacion` (201) y por `verify-otp`.
- No se imprimió el JWT ni `AUTH_SECRET`.

## 10. Resultado del upload

| Item | Resultado |
|---|---|
| `UPLOAD_PHOTO_STATUS` | 200 |
| `UPLOAD_DOCUMENT_STATUS` | 200 |
| `UPLOAD_AUTHORIZATION` | PASS |
| `S3_UPLOAD_STATUS` | PASS |

## 11. Resultado S3

- Objetos: `afiliaciones/applications/3/photos/...png` y
  `afiliaciones/applications/3/identity-documents/...png`.
- `S3_OBJECT_CREATED = YES` · `S3_OBJECT_PRIVATE = YES` (GET anónimo → **403**) ·
  `S3_APPLICATION_SCOPE_CORRECT = YES`.
- Bucket con `BlockPublicAcls/IgnorePublicAcls/BlockPublicPolicy/RestrictPublicBuckets = true`.

## 12. Resultado DB

- `membership_applications` id=3: `DRAFT`, `currentStep=1`, `photo.name=foto.png`,
  `identityDocument.name=dni.png` → referencias persistidas.
- Conteo para el documento sintético: **1** (sin DRAFTs duplicados).
- Total de aplicaciones QA: 3 al momento de la validación.

## 13. Negative security tests

| Caso | Resultado |
|---|---|
| `POST /upload` sin cookie | **401** |
| `POST /upload` cookie inválida | **401** |
| `POST /upload` cookie app=3 + form `applicationId=999` | **200** guardado bajo `applications/3/` (id del navegador ignorado) |
| GET anónimo del objeto | **403** |

El endpoint **no** quedó público y no se relajó ningún control.

## 14. Regresiones

| Check | Resultado |
|---|---|
| RENIEC (`validate-document`) | PASS (200, `person` presente) |
| SUNAT (`validate-ruc`) | PASS (200, `status=VERIFIED`) |
| Catálogos | PASS (200) |
| Admin login | PASS (302 + session cookie + `/api/auth/session` con `user`) |
| Application create | PASS (201) |
| Application update | PASS (200) |
| PDF (`generate-pdf`) | PASS (200, `application/pdf`, 114,758 bytes, `%PDF`) |
| Chromium sandbox | PASS (seccomp aplicado, `SecurityOptCount=1`, sin `--no-sandbox`) |
| HTTPS | PASS |
| live / ready | 200 / 200 |
| Contenedor | healthy, Restarts=0, OOM=false, sin errores en logs |

Backup: se conservan los dumps previos en `s3://.../backups/qa/`; no se requirió migración
(`MIGRATION_REQUIRED = NO`) ni backup nuevo (deploy solo de app).

## 15. Rollback readiness

- Imagen previa `ea5e3b1-web` disponible en ECR y host.
- Backup de `docker-compose.yml` en el host: `docker-compose.yml.bak-3d66`.
- Procedimiento: revertir la línea `image:` al tag previo y `docker compose up -d app`.

## 16. Scheduler

`afiliaciones-qa-start`: ENABLED · `cron(0 8 ? * MON-FRI *)` · `America/Lima`.
`afiliaciones-qa-stop`: ENABLED · `cron(0 20 ? * MON-FRI *)` · `America/Lima`.
Sin cambios.

## 17. Legacy / Producción

`LEGACY_CHANGES = 0` · `PRODUCTION_CHANGES = 0`. No se tocó `afiliacion.iimp.org.pe`, ni su BD,
DNS, IAM, S3 ni infraestructura.

## 18. Riesgos residuales

1. **Doble click / doble submit (menor):** el botón se deshabilita con `saving`, pero existe una
   ventana entre el click y `setSaving(true)`. El backend serializa con
   `pg_advisory_xact_lock(hashtext(...))` y rechaza el segundo intento (`409/401`), por lo que **no se
   duplican DRAFTs** (verificado: 2 inicios concurrentes → 1 sola fila). Corrección mínima propuesta
   (no aplicada en esta fase): guard de reentrada con `useRef` en `savePersonalInformation` y/o en
   `PersonalDataStep.submit`.
2. **Artefactos de prueba QA:** aplicaciones sintéticas id=3 (`00000000`) e id=4 (`00000001`) y 3
   objetos bajo `afiliaciones/applications/3/`. Creados con autorización de la fase; no se eliminaron
   (borrado destructivo no solicitado).
3. **Dockerfile del working tree** difiere del usado por la imagen previa (paso de sandbox). El deploy
   usó el Dockerfile baseline equivalente; si se adopta el nuevo paso setuid, requiere revalidar PDF.

## 19. Decisión final

`QA_UPLOAD_FIX_DEPLOYED_AND_VALIDATED`.

El flujo público de postulación funciona sin login, crea el DRAFT antes de subir, emite y usa la cookie
de acceso, almacena foto/documento bajo el `applicationId` correcto, persiste las referencias y el
endpoint sigue rechazando uploads no autorizados.
