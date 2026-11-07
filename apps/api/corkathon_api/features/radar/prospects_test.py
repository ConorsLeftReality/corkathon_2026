from datetime import date

from corkathon_api.features.radar.prospects import (
    address_names_cork_county,
    in_cork_county,
    routing_key,
    scan,
    sector_code,
)

TODAY = date(2026, 11, 7)


def row(num: str, name: str, **fields: str) -> dict[str, str]:
    base = {
        "company_num": num,
        "company_name": name,
        "company_status": "Normal ",
        "company_reg_date": "2020-01-01",
        "nard": "2026-06-01",
        "comp_dissolved_date": "",
        "nace_v2_code": "",
        "princ_object_code": "",
        "eircode": "",
        "company_address_2": "",
        "company_address_3": "",
        "company_address_4": "",
    }
    return {**base, **fields}


def test_routing_key_is_the_first_three_characters_of_a_valid_eircode() -> None:
    assert routing_key(row("1", "A", eircode="T12 X5Y6")) == "T12"
    assert routing_key(row("1", "A", eircode="D6WAB12")) == "D6W"
    assert routing_key(row("1", "A", eircode="")) is None
    assert routing_key(row("1", "A", eircode="ZZ9 9ZZ")) is None


def test_sector_code_falls_back_to_the_principal_object_code() -> None:
    assert sector_code(row("1", "A", nace_v2_code="56.10")) == "5610"
    assert sector_code(row("1", "A", princ_object_code="55.XX")) == "55"


def test_cork_street_in_dublin_is_not_cork() -> None:
    dublin = row("1", "A", company_address_2="CORK STREET", company_address_4="DUBLIN 8")
    assert not address_names_cork_county(dublin)
    county = row("2", "B", company_address_4="MALLOW, CO. CORK, IRELAND")
    assert address_names_cork_county(county)


def test_an_eircode_outside_cork_wins_over_the_address() -> None:
    assert not in_cork_county(row("1", "A", eircode="D08X1Y2", company_address_4="CORK"))


def test_the_scan_sorts_each_stored_question() -> None:
    rows = [
        row("1", "Late Cafe", nard="2026-03-01", nace_v2_code="56.10", eircode="T12AB12"),
        row(
            "2",
            "Very Late Hotel",
            nard="2025-12-01",
            princ_object_code="55.10",
            company_address_4="KINSALE, CO. CORK",
        ),
        row("3", "Dublin Cafe", nard="2025-12-01", nace_v2_code="56.10", eircode="D02AB12"),
        row(
            "4",
            "Gone Bar",
            nard="2025-12-01",
            nace_v2_code="56.30",
            eircode="T12AB12",
            comp_dissolved_date="2026-01-01",
        ),
        row("5", "Client Due Soon", nard="2026-09-15"),
        row("6", "Client Late", nard="2026-08-01", eircode="T23AB12"),
        row("7", "Newest", nard="2027-05-01", company_reg_date="2026-11-06"),
    ]
    result = scan(rows, {"5", "6"}, TODAY)
    assert [r["company_name"] for r in result.hospitality] == ["Very Late Hotel", "Late Cafe"]
    assert [r["company_name"] for r in result.city] == ["Late Cafe", "Client Late"]
    assert [r["company_name"] for r in result.clients_overdue] == ["Client Late"]
    assert [r["company_name"] for r in result.clients_week] == ["Client Due Soon"]
    assert result.newest_reg_date == date(2026, 11, 6)


def test_days_overdue_and_the_estimated_penalty_are_worked_out_in_code() -> None:
    # nard 2026-06-01 + 56 days = 2026-07-27, 103 days before today
    late = scan([row("1", "Late", nace_v2_code="56", eircode="T12AB12")], set(), TODAY)
    hit = late.hospitality[0]
    assert hit["filing_deadline"] == "2026-07-27"
    assert hit["days_overdue"] == 103
    assert hit["est_penalty_eur"] == 100 + 3 * 103
    very_late = scan(
        [row("1", "Very", nard="2024-01-01", nace_v2_code="55", eircode="T12AB12")], set(), TODAY
    )
    assert very_late.hospitality[0]["est_penalty_eur"] == 1200
