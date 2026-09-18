from dataclasses import asdict, dataclass
from datetime import datetime, timezone

from .models import Project, RiskLevel


@dataclass
class Finding:
    rule_code: str
    label: str
    score: int
    confidence: int
    explanation: str
    recommended_action: str


def risk_level(score: int) -> RiskLevel:
    if score >= 80:
        return RiskLevel.CRITICAL
    if score >= 60:
        return RiskLevel.HIGH
    if score >= 35:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def evaluate(project: Project, now: datetime | None = None) -> tuple[int, RiskLevel, list[dict]]:
    now = now or datetime.now(timezone.utc)
    findings: list[Finding] = []
    financial_progress = 0 if project.sanctioned_lakh <= 0 else round(project.spent_lakh / project.sanctioned_lakh * 100)
    mismatch = financial_progress - project.physical_progress

    if mismatch >= 25 and financial_progress >= 50:
        points = min(38, 18 + mismatch // 3)
        findings.append(Finding(
            "FIN_PHYSICAL_MISMATCH", "Payment–progress mismatch", points, 94,
            f"{financial_progress}% of sanctioned value is spent while reported physical progress is {project.physical_progress}%.",
            "Verify measurements, invoices and the latest geo-tagged field evidence before further payment.",
        ))

    if project.peer_median_lakh and project.peer_median_lakh > 0:
        deviation = round((project.sanctioned_lakh - project.peer_median_lakh) / project.peer_median_lakh * 100)
        if deviation >= 25:
            findings.append(Finding(
                "COST_BENCHMARK_OUTLIER", "Cost benchmark deviation", min(27, 12 + deviation // 5), 82,
                f"Sanctioned cost is {deviation}% above the median for comparable works.",
                "Review schedule-of-rates line items and record a reasoned exception where justified.",
            ))

    if project.last_evidence_at:
        evidence_at = project.last_evidence_at
        if evidence_at.tzinfo is None:
            evidence_at = evidence_at.replace(tzinfo=timezone.utc)
        stale_days = (now - evidence_at).days
        if stale_days >= 45 and project.status == "in_progress":
            findings.append(Finding(
                "STALE_FIELD_EVIDENCE", "Stale field evidence", min(20, 8 + stale_days // 30), 88,
                f"No new field evidence has been recorded for {stale_days} days.",
                "Schedule a geo-fenced inspection and upload current site evidence.",
            ))

    today = now.date()
    if project.planned_completion_date < today and project.physical_progress < 100:
        overdue = (today - project.planned_completion_date).days
        findings.append(Finding(
            "COMPLETION_OVERDUE", "Completion deadline exceeded", min(25, 10 + overdue // 30), 99,
            f"The work is {overdue} days beyond its planned completion date at {project.physical_progress}% progress.",
            "Obtain a delay explanation and approve a time extension or corrective action.",
        ))

    # Capped additive score keeps explanations deterministic and auditable.
    score = min(100, sum(item.score for item in findings))
    return score, risk_level(score), [asdict(item) for item in findings]

