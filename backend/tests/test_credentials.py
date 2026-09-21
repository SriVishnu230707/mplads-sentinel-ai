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


def test_get_masked_credentials_by_default():
    with TestClient(app) as client:
        token = login(client, "mp@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get("/api/v1/auth/credentials", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["is_unlocked"] is False
        assert data["pan_number"] is not None
        assert "••••" in data["pan_number"]
        assert data["aadhaar_number"] is not None
        assert "•••• •••• " in data["aadhaar_number"]
        assert data["bank_account_number"] is not None
        assert "••••••••" in data["bank_account_number"]
        assert data["bank_name"] is not None
        assert data["bank_ifsc"] == "SBIN0000691"
        assert data["biometric_enrolled"] is True


def test_biometric_verification_unlocks_credentials():
    with TestClient(app) as client:
        token = login(client, "ministry@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {token}"}

        # Perform biometric verification
        verify_res = client.post(
            "/api/v1/auth/biometric-verify",
            headers=headers,
            json={"method": "fingerprint", "device_challenge": "mock-uidai-challenge-123"},
        )
        assert verify_res.status_code == 200
        verify_data = verify_res.json()
        assert verify_data["status"] == "verified"
        assert "unlock_token" in verify_data

        unlocked_creds = verify_data["credentials"]
        assert unlocked_creds["is_unlocked"] is True
        assert unlocked_creds["pan_number"] == "AAAPK1982A"
        assert unlocked_creds["aadhaar_number"] == "982345128891"
        assert unlocked_creds["bank_account_number"] == "30291823901"

        # Now pass unlock token header to GET /credentials
        unlock_headers = {
            "Authorization": f"Bearer {token}",
            "x-biometric-token": verify_data["unlock_token"],
        }
        res = client.get("/api/v1/auth/credentials", headers=unlock_headers)
        assert res.status_code == 200
        assert res.json()["is_unlocked"] is True
        assert res.json()["pan_number"] == "AAAPK1982A"


def test_update_credentials_and_validation():
    with TestClient(app) as client:
        token = login(client, "district@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {token}"}

        # Invalid PAN format
        bad_pan_res = client.post("/api/v1/auth/credentials", headers=headers, json={"pan_number": "INVALID123"})
        assert bad_pan_res.status_code == 422

        # Invalid Aadhaar (must be 12 digits)
        bad_aadhaar_res = client.post("/api/v1/auth/credentials", headers=headers, json={"aadhaar_number": "12345"})
        assert bad_aadhaar_res.status_code == 422

        # Valid update
        update_res = client.post(
            "/api/v1/auth/credentials",
            headers=headers,
            json={
                "bank_name": "State Bank of India (Bengaluru)",
                "bank_account_number": "998877665544",
                "bank_ifsc": "SBIN0040123",
            },
        )
        assert update_res.status_code == 200
        data = update_res.json()
        assert data["bank_name"] == "State Bank of India (Bengaluru)"
        assert data["bank_ifsc"] == "SBIN0040123"
        assert data["bank_account_number"].endswith("5544")
