from pydantic import BaseModel, ConfigDict

from app.schemas.company import CompanyRead


class StrategyRankBucket(BaseModel):
    rank: str
    count: int
    ratio: float
    companies: list[CompanyRead]


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
