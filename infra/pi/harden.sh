#!/usr/bin/env bash
# Lock the Pi down: key-only SSH, the wifi gets replies only, unused Asterisk channels off,
# automatic security updates.
# Usage:  sudo bash infra/pi/harden.sh
# Safe to rerun. Add your SSH key first (the Imager does this), or the key-only step locks you out.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
USER_NAME=${SUDO_USER:-pi}
USER_HOME=$(getent passwd "$USER_NAME" | cut -d: -f6)

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
grep -qE '^(ssh-|ecdsa-)' "$USER_HOME/.ssh/authorized_keys" 2>/dev/null \
  || { echo "No key in $USER_HOME/.ssh/authorized_keys. Add one before turning passwords off."; exit 1; }

echo "== SSH: keys only"
# sshd keeps the first value it reads, and 10- sorts before any other drop-in
cat > /etc/ssh/sshd_config.d/10-dialed-in.conf <<'EOF'
# written by infra/pi/harden.sh
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
X11Forwarding no
MaxAuthTries 3
EOF
sshd -t
systemctl reload ssh
sshd -T | grep -E '^(passwordauthentication|permitrootlogin|x11forwarding) '

echo "== Firewall on wlan0"
install -d /etc/dialed-in
install -m 644 "$HERE/firewall.nft" /etc/dialed-in/firewall.nft
cat > /etc/systemd/system/dialed-in-firewall.service <<'EOF'
# written by infra/pi/harden.sh
[Unit]
Description=Dialed-In firewall: replies only on wlan0
Wants=network-pre.target
Before=network-pre.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/sbin/nft -f /etc/dialed-in/firewall.nft
ExecStop=/usr/sbin/nft delete table inet dialed_in

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable dialed-in-firewall.service >/dev/null
systemctl restart dialed-in-firewall.service
nft list table inet dialed_in | grep -c accept | xargs echo "rules loaded, accepts:"

echo "== Asterisk: only PJSIP"
MODS=/etc/asterisk/modules.conf
if [ -f "$MODS" ]; then
  for m in chan_iax2.so pbx_dundi.so chan_unistim.so; do
    grep -q "^noload => $m" "$MODS" || echo "noload => $m" >> "$MODS"
    if systemctl is-active --quiet asterisk; then
      asterisk -rx "module unload $m" >/dev/null 2>&1 || true
    fi
  done
  echo "IAX2, DUNDi and UNISTIM will not load"
fi

echo "== Automatic security updates"
DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades >/dev/null
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
echo "unattended-upgrades on"

echo
echo "Done. Check SSH still works from a new terminal before closing this one."
