# Politica de allowlist vs. emision, actualizacion y revocacion (Google Wallet)

## Regla
`CARD_WALLET_ALLOWED_PERSON_IDS` / `CARD_WALLET_ALLOWED_ASSOCIATE_PREFIXES`
restringen **nuevas emisiones/instalaciones** (obtener un enlace de guardado),
no el mantenimiento de pases ya emitidos.

| Operacion | Allowlist | Racional |
|---|---|---|
| Emision / instalacion (`getGoogleLink`) | **Si** | Evita emitir pases nuevos fuera del piloto. |
| Actualizacion de pase existente (`syncPass`) | **No** | El pase ya esta instalado; debe mantenerse consistente. |
| Revocacion de pase existente (`syncPass`, `revoked=true`) | **No** | Un carné revocado debe dejar de ser valido SIEMPRE. |
| Registro/reinstalacion de dispositivo | segun emision | Requiere enlace; el flujo de instalacion ya esta gateado. |

## Defecto corregido
Antes, `CardWalletService.syncPass` aplicaba la allowlist **antes** de procesar
la revocacion, devolviendo `ALLOWLIST_BLOCKED`. Efecto: un pase de un asociado
que salia de la allowlist no podia revocarse y seguia valido en Google Wallet.

Correccion: se retiro el chequeo de allowlist del camino de `syncPass`; se
mantiene solo en `getGoogleLink` (nueva emision). Regresiones en
`CardWalletService.test.ts`:
- revocar pase con asociado fuera de allowlist -> `REVOKED`.
- actualizar pase existente fuera de allowlist -> `SYNCED`.

## Job FAILED observado (QA)
- card `qacard725097059dbf655164e46998` (personId 13286, QA-TEST-0001), estado
  actual **ISSUED** (no revocado), operacion historica **REVOKE**, error
  `ALLOWLIST_BLOCKED`, `attempt_count=1`, `max_attempts=8`.
- Es un trabajo **obsoleto**: el estado institucional vigente (ISSUED) es la
  fuente de verdad. Con la correccion, un retry lo reconcilia (update) y lo
  completa, sin quedar en FAILED.

## Reintento idempotente (preparado, NO ejecutado)
```bash
# informativo (no toca BD ni proveedor)
npx tsx scripts/wallet-sync-retry.ts --card qacard725097059dbf655164e46998
# ejecucion real (REQUIERE AUTORIZACION: llama Google Wallet real)
npx tsx scripts/wallet-sync-retry.ts --card qacard725097059dbf655164e46998 --confirm
```
No ampliar la allowlist para ocultar el problema. No borrar jobs manualmente.
