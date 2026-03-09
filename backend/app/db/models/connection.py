"""Member connection database model."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.user import User
    from app.db.models.nfc import TapEvent


class Connection(Base):
    """Connection between two members."""

    __tablename__ = "connections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    member_a_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    member_b_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    connection_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="tap"
    )
    tap_event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tap_events.id", ondelete="SET NULL"), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )

    # Relationships
    member_a: Mapped["User"] = relationship("User", foreign_keys=[member_a_id])  # type: ignore
    member_b: Mapped["User"] = relationship("User", foreign_keys=[member_b_id])  # type: ignore
    tap_event: Mapped["TapEvent | None"] = relationship("TapEvent")  # type: ignore

    def __repr__(self) -> str:
        return f"<Connection(id={self.id}, type={self.connection_type})>"
