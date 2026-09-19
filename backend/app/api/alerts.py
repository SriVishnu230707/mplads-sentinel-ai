from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record_event
from ..database import get_db
from ..dependencies import apply_project_scope, get_current_user, require_roles
from ..intelligence import snapshot
from ..models import Alert, AlertStatus, Project, RiskLevel, Role, User
from ..risk_engine import evaluate
from ..rate_limit import RateLimitUnavailable, scan_limiter
from ..schemas import AlertOut, AlertReviewRequest, ScanResult


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
    try:
        allowed = scan_limiter.allow(f"risk-scan:{user.id}")
    except RateLimitUnavailable as exc:
        raise HTTPException(status_code=503, detail="Risk scanning is temporarily unavailable") from exc
    if not allowed:
        raise HTTPException(status_code=429, detail="Risk scan limit reached; try again later")
    projects = list(db.scalars(apply_project_scope(select(Project), user)).all())
    created = 0
    updated = 0
    for project in projects:
        score, level, reasons = evaluate(project)
        if score != project.risk_score or reasons != project.risk_reasons:
            project.risk_score, project.risk_level, project.risk_reasons = score, level, reasons
            project.version += 1
            db.add(snapshot(project))
            updated += 1
        existing = set(db.scalars(
            select(Alert.rule_code).where(
                Alert.project_id == project.id,
                Alert.status.in_([AlertStatus.OPEN, AlertStatus.TRIAGED]),
            )
        ).all())
        for reason in reasons:
            if reason["rule_code"] in existing:
                continue
            severity = RiskLevel.HIGH if reason["score"] >= 20 else RiskLevel.MODERATE
            db.add(Alert(project_id=project.id, rule_code=reason["rule_code"], title=reason["label"], explanation=reason["explanation"], severity=severity, score=reason["score"], confidence=reason["confidence"], recommended_action=reason["recommended_action"], evidence={"project_version": project.version}))
            created += 1
    record_event(db, action="risk.scan", entity_type="project_portfolio", actor_id=user.id, details={"projects": len(projects), "alerts_created": created})
    db.commit()
    return ScanResult(projects_scanned=len(projects), alerts_created=created, scores_updated=updated)


@router.patch("/alerts/{alert_id}", response_model=AlertOut)
def update_alert_status(
    alert_id: str,
    payload: AlertReviewRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.MINISTRY, Role.STATE, Role.DISTRICT, Role.AUDITOR)),
) -> Alert:
    scoped_project_ids = apply_project_scope(select(Project.id), user)
    alert = db.scalar(select(Alert).where(Alert.id == alert_id, Alert.project_id.in_(scoped_project_ids)))
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    allowed_transitions = {
        AlertStatus.OPEN: {AlertStatus.TRIAGED},
        AlertStatus.TRIAGED: {AlertStatus.RESOLVED, AlertStatus.DISMISSED},
    }
    if payload.status not in allowed_transitions.get(alert.status, set()):
        raise HTTPException(status_code=409, detail="This alert status transition is not allowed")
    if payload.status in {AlertStatus.RESOLVED, AlertStatus.DISMISSED} and user.role not in {Role.MINISTRY, Role.AUDITOR}:
        raise HTTPException(status_code=403, detail="Only Ministry or Auditor roles can close an alert")
    duplicate = db.scalar(select(Alert).where(
        Alert.project_id == alert.project_id,
        Alert.rule_code == alert.rule_code,
        Alert.status == payload.status,
        Alert.id != alert.id,
    ))
    if duplicate:
        # Older prototype versions allowed one open and one triaged row for the
        # same rule. Keep the more advanced review state and remove only the
        # obsolete duplicate, while retaining a trace in the audit log.
        db.delete(alert)
        record_event(
            db,
            action="alert.deduplicated",
            entity_type="alert",
            entity_id=duplicate.id,
            actor_id=user.id,
            details={"removed_alert_id": alert.id, "status": payload.status.value},
        )
        db.commit()
        db.refresh(duplicate)
        return duplicate
    alert.status = payload.status
    record_event(db, action="alert.review", entity_type="alert", entity_id=alert.id, actor_id=user.id, details={"status": payload.status.value})
    db.commit()
    db.refresh(alert)
    return alert
