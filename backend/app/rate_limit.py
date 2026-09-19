from __future__ import annotations

import hashlib
import uuid
from collections import deque
from threading import Lock
from time import monotonic, time

from redis import Redis
from redis.exceptions import RedisError

from .config import settings


class RateLimitUnavailable(RuntimeError):
    """Raised when a required shared limiter cannot be reached."""


class RedisRateLimitBackend:
    """Lazy Redis client so development remains dependency-free."""

    def __init__(self) -> None:
        self._client: Redis | None = None

    @property
    def enabled(self) -> bool:
        return bool(settings.redis_url)

    def client(self) -> Redis:
        if not settings.redis_url:
            raise RuntimeError("Redis is not configured")
        if self._client is None:
            self._client = Redis.from_url(settings.redis_url, socket_connect_timeout=1, socket_timeout=1, decode_responses=False)
        return self._client

    def failure(self, error: RedisError) -> None:
        if settings.environment == "production":
            raise RateLimitUnavailable("Shared rate limiter is unavailable") from error

    def ping(self) -> bool:
        if not self.enabled:
            return True
        try:
            return bool(self.client().ping())
        except RedisError:
            return False


redis_backend = RedisRateLimitBackend()


def _safe_key(namespace: str, value: str) -> str:
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()
    return f"mplads-sentinel:{namespace}:{digest}"


class LoginAttemptLimiter:
    """Sliding-window login limiter backed by Redis when configured."""

    def __init__(self, max_attempts: int = 5, window_seconds: int = 300) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self._attempts: dict[tuple[str, str], deque[float]] = {}
        self._lock = Lock()

    def _memory_retry_after(self, key: tuple[str, str]) -> int | None:
        now = monotonic()
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

    def retry_after(self, client_ip: str, email: str) -> int | None:
        key = (client_ip, email)
        if redis_backend.enabled:
            timestamp = time()
            redis_key = _safe_key("login", f"{client_ip}:{email}")
            try:
                client = redis_backend.client()
                pipe = client.pipeline()
                pipe.zremrangebyscore(redis_key, "-inf", timestamp - self.window_seconds)
                pipe.zrange(redis_key, 0, 0, withscores=True)
                pipe.zcard(redis_key)
                _, oldest, count = pipe.execute()
                if count < self.max_attempts or not oldest:
                    return None
                return max(1, int(self.window_seconds - (timestamp - oldest[0][1])))
            except RedisError as error:
                redis_backend.failure(error)
        return self._memory_retry_after(key)

    def record_failure(self, client_ip: str, email: str) -> None:
        key = (client_ip, email)
        if redis_backend.enabled:
            redis_key = _safe_key("login", f"{client_ip}:{email}")
            try:
                client = redis_backend.client()
                timestamp = time()
                pipe = client.pipeline()
                pipe.zadd(redis_key, {uuid.uuid4().hex: timestamp})
                pipe.expire(redis_key, self.window_seconds)
                pipe.execute()
                return
            except RedisError as error:
                redis_backend.failure(error)
        with self._lock:
            self._attempts.setdefault(key, deque()).append(monotonic())

    def clear(self, client_ip: str, email: str) -> None:
        key = (client_ip, email)
        if redis_backend.enabled:
            try:
                redis_backend.client().delete(_safe_key("login", f"{client_ip}:{email}"))
                return
            except RedisError as error:
                redis_backend.failure(error)
        with self._lock:
            self._attempts.pop(key, None)


class ActionLimiter:
    """Atomic Redis sliding-window limiter with an in-process dev fallback."""

    _ALLOW_SCRIPT = """
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local maximum = tonumber(ARGV[3])
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now - window)
if redis.call('ZCARD', KEYS[1]) >= maximum then return 0 end
redis.call('ZADD', KEYS[1], now, ARGV[4])
redis.call('EXPIRE', KEYS[1], window)
return 1
"""

    def __init__(self, max_actions: int, window_seconds: int) -> None:
        self.max_actions = max_actions
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        if redis_backend.enabled:
            try:
                allowed = redis_backend.client().eval(
                    self._ALLOW_SCRIPT,
                    1,
                    _safe_key("action", key),
                    time(),
                    self.window_seconds,
                    self.max_actions,
                    uuid.uuid4().hex,
                )
                return bool(allowed)
            except RedisError as error:
                redis_backend.failure(error)
        now = monotonic()
        with self._lock:
            events = self._events.setdefault(key, deque())
            while events and now - events[0] >= self.window_seconds:
                events.popleft()
            if len(events) >= self.max_actions:
                return False
            events.append(now)
            return True


login_attempt_limiter = LoginAttemptLimiter()
scan_limiter = ActionLimiter(max_actions=10, window_seconds=300)
