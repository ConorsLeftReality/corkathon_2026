import sqlite3
from collections.abc import Iterable, Iterator, Mapping
from contextlib import closing
from itertools import islice
from pathlib import Path

from corkathon_api.features.filings.report import norm_num

# the cro columns the report and the radar read, the rest of the file is dropped
COLUMNS = (
    "company_num",
    "company_name",
    "company_status",
    "company_type",
    "company_reg_date",
    "company_address_1",
    "company_address_2",
    "company_address_3",
    "company_address_4",
    "eircode",
    "last_ar_date",
    "nard",
    "comp_dissolved_date",
    "nace_v2_code",
    "princ_object_code",
)
BATCH = 5000
# sqlite caps bound parameters per statement
LOOKUP_CHUNK = 500


def batches(rows: Iterable[tuple[str, ...]]) -> Iterator[list[tuple[str, ...]]]:
    iterator = iter(rows)
    while batch := list(islice(iterator, BATCH)):
        yield batch


def build_index(rows: Iterable[Mapping[str, str]], target: Path) -> None:
    part = target.with_name(target.name + ".part")
    part.unlink(missing_ok=True)
    columns = ", ".join(f"{name} TEXT NOT NULL" for name in COLUMNS[1:])
    values = (
        (norm_num(row.get("company_num", "")), *((row.get(name) or "") for name in COLUMNS[1:]))
        for row in rows
    )
    with closing(sqlite3.connect(part)) as connection:
        connection.execute(f"CREATE TABLE companies (company_num TEXT PRIMARY KEY, {columns})")
        placeholders = ", ".join("?" for _ in COLUMNS)
        for batch in batches(values):
            connection.executemany(
                f"INSERT OR REPLACE INTO companies VALUES ({placeholders})",  # noqa: S608
                batch,
            )
        connection.commit()
    # built under another name so a reader never opens half a file
    part.replace(target)


def lookup(index: Path, numbers: Iterable[str]) -> list[dict[str, str]]:
    wanted = sorted(set(numbers))
    found: list[dict[str, str]] = []
    # read only, so a request can never write to the shared register
    with closing(sqlite3.connect(f"{index.as_uri()}?mode=ro", uri=True)) as connection:
        connection.row_factory = sqlite3.Row
        for start in range(0, len(wanted), LOOKUP_CHUNK):
            chunk = wanted[start : start + LOOKUP_CHUNK]
            placeholders = ", ".join("?" for _ in chunk)
            query = f"SELECT * FROM companies WHERE company_num IN ({placeholders})"  # noqa: S608
            found.extend(dict(row) for row in connection.execute(query, chunk))
    return found
