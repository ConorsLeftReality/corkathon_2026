# 3. Dokku and the two apps

Both apps run as Dokku apps built from the repo's Dockerfiles. GitHub Actions pushes to Dokku over Tailscale (step 5), so you never push to Dokku by hand.

| App | Built from | Port | Data on the Pi |
|---|---|---|---|
| `corkathon2026` | `Dockerfile` at the repo root (web + api) | `9000` | `/var/lib/dokku/data/storage/corkathon2026` (SQLite, CRO snapshot, client list) |
| `cro-tracker` | `apps/cro-tracker/Dockerfile` | `9001` | `/var/lib/dokku/data/storage/cro-tracker` (snapshots, reports) |

## Install Dokku

The Pi has 906 MiB of RAM, so add swap before the first build or Docker builds get killed:

```bash
sudo dphys-swapfile swapoff
sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
sudo dphys-swapfile setup && sudo dphys-swapfile swapon
free -h
```

Install Dokku with the bootstrap script from [dokku.com/docs/getting-started/installation](https://dokku.com/docs/getting-started/installation/), using the current version it names. When it asks, skip the web installer. Never use the Herokuish builder on this Pi: it does not run on arm64. The setup script below selects the Dockerfile builder for both apps.

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
- **cro-tracker**: one CSV per client in `apps/cro-tracker/clients/`. The file name is the client id, so `acme.csv` is served at `/api/acme/report`. Commit and push to change them. See [apps/cro-tracker/DEPLOY.md](../../apps/cro-tracker/DEPLOY.md) for the full API.

## After the first deploy (step 5)

```bash
sudo dokku ps:report corkathon2026 | grep -i running
curl -s http://127.0.0.1:9000/api/health
sudo dokku cron:list cro-tracker                       # daily rebuild at 00:05
sudo dokku run cro-tracker python scheduler.py --once  # build today's reports now
curl -H "Authorization: Bearer $(sudo dokku config:get cro-tracker API_TOKEN)" http://127.0.0.1:9001/api/clients
```

The site is at `http://<pi tailscale ip>:9000` from any device on the tailnet. It is served over plain http there, so `setup.sh` sets `COOKIE_SECURE=false`. If you put it behind HTTPS (for example `dokku letsencrypt:enable corkathon2026` on a public domain), set `COOKIE_SECURE=true`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| App restarts every few seconds, log shows a pydantic `ValidationError` | A required setting is missing, usually `JWT_SECRET_KEY`. `sudo dokku config:show corkathon2026` |
| Sign-in bounces back to the login page | `COOKIE_SECURE=true` over plain http. Set it to `false`, or serve HTTPS |
| Build killed or stalls | Out of memory. Check `free -h` and the swap above; only one deploy runs at a time |
| cro-tracker returns 401 | Missing or wrong `Authorization: Bearer` header |
| Push ignored | Deploy branch not `main`: `sudo dokku git:set <app> deploy-branch main` |
