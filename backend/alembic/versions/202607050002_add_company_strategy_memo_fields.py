"""add company strategy memo fields

Revision ID: 202607050002
Revises: 202607050001
Create Date: 2026-07-05 00:02:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202607050002"
down_revision: Union[str, None] = "202607050001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("companies") as batch_op:
        batch_op.add_column(sa.Column("strategy_reason", sa.Text(), nullable=True))
        batch_op.add_column(sa.Column("user_strategy_note", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("companies") as batch_op:
        batch_op.drop_column("user_strategy_note")
        batch_op.drop_column("strategy_reason")
