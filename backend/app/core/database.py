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
    from app.models import company, event, notification, user  # noqa: F401

    Base.metadata.create_all(bind=engine)
    ensure_reminder_settings_columns()


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
