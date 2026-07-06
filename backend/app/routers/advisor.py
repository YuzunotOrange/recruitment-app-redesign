from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.company import Company
from app.models.company_research import CompanyResearch
from app.models.event import Event
from app.models.notification import Notification
from app.models.user import User
from app.schemas.advisor import AdvisorSummary
from app.services.advisor_engine import AdvisorEngine


router = APIRouter(prefix="/advisor", tags=["advisor"])


@router.get("/summary", response_model=AdvisorSummary)
def advisor_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AdvisorSummary:
    companies = list(db.scalars(select(Company).where(Company.user_id == current_user.id)).all())
    events = list(db.scalars(select(Event).where(Event.user_id == current_user.id)).all())
    notifications = list(db.scalars(select(Notification).where(Notification.user_id == current_user.id)).all())
    research_entries = list(db.scalars(select(CompanyResearch).where(CompanyResearch.user_id == current_user.id)).all())

    return AdvisorEngine().build_summary(
        companies=companies,
        events=events,
        notifications=notifications,
        research_entries=research_entries,
    )
