import os

os.environ["DATABASE_URL"] = "sqlite:///./test_mplads_sentinel.db"
os.environ["SECRET_KEY"] = "test-secret-that-is-long-enough-for-tests"

from fastapi.testclient import TestClient

from app.main import app
from app.database import SessionLocal
from app.models import User
from app.seed import DEMO_PASSWORD
from app.seed import seed_demo_data
from app.security import hash_password, verify_password
from app.rate_limit import login_limiter
from sqlalchemy import select


def login(client: TestClient, email: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_login_identity_and_scoped_project_access():
    with TestClient(app) as client:
        district_token = login(client, "district@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {district_token}"}
        me = client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["role"] == "district"

        projects = client.get("/api/v1/projects", headers=headers)
        assert projects.status_code == 200
        assert [item["id"] for item in projects.json()] == ["MPL-KA-24018"]

        hidden = client.get("/api/v1/projects/MPL-UP-23872", headers=headers)
        assert hidden.status_code == 404


def test_ministry_can_scan_and_list_alerts():
    with TestClient(app) as client:
        token = login(client, "ministry@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {token}"}
        scan = client.post("/api/v1/risk/scan", headers=headers)
        assert scan.status_code == 200
        assert scan.json()["projects_scanned"] == 5
        alerts = client.get("/api/v1/alerts", headers=headers)
        assert alerts.status_code == 200
        assert len(alerts.json()) > 0


def test_refresh_cookie_rotates_without_exposing_refresh_token():
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/login", json={"email": "ministry@sentinel.gov.in", "password": DEMO_PASSWORD})
        assert "refresh_token" not in response.json()
        assert response.cookies.get("sentinel_refresh")
        refreshed = client.post("/api/v1/auth/refresh")
        assert refreshed.status_code == 200
        assert refreshed.json()["access_token"]


def test_unauthenticated_requests_are_rejected():
    with TestClient(app) as client:
        response = client.get("/api/v1/projects")
        assert response.status_code == 401


def test_api_security_headers_are_set():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_failed_login_is_rate_limited_without_disclosing_the_account():
    login_limiter._events.clear()
    with TestClient(app) as client:
        for _ in range(5):
            response = client.post("/api/v1/auth/login", json={"email": "missing@example.com", "password": "WrongPassword123!"})
            assert response.status_code == 401
        blocked = client.post("/api/v1/auth/login", json={"email": "missing@example.com", "password": "WrongPassword123!"})
        assert blocked.status_code == 429


def test_antigravity_local_preview_origin_is_authorized():
    with TestClient(app) as client:
        response = client.options(
            "/api/v1/auth/login",
            headers={
                "Origin": "http://localhost:4173",
                "Access-Control-Request-Method": "POST",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == "http://localhost:4173"


def test_demo_seed_repairs_disabled_account_and_stale_password():
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "ministry@sentinel.gov.in"))
        assert user is not None
        previous_token_version = user.token_version
        user.is_active = False
        user.password_hash = hash_password("obsolete-demo-password")
        db.commit()

        seed_demo_data(db)
        db.refresh(user)

        assert user.is_active is True
        assert verify_password(DEMO_PASSWORD, user.password_hash)
        assert user.token_version == previous_token_version + 1


def test_demo_seed_repairs_malformed_legacy_hash():
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == "state@sentinel.gov.in"))
        assert user is not None
        user.password_hash = "not-a-supported-password-hash"
        db.commit()

        seed_demo_data(db)
        db.refresh(user)

        assert verify_password(DEMO_PASSWORD, user.password_hash)
