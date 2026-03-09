"""add_promoter_tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-09 11:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # promo_codes
    op.create_table(
        "promo_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code", sa.String(50), nullable=False, unique=True),
        sa.Column("promoter_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tier_grant", sa.String(50), nullable=True),
        sa.Column("quota", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("uses_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("revenue_attributed", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("commission_rate", sa.Numeric(5, 4), nullable=False, server_default="0.5"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("promo_codes_code_idx", "promo_codes", ["code"])
    op.create_index("promo_codes_promoter_id_idx", "promo_codes", ["promoter_id"])

    # promo_code_uses
    op.create_table(
        "promo_code_uses",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("code_id", UUID(as_uuid=True), sa.ForeignKey("promo_codes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("revenue_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("commission_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("promo_code_uses_code_id_idx", "promo_code_uses", ["code_id"])

    # payout_requests
    op.create_table(
        "payout_requests",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("promoter_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="'pending'"),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("payout_requests_promoter_id_idx", "payout_requests", ["promoter_id"])


def downgrade() -> None:
    op.drop_index("payout_requests_promoter_id_idx")
    op.drop_table("payout_requests")
    op.drop_index("promo_code_uses_code_id_idx")
    op.drop_table("promo_code_uses")
    op.drop_index("promo_codes_promoter_id_idx")
    op.drop_index("promo_codes_code_idx")
    op.drop_table("promo_codes")
