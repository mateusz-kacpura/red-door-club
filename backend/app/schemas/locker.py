"""Locker schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class LockerCreate(BaseSchema):
    """Schema for creating a locker."""
    locker_number: str = Field(max_length=20)
    location: str = Field(default="main_floor", max_length=100)


class LockerRead(BaseSchema):
    """Schema for reading a locker."""
    id: UUID
    locker_number: str
    location: str
    status: str
    assigned_member_id: UUID | None
    assigned_at: datetime | None
    released_at: datetime | None
