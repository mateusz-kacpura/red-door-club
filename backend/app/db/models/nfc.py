"""NFC related models."""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class NfcCard(Base):
    """NFC Card model."""

    __tablename__ = "nfc_cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    card_id: Mapped[str] = mapped_column(String(50), unique=True, index=True, nullable=False)
    member_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(50), default="unbound", nullable=False)
    tier_at_issue: Mapped[str | None] = mapped_column(String(50), nullable=True)
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bound_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_tap_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    tap_count: Mapped[int] = mapped_column(default=0, nullable=False)

    # Relationship
    member: Mapped["User"] = relationship("User", back_populates="nfc_cards") # type: ignore
    tap_events: Mapped[list["TapEvent"]] = relationship("TapEvent", back_populates="card")

    def __repr__(self) -> str:
        return f"<NfcCard(id={self.id}, card_id={self.card_id}, status={self.status})>"


class TapEvent(Base):
    """Event triggered by an NFC card tap."""

    __tablename__ = "tap_events"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    card_id: Mapped[str] = mapped_column(ForeignKey("nfc_cards.card_id"), nullable=False, index=True)
    member_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    tap_type: Mapped[str] = mapped_column(String(50), nullable=False)
    reader_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
    tapped_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    card: Mapped["NfcCard"] = relationship("NfcCard", back_populates="tap_events")
    member: Mapped["User"] = relationship("User") # type: ignore

    def __repr__(self) -> str:
        return f"<TapEvent(id={self.id}, type={self.tap_type}, location={self.location})>"
