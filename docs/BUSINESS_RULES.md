# Reglas de negocio observadas

## Convenciones de evidencia

- **IMPLEMENTADO EN CÓDIGO:** condición identificada directamente en código.
- **DEDUCIDO DEL FLUJO ACTUAL:** consecuencia razonable de varios componentes.
- **PENDIENTE DE CONFIRMACIÓN:** no hay fuente suficiente para declararlo regla oficial.

## Identificadores de la postulación

- **IMPLEMENTADO EN CÓDIGO:** `MembershipApplication.id` es la clave primaria numérica y el identificador relacional usado por `Payment.applicationId`.
- **IMPLEMENTADO EN CÓDIGO:** `applicationCode` es único y se muestra como código de expediente.
- **IMPLEMENTADO EN CÓDIGO:** `trackingCode` es único y se utiliza para recuperar y consultar una postulación.

## Flujo de postulación

- **IMPLEMENTADO EN CÓDIGO:** una postulación nueva se crea en `DRAFT`, con `applicationCode`, `trackingCode`, tipo de afiliación, documento, correo y teléfono.
- **IMPLEMENTADO EN CÓDIGO:** el draft se guarda en `draftData` y actualiza `currentStep` y `lastAccessAt`.
- **IMPLEMENTADO EN CÓDIGO:** al enviar se validan información personal, estudios, empleo y avales mediante `ApplicationValidator`.
- **IMPLEMENTADO EN CÓDIGO:** el envío persiste persona, estudios, empleo, avales, documentos y una validación inicial `PENDING` por departamento activo y requerido; luego deja la postulación en `PENDING`.
- **IMPLEMENTADO EN CÓDIGO:** solo un `DRAFT` es recuperado por número de documento y el envío rechaza otra postulación activa `DRAFT` o `PENDING` con el mismo tipo y número de documento.

## Asociados, avales y áreas

- **IMPLEMENTADO EN CÓDIGO:** si el documento pertenece a una persona cuyo usuario es `AFFILIATE`, se informa que es un asociado activo.
- **IMPLEMENTADO EN CÓDIGO:** para postulaciones no estudiantiles se requieren dos avales aprobados; para `STUDENT`, los avales se consideran cumplidos.
- **IMPLEMENTADO EN CÓDIGO:** un aval rechazado lleva la postulación a `OBSERVED`; los avales inactivos no cuentan.
- **IMPLEMENTADO EN CÓDIGO:** el calculador considera conformes a `LOGISTICA`, `ASOCIADOS` y `COMITE` cuando están `APPROVED` o `RESOLVED`.
- **IMPLEMENTADO EN CÓDIGO:** una validación rechazada lleva el expediente a `REJECTED`; una observación de área lleva a `OBSERVED`.
- **DEDUCIDO DEL FLUJO ACTUAL:** `UNDER_EVALUACION` representa actividad de revisión sin condición final; `RESOLVED` representa corrección enviada o resuelta a nivel de área.

## Observaciones y correcciones

- **IMPLEMENTADO EN CÓDIGO:** observar una validación requiere por lo menos un campo permitido; se guarda una `MembershipObservation` con departamento, descripción y rutas de campos.
- **IMPLEMENTADO EN CÓDIGO:** una postulación observada solo permite cambiar rutas incluidas en observaciones pendientes.
- **IMPLEMENTADO EN CÓDIGO:** al enviar corrección, las observaciones pendientes pasan a `RESOLVED`, las validaciones observadas correspondientes pasan a `RESOLVED` y el estado general se recalcula.

## Pago y finalización

- **IMPLEMENTADO EN CÓDIGO:** para no estudiantes, el calculador lleva a `READY_FOR_PAYMENT` cuando avales, `LOGISTICA`, `ASOCIADOS` y `COMITE` están conformes y no hay rechazo u observación.
- **IMPLEMENTADO EN CÓDIGO:** un último pago con estado `PAID` permite que el flujo completo pase a `COMPLETED`; para estudiantes el pago se considera resuelto al completar dicho flujo.
- **PENDIENTE DE CONFIRMACIÓN:** montos oficiales, emisión de comprobantes, política de reintentos, devoluciones y activación definitiva del asociado.

## Consulta pública

- **IMPLEMENTADO EN CÓDIGO:** la ruta de consulta busca por `trackingCode` y número de documento de la persona vinculada y devuelve `id`, código, estado, datos de draft y detalle de validaciones/avales.
- **IMPLEMENTADO EN CÓDIGO:** la UI normaliza estados para mostrar revisión, observado, rechazado, listo para pago o completado.

## Inconsistencias registradas — no corregidas

- **IMPLEMENTADO EN CÓDIGO:** Prisma define `READY_FOR_PAYMENT` y `COMPLETED`, pero la UI maneja un vocabulario propio y normaliza `APPROVED` como listo para pago; `APPROVED` no pertenece al enum actual de estado general.
- **IMPLEMENTADO EN CÓDIGO:** `ValidateDocumentService` referencia estados `APPROVED` y `CANCELLED` que no están definidos en `ApplicationStatus`.
- **IMPLEMENTADO EN CÓDIGO:** consulta busca `DIRECTIVA` y `PAGOS`, mientras el catálogo sembrado incluye `COMITE` y no incluye `PAGOS`.
- **IMPLEMENTADO EN CÓDIGO:** el seed marca `LEGAL` y `COMUNICACIONES` como requeridos, pero el calculador de pago no los exige.
- **IMPLEMENTADO EN CÓDIGO:** la ruta pública recibe `documentType`, pero no lo utiliza en su filtro.
- **PENDIENTE DE CONFIRMACIÓN:** cuál debe ser el conjunto oficial de áreas y condiciones obligatorias para cada tipo de afiliación.

