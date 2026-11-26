#!/usr/bin/env bash
set -Eeuo pipefail

# Ejecutor del worker Wallet de QA.
#
# Deriva la imagen del worker desde la imagen de la app REALMENTE en ejecucion
# (docker inspect del contenedor app), garantizando alineacion exacta de release
# (SHA/run/attempt) sin pins manuales. Si no hay contenedor, usa el override del
# deploy como fallback. Nunca usa :latest.
#
# Diagnostico: DRY_RUN=1 /usr/local/bin/afiliaciones-wallet-sync.sh
#   (o QA_APP_IMAGE=<image> DRY_RUN=1 ... para simular un release)

REGION="${AWS_REGION:-us-east-2}"
REGISTRY="${QA_ECR_REGISTRY:-564914947461.dkr.ecr.us-east-2.amazonaws.com}"
APP_DIR="${QA_APP_DIR:-/opt/afiliaciones-qa}"
COMPOSE_BASE="${QA_COMPOSE_BASE:-docker-compose.yml}"
COMPOSE_OVERRIDE="${QA_COMPOSE_OVERRIDE:-.qa-app-image.override.yml}"
ENV_FILE="${QA_WALLET_ENV_FILE:-/opt/afiliaciones-qa/app.env}"
NETWORK="${QA_WALLET_NETWORK:-afiliaciones-qa_data}"
LOCK_FILE="${QA_WALLET_LOCK_FILE:-/var/lock/afiliaciones-wallet-sync.lock}"
DRY_RUN="${DRY_RUN:-0}"

app_image="${QA_APP_IMAGE:-}"
if [[ -z "$app_image" ]]; then
  cid=""
  if [[ -d "$APP_DIR" ]]; then
    cid="$(cd "$APP_DIR" && docker compose -f "$COMPOSE_BASE" -f "$COMPOSE_OVERRIDE" ps -q app 2>/dev/null || true)"
  fi
  if [[ -n "$cid" ]]; then
    app_image="$(docker inspect "$cid" --format '{{.Config.Image}}')"
  elif [[ -r "$APP_DIR/$COMPOSE_OVERRIDE" ]]; then
    app_image="$(sed -nE 's/^[[:space:]]*image:[[:space:]]*"?([^"[:space:]]+)"?[[:space:]]*$/\1/p' "$APP_DIR/$COMPOSE_OVERRIDE" | head -n1)"
  fi
fi

prefix="${REGISTRY}/afiliaciones-qa-app:qa-"
if [[ "$app_image" != "$prefix"* ]]; then
  echo "[wallet-sync] Imagen de app no reconocida o no inmutable: ${app_image:-<vacia>}" >&2
  exit 2
fi

release_tag="${app_image#"$prefix"}"
if [[ ! "$release_tag" =~ ^[0-9a-f]{40}-[0-9]+-[0-9]+$ ]]; then
  echo "[wallet-sync] Tag de release no inmutable: $release_tag" >&2
  exit 3
fi

worker_image="${REGISTRY}/afiliaciones-qa-app:qa-wallet-sync-${release_tag}"

if [[ "$DRY_RUN" == "1" ]]; then
  echo "[wallet-sync] app=$app_image" >&2
  echo "[wallet-sync] worker=$worker_image" >&2
  echo "$worker_image"
  exit 0
fi

# Evita solapamientos entre timer y ejecuciones manuales.
if command -v flock >/dev/null 2>&1; then
  if ! exec 9>"$LOCK_FILE"; then
    echo "[wallet-sync] No se pudo abrir $LOCK_FILE" >&2
    exit 4
  fi
  if ! flock -n 9; then
    echo "[wallet-sync] Otra ejecucion en curso; se omite este ciclo." >&2
    exit 0
  fi
fi

# Log sanitizado (solo referencias de imagen, sin secretos).
echo "[wallet-sync] app=$app_image worker=$worker_image" >&2

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null
# Descarga previa obligatoria: el worker corre con --pull never y debe existir localmente.
docker pull "$worker_image" >/dev/null
exec docker run --rm --pull never --env-file "$ENV_FILE" --network "$NETWORK" "$worker_image"
