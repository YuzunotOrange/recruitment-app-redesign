import logging
from datetime import date, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.event import Event
from app.models.notification import Notification, ReminderSettings
from app.models.user import User
from app.services.email import send_email
from app.services.notifications import (
    ES_PENDING_STATUSES,
    _at_local_time,
    is_due_notification,
    notification_allowed_by_settings,
    sync_company_notifications,
    sync_event_notifications,
    today_jst,
)
from app.services.web_push import send_push_to_user


logger = logging.getLogger(__name__)


def _sync_user(db: Session, user_id: int) -> tuple[list[Company], list[Event]]:
    companies = list(db.scalars(select(Company).where(Company.user_id == user_id)).all())
    events = list(db.scalars(select(Event).where(Event.user_id == user_id)).all())
    for company in companies:
        sync_company_notifications(company, db)
    for event in events:
        sync_event_notifications(event, db)
    db.flush()
    return companies, events


def send_due_reminder_emails(db: Session) -> int:
    """Deliver due reminders via email and/or web push for users who opted in."""
    sent_count = 0
    reminder_settings = list(
        db.scalars(
            select(ReminderSettings).where(
                or_(ReminderSettings.email_enabled.is_(True), ReminderSettings.push_enabled.is_(True))
            )
        ).all()
    )

    for settings in reminder_settings:
        user = db.get(User, settings.user_id)
        if user is None:
            continue

        _sync_user(db, user.id)

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

            delivered = False
            if settings.email_enabled:
                delivered = send_email(
                    to_email=user.email,
                    subject=f"[CareerTrack] {notification.title}",
                    body=notification.message,
                ) or delivered
            if settings.push_enabled:
                delivered = (
                    send_push_to_user(db, user.id, title=notification.title, body=notification.message) > 0
                ) or delivered

            if delivered:
                notification.is_sent = True
                sent_count += 1

        db.commit()

    return sent_count


def _week_range(today: date) -> tuple[date, date]:
    return today, today + timedelta(days=6)


def _build_weekly_summary(user: User, companies: list[Company], events: list[Event], today: date) -> str:
    week_start, week_end = _week_range(today)

    week_events = sorted(
        (event for event in events if week_start <= event.start_date <= week_end),
        key=lambda event: (event.start_date, event.title),
    )
    week_deadlines = sorted(
        (
            company
            for company in companies
            if company.status in ES_PENDING_STATUSES
            and company.es_deadline is not None
            and week_start <= company.es_deadline <= week_end
        ),
        key=lambda company: (company.es_deadline, company.name),
    )
    offers = sum(1 for company in companies if company.status == "offer")

    lines = [
        f"{user.name} さん、今週の就活サマリーです。({week_start.isoformat()} - {week_end.isoformat()})",
        "",
        "■ 今週の予定",
    ]
    if week_events:
        for event in week_events:
            time_label = event.start_time.strftime("%H:%M") if event.start_time else "終日"
            lines.append(f"- {event.start_date.isoformat()} {time_label} {event.title} [{event.type}]")
    else:
        lines.append("- 予定はありません")

    lines += ["", "■ 今週のES締切"]
    if week_deadlines:
        for company in week_deadlines:
            lines.append(f"- {company.es_deadline.isoformat()} {company.name}")
    else:
        lines.append("- 締切はありません")

    lines += [
        "",
        "■ 進捗",
        f"- 登録企業: {len(companies)}社 / 内定: {offers}件",
        "",
        "CareerTrack を開いて今週の動きを確認しましょう。",
    ]
    return "\n".join(lines)


def send_weekly_summaries(db: Session, *, today: date | None = None) -> int:
    """Email a weekly summary every Monday (JST) to users who enabled it."""
    today = today or today_jst()
    if today.weekday() != 0:  # Monday
        return 0

    sent_count = 0
    reminder_settings = list(
        db.scalars(select(ReminderSettings).where(ReminderSettings.weekly_summary_enabled.is_(True))).all()
    )

    for settings in reminder_settings:
        last_sent = settings.weekly_summary_last_sent_at
        if last_sent is not None and last_sent.date() >= today:
            continue

        user = db.get(User, settings.user_id)
        if user is None:
            continue

        companies = list(db.scalars(select(Company).where(Company.user_id == user.id)).all())
        events = list(db.scalars(select(Event).where(Event.user_id == user.id)).all())
        body = _build_weekly_summary(user, companies, events, today)

        delivered = send_email(
            to_email=user.email,
            subject="[CareerTrack] 今週の就活サマリー",
            body=body,
        )
        if settings.push_enabled:
            delivered = (
                send_push_to_user(
                    db,
                    user.id,
                    title="今週の就活サマリー",
                    body="今週の予定と締切をまとめました。アプリで確認しましょう。",
                )
                > 0
            ) or delivered

        if delivered:
            # Record the Monday being delivered (not wall-clock time) so the
            # same week's summary is never sent twice.
            settings.weekly_summary_last_sent_at = _at_local_time(today)
            sent_count += 1

        db.commit()

    return sent_count


def run_scheduled_deliveries(db: Session) -> None:
    """Entry point for the background loop: due reminders + weekly summaries."""
    send_due_reminder_emails(db)
    send_weekly_summaries(db)
