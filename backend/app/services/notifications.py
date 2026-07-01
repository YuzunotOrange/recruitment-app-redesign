from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.event import Event
from app.models.notification import Notification


DEADLINE_NOTIFICATION_TYPES = {"deadline", "offer"}
EVENT_NOTIFICATION_TYPES = {"interview", "internship", "offer", "custom"}
JST = timezone(timedelta(hours=9), "JST")


type NotificationSpec = dict[str, str | int | datetime]


def _at_local_time(day: date, hour: int = 9, minute: int = 0) -> datetime:
    return datetime.combine(day, time(hour=hour, minute=minute), tzinfo=JST)


def _event_start_at(event: Event) -> datetime:
    return datetime.combine(event.start_date, event.start_time or time(hour=9), tzinfo=JST)


def _deadline_message(company_name: str, days_before: int) -> str:
    if days_before == 1:
        return f"ES deadline for {company_name} is tomorrow."
    return f"ES deadline for {company_name} is in {days_before} days."


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
            notification.title = str(spec["title"])
            notification.message = str(spec["message"])
            notification.type = str(spec["type"])
            notification.scheduled_at = spec["scheduled_at"]  # type: ignore[assignment]
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

    if company.es_deadline:
        for days_before in (7, 3, 1):
            scheduled_day = company.es_deadline - timedelta(days=days_before)
            specs.append(
                {
                    "title": "ES Deadline",
                    "message": _deadline_message(company.name, days_before),
                    "type": "deadline",
                    "scheduled_at": _at_local_time(scheduled_day),
                }
            )

    if company.status == "offer":
        specs.append(
            {
                "title": "Offer Received",
                "message": f"Congratulations on your offer from {company.name}.",
                "type": "offer",
                "scheduled_at": datetime.now(JST),
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
    specs: list[NotificationSpec] = []

    if event.type == "interview":
        specs.append(
            {
                "title": "Interview Reminder",
                "message": f"{event.title} is scheduled tomorrow.",
                "type": "interview",
                "scheduled_at": start_at - timedelta(days=1),
            }
        )
        specs.append(
            {
                "title": "Interview Reminder",
                "message": f"{event.title} starts in 30 minutes.",
                "type": "interview",
                "scheduled_at": start_at - timedelta(minutes=30),
            }
        )

    if event.type == "intern":
        specs.append(
            {
                "title": "Internship Reminder",
                "message": f"{event.title} starts on {event.start_date.isoformat()}.",
                "type": "internship",
                "scheduled_at": start_at - timedelta(days=1),
            }
        )

    if event.type == "offer":
        specs.append(
            {
                "title": "Offer Received",
                "message": f"Congratulations on your offer: {event.title}.",
                "type": "offer",
                "scheduled_at": datetime.now(JST),
            }
        )

    if event.type == "briefing":
        specs.append(
            {
                "title": "Explanation Session Reminder",
                "message": f"{event.title} is scheduled tomorrow.",
                "type": "custom",
                "scheduled_at": start_at - timedelta(days=1),
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
