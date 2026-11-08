# Dialed-In

Dialed-In tells an accountant, on a web page or their phone, which companies are about to miss or have already missed a CRO filing deadline, using the free daily Companies Registration Office register, and shows how it got each answer.

## What is in the repo

| Path | What it is | Deployed as |
|---|---|---|
| `apps/web` | React and Vite front end: sign-in, the Today page (`/app`) and the Filing deadlines page (`/app/radar`) | Built into the main container |
| `apps/api` | Flask API: sign-in, the filings report, stored radar questions, notes | The main container (`Dockerfile`) |
| `apps/cro-tracker` | Standalone multi-client report API and daily job, read by the phone | Its own container, see [deployment](docs/deployment/03-dokku-and-apps.md) |
| `infra` | Everything on the Pi outside the containers: network, Asterisk config and menus, the CRO Tracker phone scripts, Dokku setup | Scripts run on the Pi, see [infra](infra/README.md) |

## What works today

| Feature | Status |
|---|---|
| Sign-in with HttpOnly cookie sessions, CSRF and rate limits; accounts by one-time invite link | Built |
| **Today page**: overdue and due-soon companies from the daily CRO snapshot for the account's own clients | Built |
| **Filing deadlines page**: stored questions (overdue clients, due this week, prospects by area and sector), each showing the filter, row count and snapshot date | Built |
| **Phone, CRO Tracker**: dial `100`, press `1` twice, ask a question on a DECT handset, hear an answer pre-rendered with Piper from the cro-tracker report | Built (`infra/phone`, `infra/asterisk`) |
| **Morning review call**: the phone rings and reads the day's overdue and due companies | Built (`infra/phone/morning_review.py`) |
| Free-text questions answered by Claude turned into a checked filter | Planned. The API returns `503 radar_llm_unavailable` and the page offers the stored questions |
| **Clients page**: each account adds its own companies by number or CSV upload (`/api/clients`), seen only by that account | Built |

## Quickstart

You need [Bun](https://bun.sh), [uv](https://docs.astral.sh/uv/getting-started/installation) and Node.js 20 or newer (for Playwright).

```bash
bun install
bun run setup   # writes .env with a new secret, installs Python packages and the Playwright browser
bun run dev     # Vite on :5173, Flask on :5001
```

Open http://localhost:5173 and create an account. The first request of the day downloads the CRO snapshot (about 47 MB), so the Today page shows "building" for a minute.

`bun run dev:mock` answers `/api/radar/*` with placeholder data from `apps/web/dev/radar-mock.ts`, for front-end work without the CRO file.

## Checks

`bun run check` runs typecheck, lint, format check, unit tests (Bun and pytest), Playwright e2e and the production build. CI runs the same on every push and pull request.

## Deploy

The whole system, from a blank SD card to a working phone line, is in [docs/deployment](docs/deployment/README.md). In short: one Raspberry Pi runs Dokku (the site and cro-tracker) and Asterisk (the phone), and GitHub Actions redeploys both apps on every push to `main`.

The site is one container serving the API and the built front end. Set at least:

| Variable | Value |
|---|---|
| `JWT_SECRET_KEY` | Output of `openssl rand -hex 32` |
| `TRUSTED_PROXIES` | `1` behind one reverse proxy, so rate limits see the real client address |
| `ALLOWED_EMAILS` | Comma-separated emails or `@domain` entries that may create an account and sign in. **Production lets nobody in until this is set.** Development with it empty lets anyone sign up |
| `INVITES_REQUIRED` | Sign-up needs a one-time link from `python -m corkathon_api.invites create <email>`. On by default in production. In development it is off, and any `/login?invite=x` shows the sign-up form |
| `SITE_URL` | The site's address, so the invite command prints a full link |

Serve it over HTTPS: session cookies are `Secure` in production. Data lives on the `/data` volume. Full detail in [docs/scaffold.md](docs/scaffold.md#deploy) and [docs/api-contract.md](docs/api-contract.md).

Pushes to `main` deploy to Dokku through `.github/workflows/deploy.yml`, which needs the repository secrets `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `PI_TAILSCALE_IP` and `DOKKU_SSH_KEY`.

## Docs

| Doc | What is in it |
|---|---|
| [where-things-live](docs/where-things-live.md) | Every folder in the repo and on the Pi, and how one becomes the other |
| [deployment](docs/deployment/README.md) | Setting up the Pi, Asterisk, Dokku, the phone line and CI deploys |
| [api-contract](docs/api-contract.md) | Filings and radar API routes and schemas |
| [scaffold](docs/scaffold.md) | Project layout, commands and deploy |
| [decisions](docs/design/decisions.md) | Short decision records |
| [01-overview](docs/design/01-overview.md) | Problem, users and the two modes |
| [08-limits-and-roadmap](docs/design/08-limits-and-roadmap.md) | What it cannot do, what comes next |

The design notes below describe the fuller planned system (DuckDB, a Claude-backed question engine, FastAGI telephony). Each section is labelled Built or Planned, and much of it is Planned:

| Doc | What is in it |
|---|---|
| [02-architecture](docs/design/02-architecture.md) | Components and flows for web, phone and morning briefing |
| [03-data](docs/design/03-data.md) | Dataset, fields, licence, freshness gate, derived fields |
| [04-question-engine](docs/design/04-question-engine.md) | Filter schema, prompt, guardrails, SQL templates |
| [05-telephony](docs/design/05-telephony.md) | The original telephony plan; the built setup is in [deployment](docs/deployment/02-asterisk.md) |
| [06-runbook](docs/design/06-runbook.md) | Laptop setup for the planned design; the Pi is in [deployment](docs/deployment/README.md) |

## Data attribution

Contains data from the Companies Registration Office (CRO), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Source: CRO Open Data Portal, Company Records dataset.

## Licence

[MIT](LICENSE)
