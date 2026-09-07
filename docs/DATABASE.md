# Modelo de datos relevante

## Fuente y alcance

Este documento refleja `prisma/schema.prisma` sin modificarlo. Describe las entidades relevantes para autenticación, afiliaciones, validación y pagos.

## Identificadores de postulación

`MembershipApplication` tiene tres identificadores diferentes:

- `id`: entero autoincremental, clave primaria; es el FK que usa `Payment`.
- `applicationCode`: cadena única para identificar/mostrar el expediente.
- `trackingCode`: cadena única usada para recuperación y consulta del trámite.

No son intercambiables.

## Entidades principales

### User y Person

`User` (`auth_users`) representa la cuenta: correo único, estado, tipo, rol, sesiones y relación opcional uno-a-uno con `Person` mediante `personId` único. `Person` (`persons`) registra identidad; su combinación `documentType + documentNumber` es única y puede tener aplicaciones, contactos, direcciones, estudios, empleo y experiencia.

`Role`, `Permission` y `RolePermission` implementan RBAC. `Session` y `UserSession` representan sesiones persistidas; `SecurityEvent` registra eventos.

### MembershipApplication

`membership_applications` representa la postulación. Contiene identidad de la solicitud, `affiliateType`, `status`, paso actual, `draftData`, fechas y FK opcional a `Person`. Se relaciona con códigos de verificación, avales, validaciones de área, documentos, historial, observaciones, pagos y validaciones normalizadas.

Tiene índices por documento, documento+estado, correo, estado, persona, persona+estado, `applicationCode` y `trackingCode`; los dos últimos además son únicos.

### Validación y avales

- `MembershipDepartment`: catálogo de áreas con código único, orden y banderas `isRequired` / `isActive`.
- `MembershipValidation`: una fila por aplicación y departamento; la restricción única `[applicationId, departmentId]` evita duplicados. Tiene estado, evaluador y fecha.
- `MembershipValidationHistory`: historial de acciones por validación.
- `MembershipApproval`: aval de una aplicación hacia una persona patrocinadora, con estado, motivo de rechazo e historial auxiliar JSON.
- `MembershipObservation`: observaciones con área, descripción, rutas de campos, adjunto, estado y fecha de resolución.
- `MembershipHistory`: historial de transición del estado general.

## Pagos y facturación

```text
MembershipApplication (1) ──< Payment (N)
Payment (1) ── Billing (0..1)
Billing (1) ── Invoice (0..1)
```

### Payment (`payments`)

- PK `id: Int` autoincremental.
- FK requerida `applicationId` a `MembershipApplication`.
- `gateway`, por defecto `NIUBIZ`; `transactionId`, `authorizationCode` y `responseCode` opcionales.
- `totalAmount Decimal(10,2)`, `currency` por defecto `PEN`, `status` por defecto `PENDING`, `paymentDate` y `gatewayPayload` opcionales.
- Índices: `applicationId`, `status`, `transactionId`.

Una aplicación puede tener varios pagos; el schema no declara unicidad por aplicación, transacción o estado.

### Billing (`billings`)

- PK `id: Int` autoincremental.
- `paymentId` es único y FK requerida a `Payment`: como máximo un Billing por pago.
- Requiere `taxId` y `businessName`; dirección, país y email son opcionales.
- `countryId` referencia opcionalmente a `Country` con `onDelete: Restrict`.
- Índices: `paymentId`, `taxId`, `countryId`.

### Invoice (`invoices`)

- PK `id: Int` autoincremental.
- `billingId` es único y FK requerida: como máximo un Invoice por Billing.
- Requiere `type`, `serie`, `number` e `issueDate`; tiene referencias SUNAT y URLs XML/PDF/CDR opcionales.
- `status` es `String` y por defecto `EMITTED`.
- La combinación `[serie, number]` es única; tiene índice `billingId`.

## Enums relevantes

- `ApplicationStatus`: `DRAFT`, `PENDING`, `UNDER_EVALUACION`, `OBSERVED`, `RESOLVED`, `READY_FOR_PAYMENT`, `COMPLETED`, `REJECTED`.
- `ValidationStatus`: `PENDING`, `UNDER_EVALUATION`, `OBSERVED`, `RESOLVED`, `APPROVED`, `REJECTED`.
- `EndorsementStatus`: `PENDING`, `APPROVED`, `REJECTED`, `INACTIVE`.
- `PaymentStatus`: `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `REFUNDED`.
- `PaymentGateway`: `NIUBIZ`, `IZIPAY`, `STRIPE`, `PAYPAL`, `BANK_TRANSFER`.
- `Currency`: `PEN`, `USD`.
- `InvoiceType`: `BOLETA`, `FACTURA`, `CREDIT_NOTE`, `DEBIT_NOTE`.

No inferir columnas, relaciones o transiciones de estado no presentes en el schema o en los servicios del dominio.

