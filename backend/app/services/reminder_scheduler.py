import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.event import Event
from app.models.notification import Notification, ReminderSettings
from app.models.user import User
from app.services.email import send_email
from app.services.notifications import (
    is_due_notification,
    notification_allowed_by_settings,
    sync_company_notifications,
    sync_event_notifications,
)


logger = logging.getLogger(__name__)


def send_due_reminder_emails(db: Session) -> int:
    """Sync notifications for every user with email reminders on, and email the ones that are due."""
    sent_count = 0
    reminder_settings = list(
        db.scalars(select(ReminderSettings).where(ReminderSettings.email_enabled.is_(True))).all()
    )

    for settings in reminder_settings:
        user = db.get(User, settings.user_id)
        if user is None:
            continue

        companies = list(db.scalars(select(Company).where(Company.user_id == user.id)).all())
        events = list(db.scalars(select(Event).where(Event.user_id == user.id)).all())
        for company in companies:
            sync_company_notifications(company, db)
        for event in events:
            sync_event_notifications(event, db)
        db.flush()

        due_notifications = list(
            db.scalars(
                select(Notification).where(
                    Notification.user_id == user.id,
                    Notification.is_sent.is_(False),
                )
            ).all()
        )

        for notification in due_notifications:
            if not is_due_notification(notification.scheduled_at):
                continue
            if not notification_allowed_by_settings(notification.type, settings):
                continue

            delivered = send_email(
                to_email=user.email,
                subject=f"[CareerTrack] {notification.title}",
                body=notification.message,
            )
            if delivered:
                notification.is_sent = True
                sent_count += 1

        db.commit()

    return sent_count
