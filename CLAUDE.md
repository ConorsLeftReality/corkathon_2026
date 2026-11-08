@AGENTS.md

## Raspberry Pi server
- Reach it with `ssh dialed-in-pi "<command>"` (user `pi`, IP <pi tailscale ip>); use `ssh dialed-in-pi "sudo ..."` for root.
- Debian 12 ARM64, 906 MiB RAM: avoid heavy commands; check `free -h` before builds.
- Dokku apps: corkathon2026 (port 9000), cro-tracker (port 9001, storage /var/lib/dokku/data/storage/cro-tracker).
- Phone: Asterisk + /opt/filing-radar (transcribe_audio.py, morning_review.py, .env); logs in /var/spool/asterisk/radar/.
- Deploys happen via GitHub Actions on push to main; don't push to Dokku by hand.
