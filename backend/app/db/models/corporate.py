"""Corporate account models."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.user import User


class CorporateAccount(Base):
    __tablename__ = "corporate_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    billing_contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    billing_contact_email: Mapped[str] = mapped_column(String(255), nullable=False)
    billing_address: Mapped[str] = mapped_column(Text, nullable=False, server_default="''")
    vat_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    package_type: Mapped[str] = mapped_column(String(50), nullable=False, server_default="'starter'")
    max_seats: Mapped[int] = mapped_column(Integer, nullable=False, server_default="5")
    active_seats: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    annual_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    renewal_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="'active'")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    members: Mapped[List["CorporateMember"]] = relationship(
        "CorporateMember", back_populates="account", cascade="all, delete-orphan"
    )


class CorporateMember(Base):
    __tablename__ = "corporate_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    corporate_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("corporate_accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, server_default="'member'")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    account: Mapped["CorporateAccount"] = relationship("CorporateAccount", back_populates="members")
    member: Mapped["User"] = relationship("User", foreign_keys=[member_id])
