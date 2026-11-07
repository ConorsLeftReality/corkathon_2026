import json
import shutil
import threading
import time
import urllib.request
from collections.abc import Callable
from datetime import date, datetime
from pathlib import Path
from typing import cast

from corkathon_api.errors import AppError
from corkathon_api.features.filings.report import (
    Report,
    build_briefing,
    build_report,
    iter_snapshot_rows,
    load_company_numbers,
)
from corkathon_api.logging_setup import logger

CRO_SNAPSHOT_URL = (
    "https://opendata.cro.ie/dataset/bf6f837d-0946-4c14-9a99-82cd6980c121/"
    "resource/3fef41bc-b8f4-4b10-8434-ce51c29b1bba/download/companies.csv.zip"
)
# a demo list of public companies, used until a my_companies.csv is put in the data folder
DEMO_COMPANY_NUMBERS = frozenset({"104547", "111471", "12965", "999999999"})

Downloader = Callable[[Path], None]
# a rebuild rereads the whole cro file, so clicks closer together than this reuse the last one
MIN_REBUILD_SECONDS = 15


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
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.data_dir = data_dir
        self.window_days = window_days
        self.today = today
        self.download = download
        self.downloading = False
        self.download_lock = threading.Lock()
        self.build_lock = threading.Lock()
        self.clock = clock
        self.builds = 0
        self.last_report: Report | None = None
        self.last_build_at = 0.0

    def snapshot_path(self, day: date) -> Path:
        return self.data_dir / f"cro_companies_{day.isoformat()}.csv.zip"

    def company_numbers(self) -> set[str]:
        path = self.data_dir / "my_companies.csv"
        return load_company_numbers(path) if path.exists() else set(DEMO_COMPANY_NUMBERS)

    def ensure_snapshot(self, day: date) -> Path:
        path = self.snapshot_path(day)
        if path.exists():
            return path
        with self.download_lock:
            if not self.downloading:
                self.downloading = True
                # a request would outlive the proxy timeout, so fetch in the background
                threading.Thread(
                    target=self.download_in_background, args=(path,), daemon=True
                ).start()
        raise AppError(
            "filings_building", "Downloading today's CRO register. Try again in a minute.", 503
        )

    def download_in_background(self, path: Path) -> None:
        try:
            self.download(path)
            for old in self.data_dir.glob("cro_companies_*.csv.zip"):
                if old != path:
                    old.unlink(missing_ok=True)
        except Exception as error:  # noqa: BLE001
            logger.error("cro snapshot download failed", exc_info=error)
        finally:
            with self.download_lock:
                self.downloading = False

    def rebuild(self) -> Report:
        day = self.today()
        snapshot = self.ensure_snapshot(day)
        with self.build_lock:
            recent = self.clock() - self.last_build_at < MIN_REBUILD_SECONDS
            if recent and self.last_report and self.last_report["as_of"] == day.isoformat():
                return self.last_report
            report = build_report(
                iter_snapshot_rows(snapshot),
                self.company_numbers(),
                day,
                self.window_days,
                datetime.now(),
            )
            cache = self.data_dir / "report.json"
            temporary = cache.with_name("report.json.part")
            temporary.write_text(json.dumps(report, ensure_ascii=False), encoding="utf-8")
            temporary.replace(cache)
            self.builds += 1
            self.last_report = report
            self.last_build_at = self.clock()
        return report

    def report(self) -> Report:
        cache = self.data_dir / "report.json"
        if cache.exists():
            cached = cast(Report, json.loads(cache.read_text(encoding="utf-8")))
            if cached.get("as_of") == self.today().isoformat():
                return cached
        return self.rebuild()

    def briefing(self) -> str:
        return build_briefing(self.report())
