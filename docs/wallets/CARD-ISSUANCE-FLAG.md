# CARD_ISSUANCE_ENABLED — comportamiento y configuracion

## Definicion
`getCardIssuanceEnabled()` (`lib/config/env.ts`) devuelve `true` **solo** si
`CARD_ISSUANCE_ENABLED` vale `"true"` (case-insensitive, con trim). Cualquier
otro valor o ausencia => `false` (seguro por defecto).

## Donde se consume
- `app/(workspace)/intranet/mi-cuenta/carnet/page.tsx`: `issuanceEnabled` para
  mostrar el boton "Generar mi carnet" (no afecta ver un carnet ya emitido).
- `POST /api/afiliaciones/carnet/me`: bloquea la autoemision.
- `POST /api/afiliaciones/carnet/[personId]/issue` y `.../regenerate`:
  bloquean emision/regeneracion.
- `GET /api/afiliaciones/carnet/[personId]`: informa el flag.

## Relacion con PDF y Wallet
- PDF y emision del carne dependen de que exista un `AssociateCard` emitido.
- Google/Apple Wallet requieren un carne emitido (`loadWalletCard` lanza
  `CARD_NOT_ISSUED` si no existe). Por tanto, **sin emision no hay pase**.
- Con el flag en `false`, un carne **ya emitido** sigue visible, su PDF/QR
  siguen disponibles y Wallet sigue operando para ese carne. El flag solo
  impide **nuevas** emisiones/regeneraciones via UI/API.

## Estado observado en QA
- `CARD_ISSUANCE_ENABLED` **no esta definido** (ni en SSM `/afiliaciones/qa/*`
  ni en el env del contenedor): valor efectivo `false`.
- Aun asi, el asociado QA-TEST-0004 (personId 13289) tiene un `AssociateCard`
  `ISSUED` y un pase Google `SYNCED`, por lo que el carnet y Wallet funcionan.
- Su ausencia parece **intencional** (evita autoemision en QA). No se modifico.

## Configuracion recomendada por entorno
- **LOCAL**: `CARD_ISSUANCE_ENABLED=true` si se necesita emitir/regenerar en
  pruebas; si no, `false`.
- **QA**: mantener `false` salvo prueba explicita que requiera emitir carnets
  nuevos; en ese caso habilitarlo por ventana y revertir. Requiere autorizacion.
- **PROD**: segun el procedimiento de release; no cambiar desde este trabajo.
