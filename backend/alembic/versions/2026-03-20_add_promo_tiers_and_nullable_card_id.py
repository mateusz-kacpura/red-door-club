"""add_promo_tiers_and_nullable_card_id

Add promo_tiers column to events table and make tap_events.card_id nullable
for QR-based entries that have no NFC card.

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-03-20 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY


revision: str = "c4d5e6f7a8b9"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add promo_tiers array column to events
    op.add_column(
        "events",
        sa.Column(
            "promo_tiers",
            ARRAY(sa.String()),
            server_default=sa.text("'{}'::varchar[]"),
            nullable=False,
        ),
    )

    # Make tap_events.card_id nullable (QR entries have no NFC card)
    op.alter_column(
        "tap_events",
        "card_id",
        existing_type=sa.String(50),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "tap_events",
        "card_id",
        existing_type=sa.String(50),
        nullable=False,
    )
    op.drop_column("events", "promo_tiers")
