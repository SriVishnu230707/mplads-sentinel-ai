from datetime import date, datetime, timedelta, timezone

from app.models import Project, RiskLevel
from app.risk_engine import evaluate


def project(**overrides) -> Project:
    values = dict(
        id="TEST-1", title="Test road", state="Karnataka", district="Bengaluru Rural",
        location="Test", category="Roads", agency="PWD", sanctioned_lakh=100,
        spent_lakh=82, physical_progress=30, peer_median_lakh=60,
        sanction_date=date(2025, 1, 1), planned_completion_date=date(2026, 1, 1),
        last_evidence_at=datetime.now(timezone.utc) - timedelta(days=90), status="in_progress",
    )
    values.update(overrides)
    return Project(**values)


def test_combined_anomalies_produce_explainable_critical_risk():
    score, level, reasons = evaluate(project())
    codes = {reason["rule_code"] for reason in reasons}
    assert level == RiskLevel.CRITICAL
    assert score >= 80
    assert {"FIN_PHYSICAL_MISMATCH", "COST_BENCHMARK_OUTLIER", "STALE_FIELD_EVIDENCE", "COMPLETION_OVERDUE"} <= codes
    assert all(reason["explanation"] and reason["recommended_action"] for reason in reasons)


def test_healthy_project_remains_low_risk():
    score, level, reasons = evaluate(project(
        spent_lakh=50, physical_progress=55, peer_median_lakh=95,
        planned_completion_date=date(2027, 1, 1),
        last_evidence_at=datetime.now(timezone.utc) - timedelta(days=5),
    ))
    assert score == 0
    assert level == RiskLevel.LOW
    assert reasons == []

