"""stored radar questions answered from the cro snapshot, no ai anywhere in the path"""

import re
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import TypedDict

from corkathon_api.features.filings.report import GRACE_DAYS, norm_num, parse_date

# reported figures from public summaries, shown on the page as estimates only
PENALTY_BASE, PENALTY_PER_DAY, PENALTY_CAP = 100, 3, 1200
LIMIT = 10

CORK_CITY_KEYS = frozenset({"T12", "T23"})
# starting list from docs/design/03-data.md, still to verify against the eircode routing key map
CORK_COUNTY_KEYS = CORK_CITY_KEYS | frozenset(
    {
        "T34",
        "T45",
        "T56",
        "P12",
        "P14",
        "P17",
        "P24",
        "P25",
        "P31",
        "P32",
        "P36",
        "P43",
        "P47",
        "P51",
        "P56",
        "P61",
        "P67",
        "P72",
        "P75",
        "P81",
        "P85",
    }
)
ROUTING_KEY = re.compile(r"^([AC-FHKNPRTV-Y][0-9]{2}|D6W)")
CORK_COUNTY_LINE = re.compile(r"^(CO\.? ?|COUNTY )?CORK$")

SECTORS = {
    "41": "Construction",
    "42": "Construction",
    "43": "Construction",
    "47": "Retail trade",
    "55": "Accommodation",
    "56": "Food and beverage service",
    "62": "Computer programming",
    "68": "Real estate",
    "69": "Legal and accounting",
    "70": "Management consultancy",
    "85": "Education",
    "86": "Human health activities",
}


class Row(TypedDict):
    company_num: str
    company_name: str
    sector_label: str | None
    routing_key: str | None
    filing_deadline: str
    days_to_deadline: int
    days_overdue: int
    est_penalty_eur: int


@dataclass
class Scan:
    newest_reg_date: date | None = None
    hospitality: list[Row] = field(default_factory=list)
    city: list[Row] = field(default_factory=list)
    clients_overdue: list[Row] = field(default_factory=list)
    clients_week: list[Row] = field(default_factory=list)


def sector_code(row: Mapping[str, str]) -> str:
    raw = (row.get("nace_v2_code") or "").strip() or (row.get("princ_object_code") or "").strip()
    return re.sub(r"[^0-9]", "", raw)


def routing_key(row: Mapping[str, str]) -> str | None:
    eircode = (row.get("eircode") or "").replace(" ", "").upper()
    match = ROUTING_KEY.match(eircode)
    return match.group(1) if match else None


def address_names_cork_county(row: Mapping[str, str]) -> bool:
    # whole address parts only, so cork street in dublin 8 never counts
    for line in ("company_address_2", "company_address_3", "company_address_4"):
        for part in (row.get(line) or "").upper().split(","):
            if CORK_COUNTY_LINE.match(part.strip()):
                return True
    return False


def in_cork_county(row: Mapping[str, str]) -> bool:
    key = routing_key(row)
    return key in CORK_COUNTY_KEYS if key else address_names_cork_county(row)


def in_cork_city(row: Mapping[str, str]) -> bool:
    return routing_key(row) in CORK_CITY_KEYS


def to_row(row: Mapping[str, str], deadline: date, today: date) -> Row:
    days_to = (deadline - today).days
    overdue = max(0, -days_to)
    code = sector_code(row)
    return {
        "company_num": norm_num(row.get("company_num", "")),
        "company_name": (row.get("company_name") or "").strip(),
        "sector_label": SECTORS.get(code[:2]),
        "routing_key": routing_key(row),
        "filing_deadline": deadline.isoformat(),
        "days_to_deadline": days_to,
        "days_overdue": overdue,
        "est_penalty_eur": min(PENALTY_BASE + PENALTY_PER_DAY * overdue, PENALTY_CAP)
        if overdue
        else 0,
    }


def scan(rows: Iterable[Mapping[str, str]], clients: set[str], today: date) -> Scan:
    result = Scan()
    for row in rows:
        registered = parse_date(row.get("company_reg_date"))
        if registered and (result.newest_reg_date is None or registered > result.newest_reg_date):
            result.newest_reg_date = registered
        live = (row.get("company_status") or "").strip().lower() == "normal" and not (
            row.get("comp_dissolved_date") or ""
        ).strip()
        nard = parse_date(row.get("nard"))
        if not live or nard is None:
            continue
        deadline = nard + timedelta(days=GRACE_DAYS)
        days_to = (deadline - today).days
        is_client = norm_num(row.get("company_num", "")) in clients
        if days_to < 0:
            if sector_code(row)[:2] in ("55", "56") and in_cork_county(row):
                result.hospitality.append(to_row(row, deadline, today))
            if in_cork_city(row):
                result.city.append(to_row(row, deadline, today))
            if is_client:
                result.clients_overdue.append(to_row(row, deadline, today))
        elif is_client and days_to <= 7:
            result.clients_week.append(to_row(row, deadline, today))

    def most_overdue(r: Row) -> tuple[int, str]:
        return (-r["days_overdue"], r["company_name"])

    for group in (result.hospitality, result.city, result.clients_overdue):
        group.sort(key=most_overdue)
    result.clients_week.sort(key=lambda r: (r["days_to_deadline"], r["company_name"]))
    return result
