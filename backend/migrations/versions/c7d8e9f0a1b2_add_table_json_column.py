"""add_table_json_column

Revision ID: c7d8e9f0a1b2
Revises: f6e4d2c8b0a1
Create Date: 2026-06-11 14:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c7d8e9f0a1b2"
down_revision: Union[str, None] = "f6e4d2c8b0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("annotations", sa.Column("table_json", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("annotations", "table_json")
