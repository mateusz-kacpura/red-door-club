"""Schemas for QR batch generation."""

import uuid
from datetime import datetime

from pydantic import Field

from app.schemas.base import BaseSchema


class QrBatchCreate(BaseSchema):
    """Schema for creating a QR batch."""
    promoter_id: uuid.UUID | None = None
    promo_code: str | None = Field(default=None, max_length=50)
    tier: str = Field(default="silver", max_length=20)
    count: int = Field(default=10, ge=1, le=500)
    prefix: str = Field(default="RD-", max_length=10)
    notes: str | None = Field(default=None, max_length=500)


class QrCodeRead(BaseSchema):
    """Schema for reading a single QR code."""
    id: uuid.UUID
    batch_id: uuid.UUID
    pass_id: str
    converted_at: datetime | None
    registered_user_id: uuid.UUID | None
    created_at: datetime


class QrBatchRead(BaseSchema):
    """Schema for reading a QR batch."""
    id: uuid.UUID
    promoter_id: uuid.UUID | None
    promo_code: str | None
    tier: str
    count: int
    prefix: str
    notes: str | None
    created_by: uuid.UUID
    created_at: datetime
    conversion_rate: float = 0.0
    converted_count: int = 0


class QrBatchDetail(QrBatchRead):
    """QR batch with its codes."""
    codes: list[QrCodeRead] = []
