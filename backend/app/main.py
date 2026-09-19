from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import alerts, auth, dashboard, imports, projects
from .config import settings
from .database import Base, SessionLocal, engine
from .seed import seed_demo_data


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Prototype convenience. Production uses Alembic migrations instead.
    Base.metadata.create_all(bind=engine)
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_origin_regex=settings.development_origin_regex if settings.environment == "development" else None,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
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


app.include_router(auth.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(imports.router, prefix="/api/v1")
