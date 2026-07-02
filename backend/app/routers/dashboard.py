from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.dependencies.auth import get_current_user
from app.models.company import Company
from app.models.event import Event
from app.models.task import Task
from app.models.user import User
from app.schemas.dashboard import (
    DashboardKpis,
    DashboardSummary,
    DashboardUpcomingDeadline,
    DashboardUpcomingEvent,
)


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
def dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DashboardSummary:
    companies = list(db.scalars(select(Company).where(Company.user_id == current_user.id)).all())
    today = datetime.now(UTC).date()
    soon = today + timedelta(days=7)

    status_counts = {
        "planned": 0,
        "es_submitted": 0,
        "es_rejected": 0,
        "spi_rejected": 0,
        "interview": 0,
        "offer": 0,
        "declined": 0,
    }
    industry_counts = {"maker": 0, "finance": 0, "consulting": 0, "it": 0, "other": 0}

    for company in companies:
        status_counts[company.status] = status_counts.get(company.status, 0) + 1
        industry_counts[company.industry] = industry_counts.get(company.industry, 0) + 1

    company_deadline_soon = sum(
        1
        for company in companies
        if isinstance(company.es_deadline, date) and today <= company.es_deadline <= soon
    )

    event_rows = list(
        db.scalars(
            select(Event)
            .options(joinedload(Event.company))
            .where(Event.user_id == current_user.id)
            .order_by(Event.start_date.asc(), Event.start_time.asc().nulls_last(), Event.id.asc())
        ).all()
    )
    upcoming_event_rows = [event for event in event_rows if event.start_date >= today]
    upcoming_deadline_events = [event for event in upcoming_event_rows if event.type == "deadline"]
    upcoming_schedule_events = [event for event in upcoming_event_rows if event.type != "deadline"]
    event_deadline_soon = sum(1 for event in upcoming_deadline_events if today <= event.start_date <= soon)
    interview_events = sum(1 for event in event_rows if event.type == "interview")
    internship_events = sum(1 for event in event_rows if event.type == "intern")
    today_events = sum(1 for event in event_rows if event.start_date <= today <= event.end_date)
    today_company_deadlines = sum(1 for company in companies if company.es_deadline == today)
    task_rows = list(db.scalars(select(Task).where(Task.user_id == current_user.id)).all())
    incomplete_tasks = sum(1 for task in task_rows if task.status != "completed")
    overdue_tasks = sum(
        1
        for task in task_rows
        if task.status != "completed" and task.due_date is not None and task.due_date < today
    )
    today_task_rows = sum(1 for task in task_rows if task.status != "completed" and task.due_date == today)
    completed_tasks = sum(1 for task in task_rows if task.status == "completed")
    task_completion_rate = round((completed_tasks / len(task_rows)) * 100) if task_rows else 0

    kpis = DashboardKpis(
        total_companies=len(companies),
        es_in_review=status_counts.get("es_submitted", 0),
        interviews=interview_events,
        awaiting=status_counts.get("planned", 0),
        offers=status_counts.get("offer", 0),
        deadline_soon=company_deadline_soon + event_deadline_soon,
        internships=internship_events,
        today_tasks=today_events + today_company_deadlines + today_task_rows,
        incomplete_tasks=incomplete_tasks,
        overdue_tasks=overdue_tasks,
        task_completion_rate=task_completion_rate,
    )

    upcoming_events = [
        DashboardUpcomingEvent(
            id=event.id,
            title=event.title,
            company_name=event.company.name if event.company else None,
            start_at=event.start_date.isoformat(),
            time=event.start_time.strftime("%H:%M") if event.start_time else None,
        )
        for event in upcoming_schedule_events[:5]
    ]
    company_deadlines = [
        DashboardUpcomingDeadline(
            id=f"company-{company.id}",
            title="ES deadline",
            company_name=company.name,
            deadline=company.es_deadline.isoformat(),
        )
        for company in companies
        if isinstance(company.es_deadline, date) and company.es_deadline >= today
    ]
    event_deadlines = [
        DashboardUpcomingDeadline(
            id=f"event-{event.id}",
            title=event.title,
            company_name=event.company.name if event.company else None,
            deadline=event.start_date.isoformat(),
        )
        for event in upcoming_deadline_events
    ]
    upcoming_deadlines = sorted(
        [*company_deadlines, *event_deadlines],
        key=lambda item: (item.deadline, str(item.id)),
    )[:5]

    return DashboardSummary(
        kpis=kpis,
        company_status_counts=status_counts,
        industry_counts=industry_counts,
        upcoming_events=upcoming_events,
        upcoming_deadlines=upcoming_deadlines,
    )
