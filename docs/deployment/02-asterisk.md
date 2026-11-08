# 2. Asterisk and the phones

## Build Asterisk 22

Asterisk is not in apt on Bookworm or Trixie, so it is built from source. The compile takes 30 to 60 minutes on a Pi 3 and needs internet. The source stays in `/usr/local/src` afterwards for rebuilds and `make uninstall` (the live Pi has `asterisk-22.11.0`).

```bash
sudo apt install -y build-essential wget
sudo chown "$USER" /usr/local/src && cd /usr/local/src
wget https://downloads.asterisk.org/pub/telephony/asterisk/asterisk-22-current.tar.gz
tar xf asterisk-22-current.tar.gz && rm asterisk-22-current.tar.gz && cd asterisk-22.*/
sudo contrib/scripts/install_prereq install   # asks for a country code: 353
./configure --with-jansson-bundled
make -j2                                       # -j2, not -j4: 1 GB of RAM runs out otherwise
sudo make install && sudo make samples
```

Run it as its own user, under systemd:

```bash
sudo groupadd -f asterisk
id asterisk >/dev/null 2>&1 || sudo useradd -r -d /var/lib/asterisk -g asterisk asterisk
sudo usermod -aG audio,dialout asterisk
sudo chown -R asterisk:asterisk /etc/asterisk /var/lib/asterisk /var/log/asterisk /var/spool/asterisk /usr/lib/asterisk
sudo sed -i 's/^;runuser = asterisk/runuser = asterisk/; s/^;rungroup = asterisk/rungroup = asterisk/' /etc/asterisk/asterisk.conf
cd ~/corkathon2026
sudo cp infra/asterisk/asterisk.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now asterisk
sudo asterisk -rx "core show version"
```

## Install the Dialed-In config

```bash
sudo bash infra/asterisk/install.sh
sudo bash infra/asterisk/make_prompts.sh
```

On a new Pi, `install.sh` creates `/etc/asterisk/pjsip.conf` from the template with a random password per extension and prints them once. Note `1001` and `1002`. On a Pi that already has a `pjsip.conf` bound to `10.99.99.1`, it is left alone. The stock `pjsip.conf` and `extensions.conf` from `make samples` are backed up with a timestamp.

`make_prompts.sh` only renders prompts that do not exist yet. To swap in your own recordings (for example ElevenLabs MP3s), put them in `/srv/voip/prerendered_audio/` with the same names (`menu.mp3`, `main-menu.mp3`, ...) and delete the `.wav` of that name. To re-render one from the script's text, run `sudo bash infra/asterisk/make_prompts.sh --force menu`.

Asterisk only binds `10.99.99.1`, so if it started before `eth0` had a link, restart it once the LAN is up: `sudo systemctl restart asterisk`.

## Extensions

| Number | What it is |
|---|---|
| `100` | Dialed-In menu. 1 = CRO Tracker |
| `100`, then `1` | CRO Tracker: 1 ask a question, `*` back |
| `1001` | Cisco DECT handset |
| `1002` | Zoiper softphone |
| `1003` to `1010` | Spare accounts for more handsets or softphones |

## Cisco DBS-110 DECT base

1. Plug the base into the switch and power it. Pin its address with `sudo bash infra/pi/network.sh <base MAC>` (see [01-pi.md](01-pi.md)), then power-cycle it. The live base is at `10.99.99.200`.
2. Its web page is HTTPS only (the certificate warning is expected). From a laptop on the switch, browse to `https://10.99.99.200`. From anywhere else, tunnel through the Pi: `ssh -L 8443:10.99.99.200:443 pi@<pi tailscale ip>`, then `https://localhost:8443`.
3. **Server**: alias `piAsterisk`, registrar `10.99.99.1`, outbound proxy blank, transport UDP, NAT adaption off. Keep G.711 u-law and A-law enabled.
4. **Line**: extension `1001`, authentication user name `1001`, authentication password from `pjsip.conf`, server `piAsterisk`, XSI user name and password blank (browsers like to autofill these).
5. Put the base in registration mode, then on the handset Menu, Settings, Register.

If the base was used elsewhere it may have a fixed IP and ignore DHCP. Find it with `sudo tcpdump -i eth0 -n -e` (its CDP packets name the DBS-110), give the Pi a temporary address in that range (`sudo ip addr add 192.168.1.2/24 dev eth0`), switch the base to DHCP in its web page, then remove the temporary address.

## Zoiper softphone

On the phone: install Tailscale, sign in to the same tailnet, and allow subnet routes. In Zoiper, user name `1002@10.99.99.1`, the `1002` password, transport UDP, STUN off. The SIP user name must be exactly `1002`; a display name in that field gives "No matching endpoint found".

## Check

```bash
sudo asterisk -rx "pjsip show contacts"   # 1001 and 1002 listed as Avail
sudo asterisk -rx "dialplan show 100@internal"
```

Dial `1002` from the handset; it should ring. Dial `100`; you should hear the Dialed-In menu.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `No matching endpoint found` in the log | The device sends the wrong user name. It must be the extension number |
| `Failed to authenticate` | Password differs from `pjsip.conf`. Watch with `sudo asterisk -rvvv` then `pjsip set logger on` |
| Nothing registers, `pjsip show transports` is empty | Asterisk started before the LAN was up: `sudo systemctl restart asterisk` |
| Base gets no address | Check the leases file, then `sudo tcpdump -i eth0 -n port 67 or port 68` while power-cycling it |
| Zoiper times out | Tailscale off on the phone, subnet routes not allowed, or the Pi's route not approved |
| Call connects but silent | `allow=ulaw,alaw` on both sides; check the prompt exists in `/srv/voip/prerendered_audio/` |
