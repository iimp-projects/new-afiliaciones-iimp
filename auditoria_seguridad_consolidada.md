# Auditoría de Seguridad — Estado Consolidado (Working Tree Actual)

- **Fecha:** 2026-09-17
- **Repositorio:** `afiliaciones-iimp`
- **Rama:** `master`
- **HEAD:** `ea5e3b1fcc1dbd5e2c4958b6884a3a180420a85e`
- **Working tree:** sucio; las remediaciones están en cambios locales y **no forman parte íntegra de `HEAD`**.
- **Alcance:** representar exclusivamente el estado actual del código y la evidencia verificable ya obtenida. Este documento sustituye a los informes previos, que estaban desactualizados (presentaban N1-N4 como `NEEDS_VALIDATION`, sin la segunda generación F/NF y con validaciones sin ejecutar).
- **Método:** revisión source-first, validación estática, tests automatizados y validación runtime en entorno local/development. Sin producción, sin Niubiz/SAP reales, sin escritura en S3 productivo, sin correos reales.
- **Clasificaciones:** `CLOSED_STATIC`, `CLOSED_TESTED`, `CLOSED_RUNTIME`, `EXTERNAL_DEPENDENCY`, `NEEDS_INFRA_VALIDATION`, `NEEDS_CONFIGURATION`.

### Estado formal vs estado técnico (no mezclar)

- **Estado formal de la ejecución `security-audit`: INCOMPLETE.** El entorno no acredita el sandbox exigido por la skill (red externa bloqueada de forma verificable, entorno allow-listed vacío, objetivo/toolchain de solo lectura, escritura exclusiva en scratch y límites explícitos de recursos), ni dispone de un segundo verificador independiente formal.
- **Estado técnico de las remediaciones verificadas:** cerrado para los hallazgos de código. La evidencia proviene de TypeScript, ESLint, tests focalizados, suite completa, build de producción y validación runtime local ejecutados durante la sesión.

---

## 1. Estado del working tree

- **Rama:** `master` (sigue a `origin/feature/admin-afiliaciones`, ahead 45, behind 0).
- **HEAD:** `ea5e3b1`; **sin cambios staged**.
- **Tracked modificados:** 158 (156 `M`, 2 `D`) → `+2746 / −1802`. Eliminados: `middleware.ts`, `app/(workspace)/intranet/security/associate-integrations/page.tsx`.
- **Untracked:** 320 archivos (167 en `.agents/skills/`, 153 fuera).
- **Ignorados presentes:** `.env`, `.env.example`, `.next/`, `node_modules/` (no se incluirían con `git add .`).
- **Trazabilidad importante:** el working tree **mezcla** la remediación de seguridad con **cambios funcionales preexistentes no relacionados** (integración de asociados/SIE, alertas operativas, portal del asociado, `mi-cuenta`, grados académicos, dirección internacional, `DataManagement`, documentación y tooling de agentes). **No debe asumirse que todos los cambios pertenecen al security audit.** Ver sección 10.
- **Line endings:** hay warnings CRLF/LF, pero `git diff --numstat --ignore-cr-at-eol` confirma que **ningún archivo está modificado solo por line endings**; los 158 tracked tienen cambios reales.

---

## 2. Baseline técnico (con atribución de fase)

| Control | Resultado | Fase / evidencia |
|---|---|---|
| TypeScript (`tsc --noEmit`) | **PASS — 0 errores** | Ejecutado en sesión (fases de remediación/hardening) |
| Suite completa | **527/527 PASS — 78 archivos — 0 failed** | Ejecutada en sesión (incluye F1-F17, NF1 y hardening) |
| Build producción (`next build`) | **PASS** | Ejecutado en sesión |
| Static generation | **61/61** | Ejecutado en sesión |
| ESLint (alcance modificado) | **0 errores** | Ejecutado en sesión |
| ESLint completo (`lint:all`) | 592 warnings heredados (0 errores) | Deuda preexistente, **no** atribuible a la remediación |
| `git diff --check` | Solo **2 trailing whitespace preexistentes** fuera de alcance (`modules/navigation/Tests/NavigationService.test.ts:34`, `modules/shared/Components/SmartCaseCard/SmartCaseCard.tsx:7`) | Deuda preexistente |
| Runtime/E2E local | **37 comprobaciones, 0 fallos de producto** (1 FAIL inicial por fixture, repetido y aprobado) | Ejecutado en sesión (T1-T8) |
| Regresiones | **Ninguna detectada** | Tras cada remediación/hardening |

> Los valores anteriores corresponden a ejecuciones realizadas durante esta sesión sobre el working tree actual; no se copian de informes previos.

---

## 3. Consolidado C1-C12

| ID | Estado actual | Evidencia | Validación | Riesgo residual |
|---|---|---|---|---|
| C1 — API expedientes sin auth | **CLOSED_RUNTIME** | `app/api/afiliaciones/expedientes/route.ts:10`; `[id]/route.ts:10`; `observaciones/[id]/route.ts:12`; `[id]/status/route.ts:19`; `modules/auth/context/api-authorization.ts:25-37` | Runtime T2: admin 200 / afiliado 403 / anónimo 401 | Ninguno |
| C2 — Token APIS.NET.PE hardcodeado | **EXTERNAL_DEPENDENCY** | `modules/shared/Services/ApisNetPeService.ts:42-50` (sin fallback; falla si falta) | Escáner de secretos limpio; sin literal en el árbol | Rotación/revocación del token histórico y tratamiento coordinado del historial Git |
| C3 — Oráculo público de PII (consulta) | **CLOSED_STATIC** | `modules/afiliaciones/consulta/Services/QueryVerificationService.ts:8-11,26`; `app/api/consulta/verification/route.ts:15-21` | Documento+correo, canal genérico sin PII, rate limit por IP e identidad | `X-Forwarded-For` (infra) |
| C4 — Upload/presign S3 sin auth | **CLOSED_RUNTIME** | `app/api/afiliaciones/postulacion/upload/route.ts`; `file/route.ts`; `modules/shared/Services/S3StorageService.ts:53-115` | Runtime T4: anónimo 401, afiliado 401, carpeta arbitraria 400, traversal 400, MIME 415, avatar sin permiso 403; T3 presign no autorizado 403 | Escritura E2E real (bucket aislado) → NEEDS_INFRA_VALIDATION |
| C5 — Recuperación de contraseña débil | **CLOSED_RUNTIME** | `forgot-password/service.ts`; `reset-password/service.ts`; `reset-password/repository.ts`; `rate-limit/VerificationTokenRateLimiter.ts` | Runtime T6: single-use, sesión previa 401, concurrencia 1/1 | Ninguno |
| C6 — XSS almacenado en observaciones | **CLOSED_TESTED** | `modules/afiliaciones/observations/ObservationText.ts`; `StatusObserved.tsx:480`; `ObservacionesTab.tsx:383-384`; `status/route.ts` | Render como texto + `stripObservationMarkup` en servidor (tests F14) | Validación XSS en navegador (no bloqueante) |
| C7 — Credenciales por defecto en seed | **CLOSED_STATIC** | `prisma/seed.ts:55-59`; `prisma/seed/auth/users.seed.ts:9-15`; `lib/seed/constants.ts` | `SEED_USER_PASSWORD` obligatorio ≥16; guarda de producción antes de `seedUsers` | Rotación de cuentas sembradas preexistentes (operacional) |
| C8 — SSRF/inyección en PDF | **CLOSED_STATIC** | `generate-pdf/route.ts`; `modules/afiliaciones/postulacion/Services/DeclarationPdfService.ts:14-31,41,186-196` | Auth, escape/sanitize, `redirect:"error"`, Puppeteer sin `--no-sandbox`, JS off e intercepción de requests | SSRF en runtime (sandbox) → NEEDS_INFRA_VALIDATION |
| C9 — Token de pago / callback | **EXTERNAL_DEPENDENCY** | A: `PaymentAuthorizationService.ts`; `PaymentService.ts:109-121,179-187`; callback `route.ts`. B: contrato Niubiz | **A (aplicación): CLOSED_TESTED** — propósito, verificación sin consumo, single-use, reconciliación de monto/moneda/orden (runtime T8). **B (firma contractual): EXTERNAL_DEPENDENCY** | Autenticidad/firma oficial Niubiz (no se inventa esquema) |
| C10 — Reenvío de avales sin auth | **CLOSED_STATIC** | `app/api/afiliaciones/postulacion/avales/reenviar/route.ts:9` | `requireApiPermission("update","memberships")` + correo persistido del aval | Ninguno |
| C11 — `/api/sap` público y TLS | **CLOSED_STATIC** | `app/api/sap/route.ts`; `modules/shared/Services/SapService.ts:17-19` | `requireRole(["SUPER_ADMIN"])`, sin `sessionId` en respuesta, `rejectUnauthorized: true` | Transporte HTTP de SAP (infra) |
| C12 — Cabeceras de seguridad | **CLOSED_STATIC** | `next.config.ts:3-31` | CSP, X-Frame-Options DENY, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS (prod) | Validación de CSP en entorno desplegado (no bloqueante) |

**Sin discrepancias** con el baseline esperado. No se usa `PARTIAL` porque todo lo solucionable en código está cerrado y lo pendiente es externo/infraestructura.

---

## 4. Consolidado N1-N4

Los cuatro hallazgos de la segunda revisión están **remediados y verificados**. Se documenta el ciclo original → remediación → evidencia → estado actual. Las afirmaciones obsoletas del informe previo (contraseña compartida `Cambiar123!`, usuarios creados directamente `ACTIVE`, sesiones no revocadas, dashboard sin `read:dashboard`, reset no atómico) **ya no aplican al working tree actual**.

### N1 — Alta de usuarios con contraseña compartida

- **Hallazgo original:** la creación administrativa usaba una contraseña fija y creaba la cuenta `ACTIVE`/verificada, revelándola en la UI.
- **Remediación:** el alta persiste la cuenta como `PENDING` sin credencial y reutiliza el flujo de activación con token aleatorio de un solo uso; la UI ya no revela credenciales.
- **Evidencia actual:** `modules/security/Users/Services/UserService.ts:19-20`; `modules/security/Users/Repositories/UserRepository.ts:124-133` (`status: UserStatus.PENDING`, sin `credential`); `modules/auth/account-activation/service.ts:20-63`; `app/(auth)/activar-cuenta/page.tsx`.
- **Tests:** `UserService.test.ts`, `UserRepository.test.ts`, `AccountActivationService.test.ts`.
- **Runtime:** T1 — login antes de activar falla; activación 200; login posterior OK; reuso/expirado/inválido 400.
- **Riesgo residual:** entrega real de correo (proveedor) → operacional.
- **Estado actual:** **CLOSED_RUNTIME**.

### N2 — Revocación de sesiones y RBAC

- **Hallazgo original:** desactivar/eliminar no revocaba sesiones y la hidratación/autorización no exigía usuario/rol/permisos activos.
- **Remediación:** desactivar/eliminar revoca `userSession` en la misma transacción; la hidratación filtra `status`, `deletedAt`, rol activo y permisos activos; `requireRole`/`requirePermission` pasan por `requireAuth`.
- **Evidencia actual:** `modules/security/Users/Repositories/UserRepository.ts:174-207`; `modules/auth/context/repository.ts:8-22,35-39`; `modules/auth/context/service.ts:80-123`.
- **Tests:** `UserRepository.test.ts`, `ContextRepository.test.ts`.
- **Runtime:** T5 — 200 antes; 401 tras desactivar; 401 tras eliminar; re-login OK.
- **Riesgo residual:** ninguno.
- **Estado actual:** **CLOSED_RUNTIME**.

### N3 — Permiso de Server Actions

- **Hallazgo original:** las acciones de dashboard/actividad solo comprobaban usuario autenticado, sin `read:dashboard`.
- **Remediación:** cada acción exige `read:dashboard` en servidor.
- **Evidencia actual:** `modules/dashboard/Actions/dashboard.actions.ts:8`; `modules/dashboard/Actions/area-activity.actions.ts:16`.
- **Tests:** `dashboard.actions.test.ts`.
- **Runtime:** no ejecutado con roles reales (no bloqueante).
- **Riesgo residual:** validación con roles reales pendiente (baja).
- **Estado actual:** **CLOSED_STATIC**.

### N4 — Reset de contraseña no atómico

- **Hallazgo original:** el reset actualizaba credencial y eliminaba token en operaciones separadas y no revocaba sesiones.
- **Remediación:** emisión bajo advisory lock; el reset consume exactamente un token vigente, actualiza la contraseña, invalida tokens restantes y revoca sesiones en una transacción.
- **Evidencia actual:** `modules/auth/forgot-password/repository.ts:11-19`; `modules/auth/reset-password/repository.ts:5-33`; `modules/auth/reset-password/service.ts:15`.
- **Tests:** `reset-password/repository.test.ts`, `reset-password/service.test.ts`, `forgot-password/repository.test.ts`, `forgot-password/service.test.ts`.
- **Runtime:** T6 — single-use; password antigua rechazada; nueva aceptada; sesión previa 401; doble consumo concurrente 1 éxito/1 fallo.
- **Riesgo residual:** ninguno.
- **Estado actual:** **CLOSED_RUNTIME**.

---

## 5. Consolidado F1-F17 y NF1 (segunda generación)

Se listan los hallazgos confirmados/relevantes. Los falsos positivos y los informativos se separan en las secciones 7 y 8.

### F1 — Activación de cuenta bloqueada por proxy

- **Severidad:** Alta (regresión funcional con impacto de seguridad en el flujo de activación).
- **Causa:** `proxy.ts` redirigía `/activar-cuenta` a `/login` por no estar en `publicRoutes`.
- **Remediación:** `/activar-cuenta` añadido a `PUBLIC_ROUTE_PREFIXES`; lógica extraída a `lib/security/public-routes.ts`.
- **Evidencia:** `lib/security/public-routes.ts:5`; `proxy.ts:30`; `modules/auth/account-activation/service.ts:76`.
- **Tests:** `lib/security/public-routes.test.ts`.
- **Runtime:** navegador/HTTP — 200 sin redirect; login antes de activar falla.
- **Riesgo residual:** ninguno.
- **Estado final:** **CLOSED_RUNTIME**.

### F2 — Allow-list de uploads rompía flujos legítimos

- **Severidad:** Media (regresión funcional).
- **Causa:** la allow-list del endpoint no contemplaba subsanaciones por tracking code ni avatares.
- **Remediación:** `UploadDestinationResolver` con allow-list explícita (fotos, documentos, estudiantes, declaraciones, observaciones, subsanaciones y avatares → `afiliaciones/perfiles`); `assertSafePrefix` alineado; MIME por magic bytes y límite de tamaño conservados.
- **Evidencia:** `modules/afiliaciones/postulacion/Services/UploadDestinationResolver.ts`; `upload/route.ts`; `S3StorageService.ts:101-114`.
- **Tests:** `UploadDestinationResolver.test.ts`.
- **Runtime:** T4 — carpeta arbitraria 400, traversal 400, MIME 415, avatar sin permiso 403, anónimo 401.
- **Riesgo residual:** éxito real de subida → NEEDS_INFRA_VALIDATION (bucket aislado).
- **Estado final:** **CLOSED_RUNTIME**.

### F3 — `consulta-habil` en formulario muerto

- **Estado final:** **FALSE_POSITIVE.** `SponsorLookupForm` no se importa en ningún archivo; no había flujo vivo dependiente.

### F4 — Confianza en `X-Forwarded-For`

- **Estado final:** **NEEDS_INFRA_VALIDATION.** No se cierra: los límites por IP dependen de que el ingress/proxy/ALB/CloudFront reescriba o sanee la cabecera.

### F5 — Autorización S3 demasiado amplia

- **Severidad:** Alta (acceso a documentos fuera del recurso).
- **Causa:** el alcance interno autorizaba el prefijo global `afiliaciones/*`.
- **Remediación:** alcance ligado al recurso: interno → `afiliaciones/applications`; postulante → `afiliaciones/applications/<id>`; afiliado → solo su cookie; validación de host y de prefijo en `S3StorageService`.
- **Evidencia:** `modules/afiliaciones/postulacion/Services/ApplicationDocumentAccess.ts:17-35`; `file/route.ts:17-35`; `S3StorageService.ts:53-95`.
- **Tests:** `ApplicationDocumentAccess.test.ts`, `S3StorageService.test.ts`.
- **Runtime:** T3 — autorizado 200, prefijo arbitrario 403, traversal 400, afiliado 401, anónimo 401.
- **Riesgo residual:** ninguno.
- **Estado final:** **CLOSED_RUNTIME**.

### F6 — JWT de avales sin claims ni rate limiting

- **Severidad:** Baja-Media (endurecimiento).
- **Causa:** `jwt.verify(token, JWT_SECRET)` sin `issuer`/`audience`/`purpose`; ruta sin rate limit.
- **Remediación:** `EndorsementToken` con `issuer`, `audience`, `purpose` y expiración; validación de claims; rate limit por IP en `avales/revisar`.
- **Evidencia:** `modules/afiliaciones/postulacion/Services/EndorsementToken.ts`; `NotifySponsorsService.ts`; `ReviewEndorsementService.ts`; `app/api/afiliaciones/postulacion/avales/revisar/route.ts`.
- **Tests:** `EndorsementToken.test.ts` (8), `ReviewEndorsementService.test.ts` (4), `avales/revisar/route.test.ts` (4).
- **Runtime:** no ejecutado contra correo real (no aplica).
- **Riesgo residual:** compatibilidad temporal — los tokens legacy previamente emitidos se aceptan durante su TTL máximo de 7 días (transición, **no** se generan nuevos tokens legacy).
- **Estado final:** **CLOSED_TESTED**.

### F7 — Scripts legacy con credenciales/PII

- **Severidad:** Baja-Media (herramientas históricas).
- **Causa:** scripts de migración con contraseñas legacy sin hash, logs con DNI/email y ejecutables por accidente.
- **Remediación:** guard `ALLOW_LEGACY_MIGRATION=true`, cabecera de herramienta histórica, contraseñas legacy hasheadas (sin doble hash) y logs sin DNI/email.
- **Evidencia:** `migracion-fase1/2/3.ts` y `migracion-parche.ts:4-9`; `migracion-fase1.ts:99-105,179-185`.
- **Tests:** no aplica (no ejecutados, por diseño).
- **Runtime:** no ejecutado (correcto).
- **Riesgo residual:** confirmar que ningún pipeline define `ALLOW_LEGACY_MIGRATION=true` (operacional).
- **Estado final:** **CLOSED_STATIC**.

### F8 — `restore` de pago devolvía PII sin `no-store`

- **Severidad:** Baja.
- **Causa:** respuesta con PII sin `Cache-Control`.
- **Remediación:** `Cache-Control: no-store`. Se conserva `draftData` porque los callers legítimos (`ConsultaView`, `StatusObserved`, `StatusCompleted`) dependen de ella. La referencia sigue protegida por referencia firmada + cookie `httpOnly`; **no** se convirtió en single-use para no romper el flujo.
- **Evidencia:** `app/api/payments/restore/route.ts`; `PaymentAuthorizationService.ts:97-116`.
- **Tests:** `app/api/payments/restore/route.test.ts` (3: 403, header no-store, `draftData` conservado).
- **Runtime:** cubierto por T8 en el componente de referencia.
- **Riesgo residual:** ninguno nuevo; minimización de PII descartada por dependencia de callers.
- **Estado final:** **CLOSED_TESTED**.

### F9 — `.env` / SAP HTTP

- **Estado final:** **FALSE_POSITIVE** como “secreto versionado”: `.env` no está trackeado ni en el historial; `.gitignore:34`; escáner limpio. El transporte HTTP de SAP se separa como **NEEDS_INFRA_VALIDATION** (sección 9).

### F10 — `checkLockStatus` como oráculo sin rate limit

- **Severidad:** Baja.
- **Causa:** consultaba el estado de bloqueo sin límite.
- **Remediación:** rate limit por IP (30/15 min) reutilizando `verificationTokenRateLimiter`; al superar el límite responde `locked:false` (no amplifica la enumeración); UX intacta.
- **Evidencia:** `modules/auth/login/action.ts`; `modules/auth/rate-limit/VerificationTokenRateLimiter.ts`.
- **Tests:** `checkLockStatus.test.ts` (4).
- **Runtime:** no ejecutado (cubierto por tests).
- **Riesgo residual:** `X-Forwarded-For` → F4 (infra).
- **Estado final:** **CLOSED_TESTED**.

### F11 — Login sin rate limiting por IP

- **Severidad:** Baja.
- **Causa:** solo existía lockout por cuenta.
- **Remediación:** rate limit por IP (20/15 min) coexistiendo con lockout por cuenta (5/15 min).
- **Evidencia:** `modules/auth/login/service.ts`; `VerificationTokenRateLimiter.ts`; `modules/auth/security/service.ts:6-9`.
- **Tests:** `LoginService.test.ts`.
- **Runtime:** T7 — IP agotada bloquea login válido; IP distinta OK; lockout por cuenta OK; cuenta bloqueada rechaza password correcta.
- **Riesgo residual:** `X-Forwarded-For` → F4 (infra).
- **Estado final:** **CLOSED_RUNTIME**.

### F12 — Referencia de callback consumida antes del éxito

- **Severidad:** Baja.
- **Causa:** `consumeCallbackReference` se ejecutaba antes de la operación con el proveedor, quemando la referencia ante fallo incierto.
- **Remediación:** `verifyCallbackReference` no consume; se consume solo tras resultado terminal; fallo incierto permite reintento.
- **Evidencia:** `PaymentAuthorizationService.ts:70-95`; `PaymentService.ts:109-121`.
- **Tests:** `PaymentAuthorizationService.test.ts`, `PaymentService.test.ts`.
- **Runtime:** T8 — verify no consume, single-use, replay rechazado, cross-purpose false, callback inválido 303.
- **Riesgo residual:** retry contra Niubiz sandbox → NEEDS_INFRA_VALIDATION.
- **Estado final:** **CLOSED_RUNTIME**.

### F13 — Hash del código de reset

- **Severidad:** Baja.
- **Causa:** SHA-256 sin clave del código de 6 dígitos (brute force offline si se filtra la tabla).
- **Remediación (endurecimiento adicional):**
  - **Emisión:** `AUTH_SECRET` obligatorio + HMAC-SHA256; si falta/vacío/whitespace → error de configuración; **nunca** se emiten hashes SHA-256 sin clave.
  - **Verificación:** HMAC actual + SHA-256 **solo** como compatibilidad con tokens legacy ya emitidos; TTL legacy máximo 30 minutos; no se extiende la expiración.
- **Evidencia:** `modules/auth/verification/codeHash.ts`; `forgot-password/service.ts`; `reset-password/service.ts`.
- **Tests:** F13 **9/9 PASS**; forgot/reset password **16/16 PASS**.
- **Runtime:** cubierto por T6 (reset single-use y concurrencia).
- **Riesgo residual:** ninguno nuevo; la compatibilidad legacy es transitoria y no permite emitir tokens nuevos sin clave.
- **Estado final:** **CLOSED_TESTED**.

### F14 — Saneo de observaciones

- **Severidad:** Baja.
- **Causa:** el comentario de observación solo se recortaba, sin saneo consistente.
- **Remediación:** helper compartido `stripObservationMarkup` aplicado en `status` y `observaciones`; React sigue renderizando como texto; sin `dangerouslySetInnerHTML` en el flujo.
- **Evidencia:** `modules/afiliaciones/observations/ObservationText.ts`; `app/api/afiliaciones/expedientes/[id]/status/route.ts`; `app/api/afiliaciones/expedientes/observaciones/[id]/route.ts`.
- **Tests:** `ObservationText.test.ts` (5) + `observaciones/[id]/route.test.ts` (2); casos `<script>`, `<img onerror>`, texto normal, acentos.
- **Runtime:** no ejecutado en navegador (no bloqueante).
- **Riesgo residual:** ninguno.
- **Estado final:** **CLOSED_TESTED**.

### F15 — `tx.session.deleteMany` (código muerto)

- **Severidad:** Informativa.
- **Causa:** eliminación de filas del modelo `Session` de Auth.js, no usado por la app (estrategia JWT, sin adapter).
- **Remediación:** eliminadas las 3 llamadas muertas; la revocación efectiva continúa mediante `userSession`.
- **Evidencia:** `modules/security/Users/Repositories/UserRepository.ts`; `modules/auth/reset-password/repository.ts`.
- **Tests:** `UserRepository.test.ts`, `reset-password/repository.test.ts` (actualizados).
- **Runtime:** cubierto por T5 (revocación).
- **Riesgo residual:** el modelo `Session` permanece en schema; eliminarlo implicaría una migración distinta y no forma parte de esta remediación.
- **Estado final:** **CLOSED_TESTED**.

### F16 — Marcador del proxy

- **Estado final:** **INFORMATIONAL.** `proxy.ts` solo añade `X-Edge-Security`; la lista de prefijos API es parcial y el resto depende de guards de ruta (verificado). No es un control de seguridad.

### F17 — Frontera interno/afiliado

- **Severidad:** Crítica/Alta (acceso cruzado de afiliados externos a APIs internas).
- **Causa:** `requireApiPermission` no excluía afiliados; roles `ASOCIADO_ACTIVO`/`ASOCIADO_ESTUDIANTE` poseen `read:memberships`, usado internamente.
- **Remediación:** `requireApiPermission` rechaza afiliados (403) y exige permiso; `getInternalApiUser` excluye afiliados/inactivos; `file`/`upload`/`generate-pdf` usan el helper interno.
- **Evidencia:** `modules/auth/context/api-authorization.ts:19-37`; `modules/auth/context/types.ts:26-31`; `app/api/afiliaciones/postulacion/file/route.ts:17`; `upload/route.ts:35`; `generate-pdf/route.ts:11`.
- **Tests:** `api-authorization.test.ts` (8).
- **Runtime:** T2 — afiliado 403 en `/expedientes` y `/usuarios/comite`; admin 200; interno sin permiso 403; anónimo 401.
- **Riesgo residual:** ninguno.
- **Estado final:** **CLOSED_RUNTIME**.

### NF1 — Frontera interno/afiliado en `consulta-habil` y `validate-sponsor`

- **Severidad:** Media.
- **Causa:** ambas rutas usaban `read:memberships` como discriminador interno sin aplicar la frontera de F17.
- **Remediación:**
  - `consulta-habil` → **exclusivamente interna**: `requireApiPermission("read","memberships")` (anónimo 401; afiliado 403; interno sin permiso 403; interno autorizado permitido, `{ eligible: true }` sin PII). Su caller histórico (`SponsorLookupForm`) es código muerto.
  - `validate-sponsor` → **ruta DUAL**: camino interno por `requireApiPermission("read","memberships")`; camino postulante por `QUERY_COOKIE` → `ApplicationAccessService.require`. Un 401 interno cae al camino de cookie; `ApplicationFlowError` se mapea a su `httpStatus`. Los afiliados externos no pueden usar `read:memberships` como atajo interno.
- **Evidencia:** `app/api/asociados/consulta-habil/route.ts`; `app/api/afiliaciones/postulacion/validate-sponsor/route.ts`.
- **Tests:** **11/11 PASS** (`consulta-habil/route.test.ts` 5; `validate-sponsor/route.test.ts` 6).
- **Runtime:** probe de confirmación del bypass previo; tras la corrección, validado por tests.
- **Riesgo residual:** ninguno.
- **Estado final:** **CLOSED_TESTED**.

---

## 6. Validaciones runtime (local)

Ejecutadas contra el servidor de desarrollo (`http://localhost:3000`) y `bd_afiliaciones_dev`, con fixtures aislados creados y eliminados al final. Sin producción, sin Niubiz/SAP reales, sin correos reales, sin escritura en S3 productivo.

| Test | Cubre | Resultado |
|---|---|---|
| T1 | F1 / N1 | **PASS** — activación sin sesión 200; login antes falla; activación 200; login posterior OK; reuso/expirado/inválido 400; navegador permanece en `/activar-cuenta` |
| T2 | F17 / C1 | **PASS** — admin 200/200; afiliado 403/403; interno sin permiso 403; anónimo 401 |
| T3 | F5 / C4 | **PASS** — key autorizada 200; prefijo arbitrario 403; traversal 400; afiliado 401; anónimo 401 |
| T4 | F2 / C4 | **PASS** — carpeta arbitraria 400; traversal 400; MIME 415; avatar sin permiso 403; anónimo 401. Éxito real BLOCKED_ENVIRONMENT (sin bucket aislado) |
| T5 | N2 | **PASS** — 200 antes; 401 tras desactivar; 401 tras eliminar; re-login OK |
| T6 | N4 / C5 / F13 | **PASS** — single-use; password antigua rechazada; nueva aceptada; sesión previa 401; doble consumo concurrente 1 éxito/1 fallo |
| T7 | F11 | **PASS** — IP agotada bloquea login válido; IP distinta OK; lockout por cuenta 5/15; cuenta bloqueada rechaza password correcta |
| T8 | F12 / C9-A | **PASS** — verify no consume; single-use; replay rechazado; cross-purpose false; callback inválido 303 |

**Distinción:** `CLOSED_RUNTIME` = evidencia runtime directa; `CLOSED_TESTED` = validación por tests automatizados; `CLOSED_STATIC` = corrección verificada en código sin ejecución.

---

## 7. Falsos positivos (no son deuda)

| ID | Descripción | Evidencia |
|---|---|---|
| F3 | `SponsorLookupForm` no se importa en ningún archivo; no había flujo vivo dependiente | `modules/afiliaciones/consulta/Components/SponsorLookupForm.tsx` (sin importadores) |
| F9 (secreto versionado) | `.env` no trackeado ni en historial; `.gitignore:34`; escáner de secretos limpio | `.gitignore:34`; `git ls-files .env` sin coincidencia |

## 8. Informativos (arquitectónicos)

| ID | Observación | Evidencia |
|---|---|---|
| F16 | `proxy.ts` solo añade `X-Edge-Security`; prefijos API parciales | `proxy.ts:11-27,41-43` |
| F15 residual | Modelo `Session` permanece en schema sin uso; eliminarlo sería una migración | `prisma/schema.prisma` |
| F4 | Confianza en `X-Forwarded-For` para rate limiting | rutas con límites por IP |

---

## 9. Pendientes reales (no son vulnerabilidades de código abiertas)

### Dependencias externas (`EXTERNAL_DEPENDENCY`)
- **C2 — APIS.NET.PE:** rotación/revocación del token históricamente expuesto y tratamiento coordinado del historial Git (sin reescritura unilateral). Código ya corregido.
- **C9 — Niubiz:** contrato/especificación oficial de autenticidad del callback y fixtures/sandbox oficiales. Los controles de aplicación ya están corregidos/testeados; no se inventa esquema de firma.

### Infraestructura (`NEEDS_INFRA_VALIDATION`)
- Confianza y reescritura de `X-Forwarded-For` en ingress/proxy/ALB/CloudFront.
- Escritura E2E contra bucket S3 **aislado** (no usar producción para cerrar la auditoría).
- SAP sobre TLS (transporte HTTP plano a revisar).
- SSRF runtime de generación de PDF (sandbox).
- CSP en entorno desplegado.

### Configuración (`NEEDS_CONFIGURATION`)
- `PAYMENT_AUTH_SECRET` ≥ 32 caracteres, independiente por entorno.
- `AUTH_SECRET` obligatorio para la emisión HMAC de códigos de recuperación (F13).

### Operacional
- Rotación de credenciales históricamente sembradas (si existieron cuentas previas).
- Confirmar que ningún pipeline define `ALLOW_LEGACY_MIGRATION=true`.
- Tratamiento coordinado del historial Git del token APIS.NET.PE.

---

## 10. Riesgo residual

1. **Código:** ninguno abierto de severidad crítica/alta/media/baja. Los endurecimientos menores (F6/F8/F10/F13/F14/F15) ya están aplicados.
2. **Configuración:** `PAYMENT_AUTH_SECRET` y `AUTH_SECRET` por entorno, no versionados.
3. **Infraestructura:** `X-Forwarded-For`, S3 aislado, SAP TLS, SSRF runtime, CSP desplegada.
4. **Dependencia externa:** C2 (APIS.NET.PE), C9-B (firma Niubiz).
5. **Operacional:** rotación de credenciales sembradas; historial Git del token.
6. **Trazabilidad:** las remediaciones permanecen en un working tree sucio mezclado con cambios funcionales preexistentes; deben revisarse y versionarse por Git/PR antes de considerarse parte de `HEAD` o de un despliegue.

No se inflan severidades.

---

## 11. Conclusión

### ¿Hay vulnerabilidades de código abiertas?

Determinado del working tree actual:

- **Críticas:** 0
- **Altas:** 0
- **Medias:** 0
- **Bajas:** 0

(Los pendientes son de configuración, infraestructura o dependencia externa; F4 no es vulnerabilidad de código.)

### ¿Hay bloqueante de código para preparar PR?

**NO.** No hay hallazgos de código críticos/altos/medios/bajas abiertos. La deuda preexistente (592 warnings ESLint, 2 trailing whitespace fuera de alcance) no es atribuible a la remediación ni bloquea el PR.

### ¿Hay bloqueantes para producción?

**Preparar PR ≠ autorizar producción.** Requisitos antes de producción:

- **Código:** ninguno identificado.
- **Configuración:** definir `PAYMENT_AUTH_SECRET` (≥32) y `AUTH_SECRET` en cada entorno.
- **Infraestructura:** verificar `X-Forwarded-For`; validar S3 E2E en bucket aislado; revisar SAP TLS; validar SSRF runtime y CSP desplegada.
- **Dependencias externas:** rotar/revocar `APIS_NET_PE_TOKEN` y tratar el historial Git; obtener contrato/firma oficial Niubiz.
- **Operacional:** rotar credenciales sembradas históricas; confirmar `ALLOW_LEGACY_MIGRATION` no habilitado en pipelines.

---

## Anexo — Antecedentes históricos (referencia)

- El informe previo (basado en una ejecución `security-audit` detenida) presentaba N1-N4 como `NEEDS_VALIDATION` con afirmaciones hoy obsoletas (contraseña compartida `Cambiar123!`, usuarios creados `ACTIVE`, sesiones no revocadas, dashboard sin `read:dashboard`, reset no atómico). Esas condiciones fueron corregidas y verificadas; se conservan aquí solo como historia del hallazgo.
- Segunda revisión independiente: detectó F1-F17 y NF1.
- Remediaciones: F1/F2/F5/F7/F11/F12/F17 y NF1; hardening de F6/F8/F10/F13/F14/F15; endurecimiento adicional de F13.
- Validación: TypeScript, ESLint, tests focalizados, suite completa (527/527), build y runtime local (T1-T8).
- Este documento sustituye a los informes previos como estado vigente.
