"""User schemas."""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from uuid import UUID

from pydantic import EmailStr, Field

from app.schemas.base import BaseSchema, TimestampSchema


class UserRole(StrEnum):
    """User role enumeration for API schemas."""

    ADMIN = "admin"
    USER = "user"


class UserBase(BaseSchema):
    """Base user schema."""

    email: EmailStr = Field(max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    full_name: str | None = Field(default=None, max_length=255)
    company_name: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=100)
    revenue_range: str | None = Field(default=None, max_length=50)
    interests: list[str] = Field(default_factory=list)
    user_type: str = Field(default="prospect", max_length=50)
    tier: str | None = Field(default=None, max_length=50)
    segment_groups: list[str] = Field(default_factory=list)
    pdpa_consent: bool = False
    last_seen_at: datetime | None = None
    is_active: bool = True


class UserCreate(BaseSchema):
    """Schema for creating a user."""

    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    company_name: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=100)
    revenue_range: str | None = Field(default=None, max_length=50)
    interests: list[str] = Field(default_factory=list)
    pdpa_consent: bool = False
    role: UserRole = UserRole.USER


class UserUpdate(BaseSchema):
    """Schema for updating a user."""

    email: EmailStr | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=30)
    company_name: str | None = Field(default=None, max_length=255)
    industry: str | None = Field(default=None, max_length=100)
    revenue_range: str | None = Field(default=None, max_length=50)
    interests: list[str] | None = None
    user_type: str | None = Field(default=None, max_length=50)
    tier: str | None = Field(default=None, max_length=50)
    segment_groups: list[str] | None = None
    last_seen_at: datetime | None = None
    is_active: bool | None = None
    role: UserRole | None = None


class UserRead(UserBase, TimestampSchema):
    """Schema for reading a user."""
    id: UUID
    is_superuser: bool = False
    role: UserRole = UserRole.USER
    staff_notes: str | None = None


class MemberProfileRead(UserRead):
    """Member's own profile view: includes NFC card status and match score count."""
    nfc_cards: list[dict] = []
    match_score_count: int = 0


class MemberDetail(UserRead):
    """Extended member schema for admin CRM view."""
    connections_count: int = 0
    tab_total: Decimal = Decimal("0.00")
    service_requests_count: int = 0
    recent_taps: list[dict] = []


class UserInDB(UserRead):
    """User schema with hashed password (internal use)."""

    hashed_password: str
