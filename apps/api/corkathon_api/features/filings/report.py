"""cro filing report, built inside the one deployed container"""

import csv
import io
import zipfile
from collections.abc import Iterable, Iterator, Mapping
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import TypedDict

# a return must reach the cro within 56 days of the annual return date
GRACE_DAYS = 56
STATUS_ORDER = {"overdue": 0, "due": 1, "ok": 2, "unknown": 3, "dissolved": 4, "not_found": 5}
ATTRIBUTION = (
    "Contains data from the Companies Registration Office (CRO), licensed under CC BY 4.0."
)
DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%dT%H:%M:%S",
    "%d/%m/%Y",
    "%d/%m/%Y %H:%M:%S",
    "%d-%m-%Y",
)
NUMBER_HEADERS = (
    "company_num",
    "company_number",
    "number",
    "company no",
    "cro number",
    "cro_number",
)


class Company(TypedDict):
    company_num: str
    company_name: str
    company_status: str
    company_type: str
    address: str
    last_ar_date: str | None
    nard: str | None
    deadline: str | None
    days_left: int | None
    status: str


class Report(TypedDict):
    generated_at: str
    as_of: str
    window_days: int
    grace_days: int
    counts: dict[str, int]
    companies: list[Company]
    source: str


def parse_date(value: str | None) -> date | None:
    text = (value or "").strip()
    if not text:
        return None
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text[:19], fmt).date()
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(text).date()
    except ValueError:
        return None


def norm_num(value: object) -> str:
    text = str(value).strip()
    text = text.removesuffix(".0")
    return text.lstrip("0") or "0"


def iso(day: date | None) -> str | None:
    return day.isoformat() if day else None


def classify(row: Mapping[str, str], today: date, window_days: int) -> Company:
    nard = parse_date(row.get("nard"))
    dissolved = parse_date(row.get("comp_dissolved_date"))
    deadline = nard + timedelta(days=GRACE_DAYS) if nard else None
    days_left = (deadline - today).days if deadline else None

    if dissolved:
        status = "dissolved"
    elif deadline is None or days_left is None:
        status = "unknown"
    elif days_left < 0:
        status = "overdue"
    elif days_left <= window_days:
        status = "due"
    else:
        status = "ok"

    lines = (row.get(f"company_address_{i}", "") or "" for i in range(1, 5))
    return {
        "company_num": norm_num(row.get("company_num", "")),
        "company_name": (row.get("company_name") or "").strip(),
        "company_status": (row.get("company_status") or "").strip(),
        "company_type": (row.get("company_type") or "").strip(),
        "address": ", ".join(line.strip() for line in lines if line.strip()),
        "last_ar_date": iso(parse_date(row.get("last_ar_date"))),
        "nard": iso(nard),
        "deadline": iso(deadline),
        "days_left": days_left,
        "status": status,
    }


def missing_company(num: str) -> Company:
    return {
        "company_num": num,
        "company_name": "",
        "company_status": "",
        "company_type": "",
        "address": "",
        "last_ar_date": None,
        "nard": None,
        "deadline": None,
        "days_left": None,
        "status": "not_found",
    }


def sort_key(company: Company) -> tuple[int, int, str]:
    # overdue: most overdue first, due and ok: soonest deadline first
    days = company["days_left"] if company["days_left"] is not None else 10**9
    return (STATUS_ORDER.get(company["status"], 9), days, company["company_name"].lower())


def build_report(
    rows: Iterable[Mapping[str, str]],
    wanted: set[str],
    today: date,
    window_days: int,
    generated_at: datetime,
) -> Report:
    found: dict[str, Company] = {}
    for row in rows:
        num = norm_num(row.get("company_num", ""))
        if num in wanted:
            found[num] = classify(row, today, window_days)

    companies = list(found.values())
    companies.extend(missing_company(num) for num in sorted(wanted - found.keys()))
    companies.sort(key=sort_key)

    counts = dict.fromkeys(STATUS_ORDER, 0)
    for company in companies:
        counts[company["status"]] += 1

    return {
        "generated_at": generated_at.isoformat(timespec="seconds"),
        "as_of": today.isoformat(),
        "window_days": window_days,
        "grace_days": GRACE_DAYS,
        "counts": counts,
        "companies": companies,
        "source": ATTRIBUTION,
    }


def long_date(iso_text: str) -> str:
    day = date.fromisoformat(iso_text)
    return f"{day.day} {day.strftime('%B %Y')}"


def spoken_name(company: Company) -> str:
    return company["company_name"] or f"Company {company['company_num']}"


def build_briefing(report: Report) -> str:
    due = [c for c in report["companies"] if c["status"] == "due"]
    overdue = [c for c in report["companies"] if c["status"] == "overdue"]
    window = report["window_days"]
    lines = [f"Filing briefing for {long_date(report['as_of'])}.", "", "Companies due to file"]

    if due:
        verb = "company is" if len(due) == 1 else "companies are"
        lines.append(f"{len(due)} {verb} due to file in the next {window} days.")
        for company in due:
            days = company["days_left"] or 0
            when = "today" if days == 0 else ("tomorrow" if days == 1 else f"in {days} days")
            deadline = long_date(company["deadline"] or report["as_of"])
            lines.append(
                f"{spoken_name(company)} must file its annual return by {deadline}, "
                f"which is {when}."
            )
    else:
        lines.append(f"No companies are due to file in the next {window} days.")

    lines += ["", "Overdue companies"]
    if overdue:
        verb = "company is" if len(overdue) == 1 else "companies are"
        lines.append(f"{len(overdue)} {verb} overdue.")
        for company in overdue:
            days = -(company["days_left"] or 0)
            unit = "day" if days == 1 else "days"
            deadline = long_date(company["deadline"] or report["as_of"])
            lines.append(
                f"{spoken_name(company)} missed its deadline of {deadline} "
                f"and is {days} {unit} overdue."
            )
    else:
        lines.append("No companies are overdue.")
    lines.append("")
    return "\n".join(lines)


def load_company_numbers(path: Path) -> set[str]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = [r for r in csv.reader(handle) if r and any(cell.strip() for cell in r)]
    if not rows:
        return set()
    header = [cell.strip().lower() for cell in rows[0]]
    column = next((header.index(name) for name in NUMBER_HEADERS if name in header), None)
    if column is None:
        column = 0
        data = rows if rows[0][0].strip().isdigit() else rows[1:]
    else:
        data = rows[1:]
    return {norm_num(r[column]) for r in data if len(r) > column and r[column].strip()}


def iter_snapshot_rows(path: Path) -> Iterator[dict[str, str]]:
    if zipfile.is_zipfile(path):
        with zipfile.ZipFile(path) as archive:
            name = next(n for n in archive.namelist() if n.lower().endswith(".csv"))
            with archive.open(name) as raw:
                text = io.TextIOWrapper(raw, encoding="utf-8-sig", errors="replace", newline="")
                yield from csv.DictReader(text)
    else:
        with path.open(encoding="utf-8-sig", errors="replace", newline="") as handle:
            yield from csv.DictReader(handle)
