from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


EventType = Literal["briefing", "interview", "test", "deadline", "intern", "offer", "other"]


class EventBase(BaseModel):
    company_id: int | None = None
    title: str = Field(min_length=1, max_length=255)
    start_date: date
    end_date: date
    start_time: time | None = None
    end_time: time | None = None
    type: EventType = "briefing"
    note: str | None = None

    @model_validator(mode="after")
    def validate_date_order(self) -> "EventBase":
        if self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date.")
        return self


class EventCandidateDateBase(BaseModel):
    start_date: date
    end_date: date
    start_time: time | None = None
    end_time: time | None = None
    note: str | None = None
    is_selected: bool = False

    @model_validator(mode="after")
    def validate_date_order(self) -> "EventCandidateDateBase":
        if self.end_date < self.start_date:
            raise ValueError("candidate end_date must be on or after start_date.")
        return self


class EventCandidateDateCreate(EventCandidateDateBase):
    pass


class EventCandidateDateRead(EventCandidateDateBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class EventCreate(EventBase):
    candidate_dates: list[EventCandidateDateCreate] = Field(default_factory=list)


class EventUpdate(BaseModel):
    company_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=255)
    start_date: date | None = None
    end_date: date | None = None
    start_time: time | None = None
    end_time: time | None = None
    type: EventType | None = None
    note: str | None = None
    candidate_dates: list[EventCandidateDateCreate] | None = None


class EventRead(EventBase):
    id: int
    user_id: int
    company_name: str | None = None
    candidate_dates: list[EventCandidateDateRead] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
