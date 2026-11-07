import threading
from datetime import date
from pathlib import Path

from corkathon_api.errors import AppError
from corkathon_api.features.filings.report import iter_snapshot_rows
from corkathon_api.features.filings.service import FilingsService
from corkathon_api.features.radar.prospects import Scan, scan
from corkathon_api.logging_setup import logger

CacheKey = tuple[date, frozenset[str]]


class RadarService:
    """one pass over the cro file per day and client list, shared by every stored question"""

    def __init__(self, filings: FilingsService, background: bool = True) -> None:
        self.filings = filings
        self.background = background
        self.lock = threading.Lock()
        self.cache: tuple[CacheKey, Scan] | None = None
        self.building = False

    def today_scan(self) -> Scan:
        day = self.filings.today()
        clients = frozenset(self.filings.company_numbers())
        key: CacheKey = (day, clients)
        with self.lock:
            if self.cache and self.cache[0] == key:
                return self.cache[1]
        snapshot = self.filings.ensure_snapshot(day)
        if not self.background:
            return self.run(key, snapshot)
        with self.lock:
            if not self.building:
                self.building = True
                # the full file takes a while on the pi, longer than a request should wait
                threading.Thread(
                    target=self.run_in_background, args=(key, snapshot), daemon=True
                ).start()
        raise AppError(
            "radar_building",
            "Preparing today's answers from the CRO register. Try again in a minute.",
            503,
        )

    def run(self, key: CacheKey, snapshot: Path) -> Scan:
        result = scan(iter_snapshot_rows(snapshot), set(key[1]), key[0])
        with self.lock:
            self.cache = (key, result)
        return result

    def run_in_background(self, key: CacheKey, snapshot: Path) -> None:
        try:
            self.run(key, snapshot)
        except Exception as error:  # noqa: BLE001
            logger.error("radar scan failed", exc_info=error)
        finally:
            with self.lock:
                self.building = False
