"""add_qr_batches

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-09 13:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "qr_batches",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("promoter_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("promo_code", sa.String(50), nullable=True),
        sa.Column("tier", sa.String(20), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("prefix", sa.String(10), nullable=False, server_default="RD-"),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_qr_batches_promoter_id", "qr_batches", ["promoter_id"])

    op.create_table(
        "qr_codes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("batch_id", UUID(as_uuid=True), sa.ForeignKey("qr_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("pass_id", sa.String(20), unique=True, nullable=False),
        sa.Column("converted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("registered_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_qr_codes_batch_id", "qr_codes", ["batch_id"])
    op.create_index("ix_qr_codes_pass_id", "qr_codes", ["pass_id"])


def downgrade() -> None:
    op.drop_table("qr_codes")
    op.drop_table("qr_batches")
