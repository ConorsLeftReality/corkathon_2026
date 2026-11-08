# Infrastructure

Everything that runs on the Raspberry Pi outside the app containers. The steps to use it, in order, are in [docs/deployment](../docs/deployment/README.md), and a map of every path on the Pi is in [where-things-live](../docs/where-things-live.md).

| Path | What it is | Where it ends up |
|---|---|---|
| `pi/network.sh` | Turns `eth0` into the private phone LAN `10.99.99.0/24`, pins the DECT base, installs chrony | NetworkManager connection `lan` |
| `asterisk/asterisk.service` | systemd unit for Asterisk built from source | `/etc/systemd/system/` |
| `asterisk/extensions.conf` | Extensions: `100` is the Dialed-In menu, `1001` to `1010` ring each other, `[autocall]` plays outbound calls | `/etc/asterisk/` |
| `asterisk/dialed-in.conf` | The menus: top menu (1 = CRO Tracker) and the CRO Tracker menu | `/etc/asterisk/` |
| `asterisk/pjsip.example.conf` | SIP accounts `1001` to `1010` with placeholder passwords | `/etc/asterisk/pjsip.conf`, created once with real passwords |
| `asterisk/install.sh` | Installs the three files above and reloads Asterisk | run in place |
| `asterisk/make_prompts.sh` | Renders the menu prompts with Piper, keeping any you recorded yourself | `/srv/voip/prerendered_audio/` |
| `phone/` | CRO Tracker phone scripts: answer spoken questions, morning review call | `/opt/dialed-in/` |
| `dokku/setup.sh` | Creates both Dokku apps, storage, ports and secrets | Dokku on the Pi |

## Never commit

- `/etc/asterisk/pjsip.conf`: it holds every handset password.
- `/opt/dialed-in/.env`: it holds the cro-tracker `API_TOKEN`.
- Real client CSVs. The repo is public, so `apps/cro-tracker/clients/` holds examples only.

## Adding a service to the phone

The top menu on `100` picks a service and each service is its own Asterisk context, so a second service (for example invoicing status on `2`) is three steps, listed at the top of `asterisk/dialed-in.conf`.
