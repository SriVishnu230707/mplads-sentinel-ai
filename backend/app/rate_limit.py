"""Small bounded limiter for local development.

Production deployments should replace this with an atomic Redis or gateway rate
limiter so limits are shared by every API instance.
"""

from collections import deque
from datetime import datetime, timedelta, timezone
from threading import Lock


class SlidingWindowLimiter:
    def __init__(self, *, limit: int, window_seconds: int, max_keys: int = 10_000) -> None:
        self.limit = limit
        self.window = timedelta(seconds=window_seconds)
        self.max_keys = max_keys
        self._events: dict[str, deque[datetime]] = {}
        self._lock = Lock()

    def allowed(self, key: str) -> bool:
        if self.blocked(key):
            return False
        self.record(key)
        return True

    def blocked(self, key: str) -> bool:
        now = datetime.now(timezone.utc)
        cutoff = now - self.window
        with self._lock:
            bucket = self._events.setdefault(key, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            return len(bucket) >= self.limit

    def record(self, key: str) -> None:
        now = datetime.now(timezone.utc)
        cutoff = now - self.window
        with self._lock:
            bucket = self._events.setdefault(key, deque())
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            bucket.append(now)
            # Bound memory even when an attacker creates many distinct keys.
            if len(self._events) > self.max_keys:
                expired = [item for item, values in self._events.items() if not values or values[-1] <= cutoff]
                for item in expired:
                    self._events.pop(item, None)
                if len(self._events) > self.max_keys:
                    self._events.pop(next(iter(self._events)))


login_limiter = SlidingWindowLimiter(limit=5, window_seconds=300)
scan_limiter = SlidingWindowLimiter(limit=3, window_seconds=300)
