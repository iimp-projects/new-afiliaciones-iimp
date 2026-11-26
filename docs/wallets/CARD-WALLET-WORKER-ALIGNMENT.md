# Alineacion del worker Wallet de QA (app + worker)

## Causa raiz
`qa-deploy.yml` construye y publica la imagen del worker en el mismo release
(inmutable) que la app:

- App:    `…/afiliaciones-qa-app:qa-<sha40>-<run>-<attempt>`
- Worker: `…/afiliaciones-qa-app:qa-wallet-sync-<sha40>-<run>-<attempt>`

Pero el documento SSM `AfiliacionesQaDeploy` solo despliega la app. El host
ejecutaba un script con la imagen worker **pineada manualmente**
(`qa-wallet-sync-4ef5149…`), por lo que cada deploy actualizaba la app y dejaba
el worker en una version anterior.

## Correccion persistente (este repo)
`scripts/qa/afiliaciones-wallet-sync.sh` deriva la imagen del worker **desde la
imagen de la app activa** escrita por el deploy en
`/opt/afiliaciones-qa/.qa-app-image.override.yml`:

1. Lee `services.app.image`.
2. Exige el patron inmutable `qa-<sha40>-<run>-<attempt>`.
3. Deriva `qa-wallet-sync-<sha40>-<run>-<attempt>`.
4. Hace `docker pull` y `docker run --rm --pull never` (oneshot).

Asi **cada deploy futuro mantiene app y worker alineados** sin editar el host ni
fijar tags a mano. No usa `:latest`.

## Instalacion unica (requiere autorizacion de infra/ops)
El archivo vive en el repo, pero debe instalarse una vez en el host (misma ruta
que ya usa `afiliaciones-qa-wallet-sync.service`):

```bash
# 1) respaldo
sudo cp /usr/local/bin/afiliaciones-wallet-sync.sh /usr/local/bin/afiliaciones-wallet-sync.sh.bak-$(date +%Y%m%d%H%M%S)
# 2) instalar la version derivada (contenido de scripts/qa/afiliaciones-wallet-sync.sh)
sudo install -m 0755 /ruta/al/repo/scripts/qa/afiliaciones-wallet-sync.sh /usr/local/bin/afiliaciones-wallet-sync.sh
# 3) verificar derivacion sin ejecutar worker
DRY_RUN=1 /usr/local/bin/afiliaciones-wallet-sync.sh
# 4) ejecutar una pasada manual (opcional, autorizado)
sudo systemctl start afiliaciones-qa-wallet-sync.service
sudo journalctl -u afiliaciones-qa-wallet-sync.service -n 20 --no-pager
```

Rollback: restaurar el `.bak` y `systemctl start afiliaciones-qa-wallet-sync.service`.

> No se aplico ningun cambio al servidor en esta fase. Requiere autorizacion
> especifica porque modifica `/usr/local/bin` del host QA.

## Verificacion
- `DRY_RUN=1` imprime exactamente `…:qa-wallet-sync-<sha40>-<run>-<attempt>` igual al release de la app.
- `systemctl list-timers afiliaciones-qa-wallet-sync.timer` activo (~60s).
- `journalctl` muestra `card_wallet_sync_run` con `disabled:false`.
- No deben existir dos contenedores worker simultaneos (oneshot con `--rm`).
