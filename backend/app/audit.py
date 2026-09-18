from sqlalchemy.orm import Session

from .models import AuditEvent


def record_event(
    db: Session,
    *,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    actor_id: str | None = None,
    outcome: str = "success",
    details: dict | None = None,
) -> None:
    db.add(AuditEvent(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        outcome=outcome,
        details=details or {},
    ))

