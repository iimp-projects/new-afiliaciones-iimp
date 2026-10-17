#!/bin/bash
set -euo pipefail

# =============================================================================
# Proxy TCP PostgreSQL dedicado (HAProxy mode tcp / passthrough).
# - Sin TLS termination: el TLS es end-to-end entre pgAdmin y RDS.
# - No almacena credenciales ni secretos.
# - Logs de conexion (metadata) a journald: sin payload ni contrasenas.
# =============================================================================

dnf install -y haproxy

cat > /etc/haproxy/haproxy.cfg <<HAPROXY
global
    log stdout format raw local0 info
    maxconn 4096
    user haproxy
    group haproxy
    daemon

defaults
    mode tcp
    log global
    option tcplog
    timeout connect 10s
    timeout client 1h
    timeout server 1h

frontend pg_front
    bind *:${rds_port}
    default_backend pg_back

backend pg_back
    server pg1 ${rds_address}:${rds_port} check inter 10s fall 3 rise 2
HAPROXY

mkdir -p /etc/systemd/system/haproxy.service.d
cat > /etc/systemd/system/haproxy.service.d/restart.conf <<EOF
[Service]
Restart=always
RestartSec=5
EOF
systemctl daemon-reload

systemctl enable --now haproxy
systemctl restart haproxy
