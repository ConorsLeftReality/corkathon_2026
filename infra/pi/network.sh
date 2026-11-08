#!/usr/bin/env bash
# Pi network: eth0 becomes a private phone LAN (10.99.99.0/24) with DHCP, DNS and NAT
# out through the wifi. Asterisk, the switch, the DECT base and a laptop sit on eth0.
# Usage:  sudo bash infra/pi/network.sh [DECT_BASE_MAC]
#   sudo bash infra/pi/network.sh 00:00:5e:00:53:01    # also pins the base to 10.99.99.200
# Safe to rerun.
set -euo pipefail
LAN_IP=10.99.99.1/24
BASE_IP=10.99.99.200
MAC=${1:-}

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }

# NetworkManager "shared" mode runs its own dnsmasq for DHCP and DNS, and NATs to wlan0
if ! nmcli -t -f NAME con show | grep -qx lan; then
  nmcli con add type ethernet ifname eth0 con-name lan \
    ipv4.method shared ipv4.addresses "$LAN_IP" ipv6.method disabled connection.autoconnect yes
  echo "created connection 'lan' on eth0 ($LAN_IP)"
else
  echo "connection 'lan' already exists"
fi

mkdir -p /etc/NetworkManager/dnsmasq-shared.d
echo "log-dhcp" > /etc/NetworkManager/dnsmasq-shared.d/log.conf
if [ -n "$MAC" ]; then
  echo "dhcp-host=$MAC,$BASE_IP" > /etc/NetworkManager/dnsmasq-shared.d/dect.conf
  echo "DECT base $MAC pinned to $BASE_IP"
fi

# lan only comes up when eth0 has a cable with link
nmcli con up lan || echo "WARN: lan did not come up. Is eth0 plugged into the switch?"

# the pi has no clock battery and TLS needs the right time
apt-get install -y chrony >/dev/null && echo "chrony installed"

echo
echo "Leases (the DECT base should appear once it asks for an address):"
cat /var/lib/NetworkManager/dnsmasq-eth0.leases 2>/dev/null || echo "  none yet"
