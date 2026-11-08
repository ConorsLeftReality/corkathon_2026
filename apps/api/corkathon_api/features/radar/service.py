import threading
from datetime import date
from pathlib import Path

from corkathon_api.errors import AppError
from corkathon_api.features.filings.report import iter_snapshot_rows
from corkathon_api.features.filings.service import FilingsService
from corkathon_api.features.radar.prospects import Scan, scan
from corkathon_api.logging_setup import logger


class RadarService:
    # one pass over the cro file per day for prospects, shared by every account

    def __init__(self, filings: FilingsService, background: bool = True) -> None:
        self.filings = filings
        self.background = background
        self.lock = threading.Lock()
        self.cache: tuple[date, Scan] | None = None
        self.building = False

    def today_scan(self) -> Scan:
        day = self.filings.today()
        with self.lock:
            if self.cache and self.cache[0] == day:
                return self.cache[1]
        snapshot = self.filings.ensure_snapshot(day)
        if not self.background:
            return self.run(day, snapshot)
        with self.lock:
            if not self.building:
                self.building = True
                # the full file takes a while on the pi, longer than a request should wait
                threading.Thread(
                    target=self.run_in_background, args=(day, snapshot), daemon=True
                ).start()
        raise AppError(
            "radar_building",
            "Preparing today's answers from the CRO register. Try again in a minute.",
            503,
        )

    def client_scan(self, numbers: set[str]) -> Scan:
        # one account's companies from the register index, never the whole file
        return scan(self.filings.rows_for(numbers), numbers, self.filings.today())

    def run(self, day: date, snapshot: Path) -> Scan:
        result = scan(iter_snapshot_rows(snapshot), set(), day)
        with self.lock:
            self.cache = (day, result)
        return result

    def run_in_background(self, day: date, snapshot: Path) -> None:
        try:
            self.run(day, snapshot)
        except Exception as error:  # noqa: BLE001
            logger.error("radar scan failed", exc_info=error)
        finally:
            with self.lock:
                self.building = False
