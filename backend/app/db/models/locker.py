"""Locker database model."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class Locker(Base, TimestampMixin):
    """Physical locker in the club, dynamically assigned per visit."""

    __tablename__ = "lockers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    locker_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(100), nullable=False, default="main_floor")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="available")
    assigned_member_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    member: Mapped["User | None"] = relationship("User", back_populates="locker")  # type: ignore

    def __repr__(self) -> str:
        return f"<Locker(number={self.locker_number}, status={self.status})>"
