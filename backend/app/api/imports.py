from __future__ import annotations

import csv
import io
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..audit import record_event
from ..database import get_db
from ..dependencies import apply_project_scope, require_roles
from ..models import Project, Role, User
from ..schemas import ImportValidationOut


router = APIRouter(prefix="/imports", tags=["secure data import"])

MAX_UPLOAD_BYTES = 1_000_000
MAX_IMPORT_ROWS = 500
REQUIRED_COLUMNS = {"project_id", "spent_lakh", "physical_progress", "evidence_at"}


def parse_iso_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed


@router.post("/progress", response_model=ImportValidationOut)
async def import_progress(
    file: UploadFile = File(...),
    commit: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: User = Depends(require_roles(Role.MINISTRY, Role.STATE, Role.DISTRICT)),
) -> ImportValidationOut:
    filename = (file.filename or "").lower()
    if not filename.endswith(".csv"):
        raise HTTPException(status_code=415, detail="Only UTF-8 CSV files are accepted")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="CSV exceeds the 1 MB import limit")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="CSV must use UTF-8 encoding") from exc
    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    if set(headers) != REQUIRED_COLUMNS or len(headers) != len(REQUIRED_COLUMNS):
        raise HTTPException(status_code=422, detail="CSV must contain only: project_id, spent_lakh, physical_progress, evidence_at")
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=422, detail="CSV contains no data rows")
    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=413, detail="CSV exceeds the 500-row import limit")
    scoped_projects = {project.id: project for project in db.scalars(apply_project_scope(select(Project), user)).all()}
    validated: list[tuple[Project, float, int, datetime]] = []
    errors: list[dict[str, str]] = []
    for row_number, row in enumerate(rows, start=2):
        try:
            project = scoped_projects.get((row.get("project_id") or "").strip())
            if not project:
                raise ValueError("Project is not available within your authorized scope")
            spent_lakh = float(row.get("spent_lakh") or "")
            progress = int(row.get("physical_progress") or "")
            evidence_at = parse_iso_datetime(row.get("evidence_at") or "")
            if spent_lakh < project.spent_lakh or spent_lakh > project.sanctioned_lakh:
                raise ValueError("Expenditure must not decrease or exceed the sanctioned value")
            if progress < project.physical_progress or not 0 <= progress <= 100:
                raise ValueError("Physical progress must not decrease and must be between 0 and 100")
            if evidence_at > datetime.now(timezone.utc) or evidence_at.date() < project.sanction_date:
                raise ValueError("Evidence date is outside the permitted project period")
            validated.append((project, spent_lakh, progress, evidence_at))
        except (TypeError, ValueError):
            errors.append({"row": str(row_number), "message": "Row has invalid or unauthorized progress data"})
    if errors:
        return ImportValidationOut(dry_run=not commit, rows_received=len(rows), valid_rows=len(validated), invalid_rows=len(errors), applied_rows=0, errors=errors[:50])
    if commit:
        for project, spent_lakh, progress, evidence_at in validated:
            project.spent_lakh = spent_lakh
            project.physical_progress = progress
            project.last_evidence_at = evidence_at
        record_event(db, action="import.progress", entity_type="project_progress", actor_id=user.id, details={"rows": len(validated), "filename": filename})
        db.commit()
    return ImportValidationOut(dry_run=not commit, rows_received=len(rows), valid_rows=len(validated), invalid_rows=0, applied_rows=len(validated) if commit else 0, errors=[])
