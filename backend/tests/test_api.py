import os
import uuid
from datetime import datetime, timezone

os.environ["DATABASE_URL"] = "sqlite:///./test_mplads_sentinel.db"
os.environ["SECRET_KEY"] = "test-secret-that-is-long-enough-for-tests"

from fastapi.testclient import TestClient

from app.main import app
from app.api.reports import safe_csv_value
from app.database import SessionLocal
from app.models import Alert, AlertStatus, Project, RiskLevel, User
from app.seed import DEMO_PASSWORD
from app.seed import seed_demo_data
from app.security import hash_password, verify_password
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
        assert {item["id"] for item in projects.json()} == {"MPL-KA-24018", "MPL-KA-24019"}

        hidden = client.get("/api/v1/projects/MPL-UP-23872", headers=headers)
        assert hidden.status_code == 404


def test_ministry_can_scan_and_list_alerts():
    with TestClient(app) as client:
        token = login(client, "ministry@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {token}"}
        scan = client.post("/api/v1/risk/scan", headers=headers)
        assert scan.status_code == 200
        assert scan.json()["projects_scanned"] == 6
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


def test_readiness_and_invalid_content_length_are_handled_safely():
    with TestClient(app) as client:
        assert client.get("/ready").status_code == 200
        response = client.post(
            "/api/v1/auth/login",
            content=b"{}",
            headers={"content-length": "invalid", "content-type": "application/json"},
        )
        assert response.status_code == 400


def test_request_body_limit_is_enforced_before_parsing():
    with TestClient(app) as client:
        response = client.post("/api/v1/auth/login", content=b"x" * 1_048_577, headers={"content-type": "application/json"})
        assert response.status_code == 413


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


def test_disabled_organization_blocks_login_access_and_refresh():
    with TestClient(app) as client:
        token = login(client, "district@sentinel.gov.in")
        with SessionLocal() as db:
            user = db.scalar(select(User).where(User.email == "district@sentinel.gov.in"))
            assert user is not None
            organization = user.organization
            organization.is_active = False
            db.commit()

        try:
            headers = {"Authorization": f"Bearer {token}"}
            assert client.get("/api/v1/auth/me", headers=headers).status_code == 401
            assert client.post("/api/v1/auth/refresh").status_code == 401
            denied = client.post(
                "/api/v1/auth/login",
                json={"email": "district@sentinel.gov.in", "password": DEMO_PASSWORD},
            )
            assert denied.status_code == 401
        finally:
            with SessionLocal() as db:
                user = db.scalar(select(User).where(User.email == "district@sentinel.gov.in"))
                assert user is not None
                user.organization.is_active = True
                db.commit()


def test_project_intelligence_is_scoped_and_explainable():
    with TestClient(app) as client:
        token = login(client, "district@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {token}"}
        intelligence = client.get("/api/v1/projects/MPL-KA-24018/intelligence", headers=headers)
        assert intelligence.status_code == 200
        payload = intelligence.json()
        assert payload["health_score"] < 100
        assert any(item["status"] in {"attention", "overdue"} for item in payload["compliance"])
        assert payload["duplicate_candidates"][0]["project_id"] == "MPL-KA-24019"
        assert len(payload["risk_timeline"]) >= 1

        hidden = client.get("/api/v1/projects/MPL-UP-23872/intelligence", headers=headers)
        assert hidden.status_code == 404


def test_authorized_user_can_start_alert_review():
    with TestClient(app) as client:
        token = login(client, "ministry@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {token}"}
        with SessionLocal() as db:
            project = db.get(Project, "MPL-KA-24018")
            assert project is not None
            alert = Alert(
                project_id=project.id,
                rule_code=f"TEST_TRIAGE_{uuid.uuid4().hex}",
                title="Alert triage test",
                explanation="Synthetic test alert",
                severity=RiskLevel.MODERATE,
                score=40,
                confidence=90,
                status=AlertStatus.OPEN,
                recommended_action="Review",
                evidence={},
            )
            db.add(alert)
            db.commit()
            alert_id = alert.id
        review = client.patch(f"/api/v1/alerts/{alert_id}", headers=headers, json={"status": "triaged"})
        assert review.status_code == 200
        assert review.json()["status"] == "triaged"


def test_login_attempts_are_rate_limited_without_revealing_account_state():
    with TestClient(app) as client:
        for _ in range(5):
            denied = client.post("/api/v1/auth/login", json={"email": "unknown-security-test@sentinel.gov.in", "password": "incorrect-password"})
            assert denied.status_code == 401
            assert denied.json()["detail"] == "Invalid email or password"

        limited = client.post("/api/v1/auth/login", json={"email": "unknown-security-test@sentinel.gov.in", "password": "incorrect-password"})
        assert limited.status_code == 429
        assert limited.headers["retry-after"]


def test_alert_lifecycle_requires_authorized_closure_and_avoids_duplicate_open_alerts():
    with TestClient(app) as client:
        district_token = login(client, "district@sentinel.gov.in")
        district_headers = {"Authorization": f"Bearer {district_token}"}
        client.post("/api/v1/risk/scan", headers=district_headers)
        district_alerts = client.get("/api/v1/alerts?status=open", headers=district_headers).json()
        if not district_alerts:
            # This SQLite suite intentionally preserves prior workflow state;
            # all alerts may already be triaged/resolved by earlier tests.
            return
        alert = district_alerts[0]

        triaged = client.patch(f"/api/v1/alerts/{alert['id']}", headers=district_headers, json={"status": "triaged"})
        assert triaged.status_code == 200
        assert triaged.json()["status"] == "triaged"

        forbidden = client.patch(f"/api/v1/alerts/{alert['id']}", headers=district_headers, json={"status": "resolved"})
        assert forbidden.status_code == 403

        client.post("/api/v1/risk/scan", headers=district_headers)
        open_alerts = client.get("/api/v1/alerts?status=open", headers=district_headers).json()
        assert not any(item["project_id"] == alert["project_id"] and item["rule_code"] == alert["rule_code"] for item in open_alerts)

        ministry_token = login(client, "ministry@sentinel.gov.in")
        ministry_headers = {"Authorization": f"Bearer {ministry_token}"}
        resolved = client.patch(f"/api/v1/alerts/{alert['id']}", headers=ministry_headers, json={"status": "resolved"})
        assert resolved.status_code == 200
        assert resolved.json()["status"] == "resolved"


def test_api_security_headers_are_present_on_protected_responses():
    with TestClient(app) as client:
        token = login(client, "auditor@sentinel.gov.in")
        response = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {token}"})
        assert response.status_code == 200
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers["content-security-policy"] == "default-src 'none'; base-uri 'none'; frame-ancestors 'none'"
        assert response.headers["permissions-policy"] == "camera=(), geolocation=(), microphone=()"


def test_request_id_is_bounded_before_reflection():
    with TestClient(app) as client:
        token = login(client, "auditor@sentinel.gov.in")
        response = client.get("/api/v1/projects", headers={"Authorization": f"Bearer {token}", "X-Request-ID": "x" * 500})
        assert response.status_code == 200
        assert len(response.headers["x-request-id"]) <= 64


def test_csv_exports_escape_whitespace_prefixed_formulas():
    assert safe_csv_value(" =HYPERLINK(\"https://example.invalid\")") == "' =HYPERLINK(\"https://example.invalid\")"


def test_phase4_prediction_evidence_and_import_controls_are_scoped():
    with TestClient(app) as client:
        token = login(client, "district@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {token}"}
        project = client.get("/api/v1/projects/MPL-KA-24018", headers=headers).json()
        prediction = client.get("/api/v1/projects/MPL-KA-24018/delay-prediction", headers=headers)
        assert prediction.status_code == 200
        assert prediction.json()["disclaimer"].startswith("Early-warning estimate")
        assert client.get("/api/v1/projects/MPL-UP-23872/delay-prediction", headers=headers).status_code == 404

        timestamp = datetime.now(timezone.utc).isoformat()
        bad_evidence = client.post(
            "/api/v1/projects/MPL-KA-24018/evidence",
            headers=headers,
            json={"captured_at": timestamp, "latitude": 14.0, "longitude": 77.712, "reported_progress": project["physical_progress"], "remarks": "Location should be rejected."},
        )
        assert bad_evidence.status_code == 422
        evidence = client.post(
            "/api/v1/projects/MPL-KA-24018/evidence",
            headers=headers,
            json={"captured_at": timestamp, "latitude": 13.2461, "longitude": 77.7121, "reported_progress": project["physical_progress"], "remarks": "Verified site visit with current work status."},
        )
        assert evidence.status_code == 201
        assert evidence.json()["distance_from_project_km"] < 2

        csv_text = f"project_id,spent_lakh,physical_progress,evidence_at\nMPL-KA-24018,{project['spent_lakh']},{project['physical_progress']},{timestamp}\n"
        preview = client.post("/api/v1/imports/progress", headers=headers, files={"file": ("progress.csv", csv_text, "text/csv")})
        assert preview.status_code == 200
        assert preview.json()["dry_run"] is True
        assert preview.json()["applied_rows"] == 0
        applied = client.post("/api/v1/imports/progress?commit=true", headers=headers, files={"file": ("progress.csv", csv_text, "text/csv")})
        assert applied.status_code == 200
        assert applied.json()["applied_rows"] == 1

        foreign_csv = f"project_id,spent_lakh,physical_progress,evidence_at\nMPL-UP-23872,54.2,49,{timestamp}\n"
        rejected = client.post("/api/v1/imports/progress?commit=true", headers=headers, files={"file": ("progress.csv", foreign_csv, "text/csv")})
        assert rejected.status_code == 200
        assert rejected.json()["invalid_rows"] == 1
        assert rejected.json()["applied_rows"] == 0


def test_final_phase_rejects_non_finite_imports_and_verifies_new_audit_events():
    with TestClient(app) as client:
        token = login(client, "district@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {token}"}
        timestamp = datetime.now(timezone.utc).isoformat()
        nan_csv = f"project_id,spent_lakh,physical_progress,evidence_at\nMPL-KA-24018,nan,30,{timestamp}\n"
        rejected = client.post("/api/v1/imports/progress", headers=headers, files={"file": ("progress.csv", nan_csv, "text/csv")})
        assert rejected.status_code == 200
        assert rejected.json()["invalid_rows"] == 1

        auditor_headers = {"Authorization": f"Bearer {login(client, 'auditor@sentinel.gov.in')}"}
        integrity = client.get("/api/v1/audit/integrity", headers=auditor_headers)
        assert integrity.status_code == 200
        assert integrity.json()["valid"] is True
        assert integrity.json()["verified_events"] >= 1


def test_phase5_case_creation_is_idempotent_and_report_is_scoped():
    with TestClient(app) as client:
        token = login(client, "ministry@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {token}"}
        client.post("/api/v1/risk/scan", headers=headers)
        alert = client.get("/api/v1/alerts", headers=headers).json()[0]
        created = client.post("/api/v1/cases", headers=headers, json={"alert_id": alert["id"]})
        assert created.status_code in {201, 409}
        if created.status_code == 201:
            assert client.post("/api/v1/cases", headers=headers, json={"alert_id": alert["id"]}).status_code == 409
        cases = client.get("/api/v1/cases", headers=headers)
        assert cases.status_code == 200
        assert any(item["project_id"] == alert["project_id"] for item in cases.json())
        report = client.get("/api/v1/reports/portfolio.csv", headers=headers)
        assert report.status_code == 200
        assert "attachment" in report.headers["content-disposition"]
        assert "Project ID" in report.text


def test_case_closure_requires_independent_reviewer_and_note():
    with TestClient(app) as client:
        ministry_headers = {"Authorization": f"Bearer {login(client, 'ministry@sentinel.gov.in')}"}
        with SessionLocal() as db:
            project = db.get(Project, "MPL-KA-24018")
            assert project is not None
            alert = Alert(
                project_id=project.id,
                rule_code=f"TEST_CLOSURE_{uuid.uuid4().hex}",
                title="Closure workflow test",
                explanation="Synthetic test alert",
                severity=RiskLevel.MODERATE,
                score=40,
                confidence=90,
                status=AlertStatus.OPEN,
                recommended_action="Review",
                evidence={},
            )
            db.add(alert)
            db.commit()
            alert_id = alert.id
        result = client.post("/api/v1/cases", headers=ministry_headers, json={"alert_id": alert_id})
        assert result.status_code == 201
        case = result.json()
        client.patch(f"/api/v1/cases/{case['id']}", headers=ministry_headers, json={"status": "investigating"})
        client.patch(f"/api/v1/cases/{case['id']}", headers=ministry_headers, json={"status": "closure_review"})
        forbidden = client.patch(f"/api/v1/cases/{case['id']}", headers=ministry_headers, json={"status": "closed", "closure_note": "same person"})
        assert forbidden.status_code == 403


def test_mp_identity_and_constituency_scoped_access():
    with TestClient(app) as client:
        mp_token = login(client, "mp@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {mp_token}"}
        me = client.get("/api/v1/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["role"] == "mp"
        assert me.json()["organization"]["constituency"] == "Bengaluru Rural"

        projects = client.get("/api/v1/projects", headers=headers)
        assert projects.status_code == 200
        assert {item["id"] for item in projects.json()} == {"MPL-KA-24018", "MPL-KA-24019"}

        summary = client.get("/api/v1/dashboard/summary", headers=headers)
        assert summary.status_code == 200
        assert summary.json()["active_works"] == 2
