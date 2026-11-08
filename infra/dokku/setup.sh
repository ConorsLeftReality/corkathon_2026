#!/usr/bin/env bash
# One-time Dokku setup for both Dialed-In apps on the Pi. Safe to rerun:
# existing apps, mounts and secrets are left alone.
# Usage:  sudo bash infra/dokku/setup.sh
#   corkathon2026  web + api      http://<pi>:9000   storage /var/lib/dokku/data/storage/corkathon2026 -> /data
#   cro-tracker    report api     http://<pi>:9001   storage /var/lib/dokku/data/storage/cro-tracker   -> /app/data
set -euo pipefail
STORE=/var/lib/dokku/data/storage

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
command -v dokku >/dev/null || { echo "Dokku is not installed, see docs/deployment/03-dokku-and-apps.md"; exit 1; }

has_config() { [ -n "$(dokku config:get "$1" "$2" 2>/dev/null || true)" ]; }

app() {
  local name=$1 port=$2 container_port=$3 mount=$4
  dokku apps:exists "$name" >/dev/null 2>&1 || dokku apps:create "$name"
  dokku git:set "$name" deploy-branch main
  dokku builder:set "$name" selected dockerfile
  dokku storage:ensure-directory "$name" >/dev/null
  # both images run as uid 1000
  chown -R 1000:1000 "$STORE/$name"
  # the sqlite file holds password hashes, so no other local user may read it
  chmod 700 "$STORE/$name"
  if ! dokku storage:list "$name" 2>/dev/null | grep -q "$STORE/$name:$mount"; then
    dokku storage:mount "$name" "$STORE/$name:$mount"
  fi
  dokku ports:set "$name" "http:$port:$container_port"
  echo "ready: $name on port $port"
}

app corkathon2026 9000 5000 /data
has_config corkathon2026 JWT_SECRET_KEY \
  || dokku config:set --no-restart corkathon2026 JWT_SECRET_KEY="$(openssl rand -hex 32)"
has_config corkathon2026 TRUSTED_PROXIES \
  || dokku config:set --no-restart corkathon2026 TRUSTED_PROXIES=1
# reached over plain http on tailscale, so the session cookie cannot be Secure.
# set COOKIE_SECURE=true yourself once the site is served over https
has_config corkathon2026 COOKIE_SECURE \
  || dokku config:set --no-restart corkathon2026 COOKIE_SECURE=false
has_config corkathon2026 ALLOWED_EMAILS || has_config corkathon2026 FILINGS_ALLOWED_EMAILS \
  || echo "WARN: nobody can sign up or sign in until ALLOWED_EMAILS is set:
      sudo dokku config:set corkathon2026 ALLOWED_EMAILS=you@example.com,@clientfirm.ie"

app cro-tracker 9001 5000 /app/data
# it lives in a subfolder of the repo
dokku builder:set cro-tracker build-dir apps/cro-tracker
if ! has_config cro-tracker API_TOKEN; then
  dokku config:set --no-restart cro-tracker API_TOKEN="$(openssl rand -hex 32)" WINDOW_DAYS=30
fi
echo
echo "cro-tracker API_TOKEN (put the same value in /opt/dialed-in/.env as API_TOKEN):"
dokku config:get cro-tracker API_TOKEN
echo
echo "Next: push to main (GitHub Actions deploys both), or run the 'Deploy' workflows by hand."
