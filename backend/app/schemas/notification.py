from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


NotificationType = Literal["deadline", "interview", "internship", "offer", "custom", "system"]
RelatedType = Literal["company", "event"]


class NotificationRead(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    type: NotificationType
    related_type: RelatedType | None = None
    related_id: int | None = None
    scheduled_at: datetime | None = None
    is_read: bool
    is_sent: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReadAllResponse(BaseModel):
    updated: int


class ReminderSettingsRead(BaseModel):
    id: int
    user_id: int
    deadline_7days: bool
    deadline_3days: bool
    deadline_1day: bool
    interview_1day: bool
    interview_30min: bool
    email_enabled: bool
    push_enabled: bool

    model_config = ConfigDict(from_attributes=True)


class ReminderSettingsUpdate(BaseModel):
    deadline_7days: bool | None = None
    deadline_3days: bool | None = None
    deadline_1day: bool | None = None
    interview_1day: bool | None = None
    interview_30min: bool | None = None
    email_enabled: bool | None = None
    push_enabled: bool | None = None
