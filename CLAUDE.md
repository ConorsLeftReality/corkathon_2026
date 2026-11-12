@AGENTS.md

## Raspberry Pi server
- How to reach it (SSH alias, user, IP) is in `CLAUDE.local.md`, which is gitignored: keep machine details out of this public repo.
- Debian 12 ARM64, 906 MiB RAM: avoid heavy commands; check `free -h` before builds.
- Dokku apps: corkathon2026 (port 9000), cro-tracker (port 9001, storage /var/lib/dokku/data/storage/cro-tracker).
- Phone: Asterisk + /opt/dialed-in (transcribe_audio.py, morning_review.py, call_extension.py, .env); logs in /var/spool/asterisk/dialed-in/.
- The Pi has a clone in ~/corkathon2026 for running infra/ scripts; `git pull` there first. Full map: docs/where-things-live.md.
- Deploys happen via GitHub Actions on push to main; don't push to Dokku by hand.
