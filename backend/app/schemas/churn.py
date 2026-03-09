"""Schemas for churn prediction and member engagement health."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class EngagementHealthRead(BaseModel):
    risk_level: str  # "healthy" | "low" | "medium" | "high" | "critical"
    tips: list[str]  # Humanized, actionable suggestions


class ChurnFactorRead(BaseModel):
    name: str
    impact: int  # points added to churn score
    detail: str


class ChurnMemberRead(BaseModel):
    member_id: UUID
    full_name: str | None
    tier: str | None
    company_name: str | None
    churn_score: int
    risk_level: str
    last_seen_at: datetime | None
    primary_risk_factor: str


class ChurnDetailRead(BaseModel):
    member_id: UUID
    full_name: str | None
    churn_score: int
    risk_level: str
    factors: list[ChurnFactorRead]
    recommendation: str


class ChurnOverviewRead(BaseModel):
    retention_rate_30d: float
    avg_churn_score: float
    total_members: int
    active_30d: int
    risk_distribution: dict  # {healthy, low, medium, high, critical}
    at_risk_members: list[ChurnMemberRead]
