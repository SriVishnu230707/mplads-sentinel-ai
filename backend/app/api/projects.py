from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..audit import record_event
from ..database import get_db
from ..dependencies import apply_project_scope, get_current_user
from ..intelligence import compliance_items, duplicate_candidates, health_summary
from ..models import InspectionEvidence, Project, RiskSnapshot, Role, User
from ..phase4 import delay_prediction, haversine_km
from ..schemas import DelayPredictionOut, EvidenceCreate, EvidenceOut, ProjectIntelligenceOut, ProjectOut


router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
def list_projects(
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Project]:
    query = apply_project_scope(select(Project), user)
    if search:
        term = f"%{search.strip().lower()}%"
        query = query.where(or_(func.lower(Project.id).like(term), func.lower(Project.title).like(term), func.lower(Project.district).like(term), func.lower(Project.agency).like(term)))
    return list(db.scalars(query.order_by(Project.risk_score.desc()).offset(offset).limit(limit)).all())


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Project:
    project = db.scalar(apply_project_scope(select(Project).where(Project.id == project_id), user))
    if not project:
        # Return 404 for both absent and out-of-scope records to avoid existence disclosure.
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/intelligence", response_model=ProjectIntelligenceOut)
def get_project_intelligence(project_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> ProjectIntelligenceOut:
    project = db.scalar(apply_project_scope(select(Project).where(Project.id == project_id), user))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    peers = list(db.scalars(apply_project_scope(select(Project), user)).all())
    history = list(db.scalars(select(RiskSnapshot).where(RiskSnapshot.project_id == project.id).order_by(RiskSnapshot.recorded_at.desc()).limit(12)).all())
    health_score, health_band = health_summary(project)
    return ProjectIntelligenceOut(
        project_id=project.id,
        health_score=health_score,
        health_band=health_band,
        compliance=compliance_items(project),
        duplicate_candidates=duplicate_candidates(project, peers),
        risk_timeline=list(reversed(history)),
    )


@router.get("/{project_id}/delay-prediction", response_model=DelayPredictionOut)
def get_delay_prediction(project_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> DelayPredictionOut:
    project = db.scalar(apply_project_scope(select(Project).where(Project.id == project_id), user))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    probability, confidence, factors = delay_prediction(project)
    return DelayPredictionOut(
        project_id=project.id,
        delay_probability=probability,
        confidence=confidence,
        factors=factors,
        disclaimer="Early-warning estimate only. It requires human verification and is not a finding of fraud or non-compliance.",
    )


@router.post("/{project_id}/evidence", response_model=EvidenceOut, status_code=201)
def submit_evidence(
    project_id: str,
    payload: EvidenceCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InspectionEvidence:
    if user.role not in {Role.MINISTRY, Role.STATE, Role.DISTRICT, Role.FIELD_OFFICER}:
        raise HTTPException(status_code=403, detail="Your role cannot submit field evidence")
    project = db.scalar(apply_project_scope(select(Project).where(Project.id == project_id), user))
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    captured_at = payload.captured_at.replace(tzinfo=timezone.utc) if payload.captured_at.tzinfo is None else payload.captured_at
    now = datetime.now(timezone.utc)
    if captured_at > now:
        raise HTTPException(status_code=422, detail="Evidence capture time cannot be in the future")
    if captured_at.date() < project.sanction_date:
        raise HTTPException(status_code=422, detail="Evidence cannot predate the project sanction")
    if payload.reported_progress < project.physical_progress:
        raise HTTPException(status_code=409, detail="Reported progress cannot decrease through this evidence workflow")
    if project.latitude is None or project.longitude is None:
        raise HTTPException(status_code=409, detail="Project coordinates are required before evidence can be verified")
    distance_km = haversine_km(project.latitude, project.longitude, payload.latitude, payload.longitude)
    if distance_km > 2:
        raise HTTPException(status_code=422, detail="Evidence location is outside the 2 km verification radius")
    evidence = InspectionEvidence(
        project_id=project.id,
        submitted_by=user.id,
        captured_at=captured_at,
        latitude=payload.latitude,
        longitude=payload.longitude,
        reported_progress=payload.reported_progress,
        remarks=payload.remarks.strip(),
        distance_from_project_km=round(distance_km, 3),
    )
    project.last_evidence_at = captured_at
    project.physical_progress = payload.reported_progress
    db.add(evidence)
    db.flush()
    record_event(
        db,
        action="evidence.submit",
        entity_type="inspection_evidence",
        entity_id=evidence.id,
        actor_id=user.id,
        details={"project_id": project.id, "distance_km": round(distance_km, 3)},
    )
    db.commit()
    db.refresh(evidence)
    return evidence
