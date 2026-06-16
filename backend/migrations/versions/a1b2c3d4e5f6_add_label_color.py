"""add label_color column

Revision ID: a1b2c3d4e5f6
Revises: e5e7b2c1f3d4
Create Date: 2026-06-09 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "e5e7b2c1f3d4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "annotations",
        sa.Column("label_color", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("annotations", "label_color")
