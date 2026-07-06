from typing import Literal

from pydantic import BaseModel


MainIssue = Literal["SPI", "ES", "Interview", "Application Balance", "Deadline", "No Issue"]
RiskLevel = Literal["high", "medium", "low"]
StrategyPosition = Literal["Reach", "Core", "Safe"]


class DecisionTask(BaseModel):
    title: str
    reason: str
    priority: RiskLevel = "medium"


class SuggestedCompanyGap(BaseModel):
    position: StrategyPosition
    shortage: int
    reason: str


class RiskMonitor(BaseModel):
    es: RiskLevel
    spi: RiskLevel
    interview: RiskLevel
    deadline: RiskLevel


class BalanceSnapshot(BaseModel):
    reach_count: int
    core_count: int
    safe_count: int
    hold_count: int
    reach_ratio: float
    core_ratio: float
    safe_ratio: float
    ideal_reach_ratio: int = 30
    ideal_core_ratio: int = 50
    ideal_safe_ratio: int = 20


class DecisionSummary(BaseModel):
    main_issue: MainIssue
    reason: str
    today_tasks: list[DecisionTask]
    week_tasks: list[DecisionTask]
    suggested_companies: list[SuggestedCompanyGap]
    risk_monitor: RiskMonitor
    application_balance: BalanceSnapshot
    current_situation: str
    system_analysis: str
