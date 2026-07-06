"""add company notebook fields

Revision ID: 202607060002
Revises: 202607060001
Create Date: 2026-07-06 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "202607060002"
down_revision = "202607060001"
branch_labels = None
depends_on = None


NOTEBOOK_COLUMNS = [
    "es_motivation_draft",
    "es_research_connection",
    "es_project_connection",
    "es_appeal_points",
    "es_missing_information",
    "interview_expected_questions",
    "interview_stories",
    "interview_reverse_questions",
    "interview_reflection",
    "personal_notes",
]


def upgrade() -> None:
    for column_name in NOTEBOOK_COLUMNS:
        op.add_column("companies", sa.Column(column_name, sa.Text(), nullable=True))


def downgrade() -> None:
    for column_name in reversed(NOTEBOOK_COLUMNS):
        op.drop_column("companies", column_name)
