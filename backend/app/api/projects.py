from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import apply_project_scope, get_current_user
from ..models import Project, User
from ..schemas import ProjectOut


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

