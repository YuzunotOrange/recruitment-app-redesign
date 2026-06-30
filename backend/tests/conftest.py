from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import Base, get_db
from app.main import app
from app.models import Company, Event, Notification, ReminderSettings, User  # noqa: F401


@pytest.fixture()
def test_session_factory(tmp_path):
    database_url = f"sqlite:///{tmp_path / 'test.db'}"
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    Base.metadata.create_all(bind=engine)
    yield TestingSessionLocal
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def db_session(test_session_factory) -> Generator[Session, None, None]:
    db = test_session_factory()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture()
def client(test_session_factory) -> Generator[TestClient, None, None]:
    def override_get_db() -> Generator[Session, None, None]:
        db = test_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def register_user(
    client: TestClient,
    email: str = "user@example.com",
    password: str = "password123",
    name: str = "Test User",
) -> dict:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": password,
            "name": name,
            "graduation_year": 2027,
        },
    )
    assert response.status_code == 201
    return response.json()


@pytest.fixture()
def auth_token(client: TestClient) -> str:
    return register_user(client)["access_token"]


@pytest.fixture()
def auth_headers(auth_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {auth_token}"}


@pytest.fixture()
def second_user_headers(client: TestClient) -> dict[str, str]:
    token = register_user(client, email="second@example.com", name="Second User")["access_token"]
    return {"Authorization": f"Bearer {token}"}
