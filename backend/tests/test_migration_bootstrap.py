import pytest
from sqlalchemy import create_engine, text

from app.core.database import Base
from app.core.migrations import should_stamp_existing_baseline
from app.models import Company, Event, Notification, ReminderSettings, User  # noqa: F401


def test_empty_database_does_not_need_baseline_stamp(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'empty.db'}")
    try:
        with engine.connect() as connection:
            assert should_stamp_existing_baseline(connection) is False
    finally:
        engine.dispose()


def test_existing_pre_alembic_schema_is_stamped(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'existing.db'}")
    try:
        Base.metadata.create_all(engine)
        with engine.connect() as connection:
            assert should_stamp_existing_baseline(connection) is True
    finally:
        Base.metadata.drop_all(engine)
        engine.dispose()


def test_partial_pre_alembic_schema_raises_clear_error(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'partial.db'}")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))

        with engine.connect() as connection:
            with pytest.raises(RuntimeError, match="partial pre-Alembic schema"):
                should_stamp_existing_baseline(connection)
    finally:
        engine.dispose()
