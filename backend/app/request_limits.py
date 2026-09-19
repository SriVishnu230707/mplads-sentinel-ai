from __future__ import annotations

from collections.abc import Awaitable, Callable


class RequestBodyTooLarge(Exception):
    pass


class RequestSizeLimitMiddleware:
    """Enforce a body cap for declared and chunked HTTP requests."""

    def __init__(self, app: Callable[..., Awaitable[None]], max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope, receive, send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        declared = headers.get(b"content-length")
        if declared:
            try:
                declared_size = int(declared)
            except ValueError:
                await self._send_error(send, 400, b'{"detail":"Invalid Content-Length header"}')
                return
            if declared_size < 0:
                await self._send_error(send, 400, b'{"detail":"Invalid Content-Length header"}')
                return
            if declared_size > self.max_bytes:
                await self._send_error(send, 413, b'{"detail":"Request body is too large"}')
                return

        consumed = 0
        response_started = False

        async def limited_receive():
            nonlocal consumed
            message = await receive()
            if message["type"] == "http.request":
                consumed += len(message.get("body", b""))
                if consumed > self.max_bytes:
                    raise RequestBodyTooLarge
            return message

        async def tracked_send(message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracked_send)
        except RequestBodyTooLarge:
            if not response_started:
                await self._send_error(send, 413, b'{"detail":"Request body is too large"}')

    @staticmethod
    async def _send_error(send, status: int, body: bytes) -> None:
        await send({"type": "http.response.start", "status": status, "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())]})
        await send({"type": "http.response.body", "body": body})
