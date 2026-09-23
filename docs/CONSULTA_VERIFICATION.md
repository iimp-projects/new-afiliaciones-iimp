# Verificación de consulta pública

> Documento histórico de la extracción OTP. La matriz, búsqueda, privacidad, autorización y validación vigentes están en [APPLICATION_MATRIX.md](APPLICATION_MATRIX.md). Los conteos de pruebas y errores incluidos abajo reflejan aquella ejecución, no la línea base actual; consulta [QUALITY_GATES.md](QUALITY_GATES.md).

## Flujo implementado

1. La interfaz solicita primero tipo y número de documento. Ese primer paso es exclusivamente local y no consulta APIs, base de datos, existencia de solicitudes ni canales. En un segundo paso solicita el correo registrado; recién entonces envía tipo, documento y correo a `/api/consulta/verification`.
2. El servidor exige estrictamente los tres campos, aplica rate limiting por IP y por identidad, y busca una coincidencia no eliminada por tipo, documento y correo. Solo después de esa coincidencia recupera los contactos registrados y devuelve destinos enmascarados y un contexto firmado de 15 minutos.
3. `VerificationChannelModal` y `OtpVerificationModal`, extraídos de `PersonalDataStep`, se utilizan en Postulación y Consultar. Solo aparecen canales con destino registrado y proveedor habilitado/configurado. Antes de validar tipo, documento y correo no se revela existencia, teléfono, destinos enmascarados, canales, cantidad ni estado de solicitudes. Sin canales disponibles, el envío queda deshabilitado.
4. Las rutas existentes `send-otp` y `verify-otp` delegan en `OtpRecoveryService`. Para consulta aceptan `purpose: APPLICATION_QUERY` y el contexto firmado; rechazan destinos, IDs o propiedades arbitrarias.
5. Una validación correcta consume el OTP y emite una cookie HttpOnly, SameSite Strict, Secure en producción, limitada a `/api/consulta` y a 15 minutos. `GET /api/consulta` recupera exclusivamente la aplicación identificada por esa cookie y responde sin caché.

Se reutilizan `MailService`, `SmsService` (SNS), `WhatsAppService` y `ProcessLoadingOverlay`. El loader compartido renderiza con `createPortal(..., document.body)`, `fixed inset-0` y `z-[9999]` para cubrir el viewport fuera de contenedores transformados, cards o layouts. Espera al montaje cliente mediante `useSyncExternalStore` para evitar acceso a `document` durante SSR y diferencias de hidratación. Sus consumidores mantienen la misma interfaz. No se modifican pagos, proveedores de pago, expedientes, Datos Maestros ni el esquema Prisma.

## Hallazgos y correcciones necesarias

### Regresión de canales en Postulación

Antes de extraer los modales, Postulación mostraba los tres botones sin comprobar los contactos. Después de la extracción, filtraba con `response.phone || form.phone`, pero `ValidateDocumentService` y su DTO nunca devolvían `phone`; el campo del formulario normalmente estaba vacío. Por eso solo aparecía Correo. Además, el cliente exigía correo para abrir el modal, incluso si existía un teléfono registrado.

La corrección añade `channels: DestinationChannel[]` al DTO de validación. `ValidateDocumentService` y `QueryVerificationService` utilizan la misma función `destinationChannels` con `MembershipApplication.email` y `MembershipApplication.phone`. Postulación consume directamente esa lista del servidor, igual que Consultar, y deja de resolver contactos desde el formulario. La lista contiene solo canales disponibles y destinos enmascarados; una lista vacía activa el estado sin contactos del modal compartido. Los propósitos y callbacks OTP no determinan la disponibilidad y no cambian con esta corrección.

`VerificationChannelParity.test.tsx` comprueba la igualdad de respuestas y renderizado entre ambos servicios para teléfono+correo, solo teléfono, solo correo y ningún contacto.

El código original de Postulación tenía OTP numérico de 6 dígitos, 15 minutos de vigencia, 3 intentos y almacenamiento en `VerificationCode`. No tenía cooldown, reenvío ni límite de envíos. La plantilla de correo era literalmente `...`; WhatsApp simulaba éxito sin token y ocultaba fallos.

La implementación común conserva longitud, vigencia y máximo de intentos. Completa el correo con el OTP, usa generación criptográfica, propaga errores de WhatsApp sin simular envíos y agrega controles compartidos: 60 segundos entre envíos, máximo de 5 solicitudes de envío en 15 minutos y bloqueo de nuevos códigos mientras exista un código con 3 intentos fallidos dentro de esa ventana. El cambio de canal no evita los límites. Los envíos fallidos también cuentan y sus códigos se invalidan.

`VerificationRepository` encapsula la persistencia antes situada directamente en el servicio. Las transacciones bloquean la fila de la postulación para serializar envíos y verificaciones; el incremento de intentos se confirma antes de devolver el error. El consumo invalida un OTP para verificaciones posteriores.

El enum Prisma solo dispone de `START_APPLICATION`, `RESUME_APPLICATION` y `SUBMIT_APPLICATION`. Sin migración, se mantiene `RESUME_APPLICATION` como propósito de persistencia y se diferencia el código de consulta mediante el prefijo interno `APPLICATION_QUERY:` en `VerificationCode.code`. El usuario recibe únicamente los 6 dígitos. Los filtros de consumo e invalidación separan consulta de recuperación; el contrato anterior de recuperación con `trackingCode` se conserva. Los límites de envío se comparten entre contextos.

`docs/BUSINESS_RULES.md` y `docs/DATABASE.md` describen la consulta anterior basada en trackingCode. Para el acceso público por `/api/consulta`, esa descripción queda sustituida por este flujo. No se amplía el alcance a otras rutas heredadas.

## Validación y límites

```powershell
node node_modules/vitest/vitest.mjs run modules/afiliaciones/consulta/Tests
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

- 41 pruebas automatizadas: portal del loader a `document.body`, comportamiento SSR/cerrado, formulario sin seguimiento, selección de la última solicitud por documento, paridad de canales entre Postulación y Consultar, enmascaramiento, ausencia de contactos, entrega mediante proveedores existentes, fallo de envío, WhatsApp sin configuración, OTP correcto/incorrecto/expirado, consumo, intentos, cooldown, reenvío, límites, separación de contextos, entradas arbitrarias, cookie, expiración y autorización HTTP.
- Las pruebas usan dobles de base de datos y proveedores; no envían mensajes ni validan entrega real de WhatsApp, SMS o correo. No se ejecutó una prueba en navegador ni una prueba concurrente contra PostgreSQL.
- ESLint sin errores en los archivos de verificación revisados. `git diff --check` sin errores de espacios.
- En aquella ejecución existían diagnósticos globales de TypeScript fuera del alcance de la extracción OTP. Ese dato quedó obsoleto: la línea base vigente y reproducible está en [QUALITY_GATES.md](QUALITY_GATES.md).
- Alerts nativos: 0 en el flujo de búsqueda/verificación; permanecen 4 en `StatusInReview.tsx`, correspondientes al reemplazo de avales, fuera de este cambio.

## Archivos modificados o creados

- `app/api/afiliaciones/postulacion/send-otp/route.ts`
- `app/api/afiliaciones/postulacion/verify-otp/route.ts`
- `app/api/consulta/route.ts`
- `app/api/consulta/verification/route.ts`
- `modules/afiliaciones/consulta/Components/ConsultationForm.tsx`
- `modules/afiliaciones/consulta/Hooks/useConsulta.ts`
- `modules/afiliaciones/consulta/Models/ApplicationStatus.ts`
- `modules/afiliaciones/consulta/Views/ConsultaView.tsx`
- `modules/afiliaciones/consulta/Repositories/QueryRepository.ts`
- `modules/afiliaciones/consulta/Services/QueryApi.ts`
- `modules/afiliaciones/consulta/Services/QueryAuthorizationService.ts`
- `modules/afiliaciones/consulta/Services/QueryVerificationService.ts`
- `modules/afiliaciones/consulta/Tests/Verification.test.ts`
- `modules/afiliaciones/consulta/Tests/QueryRoutes.test.ts`
- `modules/afiliaciones/consulta/Tests/VerificationModals.test.tsx`
- `modules/afiliaciones/consulta/Tests/VerificationChannelParity.test.tsx`
- `modules/afiliaciones/consulta/Tests/ProcessLoadingOverlay.test.tsx`
- `modules/afiliaciones/postulacion/Components/ApplicationStepper/PersonalDataStep.tsx`
- `modules/afiliaciones/postulacion/DTOs/validation-response.dto.ts`
- `modules/afiliaciones/postulacion/Repositories/VerificationRepository.ts`
- `modules/afiliaciones/postulacion/Services/OtpRecoveryService.ts`
- `modules/afiliaciones/postulacion/Services/OtpRequest.ts`
- `modules/afiliaciones/postulacion/Services/ValidateDocumentService.ts`
- `modules/shared/Components/VerificationModals.tsx`
- `modules/shared/Components/ProcessLoadingOverlay.tsx`
- `modules/shared/Models/Verification.ts`
- `modules/shared/Models/VerificationError.ts`
- `modules/shared/Services/WhatsAppService.ts`
- `vitest.config.mts`
- `docs/CONSULTA_VERIFICATION.md`
