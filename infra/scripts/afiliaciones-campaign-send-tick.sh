#!/bin/bash
# Tick del motor de envío masivo (independiente del navegador/sesión).
# Invoca el endpoint interno con un secreto compartido obtenido de SSM.
set -euo pipefail

REGION="${AWS_REGION:-us-east-2}"
SECRET_PARAM="${TICK_SECRET_PARAM:-/afiliaciones/qa/campaign-send-tick-secret}"
TICK_URL="${TICK_URL:-https://afiliaciones-qa.iimp.org.pe/api/internal/campaign-send/tick}"

SECRET="$(aws ssm get-parameter --name "$SECRET_PARAM" --with-decryption --query Parameter.Value --output text --region "$REGION")"

curl -fsS -X POST "$TICK_URL" -H "x-campaign-send-tick-secret: $SECRET"
