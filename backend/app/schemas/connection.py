"""Connection Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class UserSummary(BaseSchema):
    """Minimal user info for connection display."""
    id: UUID
    full_name: str | None = None
    company_name: str | None = None
    industry: str | None = None
    tier: str | None = None


class ConnectionRead(BaseSchema):
    """Schema for reading a connection."""
    id: UUID
    member_a_id: UUID
    member_b_id: UUID
    connection_type: str
    notes: str | None = None
    created_at: datetime
    other_member: UserSummary | None = None
