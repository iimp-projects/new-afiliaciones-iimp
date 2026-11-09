# NIUBIZ-CERT-01 — Corrección integral para certificación Niubiz V3

> Documento de evidencia y matriz de estado. Generado el 2026-10-20.
> Ámbito: LOCAL/QA únicamente. Sin despliegues, pagos reales ni cambios de credenciales.

## Estado global

```text
NIUBIZ_CERT_01_STATUS        = PARTIAL
READY_FOR_SANDBOX_CERTIFICATION = YES
READY_FOR_PRODUCTION         = NO
```

- `PARTIAL`: se implementaron y probaron de forma automatizada los requisitos técnicos de código (Security, Session, Checkout, Authorization, fechas, pruebas). Queda pendiente la **validación real en Sandbox** con credenciales oficiales y la **confirmación contractual** de la guía oficial V3 (no adjunta en el repositorio).
- `READY_FOR_SANDBOX_CERTIFICATION = YES`: el código compila, lint, 1867 tests pasan y los contratos de request/response están cubiertos por pruebas sin secretos.
- `READY_FOR_PRODUCTION = NO`: falta validación real Sandbox, autenticidad del callback según contrato oficial y autorización contractual.

## FASE 00 — Seguridad y preparación

- Rama de trabajo: `feature/niubiz-cert-01` (creada desde `feature/api-verificacion-asociados`).
- Commit base: `5bbb30c feat(afiliaciones): implement institutional associates verification API`.
- Cambios preexistentes preservados y **no incluidos** en este trabajo:
  - `infra/terraform/environments/prod/variables.tf` (ya modificado antes de iniciar; NO se tocó).
- No se realizaron commits, push ni cambios de configuración Git (según indicación del usuario: "crear rama y NO commitear").
- Fuentes leídas: `AGENTS.md`, `BIBLE.md`, `RULES.md`, `docs/PAYMENTS.md`, `docs/ENVIRONMENT.md`.

### Incumplimientos confirmados antes de cambiar código

| # | Incumplimiento | Fase |
|---|---|---|
| G1 | `NiubizSecurityService.getAccessToken` sin timeout y sin clasificación de error de red. | 01 |
| G2 | `merchantDefineData` sin `MDD75` ni `MDD77`. | 02 |
| G3 | `dataMap` de Session (6 campos de titular) nunca se enviaba en el flujo real. | 02 |
| G4 | Sin validación que impida enviar una sesión incompleta. | 02 |
| G5 | Sin fallback institucional configurable (server-side) para los datos del titular. | 02 |
| G6 | `expirationMinutes` sin tope de 20 minutos. | 03 |
| G7 | `TRANSACTION_DATE` interpretado como UTC en lugar de America/Lima (-5h). | 05 |
| G8 | Autenticidad del callback de Niubiz sin verificación de firma propia (solo referencia firmada de la app). | 04 |

## Matriz de requisitos

Leyenda estado: **PASS** = verificado por código/prueba; **PENDING** = falta validación Sandbox/contrato; **FAIL** = no implementado.

| Requisito de la guía | Archivo y función | Estado | Cambio realizado | Prueba | Evidencia | Riesgo pendiente |
|---|---|---|---|---|---|---|
| Security GET desde backend | `Services/Niubiz/NiubizSecurityService.ts#buildRequest/getAccessToken` | PASS | sin cambio estructural | `NiubizServices.test.ts` | archivo + test | — |
| Basic Auth solo en servidor | `NiubizSecurityService.ts#buildRequest` | PASS | sin cambio | test "no expone credenciales" | `NiubizCertification.test.ts` | — |
| Manejo 401/403/5xx | `NiubizSecurityService.ts#getAccessToken` | PASS | `NiubizSecurityHttpError(status)` | test por estado | `NiubizCertification.test.ts` | — |
| Timeout y error de red | `NiubizSecurityService.ts#getAccessToken` | PASS | `AbortSignal.timeout(20s)` + `NiubizSecurityNetworkError` | test timeout | `NiubizCertification.test.ts` | — |
| MDD4 correo estable | `Providers/NiubizPaymentProvider.ts#buildMerchantDefineData` | PASS | se conserva | test MDD | `NiubizCertification.test.ts` | — |
| MDD32 id único permanente | `NiubizPaymentProvider.ts#buildMerchantDefineData` | PASS | `personId` → fallback `documentNumber` (nunca `paymentId`) | test | `NiubizCertification.test.ts` | — |
| MDD75 Registrado/Invitado/Empleado | `NiubizPaymentProvider.ts#buildMerchantDefineData` | PASS | se agrega según `personId` | test Registrado/Invitado | `NiubizCertification.test.ts` | "Empleado" no aplica al flujo |
| MDD77 (1 Invitado / día registro) | `NiubizPaymentProvider.ts#buildMerchantDefineData` | PASS | `1` para Invitado; se omite para Registrado (no inventar antigüedad) | test | `NiubizCertification.test.ts` | requiere confirmar semántica con Niubiz |
| `dataMap` 6 campos obligatorios | `NiubizPaymentProvider.ts#buildCardholderDataMap` | PASS | se implementa con datos reales (teléfono) + fallback institucional | test | `NiubizCertification.test.ts` | valores institucionales deben confirmarse |
| Verificación de sesión completa | `NiubizPaymentProvider.ts#assertSessionDataComplete` | PASS | lanza `NiubizProviderConfigurationError` si falta MDD/campo | test incompleta | `NiubizCertification.test.ts` | — |
| Checkout Sandbox correcto | `Components/NiubizCheckout.tsx` + `buildCheckoutConfig` | PASS | script desde `checkoutUrl` configurado; `VisanetCheckout` | — | archivo | requiere Sandbox real |
| `merchantId/sessionToken/amount/purchaseNumber` | `NiubizPaymentProvider.ts#buildCheckoutConfig` | PASS | presentes | `NiubizServices.test.ts` | test | — |
| `action` en mismo dominio | `NiubizPaymentProvider.ts#buildCheckoutConfig` (callbackUrl) | PASS | URL del propio dominio | test callback | `callback/route.test.ts` | — |
| Sin token sensible en querystring | `Services/PaymentAuthorizationService.ts` + `callback/route.ts` | PASS | `payment_callback` = referencia firmada de un solo uso; `transactionToken` solo por POST | test | `route.test.ts` | — |
| `purchaseNumber` numérico ≤12 | `NiubizPaymentProvider.ts#buildCheckoutConfig` | PASS | `String(paymentId)` | test | `NiubizCertification.test.ts` | reutilizado en resume (mismo intento) |
| Expiración máx 20 min | `NiubizPaymentProvider.ts#clampedSessionExpirationMinutes` | PASS | clamp [1,20] | test | `NiubizCertification.test.ts` | — |
| Protección doble pago/envío | `Services/PaymentService.ts` (claim + idempotencia) | PASS | `claimPendingNiubizPayment` + JTI callback | tests existentes | `PaymentService.test.ts` | — |
| POST Authorization solo backend | `Services/Niubiz/NiubizAuthorizationService.ts` | PASS | servidor | — | archivo | — |
| `channel:web`, `captureType:manual`, `countable:true` | `NiubizPaymentProvider.ts#authorize` | PASS | presentes | `NiubizServices.test.ts` | test | — |
| `order.*` (amount/currency/purchaseNumber/tokenId) | `NiubizAuthorizationService.ts#buildRequest` | PASS | presentes | `NiubizServices.test.ts` | test | — |
| 5 campos `dataMap` de autorización | `NiubizPaymentProvider.ts#buildAuthorizationDataMap` | PASS | presentes | `NiubizServices.test.ts` | test | — |
| `STATUS=Authorized` / denegación | `Services/Niubiz/NiubizAuthorizationResultClassifier.ts` | PASS | clasificación APPROVED/BUSINESS_DECLINED/TECHNICAL_UNCERTAIN | tests | `NiubizAuthorizationResultClassifier.test.ts` | — |
| No marcar rechazo si indeterminado | `NiubizResponseMapper.ts` + `PaymentService.ts#authorizeNiubizPayment` | PASS | TECHNICAL_UNCERTAIN → PENDING | tests | `PaymentService.test.ts` | — |
| Validación monto/moneda/referencia vs BD | `PaymentService.ts#assertGatewayResultMatchesPayment` | PASS | compara monto/moneda/purchaseNumber | tests | `PaymentService.test.ts` | — |
| Idempotencia y concurrencia | `PaymentAuthorizationService.ts` (JTI) + claim | PASS | JTI de un solo consumo | tests | `PaymentAuthorizationService` | — |
| Autenticidad del callback | `callback/route.ts` | PENDING | referencia firmada de la app; **sin** firma Niubiz (no inventar) | tests de redirect | `route.test.ts` | requiere contrato oficial Niubiz |
| `TRANSACTION_DATE` America/Lima | `NiubizResponseMapper.ts#parseTransactionDate` | PASS | UTC-5 fijo (sin DST) | test | `NiubizCertification.test.ts` | confirmar semántica con Niubiz |
| Respuesta aprobada (orden/tarjeta/importe/moneda/fecha) | `NiubizResponseMapper.ts#mapAuthorization` | PASS | ya mapeado; solo PAN enmascarado | test | `NiubizCertification.test.ts` | — |
| Respuesta rechazada (motivo `ACTION_DESCRIPTION`) | `NiubizResponseMapper.ts` | PASS | `failureReason` | test | `NiubizCertification.test.ts` | — |
| Términos y condiciones sin premarcar | `postulacion/.../DeclarationStep.tsx` | PASS | checkbox `declarationAccepted || false` | — | archivo | — |
| Confirmación mayoría de edad | `postulacion/.../PersonalDataStep.tsx` | PASS | datepicker restringe a +18 | — | archivo | — |
| Datos de contacto institucionales | `shared/Components/PublicFooter.tsx` | PASS | dirección, email, horario | — | archivo | — |
| Desglose comercial (con IGV) | `consulta/.../PaymentProcessStep.tsx` | PENDING | muestra Inscripción + Cuota + Total | — | archivo | falta línea IGV explícita; confirmar con Niubiz/IIMP |
| Producto/concepto/cantidad/monto/moneda | `PaymentProcessStep.tsx` + `PaymentAmountResolver.ts` | PASS | dos conceptos con monto en PEN | — | archivo | — |
| Eliminar/volver al detalle | `consulta/.../PaymentStepper.tsx` | PASS | navegación entre pasos | — | archivo | — |
| Producto de prueba importe mínimo | `Config/PaymentConfig.ts` (`PAYMENT_TEST_AMOUNT`) | PASS | importe de prueba controlado en TEST | — | archivo | — |

## FASE 07 — Pruebas automatizadas ejecutadas

```text
npm run typecheck  → OK (0 errores)
npm run lint       → OK (0 errores)
npm run test       → OK (210 archivos, 1867 tests)
npm run build      → OK (1 warning preexistente de instrumentation.ts, no relacionado)
```

Pruebas nuevas: `modules/afiliaciones/payments/Tests/NiubizCertification.test.ts` (15 tests):
MDD obligatorios, DataMap completo, Checkout válido/inválido, aprobación, rechazo, timeout, sesión incompleta, fechas (America/Lima) y datos comerciales de respuesta.

## FASE 08 — Evidencias

| # | Evidencia requerida | Estado | Referencia |
|---|---|---|---|
| 1 | Términos y condiciones | PASS (código) | `DeclarationStep.tsx:291`, `EducationStep.tsx:480` |
| 2 | Checkout Niubiz y URL | PASS (código) / PENDING (Sandbox real) | `NiubizCheckout.tsx`, `buildCheckoutConfig` |
| 3 | Pantalla aprobada | PENDING | falta ejecutar Sandbox real |
| 4 | Pantalla denegada | PENDING | falta ejecutar Sandbox real |
| 5 | Security backend | PASS (código+test) | `NiubizSecurityService.ts` |
| 6 | Session backend | PASS (código+test) | `NiubizSessionService.ts`, `buildSessionRequest` |
| 7 | Checkout frontend | PASS (código) | `NiubizCheckout.tsx` |
| 8 | Authorization backend | PASS (código+test) | `NiubizAuthorizationService.ts` |
| 9 | Lógica aprobada/denegada | PASS (código+test) | `NiubizAuthorizationResultClassifier.ts` |

> No se fabrican capturas de pruebas no ejecutadas. Las evidencias Sandbox (3, 4) quedan **PENDIENTE**; requieren credenciales `NIUBIZ_TEST_*` oficiales y un ambiente Sandbox alcanzable desde este entorno.

## FASE 09 — Cambios realizados (archivos)

| Archivo | Cambio |
|---|---|
| `Services/Niubiz/NiubizSecurityService.ts` | timeout 20s + `NiubizSecurityNetworkError` |
| `Config/PaymentConfig.ts` | `cardholderDataMap` + env `NIUBIZ_*_CARDHOLDER_*` |
| `Providers/NiubizPaymentProvider.ts` | MDD75/MDD77, `buildCardholderDataMap`, `assertSessionDataComplete`, `assertCardholderDataConfigured`, clamp expiración |
| `Services/Niubiz/NiubizResponseMapper.ts` | `TRANSACTION_DATE` America/Lima (UTC-5) |
| `Services/PaymentService.ts` | `initiateWithProvider` mapea config error → 503 |
| `Tests/*` | tests actualizados + `NiubizCertification.test.ts` |

## Riesgos pendientes

1. **Autenticidad del callback**: no se verifica una firma/header propia de Niubiz porque el contrato oficial no la define; solo se usa la referencia firmada de la app. Requiere contrato oficial antes de producción.
2. **Semántica de MDD75/MDD77 y `TRANSACTION_DATE`**: confirmar con la guía oficial V3 adjunta (no presente en el repositorio).
3. **Datos institucionales del `dataMap`**: los valores de fallback (`NIUBIZ_*_CARDHOLDER_*`) deben confirmarse con IIMP/Niubiz; no se inventaron, quedan pendientes de configuración.
4. **IGV en el desglose comercial**: no se muestra una línea explícita de IGV; confirmar si aplica.
5. **`purchaseNumber` en resume**: se reutiliza el `paymentId` en la reanudación del mismo intento; confirmar que no genera código 300 (pedido duplicado).
