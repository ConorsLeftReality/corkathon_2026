# Working in this repo

Rules for the three of us and for any coding agent. `README.md` covers the product and quickstart, `docs/scaffold.md` the scaffold commands and deploy, and `docs/` the Dialed-In design.

## Layout

- `apps/web`: React 19, React Router, Vite, Tailwind v4.
  - `src/routes/`: one file per page, wired up in `src/App.tsx`.
  - `src/features/<name>/`: API calls, hooks and components for one feature.
  - `src/shell/Shell.tsx`: the signed-in layout. Add nav items in `NAV_ITEMS`.
  - `src/components/ui/`: copy-in components, which are ours once imported.
- `apps/api`: Flask, SQLAlchemy, pydantic. Features live in `corkathon_api/features/<name>/`.
- `apps/web/tests/e2e`: Playwright against the built app served by Flask.
- `apps/cro-tracker`: standalone Flask report API read by the phone, deployed as its own Dokku app.
- `infra/`: Pi network, Asterisk config and menus, the CRO Tracker phone scripts and Dokku setup. How to deploy all of it is in `docs/deployment/`.
- `notes` is the example feature. Copy its shape, then delete it when the real project needs the space.

## Rules

- Bun only for JS, uv only for Python. Ask the team before adding a dependency, and pin it exactly.
- Parse every outside value once at the edge: pydantic for request bodies and env, zod for responses.
- Every route that touches user data uses `@jwt_required()` and filters by `signed_in_user().id`.
- Errors are `AppError` with a stable `code`. The web client reads `code`, never the message.
- Tests sit beside source (`*_test.py`, `*.test.ts`). E2E files are `*.e2e.ts`.
- Each feature gets a failure case and an e2e of the flow. A route that holds user data gets a test proving another user cannot reach it.
- UI colours and sizes are tokens in `src/theme.css`. No raw hex in components.
- Animate `transform` and `opacity` only, with `m` from `motion/react`, never `motion`. `LazyMotion` is strict, so `motion.div` throws.
- A component pulled from a registry gets read in full, then restyled to our tokens. The default Tailwind palette is switched off, so `neutral-500` and friends generate nothing.
- Every screen has loading, empty and error states, and works at 360px and 1440px.
- No em dashes, en dashes or emoji anywhere. `bun run lint` enforces this along with the banned words in `scripts/slop-words.txt`.
- Comments are rare, one lowercase line, and say why.
- Commits are `type(scope): lowercase subject`, 60 characters at most. Scopes are `web`, `api` and `repo`.
- No AI attribution in commits or PRs: no co-author trailer, no "Generated with" footer.

`bun run check` must pass before anything is pushed.
