from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.company import Company
from app.models.event import Event
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskPriority, TaskRead, TaskStatus, TaskUpdate
from app.services.notifications import today_jst


router = APIRouter(prefix="/tasks", tags=["tasks"])


def get_owned_task(task_id: int, user_id: int, db: Session) -> Task:
    task = db.scalar(
        select(Task)
        .options(joinedload(Task.related_company), joinedload(Task.related_event))
        .where(Task.id == task_id, Task.user_id == user_id)
    )
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found.")
    return task


def validate_related_company(company_id: int | None, user_id: int, db: Session) -> None:
    if company_id is None:
        return
    company = db.scalar(select(Company).where(Company.id == company_id, Company.user_id == user_id))
    if company is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Related company does not exist.")


def validate_related_event(event_id: int | None, user_id: int, db: Session) -> None:
    if event_id is None:
        return
    event = db.scalar(select(Event).where(Event.id == event_id, Event.user_id == user_id))
    if event is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Related event does not exist.")


def serialize_task(task: Task) -> TaskRead:
    return TaskRead.model_validate(
        {
            **task.__dict__,
            "company_name": task.related_company.name if task.related_company else None,
            "event_title": task.related_event.title if task.related_event else None,
        }
    )


@router.get("", response_model=list[TaskRead])
def list_tasks(
    status_filter: TaskStatus | None = Query(default=None, alias="status"),
    priority: TaskPriority | None = None,
    due: str | None = Query(default=None, pattern="^(today|overdue)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TaskRead]:
    today = today_jst()
    stmt = (
        select(Task)
        .options(joinedload(Task.related_company), joinedload(Task.related_event))
        .where(Task.user_id == current_user.id)
    )
    if status_filter:
        stmt = stmt.where(Task.status == status_filter)
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if due == "today":
        stmt = stmt.where(Task.due_date == today, Task.status != "completed")
    elif due == "overdue":
        stmt = stmt.where(Task.due_date < today, Task.status != "completed")
    stmt = stmt.order_by(Task.status.asc(), Task.due_date.asc().nulls_last(), Task.id.desc())
    return [serialize_task(task) for task in db.scalars(stmt).all()]


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    payload: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskRead:
    validate_related_company(payload.related_company_id, current_user.id, db)
    validate_related_event(payload.related_event_id, current_user.id, db)
    task = Task(user_id=current_user.id, **payload.model_dump())
    db.add(task)
    db.commit()
    task = get_owned_task(task.id, current_user.id, db)
    return serialize_task(task)


@router.get("/{task_id}", response_model=TaskRead)
def read_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskRead:
    return serialize_task(get_owned_task(task_id, current_user.id, db))


@router.put("/{task_id}", response_model=TaskRead)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskRead:
    task = get_owned_task(task_id, current_user.id, db)
    update_data = payload.model_dump(exclude_unset=True)
    if "related_company_id" in update_data:
        validate_related_company(update_data["related_company_id"], current_user.id, db)
    if "related_event_id" in update_data:
        validate_related_event(update_data["related_event_id"], current_user.id, db)
    for key, value in update_data.items():
        setattr(task, key, value)
    db.commit()
    task = get_owned_task(task.id, current_user.id, db)
    return serialize_task(task)


@router.patch("/{task_id}/complete", response_model=TaskRead)
def complete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskRead:
    task = get_owned_task(task_id, current_user.id, db)
    task.status = "completed"
    db.commit()
    task = get_owned_task(task.id, current_user.id, db)
    return serialize_task(task)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    task = get_owned_task(task_id, current_user.id, db)
    db.delete(task)
    db.commit()
