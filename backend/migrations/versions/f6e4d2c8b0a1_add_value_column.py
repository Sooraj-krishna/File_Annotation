"""add_value_column

Revision ID: f6e4d2c8b0a1
Revises: 83f934edc6b6
Create Date: 2026-06-11 13:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f6e4d2c8b0a1"
down_revision: Union[str, None] = "83f934edc6b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("annotations", sa.Column("value", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("annotations", "value")
