from pathlib import Path

from corkathon_api.features.filings.routes_test import AS_OF, write_snapshot
from corkathon_api.features.filings.service import FilingsService


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def make_service(folder: Path, clock: FakeClock) -> FilingsService:
    write_snapshot(folder)
    return FilingsService(folder, 30, today=lambda: AS_OF, clock=clock)


def test_back_to_back_rebuilds_reuse_the_last_report(tmp_path: Path) -> None:
    clock = FakeClock()
    service = make_service(tmp_path / "filings", clock)
    service.rebuild()
    clock.now += 5
    service.rebuild()
    # rereading the whole cro file on every click would let one account pin the pi's cpu
    assert service.builds == 1


def test_a_rebuild_after_the_pause_reads_the_file_again(tmp_path: Path) -> None:
    clock = FakeClock()
    service = make_service(tmp_path / "filings", clock)
    service.rebuild()
    clock.now += 16
    service.rebuild()
    assert service.builds == 2
