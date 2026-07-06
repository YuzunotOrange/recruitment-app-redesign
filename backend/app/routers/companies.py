from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.company import Company
from app.models.company_research import CompanyResearch
from app.models.user import User
from app.models.user_profile import UserProfile
from app.schemas.company import CompanyCreate, CompanyRead, CompanyStatus, CompanyUpdate, Industry, Priority
from app.schemas.company_fit import CompanyFitAnalysis
from app.schemas.company_research import CompanyResearchDecisionRequest, CompanyResearchRead
from app.services.ai_providers import get_ai_provider
from app.services.company_fit import CompanyFitService
from app.services.notifications import delete_company_notifications, sync_company_notifications


router = APIRouter(prefix="/companies", tags=["companies"])


def get_owned_company(company_id: int, user_id: int, db: Session) -> Company:
    company = db.scalar(select(Company).where(Company.id == company_id, Company.user_id == user_id))
    if company is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company not found.")
    return company


@router.get("", response_model=list[CompanyRead])
def list_companies(
    industry: Industry | None = None,
    status_filter: CompanyStatus | None = Query(default=None, alias="status"),
    priority: Priority | None = None,
    search: str | None = Query(default=None, min_length=1, max_length=255),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[Company]:
    stmt = select(Company).where(Company.user_id == current_user.id)
    if industry:
        stmt = stmt.where(Company.industry == industry)
    if status_filter:
        stmt = stmt.where(Company.status == status_filter)
    if priority:
        stmt = stmt.where(Company.priority == priority)
    if search:
        stmt = stmt.where(Company.name.ilike(f"%{search}%"))
    stmt = stmt.order_by(Company.created_at.desc(), Company.id.desc())
    return list(db.scalars(stmt).all())


@router.post("", response_model=CompanyRead, status_code=status.HTTP_201_CREATED)
def create_company(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Company:
    company = Company(user_id=current_user.id, **payload.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)
    sync_company_notifications(company, db)
    db.commit()
    db.refresh(company)
    return company


def get_latest_research(company_id: int, user_id: int, db: Session) -> CompanyResearch | None:
    return db.scalar(
        select(CompanyResearch)
        .where(CompanyResearch.company_id == company_id, CompanyResearch.user_id == user_id)
        .order_by(CompanyResearch.generated_at.desc(), CompanyResearch.id.desc())
    )


def strategy_note_from_research(research: CompanyResearch, position: str) -> str:
    return "\n\n".join(
        [
            f"[Strategy Position]\n{position}",
            f"[Reason]\n{research.research_summary}",
            f"[Next Action]\n{research.selection_points}",
            "[Personal Notes]\nReview AI research, official recruitment information, and personal fit before deciding.",
        ]
    )


@router.get("/{company_id}", response_model=CompanyRead)
def read_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Company:
    return get_owned_company(company_id, current_user.id, db)


@router.get("/{company_id}/research", response_model=CompanyResearchRead | None)
def read_company_research(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanyResearch | None:
    get_owned_company(company_id, current_user.id, db)
    return get_latest_research(company_id, current_user.id, db)


@router.get("/{company_id}/fit", response_model=CompanyFitAnalysis)
def read_company_fit(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanyFitAnalysis:
    company = get_owned_company(company_id, current_user.id, db)
    research = get_latest_research(company_id, current_user.id, db)
    profile = db.scalar(select(UserProfile).where(UserProfile.user_id == current_user.id))
    peer_companies = list(db.scalars(select(Company).where(Company.user_id == current_user.id)).all())
    return CompanyFitService().analyze(company=company, research=research, profile=profile, peer_companies=peer_companies)


@router.post("/{company_id}/research/generate", response_model=CompanyResearchRead, status_code=status.HTTP_201_CREATED)
def generate_company_research(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanyResearch:
    company = get_owned_company(company_id, current_user.id, db)
    generated = get_ai_provider("mock").generate_company_research(company)
    research = CompanyResearch(
        company_id=company.id,
        user_id=current_user.id,
        **generated.model_dump(mode="json"),
    )
    db.add(research)
    db.commit()
    db.refresh(research)
    return research


@router.post("/{company_id}/research/decision", response_model=CompanyResearchRead)
def decide_company_research(
    company_id: int,
    payload: CompanyResearchDecisionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CompanyResearch:
    company = get_owned_company(company_id, current_user.id, db)
    research = get_latest_research(company_id, current_user.id, db)
    if research is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Company research not found.")

    if payload.research_summary is not None:
        research.research_summary = payload.research_summary
    if payload.ai_strategy_position is not None:
        research.ai_strategy_position = payload.ai_strategy_position

    if payload.decision == "accept":
        research.accepted = True
        research.accepted_at = datetime.now(UTC)
        company.strategy_reason = research.research_summary
        company.recommended_action = research.selection_points
        company.user_strategy_note = strategy_note_from_research(research, research.ai_strategy_position)
    else:
        research.accepted = False
        research.accepted_at = None

    db.commit()
    db.refresh(research)
    return research


@router.put("/{company_id}", response_model=CompanyRead)
def update_company(
    company_id: int,
    payload: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Company:
    company = get_owned_company(company_id, current_user.id, db)
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(company, key, value)
    db.commit()
    db.refresh(company)
    sync_company_notifications(company, db)
    db.commit()
    db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    company = get_owned_company(company_id, current_user.id, db)
    delete_company_notifications(company, db)
    db.delete(company)
    db.commit()
