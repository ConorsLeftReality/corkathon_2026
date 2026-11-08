# 4. CRO Tracker phone line

The scripts in [`infra/phone`](../../infra/phone/README.md) answer calls to `100`, then `1` (CRO Tracker), from the cro-tracker report, and ring a handset each weekday morning with the review.

## Install

Steps 1 to 3 must be done: Piper, Asterisk with the Dialed-In config, and cro-tracker running with a client CSV.

```bash
cd ~/corkathon2026
sudo bash infra/phone/deploy.sh
sudo nano /opt/dialed-in/.env
```

In `.env`, set:

- `API_TOKEN`: the value `infra/dokku/setup.sh` printed (`sudo dokku config:get cro-tracker API_TOKEN`).
- `DEFAULT_CLIENT`: the client id the phone answers for, the CSV name in `apps/cro-tracker/clients/` without `.csv`.

Then run `deploy.sh` again. It prints OK, WARN or FAIL per check and exits with the number of failures. The first run pre-renders every answer with Piper, which takes several minutes.

`deploy.sh` also writes `/etc/cron.d/dialed-in`:

| When | What |
|---|---|
| Every hour at :30 | Re-render answers that changed (`transcribe_audio.py --pregenerate`) |
| Weekdays 07:30 | Render the morning review (`morning_review.py --dry-run`) |
| Weekdays 08:00 | Ring `1001` and play it |

To ring another extension, rerun with `sudo MORNING_EXTENSION=1002 bash infra/phone/deploy.sh`. `MORNING_EXTENSION=none` turns the morning call off.

## Moving from the Filing Radar install

The first Pi ran these scripts from `/opt/filing-radar` with the menu in `/etc/asterisk/filing-radar.conf`. To move it across:

```bash
cd ~/corkathon2026 && git pull
sudo bash infra/asterisk/install.sh   # installs dialed-in.conf, retires filing-radar.conf
sudo bash infra/asterisk/make_prompts.sh --force menu   # the CRO Tracker menu no longer says "Filing Radar"
sudo bash infra/phone/deploy.sh       # copies /opt/filing-radar/.env across, removes the old cron file
```

Call `100`, press `1`, then `3`, and ask a question. When it answers, delete the old folder: `sudo rm -r /opt/filing-radar`.

The new `100` has a top menu, so callers press `1` for CRO Tracker before the old options. `make_prompts.sh` renders the new `main-menu` prompt; if you used ElevenLabs for the others, record `main-menu` and `menu` there too.

## Test by hand

```bash
# ring a handset with any audio
sudo python3 /opt/dialed-in/call_extension.py /tmp/test.wav 1001
# the morning review, without calling
sudo python3 /opt/dialed-in/morning_review.py --dry-run
# answer a recorded question exactly as Asterisk does
sudo -u asterisk /usr/bin/python3 /opt/dialed-in/transcribe_audio.py \
  /var/spool/asterisk/dialed-in/<any q-*.wav> /tmp/test && echo OK
tail -f /var/spool/asterisk/dialed-in/log.txt   # question, answer and timing per call
```

## Known gaps

- Options `1` and `2` play the fixed `week` and `overdue-cork` prompts, which are still placeholders ("Details coming soon"). Option `3` and the morning review do read the live report.
- Speech to text uses Google's free endpoint, so option `3` needs internet. There is no offline fallback.

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ModuleNotFoundError: speech_recognition` | Installed for your user, not system-wide | `sudo pip install SpeechRecognition --break-system-packages` |
| Caller hears "can't read today's filing report" | cro-tracker down, wrong `REPORT_URL`, or a missing or wrong `API_TOKEN` (HTTP 401) | Check `log.txt`, then `curl -H "Authorization: Bearer <token>" <REPORT_URL>` |
| Caller hears "don't have that answer ready yet" | The answer has not been pre-rendered | `sudo -u asterisk python3 /opt/dialed-in/transcribe_audio.py --pregenerate` |
| Caller hears "didn't catch your question" | Recording silent or under a second | Check the `q-*.wav` plays |
| Caller hears "sorry" every time | The script failed or took over 25 seconds | `tail /var/spool/asterisk/dialed-in/log.txt` |
| `RequestError` from Google | No internet or rate limit | Check the hotspot; retry |
| Piper error during pre-render | Missing `.onnx.json` beside the voice | Put both files in `/opt/piper-voices/` |
| Morning call never rings | Handset not registered, or the call file failed | `sudo asterisk -rx "pjsip show contacts"`, then `ls /var/spool/asterisk/outgoing_done/` |
| Wrong company matched | Two names share a distinctive word | Ask with the company number, or add the word to `GENERIC` in `transcribe_audio.py` |
