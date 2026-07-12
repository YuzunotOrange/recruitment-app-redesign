from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.event import Event
from app.models.notification import Notification, ReminderSettings


DEADLINE_NOTIFICATION_TYPES = {"deadline", "offer"}
EVENT_NOTIFICATION_TYPES = {"interview", "internship", "offer", "custom"}
# Statuses where the ES has not been submitted yet — deadline reminders only make sense here.
ES_PENDING_STATUSES = {"planned", "applied"}
JST = timezone(timedelta(hours=9), "JST")


type NotificationSpec = dict[str, str | int | datetime]


def _at_local_time(day: date, hour: int = 9, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour=hour, minute=minute), tzinfo=JST)


def now_jst() -> datetime:
    return datetime.now(JST)


def today_jst() -> date:
    return now_jst().date()


def days_until_jst(target: date, today: date | None = None) -> int:
    return (target - (today or today_jst())).days


def _event_start_at(event: Event) -> datetime:
    return datetime.combine(event.start_date, event.start_time or time(hour=9), tzinfo=JST)


def _event_time_label(event: Event) -> str:
    if event.start_time and event.end_time:
        return f"{event.start_time.strftime('%H:%M')} - {event.end_time.strftime('%H:%M')}"
    if event.start_time:
        return event.start_time.strftime("%H:%M")
    return "all day"


def _event_time_suffix(event: Event) -> str:
    if event.start_time and event.end_time:
        return f" ({_event_time_label(event)})"
    return ""


def _to_jst(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=JST)
    return value.astimezone(JST)


def _same_scheduled_at(a: datetime | None, b: datetime | None) -> bool:
    if a is None or b is None:
        return a == b
    return _to_jst(a) == _to_jst(b)


def is_current_or_future_notification(value: datetime | None, today: date | None = None) -> bool:
    if value is None:
        return True
    baseline = today or today_jst()
    return _to_jst(value).date() >= baseline


def is_due_notification(value: datetime | None, now: datetime | None = None) -> bool:
    if value is None:
        return True
    if now is not None:
        return _to_jst(value) <= now
    return _to_jst(value).date() <= today_jst()


def get_or_create_reminder_settings(db: Session, user_id: int) -> ReminderSettings:
    settings = db.scalar(select(ReminderSettings).where(ReminderSettings.user_id == user_id))
    if settings is not None:
        return settings

    settings = ReminderSettings(user_id=user_id)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def notification_allowed_by_settings(notification_type: str, settings: ReminderSettings) -> bool:
    if notification_type == "deadline":
        return settings.es_deadline_enabled
    if notification_type == "interview":
        return settings.interview_enabled
    if notification_type == "internship":
        return settings.internship_enabled
    if notification_type == "offer":
        return settings.offer_enabled
    if notification_type == "custom":
        return settings.info_session_enabled
    return True


def _enabled_deadline_days(settings: ReminderSettings) -> set[int]:
    days: set[int] = set()
    if settings.deadline_7days:
        days.add(7)
    if settings.deadline_3days:
        days.add(3)
    if settings.deadline_1day:
        days.add(1)
    return days


def _deadline_message(company_name: str, days_until: int) -> str:
    if days_until == 0:
        return f"ES deadline for {company_name} is today."
    if days_until == 1:
        return f"ES deadline for {company_name} is tomorrow."
    return f"ES deadline for {company_name} is in {days_until} days."


def _sync_related_notifications(
    db: Session,
    *,
    user_id: int,
    related_type: str,
    related_id: int,
    managed_types: set[str],
    specs: list[NotificationSpec],
) -> None:
    existing = list(
        db.scalars(
            select(Notification)
            .where(
                Notification.user_id == user_id,
                Notification.related_type == related_type,
                Notification.related_id == related_id,
                Notification.type.in_(managed_types),
            )
            .order_by(Notification.id.asc())
        ).all()
    )

    for index, spec in enumerate(specs):
        if index < len(existing):
            notification = existing[index]
            spec_scheduled_at = spec["scheduled_at"]  # type: ignore[assignment]
            changed = (
                notification.title != str(spec["title"])
                or notification.message != str(spec["message"])
                or notification.type != str(spec["type"])
                or not _same_scheduled_at(notification.scheduled_at, spec_scheduled_at)
            )
            notification.title = str(spec["title"])
            notification.message = str(spec["message"])
            notification.type = str(spec["type"])
            notification.scheduled_at = spec_scheduled_at
            if changed:
                notification.is_sent = False
        else:
            db.add(
                Notification(
                    user_id=user_id,
                    related_type=related_type,
                    related_id=related_id,
                    title=str(spec["title"]),
                    message=str(spec["message"]),
                    type=str(spec["type"]),
                    scheduled_at=spec["scheduled_at"],  # type: ignore[arg-type]
                )
            )

    for notification in existing[len(specs):]:
        db.delete(notification)


def sync_company_notifications(company: Company, db: Session) -> None:
    specs: list[NotificationSpec] = []
    today = today_jst()
    settings = get_or_create_reminder_settings(db, company.user_id)

    if company.es_deadline and settings.es_deadline_enabled and company.status in ES_PENDING_STATUSES:
        days_until = days_until_jst(company.es_deadline, today)
        enabled_days = _enabled_deadline_days(settings)
        should_notify = days_until == 0 or days_until in enabled_days
        if should_notify and days_until >= 0:
            specs.append(
                {
                    "title": "ES Deadline",
                    "message": _deadline_message(company.name, days_until),
                    "type": "deadline",
                    "scheduled_at": _at_local_time(today),
                }
            )

    if company.status == "offer" and settings.offer_enabled:
        specs.append(
            {
                "title": "Offer Received",
                "message": f"Congratulations on your offer from {company.name}.",
                "type": "offer",
                "scheduled_at": now_jst(),
            }
        )

    _sync_related_notifications(
        db,
        user_id=company.user_id,
        related_type="company",
        related_id=company.id,
        managed_types=DEADLINE_NOTIFICATION_TYPES,
        specs=specs,
    )


def sync_event_notifications(event: Event, db: Session) -> None:
    start_at = _event_start_at(event)
    time_suffix = _event_time_suffix(event)
    specs: list[NotificationSpec] = []
    today = today_jst()
    settings = get_or_create_reminder_settings(db, event.user_id)

    if event.type == "interview" and settings.interview_enabled:
        interview_specs: list[tuple[bool, datetime, str]] = [
            (
                settings.interview_1day,
                start_at - timedelta(days=1),
                f"{event.title} is scheduled tomorrow{time_suffix}.",
            ),
            (
                settings.interview_30min,
                start_at - timedelta(minutes=30),
                f"{event.title} starts in 30 minutes{time_suffix}.",
            ),
        ]
        for enabled, scheduled_at, message in interview_specs:
            if not enabled:
                continue
            if is_current_or_future_notification(scheduled_at, today):
                specs.append(
                    {
                        "title": "Interview Reminder",
                        "message": message,
                        "type": "interview",
                        "scheduled_at": scheduled_at,
                    }
                )

    if event.type == "intern" and settings.internship_enabled:
        scheduled_at = start_at - timedelta(days=1)
        if is_current_or_future_notification(scheduled_at, today):
            specs.append(
                {
                    "title": "Internship Reminder",
                    "message": f"{event.title} starts on {event.start_date.isoformat()}{time_suffix}.",
                    "type": "internship",
                    "scheduled_at": scheduled_at,
                }
            )

    if event.type == "offer" and settings.offer_enabled:
        specs.append(
            {
                "title": "Offer Received",
                "message": f"Congratulations on your offer: {event.title}.",
                "type": "offer",
                "scheduled_at": now_jst(),
            }
        )

    if event.type == "briefing" and settings.info_session_enabled:
        scheduled_at = start_at - timedelta(days=1)
        if is_current_or_future_notification(scheduled_at, today):
            specs.append(
                {
                    "title": "Explanation Session Reminder",
                    "message": f"{event.title} is scheduled tomorrow{time_suffix}.",
                    "type": "custom",
                    "scheduled_at": scheduled_at,
                }
            )

    _sync_related_notifications(
        db,
        user_id=event.user_id,
        related_type="event",
        related_id=event.id,
        managed_types=EVENT_NOTIFICATION_TYPES,
        specs=specs,
    )


def delete_company_notifications(company: Company, db: Session) -> None:
    _sync_related_notifications(
        db,
        user_id=company.user_id,
        related_type="company",
        related_id=company.id,
        managed_types=DEADLINE_NOTIFICATION_TYPES,
        specs=[],
    )


def delete_event_notifications(event: Event, db: Session) -> None:
    _sync_related_notifications(
        db,
        user_id=event.user_id,
        related_type="event",
        related_id=event.id,
        managed_types=EVENT_NOTIFICATION_TYPES,
        specs=[],
    )
