"""Loyalty transaction model for the RD Points system."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

# Valid reasons for earning or spending points
EARN_REASONS = frozenset({
    "event_attendance",
    "service_request",
    "guest_referral",
    "podcast_recording",
    "manual_award",
})
SPEND_REASONS = frozenset({"redemption"})


class LoyaltyTransaction(Base):
    """Records every point-earn and point-spend event for a member.

    points > 0  → earned (event_attendance, service_request, etc.)
    points < 0  → spent  (redemption)
    """

    __tablename__ = "loyalty_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(50), nullable=False)
    # Optional FK to the triggering tap event or service request
    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    member = relationship("User", back_populates="loyalty_transactions")

    def __repr__(self) -> str:
        sign = "+" if self.points > 0 else ""
        return f"<LoyaltyTransaction(member={self.member_id}, {sign}{self.points} pts, {self.reason})>"
