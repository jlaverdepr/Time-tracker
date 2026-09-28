#!/bin/bash
# One-time setup of the FocusTime server on a Debian VM (run as root on the VM;
# deploy.sh uploads and runs it). Safe to re-run: it never regenerates the
# access token and never touches the database.
#
#   node (systemd: focustime.service, 127.0.0.1-only via firewall) ← Caddy (HTTPS, auto-certificate)
#
# Usage: setup-server.sh <domain>
set -euo pipefail
DOMAIN="$1"

id focustime &>/dev/null || useradd --system --home-dir /var/lib/focustime --shell /usr/sbin/nologin focustime
install -d -o root -g root -m 755 /opt/focustime
install -d -o focustime -g focustime -m 750 /var/lib/focustime /var/lib/focustime/backups
install -d -o root -g focustime -m 750 /etc/focustime

# Shared secret every device must send (Authorization: Bearer …). Created once.
if [ ! -f /etc/focustime/env ]; then
  (umask 027; printf 'API_AUTH_TOKEN=%s\n' "$(openssl rand -hex 24)" > /etc/focustime/env)
  chgrp focustime /etc/focustime/env
fi

cat > /etc/systemd/system/focustime.service <<'EOF'
[Unit]
Description=FocusTime API + web app
After=network-online.target
Wants=network-online.target

[Service]
User=focustime
Group=focustime
WorkingDirectory=/opt/focustime/server
EnvironmentFile=/etc/focustime/env
Environment=NODE_ENV=production PORT=3000
# "Today" and the to-do day rollover follow this zone (the user's midnight)
Environment=TZ=Europe/Helsinki
Environment=DB_PATH=/var/lib/focustime/time-tracker.sqlite
Environment=MIGRATIONS_DIR=/opt/focustime/drizzle
Environment=STATIC_DIR=/opt/focustime/public
ExecStart=/usr/bin/node --enable-source-maps /opt/focustime/server/index.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/focustime

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
	encode gzip
	reverse_proxy 127.0.0.1:3000
}
EOF

# Nightly consistent backup (sqlite .backup is safe while the app is running); keep 14 days.
cat > /etc/cron.d/focustime-backup <<'EOF'
30 3 * * * focustime sqlite3 /var/lib/focustime/time-tracker.sqlite ".backup /var/lib/focustime/backups/time-tracker-$(date +\%F).sqlite" && find /var/lib/focustime/backups -name '*.sqlite' -mtime +14 -delete
EOF

systemctl daemon-reload
systemctl enable focustime >/dev/null
systemctl reload-or-restart caddy
echo "setup done for $DOMAIN"
