"""add user profiles

Revision ID: 202607060003
Revises: 202607060002
Create Date: 2026-07-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "202607060003"
down_revision = "202607060002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("education", sa.Text(), nullable=True),
        sa.Column("major", sa.Text(), nullable=True),
        sa.Column("research_theme", sa.Text(), nullable=True),
        sa.Column("research_summary", sa.Text(), nullable=True),
        sa.Column("skills", sa.JSON(), nullable=False),
        sa.Column("programming_languages", sa.JSON(), nullable=False),
        sa.Column("frameworks", sa.JSON(), nullable=False),
        sa.Column("projects", sa.JSON(), nullable=False),
        sa.Column("internship_experience", sa.Text(), nullable=True),
        sa.Column("qualifications", sa.Text(), nullable=True),
        sa.Column("certifications", sa.Text(), nullable=True),
        sa.Column("interests", sa.Text(), nullable=True),
        sa.Column("preferred_industries", sa.Text(), nullable=True),
        sa.Column("preferred_jobs", sa.Text(), nullable=True),
        sa.Column("preferred_locations", sa.Text(), nullable=True),
        sa.Column("global_interest", sa.Text(), nullable=True),
        sa.Column("career_goal", sa.Text(), nullable=True),
        sa.Column("self_strengths", sa.Text(), nullable=True),
        sa.Column("self_weaknesses", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("user_profiles")
