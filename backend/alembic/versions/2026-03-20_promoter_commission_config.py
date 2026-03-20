"""promoter_commission_config

Replace single commission_rate with separate registration and checkin
commission fields. Add use_type discriminator to promo_code_uses.

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
Create Date: 2026-03-20 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d5e6f7a8b9c0"
down_revision: Union[str, None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new commission columns to promo_codes
    op.add_column(
        "promo_codes",
        sa.Column("reg_commission", sa.Numeric(10, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "promo_codes",
        sa.Column("checkin_commission_flat", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "promo_codes",
        sa.Column("checkin_commission_pct", sa.Numeric(5, 2), nullable=True),
    )

    # Add use_type discriminator to promo_code_uses
    op.add_column(
        "promo_code_uses",
        sa.Column("use_type", sa.String(20), nullable=False, server_default="'registration'"),
    )

    # Drop old unused columns
    op.drop_column("promo_codes", "commission_rate")
    op.drop_column("promo_codes", "revenue_attributed")


def downgrade() -> None:
    op.add_column(
        "promo_codes",
        sa.Column("revenue_attributed", sa.Numeric(12, 2), nullable=False, server_default="0"),
    )
    op.add_column(
        "promo_codes",
        sa.Column("commission_rate", sa.Numeric(5, 4), nullable=False, server_default="0.5"),
    )
    op.drop_column("promo_code_uses", "use_type")
    op.drop_column("promo_codes", "checkin_commission_pct")
    op.drop_column("promo_codes", "checkin_commission_flat")
    op.drop_column("promo_codes", "reg_commission")
