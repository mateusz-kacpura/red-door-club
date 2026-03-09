"""Tab and TabItem database models for the club's bill/tab system."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.user import User
    from app.db.models.nfc import TapEvent


class Tab(Base):
    """A member's running tab (bill) during a visit."""

    __tablename__ = "tabs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    member_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="open")
    opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=Decimal("0.00")
    )

    # Relationships
    member: Mapped["User"] = relationship("User", back_populates="tabs")  # type: ignore
    items: Mapped[list["TabItem"]] = relationship(
        "TabItem", back_populates="tab", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Tab(id={self.id}, member={self.member_id}, status={self.status}, total={self.total_amount})>"


class TabItem(Base):
    """An individual line item on a member's tab."""

    __tablename__ = "tab_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    tab_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tabs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=datetime.utcnow, nullable=False
    )
    tap_event_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tap_events.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    tab: Mapped["Tab"] = relationship("Tab", back_populates="items")
    tap_event: Mapped["TapEvent | None"] = relationship("TapEvent")  # type: ignore

    def __repr__(self) -> str:
        return f"<TabItem(tab={self.tab_id}, desc={self.description!r}, amount={self.amount})>"
