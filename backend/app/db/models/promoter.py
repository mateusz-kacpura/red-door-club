"""Promoter models — promo codes, uses, and payout requests."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import TYPE_CHECKING, List

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.user import User


class PromoCode(Base):
    __tablename__ = "promo_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    promoter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    tier_grant: Mapped[str | None] = mapped_column(String(50), nullable=True)
    quota: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    uses_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    reg_commission: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, server_default="0")
    checkin_commission_flat: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    checkin_commission_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    promoter: Mapped["User"] = relationship("User", foreign_keys=[promoter_id], back_populates="promo_codes")
    uses: Mapped[List["PromoCodeUse"]] = relationship("PromoCodeUse", back_populates="code", cascade="all, delete-orphan")


class PromoCodeUse(Base):
    __tablename__ = "promo_code_uses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("promo_codes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    use_type: Mapped[str] = mapped_column(String(20), nullable=False, server_default="'registration'")
    revenue_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    commission_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    code: Mapped["PromoCode"] = relationship("PromoCode", back_populates="uses")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class PayoutRequest(Base):
    __tablename__ = "payout_requests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    promoter_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="'pending'")
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    promoter: Mapped["User"] = relationship("User", foreign_keys=[promoter_id])
