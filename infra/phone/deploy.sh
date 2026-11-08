#!/usr/bin/env bash
# Dialed-In CRO Tracker phone scripts: install to /opt/dialed-in and check everything.
# Usage:  sudo bash infra/phone/deploy.sh [path/to/q-test.wav] [client]
#         (pass "" as the wav to skip the end-to-end test but still pick a client)
# Safe to rerun. Also moves an old /opt/filing-radar install across.
#
# MORNING_EXTENSION=1001 (default) sets who the weekday morning review rings.
# MORNING_EXTENSION=none skips the morning call cron line.
set -u
APP=/opt/dialed-in
OLD_APP=/opt/filing-radar
SCRIPT=$APP/transcribe_audio.py
ENVF=$APP/.env
PY=/usr/bin/python3
FFMPEG=/usr/bin/ffmpeg
PIPER=/usr/local/bin/piper
VOICE=/opt/piper-voices/en_GB-alan-low.onnx
SPOOL=/var/spool/asterisk/dialed-in
CRON=/etc/cron.d/dialed-in
MORNING_EXTENSION=${MORNING_EXTENSION:-1001}
AS="sudo -u asterisk"

ok()   { echo -e "  \e[32mOK\e[0m   $*"; }
bad()  { echo -e "  \e[31mFAIL\e[0m $*"; FAILS=$((FAILS+1)); }
warn() { echo -e "  \e[33mWARN\e[0m $*"; }
FAILS=0
CLIENT=${2:-}

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
cd "$(dirname "$0")"

echo "== 1. Install files"
install -d -m 755 "$APP"
for f in transcribe_audio.py morning_review.py call_extension.py; do
  install -m 755 -o root -g root "$f" "$APP/$f" && ok "installed $APP/$f"
done
if [ ! -f "$ENVF" ] && [ -f "$OLD_APP/.env" ]; then
  # keep the old settings, pointing any old paths at the new ones
  sed 's#/opt/filing-radar#/opt/dialed-in#g; s#/var/spool/asterisk/radar#/var/spool/asterisk/dialed-in#g' \
    "$OLD_APP/.env" > "$ENVF" && ok "copied settings from $OLD_APP/.env"
fi
if [ ! -f "$ENVF" ]; then
  install -m 600 env.example "$ENVF" && ok "created $ENVF from env.example (edit API_TOKEN and DEFAULT_CLIENT)"
fi
chown asterisk:asterisk "$ENVF"; chmod 600 "$ENVF"; ok "$ENVF owned by asterisk, mode 600"
install -d -o asterisk -g asterisk "$SPOOL" "$SPOOL/calls" && ok "$SPOOL ready"
if [ -f /etc/cron.d/filing-radar ]; then
  rm -f /etc/cron.d/filing-radar && ok "removed old /etc/cron.d/filing-radar"
fi
[ -d "$OLD_APP" ] && warn "$OLD_APP still exists; delete it once calls work: sudo rm -r $OLD_APP"

echo "== 2. Python libraries as the asterisk user"
$PY -m pip --version >/dev/null 2>&1 || { warn "pip missing, installing python3-pip"; apt-get install -y python3-pip >/dev/null; }
if $AS $PY -c "import speech_recognition" 2>/dev/null; then
  ok "speech_recognition importable"
else
  warn "not importable by asterisk, installing system-wide"
  $PY -m pip install SpeechRecognition 2>/dev/null \
    || $PY -m pip install --break-system-packages SpeechRecognition
  $AS $PY -c "import speech_recognition" 2>/dev/null \
    && ok "now importable" || bad "still can't import speech_recognition as asterisk"
fi

echo "== 3. Binaries and voice"
[ -x $FFMPEG ] && ok "ffmpeg $FFMPEG" || bad "ffmpeg missing at $FFMPEG (apt install ffmpeg)"
# speechrecognition only bundles flac for x86, so arm64 needs the system one
command -v flac >/dev/null && ok "flac $(command -v flac)" || bad "flac missing (sudo apt install flac), Google speech to text needs it on ARM"
[ -x $PIPER ]  && ok "piper $PIPER"   || bad "piper missing at $PIPER, all speech comes from piper"
$AS test -r "$VOICE"      && ok "voice model readable"  || bad "$VOICE not readable by asterisk"
$AS test -r "$VOICE.json" && ok "voice config readable" || bad "$VOICE.json missing, piper will fail"

echo "== 4. CRO report"
if $AS $PY - "$CLIENT" <<'EOF'
import sys, datetime
sys.path.insert(0, "/opt/dialed-in")
import transcribe_audio as t
cfg = t.load_env()
src = t.report_source(cfg, sys.argv[1])
print("       source:", src)
cs = t.load_companies(src, int(cfg["WINDOW_DAYS"]), datetime.date.today())
print(f"       parsed {len(cs)} companies")
if cs:
    print("       sample answer:", t.numbers_to_words(t.answer("give me a summary", cs, datetime.date.today())))
EOF
then
  ok "report readable"
else
  bad "can't read the report (is cro-tracker up? check REPORT_URL, DEFAULT_CLIENT and API_TOKEN in $ENVF)"
fi

echo "== 5. Network"
$AS $PY -c "import urllib.request as u; u.urlopen('https://www.google.com', timeout=5)" 2>/dev/null \
  && ok "internet reachable" || warn "no internet, Google speech to text will fail"

echo "== 6. Cron jobs and pre-rendered answers (slow on the Pi, several minutes the first time)"
{
  echo "# Dialed-In CRO Tracker, written by infra/phone/deploy.sh. Rerun the script instead of editing."
  echo "SHELL=/bin/sh"
  echo "PATH=/usr/sbin:/usr/bin:/sbin:/bin"
  echo "# re-render phone answers every hour; only new or changed answers are rendered"
  echo "30 * * * * asterisk flock -n /tmp/dialed-in-pregen.lock $PY $SCRIPT --pregenerate >> $SPOOL/pregen.log 2>&1"
  if [ "$MORNING_EXTENSION" != "none" ]; then
    echo "# weekday morning review: render at 07:30 so the 08:00 call starts at once"
    echo "30 7 * * 1-5 root $PY $APP/morning_review.py --dry-run >> $SPOOL/morning.log 2>&1"
    echo "0 8 * * 1-5 root $PY $APP/morning_review.py --endpoint $MORNING_EXTENSION >> $SPOOL/morning.log 2>&1"
  fi
} > "$CRON"
chmod 644 "$CRON" && ok "cron installed: $CRON (morning call to: $MORNING_EXTENSION)"
if $AS flock -n /tmp/dialed-in-pregen.lock $PY "$SCRIPT" --pregenerate; then
  ok "answers rendered to $($AS $PY -c "import sys; sys.path.insert(0,'$APP'); import transcribe_audio as t; print(t.load_env()['TTS_CACHE'])")"
else
  bad "pre-render had problems, see output above"
fi

echo "== 7. End-to-end test (exactly as Asterisk runs it)"
WAV=${1:-$(ls -t $SPOOL/q-*.wav 2>/dev/null | head -1)}
if [ -z "${WAV:-}" ] || [ ! -f "$WAV" ]; then
  warn "no q-*.wav to test with yet; call 100, press 1 then 3, ask something, and rerun"
else
  rm -f /tmp/test.wav
  START=$(date +%s%N)
  if $AS $PY "$SCRIPT" "$WAV" /tmp/test $CLIENT; then
    MS=$(( ($(date +%s%N) - START) / 1000000 )); T="$((MS/1000)).$(( (MS%1000)/100 ))"
    ok "exit 0 in ${T}s"
    FMT=$(ffprobe -v error -show_entries stream=sample_rate,channels,codec_name -of csv=p=0 /tmp/test.wav 2>/dev/null)
    [ "$FMT" = "pcm_s16le,8000,1" ] && ok "/tmp/test.wav is 8 kHz mono 16-bit" || bad "wrong format: $FMT"
    [ "$MS" -lt 20000 ] || warn "took ${T}s, close to the 25 s limit"
  else
    bad "script exited non-zero, see output above"
  fi
fi

echo
[ $FAILS -eq 0 ] && echo -e "\e[32mAll checks passed, the CRO Tracker phone line is ready.\e[0m" \
                 || echo -e "\e[31m$FAILS check(s) failed, fix above, then rerun.\e[0m"
exit $FAILS
