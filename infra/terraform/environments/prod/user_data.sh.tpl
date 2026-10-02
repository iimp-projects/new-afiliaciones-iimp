#!/bin/bash
set -euo pipefail

# =============================================================================
# Bootstrap PROD Afiliaciones (idempotente, sin secretos hardcodeados).
#
# Flujo de una EC2 nueva:
#   instance role → SSM Parameter Store (GetParametersByPath, SecureString+String)
#   → construye /opt/afiliaciones-prod/app.env (chmod 600)
#   → ECR login → docker pull → docker run (--restart unless-stopped)
#   → espera health local /api/health/live.
#
# Seguridad:
#   - Nunca imprime secretos (no set -x; solo nombres de variables en errores).
#   - Los secretos llegan por SSM vía instance role; no viajan por user_data,
#     launch template, Dockerfile ni build args.
# =============================================================================

LOG=/var/log/afiliaciones-prod-bootstrap.log
exec > >(tee -a "$LOG") 2>&1

log() { echo "[$(date -u +%FT%TZ)] $*"; }

# --- valores NO sensibles inyectados por Terraform (templatefile) ---
REGION="${region}"
NAMESPACE="${parameter_namespace}"
BUCKET="${bucket}"
IMAGE="${ecr_repository_url}:${image_tag}"
APP_PORT="${app_port}"
REGISTRY="${registry}"

ENV_FILE=/opt/afiliaciones-prod/app.env
APP_DIR=/opt/afiliaciones-prod
CONTAINER=afiliaciones-prod-app

log "Bootstrap PROD iniciado (region=$REGION namespace=$NAMESPACE bucket=$BUCKET image=$IMAGE)"

# 1) Dependencias mínimas + Docker habilitado
dnf update -y
dnf install -y docker awscli jq curl
systemctl enable --now docker

mkdir -p "$APP_DIR"
touch "$ENV_FILE"

# 2) Obtener config/secrets desde SSM (con retries) y construir app.env.
#    Idempotente: regenera el archivo en cada ejecución.
ssm_ok=0
for attempt in 1 2 3 4 5 6; do
  if json=$(aws ssm get-parameters-by-path \
        --path "$NAMESPACE" \
        --recursive \
        --with-decryption \
        --max-items 200 \
        --output json 2>>"$LOG"); then
    ssm_ok=1
    break
  fi
  log "RETRY SSM $attempt/6"
  sleep 5
done

if [ "$ssm_ok" -ne 1 ]; then
  log "FATAL: no se pudo obtener config/secretos desde SSM ($NAMESPACE)"
  exit 1
fi

# Escribir app.env desde cero
: > "$ENV_FILE"

# Config no sensible que NO vive en SSM (proveniente del bootstrap)
printf 'AWS_DEFAULT_REGION=%s\n' "$REGION" >> "$ENV_FILE"
printf 'AWS_REGION=%s\n' "$REGION" >> "$ENV_FILE"
printf 'AWS_BUCKET=%s\n' "$BUCKET" >> "$ENV_FILE"

# Parámetros SSM → variables de entorno (kebab-case/UPPER_SNAKE → UPPER_SNAKE).
# Se usa jq por registro, sin delimitadores frágiles ni echo de valores.
echo "$json" | jq -c '.Parameters[]' | while IFS= read -r param; do
  full=$(printf '%s' "$param" | jq -r '.Name')
  name=$(basename "$full")
  value=$(printf '%s' "$param" | jq -r '.Value')
  env_name=$(printf '%s' "$name" | tr '[:lower:]-' '[:upper:]_')
  printf '%s=%s\n' "$env_name" "$value" >> "$ENV_FILE"
done

chmod 600 "$ENV_FILE"
chown root:root "$ENV_FILE"

# 3) Validar variables obligatorias (FAIL FAST, solo nombres, sin valores)
missing=""
for var in DATABASE_URL AUTH_SECRET PAYMENT_AUTH_SECRET JWT_SECRET; do
  if ! grep -q "^$var=" "$ENV_FILE"; then
    missing="$missing $var"
  fi
done
if [ -n "$missing" ]; then
  log "FATAL: variables requeridas ausentes en SSM:$missing"
  exit 1
fi

# Go-live requiere dominio HTTPS (create_dns=true); en bootstrap aún pueden faltar.
if ! grep -q "^AUTH_URL=" "$ENV_FILE" || ! grep -q "^NEXT_PUBLIC_APP_URL=" "$ENV_FILE"; then
  log "WARN: AUTH_URL/NEXT_PUBLIC_APP_URL ausentes (go-live requiere create_dns=true + dominio HTTPS)"
fi

# 4) ECR login (con retries)
ecr_ok=0
for attempt in 1 2 3 4 5 6; do
  if aws ecr get-login-password --region "$REGION" 2>/dev/null \
       | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null 2>&1; then
    ecr_ok=1
    break
  fi
  log "RETRY ECR login $attempt/6"
  sleep 5
done
if [ "$ecr_ok" -ne 1 ]; then
  log "FATAL: ECR login fallo"
  exit 1
fi

# 5) docker pull de la imagen exacta (con retries)
pull_ok=0
for attempt in 1 2 3 4 5 6; do
  if docker pull "$IMAGE" >/dev/null 2>&1; then
    pull_ok=1
    break
  fi
  log "RETRY docker pull $attempt/6"
  sleep 5
done
if [ "$pull_ok" -ne 1 ]; then
  log "FATAL: docker pull fallo ($IMAGE)"
  exit 1
fi

# 6) Reemplazar contenedor anterior de forma segura (idempotente)
docker rm -f "$CONTAINER" 2>/dev/null || true

docker run -d \
  --name "$CONTAINER" \
  --restart unless-stopped \
  -p "$APP_PORT:3000" \
  --env-file "$ENV_FILE" \
  "$IMAGE"

log "Contenedor iniciado; esperando health local en :$APP_PORT/api/health/live"

# 7) Esperar health local (hasta ~300s). Liveness = proceso vivo.
healthy=0
i=0
while [ "$i" -lt 60 ]; do
  if curl -fsS "http://127.0.0.1:$APP_PORT/api/health/live" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  i=$((i + 1))
  sleep 5
done

if [ "$healthy" -eq 1 ]; then
  log "OK: health live responde"
  exit 0
fi

log "ERROR: health no respondio tras 300s"
exit 1
