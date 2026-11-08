# Phone scripts

Python scripts that run on the Asterisk box (a Raspberry Pi) and answer filing questions over a desk phone. They read reports from [cro-tracker](../cro-tracker/DEPLOY.md).

| File | Installed to | Purpose |
| --- | --- | --- |
| `transcribe_audio.py` | `/opt/filing-radar/` (root, 755) | Called by Asterisk per question; also the hourly `--pregenerate` job |
| `morning_review.py` | `/opt/filing-radar/` | Renders a spoken morning review and rings an extension |
| `env.example` | `/opt/filing-radar/.env` (asterisk, 600) | Settings, all optional except `API_TOKEN` when cro-tracker has one |
| `deploy_option3.sh` | run in place with sudo | Installs, checks every dependency as the `asterisk` user, and runs a live test |

## How a call is answered

1. Asterisk records the question and runs `/usr/bin/python3 /opt/filing-radar/transcribe_audio.py <q.wav> <out> [client]`.
2. Speech to text uses SpeechRecognition with Google (`STT_LANG`, default `en-IE`), so the Pi needs internet.
3. The question is matched against the client's report from `REPORT_URL` (cro-tracker) or `REPORT_PATH` (a local file).
4. The reply is looked up in a cache of clips pre-rendered with Piper. Piper is too slow on the Pi to run during a call, so an hourly cron job (`--pregenerate`, installed by the deploy script) renders every answer ahead of time.
5. The clip is written to `<out>.wav` (8 kHz mono 16-bit) and the script exits 0. Anything else makes Asterisk play its own apology.

## Deploy

Copy `transcribe_audio.py`, `env.example` and `deploy_option3.sh` into one folder on the Pi, then:

```bash
sudo bash deploy_option3.sh                 # install and check
sudo bash deploy_option3.sh q-test.wav acme # also run an end-to-end test for client "acme"
```

It prints OK, WARN or FAIL per check and exits with the number of failures. Set `REPORT_URL`, `DEFAULT_CLIENT` and `API_TOKEN` in `/opt/filing-radar/.env` before the first run.

## Test by hand

```bash
sudo -u asterisk /usr/bin/python3 /opt/filing-radar/transcribe_audio.py \
  /var/spool/asterisk/radar/<any q-*.wav> /tmp/test && echo OK
ffprobe -v error -show_entries stream=sample_rate,channels,codec_name -of csv=p=0 /tmp/test.wav
# expect: pcm_s16le,8000,1
tail -f /var/spool/asterisk/radar/log.txt   # QUESTION, ANSWER and timing per call
```

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `ModuleNotFoundError: speech_recognition` | Installed for your user, not system-wide | `sudo pip install SpeechRecognition` (add `--break-system-packages` if refused) |
| Caller hears "can't read today's filing report" | cro-tracker down, wrong `REPORT_URL`, or a missing or wrong `API_TOKEN` (HTTP 401) | Check `log.txt`, then `curl -H "Authorization: Bearer $API_TOKEN" <REPORT_URL>` |
| Caller hears "don't have that answer ready yet" | The clip has not been pre-rendered | Run `sudo -u asterisk python3 /opt/filing-radar/transcribe_audio.py --pregenerate` |
| Caller hears "didn't catch your question" | Recording silent or under a second | Check the `q-*.wav` plays; check Asterisk's `Record()` silence settings |
| `RequestError` from Google | No internet or rate limit | Check the network and retry; there is no offline speech to text |
| Piper error during pre-render | Missing `.onnx.json` beside the voice | Put both files in `/opt/piper-voices/` |
| Wrong company matched | Two names share a distinctive word | Ask with the company number, or add the word to `GENERIC` in the script |
