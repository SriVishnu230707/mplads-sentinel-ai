from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Enum, Float, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return str(uuid.uuid4())


class Role(str, enum.Enum):
    MINISTRY = "ministry"
    STATE = "state"
    DISTRICT = "district"
    AUDITOR = "auditor"
    FIELD_OFFICER = "field_officer"
    MP = "mp"


class OrgLevel(str, enum.Enum):
    NATIONAL = "national"
    STATE = "state"
    DISTRICT = "district"


class RiskLevel(str, enum.Enum):
    CRITICAL = "Critical"
    HIGH = "High"
    MODERATE = "Moderate"
    LOW = "Low"


class AlertStatus(str, enum.Enum):
    OPEN = "open"
    TRIAGED = "triaged"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"


class CaseStatus(str, enum.Enum):
    OPEN = "open"
    INVESTIGATING = "investigating"
    CLOSURE_REVIEW = "closure_review"
    CLOSED = "closed"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    level: Mapped[OrgLevel] = mapped_column(Enum(OrgLevel))
    state: Mapped[str | None] = mapped_column(String(80), index=True)
    district: Mapped[str | None] = mapped_column(String(100), index=True)
    constituency: Mapped[str | None] = mapped_column(String(100), index=True)
    parent_id: Mapped[str | None] = mapped_column(ForeignKey("organizations.id"))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(254), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(Enum(Role), index=True)
    organization_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    token_version: Mapped[int] = mapped_column(Integer, default=1)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    organization: Mapped[Organization] = relationship(lazy="joined")


class Project(Base):
    __tablename__ = "projects"
    __table_args__ = (
        Index("ix_projects_scope", "state", "district"),
        Index("ix_projects_risk", "risk_level", "risk_score"),
    )

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    title: Mapped[str] = mapped_column(String(240), index=True)
    state: Mapped[str] = mapped_column(String(80), index=True)
    district: Mapped[str] = mapped_column(String(100), index=True)
    constituency: Mapped[str | None] = mapped_column(String(100), index=True)
    location: Mapped[str] = mapped_column(String(160))
    category: Mapped[str] = mapped_column(String(80), index=True)
    agency: Mapped[str] = mapped_column(String(180))
    vendor_name: Mapped[str | None] = mapped_column(String(180), index=True)
    sanctioned_lakh: Mapped[float] = mapped_column(Float)
    spent_lakh: Mapped[float] = mapped_column(Float, default=0)
    physical_progress: Mapped[int] = mapped_column(Integer, default=0)
    peer_median_lakh: Mapped[float | None] = mapped_column(Float)
    sanction_date: Mapped[date] = mapped_column(Date)
    planned_completion_date: Mapped[date] = mapped_column(Date)
    last_evidence_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String(40), default="in_progress", index=True)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    risk_level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), default=RiskLevel.LOW)
    risk_reasons: Mapped[list] = mapped_column(JSON, default=list)
    version: Mapped[int] = mapped_column(Integer, default=1)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    alerts: Mapped[list[Alert]] = relationship(back_populates="project", cascade="all, delete-orphan")
    __mapper_args__ = {"version_id_col": version}


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (UniqueConstraint("project_id", "rule_code", "status", name="uq_active_rule_alert"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    rule_code: Mapped[str] = mapped_column(String(80), index=True)
    title: Mapped[str] = mapped_column(String(180))
    explanation: Mapped[str] = mapped_column(Text)
    severity: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel), index=True)
    score: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[int] = mapped_column(Integer)
    status: Mapped[AlertStatus] = mapped_column(Enum(AlertStatus), default=AlertStatus.OPEN, index=True)
    recommended_action: Mapped[str] = mapped_column(Text)
    evidence: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    project: Mapped[Project] = relationship(back_populates="alerts")


class RiskSnapshot(Base):
    __tablename__ = "risk_snapshots"
    __table_args__ = (Index("ix_risk_snapshots_project_recorded", "project_id", "recorded_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    score: Mapped[int] = mapped_column(Integer)
    level: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel))
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class InspectionEvidence(Base):
    __tablename__ = "inspection_evidence"
    __table_args__ = (Index("ix_inspection_evidence_project_captured", "project_id", "captured_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    submitted_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    reported_progress: Mapped[int] = mapped_column(Integer)
    remarks: Mapped[str] = mapped_column(Text)
    distance_from_project_km: Mapped[float] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class InvestigationCase(Base):
    __tablename__ = "investigation_cases"
    __table_args__ = (UniqueConstraint("alert_id", name="uq_case_alert"), Index("ix_cases_project_status", "project_id", "status"))

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    alert_id: Mapped[str] = mapped_column(ForeignKey("alerts.id"), unique=True, index=True)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    status: Mapped[CaseStatus] = mapped_column(Enum(CaseStatus), default=CaseStatus.OPEN, index=True)
    priority: Mapped[RiskLevel] = mapped_column(Enum(RiskLevel))
    owner_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    closure_note: Mapped[str | None] = mapped_column(Text)
    closed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    replaced_by: Mapped[str | None] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class AuditEvent(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    actor_id: Mapped[str | None] = mapped_column(String(36), index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str | None] = mapped_column(String(80))
    outcome: Mapped[str] = mapped_column(String(30), default="success")
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)
