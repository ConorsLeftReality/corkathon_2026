# Where things live

A map of the repo and of the Raspberry Pi, and how one turns into the other. For how to set any of it up, see [deployment](deployment/README.md).

## The repo

| Path | What it is | Ends up on the Pi as |
|---|---|---|
| `apps/web` | React front end | Built into the `corkathon2026` container |
| `apps/api` | Flask API, also serves the built web app | The `corkathon2026` container, from the root `Dockerfile` |
| `apps/cro-tracker` | Multi-client report API and daily job, read by the phone | The `cro-tracker` container, from `apps/cro-tracker/Dockerfile` |
| `apps/cro-tracker/clients/` | One CSV per client. The repo is public, so examples only | Baked into the `cro-tracker` image |
| `apps/cro-tracker/app.json` | Dokku health check and the 00:05 daily rebuild | Dokku cron for `cro-tracker` |
| `infra/pi/harden.sh`, `infra/pi/firewall.nft` | SSH, firewall and automatic updates | `/etc/ssh/sshd_config.d/`, `/etc/dialed-in/`, `dialed-in-firewall.service` |
| `infra/pi/network.sh` | Phone LAN on `eth0` (`10.99.99.0/24`), DECT base address, chrony | NetworkManager connection `lan` |
| `infra/asterisk/` | Dialplan, menus, SIP template, prompt renderer, systemd unit | `/etc/asterisk/`, `/srv/voip/prerendered_audio/`, `/etc/systemd/system/asterisk.service` |
| `infra/phone/` | Phone scripts: answer spoken questions, morning review call | `/opt/dialed-in/` and `/etc/cron.d/dialed-in` |
| `infra/dokku/setup.sh` | Creates both Dokku apps, storage, ports and secrets | Dokku config on the Pi |
| `.github/workflows/` | `ci.yml` checks every push and PR; `deploy.yml` and `deploy-cro-tracker.yml` push `main` to Dokku over Tailscale | Nothing, runs on GitHub |
| `scripts/` | Lint and commit message checks, setup | Nothing, runs on laptops and in CI |
| `docs/deployment/` | Step by step Pi setup | |
| `docs/design/` | The original design notes. Much of it is Planned rather than built | |
| `docs/api-contract.md` | Routes and schemas of the main API | |

## The Pi

Reach it with `ssh dialed-in-pi` (user `pi`, Tailscale `<pi tailscale ip>`). It runs Debian 12 arm64 on 906 MiB of RAM and a 29 GB SD card.

### Apps (Dokku)

| App | URL on the tailnet | Container port | Data |
|---|---|---|---|
| `corkathon2026` | `http://<pi tailscale ip>:9000` | `5000` | `/var/lib/dokku/data/storage/corkathon2026` mounted at `/data` (`corkathon.db`) |
| `cro-tracker` | `http://<pi tailscale ip>:9001` | `5000` | `/var/lib/dokku/data/storage/cro-tracker` mounted at `/app/data` (`reports/`, `snapshots/`) |

Secrets are Dokku config, never files: `sudo dokku config:show <app>`. `cro-tracker` needs `API_TOKEN` on every route but `/api/health`, and the phone holds the same value.

Both apps are deployed only by GitHub Actions on a push to `main`. The Pi keeps a read-only clone in `~/corkathon2026` for running the `infra/` scripts: `cd ~/corkathon2026 && git pull`.

### Phone

| Path | What it is |
|---|---|
| `/etc/asterisk/extensions.conf`, `/etc/asterisk/dialed-in.conf` | Dialplan and menus, installed by `infra/asterisk/install.sh` |
| `/etc/asterisk/pjsip.conf` | Handset passwords. Only on the Pi, never in the repo |
| `/opt/dialed-in/` | `transcribe_audio.py`, `morning_review.py`, `call_extension.py`, installed by `infra/phone/deploy.sh` |
| `/opt/dialed-in/.env` | Phone settings and the cro-tracker `API_TOKEN` (owner `asterisk`, mode 600) |
| `/etc/cron.d/dialed-in` | Hourly answer pre-render; weekday morning review rendered at 07:30 and called at 08:00 |
| `/var/spool/asterisk/dialed-in/` | Caller recordings (`q-*.wav`), `log.txt`, `pregen.log`, `morning.log`, `tts-cache/` |
| `/srv/voip/prerendered_audio/` | Menu prompts, made by `infra/asterisk/make_prompts.sh` |
| `/srv/voip/prerendered_audio_elevenlabs/` | An unused set of recorded prompts, kept in case they replace the Piper ones |
| `/srv/voip/answers/` | Answer clips Asterisk plays back during a call |
| `/opt/piper-voices/` | The Piper voice (`en_GB-alan-low.onnx` and its `.json`) |
| `/usr/local/src/asterisk-22.11.0/` | Source Asterisk was built from, kept for rebuilds and `make uninstall` |

### System

| Path | What it is |
|---|---|
| `/etc/docker/daemon.json` | Sets Docker's DNS to `1.1.1.1` and `8.8.8.8`, because builds that used Tailscale's resolver failed to download packages |
| `/etc/docker/daemon.json` `live-restore` | Keeps the app containers running while Docker itself restarts |
| `/etc/systemd/system/docker-builder-prune.timer` | Installed by Dokku. Clears the Docker build cache at 04:05 so the SD card does not fill |
| `/etc/dphys-swapfile`, `/var/swap` | 2 GB of swap, so Docker builds are not killed on 906 MiB of RAM |
| `/etc/NetworkManager/dnsmasq-shared.d/` | `dect.conf` pins the DECT base to `10.99.99.200`; `log.conf` logs DHCP. Written by `infra/pi/network.sh` |
| `/etc/ssh/sshd_config.d/10-dialed-in.conf` | SSH by key only, no root login. Written by `infra/pi/harden.sh` |
| `/etc/dialed-in/firewall.nft`, `dialed-in-firewall.service` | Drops everything arriving on wlan0 except replies, DHCP and Tailscale. From `infra/pi/firewall.nft` |
| `/etc/apt/apt.conf.d/20auto-upgrades` | Daily automatic Debian security updates |
| `/etc/sysctl.d/99-tailscale.conf` | IP forwarding, so the tailnet can reach the phone LAN through the Pi and use it as an exit node |
| `/srv/archive/2026-11-08/` | Old files moved aside during the 2026-11-08 tidy-up, with a `README.txt`. Nothing uses them; delete once you are sure |
