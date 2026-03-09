"""NFC schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class NfcCardBase(BaseSchema):
    """Base NFC Card schema."""
    card_id: str = Field(max_length=50)
    status: str = Field(default="unbound", max_length=50)
    tier_at_issue: str | None = Field(default=None, max_length=50)
    issued_at: datetime | None = None
    bound_at: datetime | None = None
    last_tap_at: datetime | None = None
    tap_count: int = 0


class NfcCardCreate(NfcCardBase):
    """Schema for creating an NFC Card."""
    pass


class NfcCardUpdate(BaseSchema):
    """Schema for updating an NFC Card."""
    status: str | None = Field(default=None, max_length=50)
    tier_at_issue: str | None = Field(default=None, max_length=50)
    bound_at: datetime | None = None
    last_tap_at: datetime | None = None
    tap_count: int | None = None


class NfcCardRead(NfcCardBase):
    """Schema for reading an NFC Card."""
    id: UUID
    member_id: UUID | None


class TapEventBase(BaseSchema):
    """Base Tap Event schema."""
    card_id: str = Field(max_length=50)
    tap_type: str = Field(max_length=50)
    reader_id: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=255)
    metadata_: dict | None = None
    tapped_at: datetime


class TapEventCreate(TapEventBase):
    """Schema for creating a Tap Event."""
    member_id: UUID | None = None


class TapEventRead(TapEventBase):
    """Schema for reading a Tap Event."""
    id: UUID
    member_id: UUID | None


class TapResponse(BaseSchema):
    """Response from NFC tap handler."""
    action: str
    redirect_url: str | None = None
    member_id: UUID | None = None
    message: str | None = None
    member_name: str | None = None


class BindCardRequest(BaseSchema):
    """Request to bind NFC card to member."""
    card_id: str = Field(max_length=50)


class BatchImportItem(BaseSchema):
    """Single card for batch import."""
    card_id: str = Field(max_length=50)
    tier_at_issue: str | None = Field(default=None, max_length=50)


class ConnectionTapRequest(BaseSchema):
    """Request to create a connection between two members via NFC."""
    card_id_a: str = Field(max_length=50)
    card_id_b: str = Field(max_length=50)
    reader_id: str | None = Field(default=None, max_length=100)
    location: str | None = Field(default=None, max_length=255)


class LockerTapRequest(BaseSchema):
    """Request to assign/release a locker via NFC."""
    card_id: str = Field(max_length=50)
    locker_number: str = Field(max_length=20)
    reader_id: str | None = Field(default=None, max_length=100)
