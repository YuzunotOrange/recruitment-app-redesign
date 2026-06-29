from fastapi.testclient import TestClient

from tests.conftest import register_user


def test_register_success(client: TestClient):
    data = register_user(client, email="new@example.com", name="New User")

    assert data["token_type"] == "bearer"
    assert data["access_token"]
    assert data["user"]["email"] == "new@example.com"
    assert data["user"]["name"] == "New User"
    assert "hashed_password" not in data["user"]


def test_duplicate_email_rejected(client: TestClient):
    register_user(client, email="dupe@example.com")

    response = client.post(
        "/auth/register",
        json={
            "email": "DUPE@example.com",
            "password": "password123",
            "name": "Duplicate User",
            "graduation_year": 2027,
        },
    )

    assert response.status_code == 409


def test_login_success(client: TestClient):
    register_user(client, email="login@example.com", password="password123")

    response = client.post(
        "/auth/login",
        json={"email": "login@example.com", "password": "password123"},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]


def test_login_wrong_password_rejected(client: TestClient):
    register_user(client, email="wrong@example.com", password="password123")

    response = client.post(
        "/auth/login",
        json={"email": "wrong@example.com", "password": "bad-password"},
    )

    assert response.status_code == 401


def test_me_with_valid_token(client: TestClient, auth_headers: dict[str, str]):
    response = client.get("/auth/me", headers=auth_headers)

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


def test_me_without_token_rejected(client: TestClient):
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_change_password_success_old_password_rejected_and_new_password_works(client: TestClient):
    register_user(client, email="change@example.com", password="oldpassword123")
    login_response = client.post(
        "/auth/login",
        json={"email": "change@example.com", "password": "oldpassword123"},
    )
    token = login_response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/auth/change-password",
        headers=headers,
        json={"current_password": "oldpassword123", "new_password": "newpassword123"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Password changed successfully."

    old_login = client.post(
        "/auth/login",
        json={"email": "change@example.com", "password": "oldpassword123"},
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/auth/login",
        json={"email": "change@example.com", "password": "newpassword123"},
    )
    assert new_login.status_code == 200
    assert new_login.json()["access_token"]


def test_change_password_wrong_current_password_rejected(client: TestClient, auth_headers: dict[str, str]):
    response = client.post(
        "/auth/change-password",
        headers=auth_headers,
        json={"current_password": "wrong-password", "new_password": "newpassword123"},
    )

    assert response.status_code == 400


def test_change_password_without_token_rejected(client: TestClient):
    response = client.post(
        "/auth/change-password",
        json={"current_password": "password123", "new_password": "newpassword123"},
    )

    assert response.status_code == 401
