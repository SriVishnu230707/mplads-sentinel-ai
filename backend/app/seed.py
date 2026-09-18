from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import OrgLevel, Organization, Project, Role, User
from .risk_engine import evaluate
from .security import hash_password


DEMO_PASSWORD = "Sentinel@2026"


def seed_demo_data(db: Session) -> None:
    if db.scalar(select(Organization.id).limit(1)):
        return

    national = Organization(name="Ministry of Statistics and PI", level=OrgLevel.NATIONAL)
    db.add(national)
    db.flush()
    karnataka = Organization(name="Karnataka State Nodal Authority", level=OrgLevel.STATE, state="Karnataka", parent_id=national.id)
    db.add(karnataka)
    db.flush()
    bengaluru = Organization(name="Bengaluru Rural District Authority", level=OrgLevel.DISTRICT, state="Karnataka", district="Bengaluru Rural", parent_id=karnataka.id)
    db.add(bengaluru)
    db.flush()

    users = [
        User(email="ministry@sentinel.gov.in", full_name="Arun Kumar", password_hash=hash_password(DEMO_PASSWORD), role=Role.MINISTRY, organization_id=national.id),
        User(email="state@sentinel.gov.in", full_name="Meera Rao", password_hash=hash_password(DEMO_PASSWORD), role=Role.STATE, organization_id=karnataka.id),
        User(email="district@sentinel.gov.in", full_name="Ravi Shetty", password_hash=hash_password(DEMO_PASSWORD), role=Role.DISTRICT, organization_id=bengaluru.id),
        User(email="auditor@sentinel.gov.in", full_name="Nisha Verma", password_hash=hash_password(DEMO_PASSWORD), role=Role.AUDITOR, organization_id=national.id),
    ]
    db.add_all(users)

    now = datetime.now(timezone.utc)
    projects = [
        Project(id="MPL-KA-24018", title="Rural Link Road Improvement", state="Karnataka", district="Bengaluru Rural", location="Devanahalli, Bengaluru Rural", category="Roads", agency="PWD Bengaluru Rural", vendor_name="Vishwa Infra Projects", sanctioned_lakh=58, spent_lakh=47.6, physical_progress=34, peer_median_lakh=43, sanction_date=date(2025, 5, 14), planned_completion_date=date(2026, 7, 31), last_evidence_at=now-timedelta(days=63), latitude=13.246, longitude=77.712),
        Project(id="MPL-UP-23872", title="Community Health Centre Extension", state="Uttar Pradesh", district="Gorakhpur", location="Sadar, Gorakhpur", category="Health", agency="District Health Society", vendor_name="Shakti Buildwell", sanctioned_lakh=72, spent_lakh=54.2, physical_progress=49, peer_median_lakh=51, sanction_date=date(2025, 8, 2), planned_completion_date=date(2026, 12, 15), last_evidence_at=now-timedelta(days=26), latitude=26.760, longitude=83.373),
        Project(id="MPL-MH-24103", title="Government School Science Block", state="Maharashtra", district="Raigad", location="Karjat, Raigad", category="Education", agency="Zilla Parishad Raigad", vendor_name="Konkan Civil Works", sanctioned_lakh=44, spent_lakh=26.8, physical_progress=52, peer_median_lakh=35, sanction_date=date(2025, 10, 18), planned_completion_date=date(2026, 11, 30), last_evidence_at=now-timedelta(days=46), latitude=18.910, longitude=73.323),
        Project(id="MPL-AS-23711", title="Solar Drinking Water Facility", state="Assam", district="Golaghat", location="Bokakhat, Golaghat", category="Water", agency="PHE Golaghat", vendor_name="North East Water Systems", sanctioned_lakh=18, spent_lakh=15.4, physical_progress=67, peer_median_lakh=16, sanction_date=date(2025, 4, 7), planned_completion_date=date(2026, 8, 31), last_evidence_at=now-timedelta(days=51), latitude=26.640, longitude=93.600),
        Project(id="MPL-TN-24220", title="Community Learning Centre", state="Tamil Nadu", district="Chennai", location="Ambattur, Chennai", category="Community", agency="Greater Chennai Corporation", vendor_name="Chola Engineering", sanctioned_lakh=36, spent_lakh=18.1, physical_progress=55, peer_median_lakh=34, sanction_date=date(2026, 1, 9), planned_completion_date=date(2027, 1, 31), last_evidence_at=now-timedelta(days=12), latitude=13.114, longitude=80.154),
    ]
    for project in projects:
        score, level, reasons = evaluate(project, now)
        project.risk_score = score
        project.risk_level = level
        project.risk_reasons = reasons
    db.add_all(projects)
    db.commit()
