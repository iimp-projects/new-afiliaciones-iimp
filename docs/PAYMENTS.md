# Dominio de pagos

Este documento describe el código observado en `modules/afiliaciones/payments` y `app/api/payments`. No confirma habilitación contractual de Niubiz en producción.

## Estado implementado

El dominio ya contiene:

- schemas Zod para creación, autorización y facturación;
- `PaymentService` como orquestador;
- `PaymentRepository` con persistencia y transacciones;
- proveedores `MockPaymentProvider` y `NiubizPaymentProvider`;
- creación de sesión Checkout y autorización Niubiz;
- callback, restauración de estado y reset de sandbox;
- resolución de monto en servidor;
- facturación y verificación RUC;
- email de confirmación;
- recálculo de solicitud e integración/provisión de asociado después de pago.

El proveedor Niubiz aplica actualmente guards que exigen ambiente `TEST`. No declares producción lista sin validar contrato oficial, credenciales, callbacks, conciliación y seguridad.

## Flujo

```text
Consulta/UI
  → autorización temporal de aplicación
  → POST /api/payments
  → PaymentService.initiate
  → elegibilidad + monto + billing
  → PaymentRepository crea PENDING
  → PaymentProvider
      ├─ MOCK: resultado simulado persistido
      └─ NIUBIZ TEST: security → session → checkout

Callback/authorize
  → referencia temporal + transactionToken
  → claim PENDING → PROCESSING
  → autorización Niubiz
  → persistencia PAID/FAILED/PENDING
  → recálculo de aplicación
  → email e integración post-commit
```

## Invariantes

- Solo una aplicación `READY_FOR_PAYMENT`, no eliminada, puede iniciar pago.
- La cookie/autorización temporal debe corresponder al `applicationId`.
- El monto y moneda se resuelven en servidor.
- No puede existir otro pago activo salvo la reanudación explícita de Niubiz TEST.
- Un pago Niubiz solo se autoriza desde `PENDING` y se reclama antes de llamar al proveedor.
- La transición a `PAID` y el recálculo asociado se persisten transaccionalmente.
- Fallos de red/autorización incierta devuelven el pago a `PENDING` para no marcar un rechazo falso.
- No se almacenan PAN ni CVV; solo datos de respuesta permitidos y tarjeta enmascarada.

## Modelo persistido

```text
MembershipApplication 1 ──< N Payment
Payment 1 ── 0..1 Billing
Billing 1 ── 0..1 Invoice
```

Estados Prisma: `PENDING`, `PROCESSING`, `PAID`, `FAILED`, `REFUNDED`.

Gateways del schema: `NIUBIZ`, `IZIPAY`, `STRIPE`, `PAYPAL`, `BANK_TRANSFER`. Que un enum exista no significa que el proveedor esté implementado.

## Endpoints observados

| Ruta | Propósito |
| --- | --- |
| `POST /api/payments` | Inicia un pago autorizado. |
| `POST /api/payments/authorize` | Autoriza un pago Niubiz desde el cliente autorizado. |
| `POST /api/payments/niubiz/callback` | Recibe token de transacción y redirige el resultado. |
| `GET /api/payments/restore` | Restaura contexto mediante referencia temporal. |
| `POST /api/payments/[paymentId]/sandbox-reset` | Operación controlada para sandbox. |

## Configuración

- `PAYMENT_PROVIDER`: `MOCK` o `NIUBIZ`.
- `PAYMENT_ENVIRONMENT`: `TEST` o `PRODUCTION`; el proveedor actual solo declara readiness para TEST.
- `PAYMENT_AUTH_SECRET`: secreto exclusivo de al menos 32 caracteres para firmar autorizaciones temporales de pago; no reutilizar `AUTH_SECRET`.
- Variables `NIUBIZ_TEST_*` y `NIUBIZ_PROD_*`: consulta [ENVIRONMENT.md](ENVIRONMENT.md) y `PaymentConfig.ts`.

No copies payloads ni URLs desde ejemplos no oficiales. Los contratos del proveedor deben verificarse con documentación del producto contratado.

## Controles y riesgos pendientes

- autorización, callback y restauración usan propósitos criptográficos separados;
- el callback tiene JTI persistente de un solo consumo;
- restauración requiere la referencia y una cookie HttpOnly ligada a ella;
- una aprobación se acepta solo si monto, moneda y número de orden coinciden con el pago persistido;
- `gatewayPayload` conserva únicamente metadata allow-listed.

Antes de producción sigue pendiente implementar y probar la autenticidad/firma propia del callback según el contrato oficial del producto Niubiz contratado. No inventar headers o algoritmos a partir de ejemplos no oficiales. Consulta [SECURITY.md](SECURITY.md) y [auditoria_seguridad.md](../auditoria_seguridad.md).

## Pruebas

El módulo contiene pruebas de Service, Repository, settings, Niubiz, callbacks, clasificación de respuestas, billing e integración de sandbox. Toda modificación debe cubrir:

- autorización inválida;
- solicitud no elegible;
- pago duplicado/concurrente;
- éxito, rechazo e incertidumbre del proveedor;
- idempotencia de callback;
- monto y moneda distintos;
- transición y efectos post-commit.
