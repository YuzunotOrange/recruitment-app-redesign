from sqlalchemy import create_mock_engine

from app.core.database import Base
from app.models import Company, Event, User  # noqa: F401


def test_create_all_compiles_for_postgresql():
    statements: list[str] = []

    def collect(sql, *multiparams, **params):
        statements.append(str(sql.compile(dialect=engine.dialect)))

    engine = create_mock_engine("postgresql+psycopg2://", collect)

    Base.metadata.create_all(bind=engine)

    ddl = "\n".join(statements)
    assert "CREATE TABLE users" in ddl
    assert "CREATE TABLE companies" in ddl
    assert "CREATE TABLE events" in ddl
