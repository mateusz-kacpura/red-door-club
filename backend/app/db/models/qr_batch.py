"""QR Batch models — batch generation and individual QR code tracking."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, List

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.user import User


class QrBatch(Base):
    __tablename__ = "qr_batches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    promoter_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    promo_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tier: Mapped[str] = mapped_column(String(20), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False)
    prefix: Mapped[str] = mapped_column(String(10), nullable=False, server_default="'RD-'")
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    promoter: Mapped["User | None"] = relationship("User", foreign_keys=[promoter_id])
    creator: Mapped["User"] = relationship("User", foreign_keys=[created_by])
    codes: Mapped[List["QrCode"]] = relationship(
        "QrCode", back_populates="batch", cascade="all, delete-orphan"
    )


class QrCode(Base):
    __tablename__ = "qr_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("qr_batches.id", ondelete="CASCADE"), nullable=False, index=True
    )
    pass_id: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    converted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    registered_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Relationships
    batch: Mapped["QrBatch"] = relationship("QrBatch", back_populates="codes")
    registered_user: Mapped["User | None"] = relationship("User", foreign_keys=[registered_user_id])
