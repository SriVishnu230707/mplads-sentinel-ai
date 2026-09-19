from __future__ import annotations

from datetime import datetime, timezone
from difflib import SequenceMatcher
from math import sqrt

from .models import Project, RiskSnapshot


def compliance_items(project: Project, now: datetime | None = None) -> list[dict[str, str]]:
    now = now or datetime.now(timezone.utc)
    financial_progress = 0 if project.sanctioned_lakh <= 0 else round(project.spent_lakh / project.sanctioned_lakh * 100)
    evidence_age = None
    if project.last_evidence_at:
        evidence_at = project.last_evidence_at.replace(tzinfo=timezone.utc) if project.last_evidence_at.tzinfo is None else project.last_evidence_at
        evidence_age = max(0, (now - evidence_at).days)

    return [
        {
            "label": "Payment aligned with physical progress",
            "status": "attention" if financial_progress - project.physical_progress >= 25 else "met",
            "detail": f"{financial_progress}% spent against {project.physical_progress}% reported progress.",
        },
        {
            "label": "Current field evidence available",
            "status": "overdue" if evidence_age is None or evidence_age >= 45 else "met",
            "detail": "No field evidence recorded." if evidence_age is None else f"Latest evidence is {evidence_age} days old.",
        },
        {
            "label": "Planned completion on track",
            "status": "overdue" if project.planned_completion_date < now.date() and project.physical_progress < 100 else "met",
            "detail": f"Planned completion: {project.planned_completion_date.isoformat()} · progress: {project.physical_progress}%.",
        },
        {
            "label": "Expenditure within sanctioned value",
            "status": "attention" if project.spent_lakh > project.sanctioned_lakh else "met",
            "detail": f"₹{project.spent_lakh:.1f} lakh spent of ₹{project.sanctioned_lakh:.1f} lakh sanctioned.",
        },
    ]


def duplicate_candidates(project: Project, peers: list[Project]) -> list[dict]:
    candidates: list[dict] = []
    for peer in peers:
        if peer.id == project.id or peer.category != project.category:
            continue
        title_similarity = SequenceMatcher(None, project.title.casefold(), peer.title.casefold()).ratio()
        cost_similarity = 1 - min(1, abs(project.sanctioned_lakh - peer.sanctioned_lakh) / max(project.sanctioned_lakh, peer.sanctioned_lakh, 1))
        distance_km = None
        location_similarity = 0.0
        if None not in (project.latitude, project.longitude, peer.latitude, peer.longitude):
            distance_km = sqrt((project.latitude - peer.latitude) ** 2 + (project.longitude - peer.longitude) ** 2) * 111
            location_similarity = max(0, 1 - distance_km / 10)
        score = round(100 * (title_similarity * 0.55 + cost_similarity * 0.2 + location_similarity * 0.25))
        if project.vendor_name and project.vendor_name == peer.vendor_name:
            score = min(100, score + 8)
        if score < 60:
            continue
        reasons = [f"{round(title_similarity * 100)}% title similarity", f"{round(cost_similarity * 100)}% cost similarity"]
        if distance_km is not None:
            reasons.append(f"{distance_km:.1f} km apart")
        if project.vendor_name and project.vendor_name == peer.vendor_name:
            reasons.append("Same implementing vendor")
        candidates.append({"project_id": peer.id, "title": peer.title, "location": peer.location, "similarity_score": score, "reasons": reasons})
    return sorted(candidates, key=lambda item: item["similarity_score"], reverse=True)[:5]


def health_summary(project: Project) -> tuple[int, str]:
    health_score = max(0, 100 - project.risk_score)
    if health_score >= 75:
        return health_score, "Healthy"
    if health_score >= 50:
        return health_score, "Watch"
    return health_score, "Needs attention"


def snapshot(project: Project, recorded_at: datetime | None = None) -> RiskSnapshot:
    return RiskSnapshot(
        project_id=project.id,
        score=project.risk_score,
        level=project.risk_level,
        reasons=project.risk_reasons,
        recorded_at=recorded_at or datetime.now(timezone.utc),
    )
