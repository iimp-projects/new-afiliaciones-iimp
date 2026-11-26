#!/usr/bin/env bash
set -Eeuo pipefail

# Ejecutor del worker Wallet de QA.
#
# Deriva la imagen del worker desde la imagen de la app efectivamente activa
# (`.qa-app-image.override.yml`, escrito por el deploy). Asi app y worker quedan
# SIEMPRE alineados al mismo release inmutable (SHA/run/attempt) sin pins
# manuales ni dependencia de una edicion por despliegue.
#
# Uso normal: lo invoca afiliaciones-qa-wallet-sync.service (oneshot).
# Diagnostico: DRY_RUN=1 /usr/local/bin/afiliaciones-wallet-sync.sh  -> imprime la imagen derivada.

REGION="${AWS_REGION:-us-east-2}"
REGISTRY="${QA_ECR_REGISTRY:-564914947461.dkr.ecr.us-east-2.amazonaws.com}"
OVERRIDE_FILE="${QA_APP_OVERRIDE_FILE:-/opt/afiliaciones-qa/.qa-app-image.override.yml}"
ENV_FILE="${QA_WALLET_ENV_FILE:-/opt/afiliaciones-qa/app.env}"
NETWORK="${QA_WALLET_NETWORK:-afiliaciones-qa_data}"
DRY_RUN="${DRY_RUN:-0}"

if [[ ! -r "$OVERRIDE_FILE" ]]; then
  echo "[wallet-sync] No se encontro $OVERRIDE_FILE" >&2
  exit 1
fi

app_image="$(sed -nE 's/^[[:space:]]*image:[[:space:]]*"?([^"[:space:]]+)"?[[:space:]]*$/\1/p' "$OVERRIDE_FILE" | head -n1)"
prefix="${REGISTRY}/afiliaciones-qa-app:qa-"

if [[ "$app_image" != "$prefix"* ]]; then
  echo "[wallet-sync] Imagen de app no reconocida: $app_image" >&2
  exit 2
fi

release_tag="${app_image#"$prefix"}"
if [[ ! "$release_tag" =~ ^[0-9a-f]{40}-[0-9]+-[0-9]+$ ]]; then
  echo "[wallet-sync] Tag de release no inmutable: $release_tag" >&2
  exit 3
fi

worker_image="${REGISTRY}/afiliaciones-qa-app:qa-wallet-sync-${release_tag}"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "$worker_image"
  exit 0
fi

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
docker pull "$worker_image" >/dev/null
exec docker run --rm --pull never --env-file "$ENV_FILE" --network "$NETWORK" "$worker_image"
