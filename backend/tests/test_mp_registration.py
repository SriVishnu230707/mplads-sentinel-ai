import os
import uuid

os.environ["DATABASE_URL"] = "sqlite:///./test_mplads_sentinel.db"
os.environ["SECRET_KEY"] = "test-secret-that-is-long-enough-for-tests"

from fastapi.testclient import TestClient

from app.main import app
from app.seed import DEMO_PASSWORD


def login(client: TestClient, email: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": DEMO_PASSWORD})
    assert response.status_code == 200
    return response.json()["access_token"]


def test_mp_registration_and_ministry_approval_flow():
    with TestClient(app) as client:
        unique_suffix = uuid.uuid4().hex[:6]
        # 1. Attempt login before registration -> Fails
        unapproved_email = f"supriya.{unique_suffix}@parliament.gov.in"
        unapproved_pass = "Baramati@2026"
        res = client.post("/api/v1/auth/login", json={"email": unapproved_email, "password": unapproved_pass})
        assert res.status_code == 401

        # 2. Submit complete MP registration application with statutory dossier
        payload = {
            "email": unapproved_email,
            "password": unapproved_pass,
            "full_name": "Supriya Sule",
            "phone_number": "9820011223",
            "dob": "1969-06-30",
            "gender": "Female",
            "blood_group": "B+",
            "father_or_spouse_name": "Sharad Pawar",
            "permanent_address": "Govind Baug, Malegaon BK, Baramati, Pune, Maharashtra - 413115",
            "present_address": "8, Janpath, New Delhi - 110001",
            "house": "Lok Sabha",
            "state": "Maharashtra",
            "constituency": "Baramati",
            "political_party": "Nationalist Congress Party - Sharadchandra Pawar",
            "term_label": "18th Lok Sabha (2024-2029)",
            "voter_id": f"MH{unique_suffix.upper()}",
            "voter_constituency_serial": "Part 210, Sl 405",
            "driving_license_no": "MH12 19950004123",
            "driving_license_rto": "RTO Pune (MH-12)",
            "winning_certificate_no": "ECI-MH-2024-FORM21E-035",
            "winning_date": "2024-06-04",
            "returning_officer_code": "RO-MH-35-BARAMATI",
            "community_certificate_no": "REV-MH-PUN-2015-89102",
            "community_category": "General",
            "community_issuing_authority": "Sub-Divisional Officer, Baramati",
            "birth_certificate_no": "MC-PUN-1969-1092",
            "birth_place": "Pune, Maharashtra",
            "pan_number": "AASPS1969M",
            "aadhaar_number": "612345678901",
            "immovable_properties": [
                {
                    "property_type": "Agricultural Land",
                    "location": "Malegaon BK, Baramati, Pune",
                    "area_sqft": "5.2 Acres",
                    "estimated_value_lakh": 240.0,
                    "ownership_status": "Self",
                },
                {
                    "property_type": "Residential Bungalow",
                    "location": "Bavdhan, Pune, Maharashtra",
                    "area_sqft": "4500 sq.ft",
                    "estimated_value_lakh": 450.0,
                    "ownership_status": "Joint",
                },
            ],
            "movable_assets": {
                "bank_deposits_lakh": 210.0,
                "vehicles_summary": "Mahindra Scorpio-N (MH-12-SS-2024)",
                "gold_jewellery_grams": 180.0,
                "investments_shares_lakh": 520.0,
            },
            "total_assets_lakh": 1420.0,
            "liabilities_lakh": 35.0,
            "affidavit_eci_ref": "https://affidavit.eci.gov.in/candidate-affidavit/2024/MH/35",
            "bank_name": "State Bank of India, Parliament House",
            "bank_account_number": "20918239012",
            "bank_ifsc": "SBIN0000691",
            "pfms_code": "PFMS-MP-00912",
        }

        reg_res = client.post("/api/v1/auth/mp-registration", json=payload)
        assert reg_res.status_code == 201
        reg_data = reg_res.json()
        assert reg_data["status"] == "pending"
        assert reg_data["email"] == unapproved_email
        assert reg_data["voter_id"] == f"MH{unique_suffix.upper()}"
        assert len(reg_data["immovable_properties"]) == 2
        req_id = reg_data["id"]

        # 3. Check status endpoint (Public)
        status_res = client.get(f"/api/v1/auth/mp-registration/status?ref_id={req_id}")
        assert status_res.status_code == 200
        assert status_res.json()["status"] == "pending"

        # 4. Non-ministry user cannot list or approve
        district_token = login(client, "district@sentinel.gov.in")
        d_headers = {"Authorization": f"Bearer {district_token}"}
        forbidden_list = client.get("/api/v1/ministry/mp-registrations", headers=d_headers)
        assert forbidden_list.status_code == 403

        forbidden_approve = client.post(
            f"/api/v1/ministry/mp-registrations/{req_id}/approve",
            headers=d_headers,
            json={"remarks": "Attempt by district"},
        )
        assert forbidden_approve.status_code == 403

        # 5. Ministry user lists applications and inspects dossier
        ministry_token = login(client, "ministry@sentinel.gov.in")
        m_headers = {"Authorization": f"Bearer {ministry_token}"}

        m_list = client.get("/api/v1/ministry/mp-registrations", headers=m_headers)
        assert m_list.status_code == 200
        items = m_list.json()
        target_item = next((item for item in items if item["id"] == req_id), None)
        assert target_item is not None
        assert target_item["status"] == "pending"
        assert target_item["winning_certificate_no"] == "ECI-MH-2024-FORM21E-035"

        # 6. Ministry user approves the application
        approve_res = client.post(
            f"/api/v1/ministry/mp-registrations/{req_id}/approve",
            headers=m_headers,
            json={"remarks": "All statutory ECI certificates, property disclosures and voter ID verified."},
        )
        assert approve_res.status_code == 200
        approved_data = approve_res.json()
        assert approved_data["status"] == "approved"
        assert approved_data["reviewed_by"] is not None

        # 7. Now the newly approved MP can successfully log in!
        mp_login_res = client.post(
            "/api/v1/auth/login",
            json={"email": unapproved_email, "password": unapproved_pass},
        )
        assert mp_login_res.status_code == 200
        mp_token = mp_login_res.json()["access_token"]

        # Verify MP profile & jurisdiction
        mp_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {mp_token}"})
        assert mp_me.status_code == 200
        mp_user_info = mp_me.json()
        assert mp_user_info["role"] == "mp"
        assert "Supriya Sule" in mp_user_info["full_name"]
        assert mp_user_info["organization"]["constituency"] == "Baramati"


def test_mp_registration_rejection_flow():
    with TestClient(app) as client:
        test_suffix = uuid.uuid4().hex[:6]
        test_email = f"candidate.{test_suffix}@parliament.gov.in"
        # Submit invalid/spurious application
        payload = {
            "email": test_email,
            "password": "Password@123",
            "full_name": "Test Candidate",
            "phone_number": "9123456780",
            "dob": "1980-01-01",
            "gender": "Male",
            "father_or_spouse_name": "Test Parent",
            "permanent_address": "Test Street, New Delhi",
            "house": "Lok Sabha",
            "state": "Delhi",
            "constituency": "New Delhi",
            "political_party": "Independent",
            "term_label": "18th Lok Sabha",
            "voter_id": f"DL{test_suffix.upper()}",
            "driving_license_no": "DL01 20000001234",
            "winning_certificate_no": "INVALID-FORM-000",
            "winning_date": "2024-06-04",
            "community_certificate_no": "COMM-000-TEST",
            "community_category": "General",
            "birth_certificate_no": "BIRTH-000-TEST",
            "pan_number": "ABCDE1234F",
            "aadhaar_number": "123456789012",
            "immovable_properties": [],
            "movable_assets": {},
            "total_assets_lakh": 0.0,
            "liabilities_lakh": 0.0,
            "bank_name": "State Bank of India",
            "bank_account_number": "12345678901",
            "bank_ifsc": "SBIN0000691",
        }
        res = client.post("/api/v1/auth/mp-registration", json=payload)
        assert res.status_code == 201
        req_id = res.json()["id"]

        # Ministry rejects
        ministry_token = login(client, "ministry@sentinel.gov.in")
        headers = {"Authorization": f"Bearer {ministry_token}"}
        reject_res = client.post(
            f"/api/v1/ministry/mp-registrations/{req_id}/reject",
            headers=headers,
            json={"reason": "Winning certificate is invalid and cannot be reconciled with ECI database."},
        )
        assert reject_res.status_code == 200
        assert reject_res.json()["status"] == "rejected"
        assert "cannot be reconciled" in reject_res.json()["rejection_reason"]

        # Login with rejected candidate fails
        login_res = client.post(
            "/api/v1/auth/login",
            json={"email": test_email, "password": "Password@123"},
        )
        assert login_res.status_code == 401
