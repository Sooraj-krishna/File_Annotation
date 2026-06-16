"""add label_position_json column

Revision ID: e5e7b2c1f3d4
Revises: 081eaae3c45e
Create Date: 2026-06-09 13:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e5e7b2c1f3d4"
down_revision: Union[str, None] = "081eaae3c45e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "annotations",
        sa.Column("label_position_json", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("annotations", "label_position_json")
