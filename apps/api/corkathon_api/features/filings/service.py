import shutil
import threading
import urllib.request
from collections.abc import Callable
from datetime import date, datetime
from pathlib import Path

from corkathon_api.errors import AppError
from corkathon_api.features.filings.register_index import build_index, lookup
from corkathon_api.features.filings.report import (
    Report,
    build_briefing,
    build_report,
    iter_snapshot_rows,
)
from corkathon_api.logging_setup import logger

CRO_SNAPSHOT_URL = (
    "https://opendata.cro.ie/dataset/bf6f837d-0946-4c14-9a99-82cd6980c121/"
    "resource/3fef41bc-b8f4-4b10-8434-ce51c29b1bba/download/companies.csv.zip"
)
Downloader = Callable[[Path], None]


def download_snapshot(target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    part = target.with_name(target.name + ".part")
    request = urllib.request.Request(CRO_SNAPSHOT_URL, headers={"User-Agent": "dialed-in/1.0"})
    # a fixed https url, never built from request input
    with urllib.request.urlopen(request, timeout=300) as response, part.open("wb") as out:  # noqa: S310
        # streamed to disk, the 47 MB file must not sit in the pi's memory
        shutil.copyfileobj(response, out, 1024 * 1024)
    part.replace(target)


class FilingsService:
    def __init__(
        self,
        data_dir: Path,
        window_days: int,
        today: Callable[[], date],
        download: Downloader = download_snapshot,
        background: bool = True,
    ) -> None:
        self.data_dir = data_dir
        self.window_days = window_days
        self.today = today
        self.download = download
        self.background = background
        self.lock = threading.Lock()
        self.preparing = False
        # waitress serves on several threads and two builds would share one .part file
        self.build_lock = threading.Lock()

    def snapshot_path(self, day: date) -> Path:
        return self.data_dir / f"cro_companies_{day.isoformat()}.csv.zip"

    def index_path(self, day: date) -> Path:
        return self.data_dir / f"cro_register_{day.isoformat()}.sqlite"

    def ensure_snapshot(self, day: date) -> Path:
        path = self.snapshot_path(day)
        if path.exists():
            return path
        self.prepare_in_background(day)
        raise AppError(
            "filings_building", "Downloading today's CRO register. Try again in a minute.", 503
        )

    def ensure_index(self, day: date) -> Path:
        index = self.index_path(day)
        if index.exists():
            return index
        if not self.background and self.snapshot_path(day).exists():
            self.prepare(day)
            return index
        self.prepare_in_background(day)
        raise AppError(
            "filings_building", "Preparing today's CRO register. Try again in a minute.", 503
        )

    def prepare_in_background(self, day: date) -> None:
        with self.lock:
            if self.preparing:
                return
            self.preparing = True
        # the download and the index build both outlive a proxy timeout on the pi
        threading.Thread(target=self.prepare_and_release, args=(day,), daemon=True).start()

    def prepare_and_release(self, day: date) -> None:
        try:
            self.prepare(day)
        except Exception as error:  # noqa: BLE001
            logger.error("cro register preparation failed", exc_info=error)
        finally:
            with self.lock:
                self.preparing = False

    def prepare(self, day: date) -> None:
        with self.build_lock:
            snapshot = self.snapshot_path(day)
            if not snapshot.exists():
                self.download(snapshot)
            index = self.index_path(day)
            if not index.exists():
                build_index(iter_snapshot_rows(snapshot), index)
            for pattern in ("cro_companies_*.csv.zip", "cro_register_*.sqlite"):
                for old in self.data_dir.glob(pattern):
                    if old not in (snapshot, index):
                        old.unlink(missing_ok=True)

    def report_for(self, numbers: set[str]) -> Report:
        day = self.today()
        rows = lookup(self.ensure_index(day), numbers) if numbers else []
        return build_report(rows, numbers, day, self.window_days, datetime.now())

    def rows_for(self, numbers: set[str]) -> list[dict[str, str]]:
        return lookup(self.ensure_index(self.today()), numbers) if numbers else []

    def briefing_for(self, numbers: set[str]) -> str:
        return build_briefing(self.report_for(numbers))
