from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from .models import AlertStatus, CaseStatus, MPRegistrationStatus, OrgLevel, RiskLevel, Role


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
    constituency: str | None = None


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
    constituency: str | None = None
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


class OfficialCredentialsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    user_id: str
    full_name: str
    role: Role
    pan_number: str | None = None
    aadhaar_number: str | None = None
    bank_name: str | None = None
    bank_account_number: str | None = None
    bank_ifsc: str | None = None
    pfms_code: str | None = None
    biometric_enrolled: bool = True
    biometric_device_id: str | None = None
    biometric_enrolled_at: datetime | None = None
    is_unlocked: bool = False


class UpdateCredentialsRequest(BaseModel):
    pan_number: str | None = Field(default=None, pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")
    aadhaar_number: str | None = Field(default=None, pattern=r"^\d{12}$")
    bank_name: str | None = Field(default=None, max_length=120)
    bank_account_number: str | None = Field(default=None, min_length=8, max_length=30)
    bank_ifsc: str | None = Field(default=None, pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")
    pfms_code: str | None = Field(default=None, max_length=40)


class BiometricVerifyRequest(BaseModel):
    device_challenge: str | None = None
    method: str = "fingerprint"


class BiometricVerifyResponse(BaseModel):
    status: str
    verified_at: datetime
    message: str
    unlock_token: str
    credentials: OfficialCredentialsOut


class ImmovablePropertyItem(BaseModel):
    property_type: str
    location: str
    area_sqft: str | float | None = None
    estimated_value_lakh: float = Field(ge=0)
    ownership_status: str = "Self"


class MovableAssetsSummary(BaseModel):
    bank_deposits_lakh: float = Field(default=0.0, ge=0)
    vehicles_summary: str | None = None
    gold_jewellery_grams: float = Field(default=0.0, ge=0)
    investments_shares_lakh: float = Field(default=0.0, ge=0)


class MPRegistrationCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=3, max_length=120)
    phone_number: str = Field(pattern=r"^[6-9]\d{9}$")
    dob: date
    gender: str = Field(pattern=r"^(Male|Female|Other)$")
    blood_group: str | None = Field(default=None, max_length=10)
    father_or_spouse_name: str = Field(min_length=2, max_length=120)
    permanent_address: str = Field(min_length=5, max_length=1000)
    present_address: str | None = Field(default=None, max_length=1000)

    house: str = Field(default="Lok Sabha", pattern=r"^(Lok Sabha|Rajya Sabha)$")
    state: str = Field(min_length=2, max_length=80)
    constituency: str = Field(min_length=2, max_length=100)
    political_party: str = Field(min_length=2, max_length=120)
    term_label: str = Field(default="18th Lok Sabha (2024-2029)", max_length=80)

    voter_id: str = Field(min_length=6, max_length=30)
    voter_constituency_serial: str | None = Field(default=None, max_length=50)
    driving_license_no: str = Field(min_length=6, max_length=40)
    driving_license_rto: str | None = Field(default=None, max_length=100)
    winning_certificate_no: str = Field(min_length=3, max_length=60)
    winning_date: date
    returning_officer_code: str | None = Field(default=None, max_length=60)
    community_certificate_no: str = Field(min_length=3, max_length=60)
    community_category: str = Field(default="General", max_length=40)
    community_issuing_authority: str | None = Field(default=None, max_length=120)
    birth_certificate_no: str = Field(min_length=3, max_length=60)
    birth_place: str | None = Field(default=None, max_length=120)
    pan_number: str = Field(pattern=r"^[A-Z]{5}[0-9]{4}[A-Z]$")
    aadhaar_number: str = Field(pattern=r"^\d{12}$")

    immovable_properties: list[ImmovablePropertyItem] = Field(default_factory=list)
    movable_assets: MovableAssetsSummary = Field(default_factory=MovableAssetsSummary)
    total_assets_lakh: float = Field(ge=0, default=0.0)
    liabilities_lakh: float = Field(ge=0, default=0.0)
    affidavit_eci_ref: str | None = Field(default=None, max_length=255)

    bank_name: str = Field(min_length=3, max_length=120)
    bank_account_number: str = Field(min_length=8, max_length=30)
    bank_ifsc: str = Field(pattern=r"^[A-Z]{4}0[A-Z0-9]{6}$")
    pfms_code: str | None = Field(default=None, max_length=40)


class MPRegistrationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: EmailStr
    full_name: str
    phone_number: str
    dob: date
    gender: str
    blood_group: str | None = None
    father_or_spouse_name: str
    permanent_address: str
    present_address: str | None = None

    house: str
    state: str
    constituency: str
    political_party: str
    term_label: str

    voter_id: str
    voter_constituency_serial: str | None = None
    driving_license_no: str
    driving_license_rto: str | None = None
    winning_certificate_no: str
    winning_date: date
    returning_officer_code: str | None = None
    community_certificate_no: str
    community_category: str
    community_issuing_authority: str | None = None
    birth_certificate_no: str
    birth_place: str | None = None
    pan_number: str
    aadhaar_number: str

    immovable_properties: list[dict]
    movable_assets: dict
    total_assets_lakh: float
    liabilities_lakh: float
    affidavit_eci_ref: str | None = None

    bank_name: str
    bank_account_number: str
    bank_ifsc: str
    pfms_code: str | None = None

    status: MPRegistrationStatus
    created_at: datetime
    reviewed_at: datetime | None = None
    reviewed_by: str | None = None
    reviewer_remarks: str | None = None
    rejection_reason: str | None = None


class MPRegistrationStatusCheck(BaseModel):
    id: str
    email: str
    full_name: str
    constituency: str
    status: MPRegistrationStatus
    created_at: datetime
    reviewed_at: datetime | None = None
    reviewer_remarks: str | None = None
    rejection_reason: str | None = None


class MPApprovalAction(BaseModel):
    remarks: str | None = Field(default=None, max_length=1000)


class MPRejectionAction(BaseModel):
    reason: str = Field(min_length=5, max_length=1000)
    remarks: str | None = Field(default=None, max_length=1000)
