#!/bin/bash
set -euxo pipefail

# Bootstrap QA Ultra-Lean: Docker + Compose + cron + volumen de datos persistente.
# El stack (Caddy + app + PostgreSQL) se despliega posteriormente en /opt/afiliaciones-qa.

dnf update -y
dnf install -y docker git cronie jq
systemctl enable --now docker
systemctl enable --now crond

# Docker Compose plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -sSL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Volumen EBS de datos montado en /data (formato solo si está vacío)
DATA_MOUNT=/data
mkdir -p $${DATA_MOUNT}
if ! mountpoint -q $${DATA_MOUNT}; then
  DEV=""
  for candidate in /dev/nvme1n1 /dev/xvdf /dev/sdf; do
    if [ -b "$${candidate}" ]; then DEV="$${candidate}"; break; fi
  done
  if [ -n "$${DEV}" ]; then
    if ! blkid "$${DEV}" >/dev/null 2>&1; then mkfs -t ext4 "$${DEV}"; fi
    UUID=$(blkid -s UUID -o value "$${DEV}")
    if ! grep -q "$${UUID}" /etc/fstab; then
      echo "UUID=$${UUID} $${DATA_MOUNT} ext4 defaults,nofail 0 2" >> /etc/fstab
    fi
    mount -a
  fi
fi
mkdir -p $${DATA_MOUNT}/postgres $${DATA_MOUNT}/caddy $${DATA_MOUNT}/caddy-config $${DATA_MOUNT}/backups

# Directorio de la aplicación
mkdir -p /opt/afiliaciones-qa

# systemd unit para el stack QA (arranca cuando exista docker-compose.yml)
cat >/etc/systemd/system/afiliaciones-qa.service <<'UNIT'
[Unit]
Description=Afiliaciones QA Docker Compose
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/afiliaciones-qa
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload

# Caddy: puertos 80/443 (TLS Let's Encrypt para el hostname QA)
echo "Bootstrap QA listo: hostname=${qa_hostname} region=${aws_region} bucket=${bucket} namespace=${namespace}"
