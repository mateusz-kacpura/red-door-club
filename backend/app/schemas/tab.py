"""Tab and payment schemas."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class TabItemRead(BaseSchema):
    """Schema for reading a tab item."""
    id: UUID
    description: str
    amount: Decimal
    added_at: datetime
    tap_event_id: UUID | None


class TabRead(BaseSchema):
    """Schema for reading a tab with all items."""
    id: UUID
    member_id: UUID
    status: str
    opened_at: datetime
    closed_at: datetime | None
    total_amount: Decimal
    items: list[TabItemRead] = []


class PaymentTapRequest(BaseSchema):
    """Request to add a payment item via NFC tap."""
    card_id: str = Field(max_length=50)
    amount: Decimal = Field(gt=0)
    description: str = Field(max_length=255)
    reader_id: str | None = Field(default=None, max_length=100)
