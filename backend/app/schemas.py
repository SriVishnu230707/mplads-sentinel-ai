from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import AlertStatus, CaseStatus, OrgLevel, RiskLevel, Role


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class AccessToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    level: OrgLevel
    state: str | None
    district: str | None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    full_name: str
    role: Role
    organization: OrganizationOut


class RiskReason(BaseModel):
    rule_code: str
    label: str
    score: int
    confidence: int
    explanation: str
    recommended_action: str


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    state: str
    district: str
    location: str
    category: str
    agency: str
    vendor_name: str | None
    sanctioned_lakh: float
    spent_lakh: float
    physical_progress: int
    sanction_date: date
    planned_completion_date: date
    last_evidence_at: datetime | None
    status: str
    latitude: float | None
    longitude: float | None
    risk_score: int
    risk_level: RiskLevel
    risk_reasons: list[RiskReason]
    version: int
    updated_at: datetime


class AlertOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    rule_code: str
    title: str
    explanation: str
    severity: RiskLevel
    score: int
    confidence: int
    status: AlertStatus
    recommended_action: str
    evidence: dict
    created_at: datetime


class AlertReviewRequest(BaseModel):
    status: AlertStatus


class ComplianceItemOut(BaseModel):
    label: str
    status: str
    detail: str


class DuplicateCandidateOut(BaseModel):
    project_id: str
    title: str
    location: str
    similarity_score: int
    reasons: list[str]


class RiskSnapshotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    score: int
    level: RiskLevel
    recorded_at: datetime


class ProjectIntelligenceOut(BaseModel):
    project_id: str
    health_score: int
    health_band: str
    compliance: list[ComplianceItemOut]
    duplicate_candidates: list[DuplicateCandidateOut]
    risk_timeline: list[RiskSnapshotOut]


class EvidenceCreate(BaseModel):
    captured_at: datetime
    latitude: float = Field(ge=6, le=38)
    longitude: float = Field(ge=68, le=98)
    reported_progress: int = Field(ge=0, le=100)
    remarks: str = Field(min_length=3, max_length=1000)


class EvidenceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    project_id: str
    captured_at: datetime
    reported_progress: int
    distance_from_project_km: float
    created_at: datetime


class DelayPredictionOut(BaseModel):
    project_id: str
    delay_probability: int
    confidence: str
    factors: list[str]
    disclaimer: str


class ImportValidationOut(BaseModel):
    dry_run: bool
    rows_received: int
    valid_rows: int
    invalid_rows: int
    applied_rows: int
    errors: list[dict[str, str]]


class CaseCreate(BaseModel):
    alert_id: str = Field(min_length=1, max_length=36)


class CaseUpdate(BaseModel):
    status: CaseStatus
    closure_note: str | None = Field(default=None, min_length=5, max_length=2000)


class CaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    alert_id: str
    project_id: str
    title: str
    status: CaseStatus
    priority: RiskLevel
    owner_id: str | None
    created_by: str
    closure_note: str | None
    closed_by: str | None
    created_at: datetime
    updated_at: datetime


class DashboardSummary(BaseModel):
    active_works: int
    sanctioned_lakh: float
    expenditure_lakh: float
    high_risk_works: int
    open_alerts: int
    delayed_works: int
    risk_distribution: dict[str, int]


class ScanResult(BaseModel):
    projects_scanned: int
    alerts_created: int
    scores_updated: int
