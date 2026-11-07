from datetime import UTC, date, datetime, timedelta
from typing import Literal

from flask import Blueprint, Response, current_app, jsonify
from flask_jwt_extended import jwt_required
from pydantic import BaseModel, Field, model_validator

from corkathon_api.errors import AppError
from corkathon_api.features.filings.report import GRACE_DAYS
from corkathon_api.features.filings.routes import require_access
from corkathon_api.features.radar.prospects import CORK_CITY_KEYS, CORK_COUNTY_KEYS, LIMIT, Row
from corkathon_api.features.radar.service import RadarService
from corkathon_api.request_body import parse_json_body

radar_routes = Blueprint("radar", __name__, url_prefix="/api/radar")

STALE_DAYS = 7
LIVE = "status is Normal and there is no dissolved date"
OVERDUE = f"nard + {GRACE_DAYS} days is before today"


class AskBody(BaseModel):
    mode: Literal["clients", "prospects"]
    question: str | None = Field(default=None, min_length=1, max_length=300)
    preset: str | None = Field(default=None, max_length=64)

    @model_validator(mode="after")
    def one_of_question_or_preset(self) -> AskBody:
        if (self.question is None) == (self.preset is None):
            raise ValueError("send a question or a preset, not both")
        return self


# each stored question: which scan list it reads, the filter shown on the page, and the sentence
PRESETS: dict[str, dict[str, object]] = {
    "overdue_cork_hospitality": {
        "list": "hospitality",
        "filter": {
            "mode": "prospects",
            "overdue_only": True,
            "sector_prefixes": ["55", "56"],
            "area": "cork_county",
            "sort": "most_overdue",
            "limit": LIMIT,
        },
        "query": f"companies.csv where {LIVE}, {OVERDUE}, the NACE code (or principal object "
        f"code when NACE is blank) starts 55 or 56, and the Eircode routing key is one "
        f"of {sorted(CORK_COUNTY_KEYS)} or, with no Eircode, an address line reads "
        f"Cork or Co. Cork; most days overdue first",
        "noun": "Cork hospitality companies are overdue on their annual return",
        "none": "No Cork hospitality companies are overdue in today's register.",
    },
    "overdue_cork_city": {
        "list": "city",
        "filter": {
            "mode": "prospects",
            "overdue_only": True,
            "area": "cork_city",
            "sort": "most_overdue",
            "limit": LIMIT,
        },
        "query": f"companies.csv where {LIVE}, {OVERDUE}, and the Eircode routing key is "
        f"{' or '.join(sorted(CORK_CITY_KEYS))}; most days overdue first",
        "noun": "Cork city companies are overdue on their annual return",
        "none": "No Cork city companies are overdue in today's register.",
    },
    "clients_overdue": {
        "list": "clients_overdue",
        "filter": {"mode": "clients", "overdue_only": True, "sort": "most_overdue", "limit": LIMIT},
        "query": f"companies.csv where the company number is on your client list, {LIVE}, "
        f"and {OVERDUE}; most days overdue first",
        "noun": "of your clients are overdue",
        "none": "None of your clients are overdue.",
    },
    "clients_this_week": {
        "list": "clients_week",
        "filter": {
            "mode": "clients",
            "deadline_window_days": 7,
            "sort": "deadline_soonest",
            "limit": LIMIT,
        },
        "query": f"companies.csv where the company number is on your client list, {LIVE}, "
        f"and nard + {GRACE_DAYS} days falls in the next 7 days; soonest first",
        "noun": "of your clients have a filing deadline in the next 7 days",
        "none": "None of your clients have a filing deadline in the next 7 days.",
    },
}


def service() -> RadarService:
    radar: RadarService = current_app.extensions["radar"]
    return radar


def sentence(preset: dict[str, object], rows: list[Row]) -> str:
    if not rows:
        return str(preset["none"])
    first = rows[0]
    lead = f"{len(rows)} {preset['noun']}."
    if first["days_overdue"]:
        return f"{lead} Most overdue: {first['company_name']}, {first['days_overdue']} days late."
    return f"{lead} Soonest: {first['company_name']}, due {first['filing_deadline']}."


def snapshot_info(newest: date | None, today: date) -> dict[str, object]:
    filings = service().filings
    path = filings.snapshot_path(today)
    fetched = datetime.fromtimestamp(path.stat().st_mtime, UTC) if path.exists() else None
    newest_day = newest or today
    return {
        "fetched_at": fetched.isoformat() if fetched else "",
        "newest_reg_date": newest_day.isoformat(),
        "stale": newest_day < today - timedelta(days=STALE_DAYS),
    }


@radar_routes.post("/ask")
@jwt_required()
def ask() -> Response:
    require_access()
    body = parse_json_body(AskBody)
    if body.preset is None:
        raise AppError(
            "radar_llm_unavailable",
            "Typed questions are not available yet. Try one of the example questions.",
            503,
        )
    preset = PRESETS.get(body.preset)
    if preset is None:
        raise AppError("radar_question_invalid", "That example question does not exist.", 400)

    today = service().filings.today()
    scan = service().today_scan()
    rows: list[Row] = getattr(scan, str(preset["list"]))
    return jsonify(
        {
            "kind": "answer",
            "answer": sentence(preset, rows),
            "rows": rows[:LIMIT],
            "filter": preset["filter"],
            "sql": preset["query"],
            "params": [today.isoformat(), GRACE_DAYS],
            "row_count": len(rows),
            "snapshot": snapshot_info(scan.newest_reg_date, today),
        }
    )
