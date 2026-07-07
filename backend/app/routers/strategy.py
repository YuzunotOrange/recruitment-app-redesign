from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.company import Company
from app.models.company_research import CompanyResearch
from app.models.user import User
from app.schemas.strategy import StrategyCompanyRead, StrategyMetrics, StrategyRankBucket, StrategyRecommendedAction, StrategySummary


router = APIRouter(prefix="/strategy", tags=["strategy"])

INTERVIEW_STATUSES = {
    "interview",
    "first_interview_scheduled",
    "first_interview_passed",
    "second_interview_scheduled",
    "second_interview_passed",
    "final_interview_scheduled",
    "final_interview_passed",
}


def clamp(value: int, minimum: int = 0, maximum: int = 100) -> int:
    return max(minimum, min(maximum, value))


def calculate_company_strategy(company: Company) -> tuple[int, str, str, str | None, str]:
    priority_bonus = {"S": 8, "A": 10, "B": 6, "C": 0}.get(company.priority, 0)
    probability = company.fit_score + (company.importance * 5) + priority_bonus - (company.difficulty_level * 7)
    risk = "Unknown"
    action: str | None = None

    if company.status == "spi_rejected":
        probability -= 30
        risk = "SPI"
        action = "Prioritize SPI practice and review one weak area every day."
    elif company.status == "es_rejected":
        probability -= 25
        risk = "ES"
        action = "Review company-specific ES customization and strengthen motivation details."
    elif company.status in INTERVIEW_STATUSES:
        probability += 20
        risk = "Interview"
        action = "Prepare interview stories, expected questions, and reverse questions."
    elif company.status == "offer":
        probability = 95
        action = "Compare offer decision criteria and collect missing decision information."

    probability = clamp(probability)

    if company.difficulty_level == 5:
        rank = "S"
        reason = "Difficulty is 5, so this is treated as a high-challenge S rank company."
    elif 3 <= company.difficulty_level <= 4 and company.fit_score >= 60:
        rank = "A"
        reason = "Difficulty is 3-4 and fit score is 60 or higher, so this is an A rank target."
    elif 1 <= company.difficulty_level <= 3 and probability >= 50:
        rank = "B"
        reason = "Difficulty is 1-3 and success probability is 50 or higher, so this is a B rank opportunity."
    else:
        rank = "A"
        reason = "Defaulted to A rank because the company needs active monitoring."

    if action is None:
        if rank == "S":
            action = "Move ES and interview preparation earlier for this high-difficulty company."
        elif rank == "A":
            action = "Clarify the next selection step and required submissions."
        else:
            action = "Move this company forward to increase interview opportunities."

    return probability, rank, risk, action, reason


def latest_research_for(company: Company) -> CompanyResearch | None:
    entries = sorted(company.research_entries, key=lambda item: (item.generated_at, item.id), reverse=True)
    return entries[0] if entries else None


def serialize_strategy_company(company: Company) -> StrategyCompanyRead:
    research = latest_research_for(company)
    research_status = "not_generated"
    provider = None
    accepted_summary = None
    accepted_at = None

    if research is not None:
        provider = research.provider
        if research.accepted:
            research_status = "accepted"
            accepted_summary = research.research_summary
            accepted_at = research.accepted_at
        else:
            research_status = "mock_generated" if research.provider == "mock" else "generated"

    return StrategyCompanyRead.model_validate(
        {
            **company.__dict__,
            "research_status": research_status,
            "research_provider": provider,
            "accepted_research_summary": accepted_summary,
            "accepted_research_at": accepted_at,
        }
    )


def build_strategy_summary(companies: list[Company]) -> StrategySummary:
    ranks = ["S", "A", "B"]
    total = len(companies)
    buckets: dict[str, StrategyRankBucket] = {}
    counts: dict[str, int] = {}
    ratios: dict[str, float] = {}

    for rank in ranks:
        ranked_companies = [company for company in companies if company.strategy_rank == rank]
        count = len(ranked_companies)
        counts[rank] = count
        ratios[rank] = round((count / total) * 100, 1) if total else 0
        buckets[rank] = StrategyRankBucket(
            rank=rank,
            count=count,
            ratio=ratios[rank],
            companies=[serialize_strategy_company(company) for company in ranked_companies],
        )

    es_rejected = sum(1 for company in companies if company.status == "es_rejected")
    spi_rejected = sum(1 for company in companies if company.status == "spi_rejected")
    interviews = sum(1 for company in companies if company.status in INTERVIEW_STATUSES)
    offers = sum(1 for company in companies if company.status in {"offer", "internship_offer"})

    actions: list[StrategyRecommendedAction] = []
    if spi_rejected >= 2:
        actions.append(
            StrategyRecommendedAction(
                title="Prioritize SPI practice",
                reason=f"{spi_rejected} companies were rejected at SPI.",
                action="Prioritize SPI practice.",
                urgency="high",
            )
        )
    if es_rejected >= 2:
        actions.append(
            StrategyRecommendedAction(
                title="Review ES customization",
                reason=f"{es_rejected} companies were rejected at ES.",
                action="Review company-specific ES customization.",
                urgency="high",
            )
        )
    if interviews < 3:
        actions.append(
            StrategyRecommendedAction(
                title="Increase interview opportunities",
                reason=f"Only {interviews} companies are currently in interview.",
                action="Add A/B rank companies to increase interview opportunities.",
                urgency="medium",
            )
        )

    for company in sorted(companies, key=lambda item: item.success_probability)[:3]:
        if company.recommended_action:
            actions.append(
                StrategyRecommendedAction(
                    title=f"Next action for {company.name}",
                    reason=f"Success probability {company.success_probability}% / risk {company.selection_risk}",
                    action=company.recommended_action,
                    urgency="high" if company.success_probability < 35 else "medium",
                    company_id=company.id,
                    company_name=company.name,
                )
            )

    return StrategySummary(
        buckets=buckets,
        counts=counts,
        ratios=ratios,
        metrics=StrategyMetrics(
            total_companies=total,
            es_rejected=es_rejected,
            spi_rejected=spi_rejected,
            interviews=interviews,
            offers=offers,
        ),
        recommended_actions=actions[:6],
    )


@router.get("", response_model=StrategySummary)
def read_strategy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StrategySummary:
    stmt = select(Company).where(Company.user_id == current_user.id).order_by(Company.created_at.desc(), Company.id.desc())
    companies = list(db.scalars(stmt).all())
    return build_strategy_summary(companies)


@router.post("/recalculate", response_model=StrategySummary)
def recalculate_strategy(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StrategySummary:
    companies = list(db.scalars(select(Company).where(Company.user_id == current_user.id)).all())
    for company in companies:
        probability, rank, risk, action, reason = calculate_company_strategy(company)
        company.success_probability = probability
        company.strategy_rank = rank
        company.selection_risk = risk
        company.recommended_action = action
        company.strategy_reason = reason
    db.commit()
    for company in companies:
        db.refresh(company)
    return build_strategy_summary(companies)
