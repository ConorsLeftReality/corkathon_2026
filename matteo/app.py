"""
CRO filing tracker: Flask API

What it does (once per day):
  1. Downloads the CRO's daily company snapshot (opendata.cro.ie, CC BY 4.0).
  2. Loads YOUR CSV of company numbers and keeps only those companies.
  3. Classifies each one:
       overdue -> deadline (NARD + 56 days) has passed
       due     -> deadline falls within the next WINDOW_DAYS days
       ok      -> deadline is further out
       unknown -> no NARD in the snapshot
       dissolved -> company has a dissolved date
  4. Sorts them (most overdue first, then soonest due).
  5. Writes report.json (for the dashboard) and briefing.txt (for ElevenLabs).
  6. Serves it all over HTTP so the TypeScript site can fetch it.

Usage:
  pip install flask
  python app.py run                  # do the daily job once and print the table
  python app.py serve                # start the API on http://localhost:5000
  python app.py run --snapshot companies.csv.zip   # use a file you already downloaded

Your company list CSV (default: my_companies.csv) needs a column called
company_num (or company_number / number). If there's no such header, the first
column is used. Extra columns are ignored.
"""

import argparse
import csv
import io
import json
import os
import urllib.request
import zipfile
from datetime import date, datetime, timedelta

from flask import Flask, Response, jsonify, request

# ---------------------------------------------------------------------------
# Settings (override with environment variables if you like)
# ---------------------------------------------------------------------------
MY_COMPANIES_CSV = os.environ.get("MY_COMPANIES_CSV", "my_companies.csv")
DATA_DIR = os.environ.get("DATA_DIR", "data")
REPORT_JSON = os.environ.get("REPORT_JSON", "report.json")
BRIEFING_TXT = os.environ.get("BRIEFING_TXT", "briefing.txt")
WINDOW_DAYS = int(os.environ.get("WINDOW_DAYS", "30"))   # "due soon" window
GRACE_DAYS = 56                                          # return must reach CRO within 56 days of the ARD
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "")    # empty sends no CORS header; the web app calls through the Vite proxy
HOST = os.environ.get("HOST", "127.0.0.1")              # 0.0.0.0 only if another device must reach it

CRO_SNAPSHOT_URL = (
    "https://opendata.cro.ie/dataset/bf6f837d-0946-4c14-9a99-82cd6980c121/"
    "resource/3fef41bc-b8f4-4b10-8434-ce51c29b1bba/download/companies.csv.zip"
)
ATTRIBUTION = "Contains data from the Companies Registration Office (CRO), licensed under CC BY 4.0."


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def parse_date(value):
    """CRO timestamps can look like '2025-03-31', '2025-03-31 00:00:00',
    '2025-03-31T00:00:00' or '31/03/2025'. Returns a date or None."""
    if not value:
        return None
    value = value.strip()
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S",
                "%d/%m/%Y", "%d/%m/%Y %H:%M:%S", "%d-%m-%Y"):
        try:
            return datetime.strptime(value[:19], fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(value).date()
    except ValueError:
        return None


def norm_num(value):
    """Normalise a company number so '012345', '12345' and '12345.0' all match."""
    value = str(value).strip()
    if value.endswith(".0"):
        value = value[:-2]
    return value.lstrip("0") or "0"


def iso(d):
    return d.isoformat() if d else None


# ---------------------------------------------------------------------------
# Step 1: get today's CRO snapshot
# ---------------------------------------------------------------------------
def download_snapshot(today):
    """Download the snapshot once per day and cache it in DATA_DIR."""
    os.makedirs(DATA_DIR, exist_ok=True)
    path = os.path.join(DATA_DIR, f"cro_companies_{today.isoformat()}.csv.zip")
    if os.path.exists(path) and os.path.getsize(path) > 0:
        return path
    print(f"Downloading CRO snapshot -> {path}")
    req = urllib.request.Request(CRO_SNAPSHOT_URL, headers={"User-Agent": "cro-filing-tracker/1.0"})
    tmp = path + ".part"
    with urllib.request.urlopen(req, timeout=300) as resp, open(tmp, "wb") as out:
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
    os.replace(tmp, path)
    return path


def iter_snapshot_rows(path):
    """Yield rows from the snapshot, whether it's a .zip or a plain .csv."""
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as zf:
            name = next(n for n in zf.namelist() if n.lower().endswith(".csv"))
            with zf.open(name) as raw:
                text = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline="")
                yield from csv.DictReader(text)
    else:
        with open(path, encoding="utf-8-sig", errors="replace", newline="") as f:
            yield from csv.DictReader(f)


# ---------------------------------------------------------------------------
# Step 2: load our list of company numbers
# ---------------------------------------------------------------------------
def load_my_companies(path):
    if not os.path.exists(path):
        raise FileNotFoundError(f"Company list not found: {path}")
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        rows = [r for r in reader if r and any(c.strip() for c in r)]
    if not rows:
        return set()
    header = [h.strip().lower() for h in rows[0]]
    col = None
    for candidate in ("company_num", "company_number", "number", "company no", "cro number", "cro_number"):
        if candidate in header:
            col = header.index(candidate)
            break
    if col is None:
        # No recognised header: use the first column, and treat row 0 as data if it's numeric
        col = 0
        data = rows if rows[0][0].strip().isdigit() else rows[1:]
    else:
        data = rows[1:]
    return {norm_num(r[col]) for r in data if len(r) > col and r[col].strip()}


# ---------------------------------------------------------------------------
# Step 3: classify
# ---------------------------------------------------------------------------
def classify(row, today, window_days=WINDOW_DAYS):
    nard = parse_date(row.get("nard"))
    dissolved = parse_date(row.get("comp_dissolved_date"))
    deadline = nard + timedelta(days=GRACE_DAYS) if nard else None
    days_left = (deadline - today).days if deadline else None

    if dissolved:
        status = "dissolved"
    elif deadline is None:
        status = "unknown"
    elif days_left < 0:
        status = "overdue"
    elif days_left <= window_days:
        status = "due"
    else:
        status = "ok"

    address = ", ".join(
        p.strip() for p in (row.get(f"company_address_{i}", "") for i in range(1, 5)) if p and p.strip()
    )
    return {
        "company_num": norm_num(row.get("company_num", "")),
        "company_name": (row.get("company_name") or "").strip(),
        "company_status": (row.get("company_status") or "").strip(),
        "company_type": (row.get("company_type") or "").strip(),
        "address": address,
        "last_ar_date": iso(parse_date(row.get("last_ar_date"))),
        "nard": iso(nard),
        "deadline": iso(deadline),
        "days_left": days_left,             # negative = days overdue
        "status": status,
    }


STATUS_ORDER = {"overdue": 0, "due": 1, "ok": 2, "unknown": 3, "dissolved": 4, "not_found": 5}


def sort_key(c):
    # overdue: most overdue first; due/ok: soonest deadline first
    dl = c["days_left"] if c["days_left"] is not None else 10**9
    return (STATUS_ORDER.get(c["status"], 9), dl, c["company_name"].lower())


# ---------------------------------------------------------------------------
# Steps 4-5: build report.json and briefing.txt
# ---------------------------------------------------------------------------
def build_report(snapshot_path=None, today=None, window_days=WINDOW_DAYS):
    today = today or date.today()
    wanted = load_my_companies(MY_COMPANIES_CSV)
    snapshot_path = snapshot_path or download_snapshot(today)

    found = {}
    for row in iter_snapshot_rows(snapshot_path):
        num = norm_num(row.get("company_num", ""))
        if num in wanted:
            found[num] = classify(row, today, window_days)

    companies = list(found.values())
    for num in sorted(wanted - found.keys()):
        companies.append({
            "company_num": num, "company_name": "", "company_status": "", "company_type": "",
            "address": "", "last_ar_date": None, "nard": None, "deadline": None,
            "days_left": None, "status": "not_found",
        })
    companies.sort(key=sort_key)

    counts = {s: 0 for s in STATUS_ORDER}
    for c in companies:
        counts[c["status"]] += 1

    report = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "as_of": today.isoformat(),
        "window_days": window_days,
        "grace_days": GRACE_DAYS,
        "counts": counts,
        "companies": companies,
        "source": ATTRIBUTION,
    }
    with open(REPORT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    with open(BRIEFING_TXT, "w", encoding="utf-8") as f:
        f.write(build_briefing(report))
    return report


def fmt_long_date(iso_str):
    d = date.fromisoformat(iso_str)
    return f"{d.day} {d.strftime('%B %Y')}"


def build_briefing(report):
    """Plain sentences, easy for text-to-speech to read aloud."""
    due = [c for c in report["companies"] if c["status"] == "due"]
    overdue = [c for c in report["companies"] if c["status"] == "overdue"]
    lines = [f"Filing briefing for {fmt_long_date(report['as_of'])}.", ""]

    lines.append("Companies due to file")
    if due:
        lines.append(f"{len(due)} {'company is' if len(due) == 1 else 'companies are'} due to file "
                     f"in the next {report['window_days']} days.")
        for c in due:
            n = c["days_left"]
            when = "today" if n == 0 else ("tomorrow" if n == 1 else f"in {n} days")
            lines.append(f"{c['company_name'] or 'Company ' + c['company_num']} must file its annual return "
                         f"by {fmt_long_date(c['deadline'])}, which is {when}.")
    else:
        lines.append(f"No companies are due to file in the next {report['window_days']} days.")
    lines.append("")

    lines.append("Overdue companies")
    if overdue:
        lines.append(f"{len(overdue)} {'company is' if len(overdue) == 1 else 'companies are'} overdue.")
        for c in overdue:
            n = -c["days_left"]
            lines.append(f"{c['company_name'] or 'Company ' + c['company_num']} missed its deadline of "
                         f"{fmt_long_date(c['deadline'])} and is {n} {'day' if n == 1 else 'days'} overdue.")
    else:
        lines.append("No companies are overdue.")
    lines.append("")
    return "\n".join(lines)


def print_table(report):
    """'Show it': a quick table in the terminal."""
    cols = [("status", 10), ("company_num", 9), ("company_name", 38), ("nard", 11), ("deadline", 11), ("days_left", 9)]
    print(f"\nCRO filing report, as of {report['as_of']} (window {report['window_days']} days)")
    print("  ".join(name.upper().ljust(w) for name, w in cols))
    print("  ".join("-" * w for _, w in cols))
    for c in report["companies"]:
        print("  ".join(str(c[name] if c[name] is not None else "")[:w].ljust(w) for name, w in cols))
    print("\nTotals:", ", ".join(f"{k}={v}" for k, v in report["counts"].items() if v))


# ---------------------------------------------------------------------------
# Flask API (what Evan's TypeScript site calls)
# ---------------------------------------------------------------------------
app = Flask(__name__)


@app.after_request
def add_cors(resp):
    if not ALLOWED_ORIGIN:
        return resp
    resp.headers["Access-Control-Allow-Origin"] = ALLOWED_ORIGIN
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return resp


def current_report():
    """Return today's report, rebuilding it if it's missing or from a previous day."""
    today = date.today().isoformat()
    if os.path.exists(REPORT_JSON):
        with open(REPORT_JSON, encoding="utf-8") as f:
            report = json.load(f)
        if report.get("as_of") == today:
            return report
    return build_report()


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/report")
def api_report():
    """Full report. Optional ?status=due,overdue to filter companies."""
    report = current_report()
    wanted = request.args.get("status")
    if wanted:
        keep = {s.strip() for s in wanted.split(",")}
        report = {**report, "companies": [c for c in report["companies"] if c["status"] in keep]}
    return jsonify(report)


@app.get("/api/companies")
def api_companies():
    """Just the sorted company list. Optional ?status=overdue"""
    companies = current_report()["companies"]
    wanted = request.args.get("status")
    if wanted:
        keep = {s.strip() for s in wanted.split(",")}
        companies = [c for c in companies if c["status"] in keep]
    return jsonify(companies)


@app.get("/api/briefing")
def api_briefing():
    current_report()  # makes sure briefing.txt is today's
    with open(BRIEFING_TXT, encoding="utf-8") as f:
        return Response(f.read(), mimetype="text/plain; charset=utf-8")


@app.post("/api/refresh")
def api_refresh():
    """Force a rebuild (e.g. after editing my_companies.csv)."""
    return jsonify(build_report())


@app.errorhandler(Exception)
def handle_error(e):
    return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Command line
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CRO filing tracker")
    parser.add_argument("command", nargs="?", default="serve", choices=["run", "serve"])
    parser.add_argument("--snapshot", help="use a local CRO snapshot (.zip or .csv) instead of downloading")
    parser.add_argument("--window", type=int, default=WINDOW_DAYS, help="days ahead that count as 'due'")
    parser.add_argument("--port", type=int, default=int(os.environ.get("PORT", "5000")))
    args = parser.parse_args()

    if args.command == "run":
        rep = build_report(snapshot_path=args.snapshot, window_days=args.window)
        print_table(rep)
        print(f"\nWrote {REPORT_JSON} and {BRIEFING_TXT}")
    else:
        if args.snapshot:
            print_table(build_report(snapshot_path=args.snapshot, window_days=args.window))
        app.run(host=HOST, port=args.port, debug=False)
