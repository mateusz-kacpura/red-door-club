"""ServiceRequest Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import BaseSchema


class ServiceRequestCreate(BaseSchema):
    """Schema for creating a service request."""
    request_type: str = Field(max_length=50)
    details: dict | None = None


class ServiceRequestUpdate(BaseSchema):
    """Schema for updating a service request (staff)."""
    status: str | None = Field(default=None, max_length=50)
    assigned_to: UUID | None = None
    member_rating: int | None = Field(default=None, ge=1, le=5)


class ServiceRequestRead(BaseSchema):
    """Schema for reading a service request."""
    id: UUID
    member_id: UUID
    request_type: str
    status: str
    details: dict | None = None
    assigned_to: UUID | None = None
    created_at: datetime
    completed_at: datetime | None = None
    member_rating: int | None = None


class ServiceRequestAdminRead(ServiceRequestRead):
    """Extended schema for admin view — includes member and assignee names."""
    member_name: str | None = None
    assigned_to_name: str | None = None


class ServiceRequestAdminUpdate(BaseSchema):
    """Schema for admin updating a service request (status, assignment, staff notes)."""
    status: str | None = Field(default=None, max_length=50)
    assigned_to: UUID | None = None
    staff_notes: str | None = None
