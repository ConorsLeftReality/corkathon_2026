from collections.abc import Callable
from ipaddress import IPv6Address, ip_address, ip_network
from threading import Lock


def address_bucket(address: str) -> str:
    """one host usually owns a whole ipv6 /64, so counting single addresses is free to dodge"""
    try:
        parsed = ip_address(address)
    except ValueError:
        return address
    if not isinstance(parsed, IPv6Address):
        return str(parsed)
    if parsed.ipv4_mapped is not None:
        return str(parsed.ipv4_mapped)
    return str(ip_network(f"{parsed}/64", strict=False))


class RateLimiter:
    """counts in process memory, which holds while the app runs as one waitress process"""

    def __init__(
        self,
        limit: int,
        window_seconds: float,
        now: Callable[[], float],
        max_keys: int = 10_000,
    ) -> None:
        self._limit = limit
        self._window_seconds = window_seconds
        self._now = now
        self._max_keys = max_keys
        self._lock = Lock()
        self._windows: dict[str, tuple[float, int]] = {}

    def allow(self, key: str) -> bool:
        with self._lock:
            now = self._now()
            self._forget_expired(now)
            if key not in self._windows and len(self._windows) >= self._max_keys:
                # losing one count beats a full table refusing every new client
                del self._windows[next(iter(self._windows))]
            started, count = self._windows.get(key, (now, 0))
            if count >= self._limit:
                return False
            self._windows[key] = (started, count + 1)
            return True

    def tracked_keys(self) -> int:
        return len(self._windows)

    def _forget_expired(self, now: float) -> None:
        # dicts keep insertion order and every window is the same length, so the oldest is first
        while self._windows:
            oldest = next(iter(self._windows))
            if now - self._windows[oldest][0] < self._window_seconds:
                return
            del self._windows[oldest]
