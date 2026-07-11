from datetime import datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.services.notifications import JST
from app.services.reminder_scheduler import send_due_reminder_emails


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
