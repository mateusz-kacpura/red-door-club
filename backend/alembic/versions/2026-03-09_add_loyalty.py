"""add_loyalty_columns_and_table

Revision ID: a1b2c3d4e5f6
Revises: f7621a6fc054
Create Date: 2026-03-09 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "f7621a6fc054"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add loyalty columns to users
    op.add_column("users", sa.Column("loyalty_points", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("loyalty_lifetime_points", sa.Integer(), nullable=False, server_default="0"))
    # Add promoter columns to users (done here to keep user-level columns together)
    op.add_column("users", sa.Column("is_promoter", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("users", sa.Column("referred_by_code", sa.String(100), nullable=True))

    # Create loyalty_transactions table
    op.create_table(
        "loyalty_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("member_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("points", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("reference_id", UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("loyalty_transactions_member_id_idx", "loyalty_transactions", ["member_id"])


def downgrade() -> None:
    op.drop_index("loyalty_transactions_member_id_idx")
    op.drop_table("loyalty_transactions")
    op.drop_column("users", "referred_by_code")
    op.drop_column("users", "is_promoter")
    op.drop_column("users", "loyalty_lifetime_points")
    op.drop_column("users", "loyalty_points")
