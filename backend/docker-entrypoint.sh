#!/bin/sh
set -eu

# Production startup is deliberately blocked if the reviewed schema cannot be
# brought to the current revision. This avoids silently serving a stale schema.
alembic -c /app/backend/alembic.ini upgrade head
exec python -m uvicorn app.main:app --app-dir /app/backend --host 0.0.0.0 --port 8000
