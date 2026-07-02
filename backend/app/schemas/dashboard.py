from pydantic import BaseModel


class DashboardKpis(BaseModel):
    total_companies: int
    es_in_review: int
    interviews: int
    awaiting: int
    offers: int
    deadline_soon: int
    internships: int = 0
    today_tasks: int = 0
    incomplete_tasks: int = 0
    overdue_tasks: int = 0
    task_completion_rate: int = 0


class DashboardUpcomingEvent(BaseModel):
    id: int
    title: str
    company_name: str | None = None
    start_at: str
    time: str | None = None


class DashboardUpcomingDeadline(BaseModel):
    id: int | str
    title: str | None = None
    company_name: str | None = None
    deadline: str


class DashboardSummary(BaseModel):
    kpis: DashboardKpis
    company_status_counts: dict[str, int]
    industry_counts: dict[str, int]
    upcoming_events: list[DashboardUpcomingEvent] = []
    upcoming_deadlines: list[DashboardUpcomingDeadline] = []
