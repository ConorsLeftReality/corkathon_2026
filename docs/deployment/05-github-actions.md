# 5. GitHub Actions deploys

Pushing to `main` deploys automatically. Each workflow joins the tailnet as `tag:corkathon-ci`, then `git push`es to Dokku on the Pi.

| Workflow | Runs when | Deploys |
|---|---|---|
| `.github/workflows/ci.yml` | Every push and pull request | Nothing; runs `bun run check` |
| `.github/workflows/deploy.yml` | Push to `main`, except changes only in `apps/cro-tracker`, `infra` or `docs` | `corkathon2026` |
| `.github/workflows/deploy-cro-tracker.yml` | Push to `main` touching `apps/cro-tracker` | `cro-tracker` |

Both deploy workflows can also be run by hand from the Actions tab, and they never run at the same time, because two Docker builds would run the Pi out of memory.

## Deploy key

On your laptop, make a key used only for deploys:

```bash
ssh-keygen -t ed25519 -N "" -f dokku_deploy -C github-actions
```

On the Pi, let it push to Dokku:

```bash
sudo dokku ssh-keys:add github-actions < dokku_deploy.pub
```

## Repository secrets

Settings, Secrets and variables, Actions:

| Secret | Value |
|---|---|
| `TS_OAUTH_CLIENT_ID` | Tailscale OAuth client id (step 1) |
| `TS_OAUTH_SECRET` | Tailscale OAuth client secret |
| `PI_TAILSCALE_IP` | Output of `tailscale ip -4` on the Pi |
| `DOKKU_SSH_KEY` | The private key `dokku_deploy` as one base64 line: `base64 -w0 dokku_deploy` (PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("dokku_deploy"))`) |

Then delete `dokku_deploy` from your laptop, or keep it in a password manager.

## Check

Run "Deploy corkathon2026" from the Actions tab. The log should end with Dokku's `Application deployed` and the app's URL.

| Failure in the log | Fix |
|---|---|
| `DOKKU_SSH_KEY is not a clean base64 line` | Re-copy the secret as a single line with no line breaks |
| Tailscale step hangs or `ping` fails | Pi offline, wrong `PI_TAILSCALE_IP`, or the OAuth client cannot use `tag:corkathon-ci` |
| `Permission denied (publickey)` | The public key was not added with `dokku ssh-keys:add` |
| `shallow update not allowed` | The checkout lost `fetch-depth: 0` |
