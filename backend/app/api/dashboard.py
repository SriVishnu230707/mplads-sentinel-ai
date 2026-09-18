from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import apply_project_scope, get_current_user
from ..models import Alert, AlertStatus, Project, RiskLevel, User
from ..schemas import DashboardSummary


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> DashboardSummary:
    scoped_ids = apply_project_scope(select(Project.id), user)
    projects = list(db.scalars(apply_project_scope(select(Project), user)).all())
    risk_distribution = {level.value: 0 for level in RiskLevel}
    for project in projects:
        risk_distribution[project.risk_level.value] += 1
    open_alerts = db.scalar(select(func.count(Alert.id)).where(Alert.project_id.in_(scoped_ids), Alert.status == AlertStatus.OPEN)) or 0
    return DashboardSummary(
        active_works=sum(project.status == "in_progress" for project in projects),
        sanctioned_lakh=round(sum(project.sanctioned_lakh for project in projects), 2),
        expenditure_lakh=round(sum(project.spent_lakh for project in projects), 2),
        high_risk_works=sum(project.risk_level in {RiskLevel.CRITICAL, RiskLevel.HIGH} for project in projects),
        open_alerts=open_alerts,
        delayed_works=sum(project.planned_completion_date < date.today() and project.physical_progress < 100 for project in projects),
        risk_distribution=risk_distribution,
    )

