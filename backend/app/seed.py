from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .intelligence import snapshot
from .models import OrgLevel, Organization, Project, RiskSnapshot, Role, User
from .risk_engine import evaluate
from .security import hash_password, verify_password


DEMO_PASSWORD = "Sentinel@2026"


def seed_demo_data(db: Session) -> None:
    def ensure_organization(name: str, level: OrgLevel, *, state: str | None = None, district: str | None = None, constituency: str | None = None, parent_id: str | None = None) -> Organization:
        organization = db.scalar(select(Organization).where(Organization.name == name))
        if organization is None:
            organization = Organization(name=name, level=level, state=state, district=district, constituency=constituency, parent_id=parent_id)
            db.add(organization)
            db.flush()
        else:
            organization.constituency = constituency
        return organization

    national = ensure_organization("Ministry of Statistics and PI", OrgLevel.NATIONAL)
    karnataka = ensure_organization("Karnataka State Nodal Authority", OrgLevel.STATE, state="Karnataka", parent_id=national.id)
    bengaluru = ensure_organization("Bengaluru Rural District Authority", OrgLevel.DISTRICT, state="Karnataka", district="Bengaluru Rural", parent_id=karnataka.id)
    bengaluru_mp = ensure_organization("Office of Hon'ble MP - Bengaluru Rural", OrgLevel.DISTRICT, state="Karnataka", district="Bengaluru Rural", constituency="Bengaluru Rural", parent_id=karnataka.id)

    demo_users = [
        ("ministry@sentinel.gov.in", "Arun Kumar", Role.MINISTRY, national.id, "AAAPK1982A", "982345128891", "State Bank of India", "30291823901", "SBIN0000691", "PFMS-DEL-00918", "UIDAI-L0-MANTRA-MFS100"),
        ("state@sentinel.gov.in", "Meera Rao", Role.STATE, karnataka.id, "BBMPR7721B", "871239841029", "Canara Bank", "11029384756", "CNRB0000214", "PFMS-KA-04821", "UIDAI-L0-STARTEK-FM220"),
        ("district@sentinel.gov.in", "Ravi Shetty", Role.DISTRICT, bengaluru.id, "CCPRS3390C", "761928374610", "Karnataka Bank", "48291039481", "KARB0000108", "PFMS-BLR-09281", "UIDAI-L0-MORPHO-MSO1300"),
        ("auditor@sentinel.gov.in", "Nisha Verma", Role.AUDITOR, national.id, "DDNPV4481D", "652819403819", "Punjab National Bank", "29103948192", "PUNB0012900", "PFMS-AUD-00192", "UIDAI-L0-MANTRA-MFS100"),
        ("mp@sentinel.gov.in", "Dr. K. Sudhakar (Hon'ble MP)", Role.MP, bengaluru_mp.id, "EEKSK8892E", "541928371928", "State Bank of India (Parliament House)", "10029384719", "SBIN0000691", "PFMS-MP-00518", "UIDAI-L0-SECUGEN-HAMSTERPRO"),
    ]
    now = datetime.now(timezone.utc)
    for email, full_name, role, organization_id, pan, aadhaar, bank, acc, ifsc, pfms, device in demo_users:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            user = User(
                email=email, full_name=full_name, password_hash=hash_password(DEMO_PASSWORD),
                role=role, organization_id=organization_id,
                pan_number=pan, aadhaar_number=aadhaar, bank_name=bank,
                bank_account_number=acc, bank_ifsc=ifsc, pfms_code=pfms,
                biometric_enrolled=True, biometric_device_id=device,
                biometric_enrolled_at=now - timedelta(days=90),
            )
            db.add(user)
            continue

        credentials_repaired = not verify_password(DEMO_PASSWORD, user.password_hash)
        user.full_name = full_name
        user.role = role
        user.organization_id = organization_id
        user.is_active = True
        user.pan_number = pan
        user.aadhaar_number = aadhaar
        user.bank_name = bank
        user.bank_account_number = acc
        user.bank_ifsc = ifsc
        user.pfms_code = pfms
        user.biometric_enrolled = True
        user.biometric_device_id = device
        if not user.biometric_enrolled_at:
            user.biometric_enrolled_at = now - timedelta(days=90)
        if credentials_repaired:
            user.password_hash = hash_password(DEMO_PASSWORD)
            user.token_version += 1

    now = datetime.now(timezone.utc)
    projects = [
        Project(id="MPL-KA-24018", title="Rural Link Road Improvement", state="Karnataka", district="Bengaluru Rural", constituency="Bengaluru Rural", location="Devanahalli, Bengaluru Rural", category="Roads", agency="PWD Bengaluru Rural", vendor_name="Vishwa Infra Projects", sanctioned_lakh=58, spent_lakh=47.6, physical_progress=34, peer_median_lakh=43, sanction_date=date(2025, 5, 14), planned_completion_date=date(2026, 7, 31), last_evidence_at=now-timedelta(days=63), latitude=13.246, longitude=77.712),
        Project(id="MPL-KA-24019", title="Rural Link Road Upgradation", state="Karnataka", district="Bengaluru Rural", constituency="Bengaluru Rural", location="Channarayapatna, Bengaluru Rural", category="Roads", agency="PWD Bengaluru Rural", vendor_name="Vishwa Infra Projects", sanctioned_lakh=56, spent_lakh=31.4, physical_progress=58, peer_median_lakh=43, sanction_date=date(2025, 6, 8), planned_completion_date=date(2026, 10, 30), last_evidence_at=now-timedelta(days=18), latitude=13.268, longitude=77.728),
        Project(id="MPL-UP-23872", title="Community Health Centre Extension", state="Uttar Pradesh", district="Gorakhpur", constituency="Gorakhpur", location="Sadar, Gorakhpur", category="Health", agency="District Health Society", vendor_name="Shakti Buildwell", sanctioned_lakh=72, spent_lakh=54.2, physical_progress=49, peer_median_lakh=51, sanction_date=date(2025, 8, 2), planned_completion_date=date(2026, 12, 15), last_evidence_at=now-timedelta(days=26), latitude=26.760, longitude=83.373),
        Project(id="MPL-MH-24103", title="Government School Science Block", state="Maharashtra", district="Raigad", constituency="Raigad", location="Karjat, Raigad", category="Education", agency="Zilla Parishad Raigad", vendor_name="Konkan Civil Works", sanctioned_lakh=44, spent_lakh=26.8, physical_progress=52, peer_median_lakh=35, sanction_date=date(2025, 10, 18), planned_completion_date=date(2026, 11, 30), last_evidence_at=now-timedelta(days=46), latitude=18.910, longitude=73.323),
        Project(id="MPL-AS-23711", title="Solar Drinking Water Facility", state="Assam", district="Golaghat", constituency="Kaziranga", location="Bokakhat, Golaghat", category="Water", agency="PHE Golaghat", vendor_name="North East Water Systems", sanctioned_lakh=18, spent_lakh=15.4, physical_progress=67, peer_median_lakh=16, sanction_date=date(2025, 4, 7), planned_completion_date=date(2026, 8, 31), last_evidence_at=now-timedelta(days=51), latitude=26.640, longitude=93.600),
        Project(id="MPL-TN-24220", title="Community Learning Centre", state="Tamil Nadu", district="Chennai", constituency="Sriperumbudur", location="Ambattur, Chennai", category="Community", agency="Greater Chennai Corporation", vendor_name="Chola Engineering", sanctioned_lakh=36, spent_lakh=18.1, physical_progress=55, peer_median_lakh=34, sanction_date=date(2026, 1, 9), planned_completion_date=date(2027, 1, 31), last_evidence_at=now-timedelta(days=12), latitude=13.114, longitude=80.154),
    ]
    for project in projects:
        score, level, reasons = evaluate(project, now)
        project.risk_score = score
        project.risk_level = level
        project.risk_reasons = reasons
    for p in projects:
        existing_p = db.scalar(select(Project).where(Project.id == p.id))
        if existing_p:
            existing_p.constituency = p.constituency
    existing_project_ids = set(db.scalars(select(Project.id).where(Project.id.in_([project.id for project in projects]))).all())
    db.add_all(project for project in projects if project.id not in existing_project_ids)
    db.flush()
    existing_snapshot_ids = set(db.scalars(select(RiskSnapshot.project_id)).all())
    for project in projects:
        if project.id not in existing_snapshot_ids:
            db.add(snapshot(project, now - timedelta(days=60)))
            db.add(snapshot(project, now - timedelta(days=30)))
            db.add(snapshot(project, now))
    db.commit()
