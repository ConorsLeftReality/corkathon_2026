# Deploying cro-tracker on the Pi (Dokku)

## Clients

One CSV per client in `clients/`. The file name is the client id:

```
apps/cro-tracker/clients/acme.csv       ->  /api/acme/report
apps/cro-tracker/clients/murphy-co.csv  ->  /api/murphy-co/report
```

Lower case letters, digits, `-` and `_` only. Each CSV needs a `company_num` column.
To add or change a client: edit the CSV, commit, push. GitHub deploys it.
Keep this repo **private**, because it lists who your clients are.

## One-time setup (on the Pi)

```bash
sudo dokku apps:create cro-tracker
sudo dokku git:set cro-tracker deploy-branch main
sudo dokku builder:set cro-tracker selected dockerfile
sudo dokku builder:set cro-tracker build-dir apps/cro-tracker   # it lives in a subfolder of corkathon2026

# Reports and CRO snapshots survive redeploys
sudo dokku storage:ensure-directory cro-tracker
sudo chown -R 1000:1000 /var/lib/dokku/data/storage/cro-tracker
sudo dokku storage:mount cro-tracker /var/lib/dokku/data/storage/cro-tracker:/app/data

sudo dokku config:set --no-restart cro-tracker ALLOWED_ORIGIN='*' WINDOW_DAYS=30
sudo dokku ports:set cro-tracker http:9001:5000
```

Then push. `.github/workflows/deploy-cro-tracker.yml` deploys it whenever `apps/cro-tracker/` changes on `main`.

## After the first deploy

```bash
sudo dokku cron:list cro-tracker                       # daily rebuild at 00:05
sudo dokku run cro-tracker python scheduler.py --once  # build today's reports now
curl http://127.0.0.1:9001/api/clients
```

The API also rebuilds by itself on the first request of a new day, so the exact
cron time doesn't matter.

## API

| Request | Returns |
| --- | --- |
| `GET /api/clients` | every client with its counts |
| `GET /api/<client>/report?status=due,overdue` | full report, optional filter |
| `GET /api/<client>/companies` | sorted company list |
| `GET /api/<client>/briefing` | plain-text briefing |
| `POST /api/<client>/refresh` | rebuild now (all clients) |
| `/api/report` etc. | same, for `DEFAULT_CLIENT` or the only client |

`docker-compose.yml`, `Caddyfile` and `deploy/` are for running without Dokku. Dokku ignores them.
