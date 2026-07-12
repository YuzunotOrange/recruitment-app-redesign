from datetime import date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification, ReminderSettings
from app.models.push_subscription import PushSubscription
from app.services.notifications import JST
from app.services.reminder_scheduler import send_due_reminder_emails, send_weekly_summaries


def test_send_due_reminder_emails_sends_once_and_skips_when_disabled(
    client: TestClient,
    db_session: Session,
    auth_headers: dict[str, str],
    monkeypatch,
):
    sent_emails: list[dict[str, str]] = []

    def fake_send_email(*, to_email: str, subject: str, body: str) -> bool:
        sent_emails.append({"to_email": to_email, "subject": subject, "body": body})
        return True

    monkeypatch.setattr("app.services.reminder_scheduler.send_email", fake_send_email)

    # No reminder is due yet because email_enabled defaults to False.
    deadline_date = datetime.now(JST).date() + timedelta(days=7)
    created = client.post(
        "/companies",
        headers=auth_headers,
        json={
            "name": "Reminder Corp",
            "industry": "it",
            "priority": "A",
            "importance": 4,
            "status": "planned",
            "es_deadline": deadline_date.isoformat(),
            "note": None,
        },
    )
    assert created.status_code == 201

    assert send_due_reminder_emails(db_session) == 0
    assert sent_emails == []

    enabled = client.put("/reminder-settings", headers=auth_headers, json={"email_enabled": True})
    assert enabled.status_code == 200

    assert send_due_reminder_emails(db_session) == 1
    assert len(sent_emails) == 1
    assert sent_emails[0]["to_email"]
    assert "ES Deadline" in sent_emails[0]["subject"]

    notification = db_session.scalar(select(Notification).where(Notification.related_type == "company"))
    assert notification is not None
    assert notification.is_sent is True

    # Running again should not resend the same reminder.
    assert send_due_reminder_emails(db_session) == 0
    assert len(sent_emails) == 1


def test_weekly_summary_sends_on_monday_once(
    client: TestClient,
    db_session: Session,
    auth_headers: dict[str, str],
    monkeypatch,
):
    sent_emails: list[dict[str, str]] = []

    def fake_send_email(*, to_email: str, subject: str, body: str) -> bool:
        sent_emails.append({"to_email": to_email, "subject": subject, "body": body})
        return True

    monkeypatch.setattr("app.services.reminder_scheduler.send_email", fake_send_email)

    monday = date(2026, 7, 13)  # a Monday
    tuesday = date(2026, 7, 14)

    deadline = (monday + timedelta(days=2)).isoformat()
    created = client.post(
        "/companies",
        headers=auth_headers,
        json={
            "name": "Weekly Corp",
            "industry": "it",
            "priority": "A",
            "importance": 4,
            "status": "planned",
            "es_deadline": deadline,
            "note": None,
        },
    )
    assert created.status_code == 201

    # Disabled by default -> nothing goes out even on Monday.
    assert send_weekly_summaries(db_session, today=monday) == 0

    enabled = client.put("/reminder-settings", headers=auth_headers, json={"weekly_summary_enabled": True})
    assert enabled.status_code == 200

    # Not Monday -> nothing.
    assert send_weekly_summaries(db_session, today=tuesday) == 0

    # Monday -> one summary containing the deadline.
    assert send_weekly_summaries(db_session, today=monday) == 1
    assert len(sent_emails) == 1
    assert "今週の就活サマリー" in sent_emails[0]["subject"]
    assert "Weekly Corp" in sent_emails[0]["body"]

    # Same Monday again -> deduplicated.
    assert send_weekly_summaries(db_session, today=monday) == 0
    assert len(sent_emails) == 1

    settings = db_session.scalar(select(ReminderSettings))
    assert settings is not None and settings.weekly_summary_last_sent_at is not None


def test_push_subscribe_and_reminder_push_delivery(
    client: TestClient,
    db_session: Session,
    auth_headers: dict[str, str],
    monkeypatch,
):
    # Public key endpoint returns a base64url key usable by PushManager.subscribe.
    key_response = client.get("/push/public-key")
    assert key_response.status_code == 200
    assert len(key_response.json()["public_key"]) > 40

    subscribed = client.post(
        "/push/subscribe",
        headers=auth_headers,
        json={"endpoint": "https://push.example.com/sub/abc", "keys": {"p256dh": "key", "auth": "secret"}},
    )
    assert subscribed.status_code == 201

    pushes: list[dict[str, str]] = []
    monkeypatch.setattr(
        "app.services.reminder_scheduler.send_push_to_user",
        lambda db, user_id, *, title, body, url="/": pushes.append({"title": title, "body": body}) or 1,
    )
    monkeypatch.setattr("app.services.reminder_scheduler.send_email", lambda **kwargs: False)

    deadline_date = datetime.now(JST).date() + timedelta(days=7)
    created = client.post(
        "/companies",
        headers=auth_headers,
        json={
            "name": "Push Corp",
            "industry": "it",
            "priority": "A",
            "importance": 4,
            "status": "planned",
            "es_deadline": deadline_date.isoformat(),
            "note": None,
        },
    )
    assert created.status_code == 201

    enabled = client.put("/reminder-settings", headers=auth_headers, json={"push_enabled": True})
    assert enabled.status_code == 200

    assert send_due_reminder_emails(db_session) == 1
    assert len(pushes) == 1
    assert pushes[0]["title"] == "ES Deadline"

    unsubscribed = client.post(
        "/push/unsubscribe",
        headers=auth_headers,
        json={"endpoint": "https://push.example.com/sub/abc"},
    )
    assert unsubscribed.status_code == 204
    assert db_session.scalar(select(PushSubscription)) is None
