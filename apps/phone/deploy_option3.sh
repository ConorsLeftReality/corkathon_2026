#!/usr/bin/env bash
# Filing Radar - deploy & check phone option 3 (transcribe_audio.py)
# Usage:  sudo bash deploy_option3.sh [path/to/q-test.wav] [client]
#         (pass "" as the wav to skip the end-to-end test but still pick a client)
# Run from the folder that holds transcribe_audio.py (and env.example).
set -u
APP=/opt/filing-radar
SCRIPT=$APP/transcribe_audio.py
ENVF=$APP/.env
PY=/usr/bin/python3
FFMPEG=/usr/bin/ffmpeg
PIPER=/usr/local/bin/piper
VOICE=/opt/piper-voices/en_GB-alan-low.onnx
SPOOL=/var/spool/asterisk/radar
AS="sudo -u asterisk"

ok()   { echo -e "  \e[32mOK\e[0m   $*"; }
bad()  { echo -e "  \e[31mFAIL\e[0m $*"; FAILS=$((FAILS+1)); }
warn() { echo -e "  \e[33mWARN\e[0m $*"; }
FAILS=0
CLIENT=${2:-}

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo."; exit 1; }
cd "$(dirname "$0")"

echo "== 1. Install files"
[ -f transcribe_audio.py ] || { echo "transcribe_audio.py not found next to this script"; exit 1; }
install -d -m 755 "$APP"
install -m 755 -o root -g root transcribe_audio.py "$SCRIPT" && ok "installed $SCRIPT"
if [ ! -f "$ENVF" ] && [ -f env.example ]; then
  install -m 600 -o asterisk -g asterisk env.example "$ENVF" && ok "created $ENVF from env.example"
elif [ -f "$ENVF" ]; then
  chown asterisk:asterisk "$ENVF"; chmod 600 "$ENVF"; ok "$ENVF already exists (kept, permissions fixed)"
else
  warn "no .env (defaults will be used)"
fi
install -d -o asterisk -g asterisk "$SPOOL" && ok "$SPOOL ready"

echo "== 2. Python libraries as the asterisk user"
$PY -m pip --version >/dev/null 2>&1 || { warn "pip missing - installing python3-pip"; apt-get install -y python3-pip >/dev/null; }
if $AS $PY -c "import speech_recognition, gtts" 2>/dev/null; then
  ok "speech_recognition + gtts importable"
else
  warn "not importable by asterisk - installing system-wide"
  $PY -m pip install SpeechRecognition gTTS 2>/dev/null \
    || $PY -m pip install --break-system-packages SpeechRecognition gTTS
  $AS $PY -c "import speech_recognition, gtts" 2>/dev/null \
    && ok "now importable" || bad "still can't import speech_recognition/gtts as asterisk"
fi

echo "== 3. Binaries and voice"
[ -x $FFMPEG ] && ok "ffmpeg $FFMPEG" || bad "ffmpeg missing at $FFMPEG (apt install ffmpeg)"
# SpeechRecognition only bundles flac for x86; on a Pi (ARM64) Google STT needs the system one
command -v flac >/dev/null && ok "flac $(command -v flac)" || bad "flac missing (sudo apt install flac) - Google STT needs it on ARM"
[ -x $PIPER ]  && ok "piper $PIPER"   || warn "piper missing - no offline fallback"
$AS test -r "$VOICE"      && ok "voice model readable"      || warn "$VOICE not readable by asterisk"
$AS test -r "$VOICE.json" && ok "voice config readable"     || warn "$VOICE.json missing - piper will fail"

echo "== 4. CRO report"
if $AS $PY - "$CLIENT" <<'EOF'
import sys, datetime
sys.path.insert(0, "/opt/filing-radar")
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
  bad "can't read the report (is cro-tracker up? check REPORT_URL / DEFAULT_CLIENT in $ENVF)"
fi

echo "== 5. Network"
$AS $PY -c "import urllib.request as u; u.urlopen('https://www.google.com', timeout=5)" 2>/dev/null \
  && ok "internet reachable" || warn "no internet - Google STT will fail (set TTS_ENGINE=piper for TTS)"

echo "== 6. End-to-end test (exactly as Asterisk runs it)"
WAV=${1:-$(ls -t $SPOOL/q-*.wav 2>/dev/null | head -1)}
if [ -z "${WAV:-}" ] || [ ! -f "$WAV" ]; then
  warn "no q-*.wav to test with - pass one: sudo bash $0 /path/q-test.wav"
else
  rm -f /tmp/test.wav
  START=$(date +%s%N)
  if $AS $PY "$SCRIPT" "$WAV" /tmp/test $CLIENT; then
    MS=$(( ($(date +%s%N) - START) / 1000000 )); T="$((MS/1000)).$(( (MS%1000)/100 ))"
    ok "exit 0 in ${T}s"
    FMT=$(ffprobe -v error -show_entries stream=sample_rate,channels,codec_name -of csv=p=0 /tmp/test.wav 2>/dev/null)
    [ "$FMT" = "pcm_s16le,8000,1" ] && ok "/tmp/test.wav is 8 kHz mono 16-bit" || bad "wrong format: $FMT"
    [ "$MS" -lt 20000 ] || warn "took ${T}s - close to the 25 s limit"
  else
    bad "script exited non-zero - see output above"
  fi
fi

echo
[ $FAILS -eq 0 ] && echo -e "\e[32mAll checks passed - option 3 is ready.\e[0m" \
                 || echo -e "\e[31m$FAILS check(s) failed - fix above, then rerun.\e[0m"
exit $FAILS
