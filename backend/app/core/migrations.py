from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import Connection

from app import models  # noqa: F401
from app.core.config import get_settings
from app.core.database import Base


ALEMBIC_VERSION_TABLE = "alembic_version"


def get_alembic_config() -> Config:
    backend_dir = Path(__file__).resolve().parents[2]
    config = Config(str(backend_dir / "alembic.ini"))
    config.set_main_option("script_location", str(backend_dir / "alembic"))
    config.set_main_option("sqlalchemy.url", get_settings().database_url)
    return config


def model_table_names() -> set[str]:
    return set(Base.metadata.tables.keys())


def existing_model_tables(connection: Connection) -> set[str]:
    existing = set(inspect(connection).get_table_names())
    return existing & model_table_names()


def should_stamp_existing_baseline(connection: Connection) -> bool:
    existing = set(inspect(connection).get_table_names())
    if ALEMBIC_VERSION_TABLE in existing:
        return False

    model_tables = model_table_names()
    existing_models = existing & model_tables
    if not existing_models:
        return False

    if existing_models == model_tables:
        return True

    missing = ", ".join(sorted(model_tables - existing_models))
    present = ", ".join(sorted(existing_models))
    raise RuntimeError(
        "Database has a partial pre-Alembic schema. "
        f"Present model tables: {present}. Missing model tables: {missing}. "
        "Back up the database and fix the schema before running migrations."
    )


def migrate_database() -> None:
    settings = get_settings()
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
    config = get_alembic_config()

    try:
        with engine.connect() as connection:
            stamp_existing = should_stamp_existing_baseline(connection)

        if stamp_existing:
            command.stamp(config, "head")

        command.upgrade(config, "head")
    finally:
        engine.dispose()


if __name__ == "__main__":
    migrate_database()
