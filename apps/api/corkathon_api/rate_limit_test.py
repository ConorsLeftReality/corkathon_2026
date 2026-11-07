import pytest

from corkathon_api.rate_limit import RateLimiter, address_bucket


class FakeClock:
    def __init__(self) -> None:
        self.seconds = 0.0

    def __call__(self) -> float:
        return self.seconds


def test_allows_up_to_the_limit_then_blocks() -> None:
    limiter = RateLimiter(limit=2, window_seconds=60, now=FakeClock())
    assert limiter.allow("a")
    assert limiter.allow("a")
    assert not limiter.allow("a")


def test_keys_are_counted_separately() -> None:
    limiter = RateLimiter(limit=1, window_seconds=60, now=FakeClock())
    assert limiter.allow("a")
    assert limiter.allow("b")


def test_allows_again_once_the_window_passes() -> None:
    clock = FakeClock()
    limiter = RateLimiter(limit=1, window_seconds=60, now=clock)
    assert limiter.allow("a")
    clock.seconds = 60
    assert limiter.allow("a")


def test_forgets_expired_keys_so_memory_stays_bounded() -> None:
    clock = FakeClock()
    limiter = RateLimiter(limit=1, window_seconds=60, now=clock)
    limiter.allow("a")
    clock.seconds = 61
    limiter.allow("b")
    assert limiter.tracked_keys() == 1


def test_a_full_table_evicts_the_oldest_key_instead_of_refusing_new_ones() -> None:
    limiter = RateLimiter(limit=1, window_seconds=60, now=FakeClock(), max_keys=1)
    assert limiter.allow("a")
    assert limiter.allow("b")
    assert limiter.tracked_keys() == 1
    assert not limiter.allow("b")


def test_one_ipv6_network_counts_as_one_client() -> None:
    assert address_bucket("2001:db8:1:2::a") == address_bucket("2001:db8:1:2:ffff::b")
    assert address_bucket("2001:db8:1:2::a") != address_bucket("2001:db8:1:3::a")


@pytest.mark.parametrize(
    ("address", "bucket"),
    [("203.0.113.9", "203.0.113.9"), ("::ffff:203.0.113.9", "203.0.113.9"), ("junk", "junk")],
)
def test_other_addresses_keep_their_own_bucket(address: str, bucket: str) -> None:
    assert address_bucket(address) == bucket
