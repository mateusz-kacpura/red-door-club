"""promoter_commission_config_table

Create singleton table for global promoter commission defaults.

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
Create Date: 2026-03-21 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e6f7a8b9c0d1"
down_revision: Union[str, None] = "d5e6f7a8b9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "promoter_commission_config",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("reg_commission", sa.Numeric(10, 2), nullable=False, server_default="500"),
        sa.Column("checkin_commission_flat", sa.Numeric(10, 2), nullable=True),
        sa.Column("checkin_commission_pct", sa.Numeric(5, 2), nullable=True),
    )
    # Seed with default row
    op.execute(
        "INSERT INTO promoter_commission_config (id, reg_commission) VALUES (1, 500)"
    )


def downgrade() -> None:
    op.drop_table("promoter_commission_config")
