"""add company strategy fields

Revision ID: 202607050001
Revises: 202607030001
Create Date: 2026-07-05 00:01:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202607050001"
down_revision: Union[str, None] = "202607030001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("companies") as batch_op:
        batch_op.add_column(sa.Column("strategy_rank", sa.String(length=1), server_default="A", nullable=False))
        batch_op.add_column(sa.Column("difficulty_level", sa.Integer(), server_default="3", nullable=False))
        batch_op.add_column(sa.Column("fit_score", sa.Integer(), server_default="50", nullable=False))
        batch_op.add_column(sa.Column("success_probability", sa.Integer(), server_default="50", nullable=False))
        batch_op.add_column(sa.Column("selection_risk", sa.String(length=20), server_default="Unknown", nullable=False))
        batch_op.add_column(sa.Column("recommended_action", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("companies") as batch_op:
        batch_op.drop_column("recommended_action")
        batch_op.drop_column("selection_risk")
        batch_op.drop_column("success_probability")
        batch_op.drop_column("fit_score")
        batch_op.drop_column("difficulty_level")
        batch_op.drop_column("strategy_rank")
