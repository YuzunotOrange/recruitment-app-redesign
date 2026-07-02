from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.services.notifications import JST


def current_user_id(client: TestClient, headers: dict[str, str]) -> int:
    response = client.get("/auth/me", headers=headers)
    assert response.status_code == 200
    return response.json()["id"]


def create_notification(db: Session, user_id: int, **overrides) -> Notification:
    payload = {
        "user_id": user_id,
        "title": "Deadline reminder",
        "message": "ES deadline is coming soon.",
        "type": "deadline",
        "related_type": "company",
        "related_id": 1,
        "scheduled_at": datetime.now(UTC) + timedelta(days=1),
    }
    payload.update(overrides)
    notification = Notification(**payload)
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


def test_notification_list_mark_read_read_all_and_delete(
    client: TestClient,
    db_session: Session,
    auth_headers: dict[str, str],
):
    user_id = current_user_id(client, auth_headers)
    first = create_notification(db_session, user_id)
    second = create_notification(db_session, user_id, title="Interview reminder", type="interview", related_type="event")

    listed = client.get("/notifications", headers=auth_headers)
    assert listed.status_code == 200
    assert {item["id"] for item in listed.json()} == {first.id, second.id}
    assert all(item["is_read"] is False for item in listed.json())

    marked = client.patch(f"/notifications/{first.id}/read", headers=auth_headers)
    assert marked.status_code == 200
    assert marked.json()["id"] == first.id
    assert marked.json()["is_read"] is True

    read_all = client.patch("/notifications/read-all", headers=auth_headers)
    assert read_all.status_code == 200
    assert read_all.json()["updated"] == 1

    deleted = client.delete(f"/notifications/{second.id}", headers=auth_headers)
    assert deleted.status_code == 204

    remaining = client.get("/notifications", headers=auth_headers)
    assert remaining.status_code == 200
    assert [item["id"] for item in remaining.json()] == [first.id]


def test_past_scheduled_notifications_are_hidden(
    client: TestClient,
    db_session: Session,
    auth_headers: dict[str, str],
):
    user_id = current_user_id(client, auth_headers)
    past = create_notification(db_session, user_id, title="Past", scheduled_at=datetime.now(JST) - timedelta(days=1))
    future = create_notification(db_session, user_id, title="Future", scheduled_at=datetime.now(JST) + timedelta(days=1))

    listed = client.get("/notifications", headers=auth_headers)
    assert listed.status_code == 200
    assert [item["id"] for item in listed.json()] == [future.id]
    assert past.id not in {item["id"] for item in listed.json()}


def test_notification_user_isolation(
    client: TestClient,
    db_session: Session,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
):
    user_a_id = current_user_id(client, auth_headers)
    user_b_id = current_user_id(client, second_user_headers)
    user_a_notification = create_notification(db_session, user_a_id, title="User A")
    user_b_notification = create_notification(db_session, user_b_id, title="User B")

    user_a_list = client.get("/notifications", headers=auth_headers)
    assert user_a_list.status_code == 200
    assert [item["id"] for item in user_a_list.json()] == [user_a_notification.id]

    assert client.patch(f"/notifications/{user_b_notification.id}/read", headers=auth_headers).status_code == 404
    assert client.delete(f"/notifications/{user_b_notification.id}", headers=auth_headers).status_code == 404

    read_all = client.patch("/notifications/read-all", headers=auth_headers)
    assert read_all.status_code == 200
    assert read_all.json()["updated"] == 1

    user_b_list = client.get("/notifications", headers=second_user_headers)
    assert user_b_list.status_code == 200
    assert user_b_list.json()[0]["id"] == user_b_notification.id
    assert user_b_list.json()[0]["is_read"] is False


def test_reminder_settings_get_update_and_user_isolation(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
):
    initial = client.get("/reminder-settings", headers=auth_headers)
    assert initial.status_code == 200
    assert initial.json()["deadline_7days"] is True
    assert initial.json()["email_enabled"] is False

    updated = client.put(
        "/reminder-settings",
        headers=auth_headers,
        json={
            "deadline_7days": False,
            "interview_30min": True,
            "email_enabled": True,
            "push_enabled": True,
        },
    )
    assert updated.status_code == 200
    assert updated.json()["deadline_7days"] is False
    assert updated.json()["interview_30min"] is True
    assert updated.json()["email_enabled"] is True
    assert updated.json()["push_enabled"] is True

    second_user_settings = client.get("/reminder-settings", headers=second_user_headers)
    assert second_user_settings.status_code == 200
    assert second_user_settings.json()["deadline_7days"] is True
    assert second_user_settings.json()["email_enabled"] is False
    assert second_user_settings.json()["user_id"] != updated.json()["user_id"]


def test_company_create_update_generates_deadline_and_offer_notifications(
    client: TestClient,
    auth_headers: dict[str, str],
):
    today = datetime.now(JST).date()
    deadline_date = today + timedelta(days=14)
    created = client.post(
        "/companies",
        headers=auth_headers,
        json={
            "name": "Notify Corp",
            "industry": "it",
            "priority": "A",
            "importance": 4,
            "status": "planned",
            "es_deadline": deadline_date.isoformat(),
            "note": None,
        },
    )
    assert created.status_code == 201
    company_id = created.json()["id"]

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert [item for item in notifications.json() if item["type"] == "deadline"] == []

    changed = client.put(f"/companies/{company_id}", headers=auth_headers, json={"es_deadline": (today + timedelta(days=7)).isoformat()})
    assert changed.status_code == 200

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    deadline_notifications = [item for item in notifications.json() if item["type"] == "deadline"]
    assert len(deadline_notifications) == 1
    assert deadline_notifications[0]["related_type"] == "company"
    assert deadline_notifications[0]["related_id"] == company_id
    assert deadline_notifications[0]["title"] == "ES Deadline"
    assert deadline_notifications[0]["message"] == "ES deadline for Notify Corp is in 7 days."
    assert deadline_notifications[0]["scheduled_at"][:10] == today.isoformat()

    original_id = deadline_notifications[0]["id"]
    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    deadline_notifications = [item for item in notifications.json() if item["type"] == "deadline"]
    assert [item["id"] for item in deadline_notifications] == [original_id]

    changed = client.put(f"/companies/{company_id}", headers=auth_headers, json={"es_deadline": (today + timedelta(days=10)).isoformat()})
    assert changed.status_code == 200
    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert [item for item in notifications.json() if item["type"] == "deadline"] == []

    updated = client.put(f"/companies/{company_id}", headers=auth_headers, json={"status": "offer"})
    assert updated.status_code == 200

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    data = notifications.json()
    assert [item for item in data if item["type"] == "deadline"] == []
    assert len([item for item in data if item["type"] == "offer"]) == 1

    deleted = client.delete(f"/companies/{company_id}", headers=auth_headers)
    assert deleted.status_code == 204
    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert notifications.json() == []


def test_company_deadline_uses_exact_reminder_day_and_message(client: TestClient, auth_headers: dict[str, str]):
    today = datetime.now(JST).date()
    created = client.post(
        "/companies",
        headers=auth_headers,
        json={
            "name": "Soon Corp",
            "industry": "it",
            "priority": "A",
            "importance": 4,
            "status": "planned",
            "es_deadline": (today + timedelta(days=2)).isoformat(),
            "note": None,
        },
    )
    assert created.status_code == 201
    company_id = created.json()["id"]

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert [item for item in notifications.json() if item["type"] == "deadline"] == []

    updated = client.put(f"/companies/{company_id}", headers=auth_headers, json={"es_deadline": (today + timedelta(days=1)).isoformat()})
    assert updated.status_code == 200
    notifications = client.get("/notifications", headers=auth_headers)
    deadline_notifications = [item for item in notifications.json() if item["type"] == "deadline"]
    assert len(deadline_notifications) == 1
    assert deadline_notifications[0]["message"] == "ES deadline for Soon Corp is tomorrow."

    updated = client.put(f"/companies/{company_id}", headers=auth_headers, json={"es_deadline": today.isoformat()})
    assert updated.status_code == 200
    notifications = client.get("/notifications", headers=auth_headers)
    deadline_notifications = [item for item in notifications.json() if item["type"] == "deadline"]
    assert len(deadline_notifications) == 1
    assert deadline_notifications[0]["message"] == "ES deadline for Soon Corp is today."


def test_deadline_notification_uses_jst_today_and_prevents_duplicates(
    client: TestClient,
    auth_headers: dict[str, str],
    monkeypatch,
):
    import app.services.notifications as notification_service

    monkeypatch.setattr(notification_service, "today_jst", lambda: date(2026, 7, 2))
    created = client.post(
        "/companies",
        headers=auth_headers,
        json={
            "name": "Calendar Corp",
            "industry": "it",
            "priority": "A",
            "importance": 4,
            "status": "planned",
            "es_deadline": "2026-07-12",
            "note": None,
        },
    )
    assert created.status_code == 201

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert [item for item in notifications.json() if item["type"] == "deadline"] == []

    monkeypatch.setattr(notification_service, "today_jst", lambda: date(2026, 7, 5))
    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    deadline_notifications = [item for item in notifications.json() if item["type"] == "deadline"]
    assert len(deadline_notifications) == 1
    assert deadline_notifications[0]["message"] == "ES deadline for Calendar Corp is in 7 days."
    first_id = deadline_notifications[0]["id"]

    notifications = client.get("/notifications", headers=auth_headers)
    deadline_notifications = [item for item in notifications.json() if item["type"] == "deadline"]
    assert [item["id"] for item in deadline_notifications] == [first_id]

    monkeypatch.setattr(notification_service, "today_jst", lambda: date(2026, 7, 12))
    notifications = client.get("/notifications", headers=auth_headers)
    deadline_notifications = [item for item in notifications.json() if item["type"] == "deadline"]
    assert len(deadline_notifications) == 1
    assert deadline_notifications[0]["id"] == first_id
    assert deadline_notifications[0]["message"] == "ES deadline for Calendar Corp is today."


def test_es_deadline_notifications_respect_reminder_settings(
    client: TestClient,
    auth_headers: dict[str, str],
):
    disabled = client.put("/reminder-settings", headers=auth_headers, json={"es_deadline_enabled": False})
    assert disabled.status_code == 200

    today = datetime.now(JST).date()
    deadline_date = today + timedelta(days=14)
    created = client.post(
        "/companies",
        headers=auth_headers,
        json={
            "name": "No ES Corp",
            "industry": "it",
            "priority": "A",
            "importance": 4,
            "status": "planned",
            "es_deadline": deadline_date.isoformat(),
            "note": None,
        },
    )
    assert created.status_code == 201
    company_id = created.json()["id"]

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert [item for item in notifications.json() if item["type"] == "deadline"] == []

    enabled = client.put("/reminder-settings", headers=auth_headers, json={"es_deadline_enabled": True})
    assert enabled.status_code == 200
    updated = client.put(
        f"/companies/{company_id}",
        headers=auth_headers,
        json={"es_deadline": (today + timedelta(days=7)).isoformat()},
    )
    assert updated.status_code == 200

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert len([item for item in notifications.json() if item["type"] == "deadline"]) == 1

    disabled_day = client.put("/reminder-settings", headers=auth_headers, json={"deadline_7days": False})
    assert disabled_day.status_code == 200
    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert [item for item in notifications.json() if item["type"] == "deadline"] == []

    enabled_day = client.put("/reminder-settings", headers=auth_headers, json={"deadline_7days": True})
    assert enabled_day.status_code == 200
    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert len([item for item in notifications.json() if item["type"] == "deadline"]) == 1


def test_interview_notifications_respect_reminder_settings(
    client: TestClient,
    auth_headers: dict[str, str],
):
    disabled = client.put("/reminder-settings", headers=auth_headers, json={"interview_enabled": False})
    assert disabled.status_code == 200

    start_day = datetime.now(JST).date() + timedelta(days=5)
    created = client.post(
        "/events",
        headers=auth_headers,
        json={
            "company_id": None,
            "title": "Hidden Interview",
            "start_date": start_day.isoformat(),
            "end_date": start_day.isoformat(),
            "start_time": "13:00",
            "type": "interview",
            "note": None,
        },
    )
    assert created.status_code == 201
    event_id = created.json()["id"]

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert [item for item in notifications.json() if item["type"] == "interview"] == []

    enabled = client.put("/reminder-settings", headers=auth_headers, json={"interview_enabled": True})
    assert enabled.status_code == 200
    updated = client.put(f"/events/{event_id}", headers=auth_headers, json={"title": "Visible Interview"})
    assert updated.status_code == 200

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert len([item for item in notifications.json() if item["type"] == "interview"]) == 2


def test_notification_settings_are_user_scoped(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
):
    assert client.put("/reminder-settings", headers=auth_headers, json={"es_deadline_enabled": False}).status_code == 200

    deadline_date = datetime.now(JST).date() + timedelta(days=14)
    first = client.post(
        "/companies",
        headers=auth_headers,
        json={"name": "First Corp", "industry": "it", "priority": "A", "importance": 4, "status": "planned", "es_deadline": deadline_date.isoformat()},
    )
    second = client.post(
        "/companies",
        headers=second_user_headers,
        json={"name": "Second Corp", "industry": "it", "priority": "A", "importance": 4, "status": "planned", "es_deadline": deadline_date.isoformat()},
    )
    assert first.status_code == 201
    assert second.status_code == 201

    first_notifications = client.get("/notifications", headers=auth_headers)
    second_notifications = client.get("/notifications", headers=second_user_headers)
    assert first_notifications.status_code == 200
    assert second_notifications.status_code == 200
    assert [item for item in first_notifications.json() if item["type"] == "deadline"] == []
    assert [item for item in second_notifications.json() if item["type"] == "deadline"] == []


def test_notifications_response_filters_disabled_types(
    client: TestClient,
    db_session: Session,
    auth_headers: dict[str, str],
):
    user_id = current_user_id(client, auth_headers)
    visible = create_notification(db_session, user_id, title="Interview", type="interview", related_type="event")
    hidden = create_notification(db_session, user_id, title="Deadline", type="deadline", related_type="company")

    disabled = client.put("/reminder-settings", headers=auth_headers, json={"es_deadline_enabled": False})
    assert disabled.status_code == 200

    listed = client.get("/notifications", headers=auth_headers)
    assert listed.status_code == 200
    ids = {item["id"] for item in listed.json()}
    assert visible.id in ids
    assert hidden.id not in ids


def test_event_create_update_generates_interview_and_internship_notifications(
    client: TestClient,
    auth_headers: dict[str, str],
):
    start_day = datetime.now(UTC).date() + timedelta(days=5)
    created = client.post(
        "/events",
        headers=auth_headers,
        json={
            "company_id": None,
            "title": "Final Interview",
            "start_date": start_day.isoformat(),
            "end_date": start_day.isoformat(),
            "start_time": "13:00",
            "type": "interview",
            "note": None,
        },
    )
    assert created.status_code == 201
    event_id = created.json()["id"]

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    interview_notifications = [item for item in notifications.json() if item["type"] == "interview"]
    assert len(interview_notifications) == 2
    assert {item["related_type"] for item in interview_notifications} == {"event"}
    assert {item["related_id"] for item in interview_notifications} == {event_id}
    assert {item["title"] for item in interview_notifications} == {"Interview Reminder"}
    assert [item["scheduled_at"][:10] for item in interview_notifications] == [
        (start_day - timedelta(days=1)).isoformat(),
        start_day.isoformat(),
    ]
    assert [item["scheduled_at"][11:16] for item in interview_notifications] == ["13:00", "12:30"]

    original_ids = [item["id"] for item in interview_notifications]
    new_start_day = start_day + timedelta(days=2)
    rescheduled = client.put(
        f"/events/{event_id}",
        headers=auth_headers,
        json={"start_date": new_start_day.isoformat(), "end_date": new_start_day.isoformat()},
    )
    assert rescheduled.status_code == 200

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    interview_notifications = [item for item in notifications.json() if item["type"] == "interview"]
    assert len(interview_notifications) == 2
    assert [item["id"] for item in interview_notifications] == original_ids
    assert [item["scheduled_at"][:10] for item in interview_notifications] == [
        (new_start_day - timedelta(days=1)).isoformat(),
        new_start_day.isoformat(),
    ]

    updated = client.put(f"/events/{event_id}", headers=auth_headers, json={"type": "intern", "title": "Summer Internship"})
    assert updated.status_code == 200

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    data = notifications.json()
    assert [item for item in data if item["type"] == "interview"] == []
    internship_notifications = [item for item in data if item["type"] == "internship"]
    assert len(internship_notifications) == 1
    assert internship_notifications[0]["related_id"] == event_id

    deleted = client.delete(f"/events/{event_id}", headers=auth_headers)
    assert deleted.status_code == 204
    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    assert notifications.json() == []


def test_event_briefing_and_offer_notifications(client: TestClient, auth_headers: dict[str, str]):
    start_day = datetime.now(UTC).date() + timedelta(days=4)
    briefing = client.post(
        "/events",
        headers=auth_headers,
        json={
            "company_id": None,
            "title": "Company Briefing",
            "start_date": start_day.isoformat(),
            "end_date": start_day.isoformat(),
            "start_time": "10:00",
            "type": "briefing",
            "note": None,
        },
    )
    assert briefing.status_code == 201

    offer = client.post(
        "/events",
        headers=auth_headers,
        json={
            "company_id": None,
            "title": "Offer Celebration",
            "start_date": start_day.isoformat(),
            "end_date": start_day.isoformat(),
            "start_time": None,
            "type": "offer",
            "note": None,
        },
    )
    assert offer.status_code == 201

    notifications = client.get("/notifications", headers=auth_headers)
    assert notifications.status_code == 200
    data = notifications.json()
    assert len([item for item in data if item["title"] == "Explanation Session Reminder" and item["type"] == "custom"]) == 1
    assert len([item for item in data if item["title"] == "Offer Received" and item["type"] == "offer"]) == 1


def test_automatic_notification_user_isolation(
    client: TestClient,
    auth_headers: dict[str, str],
    second_user_headers: dict[str, str],
):
    deadline = (datetime.now(UTC).date() + timedelta(days=9)).isoformat()
    user_a_company = client.post(
        "/companies",
        headers=auth_headers,
        json={"name": "User A Corp", "industry": "it", "priority": "A", "importance": 4, "status": "planned", "es_deadline": deadline},
    )
    assert user_a_company.status_code == 201
    user_b_company = client.post(
        "/companies",
        headers=second_user_headers,
        json={"name": "User B Corp", "industry": "it", "priority": "A", "importance": 4, "status": "planned", "es_deadline": deadline},
    )
    assert user_b_company.status_code == 201

    user_a_notifications = client.get("/notifications", headers=auth_headers)
    user_b_notifications = client.get("/notifications", headers=second_user_headers)
    assert user_a_notifications.status_code == 200
    assert user_b_notifications.status_code == 200
    assert {item["related_id"] for item in user_a_notifications.json()} == {user_a_company.json()["id"]}
    assert {item["related_id"] for item in user_b_notifications.json()} == {user_b_company.json()["id"]}
