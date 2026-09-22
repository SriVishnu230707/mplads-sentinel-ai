from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record_event
from ..database import get_db
from ..dependencies import require_roles
from ..models import (
    MPRegistrationRequest,
    MPRegistrationStatus,
    OrgLevel,
    Organization,
    Role,
    User,
)
from ..schemas import MPApprovalAction, MPRegistrationOut, MPRejectionAction

router = APIRouter(
    prefix="/ministry/mp-registrations",
    tags=["ministry_mp_approvals"],
    dependencies=[Depends(require_roles(Role.MINISTRY))],
)


@router.get("", response_model=list[MPRegistrationOut])
def list_mp_registrations(
    status_filter: str | None = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
) -> list[MPRegistrationRequest]:
    stmt = select(MPRegistrationRequest).order_by(MPRegistrationRequest.created_at.desc())
    if status_filter and status_filter.lower() != "all":
        try:
            target_status = MPRegistrationStatus(status_filter.lower())
            stmt = stmt.where(MPRegistrationRequest.status == target_status)
        except ValueError:
            pass
    return list(db.scalars(stmt).all())


@router.get("/{request_id}", response_model=MPRegistrationOut)
def get_mp_registration_dossier(
    request_id: str,
    db: Session = Depends(get_db),
) -> MPRegistrationRequest:
    record = db.get(MPRegistrationRequest, request_id)
    if not record:
        raise HTTPException(status_code=404, detail="MP registration dossier not found")
    return record


@router.post("/{request_id}/approve", response_model=MPRegistrationOut)
def approve_mp_registration(
    request_id: str,
    payload: MPApprovalAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.MINISTRY)),
) -> MPRegistrationRequest:
    record = db.get(MPRegistrationRequest, request_id)
    if not record:
        raise HTTPException(status_code=404, detail="MP registration application not found")
    if record.status != MPRegistrationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Application cannot be approved because its current status is {record.status.value}",
        )

    # Ensure no active user has this email
    existing_user = db.scalar(select(User).where(User.email == record.email))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user account with this official email already exists in Sentinel AI",
        )

    now = datetime.now(timezone.utc)

    # 1. Resolve or provision the Constituency Organization
    org_name = f"Office of Hon'ble MP - {record.constituency}"
    org = db.scalar(select(Organization).where(Organization.name == org_name))
    if not org:
        # Find parent organization (state or national)
        parent_org = db.scalar(
            select(Organization).where(
                Organization.state == record.state, Organization.level == OrgLevel.STATE
            )
        )
        parent_id = parent_org.id if parent_org else current_user.organization_id
        org = Organization(
            name=org_name,
            level=OrgLevel.DISTRICT,
            state=record.state,
            district=record.constituency,
            constituency=record.constituency,
            parent_id=parent_id,
            is_active=True,
        )
        db.add(org)
        db.flush()
    else:
        org.is_active = True
        org.constituency = record.constituency
        if record.state and not org.state:
            org.state = record.state

    # 2. Provision the MP User account
    mp_user = User(
        email=record.email,
        full_name=f"{record.full_name} (Hon'ble MP)",
        password_hash=record.password_hash,
        role=Role.MP,
        organization_id=org.id,
        is_active=True,
        pan_number=record.pan_number,
        aadhaar_number=record.aadhaar_number,
        bank_name=record.bank_name,
        bank_account_number=record.bank_account_number,
        bank_ifsc=record.bank_ifsc,
        pfms_code=record.pfms_code,
        biometric_enrolled=True,
        biometric_device_id="UIDAI-L0-SECUGEN-HAMSTERPRO",
        biometric_enrolled_at=now,
    )
    db.add(mp_user)

    # 3. Update application status
    record.status = MPRegistrationStatus.APPROVED
    record.reviewed_at = now
    record.reviewed_by = current_user.id
    record.reviewer_remarks = payload.remarks or "Approved by Ministry of Statistics & PI"

    # 4. Audit trail
    record_event(
        db,
        action="auth.mp_registration_approved",
        entity_type="mp_registration",
        entity_id=record.id,
        actor_id=current_user.id,
        details={
            "approved_by_email": current_user.email,
            "mp_email": record.email,
            "constituency": record.constituency,
            "state": record.state,
            "voter_id": record.voter_id,
            "winning_certificate_no": record.winning_certificate_no,
        },
    )

    db.commit()
    db.refresh(record)
    return record


@router.post("/{request_id}/reject", response_model=MPRegistrationOut)
def reject_mp_registration(
    request_id: str,
    payload: MPRejectionAction,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(Role.MINISTRY)),
) -> MPRegistrationRequest:
    record = db.get(MPRegistrationRequest, request_id)
    if not record:
        raise HTTPException(status_code=404, detail="MP registration application not found")
    if record.status != MPRegistrationStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Application cannot be rejected because its current status is {record.status.value}",
        )

    now = datetime.now(timezone.utc)
    record.status = MPRegistrationStatus.REJECTED
    record.reviewed_at = now
    record.reviewed_by = current_user.id
    record.rejection_reason = payload.reason
    record.reviewer_remarks = payload.remarks

    record_event(
        db,
        action="auth.mp_registration_rejected",
        entity_type="mp_registration",
        entity_id=record.id,
        actor_id=current_user.id,
        details={
            "rejected_by_email": current_user.email,
            "mp_email": record.email,
            "reason": payload.reason,
            "constituency": record.constituency,
        },
    )

    db.commit()
    db.refresh(record)
    return record
