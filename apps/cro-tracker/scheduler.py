"""
Daily job runner for the CRO filing tracker.

Runs app.build_reports() (every client) once on start-up, then every day at RUN_AT (local time,
set by the TZ environment variable, e.g. TZ=Europe/Dublin).
Retries a few times if the CRO download fails, and deletes old snapshots so the
disk doesn't fill up.

  python scheduler.py          # run forever (used by the Docker "job" service)
  python scheduler.py --once   # run the job once and exit (used by Dokku cron / systemd)
"""

import glob
import os
import sys
import time
import traceback
from datetime import datetime, timedelta

import app

RUN_AT = os.environ.get("RUN_AT", "00:05")             # HH:MM, local time
RETRIES = int(os.environ.get("RETRIES", "3"))
RETRY_WAIT_SECONDS = int(os.environ.get("RETRY_WAIT_SECONDS", "600"))
KEEP_SNAPSHOTS = int(os.environ.get("KEEP_SNAPSHOTS", "2"))


def log(msg):
    print(f"[{datetime.now().isoformat(timespec='seconds')}] {msg}", flush=True)


def clean_old_snapshots():
    files = sorted(glob.glob(os.path.join(app.DATA_DIR, "cro_companies_*.csv.zip")))
    for path in files[:-KEEP_SNAPSHOTS] if KEEP_SNAPSHOTS > 0 else files:
        os.remove(path)
        log(f"Deleted old snapshot {path}")
    for path in glob.glob(os.path.join(app.DATA_DIR, "*.part")):
        os.remove(path)


def run_job():
    for attempt in range(1, RETRIES + 1):
        try:
            reports = app.build_reports()
            for client, report in reports.items():
                c = report["counts"]
                log(f"{client}: report built for {report['as_of']}: overdue={c['overdue']} due={c['due']} "
                    f"ok={c['ok']} not_found={c['not_found']}")
            clean_old_snapshots()
            return True
        except Exception:
            log(f"Attempt {attempt}/{RETRIES} failed:\n{traceback.format_exc()}")
            if attempt < RETRIES:
                time.sleep(RETRY_WAIT_SECONDS)
    log("All attempts failed; will try again at the next scheduled time.")
    return False


def seconds_until_next_run(now=None):
    now = now or datetime.now()
    hh, mm = (int(x) for x in RUN_AT.split(":"))
    target = now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


def main():
    if "--once" in sys.argv:
        sys.exit(0 if run_job() else 1)
    log(f"Scheduler started; daily run at {RUN_AT} ({os.environ.get('TZ', 'system time zone')})")
    run_job()
    while True:
        wait = seconds_until_next_run()
        log(f"Next run in {wait / 3600:.1f} hours")
        time.sleep(wait)
        run_job()


if __name__ == "__main__":
    main()
