"""Event and RSVP database models."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Table, Column
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.user import User


# Association table for Event RSVPs
rsvp_table = Table(
    "event_rsvps",
    Base.metadata,
    Column("event_id", UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), primary_key=True),
    Column("member_id", UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("rsvp_at", DateTime(timezone=True), default=datetime.utcnow, nullable=False),
)


class Event(Base, TimestampMixin):
    """Club event model."""

    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False, default="mixer")
    target_segments: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    ticket_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="draft")
    min_tier: Mapped[str | None] = mapped_column(String(50), nullable=True)

    # RSVPs
    attendees: Mapped[List["User"]] = relationship(
        "User", secondary=rsvp_table, back_populates="rsvped_events"
    )

    def __repr__(self) -> str:
        return f"<Event(id={self.id}, title={self.title}, status={self.status})>"
