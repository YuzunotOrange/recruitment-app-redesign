from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.company import CompanyRead


class StrategyCompanyRead(CompanyRead):
    research_status: str = "not_generated"
    research_provider: str | None = None
    accepted_research_summary: str | None = None
    accepted_research_at: datetime | None = None


class StrategyRankBucket(BaseModel):
    rank: str
    count: int
    ratio: float
    companies: list[StrategyCompanyRead]


class StrategyRecommendedAction(BaseModel):
    title: str
    reason: str
    action: str
    urgency: str
    company_id: int | None = None
    company_name: str | None = None


class StrategyMetrics(BaseModel):
    total_companies: int
    es_rejected: int
    spi_rejected: int
    interviews: int
    offers: int


class StrategySummary(BaseModel):
    buckets: dict[str, StrategyRankBucket]
    counts: dict[str, int]
    ratios: dict[str, float]
    metrics: StrategyMetrics
    recommended_actions: list[StrategyRecommendedAction]

    model_config = ConfigDict(from_attributes=True)
