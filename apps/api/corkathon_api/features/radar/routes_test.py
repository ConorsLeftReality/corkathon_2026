import csv
import io
from collections.abc import Callable
from datetime import date
from pathlib import Path

import pytest
from flask import Flask
from flask.testing import FlaskClient

from conftest import csrf_headers, sign_up
from corkathon_api.features.radar.service import RadarService

AS_OF = date(2026, 11, 7)
FIELDS = [
    "company_num",
    "company_name",
    "company_status",
    "company_reg_date",
    "nard",
    "comp_dissolved_date",
    "nace_v2_code",
    "princ_object_code",
    "eircode",
    "company_address_2",
    "company_address_3",
    "company_address_4",
]
ROWS = [
    [
        "1",
        "QUAY CAFE LIMITED",
        "Normal ",
        "2019-01-01",
        "2026-06-01",
        "",
        "56.10",
        "",
        "T12AB12",
        "",
        "",
        "CORK",
    ],
    [
        "2",
        "KINSALE HOTEL LIMITED",
        "Normal ",
        "2019-01-01",
        "2025-10-01",
        "",
        "",
        "55.10",
        "",
        "",
        "KINSALE",
        "CO. CORK, IRELAND",
    ],
    [
        "3",
        "DUBLIN CAFE LIMITED",
        "Normal ",
        "2019-01-01",
        "2025-10-01",
        "",
        "56.10",
        "",
        "D02AB12",
        "",
        "",
        "DUBLIN 2",
    ],
    [
        "4",
        "CLIENT LATE LIMITED",
        "Normal ",
        "2019-01-01",
        "2026-08-01",
        "",
        "",
        "",
        "T23AB12",
        "",
        "",
        "CORK",
    ],
    [
        "5",
        "CLIENT SOON LIMITED",
        "Normal ",
        "2026-11-06",
        "2026-09-15",
        "",
        "",
        "",
        "",
        "",
        "",
        "GALWAY",
    ],
]


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    folder = tmp_path / "filings"
    folder.mkdir()
    text = io.StringIO()
    writer = csv.writer(text)
    writer.writerow(FIELDS)
    writer.writerows(ROWS)
    # a plain csv under the zip name, which iter_snapshot_rows reads as text
    (folder / f"cro_companies_{AS_OF.isoformat()}.csv.zip").write_text(
        text.getvalue(), encoding="utf-8"
    )
    (folder / "my_companies.csv").write_text("company_num\n4\n5\n", encoding="utf-8")
    return folder


def build(build_app: Callable[..., Flask], data_dir: Path, **extra: object) -> Flask:
    app = build_app(filings_data_dir=data_dir, filings_as_of=AS_OF, **extra)
    app.extensions["radar"] = RadarService(app.extensions["filings"], background=False)
    return app


@pytest.fixture
def signed_in(build_app: Callable[..., Flask], data_dir: Path) -> FlaskClient:
    client = build(build_app, data_dir).test_client()
    sign_up(client, "ada@example.com")
    return client


def ask(client: FlaskClient, body: dict[str, object]):  # type: ignore[no-untyped-def]
    return client.post("/api/radar/ask", json=body, headers=csrf_headers(client))


def names(response) -> list[str]:  # type: ignore[no-untyped-def]
    assert response.status_code == 200, response.json
    return [row["company_name"] for row in response.json["rows"]]


def test_asking_needs_a_session(build_app: Callable[..., Flask], data_dir: Path) -> None:
    client = build(build_app, data_dir).test_client()
    assert (
        client.post(
            "/api/radar/ask", json={"mode": "prospects", "preset": "overdue_cork_city"}
        ).status_code
        == 401
    )


def test_overdue_cork_hospitality_reads_the_register(signed_in: FlaskClient) -> None:
    response = ask(signed_in, {"mode": "prospects", "preset": "overdue_cork_hospitality"})
    assert names(response) == ["KINSALE HOTEL LIMITED", "QUAY CAFE LIMITED"]
    body = response.json
    assert body is not None
    assert body["row_count"] == 2
    assert body["answer"].startswith("2 Cork hospitality companies are overdue")
    assert "starts 55 or 56" in body["sql"]
    assert body["snapshot"]["newest_reg_date"] == "2026-11-06"


def test_overdue_cork_city_uses_the_city_routing_keys(signed_in: FlaskClient) -> None:
    response = ask(signed_in, {"mode": "prospects", "preset": "overdue_cork_city"})
    assert names(response) == ["QUAY CAFE LIMITED", "CLIENT LATE LIMITED"]


def test_client_questions_use_the_client_list(signed_in: FlaskClient) -> None:
    assert names(ask(signed_in, {"mode": "clients", "preset": "clients_overdue"})) == [
        "CLIENT LATE LIMITED"
    ]
    assert names(ask(signed_in, {"mode": "clients", "preset": "clients_this_week"})) == [
        "CLIENT SOON LIMITED"
    ]


def test_typed_questions_say_they_are_not_available_yet(signed_in: FlaskClient) -> None:
    response = ask(signed_in, {"mode": "prospects", "question": "overdue cork cafes"})
    assert response.status_code == 503
    assert response.json is not None
    assert response.json["error"]["code"] == "radar_llm_unavailable"


@pytest.mark.parametrize("preset", ["not_a_preset", "toString", "__proto__"])
def test_unknown_presets_are_refused(signed_in: FlaskClient, preset: str) -> None:
    response = ask(signed_in, {"mode": "prospects", "preset": preset})
    assert response.status_code == 400
    assert response.json is not None
    assert response.json["error"]["code"] == "radar_question_invalid"


def test_a_question_and_a_preset_together_is_refused(signed_in: FlaskClient) -> None:
    response = ask(signed_in, {"mode": "prospects", "question": "x", "preset": "overdue_cork_city"})
    assert response.status_code == 422


def test_an_account_off_the_allowlist_cannot_ask(
    build_app: Callable[..., Flask], data_dir: Path
) -> None:
    client = build(build_app, data_dir, filings_allowed_emails="someone@example.com").test_client()
    sign_up(client, "stranger@example.com")
    response = ask(client, {"mode": "prospects", "preset": "overdue_cork_city"})
    assert response.status_code == 403


def test_the_first_ask_of_the_day_prepares_in_the_background(
    build_app: Callable[..., Flask], data_dir: Path
) -> None:
    app = build_app(filings_data_dir=data_dir, filings_as_of=AS_OF)
    client = app.test_client()
    sign_up(client, "ada@example.com")
    response = ask(client, {"mode": "prospects", "preset": "overdue_cork_city"})
    assert response.status_code == 503
    assert response.json is not None
    assert response.json["error"]["code"] == "radar_building"
