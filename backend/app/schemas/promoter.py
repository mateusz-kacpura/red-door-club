"""Promoter schemas."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class PromoCodeRead(BaseModel):
    id: UUID
    code: str
    promoter_id: UUID
    tier_grant: str | None
    quota: int
    uses_count: int
    reg_commission: Decimal
    checkin_commission_flat: Decimal | None
    checkin_commission_pct: Decimal | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PromoCodeCreate(BaseModel):
    code: str = Field(min_length=3, max_length=50)
    tier_grant: str | None = None
    quota: int = Field(default=0, ge=0)
    reg_commission: Decimal = Field(default=Decimal("0"), ge=0)
    checkin_commission_flat: Decimal | None = Field(default=None, ge=0)
    checkin_commission_pct: Decimal | None = Field(default=None, ge=0, le=100)

    @model_validator(mode="after")
    def check_checkin_commission_mutual_exclusion(self) -> "PromoCodeCreate":
        if self.checkin_commission_flat is not None and self.checkin_commission_pct is not None:
            raise ValueError("Only one of checkin_commission_flat or checkin_commission_pct can be set.")
        return self


class PromoCodeUpdate(BaseModel):
    is_active: bool | None = None
    quota: int | None = Field(default=None, ge=0)
    reg_commission: Decimal | None = Field(default=None, ge=0)
    checkin_commission_flat: Decimal | None = None
    checkin_commission_pct: Decimal | None = None

    @model_validator(mode="after")
    def check_checkin_commission_mutual_exclusion(self) -> "PromoCodeUpdate":
        if self.checkin_commission_flat is not None and self.checkin_commission_pct is not None:
            raise ValueError("Only one of checkin_commission_flat or checkin_commission_pct can be set.")
        return self


class PromoCodeUseRead(BaseModel):
    id: UUID
    code_id: UUID
    user_id: UUID
    use_type: str
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


class ReferralRead(BaseModel):
    user_full_name: str | None
    promo_code: str
    registered_at: datetime


class AdminApprovePayoutRequest(BaseModel):
    notes: str | None = None
