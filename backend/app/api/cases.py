from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import record_event
from ..database import get_db
from ..dependencies import apply_project_scope, require_roles
from ..models import Alert, AlertStatus, CaseStatus, InvestigationCase, Project, Role, User
from ..schemas import CaseCreate, CaseOut, CaseUpdate

router = APIRouter(prefix="/cases", tags=["investigations"])
REVIEWERS = {Role.MINISTRY, Role.STATE, Role.DISTRICT, Role.AUDITOR, Role.MP}


@router.get("", response_model=list[CaseOut])
def list_cases(db: Session = Depends(get_db), user: User = Depends(require_roles(*REVIEWERS))) -> list[InvestigationCase]:
    project_ids = apply_project_scope(select(Project.id), user)
    return list(db.scalars(select(InvestigationCase).where(InvestigationCase.project_id.in_(project_ids)).order_by(InvestigationCase.updated_at.desc())).all())


@router.post("", response_model=CaseOut, status_code=201)
def create_case(payload: CaseCreate, db: Session = Depends(get_db), user: User = Depends(require_roles(*REVIEWERS))) -> InvestigationCase:
    project_ids = apply_project_scope(select(Project.id), user)
    alert = db.scalar(select(Alert).where(Alert.id == payload.alert_id, Alert.project_id.in_(project_ids)))
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.status not in {AlertStatus.OPEN, AlertStatus.TRIAGED}:
        raise HTTPException(status_code=409, detail="Only active alerts can create an investigation case")
    # Assignment is deliberately fixed to the creator in this MVP. An owner
    # picker requires a separate, scope-checked delegation workflow.
    case = InvestigationCase(alert_id=alert.id, project_id=alert.project_id, title=alert.title, priority=alert.severity, owner_id=user.id, created_by=user.id)
    try:
        db.add(case); db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="An investigation case already exists for this alert") from exc
    record_event(db, action="case.create", entity_type="investigation_case", entity_id=case.id, actor_id=user.id, details={"alert_id": alert.id})
    db.commit(); db.refresh(case)
    return case


@router.patch("/{case_id}", response_model=CaseOut)
def update_case(case_id: str, payload: CaseUpdate, db: Session = Depends(get_db), user: User = Depends(require_roles(*REVIEWERS))) -> InvestigationCase:
    project_ids = apply_project_scope(select(Project.id), user)
    case = db.scalar(select(InvestigationCase).where(InvestigationCase.id == case_id, InvestigationCase.project_id.in_(project_ids)))
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    transitions = {CaseStatus.OPEN: {CaseStatus.INVESTIGATING}, CaseStatus.INVESTIGATING: {CaseStatus.CLOSURE_REVIEW}, CaseStatus.CLOSURE_REVIEW: {CaseStatus.CLOSED}}
    if payload.status not in transitions.get(case.status, set()):
        raise HTTPException(status_code=409, detail="This case status transition is not allowed")
    if payload.status == CaseStatus.CLOSED:
        if user.role not in {Role.MINISTRY, Role.AUDITOR} or user.id == case.created_by:
            raise HTTPException(status_code=403, detail="An independent Ministry or Auditor reviewer must close this case")
        if not payload.closure_note or not payload.closure_note.strip():
            raise HTTPException(status_code=422, detail="A closure note is required before closing a case")
        case.closed_by, case.closure_note = user.id, payload.closure_note
    case.status = payload.status
    record_event(db, action="case.update", entity_type="investigation_case", entity_id=case.id, actor_id=user.id, details={"status": payload.status.value})
    db.commit(); db.refresh(case)
    return case
