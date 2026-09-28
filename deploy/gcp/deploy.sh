#!/bin/bash
# Builds FocusTime and ships it to the Google Cloud VM, then restarts it.
# Pending database migrations run automatically when the server starts.
#
# Usage:  deploy/gcp/deploy.sh            build + deploy
#         SKIP_BUILD=1 deploy/gcp/deploy.sh   deploy the existing dist/ builds
set -euo pipefail
cd "$(dirname "$0")/../.."

VM=${VM:-focustime}
ZONE=${ZONE:-us-east1-b}
DOMAIN=${DOMAIN:-focustime-jlavedepr.duckdns.org}
SSH=(gcloud compute ssh "$VM" --zone="$ZONE" --tunnel-through-iap --quiet)

if [ "${SKIP_BUILD:-}" != 1 ]; then
  pnpm --filter @workspace/api-server run build
  pnpm --filter @workspace/time-tracker run build
fi

# The server bundle inlines everything except better-sqlite3 (native), which
# the VM installs itself at the same version the repo uses.
SQLITE_VERSION=$(ls node_modules/.pnpm | sed -n 's/^better-sqlite3@\([0-9.]*\)$/\1/p' | head -1)

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
cp -R artifacts/api-server/dist "$STAGE/server"
cp -R artifacts/time-tracker/dist/public "$STAGE/public"
cp -R lib/db/drizzle "$STAGE/drizzle"
cp deploy/gcp/setup-server.sh "$STAGE/"
tar -czf "$STAGE.tgz" -C "$STAGE" .

gcloud compute scp "$STAGE.tgz" "$VM:/tmp/focustime.tgz" --zone="$ZONE" --tunnel-through-iap --quiet
rm -f "$STAGE.tgz"

"${SSH[@]}" --command="
set -euo pipefail
sudo rm -rf /tmp/focustime-release && mkdir /tmp/focustime-release
tar -xzf /tmp/focustime.tgz -C /tmp/focustime-release
sudo bash /tmp/focustime-release/setup-server.sh '$DOMAIN'
cd /opt/focustime
if [ \"\$(node -p 'try{require(\"/opt/focustime/node_modules/better-sqlite3/package.json\").version}catch{\"\"}')\" != '$SQLITE_VERSION' ]; then
  sudo npm install --no-save --no-package-lock --omit=dev --loglevel=error better-sqlite3@$SQLITE_VERSION
fi
sudo rm -rf /opt/focustime/server /opt/focustime/public /opt/focustime/drizzle
sudo cp -R /tmp/focustime-release/server /tmp/focustime-release/public /tmp/focustime-release/drizzle /opt/focustime/
sudo rm -rf /tmp/focustime-release /tmp/focustime.tgz
sudo systemctl restart focustime
for i in \$(seq 1 20); do curl -sf http://127.0.0.1:3000/api/healthz >/dev/null && break; sleep 0.5; done
curl -sf http://127.0.0.1:3000/api/healthz >/dev/null && echo 'server healthy' || { sudo journalctl -u focustime -n 30 --no-pager; exit 1; }
"
echo "Deployed to https://$DOMAIN"
