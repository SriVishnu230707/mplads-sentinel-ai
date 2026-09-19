from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..audit import record_event
from ..database import get_db
from ..dependencies import apply_project_scope, get_current_user, require_roles
from ..models import Alert, AlertStatus, Project, RiskLevel, Role, User
from ..risk_engine import evaluate
from ..rate_limit import scan_limiter
from ..schemas import AlertOut, ScanResult


router = APIRouter(tags=["risk intelligence"])


@router.get("/alerts", response_model=list[AlertOut])
def list_alerts(
    status: AlertStatus | None = None,
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Alert]:
    project_ids = apply_project_scope(select(Project.id), user)
    query = select(Alert).where(Alert.project_id.in_(project_ids))
    if status:
        query = query.where(Alert.status == status)
    return list(db.scalars(query.order_by(Alert.score.desc()).limit(limit)).all())


@router.post("/risk/scan", response_model=ScanResult)
def scan_projects(
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.MINISTRY, Role.STATE, Role.DISTRICT, Role.AUDITOR)),
) -> ScanResult:
    if not scan_limiter.allowed(f"scan:{user.id}"):
        raise HTTPException(status_code=429, detail="Risk scan limit reached; try again later")
    projects = list(db.scalars(apply_project_scope(select(Project), user)).all())
    created = 0
    updated = 0
    for project in projects:
        score, level, reasons = evaluate(project)
        if score != project.risk_score or reasons != project.risk_reasons:
            project.risk_score, project.risk_level, project.risk_reasons = score, level, reasons
            project.version += 1
            updated += 1
        existing = set(db.scalars(select(Alert.rule_code).where(Alert.project_id == project.id, Alert.status == AlertStatus.OPEN)).all())
        for reason in reasons:
            if reason["rule_code"] in existing:
                continue
            severity = RiskLevel.HIGH if reason["score"] >= 20 else RiskLevel.MODERATE
            # The database uniqueness constraint remains authoritative during
            # concurrent scans. A savepoint avoids rolling back the whole scan.
            try:
                with db.begin_nested():
                    db.add(Alert(project_id=project.id, rule_code=reason["rule_code"], title=reason["label"], explanation=reason["explanation"], severity=severity, score=reason["score"], confidence=reason["confidence"], recommended_action=reason["recommended_action"], evidence={"project_version": project.version}))
                    db.flush()
                    created += 1
            except IntegrityError:
                continue
    record_event(db, action="risk.scan", entity_type="project_portfolio", actor_id=user.id, details={"projects": len(projects), "alerts_created": created})
    db.commit()
    return ScanResult(projects_scanned=len(projects), alerts_created=created, scores_updated=updated)
