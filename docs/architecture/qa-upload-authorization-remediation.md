# QA — Remediación de autorización 401 en `POST /api/afiliaciones/postulacion/upload`

> **Fase:** 3D-6.5 · **Fecha:** 2026-09-21 · **Ámbito:** QA `https://afiliaciones-qa.iimp.org.pe`
> **Sin secretos ni PII.** `LEGACY_CHANGES=0`, `PRODUCTION_CHANGES=0`, `COMMITS=0`, `PUSHES=0`.
> **Estado:** causa raíz confirmada y corregida en el árbol de trabajo. Despliegue/revalidación QA pendiente.

---

## 1. Síntoma

Durante una prueba manual real del flujo público de postulación de asociado, el postulante:

1. consulta su documento y RENIEC responde correctamente,
2. completa la información personal,
3. selecciona país/departamento/provincia/distrito (catálogos `200`),
4. adjunta los documentos requeridos,
5. presiona continuar.

En ese punto `POST /api/afiliaciones/postulacion/upload` devuelve:

```
HTTP/1.1 401 Unauthorized
{"message":"Verifica tu identidad para subir archivos."}
```

El 401 ocurre **antes** de tocar S3.

## 2. Evidencia

| Evidencia | Resultado |
|---|---|
| `POST /api/afiliaciones/postulacion/validate-document` | `200` (RENIEC OK) |
| `GET /api/catalogs/1/departments` | `200` |
| `GET /api/catalogs/15/provinces` | `200` |
| `GET /api/catalogs/128/districts` | `200` |
| `POST /api/afiliaciones/postulacion/upload` | `401` `"Verifica tu identidad para subir archivos."` |
| `S3StorageService.uploadFile` durante la request fallida | **nunca invocado** |
| Health QA (`/api/health/live`, `/api/health/ready`) | `200` / `200` |

Baseline QA (solo lectura): branch `master`, HEAD `ea5e3b1`, EC2 QA `running`, health `200/200`,
HTTPS `PASS`. No se modificó infraestructura, SSM, DNS ni datos.

## 3. Flujo frontend

`ApplicationView` es el orquestador del asistente. En el paso 1 (`PersonalDataStep`):

```
PersonalDataStep.submit()                 (al presionar "Guardar y Continuar")
  → applicationApi.uploadFile(foto,   "afiliaciones/fotos")        // ❌ ANTES de crear el borrador
  → applicationApi.uploadFile(dni,    "afiliaciones/documentos")   // ❌
  → onSave(formWithS3Urls)
      → ApplicationView.savePersonalInformation()
          → api.start(...)              // crea el DRAFT y emite la cookie de acceso
          → api.updateDraft(...)
  → onNext()
```

Contrato de autenticación del upload (frontend):

- `fetch` a `${baseUrl}/upload` con `FormData` (`file`, `folder`).
- No envía `Authorization`, ni token de verificación, ni `applicationId` en el flujo del postulante.
- La autorización depende exclusivamente de la cookie `iimp_application_access`
  (`QUERY_COOKIE`), `HttpOnly`, `SameSite=strict`, `path=/api`, `Secure` en producción, `maxAge=900`.
- La cookie la emite `POST /api/afiliaciones/postulacion` al crear el DRAFT
  (`app/api/afiliaciones/postulacion/route.ts:22`) o `POST .../verify-otp`.

**Hallazgo:** en el flujo nuevo, los `uploadFile` se ejecutan **antes** de `api.start`, por lo que
todavía no existe la cookie de acceso.

## 4. Flujo backend del endpoint

`app/api/afiliaciones/postulacion/upload/route.ts`:

1. Valida tamaño (`≤10 MB`) y tipo real por magic bytes (`%PDF-`, JPEG, PNG, WEBP) → `400/413/415`.
2. Rama avatares (`users/avatars`): exige usuario interno con permiso `update/create users`.
3. Rama postulación:
   - `applicantApplicationId = queryAuthorization.allowedIds(cookie QUERY_COOKIE)[0]`
   - `internalAccess = user && hasPermission("update","memberships")`
   - `applicationId = applicantApplicationId || (internalAccess ? requestedApplicationId : null)`
   - si no hay `applicationId` → **401** `"Verifica tu identidad para subir archivos."` (línea 58).
4. Resuelve el destino por allow-list (`resolveApplicationFolderKind`) → `400` si no está permitido.
5. Recién entonces llama a `S3StorageService.uploadFile` con
   `afiliaciones/applications/<applicationId>/<kind>`.

`UPLOAD_401_SOURCE = app/api/afiliaciones/postulacion/upload/route.ts:57-59`
`UPLOAD_AUTHORIZATION_FUNCTION = queryAuthorization.allowedIds(QUERY_COOKIE)` + `getInternalApiUser`/`contextService.hasPermission("update","memberships")`
`UPLOAD_EXPECTED_VERIFICATION_STATE = cookie JWT HS256 "QUERY_ACCESS" con applicationIds (audience "iimp-consulta")`

## 5. Mecanismo de verificación de identidad

- `validate-document` (`ValidateDocumentService`) es **stateless**: consulta `ApplicationLookupService` y
  APIS.NET.PE y devuelve `person`. **No crea cookie, token ni estado de verificación.**
- El estado que autoriza `/upload` es la cookie de **acceso a la postulación** (`iimp_application_access`),
  creada al **crear el borrador** (`queryAuthorization.createAccess`) o al verificar OTP.
- `QUERY_CHALLENGE` (AES-GCM) es solo un reto previo a OTP; **no** autoriza (`allowedIds` lo rechaza).

```
IDENTITY_VERIFICATION_MECHANISM = cookie de acceso a la postulación (JWT HS256, aud "iimp-consulta")
VERIFICATION_CREATED_AT          = al crear el DRAFT (api.start) o al verificar OTP
VERIFICATION_STORED_IN           = cookie HttpOnly iimp_application_access (path /api)
VERIFICATION_SENT_TO_UPLOAD_AS   = header Cookie: iimp_application_access=<jwt>
```

No participan en `/upload`: `PAYMENT_AUTH_SECRET`, `JWT_SECRET`, NextAuth/Auth.js, `codeHash` ni
`QueryVerificationService`. El secreto usado es `AUTH_SECRET` (`getAuthSecret`).

## 6. Causa raíz

El hardening del endpoint (que ahora exige una postulación autorizada) quedó **desalineado con el orden
del flujo cliente**: el paso de datos personales sube los archivos **antes** de que `api.start` cree el
borrador y emita la cookie.

Clasificación de la lista del PASO 8: **A + I** — `validate-document` no crea estado de verificación y el
flujo espera que el borrador ya exista, pero la UI sube antes de crearlo. No es S3, no es expiración, no
es `Secure/SameSite/Domain/Path`, no es un secreto distinto.

```
ROOT_CAUSE_CONFIRMED = YES
ROOT_CAUSE            = orden frontend: upload antes de crear el borrador (sin cookie de acceso)
AFFECTED_COMPONENT    = PersonalDataStep.submit / ApplicationView.savePersonalInformation
SECURITY_IMPACT       = ninguna: el control de autorización es correcto; el cliente no lo satisfacía
LOCAL_BEHAVIOR        = mismo bug; enmascarado si el navegador conservaba una cookie previa de /consulta
QA_BEHAVIOR           = sesión nueva sin cookie → 401 reproducible
```

## 7. Diferencia local vs QA

| Item | LOCAL | QA | Estado |
|---|---|---|---|
| Código del endpoint | mismo árbol | mismo árbol | IDENTICAL |
| `AUTH_SECRET` | PRESENT (dev) | PRESENT (SSM) | PRESENT |
| `NODE_ENV` | development | production | DIFFERENT (esperado) |
| Cookie `Secure` | false | true | DIFFERENT (esperado, HTTPS) |
| Cookie `SameSite` / `Path` | strict / `/api` | strict / `/api` | IDENTICAL |
| `AUTH_URL` / `NEXT_PUBLIC_APP_URL` | local | QA https | DIFFERENT (esperado) |
| Causa | orden de llamadas | orden de llamadas | IDENTICAL |

La causa es independiente del entorno. En local suele pasar desapercibida porque, tras probar el flujo
de consulta, el navegador conserva `iimp_application_access` y el upload funciona "por accidente".

## 8. Corrección aplicada

Mínima, preservando todos los controles:

1. **`modules/afiliaciones/postulacion/Views/ApplicationView.tsx`**
   `savePersonalInformation` ahora, en este orden:
   - crea el borrador (`api.start`) si no existe → emite la cookie de acceso,
   - resuelve/sube los `File` con `resolvePersonalInformationUploads` (foto y documento),
   - persiste el borrador con `updateDraft`.
2. **`modules/afiliaciones/postulacion/Components/ApplicationStepper/PersonalDataStep.tsx`**
   `submit` ya no sube archivos; entrega el formulario a `onSave`, que orquesta el orden correcto.
3. **`modules/afiliaciones/postulacion/Services/PersonalInformationUploads.ts`** (nuevo)
   Helper puro que reemplaza `File` por referencias S3 usando las carpetas permitidas
   (`afiliaciones/fotos`, `afiliaciones/documentos`) y no re-sube referencias ya persistidas.

No se tocó el endpoint: el 401, la allow-list de carpetas, el control interno, la verificación MIME/magic
bytes, el límite de tamaño ni S3.

## 9. Impacto de seguridad

- El control de autorización del endpoint permanece intacto (401 sin postulación autorizada).
- El postulante sigue sin poder elegir `applicationId`: solo usa el de su cookie; el `applicationId`
  enviado por el navegador se ignora salvo para usuarios internos con `update:memberships`.
- No se añadió bypass, hardcode ni `if QA`.
- Se preserva el aislamiento QA y el bucket privado.

## 10. Tests

Nuevos:

- `app/api/afiliaciones/postulacion/upload/route.test.ts` (10 casos): sin cookie → 401 y S3 no invocado;
  token inválido → 401; token expirado → 401; `QUERY_CHALLENGE` → 401; cookie válida → 200 bajo
  `afiliaciones/applications/<id>/photos`; destino no permitido → 400; MIME/magic bytes → 415;
  interno con permiso usa el `applicationId` solicitado; `applicationId` del navegador ignorado para
  anónimo; carpeta de avatares exige permiso.
- `modules/afiliaciones/postulacion/Tests/PersonalInformationUploads.test.ts` (3 casos): carpetas y orden
  de subida; no re-subida de referencias; normalización a `null`.

Resultado: `88` archivos de test, `620` tests — **todos PASS** (13 nuevos).

## 11. Validación QA

- Baseline read-only confirmado: `/api/health/live` `200`, `/api/health/ready` `200`, HTTPS `PASS`.
- La corrección está en el árbol de trabajo (sin commit). La revalidación del flujo real en QA
  (RENIEC → datos → ubicación → documentos → upload → continuar) queda **pendiente de desplegar la
  imagen** que contiene este cambio. No se desplegó en esta fase.

Pasos de revalidación (tras deploy autorizado):

```
RENIEC_STATUS            = esperado PASS
CATALOG_STATUS           = esperado PASS
UPLOAD_AUTHORIZATION     = esperado PASS
UPLOAD_STATUS            = esperado 2xx
S3_OBJECT_CREATED        = esperado YES (afiliaciones/applications/<id>/<kind>, privado)
APPLICATION_FLOW_CONTINUES = esperado YES
```

## 12. Estado S3

`S3_ROOT_CAUSE = NO`. El 401 se produce en la validación de autorización, antes de instanciar
`S3StorageService`. No se modificó bucket policy, IAM, public access, CORS ni permisos.

## 13. Riesgos residuales

- Despliegue QA pendiente: hasta reconstruir/desplegar la imagen, QA sigue con el 401.
- El árbol de trabajo contiene otros cambios no relacionados; el despliegue debe construirse desde el
  estado acordado por el operador.
- Los tests de la orquestación de UI se cubren a nivel de helper puro (el proyecto no usa jsdom/RTL);
  la secuencia exacta `start → upload → updateDraft` se verifica por revisión de código.

## 14. Archivos modificados

| Archivo | Cambio |
|---|---|
| `modules/afiliaciones/postulacion/Views/ApplicationView.tsx` | crea borrador antes de subir y orquesta uploads |
| `modules/afiliaciones/postulacion/Components/ApplicationStepper/PersonalDataStep.tsx` | delega la subida a `onSave` |
| `modules/afiliaciones/postulacion/Services/PersonalInformationUploads.ts` | nuevo helper de subida |
| `app/api/afiliaciones/postulacion/upload/route.test.ts` | nuevo test de autorización |
| `modules/afiliaciones/postulacion/Tests/PersonalInformationUploads.test.ts` | nuevo test del helper |

## 15. Recursos AWS modificados

Ninguno. `AWS_RESOURCES_CHANGED = 0`. Sin cambios en EC2, SSM, S3, RDS, DNS ni IAM.

## 16. Conclusión

El 401 no era de S3 ni de secretos: el flujo subía los archivos antes de crear el borrador que emite la
cookie de acceso a la postulación. La corrección reordena la orquestación cliente (crear borrador → subir
→ persistir) sin debilitar ninguna validación. La revalidación funcional en QA requiere desplegar la
imagen con este cambio.
