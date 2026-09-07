# Dominio de pagos

## Contexto

El pago se relaciona con una `MembershipApplication` y el flujo actual muestra la experiencia de pago cuando el estado normalizado es `READY_FOR_PAYMENT`. La elegibilidad y sus condiciones exactas se documentan en `BUSINESS_RULES.md`. Este documento no implementa ni confirma una integración Niubiz.

## Estado actual comprobado

| Pieza | Estado actual |
| --- | --- |
| `StatusPaymentReady` y `PaymentStepper` | UI de tres pasos existente. |
| `PaymentProcessStep` y `PaymentFooter` | Muestran UI y alertas; no inician un pago real. |
| `PaymentApi` | Cliente HTTP para `POST /api/payments`, no consumido por la UI actual. |
| `PaymentService` | Selecciona mock o stub Niubiz. |
| Mock | Devuelve escenarios en memoria `PAID`, `FAILED` o `PENDING`; no persiste. |
| Stub Niubiz | Lanza un error intencional; no hay integración. |
| `/api/payments` | Valida parcialmente el request y delega al servicio; no persiste ni valida elegibilidad. |
| Prisma | Define `Payment`, `Billing` e `Invoice`, sin repositorio de pagos actual. |

Por tanto, el dominio existe como base parcial, pero no está conectado de punta a punta ni registra pagos/facturación.

## Modelo de datos actual

```text
MembershipApplication 1 ──< N Payment
Payment 1 ── 0..1 Billing
Billing 1 ── 0..1 Invoice
```

`Payment` registra aplicación, gateway, identificadores/respuestas del proveedor, monto decimal, moneda, estado, fecha y payload JSON opcional. `Billing` pertenece de forma única a un pago y contiene identificador fiscal, razón social, dirección, país y correo. `Invoice` pertenece de forma única a la facturación y contiene tipo, serie, número, fecha y referencias SUNAT. Ver `DATABASE.md` para las restricciones exactas.

Estados Prisma reales: `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `REFUNDED`. Gateways reales: `NIUBIZ`, `IZIPAY`, `STRIPE`, `PAYPAL`, `BANK_TRANSFER`.

## Arquitectura futura propuesta

```text
UI → PaymentApi → API Route / Server Action → PaymentService
  → PaymentRepository → Prisma

PaymentService → PaymentProvider
  ├─ MockPaymentProvider
  └─ NiubizPaymentProvider
```

Es una propuesta, no implementación actual. Debe seguir la referencia de postulación: DTOs/validación de entrada, Service como caso de uso y Repository para persistencia. El proveedor debe permanecer aislado de UI y Prisma.

## Mock y ambientes

El mock actual sirve para desarrollo local y pruebas con resultados `PAID`, `FAILED` y `PENDING`. La intención es configurar TEST y luego PRODUCTION por variables de entorno. Por ahora, el alcance seguro es MOCK/TEST.

## Niubiz Pago Web — pendiente

La integración real depende del producto contratado, Merchant ID, credenciales, endpoints, payloads, headers, modalidad de checkout, callback, webhook si aplica, firmas y métodos de pago habilitados. Ninguno de esos contratos se debe inventar ni implementar hasta contar con fuentes oficiales.

La arquitectura puede contemplar `CARD`, `YAPE` y `OTHER` como abstracciones de método, pero ello no confirma que Niubiz los habilite ni que pertenezcan al modelo actual.

## Seguridad requerida para la futura implementación

- Secretos y llamadas al proveedor solo en backend; nunca `NEXT_PUBLIC_*`.
- El servidor controla aplicación, elegibilidad, monto y moneda.
- La confirmación de pago debe verificarse en backend, no confiar en el navegador.
- No almacenar PAN, CVV ni datos equivalentes de tarjeta.
- Sanitizar y minimizar `gatewayPayload`.
- Diseñar idempotencia, callbacks/webhooks firmados, reintentos y conciliación antes de habilitar Niubiz TEST.

## Monto y facturación

La UI actual muestra S/ 300.00, mientras un seed demo registra S/ 150.00. No existe una regla central confirmada de monto; no decidirlo ni codificarlo aún.

La emisión de comprobantes debe ocurrir después de un pago confirmado: `Payment → Billing → Invoice`. El schema soporta la relación, pero no existe servicio de emisión/facturación electrónica implementado.

