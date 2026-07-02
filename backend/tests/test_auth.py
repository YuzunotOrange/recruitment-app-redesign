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
    assert response.json()["theme"] == "light"


def test_me_without_token_rejected(client: TestClient):
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_update_theme_success(client: TestClient, auth_headers: dict[str, str]):
    response = client.patch("/auth/me/theme", headers=auth_headers, json={"theme": "cyberpunk"})

    assert response.status_code == 200
    assert response.json()["theme"] == "cyberpunk"

    me_response = client.get("/auth/me", headers=auth_headers)
    assert me_response.status_code == 200
    assert me_response.json()["theme"] == "cyberpunk"


def test_update_theme_rejects_invalid_value(client: TestClient, auth_headers: dict[str, str]):
    response = client.patch("/auth/me/theme", headers=auth_headers, json={"theme": "neon"})

    assert response.status_code == 422


def test_update_theme_without_token_rejected(client: TestClient):
    response = client.patch("/auth/me/theme", json={"theme": "dark"})

    assert response.status_code == 401


def test_update_theme_is_user_scoped(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
):
    response = client.patch("/auth/me/theme", headers=auth_headers, json={"theme": "cyberpunk"})
    assert response.status_code == 200

    first_me = client.get("/auth/me", headers=auth_headers)
    second_me = client.get("/auth/me", headers=second_user_headers)

    assert first_me.json()["theme"] == "cyberpunk"
    assert second_me.json()["theme"] == "light"


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



def test_login_sets_httponly_cookies_and_refresh_works(client: TestClient):
    register_user(client, email="cookie@example.com", password="password123")

    response = client.post(
        "/auth/login",
        json={"email": "cookie@example.com", "password": "password123"},
    )

    assert response.status_code == 200
    set_cookie = ", ".join(response.headers.get_list("set-cookie"))
    assert "careertrack_access_token" in set_cookie
    assert "careertrack_refresh_token" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "SameSite" in set_cookie

    refresh = client.post("/auth/refresh")
    assert refresh.status_code == 200
    assert refresh.json()["access_token"]


def test_logout_clears_auth_cookies(client: TestClient):
    register_user(client, email="logout@example.com", password="password123")
    login = client.post("/auth/login", json={"email": "logout@example.com", "password": "password123"})
    assert login.status_code == 200

    response = client.post("/auth/logout")
    assert response.status_code == 200
    set_cookie = ", ".join(response.headers.get_list("set-cookie"))
    assert "careertrack_access_token" in set_cookie
    assert "Max-Age=0" in set_cookie


def test_login_failure_rate_limit(client: TestClient):
    register_user(client, email="limit@example.com", password="password123")

    for _ in range(5):
        response = client.post("/auth/login", json={"email": "limit@example.com", "password": "wrong123"})
        assert response.status_code == 401

    locked = client.post("/auth/login", json={"email": "limit@example.com", "password": "password123"})
    assert locked.status_code == 429


def test_weak_password_rejected(client: TestClient):
    response = client.post(
        "/auth/register",
        json={"email": "weak@example.com", "password": "password", "name": "Weak User", "graduation_year": 2027},
    )
    assert response.status_code == 422


def test_password_reset_foundation(client: TestClient):
    register_user(client, email="reset@example.com", password="password123")
    requested = client.post("/auth/password-reset/request", json={"email": "reset@example.com"})
    assert requested.status_code == 200
    token = requested.json()["reset_token"]
    assert token

    confirmed = client.post(
        "/auth/password-reset/confirm",
        json={"token": token, "new_password": "resetpass123"},
    )
    assert confirmed.status_code == 200

    login = client.post("/auth/login", json={"email": "reset@example.com", "password": "resetpass123"})
    assert login.status_code == 200
