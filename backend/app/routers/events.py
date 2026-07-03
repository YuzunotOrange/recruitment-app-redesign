from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.company import Company
from app.models.event import Event, EventCandidateDate
from app.models.user import User
from app.schemas.event import EventCreate, EventRead, EventUpdate
from app.services.notifications import delete_event_notifications, sync_event_notifications


router = APIRouter(prefix="/events", tags=["events"])


def get_owned_event(event_id: int, user_id: int, db: Session) -> Event:
    event = db.scalar(
        select(Event)
        .options(joinedload(Event.company), selectinload(Event.candidate_dates))
        .where(Event.id == event_id, Event.user_id == user_id)
    )
    if event is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found.")
    return event


def validate_owned_company(company_id: int | None, user_id: int, db: Session) -> None:
    if company_id is None:
        return
    company = db.scalar(select(Company).where(Company.id == company_id, Company.user_id == user_id))
    if company is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Company does not exist.")


def serialize_event(event: Event) -> EventRead:
    return EventRead.model_validate(
        {
            **event.__dict__,
            "company_name": event.company.name if event.company else None,
            "candidate_dates": event.candidate_dates,
        }
    )


def validate_candidate_selection(candidates: list) -> None:
    selected_count = sum(1 for candidate in candidates if candidate.is_selected)
    if selected_count > 1:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Only one candidate date can be selected.")


def effective_candidate(candidates: list[EventCandidateDate]) -> EventCandidateDate | None:
    if not candidates:
        return None
    selected = next((candidate for candidate in candidates if candidate.is_selected), None)
    if selected is not None:
        return selected
    return sorted(
        candidates,
        key=lambda candidate: (
            candidate.start_date,
            candidate.start_time is None,
            candidate.start_time,
            candidate.id or 0,
        ),
    )[0]


def sync_event_representative_date(event: Event) -> None:
    candidate = effective_candidate(list(event.candidate_dates))
    if candidate is None:
        return
    event.start_date = candidate.start_date
    event.end_date = candidate.end_date
    event.start_time = candidate.start_time
    event.end_time = candidate.end_time


def replace_candidate_dates(event: Event, candidates: list) -> None:
    validate_candidate_selection(candidates)
    event.candidate_dates.clear()
    for candidate in candidates:
        event.candidate_dates.append(EventCandidateDate(**candidate.model_dump()))
    sync_event_representative_date(event)


@router.get("", response_model=list[EventRead])
def list_events(
    company_id: int | None = None,
    event_type: str | None = Query(default=None, alias="type"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[EventRead]:
    stmt = (
        select(Event)
        .options(joinedload(Event.company), selectinload(Event.candidate_dates))
        .where(Event.user_id == current_user.id)
    )
    if company_id is not None:
        stmt = stmt.where(Event.company_id == company_id)
    if event_type:
        stmt = stmt.where(Event.type == event_type)
    stmt = stmt.order_by(Event.start_date.asc(), Event.start_time.asc().nulls_last(), Event.id.asc())
    return [serialize_event(event) for event in db.scalars(stmt).all()]


@router.post("", response_model=EventRead, status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventRead:
    validate_owned_company(payload.company_id, current_user.id, db)
    payload_data = payload.model_dump(exclude={"candidate_dates"})
    event = Event(user_id=current_user.id, **payload_data)
    replace_candidate_dates(event, payload.candidate_dates)
    db.add(event)
    db.commit()
    db.refresh(event)
    sync_event_notifications(event, db)
    db.commit()
    event = get_owned_event(event.id, current_user.id, db)
    return serialize_event(event)


@router.get("/{event_id}", response_model=EventRead)
def read_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventRead:
    return serialize_event(get_owned_event(event_id, current_user.id, db))


@router.put("/{event_id}", response_model=EventRead)
def update_event(
    event_id: int,
    payload: EventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EventRead:
    event = get_owned_event(event_id, current_user.id, db)
    update_data = payload.model_dump(exclude_unset=True, exclude={"candidate_dates"})

    if "company_id" in update_data:
        validate_owned_company(update_data["company_id"], current_user.id, db)

    start_date = update_data.get("start_date", event.start_date)
    end_date = update_data.get("end_date", event.end_date)
    if end_date < start_date:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="end_date must be on or after start_date.")

    for key, value in update_data.items():
        setattr(event, key, value)

    if payload.candidate_dates is not None:
        replace_candidate_dates(event, payload.candidate_dates)

    db.commit()
    db.refresh(event)
    sync_event_notifications(event, db)
    db.commit()
    event = get_owned_event(event.id, current_user.id, db)
    return serialize_event(event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    event = get_owned_event(event_id, current_user.id, db)
    delete_event_notifications(event, db)
    db.delete(event)
    db.commit()
