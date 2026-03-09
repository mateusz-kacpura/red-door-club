"""add_corporate_tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-03-09 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "corporate_accounts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("company_name", sa.String(255), nullable=False),
        sa.Column("billing_contact_name", sa.String(255), nullable=False),
        sa.Column("billing_contact_email", sa.String(255), nullable=False),
        sa.Column("billing_address", sa.Text(), nullable=False, server_default="''"),
        sa.Column("vat_number", sa.String(100), nullable=True),
        sa.Column("package_type", sa.String(50), nullable=False, server_default="'starter'"),
        sa.Column("max_seats", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("active_seats", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("annual_fee", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("renewal_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="'active'"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.create_table(
        "corporate_members",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("corporate_id", UUID(as_uuid=True), sa.ForeignKey("corporate_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("member_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="'member'"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("corporate_members_corporate_id_idx", "corporate_members", ["corporate_id"])


def downgrade() -> None:
    op.drop_index("corporate_members_corporate_id_idx")
    op.drop_table("corporate_members")
    op.drop_table("corporate_accounts")
