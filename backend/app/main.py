from contextlib import asynccontextmanager

import logging
import re
import uuid

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from sqlalchemy import text

from .api import alerts, audit, auth, cases, dashboard, imports, mp_approvals, projects, reports
from .config import settings
from .database import Base, SessionLocal, engine
from .rate_limit import redis_backend
from .request_limits import RequestSizeLimitMiddleware
from .seed import seed_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Local demo databases are disposable. Deployed environments must use the
    # reviewed Alembic migration history, never implicit schema creation.
    if settings.environment == "development":
        Base.metadata.create_all(bind=engine)
        if settings.database_url.startswith("sqlite"):
            with engine.connect() as conn:
                for col_name, col_type in [
                    ("pan_number", "VARCHAR(10)"),
                    ("aadhaar_number", "VARCHAR(16)"),
                    ("bank_name", "VARCHAR(120)"),
                    ("bank_account_number", "VARCHAR(30)"),
                    ("bank_ifsc", "VARCHAR(15)"),
                    ("pfms_code", "VARCHAR(40)"),
                    ("biometric_enrolled", "BOOLEAN DEFAULT 1"),
                    ("biometric_device_id", "VARCHAR(80)"),
                    ("biometric_enrolled_at", "DATETIME"),
                ]:
                    try:
                        conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))
                        conn.commit()
                    except Exception:
                        pass
    if settings.auto_seed:
        with SessionLocal() as db:
            seed_demo_data(db)
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.2.0",
    description="Secure risk-intelligence API for MPLADS monitoring.",
    lifespan=lifespan,
)

app.add_middleware(RequestSizeLimitMiddleware, max_bytes=settings.max_request_bytes)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_origin_regex=settings.development_origin_regex if settings.environment == "development" else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "X-Biometric-Token"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    supplied_request_id = request.headers.get("X-Request-ID", "")
    request_id = supplied_request_id if re.fullmatch(r"[A-Za-z0-9-]{1,64}", supplied_request_id) else str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), geolocation=(), microphone=()"
    response.headers["Cache-Control"] = "no-store" if request.url.path.startswith("/api/") else "no-cache"
    if request.url.path.startswith("/api/"):
        response.headers["Content-Security-Policy"] = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    if settings.environment == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


@app.exception_handler(Exception)
async def unhandled_error(_: Request, __: Exception):
    return JSONResponse(status_code=500, content={"detail": "Unexpected server error"})


@app.get("/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "service": settings.app_name, "version": "0.2.0"}


@app.get("/ready", tags=["system"])
def readiness() -> dict[str, str]:
    """Probe required dependencies without exposing configuration details."""
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("SELECT 1")
    except Exception as exc:
        logging.getLogger(__name__).warning("readiness probe failed: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Service dependencies are unavailable") from exc
    if not redis_backend.ping():
        logging.getLogger(__name__).warning("readiness probe failed: redis unavailable")
        raise HTTPException(status_code=503, detail="Service dependencies are unavailable")
    return {"status": "ready"}


app.include_router(auth.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(imports.router, prefix="/api/v1")
app.include_router(cases.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(mp_approvals.router, prefix="/api/v1")
