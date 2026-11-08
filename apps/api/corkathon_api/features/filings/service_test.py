import threading
import time
from collections.abc import Iterable, Mapping
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from corkathon_api.errors import AppError
from corkathon_api.features.filings import service as service_module
from corkathon_api.features.filings.register_index import build_index
from corkathon_api.features.filings.routes_test import AS_OF, write_snapshot
from corkathon_api.features.filings.service import FilingsService


def test_the_register_index_is_built_once_and_reused(tmp_path: Path) -> None:
    folder = tmp_path / "filings"
    write_snapshot(folder)
    service = FilingsService(folder, 30, today=lambda: AS_OF, background=False)
    first = service.report_for({"104547"})
    index = service.index_path(AS_OF)
    built_at = index.stat().st_mtime_ns
    second = service.report_for({"104547", "500"})
    assert index.stat().st_mtime_ns == built_at
    assert [c["company_name"] for c in first["companies"]] == ["RYANAIR DAC"]
    assert {c["company_name"] for c in second["companies"]} == {"RYANAIR DAC", "NOT A CLIENT LTD"}


def test_requests_at_the_same_moment_build_the_index_once(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    folder = tmp_path / "filings"
    write_snapshot(folder)
    builds: list[int] = []

    def slow_build(rows: Iterable[Mapping[str, str]], target: Path) -> None:
        builds.append(1)
        # wide enough that every thread arrives while the first build is running
        time.sleep(0.2)
        build_index(rows, target)

    monkeypatch.setattr(service_module, "build_index", slow_build)
    service = FilingsService(folder, 30, today=lambda: AS_OF, background=False)
    start = threading.Barrier(8)

    def request() -> int:
        start.wait()
        return len(service.report_for({"104547"})["companies"])

    with ThreadPoolExecutor(8) as pool:
        results = list(pool.map(lambda _: request(), range(8)))
    assert results == [1] * 8
    assert len(builds) == 1


def test_an_old_days_files_are_removed_once_today_is_ready(tmp_path: Path) -> None:
    folder = tmp_path / "filings"
    write_snapshot(folder)
    stale = [folder / "cro_companies_2026-11-06.csv.zip", folder / "cro_register_2026-11-06.sqlite"]
    for path in stale:
        path.write_text("old", encoding="utf-8")
    FilingsService(folder, 30, today=lambda: AS_OF, background=False).report_for({"1"})
    assert not any(path.exists() for path in stale)


def test_without_a_snapshot_the_report_waits_for_the_download(tmp_path: Path) -> None:
    fetched: list[Path] = []
    service = FilingsService(tmp_path, 30, today=lambda: AS_OF, download=fetched.append)
    with pytest.raises(AppError) as raised:
        service.report_for({"104547"})
    assert raised.value.code == "filings_building"
