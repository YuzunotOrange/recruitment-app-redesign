from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.company import Company
from app.models.user import User
from app.schemas.company import CompanyCreate, CompanyRead, CompanyStatus, CompanyUpdate, Industry, Priority
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


@router.get("/{company_id}", response_model=CompanyRead)
def read_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Company:
    return get_owned_company(company_id, current_user.id, db)


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
