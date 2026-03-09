"""Loyalty & Points schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class LoyaltyTransactionRead(BaseModel):
    """Serialised loyalty transaction."""

    id: UUID
    member_id: UUID
    points: int
    reason: str
    reference_id: UUID | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PointsBalanceRead(BaseModel):
    """Current points balance for a member."""

    balance: int
    lifetime_total: int


class RedeemPointsRequest(BaseModel):
    """Request body for redeeming points."""

    amount: int  # positive number; will be stored as negative transaction
    reason: str = "redemption"


class AdminAwardPointsRequest(BaseModel):
    """Admin: manually award points to a member."""

    member_id: UUID
    amount: int
    reason: str = "manual_award"


class LeaderboardEntry(BaseModel):
    """Single entry in the loyalty leaderboard."""

    rank: int
    member_id: UUID
    full_name: str | None
    company_name: str | None
    tier: str | None
    lifetime_points: int
    current_balance: int
