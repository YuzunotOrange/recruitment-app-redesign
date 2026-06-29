from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Industry = Literal["maker", "finance", "consulting", "it", "other"]
Priority = Literal["S", "A", "B", "C"]
CompanyStatus = Literal[
    "planned",
    "es_submitted",
    "es_rejected",
    "spi_rejected",
    "interview",
    "offer",
    "declined",
]


class CompanyBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    industry: Industry = "other"
    priority: Priority = "C"
    importance: int = Field(default=3, ge=1, le=5)
    status: CompanyStatus = "planned"
    es_deadline: date | None = None
    note: str | None = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    industry: Industry | None = None
    priority: Priority | None = None
    importance: int | None = Field(default=None, ge=1, le=5)
    status: CompanyStatus | None = None
    es_deadline: date | None = None
    note: str | None = None


class CompanyRead(CompanyBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
