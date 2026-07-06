"""add company research

Revision ID: 202607060001
Revises: 202607050002
Create Date: 2026-07-06 00:01:00
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "202607060001"
down_revision: Union[str, None] = "202607050002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "company_research",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("company_overview", sa.Text(), nullable=False),
        sa.Column("business_summary", sa.Text(), nullable=False),
        sa.Column("salary_level", sa.Integer(), nullable=False),
        sa.Column("difficulty_level", sa.Integer(), nullable=False),
        sa.Column("stability", sa.Integer(), nullable=False),
        sa.Column("growth", sa.Integer(), nullable=False),
        sa.Column("global", sa.Integer(), nullable=False),
        sa.Column("dx", sa.Integer(), nullable=False),
        sa.Column("work_life_balance", sa.Integer(), nullable=False),
        sa.Column("recommended_people", sa.Text(), nullable=False),
        sa.Column("research_summary", sa.Text(), nullable=False),
        sa.Column("strengths", sa.Text(), nullable=False),
        sa.Column("weaknesses", sa.Text(), nullable=False),
        sa.Column("selection_process", sa.Text(), nullable=False),
        sa.Column("selection_points", sa.Text(), nullable=False),
        sa.Column("ai_strategy_position", sa.String(length=20), nullable=False),
        sa.Column("sources", sa.JSON(), nullable=False),
        sa.Column("provider", sa.String(length=50), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("accepted", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_company_research_company_id"), "company_research", ["company_id"], unique=False)
    op.create_index(op.f("ix_company_research_id"), "company_research", ["id"], unique=False)
    op.create_index(op.f("ix_company_research_user_id"), "company_research", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_company_research_user_id"), table_name="company_research")
    op.drop_index(op.f("ix_company_research_id"), table_name="company_research")
    op.drop_index(op.f("ix_company_research_company_id"), table_name="company_research")
    op.drop_table("company_research")
