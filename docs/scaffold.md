# Scaffold reference

The React and Flask scaffold Dialed-In is built on. This was the original README. It is **Built** and covered by `bun run check`.

## Set up

You need [Bun](https://bun.sh) and [uv](https://docs.astral.sh/uv/getting-started/installation). uv fetches the right Python for you.

```bash
bun install
bun run setup
bun run dev
```

Open http://localhost:5173. `bun run setup` writes your `.env` with a new secret, installs the Python packages and downloads the Playwright browser.

## How the two halves connect

```
dev:   browser -> Vite :5173 -> /api proxied to Flask :5001
prod:  browser -> Flask :5001 -> /api routes, everything else from the built React app
```

The browser only ever talks to one origin, so there is no CORS to configure. Sign-in uses an HttpOnly cookie, and `apiRequest` in `apps/web/src/api/api-client.ts` adds the CSRF header for you.

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Runs Vite and Flask together, both reload on save |
| `bun run check` | Everything CI runs: types, lint, format, unit tests, e2e, build |
| `bun run test` | Unit tests for web, API and scripts |
| `bun run e2e` | Playwright at 360px and 1440px against the built app |
| `bun run format` | Formats TypeScript and Python |
| `bun run start` | Builds React and serves it from Flask on port 5001 |

## Add a feature

Work in your own feature folder so the three of us rarely touch the same file.

1. Add `apps/api/corkathon_api/features/<name>/` with `models.py`, `schemas.py`, `routes.py` and `routes_test.py`. Copy from `features/notes`.
2. Register the blueprint in `apps/api/corkathon_api/app.py`. This is the one shared line.
3. Add `apps/web/src/features/<name>/` with a `<name>-api.ts` that declares the zod schema for each response.
4. Add a page in `apps/web/src/routes/`, register it in `src/App.tsx`, and add a nav item in `src/shell/Shell.tsx` if it needs one.
5. Add an e2e test in `apps/web/tests/e2e/`.

Column changes need a fresh local database, since tables are made with `create_all` and there are no migrations. Stop the server and delete `apps/api/instance/`.

## Frontend

| Route | Page |
|---|---|
| `/` | Public landing page |
| `/login` | Sign in and create account |
| `/app` | Overview, needs a session |
| `/app/notes` | Example feature, needs a session |

The look comes from SolLoop: glass surfaces, Mona Sans and one indigo accent. To change the accent, edit `--color-signal` in `apps/web/src/theme.css`.

`src/components/ui/` holds Aceternity's sidebar, sticky banner, flip words, magnetic button and border button. To pull in more, run this from `apps/web`:

```bash
bunx shadcn@latest add @aceternity/<name>
```

Then read what it added, swap any default Tailwind colours for our tokens, change `motion` to `m`, and remove any animated `filter`, `width` or `height`.

## Deploy

One container serves everything. On Coolify, point a Dockerfile or compose service at this repo and set:

| Variable | Value |
|---|---|
| `JWT_SECRET_KEY` | Output of `openssl rand -hex 32` |
| `TRUSTED_PROXIES` | `1`, so rate limits see the real client address |

The SQLite file lives on the `/data` volume, and Flask listens on port 5001. Cookies are marked `Secure` in the container, so the site needs HTTPS. Over plain `http://` (a Dokku app without Let's Encrypt, a Coolify `sslip.io` domain, a LAN address) the browser drops the session cookie and sign in bounces straight back to the login page. Turn on HTTPS (`dokku letsencrypt:enable <app>`), or set `COOKIE_SECURE=false` for an http only setup (`dokku config:set <app> COOKIE_SECURE=false`).

To run it locally: `JWT_SECRET_KEY=<secret> docker compose up --build`.

Rate limits are counted in memory, so keep to one container. Sign-in allows 10 attempts a minute per address and email pair, then 50 per address and 50 per email, set with `AUTH_RATE_LIMIT_PER_MINUTE`. Keep port 5001 private behind the proxy: if clients can reach it directly while `TRUSTED_PROXIES` is set, they can forge their address.
