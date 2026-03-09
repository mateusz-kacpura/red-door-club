"""Analytics and activity schemas."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.base import BaseSchema


class TopSpender(BaseSchema):
    member_id: UUID
    full_name: str | None
    total_spent: Decimal


class RevenueAnalytics(BaseSchema):
    today: Decimal = Decimal("0.00")
    this_week: Decimal = Decimal("0.00")
    this_month: Decimal = Decimal("0.00")
    top_spenders: list[TopSpender] = []


class TapEventAdminRead(BaseSchema):
    id: UUID
    member_id: UUID | None = None
    member_name: str | None = None
    card_id: str
    tap_type: str
    reader_id: str | None = None
    location: str | None = None
    tapped_at: datetime
    metadata: dict | None = Field(default=None, alias="metadata_")

    model_config = {"populate_by_name": True}
