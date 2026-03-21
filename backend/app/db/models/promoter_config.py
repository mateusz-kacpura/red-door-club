"""Promoter commission config — singleton table for global defaults."""

from decimal import Decimal

from sqlalchemy import Integer, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PromoterCommissionConfig(Base):
    __tablename__ = "promoter_commission_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    reg_commission: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), nullable=False, server_default="500"
    )
    checkin_commission_flat: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2), nullable=True
    )
    checkin_commission_pct: Mapped[Decimal | None] = mapped_column(
        Numeric(5, 2), nullable=True
    )
