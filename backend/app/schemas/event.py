"""Event Pydantic schemas."""

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema, TimestampSchema


class EventBase(BaseSchema):
    """Base event schema."""
    title: str = Field(max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    event_type: str = Field(default="mixer", max_length=50)
    target_segments: list[str] = Field(default_factory=list)
    capacity: int = Field(default=50, ge=1)
    ticket_price: Decimal = Field(default=Decimal("0.00"), ge=0)
    starts_at: datetime
    ends_at: datetime | None = None
    status: str = Field(default="draft", max_length=50)
    min_tier: str | None = Field(default=None, max_length=50)
    promo_tiers: list[str] = Field(default_factory=list)


class EventCreate(EventBase):
    """Schema for creating an event."""
    pass


class EventUpdate(BaseSchema):
    """Schema for updating an event (all fields optional)."""
    title: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    event_type: str | None = Field(default=None, max_length=50)
    target_segments: list[str] | None = None
    capacity: int | None = Field(default=None, ge=1)
    ticket_price: Decimal | None = Field(default=None, ge=0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    status: str | None = Field(default=None, max_length=50)
    min_tier: str | None = None
    promo_tiers: list[str] | None = None


class EventRead(EventBase, TimestampSchema):
    """Schema for reading an event."""
    id: UUID
    match_score: float | None = None
    rsvp_count: int | None = None
    is_rsvped: bool = False
