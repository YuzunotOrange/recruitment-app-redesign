from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.notification import Notification, ReminderSettings
from app.models.user import User
from app.services.notifications import (
    get_or_create_reminder_settings,
    is_current_or_future_notification,
    notification_allowed_by_settings,
)
from app.schemas.notification import (
    NotificationRead,
    ReadAllResponse,
    ReminderSettingsRead,
    ReminderSettingsUpdate,
)


router = APIRouter(tags=["notifications"])


def get_owned_notification(notification_id: int, user_id: int, db: Session) -> Notification:
    notification = db.scalar(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user_id)
    )
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found.")
    return notification


@router.get("/notifications", response_model=list[NotificationRead])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Notification]:
    stmt = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.is_read.asc(), Notification.scheduled_at.asc(), Notification.created_at.desc())
    )
    notifications = list(db.scalars(stmt).all())
    settings = get_or_create_reminder_settings(db, current_user.id)
    return [
        notification
        for notification in notifications
        if is_current_or_future_notification(notification.scheduled_at)
        and notification_allowed_by_settings(notification.type, settings)
    ]


@router.patch("/notifications/{notification_id}/read", response_model=NotificationRead)
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Notification:
    notification = get_owned_notification(notification_id, current_user.id, db)
    notification.is_read = True
    db.commit()
    db.refresh(notification)
    return notification


@router.patch("/notifications/read-all", response_model=ReadAllResponse)
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReadAllResponse:
    notifications = list(
        db.scalars(
            select(Notification).where(Notification.user_id == current_user.id, Notification.is_read.is_(False))
        ).all()
    )
    for notification in notifications:
        notification.is_read = True
    db.commit()
    return ReadAllResponse(updated=len(notifications))


@router.delete("/notifications/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_notification(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    notification = get_owned_notification(notification_id, current_user.id, db)
    db.delete(notification)
    db.commit()


@router.get("/reminder-settings", response_model=ReminderSettingsRead)
def read_reminder_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReminderSettings:
    return get_or_create_reminder_settings(db, current_user.id)


@router.put("/reminder-settings", response_model=ReminderSettingsRead)
def update_reminder_settings(
    payload: ReminderSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ReminderSettings:
    settings = get_or_create_reminder_settings(db, current_user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, key, value)
    db.commit()
    db.refresh(settings)
    return settings
