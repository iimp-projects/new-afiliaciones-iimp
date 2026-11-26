# Carné Virtual / Wallet — Guard de despliegue QA

## Contexto de la regresión (2026-11-26)
QA quedó sin Carné mejorado ni Google Wallet porque el PR de pagos (#65) nació de
una base (`qa@c059644`) que no contenía el módulo Wallet, y luego se desplegó
`qa@891b287` (sin Wallet) sobre la imagen Wallet que estaba activa (`ce1b991`).
No hubo revert ni reset: fue **divergencia de rama + despliegue de un artefacto
funcionalmente incompleto**.

## Reglas para evitar recurrencia
1. **Base correcta:** toda rama que vaya a QA debe partir de `origin/qa` vigente y,
   si toca carné/wallet/pagos, debe **incluir** el módulo Wallet.
2. **No desplegar ramas incompletas:** antes de `qa-deploy.yml`, verificar que la
   rama contiene wallet y pagos (ver guard más abajo).
3. **Un solo despliegue a la vez:** `qa-deploy.yml` ya usa `concurrency: deploy-qa`
   con `cancel-in-progress: false`. No lanzar ejecuciones concurrentes.
4. **Verificación post-deploy obligatoria:** confirmar run `success`, SHA, tag y
   digest de la imagen, y que el contenedor `app` ejecuta esa imagen (no basta con
   que el workflow haya iniciado).
5. **PROD separado:** no propagar `prod-deploy.yml` desde ramas funcionales;
   `AUTHORIZED_COMMIT_SHA` de PROD se autoriza con su propio flujo.

## Guard automático en CI
`modules/afiliaciones/carnet/wallet/Tests/walletRegressionGuard.test.ts` se ejecuta
con `npm run test` (incluido en `npm run check`, quality gate de `qa-deploy.yml`).
Valida, sin conteos frágiles:
- Presencia de `lib/config/wallet.ts`, `WalletButtons`, servicios, endpoints y worker.
- `CardView` importa `WalletButtons` y usa vigencia/`issuedAt` dinámicos.
- La página del carné resuelve `getWalletFlags`/`getWalletProviderMode`.
- Existen migraciones de `card_wallet_passes` y `card_wallet_sync_jobs`.
- Coexistencia de archivos del flujo de pagos.
- Contrato de flags por proveedor.

## Flujo recomendado
1. Rama de integración desde `origin/qa`.
2. Merge de la línea Wallet aprobada.
3. `npm run check` + build.
4. `workflow_dispatch` de `qa-deploy.yml` sobre la rama de integración.
5. Smoke + validación funcional.
6. PR a `qa`, merge y redeploy desde `qa`.
