import csv
import io
import zipfile
from collections.abc import Callable
from datetime import date
from pathlib import Path

import pytest
from flask import Flask
from flask.testing import FlaskClient

from conftest import csrf_headers, sign_up
from corkathon_api.features.filings.service import FilingsService

AS_OF = date(2026, 11, 7)
ROUTES = ["/api/report", "/api/companies", "/api/briefing"]

SNAPSHOT = [
    # the demo list: ryanair due, crh ok, kerry overdue, 999999999 missing
    {"company_num": "104547", "company_name": "RYANAIR DAC", "nard": "2026-09-20"},
    {"company_num": "12965", "company_name": "CRH PLC", "nard": "2027-01-01"},
    {"company_num": "111471", "company_name": "KERRY GROUP PLC", "nard": "2026-09-01"},
    {"company_num": "500", "company_name": "NOT A CLIENT LTD", "nard": "2026-01-01"},
]


def write_snapshot(folder: Path) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    text = io.StringIO()
    writer = csv.DictWriter(text, fieldnames=["company_num", "company_name", "nard"])
    writer.writeheader()
    writer.writerows(SNAPSHOT)
    with zipfile.ZipFile(folder / f"cro_companies_{AS_OF.isoformat()}.csv.zip", "w") as archive:
        archive.writestr("companies.csv", text.getvalue())


@pytest.fixture
def data_dir(tmp_path: Path) -> Path:
    folder = tmp_path / "filings"
    write_snapshot(folder)
    return folder


@pytest.fixture
def filings_app(build_app: Callable[..., Flask], data_dir: Path) -> Flask:
    return build_app(filings_data_dir=data_dir, filings_as_of=AS_OF)


@pytest.fixture
def signed_in(filings_app: Flask) -> FlaskClient:
    client = filings_app.test_client()
    sign_up(client, "ada@example.com")
    return client


@pytest.mark.parametrize("path", ROUTES)
def test_filings_need_a_session(filings_app: Flask, path: str) -> None:
    assert filings_app.test_client().get(path).status_code == 401


def test_refresh_needs_a_session(filings_app: Flask) -> None:
    assert filings_app.test_client().post("/api/refresh").status_code == 401


def test_the_report_uses_the_demo_list_until_a_client_list_exists(signed_in: FlaskClient) -> None:
    response = signed_in.get("/api/report")
    assert response.status_code == 200
    report = response.json
    assert report is not None
    assert report["as_of"] == "2026-11-07"
    statuses = {c["company_num"]: c["status"] for c in report["companies"]}
    assert statuses == {
        "104547": "due",
        "12965": "ok",
        "111471": "overdue",
        "999999999": "not_found",
    }
    assert report["companies"][0]["company_name"] == "KERRY GROUP PLC"


def test_my_companies_csv_replaces_the_demo_list(signed_in: FlaskClient, data_dir: Path) -> None:
    (data_dir / "my_companies.csv").write_text("company_num\n500\n", encoding="utf-8")
    response = signed_in.post("/api/refresh", headers=csrf_headers(signed_in))
    assert response.status_code == 200
    assert response.json is not None
    assert [c["company_name"] for c in response.json["companies"]] == ["NOT A CLIENT LTD"]


def test_status_filters_the_list(signed_in: FlaskClient) -> None:
    response = signed_in.get("/api/companies?status=overdue,due")
    assert response.json is not None
    assert [c["status"] for c in response.json] == ["overdue", "due"]


def test_the_briefing_is_plain_text(signed_in: FlaskClient) -> None:
    response = signed_in.get("/api/briefing")
    assert response.status_code == 200
    assert response.mimetype == "text/plain"
    assert response.get_data(as_text=True).startswith("Filing briefing for 7 November 2026.")


def test_refresh_needs_the_csrf_header(signed_in: FlaskClient) -> None:
    assert signed_in.post("/api/refresh").status_code == 401


def test_a_missing_snapshot_downloads_in_the_background(filings_app: Flask, tmp_path: Path) -> None:
    fetched: list[Path] = []
    filings_app.extensions["filings"] = FilingsService(
        tmp_path / "empty", 30, today=lambda: AS_OF, download=fetched.append
    )
    client = filings_app.test_client()
    sign_up(client, "ada@example.com")
    response = client.get("/api/report")
    assert response.status_code == 503
    assert response.json is not None
    assert response.json["error"]["code"] == "filings_building"


@pytest.fixture
def allowlisted_app(build_app: Callable[..., Flask], data_dir: Path) -> Flask:
    return build_app(
        filings_data_dir=data_dir,
        filings_as_of=AS_OF,
        filings_allowed_emails="Ada@Example.com, grace@example.com",
    )


@pytest.mark.parametrize("path", ROUTES)
def test_an_account_on_the_allowlist_reads_the_report(allowlisted_app: Flask, path: str) -> None:
    client = allowlisted_app.test_client()
    sign_up(client, "ada@example.com")
    assert client.get(path).status_code == 200


@pytest.mark.parametrize("path", ROUTES)
def test_an_account_off_the_allowlist_is_refused(allowlisted_app: Flask, path: str) -> None:
    client = allowlisted_app.test_client()
    sign_up(client, "stranger@example.com")
    response = client.get(path)
    assert response.status_code == 403
    assert response.json is not None
    assert response.json["error"]["code"] == "filings_forbidden"


def test_an_account_off_the_allowlist_cannot_rebuild(allowlisted_app: Flask) -> None:
    client = allowlisted_app.test_client()
    sign_up(client, "stranger@example.com")
    assert client.post("/api/refresh", headers=csrf_headers(client)).status_code == 403
