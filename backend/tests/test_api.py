import os

os.environ["DATABASE_URL"] = "sqlite:///./test_mplads_sentinel.db"
os.environ["SECRET_KEY"] = "test-secret-that-is-long-enough-for-tests"

from fastapi.testclient import TestClient

from app.main import app
from app.seed import DEMO_PASSWORD


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
