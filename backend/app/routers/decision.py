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
from app.schemas.decision import DecisionSummary
from app.services.decision_engine import DecisionEngine


router = APIRouter(prefix="/decision", tags=["decision"])


@router.get("/summary", response_model=DecisionSummary)
def decision_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DecisionSummary:
    companies = list(db.scalars(select(Company).where(Company.user_id == current_user.id)).all())
    events = list(db.scalars(select(Event).where(Event.user_id == current_user.id)).all())
    notifications = list(db.scalars(select(Notification).where(Notification.user_id == current_user.id)).all())
    research_entries = list(db.scalars(select(CompanyResearch).where(CompanyResearch.user_id == current_user.id)).all())

    return DecisionEngine().build_summary(
        companies=companies,
        events=events,
        notifications=notifications,
        research_entries=research_entries,
    )
