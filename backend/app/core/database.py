from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from app.models import company, company_research, event, notification, push_subscription, task, user, user_profile  # noqa: F401

    Base.metadata.create_all(bind=engine)
    ensure_user_columns()
    ensure_event_columns()
    ensure_company_notebook_columns()
    ensure_reminder_settings_columns()


def ensure_user_columns() -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    if "theme" in existing_columns:
        return

    dialect = engine.dialect.name
    with engine.begin() as connection:
        if dialect == "postgresql":
            connection.execute(
                text("ALTER TABLE users ADD COLUMN IF NOT EXISTS theme VARCHAR(20) NOT NULL DEFAULT 'light'")
            )
        else:
            connection.execute(text("ALTER TABLE users ADD COLUMN theme VARCHAR(20) NOT NULL DEFAULT 'light'"))


def ensure_event_columns() -> None:
    inspector = inspect(engine)
    if "events" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("events")}
    if "end_time" in existing_columns:
        return

    dialect = engine.dialect.name
    with engine.begin() as connection:
        if dialect == "postgresql":
            connection.execute(text("ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TIME"))
        else:
            connection.execute(text("ALTER TABLE events ADD COLUMN end_time TIME"))


def ensure_company_notebook_columns() -> None:
    inspector = inspect(engine)
    if "companies" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("companies")}
    columns = [
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

    dialect = engine.dialect.name
    with engine.begin() as connection:
        for column_name in columns:
            if column_name in existing_columns:
                continue
            if dialect == "postgresql":
                connection.execute(text(f"ALTER TABLE companies ADD COLUMN IF NOT EXISTS {column_name} TEXT"))
            else:
                connection.execute(text(f"ALTER TABLE companies ADD COLUMN {column_name} TEXT"))


def ensure_reminder_settings_columns() -> None:
    inspector = inspect(engine)
    if "reminder_settings" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("reminder_settings")}
    columns = {
        "es_deadline_enabled": True,
        "interview_enabled": True,
        "internship_enabled": True,
        "info_session_enabled": True,
        "offer_enabled": True,
        "weekly_summary_enabled": False,
    }

    dialect = engine.dialect.name
    with engine.begin() as connection:
        for column_name, default in columns.items():
            if column_name in existing_columns:
                continue
            if dialect == "postgresql":
                default_sql = "true" if default else "false"
                connection.execute(
                    text(
                        f"ALTER TABLE reminder_settings "
                        f"ADD COLUMN IF NOT EXISTS {column_name} BOOLEAN NOT NULL DEFAULT {default_sql}"
                    )
                )
            else:
                default_sql = 1 if default else 0
                connection.execute(
                    text(
                        f"ALTER TABLE reminder_settings "
                        f"ADD COLUMN {column_name} BOOLEAN NOT NULL DEFAULT {default_sql}"
                    )
                )

        if "weekly_summary_last_sent_at" not in existing_columns:
            if dialect == "postgresql":
                connection.execute(
                    text(
                        "ALTER TABLE reminder_settings "
                        "ADD COLUMN IF NOT EXISTS weekly_summary_last_sent_at TIMESTAMP WITH TIME ZONE"
                    )
                )
            else:
                connection.execute(
                    text("ALTER TABLE reminder_settings ADD COLUMN weekly_summary_last_sent_at DATETIME")
                )
