from __future__ import annotations

from collections import deque
from threading import Lock
from time import monotonic


class LoginAttemptLimiter:
    """Small in-memory guard for the local prototype's login endpoint.

    A production deployment should replace this with an atomic Redis-backed
    limiter shared by every API instance.
    """

    def __init__(self, max_attempts: int = 5, window_seconds: int = 300) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[tuple[str, str], deque[float]] = {}
        self._lock = Lock()

    def retry_after(self, client_ip: str, email: str) -> int | None:
        now = monotonic()
        key = (client_ip, email)
        with self._lock:
            attempts = self._attempts.get(key)
            if not attempts:
                return None
            while attempts and now - attempts[0] >= self.window_seconds:
                attempts.popleft()
            if not attempts:
                self._attempts.pop(key, None)
                return None
            if len(attempts) < self.max_attempts:
                return None
            return max(1, int(self.window_seconds - (now - attempts[0])))

    def record_failure(self, client_ip: str, email: str) -> None:
        with self._lock:
            self._attempts.setdefault((client_ip, email), deque()).append(monotonic())

    def clear(self, client_ip: str, email: str) -> None:
        with self._lock:
            self._attempts.pop((client_ip, email), None)


login_attempt_limiter = LoginAttemptLimiter()


class ActionLimiter:
    """Bound costly local actions until Redis-backed limits are configured."""

    def __init__(self, max_actions: int, window_seconds: int) -> None:
        self.max_actions = max_actions
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = monotonic()
        with self._lock:
            events = self._events.setdefault(key, deque())
            while events and now - events[0] >= self.window_seconds:
                events.popleft()
            if len(events) >= self.max_actions:
                return False
            events.append(now)
            return True


scan_limiter = ActionLimiter(max_actions=10, window_seconds=300)
