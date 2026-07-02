from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


TaskPriority = Literal["high", "medium", "low"]
TaskStatus = Literal["todo", "in_progress", "completed"]


class TaskBase(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    due_date: date | None = None
    priority: TaskPriority = "medium"
    status: TaskStatus = "todo"
    related_company_id: int | None = None
    related_event_id: int | None = None


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    due_date: date | None = None
    priority: TaskPriority | None = None
    status: TaskStatus | None = None
    related_company_id: int | None = None
    related_event_id: int | None = None


class TaskRead(TaskBase):
    id: int
    user_id: int
    company_name: str | None = None
    event_title: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
