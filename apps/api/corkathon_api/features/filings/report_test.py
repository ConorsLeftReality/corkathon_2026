import io
import zipfile
from datetime import date, datetime
from pathlib import Path

from corkathon_api.features.filings.report import (
    build_briefing,
    build_report,
    classify,
    iter_snapshot_rows,
    load_company_numbers,
    norm_num,
    parse_date,
)

TODAY = date(2026, 11, 7)
NOW = datetime(2026, 11, 7, 9, 12)


def row(num: str, name: str, nard: str = "", dissolved: str = "") -> dict[str, str]:
    return {
        "company_num": num,
        "company_name": name,
        "company_status": "Normal",
        "company_type": "LTD",
        "company_address_1": "1 Quay Street",
        "company_address_2": "Cork",
        "nard": nard,
        "comp_dissolved_date": dissolved,
        "last_ar_date": "2025-09-01",
    }


def test_parse_date_reads_the_formats_the_cro_file_uses() -> None:
    assert parse_date("2026-03-31") == date(2026, 3, 31)
    assert parse_date("2026-03-31 00:00:00") == date(2026, 3, 31)
    assert parse_date("31/03/2026") == date(2026, 3, 31)
    assert parse_date("") is None
    assert parse_date("not a date") is None


def test_norm_num_matches_numbers_written_differently() -> None:
    assert norm_num("012345") == norm_num("12345") == norm_num("12345.0") == "12345"


def test_a_passed_deadline_is_overdue() -> None:
    # deadline is nard plus 56 days, 2026-09-01 + 56 = 2026-10-27, 11 days before today
    company = classify(row("1", "Late Ltd", nard="2026-09-01"), TODAY, 30)
    assert company["status"] == "overdue"
    assert company["deadline"] == "2026-10-27"
    assert company["days_left"] == -11
    assert company["address"] == "1 Quay Street, Cork"


def test_a_deadline_inside_the_window_is_due_and_outside_is_ok() -> None:
    assert classify(row("1", "Soon", nard="2026-09-20"), TODAY, 30)["status"] == "due"
    assert classify(row("2", "Later", nard="2026-12-01"), TODAY, 30)["status"] == "ok"


def test_no_return_date_is_unknown_and_a_dissolved_date_wins() -> None:
    assert classify(row("1", "Blank"), TODAY, 30)["status"] == "unknown"
    gone = row("2", "Gone", nard="2026-01-01", dissolved="2026-02-01")
    assert classify(gone, TODAY, 30)["status"] == "dissolved"


def test_the_report_sorts_most_urgent_first_and_lists_missing_numbers() -> None:
    rows = [
        row("1", "Fine", nard="2027-01-01"),
        row("2", "Very late", nard="2026-06-01"),
        row("3", "A bit late", nard="2026-09-01"),
        row("4", "Not mine", nard="2026-01-01"),
    ]
    report = build_report(rows, {"1", "2", "3", "99"}, TODAY, 30, NOW)
    assert [c["company_num"] for c in report["companies"]] == ["2", "3", "1", "99"]
    assert report["companies"][-1]["status"] == "not_found"
    assert report["counts"]["overdue"] == 2
    assert report["counts"]["not_found"] == 1
    assert report["as_of"] == "2026-11-07"
    assert report["generated_at"] == "2026-11-07T09:12:00"


def test_the_briefing_reads_out_due_and_overdue_companies() -> None:
    rows = [row("1", "Soon Ltd", nard="2026-09-20"), row("2", "Late Ltd", nard="2026-09-01")]
    text = build_briefing(build_report(rows, {"1", "2"}, TODAY, 30, NOW))
    assert text.startswith("Filing briefing for 7 November 2026.")
    assert "Soon Ltd must file its annual return by 15 November 2026, which is in 8 days." in text
    assert "Late Ltd missed its deadline of 27 October 2026 and is 11 days overdue." in text


def test_the_client_list_reads_a_company_num_column(tmp_path: Path) -> None:
    path = tmp_path / "clients.csv"
    path.write_text("company_num,notes\n012345,Acme\n678,Other\n", encoding="utf-8")
    assert load_company_numbers(path) == {"12345", "678"}


def test_the_client_list_falls_back_to_the_first_column(tmp_path: Path) -> None:
    path = tmp_path / "clients.csv"
    path.write_text("12345\n678\n", encoding="utf-8")
    assert load_company_numbers(path) == {"12345", "678"}


def test_snapshot_rows_come_out_of_a_zip(tmp_path: Path) -> None:
    buffer = io.StringIO("company_num,company_name\n1,One\n")
    path = tmp_path / "snapshot.csv.zip"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("companies.csv", buffer.getvalue())
    assert list(iter_snapshot_rows(path)) == [{"company_num": "1", "company_name": "One"}]
