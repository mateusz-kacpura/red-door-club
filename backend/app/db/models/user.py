"""User database model."""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.nfc import NfcCard, TapEvent
    from app.db.models.event import Event
    from app.db.models.service_request import ServiceRequest
    from app.db.models.locker import Locker
    from app.db.models.tab import Tab
    from app.db.models.loyalty import LoyaltyTransaction
    from app.db.models.promoter import PromoCode

class UserRole(StrEnum):
    """User role enumeration.

    Roles hierarchy (higher includes lower permissions):
    - ADMIN: Full system access, can manage users and settings
    - STAFF: Staff access for door operations (QR checkin, etc.)
    - USER: Standard user access
    """
    ADMIN = "admin"
    STAFF = "staff"
    USER = "user"


_ROLE_RANK = {UserRole.USER.value: 0, UserRole.STAFF.value: 1, UserRole.ADMIN.value: 2}


class User(Base, TimestampMixin):
    """User model."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    company_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), nullable=True)
    revenue_range: Mapped[str | None] = mapped_column(String(50), nullable=True)
    interests: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    user_type: Mapped[str] = mapped_column(String(50), default="prospect")
    tier: Mapped[str | None] = mapped_column(String(50), nullable=True)
    segment_groups: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    pdpa_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    role: Mapped[str] = mapped_column(String(50), default=UserRole.USER.value, nullable=False)
    staff_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Loyalty & Points
    loyalty_points: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    loyalty_lifetime_points: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    # Promoter
    is_promoter: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    referred_by_code: Mapped[str | None] = mapped_column(String(100), nullable=True)

    nfc_cards: Mapped[List["NfcCard"]] = relationship("NfcCard", back_populates="member")
    rsvped_events: Mapped[List["Event"]] = relationship(
        "Event", secondary="event_rsvps", back_populates="attendees"
    )
    service_requests: Mapped[List["ServiceRequest"]] = relationship(
        "ServiceRequest", foreign_keys="ServiceRequest.member_id", back_populates="member"
    )
    locker: Mapped["Locker | None"] = relationship(
        "Locker", back_populates="member", foreign_keys="Locker.assigned_member_id", uselist=False
    )
    tabs: Mapped[List["Tab"]] = relationship("Tab", back_populates="member")
    loyalty_transactions: Mapped[List["LoyaltyTransaction"]] = relationship("LoyaltyTransaction", back_populates="member", order_by="LoyaltyTransaction.created_at.desc()")
    promo_codes: Mapped[List["PromoCode"]] = relationship("PromoCode", foreign_keys="PromoCode.promoter_id", back_populates="promoter")

    @property
    def user_role(self) -> UserRole:
        """Get role as enum."""
        return UserRole(self.role)

    def has_role(self, required_role: UserRole) -> bool:
        """Check if user has the required role or higher."""
        return _ROLE_RANK.get(self.role, 0) >= _ROLE_RANK.get(required_role.value, 0)

    def __repr__(self) -> str:
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
