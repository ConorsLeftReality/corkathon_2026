# Filing Radar: option 3 deployment guide

Nov 7, 2026 · @Conor Masterson

## Overview

Option 3 is one script, `transcribe_audio.py`, that turns a caller's spoken question into a spoken answer in under 22 seconds. The deploy script `deploy_option3.sh` installs it, checks every dependency as the `asterisk` user, and runs a live test.

What happens on each call:

1. Asterisk records the question and runs `/usr/bin/python3 /opt/filing-radar/transcribe_audio.py <q.wav> <out>`.
2. Speech-to-text with SpeechRecognition + Google (`en-IE`), as in `prova.py`.
3. The question is matched against `report.json` from `app.py` (company name, company number, overdue, due, summary).
4. The answer is spoken with gTTS (Irish English); if gTTS fails, piper with `en_GB-alan-low` takes over.
5. ffmpeg converts it to `<out>.wav`, 8 kHz mono 16-bit, and the script exits 0.

| File | Where it goes | Owner / mode | Purpose |
| --- | --- | --- | --- |
| `transcribe_audio.py` | `/opt/filing-radar/` | root, 755 | The option 3 script |
| `env.example` | `/opt/filing-radar/.env` | asterisk, 600 | Paths and settings (no keys needed) |
| `deploy_option3.sh` | anywhere, run with sudo | not needed | Installs, checks, tests |
| `report.json` | written by `app.py run` | readable by asterisk | The CRO data the answers come from |
| `en_GB-alan-low.onnx` + `.onnx.json` | `/opt/piper-voices/` | readable by asterisk | Piper fallback voice |
| `log.txt` | `/var/spool/asterisk/radar/` | asterisk | QUESTION / ANSWER / timing per call |

## Deploy

One command does the whole install once the three files are on the server: `sudo bash deploy_option3.sh`. It prints OK / WARN / FAIL per check and exits 0 only when everything passes.

1. Copy `transcribe_audio.py`, `env.example` and `deploy_option3.sh` into one folder on the Asterisk server, e.g. `~/option3/`.
2. Make sure today's report exists: `cd /opt/filing-radar && python app.py run` (writes `report.json`).
3. Run the deploy script:

   ```bash
   cd ~/option3
   sudo bash deploy_option3.sh
   ```
4. Read the six sections it prints:
   - **Install**: copies the script to `/opt/filing-radar/` and creates `.env` (asterisk, 600) if missing.
   - **Python libraries**: checks `speech_recognition` and `gtts` import *as asterisk*; if not, installs them system-wide.
   - **Binaries and voice**: ffmpeg, piper, and the voice `.onnx` + `.onnx.json`.
   - **CRO report**: confirms asterisk can read `report.json` and prints a sample spoken summary.
   - **Network**: Google must be reachable for speech-to-text.
   - **End-to-end test**: runs the newest `q-*.wav` exactly as Asterisk does and checks the output format and timing.
5. Tell C the dialplan line stays as is: `/usr/bin/python3 /opt/filing-radar/transcribe_audio.py <in.wav> <out>`. No venv is used.

If `report.json` lives somewhere else, edit one line in `/opt/filing-radar/.env`: `REPORT_PATH=/real/path/report.json`, then rerun step 3.

## Test

Option 3 passes when the manual run prints OK, `/tmp/test.wav` is 8 kHz mono 16-bit, and a real phone call answers in under 20 seconds.

Manual run, exactly as Asterisk does it:

```bash
sudo -u asterisk /usr/bin/python3 /opt/filing-radar/transcribe_audio.py \
  /var/spool/asterisk/radar/<any q-*.wav> /tmp/test && echo OK && ls -l /tmp/test.wav
```

Check the output format and listen to it:

```bash
ffprobe -v error -show_entries stream=sample_rate,channels,codec_name -of csv=p=0 /tmp/test.wav
# expect: pcm_s16le,8000,1
aplay /tmp/test.wav
```

Watch the log while someone calls and presses 3:

```bash
tail -f /var/spool/asterisk/radar/log.txt
```

Each call logs `QUESTION:`, `report: N companies`, `ANSWER:`, `TTS: gtts` (or `piper`) and the elapsed seconds.

Questions to try on the call:

- [ ] "Has Acme filed?" (a company name from your CSV)
- [ ] "What about company one two three four five six?" (a company number)
- [ ] "Which companies are overdue?"
- [ ] "What's due this week?"
- [ ] "Give me a summary"
- [ ] Silence or noise: should say it didn't catch the question, not "sorry"

## Troubleshooting

Most failures show up in `log.txt` as a `FAILED:` traceback or a WARN line; find the symptom below.

| Symptom in log.txt or on the call | Cause | Fix |
| --- | --- | --- |
| `ModuleNotFoundError: speech_recognition` or `gtts` | Libraries installed for your user (VS Code), not system-wide | `sudo pip install SpeechRecognition gTTS` (add `--break-system-packages` if refused) |
| `report error: FileNotFoundError` / caller hears "can't read today's filing report" | `report.json` not at the default path, or not readable by asterisk | Set `REPORT_PATH` in `.env`; `sudo chmod o+r <report.json>` |
| `WARNING: rows found but none parsed; first row keys: [...]` | `report.json` uses field names the script doesn't know | Send that line to Claude; it's a one-line fix in `load_companies` |
| `QUESTION: ''` / caller hears "didn't catch your question" | Recording silent, too quiet, or under 1 s | Check the `q-*.wav` plays; check Asterisk's Record() silence settings |
| `RequestError` from Google | No internet or Google rate limit | Check network; retry; no offline STT fallback |
| `gTTS failed (...), falling back to piper` then piper error | Missing `en_GB-alan-low.onnx.json` | Put the `.onnx.json` next to the `.onnx` in `/opt/piper-voices/` |
| `TIMEOUT after 22s` / caller hears "sorry" | Google slow (STT or TTS) | Set `TTS_ENGINE=piper` in `.env` to make TTS local |
| `FileNotFoundError: /usr/bin/ffmpeg` | ffmpeg elsewhere or not installed | `which ffmpeg`, then set `FFMPEG=` in `.env` |
| Wrong company matched | Two names share a distinctive word | Ask with the company number instead; or add the shared word to `GENERIC` in the script |

## Go / no-go at 16:00

Ship option 3 only if every box below is ticked by 15:55; otherwise cut it and demo options 1 and 2.

- [ ] `deploy_option3.sh` ends with "All checks passed"
- [ ] Manual test exits 0 in under 20 s, `/tmp/test.wav` is `pcm_s16le,8000,1`
- [ ] Three real phone calls in a row answer correctly (name, overdue, summary)
- [ ] `log.txt` shows QUESTION and ANSWER for each call, no `FAILED:`

If Google is flaky in the last minutes, set `TTS_ENGINE=piper` in `.env` rather than cutting: it needs no code change and removes one network call.

To cut option 3 cleanly, C removes or comments out the press-3 branch in the dialplan; nothing else depends on the script.
