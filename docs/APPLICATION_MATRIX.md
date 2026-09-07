# Matriz vigente: Postulación y Consulta

Esta implementación reemplaza los contratos anteriores descritos en `CONSULTA_VERIFICATION.md`. El código y los estados de Prisma son la fuente de verdad.

## Una matriz compartida

`ApplicationAction.ts` resuelve ambos contextos con los ocho estados reales. `APPROVED` sigue siendo válido para áreas y avales, cuyos enums son distintos del estado global de una solicitud.

| Estado | Postulación | Consulta |
| --- | --- | --- |
| Sin solicitud | Crear nueva | Aviso e iniciar Postulación |
| DRAFT | OTP y recuperar borrador | Aviso y continuar en Postulación |
| PENDING | Aviso; ir a Consulta | Solicitud recibida, sin edición |
| UNDER_EVALUACION | Aviso; ir a Consulta | Seguimiento sin edición |
| OBSERVED | Aviso; ir a Consulta | CTA a StatusObserved; solo campos observados |
| RESOLVED | Aviso; ir a Consulta | Subsanación enviada; sin edición |
| READY_FOR_PAYMENT | Ir a Consulta | Pago existente |
| COMPLETED | Aviso; ir a Consulta | Finalización sin nuevo pago |
| REJECTED | Nueva solicitud si corresponde | Resultado y posible nueva solicitud |
| Desconocido | Salida segura, sin crear ni editar | Salida segura, sin crear ni editar |

Los seis estados entre DRAFT y READY_FOR_PAYMENT son vigentes. COMPLETED es final pero bloquea otra postulación para la misma identidad y tipo de afiliación. REJECTED no se reutiliza: una nueva postulación crea otra fila si no hay otra solicitud que bloquee y la persona no es un usuario AFFILIATE. El servidor vuelve a comprobarlo al crear.

La creación filtra documento, tipo de documento, tipo de afiliación y `deletedAt: null`. Se serializa esa combinación mediante un advisory lock transaccional de PostgreSQL. Guardado y envío bloquean la fila y vuelven a comprobar el estado. Service y repository permiten enviar exclusivamente desde DRAFT.

## Autorización y privacidad

1. ValidateDocumentService y QueryVerificationService delegan en ApplicationLookupService y ApplicationLookupRepository. Se analizan todas las solicitudes no eliminadas, incluyendo affiliateType en Postulación.
2. Antes del OTP solo salen existencia, necesidad de verificación, destinos enmascarados y contextos opacos AES-256-GCM de 15 minutos. No salen nombres, contactos completos, trackingCode ni estados.
3. Los contactos distintos se muestran como opciones enmascaradas. Ambos flujos usan los mismos canales, modales, endpoints y OtpRecoveryService.
4. El consumo del OTP devuelve el canal y destino realmente verificados. Solo se autorizan solicitudes del mismo documento que comparten ese destino. Un contacto distinto o cambiado después del envío no recibe autorización.
5. La cookie `iimp_application_access` es HttpOnly, SameSite Strict, Secure en producción, con duración de 15 minutos y path `/api`. Contiene los IDs autorizados. TrackingCode identifica, pero no autoriza.
6. `/api/consulta/applications` devuelve tipo, fecha, estado y acciones de las solicitudes autorizadas. Si hay varias, el usuario selecciona explícitamente; las vigentes se ordenan primero.
7. GET editable, PATCH y submit validan autorización. GET recupera solo DRAFT. PATCH conserva los campos permitidos en OBSERVED y bloquea otros estados. El reemplazo de aval requiere autorización y estado OBSERVED.
8. Consulta devuelve un resultado reducido para DRAFT, sin evaluaciones, observaciones ni pago. Su enlace recupera el borrador en la ruta correcta, conservando la autorización.

ApplicationApi normaliza `{message}` y `{error}`, conserva errores de campos de 422 y distingue estados funcionales de fallos técnicos. Los códigos APPLICATION_NOT_EDITABLE, ALREADY_SUBMITTED, APPLICATION_EXISTS y VERIFICATION_REQUIRED producen avisos con salida a Consulta.

## Compatibilidad y alcance

- Se conservan las reglas OTP y proveedores existentes. No se creó otro sistema OTP ni se cambiaron cooldown, reenvío o expiración en esta implementación de la matriz.
- Los modales continúan usando GlobalModalRoot, portal a document.body, z-index 9998 y bloqueo de interacción/scroll. Los loaders existentes usan 9999.
- Se retiró del seguimiento el formulario duplicado de reemplazo de avales. La corrección queda en StatusObserved.
- Facturación consumía `response.person` de la búsqueda pública anterior. Ese consumidor ahora utiliza el expediente autorizado o ingreso manual. No se modificaron SUNAT, PaymentService, Niubiz, montos ni ejecución de pagos.
- No se modificaron schema Prisma, migraciones, AcademicInfo, Datos Maestros ni Expedientes.
- Las descripciones antiguas en BUSINESS_RULES.md y DATABASE.md que presentan trackingCode como acceso suficiente quedan sustituidas por este contrato. Consulta devuelve el estado global persistido; una observación de aval no sobreescribe un estado final en la respuesta.

## Verificación reproducible

```powershell
node node_modules/vitest/vitest.mjs run modules/afiliaciones/consulta/Tests
node modules/shared/Components/Tests/ApplicationMatrix.browser.mjs
node modules/shared/Components/Tests/VerificationDialog.browser.mjs
node node_modules/typescript/bin/tsc --noEmit --pretty false
```

Las pruebas de servicios y rutas usan dobles de persistencia y proveedores. Las de navegador renderizan las entradas y componentes reales, con HTTP local simulado; el componente de pago se sustituye para verificar la derivación sin ejecutar pagos. No se enviaron OTP, solicitudes a revisión ni pagos reales. No se probó concurrencia contra PostgreSQL real.

La prueba de layering usa Tailwind y los componentes reales, escritorio/móvil y scroll 0/350: verifica portal, footer cubierto, clic y foco bloqueados, scroll bloqueado y restauración.

Resultado de la ejecución final: 80 pruebas automatizadas aprobadas; 22 escenarios de matriz en navegador y 4 de layering aprobados; 0 fallidos. ESLint en los archivos nuevos revisados y `git diff --check` sin errores. TypeScript global conserva 49 diagnósticos fuera de los archivos de esta implementación; no se declara compilación global satisfactoria.

## Archivos de la implementación

- Rutas: `app/api/afiliaciones/postulacion/route.ts`, `validate-document/route.ts`, `verify-otp/route.ts`, `[trackingCode]/route.ts`, `[trackingCode]/submit/route.ts`; `app/api/consulta/route.ts`, `applications/route.ts`, `reemplazar-aval/route.ts`.
- Postulación, modelos y DTO: `Models/ApplicationAction.ts`, `DTOs/validation-response.dto.ts`.
- Postulación, repositorios: `ApplicationLookupRepository.ts`, `ApplicationRepository.ts`, `Interfaces/IApplicationRepository.ts`, `VerificationRepository.ts`.
- Postulación, servicios: `ApplicationLookupService.ts`, `ApplicationAccessService.ts`, `ApplicationApi.ts`, `ApplicationApiError.ts`, `ApplicationHttpError.ts`, `Exceptions/ApplicationFlowError.ts`, `ValidateDocumentService.ts`, `GetApplicationByTrackingService.ts`, `UpdateDraftService.ts`, `StartApplicationService.ts`, `SubmitApplicationService.ts`, `OtpRecoveryService.ts`.
- Postulación, interfaz: `Components/ApplicationStateNotice.tsx`, `Components/ExistingApplicationGate.tsx`, `Components/ApplicationStepper/PersonalDataStep.tsx`, `Views/ApplicationView.tsx`.
- Consulta: `Services/QueryAuthorizationService.ts`, `Services/QueryVerificationService.ts`, `Services/QueryApi.ts`, `Hooks/useConsulta.ts`, `Models/ApplicationStatus.ts`, `Views/ConsultaView.tsx`, `Components/StatusInReview.tsx`, `Components/StatusObserved.tsx`, `Components/PaymentStepper/BillingDetailsStep.tsx`.
- Tests de Consulta: `ApplicationMatrix.test.ts`, `ApplicationApi.test.ts`, `Verification.test.ts`, `VerificationChannelParity.test.tsx`, `QueryRoutes.test.ts`.
- Navegador: `modules/shared/Components/Tests/ApplicationMatrix.browser.mjs`, `VerificationDialog.browser.mjs`.
- Documentación: `docs/APPLICATION_MATRIX.md`, `docs/CONSULTA_VERIFICATION.md`.
- Eliminado: `modules/afiliaciones/consulta/Repositories/QueryRepository.ts`, reemplazado por el repositorio compartido.

Las rutas relativas de Postulación y Consulta pertenecen a `modules/afiliaciones/postulacion` y `modules/afiliaciones/consulta`, respectivamente.
