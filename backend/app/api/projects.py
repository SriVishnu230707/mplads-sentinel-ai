from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import apply_project_scope, get_current_user
from ..intelligence import compliance_items, duplicate_candidates, health_summary
from ..models import Project, RiskSnapshot, User
from ..schemas import ProjectIntelligenceOut, ProjectOut


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
