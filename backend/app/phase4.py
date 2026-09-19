from __future__ import annotations

from datetime import datetime, timezone
from math import asin, cos, radians, sin, sqrt

from .models import Project


def haversine_km(latitude_a: float, longitude_a: float, latitude_b: float, longitude_b: float) -> float:
    radius_km = 6371.0
    delta_latitude = radians(latitude_b - latitude_a)
    delta_longitude = radians(longitude_b - longitude_a)
    value = sin(delta_latitude / 2) ** 2 + cos(radians(latitude_a)) * cos(radians(latitude_b)) * sin(delta_longitude / 2) ** 2
    return radius_km * 2 * asin(sqrt(value))


def delay_prediction(project: Project, now: datetime | None = None) -> tuple[int, str, list[str]]:
    """Deterministic early-warning score; it is not a fraud classifier."""
    now = now or datetime.now(timezone.utc)
    financial_progress = 0 if project.sanctioned_lakh <= 0 else round(project.spent_lakh / project.sanctioned_lakh * 100)
    days_to_completion = (project.planned_completion_date - now.date()).days
    score = 0
    factors: list[str] = []
    if days_to_completion < 0 and project.physical_progress < 100:
        score += 50
        factors.append(f"Work is {-days_to_completion} days past its planned completion date.")
    elif days_to_completion <= 60 and project.physical_progress < 75:
        score += 25
        factors.append(f"Only {days_to_completion} days remain with {project.physical_progress}% reported progress.")
    mismatch = financial_progress - project.physical_progress
    if mismatch >= 25:
        score += min(25, 10 + mismatch // 3)
        factors.append(f"Financial progress exceeds physical progress by {mismatch} percentage points.")
    if project.last_evidence_at:
        evidence_at = project.last_evidence_at.replace(tzinfo=timezone.utc) if project.last_evidence_at.tzinfo is None else project.last_evidence_at
        evidence_days = max(0, (now - evidence_at).days)
        if evidence_days >= 45:
            score += 15
            factors.append(f"Latest field evidence is {evidence_days} days old.")
    else:
        score += 15
        factors.append("No field evidence is recorded.")
    probability = min(95, score)
    confidence = "High" if len(factors) >= 3 else "Medium" if factors else "Low"
    return probability, confidence, factors or ["No current early-warning factor crossed the configured threshold."]
