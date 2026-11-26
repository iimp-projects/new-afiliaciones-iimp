# Alineacion del worker Wallet de QA (app + worker)

## Causa raiz
`qa-deploy.yml` construye y publica la imagen del worker en el mismo release
inmutable que la app:

- App:    `…/afiliaciones-qa-app:qa-<sha40>-<run>-<attempt>`
- Worker: `…/afiliaciones-qa-app:qa-wallet-sync-<sha40>-<run>-<attempt>`

Pero el documento SSM `AfiliacionesQaDeploy` solo despliega la app. El host
ejecutaba un script con la imagen worker **pineada manualmente**
(`qa-wallet-sync-4ef5149…`), por lo que cada deploy actualizaba la app y dejaba
el worker en una version anterior.

## Mecanismo persistente (este repo)
`scripts/qa/afiliaciones-wallet-sync.sh`:

1. Obtiene la imagen de la app **realmente en ejecucion**:
   `docker inspect $(docker compose ... ps -q app) --format '{{.Config.Image}}'`.
   Evita la carrera de leer un archivo a medio escribir durante el deploy.
   Fallback: lee `.qa-app-image.override.yml` si no hay contenedor.
2. Exige el patron inmutable `qa-<sha40>-<run>-<attempt>` (rechaza `:latest`,
   tags parciales o imagenes de otro repositorio).
3. Deriva `qa-wallet-sync-<sha40>-<run>-<attempt>` (mismo SHA/run/attempt).
4. Toma un lock (`flock`, si esta disponible) para impedir ejecuciones
   concurrentes entre timer y ejecuciones manuales.
5. `docker pull` del worker (obligatorio porque se ejecuta con `--pull never`)
   y luego `docker run --rm --pull never --env-file … --network …`.
6. Logs sanitizados: solo imprime referencias de imagen (sin secretos).

CI: `qa-deploy.yml` ahora **verifica el digest del worker en ECR** antes de
desplegar la app, ademas de verificar el digest de la app. Si el worker no se
publico, el workflow falla y no se despliega una app sin worker compatible.

## Coordinacion y rollback
- Como el worker deriva de la imagen de app **activa**, si el deploy de la app
  hace rollback (documento SSM restaura la imagen previa), el siguiente tick del
  timer ejecuta automaticamente el worker del release restaurado. No requiere un
  rollback separado del worker ni pasos manuales.
- Trabajos pendientes/retry se reanudan en el siguiente tick. Los jobs FAILED
  requieren retry autorizado (`scripts/wallet-sync-retry.ts`).
- Mismatch de versiones: si la imagen de app no cumple el patron, el worker sale
  con error (no ejecuta una version ambigua).

## Instalacion unica (requiere autorizacion de infra/ops)
El archivo vive en el repo, pero debe instalarse una vez en el host (misma ruta
que ya usa `afiliaciones-qa-wallet-sync.service`):

```bash
sudo cp /usr/local/bin/afiliaciones-wallet-sync.sh /usr/local/bin/afiliaciones-wallet-sync.sh.bak-$(date +%Y%m%d%H%M%S)
sudo install -m 0755 /ruta/al/repo/scripts/qa/afiliaciones-wallet-sync.sh /usr/local/bin/afiliaciones-wallet-sync.sh
# verificacion sin ejecutar worker (debe derivar el mismo release que la app):
DRY_RUN=1 /usr/local/bin/afiliaciones-wallet-sync.sh
sudo systemctl start afiliaciones-qa-wallet-sync.service
sudo journalctl -u afiliaciones-qa-wallet-sync.service -n 20 --no-pager
```

Rollback: restaurar el `.bak` y `systemctl start afiliaciones-qa-wallet-sync.service`.

> No se aplico ningun cambio al servidor en esta fase. Modifica `/usr/local/bin`
> del host QA => requiere autorizacion especifica.

## Verificacion local (sin host)
```bash
QA_APP_IMAGE="<registry>/afiliaciones-qa-app:qa-<sha40>-<run>-<attempt>" DRY_RUN=1 \
  bash scripts/qa/afiliaciones-wallet-sync.sh
```
Debe imprimir `qa-wallet-sync-<sha40>-<run>-<attempt>`. Una imagen con tag no
inmutable debe fallar con exit != 0.
