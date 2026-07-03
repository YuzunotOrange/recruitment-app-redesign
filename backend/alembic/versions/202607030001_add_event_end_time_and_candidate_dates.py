"""add event end time and candidate dates

Revision ID: 202607030001
Revises: 202607020001
Create Date: 2026-07-03 00:01:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202607030001"
down_revision: Union[str, None] = "202607020001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("events") as batch_op:
        batch_op.add_column(sa.Column("end_time", sa.Time(), nullable=True))

    op.create_table(
        "event_candidate_dates",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("is_selected", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["event_id"], ["events.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_event_candidate_dates_event_id"), "event_candidate_dates", ["event_id"], unique=False)
    op.create_index(op.f("ix_event_candidate_dates_id"), "event_candidate_dates", ["id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_event_candidate_dates_id"), table_name="event_candidate_dates")
    op.drop_index(op.f("ix_event_candidate_dates_event_id"), table_name="event_candidate_dates")
    op.drop_table("event_candidate_dates")
    with op.batch_alter_table("events") as batch_op:
        batch_op.drop_column("end_time")
