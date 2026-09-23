# Auditoría de seguridad independiente — cierre con evidencia disponible

Fecha: 2026-09-17<br>
Repositorio: `afiliaciones-iimp`<br>
Rama analizada: `master`<br>
HEAD analizado: `ea5e3b1fcc1dbd5e2c4958b6884a3a180420a85e`<br>
Estado del working tree: **sucio**; las correcciones revisadas están en cambios locales y no forman parte íntegra de `HEAD`.<br>
Estado formal de `security-audit`: **INCOMPLETE**.

## 1. Alcance y limitaciones

Esta ejecución revisó el código actual del working tree sin tomar los tachados o conclusiones previas de este documento como fuente de verdad. Después de cerrar la revisión independiente se comparó la evidencia obtenida con C1-C12.

Cobertura realizada:

- 74 Route Handlers y sus controles de autenticación/autorización visibles.
- Sesiones, contexto de usuario, roles, permisos y recuperación de contraseña.
- Expedientes, consulta pública, postulaciones, avales y panel administrativo.
- Pagos/Niubiz, almacenamiento S3, generación de PDF y SAP.
- Seeds, creación administrativa de usuarios, cabeceras HTTP y configuración de despliegue disponible.
- Búsqueda estática de secretos y sinks relevantes realizada antes de detener la auditoría.

La auditoría exhaustiva se detuvo por instrucción del usuario. No se realizaron más búsquedas source-wide ni se ejecutaron procesos del proyecto.

Limitaciones obligatorias:

| Validación | Estado |
|---|---|
| Auditoría runtime | **NO EJECUTADA** |
| Tests | **NO EJECUTADOS** |
| Build | **NO EJECUTADO** |
| TypeScript | **NO EJECUTADO** |
| ESLint | **NO EJECUTADO** |
| Pruebas dinámicas/de navegador | **NO EJECUTADAS** |
| Segundo verificador independiente | **NO DISPONIBLE** |

El estado formal permanece **INCOMPLETE** porque el entorno no ofrece el sandbox requerido por `security-audit`: red externa bloqueada de forma verificable, variables de entorno vacías y allow-listed, objetivo y toolchain de solo lectura, escritura exclusiva en scratch y límites explícitos de recursos.

## 2. Resultado comparativo C1-C12

| ID | Estado anterior | Estado actual | Evidencia | Riesgo residual |
|---|---|---|---|---|
| C1 | CERRADO en código | **CERRADO en código** | `app/api/afiliaciones/expedientes/route.ts:10`; `modules/afiliaciones/expedientes/Services/ExpedienteAuthorizationService.ts:14` | Falta prueba runtime de permisos y aislamiento departamental. |0
| C2 | PARCIAL | **PARCIAL** | `modules/shared/Services/ApisNetPeService.ts:43` obtiene `APIS_NET_PE_TOKEN` del entorno y falla si falta; el literal continúa recuperable en `HEAD`/historial. | **Alto** hasta demostrar rotación/revocación y purga coordinada del historial. |
| C3 | CERRADO en código | **PARCIAL / REABIERTO** | `app/api/consulta/verification/route.ts:5-7` expone el lookup público sin rate limit visible; `modules/afiliaciones/postulacion/Services/ApplicationLookupService.ts:12,20-21` devuelve existencia y opciones de contacto; `modules/shared/Models/Verification.ts:13-18` enmascara, pero conserva metadatos correlacionables. | Enumeración de postulaciones y perfiles de contacto parcialmente enmascarados; respuesta HTTP y controles del ingress no validados en runtime. |
| C4 | CERRADO en código | **CERRADO en código** | `app/api/afiliaciones/postulacion/upload/route.ts:15-50`; `app/api/afiliaciones/postulacion/file/route.ts:15-24`; `modules/shared/Services/S3StorageService.ts:54-82` | Políticas IAM/bucket/KMS y rechazo real de keys ajenas no validados. |
| C5 | CERRADO en código | **CERRADO para el hallazgo original** | `modules/auth/forgot-password/service.ts:13-31`; `modules/auth/reset-password/service.ts:40-43` | CSPRNG y rate limit tienen evidencia fuente, no runtime. El ciclo de vida del reset origina un hallazgo nuevo separado. |
| C6 | CERRADO en código | **CERRADO en código** | `app/api/afiliaciones/expedientes/[id]/status/route.ts:27-30`; `modules/afiliaciones/expedientes/Components/Drawer/Tabs/ObservacionesTab.tsx:384,413` | Falta prueba de navegador del payload almacenado. |
| C7 | CERRADO en código | **CERRADO para seeds** | `prisma/seed.ts:55`; `prisma/seed/auth/users.seed.ts:9-11` | El seed ya no usa credenciales fijas en producción. La creación administrativa normal presenta un hallazgo nuevo separado. |
| C8 | CERRADO en código | **CERRADO en código** | `app/api/afiliaciones/postulacion/generate-pdf/route.ts:10-31`; `modules/afiliaciones/postulacion/Services/DeclarationPdfService.ts:14-25,41,132-133,191-192` | SSRF, límites y aislamiento de Chromium no se reprodujeron en sandbox. |
| C9 | PARCIAL | **PARCIAL** | `modules/afiliaciones/payments/Services/PaymentAuthorizationService.ts:55-70`; `modules/afiliaciones/payments/Services/PaymentService.ts:110,179-186` | No puede cerrarse la autenticidad del callback sin contrato y fixtures oficiales de Niubiz. |
| C10 | CERRADO en código | **CERRADO en código** | `app/api/afiliaciones/postulacion/avales/reenviar/route.ts:9,24,42,54` | Falta prueba runtime de autorización y destinatario persistido. |
| C11 | CERRADO en código | **CERRADO en código** | `app/api/sap/route.ts:7-25`; `modules/shared/Services/SapService.ts:18` | Integración y TLS reales no validados contra infraestructura externa. |
| C12 | CERRADO en código | **CERRADO en configuración** | `next.config.ts:21-27`; `proxy.ts` incluye rutas API en su matcher. | Cabeceras desplegadas no verificadas; CSP conserva `unsafe-inline`, aunque no se encontró un sink dinámico asociado en la revisión realizada. |

Resumen C1-C12:

- Cerrados en código/configuración: **C1, C4, C5, C6, C7, C8, C10, C11 y C12**.
- Parciales: **C2, C3 y C9**.
- C3 cambia respecto del reporte anterior: la ruta pública de verificación mantiene una superficie de enumeración que la conclusión previa no contempló.
- Ningún cierre source-only equivale a validación runtime.

## 3. Hallazgos nuevos de esta ejecución

Los siguientes hallazgos están sustentados por código fuente, pero se clasifican formalmente como **NEEDS_VALIDATION** porque no se permitió ejecutar la reproducción dinámica acotada requerida por la skill.

| ID nuevo | Severidad | Hallazgo | Evidencia | Recomendación |
|---|---|---|---|---|
| N1 | **ALTA provisional — NEEDS_VALIDATION** | La creación administrativa usa la contraseña compartida fija `Cambiar123!` y crea al usuario activo/verificado. La interfaz también revela esa credencial. Una persona que conozca un correo administrativo creado por este flujo podría intentar autenticarse con una contraseña predecible. | `modules/security/Users/Services/UserService.ts:18-21`; `modules/security/Users/Repositories/UserRepository.ts:125-143`; `modules/security/Users/Components/CreateUserModal.tsx:143` | Eliminar la contraseña fija. Usar invitación o token criptográfico de un solo uso, cuenta pendiente hasta completar alta y cambio obligatorio. Añadir una prueba aislada que demuestre que dos altas nunca comparten credencial y que no se puede iniciar sesión antes de completar la activación. |
| N2 | **ALTA provisional — NEEDS_VALIDATION** | Desactivar o eliminar lógicamente un usuario no revoca sus sesiones y el contexto de autorización no comprueba `status`/`deletedAt`; una sesión existente podría conservar roles y permisos. | `modules/auth/session/service.ts:35-47`; `modules/auth/context/repository.ts:7-21`; `modules/auth/context/service.ts:72-123`; `modules/security/Users/Repositories/UserRepository.ts:185-203` | Invalidar todas las sesiones en la misma operación de desactivación/eliminación y rechazar usuarios inactivos/eliminados al hidratar o autorizar cada sesión. Añadir regresión con sesión creada antes de la desactivación. |
| N3 | **ALTA provisional — NEEDS_VALIDATION** | Acciones de dashboard y actividad de áreas solo comprueban que exista un usuario actual, sin exigir `read:dashboard`; podrían exponer nombres y actividad a roles autenticados sin ese permiso. | `modules/dashboard/Actions/dashboard.actions.ts:6-12`; `modules/dashboard/Actions/area-activity.actions.ts:14-22`; `modules/dashboard/Services/DashboardService.ts:71-92` | Exigir el permiso específico en cada Server Action y probar un rol afiliado/sin permiso frente a uno autorizado. No confiar en el ocultamiento o redirect de la UI. |
| N4 | **MEDIA provisional — NEEDS_VALIDATION** | El reset de contraseña actualiza la credencial y elimina el token en operaciones separadas; además no revoca sesiones existentes. Un fallo o carrera podría permitir reutilización, y una sesión robada sobreviviría al cambio. | `modules/auth/reset-password/service.ts:49-59`; `modules/auth/reset-password/repository.ts:50-78` | Consumir token, cambiar contraseña y revocar sesiones en una transacción atómica con condición de un solo uso. Añadir pruebas de concurrencia, rollback y revocación. |

### Clasificación final de N1

N1 no es el mismo hallazgo que C7: C7 cubría credenciales de **seed**, mientras N1 afecta el flujo normal de **creación administrativa**. La evidencia fuente muestra una contraseña literal compartida, persistencia de su hash y activación inmediata. Su impacto potencial justifica severidad alta provisional; la etiqueta formal sigue siendo `NEEDS_VALIDATION` porque no se creó un usuario de prueba ni se intentó el login en un entorno aislado.

## 4. Hallazgos cerrados, parciales y nuevos

| Categoría | Resultado |
|---|---|
| Cerrados source-only | C1, C4, C5, C6, C7, C8, C10, C11, C12 |
| Parciales | C2, C3, C9 |
| Nuevos source-grounded | N1, N2, N3, N4 |
| Confirmados mediante runtime en esta ejecución | Ninguno |
| Estado formal del run | **INCOMPLETE** |

## 5. Pendientes externos

1. Rotar/revocar realmente `APIS_NET_PE_TOKEN`.
2. Aprovisionar secretos requeridos mediante el gestor de secretos del entorno.
3. Purgar el secreto histórico mediante un procedimiento Git coordinado; no se ejecutó reescritura ni force-push.
4. Obtener la especificación oficial de autenticidad/firma y fixtures del callback Niubiz.
5. Verificar políticas desplegadas de AWS/IAM, bucket, KMS, WAF/CDN y almacenamiento de secretos.
6. Confirmar sanitización del proxy/ingress para cabeceras de IP usadas por rate limiting.
7. Revisar acceso y retención de logs que contienen destinatarios de email/teléfono.
8. Validar branch por defecto y reglas de protección/CI en el proveedor Git.

## 6. Validaciones runtime pendientes

En un runner desechable que cumpla el sandbox de la skill deben ejecutarse:

- Reproducciones acotadas para C3 y N1-N4.
- Tests de regresión de autorización, sesión, reset, S3, PDF, XSS, pagos y headers.
- `npm run check`.
- `npm run lint:all`.
- `npm run build`.
- TypeScript y ESLint con reporte completo de errores y warnings.
- Escáner de secretos independiente y validación del historial.
- Pruebas de navegador y verificación de cabeceras en la respuesta construida/desplegada.

Resultados de esta ejecución:

| Control | Resultado |
|---|---|
| Tests | **NO EJECUTADOS** |
| TypeScript | **NO EJECUTADO; errores desconocidos** |
| ESLint | **NO EJECUTADO; errores/warnings desconocidos** |
| Build | **NO EJECUTADO; resultado desconocido** |
| Auditoría runtime | **NO EJECUTADA** |
| Secret scan ejecutable del proyecto | **NO EJECUTADO** |

La inspección estática ya completada antes de detener la auditoría encontró coincidencias de credenciales dummy en tests y, por separado, la contraseña fija real descrita en N1. No se reutiliza esa inspección como sustituto de un escáner runtime/independiente completo.

## 7. Riesgo residual

- **Alto:** APIS.NET.PE debe considerarse comprometido hasta demostrar rotación y tratamiento del historial.
- **Alto provisional:** cuentas administrativas con credencial fija y sesiones de usuarios desactivados/eliminados.
- **Alto provisional:** posible bypass de permiso en acciones de dashboard.
- **Alto/indeterminado:** autenticidad Niubiz pendiente del contrato oficial.
- **Medio provisional:** reset no atómico y sin revocación de sesiones.
- **Medio:** C3 permite inferencias públicas aun con datos enmascarados y sin rate limit visible en la ruta.
- **Operacional:** las mitigaciones revisadas permanecen en un working tree sucio y no están garantizadas en `HEAD` ni en un despliegue.
- **Validación:** los controles de S3, PDF, XSS y headers tienen evidencia fuente, no evidencia runtime.

## 8. Integridad de la ejecución

- No se modificó código de aplicación.
- El único archivo actualizado por este cierre es `auditoria_seguridad.md`.
- No se ejecutaron procesos del proyecto.
- No se ejecutaron nuevos escaneos globales después de la orden de detener la auditoría.
- No se realizó commit, push, deploy, migración, reescritura de historial ni otra operación destructiva de Git.
