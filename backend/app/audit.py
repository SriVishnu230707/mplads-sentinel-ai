import hashlib
import json
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AuditEvent


GENESIS_HASH = "0" * 64


def _event_hash(*, previous_hash: str, occurred_at: object, actor_id: str | None, action: str, entity_type: str, entity_id: str | None, outcome: str, details: dict) -> str:
    timestamp = occurred_at.replace(tzinfo=timezone.utc) if occurred_at.tzinfo is None else occurred_at
    payload = {
        "action": action,
        "actor_id": actor_id,
        "details": details,
        "entity_id": entity_id,
        "entity_type": entity_type,
        "occurred_at": timestamp.isoformat(),
        "outcome": outcome,
        "previous_hash": previous_hash,
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


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
    previous = db.scalar(select(AuditEvent).order_by(AuditEvent.occurred_at.desc(), AuditEvent.id.desc()).limit(1))
    previous_hash = (previous.details or {}).get("_integrity", {}).get("hash", GENESIS_HASH) if previous else GENESIS_HASH
    occurred_at = datetime.now(timezone.utc)
    event_details = dict(details or {})
    digest = _event_hash(
        previous_hash=previous_hash,
        occurred_at=occurred_at,
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        outcome=outcome,
        details=event_details,
    )
    event_details["_integrity"] = {"previous_hash": previous_hash, "hash": digest, "scheme": "sha256-chain-v1"}
    db.add(AuditEvent(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        outcome=outcome,
        details=event_details,
        occurred_at=occurred_at,
    ))


def verify_chain(db: Session) -> dict[str, int | bool]:
    """Verify events written after the hash-chain hardening was enabled."""
    events = list(db.scalars(select(AuditEvent).order_by(AuditEvent.occurred_at, AuditEvent.id)).all())
    previous_hash = GENESIS_HASH
    verified = 0
    legacy = 0
    for event in events:
        event_details = dict(event.details or {})
        integrity = event_details.pop("_integrity", None)
        if not integrity:
            legacy += 1
            continue
        expected = _event_hash(
            previous_hash=previous_hash,
            occurred_at=event.occurred_at,
            actor_id=event.actor_id,
            action=event.action,
            entity_type=event.entity_type,
            entity_id=event.entity_id,
            outcome=event.outcome,
            details=event_details,
        )
        if integrity.get("previous_hash") != previous_hash or integrity.get("hash") != expected:
            return {"valid": False, "verified_events": verified, "legacy_events": legacy}
        previous_hash = expected
        verified += 1
    return {"valid": True, "verified_events": verified, "legacy_events": legacy}

