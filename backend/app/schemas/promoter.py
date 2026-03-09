"""Promoter schemas."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field


class PromoCodeRead(BaseModel):
    id: UUID
    code: str
    promoter_id: UUID
    tier_grant: str | None
    quota: int
    uses_count: int
    revenue_attributed: Decimal
    commission_rate: Decimal
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PromoCodeCreate(BaseModel):
    code: str = Field(min_length=3, max_length=50)
    tier_grant: str | None = None
    quota: int = Field(default=0, ge=0)
    commission_rate: Decimal = Field(default=Decimal("0.50"), ge=0, le=1)


class PromoCodeUpdate(BaseModel):
    is_active: bool | None = None
    quota: int | None = Field(default=None, ge=0)


class PromoCodeUseRead(BaseModel):
    id: UUID
    code_id: UUID
    user_id: UUID
    revenue_amount: Decimal
    commission_amount: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}


class PayoutRequestRead(BaseModel):
    id: UUID
    promoter_id: UUID
    amount: Decimal
    status: str
    notes: str | None
    created_at: datetime
    processed_at: datetime | None

    model_config = {"from_attributes": True}


class PayoutRequestCreate(BaseModel):
    amount: Decimal = Field(gt=0)


class PromoterStatsRead(BaseModel):
    total_codes: int
    total_uses: int
    total_revenue: Decimal
    commission_earned: Decimal
    pending_payout: Decimal


class AdminApprovePayoutRequest(BaseModel):
    notes: str | None = None
