# 3. Dokku and the two apps

Both apps run as Dokku apps built from the repo's Dockerfiles. GitHub Actions pushes to Dokku over Tailscale (step 5), so you never push to Dokku by hand.

| App | Built from | Port | Data on the Pi |
|---|---|---|---|
| `corkathon2026` | `Dockerfile` at the repo root (web + api) | `9000`, to `5000` in the container | `/var/lib/dokku/data/storage/corkathon2026` mounted at `/data` (SQLite, CRO snapshot) |
| `cro-tracker` | `apps/cro-tracker/Dockerfile` | `9001`, to `5000` in the container | `/var/lib/dokku/data/storage/cro-tracker` mounted at `/app/data` (snapshots, reports) |

Dokku sets `PORT=5000` inside both containers, which overrides the `5001` default in the root `Dockerfile`.

## Install Dokku

The Pi has 906 MiB of RAM, so add swap before the first build or Docker builds get killed:

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
sudo dphys-swapfile setup && sudo dphys-swapfile swapon
free -h
```

Install Dokku with the bootstrap script from [dokku.com/docs/getting-started/installation](https://dokku.com/docs/getting-started/installation/), using the current version it names (the live Pi runs 0.38.34). When it asks, skip the web installer. Never use the Herokuish builder on this Pi: it does not run on arm64. The setup script below selects the Dockerfile builder for both apps, so the `gliderlabs/herokuish` image the installer pulls can be removed to save 1.4 GB: `sudo docker image rm $(sudo docker images -q gliderlabs/herokuish)`. Dokku also installs `docker-builder-prune.timer`, which clears the build cache every night at 04:05.

Give Docker its own DNS servers, since builds that use Tailscale's resolver fail to download packages (see [step 1](01-pi.md#tailscale)), and keep containers running while Docker restarts:

```bash
echo '{ "live-restore": true, "dns": ["1.1.1.1", "8.8.8.8"] }' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
sudo docker run --rm python:3.14-slim cat /etc/resolv.conf   # shows 1.1.1.1 and 8.8.8.8
```

## Create the apps

```bash
cd ~/corkathon2026
sudo bash infra/dokku/setup.sh
```

It creates both apps, the storage mounts, the port mappings and the secrets (`JWT_SECRET_KEY` for the site, `API_TOKEN` for cro-tracker), and prints the cro-tracker `API_TOKEN`. Keep that for step 4. Rerunning it never replaces an existing secret.

Then set who may have an account on the site. Production lets nobody sign up or sign in until this is set. Entries are emails or `@domain` for a whole firm:

```bash
sudo dokku config:set corkathon2026 ALLOWED_EMAILS=you@example.com,@clientfirm.ie
```

## Client lists

- **Site** (`corkathon2026`): each account adds its own clients on the Clients page, by company number or CSV upload. Nothing to copy onto the Pi. An old shared `my_companies.csv` in the storage folder is no longer read; upload it on the Clients page instead.
- **cro-tracker**: one CSV per client in `apps/cro-tracker/clients/`, each with a `company_num` column. The file name is the client id (lower case letters, digits, `-` and `_`), so `acme.csv` is served at `/api/acme/report`. Commit and push to change them. The repo is public, so only example lists belong there: real client lists would be readable by anyone.

## cro-tracker API

Every route except `GET /api/health` needs `Authorization: Bearer <API_TOKEN>`. Set `ALLOWED_ORIGIN` only if a browser on another origin calls the API; by default no CORS header is sent.

| Request | Returns |
|---|---|
| `GET /api/clients` | every client with its counts |
| `GET /api/<client>/report?status=due,overdue` | full report, optional filter |
| `GET /api/<client>/companies` | sorted company list |
| `GET /api/<client>/briefing` | plain-text briefing |
| `POST /api/<client>/refresh` | rebuild now (all clients) |
| `/api/report` etc. | same, for `DEFAULT_CLIENT` or the only client |

The daily rebuild runs from the `cron` entry in `apps/cro-tracker/app.json` at 00:05, and the API also rebuilds on the first request of a new day, so the exact time does not matter.

## After the first deploy (step 5)

```bash
sudo dokku ps:report corkathon2026 | grep -i running
curl -s http://127.0.0.1:9000/api/health
sudo dokku cron:list cro-tracker                       # daily rebuild at 00:05
sudo dokku run cro-tracker python scheduler.py --once  # build today's reports now
curl -H "Authorization: Bearer $(sudo dokku config:get cro-tracker API_TOKEN)" http://127.0.0.1:9001/api/clients
```

## HTTPS

The site is at **https://<pi>.<tailnet>.ts.net** from any device on the tailnet (on a new Pi, `tailscale serve status` prints the address). Nothing is exposed to the internet.

`setup.sh` turns this on with Tailscale Serve:

```bash
sudo tailscale serve --bg --https=443 http://127.0.0.1:9000
sudo dokku config:set corkathon2026 COOKIE_SECURE=true
```

- Tailscale fetches a Let's Encrypt certificate for the Pi's `ts.net` name and renews it by itself, so there is no cron job or `dokku certs` step. The setting survives reboots.
- It needs MagicDNS and HTTPS Certificates turned on in the Tailscale admin console (the DNS page; see [step 1](01-pi.md#tailscale)). If they are off, `setup.sh` warns and leaves the site on plain http with `COOKIE_SECURE=false`.
- Tailscale catches port 443 on the tailnet address before Dokku's nginx sees it, so the two do not clash. On the Pi itself, `curl https://<name>.ts.net` reaches nginx instead and fails. Test from another device.
- Session cookies are `Secure`, so signing in works only at the HTTPS address. `http://<pi tailscale ip>:9000` still answers, which is fine for `curl` health checks, but sign-in there bounces back to the login page.
- Copy briefing uses the clipboard API, which browsers allow only on HTTPS.
- Only `corkathon2026` is served this way. `cro-tracker` is read by the phone scripts on the Pi itself, over `127.0.0.1:9001`.

To turn HTTPS off: `sudo tailscale serve --https=443 off`, then `sudo dokku config:set corkathon2026 COOKIE_SECURE=false`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| App restarts every few seconds, log shows a pydantic `ValidationError` | A required setting is missing, usually `JWT_SECRET_KEY`. `sudo dokku config:show corkathon2026` |
| Sign-in bounces back to the login page | You opened the plain http address. Use `https://<pi>.<tailnet>.ts.net` |
| `tailscale serve` prints a link and waits | HTTPS Certificates are off in the tailnet. Turn them on (admin console, DNS) and rerun `setup.sh` |
| Build killed or stalls | Out of memory. Check `free -h` and the swap above; only one deploy runs at a time |
| cro-tracker returns 401 | Missing or wrong `Authorization: Bearer` header |
| Push ignored | Deploy branch not `main`: `sudo dokku git:set <app> deploy-branch main` |
