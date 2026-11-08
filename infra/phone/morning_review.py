#!/usr/bin/env python3
"""
Dialed-In CRO Tracker - morning review call.

Fetches a client's report from cro-tracker, turns it into a short spoken
review (overdue first, then what's due), renders it with piper, and rings a
PJSIP extension with call_extension.py to play it.

    sudo python3 /opt/dialed-in/morning_review.py --endpoint 1001
    sudo python3 /opt/dialed-in/morning_review.py --endpoint 1001 --client acme
    sudo python3 /opt/dialed-in/morning_review.py --dry-run      # print + render + save, no call

Rendered reviews are saved in <TTS_CACHE>/morning/, keyed by their exact text.
If today's review is already there (e.g. a --dry-run at 06:30 rendered it), the
call starts straight away with no piper wait. Files older than 7 days are deleted.

Reuses /opt/dialed-in/transcribe_audio.py for its settings (.env: REPORT_URL,
DEFAULT_CLIENT, PIPER, PIPER_VOICE) and its speech helpers, so the wording
matches phone option 3. Piper is slow on the Pi (about a minute), which is fine
here because it runs before the call is placed.
"""
import argparse
import datetime
import os
import subprocess
import sys
import time

sys.path.insert(0, "/opt/dialed-in")
import transcribe_audio as t  # noqa: E402

CALL_SCRIPT = "/opt/dialed-in/call_extension.py"
MAX_LISTED = 8              # companies read out per section before "and N more"
PIPER_TIMEOUT_S = 600
KEEP_DAYS = 7


def log(msg):
    print(f"[{datetime.datetime.now():%H:%M:%S}] {msg}", flush=True)


def saved_review(cfg, text):
    """Path of the saved WAV for this exact text, rendering it with piper if needed."""
    folder = os.path.join(cfg["TTS_CACHE"], "morning")
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, os.path.basename(t.cache_file(cfg, text)))
    if os.path.exists(path):
        log(f"already rendered: {path}")
        return path
    log("rendering with piper (about a minute on the Pi)...")
    tmp = path + ".part.wav"
    try:
        t.tts_piper(cfg, text, tmp, timeout=PIPER_TIMEOUT_S)
        os.chmod(tmp, 0o644)
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)
    log(f"saved: {path}")
    # tidy up old reviews
    cutoff = time.time() - KEEP_DAYS * 86400
    for name in os.listdir(folder):
        p = os.path.join(folder, name)
        if name.endswith(".wav") and os.path.getmtime(p) < cutoff:
            os.remove(p)
    return path


def build_review(client, companies, today):
    overdue = sorted((c for c in companies if c["status"] == "overdue"),
                     key=lambda c: c["days_left"] if c["days_left"] is not None else 0)
    due = sorted((c for c in companies if c["status"] == "due"),
                 key=lambda c: c["days_left"] if c["days_left"] is not None else 10 ** 6)

    who = t.speak_name(client.replace("_", " ").replace("-", " "))
    parts = [f"Good morning. Here is the filing review for {who}, for {t.date_words(today, today)}.",
             f"You're tracking {t.plural(len(companies), 'company').replace('companys', 'companies')}: "
             f"{len(overdue)} overdue and {len(due)} due in the next few weeks."]

    for label, group in (("overdue", overdue), ("due soon", due)):
        if not group:
            continue
        parts.append(f"{'Overdue' if label == 'overdue' else 'Due soon'}:")
        parts.extend(t.company_sentence(c, today) for c in group[:MAX_LISTED])
        if len(group) > MAX_LISTED:
            parts.append(f"And {len(group) - MAX_LISTED} more {label}. Check the dashboard for the full list.")

    if not overdue and not due:
        parts.append("Nothing is overdue and nothing is due soon. Have a good day.")
    else:
        parts.append("That's the review. Have a good day.")
    return t.numbers_to_words(" ".join(parts))


def main():
    ap = argparse.ArgumentParser(description="Phone a morning filing review to an extension.")
    ap.add_argument("--endpoint", help="PJSIP extension to call, e.g. 1001 (required unless --dry-run)")
    ap.add_argument("--client", help="client id (default: DEFAULT_CLIENT in /opt/dialed-in/.env)")
    ap.add_argument("--call-script", default=CALL_SCRIPT, help=f"default: {CALL_SCRIPT}")
    ap.add_argument("--dry-run", action="store_true", help="print the text and render + save the audio, but don't call")
    args = ap.parse_args()

    if not args.dry_run and not args.endpoint:
        ap.error("--endpoint is required (or use --dry-run)")
    if os.geteuid() != 0:
        sys.exit("Run with sudo (it saves audio in the Asterisk spool and places calls).")

    cfg = t.load_env()
    client = (args.client or cfg["DEFAULT_CLIENT"]).lower()
    today = datetime.date.today()

    source = t.report_source(cfg, client)
    log(f"report: {source}")
    companies = t.load_companies(source, int(cfg["WINDOW_DAYS"]), today, timeout=t.PREGEN_REPORT_TIMEOUT_S)
    text = build_review(client, companies, today)
    log(f"text: {text}")

    wav = saved_review(cfg, text)
    if args.dry_run:
        log(f"dry run, no call. Listen with: aplay {wav}")
        return 0

    log(f"calling {args.endpoint}...")
    # call_extension.py converts its own copy, places the call and waits for the result
    return subprocess.run([sys.executable, args.call_script, wav, args.endpoint]).returncode


if __name__ == "__main__":
    sys.exit(main())
