# CRO Tracker phone scripts

Python scripts that run on the Pi beside Asterisk. They read the client report from [cro-tracker](../../apps/cro-tracker/DEPLOY.md). Install and test them with `sudo bash infra/phone/deploy.sh`; the full steps and troubleshooting are in [docs/deployment/04-phone.md](../../docs/deployment/04-phone.md).

| File | Installed to | Purpose |
| --- | --- | --- |
| `transcribe_audio.py` | `/opt/dialed-in/` | Run by Asterisk when a caller presses 1 and asks a question; also the hourly `--pregenerate` job |
| `morning_review.py` | `/opt/dialed-in/` | Builds the spoken morning review and rings an extension with it |
| `call_extension.py` | `/opt/dialed-in/` | Rings an extension and plays a WAV, through an Asterisk call file |
| `env.example` | `/opt/dialed-in/.env` (asterisk, 600) | Settings. `API_TOKEN` and `DEFAULT_CLIENT` are the ones to fill in |
| `deploy.sh` | run in place with sudo | Installs, writes the cron jobs, checks every dependency as the `asterisk` user, runs a live test |

## How a question is answered

1. Asterisk records the question to `/var/spool/asterisk/dialed-in/q-<id>.wav` and runs `transcribe_audio.py <q.wav> <out> [client]` with a 25 second limit.
2. Speech to text uses SpeechRecognition with Google (`STT_LANG`, default `en-IE`), so the Pi needs internet.
3. The question is matched against the client's report from `REPORT_URL` (cro-tracker) or `REPORT_PATH`.
4. The reply comes from a cache of clips pre-rendered with Piper. Piper takes about a minute on a Pi 3, too slow for a live call, so the hourly cron job renders every answer ahead of time.
5. The clip is written to `<out>.wav` (8 kHz mono 16-bit) and the script exits 0. Anything else makes Asterisk play the "sorry" prompt.
