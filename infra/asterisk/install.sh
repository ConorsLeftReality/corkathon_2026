#!/usr/bin/env bash
# Install the Dialed-In dialplan into /etc/asterisk and reload Asterisk.
# Usage:  sudo bash infra/asterisk/install.sh
# Safe to rerun. pjsip.conf is only created when missing, so existing passwords are kept.
set -euo pipefail
ETC=/etc/asterisk
HERE="$(cd "$(dirname "$0")" && pwd)"
STAMP=$(date +%Y%m%d-%H%M%S)

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
[ -d "$ETC" ] || { echo "$ETC not found. Build and install Asterisk first (docs/deployment/02-asterisk.md)."; exit 1; }

backup() { [ -f "$ETC/$1" ] && cp -p "$ETC/$1" "$ETC/$1.bak-$STAMP" && echo "backed up $1 to $1.bak-$STAMP"; return 0; }

for f in extensions.conf dialed-in.conf; do
  backup "$f"
  install -m 644 "$HERE/$f" "$ETC/$f"
  echo "installed $ETC/$f"
done

# the menu used to live in filing-radar.conf, now dialed-in.conf
if [ -f "$ETC/filing-radar.conf" ]; then
  mv "$ETC/filing-radar.conf" "$ETC/filing-radar.conf.bak-$STAMP"
  echo "retired filing-radar.conf"
fi

if [ -f "$ETC/pjsip.conf" ] && grep -q "^bind=10.99.99.1" "$ETC/pjsip.conf"; then
  echo "kept existing pjsip.conf (passwords unchanged)"
else
  backup pjsip.conf
  cp "$HERE/pjsip.example.conf" "$ETC/pjsip.conf"
  echo "created pjsip.conf with new passwords. Put these in the DECT base and Zoiper:"
  for n in $(seq 1001 1010); do
    pw=$(openssl rand -hex 12)
    sed -i "s/CHANGE_ME_$n\$/$pw/" "$ETC/pjsip.conf"
    echo "  $n  $pw"
  done
fi
chown asterisk:asterisk "$ETC/pjsip.conf"
chmod 640 "$ETC/pjsip.conf"

install -d -o asterisk -g asterisk /var/spool/asterisk/dialed-in /srv/voip/answers /srv/voip/prerendered_audio

if systemctl is-active --quiet asterisk; then
  asterisk -rx "core reload" >/dev/null
  echo "asterisk reloaded"
  asterisk -rx "dialplan show 100@internal" | head -3
else
  echo "asterisk is not running: sudo systemctl start asterisk"
fi
