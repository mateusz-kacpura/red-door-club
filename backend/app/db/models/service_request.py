"""Service request database model."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.user import User


class ServiceRequest(Base):
    """Concierge / service request model."""

    __tablename__ = "service_requests"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    request_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    member_rating: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Relationships
    member: Mapped["User"] = relationship("User", foreign_keys=[member_id])  # type: ignore
    assignee: Mapped["User | None"] = relationship("User", foreign_keys=[assigned_to])  # type: ignore

    def __repr__(self) -> str:
        return f"<ServiceRequest(id={self.id}, type={self.request_type}, status={self.status})>"
