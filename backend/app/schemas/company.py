from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


Industry = Literal["maker", "finance", "consulting", "it", "other"]
Priority = Literal["S", "A", "B", "C"]
StrategyRank = Literal["S", "A", "B"]
SelectionRisk = Literal["ES", "SPI", "Interview", "Unknown"]
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
    strategy_rank: StrategyRank = "A"
    difficulty_level: int = Field(default=3, ge=1, le=5)
    fit_score: int = Field(default=50, ge=0, le=100)
    success_probability: int = Field(default=50, ge=0, le=100)
    selection_risk: SelectionRisk = "Unknown"
    recommended_action: str | None = None
    strategy_reason: str | None = None
    user_strategy_note: str | None = None


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
    strategy_rank: StrategyRank | None = None
    difficulty_level: int | None = Field(default=None, ge=1, le=5)
    fit_score: int | None = Field(default=None, ge=0, le=100)
    success_probability: int | None = Field(default=None, ge=0, le=100)
    selection_risk: SelectionRisk | None = None
    recommended_action: str | None = None
    strategy_reason: str | None = None
    user_strategy_note: str | None = None


class CompanyRead(CompanyBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
