#!/usr/bin/env bash
# Render the Dialed-In menu prompts with Piper into /srv/voip/prerendered_audio.
# Usage:  sudo bash infra/asterisk/make_prompts.sh                 # only prompts that are missing
#         sudo bash infra/asterisk/make_prompts.sh --force         # re-render every prompt
#         sudo bash infra/asterisk/make_prompts.sh --force menu    # re-render just these
# Missing-only is the default so recordings you dropped in yourself (e.g. ElevenLabs) are kept.
# Asterisk plays any format it finds for a name, so menu.wav or menu.mp3 both count as present.
set -euo pipefail
VOICE="${VOICE:-/opt/piper-voices/en_GB-alan-low.onnx}"
PIPER="${PIPER:-/usr/local/bin/piper}"
OUT=/srv/voip/prerendered_audio
FORCE=0
ONLY=()
for a in "$@"; do
  if [ "$a" = "--force" ]; then FORCE=1; else ONLY+=("$a"); fi
done

fail() { echo "ERROR: $*" >&2; exit 1; }
[ "$(id -u)" -eq 0 ]           || fail "run with sudo"
[ -x "$PIPER" ]                || fail "piper not found at $PIPER (set PIPER=...)"
command -v ffmpeg >/dev/null   || fail "ffmpeg not installed (sudo apt install ffmpeg)"
[ -f "$VOICE" ]                || fail "voice model not found: $VOICE (set VOICE=...)"
[ -f "$VOICE.json" ]           || fail "missing $VOICE.json next to the model"
id asterisk >/dev/null 2>&1    || fail "no 'asterisk' user"
mkdir -p "$OUT" /srv/voip/answers /var/spool/asterisk/dialed-in

wanted() {
  [ ${#ONLY[@]} -eq 0 ] && return 0
  local n; for n in "${ONLY[@]}"; do [ "$n" = "$1" ] && return 0; done
  return 1
}

say() {
  wanted "$1" || return 0
  if [ $FORCE -eq 0 ] && compgen -G "$OUT/$1.*" >/dev/null; then
    echo "keep $1"
    return 0
  fi
  local raw; raw=$(mktemp --suffix=.wav)
  echo "$2" | "$PIPER" --model "$VOICE" --output_file "$raw" || fail "piper failed on '$1'"
  [ -s "$raw" ] || fail "piper produced an empty file for '$1'"
  rm -f "$OUT/$1".*
  ffmpeg -loglevel error -y -i "$raw" -ar 8000 -ac 1 -c:a pcm_s16le "$OUT/$1.tmp.wav" || fail "ffmpeg failed on '$1'"
  mv "$OUT/$1.tmp.wav" "$OUT/$1.wav"
  rm -f "$raw"
  echo "made $1"
}

# top menu: one option per service, see infra/asterisk/dialed-in.conf
say main-menu    "Dialed-In. Press 1 for CRO Tracker."
# cro tracker menu
say menu         "CRO Tracker. Press 1 for this week's deadlines. Press 2 for overdue Cork companies. Press 3 to ask a question. Press star to go back."
say ask          "Ask your question after the beep."
say one-moment   "One moment."
say sorry        "Sorry, I couldn't answer that right now. Try options 1 or 2."
say invalid      "Sorry, that's not an option."
say goodbye      "Goodbye."
# placeholders until options 1 and 2 are generated from the report, see docs/deployment/04-phone.md
say week         "Three clients have a filing due this week. Details coming soon."
say overdue-cork "Here are overdue Cork companies. Details coming soon."

chown -R asterisk:asterisk /srv/voip /var/spool/asterisk/dialed-in
echo "done: $(ls "$OUT" | wc -l) files in $OUT"
