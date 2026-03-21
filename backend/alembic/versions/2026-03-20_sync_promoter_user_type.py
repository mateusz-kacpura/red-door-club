"""sync_promoter_user_type

Set user_type='promoter' for existing users who have is_promoter=true.

Revision ID: b3c4d5e6f7a8
Revises: a1b2c3d4e5f6
Create Date: 2026-03-20 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE users SET user_type = 'promoter' WHERE is_promoter = true AND user_type != 'promoter'"
    )


def downgrade() -> None:
    # Cannot reliably reverse — we don't know what the original user_type was
    pass
