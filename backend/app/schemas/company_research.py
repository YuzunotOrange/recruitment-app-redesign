from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


StrategyPosition = Literal["Reach", "Core", "Safe", "Hold"]
ResearchDecision = Literal["accept", "reject"]


class ResearchSource(BaseModel):
    title: str
    url: str
    retrieved_at: datetime


class CompanyResearchBase(BaseModel):
    company_overview: str
    business_summary: str
    salary_level: int = Field(ge=1, le=5)
    difficulty_level: int = Field(ge=1, le=5)
    stability: int = Field(ge=1, le=5)
    growth: int = Field(ge=1, le=5)
    global_score: int = Field(ge=1, le=5, serialization_alias="global")
    dx: int = Field(ge=1, le=5)
    work_life_balance: int = Field(ge=1, le=5)
    recommended_people: str
    research_summary: str
    strengths: str
    weaknesses: str
    selection_process: str
    selection_points: str
    ai_strategy_position: StrategyPosition
    sources: list[ResearchSource]
    provider: str


class CompanyResearchCreate(CompanyResearchBase):
    pass


class CompanyResearchUpdate(BaseModel):
    research_summary: str | None = None
    ai_strategy_position: StrategyPosition | None = None
    recommended_people: str | None = None
    selection_points: str | None = None


class CompanyResearchDecisionRequest(BaseModel):
    decision: ResearchDecision
    research_summary: str | None = None
    ai_strategy_position: StrategyPosition | None = None


class CompanyResearchRead(CompanyResearchBase):
    id: int
    company_id: int
    user_id: int
    generated_at: datetime
    accepted: bool
    accepted_at: datetime | None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
