import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record_event
from ..database import get_db
from ..dependencies import apply_project_scope, get_current_user
from ..models import Project, User

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/portfolio.csv")
def portfolio_csv(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> StreamingResponse:
    projects = list(db.scalars(apply_project_scope(select(Project), user).order_by(Project.id)).all())
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(["Report ID", "Project ID", "Title", "State", "District", "Risk score", "Risk level", "Sanctioned lakh", "Spent lakh", "Progress percent", "Generated for"])
    report_id = f"MPLADS-{user.id[:8]}-{len(projects)}"
    for project in projects:
        writer.writerow([report_id, project.id, project.title, project.state, project.district, project.risk_score, project.risk_level.value, project.sanctioned_lakh, project.spent_lakh, project.physical_progress, user.email])
    record_event(db, action="report.export", entity_type="portfolio_csv", actor_id=user.id, details={"report_id": report_id, "rows": len(projects)})
    db.commit()
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{report_id}.csv"', "X-Report-ID": report_id})
