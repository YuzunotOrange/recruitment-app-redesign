from typing import Literal

from pydantic import BaseModel


AdvisorMainIssue = Literal["SPI", "ES", "Interview", "Application Balance", "Deadline", "No Issue"]
AdvisorPriority = Literal["high", "medium", "low"]
AdvisorRiskLevel = Literal["high", "medium", "low"]


class AdvisorAction(BaseModel):
    id: str
    title: str
    reason: str
    priority: AdvisorPriority = "medium"


class AdvisorRiskMonitor(BaseModel):
    es: AdvisorRiskLevel
    spi: AdvisorRiskLevel
    interview: AdvisorRiskLevel
    deadline: AdvisorRiskLevel


class AdvisorDeadlineAlert(BaseModel):
    title: str
    due_date: str
    days_left: int
    source: Literal["company", "event"]


class AdvisorApplicationBalance(BaseModel):
    reach_ratio: float
    core_ratio: float
    safe_ratio: float
    hold_count: int
    recommendation: str


class AdvisorSummary(BaseModel):
    current_situation: str
    main_issue: AdvisorMainIssue
    reason: str
    todays_mission: list[AdvisorAction]
    this_week: list[AdvisorAction]
    suggested_improvements: list[AdvisorAction]
    risk_monitor: AdvisorRiskMonitor
    deadline_alerts: list[AdvisorDeadlineAlert]
    missing_portfolio: list[str]
    application_balance: AdvisorApplicationBalance
    system_note: str = (
        "Advisor Engine analyzes and prioritizes only. "
        "It never decides application acceptance, preference order, or company changes."
    )
